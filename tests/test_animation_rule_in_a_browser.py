"""T625: one animation rule for many slides -- driven in Chromium with a
real mouse and real keys, at the two laptop sizes, light and dark.

The user, 2026-10-11: "animation rule that can be applied to all slides
and or slide selection". A ten-slide deck: the rule given to three slides
picked in the slide sorter, then to every slide with Keep theirs; the show
walks a slide in the rule's order; Ctrl+Z takes back each apply whole; a
slide made with New slide gets the rule the deck keeps; and a save and a
reload keep both the rule and what it wrote.

Opt-in like every Chromium check: set ``JUNOVIEW_BROWSER_TESTS=1``. The
engine itself runs in the ordinary suite (test_animation_rule.py).
"""

from __future__ import annotations

import json
import os
import threading
from http.server import ThreadingHTTPServer
from pathlib import Path

import pytest

from junoview.notebook.presentations import as_presentations
from junoview.server.routes import _make_handler
from junoview.server.state import _PROJECT_FILE, _AppState

ROOT = Path(__file__).resolve().parent.parent
NB = ROOT / "examples" / "example_climate_analysis.ipynb"
RUNS = [(1366, 657, False), (1280, 600, True)]
PNG = ("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0k"
       "AAAAFklEQVR4nGP8z8DwnwEIGJkYGBgYAAAeBAIB0n1eJQAAAABJRU5ErkJggg==")


def _need_browser():
    if os.environ.get("JUNOVIEW_BROWSER_TESTS") != "1":
        pytest.skip("set JUNOVIEW_BROWSER_TESTS=1 for the Chromium checks")
    try:
        from playwright.sync_api import sync_playwright  # noqa: F401
    except ImportError:
        pytest.skip("Playwright is not installed")


def T(text, **kw):
    a = {"k": "text", "x": 8, "y": 22, "w": 50, "text": text, "size": 3}
    a.update(kw)
    return a


def _title(i):
    return T(f"Slide {i + 1}", x=5, y=4, w=90, h=11, size=5, b=1,
             style="h1")


FIG = {"k": "cell", "ref": "example_climate_analysis::clim_map",
       "part": "figure", "x": 60, "y": 22, "w": 35, "h": 50}
PIC = {"k": "image", "x": 62, "y": 24, "w": 30, "h": 30, "src": PNG}
RECT = {"k": "rect", "x": 10, "y": 70, "w": 20, "h": 12, "color": "#ff6b57"}
TABLE = {"k": "table", "x": 8, "y": 22, "w": 45, "h": 30, "size": 2.2,
         "thead": 1, "grid": 1, "rows": [["a", "b"], ["1", "2"]]}
BODY = [
    [T("one\ntwo\nthree", list="bullet"), FIG],          # 1
    [T("alpha\nbeta", list="bullet"), PIC],               # 2
    [TABLE, RECT],                                        # 3
    [T("words here"), T("def f(x):\n    return x", font="mono", y=60)],
    [T("made by hand", anim={"type": "zoom", "order": 0}), PIC],   # 5
    [T("x\ny\nz", list="bullet"), FIG],                   # 6
    [T("just text")],                                     # 7
    [PIC, T("caption", y=60)],                            # 8
    [RECT, {"k": "arrow", "x1": 40, "y1": 75, "x2": 70, "y2": 75}],
    [T("p\nq\nr\ns", list="bullet")],                    # 10
]
SLIDES = [{"layout": "blank", "annots": [_title(i)] + [dict(a) for a in b]}
          for i, b in enumerate(BODY)]


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
    nb = tmp_path / NB.name
    nb.write_bytes(NB.read_bytes())
    decks = as_presentations([{"name": "rule", "slides": SLIDES}])
    (tmp_path / _PROJECT_FILE).write_text(json.dumps(
        {"presentations": decks, "open": [str(nb)], "recent": [str(nb)]},
        indent=1) + "\n", encoding="utf-8")
    st = _AppState(tmp_path)
    srv = ThreadingHTTPServer(("127.0.0.1", 0), _make_handler(st))
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    url = f"http://127.0.0.1:{srv.server_address[1]}/?t={st.token}"
    try:
        yield {"b": browser, "url": url, "dir": tmp_path}
    finally:
        srv.shutdown()
        srv.server_close()


def _open(pg):
    pg.wait_for_selector(".nbshell .card")
    pg.wait_for_timeout(600)
    # the app loads the editor on first use (app.js jvDeck); this drives
    # its API, so it asks for it first
    pg.evaluate("SemApp.deckLoad()")
    pg.evaluate("SemApp.deckChoose('rule')")
    pg.wait_for_timeout(900)


