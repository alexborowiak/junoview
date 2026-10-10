"""The speed guard's cheap half: the patterns that made the app lag, held
shut in the ordinary suite (2026-10-10).

Speed regressed twice, quietly, one feature at a time ("really laggy
AGAIN"). The speed work of 2026-10-09 traced most of it to a handful of
patterns, each innocent in the line that adds it and each paid on every
gesture after:

* a page-wide selector scan -- ``[contenteditable]`` to find the box
  being typed in, ``.vo-fmenu`` to close a code-trail menu -- walks every
  element of every open notebook (13-40k nodes) on every render, save,
  slide change or click: 4-11 ms a time at 4x. The open editors and the
  menus are kept in registries as they are made (liveEditors,
  voMenusLive), so nothing ever needs to ask the whole page;
* renderFilm emptied the slide strip and built all its rows again after
  every edit: 150-290 ms at 4x on a 60-slide deck, for one changed row.
  Rows are kept and the list is reconciled (filmReconcile);
* MathJax typeset the whole document in one long task, and two callers
  typesetting at once corrupted each other's output. Every call goes
  through app.js's one typesetter, jvMath;
* body/html :has() rules re-walked the whole document after any change.
  That one is held in tests/test_style_recalc.py, with the rest of the
  style-recalc rules.

These read the shipped source, which is what drifts. The other half,
tests/test_speed_guard_in_a_browser.py (opt-in), times the gestures
themselves against a budget. CONTRIBUTING.md, "The speed guard", says
what to do when either fails.
"""

from __future__ import annotations

import re
from pathlib import Path

from helpers_js import lift_fn
from junoview import assets

JS_DIR = Path(assets.__file__).resolve().parent / "js"


def _blank_comments(js: str) -> str:
    """Block comments to spaces, so offsets and lines still line up; the
    codebase's comments are all /* */ and they quote the old code."""
    return re.sub(r"/\*.*?\*/", lambda m: re.sub(r"[^\n]", " ", m.group(0)),
                  js, flags=re.S)


def _sources() -> dict[str, str]:
    """Every script the app ships: the deck as it is assembled (a part
    alone does not parse), and each file beside it."""
    out = {"deck (assembled)": assets.deck_js()}
    for f in sorted(JS_DIR.glob("*.js")):
        out[f.name] = f.read_text(encoding="utf-8")
    assert "app.js" in out and len(out) >= 5
    return out


def _args(js: str, open_at: int) -> list[str]:
    """The top-level arguments of the call whose '(' is at open_at."""
    depth, k, quote, cur, args = 0, open_at, None, "", []
    while k < len(js):
        c = js[k]
        if quote:
            cur += c
            if c == "\\":
                cur += js[k + 1]
                k += 1
            elif c == quote:
                quote = None
        elif c in "'\"`":
            quote = c
            cur += c
        elif c in "([{":
            depth += 1
            if depth > 1:
                cur += c
        elif c in ")]}":
            depth -= 1
            if depth == 0:
                return args + [cur.strip()]
            cur += c
        elif c == "," and depth == 1:
            args.append(cur.strip())
            cur = ""
        else:
            cur += c
        k += 1
    raise AssertionError("unbalanced call")


# a query over the whole document: document's own, or the $/$$ helpers
# (app.js, deck 00-page) with no root argument -- they default to document
DOC_QUERY = re.compile(
    r"\bdocument(?:\s*\.\s*(?:body|documentElement))?\s*\.\s*"
    r"(?:querySelector(?:All)?|getElementsByClassName)\s*(?=\()"
    r"|(?<![\w.$])\$\$?\s*(?=\()")
HOT = ("contenteditable", "vo-fmenu")
# a root that is no root: the $/$$ helpers fall back to (or are handed)
# the whole document
NO_ROOT = re.compile(r"(?:window\s*\.\s*)?document(?:\s*\.\s*(?:body|"
                     r"documentElement))?|null|undefined|void\s+0")


def page_wide_scans(js: str) -> list[str]:
    """The document-wide queries in `js` whose selector names one of HOT
    (attribute names match in any case: [contentEditable] is the same
    query)."""
    code = _blank_comments(js)
    found = []
    for m in DOC_QUERY.finditer(code):
        # (no selector is longer than this: a call that names neither
        # is not parsed at all, regex literals and all)
        if not any(h in code[m.end():m.end() + 300].lower() for h in HOT):
            continue
        args = _args(code, m.end())
        rooted = (m.group(0).startswith("$") and len(args) > 1
                  and not NO_ROOT.fullmatch(args[1]))
        if args and not rooted and any(h in args[0].lower() for h in HOT):
            found.append(code[m.start():m.end()] + "(" + ",".join(args) + ")")
    return found


