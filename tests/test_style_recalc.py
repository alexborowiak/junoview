"""Style recalculation stays local (2026-10-09, the speed push).

At 4x CPU throttle, style recalculation was 40-70% of the main thread of
every editor gesture. Almost all of it came from selectors and custom
properties that made a small change restyle the whole document:

* ``body:has(...)`` -- the browser re-checks a :has() on its anchor after
  any DOM change beneath it, and the check walks everything under the
  anchor. Anchored on body that is the whole document, many times per
  gesture. A descendant :has() on #deck or #edit-tools is the same thing
  on a smaller scale. State the code already knows (a pane is open, the
  shelf is out) is a class its owner sets; what only the markup knows
  (an empty text box, a checked radio) is a :has() with a CHILD
  combinator, which looks at one level.
* an inherited custom property written on <html> or #deck on every
  pointermove (--film-w, --dc-w, --pane-w) or on every trip Home
  (--chrome-h) restyles every element that inherits it. The live value
  goes on the elements that read it.
* a rule whose last step names no class (``.apptop>:not(.nb-filebar)``)
  restyles the whole subtree whenever its condition changes.
* Colourful's ribbon-tab zone on body changed --accent for the whole
  document on every selection and tab click, under an editor that
  covers it.

These tests hold each of those shut. The behaviour tests run the
shipped functions in node over a small fake DOM (helpers_js); the rest
read the source, which is what can drift.
"""

from __future__ import annotations

import json
import re
import subprocess
from html.parser import HTMLParser

import pytest

from helpers_js import js_engine, lift_fn
from junoview import assets

CSS_FILES = ("css/core.css", "css/app.css", "css/deck.css", "css/widget.css",
             "css/widget-media.css")


def _strip_comments(css: str) -> str:
    return re.sub(r"/\*.*?\*/", "", css, flags=re.S)


def _all_css() -> dict[str, str]:
    return {f: _strip_comments(assets.load(f)) for f in CSS_FILES}


def _has_sites(css: str):
    """Every :has( in a stylesheet: (anchor compound, argument)."""
    for m in re.finditer(r":has\(", css):
        # the argument, to its matching paren
        depth, k = 1, m.end()
        while depth:
            if css[k] == "(":
                depth += 1
            elif css[k] == ")":
                depth -= 1
            k += 1
        arg = css[m.end():k - 1]
        # the compound it hangs on: back to a combinator outside any
        # parentheses (`:not(:has(...))` hangs on what :not hangs on)
        depth, j = 0, m.start() - 1
        while j >= 0:
            c = css[j]
            if c == ")":
                depth += 1
            elif c == "(":
                depth -= 1
            elif depth <= 0 and c in " >+~,{};\n":
                break
            j -= 1
        yield css[j + 1:m.start()], arg


ANCHORS = re.compile(
    r"(^|[^\w-])(body|html)(?![\w-])|:root|#deck(?![\w-])|\.deck(?![\w-])"
    r"|#edit-tools(?![\w-])|\.edit-tools(?![\w-])")


def _top_level_parts(arg: str) -> list[str]:
    parts, depth, cur = [], 0, ""
    for c in arg:
        if c == "(":
            depth += 1
        elif c == ")":
            depth -= 1
        if c == "," and depth == 0:
            parts.append(cur)
            cur = ""
        else:
            cur += c
    return parts + [cur]


def test_no_has_on_the_document_itself():
    for name, css in _all_css().items():
        for bad in ("body:has(", "html:has(", ":root:has("):
            assert bad not in css, (name, bad)
    # ...nor in a style a script writes (comments may tell the history)
    assert "body:has(" not in _strip_comments(assets.app_js())
    assert "body:has(" not in _strip_comments(assets.deck_js())


def test_no_descendant_has_on_the_big_anchors():
    """body, html, #deck/.deck and #edit-tools/.edit-tools hold thousands
    of elements: a :has() looking at their DESCENDANTS is re-walked over
    all of them after every change inside."""
    seen = 0
    for name, css in _all_css().items():
        for anchor, arg in _has_sites(css):
            seen += 1
            if not ANCHORS.search(anchor):
                continue
            for part in _top_level_parts(arg):
                assert part.lstrip()[:1] in (">", "+", "~"), (name, anchor, arg)
    assert seen >= 5   # the scanner found the rules it is meant to judge


