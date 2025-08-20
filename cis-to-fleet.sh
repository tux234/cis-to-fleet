#!/bin/bash

# =============================================================================
# CIS to Fleet - Canonical Bash Implementation
# =============================================================================
#
# DESCRIPTION:
#   Converts CIS (Center for Internet Security) benchmark policies from the
#   Fleet repository into clean, Fleet-compatible YAML files for streamlined
#   security compliance management.
#
# AUTHOR: Mitch Francese
# VERSION: 2.0.0
# LICENSE: MIT
#
# FEATURES:
#   - Discovers CIS benchmark platforms from Fleet's GitHub repository
#   - Supports GitOps and fleetctl output formats
#   - Filters policies by CIS compliance levels (1, 2, all)
#   - Generates combined or individual policy files
#   - Preserves original YAML formatting with proper literal blocks
#   - Comprehensive error handling and logging
#
# DEPENDENCIES:
#   - bash (4.0+)
#   - curl (HTTP requests)
#   - jq (JSON processing)
#   - yq (YAML processing)
#
# =============================================================================

set -euo pipefail

# =============================================================================
# CONFIGURATION CONSTANTS
# =============================================================================

readonly SCRIPT_NAME="$(basename "$0")"
readonly SCRIPT_VERSION="2.0.0"

# GitHub API endpoints for Fleet CIS benchmark repository
readonly FLEET_GITHUB_API_BASE="https://api.github.com/repos/fleetdm/fleet/contents/ee/cis"
readonly FLEET_GITHUB_RAW_BASE="https://raw.githubusercontent.com/fleetdm/fleet/main/ee/cis"

# Default configuration
readonly DEFAULT_OUTPUT_DIRECTORY="./output"
readonly DEFAULT_CIS_LEVEL="all"

# Temporary directory for processing (unique per script instance)
readonly TEMP_PROCESSING_DIR="${TMPDIR:-/tmp}/cis-to-fleet-$$"

# ANSI color codes for user-friendly output
readonly COLOR_RED='\033[0;31m'
readonly COLOR_GREEN='\033[0;32m'
readonly COLOR_YELLOW='\033[1;33m'
readonly COLOR_BLUE='\033[0;34m'
readonly COLOR_RESET='\033[0m'

# =============================================================================
# GLOBAL SCRIPT STATE
# =============================================================================

# User-configurable options (set via command line arguments)
user_output_directory="$DEFAULT_OUTPUT_DIRECTORY"
user_cis_level="$DEFAULT_CIS_LEVEL"
user_force_overwrite=false
user_verbose_logging=false

# =============================================================================
# CLEANUP AND SIGNAL HANDLING
# =============================================================================

# Cleanup function to remove temporary files on script exit
cleanup_temp_files() {
  if [[ -d "$TEMP_PROCESSING_DIR" ]]; then
    log_debug "Cleaning up temporary directory: $TEMP_PROCESSING_DIR"
    rm -rf "$TEMP_PROCESSING_DIR"
  fi
}

# Register cleanup function to run on script exit (success or failure)
trap cleanup_temp_files EXIT

# =============================================================================
# LOGGING AND OUTPUT FUNCTIONS
# =============================================================================

# Display informational messages to the user
log_info() {
  echo -e "${COLOR_BLUE}ℹ${COLOR_RESET} $*" >&2
}

# Display success messages with checkmark
log_success() {
  echo -e "${COLOR_GREEN}✓${COLOR_RESET} $*" >&2
}

# Display warning messages with warning symbol
log_warning() {
  echo -e "${COLOR_YELLOW}⚠${COLOR_RESET} $*" >&2
}

# Display error messages with error symbol
log_error() {
  echo -e "${COLOR_RED}✗${COLOR_RESET} $*" >&2
}

# Display debug messages only when verbose logging is enabled
log_debug() {
  if [[ "$user_verbose_logging" == true ]]; then
    echo -e "${COLOR_BLUE}[DEBUG]${COLOR_RESET} $*" >&2
  fi
}

