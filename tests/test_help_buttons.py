"""The "?" -- the longer explanation, one click away (T624).

2026-10-11, user: "there is a lot of unnecessary text still. I think some
things have text that is not needed at all, then some text is too long
and should be behind a ? button, with just either no text or something
simple there instead."

The "?" is the ONE icon-only button the user allows; every other button
is words plus an icon. These are the fast checks: where a "?" may and may
not go, that every static one is a real disclosure button, that nothing
is set up per button (no work until one is opened), that the ask dialog
carries one, and -- run in node over a small stand-in DOM -- that the
component's click and keyboard paths do what the plan says. The Chromium
half is tests/test_help_buttons_in_a_browser.py.
"""

from __future__ import annotations

import json
import re
import subprocess
import tempfile
from html.parser import HTMLParser
from pathlib import Path

import pytest

from helpers_js import js_engine, lift_fn
from junoview import assets

VOID = {"area", "base", "br", "col", "embed", "hr", "img", "input", "link",
        "meta", "source", "track", "wbr"}

# section 2.7: never a "?" in a row the ribbon fitters measure
NO_Q_IDS = ("edit-tools", "rbn-tabs", "rbn-shelf", "deck-qat", "ab-tabs")
NO_Q_CLASSES = ("ribbon", "appbar")


class _Tree(HTMLParser):
    """Every .jv-q, with the ids and classes of the elements around it."""

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.stack: list[tuple[str, dict]] = []
        self.qs: list[tuple[dict, list[dict]]] = []

    def handle_starttag(self, tag, attrs):
        a = {k: (v or "") for k, v in attrs}
        if "jv-q" in a.get("class", "").split():
            self.qs.append((a, [s[1] for s in self.stack]))
        if tag not in VOID:
            self.stack.append((tag, a))

    def handle_startendtag(self, tag, attrs):
        self.handle_starttag(tag, attrs)
        if tag not in VOID:
            self.stack.pop()

    def handle_endtag(self, tag):
        for i in range(len(self.stack) - 1, -1, -1):
            if self.stack[i][0] == tag:
                del self.stack[i:]
                return


def _qs(html: str):
    t = _Tree()
    t.feed(html)
    return t.qs


def _static_qs():
    out = []
    for name in ("html/page.html", "html/shell.html", "html/deck.html"):
        out += [(name, a, up) for a, up in _qs(assets.load(name))]
    return out


def test_there_are_static_help_buttons_in_every_template_that_needs_one():
    names = [n for n, _a, _u in _static_qs()]
    # page: the custom view bar; shell: the outline's colour key; deck:
    # the panes, overlays and dialogs that hold their help in markup
    assert names.count("html/page.html") >= 1
    assert names.count("html/shell.html") == 1
    assert names.count("html/deck.html") >= 11


def test_no_help_button_sits_in_a_measured_row():
    for name, a, up in _static_qs():
        for anc in up:
            assert anc.get("id") not in NO_Q_IDS, (name, a, anc.get("id"))
            cls = anc.get("class", "").split()
            for c in NO_Q_CLASSES:
                assert c not in cls, (name, a, c)
    # and the ribbon's own scripts make none -- except the Ribbon layouts
    # gallery, a full-screen overlay, not the ribbon (E175)
    rib = assets.load("js/deck/05-figures-and-ribbon.js")
    assert "qBtn(" not in rib
    lay = assets.load("js/deck/07-ribbon-layouts.js")
    assert lay.count("qBtn(") == 1
    gal = lift_fn(lay, "openRibbonGallery")
    assert "var gt=ov.querySelector('.rbn-gt');" in gal and "qBtn(" in gal


def test_every_static_help_button_is_a_real_disclosure():
    for name, a, _up in _static_qs():
        if a.get("id") == "ask-q":
            # filled in on each question by askText (2.6)
            assert "hidden" in a and a.get("aria-expanded") == "false"
            continue
        assert a.get("type") == "button", (name, a)
        assert a.get("aria-expanded") == "false", (name, a)
        assert a.get("aria-label", "").startswith("Help: "), (name, a)
        assert (a.get("data-q", "").strip()
                or a.get("data-q-tpl", "").strip()), (name, a)
        assert "role" not in a, (name, a)   # a disclosure, not a tooltip


