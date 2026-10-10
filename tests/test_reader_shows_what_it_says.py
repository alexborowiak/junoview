"""Six reader bugs found by reviewers during the 2026-10-09 speed work,
each reproduced in Chromium on 3ae56ef before it was fixed (2026-10-10).

1. The ribbon's Expand all in the Tree view threw "fillNode is not
   defined": the tree's node filler is local to buildTree.
2. Find searched the formatted feed while Raw was shown -- a count of
   matches no one could see, and Next stepping to marks with no box.
3. Opening Raw copied the cards' outputs WITH their ids (23 new duplicate
   ids on the example notebook): a label in the raw view folded the
   hidden card's xarray section instead of its own.
4. Find did not open a clamped long note: a match below the clamp was
   scrolled to inside it, or, a note not yet measured, not shown at all.
5. Reload of a notebook changed on disk put back the old scrollY on a
   page whose cards are laid out lazily: the card being read landed most
   of a screen lower (642 px half-way down the example).
6. A Plotly figure drawn into a collapsed section took Plotly's default
   700 px and kept it when the section opened (818 px wide there).

The pure halves run here, the real functions lifted out of app.js and run
in node over small stand-ins for the page. Each is also driven end to end
in Chromium by test_reader_in_the_browser.py (opt-in).
"""

from __future__ import annotations

import json
import subprocess
import tempfile
from pathlib import Path

import pytest

from helpers_js import js_engine, lift_fn
from junoview import assets


def _run(code: str):
    eng = js_engine()
    if eng is None:
        pytest.skip("no node or VS Code Electron on this machine")
    cmd, env = eng
    with tempfile.TemporaryDirectory() as d:
        p = Path(d) / "run.js"
        p.write_text(code, encoding="utf-8")
        r = subprocess.run(cmd + [str(p)], capture_output=True, text=True,
                           encoding="utf-8", env=env, timeout=60)
    assert r.returncode == 0, r.stderr[:2000]
    return json.loads(r.stdout.strip().splitlines()[-1])


def _app(*names: str) -> str:
    src = assets.app_js()
    return "\n".join(lift_fn(src, n) for n in names)


# a classList, enough of one
CL = r"""
function CL(a){var s=new Set(a||[]);return {s:s,
  contains:function(c){return s.has(c);},
  add:function(){for(var i=0;i<arguments.length;i++) s.add(arguments[i]);},
  remove:function(){for(var i=0;i<arguments.length;i++) s.delete(arguments[i]);},
  toggle:function(c,on){if(on===undefined) on=!s.has(c);
    if(on) s.add(c); else s.delete(c);return on;}};}
"""


# ------------------------------------------------------------ 1. the tree


def test_the_ribbons_expand_all_fills_with_the_trees_own_filler():
    app = assets.app_js()
    build = lift_fn(app, "buildTree")
    # the filler is the tree's own, handed over on its host...
    assert "    host._fill=fillNode;" in build
    # ...and the ribbon's Expand all calls it from there: by name it is
    # out of scope there, and threw on the first node
    ribbon = app.split("    if(ex) ex.addEventListener('click',function(){")[1]
    ribbon = ribbon.split("\n    });")[0]
    assert "var fill=host._fill; if(!fill) return;" in ribbon
    assert "fill(els[i]);" in ribbon
    assert "fillNode(" not in ribbon


# ------------------------------------------------------ 2. find in Raw


def test_find_searches_the_raw_view_while_it_is_shown():
    got = _run(CL + r"""
var findTok=0,findTerm='',calls=[];
function findClear(){calls.push('clear');}
function findMarkAll(sh){calls.push('mark:'+sh.name);}
function $(s){return null;}
var jvMath={pending:function(){return 0;},all:function(){}};
var shown={classList:CL(['nbshell','raw']),querySelector:function(s){
  return s==='.rawview'?{name:'raw'}:null;}};
var document={querySelector:function(sel){
  if(sel==='.nbshell:not([hidden])') return shown;
  if(sel==='.nbshell:not([hidden]) .content') return {name:'feed'};
  if(sel==='.nbshell .content') return {name:'other'};
  return null;}};
""" + _app("findRun") + r"""
findRun('anomaly');                      /* Raw shown: the raw view */
shown.classList.remove('raw');
findRun('anomaly');                      /* the document: its feed */
shown.classList.add('raw');shown.querySelector=function(){return null;};
findRun('anomaly');                      /* a shell without one: as before */
console.log(JSON.stringify(calls));
""")
    assert got == ["clear", "mark:raw", "clear", "mark:feed",
                   "clear", "mark:feed"]


