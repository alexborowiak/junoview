# Presentations: slide decks and posters

[← back to the README](README.md)

Building slide decks and conference posters out of notebook
cards, and where those presentations are saved.

---

Click a **▶ presentation** in the left rail to open that deck in the
**builder** (below); the **&#9654; Present** button at the top of the
panel plays the deck full-screen — arrow buttons / arrow keys to move,
`Esc` or **&#10005; Exit** to drop back to the builder, **Docs** to
leave altogether. The rail's **Documents** button returns to the
documents from anywhere. With nothing saved yet you get *auto: figures*
— one full-screen slide per figure, in document order.

**The deck has two axes.** Horizontal (←/→) is your story. Vertical is
the **code trail**: on any slide whose frames carry code, a ↓ arrow
(and *"↓ how it was made"* hint) appears — press it (or `ArrowDown`)
to descend through every cell that produced what's on screen, one cell
per step, in execution order: *open data → transforms → the plot
itself*. ↑ climbs back; `Esc` returns to the slide; ←/→ leave the
trail and continue the story. The counter shows where you are
(`3 / 8 · code 2 / 5`).

The trail is the union of your declared `depends:` edges and
**automatic variable tracing**: the renderer parses each cell's code
and links a figure to whichever cells last assigned the variables it
reads, so even un-annotated notebooks get the full lineage. (Static
best-effort: it can't see mutation without assignment, e.g.
`ds.load()`; declare `depends:` where the trace misses something.)

## Create mode

The builder docks full-height beside the presentations rail with the
real document view next to it — the tab row and filters shift right to
sit above the document. **&#9654; Present** at the top plays the deck;
**Documents** in the rail (or `Esc`, or **✕ Close**) exits back to the
documents. You build slides by pointing at the document:

- **+ Add slide**, then pick a layout from the diagram buttons:
  **full**, **halves** (side by side), **rows** (stacked), **quarters**,
  a **title slide**, or a **blank canvas** (dashed icon) that you compose
  entirely in ✎ Edit with text, arrows, boxes and notebook cells.
  Title/subtitle can be typed in the panel or — in ✎ Edit — right on the
  slide, where they are movable text objects like everything else.
- Click a pane in the layout diagram, then **click a card in the
  document** to place it there; the next empty pane is selected
  automatically, and ✕ on a pane clears it. Figure panes show a faint
  live preview of their image.
- The filmstrip shows PowerPoint-style thumbnails of every slide with the
  actual content — scaled-down figures, text stripes for markup — click
  to select, ↑ ↓ to reorder, ✕ to delete.
- **✎ Edit slide** opens the slide in the document area (the builder
  stays on the left, tabs above) with drawing tools — **+ Text** (click
  to place a text box, type straight into it), **+ Arrow** and **+ Box**
  (drag to draw), **+ Cell** (below), **Select** to move things (text
  moves by its ⠿ handle) and **Delete** / `Del`. Selecting any item
  reveals a **format bar**: six colours, text size **A− / A+**, line
  thickness, **Dash**, **Fill** for boxes, **Bg** to strip a text box's
  background. Everything is stored with the slide in percent
  coordinates, so it scales with the screen and shows in playback.
  **Done** or `Esc` returns to the builder.
- **+ Cell** places a draggable, **resizable** frame that says *"Click
  to add from notebook"* — clicking it flips you back to the notebook
  view with a picker banner; click any card and you're returned to the
  editor with it placed in the frame. Hovering or selecting a filled
  frame shows **⇄ Replace** right on the frame (also in the format bar)
  to swap in a different card, from any open notebook.
- Everything else lives in the **File ▾** menu: *New presentation*,
  *Rename*, the two auto-builders (*figures* / *figures + docs*, in
  document order), *Save to notebook*, *Download JSON* and *Discard
  changes*.

Markdown cards render with bullets/bold and **LaTeX equations**
(`$...$`, `$$...$$`, typeset by MathJax — needs internet on first view),
so "figure with its equations beside it" is a *Halves* slide: the figure
in one pane, the markdown card in the other.

Edits autosave as a **draft** in the browser (`localStorage`), per
presentation — refresh and nothing is lost; the status pill shows
*auto / saved / unsaved draft*, and *Discard* reverts to the saved copy.

## Presentations across notebooks

Projects usually span several notebooks, so the deck works across **all
open tabs**: the tab strip stays visible in Create mode — switch tabs
while building and click cards from any notebook; a *Halves* slide can
show a figure from `part1` next to a figure from `part2`. When more than
one notebook is open, panes and slides carry a small chip naming the
source notebook, and the auto-builders walk every tab in order.

Internally a pane in a multi-notebook deck is stored as
`<notebook>::<anchor>`; single-notebook decks keep plain anchors, so
everything stays compatible with the classic sidecar / embed flow below.
If a slide references a notebook that isn't open, the pane says so and
comes back when you reopen the tab.

## Named presentations, saved where you work

Multiple **named presentations** — each one is a ▶ item in the left
rail; **New** starts one, *File → Rename* (or clicking the name in the
builder) renames it. Saving routes:

1. **App mode: autosave to project** (default on) — every change is
   written to `junoview_project.json` in the app's root folder about a
   second after you make it, alongside your open-tab session. Toggle it
   with *File → Autosave*; with it off, *File → Save to project* saves
   manually. *File → Delete presentation* removes one.
2. **Download / Load deck JSON** (everywhere, including the web
   version) — *Download JSON* saves the deck as a file on your machine;
   *Load deck JSON…* imports it back, later or on another computer. In
   the web version, edits also autosave as browser drafts, so a normal
   reload never loses work. A sidecar `<notebook>.deck.json` placed
   beside a local `.ipynb` auto-loads; bake one in with
   `junoview nb.ipynb --embed-deck nb.deck.json`, or
   render with a project file via `--deck project.deck.json`.
   (Direct save-into-.ipynb from the browser exists in the code but is
   currently disabled.)

Slides reference cards by a **stable anchor** — the cell's `#| id:` if it
has one, else the notebook's built-in cell id (nbformat ≥ 4.5) — never by
position. Reordering, editing or adding cells does not break the deck;
deleting a referenced cell just skips that slide with a note. Prefer
`#| id:` anchors: they also survive copy-pasting cells between notebooks.

**Saved decks are self-contained.** Every deliberate save (*Save* to a
file or the project, *Download a copy*) also writes each placed card's
rendered content — figures included — into the deck itself. Open the
file on another machine, with the notebook missing, or with no internet
to re-fetch a URL notebook, and every frame still shows. The notebook
remains the source of truth: whenever it is open, frames render live and
the next save refreshes the stored copies; when it isn't, the frame
shows the copy and (in the editor) carries a small *saved copy* chip.
**Check** on the ribbon lists any frame presenting from its copy — or
one that has no copy at all and would present blank.

`--deck other.json` renders with a specific deck file (overrides the
sidecar and the embedded metadata).

---

[← back to the README](README.md)
