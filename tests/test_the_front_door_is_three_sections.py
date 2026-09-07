"""The front door is three sections, one shape (T282).

The user, 2026-09-05: "the home screen should have three sections with
the files and a new buttons. Order should be presentation, poster,
notebooks grouped together."

This file replaces test_the_front_door_is_one_grid.py, and carries that
file's decision forward rather than dropping it. T240's point (the user,
2026-09-04: "buttons of different shapes and sizes and organisation
everywhere. Please standardise") was never about a GRID -- it was that
the front door's doors must be one shape rather than buttons sized to
their own words. Three section headers with one identical door on each
keeps that; what went is the separate row of cards above them, which
repeated "New presentation" two inches from the presentations and gave
posters no door at all.

Before this, a poster was a row in the presentations list told apart by
a small icon, and the only way to start one was `#pr-newpost` in the
presentations rail -- a panel that collapses, and is collapsed by
default on a narrow window.
"""

from __future__ import annotations

from junoview import assets


def _web() -> str:
    from tests.test_front_door import render_page
    return render_page([], mode="web")


def test_three_sections_in_the_order_asked_for():
    web = _web()
    order = ["wj-pres", "wj-post", "wj-nb"]
    at = [web.index(f'id="{s}"') for s in order]
    assert at == sorted(at), order
    # each one titled. The icon is expanded to inline <svg> by render
    # time, so the title is matched inside its own header slice.
    titles = ("Presentations", "Posters", "Notebooks")
    for sid, word in zip(order, titles, strict=True):
        head = web[web.index(f'id="{sid}"'):]
        head = head[:head.index("</h2>")]
        assert word in head, word


def test_every_section_carries_its_own_door_and_they_are_one_shape():
    """The T240 rule, on the controls that replaced the cards."""
    web = _web()
    doors = ("welcome-new", "welcome-newpost", "welcome-open", "welcome-url")
    for d in doors:
        assert f'class="wj-new" id="{d}"' in web, d
    # words PLUS icon on every one -- never the twice-rejected icon-only.
    # data-ic is expanded to an inline <svg class="bic"> by render time.
    for d, word in zip(doors, ("New", "New", "Open", "URL"), strict=True):
        btn = web[web.index(f'id="{d}"'):]
        btn = btn[:btn.index("</button>")]
        assert 'class="bic"' in btn, d
        assert word in btn, d


def test_a_section_does_not_hide_when_it_is_empty(out):
    """Hiding the Posters section because you have never made one is
    exactly what left "New poster" reachable only from the rail."""
    web = _web()
    assert 'id="wj-post">' in web          # no `hidden` attribute
    assert 'id="wj-pres">' in web
    assert '<div class="welcome-jump" id="welcome-jump">' in web
    assert "    w.hidden=false;" in out
    # ...it says so in one word instead
    assert 'id="wj-none-post"' in web and 'id="wj-none-pres"' in web
    assert "    none('#wj-none-pres',$('#welcome-pres'));" in out


def test_a_poster_is_its_own_kind_not_an_icon_in_a_list(out):
    assert "    var list=all.filter(function(p){return !p.poster;});" in out
    assert "    var posters=all.filter(function(p){return !!p.poster;});" in out
    # one row builder, so the two lists cannot drift apart
    assert "    function row(p,into){" in out
    assert "    list.slice(0,6).forEach(function(p){row(p,host);});" in out
    assert ("    if(phost) posters.slice(0,6)"
            ".forEach(function(p){row(p,phost);});") in out


def test_new_poster_has_a_door_that_does_not_collapse(out):
    """#pr-newpost lives in a rail that collapses; this one does not."""
    assert "  window.SemApp.deckNewPoster=function(){newPoster();};" in out
    assert "    var wPost=$('#welcome-newpost');" in out
    assert "      APP.deckNewPoster();" in out


def test_the_drop_hint_is_on_the_door_it_describes():
    """T77 added it at the user's own request and it is still the only
    place the first screen says drag-and-drop works, and which formats
    parse. T364 took it off the page and put it on Open, because that
    is what it is a fact about (2026-09-07, user: "The open screen
    still has way to much text ... this is so confusing to look at")."""
    web = _web()
    css = assets.load("css/app.css")
    assert "welcome-drop" not in web
    assert "wj-drop" not in web
    # a rule matching nothing is a rule the next reader has to disprove
    assert ".wj-drop{" not in css
    assert ".welcome-drop{" not in css
    # the words themselves survive, on the button
    assert "Open .ipynb, .md, .tex or .csv from this computer" in web
    assert "or drop them anywhere in this window" in web


def test_the_card_grid_and_its_rules_are_gone_together():
    """A CSS rule matching nothing is a rule the next reader has to
    disprove."""
    web = _web()
    css = assets.load("css/app.css")
    assert 'class="welcome-btns"' not in web
    for dead in (".welcome-btns{", ".welcome-btns .dbtn{",
                 ".wc-t{", ".wc-h{", ".welcome-btns .wc-wide{"):
        assert dead not in css, dead


def test_three_across_is_explicit_not_auto_fit():
    """auto-fit resolves to two columns in this box, which would pair
    Posters with Notebooks and leave Presentations alone on a row."""
    css = assets.load("css/app.css")
    assert (".welcome-jump{display:grid;"
            "grid-template-columns:repeat(3,minmax(0,1fr));") in css
    assert ("@media (max-width:720px){\n"
            "  .welcome-jump{grid-template-columns:minmax(0,1fr);gap:20px;}}"
            ) in css


def test_the_links_row_is_the_same_type_as_the_rest():
    css = assets.load("css/app.css")
    assert (".welcome-links{margin-top:20px;font-family:var(--sans);"
            "font-size:13px;") in css
    assert ".wj-none{font-family:var(--mono);font-size:11px;" in css
