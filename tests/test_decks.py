"""Everything about a deck except the canvas you edit it on: the normalized
stored shape, the anchors that bind slides to cells, and the rail you pick
one from. Decks travel in the notebook's own metadata, in a sidecar, or in
the project file, and _as_presentations flattens all three -- including
older layouts -- into one form, so a deck saved months ago still opens.
Anchors are ids rather than positions, which is what lets a deck survive the
notebook being reordered and re-run. The rail is a radio: exactly one
presentation is current at a time, and Notebooks is always the way back.
"""

from __future__ import annotations

import copy

from junoview.branding import _ICON_PATHS
from junoview.notebook.parser import parse_notebook
from junoview.notebook.presentations import _as_presentations


def test_demo_page_renders_and_embeds_its_presentation(doc, out):
    """The demo doc renders, and its deck travels with the page."""
    assert "Demo analysis" in out and "Climatology" in out and "provsvg" in out
    # presentation plumbing, incl. legacy single-deck conversion
    assert doc.presentations and doc.presentations[0]["name"] == "demo"
    assert doc.presentations[0]["slides"][0]["panes"] == ["clim", "cell:md1"]
    legacy = _as_presentations({"slides": [
        {"kind": "card", "anchor": "a", "beside": ["b"]}]})
    assert legacy[0]["slides"][0] == {"layout": "halves", "panes": ["a", "b"]}
    assert '"panes": ["clim", "cell:md1"]' in out
    assert 'class="nb-data"' in out and 'id="app-data"' in out
    assert 'id="presstrip"' in out and 'id="tv-markdown"' in out
    # the rail's Docs button is the way back to the document view. The
    # deck's own #deck-docs was a second one, and it was holding a whole
    # toolbar row open on its own, so it went (2026-08-07).
    assert 'id="pr-docs"' in out and 'id="pr-new"' in out
    assert 'id="deck-docs"' not in out


def test_as_presentations_normalizes_new_layouts_and_title_slides():
    """new slide layouts, title slides and annotations survive normalizing"""
    pres2 = _as_presentations([{"name": "n", "slides": [
        {"layout": "rows", "panes": ["a"]},
        {"layout": "title", "title": "Hi", "sub": "there",
         "annots": [{"k": "text", "x": 5, "y": 5, "text": "note"}]},
    ]}])
    assert pres2[0]["slides"][0] == {"layout": "rows", "panes": ["a", None]}
    t_slide = pres2[0]["slides"][1]
    assert t_slide["layout"] == "title" and t_slide["title"] == "Hi"
    assert t_slide["panes"] == [] and t_slide["annots"][0]["text"] == "note"


def test_slide_builder_keeps_slide_props_and_annotation_refs(out):
    """Normalising a deck preserves per-slide title props and the free
    annotations, and a blank layout stays blank (no implied panes)."""
    pres3 = _as_presentations([{"name": "x", "slides": [
        {"layout": "title", "title": "T",
         "tprops": {"x": 30, "y": 20, "size": 5}},
        {"layout": "blank",
         "annots": [{"k": "cell", "x": 1, "y": 1, "w": 40, "h": 40,
                     "ref": "demo::clim"}]},
    ]}])
    assert pres3[0]["slides"][0]["tprops"]["x"] == 30
    blank = pres3[0]["slides"][1]
    assert blank["panes"] == [] and blank["annots"][0]["ref"] == "demo::clim"
    assert "lay-picker" in out and "an-cellbtn" in out
    # when the present-mode control bar docks to the top, the exit button
    # is pinned out of its way
    assert (
        "body.pbpos-top .pb-exit{position:absolute;top:8px;right:48px"
    ) in out


def test_presentation_normalization_keeps_folder_and_hidden_steps(out):
    """``_as_presentations`` must not drop per-deck / per-slide state.

    A deck's folder survives normalization (and the UI can create new
    ones), and the code-trace hidden-step list survives normalization per
    slide -- empty entries are dropped.
    """
    pres_f = _as_presentations([{"name": "a", "folder": "paper 1",
                                 "slides": []}])
    assert pres_f[0]["folder"] == "paper 1"
    assert 'id="pr-newfold"' in out
    # code-trace hidden-step list survives normalization (per slide)
    pres_h = _as_presentations([{"name": "h", "slides": [
        {"layout": "blank", "panes": [],
         "annots": [{"k": "cell", "x": 5, "y": 5, "w": 40, "h": 40,
                     "ref": "clim"}],
         "hidden": ["nb::cell:c-prep", ""]}]}])
    assert pres_h[0]["slides"][0]["hidden"] == ["nb::cell:c-prep"]


def test_deck_anchors_survive_cell_reorder_and_edits(nb):
    """decks survive notebook edits: anchors are ids, never positions --
    reordering cells and editing text must keep every anchor alive
    """
    nb_edit = copy.deepcopy(nb)
    nb_edit["cells"] = list(reversed(nb_edit["cells"]))
    for c in nb_edit["cells"]:
        if c.get("id") == "md1":
            c["source"] = "EDITED prose, same cell id"
    doc_e = parse_notebook(nb_edit)
    anchors_e = {it.anchor for s in doc_e.sections for it in s.items}
    assert "clim" in anchors_e and "cell:md1" in anchors_e
    assert "fig2" in anchors_e


