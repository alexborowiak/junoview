"""T623: indent moves the line, and lists hold -- driven in Chromium with
real keys and a real mouse, at the two laptop sizes.

The user, 2026-10-10: "Also, I am finding, but I might have been on an old
version, indenting affects whole of text box, and still issues with dot
points and lists". Every check here is one of the confirmed repros of that
report, run against the app server: what the text box shows while typing,
what the deck holds, what comes back after a slide change or a reload,
and what the show, the strip and the .pptx draw.

Opt-in like every Chromium check: set ``JUNOVIEW_BROWSER_TESTS=1``. The
pure halves (numbering, levels, the .pptx's XML) run in the ordinary suite
(test_lists_and_indent.py).
"""

from __future__ import annotations

import base64
import io
import json
import os
import re
import threading
import zipfile
from http.server import ThreadingHTTPServer
from pathlib import Path

import pytest

from junoview.notebook.presentations import as_presentations
from junoview.server.routes import _make_handler
from junoview.server.state import _PROJECT_FILE, _AppState

ROOT = Path(__file__).resolve().parent.parent
NB = ROOT / "examples" / "example_climate_analysis.ipynb"
SIZES = [(1366, 657), (1280, 600)]


def _need_browser():
    if os.environ.get("JUNOVIEW_BROWSER_TESTS") != "1":
        pytest.skip("set JUNOVIEW_BROWSER_TESTS=1 for the Chromium checks")
    try:
        from playwright.sync_api import sync_playwright  # noqa: F401
    except ImportError:
        pytest.skip("Playwright is not installed")


def T(text, **kw):
    a = {"k": "text", "x": 8, "y": 12, "w": 60, "text": text, "size": 3.2}
    a.update(kw)
    return a


SLIDES = [
    # 0 an older deck's whole-box bullet list
    {"layout": "blank", "annots": [T("one\ntwo\nthree\nfour", list="bullet")]},
    # 1 a list inside the box's html, plain lines either side
    {"layout": "blank", "annots": [T(
        "Intro\none\ntwo\nthree\nAfter",
        html='Intro<ul data-list="bullet"><li>one</li><li>two</li>'
             '<li>three</li></ul>After')]},
    # 2 plain lines
    {"layout": "blank", "annots": [T("alpha\nbeta\ngamma")]},
    # 3 an older deck's styled numbered list from 5 (T571)
    {"layout": "blank", "annots": [T("one\ntwo\nthree\nfour", list="number",
                                     lcol="#ff3030", lsz=1.4, lstart=5)]},
    # 4 somewhere else to go
    {"layout": "blank", "annots": [T("other slide")]},
    # 5 an empty box to type into
    {"layout": "blank", "annots": [T("")]},
    # 6 two columns of bullets with paragraph spacing
    {"layout": "blank", "annots": [{
        "k": "text", "x": 8, "y": 12, "text":
        "abcdefghij\nklmnopqrst\nuvwxyzabcd\nsecond col\nmore words\nlast",
        "size": 3.2, "list": "bullet", "ncol": 2, "cgap": 0.8,
        "pspace": 1}]},
    # 7 a code box
    {"layout": "blank", "annots": [T("def f(x):\nreturn x", font="mono")]},
    # 8 a bullet with a Shift+Enter line in it
    {"layout": "blank", "annots": [T(
        "Heading\none\none more\nsub\ntwo",
        html='<p>Heading</p><p data-list="bullet">one<br>one more</p>'
             '<p data-lvl="1" data-list="bullet">sub</p>'
             '<p data-list="bullet">two</p>')]},
    # 9 a long numbered list
    {"layout": "blank", "annots": [T(
        "\n".join(f"item {i}" for i in range(1, 31)), list="number",
        size=1.6)]},
]
# a deck of its own for maths: a .pptx export waits for MathJax, which these
# pages never load (the CDN is shut off below), so no other test's deck may
# hold an equation
MATHS_SLIDES = [
    # 0 an empty box to type into
    {"layout": "blank", "annots": [T("")]},
    # 1 an older box with a display formula over several lines
    {"layout": "blank", "annots": [T(
        "Area of a circle:\n$$\nA = \\pi r^2\n$$")]},
]


@pytest.fixture(scope="module")
def browser():
    _need_browser()
    from playwright.sync_api import sync_playwright
    pw = sync_playwright().start()
    try:
        try:
            b = pw.chromium.launch()
        except Exception as e:  # noqa: BLE001
            pytest.skip(f"Chromium will not launch here: {e}")
        yield b
        b.close()
    finally:
        pw.stop()


@pytest.fixture
def app(browser, tmp_path):
    yield from _serve(browser, tmp_path, SLIDES)


@pytest.fixture
def app_maths(browser, tmp_path):
    yield from _serve(browser, tmp_path, MATHS_SLIDES)


def _serve(browser, tmp_path, slides):
    nb = tmp_path / NB.name
    nb.write_bytes(NB.read_bytes())
    decks = as_presentations([{"name": "lst", "slides": slides}])
    (tmp_path / _PROJECT_FILE).write_text(json.dumps(
        {"presentations": decks, "open": [str(nb)], "recent": [str(nb)]},
        indent=1) + "\n", encoding="utf-8")
    st = _AppState(tmp_path)
    srv = ThreadingHTTPServer(("127.0.0.1", 0), _make_handler(st))
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    url = f"http://127.0.0.1:{srv.server_address[1]}/?t={st.token}"
    try:
        yield {"b": browser, "url": url}
    finally:
        srv.shutdown()
        srv.server_close()


MJ_URL = "https://cdn.jsdelivr.net/npm/mathjax@3.2.2/es5/tex-chtml.js"
# Enough of MathJax to say whether a display formula reaches it whole: it
# pairs "$$" ... "$$" only inside ONE run of text, as the real one pairs them
# only inside one block (a <p> is a block; tests/test_maths_in_a_browser.py
# has the same stand-in for $...$)
_FAKE_MATHJAX = r"""
(function(){
  function setIn(el){
    var w=document.createTreeWalker(el,NodeFilter.SHOW_TEXT),ns=[];
    while(w.nextNode()) ns.push(w.currentNode);
    ns.forEach(function(n){
      if(!/\$\$[^$]+\$\$/.test(n.nodeValue)) return;
      var c=document.createElement('mjx-container');
      c.textContent=n.nodeValue.replace(/\$/g,'');
      n.parentNode.replaceChild(c,n);
    });
  }
  window.MathJax={
    startup:{promise:Promise.resolve(),document:{render:function(){}}},
    typeset:function(els){(els||[document.body]).forEach(setIn);},
    typesetPromise:function(els){this.typeset(els);return Promise.resolve();},
    typesetClear:function(){}
  };
})();
"""


