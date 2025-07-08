Below is a complete, developer-ready specification consolidating every decision we made in the Q-and-A.  Hand this to any competent Python dev and they can get straight to work.

⸻

1 – Project Overview

Create a cross-platform Python 3.9+ command-line tool named fleet-cis-tui that:
	1.	Discovers all CIS benchmark folders under
https://github.com/fleetdm/fleet/blob/main/ee/cis/
	2.	Lets users multi-select one or more platforms via a Textual TUI
	3.	Transforms each platform’s cis-policy-queries.yml into Fleet-compatible YAML
	4.	Writes each result to ./output/cis-benchmark-<platform>.yaml
	•	<platform> is the folder name with hyphens stripped (e.g., macos-15 → macos15)
	5.	Also provides a non-interactive CLI (list, generate) for automation

⸻

2 – Functional Requirements

#	Requirement
F-1	Detect all folders directly under ee/cis/ (e.g., macos-14, windows-11).
F-2	Display them in a Textual multi-select checklist with “Select All”.
F-3	On confirmation, fetch each selected folder’s raw YAML:https://raw.githubusercontent.com/fleetdm/fleet/refs/heads/main/ee/cis/<folder>/cis-policy-queries.yml
F-4	For every item in that YAML, emit exactly the five keys below in this order:name, platform, description, resolution, queryDelete any other keys (platforms, purpose, tags, contributors, …).
F-5	Output format must match the sample produced by the original Bash script: an array of objects with two-space indentation, `
F-6	Save each file to ./output/ (create if absent) with filename pattern cis-benchmark-<platform>.yaml.
F-7	If a file exists, prompt before overwrite in TUI; in CLI require --force to overwrite silently.
F-8	Provide non-interactive CLI: • fleet-cis-tui list → print available platform keys• fleet-cis-tui generate <keys…> (or --all) with optional -o/--output DIR and --force.
F-9	Support Windows 10/11, macOS 12+ (Intel & Apple Silicon), and mainstream Linux distros.


⸻

3 – Non-Functional Requirements
	•	Performance: Fetch directory & YAML lazily; no caching required for MVP.
	•	Usability: One-line install via pipx install fleet-cis-tui.
	•	Portability: Pure-Python + widely-available C libs only.
	•	Maintainability: Clean separation of concerns; 100 % type-hinted code.
	•	Extensibility: Architecture should let us add cached directory listings or PyInstaller binaries later with minimal refactor.

⸻

4 – Technology Stack & Key Libraries

Concern	Choice	Notes
Language	Python 3.9+	Floor decided for widest support.
TUI	Textual	Modern Rich-based, great UX.
CLI parsing	Typer (or Click 8)	Typer gives automatic completers & help; dev choice.
HTTP	requests	Simple; already ubiquitous.
YAML parse / emit	ruamel.yaml (≥ 0.18)	Preserves block scalars nicely and precise ordering; safer than PyYAML for round-trips.
Packaging	setuptools + pyproject.toml; publish to PyPI.	
Lint / QA	ruff, mypy, pytest, pre-commit.	


⸻

5 – High-Level Architecture

┌──────────────┐
│  entrypoint  │  fleet_cis_tui.__main__  (Typer)
└──────┬───────┘
       │
       ├─ CLI subcommands
       │     • list
       │     • generate
       │
       └─ "tui" subcommand (default)
             │
             ▼
      TextualApp (screens/views)
             │
             ├─ GitHubClient  ←── network layer
             ├─ Transformator ←── parsing & field filter
             └─ FileWriter    ←── output dir mgmt, confirm prompts

	•	GitHubClient uses GitHub’s REST API (unauthenticated; 60 req/hr) to list ee/cis/ dir and fetch raw YAML blobs.
	•	Transformator loads YAML, iterates each item, drops disallowed fields, re-serializes into ordered output.
	•	FileWriter centralises filename logic, “output/” creation, and overwrite decisions (prompt or --force).

⸻

6 – Data Handling Details

Step	Detail
Directory listing	GET https://api.github.com/repos/fleetdm/fleet/contents/ee/cis returns JSON (array of objects). Accept only type=="dir".
Raw YAML fetch	Use .download_url from listing OR construct raw.githubusercontent URL shown above.
YAML parsing	ruamel.yaml.YAML(typ="safe", pure=True). Preserve multiline literals (`
Transformation	For each list element: build an OrderedDict with only required keys in said order.
Output emit	Same YAML engine with explicit_start=False, explicit_end=False, default_flow_style=False. Prepend a comment block at file top (optional) indicating generation time & tool version.
File path	output_dir / f"cis-benchmark-{foldername.replace('-', '')}.yaml"
Overwrite prompt	Textual modal in TUI; CLI raises FileExistsError unless --force.


⸻

7 – Error Handling Strategy

Scenario	User-visible Response
No internet / GitHub 4xx/5xx	Clear message: “Couldn’t reach GitHub — check connection or rate limits.” Exit non-zero.
Folder’s YAML 404	Warn and skip that platform; continue others.
YAML parse error	Show short path + line, skip platform, continue.
Output dir unwritable	Abort that file, print path + OS error.
Ctrl-C	Cleanly shut down, partial files stay intact.

All fatal CLI errors return non-zero exit codes for easy scripting.

⸻

8 – Packaging & Distribution
	•	PyPI: project name fleet-cis-tui; semantic versioning.
	•	pipx install path: pipx install fleet-cis-tui
	•	Entry points:

[project.scripts]
fleet-cis-tui = "fleet_cis_tui.__main__:app"


	•	Later versions can add PyInstaller workflows; code should avoid __file__ assumptions.

⸻

9 – Testing Plan

9.1 Unit Tests (pytest)

Module	What to test
transform.py	• Field-reduction logic• Hyphen stripping for filenames• Correct YAML dump identical to golden sample (tests/fixtures/macos15_expected.yaml).
github.py	Mock HTTP, ensure correct URL composition & error propagation.
cli.py	Typer commands produce expected exit codes and side-effects (via CliRunner).

9.2 Integration Tests
	•	Spin up pytest-httpserver with canned GitHub API JSON + raw YAML; run fleet-cis-tui generate macos15 --output tmpdir and diff result against fixture.

9.3 Manual Cross-Platform
	•	macOS 15, Windows 11, Ubuntu 22.04—verify TUI renders, arrow-key selection, file prompts, and CLI path quoting.

9.4 CI Pipeline
	•	GitHub Actions matrix: 3.9, 3.10, 3.11 on ubuntu-latest, macos-latest, windows-latest.
	•	Steps: ruff, mypy --strict, pytest -q, packaging smoke test (pipx run).

⸻

10 – Future Enhancements (Backlog)
	1.	Cached directory JSON with expiry timer or manual “Refresh list” action.
	2.	PyInstaller single-binary releases (sign macOS ARM build for Gatekeeper).
	3.	Support custom repo/branch via env-vars or flags (for forks).
	4.	Add progress bars (Rich) during downloads.
	5.	Output tar/zip archive of all generated YAMLs (--archive).

⸻

Deliverables Checklist
	•	pyproject.toml with pin textual>=0.59, ruamel.yaml>=0.18, typer[all]>=0.12, requests>=2.31.
	•	Source modules: __main__.py, github.py, transform.py, writer.py, tui/.
	•	README.md with quick-start (pipx install, usage examples).
	•	Unit + integration tests under tests/.
	•	GitHub Actions workflow file.
	•	CHANGELOG.md seeded with v0.1.0 features.

⸻

