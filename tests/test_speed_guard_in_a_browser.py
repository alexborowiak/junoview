"""THE SPEED GUARD: the gestures people make all day, timed at 4x CPU
against a budget (opt-in, Chromium).

The speed work of 2026-10-09/10 made the editor's gestures 5-10x quicker
than they had become, and loading about twice as quick. They had become
slow quietly, one feature at a time, until the owner called the app
"really laggy AGAIN" -- the second time. Nothing in the suite noticed,
because nothing in the suite timed anything. This does.

It drives the real app server in Chromium at 4x CPU throttle (roughly a
mid laptop on battery), loads the example notebook, opens a 60-slide
deck through ``window.SemDeckImport`` and times:

  load          tti (the end of the last long task, from navigation
                start) and the longest single task
  open_deck     the import, until the editor has settled: the page's
                first deck, so the editor boots too (one run)
  select        a click on a figure
  deselect      Escape
  slide_change  PageDown in the editor
  undo          Ctrl+Z of a nudge
  add_slide     Ctrl+M
  ribbon_tab    a click on another ribbon tab
  to_deck       the deck's tab, from the notebook's
  start_show    the Play button

Per gesture it takes the median of three runs of two numbers:

  inp   the slowest input event's Event Timing duration -- input to the
        next paint after its handlers, what the person waits for (INP;
        8 ms granularity, nothing under 16 ms is reported, so 0 = fast)
  busy  main-thread long-task time from the gesture until the page has
        been quiet for SETTLE ms: the work it left behind, which the NEXT
        input waits on -- a debounced job (the draft write, a nudge
        settling) included

Each has a budget about twice its median on the machine the budgets were
set on (BUDGETS), so ordinary noise passes and a change that brings back
the old costs does not: the code from before the speed work fails every
one of them. A gesture over budget is measured three more times, in a
fresh page as the first were, before it fails, and the better median
counts -- a real regression is slow both times, a neighbour's CPU spike
is not. And the slide strip must come
through the gestures with its rows: a strip rebuilt wholesale is the
biggest of the old costs, and it fails here by name.

Set ``JUNOVIEW_BROWSER_TESTS=1`` to run it; it needs the Python
``playwright`` package and its Chromium, and skips cleanly without them.
CONTRIBUTING.md ("The speed guard") says what to do when it fails, and
how to re-set the budgets when a slower gesture is the price of a
feature. Knobs, all optional:

  JUNOVIEW_SPEED_REPORT=path    write every number measured, as JSON
  JUNOVIEW_SPEED_SCALE=1.5      multiply every budget (a slower machine;
                                never to make a failure go away)
  JUNOVIEW_MATHJAX_DIR=dir      serve this unpacked mathjax@3.2.2 es5/
                                directory for the pinned CDN address, and
                                time the real typesetter (by default a
                                stand-in answers: the test never touches
                                the network, so a slow CDN cannot fail it)
"""

from __future__ import annotations

import json
import os
import re
import shutil
import statistics
import threading
import urllib.request
from functools import partial
from http.server import ThreadingHTTPServer
from pathlib import Path

import pytest

from junoview.server.routes import _make_handler
from junoview.server.state import _PROJECT_FILE, _AppState

ROOT = Path(__file__).resolve().parent.parent
NB = ROOT / "examples" / "example_climate_analysis.ipynb"
THROTTLE = 4
SLIDES = 60
REPS = 3
# the slide the object gestures run on: a figure, a heading, a list, a
# shape and an arrow (deck() below), so a click there is a real one
WORK_SLIDE = 6

