"""A look applied to a type keeps it that type (T608).

"In the style system when you have applied a look to all of heading one,
that then doesn't still group it with the headings 1s ... That is just a
different look not a different thing now." Applying a look over EVERY
box of a type now changes the type itself instead of naming a variation,
and the Style system counts, shows and re-stamps a type together with its
looks (variations) -- each box re-stamped with its own id, so a look keeps
what makes it a look. A type made "based on" another is not a look and
keeps its own row.
"""

from __future__ import annotations

import pytest

from helpers_js import lift_fn
from junoview import assets
from test_a_custom_heading_is_a_heading import _run


def _get(script):
    src = assets.deck_js()
    extra = "\n".join(lift_fn(src, f) for f in
                      ("dgInFamily", "dgWearers", "dgFamilyWearers",
                       "dgRestamp"))
    got = _run(extra + "\n" + script)
    if got is None:
        pytest.skip("no JS engine")
    return got


SCRIPT = """
  pres={slides:[]};
  var v=addVariant('Warm','h1');
  pres.styles={}; pres.styles[v.id]={color:'@warm'};
  var t=addCustomType('Pull quote','h1');          /* a DIFFERENT type */
  function box(st){var a={k:'text',text:'x'};applyStyleTo(a,st);return a;}
  pres.slides=[{annots:[box(v.id)]},{annots:[box(v.id)]},
               {annots:[box('h1'),box(t.id)]}];
  var before={fam:dgFamilyWearers('h1').length,exact:dgWearers('h1').length,
              own:dgFamilyWearers(t.id).length};
  pres.styles.h1={i:1};                              /* change Heading 1 */
  dgRestamp('h1');
  var all=[];pres.slides.forEach(function(s){s.annots.forEach(function(a){
    all.push({style:a.style,i:!!a.i,color:a.color||''});});});
  console.log(JSON.stringify({before:before,v:v.id,t:t.id,all:all}));
"""


def test_a_look_is_counted_and_restamped_with_its_type():
    got = _get(SCRIPT)
    assert got["before"] == {"fam": 3, "exact": 1, "own": 1}
    by: dict = {}
    for a in got["all"]:
        by.setdefault(a["style"], []).append(a)
    # the two boxes wearing the look follow Heading 1 AND keep their colour
    assert all(a["i"] and a["color"] == "@warm" for a in by[got["v"]])
    assert by["h1"][0]["i"] is True
    # a genuinely different type is not touched by Heading 1's restamp
    assert by[got["t"]][0]["i"] is False


def test_applying_to_every_box_of_a_type_changes_the_type():
    js = assets.deck_js()
    var = js.split("    function commitAsVariation(idxs,want,samp){", 1)[1]
    assert var.startswith(
        "\n      var base=srcA.style,p=styleDef(base);\n"
        "      if(wholeType(idxs)){commitToStyle(want,samp);return;}")
    to = js.split("    function commitToStyle(want,samp){", 1)[1].split(
        "\n    }\n", 1)[0]
    assert "var o=variantDeltaFrom(srcA,base,want);" in to
    assert "deckStyles()[base]=rec;" in to
    assert "var n=restyleAll([base]);" in to
    assert "addVariant" not in to


def test_the_style_system_lists_a_type_with_its_looks():
    js = assets.deck_js()
    assert "dg-var-toggle" not in js and "dgVarOpen" not in js
    assert "      var n=dgFamilyWearers(id).length;" in js
    assert ("      return !parentOf(id)&&dgFamilyWearers(id).length>0;});"
            in js)
    assert "    var wear=dgFamilyWearers(id);" in js


def test_the_tie_is_offered_only_for_the_sources_own_type():
    """2026-10-08 review: with the Apply dialog's chip set to another
    type, Apply rewrote the SOURCE's type across the whole deck (even on
    unticked slides) and left the chosen type alone. The tie is only
    offered while the chosen type is the source box's own."""
    tie = assets.deck_js().split("    function tieSync(){", 1)[1].split(
        "\n    }\n", 1)[0]
    assert ("      var ok=isStyleKey(srcKey)&&srcA&&srcA.style\n"
            "        &&srcKey==='text:'+srcA.style\n") in tie
    # and the chip's menu opens under the chip, not below the window
    css = assets.deck_css()
    assert ".aa-what{position:relative;" in css


def test_a_style_change_is_one_undo_step_with_its_boxes():
    """2026-10-08 review: every Look control in the Style system recorded
    the undo step (markDirty) BEFORE re-stamping the boxes, so redo -- or
    undoing a later edit -- brought back the type without its boxes."""
    js = assets.deck_js()
    assert "markDirty();dgRestamp(id)" not in js
    assert js.count("dgRestamp(id);markDirty();") == 6
