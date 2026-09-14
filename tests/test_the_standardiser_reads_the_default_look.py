"""T425: the default look is not a difference.

Every template-born box carries align:'left' and bg:0, and a style that
says nothing about either means "the default" -- left, transparent.
stdMatchesStyle read both strictly, so a poster fresh from its template
reported "7 of 7 Heading 2 boxes no longer match the style", and a
slide deck built from the Title + text layout reported the same of its
headings. A style that ASKS for a ground (T314) still catches a box
that lost it.

Driven live: the 3-column poster template and three Title + text
slides both standardise to no named findings.
"""

from __future__ import annotations


def test_left_is_the_default_alignment(out):
    fn = out.split("  function stdMatchesStyle(a,d){")[1].split("\n  }")[0]
    assert "    if((a.align||'left')!==(d.align||'left')) return false;" in fn
    assert "(a.align||'')!==(d.align||'')" not in fn


def test_transparent_is_transparent(out):
    fn = out.split("  function stdMatchesStyle(a,d){")[1].split("\n  }")[0]
    assert "    var abg=(a.bg===0)?'':(a.bg?(a.bgc||''):''),dbg=d.bg||'';" in fn
    assert "    if(dbg==='none') dbg='';" in fn
    # a style that asks for a ground still compares it
    assert "    if(abg!==dbg) return false;" in fn
