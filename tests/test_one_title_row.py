"""One title row, the way PowerPoint has one (T602).

The user, 2026-09-30, beside a screenshot of PowerPoint: "see on power
point how their ribbon looks so much better than ours. Like there is to
many layers to our ribbon, now expecitally since all this tab stuff ...
Its too much all the sutff that appears aboe the home, images etc.
ribbon. I feel like a lot of this stuff could is all just be put under
the file button e.g. the app button, and stuff like new and open. Also
the tabs is good, but is all just too much now."

T596 had put the open files in a row of their own above everything, so
the editor stacked three bars over its ribbon (tabs; File, Save and the
rest; the ribbon's tabs) and the reader three over its document (tabs;
File info and App; the filters). Now each has one title row: the tabs
sit in it, and New, Open and the App menu's rows are rows of File.

The first try put the tabs between Find and Present, as boxed buttons,
and the user: "This is super cursed with the tabs crowded in here". Of
three layouts offered they chose the PowerPoint split: the title row is
PowerPoint's title bar (the tabs, drawn as real tabs, on the left; the
command search in the middle; Save, the readout, Autosave and undo on
the right) and File leads the row under it, with Find, Full screen and
Present at that row's end -- PowerPoint's File Home Insert row. The
reader matches: tabs, then Info, Reload and Find, and File leads the
Outline / Filters row. Driven at 1440, 1280 and 1100 wide, with Style
and Object showing, while building, at Home and in the light theme.
"""

from __future__ import annotations

import json
import subprocess
import tempfile
from pathlib import Path

import pytest

from helpers_js import js_engine, lift_fn
from junoview import assets


def test_the_tabs_move_to_whichever_title_row_is_on_screen():
    """One node, moved and never copied: into the editor's bar while the
    slide editor is up, back into the reader's row after -- and nothing
    moves when it is already where it belongs."""
    if js_engine() is None:
        pytest.skip("no node or VS Code Electron on this machine")
    cmd, env = js_engine()
    src = lift_fn(assets.app_js(), "homeTabsRow")
    script = """
      var editing=false,moves=[];
      var document={body:{classList:{contains:function(c){
        return c==='slide-editing'&&editing;}}}};
      function bar(id){return {id:id,insertBefore:function(n,at){
        n.parentNode=this;n.nextSibling=at;moves.push(this.id);}};}
      var qatAt={parentNode:bar('deck-qat')},
          readerAt={parentNode:bar('nb-filebar')};
      function $(s){
        return s==='#deck-qat .qat-tabs-at'?qatAt
          :s==='#nb-filebar .nb-file-spacer'?readerAt:null;}
      var openTabsRow={nextSibling:readerAt},kept=0;
      function keepTabInView(){kept++;}
    """ + src + """
      homeTabsRow();                 // already in the reader's row
      editing=true;homeTabsRow();    // the editor opens
      homeTabsRow();                 // a second class change: no move
      editing=false;homeTabsRow();   // the editor closes
      console.log(JSON.stringify({moves:moves,kept:kept}));
    """
    with tempfile.TemporaryDirectory() as d:
        p = Path(d) / "run.js"
        p.write_text(script, encoding="utf-8")
        r = subprocess.run(cmd + [str(p)], capture_output=True, text=True,
                           encoding="utf-8", env=env, timeout=60)
    assert r.returncode == 0, r.stderr[:2000]
    got = json.loads(r.stdout.strip().splitlines()[-1])
    assert got == {"moves": ["deck-qat", "nb-filebar"], "kept": 2}, got


def test_the_row_is_watched_from_one_place():
    js = assets.app_js()
    init = js.split("function initFilesAt(){")[1].split("\n  }\n")[0]
    assert ("    if(window.MutationObserver) new MutationObserver(homeTabsRow)\n"
            "      .observe(document.body,{attributes:true,"
            "attributeFilter:['class']});") in init
    # the editor's bar re-fits when a tab opens or closes inside it
    deck = assets.deck_js()
    assert "var otr=$('#open-tabs-row'); if(otr) qro.observe(otr);" in deck


def test_the_title_row_is_split_the_way_powerpoint_splits_it():
    """The user's pick of three, after the first try crowded the tabs in
    among File, Find and Present: tabs on the left, the command search in
    the middle, saving on the right."""
    html = assets.deck_html()
    qat = html[html.index('<div class="deck-qat" id="deck-qat"'):
               html.index('<aside class="deck-create"')]
    assert (qat.index('<span class="qat-tabs-at"></span>')
            < qat.index('id="qat-name"') < qat.index('id="rbn-search"')
            < qat.index('id="dc-save"') < qat.index('id="deck-status"')
            < qat.index('id="qat-auto"') < qat.index('id="dc-undo"'))
    for gone in ('id="dc-file"', 'id="qat-find"', 'id="vw-full"',
                 'id="dc-play"'):
        assert gone not in qat, gone
    # no App menu on the bar: its rows are File's
    assert 'id="deck-app"' not in html
    css = assets.deck_css()
    # the tab names the deck while it is here, and the readout gives up
    # its width before the tabs do
    assert (".deck-qat:has(> .open-tabs-row:not([hidden])) .qat-name"
            "{display:none;}") in css
    assert (".deck-qat .deck-status{flex:0 4 34ch;width:auto;"
            "min-width:11ch;}") in css
    # the reader's header is no longer held up over the editor
    assert "body.slide-editing:has(#open-tabs-row" not in css


