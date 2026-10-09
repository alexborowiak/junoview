"""The page typesets its maths as it is read -- driven in a real Chromium.

tests/test_maths_typeset_as_read.py runs app.js's jvMath against a stand-in
DOM; this drives the real page, with the browser's own IntersectionObserver
and idle callbacks, against a stand-in MathJax served where the pinned CDN
address is (so it needs no network, and it records what it was asked to
typeset). Opt-in like the theme matrix: set ``JUNOVIEW_BROWSER_TESTS=1``.
Needs the ``playwright`` package and its Chromium; skips cleanly without
them.
"""

from __future__ import annotations

import os
from pathlib import Path

import pytest

from junoview.notebook.parser import parse_notebook
from junoview.render.page import render_page

pytestmark = pytest.mark.skipif(
    os.environ.get("JUNOVIEW_BROWSER_TESTS") != "1",
    reason="set JUNOVIEW_BROWSER_TESTS=1 for real-browser checks")

MJ_URL = "https://cdn.jsdelivr.net/npm/mathjax@3.2.2/es5/tex-chtml.js"

# Enough of MathJax for the page: startup, a synchronous typeset that turns
# each $..$ into an <mjx-container> (as the real one does), and a log of
# every element it was handed.
_FAKE_MATHJAX = r"""
(function(){
  window.__mj=[];
  function setIn(el){
    var w=document.createTreeWalker(el,NodeFilter.SHOW_TEXT),ns=[];
    while(w.nextNode()) ns.push(w.currentNode);
    ns.forEach(function(n){
      var p=n.parentElement;
      if(!p||p.closest('pre,code,script,style,textarea,mjx-container'))
        return;
      if(!/\$[^$]+\$/.test(n.nodeValue)) return;
      var c=document.createElement('mjx-container');
      c.textContent=n.nodeValue.replace(/\$/g,'');
      n.parentNode.replaceChild(c,n);
    });
  }
  window.MathJax={
    startup:{promise:Promise.resolve(),document:{render:function(){}}},
    typeset:function(els){
      els.forEach(function(el){
        window.__mj.push(el.id||el.className||el.tagName);setIn(el);});
    },
    typesetPromise:function(els){this.typeset(els);return Promise.resolve();},
    typesetClear:function(){}
  };
})();
"""


def _nb(n_cards: int, maths: bool) -> dict:
    cells = [{"cell_type": "markdown", "metadata": {},
              "source": "# A long notebook"}]
    for i in range(n_cards):
        words = " ".join(["filler"] * 120)
        eq = f" The energy is $E_{{{i}}} = m c^2$." if maths else ""
        cells.append({"cell_type": "markdown", "metadata": {},
                      "source": f"Note {i}.{eq} {words}"})
    return {"cells": cells, "metadata": {}, "nbformat": 4,
            "nbformat_minor": 5}


@pytest.fixture
def browser_page():
    sync = pytest.importorskip("playwright.sync_api")
    with sync.sync_playwright() as pw:
        try:
            browser = pw.chromium.launch()
        except Exception as e:      # noqa: BLE001 -- no browser here
            pytest.skip(f"Chromium unavailable: {e}")
        ctx = browser.new_context(viewport={"width": 1366, "height": 657})
        ctx.add_init_script(
            "try{localStorage.setItem('plotline-tour','1');"
            "localStorage.setItem('plotline-tour-editor','1');}catch(e){}")
        asked: list[str] = []

        def mathjax(route):
            asked.append(route.request.url)
            if route.request.url == MJ_URL:
                route.fulfill(status=200, body=_FAKE_MATHJAX,
                              headers={"content-type": "text/javascript"})
            else:
                route.abort()
        ctx.route("https://cdn.jsdelivr.net/**", mathjax)
        ctx.route("https://cdn.plot.ly/**", lambda r: r.abort())
        page = ctx.new_page()
        errors: list[str] = []
        page.on("pageerror", lambda e: errors.append(str(e)))
        yield page, asked, errors
        browser.close()


