"""T544: Clear formatting and Change case.

PowerPoint's eraser (Ctrl+Space) and its Aa (Shift+F3 steps through the
cases), in the Style tab's Font group as one column: Case over Clear.
Both act on the highlighted words while you type and on the whole box
otherwise -- the rule B, I and U already keep (T290). A whole box goes
back to the text style it wears (Body when it wears none); a paragraph's
alignment, spacing and bullets, and the box's own fill, are not
formatting of the words and stay.

Driven at 1440x900 on a fixture deck: Clear on a bold italic red serif
title put it back to size 6 and nothing else; Shift+F3 on it went UPPER,
lower, Capitalise Each Word, and Ctrl+Z stepped back one; Capitalise
Each Word on "see {fig:a} and $\\alpha x$ at https://example.com/Path
don't stop" left the field, the maths, the address and "Don't" intact;
Clear on a Heading 1 blown up to 6, red, serif and underlined gave back
Heading 1 (5, bold); typing in a rich box, Ctrl+Space on "Southern
hemisphere" took its bold and red and kept the highlighter beside it,
and the highlight stayed; Shift+F3 and the Case door acted on the
highlighted words only and kept them highlighted; Ctrl+Space with a
bare caret in an unstyled green box put it back to Body with the caret
where it was; Sentence case on a rich box, a bullet list and a Markdown
box kept the bold, the items, the code and the link.
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

_FNS = ("caseIsLetter", "caseWordStart", "caseMarks", "caseChar",
        "caseString", "caseNext")


def _case_keep(src: str) -> str:
    """the pattern's own strings are full of unbalanced brackets, so it
    is cut by its known ending rather than by counting them"""
    m = re.search(r"var CASE_KEEP=new RegExp\(.*?\]\.join\('\|'\),'g'\);",
                  src, re.S)
    assert m
    return m.group(0)


def _run(calls: list[list[str]]):
    from helpers_js import js_engine, lift_fn
    eng = js_engine()
    if eng is None:
        return None
    cmd, env = eng
    src = assets.deck_js()
    body = _case_keep(src) + "\n" + "\n".join(
        lift_fn(src, f) for f in _FNS)
    script = (body + "\nconst calls=" + json.dumps(calls) + ";\n"
              "console.log(JSON.stringify(calls.map(c => c[0]==='next'"
              " ? caseNext(c[1]) : caseString(c[1], c[0]))));\n")
    with tempfile.TemporaryDirectory() as d:
        p = Path(d) / "run.js"
        p.write_text(script, encoding="utf-8")
        # utf-8, not the Windows code page: an answer holds a ß
        r = subprocess.run(cmd + [str(p)], capture_output=True,
                           encoding="utf-8", env=env, timeout=60)
        assert r.returncode == 0, r.stderr[:2000]
        line = [ln for ln in r.stdout.splitlines() if ln.startswith("[")][-1]
        return json.loads(line)


CASES = [
    (["upper", "hello World"], "HELLO WORLD"),
    (["lower", "Hello WORLD"], "hello world"),
    (["toggle", "Hello"], "hELLO"),
    (["title", "don't STOP me now"], "Don't Stop Me Now"),
    (["title", "well-known fact"], "Well-Known Fact"),
    (["sentence", "HELLO world. THIS is it! and more?\nnew line"],
     "Hello world. This is it! And more?\nNew line"),
    (["sentence", "2nd PLACE"], "2nd place"),
    # what upper-casing would break stays exactly as typed
    (["upper", "see {fig:a} and $\\alpha x$ at https://Ex.com/Path"],
     "SEE {fig:a} AND $\\alpha x$ AT https://Ex.com/Path"),
    (["upper", "as in [@Smith2020] and `np.mean` we"],
     "AS IN [@Smith2020] AND `np.mean` WE"),
    (["upper", "a [link](http://x.org/Up) here"],
     "A [LINK](http://x.org/Up) HERE"),
    # a mapping that would change the length leaves the letter alone
    (["upper", "straße"], "STRAßE"),
    # Shift+F3: lowercase -> Capitalise Each Word -> UPPERCASE -> lowercase
    (["next", "abc def"], "title"),
    (["next", "Abc Def"], "upper"),
    (["next", "Abc def"], "upper"),
    (["next", "ABC DEF"], "lower"),
]


def test_the_cases_run():
    got = _run([c[0] for c in CASES])
    if got is None:
        pytest.skip("no JS engine")
    for (args, want), g in zip(CASES, got, strict=True):
        assert g == want, (args, g, want)


def test_the_column_in_the_font_group(out):
    deck = assets.deck_html()
    font = deck.split('<span class="rbn-grp rbn-fontgrp"')[1].split(
        '<span class="rbn-lab">Font</span>')[0]
    # after the size, before the colours: Case over Clear
    assert font.index('id="fmt-sizecell"') < font.index('id="fmt-casewrap"') \
        < font.index('id="fmt-clear"') < font.index('id="fmt-txcolwrap"')
    assert '<i data-ic="textcase"></i>' in font
    assert '<i data-ic="eraser"></i>' in font
    assert 'id="fmt-case-menu"' in font and 'data-close="1"' in font
    assert icon_svg("textcase") and icon_svg("eraser")   # both are drawn
    assert "+'#fmt-casewrap #fmt-case-btn #fmt-case-menu #fmt-clear '" in out
    assert "show('#fmt-clear',isText);" in out
    assert "if(id==='fmt-case-menu') return buildCaseRows;" in out
    assert "caseClearBoot();" in out
    # ...and on the mini toolbar, which T536 left a place for: driven,
    # its Clear stripped a highlighted bold-and-red run and kept it lit
    assert "['#fmt-clear','Clear','Clear the highlighted words" in out


def test_clear_goes_back_to_the_style(out):
    fn = out.split("  function clearBoxLook(a,which){")[1].split("\n  }\n")[0]
    assert "var d=styleDef(a.style&&styleDef(a.style)?a.style:'body')||{};" \
        in fn
    assert "delete a.u;delete a.strike;" in fn
    # the lines and the lists stay; every inline look goes
    assert "var r=sanitizeRich(plainRuns(p.h));" in fn
    assert "var PLAIN_DROP={b:1,strong:1,i:1,em:1,u:1,s:1,strike:1,sup:1," \
        "sub:1,\n    font:1,span:1};" in out
    run = out.split("  function clearRunSelection(){")[1].split("\n  }\n")[0]
    assert "document.execCommand('removeFormat',false,null);" in run


def test_the_keys(out):
    key = out.split("  function pptTextKey(e){")[1].split("\n  }\n")[0]
    assert "if(e.key==='F3'&&e.shiftKey&&!e.ctrlKey&&!e.metaKey&&!e.altKey)" \
        "\n      return applyCase('next');" in key
    assert "return !!(cb&&!cb.hidden)&&pptClick('#fmt-clear');" in key
    edit = out.split("  function pptEditKey(e){")[1].split("\n  }\n")[0]
    assert "if(e.key==='F3'&&e.shiftKey&&!ctrl&&!e.altKey&&pptTextish())" \
        in edit
    helptext = assets.load("html/help.html")
    assert "<kbd>Ctrl</kbd>+<kbd>Space</kbd>" in helptext
    assert "<kbd>Shift</kbd>+<kbd>F3</kbd>" in helptext


def test_typing_keeps_its_highlight(out):
    """a case change rewrites text nodes in place and puts the highlight
    back, so Shift+F3 can go round again; a title types as plain text
    and is included"""
    fn = out.split("  function applyCase(mode){")[1].split("\n  }\n")[0]
    assert "var el=liveTextEditable();" in fn
    assert "caseDom(el,mode,rg);" in fn
    assert "caretPut(el,at);" in fn
    dom = out.split("  function caseDom(root,mode,range){")[1].split(
        "\n  }\n")[0]
    assert "edits.forEach(function(x){x[0].nodeValue=x[1];});" in dom
    keep = out.split("  function keepTyping(fn){")[1].split("\n  }\n")[0]
    assert "var el=liveTextEditable();" in keep
