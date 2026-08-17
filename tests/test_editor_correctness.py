"""Bugs that reached the user, and the structure that let them through.

Every test here corresponds to something reported from the running app on
2026-08-07, after several rounds of the same class of defect getting past
review. The common thread is that the editor decided things by hand at each
site -- one show() call per control, one floatMenu() call per menu -- so
forgetting one was silent and permanent. Where a test pins a table or a
check rather than a symptom, that is the point.
"""

from __future__ import annotations


def test_every_contextual_control_is_governed(out):
    """showFmt used ~150 hand-written show() calls with nothing tying a
    control to the kinds it applies to. Four dropdowns were added to the
    markup and none got a line, so Ends and Route -- arrow properties --
    appeared on a triangle, permanently and silently.
    """
    assert "var FMT_KINDS={" in out and "var FMT_MANUAL=" in out
    # arrow-only things really are arrow-only
    assert "'#fmt-headwrap':'arrow'," in out
    assert "'#fmt-bendwrap':'arrow'," in out
    # shape-only things really are shape-only
    assert "'#fmt-fillwrap':'rect'," in out
    assert "'#fmt-shape':'rect'," in out
    # and the table actually drives visibility
    assert "Object.keys(FMT_KINDS).forEach(function(id){" in out
    # a control governed by neither table now says so, loudly
    assert "governed by nothing in " in out


def test_a_poster_is_not_offered_animation(out):
    """Animation is a BUILD: an item appearing on click as you step through
    a deck. A poster is one printed page -- there is no click and nothing
    to step through.
    """
    assert "show('#fmt-animwrap',isNum&&!pageOf().poster);" in out


def test_lines_and_arrows_are_drawn_in_page_coordinates(out):
    """Converting arrows from <line> to <path> (to support curves) kept the
    coordinates as percentages. <line> accepts x1="20%"; path data has no
    units, so "M20 50" meant 20px,50px and every line and arrow collapsed
    into a stub in the top-left corner.
    """
    assert "function arrowPath(e,a,W,H){" in out
    assert "var x1=e.x1/100*W,y1=e.y1/100*H,x2=e.x2/100*W,y2=e.y2/100*H;" in out
    # the curve offset is a percentage too, so it scales the same way
    assert "var bow=cv/100*Math.min(W,H);" in out
    # and the caller passes the layer's real size
    assert "var d=arrowPath(ends,a,lrA.width,lrA.height);" in out


def test_dropdowns_are_not_clipped_by_the_ribbon(out):
    """overflow:hidden on the ribbon (added to kill a sideways scrollbar)
    also clipped every menu that opens downward -- the Shape menu looked
    like it was rendering behind the canvas. Clipping sideways only fixes
    every menu at once, including ones added later; the alternative was
    remembering floatMenu() at nine separate call sites.
    """
    import re

    assert "overflow-x:clip;overflow-y:visible;}" in out
    ribbon = out.split(".edit-tools.ribbon{")[1].split("}")[0]
    # strip the comment that *explains* the old overflow:hidden before
    # asserting the declaration itself is gone
    ribbon = re.sub(r"/\*.*?\*/", "", ribbon, flags=re.S)
    assert "overflow:hidden" not in ribbon


def test_an_editor_opens_on_a_blank_page(out):
    """"No slides yet. Use Create to build some." was not just an unhelpful
    greeting: with no slide, EVERY layout button silently did nothing,
    because its handler bails when there is nothing to apply a layout to.
    One cause, two symptoms (2026-08-07, user: "the layouts aren't
    selectable").
    """
    assert "if(!s&&mode==='edit'){" in out
    assert "pres.slides.push(emptySlide());" in out
    # and clicking a layout with no page makes one rather than no-opping
    assert "if(!pres.slides||!pres.slides.length){" in out


def test_blank_is_the_first_layout_for_both_families(out):
    """Blank carries no poster flag, so the family filter dropped it from
    posters entirely -- there was no way to ask for an empty page. It is
    also the most basic choice there is, so it leads.
    """
    assert "return !!l.poster===isPoster&&l.id!=='blank';" in out
    assert "if(blank) list=[blank].concat(list);" in out


