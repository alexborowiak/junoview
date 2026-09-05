"""Variations have a door, and a family reads as a family (T293).

The model is T292. This is the half you can reach: the Text styles menu
groups each type with its own variations, offers "New variation of
<type>…" against the box you are looking at, and previews each row in
the look it names.

Driven end to end at 1440x900 on two Heading 1 boxes:
  * "New variation of Heading 1…" on the first writes exactly
    {id:'t1', label:'Navy', of:'h1'} -- a delta, nothing baked;
  * making the second bigger and pushing it to Heading 1 moves BOTH
    boxes to 6.25, which is the inheritance the user asked for;
  * and the menu then reads Title / Heading 1 / -- Navy / Heading 2 ...
    rather than stranding Navy after Caption, where styleOrder appends.
"""

from __future__ import annotations

from junoview import assets


def test_a_family_is_listed_as_a_family(out):
    """styleOrder appends, so a variation of Heading 1 sat last -- after
    Caption -- with nothing saying what it varied."""
    assert "      function styleRow(id,isVar){" in out
    assert "        if(listed[id]||parentOf(id)) return;" in out
    assert "        variantsOf(id).forEach(function(v){" in out
    # ...and an orphan (a variation whose parent has gone) is still listed
    assert "        if(listed[id]) return;      /* an orphaned variation" in out
    css = assets.load("css/deck.css")
    assert ".style-tx-menu .jv-styleopt.jv-stylevar{padding-left:20px;" in css


def test_the_specimen_shows_the_face_too(out):
    """Two variations of one heading differ in exactly what this row
    draws -- colour, weight, slant, face, size -- and the face was the
    one it left out, so a serif variation rendered identically to its
    parent in the one place the user asked for a preview."""
    assert "        if(d.font) t.style.fontFamily=d.font;" in out
    assert "        t.style.fontWeight=d.b?'700':'400';" in out
    assert "        if(d.color) t.style.color=tokVal(d.color);" in out


def test_the_menu_scrolls_now():
    """Seven rows fitted; a family under each heading need not. floatMenu
    clamps a menu's top edge and never scrolls it, so the bottom rows
    were lost with no scrollbar and no error."""
    css = assets.load("css/deck.css")
    assert ("max-height:min(68vh,520px);overflow-y:auto;") in css


def test_a_variation_is_born_from_the_box_you_are_looking_at(out):
    """It is offered against the type the selection already wears --
    the only moment "a variation of Heading 1" means anything -- and it
    records only what DIFFERS, so the look still follows its parent for
    everything you did not change."""
    assert "        mkv.innerHTML=bic('plus')+' New variation of '" in out
    assert "          var v=addVariant(nm,base);" in out
    assert "          var p=styleDef(base),o={};" in out
    assert ("          if(a5.size&&Math.abs(a5.size-p.size)>0.01) "
            "o.size=a5.size;") in out
    assert "          if(Object.keys(o).length) deckStyles()[v.id]=o;" in out


def test_restyling_a_parent_restyles_its_family(out):
    """applyStyleTo BAKES, so a box wearing a variation carries its
    parent's old numbers until something re-stamps it. This walk matched
    a.style exactly, so pushing a new look to Heading 1 moved every
    plain heading and left every variation behind. Driven: Heading 1
    went to 6.25 and the varied box stayed at 5, while styleDef already
    resolved it to 6.25 -- the registry was right and the slides did not
    know."""
    assert "    var want=null;" in out
    assert "        if(typeof variantsOf==='function')" in out
    assert "          variantsOf(id).forEach(function(v){want[v]=1;});" in out
    assert "        if(a&&a.k==='text'&&a.style&&(!want||want[a.style])){" in out


def test_apply_to_all_headings_does_not_flatten_them(out):
    """It pushes weight, slant, face and colour across every heading --
    exactly the set a variation exists to differ in, so one press would
    erase every variation in the deck. Their parents are in the same
    list, and moving a parent moves its family."""
    assert "          if(parentOf(id)) return;" in out
