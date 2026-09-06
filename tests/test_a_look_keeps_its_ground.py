"""A style's background and edge reach every door that reads a style (T314).

The user, 2026-09-06: "themes ... that apply to all texts, e.g. one that is
called business that has something like slate grey background on all text
boxes, and like a deep blue heading".

Both halves were already style fields -- `bg` and `bdc` joined
STYLE_FIELDS on 2026-09-03, applyStyleTo bakes them and the renderer draws
them. What was missing is that six consumers written before that day never
learned them, so the very gestures a person uses to BUILD a colour look
stripped it: promoting a hand-painted slate box to its style deleted the
slate, applying a set left the previous set's grounds standing, and every
specimen showed a colour set as if it were a grey one.
"""

from __future__ import annotations


def test_promoting_a_box_keeps_its_background(out):
    """"Update the style from this box" rebuilt the override by hand from
    four fields. The read-back is the one helper now, and it goes through
    applyStyleTo's own mapping of a style's `bg` onto a.bg/a.bgc."""
    assert "  function styleFromBox(a){" in out
    assert "    var bg=(a.bg===0)?'none':(a.bg?(a.bgc||''):'');" in out
    assert "    if(bg) o.bg=bg;" in out
    assert "    if(a.bdc) o.bdc=a.bdc;" in out
    assert "        var look3=styleFromBox(a3);" in out
    # and the "every heading" door carries the ground with the colour
    assert "          var look4=styleFromBox(a4);" in out
    assert "          ['b','i','font','color','bg','bdc'].forEach(function(k){" \
        in out


def test_a_set_zeroes_every_field_it_does_not_name(out):
    """The spell-out loop was a hand-kept six that stopped at pspace, so
    a set that said nothing about backgrounds left the previous set's
    slate boxes under its own headings. STYLE_FIELDS is the one list."""
    body = out.split("function applyStyleSet(id){")[1].split("\n  }")[0]
    assert ("      STYLE_FIELDS.forEach(function(p){\n"
            "        if(o[p]===undefined) o[p]=0;});") in body
    assert "['b','i','font','color','lh','pspace']" not in body


def test_every_specimen_shows_the_ground(out):
    """A look is chosen by looking. The gallery card, the Text styles
    menu row and the Text styles window row all painted colour and face
    and never the box behind them; the design rail gets a second chip,
    because its name is deliberately left unpainted (T295)."""
    assert "  function specimenGround(el,d){" in out
    assert "      el.style.background=tokVal(d.bg);" in out
    assert "specimenGround(ln,d);" in out       # the gallery card
    assert "        specimenGround(t,d);" in out    # the menu row
    assert "        specimenGround(spec,d);" in out  # the window row
    assert "        chipBg.className='dg-swatch dg-swatch-bg';" in out


def test_a_saved_set_keeps_the_palette_its_colours_mean(out):
    """A style's colour may be '@accent'. A saved set that carried the
    name without what it meant resolved to the NEXT deck's accent, or the
    default teal -- and applyStyleSet has honoured a set's tokens since
    T12 on a branch nothing reached."""
    assert "        tokens:deep(tokens())});" in out


def test_the_standardiser_sees_the_ground(out):
    """A box that lost its style's background is a mismatch, and adopting
    a band samples the ground so a slate band stays slate."""
    assert ("    if(((a.bg===0)?'none':(a.bg?(a.bgc||''):''))!==(d.bg||'')) "
            "return false;") in out
    assert "    if((a.bdc||'')!==(d.bdc||'')) return false;" in out
    assert "     ['lh',0],['pspace',0],['bg',''],['bdc','']].forEach(function(pr){" \
        in out
