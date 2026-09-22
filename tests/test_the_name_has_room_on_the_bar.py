"""T397: the editor's top bar gives the presentation's name its room.

The user, 2026-09-13: "The top bar is too busy e.g. where the file, save,
themes etc. There is not enough room for the presentation name." Two
causes. Every button on the bar is flex:none and the two springs have a
zero basis, so the name was the ONE item the bar could shrink -- and it
shrank to "pres..." before fitQat ever saw an overflow. And Help and
Support were two buttons for one errand.
"""

from __future__ import annotations

from junoview import assets


def test_the_name_never_gives_way_first(out):
    assert ("  padding:3px 9px;cursor:text;flex:none;max-width:34vw;"
            "white-space:nowrap;") in out


def test_global_deck_options_are_one_quiet_app_menu():
    html = assets.deck_html()
    assert 'id="deck-appwrap"' in html
    assert '<i data-ic="theme"></i> App &#9662;</button>' in html
    assert 'id="deck-scheme"' in html
    assert 'id="deck-howto"' in html
    assert '<a class="dc-mi" id="deck-support" target="_blank" rel="noopener"' in html
    assert 'Support Junoview &#9829;</a>' in html
    # Theme, Help and Support are no longer loose top-bar buttons.
    assert '<a class="dbtn qat-btn" id="deck-support"' not in html


def test_the_menu_is_wired_and_how_to_use_still_opens_help(out):
    assert "wireMenuToggle('deck-appwrap','deck-app','deck-app-menu')" in out
    assert "  ['#help-btn','#deck-howto'].forEach(function(sel){" in out
    assert "a.dc-mi{display:block;text-decoration:none;}" in out


def test_the_bars_menus_paint_over_the_tab_strip(out):
    """Floated at z-index 240 inside the bar's own stacking context, which
    at an equal 131 lost to the later tab strip: the Help menu's first row
    sat under Auto-hide and Ribbon layouts."""
    assert ".deck-qat,.deck-top,.rbn-tabs{position:relative;z-index:131;}" in out
    assert ".deck-qat{z-index:132;}" in out
