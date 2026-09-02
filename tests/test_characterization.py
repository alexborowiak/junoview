"""The whole renderer, pinned by the bytes it produces.

Every other test checks one behaviour. This one checks that rendering the
example notebook produces *exactly* the page it produced before -- which is what
caught the one real bug in the split from a single module into this package
(`dir(__builtins__)` returns the builtins module's names in ``__main__`` but
dict methods inside an imported module, so syntax highlighting silently started
marking ``.update`` as a builtin and stopped marking ``print``).

When you change the output on purpose, update ``EXPECTED_MD5`` in the same
commit and say in the message what changed and why. Run this to get the new
value::

    pytest tests/test_characterization.py -q
"""

from __future__ import annotations

import hashlib
from pathlib import Path

import pytest

from junoview.notebook.loader import load_doc
from junoview.render.page import render_page

EXAMPLE = Path(__file__).resolve().parent.parent / "examples" \
    / "example_climate_analysis.ipynb"

# md5 of the rendered page as a string.
#
# Deliberately hashed in memory rather than after writing to disk: `write_text`
# translates \n to \r\n on Windows, so the file's bytes -- and its hash -- differ
# by platform while the render itself does not.
#
# The package split itself changed nothing: this matched the old single-file
# renderer byte for byte. It has moved since only for the chrome fixes listed
# under "Fixed — interface" in CHANGELOG.md, each of which has its own test
# pinning the specific rule. If this is the ONLY test that fails, you changed
# the page's bytes without meaning to.
# Moved 2026-08-22 for the deck editor's typing and sections work: the
# Apply dialog and its property/scope pickers, user-defined text types,
# the Standardise text pane, slide sections in the strip, and the
# strip's resize handle and three display modes. All of it is editor
# chrome -- the document half of the page is unchanged -- and each
# piece is pinned by its own test in tests/test_slide_sections.py.
# ...and again for the flip book: a new item kind (k:'flip') holding
# many figures with arrows to step through them, the bindings that tie
# other items to a figure, the frames pane, and the export that
# explodes one flip book into one slide per figure. Editor chrome plus
# one render branch; the document half of the page is unchanged. Each
# piece is pinned by its own test in tests/test_flip_book.py.
# ...and again for style sets (auto-style) and arrangements
# (auto-arrange), then for matching: one slide's layout given to many, and
# object-to-object matching in both directions with its own property
# picker. Pinned per-piece in tests/test_matching.py.
# Moved 2026-08-23 for the code-review cleanups: dead code deleted (the
# shadowed docToast, seven lookups of elements no template carries and
# their wiring), 'use strict' in both IIFEs, shared helpers (webFetchParse,
# selIdxs, deep(), saveProject, itemLabel via annotLabel), the code-kind
# palette stated once (--ck-* tokens + window.SemView.kindFill), the
# comma-joined eye-slash rule, and deck.js's orientation header. No
# behaviour change intended; the id-contract and per-feature tests pin
# the pieces.
# ...and again 2026-08-23 for the boot-order fix: deck.js's load-time
# work (shell registry ingest, first-presentation load, chrome redraw,
# layout picker / autosave / save-button first paints) now runs from THE
# BOOT SEQUENCE at the IIFE's tail instead of mid-file, and app.js's
# rail auto-hide sub-IIFE became initRailAuto() called from its boot
# tail. Comment-and-position changes in the two embedded scripts only;
# no behaviour change intended.
# ...and again 2026-08-23 for the editor performance pass: item drags/
# resizes move the existing DOM nodes and run renderAnnots once on
# mouseup (deck.js startMove/startResize); the placed-frame builders
# (framePart / framePartFromSnap / frameFromVerCard) cache their
# prepared nodes with enumerated invalidation; ruler ticks, the grid
# and custom guides rebuild only when their inputs change, with a
# persistent transform-moved cursor; markDirty's localStorage draft
# write is debounced (~300ms, flushed on pagehide/present/load/rename);
# and app.js's mdClampScan batches its scrollHeight reads before its
# writes. Editor-script changes only; the document half of the page is
# unchanged.
# ...and again 2026-08-23 for the single-source icon delivery: the page
# now carries a window.SemIcons <script> (branding.py icons_js()); the
# emoji and one-off glyphs in card chrome, nav eyes, welcome/open-dialog
# rows, panes and dialog closes were replaced with <i data-ic> tokens /
# icon_svg() markup / bic() lookups; PB_ICO (app.js) and RAIL_ICO
# (deck.js) — copied icon path data — were deleted in favour of the
# map. Pinned by tests/test_icon_contract.py.
# ...and again 2026-08-24 for the ribbon finish: every remaining deck
# ribbon / thin-bar glyph prefix became an <i data-ic> token or a bic()
# write (PENDING_RIBBON emptied and deleted); fitQat now compacts the
# thin top bar (deck.js + .qat-* rungs in deck.css) and its File /
# Saved-to / Present menus float; the custom-view stylebar stopped
# wrapping (core.css + fitRibbon measuring it); icon-only controls grew
# aria-labels (templates + JS-built sites, and the rail row delete is a
# real <button>); help.html was walked against the current chrome; the
# rail's "+ New" labels dropped their doubled plus. Chrome-only; pinned
# by tests/test_icon_contract.py and the per-feature tests.
# Moved 2026-08-24 for single-copy figure payloads: the raw view used to
# embed a SECOND full copy of every output the cards already carry (a
# 100-cell notebook with ~28MB of figures rendered a 57.9MB page; that
# same page is now 29.9MB, and this example page shrank 2,671,747 ->
# 2,289,797 bytes, -14%). Card outputs now carry a data-jvout key and
# the raw view holds .rawph placeholders that app.js fills by cloning
# the card's node on first open; outputs the cards drop (hidden cells,
# single-step folds) stay fully embedded in the raw view. Pinned by
# tests/test_app_shell.py's raw-view single-copy tests.
# Moved 2026-08-25 for TASKS T26, the overview map: deck.js gained
# openOverview, deck.css the .deck-overview overlay, help.html a
# paragraph. Editor-only; pinned by tests/test_slide_sections.py's
# two overview tests.
# Moved 2026-08-25 making Delete respect a full lock: deleteSel was
# the one bulk verb that never asked lockedAll, so an item the help
# calls "off the canvas altogether" was deleted by Delete/Ctrl+X.
# It now keeps them and says so. Editor-only; pinned by
# tests/test_slide_editor.py's fourth lock test and verified in a
# browser both ways (locked alone refuses; locked + loose deletes the
# loose one and toasts what it kept).
# Moved 2026-08-25 un-shadowing moveSection: deck/ is one scope in
# fifteen files and the name was declared twice, so T23's "Move the
# section up/down" reached the drag-drop body instead of the nudge
# one. The drop body is now moveSectionTo. Pinned by
# tests/test_slide_sections.py and by a new duplicate-declaration
# guard in tests/test_js_contract.py; verified in a browser (the run
# moves and the toast fires, neither of which happened before).
# Moved 2026-08-25 for the RIBBON ICON SWEEP: eight new icons in
# branding.py (ungroup, forward, backward, rotl, rotr, fade, rise,
# zoom) and the buttons that needed them. Four ribbon buttons had
# words and no icon beside siblings that had one; six were icon-ONLY,
# which the house rule rejects twice over; two of those wore a
# NEIGHBOUR'S icon (fmt-forward drew `front`, fmt-backward `back`)
# and two borrowed a wrong one (rotate left/right drew `reset` and
# `reload`, which read as undo and refresh). The two colour buttons
# are renamed per selection and did it with textContent, which
# deleted any icon with the old word -- they take innerHTML + bic()
# now. And #deck-exit wrapped its token across two lines, so it had
# shipped with NO icon at all: icons() only ever caught the
# single-line shape it had failed to substitute, and now catches any
# surviving data-ic. Pinned by tests/test_icon_contract.py.
# Moved 2026-08-25 filling out the RIBBON LAYOUT CATALOGUE: the
# eighteen arrangements become a hundred and nine. Recreations of
# the applications people already use -- PowerPoint 2003 through
# 365, Word, Excel, Publisher, OneNote; Photoshop, Illustrator,
# InDesign, Premiere, After Effects, XD; Keynote, Google Slides,
# Canva, Figma, Sketch, Framer; LibreOffice Impress, Inkscape,
# Scribus, Blender; Notion, Miro, the reduced web ribbons -- plus
# eight experiments and the forty-nine one-tweak permutations, all
# in deck/07-ribbon-layouts.js. The gallery gained family headings,
# a filter over names, blurbs, families and group labels, and a
# count; deck.css their rules, help.html the paragraph. Escape in
# the filter now empties it
# before it closes the panel. Editor-only; pinned by
# tests/test_ribbon_layouts.py and verified in a browser by applying
# all 109 in turn -- no duplicates, no control lost, no ribbon taller
# than it ships, and Default restoring the markup exactly afterwards.
# Moved 2026-08-25 for RIBBON LAYOUTS: eighteen arrangements of the
# one ribbon. deck/07-ribbon-layouts.js is new (the engine, the
# gallery and the catalogue); 05 gained the generated tab strip and
# the gallery's doors, 25 the container-independent hiding of
# contextual controls and the contextual-tab fallback; deck.html
# gained ids on the four tool buttons and the two colour wrappers,
# deck.css the gallery, help.html a paragraph. Pinned by
# tests/test_ribbon_layouts.py and verified in a browser by applying
# all eighteen in turn.
# Moved 2026-08-25 for TASKS T36, the deck.js split: assets/js/
# deck.js became assets/js/deck/, fourteen fragments of the one
# IIFE joined by assets.deck_js(). The JAVASCRIPT IS UNCHANGED --
# the parts were verified to reassemble into the old file byte for
# byte -- so the whole of this move is the fourteen four-line
# headers that say each file is a fragment: 5,249 bytes, which is
# exactly the size change here. Pinned by test_js_contract.py,
# which now assembles and parses what ships.
# Moved 2026-08-25 for TASKS T35, the review export and its four
# content lints: deck.js gained WHAT THE DECK SAYS, IN WORDS (the
# markdown writer, revHeading, the lints and the panel);
# deck.html the File menu entry, deck.css the panel, help.html a
# paragraph. Pinned by test_editor_correctness.py's six T35 tests
# and verified in a browser, 18/18.
# Moved 2026-08-25 for TASKS T32, deck version history: deck.js
# gained WHAT THIS DECK USED TO BE (the IndexedDB snapshot store,
# the sid-paired deckDiff, withDeck, the History overlay and both
# restores) plus idbDel and the snapTake hooks on open and on both
# manual saves; deck.html the File menu entry, deck.css the panel,
# help.html a paragraph. Pinned by test_version_history.py's six
# T32 tests and verified in a browser, 18/18.
# Moved 2026-08-25 for TASKS T31, private presenter annotations:
# deck.js gained THINGS ONLY YOU CAN SEE (the privShown predicate
# beside the existing hide guard, the opt-in private render on
# buildSlideNode, the .pptx writer's own guard and the canvas-menu
# door); deck.css the marking, help.html a paragraph; deck_schema
# and DECK-FORMAT gained the ANNOT_COMMON table. Pinned by
# test_visibility.py's six T31 tests and verified in a browser,
# 14/14.
# Moved 2026-08-25 for TASKS T30, finding a slide mid-talk:
# deck.js gained FINDING A SLIDE WHILE YOU ARE TALKING (one
# slideHits matcher), a search box in T26's overview map with '/'
# as its door while presenting, and the presenter window's own
# box wired from this side; deck.css their styles, help.html a
# paragraph. Pinned by test_present_mode.py's six T30 tests and
# verified in a browser, 16/16.
# Moved 2026-08-25 for TASKS T29, rehearsal timing: deck.js gained
# WHAT A REHEARSAL LEAVES BEHIND (the lazily minted slide `sid`,
# the run recorder hung off setUIMode and go(), and the stats) plus
# the Rehearsals tab; deck.html the tab and the per-slide line,
# deck.css their styles, help.html a paragraph; presentations.py
# and deck_schema.py carry `sid`. Pinned by test_present_mode.py's
# six T29 tests and verified in a browser, 16/16.
# Moved 2026-08-25 for TASKS T28, rich speaker notes: deck.js
# gained WHAT A NOTE IS ALLOWED TO BE (a small escape-first
# markdown with scheme-whitelisted links) and THE ROOM TO WRITE
# THEM IN (the overlay editor); the presenter view now reads notes
# through the same renderer; deck.html gained the Bigger editor
# button, deck.css the overlay and the markdown, help.html a
# paragraph. Pinned by tests/test_markdown_notes.py's six T28
# tests and verified in a browser, safety cases included.
# Moved 2026-08-25 for TASKS T27, object continuity ("Magic Move"):
# deck.js gained the HOW A SLIDE ARRIVES section -- the s.trans
# field, the section-level default T23 said it lacked, the FLIP
# capture/play pair around go()'s refresh, and the picker rows on
# both film menus; presentations.py and deck_schema.py keep the new
# key. Pinned by tests/test_slide_sections.py's five T27 tests and
# verified in a browser as an A/B against Cut.
# Moved 2026-08-25 for TASKS T24+T25, optional slides and named
# cuts: deck.js gained the cut model and the playback filter,
# presentations.py and deck_schema.py the two new slide keys and
# the deck key; help.html two paragraphs. Pinned by
# tests/test_slide_sections.py's three cut tests.
# Moved 2026-08-25 for TASKS T23, sections as units: deck.js
# gained moveSection/dupSection/sectionPos and the {sn} tokens;
# help.html a paragraph. Editor-only; pinned by
# tests/test_slide_sections.py's two section-unit tests.
# Moved 2026-08-25 for TASKS T22, figure lint: deck.js gained
# figLint and its rows in the standardise pane; help.html a
# paragraph. Editor-only; pinned by tests/test_slide_editor.py's
# three figure-lint tests.
# Moved 2026-08-25 for TASKS T21, hi-res originals: deck.js keeps
# a picture's full bytes in IndexedDB and shows a display copy,
# swapping the originals in at export; help.html a paragraph.
# Editor-only; pinned by tests/test_slide_editor.py's two
# original-retention tests.
# Moved 2026-08-25 for TASKS T19+T20, figure provenance and
# re-sync: deck.html gained #provpane, deck.js the pane and
# resyncFigure, help.html a paragraph. Editor-only; pinned by
# tests/test_slide_editor.py's three provenance tests.
# Moved 2026-08-25 for TASKS T18, figure numbering: deck.js gained
# figNumbers/figSubst, hoisted orderedIdx to the top level, and
# added the insert rows; help.html a paragraph. Editor-only;
# pinned by tests/test_slide_editor.py's three numbering tests.
# Moved 2026-08-25 for TASKS T17, figure + caption: deck.js gained
# the tie (cap/capOf), its follow hooks and dropTiedCaptions;
# help.html a paragraph. Editor-only; pinned by
# tests/test_slide_editor.py's four caption tests.
# Moved 2026-08-25 for TASKS T14, anchoring: deck.js gained the
# ANCHORING section (anchorPos/anchorSet/anchorFix) and its menu
# rows; DECK-FORMAT.md documents a.anch; help.html a paragraph.
# Editor-only; pinned by tests/test_slide_editor.py's three
# anchoring tests.
# Moved 2026-08-25 for TASKS T13, components: deck.js gained the
# COMPONENTS section and its menu rows; presentations.py and
# deck_schema.py carry the new deck key; help.html a paragraph.
# Pinned by tests/test_slide_editor.py's four component tests.
# Moved 2026-08-25 for TASKS T15, text auto-fit: deck.js gained
# fitTexts and the fit toggle, deck.css the .an-overflowing mark,
# help.html a paragraph. Editor-only; pinned by
# tests/test_slide_editor.py's three fit tests.
# Moved 2026-08-25 for TASKS T12, design tokens: deck.js gained
# the DESIGN TOKENS registry and its resolver, the token swatches
# and editor; deck.css the --tk-rad corner and the chip rules;
# presentations.py carries the new deck key. Pinned by
# tests/test_slide_editor.py's four token tests and the sentinel
# in tests/test_deck_schema_parity.py.
# Moved 2026-08-25 for TASKS T16, maths in deck text: deck.js
# split isMaths/hasMaths and typesets at the text commit;
# help.html gained a paragraph. Editor-only; pinned by
# tests/test_slide_editor.py's two maths tests.
# Moved 2026-08-25 for TASKS T11, a ribbon of your own: deck.js
# gained the customiser (right-click the ribbon), deck.css the
# .rbn-hid / .rbn-cust rules, help.html a paragraph. Editor-only;
# pinned by tests/test_slide_editor.py's three ribbon tests.
# Moved 2026-08-25 for TASKS T10, per-object history: a fourth
# report pane (deck.html #objhist, deck.js objHistory/ohRestore/
# ensureOids, deck.css .oh-* rows, help.html a paragraph).
# Editor-only; pinned by tests/test_slide_editor.py's three
# object-history tests.
# Moved 2026-08-25 fixing two T7 defects: the gap marks are now
# dropped on every mousemove (Alt mid-drag used to freeze them) and
# clearSnapGuides names .snapgap-lab. Pinned by the two
# spacing-guide tests in tests/test_slide_editor.py.
# Moved 2026-08-25 for TASKS T9, tidy up this page: a third
# report pane (deck.html #tidypane, deck.js tidyFindings and the
# rows it builds, help.html a paragraph). Editor-only; pinned by
# tests/test_slide_editor.py's three tidy tests.
# Moved 2026-08-25 for TASKS T8, match layout: deck.js gained
# readPattern/applyPattern/bandMates and a third match-bar
# direction, help.html a paragraph. Editor-only; pinned by
# tests/test_slide_editor.py's three layout-match tests.
# Moved 2026-08-25 for TASKS T7, spacing guides: an equal-gap snap
# now marks BOTH gaps and measures them in mm (deck.js gapCands /
# bestGap / drawGapMarks, deck.css .snapgap-ref + .snapgap-lab,
# help.html one sentence). Editor-only; pinned by
# tests/test_slide_editor.py's two spacing-guide tests.
# Moved 2026-08-25 for TASKS T6, find & replace for formatting:
# deck.html gained the Text/Formatting switch and the panel the
# formatting half builds into, deck.js the sweep that fills it,
# deck.css its rows, help.html the paragraph. Editor-only; pinned
# by tests/test_slide_editor.py's three find-formatting tests.
# Moved 2026-08-25 for TASKS T5, select by type / appearance:
# deck.js grew SELECT_CRIT and the two menus that read it, plus a
# fontLabel beside fontCss/fontPpt; deck.css gave the canvas menu a
# max-height; help.html the paragraph. Editor-only; pinned by
# tests/test_slide_editor.py's three select-by tests.
# Moved 2026-08-25 fixing the T4 guide layer: guidesEmpty replaces
# two disagreeing emptiness tests in deck.js. See the test in
# tests/test_poster_craft.py.
# Moved 2026-08-25 for TASKS T4, temporary design guides: deck.js
# grew guide BOXES beside the ruler-dragged guide lines (a tool, a
# right-click entry and the ruler corner to draw one; edges and
# middles join the snap targets), deck.css the .cg-box rules,
# help.html the paragraph. Editing aids only -- a guide is not an
# annotation, so nothing about it can reach an export. Pinned by
# tests/test_poster_craft.py's three guide-box tests.
# Moved 2026-08-25 for TASKS T3, granular object locking: deck.js
# grew the LOCKS section (a position-only lock beside the full one,
# a three-state pane button and the menu rows that name them),
# deck.css the .an-pinned / .sp-act.on.half rules, help.html the
# paragraph. Editor-only; pinned by tests/test_slide_editor.py's
# three lock tests.
# Moved 2026-08-24 for TASKS T2, clone objects: deck.js grew the CLONES
# section (Ctrl+D on a whole selection, Alt-drag to drag a copy) and
# help.html the paragraphs for it and for T1's paste modes. Editor-only;
# pinned by tests/test_slide_editor.py's two clone tests.
# Moved 2026-08-24 for TASKS T1, paste in place / paste at cursor:
# deck.js grew pasteBuf's three placement modes, a canvas right-click
# menu to reach them from a point, and the pointer capture they read;
# deck.css grew the .canvas-menu rules. Editor-only; pinned by
# tests/test_slide_editor.py's three paste tests.
# Moved 2026-08-26 for T94 (filed as T60; renumbered 2026-08-30, two
# tasks had the number): Default gained a contextual Object tab and the
# tab strip gained the permanent Ribbon layouts door; help/README now tell
# ribbon arrangements from slide layouts. Editor-only, pinned by
# tests/test_ribbon_layouts.py and tests/test_slide_editor.py.
# Moved 2026-08-26 for TASKS T56: the gallery now follows a side ribbon,
# closes with the editor, resets moved contextual controls, and warns when
# a horizontal layout still cannot fit. Editor-only, pinned by
# tests/test_ribbon_layouts.py.
# Moved 2026-08-26 for TASKS T59: permanent Design buttons now open the
# deck's token editor and the page tidy report without a selection; every
# ribbon layout places them explicitly. Editor/help changes, pinned by
# tests/test_slide_editor.py and tests/test_ribbon_layouts.py.
# Moved 2026-08-26 for TASKS T54: menu and pane actions now use coherent,
# action-specific artwork, and the object action says Duplicate rather than Copy.
# tests/test_icon_contract.py pins the individual icon and label decisions.
# Moved 2026-08-26 for TASKS T55: the object-history and provenance panes
# now follow the primary selection and refresh on the events that change
# their subject. Pinned by tests/test_slide_editor.py.
# Moved 2026-08-26 for TASKS T46: Match Layout now refuses cross-slide
# geometry before applying captured indexes. Pinned by tests/test_matching.py.
# Moved 2026-08-26 for TASKS T42: clone and paste now re-issue figure,
# component-instance and group identities; component sync reads live indexes.
# Pinned by tests/test_slide_editor.py and tests/test_poster_craft.py.
# Moved 2026-08-27 for TASKS T43: resize, figure fitting, caption following,
# snap/arrow rectangles and PowerPoint boxes now resolve anchored positions.
# Pinned by tests/test_slide_editor.py and tests/test_pptx_export.py.
# Moved 2026-08-28 for TASKS T45: table cells join the find/replace model,
# and its formatting half follows live object selection without losing edits.
# Pinned by tests/test_slide_editor.py.
# Moved 2026-08-28 for TASKS T47: explicit saves, serial history migration,
# whole-deck restore and lazy full-slide comparisons complete version history;
# saved custom types also normalise safely before boot. Pinned by
# tests/test_version_history.py and tests/test_slide_sections.py.
# Moved 2026-08-29 for TASKS T48: the in-talk Running late control, filtered
# presenter previews/counts, Notes teardown, and complete rehearsal exit/
# repaint paths now agree. Pinned by tests/test_present_mode.py and verified
# in Edge across 23 presenter, cut, pane and lifecycle checks.
# Moved 2026-08-29 for TASKS T49: review text and its lints share one public
# population, and visible private SVG arrow/line ink is marked in the editor
# and presenter after every draw. Pinned by tests/test_visibility.py and
# verified in Edge across the review Blob and all three render audiences.
# Moved 2026-08-29 for TASKS T50: named cuts can be renamed and deleted as
# one undoable lifecycle, active filtering belongs to one open deck/run, and
# explicit optional/not-shown words make the cut state visible in the strip.
# Pinned by tests/test_slide_sections.py and verified in Edge across 39 cut,
# persistence, undo, navigation and run-lifecycle checks.
# Moved 2026-08-29 for TASKS T51: normPres now keeps the applied slide-template
# id (`lay`) so all layout galleries reselect it after a saved-deck reload.
# The Python API/schema/public-surface changes do not enter the rendered page.
# Pinned by schema parity and verified in Edge across 10 template-round-trip
# and gallery-selection checks.
# Moved 2026-08-29 for TASKS T52: guide boxes gained per-side resize handles,
# corners and a move grip (markup + CSS), custom guides gained a show/hide
# view toggle and the guide-box tool gained a ribbon button -- so deck.html,
# deck.css and four deck.js fragments all changed, and both new control ids
# are placed in all 108 ribbon arrangements. Pinned by tests/test_poster_
# craft.py and tests/test_ribbon_layouts.py, and verified in Edge across the
# resize, move, hide/show, undo and clear-confirm paths.
# Moved 2026-08-29 for TASKS T53: the re-typeset gate is slideHasMaths, which
# can see a title slide's title and subtitle (they are strings on the slide,
# not annots, so the old annot-only gate threw their LaTeX away on every layer
# rebuild); opening a typeset box for editing puts the source back under the
# caret; and the PowerPoint export flattens an equation to characters instead
# of shipping literal "$$ ... $$", counting it so the existing warning fires.
# Three deck.js fragments changed. Pinned by tests/test_slide_editor.py and
# tests/test_pptx_export.py, and verified in Edge across 19 checks.
# Moved 2026-08-29 for TASKS T57, the gathered small ones: an explicit Cut is
# now a real per-slide override (with a row for going back to the section's
# default), a flip animates content zoom and crop as well as the box, a card's
# words -- body AND code -- join the presenter's search, "Put the ribbon back
# to normal" restores order instead of asking for a reload, the pane's
# Duplicate keeps the whole batch, the size-only Arrange verbs stop skipping
# position-locked items, speaker notes cost one undo entry per sitting rather
# than one per keystroke, an Alt-click that never moved leaves no invisible
# copy, and the Header/Footer prompts and tooltips name {sn}/{sN}/{sec}.
# Six deck.js fragments and deck.html changed. Pinned by the four editor test
# files, and verified in Edge across 39 checks.
# Moved 2026-08-29 for TASKS T58, the figures group: the figure-reference list
# can appear at all (it was built from ids nothing had minted yet), a caption
# is something you ADD and not only a tie between two objects, deleting a
# figure unties its caption and freezes the number it was showing, inserting a
# figure token keeps the rich runs, a component keeps the tie, a position lock
# stops a caption being dragged by its figure, a flip book has provenance, the
# lineage jump leaves the deck it was hidden behind, there is a deck-wide
# figure update, the retained originals reach the PDF and the .pptx and a flip
# book's frames retain one at all, and the figure lint reads the sizes it
# collects, knows about trims and is named where it is opened. Six deck.js
# fragments, deck.html, deck.css and two new icons. Pinned by test_provenance
# and test_slide_editor, and verified in Edge across 30 checks.
# Moved 2026-08-29, T52 follow-up: `guides` joins normPres's deck-level key
# loop (it was in histRestore's list and not this one, so guides survived
# Ctrl+Z and the draft and died on re-open), and the help paragraph that told
# the reader to drag a guide box by any edge to MOVE it — which T52 made
# resize — is rewritten to match the code, with R/G/H/B added to the only
# keyboard table in the repo. deck.js and help.html changed.
# Moved 2026-08-29 for T60/T72/T73: an empty LIST no longer deletes itself on
# blur (a list is deliberately empty for a moment, and sanitizeRich strips the
# bare <li> that would have saved it), the delete that does happen says
# Ctrl+Z, a double-click inside a box already being edited no longer wipes the
# word the browser just selected, four clicks take the whole box, and a
# centred list keeps its markers with its words. deck.js only.
# Moved 2026-08-29 for T71/T81/T82/T83, the chrome placement cluster: the
# Slides group reorders so Layouts sits under New slide and Match under
# Duplicate; Home's slide-layout door is renamed Layouts to match Design's,
# so the two read as one feature; #et-cancel moves to the END of the Insert
# group (in the markup and in all 108 arrangements) so un-hiding it appends
# instead of shoving every later control along; and the maths palette keys
# and the text-type menu grow enough to read a glyph. deck.html, deck.css
# and the layout catalogue.
# Moved 2026-08-29 for T62: a title's inner span carried font-weight:600 in
# CSS, which is more specific than the weight the renderer writes on the
# .an-title div -- so Bold changed the model and nothing on screen, and a
# title looked bold whatever you did. The span now reads --ttl-w, which the
# renderer sets only once Bold has been touched: untouched 600, on 700,
# off 400. deck.css and deck.js.
# Moved 2026-08-29 for T65: every box gains four SIDE resize handles (a text
# box six, having no height of its own), one-axis drags leave the other axis
# alone, `a.lockar` is a per-item Keep-shape with Shift as its momentary
# opposite, and a Size & position pane types W/H/X/Y in page millimetres
# through anchorSet. deck.html, deck.css, five deck.js fragments, the
# layout catalogue (two new atoms x 108), deck_schema.py and DECK-FORMAT.md.
# Moved 2026-08-29 for T63: startMarquee was the one drag-starter in the file
# that never called preventDefault, so a marquee press also began a NATIVE
# text selection and dragged it over every box the band crossed -- the page
# going blue, which is 'it just results in everything being selected'. Plus a
# lost mouseup no longer leaves the band live, and Ctrl+A now selects the
# objects instead of falling through to the browser's Select All.
# Moved 2026-08-29 for the second hand-test wave, T69/T70/T77/T78/T80/T89/
# T92/T93: a per-deck hideTrace flag (four-place plumbing) with a Present-menu
# door, playback sized without editing padding, the saved-to chip fitted and
# moved beside Save with a settable autosave cadence, the home view's top
# folded, the notebook actions collapsed out of the strip's height, the strip
# clamped against the ribbon's floor, real doors for the five right-click-only
# features, pasted code detected and highlighted, and Duplicate-without-its-
# source. deck.html, both stylesheets, app.js and six deck.js fragments.
# Moved 2026-08-30 for T72 and T85. T72: sanitizeRich now counts `li` as
# rich -- the editable element IS the <ul>, so its innerHTML is a bare <li>
# run and querying for ul/ol found nothing, which meant every unstyled list
# had its markup deleted on every blur -- and committing content with no <li>
# left now drops a.list, so you can leave a list from inside it. T85: the
# install door is offered whenever this is the web build rather than only
# while the browser has a prompt pending, and help.html gains an install
# section and loses a stale reference to a single-file semantic_render.py.
# Moved 2026-08-30 for T61: the insert tool is Object rather than Cell,
# and its tooltip names all three sources a frame can take.
# Moved 2026-08-30 for T66: Match slide is armed and pointed at the
# thumbnails now, so the button's tooltip says so, the match menu grows
# two rows that arm it, and the strip gains a picker look.
# Moved 2026-08-30, T61 follow-up: the empty-slide hint is finally built
# (the stylesheet had dressed it for both themes while nothing created
# it), the object chooser gains a path row and the class that makes it a
# column, and the clipboard road honours the waiting frame.
# Moved 2026-08-30 for T74: Markdown boxes. Two new controls (Insert >
# Markdown, and Edit markdown beside Edit equation) placed in all 108
# ribbon arrangements, the editor dialog, the .an-md rules, and one new
# documented annot field.
# Moved 2026-08-30 for T76: the build badges are gated on the Timeline
# pane being open, the filmstrip gains a build-count mark, and the
# Timeline button's tooltip says it is the switch.
# Moved 2026-08-30 for T86: flip books gain a Stepping chooser in the
# frames pane, a button-per-figure bar, a stop timeline that lets an
# animated book's frames follow its build, and a tie hint that no longer
# hides itself.
# Moved 2026-08-30 for T75: the rail gains one search field over both
# strips, a clear button, an empty-state line and a Ctrl+K.
# Moved 2026-08-30 for T88: present mode gains a Talk button and panel
# (skip builds, text size), their keys, and a --talk-text multiplier in
# the three places a page sizes text.
# Moved 2026-08-30 for T64: Crop splits into a button that trims and a
# caret that holds the shapes, the shapes are points drawn inside the
# trim box, and a free-hand lasso writes a.crop.path.
# Moved 2026-08-30 for T91: app.js now accepts .md/.tex/.csv and friends
# in its drop handler, and three strings that said "ipynb" say what the
# tool can actually open.
# Moved 2026-08-30 for T90: the version history is a tree. Snapshots
# carry a parent and a branch name, the rail draws the shape, and the
# panel gains a Start a branch button and an on-which-branch chip.
# Moved 2026-08-30 for T87: a Design button placed in all 108 ribbon
# arrangements, the design surface it opens, and its stylesheet.
# Moved 2026-08-30 for the parallel-branch reconcile: guides un-hide on
# a ruler drag, beginEdit restores a typeset box's source for rich boxes
# too, the Same-size gate matches its verb, and the two notes-pane time
# fields go quiet.
# Moved 2026-08-30 for T98: 00-page.js's own header said the deck was
# "ONE IIFE, in fourteen files" and DECK_PARTS has held fifteen since
# 99-boot.js was split out. A comment, so the four bytes are the whole
# change -- but it is the first line an agent reads when it opens a
# fragment, and the point of T98 is that the structural claims are
# true. The count is gone rather than corrected, so the sixteenth
# fragment cannot re-stale it.
# Moved 2026-08-30 for T100, the doors to the sources T91 built: app.js's
# window drop handler now filters on SRC_RE instead of carrying its own
# ipynb-only regex (so a dropped .md/.tex/.csv reaches Python, in the web
# build as well as the app) and posts the file's TEXT to /api/parse rather
# than notebook JSON; the Open dialog's typed-path branch asks the same
# question, so `paper.tex` opens instead of being listed as a folder; the
# file browser grows a fourth row kind for sources, labelled with the KIND
# the server read off SOURCES; and four strings that promised .ipynb only
# say what the tool can actually open, including the file input's accept
# list. page.html and app.js.
# Moved 2026-08-30 for T107: cropped pictures and slide transitions now
# reach PowerPoint. pptx.js grew srcRect (in 1000ths of a percent, before
# <a:stretch> or the part is rejected) with the shape's own box shrunk to
# the visible fraction and moved to where it was -- srcRect trims the
# source and fillRect then STRETCHES the remainder, so the insets alone
# would blow the picture back up -- plus prstGeom for a preset crop
# outline and a <p:transition> after <p:clrMapOvr>. The deck hands over
# a.crop, its shape and transFor(ent.i), and counts only the freehand
# outlines that really cannot be carried. help.html's honesty list is
# rewritten around what is true now, and gained the four losses it never
# mentioned: notes, builds, links and the freehand crop.
# Moved 2026-08-30 for T108: speaker notes reach PowerPoint's Notes page.
# pptx.js grew a notes master, a notesSlide part per slide that has notes,
# relationships in both directions, the notesMasterIdLst that must sit
# between sldMasterIdLst and sldIdLst, and content types for both new part
# kinds; the deck hands over ent.s.notes and the toast says how many slides
# carried them. A deck with no notes produces exactly the bytes it did
# before -- none of the new parts is written unless something needs it.
# Moved 2026-08-30 for T109: a placed cell showing a TABLE now scrapes into
# a real PowerPoint table instead of being counted as unconvertible --
# pptx.js's table builder already tolerated the shape, and grid:1 is what
# keeps the rules. And the export names what it will cost BEFORE writing the
# file: pptxLosses runs the same pptxItems enumeration dry, so it can never
# disagree with the export, and asks only when something really will be
# lost, and the post-export toast stops sending people to the PDF for a
# table. deck.js only.
# Moved 2026-08-30 for T104: opening the deck full-screen now makes the eight
# surfaces of the document application behind it `inert` and aria-hidden, and
# moves focus into the editor; closing restores all of it and puts focus back
# where it was. CSS had already isolated scroll, pointer and paint, but
# `inert` is not a CSS property, so the notebook underneath stayed in the tab
# order and the accessibility tree. Named surfaces rather than a sweep over
# body's children, because the deck reaches OUT to page-level overlays.
# deck.js only; browser-verified both ways.
# Moved 2026-08-30 for T105: a picture on a slide can say what it shows.
# Every image the deck drew carried a hard-coded alt="", so renderAnnots
# grew altAttrs (three states: written, decorative + aria-hidden, or the
# object's own name); the five genuinely decorative thumbnails now say so;
# the canvas menu gained an Alt text row and setAltText; reviewLints gained
# a fourth lint for the pictures nobody has decided about; and pptx.js emits
# descr. deck.js, pptx.js, deck_schema.py and DECK-FORMAT.md, which also
# gained the `name` row it had been missing all along.
# Moved 2026-08-30 for T121: the review became one report. Two lints that
# restate what the deck already knew (the talk does not fit its slot; a slide
# is a copy of an earlier one), the .md export now carries the findings as
# well as the readable text, and a JSON door beside it for a check that is
# not a person. deck.js plus the .rv-head rule that makes the title, not the
# buttons, give way now that there are four of them.
# Moved 2026-08-30 for T118: any object can be a link. A new `link` field
# (allow-listed: a URL through the markdown allowlist, or an internal jump
# held by the target slide's sid), marked in the DOM from applyCommon and
# followed by the slide's ONE existing delegated click handler, a keyboard
# path for the role="link" it sets while presenting, a canvas-menu door
# that resolves a typed slide NUMBER to a sid once, a review lint for a
# jump whose target has been deleted, and the hover/focus outline.
# deck.js, deck.css, deck_schema.py and DECK-FORMAT.md.
# Moved 2026-08-31 for T133: the three prepared-frame cache stores moved
# above EMBED's machinery in 10-decks. `var projectPres=...map(normPres)`
# runs AT EVAL, and a saved deck carrying inline emb walked embStore ->
# dropFrameCache -> Object.keys(frameNodeCache) six hundred lines before
# the declaration -- hoisted name, undefined value, and the whole editor
# silently dead at boot. Comment-and-position change only.
# Moved 2026-08-31 for T126, the Talk panel finished to the T88 ask:
# three per-type size rows (Headings / Body text / Captions) multiplying
# on top of the global size, bucketed by the box's named style with
# title-slide titles counting as headings; a #pl-talk row in the Present
# menu that presents with the panel open; the animations toggle now also
# stops slide transitions (playFlip gains the talk gate); and the reset
# button IS the size readout -- the real percentage used to sit in a
# hidden span while the label said 100% forever. deck.html and five
# deck.js fragments; driven live, each row scaling only its own kind.
# Moved 2026-08-31 for T127: where you are in the version tree survives a
# reload. A small head pointer {h, br} now lives beside the IndexedDB
# index, written by every head-mover (snapWrite, histRestoreDeck) and
# carried by rename; histSeed reads it back through the history queue on
# every load, validating against the index and falling back to the TIP
# for pre-pointer histories; openDeck's opening snapshot gates on the
# seed via snapTake's existing ready parameter. deck.js only.
# Moved 2026-08-31 for T128: pasted PROSE lands as an ordinary text box
# (it used to fall off the end of the paste handler and do nothing), the
# code toast names the way out, and Ctrl+Shift+V with an empty internal
# buffer arms one PLAIN paste -- the canvas's escape from a wrong code
# detection, mirroring the in-box escape. 30-format-bar and 55-sections.
# Moved 2026-08-31 for T129, three doors: the canvas right-click menu gains
# the two/three match-objects verbs (armMatch directly), an "Apply this look
# to..." row for a selected non-text object, and the Place-component rows
# move OUT of the selection branch so an empty canvas has a component door.
# 25-selecting.js only.
# Moved 2026-08-31 for T130, the design surface closer to the described
# view: the put gesture gains a slide scope (every slide / a section in
# use / a typed range) and names it in the toast; sheet cells' tooltips
# carry the slide's NAME; the outline sheet gains its own scope; and each
# object gets a drag proxy inside the miniature — "move it from here" —
# writing through shiftAnnot so tied captions travel, with a plain click
# still navigating. 50-review-and-overview.js and the dg-* rules.
# Moved 2026-08-31 for T131: the Layout ideas chooser (previews of THIS
# slide's objects under the three tidy presets and your best-fitting saved
# arrangements, computed by running the real arrangeSlide/arrApply on a
# clone inside withDeck; click applies) with a row in BOTH Layouts menus --
# and Home's menu gains parity with Design's, which had been silently
# hiding the tidy row and the arrangement rows. deck.html, 35-arranging.js,
# deck.css, and one new runtime id in the contract test.
# Moved 2026-08-31 for T123: "Update figures" is one verb that reaches the
# disk. APP.reloadTab reloads a tab in place (/api/open with stem, quiet
# mount, completion returned; URLs decline); resyncAllFigures reloads every
# stem a placed frame references FIRST, then compares; the menu label and
# toasts say "source" because a .tex or .csv is as refreshable as a
# notebook since T100. app.js, 35-arranging.js, deck.html.
# Moved 2026-08-31 for T124: the rail says what kind of thing each tab is.
# Non-notebook shells wear data-kind + a kind chip in the open-files list
# (the heading follows the contents), the Insert-note pencil is offered
# only where a note CELL can land (.ipynb), and a git commit of any source
# now opens (git show -> doc_from_text). The notebook page moves only
# because it inlines app.js/core.css; its shell markup is byte-identical.
# Moved 2026-08-31 for T125: the notebook/source boundary written down.
# help.html's Open section now says what else opens (every door) and what
# stays notebook-only on purpose (cells: Plot trace, dependency graph,
# variables, note insertion, figure locks); ARCHITECTURE.md gained the
# "Notebook-first, on purpose" section with the rule for new features.
# Moved 2026-08-31 for T106: an authorable reading order. sl.rord (oids,
# first-to-last) overlays orderedIdx's sweep so builds, figure numbers,
# flip matching and the review export all follow it; the Reading order
# panel (right-click > slide, or the Timeline pane) writes it, with
# number badges CSS-gated on the panel like the T76 build bubbles.
# 35-arranging.js, 45-images.js, 20-notes-and-tables.js, 25-selecting.js,
# 10-decks.js, deck.css; presentations.py + deck_schema.py + DECK-FORMAT.md
# carry the key.
# Moved 2026-08-31 for T117: native data-bound charts. A chart annot
# ({k:'chart', ct, cats, series}) draws as plain SVG (new deck part
# 47-charts.js), is born from a placed table or table card ("Turn into a
# chart", keeping ref so Update-figures re-reads the numbers), edits via
# the chart-data dialog, and exports as a REAL <c:chart> part PowerPoint
# restyles natively (pptx.js chartFrame/chartXml). Help's export list
# also corrected: speaker notes have travelled since T108.
# Moved 2026-08-31 for T110: builds and click actions reach PowerPoint.
# pptxItems attaches animStep/animType and the resolved link to whatever
# each annot pushed; pptx.js writes a real <p:timing> main sequence (one
# click per build step, appear exact, everything else an honest fade,
# counted) and hlinkClick rels (External URL / hlinksldjump to the
# mapped output slide). Verified in PowerPoint itself over COM: fade on
# click, appear with-previous, the second click, the URL and the slide-2
# jump, and both T117 charts read back as real charts. help.html's
# export list rewritten to today's truth (tables travel since T109).
# Moved 2026-08-31 for T113: .xlsx is a source (user decision: values
# only, stdlib only). sources.py gained parse_workbook + doc_from_bytes
# (the bytes seam every door now routes through); app.js gained BIN_RE +
# fileB64 + the base64 branches in both drop paths; web-loader.html the
# parseB64 bridge. The page moves because it inlines app.js.
# Moved 2026-08-31 for T115: masters — looks slides inherit live.
# pres.masters {id:{name,bg,cmp,pos}} + sl.mast; furniture is a
# COMPONENT rendered view-mode into an inert .slide-mast layer on every
# paint (never stamped), bg resolves slide > master > deck, pptx bakes
# the look (flattening recorded), and the Masters panel hangs off both
# Layouts menus and the slide right-click.
# Moved 2026-08-31 for T134: the dead second deck-status/qat-auto pair
# left behind by T70 is gone (JVUX-04), and a unique-id test now fails
# on ANY duplicate id in any template.
# Moved 2026-08-31 for T135: one owner for every transient menu
# (JVUX-02). overlayShow/overlayHide in 45-images + overlayBoot from
# 99-boot; File, Present, Background, Layouts, Page, Thumbnails,
# shapes, text-style caret, autosave, save-target, View overflow and
# the notebook-list More menu all route through it — at most one
# shows, aria-expanded always resets, Escape closes.
# Moved 2026-08-31 for T136: one owner for the inspector panes
# (JVUX-03). paneShow/paneHide + PANE_IDS/PANE_BTN in 05-figures
# replace eleven diverged hand-lists of sibling selectors; every
# show/close site routes through them and trigger aria-pressed is
# re-derived from the DOM.
# Moved 2026-08-31 for T137: the context menu became readable
# (JVUX-01). One 308px column instead of the leaked 3-column icon
# grid, the advanced sections folded behind one counted "More" row
# (7 visible rows instead of 31), role=menu/menuitem, and every
# floatAt popup now closes on Escape. Includes the [hidden] display
# fix the first screenshot caught.
# Moved 2026-09-01 for T141 + T144: selection no longer steals the
# tab while an inspector pane is open (JVUX-06), and Chart (Insert),
# Masters (Design) and the empty notebook column got worded doors
# (JVUX-11). 25-selecting.js, deck.html, 35-arranging.js,
# 55-sections-and-strip.js, deck.css.
# Moved 2026-09-01 for T140: the label glossary. Timeline->Animations,
# Clear slide->Remove animations, Maths->Equation, QR->QR code,
# Front/Back->Bring to front/Send to back, Keep shape->Lock ratio,
# Design-in-Design->Style system, "How it appears"->"Entrance
# effect" — plus the four lies: the stale Background tooltip, the
# zero-target "Put all 0 of them there" primary button, the style
# preview on chrome instead of the page colour, and the Output
# tooltip describing two of its three states.
# Moved 2026-09-01 for T146: words plus icons in the rendered UI.
# Theme/Support/Help worded in the document toolbar (the deck worded
# its own on 2026-08-23 and the doc toolbar was left behind), the
# panel foot pair worded with distinct icons, the deck Ko-fi link
# worded. Verified single-row at 1280 wide.
# Moved 2026-09-01 for T139 (user decision): 109 ribbon layouts
# became nine — Default plus eight genuinely different ways of
# working; ~5,500 lines of catalogue deleted, stale stored ids land
# on Default with a one-time notice that waits for the deck to be
# on screen, and the chooser no longer sits inside the tablist role.
# Moved 2026-09-01 for T143: the File menu grew its five named
# sections (file / sources / export & share / page / careful) with
# the destructive pair last in warn colour, and the autosave button
# stopped painting itself as a second primary action beside Save.
# Moved 2026-09-01 for T142: the Review centre. One worded Review
# door (the old Check) opens a pane that runs the five existing
# engines dry for their counts — print, layout, style, content,
# source freshness — and opens each existing surface from one
# place; nothing was rewritten and T136 keeps them un-stackable.
# Moved 2026-09-01 for T147 (JVR-01): APP.reloadTab reports a tri-state
# instead of a bare false, and the update-figures toast names the
# sources whose read failed rather than claiming every figure matches
# its source.
# Moved 2026-09-01 for T148 (JVR-03): the outline sheet's drag proxies
# now cover arrows too, whose handle is the drawn line's bounding box
# (arrowEnds) floored to a grabbable size, and a line proxy yields
# z-order to the boxes it crosses.
# Moved 2026-09-01 for T149 (JVR-05): the design surface's typed slide
# range sorts its two endpoints before clamping both into 1..total,
# instead of clamping one end each way and swapping afterwards. Editor
# chrome only; the slides a range selects are identical either way, what
# changes is the stored range and the label built from it.
# Moved 2026-09-01 for T150 (JVR-06): core.css no longer imports IBM
# Plex from a font CDN, so a rendered page fetches no webfont in any
# mode; the fallback stacks widened in the same edit, since Windows was
# landing on Courier New for every mono run.
# Moved 2026-09-01 for T151: the ribbon's tablist wrapper is now a real
# container - rbnHome snapshots its children, restore puts them back
# inside it, and generated layouts build their tabs there, so a layout
# apply (including the one at boot) no longer deletes all four tabs.
# Moved 2026-09-01 for T152 and T153: the slide strip's resize ceiling
# is measured from the ribbon's content rather than its box (it used to
# equal the strip's own current width, so the drag could never widen),
# and a thumbnail sharing its row with the number and title now shrinks
# to fit instead of overflowing it.
# Moved 2026-09-01 for T152 and T153: the slide strip's resize ceiling
# is measured from the ribbon's content rather than its box (it used to
# equal the strip's own current width, so the drag could never widen),
# and a thumbnail sharing its row with the number and title now shrinks
# to fit instead of overflowing it.
# Moved 2026-09-01 for T154: auto-hide for the slide column and the
# ribbon, matching the presentations panel's own pattern; the ribbon
# parks by transform so the strip's ceiling cannot lurch, and the rail's
# edge-reveal stands down while the deck is open.
# Moved 2026-09-01 for T155: the slide-column resize handle stops laying
# a dead stripe over the save bar and tab row, paints a grip at rest,
# and takes keyboard focus with arrow-key resize.
# Moved 2026-09-01 for T156: entrance keyframes animate the individual
# translate/scale properties so they compose with a rotated item's
# inline transform (deleting the silent rise/zoom-to-fade substitution),
# no longer end at a literal opacity that fought a.op, and clicking an
# effect now moves the ribbon's pressed state.
# Moved 2026-09-01 for T157: prefers-reduced-motion now disables the
# entrance keyframes as well as transitions; builds still reveal in the
# same steps, they just cut instead of animating.
# Moved 2026-09-01 for T158: the animation surface moves out of
# 45-images.js into its own 48-animation.js part, and its executing sub-
# IIFE becomes animBoot() called from the boot sequence.
# Moved 2026-09-01 for T159: a chart's marks are grouped per series (<g
# data-series>) with the axes and labels in a skeleton group, so a build
# step can address a series by name.
# Moved 2026-09-01 for T160: a chart can be built by series - the
# timeline gives it one stop per series after the skeleton, drawChart
# hides the series not yet revealed, and a right-click row turns it on.
# Moved 2026-09-01 for T161: the flip-book tie gains a door from the
# object being tied - a 'shows with' section in the right-click menu
# that opens the existing tie control with the selection intact.
# Moved 2026-09-01 for T162: the film-strip mark and the Remove-
# animations toast count the sequence playback actually walks
# (slideStops) instead of anim-order builds only, and the shows-with
# menu section is no longer folded away.
# Moved 2026-09-01 for T163 and T164: the Animations pane lists every
# stop playback walks (a flip book's pages and a chart's series, under
# the build that anchors them), and .an-chart is positioned like every
# other annotation kind - it was static, so its stored x/y were inert
# and it stacked below the arrow hit-layer and could not be clicked.
# Moved 2026-09-01 for T165: a text box can carry pages (a.pg) and
# clicks through them like a flip book, with page one still living in
# a.text; the editor's accessors point at the current page, and the
# timeline counts a page as a stop.
# Moved 2026-09-01 for T166: a flip book with text walking beside it
# takes one stop per (figure, page of that figure), and a page says
# which figure it starts from its own right-click menu.
# Moved 2026-09-01 for T167: the animation feature answers to one name -
# the ribbon group is Animation, the door and the pane are both
# Animations, and the two user-facing sites still naming the retired
# Timeline are corrected.
# Moved 2026-09-01 for T168: a sequencing mode - click objects in the
# order they should appear, shift-click to put one on the same click as
# the last, with the whole run a single undo step.
# Moved 2026-09-01 for T169: a build can carry a delay (a.anim.after)
# and run itself that many seconds after the one before, set by holding
# a digit while clicking in the sequencing mode; it leaves as
# PowerPoint's own after-previous.
# Moved 2026-09-01 for T170: the sequencing mode is named Click in
# order, carries a five-effect chooser with its shortcut keys printed on
# the buttons, paints above the deck, and Rise is renamed Float up on
# screen.
# Moved 2026-09-01 for T171: the effect gallery replaces the four hidden
# per-effect buttons with one always-visible Effect door, whose cards
# preview on the real object and whose pick with nothing selected builds
# the whole slide in reading order.
# Moved 2026-09-01 for T172: text builds - a text box can arrive a
# bullet or a sentence at a time, riding the same stepper machinery as
# flip pages and chart series.
# Moved 2026-09-01 for T172: text builds - a box arrives a bullet or a
# sentence at a time, cut at render so the stored words never change.
# T175 2026-09-01: the walk-through preset adds JS to the deck bundle.
# T174 2026-09-01: the Layers pane build column, the swap verb and
# the exit key -- more JS and CSS in the embedded deck bundle.
# T173 2026-09-01: the chart-series tie (an object bound to the
# moment one named series is plotted) and the galBoot fix that
# driving it uncovered -- both add JS to the embedded deck bundle.
# T176 2026-09-02: Animation is a tab of its own again, with an Order
# group whose two new doors (Click things in order, Reading order)
# came up from the foot of the pane. deck.html, help.html, three deck
# fragments, deck.css and core.css.
# T177 2026-09-02: windows of options on the Object tab -- Font,
# Paragraph, Line and Source -- the real controls moved into them in
# deck.html, one owner for every door, the deselect path hiding only
# the outermost governed control (a shipped bug that had emptied the
# Colour group at boot), and Escape closing a menu in capture. deck.html,
# deck.css and five deck fragments.
# T178 2026-09-02: the deck's type is one window (the whole-deck scale,
# Re-apply and Style system rows sit at the foot of Text styles), Insert
# is Place / Write / Draw, and Page furniture takes an explicit order so
# Design reads Slide, Page furniture, Type. deck.html, help.html,
# deck.css, core.css and two deck fragments.
# T179-T181 2026-09-02: the five effect buttons on the Object tab, the
# sequencing controls as a ribbon group instead of a fixed bar (with a
# Layers door and Set order for a name), and Finish writing the slide's
# order too. deck.html, deck.css and four deck fragments.
# T182-T184 2026-09-02: the effect tiles in the ribbon's row, the
# names that say what the buttons do, the Layers pane as a list with a
# three-button bar, an Actions menu and a resize handle, and the order
# panel on the right. deck.html, help.html, deck.css, core.css and
# four deck fragments.
# T185-T186 2026-09-02: the Timing & text group on the Animation tab
# (On click / With previous / After previous with a seconds field, and
# Whole box / By bullet / By sentence), the build numbers whenever the
# tab is up, the whole-slide group reworded, and the lit chip styled
# past the colourful theme. deck.html, deck.css, core.css and two deck
# fragments.
EXPECTED_MD5 = "2be6aff3c247f318d9838dfd4e7b8ff3"
EXPECTED_BYTES = 3289106