# ms. About 2x the median of thirteen full runs on the machine they were
# set on (2026-10-10, at 3ae56ef: a shared 4-core Linux container under
# other agents' work, headless Chromium, CPU throttled 4x, MathJax the
# stand-in), with that median beside each -- and never less than the
# median + 120 ms, because busy counts whole long tasks and one stray
# 50-100 ms task is not a regression. Four are tighter, because their
# speed work bought about 2x or less and a 2x budget would let all of it
# be undone: load tti and opening the deck (1.5x), the longest task and
# the ribbon tab (1.75x). The code from before the speed work (8406bd8),
# measured here the same way in four runs: load 3731-4291/750-904,
# opening the deck 3700-5487, select 392-440/380-485, deselect 424-560/
# 357-549, slide change 920-1288/1006-1747, undo 896-1192/1142-1598, add
# slide 992-1288/1114-1616, ribbon tab 360-456/343-443, notebook to deck
# 1848-2320/2433-3087, start show 1560-2224/2061-2996, strip rows kept 0
# of 60. Every one of those gestures fails here.
BUDGETS: dict[str, dict[str, int]] = {
    "load": {"tti": 3100, "longest_task": 600},       # 2048, 342
    "open_deck": {"busy": 2790},                      # 1856 (one run)
    "select": {"inp": 400, "busy": 320},              # 200, 159
    "deselect": {"inp": 370, "busy": 300},            # 184, 150
    "slide_change": {"inp": 290, "busy": 210},        # 144, 90
    "undo": {"inp": 500, "busy": 400},                # 248, 198
    "add_slide": {"inp": 390, "busy": 300},           # 192, 146
    "ribbon_tab": {"inp": 380, "busy": 300},          # 216, 167
    "to_deck": {"inp": 1270, "busy": 1220},           # 632, 608
    "start_show": {"inp": 640, "busy": 950},          # 320, 471
}
# with the real MathJax (JUNOVIEW_MATHJAX_DIR) loading also costs its
# evaluation and the first screen's typesetting; the gestures are the
# same. The median of three runs beside.
BUDGETS_REAL_MATHJAX: dict[str, dict[str, int]] = {
    "load": {"tti": 6250, "longest_task": 1090},      # 4165, 621
}

# ---- in the page ------------------------------------------------------

# from the first byte: every input's Event Timing entry, every long task,
# and a wait for quiet -- `q` ms with no long task (counted from the call
# at the earliest, so work queued just before it is waited for), judged
# by the
# longtask entries AND by a timer that came back late (an entry can be
# delivered after the task that would have told us)
OBSERVE = r"""
(()=>{if(window.__jv) return;
 window.__jv={ev:[],lt:[]};
 try{new PerformanceObserver(function(l){l.getEntries().forEach(function(e){
   window.__jv.ev.push([e.name,e.startTime,e.duration]);});})
   .observe({type:'event',durationThreshold:16,buffered:true});}catch(e){}
 try{new PerformanceObserver(function(l){l.getEntries().forEach(function(e){
   window.__jv.lt.push([e.startTime,e.duration]);});})
   .observe({type:'longtask',buffered:true});}catch(e){}
 window.__jvQuiet=function(q,cap){return new Promise(function(res){
   var t0=performance.now(),prev=t0,late=t0;
   function ltEnd(){var l=window.__jv.lt,e=l[l.length-1];
     return e?e[0]+e[1]:0;}
   (function tick(){
     var now=performance.now();
     if(now-prev>75) late=now;
     prev=now;
     var busy=Math.max(late,ltEnd());
     if(now-busy>=q) return res(true);
     if(now-t0>=cap) return res(false);
     setTimeout(tick,25);
   })();
 });};
})();
"""

# Enough of MathJax for jvMath: it loads, starts, and typesets nothing.
FAKE_MATHJAX = (
    "window.MathJax={startup:{promise:Promise.resolve(),"
    "document:{render:function(){}}},typeset:function(){},"
    "typesetPromise:function(){return Promise.resolve();},"
    "typesetClear:function(){}};")


def _need_browser():
    if os.environ.get("JUNOVIEW_BROWSER_TESTS") != "1":
        pytest.skip("set JUNOVIEW_BROWSER_TESTS=1 for the Chromium checks")
    try:
        from playwright.sync_api import sync_playwright  # noqa: F401
    except ImportError:
        pytest.skip("Playwright is not installed")


# ---- the app ----------------------------------------------------------

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
    shutil.copy(NB, nb)
    (tmp_path / _PROJECT_FILE).write_text(json.dumps(
        {"presentations": [], "open": [str(nb)], "recent": [str(nb)]}),
        encoding="utf-8")
    st = _AppState(tmp_path)
    srv = ThreadingHTTPServer(("127.0.0.1", 0), _make_handler(st))
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    url = f"http://127.0.0.1:{srv.server_address[1]}/?t={st.token}"
    # the server builds a page once and keeps it: build it now, so the
    # first timed load is not the only one that waits for the parse
    with urllib.request.urlopen(url, timeout=120) as r:
        r.read()
    try:
        yield {"b": browser, "url": url, "root": str(st.root),
               "stem": nb.stem}
    finally:
        srv.shutdown()
        srv.server_close()


