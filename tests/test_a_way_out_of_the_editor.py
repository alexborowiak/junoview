"""The editor's way out, through the shared application rail.

The user, 2026-09-10: the presentation Close button is broken and does
not need to exist; Home is redundant because the Junoview logo already
owns that journey. Present mode still needs its explicit exit because
the application chrome is deliberately absent there.

The rail is now live beside the editor, so its logo remains the one Home
control and its open-file / presentation lists remain the one sidebar.
The audience view keeps its small exit and open-items drawer because the
editor's navigation rail would distract from a live talk.
"""

from __future__ import annotations

from junoview import assets


def test_editor_has_no_second_home_or_open_items_control():
    html = assets.deck_html()
    assert 'id="qat-home"' not in html
    assert 'id="qat-open"' not in html
    assert 'id="qat-close"' not in html
    assert 'class="rbn-stack qat-way"' not in html


def test_editor_uses_the_live_logo_rail(out):
    assert 'id="presrail-home"' in assets.page_template()
    assert "    return [$('#deck-pres-open')].filter(Boolean);" in out
    assert ".deck.creating,.deck.editing{left:var(--presrail-w);}" in out
    assert "deckIsolate(full,editing);" in out
    assert "if(railLive&&(sel==='#presrail'||sel==='#presrail-show')) return;" in out
    assert "if(document.body.classList.contains('slide-editing')&&APP.deckClose)" in out


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
    # T497: guarded, like #pick-done above -- an unguarded lookup at the
    # IIFE's own level is what test_js_contract.py now refuses
    assert "  var exitBtn=$('#deck-exit');" in out
    assert "  if(exitBtn) exitBtn.addEventListener('click',function(){" in out
