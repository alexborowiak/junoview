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
- [ ] **T9 · M — Slide cleanup.** One command that *reports* near-
  misalignments, uneven gaps, and near-duplicate objects, then applies
  fixes selectively (report-first, never silently rearrange).
- [ ] **T10 · L — Per-object history (design first).** Per-object action
  log plus a small thumbnail timeline viewer ("what has this object looked
  like"); "undo just this object" where the ops don't conflict. Design
  note must settle interaction with the global undo stack.
- [ ] **T11 · L — Customisable ribbon (design first).** Reorder/hide
  ribbon buttons, persisted per user. HARD INVARIANTS: the ribbon never
  wraps to a second row (custom layouts still pass through
  `fitEditRibbon`), and buttons stay words + icons, never icon-only.

## 2. Styling, layout, text

- [ ] **T12 · M — Design tokens in style sets.** Extend style sets with
  named tokens (spacing scale, corner radius, accent colours) that
  *cascade*: changing a token updates every element referencing it, rather
  than elements holding baked-in copies.
- [ ] **T13 · L — Reusable components (design first).** Define a named
  component from a selected group (e.g. `FigureCaption`); instances stay
  linked; editing the definition updates every instance; per-instance
  content overrides (text, image). Builds on the slide-presets work.
  junoview owns its deck JSON, so unlike pptx this *is* serialisable —
  schema work lands in T30 first.
- [ ] **T14 · L — Relative layout & anchoring (design first).** Opt-in
  per object: size as % of slide, edge anchoring, centring — so a slide-
  size change or a longer title reflows instead of exploding. Explicitly
  NOT a full constraint solver; scope the minimal useful subset.
- [ ] **T15 · M — Text auto-fit and overflow.** Predictable shrink-to-fit
  toggle and a visible overflow indicator in the editor. NOT multi-box
  text flow (descoped).
- [ ] **T16 · M — Math in deck text.** LaTeX in deck text boxes via the
  already-pinned MathJax. Must work in exports and offline (the sw.js
  precache pins must keep matching loaders — `tests/test_js_contract.py`).

## 3. Figures — the scientific core

- [ ] **T17 · M — Figure + caption as one object.** An attached caption
  that moves/scales with its figure and survives layout operations.
- [ ] **T18 · M — Auto figure numbering + cross-references.** "Figure N"
  numbered by deck order; inline references ("see Figure 7") renumber when
  slides move. Depends on T17.
- [ ] **T19 · M — Figure provenance panel.** Show which notebook/cell
  produced a deck figure (`chains.py` already knows lineage), a jump-to-
  source affordance, and a staleness flag when the notebook output is
  newer than the deck's snapshot.
- [ ] **T20 · M — Update figures from source.** Re-sync deck figure
  snapshots from a re-executed notebook while preserving position, crop
  and size — regenerate 30 figures, deck updates itself. Respects the
  "renderer never executes notebook code" invariant: the notebook is
  re-run by the user; junoview re-reads stored outputs. Note the embedded-
  snapshot design (figures live outside the pres object for localStorage
  quota reasons).
- [ ] **T21 · M — Non-destructive crop/resize + hi-res originals.** Crop
  as a view transform over retained original bytes; exports choose an
  appropriate resolution. Watch localStorage quota (same note as T20).
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

- [ ] **T33 · M — Deck JSON schema doc + validator.** Formalise the deck
  format that `tests/test_deck_schema_parity.py` implies: a written schema
  and a `validate()` function. Foundation for T13, T32, T34.
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
