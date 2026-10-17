"""T625: one animation rule for many slides.

The user, 2026-10-11: "animation rule that can be applied to all slides and
or slide selection". Animating a talk meant doing every slide by hand,
although the answer is nearly always the same on every slide: the title is
there, the bullets come in one at a time, then the figure.

A RULE says that once, per KIND of thing on a slide (title, text, figures,
pictures, shapes, tables, code): its entrance or none, when it starts, how
long it takes, and for text whether it comes a bullet at a time -- plus the
order the kinds come in, or top to bottom as placed. 48c-anim-rule.js
applies it to this slide, some slides or all of them, by default only to
things with no animation yet, and keeps it on the deck for New slide.

These are the fast checks. The engine itself -- the kinds, the order, the
list of clicks it writes, Replace against Keep theirs, a new slide -- runs
here as it ships: its functions and the deck's own list of clicks
(timelineOf / timelineWrite, T577) are lifted out of the assembled deck and
run in node over slides written as data. The dialog, the door, the show,
undo and a reload are driven in Chromium by
tests/test_animation_rule_in_a_browser.py.
"""
from __future__ import annotations

import json
import re
import subprocess
import tempfile
from pathlib import Path

import pytest

from helpers_js import js_engine, lift_fn, lift_var
from junoview import assets
from junoview.notebook.deck_schema import ANNOT_COMMON, DECK_KEYS
from junoview.notebook.presentations import as_presentations

needs_js = pytest.mark.skipif(js_engine() is None, reason="no JS engine")

PART = (Path(assets.__file__).parent / "js" / "deck"
        / "48c-anim-rule.js").read_text(encoding="utf-8")

# the engine, and the deck's own list of clicks it writes through
_FNS = ("arKindOf", "arNorm", "arParseRange", "arRangeText", "arUnits",
        "arPlan", "arPart", "arObjs", "arPieces", "arSkip", "arSlide",
        "arCount", "animRuleNewSlide", "animRuleFresh", "animRuleForNew",
        "animRuleDecks", "animRuleOfDeck", "arFromSlide", "arWorkCopy",
        "arSame", "arLand",
        "slideBuildSteps", "emptySlot", "pieceClaimsN", "pieceClaims",
        "timelineOf", "tlFix", "timelineWrite", "animOut", "animFocus",
        "orderedIdx")
_VARS = ("FOCUS_FX",)
# what the lifted functions reach for that lives elsewhere in the editor:
# a bullet is a line of the box, a heading is one of the four built-ins,
# nothing is a part of another presentation, and the editor is editing
_STUBS = r"""
var mode='edit',talkNoBuilds=false,pres={slides:[]},arMemo={};
var projectPres=[],nbPres=[];
function deep(o){return JSON.parse(JSON.stringify(o));}
function headingStyles(){return ['title','h1','h2','h3'];}
function partOfSlide(s){return (s&&s.lk)?s.lk:'';}
function pageOf(){return {poster:!!pres.poster};}
function textBy(a){return (a&&a.anim&&(a.anim.by==='para'||a.anim.by==='sent'))
  ?a.anim.by:'';}
function textPieceCount(a){return String(a.text||'').split('\n').length;}
function pieceCount(a){return textBy(a)?textPieceCount(a):1;}
function resolveRef(r){return /note/.test(String(r))?{kind:'note'}:null;}
function partOf(a){return /code/.test(String(a.ref))?'code':'figure';}
"""


def _run(expr: str):
    """Evaluate `expr` beside the rule engine, lifted from the deck as it
    ships."""
    cmd, env = js_engine()
    src = assets.deck_js()
    script = (_STUBS
              + "\n".join(lift_var(src, v) for v in _VARS) + "\n"
              + "\n".join(lift_fn(src, f) for f in _FNS) + "\n"
              + "console.log(JSON.stringify(" + expr + "));\n")
    with tempfile.TemporaryDirectory() as d:
        p = Path(d) / "run.js"
        p.write_text(script, encoding="utf-8")
        r = subprocess.run(cmd + [str(p)], capture_output=True, text=True,
                           env=env, timeout=60)
        assert r.returncode == 0, r.stderr[:2000]
        return json.loads(r.stdout.strip().splitlines()[-1])


def T(text, **kw):
    a = {"k": "text", "x": 8, "y": 22, "w": 50, "text": text, "size": 3}
    a.update(kw)
    return a


TITLE = T("Results", x=5, y=4, w=90, style="h1")
BULLETS = T("one\ntwo\nthree", y=20)
FIG = {"k": "cell", "ref": "nb::clim", "x": 60, "y": 22, "w": 35, "h": 50}
PIC = {"k": "image", "x": 60, "y": 60, "w": 20, "h": 20, "src": "data:x"}
RECT = {"k": "rect", "x": 10, "y": 80, "w": 10, "h": 5}
TABLE = {"k": "table", "x": 8, "y": 50, "w": 40, "h": 20,
         "rows": [["a"], ["b"]]}
CODE = T("def f():\n  pass", font="mono", y=70)


def _apply(slide, rule=None, how="new"):
    """the slide after the rule, as {entrance per object, clicks}"""
    return _run(
        "(()=>{var s=" + json.dumps(slide) + ";var n=arSlide(s,arNorm("
        + json.dumps(rule or {}) + ")," + json.dumps(how) + ",{});"
        "return {n:n,anim:s.annots.map(function(a){return a.anim?"
        "[a.anim.type,a.anim.order,a.anim.by||'',a.anim.after||0,"
        "a.anim.dur||0,a.anim.parts||null]:null;}),"
        "out:s.annots.map(function(a){return a.out==null?null:a.out;}),"
        "clicks:timelineOf(s).map(function(c){return c.map(function(cl){"
        "return cl.i+cl.k+(cl.j!=null?cl.j:'');}).join(' ');})};})()")


# ---- the kinds --------------------------------------------------------


