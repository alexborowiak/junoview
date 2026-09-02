"""The animation surface after the 2026-09-02 review (T179-T181).

The user, on the new build: "it is still quite a few clicks to add an
appear animation to something... I would like in the 'Object' list there
is an animation tab, which has all the animation options... I hate that
there is the thing that pops up in the animation tab... the whole 'Click
things in order' options should just appear after a divider on the
ribbon... what is reading order and why does it look so confusing."

These pin the shape. What it does was driven in a browser (TASKS.md).
"""

from __future__ import annotations


def test_one_click_gives_the_selected_object_an_entrance(out):
    """T179. Five effect buttons on the Object tab -- the tab the
    selection sends you to -- showing which one is on, through the same
    setter the pane and the gallery use. The old effect buttons were on
    the one tab a selection moved you OFF (T171); these are on the one
    it moves you TO.
    """
    assert 'class="rbn-grp rbn-fx" data-tab="object"' in out
    for cid in ("none", "appear", "fade", "rise", "zoom"):
        assert f'id="fmt-fx-{cid}"' in out, cid
    assert "var OBJ_FX=[['fmt-fx-none','none'],['fmt-fx-appear','appear']," in out
    assert "e.stopPropagation();setType(p[1]);});" in out
    # animRibbonSync owns their visibility and pressed state, and a
    # poster -- which has no build -- never shows them
    assert "var on=!!a&&typeof selAnnot==='number'&&!pageOf().poster;" in out
    # governed, so the completeness audit stays quiet
    assert "#fmt-fx-none #fmt-fx-appear #fmt-fx-fade #fmt-fx-rise #fmt-fx-zoom" in out
    # the unlabeled Object groups are still the five they were
    assert out.count('class="rbn-grp" data-tab="object"') == 5


def test_setting_the_order_happens_in_the_ribbon(out):
    """T180. The pointing mode's controls were a bar fixed across the
    top of the window, over the very ribbon it stood in for. They are a
    group of the Animation tab now: three cells hidden until Set order
    arms the mode, shown by seqSync, and the ribbon re-fits. The CELLS
    carry the hidden bit because syncRibbonGroups reads a group's
    visibility off its controls.
    """
    assert 'id="seqbar"' not in out
    assert 'class="rbn-grp rbn-seq" id="seqgrp" data-tab="animation"' in out
    for cid in ("seq-what", "seq-fx", "seq-btns"):
        assert f'id="{cid}" hidden' in out, cid
    assert "['seq-what','seq-fx','seq-btns'].forEach(function(id){" in out
    assert "if(typeof syncRibbonGroups==='function') syncRibbonGroups();" in out
    # arming lands you on the tab the controls are on
    assert "if(typeof setTab==='function') setTab('animation');" in out
    # the same three verbs, the same keys on the same chooser
    for cid in ("seq-undo", "seq-done", "seq-cancel"):
        assert f'id="{cid}"' in out, cid
    assert "b.className='dbtn rbn-sm seq-fxb'+(seqType===f[0]?' on':'');" in out
    # a plain name for the door -- a verb, not a sentence
    assert "Set order</button>" in out
    assert "Click things in order" not in out


def test_the_order_you_point_is_the_order_of_the_slide(out):
    """T181. Builds and the reading order were two orders set in two
    places; the second had a panel nobody could read. Finish now writes
    the clicked sequence as `rord` too, so figure numbers, One by one
    and the outline follow the same order -- and with None it writes
    ONLY the order, which is how you number things without animating
    them. The panel keeps its arrows for a nudge and says what it is.
    """
    assert "var hitList=seqArm.hits.slice();" in out
    assert "if(ro.length) s.rord=ro;" in out
    # the ribbon door for the panel is gone; the pane and the
    # right-click keep theirs, under a name that says what it is
    assert 'id="anim-order"' not in out
    assert "menuHead(p,'order on this slide');" in out
    assert "Set order on the Animation tab writes " in out
    assert "?'Set by you \\u2014 anything added later comes last'" in out


def test_the_timeline_has_a_door_on_the_animation_tab(out):
    """The Layers pane is the timeline (T174) and had no door where
    animation lives. Two doors, one pane: this one drives Home's.
    """
    assert 'id="anim-layers"' in out
    assert "var ob=$('#objects-btn'); if(ob) ob.click();});" in out
