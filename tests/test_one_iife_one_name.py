"""No two top-level declarations in the deck IIFE share a name (T259).

`assets/js/deck/` is ONE IIFE split across the files DECK_PARTS names,
so every `function foo(){}` and `var foo` written at the top level of
any part is the SAME binding. Two parts declaring the same name is not
a shadowing -- the later one wins outright, for everybody.

The bug that prompted this:

    35-arranging.js:219   function flipSel(axis){ ...mirror the selection }
    45-images.js:335      var flipSel=-1;   // which annot the pane shows

45-images is concatenated after 35-arranging, so by the time any
handler could run, `flipSel` was the number -1. Choosing "Flip left to
right" or "Flip top to bottom" from the Arrange menu called `(-1)('h')`
and threw `TypeError: flipSel is not a function`, which aborted the
menu handler: the menu closed and nothing happened, with no toast and
no visible reason. Two shipped menu rows were permanently dead, and
tests/test_slide_editor.py asserted `"function flipSel(axis){" in out`
the whole time -- green, while the feature could not run. Confirmed
under a real engine before the fix: `typeof` went "function" ->
"number" and the call threw.

The same scan found a second one: STYLE_FIELDS was declared in
05-figures-and-ribbon.js as ['size','b','i',...] and again in
15-annotations.js as ['b','i',...,'head','bg','bdc']. Nothing in 05
read it, so nothing misbehaved -- but the file said something untrue to
anyone reading it, and test_characterization's own note says the point
was to have ONE list.

This test is the general guard rather than two more substring
assertions, because a substring test cannot see two declarations
disagreeing -- which is the failure mode this codebase actually has.
"""

from __future__ import annotations

import collections
import re

from junoview import assets

# the house convention: IIFE top level is indented exactly two spaces
_FN = re.compile(r"^  function ([A-Za-z_$][\w$]*)\s*\(")
_VAR = re.compile(r"^  var\s+(.*)$")


def _split_top_level(body: str) -> list[str]:
    """Split a `var a=1,b=2` list on the commas that are not nested."""
    out, cur, depth = [], "", 0
    for ch in body:
        if ch in "([{":
            depth += 1
        elif ch in ")]}":
            depth -= 1
        if ch == "," and depth == 0:
            out.append(cur)
            cur = ""
        else:
            cur += ch
    out.append(cur)
    return out


def _declarations(src: str):
    """{name: [line, ...]} for top-level functions and for top-level vars."""
    fns = collections.defaultdict(list)
    variables = collections.defaultdict(list)
    for n, line in enumerate(src.split("\n"), 1):
        m = _FN.match(line)
        if m:
            fns[m.group(1)].append(n)
            continue
        m = _VAR.match(line)
        if not m:
            continue
        for piece in _split_top_level(m.group(1)):
            name = piece.split("=")[0].strip().rstrip(";").strip()
            if re.fullmatch(r"[A-Za-z_$][\w$]*", name or ""):
                variables[name].append(n)
    return fns, variables


def _report(src: str, label: str) -> list[str]:
    fns, variables = _declarations(src)
    bad = []
    for name in sorted(set(fns) & set(variables)):
        bad.append(
            f"{label}: '{name}' is a function (line {fns[name]}) AND a var "
            f"(line {variables[name]}) at the top level of one IIFE -- the "
            f"var wins and every call to the function throws")
    for name, lines in sorted(fns.items()):
        if len(lines) > 1:
            bad.append(f"{label}: function '{name}' declared at {lines}")
    for name, lines in sorted(variables.items()):
        if len(lines) > 1:
            bad.append(f"{label}: var '{name}' declared at {lines}")
    return bad


def test_the_deck_iife_declares_each_name_once():
    bad = _report(assets.deck_js(), "deck")
    assert not bad, "\n".join(bad)


def test_app_js_declares_each_name_once():
    """app.js is one IIFE too, by the same rule."""
    bad = _report(assets.app_js(), "app.js")
    assert not bad, "\n".join(bad)


def test_the_scan_would_actually_catch_it():
    """A guard that cannot fail is not a guard. Feed it the exact shape
    the bug had and check it reports it."""
    bad = _report(
        "  function flipSel(axis){\n"
        "    return axis;\n"
        "  }\n"
        "  var flipSel=-1;\n",
        "fixture")
    assert len(bad) == 1
    assert "'flipSel' is a function" in bad[0]
    assert "the var wins" in bad[0]


def test_flip_left_to_right_reaches_the_verb():
    """The specific repair, pinned: the Arrange menu's caller and the
    function it means are the same name, and the flip-book pane's index
    is a different one."""
    deck = assets.deck_js()
    assert "  function flipSel(axis){" in deck
    assert "      if(what.indexOf('f:')===0){flipSel(what.slice(2));return;}" in deck
    assert "  var flipPaneIdx=-1;" in deck
    assert "  var flipSel=" not in deck
    # flipSelIdx() is a different, longer name and must not have been
    # caught by the rename
    assert "  function flipSelIdx(){" in deck
