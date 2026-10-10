"""Reading a notebook, driven in Chromium against the real app server:
what the reader now keeps or skips is never stale (2026-10-09, speed).

Opt-in like the theme matrix (it needs Playwright's Chromium): set
``JUNOVIEW_BROWSER_TESTS=1``. The pure halves run in the ordinary suite
(test_reader_keeps_its_lookups.py).

1. A filter changes the notebook it belongs to and no other, and what a
   notebook's kept index (shellIdx) gives is what a fresh look gives.
2. A note added in place joins the index: the filters reach it and the
   scroll-spy lights its outline row.
3. The scroll-spy lights one row, one section and the graph node of the
   card being read, and follows cards renamed in place.
4. Find marks what it finds, and closing it takes every mark back off --
   copies of a marked card (a tree node) included.
5. Versions is not a modal dialog, and does what one did: the keyboard
   stays in it, a click outside does nothing, Escape closes it and the
   button that opened it gets the keyboard back.
6. A tab switch moves the highlight on the tabs it already drew; closing
   a notebook draws them again.
7. The figure and text sizes reach a notebook not on screen when it is
   shown.
8. The layout is saved when the page goes away, not only after the wait.
9. While the window scrolls a clear sheet takes the pointer; a real mouse
   move gives it straight back.
10. The raw view mirrors every output and lays out its cells lazily.
11. The tree's edges are routed once it has settled.

And six reader bugs reviewers found during that work (2026-10-10; the
pure halves are in test_reader_shows_what_it_says.py):

12. The ribbon's Expand all opens and fills every tree node.
13. Find searches what is on screen: the raw view while Raw is shown,
    the formatted document again when it is not.
14. The raw view's copies of the cards' outputs own their ids: no id is
    on the page twice that was not already, and a label there works its
    own checkbox.
15. Find opens a clamped long note to show a match inside it, and closes
    it again with the rest.
16. Reload of a notebook changed on disk keeps the card being read where
    it was on screen.
17. A Plotly figure in a section left collapsed is drawn at its width
    once the section is opened, not at the 700 px of a hidden draw.
"""

from __future__ import annotations

import copy
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

SMALL = {"cells": [
    {"cell_type": "markdown", "id": "h1", "source": "# Report"},
    {"cell_type": "markdown", "id": "intro", "source": "An opening note."},
    {"cell_type": "code", "id": "c0",
     "source": "#| id: load\nload()", "outputs": []},
    {"cell_type": "markdown", "id": "mid", "source": "A note between."},
    {"cell_type": "code", "id": "c1",
     "source": "#| display: figure\n#| id: figx\nplot()",
     "outputs": [{"output_type": "display_data",
                  "data": {"image/png": "aGk="}}]},
    {"cell_type": "markdown", "id": "end", "source": "A closing note."},
]}


def _need_browser():
    if os.environ.get("JUNOVIEW_BROWSER_TESTS") != "1":
        pytest.skip("set JUNOVIEW_BROWSER_TESTS=1 for the Chromium checks")
    try:
        from playwright.sync_api import sync_playwright  # noqa: F401
    except ImportError:
        pytest.skip("Playwright is not installed")


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


def _serve(root: Path):
    st = _AppState(root)
    srv = ThreadingHTTPServer(("127.0.0.1", 0), _make_handler(st))
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return srv, f"http://127.0.0.1:{srv.server_address[1]}/?t={st.token}"


@pytest.fixture
def two(browser, tmp_path):
    """the example notebook and the widget one, both open"""
    nb = tmp_path / NB.name
    nb.write_bytes(NB.read_bytes())
    nb2 = tmp_path / NB2.name
    nb2.write_bytes(NB2.read_bytes())
    (tmp_path / _PROJECT_FILE).write_text(json.dumps(
        {"presentations": [], "open": [str(nb), str(nb2)],
         "recent": [str(nb), str(nb2)]}, indent=1) + "\n", encoding="utf-8")
    srv, url = _serve(tmp_path)
    try:
        yield {"b": browser, "url": url, "stem": nb.stem, "stem2": nb2.stem}
    finally:
        srv.shutdown()
        srv.server_close()


@pytest.fixture
def small(browser, tmp_path):
    f = tmp_path / "report.ipynb"
    f.write_text(json.dumps(copy.deepcopy(SMALL)), encoding="utf-8")
    (tmp_path / _PROJECT_FILE).write_text(json.dumps(
        {"presentations": [], "open": [str(f)], "recent": [str(f)]},
        indent=1) + "\n", encoding="utf-8")
    srv, url = _serve(tmp_path)
    try:
        yield {"b": browser, "url": url, "stem": "report"}
    finally:
        srv.shutdown()
        srv.server_close()


def _page(app, w=1366, h=657, plotly=None):
    ctx = app["b"].new_context(viewport={"width": w, "height": h})
    ctx.add_init_script(
        "try{localStorage.setItem('plotline-tour','1');"
        "localStorage.setItem('plotline-tour-editor','1');}catch(e){}")
    pg = ctx.new_page()
    pg.route("https://cdn.jsdelivr.net/**",
             lambda r: r.fulfill(status=404, body=b""))
    if plotly is None:
        pg.route("https://cdn.plot.ly/**",
                 lambda r: r.fulfill(status=404, body=b""))
    else:   # a stand-in for plotly.js (the CDN is not ours to need)
        pg.route("https://cdn.plot.ly/**", lambda r: r.fulfill(
            status=200, body=plotly,
            headers={"content-type": "application/javascript"}))
    errors: list[str] = []
    pg.on("pageerror", lambda e: errors.append(str(e)))
    pg.goto(app["url"])
    pg.wait_for_selector(".nbshell .card")
    pg.wait_for_timeout(600)
    return ctx, pg, errors


