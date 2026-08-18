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
- **The editing ribbon was rebuilt around groups.** It used to wrap, so a
  group could break across rows: its label landed under whatever happened
  to be beneath it, nothing marked where one group ended, and every
  button was the same size, so a primary action looked exactly like a
  toggle. It is now one row that scrolls sideways when it must — as
  PowerPoint's does — with a divider and one centred label per group, and
  a real size hierarchy: things you came here to *do* (Present, Cell,
  Text, Shapes, Layouts, Check) are large icon-over-label buttons, while
  toggles are small and stacked two-up. The height is now constant, so
  selecting an item can no longer shift the canvas. Two bugs surfaced in
  the rebuild: the empty-group hider only ran over the contextual half of
  the ribbon, leaving *Notebooks* as a label over empty space, and
  `renderPresNbs` sets its label with `textContent`, which silently
  deleted any icon inside the button.
- **Lines and arrows grew up.** Five line styles (solid, dashed, dotted,
  dash-dot, long dash); seven head shapes in four sizes, chosen
  **independently at each end**, so a double-headed arrow is simply a
  head at both; and routes that are straight, curved either way, or
  elbowed round a corner. An arrow's endpoint can be dropped **onto an
  item** to attach it — from then on the arrow follows that item around,
  its ends sliding along the borders as either one moves.
- **Shapes can hold a gradient**, linear at an angle or radiating from the
  centre, alongside plain solid fills.
- **Text can follow a curve.** HTML cannot bow a baseline, so curved text
  is drawn as SVG on a path; click into the box and it straightens while
  you type, because a caret cannot live on a curve. The arch is bounded
  by the box's own height, so it can never escape the page.
- **All of it survives the trip to PowerPoint**, because every style
  carries its canvas rendering and its OOXML mapping in the same table
  and the two cannot be edited apart. Verified in Microsoft PowerPoint:
  gradients arrive as gradient fills, dash presets as dash presets, each
  arrow end with its own head shape, curves and elbows as real curved and
  bent connectors, and curved text as an editable warp rather than a
  picture. Two asymmetries are stated rather than hidden: PowerPoint's
  *downward* arch wraps text round the bottom of a circle the way a badge
  does (the poster and the PDF keep it upright), and its curved connector
  draws its own S-curve rather than reproducing the exact bow.
- **Fixed: a filled shape exported as a solid black box.** `fill` on a
  shape is a *boolean* — "tint with my own line colour" — and the `.pptx`
  writer was handing it to the colour parser, which fell back to black.
- **Text is spell-checked while you edit it.** It was switched off
  everywhere, which meant a typo could travel all the way onto a printed
  A0 poster with nothing ever flagging it. Only *editable* text is
  checked, so Present, print and every export stay squiggle-free.
- **Copy, cut and paste — including from the system clipboard.** `Ctrl+D`
  duplicates in place, which cannot carry an item to another poster and
  cannot bring anything in. `Ctrl+C` / `Ctrl+X` / `Ctrl+V` now move whole
  items between posters (a copied figure frame stays a *live* figure
  frame, not a picture of one), and pasting an image from the clipboard
  drops it on the page at a sensible size — which is how logos and
  screenshots actually arrive.
- **Align, and equal gaps.** Row and Grid re-arrange a selection into a
  formation; what poster work needs constantly is the other thing —
  leave items where they are and make one edge agree. **Align** does any
  edge or centre, and distributes three or more with equal *gaps* rather
  than equal centres, because with different-sized items it is the
  whitespace the eye measures. Dragging now also snaps to a gap that
  matches one you already have, marking both in amber.
- **Guides you draw yourself.** Drag off a ruler to lay one down, drag it
  back onto the ruler to remove it. They belong to the presentation, so
  they are saved and re-open with it — the twelve-column grid covers the
  common case, but a real poster usually has a line or two of its own.
- **A pre-print check.** None of it is new information: the print-dpi
  judgement, the margin, the page bounds and the page background were all
  already known. What was missing was one place that asks them all at
  once, before a poster goes to a shop that will print exactly what it is
  given. **Check** reports soft figures, anything off the page or inside
  the 20mm margin, text below 4.5:1 contrast, and empty frames; click a
  finding to select the item.
