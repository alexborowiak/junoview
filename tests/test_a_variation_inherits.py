"""A variation stores only what it changes, and follows its parent (T292).

The user, 2026-09-05: "under Heading 1 you can create variations of what
Heading 1 can look like ... You should be able to create names for these
and the preview should show the colours, font styles, size etc."

A variation is a type carrying `of`. It is deliberately NOT a second
field on the box: a box still wears `a.style` and nothing else, so every
consumer -- the outline, the standardiser, applyStyleTo, the pptx and
PDF exporters, the thumbnails -- keeps working untouched. The mapping
pass found no consumer that needs to learn a new concept, and one that
would actively BREAK under a second field: `standardise()` buckets by
exact `a.style`, so "four Heading 1s, two wearing Navy" is silently
correct only because the variation is its own type.

Everything here RUNS the shipped registry in a real JS engine. The
inheritance is arithmetic over four objects and a substring assertion
cannot check arithmetic.
"""

from __future__ import annotations

import pytest
from tests.test_a_custom_heading_is_a_heading import _run


def _get(script):
    got = _run(script)
    if got is None:
        pytest.skip("no node or VS Code Electron on this machine")
    return got


def test_a_variation_leaves_out_what_it_does_not_change():
    got = _get("""
      pres={};
      var v=addVariant('Navy','h1');
      console.log(JSON.stringify({
        entry:v,
        keys:Object.keys(v).sort(),
        resolvedSize:styleDef(v.id).size,
        parentSize:styleDef('h1').size,
        resolvedBold:!!styleDef(v.id).b,
        label:styleDef(v.id).label
      }));
    """)
    # the stored entry is a DELTA: an id, a name and a parent
    assert got["keys"] == ["id", "label", "of"], got["entry"]
    # ...and it resolves to its parent for everything it does not say
    assert got["resolvedSize"] == got["parentSize"] == 5.0
    assert got["resolvedBold"] is True
    assert got["label"] == "Navy"


def test_changing_the_parent_moves_every_variation():
    """The whole reason the registry exists, one level further down."""
    got = _get("""
      pres={};
      var v=addVariant('Navy','h1');
      pres.styles={};pres.styles[v.id]={color:'#1c3b7a'};
      var before=styleDef(v.id);
      pres.styles.h1={size:6.4};
      var after=styleDef(v.id);
      console.log(JSON.stringify({
        beforeSize:before.size, afterSize:after.size,
        parentAfter:styleDef('h1').size,
        colourKept:after.color
      }));
    """)
    assert got["beforeSize"] == 5.0
    assert got["afterSize"] == 6.4 == got["parentAfter"], (
        "a variation must follow its parent's size")
    # ...and keeps the one thing it does say
    assert got["colourKept"] == "#1c3b7a"


def test_the_child_wins_where_it_speaks():
    got = _get("""
      pres={};
      var v=addVariant('Navy','h1');
      pres.styles={h1:{color:'#000000',size:5.0},};
      pres.styles[v.id]={color:'#1c3b7a'};
      console.log(JSON.stringify({
        parent:styleDef('h1').color, child:styleDef(v.id).color,
        size:styleDef(v.id).size}));
    """)
    assert got["parent"] == "#000000"
    assert got["child"] == "#1c3b7a"
    assert got["size"] == 5.0


def test_a_size_less_variation_is_not_body_sized():
    """syncCustomTypes defaulted a type with no numeric size to 2.6 --
    Body. That was right while every type was a full copy and exactly
    wrong for a delta: a variation meaning "Heading 1, but navy" was
    grafted at body size, applyStyleTo shrank every box wearing it, and
    the family then reported as drift."""
    got = _get("""
      pres={types:[{id:'t9',label:'H1 Navy',of:'h1',color:'#1c3b7a'}]};
      syncCustomTypes();
      var variantSize=styleDef('t9').size;
      var box={k:'text'};applyStyleTo(box,'t9');
      /* read BEFORE swapping decks: syncCustomTypes drops every type
         that is not in the pres it is given, which is the leak guard */
      pres={types:[{id:'t8',label:'Loose',color:'#111111'}]};
      syncCustomTypes();
      console.log(JSON.stringify({
        variantSize:variantSize,
        stamped:box.size,
        orphanSize:styleDef('t8').size,
        gone:styleDef('t9')}));
    """)
    assert got["variantSize"] == 5.0, "a variation inherits its size"
    assert got["stamped"] == 5.0, "and applyStyleTo stamps the resolved one"
    # a type with NO parent has nothing to inherit and keeps the old answer
    assert got["orphanSize"] == 2.6
    # ...and one deck's types still do not leak into the next
    assert got["gone"] is None