def test_the_scan_finder_finds_scans():
    """The finder itself, on the spellings a scan comes back in."""
    bad = ("document.querySelectorAll('[contenteditable]')",
           'document.querySelector("[contenteditable=true]")',
           "document.body.querySelectorAll('.an-text[contenteditable]')",
           "$$('[contenteditable=\"true\"]')",
           "$('#deck [contenteditable]')",
           "$$('.vo-fmenu:not([hidden])').forEach(f)",
           "document.getElementsByClassName('vo-fmenu')",
           "$$('[contenteditable='+v+']')",
           "x=$$( '.vo-fmenu' );",
           "document.querySelectorAll('[contentEditable=\"true\"]')",
           "$$('[contenteditable]',document)",
           "$$('.vo-fmenu', document.body)")
    for line in bad:
        assert page_wide_scans(line), line
    ok = ("$$('[id],[contenteditable],[data-idx]',gl)",
          "layer.querySelectorAll('[contenteditable]')",
          "$$('.vo-fmenu',v)",
          "el.matches('[contenteditable]')",
          "/* was document.querySelectorAll('[contenteditable]') */",
          "document.querySelectorAll('.an-item')",
          "q.$$('[contenteditable]')")
    for line in ok:
        assert not page_wide_scans(line), line


def test_no_page_wide_editor_or_menu_scans_in_any_script():
    """The open editors are liveEditors() and the code-trail menus are
    voMenusLive(): kept as they are made, so nothing asks the page."""
    for name, js in _sources().items():
        assert not page_wide_scans(js), (name, page_wide_scans(js))
    deck = assets.deck_js()
    # ...and the two registries are what the hot paths ask instead
    flush = lift_fn(deck, "flushTextEdits")
    assert "var live=liveEditors();" in flush
    assert "voMenusLive().forEach(function(m){" in deck
    assert "voMenuKeep(menu);" in lift_fn(deck, "traceFilterDropdown")


# the strip's list, by either helper and either quote
FILM_SPELLED = (r"(?:\$|document\s*\.\s*querySelector)\(\s*['\"]#film-list"
                r"['\"]\s*\)",
                r"getElementById\(\s*['\"]film-list['\"]\s*\)")
FILM_LIST = re.compile(r"\b(\w+)\s*=\s*(?:" + FILM_SPELLED[0]
                       + r"|document\s*\.\s*" + FILM_SPELLED[1] + r")")
EMPTYING = (r"\.innerHTML\s*=(?!=)", r"\.textContent\s*=(?!=)",
            r"\.innerText\s*=(?!=)", r"\.replaceChildren\s*\(",
            r"\.outerHTML\s*=(?!=)")


def _rest_of_block(js: str, i: int) -> str:
    """From i to the brace that closes the block i is in: everywhere a
    variable declared at i can be seen."""
    depth = 0
    for k in range(i, len(js)):
        if js[k] == "{":
            depth += 1
        elif js[k] == "}":
            depth -= 1
            if depth < 0:
                return js[i:k]
    return js[i:]


def strip_emptied(js: str) -> list[str]:
    """Every name the slide strip's list is given in `js`, with what
    empties it wholesale afterwards in the same block."""
    code = _blank_comments(js)
    found = []
    for m in FILM_LIST.finditer(code):
        v, rest = m.group(1), _rest_of_block(code, m.end())
        for pat in EMPTYING + (
                r"\s*\.removeChild\(\s*" + re.escape(v) + r"\.",):
            if re.search(r"\b" + re.escape(v) + pat, rest):
                found.append(f"{v}{pat}")
        if re.search(r"while\s*\(\s*" + re.escape(v)
                     + r"\.(?:first|last)(?:Element)?Child", rest):
            found.append(f"while({v}.firstChild)")
    for spelled in FILM_SPELLED:
        for pat in EMPTYING:
            if re.search(spelled + r"\s*" + pat, code):
                found.append(spelled + pat)
    return found


def test_the_strip_finder_finds_a_strip_emptied():
    for js in ("function f(){var list=$('#film-list');list.innerHTML='';}",
               "function f(){var l=$('#film-list');if(l){l.textContent='';}}",
               "function f(){var fl=document.getElementById('film-list');"
               "while(fl.firstChild) fl.removeChild(fl.firstChild);}",
               "function f(){var list=$('#film-list');list.replaceChildren();}",
               "$('#film-list').innerHTML='';",
               'function f(){var list=$("#film-list");list.innerHTML="";}',
               "function f(){var l=document.querySelector('#film-list');"
               "l.textContent='';}",
               'document.getElementById("film-list").innerHTML="";'):
        assert strip_emptied(js), js
    for js in ("function f(){var list=$('#film-list');"
               "filmReconcile(list,nodes);}",
               "function f(){var list=$('#film-list');}"
               "function g(){var list=cutList();list.innerHTML='';}",
               "/* list.innerHTML='' */ var list=$('#film-list');",
               "var list=$('#film-list');if(list.innerHTML==='') go();"):
        assert not strip_emptied(js), js


def test_renderfilm_never_empties_the_strip():
    """The strip keeps its rows: renderFilm hands filmReconcile the rows
    it wants and the list is changed by the least that gets it there.
    Emptying it -- by any spelling, anywhere -- is the 150-290 ms rebuild
    back."""
    deck = assets.deck_js()
    film = lift_fn(_blank_comments(deck), "renderFilm")
    assert "var list=$('#film-list');" in film
    assert "filmReconcile(list,nodes);" in film
    assert not strip_emptied(film)
    # filmReconcile moves rows; it never clears the list either
    rec = lift_fn(deck, "filmReconcile")
    for pat in EMPTYING:
        assert not re.search(pat, rec), pat
    # ...and nothing anywhere empties the strip's list wholesale
    for name, js in _sources().items():
        assert not strip_emptied(js), (name, strip_emptied(js))
    # (the finder saw the places that hold the list)
    assert len(FILM_LIST.findall(_blank_comments(deck))) >= 3


