"""Home is a concise recent-work launcher, not a second presentation rail.

The user (2026-09-11) asked for recent presentations, New and folders on
the opening screen, with the full saved library behind an explicit Open
door. Posters and imports remain available in that library rather than
making the launch screen a three-column directory again.
"""

from __future__ import annotations

from junoview import assets


def _web() -> str:
    from tests.test_front_door import render_page
    return render_page([], mode="web")


def test_home_has_recent_presentations_and_notebooks_in_that_order():
    web = _web()
    order = ["wj-pres", "wj-nb"]
    at = [web.index(f'id="{s}"') for s in order]
    assert at == sorted(at), order
    titles = ("Recent presentations", "Notebooks")
    for sid, word in zip(order, titles, strict=True):
        head = web[web.index(f'id="{sid}"'):]
        head = head[:head.index("</h2>")]
        assert word in head, word


def test_home_actions_are_explicit_and_the_library_holds_other_kinds():
    web = _web()
    doors = ("welcome-presentations", "welcome-new", "welcome-folder",
             "welcome-open", "welcome-url")
    words = ("Open", "New", "Folder", "Open", "URL")
    for d, word in zip(doors, words, strict=True):
        assert f'class="wj-new" id="{d}"' in web, d
        button = web[web.index(f'id="{d}"'):]
        button = button[:button.index("</button>")]
        assert 'class="bic"' in button, d
        assert word in button, d


def test_recent_section_can_be_empty_without_becoming_a_library(out):
    web = _web()
    assert 'id="wj-pres">' in web
    assert '<div class="welcome-jump" id="welcome-jump">' in web
    assert 'id="wj-none-pres"' in web
    assert "    w.hidden=false;" in out
    assert "    none('#wj-none-pres',$('#welcome-pres'));" in out


def test_recent_rows_come_from_the_deck_recent_registry(out):
    assert "APP.deckRecentNames&&APP.deckRecentNames()" in out
    assert "function savedRecentPresentationNames(){" in out
    assert "var PRESENT_RECENT_KEY=PFX+'recent-presentations';" in out


def test_open_presentations_has_library_and_folder_creation(out):
    assert 'id="presentation-hub"' in out
    assert 'id="presentation-hub-poster"' in out
    assert 'id="presentation-hub-folderform"' in out
    assert "window.SemApp.deckHub=openPresentationHub;" in out
    assert "window.SemApp.deckNewFolder=function(){" in out


def test_two_columns_are_explicit_not_auto_fit():
    css = assets.load("css/app.css")
    assert (".welcome-jump{display:grid;"
            "grid-template-columns:repeat(2,minmax(0,1fr));") in css
    assert ("@media (max-width:720px){\n"
            "  .welcome-jump{grid-template-columns:minmax(0,1fr);gap:20px;}}"
            ) in css


def test_the_card_grid_and_its_rules_are_gone_together():
    web = _web()
    css = assets.load("css/app.css")
    assert 'class="welcome-btns"' not in web
    for dead in (".welcome-btns{", ".welcome-btns .dbtn{",
                 ".wc-t{", ".wc-h{", ".welcome-btns .wc-wide{"):
        assert dead not in css, dead
