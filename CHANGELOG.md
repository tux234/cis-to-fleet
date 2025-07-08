# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.0] - 2025-01-XX

### Added
- **GitOps Repository Organization**: New `--format` option to control output file structure
  - `--format combine` (default): Single YAML file with all policies for bulk deployment
  - `--format split`: Individual YAML files per policy for selective GitOps management
- **CIS Level Filtering**: New `--level` option to filter policies by CIS compliance level
  - `--level 1`: Essential security policies for all organizations
  - `--level 2`: Advanced security policies for high-security environments
  - `--level all` (default): Include all CIS levels
- Enhanced output messaging to clearly indicate generation results
- Improved policy file naming with sanitized filenames for split format

### Changed
- Split format creates organized directory structure: `output/{platform}/Policy_Name.yml`
- Individual policy files now include proper Fleet-compatible format with `- name:` prefix
- Policy field ordering optimized for Fleet: name, query, critical, description, resolution, platform
- All split format policies include `critical: false` field for CIS compliance policies

### Technical Details
- Added `filter_by_level()` function supporting both `CIS_Level1` and `CIS_LEVEL1` tag formats
- Added `to_yaml_chunks()` function for individual policy file generation
- Enhanced CLI validation for both level and format parameters
- Maintained backward compatibility with existing workflows

## [0.1.0] - 2024-12-XX

### Added
- Initial release of cis-to-fleet
- CLI command `list` to show available CIS benchmark platforms
- CLI command `generate` with support for:
  - Single platform generation
  - Multiple platform generation
  - `--all` flag to generate all platforms
  - `--output` flag for custom output directory
  - `--force` flag to overwrite existing files
- Interactive TUI with checkbox selection interface
- Support for platforms: macOS 13/14/15, Windows 10/11
- YAML transformation with field sanitization
- Progress tracking during generation
- Comprehensive test suite with >90% coverage
- Cross-platform support (macOS, Windows, Linux)

### Technical Details
- Built with Typer for CLI and Textual for TUI
- Uses ruamel.yaml for proper YAML formatting
- Fetches data from fleetdm/fleet GitHub repository
- Outputs Fleet-compatible YAML files with .yml extension
- Handles multiline strings with literal block scalars
- Async/await support for non-blocking UI operations

[0.2.0]: https://github.com/username/cis-to-fleet/releases/tag/v0.2.0
[0.1.0]: https://github.com/username/cis-to-fleet/releases/tag/v0.1.0