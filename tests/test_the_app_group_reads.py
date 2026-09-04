"""The App group's buttons stop painting over each other (T260).

Found by driving the rendered page at 1440x900, not by reading. The
group at the right of the ribbon -- Theme, Support, Find, Help -- came
back as four overlapping, illegible clusters of glyphs, and Help's box
started at x=1455 on a 1440-wide viewport.

Three rules had drifted apart from the markup they were written for:

* `#ab-app .toggle{width:34px;min-width:34px;height:34px;}` forced a
  SQUARE. Every one of those buttons holds an icon AND a word, and
  `.appbar .toggle` is `white-space:nowrap` with visible overflow -- so
  each label painted straight out of its 34px box and across the next
  button. The rule was written when the group really was icon-only.
* `#help-btn{padding:0;...width:28px;}` with the comment "Help is
  icon-only and stands alone". Help has carried the word "Help" since,
  so the square only served to push the word out of the box.
* `#theme-btn` in the icon-only square rule matches nothing: the button
  is `#scheme-btn`. A selector that has never applied is a rule nobody
  can reason about.

And the File group: `#tab-open` is `hidden` unless the page can really
open a file, which a shared standalone render cannot -- but the GROUP
stayed, so the bar carried a "File" caption over an empty box plus a
divider. About 60px of chrome for nothing, on a bar already scrolling
sideways.

Driven after the fix at 1440x900: no label paints outside its own
button, no two toolbar buttons overlap, every App button shows its word
and its icon, and the File group measures 0 wide. The ribbon still does
not wrap -- past its one compaction stage it scrolls sideways, which is
the recorded decision (never a second row, never missing words).
"""

from __future__ import annotations

import re

from junoview import assets


def test_a_worded_button_is_sized_by_its_word():
    css = assets.load("css/app.css")
    assert "#ab-app .toggle{height:34px;min-width:34px;}" in css
    # ...not by a square that its word then overflows
    assert "#ab-app .toggle{width:34px;min-width:34px;height:34px;}" not in css
    # the height and the bigger icon stay: "the app buttons are way too
    # small" (2026-08-18, user, on a monitor) is a separate finding
    assert "#ab-app .bic{width:17px;height:17px;}" in css


def test_help_is_not_an_icon_only_button():
    css = assets.load("css/app.css")
    assert "#help-btn{padding:0;justify-content:center;" not in css
    page = assets.load("html/page.html")
    btn = page.split('id="help-btn"')[1].split("</button>")[0]
    assert "Help</button>" in page.split('id="help-btn"')[1][:400]
    assert 'data-ic="help"' in btn


def test_the_icon_only_square_rule_names_only_icon_only_buttons():
    """#theme-btn never existed -- the button is #scheme-btn -- and
    neither Theme nor Support is icon-only any more."""
    css = assets.load("css/app.css")
    square = css.split(".appbar .toggle.fz-step,.present-bar .toggle.fz-step")[1]
    square = square.split("}")[0]
    assert "#theme-btn" not in square
    assert "#support-btn" not in square
    assert "width:28px" in square, "the size steppers still want a square"
    # ...and it is not a selector anywhere else either: it selects nothing.
    # The comment recording why it went is not a selector, so strip
    # comments before looking.
    rules = re.sub(r"/\*.*?\*/", "", css, flags=re.S)
    assert "#theme-btn" not in rules


def test_a_group_with_nothing_in_it_is_not_rendered():
    css = assets.load("css/app.css")
    assert ".abgrp.grp-empty{display:none!important;}" in css
    app = assets.app_js()
    assert "    var fileGrp=$('#ab-file');" in app
    assert ("    if(fileGrp) fileGrp.classList.toggle('grp-empty',!canOpen);"
            in app)
    # it hides with the same flag that hides its only button
    chrome = app.split("  function refreshChrome(){")[1].split("\n  function ")[0]
    assert "if(openBtn) openBtn.hidden=!canOpen;" in chrome
    assert "grp-empty" in chrome


def test_the_ribbon_still_refuses_to_wrap():
    """The user-confirmed invariant this change must not have bought its
    legibility with (AGENTS.md): the bar compacts, then scrolls."""
    css = assets.load("css/app.css")
    assert ".appbar{display:flex;align-items:stretch;gap:4px;flex-wrap:nowrap;" in css
    assert "overflow-x:auto" in css
    app = assets.app_js()
    assert "    if(over(bar)||over(sb)) cl.add('rbc1');" in app
