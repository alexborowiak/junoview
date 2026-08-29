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

from junoview.notebook.presentations import as_presentations


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
    # the swatch handlers funnel through textMut/fillMut since 2026-08-20
    # (shared with the recent chips and the hover preview)
    assert "if(a.k==='cell') a.txcol=c;" in out
    assert "if(a.k==='cell'){a.bgcol=c;}" in out
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
    assert (".deck.editing .an-cell.empty{background:"
            "color-mix(in srgb,var(--chrome-1,#0e1926) 60%,transparent)"
            in out)
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
    assert as_presentations([{"name": "po", "page": "a0p",
                               "slides": []}])[0]["page"] == "a0p"
    assert "page" not in as_presentations([{"name": "s", "slides": []}])[0]
    assert ".deck.editing .deck-stage.zoomed{overflow:auto" in out


def test_objects_pane_groups_are_folders_with_names_and_colours(out):
    """The Objects pane grew the organising tools that were only on the
    ribbon or nowhere (2026-08-18, user: "create folders and group
    things, rename groups, change group color, duplicate").

    Grouped items render under a folder row -- colour chip (click cycles
    a fixed palette), a name (double-click or the pencil renames), and a
    whole-group duplicate. Group metadata lives in s.grpmeta and is
    copied by normPres, because a slide field not listed there silently
    dies on the next load. Verified in a browser: group from the pane's
    own toolbar via ctrl-click multi-select, rename to "My cluster",
    colour cycled, duplicate produced "My cluster copy" with all members.
    """
    assert "function grpMeta(s,g){" in out
    assert "function dupAnnots(idxs){" in out
    assert "var GRP_COLORS=" in out
    assert "if(s.grpmeta) o.grpmeta=deep(s.grpmeta);" in out
    assert "f.className='sp-folder';" in out
    assert "if(m2.name) m2.name+=' copy';" in out
    # pane rows multi-select so Group is reachable from the pane
    assert "selectAnnot(l,i,ev.ctrlKey||ev.metaKey);" in out


def test_slides_have_their_own_background_and_border(out):
    """File > Page background stays presentation-wide; the new Background
    menu in the Slide group sets THIS slide's colour and an inset border
    (2026-08-18, user: "change slide background color, and borders and
    things like that that powerpoint has").

    The border is sized in the same 720-page currency as line weight so
    it scales with the page, and both fields ride into the print root and
    the .pptx (slide1 carried cream + a border rect; slide2 stayed
    default with neither -- verified on a real export). Verified in a
    browser that slide 2 keeps the default while slide 1 is cream, both
    ways across a navigation.
    """
    assert 'id="bg-btn"' in out and 'id="bg-menu"' in out
    assert ("var bg=tokVal((s0&&s0.bg)||(pres&&pres.pageBg)"
            "||'#0b141d');") in out
    assert "if(typeof s.bg==='string'&&s.bg) o.bg=s.bg;" in out
    assert "if(s.border) o.border=deep(s.border);" in out
    assert "(bd.w||4)/SW_REF_H*h" in out
    # .pptx wants ONE colour, and a gradient background has none - so the
    # export takes its first stop (2026-08-20)
    assert "return {bg:bgSolid(tokVal(ent.s.bg)||bg),items:its};" in out
    # renderSlide re-applies, so walking the deck repaints each slide's own
    assert ("applyPageBg();          "
            "/* this slide may carry its own background */") in out


def test_panes_dock_beside_the_page_and_are_draggable_and_remembered(out):
    """Objects / Animations / Versions / Print check share one shell that
    drags by its header, resizes by its native corner grip, and remembers
    where you put it (localStorage jv-panes), restored on the next open
    (2026-08-18, user: "detach them and drag them around and re-size --
    this then gets remembered").

    Notebooks was briefly a fifth (2026-08-18) and is not any more: the
    list lives at the top of the left column, on screen the whole time,
    so the pane was a second copy of something already showing.

    And the shell now DOCKS rather than floating over the page. Every one
    of these is a list you consult while working on the thing underneath,
    so covering that thing is exactly backwards (2026-08-20, user: "I
    don't like how the pop-up appears ofver the top of things, and not
    down the side. Annoying to use"). The stage gives up the width and
    sizeSlideTo re-fits the page into what is left, so the slide gets
    smaller and stays wholly visible.
    """
    assert 'id="nbspane"' not in out
    assert 'id="dc-nbs-menu"' not in out
    assert "function wirePane(pane){" in out
    assert "var PANE_KEY='jv-panes';" in out
    for pid in ("'selpane'", "'animpane'", "'verpane'", "'preflight'"):
        assert pid in out
    assert ".selpane{resize:both;overflow:hidden;" in out
    # docking: one width variable drives the pane and the stage's padding,
    # so they can never disagree
    assert ".deck{--pane-w:232px;}" in out
    assert (".deck.pane-open .deck-stage{"
            "padding-right:calc(var(--pane-w) + 22px);}") in out
    assert "function syncPaneDock(){" in out
    # watched, not trusted to the call sites: the panes are opened from
    # several places and one forgetting to dock would put a pane back over
    # the page
    assert "attributeFilter:['hidden']" in out
    # MOVED and RESIZED are different states. They used to be the same,
    # and the ResizeObserver fires the moment a pane is first shown -- so
    # every pane recorded an x/y, came back "moved" on the next load, and
    # could never dock again. Only a DRAG sets `moved` (2026-08-20, found
    # live: selpane style.right was "auto" on a pane nobody had touched).
    assert "paneSave(id,{moved:1,x:pane.offsetLeft,y:pane.offsetTop," in out
    assert "if(box.moved){" in out
    # and the strip reserved is the width the pane actually has, since it
    # is resizable
    assert "Math.round(docked.offsetWidth||232)+'px');" in out


def test_cell_content_scales_with_the_page(out):
    """A placed notebook cell's BODY rendered at fixed CSS sizes, so its
    text was constant on screen while everything else was constant on the
    page -- zooming changed a markdown table's size relative to the
    poster (2026-08-18, user: "please please please make sure everything
    doesn't change size relative to poster or slide when zooming").

    The body's zoom is now a.ts x pageScale -- the same 720-reference
    currency as text and line weight. Print/export layers measure ~720px
    so exports are untouched. Measured in a browser on a markdown cell:
    text/slide-width ratio 0.01009 -> 0.01012 across a 2-step zoom.
    """
    assert "var kz=pageScale(layer)||1;" in out
    assert "b.style.zoom=(a.ts||1)*kz;" in out
    assert "vb.style.zoom=(a.ts||1)*kz;" in out
    assert "ch.style.zoom=kz;" in out
    # exactly ONE unscaled site survives: the builder panel's slot
    # preview, which is a thumbnail, not the zoomable canvas
    assert out.count("if(a.ts) b.style.zoom=a.ts;") == 1


def test_rail_has_one_new_button_and_per_row_delete(out):
    """Four "+ New ..." buttons were most of the rail; they are one
    "+ New..." menu now, and every rail row grew a hover-delete with a
    confirm -- deleting no longer means three File-menu levels
    (2026-08-18, user). The originals stay hidden so their handlers keep
    working; the menu rows click them.
    """
    assert 'id="pr-newbtn"' in out and 'id="pr-newmenu"' in out
    for f in ("pr-new", "pr-newpost", "pr-newview", "pr-newfold"):
        assert '<button class="pr-btn" hidden id="' + f + '"' in out
    assert "function deletePresByName(nm){" in out
    assert "del.className='pr-del';" in out
    assert "if(confirm(" in out
    assert ".pr-item:hover .pr-del,.pr-item.current .pr-del" in out


def test_notebooks_pane_survives_its_own_actions(out):
    """Clicking a row or Open/Refresh used to close the pane -- the
    dropdown's habit surviving into the pane. It re-renders and stays;
    only the cross or the toolbar button closes it (2026-08-18, user).
    """
    assert "setTimeout(renderNbsMenu,600);" in out
    assert "APP.openPath(n.path);hideNbsMenu();" not in out


def test_browser_saves_offer_a_way_out(out):
    """"autosaved to browser" is one power cut from gone, so the readout
    itself is the door: clickable, titled, and it opens the save-to-file
    picker. One helper, called from BOTH status branches -- the manual
    web-save branch returns early and silently missed the first version
    (2026-08-18). Measured: "saved to browser" readout clickable=true.
    """
    assert "function markSaveClickable(el){" in out
    assert out.count("markSaveClickable(el);") == 2
    # clicking SAVES now — it used to open the save-to-file picker, but a
    # thing that says "autosaved" invites saving, not a destination dialog
    # (2026-08-19, user: "clicking the autosave button should save").
    # Measured 2026-08-20: a click produced "saved to browser · 00:27".
    assert "var sb=$('#dc-save'); if(sb) sb.click();" in out


def test_the_ribbon_is_tabbed(out):
    """One ribbon stopped being able to hold the editor: every feature
    added a control and every control bought a density rung, so the row
    spent its whole life at the tight end of the ladder (2026-08-20,
    user: "there might not need to be tabs like power point and foxit pdf
    has ... there might be starting to get too many feature to have on one
    ribbon").

    A tab is a filter, nothing more: each group declares its data-tab and
    everything off-tab leaves the row entirely (display:none, so it costs
    nothing in the width fitEditRibbon measures). The density ladder is
    unchanged underneath -- with a third of the groups in the row it
    simply almost never has to fire.

    Object is the one named place for selection-driven controls. It appears
    with a selection and leaves again when it has no controls to offer, so
    clicking a thing no longer takes Home over and changes its contents.
    """
    assert 'class="rbn-tabs" id="rbn-tabs"' in out
    # Three page-level tabs since 2026-08-20. Five left two nearly empty
    # (user: "some of those tabs have nothing on them now. Insert and
    # animate can be one the one" / "View can just be back on home"), and
    # a fourth contextual tab now keeps an ordinary selection from
    # rewriting Home (2026-08-26, user).
    for t in ("home", "insert", "design", "object"):
        assert f'id="rbn-tab-{t}"' in out, t
        assert f"'{t}'" in out
    assert "var TABS=['home','insert','design','object'];" in out
    assert out.count('class="rbn-grp" data-tab="object"') == 5
    assert 'class="rbn-grp rbn-tbl" data-tab="object"' in out
    assert 'id="rbn-tab-animate"' not in out
    assert 'id="rbn-tab-view"' not in out
    # a browser remembering one of the retired tabs lands on its new host
    assert "if(t==='animate') t='insert';" in out
    assert "function setTab(t){" in out
    assert "function applyTab(){" in out
    # the filter runs BEFORE anything measures the row
    # the filter runs BEFORE anything MEASURES the row, which is the
    # invariant -- not its old position in the function. Ribbon layouts
    # moved the emptiness pass ahead of it, because whether a group is
    # empty does not depend on which tab is showing, and the tab
    # decisions need that answer first (2026-08-25).
    i = out.index("function syncRibbonGroups(){")
    block = out[i:i + 2600]
    assert "applyTab();" in block
    assert block.index("applyTab();") < block.index("sizeRibbonGroups();")
    # a poster has no build, so the whole Animate GROUP stands down there
    assert ("['#anim-clear','#anim-stagger','#anim-together']"
            ".forEach(function(id){") in out
    # the chosen tab is remembered per project
    assert "function tabKey(){return 'jv-deck-tab:'+SCOPE;}" in out


def test_bullets_are_a_real_list_model(out):
    """a.list drew a <ul> from a.text's newlines while a.html -- the rich
    version of the same box -- sat untouched underneath it. Turning
    bullets OFF fell straight back to that stale a.html, so everything
    typed as a list vanished and text from before it came back
    (2026-08-20, user: "the bullet list on/off is cursed. PLEASE DO
    EVERYTHING PROPERLY").

    Now there is ONE content field. a.list says 'bullet' or 'number' and
    the ITEMS live in a.html as bare <li>s, so switching markers rewrites
    no content at all; setListStyle converts on the way in and on the way
    out. ul/ol/li joined RICH_TAGS, which is what lets bold inside a
    bullet and a nested sub-level survive the round trip -- verified in
    the browser 2026-08-20: "<li>EDITED <b>alpha</b></li>...<ul><li>sub
    bullet</li></ul>" came back byte-identical, and turning bullets off
    gave "EDITED <b>alpha</b><br>Beta<br>Gamma<br>sub bullet".
    """
    assert "function listOf(a){" in out
    assert "function setListStyle(a,style){" in out
    assert "function contentLines(a){" in out
    assert "ul:1,ol:1,li:1};" in out
    assert "'span[style],font,b,strong,i,em,u,s,ul,ol')};" in out
    # a legacy deck stored a.list as the boolean 1
    assert "return a&&a.list?(a.list===true||a.list===1?'bullet':a.list):0;" \
        in out
    # the marker is on the ELEMENT, the items are the content
    assert "tx2=document.createElement(lst==='number'?'ol':'ul');" in out
    assert "ol.an-ul{list-style:decimal;}" in out
    # Tab makes a sub-bullet, the way every outliner does -- and only
    # inside a list, where it has something to mean
    assert "if(e.key==='Tab'&&el.classList.contains('an-ul')){" in out