def test_every_has_looks_one_step_away():
    """The ratchet the rule above is the floor of: every :has() in the
    stylesheets is relative (>, + or ~). A plain descendant :has() on any
    container re-walks that container after every change inside it; a
    state the code knows belongs in a class its owner sets."""
    for name, css in _all_css().items():
        for anchor, arg in _has_sites(css):
            for part in _top_level_parts(arg):
                assert part.lstrip()[:1] in (">", "+", "~"), (name, anchor, arg)


def test_the_child_combinators_match_the_markup():
    """The `>` in each relative :has() is only right while the thing it
    looks for is the anchor's CHILD."""
    deck_html = assets.load("html/deck.html")
    page_html = assets.load("html/page.html")
    # #animpane sits directly in the stage wrapper (6-space indent level)
    wrap = deck_html.index('<div class="deck-stagewrap" id="deck-stagewrap">')
    pane = deck_html.index('<aside class="selpane animpane" id="animpane"')
    assert deck_html[wrap:pane].count("<div") - deck_html[wrap:pane].count(
        "</div>") == 1, "animpane must be a child of .deck-stagewrap"
    # #pres-name is a child of .dc-name
    at = deck_html.index('<div class="dc-block dc-name">')
    assert re.search(r'<div class="dc-block dc-name">\s*<div[^>]*></div>\s*'
                     r'<input id="pres-name"', deck_html[at:at + 400])
    # each scope label's radio/checkbox is its own child
    for m in re.finditer(r'<label class="auto-(slide-scope|anim)"[^>]*>\s*'
                         r'(<input[^>]*>)?', page_html):
        assert m.group(2), m.group(0)
    js = assets.deck_js()
    assert "w.className='deck-pres-acts';" in js
    assert "b.type='button';b.className='deck-pres-act'+(a[3]?' on':'');" in js
    assert "w.appendChild(b);" in js


class _Kids(HTMLParser):
    """The direct children's classes of the element with id `root`."""

    VOID = {"input", "img", "br", "meta", "link", "hr", "source", "wbr"}

    def __init__(self, root: str):
        super().__init__()
        self.root, self.depth, self.kids = root, None, []

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if self.depth is None:
            if a.get("id") == self.root:
                self.depth = 0
            return
        if self.depth == 0:
            self.kids.append((a.get("class") or "").split())
        if tag not in self.VOID:
            self.depth += 1

    def handle_endtag(self, tag):
        if self.depth is None or tag in self.VOID:
            return
        if self.depth == 0:
            self.depth = None
            self.root = object()     # never match again
            return
        self.depth -= 1


def _children(html: str, root: str) -> list[list[str]]:
    p = _Kids(root)
    p.feed(html)
    return p.kids


def test_home_hides_the_header_children_by_name():
    css = assets.app_css()
    html = assets.load("html/page.html")
    m = re.search(r"body\.welcoming\.tabs-row-on \.apptop>:is\(([^)]*)\),\n"
                  r"body\.welcoming\.tabs-row-on \.nb-filebar>:is\(([^)]*)\)\{",
                  css)
    assert m, "the two named lists"
    top = {c.strip(".") for c in m.group(1).split(",")}
    bar = {c.strip(".") for c in m.group(2).split(",")}
    top_kids = _children(html, "apptop")
    bar_kids = _children(html, "nb-filebar")
    assert top_kids and bar_kids
    # every child Home hides is named, and every name is a child
    for kid in top_kids:
        if "nb-filebar" in kid:
            continue
        assert top & set(kid), ("apptop child not hidden at Home", kid)
    for kid in bar_kids:
        if {"open-tabs-row", "nb-file-spacer"} & set(kid):
            continue
        assert bar & set(kid), ("file bar child not hidden at Home", kid)
    assert top <= {c for k in top_kids for c in k}
    assert bar <= {c for k in bar_kids for c in k}
    assert ".apptop>:not(" not in css and ".nb-filebar>:not(" not in css