def _offline(ctx):
    """Nothing leaves the machine: a slow CDN must not fail a speed test.
    MathJax is the real one only when JUNOVIEW_MATHJAX_DIR says where."""
    mj = os.environ.get("JUNOVIEW_MATHJAX_DIR")

    def mathjax(route):
        rel = route.request.url.split("/es5/", 1)[1].split("?")[0]
        if not mj:
            if rel.endswith(".js"):
                return route.fulfill(status=200, body=FAKE_MATHJAX,
                                     content_type="application/javascript")
            return route.fulfill(status=404, body="")
        path = Path(mj) / rel
        if not path.is_file():
            return route.fulfill(status=404, body="")
        route.fulfill(status=200, body=path.read_bytes(), headers={
            "content-type": ("application/javascript" if rel.endswith(".js")
                             else "font/woff"),
            "access-control-allow-origin": "*"})

    ctx.route(re.compile(r"^https?://(?!127\.0\.0\.1[:/])"),
              lambda route: route.fulfill(status=404, body=""))
    # (the later route is tried first)
    ctx.route("https://cdn.jsdelivr.net/npm/mathjax@3*/es5/**", mathjax)


def _context(app, scope_root=None):
    ctx = app["b"].new_context(viewport={"width": 1366, "height": 657})
    keys = {"plotline-tour": "1", "plotline-tour-editor": "1"}
    if scope_root:
        # the deck's first question ("where should this be kept?") is
        # answered, and autosave is off: a timer that lands where it likes
        # is noise in a speed test, and its cost is the save tests' to hold
        scope = "semopts:proj:" + scope_root
        keys[scope + ":savetarget"] = "browser"
        keys[scope + ":autosave"] = "0"
    ctx.add_init_script(
        "try{var k=" + json.dumps(keys) + ";for(var n in k)"
        "localStorage.setItem(n,k[n]);}catch(e){}")
    ctx.add_init_script(OBSERVE)
    _offline(ctx)
    pg = ctx.new_page()
    errs: list[str] = []
    pg.on("pageerror", lambda e: errs.append(str(e)))
    cdp = ctx.new_cdp_session(pg)
    cdp.send("Emulation.setCPUThrottlingRate", {"rate": THROTTLE})
    return ctx, pg, errs


def _quiet(pg, q=300, cap=15000):
    return pg.evaluate("([q,c])=>window.__jvQuiet(q,c)", [q, cap])


# ---- measuring ----------------------------------------------------------

# ms of quiet that end a gesture: longer than the debounces the app puts
# work behind (300 ms), so work a gesture defers is still its own --
# with 300, a 250 ms freeze one second after every slide change passed
SETTLE = 1000


def _gesture(pg, act, until, cap=20000):
    """One run of a gesture: act(), wait for `until` (a JS predicate that
    says it happened), then for quiet. Returns {inp, busy} in ms."""
    _quiet(pg, 200)
    t0 = pg.evaluate("(()=>{window.__jv.ev=[];window.__jv.lt=[];"
                     "return performance.now();})()")
    act()
    pg.wait_for_function(until, timeout=cap, polling=50)
    _quiet(pg, SETTLE)
    ev, lt = pg.evaluate("[window.__jv.ev,window.__jv.lt]")
    return {"inp": round(max([d for (_n, s, d) in ev if s >= t0 - 5] or [0])),
            "busy": round(sum(d for (s, d) in lt if s >= t0 - 5))}


def _median(runs: list[dict]) -> dict:
    return {k: round(statistics.median(r[k] for r in runs))
            for k in runs[0]}


def _load_once(app):
    """A fresh context, a cold page: tti and the longest task."""
    ctx, pg, errs = _context(app, app["root"])
    pg.goto(app["url"], wait_until="load", timeout=120000)
    pg.wait_for_selector(".nbshell .card", timeout=120000)
    _quiet(pg, 500, 30000)
    got = pg.evaluate(
        "(()=>{var n=performance.getEntriesByType('navigation')[0];"
        "var lt=window.__jv.lt,end=n.domContentLoadedEventEnd,top=0;"
        "lt.forEach(function(e){end=Math.max(end,e[0]+e[1]);"
        "top=Math.max(top,e[1]);});"
        "return {tti:Math.round(end),longest_task:Math.round(top)};})()")
    return ctx, pg, errs, got