# what a notebook's cards, sections and outline wear, as one value
STATE = r"""
(stem)=>{const el=window.SemApp.shells[stem].el;
 const c=x=>[...x.classList].sort().join(' ');
 return {cards:[...el.querySelectorAll('.content .card')].map(x=>x.id+':'+c(x)
   +':'+x.querySelectorAll('.part-off,.part-fold,.code-off,.pt-off,.pt-fold,'
   +'.ot-off,.ot-fold').length),
  secs:[...el.querySelectorAll('.section')].map(x=>c(x)),
  nav:[...el.querySelectorAll('.navitem,.navsec-row,.navitems')]
    .map(x=>[...x.classList].filter(k=>k!=='active').sort().join(' ')),
  eyes:[...el.querySelectorAll('.cell-eye,.navitem-eye,.sec-eye,.navsec-eye,'
    +'.sec-hideall,.navsec-hideall')].map(x=>[x.getAttribute('aria-pressed'),
    x.getAttribute('aria-label'),x.textContent].join('|'))};}
"""


def test_a_filter_reaches_its_own_notebook_and_the_index_is_never_stale(two):
    ctx, pg, errors = _page(two)
    s1, s2 = two["stem"], two["stem2"]
    pg.evaluate(f"window.SemApp.activate('{s2}')")
    pg.evaluate(f"window.SemApp.activate('{s1}')")
    other = pg.evaluate(STATE, s2)
    for b in ("#tv-markdown", "#tv-markdown", "#tv-plots", "#tv-code",
              "#tv-code", "#tv-output"):
        pg.evaluate(f"document.querySelector('{b}').click()")
    # the other notebook wears what it wore
    assert pg.evaluate(STATE, s2) == other
    mine = pg.evaluate(STATE, s1)
    assert any("is-hidden" in x for x in mine["cards"])
    assert any("collapsed" not in x and ":0" not in x for x in mine["cards"])
    # what the kept index gave is what a fresh look gives
    pg.evaluate("(stem)=>{const A=window.SemApp;"
                "A.shellIdxDrop(A.shells[stem].el);A.refilter(A.shells[stem].el);}",
                s1)
    assert pg.evaluate(STATE, s1) == mine
    # ...and a cell hidden by its eye is counted and reported by both
    pg.evaluate(f"(()=>{{const el=window.SemApp.shells['{s1}'].el;"
                "const c=[...el.querySelectorAll('.content .card')]"
                ".find(c=>!c.classList.contains('is-hidden'));"
                "c.querySelector('.cell-eye').click();})()")
    hid = pg.evaluate(STATE, s1)
    pg.evaluate("(stem)=>{const A=window.SemApp;"
                "A.shellIdxDrop(A.shells[stem].el);A.refilter(A.shells[stem].el);}",
                s1)
    assert pg.evaluate(STATE, s1) == hid
    assert pg.evaluate(STATE, s2) == other
    ctx.close()
    assert not errors, errors


def test_a_note_added_in_place_is_filtered_and_lit_like_the_rest(small):
    ctx, pg, errors = _page(small)
    pg.evaluate("document.querySelectorAll('.content .card')"
                ".forEach(c=>c.__old=1)")
    pg.evaluate("document.querySelector('.card[data-anchor=load] "
                ".card-addnote').click()")
    pg.fill("#note-dlg-src", "Added *here*.")
    pg.click("#note-dlg-save")
    pg.wait_for_function("document.querySelector('#note-dlg').hidden")
    pg.wait_for_timeout(500)
    notes = ("(()=>{const el=window.SemApp.shells.report.el;"
             "return [...el.querySelectorAll('.content .card[data-note=\"1\"]')]"
             ".map(c=>c.classList.contains('is-hidden'))})()")
    assert pg.evaluate(notes) and not any(pg.evaluate(notes))
    # Markdown off -> on -> off: every note goes, the new one with them
    for _ in range(2):
        pg.evaluate("document.querySelector('#tv-markdown').click()")
    assert pg.evaluate("document.querySelector('#tv-markdown')"
                       ".getAttribute('data-cs')") == "hidden"
    assert all(pg.evaluate(notes))
    pg.evaluate("document.querySelector('#tv-markdown').click()")
    assert not any(pg.evaluate(notes))
    # a cell eye on the new card is counted and reported like the rest
    pg.evaluate("(()=>{const el=window.SemApp.shells.report.el;"
                "const c=[...el.querySelectorAll('.content .card')].find(c=>"
                "!c.__old&&c.dataset.note==='1'&&c.textContent.indexOf('Added')"
                ">=0);c.querySelector('.cell-eye').click();})()")
    peek = pg.evaluate("document.querySelector('.nbshell:not([hidden]) "
                       ".rf-unhide').textContent")
    assert "(1)" in peek
    ctx.close()
    assert not errors, errors


SPY = r"""
()=>{const el=document.querySelector('.nbshell:not([hidden])');
 return {items:[...el.querySelectorAll('.navitem.active')].map(n=>n.dataset.item),
  secs:[...el.querySelectorAll('.navsec.active')].map(n=>n.dataset.sec),
  nodes:[...el.querySelectorAll('.provnode.active')].map(n=>n.dataset.node),
  lit:[...el.querySelectorAll('.provedge.lit')].map(p=>p.dataset.from+'>'
    +p.dataset.to)};}
"""


def test_the_spy_lights_the_card_being_read(two):
    ctx, pg, errors = _page(two)
    cards = pg.evaluate("[...document.querySelectorAll('.nbshell:not([hidden])"
                        " .content .card[data-node]')].map(c=>c.id)")
    assert len(cards) > 4
    for cid in (cards[3], cards[-2], cards[1]):
        for _ in range(3):
            pg.evaluate(f"document.getElementById('{cid}')"
                        ".scrollIntoView({block:'start',behavior:'instant'})")
            pg.wait_for_timeout(250)
        pg.wait_for_timeout(500)
        got = pg.evaluate(SPY)
        assert len(got["items"]) == 1 and len(got["secs"]) == 1
        card = pg.evaluate(
            f"(()=>{{const c=document.querySelector('.nbshell:not([hidden]) "
            f".card[id=\"card-{got['items'][0]}\"]');return [c.dataset.node,"
            "c.closest('.section').dataset.sec]})()")
        assert got["secs"] == [card[1]]
        drawn = card[0] and pg.evaluate(
            f"!!document.querySelector('.nbshell:not([hidden]) "
            f".provnode[data-node=\"{card[0]}\"]')")
        assert got["nodes"] == ([card[0]] if drawn else [])
        if drawn:
            want = pg.evaluate(
                f"[...document.querySelectorAll('.nbshell:not([hidden]) "
                f".provedge')].filter(p=>p.dataset.from==='{card[0]}'||"
                f"p.dataset.to==='{card[0]}').map(p=>p.dataset.from+'>'+p.dataset.to)")
            assert sorted(got["lit"]) == sorted(want)
    ctx.close()
    assert not errors, errors


