"""The File menu holds what only it can do (T236).

The user, 2026-09-04: "The file menu has too many options. The auto
presentation isn't really a thing. Some of these have buttons elsewhere
- the page numbers, the refresh images from files. The history as well
I don't like here, should be a button on the home tab."

Driven at 1700px: three sections and twelve visible rows, down from
five and nineteen; Home grows a Saved versions group whose History tile
opens the version screen and whose Checkpoint button takes one.
"""

from __future__ import annotations

import re

from junoview import assets


def _menu() -> str:
    html = assets.deck_html()
    i = html.index('id="dc-menu"')
    return html[i:html.index("</div>", html.index('id="mi-del"'))]


def test_nothing_in_it_has_a_button_somewhere_else():
    menu = _menu()
    # slide numbers are Design > Page furniture > Numbers
    assert 'id="mi-nums"' not in menu
    assert 'id="dc-nums"' in assets.deck_html()
    # both refreshes have been Home tiles since T196
    for gone in ("mi-refresh-img", "mi-refresh-figs"):
        assert f'id="{gone}"' not in menu, gone
    for door in ("hm-refresh-img", "hm-refresh-figs"):
        assert f'id="{door}"' in assets.deck_html(), door


def test_the_forwarding_became_a_call(out):
    """A Home button that clicks a File row is how one verb comes to
    have two buttons; with the rows gone they call the verb."""
    assert "      e.stopPropagation();refreshImagesReport();});" in out
    assert "      e.stopPropagation();resyncAllFigures();});" in out
    assert "  function toggleSlideNums(){" in out
    assert ("  if(numB) numB.addEventListener('click',function(){\n"
            "    toggleSlideNums();") in out
    # ...and the preflight card calls it too, instead of clicking a row
    assert "      function(){resyncAllFigures();}," in out


def test_auto_build_is_gone(out):
    """It replaced pres.slides wholesale -- the deck you had made, gone,
    to lay the notebook out again -- which is what a new presentation
    does from a clean start."""
    for gone in ("mi-auto-figs", "mi-auto-figdocs"):
        assert gone not in out, gone
    # the function it called is still what a NEW deck is built from
    assert "  function autoSlides(withDocs){" in out
    assert "  function defaultPres(){return {name:'presentation'," \
        "slides:autoSlides(false)};}" in out


def test_history_and_checkpoint_are_home_buttons():
    html = assets.deck_html()
    assert 'id="mi-hist"' not in html and 'id="mi-check"' not in html
    assert '<span class="rbn-grp rbn-vers" data-tab="home"' in html
    assert '<span class="rbn-lab">Saved versions</span>' in html
    assert 'id="hm-history"' in html and 'id="hm-check"' in html
    out = assets.deck_js()
    assert "  function versionDoorsBoot(){" in out
    assert "  versionDoorsBoot();" in out
    assert "      e.stopPropagation();openHistory();});" in out
    assert "      e.stopPropagation();histCheckpoint(null);});" in out


def test_crop_marks_sit_with_the_export_they_are_for():
    menu = _menu()
    assert menu.index('id="mi-crop"') > menu.index('id="mi-pdf"')
    assert menu.index('id="mi-crop"') < menu.index('id="mi-pptx"')
    heads = re.findall(r'class="dc-mhead[^"]*">([^<]+)<', menu)
    assert "page" not in heads, heads