def test_menus_are_clamped_onto_the_screen(out):
    """The 442px Layouts catalogue never called floatMenu, so opened from a
    toolbar standing on the right-hand edge it ran straight off the
    screen. floatMenu itself only clamped horizontally.
    """
    assert "if(willOpen) floatMenu(lb,lm);" in out
    assert "var mh=menu.offsetHeight||0;" in out
    assert "if(mh&&top+mh>window.innerHeight-8)" in out


def test_swap_to_notebooks_goes_to_the_notebooks(out):
    """It ran setUIMode('create'), landing you in the presentation BUILDER
    -- slide layouts, slide strip and all -- which is not what the label
    said and is meaningless for a poster.
    """
    assert "if(mode==='edit') closeDeck();" in out
    assert "if(mode==='edit') setUIMode('create');" not in out


def test_a_deck_keeps_its_strip_and_a_poster_does_not(out):
    """A poster can have more than one page -- a second draft, a variant
    for another venue. Worth having; not worth a permanent strip down the
    side of a page that big.

    In 2026-08-07 that was read as applying to a DECK too ("presentation
    mode still has the slides as a prominent feature") and the strip went
    behind a button for both. Half right: a deck IS a sequence and you
    steer it by seeing the sequence, so its strip is there by default
    again (2026-08-17, user: "in the presentation maker, the thumbnail for
    the slides should be there by default. It is just the poster where it
    should be optional").

    One button, two mechanisms, because the defaults are opposite: a
    deck's strip is docked and on, so Slides toggles a class and the list
    never leaves the panel; a poster's versions are rare enough to be
    worth no permanent width, so they stay in the floating pane.

    Measured: deck opens with 7 thumbnails docked and the button pressed;
    toggling it off takes the page from 973px to 1173px; a poster opens
    with the panel gone and Versions opening the pane instead.
    """
    assert 'id="vw-versions"' in out
    # the panel goes for a poster, and only for a poster...
    assert ".deck.editing.poster-page .deck-create{display:none!important;}" in out
    assert ".deck.editing .deck-create{display:none!important;}" not in out
    # ...or when you put it away yourself
    assert ".deck.editing.strip-off .deck-create{display:none!important;}" in out
    # what is left of the panel while editing is ONLY the strip: the head
    # has moved into the ribbon and would otherwise draw an empty bar
    assert ".deck.editing .dc-head,.deck.editing .dc-controls{display:none;}" in out
    # the button toggles the docked strip for a deck, the pane for a poster
    assert "if(pageOf().poster){showVerpane(!!$('#verpane').hidden);return;}" in out
    assert "deckEl.classList.toggle('strip-off');" in out
    # ...and it reports whichever of the two this page kind uses, written
    # once, because two of these drifting apart is a toggle that lies
    assert "function syncStripBtn(){" in out
    # one #film-list node, two homes: becoming a deck takes it back, or the
    # panel that just appeared would show an empty strip
    assert "if(!pg.poster&&mode==='edit'){showVerpane(false);filmToPanel();}" in out
    assert "add.textContent=pg.poster?'+ Create new version':'+ Add slide';" in out
    # never poster-only, and the word matches the page you are on
    assert "if(vb) vb.hidden=!pg.poster;" not in out
    assert "vb.innerHTML=pg.poster?'&#9776; Versions':'&#9776; Slides';" in out
    # File and Save ride the top bar for BOTH kinds while editing
    assert "if(!pageOf().poster) return;" not in out


def test_versions_open_in_the_same_shell_as_objects(out):
    """Objects and Versions are both lists you open to look at the page
    from outside it, so they should look and behave alike (2026-08-10,
    user: "the bar for this should appear like the objects bar"). They
    share the .selpane shell, the same corner and the same close button.

    The strip is MOVED into the pane rather than rebuilt there, so
    reordering, drag-and-drop, delete and the thumbnails keep working with
    no second copy of any of it -- the same borrow-and-restore the File
    controls already use.
    """
    assert 'class="selpane verpane" id="verpane"' in out
    assert 'id="verpane-close"' in out and 'id="verpane-title"' in out
    assert "function filmToPane(){" in out and "function filmToPanel(){" in out
    assert "body.appendChild(list);" in out
    # only one of the three panes can own that corner at a time
    assert "var sp=$('#selpane'); if(sp) sp.hidden=true;" in out
    assert "var pf=$('#preflight'); if(pf) pf.hidden=true;" in out
    # and the strip goes home when the editor does, or the builder renders
    # into a list that is no longer inside it
    assert "showVerpane(false);filmToPanel();" in out
    # a version's name is user-typed, so it wraps rather than clipping --
    # unlike an Objects row, whose label is derived from the page
    assert "#verpane .film-t{overflow:visible;text-overflow:clip;" in out