@needs_js
def test_every_thing_on_a_slide_has_a_kind():
    """Seven kinds, read off what the object is: the slide's best heading
    is its title, a mono box and a notebook cell's code are code, a
    markdown cell's words are text (what Create slides puts under a
    heading), a box a diagram's arrows are tied to is part of the diagram,
    and anything drawn is a shape."""
    got = _run("""[
      arKindOf({k:'text',style:'h1'},'h1',false,''),
      arKindOf({k:'text',style:'h2'},'h1',false,''),
      arKindOf({k:'text',font:'mono',style:'h1'},'h1',false,''),
      arKindOf({k:'text'},null,true,''),
      arKindOf({k:'cell'},null,false,'figure'),
      arKindOf({k:'cell'},null,false,'output'),
      arKindOf({k:'cell'},null,false,'code'),
      arKindOf({k:'cell'},null,false,'note'),
      arKindOf({k:'flip'},null,false,''),
      arKindOf({k:'chart'},null,false,''),
      arKindOf({k:'image'},null,false,''),
      arKindOf({k:'video'},null,false,''),
      arKindOf({k:'web'},null,false,''),
      arKindOf({k:'table'},null,false,''),
      arKindOf({k:'rect'},null,false,''),
      arKindOf({k:'arrow'},null,false,''),
      arKindOf({k:'draw'},null,false,'')]""")
    assert got == ["title", "text", "code", "shape", "figure", "figure",
                   "code", "text", "figure", "figure", "image", "image",
                   "image", "table", "shape", "shape", "shape"]


@needs_js
def test_the_title_is_the_slides_best_heading():
    """No style called Title is needed: the highest heading a slide
    actually uses is its title (Create slides writes Heading 1), and a
    second heading lower down is text."""
    got = _run("arObjs(" + json.dumps({"annots": [
        T("sub", style="h2", y=30), T("top", style="h1", y=4),
        T("words", y=50), {"k": "cell", "ref": "nb::note-3", "y": 60},
        {"k": "cell", "ref": "nb::code-1", "part": "code", "y": 70}]})
        + ",{}).map(function(o){return o.i+':'+o.k;})")
    assert got == ["1:title", "0:text", "2:text", "3:text", "4:code"]


@needs_js
def test_a_stored_rule_is_made_safe_and_has_the_defaults():
    """Anything unknown takes the default; the order always names every
    kind once; the default is the talk shape -- the title there from the
    start, text a bullet at a time, everything else fading in on its own
    click, shapes last."""
    d = _run("arNorm(null)")
    assert d["ord"] == ["title", "text", "figure", "image", "table",
                        "code", "shape"]
    assert d["by"] == "kind"
    assert d["k"]["title"]["fx"] == "none"
    assert d["k"]["text"] == {"fx": "fade", "st": "click", "by": "para"}
    assert d["k"]["figure"] == {"fx": "fade", "st": "click"}
    assert d["k"]["shape"] == {"fx": "fade", "st": "click"}
    r = _run("""arNorm({k:{text:{fx:'bogus',st:'after',w:99,dur:50,
      by:''},figure:{fx:'zoom',dur:-1}},ord:['code','code','x','figure'],
      by:'place',tr:'fade',nw:1})""")
    assert r["k"]["text"] == {"fx": "fade", "st": "after", "w": 60,
                              "dur": 10, "by": ""}
    assert r["k"]["figure"] == {"fx": "zoom", "st": "click"}
    assert r["ord"][:2] == ["code", "figure"] and len(r["ord"]) == 7
    assert r["by"] == "place" and r["tr"] == "fade" and r["nw"] == 1


# ---- the order ---------------------------------------------------------


@needs_js
def test_the_talk_shape_title_then_bullets_then_the_figure():
    got = _apply({"annots": [TITLE, FIG, BULLETS]})
    # the title is there from the start; three bullets, then the figure
    assert got["anim"][0] is None
    assert got["anim"][2][:3] == ["fade", 0, "para"]
    assert got["anim"][1][:2] == ["fade", 3]
    assert got["clicks"] == ["2p0", "2p1", "2p2", "1in"]
    assert got["n"] == 2


@needs_js
def test_kinds_come_in_the_order_the_rule_lists_them():
    rule = {"ord": ["figure", "text"], "k": {"text": {"by": ""}}}
    got = _apply({"annots": [TITLE, BULLETS, FIG, PIC]}, rule)
    assert got["clicks"] == ["2in", "1in", "3in"]


@needs_js
def test_top_to_bottom_as_placed_ignores_the_order_of_kinds():
    rule = {"by": "place", "k": {"text": {"by": ""},
                                 "title": {"fx": "appear"}}}
    slide = {"annots": [PIC, TITLE, BULLETS, dict(FIG, y=40)]}
    got = _apply(slide, rule)
    # reading order: the title (y 4), the bullets (y 20), the figure
    # (y 40), the picture (y 60)
    assert got["clicks"] == ["1in", "2in", "3in", "0in"]


@needs_js
def test_with_previous_and_after_previous():
    rule = {"k": {"text": {"by": ""},
                  "figure": {"st": "with"},
                  "image": {"st": "after", "w": 2, "dur": 1.5}}}
    got = _apply({"annots": [TITLE, BULLETS, FIG, PIC]}, rule)
    # the figure joins the words' click; the picture runs itself 2 s
    # later, taking a second and a half to arrive
    assert got["clicks"] == ["1in 2in", "3in"]
    assert got["anim"][3][3:5] == [2, 1.5]


@needs_js
def test_a_group_arrives_as_one():
    """A diagram's boxes and arrows -- anything grouped -- are one unit on
    one click, filed under its most telling member."""
    box = T("A", grp="g1", y=40)
    arr = {"k": "arrow", "x1": 1, "y1": 50, "x2": 9, "y2": 50, "grp": "g1",
           "c1": {"i": 1}, "c2": {"i": 3}}
    box2 = T("B", grp="g1", y=40, x=30)
    got = _apply({"annots": [TITLE, box, arr, box2, PIC]})
    assert got["clicks"] == ["4in", "1in 2in 3in"]


# ---- the scopes -----------------------------------------------------------


@needs_js
def test_some_slides_are_a_range_you_can_type():
    got = _run("""[arParseRange('2-4, 7',10),arParseRange('9-',10),
      arParseRange('5 3 3,1',10),arParseRange('0, 12, 4–2',10),
      arParseRange('',10),arRangeText([1,2,3,6]),arRangeText([0,9]),
      arRangeText([4])]""")
    assert got == [[1, 2, 3, 6], [8, 9], [0, 2, 4], [1, 2, 3], [],
                   "2-4, 7", "1, 10", "5"]


def test_the_scopes_are_this_slide_some_and_all(out):
    assert '<option value="cur">This slide</option>' in out
    assert '<option value="some">Some slides</option>' in out
    assert '<option value="all" id="anr-scope-all">All slides</option>' in out
    assert "if(v==='all'){var all=[];for(var i=0;i<n;i++) all.push(i);" in out
    assert "if(v==='some') return arParseRange(($('#anr-range')||{}).value,n);" \
        in out
    # the slide sorter's picked slides are the "some" of the rule
    assert "['anim','stagger','Animate\\u2026','Give the picked slides an '" \
        in out
    assert "if(typeof animRuleOpen==='function') animRuleOpen(idxs);" in out


