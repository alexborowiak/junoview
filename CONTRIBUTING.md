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
pytest tests/test_directives.py -v
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
