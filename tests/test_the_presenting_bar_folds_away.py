"""T581: presenting starts with its bar folded away.

The user, 2026-09-30: "why does present mode have these options up the
top. They are distracting and not necessary. I would also want options to
be things that are collapsable by default not always there."

Stop presenting, Open now and Running late sat across the top of the
audience's screen for the whole talk. Now only a faint Controls tab shows;
the pointer at the top edge brings the bar for a moment, the tab keeps it
until Hide, and Esc still stops presenting.

Driven in Chromium: on entering Present the bar's bottom edge was at 0
and its opacity 0; the pointer at y=3 brought it (bottom 51px); moving
away folded it again after a beat; the tab pinned it through a pointer
move; Hide folded it; Esc went back to the editor.
"""

from __future__ import annotations

from junoview import assets


def test_the_bar_has_a_name_a_tab_and_a_hide():
    html = assets.deck_html()
    assert '<div class="deck-top" id="deck-top-bar">' in html
    assert '<button class="deck-top-handle" id="deck-top-handle" type="button"' \
        in html
    assert '><i data-ic="menu"></i> Controls</button>' in html
    assert '<button class="dbtn" id="deck-top-fold" type="button"' in html
    assert '><i data-ic="collapse"></i> Hide</button>' in html


def test_while_presenting_it_is_out_of_the_grid_and_above_the_edge():
    css = assets.deck_css()
    assert (".deck:not(.editing):not(.creating) .deck-top{position:absolute;"
            in css)
    rule = css.split(".deck:not(.editing):not(.creating) .deck-top{")[1] \
        .split("}")[0]
    assert "transform:translateY(-100%);opacity:0;" in rule
    assert "pointer-events:none;" in rule
    # three ways back: peek, pinned, a focused control
    assert ".deck.top-peek:not(.editing):not(.creating) .deck-top," in css
    assert ".deck.top-pinned:not(.editing):not(.creating) .deck-top," in css
    assert ".deck:not(.editing):not(.creating) .deck-top:focus-within{" in css
    # the tab is never in the editor, and goes while the bar is out
    assert ".deck.editing .deck-top-handle,.deck.creating .deck-top-handle," \
        in css


def test_the_top_edge_peeks_and_the_tab_pins(out):
    assert "  function presBarBoot(){" in out
    assert "      if(!peek){if(e.clientY<=6) presBarPeek(true);return;}" in out
    # leaving lets it go a beat later, never while the drawer is out
    assert "      if((r&&e.clientY<=r.bottom+14)||(dr&&!dr.hidden)){" in out
    assert "      e.stopPropagation();presBarPin(true);});" in out
    assert "    lsSet(PRESBAR_KEY+SCOPE,presBarPinned?'1':'0',true);" in out
    assert "  presBarBoot();              /* the presenting bar folds away (T581) */" \
        in out
    # every talk starts folded unless it was kept
    assert "    if(typeof presBarPeek==='function') presBarPeek(false);" in out


def test_help_says_where_it_went():
    assert "<li><b>The presenting bar is folded away.</b>" in assets.help_html()
