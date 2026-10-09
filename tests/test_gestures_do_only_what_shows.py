"""Editing gestures do the work that shows, and only that (2026-10-09, speed).

The pure halves of the "gestures" speed package, run in a JS engine on the
code that ships (lifted out of the assembled editor and the notebook
shell). The browser halves -- the Style system's table drawn as it
scrolls, a held arrow key, the strip's scroll after a slide change -- are
in test_gestures_in_a_browser.py, opt-in like every Chromium check.

1. Create slides' dialog counts sections without measuring a note.
2. (Create slides' notes measured in one batch was tried and measured no
   faster -- laying out the copies costs what their content costs, in one
   pass or in eighty-eight -- so the measurer is as it was.)
3. The open text editors are a kept list; a flush asks it, not the page,
   and commits owed by a quiet input are settled first, in any mode.
4. X/Y/W/H nobody can see are owed rather than measured, paid when they
   come back into sight (a new selection pays them before its ribbon
   fit), and a value already there is not written again.
5. Counting what Arrange can act on agrees with measuring it.
6. A held arrow key moves what is drawn: items, a tied caption, a group's
   frame, the arrows, and the marker for an item that left the page.
7. Escape finds the open dialog in page order; the code-trail menus are
   found from a weak list.
8. applyZoom's stamp moves with everything a render draws from.
9. Every page of an export is measured once.
10. A slide change rebuilds the deck-colour rows only when their colours
    changed and scrolls the strip in the next frame; a drag measures every
    arrow end before drawing any; the Style system's rows share one
    typeface list.
"""

from __future__ import annotations

import json
import subprocess
import tempfile
from pathlib import Path

import pytest

from junoview import assets


def _run(src: str, names: list[str], setup: str, body: str) -> object:
    from helpers_js import js_engine, lift_fn

    engine = js_engine()
    if engine is None:
        pytest.skip("no JavaScript engine")
    command, env = engine
    functions = "\n".join(lift_fn(src, n) for n in names)
    with tempfile.TemporaryDirectory() as d:
        script = Path(d) / "run.js"
        script.write_text(setup + "\n" + functions + "\n" + body,
                          encoding="utf-8")
        r = subprocess.run(command + [str(script)], env=env,
                           capture_output=True, text=True, encoding="utf-8",
                           timeout=60)
        assert r.returncode == 0, r.stderr[:3000]
        return json.loads(r.stdout.strip().splitlines()[-1])


DECK = None


def _deck() -> str:
    global DECK
    if DECK is None:
        DECK = assets.deck_js()
    return DECK


# ---- 1. the dialog counts --------------------------------------------------

def test_create_slides_dialog_counts_without_measuring():
    setup = """
var metrics=0,flushed=0,scanned=0;
function autoItemMetrics(){metrics++;return {words:1};}
function plotFlush(){flushed++;}
function $$(){scanned++;return [];}
function markOf(stem,id){return {p:id==='b'};}
var APP={shells:{demo:{el:{dataset:{path:'p'}},data:{title:'Demo',
  sections:[{id:'s1',title:'One'},{id:'s2',title:'Two'},{id:'s3',title:'Code only'}],
  items:[{anchor:'a',card:'a',kind:'note',section:'s1'},
    {anchor:'b',card:'b',kind:'figure',section:'s2'},
    {anchor:'c',card:'c',kind:'code',section:'s3'}]}}}};
"""
    body = """
var out={};
['all','section','marks'].forEach(function(sc){
  var sid=sc==='section'?'s2':'';
  metrics=0;flushed=0;scanned=0;
  var c=autoPlan('demo',sc,sid,true);
  var counted={n:c.sections.length,metrics:metrics,flushed:flushed,scanned:scanned};
  var f=autoPlan('demo',sc,sid);
  out[sc]={counted:counted,full:f.sections.length,
    refs:c.sections.map(function(s){
      return s.items.map(function(i){return i.ref;});}),
    fullRefs:f.sections.map(function(s){
      return s.items.map(function(i){return i.ref;});})};
});
console.log(JSON.stringify(out));
"""
    r = _run(assets.app_js(), ["autoPlan"], setup, body)
    for sc, v in r.items():
        assert v["counted"]["n"] == v["full"], sc
        assert v["refs"] == v["fullRefs"], sc
        assert v["counted"]["metrics"] == 0, sc
        assert v["counted"]["flushed"] == 0, sc
        assert v["counted"]["scanned"] == 0, sc
    assert r["all"]["full"] == 2 and r["section"]["full"] == 1
    assert r["marks"]["full"] == 1


