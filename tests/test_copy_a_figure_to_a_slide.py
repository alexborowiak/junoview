"""A figure copied in the notebook pastes onto a slide as the figure (T612).

The user, 2026-10-08: "Would be cool if there were easier ways to add from
open notebooks to presentation. Like there was a copy code thing, and then
that copied like the github url and figure code associated with that
figure, then when you pasted it into a presentation it just pasted as the
figure."

Before this, the only copy a figure had was the browser's own: select it,
Ctrl+C, and the deck's paste found an <img> in text/html and placed a dead
picture (k:'image') -- no ref, no source, no Update, no Locate. Now the
figure's bar carries a Copy that writes words (title, where the notebook
lives, the code), HTML with the picture, and application/x-junoview-cell
(the ref and the path); the deck's paste resolves that against its OWN
open notebooks and places a k:'cell' frame through embedIfAbsent, like
every other placement door. Never the figure's HTML through the
clipboard: a clipboard can be written by any page.

Driven at 1366x657 and 1280x600: Copy on the DJF figure, Ctrl+V on the
slide -> one an-cell frame and the Object tab's From/Locate in notebook;
Ctrl+Z took it off; Ctrl+Shift+V gave a plain text box; Home > Paste and
the right-click "Paste figure" placed it; a paste while typing in a box
put the figure on the slide and left the box's 681 characters alone; a
second browser tab of the same app placed it; a tab with the notebook
closed placed the deck's saved copy and offered Open its notebook, which
made both frames live.
"""

from __future__ import annotations

import json
import subprocess
import tempfile
from pathlib import Path

import pytest

from helpers_js import js_engine, lift_fn
from junoview import assets


def _var(src: str, name: str) -> str:
    i = src.index(f"  var {name}=")
    return src[i:src.index(";\n", i) + 1]


def _reader() -> str:
    js = assets.deck_js()
    return ("\n".join([_var(js, "CELL_MIME"), _var(js, "CELL_MARK"),
                       lift_fn(js, "cellClipOf")]) + "\n")


SCRIPT = r"""
function cd(map){return {getData:function(t){return map[t]||'';}};}
var M='application/x-junoview-cell';
var text='# DJF mean Z500\n'
  +'# https://github.com/a/b/blob/main/x.ipynb  (cell clim_map)\n'
  +'# junoview-cell: example_climate_analysis::clim_map @127.0.0.1:8848\n'
  +'fig, ax = plt.subplots()\n';
var out={
  json:cellClipOf(cd({[M]:JSON.stringify({v:1,ref:'nb::cell:83402c05',path:'/p/nb.ipynb',
    title:'T',kind:'figure',where:'h:1',html:'<img onerror=alert(1)>'})})),
  text:cellClipOf(cd({'text/plain':text})),
  prose:cellClipOf(cd({'text/plain':'just some words'})),
  noRef:cellClipOf(cd({[M]:JSON.stringify({ref:'no-separator'})})),
  badJson:cellClipOf(cd({[M]:'{not json','text/plain':text})),
  nothing:cellClipOf(null)
};
console.log(JSON.stringify(out));
"""


def _run():
    eng = js_engine()
    if eng is None:
        return None
    cmd, env = eng
    with tempfile.TemporaryDirectory() as d:
        p = Path(d) / "run.js"
        p.write_text(_reader() + SCRIPT, encoding="utf-8")
        r = subprocess.run(cmd + [str(p)], capture_output=True, text=True,
                           env=env, timeout=60)
        assert r.returncode == 0, r.stderr[:3000]
        return json.loads(r.stdout.strip().splitlines()[-1])


def test_the_deck_reads_its_own_copy_and_nothing_else():
    got = _run()
    if got is None:
        pytest.skip("no node or VS Code Electron on this machine")
    assert got["json"] == {"ref": "nb::cell:83402c05", "path": "/p/nb.ipynb",
                           "title": "T", "kind": "figure", "url": "",
                           "where": "h:1"}
    # the text marker is the same copy for a door that reads only words
    assert got["text"]["ref"] == "example_climate_analysis::clim_map"
    assert got["text"]["where"] == "127.0.0.1:8848"
    assert got["prose"] is None and got["noRef"] is None
    assert got["nothing"] is None
    # unreadable JSON falls back to the words, it does not throw
    assert got["badJson"]["ref"] == "example_climate_analysis::clim_map"
    # whatever a clipboard says, no HTML ever comes out of the reader
    assert "html" not in got["json"]


