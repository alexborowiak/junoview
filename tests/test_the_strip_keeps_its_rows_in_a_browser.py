"""The slide strip keeps its rows -- and a kept row is never stale. Driven
in Chromium against the real app server.

Opt-in like the theme matrix (it needs Playwright's Chromium): set
``JUNOVIEW_BROWSER_TESTS=1``. The pure halves run in the ordinary suite
(tests/test_the_strip_keeps_its_rows.py).

The oracle is the strip built from nothing. After each gesture the strip
as the editor left it -- most rows kept, a few drawn -- is read out row by
row (every thumbnail drawn out first, by scrolling the strip through), and
then the strip is made to build every row afresh (Headings and back: the
view is part of every row's key, so nothing is kept across it) and read
out again. The two must be the same, byte for byte once a picture is named
by its bytes rather than its URL. The gestures are the ones that change
what rows show without changing every row: an edit then a slide change,
undo and redo, add, duplicate, delete, a drag, a section folded, a
version group opened, the deck's page colour and its undo, and a notebook
reloaded with different figures under live links (the rows showing none
of its cards are kept) -- and the ways back to a deck the switch package
resumes (a notebook tab and back keeps the very rows, and the undo it kept
still undoes into rows that are right), and a notebook no slide shows
reloaded (every row kept). The slide sorter's tiles, which copy the
strip's thumbnails, are held to the same test.
"""

from __future__ import annotations

import json
import os
import threading
from http.server import ThreadingHTTPServer
from pathlib import Path

import pytest

from junoview.server.routes import _make_handler
from junoview.server.state import _PROJECT_FILE, _AppState

ROOT = Path(__file__).resolve().parent.parent
NB = ROOT / "examples" / "example_climate_analysis.ipynb"
NB2 = ROOT / "examples" / "example_widget.ipynb"

READ = r"""async (which)=>{
  const sleep=ms=>new Promise(r=>setTimeout(r,ms));
  const raf=()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
  const named={};
  async function name(s){
    if(!s) return '';
    if(named[s]) return named[s];
    let bytes;
    if(s.startsWith('data:')){
      const c=s.indexOf(',');
      try{const b=atob(s.slice(c+1));bytes=new Uint8Array(b.length);
        for(let i=0;i<b.length;i++) bytes[i]=b.charCodeAt(i);}
      catch(e){bytes=new TextEncoder().encode(s);}
    } else if(s.startsWith('blob:')){
      bytes=new Uint8Array(await (await fetch(s)).arrayBuffer());
    } else return s;
    let h=2166136261;
    for(let i=0;i<bytes.length;i++){h^=bytes[i];h=Math.imul(h,16777619)>>>0;}
    return named[s]='IMG'+h.toString(16)+':'+bytes.length;
  }
  async function norm(el){
    const c=el.cloneNode(true);
    for(const im of c.querySelectorAll('img')){
      im.setAttribute('src',await name(im.getAttribute('src')));
      im.removeAttribute('loading');}
    for(const e of [c,...c.querySelectorAll('*')]){
      if(e.classList&&e.classList.length)
        e.setAttribute('class',[...e.classList].sort().join(' '));
      if(e.hasAttribute('title')){const t=e.getAttribute('title');
        e.removeAttribute('title');if(t) e.setAttribute('data-tip',t);}
      const at=[...e.attributes].map(x=>[x.name,x.value])
        .sort((p,q)=>p[0]<q[0]?-1:1);
      at.forEach(x=>e.removeAttribute(x[0]));
      at.forEach(x=>e.setAttribute(x[0],x[1]));
    }
    let html=c.outerHTML;
    const ids=[];html.replace(/ id="([^"]+)"/g,(m,a)=>{ids.push(a);return m;});
    ids.sort((a,b)=>b.length-a.length)
      .forEach((id,k)=>{html=html.split(id).join('ID'+k);});
    return html;
  }
  const sc=which==='sorter'?document.querySelector('#deck-overview .ovw-body')
    :document.querySelector('#film-list');
  const keep=sc.scrollTop;
  for(let y=0;y<=sc.scrollHeight+sc.clientHeight;y+=Math.max(80,sc.clientHeight/2)){
    sc.scrollTop=y;await raf();await sleep(30);}
  sc.scrollTop=keep;await raf();await sleep(60);
  const els=which==='sorter'?[...sc.querySelectorAll('.ovw-tile')]:[...sc.children];
  const out=[];
  for(const e of els) out.push(await norm(e));
  return {rows:out,lazy:sc.querySelectorAll('.mini-lazy').length};}"""