def _page(app, w=1366, h=657, light=False, maths=False):
    ctx = app["b"].new_context(viewport={"width": w, "height": h})
    ctx.add_init_script(
        "try{localStorage.setItem('plotline-tour','1');"
        "localStorage.setItem('plotline-tour-editor','1');"
        + ("localStorage.setItem('plotline-scheme','light');" if light
           else "") + "}catch(e){}")

    def cdn(rt):
        if maths and rt.request.url == MJ_URL:
            rt.fulfill(status=200, body=_FAKE_MATHJAX,
                       headers={"content-type": "text/javascript"})
        else:
            rt.fulfill(status=404, body="")
    ctx.route("https://cdn.jsdelivr.net/**", cdn)
    pg = ctx.new_page()
    errs: list = []
    pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.goto(app["url"], wait_until="load")
    pg.wait_for_selector(".nbshell .card")
    pg.wait_for_timeout(600)
    # the app loads the editor on first use (app.js jvDeck); this drives
    # its API, so it asks for it first
    pg.evaluate("SemApp.deckLoad()")
    pg.evaluate("SemApp.deckChoose('lst')")
    pg.wait_for_timeout(900)
    return ctx, pg, errs


ED = "#deck-stage .annot-layer .an-item[data-idx='0'] .an-tx"

# `n` is the number the marker draws: every paragraph with a marker counts
# on from the one before (they are siblings, as <li>s are) and a
# counter-set says the number where counting on would not reach it -- the
# browser's own list-item count, read from what it computed
PARAS = """s=>{const el=document.querySelector(s);if(!el)return null;
  const base=el.getBoundingClientRect().left;let val=0;
  return [...el.children].filter(c=>c.tagName==='P').map(p=>{
    let tx=null;const tw=document.createTreeWalker(p,NodeFilter.SHOW_TEXT);
    let n;while(n=tw.nextNode()){if(n.nodeValue.trim()){tx=n;break;}}
    let left=null;if(tx){const r=document.createRange();r.setStart(tx,0);
      r.setEnd(tx,1);const b=r.getClientRects()[0];
      if(b)left=Math.round(b.left-base);}
    const cs=getComputedStyle(p),mk=getComputedStyle(p,'::marker');
    let num='none';
    if(cs.display==='list-item'){val++;
      if(cs.counterSet!=='none') val=+cs.counterSet.split(' ').pop();
      num='list-item '+val;}
    return {t:p.textContent,lvl:+(p.getAttribute('data-lvl')||0),
      k:p.getAttribute('data-k')||'',n:num,left:left,
      mcol:mk.color};});}"""


def paras(pg):
    return pg.evaluate(PARAS, ED)


def shape(pg):
    """each paragraph as 'words|level|marker' -- what the box shows"""
    return [f"{p['t']}|{p['lvl']}|{p['k']}" for p in paras(pg)]


def model(pg, si):
    doc = pg.evaluate("SemDeckFileHtml()")
    data = doc[doc.index('id="junoview-data">') + 19:]
    data = json.loads(data[:data.index("</" + "script>")])
    ps = data if isinstance(data, list) else data.get("presentations", [data])
    deck = [p for p in ps if p.get("name") == "lst"][0]
    return deck["slides"][si]["annots"][0]


def go(pg, si):
    pg.locator("#film-list .film-row").nth(si).click()
    pg.wait_for_timeout(450)


def word_at(pg, word, where="mid"):
    return pg.evaluate("""([s,w,where])=>{const el=document.querySelector(s);
      const tw=document.createTreeWalker(el,NodeFilter.SHOW_TEXT);let n;
      while(n=tw.nextNode()){const at=n.nodeValue.indexOf(w);
        if(at>=0){const r=document.createRange();r.setStart(n,at);
          r.setEnd(n,at+w.length);const b=r.getBoundingClientRect();
          const x=where==='start'?b.left+1:where==='end'?b.right-1
            :b.left+b.width/2;return [x,b.top+b.height/2];}}
      return null}""", [ED, word, where])


def into(pg, word):
    """double-click into the box at `word`, then a click for a bare caret"""
    x, y = word_at(pg, word)
    pg.mouse.dblclick(x, y)
    pg.wait_for_timeout(250)
    x, y = word_at(pg, word)
    pg.mouse.click(x, y)
    pg.wait_for_timeout(150)


def drag(pg, w1, w2):
    x1, y1 = word_at(pg, w1, "start")
    x2, y2 = word_at(pg, w2, "end")
    pg.mouse.move(x1 - 0.5, y1)
    pg.mouse.down()
    pg.mouse.move(x2 + 0.5, y2, steps=8)
    pg.mouse.up()
    pg.wait_for_timeout(150)


def press(pg, sel):
    """a real mouse click on a ribbon control, its tab opened first"""
    if not pg.evaluate("""s=>{const b=document.querySelector(s);
        return !!(b&&b.getBoundingClientRect().width)}""", sel):
        tab = pg.evaluate("""s=>{const g=document.querySelector(s)
          .closest('.rbn-grp');return g&&g.getAttribute('data-tab')}""", sel)
        bb = pg.locator(f"#rbn-tab-{tab}").bounding_box()
        pg.mouse.click(bb["x"] + bb["width"] / 2, bb["y"] + bb["height"] / 2)
        pg.wait_for_timeout(250)
    bb = pg.locator(sel).bounding_box()
    pg.mouse.click(bb["x"] + bb["width"] / 2, bb["y"] + bb["height"] / 2)
    pg.wait_for_timeout(250)


def away(pg):
    bb = pg.locator("#deck-stage .slide").first.bounding_box()
    pg.mouse.click(bb["x"] + bb["width"] * 0.9, bb["y"] + bb["height"] * 0.9)
    pg.wait_for_timeout(350)


def select_box(pg):
    bb = pg.locator("#deck-stage .annot-layer .an-item[data-idx='0']") \
        .bounding_box()
    pg.mouse.click(bb["x"] + 4, bb["y"] + 4)
    pg.wait_for_timeout(300)


def editing(pg):
    return pg.evaluate("""(()=>{const a=document.activeElement;
      return !!(a&&a.classList&&a.classList.contains('an-tx')
        &&a.isContentEditable)})()""")