def test_an_open_find_follows_raw_on_and_off():
    app = assets.app_js()
    raw = app.split("  if(rawBtn) rawBtn.addEventListener('click',function(){")
    assert "    findAgain();" in raw[1].split("\n  });")[0]



def test_find_follows_raw_left_by_any_way_out():
    """Raw is left by the Tree button and by an outline or Variables link
    as well as by its own button: Find stayed in the hidden raw view, its
    count and Next describing marks no one could see"""
    app = assets.app_js()
    assert "findFollow();" in lift_fn(app, "toggleTree")
    assert app.count("renderRawBtn();renderViewBtns();findFollow();") == 2
    run = lift_fn(app, "findRun")
    assert "findRoot=sh;" in run
    got = _run(CL + r"""
var again=0;function findAgain(){again++;}
function shell(raw,hasRaw){
  var s={hidden:false,classList:CL(['nbshell'].concat(raw?['raw']:[]))};
  function part(c){return {isConnected:true,classList:CL([c]),
    closest:function(){return s;}};}
  s.rv=part('rawview');s.feed=part('content');
  s.querySelector=function(q){return q==='.rawview'&&hasRaw?s.rv:null;};
  return s;}
var findRoot=null;
""" + _app("findFollow") + r"""
var out=[];
function ask(root){findRoot=root;again=0;findFollow();out.push(again);}
ask(null);
var a=shell(true,true);ask(a.rv);           /* Raw shown, raw searched */
a.classList.remove('raw');ask(a.rv);        /* Raw left: search again */
ask(a.feed);                                /* the document, searched */
a.classList.add('raw');ask(a.feed);         /* Raw on: search again */
var b=shell(true,false);ask(b.feed);        /* no raw view: the feed */
a.classList.remove('raw');a.hidden=true;ask(a.feed);   /* another tab */
a.hidden=false;a.feed.isConnected=false;ask(a.feed);   /* reloaded */
console.log(JSON.stringify(out));
""")
    assert got == [0, 0, 1, 0, 1, 0, 1, 1]


# --------------------------------------------------- 3. raw view's ids


