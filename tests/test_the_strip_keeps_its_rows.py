"""The slide strip keeps its rows, and draws thumbnails as they come into
view -- the decisions that make that safe RUN here, lifted out of the deck
IIFE.

2026-10-09 (the owner: "if this is not able to load quick, and not be
laggy, then no matter how good the features are no one will ever use
this"). renderFilm emptied the strip and built every row again after every
edit, undo, redo, add, duplicate and delete, and on the first slide change
after any of them: 150-290 ms at 4x on a 60-slide deck, for one changed
row. Now:

* a row is kept under a key made of everything it is drawn from, and a
  kept row is moved, not rebuilt; only its index, number and current mark
  are written (filmRowKey, filmTake, filmRowMoved);
* the list is changed by the least that gets it there (filmReconcile);
* a row redrawn outside a build (refreshThumb, syncFilmBuild, a box drawn
  after its slide changed) is never kept as what it was filed under;
* rows away from the current slide get a box of the same size, drawn as
  it comes into view (filmLazyBox / filmFill);
* the slide sorter copies the strip's thumbnail of a slide only when it
  was drawn from exactly what the slide is now (filmThumbSource);
* a card is looked up once, not per thumbnail (cardEl);
* Create slides and File > Open draw the editor once, not twice
  (importDeckText).

Their behaviour in a real browser -- every row of a kept strip equal to a
strip built from nothing, across edits, undo, sections, versions, a
notebook reloaded with new figures -- is
tests/test_the_strip_keeps_its_rows_in_a_browser.py (opt-in).
"""

from __future__ import annotations

import json
import subprocess
import tempfile
from pathlib import Path

import pytest

from junoview import assets

DECK = Path(__file__).resolve().parent.parent / "src" / "junoview" \
    / "assets" / "js" / "deck"


def _part(name: str) -> str:
    return (DECK / f"{name}.js").read_text(encoding="utf-8")


def _run(prelude: str, fns: tuple[str, ...], script: str):
    from helpers_js import js_engine, lift_fn
    eng = js_engine()
    if eng is None:
        pytest.skip("no node or VS Code Electron on this machine")
    cmd, env = eng
    src = assets.deck_js()
    body = "\n".join(lift_fn(src, f) for f in fns)
    with tempfile.TemporaryDirectory() as d:
        p = Path(d) / "run.js"
        p.write_text(prelude + "\n" + body + "\n" + script, encoding="utf-8")
        r = subprocess.run(cmd + [str(p)], capture_output=True, text=True,
                           encoding="utf-8", env=env, timeout=60)
        assert r.returncode == 0, r.stderr[:2000]
        line = [ln for ln in r.stdout.splitlines()
                if ln.startswith("{") or ln.startswith("[")][-1]
        return json.loads(line)


# A list with just enough of the DOM for filmReconcile, counting what it
# does to the document.
_LIST = r"""
function Node(id){this.id=id;this.parent=null;}
function List(ids){this.kids=[];this.ops=0;
  var me=this;(ids||[]).forEach(function(n){n.parent=me;me.kids.push(n);});}
Object.defineProperty(List.prototype,'firstChild',
  {get:function(){return this.kids[0]||null;}});
Object.defineProperty(Node.prototype,'nextSibling',{get:function(){
  if(!this.parent) return null;var k=this.parent.kids,i=k.indexOf(this);
  return k[i+1]||null;}});
List.prototype.removeChild=function(n){this.ops++;
  this.kids.splice(this.kids.indexOf(n),1);n.parent=null;return n;};
List.prototype.insertBefore=function(n,ref){this.ops++;
  if(n.parent) n.parent.kids.splice(n.parent.kids.indexOf(n),1);
  var at=ref?this.kids.indexOf(ref):this.kids.length;
  this.kids.splice(at,0,n);n.parent=this;return n;};
function ids(l){return l.kids.map(function(n){return n.id;}).join(',');}
function want(b){return b.map(function(n){return n.id;}).join(',');}
"""