def test_the_copy_lives_on_the_figure_bar_in_words_and_an_icon():
    js = assets.load("js/app.js")
    assert "bc.className='fz-btn fz-copy';" in js
    assert "bc.innerHTML=bic('copy')+' Copy';" in js
    # a copy event, so the deck's own type can ride along
    assert "e.clipboardData.setData(CELL_MIME,JSON.stringify(p.meta));" in js
    assert "try{document.execCommand('copy');}catch(err){}" in js
    # the deck's in-page memory, for the doors that cannot read the clipboard
    assert "window.SemDeckCellCopied(p.meta);" in js
    # the meta is a ref and a place, never the figure's markup
    meta = js[js.index("return {meta:{"):js.index("text:text,html:html};")]
    assert "html" not in meta


def test_the_paste_reads_the_copy_before_any_picture():
    js = assets.deck_js()
    start = js.index("  document.addEventListener('paste',function(e){")
    body = js[start:js.index("\n  });\n", start)]
    assert body.index("var cc=cellClipOf(e.clipboardData);") \
        < body.index("if(e.target.isContentEditable){")
    assert body.index("if(cellPasteFrom(e,cc)) return;") \
        < body.index("      if(!pic) return;")
    # after our own internal markers, before the picture and the buffer
    assert body.index("mk.indexOf('junoview/slide')===0") \
        < body.index("    if(cc){") \
        < body.index("    if(pic){e.preventDefault();pasteClipboardImage(pic);")
    # Ctrl+Shift+V still means the words (T128)
    cell = body[body.index("    if(cc){"):]
    assert cell.index("if(plainPasteT){") < cell.index("pasteCellClip(cc)")


def test_a_pasted_figure_is_a_placed_frame():
    js = assets.deck_js()
    fn = lift_fn(js, "pasteCellClip")
    assert "a={k:'cell',x:x,y:y,w:w,h:h,ref:ref};" in fn
    # T297/T300: every placement door keeps its pixels and its source
    assert "embedIfAbsent(a);" in fn
    assert "markDirty();" in fn
    # resolved here, from this page's own notebooks or kept copies
    here = lift_fn(js, "cellRefHere")
    assert "if(c.where&&c.where!==cellWhere()) return null;" in here
    assert "sh.path===c.path" in here
    # the same page on both sides: the host AND the path, so two pages
    # on one host (or two file:// pages) are not taken for each other
    assert "  function cellWhere(){return location.host+location.pathname;}" \
        in js
    assert "where=location.host+location.pathname;" in assets.load("js/app.js")


def test_the_newest_copy_wins_in_every_door():
    js = assets.deck_js()
    assert "cellClip=null;             /* T612: the newest copy wins */" in js
    assert lift_fn(js, "slideCopy").count("cellClip=null;") == 1
    assert "cellClip=c;clipBuf=[];clipGrpMeta={};" in lift_fn(js,
                                                              "cellCopied")
    # the right-click menu, Home > Paste and the keydown fallback
    assert ("      row('Paste '+cw,'Ctrl+V',function(){\n"
            "        if(!pasteCellClip(cellClip)) cellNotHere(cellClip,false);},"
            ) in js
    assert ("    if(which==='paste'&&cellClip){\n"
            "      closeBox(cellClip);\n"
            "      if(pasteCellClip(cellClip)) return;\n    }") in js
    assert "if(cellClip&&pasteCellClip(cellClip)) return;   /* T612 */" in js
    assert "window.SemDeckCellCopied=cellCopied;" in js


def test_a_box_being_typed_in_lets_the_figure_through():
    js = assets.deck_js()
    box = js.split("      if(!cd) return;\n      /* T612: a notebook figure", 1)[1]
    # only a figure this page can place; one it cannot is words
    assert box.split("      var txt='';", 1)[0].endswith(
        "      var cc5=cellClipOf(cd);\n"
        "      if(cc5&&cellRefHere(cc5)) return;\n")