def test_a_help_button_neither_takes_clicks_nor_fades_out():
    """Two review findings (2026-10-12), driven in Chromium by
    tests/test_help_buttons_in_a_browser.py for every "?"; these are the
    rules that fixed them. The hit halo (::after, inset -4px) is
    positioned and paints over a plain button beside it, so a pane
    header's "?" keeps 6px on its right as on its left (Images' "Every
    slide" lost two thirds of its left edge). And three hosts whose own
    ink is a muted hint colour dimmed the inherited "?" under 3:1, so it
    wears the chrome's ink there, undimmed."""
    css = assets.load("css/app.css")
    assert "button.jv-q::after{content:\"\";position:absolute;inset:-4px;}" in css
    assert "margin:0 0 0 6px;" in css.split("button.jv-q{", 1)[1].split("}")[0]
    assert ".selpane-h>button.jv-q{margin-right:6px;}" in css
    assert (".md-help>button.jv-q,.tk-h>button.jv-q,.ckf-empty>button.jv-q{\n"
            "  color:var(--chrome-ink);opacity:1;}") in css
    # and those are where the "?"s are: the Markdown hint, the talk
    # pane's heading, Images' header, the empty Version history
    deck = assets.load("html/deck.html")
    assert re.search(r'class="md-help"[^>]*>(?:(?!</div>).)*class="jv-q"',
                     deck, re.S)
    assert re.search(r'<div class="tk-h"><span>This talk</span>\s*'
                     r'<button type="button" class="jv-q"', deck)
    assert re.search(r'id="imgpane"(?:(?!</div>).)*class="selpane-h"'
                     r'(?:(?!</div>).)*class="jv-q"', deck, re.S)
    assert "ckf-empty" in assets.load("js/app.js")


def test_help_text_is_short_paragraphs():
    """1 to 4 paragraphs, plain sentences (section 1). The words are
    counted loosely -- a key such as the Header codes runs longer -- but
    nothing in a "?" is a wall."""
    texts = [a.get("data-q", "") for _n, a, _u in _static_qs()]
    deck = assets.deck_js()
    for m in re.finditer(r"qBtn\(((?:\(?'(?:[^'\\]|\\.)*'\s*(?:\+|\?|:)?\s*)+)",
                         deck):
        texts.append("".join(re.findall(r"'((?:[^'\\]|\\.)*)'",
                                        m.group(1))))
    for t in texts:
        if not t:
            continue
        paras = [p for p in re.split(r"\n[ \t]*\n|\\n\\n", t) if p.strip()]
        assert 1 <= len(paras) <= 4, t[:80]
        assert len(re.findall(r"[A-Za-z]+", t)) < 140, t[:80]


def test_nothing_is_set_up_until_a_help_button_is_opened():
    app = assets.app_js()
    # the popover is made in the open path and nowhere else
    assert app.count("pop.className='jv-qpop';") == 1
    assert "pop.className='jv-qpop';" in lift_fn(app, "qOpen")
    assert app.count("jv-qpop") <= 3
    # no listener per button: the factory only builds markup
    make = app.split("APP.qBtn=function(text,topic){")[1].split("\n  };")[0]
    assert "addEventListener" not in make
    # scroll and resize are listened to only while one is open
    assert ("window.addEventListener('scroll',qScroll,"
            "{capture:true,passive:true});") in lift_fn(app, "qOpen")
    assert "window.removeEventListener('scroll',qScroll,true);" in \
        lift_fn(app, "qClose")


