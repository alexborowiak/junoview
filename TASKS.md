# TASKS.md — the junoview feature backlog

Distilled 2026-08-24 from a set of "what people wish presentation software
did" brainstorm notes, filtered and adapted to what junoview actually is: a
static, stdlib-only, notebook-first renderer with a deck editor. Anything
needing live multi-user infrastructure, audio capture, or a hosted backend
was cut (real-time co-editing, shared comments/change-tracking, live polls
and audience Q&A, speech analytics, generative-media AI).

## How to work this file

- Work 2–4 related tasks per session. One commit per task; tick the box in
  the same commit. Add a dated note under a task if you discover something
  (partial existing support, a blocker, a descoping decision).
- **[deck.js]** tasks touch the single ~18k-line IIFE — never run two of
  them in parallel sessions. Respect the boot-sequence rule (CLAUDE.md).
- Anything that changes rendered page bytes must update `EXPECTED_MD5` in
  `tests/test_characterization.py` in the same commit, with the reason.
- **(design first)** means: write a short design note (schema, interaction
  with existing features, migration) and get it agreed before coding.
- Sizes: **S** = part of a session · **M** = a session · **L** = multi-session.
- Suggested batch order: group 1 quick wins first (T1–T6), then figures
  (group 3 — the scientific core is the differentiator), then structure,
  styling, presenting. Group 8 refactors run alone, with nothing else in
  flight.
- **Groups 1–8 are all ticked and are now the design record: what was
  built and why. GROUP 9 IS THE LIVE QUEUE** (2026-08-26) — what the
  audit of that shipped work found. Each entry is a theme, and the
  entries run roughly worst-first, so take them from the top — and read
  the two caveats at the head of the group before believing any single
  finding in it.

Repo-wide code rules live in [AGENTS.md](AGENTS.md); machine notes in
[CLAUDE.md](CLAUDE.md).

---

## 1. Editor quick wins — [deck.js], strictly sequential

- [x] **T1 · S — Paste in place / paste at cursor.** Two paste modes:
  "paste at same location" (source slide coordinates, for cross-slide
  consistency) and "paste at current location" (pointer/viewport). Menu
  entries + shortcuts.
  *2026-08-24:* `pasteBuf` now takes a mode — `auto` (Ctrl+V, the old
  rule), `place` (Ctrl+Shift+V) and `here` (Ctrl+Alt+V). The menu is a
  new CANVAS RIGHT-CLICK MENU, because a right-click is the only door
  that knows where you clicked; it reuses the film strip's `menuHead`/
  `floatAt` helpers. Two latent paste bugs fell out on the way: an
  arrow's bend corners stayed behind, and its attached endpoints
  (`c1`/`c2`, indexes into the SOURCE slide) followed the paste onto
  other slides and tied themselves to whatever sat at that number.
- [x] **T2 · S — Clone objects.** Duplicate-in-place with a small offset;
  Alt-drag to clone. Clones are independent copies (linked instances are
  T13).
  *2026-08-24:* one `cloneAnnots`, used by Ctrl+D, the Objects pane's
  Duplicate and the new Alt-drag. Ctrl+D acted on `selAnnot` alone
  before, so it duplicated ONE item of a five-item selection. Groups
  survive as new groups. Alt was already the "ignore snapping" modifier
  mid-drag; a clone drag exempts itself, since you have to keep Alt held
  for the whole gesture.
- [x] **T3 · S — Object locking, granular.** Lock flag per object with
  modes: fully locked, or "position locked but resizable". Locked objects
  are skipped by marquee-select unless a modifier is held.
  *2026-08-25:* `a.lock` is now `1` (full, the value every saved deck
  already carries) or `'pos'`. `lockMode` is the only reader; every call
  site asks `pinned` (movement) or `lockedAll` (reachability). The
  marquee modifier is Alt — Shift and Ctrl already mean "add to the
  selection". Set it from the right-click menu (worded) or the Objects
  pane's lock button, which now cycles the three states.
- [x] **T4 · S — Temporary design guides.** Draw guide lines/boxes that
  exist only in edit mode — never rendered in present mode or any export.
  *2026-08-25:* guide LINES already existed (dragged off a ruler, edit-mode
  only). This adds guide BOXES on the same model — `pres.guides.b`, drawn
  in the `.cguides` host, so they inherit every existing exclusion
  (`.deck:not(.editing)`, `@media print`, `#print-root`) for free. The
  real guarantee is that a guide is NOT an annotation: it forks off
  before `startDraw`, so there is nothing in `s.annots` for a render or
  an export to have to filter out.
- [x] **T5 · M — Select by type / appearance.** "Select all caption text
  boxes", "select everything using this font/size/colour". Foundation for
  T6.
  *2026-08-25:* `SELECT_CRIT` is the criteria table; a criterion is a
  (key, value) pair read off a reference object, deliberately a VALUE so
  T6 can run the same question deck-wide. The `type` criterion reuses the
  existing `typeKeyOf`/`typeLabel` vocabulary from the Apply dialog
  rather than inventing a second one. Two doors, neither costing ribbon
  width: the canvas right-click menu (inline, with counts) and one
  Arrange row.
- [x] **T6 · M — Find & replace: text and formatting.** Deck-wide text
  replace, plus a formatting variant (every 18px font-A → 20px font-B).
  Builds on T5's matcher.
  *2026-08-25:* deck-wide TEXT replace already existed; this adds the
  formatting half as a second mode in the same popover. Find is T5's
  `SELECT_CRIT`, seeded by example off the selected object; change is a
  short field list (typeface, size, colour) — copying a whole look onto
  a type is the Apply dialog's job and it already does it. The sweep
  rule deliberately differs from the selection rule: it includes
  `hide`den objects, because `hide` means "hidden while editing, still
  shown when presenting" and skipping them would leave the talk in the
  old face.
- [x] **T7 · M — Snap to nearby objects + spacing guides.** Snapping
  candidates from neighbouring objects' edges/centres, and equal-spacing
  distribution hints while dragging (Figma-style badges).
  *2026-08-25:* snapping to neighbours' edges/centres (`snapTargets`) and
  equal-gap detection (`bestGap`) already existed. What was missing was
  the half the code's own comment promised: a gap was kept as a bare
  number, so the pair it was measured between was lost and only ONE bar
  was ever drawn. Gaps now carry their pair, both are marked (solid for
  the one being made, faint for the one it matched), and each carries the
  distance in millimetres — reusing `.dragtag`, a readout style that had
  been sitting in the CSS unwired.