# Verify all required system dependencies are available
# Exits script with error if any required tools are missing
check_required_dependencies() {
  local missing_dependencies_list=()
  local required_tools=("curl" "jq" "yq")

  # Check each required tool for availability in PATH
  for command_name in "${required_tools[@]}"; do
    if ! command -v "$command_name" >/dev/null 2>&1; then
      missing_dependencies_list+=("$command_name")
    fi
  done

  # Report missing dependencies and provide installation guidance
  if [[ ${#missing_dependencies_list[@]} -gt 0 ]]; then
    log_error "Missing required dependencies: ${missing_dependencies_list[*]}"
    log_error "Please install them and try again."

    # Provide platform-specific installation suggestions
    if command -v brew >/dev/null 2>&1; then
      log_info "You can install them with: brew install ${missing_dependencies_list[*]}"
    elif command -v apt >/dev/null 2>&1; then
      log_info "You can install them with: sudo apt install ${missing_dependencies_list[*]}"
    elif command -v yum >/dev/null 2>&1; then
      log_info "You can install them with: sudo yum install ${missing_dependencies_list[*]}"
    fi

    exit 1
  fi
}

# Check dependencies
check_dependencies() {
  local missing_deps=()

  for cmd in curl jq yq; do
    if ! command -v "$cmd" >/dev/null 2>&1; then
      missing_deps+=("$cmd")
    fi
  done

  if [[ ${#missing_deps[@]} -gt 0 ]]; then
    log_error "Missing required dependencies: ${missing_deps[*]}"
    log_error "Please install them and try again."
    if command -v brew >/dev/null 2>&1; then
      log_info "You can install them with: brew install ${missing_deps[*]}"
    fi
    exit 1
  fi
}

# Show help
show_help() {
  cat <<EOF
$SCRIPT_NAME - Convert CIS benchmarks to Fleet-compatible YAML files

USAGE:
    $SCRIPT_NAME <command> [options] [arguments]

COMMANDS:
    list                         List available CIS benchmark platforms
    generate <platforms...>      Generate YAML files for specified platforms
    help                         Show this help message
    version                      Show version information

GENERATE ARGUMENTS:
    platforms                    Platform names, format (gitops|fleetctl), and optional 'split' modifier
                                Example: macos-15 gitops split

GENERATE OPTIONS:
    -a, --all                   Generate for all available platforms
    -l, --level <level>         CIS level to include: 1, 2, or all (default: all)
    -o, --output <dir>          Output directory for generated files (default: $DEFAULT_OUTPUT_DIRECTORY)
    -f, --force                 Overwrite existing files without prompting
    -v, --verbose               Enable verbose output
    -h, --help                  Show help for specific command

EXAMPLES:
    $SCRIPT_NAME list
    $SCRIPT_NAME generate macos-15 gitops
    $SCRIPT_NAME generate macos-15 fleetctl split
    $SCRIPT_NAME generate win-11 macos-15 gitops --level 1
    $SCRIPT_NAME generate --all gitops --output /path/to/output

OUTPUT FORMATS:
    gitops                      YAML array optimized for GitOps workflows
    fleetctl                    Individual policies ready for Fleet deployment

MODIFIERS:
    split                       Generate individual files per policy (default: combined)

EOF
}

# Display script version information
show_version() {
  echo "$SCRIPT_NAME version $SCRIPT_VERSION"
}

# Parse command line arguments
parse_args() {
  if [[ $# -eq 0 ]]; then
    show_help
    exit 1
  fi

  local command="$1"
  shift

  case "$command" in
  "list")
    parse_list_args "$@"
    ;;
  "generate")
    parse_generate_args "$@"
    ;;
  "help" | "-h" | "--help")
    show_help
    exit 0
    ;;
  "version" | "-v" | "--version")
    show_version
    exit 0
    ;;
  *)
    log_error "Unknown command: $command"
    show_help
    exit 1
    ;;
  esac
}

# Parse list command arguments
parse_list_args() {
  while [[ $# -gt 0 ]]; do
    case "$1" in
    "-h" | "--help")
      cat <<EOF
$SCRIPT_NAME list - List available CIS benchmark platforms

USAGE:
    $SCRIPT_NAME list [options]

OPTIONS:
    -v, --verbose               Enable verbose output
    -h, --help                  Show this help message

EOF
      exit 0
      ;;
    "-v" | "--verbose")
      user_verbose_logging=true
      shift
      ;;
    *)
      log_error "Unknown option for list command: $1"
      exit 1
      ;;
    esac
  done

  list_available_platforms
}

# Parse generate command arguments
parse_generate_args() {
  local platforms=()
  local format=""
  local split=false
  local all_platforms=false

  if [[ $# -eq 0 ]]; then
    log_error "Generate command requires arguments"
    show_help
    exit 1
  fi

  # Parse arguments
  while [[ $# -gt 0 ]]; do
    case "$1" in
    "-a" | "--all")
      all_platforms=true
      shift
      ;;
    "-l" | "--level")
      if [[ -z "${2:-}" ]]; then
        log_error "Option --level requires a value"
        exit 1
      fi
      user_cis_level="$2"
      if [[ "$user_cis_level" != "1" && "$user_cis_level" != "2" && "$user_cis_level" != "all" ]]; then
        log_error "Invalid level '$user_cis_level'. Must be 1, 2, or all"
        exit 1
      fi
      shift 2
      ;;
    "-o" | "--output")
      if [[ -z "${2:-}" ]]; then
        log_error "Option --output requires a value"
        exit 1
      fi
      user_output_directory="$2"
      shift 2
      ;;
    "-f" | "--force")
      user_force_overwrite=true
      shift
      ;;
    "-v" | "--verbose")
      user_verbose_logging=true
      shift
      ;;
    "-h" | "--help")
      cat <<EOF
$SCRIPT_NAME generate - Generate Fleet-compatible YAML files

USAGE:
    $SCRIPT_NAME generate [options] <platforms...>

EXAMPLES:
    $SCRIPT_NAME generate macos-15 gitops
    $SCRIPT_NAME generate macos-15 fleetctl split
    $SCRIPT_NAME generate win-11 macos-15 gitops

ARGUMENTS:
    platforms                   Platform names, format (gitops|fleetctl), and optional 'split' modifier

OPTIONS:
    -a, --all                   Generate for all available platforms
    -l, --level <level>         CIS level to include: 1, 2, or all (default: all)
    -o, --output <dir>          Output directory (default: $DEFAULT_OUTPUT_DIRECTORY)
    -f, --force                 Overwrite existing files without prompting
    -v, --verbose               Enable verbose output
    -h, --help                  Show this help message

EOF
      exit 0
      ;;
    "gitops" | "fleetctl")
      if [[ -n "$format" ]]; then
        log_error "Format already specified: $format"
        exit 1
      fi
      format="$1"
      shift
      ;;
    "split")
      split=true
      shift
      ;;
    -*)
      log_error "Unknown option: $1"
      exit 1
      ;;
    *)
      platforms+=("$1")
      shift
      ;;
    esac
  done

  # Validate arguments
  if [[ "$all_platforms" == true ]]; then
    if [[ ${#platforms[@]} -gt 0 ]]; then
      log_error "Cannot specify both --all and individual platforms"
      exit 1
    fi
  elif [[ ${#platforms[@]} -eq 0 ]]; then
    log_error "No platforms specified"
    exit 1
  fi

  if [[ -z "$format" ]]; then
    log_error "No format specified. Use 'gitops' or 'fleetctl'"
    exit 1
  fi

  # Generate files
  if [[ "$all_platforms" == true ]]; then
    generate_policy_files "$format" "$split" "$all_platforms"
  else
    generate_policy_files "$format" "$split" "$all_platforms" "${platforms[@]}"
  fi
}

# =============================================================================
# PLATFORM DISCOVERY AND DATA RETRIEVAL FUNCTIONS
# =============================================================================

# Discover and display all available CIS benchmark platforms from Fleet's GitHub repository
# Queries the GitHub API to retrieve directory listing and formats output for user
list_available_platforms() {
  log_info "Fetching available CIS benchmark platforms from Fleet repository..."

  # Create temporary directory for API response caching
  mkdir -p "$TEMP_PROCESSING_DIR"

  # Download platform directory listing from GitHub API
  local github_api_response="$TEMP_PROCESSING_DIR/platforms.json"
  if ! curl -s -f "$FLEET_GITHUB_API_BASE" >"$github_api_response"; then
    log_error "Failed to fetch platform list from GitHub API"
    log_error "Please check your internet connection and try again"
    exit 1
  fi

  # Extract platform directory names using jq JSON processor
  local discovered_platforms
  discovered_platforms=$(jq -r '.[] | select(.type == "dir") | .name' "$github_api_response" 2>/dev/null)

  # Validate that we successfully discovered platforms
  if [[ -z "$discovered_platforms" ]]; then
    log_error "No platforms found or failed to parse API response"
    log_error "The GitHub API response may be in an unexpected format"
    exit 1
  fi

  # Display formatted platform list to user
  echo "Available CIS benchmark platforms:"
  echo "$discovered_platforms" | sort | sed 's/^/  /'

  log_debug "Successfully discovered $(echo "$discovered_platforms" | wc -l) platforms"
}

# Retrieve a programmatic list of all available platforms for batch processing
# Returns sorted list of platform names, one per line, suitable for array processing
get_all_available_platforms() {
  # Ensure temporary directory exists for API response storage
  mkdir -p "$TEMP_PROCESSING_DIR"

  # Cache API response for potential reuse within same script execution
  local github_api_response="$TEMP_PROCESSING_DIR/all_platforms.json"
  if ! curl -s -f "$FLEET_GITHUB_API_BASE" >"$github_api_response"; then
    log_error "Failed to fetch platform list from GitHub API"
    return 1
  fi

  # Extract and sort platform names for consistent processing order
  jq -r '.[] | select(.type == "dir") | .name' "$github_api_response" 2>/dev/null | sort
}

# Download CIS benchmark policy YAML file for a specific platform
# Creates cached copy in temporary directory and returns path to downloaded file
fetch_platform_policy_yaml() {
  local target_platform="$1"
  local cached_yaml_file="$TEMP_PROCESSING_DIR/${target_platform}.yml"

  log_debug "Fetching CIS policy YAML for platform: $target_platform"

  # Construct GitHub raw content URL for platform's policy file
  local raw_content_url="$FLEET_GITHUB_RAW_BASE/$target_platform/cis-policy-queries.yml"

  # Download YAML content with error handling
  if ! curl -s -f "$raw_content_url" >"$cached_yaml_file"; then
    log_error "Failed to fetch YAML for platform: $target_platform"
    log_error "Platform may not exist or policy file may be missing"
    return 1
  fi

  log_debug "Successfully cached YAML file: $cached_yaml_file"
  echo "$cached_yaml_file"
}

# Parse YAML policy file and extract policy data into normalized JSON format
# Handles multiple YAML document formats: Kubernetes-style, arrays, and simple objects
parse_policy_yaml_to_json() {
  local source_yaml_file="$1"
  local parsed_policies_json="$TEMP_PROCESSING_DIR/parsed_policies_$(basename "$source_yaml_file" .yml).json"

  log_debug "Parsing YAML policies from: $source_yaml_file"

  # Complex jq pipeline to handle various YAML document structures:
  # 1. Kubernetes-style documents with apiVersion/kind/spec
  # 2. Simple YAML arrays of policies
  # 3. Individual policy objects
  # The pipeline normalizes all formats to a consistent JSON structure
  if ! yq eval -o=json '.' "$source_yaml_file" | jq -s '[
        .[] | 
        if type == "object" and has("kind") and .kind == "policy" and has("spec") then
            # Handle Kubernetes-style policy documents
            .spec | {
                name: .name,
                platform: .platform,
                description: .description,
                resolution: .resolution,
                query: .query,
                tags: .tags
            }
        elif type == "array" then
            # Handle YAML arrays containing multiple policies
            .[] | select(type == "object" and (.name != null or .query != null)) | {
                name: .name,
                platform: .platform,
                description: .description,
                resolution: .resolution,
                query: .query,
                tags: .tags
            }
        elif type == "object" and (.name != null or .query != null) then
            # Handle simple policy objects
            {
                name: .name,
                platform: .platform,
                description: .description,
                resolution: .resolution,
                query: .query,
                tags: .tags
            }
        else
            empty
        end
    ] | map(select(. != null))' >"$parsed_policies_json" 2>/dev/null; then
    log_error "Failed to parse YAML policies from: $source_yaml_file"
    log_error "The YAML file may be malformed or in an unexpected format"
    return 1
  fi

  # Validate that we extracted at least one policy
  local policy_count
  policy_count=$(jq length "$parsed_policies_json" 2>/dev/null || echo "0")
  log_debug "Successfully parsed $policy_count policies from YAML"

  echo "$parsed_policies_json"
}

# Parse YAML and extract policy data
parse_yaml_policies() {
  local yaml_file="$1"
  local policies_json="$TEMP_DIR/policies_$(basename "$yaml_file" .yml).json"

  log_debug "Parsing YAML policies from: $yaml_file"

  # Convert YAML to JSON and extract policies from Kubernetes-style documents
  if ! yq eval -o=json '.' "$yaml_file" | jq -s '[
        .[] | 
        if type == "object" and has("kind") and .kind == "policy" and has("spec") then
            .spec | {
                name: .name,
                platform: .platform,
                description: .description,
                resolution: .resolution,
                query: .query,
                tags: .tags
            }
        elif type == "array" then
            .[] | select(type == "object" and (.name != null or .query != null)) | {
                name: .name,
                platform: .platform,
                description: .description,
                resolution: .resolution,
                query: .query,
                tags: .tags
            }
        elif type == "object" and (.name != null or .query != null) then
            {
                name: .name,
                platform: .platform,
                description: .description,
                resolution: .resolution,
                query: .query,
                tags: .tags
            }
        else
            empty
        end
    ] | map(select(. != null))' >"$policies_json" 2>/dev/null; then
    log_error "Failed to parse YAML policies"
    return 1
  fi

  echo "$policies_json"
}

# Filter parsed policies based on specified CIS compliance level
# Supports Level 1 (essential), Level 2 (advanced), or all policies
filter_policies_by_cis_level() {
  local source_policies_json="$1"
  local target_cis_level="$2"
  local filtered_policies_json="$TEMP_PROCESSING_DIR/filtered_$(basename "$source_policies_json")"

  # Handle 'all' level by simply copying all policies
  if [[ "$target_cis_level" == "all" ]]; then
    cp "$source_policies_json" "$filtered_policies_json"
    log_debug "Keeping all policies (no CIS level filtering applied)"
  else
    # Define CIS level tags to search for in policy metadata
    local primary_level_tag="CIS_Level$target_cis_level"
    local alternate_level_tag="CIS_LEVEL$target_cis_level"

    log_debug "Filtering policies for CIS level: $target_cis_level"

    # Use jq to filter policies based on tags field containing level indicators
    # Handles both "CIS_Level1" and "CIS_LEVEL1" tag formats for compatibility
    jq --arg level_tag "$primary_level_tag" --arg level_tag_alt "$alternate_level_tag" '[
            .[] | select(
                .tags != null and 
                (.tags | split(",") | map(gsub("^\\s+|\\s+$"; "")) | 
                 contains([$level_tag]) or contains([$level_tag_alt]))
            )
        ]' "$source_policies_json" >"$filtered_policies_json"

    # Log filtering results for debugging
    local filtered_count
    filtered_count=$(jq length "$filtered_policies_json" 2>/dev/null || echo "0")
    log_debug "Filtered to $filtered_count policies at CIS level $target_cis_level"
  fi

  echo "$filtered_policies_json"
}

# Clean and normalize policy data by removing unwanted fields and null values
# Ensures consistent output format containing only essential policy information
sanitize_policy_data() {
  local source_policies_json="$1"
  local sanitized_policies_json="$TEMP_PROCESSING_DIR/sanitized_$(basename "$source_policies_json")"

  log_debug "Sanitizing and normalizing policy data"

  # Extract only the essential fields needed for Fleet policies
  # Remove null values and empty strings to ensure clean output
  jq '[
        .[] | {
            name: .name,
            platform: .platform,  
            description: .description,
            resolution: .resolution,
            query: .query
        } | with_entries(select(.value != null and .value != ""))
    ]' "$source_policies_json" >"$sanitized_policies_json"

  # Validate sanitization results
  local sanitized_count
  sanitized_count=$(jq length "$sanitized_policies_json" 2>/dev/null || echo "0")
  log_debug "Sanitized $sanitized_count policies for output"

  echo "$sanitized_policies_json"
}

# Generate GitOps-optimized YAML format with proper multiline field formatting
# Creates YAML array structure suitable for GitOps workflows and Fleet deployment
generate_gitops_format_yaml() {
  local source_policies_json="$1"
  local target_output_file="$2"

  log_debug "Generating GitOps YAML format with literal block scalars"

  # Generate YAML array with proper field ordering and multiline handling
  # Uses literal block scalars (|) for multiline content to preserve formatting
  {
    local total_policy_count
    total_policy_count=$(jq length "$source_policies_json")

    log_debug "Processing $total_policy_count policies for GitOps format"

    # Process each policy individually to maintain proper YAML formatting
    for ((policy_index = 0; policy_index < total_policy_count; policy_index++)); do
      local current_policy
      current_policy=$(jq ".[$policy_index]" "$source_policies_json")

      # Extract policy fields with null fallbacks
      local policy_name policy_platform policy_description policy_resolution policy_query
      policy_name=$(echo "$current_policy" | jq -r '.name // ""')
      policy_platform=$(echo "$current_policy" | jq -r '.platform // ""')
      policy_description=$(echo "$current_policy" | jq -r '.description // ""')
      policy_resolution=$(echo "$current_policy" | jq -r '.resolution // ""')
      policy_query=$(echo "$current_policy" | jq -r '.query // ""')

      # Output YAML array item with proper field ordering
      echo "- name: $policy_name"
      [[ -n "$policy_platform" ]] && echo "  platform: $policy_platform"

      # Handle multiline description with literal block scalar
      if [[ -n "$policy_description" ]]; then
        if [[ "$policy_description" =~ $'\n' ]]; then
          echo "  description: |"
          echo "$policy_description" | sed 's/^/    /'
        else
          echo "  description: $policy_description"
        fi
      fi

      # Handle multiline resolution with literal block scalar
      if [[ -n "$policy_resolution" ]]; then
        if [[ "$policy_resolution" =~ $'\n' ]]; then
          echo "  resolution: |"
          echo "$policy_resolution" | sed 's/^/    /'
        else
          echo "  resolution: $policy_resolution"
        fi
      fi

      # Handle multiline query with literal block scalar
      if [[ -n "$policy_query" ]]; then
        if [[ "$policy_query" =~ $'\n' ]]; then
          echo "  query: |"
          echo "$policy_query" | sed 's/^/    /'
        else
          echo "  query: $policy_query"
        fi
      fi

    done
  } >"$target_output_file"

  log_debug "GitOps YAML generated successfully: $target_output_file"
}

# Generate Fleet-compatible YAML with Kubernetes-style document structure
# Creates multi-document YAML file ready for 'fleetctl apply' deployment
generate_fleetctl_format_yaml() {
  local source_policies_json="$1"
  local target_output_file="$2"

  log_debug "Generating Fleetctl YAML format with Kubernetes document structure"

  # Create multi-document YAML with proper Kubernetes structure:
  # - apiVersion: v1
  # - kind: policy
  # - spec: (containing policy fields)
  # - Document separators (---) between policies
  {
    local total_policy_count
    total_policy_count=$(jq length "$source_policies_json")

    log_debug "Processing $total_policy_count policies for Fleetctl format"

    # Generate each policy as a separate Kubernetes document
    for ((policy_index = 0; policy_index < total_policy_count; policy_index++)); do
      local current_policy
      current_policy=$(jq ".[$policy_index]" "$source_policies_json")

      # Extract policy fields with safe null handling
      local policy_name policy_platform policy_description policy_resolution policy_query
      policy_name=$(echo "$current_policy" | jq -r '.name // ""')
      policy_platform=$(echo "$current_policy" | jq -r '.platform // ""')
      policy_description=$(echo "$current_policy" | jq -r '.description // ""')
      policy_resolution=$(echo "$current_policy" | jq -r '.resolution // ""')
      policy_query=$(echo "$current_policy" | jq -r '.query // ""')

      # Add YAML document separator between policies (skip for first policy)
      [[ $policy_index -gt 0 ]] && echo "---"

      # Generate Kubernetes-style policy document header
      echo "apiVersion: v1"
      echo "kind: policy"
      echo "spec:"
      echo "  name: $policy_name"

      # Add SQL query with proper multiline formatting
      if [[ -n "$policy_query" ]]; then
        if [[ "$policy_query" =~ $'\n' ]]; then
          echo "  query: |"
          echo "$policy_query" | sed 's/^/    /'
        else
          echo "  query: $policy_query"
        fi
      fi

      # Set default criticality level for CIS policies
      echo "  critical: false"

      # Add description with multiline support
      if [[ -n "$policy_description" ]]; then
        if [[ "$policy_description" =~ $'\n' ]]; then
          echo "  description: |"
          echo "$policy_description" | sed 's/^/    /'
        else
          echo "  description: $policy_description"
        fi
      fi

      # Add resolution steps with multiline support
      if [[ -n "$policy_resolution" ]]; then
        if [[ "$policy_resolution" =~ $'\n' ]]; then
          echo "  resolution: |"
          echo "$policy_resolution" | sed 's/^/    /'
        else
          echo "  resolution: $policy_resolution"
        fi
      fi

      # Add platform specification if available
      [[ -n "$policy_platform" ]] && echo "  platform: $policy_platform"

    done
  } >"$target_output_file"

  log_debug "Fleetctl YAML generated successfully: $target_output_file"
}

# Generate individual policy files (simplified approach)
generate_split_files() {
  local policies_json="$1"
  local format="$2"
  local output_dir="$3"
  local platform="$4"

  log_debug "Generating individual policy files"

  mkdir -p "$output_dir"

  local policy_count
  policy_count=$(jq length "$policies_json")

  for ((i = 0; i < policy_count; i++)); do
    local policy
    policy=$(jq ".[$i]" "$policies_json")

    local policy_name
    policy_name=$(echo "$policy" | jq -r '.name // "unknown_policy"')

    # Create safe filename
    local safe_name
    safe_name=$(echo "$policy_name" | sed 's/[^a-zA-Z0-9._-]/_/g' | sed 's/__*/_/g' | sed 's/^_\|_$//g')

    if [[ -z "$safe_name" ]]; then
      safe_name="unknown_policy_$i"
    fi

    local output_file="$output_dir/${safe_name}.yml"

    if [[ "$format" == "gitops" ]]; then
      # GitOps format: wrap in array
      echo "$policy" | jq '[{
                name: .name,
                platform: .platform,
                description: .description,
                resolution: .resolution,
                query: .query
            } | with_entries(select(.value != null))]' | yq eval -P - >"$output_file"
    else
      # Fleetctl format: Kubernetes-style single document
      local name platform description resolution query
      name=$(echo "$policy" | jq -r '.name // ""')
      platform=$(echo "$policy" | jq -r '.platform // ""')
      description=$(echo "$policy" | jq -r '.description // ""')
      resolution=$(echo "$policy" | jq -r '.resolution // ""')
      query=$(echo "$policy" | jq -r '.query // ""')

      {
        echo "apiVersion: v1"
        echo "kind: policy"
        echo "spec:"
        echo "  name: $name"

        if [[ -n "$query" ]]; then
          if [[ "$query" =~ $'\n' ]]; then
            echo "  query: |"
            echo "$query" | sed 's/^/    /'
          else
            echo "  query: $query"
          fi
        fi

        echo "  critical: false"

        if [[ -n "$description" ]]; then
          if [[ "$description" =~ $'\n' ]]; then
            echo "  description: |"
            echo "$description" | sed 's/^/    /'
          else
            echo "  description: $description"
          fi
        fi

        if [[ -n "$resolution" ]]; then
          if [[ "$resolution" =~ $'\n' ]]; then
            echo "  resolution: |"
            echo "$resolution" | sed 's/^/    /'
          else
            echo "  resolution: $resolution"
          fi
        fi

        [[ -n "$platform" ]] && echo "  platform: $platform"
      } >"$output_file"
    fi
  done

  echo "$policy_count"
}