def pptx_slide(pg, n):
    b64 = pg.evaluate("""async()=>{const r=await SemDeckPptx();
      const buf=new Uint8Array(await r.blob.arrayBuffer());let s='';
      for(let i=0;i<buf.length;i+=0x8000)
        s+=String.fromCharCode.apply(null,buf.subarray(i,i+0x8000));
      return btoa(s)}""")
    z = zipfile.ZipFile(io.BytesIO(base64.b64decode(b64)))
    return z.read(f"ppt/slides/slide{n}.xml").decode("utf-8")


def typed_box(pg, lines, si=5):
    go(pg, si)
    bb = pg.locator("#deck-stage .annot-layer .an-item[data-idx='0']") \
        .bounding_box()
    pg.mouse.dblclick(bb["x"] + 20, bb["y"] + bb["height"] / 2)
    pg.wait_for_timeout(300)
    for i, ln in enumerate(lines):
        if i:
            pg.keyboard.press("Enter")
        pg.keyboard.type(ln)


@pytest.mark.parametrize("w,h", SIZES)
@pytest.mark.parametrize("how", ["drag", "ctrl+a", "caret"])
def test_list_on_a_box_you_come_back_to_is_one_bullet_a_line(app, w, h,
                                                             how):
    """The user's report. The box comes back as lines, List bullets each
    one the selection touches (with a bare caret, the caret's), and Tab
    in "Second point" moves that line and nothing else."""
    ctx, pg, errs = _page(app, w, h)
    typed_box(pg, ["Heading", "First point", "Second point", "Third point"])
    away(pg)
    go(pg, 4)
    go(pg, 5)
    into(pg, "First")
    if how == "drag":
        drag(pg, "First", "Third point")
    elif how == "ctrl+a":
        pg.keyboard.press("Control+a")
    press(pg, "#fmt-bullets")
    want = {"drag": ["Heading|0|", "First point|0|bullet",
                     "Second point|0|bullet", "Third point|0|bullet"],
            "ctrl+a": ["Heading|0|bullet", "First point|0|bullet",
                       "Second point|0|bullet", "Third point|0|bullet"],
            "caret": ["Heading|0|", "First point|0|bullet",
                      "Second point|0|", "Third point|0|"]}[how]
    assert shape(pg) == want
    before = [p["left"] for p in paras(pg)]
    x, y = word_at(pg, "Second", "start")
    pg.mouse.click(x - 1, y)
    pg.keyboard.press("Home")
    pg.keyboard.press("Tab")
    ps = paras(pg)
    assert [p["lvl"] for p in ps] == [0, 0, 1, 0]
    # that line moved in, and no other line moved at all
    after = [p["left"] for p in ps]
    assert after[2] > before[2]
    assert [after[i] for i in (0, 1, 3)] == [before[i] for i in (0, 1, 3)]
    assert editing(pg)
    drawn = shape(pg)
    away(pg)
    go(pg, 4)
    go(pg, 5)
    assert shape(pg) == drawn
    a = model(pg, 5)
    assert "list" not in a
    assert a["html"].count("<p") == 4
    assert '<p data-lvl="1"' in a["html"]
    assert errs == []
    ctx.close()


@pytest.mark.parametrize("w,h", SIZES)
def test_tab_and_indent_on_plain_lines_stay_in_the_box(app, w, h):
    ctx, pg, errs = _page(app, w, h)
    go(pg, 2)
    into(pg, "beta")
    # mid-line, Tab types a tab -- and the box keeps the caret
    pg.keyboard.press("Tab")
    assert editing(pg)
    assert shape(pg)[1] == "be\tta|0|"
    # at the start of the line, Tab takes the line a level in
    pg.keyboard.press("Home")
    pg.keyboard.press("Tab")
    assert editing(pg)
    assert [p["lvl"] for p in paras(pg)] == [0, 1, 0]
    # the ribbon's Indent does the same on a plain line, no toast
    x, y = word_at(pg, "gamma")
    pg.mouse.click(x, y)
    press(pg, "#fmt-indent")
    assert [p["lvl"] for p in paras(pg)] == [0, 1, 1]
    assert editing(pg)
    away(pg)
    assert '<p data-lvl="1">gamma</p>' in model(pg, 2)["html"]
    # the browser's tab span leaves nothing behind in the model
    assert "<span" not in model(pg, 2)["html"]
    # with the box selected, Indent and Outdent take every paragraph
    select_box(pg)
    press(pg, "#fmt-indent")
    assert [p["lvl"] for p in paras(pg)] == [1, 2, 2]
    press(pg, "#fmt-outdent")
    press(pg, "#fmt-outdent")
    assert [p["lvl"] for p in paras(pg)] == [0, 0, 0]
    assert errs == []
    ctx.close()


@pytest.mark.parametrize("w,h", SIZES)
@pytest.mark.parametrize("how", ["down", "up", "ctrl+a"])
def test_a_mixed_selection_indents_every_paragraph_it_touches(app, w, h,
                                                              how):
    """Whichever end the mouse finishes at, every paragraph the selection
    touches goes a level in -- the plain one too, with no <blockquote> --
    and what is drawn is what is saved."""
    ctx, pg, errs = _page(app, w, h)
    go(pg, 1)
    into(pg, "two")
    if how == "down":
        drag(pg, "two", "After")
    elif how == "up":
        x1, y1 = word_at(pg, "After", "end")
        x2, y2 = word_at(pg, "two", "start")
        pg.mouse.move(x1 + 0.5, y1)
        pg.mouse.down()
        pg.mouse.move(x2 - 0.5, y2, steps=8)
        pg.mouse.up()
    else:
        pg.keyboard.press("Control+a")
    press(pg, "#fmt-indent")
    want = ([0, 0, 1, 1, 1] if how != "ctrl+a" else [1, 1, 1, 1, 1])
    assert [p["lvl"] for p in paras(pg)] == want
    assert pg.evaluate(f"document.querySelectorAll(\"{ED} blockquote\")"
                       ".length") == 0
    drawn = shape(pg)
    away(pg)
    assert shape(pg) == drawn
    go(pg, 4)
    go(pg, 1)
    assert shape(pg) == drawn
    assert errs == []
    ctx.close()


