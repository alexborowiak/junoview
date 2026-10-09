"""MathJax typesets the page as it is read, not all of it at load.

It used to be loaded on every page and to typeset the whole document in one
long task -- every card, every hidden notebook and every hidden raw-view copy
-- at load and again on every mount (open, Reload, Update figures, add a
note, a version): 1.1-2.2 s with clicks dead at 4x CPU, and a page with no
maths at all still downloaded and ran it (2026-10-09 speed pass).

Now the server says WHERE the maths is (render/maths.py stamps data-math on
the elements that hold some), the page fetches MathJax only when something
is marked, and app.js's jvMath typesets marked elements as they come within
a screen of view, the rest at idle, a raw view only once opened. These tests
pin the server's half exactly and the page's half by running it: the
scheduler is lifted out of app.js and driven against a stand-in MathJax.
"""

from __future__ import annotations

import json
import re
import subprocess
import tempfile
from pathlib import Path

import pytest

from helpers_js import ASSETS, js_engine, lift_fn
from junoview import assets
from junoview.notebook.parser import parse_notebook
from junoview.render.items import render_raw
from junoview.render.maths import MATH_ATTR, has_math, math_attr
from junoview.render.page import mathjax_head, render_page, render_shell

MJ_URL = "https://cdn.jsdelivr.net/npm/mathjax@3.2.2/es5/tex-chtml.js"


# ---- the question, asked of markup ----------------------------------------

@pytest.mark.parametrize("frag", [
    "<p>The anomaly is $z' = z - \\bar{z}$.</p>",
    "<p>$$E = mc^2$$</p>",
    "<p>inline \\(x^2\\) here</p>",
    "<p>display \\[x^2\\]</p>",
    "<p>\\begin{align} a &amp;= b \\end{align}</p>",
    "<p>see \\eqref{eq:one}</p>",
    # MathJax rewrites the escapes too (processEscapes), so a lone \$ is
    # still work for it: "\$5" reads "$5" only once it has run
    "<p>costs \\$5</p>",
    "<p>a path C:\\\\Users</p>",
    # spelled as entities in the markup, they are the same characters in
    # the DOM MathJax reads
    "<td>&#36;x&#36;</td>",
    "<td>&dollar;x&dollar;</td>",
    "<td>&#x5C;(x&#x5c;)</td>",
    # a $ pair split by an element is a superset hit: MathJax would not
    # find it, but a false yes only costs an empty typeset pass
    "<p>$a <em>b</em> c$</p>",
])
def test_markup_mathjax_would_typeset_is_marked(frag):
    assert has_math(frag)
    assert math_attr(frag) == MATH_ATTR


@pytest.mark.parametrize("frag", [
    "",
    "<p>plain prose, no maths</p>",
    "<p>it costs $5 a month</p>",                  # one $ is not a pair
    '<pre class="code"><code>x = "$a$" + "\\(b\\)"</code></pre>',
    "<code>$x$</code>",
    "<script>var a='$1 $2'</script>",
    "<style>a::before{content:'$ $'}</style>",
    "<textarea>$x$</textarea>",
    "<noscript>$x$</noscript>",
    '<img alt="$x$" src="data:image/png;base64,iVBORw0KGgo=">',
    '<div data-plotly=\'{"t":"$x$ \\\\(y\\\\)"}\'></div>',
    "<!-- $x$ -->",
])
def test_markup_mathjax_would_skip_is_not_marked(frag):
    assert not has_math(frag)
    assert math_attr(frag) == ""


# ---- what the renderer stamps ---------------------------------------------

def _doc(cells):
    return parse_notebook({"cells": cells})


def test_a_card_holding_maths_is_marked_and_others_are_not(nb):
    shell = render_shell(parse_notebook(nb))
    cards = re.findall(r'<article class="card [^"]*"[^>]*>', shell)
    marked = [c for c in cards if MATH_ATTR in c]
    # the demo's one equation, in the md1 note
    assert len(marked) == 1
    assert 'data-note="1"' in marked[0]
    assert len(cards) > 3


def test_maths_in_an_html_output_marks_its_card():
    doc = _doc([
        {"cell_type": "code", "id": "t", "source": "#| title: Prices\ndf",
         "outputs": [{"output_type": "display_data", "data": {
             "text/html": "<table><tr><td>$1</td><td>$2</td></tr></table>"}}]},
    ])
    shell = render_shell(doc)
    art = re.search(r'<article class="card [^"]*"[^>]*>', shell).group(0)
    assert MATH_ATTR in art


