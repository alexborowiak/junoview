"""Layouts of your own (T226).

The user, 2026-09-03: "It would be great if people could make their own
slide layouts."

Two things existed and neither was this. The built-in catalogue is a
fixed table in the source; "Save this slide's layout" records an
arrangement of a slide you already made, which is the right tool when
the slide exists and the wrong one when it does not -- you could not
design the shape you wanted and then fill it.

Driven in a browser: three slots placed and named "Panel over notes",
saved, chosen in the New slide gallery, and New slide built a slide with
a title, a figure panel and body text where they were put.
"""

from __future__ import annotations

from junoview import assets


def test_the_fragment_is_listed_or_it_is_dead_code():
    assert "52-layout-builder" in assets.DECK_PARTS
    assert assets.DECK_PARTS == tuple(sorted(assets.DECK_PARTS))
    assert assets.DECK_PARTS[-1] == "99-boot"


def test_the_catalogue_is_the_built_ins_plus_yours(out):
    """One list, so a layout of your own is a layout in every sense
    rather than a second kind of thing."""
    assert "  function allLayouts(){" in out
    assert ("    var mine=(pres&&Array.isArray(pres.layouts))?pres.layouts:[];\n"
            "    return LAYOUTS.concat(mine.filter(function(l){\n"
            "      return l&&l.id&&Array.isArray(l.items);}));") in out
    assert ("    allLayouts().forEach(function(l){if(!hit&&l.id===id) hit=l;});"
            in out)
    assert ("      var list=allLayouts().filter(function(l){\n"
            "        return !!l.poster===isPoster&&l.id!=='blank';});") in out
    # the pickers cache what they drew, so the stamp counts yours
    assert ("      var stamp=variant+':'+"
            "((pres&&pres.layouts)?pres.layouts.length:0);") in out
    assert "      row.dataset.built=stamp;row.innerHTML='';" in out


def test_the_builder_is_a_board_some_slots_and_a_name(out):
    html = assets.deck_html()
    assert 'class="img-ov" id="lay-make"' in html
    for cid in ("lay-make-body", "lay-make-close", "lay-make-new"):
        assert f'id="{cid}"' in html, cid
    assert 'id="hm-lay-new"' in html
    assert "New layout&#8230;</button>" in html
    assert "  function layoutBuilderBoot(){" in out
    assert "  layoutBuilderBoot();" in out
    # four kinds of slot, and what each becomes
    assert "  var LB_SLOTS=[" in out
    assert "    ['title','Title',{k:'text',w:88,h:12,text:'Title',size:5,b:1}]," in out
    assert "    ['cell','Figure panel',{k:'cell',w:44,h:50}]" in out
    # drag to move, grip to resize, both in page percent
    assert "addEventListener('pointerdown',function(e){drag(e,'move');});" in out
    assert "addEventListener('pointerdown',function(e){drag(e,'size');});" in out
    assert "            it.x=Math.max(0,Math.min(100-ow," in out
    # ...and the numbers, for the same reason the design screen has them
    assert "      [['x','X'],['y','Y'],['w','Width'],['h','Height']]" in out


def test_saving_one_puts_it_in_the_gallery(out):
    assert "else list.push({id:mintLayoutId(),label:label," in out
    assert "      lbInvalidate();\n      renderLayoutPicker();" in out
    assert "  function lbInvalidate(){" in out
    # an existing one can be edited or deleted
    assert "      if(hit){hit.label=label;hit.items=deep(lbItems);}" in out
    assert "          lbEdit=l.id;lbName=l.label;lbItems=deep(l.items||[]);" in out
    assert "rm.title='Slides already laid out this way keep their boxes';" in out


def test_a_layout_of_your_own_survives_a_save(out):
    """THE BUG CLASS THE PARITY TEST EXISTS FOR. A deck key the browser
    keeps and the Python rebuild sheds works perfectly until the deck is
    saved to the project and reopened."""
    assert "      layouts:pres.layouts||[]," in out          # the undo snapshot
    assert "    if(Array.isArray(p.layouts)&&p.layouts.length){" in out
    assert "        if(LAYOUTBYID&&LAYOUTBYID[l.id]) return;" in out
    # ...and the Python side carries it
    from pathlib import Path
    py = (Path(assets.__file__).parent.parent / "notebook"
          / "presentations.py").read_text(encoding="utf-8")
    assert 'if isinstance(p.get("layouts"), list) and p["layouts"]:' in py
    assert 'entry["layouts"] = lays' in py
