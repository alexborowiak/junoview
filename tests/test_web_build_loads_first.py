"""The web build shows itself first and fetches the rest later.

2026-10-09 speed pass, findings load-static #2, #10 and #11. On a first
visit the web build used to start downloading ~7 MB of Pyodide from its
<head>, so on a 9 Mbps link the welcome screen could not be clicked for
5.3 s; "Try the example" then waited for that Python to parse a notebook
the build could have rendered itself (13.8 s from arriving); the service
worker's install downloaded the page a second time, Plotly and the
MathJax fonts; the demo reel downloaded a 317 KB clip just to learn the
folder existed; and the welcome screen was sent hidden, behind a ribbon.

Pinned here, by behaviour where it can be:

- Python starts on intent (any call, the Open dialog, a drag) or once the
  page has loaded and gone quiet -- not when the runtime is evaluated.
- The service worker is registered after load; its install holds the
  app only; the heavy half is asked for once Python is up; Plotly and
  MathJax are kept when used; a new build carries the pinned runtime over.
- build_web renders the example exactly as the browser's worker would,
  and the page mounts it with no Python unless its tab name is taken.
- The web build is sent as its welcome screen; every other page is not.
"""

from __future__ import annotations

import json
import re
import subprocess
from pathlib import Path

import pytest

from helpers_js import js_engine, lift_fn
from junoview import assets, web
from junoview.render.page import WELCOME_REVEAL, render_page
from junoview.web import EXAMPLE_URL, build_web, service_worker, web_parse

ROOT = Path(__file__).resolve().parents[1]
EXAMPLE = ROOT / "examples" / "example_climate_analysis.ipynb"


def run_js(tmp_path, code):
    engine = js_engine()
    if engine is None:
        pytest.skip("JavaScript engine unavailable")
    cmd, env = engine
    script = tmp_path / "check.js"
    script.write_text(code, encoding="utf-8")
    result = subprocess.run(cmd + [str(script)], env=env, capture_output=True,
                            text=True, timeout=60)
    assert result.returncode == 0, result.stderr
    return json.loads(result.stdout.strip().splitlines()[-1])


def _app_data(idx: str) -> dict:
    m = re.search(r'<script type="application/json" id="app-data">(.*?)'
                  r"</script>", idx, re.S)
    assert m
    return json.loads(m.group(1))


@pytest.fixture
def built(tmp_path, monkeypatch):
    """A web build with the example and one small demo clip (the real
    reel is 22 MB of GIFs, which this does not need to copy)."""
    gifs = tmp_path / "clips"
    gifs.mkdir()
    (gifs / "code_folding.gif").write_bytes(b"GIF89a")
    monkeypatch.setattr(web, "find_gifs", lambda: gifs)
    out = tmp_path / "site"
    out.mkdir()
    # leftovers of an earlier build: its runtime file and its example
    (out / "web-runtime.js").write_text("old")
    (out / "example_climate_analysis.shell.0123456789abcdef.html"
     ).write_text("old")
    (out / "keep.me.html").write_text("not ours")
    build_web(out, example=EXAMPLE)
    return out


# ---- build_web --------------------------------------------------------

def test_the_example_is_rendered_by_the_workers_own_function(built):
    shells = sorted(built.glob("example_climate_analysis.shell.*.html"))
    assert len(shells) == 1, "the previous build's copy was not removed"
    data = shells[0].read_bytes()
    # byte for byte what the browser's worker would hand the page
    assert data == web_parse(
        EXAMPLE_URL, EXAMPLE.read_text(encoding="utf-8"), "[]"
    ).encode("utf-8")
    # ...and passes the page's own "is this the rendering?" check, which
    # tells it apart from a host's index page answering in its place
    check = re.search(r"if\(!/(.+?)/\.test\(shell\)\)", assets.app_js())
    assert check and re.match(check.group(1), data.decode("utf-8"))
    # named for its content, like the page's other files
    import hashlib
    assert shells[0].name == ("example_climate_analysis.shell."
                              f"{hashlib.sha256(data).hexdigest()[:16]}.html")
    idx = (built / "index.html").read_text(encoding="utf-8")
    pre = _app_data(idx)["web"]["pre"]
    assert pre == {EXAMPLE_URL: {"shell": shells[0].name,
                                 "stem": "example_climate_analysis",
                                 "math": 1}}
    # the notebook itself still ships (Recent, a collision, a download)
    assert (built / EXAMPLE_URL).read_bytes() == EXAMPLE.read_bytes()
    # the worker keeps it with the runtime, for "Try the example" offline
    sw = (built / "sw.js").read_text(encoding="utf-8")
    warm = sw[sw.index("var WARM = "):]
    assert f", '{shells[0].name}'" in warm[:warm.index("]);")]
    # ...and the notebook: with a document of the same name open, Python
    # opens the example from it, and offline only this copy is there
    assert f", '{EXAMPLE_URL}'" in warm[:warm.index("]);")]
    assert "/*__JV_WARM__*/" not in sw
    assert (built / "keep.me.html").read_text() == "not ours"


