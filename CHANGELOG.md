# Changelog

## Unreleased

### The flip book

A figure built up in steps — plot, then plot with a fit, then plot with a
fit and residuals — used to cost you either a stack of overlaid images with
appear-animations, or a pile of duplicated slides whose surrounding text you
then had to keep in step by hand. Neither is a good answer, and the second
is the one people actually do (2026-08-22, user).

- **One box, many figures, arrows to step through them.** Insert ▸ Flip
  book draws it; the figures come from your notebook (pick as many cards as
  you like in one go) or from your computer (several picture files at
  once). The arrows work while editing and while presenting, and the frame
  is letterboxed into a box that never changes size — frames differ in
  shape, and a box that hugged each one would move every caption tied to it
  on every click, which is exactly the jitter people duplicate slides to
  avoid.
- **Text and objects tie to a figure.** Select a caption, pick a figure in
  the Figures pane, and choose whether it shows *just on that figure*, *on
  that one and every one after* (so the text stacks up as you go), or *on
  that one and every one before*. It applies to the whole selection, so six
  labels can be tied to one figure in one go. While editing, items
  belonging to another figure are dimmed rather than hidden — you have to
  be able to see the caption you are about to tie.
- **A frame is a stop in the talk.** The space bar, the arrow keys, a click
  on the slide and the arrows on the box all walk the same sequence: the
  slide's builds first, then its figures, then the next slide. Stepping
  back into a slide lands it fully built and on its last figure, as you
  left it.
- **And the export builds the pile of slides for you.** A flip book of six
  figures becomes six real slides in the .pptx and six pages in the PDF,
  each carrying the items tied to that figure and nothing else. That is the
  point: the flip book is the authoring form, the pile of slides is only
  ever the delivery form. Printed pages keep the "2 / 3" counter and drop
  the arrows, which cannot be pressed on paper.

Reordering a figure carries its bindings with it, and deleting one drops
the binding rather than re-pointing it at whatever slid into that slot. A
binding whose flip book or frame has gone shows the item rather than hiding
it — an item that silently becomes invisible forever is the worst thing
this feature could do.

### Naming the type, and grouping the slides

The deck editor could push one box's look outwards, but only ever to "all
headings" -- a hard-coded list of four, text only, whole deck, every
property at once. All three of those open up here, and the slide strip
grows the two things a long deck needs.

- **"Apply to all headings" is now "apply to every one of its type", and
  it says which type.** The type is named in the accent colour at the top
  of the dialog, hovering it outlines the matching items on the slide
  behind, and it is a *chooser*: a menu of every type in the deck with a
  count against each. That last part is not decoration. An unstyled box is
  grouped by its size, so the moment you make one heading bigger it is
  alone in its band -- which is exactly the flow the action exists for.
  Being able to say "no, *that* type" is what makes it work.
  Opened from Arrange ▾ (shown for every kind of object) and from the
  Styles menu, where the one-click version has always lived. Both of those
  survive unchanged.
- **Which properties travel is yours to choose.** Twenty-five rows in six
  groups -- type, spacing, size, position, colour, background -- every one
  ticked to start with, including all seven the brief named. Rows that
  mean nothing for the selected kind are greyed and explained rather than
  hidden, so the list never reshuffles under you when you click something
  else. Box background is in there, and so is a new **indentation** on
  text boxes (`a.ind`, in em of the box's own type size, stepped from the
  Layout menu so the ribbon gains nothing).
- **And which slides.** All of them by default; untick slides
  individually or a whole section at a time. The exclusion is keyed on the
  slide *object*, not its index, so reordering or deleting a slide cannot
  silently re-point it at a neighbour. A sweep across sixty slides is one
  undo step.
- **A text box can be born as a heading.** A caret beside Insert ▸ Text
  arms the next box's type; the tool hint says which. It costs the ribbon
  about eighteen pixels inside a wrapper that already existed, so no group
  gained a column.
- **You can invent types of your own.** "＋ New style of my own" in the
  Design ▸ Styles menu, and a little arrow beside every style -- built-in
  or yours -- opening bold, italic, "counts as a heading", rename, and
  either delete or revert. Deleting a type moves nothing on any slide:
  the boxes keep the look they have and simply stop being a group.
  Types live on `pres.types` and survive a save, a reload and an undo.
- **Standardise text**, on the Design tab: does every heading, paragraph
  and caption across the deck actually match? The hard half is the deck
  that has never used a named style, which is most of them -- a check that
  only read `a.style` would find nothing to disagree and report "all
  fine", which is false rather than merely weak. So the unstyled boxes are
  bucketed by what they *look* like, the bands are named against the type
  scale, and each one is offered its name. Adopting a band builds the
  style from the band's own commonest values first, so the majority does
  not move a pixel and only the strays snap into line.
- **Slide sections in the strip.** "§ Section" beside "+ Add slide" starts
  one at the slide you are on; dividers rename, collapse (saying how many
  they hide), drag as a block, and right-click for the lot. A section is a
  tag on the slide plus a name -- the order is read back off the slide
  list, so no reorder can desynchronise it. Slide numbers stay global
  through every section, and collapsing one is a way of looking at the
  strip rather than an edit, so Ctrl+Z never opens or closes it.
- **The slide column can be dragged wider, and lists three ways.**
  Thumbnails, headings, or both. Headings mode is a real outline: each
  slide named by the box wearing a heading style, indented by level, under
  its section. Thumbnails grow with the column instead of staying 116px
  wide in a 460px strip.

### Fixed

- **The slide column could not be resized in the flow you use it in.**
  There was a working drag handle and a persisted width, but `.deck.editing`
  capped the column at `min(var(--dc-w), 200px)` and hid the handle -- so
  while *editing*, which is the primary flow, the thumbnails were stuck at
  200px. The old expression is now the default inside a clamp, so a session
  that never touches the handle is unchanged.
- **"Background for every slide" did nothing on any slide that had its
  own.** The deck default only shows through where a slide has no
  override, so you could set the background for every slide and watch the
  one in front of you not change. There is a verb for it now, and it names
  the destructive half: "Use this on every slide (clears per-slide ones)".
- **A table set to "no fill" kept its fill.** `drawTable` painted `a.bgc`
  and never checked `a.bg`, so the format bar's swatch and the renderer
  had disagreed since tables were added.
- **`restyleDeck` was a byte-for-byte copy of `restyleAll`** with one
  branch removed. It is a one-line delegate now; `restyleAll` gained the
  optional slide scope both of them needed.

