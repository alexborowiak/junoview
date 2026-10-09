"""T620: what sits between the slides of the scrolling page.

The user, 2026-10-09: "it would be cool if there was an infinite scroll
view. Essentially just you can scroll between all of the different
slides and they are next to each other instead of having to click. Then
there is just a small feint grey line or something that marks between
slides (would be cool if this could be ticked on or off as well, and be
feint or strong actually)."

T389's scrolling page already was that view, with the slides as cards a
gap apart. Its bar now chooses what sits between them: a faint line (the
default), a strong one, no line (edge to edge), or the spaced cards.

Driven headless at 1280x600 on a five-slide deck: four separators for
five pages, each as wide as the page is drawn and sitting on its join;
the faint line light grey on white slides and dark grey on dark ones,
the strong one 2px; Spaced brings back the 24px gap and the shadow; the
choice survives closing and reopening.
"""

from __future__ import annotations

import subprocess
import tempfile
from pathlib import Path

import pytest

from helpers_js import js_engine, lift_fn
from junoview import assets

PART = assets.load("js/deck/54-scroll-show.js")


def test_four_worded_choices_faint_first():
    assert ("  var SCROLL_SEPS=[['faint','Faint line'],['strong','Strong line'],\n"
            "    ['none','No line'],['gap','Spaced']];") in PART
    # a labelled group of buttons, each pressed or not
    assert ("sg.setAttribute('role','group');"
            "sg.setAttribute('aria-label','Between slides');") in PART
    assert "b.setAttribute('aria-pressed',b.dataset.sep===v?'true':'false');" in PART
    assert ("bar.appendChild(t);bar.appendChild(n);bar.appendChild(sg);"
            "bar.appendChild(x);") in PART


def test_the_choice_is_this_browsers_and_never_the_decks():
    assert "  var SCROLL_SEP_KEY='junoview:deck:scrollsep';" in PART
    assert "    lsSet(SCROLL_SEP_KEY,v,true);" in PART
    t620 = PART.split("---- T620")[1].split("  function scrollShowPages(){")[0]
    assert "pres." not in t620 and "markDirty" not in t620


def test_an_unknown_or_missing_choice_is_the_faint_line(tmp_path):
    eng = js_engine()
    if eng is None:
        pytest.skip("no JS engine")
    cmd, env = eng
    code = (
        "var SCROLL_SEPS=[['faint','Faint line'],['strong','Strong line'],"
        "['none','No line'],['gap','Spaced']];\n"
        "var SCROLL_SEP_KEY='junoview:deck:scrollsep';\n"
        "var STORED=null;function lsGet(k){return STORED;}\n"
        + lift_fn(PART, "scrollSepGet") + "\n"
        "var out=[];[null,'','strong','none','gap','faint','bogus']"
        ".forEach(function(v){STORED=v;out.push(scrollSepGet());});\n"
        "console.log(JSON.stringify(out));\n")
    with tempfile.TemporaryDirectory() as d:
        p = Path(d) / "run.js"
        p.write_text(code, encoding="utf-8")
        r = subprocess.run(cmd + [str(p)], capture_output=True, text=True,
                           env=env, timeout=60)
    assert r.returncode == 0, r.stderr[:2000]
    import json
    got = json.loads([ln for ln in r.stdout.splitlines()
                      if ln.startswith("[")][-1])
    assert got == ["faint", "faint", "strong", "none", "gap", "faint",
                   "faint"]


def test_a_line_sits_between_each_two_pages_as_wide_as_the_page():
    # one between each pair, none before the first
    assert ("      if(i){\n"
            "        var sep=document.createElement('div');"
            "sep.className='scroll-sep';\n"
            "        sep.setAttribute('aria-hidden','true');\n"
            "        p.parentNode.insertBefore(sep,p);\n"
            "      }") in PART
    # sized with the page it heads, outside the page's zoom
    fit = PART.split("  function scrollShowFit(){")[1].split("\n  }\n")[0]
    assert "      var z=Math.max(0.1,Math.min(1,avail/w));" in fit
    assert "        sep.style.width=Math.round(w*z)+'px';" in fit
    # set before the first fit, so the pages open in the chosen shape
    opn = PART.split("  function openScrollShow(){")[1]
    assert opn.index("    scrollSepShow(scrollSepGet());") \
        < opn.index("    scrollShowFit();")
    # a change keeps the page you were reading in view
    st = PART.split("  function scrollSepSet(v){")[1].split("\n  }\n")[0]
    assert "if(body&&at) body.scrollTop=scrollShowPageTop(body,at)+off;" in st


def test_the_css_runs_the_pages_together_unless_spaced():
    css = assets.deck_css()
    # T389's cards stay as the Spaced choice
    assert ".deck-scroll .print-page{margin:0 auto 24px;box-shadow:0 8px 40px #0008;}" \
        in css
    assert ('.deck-scroll:not([data-sep="gap"]) .print-page'
            "{margin:0 auto;box-shadow:none;}") in css
    # the line is drawn across the join, above both pages, see-through
    assert (".deck-scroll .scroll-sep{display:none;position:relative;"
            "z-index:1;height:0;") in css
    assert ('.deck-scroll[data-sep="faint"] .scroll-sep::after{top:0;height:1px;\n'
            "  background:#8a939c80;}") in css
    assert ('.deck-scroll[data-sep="strong"] .scroll-sep::after{top:-1px;height:2px;\n'
            "  background:#7a838cf2;}") in css
    # No line and Spaced draw none
    assert '.deck-scroll[data-sep="none"] .scroll-sep' not in css


def test_the_help_and_the_search_know_it(out):
    hlp = assets.help_html()
    assert "<li><b>The scrolling page.</b>" in hlp
    assert "<i>Between slides</i> in its top bar" in hlp
    # "infinite scroll" is what the user called it
    assert ("    'pl-scroll':'infinite scroll continuous scroll view "
            "scrolling page '") in out
