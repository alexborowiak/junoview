"""T522: a thumbnail draws a placed note or code cell as itself.

The 2026-09-29 audit: every slide Create slides makes is a heading over
a Markdown note, and the strip drew each note as the same white card of
grey rules, so fourteen slides looked identical and none looked like the
dark slide it indexes. The thumbnail now takes the canvas's own rendered
body (framePart) at the canvas's zoom rule, inside a box wearing the
canvas's frame classes; a figure keeps its picture.

Driven live on the example deck at 1440x900: slide 4's thumbnail shows
the dark page, the note's words on the left and the heatmap on the right,
exactly as the canvas lays them out.
"""

from __future__ import annotations


def test_the_cell_branch_draws_the_body_first(out):
    branch = out.split("      if(a.k==='cell'){\n        if(miniCell(d,a))"
                       " return;\n")
    assert len(branch) == 2, "miniDiagram's cell branch tries miniCell first"


def test_the_body_takes_the_canvas_zoom_rule(out):
    fn = out.split("  function miniCell(d,a){")[1].split("\n  }\n")[0]
    # the same framePart the canvas renders, at a.ts x height / SW_REF_H
    assert "var b=framePart(it.ns,a.part); if(!b) return false;" in fn
    assert "b.style.zoom=((a.ts||1)*miniHNow/SW_REF_H).toFixed(4);" in fn
    # the canvas's frame classes, so ink, recolour and light pages agree
    assert "'is-cell an-cell'+(a.autoNote?' an-auto-note':'')" in fn
    assert "applyCellColor(box,a);" in fn
    # a figure stays a picture; a commit-locked frame keeps its own path
    assert "if(paneImgSrc(a.ref)) return false;" in fn
    assert "if(!a.ref||(a.lockver&&a.lockver.commit)) return false;" in fn
    # no duplicate ids from a cloned body
    assert "$$('[id]',b).forEach(function(n){n.removeAttribute('id');});" \
        in fn


def test_nothing_in_a_miniature_scrolls(out):
    assert (".mini-it.is-cell.an-cell .note,.mini-it.is-cell.an-cell pre,\n"
            ".mini-it.is-cell.an-cell .cardbody{overflow:hidden;}") in out