def test_find_marks_and_closing_takes_every_mark_back(two):
    ctx, pg, errors = _page(two)
    pg.keyboard.press("Control+f")
    pg.keyboard.type("anomaly")
    pg.wait_for_function("(document.getElementById('docfind-n')||{})"
                         ".textContent&&/\\//.test(document.getElementById("
                         "'docfind-n').textContent)", timeout=10000)
    n = pg.evaluate("document.querySelectorAll('mark.jv-doc').length")
    # every visible occurrence of the word, and none twice
    want = pg.evaluate(
        "(()=>{const sh=document.querySelector('.nbshell:not([hidden]) "
        ".content');let n=0;const w=document.createTreeWalker(sh,4);let t;"
        "while((t=w.nextNode())){let p=t.parentNode,skip=false;while(p&&p!==sh)"
        "{if(/^(SCRIPT|STYLE|SVG|CANVAS|TEXTAREA|INPUT)$/.test(p.nodeName)||"
        "(p.classList&&p.classList.contains('jv-hit')&&!p.classList.contains("
        "'jv-doc'))){skip=true;break}p=p.parentNode}if(skip)continue;"
        "n+=(t.nodeValue.toLowerCase().split('anomaly').length-1)}"
        "return n})()")
    assert n > 0 and n == want
    pg.keyboard.press("Enter")
    assert pg.evaluate("document.querySelectorAll('mark.jv-doc.on').length") == 1
    # a copy of a marked card: the tree, expanded
    pg.evaluate("window.SemView.tree()")
    pg.evaluate("document.querySelectorAll('.nbshell:not([hidden]) "
                ".treeview .tree-node-head').forEach(h=>h.click())")
    pg.wait_for_timeout(1500)
    copies = pg.evaluate("document.querySelectorAll('.treeview mark.jv-doc')"
                         ".length")
    pg.evaluate("window.SemView.tree()")
    pg.keyboard.press("Escape")
    pg.evaluate("document.getElementById('docfind-x')&&"
                "document.getElementById('docfind-x').click()")
    pg.wait_for_timeout(300)
    left = pg.evaluate("[document.querySelectorAll('mark.jv-doc').length,"
                       "document.querySelectorAll('.jv-hitcard').length,"
                       "document.querySelectorAll('.jv-hitopen').length]")
    assert copies > 0
    assert left == [0, 0, 0]
    ctx.close()
    assert not errors, errors


def test_versions_is_not_modal_but_keeps_the_keyboard(two):
    ctx, pg, errors = _page(two)
    btn = pg.evaluate(
        "(()=>{const b=document.querySelector('.nbshell:not([hidden]) "
        ".card .cell-history-btn');b.scrollIntoView({block:'center'});"
        "const r=b.getBoundingClientRect();return [r.x+r.width/2,"
        "r.y+r.height/2]})()")
    pg.wait_for_timeout(200)
    pg.mouse.move(btn[0], btn[1])
    pg.mouse.click(btn[0], btn[1])
    pg.wait_for_selector("dialog.cell-history[open]")
    st = pg.evaluate(
        "(()=>{const d=document.querySelector('dialog.cell-history');"
        "return {modal:d.matches(':modal'),back:!!document.querySelector("
        "'.ch-backdrop'),focus:document.activeElement.className,"
        "z:getComputedStyle(d).zIndex,pos:getComputedStyle(d).position,"
        "box:(r=>[r.left>0,r.top>0,r.right<innerWidth,r.bottom<innerHeight])"
        "(d.getBoundingClientRect())}})()")
    assert not st["modal"] and st["back"]
    assert st["focus"] == "ch-close" and st["pos"] == "fixed"
    assert all(st["box"])
    # the keyboard never reaches the page behind (past the last stop it
    # may leave the page for the browser, as from a modal)
    inside = ("(()=>{const a=document.activeElement;return a===document.body"
              "||!!a.closest('dialog.cell-history')})()")
    for _ in range(6):
        pg.keyboard.press("Tab")
        assert pg.evaluate(inside)
    for _ in range(6):
        pg.keyboard.press("Shift+Tab")
        assert pg.evaluate(inside)
    # the backdrop takes a click outside, and the dialog stays
    pg.mouse.click(5, 330)
    pg.wait_for_timeout(200)
    assert pg.evaluate("!!document.querySelector('dialog.cell-history[open]')")
    pg.keyboard.press("Escape")
    pg.wait_for_timeout(300)
    after = pg.evaluate("[!!document.querySelector('dialog.cell-history'),"
                        "!!document.querySelector('.ch-backdrop')]")
    assert after == [False, False]
    # opened again from the keyboard, closed by Escape: the opener gets it
    pg.evaluate("document.querySelector('.nbshell:not([hidden]) .card "
                ".cell-history-btn').focus()")
    pg.keyboard.press("Enter")
    pg.wait_for_selector("dialog.cell-history[open]")
    pg.keyboard.press("Escape")
    pg.wait_for_timeout(300)
    assert pg.evaluate("document.activeElement.classList.contains("
                       "'cell-history-btn')")
    ctx.close()
    assert not errors, errors


def _ax_buttons(pg):
    """the names of the buttons a screen reader is given (Chrome's own
    accessibility tree, everything it does not ignore)"""
    cdp = pg.context.new_cdp_session(pg)
    cdp.send("Accessibility.enable")
    nodes = cdp.send("Accessibility.getFullAXTree")["nodes"]
    cdp.detach()
    return [(n.get("name") or {}).get("value", "") for n in nodes
            if not n.get("ignored")
            and (n.get("role") or {}).get("value") == "button"]


