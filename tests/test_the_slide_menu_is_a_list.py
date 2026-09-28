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


def test_everyday_slide_actions_come_first(out):
    start = out.index("  function openFilmMenu(i,ev,run){")
    body = out[start:out.index("  function floatAt(m,ev){", start)]
    slide_part = body[body.index("var ar0=altRun(i)"):]
    # The normal slide-sorter verbs are the first rows, with discoverable
    # keys. Version, transition and organising controls remain under More.
    everyday = ["row('Cut'", "row('Copy'", "row('Paste after'",
                "row('Duplicate'", "row('Delete'"]
    positions = [slide_part.index(verb) for verb in everyday]
    assert positions == sorted(positions)
    assert "'cut','Ctrl+X'" in slide_part
    assert "'copy','Ctrl+C'" in slide_part
    assert "'paste','Ctrl+V'" in slide_part
    assert "'copy','Ctrl+D'" in slide_part
    assert "'exit','Del'" in slide_part
    assert slide_part.index("row('Delete'") < slide_part.index(
        "menuHead(m,'versions');")
    assert "menuHead(m,'how it arrives'" in slide_part
    assert "menuHead(m,'organise');" in slide_part
    assert "'Mark it optional'" in slide_part
    assert "row('Move it up',function(){moveSlide(i,-1);},null,'prev');" \
        in slide_part


def test_paste_row_explains_when_it_is_not_available(out):
    start = out.index("  function openFilmMenu(i,ev,run){")
    body = out[start:out.index("  function floatAt(m,ev){", start)]
    assert "slideClip?'After this one':'Copy or cut a slide first'" in body
    assert "pasteSlideRow.disabled=!slideClip;" in body
