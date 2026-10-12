"""A .pptx export does not wait on MathJax (2026-10-11 review).

The user works offline at times. Every .pptx export first waited for every
open notebook's maths to be typeset (jvMath.all, up to 15 s), so with
MathJax unreachable -- offline, or a CDN that never answers -- the export
sat silent for those 15 s before anything happened, a deck with no
equation in it as much as one with. What the export needs MathJax for is
far less:

* a text box's equation is flattened from its own source (texPlain);
* a placed cell's kept copy is cloned as it was kept (cloneBody);
* a placed cell LIVE from its notebook is set when it is cloned
  (jvMath.settle) -- if MathJax is there.

So it waits only for MathJax to ARRIVE (jvMath.arrive), only while a live
cell still has maths to set, and only briefly (PPTX_MATHS_WAIT). A frame
cloned while MathJax was away holds its TeX and typesetting the card does
not drop it, so on arrival those frames are dropped and cloned again. What
is still unset leaves as the TeX it was written in, and the export's
message says so. Driven in Chromium, MathJax hanging and arriving late, by
tests/test_the_editor_keyboard_in_a_browser.py (opt-in).
"""

from __future__ import annotations

import json
import subprocess
import tempfile
from pathlib import Path

import pytest

from junoview import assets


def _run(script: str):
    from helpers_js import js_engine
    eng = js_engine()
    if eng is None:
        pytest.skip("no node or VS Code Electron on this machine")
    cmd, env = eng
    with tempfile.TemporaryDirectory() as d:
        p = Path(d) / "run.js"
        p.write_text(script, encoding="utf-8")
        r = subprocess.run(cmd + [str(p)], capture_output=True, text=True,
                           encoding="utf-8", env=env, timeout=60)
        assert r.returncode == 0, r.stderr[:2000]
        line = [ln for ln in r.stdout.splitlines()
                if ln.startswith("{") or ln.startswith("[")][-1]
        return json.loads(line)


# ------------------------------------------------- jvMath.arrive (app.js)

def _arrive(setup: str, ms: int) -> list:
    from helpers_js import lift_fn
    app = assets.app_js()
    src = ("var ready=false,dead=false,asked=0;\n"
           "function ensure(){asked++;return ENSURE();}\n"
           + lift_fn(app, "within") + "\n" + lift_fn(app, "arrive") + "\n")
    return _run(src + setup + f"""
      var t0=Date.now();
      arrive({ms}).then(function(ok){{
        console.log(JSON.stringify([ok,Date.now()-t0,asked]));}});""")


def test_mathjax_that_never_answers_is_given_up_on_in_time():
    ok, took, asked = _arrive(
        "function ENSURE(){return new Promise(function(){});}", 150)
    assert ok is False and asked == 1
    assert 140 <= took < 1500


def test_mathjax_that_cannot_load_is_no_wait_at_all():
    ok, took, _ = _arrive(
        "function ENSURE(){return Promise.reject(new Error('x'));}", 5000)
    assert ok is False and took < 1000
    # ...and once it is known dead it is not asked for again
    ok, took, asked = _arrive("dead=true;function ENSURE(){throw 1;}", 5000)
    assert (ok, asked) == (False, 0)


def test_mathjax_that_is_there_or_comes_says_so():
    assert _arrive("ready=true;function ENSURE(){throw 1;}", 5000)[0] is True
    ok, took, _ = _arrive(
        "function ENSURE(){return new Promise(function(r){"
        "setTimeout(r,30);});}", 5000)
    assert ok is True and took < 1000


def test_arrive_is_on_the_helper():
    app = assets.app_js()
    assert "warm:warm,arrive:arrive," in app


# --------------------------------------- what the export waits for (deck)

_DECK = r"""
var window={};
var log=[];
var EMB={},LIVE={},CARDS={},PENDING={};
function refIsLive(r){return !!LIVE[r];}
function embBody(r){return EMB[r]||null;}
function cardEl(r){return CARDS[r]||null;}
function normRef(r){return r.indexOf('::')>=0?r:('nb::'+r);}
function dropFrameCache(r){log.push('drop '+r);}
var frameNodeCache={};
var ARRIVES=true,READY=false;
window.jvMath={ready:function(){return READY;},
  hint:function(t){return /\$|\\\(/.test(t);},
  pending:function(c){return PENDING[c]||0;},
  arrive:function(ms){log.push('arrive '+ms);
    return Promise.resolve(ARRIVES);}};
function cell(ref){return {k:'cell',ref:ref,x:0,y:0,w:10,h:10};}
/* a cached frame: its words, and whether it is code (a <pre>) */
function fr(t,pre){return {textContent:t,querySelector:function(s){
  return s==='pre'&&pre?{}:null;}};}
var pres={slides:[]};
"""


def _wait(setup: str) -> list:
    from helpers_js import lift_fn, lift_var
    deck = assets.deck_js()
    src = (_DECK + lift_var(deck, "PPTX_MATHS_WAIT") + "\n"
           + lift_fn(deck, "frameHoldsTex") + "\n"
           + lift_fn(deck, "pptxMathsWait") + "\n")
    return _run(src + setup + """
      var w=pptxMathsWait();
      Promise.resolve(w).then(function(){
        console.log(JSON.stringify([w===null?'none':'waited',log]));});""")