def test_versions_keeps_the_page_from_a_screen_reader(two):
    """aria-modal is not honoured on a dialog shown with show(): the page
    behind was the screen reader's to wander, as it was not behind the
    modal (review, 2026-10-10)"""
    ctx, pg, errors = _page(two)
    before = _ax_buttons(pg)
    assert "Find" in before
    pg.evaluate("(()=>{const b=document.querySelector('.nbshell:not([hidden])"
                " .card .cell-history-btn');b.scrollIntoView({block:'center'});"
                "b.focus();})()")
    pg.keyboard.press("Enter")
    pg.wait_for_selector("dialog.cell-history[open]")
    open_ = _ax_buttons(pg)
    assert "Close" in open_ and "Find" not in open_
    assert len(open_) < 10
    pg.keyboard.press("Escape")
    pg.wait_for_timeout(300)
    assert sorted(_ax_buttons(pg)) == sorted(before)
    ctx.close()
    assert not errors, errors


def test_versions_is_seen_over_a_full_screen_presentation(two):
    ctx, pg, errors = _page(two)
    pg.click("#doc-present")
    pg.wait_for_timeout(500)
    if not pg.evaluate("!!document.fullscreenElement"):
        ctx.close()
        pytest.skip("no full screen in this browser")
    pg.evaluate("document.querySelector('.nbshell:not([hidden]) .card "
                ".cell-history-btn').scrollIntoView({block:'center'})")
    pg.wait_for_timeout(200)
    pg.locator(".nbshell:not([hidden]) .card .cell-history-btn").first.click()
    pg.wait_for_selector("dialog.cell-history[open]")
    seen = pg.evaluate(
        "(()=>{const d=document.querySelector('dialog.cell-history');"
        "const r=d.getBoundingClientRect();const e=document.elementFromPoint("
        "r.x+r.width/2,r.y+30);return [d.contains(e),"
        "d.contains(document.activeElement)]})()")
    assert seen == [True, True]
    pg.keyboard.press("Escape")
    ctx.close()
    assert not errors, errors

def test_a_tab_switch_moves_the_highlight_on_the_same_tabs(two):
    ctx, pg, errors = _page(two)
    s1, s2 = two["stem"], two["stem2"]
    pg.evaluate("[...document.querySelectorAll('#top-tabstrip .tab,"
                "#tabstrip .tab')].forEach(t=>t.__kept=1)")
    pg.evaluate(f"window.SemApp.activate('{s2}')")
    st = pg.evaluate("[...document.querySelectorAll('#top-tabstrip .tab')]"
                     ".map(t=>[!!t.__kept,t.classList.contains('current'),"
                     "t.textContent.trim()])")
    assert all(k for k, _, _ in st)
    assert [c for _, c, _ in st] == [False, True]
    pg.evaluate(f"window.SemApp.activate('{s1}')")
    st = pg.evaluate("[...document.querySelectorAll('#tabstrip .tab')]"
                     ".map(t=>[!!t.__kept,t.classList.contains('current')])")
    assert st == [[True, True], [True, False]]
    # a notebook closed: the tabs are drawn again, without it
    pg.evaluate(f"window.SemApp.closeNotebook('{s2}')")
    pg.wait_for_timeout(500)
    st = pg.evaluate("[...document.querySelectorAll('#top-tabstrip .tab')]"
                     ".map(t=>[!!t.__kept,t.textContent.trim()])")
    assert len(st) == 1 and not st[0][0]
    ctx.close()
    assert not errors, errors


def test_sizes_reach_a_notebook_when_it_is_shown(two):
    ctx, pg, errors = _page(two)
    s1, s2 = two["stem"], two["stem2"]
    pg.evaluate(f"window.SemApp.activate('{s2}')")
    pg.evaluate(f"window.SemApp.activate('{s1}')")
    pg.evaluate("window.SemApp.setFigAll(1.3);window.SemApp.setMdAll(1.2)")
    look = ("(stem)=>{const el=window.SemApp.shells[stem].el;return ["
            "el.style.getPropertyValue('--fzall'),"
            "el.style.getPropertyValue('--mdscale'),"
            "[...el.querySelectorAll('.card.has-fig')].every(c=>"
            "c.classList.contains('zoomed'))]}")
    assert pg.evaluate(look, s1) == ["1.3", "1.2", True]
    pg.evaluate(f"window.SemApp.activate('{s2}')")
    assert pg.evaluate(look, s2) == ["1.3", "1.2", True]
    pg.evaluate("window.SemApp.setFigAll(1);window.SemApp.setMdAll(1)")
    pg.evaluate(f"window.SemApp.activate('{s1}')")
    got = pg.evaluate(look, s1)
    assert got[:2] == ["", ""] and pg.evaluate(
        "(stem)=>[...window.SemApp.shells[stem].el.querySelectorAll("
        "'.card.has-fig')].every(c=>!c.classList.contains('zoomed'))", s1)
    ctx.close()
    assert not errors, errors


def test_the_layout_is_kept_when_the_page_goes(two):
    ctx, pg, errors = _page(two)
    key = pg.evaluate("(()=>{const A=window.SemApp;return 'junoview:layout:'"
                      "+A.shells[A.active].path})()")
    pg.evaluate("document.querySelector('#tv-plots').click()")
    pg.evaluate("document.querySelector('#tv-plots').click()")
    # leaving at once: the save still waiting goes now
    pg.evaluate("window.dispatchEvent(new Event('pagehide'))")
    saved = pg.evaluate("k=>JSON.parse(localStorage.getItem(k)||'null')", key)
    assert saved and saved["def"]["plot"] == "hidden"
    # ...and without leaving, it is saved once the page is idle
    pg.evaluate("document.querySelector('#tv-plots').click()")
    pg.wait_for_timeout(1800)
    saved = pg.evaluate("k=>JSON.parse(localStorage.getItem(k)||'null')", key)
    assert saved["def"]["plot"] == "visible"
    ctx.close()
    assert not errors, errors


