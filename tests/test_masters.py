"""Masters — looks slides inherit live (T115).

The design the entry demanded be said out loud: a COMPONENT is reusable
content with instance identity (cmp/ci/cinst, push, detach); a MASTER
is slide-level INHERITANCE — `pres.masters[id] = {name, bg, cmp, pos}`,
worn by `sl.mast`. The master's furniture simply IS a component, so
"edit the look everywhere" is the component verbs that already ship,
and nothing was rebuilt. Resolution happens at render time, never by
stamping, so there are no copies to migrate and no flattened decks —
a deck without `mast` renders exactly as before.

Driven live 2026-08-31 (port 8629): a "Branded" master created in the
panel (opened from the Layouts menu row), background #123a2b via its
row, a two-object "Logo strap" component cycled in as furniture at the
bottom-right, "Wear it — every slide". Slide 2 inherited page + strap;
slide 3's own bg (#334455) beat the master's while still wearing the
strap; recolouring the slide-1 INSTANCE and "Push this look" turned
slide 2's furniture pink on its next paint — live inheritance, the
point of the feature; and a full reload brought all of it back through
normPres and the project file.
"""

from __future__ import annotations

from junoview import assets


def _out() -> str:
    return assets.deck_js()


def test_a_master_is_resolved_at_render_time_never_stamped():
    out = _out()
    assert "function mastOf(s2){" in out
    assert "function mastSynth(m){" in out
    # the render seam: furniture drawn behind everything on every paint
    assert "ml.className='slide-mast';" in out
    assert "var m0=mode;mode='view';" in out
    assert "try{renderAnnots(ml,msyn);}finally{mode=m0;}" in out
    # inert: the editor cannot select into the inherited layer
    css = assets.deck_css()
    assert ".slide-mast{position:absolute;inset:0;pointer-events:none;" in css


def test_background_resolves_slide_then_master_then_deck():
    out = _out()
    assert ("var bg=tokVal((s0&&s0.bg)||mbg||(pres&&pres.pageBg)"
            "||'#0b141d');") in out


def test_the_deck_and_slide_carry_masters_through_every_normaliser():
    """normPres (both loops), the Python rebuild (parity sentinels pin
    it automatically) and the schema tables all name the two keys."""
    from junoview.notebook.deck_schema import DECK_KEYS, SLIDE_KEYS
    from junoview.notebook.presentations import as_presentations

    assert "masters" in DECK_KEYS and "mast" in SLIDE_KEYS
    out2 = as_presentations([{"name": "d",
        "masters": {"m1": {"name": "Branded", "bg": "#123a2b",
                           "cmp": "c1", "pos": "br"}},
        "slides": [{"layout": "blank", "panes": [], "mast": "m1"}]}])
    assert out2[0]["masters"]["m1"]["bg"] == "#123a2b"
    assert out2[0]["slides"][0]["mast"] == "m1"


def test_the_masters_panel_has_doors_where_layouts_live():
    """Both Layouts menus (Design and Home — the T131 parity rule) and
    the slide right-click, which names what the slide wears."""
    out = _out()
    html = assets.deck_html()
    assert 'id="lay-masters"' in html and 'id="hm-lay-masters"' in html
    assert ("both('#lay-masters','#hm-lay-masters',function(){"
            in out)
    assert "window.SemDeckMasters=openMasters;" in out
    fn = out[out.index("function openMasters(){"):]
    fn = fn[:fn.index("window.SemDeckMasters")]
    # the verbs: wear one slide / a section / the deck, and the escape
    for label in ("Wear it \\u2014 this slide",
                  "Wear it \\u2014 whole section",
                  "Wear it \\u2014 every slide",
                  "Take the master off this slide",
                  "Delete this master"):
        assert label in fn, label


def test_the_export_bakes_the_inherited_look():
    """PowerPoint gets the right pixels — furniture items under the
    content and the inherited background. Real slideLayout parts per
    master are the recorded cut: the look travels, the linkage does
    not."""
    out = _out()
    assert "if(msyn3) its=pptxItems(msyn3,note,ink,null).concat(its);" in out
    assert "||(mm3&&tokVal(mm3.bg))||bg),items:its," in out