### The front door, and the sidebar that names your notebook

Nine things reported off one screenshot set, all on the surfaces you meet
before you have read a single cell:

- **The welcome screen tells you what you were doing.** Recent notebooks
  and your presentations now sit side by side under the buttons, each
  column hiding itself when it has nothing in it. Presentations were
  previously reachable only from the left rail, so with that rail
  collapsed the front door was a dead end for anyone who wanted a deck.
- **A remembered notebook is a file name**, with its path on hover. The
  list used to print the whole `https://raw.githubusercontent.com/...`
  URL, ellipsised from the left, so six notebooks read as six copies of
  the same string.
- **Opening one says that it is opening**: a bar across the top of the
  welcome and a shimmer under the row you clicked, driven by the same
  busy counter as the open dialog's.
- **The Junoview wordmark is a home button.** It shows the welcome with
  your notebooks still loaded and nothing closed; a "Back to your
  notebooks" chip undoes it.
- **The sidebar names the notebook, not its first heading.** It showed
  `doc.title`, which is the file's first `# ` line -- so a notebook
  opening with "# Preamble" was labelled *Preamble*. The heading did not
  lose its place; it moved one line down, under the file name.
- **The open dialog follows the theme.** Every surface in it was a
  `--paper` / `#fff` literal, so the file browser opened as a white sheet
  in the middle of a dark app. Its remembered files are cards with an
  icon now, rather than two lines of bare text that gave no sign they
  could be clicked.
- **The demo reel plays by default.** It defaulted to off whenever the
  browser reported `prefers-reduced-motion` -- which any Windows box with
  animation effects switched off does -- so the "See it work" section
  rendered as captions beside a button and read as broken. The bandwidth
  reason for that default is answered properly instead: each clip now
  loads only when it is scrolled into view.

### Fixed --- interface

- **The rail's open-notebooks list was pushed off the rail.** `.tabstrip`
  still carried `margin-left: calc(var(--rail-w) - 52px)` from the days it
  ran across the top of the document; standing it up in a 175px rail left
  that 248px offset in place, so the whole list was crushed to a 16px
  sliver over the page and the "open notebooks" heading stood above
  nothing. Each notebook's own sidebar also carries the list now, but only
  while the rail is collapsed, hidden or auto-hiding -- one list at a time.
- **A remembered notebook that was not an absolute URL could not be
  reopened in the browser build.** The bundled example is remembered as
  `example_climate_analysis.ipynb`, a path relative to the page, and the
  reopen path gated on `isUrl()`: clicking it did nothing whatsoever --
  no fetch, no error, no sign the click had landed.
- **The presentation editor's lock buttons could not all be seen.** "Lock
  all figures", "Unlock all" and "Load locked versions" shared one row in
  a ~280px column: each was squeezed to three wrapped lines and the third
  still fell off the right edge. They stack, full width.
- **The welcome screen's demo-reel CSS was duplicated** into the dark-theme
  block behind a dangling `body:not(.light)` selector, which glued itself
  to the next rule and left the numbered-steps colour unscoped -- so the
  light theme drew its steps in dark-theme grey.

### Presentations travel whole: saved decks carry their own pictures

A saved deck used to be a list of *references* into notebooks — open it
without those notebooks (or without the internet to re-fetch one opened by
URL) and every frame was blank. Now every deliberate save writes each
placed card's rendered body into the file itself (figures are already
`data:` URIs, so the file travels whole):

- **Save to file / Download a copy** always embed; a manual **Save to
  project** does too. The every-second autosave stays refs-only so editing
  never rewrites megabytes to disk per keystroke.
- On load the copies are absorbed into a session store (and IndexedDB, so
  they survive the browser closing) rather than riding the presentation
  object — drafts written to localStorage on every edit stay small.
- The live notebook always wins: an open tab drives its frames exactly as
  before, and the embedded copy is the understudy. When only the copy is
  showing, the frame carries a quiet **saved copy** chip (edit mode only)
  and **Check** says so; a ref with no copy at all is now flagged as the
  blank space it would print as, instead of failing silently.
- Deleting a referenced cell, or closing its tab, no longer blanks the
  slide — the last saved copy stands in.
- The Python normaliser now keeps everything the editor keeps: speaker
  notes, per-slide looks, the talk clock, watermark/header/footer, named
  styles and the embedded copies all survive a round-trip through a
  project save or a sidecar load (they used to be silently dropped).

### Fixed — opening the app offline erased your session

Three bugs on the same path, all found while verifying the offline build:

- **A failed restore forgot the notebook.** The web app reopens last
  session's URL notebooks silently at boot, and *any* failure called
  `webUnnote()` — so launching it once with no connection dropped every
  notebook from the remembered list, and they were still gone after
  reconnecting. A fetch that never reached a server rejects with no
  status; only the server saying the file is not there (404/410) retires
  a URL now. Unreachable notebooks are kept, and a notice says so rather
  than leaving you staring at an empty window.
- **The restore depended on winning a race.** The loader writes the whole
  page with `document.write()` — which wipes the document and its
  listeners — then fires `sem:pyready` immediately. If the app script had
  not run yet the event was simply lost. The service worker made that
  race much easier to lose, because a cached boot writes the page faster:
  the first visit restored and every later one silently did not.
  `window.semPy` is set before the dispatch, so it is now the flag, with
  the listener covering only the other ordering.
- **The manifest never reached the running app.** It was declared only in
  the boot loader, and that loader hands over with `document.write()` —
  which replaces the document and takes the `<link rel="manifest">` with
  it. The live app therefore declared no manifest at all. It is now
  emitted into the app page too, for the web build only (a static export
  or the local server ships no manifest file and would just 404).
- **The worker could serve a stale notebook.** A notebook on our own
  origin is same-origin and was being cached like a stylesheet — re-run
  it, reopen it, and you would get yesterday's figures. Notebooks and
  saved decks are data: never stored, and served from cache only as an
  offline fallback (which is what keeps the bundled example openable on
  a plane).

### Saving with images is no longer invisible

Embedding is automatic, so nothing ever said it happened. Every save now
reports what travelled with it — *"…with 6 cards embedded, so it opens
without the notebook"*.

### The web app is now an offline, installable app

`junoview --build-web` output is a PWA. One visit to the site caches the
page, the packaged renderer, the Pyodide runtime, MathJax (fonts included)
and Plotly; after that it loads with **no internet at all**, and the
browser offers **Install app** — a Start-menu / dock icon in its own
window, which is the downloadable app people keep asking for, with nothing
to install by hand.