# ---- Keep theirs and Replace -------------------------------------------


@needs_js
def test_keep_theirs_leaves_a_slide_built_by_hand_as_it_was():
    """The default: only things with no animation are animated, after
    the clicks the slide already has."""
    slide = {"annots": [TITLE, dict(BULLETS, anim={"type": "zoom",
                                                   "order": 0}), FIG]}
    got = _apply(slide)
    assert got["anim"][1] == ["zoom", 0, "", 0, 0, None]
    assert got["anim"][2][:2] == ["fade", 1]
    assert got["clicks"] == ["1in", "2in"]
    # and a slide that is all animated is not touched at all
    again = _apply({"annots": [TITLE, dict(BULLETS, anim={
        "type": "zoom", "order": 0})]})
    assert again["n"] == 0 and again["clicks"] == ["1in"]


@needs_js
def test_replace_writes_the_rule_and_keeps_exits_with_their_arrival():
    """Replace drops the entrances it covers and writes the rule's; an
    exit that went when something arrived goes when that thing now
    arrives; a movement or an exit is never an entrance to replace."""
    pic = dict(PIC, anim={"type": "zoom", "order": 0})
    fig = dict(FIG, anim={"type": "appear", "order": 1}, motion="bob")
    old = dict(T("old", y=30), out=1)       # goes as the figure arrives
    slide = {"annots": [TITLE, pic, fig, old]}
    got = _apply(slide, {}, "replace")
    # text (the old words) first, then the figure, then the picture
    assert got["clicks"] == ["3in", "2in 3out", "1in"]
    assert got["anim"][1][0] == "fade" and got["anim"][2][0] == "fade"
    assert got["out"][3] == 1
    # Keep theirs: the words already leave, which is an animation too
    keep = _apply(slide)
    assert keep["n"] == 0 and keep["clicks"] == ["1in", "2in 3out"]


@needs_js
def test_replace_with_none_takes_the_entrances_off():
    none = {k: {"fx": "none"} for k in
            ("title", "text", "figure", "image", "shape", "table", "code")}
    slide = {"annots": [TITLE, dict(FIG, anim={"type": "zoom", "order": 0}),
                        dict(PIC, out=0)]}
    got = _apply(slide, {"k": none}, "replace")
    assert got["anim"] == [None, None, None]
    # the exit had shared the figure's click; it keeps a click of its own
    assert got["clicks"] == ["2out"]


@needs_js
def test_a_bullet_keeps_its_own_click_afterwards():
    """T577: the rule's bullets are ordinary pieces -- a picture put on
    the second bullet's click is a `parts` list like any made by hand."""
    got = _run("(()=>{var s=" + json.dumps({"annots": [TITLE, BULLETS, PIC]})
               + ";arSlide(s,arNorm({}),'new',{});var tl=timelineOf(s);"
               "var x=tl[3][0];tl[3]=[];tl[1].push(x);"
               "timelineWrite(s,tl.filter(function(c){return c.length;}));"
               "return [s.annots[1].anim.parts||null,s.annots[2].anim.order,"
               "timelineOf(s).map(function(c){return c.map(function(cl){"
               "return cl.i+cl.k+(cl.j!=null?cl.j:'');}).join(' ');})];})()")
    assert got == [[0, 1, 2], 1, ["1p0", "1p1 2in", "1p2"]]


# ---- a new slide ------------------------------------------------------------


@needs_js
def test_a_new_slide_gets_the_rule_the_deck_keeps():
    slide = {"annots": [T("Click to add title", style="title", ph=1, y=4),
                        {"k": "cell", "ref": None, "y": 20, "x": 5},
                        T("Click to add text", ph=1, y=20, x=55)]}
    got = _run("(()=>{var a=" + json.dumps(slide) + ",b=deep(a),c=deep(a);"
               "pres={animRule:{nw:1,tr:'fade'}};var n=animRuleNewSlide(a);"
               "pres={animRule:{}};var m=animRuleNewSlide(b);"
               "pres={animRule:{nw:1},poster:1};var p=animRuleNewSlide(c);"
               "return [n,a.trans||null,a.annots.map(function(x){"
               "return x.anim?x.anim.type+'@'+x.anim.order:null;}),m,p];})()")
    assert got == [2, "fade", [None, "fade@1", "fade@0"], 0, 0]


@needs_js
def test_create_slides_with_animations_takes_the_rule_it_names():
    """Create slides' plain animation is a fade a click per object. It is
    pressed in the reader, where no deck is open, so it never takes the
    rule of whichever deck the editor had last (2026-10-12 review): its
    dialog names a deck that keeps a rule for new slides, and that rule
    -- only that one -- says how. The new presentation is not handed the
    rule to keep."""
    plan = {"slides": [{"annots": [
        T("Dataset", style="h1", y=4, anim={"type": "fade", "order": 0}),
        dict(FIG, anim={"type": "fade", "order": 2}),
        {"k": "cell", "ref": "nb::note-1", "autoNote": 1, "x": 5, "y": 20,
         "anim": {"type": "fade", "order": 1}}]}]}
    got = _run("(()=>{var pr=" + json.dumps(plan) + ";"
               "pres={name:'last',animRule:{nw:1,k:{figure:{fx:'rise'}}}};"
               "projectPres=[{name:'Talk',animRule:{nw:1,k:{figure:"
               "{fx:'zoom'}}}},{name:'Plain',animRule:{k:{}}},{name:'last',"
               "animRule:{nw:1}}];"
               "var names=animRuleDecks().map(function(d){return d.name;});"
               "var n=animRuleForNew(pr,animRuleOfDeck('Talk'));"
               "var a=deep(" + json.dumps(plan) + ");"
               "var m=animRuleForNew(a,animRuleOfDeck('Plain'));"
               "return [names,n,pr.slides[0].annots.map(function(x){return x.anim?"
               "x.anim.type+'@'+x.anim.order:null;}),!!pr.animRule,m,"
               "a.slides[0].annots.map(function(x){return x.anim?"
               "x.anim.type+'@'+x.anim.order:null;})];})()")
    # the deck in the editor first (as it is now), then the saved ones;
    # one that keeps no rule for new slides is not offered
    assert got[0] == ["last", "Talk"]
    # the title is there from the start, the note (text) then the figure
    assert got[1:5] == [2, [None, "zoom@1", "fade@0"], False, 0]
    # a deck nobody named lends nothing: the plain fades stay
    assert got[5] == ["fade@0", "fade@2", "fade@1"]