- [x] **T8 · M — "Match layout" command.** Select objects plus a reference
  group; apply the reference's alignment/spacing pattern ("make these three
  look like the four above"). Reuses T7's geometry helpers.
  *2026-08-25:* a third kind of matching, armed through the existing match
  bar as `dir:'layout'`. `readPattern` extracts axis / alignment rule /
  median gap / start; `applyPattern` writes it by DELTAS (rendered rects
  are not `a.x`). The cross-axis position is deliberately not copied, so
  the objects tidy into their own band. Browser verification caught the
  reference group swallowing the slide-wide empty frame — `bandMates` now
  requires members to sit BESIDE each other along the run, not just share
  a band.
- [x] **T9 · M — Slide cleanup.** One command that *reports* near-
  misalignments, uneven gaps, and near-duplicate objects, then applies
  fixes selectively (report-first, never silently rearrange).
  *2026-08-25:* `#tidypane`, a third pane in the shell `#preflight` and
  `#stdpane` share — and for the same reason `#stdpane` is separate: a
  finding here carries chips AND an action, which a whole-button
  preflight row cannot hold. The tolerances (`TIDY_NEAR`, `TIDY_APART`,
  `TIDY_GAP_REL`) are the design: below one it is already aligned, above
  the other it is a decision. Reached from the Arrange menu.
- [x] **T10 · L — Per-object history (design first).** Per-object action
  log plus a small thumbnail timeline viewer ("what has this object looked
  like"); "undo just this object" where the ops don't conflict. Design
  note must settle interaction with the global undo stack.
  *2026-08-25 — the design note, which the code carries in full under the
  WHAT HAS THIS OBJECT LOOKED LIKE banner:*
  1. **Derived, not recorded.** `undoStack` already holds a whole-deck
     snapshot per step. An object's past is those snapshots read through
     its identity, so there is no second log to keep in step and the
     timeline cannot contradict Ctrl+Z. Cost is zero until you look.
  2. **Restoring is an EDIT, not a rewind** — this settles the
     interaction the task asked about. It writes the old state onto the
     object as it stands and takes one ordinary undo entry; nothing is
     popped off the global stack, so the two mechanisms never touch the
     same data and cannot conflict. Ctrl+Z then undoes the restore.
  3. **Schema:** one new key, `a.oid`, minted lazily by `ensureOids` from
     `renderAnnots` (the one funnel) and re-minted on duplicates, so no
     copy site has to strip it. **Migration:** none — decks without oids
     get them on first render, and Python copies annots wholesale so the
     key survives a save.
  Scope is one slide, deliberately: the question is asked about a thing
  you are pointing at.
- [x] **T11 · L — Customisable ribbon (design first).** Reorder/hide
  ribbon buttons, persisted per user. HARD INVARIANTS: the ribbon never
  wraps to a second row (custom layouts still pass through
  `fitEditRibbon`), and buttons stay words + icons, never icon-only.
  *2026-08-25 — the design note, carried in full under the A RIBBON OF
  YOUR OWN banner:*
  1. **Scope:** individual controls, within their existing group. Never
     between tabs — a tab is a promise about where things are.
  2. **Storage:** `jv-ribbon`, deliberately UNSCOPED (every other pref is
     `+SCOPE`). A ribbon layout is a fact about the person, not the deck.
  3. **Hiding:** a `.rbn-hid` class, never `hidden` — `hidden` is owned
     by `showFmt`/`FMT_KINDS` and the two would fight. `display:none`
     also costs the fit ladder nothing, so hiding really buys room.
  Both invariants hold by construction: no label is ever changed, and
  `fitEditRibbon` re-runs after every change. Reached by right-clicking
  the ribbon, which costs the row no width.

## 2. Styling, layout, text

- [x] **T12 · M — Design tokens in style sets.** Extend style sets with
  named tokens (spacing scale, corner radius, accent colours) that
  *cascade*: changing a token updates every element referencing it, rather
  than elements holding baked-in copies.
  *2026-08-25:* `pres.tokens` = `{c:{…}, rad, gap}`. An item references a
  colour by storing `'@accent'`; `tokVal` is the one resolver and is an
  IDENTITY for every non-reference, which is what made it safe to thread
  through a renderer this size. Radius and gap need no per-item
  reference — one value per deck, written onto the slide as `--tk-rad`
  and read by the arrange verbs. A style set may carry a `tokens`
  sibling. Both `normPres` and `_as_presentations` keep the key, with a
  sentinel in the schema-parity test.
- [x] **T13 · L — Reusable components (design first).** Define a named
  component from a selected group (e.g. `FigureCaption`); instances stay
  linked; editing the definition updates every instance; per-instance
  content overrides (text, image). Builds on the slide-presets work.
  junoview owns its deck JSON, so unlike pptx this *is* serialisable —
  schema work lands in T33 first. *(The entry said T30; the schema task
  is T33 — corrected 2026-08-25.)*
  *2026-08-25 — the design note, carried in full under the COMPONENTS
  banner:*
  1. **What travels** is `MATCH_PROPS`, already argued and already used
     by three features: geometry + look, never content. The per-instance
     overrides the task asks for are exactly the fields it refuses.
  2. **Geometry is relative** to the component's own box, so an instance
     places anywhere. A component therefore has one intrinsic size and
     instances are not resized as a unit — a real limit, stated.
  3. **Three fields** identify an instance: `cmp`, `ci`, `cinst`.
  4. **Updating is a re-stamp**, and losing local edits IS staying
     linked. `Detach` is the escape hatch.
  5. **Schema:** `pres.components`, deck-level, carried in `normPres`,
     `_as_presentations`, the undo snapshot and DECK-FORMAT.md.
- [x] **T14 · L — Relative layout & anchoring (design first).** Opt-in
  per object: size as % of slide, edge anchoring, centring — so a slide-
  size change or a longer title reflows instead of exploding. Explicitly
  NOT a full constraint solver; scope the minimal useful subset.
  *2026-08-25 — the design note, carried under the ANCHORING banner:*
  **Half of this was already true.** Size and position are ALREADY
  percentages of the page — that is the whole coordinate system, and
  there is nothing to opt into. What was missing is that the two
  percentages are of different things, so the *relationship* between
  items does not survive a change of page SHAPE.
  **The subset:** one anchor per item, `a.anch`, naming a corner or edge
  midpoint. One and not two, because an anchor per axis is what a
  constraint solver grows out of.
  **Resolved at render, never baked** — rewriting x/y would put the
  current page into the model. `anchorFix` then re-places anchored items
  from what they MEASURED, because the items that most want anchoring
  (auto-height text, aspect-fitted frames, shrink-to-fit boxes) are
  exactly the ones whose size is not stored.
- [x] **T15 · M — Text auto-fit and overflow.** Predictable shrink-to-fit
  toggle and a visible overflow indicator in the editor. NOT multi-box
  text flow (descoped).
  *2026-08-25:* the design decision first — text has no height to
  overflow (`a.h` is not a text property, and three places say so), so
  the fit target is a separate opt-in `a.fh`: the height you ask the
  WORDS to live within, not the box's. The box still grows, which is
  what keeps an overrun visible rather than clipped. Shrinking is a
  render-time `--an-fit` multiplier, never a rewrite of `a.size`, with a
  `FIT_MIN` floor — past it, it stops and marks the box instead.
- [x] **T16 · M — Math in deck text.** LaTeX in deck text boxes via the
  already-pinned MathJax. Must work in exports and offline (the sw.js
  precache pins must keep matching loaders — `tests/test_js_contract.py`).
  *2026-08-25:* almost all of this already shipped — the equation editor,
  the palette, MathJax on every page, `inlineMath ['$','$']` configured,
  and exports that bake in the RENDERED formula (`afterTypeset` before
  `outerHTML`), so offline export was never at risk. What was broken was
  one gate: the re-typeset check asked whether a box IS an equation
  rather than whether it CONTAINS one, so inline `$x$` inside a sentence
  was thrown away by every layer rebuild. Split into `isMaths` (the
  editor button) and `hasMaths` (the typeset gate), plus a typeset at
  the text commit, which never rebuilt the layer at all.

## 3. Figures — the scientific core

- [x] **T17 · M — Figure + caption as one object.** An attached caption
  that moves/scales with its figure and survives layout operations.
  *2026-08-25:* a TIE, not a group — `cap` on the figure, `capOf` on the
  caption. Not a group because the relationship is asymmetric, because
  `matchKey`/`typeKeyOf` must still see a caption as a caption, and
  because T18 needs "the caption of figure N" to have an answer. The
  follow-hook lives in `shiftAnnot`, so every mover gets it free; the
  drag path repeats it with its own snapshot. `dropTiedCaptions` stops a
  caption moving twice when it is selected alongside its figure — found
  in the browser, not by the suite. `isFigure` is the one definition of
  what counts, so T18 cannot number a different set.
- [x] **T18 · M — Auto figure numbering + cross-references.** "Figure N"
  numbered by deck order; inline references ("see Figure 7") renumber when
  slides move. Depends on T17.
  *2026-08-25:* the number is NEVER stored. `{fig}` in a caption and
  `{fig:id}` anywhere else resolve at render, the same way `furnText`
  already resolves `{n}`/`{N}` for the header and footer. Numbering is by
  `orderedIdx` — hoisted out of the animation pane so a figure's number
  and its build order cannot disagree — over `isFigure`, T17's single
  definition of what counts. A reference to a deleted figure says so in
  words instead of showing a wrong number.
- [x] **T19 · M — Figure provenance panel.** Show which notebook/cell
  produced a deck figure (`chains.py` already knows lineage), a jump-to-
  source affordance, and a staleness flag when the notebook output is
  newer than the deck's snapshot.
  *2026-08-25, with T20 in the same commit — they are one pane and one
  piece of machinery.* Staleness is answered honestly: this format has
  no timestamp anywhere, so "newer" is unanswerable, but "does the live
  card still say what the deck saved" is exact and is the question that
  matters. With the notebook shut it says there is nothing to compare
  against rather than guessing.
- [x] **T20 · M — Update figures from source.** Re-sync deck figure
  snapshots from a re-executed notebook while preserving position, crop
  and size — regenerate 30 figures, deck updates itself. Respects the
  "renderer never executes notebook code" invariant: the notebook is
  re-run by the user; junoview re-reads stored outputs. Note the embedded-
  snapshot design (figures live outside the pres object for localStorage
  quota reasons).
  *2026-08-25, committed with T19.* Most of this was already true: a
  frame resolves by ref at render, so a re-run notebook shows through the
  moment it is reopened. What was missing was the deliberate per-figure
  act. Position, crop and size survive by CONSTRUCTION — they live on the
  annotation, which `resyncFigure` does not touch — rather than by being
  copied back.
- [x] **T21 · M — Non-destructive crop/resize + hi-res originals.** Crop
  as a view transform over retained original bytes; exports choose an
  appropriate resolution. Watch localStorage quota (same note as T20).
  *2026-08-25:* crop was already a view transform; the SHRINK was the
  destructive part. The original now goes to IndexedDB under `a.okey`
  and `a.src` keeps a display-sized copy, which is both the quota fix
  the `IMG_MAX_EDGE` note asked for and the resolution fix. Exports swap
  the originals in through `afterTypeset`, the one place every export
  path already shares. Verified: a 5.4MB picture shows as 1.1MB on the
  page, sits at 5.4MB in IndexedDB, and leaves the localStorage draft at
  one byte.
- [x] **T22 · S — Figure consistency lint.** Flag mismatched fonts/sizes/
  margins across a deck's figures where metadata allows. Can land inside
  T32's lint framework. *(The entry says T32; the lint framework task is
  T35 — noted 2026-08-25.)*
  *2026-08-25:* renders into the `standardise()` pane, which already asks
  "does the deck agree with itself" — same question, different material.
  "Where metadata allows" is narrow and the code says so: a PNG carries
  no font name and cannot be asked; an SVG's text nodes can; and the size
  a figure is shown AT is a fact about the deck rather than the figure,
  which is why it is both the most useful finding and the only one that
  applies to everything. The typeface finding deliberately has no fix
  button — that fix is in the notebook.