def test_the_list_is_changed_by_the_least_that_gets_it_there():
    got = _run(_LIST, ("filmReconcile",), r"""
      var out={};
      function make(n){var a=[];for(var i=0;i<n;i++) a.push(new Node('r'+i));return a;}
      // nothing changed: nothing touched
      var a=make(60),L=new List(a.slice());
      filmReconcile(L,a);out.same=[ids(L)===ids(new List(a)),L.ops];
      // one row redrawn (an edit): one row out, one in
      a=make(60);L=new List(a.slice());var b=a.slice();b[17]=new Node('new17');
      filmReconcile(L,b);out.edit=[ids(L)===want(b),L.ops];
      // a slide added (Ctrl+M): one insert
      a=make(60);L=new List(a.slice());b=a.slice();b.splice(5,0,new Node('add'));
      filmReconcile(L,b);out.add=[ids(L)===want(b),L.ops];
      // a slide deleted: one removal
      a=make(60);L=new List(a.slice());b=a.slice();b.splice(30,1);
      filmReconcile(L,b);out.del=[ids(L)===want(b),L.ops];
      // a slide dragged down, a section folded, the whole list replaced
      a=make(12);L=new List(a.slice());b=a.slice();
      var m=b.splice(2,1)[0];b.splice(8,0,m);
      filmReconcile(L,b);out.move=ids(L)===want(b);
      a=make(12);L=new List(a.slice());b=a.slice(0,3).concat(a.slice(9));
      filmReconcile(L,b);out.fold=[ids(L)===want(b),L.ops];
      a=make(6);L=new List(a.slice());b=make(4);
      filmReconcile(L,b);out.all=ids(L)===want(b);
      // from empty (the first build)
      L=new List([]);b=make(5);filmReconcile(L,b);
      out.first=[ids(L)==='r0,r1,r2,r3,r4',L.ops];
      console.log(JSON.stringify(out));
    """)
    assert got["same"] == [True, 0]
    assert got["edit"] == [True, 2]
    assert got["add"] == [True, 1]
    assert got["del"] == [True, 1]
    assert got["move"] is True
    assert got["fold"] == [True, 6]
    assert got["all"] is True
    assert got["first"] == [True, 5]


def test_a_row_is_taken_once_and_never_when_it_was_redrawn():
    got = _run("", ("filmTake", "filmPut"), r"""
      var m=new Map(),a={_key:'k'},b={_key:'k'},c={_key:'k'};
      filmPut(m,'k',a);filmPut(m,'k',b);filmPut(m,'k',c);
      var t1=filmTake(m,'k');b._key=null;   /* b was redrawn by refreshThumb */
      var t2=filmTake(m,'k'),t3=filmTake(m,'k'),gone=!m.has('k');
      console.log(JSON.stringify({first:t1===a,skipsStale:t2===c,
        none:t3===null,gone:gone,
        miss:filmTake(m,'x')===null}));
    """)
    assert got == {"first": True, "skipsStale": True, "none": True,
                   "gone": True, "miss": True}


_KEY = r"""
var deckViewGen=3,miniHNow=66,mode='edit',pres=null;
var viewGens={n:0,all:0,of:Object.create(null)},ITEMS={};
function activeCut(){return '';}
function flipFrames(a){return (a&&Array.isArray(a.frames))?a.frames:[];}
"""