def test_the_build_says_whether_the_demo_clips_are_there(built, tmp_path,
                                                         monkeypatch):
    idx = (built / "index.html").read_text(encoding="utf-8")
    assert _app_data(idx)["web"]["demos"] == 1
    assert (built / "gifs" / "code_folding.gif").is_file()
    monkeypatch.setattr(web, "find_gifs", lambda: None)
    bare = tmp_path / "bare"
    build_web(bare, example=EXAMPLE)
    idx = (bare / "index.html").read_text(encoding="utf-8")
    assert _app_data(idx)["web"]["demos"] == 0
    # ...and the page decides from that, never by fetching a clip
    js = assets.app_js()
    reel = js[js.index("var KEY='junoview:demos';"):]
    reel = reel[:reel.index("btn.addEventListener('click',function(){")]
    assert "if(APP.mode!=='web'||!(APP.web&&APP.web.demos))" in reel
    code = re.sub(r"/\*.*?\*/", "", reel, flags=re.S)   # not the notes
    assert "new Image()" not in code and "gifs/" not in code


def test_a_build_without_the_example_opens_it_as_before(tmp_path,
                                                        monkeypatch):
    monkeypatch.setattr(web, "find_gifs", lambda: None)
    monkeypatch.setattr(web, "find_example", lambda: None)
    build_web(tmp_path)
    idx = (tmp_path / "index.html").read_text(encoding="utf-8")
    assert _app_data(idx)["web"] == {"demos": 0, "pre": {}}
    assert not list(tmp_path.glob("*.shell.*.html"))
    sw = (tmp_path / "sw.js").read_text(encoding="utf-8")
    assert "/*__JV_WARM__*/" not in sw and ".shell." not in sw
    assert "'example_climate_analysis.ipynb'" not in sw


def test_the_runtime_is_in_the_page_and_its_old_file_goes(built):
    idx = (built / "index.html").read_text(encoding="utf-8")
    head = idx[:idx.index("</head>")]
    version = re.search(r'name="junoview-build" content="([0-9a-f]{12})"',
                        head).group(1)
    assert f"window.__jvBuild='{version}';" in head
    assert "window.semPy=" in head and 'src="web-runtime.js"' not in idx
    assert not (built / "web-runtime.js").exists()


def test_the_web_build_is_sent_as_its_welcome_screen():
    page = render_page([], mode="web")
    assert '<body class="files-top welcoming">' in page
    # shown by the line right after its first screen -- whole, not while
    # it is still arriving -- and long before any script file has run
    welcome = page[page.index('<div class="welcome" id="welcome" hidden>'):]
    first = welcome[:welcome.index('<div class="welcome-more">')]
    assert first.rstrip().endswith("</div>" + WELCOME_REVEAL)
    assert page.index(WELCOME_REVEAL) \
        < page.index('<script type="application/json" id="app-data">')
    assert '<span id="welcome-demo-wrap"><a href="#" id="welcome-demo"' \
        in page
    assert '<a href="#" id="welcome-install">Install as an app</a>' in page
    # what app.js puts up at once on an empty Home is there already
    assert '<div class="wj-none" id="wj-none-pres">No recent' in page
    # a saved side list still turns into one before the first paint
    assert "document.body.classList.contains('files-top')" in page
    # every other page with nothing open is what it was: app.js decides
    for mode in ("static", "app"):
        other = render_page([], mode=mode)
        assert "<body>\n" in other
        assert '<div class="welcome" id="welcome" hidden>' in other
        assert "getElementById('welcome').hidden=false" not in other
        assert '<span id="welcome-demo-wrap" hidden>' in other
        assert '<a href="#" id="welcome-install" hidden>' in other
        assert '<div class="wj-none" id="wj-none-pres" hidden>' in other
        assert '"web":' not in other