## 4. Deck structure & navigation

- [x] **T23 · M — Sections as first-class objects.** Group slides into
  sections that move/duplicate as a unit, with section-scoped numbering,
  template and transitions, and section navigation in present mode.
  *2026-08-25:* most of the model already shipped. Added `moveSection`
  and `dupSection` (the run as one thing; the copy gets a new id and a
  new name) and `{sn}`/`{sN}`/`{sec}` beside the existing `{n}`/`{N}`,
  so section numbering is a choice rather than a reversal of the
  deliberate global-numbering decision.
  **Not done here, and honestly: section TRANSITIONS.** There is no
  slide-transition model anywhere in this codebase — no `s.trans`, no
  cross-fade, nowhere to hang one — and inventing that substrate is T27's
  job, which needs it for Magic Move. Section navigation in present mode
  is T26's overview map. Both are tracked; neither is quietly skipped.
  *Both landed: T26 shipped the overview map, and T27 built the
  transition model with a section-level default — "how its slides
  arrive" is on the section's own menu, so this paragraph is now
  answered rather than outstanding.*
- [x] **T24 · M — Optional slides + named cuts.** Mark slides optional;
  define named cuts ("45-min", "20-min", "5-min") as subsets of one deck —
  no more three diverging files. Easier after T23.
  *2026-08-25, with T25 in the same commit — one model, and T25 is three
  lines once this exists.* Membership is `opt`/`cuts` ON the slide (the
  argument `s.sec` already made); `pres.cuts` holds only names. A slide
  naming no cuts is in EVERY cut, so an existing deck is already a
  complete "everything" version. The filter lives in `advance`/`backStep`
  — the two verbs a talk runs on — and never in the editor.