def test_a_scroll_lays_a_sheet_over_the_feed_until_the_mouse_moves(two):
    ctx, pg, errors = _page(two)
    on = "!!document.querySelector('.jv-scrollshield.on')"
    pg.mouse.move(683, 400)
    pg.evaluate("window.__on=0;addEventListener('scroll',()=>{window.__on="
                "window.__on||(!!document.querySelector('.jv-scrollshield.on')"
                "?1:0)},{passive:true})")
    pg.mouse.wheel(0, 500)
    pg.wait_for_function("window.__on===1", timeout=3000)
    pg.wait_for_timeout(500)
    assert not pg.evaluate(on)
    pg.mouse.wheel(0, 300)
    pg.wait_for_function(on, timeout=3000)
    pg.mouse.move(690, 410)
    assert not pg.evaluate(on)
    # a click aimed straight after a scroll lands on what is under it
    pt = pg.evaluate(
        "(()=>{const b=[...document.querySelectorAll('.nbshell:not([hidden]) "
        ".content .codetoggle')].find(b=>{const r=b.getBoundingClientRect();"
        "return r.top>200&&r.bottom<innerHeight-60});"
        "if(!b) return null;window.__aim=b;const r=b.getBoundingClientRect();"
        "return [r.x+r.width/2,r.y+r.height/2]})()")
    assert pt
    before = pg.evaluate("window.__aim.getAttribute('aria-expanded')")
    pg.evaluate("window.scrollBy(0,1)")
    pg.wait_for_function(on, timeout=3000)
    pt = pg.evaluate("(()=>{const r=window.__aim.getBoundingClientRect();"
                     "return [r.x+r.width/2,r.y+r.height/2]})()")
    pg.mouse.move(pt[0], pt[1])
    pg.mouse.click(pt[0], pt[1])
    mid = pg.evaluate("window.__aim.getAttribute('aria-expanded')")
    assert mid != before
    # ...and one made WITHOUT moving, the instant a scroll ends, too: the
    # press lands on the sheet, which hands the click to what is under it
    # (the page keeps scrolling by a pixel so the sheet stays while the
    # press arrives; the pointer is already over the toggle)
    pg.evaluate("window.__tick=setInterval(()=>{window.scrollBy(0,"
                "window.__dir=-(window.__dir||1));},30)")
    pg.wait_for_function(on, timeout=3000)
    pg.evaluate("(()=>{const r=window.__aim.getBoundingClientRect();"
                "window.__under=document.elementFromPoint(r.x+r.width/2,"
                "r.y+r.height/2).className})()")
    pg.mouse.down()
    pg.mouse.up()
    pg.evaluate("clearInterval(window.__tick)")
    assert pg.evaluate("window.__under") == "jv-scrollshield on"
    assert pg.evaluate("window.__aim.getAttribute('aria-expanded')") == before
    ctx.close()
    assert not errors, errors


def test_a_change_is_kept_when_its_tab_closes_at_once(two):
    """the save waits for the page to be idle: a notebook closed inside
    that wait is saved as it goes (review, 2026-10-10)"""
    ctx, pg, errors = _page(two)
    s2 = two["stem2"]
    pg.evaluate(f"window.SemApp.activate('{s2}')")
    key = pg.evaluate("(()=>{const A=window.SemApp;return 'junoview:layout:'"
                      "+A.shells[A.active].path})()")
    pg.evaluate("document.querySelector('#tv-plots').click()")
    pg.evaluate("document.querySelector('#tv-plots').click()")
    pg.evaluate(f"window.SemApp.closeNotebook('{s2}')")
    saved = pg.evaluate("k=>JSON.parse(localStorage.getItem(k)||'null')", key)
    assert saved and saved["def"]["plot"] == "hidden"
    ctx.close()
    assert not errors, errors

def test_the_raw_view_mirrors_every_output_and_lays_out_lazily(two):
    ctx, pg, errors = _page(two)
    pg.evaluate("document.getElementById('view-raw').click()")
    pg.wait_for_timeout(500)
    st = pg.evaluate(
        "(()=>{const rv=document.querySelector('.nbshell:not([hidden]) "
        ".rawview');return {ph:rv.querySelectorAll('.rawph').length,"
        "filled:rv.querySelectorAll('.rawph[data-filled]').length,"
        "missing:rv.querySelectorAll('.rawph-missing').length,"
        "withOut:[...rv.querySelectorAll('.rawph')].filter(p=>p.children"
        ".length).length,cv:getComputedStyle(rv.querySelector('.rawcell'))"
        ".contentVisibility}})()")
    assert st["ph"] > 0 and st["filled"] == st["ph"] == st["withOut"]
    assert st["missing"] == 0 and st["cv"] == "auto"
    ctx.close()
    assert not errors, errors


def test_the_tree_routes_its_edges_once_settled(two):
    ctx, pg, errors = _page(two)
    pg.evaluate("window.SemView.tree()")
    pg.wait_for_timeout(1200)
    st = pg.evaluate(
        "(()=>{const h=document.querySelector('.nbshell:not([hidden]) "
        ".treeview');const want=[...h.querySelectorAll('.tree-node')].reduce("
        "(n,el)=>n+(el.dataset.parents||'').split(',').filter(Boolean)"
        ".length,0);return [h.querySelectorAll('.tree-edge').length,want]})()")
    assert st[0] == st[1] and st[0] > 0
    ctx.close()
    assert not errors, errors


def _sheet_on(pg):
    """keep the window scrolling by a pixel, so the sheet is up when a
    press arrives (the pointer already where the press is aimed); it
    goes a pixel and back, so what is aimed at stays under the pointer"""
    pg.evaluate("(()=>{const y=scrollY,d=y>0?-1:1;let k=0;"
                "window.__tick=setInterval(()=>{k^=1;"
                "window.scrollTo(0,y+k*d);},30);})()")
    pg.wait_for_function("!!document.querySelector('.jv-scrollshield.on')",
                         timeout=3000)
    # the page may have settled under the pointer meanwhile: aim again
    # (a real move lifts the sheet; the next scroll lays it back)
    pt = pg.evaluate("(()=>{const r=window.__aimed.getBoundingClientRect();"
                     "return [r.x+Math.min(r.width,40)/2,r.y+r.height/2]})()")
    pg.mouse.move(pt[0], pt[1])
    pg.wait_for_function("!!document.querySelector('.jv-scrollshield.on')",
                         timeout=3000)
    return pt


def _aim(pg, js):
    """scroll what `js` finds to the middle and put the pointer on it
    (again until it stays there: the page may still be settling)"""
    pg.evaluate("window.__aimed=" + js)
    last = None
    for _ in range(20):
        pt = pg.evaluate("(()=>{const t=window.__aimed;"
                         "t.scrollIntoView({block:'center'});"
                         "const r=t.getBoundingClientRect();"
                         "return [r.x+Math.min(r.width,40)/2,"
                         "r.y+r.height/2]})()")
        if pt == last:
            break
        last = pt
        pg.wait_for_timeout(150)
    pg.mouse.move(pt[0], pt[1])
    return pt