def test_a_raw_copy_answers_for_its_own_ids():
    got = _run(r"""
function El(tag,attrs,kids,text){
  this.localName=tag;this.attributes=[];
  for(var k in attrs) this.attributes.push({name:k,value:attrs[k]});
  this.children=kids||[];this.textContent=text||'';}
El.prototype.getAttribute=function(n){
  var a=this.attributes.filter(function(a){return a.name===n;})[0];
  return a?a.value:null;};
El.prototype.setAttribute=function(n,v){
  var a=this.attributes.filter(function(a){return a.name===n;})[0];
  if(a) a.value=v; else this.attributes.push({name:n,value:v});};
Object.defineProperty(El.prototype,'id',{get:function(){
  return this.getAttribute('id')||'';}});
function walk(root){var out=[];(function w(e){e.children.forEach(
  function(c){out.push(c);w(c);});})(root);return out;}
/* the query for what can point at an id: every element will do here */
var ID_REF_SEL='REFS',queried=0;
var $$=function(sel,root){var all=walk(root);
  if(sel===ID_REF_SEL) queried++;
  return sel==='[id]'?all.filter(function(e){
    return e.getAttribute('id')!==null;}):all;};
""" + _app("ownIds") + r"""
var ID_REFS={'for':1,'headers':1,'list':1,'form':1,'itemref':1,
  'aria-labelledby':1,'aria-describedby':1,'aria-controls':1,
  'aria-owns':1,'aria-activedescendant':1,'aria-flowto':1,
  'aria-details':1,'aria-errormessage':1};
var E=function(t,a,k,x){return new El(t,a,k,x);};
var root=E('div',{'class':'out','data-jvout':'c1o0'},[
  E('input',{id:'sec-1',type:'checkbox'}),
  E('label',{'for':'sec-1'}),
  E('svg',{},[
    E('clipPath',{id:'clip1'}),
    E('path',{'clip-path':'url(#clip1)'}),
    E('g',{style:"clip-path: url('#clip1'); fill:#fff"}),
    E('symbol',{id:'icon-db'}),
    E('use',{'xlink:href':'#icon-db'}),
    E('use',{href:'#icon-db'})]),
  E('a',{href:'https://example.com/x#sec-1'}),
  E('a',{href:'#nowhere'}),
  E('table',{id:'T_abc'},[E('td',{id:'T_abc_row0'})]),
  E('style',{},[],'#T_abc_row0{color:#fff} #T_abc{x:y} '
    +'.q{fill:url(#clip1)} #other{}'),
  E('div',{'aria-labelledby':'sec-1 other'})]);
ownIds(root,'--raw-c1o0');
var all=walk(root),out={ids:[],attrs:{},css:''};
all.forEach(function(e){
  if(e.getAttribute('id')!==null) out.ids.push(e.getAttribute('id'));
  e.attributes.forEach(function(a){
    if(a.name!=='id') out.attrs[e.localName+'@'+a.name+
      (out.attrs[e.localName+'@'+a.name]!==undefined?'2':'')]=a.value;});
  if(e.localName==='style') out.css=e.textContent;});
/* a copy without ids is left as it came, and not searched */
var plain=E('div',{},[E('p',{style:'fill:url(#x)'})]);
queried=0;ownIds(plain,'--raw-c2o0');
out.plainQueried=queried;out.plain=plain.children[0].getAttribute('style');
console.log(JSON.stringify(out));
""")
    s = "--raw-c1o0"
    assert got["ids"] == ["sec-1" + s, "clip1" + s, "icon-db" + s,
                          "T_abc" + s, "T_abc_row0" + s]
    a = got["attrs"]
    assert a["label@for"] == "sec-1" + s
    assert a["path@clip-path"] == f"url(#clip1{s})"
    assert a["g@style"] == f"clip-path: url('#clip1{s}'); fill:#fff"
    assert a["use@xlink:href"] == f"#icon-db{s}"
    assert a["use@href"] == f"#icon-db{s}"
    # a link out of the page, and a fragment the copy does not hold, stay
    assert a["a@href"] == "https://example.com/x#sec-1"
    assert a["a@href2"] == "#nowhere"
    assert a["div@aria-labelledby"] == f"sec-1{s} other"
    # its own <style> styles its own elements; colours are not ids
    assert got["css"] == (f"#T_abc_row0{s}{{color:#fff}} #T_abc{s}{{x:y}} "
                          f".q{{fill:url(#clip1{s})}} #other{{}}")
    assert got["plainQueried"] == 0 and got["plain"] == "fill:url(#x)"


def test_what_can_point_at_an_id_is_found_by_one_query():
    """not a walk of every element of every copy: an xarray repr is
    thousands of them (the first Raw of a 116-cell notebook paid 33-40 ms
    at 4x for the walk)"""
    app = assets.app_js()
    sel = app.split("  var ID_REF_SEL=")[1].split(";\n")[0]
    for want in ("Object.keys(ID_REFS)", "'[*|href]'", "'style'",
                 "'clip-path'", "'fill'", "'*=\"url(\"]'"):
        assert want in sel, want
    assert "$$('*',root)" not in lift_fn(app, "ownIds")
    assert "$$(ID_REF_SEL,root)" in lift_fn(app, "ownIds")


def test_the_raw_view_fills_its_placeholders_with_copies_that_own_their_ids():
    pop = lift_fn(assets.app_js(), "populateRawView")
    assert ("if(src) ph.appendChild(ownIds(src.cloneNode(true),"
            "'--raw-'+key));") in pop


# ------------------------------------------- 4. find and a clamped note


FIND_NOTE = CL + r"""
var findHits=[],findAt=-1,findOpened=[],findOpenedParts=[],
    findOpenedNotes=[];
function $(s){return null;}
function $$(s,r){return [];}
var clamped=0;
function mdClamp(bds){bds.forEach(function(bd){clamped++;
  bd.dataset.mdclamp=bd.long?'1':'0';if(bd.long) bd.classList.add('mdclamp');});}
function note(long,state){
  var card={classList:CL(['card']),dataset:{note:'1'}};
  var btn={textContent:state==='open'?'Show less':'Show more'};
  var bd={classList:CL(['cardbody'].concat(state==='open'?['mdclamp','mdopen']
      :state==='clamped'?['mdclamp']:[])),
    dataset:state?{mdclamp:long?'1':'0'}:{},long:long,parentNode:card};
  card.querySelector=function(s){
    return s===':scope > .mdmore'&&bd.classList.contains('mdclamp')?btn:null;};
  var m={classList:CL(['jv-hit','jv-doc']),scrollIntoView:function(){},
    closest:function(s){return s==='.card'?card:s==='.cardbody'?bd:null;}};
  return {card:card,bd:bd,btn:btn,m:m};
}
function look(n){return {open:n.bd.classList.contains('mdopen'),
  clamp:n.bd.classList.contains('mdclamp'),btn:n.btn.textContent};}
"""