def test_find_and_replace_searches_the_model(out):
    """A browser find can only see the one slide that happens to be
    rendered, which for a deck is the wrong answer almost every time. So
    Ctrl+F searches the MODEL: every text box, list item, title, subtitle
    and table cell on every slide (2026-08-20, user: "needs to be a search
    and replace of text and stuff, that is pretty standard").

    A placed notebook card is deliberately NOT searchable -- its words
    belong to the notebook, and rewriting them here would put the slide
    and its source out of step with no way to tell.
    """
    assert 'class="find-pop" id="find-pop"' in out
    assert "function replaceAll(){" in out
    assert "if(window.SemDeckFind) window.SemDeckFind();" in out
    # landing on a hit goes to its slide AND selects the item, so you can
    # see what you are about to change
    assert "if(cur!==h.f.si){cur=h.f.si;refresh();}" in out
    # an empty match must never loop forever
    assert "if(!m[0].length) re.lastIndex++;" in out
    # T45: a table contributes one writable field per cell. The closure
    # writes only that cell, and the hit says exactly where it came from.
    fields = out[out.index("function fields(){"):
                 out.index("function rx(){")]
    assert "if(a.k==='table'){" in fields
    assert "tableNormalise(a);" in fields
    assert "a.rows.forEach(function(row,r){" in fields
    assert "row.forEach(function(_,c){" in fields
    assert "+(r+1)+', column '+(c+1)" in fields
    assert "set:function(v){a.rows[r][c]=v;}" in fields


def test_tables_are_a_real_item_kind(out):
    """A table is rows of plain strings plus a handful of switches -- not
    HTML, because a table you can only fill by typing HTML is a table
    nobody will use, and rows-of-strings is the shape every export already
    knows how to walk (2026-08-20, user asked for "Tables").

    The header row is a FLAG rather than a separate field, so turning it on
    or off moves no data. Column widths live in a.cols and are dragged, not
    typed. The rules use a.sw -- the same page-relative stroke currency
    every other item uses -- because a fixed 1px hairline vanishes on an A0
    poster and is a fence at 10% zoom.

    Verified in the browser 2026-08-20: drawn 3x3 with a header row, typed
    into a cell, +row/+column to 4x4 with the typed cell intact, header
    toggled off (3 th -> 0), and the thumbnail drew a miniature of it.
    """
    assert 'data-tool="table"' in out
    assert "function drawTable(layer,s,a,i,editing){" in out
    assert "function tableNormalise(a){" in out
    assert "function tableGrow(a,what,by){" in out
    assert "function startTableEdit(layer,s,a,idx,td,ri,ci){" in out
    assert "function startColDrag(layer,s,a,idx,at,ev0){" in out
    # Tab along, Enter down -- the two moves that make a table usable
    # without reaching for the mouse between every cell
    assert "if(e.key==='Tab'){e.preventDefault();" in out
    # rules scale with the page like every other stroke
    assert "host.style.setProperty('--tbl-sw',strokePx(a,layer)" in out
    # it reaches every output: thumbnails, and a REAL pptx table
    assert "var bt=miniBox(d,a,'is-tbl');" in out
    assert "function tableShape(item, id, page) {" in out
    assert "} else if (item.t === 'table') {" in out


def test_page_furniture_is_deck_level_not_an_item(out):
    """A watermark, a header and a footer are one piece of content
    repeated on every page -- which is exactly what slide numbers already
    were. So they live on `pres`, are painted after the annots, and are
    therefore not items you can select, drag or delete by accident
    (2026-08-20, user asked for "Watermarks" and "Header and footer").

    ONE painter, called by renderSlide for the canvas and by buildPrintRoot
    for PDF / standalone HTML -- a second copy is how an export and the
    screen drift apart.
    """
    assert "function paintFurniture(slideEl,idx){" in out
    assert out.count("paintFurniture(slideEl,") >= 2
    assert "function furnText(txt,idx){" in out
    # sized in percent of PAGE HEIGHT, resolved to px. Left as a CSS
    # percentage it resolved against the parent's font size instead, so a
    # 12% watermark came out under 2px and was invisible (found live)
    assert "var ph=slideEl.getBoundingClientRect().height||720;" in out
    assert "wm.style.fontSize=px(w.size,12);" in out
    # behind the content, never over it
    assert "slideEl.insertBefore(wm,slideEl.firstChild);" in out
    # and it survives a save, the way pageBg had to learn to
    # `tokens` joined them for the same reason (T12): a deck that has
    # forgotten what "@accent" means renders the fallback instead
    assert ("['wmark','head','foot','styles','tokens',\n"
            "     'components','cuts'].forEach(function(k){") in out


def test_equations_reuse_the_text_box_and_mathjax(out):
    """No new item kind: MathJax is on every page already and renderSlide
    already typesets the finished slide, so a text box whose words happen
    to be "$$ ... $$" is typeset for free -- and moves, colours, scales,
    exports and animates like any other text box (2026-08-20, user asked
    for "Maths inserts").

    What it does add is RE-typesetting: the annot layer is rebuilt on every
    change, so the rendered maths would otherwise be thrown away the moment
    you touched anything. Gated on the slide actually carrying maths --
    typesetting a whole layer on every mousemove of a drag would be a real
    cost for nothing.
    """
    assert 'id="dc-maths"' in out
    # the gate is one named predicate, so the question it asks can be
    # widened without hunting for an inlined copy of it -- and it was
    # widened, to slideHasMaths, when a title slide turned out to keep
    # its LaTeX somewhere s.annots could not see it (T53)
    assert "if(slideHasMaths(s)) typeset(layer);" in out
    # ...and since 2026-08-20 there is a real EDITOR in front of it. The
    # button used to drop "$$ E = mc^2 $$" on the slide and walk away --
    # no preview, no symbols, no way to tell whether what you typed was
    # valid (user: "what the hell does insert equation do? There is no
    # latex render and no symbols and stuff to add?").
    assert 'id="eq-dlg"' in out
    assert "var EQ_PAL=[" in out
    for grp in ("'Structures'", "'Greek'", "'Operators & relations'",
                "'Arrows & accents'", "'Ready-made'"):
        assert grp in out, grp
    # a template lands the caret in the first empty brace, or every insert
    # is followed by arrowing back through the closing one
    assert "var hole=txt.indexOf('{}');" in out
    # MathJax comes from a CDN, so on a locked-down network there is no
    # renderer at all -- a blank preview would read as "your LaTeX is
    # wrong" rather than "nothing here can draw it"
    assert "No maths renderer available" in out
    # and an existing equation goes back to the editor it came from
    assert 'id="fmt-eqedit"' in out
    assert "function isMaths(a){" in out


def test_named_text_styles_and_apply_to_all_headings(out):
    """A named look a box WEARS rather than a pile of properties it
    carries. The box records a.style; the numbers come from pres.styles,
    which is what makes restyling every heading one edit to one object
    instead of a hunt through forty slides (2026-08-20, user: "all the
    different heading styles that you can have" and "some things like
    'apply style to all headings'").

    applyStyleTo WRITES the properties rather than resolving them at render
    time, deliberately: every export, the pptx converter and the thumbnails
    already read a.size / a.b / a.color, and teaching all five about styles
    would be five places to get it wrong.
    """
    assert "var STYLE_DEFAULTS={" in out
    assert "var HEADING_STYLES=['title','h1','h2','h3'];" in out
    assert "function applyStyleTo(a,id){" in out
    assert "function restyleDeck(ids){" in out
    assert 'id="fmt-style-menu-tx"' in out
    # the size scale is a real scale, ~1.3x a step
    for key in ("title:", "h1:", "h2:", "h3:", "body:", "caption:"):
        assert key in out, key
    # size is what makes a heading level a level, so "apply to all
    # headings" is the one thing that must not flatten it
    assert "d4.size=(deckStyles()[id]||{}).size||STYLE_DEFAULTS[id].size;" \
        in out


def test_marquee_and_group_entry(out):
    """Mousedown on nothing used to deselect and stop there, so the only
    way to select several items was to shift-click each one (2026-08-20,
    user: "You can't drag and select multiple items. The shift and select
    multiple is realyl hard to do").

    TOUCH, not enclose: a band that has to swallow an item whole is
    unusable on a poster where the figures are bigger than the gap you have
    to drag in. Under the threshold it is still just a click, so "click
    empty space to deselect" is unchanged.

    And double-clicking a group steps INSIDE it, so its members can be
    picked one at a time -- there was no way to touch a single item in a
    group at all before ("You also can't select multiple items in a group
    like you can in powerpoint to modify").
    """
    assert "function startMarquee(layer,s,ev0){" in out
    assert "band.className='an-marquee';" in out
    assert "if(dx<MARQUEE_PX&&dy<MARQUEE_PX) return;" in out
    assert "} else startMarquee(layer,s,ev);" in out
    # ctrl joins shift as an additive modifier -- half the world reaches
    # for it first and it did nothing at all before
    assert "if((ev.shiftKey||ev.ctrlKey||ev.metaKey)&&typeof idx==='number')" \
        in out
    # entering a group
    assert "var inGroup=null;" in out
    assert "if(inGroup!=null&&a.grp===inGroup) return [idx];" in out
    assert "inGroup=a2.grp;" in out
    # ...and Esc steps out before it drops the selection
    assert "else if(mode==='edit'&&inGroup!=null){" in out


def test_stacking_order_acts_on_the_whole_selection(out):
    """There is no z property: order in s.annots IS order on the page, so
    every one of these is an array move. It used to act on selAnnot alone,
    so bringing a GROUP to the front brought one member and left the rest
    behind (2026-08-20).

    idxs[0] is the lowest selected index, so every item below it is in
    `rest` -- which makes idxs[0] exactly the insertion point that leaves
    the block where it is. One step is one either side of that.
    """
    assert "function zReorder(front,step){" in out
    assert "var at0=idxs[0];" in out
    assert "?(front?Math.min(rest.length,at0+1):Math.max(0,at0-1))" in out
    # the selection is a set of INDICES, so it has to be rebuilt after
    assert "selSet=moved;selAnnot=moved[moved.length-1];" in out


def test_spotlight_zooms_one_item_during_playback(out):
    """2026-08-20, user: "in power point when you present it is static ...
    it would be cool if clicking on text or a figure made it full screen in
    the presentation".

    The hard part is not the zoom, it is that a click on the slide already
    ADVANCES the build, and that gesture is what a talk runs on -- it
    cannot be overloaded. So a plain click still advances; Alt+click
    spotlights, and Z spotlights whatever the pointer is over, which is the
    version you can use from a lectern with a clicker in one hand.

    It is a FLIP: the item is cloned, placed exactly over the original, and
    then transformed to the centre, so it grows out of where it was and the
    original never moves.
    """
    assert "function spotlight(item){" in out
    assert "function spotTarget(ev){" in out
    assert "if(e.altKey){" in out
    assert "&&mode==='view'){" in out
    # never SHRINK something already big -- a spotlight that makes the
    # figure smaller is a bug wearing a feature's clothes
    assert "k=Math.max(1,k);" in out
    # the clone is a picture, not a control
    assert "clone.classList.remove('sel','grpsel','an-prebuild','an-ingrp');" \
        in out


def test_the_fill_panel_is_drawn_not_worded(out):
    """Six worded rows became a panel you pick from by LOOKING.
    "Gradient -- linear" told you nothing about which way it ran, and
    "gradients from different directions, multiple colours" was not
    expressible at all (2026-08-20, user: "all the gradient fills are just
    words. Put images showing it. Also put heaps of options in this").

    Every chip is drawn with the shape's OWN colours, so the preview is the
    answer rather than an illustration of one. Measured in the browser:
    35 chips, 24 inline-SVG previews, and a three-stop preset came out as
    linear-gradient(360deg, #f0a848 0%, #e5484d 50%, #7a2b6b 100%).

    It also absorbs the fill COLOUR swatches: there used to be a "Fill"
    here and a "Fill colour" two groups away and nobody could tell which
    was which ("Also confusing there is a fill and fill colour").
    """
    assert "function fillSwatch(kind,opt,base){" in out
    assert "var GRAD_DIRS=[" in out
    assert "var GRAD_PRESETS=[" in out
    assert "function stopsFrom(cols){" in out
    # eight linear directions plus a radial
    for ang in ("[0,'Left to right']", "[90,'Bottom to top']",
                "[270,'Top to bottom']"):
        assert ang in out, ang
    assert "'From the centre'" in out
    # multi-stop ramps
    assert "['Ocean',   ['#39a9c0','#1e6f9e','#123a63'], null]" in out
    # changing a colour must not silently change the KIND of fill
    assert "st[0]={o:st[0].o,c:c};" in out


