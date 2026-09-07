"""The section scope reads as a list of sections you tick (T243).

The user, 2026-09-04: "Also the section filtering is kind of confusing
and hard to use."

Four things made it so: it opened with every heading COLLAPSED, so a
ten-section notebook offered one row; the only bulk control was Select
all, so picking one section meant clicking every other one; the whole
row was the tick and a 9px chevron inside it was the expander, which is
two gestures in one target with nothing saying which is which; and
neither the button ("Sections: All") nor the menu said what it decided.

T364 (2026-09-07) took the last of those back the other way: the
button read "Filters act on: all sections" under a group already
headed "Apply to", and the menu opened with a heading and a paragraph
about how per-section filters work. The user: "the apply to button is
so stupidly big" and "People know what filter sections means?????"

Driven on the example notebook: ten rows with ten tick boxes, "10 of 10
ticked", Select none took the button to "None", and one tick to
"1 of 10".
"""

from __future__ import annotations

from junoview import assets


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


def test_the_menu_does_not_explain_itself():
    """T364 (2026-09-07, user: "Why does filter have all this text?
    People know what filter sections means?????"). T243 gave this menu
    a heading and a paragraph about how per-section filters work. Both
    are gone: the tree, the two bulk buttons and the count are the
    whole thing."""
    app = assets.app_js()
    assert "the filters act on these sections" not in app
    assert "ckf-why" not in app
    assert "so you can hide code in one chapter" not in app
    # what is left is the tree and the two ways to fill it
    assert "    bulkBtn('Select all'," in app
    assert "    bulkBtn('Select none'," in app


def test_the_scope_button_says_only_which():
    """The group is headed "Apply to" and the icon is a scope, so the
    button carries the answer and nothing else (2026-09-07, user: "the
    apply to button is so stupidly big")."""
    app = assets.app_js()
    assert "'Filters act on: '" not in app
    assert "    setBtnText(b,lab+' \u25be');" in app
    assert "    var lab=(!tot||n===tot)?'All sections'" in app
    assert "      :(n?(n+' of '+tot):'None');" in app