# Main orchestration function for generating Fleet policy files from CIS benchmarks
# Coordinates the entire pipeline: fetch -> parse -> filter -> sanitize -> generate
generate_policy_files() {
  local output_format="$1"
  local enable_split_files="$2"
  local process_all_platforms="$3"
  shift 3
  local specified_platforms=("$@")

  # Ensure required directories exist for processing and output
  mkdir -p "$TEMP_PROCESSING_DIR" "$user_output_directory"

  # Determine which platforms to process based on user selection
  local platforms_to_process=()
  if [[ "$process_all_platforms" == true ]]; then
    log_info "Discovering all available platforms from Fleet repository..."
    local discovered_platforms_list
    discovered_platforms_list=$(get_all_available_platforms)
    if [[ -z "$discovered_platforms_list" ]]; then
      log_error "No platforms discovered from GitHub API"
      exit 1
    fi
    # Convert newline-separated list to bash array for processing
    while IFS= read -r discovered_platform; do
      [[ -n "$discovered_platform" ]] && platforms_to_process+=("$discovered_platform")
    done <<<"$discovered_platforms_list"
  else
    platforms_to_process=("${specified_platforms[@]}")
  fi

  log_info "Processing ${#platforms_to_process[@]} platform(s) with $output_format format..."

  # Process each platform through the complete conversion pipeline
  for current_platform in "${platforms_to_process[@]}"; do
    log_info "Processing platform: $current_platform"

    # Step 1: Fetch raw YAML policy data from GitHub
    local platform_yaml_file
    if ! platform_yaml_file=$(fetch_platform_policy_yaml "$current_platform"); then
      log_error "Skipping $current_platform due to download failure"
      continue
    fi

    # Step 2: Parse YAML into normalized JSON structure
    local parsed_policies_json
    if ! parsed_policies_json=$(parse_policy_yaml_to_json "$platform_yaml_file"); then
      log_error "Skipping $current_platform due to YAML parsing failure"
      continue
    fi

    # Step 3: Validate we have policies to work with
    local initial_policy_count
    initial_policy_count=$(jq length "$parsed_policies_json" 2>/dev/null || echo "0")
    if [[ "$initial_policy_count" -eq 0 ]]; then
      log_warning "No policies found for $current_platform"
      continue
    fi
    log_debug "Found $initial_policy_count policies for $current_platform"

    # Step 4: Filter policies by specified CIS compliance level
    local level_filtered_json
    if ! level_filtered_json=$(filter_policies_by_cis_level "$parsed_policies_json" "$user_cis_level"); then
      log_error "Skipping $current_platform due to level filtering failure"
      continue
    fi

    # Step 5: Verify we have policies remaining after filtering
    local filtered_policy_count
    filtered_policy_count=$(jq length "$level_filtered_json" 2>/dev/null || echo "0")
    if [[ "$filtered_policy_count" -eq 0 ]]; then
      log_warning "No policies found for $current_platform at CIS level $user_cis_level"
      continue
    fi
    log_debug "$filtered_policy_count policies remain after CIS level filtering"

    # Step 6: Sanitize policy data for clean output
    local sanitized_policies_json
    if ! sanitized_policies_json=$(sanitize_policy_data "$level_filtered_json"); then
      log_error "Skipping $current_platform due to data sanitization failure"
      continue
    fi

    # Step 7: Generate output files in requested format
    if [[ "$enable_split_files" == true ]]; then
      # Generate individual files (one per policy)
      local individual_files_directory="$user_output_directory/${current_platform}-${output_format}"
      local generated_file_count
      if generated_file_count=$(generate_split_files "$sanitized_policies_json" "$output_format" "$individual_files_directory" "$current_platform"); then
        log_success "Generated $generated_file_count individual $output_format files in: $individual_files_directory"
      else
        log_error "Failed to generate individual files for $current_platform"
      fi
    else
      # Generate combined file (all policies in one file)
      local platform_name_clean
      platform_name_clean=$(echo "$current_platform" | sed 's/-//g')
      local combined_output_file="$user_output_directory/cis-benchmark-${platform_name_clean}-${output_format}.yml"

      # Handle file overwrite protection
      if [[ -f "$combined_output_file" && "$user_force_overwrite" != true ]]; then
        log_warning "File exists: $combined_output_file (use --force to overwrite)"
        continue
      fi

      # Generate format-specific YAML output
      if [[ "$output_format" == "gitops" ]]; then
        generate_gitops_format_yaml "$sanitized_policies_json" "$combined_output_file"
      else
        generate_fleetctl_format_yaml "$sanitized_policies_json" "$combined_output_file"
      fi

      log_success "Generated $output_format file: $combined_output_file"
    fi
  done
}

# Main script execution
main() {
  check_required_dependencies
  parse_args "$@"
}

# Only run main if script is executed directly (not sourced)
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
  main "$@"
fi