def deck(stem: str, figs: list[str], n: int, name: str) -> dict:
    """n slides of what decks are made of: a heading, a figure on three
    in four, a list, and a shape and an arrow on every third"""
    slides = []
    for i in range(n):
        an: list[dict] = [{"k": "text", "x": 6, "y": 5, "w": 88,
                           "text": f"Slide {i + 1}: a heading that says "
                                   "something", "size": 4, "style": "h1"}]
        if figs and i % 4 != 3:
            an.append({"k": "cell", "x": 6, "y": 20, "w": 52, "h": 66,
                       "ref": f"{stem}::{figs[i % len(figs)]}"})
        an.append({"k": "text", "x": 62, "y": 22, "w": 32,
                   "text": "First point\nSecond point\nThird point",
                   "size": 2.2, "list": "bullet"})
        if i % 3 == 0:
            an.append({"k": "rect", "x": 62, "y": 70, "w": 30, "h": 14})
            an.append({"k": "arrow", "x1": 60, "y1": 50, "x2": 70,
                       "y2": 70})
        slides.append({"layout": "blank", "annots": an,
                       "notes": f"Speaker notes for slide {i + 1}."})
    return {"name": name, "slides": slides}


SLIDE = "(window.SemApp.deckState()||{}).slide"
SELECTED = "!!document.querySelector('#deck .annot-layer>.an-item.sel')"
ROWS = "document.querySelectorAll('#film-list .film-row').length"
EDITING = "document.body.classList.contains('slide-editing')"
RECT = "#deck .annot-layer>.an-item.an-rect"
FIGURE = "#deck .annot-layer>.an-item.an-cell"


def _center(pg, sel):
    box = pg.evaluate(
        "s=>{var e=[...document.querySelectorAll(s)].find(function(e){"
        "return e.getClientRects().length;});if(!e) return null;"
        "var r=e.getBoundingClientRect();"
        "return [r.x+r.width/2,r.y+r.height/2];}", sel)
    assert box, f"nothing to click: {sel}"
    return box


def _deselect(pg):
    # Escape with nothing selected leaves the editor, so only with
    if pg.evaluate(SELECTED):
        pg.keyboard.press("Escape")
        pg.wait_for_function("!" + SELECTED, polling=50)


# ---- the gestures: each returns REPS runs ----------------------------

def g_slide_change(pg):
    runs = []
    for _ in range(REPS):
        at = pg.evaluate(SLIDE)
        runs.append(_gesture(pg, lambda: pg.keyboard.press("PageDown"),
                             f"{SLIDE}==={at + 1}"))
    return runs


def _to_work_slide(pg):
    pg.evaluate(f"window.SemApp.deckGo({WORK_SLIDE})")
    pg.wait_for_function(f"{SLIDE}==={WORK_SLIDE}&&"
                         f"!!document.querySelector('{RECT}')", polling=50)
    _deselect(pg)


def g_select_deselect(pg):
    # a figure, the object decks are made of: selecting one brings its
    # own ribbon tools, and that fit is what the ribbon speed work
    # (e94dbc6) made cheap -- selecting the shape, a revert of it passed
    _to_work_slide(pg)
    sel, desel = [], []
    for _ in range(REPS):
        x, y = _center(pg, FIGURE)
        sel.append(_gesture(pg, partial(pg.mouse.click, x, y), SELECTED))
        desel.append(_gesture(pg, lambda: pg.keyboard.press("Escape"),
                              "!" + SELECTED))
    return sel, desel


def g_undo(pg):
    _to_work_slide(pg)
    place = f"document.querySelector('{RECT}').getAttribute('style')"
    runs = []
    for _ in range(REPS):
        x, y = _center(pg, RECT)
        pg.mouse.click(x, y)
        pg.wait_for_function(SELECTED, polling=50)
        before = pg.evaluate(place)
        pg.keyboard.press("ArrowRight")
        # the nudge's history entry lands with the key coming up
        pg.wait_for_function(f"p=>{place}!==p", arg=before, polling=50)
        _quiet(pg)
        runs.append(_gesture(pg, lambda: pg.keyboard.press("Control+z"),
                             f"{place}==={json.dumps(before)}"))
        _deselect(pg)
    return runs


