"""The slide/poster editor: its ribbon and the objects you manipulate on the
canvas. Ribbon side: one wrapping flow with a stable group order, the format
bar's object controls, and the crop picker / animation build order it hosts.
Canvas side: snap-to-align guides while dragging, resize from any corner
with free rotation, multi-select arrange, the objects pane
(hide-while-editing, lock), shapes and rich text formatting, images with
crop-to-shape and grouping, per-cell colour and the professional colour
picker, frame chrome that appears only on selection, figure frames hugging
their plot, overflow clipping, undo/redo, PDF export, arrow-nudge, and the
hardening fixes from the adversarial review.
"""

from __future__ import annotations

from junoview.notebook.presentations import _as_presentations


def test_deck_builder_controls_and_frame_parts(out):
    """The deck builder ships a play control, a film strip and a layout row.

    Decluttered builder: no repeated name label, no verbose hints -- the
    controls live in ``dc-controls`` instead. A frame can show a cell's
    code / figure / output part, and split.
    """
    assert 'id="dc-play"' in out and 'id="film-list"' in out
    assert 'id="layout-row"' in out and "buildSlideEditor" in out
    # decluttered builder: no repeated name label, no verbose hints
    assert "dc-controls" in out
    # a frame can show a cell's code / figure / output part, and split
    assert "framePart" in out and "cellFacets" in out
    assert "buildPartChooser" in out and "splitFrame" in out


def test_presentation_opens_in_editor_with_one_mode_toggle(out):
    """builder workflow: a presentation opens in the slide EDITOR by
    default.  The "+ Notebook cell" tool (now a plain tool, not a cyan
    bigcell), the "+ Shapes" dropdown and Present were relocated into the
    slide tool bar.  ONE mode toggle (dc-edit) swaps slide-editor <->
    notebook view; the old separate "et-notebook" button, "Done" and the
    "Back to slide" pill are gone.
    """
    assert out.count("openDeck('edit')") >= 2
    # the "+ Notebook cell" tool (now a plain tool, not a cyan bigcell), the
    # "+ Shapes" dropdown, and Present relocated into the slide tool bar
    assert 'data-tool="cell"' in out and "Notebook cell" in out
    assert "et-bigcell" not in out
    assert 'id="sh-btn"' in out and 'id="sh-menu"' in out \
        and "var SHAPE_LIST" in out
    # ONE mode toggle (dc-edit) swaps slide-editor <-> notebook view; the old
    # separate "et-notebook" button, "Done" and the "Back to slide" pill are
    # gone
    assert "Swap to notebooks" in out and "Swap to edit view" in out
    assert 'id="et-notebook"' not in out
    assert 'id="et-done"' not in out and 'id="slide-return"' not in out


def test_snap_to_align_while_dragging(out):
    """SNAP-TO-ALIGN: dragging/resizing snaps edges + centers to the canvas
    and other objects, with dashed guide lines; Alt disables; aspect-locked
    figures snap width and let height follow the plot ratio
    """
    assert "function snapTargets" in out and "function bestSnap" in out
    assert "function drawSnapGuides" in out and "ev.altKey" in out
    assert ".snapline.snap-v" in out and ".snapline.snap-h" in out


def test_objects_pane_lists_hides_and_locks(out):
    """OBJECTS PANE (layers v1): list every object, hide-while-editing, lock
    """
    assert 'id="selpane"' in out and 'id="objects-btn"' in out
    assert "function renderSelPane" in out and "a.hide&&editing" in out
    assert "an-locked" in out and ".sp-row" in out


def test_slide_object_resize_rotate_and_arrange(out):
    """resize from ANY corner (opposite corner anchored) + a free-rotation
    grip above the item (Shift snaps to 15°).

    multi-select arrange: Row / Grid, and "Same size" matching the
    first/last-selected (or largest/smallest) item
    """
    assert "an-rs-nw" in out and "an-rs-sw" in out \
        and "t.dataset.corner" in out
    assert "function startRotate" in out and "an-rotate" in out
    assert 'id="fmt-arline"' in out and 'id="fmt-argrid"' in out
    assert "function arrangeRow" in out and "function arrangeGrid" in out
    assert "function sameSize" in out and 'id="fmt-same-menu"' in out