def test_no_transition_all():
    """`transition:all` compares every animatable property on every
    restyle of the element, and eases geometry a class changes (T487)."""
    for name, css in _all_css().items():
        assert not re.search(r"transition:\s*all\b", css), name


# ---- the owners of the state classes ---------------------------------

def test_the_variables_pane_class_is_set_with_the_pane():
    js = assets.app_js()
    at = js.index("  /* ---- the Variables PANE:")
    block = js[at:js.index("  })();", at)]
    assert ("      pane.hidden=!open;\n" in block)
    # set() is the pane's one writer, and the class rides with it
    assert block.count("pane.hidden=") == 1
    assert block.index("pane.hidden=!open;") < block.index(
        "document.body.classList.toggle('vars-open',!!open);")
    every = js + assets.deck_js()
    assert every.count("$('#varspane')") == 1
    css = assets.app_css()
    assert "body.vars-open .docfind{" in css
    assert "  body.vars-open .stage{" in css


def test_the_reading_order_class_comes_and_goes_with_its_panel():
    js = assets.deck_js()
    close = lift_fn(js, "rdClose")
    assert "if(p) p.remove();" in close
    assert "document.body.classList.remove('rd-order-on');" in close
    opener = lift_fn(js, "openReadingOrder")
    # a reopen clears first, an empty slide adds nothing, the class
    # follows the panel into the page
    assert opener.index("rdClose();") < opener.index("p.id='rd-order'")
    assert opener.index("document.body.appendChild(p);") < opener.index(
        "document.body.classList.add('rd-order-on');")
    assert opener.index("return;") < opener.index("classList.add('rd-order-on')")
    # nothing else makes or removes the panel
    assert js.count("'#rd-order'") == 2   # rdClose and rdKey
    assert js.count("p.id='rd-order'") == 1


def test_the_shelf_class_comes_and_goes_with_the_shelf():
    js = assets.deck_js()
    op = lift_fn(js, "rbnShelfOpen")
    cl = lift_fn(js, "rbnShelfClose")
    assert "    sh.hidden=false;\n    rbnShelfMark(true);" in op
    assert "    sh.hidden=true;\n    rbnShelfMark(false);" in cl
    # the shelf's `hidden` has no other writer: every function that looks
    # the shelf up is one of the two, or only reads it
    owners = set()
    for m in re.finditer(re.escape("$('#rbn-shelf')"), js):
        owners.add(re.findall(r"function (\w+)\(", js[:m.start()])[-1])
    assert {"rbnShelfClose", "rbnShelfOpen"} < owners
    for name in owners - {"rbnShelfClose", "rbnShelfOpen"}:
        assert "sh.hidden=" not in lift_fn(js, name), name


def _node(tmp_path, code: str):
    engine = js_engine()
    if engine is None:
        pytest.skip("JavaScript engine unavailable")
    cmd, env = engine
    script = tmp_path / "run.js"
    script.write_text(FAKE_DOM + code, encoding="utf-8")
    r = subprocess.run(cmd + [str(script)], env=env, capture_output=True,
                       text=True, timeout=60)
    assert r.returncode == 0, r.stderr[:3000]
    return json.loads(r.stdout.strip().splitlines()[-1])


