"""The editor does not duplicate the app's navigation (T374).

The user, 2026-09-10: the presentation Close button is broken and does
not need to exist; Home is redundant because the Junoview logo already
owns that journey. Present mode still needs its explicit exit because
the application chrome is deliberately absent there.
"""

from __future__ import annotations

from junoview import assets


def test_redundant_home_and_close_are_not_in_the_editor_bar():
    html = assets.deck_html()
    assert 'id="qat-home"' not in html
    assert 'id="qat-close"' not in html
    assert 'class="rbn-stack qat-way"' not in html


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
