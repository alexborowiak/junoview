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

- [x] **T106 · design first — An authorable reading order.**
  `orderedIdx()` is a top/left visual heuristic, and six callers inherit
  it — builds, review, matching. Overriding it means a durable key on
  `oid`, a resolver the six share, and a decision about whether
  `renderAnnots`' DOM order follows it (today it walks storage order).
  Design it before adding more object kinds; retrofitting semantics after
  charts and media multiplies the migration.
  *Done 2026-08-31.* The design, decided and recorded: `sl.rord` — a
  list of oids, first-to-last — overlays the sweep INSIDE `orderedIdx`,
  so all six consumers follow an authored order without knowing it
  exists; objects the list does not name (added later, unhidden since)
  read LAST in sweep order — predictable, and the panel shows the truth
  on open; and DOM order stays STORAGE order on purpose, because the
  annots array is z-order and reading order must not reshuffle what
  overlaps what. The Reading order panel (right-click → slide, or the
  Timeline pane) lists the slide in order with ↑/↓ per row, numbers
  every object on the slide while open (badges CSS-gated exactly like
  the T76 build bubbles — cyan, top-right, so amber build numbers stay
  readable beside them), and offers "Back to automatic". The key rides
  normPres, `as_presentations`, `SLIDE_KEYS` and DECK-FORMAT.md — the
  parity test extracts it from normPres automatically. Driven live:
  Charlie (bottom box) moved to read first, badges renumbered, "One by
  one" dealt builds Charlie=0/Alpha=1/Bravo=2, a later-added top-most
  box read last, reset restored the sweep, Esc hid the badges without a
  re-render, and a full page reload brought the authored order back.

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

- [x] **T110 · design first — Equations, builds, masters and links.**
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
  *Done 2026-08-31 — two shipped, two recorded.* The diagnosis aged:
  T118 built `a.link`, which made the links quarter exactly the small
  writer job predicted, and the builds quarter turned out to need no
  shape-id plumbing — `build()` records the id of whatever each item
  emitted and writes a real `<p:timing>` main sequence (one click per
  build step, same-step objects together; appear exact, everything else
  an honest fade, rise/zoom counted in the export dialog). Links leave
  as `hlinkClick` rels — External for URLs, `hlinksldjump` to the
  mapped output page for slide jumps (flip explosion respected).
  Verified in POWERPOINT ITSELF over COM automation: the probe deck
  opened with no repair prompt, MainSequence read back fade-on-click,
  appear-with-previous and the second click, the two actions resolved
  to the URL and slide 2 — and both T117 charts read back as real
  charts (xlColumnClustered ×2 series, xlXYScatter). help.html's export
  list was rewritten to today's truth while there (tables travel since
  T109; notes since T108). Still recorded, not built, each for its
  stated reason: EQUATIONS need a second LaTeX front end (texPlain has
  no parse tree to make OMML from) — out of scope until someone asks
  for it by name; MASTERS are T115's design question and stay with it.

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

- [x] **T113 · design first — Is Excel in scope at all?** `SOURCES` has
  no `.xlsx` and `tests/test_sources.py:225-232` asserts so deliberately;
  the code calls CSV "the Excel half", which a static 500-row preview of
  one delimited table is not. Adding `openpyxl` breaks two load-bearing
  promises (stdlib-only, Pyodide parity), so the choice is between an
  optional local-only extra, a stdlib `zipfile`+XML reader, a separate
  `workbook/` subsystem, or saying plainly that CSV is a document source.
  **A bytes seam has to be opened first** — every producer today takes
  text, and `loader.py`, `web_parse` and the web loader all assume
  `read_text`. Nothing about a workbook can start before that.
  *Decided and done 2026-08-31.* The user's call: in scope, VALUES ONLY
  ("don't need no fancy filters or anything"), read by the stdlib so
  both load-bearing promises hold. The bytes seam opened first, as this
  entry demanded: `doc_from_bytes` is the one door (binary suffixes go
  to their producer whole; text kinds get the utf-8 decode + newline
  normalisation `read_text` used to do implicitly), and every opener
  routes through it — `load_doc` reads bytes for every file, git-show
  is `_git_show_bytes` with text as a decode on top, `/api/parse` grew
  a `b64` field, the drop handlers read a `BIN_RE` match as an
  ArrayBuffer in both modes, and the Pyodide bridge grew `parseB64`.
  `parse_workbook` itself is ~120 lines of stdlib zipfile+ElementTree:
  shared strings (rich runs joined), inline strings, booleans, gapped
  cells, one table card per worksheet (chartsheets skipped), the same
  500-row honesty cap as CSV. NOT read, on purpose: formulas (the
  cached value shows), number formats (a date cell shows its serial),
  styles, merges, drawings. Because a sheet is a table CARD, everything
  a card has came free — T124's kind chip ("Workbook"), T117's "Turn
  into a chart", T123's refresh. Driven live end-to-end: book.xlsx in
  the file browser under its kind, opened as a table, a chart born from
  the sheet, then the workbook REWRITTEN ON DISK (Jan/Feb/Mar → Q1/Q2)
  and one File-menu click re-read both the tab and the chart —
  [[500,400],[1,2]], colours kept. That is the original ask verbatim:
  "figures can be linked from these types of files as well that can
  then be refreshed".

- [x] **T114 · design first — PowerPoint import.** The export vocabulary
  is an if/else chain ending in `skipped++`, and the only importer takes
  junoview JSON or polyglot HTML. A `.pptx` is a ZIP of related parts, so
  it needs its own boundary rather than growing `notebook/sources.py` —
  and it wants to become a *deck*, while every `SOURCES` producer returns
  a `Document`. That mismatch is the design question. `pptx.js` can
  decompress with the platform's `DecompressionStream`, so the JS route
  is cheaper than the reviews assumed. Never claim a round trip without a
  loss report; macro formats read-only.
  *Decided 2026-08-31: not now — but COME BACK for the full import.*
  The user's words: "make a note to come back for this for the full
  import at a later date." Export-side fidelity kept rising all day
  (charts, builds, links, notes, tables), which raises what a good
  import can preserve. When it is picked up: the T113 bytes seam is
  half the plumbing, `DecompressionStream` the other, and the loss
  report on open is non-negotiable.

- [x] **T115 · design first — Masters and inherited layouts.** `lay` is
  documented as "the id of the template last applied; annotations hold
  its actual geometry" — applying a layout stamps coordinates, and the
  exporter writes exactly one blank layout and one empty master.
  Real inheritance needs template identity, placeholder identity,
  per-slide overrides and a migration for flattened decks. **Do not
  rebuild what components already are:** `cmpPlaceOne`, the `cmp`/`ci`/
  `cinst` triple, `cmpInstances` and the Detach escape all ship, and
  reusable content is not the same thing as placeholder inheritance —
  say which is which before writing either.
  *Done 2026-08-31, with the which-is-which said first.* A COMPONENT is
  reusable content with instance identity (cmp/ci/cinst, push, detach —
  all shipped); a MASTER is slide-level INHERITANCE:
  `pres.masters[id] = {name, bg, cmp, pos}` worn by `sl.mast`. The
  master's furniture simply IS a component, so "restyle every wearer"
  is the component verbs that already exist — nothing was rebuilt.
  Resolution is at RENDER time, never stamped: the furniture draws into
  an inert `.slide-mast` layer behind the content on every paint
  (view-mode render, pointer-events none), and the background resolves
  slide > master > deck — so there are no copies to migrate and a deck
  without `mast` renders exactly as before, which answers the entry's
  migration demand with "none needed". Doors: Masters… in both Layouts
  menus (the T131 parity rule) and the slide right-click, which names
  what the slide wears; the panel creates, sets background/furniture/
  corner, and wears onto this slide / the section / the whole deck.
  Both normalisers, both schema tables, DECK-FORMAT and the parity
  sentinels carry the keys. Export BAKES the look (furniture items
  under the content, inherited bg) — real per-master slideLayout parts
  are the recorded cut: the pixels travel, the linkage does not.
  Thumbnails skip furniture (miniDiagram is a sketch; also recorded).
  Driven live: "Branded" (#123a2b + a two-object "Logo strap" at
  bottom-right) worn by the whole deck from the panel; slide 2
  inherited page and strap; slide 3's own bg beat the master's while
  keeping the strap; recolouring the slide-1 instance and "Push this
  look" turned slide 2's furniture pink on its next paint — LIVE
  inheritance, the point; and a reload brought it all back.

- [x] **T116 · design first — A media annotation kind.** The kinds are
  exhaustively text, cell, rect, image, arrow, draw, table, flip. A
  notebook's stored `<video>` output does display, which is the
  confusing part — but there is no media item, no Insert door
  (`accept="image/*"` in two places), no captions and no export path.
  Storage first: images already had to move originals to IndexedDB when
  localStorage quota blew, and recordings are far larger.
  *Decided 2026-08-31: not yet.* The user's call, offered with the
  honest warning that self-contained decks + video collide with the
  size constraints that shaped the embed store. To be designed when a
  clip is actually wanted in a talk, not before.

- [x] **T117 · design first — Native data-bound charts.** No chart,
  diagram, editable path or 3D object exists; a figure exports as a
  picture, so nobody can recolour a series in PowerPoint. The
  notebook-first answer is not to clone the chart dialog: it is a durable
  binding from a deck object to a notebook anchor plus a small
  declarative chart schema that keeps provenance. That is the genuine
  "and more". `20-notes-and-tables.js:771` already draws cloned Plotly
  JSON specs in cell frames and is the seam a native chart would reuse.
  *Done 2026-08-31*, as designed above: `{k:'chart', ct, cats,
  series:[{name,ys,color}], ref?}` — a new deck part (`47-charts.js`)
  draws it as plain SVG (bar/line/scatter/pie, legend, axes, no Plotly,
  works from file://); "Turn into a chart" on a placed table or a frame
  showing a table card (first row names the series, first column is the
  category; born from a card it keeps `ref`); "Insert a chart" on the
  empty canvas; right-click type rows, Edit data… (CSV dialog; editing
  unlinks `ref` — the numbers are yours then) and a legend toggle. The
  binding is real: `provRef` answers for charts, so "Update figures
  from their sources" reloads the source tab from DISK and re-reads the
  numbers while type, colours, position and size stay (counted before
  the early return, or a chart-only deck was told everything matched).
  Export is the point: pptx.js writes a real `<c:chart>` part per chart
  — clustered bars, marker lines, numeric-x scatter (two `c:valAx`),
  pie — values cached in the part, deck ink on the chart text, and
  `test_pptx_bytes.py` proves the parts against PowerPoint's own
  structural rules (content-type coverage, resolving rels, CRCs).
  Driven live end-to-end: `data.csv` edited on disk behind the app, one
  File-menu click, and a chart-ONLY deck re-read it — [81,62,44] became
  [7,8] with a new category, colours untouched.
  Cuts said out loud: per-series recolouring happens in PowerPoint
  after export (the stable palette keeps re-exports consistent); no
  embedded workbook part (only PowerPoint's "Edit Data" sheet needs it
  — rendering and restyling do not); no stacking, 3D or secondary axes;
  a table ANNOT's chart is a copy, not a link (only cards refresh).

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

- [x] **T119 · design first — Hosted accounts, collaboration, live
  audience.** Explicitly cut in this file and described as future work in
  `help.html`. Recorded here as one entry because they are one
  dependency: identity. Nothing — comments, presence, share links, polls,
  captions, cloud recording — can be built before a hosted service is
  designed with auth, tenancy, retention and a security review. The local
  app must stay localhost-only and token-guarded. Do not grow this out of
  the file server one public route at a time.
  *Decided 2026-08-31: parked.* Infrastructure, not a feature — a
  different kind of project than everything in this file. The paragraph
  above stands as the design constraint if it is ever taken up.

- [x] **T120 · design first — An extension model.** A new source format
  means editing the Python registry and its synchronised UI gates; a new
  object kind means edits through the whole assembled IIFE, schema,
  normaliser, clipboard, history and exporters. `SOURCES` is the closest
  thing to a real plugin point and could take an entry-points bridge;
  `DECK_PARTS` cannot, because the no-build-step/`file://` constraint is
  deliberate. `deck_api.py` is the honest automation seam and should stay
  a lossless view over JSON rather than exposing IIFE internals.
  *Decided 2026-08-31: parked, and worth coming back to.* The user's
  words: "that is cool to come back to." When it is: `SOURCES` +
  entry-points for source producers is the honest first plugin point
  (T113's `doc_from_bytes` made its contract byte-clean), `deck_api.py`
  the automation seam; `DECK_PARTS` stays closed on purpose.

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

- [x] **T124 · S — The rail should say what kind of thing each tab is.**
  A `.tex` and a `.ipynb` now sit side by side with nothing
  distinguishing them, and the doors that are notebook-only (Insert
  note, Versions from git) are still offered on both — T100 kept those
  routes strict on the server, so they refuse correctly, but refusing is
  not the same as not offering. `source_label()` already names the kind
  and `_list_dir` already returns it.
  *Done 2026-08-31.* The kind rides on the Document (set in
  `doc_from_text`, the one dispatch); non-notebook shells wear
  `data-srckind` (`data-kind` was taken — it is the CARD kind), lead
  their rail meta line with the kind, and get a kind chip in the
  open-files list, whose heading follows its contents. The notebook is
  the unmarked default, so every notebook page stays byte-identical.
  Insert note is offered only where a note CELL can land (`.ipynb`);
  and the one genuinely notebook-only Versions door was WIDENED rather
  than hidden — `git show` hands back text and `doc_from_text`
  dispatches on the name, so a `.tex`'s commits now open exactly the
  way a notebook's do (a real tmp-git-repo test pins it). Driven live:
  heading "open files", LaTeX chip + tooltip on the `.tex` row, meta
  "LaTeX · 0 figures · …", 0 pencils on the tex and 2 on the notebook,
  and the heading reverting to "open notebooks" once the tex closed.

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

- [x] **T125 · design first — What a notebook has that a source does
  not, on purpose.** The other half of "notebooks to be a whole thing in
  itself": code trails, the dependency graph, variables, git history,
  note insertion and figure locks are all things a `.tex` has no
  equivalent for. Write that boundary down once, in help and in
  ARCHITECTURE.md, so "notebook-first" is a stated design rather than an
  accident of which features got written first.
  *Done 2026-08-31.* One correction to the diagnosis before writing it
  down: git history is NOT notebook-only any more — T124 widened commit
  opening to every source, and snapshots were suffix-keyed since T100 —
  so the boundary is exactly the features that read CELLS (Plot trace,
  dependency graph, variables, note insertion, figure locks' version
  cards). help.html's Open section now names what else opens and what
  stays notebook-only; ARCHITECTURE.md gained "Notebook-first, on
  purpose" with the rule for new features: Document-consumers must work
  for every producer (door-parity tests), cell-readers gate at the door.

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

## 15 · The interaction review (2026-08-31, from reviews/23-07)

A second external review, this time of INTERACTION rather than features:
how the shipped capability is exposed. Its four claimed mechanical
defects were all REPRODUCED here before filing (the repo rule: a
finding is a claim until somebody drives it): duplicate `deck-status`/
`qat-auto` ids (static count 2 each); File+Present and
Background+Layouts menus open simultaneously with Present's trigger
stuck `aria-expanded=true` after close; Tidy+Check panes stacked and
Standardise's hide-list omitting `#tidypane`; and the object context
menu at 31 buttons / 13 headings in a 215px THREE-COLUMN grid with
both scrollbars (`.sh-menu` is `display:grid` 3-col and `.canvas-menu`
never overrides it — and T106/T115/T117 each added rows to it).
The review's bottom line, accepted: not fewer capabilities — fewer
competing ways to reach them.

### Phase 0 — repair the interaction substrate

- [x] **T134 · S — One save readout, and no duplicate ids anywhere.**
  deck.html emits `deck-status` and `qat-auto` twice: T70 (2026-08-29)
  added the improved pair beside Save and left the 2026-08-20 pair
  standing further down. `$()` is querySelector, so the old pair is
  dead markup that still fools any DOM count. Delete the old pair; add
  an assembled-HTML unique-id test over EVERY template (deck, page,
  shell) — no special-casing these two ids.
  *Done 2026-08-31.* The 2026-08-20 pair deleted (a comment stands in
  its place naming the incident); the unique-id test covers deck, page,
  shell, help and web-loader with no allow-list, and confirmed the
  other four templates were already clean.

- [x] **T135 · M — One owner for every transient menu.** File, Present,
  Background, Layouts, Page, Thumbnails and the autosave menu each
  carry their own open/close pair; each knows only the siblings its
  author remembered, which is why any two independently-wired menus
  can stack. One registry: opening any registered menu closes the one
  before it, keeps `aria-expanded` true exactly while its menu shows,
  and closes on outside click and Escape.
  *Done 2026-08-31.* `overlayShow`/`overlayHide`/`overlayClose` beside
  `wireMenuToggle` (which now just registers), with the one outside
  click + Escape closer installed by `overlayBoot` from THE BOOT
  SEQUENCE per the T133 rule. Migrated: File, Present, Design Layouts,
  Home Layouts, Background, Page, Thumbnails, the shapes gallery, the
  text-style caret, autosave, save-target, the View overflow and the
  notebook-list More menu — every per-menu document closer deleted.
  Driven live on the exact JVUX-02 sequences: File→Present shows only
  Present with File's aria false; the outside click resets Present's
  aria (the stale-true bug); Background→Layouts shows only Layouts;
  Escape closes with aria false. Focus-return on Escape is best-effort
  (it targets the trigger; one drive saw focus rest elsewhere — noted,
  not chased). The canvas context menu keeps its own
  close-on-any-click, which already cannot stack with these.

- [x] **T136 · M — One owner for the inspector panes.** The
  "one pane open at a time" comment is aspiration: showTidyPane hides
  five named siblings, Standardise hides a DIFFERENT five and omits
  tidypane, Check hides none. The hand-lists have already diverged
  twice. One controller owns the single open `.selpane`, its trigger's
  pressed state, and closing on slide/mode change; no feature
  enumerates sibling selectors again.
  *Done 2026-08-31.* `paneShow`/`paneHide` over `PANE_IDS` (all eleven
  panes) with `PANE_BTN` re-deriving every registered trigger's
  aria-pressed from the DOM; the eleven show/close sites — Objects
  (which hid NOTHING before), Animations, Versions, Notes, Check,
  Standardise, Tidy, Flip, Provenance, Size and Object history — all
  route through it, and every hand-list is gone. Driven live on the
  exact JVUX-03 sequence: Tidy→Check→Standardise→Animations→Objects
  showed exactly ONE pane at every step, aria flipping correctly.

- [x] **T137 · M — The context menu must be readable.** A single
  readable column (the 3-column `.sh-menu` grid is for icon galleries,
  not word rows), no horizontal scrolling, immediate actions first,
  and the long tail of sections behind one "More…" level rather than
  13 headings deep. The advanced rows keep working — this phase is
  geometry and grouping, not the Phase-2 inspector move.
  *Done 2026-08-31.* One 308px column (`.canvas-menu` finally overrides
  the icon-gallery grid), `cmFold` moves every section past the
  everyday ones (this object, link, alt, figure, chart, paste) behind
  one counted "More — N options" row — the text-object menu went from
  31 visible buttons to 7 — with `role=menu`/`menuitem` and Escape on
  every `floatAt` popup. Driven live: no horizontal overflow before or
  after expanding More, a folded row (Reading order…) still opened its
  panel, the empty-canvas menu never folds, Escape closes. The first
  screenshot caught `.cm-more{display:block}` beating the `hidden`
  attribute — fixed with an explicit `[hidden]{display:none}` and the
  incident written into the CSS, because a DOM probe reported the
  attribute as set while the pixels showed the fold open.

- [x] **T138 · S — Pin what Phase 0 fixed.** The unique-id test
  (T134); pins that every registered menu/pane goes through the one
  controller; and the live-drive evidence recorded in docstrings. The
  review's full browser-test list (screenshots, keyboard paths) needs
  a browser in CI this repo does not have — recorded as the honest
  gap, not silently skipped.
  *Done 2026-08-31.* `test_interaction_substrate.py`: the overlay owner
  boots exactly once from THE BOOT SEQUENCE; every migrated menu calls
  it by name and the old per-menu closers stay dead; PANE_IDS is
  diffed against the actual `.selpane` ids in deck.html so a new pane
  cannot dodge the owner; every show site uses `paneShow`; the fold
  and its `[hidden]` fix are pinned; and the drive evidence plus the
  no-browser-CI gap are in the module docstring. The unique-id test
  landed with T134.

### Phase 1+ — one vocabulary, one default (filed, scoped, partly user calls)

- [x] **T139 · design first + USER — 109 ribbon layouts → three.**
  The catalogue is 17% of deck-editor JS (6,502 lines) and each layout
  can re-home controls AND change where selection lands, so no two
  users share an interface. The review wants Standard / Simple /
  Compact plus at most one custom. This deletes a shipped feature —
  the user must call it before any code.
  *Decided and done 2026-09-01.* The user's call: "Standard, simple,
  compact, and a few others you think might work. Maybe like 9 of the
  best?" Kept: Default, plus Office ribbon (the PowerPoint-trained
  hands), Deck-slide-object (the scope taxonomy), Sources tab (the
  notebook-first workflow), Everyday first (frequency), Poster first,
  Canvas rail (the board-tool feel), Everything in one row (density ≈
  compact) and Ten things then More (simplicity ≈ simple). The other
  100 — ten sub-variants each of five bases and two dozen product
  imitations — deleted (~5,500 lines, the file is 1,022 now, down from
  6,502); they are one `git log -p` away and the cut essay in the file
  warns against re-growing the pile. A stored id from the old hundred
  lands on Default with a one-time notice that WAITS for the deck to
  be on screen (the first version toasted into a hidden editor —
  caught live); the chooser sits beside the tabs but outside the
  tablist ROLE now (display:contents wrapper), so it stops reading as
  a fifth tab to assistive tech. The three pile-philosophy tests were
  rewritten to pin the nine and the decision.

- [x] **T140 · M — The label glossary.** One stable name per action,
  spelled without a tooltip: Timeline→Animations, Clear slide→Remove
  all animations, Keep shape→Lock aspect ratio, Front/Back→Bring to
  front/Send to back, Maths→Equation, QR→QR code, Flip book→Image
  sequence (decide), Design-inside-Design→Style system,
  Standardise→Find inconsistent styles, Check for drift→Find style
  drift. Plus the four found lies: Background's stale "lives under
  File" tooltip, "Put all 0 of them there" as a primary button,
  the style preview drawn on chrome instead of the slide background,
  and the empty-notebook state that names an action with no door.
  *Done 2026-09-01.* Renamed: Timeline→Animations, Clear slide→Remove
  animations, Maths→Equation, QR→QR code, Front/Back→Bring to
  front/Send to back, Keep shape→Lock ratio, the Design tab's inner
  Design→Style system, and the pane heading How it appears→Entrance
  effect. Fixed lies: the Background tooltip no longer points at a
  File item removed a week ago; "Put all 0 of them there" became a
  plain "No boxes wear this style <scope>" non-primary disabled state;
  the style preview sits on var(--page-bg) so a dark style meant for a
  light slide reads in its own preview; the Output tooltip now names
  all three states (behaviour untouched per the T145 decision); the
  empty-notebook door landed with T144. KEPT deliberately, with
  reasons: Flip book (established product vocabulary through help and
  tests), Object (the 2026-08-25 decision recorded in the markup —
  a frame is a hole, not notebook content), Markdown, One by one/All
  at once (scope lives in their titles), Build order (clearer to this
  audience than "Advance sequence"), and Standardise/Tidy/Check names
  — those move once, under T142's Review centre, not twice.

- [x] **T141 · S — Selection must not steal an open workflow.**
  Following the Timeline pane's own instruction ("Select an item
  first") switches the ribbon to Object, moving the user away from the
  controls they just opened. With a pane open, selection should reveal
  the contextual tab without activating it.
  *Done 2026-09-01.* One gate at the decided-here-done-at-the-end site:
  with ANY inspector pane open, `wantTab` stays empty — the contextual
  groups still reveal (showFmt), the tab stays yours. Driven live both
  ways: Timeline open on Insert + select → tab Insert, pane open and
  showing the effect chooser; no pane + select → tab switches to
  Object exactly as before. (The drive also re-taught two old lessons:
  a hidden browser pane's 0×0 rects make blind clicks land on chrome —
  one closed the deck — and a fresh origin re-runs the welcome tour
  over everything.)

- [x] **T142 · design first — One Review centre.** Check (print),
  Tidy (layout), Standardise (styles), Check for drift (styles again)
  and Export for review are five doors to "is this ready?". Map the
  existing engines under one worded Review surface with severity,
  scope and navigation — reuse, do not rewrite.
  *Done 2026-09-01*, as a FRONT, exactly to the reuse rule: the Home
  ribbon's Check became **Review** and opens the centre — "Is this
  ready?" — where the five existing engines run DRY for their counts
  (preflight, tidyFindings, standardise+figLint, reviewLints,
  staleFigures), each row saying its scope (this slide / whole deck)
  and carrying one worded button that opens the existing full surface.
  Nothing was rewritten; the detail views keep every fix they have
  earned, and T136's pane owner is what makes the five surfaces
  finally un-stackable. Driven live: "5 to look at, across five
  checks" (Print 2, Layout 2, Style 1, Content clear, Sources clear),
  and each button opened exactly its one surface. Per-finding
  Fix/Ignore/Suppress inside ONE list — the review's fuller vision —
  would mean rewriting the five renderers into one; recorded as the
  deliberate cut, revisit if the front proves insufficient.

- [x] **T143 · M — File owns files.** The 19-row File menu mixes file
  ops, source sync, page design, exports, settings and two destructive
  rows with no section names. Split ownership (File / Sources /
  Export / Design / Settings / Manage) and make the top bar's save
  area one component — Save, "Saved to project · just now ▾", autosave
  as a setting inside that menu rather than a second cyan button.
  *Done 2026-09-01.* The nineteen rows now sit under five NAMED
  headings — file / sources / export & share / page / careful — these
  lose work — with the destructive pair LAST and in warn colour
  (driven live: heads in order, warn rgb(255,107,87), menu fits). The
  autosave button keeps its countdown but stopped painting itself
  accent-primary, so Save is the one primary action on the bar. Kept
  deliberately: the slide-numbers and crop-marks rows (page setup IS
  part of getting a file out; Design's furniture group carries the
  other Numbers door), and the separate Save/target/status controls —
  collapsing them into one readout component is real save-machinery
  surgery that this menu cleanup does not require.

- [x] **T144 · S — First-class doors for Chart and Master.** T117's
  chart inserts only from a right-click; T115's master hides in two
  Layouts menus. Insert gets a worded Chart button; Design gets
  "Master: <name> ▾" naming the current master with the panel behind
  it; the no-notebook empty column gets its worded Open notebooks
  button.
  *Done 2026-09-01*, scoped to static labels so ribbon width stays
  stable: Insert gains a worded Chart button (places the sample chart,
  Ctrl+Z removes it — driven), Design's furniture group gains Masters
  (opens the panel, which names what the current slide wears), and the
  empty notebook column now offers "Open notebooks…" instead of naming
  an action with no door. The review's dynamic "Master: <name> ▾"
  label is deferred on purpose — a label that changes width fights
  fitRibbon.

- [x] **T145 · design first + USER — Filter cyclers → labelled menus.**
  Plots/Markdown/Code/Output cycle three states invisibly (the Output
  tooltip still describes two). The review wants explicit menus
  (Show / Collapse / Hide / Types…) and a Document|Raw|Tree segmented
  mode. This redesigns a confirmed behaviour — the user calls it.
  *Decided 2026-09-01: leave as is.* The user's call — the one-click
  cycle stays. The lying Output tooltip was still fixed under T140 (it
  described two states of a three-state control), because a tooltip
  may simplify but must not disagree with the behaviour.

- [x] **T146 · M — Words plus icons, in the rendered UI.** The
  project's own twice-confirmed invariant, audited: theme/help/support
  buttons, the presentations-panel collapse pair, the advanced filter
  doors, and the slide-strip row actions are icon-only today, with the
  icon-contract test explicitly allow-listing them. Fix the surfaces
  (worded menus where width is tight) and shrink the allow-list.
  *Done 2026-09-01*, scoped to the app-chrome offenders: Theme, Support
  and Help worded in the document toolbar (the deck worded its own on
  2026-08-23 and the document toolbar was left behind), the panel-foot
  pair worded AND given distinct icons (both wore the same glyph), and
  the deck's Ko-fi link worded beside its already-worded Help. Driven
  at 1280: single toolbar row, panel foot fits. KEPT icon-only with
  the reasoning recorded: the repeated per-row micro-actions (tab
  closers, strip row arrows, layer-row buttons) — a word on every row
  of a list is noise, they carry aria-labels, and the icon-contract
  test's audited inventory continues to police them.


## 16 · The four live bugs (2026-09-01, from the review status pass)

Marking the five review reports off (2026-09-01) sorted 82 findings into
done / partly done / deferred / declined / open. Most of the open pile is
depth — animation timing, accessibility checking, Office parity — but
four entries were plain defects, each still reproducible in current
source and each scouted before a line was written. They share a shape
worth naming: every one of them is the CODE SAYING SOMETHING THAT IS NOT
TRUE. A refresh that failed reports success; a sheet called "Every
object" cannot move one kind; a range the user typed is stored as
something else; a page described as self-contained phones a third party.
None of them throws, which is why they survived a 947-test suite.

- [x] **T147 · S — A failed source read is never reported as up to
  date.** `APP.reloadTab` erases every `/api/open` rejection into the
  same `false` it returns for a deliberately-declined URL tab, and
  `resyncAllFigures` counts truthiness — so a run in which every disk
  read threw compares the saved snapshots against the same cached cards
  they were taken from, finds nothing stale, and toasts "Every figure on
  this deck already matches its source". Provenance is the whole
  feature; a false "matches its source" is worse than a visible failure,
  because the user stops looking. (JVR-01, and again as half of JVC-11.)

  *Done 2026-09-01.* `APP.reloadTab` now resolves `{stem,ok,reason,msg}`:
  `reread` is the only success, `failed` the only outcome a user must be
  told about, and `notapp` (web mode has no handle to re-read), `closed`
  and `url` are honest declines that stay silent exactly as before. The
  deck counts reasons rather than truthiness, and one builder —
  `resyncMsg` — writes the toast for all four outcomes, putting the
  failure clause FIRST and NAMING the sources, because "6 figures
  updated" beside a source that was never read is precisely the sentence
  that misleads. With anything failed, "every figure matches its source"
  narrows to "the sources that could be read", and with nothing read at
  all it becomes "Nothing was checked against disk"; a failure toast
  lasts 7000ms instead of the default. The test pins the ordering inside
  `resyncMsg`, so the unqualified claim cannot be reached with a failure
  in hand. NOT done, and each worth its own entry: the provenance pane
  still has no sixth state for "this figure's source could not be
  re-read" (its five are all live-vs-saved claims, and `nolive` actively
  misreads a failed refresh as "That notebook is not open"), and a deck
  whose sources are all CLOSED still gets the clean toast — the same
  over-claim, a different cause.

