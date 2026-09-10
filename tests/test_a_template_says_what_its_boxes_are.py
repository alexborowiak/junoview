"""A slide template declares what each of its boxes IS (T276).

The user, 2026-09-05: "Inserting new slides some of the layouts don't
have the boxes as the correct types, like heading are not of type
heading."

`a.style` -- a name from STYLE_DEFAULTS (title / h1 / h2 / h3 / body /
small / caption, plus types a deck invents) -- is the editor's ONLY
vocabulary of "heading". The LAYOUTS catalogue described each text slot
with geometry and a look, and not one of the fourteen slide slots
carried it, so a Title placeholder was 5%-of-page bold text and nothing
downstream could tell it from a bold sentence: not the outline, not
"apply to all headings", not the standardiser, not the .pptx export.

Driven live over all ten layouts that carry text, before and after:
every text box arrived `(NONE)`, and now arrives title @7.2, h1 @5 or
body @3.9 (the 21pt default) as the slot says.
"""

from __future__ import annotations

import re

# the built-in seven, with the size each one means
STYLE_SIZES = {
    "title": 7.2, "h1": 5.0, "h2": 3.8, "h3": 3.0,
    "body": 3.9, "small": 2.0, "caption": 1.7,
}


def _slide_layout_block(js: str) -> str:
    """LAYOUTS, up to where the poster templates begin."""
    i = js.index("  var LAYOUTS=[")
    j = js.index("{id:'poster-3col'", i)
    return js[i:j]


def test_every_slide_template_text_slot_declares_its_type(out):
    block = _slide_layout_block(out)
    slots = re.findall(r"\{k:'text',[^}]*\}", block)
    assert len(slots) >= 14, f"only found {len(slots)} text slots"
    untyped = [s for s in slots if "style:'" not in s]
    # exactly one, and it is the subtitle, which has no home in the seven
    assert len(untyped) == 1, untyped
    assert "Subtitle" in untyped[0], untyped[0]


def test_a_stamped_box_is_not_born_already_drifting(out):
    """A slot stamped `h1` at 4.4 when Heading 1 is 5.0 is reported as
    drift by stdMatchesStyle the moment the slide is made -- a worse
    answer than being untyped. So the sizes moved onto the style's own
    number in the same edit."""
    block = _slide_layout_block(out)
    for slot in re.findall(r"\{k:'text',[^}]*\}", block):
        m = re.search(r"style:'([a-z0-9]+)'", slot)
        if not m:
            continue
        sid = m.group(1)
        assert sid in STYLE_SIZES, f"unknown type {sid} in {slot}"
        size = re.search(r"size:([0-9.]+)", slot)
        assert size, slot
        want, got = STYLE_SIZES[sid], float(size.group(1))
        # stdMatchesStyle's own tolerance is 1.03
        assert abs(got - want) / want <= 0.03, (
            f"{sid} slot is {got} where {sid} means {want}: {slot}")


def test_apply_layout_stamps_the_type_onto_a_new_box(out):
    """Written straight onto the box, never through applyStyleTo -- that
    would overwrite the template's own size, align and weight with the
    style's defaults. The template's LOOK wins; only the NAME is added.

    T368: and the name is the one you CHOSE for that slot. A layout
    names the base type -- title, h1, body -- so a variation you made
    and used everywhere still left every new slide on the plain parent
    (2026-09-07, user: "When you select a text style, new slides don't
    get applied with it"). ``pres.slot`` redirects the slot, and is set
    from the type's own page in the Style system.
    """
    assert "          var sid=it.style;" in out
    assert ("          if(sid&&pres.slot&&pres.slot[sid]"
            "&&styleDef(pres.slot[sid]))") in out
    assert "            sid=pres.slot[sid];" in out
    assert "          if(sid&&styleDef(sid)) nb.style=sid;" in out
    assert "          next.push(nb);" in out


def test_the_reuse_branch_deliberately_does_not_stamp(out):
    """applyLayout's other branch pairs EXISTING boxes to new slots by
    ordinal position (`texts[ti++]`), so stamping there would type a body
    paragraph as a Title merely because it came first. Re-laying a slide
    must not rename what is already on it."""
    i = out.index("  function applyLayout(s,layout){")
    body = out[i:out.index("  function layIcon(layout){", i)]
    reuse = body[body.index("var t=texts[ti++];"):body.index("} else {")]
    assert "style" not in reuse, reuse


def test_the_layout_builders_palette_names_real_types(out):
    """Its buttons are literally called Title, Heading and Body text, so
    a layout designed with them has to produce those."""
    assert "style:'h1'}]," in out
    assert "style:'h2'}]," in out
    assert "style:'body'}]," in out
    assert "          if(base.style) it.style=base.style;" in out


def test_the_poster_templates_are_left_alone_on_purpose(out):
    """Their type scale is the PAGE's, not the 16:9 ladder's -- 1.9% of
    an A0 is a section heading where Heading 2 is 3.8 -- so stamping the
    built-in names on them would make every poster read as drift from
    the moment it was created. Doing it properly needs the deck's own
    style overrides seeded from the template, and applyStyleSet replaces
    pres.styles wholesale, so a seed does not survive one click of any
    style set. Recorded as T278 rather than half-done."""
    js = out[out.index("{id:'poster-3col'"):]
    js = js[:js.index("  function applyLayout")]
    assert "style:'" not in js, "a poster slot has grown a built-in type"