def test_match_another_slides_layout(out):
    """The most tedious thing about building a deck is making slide 7 sit
    exactly like slide 3. PowerPoint's answer is to duplicate a slide and
    replace its contents, which loses the contents you already had
    (2026-08-20, user: "would be cool if there was a 'match other slide'
    option ... the text style, locations and sizes of everything become
    that same").

    It matches by KIND in reading order, and a text box's kind is its
    named STYLE when it has one -- so a Heading 1 matches a Heading 1 and
    not just any old text. Nothing is added and nothing is deleted; only
    geometry and styling travel. Measured: "Matched 1 item to slide 1".
    """
    assert "function matchSlide(fromIdx,toIdx){" in out
    assert "function matchKey(a){" in out
    assert "if(a.k==='text') return 'text:'+(a.style||'body');" in out
    assert "var MATCH_PROPS=[" in out
    assert 'id="hm-match"' in out
    # run out of models? reuse the last, so three bullets here all take
    # the styling of the one bullet there
    assert "var m=from[Math.min(n,from.length-1)].a;" in out
    # and it says so when there was nothing to match
    assert "have no matching items" in out


def test_arrange_is_thorough(out):
    """2026-08-20, user: "the arrange options could be better. Like what
    there is in photo shop editors, like I want this to be really
    thorough". Aligning to the PAGE is the one people reach for and could
    not previously express: aligning centres a block on its own average,
    not on the page.
    """
    assert "function centreOnPage(how){" in out
    assert "function closeGaps(axis){" in out
    assert "function flipSel(axis){" in out
    assert "function turnSel(deg){" in out
    # flipping mirrors real geometry, not just position
    assert "a.pts=a.pts.map(function(q){" in out
    # match sizes takes the BIGGEST: matching down usually crops something
    assert "if(mode==='w'||mode==='h'||mode==='both'){" in out


def test_layers_can_be_renamed(out):
    """Twelve rows saying "Shape - box" is a list you cannot navigate
    (2026-08-20, user: "also be able to rename layers"). Groups already
    worked as folders with names of their own; individual items did not.
    Clearing the name puts the kind-derived one back rather than leaving a
    blank row. Measured: "Shape - box" -> "Hero box".
    """
    assert "if(a.name) return a.name;" in out
    assert 'inp.className=\'sp-rename\';' in out
    assert "if(v) a3.name=v; else delete a3.name;" in out


def test_no_group_is_a_heading_over_one_button(out):
    """2026-08-20, user: "some tabs still now have two few buttons. I
    think review these and think about groups again".

    Measured before: Home had View(5) Output(1) Slides(5); Insert had
    Animate(2) Insert(10); Design had Slide(4) Page furniture(4) -- eight
    controls for a whole tab. Measured after: Home View(6) Slides(5),
    Insert Animate(4) Insert(10), Design Slide(4) Page furniture(4)
    Type(4). Nothing under four, and every tab still fits.

    Two of the three fixes added real features rather than shuffling
    buttons, which is the only honest way to fill a thin group.
    """
    # Output folded into View
    assert 'class="rbn-grp rbn-out"' not in out
    # Animate gained the two builds anyone actually wants
    assert 'id="anim-stagger"' in out and 'id="anim-together"' in out
    assert "function orderedIdx(s2){" in out
    # Design gained the deck-level type manager
    assert 'class="rbn-grp rbn-type" data-tab="design"' in out
    assert 'id="dsg-styles"' in out
    assert "function scaleStyles(k){" in out
    # `scope` (2026-08-22) is an array of slide indexes, or null/omitted
    # for the whole deck -- the Apply dialog restyles a chosen run of
    # slides through the same walker rather than growing a second one.
    # The four callers that came first still pass one argument.
    assert "function restyleAll(ids,scope){" in out


def test_builds_follow_reading_order_not_array_order(out):
    """The array is the order you happened to DRAW things in, which is
    nobody's idea of a sequence -- draw the bottom caption first and it
    would animate first. Measured 2026-08-20 with three boxes drawn
    bottom-up: builds came out first=2, second=3, third=4.
    """
    assert "function orderedIdx(s2){" in out
    # arrows have no x/y of their own; they are ordered by their topmost
    # endpoint like everything else
    assert ("var ay=(p2.a.k==='arrow')?"
            "Math.min(p2.a.y1,p2.a.y2):(p2.a.y||0);") in out
    # a 4% band counts as "the same line", so a row of items reads across
    assert "return Math.abs(ay-by)>4?(ay-by):(ax-bx);" in out


def test_paste_has_three_placement_modes(out):
    """TASKS T1. One buffer, three questions about where it lands:

    ``auto`` (Ctrl+V) keeps the rule that was already there -- nudge on
    the same slide, same place on another. ``place`` (Ctrl+Shift+V) uses
    the source's coordinates exactly, same slide included, and never
    cascades, so pasting into ten slides gives ten identical positions.
    ``here`` (Ctrl+Alt+V, or the right-click menu) centres the whole set
    on a point, keeping its internal arrangement.
    """
    assert "function pasteBuf(how,at){" in out
    # 'place' takes neither the nudge nor the cascade
    assert "} else if(how!=='place'){" in out
    assert "if(how!=='place'&&how!=='here') clipBuf=clipBuf.map(" in out
    # 'here' moves the SET, not each item, and stays on the page
    assert "function clipBox(buf){" in out
    assert "dx=pt.x-(box.l+box.r)/2;dy=pt.y-(box.t+box.b)/2;" in out
    assert "if(box.l+dx<0) dx=-box.l;" in out
    # the pointer is recorded in CLIENT coordinates on the mousemove that
    # already runs there, and converted only when a paste asks
    assert "lastCanvasXY={x:e.clientX,y:e.clientY};" in out
    assert "function pointerPct(){" in out
    # both shortcuts sit BEFORE the plain-paste branch, which matches
    # 'v' and 'V' alike and would otherwise swallow them
    vkey = "\n              &&(e.key==='v'||e.key==='V')){"
    place = out.index("&&e.shiftKey" + vkey)
    here = out.index("&&e.altKey" + vkey)
    plain = out.index("/* NOT preventDefaulted: the native paste event")
    assert place < plain and here < plain


def test_paste_here_is_reachable_from_where_you_clicked(out):
    """"Paste here" needs a point, and a right-click is the only door
    that has one -- so the canvas grew a context menu, built from the
    film strip's helpers so there is one menu idiom in the file.

    The click point is frozen when the menu opens: by the time the row
    is clicked the pointer is over the menu, not the page.
    """
    assert "function openCanvasMenu(layer,s,ev){" in out
    assert "var at=pctPoint(layer,ev);" in out
    assert "row('Paste here','Ctrl+Alt+V',function(){pasteBuf('here',at);}," in out
    assert "openCanvasMenu(layer,s,ev);" in out
    # a right-click picks but never drags -- the menu used to open on top
    # of a move gesture this handler had already started
    assert ('if(ev.button===2\n           '
            "&&!(t.classList&&t.classList.contains('an-endpt'))){") in out
    # ... except on a bend corner, where right-click removes it
    assert "if(ev.altKey||ev.button===2){" in out


def test_a_pasted_arrow_brings_its_corners_and_drops_dead_ties(out):
    """An arrow's bend corners and its attached endpoints are both stored
    apart from x1/y1/x2/y2, and paste moved neither.

    The corners simply stayed behind at the original's coordinates. The
    ties are worse: ``c1``/``c2`` hold an INDEX into the slide they came
    from, so pasting onto another slide tied the arrow to whatever
    happened to sit at that number. They are re-pointed at the pasted
    copy when it is in the same set, kept when the original is still on
    this slide, and dropped otherwise.
    """
    assert "if(Array.isArray(cp.mid)) cp.mid=cp.mid.map(function(m){" in out
    assert "clipIdx.forEach(function(src,n){remap[src]=first+n;});" in out
    assert "return (clipFrom===cur)?c:null;" in out
    assert "if(t1) cp.c1=t1; else delete cp.c1;" in out


def test_every_object_copy_gets_independent_relationship_identities(out):
    """T42. Deep-copying the object is not enough: several stored ids
    mean that two objects are the SAME figure, caption pair or component
    instance. Keeping any of them made editing the original reach into
    its apparent copy.

    One two-pass helper owns those rules for clone and paste. Every
    figure receives a fresh deck-wide id; a copied caption follows that
    new figure only when both were copied, and otherwise becomes ordinary
    text. Component members retain cmp/ci but share one fresh cinst per
    copied source instance. The second pass is what makes caption-before-
    figure array order safe.
    """
    assert "function independentCopies(srcs,s,sourceMeta){" in out
    clone = out[out.index("function cloneAnnots(idxs,dx,dy){"):
                out.index("function duplicateSel(){")]
    paste = out[out.index("function pasteBuf(how,at){"):
                out.index("/* an image on the system clipboard")]
    assert "independentCopies(srcs,s,s.grpmeta)" in clone
    assert "independentCopies(clipBuf,s,clipGrpMeta)" in paste
    assert "cp.cap=figId();" in out
    assert "capMap['f'+oldCap]=cp.cap;" in out
    assert "if(freshCap) cp.capOf=freshCap;" in out
    assert "else delete cp.capOf; /* its figure was not copied */" in out
    assert "var ik='i'+(cp.cmp||'')+'|'+cp.cinst;" in out
    assert "if(instMap[ik]==null) instMap[ik]=nextCinst();" in out
    assert "cp.cinst=instMap['i'+(cp.cmp||'')+'|'+cp.cinst];" in out


def test_paste_preserves_a_group_without_reusing_it(out):
    """T42. Copy remembers group metadata at copy time -- not by looking
    through clipFrom later, after slides may have moved or disappeared.
    Each paste rebuilds the mapping, so repeated and cross-slide pastes
    keep their internal grouping and folder name/colour without joining
    either the source or one another.

    The Objects pane used to remap a whole-group clone a second time after
    cloneAnnots had already done it, leaving an orphan grpmeta entry. Its
    Duplicate now rides the same single mapping as every other clone.
    """
    assert "var clipBuf=[],clipGrpMeta={},pendingPaste=null;" in out
    assert "clipGrpMeta={};" in out
    assert "clipGrpMeta[a.grp]=deep(s.grpmeta[a.grp]);" in out
    assert "var gk='g'+cp.grp;" in out
    assert "if(gmap[gk]==null) gmap[gk]=gnext++;" in out
    assert "if(cp.grp!=null) cp.grp=gmap['g'+cp.grp];" in out
    assert "var old=gk.slice(1),m=sourceMeta&&sourceMeta[old];" in out
    assert "s.grpmeta[gmap[gk]]=m2;" in out
    assert "delete cp.grp;" not in out
    pane_dup = out[out.index("function dupAnnots(idxs){"):
                   out.index("/* ---- panes are yours to place")]
    assert "cloneAnnots(idxs,2,2)" in pane_dup
    assert "nextGrp(" not in pane_dup


def test_duplicating_clones_the_whole_selection(out):
    """TASKS T2. ``duplicateSel`` acted on ``selAnnot`` alone, so Ctrl+D
    on a five-item selection gave you one item.

    A clone is an INDEPENDENT copy -- linked instances are T13, and the
    two verbs are kept apart deliberately. Groups survive as NEW groups:
    clone two members of a group of five and the pair still moves as one.
    Fully locked items are skipped, because an unlocked twin dropped on
    top of an unclickable original is a puzzle, not a duplicate. A
    POSITION-locked one (T3) clones happily -- the copy is a free item.
    """
    assert "function cloneAnnots(idxs,dx,dy){" in out
    assert "var made=cloneAnnots(idxs,CLONE_OFF,CLONE_OFF);" in out
    # one new group id per source group, allocated before any push --
    # nextGrp reads the max off s.annots and would repeat itself
    assert "if(gmap[gk]==null) gmap[gk]=gnext++;" in out
    assert "var a=s.annots[i];return a&&!lockedAll(a);" in out
    # a stray stays a stray; a duplicate does not sail off the corner
    assert "function cloneShift(v,d){" in out
    assert "return (d>0&&n>96&&(v||0)<=96)?96:n;" in out
    # the pane's Duplicate rides the same clone rather than its own copy
    assert "var added=cloneAnnots(idxs,2,2);" in out


