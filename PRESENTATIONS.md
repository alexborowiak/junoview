# Presentations: slide decks and posters

[← back to the README](README.md)

Junoview presentations combine a general slide and poster editor with content
that remains connected to the notebooks that produced it. A deck can also be
created without a notebook, imported from PowerPoint, exported for presenting
elsewhere, or edited from Python.

Nothing in Present mode executes notebook code. Junoview reads the outputs
already stored in the source documents.

## Contents

- [Create a presentation](#create-a-presentation)
- [Add content](#add-content)
- [Lay out and style slides](#lay-out-and-style-slides)
- [Find and fix inconsistency](#find-and-fix-inconsistency)
- [Keep figures connected to notebooks](#keep-figures-connected-to-notebooks)
- [Animate a slide](#animate-a-slide)
- [Organise the talk](#organise-the-talk)
- [Present and rehearse](#present-and-rehearse)
- [Make a conference poster](#make-a-conference-poster)
- [Review and recover](#review-and-recover)
- [Save, share, import and export](#save-share-import-and-export)
- [Edit a deck from Python](#edit-a-deck-from-python)
- [Useful shortcuts](#useful-shortcuts)

## Create a presentation

Use **New** in the application rail to start with a blank presentation. A
presentation opens directly in the slide editor.

There are three other useful starting points:

- **Create slides** beside **Present** in a notebook creates a new presentation
  from the whole notebook, the current section, or pinned and labelled cells.
  Section headings become slide headings and the markdown and figures beneath
  them become slide content. The existing presentation is never overwritten.
- **File → Import .pptx** imports a PowerPoint file as a new presentation.
  Text, shapes, pictures, tables, charts, notes, sections, links and builds are
  imported where possible. Junoview lists anything it could not translate
  before opening the deck and never changes the original file.
- Opening a saved `.junoview` file restores a presentation without requiring
  the original notebook to be open.

Add a slide and choose a starting layout: full, halves, rows, quarters, a
title slide, or a blank canvas. Layouts are starting arrangements, not rigid
containers; every object remains movable and resizable.

## Add content

### From a notebook

Choose **From notebook** on the Images tab, place the empty frame, and then
click the card that should fill it. A frame can contain a figure, markdown,
code or another rendered notebook card. Use **Replace** to point it at a
different card later.

The notebook picker can use any open tab. One slide can therefore compare a
figure from `part1.ipynb` with a figure from `part2.ipynb`, and one deck can
draw from an entire project. Frames identify their source when more than one
document is involved.

### Ordinary slide objects

The editor also provides:

- text boxes, titles, headings, captions, markdown and LaTeX equations;
- rectangles, ellipses, stars, clouds and other shapes;
- straight, curved and elbowed lines with independently styled ends;
- images, tables, charts, freehand drawing, audio and video;
- groups, flip books and reusable components.

Drop or paste an image directly onto the page. Images retain their full-size
originals: cropping changes the view rather than cutting away pixels, so a
cropped export still uses the original resolution.

Text boxes support ordinary rich text, bullets and numbering. As in
PowerPoint, a bullet belongs to a paragraph: List, Numbered, Tab and
Shift+Tab (or Indent and Outdent) act on the paragraph(s) you are typing in,
and with the box selected on every paragraph in it; **Paragraph ▾ > Box
indent** is the one control that moves the whole box. Type LaTeX
between `$...$` or `$$...$$`, or use the equation editor and its symbol
palette. Equations are baked into standalone HTML and PDF exports, so those
files do not need a network connection to display the maths.

Audio and video can be trimmed, looped, muted and given a poster frame. Media
is stored with self-contained saves and can play in Present mode, standalone
HTML and compatible PowerPoint exports.

## Lay out and style slides

Dragging snaps to the page, other objects, the grid, guides and equal gaps.
Select several objects to align their edges or centres and to distribute them
with equal spacing. **Tidy page** reports almost-aligned edges, almost-equal
gaps and accidental duplicates; it never moves anything until you accept a
specific fix.

Three matching tools handle repeated layouts:

- **Match slide** makes the current slide follow another slide's geometry and
  appearance while keeping its own words and figures. Click the command and
  then the model slide's thumbnail.
- **Copy layout to slides…** sends the current slide's arrangement to several
  selected slides in one operation.
- **Lay these out like a group I click…** transfers the pattern of a row or
  column to selected objects. Their content and colour stay unchanged.

Use **Copy this look to objects I click…** or **Take the look of an object I
click…** when only appearance should travel. Find and replace can change text
or selected formatting across one slide or the whole presentation.

### Styles and reusable design

Named text styles give titles, headings, body text and captions a shared
definition. The deck also carries shared colours, page colours, corner radius
and spacing values. Objects using those values follow a later deck-wide
change instead of keeping disconnected copies.

A component is a linked arrangement such as a figure and caption, a callout,
or a footer block. Reusing the component carries its geometry and appearance;
each instance keeps its own words and figure. An instance can be detached when
it should stop following the others.

Pin an object to a corner or edge when it should retain that relationship as
the page changes shape. Pinning changes what happens on the next resize; it
does not move the object immediately.

The always-visible **Ribbon layouts** control changes how the editor's tools
are arranged. It does not change the current slide. Right-click the ribbon to
hide or reorder individual controls within the chosen arrangement.

## Find and fix inconsistency

Open **Home → Style system → Check consistency** to find things that look as
though they should agree but do not. The check can report:

- a Heading 1, title or other named text box changed by hand after its style
  was applied;
- one heading or text band with a different size, typeface, colour, alignment
  or spacing from the others;
- headings that change width or jump sideways between slides;
- figure frames with inconsistent size or content zoom;
- different typefaces inside vector SVG figures.

The results are grouped and counted so the exception is visible in context.
Nothing changes automatically: each finding has its own proposed fix, and the
fix is undoable. PNG files do not contain a readable font name, so figure-font
checking applies only to vector figures.

This complements **Match slide**. Consistency checking finds a stray heading
in an otherwise coherent deck; matching deliberately makes one slide take the
arrangement and appearance of a known-good slide.

## Keep figures connected to notebooks

Every notebook frame records the notebook and stable cell id it came from. A
`#| id:` is the strongest anchor because it survives reordering and copying a
cell between notebooks; otherwise Junoview uses the notebook's built-in cell
id.

Right-click a frame and choose **Where this came from** to see:

- the source notebook and cell;
- the cells in the figure's lineage, with links back to them;
- the full plot trace;
- whether the open notebook has changed since the deck's saved copy.

When the notebook has moved on, **Take the notebook's version of this figure**
refreshes the content. Position, size and crop belong to the frame, so they do
not change. Junoview does not run the notebook; re-run it in Jupyter first and
then refresh the stored output.

### Captions, numbering and references

Select a figure and a text box and choose **Make this the figure's caption**.
The caption then moves with the figure and follows its width while remaining
an ordinary editable text box.

A tied caption can contain `{fig}`. References elsewhere can point to the same
figure. Numbers are calculated from the deck's current reading order rather
than stored, so reordering slides updates every caption and “see Figure …”
reference. A reference to a deleted figure says that the target is missing
instead of showing a plausible but incorrect number.

### Saved copies

Self-contained saves include rendered copies of placed notebook cards. If the
source notebook is closed or unavailable on another computer, the saved copy
still presents. When the live notebook is open it remains the source of truth,
and the next save refreshes the stored copy. **Check** reports frames relying
on saved copies and frames that would be blank because no copy exists.

## Animate a slide

The Animation tab gives objects an entrance effect and a click order. A text
box can arrive as a whole, by bullet or by sentence; **Highlight** keeps all
the text visible and emphasises the current step.

Slide transitions and object builds are used in Present mode. Compatible
build timing and transitions are also written to `.pptx`; effects without a
direct PowerPoint equivalent are simplified and reported during export.

## Organise the talk

Sections group runs of slides. A section can be moved or duplicated as one
unit, and headers and footers can use deck-wide or section-local numbering.

Right-click a slide to mark it **optional** or assign it to a named version.
Slides with no version assignment appear in every version. This allows short,
long and audience-specific talks to remain one deck rather than several files
that drift apart.

During a talk, **Running late** or `L` skips every remaining optional slide
from the current point. It does not change the saved version and does not
remove optional slides that have already been shown.

The overview map shows every slide grouped by section, with optional slides
labelled and slides outside the current version dimmed. Use it for navigation;
it is not another editing canvas.

### One talk made of parts

A long talk can be built from shorter presentations, the way a LaTeX document
pulls in chapters with `\input`. Open **File → Parts of this talk…** (also on
the strip's *Thumbnails* menu). It lists the talk as its parts, in order. From
there you can:

- **Add a presentation** you already have, with a preview of its slides.
- Start a **New part**.
- **Make it a part**: move one of the talk's sections into a presentation of
  its own.

Each part is a section of the talk whose slides are that presentation's. They
are locked in the talk. **Edit** opens the part, and while it is open its corner
says which talk it belongs to. Whenever the talk opens, it picks up whatever
changed in its parts. If a part's slides were also changed inside the talk, it
waits for you to press **Update** rather than overwrite them.

The talk stores a copy of every part's slides. Presenting, PDF, `.pptx`, the
standalone page and the Python API therefore see ordinary slides. A talk whose
part cannot be found (a different computer, a deleted presentation) keeps the
slides as last copied.

## Present and rehearse

**Present** plays the chosen version full-screen. Arrow keys and clicks move
through builds and slides. On a slide containing notebook material, the down
arrow opens the vertical code trail: one producing cell per screen in execution
order. Up returns toward the slide, and left or right continues the talk.

Speaker notes support markdown, links and figure references. A link such as
`[method](#7)` jumps to slide 7 in presenter view, while `{fig:id}` prints the
current number of the referenced figure. The larger notes editor shows the
slide, source text and rendered notes together.

Presenter view includes the current and next slide, notes, a clock and search.
Press `/` while presenting to search visible text, captions, tables and speaker
notes; results found only in notes are labelled as such.

A presentation that reaches a second slide and lasts at least half a minute is
recorded as a rehearsal. Junoview keeps recent per-slide and per-section times
on this computer and compares them with the target duration. Rehearsal history
is not included when the deck is shared.

For prompts that the audience must never see, mark an object **Only me**. It
appears in the editor and presenter view with an amber dashed edge but is
excluded from audience playback, PDF and PowerPoint export. It remains inside
the deck file, just like speaker notes.

## Make a conference poster

Choose a real page size, including A-series and large poster formats. The View
tab provides:

- rulers in millimetres;
- a print margin and twelve-column grid;
- draggable guides and resizable guide boxes;
- snapping to edges, centres and equal gaps;
- a side toolbar and full-screen editing for tall pages.

Guides are saved with the presentation but never printed, exported or shown in
Present mode. **Review** checks for low-resolution figures, content outside the
page or inside the print margin, unreadable contrast and empty frames. Crop
marks add the surrounding sheet area without changing the requested finished
page size.

**File → Export PDF** uses the page's true physical dimensions. An A0 poster is
therefore exported as an actual 841 × 1189 mm page rather than a large-looking
screen slide.

## Review and recover

**File → Export for review…** produces markdown containing each slide's words
in reading order, figure sources, captions, notes and timings. It also reports
unreferenced figures, orphan captions, inconsistent terminology and crowded
slides. Private objects are excluded.

**File → History…** records snapshots made when the deck is opened or saved.
Compare any snapshot with the current deck slide by slide; changed, new, gone
and moved slides are identified by slide identity rather than position. Restore
one slide or the whole version. Junoview snapshots the current state first, so
restoring an older state can itself be undone.

Right-click an individual object for **History of this object**. Restoring one
of its earlier states changes only that object and creates an ordinary undoable
edit.

## Save, share, import and export

The Save menu shows where the current presentation lives:

- **Browser** stores and autosaves it in this browser on this machine.
- **A file on your computer** writes a `.junoview` file and remembers the
  chosen file for later saves where browser file access permits it.
- **This project** in the desktop app stores the deck in
  `junoview_project.json` beside the open-tab session.

**Download a copy** always produces a portable `.junoview` file. The format is
plain JSON and stores embedded copies of placed notebook content. A sidecar
named `<notebook>.junoview` loads beside its notebook.

Export choices serve different purposes:

- **Standalone HTML** is self-contained and plays without the editor or source
  notebook.
- **PDF** preserves exact appearance, equations and physical page size.
- **PowerPoint (`.pptx`)** keeps compatible text, shapes, tables and charts
  editable, carries notes, links, crops, builds and transitions, and reports
  anything simplified or omitted instead of dropping it silently.

PowerPoint equations are exported as plain text, and a freehand crop has no
equivalent. Use PDF when exact rendering matters more than later editing.

## Edit a deck from Python

The deck file is documented in [DECK-FORMAT.md](DECK-FORMAT.md). The public
Python API can load, inspect and edit it without opening the browser:

```python
from junoview import open_deck

deck = open_deck("talk.junoview.html", name="Conference talk")
deck.slide(3).figures["toe_map"].place(x=8, w=60)
deck.remove_slide(7)
problems = deck.save("talk.json")
```

See [Editing a deck from Python](DECK-FORMAT.md#editing-a-deck-from-python)
for the complete API example and validation rules.

## Useful shortcuts

| Shortcut | Action |
| --- | --- |
| `Ctrl+Z` / `Ctrl+Shift+Z` | undo / redo |
| `Ctrl+C` / `Ctrl+X` / `Ctrl+V` | copy / cut / paste |
| `Ctrl+Shift+V` | paste at the original coordinates |
| `Ctrl+Alt+V` | paste at the pointer |
| `Ctrl+D` | duplicate |
| `Ctrl+Shift+D` | duplicate without the notebook source |
| `Ctrl+G` | group selected objects |
| `Del` | remove selected objects |
| Arrow keys | nudge; hold `Shift` for a larger step |
| `Alt`-drag | clone while dragging |
| `R` / `G` / `H` / `B` | rulers / grid / guides / guide box |
| `/` in Present mode | search slides and notes |
| `L` in Present mode | skip remaining optional slides |
| `Esc` | leave the current tool, dialog or mode |

---

[← back to the README](README.md)