def test_file_leads_the_strip_and_the_verbs_close_it():
    html = assets.deck_html()
    strip = html[html.index('<div class="rbn-tabs" id="rbn-tabs"'):
                 html.index('<div class="edit-tools ribbon"')]
    assert (strip.index('id="dc-file"') < strip.index('class="rbn-tabset"')
            < strip.index('id="qat-find"') < strip.index('id="vw-full"')
            < strip.index('id="dc-play"') < strip.index('id="rbn-auto"'))
    # while building the strip shows, as File and the verbs alone
    deck = assets.deck_js()
    assert "    if(tabs) tabs.hidden=!editing;" in deck
    css = assets.deck_css()
    assert ".deck.creating .rbn-tabs .rbn-tabset," in css
    assert ".deck.creating .deck-qat .rbn-search{display:none;}" in css


def test_the_strip_has_its_own_rungs():
    deck = assets.deck_js()
    fit = deck.split("  function fitTabStrip(){")[1].split("\n  }\n")[0]
    for rung in ("rt-c1", "rt-c2", "rt-scroll"):
        assert f"cl.add('{rung}')" in fit, rung
    # fitted with the title row, and again when Style and Object come
    assert "    fitTabStrip();   /* T602: the rows are fitted together */" in deck
    assert "          if(ms[i].target!==ts){scheduleQatFit();return;}" in deck
    css = assets.deck_css()
    assert ".rbn-tabs.rt-c2 .rbn-tab{padding:0 6px;font-size:12px;}" in css
    # geometry never transitions under a fitter (T487)
    assert (".rbn-tabs .dbtn{\n"
            "  transition-property:border-color,color,background-color,"
            "box-shadow;}") in css


def test_file_holds_new_open_and_the_app_in_both_views():
    page = assets.page_template()
    head = page[page.index('<header class="apptop"'):page.index("</header>")]
    # the reader's File leads the Outline / Filters row, under the tabs
    nav = head[head.index('<div class="appbar">'):]
    assert nav.index('id="app-filewrap"') < nav.index('id="menubtn"')
    reader = nav[nav.index('id="app-file-menu"'):]
    reader = reader[:reader.index("</span>")]
    deck = assets.deck_html()
    editor = deck[deck.index('id="dc-menu"'):deck.index('id="mi-del"')]
    for menu in (reader, editor):
        for row in ("Poster", "Custom view", "Folder",
                    "Open a presentation&#8230;", "Theme&#8230;",
                    "Support Junoview &#9829;"):
            assert row in menu, row
    assert "Open a notebook&#8230;" in reader
    # the editor's File is two columns, the dangerous pair still last
    assert 'class="dc-menu dc-menu-cols" id="dc-menu"' in deck
    css = assets.deck_css()
    assert (".dc-menu.dc-menu-cols{flex-direction:row;"
            "align-items:flex-start;gap:4px;") in css


def test_the_tabs_are_real_tabs():
    """They hang from the row's bottom edge, quiet until pointed at, and
    the one on screen wears the colour of the row under it, so it joins
    that row."""
    css = assets.app_css()
    assert ".open-tabs-row .ot-home,.top-tabstrip .tab{height:29px;" in css
    assert "border-bottom:0;border-radius:8px 8px 0 0;" in css
    assert "  background:var(--tab-on,var(--chrome-0,#0b141d));" in css
    assert ".nb-filebar{--tab-on:var(--chrome-0,#0b141d);}" in css
    assert ".deck-qat{--tab-on:var(--chrome-1);}" in assets.deck_css()


def test_the_tab_being_edited_renames_and_is_the_only_one_lit():
    deck = assets.deck_js()
    # (T606: a collection renames from its own heading, not its tab)
    assert ("    if(top&&!isView&&!isCol) action.addEventListener("
            "'dblclick',") in deck
    assert "      if(!(isCur&&!deckEl.hidden&&mode==='edit')) return;" in deck
    css = assets.app_css()
    assert ("body.slide-editing .top-tabstrip .tab.current:not(.top-pres-tab)"
            in css)
    # no scrollbar in a one-button row; the tab on screen is kept in view
    assert "  align-self:stretch;overflow-x:auto;scrollbar-width:none;}" in css
    assert "  function keepTabInView(){" in assets.app_js()


def test_theme_opens_under_file_when_its_menu_has_closed():
    js = assets.app_js()
    assert ("    var wrap=btn.closest('.dc-menuwrap'),\n"
            "        door=wrap&&wrap.querySelector('[aria-haspopup=\"true\"]');"
            ) in js
    # T607: under File whenever Theme IS a row of File -- the reader's File
    # was still open when the picker was placed, so it hung from the Theme
    # row and ran off the bottom of a laptop screen -- and kept on screen
    assert "    if(door&&door!==btn){" in js
    assert ("    var top=Math.min(r.bottom+6,innerHeight-m.offsetHeight-8);\n"
            "    m.style.top=Math.max(8,top)+'px';") in js


def test_home_shows_the_tabs_and_nothing_else():
    css = assets.app_css()
    assert ("body.welcoming.tabs-row-on .nb-filebar>:not(.open-tabs-row)"
            ":not(.nb-file-spacer){") in css
    # Info and Reload never shrink under Find in a narrow column
    assert ".nb-filebar #file-dock{flex:none;}" in css
    assert "body.tabs-row-on .nb-file-ident{display:none!important;}" in css


def test_the_tour_points_at_file():
    js = assets.app_js()
    assert "    {sel:'#app-file,#help-btn',title:'Help & support'," in js
