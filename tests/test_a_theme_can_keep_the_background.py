"""A colour theme can leave the slide background alone (T595).

The user, 2026-09-30: "we discussed the themes affecting the background.
There should be a tick box with the themes that determines this."

The page is one of a palette's colours, so picking Business turned every
slide of a dark deck light whether or not the page was what you were
changing. A tick box beside the theme cards says whether the page comes
along; ticked is what a theme always did. The same box governs a style
set that carries a palette, because it replaces the same ``pres.tokens``.

The model half RUNS: which page a deck ends on, and whether its text
still reads there, are questions about values, not spelling.
"""

from __future__ import annotations

import json
import subprocess
import tempfile
from pathlib import Path

import pytest

from junoview import assets


def _run(fns: tuple[str, ...], script: str):
    from helpers_js import js_engine, lift_fn
    eng = js_engine()
    if eng is None:
        pytest.skip("no node or VS Code Electron on this machine")
    cmd, env = eng
    src = assets.deck_js()
    pre = "\n".join(lift_fn(src, f) for f in fns) + "\n"
    with tempfile.TemporaryDirectory() as d:
        p = Path(d) / "run.js"
        p.write_text(pre + script, encoding="utf-8")
        r = subprocess.run(cmd + [str(p)], capture_output=True, text=True,
                           encoding="utf-8", env=env, timeout=60)
        assert r.returncode == 0, r.stderr[:2000]
        return json.loads([ln for ln in r.stdout.splitlines()
                           if ln.startswith("{") or ln.startswith("[")][-1])


# ------------------------------------------------------------ the model


def test_the_deck_keeps_the_page_it_named():
    """A deck on plum stays on plum under Business's light page."""
    got = _run(("keepDeckPage",), """
      var pres={tokens:{c:{page:'#eef1f4',heading:'#1c3d6e'}}};
      keepDeckPage({c:{page:'#3b1f3a',accent:'#ff0000'}});
      console.log(JSON.stringify(pres.tokens));
    """)
    # the page is the deck's; every other colour is the theme's
    assert got == {"c": {"page": "#3b1f3a", "heading": "#1c3d6e"}}


def test_a_deck_on_the_default_page_stays_on_it():
    """A deck that never named a page is on the default one, and keeping
    it means naming none -- not stamping the theme's page, and not
    stamping today's default either (the default can follow the app)."""
    got = _run(("keepDeckPage",), """
      var out=[];
      var pres={tokens:{c:{page:'#fbfaf6',ink:'#2b2b2b'}}};
      keepDeckPage({});
      out.push(pres.tokens);
      pres={tokens:{c:{page:'#fbfaf6'}}};
      keepDeckPage(null);
      out.push(pres.tokens);
      console.log(JSON.stringify(out));
    """)
    assert got == [{"c": {"ink": "#2b2b2b"}}, {"c": {}}]


def test_it_still_reads_is_arithmetic():
    """Kept, a theme's inks may land on a page they were not chosen for.
    Paper's near-black heading on the default dark page does not read;
    Business's headings sit on their own slate box and still do."""
    got = _run(("rgbOf", "relLum", "contrast", "themeReadsOnPage"), """
      var PAL,STY;
      function tokVal(v){
        return (typeof v==='string'&&v.charAt(0)==='@')?PAL[v.slice(1)]:v;}
      function styleDef(k){return STY[k];}
      var out={};
      PAL={page:'#0b141d',heading:'#1a1a1a',ink:'#2b2b2b'};
      STY={h1:{color:'@heading',bg:'none'},body:{color:'@ink',bg:'none'}};
      out.paperOnDark=themeReadsOnPage();
      PAL={page:'#0b141d',heading:'#1c3d6e',ink:'#1f2933',
           surface:'#d9dee5'};
      STY={h1:{color:'@heading',bg:'@surface'},
           body:{color:'@ink',bg:'@surface'}};
      out.businessOnDark=themeReadsOnPage();
      PAL={page:'#fbfaf6',heading:'#1a1a1a',ink:'#2b2b2b'};
      STY={h1:{color:'@heading',bg:'none'},body:{color:'@ink',bg:'none'}};
      out.paperOnPaper=themeReadsOnPage();
      console.log(JSON.stringify(out));
    """)
    assert got == {"paperOnDark": False, "businessOnDark": True,
                   "paperOnPaper": True}


# ------------------------------------------------------------- the doors


def test_both_ways_a_palette_arrives_honour_the_box(out):
    """applyColourTheme and applyStyleSet each replace pres.tokens; each
    puts the deck's page back when the box is off. Ticked is the default,
    so a deck nobody changes behaves exactly as it did."""
    th = out.split("function applyColourTheme(id){")[1].split("\n  }")[0]
    assert "    var prevTok=deep(pres.tokens||{});   /* T595 */" in th
    assert "    if(!themeTakesPage()) keepDeckPage(prevTok);   /* T595 */" in th
    # ...after the theme's own page is written, or the theme would win
    assert th.index("pres.tokens.c.page=t.page;") < th.index(
        "keepDeckPage(prevTok)")
    st = out.split("function applyStyleSet(id){")[1].split("\n  }")[0]
    assert "    if(t.tokens&&!themeTakesPage()) keepDeckPage(prevTok);" in st
    assert "function themeTakesPage(){return lsGet(THEMEBG_KEY)!=='0';}" in out


def test_the_box_sits_with_the_themes(out):
    """Beside the theme cards, not in the footer with the type set's
    switch -- and the cards are painted on the page they would get."""
    html = assets.deck_html()
    band = html.index('<div class="ss-band">Colour themes</div>')
    box = html.index('<input type="checkbox" id="ss-bg" checked>')
    grid = html.index('<div class="ss-grid" id="ss-cgrid"></div>')
    assert band < box < grid
    assert "Change the slide background too</label>" in html
    assert "      if(keptPage) pal.page=keptPage;" in out
    assert "        keptPage=themeTakesPage()?'':tokens().c.page;" in out
    assert "      setThemeTakesPage(bgck.checked);build();});" in out


def test_the_toast_says_the_background_stayed(out):
    """A kept page is said, and a kept page the text will not read on is
    said with the one click that fixes it."""
    assert "' The slide background stayed as it was'" in out
    assert "(themeReadsOnPage()?'.':" in out