def g_add_slide(pg):
    _deselect(pg)
    runs = []
    for _ in range(REPS):
        n = pg.evaluate(ROWS)
        runs.append(_gesture(pg, lambda: pg.keyboard.press("Control+m"),
                             f"{ROWS}==={n + 1}"))
        pg.keyboard.press("Control+z")       # the deck stays at SLIDES
        pg.wait_for_function(f"{ROWS}==={n}", polling=50)
    return runs


def g_ribbon_tab(pg):
    runs = []
    for tab in ("text", "design", "home"):
        sel = f"#rbn-tab-{tab}"
        runs.append(_gesture(
            pg, partial(pg.click, sel),
            f"document.querySelector('{sel}')"
            ".getAttribute('aria-selected')==='true'"))
    return runs


def g_to_deck(pg):
    nb_tab = "#top-tabstrip .tab:not(.top-pres-tab)"
    deck_tab = ".top-pres-tab .top-pres-main"
    runs = []
    for _ in range(REPS):
        x, y = _center(pg, nb_tab)
        pg.mouse.click(x, y)
        pg.wait_for_function("window.SemApp.deckState()===null", polling=50)
        _quiet(pg)
        x, y = _center(pg, deck_tab)
        runs.append(_gesture(pg, partial(pg.mouse.click, x, y), EDITING))
    return runs


def g_start_show(pg):
    showing = (f"!{EDITING}&&!!window.SemApp.deckState()")
    runs = []
    for _ in range(REPS):
        runs.append(_gesture(pg, lambda: pg.click("#dc-play"), showing))
        pg.keyboard.press("Escape")
        pg.wait_for_function(EDITING, polling=50)
    return runs


# ---- the test -----------------------------------------------------------

def _measure_loads(app, errs, keep_last=True):
    runs, kept = [], None
    for k in range(REPS):
        ctx, pg, page_errs, got = _load_once(app)
        runs.append(got)
        if keep_last and k == REPS - 1:
            kept = (ctx, pg, page_errs)
        else:
            ctx.close()
            errs.extend(page_errs)
    return runs, kept


def _open_deck(app, pg, name):
    figs = pg.evaluate(
        "[...document.querySelectorAll('.nbshell .card[data-anchor]')]"
        ".filter(function(c){return c.dataset.kind==='figure';})"
        ".map(function(c){return c.dataset.anchor;})")
    assert figs, "the example notebook has figures to put on slides"
    text = json.dumps(deck(app["stem"], figs, SLIDES, name))
    run = _gesture(pg, partial(
        pg.evaluate, "t=>{window.SemDeckImport(t,false);return 1}", text),
        f"{EDITING}&&(window.SemApp.deckState()||{{}}).name==="
        f"{json.dumps(name)}&&{ROWS}==={SLIDES}", cap=60000)
    # the keyboard to the deck: a click on the stage's empty margin
    pg.mouse.click(1250, 600)
    _quiet(pg, 1000, 30000)
    return run


def _budgets() -> dict[str, dict[str, int]]:
    out = {g: dict(m) for g, m in BUDGETS.items()}
    if os.environ.get("JUNOVIEW_MATHJAX_DIR"):
        out.update({g: dict(m) for g, m in BUDGETS_REAL_MATHJAX.items()})
    return out


def _table(results: dict, scale: float) -> str:
    budgets, rows = _budgets(), []
    for g, m in results.items():
        for k, v in m.items():
            b = budgets.get(g, {}).get(k)
            lim = round(b * scale) if b else None
            flag = "" if lim is None or v <= lim else "  <-- OVER"
            rows.append(f"  {g:13} {k:13} {v:6} ms"
                        + (f"   budget {lim:6} ms" if lim else "") + flag)
    return "\n".join(rows)


def _over(results: dict, scale: float) -> list[str]:
    budgets = _budgets()
    return sorted({g for g, m in results.items() for k, v in m.items()
                   if budgets.get(g, {}).get(k)
                   and v > budgets[g][k] * scale})


