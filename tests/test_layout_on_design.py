"""Layout lives on Design; Home is three things; images per slide and
full screen (T204).

The user, 2026-09-02: "the Design page should include all the layout
stuff I reckon. The arrange this slide, the save layout, and layouts,
and the match slide, and copy layout to slides should all be on design
tab. Oh there is already a layouts on the design. I think this is
getting confusing all the parts everywhere. Need to think about this
properly. The standardise thing under type is confusing as well."
And on the images pane: "there needs to be a full screen version of
this as well... don't have Slide 1. Picture. Have headings that are
collapsible for all slides. The all images thing should just be per
slide."
"""

from __future__ import annotations

import re


def _group_of(out: str, cid: str) -> str:
    """The data-tab of the ribbon group holding an id."""
    i = out.index(f'id="{cid}"')
    start = out.rfind('<span class="rbn-grp', 0, i)
    m = re.search(r'data-tab="([a-z]+)"', out[start:start + 120])
    assert m, cid
    return m.group(1)


def test_every_layout_verb_sits_on_design(out):
    for cid in ("lay-btn", "hm-lay-ideas", "hm-lay-tidy", "hm-lay-arrsave",
                "hm-lay-arrs", "hm-match", "hm-lay-give"):
        assert _group_of(out, cid) == "design", cid
    assert '<span class="rbn-lab">Layout</span>' in out
    assert '<span class="rbn-lab">Apply to other slides</span>' in out
    # one seat each: the Layouts menu is the grid alone
    for gone in ('id="lay-ideas-btn"', 'id="lay-tidy"', 'id="lay-arrs"',
                 'id="lay-masters"', 'id="lay-arrsave"', 'id="lay-give"'):
        assert gone not in out, gone
    assert "Change layout &#9662;" in out
    assert "both('#hm-lay-ideas',null,function(){openLayoutIdeas();});" in out
    assert "var hosts=['#hm-lay-tidy'].map(function(sel){" in out
    # Layout, then Apply, then the Slide group
    assert ".rbn-apply{order:1;}" in out


def test_home_is_make_do_and_keep(out):
    for cid in ("hm-newslide", "hm-dupslide", "hm-delslide", "hm-refresh-figs",
                "hm-refresh-img", "hm-images"):
        assert _group_of(out, cid) == "home", cid
    for lab in ("New slide", "This slide", "Keep up to date"):
        assert f'<span class="rbn-lab">{lab}</span>' in out, lab
    assert '<span class="rbn-lab">Arrange this slide</span>' not in out
    # New slide is a tall tile at the left of its strip
    assert 'class="fx-tile big-tile rbn-tall" id="hm-newslide"' in out
    assert ".rbn-row>#hm-newslide.big-tile{width:72px;height:56px;align-self:center;}" in out


def test_standardise_says_what_it_does(out):
    assert "Fix mismatched text&#8230;</button>" in out
    assert "<span>Mismatched text</span>" in out
    assert "<span>Standardise</span>" not in out


def test_images_are_per_slide_in_the_pane_and_every_slide_full_screen(out):
    assert "<span>Images on this slide</span>" in out
    assert 'id="imgpane-all"' in out and 'id="img-ov"' in out
    assert "function imgSurvey(si){" in out
    assert "function imgRow(r,after){" in out
    assert "var rows=imgSurvey(cur);" in out
    assert "function renderImgOverview(){" in out
    assert "var d=document.createElement('details');d.className='img-sec';" in out
    assert "t.textContent=r.kind;" in out          # no "Slide 1 · Picture"
    assert "e.stopPropagation();renderImgOverview();overlayShow(all,ov);});" in out
    assert ".img-ov{position:fixed;inset:0;z-index:400;" in out
    for cid in ("img-ov-open", "img-ov-fold", "img-ov-close"):
        assert f'id="{cid}"' in out, cid