def test_code_with_dollars_does_not_mark_its_card():
    doc = _doc([
        {"cell_type": "code", "id": "c",
         "source": "#| title: Shell\ncost = '$5 and $6'\nprint(r'\\(x\\)')",
         "outputs": [{"output_type": "stream", "name": "stdout",
                      "text": "$5 and $6\n"}]},
    ])
    shell = render_shell(doc)
    assert MATH_ATTR not in shell


def test_a_heading_with_maths_marks_its_section_and_the_outline():
    doc = _doc([
        {"cell_type": "markdown", "source": "## Energy $E = mc^2$"},
        {"cell_type": "code", "id": "f",
         "source": "#| display: figure\n#| title: A plot\nplot()",
         "outputs": [{"output_type": "display_data",
                      "data": {"image/png": "aGk="}}]},
    ])
    shell = render_shell(doc)
    head = re.search(r'<div class="sectionhead [^"]*"[^>]*>', shell)
    assert head and MATH_ATTR in head.group(0)
    assert '<nav class="nav"' + MATH_ATTR in shell


def test_the_raw_view_marks_its_own_cells_placeholders_included():
    """A raw-view output that is a placeholder (.rawph) is filled with a
    clone of the card's output when Raw first opens -- so the cell is
    marked from the FULL payload, or the clone's maths would never be
    typeset there."""
    nb = {"cells": [
        {"cell_type": "markdown", "source": "Prose with $x$."},
        {"cell_type": "markdown", "source": "No maths here."},
        {"cell_type": "code", "id": "o", "source": "#| title: Out\nshow()",
         "outputs": [{"output_type": "display_data",
                      "data": {"text/html": "<p>$y$</p>"}}]},
    ]}
    doc = parse_notebook(nb)
    raw = doc.raw_html or ""
    cells = re.findall(r'<div class="rawcell [^"]*"[^>]*>', raw)
    assert [MATH_ATTR in c for c in cells] == [True, False, True]
    # the bare renderer, every output embedded, says the same
    bare = render_raw(nb)
    assert bare.count(MATH_ATTR) == 2


# ---- the page: fetch MathJax only when something is marked ----------------

def test_a_page_with_maths_fetches_the_pinned_mathjax(nb):
    page = render_page([parse_notebook(nb)])
    tag = re.search(r'<script async id="jv-mathjax"[^>]*>', page).group(0)
    assert f'src="{MJ_URL}"' in tag and "data-src" not in tag


def test_a_page_without_maths_does_not_fetch_it():
    doc = _doc([{"cell_type": "markdown", "source": "# Just words"},
                {"cell_type": "code", "id": "c", "source": "x = 1",
                 "outputs": []}])
    page = render_page([doc])
    tag = re.search(r'<script async id="jv-mathjax"[^>]*>', page).group(0)
    # the address stays on the page -- app.js loads it on first need --
    # but as data-src, which the browser does not fetch
    assert f'data-src="{MJ_URL}"' in tag
    assert not re.search(r'\ssrc="', tag)
    # the web build's welcome screen has no notebook, so no maths
    web = render_page([], mode="web")
    assert 'data-src="' + MJ_URL in web
    assert ' src="' + MJ_URL not in web


def test_the_config_typesets_nothing_by_itself():
    """startup.typeset:false -- nothing is typeset until jvMath asks; the
    raw view is ignored by any container-level pass; the TeX delimiters
    and skipped tags are what render/maths.py assumes."""
    mj = assets.mathjax_html()
    assert "startup: {typeset: false}" in mj
    assert "ignoreHtmlClass: 'mathjax_ignore|rawview'" in mj
    assert ("skipHtmlTags: ['script','noscript','style','textarea','pre',"
            "'code']") in mj
    assert "inlineMath: [['$', '$'], ['\\\\(', '\\\\)']]" in mj
    assert mathjax_head(True) == mj
    assert mathjax_head(False) == mj.replace(' src="', ' data-src="', 1)


def test_the_pin_is_one_version_in_loader_and_service_worker():
    mj = assets.mathjax_html()
    sw = (ASSETS / "js" / "sw.js").read_text(encoding="utf-8")
    assert MJ_URL in mj
    assert "var MJ = 'https://cdn.jsdelivr.net/npm/mathjax@3.2.2/es5/';" in sw
    assert "mathjax@3/" not in mj and "mathjax@3/" not in sw


