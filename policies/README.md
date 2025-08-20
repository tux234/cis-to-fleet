# Generated CIS Fleet Policies

This directory contains automatically generated Fleet-compatible policies from CIS benchmarks.

## Generation Details

- **Generated**: $(date -u '+%Y-%m-%d %H:%M:%S UTC')
- **Source**: Fleet CIS benchmarks repository  
- **Generator**: cis-to-fleet.sh v2.0.0
- **Trigger**: push

## Directory Structure

```
policies/
├── README.md                           # This file
├── GitOps/                             # GitOps format policies
│   ├── cis-benchmark-*-gitops.yml     # Combined GitOps files
│   └── individual-policies/            # Individual GitOps policy files
│       ├── macos-15-gitops/           # Per-platform policy files
│       └── win-11-gitops/
└── FleetCtl/                           # FleetCtl format policies  
    ├── cis-benchmark-*-fleetctl.yml   # Combined FleetCtl files
    └── individual-policies/            # Individual FleetCtl policy files
        ├── macos-15-fleetctl/         # Per-platform policy files
        └── win-11-fleetctl/
```

## Format Descriptions

### GitOps Format
- **Purpose**: Optimized for GitOps workflows and Fleet's separate file configuration
- **Structure**: YAML arrays with proper field ordering for readability
- **Combined Files**: All policies for a platform in a single file
- **Individual Files**: One policy per file, each wrapped in an array

### FleetCtl Format  
- **Purpose**: Ready for direct deployment with Fleet
- **Structure**: Kubernetes-style YAML documents with proper Fleet schema
- **Combined Files**: Multi-document YAML files with --- separators
- **Individual Files**: Single Kubernetes-style policy documents

## Usage Examples

### Using Combined Files
```bash
# GitOps format - reference from your Fleet configuration
# Point Fleet to: policies/GitOps/cis-benchmark-macos15-gitops.yml

# FleetCtl format - can be applied directly via Fleet API/CLI if available
# Apply to Fleet: policies/FleetCtl/cis-benchmark-macos15-fleetctl.yml
```

### Using Individual Files
```bash
# GitOps format - reference individual policies
# Point Fleet to: policies/GitOps/individual-policies/macos-15-gitops/

# FleetCtl format - apply individual policies if using Fleet API
# Apply individual files from: policies/FleetCtl/individual-policies/macos-15-fleetctl/
```

---
*Generated automatically by GitHub Actions*