def _page(app, w, h, light):
    ctx = app["b"].new_context(viewport={"width": w, "height": h})
    ctx.add_init_script(
        "try{localStorage.setItem('plotline-tour','1');"
        "localStorage.setItem('plotline-tour-editor','1');"
        + ("localStorage.setItem('plotline-scheme','light');" if light
           else "") + "}catch(e){}")
    ctx.route("https://cdn.jsdelivr.net/**",
              lambda rt: rt.fulfill(status=404, body=""))
    pg = ctx.new_page()
    errs: list = []
    pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.goto(app["url"], wait_until="load")
    _open(pg)
    return ctx, pg, errs


def click(pg, sel):
    """a real mouse click in the middle of what `sel` names"""
    bb = pg.locator(sel).first.bounding_box()
    assert bb and bb["width"] > 0, sel
    pg.mouse.click(bb["x"] + bb["width"] / 2, bb["y"] + bb["height"] / 2)
    pg.wait_for_timeout(250)


def tab(pg, name):
    click(pg, f"#rbn-tab-{name}")


def deck(pg):
    doc = pg.evaluate("SemDeckFileHtml()")
    data = doc[doc.index('id="junoview-data">') + 19:]
    data = json.loads(data[:data.index("</" + "script>")])
    ps = data if isinstance(data, list) else data.get("presentations",
                                                      [data])
    return [p for p in ps if p.get("name") == "rule"][0]


def anims(pg):
    """every slide's objects as 'type@order[/by]', or '-' with none"""
    out = []
    for s in deck(pg)["slides"]:
        row = []
        for a in s.get("annots", []):
            an = a.get("anim")
            row.append("-" if not an else f"{an['type']}@{an.get('order', 0)}"
                       + (f"/{an['by']}" if an.get("by") else ""))
        out.append(row)
    return out


def open_rule(pg):
    tab(pg, "animation")
    click(pg, "#anim-rule")
    pg.wait_for_function("!document.getElementById('anr-dlg').hidden")
    pg.wait_for_function(
        "document.getElementById('anr-sum').textContent.length>0")


def apply(pg):
    click(pg, "#anr-apply")
    pg.wait_for_function(
        "(()=>{const t=document.getElementById('deck-toast');"
        "return t&&!t.hidden&&/animate|Nothing|Rule kept|taken off|"
        "Clicks put|Transition set|Rule forgotten/.test(t.textContent)})()")
    pg.wait_for_timeout(400)
    return pg.evaluate("document.getElementById('deck-toast').textContent")


SHOWN = """()=>{const l=document.querySelector('#deck-stage .annot-layer');
  return [...l.querySelectorAll('.an-item[data-idx]')]
    .filter(e=>/^\\d+$/.test(e.getAttribute('data-idx'))).map(e=>{
      const ps=[...e.querySelectorAll('[data-part]')];
      return e.getAttribute('data-idx')+':'+(e.classList.contains(
        'an-prebuild')?'-':(ps.length?ps.map(p=>p.style.visibility===
        'hidden'?'0':'1').join(''):'+'));});}"""


def go(pg, i):
    pg.locator("#film-list .film-row").nth(i).click()
    pg.wait_for_timeout(400)