- `build_web` writes `sw.js` (version-stamped with the package hash, so a
  new build retires the old cache and an unchanged build produces no
  diff), `manifest.webmanifest` and `icon.svg` beside `index.html`.
- The worker serves cache-first and refreshes same-origin files behind
  the response, so updates arrive on the next visit without ever costing
  offline. GitHub-URL notebooks are deliberately never cached — stale
  science is worse than no cache.
- The welcome screen grows **Install as an app** when the browser has an
  install offer pending, and says once when offline is actually ready.

### The deck editor grew a tabbed ribbon and a title bar

One ribbon had stopped being able to hold the editor: every feature added a
control, every control bought a density rung, and the row spent its whole life
at the tight end of the fit ladder.

- **The ribbon is tabbed** — Home, Insert, Design, Animate, View. A tab is a
  filter and nothing more: each group declares `data-tab` and everything
  off-tab leaves the row entirely (`display:none`, so it costs nothing in the
  width `fitEditRibbon` measures). The density ladder underneath is unchanged;
  with a third of the groups in the row it now almost never has to fire, so the
  controls that *are* showing are full size. Home holds everything
  selection-driven, deliberately: the tools for the thing you just clicked have
  to be in one named place, not on a tab that appears and disappears under you.
  Animate exists only for decks — a poster is one printed page and has no
  build. The chosen tab is remembered per project.
- **One thin bar across the top** holds what never changes with the selection:
  File, Save, undo/redo, the presentation's name, Find, the save readout,
  autosave, zoom, theme and Present. This is allowed to be a row above the tools
  — the thing the ribbon itself may never be — because it *replaced* chrome
  rather than adding it: a block in the left column plus two ribbon groups
  became one line. It also settles two long-standing complaints, that undo and
  redo were stranded under Save in a vertical column, and that zoom and Present
  could be taken away by whatever else was in the row.
- **The Notebooks button and its pane are gone.** The list of notebooks a
  presentation is built from is the whole top of the left column and is on
  screen the entire time you edit; a ribbon button that opened a second copy in
  a floating pane spent a group's worth of width on something already showing.
- **Home opens on a Slides group** — new, duplicate, layout, delete — the way
  PowerPoint's does, so the tab you land on is not one lonely button over an
  empty row when nothing is selected.

### Fixed — the placement complaints

- **Page background left the File menu.** File is where you open, save and
  export things; how the deck *looks* is Design. It sat there because somebody
  put it there, not because it belonged. It is in the Background dropdown now,
  beside the per-slide override, so the two can be seen against each other.
- **The Save destination says where, not which file.** "This browser" / "On this
  computer" / "This project". The filename is the widest thing that could land
  in that bar, it changes under you when you pick a different file, and it
  answers a question nobody asked — what you ask of a Save button is "will I
  find this again?". The filename is in the tooltip.
- **Opening a .junoview kept saving to the browser.** The file you opened never
  changed again and your work quietly went somewhere else. Where the File System
  Access API exists we now take a real handle so Save writes straight back;
  where it does not, the destination still moves to "a file on your computer"
  and the first Save asks once.
- **Copy/paste across slides lands in the same place.** Pasting onto the *same*
  slide still nudges, or the copy hides exactly under its original.
- **Items dragged off the page can be reached.** The layer stops clipping while
  editing, strays get a dashed outline so it is obvious they are off the page,
  and the stage grows scrollbars only when something is actually out there.

### Added

- **Line spacing and paragraph spacing** — a multiple of the type size, the way
  every word processor states it, so it means the same thing at every zoom and
  on every page size. It travels with a named style and with Match slide.
- **Auto-bullets.** Typing `- `, `* ` or `1. ` at the start of a text box turns
  it into a list — the markdown habit everybody already has. It fires only on
  the first characters of a box that is not already a list, so it can never eat
  a hyphen you meant to keep.
- **The scratchpad.** Three kinds of note in one pane: this slide, the whole
  talk, and loose notes in folders belonging to neither. The scratchpad is where
  a thought goes before you have decided where it goes — the reason people keep
  a text file open beside their deck.
- **Folders in Layers, which are filing and not grouping.** Grouping *welds*
  items together; that is the last thing you want from a filing system. A folder
  is just a name on the items in it — select-all-in-folder, rename, and nothing
  about movement or formatting changes.
- **Lines and arrows bend through corners.** Drag the faint handle halfway along
  a segment and it becomes a corner you can place; Alt+click or right-click
  takes one out again. Corners win over the canned routes — once you have
  dragged one in by hand, "curved" and "elbowed" are no longer describing the
  line you drew. They snap like every other drag and travel with the line.

### Added — presenter view, speaker notes and timing

A second window holding everything the audience must not see: your notes, the
slide that is coming, and a clock. **Present ▾ ▸ Presenter view…** opens it;
drag it to your other display, then press Present on the first screen.

- **It does not start playback.** You want the window on the other screen
  *before* anything goes full screen.
- **The slides in it are real renders, not pictures.** `buildSlideNode` runs the
  same `renderAnnots` every other output uses, and the nodes are imported into
  the popup — so the presenter view cannot drift from what is on the screen
  behind it. There is one renderer.
- **A popup, not automatic screen placement.** The Window Management API that
  can put a window on a named display is Chromium-only and needs a permission
  prompt; a popup works in every browser and on every setup, including the
  common one where the second screen is a projector the OS is mirroring.
- Arrow keys, Back and Next work in *either* window — whichever your clicker
  happens to be pointed at. Pause and Reset live on the clock.

**Speaker notes** are per slide, in a pane beside Layers and the timeline. They
are never drawn on the page and never exported: they exist for the presenter
view and for you.

**Time goals** are per slide, in minutes, and the pane adds them up — so a talk
that cannot fit its slot says so *before* you give it. Set a whole-talk length
and it tells you what is left or how far over you are; the presenter clock turns
amber once you pass it.

### Fixed

- **"ResizeObserver loop completed with undelivered notifications."** The pane
  observer re-fitted the page from inside its own callback, the page reflowed,
  and the browser complained. One frame later is outside the loop and looks
  identical.

### Changed — the groups, reviewed

Measured before: Home had View(5) **Output(1)** Slides(5); Insert had
**Animate(2)** Insert(10); Design had Slide(4) Page furniture(4) — eight
controls for a whole tab. A heading over one button is a heading doing no work.

- **Output is gone.** Print check was all that was left in it once Present moved
  to the top bar, and checking a page before it goes out *is* a way of looking at
  it — which is what every other control in View is for. The 2026-08-07 split was
  really about Present, and Present is in neither group now.