- [x] **T148 · S — "Every object" can move every object.** The design
  surface's outlined sheet skips `a.k==='arrow'` before building a drag
  proxy, so arrows are the one kind the sheet named after totality
  cannot move. Either give an arrow a proxy that translates both
  endpoints — reusing the canvas's own write-back, not a second one — or
  stop calling the sheet what it is not. (JVR-03.)

  *Done 2026-09-01*, by giving arrows a handle rather than renaming the
  sheet. The write-back was never the problem: `shiftAnnot` already
  translates `x1/y1,x2/y2` and any dragged corners, exactly as a canvas
  drag does — only the box to grab was missing, because the proxy read
  `a.x/a.y/a.w/a.h` and an arrow has none of those (deck_schema calls it
  out: "two endpoints, not a box"). The handle is now the bounding box
  of the line the MINIATURE ALREADY DRAWS — `arrowEnds`, the same call
  the renderer makes, so a tied end puts the handle where the line
  really is rather than on a stale stored endpoint — floored to
  `DG_HIT=6`% so a horizontal or vertical line is not a zero-thickness
  target. `.dg-drag.is-arrow{z-index:2}` is load-bearing, not cosmetic:
  a line's box is large and mostly empty, so it must yield to the box
  proxies it crosses instead of swallowing their drags. The test now
  loops every kind in `ANNOT_KINDS` and fails if the sheet ever excludes
  one again. Deliberately unchanged: a fully-tied arrow still appears not
  to move (`arrowEnds` re-derives the drawn end from its target), which
  is exactly what the canvas does, and the sheet still honours no lock
  for any kind — worth its own entry, not an arrow-only inconsistency.

- [x] **T149 · S — A typed slide range cannot escape the deck.** The
  design surface's range parser clamps one endpoint each way and THEN
  swaps, so `999-1` on a twelve-slide deck stores 1–999. Selection
  survives it (the consumers re-check), so this is a lying label rather
  than a broken selection — the put button, its tooltip and the toast
  all then describe a range the deck does not have. (JVR-05.)

  *Done 2026-09-01.* One helper, `dgRange(a,b,total)`: sort the pair,
  then clamp BOTH ends into 1..total (an empty deck yields 1..1 rather
  than the degenerate 1..0). Brute-forced before and after over
  total=1..14 and every endpoint pair 0..24: the old code stored an
  out-of-range endpoint in 5,894 of 8,750 cases, the new one in none —
  and the SELECTED SLIDE SET is identical in all 8,750, which is the
  honest scope of this fix. `dgInScope` compares against real slide
  numbers, so nothing was ever wrongly selected; what was wrong is the
  only read-back a user gets — the put button's label, its tooltip and
  the toast, which cheerfully said "slides 1–999". Tested twice over:
  the substring pin, and — because `dgRange` is pure — a test that LIFTS
  the shipped function out of the assembled IIFE and RUNS it (new
  `helpers_js.lift_fn`/`run_fn`, skipping where there is no engine),
  which is the edge-case-not-substring test the review asked for. It
  still does not TELL the user their range was narrowed; quiet clamping
  is what `0-5` has always done, and saying so is a separate decision.

- [x] **T150 · S — "Self-contained" means it.** `core.css` imports IBM
  Plex from fonts.googleapis.com, so every rendered page — including the
  static export the README calls "shareable, self-contained", and every
  deck emailed to a colleague — fetches a font from a third party and
  degrades to an unstyled fallback offline. AGENTS.md states the
  no-external-assets invariant that this breaks. (JVR-06.)

  *Done 2026-09-01*, user's call between the three options: drop the
  webfont, keep the families. The `@import` is gone from core.css, the
  widget's `ensureFonts()` link injection with it, and the two font
  hosts leave sw.js's allow-list (they were allow-listed for runtime
  caching but never precached, so offline was always the bad case).
  'IBM Plex Sans/Mono/Serif' stay FIRST in each stack — anyone who has
  them installed still sees them, nobody waits on a font server — and
  the fallbacks widened in the same edit, because the mono stack was
  the worst offender: `ui-monospace` is ignored by Chrome on Windows
  and `Menlo` is macOS-only, so a Windows reader dropped all the way to
  Courier New for every label, chip, caption and code run on the page.
  The whole cost is +73 bytes of CSS. The test is an invariant over
  EVERY asset, not a pin on this one line, and it strips block comments
  first so that explaining the absence stays legal. Honest remainder,
  now said in the README instead of "self-contained" full stop: a
  notebook with LaTeX still fetches MathJax from a CDN, so the export
  went from two hosts plus a CDN to one CDN, and only a deck without
  equations is now literally one file.

- [x] **T151 · S — The tabs T139 deleted.** `rbnHome()` snapshots the
  strip's ELEMENT CHILDREN and `rbnRestoreHome()` removes `.rbn-tab`
  with a DESCENDANT query. T139 (2026-09-01) wrapped the four markup
  tabs in `<span class="rbn-tabset" role="tablist">` so the layouts
  chooser beside them stopped reading as a fifth tab — after which the
  snapshot held the span and not the buttons inside it, so restore
  deleted all four tabs and put back a set that no longer contained
  them. `applyRibbonLayout()` restores on EVERY apply including the one
  at boot, so the shipped deck editor came up with an empty tablist and
  no Home, Insert, Design or Object at all.
  *Done 2026-09-01.* The tabset is a real container now: `rbnHome`
  snapshots its children, `rbnRestoreHome` appends them back INSIDE it,
  and `rbnBuildTabs` builds a generated layout's tabs there too — which
  T139 had also missed, leaving `role="tablist"` wrapping nothing on
  every non-default layout, the very thing it set out to fix. Driven
  live on a fresh boot: four tabs, all inside the role; Office ribbon
  → Home/Insert/Design/Animate, still inside; back to Default →
  Home/Insert/Design/Object, no duplicate ids. THE LESSON, which is the
  reason this entry exists at all: every ribbon test passed the whole
  time, because the MARKUP was always correct — the damage was what the
  JS did to that markup at runtime, and no substring test of the
  rendered page can see that. It surfaced only because a live drive for
  T148 went looking for the Insert tab and there wasn't one.

- [x] **T152 · S — The strip's ceiling was its own current width.**
  `ribbonMinW()` measures the ribbon's floor with `bar.scrollWidth` —
  and scrollWidth is floored at the element's own client width, so a bar
  with slack reports its BOX, never its content. The floor came back as
  (deck width − strip width), so `fitFilmMax`'s `W - filmFloorW` handed
  back exactly the strip's CURRENT width: the drag could shrink the
  column and never widen it, at any window size, frozen against a limit
  it had produced itself. (User, 2026-09-01: "the drag to re-size
  doesn't work".)
  *Done 2026-09-01.* The bar is asked what it WANTS (`width:max-content`)
  instead of what it has; it is already stamped with the whole
  compaction ladder at that point, and both are put back. Measured on a
  1900px window: box 1685px, true need 890px — the ceiling was 200px
  where 867px was free. Driven live: `--film-max` 200px → 867px, a drag
  to 500px lands on 500px and back to 260px lands on 260px, the handle
  following. T80's guard still holds, which is the whole point of having
  a ceiling: at a 1105px deck, dragging to 1050 clamps to 508 and the
  ribbon keeps 597px against a 321px need, uncut, four tabs intact.

- [x] **T153 · S — A shared thumbnail row fits the column.**
  `.film-list .mini-diagram` was `width:100%` for EVERY row. True of the
  current row, whose `.film-label` turns column — but every other row is
  a horizontal line of number, thumbnail and title, where at `flex:none`
  the thumbnail took the whole width, squeezed the title to ZERO and the
  row's controls to zero, overflowed the row by the number's width, and
  `.film-list` (`overflow-y:auto`, so the x axis computes to `auto` as
  well) grew a horizontal scrollbar inside a vertical list. (User:
  "everything isn't fitting in there correctly".)
  *Done 2026-09-01.* The blanket rule splits: the stacked current row
  keeps `width:100%`, a shared row gets `flex:1 1 auto;min-width:0`, and
  the list is `overflow-x:hidden`, because a vertical list scrolling
  sideways is always a fitting bug and never a feature. Measured at a
  200px column before: row 171px, content 189px, title 0px; after: no
  row overflows, no sideways scroll, the title readable again. The two
  defects compounded — a column that could not grow past 200px made the
  oversized thumbnail permanent — which is why they were found together.

- [x] **T154 · M — Auto-hide for the slide column and the ribbon.**
  The document view's presentations panel has had auto-hide since T85
  (`#pr-auto`); the editor's two big chrome surfaces had only MANUAL
  hides — and the column's (`strip-off`) drops the thumbnails while
  keeping the column's width, so it gave the slide nothing back. (User,
  2026-09-01: "there is no autohide on this and the ribbon as well".)
  *Done 2026-09-01*, matching the exemplar rather than inventing a
  second pattern: opt-in, OFF by default, remembered per deck through
  the deck's own SCOPE-keyed `lsGet`/`lsSet`, revealed by reaching for
  the edge each left from, `aria-pressed` carrying the state, words plus
  icon. The column's toggle is the last row of the Thumbnails chooser
  (the column has no panel foot, and `.film-adds` is the row T153 just
  stopped clipping — a new row there would undo that); the ribbon's is a
  worded button beside the fold, authored in deck.html OUTSIDE
  `.rbn-tabset` and not wearing `.rbn-tab`, or T151's snapshot would
  treat it as a tab and delete it. Two collisions had to be solved for
  it to work at all. (1) The ribbon parks by TRANSFORM, never
  `display:none`: `fitEditRibbon` and `ribbonMinW` both bail on a
  zero-width bar, and `ribbonMinW` publishes `--film-max`, so a
  display-based hide would have re-published the ceiling on every park
  and peek and made the column lurch — driven, it holds at 508px
  throughout. (2) `initRailAuto`'s mousemove had NO deck guard, so with
  rail auto-hide on, the left edge inside the editor slid in the
  presentations rail that `deckIsolate` (T104) marks `inert` — a panel
  that appeared and could not be clicked, and the same edge the column
  now needs. The rail stands down while the deck is open; that
  pre-existing defect is fixed here because this feature exposed it.
  Driven live: column parks at x=-200 and the stage gains all 200px,
  peeks back at the left edge, re-parks on leaving; the ribbon rolls up
  behind the tab strip (bar y -43) and peeks over the canvas without
  shoving it; both survive a reload; with rail auto-hide also on, the
  left edge gives the column and not the inert rail.

