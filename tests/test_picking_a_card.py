"""Picking a notebook card into a frame works again (T618).

"The regular adding a figure from a notebook by clicking on it is not
working" and "I have to click the esc key multiple times to get out of
the notebook select view". T596 made the editor mark everything behind it
INERT (#docs among them) while a deck is open, and only closeDeck lifted
it. A pick hides the deck to show the notebook -- but the notebook stayed
inert, so a click on a card hit <body> and the frame never filled. Pick
mode now lifts the isolation, and endPick's openDeck restores it. Escape
was heard on document in the bubble phase, after any notebook control
that answers Escape first; it is now on window, in capture.

Driven at 1366x657: a frame drawn with From notebook, a figure card
clicked, the frame filled with the figure; a second pick ended by one
Escape with the notebook's Which plots menu open.
"""

from __future__ import annotations

from helpers_js import lift_fn
from junoview import assets


def test_a_pick_brings_the_notebook_back_to_life():
    js = assets.deck_js()
    start = lift_fn(js, "startPick")
    assert start.index("deckEl.hidden=true;") < start.index(
        "deckIsolate(false);")
    # and leaving the pick restores the editor, isolation and all
    end = lift_fn(js, "endPick")
    assert "openDeck('edit',true);" in end
    ui = lift_fn(js, "setUIMode")
    assert "deckIsolate(full,editing);" in ui


def test_escape_ends_a_pick_at_the_first_press():
    js = assets.deck_js()
    guard = ("  window.addEventListener('keydown',function(e){\n"
             "    if(picking<0||e.key!=='Escape') return;\n"
             "    e.preventDefault();e.stopImmediatePropagation();\n"
             "    endPick();\n  },true);")
    assert guard in js
