"""Every presentation remembers where it lives, and Recent says so (T598).

The user, 2026-09-30: "also the saving and opening is still really cursed
and confusing ... Also the file saving is and recents is confusing."

Recent and the library listed names and nothing else, and where a deck
saved to was ONE setting for every deck beside ONE remembered file handle:
open a deck kept in a file, then one kept here, and the second began
asking for a file; reload, and only the last deck still knew its file.
Each deck keeps a small record now (its home, its file's name, when it was
last edited, saved and opened) and its own file handle, and every row that
lists decks prints where each lives and when.

The record, the "where" and the "home" RUN here against stubs: which home
a deck gets back is a decision, and a substring cannot check a decision.
"""

from __future__ import annotations

import json
import subprocess
import tempfile
from pathlib import Path

import pytest

from junoview import assets


def _run(fns: tuple[str, ...], script: str):
    from helpers_js import js_engine, lift_fn
    eng = js_engine()
    if eng is None:
        pytest.skip("no node or VS Code Electron on this machine")
    cmd, env = eng
    src = assets.deck_js()
    pre = "\n".join(lift_fn(src, f) for f in fns) + "\n"
    stub = """
      var store={},DECK_META_KEY='sempres:web:/:deck-meta';
      function lsGet(k){return store.hasOwnProperty(k)?store[k]:null;}
      function lsSet(k,v){store[k]=v;return true;}
    """
    with tempfile.TemporaryDirectory() as d:
        p = Path(d) / "run.js"
        p.write_text(stub + pre + script, encoding="utf-8")
        r = subprocess.run(cmd + [str(p)], capture_output=True, text=True,
                           encoding="utf-8", env=env, timeout=60)
    assert r.returncode == 0, r.stderr[:2000]
    return json.loads(r.stdout.strip().splitlines()[-1])


_META = ("deckMetaAll", "deckMeta", "deckMetaSet", "deckMetaMove",
         "deckMetaDrop")


def test_a_record_is_written_merged_moved_and_dropped():
    got = _run(_META, """
      deckMetaSet('talk',{home:'file',file:'talk.junoview.html'});
      deckMetaSet('talk',{edited:5});
      deckMetaSet('talk',{file:null});                /* null deletes */
      var a=deckMeta('talk');
      deckMetaMove('talk','Talk (final)');
      var b=[deckMeta('talk'),deckMeta('Talk (final)')];
      deckMetaDrop('Talk (final)');
      store[DECK_META_KEY]='not json';                /* never throws */
      console.log(JSON.stringify({a:a,b:b,c:deckMetaAll()}));
    """)
    assert got["a"] == {"home": "file", "edited": 5}
    assert got["b"] == [{}, {"home": "file", "edited": 5}]
    assert got["c"] == {}


def test_where_a_deck_lives_is_read_in_the_order_it_is_true():
    """Its own file first; the project, a notebook it rides in; then this
    browser when that is its home (chosen, or the default); else "not
    saved yet" -- a deck with no home but this browser's copy."""
    got = _run(_META + ("deckWhere",), """
      var fileHandles={f:{name:'f.junoview.html'}};
      var projectPres=[{name:'p'}],nbPres=[{name:'n',origin:'analysis'}];
      var DEFAULT='browser';
      function defaultSaveTarget(){return DEFAULT;}
      function loadDraft(){return {slides:[]};}
      deckMetaSet('m',{file:'moved.junoview.html'});  /* no handle now */
      deckMetaSet('b',{home:'browser'});
      var out={};
      ['f','m','p','n','b','x'].forEach(function(k){out[k]=deckWhere(k);});
      DEFAULT='file';                                 /* a folder is set */
      out.x2=deckWhere('x');out.b2=deckWhere('b');
      console.log(JSON.stringify(out));
    """)
    assert got["f"] == {"kind": "file", "text": "f.junoview.html"}
    # a file it was saved to is remembered by name even without a handle
    assert got["m"] == {"kind": "file", "text": "moved.junoview.html"}
    assert got["p"] == {"kind": "project", "text": "this project"}
    assert got["n"] == {"kind": "notebook", "text": "in analysis"}
    assert got["b"] == {"kind": "browser", "text": "this browser"}
    assert got["x"] == {"kind": "browser", "text": "this browser"}
    # with a folder as the default, a deck not saved there is not saved
    assert got["x2"] == {"kind": "none", "text": "not saved yet"}
    # ...but one given this browser by name still lives here
    assert got["b2"] == {"kind": "browser", "text": "this browser"}