def test_shapes_and_rich_slide_object_formatting(out):
    """Shapes render as SVG paths (star/cloud/...) or glyphs (!/?); box +
    ellipse stay CSS.  The rich slide editor keeps precise pt size,
    alignment, underline/strike, a CONTINUOUS opacity slider (not fixed
    steps), and per-deck slide numbers.
    """
    assert "var SHAPE_PATHS" in out and "function drawShapeSvg" in out
    assert ".an-rect.an-svgshape" in out and "an-shape-svg" in out
    assert 'id="fmt-op"' in out and 'id="fmt-rotl"' in out
    # rich slide editor: precise pt size, alignment, underline/strike, a
    # CONTINUOUS opacity slider (not fixed steps), and per-deck slide numbers
    assert 'id="fmt-size"' in out and 'id="fmt-para"' in out
    assert 'id="fmt-under"' in out and 'id="fmt-strike"' in out
    assert 'id="fmt-op"' in out and 'type="range"' in out
    assert 'id="mi-nums"' in out and "slide-pageno" in out


def test_images_crop_grouping_rich_text_and_build_animations(out):
    """images + crop-to-shape (images AND notebook cells), group / ungroup
    with multi-select, rich text that recolours just the highlighted run,
    and build animations (reveal on click).
    """
    assert 'id="et-image"' in out and 'id="img-file"' in out
    assert "function applyCrop" in out and "var CROP_CLIP" in out
    assert 'id="fmt-crop"' in out and "an-image" in out
    # group / ungroup with multi-select
    assert 'id="fmt-group"' in out and 'id="fmt-ungroup"' in out
    assert "function groupMembers" in out and "function paintSel" in out
    # rich text: recolour just the highlighted run
    assert "function colorSelection" in out and "function sanitizeRich" in out
    # build animations (reveal on click)
    assert 'id="vw-anim"' in out and "function slideBuildIdx" in out


def test_cell_colour_and_professional_colour_picker(out):
    """A markdown cell frame carries its own text + background colour, and
    the colour picker is professional: hex / rgb / rgba + alpha + custom
    swatches.
    """
    assert "function applyCellColor" in out and "--nb-tx" in out
    assert "a.txcol=sw.dataset.c" in out and "a.bgcol=sw.dataset.c" in out
    # professional colour picker: hex / rgb / rgba + alpha + custom swatches
    assert 'id="color-pop"' in out and 'id="sw-custom"' in out
    assert 'id="swbg-custom"' in out and 'id="cp-hex"' in out
    assert 'id="cp-rgb"' in out and 'id="cp-alpha"' in out
    assert "function parseColor" in out and "function openColorPop" in out


def test_edit_frame_chrome_appears_only_when_selected(out):
    """slide-editor declutter: an unselected edit frame is transparent +
    borderless and its chrome (border/title/Replace/parts) returns only
    when selected.

    Object controls (Replace + code/figure/output part-picker) now live in
    the ribbon, not floating on the frame; a placed figure is just the
    figure.  Locate in notebook jumps to the frame's source card.
    """
    assert (".deck.editing .an-cell{cursor:move;background:none;"
            "border-color:transparent" in out)
    assert ".deck.editing .an-cell.sel .an-cellbtn{display:block" in out
    assert ".deck.editing .an-cell.sel .cellparts" in out
    # Object controls (Replace + code/figure/output part-picker) now live
    # in the ribbon, not floating on the frame; a placed figure is just
    # the figure
    assert 'id="fmt-parts"' in out and "rbn-partslot" in out
    # ribbon Object group: Locate in notebook jumps to the frame's source
    # card
    assert 'id="fmt-locate"' in out and "#fmt-locate" in out


def test_figure_frame_hugs_its_plot(out):
    """A figure frame hugs its plot.

    The frame element fits the image's contained rect with no inner
    padding and no title header, so the selection outline sits exactly on
    the plot.
    """
    assert "function fitFigFrame" in out and "an-figonly" in out
    assert "function figFit" in out
    assert ".an-cell.an-figonly .figframe{padding:0;}" in out
    assert ".an-cell.an-figonly .cardbody{padding:0;}" in out