def test_the_keys_are_heard_first_and_cost_nothing_when_closed():
    app = assets.app_js()
    q = app.index("  window.addEventListener('keydown',function(e){\n"
                  "    if(!openQ) return;")
    # before every other key listener the page has
    first = min(i for i in (app.find("addEventListener('keydown'"),
                            app.find('addEventListener("keydown"'))
                if i >= 0)
    assert first == q + len("  window.")
    block = app[q:app.index("},true);", q)]
    assert "e.key!=='Escape'" in block
    assert "e.preventDefault();e.stopImmediatePropagation();" in block
    assert "qClose(true);" in block
    # the click listener is one, on document, in capture
    assert app.count("},true);\n  window.addEventListener('keydown'") == 1


def test_the_question_dialog_carries_a_help_button():
    html = assets.deck_html()
    head = html.split('<div class="aa-box ask-box">')[1].split("</div>")[0]
    # a sibling of the title, never inside it: the title is rewritten
    assert re.search(r'<span class="eq-t" id="ask-t">Name</span>\s*'
                     r'<!--.*?-->\s*<button type="button" class="jv-q" '
                     r'id="ask-q" hidden', head, re.S)
    js = assets.load("js/deck/60-saving-and-export.js")
    ask = lift_fn(js, "askText")
    assert "askQ.hidden=!o.help;" in ask
    assert "askQ.setAttribute('data-q',o.help||'');" in ask
    assert "askQ.setAttribute('aria-label','Help: '+(o.title||''));" in ask
    assert "qShut();" in ask
    assert "help:o.help" in lift_fn(js, "askYes")
    assert "help:o.help" in lift_fn(js, "askTell")
    secs = assets.load("js/deck/55-sections-and-strip.js")
    assert "function furnEdit(key,label,hint,dflt,help){" in secs
    assert "help:help," in lift_fn(secs, "furnEdit")
    # the four questions whose long text moved behind it
    deck = assets.deck_js()
    for fn, part in (("pptxConfirmLosses", "help:'A .pptx has no LaTeX"),
                     ("narrAsk", "help:'Kept, each slide speaks"),
                     ("inkLeave", "help:'Kept, each stroke becomes")):
        assert part in lift_fn(deck, fn), fn
    assert ",FURN_HELP);" in deck


# ------------------------------------------------- the component, in node

_FAKE_DOM = r"""
function El(tag){this.tagName=tag.toUpperCase();this.children=[];
  this.attrs={};this.style={};this.parentNode=null;this.className='';
  this.id='';this.isConnected=true;this._text='';this.focused=false;}
El.prototype.appendChild=function(c){c.parentNode=this;this.children.push(c);return c;};
El.prototype.insertBefore=function(c,ref){c.parentNode=this;
  var i=ref?this.children.indexOf(ref):-1;
  if(i<0) this.children.push(c); else this.children.splice(i,0,c);return c;};
El.prototype.removeChild=function(c){var i=this.children.indexOf(c);
  if(i>=0) this.children.splice(i,1);c.parentNode=null;c.isConnected=false;return c;};
Object.defineProperty(El.prototype,'nextSibling',{get:function(){
  var p=this.parentNode;if(!p) return null;var i=p.children.indexOf(this);
  return p.children[i+1]||null;}});
Object.defineProperty(El.prototype,'textContent',{get:function(){
  if(this.nodeType===3||!this.children.length) return this._text;
  return this.children.map(function(c){return c.textContent;}).join('');},
  set:function(v){this._text=String(v);this.children=[];}});
El.prototype.nodeType=1;
El.prototype.setAttribute=function(k,v){this.attrs[k]=String(v);};
El.prototype.getAttribute=function(k){return k in this.attrs?this.attrs[k]:null;};
El.prototype.removeAttribute=function(k){delete this.attrs[k];};
El.prototype.getBoundingClientRect=function(){
  return this.rect||{left:100,top:100,right:118,bottom:118,width:18,height:18};};
El.prototype.getClientRects=function(){return [1];};
El.prototype.contains=function(n){
  for(;n;n=n.parentNode) if(n===this) return true;return false;};
El.prototype.closest=function(sel){var cls=sel.replace(/^\./,'');
  for(var n=this;n;n=n.parentNode)
    if(n.nodeType===1&&(' '+n.className+' ').indexOf(' '+cls+' ')>=0) return n;
  return null;};
El.prototype.focus=function(){this.focused=true;};
function Txt(t){this._text=t;this.parentNode=null;this.children=[];}
Txt.prototype=Object.create(El.prototype);Txt.prototype.nodeType=3;
var listeners={doc:{},win:{}};
var document={createElement:function(t){return new El(t);},
  createTextNode:function(t){return new Txt(t);},
  createComment:function(t){return new Txt('');},
  addEventListener:function(k,f,c){(listeners.doc[k]=listeners.doc[k]||[]).push([f,c]);},
  querySelector:function(){return null;},getElementById:function(){return null;}};
var window={innerWidth:1280,innerHeight:600,
  addEventListener:function(k,f,c){(listeners.win[k]=listeners.win[k]||[]).push([f,c]);},
  removeEventListener:function(k,f){var l=listeners.win[k]||[];
    listeners.win[k]=l.filter(function(x){return x[0]!==f;});}};
var APP={};
function ev(target,key){var e={target:target,key:key,stopped:0,prevented:0,
  immediate:0};e.stopPropagation=function(){e.stopped++;};
  e.preventDefault=function(){e.prevented++;};
  e.stopImmediatePropagation=function(){e.immediate++;};return e;}
"""


