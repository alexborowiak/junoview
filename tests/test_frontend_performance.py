"""Behavior checks for incremental playback and the asynchronous reader."""

import json
import subprocess

import pytest

from helpers_js import js_engine, lift_fn
from junoview import assets


def run_js(tmp_path, code):
    engine = js_engine()
    if engine is None:
        pytest.skip("JavaScript engine unavailable")
    cmd, env = engine
    script = tmp_path / "check.js"
    script.write_text(code, encoding="utf-8")
    result = subprocess.run(cmd + [str(script)], env=env, capture_output=True,
                            text=True, timeout=30)
    assert result.returncode == 0, result.stderr
    return json.loads(result.stdout)


def test_cell_history_source_and_stable_cell_lookup(tmp_path):
    src = assets.load("js/app.js")
    code = "\n".join(lift_fn(src, name) for name in (
        "ghFromUrl", "isUrl", "historySource", "historyText",
        "historyGitCell")) + r"""
var APP={mode:'app'};
const remote=historySource('https://raw.githubusercontent.com/o/r/main/a.ipynb');
const local=historySource('C:/notebooks/a.ipynb');
APP.mode='web';
const noLocal=historySource('C:/notebooks/a.ipynb');
const nb={cells:[{id:'stable',source:'plot()'},
  {source:'#| id: chart\nplot()'}, {source:'other()'},
  {id:'p12',source:'special()'}]};
console.log(JSON.stringify({remote:remote.gh.path,local:local.path,
  noLocal:noLocal,byId:historyGitCell(nb,'cell:stable').index,
  byDirective:historyGitCell(nb,'chart').index,
  byPosition:historyGitCell(nb,'cell:p2').index,
  idLikePosition:historyGitCell(nb,'cell:p12').index}));
"""
    assert run_js(tmp_path, code) == {
        "remote": "a.ipynb", "local": "C:/notebooks/a.ipynb",
        "noLocal": None, "byId": 0, "byDirective": 1,
        "byPosition": 2, "idLikePosition": 3}


def test_git_history_read_has_a_real_stream_cap_and_metadata_cache(tmp_path):
    src = assets.load("js/app.js")
    code = lift_fn(src, "historyBoundedText") + "\n" + r"""
let cancelled=0;
function response(parts){let i=0;return {headers:{get:()=>null},body:{
  getReader:()=>({read:()=>Promise.resolve(i<parts.length
    ?{done:false,value:Uint8Array.from(parts[i++])}:{done:true}),
    cancel:()=>{cancelled++;}})}};}
var ghCommitCache=new Map(),calls=0;
function fetch(){calls++;return Promise.resolve({ok:true,json:()=>Promise.resolve([
  {sha:'abc123',commit:{message:'Changed',author:{date:'2026-01-01'}}}])});}
""" + lift_fn(src, "ghCommits") + r"""
(async()=>{
  const text=await historyBoundedText(response([[65,66],[67]]),3);
  const over=await historyBoundedText(response([[65,66],[67,68]]),3)
    .catch(e=>e.message);
  const gh={owner:'o',repo:'r',ref:'main',path:'a.ipynb'};
  const lists=await Promise.all([ghCommits(gh),ghCommits(gh)]);
  console.log(JSON.stringify({text,over,cancelled,calls,
    ids:lists.map(x=>x[0].id)}));
})();
"""
    assert run_js(tmp_path, code) == {
        "text": "ABC", "over": "This notebook is too large to preview",
        "cancelled": 1, "calls": 1, "ids": ["abc123", "abc123"]}


