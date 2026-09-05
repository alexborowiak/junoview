"""Variations in the Style system, with their colour visible (T295).

The user, 2026-09-05: "These styles should be available in the style
system as well to apply to things."

They arrive in the rail for free -- it walks styleOrder(), which appends
every pres.types id, and every consumer on that 1200-line surface treats
the selection as an opaque string. What did NOT work was reading it:

  * styleOrder appends, so a variation of Heading 1 sat last, after
    Caption, with nothing saying what it varied;
  * the rail blanks each row's colour on purpose -- a style whose ink is
    the page's would vanish against chrome (2026-09-03, "a lot of the
    text can't be read") -- so two variations differing only in colour
    drew as two identical rows, in the one place the user asked for a
    preview of the colours.

Driven at 1440x900 on a deck with Navy and Coral variations of Heading
1: the rail reads Heading 1 / -- Navy / -- Coral with the right swatch
on each, every board draws exactly its own wearer, none is flagged as
"no longer matches the style", and standardise() reports no findings --
"three Heading 1 boxes, two wearing variations" is not drift.
"""

from __future__ import annotations

from junoview import assets


def test_the_rail_groups_a_family(out):
    assert "    function styleRow(id,isVar){" in out
    assert "      if(listed[id]||parentOf(id)) return;" in out
    assert "      variantsOf(id).forEach(function(v){" in out
    css = assets.load("css/deck.css")
    assert ".dg-row.dg-rowvar{padding-left:22px;position:relative;}" in css


def test_the_colour_rides_on_a_chip_not_the_name(out):
    """Blanking the name is still right. The chip sits on a known ground
    and so cannot disappear into it."""
    assert "      nm.style.color='';" in out          # unchanged, on purpose
    assert "        chip.className='dg-swatch';" in out
    assert "        chip.style.background=tokVal(d.color);" in out
    css = assets.load("css/deck.css")
    assert ".dg-swatch{flex:none;width:11px;height:11px;" in css
    assert "body.light .dg-swatch{border-color:#00000026;}" in css


def test_a_row_says_what_it_varies(out):
    assert ("        +(par?(', a variation of '+(styleDef(par)||{}).label)"
            ":'')") in out


def test_dgwearers_stays_an_exact_match(out):
    """dgRestamp is built on it and calls applyStyleTo with the SELECTED
    id. One loosened predicate and every colour variation is silently
    repainted in its parent's colour the next time anyone nudges Heading
    1 -- so a variation gets its OWN row, board and re-stamp instead."""
    fn = out.split("  function dgWearers(id){")[1].split("\n  }")[0]
    assert "a.style===id" in fn
    assert "variantsOf" not in fn and "parentOf" not in fn
    restamp = out.split("  function dgRestamp(id){")[1].split("\n  }")[0]
    assert "applyStyleTo(w.a,id)" in restamp


def test_an_orphaned_variation_is_still_listed(out):
    """A variation whose parent has been deleted must not vanish from
    the one screen that could tell you it exists."""
    assert "      if(listed[id]) return;       /* a variation whose parent" in out