- **Crop marks**, for printers that ask for them. The *sheet* grows 5mm on
  every side to hold the marks while the page keeps its exact size — an
  A0 poster is 841×1189mm either way.
- **Fonts beyond the generic five.** Arial, Helvetica, Calibri, Verdana,
  Tahoma, Trebuchet, Times, Georgia, Cambria and Garamond, plus
  *Other…* for any family installed on your machine. One table feeds the
  picker, the canvas and the `.pptx` writer, so they cannot drift apart.
- **The Notebooks button is findable again, and honest.** It used to
  hide until the deck had at least one notebook cell — so on a fresh deck
  the "open the relevant notebooks" affordance simply did not exist and
  looked removed. And its label renamed itself *Open notebooks* /
  *Refresh notebooks* while actually opening a pane — promising an action
  it no longer performed. It is now a constant **Notebooks** pane toggle
  with its own icon, visible whenever the build knows about notebooks at
  all; the **Notebooks used** pane lists every notebook that went into
  the presentation with its status (open · closed · not found — click a
  closed one to open it), and the *Open notebooks* / *Refresh all* /
  figure-locking actions live inside the pane, beside the list they act
  on.
- **The Objects pane organises.** Grouped items now show as **folders**:
  a colour chip (click cycles a palette), a name (double-click or the
  pencil renames it), and a one-click **duplicate of the whole group** —
  the copy lands as "*name* copy" with all its members. Every row also
  gets its own duplicate, ctrl-click in the pane builds a multi-selection,
  and the pane's own toolbar carries Group / Ungroup / Duplicate, so
  organising happens where you are looking. Group names and colours are
  saved with the slide.
- **Slides have their own background and border.** A new **Background**
  menu in the Slide group sets *this* slide's colour (File → Page
  background stays the presentation-wide default) and an inset border in
  four weights and six colours. The border is sized in the same
  page-relative currency as line weight, so it scales with the page —
  and both ride into print and the `.pptx` (verified: slide 1 exported
  cream with a border rectangle, slide 2 stayed default with neither).
- **Notebooks is a pane, and every pane is yours to place.** The
  notebooks list joined Objects / Animations / Versions in the same
  shell instead of a dropdown that died on the first outside click. And
  all of those panes now **drag by the header, resize by the corner
  grip, and remember where you put them** across sessions — restored the
  next time they open.
- **A saved file opens itself.** A bare-JSON `.junoview` was a dead end
  on disk: double-clicking asked Windows to pick an app, and nothing said
  what the file was. Saves and downloads are now **`name.junoview.html`**
  — a real HTML page with the presentation JSON inside it, so the OS
  opens a browser and the page identifies itself: the Junoview logo (as
  the page and as its tab icon), the name, what it holds, and how to open
  it for editing. Both loaders — the app's *File → Open* and the Python
  sidecar reader — unwrap the HTML form and still accept bare-JSON files,
  so nothing already saved is stranded; a `talk.junoview.html` next to
  `talk.ipynb` auto-loads exactly as the old sidecar did. `<` is escaped
  inside the embedded JSON, so no saved text — even a text box that
  literally says `</script>` — can cut the data block short. Verified
  round trip in a browser: the exact downloaded bytes re-imported through
  File → Open, and parsed by the Python loader.