def test_positional_anchor_survives_a_content_edit():
    """Id-less figure cells anchor by POSITION, and that anchor survives a
    content edit (the code-derived title changes, the anchor must not) -- so
    a deck frame keeps resolving after the notebook is refreshed."""
    a_before = parse_notebook({"cells": [{"cell_type": "code",
        "source": "#| display: figure\nplot(a)", "outputs": [
        {"output_type": "display_data", "data": {"image/png": "aGk="}}]}]})
    a_after = parse_notebook({"cells": [{"cell_type": "code",
        "source": "#| display: figure\nplot(a, b, c, lw=2)", "outputs": [
        {"output_type": "display_data", "data": {"image/png": "aGk="}}]}]})
    an_b = a_before.sections[0].items[0].anchor
    an_a = a_after.sections[0].items[0].anchor
    assert an_b == an_a == "cell:p0", (an_b, an_a)


def test_anchors_reach_the_page_and_fall_back_to_ids(out, items):
    """Anchors fall back to node id / cell id, and reach the payload."""
    assert 'data-anchor="clim"' in out and 'data-anchor="cell:md1"' in out
    assert '"stem": "demo"' in out or '"stem":"demo"' in out
    assert any(it.anchor == "clim" for it in items)
    assert any(it.anchor == "cell:md1" for it in items)


def test_presentation_rail_is_a_radio_model(out):
    """rail radio model: a presentation row lights up ONLY while its deck is
    open; the Notebooks button is a bordered button with the SAME active
    style (no stale half-highlight after going back to the notebooks)
    """
    assert '<span class="pr-t">Notebooks</span>' in out
    assert "isCur&&editing?' current editing'" in out
    assert ".pr-item.current{background:var(--cyan-deep)" in out
    assert ".pr-docs{margin-bottom:6px;border:1px solid" in out
    # the redundant builder "Close" is gone (presrail Notebooks handles it)
    assert 'id="dc-close"' not in out


def test_presentations_rail_auto_hide_is_off_by_default(out):
    """The presentations rail can auto-hide, OFF by default."""
    assert 'id="pr-auto" aria-pressed="false"' in out
    assert "body.prrail-auto.prrail-peek .presrail{transform:none;}" in out
    # the panel keeps a real width while auto-hidden, or translateX(-100%)
    # is 100% of nothing and its contents overflow a 0px box as artefacts
    assert "body.prrail-auto .presrail{width:176px;overflow:hidden;}" in out
    assert "transform:translateX(-100%);" in out
    # data-ic placeholders are EXPANDED at render time, so assert on the
    # icon's path data, not on the placeholder that legitimately vanishes
    assert 'class="pr-foot"' in out
    assert _ICON_PATHS["autohide"][:26] in out
    assert "'junoview:presrail:auto'" in out


def test_presentation_notebooks_live_in_the_left_column_only(out):
    """ONE notebooks list, at the top of the left column.

    It was briefly two: the column's copy (2026-08-19) plus a floating
    pane behind a ribbon button (2026-08-18). The column is on screen the
    whole time you edit, so the ribbon button spent a group's worth of
    width offering something already showing, and the pane it opened
    covered the page (2026-08-20, user: "so the notebook button can be
    removed now. Haven't we put all the functionality on the left hand
    side?"). Button and pane are both gone; open-all / refresh-all live
    in the column with the list they act on.
    """
    assert 'id="dc-nbs"' in out
    assert 'id="dc-nbs-btn"' not in out and 'id="nbspane"' not in out
    assert 'id="dc-nbs-menu"' not in out
    assert "function renderNbsMenu" in out and "function openPresNbs" in out
    assert "Refresh all" in out and "Open notebooks" in out


def test_notebooks_button_replaces_inline_chip_strip(out):
    """The Notebooks button (Open/Refresh) + advanced code-type filter.

    The old inline "notebooks" chip strip above the thumbnails is gone.
    """
    assert "renderPresNbs" in out
    # The list itself stands down only where this build can do nothing
    # with notebooks at all (the bare static export). It used to hide
    # until the deck had a notebook cell -- undiscoverable on a fresh
    # deck ("what happened to the open relevant notebooks button") -- and
    # a button in front of it renamed itself Open/Refresh notebooks,
    # promising an action it no longer performed (2026-08-18). Since
    # 2026-08-20 there is no button: the column IS the list.
    assert "col.hidden=!(nbs.length||nbsCanOpen());" in out
    assert "btn.textContent=(anyOpen" not in out
    assert "Refresh notebooks" not in out
    # 2026-08-19: a notebooks strip is BACK at the top of the left
    # column, by explicit request ("the content that is currently in the
    # 'notebooks' button") — the 2026-08-05 objection was to chips above
    # the THUMBNAILS with no actions; this one is the pane's own content,
    # header-as-way-back included
    assert 'id="dc-nbs"' in out
    assert "buildNbsInto($('#dc-nbs'),true);" in out
    assert 'id="ck-filter-btn"' in out and 'id="ck-filter-menu"' in out