FAKE_DOM = r"""
var WRITES=0;
function El(id,cls){this.id=id||'';this.className=cls||'';this.children=[];
  this.parentNode=null;this.attrs={};this.nodeType=1;
  var self=this;
  this.style={props:{},
    setProperty:function(k,v){if(this.props[k]!==v)WRITES++;this.props[k]=v;},
    removeProperty:function(k){delete this.props[k];},
    getPropertyValue:function(k){return this.props[k]||'';}};
  function has(c){return self.className.split(' ').indexOf(c)>=0;}
  this.classList={contains:has,
    add:function(c){if(!has(c))self.className=(self.className+' '+c).trim();
      WRITES++;},
    remove:function(c){self.className=self.className.split(' ')
      .filter(function(x){return x!==c;}).join(' ');WRITES++;},
    toggle:function(c,on){if(on===undefined)on=!has(c);
      if(on)this.add(c);else this.remove(c);return on;}};
}
El.prototype.getAttribute=function(k){
  return k in this.attrs?this.attrs[k]:null;};
El.prototype.setAttribute=function(k,v){this.attrs[k]=String(v);WRITES++;};
El.prototype.removeAttribute=function(k){delete this.attrs[k];WRITES++;};
El.prototype.hasAttribute=function(k){return k in this.attrs;};
El.prototype.appendChild=function(c){
  if(c.parentNode){var s=c.parentNode.children;s.splice(s.indexOf(c),1);}
  c.parentNode=this;this.children.push(c);return c;};
El.prototype.contains=function(o){
  for(var e=o;e;e=e.parentNode)if(e===this)return true;return false;};
El.prototype.matches=function(sel){
  return sel.split(',').some(function(s){s=s.trim();
    if(s[0]==='.')return this.classList.contains(s.slice(1));
    if(s[0]==='#')return this.id===s.slice(1);return false;},this);};
El.prototype.closest=function(sel){
  for(var e=this;e&&e.matches;e=e.parentNode)if(e.matches(sel))return e;
  return null;};
El.prototype.querySelectorAll=function(sel){var out=[];
  (function walk(n){n.children.forEach(function(c){
    if(c.matches(sel))out.push(c);walk(c);});})(this);return out;};
var ROOT=new El('','root');
var document={body:new El('','body'),getElementById:function(id){
  var hit=null;(function walk(n){n.children.forEach(function(c){
    if(!hit&&c.id===id)hit=c;walk(c);});})(ROOT);return hit;}};
ROOT.appendChild(document.body);
function $(sel,root){return (root||ROOT).querySelectorAll(sel)[0]||null;}
function $$(sel,root){return (root||ROOT).querySelectorAll(sel);}
"""


def test_object_group_order_is_written_where_the_controls_land(tmp_path):
    js = assets.deck_js()
    code = ("var RBN_FMT_ORD;" + js[js.index("  var RBN_FMT_ORD=["):
                                    js.index("  function rbnFmtOrder(){")]
            + lift_fn(js, "rbnFmtOrder") + r"""
var rbnShelfFor=null;
var bar=document.body.appendChild(new El('edit-tools','edit-tools ribbon'));
var shelf=bar.appendChild(new El('rbn-shelf','rbn-shelf'));
var sbody=shelf.appendChild(new El('rbn-shelf-body','rbn-shelf-body'));
function grp(n){return bar.appendChild(new El('','rbn-grp g'+n));}
var g1=grp(1),g2=grp(2),g3=grp(3),g4=grp(4);
function put(g,id){var row=g.children[0]||g.appendChild(new El('','rbn-row'));
  return row.appendChild(new El(id,''));}
put(g1,'fmt-srcwrap');put(g2,'fmt-opwrap');put(g2,'fmt-alignwrap');
var geo=put(g3,'fmt-geom-xy');
var out={};
rbnFmtOrder();
out.first=[g1,g2,g3,g4].map(function(g){return g.getAttribute('data-fmt-ord');});
WRITES=0;rbnFmtOrder();out.again=WRITES;
// a row parked on the shelf still belongs to its group
sbody.appendChild(geo.parentNode);rbnShelfFor=g3;
rbnFmtOrder();out.shelved=g3.getAttribute('data-fmt-ord');
// a layout that moves the control takes the order with it
g4.appendChild(new El('','rbn-row')).appendChild(geo);rbnShelfFor=null;
rbnFmtOrder();
out.moved=[g3.getAttribute('data-fmt-ord'),g4.getAttribute('data-fmt-ord')];
console.log(JSON.stringify(out));
""")
    got = _node(tmp_path, code)
    # g2 holds opwrap AND alignwrap: the later rule (align, 4) wins
    assert got["first"] == ["0", "4", "3", None]
    assert got["again"] == 0          # no write when nothing changed
    assert got["shelved"] == "3"
    assert got["moved"] == [None, "3"]
    # ...and it runs where the layout engine has put every control
    lay = lift_fn(js, "applyRibbonLayout")
    assert lay.index("rbnRestoreHome();") < lay.index("rbnFmtOrder();")
    assert lay.index("rbnFmtOrder();") < lay.index("showFmt();")
    css = assets.deck_css()
    for o in ("0", "2", "3", "4", "5"):
        rule = f'.et-fmt .rbn-grp[data-tab="object"][data-fmt-ord="{o}"]{{order:{o};}}'
        assert rule in css
        # after the class rules: the :has() rules carried an id's weight
        assert css.index(rule) > css.index(
            '.et-fmt .rbn-grp[data-tab="object"].rbn-clones{order:6;}')


