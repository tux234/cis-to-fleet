# CIS to Fleet

Convert CIS benchmarks to Fleet-compatible policy files for streamlined security compliance management.

## Features

- 🚀 **Fast**: High-performance execution with modern JavaScript
- 🔧 **Flexible**: Multiple output formats for different GitOps workflows
- 📦 **Reliable**: Type-safe codebase with comprehensive testing
- 🌐 **Compatible**: Works with Node.js 18+ environments
- ⚡ **Efficient**: Direct GitHub API integration with intelligent caching

## Installation

### Option 1: Using Bun (Recommended)
```bash
# Install Bun if you haven't already
curl -fsSL https://bun.sh/install | bash

# Clone and setup
git clone https://github.com/your-org/cis-to-fleet.git
cd cis-to-fleet
bun install
```

### Option 2: Using Node.js
```bash
# Requires Node.js 18+
git clone https://github.com/your-org/cis-to-fleet.git
cd cis-to-fleet
npm install
```

## Usage

### With Bun (Recommended)

**List available platforms:**
```bash
bun run src/cli.ts list
```

**Generate single platform:**
```bash
bun run src/cli.ts generate macos-15
```

**Generate multiple platforms:**
```bash
bun run src/cli.ts generate macos-15 win-11
```

**Generate all platforms:**
```bash
bun run src/cli.ts generate --all
```

**Custom output directory:**
```bash
bun run src/cli.ts generate macos-15 --output /path/to/output
```

**Force overwrite existing files:**
```bash
bun run src/cli.ts generate macos-15 --force
```

**Filter by CIS level:**
```bash
# Generate only Level 1 policies (essential security)
bun run src/cli.ts generate macos-15 --level 1

# Generate only Level 2 policies (advanced security)
bun run src/cli.ts generate macos-15 --level 2

# Generate all levels (default)
bun run src/cli.ts generate macos-15 --level all
```

**Choose output format for GitOps workflows:**
```bash
# Combined format - single file for bulk deployment (default)
bun run src/cli.ts generate macos-15 --format combine

# Split format - individual files for selective policy management
bun run src/cli.ts generate macos-15 --format split
```

### With Node.js

For environments where Bun isn't available:

```bash
# Build the project first
npm run build

# Then use the compiled version
node dist/cli.js list
node dist/cli.js generate macos-15
```

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

- **Node.js 18+** or **Bun**
- Internet connection (to fetch CIS benchmarks from GitHub)

## Available Platforms

Currently supported CIS benchmark platforms:
- `macos-13` - macOS 13 (Ventura)
- `macos-14` - macOS 14 (Sonoma)  
- `macos-15` - macOS 15 (Sequoia)
- `win-10` - Windows 10
- `win-11` - Windows 11

Use `bun run src/cli.ts list` to see the current list of available platforms.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Support

If you encounter issues or have questions, please open an issue on GitHub.

## License

MIT License