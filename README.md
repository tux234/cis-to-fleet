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

### Interactive TUI (default)

Launch the interactive terminal interface:

```bash
cis-to-fleet tui
```

- Use checkboxes to select platforms
- "Select All" to choose all available platforms  
- Press `G` or click "Generate" to create Fleet YAML files
- Press `Q` or Escape to quit

### Command Line Interface

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

## What it does

This tool fetches CIS (Center for Internet Security) benchmark policies from the Fleet repository and transforms them into clean, Fleet-compatible YAML files:

1. **Discovers** CIS benchmark platforms from `fleetdm/fleet/ee/cis/`
2. **Fetches** raw policy YAML files from GitHub
3. **Transforms** data by extracting only essential fields:
   - `name` - Policy name
   - `platform` - Target platform (darwin, windows, etc.)
   - `description` - Policy description
   - `resolution` - How to fix the issue
   - `query` - SQL query to check compliance
4. **Outputs** clean `.yml` files in `./output/` directory

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