def test_the_shelf_mark_writes_only_on_a_change(tmp_path):
    js = assets.deck_js()
    got = _node(tmp_path, lift_fn(js, "rbnShelfMark") + r"""
var bar=document.body.appendChild(new El('edit-tools','edit-tools ribbon'));
var out=[];
rbnShelfMark(true);out.push(bar.className,WRITES);
rbnShelfMark(true);out.push(WRITES);
rbnShelfMark(false);out.push(bar.className,WRITES);
rbnShelfMark(false);out.push(WRITES);
console.log(JSON.stringify(out));
""")
    assert got == ["edit-tools ribbon shelf-open", 1, 1,
                   "edit-tools ribbon", 2, 2]


def test_the_theme_zone_waits_for_the_page_while_the_editor_covers_it(
        tmp_path):
    app = assets.app_js()
    head = app[app.index("  var THEME_ZONES=["):app.index("  function zoneOn(")]
    code = (head + lift_fn(app, "zoneOn") + lift_fn(app, "zoneBodySync")
            + lift_fn(app, "setThemeZone") + r"""
var body=document.body,out={};
var deck=body.appendChild(new El('deck','deck'));
var docs=body.appendChild(new El('docs','docs'));
var top=body.appendChild(new El('apptop','apptop'));
var rail=body.appendChild(new El('presrail','presrail'));
setThemeZone('home');
out.reader=[body.getAttribute('data-theme-zone'),deck.getAttribute('data-theme-zone'),
  docs.getAttribute('data-theme-zone'),rail.getAttribute('data-theme-zone')];
body.classList.add('slide-editing');
setThemeZone('design');
out.editing=[body.getAttribute('data-theme-zone'),deck.getAttribute('data-theme-zone'),
  docs.getAttribute('data-theme-zone'),rail.getAttribute('data-theme-zone')];
WRITES=0;setThemeZone('design');out.same=WRITES;
setThemeZone('nonsense');out.bad=deck.getAttribute('data-theme-zone');
setThemeZone('object');
body.classList.remove('slide-editing');zoneBodySync();
out.left=[body.getAttribute('data-theme-zone'),deck.getAttribute('data-theme-zone')];
console.log(JSON.stringify(out));
""")
    got = _node(tmp_path, code)
    assert got["reader"] == ["home", "home", None, "home"]
    # under the editor the page keeps its zone; what shows takes the new one
    assert got["editing"] == ["home", "design", None, "design"]
    assert got["same"] == 0
    assert got["bad"] is None
    # ...and the page catches up as soon as the editor stops covering it
    assert got["left"] == ["object", "object"]
    # the catching up is wired to body's class and to anything mounted
    assert ("}).observe(document.body,{childList:true,attributes:true,\n"
            "    attributeFilter:['class']});") in app
    css = assets.core_css()
    for zone in ("home", "design", "object", "present"):
        assert f'body.th-colorful [data-theme-zone="{zone}"]' in css


def test_the_pane_width_goes_on_what_reads_it(tmp_path):
    js = assets.deck_js()
    got = _node(tmp_path, "var paneWNow='';" + lift_fn(js, "paneWSet") + r"""
var deckEl=document.body.appendChild(new El('deck','deck'));
var st=deckEl.appendChild(new El('deck-stage','deck-stage'));
var zb=deckEl.appendChild(new El('deck-zoombar','deck-zoombar'));
var p1=deckEl.appendChild(new El('selpane','selpane'));
var p2=deckEl.appendChild(new El('animpane','selpane animpane'));
paneWSet('300px');
var out={vals:[st,zb,p1,p2,deckEl].map(function(e){
  return e.style.getPropertyValue('--pane-w');}),now:paneWNow};
WRITES=0;paneWSet('300px');out.again=WRITES;
console.log(JSON.stringify(out));
""")
    # the zoom bar was a third reader until T619 put it in the tab row;
    # it is not written any more
    assert got["vals"] == ["300px", "", "300px", "300px", ""]
    assert got["now"] == "300px" and got["again"] == 0
    assert "deckEl.style.setProperty('--pane-w'" not in js
    # every rule that reads --pane-w is on one of the three
    css = _strip_comments(assets.deck_css())
    for m in re.finditer(r"([^{}]*)\{[^}]*var\(--pane-w", css):
        for sel in m.group(1).split(","):
            last = re.split(r"[ >+~]", sel.strip())[-1]
            assert re.search(r"\.(deck-stage|selpane)\b", last), sel