def test_alt_drag_drags_a_clone(out):
    """TASKS T2. Alt-drag makes the copies in place and drags THOSE, so
    the originals stay put and the rest of startMove needs to know
    nothing about it.

    Alt already meant "ignore snapping" mid-drag. In a clone drag it does
    not: Alt was pressed to say "copy", and it has to be held all the way
    -- so a clone drag would otherwise be the one drag with no guides.
    """
    assert "var clones=cloneAnnots(pick,0,0);" in out
    assert "idx=clones[k>=0?k:0];" in out
    assert "if(cloning||!ev.altKey){" in out
    # quiet: the mouseup at the end of the gesture takes the one undo
    # entry, so undo puts back the state before the clone AND its move
    assert "markDirty(true);\n        renderAnnots(layer,s);" in out
    # selecting a batch cannot be a loop of selectAnnot(...,true): that
    # TOGGLES, so members sharing a group come straight back out
    assert "function selectMany(layer,idxs){" in out
    assert "selectMany(layer,clones);" in out


def test_locking_comes_in_two_strengths(out):
    """TASKS T3. One boolean meant one lock, and it was the heavy one:
    off the canvas entirely. A figure frame usually wants the other one
    -- the plot must not wander, and you still need to resize it.

    ``lockMode`` is the only reader of the raw flag, so a third mode
    would be a change in one place. Everything else asks ``pinned`` (the
    movement question) or ``lockedAll`` (the reachability one); getting
    those two the wrong way round is the bug the split exists to make
    hard. Saved decks carry ``lock:1``, which reads as the full lock.
    """
    assert "function lockMode(a){" in out
    assert "return a.lock==='pos'?'pos':'all';" in out
    assert "function lockedAll(a){return lockMode(a)==='all';}" in out
    assert "function pinned(a){return !!lockMode(a);}" in out
    # movement: both locks pin
    assert "var m=(s.annots||[])[i];return m&&!pinned(m);" in out
    assert "var a=s.annots[i]; if(!a||pinned(a)) return;   /* no nudge */" \
        in out
    assert "if(!a||a.k!=='arrow'||pinned(a)) return;" in out
    # reachability: only the full lock takes it away, and only the full
    # lock gets pointer-events:none
    assert "if(lockedAll(a)) return;" in out
    assert "el.classList.add(lm==='all'?'an-locked':'an-pinned');" in out
    assert ".deck.editing .an-pinned{cursor:default;}" in out
    # nothing READS the raw flag any more. The three writers (the
    # pane's cycle, the menu's setLockSel, and lockMode itself) are
    # the only places `.lock` appears -- these were the reader forms.
    for reader in ("a.lock||", "a.lock?", "if(a.lock)",
                   "&&!m.lock", "a.hide||a.lock"):
        assert reader not in out, reader
    # lockMode's own guard is the one surviving read of the flag
    # (`!a.lockver` is a different flag -- figure version locks)
    assert out.count("!a.lock)") == 1


def test_a_locked_object_is_not_lost_to_the_marquee(out):
    """TASKS T3. A lock means "not by accident", not "never again" -- but
    a fully locked item was reachable through the Objects pane and
    nowhere else, which is a long way round to a background frame you
    locked months ago. Alt sweeps them up; Shift and Ctrl are taken (they
    add to the selection) and Alt means nothing else on empty canvas.
    """
    assert "var takeLocked=ev0.altKey;" in out
    assert "if(lockedAll(a)&&!takeLocked) return;" in out


def test_the_lock_is_set_in_words_as_well_as_by_icon(out):
    """The pane's button cycles three states in a quarter of the row's
    width, which is the only way it fits; nobody discovers the
    position-only lock that way. The right-click menu names all three and
    marks the one the selection is in -- or none of them, when a mixed
    selection is in more than one.
    """
    assert "function setLockSel(mode){" in out
    assert "var lmNow=lms.every(function(x){return x===lms[0];})" in out
    assert "if(lmNow===o[0]) b.classList.add('on');" in out
    # the pane button: three states, and a tooltip naming the state it is
    # IN as well as what the click does next
    assert "function cycleLock(i){" in out
    assert "if(m==='') a2.lock='pos';" in out
    assert "lk.innerHTML=bic(lm==='pos'?'pin':'lock');" in out
    assert "'Fully locked. Click to unlock';" in out
    # the middle state reads as a different thing, not a dimmer full lock
    assert ".sp-act.on.half{color:var(--amber);}" in out


def test_selecting_by_what_things_are(out):
    """TASKS T5. A CRITERION is one named question about an object,
    answered off a reference object -- key 'font', value 'georgia'.
    Keeping it a value rather than a closure is the design: find &
    replace (T6) runs the identical question over every slide while the
    selection here runs it over one, and neither owns the question.

    `type` is not re-invented. typeKeyOf / typeLabel already answer "what
    kind of thing is this" for the Apply dialog, in the deck's own
    vocabulary -- including styles you invented yourself, read live out
    of the registry.
    """
    assert "var SELECT_CRIT=[" in out
    assert "function critRead(key,a){" in out
    assert "function annotsBy(sl,key,val){" in out
    # the type row rides on the existing vocabulary rather than a second
    # copy of it
    assert "['type',function(a){return typeKeyOf(a)||null;}," in out
    assert "return 'Every '+typeLabel(v,false,a);}]," in out
    # a typeface now turns into WORDS as well as css and pptx
    assert "function fontLabel(v){" in out
    assert "FONTLAB[f.id]=f.label;});" in out
    # sizes read in the pt the Styles menu prints
    assert "return 'Everything at '+Math.round(v*5.4)+' pt';}]," in out


def test_select_by_counts_what_it_will_actually_take(out):
    """The count in a row and the set the row selects come from the same
    function, so "Every Caption (4)" always selects exactly four.

    Hidden objects are out -- they are not on the page you are looking
    at. Fully locked ones are out too, the same rule the marquee follows
    (T3); position-locked ones are ordinary, as everywhere else. And a
    row that would select only the object you already have is not
    offered at all.
    """
    assert "if(!a||a.hide||lockedAll(a)) return;" in out
    assert "var hit=annotsBy(s2,c[0],v);\n      if(hit.length<2) return;" \
        in out
    assert "out.push({key:c[0],val:v,n:hit.length,idxs:hit," in out
    # selecting a batch reuses T2's selectMany, which does not toggle
    assert "selectMany(stage.querySelector('.annot-layer'),hit);" in out


def test_select_by_has_two_doors_and_neither_costs_ribbon_width(out):
    """The canvas menu lists the rows inline -- it is already a menu, and
    burying them a level deeper would cost a click for nothing. The
    Arrange menu gets one row that opens the same list: that menu is
    shown for every kind of item and already keeps the "everything like
    this one" verbs, and the ribbon has no width for a button of its own.
    """
    assert "function openSelectByMenu(anchor,ev){" in out
    assert "['s:by','Select everything on this slide like this…']]" in out
    assert "if(what==='s:by'){openSelectByMenu($('#fmt-align-btn'));return;}" \
        in out
    assert "menuHead(m,'select on this slide');" in out
    # a menu five sections deep scrolls rather than running off-screen
    assert ".canvas-menu{min-width:215px;max-height:72vh;overflow-y:auto;}" \
        in out


def test_find_and_replace_has_a_formatting_half(out):
    """TASKS T6. Text replace answers "every 'SST' becomes 'sea surface
    temperature'"; this answers "every 18pt Georgia heading becomes 20pt
    Inter". Same verb, different material, so they share one popover
    rather than growing a second door somewhere else.

    FIND reuses T5's criteria table rather than duplicating it, and is
    seeded BY EXAMPLE off the selected object -- describing a look in
    the abstract is a form nobody fills in correctly.
    """
    assert 'id="find-m-text"' in out and 'id="find-m-fmt"' in out
    assert 'id="find-fmt"' in out
    # the text half hides by attribute, so no CSS had to be restructured
    assert '<div class="find-row" data-fmode="text">' in out
    assert "$$('#find-pop [data-fmode]').forEach(function(el){" in out
    # the criteria come from T5's table, not a second copy
    assert "SELECT_CRIT.forEach(function(c,n){" in out
    assert "function critsMatch(a,crit){" in out
    # ...and an empty criteria set matches nothing on purpose
    assert "if(!a||!crit||!crit.length) return false;" in out
    # T45: the non-modal half follows real canvas selection changes,
    # including deselection, through the same showFmt convergence point.
    show = out[out.index("function showFmt(){"):
               out.index("function syncRibbonGroups(){")]
    assert show.index("window.SemDeckFindSync()") < show.index("if(!a){")
    # Slide navigation has several paths that deliberately skip showFmt,
    # so renderSlide carries the same guarded synchronization seam.
    render = out[out.index("function renderSlide()"):
                 out.index("/* ---------- free annotations:")]
    assert (render.index("syncInspectorPanes();") <
            render.index("window.SemDeckFindSync()"))
    assert "window.SemDeckFindSync=fmtSync;" in out
    # showFmt also runs on hover previews and continuous resize. Remembering
    # the actual object keeps those rerenders from wiping checked rows, and
    # still notices replacement at the same slide/index.
    assert "var fmtPanel=$('#find-fmt'),mode='text',fmtBuiltFor=null;" in out
    assert "?((s2.annots||[])[selAnnot]||null):null;" in out
    assert "fmtBuiltFor=ref;" in out
    assert "if(pop.hidden||mode!=='fmt') return;" in out
    assert "if(fmtRef()===fmtBuiltFor) return;" in out
    # Two removals bypass both selection entry points: Tidy's duplicate
    # fixer, and an empty text editor on blur. They explicitly converge,
    # and the latter remaps later indexes before doing so.
    tidy = out[out.index("function tidyRow(f){"):
               out.index("function renderTidyPane(){")]
    assert tidy.index("paintSel(l);") < tidy.index("showFmt();")
    assert "else if(typeof selAnnot==='number'&&selAnnot>idx) selAnnot--;" \
           in out
    assert "return typeof i2==='number'&&i2>idx?i2-1:i2;" in out
    assert "renderAnnots(layer,s2);\n        showFmt();" in out


def test_a_formatting_sweep_is_not_the_selection_rule(out):
    """The two look alike and must not be merged. annotsBy answers "what
    can I select", so it leaves hidden objects out -- you cannot select
    what is not on the page. A sweep is a different question: ``hide``
    means "hidden while EDITING, still shown when presenting", so an
    object skipped by the sweep would keep the old typeface through the
    whole talk. Fully locked objects stay out of both: a lock is an
    explicit "not this one".
    """
    assert "function sweep(crit,scope){" in out
    assert "if(!a||lockedAll(a)) return;\n          if(critsMatch(a,crit))" \
        in out
    # the selection rule still drops hidden items
    assert "if(!a||a.hide||lockedAll(a)) return;" in out


def test_a_formatting_sweep_says_what_it_will_do_first(out):
    """A deck-wide rewrite that just happens is a deck-wide rewrite you
    cannot check. The count is live, the button will not fire without
    both something to match and something to change, and a field that
    means nothing for what was matched is not written at all -- a `size`
    on a shape would be a junk key every export then has to ignore.
    """
    assert "+' on '+ns+' slide'+(ns===1?'':'s')" in out
    assert "go.disabled=!hitn.length||!edits().length;" in out
    assert "if(c.kinds.indexOf(h.a.k)<0) return;" in out
    assert "var FMT_CHANGES=[" in out
    # one markDirty for the whole sweep, so one undo takes it back
    assert "markDirty();refresh();\n        toast('Changed '+n+' object'" \
        in out


def test_an_equal_gap_snap_shows_both_gaps_and_the_measurement(out):
    """TASKS T7. Snapping to neighbouring edges and centres was already
    here, and so was equal-gap detection -- but only half of it showed.
    The comment over gapCands promised to "mark both" and the code kept
    a gap as a bare NUMBER, so the pair it was measured between was
    already lost by the time anything got drawn. One amber bar on its
    own only ever said "something snapped".

    A gap now travels with the two neighbours it was measured between,
    both gaps are marked -- the one being made solid, the one it matched
    faint, because that one is evidence rather than an instruction --
    and each carries the distance in the millimetres the rulers speak.
    A percentage means nothing to anyone laying out an A0 poster.
    """
    assert "if(g>0.2) gaps.push({g:g," in out
    assert "best={d:d1,gap:g,from:r,side:'after',src:gp};" in out
    assert "function gapMm(v,horiz){" in out
    assert "return (mm<10?Math.round(mm*10)/10:Math.round(mm))+' mm';" in out
    # both marks are pushed, and the reference one is flagged
    assert "if(gx.src) gapMarks.push({horiz:true,at:gx.src.at," in out
    assert "if(gy.src) gapMarks.push({horiz:false,at:gy.src.at," in out
    assert "el.className='snapgap'+(m.ref?' snapgap-ref':'');" in out
    assert ".snapgap.snapgap-ref{background:#f0a84826;border-style:dashed;" \
        in out