- [x] **T25 · S — "Running late" mode.** One control in present mode that
  skips the remaining optional slides. Depends on T24.
  *2026-08-25, committed with T24.* From the CURRENT slide onward, and
  deliberately not a cut: you do not choose it before the talk, you reach
  for it at minute 34.
- [x] **T26 · M — Deck overview map.** A zoom-out overview: sections →
  slides as a navigable map. This is the realistic scope of the "infinite
  canvas" wish — an overview/navigation layer, not canvas-based authoring.
  Depends on T23.
  *2026-08-25:* an overlay, not a pane — it wants all the room there is
  while you look and none afterwards, which is the shape the spotlight
  and presenter view already have. It draws `sectionRuns()` clusters of
  `miniDiagram()` tiles and reads optional/cut membership through the
  same `slideSkipped` the playback filter uses, so it cannot disagree
  with the strip it zooms out of. Reached from the strip's own view
  menu, which is already where "how do I want to look at this deck" is
  asked.
- [x] **T27 · L — Object continuity transitions (design first).** The same
  object appearing on consecutive slides animates between its two states
  (move/scale/zoom-into-region) — Keynote "Magic Move". The existing
  frames + slide-matching machinery is the starting point.
  *2026-08-25.* Design note at `HOW A SLIDE ARRIVES` in deck.js. Four
  decisions worth naming:
  **(a) There was no transition model at all** — not a missing feature, a
  missing FIELD. So `s.trans` comes first, per-slide because that is how
  anyone thinks about it, with a SECTION default, which is the substrate
  T23 said it lacked.
  **(b) Identity across slides was the hard part and was already solved.**
  T10's `oid` is de-duplicated within a slide but never across them, so a
  DUPLICATED slide keeps its source's oids — which is exactly how anyone
  builds a Magic Move. `matchKey` + reading order is the fallback for two
  slides built separately.
  **(c) FLIP, so no second renderer exists.** Measure the outgoing items,
  let `renderSlide` rebuild the page as it always does, put the survivors
  back with a transform and take it away. Nothing is drawn twice, and if
  anything goes wrong the page underneath is already correct.
  **(d) It composes with rotation.** `applyCommon` owns `transform` for
  `a.rot`, so the FLIP transform is PREFIXED and removed by restoring the
  original string — clearing it would un-rotate every rotated object
  mid-talk. Verified in a browser: mid-flight the matrix keeps the 30°
  components while translating, and lands rotation-only.
  Verified over CDP as an A/B on one deck: with Cut the object is at its
  new place the instant it arrives (38.9%); with Move it starts beside
  where it was (12.2% against 10.0%) and lands on 38.9%.
  **Reduced motion is honoured deliberately.** `core.css` already kills
  every transition under `prefers-reduced-motion`, so the animation could
  not have played anyway — it would have gone through the motions and
  produced a cut. `playFlip` now asks first, and the menu says "not on
  this machine" rather than offering a control that quietly does nothing.
  (This is also why the CDP harness needs `JV_MOTION=1`: headless Edge
  reports `reduce`.)

## 5. Presenting

- [x] **T28 · M — Rich speaker notes + presenter view.** Markdown notes
  with links/references, per-slide timing targets, a roomy notes editor,
  and a presenter view that shows the audience slide alongside full notes.
  *2026-08-25.* Two of the four already shipped in 2026-08-20: per-slide
  time goals (`s.goal`, totalled so a talk that cannot fit says so before
  you give it) and the presenter view (a popup with real renders, the
  next slide and a clock). What was missing was markdown and somewhere
  to write it.
  **A subset, not a library.** No build step and no bundler here, so a
  markdown library would be the first vendored dependency in the whole
  frontend, carried on every page for the sake of the notes pane. Notes
  contain emphasis, a bullet, a number, a bit of code and a link; that is
  fifty lines, and fifty lines that only do those things cannot be
  surprised by the rest of CommonMark. A line break is meaningful here —
  two lines make two paragraphs, because a note is a script you read at
  speed, not prose someone else will typeset.
  **Escape first, then mark up; links whitelisted by scheme.** A deck
  file arrives from other people, so this is the one place the frontend
  builds HTML from typed text and it follows `render/sanitize.py`'s rule.
  Verified in a browser: `[click me](javascript:…)`, a `<script>` tag and
  an `<img onerror=…>` produced no link, no script element and no image —
  all three came out as text.
  **References reuse what the deck already knows.** `{fig:id}` is T21's
  figure numbering, so a note citing a figure stays right when they are
  renumbered; `[the method](#7)` is a jump, live in the presenter view,
  where `goto` already existed as a command the strip used.
  **The room to write them in** is an overlay — the shape the spotlight,
  presenter view and overview map already have — with the slide, the
  text and the rendered result side by side, writing to the same
  `sl.notes` on the same input event as the pane. 22/22 in a browser.
- [x] **T29 · M — Rehearsal timing.** Record per-slide and per-section
  times across rehearsal runs; show stats ("slide 17 averages 3:42").
  *2026-08-25.* Design note at `WHAT A REHEARSAL LEAVES BEHIND`.
  **A slide had no name.** Annots have had `oid` since T10; a slide was
  only ever an index, and an index is worthless when the entire value is
  comparing runs made days apart across insertions and reorders. So
  `sid`, minted lazily on first rehearsal — and de-duplicated at the
  OPPOSITE scope to `oid`: deck-wide, so a duplicated slide gets a fresh
  name, where a duplicated slide keeps its oids so T27 can match the
  objects. Same mechanism, opposite scope, because the two questions are
  opposite.
  **The history is not in the deck file.** Sending someone your deck must
  not send them the fact that you spent 4:12 on slide 3; the history grows
  every run while localStorage has a quota that has bitten this project
  before; and it is the argument `showCut` and `matchPick` already made.
  It lives beside the deck under the same key, so renaming a deck starts
  its history over — honest, and consistent with how everything here is
  keyed.
  **Not every run is a rehearsal.** Opening Present to check a colour
  would quietly halve every average. A run counts once it reaches a
  second slide and lasts half a minute; shorter ones are dropped and say
  so. The twelve-run cap is named in the UI, because a stat over "your
  runs" that silently means "your last twelve" is a stat that lies.
  Shown in three places and no fourth: beside the per-slide target, in
  the presenter view under the clock ("usually 3:42"), and a Rehearsals
  tab grouped by section — the unit you actually cut — reading the same
  `sectionRuns()` the strip and the overview map draw.
  16/16 in a browser, including a five-second run recording nothing and a
  thirty-seven-second run over two slides recording 19s and 18s against
  two different sids.
  Local only — no audio, no speech analysis.