- **Animate gained the two builds anyone actually wants**: *One by one* gives
  every item on the slide its own click, in **reading order** — not array order,
  which is the order you happened to draw things in and is nobody's idea of a
  sequence — and *All at once* puts everything on a single build. Setting either
  by hand meant selecting every item and stepping its order one at a time.
- **Design gained a Type group**: a style manager that edits the deck's named
  styles **without selecting anything**. Until now a style could only be changed
  by formatting one box and pushing its look outwards, which meant you needed a
  box of that style on the slide you happened to be on. It shows each style as a
  specimen at its own size, with a −/+ pair per style, an all-styles scale for
  when the room turns out bigger than you expected, a Re-apply, and a reset.

After: Home View(6) Slides(5), Insert Animate(4) Insert(10), Design Slide(4)
Page furniture(4) Type(4). Nothing under four, and every tab still fits.

### Changed — open notebooks moved to the rail

The horizontal tab strip across the top of the document is gone. It was a row
of chrome whose width ran out at about five notebooks, and the rail beside it
was already where this app lists the things you can switch between. The open
notebooks now sit under the **Notebooks** button in the rail, above the
presentations. The strip *moved* node-for-node rather than being rebuilt, so the
close buttons, the Plot-trace sub-tabs and the earlier-version marks all keep
working untouched; the header row keeps only the two sidebar toggles.

### Added — a real equation editor

"Insert equation" used to drop a text box containing `$$ E = mc^2 $$` and walk
away: no preview, no symbols, and no way to tell whether what you typed was
valid. It is a proper editor now — type on the left, see it typeset on the
right, click a symbol to drop it at the caret.

- **104 keys in five groups** — structures (fractions, roots, sums, integrals,
  limits, matrices, cases, aligned blocks), Greek, operators and relations,
  arrows and accents, and ready-made formulae. **96 of them are typeset as real
  symbols**, not spelled out in LaTeX: you should be able to find sigma by
  looking for a sigma, which is the same complaint the fill menu answered.
- A template lands the caret **in the first empty brace**, not after the closing
  one, so an insert is not followed by arrowing back.
- An existing equation reopens in the editor via **Edit equation**.
- It is honest about failure, which took two mechanisms: MathJax is loaded from
  a CDN, so on a locked-down network there is no renderer at all and it says so
  rather than showing a blank preview you would read as "my LaTeX is wrong". And
  MathJax never *rejects* on bad input — an unknown command gets a red error box
  while an unclosed brace is silently left as raw text. Neither throws, so the
  check is "did a container come out, and is it clean".

### Fixed

- **Locking a figure to a git commit looked like it had been removed.** It needs
  the local server to reach git, so it only works in the app build — and it used
  to vanish entirely everywhere else. It is shown and disabled now, with a
  tooltip that says what would make it work. Same for Lock all / Unlock all in
  the notebooks column.
- **Light themes never re-inked the chrome surfaces.** `--chrome-0..4` kept
  their dark values, so every menu and panel relied on a hand-written
  `body.light .thing{background:#fff}` rule of its own; anything added without
  one came out dark-on-light, and the two overrides that *did* exist carried an
  alpha byte and came out washed. Light and light-forest set the tokens now, so
  every menu is fixed at once — including the ones nobody has written yet.
- **Panels that hold controls are fully opaque.** Translucency is for overlays,
  not for things you click.
- **Three stray control bytes** (a form feed and two others) had been left in
  deck.js comments by shell escape-mangling. Harmless to run, but they shipped
  in the bytes of every rendered page.

### Changed — the fill panel, and arranging

- **Gradients are drawn, not described.** "Gradient — linear" told you nothing
  about which way it ran, and multi-colour gradients could not be expressed at
  all — the model held exactly two colours. A gradient is a list of *stops* now,
  and the Fill control is a panel of drawn previews: no-fill, tint and solid;
  ten fill colours; **eight linear directions plus radial**, each drawn in the
  shape's own colours so the preview *is* the answer; and **twelve ready-made
  ramps**, most of them three- and four-colour. Decks saved before this keep
  their gradients, and the `.pptx` exporter — which speaks in two colours —
  needed no changes.
- **One Fill control, not two.** There was a "Fill" in Line & shape and a "Fill
  colour" two groups away, and nobody could tell which was which. A shape's fill
  colour now lives inside its Fill panel; the separate swatch button stays for
  text boxes and cell frames, which have a background colour but no fill *style*.
- **Arrange got thorough**: centre on the *page* (not on the selection's own
  average, which is what aligning does), close the gaps, flip left-to-right and
  top-to-bottom, quarter turns, straighten, and match widths / heights / both to
  the biggest. Flipping mirrors real geometry — an arrow's endpoints and a
  freehand stroke's points, not just position.
- **Buttons are 30px tall, not 26**, and the labels lost words they did not need
  ("Text" not "Text box", "Cell", "QR", "Maths", "Check"). The 26px target was
  sized when the ribbon was one row trying to hold everything; tabs took that
  pressure off.

### Added

- **Match another slide.** The most tedious thing about building a deck is
  making slide 7 sit exactly like slide 3. Pick a slide and this one takes its
  layout — position, size and styling — matched up by *kind*, in reading order.
  A text box's kind is its named style, so a Heading 1 matches a Heading 1 and
  not just any old text. Nothing is added and nothing is deleted: only the
  arrangement travels, and it says so when there was nothing to match.
- **Layers can be renamed.** Double-click a row. Twelve rows saying
  "Shape — box" is a list you cannot navigate. Clearing the name puts the
  kind-derived one back. (Groups already worked as folders with names and
  colours of their own.)

### Added

- **The editing tools fold away.** The ribbon is about 100px of a 700px laptop
  window, and there are long stretches — reading it back, rehearsing, nudging
  one thing into place — where the page matters and the tools do not. The
  chevron at the end of the tab strip folds them; so does double-clicking a tab,
  or Ctrl+F1. The tab strip itself always stays: it is one button high, it is
  how you get the tools back, and a bar that vanishes completely leaves you no
  way to say you want it again. Remembered per project. Measured: 98px back to
  the page.

### Fixed — themes

- **Every menu, dialog and popup in the app was see-through.** `--chrome-2` is
  the surface all of them sit on, and its value carried an alpha byte — 27%
  opaque. It was worst on the theme picker, which opens over the ribbon. Every
  consumer that actually wanted translucency mixes its own with `color-mix`;
  none of them wanted this. The opaque value is the one every fallback in the
  file was already using. Two of the forest themes carried the same mistake in a
  declaration that was already dead.
