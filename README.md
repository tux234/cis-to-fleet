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

**Choose output format for GitOps workflows:**
```bash
# Combined format - single file for bulk deployment (default)
cis-to-fleet generate macos-15 --format combine

# Split format - individual files for selective policy management
cis-to-fleet generate macos-15 --format split
```

**Combine both options:**
```bash
# Get Level 1 policies as individual files for cherry-picking
cis-to-fleet generate macos-15 --level 1 --format split

# Get all policies in a single file for bulk deployment
cis-to-fleet generate macos-15 --level all --format combine
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

This tool fetches CIS (Center for Internet Security) benchmark policies from the Fleet repository and transforms them into clean, Fleet-compatible YAML files. **The primary purpose is to provide GitOps repository organization options**, allowing users to structure their policy files based on their deployment and management workflows.

## Key Features

### 1. GitOps Repository Organization
Choose how to structure your policy files for optimal GitOps workflows:

- **Combined format** (`--format combine`): Single YAML file containing all policies
  - **Use case**: Bulk deployment and management
  - **Output**: `output/cis-benchmark-macos15.yml`
  - **Best for**: Organizations wanting to deploy all CIS policies at once

- **Split format** (`--format split`): Individual YAML files per policy
  - **Use case**: Selective policy management and cherry-picking
  - **Output**: `output/macos-15/Policy_Name_1.yml`, `Policy_Name_2.yml`, etc.
  - **Best for**: Organizations wanting to selectively choose and customize policies

### 2. CIS Level Filtering
Filter policies by compliance level to match your security requirements:

- **Level 1** - Essential security policies recommended for all organizations
- **Level 2** - Advanced security policies for high-security environments

## How It Works

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
5. **Outputs** clean `.yml` files optimized for your chosen GitOps workflow

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