PLACE = r"""
var pres={slides:[{annots:[]}]},cur=0,selAnnot=null,stage={querySelector:
  function(){return null;}};
var log=[];
var ITEMS={'nb::a':1,'nb::b':1,'nb::c':1,'nb::d':1};
function cellRefHere(c){return c.ref==='nb::gone'?null:c.ref;}
function flipSelIdx(){return FLIP;}
var FLIP=null;
function flipFrames(a){return a.frames||[];}
function pointerPct(){return {x:90,y:10};}
function embedIfAbsent(a){log.push('embed');}
function markDirty(){log.push('dirty');}
function renderSlide(){}
function renderFlipPane(){}
function renderAnnots(){}
function selectAnnot(){}
function splitRef(r){return r.split('::');}
function toast(m){log.push(m);}
var out={};
out.gone=pasteCellClip({ref:'nb::gone'});
pasteCellClip({ref:'nb::a',kind:'figure'});
pasteCellClip({ref:'nb::a',kind:'figure'});
out.two=pres.slides[0].annots.map(function(a){return [a.k,a.x,a.y,a.w,a.h,a.ref];});
pasteCellClip({ref:'nb::b'},'here');
out.here=pres.slides[0].annots[2];
pres.slides[0].annots.push({k:'cell',x:1,y:1,w:10,h:10});selAnnot=3;
pasteCellClip({ref:'nb::c'});
out.filled=pres.slides[0].annots[3];out.n=pres.slides[0].annots.length;
selAnnot=null;pres.slides[0].annots.push({k:'flip',frames:[{ref:'nb::a'}]});
FLIP=4;pasteCellClip({ref:'nb::d'});
out.flip=pres.slides[0].annots[4];
out.log=log;
console.log(JSON.stringify(out));
"""


def test_a_paste_places_fills_or_adds_a_page():
    eng = js_engine()
    if eng is None:
        pytest.skip("no JS engine")
    cmd, env = eng
    src = lift_fn(assets.deck_js(), "pasteCellClip") + "\n" + PLACE
    with tempfile.TemporaryDirectory() as d:
        p = Path(d) / "run.js"
        p.write_text(src, encoding="utf-8")
        r = subprocess.run(cmd + [str(p)], capture_output=True, text=True,
                           env=env, timeout=60)
    assert r.returncode == 0, r.stderr[:3000]
    got = json.loads(r.stdout.strip().splitlines()[-1])
    # a ref this page does not have places nothing
    assert got["gone"] is False
    # centred; the same figure again is nudged clear of the first
    assert got["two"] == [["cell", 27, 30, 46, 40, "nb::a"],
                          ["cell", 30, 33, 46, 40, "nb::a"]]
    # Ctrl+Alt+V: at the pointer, kept on the page
    assert got["here"]["x"] == 54 and got["here"]["y"] == 0
    # a selected EMPTY frame takes it, as a pick fills one
    assert got["filled"]["ref"] == "nb::c" and got["n"] == 4
    # a selected flip book gets it as a page, and lands on it
    assert got["flip"]["frames"] == [{"ref": "nb::a"}, {"ref": "nb::d"}]
    assert got["flip"]["at"] == 1
    # every placement keeps its pixels and is one undo step
    assert got["log"].count("embed") == 5
    assert got["log"].count("dirty") == 5
    assert "Figure pasted from nb — it follows the notebook. Ctrl+Z " \
        "undoes it" in got["log"]


def test_a_saved_copy_or_no_copy_says_how_to_make_it_live():
    js = assets.deck_js()
    fn = lift_fn(js, "pasteCellClip")
    assert "if(!ITEMS[ref]){" in fn and "var op=cellOpenAct(c);" in fn
    act = lift_fn(js, "cellOpenAct")
    # a clipboard's path is only ever offered as a local notebook, in the
    # app, from the same page, on a click
    assert "if(APP.mode!=='app'||away||!/\\.ipynb$/i.test(c.path)" in act
    assert "||/^https?:/i.test(c.path)" in act
    assert "var op=cellOpenAct(c);" in lift_fn(js, "cellNotHere")