def test_peek_eyes_report_and_edit_saved_visibility(tmp_path):
    src = assets.load("js/app.js")
    code = lift_fn(src, "syncUnhideBtn") + r"""
function classes(items){return {items,contains:x=>items.includes(x)};}
function control(owner,name){return {attrs:{},classList:classes([name]),
  closest:()=>owner,
  setAttribute(k,v){this.attrs[k]=v;}};}
const card={classList:classes(['cell-off'])},
  section={classList:classes(['sec-off'])},eye=control(card),
  sectionButton=control(section,'sec-hideall'),peek={attrs:{},
    setAttribute(k,v){this.attrs[k]=v;}};
const shell={classList:classes(['reveal-hidden']),
  querySelector:()=>peek,querySelectorAll:()=>[card,section]};
function $$(selector){
  if(selector==='.cell-eye,.navitem-eye') return [eye];
  if(selector==='.sec-hideall,.navsec-hideall') return [sectionButton];
  return [];
}
function bic(){return '<i></i>';}
syncUnhideBtn(shell);
const before={eye:eye.attrs['aria-label'],pressed:eye.attrs['aria-pressed'],
  section:sectionButton.textContent,peek:peek.innerHTML};
card.classList.items.splice(0);
syncUnhideBtn(shell);
console.log(JSON.stringify({before,after:eye.attrs['aria-label']}));
"""
    result = run_js(tmp_path, code)
    assert result["before"]["pressed"] == "true"
    assert "show this cell permanently" in result["before"]["eye"]
    assert result["before"]["section"] == "Show section"
    assert "End peek" in result["before"]["peek"]
    assert "hide this cell permanently" in result["after"]


def test_peek_filtered_cell_can_be_kept_visible(tmp_path):
    src = assets.load("js/app.js")
    code = lift_fn(src, "toggleCellEye") + r"""
function classes(names){return {contains:n=>names.includes(n)};}
const card={classList:classes([])},nav={classList:classes(['nav-hidden'])};
var shell={classList:classes(['reveal-hidden']),querySelector:s=>
  s.startsWith('.card')?card:nav},calls=[];
function setCellOff(...args){calls.push(args);}
toggleCellEye('a');
card.classList=classes(['cell-keep-visible']);
nav.classList=classes([]);
toggleCellEye('a');
card.classList=classes(['cell-off','is-pinned']);
toggleCellEye('a');
console.log(JSON.stringify(calls));
"""
    assert run_js(tmp_path, code) == [
        ["a", False, True], ["a", False, False], ["a", False, False]]


def test_peek_eyes_identify_filtered_and_overridden_cells(tmp_path):
    src = assets.load("js/app.js")
    code = lift_fn(src, "syncUnhideBtn") + r"""
function classes(items){return {contains:x=>items.includes(x)};}
function eye(owner){return {attrs:{},closest:()=>owner,
  setAttribute(k,v){this.attrs[k]=v;}};}
const hidden={classList:classes(['nav-hidden'])};
const shown={classList:classes(['cell-keep-visible'])};
const a=eye(hidden),b=eye(shown),peek={attrs:{},
  setAttribute(k,v){this.attrs[k]=v;}};
const shell={classList:classes(['reveal-hidden']),
  querySelector:()=>peek,querySelectorAll:()=>[hidden]};
function $$(selector){return selector==='.cell-eye,.navitem-eye'?[a,b]:[];}
function bic(){return '<i></i>';}
syncUnhideBtn(shell);
console.log(JSON.stringify({hidden:a.attrs['aria-label'],
  shown:b.attrs['aria-label']}));
"""
    result = run_js(tmp_path, code)
    assert "show this cell permanently" in result["hidden"]
    assert "follow filters for this cell again" in result["shown"]


def test_peek_count_includes_filter_hidden_cells_before_opening(tmp_path):
    src = assets.load("js/app.js")
    code = lift_fn(src, "syncUnhideBtn") + r"""
var peek={attrs:{},setAttribute(k,v){this.attrs[k]=v;}};
var shell={classList:{contains:()=>false},querySelector:()=>peek,
  querySelectorAll:s=>s==='.content .card.is-hidden'?[{},{}]:[{}]};
function $$(){return [];}
function bic(){return '<i></i>';}
syncUnhideBtn(shell);
console.log(JSON.stringify({label:peek.innerHTML,pressed:peek.attrs['aria-pressed']}));
"""
    result = run_js(tmp_path, code)
    assert "Peek at hidden (3)" in result["label"]
    assert result["pressed"] == "false"


