"""T413: matching, where you can see it.

The user, 2026-09-13: "What happened to the feature of matching
slides, and also things like making one object appear the same as
another." Both features were alive and hidden: the three point-at-it
verbs lived in the canvas right-click menu and the Layers pane only,
and Match slide was a door on the Design tab. Now the Object tab's
Reuse group opens with a "Match…" tile, and a thumbnail's right-click
menu arms Match slide in either direction.
"""

from __future__ import annotations

from junoview import assets


def test_the_object_tab_has_a_match_tile():
    html = assets.deck_html()
    assert 'id="fmt-match"' in html
    assert "Match&#8230;</button>" in html
    out = assets.deck_js()
    assert "    show('#fmt-match',isNum&&selCount>=1);   /* T413 */" in out
    assert "#fmt-path #fmt-lock #fmt-match #fmt-cmp-make " in out
    assert "      e.stopPropagation();matchMenuAt(mt);});" in out


def test_the_thumbnail_menu_arms_match_slide_both_ways(out):
    assert "      row('Match this slide to another\\u2026',function(){" in out
    assert "        goTo();armSlideMatch('from');}," in out
    assert ("      row('Give this slide\\u2019s layout to slides I "
            "click\\u2026',function(){") in out
    assert "        goTo();armSlideMatch('to');}," in out
    # the slide you right-clicked is the one that takes, or gives
    assert ("        if(cur!==i){cur=i;activePane=-1;selAnnot=null;"
            "selSet=[];refresh();}") in out
