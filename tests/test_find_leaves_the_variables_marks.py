"""T246: document Find does not erase the Variables match.

The Variables filter paints its matched letters with the same
mark.jv-hit look, and findClear used to unwrap every .jv-hit on the
page -- so running or closing document Find erased the highlight of a
still-active Variables query. The document's marks carry jv-doc as
well, and that is all Find clears.

Driven on the example notebook: with the Variables list filtered by
"bl" (3 marks), searching "blocking" gave 23 document marks and left
the 3; closing the bar left 0 document marks and still the 3.
"""

from __future__ import annotations

from junoview import assets


def test_document_marks_carry_their_own_class():
    app = assets.load("js/app.js")
    mark = app.split("  function findMark(root,term){")[1].split("\n  function ")[0]
    assert "        mk.className='jv-hit jv-doc';" in mark
    # the Variables filter's mark is plain jv-hit: the look, not the owner
    assert "              mk.className='jv-hit';" in app


def test_find_clears_only_its_own_marks():
    app = assets.load("js/app.js")
    clear = app.split("  function findClear(){")[1].split("\n  function ")[0]
    assert "    $$('mark.jv-doc').forEach(function(m){" in clear
    assert "$$('.jv-hit')" not in clear
    go = app.split("  function findGo(d){")[1].split("\n  function ")[0]
    assert "    $$('.jv-doc.on').forEach(function(m){m.classList.remove('on');});" in go