def test_the_dialog_summary_asks_for_a_count():
    app = assets.app_js()
    i = app.index("function autoSlidesDialogSummary(")
    assert ",true);" in app[i:i + 600]


# ---- 3. the open editors -----------------------------------------------------

_LIVE_SETUP = """
var liveEds=new Set(),quietOwed=[],mode='edit';
function Ed(name,ce){this.name=name;this.isConnected=true;this.ce=ce;
  var self=this;this.__jvFlush=function(){log.push(self.name);};}
Ed.prototype.getAttribute=function(k){return k==='contenteditable'?this.ce:null;};
var log=[];
var document={querySelectorAll:function(){throw new Error('page scanned');}};
"""


def test_a_flush_commits_the_open_editors_and_only_them():
    body = """
var a=new Ed('a','true'),b=new Ed('b','plaintext-only'),c=new Ed('c','false'),
    d=new Ed('d','true');
[a,b,c,d].forEach(liveEdOn);
d.isConnected=false;           /* rendered away without a blur */
flushTextEdits();
var first=log.slice();log=[];
liveEdOff(a);flushTextEdits();
var second=log.slice();log=[];
mode='view';flushTextEdits();
var third=log.slice();
console.log(JSON.stringify({first:first,second:second,third:third,
  kept:Array.from(liveEds).map(function(e){return e.name;}),
  live:liveEditors().map(function(e){return e.name;})}));
"""
    r = _run(_deck(), ["liveEdOn", "liveEdOff", "liveEditors", "quietOwe",
                       "quietPaid", "quietSettle", "flushTextEdits"],
             _LIVE_SETUP, body)
    assert r["first"] == ["a", "b"]
    assert r["second"] == ["b"]
    assert r["third"] == []          # nothing is typed into a talk
    assert "d" not in r["kept"]      # gone from the page, gone from the list
    assert r["live"] == ["b"]


def test_owed_quiet_commits_are_settled_by_any_flush():
    # ...any flush outside a view-mode render: those borrow cur, the
    # selection or another deck (a print page, the presenter's previews,
    # a History thumbnail, a ghost slide), so what is owed waits for the
    # real moment rather than being counted against a borrowed one
    body = """
var paid=[];
function owe1(){quietPaid(owe1);paid.push(1);}
function owe2(){quietPaid(owe2);paid.push(2);}
quietOwe(owe1);quietOwe(owe1);quietOwe(owe2);
mode='view';
flushTextEdits();
var borrowed=paid.slice();
mode='edit';
flushTextEdits();
var once=paid.slice();
flushTextEdits();
console.log(JSON.stringify({borrowed:borrowed,once:once,again:paid,
  left:quietOwed.length}));
"""
    r = _run(_deck(), ["liveEdOn", "liveEdOff", "liveEditors", "quietOwe",
                       "quietPaid", "quietSettle", "flushTextEdits"],
             _LIVE_SETUP, body)
    assert r["borrowed"] == []
    assert r["once"] == [1, 2]
    assert r["again"] == [1, 2]
    assert r["left"] == 0
    # a draft flushed now -- a deck switch flushes the outgoing deck's
    # before it changes `pres` -- counts what is owed first (a switch by
    # address blurs nothing)
    src = _deck()
    body = src[src.index("function flushDraftWrite(){"):][:600]
    assert body.index("quietSettle();") < body.index("writeDraftNow();")
    for fn in ("function loadPresentation(name){",
               "function loadPresentationObj(np){"):
        assert src[src.index(fn):][:120].count("flushDraftWrite();") == 1


