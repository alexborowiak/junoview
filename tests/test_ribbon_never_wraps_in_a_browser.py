"""The editor ribbon never wraps, in a real Chromium (opt-in).

CLAUDE.md's first UI invariant: ribbon buttons never wrap to a second row
-- fitEditRibbon compacts the row instead -- and a button is words plus an
icon, never an icon alone. The fit decides most rows from what it has
measured before (2026-10-09, speed), so this walks the whole of it the way
a person meets it: every tab, with nothing selected and with a text box, a
shape and a figure selected, at widths from 1000 to 1920 and at the two
laptop sizes, going down and back up, in the Default ribbon, in a
generated layout (Familiar) and in the side rail -- and reads what the
browser actually laid out (tests/ribbon_fit_probe.js).

Set ``JUNOVIEW_BROWSER_TESTS=1`` to run it; it needs the Python
``playwright`` package and its Chromium (skips cleanly without them).
``JUNOVIEW_RIBBON_STEP`` sets the width step (default 80px).
"""

from __future__ import annotations

import json
import os
from pathlib import Path

import pytest

PROBE = Path(__file__).with_name("ribbon_fit_probe.js")
LAYOUTS = ("default", "familiar-office-ribbon", "side")


def _deck(pg) -> dict:
    ref = pg.evaluate(
        "(()=>{const c=[...document.querySelectorAll('.nbshell .card"
        "[data-anchor]')].find(c=>c.dataset.kind==='figure');"
        "const s=(window.SemApp&&window.SemApp.active)||'';"
        "return c?(s+'::'+c.dataset.anchor):null})()")
    an = [{"k": "text", "x": 6, "y": 5, "w": 60, "text": "A heading",
           "size": 4, "style": "h1"},
          {"k": "rect", "x": 70, "y": 60, "w": 20, "h": 20}]
    if ref:
        an.append({"k": "cell", "x": 6, "y": 25, "w": 50, "h": 60,
                   "ref": ref})
    return {"name": "ribbon-walk", "slides": [
        {"layout": "blank", "annots": an},
        {"layout": "blank", "annots": [dict(an[0], text="Two")]}]}


@pytest.fixture
def browser_page(out, tmp_path):
    if os.environ.get("JUNOVIEW_BROWSER_TESTS") != "1":
        pytest.skip("set JUNOVIEW_BROWSER_TESTS=1 for the real-browser checks")
    sync_api = pytest.importorskip("playwright.sync_api")
    path = tmp_path / "page.html"
    path.write_text(out, encoding="utf-8")
    with sync_api.sync_playwright() as pw:
        try:
            browser = pw.chromium.launch(channel="chromium")
        except Exception:
            try:
                browser = pw.chromium.launch()
            except Exception as e:   # no browser installed for playwright
                pytest.skip(f"Chromium unavailable: {e}")

        def make(layout: str):
            ctx = browser.new_context(viewport={"width": 1920, "height": 900})
            lay = "" if layout in ("default", "side") else layout
            ctx.add_init_script(
                "try{localStorage.setItem('plotline-tour','1');"
                "localStorage.setItem('plotline-tour-editor','1');"
                + (f"localStorage.setItem('jv-ribbon-layout','{lay}');"
                   if lay else "")
                + "}catch(e){}")
            pg = ctx.new_page()
            errors: list[str] = []
            pg.on("pageerror", lambda e: errors.append(str(e)))
            pg.goto(path.as_uri())
            pg.wait_for_selector(".nbshell .card")
            pg.add_script_tag(content=PROBE.read_text(encoding="utf-8"))
            pg.evaluate("t=>window.SemDeckImport(t,false)",
                        json.dumps(_deck(pg)))
            pg.wait_for_function(
                "document.body.classList.contains('slide-editing')")
            pg.wait_for_timeout(300)
            if layout == "side":
                pg.evaluate("document.getElementById('vw-side').click()")
                pg.wait_for_function(
                    "document.getElementById('deck').classList"
                    ".contains('rbn-side')")
            return ctx, pg, errors
        yield make
        browser.close()


def _settle(pg):
    pg.evaluate("window.__rbnSettle()")


def _items(pg):
    return pg.evaluate(
        "[...document.querySelectorAll('#deck-stage .annot-layer>.an-item')]"
        ".filter(e=>e.offsetParent&&!e.classList.contains('an-arrow-hit'))"
        ".map(e=>{const r=e.getBoundingClientRect();"
        "return [e.className,r.x+Math.min(r.width/2,30),"
        "r.y+Math.min(r.height/2,14)]})")


