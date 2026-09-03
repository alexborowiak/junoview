"""The 2026-09-03 morning review (T215-T217).

"This is looking much better now... some of the text is maybe too small
now... the tight, normal, airy are all on different columns and empty
below. Also the tidy page is weirdly by itself. Perhaps the slide stuff
should be first as well. The masters box is already really weird. The
layers is really important that needs to go in home, and the full screen
needs to go up the top where present is. Present also needs its own tab
with all those options as buttons now... the timing should go next to
the effect. Also the button 'animation order' should be called
'animation pane'... 'numbers' should be 'page numbers'. I still don't
get what the Palette button is for, and don't know why it has an
ellipsis... the fix mismatched text is good I think, but I am really
confused by it... Style systems... a lot of the text can't be read."
"""

from __future__ import annotations

import re

import junoview.assets as assets


def _row(html: str, label: str) -> list[str]:
    fmt = html.index('<div class="edit-tools ribbon"')
    lab = html.index('<span class="rbn-lab">' + label + "</span>", fmt)
    row = html.rfind('<span class="rbn-row">', fmt, lab)
    return re.findall(r'\bid="([a-z0-9-]+)"', html[row:lab])


def test_design_and_animation_are_ordered_as_asked(out):
    assert ".rbn-slide{order:0;}" in out
    assert ".rbn-anim{order:1;}" in out and ".rbn-timing{order:2;}" in out
    assert ".rbn-build{order:3;}" in out and ".rbn-order{order:4;}" in out
    html = assets.deck_html()
    lay = _row(html, "Layout")
    assert lay.index("hm-lay-tidy") < lay.index("dsg-tidy")     # Spacing over Tidy page
    assert "dsg-tidy" not in _row(html, "Slide")


def test_the_words_the_review_asked_for(out):
    html = assets.deck_html()        # the renderer turns each icon token into svg
    assert '<i data-ic="numbers"></i> Page numbers</button>' in html
    assert '><i data-ic="play"></i> Animation pane</button>' in html
    assert "<span>Animation pane</span>" in out
    assert "Deck colours &#9662;</button>" in out
    assert "Palette&#8230;" not in out
    assert "menuHead(m,'deck colours');" in out
    assert "These six colours are shared by the whole deck." in out


def test_the_masters_panel_is_a_panel(out):
    assert (".sh-menu.mast-panel{display:block;position:fixed;left:auto;right:16px;"
            "top:110px;") in out
    assert "width:320px;max-height:70vh;overflow-y:auto;" in out


def test_the_present_tab_and_its_buttons(out):
    assert 'id="rbn-tab-present" role="tab" data-tab="present"' in out
    # (Insert became Images and Text in T220)
    assert ("var TABS=['home','images','text','design','animation','view',\n"
            "    'present','object'];") in out
    assert "{id:'view',label:'View'},{id:'present',label:'Present'}" in out
    for cid in ("pr-here", "pr-start", "pr-presenter", "pr-talk", "pr-notes",
                "pr-tap", "pr-trace"):
        assert f'id="{cid}"' in out, cid
    assert '<span class="rbn-lab">Play</span>' in out
    assert '<span class="rbn-lab">During the talk</span>' in out
    # every button presses the menu row of the same name
    assert "[['pr-here','pl-here'],['pr-start','pl-start']," in out
    assert "function presentTabSync(){" in out
    assert "var on=/:\\s*on\\s*$/.test(row.textContent||'');" in out
    assert "  presentTabBoot();" in out
    assert 'body.th-colorful .rbn-grp[data-tab="present"]{' in out


def test_full_screen_is_up_top_and_layers_is_on_home(out):
    top = out[out.index('<div class="deck-top">'):out.index('id="dc-play"')]
    assert 'class="dbtn qat-full" id="vw-full"' in top
    assert "['vw-full','Full screen']," not in out          # no longer folds with View
    assert 'class="fx-tile big-tile" id="hm-layers"' in out
    assert '<span class="rbn-lab">Show</span>' in out
    assert ("hl.setAttribute('aria-pressed',"
            "ob.getAttribute('aria-pressed')||'false');") in out


def test_big_screen_text_and_readable_style_system(out):
    assert "@media (min-width:1600px){" in out
    # (a half step over T219's resting 12px: a whole one folded a group
    # on a 1800px monitor)
    assert "  .edit-tools .dbtn.rbn-sm,.edit-tools .dbtn.etm{font-size:12.5px;}" in out
    assert "      nm.style.color='';" in out
    assert "    spec.style.background=tokVal((pres&&pres.pageBg)||'#0b141d');" in out
    assert ".dg-sub{margin:0 0 10px;font-size:12.5px;" in out


def test_mismatched_text_in_plain_words(out):
    assert "return 'They match each other now. Give them the '+d.label" in out
    assert "act.textContent='Give all '+f.band.boxes.length+' the '" in out
    assert "alt.textContent='Just make them match, no style';" in out
    assert "+'longer match the style'," in out
    assert "Boxes that look alike should share a named" in out