def test_a_new_version_is_a_copy_and_names_itself(out):
    """"There should be a button 'create new version' and create a new
    version with autolabelling" (2026-08-10). A version is a VARIANT, so
    it starts as a copy of what you are looking at, and it is named for
    you, because a pile of near-identical unnamed A0 sheets is unusable.

    Only posters get labels. Stamping "Slide 3" across a deck would
    replace the strip's content-derived titles -- which are the whole
    reason the strip is readable -- with numbering.
    """
    assert "function newVersion(){" in out
    assert "function nextVersionName(){" in out
    assert "return 'Version '+(n+1);" in out
    # the page you were on is named too, so the two read as a pair
    assert "if(src&&!src.label) src.label=nextVersionName();" in out
    # a deck still names its slides by what is on them
    assert "if(!pageOf().poster){" in out
    assert "if(s.label) return s.label;" in out
    # an autoname is a starting point: Rename is a button, because the
    # row's own click re-renders the strip and would detach a dblclick
    # target before the second click landed
    assert "'Rename this version'" in out
    # the name has to survive BOTH whitelists or it silently reverts
    assert "if(typeof s.label==='string'&&s.label) o.label=s.label;" in out


def test_a_poster_goes_to_the_printer_one_version_at_a_time(out):
    """Making versions easy to accumulate means an export loop over every
    slide would quietly turn one A0 into three sheets at the print shop.
    A poster is one page -- the codebase already asserts that by hiding
    the slide counter -- so one version goes out, and the toast says
    which. A deck's slides ARE the deck, so they all go.
    """
    assert "function outputSlides(){" in out
    assert "if(!pageOf().poster||all.length<2) return all;" in out
    assert "outputSlides().forEach(function(ent,i){" in out
    assert "slides:outputSlides().map(function(ent){" in out
    # never a silent choice
    assert "function outputNote(){" in out
    assert "a poster '\n      +'goes out one version at a time" in out


def test_print_decisions_survive_being_saved(out):
    """Both whitelists rebuild from a fixed key list, so any field they do
    not name is dropped. Crop marks never survived a reload at all, and
    slide numbers and the page background never survived a project save --
    each of them a print decision the editor lets you make and then
    quietly forgot (2026-08-10).
    """
    assert "if(p.cropMarks) out.cropMarks=1;" in out


def test_the_grid_has_lines_in_both_directions(out):
    """"Margin & grid" worked out a row pitch and then drew nothing with
    it, so the overlay was vertical stripes: you could line things up
    across the page and had nothing to line them up against down it
    (2026-08-07, user: "the grid is broken"). Measured after the fix on a
    16:9 page: 6 shaded columns, 11 vertical rules, 5 horizontal rules
    and the margin box, all inside the page's own border.
    """
    assert "class=\"pgrid-rule\"" in out
    assert "class=\"pgrid-vrule\"" in out
    assert ".pgrid-rule{position:absolute;height:0;" in out
    assert ".pgrid-vrule{position:absolute;width:0;" in out
    # the row pitch it already computed is what the rows are drawn at, so
    # the cells come out square
    assert "for(i=1;i<g.rows;i++){" in out
    assert "+(g.m.y+i*g.rowH)" in out
    # rules go BETWEEN cells: the margin box already draws the outer edge
    assert "for(i=1;i<GRID_COLS;i++){" in out


def test_placing_something_returns_you_to_select(out):
    """Line, QR and Image are not data-tool buttons, so they never touched
    the armed tool. They place an item and hand it to you selected, which
    means the canvas is in select mode as far as you can tell -- but arm
    Arrow, click Line, and the next click on the page dragged out an arrow
    (2026-08-07 audit). The shape, text and cell paths always did this.
    """
    assert out.count("setTool('select');") >= 6


