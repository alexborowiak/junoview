"""T585: an arrow over a picture can be clicked, and pointing previews.

The user, 2026-09-30: "so I create this arrow with a curve (would be good
if on hover you could preview how the arrow looks), but I cannot click on
it with the map in the background."

Two faults, both about WHERE an arrow is:

- its fat invisible grab path was drawn in an svg UNDER every item, so a
  picture beneath an arrow took every click on it;
- the fallback that picks an arrow near a click (arrowAt) measured the
  straight chord between its two ends, so a curved arrow was found where
  it is not drawn and missed where it is.

Driven on the example deck: an arrow across a chart, curved, deselected.
Before: a click on the visible curve selected the chart, and a click on
empty chart along the chord selected the arrow. After: the other way
round, which is what you see.

And the preview: pointing at a Line window option (route, style, weight,
ends) puts it on the selection; leaving, or closing the window, puts back
what was there; a click keeps it, with one undo entry back to the state
before you pointed.
"""

from __future__ import annotations

from junoview import assets


def test_the_grab_path_is_on_top_while_editing(out):
    assert "    (editing?svgTop:svg).appendChild(hit);" in out
    # redraws find it in either svg
    assert "$$('.an-arrow-hit',layer).forEach(function(n){n.remove();});" in out
    # an edge handle stays above an arrow attached at that edge
    css = assets.deck_css()
    rs = css.split(".an-resize{position:absolute;")[1].split("}")[0]
    assert "z-index:6" in rs


def test_the_pick_follows_the_drawn_line_not_its_chord(out):
    at = out.split("  function arrowAt(layer,s,ev){")[1].split("\n  }\n")[0]
    assert "hp.isPointInStroke(new DOMPoint(px,py))" in at
    # the chord is only the fallback when the path cannot be asked
    assert at.index("isPointInStroke") < at.index("distToSeg(")


def test_pointing_at_a_drawn_option_previews_it(out):
    assert "    o.addEventListener('mouseenter',function(){" in out
    assert "      try{onPick();}finally{fmtPreview=false;}" in out
    assert "    o.addEventListener('mouseleave',drawnPreviewEnd);" in out
    # the window closing puts it back too
    assert "if(box.hidden) drawnPreviewEnd();" in out
    # a click restores first, so its one undo entry is the pre-hover state
    assert "e.stopPropagation();drawnPreviewEnd();onPick();" in out
    # and the preview writes no history
    assert "    quiet=quiet||fmtPreview;" in out
