"""The strip frame, and an empty text box that stays (T203).

The user, 2026-09-02, on the layout strip: "The side scrolling bars are
good, but the ends kind of just disappear and looks odd, maybe they need
a line on the other side or a box around the whole thing. The horizontal
scroll bar is too small and overlaps with them. There needs to be an
arrow or something below, that when you click you can see all options."
And: "When a text box has no text, when you click object it disappears.
Text boxes with no text should still be there."
"""

from __future__ import annotations

STRIPS = ("page-strip", "anim-strip", "shape-strip", "layout-strip")


def test_every_tile_strip_sits_in_a_frame_with_a_door(out):
    """Five strips, each in a frame that is the tall cell, each with a
    chevron at its end that names what it shows."""
    for sid in STRIPS:
        assert f'class="rbn-tall strip-frame" id="{sid}-frame"' in out, sid
        assert f'id="{sid}"\n' in out, sid
        assert f'<button class="strip-more" type="button" id="{sid}-more"' in out, sid
    # the strip itself is no longer the tall cell (the Keep up to date
    # tiles are three, never scroll, and keep their own tall cell)
    for cls in ("fx-strip page-strip", "fx-strip tx-strip", "fx-strip shape-strip",
                "fx-strip lay-strip"):
        assert f'class="rbn-tall {cls}"' not in out, cls
    assert 'class="rbn-tall fx-strip" id="anim-strip"' not in out
    # the door's words
    assert 'aria-label="Show every layout"' in out
    assert 'aria-label="Show every effect"' in out


def test_the_frame_has_an_edge_and_arrows_instead_of_a_scrollbar(out):
    """T207: the gallery the PowerPoint way. One row of whole tiles in
    sight, the rest wrapped beneath, an up/down/more column at the right,
    no scrollbar anywhere ("bit messy with the bottom scroll bar")."""
    assert ".strip-frame{display:flex;align-items:stretch;height:65px;" in out
    assert "::-webkit-scrollbar" not in out.split(".strip-frame{")[1][:1200]
    assert (".strip-frame>.fx-strip{height:63px;padding:4px 4px 0;"
            "box-sizing:border-box;") in out
    assert "flex-wrap:wrap;align-content:flex-start;overflow:hidden;" in out
    assert "width:calc(4 * 72px + 3 * 4px + 8px);}" in out
    assert (".strip-frame>.fx-strip.page-strip{"
            "width:calc(3 * 72px + 2 * 4px + 8px);}") in out
    assert ".strip-nav{flex:none;width:18px;display:flex;flex-direction:column;" in out
    for sid in STRIPS:
        assert f'<button class="strip-prev" type="button" id="{sid}-prev"' in out, sid
        assert f'<button class="strip-next" type="button" id="{sid}-next"' in out, sid
    assert "var ROW=60;" in out
    assert "prev.setAttribute('aria-disabled',top<=1?'true':'false');" in out
    assert "new ResizeObserver(function(){ends();}).observe(strip);" in out
    start = out.index('.strip-more[aria-expanded="true"]')
    rule = out[start:out.index("}", start)]
    assert "var(--accent-deep,var(--cyan-deep))" in rule


def test_show_all_moves_the_strip_into_a_window_and_back(out):
    """The strip element itself goes into the window, so every tile keeps
    the wiring its builder gave it; the overlay owner hides the window,
    and the observer puts the strip home."""
    assert "function stripMoreBoot(){" in out
    assert "  stripMoreBoot();" in out
    assert "panel.className='sh-menu strip-all';" in out
    assert "panel.id=strip.id+'-all';" in out
    assert "panel.appendChild(strip);" in out
    assert "frame.insertBefore(strip,nav||more);" in out
    assert "}).observe(panel,{attributes:true,attributeFilter:['hidden']});" in out
    assert "setTimeout(function(){overlayHide(panel);},0);" in out
    assert ".sh-menu.strip-all .fx-strip{display:flex;flex-wrap:wrap;" in out
    # the ribbon layouts move the frame, strip and door together
    # (...and a segmented run since T209: B I U travel as one)
    assert "el.closest('.opt-drop,.strip-frame,.rbn-cell')" in out


def test_an_empty_text_box_stays_visible(out):
    assert ".deck.editing .an-item.an-text .an-tx:empty::before{" in out
    assert ('.deck.editing .an-item.an-text .an-tx[contenteditable="true"]'
            ":empty::before{") not in out
    assert ".deck.editing .an-item.an-text:not(.sel):has(.an-tx:empty){" in out