def test_no_page_wide_editor_scans_are_left():
    import re
    src = _deck()
    scans = re.findall(r"document\.querySelector(?:All)?\(\s*'\[contenteditable",
                       src)
    assert not scans, scans
    i = src.index("function filmMoveMark(")
    assert "liveEditors().length" in src[i:i + 1500]


def test_notes_typing_owes_its_markdirty_and_the_blur_pays_it():
    src = _deck()
    i = src.index("var notesT=null,notesPres=null;")
    seg = src[i:i + 1400]
    assert "notesT=setTimeout(notesDirty,300);" in seg
    assert "quietOwe(notesDirty);" in seg
    assert "if(!notesT){" in seg          # a timer, not a debounce
    blur = seg.index("addEventListener('blur'")
    assert "if(notesT) notesDirty();" in seg[blur:blur + 200]


# ---- 4. X/Y/W/H --------------------------------------------------------------

_GEO_SETUP = """
var writes=0,measured=0;
function Field(id){this.id=id;this._v='';this._d=false;
  this.parentElement=null;this.hidden=false;}
Object.defineProperty(Field.prototype,'value',{get:function(){return this._v;},
  set:function(v){writes++;this._v=String(v);}});
Object.defineProperty(Field.prototype,'disabled',{get:function(){return this._d;},
  set:function(v){writes++;this._d=!!v;}});
Field.prototype.hasAttribute=function(k){return !!(this.attrs&&this.attrs[k]);};
function Box(){this.hidden=false;this.parentElement=null;this.attrs={};}
Box.prototype.hasAttribute=function(k){return !!this.attrs[k];};
var deckEl=new Box(),pane=new Box(),grp=new Box(),cell=new Box();
pane.hidden=true;pane.parentElement=deckEl;
grp.parentElement=deckEl;cell.parentElement=grp;
var F={};
['w','h','x','y'].forEach(function(k){
  F['#sz-'+k]=new Field('sz-'+k);F['#sz-'+k].parentElement=pane;
  F['#rb-'+k]=new Field('rb-'+k);F['#rb-'+k].parentElement=cell;});
var document={body:{},activeElement:null};
function $(s){return F[s]||null;}
var geoWatch={};          /* the watcher is booted */
var GEO_HOSTS=['#sz-','#rb-'];
var subject={k:'rect',x:10,y:20,w:30,h:40};
function sizeSubject(){return subject;}
function sizeRect(a){measured++;return {l:a.x,t:a.y,r:a.x+a.w,b:a.y+a.h};}
function lockedAll(){return false;} function pinned(){return false;}
function pctMm(v){return v*2;}
var ANCHORS={};
"""


def test_numbers_nobody_can_see_are_owed_not_measured():
    body = """
var out={};
grp.attrs['data-off']='1';          /* another tab's group */
sizePaneSync();
out.hidden={measured:measured,writes:writes,owed:geoOwed};
grp.attrs={};                       /* the Object tab comes up */
measured=0;writes=0;
geoPay();                           /* showFmt pays at once */
out.shown={measured:measured,owed:geoOwed,x:F['#rb-x'].value,w:F['#rb-w'].value};
var w1=writes;writes=0;
sizePaneSync();                     /* nothing changed */
out.same={writes:writes,first:w1};
subject.x=11;writes=0;sizePaneSync();
out.moved={writes:writes,x:F['#rb-x'].value};
cell.hidden=true;measured=0;sizePaneSync();
out.cellHidden={measured:measured,owed:geoOwed};
console.log(JSON.stringify(out));
"""
    r = _run(_deck(), ["geoEach", "geoHiddenField", "geoInSight", "geoSet",
                       "geoPay", "sizePaneSync"],
             _GEO_SETUP + "var geoOwed=false;", body)
    assert r["hidden"] == {"measured": 0, "writes": 0, "owed": True}
    assert r["shown"]["measured"] == 1 and r["shown"]["owed"] is False
    assert r["shown"]["x"] == "20" and r["shown"]["w"] == "60"
    assert r["same"]["writes"] == 0 and r["same"]["first"] > 0
    assert r["moved"]["writes"] == 2      # the X in the pane and the ribbon
    assert r["moved"]["x"] == "22"
    assert r["cellHidden"] == {"measured": 0, "owed": True}