def test_find_opens_a_clamped_note_and_closes_it_again():
    got = _run(FIND_NOTE + _app("findGo", "findRestore", "mdSetOpen")
               + r"""
var out={};
/* a long note not measured yet: decided, then opened */
var a=note(true,null);findHits=[a.m];findAt=-1;findGo(1);
out.unmeasured=look(a);out.clamped=clamped;
findRestore();out.unmeasuredAfter=look(a);
/* a long note already clamped */
var b=note(true,'clamped');findHits=[b.m];findAt=-1;findGo(1);
out.measured=look(b);findRestore();out.measuredAfter=look(b);
/* one the reader opened is theirs: left open */
var c=note(true,'open');findHits=[c.m];findAt=-1;findGo(1);
findRestore();out.readers=look(c);
/* a short note has nothing to open */
var d=note(false,null);findHits=[d.m];findAt=-1;findGo(1);
out.short=look(d);out.recorded=findOpenedNotes.length;
console.log(JSON.stringify(out));
""")
    shown = {"open": True, "clamp": True, "btn": "Show less"}
    folded = {"open": False, "clamp": True, "btn": "Show more"}
    assert got["unmeasured"] == shown and got["clamped"] == 1
    assert got["unmeasuredAfter"] == folded
    assert got["measured"] == shown and got["measuredAfter"] == folded
    assert got["readers"] == shown
    assert got["short"] == {"open": False, "clamp": False,
                            "btn": "Show more"}
    assert got["recorded"] == 0


def test_the_show_more_button_says_what_find_did():
    app = assets.app_js()
    clamp = lift_fn(app, "mdClamp")
    assert "mdSetOpen(bd,!bd.classList.contains('mdopen'));" in clamp


# ------------------------------------------------- 5. reload keeps place


READ = CL + r"""
var frames=[],listeners={},scrolled=[];
function requestAnimationFrame(f){frames.push(f);}
var window={addEventListener:function(t,f){listeners[t]=f;},
  removeEventListener:function(t){delete listeners[t];},
  scrollBy:function(o){scrolled.push(o.behavior+':'+o.top);
    y+=o.top;},scrollTo:function(x,yy){scrolled.push('to:'+yy);}};
var y=0;
function box(top,h,shown){return {isConnected:true,
  getClientRects:function(){return shown===false?[]:[1];},
  getBoundingClientRect:function(){return {top:top-y,bottom:top-y+h};},
  dataset:{}};}
var $$=function(s,el){return el.cards;};
function setTimeout(f){f();}
"""