@pytest.mark.parametrize("w,h", SIZES)
def test_outdent_at_the_first_level_keeps_the_list_and_its_look(app, w, h):
    ctx, pg, errs = _page(app, w, h)
    go(pg, 3)
    before = paras(pg)
    assert [p["n"] for p in before] == ["list-item 5", "list-item 6",
                                        "list-item 7", "list-item 8"]
    into(pg, "two")
    pg.keyboard.press("Shift+Tab")
    press(pg, "#fmt-outdent")
    assert shape(pg) == ["one|0|number", "two|0|number", "three|0|number",
                         "four|0|number"]
    # a sub-point is a. and the numbers go on 5, 6, 7 round it
    pg.keyboard.press("Tab")
    after = paras(pg)
    assert [p["k"] for p in after] == ["number", "alpha", "number", "number"]
    assert [p["n"].split()[-1] for p in after] == ["5", "1", "6", "7"]
    away(pg)
    go(pg, 4)
    go(pg, 3)
    redrawn = paras(pg)
    assert [p["n"].split()[-1] for p in redrawn] == ["5", "1", "6", "7"]
    # every marker keeps the red the box was given
    assert {p["mcol"] for p in redrawn} == {"rgb(255, 48, 48)"}
    a = model(pg, 3)
    assert "list" not in a and "lcol" not in a and "lstart" not in a
    assert a["html"].count('data-lc="#ff3030"') == 4
    assert errs == []
    ctx.close()


@pytest.mark.parametrize("w,h", SIZES)
def test_the_paragraph_window_moves_the_line_and_then_the_box(app, w, h):
    ctx, pg, errs = _page(app, w, h)
    go(pg, 1)
    into(pg, "two")
    press(pg, "#fmt-para")
    chip = pg.locator("#fmt-para-lvl .opt-chip").nth(1)
    bb = chip.bounding_box()
    pg.mouse.click(bb["x"] + bb["width"] / 2, bb["y"] + bb["height"] / 2)
    pg.wait_for_timeout(250)
    assert [p["lvl"] for p in paras(pg)] == [0, 0, 1, 0, 0]
    assert editing(pg)
    left0 = [p["left"] for p in paras(pg)]
    if not pg.locator("#fmt-para-menu").is_visible():
        press(pg, "#fmt-para")
    box_in = pg.locator("#fmt-para-ind .opt-chip").nth(1)
    assert "WHOLE BOX" in box_in.get_attribute("title")
    bb = box_in.bounding_box()
    pg.mouse.click(bb["x"] + bb["width"] / 2, bb["y"] + bb["height"] / 2)
    pg.wait_for_timeout(350)
    left1 = [p["left"] for p in paras(pg)]
    # the box indent moves every line, by the same step, and you are
    # still typing
    shift = [b - a for a, b in zip(left0, left1, strict=True)]
    assert min(shift) > 10 and max(shift) - min(shift) <= 1, shift
    assert editing(pg)
    pg.keyboard.press("Escape")
    away(pg)
    assert model(pg, 1)["ind"] == 2
    # ...and it reaches PowerPoint: every paragraph's marL carries it
    xml = pptx_slide(pg, 2)
    ps = re.findall(r"<a:p>(.*?)</a:p>", xml)
    plain = [p for p in ps if "<a:t>Intro</a:t>" in p][0]
    assert 'marL="' in plain
    assert errs == []
    ctx.close()


@pytest.mark.parametrize("w,h", SIZES)
def test_a_gallery_pick_while_typing_is_the_paragraphs(app, w, h):
    ctx, pg, errs = _page(app, w, h)
    go(pg, 2)
    into(pg, "beta")
    press(pg, "#fmt-numbers-caret")
    t = pg.locator('#fmt-numbers-menu .ls-opt[title="A. B. C."]')
    bb = t.bounding_box()
    pg.mouse.click(bb["x"] + bb["width"] / 2, bb["y"] + bb["height"] / 2)
    pg.wait_for_timeout(300)
    assert shape(pg) == ["alpha|0|", "beta|0|alpha-upper", "gamma|0|"]
    assert editing(pg)
    away(pg)
    assert model(pg, 2)["html"] == (
        '<p>alpha</p><p data-list="alpha-upper">beta</p><p>gamma</p>')
    assert errs == []
    ctx.close()


@pytest.mark.parametrize("w,h", SIZES)
def test_the_look_of_a_list_outlives_a_line_taken_out_of_it(app, w, h):
    ctx, pg, errs = _page(app, w, h)
    go(pg, 3)
    into(pg, "two")
    pg.keyboard.press("Home")
    pg.keyboard.press("Backspace")          # T590: the number comes off
    away(pg)
    go(pg, 4)
    go(pg, 3)
    ps = paras(pg)
    assert [p["k"] for p in ps] == ["number", "", "number", "number"]
    # the rest keep the list's red, and count on from where it starts
    assert [p["n"].split()[-1] for p in ps if p["k"]] == ["5", "6", "7"]
    assert {p["mcol"] for p in ps if p["k"]} == {"rgb(255, 48, 48)"}
    xml = pptx_slide(pg, 4)
    assert xml.count('<a:buClr><a:srgbClr val="FF3030"/></a:buClr>') == 3
    assert 'startAt="5"' in xml and 'startAt="6"' in xml
    assert errs == []
    ctx.close()


@pytest.mark.parametrize("w,h", SIZES)
def test_pasted_lines_are_a_bullet_each(app, w, h):
    ctx, pg, errs = _page(app, w, h)
    typed_box(pg, ["- Fruit"])
    pg.keyboard.press("Enter")
    pg.evaluate("""()=>{const dt=new DataTransfer();
      dt.setData('text/plain','apples\\npears\\nplums');
      document.activeElement.dispatchEvent(new ClipboardEvent('paste',
        {clipboardData:dt,bubbles:true,cancelable:true}));}""")
    pg.keyboard.press("Enter")
    pg.keyboard.type("figs")
    assert shape(pg) == ["Fruit|0|bullet", "apples|0|bullet",
                         "pears|0|bullet", "plums|0|bullet", "figs|0|bullet"]
    # the empty bullet's placeholder did not follow the last pasted line
    assert "plums<br>" not in pg.evaluate(
        f"document.querySelector(\"{ED}\").innerHTML")
    away(pg)
    xml = pptx_slide(pg, 6)
    ps = [p for p in re.findall(r"<a:p>(.*?)</a:p>", xml) if "<a:t>" in p]
    assert len(ps) == 5 and all("<a:buChar" in p for p in ps)
    assert errs == []
    ctx.close()


