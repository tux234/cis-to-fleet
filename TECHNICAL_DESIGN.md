# cis-to-fleet Technical Design Document

## Overview

This document captures the architectural decisions, implementation patterns, and design rationale for the cis-to-fleet project. It serves as a reference for future development, maintenance, and architectural changes.

## Project Context & Requirements

### Business Problem
Organizations using Fleet need a tool to transform CIS (Center for Internet Security) benchmark policies from the Fleet repository into clean, Fleet-compatible YAML files for their GitOps workflows.

### Key Requirements
1. **Data Source**: Fetch CIS benchmarks from `fleetdm/fleet/ee/cis/` on GitHub
2. **Transformation**: Convert Kubernetes-style YAML to Fleet-compatible format
3. **Field Sanitization**: Keep only essential fields (name, platform, description, resolution, query)
4. **User Experience**: Both CLI for automation and TUI for interactive use
5. **Cross-platform**: Support macOS, Windows, Linux
6. **Output Format**: Clean `.yml` files with proper multiline formatting

## Architecture Overview

### High-Level Architecture
```
┌──────────────┐
│  CLI/TUI     │  Typer + Textual interfaces
│  Entry Point │  
└──────┬───────┘
       │
       ├─ GitHub Client  ← Fetch data from GitHub API
       ├─ Transform      ← Parse & sanitize YAML data  
       └─ Writer         ← Output file management
```

### Layer Separation
1. **Presentation Layer**: CLI (Typer) and TUI (Textual) interfaces
2. **Business Logic Layer**: GitHub client, YAML transformation
3. **Data Access Layer**: File I/O and HTTP requests

## Core Components

### 1. GitHub Client (`github.py`)

**Purpose**: Abstracts GitHub API interactions for fetching CIS benchmark data.

**Key Design Decisions**:
- **Async/Sync Pattern**: Provides both async and sync interfaces for flexibility
- **Error Handling**: Clear error messages for network issues and missing files
- **No Authentication**: Uses public GitHub API (60 req/hr limit sufficient)

```python
class GitHubClient:
    async def list_folders() -> list[str]     # Get available platforms
    async def fetch_yaml(folder: str) -> str  # Get raw YAML content

# Sync wrappers for CLI compatibility
def list_folders_sync() -> list[str]
def fetch_yaml_sync(folder: str) -> str
```

**Why This Design**:
- Separation of concerns: networking isolated from business logic
- Testable: Easy to mock HTTP interactions
- Flexible: Can support authenticated requests in future

### 2. Transform Layer (`transform.py`)

**Purpose**: Converts raw CIS benchmark YAML into Fleet-compatible format.

**Key Design Decisions**:
- **Multi-document YAML Support**: Handles Kubernetes-style YAML with multiple documents
- **Field Filtering**: Explicit allowlist of required fields only
- **Literal Block Scalars**: Preserves multiline formatting using `ruamel.yaml`
- **Ordered Output**: Maintains consistent field order

```python
ALLOWED_KEYS = ["name", "platform", "description", "resolution", "query"]

def raw_yaml_to_list(yaml_str: str) -> list[dict[str, Any]]  # Parse multiple docs
def sanitise(item: dict[str, Any]) -> dict[str, Any]         # Filter fields
def sanitise_all(items: list[dict[str, Any]]) -> list[dict[str, Any]]
def to_yaml(items: list[dict[str, Any]]) -> str              # Format output
```

**Critical Implementation Details**:
- **Kubernetes YAML Parsing**: Extracts `spec` from documents with `kind: policy`
- **Multiline String Handling**: Uses `LiteralScalarString` for proper `\n` → actual line breaks
- **ruamel.yaml Configuration**: Specific settings for Fleet-compatible output format

**Why This Design**:
- **Defensive**: Only keeps explicitly allowed fields
- **Maintainable**: Clear transformation pipeline
- **Consistent**: Deterministic output format

### 3. File Writer (`writer.py`)

**Purpose**: Manages output file paths and writing with conflict resolution.

**Key Design Decisions**:
- **Path Normalization**: Strips hyphens from folder names (`macos-15` → `macos15`)
- **Directory Creation**: Automatically creates output directories
- **Overwrite Protection**: Explicit opt-in for overwriting existing files
- **Extension Standardization**: Uses `.yml` (not `.yaml`)

```python
def output_path(folder: str, out_dir: Path) -> Path  # Generate clean paths
def write(text: str, path: Path, overwrite: bool = False) -> None  # Safe writing
```