def test_the_deck_key_counts_empty_as_absent_and_leaves_out_what_no_row_draws():
    got = _run(_KEY, ("filmKeyBase", "filmThumbKey", "filmRowKey",
                      "filmRefGens", "refViewGen"), r"""
      var out={};
      pres={name:'d',slides:[{a:1}],styles:{h1:{size:4}},tokens:{c:{page:'#fff'}}};
      var k0=filmKeyBase('thumb');
      // a {} made by a read, or a key an undo deleted, is the same deck
      pres.live={};pres.cuts={};pres.guides=null;
      out.emptySame=filmKeyBase('thumb')===k0;
      // slides, notes, pad and the copies never change the deck's key
      pres.slides=[{b:2}];pres.notes='x';pres.pad={a:[1]};
      pres.emb={r:{html:'x'}};pres.media={m:1};
      out.ignored=filmKeyBase('thumb')===k0;
      // the look does
      pres.tokens={c:{page:'#000'}};out.look=filmKeyBase('thumb')!==k0;
      pres.tokens={c:{page:'#fff'}};
      // a section's colour does; whether it is folded does not (that is
      // the place of the rows it hides, not what any row draws)
      pres.sections={sa:{name:'A'}};var k1=filmKeyBase('thumb');
      pres.sections={sa:{name:'A',fold:1}};out.fold=filmKeyBase('thumb')===k1;
      pres.sections={sa:{name:'A',color:'#ff0000'}};
      out.secColour=filmKeyBase('thumb')!==k1;
      delete pres.sections;
      // the figures are counted per row (filmRefGens), not for the deck
      deckViewGen++;viewGens.all=++viewGens.n;
      out.figsNotHere=filmKeyBase('thumb')===k0;
      // the size, the view and the mode are
      miniHNow=80;out.size=filmKeyBase('thumb')!==k0;miniHNow=66;
      out.view=filmKeyBase('head')!==k0;
      mode='create';out.mode=filmKeyBase('thumb')!==k0;mode='edit';
      // a row key is its thumbnail key plus its place
      var s={layout:'blank',annots:[{k:'text',text:'a'}]};
      var rk=filmRowKey(k0,s,2,'0,1,,'),tk=filmThumbKey(k0,s,2);
      out.split=rk.slice(0,rk.lastIndexOf('\u0002'))===tk;
      out.slide=filmThumbKey(k0,{layout:'blank',annots:[{k:'text',text:'b'}]},2)!==tk;
      out.ordinal=filmThumbKey(k0,s,3)!==tk;
      // and a figure's count is in its slide's key
      var f={layout:'blank',annots:[{k:'cell',ref:'nb::f1'}]},fk=filmThumbKey(k0,f,2);
      viewGens.of.nb=++viewGens.n;out.figCount=filmThumbKey(k0,f,2)!==fk;
      out.noFigNoCount=filmThumbKey(k0,s,2)===tk;
      console.log(JSON.stringify(out));
    """)
    assert all(got.values()), got


_ROW = r"""
var cur=4,filled=[];
function filmFill(ph){filled.push(ph.id);}
function El(){this.cls={};this.dataset={};this.n={textContent:'1'};this._ph=null;
  var me=this;this.classList={contains:function(c){return !!me.cls[c];},
    toggle:function(c,on){me.writes=(me.writes||0)+1;
      if(on) me.cls[c]=1; else delete me.cls[c];}};}
El.prototype.querySelector=function(){return this.n;};
"""


def test_a_kept_row_is_brought_up_to_date_and_nothing_else():
    got = _run(_ROW, ("filmRowMoved",), r"""
      var out={};
      var r=new El();r.dataset.idx='7';r.n.textContent='7';
      filmRowMoved(r,7,7);out.untouched=[r.writes||0,r.dataset.idx,r.n.textContent];
      filmRowMoved(r,9,8);
      out.moved=[String(r.dataset.idx),String(r.n.textContent),!!r.cls.current];
      var v=new El();v.dataset.idx='5';v.n.textContent='x';
      /* a version keeps its bullet */
      filmRowMoved(v,6,null);out.version=v.n.textContent;
      var c=new El();c.dataset.idx='3';c._ph={id:'box'};
      filmRowMoved(c,4,4);out.current=[!!c.cls.current,filled.join()];
      filmRowMoved(c,5,5);out.left=!!c.cls.current;
      console.log(JSON.stringify(out));
    """)
    assert got["untouched"] == [0, "7", "7"]
    assert got["moved"] == ["9", "8", False]
    assert got["version"] == "x"
    assert got["current"] == [True, "box"]
    assert got["left"] is False


_COPY = r"""
var deckViewGen=1,miniHNow=66,mode='edit',pres={name:'d',slides:[]};
var filmRows=new Map(),viewGens={n:0,all:0,of:Object.create(null)},ITEMS={};
function flipFrames(a){return (a&&Array.isArray(a.frames))?a.frames:[];}
function activeCut(){return '';}
function filmMode(){return 'thumb';}
function sectionRuns(){return [{id:'',at:0,n:3}];}
function Thumb(name,opts){this.name=name;this.opts=opts||{};
  var me=this;
  this.classList={contains:function(c){return c==='mini-lazy'&&!!me.opts.lazy;}};}
Thumb.prototype.querySelector=function(q){return q==='[id]'&&this.opts.ids?{}:null;};
Thumb.prototype.cloneNode=function(){return {copyOf:this.name};};
function Row(key,thumb){this._key=key;this.t=thumb;}
Row.prototype.querySelector=function(){return this.t;};
"""