def test_a_deck_with_no_live_maths_does_not_wait():
    # pictures and a text-box equation: nothing the export needs MathJax for
    got = _wait("pres.slides=[{annots:[{k:'image'},"
                "{k:'text',maths:1,text:'$$E=mc^2$$'}]}];")
    assert got == ["none", []]


def test_mathjax_already_here_is_no_wait():
    got = _wait("READY=true;CARDS['nb::a']={};PENDING[CARDS['nb::a']]=1;"
                "pres.slides=[{annots:[cell('nb::a')]}];")
    assert got == ["none", []]


def test_a_frame_drawn_before_mathjax_came_is_cloned_again_set():
    # MathJax arrived after the frame was cloned (its TeX in the frame
    # cache) and before the export: no wait, and the frame is dropped so
    # it is cloned again, set -- not exported as LaTeX (2026-10-12 review)
    got = _wait("READY=true;CARDS['nb::a']={};CARDS['nb::b']={};"
                "CARDS['nb::c']={};"
                "frameNodeCache['nb::a::auto']=fr('$$E=mc^2$$');"
                "frameNodeCache['nb::b::auto']=fr('set');"
                "frameNodeCache['nb::c::code']=fr('xlabel(r\"$\\\\alpha$\")',1);"
                "pres.slides=[{annots:[cell('nb::a'),cell('nb::b'),"
                "cell('nb::c')]}];")
    # ...and a code frame's $ is the code's own: it is not dropped on
    # every export (pptxItems counts no TeX in code either)
    assert got == ["none", ["drop nb::a"]]


def test_a_kept_copy_is_cloned_as_kept_and_does_not_wait():
    got = _wait("var c={};CARDS['nb::a']=c;PENDING[c]=1;EMB['nb::a']={};"
                "pres.slides=[{annots:[cell('nb::a')]}];")
    assert got == ["none", []]


def test_a_live_cell_with_maths_to_set_waits_briefly_and_is_cloned_again():
    got = _wait("var c={};CARDS['nb::a']=c;PENDING[c]=2;EMB['nb::a']={};"
                "LIVE['nb::a']=1;"
                "pres.slides=[{annots:[cell('nb::a')]},"
                "{annots:[cell('nb::a'),cell('nb::b')]}];")
    # once, however many frames show it; a cell with nothing to set (b,
    # no card here) adds nothing
    assert got[0] == "waited"
    assert got[1] == ["arrive 2500", "drop nb::a"]


def test_a_cell_with_no_kept_copy_is_live_whatever_it_says():
    got = _wait("var c={};CARDS['a']=c;PENDING[c]=1;"
                "pres.slides=[{annots:[cell('a')]}];")
    assert got == ["waited", ["arrive 2500", "drop nb::a"]]


def test_mathjax_that_does_not_come_drops_nothing():
    got = _wait("ARRIVES=false;var c={};CARDS['nb::a']=c;PENDING[c]=1;"
                "pres.slides=[{annots:[cell('nb::a')]}];")
    assert got == ["waited", ["arrive 2500"]]


def test_the_wait_is_short():
    from helpers_js import lift_var
    src = lift_var(assets.deck_js(), "PPTX_MATHS_WAIT")
    ms = int(src.split("=")[1].rstrip(";"))
    assert 0 < ms <= 3000


def test_the_export_no_longer_typesets_every_notebook_first():
    from helpers_js import lift_fn
    deck = assets.deck_js()
    orig = lift_fn(deck, "pptxOriginals")
    assert "jvMath.all(" not in orig
    assert "var mw=pptxMathsWait();\n    if(mw) jobs.push(mw);" in orig


# ------------------------------------------------------ and it says so

def test_the_message_names_what_went_as_tex_and_why():
    from helpers_js import lift_fn
    fn = lift_fn(assets.deck_js(), "pptxTexNote")
    got = _run("var window={jvMath:{ready:function(){return R;}}};var R;\n"
               + fn + """
      R=false;var a=[pptxTexNote(0),pptxTexNote(1),pptxTexNote(2)];
      R=true;a.push(pptxTexNote(1));
      console.log(JSON.stringify(a));""")
    assert got[0] == ""
    assert got[1].startswith("1 placed cell kept its equations as the "
                             "LaTeX they were written in")
    assert "MathJax" in got[1] and "offline" in got[1]
    assert got[2].startswith("2 placed cells kept their equations")
    # MathJax there after all: no excuse is made for it
    assert "MathJax" not in got[3]


def test_both_messages_carry_it():
    deck = assets.deck_js()
    from helpers_js import lift_fn
    # the question before the export, and the toast after it
    assert "if(note.tex) lost.push(pptxTexNote(note.tex));" in \
        lift_fn(deck, "pptxLosses")
    assert "if(note.tex) msg+='. '+pptxTexNote(note.tex);" in deck
    # counted where a placed cell's words are written, never in code
    assert ("if(txt&&!code&&(mathsPlain(txt,false).hit"
            "||/\\\\[(\\[]|\\\\begin\\s*\\{/.test(txt)))") in deck