def test_no_whole_shell_typeset_remains():
    """Every MathJax call goes through jvMath: two overlapping
    typesetPromise calls share MathJax's one document, and the one left
    waiting on an extension load renders the other's elements."""
    app = (ASSETS / "js" / "app.js").read_text(encoding="utf-8")
    deck = assets.deck_js()
    for src in (app, deck):
        assert "MathJax.typesetPromise([shell])" not in src
        assert "MathJax.typesetPromise([rv])" not in src
        assert "MathJax.typesetPromise([sec])" not in src
        assert "MathJax.typesetPromise([body])" not in src
    # mountShellHTML hands the new shell to jvMath through initShell
    assert "jvMath.watch(shell);     /* its maths, typeset as it is read */" \
        in app
    # Find typesets before it marks words, so a <mark> never splits TeX
    assert "jvMath.all(sh,4000).then(function(){" in app
    # Ctrl+P prints the maths typeset
    assert "window.addEventListener('beforeprint',jvMath.beforePrint);" in app
    # a card cloned onto a slide, kept, compared or measured is set first
    assert "if(window.jvMath) window.jvMath.settle(c);" in deck
    # opening a notebook from a page that has not needed MathJax yet
    # loads it while the server (or Python) parses, not after
    assert ("if(!openTab||jvMath.pending(APP.shells[openTab].el)) "
            "jvMath.warm();") in app
    assert "jvMath.warm();   /* MathJax loads while Python parses */" in app


# ---- the page's half, run: jvMath against a stand-in MathJax --------------

def _lift_jvmath() -> str:
    app = (ASSETS / "js" / "app.js").read_text(encoding="utf-8")
    i = app.index("  var jvMath=(function(){")
    j = app.index("  })();\n  window.jvMath=jvMath;", i)
    return app[i:j + len("  })();\n")]


# A DOM just big enough for the scheduler: elements with attributes,
# children, contains/closest/querySelector(All) for the selectors jvMath
# uses, and a MathJax whose typeset records what it was asked for.
_HARNESS = r"""
'use strict';
function El(tag,attrs,kids){
  this.tagName=tag.toUpperCase();this.attrs=Object.assign({},attrs||{});
  this.children=[];this.parentNode=null;this.isConnected=true;
  this.classList={contains:(c)=>
    (' '+(this.attrs['class']||'')+' ').indexOf(' '+c+' ')>=0};
  (kids||[]).forEach((k)=>{k.parentNode=this;this.children.push(k);});
  this.textContent=attrs&&attrs.text||'';
}
El.prototype.getAttribute=function(n){
  return n in this.attrs?this.attrs[n]:null;};
El.prototype.setAttribute=function(n,v){this.attrs[n]=String(v);};
El.prototype.all=function(){var o=[];
  this.children.forEach((c)=>{o.push(c);o.push.apply(o,c.all());});
  return o;};
El.prototype.contains=function(x){
  for(var p=x;p;p=p.parentNode) if(p===this) return true;return false;};
El.prototype.matches=function(sel){
  if(sel==='[data-math=""]') return this.getAttribute('data-math')==='';
  if(sel==='mark.jv-doc') return this.tagName==='MARK';
  if(sel==='mjx-container') return this.tagName==='MJX-CONTAINER';
  if(sel.charAt(0)==='.') return this.classList.contains(sel.slice(1));
  return false;};
El.prototype.querySelectorAll=function(sel){
  return this.all().filter((e)=>e.matches(sel));};
El.prototype.querySelector=function(sel){
  return this.querySelectorAll(sel)[0]||null;};
El.prototype.closest=function(sel){
  for(var p=this;p&&p.matches;p=p.parentNode) if(p.matches(sel)) return p;
  return null;};
var body=new El('body',{},[]);
var head=new El('head',{},[]);
var scriptTag=null;
var document={
  body:body,head:head,
  getElementById:(id)=>id==='jv-mathjax'?scriptTag:null,
  getElementsByClassName:()=>({length:0}),
  querySelectorAll:(s)=>body.querySelectorAll(s),
  querySelector:(s)=>body.querySelector(s),
  createElement:(t)=>{var e=new El(t,{});e.listeners={};
    e.addEventListener=(ev,fn)=>{
      (e.listeners[ev]=e.listeners[ev]||[]).push(fn);};
    return e;},
};
head.appendChild=function(e){e.parentNode=head;head.children.push(e);};
document.listeners={};
document.addEventListener=function(t,fn){
  (document.listeners[t]=document.listeners[t]||[]).push(fn);};
function fire(t){(document.listeners[t]||[]).forEach((f)=>f({type:t}));}
var window={innerHeight:800};
var $$=function(s,r){return (r||document).querySelectorAll(s);};
var APP={active:null,shells:{}};
function tabList(){return Object.keys(APP.shells);}
var log=[];
function fakeMathJax(opts){
  opts=opts||{};
  window.MathJax={
    startup:{promise:Promise.resolve(),document:{render:function(){
      log.push('resume');}}},
    typeset:function(els){
      log.push('typeset:'+els.map((e)=>e.attrs.id).join(','));
      if(opts.retryOnce&&!opts.retried){opts.retried=true;
        var err=new Error('retry');err.retry=Promise.resolve();throw err;}
    },
    typesetClear:function(els){
      log.push('clear:'+els.map((e)=>e.attrs.id).join(','));},
  };
  globalThis.MathJax=window.MathJax;
}
"""