- [x] **T30 · S — Presenter slide search / jump.** Type-to-search titles
  and content while presenting; jump straight to a slide.
  *2026-08-25.* Design note at `FINDING A SLIDE WHILE YOU ARE TALKING`.
  **One matcher, two windows.** "Where is the slide about the residuals?"
  is the same question in the presenter view and on the only screen you
  have, so `slideHits` is written once; a second matcher would be a
  second answer and they would disagree the first time either grew a
  field.
  **The map IS the search results.** T26's overview already draws every
  slide in its sections with click-to-go, so a filter on top of it is
  exactly "type-to-search and jump" — the door is a search box in the
  map, not a second piece of navigation furniture, and `/` opens it
  mid-talk. The jump goes through `go()`, so the transition plays, the
  rehearsal clock attributes the time and the presenter view follows.
  **A hit that is only in your notes says so.** Notes are searched
  because "where did I say that" is the question being asked at the
  lectern — but jumping to a slide expecting a word on the screen and
  not finding it is worse than not finding the slide.
  16/16 in a browser: a word on the slides found both copies unlabelled,
  a word only in the notes found exactly that slide and said so, a word
  nobody said found nothing and said that too, and Enter jumped the talk
  without leaving present mode.
- [x] **T31 · S — Private presenter annotations.** On-slide annotations
  visible only in presenter view, never to the audience or in exports.
  *2026-08-25.* Design note at `THINGS ONLY YOU CAN SEE`.
  **One predicate, at the one funnel.** `renderAnnots` already calls
  itself the funnel every slide render passes through — the stage, the
  presenter view, the notes editor's preview and the PDF pages all arrive
  there — so the question is asked once, beside the `hide` flag it sits
  next to. Four callers each answering it is how three agree and the
  fourth leaks. `hide` and `priv` are deliberate opposites, on adjacent
  lines: hidden from *you* while you work, versus shown to you and nobody
  else.
  **The default is safe.** `priv` is opt-in on `buildSlideNode`, so a
  render path added next year shows nothing private unless it asks —
  rather than leaking until someone notices. PowerPoint walks the annots
  itself and so asks the question itself; the PDF path inherits the
  answer through `attachAnnots`.
  **And it does not overclaim.** A private item is never drawn for the
  audience and never reaches a PDF or a `.pptx`. It *is* stored in the
  deck, exactly as speaker notes are, so a deck FILE you hand over
  contains it — dropping it from the save would mean a private note that
  does not survive a reload, which is not a feature. The menu says which
  of the two it is.
  14/14 in a browser: presenting drew one of the two shapes, the editor
  drew both with the private one carrying a readable "only me" tag, a
  private render drew both, and presenting again straight afterwards drew
  one — the context is restored, not left on.

## 6. Versioning & recovery

- [x] **T32 · L — Deck version history + visual diff (design first).**
  Snapshots on save (the server already snapshots notebook edits — same
  pattern), a slide-by-slide visual comparison of two versions, and
  restore-a-destroyed-slide recovery. Hook `server/vcs.py` git awareness
  where a repo is present. Deck JSON + deterministic output make this
  tractable in a way pptx structurally isn't.
  *2026-08-25.* Design note at `WHAT THIS DECK USED TO BE`.
  **IndexedDB, not localStorage.** A snapshot is the whole deck and a
  deck carries images as data URIs; the quota has bitten this project
  once already. One record per snapshot plus a small index — keeping the
  list in one record would rewrite every snapshot on every save.
  **The notebook's own rule:** one on open, one on every explicit save,
  deduped when nothing changed, capped at 20. The dedupe is what makes
  "open, look, close" cost nothing.
  **The diff pairs slides by `sid`, which is why T29 mattered more than
  it looked.** Pairing by index reports "everything from slide 4 down has
  changed" the moment you insert one — that is not a diff, it is noise.
  So the mint point widened: a deck is named whenever it is RECORDED,
  the first moment identity has to exist. Snapshots older than slide
  names fall back to positional pairing and the panel says so.
  **One renderer.** `withDeck` swaps the single `pres` global for the
  length of a synchronous call — the trick `buildSlideNode` already plays
  with `mode` — rather than threading a "which deck" parameter through
  everything. Mini diagram per row, real render on demand.
  **Going back is undoable**, because a snapshot is taken before either
  restore.
  **The git half, honestly.** A deck is not a file on disk — it lives
  inside the notebook or the project file — so the deck's own history is
  this local store (the moments *between* commits) and the repository's
  history of the file it is saved into is the notebook's, which
  `server/vcs.py` already lists and opens. The panel names that rather
  than duplicating it. Pulling a deck OUT of an old commit would need a
  new endpoint that extracts the embedded deck from a historical
  notebook; not built, and not pretended.
  18/18 in a browser: after editing slide 1 and deleting slide 2 the
  panel read "1 changed, 1 gone, 1 moved" — the third slide correctly
  *moved* rather than changed, which is the whole point of naming
  slides.

## 7. Deck-as-code & programmability

- [x] **T33 · M — Deck JSON schema doc + validator.** Formalise the deck
  format that `tests/test_deck_schema_parity.py` implies: a written schema
  and a `validate()` function. Foundation for T13, T32, T34.
  *2026-08-25:* `notebook/deck_schema.py` holds the tables (`DECK_KEYS`,
  `SLIDE_KEYS`, `ANNOT_KINDS`, `LAYOUTS`) and `validate_deck`, which
  REPORTS and never coerces — the exact opposite of `_as_presentations`,
  which coerces and never complains. Neither raises. `DECK-FORMAT.md` is
  prose over the same tables and `tests/test_deck_schema.py` checks the
  two agree in both directions, so the document cannot drift.
- [x] **T34 · L — Python deck API.** Load/edit/save decks from Python —
  `deck.slides[7].figures["toe_map"].update(...)` — living alongside
  `notebook/presentations.py`, round-tripping cleanly with the editor.
  *2026-08-25:* `notebook/deck_api.py`.
  **The one decision everything else follows from: it is a VIEW over the
  JSON, never a parallel model of it.** Every wrapper holds the dict that
  was loaded and mutates it in place; nothing is rebuilt on save. The
  obvious design — a dataclass with a field per key — silently destroys
  every key it has not heard of, and the browser is always ahead of
  Python: `sid` arrived with T29, `trans` with T27, `priv` with T31, and
  each would have been deleted by the first round-trip made before
  somebody remembered to add a field. `test_deck_schema_parity` exists
  precisely because that has happened six times. A view cannot lose a key
  it never touches, and the first test in `test_deck_api.py` is that.
  **It reads what a file happens to hold** — a list, a
  `{"presentations": […]}`, a bare deck, an `.ipynb` carrying its deck in
  `metadata.semantic`, or the `.junoview.html` the browser downloads
  (whose wrapper is kept: only the JSON block inside it moves).
  **Saving reports and does not coerce**, which is T33's split kept —
  `_as_presentations` coerces and never complains, `validate_deck`
  complains and never changes anything, and `save()` writes and tells
  you. `strict=True` for a script that would rather stop.
  **It does not drag the renderer in behind it:** the two file forms are
  read here rather than imported from `loader`, because a script that
  wants to move a figure should not have to load an HTML renderer.
  22 tests, including a round trip back through `_as_presentations` —
  a key kept here and dropped there would look saved and not be.
