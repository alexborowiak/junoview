# AGENTS.md — how to write code in this repo

Instructions for anyone (AI agent or human) changing junoview. The goal of
every rule here is the same: the repo must stay small enough to hold in your
head, and structured enough that the *place* for a change is obvious.
Machine-specific notes (Windows paths, no Node, test invocation) live in
[CLAUDE.md](CLAUDE.md). The backlog lives in [TASKS.md](TASKS.md).

## Orient first

Read [ARCHITECTURE.md](ARCHITECTURE.md) before your first change — it has a
twenty-minute reading order. The one sentence that matters:

```
.ipynb ─▶ junoview.notebook ─▶ Document ─▶ junoview.render ─▶ one .html file
```

`Document` is the seam. `notebook/` decides what a notebook *means*;
`render/` decides what it *looks like*; every frontend (server, widget, web
build) consumes `Document` and the `render_*` entry points — never the
parser's internals.

## Where code goes

- **Understanding a notebook** (parsing, classification, directives,
  provenance) → `src/junoview/notebook/`. **Drawing one** (HTML, CSS
  assembly, highlighting, sanitising) → `src/junoview/render/`. If a change
  seems to need both, you are probably at one of the few named crossings
  listed in ARCHITECTURE.md — read that list before adding a new one, and
  if you must cross the seam, do it in one named, commented place.
- **Frontend** → real files under `src/junoview/assets/` (css/js/html). No
  build step, no framework, no minification — keep it that way.
- **Anything that writes to disk** → `src/junoview/server/` only.
- **Core stays stdlib-only.** No new runtime dependencies — that is why the
  Pyodide browser build works at all.
- `docs/` is a **generated** GitHub Pages build. Never edit it by hand;
  regenerate with `junoview --build-web docs`.
- `src/semantic_render.py` is a compatibility shim — keep it re-exporting,
  don't grow it.

## Keeping the repo legible (for AI and humans alike)

- **Small modules, one job each.** Every file in `notebook/` and `render/`
  has a one-line description in ARCHITECTURE.md's tree; if your new code
  doesn't fit any existing line, that's a signal to add a module, not to
  grow an unrelated one. Update the tree when you do.
- **Section banners in big JS files.** `deck.js` and `app.js` are navigated
  by `/* ---- NAME ---- */` banners (`grep "/* ----"`). New frontend code
  goes under the right existing banner, or a new banner — never loose
  between sections.
- **Comments say *why*, not *what*.** Many test assertions and code
  comments record design decisions; they are the project's memory. Keep
  them, and write one whenever you pin new behaviour.
- **Name things once, stably.** The package ships `py.typed`, so public
  signatures and annotations are a contract. Annotate new public functions;
  don't rename public API casually (there is a deliberate rename pass
  tracked in TASKS.md — do it there, not opportunistically).

## Frontend rules

- Only `page.html` and `shell.html` are `str.format` templates. The
  stylesheets and scripts are inert values substituted into them — their
  `{` braces must NOT be escaped, and no stylesheet may ever become a
  template.
- `assets/js/deck.js` is ONE ~18,000-line IIFE. All load-time execution
  runs from THE BOOT SEQUENCE at the file's tail. Never add mid-file boot
  calls or executing sub-IIFEs — a throw during boot silently kills the
  whole file. (A multi-file split is a tracked task; until it lands, work
  within this rule.)
- The only runtime network fetches are the pinned CDN URLs precached in
  `assets/js/sw.js` (Pyodide, MathJax, Plotly). Pins must match their
  loaders — `tests/test_js_contract.py` enforces this. Bump a pin in both
  places in the same commit.

## UI invariants (user-confirmed — do not regress)

- Toolbar/ribbon buttons NEVER wrap to a second row. `fitRibbon` (app.js)
  and `fitEditRibbon` (deck.js) compact the ribbon instead.
- Buttons are words PLUS icons, never icon-only (rejected twice).

## Behavioural invariants

- **Byte-stable output**: the same notebook renders to identical bytes on
  every platform. LF endings are pinned; assets are read in text mode; the
  web-build zip is written deterministically.
- **The renderer never executes notebook code** — it reads stored outputs.
- **Untrusted HTML goes through `render/sanitize.py`** — always.
- **The local server binds localhost and token-guards mutations** — it can
  touch anything the user can.

## Style

- Python 3.10+, 79 columns house style (≤88 tolerated for pre-existing
  lines). Match the lines around you.
- `ruff check .` and `mypy` clean; CI runs both.

## Tests

- `pytest` from the repo root runs everything.
- Most assertions are substring checks pinning UI decisions. A failure asks
  "did I mean to change this behaviour?" — not "how do I make it pass".
  Read the comment on the assertion first.
- `tests/test_characterization.py` pins an MD5 of the rendered example
  page. Update `EXPECTED_MD5`/`EXPECTED_BYTES` only for deliberate output
  changes, in the same commit, with the commit message saying what changed
  and why.
- New logic gets a real test — call the function, check the return value —
  in preference to another substring grep.
- Every asset JS file is syntax-checked by `tests/test_js_contract.py`.

## Workflow

- [TASKS.md](TASKS.md) is the backlog: one commit per task, tick the box in
  the same commit, add dated notes under a task when you learn something.
- Tasks marked **[deck.js]** must never run concurrently in two sessions.
- Rebuild `docs/` only as a deliberate deploy step, never as a side effect.
