"""The final text/style ribbon cleanup requested on 2026-09-12 (T380).

These assertions pin the distinctions the visual review exposed: View is
made of full-height real controls, Shared colours contains only colours,
and a style family shows its base specimen once.
"""

from __future__ import annotations

from junoview import assets

VIEW_IDS = (
    "vw-versions",
    "vw-rulers",
    "vw-grid",
    "vw-other-slides",
    "vw-other-fill",
    "vw-guides",
    "vw-guidebox",
    "vw-side",
    "vw-check",
    "vw-preflight",
    "objects-btn",
    "notes-btn",
)


def test_view_uses_the_full_height_tile_system(out):
    """View had the space of a full tab but kept twelve 26px buttons."""
    view = out.split('class="rbn-grp rbn-fixed rbn-view"', 1)[1].split(
        ">View</span>", 1
    )[0]
    for control_id in VIEW_IDS:
        assert (
            f'class="fx-tile view-tile rbn-tall" id="{control_id}"'
            in view
            or f'class="fx-tile view-tile rbn-tall et" id="{control_id}"'
            in view
        ), control_id
    assert "Print check</button>" in view

    css = assets.load("css/deck.css")
    assert ".rbn-row>.view-tile{width:var(--rbn-tile-w);" in css
    assert "height:var(--rbn-tile-h);" in css
    assert ".view-tile kbd{position:absolute;" in css


def test_every_view_tile_remains_reachable_when_the_group_folds(out):
    """The compact View door drives the same real controls; none vanish."""
    fold = out.split("var VIEW_FOLD=", 1)[1].split("];", 1)[0]
    for control_id in VIEW_IDS:
        assert f"'{control_id}'" in fold, control_id
    assert "o.textContent=p[1]||(real.textContent||'Slides').trim();" in out


def test_shared_colours_does_not_change_layout(out):
    """A panel named Shared colours must stop when its colour rows stop."""
    colours = out.split("function openTokenPicker(anchor){", 1)[1].split(
        "function openDeckLayoutPicker(anchor){", 1
    )[0]
    assert "Corner radius" not in colours
    assert "Space between arranged boxes" not in colours

    layout = out.split("function openDeckLayoutPicker(anchor){", 1)[1].split(
        "function setToken(kind,key,val){", 1
    )[0]
    assert 'id="dsg-layout"' in out
    assert "Corner radius" in layout
    assert "Space between arranged boxes" in layout
    assert "Deck layout</button>" in out


def test_style_family_shows_the_base_specimen_once(out):
    """The visible base row previews/applies; Looks only reveals variants."""
    picker = out.split("/* ---- the Styles menu", 1)[1].split(
        "/* ---------- professional colour picker", 1
    )[0]
    assert "var family=document.createElement('details');" not in picker
    assert "familyHost=head;styleRow(id,false);" in picker
    assert "familyHost=children;" in picker
    assert "children.hidden=true;" in picker
    assert "expand.innerHTML=bic('styles')+'<span>Looks</span>';" in picker
    # The same visible base row owns the temporary hover preview.
    assert "b.addEventListener('mouseenter',function(){" in picker
    assert "pvEnd(true);pvShow(function(x){" in picker


def test_style_system_has_no_empty_everything_else_heading(out):
    """The object heading is appended lazily with its first used kind."""
    rail = out.split("function dgRail(ov){", 1)[1].split(
        "var dgShowOthers=false;", 1
    )[0]
    assert "var hd=null;" in rail
    assert "if(!hd){" in rail
    assert rail.index("if(!n2&&key!==dgSel) return;") < rail.index("if(!hd){")
