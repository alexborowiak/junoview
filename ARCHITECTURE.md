# Architecture

Junoview turns an **executed** Jupyter notebook into a figure-first HTML page.
It is a *static* renderer: it reads the outputs already stored in the `.ipynb`,
so there is no kernel, no backend and no re-execution.

Everything runs on the Python standard library. The only optional dependencies
are `anywidget` and `ipywidgets`, and only for the in-Jupyter widget.

## The one-sentence version

```
.ipynb ──▶ junoview.notebook ──▶ Document ──▶ junoview.render ──▶ one .html file
           (what does it mean?)              (what does it look like?)
```

`Document` is the seam. Everything to its left is about *understanding* a
notebook; everything to its right is about *drawing* one — and every
*frontend* honours it: the server, the widget and the web build all consume a
`Document` plus the `render_*` entry points, never the parser's internals.

Between the two halves themselves, though, the split is a division of labour,
not a wall. The crossings are few and named, and worth knowing before you
move code: `notebook/parser.py` imports `render_raw` to fill `doc.raw_html`
(handing it the parse's already-rendered outputs, so each multi-MB figure is
embedded in the page once — the raw view holds keyed placeholders that app.js
fills by cloning the card's copy, and embeds in full only what the cards
dropped);
`notebook/loader.py` imports `render_html` to offer the one-call
`render_notebook_file`; `notebook/outputs.py` emits the HTML fragments for
stored rich outputs (a figure, an xarray repr) rather than describing them
abstractly; and `render/` reaches back for `_as_text` and `_HEADING_RE`. So
you can usually change how a figure is *rendered* without touching how it is
*recognised* — unless you are near one of those crossings.

## Where things live

