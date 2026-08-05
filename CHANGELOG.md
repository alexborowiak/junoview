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

### Fixed — interface

All five predate the package split. The rendered HTML was verified byte-identical
to the old single-file renderer, so these were latent all along rather than
introduced by the move.

- **The outline rail stopped short of the floor while presenting.** Docked, the
  rail is sized `100vh - --chrome-h` to clear the app ribbon. Presenting hides
  that ribbon and pins the rail `top:0;bottom:0` — but an explicit height beats
  `bottom`, so the rail ended exactly one ribbon-height above the bottom.
- **Outline sat at the far right of the present bar**, while the outline it
  opens is down the left. It now sits at the left end, beside what it moves.
- **The present bar's own buttons overprinted each other.** Exit and the fold
  button are pinned to the top-right corner, deliberately out of the wrap flow
  so a narrow window cannot push the way out onto a second row — but being out
  of flow they reserved no space, so Auto-hide and the dock button rendered
  underneath them. The bar now pads itself clear of that corner, measured from
  the real button rather than hard-coded.
- **The type-picker buttons were 34px squares** sitting under filter buttons
  three to four times their width, which read as separate controls and left the
  filter row ragged along the bottom. They now take the width of the filter they
  refine. Help keeps its square: it stands alone.
- **The ribbon showed on the welcome screen**, where every filter, size and view
  control is inert and Open is already on the welcome screen itself. It is now
  hidden until something is open, and the welcome starts at the top of the
  window rather than below the band the hidden ribbon used to reserve.
- **A 429px hole sat between Apply-to and the Figures/Text size controls.**
  `#ab-size` carried `margin-left:auto`, pinning Size / View to the right edge
  so they would not slide when Tree view removes the filter sections — but that
  turns every pixel of leftover width into a gap, and it widened further when
  the app buttons left the ribbon. The Tree section now reserves the width the
  filters occupied instead, measured from the real groups, so the ribbon packs
  left with even 11px gaps *and* Size still holds its place across the switch.
- **The ribbon grew a nearly-empty second row on narrower windows.** Theme,
  Support and Help were the ribbon's last group and so the first thing to wrap:
  below roughly 1500px they took a whole row to themselves, spending 50px of
  chrome on three icon buttons and leaving a wide empty band under the filters.
  They now sit at the right of the tab row, which is always rendered and always
  has room there, so the ribbon is a constant 149px at every width.
- **The editor got out of the poster's way.** While editing, the File
  controls (File / Save / Saved-to / undo / redo / Swap to notebooks)
  ride in the toolbar as a normal group — the docked panel head had read
  as a permanently-open File menu. The panel keeps only the slide strip,
  and posters drop it entirely: a poster is one page and needs no
  slides, so it now runs edge to edge. The fourteen always-visible
  colour swatches collapsed into two popup buttons (Text ▾ / Fill ▾)
  that open on demand and close on pick. Verified with real
  screenshots: a poster with a selection now shows two toolbar rows and
  the page fills everything below them.
- **Directive shorthand: `#(t)` and friends.** Every `#| key: value`
  directive now has a bracket spelling — `#(t)` title, `#(c)` caption,
  `#(s)` section, `#(i)` id, `#(d)` depends and the rest, full names in
  brackets too, both spellings mixable. `#()` continues the previous
  directive on a wrapped line, and repeating `#(c)` starts a deliberate
  new caption line — a repeated `#| caption:` used to silently OVERWRITE
  the first line.
- **The poster editor was reviewed adversarially and hardened.** The page
  background survives reloads (it was stripped on every load path — a
  saved white poster reopened navy and would have PRINTED navy); template
  and default text no longer bake an inline white (white posters showed
  white-on-white, i.e. nothing); placeholder frames, captions, hints and
  the title-slide eyebrow all recolour on light pages; the standalone
  export waits for MathJax (raw TeX could ship in the file) and no longer
  distorts page aspect on screen; print and export can no longer tear
  down each other's pages; the dpi warning measures the drawn image, and
  re-checks after every edit (it used to vanish on the first drag); Trim
  steppers commit ONE undo entry per gesture instead of one per
  keystroke.
- **Selecting something no longer shrinks the poster.** The contextual
  format groups now REPLACE the Insert group (PowerPoint's
  contextual-tab move), so the toolbar keeps its two rows and the canvas
  keeps its size. Long template headings ("2 · Data & methods") were
  shortened so nothing wraps onto the text below it.
- **Insert → Line, and a properly iconed toolbar.** A horizontal rule —
  the poster section divider — inserts with one click and reroutes by
  its endpoints; under the hood it is an arrow with no head, so colour,
  width, dash, lock and the Objects pane all apply. The editor's insert
  buttons (Notebook cell, Text, Arrow, Line, Shapes, Image, QR) and the
  Present/Layouts/Page/Objects controls now carry real SVG icons in the
  app ribbon's stroke style instead of mismatched unicode glyphs — and a
  new build-time guarantee that every icon token substituted caught the
  "Match document" button's icon, which a line-wrapped tag had silently
  swallowed since it shipped.