- [x] **T35 · M — Deck lint + AI-readable export.** Export a deck as
  structured text (titles, arguments, figures, captions, notes) so an LLM
  or a colleague can review the *content*; plus heuristic lints:
  unreferenced figures, orphan captions, inconsistent terminology,
  overly dense slides. This is the honest bridge to the "AI review my
  deck" wishes — junoview stays offline; the export travels.
  *2026-08-25.* Design note at `WHAT THE DECK SAYS, IN WORDS`.
  **Not preflight.** `preflight` asks "will this print" — per slide,
  physical, millimetres and dpi. This asks "does it hold together" —
  deck-wide and editorial. Folding them together would put "0.2mm line"
  beside "slide 12 has 90 words on it" as if those were the same kind of
  problem, so they are two lists and each says which it is.
  **It says where every figure came from**, which no other export of a
  deck can: figures are known by notebook anchor, so the review reads
  "Figure 2 — toe_map · “…” · from demo::toe_map" rather than "[image]".
  **Each lint shows what it counted**, because a heuristic that will not
  show its working is one you cannot argue with.
  **Private items do not travel** — T31's promise kept in the one place
  that would have broken it twice: the body drops them, and so does the
  heading, since `filmText` names a slide by the first thing written on
  it.
  Three defects found in the browser and not by reading the code: the
  terminology lint only collected single tokens, so "sea-level" and "sea
  level" could never meet; it also required three occurrences, which hid
  the commonest case (said once each way); and the slide heading leaked a
  private note. 18/18 after.
  **The Python half is T34**, deliberately: `deck_api` reads the same
  deck, so a script that wants this as data has the data. A second text
  generator in Python would be a second answer to one question.

## 8. Code structure — deferred refactors (each runs ALONE)

Deferred earlier as too churny for one pass; unchanged status.

- [x] **T36 · L — Split deck.js into modules (design first).** The
  multi-file split. Must preserve: no build step, boot-sequence-at-tail
  discipline, section-banner navigability. Update AGENTS.md/CLAUDE.md
  when done.
  *2026-08-25, on its own and last, as the entry asks.* 24,733 lines →
  fourteen files of ~1,900 under `assets/js/deck/`. Design note at the
  top of `00-page.js`.
  **They are fragments of one IIFE, not modules.** Everything shares one
  closure — `pres`, `cur`, `mode` and several hundred functions that
  reach for them — and ES modules are not available regardless: a
  rendered page is opened from `file://` at least as often as from a
  server, where `type="module"` is blocked outright. So
  `assets.deck_js()` concatenates them in the order `DECK_PARTS` names,
  which is the same inlining every other asset already gets — not a build
  step.
  **What it costs, said plainly:** a part does not parse alone, so an
  editor underlines its last brace and `node --check` on one part is
  meaningless. The replacement gate is *stricter*: the test and CI both
  assemble the parts and parse that — the thing that actually ships — so
  a part that parses alone but breaks the join is caught too.
  **The three constraints, kept.** No build step (above). Boot at the
  tail: `99-boot.js` is now its own file, last by filename as well as by
  convention, which turns a comment into a fact about the directory.
  Banner navigability: `grep -r "/* ----" assets/js/deck/` still works,
  and the filenames are a coarser index above it.
  **The split is provably a re-arrangement.** Cuts were made only at
  section banners *proved* safe — each candidate part was wrapped alone
  in a function and parsed, so a cut inside a function could not survive
  — and the parts were then concatenated and compared against the
  original byte for byte. The only difference in the shipped page is the
  fourteen four-line headers (5,249 bytes), which is the whole of the
  md5 move. Three full browser suites (T27, T32, T35: 11/11, 18/18,
  18/18) pass unchanged against the assembled build.
- [x] **T37 · S — Relocate `embed_deck`.**
  *2026-08-25, on its own as the entry asks.* `loader.py`'s first line is
  "Getting notebooks from where they live: disk, or a URL" — and it held
  `embed_deck`, which **writes** a deck into somebody's notebook, and
  `_deck_json`, which parses a DECK file rather than a notebook. Both
  moved to `presentations.py`, beside the `_as_presentations` that
  `embed_deck` has always called and that is the reason its output is a
  shape the editor can open. `loader` stopped needing `write_text`
  altogether, which is the tell that the split was real. The public name
  did not move: `junoview.embed_deck` and the `semantic_render` shim
  re-export it unchanged, and there is a test saying so.
- [x] **T38 · M — Underscore-API renames.** The public/private naming
  pass; keep the `semantic_render` shim working.
  *2026-08-25, on its own as the entry asks.*
  **The rule is one sentence: a leading underscore means private to its
  own subpackage, and nothing weaker.** Inside `notebook/`,
  `classify._parse_or_none` used by `parser` is exactly what that means
  and keeps its underscore — about forty names did. A name imported from
  ANOTHER subpackage has no business wearing one: `_as_presentations` was
  imported by the CLI, two server modules and the shim, telling four
  callers something untrue. Thirteen names crossed a boundary and lost
  it: `as_presentations`, `deck_json`, `is_url`, `stem_for`,
  `normalize_nb_url`, `card_output_keys`, `as_text`, `HEADING_RE`,
  `icon_svg`, `icons`, `FAVICON`, `LOGO_SVG`, `KOFI_URL`.
  Names imported ONLY by the shim were left alone — that module is not a
  caller so much as a museum.
  **The shim aliases rather than renames** (`new as _old`), so every name
  it ever exposed answers to its old spelling, and a test asserts the
  aliases are the same objects.
  The rule is in AGENTS.md and `test_front_door.py` walks every import in
  `src/` to keep it true, so the next boundary-crossing underscore fails
  a test instead of waiting for another naming pass.

## 9. Audit findings — the 2026-08-26 quality pass

Groups 1–8 are all ticked, and the ticks were honest about what was
BUILT. This section is what a reading of the shipped code against those
same specs turned up: places where a first pass stopped before the cases
that matter, a control ended up where nobody would look for it, or a
button never got its icon. The ask, in the user's words (2026-08-26):
*"a minimal first pass has been done, and it is not a full proper
photoshop/power point worthy feature that has been added, or there are
words instead of icons, or it has not been put in the right place."*