def test_overflow_clipping_and_placeholder_chrome(out):
    """Thumbnails clip, the tree canvas never clips, placeholders overlay.

    A figure dragged past the slide edge can't bleed into the next
    thumbnail; the tree canvas sizes to its widest lane so centered lanes
    never clip left; the empty placeholder keeps its dashed box while the
    header is an overlay (out of flow) so selecting a frame doesn't
    reflow the figure.
    """
    # thumbnail slide surfaces clip overflow (a figure dragged past the
    # slide edge can't bleed into the next thumbnail)
    assert "margin:0;width:100%;overflow:hidden" in out
    # tree canvas sizes to its widest lane so centered lanes never clip
    # left
    assert "width:max-content" in out
    # the empty placeholder keeps its dashed box; the header is an overlay
    # (out of flow) so selecting a frame doesn't reflow the figure
    assert ".deck.editing .an-cell.empty{background:#0e192699" in out
    assert ".deck.editing .an-cell.sel .an-cellhead" in out
    assert ".pane.filled .an-cellhead{position:absolute" in out


def test_editor_hardening_from_adversarial_review(out):
    """Fixes that came out of the adversarial review of the editor batch.

    Each assert pins one crash/corruption class that was found there.
    """
    assert "an-prebuild" in out and "an-anim-fade" in out
    # hardening from the adversarial review of the editor batch:
    # - rich-text sanitiser parses INERTLY (template) + re-walks unwrapped
    #   nodes
    assert "createElement('template')" in out and "tpl.content" in out
    # - Crop/Animate menus float (position:fixed) out of the format-bar
    #   overflow
    assert "function floatMenu" in out and "menu.style.position='fixed'" in out
    # - the slide-numbers preference survives normalisation/reload
    assert "out.showNums=1" in out
    # - selection never carries across slides (no phantom group
    #   moves/crashes)
    assert "selAnnot=null;selSet=[];refresh()" in out
    assert "if(cur===prev) return" in out
    # - formatting applies to the whole selection; text-align actually
    #   positions
    assert "targets=selSet.filter" in out and "flex:1;}" in out


def test_launch_polish_undo_pdf_nudge_and_tour_text(out):
    """launch-polish batch: undo/redo, PDF export, arrow-nudge, bigger
    tour text.
    """
    assert 'id="dc-undo"' in out and 'id="dc-redo"' in out
    assert "function undo(){" in out and "function histPush()" in out
    assert 'id="mi-pdf"' in out and "function printDeck" in out \
        and "print-page" in out
    assert "function nudgeSel" in out
    assert ".tour-text{font-size:15.5px" in out


def test_ribbon_is_one_flow_with_stable_group_order(out):
    """ribbon declutter: ONE flow (static + format groups share the row),
    no Select/Delete group (Esc deselects, Del removes), Animate merged
    into an Effects group, and common groups (Arrange, Effects) come
    FIRST so buttons don't jump between selection types.  The ribbon
    part-picker pills dress like the other ribbon buttons.

    It no longer WRAPS -- that was the 2026-08-07 rebuild, where groups
    fragmenting across rows was the thing that read as "just all these
    rows of things". The flow itself is unchanged.
    """
    assert ".rbn-static{display:contents;}" in out
    assert ".et-fmt{display:contents;}" in out
    # hidden format groups LEAVE the layout (2026-08-04): reserving their
    # rows as visibility:hidden was a permanent dead band
    assert ".et-fmt[hidden]{display:none;}" in out
    # the stage still re-fits when the ribbon's box changes; that observer
    # now also drives the density ladder, so it is asserted by behaviour
    # rather than by its exact source text
    assert "new ResizeObserver(function(){" in out
    assert "fitEditRibbon();applyZoom();" in out
    assert 'id="et-del"' not in out and 'data-tool="select"' not in out
    # the Effects group itself is GONE (2026-08-17): opacity moved to
    # Colour, and its last resident was a second door to the Animations
    # pane -- the one door is View's
    assert ">Effects</span>" not in out and 'id="vw-anim"' in out
    assert out.index('id="fmt-dup"') < out.index('id="fmt-txlab"')
    # the ribbon part-picker pills dress like the other ribbon buttons
    assert "#fmt-parts .cellpartbtn{" in out