def _run_component(script: str) -> dict:
    eng = js_engine()
    if eng is None:
        pytest.skip("no JS engine")
    cmd, env = eng
    app = assets.app_js()
    start = app.index('  /* ---- T624: THE "?" -- THE LONGER EXPLANATION')
    end = app.index("  function api(path,body){", start)
    body = _FAKE_DOM + app[start:end] + script
    with tempfile.TemporaryDirectory() as d:
        p = Path(d) / "q.js"
        p.write_text(body, encoding="utf-8")
        r = subprocess.run(cmd + [str(p)], capture_output=True, text=True,
                           env=env, timeout=60)
    assert r.returncode == 0, r.stderr[:2000]
    return json.loads(r.stdout.strip().splitlines()[-1])


def test_the_component_opens_closes_and_says_so():
    got = _run_component(r"""
var host=new El('div');host.className='dlg';
var b=APP.qBtn('First paragraph.\n\nSecond, line one\nline two','Thing');
host.appendChild(b);
var other=APP.qBtn('Other.','Other');host.appendChild(other);
var click=listeners.doc.click[0], key=listeners.win.keydown[0];
var out={clickCapture:click[1]===true,keyCapture:key[1]===true,
  listeners:[(listeners.doc.click||[]).length,(listeners.win.keydown||[]).length],
  label:b.getAttribute('aria-label'),type:b.type,text:b.textContent,
  closed:b.getAttribute('aria-expanded')};
var e=ev(b);click[0](e);
var pop=b.nextSibling;
out.open=b.getAttribute('aria-expanded');
out.controls=b.getAttribute('aria-controls')===pop.id;
out.popClass=pop.className;out.stoppedHost=e.stopped>0&&e.prevented>0;
out.paras=pop.children.length;
out.secondHasBreak=pop.children[1].children.map(function(c){return c.tagName||'#';});
out.scrollOn=(listeners.win.scroll||[]).length;
// a key that is not Escape does nothing
var k0=ev(b,'a');key[0](k0);out.otherKey=k0.immediate;
// another "?" closes the first
var e2=ev(other);click[0](e2);
out.afterOther=[b.getAttribute('aria-expanded'),other.getAttribute('aria-expanded'),
  host.children.filter(function(c){return c.className==='jv-qpop';}).length];
// Escape closes it alone and gives the keys back to the "?"
var k=ev(other,'Escape');key[0](k);
out.esc=[other.getAttribute('aria-expanded'),k.immediate,k.prevented,other.focused,
  host.children.filter(function(c){return c.className==='jv-qpop';}).length,
  (listeners.win.scroll||[]).length];
// with nothing open, Escape is somebody else's
var k2=ev(host,'Escape');key[0](k2);out.escClosed=k2.immediate+k2.prevented;
// the same "?" twice toggles
click[0](ev(b));click[0](ev(b));out.toggle=b.getAttribute('aria-expanded');
// an outside click closes it and carries on
click[0](ev(b));var e3=ev(host);click[0](e3);
out.outside=[b.getAttribute('aria-expanded'),e3.stopped];
// a click inside the popover keeps it
click[0](ev(b));var inner=b.nextSibling.children[0];var e4=ev(inner);click[0](e4);
out.inside=b.getAttribute('aria-expanded');
APP.qClose();out.qClose=b.getAttribute('aria-expanded');
console.log(JSON.stringify(out));
""")
    assert got["clickCapture"] and got["keyCapture"]
    assert got["listeners"] == [1, 1]          # two, for every "?" there is
    assert got["label"] == "Help: Thing" and got["type"] == "button"
    assert got["text"] == "?" and got["closed"] == "false"
    assert got["open"] == "true" and got["controls"]
    assert got["popClass"] == "jv-qpop" and got["stoppedHost"]
    assert got["paras"] == 2
    assert got["secondHasBreak"] == ["#", "BR", "#"]   # text, never HTML
    assert got["scrollOn"] == 1
    assert got["otherKey"] == 0
    assert got["afterOther"] == ["false", "true", 1]
    assert got["esc"] == ["false", 1, 1, True, 0, 0]
    assert got["escClosed"] == 0
    assert got["toggle"] == "false"
    assert got["outside"] == ["false", 0]
    assert got["inside"] == "true"
    assert got["qClose"] == "false"


