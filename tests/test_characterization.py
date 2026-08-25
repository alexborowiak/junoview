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
# _icon_svg() markup / bic() lookups; PB_ICO (app.js) and RAIL_ICO
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
EXPECTED_MD5 = "50f6c22e39c867975115a51ccfca46bb"
EXPECTED_BYTES = 2596030


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


def test_assets_load_from_the_installed_package():
    """Every asset resolves through importlib.resources and is non-empty.

    This is what fails first if package-data is misdeclared: imports still work
    from a source checkout, and only an installed wheel goes missing its CSS.
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