@pytest.mark.parametrize("w,h,light", RUNS)
def test_a_rule_for_three_slides_then_all_then_undo(app, w, h, light):
    ctx, pg, errs = _page(app, w, h, light)
    before = anims(pg)
    # ---- the door is on the Animation tab, in words, inside the row
    tab(pg, "animation")
    door = pg.evaluate("""(()=>{const b=document.getElementById('anim-rule');
      const r=b.getBoundingClientRect(),bar=document.getElementById(
      'edit-tools').getBoundingClientRect();
      return {w:r.width,right:r.right,bar:bar.right,
        txt:b.textContent.replace(/\\s+/g,' ').trim(),
        ic:!!b.querySelector('svg,i[data-ic]')}})()""")
    assert door["w"] > 0 and door["right"] <= door["bar"] + 1
    assert door["txt"] == "Apply to slides…" and door["ic"]
    # ---- three slides picked in the slide sorter, then Animate...
    tab(pg, "view")
    click(pg, "#vw-sorter")
    tiles = pg.locator("#deck-overview .ovw-tile")
    tiles.nth(1).click()
    tiles.nth(2).click(modifiers=["Control"])
    tiles.nth(3).click(modifiers=["Control"])
    pg.locator("#deck-overview .ovw-tools button",
               has_text="Animate").click()
    pg.wait_for_function("!document.getElementById('anr-dlg').hidden")
    pg.wait_for_function(
        "document.getElementById('anr-sum').textContent.length>0")
    assert pg.evaluate("[document.getElementById('anr-scope').value,"
                       "document.getElementById('anr-range').value]") \
        == ["some", "2-4"]
    # the preview draws -- and Copy reads -- a slide the apply reaches:
    # slide 2, not slide 1 where the editor stands (2026-10-12 review)
    pg.wait_for_function("/^Slide 2 /.test(document.getElementById("
                         "'anr-pvn').textContent)")
    assert pg.evaluate("document.getElementById('anr-copy-t')"
                       ".textContent.replace(/\\s+/g,' ')") == "Copy slide 2"
    # nothing on these three is animated, so Replace does what Keep
    # theirs would -- and must not outlive this open
    pg.select_option("#anr-how", "replace")
    pg.wait_for_timeout(200)
    # the dialog fits the laptop screen without a scroll of its own
    box = pg.evaluate("""(()=>{const b=document.querySelector(
      '#anr-dlg .aa-box'),r=b.getBoundingClientRect();
      return [r.top,r.bottom,innerHeight,b.scrollHeight-b.clientHeight,
        r.left,r.right,innerWidth]})()""")
    assert box[0] >= 0 and box[1] <= box[2] and box[3] <= 1
    assert box[4] >= 0 and box[5] <= box[6]
    # the title is the theme's ink, not the other theme's
    col = pg.evaluate("getComputedStyle(document.getElementById("
                      "'anr-title')).color")
    assert (col == "rgb(242, 247, 250)") != light
    assert "on 3 slides" in pg.evaluate(
        "document.getElementById('anr-sum').textContent")
    said = apply(pg)
    assert "animated on 3 slides" in said
    first = anims(pg)
    assert first[0] == before[0] and first[4:] == before[4:]
    # slide 2: words a bullet at a time, then the picture
    assert first[1] == ["-", "fade@0/para", "fade@2"]
    # slide 3: the table, then the shape
    assert first[2] == ["-", "fade@0", "fade@1"]
    # slide 4: the words, then the code
    assert first[3] == ["-", "fade@0/para", "fade@1"]
    # ---- every slide, keeping what each already has. A ribbon open
    # starts on this slide with Keep theirs, whatever the last open said
    open_rule(pg)
    assert pg.evaluate("[document.getElementById('anr-scope').value,"
                       "document.getElementById('anr-range').value,"
                       "document.getElementById('anr-how').value]") \
        == ["cur", "1", "new"]
    pg.select_option("#anr-scope", "all")
    pg.wait_for_timeout(300)
    assert pg.evaluate("document.getElementById('anr-how').value") == "new"
    apply(pg)
    second = anims(pg)
    assert second[1:4] == first[1:4]           # done already: kept
    assert second[4][1] == "zoom@0"            # made by hand: kept
    assert second[4][2] == "fade@1"            # ...and the picture after
    assert second[0] == ["-", "fade@0/para", "fade@3"]
    assert all(r[0] == "-" for r in second)    # titles stay put
    # text comes before a picture placed above it; two shapes, a click each
    assert second[7] == ["-", "fade@1", "fade@0/para"]
    assert second[8] == ["-", "fade@0", "fade@1"]
    # ---- the show walks slide 1 in the rule's order
    go(pg, 0)
    pg.keyboard.press("F5")
    pg.wait_for_timeout(900)
    walk = []
    for _ in range(5):
        walk.append(pg.evaluate(SHOWN))
        pg.keyboard.press("ArrowRight")
        pg.wait_for_timeout(450)
    assert walk == [["0:+", "1:-", "2:-"], ["0:+", "1:100", "2:-"],
                    ["0:+", "1:110", "2:-"], ["0:+", "1:111", "2:-"],
                    ["0:+", "1:111", "2:+"]]
    pg.keyboard.press("Escape")
    pg.wait_for_timeout(700)
    # ---- the Animation pane reads it as if set by hand: four clicks,
    # and Earlier moves the figure in among the bullets (T577)
    go(pg, 0)
    tab(pg, "animation")
    click(pg, "#vw-anim")
    click(pg, "#animpane-tab-ord")
    assert pg.evaluate("document.querySelector('#animpane-body .anim-h')"
                       ".textContent") == "4 clicks"
    last = pg.locator("#animpane-body .anim-step").last
    last.locator("button", has_text="Earlier").click()
    pg.wait_for_timeout(300)
    s0 = deck(pg)["slides"][0]["annots"]
    assert s0[1]["anim"].get("parts") == [0, 1, 3]
    assert s0[2]["anim"]["order"] == 2
    pg.keyboard.press("Control+z")
    pg.wait_for_timeout(400)
    click(pg, "#animpane-close")
    # ---- one Ctrl+Z takes back each apply, whole
    away = pg.locator("#deck-stage .slide").first.bounding_box()
    pg.mouse.click(away["x"] + away["width"] * 0.9,
                   away["y"] + away["height"] * 0.95)
    pg.keyboard.press("Control+z")
    pg.wait_for_timeout(500)
    assert anims(pg) == first
    pg.keyboard.press("Control+z")
    pg.wait_for_timeout(500)
    assert anims(pg) == before
    pg.keyboard.press("Control+y")
    pg.wait_for_timeout(500)
    assert anims(pg) == first
    assert errs == []
    ctx.close()


