"""T391: the animation story (2026-09-13, user: "something like the
'animation story', that showed you what the slide looks like during each
animation and you can click through -- if something disappears it is not
there at that point, so then if there are layers of things they are much
easier to see where they are and move around").

Driven in Chromium on a slide with two staggered builds and one exit: the
strip showed Start, Click 1 (the title arrives), Click 2 (the note
arrives) and Click 3 (the title leaves); on Click 1 the note was off the
stage, on Click 3 the title was, and the remaining box stayed editable.
"""

from __future__ import annotations

from junoview import assets


def test_the_story_is_one_fragment_with_a_door_on_the_animation_tab(out):
    assert "56-story" in assets.DECK_PARTS
    assert "  storyBoot();" in out
    part = assets.load("js/deck/56-story.js")
    assert "})();" not in part
    assert 'id="anim-story"' in out and 'id="story-strip"' in out
    assert "  var storyAt=null,storySlide=-1,storyPaint=false," in out


def test_each_stop_is_painted_by_the_show_itself(out):
    # mode view, revealCount k, on an off-screen page; the show's own state
    # (flip turns, selection) is saved round it
    assert "    mode='view';revealCount=k;selAnnot=null;selSet=[];" in out
    assert "    flipSeen={};flipTurn={};storyPaint=true;" in out
    assert "    try{attachAnnots(slideEl,s);}" in out
    # a thumbnail is a still: no keyframes, no typewriter
    assert ("        .replace(/\\ban-anim-[a-z]+\\b/g,'')"
            ".replace(/\\ban-move-[a-z]+\\b/g,'')") in out
    assert ("               &&!(typeof storyPaint!=='undefined'&&storyPaint)) "
            "typeInto(el);") in out
    assert "    slideEl.style.zoom=(STORY_THUMB_W/W).toFixed(4);" in out


def test_editing_at_a_stop_removes_what_is_not_there(out):
    # display:none, not opacity: nothing invisible can be picked up
    assert (".an-item.an-storyout,.an-arrow-line.an-storyout"
            "{display:none!important;}") in out
    # gone already
    assert "            if(storyK>so) el.classList.add('an-storyout');" in out
    # not arrived yet, and the pieces of a box arriving in pieces
    assert "            if(spk>=storyK) el.classList.add('an-storyout');" in out
    assert "                pe.style.visibility=(jp>=storyK)?'hidden':'';" in out
    # a flip book is on the page of that stop
    assert "        return Math.max(0,Math.min(last,storyAt-sb));" in out
    # the caption says who arrives and who leaves
    assert "  function storyWhat(s,k){" in out
    assert "    return out||'nothing changes';" in out
    # Whole slide puts the editor back; closing the strip clears the stop
    assert ("    whole.addEventListener('click',function(e)"
            "{e.stopPropagation();setStoryAt(null);});") in out
    assert "      storyAt=null;deckEl.classList.remove('storying');" in out
