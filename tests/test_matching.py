"""Matching: one slide's layout given to many, and one object's look
pointed at another.

Match slide already existed and already answered "make this slide look like
that one" by BUCKETING items by kind and pairing them in reading order. That
is a good heuristic and it is kept exactly as it was. What it could not do
was go the other way (one model, many destinations) or be overruled when the
guess was wrong -- and 2026-08-22 the user asked for both:

  "Make sure you can match multiple slides to one slide at a time ... It
  would also be good to be able to match objects between slides. Like you
  can click on an object, and be like 'match object to this', then if you
  click on something else it matches it to it (maybe there can be a list of
  properties; size, position, shape, colour and you can select and unselect
  what you need) ... Would be good if there was the reverse as well."
"""

from __future__ import annotations

# ------------------------------------------------- the existing heuristic

def test_matching_pairs_items_by_role_then_reading_order(out):
    """This is the answer to "can it identify which ones are supposed to
    match" when a slide has two paragraphs.

    Items are bucketed by ROLE, then sorted down the page and across, and
    paired off in that order -- so the upper paragraph takes the upper
    paragraph's place and the lower one the lower.

    A box wearing a named style keeps it, so a Heading 2 never pairs with
    a caption. A box wearing nothing is ranked (see inferRoles below),
    which is what stopped a heading landing in a caption's slot on the
    many decks that have never used a style.
    """
    body = out.split("function matchSlide(fromIdx,toIdx){")[1].split("\n  }")[0]
    assert "var m={},keyOf=slideRoleKey(sl);" in body
    assert "var k=keyOf(p2.a,p2.i);" in body
    # reading order: down the page, then across, with a 4% tolerance band
    # so two things on the same line are ordered left to right
    assert "return Math.abs(dy)>4?dy:((p2.a.x||0)-(q2.a.x||0));" in body
    # more destinations than models: the last model is reused rather than
    # the extras being left alone
    assert "var m=from[Math.min(n,from.length-1)].a;" in body


def test_what_a_match_deliberately_does_not_carry(out):
    """Content never travels, and neither does what a thing IS -- only how
    it is laid out. `shape`, `crop` and `pts` are absent from MATCH_PROPS on
    purpose, so matching a slide cannot turn your ellipses into rectangles.
    """
    props = out.split("var MATCH_PROPS=[")[1].split("];")[0]
    for never in ("'shape'", "'crop'", "'pts'", "'text'", "'html'",
                  "'ref'", "'rows'"):
        assert never not in props


# ------------------------------------------- one slide's layout, to many

def test_one_slide_can_be_given_to_several(out):
    """The menu only ever PULLED, so making six slides agree meant doing it
    six times, standing on a different slide each time.

    The model is the slide you are ON -- the one you have just got looking
    right -- and the picker borrows the Apply dialog's shell and its
    section-grouped slide list rather than growing a second one.
    """
    assert 'id="ms-dlg"' in out and 'id="ms-scope"' in out
    assert "window.SemDeckMatchMany=open;" in out
    # it is the FIRST row of the Match menu, above the existing pull
    assert "Give this slide’s layout to…" in out
    assert "menuHead(m,'take the layout of…');" in out


def test_the_model_slide_cannot_also_be_a_destination(out):
    """Matching a slide to itself is a no-op that would still report a
    number, so it is not offered: its row is greyed and unticked."""
    assert "ck.disabled=(i2===cur);" in out
    assert "return !!s&&!msOff.has(s)&&s!==pres.slides[cur];" in out
    # excluded by slide OBJECT, not index -- the same reason the Apply
    # dialog's scope is: every reorder splices pres.slides
    assert "var msOff=new WeakMap();" in out


def test_matching_many_slides_is_one_undo_step(out):
    """matchSlide only mutates; the sweep commits once at the end."""
    body = out.split("$('#ms-ok').addEventListener('click',function(){")[1]
    body = body.split("$('#ms-cancel')")[0]
    assert body.count("markDirty();") == 1
    assert "list.forEach(function(i){" in body


# ------------------------------------------------------- object matching

def test_an_object_match_can_be_armed_in_both_directions(out):
    """Which end you have selected depends on which one you noticed first,
    so both directions exist:

    'to' -- the selection is the MODEL and stays armed, so one look can be
    pushed to a dozen objects. 'from' -- the selection is what CHANGES and
    the first click finishes it, because there is only one model to find.
    """
    assert "function armMatch(dir){" in out
    assert "'Copy this look to objects I click…'" in out
    assert "'Take the look of an object I click…'" in out
    assert "if(matchArm.dir==='from') cancelMatch();" in out
    # 'to' takes the primary selection only: three models and one target is
    # a question with no answer
    assert "if(dir==='to') idxs=[(typeof selAnnot==='number')?selAnnot:idxs[0]];" in out


def test_the_armed_canvas_is_a_picker_not_an_editor(out):
    """The next thing you press is the object you meant, so selecting or
    dragging it instead would be the wrong answer to a gesture you have
    already committed to.

    Handled at the top of the ONE handler that owns canvas mousedown, so
    there is no second code path deciding what a click means.
    """
    body = out.split("layer.addEventListener('mousedown',function(ev){")[1]
    # the window grew when T168's sequencing mode took the same door,
    # ahead of matching. What this guards is that BOTH modes are decided
    # at the top of the one handler, before any select/drag ladder runs.
    head = body[:1600]
    assert "if(typeof seqOn==='function'&&seqOn()){" in head
    assert "if(matchArm){" in head
    assert head.index("if(seqOn())") < head.index("if(tool==='select')")         if "if(seqOn())" in head else True
    assert head.index("if(matchArm){") < head.index("if(tool==='select')")
    assert "matchHit(+mt.getAttribute('data-idx'));" in head
    assert ".deck.matching .annot-layer{cursor:copy;}" in out


