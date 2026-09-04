"""Closing Find puts back the view it opened (T245).

Review, 2026-09-04. `findGo()` un-hides the card a hit is in and forces
it expanded -- which is the whole point of being able to find inside
content the filters folded. `findOpen(false)` then took back only the
`.jv-hitopen` part flags, so the card's own two changes were permanent.

Reproduced before the fix, on the example notebook at 1440x900: with
Code set to Off and card-imports-plotting-style hidden by hand with its
eye, searching "numpy" opened that card -- and after closing the bar it
was still missing from `.card.is-hidden` and still carried `.expanded`.
A cell you had chosen to hide was back for good, and the only way to
re-hide it was to find its eye again.

Re-running applyFilters() is NOT the fix. It deliberately keeps a
note's `expanded` while that note's filter says collapsed, because the
flag is also the reader's own "I opened this one" -- and find's forced
expand is indistinguishable from it. So the two flags find actually
changes are recorded per card, before it changes them, and put back
verbatim.

Driven after the fix with the same setup plus a hand-folded note: the
document's hidden / expanded / collapsed / part-fold sets and the
jv-hit, jv-hitcard and jv-hitopen counts after closing the bar were
identical to the snapshot taken before Find was opened.
"""

from __future__ import annotations

from junoview import assets


def test_find_records_what_it_opened_before_it_opens_it():
    app = assets.app_js()
    assert "  var findHits=[],findAt=-1,findTerm='',findOpened=[];" in app
    go = app.split("  function findGo(d){")[1].split("\n  function ")[0]
    # recorded BEFORE the mutation, or it records the opened state
    rec = go.index("findOpened.push({el:card,")
    mut = go.index("card.classList.add('jv-hitcard','expanded');")
    assert rec < mut
    assert "          hidden:card.classList.contains('is-hidden')," in go
    assert "          expanded:card.classList.contains('expanded')});" in go


def test_stepping_back_over_a_card_keeps_its_original_state():
    """jv-hitcard doubles as the "already recorded" flag, so visiting a
    card a second time does not overwrite what it looked like with what
    find made of it."""
    app = assets.app_js()
    assert "      if(!card.classList.contains('jv-hitcard'))" in app


def test_closing_puts_both_flags_back():
    app = assets.app_js()
    assert "  function findRestore(){" in app
    assert "      r.el.classList.toggle('is-hidden',r.hidden);" in app
    assert "      r.el.classList.toggle('expanded',r.expanded);" in app
    # ...and the part flags, in the same place, so one function undoes it all
    assert "    $$('.jv-hitopen').forEach(function(n){" in app.split(
        "  function findRestore(){")[1].split("\n  function ")[0]


def test_a_new_search_also_puts_the_last_one_back():
    """findRun clears before it marks; the restore has to ride along, or
    typing a second term leaves the first term's openings behind."""
    app = assets.app_js()
    clear = app.split("  function findClear(){")[1].split("\n  function ")[0]
    assert "findRestore();" in clear
    run = app.split("  function findRun(term){")[1].split("\n  function ")[0]
    assert "findClear();" in run


def test_close_no_longer_hand_clears_only_the_part_flags():
    """The old close did `findClear()` then removed .jv-hitopen and
    nothing else -- that missing "and nothing else" was the bug."""
    app = assets.app_js()
    close = app.split("  function findOpen(on){")[1].split("\n  function ")[0]
    assert "findClear();" in close
    # the hand-rolled part-flag sweep is gone from close (the comment
    # that names it is not code)
    assert "$$('.jv-hitopen')" not in close