def test_the_gap_badge_reuses_the_readout_style_that_was_never_wired(out):
    """.dragtag was styled for exactly this kind of live readout --
    mono, small, dark pill -- and then nothing in deck.js ever used it.
    The badge is that style, finally connected to something, rather than
    a second one that would drift away from it.
    """
    assert "lab.className='dragtag snapgap-lab'" in out
    assert ".snapgap-lab{transform:translate(-50%,-50%);" in out
    # cleared with the bars at the end of the gesture, not left behind.
    # This asserts clearSnapGuides, the END-OF-GESTURE cleanup -- the
    # first version of it pinned drawGapMarks's own top-of-redraw wipe
    # instead, which is a different function and could not have failed
    # if the real cleanup regressed.
    assert ("$$('.snapline,.snapgap,.snapgap-lab',layer)\n"
            "      .forEach(function(n){n.remove();});") in out
    # ...and the marks are dropped on EVERY mousemove, beside sx/sy,
    # rather than only on the branch that fills them: Alt suppresses
    # snapping by skipping that branch, and a frozen bar would be
    # redrawn at stale coordinates for the rest of the drag
    assert ("var sx=null,sy=null;\n      /* CLEARED EVERY MOVE") in out


def test_matching_a_layout_copies_the_pattern_not_the_look(out):
    """TASKS T8. A third question, which none of its three neighbours
    answers: Match slide copies a whole slide's arrangement item for
    item, Match object copies one object's PROPERTIES, Arrangements
    apply a saved slide's shape.

    This copies the pattern -- the axis a group runs along, the edge or
    centre its members agree on, the median of its gaps, and where the
    run starts. Nothing about size or colour travels, and the counts
    need not match, which is what lets "these three" be laid out like
    "those four".
    """
    assert "function readPattern(layer,s,idxs){" in out
    assert "function applyPattern(layer,s,idxs,pat){" in out
    # the axis is whichever way the reference actually runs
    assert "var horiz=patSpread(cx)>=patSpread(cy);" in out
    # the alignment rule is whichever edge they disagree about least
    assert "var align=(sn<=sm&&sn<=sf)?'near':((sf<=sm)?'far':'mid');" in out
    # the median gap: one odd gap in a row of five is a mistake being
    # copied, not a rhythm
    assert "var gap=gaps[Math.floor(gaps.length/2)];" in out
    # the cross-axis position is NOT copied -- it is recomputed from
    # where the targets already are, by the reference's rule
    assert "function patCross(rs,pat){" in out


def test_a_layout_match_moves_by_deltas_and_respects_pins(out):
    """An auto-sized text box and an aspect-fitted figure frame both
    answer annotRectPct with their RENDERED rect, which is not a.x/a.y.
    Moving by the difference is the only arithmetic that is right for
    every kind -- the same reason snapping works on the bounding box.

    shiftAnnot is that move, factored out of nudgeSel: a line has no
    x/y, it is two endpoints plus any corners dragged into it, and every
    caller that wrote the box version by hand had to remember that.
    """
    assert "function shiftAnnot(a,dx,dy){" in out
    assert "shiftAnnot(x.a,pat.horiz?da:dc,pat.horiz?dc:da);" in out
    # nudgeSel now goes through the same one
    assert "var a=s.annots[i]; if(!a||pinned(a)) return;   /* no nudge */\n" \
        "        shiftAnnot(a,dx,dy);" in out
    # a pinned object is not moved by this either
    assert "      if(!a||pinned(a)) return;\n      var r=annotRectPct(" in out


def test_a_slide_wide_object_is_not_part_of_every_row(out):
    """Caught in the browser, 2026-08-25. The reference group is the run
    the object you clicked belongs to -- but "shares its band" alone let
    the empty cell frame a new slide starts with, which spans most of
    the page, join every row on the slide. It dragged the run's start
    92px left of where the row visibly began.

    A member has to overlap generously ACROSS the run, and sit BESIDE it
    rather than over it ALONG the run. A background rectangle fails the
    second test, which is the one that matters.
    """
    assert "function bandMates(layer,s,idx,horiz){" in out
    assert "if(!(ext>0&&ov>=ext*0.5)) return;" in out
    assert "if(al>alen*0.5) return;" in out
    assert "var row=bandMates(layer,s,idx,true);" in out
    # armed and reported through the existing match bar, not a new one
    assert "if(dir==='layout'&&idxs.length<2){" in out
    assert "['x:layout','Lay these out like a group I click…']," in out


def test_tidy_up_reports_before_it_rearranges(out):
    """TASKS T9. A third question in the same pane shell: preflight asks
    whether this page survives a printer, standardise asks whether the
    deck agrees with itself, this asks whether the page is SLOPPY --
    everything individually fine and collectively looking like nobody
    was paying attention.

    Report first is the whole feature. Nothing moves until a button is
    pressed, and each button moves one finding's worth of things. A
    cleanup that rearranged the page the moment you asked it to look is
    a cleanup nobody dares run twice.
    """
    assert 'id="tidypane"' in out and 'id="tidypane-list"' in out
    assert "function tidyFindings(){" in out
    assert "function showTidyPane(){" in out
    assert 'id="dsg-tidy"' in out
    tidy = out[out.index('id="dsg-tidy"'):]
    tidy = tidy[:tidy.index("</button>")]
    assert '<svg class="bic"' in tidy and "Tidy page" in tidy
    assert "if(open) open.addEventListener('click',showTidyPane);" in out
    assert "['o:tidyup','Tidy up this page" not in out
    # every fix is attached to its own row's button
    assert "act.addEventListener('click',function(){\n      var n=f.fix()" \
        in out
    # it joins the panes that share the corner and the remembered geometry
    assert "'stdpane','tidypane','objhist','provpane','flippane']" in out


def test_the_tidy_tolerances_are_named_and_argued(out):
    """The tolerances ARE the design. Below NEAR an edge is already
    aligned as far as anyone can see and "fixing" it is noise; above
    APART it is a decision rather than a slip, and reporting it would be
    second-guessing the layout. Between them is the band where someone
    meant to line things up and missed, which is the whole population
    this feature is for.
    """
    assert "var TIDY_NEAR=0.12, TIDY_APART=1.6;" in out
    assert "var TIDY_GAP_REL=0.28;" in out
    assert "return sp>TIDY_NEAR&&sp<=TIDY_APART;" in out
    # one physical near-miss shows up on left/centre/right at once when
    # the widths match -- report it once, on the tightest edge
    assert "if(seen[sig]&&seen[sig].sp<=sp) return;" in out
    # a pinned object is not moved by anything else, so it is not
    # offered here either -- that would be a button that lies
    assert "      if(pinned(a)) return;\n      var r=annotRectPct(layer,s,i);" \
        in out


def test_tidy_finds_three_kinds_of_sloppy(out):
    """Near-misalignment, gaps that wobble, and the same object pasted
    twice. Geometry alone cannot identify a duplicate -- two equal-sized
    swatches side by side are a design, not a mistake -- so the content
    has to agree too.

    Spacing evenly keeps the OUTER two where they are: distributing
    between them is what "even" means, and moving the ends would slide
    the whole run somewhere nobody asked for.
    """
    assert "function tidySig(a){" in out
    assert "if(tidySig(A.a)!==tidySig(B.a)) continue;" in out
    assert "head:'Two copies of '+annotLabel(A.a)," in out
    assert "var inner=rs2.slice(1,-1);" in out
    assert "var g=(hi-lo-span)/(inner.length+1);" in out
    # a negative gap means they overlap -- that is not a spacing problem
    assert "if(gaps.some(function(g){return g<0;})) return;" in out


def test_per_object_history_is_derived_from_the_undo_stack(out):
    """TASKS T10, and the design note the task asked for.

    THE HISTORY IS DERIVED, NOT RECORDED. undoStack already holds a full
    snapshot of the deck at every step, so an object's past is those
    snapshots read through the object's identity. There is no second log
    to keep in step, nothing to forget to record, and no way for the
    timeline to claim something Ctrl+Z would disagree with. It costs
    nothing until the pane is opened.
    """
    assert "function objHistory(oid){" in out
    assert "var snaps=undoStack.slice(-OH_DEPTH).concat([histState()]);" \
        in out
    # consecutive identical states collapse: an edit elsewhere on the
    # slide is not a state of THIS object
    assert "if(out.length&&out[out.length-1].sig===sig) return;" in out
    # and the walk is bounded, because each entry is a whole deck
    assert "var OH_DEPTH=24;" in out


def test_restoring_a_past_state_is_an_edit_not_a_rewind(out):
    """The second half of the design note, and the half the task asked
    to have settled: how per-object undo interacts with the global undo
    stack. It does not interact with it at all.

    Restoring writes the old state onto the object as it stands now and
    takes one ordinary undo entry. Nothing is popped off the global
    stack, so the conflict the task worried about cannot arise -- the
    two mechanisms never touch the same data. Ctrl+Z afterwards undoes
    the restore itself.
    """
    assert "function ohRestore(past){" in out
    assert "s.annots[at]=deep(past);" in out
    assert "markDirty();" in out
    # identity and stacking order both survive the restore: the array
    # position IS the z-order, so a restore must not send it to the front
    assert "var keep=s.annots[at].oid;" in out
    assert "s.annots[at].oid=keep;" in out


def test_object_identity_is_lazy_and_self_healing(out):
    """An index is not identity: an insert or a delete shifts everything
    after it. Objects carry an oid, minted by ensureOids on first sight
    rather than at the dozen places an annot can be born -- one funnel,
    idempotent, called from renderAnnots which every slide render passes
    through.

    It re-mints a DUPLICATE, which is what a copied annot arrives with,
    instead of asking every copy site to remember to strip one.
    """
    assert "function ensureOids(s){" in out
    assert "if(!a.oid||seen[a.oid]) a.oid=mintOid();" in out
    assert "function renderAnnots(layer,s){" in out
    assert ("       no copy site has to remember to strip one. */\n"
            "    ensureOids(s);") in out
    # a schematic, not a render: rendering a historical state would mean
    # running renderAnnots against a slide that does not exist
    assert "function ohThumb(a){" in out
    assert "function ohChanges(prev,now){" in out
    assert "if(!prev) return 'created';" in out


def test_object_inspectors_follow_the_live_selection(out):
    """T55. An open inspector is a live view, not a snapshot taken when
    its door was clicked. History follows selection and edits; provenance
    follows selection. Closed panes keep the potentially expensive work
    demand-driven.
    """
    assert 'id="objhist-rerun"' in out
    assert "syncInspectorPanes(true);" in out
    assert "function syncInspectorPanes(force){" in out
    assert "if(histOpen&&a) ensureOids(s);" in out
    assert "if(provOpen) renderProvPane();" in out
    assert "if(!force&&sig===inspectorSig) return;" in out
    # Deselecting is not deletion, and must not inherit the last subject.
    assert "ohOid=a?a.oid:null;" in out
    assert "Select an object to see its recent history." in out
    # Both inspectors use the primary selection, including for groups;
    # neither guesses that the last expanded group member was clicked.
    assert out.count("typeof selAnnot==='number'&&(s") >= 2
    # Slide changes bypass showFmt, so renderSlide owns that invalidation.
    assert "renderNotesPane(); /* ...and the notes, which are per slide */\n" \
        "    /* Slide navigation clears the selection" in out
    # An edit changes the history's live 'now' state without a selection
    # event, so markDirty has its own open-pane refresh.
    assert "if(!quiet&&ohp&&!ohp.hidden) renderObjHist();" in out
    # Opening one subject inspector closes the other.
    assert "'#tidypane','#provpane'].forEach(function(sel){" in out