def test_reload_keeps_the_card_being_read_where_it_sat():
    got = _run(READ + _app("readingAt", "readingBack") + r"""
var out={};
/* the outgoing shell: read down to y=900; cards at 0, 500, 1100 */
y=900;
var old={cards:[box(0,400),box(500,500),box(1100,300)]};
old.cards.forEach(function(c,i){c.dataset.anchor='a'+i;});
out.at=readingAt(old);
/* the fresh shell lays its cards out 300px each until seen */
y=900;
var c1=box(300,500);c1.dataset.anchor='a1';
var shell={cards:[c1]};
readingBack(shell,out.at,900);
out.first=Math.round(c1.getBoundingClientRect().top);
/* a card above it is laid out for real a frame later: it moves */
c1.getBoundingClientRect=(function(){var t=600;return function(){
  return {top:t-y,bottom:t-y+500};};})();
frames.shift()();
out.second=Math.round(c1.getBoundingClientRect().top);
/* you scroll yourself: it lets go */
listeners.wheel();frames.shift()();
out.left=Object.keys(listeners).length;out.frames=frames.length;
out.scrolled=scrolled;
/* nothing of the feed on screen (Raw, Tree): scrollY is all there is */
var raw={cards:[box(0,400,false)]};
out.rawAt=readingAt(raw);scrolled=[];
readingBack(shell,null,900);out.rawBack=scrolled;
out.hidden=readingAt({hidden:true,cards:old.cards});
/* an anchor the notebook repeats: the same one of its cards */
y=900;
var twice={cards:[box(0,400),box(500,300),box(1000,500)]};
['x','y','x'].forEach(function(a,i){twice.cards[i].dataset.anchor=a;});
out.twiceAt=readingAt(twice);
var first=box(0,400),second=box(700,500),other=box(300,100);
first.dataset.anchor=second.dataset.anchor='x';other.dataset.anchor='y';
scrolled=[];frames=[];
readingBack({cards:[first,other,second]},out.twiceAt,900);
out.twiceTop=Math.round(second.getBoundingClientRect().top);
/* an anchor no selector could hold (a lenient read keeps a cell id with
   a newline in it): found, not thrown on */
var odd=box(1200,300);odd.dataset.anchor='cell:a\n"b\\';frames=[];
readingBack({cards:[odd]},{anchor:'cell:a\n"b\\',n:0,top:50},900);
out.odd=Math.round(odd.getBoundingClientRect().top);
console.log(JSON.stringify(out));
""")
    assert got["at"] == {"anchor": "a1", "n": 0, "top": -400}
    assert got["first"] == -400 and got["second"] == -400
    # instantly, never the page's smooth glide
    assert got["scrolled"] == ["instant:-200", "instant:300"]
    assert got["left"] == 0 and got["frames"] == 0
    assert got["rawAt"] is None and got["rawBack"] == ["to:900", "to:900"]
    assert got["hidden"] is None
    assert got["twiceAt"] == {"anchor": "x", "n": 1, "top": 100}
    assert got["twiceTop"] == 100
    assert got["odd"] == 50


def test_a_mount_takes_the_place_before_the_swap_and_puts_it_back_after():
    mount = lift_fn(assets.app_js(), "mountShellHTML")
    assert "var at=keep?readingAt(old.el):null;" in mount
    assert mount.index("readingAt(old.el)") < mount.index(
        "host.replaceChild(shell,old.el)")
    assert "if(keep&&(at||keep.scroll)) readingBack(shell,at,keep.scroll);" \
        in mount
    assert mount.index("activate(stem);") < mount.index("readingBack(")


# ------------------------------------------ 6. Plotly in a closed section


def test_a_figure_not_shown_waits_to_be_seen_before_it_is_drawn():
    got = _run(r"""
var plotIO=null,plotQ=[],pumps=0,observed=[],unobserved=[],cb=null;
function IntersectionObserver(f){cb=f;}
IntersectionObserver.prototype.observe=function(d){observed.push(d.n);};
IntersectionObserver.prototype.unobserve=function(d){unobserved.push(d.n);};
var window={IntersectionObserver:IntersectionObserver};
function ensurePlotly(f){}
function plotPump(){pumps++;}
var shell={hidden:false,classList:{contains:function(){return false;}}};
function d(n,shown){return {n:n,shown:shown,isConnected:true,
  closest:function(){return shell;},
  getClientRects:function(){return this.shown?[1]:[];}};}
""" + _app("plotQueue", "plotNext", "plotOffScreen") + r"""
var out={};
var hid=d('hid',false),vis=d('vis',true);
plotQueue([hid,vis]);
out.first=plotNext().n;               /* the shown one, the hidden waits */
out.waiting=hid.__jvPlotQ;out.next=plotNext();
/* seen while still hidden: nothing; opened and seen: its turn */
cb([{target:hid,isIntersecting:false}]);out.pumpsHidden=pumps;
hid.shown=true;cb([{target:hid,isIntersecting:true}]);
out.marked=hid.__jvPlotQ;out.pumps=pumps;
out.then=plotNext().n;
out.observed=observed;out.unobserved=unobserved;
console.log(JSON.stringify(out));
""")
    assert got["first"] == "vis"
    assert got["waiting"] == 3 and got["next"] is None
    assert got["pumpsHidden"] == 0
    assert got["marked"] == 2 and got["pumps"] == 1
    assert got["then"] == "hid"
    # watched until drawn: seeing it does not let go of it
    assert got["observed"] == ["hid", "vis"] and got["unobserved"] == []
