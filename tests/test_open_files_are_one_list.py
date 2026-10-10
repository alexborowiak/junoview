"""The open files are one list, in one place (T596).

The user, 2026-09-30: "looks like there is now a side-bar and tab (one or
the other) e.g. there is a little thing that pops up on the lhs in
presentations, and then there are tabs, these should be the same thing
not both."

T503 made open files top tabs "while the side panel remains a
simultaneous library view of those same live tabs", so every open
notebook and presentation was listed twice, and in the editor the side
copy peeked out of the left edge over the tabs. Now: TABS across the top
(the default, with Home, New and Open on the same row), or the LIST down
the side (and no tab row at all). App > Open files switches.

T602 (the same day) kept the one list and moved it: the tabs sit in the
title row rather than a row of their own, New and Open are rows of File,
and the App menu (with this choice in it) is a section of File too. The
tests below that pinned T596's row are updated to that, and T602's own
are in test_one_title_row.py.
"""

from __future__ import annotations

import re

from helpers_js import js_engine, lift_fn
from junoview import assets


def test_the_default_is_tabs_and_only_side_means_side():
    """One stored word decides. Anything but 'side' -- nothing stored, a
    private window whose storage throws, a stale value -- is tabs."""
    if js_engine() is None:
        import pytest
        pytest.skip("no node or VS Code Electron on this machine")
    import json
    import subprocess
    import tempfile
    from pathlib import Path
    cmd, env = js_engine()
    src = lift_fn(assets.app_js(), "filesAt")
    script = src + """
      var FILES_AT_KEY='junoview:openfiles',store={};
      var localStorage={getItem:function(k){
        if(store.boom) throw new Error('private window');
        return store.hasOwnProperty(k)?store[k]:null;}};
      var out=[];
      out.push(filesAt());
      store['junoview:openfiles']='side';out.push(filesAt());
      store['junoview:openfiles']='top';out.push(filesAt());
      store['junoview:openfiles']='left';out.push(filesAt());
      store.boom=1;out.push(filesAt());
      console.log(JSON.stringify(out));
    """
    with tempfile.TemporaryDirectory() as d:
        p = Path(d) / "run.js"
        p.write_text(script, encoding="utf-8")
        r = subprocess.run(cmd + [str(p)], capture_output=True, text=True,
                           encoding="utf-8", env=env, timeout=60)
    assert r.returncode == 0, r.stderr[:2000]
    got = json.loads(r.stdout.strip().splitlines()[-1])
    assert got == ["top", "side", "top", "top", "top"]


def test_the_tab_row_carries_the_side_panels_doors():
    """Home before the tabs. T596 had New and Open after them, on a row of
    their own that was the first thing in the header; T602 put the tabs
    at the left of the title row (Info, Reload and Find at its right) and
    New and Open in File, which leads the row under it."""
    page = assets.page_template()
    head = page[page.index('<header class="apptop" id="apptop">'):]
    head = head[:head.index("</header>")]
    first = re.search(r"\n  <div class=\"([a-z-]+)\"", head).group(1)
    assert first == "nb-filebar", first
    bar = head[:head.index('<div class="appbar">')]
    row = bar[bar.index('<div class="open-tabs-row"'):]
    nav = head[head.index('<div class="appbar">'):]
    assert row.index('id="ot-home"') < row.index('id="top-tabstrip"')
    assert 'id="ot-new"' not in page and "ot-doors" not in page
    # words plus icons, never icon-only (the UI invariant)
    assert '>{logo}<span class="btxt">Home</span></button>' in row
    # New makes the same four things the side panel's New made, by
    # pressing the one real button for each -- from File now
    menu = nav[nav.index('id="app-file-menu"'):]
    menu = menu[:menu.index("</span>")]
    for real in ("pr-new", "pr-newpost", "pr-newview", "pr-newfold"):
        assert f'data-for="{real}"' in menu, real
    assert "Open a presentation&#8230;</button>" in menu
    assert (bar.index('id="open-tabs-row"') < bar.index('id="file-dock"')
            < bar.index('id="doc-find"'))
    assert nav.index('id="app-file"') < nav.index('id="menubtn"')
    # no stray label: Home says where the row starts
    assert "open-tabs-label" not in page