@pytest.mark.parametrize("w,h,light", RUNS)
def test_new_slides_get_the_rule_and_a_reload_keeps_it(app, w, h, light):
    ctx, pg, errs = _page(app, w, h, light)
    # ---- Copy this slide: slide 5's words were made by hand (Zoom), its
    # picture has no animation and its title none
    go(pg, 4)
    open_rule(pg)
    click(pg, "#anr-copy")
    val = ("s=>document.querySelector(`#anr-rows .anr-row[data-k='${s}'] "
           ".anr-fx`).value")
    assert [pg.evaluate(val, k) for k in ("title", "text", "image")] \
        == ["none", "zoom", "none"]
    # then the rule this deck keeps for new slides
    for k, fx in (("text", "fade"), ("image", "fade"), ("figure", "zoom")):
        pg.select_option(f"#anr-rows .anr-row[data-k='{k}'] .anr-fx", fx)
    pg.select_option("#anr-rows .anr-row[data-k='text'] .anr-by", "")
    pg.locator("#anr-new").check()
    pg.select_option("#anr-trans", "fade")
    apply(pg)
    d = deck(pg)
    rule = d.get("animRule")
    assert rule and rule.get("nw") == 1 and rule.get("tr") == "fade"
    assert rule["k"]["figure"]["fx"] == "zoom"
    assert rule["k"]["text"]["by"] == ""
    # this slide: the words keep their Zoom, the picture comes after
    assert [(a.get("anim") or {}).get("type") for a in
            d["slides"][4]["annots"]] == [None, "zoom", "fade"]
    assert d["slides"][4].get("trans") == "fade"
    # one Ctrl+Z takes the rule back with what it wrote
    pg.keyboard.press("Control+z")
    pg.wait_for_timeout(400)
    assert not deck(pg).get("animRule")
    pg.keyboard.press("Control+y")
    pg.wait_for_timeout(400)
    assert deck(pg).get("animRule", {}).get("nw") == 1
    # ---- New slide: its slots arrive by the rule as they are made
    n0 = len(deck(pg)["slides"])
    click(pg, "#film-add")
    pg.wait_for_timeout(500)
    sl = deck(pg)["slides"]
    assert len(sl) == n0 + 1
    new = sl[5]                     # after slide 5, where we stood
    assert pg.evaluate("document.querySelector('#film-list .film-row"
                       ".current .film-n').textContent") == "6"
    got = {a.get("k"): (a.get("anim") or {}).get("type") for a in
           new["annots"]}
    assert new.get("trans") == "fade"
    assert got.get("cell") == "zoom"
    # ...and the show does not stop on its empty slots
    pg.keyboard.press("F5")
    pg.wait_for_timeout(900)
    assert pg.evaluate("document.querySelectorAll('#deck-stage "
                       ".an-item.an-prebuild').length") == 0
    pg.keyboard.press("Escape")
    pg.wait_for_timeout(600)
    # ---- a new layout on it: the slots the layout makes get the rule as
    # well (they lost it, 2026-10-12 review), in the layout's undo step
    go(pg, 5)
    had = deck(pg)["slides"][5]["annots"]
    tab(pg, "design")
    click(pg, "#lay-btn")
    pg.locator("#layout-menu-grid button[data-lay='title-body']").first \
        .click()
    pg.wait_for_timeout(500)
    rel = deck(pg)["slides"][5]["annots"]
    assert [a.get("k") for a in rel] == ["text", "text"]
    assert sorted(str((a.get("anim") or {}).get("type")) for a in rel) \
        == ["None", "fade"]           # the title none, the words fade
    pg.keyboard.press("Control+z")
    pg.wait_for_timeout(500)
    assert deck(pg)["slides"][5]["annots"] == had
    # ---- a duplicate keeps its own (slide 7, now 8, has no animation)
    go(pg, 7)
    pg.keyboard.press("Control+d")
    pg.wait_for_timeout(500)
    dup = deck(pg)["slides"][8]
    assert [a.get("anim") for a in dup["annots"]] == [None, None]
    # ---- save, reload: the rule and what it wrote are still there
    pg.keyboard.press("Control+s")
    pg.wait_for_timeout(1500)
    saved = deck(pg)
    pg.reload(wait_until="load")
    _open(pg)
    back = deck(pg)
    assert back.get("animRule") == saved.get("animRule")
    assert [[a.get("anim") for a in s["annots"]] for s in back["slides"]] \
        == [[a.get("anim") for a in s["annots"]] for s in saved["slides"]]
    # ...and a slide made after the reload still gets it
    n1 = len(back["slides"])
    click(pg, "#film-add")
    pg.wait_for_timeout(500)
    sl = deck(pg)["slides"]
    assert len(sl) == n1 + 1
    assert any((a.get("anim") or {}).get("type") == "zoom"
               for s in sl for a in s["annots"] if a.get("k") == "cell"
               and not a.get("ref"))
    # the project file holds the rule too
    proj = json.loads((app["dir"] / _PROJECT_FILE).read_text("utf-8"))
    kept = [p for p in proj["presentations"] if p["name"] == "rule"][0]
    assert kept.get("animRule", {}).get("nw") == 1
    # ---- Create slides, in the reader, where no deck is open: it offers
    # this deck's rule BY NAME and uses it only when chosen; it no longer
    # took the last open deck's rule unseen (2026-10-12 review)
    pg.keyboard.press("Control+s")
    pg.wait_for_timeout(800)
    pg.evaluate("SemApp.deckClose()")
    pg.wait_for_timeout(700)
    click(pg, "#doc-autoslides")
    pg.locator("#auto-animations").check()
    pg.wait_for_function("!document.getElementById('auto-anim-how-wrap')"
                         ".hidden")
    assert pg.evaluate("[...document.getElementById('auto-anim-how')"
                       ".options].map(o=>[o.value,o.textContent])") \
        == [["", "One per click, in notebook order"],
            ["rule", "The animation rule of \u201crule\u201d"]]
    assert pg.evaluate("document.getElementById('auto-anim-how').value") \
        == ""
    pg.select_option("#auto-anim-how", "rule")
    click(pg, "#auto-slides-create")
    pg.wait_for_function("/the rule of/.test((document.getElementById("
                         "'deck-toast')||{}).textContent||'')",
                         timeout=20000)
    doc = pg.evaluate("SemDeckFileHtml()")
    data = doc[doc.index('id="junoview-data">') + 19:]
    data = json.loads(data[:data.index("</" + "script>")])
    ps = data if isinstance(data, list) else data.get("presentations",
                                                      [data])
    made = [p for p in ps if p.get("name") != "rule"][0]
    assert not made.get("animRule")
    figs = {(a.get("anim") or {}).get("type") for sl in made["slides"]
            for a in sl.get("annots", []) if a.get("k") == "cell"
            and a.get("part") not in ("code",)}
    assert "zoom" in figs
    assert errs == []
    ctx.close()