def test_layout_match_refuses_a_different_slide_without_disarming(out):
    """T46. The captured indexes belong to the slide that was armed,
    while rendered rectangles only exist for the slide on stage. A click
    elsewhere must mutate neither collection and must leave the mode ready
    to finish after the user goes back.
    """
    branch = out.split("if(matchArm.dir==='layout'){")[1]
    branch = branch.split("if(matchArm.dir==='to'){")[0]
    guard = "if(matchArm.slide!==cur){"
    assert guard in branch
    assert "back to slide '+(matchArm.slide+1)" in branch
    # Refuse before reading current-slide geometry or applying captured
    # indexes, and do not cancel from the guard.
    assert branch.index(guard) < branch.index("var layer2=")
    guarded = branch[branch.index(guard):branch.index("var layer2=")]
    assert "return;" in guarded
    assert "cancelMatch" not in guarded


def test_the_bar_says_which_object_on_which_slide(out):
    """The user asked for this "in the ribbon" -- but the ribbon may never
    grow a row and never hide a word, and this line has to name an object
    AND a slide. A bar is the idiom the editor already uses for a mode you
    are standing in (.pickbar, for choosing a notebook card).
    """
    assert 'id="matchbar"' in out and 'id="match-what"' in out
    assert 'id="match-cancel"' in out
    assert "on slide '+(matchArm.slide+1)" in out
    # a sibling of .deck, which is fixed at z-index 100
    assert ".matchbar{position:fixed;top:0;left:0;right:0;z-index:150;}" in out


def test_escape_cancels_an_armed_match_before_anything_else(out):
    """It is the outermost mode you can be standing in -- you cannot be
    trimming or inside a group while the canvas is a picker -- so it
    swallows the key first."""
    esc = out.split("if(e.key==='Escape'){\n      var vf=$('#vfull');")[1][:400]
    assert "if(matchArm){e.preventDefault();cancelMatch();return;}" in esc


def test_the_property_picker_is_the_same_vocabulary_as_apply(out):
    """"size, position, shape, colour" is exactly what APPLY_PROPS already
    groups, so the bar reads that list rather than a second one that could
    disagree with it.

    Its own tick state, though: what you want carried between two objects
    you are pointing at is not the same question as what you want pushed
    across a whole deck.
    """
    assert "var matchPick=applyPickAll();" in out
    assert 'id="match-props-menu"' in out
    # narrowed to what the RECEIVING kind can carry -- pushing a text size
    # onto a shape is a control that does nothing
    assert "applyFieldsFor(matchPick,hit.k)" in out
    assert "applyFieldsFor(matchPick,to.k)" in out


def test_the_object_copy_follows_the_same_rule_as_every_other(out):
    """undefined on the model means DELETE on the target, and object-valued
    properties are deep-copied -- the rule MATCH_PROPS has always had."""
    body = out.split("function matchCopy(from,to,want){")[1].split("\n  }")[0]
    assert "if(from[p]===undefined) delete to[p];" in body
    assert "deep(from[p])" in body
    assert "if(!from||!to||from===to) return false;" in body


def test_object_matching_costs_the_ribbon_nothing(out):
    """Both verbs are rows in the EXISTING Arrange menu, which is shown for
    every kind of item and already carries the make-things-match rows."""
    assert "['x:to','Copy this look to objects I click…']," in out
    assert "if(what.indexOf('x:')===0){armMatch(what.slice(2));return;}" in out


# ---------------------------------------------------------------------------
# the three doors (T129)
# ---------------------------------------------------------------------------
#
# Driven live 2026-08-31 over a two-object deck: right-clicking a
# selected rectangle showed the two match verbs and armed 'to' (the
# #matchbar appeared); "Apply this look to..." opened the dialog reading
# "Apply to 1 shape"; and after making a component, right-clicking EMPTY
# canvas offered Place "TestCmp", which placed a third object.


def test_match_objects_is_on_the_menu_that_knows_what_you_clicked(out):
    """Every other T89 feature got a canvas-menu row; the one actually
    NAMED "match objects" never did -- its doors were thirty rows down
    the Arrange dropdown and a button inside the Layers pane. Same three
    verbs as matchMenuAt, armed directly: armMatch validates the
    selection itself and says what it needs."""
    assert "menuHead(m,'match');" in out
    assert "function(){armMatch('to');}," in out
    assert "function(){armMatch('from');}," in out
    # layout needs two, so its row appears exactly then
    assert "if(n>=2)" in out
    assert "function(){armMatch('layout');}," in out


def test_the_apply_dialog_opens_for_things_that_are_not_text(out):
    """Its own code has handled shapes, frames, arrows and tables since
    it was written -- but its only door was the TEXT Styles menu, so a
    selected rectangle could not reach a dialog built for it. Text keeps
    its existing door; the menu row appears for the rest."""
    assert "if(apA&&apA.k!=='text')" in out
    assert r"row('Apply this look to\u2026','',function(){" in out


def test_placing_a_component_needs_no_selection(out):
    """The definitions are deck-wide and the click point is the menu's
    own -- but the Place rows sat inside the selection branch, so an
    EMPTY canvas had no component door at all."""
    idx = out.index("var cAll=cmpList();")
    # the rows now sit AFTER the selection branch's lock section and
    # before the who-sees-it block, at menu top level
    assert out.index("menuHead(m,'components');") > idx
    assert out.index("var cAll=cmpList();") < \
        out.index("/* WHO SEES THIS. Beside `lock`")
    # and the lock section (end of the selection branch) comes first
    assert out.index("'Lock fully',") < idx
