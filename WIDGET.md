# The Jupyter widget

[← back to the README](README.md)

The in-Jupyter view: the same figure-first rendering, but against
a live kernel, with view state that persists back to Python.

---

The static page is for sharing — one self-contained file, no Jupyter needed.
When you want to *explore*, `SemanticNotebook` renders the same figure-first
view **inside a notebook**, against the live kernel. It imports the same parser
and the same card HTML from `junoview`, so the directive format and the
look are identical; it just adds the two things a dead file can't do.

```python
from junoview.widget import SemanticNotebook

view = SemanticNotebook.from_ipynb("analysis.ipynb")   # an executed notebook
view
```

**1 · View-state that persists back to Python.** Hide a card (hover → ✕), switch
the layout (Column / Grid / Compact), or collapse the graph, and the choices are
synced to the kernel:

```python
view.view_state          # -> {'hidden': ['enso_spec'], 'layout': 'grid', ...}
view.export_html("clean.html")   # static page with hidden cards dropped
```

`export_html` is the bridge back to the shareable artifact: arrange it live,
then export a clean page.

**2 · Live recompute.** Attach a function to a figure `id`; its parameters
become controls, and changing them re-runs the function on the kernel and swaps
that figure in place. Every other figure stays static.

```python
@view.recompute("block_comp",
                threshold=(0.5, 2.5, 0.1),       # slider
                region=["Tasman", "Ross", "Weddell"])   # dropdown
def _(threshold, region):
    box = z_anom.sel(**REGIONS[region]).mean(["lat", "lon"])
    comp = z_anom.sel(time=box > box.std() * threshold).mean("time")
    fig, ax = plt.subplots()
    plot_anom_map(comp, ax, f"{region} composite")
    return fig          # return a matplotlib Figure (or just draw one)
```

Parameter shorthands:

| you write | control |
|-----------|---------|
| `(lo, hi)` or `(lo, hi, step)` | slider |
| `["a", "b", "c"]` | dropdown |
| `5` / `1.5` | number box |
| `True` | checkbox |
| `"text"` | text box |
| `{"type": "range", "min": …, "max": …, "value": …}` | full control |

The recompute function closes over your kernel namespace, so it can use the same
variables and helpers your analysis already defined (`z_anom`, `plot_anom_map`,
…). [`examples/example_widget.ipynb`](examples/example_widget.ipynb) is a
complete runnable example with one live composite figure.

Constructors: `SemanticNotebook.from_ipynb(path)`, `.from_notebook(nb)` (an
`nbformat` object), or `SemanticNotebook(document=…)` if you already parsed one.
`height=` sets the panel height.

**Requirements / notes.** Needs `anywidget` and `ipywidgets` (`pip install
anywidget`). Runs in JupyterLab, Notebook 7, VS Code, and Colab. Fonts load from
Google Fonts, and recompute needs a live kernel — so both only show up when you
actually run it in Jupyter, not in a previewed `.ipynb`. The widget CSS is
scoped to a private root so it can't bleed into the rest of your notebook.

---

[← back to the README](README.md)