**How it was found.** Seven readers, one per group of tasks, each given
the task's own spec above and told to read the code that implements it;
then a second reader per group whose only job was to REFUTE each finding
by opening the file and proving the machinery was already there. 24 of
84 claims died at that step and are not recorded here.

**Two caveats, so this list is not read as gospel.**

1. The figures group's refuter hit an API error, so T17–T22's findings
   were never double-checked. They are gathered in T58 and marked as
   leads rather than conclusions.
2. Everything here is a claim about code until somebody drives it. Of
   the ones opened by hand during the pass, three of three held up —
   which is why the rest are worth the time — but this repo's suite is
   substring greps and cannot settle any of them. **Drive the editor
   for each**, per the CDP recipe in CLAUDE.md.

- [x] **T39 · S — The ribbon's icons.** Every one of the hundred ribbon
  controls asked whether it has words and whether it has an icon, then
  the same question put to the live DOM.
  *2026-08-26.* Twelve buttons were wrong, in all three directions at
  once: four had words and no icon beside siblings that had one
  (`anim-fade`, `anim-rise`, `anim-zoom`, `fmt-ungroup`); six were
  icon-ONLY, which the house rule rejects twice over; two of those six
  wore a NEIGHBOUR'S icon (`fmt-forward` drew `front`, `fmt-backward`
  drew `back`) and two borrowed a wrong one (rotate left/right drew
  `reset` and `reload`, which read as undo and refresh). Eight new icons
  in `branding.py`. The two colour buttons are renamed per selection
  with `textContent`, which deleted any icon along with the old word —
  they take `innerHTML`+`bic()` now.
  **`#deck-exit` had never had an icon at all.** Its token was wrapped
  across two lines; `icons()` substitutes the single-line shape and its
  leftover guard looked for that SAME shape, so a wrapped token passed
  through both and shipped as an inert element. The guard now catches
  any surviving `data-ic`, and `test_icon_contract.py` reads the
  templates directly as a second line.
  The resting ribbon does not change width (all six are contextual);
  measured before and after at 1600px and 1100px.

- [x] **T40 · S — `moveSection` was declared twice.** `deck/` is ONE
  scope in fifteen files, so the later body won and T23's two headline
  verbs were passing a direction into a function expecting an index.
  *2026-08-26.* "Move the section up" spliced the whole run in before
  the LAST slide; "down" was a no-op for a section already at the front;
  neither toasted, because the surviving body returns nothing. The drop
  body is now `moveSectionTo`. A guard in `test_js_contract.py` scans
  every fragment for a name declared twice at the IIFE's own level —
  818 top-level functions, and this was the only collision. Verified in
  a browser: `s0 s1 s2 s3 [Section A] s4` became
  `[Section A] s0 s1 s2 s3 s4`, with the toast "1 slide moved as one".

- [x] **T41 · S — Delete respects a full lock.** `deleteSel` was the one
  bulk verb that never asked `lockedAll`.
  *2026-08-26.* `duplicateSel`, the arrange verbs, the align sweep and
  the PowerPoint export all filter on it. Both documented ways to hold a
  fully locked item in a selection lead straight into Delete —
  Alt+marquee "sweeps up fully locked items too", and the Objects pane
  is "the way back" for something you cannot click. Delete now keeps
  them and SAYS so, because one that silently half-works reads as
  broken. Verified in a browser both ways.

- [ ] **T42 · M — A copy must not share an identity with its source.**
  The worst cluster. `cloneAnnots` re-issues `grp` and `anim.order` and
  nothing else; `pasteBuf` does `delete cp.grp` without ever issuing a
  new one.
  - a cloned or pasted figure keeps `cap`/`capOf`, and `capOfFig` keeps
    the LAST match — so after Ctrl+D the ORIGINAL figure resolves to the
    COPY's caption, and dragging or resizing the original moves the
    copy's words (`startMove`'s `capOrig`, `startResize`'s `capA`).
  - `cinst` is copied verbatim, so a duplicated component instance
    merges into its source's instance group; `cmpDetach` then detaches
    both and `cmpPush` buckets them together.
  - paste loses grouping altogether, and `grpmeta` name/colour with it,
    where clone keeps both.
  T2 promises "Clones are independent copies". They are not.

- [ ] **T43 · M — Anchoring survives a resize and an export.**
  `startResize` treats `a.x`/`a.y` as page coordinates, so resizing any
  anchored item jumps it; and the PowerPoint export ignores anchors
  entirely, so a footer pinned bottom-left at 4/4 lands 4% from the
  TOP-left. T14 built the model and two consumers never learned to read
  it.

- [ ] **T44 · M — A design token resolves everywhere it is used.** T12's
  tokens work on the stage and nowhere else:
  - a deck-colour token on a TEXT box renders as nothing — the text
    renderer assigns `a.color` raw instead of resolving it;
  - the PowerPoint export never resolves token references at all, so
    token-coloured text, shapes, lines and drawings export wrong;
  - the corner-radius token reaches the live stage but not the
    print/export pages;
  - the token editor's only door is the format bar's Arrange dropdown,
    hidden whenever nothing is selected — a DECK-wide setting reachable
    only by first selecting an object.

- [ ] **T45 · S — Find & replace covers the text that is on the slide.**
  `fields()` skips table cells, so a deck-wide replace never touches
  table text — and the count it shows you first is wrong for the same
  reason. Also: the formatting half's `fmtBuild()` is never rebuilt when
  the canvas selection changes underneath the non-modal popover.

- [ ] **T46 · S — Match layout applies to the slide it captured.** The
  `layout` branch applies `matchArm.idxs` to the CURRENT slide rather
  than the one those indexes were captured on, so it rearranges whatever
  happens to sit at those numbers now.

- [ ] **T47 · M — Version history records and restores the whole deck.**
  - in app mode the explicit Save never takes a snapshot, so the history
    only ever holds the "opened" entry — the feature is empty in the
    mode it is mostly used in;
  - "Go back to this whole version" restores the slides and ten deck
    keys and silently leaves `wmark`, `head`, `foot`, `styles`, `types`,
    `cropMarks` and `tapzoom` at their CURRENT values;
  - renaming a deck orphans its entire history — the keys are on
    `pres.name` and nothing migrates them;
  - the promised "real render on demand" in the diff does not exist: a
    row is two 74px mini diagrams and nothing opens.

- [ ] **T48 · M — The presenter's controls exist while presenting.**
  - T25's Running-late button lives in `#play-menu` inside `#deck-qat`,
    which `syncTopBar` HIDES whenever mode is not edit/create — the one
    control the whole task is about is unreachable exactly when it is
    wanted;
  - starting a presentation does not close the Notes pane, so it stays
    drawn over the presented slide;
  - `presenterPush` draws the "next" preview from `cur+1` and the
    counter from `(cur+1)+' / '+n`, ignoring cuts and optional slides —
    the presenter is told about a slide the audience will never see;
  - finishing a rehearsal never re-renders the Rehearsals tab, so it
    still reads "No rehearsals yet"; and a rehearsal ended by closing
    the tab records nothing, because the unload path never stops the run.