# what the dialog answers to, in the review's words: Replace says what it
# takes off; every ribbon open starts safe; Enter on Earlier keeps the
# focus; text that runs itself arrives whole; the speeds read in full; the
# help is words and an icon
@pytest.mark.parametrize("w,h,light", RUNS)
def test_the_dialog_says_what_it_does_and_keeps_the_keyboard(app, w, h,
                                                             light):
    ctx, pg, errs = _page(app, w, h, light)
    before = anims(pg)
    go(pg, 4)                         # slide 5: words zoomed by hand
    open_rule(pg)
    help_ = pg.evaluate(r"""(()=>{const q=document.getElementById('anr-q');
      return [q.textContent.replace(/\s+/g,' ').trim(),
        !!q.querySelector('svg')]})()""")
    assert help_ == ["How it works", True]
    # ---- the speeds are read whole (no "Very slow" without its seconds)
    clipped = pg.evaluate("""(()=>{const c=document.createElement('canvas')
      .getContext('2d'),out=[];
      document.querySelectorAll('#anr-dlg select').forEach(s=>{
        const cs=getComputedStyle(s);c.font=cs.font;
        const room=s.clientWidth-parseFloat(cs.paddingLeft)
          -parseFloat(cs.paddingRight)-16;
        [...s.options].forEach(o=>{if(c.measureText(o.text).width>room)
          out.push((s.getAttribute('aria-label')||s.id)+': '+o.text);});});
      return out;})()""")
    assert clipped == []
    # ---- Enter on Earlier, twice: the figures come up two places, and
    # the focus stays in the dialog -- it fell to the page, and the next
    # Enter applied the rule
    up = "#anr-rows .anr-row[data-k='figure'] .anr-up"
    pg.focus(up)
    pg.keyboard.press("Enter")
    pg.wait_for_timeout(150)
    assert pg.evaluate("document.activeElement.closest('#anr-dlg')!==null")
    pg.keyboard.press("Enter")
    pg.wait_for_timeout(150)
    state = pg.evaluate("""(()=>[!document.getElementById('anr-dlg').hidden,
      !!document.activeElement.closest('#anr-dlg'),
      document.activeElement.className,
      [...document.querySelectorAll('#anr-rows .anr-row')].slice(0,3)
        .map(r=>r.dataset.k).join(',')])()""")
    assert state == [True, True, "anr-sel anr-fx", "figure,title,text"]
    assert anims(pg) == before
    # ---- After with By bullet: the box runs itself whole, and says why.
    # Only By bullet is off: All together is whole boxes, and may
    by = "#anr-rows .anr-row[data-k='text'] select.anr-by"
    state = (f"(()=>{{const b=document.querySelector(\"{by}\");"
             "return [b.disabled,b.value,/arrives whole/.test(b.title),"
             "b.querySelector('option[value=para]').disabled,"
             "b.querySelector('option[value=all]').disabled]})()")
    pg.select_option("#anr-rows .anr-row[data-k='text'] .anr-st", "after1")
    pg.wait_for_timeout(150)
    assert pg.evaluate(state) == [False, "", True, True, False]
    pg.select_option("#anr-rows .anr-row[data-k='text'] .anr-st", "click")
    pg.wait_for_timeout(150)
    assert pg.evaluate(state) == [False, "para", False, False, False]
    # every kind has the column: one by one, or all together
    assert pg.evaluate("[...document.querySelectorAll('#anr-rows "
                       "select.anr-by')].length") == 7
    # ---- every kind on None, every slide, Replace: it says what it
    # takes off -- before, and after -- and one Ctrl+Z gives it back
    for k in ("title", "text", "figure", "image", "table", "code", "shape"):
        pg.select_option(f"#anr-rows .anr-row[data-k='{k}'] .anr-fx",
                         "none")
    pg.select_option("#anr-scope", "all")
    pg.select_option("#anr-how", "replace")
    pg.wait_for_timeout(300)
    assert pg.evaluate("document.getElementById('anr-sum').textContent") \
        == "1 entrance taken off on 1 slide"
    said = apply(pg)
    assert said == "1 entrance taken off \u2014 Ctrl+Z undoes it"
    assert all(x == "-" for r in anims(pg) for x in r)
    away = pg.locator("#deck-stage .slide").first.bounding_box()
    pg.mouse.click(away["x"] + away["width"] * 0.9,
                   away["y"] + away["height"] * 0.95)
    pg.keyboard.press("Control+z")
    pg.wait_for_timeout(500)
    assert anims(pg) == before
    # ---- and the next ribbon open is on this slide, Keep theirs
    open_rule(pg)
    assert pg.evaluate("[document.getElementById('anr-scope').value,"
                       "document.getElementById('anr-how').value]") \
        == ["cur", "new"]
    pg.keyboard.press("Escape")
    pg.wait_for_timeout(200)
    assert errs == []
    ctx.close()


