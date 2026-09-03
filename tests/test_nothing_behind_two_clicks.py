"""Nothing that matters sits behind two clicks (T220).

The user, 2026-09-03: "getting rid of the animations from the object
page would be good. This only needs to go on animations. This would
allow things like the text size to be actually always visible as it
should be. That should not be behind two clicks. Please think about
things like that... there should be a 'history of object' button... Oh
that is in the layers, there is too much hidden inside menus inside
menus inside menus inside menus, like in the layers. PLEASE FUCKING
STOP DOING THIS... Why does the text colour look like a T? I would
prefer if some of these were quick options that we can see. AGAIN,
DON'T HAVE EVERYTHING ALWAYS HIDDEN BEHIND SEVERAL CLICKS. What
happened to being able to insert text boxes by type. Please get rid of
QR code... Let's split Insert into Images and Text."

The Object tab paid for all of it by giving up its second copy of the
Animation tab. What the controls DO was driven in a browser at 1500px;
these pin where they live.
"""

from __future__ import annotations

import re

from junoview import assets


def _row(html: str, label: str) -> str:
    fmt = html.index('<span class="et-fmt" id="et-fmt" hidden>')
    lab = html.index('<span class="rbn-lab">' + label + "</span>", fmt)
    return html[html.rfind('<span class="rbn-row">', fmt, lab):lab]


def test_the_typeface_the_size_and_the_spacing_are_on_the_row(out):
    """Three controls that were one click into a window each. The size is
    one segmented cell: the number, its unit and the two steppers are one
    decision, so they can never land in different columns."""
    row = _row(assets.deck_html(), "Text")
    for cid in ("fmt-font", "fmt-sizecell", "fmt-szwrap", "fmt-size",
                "fmt-smaller", "fmt-bigger", "fmt-lhwrap", "fmt-lh-btn"):
        assert f'id="{cid}"' in row, cid
    assert 'class="rbn-cell rbn-seg" id="fmt-sizecell"' in row
    # the Font window and its door are gone, not merely emptied
    for gone in ('id="fmt-fontwrap"', 'id="fmt-font-btn"', 'id="fmt-font-menu"'):
        assert gone not in out, gone
    # strikethrough is the fourth segment of B I U, not a window's "more" row
    style = row[row.index('id="tx-run-style"'):row.index('id="tx-run-align"')]
    assert 'id="fmt-strike"' in style
    assert "<s>S</s> Strikethrough</button>" not in out
    # spacing keeps its menu and its id; only the door is new
    assert 'class="sh-menu opt-panel lh-menu" id="fmt-lh-menu"' in out
    assert "if(id==='fmt-lh-menu') return buildSpacingRows;" in out


def test_a_window_that_fills_on_open_is_not_empty(out):
    """THE BUG THIS ROUND SHIPPED AND THE BROWSER CAUGHT. syncOptDoors
    hides a door whose window has nothing live in it. The Paragraph
    window's rows are built when it opens; what kept the sweep happy was
    the spacing section sitting inside it. Move that out and the
    Paragraph door vanished for every text box -- green in 1,100
    substring tests, obvious in one browser."""
    assert "if(panel.dataset.built) return;" in out
    html = assets.deck_html()
    for mid in ("fmt-para-menu", "fmt-lh-menu"):
        i = html.index(f'id="{mid}"')
        assert 'data-built="1"' in html[i:i + 160], mid


def test_the_deck_s_six_colours_are_on_the_row(out):
    """Two runs, words and box, each holding the six colours the deck is
    actually built from -- stored as references, so a deck that changes
    its colours changes these too."""
    row = _row(assets.deck_html(), "Colour")
    for cid in ("fmt-txquick", "fmt-bgquick"):
        assert f'class="rbn-cell rbn-seg qk-cell" id="{cid}"' in row, cid
    assert "function quickSwatchBoot(){" in out
    assert "  quickSwatchBoot();" in out
    assert "b.dataset.c=ref;" in out and "var ref='@'+k,val=t[k];" in out
    assert "if(h.target==='text') applyTextColor(ref);" in out
    assert "      else applyFillColor(ref);" in out
    # they preview on hover through the same machinery the picker uses
    assert "pvShow(h.target==='text'?textMut(ref):fillMut(ref));" in out
    # ...and both doors stay, for every other colour
    assert 'id="fmt-txcol-btn"' in out and 'id="fmt-fillcol-btn"' in out
    assert ".qk-sw{width:15px;height:15px;border-radius:50%;" in out


def test_the_colour_picker_is_a_pad_not_a_letter_t(out):
    """It was swept in with the drawn line-style menu, whose rule stacks
    its rows in a column. With the deck-colour row across the top and
    every preset chip in a column beneath it, the popup was literally
    T-shaped."""
    assert ".sh-menu.style-menu{display:flex;flex-direction:column;" in out
    assert ".sh-menu.style-menu,.sh-menu.sw-menu{" not in out
    assert (".sh-menu.sw-menu{display:flex;flex-wrap:wrap;align-items:center;\n"
            "  gap:7px;width:198px;padding:10px 11px;}") in out
    assert ".sw-menu>.sw-tokrow,.sw-menu>.sw-recrow{flex:0 0 100%;}" in out
    # the headings inside it are visible again, and hidden still hides
    assert ".sw-menu .fmt-lab{display:block;flex:0 0 100%;" in out
    assert ".sw-menu [hidden]{display:none!important;}" in out


