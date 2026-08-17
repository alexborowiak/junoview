"""Page size and the template catalog that follows from it. The
per-presentation preset (16:9, 4:3, A4-A0) drives everything: the A-series
presets are what turn poster mode on and grow the editor chrome, while A4
stays a page and keeps the slide templates. The catalog is generated from
LAYOUTS, is scrollable, appears as a ribbon Layouts dropdown while editing,
and never mixes the poster and slide families -- the page's own orientation
sorts first and each template previews at its real aspect. Poster templates
are checked to read like a real conference poster.
"""

from __future__ import annotations


def test_layout_picker_is_a_catalog_generated_from_LAYOUTS(out):
    """The layout picker is a scrollable catalog generated from LAYOUTS; a
    title slide is just two text boxes (no special title mode).
    """
    assert "var LAYOUTS" in out and "function applyLayout" in out
    assert "id:'title'" in out and "id:'rows'" in out and "id:'blank'" in out
    assert "id:'title-text-cell'" in out or "id:'text-cell'" in out
    assert 'id="layout-row"' in out and "renderLayoutPicker" in out
    assert 'id="edit-tools"' in out and 'id="dc-edit"' in out


def test_slide_templates_live_in_a_ribbon_layouts_dropdown(out):
    """slide templates live in a ribbon Layouts dropdown while editing; the
    panel keeps the catalog only in create mode and stays slim in edit
    """
    assert 'id="lay-btn"' in out and 'id="layout-menu-grid"' in out
    assert ".deck.editing #layout-row{display:none;}" in out
    # 200px: while editing the panel is ONLY slide thumbnails (the File
    # controls ride in the ribbon), so it slimmed from 248px (2026-08-05)
    assert "min(var(--dc-w),200px)" in out


def test_poster_templates_and_catalog_grouping(out):
    """POSTERS: a "+ New poster" rail button lands in the editor on an A0
    portrait page with a poster template applied; the catalog groups
    Slide vs Poster templates (poster group FIRST on a poster page)
    """
    assert 'id="pr-newpost"' in out and "function newPoster" in out
    assert "page:'a0p'" in out
    assert "id:'poster-3col'" in out and "id:'poster-2col'" in out
    assert "id:'poster-fig'" in out and "id:'poster-flow'" in out
    assert "'Poster layouts'" in out and "'Slide layouts'" in out
    assert ".lay-sec{grid-column:1/-1" in out


def test_poster_and_slide_template_lists_are_never_mixed(out):
    """A poster page offers POSTER templates only and a slide page slide
    templates only -- never both lists (2026-07-29).  The poster family
    sorts the page's own orientation first, previewing each template at
    its real aspect.
    """
    # Blank is exempt from the split: it belongs to both families and
    # leads each list (2026-08-07)
    assert "return !!l.poster===isPoster&&l.id!=='blank';" in out
    assert "isPoster?'Poster layouts':'Slide layouts'" in out
    # ...and the poster family sorts the page's own orientation first,
    # previewing each template at its real aspect
    assert "(!!a.land===land?0:1)-(!!b.land===land?0:1)" in out
    assert "layout.land?'1189 / 841':'841 / 1189'" in out


def test_poster_templates_read_like_a_real_conference_poster(out):
    """poster templates read like a real conference poster: numbered
    section headings, prose for intro/discussion, figures for results
    """
    for _pl in ("poster-3col", "poster-2col", "poster-fig", "poster-flow",
                "poster-billboard", "poster-4col", "poster-land3",
                "poster-land-fig"):
        assert f"id:'{_pl}'" in out, _pl
    assert "text:'1 · Introduction'" in out
    # heading labels stay SHORT enough for one line in their column — a
    # wrapped heading's second line landed on the text below it
    # (2026-08-05, "2 · Data & methods" / "5 · Results continued")
    assert "text:'2 · Methods'" in out
    assert "text:'5 · More results'" in out
    assert "text:'2 · Data & methods'" not in out
    assert "text:'7 · Conclusions'" in out
    assert "Funding & acknowledgements" in out
    assert "land:1" in out and "poster:1" in out


def test_a_series_presets_switch_poster_mode_without_growing_chrome(out):
    """The A-series poster presets are what turns poster mode on; A4 is a
    page, so it keeps the slide templates. Poster mode does NOT inflate
    the editor's chrome any more (2026-08-04): the upsized buttons made
    the invisible format groups wrap into a ~430px dead band that starved
    the stage until an A0 portrait rendered ~300px wide. Only the
    two-up template catalog stays poster-specific.
    """
    assert "id:'a0p',label:'Poster A0 portrait',aw:841,ah:1189," \
        "mm:[841,1189],\n      poster:1}" in out
    assert "id:'a4p',label:'A4 portrait',aw:210,ah:297,mm:[210,297]}" in out
    assert "classList.toggle('poster-page',!!pg.poster)" in out
    assert ".deck.poster-page .dbtn{" not in out
    assert ".deck.poster-page .lay-picker{grid-template-columns:" \
        "repeat(2,1fr);" in out
    assert 'id="et-fmt"' in out and 'data-tool="cell"' in out
