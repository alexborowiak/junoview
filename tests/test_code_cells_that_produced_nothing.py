"""Fold or remove the code cells that produced nothing (T256).

The user, 2026-09-04: "would be good to have an option - remove/fold
code cells without output, as a lot of the times these are the ones
that I don't care about."

A cell that printed nothing and drew nothing is usually setup -- the
imports, the grid, the intermediate transform -- read once and never
wanted again. Seven of the example notebook's 27 cards are exactly
that.

It rides the Code-types map rather than becoming a fourth top-level
filter, because it is the same question that menu already asks (which
code cells do I see) and it inherits the whole tri-state machine: its
own On / Fold / Off, per section, surviving Reset the same way. And
because such a cell has no plot part and no output part, "hide its
code" and "remove the card" are the same act -- filtGone falls out of
the existing rule rather than needing a new branch.

The door matters as much as the filter: the three chooser buttons under
Plots / Code / Output were icon-only funnels, which is both the rule
this project keeps ("buttons are words PLUS icons, never icon-only")
and the standing complaint about things hidden in menus. They say
"Choose" now, beside their funnel, matching the worded Reset next to
them.

Driven on the example notebook at 1440x900: Off hid exactly the seven
data-noout cards and nothing else, On brought all seven back, Fold kept
the cards and turned their code off, and a pinned cell stayed visible
under Off while its six peers went.
"""

from __future__ import annotations

import pathlib

from junoview import assets
from junoview.notebook.loader import load_doc
from junoview.render.items import render_item

EXAMPLE = pathlib.Path(__file__).resolve().parents[1] / (
    "examples/example_climate_analysis.ipynb")


def test_a_code_cell_with_no_output_is_stamped():
    doc = load_doc(EXAMPLE)
    stamped, total = [], 0
    for sec in doc.sections:
        for item in sec.items:
            html = render_item(item, sec.section_id)
            total += 1
            if 'data-noout="1"' in html:
                stamped.append(item.item_id)
                # it says what it means: code, and nothing came out
                assert not item.outputs, item.item_id
    assert total > 20
    # the example really does carry a useful number of them
    assert len(stamped) == 7, stamped
    assert "imports-plotting-style" in stamped


def test_a_markdown_note_is_never_stamped():
    """A note has no code, so "code that produced nothing" is not a
    thing it can be — data-noout must stay 0 for it."""
    doc = load_doc(EXAMPLE)
    notes = 0
    for sec in doc.sections:
        for item in sec.items:
            if not item.is_note:
                continue
            notes += 1
            assert 'data-noout="0"' in render_item(item, sec.section_id)
    assert notes > 0


def test_a_cell_that_produced_something_is_not_stamped():
    doc = load_doc(EXAMPLE)
    with_out = 0
    for sec in doc.sections:
        for item in sec.items:
            if item.is_note or not item.outputs:
                continue
            with_out += 1
            assert 'data-noout="0"' in render_item(item, sec.section_id)
    assert with_out > 5


def test_it_rides_the_code_types_map():
    app = assets.app_js()
    assert "          if(c.dataset.noout==='1'){" in app
    assert ("            var vno=otVal(ckHidden.nooutput); "
            "if(vno) ckExp.push(vno);}") in app
    # counted like every other row, so the menu can say how many
    assert "      if(c.dataset.noout==='1')" in app
    assert "        ckCounts.nooutput=(ckCounts.nooutput||0)+1;" in app


def test_the_row_is_first_and_reads_as_a_phrase():
    app = assets.app_js()
    assert "  var TYPE_LABEL={nooutput:'that produced nothing'};" in app
    assert "    tx.textContent=(TYPE_LABEL[t]||t)+' ('+count+')';" in app
    # the heading covers the whole list, because not every row is a "type"
    assert "    h.textContent='show code cells';m.appendChild(h);" in app
    # ...and it is added before the type rows
    menu = app.split("  function renderCkMenu(){")[1].split("\n  /* only one")[0]
    assert menu.index("'nooutput'") < menu.index("'ckmain-'+t")
    # a phrase must not be Title Cased by the one-word capitalize rule
    css = assets.load("css/app.css")
    assert ".ckf-row.ckf-phrase{text-transform:none;}" in css
    assert "    row.className='ckf-row'+(TYPE_LABEL[t]?' ckf-phrase':'');" in app


def test_it_is_never_mistaken_for_a_kind_of_code():
    """An override on the pseudo-row must not also be pushed into the
    type list, or it renders twice."""
    app = assets.app_js()
    assert ("      if(t==='titled'||t==='untitled'||t==='nooutput') return;"
            ) in app


def test_the_chooser_buttons_carry_a_word():
    """Icon-only was rejected twice, and an unlabelled funnel is also the
    door to this feature."""
    page = assets.load("html/page.html")
    for bid in ("pt-filter-btn", "ck-filter-btn", "ot-filter-btn"):
        btn = page.split(f'id="{bid}"')[1].split("</button>")[0]
        assert '<span class="btxt">Choose</span>' in btn, bid
        assert 'data-ic="types"' in btn, bid
    # and they are laid out like a worded button, not an icon square
    css = assets.load("css/app.css")
    assert ("#pt-filter-btn,#ck-filter-btn,#ot-filter-btn"
            "{width:100%;flex:none;}") in css


def test_the_tooltips_stopped_shouting():
    """"Advanced: hide specific CODE cell types" both shouted and named
    itself by its own difficulty; the tooltip says what the button does."""
    page = assets.load("html/page.html")
    assert "Advanced: hide specific" not in page
    assert "Choose which code cells you see" in page
    assert "Choose which plots you see" in page
    assert "Choose which printed output you see" in page
