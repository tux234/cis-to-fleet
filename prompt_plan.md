Below is a three-pass plan:
	1.	Blueprint – a clear, orderly roadmap from empty repo to finished tool.
	2.	Chunk → Step Breakdown – ever-smaller slices that are easy to ship & test.
	3.	Prompt Suite – copy-paste-ready prompts for a code-generation LLM.
Each prompt assumes all previous prompts have been accepted & merged.

⸻

1 · Blueprint (“big picture”)

Phase	Goal	Key Deliverables
0 Bootstrap	Working repo skeleton & CI	pyproject.toml, pre-commit, GitHub Actions
1 Network Layer	Fetch & list CIS folders/YAML	github.py (GitHubClient) + unit tests
2 Transform Layer	Convert raw YAML → sanitized objects → final YAML	transform.py + golden-file tests
3 File IO	Decide filenames, create ./output, write YAML	writer.py + overwrite safeguards
4 CLI Skeleton	Typer app + list command	__main__.py, CLI smoke tests
5 CLI Generate	generate command (single & multi-platform)	integration tests w/ fixtures
6 TUI	Textual multi-select, “Select All”, overwrite modal	tui/ package + manual UX test
7 Polish	README, packaging, version bump	wheel build passes CI

Each phase builds on the previous and leaves the repo in a shippable, green-tests state.

⸻

2 · Chunk → Step Breakdown

Chunk	Micro-step	Rationale
0-A Repo init	0.1 git init, licence, pyproject stub	Foundation
	0.2 Add requests, ruamel.yaml, typer, textual deps	
	0.3 Add pytest, ruff, mypy, pre-commit configs	Tooling
	0.4 GitHub Actions workflow (lint + tests)	CI baseline
1-A Folder listing	1.1 GitHubClient.list_folders()	Isolated pure GET
	1.2 Unit test with responses or pytest-httpx	Red-Green
1-B YAML fetch	1.3 GitHubClient.fetch_yaml(folder)	
	1.4 Unit test (mock 200/404)	
2-A Parse	2.1 Transformator.raw_yaml_to_list(str) -> list[dict]	Basic parsing
	2.2 Test against fixture macos15_raw.yml	
2-B Sanitise & dump	2.3 Transformator.sanitise(item)	Field dropping
	2.4 Transformator.to_yaml(list[dict]) -> str	Ordered dump
	2.5 Golden-file test vs macos15_expected.yml	Exactness
3-A Path logic	3.1 Writer.output_path(folder, dir_)	hyphen strip
	3.2 Unit test path cases	
3-B File write	3.3 Writer.write(text, path, overwrite)	Handles mkdir, prompt flag
	3.4 Unit tests: new file, exists + no force	
4-A CLI shell	4.1 Typer app stub + list command wiring GitHubClient	Skeleton running
	4.2 CLI test (CliRunner) for happy path	
5-A generate 1	5.1 generate single platform, default dir	vertical slice
	5.2 Integration test (fixture HTTP)	
5-B generate 2	5.3 Add multi-platform & --all	feature complete
	5.4 Add -o/--output, --force flags + tests	UX
6-A TUI skeleton	6.1 Basic TextualApp launches, lists platforms	visual smoke
6-B Multi-select	6.2 Checklist widget + “Select All”	
6-C Hook generate	6.3 Call transform & writer, show progress log	usable
6-D Overwrite modal	6.4 Popup if file exists	parity with CLI
7-Finalize	7.1 Update README, CHANGELOG, bump __version__	docs
	7.2 python -m build, ensure wheels pass CI	release ready

Every micro-step is small (< ~50 LOC), testable, and leaves repo green.

⸻

3 · Prompt Suite for Code-Gen LLM

Paste each block into your favourite coding-LLM (one at a time, sequentially).
All prompts are fenced as requested.

Important conventions inside each prompt
	•	Write the production code and the matching tests.
	•	All tests must pass with pytest -q.
	•	Keep public interface stable; internal refactors allowed in later prompts.

⸻

Prompt 0.1 – Repo Init

You are ChatGPT-Dev.  
Create the initial project skeleton:

* Add `pyproject.toml` (PEP 621) with:
  - Project name `fleet-cis-tui`, version `0.0.1`
  - Requires Python `>=3.9,<4.0`
  - Dependencies: requests, typer[all], ruamel.yaml>=0.18, textual>=0.59
  - Optional deps: dev - pytest, pytest-httpx, responses, ruff, mypy, pre-commit

* Add `src/fleet_cis_tui/__init__.py` containing only `__version__ = "0.0.1"`

* Add `.github/workflows/ci.yml` running:
  - Ruff lint
  - mypy (strict)
  - pytest

* Add `tests/__init__.py` (empty)

No production logic yet.  Output full file contents.  Tests should pass (nothing to run).  


⸻

Prompt 0.2 – Dev Tooling

Expand the repo:

1.  Add `ruff.toml` enabling recommended rules.
2.  Add `mypy.ini` with strict flags.
3.  Add `.pre-commit-config.yaml` installing ruff, mypy, pytest, and black (skip Fen).
4.  Update CI workflow to run pre-commit on push.

Provide complete file contents.  
No new tests needed.  


⸻

Prompt 1.1 – GitHubClient.list_folders()

Create `src/fleet_cis_tui/github.py`:

* Dataclass `GitHubClient` with method  
  `async def list_folders(self) -> list[str]`  
  – Fetch `https://api.github.com/repos/fleetdm/fleet/contents/ee/cis`  
  – Return folder names where `type=="dir"`, sorted.

Add synchronous wrapper `def list_folders_sync() -> list[str]` using `asyncio.run`.

**Testing**

* New test file `tests/test_github_list.py`:
  - Use `pytest_httpx` to mock the API returning two dirs (`macos-14`, `windows-11`) & one file.  
  - Assert the sync helper returns `["macos-14", "windows-11"]`.

No other modules touched.  All tests green.  


⸻

Prompt 1.3 – GitHubClient.fetch_yaml()

Extend `GitHubClient` with:

`async def fetch_yaml(self, folder: str) -> str`
  * Compose raw URL:  
    `https://raw.githubusercontent.com/fleetdm/fleet/refs/heads/main/ee/cis/{folder}/cis-policy-queries.yml`
  * GET and return text.  Raise `RuntimeError` with folder name on 404.

Add sync helper `fetch_yaml_sync(folder: str)`.

**Tests**

Create `tests/test_github_fetch.py`:

* Mock successful 200 returning “yaml: true” Verify string returned.
* Mock 404 and assert `RuntimeError`.

Use `pytest_httpx` for mocks.  


⸻

Prompt 2.1 – Transformator.raw_yaml_to_list

Create `src/fleet_cis_tui/transform.py`.

* Function `raw_yaml_to_list(yaml_str: str) -> list[dict]`
  - Parse with ruamel.yaml safe loader.
  - Expect top-level list, return it unmodified.

**Tests**

`tests/test_transform_parse.py`:

* Fixture `sample_raw.yml` containing simple two-item list.
* Assert len(list) == 2 and first key “name” present.


⸻

Prompt 2.3 – Sanitise & Dump

In `transform.py` add:

* `ALLOWED_KEYS = ["name", "platform", "description", "resolution", "query"]`
* Function `sanitise(item: dict) -> dict` that:
  - Copies keys in ALLOWED_KEYS order.
* Function `sanitise_all(items: list[dict]) -> list[dict]`
* Function `to_yaml(items: list[dict]) -> str`
  - Use ruamel.yaml to dump:
    • block style, two-space indent, no document markers

**Tests**

`tests/test_transform_sanitise.py`:

* Feed in dict with extra keys and multiline description.
* Assert extra keys removed, ordering preserved.
* Compare output of `to_yaml` to golden text fixture `expected.yml` (add fixture).  


⸻

Prompt 3.1 – Writer.output_path

Create `src/fleet_cis_tui/writer.py`.

* `def output_path(folder: str, out_dir: Path) -> Path`
  - Strip hyphens (`macos-15` -> `macos15`)
  - Return `out_dir / f"cis-benchmark-{clean}.yaml"`