def test_the_watcher_is_booted_with_the_editor_tools():
    src = _deck()
    i = src.index("function initEditorTools(")
    assert "geoWatchBoot();" in src[i:i + 4000]
    # the watcher's callback is the same payment the fitting paths make
    w = src[src.index("function geoWatchBoot("):]
    assert "if(geoOwed&&geoInSight()) sizePaneSync();" in w[:400]


def test_a_new_selection_pays_the_fields_before_the_ribbon_is_fitted():
    """showFmt unhides the X/Y/W/H cells itself, after syncInspectorPanes
    found them hidden; it fills them before its own ribbon fit."""
    src = _deck()
    show = src[src.index("function showFmt("):]
    show = show[:show.index("\n  function ")]
    tail = show[show.index("syncOptDoors();"):]
    assert (tail.index("geoPay()")
            < tail.index("if(wantTab) setTab(wantTab,true); "
                         "else syncRibbonGroups();"))


# ---- 5. counting what Arrange acts on ---------------------------------------

def test_counting_agrees_with_measuring():
    setup = """
function El(i){this.i=i;this.classList={contains:function(){return false;}};}
El.prototype.getBoundingClientRect=function(){
  return {left:10,right:50,top:10,bottom:30,width:40,height:20};};
var drawn={};
var layer={querySelector:function(s){var m=/data-idx="(\\d+)"/.exec(s);
    if(s==='.annot-layer') return layer;
    return m&&drawn[m[1]]?drawn[m[1]]:null;},
  getBoundingClientRect:function(){return {left:0,top:0,width:100,height:100};}};
var stage={querySelector:function(){return layer;}};
function anchorPos(a){return {x:a.x||0,y:a.y||0};}
function lockedAll(a){return a.lock==='all';}
function pinned(a){return !!a.lock;}
var cur=0,pres,selSet;
"""
    body = """
var kinds=[
  {k:'rect',x:1,y:1,w:5,h:5},
  {k:'arrow',x1:0,y1:0,x2:1,y2:1},
  {k:'text',x:1,y:1,w:20},
  {k:'text',x:1,y:1,w:20,fh:9},
  {k:'text',x:1,y:1},
  {k:'rect',x:1,y:1,w:5,h:5,hide:1},
  {k:'rect',x:1,y:1,w:5,h:5,lock:'pos'},
  {k:'rect',x:1,y:1,w:5,h:5,lock:'all'},
  {k:'cell',x:1,y:1,w:5}];
var bad=[];
for(var mask=0;mask<512;mask+=7){
  for(var dmask=0;dmask<512;dmask+=37){
    var sel=[],an=[];drawn={};
    kinds.forEach(function(k,i){an.push(k);if(mask&(1<<i))sel.push(i);
      if(dmask&(1<<i))drawn[i]=new El(i);});
    pres={slides:[{annots:an}]};selSet=sel.concat(['t']);
    [false,true].forEach(function(so){
      var a=selRects(so).length,b=selRectCount(so);
      if(a!==b) bad.push([mask,dmask,so,a,b]);});
  }
}
console.log(JSON.stringify(bad));
"""
    r = _run(_deck(), ["annotRectPct", "selRects", "selRectCount"], setup,
             body)
    assert r == []


def test_the_two_count_only_callers_count():
    src = _deck()
    i = src.index("function arrangeMenuSync(")
    assert "var n=selRectCount();" in src[i:i + 300]
    assert "show('#fmt-samewrap',selRectCount(true)>=2);" in src