def test_the_welcome_is_revealed_early_only_as_it_was_sent(tmp_path):
    """Only a visitor with nothing remembered and no route sees the sent
    screen before app.js: one coming back has lists app.js fills in (shown
    early, it read "No recent presentations" and then jumped up as they
    arrived), and #/pres/... is a deck about to open. An installed app
    never shows its own Install link, and a control on it clicked before
    app.js is remembered for it rather than lost."""
    script = WELCOME_REVEAL[len("<script>"):-len("</script>")]
    code = r"""
const vm=require('vm');
function node(hidden){return {hidden,on:[],
  addEventListener(t,f){this.on.push([t,f]);}};}
function run(hash,store,standalone,early){
  const els={};
  const el=id=>els[id]||(els[id]=node(true));
  els['welcome-install']=node(false);els['welcome-install-sep']=node(false);
  const window={};
  vm.runInNewContext(SCRIPT,{location:{hash,pathname:'/jv/'},window,
    localStorage:{getItem:k=>store.hasOwnProperty(k)?store[k]:null},
    matchMedia:()=>({matches:!!standalone}),
    document:{getElementById:el}});
  if(early){
    /* a click on one of its controls (or on its text), before app.js and
       then after it */
    const click=id=>{let stopped=false;el('welcome').on.forEach(([t,f])=>
      t==='click'&&f({target:{closest:s=>id?{id}:null},
        preventDefault(){stopped=true;}}));return stopped;};
    const before=[click('welcome-open'),click(null),window.__jvEarlyClick];
    window.__jvEarlyClick=0;window.SemApp={};
    return before.concat([click('welcome-open'),window.__jvEarlyClick]);
  }
  return [!el('welcome').hidden,!els['welcome-install'].hidden];
}
console.log(JSON.stringify({
  first:run('',{}),
  emptyLists:run('',{'semweb:/jv/:recent':'[]'}),
  homeRoute:run('#/',{}),
  recent:run('',{'semweb:/jv/:recent':'["a.ipynb"]'}),
  lastSession:run('',{'semweb:/jv/:open':'["a.ipynb"]'}),
  presentations:run('',{'sempres:web:/jv/:recent-presentations':'["talk"]'}),
  otherPage:run('',{'semweb:/other/:recent':'["a.ipynb"]'}),
  deckRoute:run('#/pres/talk/s2',{}),
  installed:run('',{},true),
  early:run('',{},false,true)}));
"""
    got = run_js(tmp_path, "const SCRIPT=" + json.dumps(script) + ";\n"
                 + code)
    assert got == {"first": [True, True], "emptyLists": [True, True],
                   "homeRoute": [True, True], "recent": [False, True],
                   "lastSession": [False, True],
                   "presentations": [False, True],
                   "otherPage": [True, True], "deckRoute": [False, True],
                   "installed": [True, False],
                   # remembered for app.js before it runs; its own after
                   "early": [True, False, "welcome-open", False, 0]}


# ---- web-runtime.js: Python starts when it is wanted ------------------

_RUNTIME_ENV = r"""
const vm=require('vm');
function boot(state){
  const made=[],load=[],idle=[],registered=[];
  class Worker {constructor(u){made.push(u);this.sent=[];}
    postMessage(m){this.sent.push(m);} terminate(){}}
  const serviceWorker={controller:null,addEventListener:()=>{},
    ready:new Promise(()=>{}),
    register:u=>{registered.push(u);return Promise.resolve();}};
  const window={addEventListener:(t,f)=>{if(t==='load')load.push(f);},
    requestIdleCallback:(f,o)=>{idle.push([f,o]);}};
  const ctx={window,navigator:{serviceWorker},Worker,
    setTimeout:(f,ms)=>globalThis.setTimeout(f,ms),
    clearTimeout:id=>globalThis.clearTimeout(id),
    document:{readyState:state,dispatchEvent:()=>{}},Event:class {}};
  vm.runInNewContext(RUNTIME,ctx);
  return {api:window.semPy,made,load,idle,registered,
    fireLoad(){load.splice(0).forEach(f=>f());},
    fireIdle(){idle.splice(0).forEach(([f])=>f());}};
}
"""


def test_python_starts_on_the_first_call_not_when_the_page_loads(tmp_path):
    code = _RUNTIME_ENV + r"""
const a=boot('loading');
const evaluated=a.made.length;
a.api.parse('n.ipynb','{}',[]);a.api.parseB64('t.xlsx','AA',[]);
const afterCalls=a.made.length;
a.fireLoad();a.fireIdle();          /* the idle start finds it running */
const b=boot('loading');
b.api.start();b.api.start();        /* intent: the Open dialog, a drag */
const c=boot('loading');
c.fireLoad();
const loadOnly=c.made.length;       /* loaded, not yet quiet */
const timeouts=c.idle.map(x=>x[1]&&x[1].timeout);
c.fireIdle();
const d=boot('complete');           /* evaluated after load */
const lateIdle=d.idle.length;
console.log(JSON.stringify({evaluated,afterCalls,after:a.made.length,
  started:b.made.length,loadOnly,quiet:c.made.length,timeouts,lateIdle,
  registered:[a.registered.length,c.registered.length]}));
"""
    result = run_js(tmp_path, "const RUNTIME=" + json.dumps(
        assets.load("js/web-runtime.js")) + ";\n" + code)
    assert result == {
        "evaluated": 0,            # nothing at evaluation, in <head>
        "afterCalls": 1, "after": 1,   # one worker, made by the call
        "started": 1,
        "loadOnly": 0, "quiet": 1,     # after load AND the first idle
        "timeouts": [4000, 4000],      # never later than 4 s after load
        "lateIdle": 2,
        "registered": [1, 1]}          # the service worker: after load


