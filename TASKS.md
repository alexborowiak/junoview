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
- [ ] **T22 · S — Figure consistency lint.** Flag mismatched fonts/sizes/
  margins across a deck's figures where metadata allows. Can land inside
  T32's lint framework.

## 4. Deck structure & navigation

- [ ] **T23 · M — Sections as first-class objects.** Group slides into
  sections that move/duplicate as a unit, with section-scoped numbering,
  template and transitions, and section navigation in present mode.
- [ ] **T24 · M — Optional slides + named cuts.** Mark slides optional;
  define named cuts ("45-min", "20-min", "5-min") as subsets of one deck —
  no more three diverging files. Easier after T23.
- [ ] **T25 · S — "Running late" mode.** One control in present mode that
  skips the remaining optional slides. Depends on T24.
- [ ] **T26 · M — Deck overview map.** A zoom-out overview: sections →
  slides as a navigable map. This is the realistic scope of the "infinite
  canvas" wish — an overview/navigation layer, not canvas-based authoring.
  Depends on T23.
- [ ] **T27 · L — Object continuity transitions (design first).** The same
  object appearing on consecutive slides animates between its two states
  (move/scale/zoom-into-region) — Keynote "Magic Move". The existing
  frames + slide-matching machinery is the starting point.

## 5. Presenting

- [ ] **T28 · M — Rich speaker notes + presenter view.** Markdown notes
  with links/references, per-slide timing targets, a roomy notes editor,
  and a presenter view that shows the audience slide alongside full notes.
- [ ] **T29 · M — Rehearsal timing.** Record per-slide and per-section
  times across rehearsal runs; show stats ("slide 17 averages 3:42").
  Local only — no audio, no speech analysis.
- [ ] **T30 · S — Presenter slide search / jump.** Type-to-search titles
  and content while presenting; jump straight to a slide.
- [ ] **T31 · S — Private presenter annotations.** On-slide annotations
  visible only in presenter view, never to the audience or in exports.

## 6. Versioning & recovery

- [ ] **T32 · L — Deck version history + visual diff (design first).**
  Snapshots on save (the server already snapshots notebook edits — same
  pattern), a slide-by-slide visual comparison of two versions, and
  restore-a-destroyed-slide recovery. Hook `server/vcs.py` git awareness
  where a repo is present. Deck JSON + deterministic output make this
  tractable in a way pptx structurally isn't.

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
- [ ] **T34 · L — Python deck API.** Load/edit/save decks from Python —
  `deck.slides[7].figures["toe_map"].update(...)` — living alongside
  `notebook/presentations.py`, round-tripping cleanly with the editor.
- [ ] **T35 · M — Deck lint + AI-readable export.** Export a deck as
  structured text (titles, arguments, figures, captions, notes) so an LLM
  or a colleague can review the *content*; plus heuristic lints:
  unreferenced figures, orphan captions, inconsistent terminology,
  overly dense slides. This is the honest bridge to the "AI review my
  deck" wishes — junoview stays offline; the export travels.

## 8. Code structure — deferred refactors (each runs ALONE)

Deferred earlier as too churny for one pass; unchanged status.

- [ ] **T36 · L — Split deck.js into modules (design first).** The
  multi-file split. Must preserve: no build step, boot-sequence-at-tail
  discipline, section-banner navigability. Update AGENTS.md/CLAUDE.md
  when done.
- [ ] **T37 · S — Relocate `embed_deck`.**
- [ ] **T38 · M — Underscore-API renames.** The public/private naming
  pass; keep the `semantic_render` shim working.

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