# ---- 6. a held arrow key ----------------------------------------------------

_NUDGE_SETUP = """
function Cls(){this.s={};}
Cls.prototype.toggle=function(c,on){if(on)this.s[c]=1;else delete this.s[c];};
function Item(i,l,t){this.i=i;this.style={left:l+'%',top:t+'%'};
  this.classList=new Cls();}
var items={},frame=null,redrawn=0,mode='edit';
var l={querySelector:function(s){
    if(s==='.an-grpframe') return frame;
    if(s==='.an-item.an-offpage'){for(var k in items)
      if(items[k].classList.s['an-offpage']) return items[k];return null;}
    return null;}};
function $$(s,r){var m=/data-idx="(\\d+)"/.exec(s);
  return m&&items[m[1]]?[items[m[1]]]:[];}
function redrawArrows(){redrawn++;}
var painted=0;function paintSel(){painted++;}
var stage={classList:new Cls()};
function annotRectPct(layer,s,i){var a=s.annots[i];
  return {l:a.x,t:a.y,r:a.x+(a.w||0),b:a.y+(a.h||0)};}
"""


def test_a_held_arrow_key_moves_what_is_drawn():
    body = """
var s={annots:[{k:'rect',x:10,y:10,w:10,h:10},{k:'text',x:10,y:21,w:10,capOf:'f'},
  {k:'rect',x:50,y:50,w:10,h:10},{k:'arrow',x1:0,y1:0,x2:5,y2:5,c1:{i:0},c2:{i:2}},
  {k:'rect',x:95,y:5,w:4,h:4}]};
items={0:new Item(0,10,10),1:new Item(1,10,21),2:new Item(2,50,50),4:new Item(4,95,5)};
frame={style:{left:'9%',top:'9%'}};
var before=s.annots.map(nudgeSpot);
/* the figure and its caption moved by the model (shiftAnnot), and the
   box at the edge */
s.annots[0].x+=0.4;s.annots[1].x+=0.4;s.annots[4].x+=2.5;
var ok=nudgeLight(s,l,before,0.4,0);
var out={ok:ok,left:[items[0].style.left,items[1].style.left,items[2].style.left],
  frame:frame.style.left,redrawn:redrawn,off:Object.keys(items[4].classList.s),
  spill:Object.keys(stage.classList.s)};
/* an item with nothing drawn for it takes the full render */
delete items[2];var b2=s.annots.map(nudgeSpot);s.annots[2].x+=1;
out.fallback=nudgeLight(s,l,b2,1,0);
/* a group's frame with no arrow on the slide: drawn again round the
   members (paintSel), never the old frame moved -- a member locked in
   place does not move with the rest */
var s3={annots:[{k:'rect',x:10,y:10,w:10,h:10}]};
items={0:new Item(0,10,10)};
var b3=s3.annots.map(nudgeSpot);s3.annots[0].x+=0.4;
var p0=painted;nudgeLight(s3,l,b3,0.4,0);out.framePaint=painted-p0;
console.log(JSON.stringify(out));
"""
    r = _run(_deck(), ["nudgeLight", "nudgeSpot"], _NUDGE_SETUP, body)
    assert r["ok"] is True
    assert r["left"] == ["10.4%", "10.4%", "50%"]
    # the frame is redrawn, not translated: by redrawArrows' live path
    # when the slide has arrows, by paintSel when it has none
    assert r["frame"] == "9%"
    assert r["framePaint"] == 1
    assert r["redrawn"] == 1
    assert r["off"] == ["an-offpage"] and r["spill"] == ["spill"]
    assert r["fallback"] is False


def test_the_held_key_path_is_the_keyboard_one():
    src = _deck()
    i = src.index("function nudgeSel(")
    seg = src[i:i + 1200]
    assert "if(quiet) before=" in seg
    assert "if(before&&nudgeLight(s,l,before,dx,dy)) return;" in seg
    # the drag and the held key redraw the arrows without a paintSel
    assert "redrawArrows(layer,s,true);" in src


