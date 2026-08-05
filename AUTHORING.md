# Authoring a notebook for Junoview

[← back to the README](README.md)

How to annotate a notebook so Junoview can read its structure.
Everything here is optional -- a notebook with no directives at
all still renders, using the inference rules at the bottom.

---

You annotate cells with `#| key: value` **directive lines at the very top of a
code cell**. They are parsed and then stripped from the displayed source.
Everything is optional — with no directives at all the renderer still infers a
sensible layout from each cell's outputs.

## Directives

| Directive       | What it does                                                         |
|-----------------|----------------------------------------------------------------------|
| `#| section:`   | Start a top-level section (also doable with a Markdown `##` heading). |
| `#| subsection:`| Nested group inside the current section.                             |
| `#| title:`     | Human title for the card. Otherwise inferred from the code: a leading `# comment` heading, then the plot's own title (`fig.suptitle`, `ax.set_title`, `plt.title`, or a literal `title=` keyword), then function names. |

**Shorthand.** Every directive also has a bracket spelling — a short key in
brackets, no colon: `#(t)` title, `#(c)` caption, `#(s)` section, `#(ss)`
subsection, `#(i)` id, `#(d)` depends, `#(g)` group, `#(o)` order. Full names
work in brackets too (`#(display) figure`), and the two spellings mix freely.

**Multi-line captions.** `#()` continues the previous directive on a wrapped
line (joined with a space); repeating `#(c)` starts a deliberate new caption
line:

```python
#(t) Composite Z500 anomaly
#(c) Averaged over all blocked days,
#()  1980–2020.
#(c) Shading: anomaly (m). Contours: climatology.
plot()
```
| `#| display:`   | Card type: `figure` `dataset` `transform` `diagnostic` `metric` `text` `code` `hidden`. |
| `#| code:`      | Default code visibility: `hidden` (default) or `show`.              |
| `#| id:`        | Stable slug for this cell — makes it a node in the provenance graph. |
| `#| depends:`   | Comma-separated `id`s this cell derives from — draws the graph edges.|
| `#| caption:`   | Interpretation text / what to look for, shown under the output.     |
| `#| group:`     | Merge several cells into **one** card (alias: `tag:`).              |
| `#| order:`     | Sort this cell within its group (integer; defaults to appearance).  |
| `#| step:`      | Label this cell's chunk in the folded code.                         |
| `#| stack:`     | Fold the code of cells with these `id`s under this card; reusable.  |

## A figure cell

```python
#| display: figure
#| id: block_comp
#| depends: anom, block_freq
#| title: Composite Z500 anomaly on blocked days
#| caption: The localised positive centre is the blocking high.
comp = z_anom.sel(time=blocked).mean('time')
comp.plot(cmap='RdBu_r')
```

This renders as a figure card titled "Composite Z500 anomaly on blocked days",
with the caption beneath it, the code tucked behind a **Show code** toggle, a
`derives from anom · block_freq` provenance line, and a node in the rail graph
wired to the `anom` and `block_freq` nodes.

## Grouping several cells under one figure

A figure is usually the last step of a small pipeline — regrid, composite,
plot. Give those cells the same `#| group:` name and they collapse into a
single card: the cell that draws the figure is the face, and the prep folds
behind one **Show code** toggle as numbered steps.

```python
#| group: fig_zonal
#| order: 1
#| step: zonal mean + 30-day smoothing
zm = z_anom.mean('lon')
zm_mon = zm.rolling(time=30, center=True).mean().resample(time='1MS').mean()
```

```python
#| group: fig_zonal
#| order: 2
#| step: plot Hovmöller
#| display: figure
#| id: zonal_hov
#| depends: anom
#| title: Zonal-mean Z500 anomaly (time–latitude)
zm_mon.plot(x='time', cmap='RdBu_r')
```

Both cells become the one **zonal_hov** card. Notes on the merge:

- **Face** = the cell with `display: figure` (or, absent that, the last cell
  that produces an image / any output). Its output is shown; the others' code
  folds underneath, and any *intermediate* output (a printed shape, a repr)
  is tucked under its own step.
- **Title / caption / id** come from the group — the first member that sets
  each wins, preferring the figure cell.
- **`depends`** is the union across all members, so the prep cell's inputs and
  the plot cell's inputs both feed the one node. The group is therefore a
  **single** vertex in the provenance graph — grouping declutters the graph as
  well as the page.
- **Section / subsection** is taken from where the group's first cell sits (a
  `##` / `###` heading above it, or a `subsection:` on that cell).

`step:` is the clean way to label a chunk; `subsection:` on a grouped member
is also accepted as a chunk label, to match the obvious shorthand.

## Stacking shared cells under a figure (reuse)

Grouping is *push* — each cell tags itself into one group, so a cell can only
live under a single figure. When the same prep feeds **several** figures
(opening the data, regridding, a shared plotting helper), use `#| stack:`
instead. A figure names the upstream cells by `id`, and they fold in front of
its own code:

```python
#| id: maphelper                 # define the shared cell once
#| step: shared map helper
def plot_anom_map(da, ax, title, vmax=None):
    ...
```

```python
#| display: figure
#| id: block_comp
#| depends: anom, block_freq
#| stack: maphelper              # ← fold the helper under this figure
comp = z_anom.sel(time=blocked).mean('time')
pc = plot_anom_map(comp, ax, 'Blocked-day composite')
```

```python
#| display: figure
#| id: enso_comp
#| depends: anom, nino34
#| stack: maphelper              # ← and under this one too (same cell)
pc = plot_anom_map(tele, ax, 'Warm-phase composite')
```

`maphelper` now folds in as step 1 of **both** composite cards. Key points:

- A cell named in any `stack:` list is **consumed**: it gets no card of its
  own and no graph node — it lives only under the figures that stack it. The
  same id may be stacked under any number of figures.
- Stacked cells render **before** the card's own code, in the order listed;
  the figure's own code is the final step. Use `#| order:`-style intent by
  ordering the ids in the list.
- Stacking folds **code only**; it does *not* add provenance edges. Use
  `depends:` for lineage you want drawn in the graph.

### group vs stack — which to use

| | `group:` (push) | `stack:` (pull) |
|---|---|---|
| Who references whom | each cell tags itself | the figure names cells by `id` |
| Cell can belong to | one card | any number of cards |
| Best for | a few adjacent cells authored as a unit | shared prep reused across figures |
| Standalone card | merged away | consumed (no card, no node) |

A useful split to remember: **`depends:` keeps a cell as its own node in the
graph; `stack:` folds its code into a figure and collapses it.** One is about
scientific lineage, the other about reproducibility of a single figure.



A Markdown cell whose first line is a heading opens structure:

```markdown
## Blocking diagnostics      ← H2 opens a section
### Regional composite       ← H3 opens a subsection
```

Any prose under a heading (or any plain Markdown cell) becomes an
**interpretation note** — rendered in a serif face to set human commentary
apart from machine output.

You can mix styles: use `##` headings for some sections and `#| section:` on a
code cell for others. The example notebook does both.

## What happens with no directives

| Cell produces…            | Inferred card |
|---------------------------|---------------|
| an image                  | `figure`      |
| an xarray HTML repr        | `dataset`     |
| only short text / stdout   | `metric`      |
| longer text                | `text`        |
| no output                  | `code` (collapsed) |

So an un-annotated notebook still renders cleanly; directives are how you take
control — naming diagnostics, writing captions, and declaring the provenance
graph with `id` / `depends`.

---

[← back to the README](README.md)
