"""A folded group is a tall tile; the Timing row is full; a layout tile
chooses, New slide adds (T218).

The user, 2026-09-03, at a 1300px window: "Same goofiness with buttons
still exists. Also the new slide is confusing with the types next to it.
The types of slide being selected should be highlighted, and clicking on
one just highlights it to be added when clicking new slide."
"""

from __future__ import annotations

import re

import junoview.assets as assets


def test_a_folded_group_is_the_one_tile_with_its_own_icon(out):
    assert "wrap.className='sh-drop rbn-foldwrap rbn-tall';" in out
    assert "btn.type='button';btn.className='fx-tile big-tile rbn-foldbtn';" in out
    assert "btn.innerHTML=bic(g.getAttribute('data-fold-ic')||'menu')" in out
    assert (".rbn-foldwrap .fx-tile.rbn-foldbtn{height:var(--rbn-tile-h);"
            "width:82px;}") in out
    html = assets.deck_html()
    groups = re.findall(
        r'<span class="rbn-grp[^"]*"(?: id="[a-z-]+")? data-tab="[a-z]+"[^>]*>', html)
    bare = [g for g in groups if 'data-fold-ic="' not in g]
    assert groups and not bare, bare


def test_the_delay_is_the_last_cell_of_the_timing_row():
    """It sat between the start run and the by-text run so it could
    share the start run's column. T372 made both of those full-height
    tile strips, so there is no column left to share -- and a spanning
    cell resets sizeRibbonGroups' pairing, so only the LAST single cell
    in a row can be marked `rbn-odd`. Anywhere but the end and the delay
    hangs in row 1 with a hole beneath it; measured at y=69 in a band
    ending at 130 before it was moved.

    It also hides with its own cell now, not just the wrap inside it: an
    inapplicable delay beside two strips was a column spending 96px on
    nothing, which folded this very group away at 1600px.
    """
    html = assets.deck_html()
    start = html.index('id="anim-start"')
    by = html.index('id="anim-by"')
    cell = html.index('id="anim-delaycell"')
    assert start < by < cell
    delaywrap = html.index('id="anim-delaywrap"')
    assert cell < delaywrap
    assert '<span class="cell-lab">Delay</span>' in html[delaywrap:]
    js = assets.deck_js()
    assert "      if(dc) dc.hidden=!(st.on&&st.mode==='after');" in js


def test_a_layout_tile_chooses_and_new_slide_adds(out):
    # the strip's click remembers and highlights; it no longer makes a slide
    assert ("          if(sel==='#layout-strip'){\n"
            "            if(!layout.poster) lsSet(newLayKey(),layout.id);\n"
            "            syncNewSlideMarks();\n"
            "            return;\n") in out
    assert "function syncNewSlideMarks(){" in out
    assert "?(('arr:'+b.dataset.arr)===key):(b.dataset.lay===key);" in out
    # a saved layout is chosen the same way, and New slide honours it
    assert "lsSet(newLayKey(),'arr:'+b.dataset.arr);" in out
    assert "var hit=arrList()[+key.slice(4)];" in out
    assert "lay=lay||layoutById(/^arr:/.test(key)?'cell-text':key);" in out
    # the slide's own sweep leaves the strip alone
    assert ("$$('#layout-row .lay,#layout-menu-grid .lay')\n"
            "      .forEach(function(b){") in out
    assert "newVersion(null,arr);" not in out
    assert ('aria-label="Layout for the next new slide: '
            'click one to choose it"') in out
