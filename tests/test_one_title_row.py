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
Driven at 1440, 1280 and 1100 wide: the editor's ribbon starts 35px
higher, the reader's document 40px higher, and nothing clips.
"""

from __future__ import annotations

import json
import re
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


def test_the_editor_has_one_bar_above_its_tabs():
    html = assets.deck_html()
    qat = html[html.index('<div class="deck-qat" id="deck-qat"'):
               html.index('<aside class="deck-create"')]
    # the tabs arrive after Find and before the first spring
    assert (qat.index('id="qat-find"')
            < qat.index('<span class="deck-spring qat-tabs-at"></span>')
            < qat.index('id="qat-name"') < qat.index('id="dc-play"'))
    # no App menu on the bar: its rows are File's
    assert 'id="deck-app"' not in html
    css = assets.deck_css()
    # the tab names the deck while it is here, and the readout gives up
    # its width before the tabs do
    assert ".deck-qat:has(> .open-tabs-row:not([hidden])) .qat-name" \
        "{display:none;}" in css
    assert "  flex:0 4 34ch;width:auto;min-width:11ch;}" in css
    # the reader's header is no longer held up over the editor
    assert "body.slide-editing:has(#open-tabs-row" not in css


def test_file_holds_new_open_and_the_app_in_both_views():
    page = assets.page_template()
    head = page[page.index('<header class="apptop"'):page.index("</header>")]
    first = re.search(r'<(?:div|span|button) class="([a-z- ]+)" id="([a-z-]+)"',
                      head[head.index('id="nb-filebar"'):][20:])
    assert first.group(2) == "app-filewrap", first.groups()
    reader = head[head.index('id="app-file-menu"'):]
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


def test_the_tab_being_edited_renames_and_is_the_only_one_lit():
    deck = assets.deck_js()
    assert "    if(top&&!isView) action.addEventListener('dblclick'," in deck
    assert "      if(!(isCur&&!deckEl.hidden&&mode==='edit')) return;" in deck
    css = assets.app_css()
    assert ("body.slide-editing .top-tabstrip .tab.current:not(.top-pres-tab)"
            in css)
    # no scrollbar in a one-button row; the tab on screen is kept in view
    assert "  overflow-x:auto;scrollbar-width:none;}" in css
    assert "  function keepTabInView(){" in assets.app_js()


def test_theme_opens_under_file_when_its_menu_has_closed():
    js = assets.app_js()
    assert ("      var wrap=btn.closest('.dc-menuwrap'),\n"
            "          door=wrap&&wrap.querySelector('[aria-haspopup=\"true\"]');"
            ) in js


def test_home_shows_file_and_the_tabs_and_nothing_else():
    css = assets.app_css()
    assert ("body.welcoming.tabs-row-on .nb-filebar>:not(#app-filewrap)"
            ":not(.open-tabs-row):not(.nb-file-spacer){") in css
    assert "body.tabs-row-on .nb-file-ident{display:none!important;}" in css


def test_the_tour_points_at_file():
    js = assets.app_js()
    assert "    {sel:'#app-file,#help-btn',title:'Help & support'," in js
