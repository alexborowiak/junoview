"""Applying a look over a scope can NAME it instead of baking it (T294).

The user, 2026-09-05: "you can apply that to all of this type ... in
whole presentation or just in section or slide range."

That scope machinery already existed -- the "Apply this look to..."
dialog has had per-slide checkboxes, per-section checkboxes with a
half-in state, All slides and a which-properties-travel column since
2026-08-22. What it did with them was the problem: applyToType WRITES
the properties onto every matching box, which detaches them from the
style they wore. The code said so itself, in the toast:

    "they no longer match the ... style, so Re-apply would put them
     back"

Naming the look as a variation instead leaves every box wearing a type,
so it still follows its parent for everything the variation does not
change. The warning becomes a live relationship.

Driven at 1440x900 on three slides of Heading 1 boxes, slide 3 taken out
of scope: the two in scope end up wearing `t1/Big navy/of=h1`, the
variation stores exactly {size:6.25} and nothing else, and slide 3's
heading is untouched at h1@5.
"""

from __future__ import annotations

from junoview import assets


def test_the_tie_is_offered_only_where_there_is_a_parent(out):
    """isStyleKey answers "does this box wear a text style" -- exactly
    what the old warning was gated on."""
    assert 'id="aa-tiewrap"' in assets.deck_html()
    assert "    function tieSync(){" in out
    assert ("      var ok=isStyleKey(srcKey)&&srcA&&srcA.style") in out
    assert "      w.hidden=!ok;" in out
    # ...and it names the parent, so the checkbox is not a riddle
    assert ("        lab.textContent='Keep them tied to '") in out


def test_it_names_and_wears_instead_of_writing_and_walking_away(out):
    assert "    function commitAsVariation(idxs,want,samp){" in out
    assert "      if(tieOn()){commitAsVariation(idxs,want,samp);return;}" in out
    assert "      var v=addVariant(nm,base);" in out
    assert "      hits.forEach(function(a){applyStyleTo(a,v.id);});" in out


def test_the_source_box_is_included(out):
    """applyToType excludes the box you copied FROM, because applying a
    look to itself is not a change. Wearing a variation is: leave it out
    and the box you built the variation from is the one box not wearing
    it."""
    hits = out.split("    function commitAsVariation(idxs,want,samp){")[1]
    hits = hits.split("      if(!hits.length){")[0]
    assert "if(a&&a.k==='text'&&typeKeyOf(a)===srcKey) hits.push(a);" in hits
    assert "a===src" not in hits


def test_only_the_properties_the_dialog_chose_travel(out):
    """`want` is the dialog's own "what travels" column. A variation
    that recorded everything would ignore it."""
    assert "      var o=variantDeltaFrom(srcA,base,want);" in out
    assert "    function take(k){return !want||want[k];}" in out


def test_the_delta_reader_is_shared(out):
    """Two doors build a variation -- the Text styles menu and this
    dialog -- and one of them must not be a second copy of the rule."""
    assert out.count("function variantDeltaFrom(") == 1
    assert "variantDeltaFrom(a5,base,null)" in out
    assert "variantDeltaFrom(srcA,base,want)" in out


def test_a_neutral_value_is_a_real_answer(out):
    """styleDef merges the delta over the parent and applyStyleTo reads
    `if(d.b)`, so b:0 clears the bold the parent set. A variation can say
    "not bold" as well as "navy"."""
    assert "      var mine=a[k]||0,theirs=p[k]||0;" in out
    assert "      if(mine!==theirs) o[k]=mine;" in out


def test_the_background_is_read_back_through_the_same_mapping(out):
    """applyStyleTo maps a style's `bg` onto a.bg/a.bgc. Read naively,
    a variation could never carry the one thing a colour variation most
    often is."""
    assert "      var mine=(a.bg===0)?'none':(a.bg?(a.bgc||''):'');" in out
