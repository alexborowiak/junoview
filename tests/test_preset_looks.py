"""Ready-made looks under every heading, one click each (T317).

The user, 2026-09-06: "there should be some that already exist, like
'business', 'exciting', or something like that idk, and some that have
different colours per section".

A preset is a VARIATION that does not exist until it is asked for. Each
row in the Text styles menu names a delta; the first click mints the
variation with exactly that delta and stamps the box; from then on it is
an ordinary variation with a rail row and a chip, following its parent for
everything the delta does not say. Nothing is added to a deck that never
clicks. Every colour is a '@name' reference, so a preset resolves against
whatever colour theme the deck wears rather than fixing a hex.
"""

from __future__ import annotations

import json
import re
import subprocess
import tempfile
from pathlib import Path

import pytest

from junoview import assets


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
    pre = (_const(src, "STYLE_FIELDS") + "\n" + _const(src, "PRESET_LOOKS")
           + "\n" + lift_fn(src, "tokRef") + "\n")
    with tempfile.TemporaryDirectory() as d:
        p = Path(d) / "run.js"
        p.write_text(pre + script, encoding="utf-8")
        r = subprocess.run(cmd + [str(p)], capture_output=True, text=True,
                           encoding="utf-8", env=env, timeout=60)
        assert r.returncode == 0, r.stderr[:2000]
        return json.loads([ln for ln in r.stdout.splitlines()
                           if ln.startswith("{") or ln.startswith("[")][-1])


def test_every_preset_says_only_what_a_style_can_say():
    """A delta key outside STYLE_FIELDS would be written onto the type
    and never baked -- a preset that looks like it did something."""
    got = _run("""
      var bad=[];
      PRESET_LOOKS.forEach(function(l){
        Object.keys(l.delta).forEach(function(k){
          if(STYLE_FIELDS.indexOf(k)<0) bad.push(l.id+'.'+k);});
      });
      console.log(JSON.stringify({bad:bad,
        ids:PRESET_LOOKS.map(function(l){return l.id;})}));
    """)
    assert got["bad"] == [], got["bad"]
    ids = got["ids"]
    assert len(ids) == len(set(ids))
    # the user's two words, and the one that varies by section
    assert {"business", "exciting", "by-section"} <= set(ids)


def test_a_preset_never_fixes_a_hex():
    """Every colour is a reference, so "Business" under Paper colours is
    Paper's heading and box, not a slate that ignores the theme."""
    got = _run("""
      var bad=[];
      PRESET_LOOKS.forEach(function(l){
        ['color','bg','bdc'].forEach(function(p){
          var v=l.delta[p];
          if(v&&v!=='none'&&!tokRef(v)) bad.push(l.id+'.'+p+'='+v);});
      });
      console.log(JSON.stringify(bad));
    """)
    assert got == [], got


def test_a_preset_is_a_variation_made_on_first_click(out):
    """addVariant with exactly the delta; a second click on the same row
    finds the one already made by (parent, label) rather than minting a
    twin."""
    assert "  function ensurePresetLook(base,look){" in out
    assert "    var have=presetVariantOf(base,look);\n    if(have) return have;" in out
    assert "    var v=addVariant(look.label,base);" in out
    assert "    deckStyles()[v.id]=deep(look.delta);" in out
    # and a row is not offered for a look the deck already has
    assert "          if(presetVariantOf(base,look)) return;" in out


def test_the_rows_sit_under_each_heading_family(out):
    """Drawn as specimens in the colours they would resolve to on THIS
    deck, after the family's own variations, and only for headings."""
    assert "        if(isHeadingStyle(id)) presetRows(id);" in out
    assert "          var col=tokVal(dd.color||d.color||'');" in out
    assert "          specimenGround(t,{bg:dd.bg,bdc:dd.bdc});" in out
    # 'By section' is offered only once the deck has a section to follow
    assert ("          if(look.id==='by-section'\n"
            "             &&!(pres.sections&&Object.keys(pres.sections).length)) "
            "return;") in out
    # an offer looks like an offer
    assert ".jv-preset{border-style:dashed;opacity:.92;}" in out
