# fleet-cis-tui – Development Checklist

> **Legend**  
> - [ ]  *Unchecked*    
> - [x]  *Done*          
> - 🔄  *Revisit / polish later*

---

## 0 · Bootstrap 🏗️
- [ ] **Repo initialization**
  - [ ] `git init`, add **MIT LICENSE**
  - [ ] Commit empty `main` branch
- [ ] **Project metadata**
  - [ ] Create `pyproject.toml`
    - [ ] Name: `fleet-cis-tui`
    - [ ] Version: `0.0.1`
    - [ ] Python `>=3.9,<4.0`
    - [ ] Deps: `requests`, `typer[all]`, `ruamel.yaml>=0.18`, `textual>=0.59`
    - [ ] Dev deps: `pytest`, `pytest-httpx`, `responses`, `ruff`, `mypy`, `pre-commit`, `build`
  - [ ] `src/fleet_cis_tui/__init__.py` → `__version__ = "0.0.1"`
- [ ] **Tooling & CI**
  - [ ] Add **`ruff.toml`**
  - [ ] Add **`mypy.ini`** (strict)
  - [ ] Add **`.pre-commit-config.yaml`** (ruff, mypy, pytest, black*)
  - [ ] Install hooks `pre-commit install`
  - [ ] `.github/workflows/ci.yml`
    - [ ] Set up 3-platform Python matrix (`3.9–3.11`)
    - [ ] Run ruff, mypy, pytest
- [ ] **Tests scaffold**
  - [ ] `tests/__init__.py` (empty)
  - [ ] Ensure `pytest -q` passes in CI

---

## 1 · Network Layer 🌐
- [ ] **GitHubClient core**
  - [ ] `src/fleet_cis_tui/github.py`
    - [ ] `async def list_folders()`
    - [ ] Sync helper `list_folders_sync()`
  - [ ] Unit test `tests/test_github_list.py`
- [ ] **YAML fetch**
  - [ ] Add `async def fetch_yaml(folder)`
  - [ ] Sync helper `fetch_yaml_sync()`
  - [ ] Unit test `tests/test_github_fetch.py`

---

## 2 · Transform Layer 🛠️
- [ ] `src/fleet_cis_tui/transform.py`
  - [ ] `raw_yaml_to_list`
  - [ ] `sanitise` & `sanitise_all`
  - [ ] `to_yaml`
- [ ] Tests
  - [ ] `tests/test_transform_parse.py`
  - [ ] `tests/test_transform_sanitise.py`
  - [ ] Fixtures: `sample_raw.yml`, `expected.yml`

---

## 3 · File IO 🗂️
- [ ] `src/fleet_cis_tui/writer.py`
  - [ ] `output_path(folder, out_dir)`
  - [ ] `write(text, path, overwrite)`
- [ ] Tests
  - [ ] `tests/test_writer_path.py`
  - [ ] `tests/test_writer_write.py`

---

## 4 · CLI Skeleton 🖥️
- [ ] `src/fleet_cis_tui/__main__.py`
  - [ ] Typer app instance
  - [ ] `list` command
- [ ] Test
  - [ ] `tests/test_cli_list.py`

---

## 5 · CLI Generate 🚀
- [ ] **Phase 5-A: single platform**
  - [ ] Implement `generate` command (one key)
  - [ ] Test `tests/test_cli_generate_one.py`
- [ ] **Phase 5-B: multi-platform + flags**
  - [ ] Add `--all` flag, multi-key support
  - [ ] Add `-o/--output` & `--force`
  - [ ] Tests for `--all` & overwrite behavior

---

## 6 · TUI Interface 🎨
- [ ] `src/fleet_cis_tui/tui/app.py`
  - [ ] Basic TextualApp skeleton (`fleet-cis-tui tui`)
- [ ] **Checklist view**
  - [ ] Replace with multi-select checkboxes
  - [ ] “Select All” checkbox
  - [ ] Keybind hints `[G]enerate  [Q]uit`
- [ ] **Wire to generate logic**
  - [ ] Background task; Rich progress
  - [ ] Success modal
- [ ] **Overwrite modal**
  - [ ] Prompt Y/N/A when file exists
- [ ] Manual UX verification (macOS/Win/Linux)

---

## 7 · Polish & Packaging 📦
- [ ] **Docs**
  - [ ] Write `README.md` (install, usage, screenshots)
  - [ ] Seed `CHANGELOG.md` (`v0.1.0`)
- [ ] **Version bump**
  - [ ] Update `__version__` → `0.1.0`
- [ ] **Smoke build**
  - [ ] `scripts/build.sh` (`python -m build`)
  - [ ] CI: build wheel & smoke-run `list`
- [ ] **Publish (optional)**
  - [ ] `twine upload dist/*` (test PyPI first)

---

## 8 · Stretch / Backlog 🔮
- [ ] Cached directory listing with expiry
- [ ] PyInstaller single-binary release
- [ ] Custom repo/branch support (env or flag)
- [ ] Progress bars during downloads
- [ ] `--archive` tar/zip output option

---

\* **Black** is optional—enable if the team prefers auto-formatting.