def test_history_is_a_button_not_a_menu_in_a_pane(out):
    """The per-object history (T10) existed and worked; its only doors
    were a canvas right-click and the Layers pane's Actions popover. It
    is a button on the Object tab now, opening the full-screen view the
    other reviews use, and the pane keeps working."""
    row = _row(assets.deck_html(), "Object")
    assert 'id="fmt-hist"' in row
    assert "show('#fmt-hist',isNum);" in out
    assert 'class="img-ov" id="oh-ov"' in out
    for cid in ("oh-ov-t", "oh-ov-sub", "oh-ov-close", "oh-ov-body"):
        assert f'id="{cid}"' in out, cid
    # one renderer, two hosts
    assert "function renderObjHistInto(list,head,ttl){" in out
    assert ("    renderObjHistInto($('#objhist-list'),$('#objhist-count'),\n"
            "      $('#objhist-t'));") in out
    assert ("    renderObjHistInto($('#oh-ov-body'),$('#oh-ov-sub'),"
            "$('#oh-ov-t'));") in out
    assert "function ohOverviewBoot(){" in out
    assert "  ohOverviewBoot();" in out
    # the door sets the object itself, so it does not depend on the pane
    assert "      ensureOids(s);\n      ohOid=a.oid;" in out
    # an edit redraws whichever of the two is open
    assert "    if(!quiet&&ohv&&!ohv.hidden) renderObjHistOverview();" in out
    assert ".oh-list{display:grid;" in out


def test_insert_is_images_and_text(out):
    """One tab held four galleries and eleven doors. Images keeps the
    figures, shapes and lines; Text gets the boxes, the table and the two
    notations -- and the room to show one tile per kind of box again."""
    html = assets.deck_html()
    assert 'id="rbn-tab-images" role="tab" data-tab="images"' in html
    assert 'id="rbn-tab-text" role="tab" data-tab="text"' in html
    assert 'id="rbn-tab-insert"' not in html
    assert ("var TABS=['home','images','text','design','animation','view',\n"
            "    'present','object'];") in out
    # a browser that remembers the old tab lands on the half with the
    # galleries rather than on Home
    assert "      if(t==='insert') t='images';" in out
    assert ("      tabs:[{id:'home',label:'Home'},{id:'images',label:'Images'},\n"
            "            {id:'text',label:'Text'},") in out

    def group(label):
        i = html.index(f">{label}</span>")
        return html[html.rindex('<span class="rbn-grp', 0, i):i]

    for cid in ("et-cell", "et-image", "et-flip"):
        assert f'id="{cid}"' in group("Place"), cid
    for cid in ("tx-strip", "et-table", "dc-maths", "dc-md"):
        assert f'id="{cid}"' in group("Write"), cid
    for cid in ("dc-line", "et-arrow", "dc-draw"):
        assert f'id="{cid}"' in group("Draw"), cid
    # the Drawing group follows whichever half armed the tool
    assert 'class="rbn-grp rbn-cancel" data-tab="images"' in html
    assert "    var cg=$('.rbn-grp.rbn-cancel');" in out
    assert "if(at==='images'||at==='text') cg.setAttribute('data-tab',at);" in out


def test_a_text_box_can_be_inserted_by_kind_again(out):
    """T188 had a tile per named type; T207 collapsed them to one to buy
    width. Text is its own tab now, so they are back, in a frame with the
    same arrows every other gallery has."""
    assert 'class="rbn-tall strip-frame" id="tx-strip-frame"' in out
    assert 'class="fx-strip tx-strip" id="tx-strip"' in out
    assert ("      var rows=[['','Text box',null]];\n"
            "      styleOrder().forEach(function(id){\n"
            "        rows.push([id,styleDef(id).label,styleDef(id)]);});") in out
    # the tile arms the tool for that kind, and textBorn honours it
    assert "          pendingStyle=r[0];\n          setTool('text');" in out
    assert ("if(pendingStyle&&styleDef(pendingStyle)) "
            "applyStyleTo(a,pendingStyle);") in out
    # a type of your own still gets a tile
    assert "if(typeof txStripSync==='function') txStripSync(true);" in out


def test_the_qr_code_feature_is_gone_whole(out):
    """Door, handler, ~240-line encoder, icon and every catalogue mention.
    A capability with no door is dead code that looks alive, so it went
    together rather than leaving the generator stranded."""
    for gone in ('id="dc-qr"', "QR code</button>", "var QR_M_TAB=",
                 "function qrMatrix", "function qrSvgData",
                 "window.SemDeckQr", "'dc-qr'", 'data-ic="qr"'):
        assert gone not in out, gone
    # existing decks are unaffected: a QR was inserted as an ordinary image
    assert "Existing decks are unaffected: a QR" in out


def test_the_object_tab_kept_its_five_unlabelled_groups(out):
    """Arrange, Colour, Text, Line & shape, Object -- plus Table. Losing
    Animation must not have taken anything else with it."""
    assert out.count('class="rbn-grp" data-tab="object"') == 5
    assert 'class="rbn-grp rbn-tbl" data-tab="object"' in out
    html = assets.deck_html()
    for lab in ("Arrange", "Colour", "Text", "Line &amp; shape", "Object",
                "Table"):
        assert f'<span class="rbn-lab">{lab}</span>' in html, lab
    # every id the Text row names is still exactly one control
    ids = re.findall(r'\bid="([a-z0-9-]+)"', _row(html, "Text"))
    assert len(ids) == len(set(ids)), ids