def test_an_open_that_needs_no_python_holds_its_quiet_start(tmp_path):
    code = _RUNTIME_ENV + r"""
const timers=[];
globalThis.setTimeout=(f,ms)=>{timers.push([f,ms]);return timers.length;};
globalThis.clearTimeout=id=>{if(timers[id-1]) timers[id-1][0]=()=>{};};
const a=boot('complete');
const r1=a.api.hold(),r2=a.api.hold();
a.fireIdle();
const held=a.made.length;
r1();r1();                          /* releasing twice is once */
const one=a.made.length;
r2();
const both=a.made.length;
const b=boot('complete');
b.api.hold();b.fireIdle();
timers.slice(-1)[0][0]();           /* a download that never ends */
const c=boot('complete');
const rc=c.api.hold();c.api.start();  /* intent beats a hold */
console.log(JSON.stringify({held,one,both,timeout:b.made.length,
  ms:timers[0][1],intent:c.made.length}));
"""
    result = run_js(tmp_path, "const RUNTIME=" + json.dumps(
        assets.load("js/web-runtime.js")) + ";\n" + code)
    assert result == {"held": 0, "one": 0, "both": 1, "timeout": 1,
                      "ms": 15000, "intent": 1}


def test_offline_is_announced_only_when_the_copy_is_complete(tmp_path):
    code = r"""
const vm=require('vm');
async function run(ok){
  let posted=null,chan=null;const events=[];
  class Worker {constructor(){globalThis.__w=this;} postMessage(){} terminate(){}}
  class MessageChannel {constructor(){chan=this;this.port1={};this.port2={};}}
  const active={postMessage:(m,ports)=>{posted={m,n:ports.length,
    mine:ports[0]===chan.port2};}};
  const serviceWorker={controller:null,addEventListener:()=>{},
    ready:Promise.resolve({active}),register:()=>Promise.resolve()};
  const window={addEventListener:()=>{},requestIdleCallback:f=>f()};
  const ctx={window,navigator:{serviceWorker},Worker,MessageChannel,
    performance:{getEntriesByType:()=>[{name:'https://cdn.plot.ly/plotly-2.35.2.min.js'}]},
    document:{readyState:'complete',dispatchEvent:e=>events.push(e.type)},
    Event:class {constructor(t){this.type=t;}}};
  vm.runInNewContext(RUNTIME,ctx);
  const before=!!posted;
  globalThis.__w.onmessage({data:{type:'ready'}});
  await new Promise(r=>setTimeout(r,0));
  chan.port1.onmessage({data:{type:'warmed',ok}});
  return {before,type:posted.m.type,used:posted.m.used,n:posted.n,
    mine:posted.mine,events,offline:!!window.__jvOffline};
}
(async()=>{
  console.log(JSON.stringify({ok:await run(true),partial:await run(false)}));
})();
"""
    result = run_js(tmp_path, "const RUNTIME=" + json.dumps(
        assets.load("js/web-runtime.js")) + ";\n" + code)
    used = ["https://cdn.plot.ly/plotly-2.35.2.min.js"]
    assert result["ok"] == {"before": False, "type": "warm", "used": used,
                            "n": 1, "mine": True, "events": [
                                "sem:pyready", "sem:offline"],
                            "offline": True}
    assert result["partial"] == {"before": False, "type": "warm",
                                 "used": used, "n": 1, "mine": True,
                                 "events": ["sem:pyready"],
                                 "offline": False}


def test_the_page_starts_python_at_the_first_sign_of_a_notebook():
    js = assets.app_js()
    assert "function webWarmPython(){" in js
    show = js[js.index("  function showDlg(){"):]
    show = show[:show.index("    /* this line, not page.html")]
    assert "if(APP.mode==='web'){\n      webWarmPython();" in show
    drag = js[js.index("window.addEventListener('dragenter'"):]
    drag = drag[:drag.index("dragDepth++;")]
    assert "if(!dragHasFiles(e)) return;\n      webWarmPython();" in drag
    assert "if(files&&files.length) webWarmPython();" in js
    # the toast waits for the complete offline copy, not registration
    assert "else document.addEventListener('sem:offline',offlineReady);" \
        in js
    assert "navigator.serviceWorker.ready.then(function(){\n        var K=" \
        not in js
    # a welcome control clicked before this file ran is carried out by it
    # (the welcome's reveal script remembers the click); the deck's own
    # once the deck file's boot has ended
    demo = js[js.index("var demoBtn=$('#welcome-demo');"):]
    demo = demo[:demo.index("/* ---- the installable")]
    assert "var early=window.__jvEarlyClick;" in demo
    assert "if(el&&!el.hidden&&wl&&!wl.hidden) el.click();" in demo
    assert "APP.afterBoot=replay;\n      else setTimeout(replay,0);" in demo
    route = js[js.index("APP.applyInitialRoute=function(){"):]
    route = route[:route.index("\n  };")]
    assert "if(APP.afterBoot){var f=APP.afterBoot;APP.afterBoot=null;f();}" \
        in route