def _open(page, tmp_path: Path, nb: dict) -> None:
    f = tmp_path / "page.html"
    f.write_text(render_page([parse_notebook(nb)]), encoding="utf-8")
    page.goto(f.as_uri(), wait_until="load")
    page.wait_for_function("()=>window.jvMath&&window.SemApp")


_N = """document.querySelectorAll(
  '.nbshell:not([hidden]) .content [data-math=""]').length"""
_PENDING = "()=>" + _N
_DONE = "()=>" + _N + "===0"


def test_the_screen_is_set_first_and_the_rest_while_idle(browser_page,
                                                          tmp_path):
    page, asked, errors = browser_page
    _open(page, tmp_path, _nb(40, maths=True))
    # the first call holds what was on screen -- not the whole notebook
    page.wait_for_function("()=>window.__mj&&window.__mj.length>0")
    first = page.evaluate("()=>window.__mj.length")
    assert 0 < first < 40
    # ...and the idle pass finishes the job, a few cards a call
    page.wait_for_function(_DONE, timeout=20000)
    calls = page.evaluate("()=>window.__mj.length")
    assert calls >= 40
    raw = page.evaluate("()=>document.querySelectorAll("
                        "'.nbshell:not([hidden]) .content [data-math]')"
                        ".length")
    assert raw >= 40
    assert page.evaluate("""()=>[...document.querySelectorAll(
      '.nbshell:not([hidden]) .content .card')].filter(c=>
      /\\$E_/.test(c.textContent)).length""") == 0
    # the raw view is still an inert template: nothing of it was typeset
    assert page.evaluate("()=>document.querySelectorAll("
                         "'.rawview .rawcell').length") == 0
    assert asked.count(MJ_URL) == 1
    assert errors == []


def test_the_raw_view_is_set_when_it_is_first_opened(browser_page,
                                                       tmp_path):
    page, _asked, errors = browser_page
    _open(page, tmp_path, _nb(12, maths=True))
    page.wait_for_function(_DONE, timeout=20000)
    page.evaluate("()=>document.querySelector('#view-raw').click()")
    page.wait_for_function("""()=>{
      const c=document.querySelectorAll('.rawview .rawcell[data-math]');
      return c.length>0&&[...c].every(e=>e.getAttribute('data-math')==='1');
    }""", timeout=20000)
    assert errors == []


def test_a_page_without_maths_never_fetches_mathjax(browser_page, tmp_path):
    page, asked, errors = browser_page
    _open(page, tmp_path, _nb(12, maths=False))
    page.wait_for_timeout(1500)
    assert asked == []
    assert page.evaluate("()=>jvMath.ready()") is False
    assert errors == []


def _held_back(page, tmp_path: Path) -> None:
    """A long notebook with the idle pass held back: the cards below the
    screen are still raw TeX."""
    page.add_init_script("window.requestIdleCallback=function(){return 0;};")
    _open(page, tmp_path, _nb(30, maths=True))
    page.wait_for_function("()=>window.__mj&&window.__mj.length>0")
    page.wait_for_timeout(500)
    assert page.evaluate(_PENDING) > 0


def test_print_typesets_whatever_is_still_waiting(browser_page, tmp_path):
    """beforeprint cannot wait: Ctrl+P typesets the rest synchronously."""
    page, _asked, errors = browser_page
    _held_back(page, tmp_path)
    page.evaluate("()=>window.dispatchEvent(new Event('beforeprint'))")
    assert page.evaluate(_PENDING) == 0
    assert errors == []


def test_find_typesets_before_it_marks_words(browser_page, tmp_path):
    """Find wraps matches in <mark>; inside raw $..$ that would split the
    TeX for good, so every equation is set first and then searched."""
    page, _asked, errors = browser_page
    _held_back(page, tmp_path)
    page.keyboard.press("Control+f")
    page.fill("#docfind-in", "filler")
    page.wait_for_function(
        "()=>/\\//.test((document.querySelector('#docfind-n')||{})"
        ".textContent||'')", timeout=20000)
    assert page.evaluate(_PENDING) == 0
    assert page.evaluate("()=>document.querySelectorAll('mark.jv-doc')"
                         ".length") > 30
    assert errors == []
