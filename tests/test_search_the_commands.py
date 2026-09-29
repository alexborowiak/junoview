"""T538: search the commands (Alt+Q).

PowerPoint's "Tell me" box. The index is the ribbon read live -- every
worded control in the editing tools, folded doors and the shelf
included, plus the File menu, the Present menu and the top bar -- less
anything the selection has hidden or disabled. Running a hit switches
to its tab, opens a folded door, presses the real control and outlines
it for a moment. PowerPoint's names find ours through a short alias list.

Driven: Alt+Q with the title selected focused the box; "format painter"
listed Copy look (Home > Clipboard); "page numbers" + Enter switched to
Design and turned numbers on; "fade" + Enter opened the Entrance shelf
and gave the title Fade.
"""

from __future__ import annotations

from junoview import assets


def test_the_field_is_in_the_strip_markup():
    html = assets.deck_html()
    tabs = html.split('<div class="rbn-tabs" id="rbn-tabs"')[1] \
        .split('<div class="edit-tools ribbon"')[0]
    assert 'id="rbn-search-in"' in tabs
    assert 'placeholder="Search commands (Alt+Q)"' in tabs
    assert tabs.index('class="rbn-tabset"') < tabs.index('id="rbn-search"')
    assert "58-command-search" in assets.DECK_PARTS


def test_the_index_is_the_ribbon_read_live(out):
    idx = out.split("  function cmdIndex(){")[1].split("\n  }\n")[0]
    assert "$$('button',bar).concat($$('#rbn-shelf button'))" in idx
    assert "$$('#dc-menu .dc-mi')" in idx
    assert "$$('#play-menu .dc-mi')" in idx
    live = out.split("  function cmdLive(b){")[1].split("\n  }\n")[0]
    assert "if(b.hidden||b.disabled) return false;" in live
    assert "a.classList.contains('rbn-grp')" in live
    assert "'hm-copylook':'format painter copy formatting'," in out


def test_running_shows_where_it_lives(out):
    run = out.split("  function cmdRun(c){")[1].split("\n  }\n")[0]
    assert "if(c.tab&&typeof setTab==='function') setTab(c.tab);" in run
    assert "var door=g.querySelector('.rbn-foldbtn');" in run
    assert "b.classList.add('cmd-found');" in run
    assert "e.altKey&&!e.ctrlKey&&!e.metaKey&&(e.key==='q'" in out
    assert "    cmdSearchBoot();" in out