def test_the_sorter_copies_only_a_thumbnail_drawn_from_what_the_slide_is_now():
    got = _run(_COPY, ("filmKeyBase", "filmThumbKey", "filmRowKey",
                       "filmThumbSource", "filmRefGens", "refViewGen",
                       "filmSecOrds"), r"""
      var base=filmKeyBase('thumb');
      function sl(t){return {layout:'blank',annots:[{k:'text',text:t}]};}
      var a=sl('a'),b=sl('b'),c=sl('c'),
          g={layout:'blank',annots:[{k:'rect',grad:1}]},
          fig={layout:'blank',annots:[{k:'cell',ref:'nb::f1'}]};
      function put(s,t,stale){var k=filmRowKey(base,s,'','0,0,,');
        var r=new Row(stale?null:k,t);
        filmRows.set(k,[r]);}
      put(a,new Thumb('A'));
      put(b,new Thumb('B',{lazy:1}));        /* not drawn yet */
      put(c,new Thumb('C'),true);            /* redrawn since it was filed */
      put(g,new Thumb('G',{ids:1}));         /* a gradient: ids in it */
      put(fig,new Thumb('F'));
      var copy=filmThumbSource(),out={};
      out.a=copy(a);out.b=copy(b);out.c=copy(c);out.g=copy(g);out.fig=copy(fig);
      a.annots[0].text='a2';out.edited=copy(a);
      /* its notebook reloaded: the figure's picture is not copied, the
         words are */
      viewGens.of.nb=++viewGens.n;copy=filmThumbSource();
      out.figs=copy(fig);out.words=copy(sl('b2'))===null&&!!copy(sl('a'));
      console.log(JSON.stringify(out));
    """)
    assert got["a"] == {"copyOf": "A"}
    assert got["b"] is None and got["c"] is None and got["g"] is None
    assert got["fig"] == {"copyOf": "F"}
    assert got["edited"] is None
    assert got["figs"] is None and got["words"] is True


_CARD = r"""
var deckViewGen=0,cardElMemo=new Map(),frameNodeCache={},asked=0;
function deckViewChanged(){deckViewGen++;}
function Card(anchor){this.a=anchor;this.isConnected=true;}
Card.prototype.getAttribute=function(){return this.a;};
var shellEl={querySelector:function(q){asked++;var m=/data-anchor="([^"]+)"/.exec(q);
  return (m&&cards[m[1]])||null;}};
var cards={f1:new Card('f1'),f2:new Card('f2')};
var APP={shells:{nb:{el:shellEl}}};
function resolveRef(ref){var p=String(ref).split('::');
  return p[1]?{nb:p[0],anchor:p[1]}:null;}
"""


def test_a_card_is_looked_up_once_and_only_while_the_answer_holds():
    got = _run(_CARD, ("cardEl", "dropFrameCache"), r"""
      var out={};
      var e1=cardEl('nb::f1'),e2=cardEl('nb::f1');
      out.once=[e1===cards.f1,e2===e1,asked];
      cards.f1.isConnected=false;cards.f1=new Card('f1');   /* the card re-rendered */
      out.reconnect=[cardEl('nb::f1')===cards.f1,asked];
      cardEl('nb::f1');out.kept=asked;
      /* a remount, a close, a copy stored: ask again, and hold nothing */
      dropFrameCache('nb');out.emptied=[cardElMemo.size,deckViewGen];
      cardEl('nb::f1');out.figs=asked;
      cardEl('nb::zz');cardEl('nb::zz');out.missAsksEachTime=asked;
      shellEl={querySelector:shellEl.querySelector};APP.shells.nb={el:shellEl};
      cardEl('nb::f1');out.newShell=asked;
      console.log(JSON.stringify(out));
    """)
    assert got["once"] == [True, True, 1]
    assert got["reconnect"] == [True, 2]
    assert got["kept"] == 2
    assert got["emptied"] == [0, 1]
    assert got["figs"] == 3
    assert got["missAsksEachTime"] == 5
    assert got["newShell"] == 6


# ------------------------------------------------------------ source pins

def test_the_card_memo_exists_before_the_saved_decks_are_read():
    """cardEl's memo is emptied by dropFrameCache, which normPres reaches
    through embStore at EVAL time (T133): declared beside frameNodeCache,
    with its value, or the first copy stored throws and takes the whole
    deck IIFE with it."""
    src = assets.deck_js()
    decl = src.index("  var cardElMemo=new Map();")
    assert decl < src.index("\n  var projectPres=")
    assert decl < src.index("  function normPres(")
    drop = src[src.index("  function dropFrameCache(stemOrRef){"):]
    drop = drop[:drop.index("if(stemOrRef==null)")]
    assert "deckViewChanged(stemOrRef);" in drop and "cardElMemo.clear();" in drop