- **The save readout says where.** "autosaved · 12:18" answered the
  question nobody asked and skipped the one that matters — into the
  browser? the project? which file? It now reads **saved to browser ·
  12:18** (or the project, or the file's own name).
- **A new poster opens blank.** It used to open pre-filled with the
  3-column academic template — headings, placeholder frames, the lot —
  which you had to clear before starting your own. Even the blank slide's
  full-page ghost frame goes: on a deck it is the click-to-fill idiom,
  but stretched over an A0 sheet it is one more thing you did not put
  there. The templates are all still one click away in *Layouts*.
- **Draw moved after Arrow.** The newcomer briefly sat between Line and
  Arrow, which broke the pairing the side rail builds from source order:
  Line+Draw shared a line and Arrow sat orphaned full-width under them.
  Line and Arrow — the same tool with and without a head, adjacent since
  2026-08-07 — pair again; Draw closes the group.
- **One Animations button, not two.** Moving the pane behind View's
  *Animations* left the old *Animate* button behind in Effects — same
  pane, different group, different name, and it renamed itself to the
  selected item's effect, so the two read "Animations" and "Appear" at
  opposite ends of the bar, both lit while the pane was open. The
  Effects button is gone; the pane's own effect chooser already shows
  what the selection does, which is everything that label ever said. With
  opacity in Colour that left Effects holding nothing, so the **group is
  gone entirely** — one group fewer in the changing half.
- **Fixed: a hidden dropdown button kept its grid cell.** Hiding a
  dropdown hides the button but left its wrapper occupying a cell, so the
  column count and the grid disagreed by one per hidden button and the
  overflow landed in an implicit third row — which is how the opacity
  slider printed on top of the COLOUR caption the moment it shared a
  group with the sometimes-hidden *Fill* button. One rule now drops the
  wrapper with its button, for every dropdown including future ones.
- **An Animations pane you can open without hunting for something
  animated.** The build order for a slide existed, with reordering and
  all, but it lived in a dropdown on the **Animate** button — and that
  button only exists while something is selected. So to see what a slide
  animates you first had to find an item that happened to be animated.
  It is a real pane now, a sibling of *Objects* and *Versions* in the same
  shell, opened from **View → Animations** with nothing selected at all.
  *Animate* still opens it too: one pane, two doors, because the build
  order belongs to the **slide** and the effect chooser belongs to the
  **selection**. Deselecting leaves the pane open and the list intact —
  and it is told the selection went away, so its chooser stops offering
  the last item's effect to nothing.
- **Opacity moved from "Effects" to "Colour".** It is how solid the ink
  is — a permanent property of the object, not a playback build, and it
  had no business sitting next to Animate. It also meant a **poster**,
  which has no builds at all, carried a group called *Effects* holding one
  slider, renamed to "Opacity" by hand to cover for it. That rename is
  gone: with Animate hidden on a poster and opacity in Colour, the group
  empties and hides itself through the mechanism that already existed for
  it.
- **Fixed: every side pane was covering the toolbar.** The panes sit
  inside the stage wrap, which also holds the ribbon, so `top:8px` was
  measured from *above* the toolbar — *Objects*, *Versions* and *Print
  check* have all been sitting on top of the View and Output groups since
  the ribbon became a fixed 98px band. Measured after, for all three: pane
  top 106px against a ribbon bottom of 98px.
- **Free draw.** The last drawing tool that did not exist: hold the mouse
  down and scribble. It is a first-class stroke, not a special case — it
  takes a colour, a **weight** and a **line style** like any other, it is
  judged by *Print check* like any other ink, the Objects pane calls it
  *Drawing*, and it moves, resizes, rotates, locks and hides with
  everything else. That falls out of how it is stored: a box in page
  percentages with its points normalised inside it, exactly as a shape is,
  so every one of those features works on it without knowing it exists.
  The trail is thinned as you draw (or one stroke would push thousands of
  points into the document and the undo stack) and smoothed through
  Catmull-Rom cubics, because a hand-drawn line should read as a curve
  rather than as the polygon the mouse reported. It exports to PowerPoint
  as a real **freeform** — still vector, still editable there — not as a
  picture. *Ends* and *Route* correctly do not offer themselves: a
  scribble has no arrowheads and no route.
- **Every insert tool is drawn out; none of them drop a canned box.**
  Shapes, lines and arrows were dragged to size; **Notebook cell** and
  **Text box** were not — they dropped one fixed rectangle wherever you
  clicked and left you to resize it by hand, every time. Both are drawn
  now, and a *click* still gives you the usual one, so the fast path is
  intact. There is no longer a list of "the tools that are drawn" for a
  new tool to be left off: anything armed goes through the same code.
- **Fixed: Shape stepped through fifteen shapes one click at a time.**
  The same complaint *Weight* got, in the same group, missed the first
  time: reaching *Question* from *Rectangle* was fourteen clicks and
  there was no way back. It is a drawn picker now — and it is literally
  the gallery **Insert → Shape** already had, which was sitting there
  unused by the control that needed it.
- **The two shape galleries are one component.** Insert's wrote its own
  option elements and captioned every icon; the new one did not. Both are
  built by the same helper now, so they cannot drift into looking like
  different features. Names are in the tooltip, as PowerPoint's gallery
  does.
- **Removed six controls that could never be seen or clicked.** *Dash*,
  *Fill*, *Align*, and the whole *Curve* dropdown (wrapper, button and a
  six-option menu rebuilt on every load) were superseded by the Style,
  Fill and Layout menus but left in the DOM behind a permanent `hidden`,
  each keeping its click handler, its visibility call and its entry in
  the completeness table. One over-general comment — "the originals stay
  because that menu drives them" — was true of exactly one of them and
  covered for the rest. The Layout menu also used to *click a hidden
  button* to toggle bullets; it applies the change itself now, because a
  control used as an internal API is a control nobody can see is still
  wired.
- **Removed the dead half of the ribbon's stylesheet.** `.rbn-big` — the
  big icon-over-label button — went when Present became an ordinary
  accented control, but thirteen rules stayed behind, four of them rungs
  of the density ladder, which made the ladder read as though it still
  had a lever it had not had in ten days. With it: `.rbn-tall`,
  `.et-div`, `.et-label`, a side-rail divider drawing a `::before` with
  no content, three lines of JS maintaining an `rbn-first` class no CSS
  reads, and four rules stated twice in two places.
- **Fixed: QR code armed a tool that does not exist.** It does what it
  says — asks for a link and puts a QR code on the page — but it also
  carried the class that marks a *drawing* tool, without naming one. So
  the shared arming wiring called `setTool(undefined)`: the button lit up
  as pressed, a **Cancel** button appeared, the page went to a crosshair
  with a blank hint, and clicking it did nothing. Since that wiring runs
  after the button's own handler, it clobbered the handler's cleanup, so
  the phantom state survived a *successful* insert too — and cancelling
  the prompt left you in it having inserted nothing. Measured before:
  cancel → `tool-undefined`, Cancel shown, button pressed, nothing added.
  After: cancel changes nothing at all; accept drops the QR code and
  leaves you in select. `setTool` now treats any tool it does not know as
  no tool, so the whole family of that bug is gone rather than the one
  instance. The label also says what it is for: point a phone at it to
  open your repo, paper or data.
- **The line menus draw the option instead of naming it.** *Style*, *Ends*
  and *Route* were lists of words — "Dash-dot", "Stealth", "Curved the
  other way" — and *Weight* was not a menu at all: a button that cycled
  2 → 3.5 → 5 and told you the result in a tooltip afterwards, so all
  three weights were invisible until you had picked one and there was no
  way back except round again.

  A word is a thing you decode into a picture, and "Curved the other way"
  is a word you decode into a picture and then mirror. For a dash pattern,
  an arrowhead or a thickness the picture **is** the answer. Every row now
  draws the real thing — the renderer's own dash array, the renderer's own
  head path — and keeps its full name in the tooltip:

  - **Style** — five rules drawn in their actual patterns.
  - **Weight** — Word's own ladder, ¼pt to 6pt, each drawn at its
    thickness and labelled in **printed points**. Points rather than the
    stored number, because weight here is page-relative: the same line
    prints heavier on an A0 than on a slide, so the point value is
    converted against the page you are on when you pick it.
  - **Ends** — three labelled rows, *Start* / *End* / *Size*, each head
    drawn on a stub of line pointing the way that end points. It was
    eighteen lines that all began with the same word.
  - **Route** — the five paths drawn side by side, so "curved the other
    way" is a picture next to "curved" instead of a sentence to mirror.

  Every menu also marks which option the selection is **on** — the one
  thing the worded lists were no better at, and the reason a cycling
  *Weight* button felt like guessing. The buttons that open the menus stay
  worded: a preview is the thing itself, but a glyph on a toolbar button
  only stands for it, and those went back to words in 2026-08-07 for good
  reason.
- **The toolbar has a constant half and a changing half, and the constant
  half does not move.** Selecting a line inserted four groups in the
  *middle* of the bar: *View* slid 150px sideways, *Output* vanished, and
  on a narrower window *Slide* stood down as well and took *View* another
  168px. Three separate mechanisms, one symptom — buttons somewhere else
  than where you left them.

  **File · Slide · View** are now ordered first and are on screen, in that
  order, at the same x and the same width whatever you have selected.
  Everything that can change — *Output*, *Notebooks*, *Insert*, and the
  selected item's own groups — is ordered after them, so the swap happens
  at one boundary at the far end. A group that can disappear cannot be
  part of the half that promises never to move, which is why *Output* is
  in the changing half despite always being wanted.

  Two subtler causes went with it. The density ladder used to re-fit
  against the *content*, so gaining a group bought a rung and every button
  in the bar shrank a few pixels; the constant half is now exempt from
  that ladder and steps with the **window width** instead — identical
  whether or not something is selected, so it can only move when you
  resize, which is the one moment a control moving is not a surprise. And
  the save readout, which renames itself from blank to "autosaved · 14:32"
  as you work, has left the *File* group for the far end of the bar: with
  nothing to its right its width costs nothing and moves nothing, and it
  gives way with the toolbar hint when the row is tight, on the same
  grounds — it is text, not a control.

  Measured at 1280 / 1400 / 1600 / 1920px windows with the slide strip
  docked: drawing a line, selecting it and deselecting it moves *File*,
  *Slide* and *View* by exactly **0px** and changes their widths by
  exactly **0px**, and nothing clips in any state. Below ~1250px the
  remedies are unchanged and one click each: put the slide strip away, or
  stand the toolbar on the right.
- **A presentation gets its slide thumbnails back.** Hiding the strip
  while editing was right for a poster and wrong for a deck: a deck **is**
  a sequence, and you steer it by seeing the sequence. The strip is docked
  down the left by default again for presentations, showing every slide,
  with **+ Add slide** under it; a poster still opens its versions on
  demand, into the floating pane, because a poster is one page and its
  other pages are rare drafts. **Slides** now toggles the docked strip
  rather than opening a pane — putting it away takes the slide from 973px
  to 1173px — and the button reports whichever of the two strips your page
  kind uses, written once so the two cannot drift apart and leave a toggle
  that lies about what it will do. Changing *Page size* from A0 to 16:9
  with Versions open now hands the slide list back to the panel; there is
  only one of it, and it would otherwise have been left floating in the
  pane while the panel that just appeared showed an empty strip.
- **Zoom is a View control; the page strip is a page control.** Zoom sat
  under *Slide*, right beside the control that sets the real page size, so
  the two read as the same kind of thing — and the strip listing the
  *other* pages sat under *View*, which is not what it is. The test that
  separates them: zoom changes how big the page **looks** and nothing
  about the document or what prints, exactly like *Guides* and *Objects*
  and exactly unlike *Page size*; the strip is the **set** this page
  belongs to, the same subject as *Layouts*. So **SLIDE** is now Layouts ·
  Page size · Slides (*PAGE* · Layouts · A0 portrait · Versions on a
  poster) and **VIEW** is Guides · Objects · Zoom. *View* no longer stands
  down when you select something, because you zoom constantly with
  something selected and an object list is at its most useful when there
  *is* an object selected.
- **The toolbar packs left; the 560px hole in the middle is gone.** *View*
  was flung at the right edge by an auto margin, which leaves the whole
  difference as one void between *Insert* and *View*. Groups pack left
  now, the way every real ribbon packs, so the leftover sits at the end
  where it reads as room rather than a gap. The order is untouched — View
  and Output still sort last, still the bottom of the side toolbar.
- **File over Save, and no more Close the editor.** *File* and *Save* are
  the two halves of one errand, so they are one cell two rows deep, the
  way PowerPoint stacks the small controls beside Paste; undo, redo and
  the save readout fill the column beside them. *Close the editor* is
  gone: it was the widest control in the ribbon, spending a group's worth
  of width on a journey the presentations rail's **Notebooks** button
  already offers, on screen the whole time you are editing. It survives
  where it is genuinely the only way out — presenting, which is full
  screen with no ribbon and no rail. Together the *File* group went from
  286px to 147px, and the narrowest window the resting toolbar fits in
  went from 929px of ribbon to **849px** — 80px better than before any of
  this, and 110px better than yesterday.
- **The toolbar no longer breathes as you zoom.** The readout renames
  itself from *Zoom 25%* to *Zoom 100%* and is the widest thing in its
  column, so *Output* shuffled sideways every time you zoomed. It is held
  to the longest label it can hold, in characters, so it survives every
  density rung.
- **The poster toolbar reads as clusters, not a list of rows.** Stood on
  its end for a tall poster, the toolbar put ONE control on every line,
  so *Insert* alone was seven rows deep — the list of rows the horizontal
  ribbon had just stopped being. Controls now pair up two to a line
  wherever both fit, and a long one takes the line to itself. Nothing is
  measured, shrunk or truncated to do it: a button keeps its natural
  width, so no word is ever squeezed. Measured on an A0 portrait: 21
  lines before, 11 after (*File* 6→1, *Insert* 7→4, *View* 3→2, *Output*
  2→1). The rail went from 214px to 226px, which is the width at which
  *Print check* and *Present* stop stacking — and that width is now one
  number, so the stage, the rulers, the page arrow and the Objects pane
  cannot drift apart. Undo and redo travel as one cell, the way zoom's
  minus and plus already do, so they can never land on separate lines.
- **Fixed: the View group printed on top of its own label.** `--rbn-cols`
  counts the controls a ribbon group is currently showing, and *Slides* /
  *Versions* was revealed after the count — so *View* was sized for two
  controls, the third fell into an implicit third row, and the row ran
  over the VIEW caption underneath it. The count is owned by one function
  that the fit calls first, so any reflow re-counts before it measures.
  Sizing *View* honestly costs about 60px of ribbon width; the tightest
  density rung gives 40px of it back in spacing alone, leaving the
  narrowest window the resting toolbar fits in 30px wider than before
  (measured floor: 929px → 959px of ribbon). Below that the remedy is
  unchanged — *Guides ▸ Toolbar on the right*.
- **Fixed: an empty save readout drew an empty pill.** `:empty` already
  hid it and was quietly overruled by a later, more specific rule — the
  author-`display`-beats-`[hidden]` trap. It keeps its cell in the
  horizontal grid (so the group does not shift the moment it fills) and
  simply stops painting.
- **Fixed: PowerPoint export produced nothing for any page containing a
  line or an arrow.** `pptxItems` called `arrowEnds(layer, …)` with no
  `layer` parameter and none in scope; reading an undeclared name throws,
  and the throw escaped before the toast — so *File → Export PowerPoint*
  gave you no file and no error message. Every poster with a divider on
  it was affected. The layer is a real parameter now, optional because
  only the page on screen has one; the rest resolve attached arrow ends
  from their stored coordinates, the same fallback an attachment already
  uses when its target goes away.
- **Line weight scales with the page, like everything else on it.**
  Position, size and text are all page-relative; line weight was the one
  exception, written straight out as screen pixels. Zooming 3.74× grew
  the text 3.75× and the stroke 1.00×, so a line fell from 12.7% of the
  text height to 3.4% — a hairline beside huge text zoomed in, and a
  slab zoomed out. A stored weight now means *pixels on a page 720px
  tall*, which is the height the 16:9 print page has always been built
  at, so every existing deck keeps exactly the weight it had while an A0
  finally gets ink in proportion to its own size. Measured after: the
  text-to-line ratio is 7.4 at page heights of 393px, 768px and 2872px.
  Dash patterns scale with the stroke they dash (a 9px gap on a stroke
  shrunk to 0.5px read as dots), the invisible path you grab an arrow by
  stays screen-measured but never narrower than the ink, and *Print
  check* now warns about a line too thin to survive a press. Two export
  bugs fell out with it: `.pptx` multiplied the weight by 12700 EMU —
  which is one **point**, not one pixel — so every exported line was
  1.33× too fat, and a rectangle and a line disagreed about the default.
- **Line is drawn, not dropped.** Clicking it used to place a canned
  horizontal rule that you then angled by dragging an endpoint. It is a
  tool now, dragged out exactly like a shape. It is still an arrow with
  no head underneath, so attachment, routing, dashes, colour, the
  Objects pane and the PowerPoint connector export all still apply to it.
- **An armed tool has a visible way out.** Escape always de-armed one,
  but nothing said so, and an armed tool looks identical to no tool at
  all apart from the cursor — so choosing Line or Shape and changing your
  mind left you stuck. There is now a **Cancel** button beside the tools,
  shown only while something is armed, and pressing a tool a second time
  puts it away too. Cancel deliberately does *not* live in the toolbar
  hint: the hint is the first thing dropped when the ribbon is tight, and
  the way out must never be droppable.
- **One toolbar, not two.** Back sat alone at the far right of a bar of
  its own, so next to an armed drawing tool it read as the way out of
  *that* — which it was not. Moving it in with File and Save fixed the
  grouping and left the real problem: that bar was a second row of chrome
  sitting on top of the editing tools, which is a second row taken off
  the page. While editing there is now no bar at all — leaving, File,
  Save, undo/redo and the save readout are the ribbon's first group.
  Leaving reads **Close the editor**, or **Stop presenting** while
  presenting, which still has a bar because it has no ribbon. Measured
  after: one row, 98px tall, nothing wrapped or clipped, at ribbon widths
  down to 950px. Below roughly 870px the row genuinely cannot hold
  everything, and the answer there is the **Side bar** button — the
  toolbar is never moved automatically, because a toolbar that teleports
  over a choice you just made was tried and rejected.
- **The toolbar hint says nothing in the resting state.** "Click an item
  to select; drag to move; Del removes" sat in the middle of the toolbar
  permanently, captioning the obvious. A hint earns its place by naming a
  mode you have entered and cannot otherwise see — an armed drawing tool
  looks identical to no tool at all apart from the cursor — so those
  hints stay and the default-state one is gone.
- **A ribbon heading no longer promises effects a poster cannot have.**
  Animate is hidden on a printed page, which left the group labelled
  "Effects" standing over nothing but an opacity slider. It reads
  **Opacity** on a poster and **Effects** on a deck.
- **Fixed: print decisions were being forgotten.** Both the JavaScript
  and the Python rebuild a presentation from a fixed list of keys, so
  anything unlisted is dropped. Crop marks never survived a reload at
  all, and slide numbers and the page background never survived a project
  save — each one a choice the editor offers and then quietly discarded.
- **The page you are editing gets the window.** The strip of thumbnails
  down the side was a permanent bite out of the only thing you were
  looking at, and you edit one page at a time whether it is a poster or a
  slide. It is now opened from a single button in the View group, named
  for what it actually holds — *Versions* on a poster (drafts, variants
  for another venue), *Slides* on a deck. *File* and *Save* moved to the
  top bar for both kinds, since the panel that used to carry them is
  closed by default and a deck would otherwise have had no Save button on
  screen at all.

  It now opens in the **same floating pane the Objects list uses** — same
  shell, same corner, same close button — because both are lists you open
  to look at the page from outside it. The strip is *moved* in rather
  than rebuilt, so reordering, drag-and-drop, delete and the thumbnails
  keep working with no second copy of any of them, and only one of
  Objects, Versions and Print check can own that corner at a time.

  **+ Create new version** copies the poster you are looking at — that is
  what a variant is a variant *of* — and names it for you, because a pile
  of near-identical unnamed A0 sheets is unusable. The page you were
  already on is named at the same time, so the two read as a pair rather
  than "empty slide" and "Version 2". The name is a starting point:
  **Rename** changes it. Only posters are named this way; a deck's slides
  are still titled by what is on them, which is more use than "Slide 3".
  Because versions are now easy to accumulate, a poster exports **one
  version at a time** — otherwise one A0 would quietly become three at
  the print shop — and the toast says which one went.
- **Fixed: "Margin & grid" drew no grid.** It worked out a row pitch from
  the column width and the page's aspect, and then drew nothing with it —
  so the overlay was a set of vertical stripes. You could line things up
  across the page and had nothing to line them up against going down it.
  Rows are now drawn at the pitch that was already being computed, which
  makes the cells square, and both axes are ruled between cells (the
  margin box already draws the outer edge).
- **Fixed: inserting a line, a QR code or an image left the wrong tool
  armed.** Those three are not tool buttons, so they never touched the
  armed tool — they placed an item and handed it to you selected, which
  looks exactly like select mode. Arm *Arrow*, click *Line*, and your
  next click on the page dragged out an arrow instead of picking
  something up.
- **Fixed: controls that could not act on what you had selected.** "Same
  size" counted the raw selection, but resizing skips arrows (no box to
  resize), locked items and hidden ones — so two selected arrows were
  offered the menu and then nothing happened when you chose from it. It
  now counts what can actually be resized. *Arrange* shares its menu with
  single-item actions, so it stays reachable and says why instead.