def test_controls_that_cannot_act_say_so(out):
    """selRects drops arrows (no box to resize), locked and hidden items,
    so "Same size" was offered for two selected arrows and then silently
    did nothing. Arrange shares a menu with single-item actions, so it
    stays reachable and explains itself instead.
    """
    assert "show('#fmt-samewrap',selRects().length>=2);" in out
    assert "function needTwo(items,what){" in out
    assert "if(needTwo(items,'line up')) return;" in out
    assert "Select at least three items to space them out evenly" in out


def test_the_hint_does_not_call_a_poster_a_slide(out):
    """Five instructions said "click on the slide" to someone editing a
    printed A0 sheet -- the same leak the Page/Slide label and the
    Versions button already fixed elsewhere (2026-08-07 audit).
    """
    assert "var pw=pageOf().poster?'the page':'the slide';" in out
    assert "'Click on '+pw+' to place a text box'" in out
    assert "Click on the slide to place a text box" not in out


def test_no_control_truncates_its_own_label(out):
    """Hiding a word behind an ellipsis is the same sin as hiding the
    button (2026-08-07, standing instruction). The save-destination button
    is a bare chevron now, so it had nothing left to clip anyway.
    """
    assert "max-width:230px;overflow:hidden;\n  text-overflow:ellipsis" not in out
    target = out.split(".dbtn.dc-target{")[1].split("}")[0]
    assert "text-overflow" not in target


def test_line_weight_scales_with_the_page_like_text_does(out):
    """Every dimension on a page is page-relative -- x/y/w/h are
    percentages, text is a percentage of page height resolved at render
    time. Line weight was the one exception: a.sw went straight out as CSS
    pixels, so it was the only thing that did not move when the page did.

    Measured before: zooming 3.74x grew the text 3.75x and the stroke
    1.00x, so a line fell from 12.7% of the text height to 3.4%
    (2026-08-10, user: "as you zoom in and out the line stays the same
    thick on the screen whilst the presentation gets smaller"). Measured
    after, across a 7.3x range of page sizes -- 393px, 768px, 2872px --
    the text-to-line ratio is 7.4 at every one of them.
    """
    assert "var SW_REF_H=720;" in out
    assert "var SW_DEFAULT=3;" in out
    assert "function strokePx(a,layer){" in out
    # every site that draws ink resolves through it
    assert "ln.setAttribute('stroke-width',swPx);" in out
    assert "r.style.borderWidth=strokePx(a,layer)+'px';" in out
    assert "drawShapeSvg(shp,col,strokePx(a,layer),a,i,layer)" in out
    assert "(a.sw||3)+'px'" not in out
    # a dash is measured in the same units as the stroke it dashes, so it
    # scales too -- 9px gaps on a stroke shrunk to 0.5px read as dots
    assert "function dashPx(a,layer){" in out
    assert "var dsh=dashPx(a,layer);" in out
    # the arrowhead clamp keeps reading the STORED weight: markerUnits
    # defaults to strokeWidth, so the head already scales for free, and
    # clamping on pixels would make the head/line ratio vary with zoom
    assert "hs.mul*Math.max(0.55,Math.min(2.2,sw/3))" in out
    # the default is named, so the three creation sites cannot drift from
    # it. Comma-anchored: swOf's own ternary ends `?a.sw:SW_DEFAULT` and
    # would otherwise be counted as a fourth.
    assert out.count(",sw:SW_DEFAULT") == 3
    assert "sw:3" not in out


def test_chrome_does_not_scale_but_never_loses_the_ink(out):
    """The invisible path you grab an arrow by is UI, not artwork, so its
    16px stays screen-measured -- scaled with the page it would leave a
    2px target on a zoomed-out poster. But the ink can now be wider than
    16px on a big page, so the target takes whichever is larger.
    Measured: 16px at fit and at 0.5x, 22px once the ink reached 11.95px.
    """
    assert "hit.setAttribute('stroke-width',Math.max(16,swPx+10));" in out