def test_a_figure_that_changed_redraws_the_rows_that_show_it():
    """What a figure is drawn from is counted by deckViewGen (the switch
    package's: dropFrameCache, registerShell, unregisterShell and a
    version's card bump it) and, beside it, where (viewGens): a row's key
    holds the counts of ITS figures, so a deck resumed after a notebook was
    reloaded behind it draws those figures afresh and keeps the rest; the
    strip's stamp holds the deck-wide count, so the next slide change
    looks."""
    film = _part("55-sections-and-strip")
    base = film[film.index("  function filmKeyBase(fv){"):]
    base = base[:base.index("\n  }\n")]
    assert "return [miniHNow,fv,mode,activeCut()||''," in base
    thumb = film[film.index("  function filmThumbKey(base,s,sord){"):]
    assert "+'\\u0001'+filmRefGens(s);" in thumb[:200]
    stamp = film[film.index("  function filmStampKey(){"):]
    assert "lateFrom,filmGen,deckViewGen," in stamp[:600]
    decks = _part("10-decks")
    for fn, call in (("  function registerShell(stem,data){", "deckViewChanged(stem);"),
                     ("  function unregisterShell(stem){", "deckViewChanged(stem);"),
                     ("  function dropFrameCache(stemOrRef){",
                      "deckViewChanged(stemOrRef);")):
        assert call in decks[decks.index(fn):][:400], fn
    # declared where dropFrameCache can reach it at eval time (T133)
    src = assets.deck_js()
    decl = src.index("  var viewGens={n:0,all:0,of:Object.create(null)};")
    assert decl < src.index("\n  var projectPres=")


_GENS = r"""
var deckViewGen=0,viewGens={n:0,all:0,of:Object.create(null)};
var ITEMS={'nb::slug':{ns:'nb::a1'},'nb::a1':{ns:'nb::a1'}};
function flipFrames(a){return (a&&Array.isArray(a.frames))?a.frames:[];}
"""


def test_a_change_counts_for_the_figures_it_reaches_and_no_other():
    got = _run(_GENS, ("deckViewChanged", "refViewGen", "filmRefGens"), r"""
      function cell(r){return {k:'cell',ref:r};}
      var S={fig:{annots:[cell('nb::a1')]},other:{annots:[cell('other::b')]},
        words:{annots:[{k:'text',text:'x'}]},title:{layout:'title'},
        flip:{annots:[{k:'flip',frames:[{ref:'nb::a2'},{src:'data:x'}]}]},
        alias:{annots:[cell('nb::slug')]},bare:{annots:[cell('a1')]},
        hidden:{annots:[{k:'cell',ref:'nb::a1',hide:1}]}};
      function sigs(){var o={};Object.keys(S).forEach(function(k){
        o[k]=filmRefGens(S[k]);});return o;}
      function moved(a,b){return Object.keys(a).filter(function(k){
        return a[k]!==b[k];}).sort().join(',');}
      var out={},k0=sigs();
      out.none=[k0.words,k0.title];
      deckViewChanged('nb');var k1=sigs();out.stem=moved(k0,k1);
      deckViewChanged('nb::a1');var k2=sigs();out.card=moved(k1,k2);
      deckViewChanged('other::b');var k3=sigs();out.other=moved(k2,k3);
      deckViewChanged('nb::a2');var k4=sigs();out.frame=moved(k3,k4);
      deckViewChanged();var k5=sigs();out.all=moved(k4,k5);
      out.stillMoves=deckViewGen;
      console.log(JSON.stringify(out));
    """)
    assert got["none"] == ["", ""]
    # a notebook: every figure of it, however it is named
    assert got["stem"] == "alias,bare,fig,flip,hidden"
    # one card: as written, as its notebook files it, and a bare anchor
    assert got["card"] == "alias,bare,fig,hidden"
    assert got["other"] == "bare,other"
    assert got["frame"] == "bare,flip"
    assert got["all"] == "alias,bare,fig,flip,hidden,other"
    assert got["stillMoves"] == 5