@pytest.mark.parametrize("w,h", SIZES)
def test_a_line_break_and_a_level_reach_powerpoint(app, w, h):
    ctx, pg, errs = _page(app, w, h)
    typed_box(pg, ["- one"])
    pg.keyboard.press("Shift+Enter")
    pg.keyboard.type("one more line")
    pg.keyboard.press("Enter")
    pg.keyboard.press("Tab")
    pg.keyboard.type("sub")
    pg.keyboard.press("Enter")
    pg.keyboard.press("Shift+Tab")
    pg.keyboard.type("two")
    assert shape(pg) == ["one\none more line|0|bullet", "sub|1|circle",
                         "two|0|bullet"]
    away(pg)
    xml = pptx_slide(pg, 6)
    ps = [p for p in re.findall(r"<a:p>(.*?)</a:p>", xml) if "<a:t>" in p]
    assert len(ps) == 3
    assert "<a:br>" in ps[0] and "<a:buChar" in ps[0]
    assert 'lvl="1"' in ps[1] and '<a:buChar char="&#9702;"/>' in ps[1]
    assert errs == []
    ctx.close()


@pytest.mark.parametrize("w,h", SIZES)
def test_list_on_a_selected_box_keeps_every_level(app, w, h):
    ctx, pg, errs = _page(app, w, h)
    typed_box(pg, ["Heading", "- one"])
    pg.keyboard.press("Enter")
    pg.keyboard.press("Tab")
    pg.keyboard.type("sub")
    pg.keyboard.press("Enter")
    pg.keyboard.press("Shift+Tab")
    pg.keyboard.type("two")
    away(pg)
    select_box(pg)
    press(pg, "#fmt-bullets")
    assert shape(pg) == ["Heading|0|bullet", "one|0|bullet", "sub|1|circle",
                         "two|0|bullet"]
    press(pg, "#fmt-bullets")
    assert [p["lvl"] for p in paras(pg)] == [0, 0, 1, 0]
    assert all(not p["k"] for p in paras(pg))
    assert errs == []
    ctx.close()


@pytest.mark.parametrize("w,h", SIZES)
def test_an_auto_list_undoes_to_what_you_typed(app, w, h):
    ctx, pg, errs = _page(app, w, h)
    typed_box(pg, ["Heading", "1) one"])
    pg.keyboard.press("Enter")
    pg.keyboard.type("two")
    # "1) " is 1) 2) 3), not 1. 2.
    assert shape(pg)[1:] == ["one|0|paren", "two|0|paren"]
    pg.keyboard.press("Enter")
    pg.keyboard.press("Enter")
    pg.keyboard.type("- ")
    assert shape(pg)[-1] == "|0|bullet"
    pg.keyboard.press("Control+z")
    pg.keyboard.type("x")
    assert shape(pg)[-1] == "- x|0|"
    assert errs == []
    ctx.close()


@pytest.mark.parametrize("w,h", SIZES)
def test_spacing_and_columns_draw_the_same_in_the_editor_and_the_show(
        app, w, h):
    ctx, pg, errs = _page(app, w, h)
    go(pg, 6)
    meas = """s=>{const el=[...document.querySelectorAll(s)].find(e=>e.offsetParent);
      const fs=parseFloat(getComputedStyle(el).fontSize);
      const b=el.getBoundingClientRect();
      return [...el.querySelectorAll('p.an-p')].map(p=>{const r=document
        .createRange();r.selectNodeContents(p);const q=r.getClientRects()[0];
        return [Math.round((q.left-b.left)/fs*10)/10,
                Math.round((q.top-b.top)/fs*10)/10];})}"""
    ed = pg.evaluate(meas, ED)
    pg.click("#dc-play")
    pg.wait_for_timeout(1200)
    show = pg.evaluate(meas, "#deck-stage .an-item[data-idx='0'] .an-tx")
    pg.keyboard.press("Escape")
    pg.wait_for_timeout(600)
    # the same paragraphs in the same places (a show draws at another
    # size, so a top can round a hair differently)
    assert len(ed) == len(show)
    assert all(abs(a[0] - b[0]) <= 0.15 and abs(a[1] - b[1]) <= 0.15
               for a, b in zip(ed, show, strict=True)), (ed, show)
    # paragraph spacing reaches the bullets (1em + a line between them)
    assert ed[1][1] - ed[0][1] > 2
    # column 2's bullets sit in their own gutter, their tops level with
    # column 1's
    col2 = [p for p in ed if p[0] > ed[0][0] + 2]
    assert col2 and col2[0][0] > ed[0][0] + 1.7 and col2[0][1] == ed[0][1]
    assert errs == []
    ctx.close()


def test_the_light_editor_theme_leaves_the_slide_alone(app):
    fills = []
    for light in (False, True):
        ctx, pg, errs = _page(app, 1280, 600, light=light)
        go(pg, 2)
        fills.append(pg.evaluate("""getComputedStyle(document.querySelector(
          "#deck-stage .an-item[data-idx='0']")).backgroundColor"""))
        assert errs == []
        ctx.close()
    assert fills[0] == fills[1]


def test_the_strip_draws_the_markers_and_levels(app):
    ctx, pg, errs = _page(app)
    go(pg, 3)
    into(pg, "two")
    pg.keyboard.press("Home")
    pg.keyboard.press("Tab")
    away(pg)
    pg.wait_for_timeout(600)
    pg.wait_for_timeout(400)          # the markers come in idle time

    def mini(i):
        return pg.evaluate("""i=>document.querySelectorAll(
          '#film-list .film-row .mini-diagram')[i].querySelector('.mini-tx')
          .textContent""", i)
    # each line wears its marker, a sub-point set in under its parent's
    # words with its own a. -- the numbers count on round it
    assert mini(3).split("\n") == [
        "5.\u00a0one", "\u2003\u2003a.\u00a0two", "6.\u00a0three",
        "7.\u00a0four"]
    # at strip size the browser's dot is too small to paint: it is the
    # character, and the box is one text node, as it was before T623
    assert mini(0).split("\n") == ["\u2022\u00a0" + w for w in
                                   ("one", "two", "three", "four")]
    assert pg.evaluate("""document.querySelectorAll(
      '#film-list .film-row .mini-diagram')[0].querySelector('.mini-tx')
      .childNodes.length""") == 1
    assert errs == []
    ctx.close()