**Tests**

`tests/test_writer_path.py`:
  - parametrize examples, assert expected path names.


⸻

Prompt 3.3 – File Writing

In `writer.py` add:

`def write(text: str, path: Path, overwrite: bool = False) -> None`
  - Ensure `path.parent` exists.
  - If path exists and not overwrite: raise `FileExistsError`.
  - Write utf-8 text.

**Tests**

`tests/test_writer_write.py`:
  - tmp_path fixture; write new file (assert contents).
  - Attempt overwrite without flag -> expect FileExistsError.


⸻

Prompt 4.1 – Typer Skeleton + list

Create `src/fleet_cis_tui/__main__.py`:

* Typer app.  
* Command `list`:
  - Calls `list_folders_sync` and prints one per line.

**Tests**

`tests/test_cli_list.py`:
  - Patch `github.list_folders_sync` to return sample list.
  - Use Typer’s CliRunner to invoke `fleet-cis-tui list`; assert output lines.


⸻

Prompt 5.1 – generate (single platform)

Extend CLI:

* Sub-command `generate` with args:
  - `platforms: List[str]`
  - `--output/-o path = "./output"`
  - `--force` flag
* For each platform:
  - Fetch YAML, parse, sanitise, dump.
  - Resolve path via writer, call write().

**Tests**

`tests/test_cli_generate_one.py`:
  - Mock GitHub fetch to return fixture yaml for `macos-15`.
  - Run `generate macos-15 --output {tmpdir}`.
  - Assert file exists & matches expected.

Handle FileExistsError → non-zero exit code.


⸻

Prompt 5.3 – generate (multi + all)

Enhance `generate`:

* Add `--all` flag (mutually exclusive with platform list).
* Collect platforms accordingly.
* Iterate; for errors keep going, aggregate non-zero exit if any failed.

Update tests:
  - new test `generate --all` with two folders mocked.


⸻

Prompt 6.1 – Textual Skeleton

Create `src/fleet_cis_tui/tui/app.py`.

* Minimal TextualApp that launches, fetches folder list async, and displays them in a plain ListView.  
* Escape quits.

No tests yet (manual).  Provide run helper in CLI (`fleet-cis-tui tui`).


⸻

Prompt 6.2 – Checklist & Select All

Enhance TUI:

* Replace ListView with a Checkbox list (one per platform).
* Add “Select All” checkbox at top.
* Bottom bar: [G] Generate  [Q] Quit.

Manual verification steps documented in README.  


⸻

Prompt 6.3 – Wire Generate

In TUI:

* On “G”, gather checked platforms; call existing generate logic (reuse writer etc.) in a background task; show Rich live progress.

* On completion, show modal “Finished - files in ./output”.

Add integration test using Textual’s pilot (basic smoke).


⸻

Prompt 6.4 – Overwrite Modal

Add overwrite detection:

* Before writing each file, if exists, open Textual modal:
  “cis-benchmark-macos15.yaml exists. Overwrite? [Y]es/[N]o/[A]ll”.
* Respect choices.

Manual test only.  


⸻

Prompt 7.1 – Docs & Packaging

Write/Update:

* `README.md` quick-start (`pipx install fleet-cis-tui`).
* `CHANGELOG.md` v0.1.0.
* `LICENSE` MIT.

Ensure `__version__` bumped to `0.1.0` and included in CLI `--version`.

No code tests.  


⸻

Prompt 7.2 – Build & Release Smoke

Add `scripts/build.sh`:

* `python -m build`
* `pipx run dist/fleet_cis_tui-0.1.0-py3-none-any.whl list` as smoke.

Update CI workflow to call script.

Provide file content.


⸻

✅ Review
	•	Steps are ≤ ~100 LOC each, immediately testable.
	•	Core logic wired together progressively—no orphaned code.
	•	Early phases establish tooling & strict CI before real code.
	•	Network, transform, IO layers isolated → mocking/tracing easy.
	•	CLI finished before TUI starts, avoiding double complexity.

You now have a ready-to-go sequence of AI prompts to build the project incrementally, test-driven, and safely. Happy coding! 🎉