- **Fixed: a poster was told to "click on the slide".** Five instructions
  in the toolbar hint said *slide* to someone laying out a printed A0
  sheet — the same leak the Page/Slide label and the Versions button had
  already been fixed for.
- **The save-destination button no longer truncates itself.** Its label is
  a bare chevron now, so the `text-overflow: ellipsis` it carried had
  nothing left to clip; an ellipsis on a live control hides a word the
  same way hiding the button does.
- **The poster editor got a frame of reference.** A poster is far bigger
  than the window, so the judgements a 16:9 slide lets you make by eye —
  is that aligned, is it too near the edge — could not be made at all, and
  laying one out felt like arranging things in mid-air. A new **View**
  group fixes that. **Rulers** (`R`) run down the top and left in real
  millimetres of the page, marking where the pointer is and how far the
  selected item reaches. **Grid** (`G`) draws a 20mm print margin and
  twelve columns, and items snap to both. Snapping itself was never
  missing — it has always caught the page's edges and centre and every
  other item's edges and centres — but it reported itself with a 1.5px
  dashed hairline that, on an A0 page zoomed to fit, was invisible. The
  guides are now solid and lit, and a snap to the *page* is cyan where a
  snap to its *contents* is coral, so the two facts read apart. The catch
  window went from 6px to 9px, which on a fitted poster was a couple of
  real millimetres. Guides are an editing aid and appear in no print,
  export or playback.
