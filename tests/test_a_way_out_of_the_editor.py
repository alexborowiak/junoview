"""The editor's way out (T374, then T396).

The user, 2026-09-10: the presentation Close button is broken and does
not need to exist; Home is redundant because the Junoview logo already
owns that journey. Present mode still needs its explicit exit because
the application chrome is deliberately absent there.

T396 brought Home back (2026-09-13, user: "There needs to be a home
button up the top of presentation"): the logo is on the rail, and the
rail is behind the full-screen editor, so from a presentation there was
no Home at all. Close stays gone. The chevron beside Home opens the
deck's own list of what is open.
"""

from __future__ import annotations

from junoview import assets


def test_home_is_in_the_editor_bar_and_close_is_not():
    html = assets.deck_html()
    assert ('<button class="dbtn qat-btn" id="qat-home" type="button"' in html)
    assert '<i data-ic="home"></i> Home</button>' in html
    assert 'id="qat-open"' in html
    assert 'id="qat-close"' not in html
    assert 'class="rbn-stack qat-way"' not in html


def test_home_goes_home_and_the_chevron_opens_the_drawer(out):
    assert "    var home=$('#qat-home');" in out
    assert ("      if(window.SemApp&&window.SemApp.goHome) "
            "window.SemApp.goHome(true);") in out
    assert "    return [$('#deck-pres-open'),$('#qat-open')].filter(Boolean);" in out
    assert ".deck.editing .deck-pres-drawer{top:40px;z-index:136;}" in out


def test_escape_keeps_the_editor_to_builder_journey(out):
    assert "      else if(mode==='edit'){setUIMode('create');}" in out
    assert "      else closeDeck();" in out


def test_the_pick_bars_primary_button_is_wired(out):
    """#pick-done was shown by syncPickbar and referenced nowhere else in
    the JS tree: the one blue button in the flip-book flow did nothing."""
    assert "  var pickDone=$('#pick-done');" in out
    assert "  if(pickDone) pickDone.addEventListener('click',function(){" in out


def test_present_mode_still_has_an_exit(out):
    assert 'id="deck-exit"' in assets.deck_html()
    assert "$('#deck-exit').addEventListener('click'" in out
