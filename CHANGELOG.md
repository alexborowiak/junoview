# Changelog

## 0.2.0

### The single file became a package

`semantic_render.py` had grown to 20,073 lines. It is now the `junoview`
package under `src/`. Nothing about the rendered output changed — the split was
verified byte-for-byte against the previous release, and the example notebook
still renders to exactly the same bytes.

**If you import it:**

```python
import semantic_render          # still works, warns
import junoview                 # do this instead
```

`semantic_render` is kept as a deprecation shim re-exporting the package.

**If you run it:**

```bash
python semantic_render.py nb.ipynb    # gone
junoview nb.ipynb                     # use this
python -m junoview nb.ipynb           # or this
```

**What moved where** — see [ARCHITECTURE.md](ARCHITECTURE.md):

| was | now |
| --- | --- |
| `semantic_render.py` (20,073 lines) | `src/junoview/`, 33 modules, none over 440 lines |
| `_CSS`, `_JS`, `_DECK_JS`, … string constants | real files under `src/junoview/assets/` |
| `semantic_widget.py` | `junoview.widget` (622 lines -> 335; its ES module and CSS became `assets/js/widget.js` and `assets/css/widget.css`) |
| `_self_test()` (one 1,532-line function) | `tests/`, 159 pytest tests in 17 subject-named modules |
| `example_climate_analysis.ipynb` | `examples/` |
| `semantic_app.bat` | `junoview.bat` |

Because the example notebooks moved, a `junoview_project.json` written before
this release has **Recent** entries pointing at the old locations. Reopen them
from `examples/` and the list corrects itself.

About three-quarters of the old file was CSS and JavaScript held in Python
string literals. Those are now ordinary `.css` / `.js` / `.html` files, so they
get syntax highlighting, linting and readable diffs. They are read through
`importlib.resources`, which keeps working when the package is imported from a
zip.

### Documentation

- **The README's "Live demo" link was a 404.** The single most prominent link
  on the landing page pointed at `plotline-nb.dev`, left over from the rename;
  it now points at `junoview.dev`, which serves that path. The same stale
  domain was in `CITATION.cff`.
- **The seven demo GIFs in `docs/gifs/` are finally shown.** They were sitting
  unused while a commented-out shot list asked for five differently-named ones
  that had never been recorded.
- The README went from 606 lines to under 300: the reference material moved
  into [AUTHORING.md](AUTHORING.md), [PRESENTATIONS.md](PRESENTATIONS.md) and
  [WIDGET.md](WIDGET.md), leaving a landing page with badges and a contents
  table. A stray `# semantic-rendering` heading at the very bottom is gone.
- CONTRIBUTING is now honest about what the suite is: roughly 72% of the
  assertions are substring checks against the rendered page, which makes them
  good regression tests and poor specification tests.
- **Removed instructions to run two scripts that do not exist.** The README told
  you to run `make_example_notebook.py` and WIDGET.md referred to
  `make_widget_demo.py`; neither has ever been in the repository. The example
  notebooks they claimed to generate are committed and ship already executed.

### Fixed

- **`python -m build` could not build the package at all.** `pyproject.toml`
  carried both a PEP 639 `license = "Apache-2.0"` expression and the superseded
  `License :: OSI Approved` classifier; current setuptools rejects that
  combination outright. The classifier is gone.
- **`--build-web` shipped a site with no demo GIFs** unless you happened to
  build into the repo's own `docs/`. The help overlay and welcome tour link to
  `gifs/` relative to the page, and nothing copied them; every other deployment
  silently lost the reel. (Nothing appeared broken — the page probes for one
  GIF and hides the section if it 404s — it just never showed.) `build_web`
  now copies them when it can find them.
- **`junoview.bat` could not launch anything.** The rewritten launcher called
  `where junoview`, which finds the batch file itself and re-invokes it; it set
  `PYTHONPATH` inside a parenthesised block, where the value is not visible to
  the command beside it; and it called bare `python`, which on Windows usually
  resolves to the Microsoft Store stub rather than an interpreter. It now finds
  a real Python (overridable with `JUNOVIEW_PYTHON`) and never looks itself up.
- **Syntax highlighting marked the wrong names as builtins.** The highlighter
  used `dir(__builtins__)`, which is the builtins module's names when run as a
  script but the module `__dict__`'s methods when imported. Highlighting was
  correct only by accident of the file being run directly; anything importing
  `semantic_render` got `.update` and `.values` highlighted as builtins while
  `print` and `range` were missed. It now reads the `builtins` module directly.

### Changed

- `--build-web` writes `junoview.zip` instead of `semantic_render.py`, and the
  Pyodide loader unpacks it. The archive is written deterministically, so
  rebuilding without source changes produces no diff.
- `--self-test` now runs a small built-in smoke check (render the demo
  notebook, confirm the assets reached the page) rather than the old
  1,532-line assertion block, which moved to `tests/` and is not shipped.
- The hand-written extras on `docs/index.html` — SEO metadata and the boot-time
  tips carousel — moved into `assets/html/web-loader.html`. They had been
  edited into the generated file, so the `--build-web docs` the README tells
  you to run would have silently wiped them.
- Everything Junoview writes now uses LF endings on every platform. Windows
  previously produced CRLF output, so the same notebook rendered to different
  bytes depending on who ran it.
- `render_page()` no longer passes a `repo=` value to the page template; the
  template never used it.

### Added

- [ARCHITECTURE.md](ARCHITECTURE.md) and [CONTRIBUTING.md](CONTRIBUTING.md).
- A CI workflow covering Linux/macOS/Windows on Python 3.10 and 3.13, which
  installs the built wheel and renders a notebook with it — the check that
  catches missing package data, since a source checkout hides that failure.
- `tools/clean_scratch.py`, for the browser-profile directories that headless
  test runs leave in the repo root.
- `.gitattributes` pinning assets to LF, so a CRLF checkout cannot change the
  rendered output.
- A `py.typed` marker, so downstream users get the annotations. The package
  type-checks clean under mypy, which CI now enforces. Getting there fixed a
  reused loop variable in `server/routes.py` that made a genuinely nullable
  card look non-nullable to a reader.
