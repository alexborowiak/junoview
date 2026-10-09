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
    """T602 (2026-09-30, user: "a lot of this stuff could all just be put
    under the file button e.g. the app button, and stuff like new and
    open"): the reader's App menu is its File menu now, the same kind of
    menu as the editor's, with New and Open above the app's own rows."""
    css = assets.load("css/app.css")
    assert "#help-btn{padding:0;justify-content:center;" not in css
    page = assets.load("html/page.html")
    assert 'id="app-appwrap"' not in page and "App &#9662;" not in page
    assert 'id="app-filewrap"' in page
    assert 'help and\n support">File &#9662;</button>' in page
    # the menu holds heading <div>s, so it ends at the wrap
    menu = page.split('id="app-file-menu"')[1].split("</span>")[0]
    heads = re.findall(r'<div class="dc-mhead">([^<]+)</div>', menu)
    # T611: "open files" left -- the switch is on the list itself now
    assert heads == ["new", "open", "app"], heads
    assert 'id="ot-open"' in menu and 'id="tab-open" hidden' in menu
    assert 'id="scheme-btn"' in menu
    assert 'id="help-btn"' in menu and "How to\n            use&#8230;" in menu
    assert 'id="support-btn"' in menu
    assert "jv-files-at" not in menu and "jv-files-to" not in menu


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
    # the server sends it in the state app.js will put it in (load-static
    # #8: no jump at boot) -- hidden with nothing open, shown with a
    # notebook, which is what refreshChrome then confirms
    assert '<div class="nb-filebar" id="nb-filebar"{bar_hidden}>' in page
    from junoview.render.page import _first_layout
    assert _first_layout(False)["bar_hidden"] == " hidden"
    assert _first_layout(True)["bar_hidden"] == ""
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
    # T605: the tab strip and the band are measured too, and the band
    # folds its least-used groups into doors before it would scroll
    assert ("    if(over($('#ab-tabs'))||over(band)||over(bar)||over(sb))\n"
            "      cl.add('rbc1');") in app
    assert "BAND_FOLD.forEach(function(sel){" in app
    assert ".ab-band{display:flex;flex-wrap:nowrap;" in css