# ---- sw.js -------------------------------------------------------------

SHELL = "example_climate_analysis.shell.0123456789abcdef.html"
PLOTLY = "https://cdn.plot.ly/plotly-2.35.2.min.js"
PY = "https://cdn.jsdelivr.net/pyodide/v0.26.4/full/"
MJ = "https://cdn.jsdelivr.net/npm/mathjax@3.2.2/es5/"

_SW_ENV = r"""
const vm=require('vm');
const BASE='https://junoview.com/';
const PY='https://cdn.jsdelivr.net/pyodide/v0.26.4/full/';
const MJ='https://cdn.jsdelivr.net/npm/mathjax@3.2.2/es5/';
const PLOTLY='https://cdn.plot.ly/plotly-2.35.2.min.js';
function abs(u){return typeof u==='string'?new URL(u,BASE).href:u.url;}
function env(opts){
  opts=opts||{};
  const stores=opts.stores||new Map(),log={fetches:[],claimed:0};
  class Response {constructor(body,init){init=init||{};this.body=body;
    this.ok=init.ok!==undefined?init.ok:true;this.type=init.type||'basic';}
    clone(){return this;}
    static error(){return new Response(null,{ok:false,type:'error'});}}
  class Request {constructor(u,init){init=init||{};this.url=abs(u);
    this.mode=init.mode||'cors';this.credentials=init.credentials||'same-origin';
    this.method='GET';}}
  function fetchFn(req){
    if(typeof req==='string') req=new Request(req);
    log.fetches.push([req.url.replace(BASE,''),req.mode]);
    if(opts.offline||(opts.fail&&opts.fail(req)))
      return Promise.reject(new TypeError('network'));
    if(req.mode==='no-cors'&&!req.url.startsWith(BASE))
      return Promise.resolve(new Response('opaque',{ok:false,type:'opaque'}));
    return Promise.resolve(new Response('body:'+req.url,
      {type:req.url.startsWith(BASE)?'basic':'cors'}));
  }
  function store(n){if(!stores.has(n)) stores.set(n,new Map());
    const m=stores.get(n);return {
      match:r=>Promise.resolve(m.get(abs(r))),
      put:(r,res)=>{m.set(abs(r),res);return Promise.resolve();},
      add:r=>fetchFn(new Request(r)).then(res=>{
        if(!res.ok) throw new TypeError('bad');m.set(abs(r),res);}),
      addAll:rs=>Promise.all(rs.map(r=>fetchFn(new Request(r)).then(res=>{
        if(!res.ok) throw new TypeError('bad');return [abs(r),res];})))
        .then(ps=>ps.forEach(([k,v])=>m.set(k,v))),
      keys:()=>Promise.resolve([...m.keys()].map(u=>new Request(u)))};}
  const caches={open:n=>Promise.resolve(store(n)),
    keys:()=>Promise.resolve([...stores.keys()]),
    delete:n=>Promise.resolve(stores.delete(n))};
  const on={};
  const self={location:{origin:'https://junoview.com',href:BASE+'sw.js'},
    addEventListener:(t,f)=>{on[t]=f;},skipWaiting:()=>Promise.resolve(),
    clients:{claim:()=>{log.claimed++;return Promise.resolve();}}};
  vm.runInNewContext(SW,{self,caches,fetch:fetchFn,Request,Response,URL});
  async function fire(t,extra){
    const ps=[];let resp=null;
    const e=Object.assign({waitUntil:p=>ps.push(p),
      respondWith:p=>{resp=p;}},extra||{});
    on[t](e);
    const r=resp?await resp:null;
    await Promise.all(ps);
    return r;
  }
  function names(n){return [...(stores.get(n)||new Map()).keys()]
    .map(u=>u.replace(BASE,'')).sort();}
  return {stores,log,fire,names,Request};
}
"""


def _sw() -> str:
    return service_worker("v2", ["app.0123456789abcdef.js"], [SHELL])


def _run_sw(tmp_path, code):
    return run_js(tmp_path, "const SW=" + json.dumps(_sw()) + ";\n"
                  + _SW_ENV + code)