```
src/junoview/
├── notebook/          reading notebooks and working out what they mean
│   ├── model.py           Document / Section / Item / CodeStep  ← start here
│   ├── directives.py      the `#| key: value` lines an author writes
│   ├── classify.py        inference for everything they didn't write
│   ├── outputs.py         what a stored output actually is (figure? repr? text?)
│   ├── parser.py          the single pass that ties the above together
│   ├── chains.py          provenance: which cell feeds which
│   ├── variables.py       the variables index the sidebar's Variables view lists
│   ├── presentations.py   reading saved decks off a notebook
│   ├── deck_schema.py     the deck format written down, and a
│   │                      validate() that reports against it
│   └── loader.py          getting notebooks from disk or a URL
│
├── render/            turning a Document into HTML
│   ├── items.py           one card, the nav rail, the raw view
│   ├── page.py            assembling the finished page from templates
│   ├── highlight.py       Python syntax highlighting
│   ├── markdown.py        just enough Markdown for notebook prose
│   ├── sanitize.py        allow-list sanitizer for untrusted notebook HTML
│   └── graph.py           the provenance drawing, as SVG
│
├── assets/            the frontend, as real files
│   ├── css/               core.css · app.css · deck.css · widget.css
│   │                      · widget-media.css  (the widget's responsive rules)
│   ├── js/                app.js · deck.js · pptx.js · widget.js
│   │                      · sw.js  (the web build's offline service worker)
│   └── html/              page.html · shell.html · deck.html · help.html · …
│
├── server/            the local GUI app (the only part that writes to disk)
│   ├── app.py             starts it
│   ├── routes.py          the HTTP surface
│   ├── state.py           open tabs, the project file, the file browser
│   ├── notebook_edit.py   writing notes back into an .ipynb, with snapshots
│   └── vcs.py             optional git awareness
│
├── web.py             the client-side (Pyodide) build
├── widget.py          the in-Jupyter anywidget view
├── branding.py        icons, logo, favicon, links
└── cli.py             the `junoview` command
```

`src/semantic_render.py` is a deprecation shim: it re-exports the package so
old `import semantic_render` code keeps working.

## Reading order

If you are new, this path gets you oriented in about twenty minutes:

1. **`notebook/model.py`** (71 lines) — four dataclasses. Everything else
   produces or consumes these.
2. **`notebook/directives.py`** — the contract with the notebook's author.
3. **`notebook/parser.py`** — `parse_notebook()`, the one pass over the cells.
4. **`render/items.py`** — how a single card becomes HTML.
5. **`render/page.py`** — how the cards, the CSS and the JS become a page.

## Two things worth knowing before you change anything

### The frontend is not Python

About three-quarters of this project by volume is CSS and JavaScript. It used
to live in Python string constants, which meant no syntax highlighting, no
linting and unreadable diffs. It is now ordinary files under `assets/`, loaded
through `importlib.resources`:

```python
from junoview import assets
assets.core_css()      # reads assets/css/core.css, cached
```

Two of those files are `str.format` templates with named placeholders
(`page.html`, `shell.html`). The stylesheets and scripts are **not** templates —
they are inert values substituted *into* those templates, which is why their
many `{` braces need no escaping. If you ever make a stylesheet a template, you
must escape every brace in it; don't.

Reading assets through `importlib.resources` rather than `open(__file__/...)` is
deliberate: it keeps working when the package is imported from inside a zip,
which is exactly how the web build runs.

### The web build ships a zip

`junoview --build-web DIR` writes a static site that runs Python in the
visitor's browser via Pyodide. Because a package cannot be fetched as one file
the way the old single module could, `build_web()` writes `junoview.zip` and the
loader hands it to Pyodide's `unpackArchive`. Imports and `importlib.resources`
both work from that zip, so assets load normally.

The archive is written deterministically — members sorted, timestamps fixed — so
an unchanged package produces byte-identical output and the committed `docs/`
build doesn't churn.

The build is also an installable, offline-capable PWA: `build_web()` writes
`sw.js` (a service worker that precaches the page, `junoview.zip`, the Pyodide
runtime and MathJax on first visit — version-stamped with the package hash so
it follows the same determinism rule), `manifest.webmanifest` and `icon.svg`.
The Pyodide version is pinned in two places — the loader's script tag and the
worker's precache list — bump them together.

## Testing

```bash
pip install -e ".[dev]"
pytest
```

The suite began life as a single 1,500-line `_self_test()` function. Most of it
is *characterization* testing: assertions that a particular string appears in
the rendered page, each pinning a UI decision that was made for a reason. The
comments explaining those reasons were kept — they are the project's design
history, and they tell you what breaking a test would actually mean.

`tests/test_characterization.py` is the important one: it renders the example
notebook and compares against a recorded hash, so any unintended change to the
output is caught immediately.

## Three frontends, one model

The durable asset is the **directive spec plus the parser and model** in
`junoview.notebook`. Every frontend is a consumer of it, which is why adding one
does not disturb the others:

- **Static HTML** (`render_html`) — share, publish, attach to CI. No Jupyter.
- **The widget** (`SemanticNotebook`) — explore in-kernel: recompute, and
  arrange/hide state that persists back to Python. See [WIDGET.md](WIDGET.md).
- A full JupyterLab extension (directive autocomplete, continuous two-way model
  sync, editor squiggles) is the obvious next one — worth building only if this
  becomes the primary way several people read notebooks day to day.

If you are adding a frontend, consume `Document`; don't reach into the parser.

## Invariants

Things that are load-bearing and easy to break by accident:

- **Rendered output is byte-stable.** The same notebook must produce the same
  bytes on every platform. That is why `.gitattributes` pins the assets to LF
  endings and why the asset loader reads in text mode.
- **The renderer never executes notebook code.** It reads stored outputs only.
- **Untrusted HTML goes through `render/sanitize.py`.** Notebook markdown and
  rich outputs can contain anything; rendered pages get shared.
- **The local server is not a web server.** It binds to localhost and guards
  mutating requests with a per-session token, because it can read and write
  files anywhere the user can.