# the <script id="jv-mathjax"> of a page rendered with no maths on it
_NO_MATHS_PAGE = r"""
scriptTag=document.createElement('script');
scriptTag.setAttribute('data-src','https://x/tex-chtml.js');
"""


def _run_js(body: str, pre: str = "") -> list:
    eng = js_engine()
    if eng is None:
        pytest.skip("no JS engine (node or VS Code) on this machine")
    cmd, env = eng
    src = (_HARNESS + pre + "\n(function(){\n" + _lift_jvmath()
           + "\nglobalThis.jvMath=jvMath;})();\n"
           + "(async function(){\n" + body
           + "\n})().then((r)=>console.log('@@'+JSON.stringify(r)),"
           + "(e)=>{console.error(e&&e.stack||e);process.exit(1);});\n")
    with tempfile.TemporaryDirectory() as d:
        p = Path(d) / "run.js"
        p.write_text(src, encoding="utf-8")
        r = subprocess.run(cmd + [str(p)], capture_output=True, text=True,
                           env=env, timeout=60)
    assert r.returncode == 0, r.stderr[:3000]
    line = [ln for ln in r.stdout.splitlines() if ln.startswith("@@")][-1]
    return json.loads(line[2:])


def test_jvmath_typesets_synchronously_once_mathjax_is_there():
    """Callers typeset and then measure, re-fit or clone (the deck's
    commit path, cloneBody): with MathJax there, the typeset has happened
    by the time the call returns, and what it set is marked done."""
    out = _run_js(r"""
      fakeMathJax();
      var a=new El('article',{id:'a','data-math':''});
      body.children.push(a);a.parentNode=body;
      await jvMath.ensure();
      var ok=jvMath.settle(a);
      var after=log.slice();
      var again=jvMath.settle(a);
      return [ok, after, a.getAttribute('data-math'), again, log.length];
    """)
    assert out == [True, ["typeset:a"], "1", True, 1]


def test_jvmath_skips_what_holds_no_maths_and_loads_nothing_for_it():
    out = _run_js(r"""
      var plain=new El('div',{id:'p',text:'no maths, $5 only'});
      await jvMath.typeset(plain);
      return [log, head.children.length, jvMath.ready()];
    """, pre=_NO_MATHS_PAGE)
    # no typeset, and no script injected for a page that needs none
    assert out == [[], 0, False]


def test_jvmath_loads_mathjax_on_first_need_from_data_src():
    """A page built with no maths carries the address as data-src; the
    first thing that needs MathJax (an opened notebook, an equation on a
    slide) loads it from there, once."""
    out = _run_js(r"""
      var eq=new El('div',{id:'eq',text:'$$E=mc^2$$'});
      body.children.push(eq);eq.parentNode=body;
      var p=jvMath.typeset(eq);
      var p2=jvMath.typeset(eq);
      var injected=head.children.map((s)=>s.src);
      fakeMathJax();
      head.children[0].listeners.load.forEach((f)=>f());
      await p;await p2;
      return [injected, log];
    """, pre=_NO_MATHS_PAGE)
    assert out[0] == ["https://x/tex-chtml.js"]
    assert out[1][0] == "typeset:eq"


def test_jvmath_resumes_a_render_that_waits_on_an_extension():
    """A TeX extension load throws MathJax's retry: the render is RESUMED
    (document.render, no reset) once it has loaded -- restarting it with
    a fresh typeset would find the same maths twice."""
    out = _run_js(r"""
      fakeMathJax({retryOnce:true});
      var a=new El('article',{id:'a','data-math':''});
      var b=new El('article',{id:'b','data-math':''});
      [a,b].forEach((e)=>{body.children.push(e);e.parentNode=body;});
      await jvMath.ensure();
      var first=jvMath.settle(a);      // throws retry inside
      var during=jvMath.settle(b);     // must not overlap the retry
      await new Promise((r)=>setTimeout(r,20));
      var after=jvMath.settle(b);
      return [first, during, after, log];
    """)
    assert out == [False, False, True, ["typeset:a", "resume", "typeset:b"]]


