"""Bugs that reached the user, and the structure that let them through.

Every test here corresponds to something reported from the running app on
2026-08-07, after several rounds of the same class of defect getting past
review. The common thread is that the editor decided things by hand at each
site -- one show() call per control, one floatMenu() call per menu -- so
forgetting one was silent and permanent. Where a test pins a table or a
check rather than a symptom, that is the point.
"""

from __future__ import annotations


def test_every_contextual_control_is_governed(out):
    """showFmt used ~150 hand-written show() calls with nothing tying a
    control to the kinds it applies to. Four dropdowns were added to the
    markup and none got a line, so Ends and Route -- arrow properties --
    appeared on a triangle, permanently and silently.
    """
    assert "var FMT_KINDS={" in out and "var FMT_MANUAL=" in out
    # arrow-only things really are arrow-only
    assert "'#fmt-headwrap':'arrow'," in out
    assert "'#fmt-bendwrap':'arrow'," in out
    # shape-only things really are shape-only
    assert "'#fmt-fillwrap':'rect'," in out
    assert "'#fmt-shape':'rect'," in out
    # and the table actually drives visibility
    assert "Object.keys(FMT_KINDS).forEach(function(id){" in out
    # a control governed by neither table now says so, loudly
    assert "governed by nothing in " in out


def test_a_poster_is_not_offered_animation(out):
    """Animation is a BUILD: an item appearing on click as you step through
    a deck. A poster is one printed page -- there is no click and nothing
    to step through.
    """
    assert "show('#fmt-animwrap',isNum&&!pageOf().poster);" in out


def test_lines_and_arrows_are_drawn_in_page_coordinates(out):
    """Converting arrows from <line> to <path> (to support curves) kept the
    coordinates as percentages. <line> accepts x1="20%"; path data has no
    units, so "M20 50" meant 20px,50px and every line and arrow collapsed
    into a stub in the top-left corner.
    """
    assert "function arrowPath(e,a,W,H){" in out
    assert "var x1=e.x1/100*W,y1=e.y1/100*H,x2=e.x2/100*W,y2=e.y2/100*H;" in out
    # the curve offset is a percentage too, so it scales the same way
    assert "var bow=cv/100*Math.min(W,H);" in out
    # and the caller passes the layer's real size
    assert "var d=arrowPath(ends,a,lrA.width,lrA.height);" in out


def test_dropdowns_are_not_clipped_by_the_ribbon(out):
    """overflow:hidden on the ribbon (added to kill a sideways scrollbar)
    also clipped every menu that opens downward -- the Shape menu looked
    like it was rendering behind the canvas. Clipping sideways only fixes
    every menu at once, including ones added later; the alternative was
    remembering floatMenu() at nine separate call sites.
    """
    import re

    assert "overflow-x:clip;overflow-y:visible;}" in out
    ribbon = out.split(".edit-tools.ribbon{")[1].split("}")[0]
    # strip the comment that *explains* the old overflow:hidden before
    # asserting the declaration itself is gone
    ribbon = re.sub(r"/\*.*?\*/", "", ribbon, flags=re.S)
    assert "overflow:hidden" not in ribbon


def test_rulers_follow_the_slide_when_the_stage_moves(out):
    """Rulers are drawn at the slide's CURRENT position, so anything that
    moves the slide must redraw them. The ribbon's observer cannot see the
    docked panel opening, closing or being dragged wider -- and that is
    exactly the slide case, where the panel appears after the rulers are
    first placed and strands them to the left of the page they measure.
    Watching the stage catches all of it. Measured after the fix: 0px
    misalignment before and after a stage resize.
    """
    assert "}).observe(stage);" in out
    assert "if(!deckEl.hidden) syncGuides();" in out


def test_a_shape_can_be_given_a_fill_colour(out):
    """The outline always worked; the fill could not be set by anything in
    the app. Three independent faults stacked: the fill swatches were
    gated to text, so hidden for a shape; the swatch handler had no shape
    branch and wrote a.bg/a.bgc, which no shape renderer reads; and "Solid
    colour…" just copied the outline. A green triangle with a red outline
    was not constructible. Verified after the fix: fill=#39a9c0 with
    stroke=#ff6b57 on the same triangle.
    """
    assert "var showBg=plainText||noteCell||kind==='rect';" in out
    # the handler writes the fields drawShapeSvg/cssFill actually read
    assert "else if(a.k==='rect'){" in out
    assert "else {a.fill=1;a.fillc=sw.dataset.c;}" in out
    # the custom "+" chip too
    assert "else if(a.k==='rect'){a.fill=1;a.fillc=str;delete a.grad;}" in out
    # and the picker prefills from the shape's own fill
    assert "if(a.k==='rect') return (a.grad&&a.grad.a)" in out
    # two Fill buttons would otherwise both read "Fill"
    assert "fcb.textContent=(kind==='rect')?'Fill colour ▾':'Fill ▾';" in out


def test_the_opacity_slider_makes_one_undo_entry(out):
    """A range fires one `input` per step, so a single drag pushed ~100
    undo entries and flushed every real edit out of the 50-slot history.
    fmtApply's `quiet` flag exists for exactly this; the crop steppers
    already used it and this control never did.
    """
    assert "if(pct>=100) delete a.op; else a.op=pct/100;},true);" in out
    assert "opRangeEl.addEventListener('change'" in out


def test_the_side_toolbar_actually_stands_up(out):
    """The horizontal ribbon is a fixed-height row of two-row grids. None
    of that survives being stood on its end, so side mode must undo each
    piece -- the height, the row grid, the clipping and View's pinned
    right margin. It undid none of them, so the toggle did nothing.
    """
    side = out.split(".deck.rbn-side .edit-tools.ribbon{")[1].split("}")[0]
    assert "height:auto" in side
    assert "overflow-y:auto" in side
    assert ".deck.rbn-side .rbn-row{display:flex;flex-direction:column;" in out
    assert ".deck.rbn-side .rbn-view{order:0;margin-left:0;" in out
    # and it says what it does
    assert "Toolbar on the right" in out
    assert "Toolbar down the side" not in out