- **The toolbar can run down the right-hand edge**, and a portrait poster
  starts that way. A0 portrait is 1.4× taller than it is wide, and the
  horizontal ribbon spends ~122px of exactly the dimension the page needs
  most; moved to the side it spends width instead, which a portrait page
  has to spare. Landscape pages and ordinary slides keep the top ribbon,
  and the **Side bar** button overrides either way for good.
- **Full-screen editing**, which is not the same thing as presenting.
  *Present* hides every tool and starts a build sequence — meaningless for
  a poster, where there is no audience and nothing to step through.
  **Full screen** takes the browser chrome away and gives the page the
  whole display with the entire editor intact.
- **Presentations and posters export to PowerPoint.** *File &rarr; Export
  PowerPoint* writes a real `.pptx` — and native shapes, not a picture of
  each slide, so **the text is still text in PowerPoint**: retype a title,
  restyle a caption, nudge a figure. Images and figure frames become
  pictures, boxes and arrows become PowerPoint shapes, and the page keeps
  its true size, so an A0 poster opens as an A0 poster. A placed cell that
  is prose or code comes across as a text box rather than an empty slide.
  What genuinely cannot cross — a table frame, a crop (a CSS clip-path is
  not a PowerPoint crop), a typeset equation (which arrives as plain text)
  — is counted and named in the toast rather than silently dropped, with a
  pointer to PDF, which carries all three perfectly. The writer is
  dependency-free: `assets/js/pptx.js` builds the OOXML *and* the ZIP
  around it by hand, so export works from a `file://` page with no network.
  Verified by opening the output in Microsoft PowerPoint.
- **Export PDF now says it prints at true page size.** The poster PDF path
  was already correct — an A0 poster has always exported as a real
  841×1189mm page — but nothing said so, so people assumed it was missing.
  The menu entry now explains it.
- **The sidebar can list variables, not just sections.** A
  **Sections | Variables** switch at the top of the rail swaps the section
  outline for an index of every variable the notebook defines, in the order
  they are first bound. Each row carries a type read off the assigned
  expression (`DataFrame`, `module`, `Axes`, `str`, …) and a count of how
  many later cells read it; clicking the name jumps to the cell that
  defines it, and its chevron unfolds every cell that defines, redefines or
  reads it. **type** regroups the list into imports / constants / data /
  functions / classes / plotting / values / objects / computed, and the
  filter box narrows by name. It is static analysis like the rest of the
  renderer — top-level bindings only, so a name assigned inside a `def`
  stays a local and does not bury the notebook's real variables, and
  nothing is executed to find out a type.
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
