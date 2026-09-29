"""T527: no native dialogs.

The 2026-09-29 audit caught "OK replaces it ... Cancel keeps both" -- a
browser confirm() whose buttons meant the opposite of their words -- and
a sweep found seventeen confirm() calls in the editor and twenty-five
alert() calls and a prompt() in the notebook app. Every one of them now
asks through the editor's own dialog (T475's askText), which learned a
yes/no shape (askYes: verbs on the buttons, red for a verb that destroys)
and a notice shape (askTell: one button). The dialog moves to the page
body while the editor is hidden, so a question asked from the library or
a notebook is asked where you are looking.

Driven live: File > Delete presentation asks "Delete ...?" with "Keep it"
/ "Delete presentation" (red), Escape keeps the deck; a notice with the
editor closed lands in <body> over the notebook; an import of a deck
that is already here asks "Replace it" / "Keep both" and each does what
it says.
"""

from __future__ import annotations

import re
from pathlib import Path

ASSETS = Path(__file__).resolve().parent.parent / "src" / "junoview" \
    / "assets" / "js"


def _code(src: str) -> str:
    """The source with block and line comments removed."""
    src = re.sub(r"/\*.*?\*/", "", src, flags=re.S)
    return re.sub(r"(?m)^\s*//.*$", "", src)


def test_no_confirm_alert_or_prompt_is_called_anywhere():
    files = [ASSETS / "app.js", ASSETS / "web-runtime.js",
             *sorted((ASSETS / "deck").glob("*.js"))]
    for f in files:
        code = _code(f.read_text(encoding="utf-8"))
        for fn in ("confirm", "alert", "prompt"):
            hits = re.findall(r"(?<![A-Za-z_$.])" + fn + r"\(", code)
            hits += re.findall(r"window\." + fn + r"\(", code)
            assert not hits, f"{f.name} still calls {fn}()"


def test_the_dialog_has_a_yes_no_and_a_notice_shape(out):
    ask = out.split("  function askText(o,cb){")[1].split("\n  }\n")[0]
    assert "askHost(dlg);" in ask
    assert "var yes=!!(o.yes||o.tell);" in ask
    assert "okb.classList.toggle('dbtn-warn',!!o.danger);" in ask
    assert "cnb.textContent=o.cancel||'Cancel';cnb.hidden=!!o.tell;" in ask
    assert "var field=yes?okb:" in ask
    assert "  function askYes(o,cb){" in out
    assert "function(v,why){cb(why==='alt'?'alt':v!==null);});" in out
    assert "  function askTell(o,cb){" in out


def test_the_question_goes_where_you_are_looking(out):
    host = out.split("  function askHost(dlg){")[1].split("\n  }\n")[0]
    assert "var host=(deckEl&&!deckEl.hidden)?deckEl:document.body;" in host
    assert "if(dlg.parentNode!==host) host.appendChild(dlg);" in host
    # and the notebook side reaches it through the deck's exports
    assert "  window.SemAsk=askText;\n  window.SemAskYes=askYes;\n" \
        "  window.SemAskTell=askTell;" in out
    assert "  function jvTell(msg){" in out
    assert "window.SemAskTell({title:title,what:msg});" in out


def test_an_import_asks_before_it_lands_and_never_asks_itself(out):
    assert "  function importDeckTextAsk(txt){" in out
    assert "ok:'Replace it',cancel:'Keep both',danger:true}" in out
    assert "res(importDeckText(txt,false,y===true?'replace':'keep'));" in out
    assert "        if(choice==='replace'){" in out
    # a deck made from the notebook is always new: never a question
    assert "importDeckText(JSON.stringify({presentations:[pr]}),false,'keep');" \
        in out


def test_deleting_a_presentation_is_one_red_question(out):
    fn = out.split("  function askDeleteDeck(nm,go){")[1].split("\n  }\n")[0]
    assert "ok:'Delete presentation',cancel:'Keep it',danger:true}" in fn
    assert out.count("askDeleteDeck(") >= 4   # declaration + three doors
    assert ".ask-dlg .dbtn.primary.dbtn-warn{background:var(--danger);" in out


def test_the_question_box_is_its_own_width(out):
    assert ".aa-box.ask-box{width:min(460px,94vw);}" in out
    assert ".ask-dlg.ask-yes .aa-what{white-space:pre-line;}" in out