def test_a_press_on_the_sheet_is_the_press_the_browser_would_send(two):
    ctx, pg, errors = _page(two)
    # an ICON: half of every button's face, and all of an eye's -- an SVG
    # element, which has no click() to hand the press to
    _aim(pg, "document.querySelector('.nbshell:not([hidden]) .card "
         ".cell-history-btn svg')")
    _sheet_on(pg)
    pg.mouse.down()
    pg.mouse.up()
    pg.evaluate("clearInterval(window.__tick)")
    pg.wait_for_selector("dialog.cell-history[open]", timeout=3000)
    pg.keyboard.press("Escape")
    pg.wait_for_timeout(300)
    # a press DRAGGED off a heading is a selection begun, not a click on
    # the heading: the section must not fold
    pt = _aim(pg, "(window.__sec=[...document.querySelectorAll("
              "'.nbshell:not([hidden]) .content .section')].find(s=>"
              "s.querySelector('.sectionhead-txt')&&s.querySelector('.card'))"
              ").querySelector('.sectionhead-txt')")
    pt = _sheet_on(pg)
    pg.mouse.down()
    pg.evaluate("clearInterval(window.__tick)")
    pg.mouse.move(pt[0], pt[1] + 140, steps=6)
    pg.mouse.up()
    pg.wait_for_timeout(200)
    assert not pg.evaluate("window.__sec.classList.contains('sec-collapsed')")
    # a Ctrl+click on a link opens it beside the app, never in its place
    pg.evaluate("(()=>{const a=document.createElement('a');a.id='tlink';"
                "a.href='/nowhere';a.textContent='a link to elsewhere';"
                "const ps=[...document.querySelectorAll('.nbshell:not([hidden]) "
                ".content .card p')].filter(p=>p.textContent.length>120"
                "&&!p.querySelector('a'));ps[ps.length>>1].prepend(a);})()")
    _aim(pg, "document.getElementById('tlink')")
    _sheet_on(pg)
    pg.evaluate("clearInterval(window.__tick)")
    with ctx.expect_page() as other:
        pg.keyboard.down("Control")
        pg.mouse.down()
        pg.mouse.up()
        pg.keyboard.up("Control")
    other.value.close()
    assert pg.evaluate("!!window.SemApp&&!!document.getElementById('tlink')")
    ctx.close()
    assert not errors, errors


def test_a_drag_begun_on_the_sheet_selects_the_text_it_crosses(two):
    ctx, pg, errors = _page(two)
    pt = _aim(pg, "[...document.querySelectorAll('.nbshell:not([hidden]) "
              ".content .card p')].find(p=>p.textContent.length>120"
              "&&!p.querySelector('a'))")
    pt = _sheet_on(pg)
    pg.mouse.down()
    pg.evaluate("clearInterval(window.__tick)")
    pg.mouse.move(pt[0] + 200, pt[1], steps=6)
    pg.mouse.up()
    assert len(pg.evaluate("String(getSelection())").strip()) > 5
    ctx.close()
    assert not errors, errors


# ------------------------------------------- six reader bugs, 2026-10-10


def _one(browser, tmp_path, nb: dict, name: str):
    f = tmp_path / f"{name}.ipynb"
    f.write_text(json.dumps(nb), encoding="utf-8")
    (tmp_path / _PROJECT_FILE).write_text(json.dumps(
        {"presentations": [], "open": [str(f)], "recent": [str(f)]},
        indent=1) + "\n", encoding="utf-8")
    return _serve(tmp_path)


def _md(i, s):
    return {"cell_type": "markdown", "id": f"m{i}", "metadata": {},
            "source": s}


LONG_NOTE = "\n\n".join(
    f"Paragraph {k} of a long note that goes on about the method."
    for k in range(40)) + "\n\nThe word zebrafinch is only here, at the end."


@pytest.fixture
def longnote(browser, tmp_path):
    """a long note a few screens down: not measured until it nears them"""
    cells = [_md(0, "# Report")]
    cells += [_md(k, f"Filler note {k}. " * 40) for k in range(1, 9)]
    cells += [_md(30, "## Method"), _md(31, LONG_NOTE),
              {"cell_type": "code", "id": "c0", "metadata": {},
               "source": "#| id: fit\nfit()", "outputs": []}]
    srv, url = _one(browser, tmp_path, {"cells": cells}, "longnote")
    try:
        yield {"b": browser, "url": url}
    finally:
        srv.shutdown()
        srv.server_close()


def _plotly_out(n):
    return {"output_type": "display_data", "metadata": {},
            "data": {"application/vnd.plotly.v1+json": {
                "data": [{"y": [1, 3, 2], "type": "scatter"}],
                "layout": {"title": {"text": f"Plot {n}"}}},
                "text/plain": "<Figure>"}}


@pytest.fixture
def plots(browser, tmp_path):
    cells = [_md(0, "# Plots"), _md(1, "## First"),
             _md(2, "Some words. " * 40), _md(3, "## Second")]
    for n in (1, 2):
        cells.append({"cell_type": "code", "id": f"p{n}", "metadata": {},
                      "execution_count": n,
                      "source": f"#| display: figure\n#| id: p{n}\nfig",
                      "outputs": [_plotly_out(n)]})
    cells.append(_md(9, "## Third"))
    srv, url = _one(browser, tmp_path, {"cells": cells}, "plots")
    try:
        yield {"b": browser, "url": url}
    finally:
        srv.shutdown()
        srv.server_close()


def _find(pg, term):
    pg.keyboard.press("Control+f")
    pg.keyboard.type(term)
    pg.wait_for_function("/\\//.test((document.getElementById('docfind-n')"
                         "||{}).textContent||'')", timeout=10000)


def test_the_ribbons_expand_all_opens_every_tree_node(two):
    """it threw "fillNode is not defined" and left one node open, empty"""
    ctx, pg, errors = _page(two)
    pg.evaluate("window.SemView.tree()")
    pg.wait_for_timeout(500)
    pg.evaluate("document.getElementById('tree-expand').click()")
    pg.wait_for_function(
        "(()=>{const n=[...document.querySelectorAll('.nbshell:not([hidden])"
        " .treeview .tree-node:not(.tn-off)')];return n.length>3&&n.every("
        "e=>e.classList.contains('expanded')&&e.querySelector("
        "'.tree-node-body[data-filled] .card'))})()", timeout=10000)
    # Expand all shows the code
    assert pg.evaluate("document.querySelectorAll('.nbshell:not([hidden]) "
                       ".treeview .codewrap[data-open=\"1\"]').length") > 0
    ctx.close()
    assert not errors, errors