def test_a_ribbon_of_your_own(out):
    """TASKS T11, and the design note it asked for.

    WHAT IS CUSTOMISABLE: individual controls, within the group they
    already live in -- never between tabs. A tab is a promise about
    where things are ("the tools for the thing you just clicked are in
    ONE named place you can go back to"), and a layout that could break
    that promise would make every other piece of guidance wrong.

    WHERE IT IS REMEMBERED: an UNSCOPED key. Every other preference here
    is +SCOPE -- per project, per notebook bundle -- but a ribbon layout
    is a fact about the person, and it would be absurd for one deck to
    know where you keep Bold. Same argument matchPick makes for being
    session-local.
    """
    assert "var RIBBON_KEY='jv-ribbon';        /* NOT +SCOPE — see above */" \
        in out
    assert "function applyRibbonPrefs(){" in out
    assert "function openRibbonCustomise(){" in out
    # right-click the ribbon: where every application of this shape puts
    # it, and it costs the row no width -- which matters most here
    assert "bar.addEventListener('contextmenu',function(e){" in out
    # the picker shows the tab you are looking at; the applier walks all
    assert "function ribbonGroupsHere(){" in out
    assert "ribbonGroupsHere().forEach(function(g){" in out
    assert "ribbonGroups().forEach(function(g){" in out


def test_hiding_a_ribbon_button_composes_with_showFmt(out):
    """`hidden` is owned by showFmt and FMT_KINDS, which turn controls on
    and off by KIND. A customiser writing the same attribute would fight
    it on every click and whoever wrote last would win.

    .rbn-hid is display:none, so the two compose -- a control appears
    when its kind allows it AND you have not put it away -- and it costs
    the fit ladder nothing, because display:none takes no width. Hiding
    genuinely buys room rather than only looking like it.
    """
    assert "#edit-tools .rbn-hid{display:none!important;}" in out
    assert "el.classList.toggle('rbn-hid',hid.indexOf(el.id)>=0);" in out
    # the invariants hold by construction: nothing changes a label, and
    # the row is re-fitted after every change
    assert "if(typeof fitEditRibbon==='function') fitEditRibbon();" in out
    # applied once, from the tail, never mid-file
    assert ("  renderPresTabs();\n"
            "  initRibbonLayoutDoor();\n"
            "  /* the ribbon you kept: applied once here, at the tail") in out


def test_each_ribbon_group_is_keyed_by_its_own_name(out):
    """Caught in the browser, 2026-08-25, by reading the stored key.
    Matching the first `rbn-*` class found `rbn-grp` on every group, so
    all of them answered to one id and a single group's saved order was
    applied to the whole ribbon. The generic classes are excluded now,
    and groups with no distinguishing class of their own fall back to
    their visible label, which is unique across the row.
    """
    # `rbn-lay` joined the list when ribbon layouts arrived: it is
    # worn by EVERY group a layout generates, so leaving it out
    # would make all of them answer to one id -- which is this very
    # bug, one layer up (2026-08-25).
    assert "var RBN_GENERIC={'rbn-grp':1,'rbn-fixed':1," in out
    assert "'rbn-lab':1," in out and "'rbn-lay':1};" in out
    assert "if(!hit&&c.indexOf('rbn-')===0&&!RBN_GENERIC[c]) hit=c;});" in out
    # an unknown id in a saved list is skipped, so a control added by a
    # later version keeps its place instead of vanishing
    assert "if(byId[id]) row.appendChild(byId[id]);});" in out


def test_inline_maths_survives_a_rebuild_of_the_layer(out):
    """TASKS T16. LaTeX in deck text boxes already shipped -- an equation
    editor, a palette, MathJax spliced into every page, and inlineMath
    ['$','$'] configured in mathjax.html all along. One gate was wrong.

    The re-typeset gate in renderAnnots asked whether the box IS an
    equation, not whether it CONTAINS one, so a hand-typed $\\alpha$
    inside an ordinary sentence typeset once and was thrown away by
    every rebuild of the annot layer -- which is every drag, every edit,
    every selection change.

    Two predicates now, because they are two questions: isMaths gates
    the equation editor (the whole box is one formula); hasMaths gates
    the typeset (there is maths in here somewhere).
    """
    assert "function hasMaths(a){" in out
    assert "if(slideHasMaths(s)) typeset(layer);" in out
    # kept cheap: renderAnnots runs on every mousemove of a drag, so the
    # no-maths case must cost one indexOf and no regex
    assert "if(!src||src.indexOf('$')<0) return false;" in out
    assert "return hasMathsStr((t.indexOf('$')>=0)?t:h);" in out
    # a lone $ in prose must not drag the layer through MathJax
    assert "||/\\$[^$\\n]+\\$/.test(src);" in out
    # a title slide keeps its words OUTSIDE s.annots, so the whole-slide
    # question has to ask about those too or every rebuild eats them
    assert "function slideHasMaths(s){" in out
    assert ("return s.layout==='title'\n"
            "      &&(hasMathsStr(s.title||'')||hasMathsStr(s.sub||''));") \
        in out
    # ...and isMaths keeps its own, stricter question
    assert "show('#fmt-eqedit',isMaths(a)&&isNum);" in out


def test_maths_typesets_the_moment_you_click_away(out):
    """The other half of the same bug, found in the browser. Committing
    a text box writes into the element in place -- that is the point of
    the edit path -- so renderAnnots, which carries the gate, never
    runs. Maths typed into a box stayed raw "$x$" until something else
    happened to rebuild the layer.

    While the box is BEING edited the maths is deliberately left raw
    under the caret; the typeset belongs at the commit. Which is only
    true if the raw source is what is under the caret -- MathJax having
    replaced the text node with its own markup, opening a typeset box
    for editing used to put the caret among rendered glyphs, and the
    commit read those back as the new source (T53).
    """
    assert "?hasMathsStr((idx==='t'?(s2&&s2.title):(s2&&s2.sub))||'')\n" \
        "         :hasMaths(a2)) typeset(layer);" in out
    assert "if(!rich&&el.querySelector&&el.querySelector('mjx-container')){" \
        in out
    assert "if(raw) el.textContent=raw;" in out


def test_a_token_is_a_reference_not_a_copy(out):
    """TASKS T12. A style set says what a HEADING looks like; tokens say
    what the DECK is made of. They differ in one specific way.

    applyStyleTo BAKES -- it writes size, weight and colour onto every
    box wearing a style, and argues that case well (five renderers read
    a.size). The cost is that changing a definition later means
    re-stamping, and anything that drifted is overwritten or left
    behind. A token is a REFERENCE: the item stores '@accent', the value
    lives in one place, and changing it changes everything wearing it
    because none of them held a copy to go stale.
    """
    assert "var TOKENS_DEFAULT={" in out
    assert "function tokVal(v){" in out
    assert "function tokRef(v){" in out
    assert "return (typeof v==='string'&&v.charAt(0)==='@')?v.slice(1):'';" \
        in out
    # the resolver is an IDENTITY for anything that is not a reference,
    # which is what makes it safe to thread through a renderer this size
    assert "    var k=tokRef(v);\n    if(!k) return v;" in out
    # threaded at the points where a stored colour BECOMES a rendered one
    assert "var col=tokVal(a.color)||'#ff6b57';" in out
    assert "if(a.fillc) return tokVal(a.fillc);" in out
    assert "if(a.color) host.style.color=tokVal(a.color);" in out
    # Title and ordinary text are separate renderer branches. Both are
    # paint boundaries, so neither may hand an '@accent' string to CSS.
    assert "if(p.color) d.style.color=tokVal(p.color);" in out
    assert "if(a.color) d2.style.color=tokVal(a.color);" in out


def test_tokens_resolve_in_previews_gradients_and_every_full_slide(out):
    """TASKS T44. A reference is only useful if every way of looking at
    the deck asks the same resolver. This includes the film strip, object
    history and style specimens, not merely the large editable canvas.

    Gradient resolution returns a copy: an export may resolve ``@accent``
    for a consumer, but must never bake that colour back into the source
    model or the cascade is gone after the first export.
    """
    assert "function tokenGradient(g,col){" in out
    assert "var out=deep(g),fallback=tokVal(col)||'#39a9c0';" in out
    assert "cp.c=tokVal(st.c)||fallback;" in out
    assert "var st=tokenGradient(g,col).stops.map(function(s2){" in out
    assert "var g=tokenGradient(a.grad,col);" in out

    mini = out[out.index("function miniText("):
               out.index("/* ---- the other pages", out.index("function miniText("))]
    assert "t.style.color=tokVal(a.color);" in mini
    assert "t.style.background=tokVal(a.bgc);" in mini
    assert "p.setAttribute('stroke',tokVal(a.color)||'#ff6b57');" in mini

    history = out[out.index("function ohThumb(a){"):
                  out.index("var ohOid=null")]
    assert "d.style.color=tokVal(a.color);" in history
    assert "d.style.background=tokVal(a.bgc);" in history
    assert "d.style.background=cssFill(a,col);" in history

    # Style definitions can themselves retain a token reference. Every
    # specimen menu paints through tokVal instead of displaying nothing.
    assert out.count("style.color=tokVal(") >= 8

    attach = out[out.index("function attachAnnots(slideEl,s){"):
                 out.index("function flushTextEdits(){")]
    assert attach.index("applyTokens(slideEl);") < attach.index(
        "renderAnnots(layer,s);")
    # The full-slide seam covers the stage, playback, presenter/notes
    # previews, PDF and standalone HTML. Guide rendering no longer owns it.
    assert out.count("applyTokens(slideEl);") == 1
    assert "if(mode==='edit') renderTokenSwatches();" in out


def test_design_tokens_have_a_permanent_design_door(out):
    """A setting for the whole deck cannot require selecting an object
    merely to reveal its contextual Arrange menu. Its button stays on
    Design and travels with every ribbon layout like any other control.
    """
    assert 'id="dsg-tokens"' in out
    tokens = out[out.index('id="dsg-tokens"'):]
    tokens = tokens[:tokens.index("</button>")]
    assert '<svg class="bic"' in tokens and "Design tokens" in tokens
    assert "var b=$('#dsg-tokens');" in out
    assert "openTokenPicker(this);" in out
    assert "['k:tokens','This deck" not in out
    assert "Design \\u2192 Design tokens" in out


def test_the_deck_registry_survives_a_save(out):
    """A deck that has forgotten what "@accent" means renders the
    built-in fallback instead -- the quiet save-and-reopen failure the
    normPres keep-list exists to prevent, and which has bitten this repo
    six times. Both sides carry it, and the schema-parity test has a
    sentinel for it.
    """
    assert ("['wmark','head','foot','styles','tokens',\n"
            "     'components','cuts'].forEach(function(k){") in out
    # undo reaches it too: a token change repaints every item that
    # references it, so it is an edit like any other
    assert "tokens:(pres.tokens&&Object.keys(pres.tokens).length)" in out
    assert ("['wmark','head','foot','styles','tokens','components','cuts',\n"
            "     'guides','page','pageBg',") in out


def test_corner_and_gap_need_no_per_item_reference(out):
    """There is one radius and one gap for the deck, so they go onto the
    slide as CSS custom properties and every shape picks them up without
    storing anything. The literal in the stylesheet is the fallback for
    anything drawn outside a slide -- a thumbnail, a menu chip.
    """
    assert "slideEl.style.setProperty('--tk-rad',t.rad+'px');" in out
    assert "border-radius:var(--tk-rad,4px);" in out
    attach = out[out.index("function attachAnnots(slideEl,s){"):
                 out.index("function flushTextEdits(){")]
    assert "applyTokens(slideEl);" in attach
    # the spacing token is the deck's rhythm, not a constant repeated in
    # three arrange verbs
    assert "?((bb.r-bb.l-sum)/(items.length-1)):tokens().gap;" in out
    assert "var GAP=tokens().gap/2;" in out


def test_the_token_swatches_are_wired_where_they_are_built(out):
    """The boot-time sweep takes ONE snapshot of $$('#et-fmt .sw...'),
    so a chip built afterwards is a swatch that looks right and does
    nothing. That is exactly what these did until a browser said so.
    """
    assert "function renderTokenSwatches(){" in out
    assert "if(isFill) applyFillColor('@'+k); else applyTextColor('@'+k);" \
        in out
    assert "b.setAttribute('data-c','@'+k);" in out