@needs_js
def test_an_empty_slot_claims_no_click_in_the_show():
    """A new slide's empty slots have their entrances from the start, so
    they arrive the moment they are filled; until then the show does not
    stop on nothing."""
    got = _run("""(()=>{var s={annots:[{k:'text',ph:1,text:'Click',
      anim:{type:'fade',order:0}},{k:'cell',ref:null,anim:{type:'fade',
      order:1}},{k:'text',text:'real',anim:{type:'fade',order:2}}]};
      var e=slideBuildSteps(s).count;mode='view';
      var v=slideBuildSteps(s).count;mode='edit';return [e,v];})()""")
    assert got == [3, 1]


def test_new_slide_create_slides_and_duplicate(out):
    """New slide gives the deck's rule to the slide it makes, before its
    markDirty (one undo step); Create slides makes a NEW presentation --
    with its own "Add animations" ticked, the open deck's rule for new
    slides says how, and the new presentation keeps it; a duplicate
    keeps its own."""
    i = out.index("pres.slides.splice(at,0,ns);")
    j = out.index("normSections();markDirty();refresh();", i)
    assert "if(typeof animRuleNewSlide==='function') animRuleNewSlide(ns);" \
        in out[i:j]
    k = out.index("function autoDeckImport(plan){")
    body = out[k:out.index("function autoDeckBoot(){", k)]
    assert "var ruleFrom=(plan&&plan.animations&&plan.animRuleFrom)||'';" \
        in body
    assert body.index("animRuleForNew(pr,animRuleOfDeck(ruleFrom))") \
        < body.index("importDeckText(JSON.stringify({presentations:[pr]})")
    assert "pr.animRule" not in out
    dup = out[out.index("function slideCopyAt("):]
    dup = dup[:dup.index("\n  }\n")]
    assert "animRule" not in dup


# ---- the deck keeps it, and so does everything that reads a deck -------------


def test_the_rule_is_kept_by_save_undo_and_python(out):
    assert ("    if(p.animRule&&typeof p.animRule==='object') "
            "out.animRule=deep(p.animRule);") in out
    assert "      animRule:pres.animRule||null," in out
    assert ("    if(d.animRule) pres.animRule=d.animRule; "
            "else delete pres.animRule;") in out
    assert "animRule" in DECK_KEYS and "`dur`" in ANNOT_COMMON["anim"][1]
    rule = {"k": {"text": {"fx": "fade", "st": "click", "by": "para"}},
            "ord": ["text"], "nw": 1}
    got = as_presentations([{"name": "d", "slides": [{"annots": []}],
                             "animRule": rule}])
    assert got[0]["animRule"] == rule


def test_one_undo_step_for_the_whole_apply():
    """Every chosen slide is worked out on a copy, a slice at a time; the
    slides take it in ONE task, which runs markDirty once -- so Ctrl+Z
    takes back the whole apply, and a deck switched in the middle is
    left exactly as it was."""
    fn = lift_fn(PART, "animRuleApply")
    assert fn.count("markDirty(") == 1
    assert fn.index("function finish(){") < fn.index("arLand(w.s,w.c);") \
        < fn.index("markDirty();")
    assert "var c=arWorkCopy(s),m=arSlide(c,rule,how,memo,{tally:tally});" \
        in fn
    assert "if(pres!==deck) return;" in fn
    assert "histSettle();" in fn
    # long decks are done a slice at a time, short enough that the frames
    # between them are drawn
    assert "performance.now()-t0<16" in fn
    assert "setTimeout(slice,0);return;" in fn


@needs_js
def test_the_work_copy_leaves_the_slide_alone_until_it_lands():
    got = _run("(()=>{var s=" + json.dumps({"annots": [
        TITLE, dict(BULLETS, anim={"type": "zoom", "order": 0}),
        dict(PIC, out=0)]}) + ";var before=JSON.stringify(s);"
        "var c=arWorkCopy(s);arSlide(c,arNorm({}),'replace',{});"
        "var same=JSON.stringify(s)===before;arLand(s,c);"
        "return [same,s.annots.map(function(a){return a.anim?a.anim.type+'@'"
        "+a.anim.order:null;}),s.annots[2].out];})()")
    # three bullets, then the picture; its exit, which went as the words
    # arrived, cannot come before its own arrival now, so it follows it
    assert got == [True, [None, "fade@0", "fade@3"], 4]


# ---- what an entrance with a length of its own does -------------------------


def test_an_entrance_keeps_its_length_everywhere(out):
    """`anim.dur` is the one new fact: the show, a movement's shorthand,
    the gallery's preview, the scrolling page and the .pptx all read it."""
    assert "el.style.animationDuration=Math.min(10,adur)+'s';" in out
    assert "if(own){inL=e[0]+' '+own+'s '+e[2];inSec=own;}" in out
    assert ("if(+a.anim.dur>0) el.style.animationDuration="
            "Math.min(10,+a.anim.dur)+'s';") in out
    assert "if(+a.anim.dur>0) items[pq].animDur=Math.min(10,+a.anim.dur);" \
        in out
    pptx = (Path(assets.__file__).parent / "js" / "pptx.js").read_text(
        encoding="utf-8")
    assert ("(an.dur > 0 ? String(Math.round(an.dur * 1000)) : '500')"
            in pptx)
    assert ("if (+item.animDur > 0) anims[anims.length - 1].dur = "
            "+item.animDur;") in pptx


# ---- the door and the dialog ---------------------------------------------------


def test_the_door_is_on_the_animation_tab_in_words_and_an_icon(out):
    m = re.search(r'<span class="rbn-grp rbn-rule" data-tab="animation"'
                  r'[^>]*>(.*?)<span class="rbn-lab">Many slides</span>',
                  out, re.S)
    assert m, "the Many slides group"
    assert 'id="anim-rule"' in m.group(1)
    assert re.search(r"Apply to\s+slides&hellip;", m.group(1))
    assert 'class="bic' in m.group(1) or 'data-ic="sorter"' in m.group(1)
    assert ".rbn-rule{order:9;}" in assets.deck_css()
    # a poster has no clicks: the door stands down there, and while
    # Quick animate has the row
    assert "var arb2=$('#anim-rule'); if(arb2) arb2.hidden=!!pg.poster;" in out
    assert "var arb=$('#anim-rule'); if(arb) arb.hidden=on||poster;" in out
    # command search finds it by the words people ask with
    assert "'anim-rule':'animation rule apply animations to all slides" in out