FOUND = r"""
()=>{const ms=[...document.querySelectorAll('mark.jv-doc')];
 const on=document.querySelector('mark.jv-doc.on');
 return {raw:ms.filter(m=>m.closest('.rawview')).length,
  feed:ms.filter(m=>m.closest('.content')).length,
  shown:!!(on&&on.getClientRects().length),
  n:document.getElementById('docfind-n').textContent};}
"""


def test_find_searches_what_is_on_screen_raw_or_formatted(two):
    ctx, pg, errors = _page(two)
    pg.evaluate("document.getElementById('view-raw').click()")
    pg.wait_for_timeout(500)
    _find(pg, "anomaly")
    st = pg.evaluate(FOUND)
    assert st["raw"] > 0 and st["feed"] == 0 and st["shown"]
    assert st["n"] == f"1 / {st['raw']}"
    # Raw turned off with the bar open: the document is searched again
    pg.evaluate("document.getElementById('view-raw').click()")
    pg.wait_for_function("document.querySelectorAll('.nbshell:not([hidden])"
                         " .content mark.jv-doc').length>0", timeout=10000)
    st = pg.evaluate(FOUND)
    # (not `shown`: the document's first match is in xarray's text
    # fallback, which its HTML repr hides -- as it always was)
    assert st["feed"] > 0 and st["raw"] == 0
    assert st["n"] == f"1 / {st['feed']}"
    ctx.close()
    assert not errors, errors


def test_find_leaves_the_raw_view_with_raw_whichever_way(two):
    """an outline link and the Tree button leave Raw too, not only its
    own button: Find then still counted and stepped through the hidden
    raw view's marks"""
    ctx, pg, errors = _page(two)
    for leave in ("document.querySelectorAll('.nbshell:not([hidden]) "
                  ".navitem')[3].click()",
                  "window.SemView.tree();window.SemView.tree()"):
        pg.evaluate("document.getElementById('view-raw').click()")
        pg.wait_for_timeout(500)
        if pg.evaluate("document.getElementById('docfind').hidden"):
            _find(pg, "anomaly")
        pg.wait_for_function("document.querySelectorAll('.nbshell:not("
                             "[hidden]) .rawview mark.jv-doc').length>0",
                             timeout=10000)
        pg.evaluate(leave)
        pg.wait_for_timeout(500)
        pg.evaluate("document.getElementById('docfind-next').click()")
        pg.wait_for_timeout(800)
        st = pg.evaluate(FOUND)
        assert st["raw"] == 0 and st["feed"] > 0 and st["shown"], (leave, st)
        assert st["n"] == f"2 / {st['feed']}", (leave, st)
    ctx.close()
    assert not errors, errors


DUPS = ("(()=>{const m={};document.querySelectorAll('[id]').forEach(e=>{"
        "m[e.id]=(m[e.id]||0)+1});return Object.keys(m).filter(k=>m[k]>1)"
        ".sort()})()")


def test_the_raw_views_copies_own_their_ids(two):
    ctx, pg, errors = _page(two)
    # the notebook's own (each xarray output carries the same sprite)
    before = pg.evaluate(DUPS)
    pg.evaluate("document.getElementById('view-raw').click()")
    pg.wait_for_timeout(500)
    assert pg.evaluate("document.querySelectorAll('.nbshell:not([hidden]) "
                       ".rawview .rawph[data-filled] [id]').length") > 0
    assert pg.evaluate(DUPS) == before
    # a label in the raw view works its own checkbox, not the hidden card's
    got = pg.evaluate(
        "(()=>{const rv=document.querySelector('.nbshell:not([hidden]) "
        ".rawview');const l=[...rv.querySelectorAll('.rawph label[for]')]"
        ".find(l=>{const i=document.getElementById(l.htmlFor);"
        "return i&&!i.disabled});const own=document.getElementById(l.htmlFor);"
        "const feed=[...document.querySelectorAll('.nbshell:not([hidden]) "
        ".content input[id]')].find(i=>own.id.startsWith(i.id+'--raw-'));"
        "const b=[own.checked,feed.checked];l.click();"
        "return {inRaw:!!own.closest('.rawview'),own:[b[0],own.checked],"
        "feed:[b[1],feed.checked]}})()")
    assert got["inRaw"]
    assert got["own"][0] != got["own"][1]
    assert got["feed"][0] == got["feed"][1]
    ctx.close()
    assert not errors, errors


NOTE = r"""
()=>{const m=document.querySelector('mark.jv-doc.on')
   ||document.querySelector('mark.jv-doc');
 const bd=document.querySelector('.content .card[data-note="1"] > '
   +'.cardbody.mdclamp');
 const more=bd&&bd.parentNode.querySelector(':scope > .mdmore');
 const r=m&&m.getBoundingClientRect(),b=bd&&bd.getBoundingClientRect();
 const e=r&&document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);
 return {open:!!bd&&bd.classList.contains('mdopen'),
  more:more?more.textContent:null,
  inside:!!(r&&b&&r.top>=b.top&&r.bottom<=b.bottom),
  seen:!!(e&&(e===m||m.contains(e))),inner:bd?bd.scrollTop:-1};}
"""


def test_find_opens_a_long_note_to_show_a_match_inside_it(longnote):
    ctx, pg, errors = _page(longnote)
    # not measured yet: held at the clamp's height, clipped
    assert pg.evaluate("[...document.querySelectorAll('.content "
                       ".card[data-note=\"1\"] > .cardbody')].pop()"
                       ".dataset.mdclamp") is None
    _find(pg, "zebrafinch")
    pg.wait_for_timeout(1500)          # the smooth scroll to it
    assert pg.evaluate(NOTE) == {"open": True, "more": "Show less",
                                 "inside": True, "seen": True, "inner": 0}
    # closing Find puts it back as it was: clamped
    pg.keyboard.press("Escape")
    pg.wait_for_timeout(200)
    st = pg.evaluate(NOTE)
    assert not st["open"] and st["more"] == "Show more"
    ctx.close()
    assert not errors, errors