# the door in a generated ribbon layout that files it among small
# two-row buttons is one of them: icon and words on one line, inside its
# own box, over nothing (it was a tile squeezed to one 26px track)
@pytest.mark.parametrize("w,h,light", RUNS)
def test_the_door_among_small_buttons_is_one_of_them(app, w, h, light):
    ctx = app["b"].new_context(viewport={"width": w, "height": h})
    ctx.add_init_script(
        "try{localStorage.setItem('plotline-tour','1');"
        "localStorage.setItem('plotline-tour-editor','1');"
        "localStorage.setItem('jv-ribbon-layout','journey-poster-first');"
        + ("localStorage.setItem('plotline-scheme','light');" if light
           else "") + "}catch(e){}")
    ctx.route("https://cdn.jsdelivr.net/**",
              lambda rt: rt.fulfill(status=404, body=""))
    pg = ctx.new_page()
    errs: list = []
    pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.goto(app["url"], wait_until="load")
    _open(pg)
    click(pg, "#rbn-tab-talk")
    geo = pg.evaluate(r"""(()=>{const b=document.getElementById('anim-rule');
      const R=e=>e.getBoundingClientRect(),r=R(b),g=b.closest('.rbn-grp');
      const ic=R(b.querySelector('svg')),sp=R(b.querySelector('span'));
      const lab=R(g.querySelector(':scope>.rbn-lab'));
      const hit=[...g.querySelectorAll('button')].filter(x=>x!==b
        &&x.getClientRects().length).some(x=>{const p=R(x);
        return p.left<r.right-1&&r.left<p.right-1&&p.top<r.bottom-1
          &&r.top<p.bottom-1;});
      return {small:b.classList.contains('rbn-sm'),
        tile:b.classList.contains('big-tile'),
        inside:ic.top>=r.top-1&&ic.bottom<=r.bottom+1
          &&sp.bottom<=r.bottom+1&&sp.top>=r.top-1,
        overLabel:r.bottom>lab.top+1,hit:hit,
        txt:b.textContent.replace(/\s+/g,' ').trim()};})()""")
    assert geo == {"small": True, "tile": False, "inside": True,
                   "overLabel": False, "hit": False,
                   "txt": "Apply to slides\u2026"}
    assert errs == []
    ctx.close()