**Why This Design**:
- **Predictable**: Consistent naming convention
- **Safe**: Prevents accidental overwrites
- **User-friendly**: Clear error messages for file conflicts

### 4. CLI Interface (`__main__.py`)

**Purpose**: Command-line interface for automation and scripting.

**Key Design Decisions**:
- **Typer Framework**: Modern CLI with automatic help generation
- **Command Structure**: Separate commands for different operations
- **Error Handling**: Non-zero exit codes for script compatibility
- **Progress Feedback**: User feedback during long operations

```python
@app.command()
def list() -> None                    # List available platforms

@app.command() 
def generate(                         # Generate Fleet YAML files
    platforms: List[str],
    all_platforms: bool = False,
    output: Path = Path("./output"),
    force: bool = False
) -> None

@app.command()
def tui() -> None                     # Launch interactive TUI
```

**Why This Design**:
- **Composable**: Individual commands can be scripted
- **Flexible**: Supports both single and batch operations
- **Automation-friendly**: Clear exit codes and error messages

### 5. TUI Interface (`tui/app.py`)

**Purpose**: Interactive terminal interface for manual use.

**Key Design Decisions**:
- **Textual Framework**: Modern TUI with rich widgets
- **Async Operations**: Non-blocking UI during network operations
- **Progress Tracking**: Visual feedback with progress bars
- **Error Resilience**: Continues processing on individual platform failures

```python
class CISBenchmarkApp(App[None]):
    - Checkbox selection with "Select All"
    - Background generation with progress tracking
    - Success/error status reporting
```

**Critical Implementation Details**:
- **Worker Pattern**: Uses `@work(exclusive=True)` for background tasks
- **Thread Safety**: Network operations run in executor to avoid blocking UI
- **State Management**: Tracks selected platforms and generation status

**Why This Design**:
- **User Experience**: Visual feedback and interactive selection
- **Performance**: Non-blocking operations maintain UI responsiveness
- **Error Handling**: Graceful degradation on individual failures

## Data Flow & Processing Pipeline

### 1. Platform Discovery
```
GitHub API → list_folders_sync() → ["macos-13", "macos-14", "win-11", ...]
```

### 2. YAML Fetching & Transformation
```
Platform → GitHub Raw URL → Multi-doc YAML → Extract specs → Filter fields → Format output
```

### 3. File Output
```
Sanitized data → YAML formatting → Path generation → File writing → User feedback
```

## Key Implementation Challenges & Solutions

### Challenge 1: Kubernetes-style YAML Format
**Problem**: CIS benchmarks use Kubernetes-style YAML with multiple documents and nested `spec` fields.

**Solution**: 
- Use `yaml.load_all()` to handle multiple documents
- Extract `spec` field from documents with `kind: policy`
- Fallback to direct list format for compatibility

### Challenge 2: Multiline String Formatting
**Problem**: YAML multiline strings were being output with `\n` literals instead of actual line breaks.

**Solution**:
- Use `ruamel.yaml.scalarstring.LiteralScalarString` for multiline content
- Configure YAML formatter for block scalar style (`|`)
- Detect multiline strings and convert during sanitization

### Challenge 3: Async/Sync Interface Compatibility
**Problem**: TUI needs async operations, CLI needs sync operations.

**Solution**:
- Implement async core functions
- Provide sync wrappers using `asyncio.run()`
- Use `asyncio.get_event_loop().run_in_executor()` for TUI threading

### Challenge 4: Error Handling Across Multiple Platforms
**Problem**: Single platform failure shouldn't stop batch operations.

**Solution**:
- Collect errors instead of failing fast
- Aggregate exit codes for CLI
- Show partial success with error summary in TUI

## Testing Strategy

### Unit Testing Approach
- **Mocking**: Use `pytest-httpx` and `responses` for HTTP mocking
- **Isolation**: Test each component independently
- **Golden Files**: Compare output against known-good fixtures
- **Edge Cases**: Test error conditions and malformed data

### Test Coverage Areas
1. **GitHub Client**: Network interactions, error handling
2. **Transform Layer**: YAML parsing, field filtering, output formatting
3. **File Writer**: Path generation, overwrite logic
4. **CLI**: Command parsing, exit codes, error messages

### Integration Testing
- **End-to-End**: Mock GitHub API and test complete workflow
- **Cross-Platform**: Test file path handling on different OS
- **Real Data**: Validate against actual CIS benchmark files

## Performance Considerations