def test_the_dialog_is_wired_and_boots_from_the_boot_sequence():
    assert "48c-anim-rule" in assets.DECK_PARTS
    assert assets.DECK_PARTS.index("48c-anim-rule") \
        == assets.DECK_PARTS.index("48b-motion") + 1
    boot = (Path(assets.__file__).parent / "js" / "deck"
            / "99-boot.js").read_text(encoding="utf-8")
    assert "    animRuleBoot();" in boot
    html = assets.deck_html()
    for cid in ("anr-dlg", "anr-rows", "anr-pv", "anr-play", "anr-copy",
                "anr-scope", "anr-range", "anr-how", "anr-trans",
                "anr-new", "anr-apply", "anr-cancel", "anr-close"):
        assert f'id="{cid}"' in html, cid
    # Keep theirs is the default; Replace is the other answer
    assert ('<option value="new">Keep theirs</option>\n'
            '          <option value="replace">Replace</option>') in html
    # every button wears words as well as an icon
    for b in ("anr-copy", "anr-play", "anr-apply"):
        tag = html[html.index(f'id="{b}"'):]
        tag = tag[:tag.index("</button>")]
        assert "data-ic=" in tag and re.search(r">\s*[A-Z][a-z]", tag), b
    # Escape and Enter answer as in every other dialog, and a click on a
    # rule-opening door loads the editor first
    js = assets.deck_js()
    assert "+'#anr-dlg,'   /* T625: the animation rule */" in js
    app = (Path(assets.__file__).parent / "js" / "app.js").read_text(
        encoding="utf-8")
    assert "#dgm-dlg,#anr-dlg," in app
    # the dialog is on screen before the slides are counted
    open_ = lift_fn(PART, "animRuleOpen")
    assert open_.index("d.hidden=false;") < open_.index("arLiveSoon();")
    assert "arLive();" not in open_
    # ...and the first open costs what a later one does: its rows are
    # built, then the box laid out once unseen, each in an idle moment
    # of its own, never while it is open, and hidden again in that task
    boot_fn = lift_fn(PART, "animRuleBoot")
    assert boot_fn.index("arBuild();") \
        < boot_fn.index("requestIdleCallback(arWarm,")
    warm = lift_fn(PART, "arWarm")
    assert "if(arWarmed||!d||!d.hidden) return;" in warm
    assert warm.index("d.style.visibility='hidden';") \
        < warm.index("d.hidden=false;") < warm.index("void d.offsetWidth;") \
        < warm.index("finally{d.hidden=true;d.style.visibility='';}")


def test_copy_this_slides_animations_as_the_rule():
    fn = lift_fn(PART, "arFromSlide")
    assert "var objs=arObjs(s,arMemo),tl=timelineOf(s)" in fn
    assert "if(!(k in firstAt)) r.k[k]={fx:'none',st:'click'" in fn


@needs_js
def test_copy_reads_the_rule_back_off_a_slide():
    slide = {"annots": [TITLE, BULLETS, FIG, PIC], "trans": "push"}
    rule = {"ord": ["figure", "text", "image"],
            "k": {"text": {"by": "para", "dur": 1},
                  "image": {"fx": "zoom", "st": "with"}}}
    got = _run("(()=>{var s=" + json.dumps(slide) + ";arSlide(s,arNorm("
               + json.dumps(rule) + "),'new',{});"
               "var r=arFromSlide(s,null);return [r.ord.slice(0,3),"
               "r.k.text,r.k.figure,r.k.image,r.k.title,r.tr];})()")
    assert got[0] == ["figure", "text", "image"]
    assert got[1] == {"fx": "fade", "st": "click", "dur": 1, "by": "para"}
    assert got[2] == {"fx": "fade", "st": "click"}
    assert got[3] == {"fx": "zoom", "st": "with"}
    assert got[4]["fx"] == "none"
    assert got[5] == "push"


# ---- the 2026-10-12 review ------------------------------------------------------


@needs_js
def test_copy_keeps_together_what_arrives_together():
    """Copy this slide, then give the rule back to the same slide with
    Replace: nothing moves. Here the words come FIRST in the slide's list
    of objects but the figure sits higher on the page, and both arrive on
    one click. "With previous" is worked out from the rule's order of
    kinds -- the figure first (reading order), the words with it -- not
    from the place in the click's list, which made the figure "With
    previous" with nothing before it and the words "On click": one click
    became two."""
    words = T("words", y=70, anim={"type": "fade", "order": 0})
    fig = dict(FIG, y=20, h=40, anim={"type": "zoom", "order": 0})
    slide = {"annots": [TITLE, words, fig]}
    got = _run("(()=>{var s=" + json.dumps(slide) + ";"
               "var r=arFromSlide(s,null);var c=deep(s);"
               "arSlide(c,r,'replace',{});"
               "return [r.ord.slice(0,2),r.k.figure.st,r.k.text.st,"
               "c.annots.map(function(a){return a.anim?a.anim.type+'@'"
               "+a.anim.order:null;})];})()")
    assert got == [["figure", "text"], "click", "with",
                   [None, "fade@0", "zoom@0"]]


@needs_js
def test_copy_round_trips_a_hand_built_slide():
    """Kinds on clicks of their own, kinds sharing one, a box that runs
    itself: copied and given back with Replace, the slide's clicks are
    what they were."""
    slide = {"annots": [
        TITLE,
        dict(T("one\ntwo"), anim={"type": "rise", "order": 1}),
        dict(FIG, anim={"type": "zoom", "order": 0}),
        dict(PIC, anim={"type": "fade", "order": 1}),
        dict(TABLE, anim={"type": "appear", "order": 2, "after": 2})]}
    got = _run("(()=>{var s=" + json.dumps(slide) + ";"
               "var before=timelineOf(s);var r=arFromSlide(s,null);"
               "var c=deep(s);arSlide(c,r,'replace',{});"
               "function k(tl){return tl.map(function(cl){return cl.map("
               "function(x){return x.i+x.k;}).sort().join(' ');});}"
               "return [k(before),k(timelineOf(c)),c.annots[4].anim.after,"
               "r.ord.slice(0,4)];})()")
    assert got[0] == got[1] == ["2in", "1in 3in", "4in"]
    assert got[2] == 2
    assert got[3] == ["figure", "text", "image", "table"]


