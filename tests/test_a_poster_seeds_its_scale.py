"""T278: a poster template seeds the page's type scale, and it survives.

A poster's type is sized to the sheet -- 1.9% of an A0 is a section
heading where Heading 2 is 3.8 -- so stamping the built-in names on the
poster slots would have made every poster read as drift from the moment
it was created, and seeding pres.styles from the template did not
survive applyStyleSet's wholesale replace. The seed is its own layer
now: `pres.scale`, one size per type, read by styleDef between the
built-in and the deck's overrides; a style set brings its faces,
weights and colours and takes the page's size for every type the scale
names.

Driven live on an A0 portrait page: the 3-column template gave 14
typed boxes and the standardiser reported no drift; the Bold set left
every size where it was; Ctrl+Z after the template took the scale away
with the boxes.
"""

from __future__ import annotations

from junoview.notebook.deck_schema import DECK_KEYS


def test_the_template_seeds_the_scale(out):
    assert ("    if(layout.poster&&layout.scale) "
            "pres.scale=deep(layout.scale);") in out


def test_the_scale_sits_between_the_built_in_and_the_override(out):
    fn = out.split("  function styleDef(id){")[1].split("\n  }")[0]
    assert ("      var sc=pres&&pres.scale&&pres.scale[k];\n"
            "      if(sc>0) out.size=sc;\n"
            "      if(over) Object.keys(over).forEach(function(p){"
            "out[p]=over[p];});") in fn


def test_a_style_set_keeps_the_page_scale(out):
    fn = out.split("  function applyStyleSet(id){")[1].split("\n  }")[0]
    assert "      if(pres.scale&&pres.scale[k]>0) o.size=pres.scale[k];" in fn
    assert fn.index("o.size=pres.scale[k]") < fn.index("pres.styles=next;")


def test_a_slide_page_drops_it_and_undo_and_save_carry_it(out):
    assert "        if(!pg.poster) delete pres.scale;" in out
    assert "      scale:pres.scale||null," in out
    # ...and read back by undo, or Ctrl+Z after a template would keep it
    assert ("     'guides','masters','layouts','page','cropMarks','live',\n"
            "     'scale']") in out
    assert "'components','cuts','guides','masters','bib','cite','slot','scale']" in out
    assert "scale" in DECK_KEYS
