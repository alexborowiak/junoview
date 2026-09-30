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
    """T602 (2026-09-30, user: "a lot of this stuff could all just be put
    under the file button e.g. the app button"): the quiet App menu is a
    section of File, so the bar has one menu button fewer and the rows
    are the same words."""
    html = assets.deck_html()
    assert 'id="deck-appwrap"' not in html and "App &#9662;" not in html
    menu = html[html.index('id="dc-menu"'):html.index('id="mi-del"')]
    assert '<div class="dc-mhead">app</div>' in menu
    assert 'id="deck-scheme"' in menu
    assert 'id="deck-howto"' in menu
    assert '<a class="dc-mi" id="deck-support" target="_blank" rel="noopener"' in menu
    assert 'Support Junoview &#9829;</a>' in menu
    # Theme, Help and Support are no longer loose top-bar buttons.
    assert '<a class="dbtn qat-btn" id="deck-support"' not in html


def test_the_menu_is_wired_and_how_to_use_still_opens_help(out):
    # a pick closes whichever File it was in, the reader's or the editor's
    assert ("    var reader=wireMenuToggle('app-filewrap','app-file',"
            "'app-file-menu');") in out
    assert "    [reader&&reader.menu,fileMenu].filter(Boolean)" in out
    assert "  ['#help-btn','#deck-howto'].forEach(function(sel){" in out
    assert "a.dc-mi{display:block;text-decoration:none;}" in out


def test_the_bars_menus_paint_over_the_tab_strip(out):
    """Floated at z-index 240 inside the bar's own stacking context, which
    at an equal 131 lost to the later tab strip: the Help menu's first row
    sat under Auto-hide and Ribbon layouts."""
    assert ".deck-qat,.deck-top,.rbn-tabs{position:relative;z-index:131;}" in out
    assert ".deck-qat{z-index:132;}" in out
