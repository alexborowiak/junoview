"""T399: the slide strip's right-click menu is one readable column.

The user, 2026-09-13: "The right click options on a slide look cursed."
The menu inherited .sh-menu's three-column icon grid, so every label
wrapped word by word into a tile beside its heading, and it carried
three "this slide" headings, one of them with nothing under it.
"""

from __future__ import annotations


def test_one_column_like_the_canvas_menu(out):
    assert ".film-menu{display:block;width:300px;min-width:0;" in out
    assert ".film-menu .vw-opt{width:100%;text-align:left;}" in out
    assert ".film-menu .vw-opt.on::after{content:\"on\";margin-left:auto;" in out
    assert ".film-menu{min-width:210px;}" not in out


def test_one_heading_per_group(out):
    start = out.index("  function openFilmMenu(i,ev,run){")
    body = out[start:out.index("  function floatAt(m,ev){", start)]
    slide_part = body[body.index("var ar0=altRun(i)"):]
    # the dead heading above "how it arrives" is gone, and the slide's
    # own verbs sit under ONE heading: optional, move, duplicate, delete
    assert slide_part.count("menuHead(m,poster?'this page':'this slide');") == 1
    assert "menuHead(m,'how it arrives'" in slide_part
    heads = slide_part.index("menuHead(m,poster?'this page':'this slide');")
    tail = slide_part[heads:]
    assert "'Mark it optional'" in tail
    assert "row('Move it up',function(){moveSlide(i,-1);},null,'prev');" in tail
    assert "row('Duplicate',function(){dupSlide(i);},null,'copy');" in tail
    # "in these versions" comes before it, not between two copies of it
    assert slide_part.index("menuHead(m,'in these versions');") < heads