def test_local_cell_history_serializes_git_reads_and_skips_stale(tmp_path):
    src = assets.load("js/app.js")
    code = "var cellHistoryLocalQueue=Promise.resolve();\n"
    code += lift_fn(src, "historyLocalVersion") + r"""
var cellHistoryDialog={},cellHistoryRequest=1,calls=[],finish=[];
function api(path,payload){calls.push(payload.commit);
  return new Promise(resolve=>finish.push(resolve));}
(async()=>{
  const dialog=cellHistoryDialog,source={path:'notebook.ipynb'};
  const first=historyLocalVersion(dialog,1,source,'cell:a','first');
  await Promise.resolve();
  cellHistoryRequest=2;
  const stale=historyLocalVersion(dialog,1,source,'cell:a','stale');
  const second=historyLocalVersion(dialog,2,source,'cell:a','second');
  await Promise.resolve();
  const before=calls.slice();
  finish[0]({found:true});
  await first;await stale;
  await Promise.resolve();
  const after=calls.slice();
  finish[1]({found:true});await second;
  console.log(JSON.stringify({before,after}));
})();
"""
    assert run_js(tmp_path, code) == {
        "before": ["first"], "after": ["first", "second"]}


def test_reader_queues_before_ready_and_recovers_after_bad_document(tmp_path):
    code = r"""
const vm=require('vm');
let finishLoading, messages=[], calls=[], globals={};
const py={globals:{set:(key,value)=>globals[key]=value},
  unpackArchive:()=>{},runPython:(code)=>{
    if(code.startsWith('import ')) return;
    calls.push([globals._wname, code]);
    if(globals._wtext==='bad') throw new Error('invalid document');
    return globals._wname;
  }};
const context={self:{postMessage:m=>messages.push(m)},
  fetch:()=>Promise.resolve({ok:true,
    arrayBuffer:()=>Promise.resolve(new ArrayBuffer(1))}),
  importScripts:()=>{},loadPyodide:()=>new Promise(r=>finishLoading=r)};
vm.runInNewContext(WORKER,context);
context.self.onmessage({data:{id:1,method:'parse',name:'broken',text:'bad'}});
context.self.onmessage({data:{id:2,method:'parseB64',name:'sheet',text:'ok'}});
context.self.onmessage({data:{id:3,method:'importPptx',name:'deck',text:'ok'}});
if(calls.length) throw Error('ran Python before ready');
finishLoading(py);
setTimeout(()=>console.log(JSON.stringify({calls,messages})),0);
"""
    result = run_js(tmp_path, "const WORKER=" + json.dumps(
        assets.load("js/web-worker.js")) + ";\n" + code)
    assert [c[0] for c in result["calls"]] == ["broken", "sheet", "deck"]
    assert result["messages"] == [
        {"type": "ready"}, {"id": 1, "error": "invalid document"},
        {"id": 2, "result": "sheet"}, {"id": 3, "result": "deck"}]
    assert result["calls"][2][1].endswith("(_wname,_wtext)")


def test_worker_bridge_correlates_results_and_rejects_pending_on_failure(tmp_path):
    code = r"""
const vm=require('vm');let worker;
class Worker {
  constructor(){worker=this;this.sent=[];}
  postMessage(m){this.sent.push(m);}
  terminate(){this.terminated=true;}
}
const context={window:{addEventListener:()=>{}},navigator:{},Worker,
  document:{dispatchEvent:()=>{}},Event:class {}};
vm.runInNewContext(RUNTIME,context);
const api=context.window.semPy;
const a=api.parse('a','text'),b=api.parseB64('b','bytes');
worker.onmessage({data:{id:2,result:'B'}});
worker.onmessage({data:{id:1,result:'A'}});
worker.onmessage({data:{type:'ready'}});
(async()=>{
  const values=await Promise.all([a,b]);await api.ready;
  const c=api.importPptx('c','bytes').catch(e=>e.message);
  worker.onerror({message:'worker stopped'});
  values.push(await c,await api.parse('d','text').catch(e=>e.message));
  console.log(JSON.stringify({values,terminated:worker.terminated}));
})();
"""
    result = run_js(tmp_path, "const RUNTIME=" + json.dumps(
        assets.load("js/web-runtime.js")) + ";\n" + code)
    assert result == {"values": ["A", "B", "worker stopped", "worker stopped"],
                      "terminated": True}