def _readers(var: str) -> list[str]:
    """The last compound of every selector whose rule reads `var`."""
    out = []
    for css in _all_css().values():
        for m in re.finditer(r"([^{}]*)\{[^}]*var\(" + re.escape(var) + r"\b",
                             css):
            for sel in m.group(1).split(","):
                sel = sel.strip()
                if sel and not sel.startswith("@"):
                    out.append(re.split(r"[ >+~]", sel)[-1])
    return out


def test_the_strip_drag_writes_the_two_things_it_moves():
    js = assets.deck_js()
    at = js.index("    if(h) h.addEventListener('pointerdown',function(e){")
    drag = js[at:js.index("    /* THE SAME DRAG, FROM THE KEYBOARD (T155).", at)]
    mv = drag[drag.index("function mv(ev){"):drag.index("function up(){")]
    up = drag[drag.index("function up(){"):]
    assert "--film-w" not in mv
    assert "if(col) col.style.width=w+'px';" in mv
    assert "h.style.left='calc(var(--presrail-w) + '+w+'px - 3px)';" in mv
    # handed back to the stylesheet in one write on the way out
    assert up.index("if(col) col.style.width='';") < up.index(
        "if(w) deckEl.style.setProperty('--film-w',w+'px');")
    assert "h.style.left='';" in up
    assert "document.addEventListener('pointercancel',up);" in drag
    # nothing else reads --film-w, so those two are the whole picture
    assert sorted(set(_readers("--film-w"))) == [".deck-create", ".film-resize"]


def test_the_builder_edge_drag_writes_what_it_moves():
    app = assets.app_js()
    live = lift_fn(app, "dcwLive")
    for el, prop in (("dk", "width"), ("col", "width"), ("dcR", "left"),
                     ("dd", "marginLeft"), ("top", "left")):
        assert f"{el}.style.{prop}=" in live, el
    at = app.index("  if(dcR) dcR.addEventListener('mousedown'")
    drag = app[at:app.index("  /* ---- T244: FIND IN THIS NOTEBOOK", at)]
    assert "if(live) dcwLive(w);" in drag
    assert drag.index("dcwLive(0);") < drag.index(
        "if(w) document.documentElement.style.setProperty('--dc-w',w+'px');")
    # the readers dcwLive stands in for -- plus the strip's own fallback
    # width (.deck-create and .film-resize while EDITING, which the live
    # path is never used for: it is only for the docked builder)
    assert sorted(set(_readers("--dc-w"))) == [
        ".apptop", ".dc-resize", ".deck-create", ".deck.creating", ".docs",
        ".film-resize"]
    assert "&&!dk.classList.contains('editing'));" in drag


def test_home_does_not_rewrite_the_header_height():
    app = assets.app_js()
    mc = lift_fn(app, "measureChrome")
    home = mc.index("if(document.body.classList.contains('welcoming')){")
    assert mc.index("fb.style.setProperty('--chrome-h',h+'px');") > home
    assert mc.index("return;", home) < mc.index(
        "document.documentElement.style.setProperty(")
    rc = lift_fn(app, "refreshChrome")
    assert ("if(wasWelcoming&&!welcoming&&APP.measureChrome) "
            "APP.measureChrome();") in rc
    # what reads --chrome-h at Home: only the Find bar (the rest is
    # covered by the welcome screen or set aside by `welcoming` rules)
    css = assets.app_css()
    assert "body.welcoming{padding-top:0;}" in css
    assert "body.welcoming .welcome{top:0;}" in css
    assert "body.welcoming .welcome-top{min-height:calc(100vh - 30px);}" in css