def test_jvmath_never_hands_mathjax_a_container_and_its_child():
    out = _run_js(r"""
      fakeMathJax();
      var inner=new El('div',{id:'in','data-math':''});
      var outer=new El('section',{id:'out','data-math':''},[inner]);
      body.children.push(outer);outer.parentNode=body;
      await jvMath.ensure();
      jvMath.settle(body);
      return [log, inner.getAttribute('data-math')];
    """)
    assert out == [["typeset:out"], "1"]


def test_jvmath_all_waits_for_everything_and_forget_clears_mathjax():
    """all(): Find, print and the exports wait for every equation in the
    open notebooks; a closed raw view is left for when it opens. forget():
    a closed or replaced notebook leaves MathJax's list -- that list holds
    a node of each equation and would keep the old notebook alive."""
    out = _run_js(r"""
      fakeMathJax();
      var c1=new El('article',{id:'c1','data-math':''});
      var c2=new El('article',{id:'c2','data-math':''});
      var rc=new El('div',{id:'rc','data-math':''});
      var rv=new El('div',{id:'rv','class':'rawview'},[rc]);
      var sh=new El('div',{id:'sh','class':'nbshell'},[c1,c2,rv]);
      body.children.push(sh);sh.parentNode=body;
      await jvMath.all(sh);
      var mid=[c1.getAttribute('data-math'),c2.getAttribute('data-math'),
               rc.getAttribute('data-math')];
      jvMath.forget(sh);
      return [mid, log];
    """)
    assert out[0] == ["1", "1", ""]
    assert out[1][-1] == "clear:sh"
    assert "rc" not in ",".join(out[1][:-1])


# ---- the deck's half: a kept copy and the page's CSS ----------------------

def _run_deck_fns(names: list[str], expr: str):
    """Lift pure functions out of the assembled deck IIFE and evaluate
    ``expr`` (JSON-able) against them."""
    eng = js_engine()
    if eng is None:
        pytest.skip("no JS engine (node or VS Code) on this machine")
    cmd, env = eng
    deck = assets.deck_js()
    src = "\n".join(lift_fn(deck, n) for n in names)
    src += "\nconsole.log('@@'+JSON.stringify(" + expr + "));\n"
    with tempfile.TemporaryDirectory() as d:
        p = Path(d) / "run.js"
        p.write_text(src, encoding="utf-8")
        r = subprocess.run(cmd + [str(p)], capture_output=True, text=True,
                           env=env, timeout=60)
    assert r.returncode == 0, r.stderr[:2000]
    line = [ln for ln in r.stdout.splitlines() if ln.startswith("@@")][-1]
    return json.loads(line[2:])


_MJX = ('<div class="note"><p><mjx-container class="MathJax '
        'CtxtMenu_Attached_0" jax="CHTML" tabindex="0" '
        'ctxtmenu_counter="{n}" style="font-size: {fs}%; position: '
        'relative;"><mjx-math class="MJX-TEX"><mjx-c class="mjx-c1D467 '
        'TEX-I"></mjx-c></mjx-math></mjx-container> {word}</p></div>')


def test_a_kept_copy_is_not_stale_for_when_maths_was_typeset():
    """MathJax writes the ORDER it typeset equations in (ctxtmenu_counter)
    and the font scale it measured at the time into its markup. The page
    typesets as it is read now, so that order follows the scrolling --
    and "is the slide's copy out of date" must not say yes for it, nor
    may embStore spend the one put-back slot on it. A real change still
    reads as one."""
    a = _MJX.format(n=3, fs="103.8", word="ridge")
    b = _MJX.format(n=41, fs="113.1", word="ridge")
    c = _MJX.format(n=3, fs="103.8", word="trough")
    raw = '<div class="note"><p>$z$ ridge</p></div>'
    pairs = [(a, b), (a, c), (a, raw), (raw, raw), ("", ""), (None, a)]
    out = _run_deck_fns(
        ["sameCardHtml", "mjxNeutral"],
        "[" + ",".join(f"sameCardHtml({json.dumps(x)},{json.dumps(y)})"
                       for x, y in pairs) + "]")
    assert out == [True, False, False, True, True, False]
    deck = assets.deck_js()
    assert "return sameCardHtml(a,b)?'same':'stale';" in deck
    assert "if(!live||sameCardHtml(saved&&saved.html,live)) return;" in deck
    assert "&&!sameCardHtml(EMBED[key].html,String(e.html||'')))" in deck