def test_offline_precache_waits_for_successful_reader_start(tmp_path):
    code = r"""
const vm=require('vm');
function boot(fails){let worker,registered=0;
  class Worker {constructor(){worker=this;} terminate(){}}
  const serviceWorker={controller:null,addEventListener:()=>{},
    register:()=>{registered++;return Promise.resolve();}};
  const context={window:{addEventListener:()=>{}},navigator:{serviceWorker},
    Worker,document:{dispatchEvent:()=>{}},Event:class {}};
  vm.runInNewContext(RUNTIME,context);
  worker.onmessage({data:fails?{type:'fatal',error:'unavailable'}:{type:'ready'}});
  return new Promise(resolve=>setTimeout(()=>resolve(registered),0));
}
(async()=>console.log(JSON.stringify({success:await boot(false),
  failure:await boot(true)})))();
"""
    result = run_js(tmp_path, "const RUNTIME=" + json.dumps(
        assets.load("js/web-runtime.js")) + ";\n" + code)
    assert result == {"success": 1, "failure": 0}


DOM = r"""
let created=0;
class Element {
  constructor(tag){created++;this.tagName=tag;this.children=[];this.attrs={};
    this.className='';this.parentNode=null;this.animations=[];
    this.style={setProperty(){},removeProperty(){}};
    this.classList={contains:c=>this.className.split(' ').includes(c),
      add:(...cs)=>{this.className=
        [...new Set(this.className.split(' ').concat(cs))].join(' ');},
      remove:(...cs)=>{this.className=this.className.split(' ')
        .filter(c=>!cs.includes(c)).join(' ');},
      toggle:(c,on)=>{if(on)this.classList.add(c);else this.classList.remove(c);}};
  }
  get firstChild(){return this.children[0]||null;}
  set innerHTML(value){if(value!=='')throw Error('unexpected HTML');
    this.children.forEach(c=>c.parentNode=null);this.children=[];}
  getAttribute(k){return this.attrs[k]??null;}
  setAttribute(k,v){this.attrs[k]=String(v);if(k==='class')this.className=String(v);}
  removeAttribute(k){delete this.attrs[k];}
  appendChild(c){return this.insertBefore(c,null);}
  removeChild(c){c.remove();return c;}
  insertBefore(c,b){if(c.parentNode)c.remove();
    const i=b?this.children.indexOf(b):this.children.length;
    this.children.splice(i,0,c);c.parentNode=this;return c;}
  replaceChild(c,old){const i=this.children.indexOf(old);
    if(i<0)throw Error('missing child');
    if(c.parentNode)c.remove();this.children[i]=c;c.parentNode=this;old.parentNode=null;}
  remove(){if(this.parentNode){const p=this.parentNode;
    p.children.splice(p.children.indexOf(this),1);this.parentNode=null;}}
  querySelectorAll(sel){const result=[];
    function matches(el,s){const classes=[...s.matchAll(/\.([\w-]+)/g)].map(m=>m[1]);
      if(!classes.every(c=>el.classList.contains(c)))return false;
      const m=s.match(/\[data-idx(?:="([^"]+)")?\]/);
      const idx=el.getAttribute('data-idx');
      if(m&&(idx==null||(m[1]!=null&&m[1]!==idx)))return false;
      return classes.length||m;
    }
    function walk(el){el.children.forEach(c=>{
      if(sel.split(',').some(s=>matches(c,s)))result.push(c);walk(c);});}
    walk(this);return result;
  }
  querySelector(sel){return this.querySelectorAll(sel)[0]||null;}
  getAnimations(){return this.animations;}
}
const document={createElement:t=>new Element(t),createElementNS:(ns,t)=>new Element(t)};
const window={SemActivate:()=>{}};
function $$(sel,el){return el.querySelectorAll(sel);}
var mode='view',revealCount=0,storyAt=null,selAnnot=null,AN_NS='svg';
var pres={slides:[]},paintSlide=null,SHAPE_PATHS={},SHAPE_GLYPH={};
var TOKENS_DEFAULT={c:{line:'line'}};
var typeRun=null;
function ensureOids(){} function flushTextEdits(){} function markPrivateItems(){}
function slideHasMaths(){return false;} function fitTexts(){} function focusSettle(){}
function tokens(){return TOKENS_DEFAULT;} function tokVal(v){return v;}
function strokePx(){return 1;} function dashFor(){return false;}
function cssFill(){return 'none';} function applyCommon(){}
function anchorPos(a){return {x:a.x||0,y:a.y||0};}
function privShown(){return true;} function pieceCount(){return 1;}
function slideBuildSteps(){return {map:{0:0,1:1,2:2}};}
function flipPlan(){return {stop:{0:0,1:1,2:2},count:3};}
function animGoing(s,a){return a.out!=null&&revealCount===a.out+1;}
function animGone(s,a){return a.out!=null&&revealCount>a.out+1;}
function animFocusing(){return false;} function animFocus(){return null;}
function animOut(a){return a.out==null?null:a.out;}
function stepShows(s,a){return !animGone(s,a);}
function stepTied(a){return a.out!=null;}
function textAt(){return 0;} function textBy(){return false;}
function motionPaint(el,a){
  el.animations=[{animationName:'an-'+a.motion,currentTime:0}];}
function textPages(){return [];}
function drawTable(layer,s,a,i,editing,place){const el=new Element('div');
  el.className='an-item an-table';el.setAttribute('data-idx',i);place(el);}
"""