# ---- 7. Escape's dialog, the code-trail menus --------------------------------

def test_escape_finds_the_first_open_dialog_in_page_order():
    setup = """
var Node={DOCUMENT_POSITION_FOLLOWING:4};
function D(id,pos,hidden){this.id=id;this.pos=pos;this.isConnected=true;this.h=hidden;}
D.prototype.hasAttribute=function(k){return k==='hidden'&&this.h;};
D.prototype.compareDocumentPosition=function(o){return o.pos>this.pos?4:2;};
var list=[new D('eq',3,false),new D('ask',9,false),new D('aa',1,true),
  new D('ts',5,false)];
var scans=0;
function $$(){scans++;return list.slice();}
var escDlgs=null;
"""
    body = """
var a=escDlgUp().id;
list[1].pos=0;                 /* the question box moved to the front */
var b=escDlgUp().id;
list.forEach(function(d){d.h=true;});
var c=escDlgUp();
list[0].isConnected=false;     /* one left the page: asked again */
escDlgUp();
console.log(JSON.stringify({a:a,b:b,c:c,scans:scans}));
"""
    r = _run(_deck(), ["escDlgUp"], setup, body)
    assert r == {"a": "eq", "b": "ask", "c": None, "scans": 2}


def test_code_trail_menus_are_kept_weakly():
    setup = "var voMenus=[];"
    body = """
var m1={isConnected:true},m2={isConnected:false},m3={isConnected:true};
voMenuKeep(m1);voMenuKeep(m2);voMenuKeep(m3);
var live=voMenusLive();
m2.isConnected=true;           /* built before its view was on the page */
var later=voMenusLive();
console.log(JSON.stringify({live:live.length,later:later.length,kept:voMenus.length}));
"""
    r = _run(_deck(), ["voMenuKeep", "voMenusLive"], setup, body)
    assert r == {"live": 2, "later": 3, "kept": 3}


# ---- 8. applyZoom's stamp ---------------------------------------------------

def test_the_zoom_stamp_moves_with_what_a_render_draws_from():
    setup = """
var mode='edit',tool='select',deckGen=1,deckViewGen=0,selAnnot=null,selSet=[],
  inGroup=null;
function privShown(){return false;}
var s0={},s1={};var pres={slides:[s0,s1]};
var slide={style:{width:'740px',height:'416px'}};
"""
    body = """
var base=zoomStamp(slide,s0),out={};
function moved(name,fn,undo){fn();out[name]=zoomStamp(slide,s0)!==base;undo();}
moved('width',function(){slide.style.width='741px';},function(){slide.style.width='740px';});
moved('height',function(){slide.style.height='417px';},function(){slide.style.height='416px';});
moved('mode',function(){mode='view';},function(){mode='edit';});
moved('edit',function(){deckGen++;},function(){deckGen--;});
moved('view',function(){deckViewGen++;},function(){deckViewGen--;});
moved('sel',function(){selAnnot=2;},function(){selAnnot=null;});
moved('set',function(){selSet=[1,2];},function(){selSet=[];});
moved('tool',function(){tool='text';},function(){tool='select';});
out.same=zoomStamp(slide,s0)===base;
out.slide=zoomStamp(slide,s1)!==base;
console.log(JSON.stringify(out));
"""
    r = _run(_deck(), ["zoomStamp"], setup, body)
    assert all(r.values()), r


def test_apply_zoom_renders_only_when_the_stamp_moved():
    src = _deck()
    i = src.index("function applyZoom(")
    seg = src[i:i + 4000]
    assert "l0._zoomStamp!==zoomStamp(slideEl,s0)" in seg
    j = src.index("function renderAnnots(")
    seg2 = src[j:j + 400]
    assert "layer._zoomStamp=null;" in seg2
    assert "zoomStampMark(layer,s);" in seg2  # (guarded for lifted harnesses)


