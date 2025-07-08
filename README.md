# cis-to-fleet

Convert CIS benchmarks to Fleet-compatible policy files.

## Quick Start

Install with pipx (recommended):

```bash
pipx install cis-to-fleet
```

Or install with pip:

```bash
pip install cis-to-fleet
```

## Usage

### Command Line Interface (Recommended)

The CLI is the most stable way to use this tool:

**List available platforms:**
```bash
cis-to-fleet list
```

**Generate single platform:**
```bash
cis-to-fleet generate macos-15
```

**Generate multiple platforms:**
```bash
cis-to-fleet generate macos-15 win-11
```

**Generate all platforms:**
```bash
cis-to-fleet generate --all
```

**Custom output directory:**
```bash
cis-to-fleet generate macos-15 --output /path/to/output
```

**Force overwrite existing files:**
```bash
cis-to-fleet generate macos-15 --force
```

**Filter by CIS level:**
```bash
# Generate only Level 1 policies (essential security)
cis-to-fleet generate macos-15 --level 1

# Generate only Level 2 policies (advanced security)
cis-to-fleet generate macos-15 --level 2

# Generate all levels (default)
cis-to-fleet generate macos-15 --level all
```

### Interactive TUI (Alpha)

⚠️ **Note:** The TUI is currently in alpha and may have stability issues. CLI mode is recommended for production use.

Launch the interactive terminal interface:

```bash
cis-to-fleet tui
```

- Use checkboxes to select platforms
- "Select All" to choose all available platforms  
- Press `G` or click "Generate" to create Fleet YAML files
- Press `Q` or Escape to quit

## What it does

This tool fetches CIS (Center for Internet Security) benchmark policies from the Fleet repository and transforms them into clean, Fleet-compatible YAML files:

1. **Discovers** CIS benchmark platforms from `fleetdm/fleet/ee/cis/`
2. **Fetches** raw policy YAML files from GitHub
3. **Filters** policies by CIS level (optional):
   - **Level 1** - Essential security policies for all organizations
   - **Level 2** - Advanced security policies for high-security environments
4. **Transforms** data by extracting only essential fields:
   - `name` - Policy name
   - `platform` - Target platform (darwin, windows, etc.)
   - `description` - Policy description
   - `resolution` - How to fix the issue
   - `query` - SQL query to check compliance
5. **Outputs** clean `.yml` files in `./output/` directory

## Requirements

- Python 3.9+
- Internet connection (to fetch from GitHub)

## Development

Clone and install in development mode:

```bash
git clone <repository>
cd cis-to-fleet
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -e ".[dev]"
```

Run tests:
```bash
pytest
```

Run linting:
```bash
ruff check src tests
mypy src
```

## License

MIT License