def _select(pg, which: str | None):
    # Escape with nothing selected leaves the editor, so only to deselect
    if pg.evaluate("!!document.querySelector('#deck-stage .an-item.sel')"):
        pg.keyboard.press("Escape")
        _settle(pg)
    if which is None:
        return
    for cls, x, y in _items(pg):
        if f"an-{which}" in cls.split():
            pg.mouse.click(x, y)
            _settle(pg)
            return
    pytest.fail(f"no {which} on the slide to select")


def _tabs(pg):
    return pg.evaluate(
        "[...document.querySelectorAll('#rbn-tabs .rbn-tab')]"
        ".filter(b=>b.getClientRects().length"
        "&&!b.classList.contains('rbn-tab-off')).map(b=>b.id)")


def _widths() -> list[tuple[int, int]]:
    step = int(os.environ.get("JUNOVIEW_RIBBON_STEP", "80"))
    down = [(w, 657) for w in range(1920, 999, -step)]
    return down + [(1366, 657), (1280, 600)] + down[::-1]


@pytest.mark.parametrize("layout", LAYOUTS)
def test_the_ribbon_never_wraps(browser_page, layout):
    ctx, pg, errors = browser_page(layout)
    pg.evaluate("window.__rbnWords()")
    bad: list[str] = []
    floors: list[str] = []
    sels = [None, "text", "rect", "cell"]
    for which in sels:
        if which == "cell" and not any(
                "an-cell" in c[0].split() for c in _items(pg)):
            continue
        _select(pg, which)
        for w, h in _widths():
            pg.set_viewport_size({"width": w, "height": h})
            _settle(pg)
            tag = f"{layout} {which or 'nothing'} {w}x{h}"
            r = pg.evaluate("t=>window.__rbnProbe(t)", tag + " (resize)")
            bad += r["bad"]
            for tab in _tabs(pg):
                pg.click("#" + tab)
                _settle(pg)
                r = pg.evaluate("t=>window.__rbnProbe(t)", f"{tag} {tab}")
                bad += r["bad"]
                if r["floor"]:
                    floors.append(f"{tag} {tab}")
    stats = pg.evaluate(
        "window.SemDeckRibbonFit?window.SemDeckRibbonFit.stats():null")
    ctx.close()
    assert not errors, errors
    assert not bad, "\n".join(bad[:40])
    if stats is not None:
        # every row the fit decided from what it had measured came out as
        # it predicted: the check after the frame never had to put one
        # right (a stale answer would have shown for a frame)
        assert stats["refit"] == 0, stats
    print(f"{layout}: below the floor at {len(floors)} stops"
          + (": " + "; ".join(floors[:6]) if floors else ""), stats)


_STATE = r"""(()=>{
  const bar=document.getElementById('edit-tools'),deck=document.getElementById('deck');
  return [[...deck.classList].filter(c=>/^erc/.test(c)).sort().join(' '),
    [...bar.querySelectorAll('.rbn-grp.rbn-folded')].filter(g=>g.getClientRects().length)
      .map(g=>(g.querySelector(':scope>.rbn-lab')||{}).textContent||g.className).sort().join('|'),
    (document.getElementById('vw-morewrap')||{}).hidden===false];})()"""


@pytest.mark.parametrize("layout", ("default", "familiar-office-ribbon"))
def test_a_remembered_fit_is_the_measured_fit(browser_page, layout):
    """Wherever the walk stops -- after a resize, a tab, a selection, with
    the fit deciding from what it has measured before -- the row is the
    one a fit that remembers nothing measures there (SemDeckRibbonFit.refit
    forgets every length and climbs the ladder from the bottom)."""
    ctx, pg, errors = browser_page(layout)
    if not pg.evaluate("!!window.SemDeckRibbonFit"):
        pytest.skip("this build has no remembered fit")
    differ: list[str] = []
    step = max(160, int(os.environ.get("JUNOVIEW_RIBBON_STEP", "80")) * 2)
    widths = [(w, 657) for w in range(1920, 999, -step)] \
        + [(1366, 657), (1280, 600)]
    for which in (None, "text", "cell"):
        if which == "cell" and not any(
                "an-cell" in c[0].split() for c in _items(pg)):
            continue
        _select(pg, which)
        for w, h in widths + widths[::-1]:
            pg.set_viewport_size({"width": w, "height": h})
            _settle(pg)
            for tab in _tabs(pg):
                pg.click("#" + tab)
                _settle(pg)
                had = pg.evaluate(_STATE)
                pg.evaluate("window.SemDeckRibbonFit.refit()")
                _settle(pg)
                now = pg.evaluate(_STATE)
                if had != now:
                    differ.append(f"{layout} {which} {w}x{h} {tab}: "
                                  f"remembered {had} measured {now}")
    stats = pg.evaluate("window.SemDeckRibbonFit.stats()")
    ctx.close()
    assert not errors, errors
    assert not differ, "\n".join(differ[:30])
    assert stats["refit"] == 0, stats
