"""One colour door, and a quick row that is your own history (T232).

The user, 2026-09-04: "The colours is confusing how there is you can
still click on the drop down menu and then there is also the quick
colour list. When clicking the dropdown menu there should be the
transparency adjustor there and all the custom colour stuff that
shouldn't be behind another menu. The quick colour list should also be
the last colours used. Both the background and the text should have
transparency options as well."

Driven at 1700px: the Colour door opens on a menu that reads Recently
used / This deck's colours / Standard colours / Any other colour, with
the hex box, the rgb box and the transparency slider in it; dragging
the slider previewed the box going see-through; Apply closed the menu
and the colour appeared at the head of both quick rows.
"""

from __future__ import annotations

from junoview import assets


def test_the_picker_is_the_bottom_of_the_menu_not_a_menu_inside_it(out):
    html = assets.deck_html()
    # the two rainbow "+" chips that opened a second popup are gone
    assert 'id="sw-custom"' not in html
    assert 'id="swbg-custom"' not in html
    assert "    var swc=$('#sw-custom');" not in out
    # ...and the one picker element is mounted into whichever door opened
    assert "  function cpMountInline(menu,target){" in out
    assert "    cpEl.classList.add('cp-inline');" in out
    assert "    menu.appendChild(cpEl);" in out
    assert ("      cpMountInline(menu,target);"
            "  /* the picker IS the menu (T232) */") in out
    # it is one element, so it goes home when the menu closes
    assert "  function cpUnmount(){" in out
    assert "  var cpHome=cpEl?cpEl.parentNode:null;" in out
    assert "      if(menu.hidden){pvEnd(false);cpUnmount();}})" in out
    # ...including when the line panel wants it as a floating popup
    assert "    cpUnmount();\n    var rcf=$('#cp-recent');" in out


def test_both_doors_carry_the_transparency_slider(out):
    """It was in the popup behind the chip, so neither door had it."""
    html = assets.deck_html()
    assert 'id="cp-alpha"' in html
    # one element, mounted for text and for fill alike
    assert ("  [['#fmt-txcol-btn','#fmt-txcol-menu','text'],\n"
            "   ['#fmt-fillcol-btn','#fmt-fillcol-menu','fill']]") in out
    # and a section, not a card: no border, no shadow, no width of its own
    assert (".sw-menu>.color-pop.cp-inline{flex:0 0 100%;position:static;"
            "width:auto;") in out
    assert ".cp-recent[hidden]{display:none!important;}" in out
    # ...and only the two colour menus widen for it: .sw-menu is also
    # the line panel's stroke-WIDTH menu
    assert "#fmt-txcol-menu,#fmt-fillcol-menu{width:216px;}" in out


def test_apply_closes_the_menu_it_is_mounted_in(out):
    """Hiding the section inside an open menu would leave a door standing
    over a hole."""
    assert "    var host=(cpEl&&cpEl.classList.contains('cp-inline'))" in out
    assert "    if(host) overlayHide(host); else if(cpEl) overlayHide(cpEl);" in out


def test_every_colour_you_pick_is_a_colour_you_used(out):
    """One history, written by every path -- so the row can read it."""
    assert "  function recentColors(){" in out
    assert "  function pushRecentColor(str){" in out
    assert "    quickSwatchSync(true);" in out
    assert "  function applyTextColor(c){\n    pushRecentColor(c);" in out
    assert ("  function applyFillColor(c){pushRecentColor(c);"
            "fmtApply(fillMut(c));}") in out
    assert "    pushRecentColor(str);" in out
    # cpPushRecent/cpRecent were a second copy of the same store
    assert "function cpPushRecent" not in out
    assert "function cpRecent()" not in out


def test_the_quick_row_is_the_colours_you_last_used(out):
    assert "  function quickRow(){" in out
    assert "    recentColors().forEach(function(s){" in out
    # ...padded with the deck's own, so a fresh deck still leads with its six
    assert "      if(out.length>=6||seen[ref]) return;" in out
    assert "      var row=quickRow();" in out
    assert "          b.style.background=tokVal(ref);" in out
    assert "          b.title=colorLabel(ref)" in out
    # a deck reference stays a reference, so a recent that IS the accent
    # still follows the deck
    assert "  function colorLabel(str){" in out
    assert "    var k=tokRef(str);" in out
    # ...and changing a deck colour repaints the row
    assert "    quickSwatchSync(true);\n    refresh();" in out


def test_the_menu_reads_recent_then_deck_then_standard(out):
    html = assets.deck_html()
    i = html.index('id="fmt-txcol-menu"')
    seg = html[i:i + 400]
    assert '<span class="sw-recrow" hidden></span>' in seg
    assert 'class="fmt-lab sw-stdlab" id="fmt-txlab"' in seg
    # the deck row is built in between, not at the very top as before
    assert "        menu.insertBefore(row,menu.querySelector('.sw-stdlab'));" in out
    assert "    lab.className='fmt-lab';lab.textContent='Recently used';" in out
    assert "    var rec=recentColors().slice(0,7);" in out


def test_opening_the_door_keeps_the_caret(out):
    """The picker inside it could otherwise only ever colour the whole
    box, because clicking the door blurred the words."""
    assert ("    btn.addEventListener('mousedown',function(e){\n"
            "      if(activeTextEditable()) e.preventDefault();});") in out