def test_a_copy_of_the_page_css_carries_every_maths_glyph():
    """MathJax writes its stylesheet as text once, on its first typeset,
    and every glyph after that through insertRule -- which textContent
    never shows. With the page typesetting as it is read, the first pass
    is only the first screen's, so the standalone HTML export and the
    presenter window read MathJax's sheet rule by rule (measured: an
    exported deck went from 59 glyph rules to 140, all it uses)."""
    out = _run_deck_fns(
        ["styleText"],
        "[styleText({id:'MJX-CHTML-styles',textContent:'a{}',sheet:"
        "{cssRules:[{cssText:'a{}'},{cssText:'mjx-c.mjx-c1D467::before{}'}]}}),"
        "styleText({id:'',textContent:'body{}',sheet:{cssRules:[]}})]")
    assert out == ["a{}\nmjx-c.mjx-c1D467::before{}", "body{}"]
    deck = assets.deck_js()
    # both readers of the page's CSS (the HTML export's, which waits, and
    # the presenter window's, which cannot) go through it
    assert ("if(el.tagName==='STYLE') return Promise.resolve(styleText(el));"
            in deck)
    assert ("css+=(el.tagName==='STYLE'?styleText(el):sheetRulesText(el.sheet))"
            in deck)


def test_the_rest_is_typeset_at_idle_active_notebook_first_raw_view_last():
    """What the observer does not reach is typeset at idle: the notebook on
    screen before the ones behind it, a few equations per MathJax call
    (each call has a fixed cost), and a raw view not until it is open."""
    pre = r"""
    globalThis.IntersectionObserver=window.IntersectionObserver=function(){
      return {observe:function(){},unobserve:function(){}};};
    """
    out = _run_js(r"""
      fakeMathJax();
      function card(id,text){return new El('article',
        {id:id,'data-math':'',text:text});}
      var a1=card('a1','$x$'),a2=card('a2','$y$');
      var b1=card('b1','$p$ $q$ $r$ $s$ $t$'),b2=card('b2','$u$'),
          b3=card('b3','$v$ $w$ $x$ $y$'),b4=card('b4','$z$');
      var r1=new El('div',{id:'r1','data-math':'',text:'$k$'});
      var rv=new El('div',{id:'rv','class':'rawview'},[r1]);
      var A=new El('div',{id:'A','class':'nbshell'},[a1,a2]);
      var B=new El('div',{id:'B','class':'nbshell'},[b1,b2,b3,b4,rv]);
      [A,B].forEach((s)=>{body.children.push(s);s.parentNode=body;});
      APP.shells={a:{el:A},b:{el:B}};APP.active='b';
      jvMath.watch(A);jvMath.watch(B);
      await new Promise((r)=>setTimeout(r,1500));
      return [log, r1.getAttribute('data-math')];
    """, pre=pre)
    log, raw = out
    # B (on screen) first; a batch closes once it holds 8 equations or
    # 4 cards (b1 is 5, b2 1, b3 4: three cards); then on into A
    assert log == ["typeset:b1,b2,b3", "typeset:b4,a1,a2"]
    assert raw == ""


def test_the_idle_pass_stands_aside_while_you_scroll_or_type():
    """Scrolling, typing and clicking hold the idle pass off (only what
    nears the screen is set meanwhile); it resumes once they have been
    quiet for a moment, and finishes the job."""
    pre = r"""
    globalThis.IntersectionObserver=window.IntersectionObserver=function(){
      return {observe:function(){},unobserve:function(){}};};
    """
    out = _run_js(r"""
      fakeMathJax();
      var a=new El('article',{id:'a','data-math':'',text:'$x$'});
      var A=new El('div',{id:'A','class':'nbshell'},[a]);
      body.children.push(A);A.parentNode=body;
      APP.shells={a:{el:A}};APP.active='a';
      jvMath.watch(A);
      var during=[];
      for(var i=0;i<8;i++){
        fire(i%2?'wheel':'keydown');
        await new Promise((r)=>setTimeout(r,100));
        during.push(log.length);
      }
      await new Promise((r)=>setTimeout(r,1200));
      return [during, log, a.getAttribute('data-math')];
    """, pre=pre)
    during, log, state = out
    assert during == [0] * 8
    assert log == ["typeset:a"]
    assert state == "1"
    app = (ASSETS / "js" / "app.js").read_text(encoding="utf-8")
    assert ("['wheel','scroll','keydown','pointerdown','touchstart'].forEach("
            in app)
    assert ("document.addEventListener(t,touched,{passive:true,capture:true});"
            in app)