# ---- the 2026-10-17 review --------------------------------------------------
# A deck that keeps a rule for new slides ("Talk"), and one that does not.
# Its first slide is a two-column reveal built by hand: the title there, the
# two columns fading in on ONE click, then the figure zooming.
COLS = [_title(0),
        T("left words", x=5, y=30, w=40, anim={"type": "fade", "order": 0}),
        T("right words", x=55, y=30, w=40,
          anim={"type": "fade", "order": 0}),
        dict(FIG, y=60, h=30, anim={"type": "zoom", "order": 1})]
BARE = [_title(1), T("left", x=5, y=30, w=40), T("right", x=55, y=30, w=40),
        dict(FIG, y=60, h=30)]
RULE = {"k": {"title": {"fx": "none"}, "text": {"fx": "rise", "by": ""},
              "figure": {"fx": "zoom"}},
        "ord": ["title", "text", "figure"], "by": "kind", "nw": 1}


@pytest.fixture
def talk(browser, tmp_path):
    nb = tmp_path / NB.name
    nb.write_bytes(NB.read_bytes())
    decks = as_presentations([
        {"name": "Talk", "animRule": RULE,
         "slides": [{"layout": "blank", "annots": [dict(a) for a in COLS]},
                    {"layout": "blank", "annots": [dict(a) for a in BARE]}]},
        {"name": "other", "slides": [{"layout": "blank",
                                      "annots": [_title(0), T("y")]}]}])
    (tmp_path / _PROJECT_FILE).write_text(json.dumps(
        {"presentations": decks, "open": [str(nb)], "recent": [str(nb)]},
        indent=1) + "\n", encoding="utf-8")
    st = _AppState(tmp_path)
    srv = ThreadingHTTPServer(("127.0.0.1", 0), _make_handler(st))
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    url = f"http://127.0.0.1:{srv.server_address[1]}/?t={st.token}"
    try:
        yield {"b": browser, "url": url, "dir": tmp_path}
    finally:
        srv.shutdown()
        srv.server_close()


def _cold(app, w, h, light):
    """the reader as it loads: no deck opened, the editor never entered"""
    ctx = app["b"].new_context(viewport={"width": w, "height": h})
    ctx.add_init_script(
        "try{localStorage.setItem('plotline-tour','1');"
        "localStorage.setItem('plotline-tour-editor','1');"
        + ("localStorage.setItem('plotline-scheme','light');" if light
           else "") + "}catch(e){}")
    ctx.route("https://cdn.jsdelivr.net/**",
              lambda rt: rt.fulfill(status=404, body=""))
    pg = ctx.new_page()
    errs: list = []
    pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.goto(app["url"], wait_until="load")
    pg.wait_for_selector(".nbshell .card")
    return ctx, pg, errs