- [x] **T155 · S — The handle you can see, reach, and click past.**
  Three defects at the same site as T152, found by the parallel audit of
  it. (a) `.film-resize` is `position:fixed;top:0;bottom:0` — glued to
  the column edge while `.deck-create` scrolls, but also a SIX-PIXEL
  DEAD STRIPE straight up through the save readout and the tab row,
  which moved with every drag. (b) It had no paint at rest, so a feature
  asked for by name (2026-08-22, "the thumbnail part should be dragable
  to make bigger or smaller") could only be found by accident. (c) It
  was a bare `<div>`: no role, no tab stop, no keys, for a width the
  whole editor is laid out around.
  *Done 2026-09-01.* The two chrome rows take `z-index:131`, one above
  the handle's 130 and still under `.vfull` and `.matchbar`; a 2×26px
  hairline grip paints at rest and brightens on hover; and the handle
  becomes `role="separator"` with `aria-orientation`, a label, a tab
  stop and Left/Right arrows at 24px a press — stopping the event, since
  those arrows are also the deck's slide navigation. Driven live:
  `elementFromPoint` at the handle's x now returns `deck-status` on the
  save bar and `rbn-tabs` on the tab row (both were `film-resize`), the
  grip computes 2×26 at rest, and five Right presses take the column
  200→320px, three Left 320→248px, with the slide unchanged.

### Animation, rebuilt (2026-09-01, from the user's own review)

The user: "I found them really hard to use... the words are so weird and
the options are hard to get to... we need something like this instead of
just vanilla buttons." Measured before touching anything: three clicks to
fade one object, on the INSERT tab, and the four effect buttons are
un-hidden by the very click that moves the ribbon off that tab — so the
effects are visible for approximately none of the moments they are usable.

- [x] **T156 · S — An entrance effect plays the effect it names.**
  Three defects with ONE cause: the keyframes fought the inline style
  `applyCommon` writes. (a) `transform:translateY(22px)` REPLACED a
  rotated item's `rotate()` for the animation's duration, so the render
  path papered over it by silently swapping a rotated Rise or Zoom for a
  Fade — the model, the ribbon and the pane chip all said rise, and a
  fade played (JVC-03, shipping since the feature landed). (b)
  `to{opacity:1}` fought `a.op`, so a 40%-opacity object animated up to
  FULL and snapped back on every build — never reported. (c) `commit()`
  re-rendered the slide, the pane and the strip but never the RIBBON, so
  clicking Fade left **None** lit until you re-selected the object: you
  pressed the button, nothing moved, and the honest reading was that it
  had not worked.
  *Done 2026-09-01.* The individual `translate`/`scale` properties are
  applied before `transform` in the computed value, so they COMPOSE with
  the inline rotate() instead of replacing it; an omitted `to` keyframe
  means "the value this element already has". Both substitutions and the
  literal opacity are deleted, and `commit()` — which every animation
  change goes through, which is why it belongs there and not at its seven
  callers — now syncs the ribbon. Driven live: an item with
  `rotate(30deg)` and `opacity:.4` keeps the same rotate matrix at rest,
  mid-animation and after; `translate` runs `0 22px → none`; opacity runs
  `0 → 0.4`, not `0 → 1`; and the pressed state follows Fade then Rise.

- [x] **T157 · S — Reduced motion stops the entrances too.**
  `prefers-reduced-motion` cleared slide TRANSITIONS and text
  transitions and left every entrance keyframe running, so a reader who
  had asked their OS for less motion still got each build flying in
  (JVC-02). Confirmed live before the fix: the query matched while the
  item's `animationName` was `anIn-rise`, duration 0.5s, playState
  running.
  *Done 2026-09-01.* The guard sits BESIDE the keyframes it guards
  rather than with the unrelated `.slide` rule far below, so the next
  effect added is next to the rule that has to cover it. Builds are
  deliberately untouched: `.an-prebuild` still holds an item back and
  still releases it on the click, so the deck reveals in exactly the
  same steps — it cuts instead of animating, which is what the
  preference asks for and not one thing more. The test locates the
  guard by its CONTENT, because the page carries three reduced-motion
  blocks and the first one belongs to core.css.

- [x] **T158 · M — Animation gets its own part, and stops booting itself.**
  The whole animation surface lived in the middle of `45-images.js` —
  which already held images, crop, the transient-overlay owner AND
  transitions — as an EXECUTING SUB-IIFE. That is the pattern CLAUDE.md
  forbids by name and the one that silently killed the entire editor at
  boot in T133: a throw inside one takes the enclosing IIFE with it, and
  every later declaration in every later part simply never happens. With
  a gallery, hover preview, text builds and an order painter all about
  to be added here, that was the wrong foundation to build on.
  *Done 2026-09-01.* 238 lines lifted verbatim into
  `assets/js/deck/48-animation.js` (listed in `DECK_PARTS` after
  `47-charts`, or a test fails on the half that is missing); the sub-IIFE
  body becomes `animBoot()`, called from THE BOOT SEQUENCE with its
  siblings, where a failure is visible and isolated. The early return on
  missing markup is kept verbatim — a poster has no animation group.
  Behaviour-neutral by construction and verified live: no console errors,
  the effect applies and lights, the pane opens with its build list, the
  badge shows. One test needed widening: it asserted `initReuseDoors()`
  fell within the first 800 characters of the boot tail, and the new call
  plus its note pushed it past — the window is wider and the ORDER it
  was really guarding is now asserted directly.

- [x] **T159 · S — A chart's marks carry the series they belong to.**
  The enabling step for the one animation feature that is genuinely
  ours. `chartSvg` appended every mark straight onto the `<svg>`: the
  drawing loops have always KNOWN which series they were in — they sit
  inside `d.series.forEach(function(se){...})` — and threw it away on
  the append, leaving one flat bag of shapes. A build step cannot
  address what has no name, which is why "reveal this plot one line at a
  time" was impossible here, and why every other tool in the chain does
  it by exporting N SEPARATE PICTURES of the same plot (ggreveal returns
  a list of plots, beamer wraps `\only` round the block, Quarto renders
  one version per step, PowerPoint stacks PNGs with series deleted).
  Junoview is the only one that still HAS the numbers at present time.
  *Done 2026-09-01.* Each series' marks go in `<g data-series="NAME">`;
  the title, gridlines, axis and category labels go in the SKELETON
  group — the split the "slow reveal" wants (Evergreen: axes and
  gridlines first, then each line). A legend entry travels WITH its
  series, because a key naming a line the audience cannot see yet is the
  spoiler the whole technique exists to avoid; the layout is still
  computed for every series, so nothing reflows as they arrive. Keyed by
  NAME, never index, and that is the durability story: `chartResyncAll`
  already carries the author's per-series COLOUR across a refresh by
  matching `se.name`, so a build order keyed the same way survives a
  column being added, removed or reordered upstream — where PowerPoint's
  list is keyed to shape index, which is exactly why theirs breaks.
  Pie is deliberately left flat: its slices are CATEGORIES, not series.

- [x] **T160 · M — A chart can be built by series.**
  The slow reveal, and the one animation feature that is structurally
  ours. Every other tool does this by exporting N SEPARATE PICTURES of
  the same plot, which has a specific defect: each image rescales its
  own axes, so the plot JUMPS as you step through it. A chart annotation
  here is live numbers, so the axes are computed from ALL the data
  before a single mark is drawn and the frame is nailed down from the
  first click.
  *Done 2026-09-01.* Three pieces, and the middle one turned out to be a
  precedent we already owned. (1) `chartSeriesCount(a)` — one number,
  used by the timeline and the renderer so they cannot disagree about
  how many clicks a chart is worth. (2) `flipPlan` generalised: "one
  annotation consumes several playback stops" was written for flip books
  but was never a flip-book idea, so `flipsOn`/`flipFrames(a).length-1`
  become `steppersOn`/`extraStops(a)` and a series-built chart takes one
  stop per series after its own. Kept as a SEPARATE list from `flipsOn`
  on purpose: everything asking "is this a flip book?" must keep getting
  flip books and nothing else — only the TIMELINE cares that both kinds
  eat stops. (3) `drawChart` hides the groups not yet reached, with
  `visibility` rather than `display` so nothing reflows as series arrive.
  The door is a right-click row, "Reveal series one at a time", which
  says what it will cost ("Axes first, then 3 series — 4 clicks");
  assigning a build number per series by hand is exactly the
  drag-a-list-of-opaque-blocks misery people complain about in
  PowerPoint, where chart series animations cannot be reordered AT ALL.
  Proven by EXECUTING the shipped stop count, not by reading it — an
  off-by-one is invisible to a substring test and fatal in a talk: three
  series give 3 extra stops, no build gives 0, a pie gives 0 (its slices
  are categories), a 4-frame flip book still gives 3, plain text 0.
  Durability comes free and is the whole differentiator: the build lives
  on `a.anim`, and `chartResyncAll` replaces only `a.cats`/`a.series`, so
  the reveal survives "Update figures from their sources" and simply
  follows however many series the data now has — where PowerPoint's list
  is keyed to shape INDEX and comes apart when the data moves.
  NOT done, deliberately, and each worth its own entry: the emphasise
  step (dim all but one series), a build order over series that differs
  from the data's own order (the order painter is the natural home), and
  the .pptx export, which currently sends a series-built chart as one
  picture on one click and must say so in the loss report.

- [x] **T161 · S — The flip-book tie, reachable from the text.**
  Tying text to a flip book's page has worked since T86, and its three
  modes are exactly the distinction a user reached for on 2026-09-01 in
  their own words ("cumulative... or not cumulative, just the text that
  is tied to it"): `only` is "Just this figure", `from` is "This figure
  and every one after", `until` is "This figure and every one before".
  The feature was not missing. The DOOR was: the only way in was a
  `Figures…` button that shows only while the FLIP BOOK is selected, so
  the flow ran backwards from how anyone thinks about it — select the
  book, open its pane, and only then select your text. It has now been
  re-requested twice as though it did not exist; T86 answered the first
  by putting a hint inside the pane, which is the wrong place to be
  standing to read it.
  *Done 2026-09-01.* A "shows with" section in the object's own
  right-click menu, offered whenever the slide has a flip book with
  frames and the selection is something other than a flip book. It names
  the tie that already exists ("✓ Shows with figure 2 of …") or offers
  to make one, and opens the existing control with the selection intact
  — `showFlipPane` sets which book the pane is about and never touches
  what is selected, which is why one click lands on "Tie *your text* to"
  rather than on a pane you then have to re-select through. Nothing was
  rewritten; the tie panel, its frame list and its three modes are the
  ones T86 built. The heading is deliberately NOT in T137's `CM_KEEP`,
  so it folds into "More" on a crowded menu like every other optional
  section.

- [x] **T162 · S — The three surfaces that under-counted the sequence.**
  An independent review of this whole surface found one missing join
  wearing three faces. `flipPlan(s)` is the sequence playback walks;
  the film-strip mark, the "Remove animations" toast and its empty-case
  guard each re-derived a WEAKER answer from `slideBuildSteps` — builds
  only — so each told the reader a different number from the one the
  space bar takes. A slide whose entire reveal is a six-figure flip
  book, or a chart built by series, was marked as having nothing on it.
  *Done 2026-09-01*, the cheap two-thirds of it. The strip mark counts
  `slideStops` and says "5 clicks to walk this slide" rather than
  "3 builds", and its tip names a door that exists (T140 retired
  "Timeline", which this tooltip was still sending people to). "Remove
  animations" now counts what REMAINS: with a flip book left it says how
  many clicks are still in the slide instead of claiming "everything is
  on the slide from the start", and the empty guard no longer says
  "Nothing on this slide is animated" about a slide the space bar walks
  in five clicks. Deleting the flip book's own frames is deliberately
  NOT done here — this button is about the reveal, and a flip book is
  CONTENT.
  Also fixed here, a defect T161 shipped hours earlier: `shows with` was
  left out of `CM_KEEP` "like every other optional section", which put
  the door built to cure a discoverability problem behind the More fold.
  It is kept open now.
  NOT done, and the review's headline recommendation: make the
  ANIMATIONS PANE the one true sequence — list every stop from
  `flipPlan`, not only the anim-order rows, so a flip book's five clicks
  and a chart's series builds appear in the panel headed "Build order".
  That is the join those two features fell through, it needs no new
  stored key and no new ribbon button, and it is the next thing to do
  here.

- [x] **T163 · M — The Animations pane is the one true sequence.**
  The review's headline recommendation, done. The pane's list is headed
  "Build order — each row is one click" and showed anim-order builds
  ONLY, so a flip book's five clicks and (since T160) a chart's series
  builds were invisible in the one panel that claims to list the clicks.
  `flipPlan` already worked out which stepper sits after which build and
  threw that away; it now returns `anch` and `tail`, and the stops a
  build anchors are drawn beneath it.
  *Done 2026-09-01.* The sub-rows are READ-ONLY on purpose: a page's
  place in the sequence is decided by its place in its BOOK, and a
  second way to reorder it here would be two truths about one order —
  the book's own pane is where frames move. A chart contributes its
  series by name, a book its pages by `frameLabel`. The empty state now
  tells the two cases apart: "Nothing animated on this slide yet" only
  when nothing steps either, and otherwise "No entrance effects here,
  but this slide takes N clicks — it steps through what is below."
  Driven live end to end on a three-series chart: the right-click row
  toasts "Axes first, then 3 series — 4 clicks", the pane lists one
  build row plus *then control / then treatment / then baseline*, and
  the film strip marks ▸4. Three surfaces that disagreed this morning
  now say the same number.

- [x] **T164 · S — A chart is positioned like every other object.**
  Found by failing, repeatedly, to select a chart while driving T160 —
  and assuming it was pointer-events until the DOM said otherwise. Every
  annotation kind declares its own `position:absolute` (`.an-table`,
  `.an-image`, `.an-flip`…); `.an-chart` shipped in T117 with only
  `overflow:hidden`. Two consequences, neither visible in a screenshot
  of a slide holding one chart: the inline `left`/`top` that `drawChart`
  writes were INERT, so a chart rendered at the slide's top-left however
  you placed it; and an unpositioned element stacks BELOW the arrow
  hit-layer — an absolute `<svg>` covering the whole canvas — so a chart
  could not be clicked, could not be selected, and its whole right-click
  menu (Edit data, chart type, and T160's own series build) was
  unreachable.
  *Done 2026-09-01.* One declaration. Measured before: chart `static`,
  stored left `14%`, rendered at (0,0), while a text box beside it was
  `absolute` and honoured its 14.9%. After: `absolute`, rendered at
  (158,127) against an expected (158,127), selects on a click, and the
  series-build row is reachable for the first time since it was written.
  The lesson worth keeping: T160 was tested, driven and committed
  against a feature whose door could not be opened, because the tests
  read the assembled JS and the drive fell back to executing functions.
  A shipped chart had never been clicked.

- [x] **T165 · L — A text box that carries pages.**
  User, 2026-09-01: "flip book for text would be good... sometimes you
  need lots of text for one image." A box you click through, instead of
  stacking animations.
  *Done 2026-09-01*, and the model is the interesting part. NOT a new
  kind (that is the text renderer, the editor and the whole `#fmt-*`
  bar written twice) and NOT a flip book with text frames: every text
  property — size, colour, font, align, list, markdown, maths, style,
  shrink-to-fit — lives on the ANNOT, and a flip annot carries none of
  them, so it would give you words you could not style, bullet or write
  in markdown. Worse than the two text boxes it replaces. So `k` stays
  `text` and the box grows `pg`, the pages after the first. PAGE ONE
  STAYS IN `a.text`/`a.html` — everything that reads a text box (an
  older junoview, the .pptx writer, search, the Objects pane, the notes)
  keeps working AND keeps being right, seeing page one when it cannot
  see the rest. The alternative, mirroring a.text to whatever page is
  showing, is a register: two copies going stale on every autosave.
  The in-place editor cost nothing, which is what settled the design:
  `editableText` never knew where the words lived — it was handed
  accessors — so pointing them at a page is the whole change, and the
  caret, the debounced commit, blur flush, Tab-to-indent, paste-as-code
  and the maths and markdown gates all keep working untouched. It steps
  through the door T160 built for chart series (`steppersOn`/
  `extraStops`), deliberately NOT through `flipsOn`, so everything that
  asks "is this a flip book?" keeps getting flip books.
  Driven live: add a page from the right-click menu, pips appear with
  the current one filled, type "SECOND PAGE" on page two, click the
  first pip and page one still says "FIRST PAGE" — each page holding its
  own words. The film strip and the Animations pane both say 1 click.
  TWO THINGS THE DRIVE CAUGHT that the tests could not.
  (1) The 18 sites built the model, the renderer, the editor, the
  timeline and the export — and NO DOOR. `textAddPage` did not exist.
  That is the third time today a capability shipped with no way in, and
  the reason the drive matters more than the suite here.
  (2) A phantom `-1`. T162 and T163 both wrote `slideStops(s)-1`,
  reasoning that arrival is free — but an item hides while
  `sp>=revealCount` and the largest `sp` is `count-1`, so `count`
  presses is exactly what builds the slide. A two-page box was told it
  took "0 clicks" while the strip, reading the same function, said 1.
  Both sentences now use `slideStops` directly.
  NOT done: Part B, many text pages per FIGURE. The arithmetic is
  specified and the load-bearing detail is written down — `c[k] =
  max(1, pages tied to figure k)`, because summing raw page counts makes
  a figure nobody wrote about vanish entirely, and `extraStops = |P|-1`
  or every slide with a book gains a phantom stop at the end.

- [x] **T166 · M — Many text pages for one figure (Part B).**
  "Sometimes you need lots of text for one image." A flip book with
  words walking beside it stops taking one stop per FIGURE and takes one
  per (figure, page-of-that-figure): figure 2 with three paragraphs to
  say about it is three stops, and the book's own arrow turns the page
  before it turns the figure.
  *Done 2026-09-01.* The arithmetic shipped with T165 (`flipSlots`,
  `flipWalk`, `pageFigs`, `pagePos`, `booksWith`); what was missing —
  for the FOURTH time in a day — was the door. It is two rows in the
  text box's own right-click menu, and it is two rather than a list of
  every figure because of the model: `pageFigs` carries the figure
  FORWARD, so a page stores one only where it CHANGES. Five pages across
  three figures is two settings, and the sentence stored is the sentence
  a person says — "figure 2 starts on this page", with "keep this page
  with the one before" to take it back. Page one keeps its figure in
  `a.fbf`, the key the tie panel has always written, so a one-page box
  is byte-for-byte the tie T86 built.
  The two off-by-ones the design warned about are both one character and
  both now proven by EXECUTING the shipped functions rather than reading
  them: `flipSlots` starts every figure at 1 and only raises it, so
  putting all five pages on figure 1 still leaves figures 2 and 3 as
  stops (`[5,1,1]`, walk 7) instead of deleting them from the talk; and
  the walk is `|P|-1` beyond arrival, or every slide carrying a book
  gains a phantom press that changes nothing. Checked against the
  design's own worked examples: nothing tied `[1,1,1]`; pages 3,1,2
  `[3,1,2]` walk 6; two books beside one figure take the LONGER, `[3,1]`.

- [x] **T167 · S — One feature, one name.**
  Done before adding another surface to it, because the pile was already
  growing: the ribbon group said "Animate", the button inside it said
  "Animations", and the pane that button opens said "Animation pane" —
  three words touched in a single gesture, one of them a verb where the
  others are nouns. An independent review counted twelve user-facing
  words for the same handful of ideas and recommended seven.
  *Done 2026-09-01.* The group is "Animation" (a category, like INSERT),
  the door and the pane are both "Animations". "Timeline" was retired by
  T140 and two USER-FACING sites still sent people to it: help.html
  named it as a button on the Insert tab, and one of the nine ribbon
  layouts still labelled a group with it — so anyone on that layout, or
  anyone reading the help, was hunting for a control that no longer
  exists. Code comments keep the old word where they are recording
  history; that is what a comment is for.

- [x] **T168 · M — Say the order by pointing.**
  The user's own gesture, in their words: "when you click it becomes the
  next thing that's animated... then if you hold down shift and click
  all those animations appear at the same time." It is also the answer
  to the loudest complaint people make about PowerPoint's animation pane
  — that ordering means dragging opaque blocks in a list that lags,
  silently fails and greys its own buttons out. Here the order is said
  ON THE OBJECTS, in the order you say it.
  *Done 2026-09-01*, deliberately the same shape as `matchArm`: a state
  object, a class on the deck, a `.pickbar`, Escape to cancel, and a
  running count that names Ctrl+Z. A third way to run a picking mode
  would be a third thing to learn. Shift is read off the EVENT rather
  than kept as a state to keep in step. Numbering starts after whatever
  the slide already has, so arming does not silently re-order builds
  made earlier. THE WHOLE RUN IS ONE UNDO STEP — `markDirty` fires once,
  at Finish — and Cancel restores the slide exactly as it was, because a
  mode that left half a sequence behind would be worse than no mode.
  Driven live: GAMMA, ALPHA, shift-BETA gives "1 GAMMA" and "2 ALPHA ·
  BETA" in the build list — three objects, two clicks. The finish toast
  says BOTH numbers, because they part company the moment you
  shift-click and saying only one reads as a miscount to whoever did the
  other (it first said "2 things" for three objects).
  NOT done, and the reason this is T168 and not the whole idea: the
  DIGIT gesture — "hold down 5 and click, it appears five seconds after
  the last" — needs a timing model, and Junoview has none at all. It is
  the first thing here that would store a delay, and a stop that
  ADVANCES ITSELF is a different playback model from one the space bar
  drives. Its own task, with the export question answered first: PDF and
  standalone HTML are fully built so timing means nothing there, while
  .pptx genuinely has after-previous-with-delay to map onto.

- [x] **T169 · M — A build can run itself, after a pause.**
  The rest of the user's gesture: "if you hold down 5 and click it
  appears five seconds after the last animation." Built on the same day
  as T168 rather than deferred again — the user's words: "stop not doing
  features cause they are hard."
  *Done 2026-09-01.* `a.anim.after` is a whole number of seconds, and it
  is the first TIMING Junoview has ever stored. Absent — every build ever
  written until now — means wait for the space bar, so no existing deck
  changes. It is a property of the STOP rather than the object: two
  things arriving together cannot arrive at two different times, so the
  click writes it onto every item sharing that order, and holding 0
  takes a delay back without leaving the mode. The digit has to be
  TRACKED because a MouseEvent carries shift/ctrl/alt/meta and nothing
  else; it is swallowed while the mode is armed so a digit cannot also
  mean whatever else a digit means.
  THE PLAYBACK MODEL is the part that needed care. A stop on a clock is
  not a stop on a click, and the failure it must never have is a talk
  that advances twice in front of an audience: exactly one timer may be
  pending, and every mover cancels it first — `advance`, `backStep` and
  `go` all call `autoStop()` before doing anything. A delayed FIRST
  build still starts counting on arrival, or the feature would need a
  click to begin not-clicking. The wait is clamped to 60s so a typo
  cannot park a talk forever, and only a BUILD can carry one: a flip
  book's frames and a chart's series are positions in a walk, and those
  are the stops a presenter talks over.
  EXPORT is real, not a loss line. PowerPoint has this exact idea, so an
  automatic group leaves as `nodeType="afterGroup"` with a millisecond
  delay where a click group keeps `delay="indefinite"`. Only the new
  case declares a nodeType: `clickEffect`/`afterEffect` name individual
  EFFECTS while a group is a clickPar or an afterGroup, and the click
  path was verified in PowerPoint itself over COM (T110), so it is left
  byte-identical. PDF and standalone HTML are fully built, where timing
  means nothing.
  Driven live end to end: hold 2 and the bar reads "2 held — next one
  runs 2s after the last, no click"; the pane row reads "TWO · fade ·
  +2s"; in Present one space press showed ONE and two seconds later TWO
  appeared with no further input.

- [x] **T170 · S — The mode has a name, an effect, and its keys on show.**
  Three gaps the user found by looking at the bar. (1) The mode had NO
  NAME — it was described only by the sentence it was doing, so there
  was nothing to remember it by ("I can't remember the mode name, like
  the 'auto' or 'quick'"). It is now called what its door calls it,
  **Click in order**, with the name first so the bar reads as one thing.
  (2) It wrote `fade` for everything, so sequencing in any other effect
  meant going round a second time; the bar now carries the five effects
  and the next click gives whichever is chosen — including None, which
  makes a click TAKE an animation away. (3) Every effect button PRINTS
  ITS KEY (N, A, F, U, G) and repeats it in the tooltip, because a mode
  whose shortcuts are invisible has no shortcuts; the digits 1–9 keep
  the delay and the bar says so.
  Also here, a decision recorded on 2026-09-01 and never executed:
  **Rise is now Float up** — no mainstream deck tool ships an entrance
  called Rise, and worse, it names a DIRECTION while our icon for it
  reads as "align to top", a real command in the same ribbon. The stored
  token stays `rise`, because DECK-FORMAT is a contract and only the
  word on screen changes.
  AND A BUG ONLY THE SCREEN COULD FIND: `.pickbar` is z-index 99, right
  for the notebook card picker, which appears when the deck is NOT
  covering the screen. `.deck` is fixed at 100 — so the sequencing bar
  rendered UNDERNEATH the editor it was describing. The DOM reported it
  visible, 1439×44, at (46,144), and the screenshot showed nothing at
  all. `.matchbar` had already solved this at 150 for exactly this
  reason; the seq bar joins it rather than inventing a third number.
  That is twice today a probe said "fine" and the pixels said otherwise.

- [x] **T171 · M — The effect gallery.** THE ORIGINAL ASK, and it took
  far too long to reach: "the words are so weird and the options are
  hard to get to... we need something like this instead of just vanilla
  buttons." Everything else in this group was built around it first.
  What was there: FOUR buttons, each `hidden` until something was
  selected — and un-hidden by the very click that moves the ribbon to
  the Object tab, which is the one tab they were not on. The effects
  were visible for approximately none of the moments they were usable,
  and the vocabulary could never be learned because you only ever saw it
  for one click.
  *Done 2026-09-01.* One door, `Effect ▾`, NEVER hidden, whose label
  never renames itself (a label whose width follows the selection makes
  the row's required width depend on what you clicked, and the fit
  ladder has no rung left for that) — the current effect rides on the
  icon and on the card marked `aria-pressed`. A POPOVER rather than
  tiles in the row, and the measurement decided it: at 1366px an inline
  gallery leaves the slide column 503px against today's 517px, i.e.
  WORSE than the status quo, while this door leaves it 598px. Six
  PowerPoint-sized tiles would take the column to 239px, a hair above
  the hard floor.
  Hovering a card runs the REAL keyframe on the REAL object, cancelled
  on leave and by a timer because `animationend` is not a safe cleanup,
  and suppressed under reduced motion. Picking with NOTHING selected
  gives every object the effect, one build each, in reading order, as
  one undo step — which deletes the empty state and takes "one at a
  time, in Float up" from eleven clicks to two. The footer says which it
  will be BEFORE you click, because a large silent edit from one card
  would be worse than no shortcut.
  Driven: the door shows cold; two clicks gave three boxes a build each,
  toasting "Everything on this slide, one at a time — 3 clicks" with the
  strip agreeing at ▸3. The drive also caught the bug the tests could
  not — `setType` and `rerender` are locals of `animBoot`'s closure and
  the gallery boots separately, so the first pick threw "rerender is not
  defined" and nothing happened. `setType` is now published the way the
  pane's syncs already are. And `Appear`, an option in the pane since
  the day it landed, finally has an icon, because it finally has a
  button.
- [x] **T172 · L — Text builds: a bullet, or a sentence, at a time.**
  "Options for text as well, like the dot point by dot point, line by
  line, sentence by sentence." Not possible at all before: a build was a
  property of an ANNOTATION and a list is one annotation, so four
  bullets meant splitting the box into four boxes by hand — about
  seventeen actions.
  *Done 2026-09-01.* The box is cut at RENDER time into `[data-part]`
  runs and the words are never re-stored, so the in-place editor,
  search, the .pptx writer and an older junoview all still see one box
  of text. The cut points come from the STORED text — a list item, a
  line you pressed Enter on, a sentence — which is why the click count
  is identical at every zoom, every page size and in the exported deck.
  A WRAPPED line is deliberately NOT offered: it depends on the box
  width, so its count would change when you dragged a resize handle, and
  a build you cannot rehearse against is worse than none. The chooser
  lives in the pane, not the ribbon: three more word buttons is ~200px
  of ribbon floor and by T152 every px comes off the slide column.
  Sentence cutting leaves "Fig. 3", "et al." and "0.05" alone.
  ONE COUNTER, learned the hard way: `slideBuildSteps` already expands a
  cut box through `sub[o]`, and the first pass ALSO counted the pieces
  in `extraStops` — so a three-bullet box was worth five clicks. Caught
  by driving it (the strip read ▸5 for three bullets); the parallel
  count is gone and the reveal reads the build steps the pieces occupy.
  Driving also caught the .pptx writer quietly DROPPING T169's delay:
  the paragraph split rebuilt each step entry as `{spid,type,para}`
  without `after`, so an automatic build exported as a click one.
  Driven: three hard-broken lines, Bullet by bullet, strip ▸3, and
  Present steps `--- / +-- / ++- / +++`.
- [x] **T173 · L — Words tied to a chart series, not to a click.**
  T160 made a chart arrive one series at a time; the sentence about
  that series still arrived on a click of its own, so the two drifted
  apart the moment you inserted a build anywhere earlier on the slide.
  A tie fixes the words to the MOMENT instead: `tie:{to:'series',
  id:<the chart's oid>, at:<the series NAME>, m:'from'|'only'|'until'}`.
  *Done 2026-09-01.* Bound by NAME, never by index, so a data refresh
  that reorders the columns cannot silently repoint the sentence at
  someone else's series. Every unresolvable binding FAILS OPEN — chart
  deleted, series renamed, build switched off — because an object that
  becomes invisible forever is the worst thing this feature could do;
  the same rule flipShowsFrame already followed. `stepShows` asks the
  flip-book tie and the series tie as ONE question, so the hide pass
  cannot learn a new stepper and forget an old one, and both halves
  return true for an object carrying no tie — every deck written before
  today renders byte-for-byte as it did.
  The door starts from the SELECTION (the T161 lesson): select the
  words, right-click, “Show with a series of …”. The panel re-renders
  in place rather than closing, because the mode rows cannot mean
  anything until a series is picked.
  It EXPORTS rather than becoming a loss line: “from” is PowerPoint's
  own model, so the words arrive on the click that plots that series,
  at `base+i` — the same arithmetic the reveal uses, so the click you
  rehearsed is the click you get. “only” and “until” need the words to
  LEAVE again, which this writer has no exit for; those are counted in
  the export dialog and land whole.
  DRIVING IT FOUND A LIVE BOOT-KILLER, and this is the reason to keep
  doing it. T171's `galBoot` called `wireMenuToggle(btn,menu,galSync)`
  — that helper takes id STRINGS and does `$('#'+id)`, so it built the
  selector `#[object HTMLButtonElement]` and threw a SyntaxError from
  inside THE BOOT SEQUENCE. Everything after it never ran: `overlayBoot`,
  `initReuseDoors`, `applyRibbonLayout`, `applyRibbonPrefs`,
  `applyInitialRoute`. The visible symptom was that Insert → Chart did
  nothing at all, and all 990 tests were green, because the call reads
  perfectly well as a substring. The gallery is now wired directly (it
  has to redraw as it opens anyway), and
  `test_the_shared_menu_wiring_is_only_ever_handed_id_strings` pins the
  argument shape so the next caller fails in pytest instead of in
  somebody's browser.
  Driven: chart placed from the ribbon, “Reveal series one at a time”
  (“Axes first, then 2 series — 3 clicks”), words tied to Series 2,
  then Present — press 1 axes, press 2 Series 1, press 3 Series 2 AND
  the sentence.
- [x] **T174 · L — The Layers pane is the timeline, and an object can leave.**
  Asked for in one breath with the thing it fixes: “it's really
  annoying when you want an image replacing another image … it would be
  cool if the animations was also tied in with the layers, so you can
  hide layers and build animations this way — like the animations also
  appears in the layers.” Both halves are one idea: the pane that says
  whether a thing is SEEN should also say WHEN.
  *Done 2026-09-01.* Every row now carries a build column — the click it
  arrives on, an arrow, the click it goes on — read straight down the
  list. Clicking it opens one popover that sets both ends. A tied object
  names the click its tie lands on rather than showing a dot: a build
  column that lied about the one thing it was added for would be worse
  than no column. **By build** re-reads the same list in playback order,
  one heading per click, which is the animation pane's job done where
  you were already looking; **Animate in order** arms the click-
  everything mode from the list of the things you would be clicking.
  THE EXIT. `a.out` is the build order on which an object goes away.
  A PEER of `anim`, not a field inside it — and DRIVING IT is what
  settled that. The commonest swap of all is “this picture is simply
  there, and that one replaces it on the first click”, and an object
  that is simply there has no `anim` to hang an exit off; the first cut
  put `out` inside `anim`, so the swap verb had to invent an entrance
  for the outgoing object and the whole thing landed a click late. The
  badge read `[1]` where it should have read `[·→1]`, which is exactly
  the kind of thing no substring test can see.
  An exit rides the ONE hide question — `stepShows` now asks the flip
  tie, the series tie and the exit together — so the next kind of stop
  is one edit rather than a hunt. It claims its stop, or “goes on one
  more click at the end” would end the slide with the object still
  there. Unresolvable exits fail open, like every other reference.
  The door is a verb, not a pair of settings: two objects selected is
  exactly the shape of “make that replace this”, so the right-click
  menu offers **Replace “A” with “B”** both ways round and does the
  arithmetic. .pptx gets entrances only, so an exit is counted in the
  export dialog rather than silently arriving and staying.
  Driven: two boxes, both “on the slide from the start”, Replace →
  toast, pane reads `·→1`, By build lists BEFORE under both “on the
  slide to begin with” and “click 1” (as “goes — …”), and Present
  shows BEFORE alone, then AFTER alone.
- [x] **T175 · M — Pair the words to the figures in one command.**
  Tying a sentence to a figure has worked since T86 and to a chart
  series since T173. Doing it five times is five trips through a menu
  with a chance to misnumber on every one — and five findings, five
  plots, one sentence each, in order, is the commonest shape a talk
  has. So it gets one command.
  *Done 2026-09-01.* Select the words and the thing that steps, and the
  “shows with” section offers **Pair N up with the N figures/series**,
  in two readings: *one at a time* (a walk-through — each sentence only
  beside its own figure) and *building up* (each arrives and stays, so
  the list grows). Which one you want is a fact about the talk, not
  about the slide, so both are offered rather than one being picked.
  READING ORDER on both sides, through `orderedIdx` — the sweep the
  rest of the deck already uses, never a second one — so the pairing is
  the one you would have made by hand and re-running it after nudging a
  box gives the same answer. One tie replaces the other, because an
  object bound to a figure AND a series would be two questions with one
  answer. NEVER SILENTLY TRUNCATED: three sentences against five
  figures is a real thing to do, so it pairs what it can and the toast
  names what was left over and what is still free.
  Driven: a 2-series chart set to reveal one at a time, two sentences,
  Pair → “2 paired up in order”, the Layers build column reads
  “Series 1”/click 2 and “Series 2”/click 3, and Present gives axes,
  then Series 1 with Point 1, then Series 2 with Point 2 alone.
  Also fixed by reading the live menu: it said “2 seriess”.
  The same audit corrected a number in T152's own comment: 890px is the
  ribbon's RESTING need, while `ribbonMinW` measures ~635px with the
  whole ladder stamped on. It also named the mechanism that made this
  bite so hard — a ONE-WAY RATCHET: dragging left worked, and `up()`'s
  `fitFilmMax()` then republished the ceiling AT the new smaller width,
  so a column once narrowed could never be widened again. That is why a
  stuck ~200px column was the reported symptom.

### The ribbon, spaced out (2026-09-02, from the user's own review)

The user: "there are just heaps of buttons that you always have to
click through... it would be good if more things, like the text options,
had their own little window of options. This would mean a lot of things
are going to get spaced out a lot more, and there might need to be more
tabs e.g. like animations being its own tab (it doesn't really work
under insert anyway)... the text styles under design (should this be
under design anyway???)". Counted before touching anything: with a text
box selected the Object tab held **41** controls across six groups, the
Text group alone fifteen; Design's Type group had seven buttons for one
idea; Insert carried thirteen tools and the whole of Animation.

- [x] **T176 · S — Animation is a tab of its own.**
  It was folded into Insert on 2026-08-20 when it was six small buttons
  and Insert had room to spare. The gallery (T171), the pointing mode
  (T168) and the reading order (T106) arrived since, and a build is
  something you give a slide AFTER it is full — the opposite moment
  from putting things on it, which is why it "doesn't really work under
  insert".
  *Done 2026-09-02.* A fifth tab, **Animation**, between Design and
  Object, with two groups: **Animation** (the pane, the effect gallery,
  Remove animations) and **Order** (One by one, All at once, and two
  doors the ribbon never had — **Click things in order…** and
  **Reading order…**, which lived as rows at the FOOT of the pane, a
  door behind a door). Both call the pane's own functions: two doors,
  one implementation. A browser that remembers the retired `animate`
  tab lands here; a poster hides every one of the seven, so the tab
  leaves the strip there as an empty tab always has. The Default
  ribbon layout declares the tab; the eight others keep their own.

- [x] **T177 · L — Windows of options on the Object tab.**
  THE ASK ITSELF. With a text box selected the Object tab held 41
  controls; the Text group alone was fifteen bare buttons in a two-row
  grid, Line & shape was six dropdown doors stacked in three columns,
  and the Object group had eleven. The user liked the effect gallery
  (T171) and asked for more of that shape: "their own little window of
  options."
  *Done 2026-09-02.* Four windows, each ONE worded door on the ribbon
  opening a panel with a heading over every section, scrolling if
  tall, staying open while you work, closing on Escape or a click away:
  - **Font ▾** — typeface, size (field and stepper), and Bold / Italic
    / Underline / Strikethrough, with their words now there is room.
  - **Paragraph ▾** — alignment, the list toggles with indent and
    outdent, the whole-box indent as a stepper with its count, line
    spacing, paragraph spacing, and the curve. Every "how the words
    sit" answer in one room; it replaces the Spacing and Layout menus
    and the bare list buttons between them, and it opens for a table
    too (its words take spacing).
  - **Line ▾** — the four drawn menus (style, weight, arrow ends,
    route) laid flat as sections, style and weight side by side. A pick
    leaves the window up, so the weight follows the style without a
    second trip; the printed thickness moved from the old door's
    tooltip to the Weight heading.
  - **Source ▾** — Locate, Where from, Previous figure, Lock figure,
    Refresh, Replace: one family, rare beside Crop and Keep shape, and
    each row closes the window as it acts.
  THE CONTROLS ARE THE SAME ELEMENTS, moved into the windows in the
  markup rather than copied: every id, handler, pressed state and test
  addresses the one Bold there has always been, `rbnAtoms` sees a
  window as one atom, and a ribbon layout that names a member places
  the window where that member went (`rbnResolve` — Font lands in the
  Office ribbon's Font group). One owner (`optPanelBoot`, from THE BOOT
  SEQUENCE) wires every door through `overlayShow`; a window added to
  the markup needs no JS of its own.
  Counted after, text box selected: **Arrange 4 · Colour 3 · Text 3 ·
  Object 2** — twelve where there were 41 — and the ribbon sits on the
  first width rung at 1400px where it needed three.
  TWO SHIPPED BUGS FOUND BY DRIVING IT, both invisible to the suite:
  (1) on deselection every governed id was hidden one by one
  (2026-08-25), and a button inside a governed wrapper was never shown
  again, only its wrapper — so after the first deselection, i.e. at
  boot, the **Colour group, Arrange, Styles, Spacing, Layout, the size
  field and the opacity slider had all gone**. Driven against the build
  before this one: same result. Now only the OUTERMOST governed element
  is hidden, which is exactly the set of atoms a layout moves, and the
  colour wrappers copy their button's state after it is set rather than
  one selection behind. (2) Escape on an open menu also ran the deck's
  own ladder, so closing the Font window deselected the box it was
  about; the owner now takes the key in capture, as the gallery and the
  notes editor already did.
  Driven: Bold from inside Font (pressed, window stays); Centre then
  Double from Paragraph (marks move, box reads bold / centre / 31px
  line); a 3pt dashed arrow from two picks in one Line window; Where
  from… from Source (window closes, pane opens); the window floats
  clear with the side toolbar on; Office ribbon → Font@Font,
  Paragraph@Paragraph, Line@Drawing, Source@Picture; Default → back.

- [x] **T178 · M — The deck's type is one window; Insert says what each
  tool is for.**
  The user: "the text styles under design (should this be under design
  anyway???)". YES — the deck's type is a design decision about the
  whole deck, which is what every other door on that tab is; the
  per-box Styles door on Object is the other half. What was wrong was
  the count: Design's Type group had seven buttons for one idea (Text
  styles, Design tokens, A−, A+, Re-apply, Style system, Standardise).
  *Done 2026-09-02.* The **Text styles ▾** window is the one room for
  the deck's type: the per-style list above, and under a heading of
  its own the whole-deck commands that were four more buttons in the
  row — **Smaller / Bigger** (every style, in proportion),
  **Re-apply**, and **Style system…**. They are the real buttons, in
  the markup, so their wiring is untouched; the style manager builds
  its rows into a list container so a rebuild leaves them standing,
  and its door now goes through the one transient-menu owner. Two
  buttons stay beside the window because they are not type: **Design
  tokens** (colours, radius, spacing) and **Standardise** (a check, and
  the button the user went looking for in T87). Seven → three.
  INSERT, with Animation gone to its own tab, had the width to say
  what each cluster is FOR, so its thirteen tools are three groups:
  **Place** (Object, Image, Flip book, Table, Chart), **Write** (Text ▾,
  Equation, Markdown, QR code) and **Draw** (Shape ▾, Line, Arrow,
  Draw, and Cancel last, as before). The buttons moved with their
  comments; not one changed its id, so the nine ribbon layouts, the
  per-button customiser and every handler are untouched.
  Driven: Design's Type group reads Text styles ▾ | Design tokens |
  Standardise; the window lists the seven styles, then Smaller /
  Bigger / Re-apply and Style system…; Bigger from inside it scales the
  list and the window stays; Insert reads Place | Write | Draw and
  drawing an arrow still works from Draw.

The user, on the new build (2026-09-02, second review): "it is still
quite a few clicks to add an appear animation to something. I would
like in the 'Object' list there is an animation tab, which has all the
animation options... I hate that there is the thing that pops up in the
animation tab... the whole 'Click things in order' options should just
appear after a divider on the ribbon. Also what a silly name for the
button... What is reading order and why does it look so confusing... I
can't understand this at all and it is my idea... we had something
about animations appearing in layers? Is that a thing?"

- [x] **T179 · S — One click gives the selected object its entrance.**
  Counted first: select a box, Animation tab, Effect ▾, card — three
  clicks and a tab change to give one thing a Fade, on a tab the
  selection had just moved you OFF. The effect buttons T171 retired
  had been on the wrong tab; the fix is the right one.
  *Done 2026-09-02.* An **Animation** group on the Object tab — the
  tab the selection sends you to — with **None / Appear / Fade /
  Float up / Grow** as buttons that show which one is on, through the
  same `setType` the pane and the gallery use. One click. Hidden on a
  poster, which has no build. The gallery stays on the Animation tab
  for the whole-slide case.

- [x] **T180 · M — Setting the order happens in the ribbon, and the
  door has a plain name.**
  The pointing mode (T168) put a bar fixed across the top of the
  window, over the very ribbon it stood in for, and its door was a
  sentence: "Click things in order…".
  *Done 2026-09-02.* The door is **Set order**. Arming it takes you to
  the Animation tab and a **Set order** group appears after the
  divider — the running count and the Shift / 1–9 hints on two lines,
  the five effect chips with their keys, Undo the last one, Finish,
  Cancel — tinted and ruled on its left so it reads as a mode. The
  three cells carry the hidden bit (a group's visibility is read off
  its controls, so hiding the group itself would not hold) and the
  ribbon re-fits as they show. Nothing pops over anything. The
  Animation tab also gains **Layers**: the timeline is the Layers pane
  (T174 — every object with the click it arrives on and, if it leaves,
  the click it goes), and it had no door where animation lives. That
  is the answer to "is that a thing?": yes, and now it is one click
  from here.

- [x] **T181 · S — The order you point is the order of the slide.**
  Builds and the reading order were two orders set in two places, and
  the second had a floating panel of arrows under a paragraph nobody
  could read.
  *Done 2026-09-02.* Finish in Set order also writes the clicked
  sequence as the slide's order (`rord`), so figure numbers, One by
  one and the review outline follow the order you pointed — and with
  the effect set to None it writes ONLY the order, which is how you
  number things without animating them. Anything you did not click
  comes last, in sweep order, as it always has. The **Reading order**
  door leaves the ribbon; the panel keeps its arrows for a nudge,
  reached from the Animations pane and the right-click, renamed
  **Order on this slide…** and explained in one plain paragraph: what
  the order is for, then how to set it, Set order first.
  Driven: select a box → Object tab → Fade is one click and lights;
  Set order → the tab switches and the group appears, three clicks
  with Appear → Finish writes builds 1–3 AND `rord` in that order, and
  the panel reads "Set by you"; Escape cancels and the group goes;
  Layers from the Animation tab opens the pane with the build column.

The user, third review of the day (2026-09-02), with PowerPoint's
Animations tab beside ours: "what do these options mean, why is there
an effect option when there is nothing to appear... didn't we say
having those horizontal scrolls like on PowerPoint where there are all
the options... so you can just quick click... I don't know what half
these buttons mean, like the 'set order' one that is the 'quick
animations' thing with clicking... Pop-ups like that should always
appear on the rhs... the layers thing is good, but also really packed,
confusing to look at and can't be re-sized."

- [x] **T182 · M — The effects are tiles in the row.**
  T171 measured an inline gallery against a full Insert tab and chose
  a popover. The Animation tab has the room, and a door in front of
  five tiles is one click too many every time.
  *Done 2026-09-02.* The Effect group is a strip of five tiles in the
  ribbon's own row — icon over word, the way PowerPoint's are, the one
  that is on lit — built by the same `galSync` the selection already
  calls. DISABLED with nothing selected, and the group label says
  "Effect — select something": an effect is a fact about a thing, and
  the whole-slide builds are the two worded buttons beside it. The
  Animation tab now KEEPS the selection instead of carrying you to
  Object: clicking a thing while standing there is how you choose what
  to animate. The Effect door, its popover and the whole-slide pick
  inside it are gone.

- [x] **T183 · S — Names that say what the buttons do.**
  *Done 2026-09-02.* **One per click** and **All on one click** (were
  One by one / All at once) under a **Whole slide** heading; **Quick
  animate** (was Set order, was Click things in order…) — the user's
  own words for it, on the ribbon, in the Layers pane and in the
  Animation order pane; **Animation order** (was Animations) for the
  button and the pane it opens, since "the animation order" is what
  the user calls that list. Tooltips shortened to one sentence each.

- [x] **T184 · M — The Layers pane is a list, and pop-ups sit on the
  right.**
  *Done 2026-09-02.* The pane's twelve tool buttons in two wrapping
  rows become three — By build, Quick animate, **Actions ▾** — and the
  other nine are rows of one menu built on open (Group, Ungroup,
  Duplicate, New folder, Out of folder; then Make component, Every
  instance, History, Where from, Match…), each keeping its function
  and its enabling rule. The per-row Duplicate went with them, which
  is what gives the object's name its room, and the default width is
  272px. A **handle down the left edge** resizes every pane — the
  native corner grip was a few grey pixels on a dark pane, and a
  docked pane grows to the LEFT, so "can't be resized" was the honest
  reading. The Order on this slide panel opens on the right: `.sh-menu`'s
  `left:0` had been winning the over-constrained box and it opened on
  the left over the slide, exactly where the screenshot showed it.
  Driven: nothing selected → five tiles disabled, label "Effect —
  select something"; select a box from the Animation tab → tab stays,
  tiles enable, Fade lights in one click; Layers → three buttons over
  the list, Actions ▾ opens ten rows with Group disabled for one
  selection; the grip drags the pane wider and the stage makes room.

The user, fourth review (2026-09-02): "the animation numbers should
appear when on the animation tab always... the whole slide options are
confusing... you can't tell which button you are on... there should be
a default thing there with time like PowerPoint has, and something like
'With previous', or 'on click' that you can swap around... where are
the things for dot points where you can have the options of animating
by sentence, dot point, etc."

- [x] **T185 · M — Timing, and how much of a text box arrives, on the
  ribbon.**
  *Done 2026-09-02.* A **Timing & text** group on the Animation tab,
  PowerPoint's Start box on the model this deck already had: **On
  click** (a stop of its own), **With previous** (the previous build's
  click — the pane's "Appear with previous"), **After previous** with a
  seconds field (T169's delay: the stop runs itself, no click — which
  until now you could only set by holding a digit in Quick animate).
  The state is read off the model, so the lit one is the truth; With
  previous is disabled on the first build because there is nothing to
  be with. The second row is T172's **Whole box / By bullet / By
  sentence**, which lived only in the order pane, shown for a text box
  with a build. Everything is disabled until a build is selected, the
  way the tiles are, and the group stands down while Quick animate has
  the row. No duration control: the entrances are fixed-length CSS
  keyframes and a per-object duration would be a model change — said
  here rather than faked.

- [x] **T186 · S — The numbers, the names, and the lit chip.**
  *Done 2026-09-02.* The build numbers show whenever the Animation tab
  is up, not only while the order pane or Quick animate is. The whole-
  slide group is headed **Everything on the slide** with **One per
  click / All together / Remove all**. Quick animate's status line
  says what to do — "next: 1 · click the next thing to appear" — and
  its chosen effect is visibly lit: the colourful theme paints every
  button three classes deep, which beat the two of `.seq-fxb.on`, so
  the pressed state is now said at five.

The user, fifth review (2026-09-02): "the insert options like text
should be like 'Effect' in the animation tab, with all the options
there... you currently can't insert text, it doesn't work... what
happened to the notebook cell option, that is gone... when drawing why
is the cancel button in the weirdest spot, have it appear in its own
section... what is the charts??? I never wanted that and it is broken.
Get rid of it... how do you even add dot points any more? Oh it is in
the Paragraph in the object thing. Please spread them out... too many
things are in buttons in buttons... do the same with the Design tab...
what is 'design tokens'?????... why does Effect have 'Select
something', that is unnecessary text lol."

- [x] **T187 · M — A group that does not fit folds into one door.**
  Spreading controls out (T189) makes the Object tab wider than any
  window, and the ladder's last rung was to clip. The rung it needed
  is PowerPoint's: a group whose row does not fit becomes ONE worded
  button, named for the group, over a popover holding its row.
  *Done 2026-09-02.* `fitEditRibbon` unfolds everything before it
  measures, runs the ladder as before, and then folds from the RIGHT
  until the bar fits — so a wider window opens the groups out again by
  itself. The real row is moved into the popover, never copied; the
  fixed groups, the Drawing group and Quick animate never fold (a
  mode's exit stays on the bar); a ribbon layout unfolds all before it
  moves an atom. Driven at 1400px with a text box selected: Animation
  folds to "Animation ▾", everything else is on the bar, and the
  popover opens the row exactly as the ribbon lays it out.

- [x] **T188 · M — Insert: the kinds of text box as tiles, Notebook
  cell by name, Cancel in its own group, no Chart.**
  *Done 2026-09-02.* The caret menu beside Text — the one control on
  Insert that hid its options — is a strip of tiles in the row: plain
  Text, then every named type in the deck, each a specimen "Aa" of
  itself, lit while armed, click again to put the tool down; a type of
  your own gets a tile the moment it exists. **Notebook cell** has its
  name back (T61's "Object" described the frame, not what people look
  for). A **Drawing** group appears only while a tool is armed: the
  mode's name over a short hint, and Cancel under them — beside
  nothing, shifting nothing. **Chart** leaves the ribbon; the feature
  keeps its right-click door on a placed table. Shape stays a drawn
  gallery behind one door, as PowerPoint's is: fifteen tiles would
  cost the tab its width for a thing you draw once.
  Text insertion itself was found working on the deployed build — a
  click makes a box and typing lands in it — but the box was BORN
  INVISIBLE: no placeholder and no panel (your own 2026-08-19 ask), so
  a fresh box was a caret and nothing else. See T191.

- [x] **T189 · S — The everyday text controls are back in the row.**
  T177 put every text control behind Font and Paragraph doors; a day
  later, "how do you even add dot points any more?... too many things
  are in buttons in buttons."
  *Done 2026-09-02.* Bold, italic, underline, the two lists and the
  three alignments (new as buttons, showing which is on) are in the
  Text group; Font ▾ keeps typeface, size and strike; Paragraph ▾ keeps
  list levels, the box indent, spacing and the curve. The room this
  costs is what T187 pays.

- [x] **T190 · S — Design: the page size as tiles; a plain name for
  the tokens.**
  *Done 2026-09-02.* The Page size menu is a strip of eight tiles, each
  drawn at its own proportion so the row reads without reading, the
  one in use lit, built from the same table the menu was. **Design
  tokens** is **Colours & spacing** on the button; the dialog keeps the
  term in its title. Layouts and Background stay as galleries behind a
  door: previews and swatches, not words.

- [x] **T191 · XS — A born-empty text box says it is there.**
  *Done 2026-09-02.* "Type…" in the box until you do; and the Effect
  and Timing labels stop instructing ("that is unnecessary text lol").

The user, sixth review (2026-09-02): "review all the things on the
tabs though. Like how things like 'standardise' works. I find the text
and how it looks confusing. Also some things need to be remembered. If
you are on insert tab, and you click on an object then unclick it
should go back to insert. When adding a new slide, when click add new
it should remember the last one you added. The default slide choice
should be the panel, title, text as well."

- [x] **T192 · XS — Deselecting takes you back to the tab you left.**
  *Done 2026-09-02.* A selection carries you to Object; when it goes,
  the ribbon went to Home. It now goes back to the tab the selection
  took you from, if that tab still has anything on it — Insert stays
  Insert. A tab you changed to on purpose while something was selected
  is where you stay.

- [x] **T193 · S — New slide takes the layout you last chose; the
  default is title, panel, text.**
  *Done 2026-09-02.* Picking a layout remembers it per project, and New
  slide applies it; a deck that has never picked one starts with
  **Title + panel + text** — the shape most slides in a talk have —
  rather than blank. Blank is one pick away. The two layouts that
  carried a title without saying so are named for everything on them:
  Title + panel + text, Title + text + panel.

- [x] **T194 · S — Plain words on the tabs, and a check that says what
  it checks.**
  A pass over every ribbon tooltip and menu row against one test: would
  a first-time reader know what happens when they press it?
  *Done 2026-09-02.* Rewritten where they would not: Tidy page,
  Standardise, Text styles, Style system, Re-apply, Masters (three
  places), Watermark, Numbers, Match slide, Review, Guides, and the
  Source rows. The Layouts menus lose their private vocabulary:
  "Arrangements…" is **My saved layouts…**, "Save this slide as an
  arrangement" is **Save this layout…**, "Give this slide's layout
  to…" is **Copy this layout to other slides…**; "Where from…" is
  **Where it came from…**. The Standardise pane opens with one line
  saying what it is — text that should look the same but does not, and
  figures placed at different sizes; each row is one thing to look at
  and its button fixes only that — and its title is the one word on
  the ribbon.


The user, seventh review (2026-09-02): "dot points a bit buggy. The
dot points appear where the dashed selection line is. Where is the
animate by dot point thing gone???? Can that be an option when clicking
on a box with dot points? This is same with things like the slide
layouts, the match slide options. Like there is so many good options
in there. This looks odd still the ribbon as well... the shapes should
be on their own. When selecting an image, the object view should on
the right have the object paths, refresh from path button, lock
option. Then where has the ability to refresh all images gone?"

- [x] **T195 · XS — The bullet marker is inside the box.**
  *Done 2026-09-02.* An outside marker sits about 1em left of its
  text; at 1.15em of padding it was drawn on the box's edge, under the
  dashed selection line. 1.7em now, 1.5em for a nested level.

- [x] **T196 · M — Home's layout system opened out; refresh-all has a
  door.**
  *Done 2026-09-02.* The Layouts dropdown held the picker, the
  auto-arrange, the ideas and the saved layouts — two-thirds of the
  system behind a word. They are groups now: **Layout**, the layouts
  as tiles drawn as themselves with the one this slide wears lit (the
  review's sweep already marked the pickers; the strip is one more of
  them); **Arrange this slide** — Layout ideas…, Tight, Normal, Airy;
  **Saved layouts** — My saved layouts…, Save this layout…, Copy this
  layout to other slides…, Masters…; and **Sources** — Update figures,
  Refresh pictures, which press the File menu rows that have always
  done this and that nobody found. Every row keeps its id and its
  wiring. The two rarer groups sit last so they fold first on a narrow
  window and the View toggles stay in sight. Design's Layouts door
  stays.

- [x] **T197 · S — Shapes on their own.**
  *Done 2026-09-02.* Fifteen tiles drawn by the same shapeIcon the
  Object tab's Shape menu uses, in a Shapes group between Write and
  Draw, the armed one lit; click it again to put the tool down. T188
  had kept them behind a door for width; group folding pays for the
  strip.

- [x] **T198 · S — Where it came from, on the row; by-bullet beside
  the effects.**
  *Done 2026-09-02.* Select a picture or a figure and the Object group
  shows **From** with the file or notebook it came from, **Refresh
  from file** (out of the Source window, where it was a row nobody
  saw), and **Lock in place** — the position lock the Layers pane's
  pin sets, as a button that shows its state. Select a text box and
  the Animation group offers **Whole box / By bullet / By sentence**
  beside the five effects; a box with no entrance yet gets a Fade
  first, so "animate by dot point" is one click.
  Driven: a bullet box, By bullet → Fade and By bullet lit; Lock in
  place → pressed; Home reads Slides | Layout | Arrange this slide |
  View | Saved layouts | Sources with the new slide's layout tile lit;
  Insert reads Place | Write | Shapes | Draw and a star tile arms the
  tool and lights.


- [x] **T200 · S — A View tab, and Ribbon layouts beside Auto-hide.**
  The user (2026-09-02): "some of the things in home shouldn't be in
  home then. Like the guides, grid, review, side toolbar, and result
  they are not really home screen things are they. New tab with these.
  Also put the ribbon layouts button on the other side with the
  autohide."
  *Done 2026-09-02.* View was folded into Home on 2026-08-20 when Home
  was thin; Home has since taken the layout system (T196), and rulers,
  the grid and guides, full screen, the side toolbar, Review, Layers
  and Notes are about looking at the page. They are a **View** tab
  between Animation and Object; a browser that remembers the old `view`
  tab lands on it. Home reads Slides | Layout | Arrange this slide |
  Saved layouts | Sources. **Ribbon layouts** moves from beside the
  tabs, where it read as a fifth tab, to the right beside Auto-hide and
  the fold, with the ribbon's other settings.


- [x] **T201 · S — Home, grouped by what you are doing.**
  The user (2026-09-02): "there needs to be a new slide with layout
  options including the saved layouts together, then there also needs
  to be the masters, and copy this to other slide, match slide, as
  one. Then the update figures, and refresh images looks kind
  confusing, and needs more attention drawn to it. There could be
  better grouping here."
  *Done 2026-09-02.* Five groups, each one job. **Slides**: New,
  Duplicate, Delete. **Layout**: the built-in layouts and the ones you
  saved are ONE strip of tiles — a saved layout is drawn by the same
  thumbnail the dialog uses and appended after the built-ins, kept in
  step whenever the store is written — with Save this layout… and My
  saved layouts… beside it. **Arrange this slide**: Layout ideas…,
  Tight, Normal, Airy. **Keep up to date**: Update figures from
  notebooks and Reload pictures from files, in words that say where
  they reach and drawn in the accent so the eye finds them. **Apply to
  other slides**: Match slide, Copy this layout to other slides…,
  Masters… — the three ways one slide's look reaches others, last so
  it folds first on a narrow window. The dialog behind My saved
  layouts… uses the ribbon's words: Saved layouts, Your saved layouts,
  Save this slide's layout, Apply it to these slides, Apply.
- [x] **T202 · M — Home by what you do, tiles that make a slide, and
  an All images pane.**
  The user (2026-09-02, on T201): "The groupings still make no sense.
  Also you can't create a new layout with the layouts there, you can
  only change the layout. Also, when I said make things more
  prominent, I didn't just mean make the buttons longer. I meant make
  them better buttons, like the animation 'effect', have them as full
  height width with better icons. Also the Masters thing is in an odd
  spot, I hate that. Also there should a global image view, that
  shows you all the images that there are and their paths, and if they
  are locked or not."
  *Done 2026-09-02.* **New slide**: the plain button, then every
  layout — built in and saved — as a tile that MAKES a slide laid out
  that way (a saved one carries its shapes onto the new slide);
  changing THIS slide's layout is Design's Layouts door, and the two
  menus still do that. **This slide**: Duplicate, Delete, Save this
  layout…, My saved layouts…. **Arrange this slide** as it was.
  **Keep up to date**: Update figures, Reload pictures and All images
  as three tall tiles the shape of the effect tiles, a bigger icon
  over the words, in the accent. **Apply to other slides**: Match
  slide and Copy this layout to other slides…; Masters left Home for
  good — Design has it twice, on Page furniture and in its Layouts
  menu. The **All images** pane lists every picture and figure across
  the deck: slide, kind, where it came from (a picture's file or
  "pasted or dropped", a figure's notebook), and its lock, toggled
  from the row; a row goes to the thing and selects it. Rendered on
  open and on its Read again button, never from markDirty.
- [x] **T203 · S — The strip frame, and an empty text box that stays.**
  The user (2026-09-02): "When a text box has no text, when you click
  object it disappears. Text boxes with no text should still be there.
  The side scrolling bars are good, but the ends kind of just
  disappear and looks odd, maybe they need a line on the other side or
  a box around the whole thing. The horizontal scroll bar is too small
  and overlaps with them. There needs to be an arrow or something
  below, that when you click you can see all options."
  *Done 2026-09-02.* Every tile strip (layouts, effects, text kinds,
  shapes, page sizes) sits in a **frame**: a border round the whole
  thing, a scrollbar you can see that sits under the tiles rather than
  on them, and a chevron at the right end. The chevron opens a window
  under the strip with **every tile at once**, wrapped — the strip
  element itself is moved into the window so each tile keeps its
  wiring, and moved home when the window closes; picking a tile closes
  it, the way a gallery does. The frame carries the id the ribbon
  layouts move, so strip and door travel as one. An **empty text box**
  no longer vanishes when you click away: the "Type…" placeholder no
  longer waits for the caret, and a box with nothing in it wears a
  faint dashed edge until it has words.
- [x] **T204 · M — Layout lives on Design; Home is three things; images
  per slide, and all of them full screen.**
  The user (2026-09-02): "the Design page should include all the
  layout stuff I reckon. The arrange this slide, the save layout, and
  layouts, and the match slide, and copy layout to slides should all
  be on design tab. Oh there is already a layouts on the design. I
  think this is getting confusing all the parts everywhere. Need to
  think about this properly. The standardise thing under type is
  confusing as well. Like I know what it is, but other people won't."
  On the images pane: "I like this small view. However, I reckon there
  needs to be a full screen version of this as well. And also don't
  have Slide 1. Picture. Have headings that are collapsible for all
  slides. The all images thing should just be per slide." And: "put
  the new slide on the left hand side and make it a full button."
  *Done 2026-09-02.* The rule: **one subject, one place, one name.**
  **Design ▸ Layout** is everything you do to this slide's layout:
  Change layout ▾ (the grid alone — its rows are gone), Layout ideas…,
  Tight/Normal/Airy, Save layout…, Saved layouts…. **Design ▸ Apply to
  other slides**: Match slide ▾, Copy layout to slides…. Masters stays
  on Page furniture, its only door. **Home** is three things: New
  slide — a tall tile at the left, then the layout tiles that add one
  laid out another way — This slide (Duplicate, Delete), Keep up to
  date. **Standardise** became **Fix mismatched text…**, and its pane
  is headed Mismatched text. The images pane is **Images on this
  slide** — rows say Picture or Figure, no slide number — with an
  **Every slide** door to a full-screen **All images** view: one
  heading per slide that has any, each folding on a click, Open all /
  Fold all, the same rows bigger; a row selects the thing and closes
  the view.
- [x] **T205 · S — One visual system on the ribbon.**
  The user (2026-09-02, three tabs screenshotted): "these aren't
  really working. This is just chaos. Buttons of all shapes and sizes
  and configurations all over the place."
  *Done 2026-09-02.* The structure was settled; the faces were not.
  **One tile**: every tall control — an effect, a layout, a shape, a
  kind of text, a page size, New slide, the Keep up to date doors — is
  72 wide with a 22px icon, and 56 tall whether it stands alone or sits
  in a frame over its scrollbar; the tinted "big" face is gone, the
  tall shape is the emphasis. **One pressed colour**: a lit control
  takes the deep accent it inherits, cyan in the default theme and the
  tab's own hue in the colourful one, instead of cyan in every tab.
  **Every small button has an icon**: Tight, Normal and Airy were the
  three that did not. **One hue per tab** in the colourful theme, read
  from data-tab rather than a hand-kept list of group classes, so a tab
  is one colour and a group that moves tabs changes with its new home.
- [x] **T206 · S — A newer build announces itself.**
  Three times on 2026-09-02 the user reviewed a screenshot of a build
  several deploys old ("still looking off... why is the view button so
  small... I hate the sources being a menu" — a Home tab with no View
  tab and Sources folded, five pushes behind) believing nothing had
  changed. The cause is the offline app working as designed: the
  service worker caches everything, so the first visit after a deploy
  boots the PREVIOUS build from cache while the new worker installs and
  takes over, and nothing said so.
  *Done 2026-09-02.* When a new worker takes control of a page that
  already had one, the loader raises a bar — "A newer Junoview just
  arrived. This page is still the previous one." — with Reload and
  Later; app.js raises it again on the app page the loader writes over.
  The build is stamped into the page (`<meta name="junoview-build">`
  and `window.__jvBuild`, the package hash the worker's cache is keyed
  by) so a screenshot can say which build it is. A first install shows
  nothing: there is no older page to replace.
- [x] **T207 · L — The ribbon the PowerPoint way.**
  The user (2026-09-02, six tabs screenshotted beside PowerPoint's):
  "Bit messy with the bottom scroll bar. Put all the buttons that are
  buttons together. Then the different text types are kind of weird...
  buttons in buttons that are confusing and do nothing... Look at
  PowerPoint, look at how much better that looks... Why do objects not
  have an x-y position and also not a width and height... Options in
  options is shit and can't be clicked."
  *Done 2026-09-03.* **Galleries**: one row of whole tiles in sight,
  the rest wrapped beneath, an up / down / show-all column at the
  right, no scrollbar anywhere; a strip is a whole number of tiles
  wide. **The grid is column-major**: two controls to a column, a tall
  one spanning both rows, so the two that share a column share a width
  and nothing else does (a row-major grid had made "U" the width of
  "Paragraph"). **Flat at rest**: no border and no fill on any ribbon
  button until you reach for it; pressed is the deep accent; a gallery
  keeps its frame. **Menus nest**: the overlay owner keeps a stack, so
  Background inside the folded Slide popover, or a colour inside the
  Font window, opens instead of closing its parent; an outside click
  closes only what it was outside of; Escape peels one layer. **One
  Text box tile** on Insert — the kind of text is the Object tab's
  Styles door once the box exists. **X, Y, W, H** typed straight in on
  the Object tab, live with the pane's fields. **Tooltips** are a plain
  bubble that waits half a second, not a bordered box that read as a
  second button under the row.
- [x] **T208 · M — The Object tab paired on purpose; tooltips in plain
  words; the Palette.**
  The user (2026-09-02): "buttons in buttons that are confusing and do
  nothing... What does 'colours and spacing' do? I have tried to figure
  this out so many times, the description makes no sense either...
  cool features hidden under buttons in stupid places and stupid
  names."
  *Done 2026-09-03.* Every Object-tab group's markup is ordered for the
  column-major grid: Duplicate over Arrange, Bring to front over Send to
  back, Group over Ungroup; text colour over fill; Font over Styles,
  then **B I U** and **Left Centre Right** as two segmented runs, bullets
  over numbers, Paragraph; Lock in place over Keep shape, X Y over W H,
  Crop over Caption. A run whose every button is hidden takes no
  column. An audit of all 257 tooltips in the markup and 236 in the
  scripts found one carrying a maintenance note, six over 160
  characters, five naming controls that no longer exist ("the print
  check", "Set order", "One by one", "Saved to") and three ribbon
  buttons with none; all rewritten, and a test now refuses dates,
  ticket codes and "used to" in any tooltip. **Colours & spacing** is
  the **Palette…**, and its tooltip says what a named colour is and how
  to give a box one; the picker sits on the overlay stack so Escape and
  an outside click close it like every other menu.
- [x] **T209 · M — Mismatched text, Tidy page and Layout ideas open
  full screen.**
  The user (2026-09-02): "This mismatched text thing is a good idea,
  but horrible execution. It is so small in the side bar. Some of
  these things should not be sidebars but should always open as full
  screen and also need to be proper buttons." And a screenshot of the
  Layout ideas popover overflowing its own heading under an open menu.
  *Done 2026-09-03.* **Mismatched text** and **Tidy page** open as
  full-screen views under the same header the All images view has: a
  one-line intro, a count, Check again, Close; the same cards the
  panes drew, in a grid with room to read them. A slide chip goes to
  the slide and closes the view so you see where it took you; a fix
  redraws the view. The renderers take their target, so the panes are
  still there for the pane owner and the tests, but every door opens
  the view. **Layout ideas** is full screen too, its cards a third of
  the window wide, with a header and Close, on the overlay stack like
  everything else so Escape and an outside click behave the same way.
- [x] **T210 · S — Every sentence names controls by their current
  names.**
  *Done 2026-09-03.* A sweep for the names retired across T176–T209
  found them alive in sentences: the Review centre's rows still said
  "Open the print check" and "Open Standardise", a ribbon layout's
  blurb "the print check", three save toasts and a tooltip "Saved to"
  (a switch that became the chevron beside Save), the Deck swatch's
  tooltip and the help page "Colours & spacing", the help page
  "Standardise text". All say Review, Mismatched text, Palette and
  "the ▾ beside Save" now, and a test refuses the old names.
- [x] **T211 · S — The Masters panel closes like every other menu.**
  *Done 2026-09-03.* It was appended to the body with its own Escape
  listener and no outside-click dismissal, so it sat under the editor's
  layer and only its ✕ closed it. It opens on the overlay stack inside
  the editor now: Escape peels it, an outside click closes it, the door
  toggles it.
- [x] **T212 · M — What the adversarial check found still wrong.**
  Three checkers read the current files against every complaint in the
  2026-09-02 brief and a refuter tried to knock each finding down.
  *Done 2026-09-03.* What stood, and is fixed: three groups still made
  bad vertical pairs (Design › Slide had Tidy page and Background each
  over an empty cell either side of the page strip; Page furniture
  split Header from Footer; the Object tab's Animation group put Grow
  over Whole box) — reordered, and the by-bullet trio is one run. The
  Size & position door stayed on the ribbon beside the X Y W H fields
  it duplicated — retired. The two colour doors were bare buttons and
  stayed boxed; the light theme boxed every Object-tab button — both
  flat now, and Finish keeps its fill. The pre-T207 scrollbar rules
  were still shipped and won or lost on cascade order alone — deleted;
  the Change layout gallery still scrolled with a scrollbar and
  third-size tiles — the one tile, wrapped. Nine ribbon buttons had no
  icon (Left, Centre, Right, the two lists, the four table buttons) and
  the Quick animate effect rows had none — drawn. The Palette tooltip
  T208 wrote was 249 characters; it and two others are under the cap,
  and the test now enforces 160. Keep shape is Lock aspect ratio,
  Masters is Slide master…, the spacing trio wears a Spacing caption,
  Style system… is a button of its own on Design, the help page says
  Layers, Paragraph and Review. Every ribbon layout named `page-drop`,
  an id gone since T190, so every non-default layout silently lost the
  page sizes — fixed, and a test now checks every id a layout names.
- [x] **T213 · M — Every remaining private menu joins the overlay
  stack.**
  *Done 2026-09-03.* The Text and Fill swatch menus, the Fill style
  menu, the Styles menu, the custom colour popup, the object-source
  menu, the Match slide menu, the select-by menu, the component
  instance and match-props menus and the ribbon customise menu each
  had a private toggle and a one-shot outside-click closer of their
  own, so Escape never reached them, none closed another, and the
  custom colour popup closed the Fill menu under it on the first click
  inside. All go through `overlayShow`/`overlayHide` now, mounted
  inside the editor's layer by one helper, so a menu opened from
  inside another keeps its parent and Escape peels one layer.
- [x] **T214 · S — Before you print opens full screen.**
  *Done 2026-09-03.* The third card list of the same shape, and the
  last still a 272px pane: a full-screen view with intro, count, Check
  again, Close, a row selecting the thing and closing the view; a door
  of its own on View beside Review, and the Review centre's row says
  "Open Before you print" for the view it opens.
- [x] **T215 · M — The morning review: orders, names, the Masters
  panel, room to read.**
  The user (2026-09-03, on a big screen): "some of the text is maybe
  too small now... tight, normal, airy are all on different columns
  and empty below. Also the tidy page is weirdly by itself. Perhaps the
  slide stuff should be first as well. The masters box is already
  really weird... the timing should go next to the effect. Also the
  button 'animation order' should be called 'animation pane'... In
  page furniture 'numbers' should be 'page numbers'. I still don't get
  what the Palette button is for, and don't know why it has an
  ellipsis."
  *Done 2026-09-03.* Design leads with the page itself (page size,
  Background); Tidy page moved into Layout under the Spacing run, the
  two arrange-what-is-here verbs sharing a column. Animation reads
  Effect, Timing, Everything on the slide, Order. Page numbers;
  Animation pane (button and pane). The Masters panel had inherited
  the menu grid and spread its one sentence over three columns: a
  block panel, 320px, anchored right, readable. Palette… is **Deck
  colours ▾**, a door with a chevron like Background, and both its
  tooltip and the panel say in one breath what a shared colour is and
  how a box gets one. On screens 1600px and wider the ribbon's words
  grow a step.
- [x] **T216 · M — A Present tab; Full screen up top; Layers on
  Home.**
  The user (2026-09-03): "The layers is really important that needs to
  go in home, and the full screen needs to go up the top where present
  is. Present also needs its own tab with all those options as buttons
  now."
  *Done 2026-09-03.* A **Present** tab: Play (From this slide, From the
  start, Presenter view as tiles) and During the talk (Talk settings…,
  Notes & timing…, Click to enlarge figures, Code trail). Every button
  presses the Present menu's row of the same name, and the two toggles
  read their state off the row's words, so nothing is decided twice.
  **Full screen** sits in the top bar beside Present and no longer
  folds with View. **Layers** is a tile on Home in a Show group, a
  second door to the pane View has, its pressed state mirrored.
- [x] **T217 · S — Mismatched text in plain words; the Style system
  readable.**
  The user (2026-09-03): "the fix mismatched text is good I think, but
  I am really confused by it... Style system... a lot of the text can't
  be read under this."
  *Done 2026-09-03.* The view's intro says what the check is for
  ("boxes that look alike should share a named style, so changing them
  later is one edit"); a card says "N boxes at about X pt, no named
  style yet" or "N of M Heading boxes no longer match the style"; its
  button says "Give all N the Heading 1 style" or "Put the Heading
  style back on these N", and the alternative "Just make them match, no
  style". The Style system's rail drew each name in the style's own
  colour, which could be the page's ink and vanish on the chrome: names
  now use the rail's ink and keep weight, italic and size; the specimen
  sits on the deck's actual page colour; the small labels are a size up.
- [x] **T218 · M — A folded group is a tall tile; the Timing row is
  full; a layout tile chooses, New slide adds.**
  The user (2026-09-03, screenshots at a 1300px window): "Same
  goofiness with buttons still exists. Also the new slide is confusing
  with the types next to it. The types of slide being selected should
  be highlighted, and clicking on one just highlights it to be added
  when clicking new slide."
  *Done 2026-09-03.* **Folded groups**: at that width Design folds
  four of its five groups, and a folded group had been a small one-row
  button with a hole under it. It is a tall tile now, the group's own
  icon over its name and a chevron — the shape PowerPoint collapses a
  group into and the one tile every other tall control is. Every group
  names its icon. **Timing**: the delay field left the start run for a
  cell of its own beneath it, so the group is two rows deep whatever
  is selected. **New slide**: a layout tile no longer makes a slide; it
  is HIGHLIGHTED as the layout the next New slide will use (a saved
  layout too), and New slide adds a slide laid out that way. The strip
  lights the chosen layout, not the one the current slide wears.

- [x] **T219 · M — A button looks like a button; a run is one box; the
  words can be read; a dialog says what it is for.**
  The user (2026-09-03, the Design tab and the Saved layouts dialog):
  "all the buttons still look really weird, and are all over the place.
  Like the spacing stuff is weird, why is that word where it is? Also
  the words like 'Slide', 'Layout' and all that are tiny down the
  bottom. Also, like all of the pop up menus are god awful... This is
  the most unclear thing ever and I cannot tell what is going on...
  They are all just floating text with icons. This is a mess to look
  at."
  *Done 2026-09-03.* **The surface**: T207 had made every ribbon
  control flat at rest, the way PowerPoint's are; on a ribbon whose
  icons are small and one colour that read as loose words. Every
  control has a surface again, and ONE surface — the same fill,
  hairline and 6px corner from three variables set once on the ribbon
  (once more for the light theme), at one height per kind. What had
  made boxes chaos before T207 was that they came in every size; the
  sizes were settled in T205-T218, so the box could come back.
  **Runs**: Spacing | Tight | Normal | Airy is one box, the caption its
  first segment, the buttons divided by a hairline — the word and the
  choices it names are visibly one control (a three-column grid had put
  the caption in a column of its own and wrapped Airy under it). The
  same for the start run, the by-bullet runs, B I U and the alignments.
  **Words**: the ribbon is set in the sans, 12px on a button, 11px on a
  tile, 11.5px for a group's name (8.5px spaced capitals before), 13px
  on a tab, with a half step up on a wide screen. **The ladder trades
  space, never type**: the density rungs had shrunk the words to
  10.5px, and were doing so on a 1800px monitor, which is how the
  words were "tiny" with room to spare; every rung keeps its padding
  and gap steps and has lost its font-size step, and folding (a tall
  tile since T218) takes it from there, the way PowerPoint collapses
  a group rather than shrink its words. Measured: at 1800 Design folds
  Type alone; at 1400 it folds three, and the Object tab with a text
  box selected folds Animation alone. Menu headings, dialog titles and
  column headings are sentence-case words at three sizes. **Saved layouts**: one sentence at the top says what
  a saved layout is; the halves are "1. Layouts you have saved" and
  "2. Slides that will take one"; Save this slide's layout is a real
  button under the library; Tick all / Untick all; the empty states
  and the count in plain words.


- [x] **T220 - Nothing that matters sits behind two clicks: the Object
  tab sheds its second Animation, Insert becomes Images and Text.**
  The user (2026-09-03): "Getting rid of the animations from the object
  page would be good. This only needs to go on animations. This would
  allow things like the text size to be actually always visible as it
  should be. That should not be behind two clicks. Please think about
  things like that... there should be a 'history of object' button...
  Oh that is in the layers, there is too much hidden inside menus
  inside menus inside menus inside menus, like in the layers. PLEASE
  FUCKING STOP DOING THIS... Why does the text colour look like a T? I
  would prefer if some of these were quick options that we can see...
  What happened to being able to insert text boxes by type. Please get
  rid of QR code... Let's split Insert into Images and Text."
  *Done 2026-09-03.* **What paid for it**: T179 had put a second copy
  of the Animation tab on the Object tab -- five effect buttons and the
  by-bullet trio. It is gone; an entrance is the Animation tab's job.
  **On the row now**: the typeface, the size (one segmented cell
  holding the number, its unit and the two steppers) and line spacing,
  all of which were one click into a window; strikethrough joined B I U
  as a fourth segment, so the Font window had nothing left and was
  deleted. **Quick colours**: the deck's six colours sit in the row as
  two runs, words and box, storing the reference so a deck that
  changes its colours changes these; both doors stay for the rest.
  **The T**: the swatch popup was swept in with the drawn line-style
  menu, whose rule stacks rows in a column -- with the deck row across
  the top and every preset chip in a column beneath it, the popup was
  literally T-shaped. It lays out as a pad now. **History**: the
  per-object history has existed since T10 and could only be reached
  from a canvas right-click or from a popover inside the Layers pane.
  It is a button on the Object tab, opening the full-screen view the
  other reviews use; one renderer serves the pane and the view, and an
  edit redraws whichever is open. **Insert split**: Images keeps
  Notebook cell, Image, Flip book, the shapes gallery, Line, Arrow and
  Draw; Text gets the boxes, Table, Equation and Markdown. The Drawing
  group follows whichever half armed the tool. A browser that remembers
  `insert` lands on Images. **Text boxes by type**: T207 had collapsed
  them to one tile for width; Text is its own tab now, so there is a
  tile per named kind again, in a frame with the usual arrows. **QR**:
  removed whole -- door, handler, the ~240-line encoder and its icon --
  rather than left as a capability with no door. Existing decks are
  unaffected: a QR was inserted as an ordinary image.
  *The bug this round shipped and the browser caught:* moving spacing
  out of the Paragraph window left that window looking empty to
  `syncOptDoors`, which hides a door over an empty window -- so the
  Paragraph door vanished for every text box, with 1,100 substring
  tests green. A window that fills itself on open now says so
  (`data-built`).

- [x] **T221 - Font and Paragraph; the deck's type joins Text; the
  popover that would not go.**
  The user (2026-09-03, four screenshots): "With the Text [tab] I mean a
  lot of other things in there as well: text styles, deck colours, style
  system, find mismatched text. All of these are text related... why is
  the background button so weird. Gross. Please move the slides button
  to view, that is a view. That layout looks hectic, why is tidy page
  huge? ... This box from the layers can never be removed... The object
  menu still looks horrible... what is the difference between text and
  deck? ... There should be a text style (e.g. colour, fill, font, font
  size), then a text idk something else that has the (list, paragraph
  left, spacing). Why does the button with A- also have the word
  smaller. That is weird. Why is the strike through button huge. The
  transparent isn't labelled and is just a weird little thing to drag.
  This history button is so small."
  *Done 2026-09-03.* **The Object tab** is Font then Paragraph, split
  the way the user described it: how the letters look (typeface, size,
  B I U S, Styles, the two colour doors and their quick swatches), then
  how the block is set (lists, alignment, Spacing, Paragraph). The
  Colour group is gone as a separate thing; a colour is how the letters
  look. **The deck's type** -- Text styles, Deck colours, Style system,
  Fix mismatched text -- left Design for the Text tab, under the heading
  "The whole deck". **Design**: Background is a tall tile beside the
  page sizes rather than a half-height button alone over an empty cell;
  the page-strip toggle went back to View, where a thing that opens and
  closes a strip in the window belongs. **A cell is its own width**: the
  grid stretched every cell to its column, which is why Tidy page was
  drawn the width of Spacing | Tight | Normal | Airy. Cells start-align
  now, as PowerPoint's do. **The small things**: A- and A+ lost the
  words the user called weird; B I U S are four segments of one width;
  opacity wears the caption "Opacity"; History is a tall tile, and it
  sits in Arrange rather than Object because Object folds first on a
  laptop and a folded History is worse than a small one. **The colour
  popup** heads its rows "This deck's colours" and "Standard colours"
  instead of "Deck" and "Text", which read as a difference in what they
  colour.
  *The second shipped bug the browser caught:* the Layers pane's Actions
  popover was appended to `document.body` and anchored to a button the
  pane destroys on every rebuild, and the pane's own buttons stop
  propagation before the overlay owner's outside-click listener sees
  them -- so pressing By build left it standing over the canvas with no
  way back. It mounts inside the editor now, and the pane closes it
  before it destroys the button it hangs from. Driven before and after.

- [x] **T222 - Two symbols, two buttons, and whether you are running
  late.**
  The user (2026-09-03): "Presentation mode: the running late [thing]
  should be in the presentation view... Notes and timing should be two
  different buttons. Layers and images button uses same symbol... I
  said style system should be its own button." Also asked what had
  happened to the per-image lock and to a figure's provenance.
  *Done 2026-09-03.* **Symbols**: Images wore the Layers icon; it has
  its own now, and the rule was generalised -- within one ribbon group,
  two buttons you can see at once must not share an icon. Six pairs
  broke it (Text styles / Style system, Spacing / Paragraph, Change
  layout / Layout ideas, Check / Before you print, Reload pictures /
  Images, Duplicate / Same size); each got its own. The Table group's
  +/- pairs are exempt: Add row and Add column share a plus and are
  told apart by their words. **Notes and Timing** are two buttons. They
  open the same pane on different tabs, which is what the pane has been
  built to do since T29 and nothing pointed at. **Running late**: the
  presenter bar showed the clock and how much of the slot was left, but
  never whether you are behind FOR THE SLIDE YOU ARE ON. It now reads
  "on time", "2:10 behind" or "1:30 ahead", coloured, against
  planned-so-far -- the sum of the per-slide targets up to here, or the
  slot shared out evenly when no targets are set. **Style system** had
  two doors, a row inside the Text styles window and a ribbon button
  that forwarded its click to that row. The row is gone and the button
  carries the handler. **The lock and the provenance** are both still
  there -- the lock on every row of the All images pane and its
  full-screen view, the provenance at Where it came from -- and are now
  pinned so they cannot quietly go. There is no git information
  captured anywhere in junoview today; that would be new work, not a
  restoration.

- [x] **T223 - A text style says everything.**
  The user (2026-09-03): "In the text styles, you can only change size
  and bold and stuff. I said I wanted also colours of text, background
  colour, box border colour, font style. I said I wanted everything."
  And of the Style system screen: "why doesn't it show the x and y
  position as well, and then things like the size... The button says
  'put all 8 of them there', what the heck. Do you think about writing?
  'Apply to all'."
  *Done 2026-09-03.* **One vocabulary**: a style's fields were written
  out by hand in SIX places and had already drifted -- addCustomType
  dropped `head`, so a style based on Heading 2 was not a heading, and
  "save this deck's type as a set" saved no colours. They all read one
  `STYLE_FIELDS` list now, which is why adding two fields was two lines
  rather than six. **Two new fields**: `bg`, the colour behind the
  words, and `bdc`, the colour of the box's edge. Both take a colour or
  the string 'none' -- 'none' is a real answer and different from not
  having said anything, so neither is absent-or-set. A text box draws
  the edge it is given, over the transparent edge a background sets.
  **Both editors** -- the inline one in the Text styles window and the
  Style system screen -- offer the whole vocabulary: the typeface, and
  Words, Behind and Edge with a None for the last two. Neither is
  allowed to be the poorer one. **Numbers**: the screen shows X, Y and
  Width as typed percentages beside the drag board. Dragging sets it
  roughly; typing is the only way to make two decks agree. **Wording**:
  the button says "Apply to all 8 boxes".

- [x] **T224 - Every box of a kind, in a table you can pull into line.**
  The user (2026-09-03, of the Style system screen): "I wanted more
  than just titles, also images etc. Also clicking one of the slides
  down the bottom takes you to the slide, it should just select it and
  bring up the types of objects... There should be unselect all, and
  select all button... Would be good if there was also a table of them
  all to the right, which has things like colour, font etc. of them all
  and you can make them all match, or change them individually here, or
  change title colours in a range... you click a bunch and they get
  selected, then you click a button that says 'match style of', then
  click one and they all match to that. And you can choose as well what
  gets matched, whether it's all, or just position, or colour, or font
  etc. Do you get the point of this? So it is hard to make things match
  across slides, so this will help with this."
  *Done 2026-09-03.* The screen knew how to change what a KIND looks
  like. It could not do the thing the ask is about: see the boxes
  themselves side by side and pull the odd one into line. **The table**
  is one row per box, wherever it is -- slide, what it is, X, Y, W, and
  for text its size, face and two colours. They are the real annots, so
  a number typed here is the number the canvas renders. **Ticks**, with
  Select all and Unselect all, and a count. **Match style of** arms,
  then a click on any row makes every ticked box follow it; the chooser
  says what travels -- everything, only where it sits, only how big it
  is, only its colours, only its type -- and "everything" is the union
  of the others, so the two cannot drift apart. **The rail** lists
  objects as well as text styles: text boxes (all of them, whatever
  style, which is where an unstyled box finally shows up), figures,
  pictures, shapes, tables, flip books, arrows and lines. **The strip**
  no longer walks you out of the screen: a slide narrows the table to
  it, an object in it ticks that object, and an object of another kind
  switches the rail to its kind. The outline sheet was lifted out of
  dgBody so both views can show it. Driven on a three-box deck: ticking
  two rows and matching them to the third moved all three to the same
  X, Y, W and size, and the thumbnails followed.

- [x] **T225 - A checkpoint you take on purpose, and one that
  survives.**
  The user (2026-09-03): "Also there should be version of presentations
  where you can save a checkpoint then go back, or then go into a new
  branch. I think this is a thing with posters, but needs to be here as
  well."
  *Done 2026-09-03.* Most of this already existed and was invisible:
  the branching version tree has been here since T90, and the poster's
  Versions is a different feature entirely. What was missing is the
  deliberate part. Every snapshot was a side-effect of opening, saving
  or restoring; none had a name you chose; and the keep-the-newest-
  twenty rule dropped them in arrival order, so the version you
  actually cared about was the one most likely to go. A checkpoint is
  now a snapshot with a name and a mark: it is taken even when nothing
  has changed, because you are marking the MOMENT rather than the
  content, and eviction only ever considers unmarked ones. Two doors,
  both reaching the same gesture -- a File row beside the History it
  lands in, and a button in the history screen. Going back to one and
  branching from one are the buttons that were already there.

- [x] **T226 - Layouts of your own.**
  The user (2026-09-03): "It would be great if people could make their
  own slide layouts."
  *Done 2026-09-03.* Two things existed and neither was this. The
  built-in catalogue is a fixed table in the source; "Save this slide's
  layout" records an ARRANGEMENT of a slide you already made, which is
  the right tool when the slide exists and the wrong one when it does
  not -- you could not design a shape and then fill it. **The builder**
  is a new fragment, `52-layout-builder.js`: a page-shaped board, four
  kinds of slot (Title, Heading, Body text, Figure panel), drag to move
  and a grip to resize, the same X/Y/W/H numbers the Style system
  screen has, and a name. What comes out is an entry in exactly the
  shape LAYOUTS uses, kept on the deck as `pres.layouts`. From there it
  is a layout in every sense: `allLayouts()` is the built-ins plus
  yours, so applyLayout stamps it, the picker draws its thumbnail with
  the same layIcon, Change layout offers it and New slide remembers it.
  There is no second code path; the catalogue simply got longer and
  part of it is yours. Existing ones can be edited or deleted, and a
  slide already laid out that way keeps its boxes.
  *The bug class the parity test caught:* a deck key the browser keeps
  and the Python rebuild sheds works perfectly until the deck is saved
  to the project and reopened. `layouts` is carried by both
  normalisers now, with a sentinel, like `types` before it.

- [x] **T227 - Kinds of bullet, kinds of numbering.**
  The user (2026-09-03): "There are no different types of bullet points,
  and different lists."
  *Done 2026-09-03.* There were two: a filled disc and 1. 2. 3. The
  machinery never needed more than a word -- `a.list` holds the style
  NAME, the rendered element carries it as a class, and the content is
  only the items -- so each kind is one table entry and one CSS rule.
  Six bullets (dot, ring, square, dash, arrow, tick) and six numberings
  (1. 2. 3., 1) 2) 3), a. b. c., A. B. C., i. ii. iii., I. II. III.).
  A closing bracket is the one shape `list-style-type` cannot say, so
  that one is a `::marker` rule. Each button is a split control: it
  turns the list on with the kind you last chose, and its caret opens a
  gallery where every kind is drawn as three lines with its own marker,
  from the same table the renderer reads. The families keep their old
  defaults, so every deck written before this looks exactly as it did.
  *The latent bug this fixed:* switching bullets to numbering ran the
  content through `contentLines`, which flattens every nested level --
  a two-level list came back as one. Both being lists, only the word
  changes now.
  *The bug the browser caught:* a split wrapper that is not in the
  governed list gets its caret hidden by the deselect sweep, and a
  hidden caret takes the whole control down through the
  `:has(>.dbtn[hidden])` rule. Green in every substring test; invisible
  in the ribbon.

- [x] **T228/T229 - The strip stops fighting you; the history reads as
  a table; clones and optional slides get doors.**
  The user (2026-09-03, two screenshots of the strip): "I don't know why
  the thumbnails only view for a slide has the title still, also when
  you hover over a slide it brings up all the options around moving and
  duplicating. These are not needed here as you can just do that with
  other buttons or click and drag and just make it really hard to
  actually click on a slide. Also the slide numbers are way too small...
  The history is kind of weird. Make it when a list that are all rows,
  and columns are some of the info. 'Put it back to this' should be
  revert lol. Then there should be a preview if it is small, says a
  shape, or a preview button if it is something large like a table...
  Put the notes with the home next to layers. I like the notes. Also
  make the time not just in 30 second intervals, but can be seconds and
  minutes... Where is the clone object features as well and then the
  ability to see the clones... How are slides made optional? The click
  to enlarge figures should work on pictures as well."
  *Done 2026-09-03.* **The strip**: no controls on a slide row. Four
  buttons appeared over every thumbnail on hover, on top of the thing
  you were trying to click; reordering is the drag the row already is,
  Duplicate and Delete are on Home, and the right-click menu keeps all
  of them -- move and rename included, which only the hover row had.
  Thumbnails view shows thumbnails: the title was printed beside every
  one, which is what "Thumbnails and headings" is for. Slide numbers go
  from 9.5px mono to 12.5px. **Notes** is a tile on Home beside Layers,
  because it is a thing you write while building. **Optional** is a
  button in This slide; it had been a row in a right-click menu, which
  is why the user had to ask how. **A target in seconds**: minutes and
  seconds are two boxes writing the one stored number, which is still
  minutes, so every deck already written reads back unchanged.
  **History** is four columns -- when, what changed, what it looked
  like, and Revert. A small object draws its schematic in the row; a
  table, figure, flip book or chart gets a Preview button that opens a
  bigger one, because a 38px schematic of a table says nothing.
  **Clones**: Make clones and Its clones (N) are buttons on the Object
  tab, calling exactly what the Layers pane's Actions rows called.
  *On tap-to-enlarge:* driven live, it works, and it works on pictures
  -- the handler claims any `.an-item`. What looks broken is the
  geometry: an object that already spans the slide cannot be made
  bigger, so the spotlight dims the room and appears to do nothing.
  Left as it is; the rule that it never shrinks a figure is the older
  and better one.

- [x] **T230 - The Style system screen reads as one thing.**
  The user (2026-09-03): "would be good to edit the text in here as
  well, and maybe the x, y, w and size boxes are too big? The slide
  thumbnails should be down the side as that's the way people are used
  to viewing them. This text is hard to view... all the text is a bit
  confusing here. There is text of heaps of different sizes and
  different width everywhere, and the buttons are a bit crammed. There
  is a lot of things again that feel like they are floating in no
  where." And, mid-round: "when selecting the slide thumbnails on this
  view it would be good if they stayed selected and became cumulative
  and that fed into things like the table. And the view of the slide
  thing... right now it shows you the masters, but there can be
  individuals. Would be good if you could see not just the master, but
  location of all individual headings, then you can also tick a box
  that show 'all other items', so you know if your heading is going to
  overlap with something (should be a colour for every different thing,
  but the one in question glows and has a thicker border)."
  *Done 2026-09-03.* **The slides went down the side**, one column
  wide enough to read, in a third pane of the screen rather than a
  four-across grid at the bottom of the body. **The type**: the section
  headings were 10px spaced capitals -- the thing the ribbon gave up in
  T219 -- with three other sizes stacked under them; they are 15px
  sentence-case sans now, and the rail's counts match the rest.
  **Clusters**: thirteen controls sat in one wrap with nothing saying
  which belonged with which. They are five captioned boxes -- Size,
  Weight, Alignment, Typeface, Colours -- plus Reset, and the three
  numbers under the board are a captioned group rather than fields
  floating under a picture. **The board shows the real boxes**: the
  dragged rectangle is still the default the style stamps, thicker and
  glowing, and behind it sits every box that actually wears the style;
  a tick draws everything else too, one colour per kind with a key. So
  "will my heading land on the figure" is answered by looking rather
  than by pressing the button and undoing it. **The slide picks are a
  set** and they accumulate; the table and the board both narrow to
  them. **The table** names its first column Text and lets you type in
  it for a plain text box -- a list keeps its label, because a one-line
  input cannot say what a three-level list is -- and its number boxes
  are narrower.

- [x] **T231 - Select all on the slide column, and Apply follows the
  selection.**
  The user (2026-09-03): "The thumbnails need a select all and an
  unselect all as well. The apply to x boxes, should just be for the
  selection."
  *Done 2026-09-03.* The slide column picks slides, so it has the same
  two buttons the table has, and a line saying how many are picked --
  "none picked, everything counts" when there are none. Select all
  takes the slides the column is actually showing, which is what its
  own scope select already decides. **Apply**: by T230 there were three
  answers to "which slides" -- a scope selector of its own, the ticked
  rows in the table, and the picked slides -- and only the first of
  them did anything. The selector is gone, and its state with it; the
  button reads the selection in the order you would say it aloud: the
  boxes you ticked, or failing that the slides you picked, or failing
  that all of them. It says which it means: "Apply to 3 ticked boxes",
  "Apply to 8 boxes on the 2 slides you picked", "Apply to all 13
  boxes". Driven live through all three.

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

- [x] **T232 - One colour door, and a quick row that is your own
  history.**
  The user (2026-09-04): "The colours is confusing how there is you can
  still click on the drop down menu and then there is also the quick
  colour list. When clicking the dropdown menu there should be the
  transparency adjustor there and all the custom colour stuff that
  shouldn't be behind another menu. The quick colour list should also
  be the last colours used. Both the background and the text should
  have transparency options as well."
  *Done 2026-09-04.* **The picker is the bottom of the menu.** It was a
  popup opened by a rainbow "+" chip inside the menu -- a menu inside a
  menu -- so hex, rgb and how see-through a thing is were two clicks in
  and neither door had them. The one `#color-pop` is now mounted into
  whichever colour door is opening and taken back out when it closes,
  so both doors carry the transparency slider and the line panel's
  floating use of the same element still works. The two "+" chips are
  gone: they opened the thing already on the screen. **The quick row is
  your history.** T220 filled it with the deck's six tokens, which made
  the row and the door read as two rival answers to one question; it is
  now the colours you last used -- the same list the menu shows under
  "Recently used" -- padded out with the deck's own so a deck you have
  just opened still leads with its six. Every path writes that history
  now, not just the custom picker, and a deck colour is stored as the
  reference so a recent that IS the accent still follows the deck.
  Driven live: hex + alpha previewed on the page, Apply closed the
  menu, and the colour appeared at the head of both rows.

- [x] **T233 - The Object tab is sections that answer one question
  each.**
  The user (2026-09-04): "Put object history in it's own little
  section... The object ribbon is still a bit all over the place."
  *Done 2026-09-04.* **History** is a section of its own. T221 made it
  a tall tile so it would read as the door to a whole feature, but
  sitting in Arrange it still read as a fifth way to move something.
  **The Object group became three.** It held the two locks, four number
  boxes, the crop, the caption, the flip book's figures, where the
  picture came from, the opacity slider and the clone buttons under one
  label, so nothing in it looked related to anything else. Now: *Size &
  place* (the locks and the four numbers), *Picture* (what figure is in
  it, how much of it shows, what it is called, where it came from) and
  *Object* (how see-through it is, and turning it into something you
  can place again). Driven at 1500 / 1700 / 2100px: the row never
  wraps, the ladder folds Object first and Size & place second, and a
  folded group opens on its own name with its controls inside.

- [x] **T234 - Flip books: one big "+ Add", no dead colour door, and a
  page that turns as an animation.**
  The user (2026-09-04): "for the flip books the 'Figure' button really
  needs to be the first button and a big button, not small and hidden.
  And it should just be called '+ Add', and then there are the options
  there. Why do flip books even have a colour? What does that do? Also
  how do the animations work with the flip books. Can there be a make
  each flip an animation that appears in animations when selected."
  *Done 2026-09-04.* **"+ Add"** is a 72x56 tile at the head of the
  Picture group, and its menu holds the three things you can do to a
  book's contents: figures from a notebook, pictures from this
  computer, and reorder-and-name. The pane keeps its own two buttons --
  you are looking at the list there, and putting them behind a menu
  would be hiding what is already in the open. **The colour door is
  gone for a flip book**: nothing renders `a.color` for one (applyCommon
  writes opacity and rotation and stops), so it was a control that did
  nothing at all. **The pages were always animation** -- every figure
  after the first has always eaten a click, `flipPlan` sequences them
  and the Animations pane lists them -- but a page turned as a cut and
  nothing on the ribbon said so. The Animation tab now grows a Flip
  book group when one is selected: a readout ("3 figures - 2 clicks")
  and a Page turn run of None / Fade / Float up / Grow, which the
  renderer turns into one CSS keyframe on the frame that changed, so it
  plays in the show and in an exported page alike. Driving it caught
  the real bug: one arrow press rebuilds the stage twice (flipGo calls
  markDirty, which renders, and then renderSlide), so a
  since-the-last-render test fired on the first pass and the second
  pass rebuilt the node without the class. The turn is a moment now,
  not a diff.

- [x] **T235 - A default folder on this computer, so saving is local by
  default.**
  The user (2026-09-04): "the save to browser thing isn't working to
  great I think. Like I just go 'browser full' error. Is there a way to
  make it so that there is a way so the default is local, and you can
  set-up a default save to location that becomes the defaults for all?"
  *Done 2026-09-04.* Save ▾ has a new row: **A folder on this
  computer…**. Pick it once and Junoview makes its own
  `<name>.junoview.html` in there, saves to it, and keeps doing so --
  for this presentation and every one after, on this visit and the
  next. The directory handle is remembered in IndexedDB beside the file
  handle, and restoring it flips the destination off "this browser", so
  local really is the default rather than one more place you *can*
  save. An autosave can now mint the file (it never could before, since
  it must not open a dialog) but still never raises a permission
  prompt: it queries, and stands down if the answer is no. Choosing a
  new folder drops the old handle first, or the next save would write
  the file you just moved away from. The row names the folder once
  there is one, a second row undoes it, and the "browser is full"
  message now names this as the fix instead of only reporting the
  failure. Driven with a stubbed picker: the file was created and
  written, the destination read "Your Talks folder", and the next
  autosave said "autosaved to flipcheck.junoview.html".

- [x] **T236 - The File menu holds what only it can do.**
  The user (2026-09-04): "The file menu has too many options. The auto
  presentation isn't really a thing. Some of these have buttons
  elsewhere - the page numbers, the refresh images from files. The
  history as well I don't like here, should be a button on the home
  tab."
  *Done 2026-09-04.* Five sections and nineteen rows became three and
  twelve. **Auto-build** (figures / figures + docs) is gone: it
  replaced `pres.slides` wholesale -- the deck you had made, thrown
  away to lay the notebook out again -- which is what a new
  presentation already does from a clean start. `autoSlides` stays, as
  what `defaultPres` is built from. **Both refresh rows** have had Home
  tiles since T196; the tiles forwarded a click to the menu row, which
  is how one verb came to have two buttons, and they call the verb
  directly now. **Slide numbers** are Design → Page furniture →
  Numbers, and that button toggled the File row the same way; the
  toggle is a function both would have shared. **Crop marks** moved
  into export & share, beside the PDF they are for, which emptied the
  "page" heading. **History and Checkpoint** are a Saved versions group
  on Home -- they are things you reach for while building, not ways of
  getting a file out of the door, which is what the menu is left
  holding. Driven live: the menu reads as three sections, and both Home
  buttons work (History opened on "on main" with six versions;
  Checkpoint added a seventh).

- [x] **T237 - The history reads as a version graph.**
  The user (2026-09-04): "The history is a bit much as well. Like how
  you can see the git history thing where you can just see the little
  lines with the dots for versions and then can see branches as
  different colours from that... there can be named versions, and the
  default name should just be the time... when a new dot on the
  timeline should be created, like obviously not every change... a
  summary of changes from last version... by slide (e.g. slide 14:
  heading: (color: red -> yellow, image added))... and then also by
  type (e.g. heading changed red -> yellow (slide 13, 14, 15)), then
  ways to compare different changes... only showing slides that changed
  ... but also an ability to view the whole thing. Then the ability to
  go back to old version and branch from there."
  *Done 2026-09-04.* The surface moved into `46-history.js` (the store
  stayed with the other IndexedDB work) and was rebuilt.
  **The graph**: one lane per branch in its own colour, a dot per
  version, an elbow where a branch left the line it came from. T90's
  depth indent was a stand-in that stops reading past two branches.
  **The name** is the time it was taken unless you give it one -- a
  pencil on every row does that, and a checkpoint's name IS its
  version's name now rather than part of the reason.
  **When a dot appears** is stated on the panel and gained one case: a
  version at a natural break, after five minutes of work and half a
  minute of pause, which is the rule that makes Overleaf's timeline
  readable.
  **What changed**, not only which slides: a change model that pairs
  the boxes of two versions of a slide and names the fields that
  differ, in the same words the object's own history uses. Two readings
  of it -- *by slide* ("Slide 1 - empty slide: title colour cyan at 25%
  -> amber") and *by type* (the same change with "slide 1" beside it) --
  plus the pictures, which now show only the slides that differ unless
  you tick "every slide".
  **Any two versions** can be compared, not only a version against the
  deck you are editing.
  Driving it caught the real bug: pairing required BOTH sides to lack
  object ids before falling back to position, so every comparison
  against a snapshot older than oids reported each box as removed AND
  added. It is four passes now -- id, same slot, same kind, then what
  is genuinely new or gone -- and a version row is exactly one graph
  row high, because a wrapped one broke its own lane into segments.

- [x] **T238 - Disappear has a door, and leaving is an effect.**
  The user (2026-09-04): "Animations is missing dissapear."
  *Done 2026-09-04.* The exit has worked since T174 -- an object can go
  on the click another arrives, which is what replacing a picture
  actually is -- but its only door was a popover inside the Layers
  pane's build column, so the effect gallery offered five ways to
  arrive and none to leave. There is a **Disappear** group on the
  Animation tab now: the button does the common case (a click of its
  own), the caret holds "goes when X arrives", and a readout says which
  click it leaves on. **Leaving is an effect**: the stop an object goes
  on keeps the element so it can fade out, and every later stop drops
  it for real. Driving it caught two things -- a slide whose *only*
  animation was an exit never ran the reveal pass at all, and the
  button reported the state it had before its own click, because
  refresh() re-runs the ribbon's sync on a selection change and
  pressing a button is not one.

- [x] **T239 - There is a way out of the editor, and it says where it
  goes.**
  The user (2026-09-04): "Also for the whole website, a full screen
  editor is missing. There is no home button to go back home."
  *Done 2026-09-04.* Worse than reported. While you edit, `.deck-top`
  is hidden by `syncTopBar` -- so "Close the editor" is not on screen
  -- and the presentations rail is minimised AND `inert` (deckIsolate,
  2026-08-30), so its Notebooks button cannot be clicked either.
  app.js's own comment says "the way back out of the editor is
  #deck-exit in the QAT, which is visible throughout": it is not in the
  QAT, it is in the bar the QAT replaces. There was no way out at all.
  The deck's top bar now leads with a stacked pair, before File --
  **Home** (the start screen, `APP.goHome`) and **Close** (the notebook
  you were building from) -- because they really are two destinations.
  Home hides itself on a rendered page, where `goHome`'s own gate is
  app-or-web and the button would do nothing. Driven on a web build:
  Home closed the deck and showed the welcome; Close returned to the
  builder.

- [x] **T240 - The front door is one grid of identical cards.**
  The user (2026-09-04): "The home screen is a bit wild atm. Like it
  could be tidied up and organised a lot more. There is just text, and
  buttons of different shapes and sizes and organisation everywhere.
  Please standardise."
  *Done 2026-09-04.* The four ways in were flex children sized to their
  own words, so they wrapped into two ragged rows of four different
  widths -- and only one of them carried a second line, which made the
  row read as four unrelated things. They are a **grid** now: two
  across (one when narrow), every card the same box holding the same
  three parts -- an icon, what it does, and one line saying what that
  means. Four across was tried and dropped: `.welcome-box` is capped at
  760px, so it gives a 166px card and a hint that wraps three times.
  The **drop hint** was said twice, in two type styles -- inside Open
  and again as a full-width row of mono under the buttons; it is the
  Open card's second line and nowhere else. The links row is the same
  sans as the rest of the screen. Driven on a web build at 1400px: four
  cards, all 344px wide.

- [x] **T241 - What you had open is an offer, not a decision.**
  The user (2026-09-04): "I do not like how it automatically opens what
  was last open. That is too aggressive. Just have options to open what
  was previously open."
  *Done 2026-09-04.* `restoreWebSession` reopened every notebook of the
  last session as soon as Python was up -- a page that decides what you
  are doing before you have said. The list is still kept and still
  exact; it is put on the welcome screen instead, as one row ("Open the
  2 notebooks you had open"), because "where I was" is one thought. The
  individual notebooks are in Recent underneath, as they always were.
  Taking the offer opens them and leaves the welcome screen; the row
  goes away once taken. Driven on a web build with a seeded session:
  nothing opened on load, and the row appeared.

- [x] **T242 - Pin a cell past the filters, and mark the ones you want
  back.**
  The user (2026-09-04): "Would be good if you could pin cells so they
  always appear. I currently have one cell that has output I want but I
  don't want the rest. Also would be good if you could favourite cells
  as well (maybe a few different ones, like star, heart, etc.), then
  you can see them down on the side menu as well."
  *Done 2026-09-04.* Two marks, one store, both on the card head beside
  the eye. **Pin** means the filters do not reach that cell: it shows
  in full whatever they are set to, which is exactly "one cell whose
  output I want while the rest is off". It is a skip at the top of the
  filter pass rather than one more exception threaded through every
  branch, and pinning a cell you had hidden by hand un-hides it -- the
  two say opposite things and the newer press is the one you meant.
  **Mark** is a bookmark: clicks cycle star, heart, flag, none. Both
  are listed in a "pinned & marked" block above the sections, pinned
  first, and both are kept per notebook so the pins on an analysis are
  still there tomorrow. Driven on the example notebook: with Output off
  for the whole notebook the pinned card kept its output while its
  unpinned peer's went `part-off`.

- [x] **T243 - The section scope reads as a list of sections you tick.**
  The user (2026-09-04): "Also the section filtering is kind of
  confusing and hard to use."
  *Done 2026-09-04.* Four things made it so, and all four are fixed.
  It opened with every heading **collapsed**, so a ten-section notebook
  offered one row and picking anything meant expanding first; it opens
  showing them now, and still remembers what you fold. The only bulk
  control was **Select all**, so picking one section meant clicking
  every other one; there is Select none beside it and a live "3 of 10
  ticked". The whole row was the tick and a 9px chevron inside it was
  the expander -- two gestures in one target with nothing saying which
  was which; each row carries a **tick box** now, which also shows the
  half-state when a heading's children disagree. And neither the button
  ("Sections: All", which reads as a view setting) nor the menu said
  what it decided: the button says **"Filters act on: all sections"**
  and the menu opens with one line explaining that each section keeps
  its own filters, which is the whole reason to be able to pick them.

- [x] **T244 - Find in this notebook, with the matches highlighted.**
  The user (2026-09-04): "Also would be good for a search feature, and
  also for the types of variables thing, that it gets highlighted."
  *Done 2026-09-04.* Nothing looked inside a notebook's content: the
  rail's box finds notebooks and decks by *name*, and the variables box
  filters names. **Find** (Ctrl+F, or the button in App) searches the
  document's own text -- titles, prose, code and output -- marks every
  match, and steps through them with Enter / Shift+Enter. The half the
  browser's own Ctrl+F cannot do: a hit inside something the filters
  folded **opens it**, marks the card it is in, and puts every one of
  those back when you close the bar. Driven with Code set to Off:
  "matplotlib" still found its two hits and showed them. And the
  **variables filter marks the matched letters** -- a filtered list of
  names that all contain the same three letters is a list you still
  have to read one by one.

- [x] **T245 - Closing Find restores the view it opened.**
  Review, 2026-09-04. `findGo()` removes `is-hidden`, adds `expanded`
  and exposes folded parts so the current hit can be read, but
  `findOpen(false)` only removes `jv-hitopen`. A filter-hidden card can
  therefore stay visible after Escape, and a folded Markdown card can
  stay expanded. Closing Find must restore the exact pre-find view (or
  reapply the filters without destroying user-open state), with a real
  interaction test covering hidden and folded cards.
  *Done 2026-09-04.* Reproduced first: with Code Off and
  `card-imports-plotting-style` hidden by hand with its eye, searching
  "numpy" opened that card and closing the bar left it out of
  `.card.is-hidden` and still carrying `.expanded` -- a cell you had
  chosen to hide, back for good.
  **Re-running `applyFilters()` is not the fix**, which is why this was
  worth writing down. That pass deliberately KEEPS a note's `expanded`
  while its filter says collapsed, because the flag is also the
  reader's own "I opened this one" -- and find's forced expand is
  indistinguishable from it. So `findGo` now records the two flags it
  is about to change, per card, before it changes them, and
  `findRestore()` puts them back verbatim. `.jv-hitcard` doubles as the
  "already recorded" mark, so stepping back over a card does not
  overwrite its original state with the opened one. The `.jv-hitopen`
  sweep moved in there too, so a **new search** puts the last one back
  as well -- not only a close.
  Driven with the same setup plus a hand-folded note: the hidden /
  expanded / collapsed / part-fold sets and the jv-hit, jv-hitcard and
  jv-hitopen counts after closing were identical to the snapshot taken
  before Find was opened.

- [ ] **T246 - Document Find does not erase the Variables match.**
  Review, 2026-09-04. Document hits and the Variables filter both use
  `.jv-hit`, while `findClear()` removes every `.jv-hit` in the page.
  Running or closing document Find therefore erases the highlighted
  part of a still-active Variables query. Give the two features
  separate ownership (separate classes or scoped clearing) and test
  both being active together.

- [ ] **T247 - Find follows the notebook you switch to.**
  Review, 2026-09-04. The Find bar and its `findHits` DOM references
  survive `activate(stem)`. After switching notebooks, Next and
  Previous still walk matches in the now-hidden old shell. A tab switch
  must close Find or rerun the current term against the newly active
  document, and the count must immediately describe that document.

- [ ] **T248 - Pin and mark have one source-cell identity in every
  view.**
  Review, 2026-09-04. Tree clones remove their card ids but retain and
  rewire the new pin/mark buttons, so a click derives the empty id and
  can persist a meaningless `""` mark. Plot-trace clones retain ids but
  repaint only the clone, leaving the source document stale until a
  reload. Either omit these controls from derived views or route every
  click through a stable source-cell id and repaint every live view and
  sidebar together.

- [ ] **T249 - The widget does not show dead pin and mark buttons.**
  Review, 2026-09-04. `render_item()` now emits pin and mark controls for
  every frontend, but `widget.js` wires neither of them. The widget
  consequently presents controls which look interactive and do
  nothing. Give the widget real persisted pin/mark behaviour, or make
  the shared renderer able to omit app-only card chrome.

- [x] **T250 - A colour theme covers the whole product, not only the
  chrome.**
  The user (2026-09-04): "review the different colour themes, I feel
  like they don't work properly (don't apply to everything), and could
  be better and more." Review confirmed the underlying contract is the
  problem: `core.css` and `app.js` explicitly call schemes "chrome
  only" and exclude document backgrounds, cards and content. Dark,
  forest and colourful therefore keep large light/default areas, while
  Light forest is the lone scheme that also changes `--paper-*`. Define
  a complete semantic theme contract for page, card, chrome, overlay,
  control, text, muted text, borders, focus, selection and status
  colours, then apply it consistently to the reader, welcome screen,
  Variables pane, tree, trace, presentation rail and deck editor. Deck
  and exported-slide colours remain document data; surrounding editor
  and reader surfaces follow the app theme.
  *Done 2026-09-04.* The seven existing schemes now each define the
  same complete 31-token contract: document paper and ink, every chrome
  tier and its ink, controls, accent, overlay, focus, selection and
  semantic feedback. Dark, both forests, Colourful and High contrast
  now carry their palette through the document background and cards as
  well as the rail/editor. Authored deck pages, figures and the fixed
  code-kind colours stay data. A set-equality test makes an incomplete
  scheme fail by naming the tokens it omitted.

- [x] **T251 - Theme tokens replace the light/dark patchwork.**
  Review, 2026-09-04. `body.light` changes the chrome surfaces but does
  not redefine `--chrome-ink*` or `--btn-*`; dozens of
  `body.light .component` overrides repair individual controls, while
  roughly 1,500 literal colour occurrences across the three main
  stylesheets leave each new component another opportunity to miss a
  theme. Make every scheme provide the complete token set, replace
  theme-dependent literals and component-specific light fixes with
  those tokens, and add a contract test which fails when a scheme omits
  one. Keep intentional data colours, destructive/warning semantics and
  author-selected deck colours outside that mechanical replacement.
  *Done 2026-09-04.* The contract now also owns hover/active surfaces,
  strong borders, input and tooltip surfaces, plus a separate foreground
  for deep selected-state fills. Reader and welcome surfaces, the help,
  open and note dialogs, tooltips, theme menu, style panels, rails and the
  editor's common controls consume those tokens instead of accumulating
  another `body.light .thing` repair. Rich HTML, figures and slide
  previews deliberately use fixed `--output-*` ink/paper tokens: they are
  authored light islands and must not turn white-on-white in a dark app.
  The contract test now requires exact set equality for every scheme and
  pins representative consumers across all three stylesheets.

- [x] **T252 - Dark colourful reaches overlays and dynamically moved
  controls.**
  Review, 2026-09-04. Its accent is scoped to a hand-selected set of
  ribbon/app groups. Menus and dialogs appended to `body`, controls
  moved between panes, and groups without one of those selectors fall
  back to the default cyan, so the scheme visibly stops at component
  boundaries. Give a colourful theme a deterministic hue for every
  surface and overlay without depending on where the DOM node happens
  to be mounted; keep the existing one-hue-per-tab rule rather than
  returning to unrelated colours within one tab.
  *Done 2026-09-04.* The ribbon announces its active semantic tab and
  `body[data-theme-zone]` carries that hue to menus, dialogs and controls
  mounted outside the group that launched them. Every tab has one tested,
  contrast-safe accent/deep pair; Images and Text intentionally share the
  purple family, while non-editor surfaces have a stable global violet.
  Moving a node now changes its layout ancestry without silently changing
  the colourful scheme back to default cyan.

- [x] **T253 - More themes, with useful previews and accessibility
  guarantees.**
  After T250-T252 establish full coverage, expand the current seven
  choices with genuinely distinct families rather than accent swaps:
  warm/sepia reading, navy, purple, neutral dim, and light high
  contrast, plus a Follow system option. The picker preview must show
  background, surface, text and accent (not only two accent dots), name
  which choices are light/dark/high-contrast, support keyboard focus,
  and preserve the choice. Check normal text, muted text, controls,
  focus rings and selected states against WCAG contrast targets.
  *Done 2026-09-04.* Warm sepia, navy, purple, neutral dim and light high
  contrast join the original families, each defining the same complete
  contract rather than swapping one accent. **Follow system** listens to
  `prefers-color-scheme` and preserves that preference by stable scheme ID,
  including live OS changes. Picker rows now show page, raised surface,
  text and accent, label their Light/Dark/High contrast family, expose
  radio-menu semantics, use roving focus and support Arrow keys, Home, End
  and Escape. Tests pin the registry, four-part preview, persistence,
  system listener and WCAG ratios for normal/muted/subtle ink, chrome,
  accent links, focus and deep selected states across all twelve palettes.

- [ ] **T254 - Theme coverage is visually tested across the real
  surfaces.**
  Review, 2026-09-04. Existing theme tests mostly assert that a token or
  selector substring exists; they do not catch an unthemed new dialog
  or unreadable computed foreground/background pair. Add a compact
  browser-driven matrix over every scheme and the representative
  surfaces (reader, welcome, menus/dialogs, Variables, tree/trace and
  editor), checking computed tokens/contrast and keeping reference
  screenshots for the places where partial theming is visible rather
  than structurally detectable.

- [x] **T255 - Zoom in, inside a full-screen plot.**
  The user (2026-09-04): "when viewing plots in full screen you can't
  zoom in. that would be a really good feature to have".
  *Done 2026-09-04.* The expand button already gave a figure the whole
  window, but the window was all it gave: whatever size the plot
  settled at was the only size it had, which is no use on exactly the
  plot you open full screen -- a dense map, a small-multiples panel.
  There is a **bar** now (Smaller / Zoom N% / Bigger / Close, words plus
  icons like every other bar), the **wheel** zooms about the pointer, a
  **drag** pans, **double-click** goes 100% <-> 200%, and **+ - 0** do
  the same from the keyboard. It reads "Zoom 200%", never "Fit" -- that
  word was tried on the feed's own zoom and rejected (2026-08-07).
  Two things make it work and neither is optional. The scale is CSS
  `zoom` rather than a transform, because zoom grows the LAYOUT box, so
  the viewer overflows and gets real scrollbars for the drag to pan by;
  a transform paints outside the box and scrolls nothing. And the
  fitted size is **pinned in px at open**, because the figure carries
  `max-width:100%` of a box that is itself shrink-to-fit -- left free,
  every zoom step just re-clamped the image against a wider box. Driven
  at 1440x900 before the pin: 195% gave a 1304px plot (not 1455px) and
  `scrollWidth == clientWidth`, so there was nothing to pan at all.
  After it: 746px fitted, 1455px at 195%, box scrolling 1510 > 1357, a
  drag moving scrollLeft to 80, and each new figure opening at 100%
  instead of inheriting the last one's zoom.

- [x] **T256 - Fold or remove the code cells that produced nothing.**
  The user (2026-09-04): "would be good to have an option - remove/fold
  code cells without output, as a lot of the times these are the ones
  that I don't care about."
  *Done 2026-09-04.* A cell that printed nothing and drew nothing is
  usually setup -- the imports, the grid, the intermediate transform --
  read once and never wanted again; **seven of the example notebook's
  27 cards** are exactly that. It rides the **Code chooser's** map
  rather than becoming a fourth top-level filter, because it is the
  same question that menu already asks (which code cells do I see) and
  it inherits the whole tri-state machine: its own On / Fold / Off, per
  section, cleared by the same Reset. And because such a cell has no
  plot part and no output part, "fold its code" and "remove the card"
  fall out of the existing rule instead of needing a new branch --
  `data-noout` on the card is the only new fact.
  The **door** mattered as much as the filter. The three chooser
  buttons under Plots / Code / Output were **icon-only funnels**, which
  is both the rule this project keeps (words PLUS icons, never
  icon-only) and the standing complaint about things hidden in menus.
  They say **"Choose"** now beside the funnel, matching the worded
  Reset next to them, and their tooltips stopped shouting ("Advanced:
  hide specific CODE cell types" -> "Choose which code cells you see").
  The menu's one heading covers the whole list -- "show code cells" --
  because titled/untitled were never "types" either.
  Driven at 1440x900: Off hid exactly the seven `data-noout` cards and
  nothing else, On brought all seven back, Fold kept the cards and
  turned their code off, and a **pinned** cell stayed visible under Off
  while its six peers went.

- [x] **T257 - Show only the cells you pinned, or starred.**
  The user (2026-09-04): "The pins are good, and would be good to have
  optins that is - show pinned options only, show starts only."
  *Done 2026-09-04.* T242 gave the marks and a list of them; marking is
  only half the thought, and this is the other half -- seeing just
  those cells, in the document itself. A row of chips sits in the
  "pinned & marked" block with the marks it acts on: **All / Pinned n /
  Star n / Heart n / Flag n**, each a word plus its icon, each showing
  how many, and only for a mark the notebook actually uses -- a chip
  for a mark you have never used is a chip that empties the page. They
  **wrap**, which the ribbon may never do but a sidebar block may.
  It is a **gate**, not one more filter: it decides which cells are in
  play at all and the type filters and section scope act within that.
  So it runs **before** T242's pin bypass. Pin's promise is that the
  type and section filters cannot reach a cell; this is not one of
  those -- it is you saying which cells you are working with -- so a
  pinned cell is out of view under "only starred" like any other, and
  "only pinned" is the case where the two agree anyway. It reads the
  card's own `is-pinned` / `mk-*` classes, so there is no second source
  of truth to drift. Un-marking the last cell of the mark you are gated
  to **releases the gate**, rather than leaving an empty notebook with
  no visible cause.
  Driven on the example notebook with two pins, one star, one heart and
  one flag: Pinned showed exactly the two pinned cards of 27, Star
  exactly the one starred card (the pinned ones gone with the rest),
  All restored all 27, and dropping the last heart while Heart was on
  put the whole notebook back.

- [x] **T258 - A notebook's own strings cannot inject markup.**
  Audit, 2026-09-04. `render/sanitize.py` exists because rendered pages
  get shared, but **three sinks** wrote author-controlled strings
  straight into markup without going near it. All three were confirmed
  by rendering a crafted notebook, not by reading:
  - **`data-node` on every card** (`items.py`). `#| id: a"><script>
    alert(1)</script>` closed the attribute, closed the tag, and put a
    live `<script>` element in the page. The neighbouring `data-anchor`
    escapes the SAME string, so this was an oversight, not a decision.
  - **`data-node` and `data-from`/`data-to` in the provenance SVG**
    (`graph.py`), where every other value in the same builder escapes.
  - **the raw view's `In [n]` label** (`items.py`). nbformat types
    `execution_count` as int|null, but this reader is deliberately
    lenient about types everywhere else, and the raw view is built for
    every notebook by default: a string count rendered a live `<img>`.
  A node id is **not** slugged the way `item_id` is -- it is the
  author's string, kept verbatim on purpose so deck anchors and
  `#| depends:` matching keep working -- so escaping at the sinks is
  the fix, not sanitising at the parser.
  It matters beyond a shared file: in the local app the same page holds
  `window.APP.cfg.token`, which grants the file read/write API.
  The regression test **parses** the output rather than grepping it: a
  notebook's own text is displayed, so `onerror=` legitimately appears
  inside escaped content and must keep appearing -- what must never
  happen is that it becomes a tag or an attribute. Checked both ways:
  it fails on the unescaped code and passes on the fix.

- [x] **T259 - One IIFE, one name: Flip left/right comes back.**
  Audit, 2026-09-04. `assets/js/deck/` is ONE IIFE, so every top-level
  `function foo` and `var foo` in any part is the SAME binding -- a
  second declaration does not shadow, it **replaces, for everybody**.
  Two had collided.
  **`flipSel`**: `35-arranging.js:219` declares
  `function flipSel(axis)` (mirror the selection); `45-images.js:335`
  declared `var flipSel=-1` (which annot the flip-book pane is
  showing), and 45 is concatenated after 35. By the time any handler
  could run, `flipSel` was the number `-1`, so "Flip left to right" and
  "Flip top to bottom" in the Arrange menu called `(-1)('h')` and threw
  `TypeError: flipSel is not a function` -- which aborted the menu
  handler, so the menu closed and nothing happened, with no toast and
  no reason. **Two shipped menu rows were permanently dead**, while
  `tests/test_slide_editor.py` asserted `"function flipSel(axis){" in
  out` and stayed green. Confirmed under a real engine first: `typeof`
  went `function` -> `number` and the call threw. The pane's variable
  is `flipPaneIdx` now; `flipSelIdx()` (a different, longer name) was
  left alone.
  **`STYLE_FIELDS`**: declared in `05-figures-and-ribbon.js` as
  `['size','b','i',...]` and again in `15-annotations.js` as
  `['b','i',...,'head','bg','bdc']`. Nothing in 05 read it, so nothing
  misbehaved -- but the file told every reader something untrue, and
  test_characterization's own note says the point was to have ONE list.
  The dead copy is a comment now, saying where the list lives.
  The fix that matters most is the **general guard**:
  `tests/test_one_iife_one_name.py` walks the assembled deck IIFE (and
  app.js) for top-level declarations and fails on any name declared
  twice, or declared both ways. A substring test cannot see two
  declarations disagreeing, which is the failure mode this codebase
  actually has -- and the guard is itself tested against the exact
  shape of the flipSel bug, so it cannot quietly stop working.

- [x] **T260 - The App group stops painting over itself.**
  Found by driving the rendered page at 1440x900, not by reading. The
  group at the right of the ribbon -- **Theme, Support, Find, Help** --
  came back as four **overlapping, illegible clusters of glyphs**, and
  Help's box started at x=1455 on a 1440-wide viewport.
  Three rules had drifted away from the markup they were written for.
  `#ab-app .toggle{width:34px;...}` forced a **square**, but every one
  of those buttons holds an icon AND a word, and `.appbar .toggle` is
  `white-space:nowrap` with visible overflow -- so each label painted
  straight out of its box and across the next button. `#help-btn` had
  its own square with the comment "Help is icon-only and stands alone",
  which stopped being true when Help got its word. And `#theme-btn` in
  the icon-only rule **matches nothing**: the button is `#scheme-btn`.
  A worded button is sized by its word now; the taller 34px height and
  the 17px icon stay, because those are what "the app buttons are way
  too small" (2026-08-18) asked for.
  The **File group** went the same way: `#tab-open` is hidden unless
  the page can really open a file, which a shared standalone render
  cannot -- but the group stayed, so the bar carried a "File" caption
  over an empty box and a divider, about 60px of chrome for nothing.
  Driven after the fix at 1440x900: no label paints outside its own
  button, no two toolbar buttons overlap, every App button shows its
  word and its icon, and the File group measures 0 wide.
  *Still true, and worth saying:* at 1440 with the rail open the bar
  wants 1433px and has 1249, so it scrolls sideways -- the recorded
  fallback (never a second row, never missing words). Restoring the
  words costs 106px of that. Theme and Support are on screen; Find and
  Help need a scroll, and both also have keys (Ctrl+F, ?). Making the
  whole bar fit at 1440 is a layout decision, not a bug fix, so it is
  left for the user to call.

- [x] **T261 - Five things the audit found broken in the editor.**
  Unrelated to each other; what they share is that the substring suite
  was green through all five.
  1. **Save wrote back to the wrong file.** `openDeckFile` filed the
     handle it had just been given under `'deckFile'`, a key nothing in
     the tree reads; the restore path reads `HKEY`. So the file you
     opened was forgotten on the next visit -- and any handle left
     under `HKEY` by an earlier Save-as **was** restored and became the
     live target while `saveTarget` was still `'file'`, so the first
     autosave after a reload wrote this deck into that other file.
  2. **Undo deleted the masters.** `histRestore` has always carried
     `masters` in its delete-what-is-absent list and `histState` never
     saved it, so `d.masters` was always undefined and every restore
     took `delete pres.masters`. One Ctrl+Z after ANY edit destroyed
     the registry while every slide kept its `mast` tag pointing at
     nothing, and the loss went straight into the draft.
  3. **Hovering a swatch collapsed a multi-selection.** `pvRender` (the
     live colour preview) called `selectAnnot`, which with no additive
     flag sets `selSet=groupMembers(s,idx)` -- `[idx]` for anything
     ungrouped. Selecting three shapes and moving the pointer over a
     swatch silently dropped two, and the click then recoloured only
     the survivor. It uses `paintSel` + `showFmt` now, the pair
     `fmtApply` already uses on its multi-target branch.
  4. **The ribbon gallery threw every time it opened.**
     `rbnOverflowNotice(bar)` with `bar` never declared, in a strict
     IIFE -- so it threw before its last two statements and neither
     listener was attached. **Driven A/B**: on a build from before the
     fix, opening the gallery logged `Uncaught ReferenceError: bar is
     not defined` and Escape left all 9 cards on screen; after, no
     error and Escape closes it. That Escape handling is the thing
     `rbnGalleryKey`'s own comment says cannot live anywhere else.
  5. **Recolouring text on page 2 overwrote page 1.** `colorSelection`
     assigned `a.text`/`a.html` directly, while every other writer of a
     box's words goes through `textPage`/`textPageSet` bound to
     `textAt(s,a)` -- the page the box is turned to. Highlighting a run
     on page two of a multi-page text box and picking a colour wrote
     page two's words over page ONE, silently, and autosave kept it.

- [x] **T262 - The words and the icons say the same thing everywhere.**
  A sweep of the audit's copy and icon findings plus one measured
  layout fault. Small each; the point is that the UI stops
  contradicting itself.
  - **The filters said one thing and showed another.** The buttons read
    On / Fold / Off; every tooltip, the help page and the tour said
    "Visible -> Collapsed -> Hidden". Standardised on the words the
    buttons actually show. Display strings only -- the stored values
    stay `visible`/`collapsed`/`hidden`, because saved layouts read them.
  - **Auto-hide wore the pin icon** on the present bar, while its three
    siblings use `autohide` -- and the comment beside the rail pair says
    outright "Neither is 'pin' -- nothing is being pinned". This page
    also has a real pin on every card meaning something else entirely.
  - **"GitHub" was a raw arrow glyph** in a row of `bic()` icons, two
    lines below a comment saying the labels carry a `bic()` icon.
  - **The Tree toolbar called a cell a "node"** in three tooltips, with
    its own neighbour in the same group saying "cell".
  - **Five reload buttons, four verbs.** The three full-screen scan
    views said "Check again", "Check again", "Look again"; the picture
    list said "Read again" for a job that is not a check at all, and now
    says "Update this list".
  - **Ctrl+F was real but advertised nowhere** -- no chip on the button,
    no row in Help. Both now, with one handler still doing the work.
  - **The rail's Auto-hide wrapped to two lines.** `#pr-auto` was pinned
    to a 34px box -- right for an icon-only button, wrong for one
    carrying a word, so it read "Auto-" / "hide" beside a Collapse
    button three times its width. The footer stacks now. Driven at
    1440x900: 34px and 2 lines before, 163px and one line each after.

- [x] **T263 - Six controls that looked live and were not.**
  The common shape: the button is there, the click lands, and nothing
  happens -- or, worse, something says it happened.
  - **The eye on a pinned cell.** T242's pinned short-circuit stripped
    `cell-off` along with the filter classes, so pressing a pinned
    card's eye set the class and the very next pass took it off again.
    A pin is about the FILTERS; the eye is a deliberate press, and it
    is honoured inside the pinned branch now.
  - **Undo could not undo a custom slide layout.** `histState` has
    always snapshotted `pres.layouts`; `histRestore`'s key list never
    mentioned it, so making or deleting a layout was the one
    design-level change Ctrl+Z could not reach.
  - **`validate_deck` warned about every deck that designed a layout.**
    `layouts` is written by the layout builder, carried by `normPres`
    and named explicitly by `as_presentations`, but was missing from
    `DECK_KEYS` -- so the schema called a first-class key unknown. Added
    there and to DECK-FORMAT.md's table.
  - **The autosave menu threw on every outside click**, testing an
    undeclared `wrap` in a strict IIFE. Redundant as well as broken:
    `overlayShow` already registers the menu with the single overlay
    owner, which closes it on an outside click and on Escape.
  - **Import claimed success after storing nothing.** `lsSet` returns a
    boolean exactly so this cannot happen; `importDeckText` ignored it,
    so once the draft budget was full every write was discarded, the
    toast still said "Imported N presentations", and the view switched
    to a deck that is not stored. It counts what landed and says what
    did not.
  - **Opening a deck in Firefox or Safari killed Save.** The
    `<input type=file>` fallback set `saveTarget='file'` on the promise
    that "the first Save asks where once" -- but asking needs a save
    picker, and the only browsers that reach this path are the ones
    without one. Save and autosave then did nothing at all and said
    nothing. It keeps the deck as a draft and says so instead.

- [x] **T264 - The front door stops mixing two different things.**
  The user (2026-09-04): "the '+ new presentation' button has a lot of
  unnecessary text with it that is really verbose and doesn't add
  anything... Then the example notebook is in an odd spot, like put
  that out of the way. Then why are the presentations and the notebooks
  kind of mixed together, these are really different features. This
  still looks really messy and hard to look at. Not a fan."
  *Done 2026-09-04.* Three things, and the mixing one was **mechanical**
  rather than a matter of taste. `.welcome-jump` was
  `repeat(auto-fit,minmax(240px,1fr))` capped at 660px, which resolves
  to exactly two columns -- three would need 772px. So the three blocks
  flowed in source order **notebooks / notebooks / presentations**, and
  presentations landed underneath "last time" with dead space beside
  it, wearing the same 10px mono label as its neighbours. Each kind is
  its own **titled column** now (Presentations · Notebooks), each hides
  when empty so one kind still fills the width, and the stutter went
  with it: the presentations block no longer repeats its column's name,
  and "recent notebooks" under a Notebooks heading is just "recent".
  **The example notebook** left the card grid for the links row, beside
  the other two ways of being shown around. That also fixed something
  nobody had noticed: its card was web-build only, so the **app build
  was already showing three cards in a two-column grid** -- one alone
  on a ragged second row, the very thing T240 set out to stop. Making a
  presentation now **spans the row** and the two "open a notebook"
  cards pair up beneath it, which is the same split the columns make.
  **The verbose line**: "Start from a blank deck - no notebook needed"
  said the label again in a second vocabulary (a new presentation IS a
  blank deck) before reaching its one real fact. It is "No notebook
  needed". Open's `title=` went too: every word of it was already on
  the visible line below it.
  Driven at 1440x950: one 700px card over two 344px cards on one row,
  and two columns at x=375 and x=720.

- [x] **T265 - Deck colours you can see the effect of.**
  The user (2026-09-04): "this is for the 'deck colours'. I have never
  once understood the actual purpose of this and there is a lot of
  text, but none of it means anything to me, and changing these around
  I can never figure it out."
  *Done 2026-09-04.* The reason was **mechanical, not editorial**: on a
  deck where nothing wears a token, changing one changes nothing on
  screen -- and the panel gave no sign of that. No default carries a
  reference, so a new deck's boxes all hold literal hex; you have to
  find the "Deck" row inside a box's colour menu first, which the panel
  named but could not do for you. So the answer was never another
  paragraph.
  Every row now says **what that colour is on** -- "2 boxes", "1 box",
  or "not used yet" -- counted by deep-walking the deck rather than
  checking a list of fields, because a token can sit in `color`, `bgc`,
  `txcol`, `fillc`, `line`, `bgcol`, `bdc`, a slide's background or
  border, a gradient stop or a style, and a field added later would
  silently stop being counted. The 195-character note is **one line**,
  and which line depends on what is there: with colours in use it says
  what changing one does; with none in use it says that nothing wears
  them yet and where to give a box one. T208's contract is untouched --
  it asked that the **door's tooltip** say what a named colour is and
  how to give a box one, and that tooltip is unchanged.
  Two things fixed in passing. **"Gap the arrange verbs use"** was this
  repo's own name for the align/distribute commands leaking into a
  user-facing label; it is "Space between arranged boxes". And
  `applyTokens` was setting **six `--tk-<colour>` custom properties on
  every slide on every render that nothing reads** -- `grep "var(--tk-"`
  finds only `--tk-rad`. The colours resolve in JS through `tokVal` at
  its ~70 paint sites; the dead writes are gone.
  Driven on a fixture deck with two boxes wearing Accent and one
  wearing Warm: "Accent 2 boxes · Warm 1 box · Lift not used yet".

- [x] **T266 - The prose that explained instead of labelling.**
  The user (2026-09-04): "Please review across lots of areas if there is
  unneccarry and/or verbose text", with the Style system's
  "Every object, outlined / The whole deck at once, with a box drawn
  round everything on every slide. This is how you find the one heading
  that is 3mm off, or the figure nobody lined up." given as the example.
  *Done 2026-09-04.* Thirty-nine candidates were found across the
  welcome screen, the deck ribbon and panels, and the menus and toasts;
  each was then **checked against TASKS.md before being cut**, because a
  great deal of this prose was written in answer to an earlier request
  and reversing that silently would be worse than the verbosity. **Ten
  were kept** for exactly that reason -- among them the front door's
  tagline, its numbered steps, two card hints, and the intro above the
  mismatched-text cards, all of which the user asked for by name.
  Twelve were cut. The pattern in all of them: a sentence that argued
  the design ("That is what makes it a standard rather than a
  preference"), set a scene ("Try this when you are handing the app to
  someone on their first day"), or named the implementation ("with its
  lints riding along", "These are heuristics about the CONTENT", "the
  row still never wraps"). What replaced them says what the control
  does, or nothing at all where the control already said it.
  One of the twelve is not a trim but a **name**: the Style system's
  "Check for drift" button opens the same thing the ribbon calls
  **"Fix mismatched text"**, and now says so. One door, one name.

- [x] **T267 - The ellipsis means one thing, and only where it is true.**
  The user (2026-09-04), twice in one message: "'Fix mismatched
  text...' (why does this have elipsis anyway)" and "'style system...'
  (why elipsis agian)". It is the third time -- T215 records the same
  question about the Palette button.
  *Done 2026-09-04.* There are about 130 ellipses in the product, but
  most are placeholders ("Find... (Ctrl+K)") or real elisions in prose,
  so a blanket strip was the wrong tool. What was missing was a **rule**,
  applied consistently for the first time:
  - **...** the press asks you for something before anything happens
    (Rename..., Save to notebook..., Open a .junoview file...);
  - **the caret** the press opens a menu anchored to that button (T215);
  - **neither** the press does it, or shows you something.
  Four controls were breaking it and are fixed. **Fix mismatched
  text** and **Style system** open a full-screen view immediately and
  ask nothing -- which is exactly why the dots read as a lie to the
  person pressing them. The **.pptx export** exports straight away.
  And **New** on the presentations rail opens a menu, so it wears the
  caret the rest of the product's menu doors wear. The names T204 and
  T215 settled are untouched; only the punctuation moved.
  The rest were checked and left: each one does ask for something.

- [x] **T268 - Fix mismatched text stops contradicting its own name.**
  The user (2026-09-04): "I can also never figure out how to use the
  'Fix mismatched text...'. But the display for that is very confusing
  and I have no idea how to use it."
  *Done 2026-09-04.* Three mechanical faults, none of them verbosity.
  **The screen argued with its own door.** `standardise()` pushed a card
  for every size band with two or more boxes *whether or not anything in
  it disagreed*, and when nothing did, the card said so in words: "They
  match each other now." On a hand-built deck -- the common case -- that
  was most of the screen. You opened "Fix mismatched text" and read
  cards telling you the text matches. The ones that disagree come first
  now and the rest sit under **"these already match"**, where an offer
  reads as an offer.
  **No card said what the two values were.** The head read "4 boxes at
  about 22 pt — 1 do not match" and the body "Their size does not agree:
  1 of 4 differ" -- a count, and a trip to go and look. It now reads
  **"1 has a different size"** and **"Most are 22 pt; 1 is 23 pt."** The
  same for weight, italics, typeface, alignment and line spacing. (It
  also fixes the grammar: "1 do not match".)
  **An empty deck produced nonsense.** With no text boxes -- a deck you
  have just made, which is exactly when you might go looking -- the
  message read "Your text falls into 0 sizes; naming them means changing
  every heading later is one edit instead of 0". That is where a reader
  decides the screen is broken. It says there is nothing to check yet.
  The intro paragraph above the cards was **left alone**: T209 records
  the user asking for it.
  Driven on a fixture deck with three headings at 22/22/23 pt and three
  body boxes at line spacing 1.25/1.25/1.6: two cards, "Most are 22 pt;
  1 is 23 pt" and "Most are 1.25; 1 is 1.6", and no card claiming
  anything matched.

- [x] **T269 - The history opens on a difference, not on "no
  difference".**
  The user (2026-09-04), with a screenshot: "the history tab looks mid."
  *Done 2026-09-04.* The screenshot says why, and it is not decoration.
  The panel opens on the newest version -- "20:27 · you are here" --
  and reads it against **"now (the deck you are editing)"**. Those are
  the same thing. So the headline is "20:27 → now: no difference", the
  three view tabs have nothing under them, and the whole right-hand
  pane is empty. **Every time you open the history, that is what you
  get first.**
  `histAgainst` defaults to `''` with the comment "the deck you are
  editing, which is what you want nine times in ten". That is true of
  an OLD version -- "what have I done since then" is the usual question
  -- and false of the newest one, which is the only version the panel
  ever opens on. For that one the useful question is what it changed,
  so it is now read against the version before it. Applied only when
  nothing has been picked by hand: choosing a comparison from the
  dropdown and then clicking around keeps it.
  And when there genuinely is no difference, the line says **which two**
  it compared -- "These two versions are the same", or, against the
  deck you are editing, that this version IS that deck and an older one
  is what you want. "Nothing is different between these two", on a
  screen whose two ends you cannot see, is most of what made it feel
  broken.
  *Still open:* "mid" covers more than this, and the rest is a matter
  of taste rather than a defect -- the empty right pane was a symptom
  of the comparison, and should fill now. Worth another look with the
  user on what else they want from it.