- **“Dark high contrast” was the ordinary dark theme with brighter outlines.**
  It re-inked only the accent and the button faces and left every surface alone
  — not what anyone turning on high contrast is asking for. The surfaces go to
  near-black with real edges now, and the chrome added this month (the top bar,
  the tab strip, the zoom cluster, find & replace) has rules of its own.
- **“Dark colourful” had stopped colouring half the ribbon.** Its per-group hues
  are a hand-kept list, so the four groups added this month — Slides, Table,
  Animate, Page furniture — fell back to the default accent and the theme looked
  half-applied. Two groups that no longer exist have gone from the list with
  them.
- **The theme could not be changed while editing full screen.** A fullscreen
  element paints its own subtree and nothing else, and half this app's overlays
  are *siblings* of `.deck` rather than children of it — the theme picker, the
  colour picker, find & replace, the cell-pick bar, the playback spotlight.
  Fullscreening `.deck` made every one of them invisible for as long as it was
  on. It takes the root element now; `.deck` is `position:fixed;inset:0` either
  way, so it looks identical and simply stops swallowing the overlays.

### Changed — things came out of menus, and zoom found a home

Controls were folded behind dropdowns when the ribbon was short of width. It
is not short of width any more, so the ones that never belonged there came
back out.

- **The Guides menu is gone.** Rulers, Grid, Full screen and Side toolbar are
  four buttons in the View group. Each is a stateful *toggle*, and a toggle you
  have to open a menu to read the state of is a toggle nobody trusts. Two of
  them were never guides in the first place: full-screen editing and where the
  toolbar sits are things you do to the *window*.
- **Zoom moved to the bottom-right corner of the canvas.** It had been in the
  ribbon, then in the top bar, and was wrong in both — it is a property of the
  canvas, so it belongs at the canvas, which is where Word, PowerPoint, Figma
  and Illustrator all put it. It floats over the stage rather than sitting in
  its flow, so it costs no height, and it steps aside when a pane docks.

### Fixed

- **Panes stopped docking after the first session.** `moved` and `resized` were
  the same state, and the pane's own ResizeObserver fires the moment a pane is
  first shown — so every pane silently recorded a position, came back "moved" on
  the next load, and never docked again. Only a *drag* counts as a move now. The
  strip the stage reserves is also the width the pane actually has, since panes
  are resizable.

### Changed — the tabs settled down

Five tabs was one or two too many: Animate was a single group of six small
buttons under a whole tab of its own, and View held things you reach for
*while* something is selected, so a tab of their own meant leaving the tools
you were using to get to them.

- **Three tabs now: Home, Insert, Design.** Animate shares Insert — both are
  about putting something on the page and deciding how it arrives. View and
  Output went back to Home. A browser remembering one of the retired tabs lands
  on its new host rather than on a tab that no longer exists.
- **The tab follows the selection.** Every selection-driven group lives on Home,
  so clicking a figure while you happened to be on Insert or Design silently
  left its tools on a tab you were not looking at — which is how the
  lock-a-figure-to-a-commit control appeared to vanish when it had simply moved
  one tab away. Selecting something now brings you to its tools. Drawing does
  *not*: placing five shapes in a row must not throw you off Insert after each
  one.
- **The duplicate Find & replace is gone.** It acts on the whole presentation,
  so it belongs with the document's own controls in the top bar — where it
  already was. A second copy alone in a group at the far right of Home was both
  a duplicate and the worst seat in the row. One feature, one door: the top bar,
  or Ctrl+F.

### Changed — the background palette

The five backgrounds were white, cream, light grey, dark and black. Two of those
are the same idea, black is never the right answer on a projector (it crushes
every dark figure into the background and shows every speck of dust on the
lens), and none of them had been *chosen* so much as listed.

Eleven now, picked as presentation grounds: **Ink, Charcoal, Midnight, Pine,
Plum** and a **Dusk** gradient; **White (print), Paper, Mist, Sand** and a
**Dawn** gradient. The darks sit around 8–12% lightness with a little colour in
them, because a flat neutral reads as “no background” while a tinted one reads
as a decision. The lights are off-white rather than white — except White itself,
which stays because a print shop wants exactly `#ffffff`. The gradients are kept
subtle: a background you notice is a background competing with the figure on top
of it.

Both menus — the deck-wide default and the per-slide override — are now built
from **one table**, so they cannot drift apart. Each entry declares whether it
is light rather than making `pageIsLight` parse it, because a gradient has no
single colour to measure and guessing wrong flips every default text colour on
the page. The `.pptx` and PDF paths take a gradient's first stop, since OOXML
wants one colour.

### Added — the rest of the editor brief

- **Tables.** A real item kind: rows of plain strings plus a handful of
  switches, not HTML — a table you can only fill by typing HTML is a table
  nobody will use, and rows-of-strings is the shape every export already knows
  how to walk. Draw one like any other tool; double-click a cell to type, Tab
  along, Enter down; drag the boundaries to set column widths. The header row is
  a *flag*, so turning it on or off moves no data. The rules use the same
  page-relative stroke currency everything else does, because a fixed 1px
  hairline vanishes on an A0 poster and is a fence at 10% zoom. It exports as a
  genuine PowerPoint table, not a grid of rectangles.
- **Equations.** No new item kind: MathJax is on every page already and the
  slide is typeset after every render, so a text box whose words happen to be
  `$$ … $$` is typeset for free — and moves, colours, scales, exports and
  animates like any other text box. Insert ▸ Equation just starts you off with
  the delimiters and keeps the maths re-typeset as you edit around it.
- **Watermarks, headers and footers.** All three are the same thing — one piece
  of deck-level content repeated on every page, which is exactly what slide
  numbers already were. They live on the presentation, are painted after the
  annots, and so cannot be selected, dragged or deleted by accident. `{n}`,
  `{N}`, `{name}` and `{date}` do what you would expect. One painter serves both
  the canvas and the PDF/HTML export, because a second copy is how an export and
  the screen drift apart.
- **Named text styles** — Title, Headings 1–3, Body, Small, Caption, on a real
  type scale rather than seven arbitrary sizes. A box *wears* a style instead of
  carrying a pile of properties, which is what makes **“apply this look to all
  headings”** one edit to one object rather than a hunt through forty slides.
  **“Update the style from this box”** goes the other way: format one heading
  the way you want it and push that look everywhere. Size is deliberately the
  one thing “apply to all headings” does not flatten — size is what makes a
  heading level a level.