def test_build_updates_preserve_nodes_motion_and_z_order(tmp_path):
    src = assets.load("js/deck/20-notes-and-tables.js")
    renderer = src[src.index("  function renderAnnots("):
                   src.index("  function selectAnnot(")]
    code = DOM + lift_fn(src, "annotRenderKey") + "\n" + renderer + r"""
const layer=new Element('div');
const s={layout:'blank',annots:Array.from({length:200},()=>({k:'rect'}))};
s.annots[5]={k:'rect',anim:{order:0,type:'fade'},motion:'bob',out:1};
s.annots[6]={k:'table'};
pres.slides=[s];
renderAnnots(layer,s);
const firstCost=created,staticItem=layer._paintItems[0].el;
const table=layer._paintItems[6].el;
revealCount=1;created=0;renderAnnots(layer,s,true);
const buildCost=created,animated=layer._paintItems[5].el;
animated.animations[0].currentTime=1450;
s.annots[5].anim.type='rise';renderAnnots(layer,s,true);
const phase=layer._paintItems[5].el.animations[0].currentTime;
revealCount=2;renderAnnots(layer,s,true);
revealCount=3;renderAnnots(layer,s,true);
const removed=!layer.querySelector('[data-idx="5"]');
revealCount=1;renderAnnots(layer,s,true);
const ids=layer.children.filter(n=>n.getAttribute('data-idx')!=null)
  .map(n=>+n.getAttribute('data-idx'));
console.log(JSON.stringify({firstCost,buildCost,phase,removed,
  sameStatic:staticItem===layer._paintItems[0].el,
  sameTable:table===layer._paintItems[6].el,
  ordered:ids.every((n,i)=>!i||ids[i-1]<n),count:ids.length}));
"""
    result = run_js(tmp_path, code)
    assert result["sameStatic"] and result["sameTable"]
    assert result["phase"] == 1450
    assert result["removed"] and result["ordered"] and result["count"] == 200
    assert result["buildCost"] <= 5
    assert result["firstCost"] >= 200


def test_import_queue_mounts_one_result_before_naming_next(tmp_path):
    src = assets.app_js()
    code = "var webImports=Promise.resolve();\n" + lift_fn(src, "queueWebImport")
    code += r"""
var names=[];
const first=queueWebImport(()=>Promise.resolve().then(()=>names.push('notebook')));
const bad=queueWebImport(()=>Promise.reject(Error('bad'))).catch(()=>{});
const second=queueWebImport(()=>{
  names.push(names.includes('notebook')?'notebook-2':'notebook');});
Promise.all([first,bad,second]).then(()=>console.log(JSON.stringify(names)));
"""
    assert run_js(tmp_path, code) == ["notebook", "notebook-2"]


def test_build_navigation_does_not_rebuild_slide_or_trace(tmp_path):
    src = assets.load("js/deck/15-annotations.js")
    render = src[src.index("  function renderSlide("):
                 src.index("  function syncBuildNav(")]
    code = r"""
var s={},pres={slides:[s]},cur=0,mode='view',calls=[];
const layer={_paintSlide:s,_paintMode:'view'};
var stage={querySelector:()=>layer,scrollTop:50};
function renderAnnots(l,slide,incremental){
  calls.push(l===layer&&slide===s&&incremental);}
function updateVNav(){calls.push('nav');}
function syncBuildNav(slide){calls.push(slide===s);}
""" + render + "\nrenderSlide(true);console.log(JSON.stringify(calls));"
    assert run_js(tmp_path, code) == [True, "nav", True]


