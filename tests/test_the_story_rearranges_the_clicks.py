"""T580: the Story shows the whole slide without closing, reorders the
clicks by dragging, and takes less of the screen.

The user, 2026-09-30: "the animation story is really cool as well, would
be cool if you could drag and re-arrange the slides here as well and
than changes the order of things ... also, the only way to view the
original slide at the moment is to close the story". And, of their
screenshot with the ribbon's shelf, the Story and the Animation panel all
open: "This gets congested very easily."

"Whole slide" was a word in the strip's head that did not look pressable,
and Close sat at the far right -- under the Animation panel, which is
docked over the right of the stage. The head is a column at the left now
(it costs no height and cannot be covered), Whole slide is the first
card, the lit card pressed again is the way back, and so is Esc.

Driven: dragging "Click 4 · Image" onto the middle of "Click 1" put the
photo on the first bullet's click (five clicks became four); onto the
right edge of Click 2 put it between two bullets; Ctrl+Z put it back.
"""

from __future__ import annotations

from junoview import assets


def test_the_whole_slide_is_the_first_card(out):
    assert ("    var wc=card('whole','Whole slide','everything, to edit as usual',"
            in out)
    assert "    wc.className='story-stop story-whole'+(storyAt==null?' on':'');" \
        in out
    # painted with everything on it: every build arrived, nothing gone
    assert ("      box.replaceWith(st==='whole'?storyThumb(s,n,true)"
            ":storyThumb(s,+st));") in out
    assert "    if(whole) printAll=1;" in out
    assert "      printAll=savedAll;" in out


def test_the_lit_card_pressed_again_goes_back(out):
    assert "          e.stopPropagation();setStoryAt(storyAt===k?null:k);});" in out


def test_escape_at_a_stop_goes_back_before_it_leaves_the_editor(out):
    ladder = out.split("      else if(spotEl){closeSpot();}")[1] \
        .split("      else closeDeck();")[0]
    at = ladder.index("        setStoryAt(null);")
    assert at < ladder.index("      else if(mode==='edit'){setUIMode('create');}")
    # ...and after dropping a selection, which is the first Esc
    assert ladder.index("        setTool('select');") < at


def test_a_card_drags_to_another_place_or_onto_another(out):
    assert "    var plan0=flipPlan(s),steps0=slideBuildSteps(s),stopB={};" in out
    assert "        var b=(k>0)?stopB[k-1]:null;" in out
    assert "        if(b==null) return;" in out
    assert "        c.draggable=true;" in out
    assert "      return f<.3?'before':(f>.7?'after':'with');" in out
    assert "    timelineWrite(s,tlMoveClick(timelineOf(s),from,to,how));" in out


def test_the_head_is_a_column_that_nothing_covers():
    css = assets.deck_css()
    assert ".story-head{flex:none;width:92px;display:flex;flex-direction:column;" \
        in css
    assert ".story-row{flex:1;min-width:0;display:flex;gap:8px;overflow-x:auto;" \
        in css
    assert ".story-stop.drop-with{box-shadow:inset 0 0 0 2px var(--cyan);}" in css
    js = assets.deck_js()
    assert "  var STORY_THUMB_W=128;" in js