- **Marquee selection.** Drag a box on empty canvas to select what it *touches*
  — not what it fully encloses, which is unusable on a poster where the figures
  are bigger than the gap you have to drag in. Shift or Ctrl adds to the
  selection. Under the threshold it is still just a click, so “click empty space
  to deselect” is unchanged. **Ctrl/Cmd-click** now adds and removes too; half
  the world reaches for it first and it did nothing at all before.
- **Groups can be entered.** Double-click a group and you are inside it: clicks
  pick one member at a time until you leave with Esc or by clicking away. There
  was previously no way to touch a single item inside a group at all.
- **Bring forward / send backward**, one place at a time, beside the existing
  bring-to-front and send-to-back — which are **buttons in the row again**. They
  had been folded into the Arrange menu, which is why they read as a missing
  feature when they had been in the code for weeks.
- **Spotlight while presenting.** Alt+click an item — or press `Z` over it —
  and it grows out of where it sits to fill the screen, over a dimmed slide;
  Esc or a click puts it back. A plain click still advances the build: that
  gesture is what a talk runs on and cannot be overloaded.
- **Theme, Help and the app controls moved into the top bar, with words.** They
  were two bare glyphs at the end of the ribbon — the icon-only button this
  project has rejected twice — so the theme picker might as well not have
  existed. Help is new there entirely: editing hides the app bar, so from inside
  a presentation there had been no way to reach it.

### Fixed

- **Stacking order acted on one item.** Bringing a *group* to the front brought
  one member of it and left the rest behind. It moves the whole selection now.
- **A watermark sized in CSS percent** resolved against its parent's font size
  rather than the page, so a 12% watermark came out under 2px and was invisible.
  Sizing is resolved to pixels against the real page height, like text is.

### Added

- **Find and replace, across the whole presentation** (Ctrl+F, or Find in the
  top bar). It searches the *model* — every text box, list item, slide title
  and subtitle on every slide — because the browser's own find can only see the
  one slide that happens to be rendered, which for a deck is the wrong answer
  almost every time. Landing on a hit goes to that slide and selects that item,
  so you can see what you are about to change. Placed notebook cards are
  deliberately not searchable: their words belong to the notebook, and
  rewriting them here would put the slide and its source out of step with no
  way to tell.
- **Numbered lists, sub-levels, and bullets you can see the state of.** Tab and
  Shift+Tab indent and outdent inside a list, the way every outliner does.
- **Animations can be removed.** The effects are buttons on the Animate tab
  showing which one is on, `None` reads as the removal it is, and *Clear slide*
  strips a whole slide in one press instead of item by item.
- **Autosave says what it is doing** in the top bar, instead of being a File
  menu item you had to open the menu to read.

### Fixed

- **The bullet list was, in the user's word, cursed.** `a.list` drew a `<ul>`
  from `a.text`'s newlines while `a.html` — the rich version of the same box —
  sat untouched underneath it. Turning bullets off fell straight back to that
  stale `a.html`, so everything typed as a list vanished and text from before it
  came back. There is one content field now: `a.list` says `bullet` or `number`
  and the items live in `a.html` as bare `<li>`s, so switching markers rewrites
  no content at all. `ul`/`ol`/`li` joined `RICH_TAGS`, which is what lets bold
  inside a bullet and a nested sub-level survive a round trip — they were
  silently flattened to plain lines before.
- **Images grew a bigger border instead of a bigger picture.** `.an-imgel` is
  `object-fit:contain`, so a free-form box that no longer matched the picture's
  shape just grew letterbox: drag a wide photo downwards and the selection
  outline got taller while the photo stayed exactly the size it was. A picture
  now behaves like a picture — the stored box is snapped onto the image and the
  aspect held for the drag, with Shift to stretch it on purpose. A cropped image
  keeps free-form resizing, because there the box *is* the crop window.
- **Arrows and lines moved when you went to present.** An attached endpoint is
  derived from where its target is on the layer, and `annotRectPct` measures the
  rendered element for anything auto-sized or aspect-fitted. An arrow drawn in
  the same pass as its target measured an element that was not in the DOM yet
  whenever the target came later in the array, and fell back to its stored
  coordinates. Arrows are drawn in a second pass now, which makes attachment
  order-independent; and because a figure frame settles into its fitted box
  asynchronously, a fit that actually moves a frame asks for the arrows alone to
  be redrawn.
- **An animated arrow was on the slide from the first frame.** Its visible
  stroke carries no `.an-item` class — the invisible hit path under the items
  does — so the build pass never reached it.
- **Thumbnails showed the notebook cells and nothing else.** `miniDiagram`
  walked `slideCells()` only, so a slide made of text, arrows, shapes or images
  showed as an empty box and every such slide in the strip looked identical. It
  draws every kind at its page percentage now. Type and stroke get a floor,
  which is the opposite of the rule `fontPx` follows on the real page and
  deliberately so: the page is the document and must stay true to itself, a
  thumbnail is an index and has to be legible.
- **Thumbnails never updated while you worked.** The strip was only rebuilt by
  `refresh()` — a slide change, a layout, a reorder — so editing the slide you
  were looking at never touched its picture. `markDirty` now refreshes that one
  row, debounced.
- **Panes covered the page they were about.** Layers, Animations, Versions and
  Print check are all lists you consult *while* working on the thing underneath.
  The stage gives up the width now and the page re-fits into what is left. A
  pane you have deliberately dragged elsewhere still floats — that is a choice
  you made.
- **The page was sized to the stage's border box.** `clientWidth` includes
  padding, so every rule that reserved room by padding the stage — the side
  toolbar, and now a docked pane — reserved nothing at all as far as the fit was
  concerned, and the page carried on sliding underneath whatever was meant to be
  beside it.