# MathJax's typesetting API: what can render, clear or re-render maths
MJ_CALL = re.compile(
    r"\bMathJax\s*\.\s*(?:typeset\w*|tex2\w+|texReset|mathml2\w+"
    r"|startup\s*\.\s*document\s*\.\s*\w+)\s*\(")
# the deck's three doors, each handing the job to jvMath when it is there
# and calling MathJax itself only on a page without app.js
DECK_FALLBACKS = ("typeset", "mathsRun", "afterTypeset")


def _spans(js: str, names) -> dict[str, tuple[int, int]]:
    out = {}
    for n in names:
        if js.count(f"function {n}(") == 1:
            i = js.index(f"function {n}(")
            out[n] = (i, i + len(lift_fn(js, n)))
    return out


def mathjax_outside_jvmath(name: str, js: str) -> list[str]:
    """Every MathJax typesetting call in `js` that does not go through
    jvMath: not inside it (app.js), not a fallback behind a jvMath branch
    (the deck), not a function handed to jvMath to run."""
    code = _blank_comments(js)
    allowed: list[tuple[int, int]] = []
    i = code.find("  var jvMath=(function(){") if name == "app.js" else -1
    if i >= 0:
        allowed.append((i, code.index("  window.jvMath=jvMath;", i)))
    fallbacks = {}
    if name.startswith("deck"):
        fallbacks = _spans(code, DECK_FALLBACKS)
    bad = []
    for m in MJ_CALL.finditer(code):
        at = m.start()
        # no element list, or the document's own, is the whole-document
        # typeset -- even handed to jvMath.run, which runs what it is given
        if re.match(r"MathJax\s*\.\s*typeset", code[at:]):
            first = _args(code, m.end() - 1)[0]
            if not first or re.search(r"\bdocument\b", first):
                line = code.count("\n", 0, at) + 1
                bad.append(f"{name}:{line}: whole document: "
                           f"{code[at:at + 60].strip()}")
                continue
        if any(a <= at < b for a, b in allowed):
            continue
        door = [n for n, (a, b) in fallbacks.items() if a <= at < b]
        if door:
            a, _b = fallbacks[door[0]]
            if "jvMath" in code[a:at]:
                continue
        # mathsRun(function(){return MathJax.x(...)}) / jvMath.run(...)
        if re.search(r"(?:\bmathsRun|\bjvMath\s*\.\s*run|\bM\s*\.\s*run)"
                     r"\(\s*function\s*\(\)\s*\{\s*(?:return\s+)?$",
                     code[max(0, at - 120):at]):
            continue
        line = code.count("\n", 0, at) + 1
        bad.append(f"{name}:{line}: {code[at:at + 60].strip()}")
    return bad


def test_the_mathjax_finder_finds_direct_calls():
    for line in ("MathJax.typesetPromise([shell]).then(f);",
                 "try{MathJax.typeset([el]);}catch(e){}",
                 "MathJax.startup.document.render();",
                 "MathJax.tex2chtml(src)",
                 "if(x) window.MathJax.typesetClear([root]);",
                 "jvMath.run(function(){return MathJax.typesetPromise();})",
                 "mathsRun(function(){return MathJax.typeset("
                 "[document.body]);})"):
        assert mathjax_outside_jvmath("x.js", line), line
    for line in ("mathsRun(function(){return MathJax.typesetPromise([p]);})",
                 "window.jvMath.run(function(){ return MathJax.typeset([p]);})",
                 "/* MathJax.typesetPromise([body]) */",
                 "if(window.MathJax&&MathJax.typesetPromise) ok();"):
        assert not mathjax_outside_jvmath("x.js", line), line


def test_mathjax_is_called_only_through_jvmath():
    """Two overlapping typeset calls share MathJax's one document: the
    one left waiting on an extension load renders the other's elements.
    And a call outside jvMath is how the whole-document typeset at load
    and on every mount came back. One typesetter, one queue."""
    for name, js in _sources().items():
        assert not mathjax_outside_jvmath(name, js), \
            mathjax_outside_jvmath(name, js)
    # the deck's doors hand the job over first, and fall back only
    # where there is no jvMath (a page without app.js)
    deck = _blank_comments(assets.deck_js())
    assert set(_spans(deck, DECK_FALLBACKS)) == set(DECK_FALLBACKS)
    assert "if(window.jvMath) return window.jvMath.typeset(el);" in \
        lift_fn(deck, "typeset")
    assert "if(M) return M.run(fn);" in lift_fn(deck, "mathsRun")
    assert "if(window.jvMath){" in lift_fn(deck, "afterTypeset")
    # and the page never typesets on its own at startup
    assert "startup: {typeset: false}" in assets.load("html/mathjax.html")
