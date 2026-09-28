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
    # T463: 82 is the door's floor, not its width -- a name wider than
    # that widens the door rather than being cut
    assert (".rbn-foldwrap .fx-tile.rbn-foldbtn{height:var(--rbn-tile-h);"
            "min-width:82px;}") in out
    html = assets.deck_html()
    groups = re.findall(
        r'<span class="rbn-grp[^"]*"(?: id="[a-z-]+")? data-tab="[a-z]+"[^>]*>', html)
    bare = [g for g in groups if 'data-fold-ic="' not in g]
    assert groups and not bare, bare


def test_the_delay_belongs_to_start_not_text_sequence():
    """T518 separated WHEN from WHICH TEXT UNIT. Delay is conditional
    detail for After previous, so it stays in the Start row and precedes
    the independently foldable Text sequence group.
    """
    html = assets.deck_html()
    start_group = html.index('id="anim-start-group"')
    start = html.index('id="anim-start"')
    cell = html.index('id="anim-delaycell"')
    sequence_group = html.index('id="anim-sequence-group"')
    by = html.index('id="anim-by"')
    assert start_group < start < cell < sequence_group < by
    delaywrap = html.index('id="anim-delaywrap"')
    assert cell < delaywrap
    assert '<span class="cell-lab">Delay</span>' in html[delaywrap:]
    js = assets.deck_js()
    assert "      if(dc) dc.hidden=!(st.on&&st.mode==='after');" in js


def test_a_layout_tile_chooses_and_new_slide_adds(out):
    # the strip's click remembers and highlights; it no longer makes a slide
    # (T424: for a SLIDE tile -- a poster tile applies, since a poster's
    # New slide is New version and a choice would be for nothing)
    assert ("          if(sel==='#layout-strip'&&!layout.poster){\n"
            "            lsSet(newLayKey(),layout.id);\n"
            "            syncNewSlideMarks();\n"
            "            return;\n") in out
    assert "function syncNewSlideMarks(){" in out
    # (T494: by the arrangement's ID, not its index)
    assert "?(('arr:'+b.dataset.arrId)===key):(b.dataset.lay===key);" in out
    # a saved layout is chosen the same way, and New slide honours it
    assert "lsSet(newLayKey(),'arr:'+b.dataset.arrId);" in out
    assert "var hit=arrById(key.slice(4));" in out
    assert ("lay=lay||layoutById(/^arr:/.test(key)?'cell-text':key)\n"
            "          ||layoutById('cell-text');") in out
    # the slide's own sweep leaves the strip alone
    assert ("$$('#layout-row .lay,#layout-menu-grid .lay')\n"
            "      .forEach(function(b){") in out
    assert "newVersion(null,arr);" not in out
    assert ('aria-label="Layout for the next new slide: '
            'click one to choose it"') in out