# ---- 9. an export's pages ---------------------------------------------------

def test_every_page_of_an_export_is_measured_once():
    setup = """
var gets=0;
function L(inRoot){this.inRoot=inRoot;}
L.prototype.getBoundingClientRect=function(){gets++;return {height:720};};
var root={contains:function(l){return l.inRoot;}};
var printPageH=null;
"""
    body = """
printPageH={root:root,h:0};
var pages=[];for(var i=0;i<60;i++){var l=new L(true);l._hPass={h:0};
  pages.push(layerH(l));pages.push(layerH(l));}
var during=gets;
printPageH=null;gets=0;
var other=new L(false);layerH(other);layerH(other);
console.log(JSON.stringify({during:during,after:gets,
  all720:pages.every(function(h){return h===720;})}));
"""
    r = _run(_deck(), ["layerH"], setup, body)
    assert r == {"during": 1, "after": 2, "all720": True}


def test_the_print_root_sets_and_clears_the_page_height():
    src = _deck()
    i = src.index("function buildPrintRoot(")
    seg = src[i:i + 6000]
    assert "printPageH={root:root,h:0};" in seg
    assert "} finally {printPageH=null;}" in seg


# ---- 10. what a slide change and a drag redraw ------------------------------

_DOM_SETUP = """
var made=0;
function El(tag){this.tag=tag;this.children=[];this.style={};this.attrs={};
  this.className='';this.parentNode=null;}
El.prototype.appendChild=function(c){c.parentNode=this;this.children.push(c);return c;};
El.prototype.insertBefore=function(c){return this.appendChild(c);};
El.prototype.setAttribute=function(k,v){this.attrs[k]=String(v);};
El.prototype.addEventListener=function(){};
El.prototype.querySelector=function(s){
  var cls=s.replace(/^\\./,'');
  for(var i=0;i<this.children.length;i++)
    if((' '+this.children[i].className+' ').indexOf(' '+cls+' ')>=0)
      return this.children[i];
  return null;};
Object.defineProperty(El.prototype,'innerHTML',{set:function(){this.children=[];}});
var document={createElement:function(t){made++;return new El(t);}};
"""


def test_token_swatch_rows_are_rebuilt_only_when_what_they_show_changed():
    setup = _DOM_SETUP + """
var menus={'#fmt-txcol-menu':new El('div'),'#fmt-fillcol-menu':new El('div')};
function $(s){return menus[s]||null;}
var T={c:{accent:'#f00',ink:'#111'}};
function tokens(){return T;}
function tokVal(){return '#0a0';}
var pres={sections:null},TOKEN_LABELS={};
function activeTextEditable(){return false;}
function applyFillColor(){} function applyTextColor(){}
"""
    body = """
var out=[];
renderTokenSwatches();out.push(made);made=0;
renderTokenSwatches();out.push(made);made=0;          /* a slide change */
T={c:{accent:'#00f',ink:'#111'}};
renderTokenSwatches();out.push(made);made=0;          /* a deck colour */
pres.sections={a:{}};
renderTokenSwatches();out.push(made);made=0;          /* sections arrive */
var row=menus['#fmt-txcol-menu'].querySelector('.sw-tokrow');
console.log(JSON.stringify({made:out,chips:row.children.length,
  rows:menus['#fmt-txcol-menu'].children.length}));
"""
    r = _run(_deck(), ["renderTokenSwatches"], setup, body)
    # a label and two chips per menu (and the row itself the first time);
    # nothing at all when the colours are what the rows already show
    assert r["made"] == [8, 0, 6, 7]
    assert r["chips"] == 4          # label, two colours, the section chip
    assert r["rows"] == 1


