"""A type based on a heading IS a heading (T291).

`isHeadingStyle` answers for the built-in four out of the HEADING_STYLES
LITERAL, so `STYLE_DEFAULTS.title/h1/h2/h3` carry no `head` key. But
`addCustomType` builds a new type by copying STYLE_FIELDS -- which
includes `head` -- off its base. There was nothing there to copy, so a
type based on Heading 1 came out with `head` undefined and
`isHeadingStyle` said false.

It then dropped out of the outline (`headLevel`), out of "apply to all
headings" (`headingStyles`), out of the talk panel's heading size bucket
(`talkVarFor`) and out of standardise's heading rule -- silently, until
you found the "Heading" toggle in the style editor. The comment above
`addCustomType` has claimed the opposite since 2026-08-22.

This test RUNS the shipped code rather than describing it. A substring
assertion could not have caught this: every line involved reads
correctly on its own, and the bug is that one of them had nothing to
find. The suite has `helpers_js.lift_fn` for exactly this and barely
uses it.
"""

from __future__ import annotations

import json
import re
import subprocess
import tempfile
from pathlib import Path

import pytest

from junoview import assets

# the closure this question lives in: constants, then functions.
# BUILTIN_STYLE_IDS leads because STYLE_ORDER is `BUILTIN_STYLE_IDS.slice()`
# -- the IIFE evaluates these in source order and so must this.
_CONSTS = ("BUILTIN_STYLE_IDS", "STYLE_FIELDS", "STYLE_DEFAULTS",
           "STYLE_ORDER", "HEADING_STYLES")
_FNS = ("customTypes", "deckStyles", "parentOf", "styleChain",
        "styleDef", "syncCustomTypes", "styleOrder", "isHeadingStyle",
        "headingStyles", "mintTypeId", "addCustomType", "addVariant",
        "isVariantOf", "variantsOf", "styleRoot", "applyStyleTo")


def _const(src: str, name: str) -> str:
    """One `var NAME=...;` declaration, by bracket depth."""
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


def _prelude() -> str:
    from helpers_js import lift_fn
    src = assets.deck_js()
    parts = [_const(src, c) for c in _CONSTS]
    parts += [lift_fn(src, f) for f in _FNS]
    return "var pres={};\n" + "\n".join(parts) + "\n"


def _run(script: str):
    from helpers_js import js_engine
    eng = js_engine()
    if eng is None:
        return None
    cmd, env = eng
    with tempfile.TemporaryDirectory() as d:
        p = Path(d) / "run.js"
        p.write_text(_prelude() + script, encoding="utf-8")
        r = subprocess.run(cmd + [str(p)], capture_output=True, text=True,
                           env=env, timeout=60)
        assert r.returncode == 0, r.stderr[:3000]
        line = [ln for ln in r.stdout.splitlines()
                if ln.startswith(("{", "["))][-1]
        return json.loads(line)


SCRIPT = """
var out={};
[['h1','navy'],['h2','section'],['title','big'],['h3','sub'],
 ['body','quote'],['caption','note'],['small','aside']].forEach(function(p){
  pres={};
  var t=addCustomType(p[1],p[0]);
  out[p[0]]={head:!!t.head,
             isHeading:isHeadingStyle(t.id),
             inHeadingStyles:headingStyles().indexOf(t.id)>=0,
             baseIsHeading:isHeadingStyle(p[0])};
});
console.log(JSON.stringify(out));
"""


def test_a_type_based_on_a_heading_is_a_heading():
    got = _run(SCRIPT)
    if got is None:
        pytest.skip("no node or VS Code Electron on this machine")
    for base, r in got.items():
        assert r["isHeading"] == r["baseIsHeading"], (
            f"a type based on {base!r} answers isHeadingStyle="
            f"{r['isHeading']} but its base answers {r['baseIsHeading']}")
        # ...and the list "apply to all headings" walks agrees with it
        assert r["inHeadingStyles"] == r["baseIsHeading"], base

    # spelled out, so the regression is legible without running anything
    assert got["h1"]["isHeading"] is True
    assert got["h2"]["isHeading"] is True
    assert got["title"]["isHeading"] is True
    assert got["h3"]["isHeading"] is True
    assert got["body"]["isHeading"] is False
    assert got["caption"]["isHeading"] is False


def test_it_is_asked_of_the_predicate_not_of_the_field(out):
    """So the copy loop and isHeadingStyle can never disagree again."""
    assert "    if(isHeadingStyle(base)) t.head=1;" in out