- **Renaming a presentation.** Three doors, no shared implementation.
  `#pres-name` lives in a block that is `display:none` the whole time you are
  editing, so File ▸ Rename… was focusing a 0×0 input and appeared to do nothing
  in the primary flow; and the input renamed on every *keystroke*, deleting the
  draft under each prefix on the way, so renaming "talk" to "talk2" left ghosts
  at "tal", "ta" and "t". One `renamePresentation()` now, committed on Enter or
  blur, with a collision guard, that moves the draft and the saved copies and
  not just the label.

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
- **Saved presentations open from everywhere notebooks do.** The Open
  dialog's folder listing shows `.junoview` files with their own 🎞 row
  (they used to be invisible there — on disk they just wear the default
  browser's icon); clicking one opens it straight into the editor. A
  pasted path, a pasted GitHub link (blob links normalise to raw, like
  notebooks), the *Choose files…* picker and drag-and-drop onto the
  window all route a `.junoview`/`.junoview.html` to the same importer.
  Verified live against the local server for both the folder-listing
  click and the GitHub-link paste.
- **A file-saved presentation can always come back.** Saving to a
  `.junoview.html` file used to *delete* the browser copy, and nothing
  ever read the file back — save, close the browser, locked out. Now the
  browser keeps its copy; a still-permitted remembered file is re-read at
  startup and anything missing re-listed; **+ New… → Open a .junoview
  file…** opens one from the launcher (no editor needed first); and the
  saved file's own landing page says exactly that.
- **Text boxes drag by their body again.** The text span swallowed every
  mousedown for caret purposes even when not editing, so a text box
  showed a move cursor but could only ever be *selected* — the drag never
  started. It only owns the mouse while you are typing now; this also
  restores shift-multi-select on text. A freshly drawn box also opens
  ready to type — the caret never actually landed before (focus on a
  non-editable span is a silent no-op).
- **Present mode no longer resizes everything.** A 16:9 deck presented on
  a canvas shaped like the *window*, while text and cell zoom key on
  canvas height — everything grew ~19% at 1400×900 and by a different
  amount on every screen. Playback letterboxes to the page now, exactly
  as posters always did; and Esc from a presentation returns to wherever
  you presented from (the third exit route that still dumped you in the
  builder).
- **Copy/paste works even with a screenshot on the clipboard.** Paste
  checked the system clipboard before the internal buffer, so one stale
  image shadowed every internal copy forever — Ctrl+C said "1 item
  copied", Ctrl+V pasted the screenshot. A fresh copy now stamps the
  clipboard and outranks it; Ctrl+V also works where the native paste
  event never fires; Ctrl+D is advertised on Duplicate.
- **Slides: drag-reorder visibly works, and ⧉ duplicates.** An internal
  thumbnail drag lit the full-window "Drop .ipynb files" overlay over the
  editor for the whole gesture, drowning the drop markers; the overlay
  now only answers real file drags. Each slide row gains a duplicate
  button — decks never had one.
- **Rename works in the editor again.** The rename input lived inside the
  builder-controls block, which is hidden while editing — *File →
  Rename…* un-hid an input inside a `display:none` ancestor: 0×0,
  unfocusable, nothing visible. It has its own home in the column now.
- **Laptop ribbon density.** On 1366–1440px screens the fit ladder ran
  all the way to its smallest type while the font picker and size box
  kept their full widths — tiny mashed buttons beside roomy boxes. The
  ladder now spends box width before type size; at those widths the
  small-type rung no longer fires at all.
- **New text boxes are clean.** No "Text" placeholder to delete, no
  default panel behind them, no smudgy text-shadow; a box you type
  nothing into removes itself when you click away. The colour button
  names what it recolours — **Text**, **Border** or **Line** — instead of
  a vague *Colour* beside *Fill*. A true **red** joins the swatches, the
  custom picker's **recent colours** appear in both colour menus, and
  hovering any swatch **previews the colour live** on the selected item
  (leave restores it; nothing is saved or undoable until you click).
- **Ctrl+S saves** to wherever "Saved to" points, and clicking the
  "autosaved to browser" readout saves rather than opening a picker.
  With nothing selected, ↑/↓ (and PgUp/PgDn) walk the slides. The margin
  grid fills the page exactly instead of stopping partway. **Objects** is
  now called **Layers** and **Animations** is the **Animation pane**. The
  crop menu no longer scatters its options outside the panel, an edge
  trim under a shape crop takes rectangular effect instead of silently
  doing nothing, and PowerPoint export counts *every* crop it drops.
- **Crop is usable: drag the edges.** The crop menu "worked" but its
  most inviting option, *Rectangle*, was secretly the no-crop state — a
  click that did nothing, twice reported. It is honestly labelled **No
  crop** now, and the menu's first action is **✂ Trim by dragging the
  edges**: four accent handles on the selected frame, live inset preview
  as you drag, Esc (or reselecting) leaves the mode without touching the
  selection.
- **Resizing an image letterboxes instead of cropping.** `object-fit:
  cover` was unconditional, so any non-proportional resize silently
  clipped the picture (diagnosed and the fix verified in-browser by a
  workflow agent: a 2:1 stripe resized tall showed only ~21% of its
  width). Uncropped images now `contain` at any frame shape; any crop —
  shape or edge trim — still fills first so the mask bites pixels, on
  cells too.
- **The left column corrected to the user's design.** It runs the full
  window height — nothing above it — and its top holds the **notebooks
  content** (every notebook the presentation uses, with open/refresh and
  view-on-click), not a back button; the strip's ↩ header row is the way
  back. The ribbon starts at the column's right edge.
- **The editor layout the user designed: full-width ribbon, everything
  document-level in the left column.** The ribbon is now a direct child
  of the editor (spanning the whole window like the document view's app
  bar) instead of living inside the stage column, and the document
  actions — **↩ Notebooks**, then **File / Save / undo / redo / the save
  readout**, then the slide thumbnails — live permanently in the left
  column, for posters too. The ribbon holds only editing tools. The
  whole borrow-and-restore machinery (fileToRibbon/fileToPanel) is
  deleted with nothing to borrow, and the save readout sits under Save on
  its own line, where its renames cannot move a ribbon control by
  construction. Measured: ribbon at x=0 full width; column order
  Notebooks → File/Save → undo → readout → thumbnails; File menu and
  Save verified working from the column on deck and poster alike.
- **Present never hides, the seam is marked, and leaving Present puts
  you back.** Selecting an item used to stand the Output group down, so
  Present vanished on an ordinary click; it is part of the constant half
  now. A **double rule** marks the seam between the always-there controls
  and the ones a selection brings, so the two regions read as regions.
  Present's permanent accent fill also read as "stuck pressed" — it is an
  accent outline now, filling only on hover. And exiting a presentation
  started from the editor returns **to the editor**, not to the builder
  you then had to climb out of.
- **The editor is full-width, and Notebooks sits above the slides.** The
  editor used to start right of the presentations rail, so the rail's
  176px came out of the ribbon on every screen — part of why a laptop's
  toolbar ran out of room. It now spans the whole window (161px more
  ribbon at 1400px), and the way back — **↩ Notebooks** — sits at the top
  of the slide-thumbnail column, where the covered rail's button used to
  be.
- **Fixed: the four old "+ New …" buttons never actually left.** The
  single "+ New…" menu shipped a day ago, but `.pr-btn` sets
  `display:flex`, which beats the UA's `[hidden]` rule — the house trap
  this codebase documents in its own CSS — so the originals kept
  rendering underneath it. One `[hidden]` override fixes it; the rail now
  really is one button, with the four choices in its menu.
- **Fixed: raw `aria-haspopup=` text in the editor's top-right corner.**
  Removing the dark/light toggle also ate the *opening tag* of the
  editor's palette button, which stranded its attributes as visible page
  text and left the editor without a theme picker at all. Restored, with
  the picker verified opening all seven themes.
- **The last unthemed surfaces joined the themes.** The top bar, the
  presentations rail, the tab row and the sidebar nav each sat on their
  own hardcoded navy (`#0a141d`, `#0d1a26`, `--chrome`) that no theme
  touched, so Forest left islands of the old blue behind. All four are
  token-driven now — Dark keeps the exact original colours, Forest turns
  the whole frame green.
- **Variables live with the sections hamburger.** The x² button sits
  right beside the sidebar toggle — the two indexes of a document, its
  sections and its names, side by side — instead of up in the View group.
  The sidebar's *Sections | Variables* tab switch is gone with it: the
  sidebar is the sections list, full stop, and variables only ever open
  as the floating pane (filters, type chips and jump-to-cell all intact).
- **Themes v2: one picker, and the whole chrome actually changes.** The
  dark/light toggle is gone — light and dark are **themes** now, in one
  palette menu: *Dark*, *Light*, *Dark forest*, *Light forest*, *Dark
  forest with blue buttons*, *Dark colourful*, *Dark high contrast*. Two
  real bugs were why the first pass "only changed the central page":
  every button's resting face was hardcoded white-alpha (now token-driven,
  so themes re-ink borders, fills and text of every button, tab and rail
  row); and the legacy `--cyan` alias was defined on `:root`, where CSS
  resolves `var(--accent)` **once** and inherits the frozen result — so
  the hundreds of rules using `var(--cyan)` ignored every theme. The
  alias now resolves per element. *Dark colourful* is finally visible:
  each zone's buttons carry their hue **at rest** — amber File, blue
  Filters, green View, pink Sizes, purple rail and App.
