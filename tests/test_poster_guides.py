"""Laying a poster out: rulers, guides, the side toolbar, full-screen edit.

A poster is far larger than the window, so the judgements a 16:9 slide lets
you make by eye ("is that aligned? is it near the edge?") cannot be made at
all. These give the page a frame of reference. String pins against the built
page; the behaviour was verified out-of-band by driving a real A0 poster in
a headless browser -- rulers drew 85 ticks and 8 mm labels, the grid drew a
margin box and its columns, a drag snapped to the page centre and showed the
guides, and neither rulers nor grid appeared in the print root.
"""

from __future__ import annotations


def test_guides_are_editing_aids_and_never_reach_the_output(out):
    """The whole point of a guide is that it is not ink. A margin box that
    printed would be worse than no margin box at all.
    """
    # asserted per-layer rather than as one selector string, so adding a
    # fourth kind of guide cannot quietly leave it out of the exclusions
    for layer in (".pgrid", ".rulers", ".cguides"):
        assert f".deck:not(.editing) {layer}" in out, layer
    assert "@media print{.pgrid,.rulers,.cguides{display:none!important;}}" in out
    assert "#print-root .pgrid,#print-root .rulers," in out
    assert "#print-root .cguides{display:none!important;}" in out


def test_rulers_measure_the_real_page_in_millimetres(out):
    """A poster's units are millimetres of paper, not pixels: the ruler has
    to read off pageOf().mm so that "20mm from the edge" means what the
    print shop will measure.
    """
    assert "function drawRulers" in out and "function fillRuler" in out
    assert "function rulerStep" in out
    # the tick pitch adapts to zoom rather than being fixed
    assert "steps[i]*pxPerMm>=7" in out
    assert 'id="ruler-h"' in out and 'id="ruler-v"' in out
    assert 'id="vw-rulers"' in out


def test_the_grid_is_a_margin_box_plus_columns_you_can_snap_to(out):
    """A visible guide you could not snap to would be a tease, so the
    margin and column lines join the snap targets.
    """
    assert "function gridPct" in out and "function guideTargets" in out
    assert "MARGIN_MM=20" in out and "GRID_COLS=12" in out
    assert "pgrid-margin" in out and "pgrid-col" in out
    # guideTargets() is unioned into snapTargets()
    assert "var g=guideTargets();" in out
    assert "xs=xs.concat(g.xs);ys=ys.concat(g.ys);" in out


def test_snap_feedback_is_actually_visible(out):
    """The snapping always worked; the 1.5px dashed hairline that reported
    it did not, which is what made placement feel like guesswork. Solid,
    glowing, and page lines coloured apart from item lines.
    """
    assert "border-left:2px solid #ff6b57" in out
    assert ".snapline.snap-page{" in out
    assert "function isPageLine" in out
    # and the catch window is no longer a couple of poster millimetres
    assert "var SNAP_PX=9;" in out


def test_side_toolbar_defaults_on_for_portrait_posters_only(out):
    """A0 portrait is 1.4x taller than wide, and the horizontal ribbon
    costs ~122px of exactly the scarce dimension. Landscape pages and
    ordinary slides keep the familiar top ribbon.
    """
    assert "function wantSide" in out
    assert "pg.poster&&pg.mm[1]>pg.mm[0]" in out
    # ...but an explicit choice wins from then on
    assert "guides.sideSet=true" in out
    assert "if(guides.sideSet) return !!guides.side;" in out
    assert ".deck.rbn-side .edit-tools.ribbon{position:absolute;" in out
    # the stage, its arrows and the Objects pane make room
    assert ".deck.rbn-side .deck-stage{padding-right:226px;}" in out
    assert ".deck.rbn-side .deck-arrow.next{" in out


def test_full_screen_editing_is_not_presenting(out):
    """Present hides every tool and starts a build sequence, which is
    meaningless for a poster: there is no audience and nothing to step
    through. Full-screen editing keeps the whole editor.
    """
    assert "function toggleEditFull" in out
    assert 'id="vw-full"' in out
    assert ".deck.editfull .deck-top{display:none;}" in out
    # setUIMode must not tear the editor out of full screen on every
    # re-apply -- it exits full screen for any non-view mode otherwise
    assert "else if(m!=='view'&&document.fullscreenElement&&!editFull)" in out
    # ...and leaving full screen by Esc/F11/the OS must clear the class
    assert "deckEl.classList.remove('editfull');" in out


def test_view_toggles_persist_and_have_keys(out):
    assert "GUIDE_KEY='junoview:deck:guides'" in out
    assert "function saveGuides" in out
    # plain R and G; Ctrl+G still groups
    assert "(e.key==='r'||e.key==='R')" in out
    assert "if(!e.ctrlKey&&!e.metaKey&&(e.key==='g'||e.key==='G')){" in out