@pytest.mark.parametrize("w,h,light", RUNS)
def test_create_slides_offers_a_rule_before_any_deck_is_opened(talk, w, h,
                                                               light):
    """Create slides, pressed in a reader that has opened no deck: the
    dialog's own load of the editor brings the decks that keep a rule,
    by name. It offered none until a deck had been entered -- the hook
    was set by a tool booted on the editor's first entry."""
    ctx, pg, errs = _cold(talk, w, h, light)
    assert not pg.evaluate("document.body.classList.contains("
                           "'slide-editing')")
    click(pg, "#doc-autoslides")
    pg.locator("#auto-animations").check()
    pg.wait_for_function("!document.getElementById('auto-anim-how-wrap')"
                         ".hidden", timeout=20000)
    assert pg.evaluate("[...document.getElementById('auto-anim-how')"
                       ".options].map(o=>[o.value,o.textContent])") \
        == [["", "One per click, in notebook order"],
            ["Talk", "The animation rule of \u201cTalk\u201d"]]
    # the editor is on the page, never entered
    assert not pg.evaluate("document.body.classList.contains("
                           "'slide-editing')")
    pg.select_option("#auto-anim-how", "Talk")
    click(pg, "#auto-slides-create")
    pg.wait_for_function("/the rule of/.test((document.getElementById("
                         "'deck-toast')||{}).textContent||'')",
                         timeout=20000)
    doc = pg.evaluate("SemDeckFileHtml()")
    data = doc[doc.index('id="junoview-data">') + 19:]
    data = json.loads(data[:data.index("</" + "script>")])
    ps = data if isinstance(data, list) else data.get("presentations",
                                                      [data])
    made = [p for p in ps if p.get("name") not in ("Talk", "other")][0]
    assert not made.get("animRule")
    kinds = {(a.get("anim") or {}).get("type") for sl in made["slides"]
             for a in sl.get("annots", []) if a.get("k") == "cell"
             and a.get("part") not in ("code",)}
    assert "zoom" in kinds and "fade" not in kinds
    assert errs == []
    ctx.close()


def _clicks(pg, name, i):
    """slide i of deck `name` as 'type@order' per object, '-' for none"""
    doc = pg.evaluate("SemDeckFileHtml()")
    data = doc[doc.index('id="junoview-data">') + 19:]
    data = json.loads(data[:data.index("</" + "script>")])
    ps = data if isinstance(data, list) else data.get("presentations",
                                                      [data])
    s = [p for p in ps if p.get("name") == name][0]["slides"][i]
    return [("-" if not a.get("anim") else
             f"{a['anim']['type']}@{a['anim'].get('order', 0)}")
            for a in s["annots"]]


@pytest.mark.parametrize("w,h,light", RUNS)
def test_copy_keeps_two_columns_together(talk, w, h, light):
    """Copy this slide on a two-column reveal reads the words as All
    together; given back with Replace the slide is as it was (two
    clicks, not three), and given to a slide not yet animated its two
    columns arrive on one click."""
    ctx, pg, errs = _cold(talk, w, h, light)
    pg.wait_for_timeout(400)
    pg.evaluate("SemApp.deckLoad()")
    pg.evaluate("SemApp.deckChoose('Talk')")
    pg.wait_for_timeout(900)
    before = _clicks(pg, "Talk", 0)
    assert before == ["-", "fade@0", "fade@0", "zoom@1"]
    go(pg, 0)
    open_rule(pg)
    click(pg, "#anr-copy")
    row = ("k=>{const r=document.querySelector(`#anr-rows .anr-row"
           "[data-k='${k}']`);return [r.querySelector('.anr-fx').value,"
           "r.querySelector('.anr-st').value,"
           "r.querySelector('select.anr-by').value]}")
    assert pg.evaluate(row, "text") == ["fade", "click", "all"]
    assert pg.evaluate(row, "figure") == ["zoom", "click", ""]
    pg.select_option("#anr-how", "replace")
    pg.wait_for_function("/^2 clicks/.test(document.getElementById("
                         "'anr-pvn').textContent)")
    said = apply(pg)
    # nothing on the slide moves (the deck keeps the copied rule for its
    # new slides, which is all the toast has to say)
    assert "animated" not in said and "taken off" not in said, said
    assert _clicks(pg, "Talk", 0) == before
    # ...and to slide 2, whose columns are not animated yet
    go(pg, 1)
    open_rule(pg)
    click(pg, "#anr-copy")       # copies slide 2: nothing animated on it
    assert pg.evaluate(row, "text")[0] == "none"
    pg.keyboard.press("Escape")
    pg.wait_for_timeout(200)
    go(pg, 0)
    open_rule(pg)
    click(pg, "#anr-copy")
    pg.select_option("#anr-scope", "all")
    pg.wait_for_timeout(300)
    apply(pg)
    assert _clicks(pg, "Talk", 1) == ["-", "fade@0", "fade@0", "zoom@1"]
    assert errs == []
    ctx.close()