- **Icon tokens can no longer fail silently — and one had.** The icon
  substituter had two quiet failure modes: a key containing a digit never
  matched its pattern (the raw token shipped to the page as an inert
  element), and an unknown key was replaced with nothing (the icon simply
  vanished and nothing complained). Auditing for the second found a real
  casualty: **Unhide all** had been shipping without its eye icon for
  weeks. The icon is restored, keys may contain digits now, and both
  failure modes are fatal at build time with the offending key named — a
  test also cross-checks every token every template uses against the
  defined set.
- **The app bar behaves on a monitor.** The App group was pinned to the
  right edge, so a wide screen's whole spare width became one void between
  View and it, and its 28px icon squares read as lost crumbs. It packs
  left now (same rule as the editor ribbon — leftover space lives at the
  end), its buttons grew to 34px, the File group got its missing margin,
  and the **colour-scheme picker joined it** — so schemes are choosable
  from the document view too, not just the editor.
- **Variables detach into a pane.** The sidebar's Variables tab can pop
  out to a right-hand pane (View → Variables) — the same draggable,
  resizable, remembered shell as the editor panes. The panel node *moves*
  rather than copies, so the search filter, ordering, and every
  jump-to-cell link keep working; switching notebook tabs swaps the pane's
  contents. And it grew **per-type filter chips** — hide *imports*,
  *plotting*, *values*, any kind — because "remove imports" is the first
  thing anyone wants from a variables index. (Clicking a variable's name
  or any of its use-sites already jumped to that cell in the notebook —
  from the pane too.)
- **The save readout can never sit on other controls, and last
  session's file no longer hijacks your saves.** The readout renames
  itself between toolbar fits ("" → "autosaved to …"), and a wider
  readout after the last fit could print across live controls. Any text
  change now re-judges the bar; the readout has its **own drop rung** —
  after the density ladder (which usually saves it), before anything
  clips — and a hard 30-character cap with the full text in its tooltip.
  Separately, a file picked in an earlier session stayed the silent
  autosave target forever; now the remembered file only stays active
  while the browser still grants write permission — otherwise saves fall
  back to the browser and the readout says **browser**, with the file one
  click away.
- **Cell text no longer changes size when you zoom.** A placed notebook
  cell's body (markdown, tables) rendered at fixed screen sizes while
  everything else on the page was page-relative — so zooming changed its
  size *relative to the poster*. The body now scales in the same
  720-reference currency as text and line weight; exports render at that
  reference so they are untouched. Measured: text/slide ratio steady to
  0.3% across a two-step zoom.
- **One "+ New…" button, and delete where the thing is.** The rail's four
  "+ New" buttons collapsed into one menu (Presentation / Poster / Custom
  view / Folder), and every rail row shows a ✕ on hover — delete with a
  confirm, instead of a trip through File → Delete presentation.
- **The Notebooks pane stays open through its own actions.** Clicking a
  notebook row or *Open notebooks* / *Refresh all* used to close the pane
  — the old dropdown's habit. It re-renders its statuses and stays; only
  the cross or the toolbar button closes it.
- **The save readout is a door.** *"autosaved to browser"* is one power
  cut from gone, so when saves are browser-only the readout is clickable
  — its tooltip says so, and clicking opens the save-to-file picker.
- **Colour schemes, and the app buttons the editor was hiding.** The
  theme toggle and the support link live in the app bar — and editing
  hides the app bar, so from inside a poster there was no way to reach
  either. Both now also sit at the far end of the editor toolbar, along
  with a new **palette button**: five colour schemes — *Classic cyan*,
  *Dark colourful* (each ribbon group gets its own accent hue — amber
  File, blue Slide, green View, pink Output, purple Insert), *High
  contrast*, *Forest*, and *Forest with blue buttons*. Your choice is
  remembered.

  Under the hood every chrome accent and dark surface became a **token**
  (`--accent`, `--chrome-0…4`), so a scheme is nothing but a
  re-definition — and *content is deliberately not themed*: page
  backgrounds, item colours, colour swatches and every export keep their
  own literals, because a swatch that looked green but applied coral
  would be a lying control.
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