- **Posters can finally be printed.** The page has its own background
  now (File → Page background): pick white and the whole chrome — text
  boxes, frames, page numbers — recolours for dark-on-light, and the
  export prints white instead of the app's navy. New posters start
  white, because posters exist to be printed. Explicit per-item colours
  are never touched.
- **File → Export standalone HTML.** One self-contained .html anyone can
  open without Junoview — styles inline, every figure a data: URI. It
  reads as stacked pages, arrow keys step through slides, and Ctrl+P in
  the exported file prints at true page size. "Send me the slides" is
  now one button plus one attachment.
- **Poster figures warn before they print fuzzy.** On poster pages, any
  raster figure whose effective density lands under 150 dpi gets a small
  ⚠ chip with the fix in its tooltip (savefig(dpi=300), or emit SVG —
  which is vector and never flagged). The poster hall is the wrong place
  to discover a soft figure.
- **The crop menu gained the rectangular Trim it always deserved.** The
  t/r/b/l inset lived in the model with no UI; now four steppers in the
  crop menu trim whitespace off any figure or image — the most common
  poster edit — live on the selection, with Reset.
- **Insert → QR code.** A self-contained QR generator (no third-party
  service, byte mode, ECC M, up to ~200 characters) emits crisp vector
  SVG sized for print. Machine-decode-verified across all supported
  sizes. Point it at the repo the poster footer already promises.
- **Keyboard shortcuts, advertised where you'd look for them.** The
  document view: `P`/`M`/`C`/`O` cycle the four filters, `R` raw view,
  `T` tree, `F` presents full screen, `+`/`−`/`0` size figures,
  `Ctrl+B` toggles the sections sidebar, `Ctrl+O` opens a notebook, `?`
  opens Help. The deck editor adds `F5` to present (PowerPoint) and
  `+`/`−`/`0` page zoom beside its existing Ctrl+Z/Y/D/G and arrow
  nudges. A shortcut fires its button, so behaviour can never drift —
  and every one shows as a key chip in that button's hover tooltip,
  with a full reference table in Help.
- **The poster editor was starving its own canvas.** Its toolbar kept six
  hidden contextual format groups IN the layout (invisible, to avoid a
  height jump on selection), and poster mode inflated every button — so
  the invisible chips wrapped into a ~430px dead band and an A0 portrait
  rendered ~300px wide, pushed into a corner. Poster chrome now keeps the
  slide density, hidden groups leave the layout (the two-row min-height
  still steadies the common case), and the page re-fits itself whenever
  the toolbar's height changes.
- **Trackpad pinch zooms the poster, not the browser.** A pinch (or
  ctrl+scroll) over the editor's canvas rescales the page around the
  cursor — same 25%–600% range as the −/Fit/+ buttons — and is swallowed
  over the rest of the editor so the app never browser-zooms mid-edit.
- **A hidden presentations rail kept a way back from the editor.** Both
  the reveal tab and the auto-hide peek slid in UNDER the full-screen
  editor, so entering a poster with the rail hidden left no visible exit
  ("you kind of lose the side bar"). Both now ride above it.
- **Placing cells on a poster no longer nags.** In the docked
  swap-to-notebooks view, a clicked card lands in the first empty frame
  (reading order) when none is armed — poster templates ship full of
  placeholder frames, and demanding a frame selection before every click
  made the flow feel broken. An armed frame still wins; a full page asks
  you to pick a frame to replace.
- **A figure that titles itself in code now names its card.** With no
  `#| title:` and no leading `#` comment, a figure cell whose code calls
  `fig.suptitle("…")`, `ax.set_title("…")`, `plt.title("…")` or passes a
  literal `title=` (plotly express, pandas/xarray `.plot`) takes that
  string as its card title — the plot's own name beats a function name or
  an echoed code line. `suptitle` wins over axes titles; several distinct
  axes titles name no one card; f-strings and variables are skipped
  rather than guessed. A plot-call title also counts as *titled* for the
  labelled/unlabelled filters.
- **The Jupyter widget silently lost half its stylesheet — including the
  card-header layout.** The widget scopes core.css under `.snb-root` with
  a hand-rolled scanner that was quote-aware but not comment-aware: an
  apostrophe inside a comment ("the scrollbar's width") opened a phantom
  string that swallowed every rule until the next quote. Whole stretches
  of CSS vanished, so in JupyterLab the card headers stacked — badge,
  then title, then the Plot-trace / eye actions on their own line at the
  left — instead of one row with the actions pinned right. Comments are
  now stripped before scanning, and tests pin the scoped output.