KEPT_ROWS = ("[...document.querySelectorAll('#film-list .film-row')]"
             ".filter(function(r){return r.__jvKept;}).length")


def _select_deselect(pg):
    sel, desel = g_select_deselect(pg)
    return {"select": sel, "deselect": desel}


# in the order they run; a group can time more than one gesture
GROUPS = {"select": _select_deselect, "deselect": _select_deselect,
          "slide_change": g_slide_change, "undo": g_undo,
          "add_slide": g_add_slide, "ribbon_tab": g_ribbon_tab,
          "to_deck": g_to_deck, "start_show": g_start_show}


def _run_group(name, pg) -> dict[str, list]:
    # what the last group set going (thumbnails drawn as they show, the
    # typesetter's idle pass) finishes before this one is timed
    _quiet(pg, 600, 20000)
    got = GROUPS[name](pg)
    return got if isinstance(got, dict) else {name: got}


def test_key_gestures_stay_inside_their_budgets(app):
    scale = float(os.environ.get("JUNOVIEW_SPEED_SCALE") or 1)
    errs: list[str] = []
    loads, kept = _measure_loads(app, errs)
    assert kept
    ctx, pg, page_errs = kept
    # (the deck opens once: that one run is its number)
    raw: dict[str, list] = {"load": loads,
                            "open_deck": [_open_deck(app, pg, "speed")]}
    assert pg.evaluate(SLIDE) == 0
    # every row of the strip, marked: what the gestures keep stays marked
    pg.evaluate("document.querySelectorAll('#film-list .film-row')"
                ".forEach(function(r){r.__jvKept=1;})")
    for name in GROUPS:
        if name not in raw:
            raw.update(_run_group(name, pg))
    kept_rows = pg.evaluate(KEPT_ROWS)
    results = {g: _median(r) for g, r in raw.items()}

    # over budget: measured again before it counts, the better median kept
    # -- a regression is slow both times, a neighbour's CPU spike is not
    retried: dict[str, dict] = {}
    for g in _over(results, scale):
        if g in retried:
            continue
        if g == "load":
            again = {"load": _measure_loads(app, errs, keep_last=False)[0]}
        else:
            # in a fresh page, as the first runs were: the first deck of a
            # page boots the editor too (a second one is 5x cheaper), and
            # a page that has made a gesture before is warm (the ribbon
            # fit remembers a figure's tools) -- a retry there forgives a
            # regression on the cold path every new page takes
            c2, p2, e2, _ = _load_once(app)
            opened = _open_deck(app, p2, "speed")
            again = ({g: [opened]} if g == "open_deck"
                     else _run_group(g, p2))
            c2.close()
            errs.extend(e2)
        for name, runs in again.items():
            retried[name] = _median(runs)
            results[name] = {k: min(v, retried[name][k])
                             for k, v in results[name].items()}

    report = {"scale": scale,
              "mathjax": "real" if os.environ.get("JUNOVIEW_MATHJAX_DIR")
              else "stand-in", "strip_rows_kept": kept_rows,
              "medians": results, "retried": retried, "runs": raw}
    out = os.environ.get("JUNOVIEW_SPEED_REPORT")
    if out:
        Path(out).write_text(json.dumps(report, indent=1), encoding="utf-8")
    table = _table(results, scale)
    print(f"\nspeed guard ({THROTTLE}x CPU, median of {REPS}, budgets "
          f"x{scale:g}; strip rows kept {kept_rows}/{SLIDES}):\n" + table)
    problems = []
    if errs + page_errs:
        problems.append(f"page errors: {errs + page_errs}")
    # the strip keeps its rows (renderFilm reconciles, never rebuilds).
    # A row whose thumbnail was drawn live -- the slide was current, or
    # edited -- is drawn again at the next build: here slides 1, 7, 8, 9
    # and 10, so 55 are kept. Wholesale, as before the speed work: 0.
    if kept_rows < SLIDES - 10:
        problems.append(
            f"only {kept_rows} of {SLIDES} strip rows outlived the gestures:"
            " something is rebuilding the slide strip wholesale")
    bad = _over(results, scale)
    if bad:
        problems.append(f"{', '.join(bad)} slower than budget:\n{table}")
    assert not problems, ("see CONTRIBUTING.md, 'The speed guard'.\n"
                          + "\n".join(problems))
    ctx.close()