def test_the_weight_control_says_what_it_will_print(out):
    """A number that means "pixels on a 720px-tall page" cannot be laid
    against a ruler, so the millimetres go in the tooltip -- and in
    preflight, which is the only part of the app that speaks in real
    millimetres. NOT in the label: a label whose width changed with the
    selected item would make the ribbon's required width depend on what
    you clicked, and the fit ladder has no rung left to absorb that.
    """
    assert "function swMm(a,pg){" in out
    assert "'mm on this page. Click to cycle thinner and thicker.'" in out
    assert "Line may not print ('+mmw.toFixed(2)+'mm)" in out


def test_powerpoint_export_survives_a_line_on_the_page(out):
    """`arrowEnds(layer,s,a,0)` sat inside pptxItems, which has no `layer`
    parameter and no `layer` in scope. Reading an undeclared identifier
    throws, so exporting ANY deck or poster containing a single line or
    arrow produced no file -- and because the throw escaped before the
    toast, no message either. Confirmed in a browser before the fix:
    "Uncaught ReferenceError: layer is not defined", no download, no
    toast. Confirmed after: a .pptx is produced (2026-08-10).
    """
    assert "function pptxItems(s,note,ink,layer){" in out
    assert "var lay=(ent.i===cur)?stage.querySelector('.annot-layer'):null;" in out
    assert "pptxItems(ent.s,note,ink,lay)" in out
    # ...and the layer is genuinely optional, since only the slide on
    # screen has one
    assert "var el=layer?layer.querySelector(" in out


def test_exported_line_weight_is_a_real_physical_size(out):
    """pptx.js multiplies by 12700 EMU, which is one POINT, and deck.js
    was handing it canvas PIXELS -- so every exported line came out 1.33x
    too fat, and a rect and a line disagreed on the default (2 vs 3) into
    the bargain. Weight now crosses the seam as a percentage of page
    height, the same currency runProps already uses for text size.
    """
    assert "function lineWidthEmu(item, page, fallbackPct) {" in out
    assert "pct / 100 * page.hPt * 12700" in out
    assert "(item.sw || 2) * 12700" not in out
    assert "(item.sw || 3) * 12700" not in out
    assert "swPct:swOf(a)/SW_REF_H*100" in out


def test_the_document_actions_are_in_the_ribbon_not_a_bar_above_it(out):
    """Back sat alone at the far right of a bar of its own, divorced from
    File and Save -- so beside an armed drawing tool it read as the way
    out of THAT (2026-08-10). Moving it in with them fixed the grouping
    but left the real problem: that bar is a second row of chrome sitting
    on top of the editing tools, and a second row of chrome is a second
    row taken off the page ("I hate having the file, save, saved, button
    above the customisation buttons... I think I have said this before").

    So while editing there is no bar at all. File, Save, undo/redo and the
    save readout are the ribbon's first group. Presenting still has a bar,
    because there is no ribbon then.

    Leaving does NOT ride along. It did from 2026-08-10 to 2026-08-17, and
    it was the widest control in the ribbon -- a group's worth of width for
    a journey the presentations rail's Notebooks button already offers, on
    screen the whole time you are editing (user: "that is not needed,
    people just click on the back to notebooks"). It stays in the top bar,
    which presenting shows and editing hides, because presenting is full
    screen with no rail: there the way out has to be visible or it does not
    exist.

    Measured after: File went from 286px wide to 147px, and clicking the
    rail's Notebooks button while editing leaves cleanly (deck hidden,
    `editing` and `body.slide-editing` both off).
    """
    assert 'id="rbn-file-row"' in out
    assert 'class="rbn-grp rbn-file"' in out
    assert "var top=$('#rbn-file-row');" in out
    # leaving is NOT moved into the ribbon any more...
    assert "fileMoved.push({el:xb,parent:xb.parentNode,next:xb.nextSibling});" \
        not in out
    # ...but the button itself survives, for presenting
    assert 'id="deck-exit"' in out
    assert "$('#deck-exit').addEventListener('click',function(){" in out
    # the bar is gone while editing, present while presenting
    assert "if(dt) dt.hidden=(mode==='edit');" in out
    # it says where it goes, and the word changes with the mode
    assert "Close the editor</button>" in out
    assert "'&#8617; Stop presenting'" in out
    assert "&#8617; Back</button>" not in out
    # the panel's 30px buttons must not burst the ribbon's 26px grid rows
    assert ".rbn-file .dbtn{padding:3px 8px;font-size:10.5px;height:26px;" in out
    # the group's label is the fixed word "File", never the document name:
    # a label sizes its group, so a long name would make the ribbon's
    # width depend on what you called the file
    assert '<span class="rbn-lab">File</span>' in out


