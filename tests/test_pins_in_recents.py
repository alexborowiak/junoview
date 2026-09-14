"""T435: pins in Recents.

The user, 2026-09-14: "would be cool to be able to pin files to
recent. I feel like I am always losing files and hard to keep track
of."

A pinned presentation heads Recent -- on Home, in the library dialog
and in the presenting drawer's Recents door -- and never falls off the
end of the list however many others are opened after it. The pin is a
small button on every row; a rename or a delete follows it. Notebooks
get the same on Home's recent list and in the open dialog, kept beside
the six-or-ten recent paths so the pins do not eat the list.

Driven live: pinning the last presentation on Home moved it to the
top with the pinned mark, a notebook likewise, both survived a reload,
and the library's Recent column led with the pinned one.
"""

from __future__ import annotations


def test_pinned_presentations_lead_recent_and_never_drop(out):
    assert "  var PRESENT_PIN_KEY=PFX+'pinned-presentations';" in out
    assert "    'pinned-presentations':1};   /* T435 */" in out
    assert "  function togglePinPresentation(name){" in out
    fn = out.split("  function savedRecentPresentationNames(){")[1] \
        .split("\n  }")[0]
    assert ("    names=pins.concat(names.filter(function(n){"
            "return pins.indexOf(n)<0;}));") in fn
    assert "        if(p) p.pinned=pins.indexOf(name)>=0;" in fn
    # a rename and a delete follow the pin
    assert ("    lsSet(PRESENT_PIN_KEY,JSON.stringify(rename("
            "pinnedPresentationNames())));") in out
    assert ("    lsSet(PRESENT_PIN_KEY,JSON.stringify(pinnedPresentationNames()"
            "\n      .filter(function(n){return n!==name;})));") in out


def test_the_pin_is_on_every_row(out):
    # the library dialog
    assert "    pin.className='presentation-hub-pin'+(pinned?' on':'');" in out
    assert "      var on=togglePinPresentation(p.name);" in out
    # Home's presentations, through the deck's own toggle
    assert "    window.SemApp.deckPinToggle=togglePinPresentation;" in out
    assert "        if(APP.deckPinToggle) APP.deckPinToggle(p.name);" in out
    assert "    list.slice(0,6+npin).forEach(row);" in out
    # notebooks: Home and the open dialog
    assert "  function nbPinToggle(p){" in out
    assert "  function recentWithPins(){" in out
    assert "    var rec=recentWithPins(),pins=nbPinned();   /* T435: pins first */" \
        in out
    assert "      b.appendChild(pinButton(p,pins.indexOf(p)>=0,'recent-pin'));" \
        in out
    assert ".odlg-r .recent-pin{grid-column:3;grid-row:1/3;align-self:center;}" \
        in out