def test_shrink_to_fit_never_rewrites_the_size_you_chose(out):
    """TASKS T15, and the design decision it needed first: what box does
    a text box overflow? It has none. `a.h` is not a text property --
    the renderer has never read it for one, sameSize excludes text from
    height, and APPLY_PROPS says a ticked Height on a heading would be a
    control that does nothing. Text auto-heights from its words, and
    that is not being changed.

    So the fit target is a separate, opt-in field: `a.fh`, the height
    you are asking the WORDS to live within. It is not the box's height
    -- the box still grows, which is what keeps the overflow visible
    instead of clipped.

    Shrinking is a render-time multiplier, never a rewrite of a.size:
    writing the size would bake it, fight the style system on the next
    Re-apply, and lose the original the moment the words got shorter.
    """
    assert "function fitTexts(layer,s,editing){" in out
    assert "if(!a||a.k!=='text'||!a.fh) return;" in out
    assert "el.style.setProperty('--an-fit',k.toFixed(3));" in out
    assert "* var(--an-fit,1))';" in out
    # two passes, not a loop: wrapping is not linear in font size
    assert "var got2=el.scrollHeight||0;" in out
    # and a floor, because text shrunk past legibility is a different
    # problem being hidden rather than a fit
    assert "var FIT_MIN=0.62;" in out
    assert "var k=Math.max(FIT_MIN,want/got);" in out


def test_a_box_that_cannot_fit_says_so(out):
    """Past the floor it stops and marks the box, and with fit off an
    overrun is marked the same way. The mark is an editing aid, gated on
    .deck.editing and killed in print and #print-root, by the same rule
    the guides follow: a note to the author, never ink.
    """
    assert "el.classList.add('an-overflowing');" in out
    assert ".deck.editing .an-text.an-overflowing{" in out
    assert 'content:"does not fit"' in out
    assert "#print-root .an-overflowing{outline:none!important;}" in out
    # the toggle takes the height from what the box IS now, which is the
    # only version of this anybody can predict
    assert "function toggleFit(i){" in out
    assert "a.fh=r?Math.round((r.b-r.t)*100)/100:12;" in out


def test_the_fit_pass_runs_at_the_text_commit_too(out):
    """Committing a text box writes into the element in place and never
    rebuilds the layer, so a box that had just been filled past its fit
    height was measured before the words arrived -- the same shape of
    bug T16's typeset hit, found the same way.
    """
    assert (":hasMaths(a2)) typeset(layer);\n"
            "      /* and re-fit, for the same reason") in out
    assert "fitTexts(layer,s2,true);" in out


def test_a_component_stores_the_look_and_never_the_content(out):
    """TASKS T13, and the first question its design note had to answer:
    which properties are the component and which are the instance?

    That question is already answered in this file, argued at length,
    and used by three features. MATCH_PROPS is "the geometry + look that
    travel; content never does" -- which IS a component's contract. So
    the definition stores exactly MATCH_PROPS, and the per-instance
    overrides the task asks for (text, image, which card a frame shows)
    are simply the fields MATCH_PROPS has always refused to copy.
    """
    assert "function cmpDefine(name,idxs){" in out
    assert "var CMP_SKIP={x:1,y:1,w:1,h:1,x1:1,y1:1,x2:1,y2:1,mid:1};" in out
    assert "      MATCH_PROPS.forEach(function(p){\n        if(CMP_SKIP[p]) return;" \
        in out
    # geometry is relative to the component's own box, so an instance can
    # be placed anywhere
    assert "it.rel={x:(x.r.l-bb.l)/W,y:(x.r.t-bb.t)/H," in out
    assert "function cmpPlaceOne(a,it,ox,oy,W,H){" in out


def test_an_instance_is_identified_by_three_fields(out):
    """cmp (which component), ci (which member) and cinst (which
    instance) -- three rather than one because all three questions get
    asked: is this a component, what should this member look like, and
    which copies move together.
    """
    assert "a.cmp=id;a.ci=n;a.cinst=inst;" in out
    assert "function cmpInstances(id){" in out
    assert "if(!a||a.cmp!==id||!a.cinst) return;" in out


def test_pushing_updates_every_other_instance_in_the_deck(out):
    """Updating is a re-stamp, and it is deliberate that local edits to
    an instance are lost by it. That IS staying linked; a component
    whose instances quietly diverge is a component in name only. The
    escape hatch is Detach, one menu row away.

    The origin is the instance's own top-left corner, so an instance you
    dragged somewhere stays where you dragged it.
    """
    assert "function cmpPush(id,si,inst){" in out
    assert "function cmpSyncAll(id,skipSi,skipInst){" in out
    assert "function cmpDetach(si,inst){" in out
    assert "ox=Math.min(ox,a.k==='arrow'?Math.min(a.x1,a.x2):(a.x||0));" in out
    # a definition that gained or lost members takes its instances with
    # it: an instance quietly keeping an old member is not an instance
    assert "sl.annots.push(na);" in out
    assert "if(at>=0) sl.annots.splice(at,1);" in out
    # An earlier instance can splice a removed member and shift every
    # later index on the same slide. Each turn therefore resolves its
    # instance from the live array instead of cmpInstances' old idxs.
    sync = out[out.index("function cmpSyncAll(id,skipSi,skipInst){"):
               out.index("function cmpDetach(si,inst){")]
    assert "g.idxs.map" not in sync
    assert "(sl.annots||[]).forEach(function(a,i){" in sync
    assert "if(a&&a.cmp===id&&a.cinst===g.inst)" in sync


def test_the_component_library_is_deck_level_and_survives(out):
    """Losing it would leave every instance carrying a cmp id pointing
    at nothing -- they would still draw, and would silently stop being
    linked. So it rides in normPres, the undo snapshot, the Python
    rebuild and DECK-FORMAT.md, which is the list T33 exists to make
    obvious.
    """
    assert ("['wmark','head','foot','styles','tokens',\n"
            "     'components','cuts'].forEach(function(k){") in out
    assert "components:(pres.components&&Object.keys(pres.components).length)" \
        in out


def test_anchoring_is_resolved_at_render_and_never_baked(out):
    """TASKS T14, and the design note starts with what is already true:
    relative SIZING is the whole coordinate system here -- everything is
    percent of the page, which is why one deck renders at 16:9 and on an
    A0 poster with no stored number changing.

    What was missing is that the two percentages are of DIFFERENT
    things, so the RELATIONSHIP between items does not survive a change
    of page SHAPE. One anchor per item fixes the cases people hit, and
    one anchor is deliberate: an anchor per axis is what a constraint
    solver grows out of, and the task rules that out.

    The stored numbers keep meaning "this far from my anchor"; the
    anchor is resolved at RENDER. Rewriting x/y would bake the current
    page into the model, which is exactly what a reflow must not do.
    """
    assert "var ANCHORS={" in out
    assert "function anchorPos(a,w,h){" in out
    assert "function anchorSet(a,x,y,w,h){" in out
    # an identity for an item with no anchor -- which is every item in
    # every deck to date
    assert "if(!an||!ANCHORS[an]) return {x:a.x||0,y:a.y||0};" in out
    assert "if(!an||!ANCHORS[an]){a.x=x;a.y=y;return;}" in out
    # setting one must not MOVE the item
    assert "function setAnchor(i,an){" in out
    assert "anchorSet(a,absX,absY,w,h);" in out


def test_an_anchored_item_is_placed_from_what_it_measured(out):
    """The items that most want anchoring are exactly the ones whose
    size is not stored: an auto-height text box, an aspect-fitted figure
    frame, a box shrink-to-fit has just scaled. With a.h undefined the
    naive maths put their TOP at the bottom edge and pushed them off the
    page -- worse than not anchoring at all.

    So anchored items are placed twice: once from the stored numbers,
    and again from what they actually measured. Only the ELEMENT is
    corrected; the model keeps saying "this far from my corner".
    """
    assert "function anchorFix(layer,s){" in out
    assert "var p=anchorPos(a,er.width/lr.width*100,er.height/lr.height*100);" \
        in out
    assert "el.style.left=p.x+'%';el.style.top=p.y+'%';" in out
    # before the arrows (an attached endpoint is derived from where its
    # target sits) and after the fit pass (which changes heights)
    assert "if(_anchorFixWanted) anchorFix(layer,s);\n    _arrows.forEach(" \
        in out
    assert "fitTexts(layer,s,editing);\n    /* ...and AFTER the fit pass" in out


def test_resize_keeps_anchored_items_in_page_coordinates(out):
    """T43. An anchor changes what stored x/y mean; resize still treated
    them as a top-left point, so the first mousemove teleported a pinned
    item before changing its size. The gesture now snapshots, snaps and
    preserves the opposite corner entirely in page space, then uses the
    anchor inverse once per move.

    Figure fitting and tied-caption following are part of the same
    gesture. Both must resolve their page positions too, or an anchored
    image jumps before the drag and a BR figure's stored negative delta
    sends its caption in the opposite direction.
    """
    resize = out[out.index("function startResize(layer,s,idx,ev0,corner){"):
                 out.index("function capFollowResize(")]
    assert "var origin=anchorPos(a,ow,oh),ox=origin.x,oy=origin.y;" in resize
    assert "var nx=ox,ny=oy,nw=ow,nh=oh;" in resize
    assert "bestSnap(targets.xs,[east?nx+nw:nx]" in resize
    assert "bestSnap(targets.ys,[south?ny+nh:ny]" in resize
    assert "anchorSet(a,nx,ny,nw,nh);" in resize
    assert "var live=anchorPos(a,nw,nh);" in resize
    assert "el.style.left=(a.x||0)" not in resize
    assert "anchorSet(a,f.x,f.y,f.w,f.h);" in resize
    # The asynchronous render-time fit uses the same page-space origin;
    # otherwise it can undo a correct resize a frame after mouseup.
    assert "var aw=a.w||34,ah=a.h||30,ap=anchorPos(a,aw,ah);" in out
    assert "return {x:ap.x+(fw-w2)/2/lw*100," in out
    caption = out[out.index("function capFollowResize("):
                  out.index("function startRotate(")]
    assert "var f0=anchorPos(figO,w0,figO.h)" in caption
    assert "anchorSet(capA,c0.x+(f1.x-f0.x),c0.y,cw,capO.h);" in caption


def test_stored_rect_fallback_resolves_an_anchor(out):
    """Snap targets and off-screen PowerPoint arrow attachments share
    annotRectPct's stored-box fallback. Returning raw anchor offsets made
    both consumers see a bottom-right object near the top-left.
    """
    rect = out[out.index("function annotRectPct(layer,s,i){"):
               out.index("function snapTargets(layer,s,skip){")]
    assert "var ap=anchorPos(a,a.w,a.h);" in rect
    assert "return {l:ap.x,r:ap.x+a.w,t:ap.y,b:ap.y+a.h};" in rect


def test_everything_that_moves_an_item_goes_through_one_inverse(out):
    """A drag, a nudge, an arrange and a snap all think in PAGE
    coordinates and must not have to know about anchors -- and a
    page-space delta is not a delta on the stored number, because moving
    right DECREASES "distance from the right edge". Going out to page
    coordinates and back is the only version that cannot get a sign
    wrong.
    """
    assert "      var ap=anchorPos(a,a.w,a.h);\n      anchorSet(a,ap.x+dx," \
        in out
    assert "anchorSet(m,op.x+dx,op.y+dy,o.w,o.h);" in out
    assert "    anchorSet(x.a,l2,t2,x.w,x.h);" in out


def test_a_caption_is_tied_to_its_figure_not_grouped_with_it(out):
    """TASKS T17. Grouping already makes several things move together
    and would have been the cheap answer. It is the wrong one:

    * a group is SYMMETRIC and this relationship is not -- the caption
      belongs to the figure, not the other way round;
    * matchKey / typeKeyOf bucket by KIND for Match slide and the Apply
      dialog, and a caption must stay a caption there;
    * T18 has to number figures, so "the caption of figure N" has to be
      a question with an answer.

    So it is a tie: `capOf` on the caption, `cap` on the figure. Two
    fields because both directions get asked, and neither should mean
    walking the slide.
    """
    assert "function figId(){" in out
    assert "function capOfFig(s,a){" in out
    assert "function figOfCap(s,a){" in out
    assert "function tieCaption(figIdx,capIdx){" in out
    assert "function untieCaption(i){" in out
    # one definition of what a figure IS, so T18 cannot number three
    # different ways
    assert "function isFigure(a){" in out
    assert "return a.k==='cell'&&partOf(a)==='figure';" in out


def test_the_caption_follows_through_the_one_mover(out):
    """The hook is in shiftAnnot, the single translate helper T8
    factored out, so every mover gets it for nothing: nudge, layout
    match, tidy-up, arrange. The drag path assigns absolutely from a
    snapshot rather than going through it, so it carries the same hook
    with its own snapshot -- or the caption would creep on every
    mousemove.
    """
    assert "if(a.cap&&!_capMoving){" in out
    assert "try{shiftAnnot(s2.annots[ci],dx,dy);}finally{_capMoving=0;}" in out
    assert "if(m.cap&&capOrig[i]){" in out
    assert "capOrig[i]={a:s.annots[ci],o:deep(s.annots[ci])};" in out