# ---- the 2026-10-17 review: one kind, together -----------------------------


@needs_js
def test_all_together_brings_a_kind_on_one_click():
    """"All together" (by 'all', any kind): the kind's first thing starts
    the click as its start says -- on a click, with the one before, or
    by itself after a wait -- and every other thing of that kind joins
    that click, each carrying the same wait (it is the stop's, T169)."""
    left, right = T("left", x=5, y=30, w=40), T("right", x=55, y=30, w=40)
    f1, f2 = dict(FIG, x=5, y=60, h=30), dict(FIG, x=55, y=60, h=30)
    slide = {"annots": [TITLE, left, right, f1, f2]}
    rule = {"k": {"text": {"by": "all"}, "figure": {"by": "all"}}}
    got = _apply(slide, rule, "replace")
    assert got["clicks"] == ["1in 2in", "3in 4in"]
    rule = {"k": {"text": {"by": "all"},
                  "figure": {"st": "after", "w": 2, "by": "all"}}}
    got = _apply(slide, rule, "replace")
    assert got["clicks"] == ["1in 2in", "3in 4in"]
    assert [a[3] for a in got["anim"][3:]] == [2, 2]
    # With previous and All together: every one of them with the one
    # before; one by one, each its own click
    rule = {"k": {"title": {"fx": "fade"}, "text": {"st": "with",
                                                    "by": "all"},
                  "figure": {"by": ""}}}
    got = _apply(slide, rule, "replace")
    assert got["clicks"] == ["0in 1in 2in", "3in", "4in"]
    # top to bottom: the later thing of the kind still joins the first's
    rule = {"by": "place", "k": {"text": {"by": "all"}}}
    got = _apply({"annots": [TITLE, T("a", y=20), dict(FIG, y=40),
                             T("b", y=70)]}, rule, "replace")
    assert got["clicks"] == ["1in 3in", "2in"]
    # stored and made safe: kept for any kind, nonsense dropped, and a
    # box that runs itself may still come with the others (whole)
    n = _run("""(()=>{var r=arNorm({k:{text:{by:'all',st:'after',w:2},
      figure:{by:'all'},image:{by:'para'},code:{by:'bogus'}}});
      return [r.k.text.by,r.k.figure.by,r.k.image.by||'',r.k.code.by||''];
      })()""")
    assert n == ["all", "all", "", ""]


@needs_js
def test_copy_keeps_one_kind_together_when_it_arrives_together():
    """The review's slide: a title, two text boxes side by side that fade
    in on ONE click, then a figure that zooms. Copied and given back with
    Replace it was split -- the two columns on clicks of their own, three
    clicks for two. Copy now reads the kind as All together, and the
    slide comes back as it was; so does a slide with two figures
    together after its words. A kind half together and half not can say
    neither, and is copied one by one."""
    def trip(annots):
        return _run("(()=>{var s=" + json.dumps({"annots": annots}) + ";"
                    "var r=arFromSlide(s,null);var c=deep(s);"
                    "arSlide(c,r,'replace',{});"
                    "function k(tl){return tl.map(function(cl){return "
                    "cl.map(function(x){return x.i+x.k;}).sort()"
                    ".join(' ');});}"
                    "return [k(timelineOf(s)),k(timelineOf(c)),"
                    "r.k.text.by||'',r.k.figure.by||'',r.k.text.st];})()")
    cols = [TITLE,
            T("left words", x=5, y=30, w=40,
              anim={"type": "fade", "order": 0}),
            T("right words", x=55, y=30, w=40,
              anim={"type": "fade", "order": 0}),
            dict(FIG, y=60, h=30, anim={"type": "zoom", "order": 1})]
    got = trip(cols)
    assert got[0] == got[1] == ["1in 2in", "3in"]
    assert got[2:] == ["all", "", "click"]
    figs = [TITLE, T("words", anim={"type": "rise", "order": 0}),
            dict(FIG, x=5, y=60, h=30, anim={"type": "zoom", "order": 1}),
            dict(FIG, x=55, y=60, h=30, anim={"type": "zoom", "order": 1})]
    got = trip(figs)
    assert got[0] == got[1] == ["1in", "2in 3in"]
    assert got[2:] == ["", "all", "click"]
    # together with the title's click: With previous, and all of them
    with_t = [dict(TITLE, anim={"type": "fade", "order": 0})] + cols[1:]
    got = trip(with_t)
    assert got[0] == got[1] == ["0in 1in 2in", "3in"]
    assert got[2:] == ["all", "", "with"]
    # two together and one later: neither, so one by one
    three = cols[:3] + [T("third", y=80, anim={"type": "fade",
                                               "order": 1})]
    got = trip(three)
    assert got[2] == ""


@needs_js
def test_replace_counts_the_entrances_it_takes_off():
    """Replace with a kind on None takes that kind's entrances off. The
    apply counts them (tally.gone), and so does the dialog's line before
    anything is applied (arCount, by the apply's own units) -- it said
    "Nothing here to animate" and the toast "Nothing new to animate"
    while every hand-made entrance went."""
    none = {k: {"fx": "none"} for k in
            ("title", "text", "figure", "image", "shape", "table", "code")}
    slide = {"annots": [dict(TITLE, anim={"type": "zoom", "order": 0}),
                        dict(BULLETS, anim={"type": "fade", "order": 1}),
                        dict(PIC, anim={"type": "rise", "order": 2}),
                        RECT]}
    got = _run("(()=>{var s=" + json.dumps(slide) + ",t={gone:0},u={gone:0};"
               "var objs=arObjs(s,{});"
               "var c1=arCount(objs,arNorm({k:" + json.dumps(none)
               + "}),'replace');var c2=arCount(objs,arNorm({}),'replace');"
               "var c3=arCount(objs,arNorm({}),'new');"
               "var a=deep(s),b=deep(s);"
               "var n1=arSlide(a,arNorm({k:" + json.dumps(none)
               + "}),'replace',{},{tally:t});"
               "var n2=arSlide(b,arNorm({}),'replace',{},{tally:u});"
               "return [c1,c2,c3,n1,t.gone,n2,u.gone,b.annots[0].anim||null];"
               "})()")
    # everything on None: three entrances off, nothing animated
    assert got[0] == {"things": 0, "had": 0, "gone": 3}
    assert got[3:5] == [0, 3]
    # the default rule's title is None: Replace takes the hand-made title
    # zoom off -- and says so -- while the rest is redone
    assert got[1] == {"things": 3, "had": 0, "gone": 1}
    assert got[5:8] == [3, 1, None]
    # Keep theirs touches none of it: only the square is new
    assert got[2] == {"things": 1, "had": 2, "gone": 0}