def test_layout_observers_share_one_frame(tmp_path):
    src = assets.load("js/deck/05-figures-and-ribbon.js")
    code = r"""
var ribbonFitFrame=null,qatFitFrame=null,guidesFitFrame=null;
var deckEl={hidden:false},frames=[],calls=[];
function requestAnimationFrame(fn){frames.push(fn);return frames.length;}
function fitEditRibbon(){calls.push('ribbon');}
function applyZoom(){calls.push('zoom');}
function fitQat(){calls.push('qat');}
function syncGuides(){calls.push('guides');}
"""
    for name in ("scheduleRibbonFit", "scheduleQatFit", "scheduleGuidesFit"):
        code += lift_fn(src, name) + "\n"
    code += r"""
for(let i=0;i<30;i++){scheduleRibbonFit();scheduleQatFit();scheduleGuidesFit();}
const count=frames.length;frames.forEach(f=>f());
console.log(JSON.stringify({count,calls}));
"""
    assert run_js(tmp_path, code) == {
        "count": 3, "calls": ["ribbon", "zoom", "qat", "guides"]}


def test_story_selection_reuses_existing_previews(tmp_path):
    src = assets.load("js/deck/56-story.js")
    code = r"""
var s={},pres={slides:[s]},cur=0,storySlide=0,storyAt=2;
var storySource=s,storyDeck=pres,storyPainted=5,storyRevision=5,calls=[];
var strip={hidden:false,firstChild:{}};
function $(){return strip;}
function storySelection(el){calls.push(el===strip);}
""" + lift_fn(src, "renderStory") + r"""
renderStory();storyAt=3;renderStory();console.log(JSON.stringify(calls));
"""
    assert run_js(tmp_path, code) == [True, True]


def test_focus_frame_cannot_reapply_focus_after_next_click(tmp_path):
    src = assets.load("js/deck/48-animation.js")
    code = r"""
var frames=[],marks=[],fx,storyPaint=false;
var rect={left:0,top:0,width:100,height:100};
var stage={style:{},getBoundingClientRect:()=>rect};
var layer={isConnected:true,getBoundingClientRect:()=>rect,
  setAttribute:(k,v)=>fx=v,getAttribute:()=>fx,
  classList:{add:c=>marks.push(c)}};
var el={parentNode:layer,getBoundingClientRect:()=>rect,
  classList:{add:()=>{}}};
function requestAnimationFrame(fn){frames.push(fn);}
function animFocus(a){return a.focus;}
""" + lift_fn(src, "focusPaint") + lift_fn(src, "focusSettle") + r"""
['spot','zoom'].forEach(kind=>{
  focusPaint(layer,el,{focus:{fx:kind}});
  fx=null;frames.splice(0).forEach(fn=>fn());
});
function focusClear(){throw Error('thumbnail cancelled live focus');}
storyPaint=true;focusSettle(layer);
console.log(JSON.stringify({marks,transform:stage.style.transform||''}));
"""
    assert run_js(tmp_path, code) == {"marks": [], "transform": ""}


def test_animation_key_tracks_sibling_changes_to_story_and_panel_stops(tmp_path):
    src = assets.load("js/deck/20-notes-and-tables.js")
    code = r"""
var mode='edit',storyAt=1;
function pieceCount(){return 2;}
function animOut(a){return a.out==null?null:a.out;}
function animFocus(a){return a.focus||null;}
function animGoing(){return false;} function animGone(){return false;}
function animFocusing(){return false;} function stepShows(){return true;}
""" + lift_fn(src, "annotRenderKey") + r"""
const exit={k:'rect',out:5},focus={k:'rect',focus:{at:5,fx:'spot'}};
const before={map:{0:0,5:1}},after={map:{5:0}},plan={stop:[0,1]};
const exitChanged=annotRenderKey({},exit,before,plan)
  !==annotRenderKey({},exit,after,plan);
const focusChanged=annotRenderKey({},focus,before,plan)
  !==annotRenderKey({},focus,after,plan);
storyAt=null;
const panel={k:'image',anim:{order:0,by:'panels',grid:'2x1'}};
const panelsChanged=annotRenderKey({},panel,before,{stop:[0,3]})
  !==annotRenderKey({},panel,before,{stop:[0,1]});
console.log(JSON.stringify({exitChanged,focusChanged,panelsChanged}));
"""
    assert run_js(tmp_path, code) == {
        "exitChanged": True, "focusChanged": True, "panelsChanged": True}