def test_a_kept_copy_sets_the_page_maths_once_not_on_every_slide():
    """A slide holding MathJax markup brought in whole (a kept copy) needs
    the glyph rules of every open notebook's maths, so the first one sets
    the rest of the page at once; the next slide drawn does not walk the
    page again -- until new maths arrives. A closed raw view never counts
    as waiting."""
    out = _run_js(r"""
      fakeMathJax();
      await jvMath.ensure();
      var c1=new El('article',{id:'c1','data-math':''});
      var rc=new El('div',{id:'rc','data-math':''});
      var rv=new El('div',{id:'rv','class':'rawview'},[rc]);
      var sh=new El('div',{id:'sh','class':'nbshell'},[c1,rv]);
      body.children.push(sh);sh.parentNode=body;
      var walks=0,q=document.querySelectorAll;
      document.querySelectorAll=function(s){
        if(s==='[data-math=""]') walks++;return q(s);};
      function kept(){return new El('div',{id:'k'},
        [new El('mjx-container',{})]);}
      await jvMath.typeset(kept());
      await new Promise((r)=>setTimeout(r,30));
      var first=[log.slice(), walks];
      await jvMath.typeset(kept());await jvMath.typeset(kept());
      await new Promise((r)=>setTimeout(r,30));
      var later=walks;
      var c2=new El('article',{id:'c2','data-math':''});
      var sh2=new El('div',{id:'sh2','class':'nbshell'},[c2]);
      body.children.push(sh2);sh2.parentNode=body;
      jvMath.watch(sh2);
      await jvMath.typeset(kept());
      await new Promise((r)=>setTimeout(r,30));
      return [first, later, log, rc.getAttribute('data-math')];
    """)
    first, later, log, raw = out
    assert first == [["typeset:c1"], 1]
    assert later == 1                  # no second walk of the page
    assert "typeset:c2" in log         # new maths: the next one walks again
    assert raw == ""


# ---- the app server: the flag is kept with each rendered shell ------------

def test_the_app_page_fetches_mathjax_only_while_an_open_notebook_has_maths(
        tmp_path):
    """The app builds its page from kept shells (server/shells.py) as
    bytes, so whether a shell holds maths is asked once per rendering and
    kept with it; a notebook edited to drop its maths is a new rendering
    and the page stops fetching MathJax at load."""
    from junoview.server import shells
    from junoview.server.state import _app_page, _AppState

    def nb(md: str) -> str:
        return json.dumps({"cells": [
            {"cell_type": "markdown", "metadata": {}, "source": md}],
            "metadata": {}, "nbformat": 4, "nbformat_minor": 5})

    shells._SHELLS.clear()
    try:
        f = tmp_path / "a.ipynb"
        f.write_text(nb("Energy is $E = mc^2$."), encoding="utf-8")
        st = _AppState(tmp_path)
        st.note_open(f)
        page = _app_page(st).decode("utf-8")
        tag = re.search(r'<script async id="jv-mathjax"[^>]*>', page).group(0)
        assert f' src="{MJ_URL}"' in tag
        sh = shells.local_shell(shells.local_source(f, "a", str(f)),
                                lenient=True)
        assert sh.math is True and sh._math is True   # asked, and kept
        f.write_text(nb("No maths now."), encoding="utf-8")
        page = _app_page(st).decode("utf-8")
        tag = re.search(r'<script async id="jv-mathjax"[^>]*>', page).group(0)
        assert f' data-src="{MJ_URL}"' in tag
    finally:
        shells._SHELLS.clear()


