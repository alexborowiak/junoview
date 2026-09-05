"""The history opens on a difference, not on "no difference" (T269).

The user, 2026-09-04, with a screenshot: "the history tab looks mid."

The screenshot shows why, and it is not decoration. The panel opens on
the newest version -- "20:27 · you are here" -- and reads it against
"now (the deck you are editing)". Those are the same thing. So the
headline is "20:27 -> now: no difference", the three view tabs have
nothing under them, and the whole right-hand pane is empty. Every time
you open the history, that is what you get first.

`histAgainst` defaults to '' with the comment "the deck you are
editing, which is what you want nine times in ten". That is true of an
OLD version -- "what have I done since then" is the usual question --
and false of the newest one, which is the only one the panel ever opens
on. For that one the useful question is what it changed, so it is read
against the version before it.

Applied only when nothing has been picked by hand: choosing a
comparison from the dropdown and then clicking around keeps it.
"""

from __future__ import annotations

from junoview import assets


def test_the_default_comparison_cannot_become_sticky():
    """T286, and the bug T269 shipped with the default it introduced.

    The panel opens on the newest version, so histAutoAgainst writes a
    comparison. Ask  next time and you cannot tell that
    choice from this one -- so every later click inherited it,
    histAgainst was never empty again, and the per-slide "Put it back" /
    "Use the old one" buttons, which render only when comparing against
    the LIVE deck, were gone for the rest of the session.

    Three things have to hold together, which is why they are one test:
    the flag exists, only the dropdown sets it, and closing the panel
    clears both.
    """
    js = assets.deck_js()
    assert "  var histAgainstPicked=false;" in js
    # set in exactly one place: the dropdown
    assert js.count("histAgainstPicked=true") == 1
    assert "      histAgainst=sel.value;histAgainstPicked=true;" in js
    # and the restore buttons still key off the live-deck comparison
    assert "if(r.a&&!histAgainst&&(r.st==='removed'||r.st==='changed')){" in js
    # a comparison belongs to the visit it was chosen in
    close = js.split("  function histPanelClose(){")[1].split("\n  }")[0]
    assert "histAgainst='';histAgainstPicked=false;" in close


def test_the_newest_version_is_read_against_the_one_before_it():
    js = assets.deck_js()
    assert "  function histAutoAgainst(ix,ent){" in js
    fn = js.split("  function histAutoAgainst(ix,ent){")[1].split("\n  }")[0]
    # an explicit choice always wins -- and T286 made "explicit" a fact
    # the code stores rather than one it infers. Asking "if(histAgainst)"
    # could not tell a choice from the default this function had just
    # written, so after one open the default became sticky and the
    # per-slide restore buttons, which need histAgainst empty, were
    # unreachable for the rest of the session.
    assert "if(histAgainstPicked) return histAgainst;" in fn
    assert "if(histAgainst) return histAgainst;" not in fn
    # only the newest entry is redirected
    assert "if(ent.id!==ix[ix.length-1].id) return '';" in fn
    assert "return ix[ix.length-2].id;" in fn
    # ...and a history with one entry has nothing to compare against
    assert "if(!ix||ix.length<2||!ent) return '';" in fn


def test_it_is_used_where_a_version_becomes_the_selected_one():
    js = assets.deck_js()
    # on open
    assert ("        histAgainst=histAutoAgainst(ix,ix[ix.length-1]);\n"
            "        histCompare(ov,ix[ix.length-1]);}") in js
    # ...and when you click back onto that row
    assert ("        histSel=e.id;histRows(ov,ix);\n"
            "        histAgainst=histAutoAgainst(ix,e);\n"
            "        histCompare(ov,e);});") in js


def test_an_empty_answer_says_which_two_it_compared():
    js = assets.deck_js()
    assert "'These two versions are the same.'" in js
    assert "'This version is the deck you are editing " in js
    assert "see what you have done since then.'" in js
    # the bare sentence that said neither is gone
    assert "Nothing is different between these two." not in js
