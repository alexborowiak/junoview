# Working on Junoview — machine-specific notes

Repo-wide code-structure rules are in AGENTS.md; the feature backlog is
TASKS.md (one commit per task, tick the box in the same commit). This file
is only what's specific to this machine.

## Running things

- Tests: `python -m pytest -q` from the repo root (~460 tests, under 15 s).
  Bare `python` on this machine is a real Python 3.13, not the Store stub.
  pyproject.toml sets `pythonpath = ["src", "tests"]`, so no `pip install -e`
  or PYTHONPATH is needed to run the suite.
- There is NO Node on this machine. To syntax-check a JS file, use VS Code's
  Electron as node (PowerShell — the `Out-Null` forces the shell to wait so
  `$LASTEXITCODE` is real):

      $env:ELECTRON_RUN_AS_NODE='1'
      & "$env:LOCALAPPDATA\Programs\Microsoft VS Code\Code.exe" --check <file.js> | Out-Null
      $LASTEXITCODE   # 0 = parses, 1 = syntax error

  `tests/test_js_contract.py` runs this automatically over every asset JS file.

## docs/ is a build artifact

- `docs/` is the GENERATED GitHub Pages build. Never hand-edit it; it
  typically lags `src/` between deploys, so a bug you can see on the deployed
  page (or a screenshot of it) may already be fixed in `src/`. Rebuild with:

      python -m junoview --build-web docs
      python -m junoview examples\example_climate_analysis.ipynb -o docs\example_climate_analysis.html

  Outside pytest the package is not on sys.path (it is not pip-installed
  here), so prefix both with `PYTHONPATH=src ` in Git Bash, or
  `$env:PYTHONPATH='src'; ` in PowerShell.

- When verifying `docs/` in a browser, unregister the service worker first
  (DevTools → Application → Service workers) — otherwise you are looking at
  the PREVIOUS build served from its cache.

## The frontend

- The frontend is real `.css`/`.js`/`.html` files under `src/junoview/assets/`
  — no build step, no framework, no minification. At runtime the only network
  fetches are the pinned CDN URLs precached in `assets/js/sw.js` (Pyodide,
  MathJax, Plotly); those pins must match their loaders — see
  `tests/test_js_contract.py`.
- `assets/js/deck.js` is ONE ~18,000-line IIFE. All load-time execution runs
  from THE BOOT SEQUENCE at the file's tail — never add mid-file boot calls or
  executing sub-IIFEs (a throw during boot silently kills the whole IIFE).
  Navigate by its section banners: `grep "/* ----" deck.js`.

## UI invariants (user-confirmed, do not regress)

- Toolbar/ribbon buttons NEVER wrap to a second row — `fitRibbon` (app.js) and
  `fitEditRibbon` (deck.js) compact the ribbon instead.
- Buttons are words PLUS icons, never icon-only (rejected twice).

## Tests to treat with care

- `tests/test_characterization.py` pins `EXPECTED_MD5`/`EXPECTED_BYTES` of the
  rendered example page. Update them only for DELIBERATE byte changes, in the
  same commit, saying what changed and why (see CONTRIBUTING.md).