def test_a_row_reads_its_place_off_the_row():
    """A kept row can stand somewhere else after an add, a delete or a
    drag: its handlers must never use the build loop's `i`."""
    film = _part("55-sections-and-strip")
    body = film[film.index("  function renderFilm(){"):
                film.index("  function filmKeepCurrent(list){")]
    assert "openFilmMenu(+row.dataset.idx,ev,null);" in body
    assert "var at=+row.dataset.idx;   /* a kept row can stand anywhere now */" in body
    assert "draggingSlide=at;" in body and "'slide-'+at" in body
    assert "if(slideMatchHit(at)) return;" in body
    assert "cur=at;activePane=-1;selAnnot=null;selSet=[];refreshNav();" in body
    for gone in ("openFilmMenu(i,ev,null)", "draggingSlide=i;",
                 "if(slideMatchHit(i)) return;", "cur=i;activePane=-1;"):
        assert gone not in body


def test_what_redraws_a_row_outside_a_build_unfiles_it():
    decks = _part("10-decks")
    thumb = decks[decks.index("  function refreshThumb(i){"):]
    assert thumb.index("row._key=null;") \
        < thumb.index("replaceChild(miniDiagram(s),old)")
    assert "filmUnlazy(row);" in thumb[:2000]
    film = _part("55-sections-and-strip")
    sync = film[film.index("  function syncFilmBuild(i){"):]
    assert "row._key=null;" in sync[:400]
    fill = film[film.index("  function filmFill(ph){"):]
    assert "if(JSON.stringify(s)!==row._js) row._key=null;" in fill[:1200]


def test_the_current_slide_is_always_drawn():
    film = _part("55-sections-and-strip")
    assert "lbl.appendChild((!lazy||Math.abs(i-cur)<=FILM_NEAR)?miniDiagram(s)" in film
    assert "if(on&&row._ph) filmFill(row._ph);" in film
    mark = film[film.index("  function filmMoveMark(list){"):]
    assert "if(row._ph) filmFill(row._ph);" in mark[:2500]


def test_a_box_fills_in_what_a_drawing_would():
    """A thumbnail of a title slide fills in its title's defaults
    (titleProps): the box does too, so the saved deck is the same whether
    or not a thumbnail has been drawn yet -- and drawing a box leaves the
    slide '@section' colours resolve against where it was (T316)."""
    film = _part("55-sections-and-strip")
    box = film[film.index("  function filmLazyBox(s,row,list){"):]
    assert "if(s.layout==='title'){titleProps(s,'t');titleProps(s,'s');}" in box[:900]
    fill = film[film.index("  function filmFill(ph){"):]
    assert "var paintWas=paintSlide;" in fill[:900]
    assert "finally{paintSlide=paintWas;}" in fill[:900]
    ovw = _part("50-review-and-overview")
    tile = ovw[ovw.index("  function ovwThumb(sl,i,copyOf,body){"):]
    assert "if(sl&&sl.layout==='title'){titleProps(sl,'t');titleProps(sl,'s');}" \
        in tile[:1800]
    assert "finally{paintSlide=paintWas;}" in tile[:1800]


def test_the_sorter_draws_with_the_strip_and_draws_what_it_must():
    ovw = _part("50-review-and-overview")
    draw = ovw[ovw.index("    function draw(){"):]
    assert "var copyOf=filmThumbSource();" in draw[:400]
    assert "tile.appendChild(ovwThumb(sl,i,copyOf,body));" in draw[:4000]
    tile = ovw[ovw.index("  function ovwThumb(sl,i,copyOf,body){"):]
    assert "var c=copyOf(sl);" in tile[:300]
    assert "return miniDiagram(sl);" in tile[:500]
    close = ovw[ovw.index("  function overviewClose(){"):]
    assert "if(ovwIO){ovwIO.disconnect();ovwIO=null;}" in close[:300]


def test_opening_a_file_draws_the_editor_once():
    """critic #1b: openDeck has drawn the strip and the slide (setUIMode)
    and named it in the URL, so importDeckText's refresh after it drew both
    a second time -- 170-610 ms at 4x on Create slides and File > Open. An
    editor that was already open is still drawn."""
    save = _part("60-saving-and-export")
    imp = save[save.index("  function importDeckText(txt,silent,choice){"):]
    imp = imp[:imp.index("    if(first.kept)\n      toast(")]
    assert ("    var wasHidden=deckEl.hidden;\n"
            "    if(wasHidden) openDeck('edit');\n"
            "    status();\n"
            "    if(!wasHidden) refresh();") in imp
    assert "status();refresh();" not in imp