def test_the_dialog_and_the_toast_say_what_replace_takes_off():
    summ = lift_fn(PART, "arSummary")
    assert "var c=arCount(objs,arRule,how);" in summ
    assert "' taken off'" in summ
    apply_ = lift_fn(PART, "animRuleApply")
    assert "arSlide(c,rule,how,memo,{tally:tally})" in apply_
    assert "if(gone) said.push(gone+(gone===1?' entrance':' entrances')" \
        in apply_
    assert "toast(said.length?(said.join(', ')+' \\u2014 Ctrl+Z undoes it')" \
        in apply_
    # a slide the rule leaves as it was is not landed (and no undo step
    # is made when nothing at all changes)
    assert "if(!arSame(s,c))" in apply_
    assert apply_.index("if(!changed.length&&!ruleMoved){") \
        < apply_.index("markDirty();")


@needs_js
def test_keep_theirs_leaves_a_half_animated_group_alone():
    """A picture zoomed by hand and its caption, grouped: Keep theirs
    leaves the whole group as it is, rather than bringing the caption in
    on a later click of its own, apart from the picture it is grouped
    with."""
    pic = dict(PIC, grp="g7", anim={"type": "zoom", "order": 0})
    cap = T("caption", grp="g7", y=82, x=62)
    got = _apply({"annots": [TITLE, pic, cap, BULLETS]})
    assert got["anim"][2] is None
    assert got["clicks"] == ["1in", "3p0", "3p1", "3p2"]
    # with nothing in it animated, the group arrives as one
    fresh = _apply({"annots": [TITLE, dict(PIC, grp="g7"), cap]})
    assert fresh["clicks"] == ["1in 2in"]


@needs_js
def test_a_box_that_runs_itself_arrives_whole():
    """"After 1 s" is a property of the stop a box BEGINS on (autoAfter):
    with "By bullet" the first bullet ran itself and the rest waited for
    clicks. The rule never says both: After means the whole box."""
    got = _run("""(()=>{var r=arNorm({k:{text:{st:'after',w:1,by:'para'}}});
      var q=arNorm({k:{text:{st:'click',by:'para'}}});
      return [r.k.text.by,r.k.text.st,q.k.text.by];})()""")
    assert got == ["", "after", "para"]
    rule = {"k": {k: {"fx": "none"} for k in ("title", "figure", "image")}}
    rule["k"]["text"] = {"fx": "fade", "st": "after", "w": 1, "by": "para"}
    done = _apply({"annots": [TITLE, BULLETS]}, rule, "replace")
    assert done["clicks"] == ["1in"]
    assert done["anim"][1][:4] == ["fade", 0, "", 1]
    # the dialog greys By bullet while the start is After, says why, and
    # gives it back when the start is a click again
    # -- only By bullet: All together is whole boxes, and may run itself
    dim = lift_fn(PART, "arDim")
    assert "var after=/^after/.test(row.querySelector('.anr-st').value);" \
        in dim
    assert "by.setAttribute('data-was','para');by.value='';" in dim
    assert "para.disabled=true;by.title=AR_BY_AFTER;" in dim
    assert "by.value='para';by.removeAttribute('data-was');" in dim
    assert "by.disabled=true" not in dim


@needs_js
def test_a_new_layout_s_fresh_slots_get_the_rule():
    """A deck that keeps a rule for new slides gives it to the slots a
    layout change has just made -- and only to them: what was carried
    over keeps what it had, typed words with no animation included."""
    kept = T("typed", y=40)
    old = [T("Click to add title", style="title", ph=1, y=4), kept]
    fresh = [T("Title", style="title", ph=1, y=4), kept,
             {"k": "cell", "ref": None, "x": 55, "y": 20, "w": 40, "h": 50},
             T("Body text", ph=1, y=60)]
    got = _run("(()=>{var o=" + json.dumps(old) + ",f=" + json.dumps(fresh)
               + ";f[1]=o[1];var s={annots:f};"
               "pres={animRule:{nw:1,k:{figure:{fx:'zoom'}}}};"
               "var n=animRuleFresh(s,o);var t={annots:deep(f)};"
               "pres={animRule:{k:{}}};var m=animRuleFresh(t,[]);"
               "return [n,s.annots.map(function(a){return a.anim?a.anim.type"
               "+'@'+a.anim.order:null;}),m];})()")
    assert got == [2, [None, None, "zoom@1", "fade@0"], 0]


def test_a_layout_change_asks_for_the_rule_in_its_own_undo_step(out):
    i = out.index("var had=(s.annots||[]).slice();")
    j = out.index("activePane=-1;markDirty();refresh();", i)
    seg = out[i:j]
    assert seg.index("applyLayout(s,layout);") \
        < seg.index("if(typeof animRuleFresh==='function') "
                    "animRuleFresh(s,had);")


def test_create_slides_names_the_rule_it_borrows(out):
    """The reader's Create slides dialog offers a presentation's rule by
    its name, only when one keeps a rule for new slides, and only under
    Add animations; nothing else reaches animRuleForNew."""
    root = Path(assets.__file__).parent
    page = (root / "html" / "page.html").read_text(encoding="utf-8")
    assert '<label class="auto-anim-how" id="auto-anim-how-wrap" hidden>' \
        in page
    assert '<option value="">One per click, in notebook order</option>' \
        in page
    app = (root / "js" / "app.js").read_text(encoding="utf-8")
    assert "var names=APP.deckAnimRules?APP.deckAnimRules():[],was=sel.value;" \
        in app
    assert "w.hidden=!names.length;" in app
    assert "if(animations&&ruleFrom) plan.animRuleFrom=String(ruleFrom);" \
        in app
    # ...asked of the editor's boot, not of its first entry (2026-10-17
    # review: a reader that had not opened a deck was offered nothing)
    assert "window.SemApp.deckAnimRules=animRuleNames;" \
        in lift_fn(out, "autoDeckBoot")
    assert "deckAnimRules" not in lift_fn(out, "animRuleBoot")
    assert out.count("animRuleForNew(") == 2   # its definition, one call