def test_each_deck_saves_where_it_lives():
    """The destination follows the deck: its recorded home, else the file
    it has a handle to, else the default -- each only where this page can
    save there."""
    got = _run(_META + ("deckHomeOf",), """
      var fileHandles={h:{name:'h.junoview.html'}},canPickFile=true;
      var APP={mode:'web'},DEFAULT='browser';
      function defaultSaveTarget(){return DEFAULT;}
      deckMetaSet('file-deck',{home:'file'});
      deckMetaSet('here',{home:'browser'});
      deckMetaSet('proj',{home:'project'});
      var out={};
      ['file-deck','here','h','proj','new'].forEach(function(k){
        out[k]=deckHomeOf(k);});
      DEFAULT='file';out.new_with_folder=deckHomeOf('new');
      out.here_with_folder=deckHomeOf('here');
      canPickFile=false;out.no_picker=deckHomeOf('file-deck');
      out.no_picker_handle=deckHomeOf('h');
      console.log(JSON.stringify(out));
    """)
    assert got["file-deck"] == "file"
    assert got["here"] == "browser"
    assert got["h"] == "file"                  # a handle is a home
    assert got["proj"] == "browser"            # no project outside the app
    assert got["new"] == "browser"
    assert got["new_with_folder"] == "file"
    assert got["here_with_folder"] == "browser"
    assert got["no_picker"] == "file"          # the default, not the record
    assert got["no_picker_handle"] == "file"


def test_a_row_says_where_when_and_how_long():
    got = _run(("deckRowWords", "histWhen"), """
      var now=Date.now();
      console.log(JSON.stringify([
        deckRowWords({where:'talk.junoview.html',at:now-120000,slides:12}),
        deckRowWords({where:'this browser',at:now,slides:1}),
        deckRowWords({where:'this project',slides:0}),
        deckRowWords(null)]));
    """)
    assert got[0] == "talk.junoview.html · 2 min ago · 12 slides"
    assert got[1] == "this browser · just now · 1 slide"
    assert got[2] == "this project · 0 slides"
    assert got[3] == ""


# ------------------------------------------------------------ the wiring


def test_the_record_is_not_mistaken_for_a_draft(out):
    """draftsLoadLocal reads every PFX key in localStorage as an old
    draft unless DRAFT_META names it -- the record would have come back
    as a presentation called "deck-meta"."""
    assert "    'deck-meta':1};              /* T598" in out


def test_every_deck_keeps_its_own_handle(out):
    bind = out.split("  function bindFile(name,h){")[1].split("\n  }\n")[0]
    assert "        idbPut(HKEYD+fileFor,h).catch(function(){});" in bind
    assert "        idbDel(HKEYD+fileFor).catch(function(){});" in bind
    assert "  var HKEYD=HKEY+'::';" in out
    boot = out.split("  function fileHandlesBoot(){")[1].split("\n  }\n")[0]
    assert "r.key.indexOf(HKEYD)!==0" in boot
    assert "    fileHandlesBoot();   /* T598: and every other deck's */" in out
    # a rename moves it and a delete drops it
    assert "    if(h) idbPut(HKEYD+nm,h).catch(function(){});" in out
    dele = out.split("  function deletePresByName(nm){")[1].split("\n  }\n")[0]
    assert "    idbDel(HKEYD+nm).catch(function(){});" in dele


def test_the_destination_follows_the_deck(out):
    sync = out.split("  function fileSync(){")[1].split("\n  }\n")[0]
    assert "    var home=deckHomeOf(nm);" in sync
    assert "      saveTarget=home;" in sync
    tgt = out.split("  function setTarget(t){")[1].split("\n  }\n")[0]
    assert "    if(pres&&pres.name) deckMetaSet(pres.name,{home:t});" in tgt


def test_every_save_and_open_is_stamped(out):
    assert "    deckMetaSet(savedName,{saved:Date.now(),home:'project'});" in out
    assert ("            deckMetaSet(savedName,{saved:Date.now(),home:'file',"
            in out)
    assert "    deckMetaSet(name,{opened:Date.now()});   /* T598 */" in out
    assert "    deckMetaSet(pres.name||'untitled',{edited:Date.now()," in out


def test_the_rows_print_it(out):
    lib = out.split("  function presentationLibraryRow(p,click){")[1] \
        .split("\n  }\n")[0]
    assert "    sub.textContent=deckRowWords(p);" in lib
    js = assets.app_js()
    assert "      var words=APP.deckRowWords?APP.deckRowWords(p):'';" in js
    assert "    window.SemApp.deckRowWords=deckRowWords;   /* T598 */" in out