def test_the_install_takes_the_app_and_nothing_else(tmp_path):
    code = r"""
(async()=>{
  const a=env();
  await a.fire('install');
  console.log(JSON.stringify({cache:a.names('junoview-v2'),
    fetched:a.log.fetches.map(f=>f[0]).sort()}));
})();
"""
    out = _run_sw(tmp_path, code)
    core = ["", "LICENSE", "NOTICE", "THIRD_PARTY_NOTICES.html",
            "app.0123456789abcdef.js", "icon.svg", "manifest.webmanifest",
            "web-worker.js"]
    # './' only: index.html is the same page, and is no longer fetched
    # twice; no runtime, no Plotly, no fonts, no example on install
    assert out == {"cache": core, "fetched": core}


def test_a_new_build_keeps_the_runtime_and_takes_its_own_files(tmp_path):
    code = r"""
(async()=>{
  const stores=new Map();
  const old=new Map();
  [PY+'pyodide.asm.wasm',MJ+'tex-chtml.js',PLOTLY,
   BASE+'junoview.zip',BASE+'app.fedcba9876543210.js',BASE].forEach(
    u=>old.set(u,{ok:true,body:'old:'+u,clone(){return this;}}));
  stores.set('junoview-v1',old);
  stores.set('other-app',new Map());
  const a=env({stores});
  await a.fire('install');
  const installed=a.names('junoview-v2');
  a.log.fetches.length=0;
  await a.fire('activate');
  const kept=stores.get('junoview-v2');
  console.log(JSON.stringify({installed,
    caches:[...stores.keys()].sort(),
    after:a.names('junoview-v2'),
    wasm:kept.get(PY+'pyodide.asm.wasm').body,
    refetched:a.log.fetches,claimed:a.log.claimed}));
})();
"""
    out = _run_sw(tmp_path, code)
    # an update: this build's renderer and example come at install
    assert "junoview.zip" in out["installed"] and SHELL in out["installed"]
    assert not any(u.startswith("https://") for u in out["installed"])
    # activate: the pinned runtime is carried over, not fetched again;
    # the old build's own files are not; its cache is gone; others stay
    assert out["caches"] == ["junoview-v2", "other-app"]
    assert PY + "pyodide.asm.wasm" in out["after"]
    assert MJ + "tex-chtml.js" in out["after"] and PLOTLY in out["after"]
    assert "app.fedcba9876543210.js" not in out["after"]
    assert out["wasm"] == "old:" + PY + "pyodide.asm.wasm"
    assert out["refetched"] == [] and out["claimed"] == 1


def test_the_warm_request_fills_the_rest_and_says_if_it_is_whole(tmp_path):
    code = r"""
(async()=>{
  const res={};
  for(const failZip of [false,true]){
    const a=env({fail:r=>failZip&&r.url.endsWith('/junoview.zip')});
    await a.fire('install');
    const said=[];
    await a.fire('message',{data:{type:'warm',used:[
      'https://cdn.plot.ly/plotly-2.35.2.min.js',
      'https://cdn.jsdelivr.net/npm/some-widget@1/dist/x.js',
      'https://example.org/data.ipynb']},
      ports:[{postMessage:m=>said.push(m)}]});
    res[failZip?'nozip':'whole']={said,names:a.names('junoview-v2')};
  }
  console.log(JSON.stringify(res));
})();
"""
    out = _run_sw(tmp_path, code)
    whole = out["whole"]["names"]
    assert out["whole"]["said"] == [{"type": "warmed", "ok": True}]
    for u in ("junoview.zip", SHELL, PY + "pyodide.asm.wasm",
              PY + "python_stdlib.zip", MJ + "tex-chtml.js",
              MJ + "output/chtml/fonts/woff-v2/MathJax_Main-Regular.woff",
              PLOTLY):
        assert u in whole, u
    # only pinned runtime files are kept from what the page reports
    assert not any("some-widget" in u or "example.org" in u for u in whole)
    assert out["nozip"]["said"] == [{"type": "warmed", "ok": False}]