def test_a_heading_variation_is_still_a_heading():
    got = _get("""
      pres={};
      var v=addVariant('Navy','h1');
      console.log(JSON.stringify({
        isHeading:isHeadingStyle(v.id),
        inList:headingStyles().indexOf(v.id)>=0,
        root:styleRoot(v.id),
        isVariantOfH1:isVariantOf(v.id,'h1'),
        isVariantOfH2:isVariantOf(v.id,'h2'),
        variantsOfH1:variantsOf('h1')}));
    """)
    # inherited through styleDef, so it needed no separate rule
    assert got["isHeading"] is True
    assert got["inList"] is True
    assert got["root"] == "h1"
    assert got["isVariantOfH1"] is True
    assert got["isVariantOfH2"] is False
    assert len(got["variantsOfH1"]) == 1


def test_a_cycle_cannot_hang_the_renderer():
    """normPres deep-copies a types entry without looking inside it, so a
    deck file naming two types as each other's parent survives a load --
    and styleDef runs on the order of forty times per render."""
    got = _get("""
      pres={types:[{id:'ta',label:'A',of:'tb'},
                   {id:'tb',label:'B',of:'ta'}]};
      syncCustomTypes();
      var d=styleDef('ta');
      console.log(JSON.stringify({
        resolved:!!d, chain:styleChain('ta'),
        selfParent:(function(){
          pres={types:[{id:'tc',label:'C',of:'tc'}]};syncCustomTypes();
          return styleChain('tc');})()}));
    """)
    assert got["resolved"] is True, "a cycle must resolve, not hang"
    assert len(got["chain"]) <= 8
    # a type naming itself is not a parent link at all
    assert got["selfParent"] == ["tc"]


def test_basing_a_new_type_on_a_variation_does_not_copy_the_parent_link():
    """Basing a type on one is not the same act as varying it -- which is
    why `of` is carried explicitly rather than through STYLE_FIELDS,
    where addCustomType's copy loop would have picked it up."""
    got = _get("""
      pres={};
      var v=addVariant('Navy','h1');
      var t=addCustomType('Something else',v.id);
      console.log(JSON.stringify({
        variantParent:parentOf(v.id),
        copyParent:parentOf(t.id),
        copySize:styleDef(t.id).size}));
    """)
    assert got["variantParent"] == "h1"
    assert got["copyParent"] == "", "a full copy is nobody's variation"
    # ...and it took the resolved look with it, as addCustomType always did
    assert got["copySize"] == 5.0


def test_the_style_editor_does_not_freeze_a_variation(out):
    """`over()` deliberately materialises the whole resolved definition
    into pres.styles, so a partial override plus a later base change
    cannot read as a style that half-followed. For a VARIATION,
    half-following is the entire point -- and doing it there would
    freeze the parent's size, weight and colour into the child the first
    time anyone touched any toggle, silently and for good.

    Not run in the engine: `over` is nested inside styleEditor and needs
    the DOM the editor builds. Pinned on the guard instead."""
    assert "        var varying=(typeof parentOf==='function')&&!!parentOf(id);" in out
    assert "        if(!varying) o.size=d.size;" in out
    assert "          if(varying) return;" in out


def test_bigger_and_smaller_skip_a_variation(out):
    """scaleStyles walks styleOrder() and writes an own size onto each.
    A variation's parent is in that same loop, so moving the parent
    moves the family -- writing the child too would scale it twice AND
    give it an own size it would never let go of."""
    assert ("      if(typeof parentOf==='function'&&parentOf(id)) return;"
            ) in out