def test_a_reload_brings_back_every_level_and_marker(app):
    ctx, pg, errs = _page(app)
    typed_box(pg, ["1. one"])
    pg.keyboard.press("Enter")
    pg.keyboard.press("Tab")
    pg.keyboard.type("sub")
    pg.keyboard.press("Enter")
    pg.keyboard.press("Shift+Tab")
    pg.keyboard.type("two")
    drawn = shape(pg)
    away(pg)
    pg.keyboard.press("Control+s")
    pg.wait_for_timeout(1500)
    pg.reload(wait_until="load")
    pg.wait_for_selector(".nbshell .card")
    pg.wait_for_timeout(600)
    # the app loads the editor on first use (app.js jvDeck); this drives
    # its API, so it asks for it first
    pg.evaluate("SemApp.deckLoad()")
    pg.evaluate("SemApp.deckChoose('lst')")
    pg.wait_for_timeout(900)
    go(pg, 5)
    assert shape(pg) == drawn == ["one|0|number", "sub|1|alpha",
                                  "two|0|number"]
    assert errs == []
    ctx.close()


def test_command_search_indents_the_paragraph_you_were_in(app):
    """The search box takes the focus and the box closes behind it; the
    paragraph the caret was in is what "increase list level" moves -- and
    only for that one command."""
    ctx, pg, errs = _page(app)
    go(pg, 1)
    into(pg, "two")
    pg.keyboard.press("Alt+q")
    pg.wait_for_timeout(200)
    pg.keyboard.type("increase list level")
    pg.wait_for_timeout(300)
    pg.keyboard.press("Enter")
    pg.wait_for_timeout(600)
    assert [p["lvl"] for p in paras(pg)] == [0, 0, 1, 0, 0]
    select_box(pg)
    press(pg, "#fmt-indent")
    assert [p["lvl"] for p in paras(pg)] == [1, 1, 2, 1, 1]
    assert errs == []
    ctx.close()


@pytest.mark.parametrize("w,h", SIZES)
def test_backspace_enter_and_undo_on_paragraphs(app, w, h):
    """T590's Backspace, Enter on an empty bullet, and Ctrl+Z / Ctrl+Y
    taking a level or a marker back and forward while typing."""
    ctx, pg, errs = _page(app, w, h)
    typed_box(pg, ["- one", "two", "three"])
    x, y = word_at(pg, "two", "start")
    pg.mouse.click(x - 1, y)
    pg.keyboard.press("Home")
    pg.keyboard.press("Backspace")
    assert shape(pg) == ["one|0|bullet", "two|0|", "three|0|bullet"]
    pg.keyboard.press("Control+z")
    assert shape(pg) == ["one|0|bullet", "two|0|bullet", "three|0|bullet"]
    pg.keyboard.press("Control+y")
    assert shape(pg) == ["one|0|bullet", "two|0|", "three|0|bullet"]
    pg.keyboard.press("Control+z")
    pg.keyboard.press("Tab")
    assert shape(pg)[1] == "two|1|circle"
    pg.keyboard.press("Control+z")
    assert shape(pg)[1] == "two|0|bullet"
    # Enter on an empty bullet: a sub-bullet goes up a level, then off
    x, y = word_at(pg, "three", "end")
    pg.mouse.click(x + 1, y)
    pg.keyboard.press("End")
    pg.keyboard.press("Enter")
    pg.keyboard.press("Tab")
    pg.keyboard.press("Enter")
    assert shape(pg)[-1] == "|0|bullet"
    pg.keyboard.press("Enter")
    assert shape(pg)[-1] == "|0|"
    pg.keyboard.type("After")
    away(pg)
    assert model(pg, 5)["text"] == "one\ntwo\nthree\nAfter"
    assert errs == []
    ctx.close()


@pytest.mark.parametrize("w,h", SIZES)
def test_list_and_numbered_say_what_the_caret_is_in(app, w, h):
    """PowerPoint's buttons show the paragraph under the caret; in a box
    with plain lines round a list they showed the box ("not a list")."""
    ctx, pg, errs = _page(app, w, h)
    go(pg, 1)

    def pressed():
        return [pg.get_attribute(s, "aria-pressed")
                for s in ("#fmt-bullets", "#fmt-numbers")]
    into(pg, "two")
    pg.wait_for_timeout(100)
    assert pressed() == ["true", "false"]
    x, y = word_at(pg, "Intro")
    pg.mouse.click(x, y)
    pg.wait_for_timeout(100)
    assert pressed() == ["false", "false"]
    pg.keyboard.press("ArrowDown")
    pg.wait_for_timeout(100)
    assert pressed() == ["true", "false"]
    assert errs == []
    ctx.close()


def test_a_decrease_that_changes_nothing_is_not_a_step(app):
    """Outdent with an older deck's whole-box list selected, every item at
    the first level: nothing moves, the box is not rewritten, and there is
    no undo step for it."""
    ctx, pg, errs = _page(app)
    go(pg, 0)
    select_box(pg)
    before = model(pg, 0)
    press(pg, "#fmt-outdent")
    assert model(pg, 0) == before
    assert before.get("list") == "bullet"
    assert [p["lvl"] for p in paras(pg)] == [0, 0, 0, 0]
    assert errs == []
    ctx.close()


def test_an_empty_box_says_type_while_the_caret_waits_in_it(app):
    """T191's hint stays: a plain empty box opens with nothing in it, so
    it still wears "Type..." with the caret in it; the first key makes it
    a paragraph, and "- " there is still a bullet."""
    ctx, pg, errs = _page(app)
    go(pg, 5)
    bb = pg.locator("#deck-stage .annot-layer .an-item[data-idx='0']") \
        .bounding_box()
    pg.mouse.dblclick(bb["x"] + 20, bb["y"] + bb["height"] / 2)
    pg.wait_for_timeout(300)
    assert editing(pg)
    hint = f"getComputedStyle(document.querySelector(\"{ED}\"),'::before').content"
    assert "Type" in pg.evaluate(hint)
    pg.keyboard.type("- one")
    assert shape(pg) == ["one|0|bullet"]
    assert pg.evaluate(hint) == "none"
    # Ctrl+Z takes the typing back first, then the bullet -- giving back
    # the "- " that was typed, as AutoFormat's undo does
    pg.keyboard.press("Control+z")
    assert shape(pg) == ["|0|bullet"]
    pg.keyboard.press("Control+z")
    assert shape(pg) == ["- |0|"]
    pg.keyboard.type("x")
    assert shape(pg) == ["- x|0|"]
    assert errs == []
    ctx.close()