def test_every_open_starts_on_this_slide_and_keep_theirs():
    """The last open's All slides + Replace (or the sorter's 3-4) stayed
    on the controls, so a plain Apply from the ribbon on another slide
    later redid every hand-made animation in the deck. Every open now
    starts on this slide -- or the slides picked in the sorter, for that
    open only -- with Keep theirs. What is remembered is the rule."""
    fn = lift_fn(PART, "animRuleOpen")
    assert "if(sc) sc.value='cur';" in fn
    assert "if(rg) rg.value=String(cur+1);" in fn
    assert "if(hw) hw.value='new';" in fn
    assert "sc.value!=='all'" not in fn


def test_the_help_button_wears_words_and_an_icon():
    html = assets.deck_html()
    tag = html[html.index('id="anr-q"'):]
    tag = tag[:tag.index("</button>")]
    assert 'data-ic="info"' in tag and re.search(r"How it\s+works", tag)
    assert ">?</button>" not in html[html.index('id="anr-dlg"'):]


def test_reordering_the_kinds_keeps_the_keyboard_focus():
    """Earlier re-appended every row, which took the focused button out
    of the page: the focus fell to the body, and the next Enter pressed
    Apply. Rows are moved only when out of place, the focused one never,
    and the focus is handed back."""
    fn = lift_fn(PART, "arRowsOrder")
    assert "if(had&&row.contains(fa)) host.appendChild(x);" in fn
    assert "else host.insertBefore(row,x);" in fn
    assert "t=r?r.querySelector('.anr-fx'):null;" in fn
    assert "try{t.focus({preventScroll:true});}catch(e){}" in fn


def test_the_preview_and_copy_read_a_slide_the_apply_reaches():
    """Opened from the sorter with slides 4 and 8 picked, the preview drew
    slide 1 and Copy read slide 1 -- a slide the apply would not touch."""
    pv = lift_fn(PART, "arPvIdx")
    assert "return (idx.indexOf(cur)>=0||!idx.length)?cur:idx[0];" in pv
    assert "var at=arPvIdx(),pv=$('#anr-pv'),s=pres.slides[at];" \
        in lift_fn(PART, "arPreview")
    boot = lift_fn(PART, "animRuleBoot")
    assert "var nwWas=arRule.nw,at=arPvIdx();" in boot
    assert "toast('Copied from slide '+(at+1));" in boot


@needs_js
def test_a_strip_row_survives_a_change_of_clicks_alone():
    """The strip keeps a row under a key made of the slide as JSON, so an
    apply to sixty slides -- and its undo, which hands back sixty new
    slide objects -- drew sixty thumbnails again on the next build
    (2026-10-12 review: renderFilm 179 ms at 4x on the undo). A row
    filed from a slide that differs from this one in its objects'
    entrances, exits and focuses only is the same picture, and is kept."""
    src = assets.deck_js()
    fns = "\n".join(lift_fn(src, f) for f in ("filmSameBut", "filmPicJson"))
    base = "\u0001".join(["40", "pic", "edit", "", "{}"])

    def key(slide, place="0,0,,"):
        return (base + "\u0001" + json.dumps(slide, separators=(",", ":"))
                + "\u0001\u0001" + "\u0002" + place)
    plain = {"annots": [TITLE, BULLETS, FIG]}
    rule = {"annots": [TITLE, dict(BULLETS, anim={"type": "fade",
                                                  "by": "para"}),
                       dict(FIG, anim={"type": "zoom", "order": 3}, out=4)]}
    worded = {"annots": [TITLE, dict(BULLETS, text="one\ntwo"), FIG]}
    cmd, env = js_engine()
    script = (lift_var(src, "FILM_ANIM_KEYS") + "\n" + fns + "\n"
              + "var row={_fk:" + json.dumps(key(plain)) + ",_pj:null};"
              + "var r2={_fk:" + json.dumps(key(plain)) + ",_pj:null};"
              + "var r3={_fk:" + json.dumps(key(plain)) + ",_pj:null};"
              + "var r4={_fk:null};"
              + "var rule=" + json.dumps(rule) + ",worded="
              + json.dumps(worded) + ";"
              + "var a=filmSameBut(row," + json.dumps(key(rule)) + ",rule);"
              + "var b=filmSameBut(r2," + json.dumps(key(worded))
              + ",worded);"
              + "var c=filmSameBut(r3," + json.dumps(key(rule, "1,0,,"))
              + ",rule);"
              + "var d=filmSameBut(r4," + json.dumps(key(rule)) + ",rule);"
              + "var e=filmSameBut(row," + json.dumps(key(plain)) + ","
              + json.dumps(plain) + ");"
              + "console.log(JSON.stringify([a,!!row._pj,b,c,d,e,"
              + "rule.annots[2].anim.type]));")
    with tempfile.TemporaryDirectory() as dd:
        p = Path(dd) / "run.js"
        p.write_text(script, encoding="utf-8")
        r = subprocess.run(cmd + [str(p)], capture_output=True, text=True,
                           env=env, timeout=60)
        assert r.returncode == 0, r.stderr[:2000]
        got = json.loads(r.stdout.strip().splitlines()[-1])
    # clicks alone: kept, and what it was filed from is remembered; other
    # words, another place in the strip or a picture redrawn since (no
    # _fk): drawn again; and the slide itself is not touched
    assert got == [True, True, False, False, False, True, "zoom"]
    strip = (Path(assets.__file__).parent / "js" / "deck"
             / "55-sections-and-strip.js").read_text(encoding="utf-8")
    assert "if(cand&&!taken.has(cand)&&filmSameBut(cand,key,s)){" in strip
    assert "if(!taken.has(r)) filmUnlazy(r);" in strip
    # a redrawn picture is never kept this way
    assert "row._key=null;row._fk=null;row._pj=null;" in assets.deck_js()
    # and the rule a deck keeps for new slides draws nothing on a row
    assert "if(k==='animRule') return;" in strip


def test_the_door_takes_the_shape_of_its_group():
    """Among small two-row buttons (a generated ribbon layout) the door is
    one of them; in its own group it is a tile. Every layout is walked by
    tests/test_ribbon_never_wraps_in_a_browser.py."""
    fn = lift_fn(PART, "arDoorShape")
    assert "g.querySelector('.rbn-row>.dbtn.rbn-sm')" in fn
    assert "!g.classList.contains('rbn-rule')" in fn
    lay = (Path(assets.__file__).parent / "js" / "deck"
           / "07-ribbon-layouts.js").read_text(encoding="utf-8")
    i = lay.index("    applyRibbonPrefs();      /* T11's hiding")
    assert "if(typeof arDoorShape==='function') arDoorShape();" \
        in lay[i:i + 300]
