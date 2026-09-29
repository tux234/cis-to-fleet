# CIS Benchmark Policies for Fleet

Fleet policies generated from the CIS benchmark queries that Fleet maintains in [`fleetdm/fleet/ee/cis`](https://github.com/fleetdm/fleet/tree/main/ee/cis), converted by [`cis-to-fleet.sh`](../cis-to-fleet.sh) into two formats: one for Fleet GitOps and one for `fleetctl apply`.

> **Don't edit these files by hand.** The [Generate CIS Policies](../.github/workflows/generate-policies.yml) workflow regenerates everything here and overwrites manual changes.

## Platforms

| Platform | Policies | GitOps | fleetctl |
|----------|---------:|--------|----------|
| `macos-13` | 111 | [combined](GitOps/cis-benchmark-macos13-gitops.yml) · [individual](GitOps/individual-policies/macos-13-gitops/) | [combined](FleetCtl/cis-benchmark-macos13-fleetctl.yml) · [individual](FleetCtl/individual-policies/macos-13-fleetctl/) |
| `macos-14` | 105 | [combined](GitOps/cis-benchmark-macos14-gitops.yml) · [individual](GitOps/individual-policies/macos-14-gitops/) | [combined](FleetCtl/cis-benchmark-macos14-fleetctl.yml) · [individual](FleetCtl/individual-policies/macos-14-fleetctl/) |
| `macos-15` | 108 | [combined](GitOps/cis-benchmark-macos15-gitops.yml) · [individual](GitOps/individual-policies/macos-15-gitops/) | [combined](FleetCtl/cis-benchmark-macos15-fleetctl.yml) · [individual](FleetCtl/individual-policies/macos-15-fleetctl/) |
| `macos-26` | 90 | [combined](GitOps/cis-benchmark-macos26-gitops.yml) · [individual](GitOps/individual-policies/macos-26-gitops/) | [combined](FleetCtl/cis-benchmark-macos26-fleetctl.yml) · [individual](FleetCtl/individual-policies/macos-26-fleetctl/) |
| `win-10` | 502 | [combined](GitOps/cis-benchmark-win10-gitops.yml) · [individual](GitOps/individual-policies/win-10-gitops/) | [combined](FleetCtl/cis-benchmark-win10-fleetctl.yml) · [individual](FleetCtl/individual-policies/win-10-fleetctl/) |
| `win-11` | 572 | [combined](GitOps/cis-benchmark-win11-gitops.yml) · [individual](GitOps/individual-policies/win-11-gitops/) | [combined](FleetCtl/cis-benchmark-win11-fleetctl.yml) · [individual](FleetCtl/individual-policies/win-11-fleetctl/) |
| `win-11-intune` | 457 | [combined](GitOps/cis-benchmark-win11intune-gitops.yml) · [individual](GitOps/individual-policies/win-11-intune-gitops/) | [combined](FleetCtl/cis-benchmark-win11intune-fleetctl.yml) · [individual](FleetCtl/individual-policies/win-11-intune-fleetctl/) |

`win-10` and `win-11` check Group Policy and registry settings. `win-11-intune` is the CIS Intune benchmark for Windows 11: its settings are deployed with MDM configuration profiles (Settings Catalog), and most of its checks read the applied MDM policy through Fleet's [`mdm_bridge`](https://fleetdm.com/tables/mdm_bridge) table, so those hosts need to be MDM-enrolled.

## Formats

Every platform is available in both formats, as one combined file and as one file per policy.

| | GitOps | fleetctl |
|---|---|---|
| **Use with** | `fleetctl gitops` (policies kept in your GitOps repo) | `fleetctl apply -f` |
| **Shape** | YAML list of policies | `apiVersion: v1` / `kind: policy` documents |
| **Combined** | `GitOps/cis-benchmark-<platform>-gitops.yml` | `FleetCtl/cis-benchmark-<platform>-fleetctl.yml`, documents separated by `---` |
| **Individual** | `GitOps/individual-policies/<platform>-gitops/*.yml`, each a one-item list | `FleetCtl/individual-policies/<platform>-fleetctl/*.yml`, one document each |

Each policy has `name`, `platform`, `description`, `resolution`, and `query`; fleetctl documents also set `critical: false`. Combined filenames drop the hyphens from the platform (`macos-15` → `macos15`), and individual filenames are the policy name with other characters replaced by `_`.

## Before you deploy

- **Every CIS level is included.** The upstream files tag each policy Level 1 or Level 2 (`win-11-intune` also has a BitLocker profile, `BL`), but the tags aren't carried into these files. To generate a single level, run the script yourself, for example `./cis-to-fleet.sh generate macos-15 gitops --level 1`.
- **Some policies are organization decisions.** Policies named "Based on organization's policy" come in mutually exclusive pairs (Siri, Universal Control, and iCloud Drive settings enabled vs. disabled, for example), so hosts always fail one policy of each pair. Deploy only the one that matches your policy; individual files make that easy.
- **Name suffixes are requirements.** `(MDM Required)` checks a setting delivered by an MDM configuration profile, `(Fleetd Required)` uses a table that only fleetd provides, and `(FDA Required)` needs Full Disk Access to read the files it checks.

## Using the GitOps files

Copy the files you want into your GitOps repo (for example under `lib/cis/`) and reference them from `default.yml` or `fleets/<fleet-name>.yml`. Paths are relative to the file that references them.

```yaml
policies:
  # A whole benchmark
  - path: ../lib/cis/cis-benchmark-macos15-gitops.yml
  # Or hand-picked policies
  - path: ../lib/cis/macos-15-gitops/CIS_-_Ensure_Gatekeeper_Is_Enabled.yml
  # Or a folder of them
  - paths: ../lib/cis/macos-15-gitops/*.yml
```

## Using the fleetctl files

```bash
# A whole benchmark
fleetctl apply -f policies/FleetCtl/cis-benchmark-macos15-fleetctl.yml

# One policy
fleetctl apply -f policies/FleetCtl/individual-policies/macos-15-fleetctl/CIS_-_Ensure_Gatekeeper_Is_Enabled.yml
```

These are applied as global policies. To target a fleet, add `fleet: <fleet-name>` to each document's `spec` (`team:` on older fleetctl versions). If you manage Fleet with GitOps, use the GitOps files instead so the policies live in your repo.

## How these files are updated

The workflow runs nightly at 02:00 UTC, on manual dispatch, and when the generator changes on `main`. It regenerates every platform Fleet publishes, checks that every file is valid YAML, and opens a pull request from `automated-policy-updates` only when something changed. Policies that Fleet removes from a benchmark are removed here too.