def test_a_local_notebook_knows_its_github_page(tmp_path):
    import shutil
    if not shutil.which("git"):
        pytest.skip("git is not installed")
    from junoview.server.vcs import _git_rel_path
    sub = tmp_path / "examples"
    sub.mkdir()
    nb = sub / "a b.ipynb"
    nb.write_text("{}", encoding="utf-8")
    other = sub / "untracked.ipynb"
    other.write_text("{}", encoding="utf-8")
    subprocess.run(["git", "-C", str(tmp_path), "init", "-q"], check=True)
    subprocess.run(["git", "-C", str(tmp_path), "add", "examples/a b.ipynb"],
                   check=True)
    # the path GitHub shows, from the repository's root
    assert _git_rel_path(nb) == "examples/a b.ipynb"
    # an untracked file has no page to link to
    assert _git_rel_path(other) == ""
    assert _git_rel_path(tmp_path.parent / "nowhere" / "x.ipynb") == ""


def test_the_help_says_where_copy_is():
    helpp = assets.load("html/help.html")
    assert "<b><i data-ic=\"copy\"></i> Copy</b>. Paste on a slide" in helpp



def test_the_review_of_t612():
    """2026-10-08 review of T612, each driven or run before the fix:
    Ctrl+Shift+V in a text box placed the figure instead of the words;
    Home > Paste with the caret in a box placed the figure with the box
    still open, so the first Ctrl+Z undid the typing; a copy whose
    notebook was closed bound to another open notebook of the same name;
    the right-click Paste figure and Ctrl+Alt+V said nothing when the
    figure could not be placed; a look copied earlier outranked a newer
    figure Copy for Ctrl+Shift+V; and the GitHub link broke on '#', '?',
    non-ASCII and glob characters in a file name."""
    js = assets.deck_js()
    # Ctrl+Shift+V: the words, never the figure -- and since T623 its
    # lines are still lines (pasteParas, plain only)
    assert ("      if(codePlain){\n        codePlain=0;e.stopPropagation();\n"
            "        if(paraOn&&cd) pasteParas(cd,true,e);\n        return;\n"
            "      }") in js
    assert ("      if(cc){closeBox(cc);if(!pasteCellClip(cc)) "
            "cellNotHere(cc,false);return;}") in js
    here = lift_fn(js, "cellRefHere")
    assert here.index("sh.path===c.path") < here.index(
        "      if(ITEMS[c.ref]) return null;")
    assert "objStamp=++clipSeq;" in lift_fn(js, "cellCopied")
    assert ("          if(!pasteCellClip(cellClip,'here')) "
            "cellNotHere(cellClip,false);") in js
    app = assets.load("js/app.js")
    assert ("    function seg(p){return String(p).split('/')"
            ".map(encodeURIComponent)") in app
    assert "encodeURI(g.rel)" not in app


def test_the_github_path_is_the_name_exactly(tmp_path):
    import shutil
    if not shutil.which("git"):
        pytest.skip("git is not installed")
    from junoview.server.vcs import _git_rel_path
    sub = tmp_path / "ex"
    sub.mkdir()
    names = ["Análisis.ipynb", "fig1.ipynb", "fig[1].ipynb", "run #2.ipynb"]
    for n in names:
        (sub / n).write_text("{}", encoding="utf-8")
    subprocess.run(["git", "-C", str(tmp_path), "init", "-q"], check=True)
    subprocess.run(["git", "-C", str(tmp_path), "add", "ex/Análisis.ipynb",
                    "ex/fig1.ipynb", "ex/run #2.ipynb"], check=True)
    assert _git_rel_path(sub / "Análisis.ipynb") == "ex/Análisis.ipynb"
    assert _git_rel_path(sub / "run #2.ipynb") == "ex/run #2.ipynb"
    # a glob character is part of the name: untracked is untracked
    assert _git_rel_path(sub / "fig[1].ipynb") == ""