@pytest.fixture
def longread(browser, tmp_path):
    """the long note, with more of the notebook after it to slide up"""
    cells = [_md(0, "# Report")]
    cells += [_md(k, f"Filler note {k}. " * 40) for k in range(1, 9)]
    cells += [_md(30, "## Method"), _md(31, LONG_NOTE)]
    cells += [_md(40 + k, f"After note {k}. " * 30) for k in range(6)]
    srv, url = _one(browser, tmp_path, {"cells": cells}, "longread")
    try:
        yield {"b": browser, "url": url}
    finally:
        srv.shutdown()
        srv.server_close()


def test_closing_find_leaves_the_reader_at_the_note_it_folds(longread):
    """the note Find opened folds again when the bar closes -- and took
    the page below it up with it: the reader, who was reading the match
    in it, was left at whatever slid up (the end of the notebook here)"""
    ctx, pg, errors = _page(longread)
    _find(pg, "zebrafinch")
    pg.wait_for_timeout(1500)
    assert pg.evaluate(NOTE)["open"]
    pg.keyboard.press("Escape")
    pg.wait_for_timeout(300)
    st = pg.evaluate(
        "(()=>{const bd=[...document.querySelectorAll('.content .card"
        "[data-note=\"1\"] > .cardbody.mdclamp')].pop();const b=bd.parentNode"
        ".querySelector(':scope > .mdmore').getBoundingClientRect();"
        "return {open:bd.classList.contains('mdopen'),top:b.top,"
        "bottom:b.bottom,h:innerHeight}})()")
    assert not st["open"]
    assert 0 < st["top"] and st["bottom"] < st["h"], st
    ctx.close()
    assert not errors, errors


ON_TOP = r"""
()=>{const c=[...document.querySelectorAll('.nbshell:not([hidden]) .content '
   +'.card[data-anchor]')].find(c=>c.getBoundingClientRect().bottom>140);
 return {anchor:c.dataset.anchor,top:Math.round(c.getBoundingClientRect().top)};}
"""


def test_reload_keeps_the_card_being_read_where_it_was(two):
    ctx, pg, errors = _page(two)
    path = Path(pg.evaluate("window.SemApp.shells[window.SemApp.active].path"))
    h = pg.evaluate("document.documentElement.scrollHeight")
    pg.mouse.move(683, 400)
    while pg.evaluate("scrollY") < h * 0.35:
        pg.mouse.wheel(0, 600)
        pg.wait_for_timeout(60)
    pg.wait_for_timeout(800)
    at = pg.evaluate(ON_TOP)
    # the notebook changes on disk; Reload
    nb = json.loads(path.read_text(encoding="utf-8"))
    md = next(c for c in nb["cells"] if c["cell_type"] == "markdown")
    src = md["source"]
    md["source"] = (src if isinstance(src, str) else "".join(src)) + " (ed)"
    path.write_text(json.dumps(nb), encoding="utf-8")
    pg.evaluate("document.querySelector('.nbshell:not([hidden])').__old=1")
    pg.evaluate("document.querySelector('#file-dock .rf-reload').click()")
    pg.wait_for_function("(()=>{const s=document.querySelector("
                         "'.nbshell:not([hidden])');return !!(s&&!s.__old"
                         "&&s.querySelector('.card'))})()", timeout=20000)
    pg.wait_for_timeout(1500)
    now = pg.evaluate(
        "(a)=>Math.round(document.querySelector('.nbshell:not([hidden]) "
        ".content .card[data-anchor=\"'+a+'\"]').getBoundingClientRect().top)",
        at["anchor"])
    assert abs(now - at["top"]) <= 2, (at, now)
    ctx.close()
    assert not errors, errors


# plotly.js stand-in: draws nothing, notes the width it was given
PLOTLY_STUB = (
    b"window.Plotly={newPlot:function(gd){gd.__drawnW="
    b"gd.getBoundingClientRect().width;var d=document.createElement('div');"
    b"d.className='js-plotly-plot';d.style.height='200px';gd.appendChild(d);"
    b"return Promise.resolve(gd);},Plots:{resize:function(){}},"
    b"purge:function(){}};")


def test_a_figure_in_a_section_left_closed_is_drawn_at_its_width(plots):
    ctx, pg, errors = _page(plots, plotly=PLOTLY_STUB)
    pg.wait_for_function("!!window.Plotly", timeout=10000)
    sid = pg.evaluate("document.querySelector('.nbshell:not([hidden]) "
                      ".content .plotly-embed').closest('.section')"
                      ".dataset.sec")
    chev = f'.nbshell:not([hidden]) .sec-chev[data-sec="{sid}"]'
    # close its section and the notebook; open it again: the layout it was
    # left in comes back, and its figures are queued into a closed section
    pg.evaluate(f"document.querySelector('{chev}').click()")
    path = pg.evaluate("window.SemApp.shells[window.SemApp.active].path")
    pg.evaluate("window.SemApp.closeNotebook(window.SemApp.active)")
    pg.wait_for_timeout(300)
    pg.evaluate("p=>window.SemApp.openPath(p)", path)
    pg.wait_for_selector(f'.nbshell:not([hidden]) .section[data-sec="{sid}"]'
                         '.sec-collapsed')
    pg.wait_for_timeout(800)
    pg.evaluate(f"document.querySelector('{chev}').click()")
    pg.evaluate("document.querySelector('.nbshell:not([hidden]) .content "
                ".plotly-embed').scrollIntoView({block:'center'})")
    pg.wait_for_function("[...document.querySelectorAll('.nbshell:not("
                         "[hidden]) .content .plotly-embed')].every(d=>"
                         "d.__drawnW!==undefined)", timeout=5000)
    got = pg.evaluate("[...document.querySelectorAll('.nbshell:not([hidden])"
                      " .content .plotly-embed')].map(d=>[Math.round("
                      "d.__drawnW),Math.round(d.getBoundingClientRect()"
                      ".width)])")
    assert len(got) == 2
    assert all(w == box and w > 0 for w, box in got), got
    ctx.close()
    assert not errors, errors