def test_the_toolbar_hint_says_nothing_in_the_resting_state(out):
    """"Click an item to select; drag to move; Del removes" sat in the
    middle of the toolbar permanently, captioning the obvious (2026-08-10,
    user: "what is that even there?").

    A hint earns its place by describing a mode you have just entered and
    cannot otherwise see -- an armed drawing tool looks identical to no
    tool at all apart from the cursor. Describing the DEFAULT state is
    just clutter, so select mode says nothing.
    """
    assert "Click an item to select; drag to move; Del removes" not in out
    # the armed-tool hints stay: they are the ones doing work
    assert "'Drag on '+pw+' to draw a line'" in out
    assert "'Click on '+pw+' to place a text box'" in out


def test_an_armed_tool_has_a_visible_way_out(out):
    """Escape has always de-armed a tool (deck.js), but nothing said so,
    and an armed tool looks identical to no tool at all except for the
    cursor -- so picking Line or Shape and changing your mind left you
    stuck (2026-08-10, user: "there is no way to get out of the line
    create option if you don't want to create a line").

    Cancel sits with the tools, NOT in #et-hint: the hint is the first
    thing fitEditRibbon drops when the ribbon is tight, and the way out
    must never be droppable. It is hidden while nothing is armed, so it
    costs no width in the resting state.
    """
    assert 'id="et-cancel"' in out
    assert "if(cx) cx.hidden=(t==='select');" in out
    assert "cxBtn.addEventListener('click',function(){setTool('select');});" in out
    # pressing an armed tool again is the second way out, and the one most
    # people try first
    assert "setTool(tool===b.dataset.tool?'select':b.dataset.tool);" in out
    # it is worded, like every other control
    assert "Cancel</button>" in out


def test_view_and_output_are_separate_groups(out):
    """Guides and Objects change what YOU see while working; Print check
    and Present are about the finished thing, on paper or on a screen.
    One group called "View" described only half of them (2026-08-07,
    user: "present and print check go together, but objects and guides
    are different"). Both groups sort last -- right in the horizontal
    bar, bottom in the side one, because "last" means the same in a
    column.
    """
    assert 'class="rbn-grp rbn-view"' in out
    assert 'class="rbn-grp rbn-standby rbn-out"' in out
    assert ">Output</span>" in out
    assert ".rbn-out{order:91;}" in out
    # Guides+Objects in one, Print check+Present in the other
    view = out.split('class="rbn-grp rbn-view"')[1].split(">View</span>")[0]
    assert 'id="vw-menuwrap"' in view and 'id="objects-btn"' in view
    assert 'id="vw-check"' not in view and 'id="dc-play"' not in view


def test_zoom_is_a_view_control_and_the_page_strip_is_a_page_control(out):
    """Zoom sat under Slide, next to the control that sets the real page
    size, and the two read as the same kind of thing; the strip listing the
    other pages sat under View, which is not what it is (2026-08-17, user:
    "the view and slide is very confused. I feel like the zoom is view,
    and the 'Slides' is slide?").

    The test that separates them: zoom changes how big the page LOOKS and
    nothing about the document or what prints, which is exactly what Guides
    and Objects do and exactly what Page size does not. The strip is the
    SET this page belongs to, which is the same subject as Layouts and Page
    size.
    """
    slide = out.split('class="rbn-grp rbn-slide"')[1].split(">Slide</span>")[0]
    view = out.split('class="rbn-grp rbn-view"')[1].split(">View</span>")[0]
    assert 'id="vw-versions"' in slide and 'id="vw-versions"' not in view
    assert 'id="zoom-val"' in view and 'id="zoom-val"' not in slide
    # View can no longer stand down for a selection: you zoom constantly
    # with something selected, and an object list is at its most useful
    # when there IS an object selected
    assert 'class="rbn-grp rbn-standby rbn-view"' not in out
    # the readout renames itself, so it is held to the longest label it can
    # hold -- in characters, so it survives every density rung
    assert "#zoom-val{min-width:calc(9ch + 18px);justify-content:center;}" in out