def _need_browser():
    if os.environ.get("JUNOVIEW_BROWSER_TESTS") != "1":
        pytest.skip("set JUNOVIEW_BROWSER_TESTS=1 for the Chromium checks")
    try:
        from playwright.sync_api import sync_playwright  # noqa: F401
    except ImportError:
        pytest.skip("Playwright is not installed")


def _deck(stem: str, figs: list, notes: list) -> dict:
    slides = []
    for i in range(36):
        if i % 6 == 0:
            slides.append({"layout": "title", "title": f"Part {i // 6 + 1}",
                           "sub": "sub", "annots": []})
            continue
        an = [{"k": "text", "x": 6, "y": 5, "w": 88, "size": 4,
               "text": f"Slide {i + 1}", "style": "h1"}]
        if i % 4 != 3:
            an.append({"k": "cell", "x": 6, "y": 20, "w": 52, "h": 66,
                       "ref": f"{stem}::{figs[i % len(figs)]}"})
        if i % 7 == 2:
            an.append({"k": "cell", "x": 60, "y": 60, "w": 30, "h": 30,
                       "ref": f"{stem}::{notes[i % len(notes)]}"})
        if i % 3 == 0:
            an.append({"k": "rect", "x": 62, "y": 70, "w": 30, "h": 14,
                       "shape": "rect", "color": "@accent"})
            an.append({"k": "arrow", "x1": 60, "y1": 50, "x2": 70, "y2": 70})
        if i % 11 == 4:
            an.append({"k": "rect", "x": 10, "y": 70, "w": 20, "h": 14,
                       "shape": "ellipse", "grad": {"type": "linear", "stops": [
                           {"c": "#ff0000", "o": 0}, {"c": "#0000ff", "o": 1}]}})
        s = {"layout": "blank", "annots": an}
        if i % 8 == 1:
            s["opt"] = 1
        if i % 13 == 3:
            s["hide"] = 1
        if 8 <= i < 14:
            s["sec"] = "sa"
        if i in (20, 21, 22):
            s["alt"] = "g1"
        if i in (32, 33):
            # twins: alike in every respect, so they share a key
            s = {"layout": "blank", "annots": [
                {"k": "text", "x": 10, "y": 10, "w": 60, "size": 4,
                 "text": "Twin"},
                {"k": "rect", "x": 20, "y": 40, "w": 30, "h": 20,
                 "shape": "rect", "color": "#4fb3d9"}]}
        slides.append(s)
    return {"name": "kept", "slides": slides,
            "sections": {"sa": {"name": "Methods"}},
            "live": {f"{stem}::{a}": 1 for a in figs[:2]}}