def test_a_section_turn_in_the_key_is_the_turn_its_colour_takes():
    """'@section' resolves through sectionOrdinal, which gives every RUN
    with an id a turn -- so a section split in two moves the sections
    after it along a colour, and the key has to say so, or their rows
    stay in the colour they were drawn in when normSections joins it."""
    out = _run(
        "var RUNS=[{id:'sa',at:0,n:1},{id:'',at:1,n:1},{id:'sa',at:2,n:1},"
        "{id:'sb',at:3,n:2},{id:'',at:5,n:1},{id:'sc',at:6,n:1}];\n"
        "function sectionRuns(){return RUNS;}",
        ("sectionOrdinal", "filmSecOrds"),
        "var o=filmSecOrds(RUNS);console.log(JSON.stringify("
        "['sa','sb','sc'].map(function(id){return [o[id],"
        "sectionOrdinal(id)];})));")
    assert out == [[0, 0], [2, 2], [3, 3]]
    src = _part("55-sections-and-strip")
    film = src[src.index("  function renderFilm(){"):
               src.index("  function filmKeepCurrent(list){")]
    assert "secOrd=filmSecOrds(runs)" in film
    assert "ord=filmSecOrds(sectionRuns())" in src


def test_a_box_leaves_the_trail_a_drawing_leaves():
    """A drawn thumbnail clones a placed note or output, and a flip book's
    resting frame, from the open notebook -- and a reload files that clone
    as the frame's "Previous figure". A box stands in for the drawing, so
    it takes the same clones (and only those): a live card's, once per
    card version, never a picture, a kept copy or a locked frame."""
    got = _run(r"""
var ITEMS={'nb::n1':{ns:'nb::n1'},'nb::f1':{ns:'nb::f1'},
  'nb::n2':{ns:'nb::n2'},'nb::n3':{ns:'nb::n3'},'nb::n4':{ns:'nb::n4'}};
var APP={order:['nb']};function nsKey(s,a){return s+'::'+a;}
var frameSnaps={'nb::n2':'<div></div>'},embLoaded=true,
    EMBED={'nb::n3':{html:'x'}},LIVE={'nb::n1':1,'nb::f1':1,'nb::n2':1};
function refIsLive(r){return !!LIVE[r];}
function embKeyRaw(r){return EMBED[r]?r:null;}
function cardEl(r){return ITEMS[r]?{img:r==='nb::f1'}:null;}
function $(q,c){return c&&c.img?{}:null;}
function flipFrames(a){return a.frames;}
var asked=[];function framePart(r,p){asked.push(r+':'+(p||''));}
""", ("filmPrime",), r"""
function cell(ref,x){var a={k:'cell',ref:ref};for(var k in x) a[k]=x[k];return a;}
filmPrime({annots:[
  cell('nb::n1',{part:'output'}),   /* a live note: cloned */
  cell('nb::f1'),                   /* a picture: drawn from its <img> */
  cell('nb::n2'),                   /* this card version already taken */
  cell('nb::n3'),                   /* the deck keeps its own copy */
  cell('nb::n4'),                   /* no copy yet: the live card it is */
  cell('nb::n1',{hide:1}),          /* not drawn at all */
  cell('nb::n4',{lockver:{commit:'abc'}}),
  cell('gone::x'),                  /* its notebook is not open */
  {k:'flip',at:1,frames:[{ref:'nb::f1'},{ref:'nb::f1',part:'figure'}]}
]});
var first=asked.slice();asked=[];
embLoaded=false;filmPrime({annots:[cell('nb::n4')]});   /* would fetch */
console.log(JSON.stringify({first:first,beforeCopies:asked}));
""")
    assert got["first"] == ["nb::n1:output", "nb::n4:", "nb::f1:figure"]
    assert got["beforeCopies"] == []
    src = _part("55-sections-and-strip")
    box = src[src.index("  function filmLazyBox("):
              src.index("  function filmPrime(")]
    assert "filmPrime(s);" in box
    assert "filmPrime(sl);" in _part("50-review-and-overview")
