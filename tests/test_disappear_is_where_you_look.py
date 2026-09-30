"""T579: Disappear is where you look for it.

The user, 2026-09-30: "it is really confusing right now, I cannot figure
out how to make an image disappear. The UI for the animations is really
confusing overall."

The exit worked. It could not be found: its tile was HIDDEN until an
object was selected -- every other tile on the Animation tab stays,
disabled, saying "no selection" -- so the tab you scanned for it had no
exit on it; command search skips hidden controls, so searching found
nothing either; and it was called "Send it away", which is not the word
anyone searches with.

Driven: with nothing selected the tab shows "Disappear / no selection"
beside the other disabled tiles; right-click a photo, "Disappear on a
click" is in the first screen of the menu, and the tile then reads
"on click 6".
"""

from __future__ import annotations

from junoview import assets


def test_the_tile_stays_on_the_tab_with_nothing_selected(out):
    fn = out.split("  function animOutSync(){")[1].split("\n  }")[0]
    assert "    if(wrap) wrap.hidden=poster;" in fn
    assert "    if(b) b.disabled=!a;" in fn
    assert "      if(say) say.textContent='no selection';" in fn
    assert "wrap.hidden=!a" not in fn


def test_search_finds_it_by_the_words_people_use():
    js = assets.deck_js()
    assert "    'anim-out':'disappear exit animation hide leave go away fade out '" \
        in js


def test_the_right_click_menu_has_it_in_sight(out):
    assert "      if(swapN.length===1&&!(pageOf&&pageOf().poster)){" in out
    assert "          menuHead(m,'animation');" in out
    assert ("          row(dGone?'Stay on the slide':'Disappear on a click',"
            "'',function(){") in out
    # ...and the menu's fold does not tuck it behind More
    assert "    'this slide':1,'this section':1,'animation':1};" in out


def test_the_pane_and_the_panel_use_the_same_word(out):
    assert "      if(cl.k==='out') return itemLabel(s,cl.i)+' disappears';" in out
    assert "      if(cl.k==='out') return 'Disappear';" in out
    assert "      cfgChip(r4,bic('exit'),'Disappear',leaving," in out


def test_help_says_how():
    html = assets.help_html()
    assert "<li><b>Making something disappear:</b>" in html
