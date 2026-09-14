"""T445: the Animation panel, and movement with numbers on it.

The user, 2026-09-14: "the animation need to be able to be configured
with a side tab. Currently there are starting to be too many things.
Like the motion things are cool, but it would be cool to have more
configurations on these, like speed, and how far they wobble. Like
please don't just do this half arsed again ... this needs to be going
really far and I don't care if you take ages. Just please be building
things with heaps of features and customisation. Like I want this to
be able to have lots of automatic things to be able to make slides
come alive." And: "the quick animate should pop up as a side panel.
too much on the ribbon now and it is getting squashed out of screen."

- Thirteen movements, not three. Each has a speed, a distance, an
  easing, a delay, a repeat count and a direction: `a.mo`, each value
  absent when it is the movement's own, so a deck saved before this is
  byte-identical.
- The keyframes multiply their own travel by `--mo-amp`, so one rule
  per movement covers every amount of it; motionPaint writes the rest
  into the element's own `animation`, composing the entrance in front
  of it when the object has one.
- The Animation panel holds all of it: what is selected, how it
  arrives, when it starts, how much of a text box at a time, when it
  leaves, the movement and its six numbers, seven one-click treatments
  for the whole slide, and the list of clicks underneath.
- Quick animate is the panel's too. Arming it opens the panel.

Driven live: Jelly at 2.5x speed and 3x distance with a 2s delay and
five repeats wrote {sp:2.5,amp:3,dl:2,n:5,ease:'linear'} and played at
0.56s; in the show a Fade entrance and a Wobble composed as
"anIn-fade 0.45s, an-wobble 1.6s delayed 1.95s"; the selected item
stayed still; Quick animate ran entirely in the panel, its chooser
changing the effect mid-run; and Gentle life, Play by itself and Stop
all movement each rewrote the slide in one click.
"""

from __future__ import annotations


def test_thirteen_movements_with_numbers(out):
    assert "  var MOTIONS=[" in out
    for k in ("wobble", "bob", "pulse", "sway", "shake", "spin", "swing",
              "breathe", "jelly", "drift", "glow", "tilt", "flicker"):
        assert f"@keyframes an-{k}{{" in out, k
        assert f".an-move-{k}{{animation:an-{k} " in out, k
    # how far is a number the keyframe multiplies by
    assert ("@keyframes an-sway{0%,100%{translate:calc(-10px * "
            "var(--mo-amp,1)) 0}") in out
    # the defaults are never stored
    fn = out.split("  function moWrite(a,key,val){")[1].split("\n  }")[0]
    assert "    var def={sp:1,amp:1,ease:'',dl:0,n:0,dir:1}[key];" in fn
    assert "    if(val===def||val===''+def) delete mo[key];" in fn
    assert "    if(Object.keys(mo).length) a.mo=mo; else delete a.mo;" in fn


def test_the_element_carries_the_numbers(out):
    fn = out.split("  function motionPaint(el,a){")[1].split("\n  }")[0]
    assert "    el.style.setProperty('--mo-amp',String(o.amp));" in fn
    assert "      +(o.n>0?String(o.n):'infinite')+(o.dir<0?' reverse':'');" in fn
    assert "    el.style.animation=(inL?(inL+','):'')+layer;" in fn
    # the renderer calls it for every item that has one
    assert "          if(typeof motionPaint==='function') motionPaint(el,ma);" \
        in out


def test_the_panel_holds_the_whole_thing(out):
    assert '<div class="anim-cfg" id="animpane-cfg"></div>' in out
    assert "  function animCfgSync(){" in out
    for fn in ("cfgArrival", "cfgMotion", "cfgLife", "cfgSeq", "cfgRange"):
        assert f"  function {fn}(" in out, fn
    # the six numbers
    for lab in ("'Speed'", "'How far'", "'Easing'", "'Starts after'",
                "'Repeat'"):
        assert lab in out, lab
    assert "    cfgChip(dr,bic('rotl'),'The other way',o.dir<0," in out
    # it follows the selection, through the sync the pane already had
    assert ("      /* T445: the settings above the list follow the selection "
            "too */\n"
            "      if(typeof animCfgSync==='function') animCfgSync();") in out


def test_the_slide_treatments(out):
    assert "  var LIFE=[" in out
    for id_ in ("calm", "drift", "attention", "cascade", "fadein", "auto",
                "still"):
        assert f"['{id_}'," in out, id_
    fn = out.split("  function lifeApply(id){")[1].split("\n  }\n")[0]
    assert "      if(id==='auto'&&n>0) a.anim.after=1;" in fn
    assert "          moveIt(a,'bob',0.55,0.7);" in fn
    assert "        else moveIt(a,'breathe',0.3,0.6);" in fn


def test_quick_animate_is_the_panels(out):
    assert 'class="rbn-grp rbn-seq"' not in out
    assert "    if(on&&typeof animPaneOpen==='function') animPaneOpen();" in out
    assert "  var animPaneOpen=function(){};" in out
    assert "    animPaneOpen=function(){set(true);};" in out