def test_a_kept_strip_is_the_strip_built_from_nothing(tmp_path):
    _need_browser()
    from playwright.sync_api import sync_playwright
    nb = tmp_path / NB.name
    nb.write_bytes(NB.read_bytes())
    (tmp_path / _PROJECT_FILE).write_text(json.dumps(
        {"presentations": [], "open": [str(nb)], "recent": [str(nb)]}),
        encoding="utf-8")
    st = _AppState(tmp_path)
    srv = ThreadingHTTPServer(("127.0.0.1", 0), _make_handler(st))
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    url = f"http://127.0.0.1:{srv.server_address[1]}/?t={st.token}"
    try:
        with sync_playwright() as pw:
            try:
                b = pw.chromium.launch()
            except Exception as e:  # noqa: BLE001
                pytest.skip(f"Chromium will not launch here: {e}")
            ctx = b.new_context(viewport={"width": 1366, "height": 657})
            ctx.add_init_script(
                "try{localStorage.setItem('plotline-tour','1');"
                "localStorage.setItem('plotline-tour-editor','1');}catch(e){}")
            ctx.route("https://cdn.jsdelivr.net/**",
                      lambda rt: rt.fulfill(status=404, body=""))
            pg = ctx.new_page()
            errs: list = []
            pg.on("pageerror", lambda e: errs.append(str(e)))
            pg.goto(url, wait_until="load")
            pg.wait_for_selector(".nbshell .card")
            # the app loads the editor on first use (app.js jvDeck); this
            # drives its API, so it asks for it first
            pg.evaluate("window.SemApp.deckLoad()")
            stem = pg.evaluate("window.SemApp.active")
            cards = pg.evaluate(
                "[...document.querySelectorAll('.nbshell .card[data-anchor]')]"
                ".map(c=>[c.dataset.anchor,c.dataset.kind])")
            figs = [a for a, k in cards if k == "figure"]
            notes = [a for a, k in cards if k == "note"]
            pg.evaluate("t=>{window.SemDeckImport(t,false);return 1}",
                        json.dumps(_deck(stem, figs, notes)))
            pg.wait_for_timeout(1200)
            kb = pg.keyboard

            def view(label):
                pg.click("#film-view-btn")
                pg.evaluate(
                    "l=>{const b=[...document.querySelectorAll("
                    "'#film-view-menu button')].find(b=>b.textContent.trim()"
                    ".startsWith(l));b.click()}", label)
                pg.wait_for_timeout(150)

            def same(why):
                pg.wait_for_timeout(400)
                kept = pg.evaluate(READ, "strip")
                view("Headings")
                view("Thumbnails")
                fresh = pg.evaluate(READ, "strip")
                assert kept["lazy"] == 0 and fresh["lazy"] == 0, why
                assert len(kept["rows"]) == len(fresh["rows"]), why
                for i, (x, y) in enumerate(zip(kept["rows"], fresh["rows"],
                                               strict=True)):
                    assert x == y, f"{why}: row {i} kept stale"
                return kept["rows"]

            def stage():
                pg.mouse.click(235, 420)

            def nudge():
                p = pg.evaluate(
                    "(()=>{const it=[...document.querySelectorAll("
                    "'#deck .annot-layer>.an-item')].filter(e=>e.offsetParent&&"
                    "!e.classList.contains('an-arrow-hit'));const e=it[0];"
                    "if(!e)return null;const r=e.getBoundingClientRect();"
                    "return [r.x+r.width/2,r.y+Math.min(r.height/2,12)]})()")
                pg.mouse.click(*p)
                kb.press("ArrowRight")
                kb.press("Escape")

            def tab(rx):
                pg.evaluate(
                    "rx=>{const r=new RegExp(rx);const t=[...document"
                    ".querySelectorAll('[role=tab]')].find(e=>r.test("
                    "e.textContent)&&e.offsetParent);t.click()}", rx)
                pg.wait_for_timeout(400)

            first = same("opened")
            stage()
            for _ in range(4):
                kb.press("PageDown")
            nudge()
            stage()
            kb.press("PageDown")
            same("an edit, then a slide change")
            kb.press("Control+z")
            same("undo")
            kb.press("Control+y")
            same("redo")
            stage()
            kb.press("Control+m")
            same("a slide added")
            kb.press("Control+z")
            same("the add undone")
            pg.click("#hm-dupslide")
            same("duplicate")
            # one of two slides imported alike edited: its row was redrawn
            # in place (refreshThumb), and neither row may come back as
            # the other's. (The deck's slide names usually tell twins
            # apart before this; the rule that a redrawn row is never
            # kept is run directly in test_the_strip_keeps_its_rows.py.)
            twins = pg.evaluate(
                "(()=>{const r=[...document.querySelectorAll('#film-list "
                ".film-row')].filter(r=>r.querySelector('.film-t')"
                ".textContent==='Twin');r[0].querySelector('.film-label')"
                ".scrollIntoView({block:'nearest'});r[0].querySelector("
                "'.film-label').click();return r.length;})()")
            assert twins == 2
            nudge()
            pg.wait_for_timeout(400)
            stage()
            kb.press("PageDown")
            same("one of two alike slides edited")
            pg.click("#hm-delslide")
            same("delete")
            pg.evaluate("document.querySelector('#film-list .film-sec-fold').click()")
            same("a section folded")
            pg.evaluate("document.querySelector('#film-list .film-sec-fold').click()")
            pg.evaluate("document.querySelector('#film-list .alt-pill').click()")
            same("a version group opened")
            ok = pg.evaluate("""([a,b])=>{
              const L=document.querySelector('#film-list');
              const s=L.querySelector('.film-row[data-idx="'+a+'"]'),
                    t=L.querySelector('.film-row[data-idx="'+b+'"]');
              const dt=new DataTransfer();
              s.dispatchEvent(new DragEvent('dragstart',
                {bubbles:true,dataTransfer:dt}));
              const r=t.getBoundingClientRect(),y=r.top+r.height*0.8;
              t.dispatchEvent(new DragEvent('dragover',{bubbles:true,cancelable:true,
                dataTransfer:dt,clientY:y}));
              t.dispatchEvent(new DragEvent('drop',{bubbles:true,cancelable:true,
                dataTransfer:dt,clientY:y}));
              s.dispatchEvent(new DragEvent('dragend',{bubbles:true,dataTransfer:dt}));
              return true;}""", [2, 5])
            assert ok
            same("a drag")
            pg.click("#rbn-tab-design")
            pg.evaluate("(()=>{const c=[...document.querySelectorAll("
                        "'#bg-run-every .bg-chip')];c[c.length-1].click()})()")
            light = same("the deck's page colour")
            kb.press("Control+z")
            same("the page colour undone")
            assert light != first
            pg.click("#rbn-tab-home")
            # the sorter copies the strip's thumbnails: the same test
            pg.click("#rbn-tab-view")
            pg.click("#vw-sorter")
            pg.wait_for_timeout(500)
            tiles = pg.evaluate(READ, "sorter")
            kb.press("Escape")
            view("Headings")
            view("Thumbnails")
            pg.click("#vw-sorter")
            pg.wait_for_timeout(500)
            assert pg.evaluate(READ, "sorter")["rows"] == tiles["rows"]
            kb.press("Escape")
            pg.click("#rbn-tab-home")
            # the way back to a deck left open in its tab (the switch
            # package's resume): nothing reached it, so its rows are the
            # very nodes it left -- and still the strip built from
            # nothing -- and the undo it kept undoes into kept rows
            stage()
            kb.press("PageDown")
            pg.wait_for_timeout(300)
            rows = pg.evaluate("document.querySelectorAll('#film-list "
                               ".film-row').length")
            pg.evaluate("[...document.querySelectorAll('#film-list .film-row')]"
                        ".forEach(r=>{r.__k=1;})")
            tab("example_climate")
            tab("kept")
            assert pg.evaluate(
                "[...document.querySelectorAll('#film-list .film-row')]"
                ".every(r=>r.__k)"), "the rows were drawn again"
            same("a notebook tab and back")
            assert pg.evaluate("!document.getElementById('dc-undo').disabled")
            kb.press("Control+z")
            same("undo after coming back")
            kb.press("Control+y")
            same("redo after coming back")
            # another deck in the editor and back: its rows replace these,
            # and coming back draws this deck's again, none of the other's
            other = {"name": "other", "slides": [
                {"layout": "blank", "annots": [
                    {"k": "text", "x": 10, "y": 10, "w": 60, "size": 4,
                     "text": f"Other {i}"}]} for i in range(5)]}
            pg.evaluate("t=>{window.SemDeckImport(t,false);return 1}",
                        json.dumps(other))
            pg.wait_for_timeout(800)
            assert pg.evaluate("document.querySelectorAll('#film-list "
                               ".film-row').length") == 5
            pg.evaluate("window.SemApp.deckChoose('kept')")
            pg.wait_for_timeout(800)
            assert pg.evaluate("document.querySelectorAll('#film-list "
                               ".film-row').length") == rows
            same("another deck and back")
            # a notebook reloaded with other figures, under live links
            before = pg.evaluate(READ, "strip")["rows"]
            # (every row drawn now: mark each, and whether it shows a card)
            pg.evaluate("[...document.querySelectorAll('#film-list .film-row')]"
                        ".forEach(r=>{r.__k=1;r.__fig=!!r.querySelector("
                        "'.mini-pane,.an-cell,.is-flip');})")
            tab("example_climate")
            d = json.loads(nb.read_text(encoding="utf-8"))
            pics = [o for c in d["cells"] if c["cell_type"] == "code"
                    for o in c.get("outputs", [])
                    if "image/png" in o.get("data", {})]
            pics[0]["data"]["image/png"], pics[1]["data"]["image/png"] = (
                pics[1]["data"]["image/png"], pics[0]["data"]["image/png"])
            nb.write_text(json.dumps(d), encoding="utf-8")
            pg.evaluate("(()=>{const s=document.querySelector('.nbshell:not("
                        "[hidden])');s.__old=1;window.SemApp.reloadTab("
                        "window.SemApp.active);})()")
            pg.wait_for_function(
                "(()=>{const s=document.querySelector('.nbshell:not([hidden])');"
                "return !!(s&&!s.__old&&s.querySelector('.card'))})()",
                timeout=30000)
            tab("kept")
            # the rows that show that notebook's cards are drawn again; the
            # rows that show none of them are the very rows they were
            rows_now = pg.evaluate(
                "(()=>{const r=[...document.querySelectorAll('#film-list "
                ".film-row')];return {n:r.length,keptFig:r.filter(x=>x.__k"
                "&&x.__fig).length,kept:r.filter(x=>x.__k).length}})()")
            assert rows_now["keptFig"] == 0, rows_now
            assert 0 < rows_now["kept"] < rows_now["n"], rows_now
            after = same("a notebook reloaded with other figures")
            assert after != before, "the live figures changed"
            # another notebook, which no slide shows, reloaded: every row
            # is the row it was (the change is counted where it happened)
            nb2 = tmp_path / NB2.name
            nb2.write_bytes(NB2.read_bytes())
            pg.evaluate("p=>window.SemApp.openPath(p)", str(nb2))
            pg.wait_for_function(
                "[...document.querySelectorAll('[role=tab]')].some("
                "t=>/example_widget/.test(t.textContent))", timeout=30000)
            pg.wait_for_timeout(600)
            tab("kept")
            pg.evaluate("[...document.querySelectorAll('#film-list .film-row')]"
                        ".forEach(r=>{r.__k=1;})")
            tab("example_widget")
            d2 = json.loads(nb2.read_text(encoding="utf-8"))
            for c in d2["cells"]:
                if c["cell_type"] == "markdown":
                    src = c["source"]
                    src = "".join(src) if isinstance(src, list) else src
                    c["source"] = src + "\n\nEdited on disk."
                    break
            nb2.write_text(json.dumps(d2), encoding="utf-8")
            pg.evaluate("(()=>{const s=document.querySelector('.nbshell:not("
                        "[hidden])');s.__old=1;window.SemApp.reloadTab("
                        "window.SemApp.active);})()")
            pg.wait_for_function(
                "(()=>{const s=document.querySelector('.nbshell:not([hidden])');"
                "return !!(s&&!s.__old&&s.querySelector('.card'))})()",
                timeout=30000)
            tab("kept")
            assert pg.evaluate(
                "[...document.querySelectorAll('#film-list .film-row')]"
                ".every(r=>r.__k)"), "a row was drawn again"
            same("another notebook reloaded")
            assert not errs, errs
            b.close()
    finally:
        srv.shutdown()
