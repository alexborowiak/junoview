"""A flip book: one big "+ Add", no dead colour door, a page that turns
as an animation (T234).

The user, 2026-09-04: "for the flip books the 'Figure' button really
needs to be the first button and a big button, not small and hidden.
And it should just be called '+ Add', and then there are the options
there. Why do flip books even have a colour? What does that do? Also
how do the animations work with the flip books. Can there be a make
each flip an animation that appears in animations when selected."

Driven with a three-figure book at 1700px: the tile is 72x56 and the
first control in Picture, its menu holds the three things you can do to
the contents, the Colour door and its swatch row are hidden, the
Animation tab grows a Flip book group reading "3 figures - 2 clicks",
and turning a page adds the keyframe class exactly once per turn (and
not on an idle redraw).
"""

from __future__ import annotations

import re

from junoview import assets


def _row(html: str, label: str) -> str:
    fmt = html.index('<span class="et-fmt" id="et-fmt" hidden>')
    lab = html.index('<span class="rbn-lab">' + label + "</span>", fmt)
    row = html.rfind('<span class="rbn-row">', fmt, lab)
    return html[row:lab]


def test_add_is_the_first_control_and_a_tile():
    html = assets.deck_html()
    ids = re.findall(r'\bid="([a-z0-9-]+)"', _row(html, "Picture"))
    assert ids[0] == "fmt-figures", ids[:3]
    assert 'class="fx-tile big-tile rbn-tall" id="fmt-figures"' in html
    assert "<span>Add</span></button>" in html
    # rbn-tall is what makes it span both rows AND count as two columns
    assert ".rbn-row>#fmt-figures.big-tile{width:72px;height:56px;" \
        in assets.deck_css()


def test_the_options_are_in_it(out):
    assert "  function flipAddMenu(btn,idx){" in out
    assert "    menuHead(m,'put figures in this book');" in out
    assert "    row('Figures from a notebook\\u2026','cellcard'," in out
    assert "    row('Pictures from this computer\\u2026','image'," in out
    assert "    menuHead(m,'the pages it has');" in out
    assert "    row('Reorder and name them\\u2026','list'," in out
    # inside #deck, on the overlay stack
    assert "    deckEl.appendChild(m);\n    overlayShow(btn,m);floatMenu(btn,m);" in out
    # a hidden leftover must not read as open, or the next press closes nothing
    assert ("      if(open&&!open.hidden)"
            "{overlayHide(open);open.remove();return;}") in out
    assert "      if(open) open.remove();" in out


def test_a_flip_book_has_no_colour(out):
    """Nothing renders a.color for one -- applyCommon writes opacity and
    rotation and stops -- so the door did nothing at all."""
    assert "    var hasInk=(kind!=='image'&&kind!=='flip');" in out
    assert "    show('#fmt-txcol-btn',hasInk);" in out
    assert "    show('#fmt-txquick',hasInk);" in out


def test_the_page_turn_is_an_animation(out):
    html = assets.deck_html()
    assert '<span class="rbn-grp rbn-flipfx" data-tab="animation"' in html
    assert '<span class="rbn-lab">Flip book</span>' in html
    for k in ("none", "fade", "rise", "zoom"):
        assert f'id="anim-flip-{k}"' in html, k
    assert 'id="anim-flip-say"' in html
    assert "  var FLIP_FX=[['','None'],['fade','Fade'],['rise','Float up']," in out
    assert "  function flipFxBoot(){" in out
    assert "  flipFxBoot();" in out
    assert "        if(pr[0]) a.fanim=pr[0]; else delete a.fanim;" in out
    # the readout answers "how do animations work with flip books"
    assert "      say.querySelector('b').textContent=n" in out
    assert "        ?(n+' figure'+(n===1?'':'s')+' \\u00b7 '+clicks+' click'" in out
    # ...and the group stands down with nothing to say
    assert "    if(run) run.hidden=!a;" in out
    assert "      flipFxSync();" in out


def test_the_turn_is_a_moment_not_a_diff(out):
    """flipGo calls markDirty and then renderSlide, and markDirty renders
    too, so one arrow press rebuilds the stage more than once. A
    since-the-last-render test fired on the first pass and the second
    pass rebuilt the same node without the class (caught by driving it)."""
    assert "  var flipSeen={},flipTurn={},FTURN_MS=400;" in out
    assert "        if(flipSeen[fkey]!==at){" in out
    assert "          if(flipSeen[fkey]!=null) flipTurn[fkey]=Date.now();" in out
    assert ("        if(a.fanim&&motionOK()&&flipTurn[fkey]\n"
            "          &&(Date.now()-flipTurn[fkey])<FTURN_MS)\n"
            "          fst.className+=' fturn fturn-'+a.fanim;") in out
    css = assets.deck_css()
    for k in ("fade", "rise", "zoom"):
        assert f"@keyframes fturn-{k}{{" in css, k
        assert f".an-flipstage.fturn-{k}{{animation:fturn-{k}" in css, k
    assert ("@media (prefers-reduced-motion: reduce){\n"
            "  .an-flipstage.fturn{animation:none!important;}}") in css


def test_the_animations_list_names_the_effect(out):
    assert ("                +(a.fanim?(' \\u00b7 '"
            "+flipFxWord(a.fanim).toLowerCase())") in out