def test_side_toolbar_headings_sit_above_their_section(out):
    """A section heading belongs above its section in a vertical list --
    that is how every sidebar reads. Below stays right for the horizontal
    ribbon, where it sits under the group as PowerPoint's does.
    """
    assert ".deck.rbn-side .rbn-lab{order:-1;" in out
    # ...and the order is not reset in side mode, so View/Output fall last
    assert ".deck.rbn-side .rbn-view{border-left:none;}" in out
    assert ".deck.rbn-side .rbn-view{order:0" not in out


def test_rulers_follow_the_slide_when_the_stage_moves(out):
    """Rulers are drawn at the slide's CURRENT position, so anything that
    moves the slide must redraw them. The ribbon's observer cannot see the
    docked panel opening, closing or being dragged wider -- and that is
    exactly the slide case, where the panel appears after the rulers are
    first placed and strands them to the left of the page they measure.
    Watching the stage catches all of it. Measured after the fix: 0px
    misalignment before and after a stage resize.
    """
    assert "}).observe(stage);" in out
    assert "if(!deckEl.hidden) syncGuides();" in out


def test_a_shape_can_be_given_a_fill_colour(out):
    """The outline always worked; the fill could not be set by anything in
    the app. Three independent faults stacked: the fill swatches were
    gated to text, so hidden for a shape; the swatch handler had no shape
    branch and wrote a.bg/a.bgc, which no shape renderer reads; and "Solid
    colour…" just copied the outline. A green triangle with a red outline
    was not constructible. Verified after the fix: fill=#39a9c0 with
    stroke=#ff6b57 on the same triangle.
    """
    assert "var showBg=plainText||noteCell||kind==='rect';" in out
    # the handler writes the fields drawShapeSvg/cssFill actually read
    assert "else if(a.k==='rect'){" in out
    assert "else {a.fill=1;a.fillc=sw.dataset.c;}" in out
    # the custom "+" chip too
    assert "else if(a.k==='rect'){a.fill=1;a.fillc=str;delete a.grad;}" in out
    # and the picker prefills from the shape's own fill
    assert "if(a.k==='rect') return (a.grad&&a.grad.a)" in out
    # two Fill buttons would otherwise both read "Fill"
    assert "fcb.textContent=(kind==='rect')?'Fill colour ▾':'Fill ▾';" in out


def test_the_opacity_slider_makes_one_undo_entry(out):
    """A range fires one `input` per step, so a single drag pushed ~100
    undo entries and flushed every real edit out of the 50-slot history.
    fmtApply's `quiet` flag exists for exactly this; the crop steppers
    already used it and this control never did.
    """
    assert "if(pct>=100) delete a.op; else a.op=pct/100;},true);" in out
    assert "opRangeEl.addEventListener('change'" in out


def test_the_side_toolbar_actually_stands_up(out):
    """The horizontal ribbon is a fixed-height row of two-row grids. None
    of that survives being stood on its end, so side mode must undo each
    piece -- the height, the row grid, the clipping and View's pinned
    right margin. It undid none of them, so the toggle did nothing.
    """
    side = out.split(".deck.rbn-side .edit-tools.ribbon{")[1].split("}")[0]
    assert "height:auto" in side
    assert "overflow-y:auto" in side
    assert ".deck.rbn-side .rbn-row{display:flex;flex-flow:row wrap;" in out
    # the vertical group divider goes, but NOT the order: View and Output
    # still sort last, which is the bottom of a column
    assert ".deck.rbn-side .rbn-view{border-left:none;}" in out
    # File-over-Save is a two-row stack only where there are two rows
    assert ".deck.rbn-side .rbn-stack{flex-direction:row;}" in out
    # and it says what it does
    assert "Toolbar on the right" in out
    assert "Toolbar down the side" not in out


