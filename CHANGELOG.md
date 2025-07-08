# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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

[0.1.0]: https://github.com/username/cis-to-fleet/releases/tag/v0.1.0