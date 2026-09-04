"""The section scope reads as a list of sections you tick (T243).

The user, 2026-09-04: "Also the section filtering is kind of confusing
and hard to use."

Four things made it so: it opened with every heading COLLAPSED, so a
ten-section notebook offered one row; the only bulk control was Select
all, so picking one section meant clicking every other one; the whole
row was the tick and a 9px chevron inside it was the expander, which is
two gestures in one target with nothing saying which is which; and
neither the button ("Sections: All") nor the menu said what it decided.

Driven on the example notebook: ten rows with ten tick boxes, "10 of 10
ticked", Select none took it to "Filters act on: no sections", and one
tick to "1 of 10 sections".
"""

from __future__ import annotations

from junoview import assets


def test_the_button_says_what_it_decides():
    app = assets.app_js()
    assert "    var lab=(!tot||n===tot)?'all sections'" in app
    assert "      :(n?(n+' of '+tot+' sections'):'no sections');" in app
    assert "Filters act on: '+lab+' \u25be'" in app


def test_it_opens_showing_the_sections():
    app = assets.app_js()
    assert ("    nodes.forEach(function(n){\n"
            "      if(n.kids.length&&scopeOpen[n.id]===undefined)"
            " scopeOpen[n.id]=1;});") in app


def test_both_directions_and_a_count():
    app = assets.app_js()
    assert "    function bulkBtn(txt,tip,fn){" in app
    assert "    bulkBtn('Select all','Every section in this notebook'," in app
    assert ("    bulkBtn('Select none',"
            "'Clear them all, then tick the ones you want',") in app
    assert "    cnt2.textContent=picked+' of '+nodes.length+' ticked';" in app


def test_the_tick_is_a_thing_you_can_see():
    app = assets.app_js()
    assert "      bx.className='scope-box';" in app
    css = assets.load("css/app.css")
    assert ".scope-box{flex:none;width:13px;height:13px;" in css
    assert ".scope-row.on .scope-box{background:var(--cyan-deep);" in css
    # ...and a heading whose children disagree says so
    assert ".scope-row.part .scope-box{border-color:var(--cyan-deep);}" in css


def test_the_menu_says_what_the_thing_is():
    app = assets.app_js()
    assert "    h.textContent='the filters act on these sections';" in app
    assert "why.className='ckf-why';" in app
    assert ("      +'own, so you can hide code in one chapter and keep it "
            "in the '") in app