# ---- the 2026-10-10 review ------------------------------------------------

@pytest.mark.parametrize("w,h", SIZES)
def test_undo_steps_back_in_order_and_redo_brings_every_step_back(app, w, h):
    """Ctrl+Z takes back one step at a time, last first, and Ctrl+Y puts
    back every step it took -- words typed and undone are never lost (the
    box kept only its paragraph commands, and left the rest to a browser
    stack that drifted from it)."""
    ctx, pg, errs = _page(app, w, h)
    typed_box(pg, ["First line", "Second line"])
    states = []
    for _ in range(3):
        pg.keyboard.press("Control+z")
        states.append(shape(pg))
    assert states == [["First line|0|", "|0|"], ["First line|0|"], []]
    for _ in range(3):
        pg.keyboard.press("Control+y")
    assert shape(pg) == ["First line|0|", "Second line|0|"]
    pg.keyboard.press("Control+y")        # nothing more to put back
    assert shape(pg) == ["First line|0|", "Second line|0|"]
    away(pg)
    a = model(pg, 5)
    assert a["text"] == "First line\nSecond line" and "html" not in a
    assert errs == []
    ctx.close()


@pytest.mark.parametrize("w,h", SIZES)
def test_an_auto_bullet_and_a_tab_undo_as_steps_of_their_own(app, w, h):
    ctx, pg, errs = _page(app, w, h)
    typed_box(pg, ["- one", "two"])
    seen = []
    for _ in range(4):
        pg.keyboard.press("Control+z")
        seen.append(shape(pg))
    assert seen[:3] == [["one|0|bullet", "|0|bullet"], ["one|0|bullet"],
                        ["|0|bullet"]]
    # the auto-bullet comes off as a step of its own, the "- " back
    assert len(seen[3]) == 1 and seen[3][0].replace("\u00a0", " ") == "- |0|"
    for _ in range(4):
        pg.keyboard.press("Control+y")
    assert shape(pg) == ["one|0|bullet", "two|0|bullet"]
    # a Tab is a step: undone, it takes the level and nothing typed after
    pg.keyboard.press("Enter")
    pg.keyboard.press("Tab")
    pg.keyboard.type("sub")
    pg.keyboard.press("Control+z")
    assert shape(pg)[-1] == "|1|circle"
    pg.keyboard.press("Control+z")
    assert shape(pg)[-1] == "|0|bullet"
    pg.keyboard.press("Control+y")
    pg.keyboard.press("Control+y")
    assert shape(pg)[-1] == "sub|1|circle"
    assert errs == []
    ctx.close()


@pytest.mark.parametrize("w,h", SIZES)
def test_a_copy_is_one_line_a_paragraph(app, w, h):
    ctx, pg, errs = _page(app, w, h)
    ctx.grant_permissions(["clipboard-read", "clipboard-write"],
                          origin=app["url"].split("/?")[0])
    go(pg, 2)
    into(pg, "beta")
    pg.keyboard.press("Control+a")
    pg.keyboard.press("Control+c")
    pg.wait_for_timeout(150)
    assert pg.evaluate("navigator.clipboard.readText()") == \
        "alpha\nbeta\ngamma"
    pg.keyboard.press("Escape")
    away(pg)
    # a plain paste of it is three lines, not five
    go(pg, 5)
    bb = pg.locator("#deck-stage .annot-layer .an-item[data-idx='0']") \
        .bounding_box()
    pg.mouse.dblclick(bb["x"] + 20, bb["y"] + bb["height"] / 2)
    pg.wait_for_timeout(300)
    pg.keyboard.press("Control+Shift+v")
    pg.wait_for_timeout(300)
    away(pg)
    assert model(pg, 5)["text"] == "alpha\nbeta\ngamma"
    # a bullet's copy keeps its marker when it comes back into a box
    go(pg, 0)
    into(pg, "two")
    pg.keyboard.press("Control+a")
    pg.keyboard.press("Control+c")
    pg.wait_for_timeout(150)
    assert pg.evaluate("navigator.clipboard.readText()") == \
        "one\ntwo\nthree\nfour"
    assert errs == []
    ctx.close()


@pytest.mark.parametrize("w,h", SIZES)
def test_tab_in_a_code_box_indents_the_code(app, w, h):
    """In a code box Tab indents the code by its own characters -- the
    text, a copy and the export carry it -- and Shift+Tab takes it off;
    a level is a paragraph's, and code has none."""
    ctx, pg, errs = _page(app, w, h)
    go(pg, 7)
    into(pg, "return")
    pg.keyboard.press("Home")
    pg.keyboard.press("Tab")
    assert editing(pg)
    assert shape(pg) == ["def f(x):|0|", "\treturn x|0|"]
    away(pg)
    a = model(pg, 7)
    assert a["text"] == "def f(x):\n\treturn x" and "html" not in a
    into(pg, "return")
    pg.keyboard.press("Shift+Tab")
    assert shape(pg) == ["def f(x):|0|", "return x|0|"]
    # "- " in code is code, not a bullet
    pg.keyboard.press("End")
    pg.keyboard.press("Enter")
    pg.keyboard.type("- y")
    assert shape(pg)[-1] == "- y|0|"
    assert errs == []
    ctx.close()


def test_find_and_replace_keeps_markers_and_a_line_break(app):
    ctx, pg, errs = _page(app)
    go(pg, 8)
    away(pg)
    pg.keyboard.press("Control+f")
    pg.wait_for_timeout(400)
    pg.click("#find-q")
    pg.keyboard.type("two")
    pg.click("#find-r")
    pg.keyboard.type("deux")
    pg.wait_for_timeout(200)
    pg.click("#find-repall")
    pg.wait_for_timeout(500)
    a = model(pg, 8)
    assert a["text"] == "Heading\none\none more\nsub\ndeux"
    assert a["html"] == ('<p>Heading</p><p data-list="bullet">one<br>one '
                         'more</p><p data-lvl="1" data-list="bullet">sub</p>'
                         '<p data-list="bullet">deux</p>')
    assert errs == []
    ctx.close()


