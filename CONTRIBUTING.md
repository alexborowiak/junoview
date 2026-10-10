# Contributing

Thanks for looking. This is a small project and PRs are welcome — bug reports
with a notebook that reproduces the problem are especially useful.

## Getting set up

```bash
git clone https://github.com/alexborowiak/junoview
cd junoview
pip install -e ".[dev]"
```

That is the whole setup. There is no build step, no bundler and no Node
toolchain: the CSS and JavaScript are plain files that get read and inlined at
render time.

Check it works:

```bash
pytest
junoview examples/example_climate_analysis.ipynb   # writes an .html next to it
junoview                                           # launches the local app
```

## Finding your way around

Read [ARCHITECTURE.md](ARCHITECTURE.md) first — it explains the one seam that
matters (`Document`) and gives a twenty-minute reading order. The short version:

- `src/junoview/notebook/` — reading notebooks and working out what they mean
- `src/junoview/render/` — turning that into HTML
- `src/junoview/assets/` — the CSS/JS/HTML, as real files
- `src/junoview/server/` — the local app

## Changing the frontend

`assets/css/*.css` and `assets/js/*.js` are ordinary files. Edit them, re-render
a notebook, reload. There is no build step and no minification.

Two of the HTML assets (`page.html`, `shell.html`) are `str.format` templates —
their `{placeholders}` are filled in by `render/page.py`. The stylesheets and
scripts are not templates, so their braces are left alone. Don't make a
stylesheet a template.

## Tests

```bash
pytest                    # everything
pytest tests/test_directive_shorthand.py -v
```

### What the suite actually is

Be clear-eyed about this before you trust it: **roughly 72% of the assertions
are substring checks against the rendered HTML** — `assert 'id="tv-plots"' in
out`. They came from a single `_self_test()` function that grew alongside the
UI, one assertion per decision, and they were carried across verbatim.

That makes them good *regression* tests and poor *specification* tests. They
will tell you that you changed something; they will rarely tell you that what
you built is correct. So:

- If one fails, the question is "did I mean to change this behaviour?" — not
  "how do I make the assertion pass". Many carry a comment explaining why the
  behaviour exists; keep those, and add one when you pin something new.
- When you add real logic, prefer a test that calls the function and checks its
  return value over one that greps the page for a class name. The suite needs
  more of those, and new code is the cheapest place to add them.

`tests/test_characterization.py` is the backstop: it renders the example
notebook and compares against a recorded hash, so any unintended change to the
output shows up immediately. When you change the output *on purpose*, update
`EXPECTED_MD5` in the same commit and say in the message what changed and why.

### The speed guard

The app has twice become laggy one innocent-looking feature at a time, and
nothing failed while it did. Two halves now stop that:

- **Static, in every run of the suite.** `tests/test_speed_guard.py` and
  `tests/test_style_recalc.py` fail on the patterns that caused the lag:
  `:has()` on `body`/`html` or looking at the descendants of a big container,
  a page-wide `[contenteditable]` or `.vo-fmenu` query, the slide strip
  emptied and rebuilt, MathJax called anywhere but through `jvMath`.
- **Timed, opt-in.** `tests/test_speed_guard_in_a_browser.py` drives the real
  app in Chromium at 4x CPU throttle: the example notebook loads, a 60-slide
  deck opens, and load, opening the deck, select, deselect, slide change,
  undo, add slide, a ribbon tab, notebook-to-deck and start show are each
  timed (median of three) against a budget about twice what they cost when
  the budgets were set (load and the ribbon tab a little tighter). The slide
  strip must come through all of it with its rows, not rebuilt. About a
  minute (Playwright is not in `.[dev]`; the test skips without it):

  ```bash
  pip install playwright && python -m playwright install chromium   # once
  JUNOVIEW_BROWSER_TESTS=1 python -m pytest -q -s tests/test_speed_guard_in_a_browser.py
  # PowerShell: $env:JUNOVIEW_BROWSER_TESTS='1'; python -m pytest -q -s tests/test_speed_guard_in_a_browser.py
  ```

  `-s` prints the table of every number against its budget. Run it before
  merging anything that touches the editor, the strip, the ribbon, loading or
  switching. It never touches the network (MathJax is a stand-in unless
  `JUNOVIEW_MATHJAX_DIR` points at an unpacked `mathjax@3.2.2/es5`).
  `JUNOVIEW_SPEED_REPORT=out.json` writes every run; a machine known to be
  slower than the one the budgets were set on can set
  `JUNOVIEW_SPEED_SCALE=1.5`.

**When it fails**, the message is the table with the gestures `<-- OVER`.

1. Believe it. A gesture over budget has already been measured a second time
   before the test fails, and budgets are about 2x: noise does not get there,
   the regressions it is for do (the code from before the speed work, 2-12
   times slower than today depending on the gesture, fails every budget).
2. Confirm it is yours: run the guard on the commit before your change. Then
   profile the gesture -- Chrome DevTools, Performance panel, CPU 4x slowdown --
   and look for the usual causes: a query over the whole document, a list
   emptied and rebuilt instead of reconciled, layout read inside a loop that
   writes, an inherited custom property written on `html` or `#deck` while
   dragging, work done at load that could wait for first use.
3. Fix the cause. Do not raise the budget to make it pass, and do not add an
   exception to a static guard: use what the guard points to (`liveEditors()`,
   `voMenusLive()`, `filmReconcile`, `jvMath.typeset`/`jvMath.run`, a state
   class its owner sets).
4. Only if the slower gesture is the deliberate price of a feature: run the
   guard five times with `JUNOVIEW_SPEED_REPORT`, set that budget from the
   new median the way the comment above `BUDGETS` says the others were set
   (about twice it), and say in the commit message which gesture got slower,
   by how much and why.

## Style

- Python 3.10+, standard library only in the core.
- The house style is 79 columns and most of the code sits there; the linter
  allows up to 88 so a few pre-existing long lines don't need rewrapping.
  Match the lines around you.
- `ruff check .` and `mypy` should both be clean. CI runs both.
- The package ships a `py.typed` marker, so your annotations become part of the
  contract downstream users type-check against. Annotate new public functions.
- Comments should say *why*, not *what*. The existing code is good about this;
  please match it.
- No new runtime dependencies without discussing it first. "Pure stdlib" is a
  feature — it is why the browser build works at all.

## Housekeeping

Headless-browser test runs leave profile directories in the repo root. They are
gitignored, but they add up:

```bash
python tools/clean_scratch.py         # list what would go
python tools/clean_scratch.py --yes   # delete it
```

## Publishing the web build

`docs/` is a **generated** GitHub Pages build, committed so Pages can serve it.
Regenerate it rather than editing it by hand:

```bash
junoview --build-web docs
```

The archive it writes is deterministic, so rebuilding without source changes
produces no diff.