def _render_example() -> str:
    """Render exactly as ``junoview NOTEBOOK.ipynb`` does."""
    doc = load_doc(EXAMPLE)
    doc.source_name = "example_climate_analysis"
    return render_page([doc])


@pytest.mark.skipif(not EXAMPLE.exists(),
                    reason="example notebook not in this checkout")
def test_example_notebook_renders_byte_for_byte_as_before():
    html = _render_example()
    digest = hashlib.md5(html.encode("utf-8")).hexdigest()
    assert digest == EXPECTED_MD5, (
        f"rendered output changed: {len(html)} bytes, md5 {digest} "
        f"(expected {EXPECTED_BYTES} bytes, md5 {EXPECTED_MD5}). "
        "If you meant to change the output, update EXPECTED_MD5 and "
        "EXPECTED_BYTES in this file and explain the change in your commit."
    )


@pytest.mark.skipif(not EXAMPLE.exists(),
                    reason="example notebook not in this checkout")
def test_rendering_is_deterministic():
    """Two renders in one process must agree.

    Guards against anything order-dependent leaking into the page -- a set
    iterated directly, a dict keyed on object identity, a cached asset mutated
    in place.
    """
    assert _render_example() == _render_example()


def test_every_asset_loader_returns_something():
    """Every named loader resolves and is non-empty.

    This used to be called ``test_assets_load_from_the_installed_package``
    and its docstring claimed to be "what fails first if package-data is
    misdeclared". It could not be: pyproject's ``pythonpath = ["src", ...]``
    puts the checkout ahead of any installed copy, so this resolved off
    disk and stayed green through the 141 commits in which the wheel
    shipped no deck fragments at all (T95). A test that claims coverage it
    does not have is worse than no test, so the claim is gone and the name
    says only what it does: the loaders work.

    Packaging itself is tests/test_packaging.py, which compares the
    declared package-data patterns against the files on disk and needs no
    installed copy to be honest about it.
    """
    from junoview import assets

    loaders = {
        "core.css": assets.core_css, "app.css": assets.app_css,
        "deck.css": assets.deck_css, "app.js": assets.app_js,
        "deck.js": assets.deck_js, "pptx.js": assets.pptx_js,
        "page.html": assets.page_template,
        "shell.html": assets.shell_template, "deck.html": assets.deck_html,
        "help.html": assets.help_html, "mathjax.html": assets.mathjax_html,
        "web-loader.html": assets.web_loader, "sw.js": assets.sw_js,
    }
    for name, load in loaders.items():
        assert load().strip(), f"asset {name} is empty or missing"


def test_page_template_placeholders_match_what_render_page_supplies():
    """The template and its caller must agree on every named placeholder.

    A stray ``{`` in the HTML, or a renamed keyword in ``render_page``, raises
    KeyError/IndexError only at render time -- and only for the code path that
    happens to be exercised. Checking the field set directly is cheaper.
    """
    import string

    from junoview import assets

    supplied = {
        "title", "shells", "css", "app_css", "js", "mathjax", "deck_shell",
        "app_data", "deck_css", "deck_js", "pptx_js", "repo", "kofi",
        "help_html", "logo", "favicon", "head_extra", "icons_js",
    }
    required = {name for _, name, _, _
                in string.Formatter().parse(assets.page_template())
                if name}
    # Only the missing direction is fatal -- a placeholder the template needs
    # and nobody supplies is a KeyError at render time. A supplied name the
    # template ignores is merely dead weight (`repo` currently is).
    assert not required - supplied, (
        f"page.html uses {sorted(required - supplied)}, which render_page "
        "does not pass; rendering would raise KeyError"
    )