def test_every_arrow_end_is_measured_before_any_arrow_is_drawn():
    setup = """
var log=[],mode='edit',AN_NS='';
var defs={},svg={},svgTop={querySelector:function(){return defs;}};
function $$(){return [];}
function privShown(){return false;}
function arrowEnds(l,s,a,i){log.push('m'+i);return {i:i};}
function layerH(l){log.push('h');return 720;}
function drawArrow(l,s,a,i){var p=l._hPass.arrows;
  log.push('d'+i+(p&&p.ends[i]&&p.ends[i].i===i?'+':'-'));}
function markPrivateItems(){}
function paintSel(){log.push('paintSel');}
function paintSelArrows(){log.push('arrowsOnly');}
function mkLayer(){return {isConnected:true,_hPass:undefined,
  querySelector:function(s){return s==='svg.an-svgtop'?svgTop:svg;},
  getBoundingClientRect:function(){log.push('lr');return {left:0,top:0};}};}
"""
    body = """
var s={annots:[{k:'rect'},{k:'arrow'},{k:'text'},{k:'arrow',hide:1},{k:'arrow'}]};
var l=mkLayer();
redrawArrows(l,s,true);
var live=log.slice(),pass=l._hPass;log=[];
redrawArrows(l,s);
console.log(JSON.stringify({live:live,full:log,pass:pass===undefined}));
"""
    r = _run(_deck(), ["redrawArrows"], setup, body)
    assert r["live"] == ["m1", "m4", "lr", "h", "d1+", "d4+", "arrowsOnly"]
    assert r["full"][-1] == "paintSel"
    assert r["pass"] is True        # the layer's own pass is put back


def test_a_slide_change_keeps_the_strip_row_in_view_in_the_next_frame():
    setup = """
var frames=[],kept=[];
function requestAnimationFrame(f){frames.push(f);return frames.length;}
function filmKeepCurrent(l){kept.push(l.id);}
var filmKeepFrame=null,filmKeepList=null;
"""
    body = """
var a={id:'a',isConnected:true},b={id:'b',isConnected:true};
filmKeepCurrentSoon(a);filmKeepCurrentSoon(b);
var asked=frames.length,now=kept.length;
frames.shift()();
var gone={id:'gone',isConnected:false};
filmKeepCurrentSoon(gone);frames.shift()();
console.log(JSON.stringify({asked:asked,now:now,kept:kept}));
"""
    r = _run(_deck(), ["filmKeepCurrentSoon"], setup, body)
    # one frame for both calls, the latest list, and none for a gone one
    assert r == {"asked": 1, "now": 0, "kept": ["b"]}
    src = _deck()
    i = src.index("function filmMoveMark(")
    assert "filmKeepCurrentSoon(list);" in src[i:i + 3000]


def test_one_typeface_list_is_copied_into_every_row():
    setup = """
var built=0,cloned=0;
function Sel(){this.children=[];this.className='';}
Sel.prototype.appendChild=function(c){this.children.push(c);};
Sel.prototype.addEventListener=function(){};
Sel.prototype.cloneNode=function(){cloned++;var c=new Sel();
  c.children=this.children.slice();return c;};
var document={createElement:function(t){built++;
  return t==='select'?new Sel():{tag:t};}};
var FONTS=[{id:'serif',label:'Serif'},{id:'mono',label:'Mono'}];
var dgFaceTpl=null;
function dgWrite(){}
"""
    body = """
var rows=[{a:{}},{a:{font:'serif'}},{a:{font:'Comic'}}];
var sels=rows.map(dgFaceCell);
console.log(JSON.stringify({built:built,cloned:cloned,
  opts:sels.map(function(s){return s.children.length;}),
  vals:sels.map(function(s){return s.value;})}));
"""
    r = _run(_deck(), ["dgFaceList", "dgFaceCell"], setup, body)
    # the template (a select, "default" and two faces) is built once, the
    # typed family name once for its own row, and each row gets a copy
    assert r["built"] == 4 + 1
    assert r["cloned"] == 3
    assert r["opts"] == [3, 3, 4]
    assert r["vals"] == ["", "serif", "Comic"]