def test_the_side_rail_packs_two_up_rather_than_one_per_line(out):
    """Stood on its end the rail put ONE control on every line, so Insert
    was seven rows deep and the toolbar read as the list of rows the
    horizontal ribbon had just stopped being (2026-08-16, user: "I hate
    how everything is just in rows it makes it so uncompact ... poster
    layout should be the same as well").

    flex-wrap pairs them with nothing measured: a control keeps its natural
    width, two share a line when both fit, a long one takes the line to
    itself. flex-shrink stays 0 -- squeezing a button is truncating a word,
    which no rung of this toolbar has ever been allowed to do.

    Measured on an A0 portrait at 1400x900: 21 lines before, 12 after
    (File 6->2, Page 3, Insert 7->4, View 3->2, Output 2->1).
    """
    assert ".deck.rbn-side .rbn-row{display:flex;flex-flow:row wrap;" in out
    assert ".deck.rbn-side .rbn-row>*{flex:1 0 auto;}" in out
    # a cell stays whole wherever it lands -- but must NOT claim a whole
    # line, which is what pushed undo/redo onto one of their own
    assert ".deck.rbn-side .rbn-cell{height:auto;}" in out
    assert "flex:1 0 100%" not in out
    # one width for the rail, so the stage, rulers, arrow and Objects pane
    # cannot drift apart
    assert ".deck.rbn-side{--rbn-side-w:226px;}" in out
    assert ".deck.rbn-side .rulers{right:var(--rbn-side-w);}" in out


def test_undo_and_redo_are_one_cell(out):
    """They are the same decision in two directions, so they travel as one
    -- the rule the zoom stepper already states ("whose minus and plus must
    never end up on different rows"). In the side rail's wrapping flow they
    did exactly that: undo closed a line and redo opened the next one,
    alone and stretched the full width of the rail (2026-08-16).

    The wrapper moves between the panel head and the ribbon with the
    buttons, so it has to answer to both heights.
    """
    row = out.split('<span class="rbn-cell">')
    assert any('id="dc-undo"' in part and 'id="dc-redo"' in part
               for part in row[1:]), "undo and redo are not in one cell"
    assert ".dc-head .rbn-cell{height:30px;gap:6px;}" in out


def test_an_empty_save_readout_draws_nothing(out):
    """`.deck-status:empty{display:none}` is stated up top and then lost to
    `.rbn-file .deck-status`, which sets display again at higher
    specificity -- the same author-display-beats-[hidden] trap app.css
    warns about. The result was an empty pill sitting in the middle of the
    File group whenever there was nothing to report (2026-08-16).

    It is hidden rather than removed in the horizontal grid because it
    still has to hold its cell: drop it and undo/redo shuffle into the wide
    first column. The rail re-flows anyway, so there it goes entirely.
    """
    assert ".rbn-file .deck-status:empty{visibility:hidden;}" in out
    assert ".deck.rbn-side .rbn-file .deck-status:empty{display:none;}" in out


def test_ribbon_group_columns_are_counted_before_every_fit(out):
    """--rbn-cols is a count of what is showing RIGHT NOW, so it goes stale
    the moment anything reveals a control without re-running it -- and
    something did. applyPage() un-hides #vw-versions ("Slides" / "Versions")
    after syncRibbonGroups has counted, so View was sized for two controls,
    the third landed in an implicit third grid row, and the row printed
    over its own VIEW label (2026-08-16).

    Owning the count in one function that fitEditRibbon calls first makes
    it self-healing, and means the density rungs are judged against the row
    that is actually on screen. Measured after: View cols=2, row bottom
    65px, label top 83px -- no overlap, at 1400 and 1100px.
    """
    assert "function sizeRibbonGroups(){" in out
    # syncRibbonGroups delegates rather than keeping its own copy
    assert "sizeRibbonGroups();\n    /* groups appearing or leaving" in out
    # ...and the fit re-counts BEFORE it measures anything
    fit = out.split("function fitEditRibbon(){")[1].split("function syncViewBtns")[0]
    assert fit.index("sizeRibbonGroups();") < fit.index("bar.scrollWidth")