def test_a_script_tag_runtime_file_is_fetched_with_cors_and_kept(tmp_path):
    code = r"""
(async()=>{
  const a=env();
  await a.fire('install');
  a.log.fetches.length=0;
  const r1=await a.fire('fetch',{request:new a.Request(PLOTLY,{mode:'no-cors'})});
  const kept=a.names('junoview-v2').includes(PLOTLY);
  const f1=a.log.fetches.slice();a.log.fetches.length=0;
  /* not pinned: passed through as asked, and an opaque answer is not kept */
  const other='https://cdn.jsdelivr.net/npm/some-widget@1/dist/x.js';
  const r2=await a.fire('fetch',{request:new a.Request(other,{mode:'no-cors'})});
  const f2=a.log.fetches.slice();a.log.fetches.length=0;
  /* the CDN refusing CORS: the page's own request still goes through */
  const b=env({fail:r=>r.mode==='cors'&&r.url===PLOTLY});
  await b.fire('install');b.log.fetches.length=0;
  const r3=await b.fire('fetch',{request:new b.Request(PLOTLY,{mode:'no-cors'})});
  /* offline, a kept copy answers */
  const r4=await a.fire('fetch',{request:new a.Request(PLOTLY,{mode:'no-cors'})});
  console.log(JSON.stringify({t1:r1.type,kept,f1,t2:r2.type,f2,
    otherKept:a.names('junoview-v2').includes(other),
    t3:r3.type,f3:b.log.fetches,t4:r4.type,
    f4:a.log.fetches}));
})();
"""
    out = _run_sw(tmp_path, code)
    assert out["t1"] == "cors" and out["kept"]
    assert out["f1"] == [[PLOTLY, "cors"]]
    assert out["t2"] == "opaque" and not out["otherKept"]
    assert out["f2"] == [["https://cdn.jsdelivr.net/npm/some-widget@1/"
                          "dist/x.js", "no-cors"]]
    assert out["t3"] == "opaque"
    assert out["f3"] == [[PLOTLY, "cors"], [PLOTLY, "no-cors"]]
    assert out["t4"] == "cors" and out["f4"] == []   # a hit is final


def test_offline_navigation_to_index_html_is_the_page(tmp_path):
    code = r"""
(async()=>{
  const a=env();
  await a.fire('install');
  const b=env({stores:a.stores,offline:true});
  const r=await b.fire('fetch',{request:Object.assign(
    new b.Request('index.html'),{mode:'navigate'})});
  console.log(JSON.stringify({body:r&&r.body}));
})();
"""
    out = _run_sw(tmp_path, code)
    assert out == {"body": "body:https://junoview.com/"}


# ---- app.js: the example opens without Python --------------------------

_OPEN_ENV = r"""
var OPENBUSY={},log=[],shellText=BUILT;
var APP={mode:'web',order:[],shells:{},web:{pre:{
  'example_climate_analysis.ipynb':{shell:'ex.shell.html',
    stem:'example_climate_analysis',math:1}}}};
var mjReady=Promise.resolve();
var jvMath={warm:function(){log.push('mathjax');},
  ensure:function(){log.push('mathjax');return mjReady;}};
function isDeckPath(){return false;}
function fetchDeckUrl(){}
function setDlgBusy(b){log.push('busy:'+b);}
function webWarmPython(){log.push('python');}
function webReady(){return true;}
function mountShellHTML(h,p){log.push('mount:'+h+':'+p);}
function webNote(u){log.push('note:'+u);}
function webUnnote(u){log.push('unnote:'+u);}
function noteRestoreMiss(){log.push('miss');}
function hideDlg(){}
function jvTell(m){log.push('tell');}
var responses={};
function fetch(u,o){log.push('fetch:'+u+(o&&o.cache?':'+o.cache:''));
  var r=responses[u]||{status:200,text:'{}'};
  if(r.offline) return Promise.reject(new TypeError('offline'));
  return Promise.resolve({ok:r.status===200,status:r.status,
    text:function(){return Promise.resolve(r.text);}});}
window={semPy:{parse:function(n,t,taken){log.push('parse:'+n+':'+
  JSON.stringify(taken));return Promise.resolve('<python>');},
  hold:function(){log.push('hold');
    return function(){log.push('release');};}}};
var webImports=Promise.resolve();
"""


#: what the page fetches for the example: a rendering, as build_web writes
BUILT = '<div class="shell nbshell" data-nb="example_climate_analysis">'
MOUNT_BUILT = "mount:" + BUILT + ":example_climate_analysis.ipynb"


def _open_case(tmp_path, setup: str, wait_ms: int = 50) -> list[str]:
    src = assets.app_js()
    code = ("var BUILT=" + json.dumps(BUILT) + ";\n" + _OPEN_ENV
            + "\n".join(lift_fn(src, n) for n in (
        "normNbUrl", "queueWebImport", "webOpenUrl")) + "\n" + setup
        + r"""
setTimeout(function(){console.log(JSON.stringify(
  log.concat(Object.keys(OPENBUSY).map(function(k){return 'left:'+k;}))));},
  WAIT);
""".replace("WAIT", str(wait_ms)))
    return run_js(tmp_path, code)


def test_try_the_example_mounts_the_build_s_rendering(tmp_path):
    log = _open_case(tmp_path, r"""
responses['ex.shell.html']={status:200,text:shellText};
webOpenUrl('example_climate_analysis.ipynb',false);
""")
    # no Python: not asked, and its quiet-time start held off meanwhile
    assert log == [
        "busy:true", "mathjax", "hold", "fetch:ex.shell.html", "mathjax",
        MOUNT_BUILT,
        "note:example_climate_analysis.ipynb", "busy:false", "release"]