- **Plots AND code can be filtered by whether the author labelled them.**
  A cell counts as *titled* when it carries a `#| title:`, a
  `#| caption:`, or a leading `#` comment heading — names derived from
  the code (a function name, a first line) do not count. When a notebook
  has both kinds, the Plot-types and Code-types menus list
  titled/untitled rows alongside their other types — count plus the same
  On/Fold/Off cycler as every other row — so "only show plots I gave a
  title" is one click: untitled → Off. Something under both a type state
  and a label state follows the stricter of the two.
- **No ribbon words disappear, ever.** The compaction stage that hid the
  On/Fold state words was "confusing without these" — it is gone. The one
  remaining stage tightens spacing only; below that the bar scrolls.
- **All three type menus are now tri-state.** Code types and Plot types
  work exactly like Output types: every row shows "name (count)" and its
  own On / Fold / Off cycler, every menu has its own "Reset: match …".
  A code type's Fold folds those cells' code behind its toggle; a plot
  type's Fold collapses that library's figures to slim stub strips that
  open in place; a plot type set to On shows even while Plots is Off.
- **The ribbon now fills its row.** Packed-left groups on a laptop ended in
  one dead gap before the App buttons and read as broken. Capped flexible
  spacers beside each divider distribute the leftover width, so the
  sections spread evenly at laptop widths; on a huge monitor the caps keep
  the groups from drifting apart and the slack pools before the
  right-pinned App group. Under pressure the spacers collapse first, so
  the never-wrap compaction is unaffected.
- **Per-type output filters hardened after an adversarial review.**
  Switching tabs now closes every filter picker — a menu left open across
  a tab switch (tab ✕, or browser back/forward) kept the old notebook's
  rows and wrote its overrides into the new notebook's state. An override
  for a type no longer in the notebook (saved layout, re-run notebook)
  now still shows as a row with count 0 and keeps "Reset: match Output"
  enabled — it used to become invisible and unclearable while still
  forcing per-output rendering; the reset also clears the whole notebook,
  not just the sections "Apply to" targets. Setting or resetting per-type
  states no longer snaps shut outputs the reader had opened. And the whole
  menu row cycles its type's state, as the old full-row checkbox did.
- **The ribbon compacted to bare icons and stuck that way.** Two faults in
  the first never-wrap design: its last resort stripped button labels to
  icons ("makes no sense to look at" — a ribbon fits by being DENSE, the
  PowerPoint way, not by deleting names), and the fit ran before the web
  fonts loaded, so the fallback font's wider text over-compacted the bar at
  full width and nothing ever re-measured it. Now the ribbon is dense by
  default (28px buttons, tighter type and gaps), the compaction stages only
  tighten spacing and drop the "On/Fold" state words — labels can never
  disappear — and the fit re-runs when the fonts land. Past the last stage
  the bar scrolls sideways; icons-only is gone for good.
- **Hiding "Dataset" in the Output-types menu did nothing.** xarray's repr
  ships its own stylesheet inside the output, declaring
  `.xr-wrap{display:block !important}` — and junoview's wrapper shared that
  class name, so the menu's hide rule lost the cascade fight and the card
  stayed fully visible (dataframes, with no embedded CSS, hid fine, which
  made it look random). The wrapper is now junoview-owned (`jv-xr`) and the
  hide rule is scoped + `!important`, so no payload stylesheet can override
  the filter again.
- **Each output type now has its own On / Fold / Off.** The Output-types
  menu lists only the types actually in the ACTIVE notebook (it used to
  scan every open tab) with a count per type — "dataset (3)" — and every
  row carries a small tri-state cycler. Set one and that type stops
  following the overall Output filter: fold just the datasets, keep the
  prints, hide the errors. A folded output leaves a slim per-output stub
  that reopens just itself, and "Reset: match Output" puts every type back
  under the overall filter. The Code-types and Plot-types menus gained the
  same active-notebook scoping and counts.
- **The ribbon could still wrap onto a second row — now it never does.** On a
  narrower laptop the View group (and everything after it) spilled onto a new
  line, spending a whole extra band of chrome and squeezing the notebook. The
  bar no longer wraps at all: `fitRibbon()` compacts it in stages until it
  fits — first the filter state words go (the dot still shows each state),
  then every label (icon-only buttons, tooltips carry the names), then the
  stepper captions and dividers. Only a window too narrow even for icon-only
  buttons scrolls the bar sideways; a second row is never an option. Theme,
  Support and Help move back from the tab row into the ribbon as a labelled
  App group at its right end — floating over the tab strip they read as lost,
  and with the bar unable to wrap they cost nothing there.
- **The welcome hero could be sliced off at the top.** It is centred with
  `justify-content:center`, which on a short window overflows its box *equally*
  in both directions — and the top half lands above the scroll container's
  origin, where nothing can scroll to it. The logo lost its upper half. Now
  centred with `safe center`, which falls back to flex-start when the content
  does not fit.

### Fixed — packaging and tooling

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
