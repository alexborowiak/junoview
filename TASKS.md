# TASKS.md — the junoview feature backlog

Distilled 2026-08-24 from a set of "what people wish presentation software
did" brainstorm notes, filtered and adapted to what junoview actually is: a
static, stdlib-only, notebook-first renderer with a deck editor. Anything
needing live multi-user infrastructure, audio capture, or a hosted backend
was cut (real-time co-editing, shared comments/change-tracking, live polls
and audience Q&A, speech analytics, generative-media AI).

## Where the work lives

Everything about what is left to do is in these, all in this repo:

| | |
|---|---|
| **TASKS.md** (this file), **groups 13–14** | **The queue.** The 2026-08-30 external review, T95–T121, every claim re-read against the source and then handed to a refuter told to prove it wrong — read the verdict before working one. Groups 1–12 are the design record; every entry in them is closed and ends in a dated note saying what shipped. |
| [**AUDIT-2026-08-26.md**](AUDIT-2026-08-26.md) | **The evidence.** All 84 findings behind group 9, filed under the T-number each belongs to, with file:line, what is wrong, what the reviewer read to confirm it, and the fix suggested. Read this before touching anything. |
| [**reviews/**](reviews/) | **The evidence for group 13.** Two external reviews of `23956c4` — one on bugs, packaging and hygiene, one on missing features — with the file:line each claim rests on. Group 13's notes record where re-reading disagreed with them, which is often, and the disagreements are the useful part. |
| `tests/test_characterization.py`, the comment block above `EXPECTED_MD5` | **The build log.** Every deliberate change to the rendered page since the package split, dated, saying what moved and why. Written at the moment the work lands rather than afterwards, which is why group 13's completion notes could be transcribed from it instead of reconstructed from `git log`. |

Groups 1–8 above are all ticked and are now the design record — what was
built and, more usefully, what was rejected and why.

**One caveat that governs the lot:** every finding is a *claim about
code* until somebody drives it. Completed items in group 9 are verified
in a browser. 24 of the 84 (the figures group, gathered in T58) were never
even double-checked and are leads, not conclusions. Group 13 is the first
set whose claims were graded by a reader and then by an independent
refuter told to prove each one wrong — four died that way, and several
more survived only with their proposed FIX corrected, which is the more
useful outcome: three of the fixes the reviews recommended would have
edited dead code.

---

## How to work this file

- Work 2–4 related tasks per session. One commit per task; tick the box in
  the same commit. Add a dated note under a task if you discover something
  (partial existing support, a blocker, a descoping decision).
- **[deck.js]** tasks touch the one IIFE that `assets/js/deck/` is
  concatenated into — never run two of them in parallel sessions. Respect the boot-sequence rule (CLAUDE.md).
- Anything that changes rendered page bytes must update `EXPECTED_MD5` in
  `tests/test_characterization.py` in the same commit, with the reason.
- **(design first)** means: write a short design note (schema, interaction
  with existing features, migration) and get it agreed before coding.
- Sizes: **S** = part of a session · **M** = a session · **L** = multi-session.
- Suggested batch order: group 1 quick wins first (T1–T6), then figures
  (group 3 — the scientific core is the differentiator), then structure,
  styling, presenting. Group 8 refactors run alone, with nothing else in
  flight.
- **Groups 1–12 are all ticked and are now the design record: what was
  built, what was rejected, and why. GROUP 13 IS THE LIVE QUEUE**
  (2026-08-30) — what two external reviews of the shipped code found.
  The entries run worst-first, so take them from the top.
- **A ticked box means the work landed, and the note says what landed.**
  Every closed entry ends in a dated paragraph naming its commit. Do not
  re-open a task because its DIAGNOSIS is written in the present tense:
  the diagnosis is the design record and is preserved as it was written,
  including the ones that turned out to be wrong. If you find a closed
  entry with no completion paragraph, that is a bug in this file — the
  ticks have always been honest, but until T97 the prose around
  thirty-three of them read as work still waiting.

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

**The entries below are summaries. The evidence is
[AUDIT-2026-08-26.md](AUDIT-2026-08-26.md)** — all 84 findings, filed
under the T-number they belong to, each with the code it is about, what
the refuting reader actually read before letting it stand, and the fix
it suggested. Read the entry here to decide what to pick up; read that
file before touching anything.

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

- [x] **T42 · M — A copy must not share an identity with its source.**
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
  - and from the other end of the same story: `cmpSyncAll` splices
    annots out of a slide while later instance groups on the SAME slide
    still hold their pre-splice indexes.
  T2 promises "Clones are independent copies". They are not.
  *2026-08-26.* Clone and paste now share one two-pass identity remapper:
  every copied figure receives a new `cap`, its copied caption follows
  that id (or becomes ordinary text when copied alone), and each copied
  component instance receives one new `cinst`. Paste snapshots
  `grpmeta` with the clipboard and rebuilds fresh groups on every paste,
  including across slides; the Objects pane no longer remaps a copied
  group twice. `oid` remains deliberately slide-scoped so Magic Move can
  recognise an object across duplicated slides. Component sync now
  resolves every instance from the live annotation array before it may
  splice. Browser-verified with tied duplicate, repeated and cross-slide
  paste, caption-only duplicate, and four same-slide component instances.

- [x] **T43 · M — Anchoring survives a resize and an export.**
  `startResize` treats `a.x`/`a.y` as page coordinates, so resizing any
  anchored item jumps it; and the PowerPoint export ignores anchors
  entirely, so a footer pinned bottom-left at 4/4 lands 4% from the
  TOP-left. T14 built the model and two consumers never learned to read
  it.
  *2026-08-27.* Resize now snapshots and snaps in page coordinates, then
  writes through `anchorSet`; its live element, aspect-fitted figures and
  tied captions use the same resolved positions. The stored-rectangle
  fallback resolves anchors too, so snap targets and off-screen attached
  arrows agree. PowerPoint resolves one box per item using the dimensions
  it will actually export, covering text, images, shapes, drawings,
  tables, flip books and cell frames. Browser-verified: a bottom-right
  resize kept its top-left fixed before, during and after the gesture; an
  anchored image normalised to its visible aspect without jumping; and
  captured PowerPoint items landed at BL 4/90, BR 76/86 and TC 43/4.

- [x] **T44 · M — A design token resolves everywhere it is used.** T12's
  tokens work on the stage and nowhere else:
  - a deck-colour token on a TEXT box renders as nothing — the text
    renderer assigns `a.color` raw instead of resolving it;
  - the PowerPoint export never resolves token references at all, so
    token-coloured text, shapes, lines and drawings export wrong;
  - the corner-radius token reaches the live stage but not the
    print/export pages.
  (Its editor is also hard to reach at all — that half is T59.)
  *2026-08-27.* Every stored colour now crosses `tokVal` where it becomes
  paint: title and body text, shape fills and multi-stop gradients, tables,
  furniture, style specimens, the film strip, object history and page
  backgrounds. A non-mutating gradient projection resolves all stops and
  keeps its PowerPoint `a`/`b` endpoints in sync without baking references
  into the deck. `attachAnnots` is now the one full-slide token seam, so
  view mode, presenter/notes previews, print and standalone HTML receive
  the same radius as the editor. PowerPoint resolves text foregrounds and
  backgrounds, shape outlines/fills/gradients, freehand, arrows, tables,
  slide borders and backgrounds before calling the writer. Browser-verified
  with a six-colour token matrix across stage, film, print and the captured
  PowerPoint spec; changing Accent updated every output while saved text and
  gradient stops remained `@accent` references.

- [x] **T45 · S — Find & replace covers the text that is on the slide.**
  `fields()` skips table cells, so a deck-wide replace never touches
  table text — and the count it shows you first is wrong for the same
  reason. Also: the formatting half's `fmtBuild()` is never rebuilt when
  the canvas selection changes underneath the non-modal popover.
  *2026-08-28.* A table now contributes one model field per normalized
  cell, with its exact row and column in the hit label, so counts and both
  replace verbs operate without crossing cell boundaries. Formatting Find
  follows the primary canvas object through ordinary selection, slide
  navigation and the two direct-removal paths, while an object-identity
  guard preserves the user's checked criteria during live rerenders. Empty
  text deletion also remaps later selection indexes before synchronizing.
  Browser-verified across three table hits on two slides, saved replacement
  text, same-object rerenders, object switches, multi-selection primary
  changes and navigation deselection.

- [x] **T46 · S — Match layout applies to the slide it captured.** The
  `layout` branch applies `matchArm.idxs` to the CURRENT slide rather
  than the one those indexes were captured on, so it rearranges whatever
  happens to sit at those numbers now.
  *2026-08-26.* A cross-slide click now refuses before reading live
  geometry or applying the captured indexes, names the slide to return to,
  and deliberately leaves Match Layout armed. Back on that slide, the
  same gesture completes normally.

- [x] **T47 · M — Version history records and restores the whole deck.**
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
  *2026-08-28.* Every explicit save target now records the exact
  click-time deck only after its write succeeds; autosaves do not. History
  transactions are serial, rename copies records before publishing the new
  index and deleting the old namespace, and a delayed save cannot resurrect
  an old name or discard edits made while it was in flight. Whole-version
  restore replaces the normalized deck object (preserving only its current
  name), resets custom types and undo state, and therefore restores present
  keys while deleting current-only ones. Each diff row keeps its cheap
  diagrams and can lazily open two inert full renders. Browser-verified
  across 53 save/failure/conflict/rename/diff/restore/file checks plus a
  delayed-save rename race. That pass also exposed and fixed an earlier
  boot-order bug which made a saved custom text type abort the editor.

- [x] **T48 · M — The presenter's controls exist while presenting.**
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
  *2026-08-29.* Running late now has one labelled, stateful control in the
  presenter bar, with its `L` shortcut routed through the same button; the
  unreachable edit-menu copy is gone. Entering playback closes Notes and
  synchronously releases its dock. The presenter window now gets its next
  preview, ordinal and total from the same skipped-slide model as playback,
  including the end sentinel. A kept rehearsal immediately redraws its tab;
  page exit and SPA deck exit stop and save the run, while merely hiding the
  page remains a draft flush. Browser-verified across a five-slide named-cut
  deck, optional skipping, popup previews, keyboard/mouse toggles, pane state,
  all three rehearsal exits and both windows' runtime errors (23 checks).

- [x] **T49 · S — The review export must not carry private text.** T31's
  privacy and T35's export disagree:
  - a private caption attached to a public figure is exported verbatim
    in the figure line — in the export that is meant to travel;
  - the "figure nobody mentions" lint counts private text as a mention,
    so it stays silent about a figure whose only mention is private;
  - a private arrow or line is drawn with no "only me" marking at all;
  - the density lint's two numbers count two different populations, so
    the sentence it prints contradicts itself.
  *2026-08-29.* Figure lines now borrow only public, visible captions, and
  the figure, orphan-caption, spelling and density lints all inspect the
  same audience-visible population as the Markdown they explain. Private
  arrow/line ink carries the amber only-me signal in the editor and
  presenter, including after its SVG path is redrawn; audience playback
  still omits it. Browser-verified the textarea and generated Markdown
  Blob, both figure lints, the exact density sentence, selection/redraw,
  presenter and audience renders with a three-slide fixture (31 checks).

- [x] **T50 · M — Cuts are a lifecycle, not one verb.** `newCut` is the
  only cut verb there is: no rename, no delete, and nothing is ever
  removed from `pres.cuts`. And `renderFilm` builds each row's class
  from current/peek/in-sec only — there is no `opt` or `cut` class — so
  T24's marks are invisible in the strip they are about.
  *2026-08-29.* The Present menu now gives every named version visible
  Rename and Delete actions; rename keeps the stable id, while delete
  removes that id from the registry and every slide in one undoable edit,
  without deleting a slide. Removing a slide's sole membership deliberately
  returns it to the documented universal state, and deleting the last version
  leaves no phantom empty map. The active version is session state owned by
  its open deck, is repaired across undo/redo and deck switches, and playback
  cannot start or step backwards onto an excluded slide. The strip now says
  **optional** and **not shown** on `.opt`/`.cut` rows, with dimming scoped away
  from the current row and its controls; Running late resets at each run
  boundary. Help records the lifecycle and the universal-state consequence.
  Browser-verified create, rename, delete, membership changes, undo/redo,
  persistence, same-id deck switching, filtered navigation, Running late,
  accessible selection and runtime errors across three fixtures (39 checks).

- [x] **T51 · M — The Python deck API is finished and reachable.**
  - there is no way to delete a slide, and the obvious attempts silently
    no-op;
  - `save()` picks the output format from the SOURCE file rather than
    the target path, so saving an html-opened deck to `.json` writes
    html;
  - `deck_schema.SLIDE_KEYS` does not cover `lay`, a slide key the
    editor writes into every deck it saves;
  - the API is not reachable from junoview's public API and is
    documented nowhere outside this file.
  *2026-08-29.* `Deck.remove_slide(n)` now mutates the stored list with the
  same clamped, 1-based numbering as the other structural verbs, reports
  whether anything was removed, and the empty-deck move path is harmless.
  An explicit save target now owns its format: notebook and HTML targets
  require the real source structure, every other suffix writes JSON, and a
  suffixless target preserves the source form — so no JSON or HTML is written
  under a lying extension. Multi-deck documents and unrelated notebook data
  remain intact. `lay` is now a documented string field carried by both JS
  and Python normalisers, so the applied template survives project saves and
  reloads. `Deck` and `open_deck` are public without colliding with the model's
  `Item`; README, DECK-FORMAT and ARCHITECTURE point to the live-view API.
  Browser-verified import, apply, persistence, deck switching and all three
  gallery selections with no runtime errors (10 checks).

- [x] **T52 · S — Guides are editable, undoable and hideable.** T4
  shipped draw-and-delete: a guide box can be moved but never resized
  (all four edge strips run `startGuideBoxMove`), guides are outside
  undo, "Clear every guide" is one unconfirmed click, there is no
  show/hide toggle short of permanent deletion, and the tool has no
  ribbon button — its only doors are a right-click row and the ruler
  corner.
  *2026-08-29.* A guide box now has EIGHT resize handles rather than four
  move handles: each edge strip rewrites only the coordinates it owns
  (`'l'` moves x and w together so the far edge holds still), each corner
  takes the two sides it meets at, and `gbNorm` un-flips a side pulled
  through its opposite so a negative width never reaches the model.
  Moving did not go away — it moved onto a visible grip above the top
  edge, with Alt or Shift on any handle as the shortcut; the grip is
  outside the box because the middle of a guide box is the area you are
  laying out INSIDE and has to go on taking clicks. Every drag now reads
  out what it is making in the page's own millimetres (size while
  resizing, position while moving), which was previously only knowable by
  drawing the box and measuring it against a ruler.
  `pres.guides` joins the undo snapshot, so a drag, a draw and a clear
  are all Ctrl+Z-able — they were the only edits in the editor that were
  not — and `histRestore` re-asks `syncGuides` because the guide layer
  caches the signature it last drew. Clearing asks first above one guide
  and says Ctrl+Z in the toast. `guides.custom` is a view flag beside
  rulers/grid, defaulting on, honoured in BOTH places that must agree —
  hidden guides neither draw nor snap, because an invisible line that
  still pulls items onto itself is worse than either state. Two worded
  ribbon buttons in the View group with Rulers and Grid: **Guides** (H,
  a new `guides` glyph) and **Guide box** (B, `frame`, an `et` tool so
  `setTool` owns its pressed state); both are placed in all 108 ribbon
  arrangements and in the View group's fold menu, and arming the tool by
  any door un-hides what it is about to draw. Browser-verified in Edge:
  40 checks over resize per side and per corner, the grip, Alt+drag,
  undo/redo, hide/show, the keys, the confirm and the clear-then-undo,
  with no runtime errors; the ribbon still fits unclipped at 1024, 1180
  and 1366px.

- [x] **T53 · S — Maths survives the title slide and the export.** The
  re-typeset gate asks only about `s.annots`, so LaTeX in a title
  slide's title or subtitle is thrown away; and a deck text box built by
  the Maths button exports to PowerPoint as literal `$$ … $$`.
  *2026-08-29.* `hasMaths` split into `hasMathsStr` (the question at the
  string level) and `slideHasMaths` (the question for a whole slide,
  title and subtitle included), and the render gate now asks the latter
  — a title slide keeps its words outside `s.annots`, which is the whole
  reason the annot-only gate could not see them. The commit path gained
  the same widening, so maths typed INTO a title typesets when you click
  away rather than staying raw until something else rebuilt the layer.
  A third half turned up while driving it: MathJax replaces the text
  node with its own markup, so opening a typeset box for editing put the
  caret among rendered glyphs and the commit read those back as the new
  source — one edit and the LaTeX was gone. `beginEdit` now puts the
  stored source back first, in `editableText`, so titles and ordinary
  text boxes are both covered by one place.
  For the export, `mathsPlain`/`texPlain` flatten an equation to
  characters — `$$ \frac{\partial u}{\partial t} = \alpha \nabla^2 u $$`
  leaves as `(∂u)/(∂t) = α ∇² u` — from the SOURCE rather than from the
  rendered MathJax `blockText` lifts for cells, because only the slide on
  screen has typeset output and this export is synchronous. The
  vocabulary is the equation palette's own; anything else keeps its
  command word without the backslash. Both the text-box and the title
  branches count what they flattened, so the export's existing
  "Equations came across as plain text" warning finally fires for deck
  maths, now with a count and the reason. Prose dollars ("$5 and $10")
  are left exactly as typed: an inline pair is only flattened when its
  body reads as TeX, or when `a.maths` says the Maths button built it.
  Browser-verified in Edge on a deck whose title slide carries LaTeX:
  19 checks over the rebuild gate, the edit round-trip, the re-typeset
  on commit and all four exported strings, with no runtime errors.

- [x] **T54 · S — Menu and pane icons say the right thing.** T39 swept
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
  *2026-08-26.* The object action now says **Duplicate**. Notes has a
  dedicated previous/next chevron pair; **Only me** uses the visibility
  eye; Markdown export uses the Markdown glyph; and the non-destructive
  divider removal uses minus while section deletion keeps the X. The
  strip's icon-only mini actions also carry accessible names.

- [x] **T55 · S — A pane re-renders when the thing it is about
  changes.** The `#objhist` pane has no rerun control and is never
  re-rendered when the object is edited or the selection moves; the
  provenance pane reads the selection once, at render time, and never
  again.
  *2026-08-26.* History now follows the primary selection, refreshes after
  committed edits and slide changes, and has an explicit refresh button.
  Provenance follows that same primary selection. Both show an honest
  empty-selection state; selection refreshes are signature-gated so an
  open history pane does not parse the undo stack during every slider
  preview.

- [x] **T56 · S — Ribbon gallery housekeeping.** Nothing removes
  `#rbn-gallery` when the editor is left, so it stays pinned over
  Present mode; and a few catalogue entries put more controls in one row
  than fit at narrow widths, which the never-wrap ladder can only answer
  by scrolling sideways.
  *2026-08-26.* Leaving edit mode or closing the deck now closes the
  gallery and resets every moved contextual control through `showFmt`.
  The gallery measures around a side toolbar instead of placing itself
  below the viewport, follows the toolbar when it moves, and closes if
  the ribbon is folded. An applied horizontal layout that remains
  over-wide after `fitEditRibbon` now shows a **Use Side toolbar** action
  inside the gallery, so the remedy stays reachable even when the
  ribbon's own View controls are among those clipped.

- [x] **T94 · S — Ribbon layouts are visible; selected objects own a
  tab.** The gallery had more than a hundred arrangements and no ordinary
  door: right-clicking the ribbon was the main route, while the documented
  View menu exists only after the width ladder has already folded that
  group. The shipped layout also sent every canvas click to Home and
  injected six changing groups there.
  *2026-08-26.* A permanent word-and-icon **Ribbon layouts** button now
  sits beside the tabs, outside the ribbon it rearranges. Default has a
  contextual **Object** tab; selecting something opens it only after its
  applicable controls are ready, and deselecting removes the empty tab
  and returns to the page-level tabs. The gallery still owns alternative
  interaction models deliberately. Restoring Default now removes a
  generated layout's tabs first, so switching back cannot duplicate tab
  labels or ids. Help and README distinguish a ribbon arrangement from a
  slide layout.

  *Renumbered 2026-08-30 (T97), from T60.* Two tasks carried the number
  `T60` — this one and group 10's empty-text-box bug — so a commit
  saying "T60" was ambiguous. This is the one whose only citation
  outside TASKS.md was a comment in `tests/test_characterization.py`;
  the other is cited from `15-annotations.js`, and moving that would
  have changed the rendered page's bytes to fix a numbering slip. Its
  implementing commit, `06bed91`, still says T60 in its subject; history
  is history.

- [x] **T57 · S — The smaller ones, gathered.** Each is a line or two.
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
  *2026-08-29.* All nine.
  **Alt-drag** now takes its clone back off in `mu()` when the gesture
  never moved, and puts the selection back — the clone was quiet, so
  nothing has to come off the undo stack either. **The pane's Duplicate**
  ends with `selectMany(l,added)`. **`selRects`** takes a `sizeOnly` flag
  and `sameSize` is its one caller: a position lock is about position,
  and only a full lock excuses an item from a resize. **"Put the ribbon
  back to normal"** calls `applyRibbonLayout(rbnCurrentId(),true)`, which
  restores the markup's own child order through `rbnRestoreHome` and
  re-applies the current arrangement — the "reload the page" advice was a
  leftover from before that snapshot existed. **Speaker notes** commit
  quietly and take one `histPush` when you leave the box (blur, close, or
  the editor walking to another slide), instead of one full-deck snapshot
  per keystroke. **`slideWords`** grew a `cell` branch: the card's title,
  its body (from the embedded map, or the live notebook DOM when the deck
  was opened against one) and its CODE, capped generously because that
  string is what the search MATCHES and the snippet is cut from around
  the hit. **`setTrans`** stores `''` for an explicit Cut and clears only
  on `null`, and the slide menu grew a "Use the section default (…)" row
  — Cut had been quietly wired to mean both, so inside a section it was
  unreachable. `setSectionTrans` deliberately keeps the old write:
  nothing sits above a section for its Cut to be confused with.
  **`playFlip`** now measures the CONTENT as well as the box —
  `flipInnerEl` finds the node the renderer writes `zoom`/`clip-path`
  onto, and the same FLIP runs one level in, with a crop interpolated as
  a clip-path — so T27's third promise, zooming into a region, animates
  instead of being discarded by the "nothing moved" guard. **The
  Header/Footer prompts and both ribbon tooltips** now name `{sn}`,
  `{sN}` and `{sec}`.
  Browser-verified in Edge across 39 checks over two fixtures: the
  Alt-click and Alt-drag pair with its undo, the position-locked resize,
  the pane's batch duplicate, the notes undo, the ribbon order restore,
  and the whole Cut/section-default cycle with its toasts and ticks, plus
  a word from inside a card's code finding the slide it is on. The flip's
  content half is verified in code and by confirming in the browser that
  the zoom really is written where `flipInnerEl` looks: headless reports
  `prefers-reduced-motion: reduce`, which `motionOK()` correctly honours,
  so the transition itself does not run there.

- [x] **T59 · S — A deck-wide command must not hide behind a
  selection.** Two of them sit in the format bar's Arrange dropdown,
  which is hidden whenever nothing is selected — so the way to reach a
  setting about the WHOLE DECK is to first select an object that has
  nothing to do with it.
  - the design-token editor (T12);
  - the page-wide tidy report (T9).
  Compare T52's guide tool, which has the same shape of problem from a
  different direction: no ribbon button, only a right-click row and the
  ruler corner.
  *2026-08-26.* **Design tokens** now has a permanent word-and-icon door
  in Design's deck-level group, and **Tidy page** has one in its Slide/Page
  group. Their selection-only Arrange rows are gone. Every alternative
  ribbon layout places both controls explicitly beside their semantic
  neighbours, so neither can fall into an arbitrary catch-all group.

- [x] **T58 · L — Verify, then act on, the figures group (T17–T22).**
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
  *2026-08-29.* **Verified first, as the entry asks: 21 of the 24 held
  and 3 died.** Dead: `cloneAnnots` and `pasteBuf` both re-key `cap` and
  re-point `capOf` already — `independentCopies` does it for both doors,
  with a comment saying why — and the provenance pane *is* re-rendered
  on a selection change, by `syncInspectorPanes`, which the reader's
  three-caller count missed. The other 21 are fixed.
  **Captions.** The reference list is built AFTER `figNumbers()` rather
  than before it, so it can appear at all — it was gated on ids that
  only the call two lines below it minted, which meant that on a deck
  where nothing had been tied or numbered the section could never
  render, on any deck, ever. It lists every figure in a scrolling run
  instead of the first eight. `addCaption` is the command T17 never
  had — a box under the figure, at its width, tied and numbered, with
  the caret in it — reachable from a canvas row and from `#fmt-caption`,
  which is one button in two states (Caption / Untie caption) the way
  `#fmt-revert` already is. Deleting a figure unties its caption and
  freezes the number it was showing, so the words stay what they said.
  `numberCaption` and `refCaption` insert their token INTO `a.html`
  rather than deleting it. A component records the tie as a relation
  between members and mints the pair fresh per placement. A
  position-locked caption still takes its figure's width and is no
  longer dragged by it. `{fig}` distinguishes three misses instead of
  two. All four caption rows wear icons, two of them new (`unlink`,
  `caption`).
  **Provenance.** `provOf` asks `provRef`, so a flip book — which
  `isFigure` has always counted as a figure — has provenance, staleness
  and re-sync like anything else. The lineage and plot-trace jumps close
  the deck first: `.deck` is an opaque full-window overlay and they had
  been scrolling cards into view behind it. `staleFigures`/
  `resyncAllFigures` and **File ▸ Update figures from the notebook**
  give figures the deck-wide door pictures already had. The pane has a
  ribbon door (`#fmt-prov`) beside the three commands of its own family,
  and every button in it wears an icon.
  **Originals.** `printDeck` goes through `afterTypeset`, so the PDF —
  the one output that ends up on paper — finally gets the full bytes;
  the claim that "every path that turns a print root into a file goes
  through afterTypeset" was false when it was written. `refreshLinked
  Images` keeps the newly-read bytes as the new original instead of
  leaving `okey` naming the file as it was on first insert. The .pptx
  resolves originals before the build and hands them down as a map.
  A flip book's frames retain originals, and `useOriginals` walks them.
  **The lint.** It reads the `sizes` `figFonts` was already collecting,
  gained a trim check (the deck's own `a.crop` insets need no metadata),
  counts figures in its summary line, and says "figures" in the button,
  the tooltip and the pane that open it.
  Browser-verified in Edge across 30 checks on a fixture deck: the
  reference list on a virgin deck, the rich run surviving the insert,
  add-then-untie from the ribbon, provenance for a flip book with iconed
  buttons, delete-unties-and-freezes, the deck-wide update, the renamed
  lint and both exports still building — with no runtime errors.

---

## 10. Bugs — the 2026-08-29 hand-test

**Closed.** Every entry below landed and ends in a dated completion note naming its
commit; the four struck through were refuted and needed no code.

Reported by the user after working in the editor for real, worst-first:
things that LOSE WORK, then things that block ordinary work, then things
that are merely wrong.

**Every code-answerable claim below was verified before being written
here** (six readers, then an independent refuter per finding whose only
job was to prove it wrong). 34 claims were read; **12 died.** Those are
kept, struck through in the note, because knowing a thing is NOT broken
is worth as much as knowing it is — and because two of them were wrong
in the user's favour, not ours.

Two cautions carried over from group 9: `docs/` is a GENERATED build,
last rebuilt 2026-08-24 and now 63 `src/` commits behind, and the service
worker serves the one before that. Several reports below are against a
build, not against the code. And a claim is a claim until somebody
drives it — the suite is substring greps.

- [x] **T60 · S — An empty text box deletes itself, and takes your
  bullet with it.** "Creating dot points with no text seems to delete
  the cell, but also when you unclick it it deletes."
  *Verified CONFIRMED.* `editableText`'s blur handler splices any
  `k:'text'` annot with blank text and no `html`. A list reaches it:
  the element IS the `<ul>`, so `el.innerHTML` is a bare `<li>` run,
  and `sanitizeRich`'s rich test does not list `li`, so `a.html` is
  deleted on every blur of an unstyled list — then the box goes. There
  IS an undo entry (the blur ends in a non-quiet `markDirty`), but
  nothing says so. Fix: skip the auto-delete when `listOf(a)` is set,
  or add `li` to the rich selector; say it with a toast naming Ctrl+Z.

  *Done 2026-08-29 — `7290067`.* An empty list survives its blur:
  `sanitizeRich` was stripping the bare `<li>` that would have
  saved it, so `a.html` went and the box followed. The deletion
  that does still happen names Ctrl+Z.

- [x] **T61 · M — A new slide should not be a notebook frame, and the
  insert door should be "insert object".** "New slides that have just
  the notebook cell can't be deleted, also please don't make that the
  default. Also the notebook cells should be just 'insert object', that
  can come from a notebook or local image or something."
  *Verified: the "can't be deleted" half is REFUTED* — the placeholder
  selects and deletes like any other item. The rest stands as a design
  ask: a new slide starts EMPTY, and the insert door is renamed and
  widened to **Insert object** (notebook figure, local image, or a
  path — images already take paths).

  *Done 2026-08-30 — `3518133`, then `ef53201`.* A slide starts
  empty, the insert tool is **Object** rather than Cell and its
  tooltip names all three sources a frame can take, and the empty-
  slide hint is finally built — the stylesheet had been dressing it
  for both themes while nothing created it.

- [x] **T62 · S — Bold is a lie on a title.** "Text always seems to
  revert to bold; e.g. resizing a text box, back to bold."
  *Verified PARTIAL, and NOT what it looked like.* The resize/fit theory
  is refuted: `applyStyleTo`'s five callers are all explicit user
  actions and `fitTexts` never writes the model. The real cause is a
  hard `font-weight` on titles in `deck.css:2676`, so the Bold toggle
  changes the model and nothing on screen. Separately `applyStyleTo`
  does bake `b` over a hand-set weight when you re-stamp a style, which
  is worth making visible. Not deck corruption; a small CSS fix.

  *Done 2026-08-29 — `977e86a`.* The title's inner span reads
  `--ttl-w`, which the renderer sets only once Bold has been
  touched: untouched 600, on 700, off 400. Before that the CSS
  weight outranked the model and Bold changed nothing on screen.

- [x] **T63 · S — Selecting several objects selects everything.**
  "Selecting multiple objects can be bugged, it just results in
  everything being selected."
  *NOT YET VERIFIED — the only entry in this group that was not.*
  Suspect `startMarquee` / `selSet` and its interaction with groups and
  locked items. Reproduce in a browser first.

  *Done 2026-08-29 — `43237ba`.* `startMarquee` was the one drag-
  starter in the file that never called `preventDefault`, so a
  marquee press also began a NATIVE text selection — the page going
  blue, which is what "everything gets selected" meant. A lost
  mouseup no longer leaves the band live, and Ctrl+A takes the
  objects instead of falling through to the browser.

- [x] **T64 · L — Crop, properly. (design first)** "The crop is still
  really buggy... the clicking button should just automatically do the
  trim by edges... then the crop by shape was supposed to be you put a
  shape over the top and it crops just that part, and there is no free
  crop as well where you can just draw a shape. These are amateur. I
  asked for photoshop quality and this disappoints."
  *Verified: three of four stand.* (1) CONFIRMED — `#fmt-crop` opens a
  submenu; make the button itself arm edge-trim and put the shape
  presets behind a caret. (2) **REFUTED** — the drag handler does move
  the grabbed edge; it does not recentre or zoom. (3) PARTIAL —
  `a.crop.shape` exists but `cropCss` returns the shape clip and
  ignores the inset, so the shape cannot be positioned or sized over the
  picture; that is the "put a shape over the top" the user meant.
  (4) CONFIRMED — no free crop at all; needs `a.crop.path` as a polygon
  plus a draw gesture.

  *Done 2026-08-30 — `6b3f770`.* Crop splits into a button that
  trims and a caret that holds the shapes, the shapes are points
  drawn inside the trim box, and a free-hand lasso writes
  `a.crop.path`.

- [x] **T65 · M — An image resizes only diagonally, and has no
  numbers.** "Why can pictures it seems only be dragged on diagonal, so
  can't be made taller or wider. Also where are all the options that I
  said, like keep square, and also having the width, height, and
  position (x,y)."
  *Verified — and the earlier triage was wrong in the user's favour.*
  There are no per-side handles: `mkResize` emits exactly four corners
  and the CSS has only those four. (The per-side handles in
  45-images.js are the CROP trim handles.) `startResize` already
  branches on east/west/north/south, so adding n/e/s/w costs no gesture
  maths. Aspect lock exists as Shift and is documented only in a
  tooltip. No numeric W/H/X/Y anywhere — add a row in page millimetres.

  *Done 2026-08-29 — `48090c8`.* Every box gains four SIDE handles
  (a text box six, having no height of its own), one-axis drags
  leave the other axis alone, `a.lockar` is a per-item Keep-shape
  with Shift as its momentary opposite, and a Size & position pane
  types W/H/X/Y in page millimetres through `anchorSet`.

- [x] **T66 · M — Match slide should be click-the-thumbnail.** "You have
  to cross reference with the thumbnails on the side. It would be good
  if you just clicked it, then clicked the thumbnail of the slides you
  wanted to match."
  *Verified CONFIRMED (a wrong door, not a broken feature).* Matching
  works. Reuse the existing `armMatch`/`matchHit` armed-state shape at
  slide level: arm from `#hm-match`, let a click on a `.film-row` pick,
  press Done.

  *Done 2026-08-30 — `1577dec`.* Match slide is armed and pointed
  at the thumbnails, the button's tooltip says so, the match menu
  grows two rows that arm it, and the strip gains a picker look.

- [x] **T67 · S — ~~The notebook picker's code filters do nothing.~~**
  "Code filtering options for notebook doesn't work when adding a figure
  from a notebook."
  *Verified REFUTED.* There is no picker filter bar at all — the deck's
  card picker is `#pickbar` and carries none. Those are the NOTEBOOK's
  own filters, and their handlers re-query and re-render (`cycleF` →
  `writeF` → `applyFilt`). `body.picking` only adds a cursor, so they
  stay live during a pick. If the real complaint is "I filter, then
  place a card and the frame ignores it", that is deliberate:
  `cloneBody` strips the filter classes so a placed frame is not
  silently missing rows. **Ask the user which they meant.**

  *Closed 2026-08-30 as refuted.* No code changed and none should.
  The question in the last line is still unanswered and is not a
  task — it is a thing to ask the user next time the picker comes
  up, not work waiting in a queue.

- [x] **T68 · S — ~~Lock figures is always greyed out.~~** "The lock is
  always greyed out" and "it also never works."
  *Verified REFUTED — an environment, not a defect.* `#fmt-lockver`
  enables for exactly one condition: a placed cell frame with a ref, in
  the **app** build (`APP.mode==='app'`, which only the local server
  renders). Static exports and the web build show it disabled with a
  tooltip that says why. Almost certainly the same cause as T84 below.

  *Closed 2026-08-30 as refuted.* No code changed. Worth
  remembering when the next "it is greyed out" report arrives:
  the answer was which BUILD it was greyed out in.

- [x] **T69 · S — Present mode: the code arrow cannot be turned off,
  and the slide does not fill the screen.**
  *Verified CONFIRMED, both halves.* Needs a persisted deck flag
  (whitelisted in `normPres` — see the T52 follow-up for why that is not
  optional) read by `updateVNav`/`renderSlide`, and the letterbox maths
  in the playback branch.

  *Done 2026-08-30 — `b4ae980`.* A per-deck `hideTrace` flag, the
  four-place plumbing a persisted flag needs, and a Present-menu
  door; playback is sized without the editing padding.

- [x] **T70 · S — The saved-to chip does not fit its own box.** "Please
  make sure everything is fitting inside its box (come on). Also please
  put that next to the save button, also please make there be an
  auto-save timer."
  *Verified CONFIRMED.* The chip needs an inline-block inner span for
  `text-overflow:ellipsis` to fire at all; then move it beside Save and
  make the autosave interval a visible, settable thing.

  *Done 2026-08-30 — `b4ae980`.* The chip is fitted, moved beside
  Save, and the autosave cadence is a visible, settable thing.

- [x] **T71 · S — Insert-text's option boxes are too small to see the
  symbols.**
  *Verified PARTIAL.* `#tx-type-menu` lacks the width/padding rule the
  format bar's Styles menu has.

  *Done 2026-08-29 — `92a7c61`.* The maths palette keys and the
  text-type menu grew enough to read a glyph.

- [x] **T72 · M — Bullets sit oddly, and you cannot leave one.** "Dot
  points can't really be deleted, you can just remove the lines. Dot
  points sit in a weird way."
  *Verified PARTIAL.* Turning the whole list off DOES work (press the
  pressed Bullets button). What does not: leaving the list from inside
  it — `sanitizeRich` flattens any browser-native escape back to plain
  lines and the renderer re-bullets them. And a centred list keeps its
  markers in the fixed 1.15em gutter, which is the "weird way". Pairs
  with T60.
  *2026-08-29: half done.* The markers now travel with the words — a
  centred or right-aligned list gets `list-style-position:inside`,
  which is the "sit in a weird way" half. Still open: leaving a list
  from INSIDE it (Backspace at the start, or Enter-Enter out), which
  `sanitizeRich` flattens back to plain lines the renderer re-bullets.
  Turning the whole list off from the Bullets button always worked.

  *Done 2026-08-30 — `b162de1`.* `sanitizeRich` now counts `li` as
  rich — the editable element IS the `<ul>`, so its `innerHTML` is
  a bare `<li>` run and querying for `ul`/`ol` found nothing, which
  is why every unstyled list had its markup deleted on every blur.
  With the markup surviving, committing content with no `<li>` left
  drops `a.list`, so you can leave a list from inside it.

- [x] **T73 · S — Click, click-click, click-click-click.** "Double click
  a word should highlight it, triple click should highlight the line,
  and quadruple should do entire box."
  *Verified CONFIRMED, trivial.* The dblclick handler unconditionally
  collapses the caret with `caretRangeFromPoint`, so word-select can
  never work inside a box already being edited. Guard it on
  `el.isContentEditable` captured before `beginEdit()`. Triple-click
  already works; quadruple needs adding.

  *Done 2026-08-29 — `7290067`.* A double-click inside a box
  already being edited no longer wipes the word the browser just
  selected, and four clicks take the whole box.

- [x] **T74 · M — Markdown cells, beside the LaTeX ones.** "Can there be
  like the latex cells, can we have markdown cells as well."
  *NEW as an insert kind.* Rich text and a Markdown export exist; "type
  Markdown, see it rendered" as a first-class box does not.

  *Done 2026-08-30 — `691e620`.* Two new controls (Insert >
  Markdown, and Edit markdown beside Edit equation) placed in all
  108 ribbon arrangements, the editor dialog, the `.an-md` rules,
  and one new documented annot field.

- [x] **T75 · S — The notebook rail: no search, overcrowded, and New
  Notebook is on the wrong side.**
  *Verified PARTIAL.* No search control exists; add one filtering both
  `#tabstrip` and `#presstrip`. Same rail as the earlier "lock notebooks
  where the slide thumbnails are is the worst" report — fix together.

  *Done 2026-08-30 — `58a5d69`.* One search field over both strips,
  a clear button, an empty-state line and a Ctrl+K.

---

## 11. Layout and placement — the same pass

**Closed.** Same pass, same verification, same completion notes.

- [x] **T76 · M — Animations, re-thought. (design first)** "The
  animation bubbles that appear are the worst, like you can't get rid of
  them. There should just be a symbol next to the slide thumbnails that
  indicates there are animations."
  *Verified CONFIRMED.* The build-step badges are drawn unconditionally
  in the editor. Gate them on the animation pane being open (or a view
  toggle beside Rulers/Grid), mark the thumbnail instead, and cut the
  options back.
  *Done 2026-08-30, except the last clause.* The gate is a CSS selector
  rather than a renderer check, because seven places close `#animpane`
  and only one re-renders the annot layer — a JS gate would have left
  the badges standing in six cases out of seven, which is the complaint
  over again. The thumbnail carries `▸N`, a count in the same amber as
  the badges. **"Cut the options back" was NOT done, deliberately.**
  That clause was this file's editorial addition, not the user's ask
  (they asked for the bubbles to go and the thumbnail to say so, both of
  which ship). Deleting Rise and Zoom would remove working capability
  from a tool whose standing brief is to match or exceed PowerPoint, and
  taking a feature away is the user's call, not this file's.

- [x] **T77 · S — The home view is a mess at the top.**
  *Verified PARTIAL.* The header is already hidden; the cut list is the
  hero/wordmark/tag block and the welcome drop, which can fold into the
  Open button.

  *Done 2026-08-30 — `b4ae980`.* The home view's top folded.

- [x] **T78 · S — The thumbnail strip is squeezed by buttons that are
  not even in it.**
  *Verified CONFIRMED.* `#dc-nbs`' bulk-action rows take height from the
  strip. Make it collapsible or reduce it to one row plus an overflow
  menu.

  *Done 2026-08-30 — `b4ae980`.* The notebook actions collapsed out
  of the strip's height.

- [x] **T79 · S — ~~Clicking an object should bring up its tab.~~**
  *Verified REFUTED.* It does: `selectAnnot` → `showFmt` →
  `ribbonSelTab()` → `setTab`, deferred to the last line so every
  contextual control is un-hidden first. The only suppressions are by
  design (already on the tab; a tool armed; you just drew). Stale build.

  *Closed 2026-08-30 as refuted.* No code changed. It was the stale
  `docs/` build, which is the single most common cause of a report
  in this group — rebuild before believing one.

- [x] **T80 · S — Growing the thumbnails eats the ribbon.**
  *Verified CONFIRMED.* `--film-w` is clamped to 46vw with no regard for
  the ribbon's measured floor. Clamp against it instead.

  *Done 2026-08-30 — `b4ae980`.* The strip is clamped against the
  ribbon's measured floor rather than a bare 46vw.

- [x] **T81 · S — Home group order.** "The layout for slides should be
  below the new slides, and the duplicate and match slides should be one
  over another."
  *Verified CONFIRMED, trivial.* Move `#hm-delslide` ahead of
  `#hm-laywrap` and the 3x2 row-major grid lands as asked.

  *Done 2026-08-29 — `92a7c61`.* The Slides group reorders so
  Layouts sits under New slide and Match under Duplicate.

- [x] **T82 · S — The Cancel button shifts the row it appears in.**
  "When clicking a button to insert things, the cancel button appears in
  a weird spot."
  *Verified — the mechanism is not what it looked like.* `#et-cancel` is
  a STATIC node that always sits between Line and Arrow; only its
  `hidden` bit changes, so un-hiding it pushes everything after it
  along. Move it to the end of the group, or reserve its width with
  `visibility:hidden`.

  *Done 2026-08-29 — `92a7c61`.* `#et-cancel` moves to the END of
  the Insert group — in the markup and in all 108 arrangements — so
  un-hiding it appends instead of shoving every later control along.

- [x] **T83 · S — ~~Where is the Layouts button?~~ (the naming bug it hid,
  fixed)**
  *Verified REFUTED — but there is a real naming bug.* BOTH doors exist:
  `#lay-drop` on **Design** says "Layouts", `#hm-laywrap` on **Home**
  says "Layout". The singular/plural split means they do not read as the
  same feature. Rename one.

  *Done 2026-08-29 — `92a7c61`.* Home's slide-layout door is renamed
  **Layouts** to match Design's, so the two read as one feature.

- [x] **T84 · S — ~~View's buttons lost their icons.~~**
  *Verified REFUTED.* Every View button carries its `data-ic` in current
  source, and the T52 browser run shows all of them drawn. This is the
  stale `docs/` build. **Rebuild `docs/` before believing any report of
  this shape.**

  *Closed 2026-08-30 as refuted.* No code changed; `d047d10` rebuilt
  `docs/`, which is what the report was actually about.

- [x] **T85 · S — Where is the desktop-app download?**
  *NEW.* The Electron path exists for development; there is no
  user-facing door to it.

  *Done 2026-08-30 — `b162de1`.* The install door is offered
  whenever this is the web build, rather than only while the browser
  happens to have a prompt pending, and help.html gains an install
  section and loses a stale reference to a single-file
  `semantic_render.py`.

- [x] **T86 · M — Flip books: buttons per image, and animations.**
  *Verified: the tie is REFUTED as broken* — `a.fb`/`flipShows` work, so
  the complaint is findability. Genuinely new: one button per figure
  instead of prev/next, and driving a flip book from the build sequence.

  *Done 2026-08-30 — `f6d6cef`.* Flip books gain a Stepping chooser
  in the frames pane, a button-per-figure bar, a stop timeline that
  lets an animated book's frames follow its build, and a tie hint
  that no longer hides itself.

---

## 12. Features asked for in the same pass

**Closed** — with one honest exception. T91 shipped the source
producers and not the app doors that reach them; its note says so,
and the remainder is T100 and T101 in group 13.

- [x] **T87 · L — A real design surface for the deck's type. (design
  first)** "Where was the button where people can 'standardise
  presentation'... controlling things like 'global heading layouts'...
  Then it would be cool if you could also 'show outlines of all
  objects'."
  *Three-quarters built and scattered.* `#dsg-std`, style sets, the
  Apply dialog and T5's `SELECT_CRIT` all exist. Missing: the
  full-screen view that puts them together, the drag-the-default-
  position gesture, and the all-slides outline overlay. Build the
  surface on what is there; do not build a second Apply.

  *Done 2026-08-30 — `b65e2a0`.* A Design button placed in all 108
  ribbon arrangements, the design surface it opens, and its
  stylesheet. Built on `#dsg-std`, the style sets and `SELECT_CRIT`
  as the note asked; there is still exactly one Apply dialog.

- [x] **T88 · M — Present mode's side panel.** "An option to 'turn off
  animations'... a global text bigger or smaller."
  *NEW.* Skipping builds is the load-bearing half.

  *Done 2026-08-30 — `fbdc715`.* Present mode gains a Talk button
  and panel (skip builds, text size), their keys, and a
  `--talk-text` multiplier in the three places a page sizes text.

- [x] **T89 · S — Every feature whose only door is a right-click.**
  Consolidates the user's "what happened to X" reports, all of which
  turned out to be **findability, not absence**: components/clones,
  object matching, arrangements (custom slide layouts), per-object
  history, and the provenance pane. Each ships and works; each is
  reachable only from the canvas context menu or a menu two levels
  down. Genuinely missing: a "show me every instance of this component"
  row, which `cmpInstances(id)` already computes.

  *Done 2026-08-30 — `b4ae980`.* Real doors for all five right-
  click-only features, including the "show me every instance" row
  `cmpInstances(id)` was already computing.

- [x] **T90 · L — Version branches.** "Where is the version and then you
  can create branches of version."
  *Verified: history ships, branching does not.* Not a small edit — a
  parent id on the entry, a non-linear index that `HIST_KEEP=20`'s
  head-drop cannot corrupt, and a way to show the shape.

  *Done 2026-08-30 — `3406351`.* Snapshots carry a parent and a
  branch name, the rail draws the shape, and the panel gains a
  **Start a branch** button and an on-which-branch chip.

- [x] **T91 · M — Sources beyond Jupyter. (design first)** "Something
  for things like Overleaf, Excel etc."
  *Verified: the refresh contract really is source-agnostic.* A new
  source needs a Document producer (`parse_X` → `notebook.model.
  Document`) and nothing else on the render or deck path.

  *Done 2026-08-30 — `daa186f`* — **but only half of what the title
  promises, which the 2026-08-30 review caught.* The registry, the
  four producers, `load_doc`'s dispatch, the CLI and the Pyodide
  bridge all ship. The LOCAL APP still cannot open any of them:
  `_list_dir`, `_resolve_nb_path`, `_parse_nb`, `submitOpenInput`
  and the window drop handler are all still `.ipynb`-gated, and the
  widened `SRC_RE` reaches only web mode's file chooser. A figure
  beside a `.md` or `.tex` file does not display in any door. That
  is T100 and T101; this entry stays ticked for what it built.

- [x] **T92 · S — Paste code and have it format.**
  *NEW.* The highlighter exists; this is a paste path into it.

  *Done 2026-08-30 — `b4ae980`.* Pasted code is detected and
  highlighted.

- [x] **T93 · S — Duplicate without context.**
  *NEW.* Duplicate the object, drop its `ref`, provenance and frame
  binding.

  *Done 2026-08-30 — `b4ae980`.* Duplicate-without-its-source.

---

## 13. The 2026-08-30 external review — [reviews/](reviews/)

Two reviews landed on the same commit (`23956c4`) from outside this
backlog's own habits. `reviews/2026-08-30_19-01.md` is the bug/hygiene
pass; `reviews/2026-08-30_19-22.md` is the missing-features pass. They
are the first reading of this repo that asked *"what does an installed
copy do?"* rather than *"what does the source do?"*, and that question
found the worst defect the project has had.

**How this group was written.** Every claim in both files was re-read
against the source at `23956c4` by one reader, then handed to a second
reader whose only job was to REFUTE it by opening the code. 126 claims
were graded; **four died** and are recorded struck through, because
knowing a thing is NOT broken is worth as much as knowing it is. Several
survived but with the reviewers' *seam* corrected — those corrections are
in the notes, and they matter: three of the fixes the reviews proposed
would have edited dead code.

**These boxes are the first unticked ones in this file since group 8.**
Groups 9–12 are now closed and carry dated completion notes (T97). If you
are an agent picking this up: everything above this line is the design
record. **This group is the queue.** Take it from the top; it runs
worst-first.

### Packaging — nothing else matters until this is right

- [x] **T95 · S — A published wheel contains no deck editor at all.**
  *Verified CONFIRMED, twice, by two readers who each built a wheel.*
  `pyproject.toml`'s `[tool.setuptools.package-data]` declares
  `assets/js/*.js`; a setuptools glob does not cross `/`, so none of the
  fifteen `assets/js/deck/*.js` fragments is packaged. There is no
  `MANIFEST.in`, no `setup.py`, no `include-package-data` — that list is
  the whole declaration. A wheel built from `HEAD` holds **zero** deck
  fragments, and so does the sdist, so `python -m build`'s
  wheel-from-sdist path is broken the same way. `assets.deck_js()` then
  raises `FileNotFoundError` on `deck/00-page.js`, from
  `render/page.py:122`, which is unconditional — so **every render path
  dies for an installed user**, not just the editor.
  *Why nobody noticed:* the source checkout and the generated `docs/`
  both read the files off disk beside the package. `pyproject.toml` was
  last touched in `3adf3f5`, which is an ancestor of `79f6c19` — the T36
  commit that split `deck.js` into `deck/`. T36 updated CI's JS syntax
  check and never touched package data. CI's `build` job does install the
  wheel and render a notebook (`ci.yml:47-68`), which is exactly the right
  check; it has therefore been **red since T36**, 141 commits back.
  Fix: one line. Keep the by-extension style — the comment above it
  explains that `assets/**/*` was rejected because it sweeps up
  `__pycache__/*.pyc`.

- [x] **T96 · S — The test that was supposed to catch T95, and could
  never have.**
  `tests/test_characterization.py:557`
  `test_assets_load_from_the_installed_package` is named for this defect
  and its docstring says "this is what fails first if package-data is
  misdeclared" — but `pyproject.toml:76` puts `src` first on
  `pythonpath`, so it resolves from the checkout and passes green against
  a wheel missing all fifteen fragments. It shadows an installed wheel
  and can never test what it claims. It also omits `widget.css`,
  `widget-media.css` and `widget.js`.
  Fix: a real one — glob each declared package-data pattern against
  `src/junoview` and assert the match set covers every non-`__pycache__`
  file under `assets/`. That catches the NEXT subdirectory as well as
  this one, and needs no network, no `build`, and no setuptools (bare
  `python` on this machine has none). `tomllib` is 3.11+ and CI's matrix
  includes 3.10, so guard the import rather than assuming it.
  Rename or delete the false-comfort test in the same commit; a test that
  claims coverage it does not have is worse than no test.

### The backlog's own honesty

- [x] **T97 · S — Groups 10–12 are closed, and every note still reads as
  an open work order.**
  *Verified CONFIRMED.* `grep '\[ \]' TASKS.md` returned **zero** across
  1586 lines — nothing was open — while the header called groups 10–12
  "the queue". Worse, 29 of the 34 checked entries kept present-tense
  unfinished wording: T72 "Still open", T87 "Missing:", T89 "Genuinely
  missing", T90 "branching does not", T73 "quadruple needs adding", and
  so on. Each was closed by a real commit naming its T-number — the ticks
  were honest, the prose around them was not. That is precisely the
  failure the review was asked to look for: an agent cannot tell a
  historical diagnosis from live work.
  *The completion notes already exist.* `tests/test_characterization.py`
  L433–520 holds a dated, per-task record for all thirty implemented
  group 10–12 entries, written when each `EXPECTED_MD5` moved. This is
  transcription from a repo file, not archaeology through `git log`.
  Also in scope: the "Where the work lives" table and the "GROUP 9 IS THE
  LIVE QUEUE" bullet, and the **duplicate `T60`** — group 9's ribbon-
  layouts entry and group 10's empty-text-box entry share the number, and
  `15-annotations.js:1234` cites one of them ambiguously.
  ~~Group 9 is an offender too.~~ *REFUTED* — all 22 group-9 entries
  already carry the dated paragraph this task adds to 10–12. Use
  T76 (L1451–1461) as the template; it is the one entry in groups 10–12
  that got it right, including an explicit "NOT done, deliberately".

- [x] **T98 · S — The first three files an agent is told to trust are
  wrong about the code.**
  *Verified CONFIRMED — six edits, one more than the review found.*
  `ARCHITECTURE.md:66`, `AGENTS.md:37`, `AGENTS.md:66`, `CLAUDE.md:60`
  and `TASKS.md:34` all say the deck is **fourteen** files; `DECK_PARTS`
  has fifteen. `AGENTS.md:84-88` still describes a single
  `assets/js/deck.js` of ~18,000 lines, which has not existed since T36 —
  that bullet actively misinforms and contradicts the same file's
  line 37. `CLAUDE.md:9` says "~460 tests"; there are 774. Prefer "the
  files `DECK_PARTS` names" to a hard count, so the sixteenth fragment
  cannot re-stale it. Note `00-page.js:2` carries a count too, and that
  one moves `EXPECTED_MD5`.

- [x] **T99 · S — 3.8 GB of browser scratch that no tool can see.**
  *Verified CONFIRMED by running the cleaner.* `.browser-check/` is one
  of only two untracked paths, holds nine persistent Edge profiles and
  fourteen 3 MB render snapshots, and is matched by nothing:
  `.gitignore` knows `edgeprof*`/`chromeprof*`, but the directories are
  named `edge-profile*`, and `tools/clean_scratch.py`'s `DIR_PATTERNS`
  does not list the container either — its dry run reports 9.5 MB while
  missing the 3.8 GB beside it. The redundancy filter at
  `clean_scratch.py:33-36` already collapses nested matches under a
  doomed parent, so adding the container alone is enough. Decide about
  `reviews/` in the same pass: it is evidence, so it should be tracked,
  not ignored.

### Reach — sources that parse but cannot be opened

- [x] **T100 · M — T91's sources work everywhere except the app.**
  *Verified CONFIRMED; a refuter enumerated the whole route table trying
  to break it and could not.* The registry, the four producers,
  `load_doc`'s suffix dispatch, the CLI and the Pyodide bridge all ship
  and all work. What does not is every door into **app mode**:
  `state.py:_list_dir` lists only directories, `.ipynb` and `.junoview`;
  `routes.py:_resolve_nb_path` rejects every other suffix and `_open_nb`
  calls it; `_parse_nb` demands notebook JSON and calls `parse_notebook`
  rather than `doc_from_text`; `app.js:submitOpenInput` and the app-mode
  drop handler filter to `.ipynb`. The same `.tex` file renders from the
  CLI, opens in the web build, and is refused by the desktop app.
  *Two corrections to the review's seam, both load-bearing.*
  (1) `source_label` and `SOURCE_SUFFIXES` are **dead exports** — nothing
  in `src/` imports them. Consuming them IS the work. (2) The copy fix
  the review proposed is dead code: `page.html:593`'s placeholder is
  overwritten unconditionally by `showDlg()` at `app.js:5501-5502`.
  The live strings are `app.js:5493-5498`/`5501-5502` and the welcome
  block at `page.html:425-427` and `435-436`.
  *Do not widen these:* `_add_note`, `_git_state`, `_version_cards`,
  `_versions` and `_open_version` must stay notebook-only —
  `insert_note_cell` and `_git_show_notebook` both assume a notebook, and
  `_store_version` globs `*.ipynb`. Guarding `routes.py:197` on the
  suffix costs a `.tex` its version history; that is an acceptable first
  cut but it must be **said**, not silently done, or the Versions menu is
  just empty.

- [x] **T101 · M — A figure sitting beside a Markdown or LaTeX source
  never displays.**
  *Verified CONFIRMED.* `sources.py:_img_item` keeps the relative path
  verbatim and emits it straight into `<img src>`; its own comment admits
  the path is wrong once output is not saved beside the source.
  `load_doc` knows the source `Path` and does not pass its parent on. In
  app mode `routes.py` serves only `/` and `/api/list` on GET, so
  `fig/trend.png` 404s. And `\includegraphics{fig/trend.pdf}` becomes an
  `<img>` no browser renders — the test that "covers" it
  (`tests/test_sources.py:56,145`) asserts string preservation, not a
  visible figure.
  *Three fixes, one seam:* thread an optional base directory through
  `doc_from_text` into the four producers, following `parse_table`'s
  existing keyword precedent; branch `_img_item` on suffix so
  raster/SVG stays an `<img>` and PDF/EPS becomes a named link card; and
  emit **no** `<img>` at all for an empty `src`, which is the cheapest
  part and independent of the rest. `web_parse` has no directory to pass
  and should pass `None` explicitly. Prefer embedding at parse time to
  opening a static route: `routes.py:_resolve_path` is **not** a
  containment check — it `expanduser`s and resolves, so an absolute path
  escapes the root.

- [x] **T102 · S — The Markdown producer: front matter, tables, and more
  than one figure.**
  *Verified CONFIRMED.* Front matter is not stripped, so a YAML block
  becomes body text and the title falls back to the filename —
  `parse_latex` already does exactly this shape with `_TEX_TITLE`. Pipe
  tables are not recognised, though `parse_table` holds an HTML emitter
  worth factoring out. `last_fig` is a single slot, so two uncaptioned
  images in a row lose the first. Inline `![alt](src)` and `[text](url)`
  are not rewritten at all — that one is two `re.sub` rules in
  `render/markdown.py:inline`, applied after the escape.

- [x] **T103 · M — The LaTeX producer: `align`, `tabular`, and `\ref`.**
  *Verified CONFIRMED.* `_tex_plain` says outright it is not a TeX
  engine, and that stays true — this is not a request for one.
  Three bounded wins: `align` currently loses its alignment (emit
  `$$\begin{aligned}…\end{aligned}$$`, two lines); `tabular` is dumped as
  escaped raw LaTeX in a `<pre>` when the `&`/`\\` grid maps onto the
  same emitter T102 factors out; and `\ref` can be resolved in a second
  pass from the label→item map the parser already builds. A `.bib`
  bibliography is out of scope — `load_doc`'s signature has no slot for a
  second input file.

### Accessibility

- [x] **T104 · M — The deck goes full-screen and the page underneath
  stays live.**
  *Verified CONFIRMED, with the review's own emphasis corrected.*
  `body.deck-open` only sets `overflow:hidden` — but `deck.css:22` is
  **not** the seam, because `inert` cannot be set from CSS and the three
  channels CSS *can* isolate are already isolated (scroll lock, an opaque
  fixed `z-index:100` surface, and `.apptop` dropped from the tab order).
  The whole fix is JS: `55-sections-and-strip.js` toggles the class at
  `:1045-1047` without making the shell inert, without a dialog boundary,
  and without restoring focus on close, so Tab walks into a ~12,670 px
  document nobody can see and a screen reader meets two applications at
  once.
  *Make it mode-aware, not "the deck is open".* In **create** mode
  `.deck.creating` is a side panel and the notebook behind it is a live
  drag source by design — isolating it would break a shipped gesture.
  ~~Copy the history full-view path.~~ *REFUTED* — that `inert` belongs
  to the embedded preview and `tests/test_version_history.py:242` pins
  it; it is not a modal pattern.
  A separate S-sized fix falls out of the same survey and needs none of
  the design work: the overview panel's Escape branch is dead code
  (its capture-phase listener wins), and `07-ribbon-layouts.js:382-389`
  already shows the shape that works.

- [x] **T105 · M — Every image the deck draws carries `alt=""`.**
  *Verified CONFIRMED, and smaller than the review sized it.*
  `DECK_KEYS`/`SLIDE_KEYS`/`ANNOT_COMMON` have no alt, description,
  decorative or reading-order field, and every rendered image is
  therefore explicitly decorative — including the ones carrying the
  science.
  *The minimum honest slice is four files*, because persistence, undo,
  copy/paste, components, print, standalone HTML and the 108-layout
  catalogue all carry a new annotation key with **zero** code changes,
  and `_check_annot` never consults `ANNOT_COMMON`: (1)
  `20-notes-and-tables.js:2106,2148` inside `renderAnnots` — the single
  load-bearing edit, since `buildSlideNode` and `buildPrintRoot` both
  funnel through it and `exportDeckHtml` serialises the latter, so
  present, presenter, PDF and standalone all follow; (2) the five
  genuinely decorative thumbnails get `alt="" aria-hidden`; (3) one more
  `reviewLints` block for images with no alt and no `decorative`;
  (4) `ANNOT_COMMON` and the `DECK-FORMAT.md` item table — which should
  also gain the missing `name` row while they are open.
  PowerPoint's `descr` is two lines once the field exists.

- [ ] **T106 · design first — An authorable reading order.**
  `orderedIdx()` is a top/left visual heuristic, and six callers inherit
  it — builds, review, matching. Overriding it means a durable key on
  `oid`, a resolver the six share, and a decision about whether
  `renderAnnots`' DOM order follows it (today it walks storage order).
  Design it before adding more object kinds; retrofitting semantics after
  charts and media multiplies the migration.

### PowerPoint export

- [x] **T107 · S — Crops and transitions can survive the trip today.**
  *Verified CONFIRMED, and both are genuinely small.* Crops: the only
  line touching `a.crop` in 2,336 lines is `note.cropped++`; the fix is
  `<a:srcRect>` inside `<a:blipFill>` in `pptx.js:picShape` — 1000ths of
  a percent, and it **must** come before `<a:stretch>`. Transitions:
  `transFor` is directly callable from the export site (both live in the
  one concatenated IIFE, and `DECK_PARTS` orders `45-images` before
  `60-saving-and-export`), the slide map already has `ent.i` in hand, and
  `<p:transition>` goes after `<p:clrMapOvr>`. Map only `fade`/`move`,
  conservatively, and keep counting whatever is still approximated.

- [x] **T108 · M — Speaker notes never reach the Notes page.**
  *Verified CONFIRMED.* The writer emits `<p:notesSz>` and then no notes
  slide and no notes master, and `pptxBuildAndSave` passes each slide
  only `{bg, items}` — `sl.notes` is never handed over. Deck side is one
  field on the spec; writer side is boilerplate that can reuse
  `emptyTree()` and the master's own `clrMap` literal. This is the
  largest single loss a real user meets, because a talk without its notes
  is not a talk.

- [x] **T109 · S — Say what will be lost before the export, not after.**
  *Verified CONFIRMED.* `pptxItems` already computes the `note` tally;
  running the map dry into a dialog before the download is the seam. And
  `help.html:564-570` is honest about tables, crops and equations while
  saying nothing about notes, links, builds or transitions — so a user
  reads a complete-looking list that is missing its biggest entries.
  Fix the prose in the same commit, minding the four string pins in
  `tests/test_pptx_export.py`.
  Related and nearly free: `tableShape()` already tolerates the shape a
  notebook-table scraper would produce (missing `cols` falls back to an
  equal split, a short row yields `''`), so exporting notebook tables as
  real PowerPoint tables costs no writer change — but pass `grid:1`, or
  they arrive with no rules at all.

- [ ] **T110 · design first — Equations, builds, masters and links.**
  The four losses that are NOT small, recorded so nobody re-scopes them
  as quick wins. Equations: `texPlain` is a single-pass string rewriter
  with no parse tree, so OMML structure cannot be recovered from it — a
  real fix is a second LaTeX front end. Builds: `<p:timing>` must target
  shape ids that are an internal counter in `build()` the deck never
  sees, and flip books explode one slide into N before export. Masters:
  every box is written as an independent `txBox` with direct formatting,
  so promoting titles to placeholders changes how their formatting
  resolves. Hyperlinks: the writer half is small, but there is no `a.link`
  on any annotation, no UI, no normaliser entry and no live-view or PDF
  story — it is a feature (T118), not an export gap.

### Tests that prove behaviour rather than spelling

- [x] **T111 · S — Run `pptx.js` and read the ZIP it makes.**
  The hand-written OOXML writer is pinned only by string presence, and
  its correctness is binary-format correctness — a valid-looking string
  in an invalid package still opens with a repair prompt. A reader
  **proved this works today**: `_js_engine()` (already in
  `tests/test_js_contract.py`, VS Code's Electron as node) loads
  `pptx.js` with a one-line `window` shim and returns real bytes.
  ~30 lines: a `run_js()` helper, then stdlib `zipfile` (`testzip()`
  checks every CRC and the central directory for free) and
  `xml.etree` for the parts and the EMU scaling. `pptx.js:11` says
  outright that its seam exists so it can be tested on its own.

- [x] **T112 · S — The stale-write guard has no test at all.**
  Two windows on one project is the shape that loses work, and
  `state.save_presentations`/`StaleWrite` and the revision check in
  `routes.py` are covered by nothing — a reader looked hard and found
  none. Three assertions against a `tmp_path` root: save at `rev=0`,
  `pytest.raises(StaleWrite)` on a stale write, and the exception
  carrying the current revision and presentations. Pure stdlib.

### Strategic — decide before building

These are not tasks in the sense the rest of this file uses. Each is a
subsystem, and the first product decision is whether junoview stays a
notebook-first presentation tool or takes on Office interchange. The
reviews' bottom line, which this backlog accepts: **the distinctive core
is already stronger than a small PowerPoint clone**, and indiscriminate
feature copying is the wrong direction. Positive evidence for each
absence is an exhaustive registry or schema, not a search that found
nothing.

- [ ] **T113 · design first — Is Excel in scope at all?** `SOURCES` has
  no `.xlsx` and `tests/test_sources.py:225-232` asserts so deliberately;
  the code calls CSV "the Excel half", which a static 500-row preview of
  one delimited table is not. Adding `openpyxl` breaks two load-bearing
  promises (stdlib-only, Pyodide parity), so the choice is between an
  optional local-only extra, a stdlib `zipfile`+XML reader, a separate
  `workbook/` subsystem, or saying plainly that CSV is a document source.
  **A bytes seam has to be opened first** — every producer today takes
  text, and `loader.py`, `web_parse` and the web loader all assume
  `read_text`. Nothing about a workbook can start before that.

- [ ] **T114 · design first — PowerPoint import.** The export vocabulary
  is an if/else chain ending in `skipped++`, and the only importer takes
  junoview JSON or polyglot HTML. A `.pptx` is a ZIP of related parts, so
  it needs its own boundary rather than growing `notebook/sources.py` —
  and it wants to become a *deck*, while every `SOURCES` producer returns
  a `Document`. That mismatch is the design question. `pptx.js` can
  decompress with the platform's `DecompressionStream`, so the JS route
  is cheaper than the reviews assumed. Never claim a round trip without a
  loss report; macro formats read-only.

- [ ] **T115 · design first — Masters and inherited layouts.** `lay` is
  documented as "the id of the template last applied; annotations hold
  its actual geometry" — applying a layout stamps coordinates, and the
  exporter writes exactly one blank layout and one empty master.
  Real inheritance needs template identity, placeholder identity,
  per-slide overrides and a migration for flattened decks. **Do not
  rebuild what components already are:** `cmpPlaceOne`, the `cmp`/`ci`/
  `cinst` triple, `cmpInstances` and the Detach escape all ship, and
  reusable content is not the same thing as placeholder inheritance —
  say which is which before writing either.

- [ ] **T116 · design first — A media annotation kind.** The kinds are
  exhaustively text, cell, rect, image, arrow, draw, table, flip. A
  notebook's stored `<video>` output does display, which is the
  confusing part — but there is no media item, no Insert door
  (`accept="image/*"` in two places), no captions and no export path.
  Storage first: images already had to move originals to IndexedDB when
  localStorage quota blew, and recordings are far larger.

- [ ] **T117 · design first — Native data-bound charts.** No chart,
  diagram, editable path or 3D object exists; a figure exports as a
  picture, so nobody can recolour a series in PowerPoint. The
  notebook-first answer is not to clone the chart dialog: it is a durable
  binding from a deck object to a notebook anchor plus a small
  declarative chart schema that keeps provenance. That is the genuine
  "and more". `20-notes-and-tables.js:771` already draws cloned Plotly
  JSON specs in cell frames and is the seam a native chart would reuse.

- [x] **T118 · M — An object-level action model.** *Verified PARTIAL —
  more ships than the review found.* The `mdHref` allowlist, the
  `jvn-goto`/`data-slide` convention with its CSS, the shared `goto`
  command and durable `oid`/`sid` all exist; notes already jump to a
  slide. What is missing is assigning a URL or slide jump to any selected
  **object**, and present-mode click behaviour. The stage handler belongs
  beside the existing playback click delegation, which already has the
  `closest('button,a,input,select')` bail-out to hook into. An action is
  an allow-listed field, never arbitrary JavaScript; internal targets use
  `sid`, not slide number.

- [ ] **T119 · design first — Hosted accounts, collaboration, live
  audience.** Explicitly cut in this file and described as future work in
  `help.html`. Recorded here as one entry because they are one
  dependency: identity. Nothing — comments, presence, share links, polls,
  captions, cloud recording — can be built before a hosted service is
  designed with auth, tenancy, retention and a security review. The local
  app must stay localhost-only and token-guarded. Do not grow this out of
  the file server one public route at a time.

- [ ] **T120 · design first — An extension model.** A new source format
  means editing the Python registry and its synchronised UI gates; a new
  object kind means edits through the whole assembled IIFE, schema,
  normaliser, clipboard, history and exporters. `SOURCES` is the closest
  thing to a real plugin point and could take an entry-points bridge;
  `DECK_PARTS` cannot, because the no-build-step/`file://` constraint is
  deliberate. `deck_api.py` is the honest automation seam and should stay
  a lossless view over JSON rather than exposing IIFE internals.

- [x] **T121 · M — The review panel: one exportable report, a timing
  lint, and JSON out.** *Verified PARTIAL — seven checking surfaces
  already ship*, not two: `preflight`, `reviewLints`, `standardise`,
  `tidyFindings`, `provState`/`staleFigures`, `renderReh` and `deckDiff`.
  ~~Provenance gaps are a missing dimension.~~ *REFUTED* — they ship;
  only the report integration is missing. So this is consolidation, not
  new machinery: concatenate `reviewLints` rows into the exported review
  text; add a timing lint, which is near-trivial because `rehStats`
  already produces the over/under verdict in the same IIFE; and add a
  JSON download beside the Markdown one so CI can read it. Configurable
  thresholds and suppressions need a whitelist entry in the deck-save
  path or they will not survive a save — that half is M on its own.

---

## 14. Notebook-first, and the other sources as good as notebooks

**The direction, in the user's words (2026-08-31):** *"still have a
prominent notebook thing, but we also want the other [sources] to be
possible… I want them to maybe have views like notebooks that can be
opened and selected figures (or can just copy and paste from them and it
can update with them), but the notebooks to be a whole thing in
itself."*

So: a notebook stays the centre and keeps everything only a notebook can
have — code trails, provenance, variables, git versions, note insertion.
Everything else — Markdown, Quarto, LaTeX, csv, and whatever comes after
— should be **openable, browsable, and pickable from**, with a figure
placed on a slide staying tied to its source the way a notebook figure
does. That is the "and more" the reviews argued for, reached by
deepening what exists rather than by copying Office.

**How much of it already works, measured rather than assumed.** T100 and
T101 turned out to have done most of it. A `.tex` opened through the real
app on 2026-08-31 registers as a shell under its own stem, renders its
cards, embeds its figure, and — this is the surprising part — a slide
frame whose `ref` names one of its cards **resolves**, and draws that
card's title. The picker never checked for a notebook either: it catches
a click on any rendered `.nbshell .card`. `APP.shells` has always been
keyed by *stem*, not by kind.

What does NOT work is one wrapper, which is T122.

- [x] **T122 · S — A source's figure is not recognised as a figure.**
  *Verified by driving the real app.* The notebook path wraps every
  image in `<div class="figframe" data-pt="…">` (`outputs.py`) or
  `<div class="cb-part cb-fig">` (`render/items.py`). `_img_item` in
  `sources.py` emits a bare `<img>`. Everything downstream keys off
  those classes: `cellFacets` decides `f.figure` by looking for
  `.figframe,.figpager,.plotframe`, and `applyPartFilter` then strips
  the body it does not recognise — which is why a frame bound to a
  `.tex` figure renders its **caption and an empty body**. Observed
  exactly that: `.an-cell` resolved, `.an-cellhead` read "The trend over
  the record.", `.cardbody` was `""`.
  Emit the same wrapper the notebook path emits and the picker, the
  frame, part filtering, refresh, thumbnails and every export work on a
  `.md`/`.tex` figure with no further change. Check the `pt` value too —
  it is what the Object pane and the export read to say what kind of
  figure this is.

- [x] **T123 · M — A placed source figure should follow its source.**
  "…or can just copy and paste from them and it can update with them."
  Notebook frames have `provState`/`staleFigures`/`resyncFigure` and the
  "refresh figures" path; a source figure needs the same tie, and
  `/api/open` already reloads any registered suffix since T100. Read
  those three functions before writing anything — the question is
  whether they are keyed to a notebook or merely written as if they
  were, and T122's evidence says the second is likely.
  *Done 2026-08-31 — the audit confirmed "written as if".* The compare
  half was already source-agnostic; what was missing was the DISK half:
  refresh compared against whatever the open tabs held, so a changed
  file meant a four-step dance across two surfaces. `APP.reloadTab`
  reloads a referenced tab in place with completion, `resyncAllFigures`
  re-reads every referenced stem first and then compares, and the label
  says "from their sources". Driven live: paper.tex edited on disk
  behind the app's back, one click, "1 figure updated from its source",
  the deck never closing.

- [ ] **T124 · S — The rail should say what kind of thing each tab is.**
  A `.tex` and a `.ipynb` now sit side by side with nothing
  distinguishing them, and the doors that are notebook-only (Insert
  note, Versions from git) are still offered on both — T100 kept those
  routes strict on the server, so they refuse correctly, but refusing is
  not the same as not offering. `source_label()` already names the kind
  and `_list_dir` already returns it.

### The 2026-08-31 revisit — "the hard ones", audited live

The user asked for the hard features to be re-verified: present-mode
options, clones/matching, the slide designer, custom layouts, heading
styles, standardise + outlines, version branches, paste-code, per-object
versions, and sources-with-refresh. Six readers mapped every one against
the code; the claims were then DRIVEN in the real app. Everything named
exists; the entries below are what the audit found short of the ask, plus
one boot-killing bug the drive itself surfaced.

- [x] **T133 · S — A saved deck with inline embeds kills the whole
  editor at boot.** *Found by driving, 2026-08-31: three server starts in
  a row booted to a dead editor.* `var projectPres=…map(normPres)` in
  10-decks runs AT EVAL, and when a saved deck carries an inline `emb`
  dict it walks `normPres → embStore → dropFrameCache →
  Object.keys(frameNodeCache)` — with the cache stores declared six
  hundred lines LATER. Hoisted names, unassigned values, TypeError, and
  the IIFE dies exactly the way 99-boot.js warns. Latent until a project
  file holds a deck with inline embeds, which "Update figures" +
  save produces in the ordinary course of use.
  *Done 2026-08-31.* The three cache stores are declared beside `EMBED`,
  above everything the eval-time path reaches, with the incident written
  at both sites; a new contract test pins the ORDER in the assembled
  file, because `node --check` cannot see this and no substring can.
  Verified live: the same project file that killed three boots now opens.

- [x] **T126 · M — The Talk panel finished to the T88 ask.** [deck.js]
  *Audited: the panel shipped half of what the user described.* What was
  missing, in their own words: "you can click options into it and just
  do like 'headings', 'paragraphs', 'captions'" — no per-type sizing
  existed, only the global multiplier; "tick on or off in present menu"
  — no row in the Present menu, only a corner button at opacity .35 that
  exists once you are already presenting; "goes without animations" —
  Skip builds left slide transitions playing; and the current text size
  lived in a HIDDEN span, so the visible label said 100% forever.
  *Done 2026-08-31.* Three per-type rows (Headings / Body text /
  Captions), each multiplying on top of the global size, bucketed by the
  box's named style (`isHeadingStyle`, `caption`/`capOf`, else body) with
  title-slide titles counting as headings; a `#pl-talk` "Talk settings…"
  row in the Present menu that presents with the panel open; the
  animations toggle now also gates `playFlip`, so transitions stop too
  (flip books still step — frames are content); and the reset button IS
  the readout. Driven live: headings +2 grew only the heading (125%),
  captions −1 shrank only the caption (89%), global × composed on top
  (112%), reset restored all four to 100%. The transition gate is
  code-pinned rather than driven — this pane reports
  prefers-reduced-motion, which already suppresses them here.

- [x] **T127 · S — A reload forgets which branch you are on.** [deck.js]
  *Audited (T90 revisit).* Branching itself verified live — the tree, the
  fork ("2 branches from here"), the "on experiment-1" chip. But
  `histHead`/`histBranch` are runtime-only: after a page reload nothing
  seeds them from the stored index, so the chip reverts to "on main" and
  the NEXT save writes a snapshot with no parent — a new root, quietly
  fracturing the tree the feature exists to keep. Persist head+branch
  beside the IndexedDB index and seed them in `openDeck`.
  *Done 2026-08-31.* A `{h, br}` pointer beside the index, written by
  every head-mover and carried by rename; `histSeed` reads it back
  through the history queue, validates against the index, and falls
  back to the tip for pre-pointer histories; the opening snapshot gates
  on the seed. Driven live: branch → full reload → "on reload-branch"
  with "you are here" on the right snapshot, pointer read raw from
  IndexedDB. Two false alarms during the drive both dissolved on
  inspection — the "missing" saves were unchanged content the dedupe
  was RIGHT to refuse.

- [x] **T128 · S — Paste: prose should land, and code needs an escape
  hatch on the canvas.** [deck.js] *Audited (T92 revisit): code paste
  verified live (mono + 27 highlight spans); prose paste created
  NOTHING.* Make plain text paste onto the canvas a normal text box
  (code detection stays for code); make canvas Ctrl+Shift+V paste as
  plain text when the internal buffer is empty, so a wrong code
  detection has the same one-key out the in-box path already has.
  Python-only highlighting is accepted and recorded, not fixed.
  *Done 2026-08-31.* Driven live: a pasted sentence became a plain box,
  pasted code a monospace one with the new toast, and Ctrl+Shift+V with
  nothing copied pasted the same code plain — three boxes, mono only in
  the middle.

- [x] **T129 · S — Three doors the audit found missing.** [deck.js]
  (a) Match objects has no canvas right-click row — the menu that
  already knows what you clicked never offers the one feature named
  "match objects"; (b) placing a component instance is right-click-only
  WITH a selection — an empty canvas has no component door at all;
  (c) the Apply dialog handles shapes/figures in its own code but is
  reachable only from the TEXT Styles menu. All three are menu rows on
  surfaces that exist; none costs ribbon width.
  *Done 2026-08-31.* Driven live: the match verbs armed with the
  matchbar up, the Apply dialog opened reading "Apply to 1 shape", and
  an empty-canvas right-click placed a component.

- [x] **T130 · M — The design surface, closer to the described view.**
  [deck.js] *Audited (T87 revisit): full-screen, drag-default-position,
  apply-to-all, outlines toggle all real.* Missing vs the ask: the put
  gesture is all-wearers-only (no section/range scope); outline cells
  name only "Slide N" on the whole cell (never the title, never per
  object); outlines cannot be filtered to certain slides; and objects in
  the miniatures cannot be moved from there ("or you can just move it
  from here as well").
  *Done 2026-08-31.* Driven live: a section-scoped put moved slides 2–3
  and left slide 1 alone; hover tooltips named the slides; outlines-on
  grew a proxy per object; a +20%/+10% drag of a miniature proxy moved
  the model to exactly (25,15); the sheet filtered to §Methods showed
  cells 2 and 3 only.

- [x] **T131 · M — Layout ideas: options for the objects you have.**
  [deck.js] *Audited: the defining gesture of "a slide designer" is
  absent* — nowhere does the app compute several candidate layouts of
  THIS slide's objects and show them to pick from; choice today is three
  spacing presets applied blind, and Home's "Layouts ▾" silently hides
  the auto-arrange and custom-arrangement rows that Design's same-named
  menu carries. Build the preview chooser (tidy presets + best-fitting
  templates + best-fitting saved arrangements, drawn with miniDiagram,
  click to apply); give Home's menu parity with Design's.
  *Done 2026-08-31* — with one scope cut, said out loud: built-in
  TEMPLATES are not previewed (simulating the pane machinery would be a
  second implementation of it); they stay one row below in the same
  menu. Driven live: the tidy previews differed from the untouched live
  slide and clicking Tight applied exactly what was previewed; a saved
  arrangement appeared as "MyArr · 100%" and re-laid a scattered slide;
  Esc and click-away closed it; Home's menu carries the full set.

- [ ] **T125 · design first — What a notebook has that a source does
  not, on purpose.** The other half of "notebooks to be a whole thing in
  itself": code trails, the dependency graph, variables, git history,
  note insertion and figure locks are all things a `.tex` has no
  equivalent for. Write that boundary down once, in help and in
  ARCHITECTURE.md, so "notebook-first" is a stated design rather than an
  accident of which features got written first.

### Carried forward from group 13, re-ordered by the same decision

The user chose **notebook-first, deepened** (2026-08-31), so of the nine
design-first items left in group 13:

- **T117** (native data-bound charts) and **T106** (authorable reading
  order) are the ones this direction wants next. T117 is the "and more":
  a deck object bound to a notebook anchor, editable here, exporting as
  a real PowerPoint chart with its provenance intact — and T105 means
  the semantic fields to hang it on now exist.
- **T113** (Excel/workbook), **T114** (`.pptx` import) and **T115**
  (masters) stay open but move behind those. Note that T113's real
  blocker is a **bytes seam**: every producer takes text today, and
  `loader.py`, `web_parse` and the web loader all assume `read_text`.
  Nothing about a workbook can start before that, and that seam is worth
  opening on its own terms because it is also what `.pptx` import needs.
- **T110**, **T116**, **T119** and **T120** stay open and unranked.

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
