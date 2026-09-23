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


def test_global_buttons_are_grouped_in_the_file_utility_line():
    css = assets.load("css/app.css")
    assert ".nb-file-utils{display:flex;align-items:center;gap:4px;flex:none;}" in css
    assert ".nb-file-utils .toggle{height:var(--ab-btn-h);font-size:11.5px;" in css
    # The dead App ribbon group cannot leave invisible sizing rules behind.
    assert "#ab-app" not in css


def test_reader_uses_the_editor_app_menu():
    css = assets.load("css/app.css")
    assert "#help-btn{padding:0;justify-content:center;" not in css
    page = assets.load("html/page.html")
    assert 'id="app-appwrap"' in page
    assert '<i data-ic="theme"></i> App &#9662;</button>' in page
    menu = page.split('id="app-app-menu"')[1].split("</div>")[0]
    assert 'id="scheme-btn"' in menu
    assert 'id="help-btn"' in menu and "How to\n            use&#8230;" in menu
    assert 'id="support-btn"' in menu


def test_the_icon_only_square_rule_names_only_icon_only_buttons():
    """#theme-btn never existed -- the button is #scheme-btn -- and
    neither Theme nor Support is icon-only any more."""
    css = assets.load("css/app.css")
    square = css.split(".appbar .toggle.fz-step,.present-bar .toggle.fz-step")[1]
    square = square.split("}")[0]
    assert "#theme-btn" not in square
    assert "#support-btn" not in square
    assert "width:var(--ab-btn-h)" in square, "steppers still want a square"
    # ...and it is not a selector anywhere else either: it selects nothing.
    # The comment recording why it went is not a selector, so strip
    # comments before looking.
    rules = re.sub(r"/\*.*?\*/", "", css, flags=re.S)
    assert "#theme-btn" not in rules


def test_the_file_utility_line_hides_when_it_has_no_job():
    page = assets.load("html/page.html")
    assert '<div class="nb-filebar" id="nb-filebar" hidden>' in page
    css = assets.load("css/app.css")
    assert ".nb-filebar[hidden]{display:none!important;}" in css
    app = assets.app_js()
    assert "    var fileBar=$('#nb-filebar');" in app
    assert "if(fileBar) fileBar.hidden=!canOpen&&!APP.active;" in app
    # Open still hides with the same ability flag as before.
    chrome = app.split("  function refreshChrome(){")[1].split("\n  function ")[0]
    assert "if(openBtn) openBtn.hidden=!canOpen;" in chrome
    assert "nb-filebar" in chrome


def test_the_ribbon_still_refuses_to_wrap():
    """The user-confirmed invariant this change must not have bought its
    legibility with (AGENTS.md): the bar compacts, then scrolls."""
    css = assets.load("css/app.css")
    assert ".appbar{display:flex;align-items:stretch;gap:3px;flex-wrap:nowrap;" in css
    assert "overflow-x:auto" in css
    app = assets.app_js()
    assert "    if(over(bar)||over(sb)) cl.add('rbc1');" in app