- [ ] **T49 · S — The review export must not carry private text.** T31's
  privacy and T35's export disagree:
  - a private caption attached to a public figure is exported verbatim
    in the figure line — in the export that is meant to travel;
  - the "figure nobody mentions" lint counts private text as a mention,
    so it stays silent about a figure whose only mention is private;
  - a private arrow or line is drawn with no "only me" marking at all;
  - the density lint's two numbers count two different populations, so
    the sentence it prints contradicts itself.

- [ ] **T50 · M — Cuts are a lifecycle, not one verb.** `newCut` is the
  only cut verb there is: no rename, no delete, and nothing is ever
  removed from `pres.cuts`. And `renderFilm` builds each row's class
  from current/peek/in-sec only — there is no `opt` or `cut` class — so
  T24's marks are invisible in the strip they are about.

- [ ] **T51 · M — The Python deck API is finished and reachable.**
  - there is no way to delete a slide, and the obvious attempts silently
    no-op;
  - `save()` picks the output format from the SOURCE file rather than
    the target path, so saving an html-opened deck to `.json` writes
    html;
  - `deck_schema.SLIDE_KEYS` does not cover `lay`, a slide key the
    editor writes into every deck it saves;
  - the API is not reachable from junoview's public API and is
    documented nowhere outside this file.

- [ ] **T52 · S — Guides are editable, undoable and hideable.** T4
  shipped draw-and-delete: a guide box can be moved but never resized
  (all four edge strips run `startGuideBoxMove`), guides are outside
  undo, "Clear every guide" is one unconfirmed click, there is no
  show/hide toggle short of permanent deletion, and the tool has no
  ribbon button — its only doors are a right-click row and the ruler
  corner.

- [ ] **T53 · S — Maths survives the title slide and the export.** The
  re-typeset gate asks only about `s.annots`, so LaTeX in a title
  slide's title or subtitle is thrown away; and a deck text box built by
  the Maths button exports to PowerPoint as literal `$$ … $$`.

- [ ] **T54 · S — Menu and pane icons say the right thing.** T39 swept
  the RIBBON; the menus were not in it.
  - "Save as .md" carries `bic('front')`, the z-order icon;
  - "Remove the divider" and "Delete the section AND its N slides" both
    render `bic('exit')` — the same glyph for very different
    consequences;
  - T31's "Only me" row uses `bic('pin')`, the same icon as the "Lock
    position" row two rows above it in the same menu;
  - the notes editor's Previous/Next borrow `bic('back')`
    (send-to-back) and `bic('arrow')` (the arrow drawing tool);
  - `#fmt-dup` is labelled **Copy** while `#hm-dupslide` is labelled
    **Duplicate**, and both wear `data-ic="copy"`. The only toolbar
    button that says "Copy" is the one that is not a clipboard copy,
    and its own tooltip, Ctrl+D and every other door all say Duplicate.

- [ ] **T55 · S — A pane re-renders when the thing it is about
  changes.** The `#objhist` pane has no rerun control and is never
  re-rendered when the object is edited or the selection moves; the
  provenance pane reads the selection once, at render time, and never
  again.

- [ ] **T56 · S — Ribbon gallery housekeeping.** Nothing removes
  `#rbn-gallery` when the editor is left, so it stays pinned over
  Present mode; and a few catalogue entries put more controls in one row
  than fit at narrow widths, which the never-wrap ladder can only answer
  by scrolling sideways.

- [ ] **T57 · S — The smaller ones, gathered.** Each is a line or two.
  - Alt-drag clones on mousedown at zero offset and commits on mouseup
    even if the gesture never moved — an invisible exact-overlap copy
    with no toast, where Ctrl+D offsets by `CLONE_OFF` precisely so a
    copy is never invisible;
  - the Objects pane's Duplicate selects only the last copy, where
    Ctrl+D leaves the whole batch selected;
  - `selRects` filters on `pinned()`, so position-locked items are
    skipped by the SIZE-only Arrange verbs too;
  - "Put the ribbon back to normal" cannot restore button ORDER and
    tells the user to reload, though `rbnRestoreHome` exists;
  - every keystroke in the notes editor pushes a full undo snapshot of
    every slide;
  - `slideWords` never looks inside notebook cells, so presenter search
    misses a word that is visibly on the slide;
  - `setTrans` conflates "Cut" with "clear the override" (`TRANS[0][0]`
    is `''`), so choosing Cut inside a section clears the override
    instead of setting one;
  - `playFlip` compares only the `.an-item` bounding rect, so T27's
    move/scale is really move-and-scale-the-box;
  - the Header/Footer prompts list `{name} {date} {n} {N}` and never
    mention `{sn}`, `{sN}` or `{sec}`.

- [ ] **T58 · L — Verify, then act on, the figures group (T17–T22).**
  24 findings whose refuter never ran, so **re-check each one before
  believing it.** The strongest-looking leads: `printDeck` never calls
  `afterTypeset`, so the PDF/print export never swaps the hi-res
  originals in — which is T21's whole point; `refreshLinkedImages`
  replaces `a.src` but leaves `a.okey` pointing at the old original; the
  PowerPoint export embeds the display copy rather than the retained
  original; `provOf` returns null for anything that is not `k==='cell'`,
  so a flip book built from six notebook figures has no provenance;
  `refCaption` and `numberCaption` unconditionally `delete a.html`,
  discarding rich caption text; the reference picker is hard-capped at
  the first eight figures with no scroll; there is no "add a caption"
  command anywhere, only a tie between two objects that already exist;
  and `figFonts` collects each SVG figure's font sizes that nothing
  ever reads.

---

## Cut (and why)

- **Real-time co-editing, shared comments, multi-user change tracking,
  review mode** — needs sharing infrastructure junoview doesn't have.
  The single-user half of "collaboration" (diff, compare, history) is T32.
- **Live polls / audience questions / anything Zoom-adjacent** — needs a
  live audience channel; out.
- **Speech/rehearsal voice analytics** — needs audio capture; the timing
  half survives as T29.
- **Generative AI media (illustrations, voiced sequences)** — junoview is
  offline stdlib; the bridge is T35's structured export.
- **Illustrator-grade vector editing (boolean ops, anchor points)** —
  wrong tool; figures come from the notebook, which is the point.
- **Full infinite-canvas authoring** — scoped down to the T26 overview.
- **Live interactive embeds** — largely already true: Plotly figures stay
  interactive in rendered pages today.
- **Text flowing between boxes / across slides** — descoped from T15.