def test_its_cards_wait_for_mathjax_but_not_for_ever(tmp_path):
    # MathJax arriving after the shell: the cards go up when it is there
    late = _open_case(tmp_path, r"""
var go;mjReady=new Promise(function(r){go=r;});
responses['ex.shell.html']={status:200,text:shellText};
webOpenUrl('example_climate_analysis.ipynb',false);
setTimeout(function(){log.push('mathjax ready');go();},200);
""", wait_ms=400)
    assert late.index("mathjax ready") \
        < late.index(MOUNT_BUILT)
    # MathJax never arriving (a blocked CDN): mounted after 1.5 s anyway
    never = _open_case(tmp_path, r"""
mjReady=new Promise(function(){});
responses['ex.shell.html']={status:200,text:shellText};
webOpenUrl('example_climate_analysis.ipynb',false);
setTimeout(function(){log.push('1.4 s');},1400);
""", wait_ms=1700)
    assert never.index("1.4 s") \
        < never.index(MOUNT_BUILT)
    assert never[-1] == "release"


def test_a_reload_of_the_example_tab_uses_it_too(tmp_path):
    log = _open_case(tmp_path, r"""
APP.order=['example_climate_analysis','other'];
APP.shells={example_climate_analysis:{path:'example_climate_analysis.ipynb'},
  other:{path:'x.ipynb'}};
responses['ex.shell.html']={status:200,text:shellText};
webOpenUrl('example_climate_analysis.ipynb',false);
""")
    assert "parse" not in " ".join(log)
    assert MOUNT_BUILT in log


def test_a_taken_name_or_a_missing_copy_goes_through_python(tmp_path):
    taken = _open_case(tmp_path, r"""
APP.order=['example_climate_analysis'];
APP.shells={example_climate_analysis:{path:''}};   /* a dropped file */
responses['ex.shell.html']={status:200,text:shellText};
webOpenUrl('example_climate_analysis.ipynb',false);
""")
    assert taken == [
        "busy:true", "mathjax", "hold", "fetch:ex.shell.html", "mathjax",
        "release", "python",
        "fetch:example_climate_analysis.ipynb:no-store", "mathjax",
        'parse:example_climate_analysis.ipynb:["example_climate_analysis"]',
        "mount:<python>:example_climate_analysis.ipynb",
        "note:example_climate_analysis.ipynb", "busy:false"]
    missing = _open_case(tmp_path, r"""
responses['ex.shell.html']={status:404,text:''};
webOpenUrl('example_climate_analysis.ipynb',false);
""")
    assert "fetch:example_climate_analysis.ipynb:no-store" in missing
    assert "mount:<python>:example_climate_analysis.ipynb" in missing
    assert missing.index("release") < missing.index("python")
    assert not [x for x in missing if x.startswith("left:")]


def test_a_host_s_index_page_in_its_place_goes_through_python(tmp_path):
    # a page left open across a new build asks for its build's rendering,
    # which the new build removed; a host with a single-page-app fallback
    # (or a captive portal) answers 200 with an HTML page that is not it
    spa = _open_case(tmp_path, r"""
responses['ex.shell.html']={status:200,
  text:'<!doctype html><html><head></head><body class="files-top">'};
webOpenUrl('example_climate_analysis.ipynb',false);
""")
    assert "mount:<python>:example_climate_analysis.ipynb" in spa
    assert not [x for x in spa if x.startswith("mount:<!doctype")]
    assert spa.index("release") < spa.index("python")


def test_any_other_notebook_opens_as_it_always_did(tmp_path):
    log = _open_case(tmp_path, r"""
webOpenUrl('https://example.org/nb/a.ipynb',false);
""")
    assert log == ["busy:true", "python",
                   "fetch:https://example.org/nb/a.ipynb:no-store", "mathjax",
                   'parse:a.ipynb:[]',
                   "mount:<python>:https://example.org/nb/a.ipynb",
                   "note:https://example.org/nb/a.ipynb", "busy:false"]


def test_a_failed_silent_restore_of_the_example_keeps_it(tmp_path):
    offline = _open_case(tmp_path, r"""
responses['ex.shell.html']={offline:true};
responses['example_climate_analysis.ipynb']={offline:true};
webOpenUrl('example_climate_analysis.ipynb',true);
""")
    assert offline[-1] == "miss" and "unnote" not in " ".join(offline)
    gone = _open_case(tmp_path, r"""
responses['ex.shell.html']={status:404,text:''};
responses['example_climate_analysis.ipynb']={status:404,text:''};
webOpenUrl('example_climate_analysis.ipynb',true);
""")
    assert gone[-1] == "unnote:example_climate_analysis.ipynb"