### Network Optimization
- **Lazy Loading**: Only fetch platforms when needed
- **Concurrent Processing**: TUI processes platforms in sequence (simpler error handling)
- **Caching**: Not implemented (MVP decision) - could add directory listing cache

### Memory Management
- **Streaming**: Process one platform at a time (not batch loading)
- **Cleanup**: No persistent state between operations

### UI Responsiveness
- **Background Operations**: Network calls don't block TUI
- **Progress Feedback**: Visual indication of long-running operations

## Security Considerations

### Data Sources
- **Public API**: Only accesses public GitHub repositories
- **No Authentication**: No API keys or tokens stored
- **Rate Limiting**: Respects GitHub's 60 req/hr limit for unauthenticated requests

### File Operations
- **Path Traversal**: Uses `pathlib` for safe path operations
- **Overwrite Protection**: Explicit confirmation required
- **Directory Creation**: Limited to specified output directory

### Input Validation
- **YAML Parsing**: Uses safe YAML loader (no code execution)
- **Field Filtering**: Explicit allowlist prevents unexpected data
- **Error Boundaries**: Graceful handling of malformed input

## Deployment & Distribution

### Package Structure
```
fleet-cis-tui/
├── src/fleet_cis_tui/     # Main package
├── tests/                 # Test suite
├── scripts/               # Build scripts
├── .github/workflows/     # CI/CD
└── docs/                  # Documentation
```

### Build System
- **pyproject.toml**: Modern Python packaging
- **setuptools**: Build backend with wheel support
- **Entry Points**: CLI command registration

### Distribution Strategy
- **PyPI**: Primary distribution channel
- **pipx**: Recommended installation method
- **Wheel**: Universal Python 3.9+ wheel

### CI/CD Pipeline
- **Multi-platform Testing**: macOS, Windows, Linux
- **Python Versions**: 3.9, 3.10, 3.11
- **Quality Gates**: Linting, type checking, testing
- **Build Verification**: Smoke test with generated wheel

## Future Enhancement Opportunities

### Performance
1. **Caching**: Add platform list caching with TTL
2. **Concurrency**: Parallel platform processing with rate limiting
3. **Incremental Updates**: Only fetch changed platforms

### Features
1. **Custom Repositories**: Support non-Fleet CIS sources
2. **Output Formats**: JSON, CSV export options
3. **Filtering**: Platform-specific or tag-based filtering
4. **Validation**: Schema validation for output files

### Developer Experience
1. **Hot Reload**: Development mode with auto-refresh
2. **Logging**: Structured logging for debugging
3. **Metrics**: Usage and performance telemetry
4. **Plugin System**: Extensible transformation pipeline

### Distribution
1. **Binary Releases**: PyInstaller single-file executables
2. **Container Images**: Docker images for CI/CD
3. **Package Managers**: Homebrew, Chocolatey, APT/YUM

## Lessons Learned

### What Worked Well
1. **Layered Architecture**: Clear separation made testing and maintenance easier
2. **Async/Sync Duality**: Flexibility for different use cases without complexity
3. **Incremental Development**: Following the prompt plan enabled systematic progress
4. **Type Hints**: MyPy caught integration issues early
5. **Comprehensive Testing**: Mocking enabled fast, reliable tests

### What Could Be Improved
1. **Error Messages**: Could be more specific about which platform failed and why
2. **Configuration**: Hard-coded GitHub URLs could be configurable
3. **Progress Granularity**: TUI shows platform-level progress, not individual steps
4. **Memory Usage**: Could optimize for very large numbers of platforms

### Technical Debt
1. **License Format**: PyProject.toml license format needs updating for new setuptools
2. **Dependency Versions**: Some version ranges could be tightened
3. **Documentation**: API documentation could be more comprehensive

## Maintenance Guidelines

### Code Style
- **Formatting**: Use ruff for linting and formatting
- **Type Hints**: Maintain 100% type hint coverage
- **Docstrings**: Document all public APIs
- **Testing**: Maintain >90% test coverage

### Version Management
- **Semantic Versioning**: Follow semver for releases
- **Changelog**: Update CHANGELOG.md for all changes
- **Compatibility**: Maintain Python 3.9+ compatibility

### Dependencies
- **Regular Updates**: Review and update dependencies quarterly
- **Security**: Monitor for security vulnerabilities
- **Compatibility**: Test with new dependency versions before merging

This document should be updated whenever significant architectural changes are made to ensure it remains an accurate reference for future development.