def test_the_popover_stays_on_a_small_laptop():
    """Placed below, or above when there is no room, and inside the
    window either way -- at 1280x600, the smallest size it must fit."""
    got = _run_component(r"""
var click=listeners.doc.click[0][0];
var out=[];
[[1260,100],[20,560],[640,300]].forEach(function(at){
  var host=new El('div');host.className='h';
  var b=APP.qBtn('Words.','T');host.appendChild(b);
  b.rect={left:at[0],top:at[1],right:at[0]+18,bottom:at[1]+18,width:18,height:18};
  var origInsert=host.insertBefore;
  host.insertBefore=function(c,ref){origInsert.call(host,c,ref);
    c.getBoundingClientRect=function(){var l=parseFloat(c.style.left),
      t=parseFloat(c.style.top);return {left:l,top:t,width:320,height:120,
      right:l+320,bottom:t+120};};return c;};
  click(ev(b));var p=b.nextSibling;
  out.push([parseFloat(p.style.left),parseFloat(p.style.top)]);
  APP.qClose();
});
console.log(JSON.stringify(out));
""")
    for left, top in got:
        assert 8 <= left <= 1280 - 320 - 8
        assert 8 <= top <= 600 - 120 - 8
    # the one near the foot opened above its "?"
    assert got[1][1] < 560


def test_only_a_scroll_that_moves_the_button_closes_it():
    """A scroll that carries the "?" away closes its popover; the
    popover's own scroll, or a pane beside it scrolling, does not."""
    got = _run_component(r"""
var page=new El('div');page.className='page';
var host=new El('div');host.className='dlg';page.appendChild(host);
var side=new El('div');side.className='preview';page.appendChild(side);
var b=APP.qBtn('Words.','T');host.appendChild(b);
var click=listeners.doc.click[0][0];
function scroll(t){(listeners.win.scroll||[]).slice().forEach(function(l){
  l[0]({target:t});});}
var out=[];
click(ev(b));var pop=b.nextSibling;
scroll(pop);out.push(b.getAttribute('aria-expanded'));
scroll(side);out.push(b.getAttribute('aria-expanded'));
scroll(host);out.push(b.getAttribute('aria-expanded'));
click(ev(b));scroll(document);out.push(b.getAttribute('aria-expanded'));
console.log(JSON.stringify(out));
""")
    assert got == ["true", "true", "false", "false"]
