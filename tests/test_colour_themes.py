"""Colour themes: a palette for the whole deck, beside the type (T315).

The user, 2026-09-06: "there should be themes that you can create, and that
already exists, that apply to all texts, e.g. one that is called business
that has something like slate grey background on all text boxes, and like
a deep blue heading ... Colour themes to go throughout, and for each
individual item."

A SECOND AXIS beside the style sets, not a seventh set. A set is the type
and every one of the six is colour neutral; a theme is a palette of the ten
deck tokens plus which token each built-in style wears for its ink, ground
and edge. A theme never writes a literal into a style -- every colour it
says is '@name' -- so applying another theme re-resolves every box, and a
variation (which keeps only its own delta) survives and re-resolves too.

The palette half RUNS: whether every reference a theme makes resolves in
that theme's own palette, and whether its heading reads on its page, are
arithmetic, and a substring cannot check arithmetic.
"""

from __future__ import annotations

import json
import re
import subprocess
import tempfile
from pathlib import Path

import pytest

from junoview import assets

_CONSTS = ("TOKENS_DEFAULT", "COLOUR_THEMES")
_FNS = ("tokRef", "tokValIn", "themePalette")


def _const(src: str, name: str) -> str:
    m = re.search(r"^\s*var " + name + r"=", src, re.M)
    assert m, name
    i = m.start()
    depth, k = 0, src.index("=", i)
    while k < len(src):
        c = src[k]
        if c in "{[(":
            depth += 1
        elif c in "}])":
            depth -= 1
        elif c == ";" and depth == 0:
            return src[i:k + 1]
        k += 1
    raise AssertionError(name)


def _run(script: str):
    from helpers_js import js_engine, lift_fn
    eng = js_engine()
    if eng is None:
        pytest.skip("no node or VS Code Electron on this machine")
    cmd, env = eng
    src = assets.deck_js()
    pre = ("\n".join(_const(src, c) for c in _CONSTS) + "\n"
           + "\n".join(lift_fn(src, f) for f in _FNS) + "\n")
    with tempfile.TemporaryDirectory() as d:
        p = Path(d) / "run.js"
        p.write_text(pre + script, encoding="utf-8")
        r = subprocess.run(cmd + [str(p)], capture_output=True, text=True,
                           encoding="utf-8", env=env, timeout=60)
        assert r.returncode == 0, r.stderr[:2000]
        return json.loads([ln for ln in r.stdout.splitlines()
                           if ln.startswith("{") or ln.startswith("[")][-1])


def _lum(hexs: str) -> float:
    h = hexs.lstrip("#")
    r, g, b = (int(h[i:i + 2], 16) / 255 for i in (0, 2, 4))

    def ch(c):
        return c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4
    return 0.2126 * ch(r) + 0.7152 * ch(g) + 0.0722 * ch(b)


def _contrast(a: str, b: str) -> float:
    la, lb = _lum(a), _lum(b)
    hi, lo = max(la, lb), min(la, lb)
    return (hi + 0.05) / (lo + 0.05)


# ------------------------------------------------------- the model


def test_the_defaults_reproduce_todays_look():
    """Four tokens joined the six. A deck written before this key must
    render unchanged, so the defaults are exactly the colours every deck
    already has: the dark page, white ink, the teal accent."""
    got = _run("""
      console.log(JSON.stringify(TOKENS_DEFAULT.c));
    """)
    assert set(got) == {"accent", "warm", "lift", "calm", "ink", "quiet",
                        "page", "surface", "heading", "line"}
    assert got["page"] == "#0b141d" and got["heading"] == "#ffffff"


def test_every_theme_names_every_token_and_every_style():
    """"A theme means what it says" needs no zero-fill list only if the
    built-ins say everything: all ten tokens, all seven styles, each with
    a colour, a ground and an edge."""
    got = _run("""
      console.log(JSON.stringify(COLOUR_THEMES.map(function(t){
        return {id:t.id, tokens:Object.keys(t.tokens.c).sort(),
                styles:Object.keys(t.styles).sort(),
                fields:Object.keys(t.styles).map(function(k){
                  return Object.keys(t.styles[k]).sort().join(',');})};
      })));
    """)
    ids = [t["id"] for t in got]
    assert "business" in ids and "exciting" in ids, "the user's two words"
    for t in got:
        assert t["tokens"] == sorted(["accent", "warm", "lift", "calm", "ink",
                                      "quiet", "page", "surface", "heading",
                                      "line"]), t["id"]
        assert t["styles"] == sorted(["title", "h1", "h2", "h3", "body",
                                      "small", "caption"]), t["id"]
        assert all(f == "bdc,bg,color" for f in t["fields"]), (t["id"], t["fields"])


def test_a_theme_never_writes_a_literal_into_a_style():
    """Every colour a style says is '@name'. That is what lets a second
    theme re-resolve every box instead of leaving the first theme's
    literals baked in."""
    got = _run("""
      var bad=[];
      COLOUR_THEMES.forEach(function(t){
        Object.keys(t.styles).forEach(function(k){
          ['color','bg','bdc'].forEach(function(p){
            var v=t.styles[k][p];
            if(v&&v!=='none'&&!tokRef(v)) bad.push(t.id+'.'+k+'.'+p+'='+v);
          });
        });
      });
      console.log(JSON.stringify(bad));
    """)
    assert got == [], got