def test_the_choice_is_on_the_list_not_in_a_file_menu():
    # T611 (user, 2026-10-08: "I changed my tabs to be vertical now.
    # However, I have no idea how to get back to the other view" / "Why is
    # the tab layout inside the file option inside presentation?"): each
    # list carries the one button that leads to the other
    for html in (assets.page_template(), assets.deck_html()):
        assert '<div class="dc-mhead">open files</div>' not in html
        assert "jv-files-at" not in html
    page = assets.page_template()
    row = page.split('id="open-tabs-row"', 1)[1].split("</nav>", 1)[0]
    assert row.index('id="top-tabstrip"') < row.index('id="ot-files-side"')
    foot = page.split('class="pr-foot"', 1)[1].split("</div>", 1)[0]
    assert foot.index('id="pr-files-top"') < foot.index('id="pr-collapse"')


def test_one_list_is_on_screen_at_a_time(out):
    js = assets.app_js()
    # the row shows as tabs whenever anything is open, and never as a list
    assert "    var on=filesAt()==='top'&&n>0;" in js
    assert "    if(openTabsRow) openTabsRow.hidden=!on;" in js
    assert "    document.body.classList.toggle('tabs-row-on',on);" in js
    # as tabs the side panel and its edge handle are gone, width and all
    css = assets.app_css()
    assert ("body.files-top,body.files-top.presrail-min,"
            "body.files-top.prrail-auto{\n  --presrail-w:0px;}") in css
    assert ("body.files-top .presrail,body.files-top .presrail-show"
            "{display:none!important;}") in css
    # applied from the boot tail, beside the side panel's own auto-hide
    assert "  initRailAuto();\n  initFilesAt();" in js


def test_nothing_pops_out_of_the_left_edge_as_tabs(out):
    """The "little thing that pops up on the lhs": the side panel's
    auto-hide peek in the editor, and the open-items drawer while
    presenting. Neither answers the left edge while the list is tabs."""
    js = assets.app_js()
    auto = js.split("function initRailAuto(){")[1].split("\n  }\n")[0]
    assert "      if(filesAt()==='top') return;" in auto
    deck = assets.deck_js()
    peek = deck.split("function initDrawerPeek(){")[1].split("\n  }\n")[0]
    assert ("      if(APP.filesAt&&APP.filesAt()==='top'&&d.hidden) return;"
            in peek)


def test_ctrl_k_finds_in_the_open_dialog_as_tabs():
    """Ctrl+K put the caret in the side panel's Find field; with no side
    panel on screen it opens the Open dialog instead."""
    js = assets.app_js()
    # ...the editor's, which may still be loading (app.js jvDeck): the
    # key waits for it rather than falling through to the side panel
    assert ("      if(filesAt()==='top'&&(APP.deckHub||jvDeck.pending())){\n"
            "        jvDeck.then(function(){if(APP.deckHub) "
            "APP.deckHub({find:true});});\n"
            "        return;\n"
            "      }\n"
            "      f.focus();f.select();") in js


def test_the_row_is_wired_from_the_boot_sequence():
    deck = assets.deck_js()
    assert ("  tabRowBoot();               "
            "/* New and Open beside the tabs (T596) */") in deck
    body = deck.split("function tabRowBoot(){")[1].split("\n  }\n")[0]
    # T602: New's rows and Open are wired in whichever File they are in
    assert "['#app-file-menu','#dc-menu'].forEach(function(sel){" in body
    assert "$$('.dc-mi[data-for]',menu).forEach(function(b){" in body
    assert ("[['#ot-open','#app-file-menu'],['#mi-open','#dc-menu']]"
            in body)
    assert "if(menu) overlayHide(menu);openPresentationHub();});" in body
    js = assets.app_js()
    assert "if(h) h.addEventListener('click',function(){goHome(true);});" in js


def test_three_faults_found_on_the_way():
    """Driven while building T596, each also on the original code:
    the draft dot printed a literal backslash-2022; the reader's App menu
    stayed on screen after Esc or a pick (display:flex beat [hidden]);
    and the editor's header sat 430px in, behind the builder panel's
    offset the full-window editor does not have. (T602 retired that last
    fix with the thing it fixed: the reader's header is never shown over
    the editor now, because the tabs are in the editor's own bar.)"""
    css = assets.app_css()
    assert 'content:" \\\\2022"' not in css
    assert 'content:" \\2022";color:var(--amber);}' in css
    deck_css = assets.deck_css()
    assert ".dc-menu[hidden]{display:none!important;}" in deck_css
    assert "body.slide-editing .apptop{display:none;}" in deck_css
    assert "body.slide-editing.creating-docs .apptop" not in deck_css