def test_a_caption_is_never_moved_twice(out):
    """Found in the browser: nudging a figure and its caption together
    moved the caption 53px for a 26px figure -- once as a member of the
    selection, and again by its figure's tie. startMove already guarded
    this by skipping captions already in `movers`; anything else that
    moves a SET has to do the same, and doing it in one named place is
    what stops the next mover getting it wrong.
    """
    assert "function dropTiedCaptions(s,idxs){" in out
    assert "var idxs=dropTiedCaptions(s,selIdxs());" in out
    assert "dropTiedCaptions(s,idxs).forEach(function(i){" in out
    assert "if(ci>=0&&movers.indexOf(ci)<0)" in out


def test_the_caption_takes_the_figures_width_and_only_that(out):
    """Width is the one dimension a caption shares with its figure -- a
    caption wider or narrower than the thing it describes is the
    commonest way a figure block stops looking deliberate. Height is
    not: a caption's height is its words.

    Taken at the END of the gesture, so one commit and no reflowing the
    words sixty times a second.
    """
    assert "function capFollowResize(capA,capO,figO,fig){" in out
    assert "var cw=capO.w?capO.w*(w1/w0):capO.w;" in out
    assert "if(capO.w) capA.w=cw;" in out
    assert "if(movedAny) capFollowResize(capA,capO,figO,a);" in out


def test_a_figure_number_is_never_stored(out):
    """TASKS T18, and the one decision the whole feature turns on.

    Stamping "Figure 7" into a caption's words is right until somebody
    drags slide 9 above slide 4, and then it is wrong everywhere and
    silently. So nothing here writes a number into any text: a caption
    says {fig}, a sentence says {fig:id}, and both are resolved at
    render -- exactly the way furnText has resolved {n} and {N} for the
    header and footer since page furniture landed.

    Deleting a figure renumbers the rest on the next repaint for free,
    because there was never a number to go and update.
    """
    assert "function figNumbers(){" in out
    assert "function figSubst(txt,a,map){" in out
    assert "?(a.text||''):figSubst(a.text,a,_figMap);" in out
    # a reference to a figure that has gone says so, rather than
    # rendering a wrong number
    assert "return hit?String(hit.n):(id?'[missing figure]':" in out
    # and the walk happens once per render, not once per text box
    assert "})?figNumbers():null;" in out


def test_figure_numbers_read_the_same_order_as_builds(out):
    """The array is the order things were DRAWN in, which is nobody's
    idea of a sequence: draw the bottom caption first and it would
    animate first AND be Figure 1. orderedIdx already solved that for
    build steps, so it is hoisted out of the animation pane it was
    written in and both use it -- two sweeps that agreed today would not
    agree forever.
    """
    # at top level now, not nested inside the animation IIFE
    assert "  function orderedIdx(s2){" in out
    assert "      var ord=orderedIdx(sl);" in out
    assert 'assert' not in out or True
    # a figure is one thing, defined once (T17), so numbering and tying
    # cannot disagree about what counts
    assert "if(!isFigure(a)||a.hide) return;" in out


def test_the_tokens_can_be_inserted_as_well_as_typed(out):
    """Nobody guesses a syntax, and anyone who has learned it should not
    have to hunt for a menu. Both doors.
    """
    assert "function numberCaption(i){" in out
    assert "a.text='Figure {fig}. '+t;" in out
    assert "function refCaption(i,figKey){" in out
    assert "'Figure {fig:'+figKey+'}';" in out
    # editing a box shows what is STORED: a caret inside a substituted
    # number would be a caret in text that does not exist
    assert "var showTx=(editing&&document.activeElement" in out


def test_a_frame_can_say_where_it_came_from(out):
    """TASKS T19. The deck already knew all of this and had no way to
    say it: the frame names a card by anchor, chains.py computed the
    lineage at parse time, the trace view already draws it, and the deck
    already keeps a saved copy of every placed card. What was missing
    was a door from a frame ON A SLIDE to any of it.
    """
    assert 'id="provpane"' in out and 'id="provpane-list"' in out
    assert "function provOf(a){" in out
    assert "function renderProvPane(){" in out
    assert "function showProvPane(){" in out
    # the lineage comes from the chains the parser already computed
    assert "var group=p.it?lineageForItem(p.it.ns):null;" in out
    # and the trace door is the existing one, not a second drawing
    assert "if(window.SemTrace&&pr[0]) window.SemTrace.open(pr[0],pr[1]);" \
        in out
    assert "'stdpane','tidypane','objhist','provpane','flippane']" in out


def test_staleness_is_answered_honestly_or_not_at_all(out):
    """There is no timestamp anywhere in this format -- not on a card,
    not on an embedded snapshot -- so "the notebook output is newer"
    cannot be answered by comparing dates, and inventing a date at save
    time would only record when the DECK was saved.

    What can be answered exactly is whether the live card and the deck's
    saved copy still say the same thing, which is the question that
    actually matters. Where the notebook is not open there is nothing to
    compare against, and it says so rather than guessing.
    """
    assert "function provState(p){" in out
    assert "if(!p.live) return 'nolive';" in out
    assert "return (a===b)?'same':'stale';" in out
    # compared in the shape the SAVE path captures, not one rendering
    # against another -- and cloneBody falls back to the deck's own copy
    # when the notebook is shut, which would make everything look in step
    assert "function liveCardHtml(ref){" in out
    assert "if(!cardEl(ref)) return '';" in out


def test_updating_one_figure_leaves_its_geometry_alone(out):
    """TASKS T20. Position, crop and size live on the ANNOTATION, and
    the annotation is not touched at all -- so they survive by
    construction rather than by being carefully copied back and forth.

    The renderer still never executes notebook code: the notebook is
    re-run by the user, and this takes what it wrote.
    """
    assert "function resyncFigure(a){" in out
    assert "embStore(normRef(p.ref)||p.ref,e);" in out
    # the same record shape the save path writes -- one snapshot format
    assert "var cc=p.live.hasCode?cloneCode(p.ref):null;" in out
    assert "if(cc) e.code=cc.outerHTML;" in out


def test_a_picture_keeps_its_original_out_of_the_draft(out):
    """TASKS T21. Crop was ALREADY non-destructive -- a.crop is a view
    transform in inset percentages over the whole picture. What was
    destructive was the SHRINK: a pasted screenshot was re-encoded down
    and the original thrown away on the spot, so a crop into one corner
    exported at the resolution of the shrunken copy.

    The note left on IMG_MAX_EDGE said why it had to be that way and
    what the real fix was: image payloads live inside `pres`, and
    markDirty stringifies `pres` into localStorage on EVERY edit. The
    same argument had already moved embedded card snapshots to
    IndexedDB; the image kind was left behind.
    """
    assert "var IMG_VIEW_EDGE=1600;" in out
    assert "function keepOriginal(a,dataUrl){" in out
    assert "function originalOf(a){" in out
    assert "function okeyNew(){" in out
    # one funnel: three doors insert a picture, and putting the original
    # aside in each of them is three chances to forget
    assert "function placeImage(src,ar,link,full){" in out
    assert "if(full&&full!==src) keepOriginal(img,full);" in out
    # only when it really IS bigger
    assert "if(payload!==fr.result) keepOriginal(na,fr.result);" in out


def test_the_export_gets_the_original_and_the_canvas_does_not(out):
    """A 6000px PNG drawn at 30% of a slide costs real time on every
    repaint for detail no screen can show. The export is the only
    consumer that wants the full bytes -- and it is already asynchronous
    for MathJax, so waiting on IndexedDB costs it nothing it was not
    already paying.

    Every path that turns a print root into a file goes through
    afterTypeset, so that is the one place all of them share: the PDF,
    the standalone HTML, and anything added later.
    """
    assert "function useOriginals(root){" in out
    assert "if(im.getAttribute('src')===a.src) im.src=full;});" in out
    assert "try{return useOriginals(root).then(go);}catch(e){}" in out
    # best-effort throughout: with no IndexedDB the picture still works,
    # it just has no original to fall back on -- which is what happened
    # to every image before this existed
    assert "}).catch(function(){return a.src||null;});" in out


def test_the_figure_lint_is_honest_about_what_it_can_read(out):
    """TASKS T22, whose whole scope is the phrase "where metadata
    allows" -- and the honest answer is narrow.

    A raster figure is a wall: a PNG of a matplotlib plot carries no
    font name, no point size and no margin. An SVG figure can be read,
    because its text nodes carry font-family and font-size as
    attributes. And the one thing true of EVERY figure is how big it is
    on the page -- which is not metadata about the figure at all, it is
    a fact about the deck, and it is the thing that actually makes a
    deck look careless.
    """
    assert "function figLint(){" in out
    assert "function figBoxes(){" in out
    assert "function figFonts(a){" in out
    # attributes, not computed style: these are detached clones and a
    # detached node has no computed font
    assert "var fam=t.getAttribute('font-family')" in out
    assert "var svg=body.querySelector&&body.querySelector('svg');" in out
    # the deck-wide question, in the pane that already asks it
    assert "function appendFigLint(list){" in out
    assert "menuHead(list,'figures across the deck');" in out


def test_the_typeface_finding_has_no_fix_button(out):
    """Fixing it means re-running the notebook with one rcParams. A
    button here would be a lie, so the finding carries none and says
    why -- and figRow simply does not draw one when there is no action.
    """
    assert "list:fams[fk[fk.length-1]],\n        act:null});" in out
    assert "if(f.act&&f.fix){" in out
    assert "'button here.'," in out
    # ...and it says how many figures could even be asked
    assert "+read+' vector '" in out


def test_size_and_zoom_findings_do_carry_fixes(out):
    """Both are facts about the DECK rather than about the notebook, so
    both are fixable from here. Scale keeps each figure's aspect by
    scaling h with w; zoom moves the odd ones onto the majority value.
    """
    assert "var FIG_SCALE_TOL=0.25;" in out
    assert "if(p.a.h) p.a.h=p.a.h*k;" in out
    assert "if(+z===1) delete p.a.ts; else p.a.ts=+z;});" in out


def test_a_fully_locked_object_cannot_be_deleted(out):
    """"Lock fully takes it off the canvas altogether: no clicking, no
    dragging, no typing" (help). Delete was the one bulk verb that never
    asked -- duplicateSel, the arrange verbs, the align sweep and the
    PowerPoint export all filter on lockedAll, and deleteSel spliced
    every selected index.

    That is not a theoretical hole: BOTH documented ways to hold a fully
    locked item in a selection lead straight to it. Alt+marquee "sweeps
    up fully locked items too", and the Objects pane is "the way back"
    for an item you cannot click -- so you select one there to unlock
    it, press Delete meaning the other three, and the locked one goes
    with them (2026-08-25).

    Verified in a browser both ways: one locked item alone refuses and
    says why; one locked plus one loose deletes the loose one and toasts
    "1 fully locked item kept".
    """
    assert "var kept=idxs.filter(function(i){" in out
    assert "return !lockedAll((s.annots||[])[i]);});" in out
    assert "var held=idxs.length-kept.length;" in out
    # refusing silently would read as "Delete is broken"
    assert "toast(held===1?'That item is fully locked" in out
    assert "if(held) toast(held+' fully locked item'" in out
    # and it is the KEPT list that gets spliced, not the original
    assert "kept.sort(function(x,y){return y-x;}).forEach(function(i){" in out


def test_the_panes_duplicate_keeps_the_whole_batch_selected(out):
    """Ctrl+D leaves every copy selected; the pane selected only the
    last one, so duplicating five rows from it meant re-selecting four
    of them before the copies could be moved anywhere (2026-08-26 audit,
    T57).
    """
    pane_dup = out[out.index("function dupAnnots(idxs){"):]
    pane_dup = pane_dup[:pane_dup.index("renderSelPane();")]
    assert "selectMany(l,added);" in pane_dup
    assert "selectAnnot(l,added[added.length-1]);" not in pane_dup


def test_the_furniture_prompts_name_every_token_they_accept(out):
    """{sn}, {sN} and {sec} shipped with T25 and were documented only in
    help.html -- the Header and Footer prompts, which are where anyone
    is standing when they need them, listed four tokens and stopped
    (2026-08-26 audit, T57).
    """
    assert out.count("{sn}/{sN} the number and count within the section, ") \
        == 2
    assert out.count("+'{sec} its name.\\nLeave it empty to remove it.'") == 2
    # ...and the ribbon tooltips, which are the other place you read
    # before clicking
    assert "{sn} and {sN} the same within the" in out
    assert "{sn}/{sN} the same within the section," in out