def test_every_reference_resolves_in_its_own_palette():
    """A theme card is painted with tokValIn against the theme's OWN
    palette -- the deck's current colours are exactly what it is not. A
    reference that fell through to the default teal would paint a card
    that lies."""
    got = _run("""
      var out={};
      COLOUR_THEMES.forEach(function(t){
        var pal=themePalette(t),misses=[];
        Object.keys(t.styles).forEach(function(k){
          ['color','bg','bdc'].forEach(function(p){
            var v=t.styles[k][p];
            if(!v||v==='none') return;
            var r=tokValIn(v,pal);
            if(!/^#[0-9a-f]{6}$/i.test(r)||r!==pal[tokRef(v)])
              misses.push(k+'.'+p+'->'+r);
          });
        });
        out[t.id]=misses;
      });
      console.log(JSON.stringify(out));
    """)
    assert all(v == [] for v in got.values()), got


def test_business_is_slate_boxes_under_deep_blue_headings():
    """The user's example, resolved: body text sits on a slate box and the
    headings are deep blue, on a light page."""
    got = _run("""
      var t=COLOUR_THEMES.filter(function(t){return t.id==='business';})[0];
      var pal=themePalette(t);
      console.log(JSON.stringify({
        bodyBg:tokValIn(t.styles.body.bg,pal),
        h1:tokValIn(t.styles.h1.color,pal),
        page:pal.page}));
    """)
    body_bg, h1, page = got["bodyBg"], got["h1"], got["page"]
    # slate: a desaturated mid-grey with a touch of blue
    r, g, b = (int(body_bg[i:i + 2], 16) for i in (1, 3, 5))
    assert b >= r and abs(r - g) < 20 and 150 < (r + g + b) / 3 < 235, body_bg
    # deep blue: blue dominates and the whole is dark
    r, g, b = (int(h1[i:i + 2], 16) for i in (1, 3, 5))
    assert b > r + 30 and b > g and (r + g + b) / 3 < 110, h1
    assert _lum(page) > 0.7, "a light page"


def test_every_theme_reads():
    """The point of shipping a palette rather than a mood: the heading on
    its page, and the body on its box, must clear 4.5:1 in every built-in
    theme. Checked from the resolved hexes, not eyeballed."""
    got = _run("""
      console.log(JSON.stringify(COLOUR_THEMES.map(function(t){
        var pal=themePalette(t);
        function ground(st){var g=t.styles[st].bg;
          return (g&&g!=='none')?tokValIn(g,pal):pal.page;}
        return {id:t.id,
          h1:[tokValIn(t.styles.h1.color,pal),ground('h1')],
          body:[tokValIn(t.styles.body.color,pal),ground('body')],
          caption:[tokValIn(t.styles.caption.color,pal),ground('caption')]};
      })));
    """)
    for t in got:
        for role in ("h1", "body"):
            ink, ground = t[role]
            assert _contrast(ink, ground) >= 4.5, (t["id"], role, ink, ground)
        ink, ground = t["caption"]
        assert _contrast(ink, ground) >= 3.0, (t["id"], "caption", ink, ground)


# --------------------------------------------------------- the doors


def test_applying_a_theme_touches_colour_and_nothing_else(out):
    """The type -- size, weight, face -- is the set's. A theme writes or
    clears exactly color, bg and bdc on every ROOT style and leaves a
    variation's own delta alone (T292)."""
    body = out.split("function applyColourTheme(id){")[1].split("\n  }")[0]
    assert "    pres.tokens=deep(t.tokens||{});" in body
    assert "      if(parentOf(k)) return;" in body
    assert "      ['color','bg','bdc'].forEach(function(p){" in body
    assert "        if(src&&src[p]) rec[p]=src[p]; else delete rec[p];});" in body
    assert "    return restyleAll(null);" in body
    # ...and the page follows the theme
    assert "    if(t.page) pres.pageBg=t.page; else delete pres.pageBg;" in body


def test_a_saved_theme_carries_the_resolved_palette(out):
    """Every name present even on a deck that only ever changed one, so a
    theme made here means the same thing on the next deck."""
    body = out.split("function saveColourTheme(nm){")[1].split("\n  }")[0]
    assert "tokens:{c:tokens().c,rad:tokens().rad," in body
    assert "      page:pres.pageBg||''," in body
    assert "var THEMEKEY='jv-deck-colours:';" in out


def test_the_gallery_has_two_bands_and_a_door_on_the_row(out):
    """Type and colour, chosen independently -- Editorial type under
    Business colours is one click each rather than a card that does not
    exist. And the gallery is one button from the Text tab now, where it
    used to hide as the first row of the Text styles menu."""
    html = assets.deck_html()
    assert '<div class="ss-band">Type</div>' in html
    assert '<div class="ss-band">Colour themes</div>' in html
    assert 'id="ss-cgrid"' in html and 'id="ss-csave"' in html
    assert 'id="dsg-sets"' in html
    assert "COLOUR_THEMES.forEach(function(t){cg.appendChild(themeCard(t));});" in out
    assert "    var rb=$('#dsg-sets');" in out
    # every ribbon layout lists it in the type group
    # T325 put the Citations door between the two (a deck's references
    # are a deck-wide thing, like its style sets and its tokens)
    assert out.count(
        "items:['dsg-sets','dsg-cites','dsg-stylewrap','dsg-tokens'") >= 7
    # and the Design screen, whose job is "what is the standard", can pick one
    assert 'id="dg-sets">' in out


def test_a_theme_card_is_painted_with_its_own_palette(out):
    """tokValIn, not tokVal: the deck's current palette is exactly what a
    preview must not use."""
    body = out.split("function themeCard(t){")[1].split("\n    }")[0]
    assert "      var pal=themePalette(t);" in body
    assert "l1.style.color=tokValIn(hd.color||'@heading',pal);" in body
    assert "tokVal(" not in body


def test_the_deck_colour_row_offers_every_token(out):
    """quickRow iterated TOKENS_DEFAULT.c; the deck's own palette is what
    a box should be offered."""
    body = out.split("function quickRow(){")[1].split("\n  }")[0]
    assert "Object.keys(tokens().c).forEach(function(k){" in body