def test_cards_nearing_the_screen_go_one_at_a_time_while_you_scroll():
    """What the observer sees coming (a screen ahead) is set a small batch
    a task -- one card at a time while you are scrolling, so no single
    task holds a frame back for long -- and all of it, in order."""
    pre = r"""
    globalThis.IntersectionObserver=window.IntersectionObserver=function(cb){
      window.__io=cb;return {observe:function(){},unobserve:function(){}};};
    """
    out = _run_js(r"""
      fakeMathJax();
      await jvMath.ensure();
      function card(id){return new El('article',
        {id:id,'data-math':'',text:'$x$'});}
      var cs=['c1','c2','c3'].map(card);
      var sh=new El('div',{id:'sh','class':'nbshell'},cs);
      body.children.push(sh);sh.parentNode=body;
      APP.shells={s:{el:sh}};APP.active='s';
      jvMath.watch(sh);
      function near(els){window.__io(els.map((e)=>({isIntersecting:true,
        target:e,boundingClientRect:{top:900,bottom:1000}})));}
      fire('wheel');
      near(cs);
      await new Promise((r)=>setTimeout(r,60));
      var moving=log.slice();
      await new Promise((r)=>setTimeout(r,400));   // the scroll has stopped
      var ds=['d1','d2','d3'].map(card);
      var sh2=new El('div',{id:'sh2','class':'nbshell'},ds);
      body.children.push(sh2);sh2.parentNode=body;
      jvMath.watch(sh2);
      log.length=0;
      near(ds);
      await new Promise((r)=>setTimeout(r,60));
      return [moving, log];
    """, pre=pre)
    moving, still = out
    assert moving == ["typeset:c1", "typeset:c2", "typeset:c3"]
    assert still == ["typeset:d1,d2,d3"]


def test_maths_set_while_hidden_is_measured_on_a_stand_in():
    """The page typesets as it is read, so the rest of a notebook is often
    set while it has no box: a tab in the background, the cards under Raw
    or Tree. MathJax then falls back to half an em for the ex-height --
    113% beside the 104% of what was set on screen (headings 127%), for
    good. A container with no box is measured on an unseen stand-in that
    carries its font instead; one with a box is measured as before."""
    eng = js_engine()
    if eng is None:
        pytest.skip("no JS engine")
    cmd, env = eng
    src = lift_fn(assets.app_js(), "measureHidden")
    js = r"""
var attached=[];
function N(box){this.box=box;this.parentNode=null;this.style={};}
N.prototype.getClientRects=function(){return this.box?[1]:[];};
N.prototype.cloneNode=function(){return new N(false);};
N.prototype.appendChild=function(c){c.parentNode=this;return c;};
N.prototype.remove=function(){attached.splice(attached.indexOf(this),1);};
var document={createElement:function(){return new N(true);},
  body:{appendChild:function(n){attached.push(n);return n;}}};
function getComputedStyle(n){return {fontFamily:'Serif X',fontSize:'17px'};}
""" + src + r"""
var seen=[];
var O={measureMetrics:function(t,fam){
  var p=t.parentNode,box=!!(p&&p.box);
  seen.push(box?('box '+(p.style.fontFamily||'own')+' '+(p.style.fontSize||''))
                :'no box');
  return box?{em:17,ex:7.8,containerWidth:300,lineWidth:1e6,scale:1.038}
            :{em:17,ex:8.5,containerWidth:1e6,lineWidth:1e6,scale:1.131};}};
measureHidden({startup:{output:O}});
measureHidden({startup:{output:O}});          // wrapped once, not twice
var hp=new N(false),ht=new N(false);hp.appendChild(ht);
var vp=new N(true),vt=new N(false);vp.appendChild(vt);
var h=O.measureMetrics(ht,false),v=O.measureMetrics(vt,false);
console.log('@@'+JSON.stringify([h.scale,h.ex,h.containerWidth,v.scale,
  seen,attached.length]));
"""
    with tempfile.TemporaryDirectory() as d:
        p = Path(d) / "run.js"
        p.write_text(js, encoding="utf-8")
        r = subprocess.run(cmd + [str(p)], capture_output=True, text=True,
                           env=env, timeout=60)
    assert r.returncode == 0, r.stderr[:3000]
    line = [ln for ln in r.stdout.splitlines() if ln.startswith("@@")][-1]
    h_scale, h_ex, h_cw, v_scale, seen, left = json.loads(line[2:])
    assert (h_scale, h_ex, h_cw) == (1.038, 7.8, 1e6)
    assert v_scale == 1.038
    assert seen == ["no box", "box Serif X 17px", "box own "]
    assert left == 0          # the stand-in is gone again


def test_a_kept_copy_does_not_carry_the_menus_reading_order():
    """MathJax's menu numbers each equation in the order the page set it
    -- the reading order, now -- so the same card copied in two sessions
    came out as different bytes on every save."""
    deck = assets.deck_js()
    body = lift_fn(deck, "cloneBody")
    assert "removeAttribute('ctxtmenu_counter')" in body
