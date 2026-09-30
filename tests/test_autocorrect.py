"""T545: AutoCorrect as you type.

Straight quotes curl, -- is an en dash (a third hyphen an em dash),
(c) (r) (tm) are the signs, ... an ellipsis, -> <- => <=> arrows. Each
happens as its last character is typed, through the browser's own
insertText, so Ctrl+Z straight after puts back what was typed. Never in a
Markdown box, a mono (code) box or an equation, nor inside $maths$ or
`code` on the line being typed. One switch, Text > AutoCorrect, kept in
this browser; the first correction ever says so and offers to turn it off.

Driven at 1440x900 with one input event per character: `start "hi" --
it's (c) -> x...` became `start “hi” – it’s © → x…`; Ctrl+Z straight
after `a--` gave back `a--`; `$f'(x)->$ it's` kept the prime and the arrow
inside the maths and curled the apostrophe after it; a table cell took
`(r) =>` to `® ⇒`; with the tile off, `--"` stayed as typed; the first
correction's toast button turned it off and lit the tile down.
"""

from __future__ import annotations

import json
import re
import subprocess
import tempfile
from pathlib import Path

import pytest

from junoview import assets
from junoview.branding import icon_svg

_FNS = ("acQuote", "acGuarded", "acRule")


def _rules(src: str) -> str:
    m = re.search(r"var AC_RULES=\[.*?\]\];", src, re.S)
    assert m
    return m.group(0)


def _run(calls: list[list[str]]):
    from helpers_js import js_engine, lift_fn
    eng = js_engine()
    if eng is None:
        return None
    cmd, env = eng
    src = assets.deck_js()
    body = _rules(src) + "\n" + "\n".join(lift_fn(src, f) for f in _FNS)
    script = (body + "\nconst calls=" + json.dumps(calls) + ";\n"
              "console.log(JSON.stringify(calls.map(c => c[0]==='rule'"
              " ? acRule(c[1]) : acGuarded(c[1]))));\n")
    with tempfile.TemporaryDirectory() as d:
        p = Path(d) / "run.js"
        p.write_text(script, encoding="utf-8")
        r = subprocess.run(cmd + [str(p)], capture_output=True,
                           encoding="utf-8", env=env, timeout=60)
        assert r.returncode == 0, r.stderr[:2000]
        line = [ln for ln in r.stdout.splitlines() if ln.startswith("[")][-1]
        return json.loads(line)


CASES = [
    (["rule", "x--"], [2, "–"]),
    (["rule", "x–-"], [2, "—"]),           # a third hyphen
    (["rule", "(c)"], [3, "©"]),
    (["rule", "(R)"], [3, "®"]),
    (["rule", "(tm)"], [4, "™"]),
    (["rule", "wait..."], [3, "…"]),
    (["rule", "a->"], [2, "→"]),
    (["rule", "a–>"], [2, "→"]),            # --> after the dash
    (["rule", "a<-"], [2, "←"]),
    (["rule", "a=>"], [2, "⇒"]),
    (["rule", "a<=>"], [3, "⇔"]),                # not =>
    (["rule", "\""], [1, "“"]),                  # a line's start
    (["rule", "say \""], [1, "“"]),
    (["rule", "hi\""], [1, "”"]),
    (["rule", "it'"], [1, "’"]),
    (["rule", "(\""], [1, "“"]),
    (["rule", "a '"], [1, "‘"]),
    (["rule", "a-"], None),
    (["rule", "plain."], None),
    (["guard", "$f'"], True),                         # inside maths
    (["guard", "$x$ it'"], False),
    (["guard", "`a'"], True),                         # inside code
    (["guard", "\\(x'"], True),
    (["guard", "costs \\$5 it'"], False),             # a dollar sign
]


def test_the_rules_run():
    got = _run([c[0] for c in CASES])
    if got is None:
        pytest.skip("no JS engine")
    for (args, want), g in zip(CASES, got, strict=True):
        assert g == want, (args, g, want)


def test_it_is_a_part_and_it_boots(out):
    assert "22-autocorrect" in assets.DECK_PARTS
    assert "acBoot();" in out
    fn = out.split("  function autoCorrect(el,e,a){")[1].split("\n  }\n")[0]
    assert "if(!e||e.inputType!=='insertText'||e.isComposing) return false;" \
        in fn
    assert "if(a&&(a.md||a.maths||a.font==='mono')) return false;" in fn
    # the browser's own edit, so Ctrl+Z straight after puts it back
    assert "document.execCommand('insertText',false,hit[1]);" in fn


def test_every_box_and_cell_is_corrected(out):
    assert "autoCorrect(el,e,s5&&annotByIdx(s5,idx));" in out
    assert "autoCorrect(td,e,a);      /* T545: a cell is typed in too */" \
        in out


def test_one_switch_on_the_row(out):
    deck = assets.deck_html()
    grp = deck.split('<span class="rbn-grp rbn-typing" data-tab="text"')[1]
    grp = grp.split('<span class="rbn-lab">Typing</span>')[0]
    assert 'id="tx-autocorrect"' in grp and 'aria-pressed="true"' in grp
    assert '<i data-ic="autocorrect"></i><span>AutoCorrect</span>' in grp
    assert icon_svg("autocorrect")
    assert ".rbn-typing{order:7;}" in assets.load("css/deck.css")
    # every ribbon layout places it with the deck's text, none leaves it
    # to a catch-all
    lays = assets.load("js/deck/07-ribbon-layouts.js")
    assert lays.count("'dsg-tokens','dsg-layout','tx-autocorrect'") == 8
    assert "var AC_KEY='jv-autocorrect',AC_TOLD='jv-autocorrect-told';" in out
    assert "'Turn AutoCorrect off'" in out
    helptext = assets.load("html/help.html")
    assert "<b>AutoCorrect</b> tidies as you type" in helptext