@pytest.mark.parametrize("w,h", SIZES)
def test_a_display_formula_over_several_lines_stays_one_paragraph(
        app_maths, w, h):
    """"$$" / LaTeX / "$$" typed with Enter, and an older box's lines, are
    one paragraph -- MathJax pairs two "$$" only inside one block, so as
    three paragraphs the slide, the show and the export printed the raw
    LaTeX -- and the box is still stored as its lines."""
    ctx, pg, errs = _page(app_maths, w, h, maths=True)

    def typeset():
        return pg.evaluate("""s=>document.querySelector(s)
          .querySelectorAll('mjx-container').length""", ED)
    typed_box(pg, ["Area of a circle:", "$$", "A = \\pi r^2", "$$"], 0)
    away(pg)
    pg.wait_for_timeout(400)
    a = model(pg, 0)
    assert a["text"] == "Area of a circle:\n$$\nA = \\pi r^2\n$$"
    assert "html" not in a
    assert typeset() == 1
    go(pg, 1)
    go(pg, 0)
    pg.wait_for_timeout(400)
    assert typeset() == 1
    # an older box, as it was stored before paragraphs
    go(pg, 1)
    pg.wait_for_timeout(400)
    assert typeset() == 1
    # and double-clicked, it is LaTeX again, the formula one paragraph
    bb = pg.locator("#deck-stage .annot-layer .an-item[data-idx='0']") \
        .bounding_box()
    pg.mouse.dblclick(bb["x"] + 20, bb["y"] + 8)
    pg.wait_for_timeout(300)
    assert shape(pg) == ["Area of a circle:|0|", "$$\nA = \\pi r^2\n$$|0|"]
    away(pg)
    pg.click("#dc-play")
    pg.wait_for_timeout(1200)
    assert typeset() == 1
    pg.keyboard.press("Escape")
    assert errs == []
    ctx.close()


def test_enter_in_a_long_numbered_list_writes_one_paragraph(app):
    """The numbers count on by themselves: an Enter at item 5 of 30 writes
    the new paragraph, and not the style of the 25 below it."""
    ctx, pg, errs = _page(app)
    go(pg, 9)
    x, y = word_at(pg, "item 5", "end")
    pg.mouse.dblclick(x, y)
    pg.wait_for_timeout(250)
    pg.keyboard.press("End")
    pg.evaluate("""s=>{const el=document.querySelector(s);window.__w=[];
      window.__mo=new MutationObserver(rs=>{for(const r of rs)
        if(r.type==='attributes') window.__w.push(r.target.textContent);});
      window.__mo.observe(el,{subtree:true,attributes:true});}""", ED)
    pg.keyboard.press("Enter")
    pg.wait_for_timeout(100)
    writes = pg.evaluate("window.__mo.disconnect(),window.__w")
    assert all(t in ("", "item 5") for t in writes), writes
    ns = [int(p["n"].split()[-1]) for p in paras(pg)]
    assert ns == list(range(1, 32))
    pg.keyboard.type("new")
    want = [f"{i}. item {i}" for i in range(1, 6)] + ["6. new"] + \
        [f"{i + 1}. item {i}" for i in range(6, 31)]
    # what the browser DRAWS in front of each paragraph, not what the page
    # asked for: the counting-on is the browser's
    assert drawn(pg) == want
    # a Backspace at the start of item 3 takes its number off, and the
    # list below it starts again at 1; Ctrl+Z puts it back
    x, y = word_at(pg, "item 3", "start")
    pg.mouse.click(x, y)
    pg.keyboard.press("Home")
    pg.keyboard.press("Backspace")
    got = drawn(pg)
    assert got[:4] == ["1. item 1", "2. item 2", "item 3", "1. item 4"]
    assert got[-1] == "28. item 30"
    pg.keyboard.press("Control+z")
    assert drawn(pg) == want
    away(pg)
    ns = [int(p["n"].split()[-1]) for p in paras(pg)]
    assert ns == list(range(1, 32))
    assert drawn(pg) == want
    go(pg, 4)
    go(pg, 9)
    assert drawn(pg) == want
    pg.click("#dc-play")
    pg.wait_for_timeout(1000)
    assert drawn(pg) == want
    pg.keyboard.press("Escape")
    pg.wait_for_timeout(400)
    # an older list that starts at 5: its first number is said, the rest
    # count on from it, and a sub-point taken in and back out rejoins it
    go(pg, 3)
    assert drawn(pg) == ["5. one", "6. two", "7. three", "8. four"]
    into(pg, "two")
    pg.keyboard.press("Home")
    pg.keyboard.press("Tab")
    assert drawn(pg) == ["5. one", "a. two", "6. three", "7. four"]
    pg.keyboard.press("Shift+Tab")
    away(pg)
    assert drawn(pg) == ["5. one", "6. two", "7. three", "8. four"]
    assert errs == []
    ctx.close()


def drawn(pg, sel=ED):
    """each paragraph of the box as the browser draws it: its ::marker's
    own text (read off the layout through CDP) and then its words"""
    cdp = pg.context.new_cdp_session(pg)
    pg.evaluate("s=>document.querySelector(s).setAttribute('data-probe','1')",
                sel)
    try:
        snap = cdp.send("DOMSnapshot.captureSnapshot", {"computedStyles": []})
    finally:
        pg.evaluate("""s=>document.querySelector(s)
          .removeAttribute('data-probe')""", sel)
        cdp.detach()
    st = snap["strings"]
    nd = snap["documents"][0]["nodes"]
    par = nd["parentIndex"]
    name = [st[i] if i >= 0 else "" for i in nd["nodeName"]]
    val = [st[i] if i >= 0 else "" for i in nd["nodeValue"]]
    pseudo = {i: st[v] for i, v in zip(nd["pseudoType"]["index"],
                                       nd["pseudoType"]["value"],
                                       strict=True)}
    box = next(i for i, a in enumerate(nd["attributes"])
               if any(st[a[k]] == "data-probe"
                      for k in range(0, len(a), 2)))
    ps = [i for i in range(len(par)) if par[i] == box and name[i] == "P"]
    words = dict.fromkeys(ps, "")
    for i in range(len(par)):
        if name[i] == "#text":
            j = par[i]
            while j >= 0 and j not in words:
                j = par[j]
            if j >= 0:
                words[j] += val[i]
    mark = dict.fromkeys(ps, "")
    lay = snap["documents"][0]["layout"]
    for li, ni in enumerate(lay["nodeIndex"]):
        t = lay["text"][li]
        m = ni if pseudo.get(ni) == "marker" else (
            par[ni] if pseudo.get(par[ni]) == "marker" else None)
        if t >= 0 and m is not None and par[m] in mark:
            mark[par[m]] += st[t]
    return [(mark[p].replace("\u00a0", " ") + words[p]).strip() for p in ps]