def test_poster_editing_ergonomics_pinch_zoom_escape_and_placement(out):
    """2026-08-04 poster-edit pass: pinch zooms the PAGE, the hidden rail
    keeps a way back, and create-mode clicks fill frames.

    A trackpad pinch arrives as ctrl+wheel: a non-passive listener on the
    stage preventDefaults the browser zoom and rescales the page around
    the cursor (rect-anchored, so margin:auto centring and the .zoomed
    overflow flip are handled by measurement, not math). The rail's
    reveal tab and auto-hide peek ride ABOVE the deck editor
    (z-index 130 > 100) so "you kind of lose the side bar" cannot
    happen. And with no frame armed, a clicked card takes the first
    EMPTY frame in reading order instead of toasting on every click.
    """
    assert "stage.addEventListener('wheel',function(e){" in out
    assert "(deckZoom||1)*Math.exp(-e.deltaY*0.002)" in out
    assert "stage.scrollLeft+=(nr.left+fx*nr.width)-e.clientX;" in out
    assert "},{passive:false});" in out
    assert (".presrail-show{position:fixed;left:0;bottom:20px;"
            "z-index:130;" in out)
    assert "body.prrail-auto.prrail-peek .presrail{z-index:130;}" in out
    assert "if(best) target=best;" in out
    assert "Every frame is full" in out


def test_format_bar_carries_the_object_controls(out):
    """The format bar ships font, list, shape, duplicate, bring-to-front,
    the picker bar and Replace -- and tooltips on a light-theme app top.
    """
    assert 'id="fmt-font"' in out and "body.light .apptop" in out
    assert "apptip" in out
    assert 'id="fmt-parawrap"' in out and 'id="fmt-shape"' in out
    assert 'id="fmt-dup"' in out and 'id="fmt-front"' in out
    assert 'id="pickbar"' in out and 'id="fmt-replace"' in out


def test_ribbon_groups_crop_picker_and_animation_build_order(out):
    """PowerPoint-style ribbon plus the crop/animate tools it hosts.

    The ribbon has labelled groups and colour swatches for arrows/shapes;
    crop is a visual shape picker (icons) and a cropped figure fills its
    frame; animations get an "Appear" effect + a build-order pane (items
    can share a build so they appear together).
    """
    # PowerPoint-style ribbon: labelled groups; colour swatches for
    # arrows/shapes
    assert "edit-tools ribbon" in out and 'class="rbn-grp"' in out
    assert 'class="rbn-lab"' in out and "function syncRibbonGroups" in out
    assert "colourable=isText||kind==='arrow'||kind==='rect'" in out
    # crop is a visual shape picker (icons) + a cropped figure fills its
    # frame; animations get an "Appear" effect + a build-order pane (items
    # can share a build so they appear together)
    assert "function cropIcon" in out and "an-cropped" in out
    assert "function slideBuildSteps" in out and "function animSeq" in out
    assert "anim-pane" in out and "anim-effb" in out
    assert "['appear','Appear']" in out and "an-anim-fade" in out


def test_page_size_preset_and_zoom(out):
    """PAGE SIZE / POSTER: a per-presentation preset (16:9, 4:3, A4-A0) --
    one builder for slides AND posters; zoom while editing; the preset
    survives JS normPres and the Python save path; PDF exports at size
    """
    assert "var PAGE_PRESETS" in out and 'id="page-btn"' in out
    assert "--page-ar" in out and "function applyZoom" in out
    assert 'id="zoom-in"' in out and 'id="zoom-out"' in out
    assert "out.page=p.page" in out
    assert _as_presentations([{"name": "po", "page": "a0p",
                               "slides": []}])[0]["page"] == "a0p"
    assert "page" not in _as_presentations([{"name": "s", "slides": []}])[0]
    assert ".deck.editing .deck-stage.zoomed{overflow:auto" in out
