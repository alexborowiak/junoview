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
    assert "'#fmt-shapewrap':'rect'," in out
    # and the table actually drives visibility
    assert "Object.keys(FMT_KINDS).forEach(function(id){" in out
    # a control governed by neither table now says so, loudly
    assert "governed by nothing in " in out


def test_a_poster_is_not_offered_animation(out):
    """Animation is a BUILD: an item appearing on click as you step through
    a deck. A poster is one printed page -- there is no click and nothing
    to step through.
    """
    assert "if(vaB) vaB.hidden=!!pg.poster;" in out


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
    ribbon = out.split(".edit-tools.ribbon{display:flex")[1].split("}")[0]
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
    # since T135 the open goes through the one overlay owner
    assert "overlayShow(lb,lm);floatMenu(lb,lm);" in out
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
    # 2026-08-19: the COLUMN survives everywhere -- it holds Notebooks,
    # File and Save now. A poster hides only the film (deck-only), and
    # putting the strip away hides only the thumbnails.
    assert ".deck.editing.poster-page .deck-create{display:none" not in out
    assert ".deck.editing.strip-off .dc-film{display:none!important;}" in out
    assert ".deck.editing .dc-controls{display:none;}" in out
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
    # icon + word since 2026-08-24 (was two '&#9776; …' glyph strings)
    assert "vb.innerHTML=pg.poster?bic('versions')+' Versions'" in out
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
    # only one pane can own that corner at a time — the T136 owner,
    # not a hand-list per feature
    assert "paneShow('verpane');" in out
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
    # T110 hoisted the ents list to map slide-jump targets first
    assert "slides:ents.map(function(ent){" in out
    assert "var ents=outputSlides();" in out
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
    # ...and it asks for the SIZE-only reading, because that is what the
    # verb behind it uses. Gated on the plain selRects, two
    # position-locked boxes hid the control while sameSize would have
    # resized them happily (ported from the parallel branch, 2026-08-30).
    assert "show('#fmt-samewrap',selRects(true).length>=2);" in out
    assert "function needTwo(items,what){" in out
    assert "if(needTwo(items,'line up')) return;" in out
    assert "Select at least three items to space them out evenly" in out


def test_the_hint_does_not_call_a_poster_a_slide(out):
    """Five instructions said "click on the slide" to someone editing a
    printed A0 sheet -- the same leak the Page/Slide label and the
    Versions button already fixed elsewhere (2026-08-07 audit).
    """
    assert "var pw=pageOf().poster?'the page':'the slide';" in out
    # the text hint now names the armed TYPE ("draw a Heading 1 box") --
    # the pw half, which is what this test is about, is unchanged
    assert "'Drag on '+pw+' to draw a'" in out
    assert "' box, or click for one that sizes itself')" in out
    assert "Click on the slide to place a text box" not in out
    assert "Drag on the slide to draw a text box" not in out


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
    # rect, line, arrow and now the freehand stroke (2026-08-17)
    assert out.count(",sw:SW_DEFAULT") == 4
    assert "sw:3" not in out


def test_chrome_does_not_scale_but_never_loses_the_ink(out):
    """The invisible path you grab an arrow by is UI, not artwork, so its
    16px stays screen-measured -- scaled with the page it would leave a
    2px target on a zoomed-out poster. But the ink can now be wider than
    16px on a big page, so the target takes whichever is larger.
    Measured: 16px at fit and at 0.5x, 22px once the ink reached 11.95px.
    """
    assert "hit.setAttribute('stroke-width',Math.max(16,swPx+10));" in out


def test_opacity_is_a_colour_property_not_an_animation(out):
    """Opacity sat in a group called "Effects" next to Animate, which put a
    permanent property of the object beside a playback build -- and meant
    a POSTER, which has no builds at all, carried a group called Effects
    holding one slider, renamed to "Opacity" by hand to cover for it
    (2026-08-17, user: "why is the opacity with the animations? That is a
    terrible option").

    It is in COLOUR now, which is what it is: how solid the ink is. The
    poster rename goes with it -- with Animate hidden there and opacity
    moved, the group simply empties and syncRibbonGroups hides it, which
    is the mechanism that already existed for exactly this.
    """
    colour = out.split('<span class="rbn-lab">Colour</span>')[0]
    assert colour.rsplit('class="rbn-grp"', 1)[-1].count('id="fmt-opwrap"') == 1
    assert "fxLab.textContent=pg.poster?'Opacity':'Effects';" not in out
    # ...and the whole Effects group went with it: its last resident was a
    # SECOND door to the Animations pane (see the pane test)
    assert ">Effects</span>" not in out


def test_the_animation_pane_does_not_need_a_selection(out):
    """The build order for a slide was only reachable through a dropdown
    on the Animate button -- and that button only exists while something
    is selected. So to see what a slide animates you first had to find an
    item that happened to be animated (2026-08-17, user: "why is there no
    animation pane? Like you can only see all the animations when you find
    one with an animation").

    The pane is a real pane now, a sibling of Objects and Versions in the
    same shell, opened from the View group with nothing selected at all.
    Animate still opens it too -- one pane, two doors, because the build
    order is a property of the SLIDE and the effect chooser is a property
    of the selection.

    Measured: opened with nothing selected it lists every build; three
    animated items gave three numbered rows; reordering from the pane
    reordered the build; deselecting left the pane open and the list
    intact while the ribbon returned to its resting groups.
    """
    assert 'class="selpane animpane" id="animpane"' in out
    assert 'id="animpane-body"' in out
    assert 'id="vw-anim"' in out
    # the dropdown is gone, wrapper and all
    assert 'id="fmt-animwrap"' not in out
    # ONE door. There were briefly two -- View's Animations plus an
    # "Animate" button in Effects that renamed itself to the selected
    # item's effect. Same pane, different groups, different names, both
    # pressed at once (2026-08-17, user: "WHY IS ANIMATIONS AND APPEAR NOT
    # IN THE SAME PLACE"). The pane's effect chooser already tracks the
    # selection, which is everything the second button ever added.
    assert 'id="fmt-anim"' not in out
    assert "var vbtn=$('#vw-anim'),pane=$('#animpane');" in out
    # the pane outlives the selection, so it is told when one goes away
    assert "function animPaneSync" in out or "animPaneSync=function()" in out
    # WHAT it guards, not HOW MANY. This was an exact count and it was
    # wrong twice in one day -- T168's sequencing mode and T171's gallery
    # each added a moment when the pane's answer about the slide can
    # change underneath it, and neither was a regression. The rule is
    # that every such moment syncs, so assert the moments.
    assert "animPaneSync();animRibbonSync();" in out       # selection
    i = out.index("function seqEnd(commitIt){")
    assert "animPaneSync();" in out[i:i + 900]             # mode closing
    j = out.index("function galApply(type){")
    assert "animPaneSync();" in out[j:j + 900]             # whole-slide pick
    assert out.count("animPaneSync();") >= 3
    # only a deck has builds
    assert "if(vaB) vaB.hidden=!!pg.poster;" in out


def test_no_pane_covers_the_toolbar(out):
    """The panes live inside the stage WRAP, which also holds the ribbon,
    so `top:8px` measured from above the toolbar. Objects, Versions and
    Print check had all been sitting on top of View and Output since the
    ribbon became a fixed 98px band; the Animations pane reached Insert
    too, which is what made it visible (2026-08-17 audit).

    Measured after, for all three: pane top 106px against a ribbon bottom
    of 98px. In side mode the toolbar is a column on the right and the
    pane already steps aside horizontally, so the top is left alone.
    """
    # the ribbon moved OUT of the stage wrap (2026-08-19), so the panes'
    # own 8px is already clear of it -- the 106px clearance dated from
    # both sharing one box
    assert ".deck.editing:not(.rbn-side) .selpane{top:8px;}" in out
    assert ".deck.rbn-side .selpane{right:var(--rbn-side-w);}" in out


def test_qr_code_inserts_rather_than_arming_a_tool_that_does_not_exist(out):
    """QR code carried the generic `et` class -- the one that marks a
    DRAWING tool -- but had no `data-tool`. So the shared arming wiring
    ran `setTool(undefined)` and the button behaved like a tool nobody
    wrote: it lit up as pressed, Cancel appeared, the layer was classed
    `tool-undefined` and went to a crosshair, the hint was blank, and
    clicking the page did nothing (2026-08-17, user: "whatever QR code is
    is confusing. Sounds like adding a qr code" -- it does, and that was
    the problem: it also armed a phantom).

    Worse, the generic wiring is registered after the QR handler, so its
    setTool(undefined) clobbered the handler's own setTool('select') and
    the state survived a SUCCESSFUL insert too. Cancelling the prompt left
    it as well, having inserted nothing.

    Measured before: cancel -> `tool-undefined`, Cancel shown, QR pressed,
    0 items added. After: cancel -> `tool-select`, no Cancel, nothing
    added; accept -> the QR code lands and the editor stays in select.

    It is an immediate insert, like Image beside it -- which is exactly
    why Image never had the class.
    """
    qr = out.split('id="dc-qr"')[0]
    assert qr.rstrip().endswith('<button class="dbtn rbn-sm"'), \
        "dc-qr must not carry the `et` (drawing tool) class"
    # ...and an unknown tool can never arm again, for anything
    assert ("var TOOLS={select:1,text:1,arrow:1,rect:1,line:1,cell:1,draw:1,\n"
            "    table:1,flip:1,guide:1};") in out
    assert "if(!TOOLS[t]) t='select';" in out
    # the label says what it does and why you would want one
    assert "Ask for a link and put a QR code on the page" in out


def test_weight_is_a_menu_of_drawn_thicknesses_not_a_cycle(out):
    """It was a button that cycled 2 -> 3.5 -> 5 and reported the result in
    a tooltip afterwards: three weights, none of them visible until you
    had picked one, and no way back except round again (2026-08-17, user:
    "the weight just have all the options like word does with the
    different thicknesses").

    It is Word's own ladder now, each rung drawn at its thickness and
    labelled in printed points. Points, not the stored number: `a.sw`
    means "pixels on a 720px-tall page", which cannot be laid against a
    ruler -- so the ladder is defined in points and converted against the
    page you are on at pick time, because the same weight prints heavier
    on an A0 than on a slide.
    """
    assert "function swMm(a,pg){" in out
    assert "var SW_PT=[0.25,0.5,0.75,1,1.5,2.25,3,4.5,6];" in out
    assert "function ptToSw(pt,pg){" in out
    assert "return pt/PT_MM*SW_REF_H/(pg.mm[1]||191);" in out
    # the cycling button is gone, wrapper and all
    assert "a.sw=cur_>=5?2:(cur_>=3.5?5:3.5);" not in out
    assert "'#fmt-line':'arrow rect'," not in out
    # tables joined the weight menu on 2026-08-20: a table's rules are
    # a stroke like any other and scale with the page the same way
    assert "'#fmt-swwrap':'arrow rect draw table'," in out
    # the millimetre reading stays in the tooltip and in preflight, which
    # is the only part of the app that speaks in real millimetres
    assert "'mm on this page ('+swPt(a).toFixed(2)" in out
    assert "Line may not print ('+mmw.toFixed(2)+'mm)" in out


def test_the_line_menus_draw_the_option_instead_of_naming_it(out):
    """"Dash-dot" is a word you decode into a picture; "Curved the other
    way" is a word you decode into a picture and then mirror. For a dash
    pattern, an arrowhead or a route the picture IS the answer
    (2026-08-17, user: "use symbols with text on hover not typing what
    they are ... what the fuck are the curve options").

    Every row draws the real thing -- the renderer's own dash array, the
    renderer's own head path -- and keeps its full name in the tooltip.
    This is not the wordless-glyph problem the ribbon buttons had: a glyph
    stands for a thing and must be learned, a preview is the thing. The
    buttons that OPEN these menus stay worded.

    Measured in a browser: style 5 options, weight 9, ends 18 in three
    labelled rows, route 5 -- every one drawn, every one with a title,
    none showing a word on screen, and the selection's current value
    marked in each.
    """
    for fn in ("function styleIcon(id){", "function weightIcon(pt){",
               "function headIcon(id,atStart){",
               "function headSizeIcon(z){", "function routeIcon(d){"):
        assert fn in out, fn
    # the previews are built from the SAME tables the renderer draws from
    assert "strokeLine(3,8,107,8,2.4,LINE_DASH[id]||'')" in out
    assert "p.setAttribute('d',h.path);" in out
    # ends is three labelled rows, not eighteen lines starting with the
    # same word
    assert "menuHead(hd.menu,'Start');" in out
    assert "menuHead(hd.menu,'End');" in out
    assert "menuHead(hd.menu,'Size');" in out
    assert "'End: '+h.label" not in out
    assert "'Curved the other way'],['h','Elbow: across then down'" not in out
    # ...and every option says which one you are on
    assert "function syncLineMenus(a){" in out
    assert ('.sh-opt[aria-pressed="true"]{'
            'background:color-mix(in srgb,var(--accent) 20%,transparent);'
            in out)
    # the open/close wiring is shared rather than copied
    assert "function wireMenuToggle(wrapId,btnId,menuId){" in out
    assert out.count(
        "if(menu.hidden){overlayShow(btn,menu);floatMenu(btn,menu);}") == 1


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


def test_the_document_actions_are_in_one_thin_bar_across_the_top(out):
    """The long road: a bar above the ribbon (rejected 2026-08-07/08-10 as
    stolen height), borrowed into the ribbon's File group, then moved into
    the left column (2026-08-19). None of those put undo and redo anywhere
    you would look for them -- stranded under Save in a vertical column
    (2026-08-20, user: "horrible spot for the back and forewards button").

    They now live in ONE thin bar across the top, PowerPoint's shape:
    File, Save, undo/redo, the presentation's name, Find, the save
    readout, zoom and Present. This is allowed to be a row above the tools
    -- the thing the ribbon itself may never be -- because it REPLACED
    chrome rather than adding it: a block in the left column plus two
    ribbon groups became one line, and nothing in it changes with the
    selection, so no tab can take it away.
    """
    # the notebooks CONTENT strip still leads the left column, and its
    # header row is still the way back
    assert 'id="dc-nbs"' in out
    assert "h.addEventListener('click',function(){closeDeck();});" in out
    # markup order IS the bar's order
    qat = out.split('class="deck-qat"')[1].split('class="rbn-tabs"')[0]
    for cid in ('id="dc-file"', 'id="dc-save"', 'id="dc-undo"',
                'id="dc-redo"', 'id="qat-find"', 'id="qat-name"',
                'id="deck-status"', 'id="dc-play"'):
        assert cid in qat, cid
    # ZOOM is NOT here. It went ribbon -> top bar -> the corner of the
    # canvas, which is where Word, PowerPoint, Figma and Illustrator all
    # put it: it is a property of the canvas, so it belongs at the canvas
    # (2026-08-20, user: "I find the location of the zoom still really
    # annoying. That is a prominent feature, and it needs to be somewhere
    # good"). It floats over the stage, so it costs no height.
    assert 'id="zoom-val"' not in qat
    assert 'class="deck-zoombar" id="deck-zoombar"' in out
    assert ".deck.editing .deck-zoombar{display:flex;}" in out
    assert (".deck.pane-open .deck-zoombar{"
            "right:calc(var(--pane-w) + 18px);}") in out
    # ...and .dc-head, which used to hold them in the column, is gone
    assert 'class="dc-head"' not in out
    # exactly one bar occupies row 1: .deck-qat while editing or building,
    # .deck-top while presenting, never both
    assert "if(dt) dt.hidden=editing;" in out
    assert "if(qat) qat.hidden=!editing;" in out
    assert ".deck-top,.deck-qat{grid-column:1/-1;grid-row:1;}" in out


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
    # the armed-tool hints stay: they are the ones doing work, and they
    # say DRAG now, because every insert tool draws itself out
    assert "'Drag on '+pw+' to draw a line'" in out
    # the text hint gained the armed type's name (2026-08-22) but still
    # says DRAG and still goes through pw
    assert "'Drag on '+pw+' to draw a'" in out
    assert "' box, or click for one that sizes itself')" in out


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


def test_view_and_output_became_one_group(out):
    """Guides and Objects change what YOU see while working; Print check
    and Present are about the finished thing (2026-08-07, user: "present
    and print check go together, but objects and guides are different").

    That split outlived its reason. Present moved to the bar across the
    top on 2026-08-20 -- it must survive every tab, and a tab could have
    taken it away -- which left Output as a heading over ONE button, and a
    heading over one button is a heading doing no work (user: "some tabs
    still now have two few buttons").

    So the two collapsed back together. Checking the page before it goes
    out IS a way of looking at it, which is what every other control in
    View is for; the 2026-08-07 distinction was really about Present, and
    Present is in neither of them now.
    """
    assert 'class="rbn-grp rbn-fixed rbn-view" data-tab="home"' in out
    assert 'class="rbn-grp rbn-out"' not in out
    assert ">Output</span>" not in out
    view = out.split('class="rbn-grp rbn-fixed rbn-view"')[1].split(
        ">View</span>")[0]
    assert 'id="vw-menuwrap"' not in view
    assert 'id="vw-rulers"' in view and 'id="objects-btn"' in view
    assert 'id="vw-full"' in view
    assert 'id="vw-check"' in view
    assert 'id="dc-play"' not in view


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
    slide = out.split('class="rbn-grp rbn-fixed rbn-slide"')[1].split(
        ">Slide</span>")[0]
    view = out.split('class="rbn-grp rbn-fixed rbn-view"')[1].split(
        ">View</span>")[0]
    assert 'id="vw-versions"' in slide and 'id="vw-versions"' not in view
    # ZOOM has since left View entirely, for the thin bar across the top
    # (2026-08-20). Same reasoning, taken one step further: it is the one
    # control you reach for on every tab, and a control a tab can take
    # away from you is a control you cannot rely on. It is still not a
    # page property, which is the distinction this test exists for.
    assert 'id="zoom-val"' not in view and 'id="zoom-val"' not in slide
    assert 'id="zoom-val"' in out.split('class="deck-zoombar"')[1]
    # View can no longer stand down for a selection: an object list is at
    # its most useful when there IS an object selected
    assert 'rbn-standby rbn-view' not in out
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
    # the mutation writes the fields drawShapeSvg/cssFill actually read.
    # It lives in fillMut() now (2026-08-20): presets, recent chips, the
    # picker and the hover preview all share the one implementation
    assert "function fillMut(c){return function(a){" in out
    assert "else {a.fill=1;a.fillc=c;}" in out
    # the custom "+" chip too
    assert "else if(a.k==='rect'){a.fill=1;a.fillc=str;delete a.grad;}" in out
    # and the picker prefills from the shape's own fill
    assert "if(a.k==='rect') return (a.grad&&a.grad.a)" in out
    # two Fill buttons would otherwise both read "Fill"
    assert "((kind==='rect')?'Fill colour ▾':'Fill ▾')" in out
    # ...and it keeps its ICON while being renamed. textContent wiped the
    # icon along with the old word on every pass, which is why this was
    # one of the two ribbon buttons that could never carry one
    # (2026-08-25).
    assert "fcb.innerHTML=bic('fill')+' '" in out


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
    # scoped to the side rail: T77 gives the home view's welcome-drop a
    # full-width row of its own, which is a different element in a
    # different sheet and a deliberate one
    _rail = out[out.index(".deck.rbn-side .rbn-row{"):]
    assert "flex:1 0 100%" not in _rail[:2000]
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
    # the pair now travels no further than the top bar, which sizes it
    # once (2026-08-20) instead of the two-way .dc-head/.rbn-cell
    # negotiation it needed while it lived in the column
    assert ".deck-qat .rbn-cell{height:26px;gap:3px;}" in out


def test_the_save_readout_lives_under_save(out):
    """It sat at the ribbon's far end while the File group was borrowed
    into the bar. With the document actions living in the left column
    (2026-08-19) it sits under Save on its own full-width line, where its
    renames cannot move any ribbon control by construction.
    """
    # the readout sits inline in the top bar now, capped in characters
    # so a long filename can never reach the controls beside it
    # ...and it is a BLOCK container, or the ellipsis it asks for can
    # never fire: an inline-flex's bare text is an anonymous flex item,
    # so 26ch of "autosaved to <file> · 12:41" was sliced off mid-glyph
    # rather than ellipsised (T70)
    assert (".deck-qat .deck-status{display:inline-block;height:24px;"
            "line-height:24px;") in out
    # the display above outranks the base :empty rule, so the empty pill
    # has to be hidden again or it draws as a bare stub
    assert ".deck-qat .deck-status:empty{display:none;}" in out
    assert "var st=$('#deck-status'),bar=$('#edit-tools');" not in out


def test_a_two_row_cell_is_counted_as_two(out):
    """--rbn-cols is "half the visible controls, rounded up", which assumes
    every control is one cell. A .rbn-stack spans BOTH rows, so File --
    once its status readout left and it was down to the File/Save stack
    plus undo/redo -- asked for one column to hold three cells and pushed
    undo/redo into an implicit third row, over the group's own label. The
    same trap the View group fell into on 2026-08-16, from the other side
    (2026-08-17).
    """
    assert "n+=(c.classList.contains('rbn-stack')" in out
    assert "||c.classList.contains('rbn-tall'))?2:1;" in out


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


def test_an_image_resizes_the_picture_not_the_letterbox(out):
    """.an-imgel is object-fit:contain, so a free-form box that no longer
    matched the picture's shape just grew LETTERBOX: drag a wide photo
    downwards and the selection outline got taller while the photo stayed
    exactly the size it was. That is the bug nobody could name --
    2026-08-20, user: "images don't get bigger when you drag them, just
    get's a bigger border".

    A picture now behaves like a picture: the stored box is first snapped
    onto the image (killing any letterbox already banked) and then the
    aspect is held for the drag, which is what figure frames have always
    done. Shift releases it, live, mid-gesture. A CROPPED image keeps
    free-form resizing, because there the box IS the crop window
    (object-fit switches to cover) and reshaping it is the whole point.
    """
    assert "if(a.k==='image'&&!a.crop&&el){" in out
    assert "var ie=el.querySelector('.an-imgel');" in out
    # Shift is the momentary OPPOSITE of whatever lock is in force now,
    # not just a release for pictures (T65)
    assert "var ratio=baseRatio" in out
    assert "?((canFree&&ev.shiftKey)?0:baseRatio)" in out
    assert ":(ev.shiftKey?boxRatio:0);" in out
    # the snap ladder and the height derivation both follow the LIVE
    # decision, not the one made at mousedown
    # the height only snaps on a drag that OWNS the vertical axis; a
    # ratio-locked drag lets the leading axis snap and the other follow
    assert ("if(a.k!=='text'&&(north||south)&&(!ratio||axisY)){") in out
    # T65: the axis that LEADS depends on the handle -- a side handle
    # dragged vertically has the height lead and the width follow, which
    # the four-corner version could not express
    assert "if(ratio&&lr.height&&lr.width){" in out
    assert "if(axisY&&a.k!=='text'){" in out
    assert "nw=nh*(lr.height*ratio/lr.width);" in out
    # and the handle says so
    assert "'Drag to resize — the picture keeps its shape. '" in out


def test_arrows_are_drawn_in_a_second_pass(out):
    """An attached endpoint is DERIVED from where its target item is on
    the layer, and annotRectPct measures the rendered element for anything
    auto-sized (text) or aspect-fitted (a figure frame). An arrow drawn in
    the same pass as its target therefore measured an element that was not
    in the DOM yet whenever the target came later in the array, and fell
    back to its stored coordinates -- so the arrow moved (2026-08-20,
    user: "arrows and lines when going to present do not stay in the same
    place").

    Two passes make attachment order-independent. And because a figure
    frame settles into its fitted box asynchronously -- fitFigFrame
    retries until the <img> reports a natural size -- a fit that actually
    MOVES the frame asks for the arrows alone to be redrawn. Arrows only:
    redrawing the figures from there would fit them again and never
    settle.
    """
    assert "function drawArrow(layer,s,a,i,svg,svgTop,defs,editing){" in out
    assert "function redrawArrows(layer,s){" in out
    assert "if(a.k==='arrow'){_arrows.push(i);return;}" in out
    assert "if(moved) scheduleArrowRedraw(layer);" in out
    # z-order is unchanged: the visible strokes have always gone into
    # svgTop, which is appended last
    assert "layer.appendChild(svgTop);" in out
    # an arrow's visible stroke is not an .an-item, so the build pass
    # never reached it and an ANIMATED arrow sat on the slide from the
    # first frame
    assert "$$('.an-item[data-idx],.an-arrow-line[data-idx]',layer)" in out


def test_thumbnails_are_a_scale_model_of_the_slide(out):
    """miniDiagram walked slideCells() and nothing else, so a slide made
    of text, arrows, shapes or images showed as an empty box and every
    such slide in the strip looked identical (2026-08-20, user:
    "thumbnails do now show text, or anything else for that matter, just
    the cells").

    Two halves to that. miniDiagram now draws every kind at its page
    percentage; and markDirty refreshes the current slide's thumbnail,
    which nothing did before -- the strip was only rebuilt by refresh(),
    so editing the slide you were looking at never touched its picture.

    Type and stroke get a floor, which is the opposite of the rule fontPx
    follows on the real page and deliberately so: the page is the document
    and must stay true to itself, a thumbnail is an INDEX and has to be
    legible.
    """
    assert "var MINI_H=66;      /* mirrors --mini-h in deck.css */" in out
    assert ".mini-diagram{--mini-h:66px;" in out
    assert "function miniText(d,a,txt,cls,centred){" in out
    assert "function miniBox(d,a,cls){" in out
    assert "function miniSw(a){" in out
    # arrows share one overlay in the page's own 0..100 space, so nothing
    # has to be measured in pixels
    assert "sv.setAttribute('preserveAspectRatio','none');" in out
    assert "function refreshThumb(i){" in out
    assert "    refreshThumb(cur);\n  }" in out
    # svg ids must be unique across the whole strip, not just one thumb
    assert "'m'+(miniSeq++)" in out


def test_animations_can_be_removed(out):
    """The None effect existed, inside a pane you had to know to open,
    with an item selected, looking like any other effect rather than like
    a removal (2026-08-20, user: "there doesn't seem to be a way to remove
    animations"). The effects are buttons on the Animate tab now, showing
    which one is on, and Clear slide strips the whole slide in one press
    instead of item by item.
    """
    # the four per-effect buttons became one gallery door (T171):
    # they were hidden until something was selected, and un-hidden by
    # the very click that moved the ribbon off their tab
    for bid in ("anim-effect",
                "anim-clear"):
        assert f'id="{bid}"' in out, bid
    # Animation is a tab of its own again (T176): it was folded into
    # Insert when it was six small buttons, and it is two groups and
    # seven doors now -- the pointing mode and the reading order came
    # up from the foot of the pane, where they were a door behind a door
    assert 'class="rbn-grp rbn-anim" data-tab="animation"' in out
    assert 'class="rbn-grp rbn-build" data-tab="animation"' in out
    assert 'id="anim-seq"' in out and 'id="anim-order"' in out
    assert "e.stopPropagation();seqArmStart();});" in out
    assert 'class="rbn-grp rbn-anim" data-tab="insert"' not in out
    assert "animRibbonSync=function(){" in out
    assert "revealCount=0;commit(s);" in out


def test_renaming_is_one_committed_action(out):
    """Three doors, no shared implementation: each poked pres.name and
    #pres-name directly. #pres-name lives in .dc-controls, which is
    display:none the whole time you are editing, so File > Rename... was
    focusing a 0x0 input and appeared to do nothing in the primary flow.
    And the input renamed on every KEYSTROKE, lsDel-ing the draft under
    each prefix on the way -- renaming "talk" to "talk2" left ghosts at
    "tal", "ta" and "t" (2026-08-20 diagnosis).

    One renamePresentation(), committed on Enter or blur, that moves the
    WORK and not just the label: the browser draft, the project entry and
    the embedded copies, with a collision guard in front.
    """
    assert "function renamePresentation(nm){" in out
    assert "if(taken.indexOf(nm)>=0){" in out
    # The new draft must be durable before the only old copy is removed.
    rename = out[out.index("function renamePresentation(nm){"):
                 out.index("menuAction('#mi-del'")]
    assert "if(!lsSet(PFX+nm,JSON.stringify(moved))){" in rename
    assert rename.index("if(!lsSet(PFX+nm") < rename.index("lsDel(PFX+old);")
    assert rename.index("histRename(old,nm);") < rename.index("pres.name=nm;")
    # the per-keystroke handler is gone, and BOTH doors call the one
    # implementation
    assert "if(old&&old!==pres.name) lsDel(PFX+old);" not in out
    assert "menuAction('#mi-rename',startQatRename);" in out
    assert "qatName.addEventListener('click',startQatRename);" in out


def test_menu_surfaces_are_opaque(out):
    """--chrome-2 is the surface every menu, dialog, popup and input in the
    app sits on, and it carried an alpha byte -- the value ended in 44,
    i.e. 27% opaque. So every one of them was see-through against whatever
    happened to be behind it -- worst on the theme picker, which opens over
    the ribbon (2026-08-20, user: "some of the pop up menus like changing
    the theme still have weird transparent background").

    Every consumer that wants translucency mixes its own with color-mix;
    none of them wanted this one. The opaque value is what every fallback
    in the file was already using. Measured after the fix: the theme menu
    computes to rgb(22, 39, 53) on dark and rgb(16, 20, 24) on high
    contrast.
    """
    assert "--chrome-2:#162735;" in out
    assert "#16273544" not in out
    assert "#16352b44" not in out


def test_high_contrast_re_inks_the_surfaces(out):
    """It used to set only the accent and the button faces, so "Dark high
    contrast" was the ordinary dark theme with brighter outlines -- not
    what anyone turning on high contrast is asking for (2026-08-20, user:
    "some of the themes are not right").
    """
    assert "body.th-contrast{--accent:#6fe3ff;" in out
    assert "--chrome:#000000;--chrome-0:#000000;" in out
    assert "body.th-contrast .rbn-tab{color:#c8dae6;}" in out
    # the colourful theme's per-group hues are a hand-kept list, so a group
    # added without a line here falls back to the default accent and the
    # theme looks half-applied -- which had happened to all four groups
    # added in August
    for grp in ("rbn-slides", "rbn-furn", "rbn-anim", "rbn-build",
                "rbn-tbl"):
        assert f"body.th-colorful .{grp}" in out, grp
    # ...and the two groups that no longer exist are gone from it
    assert "body.th-colorful .rbn-file" not in out
    assert "body.th-colorful .rbn-nbs" not in out


def test_fullscreen_takes_the_root_not_the_deck(out):
    """A fullscreen element paints its own subtree and nothing else, and
    half this app's overlays are SIBLINGS of .deck rather than children of
    it. Measured 2026-08-20: #color-pop, #find-pop, .jv-scheme-menu and
    #pickbar are all outside #deck. Fullscreening .deck therefore made the
    theme picker, the colour picker, find & replace, the cell-pick bar and
    the playback spotlight invisible for as long as it was on -- which is
    why the theme could not be changed while editing full screen (user).

    .deck is position:fixed;inset:0 either way, so taking the root instead
    looks identical and simply stops swallowing the overlays.
    """
    assert "function fullTarget(){" in out
    assert "return document.documentElement;" in out
    assert "fullTarget().requestFullscreen()" in out
    assert "deckEl.requestFullscreen()" not in out


def test_the_tools_fold_away(out):
    """The ribbon is about 100px of a 700px laptop window, and there are
    long stretches -- reading it back, rehearsing, nudging one thing into
    place -- where the page matters and the tools do not (2026-08-20, user:
    "would be good if the editing tools can be made to pop up and down").

    The TAB STRIP always stays: it is one button high, it is how you get
    the tools back, and a bar that vanishes completely leaves you with no
    way to say you want it again. Double-click a tab or Ctrl+F1 toggles,
    both of which are what PowerPoint trains people to reach for.
    Measured: stage height 789 -> 887 on fold.
    """
    assert 'id="rbn-fold"' in out
    assert "function setRibbonFold(on){" in out
    assert ".deck.rbn-fold>.edit-tools{display:none;}" in out
    # the strip survives
    assert ".deck.rbn-fold>.rbn-tabs" not in out
    # a folded bar has no width to measure, so the density ladder stops
    assert "if(deckEl.classList.contains('rbn-fold')) return;" in out
    # the button rule is SCOPED: unscoped, `.rbn-fold` also matched the
    # deck's own state class, so folding put padding on a fixed;inset:0
    # element and the stage came out smaller than before
    assert ".rbn-tabs .rbn-fold{align-self:center;" in out


def test_open_notebooks_live_in_the_rail(out):
    """A row of horizontal tabs is a row of chrome across the top of the
    document whose width runs out at about five notebooks, and the rail
    beside it was already the place this app lists the things you can
    switch between (2026-08-20, user: "I don't want the horizontal tabs in
    notebooks anymore, this should just be a thing down the right hand
    side pop up thing, like presentations but just under the buttons that
    says notebooks").

    The strip MOVED node-for-node rather than being rebuilt, so makeTab,
    the close buttons, the Plot-trace sub-tabs and the version marks all
    keep working untouched.
    """
    rail = out.split('class="presrail"')[1].split("</nav>")[0]
    assert 'id="tabstrip"' in rail
    assert 'id="pr-nblabel"' in rail
    # the header row keeps only the two sidebar toggles
    row = out.split('class="tabsrow"')[1].split("</div>")[0]
    assert 'id="tabstrip"' not in row
    assert ".presrail .tabstrip{display:flex;flex-direction:column;" in out
    # a heading over an empty list promises something that is not there
    assert "if(nbl) nbl.hidden=!tabstrip.childNodes.length;" in out


def test_the_equation_editor_is_real(out):
    """"Insert equation" used to drop a text box containing "$$ E = mc^2
    $$" and walk away -- no preview, no symbols, no way to tell whether
    what you typed was valid (2026-08-20, user: "what the hell does insert
    equation do? There is no latex render and no symbols and stuff to
    add?").

    Measured in the browser: 104 keys in 5 groups, 96 of them typeset as
    real symbols; clicking the fraction key inserts \\frac{}{} and leaves
    the caret at offset 6, inside the first brace.
    """
    assert 'id="eq-dlg"' in out
    assert "var EQ_PAL=[" in out
    # the KEYS are set in maths, not spelled in LaTeX -- the same
    # words-where-a-picture-belongs problem the fill menu had
    assert "b.className+=' eq-key-tex';" in out
    assert "MathJax.typesetPromise([pal])" in out
    # MathJax fails two different ways and neither of them throws
    assert "var setOk=prev.querySelector('mjx-container');" in out
    assert "if(setOk&&!bad) return;" in out
    assert "That did not typeset" in out
    assert "No maths renderer available" in out


def test_locking_says_why_it_cannot(out):
    """Locking pins a figure to its notebook's git commit, which needs the
    local server to reach git -- so it only works in the app build. It used
    to VANISH everywhere else, which reads as a feature that was removed
    rather than one that is unavailable here (2026-08-20, user: "what
    happened to locking all the images to a git commit"). Shown and
    disabled, with a tooltip that says what would make it work.
    """
    assert "var isCellRef=(kind==='cell')&&!!a.ref;" in out
    assert "show('#fmt-lockver',isCellRef);" in out
    assert "lvb.disabled=!canLock;" in out
    assert "Locking pins a figure to a git commit" in out
    # ...and the same for Lock all / Unlock all in the notebooks column
    assert "la.disabled=!appMode;" in out
    assert "ua.disabled=!appMode;" in out


def test_light_themes_re_ink_the_surfaces(out):
    """Light used to re-ink the page and leave --chrome-0..4 at their dark
    values, so every menu and panel relied on a hand-written
    `body.light .thing{background:#fff}` rule of its own. Anything added
    without one came out dark-on-light, and where the override existed but
    carried an alpha byte it came out washed (2026-08-20, user: "some of
    the menu options in different themes also are too transparent").
    """
    assert "body.light{--chrome:#eef2f6;--chrome-0:#f4f7fa;" in out
    assert "body.light.th-lforest{" in out
    # the two overrides that carried alpha
    assert "#fffffff5" not in out
    assert "#fffffff7" not in out
    # panels that hold CONTROLS are fully opaque; translucency is for
    # overlays, not for things you click
    assert "background:var(--chrome-3,#101c28);border:1px solid #ffffff22;" \
        in out


def test_page_background_left_the_file_menu(out):
    """File is where you open, save and export things; how the deck LOOKS
    is Design. Page background sat in the File menu because somebody put
    it there, not because it belonged (2026-08-20, user: "why the fuck is
    page background in file"). It is in the Background dropdown now,
    beside the per-slide override, so the two can be seen against each
    other. Measured: 22 chips in that one menu, none in File.
    """
    assert 'id="mi-pagebg"' not in out
    assert "menuHead(menu,'Every slide');" in out
    assert "menuHead(menu,'This slide');" in out


def test_the_save_destination_says_where_not_which_file(out):
    """2026-08-20, user: "I don't want you to have 'save to <filename>'.
    You are never getting this one. I want you to just say if it's save to
    local or browser."

    The filename is the widest thing that could ever land in that bar, it
    changes under you when you pick a different file, and it answers a
    question nobody asked -- what you ask of a Save button is "is this
    going somewhere I will find it again?". The filename is in the
    tooltip. Measured: "This browser" / "A file on your computer...".
    """
    assert "if(saveTarget==='file') return 'On this computer';" in out
    assert "return 'In this browser';" in out
    assert "return fileName||'a file (not chosen yet)';" not in out


def test_opening_a_file_keeps_saving_to_it(out):
    """Opening a .junoview used to import its contents and carry on saving
    to the BROWSER, so the file you opened never changed again and your
    work quietly went somewhere else (2026-08-20, user).

    Where the File System Access API exists we take a real handle, so Save
    writes straight back. Where it does not, an <input type=file> gives
    contents but no handle -- nothing can write back to it -- so the
    target still becomes "a file on your computer" and the first Save asks
    once. Either way "where is this going?" stops being "somewhere else".
    """
    assert "function openDeckFile(){" in out
    assert "if(window.showOpenFilePicker){" in out
    assert "fileHandle=h;fileName=h.name||f.name||'';" in out
    # the no-handle path still moves the destination off the browser
    assert "fileName=nm;fileHandle=null;" in out
    assert out.count("setTarget('file');") >= 3


def test_paste_lands_in_the_same_place_on_another_slide(out):
    """2026-08-20, user: "copying and pasting something from one slide to
    another should be pasted into the same location on the other slide
    that it was copied from". Pasting onto the SAME slide still nudges, or
    the copy hides exactly under its original.
    """
    assert "var clipFrom=-1;" in out
    assert "clipFrom=cur;" in out
    # still the rule Ctrl+V follows, now as one of pasteBuf's three
    # placement modes (see the paste-modes test in test_slide_editor)
    assert "dx=dy=(clipFrom===cur)?3:0;" in out


def test_off_page_items_can_be_reached(out):
    """An item dragged past the page edge used to be simply unreachable:
    the stage clipped it and only ever scrolled when the PAGE was bigger
    than the window (2026-08-20, user: "when objects are outside of the
    view, there is no horizontal scroll to see them").

    The layer stops clipping while editing, strays are outlined so it is
    obvious they are off the page, and the stage grows scrollbars only
    when something is actually out there.
    """
    assert ".annot-layer.an-spill{overflow:visible;}" in out
    assert ".deck.editing .deck-stage.spill{overflow:auto;}" in out
    assert "if(mode==='edit') layer.classList.add('an-spill');" in out
    assert "stage.classList.toggle('spill',spill);" in out
    assert "el.classList.toggle('an-offpage',out);" in out


def test_line_and_paragraph_spacing(out):
    """2026-08-20, user: "when I say I want all the power point options,
    why do you not do all them. Like where is the line spacing options".

    A MULTIPLE of the type size, the way every word processor states it,
    so it means the same thing at every zoom and on every page size and
    needs no re-measuring. Paragraph spacing is the half nobody asks for
    until their bullets are touching.
    """
    assert "var LH_STEPS=[" in out
    assert "var PS_STEPS=[" in out
    assert 'id="fmt-lhwrap"' in out
    assert "if(a.lh) d2.style.lineHeight=a.lh;" in out
    # it travels with a named style and with Match slide. Pinned by
    # MEMBERSHIP, not by sitting at the end of the array: MATCH_PROPS
    # grew a line-and-arrow section on 2026-08-22, and an assertion that
    # depends on which property happens to be last breaks every time the
    # list is extended without saying anything true about line spacing.
    assert "'lh','pspace'," in out
    assert "if(d.lh) a.lh=d.lh; else delete a.lh;" in out


def test_typing_a_dash_makes_a_bullet(out):
    """The markdown habit everybody already has, and the reason nobody
    could find the List button until they had given up (2026-08-20, user:
    "need auto-dot points"). It fires only on the FIRST characters of a
    box that is not already a list, so it can never eat a hyphen you meant
    to keep. Measured: typing "- " produced a <ul> with one <li>.
    """
    assert "var m=/^\\s*([-*\\u2022]|1[.)])\\s$/.exec(t);" in out
    assert "if(el.classList.contains('an-ul')) return;" in out
    assert "var kind=/^1/.test(m[1])?'number':'bullet';" in out


def test_the_scratchpad(out):
    """Three kinds of note in one pane: this slide, the whole talk, and a
    scratchpad belonging to neither (2026-08-20, user: "overall notes, and
    then also notes per slide, and make little notes and folders of
    notes"). The scratchpad is where a thought goes before you have
    decided where it goes -- the reason people keep a text file open
    beside their deck.
    """
    assert 'id="np-tabs"' in out
    assert 'id="notespane-deck"' in out
    assert 'id="notespane-pad"' in out
    assert "function padList(){" in out
    assert "function renderPad(){" in out
    # notes and the pad travel with the file
    assert "if(typeof p.notes==='string'&&p.notes) out.notes=p.notes;" in out
    assert "if(Array.isArray(p.pad)&&p.pad.length)" in out


def test_layer_folders_are_filing_not_grouping(out):
    """Grouping WELDS items together -- they move and format as one, which
    is exactly what you do not want from a filing system. Until now the
    only folders in the Layers pane were groups, so tidying twelve items
    into three folders also made three rigid blocks (2026-08-20, user:
    "there needs to be folders in the objects thing").

    A folder is just a name on the items in it (a.fold). Nothing about
    selection, movement or formatting changes.
    """
    assert "function folderNames(s){" in out
    assert "s.annots[i].fold=nm;" in out
    # the tool's dashed-frame icon comes from SemIcons now (2026-08-23)
    assert "bic('frame')+' New folder'" in out
    # an item filed in a folder must not also appear in the loose list
    assert "if(!ann[i]||(ann[i].grp==null&&!ann[i].fold))" in out


def test_lines_can_be_bent_through_corners(out):
    """2026-08-20, user: "when adding arrows you can really edit all the
    points and make it the exact shape you want". Attachment already
    worked; what was missing was intermediate points -- the model had
    exactly two endpoints plus a canned route.

    Corners win over the canned routes: once you have dragged one in by
    hand, "curved" and "elbowed" are no longer describing the line you
    drew. Measured live: a freshly drawn arrow shows one add-handle per
    segment, and dragging it turned "M242 407 L970 5" into a curve
    through the new corner.
    """
    assert "function arrowMids(a){" in out
    assert "function startMidPoint(layer,s,idx,mi,ev0){" in out
    assert "ad.setAttribute('data-addat',sgi);" in out
    assert "h.setAttribute('data-mid',mi);" in out
    # the corners travel with the line
    assert "if(Array.isArray(a.mid)) a.mid=a.mid.map(function(m){" in out
    # selecting is not a re-render, so the handles need asking for
    assert "})) redrawArrows(layer,s);" in out


def test_undo_can_see_the_whole_presentation_not_just_its_slides(out):
    """Undo used to snapshot the slides and nothing else, which did not
    merely miss a step -- it corrupted the document.

    ``scaleStyles()`` rewrites ``pres.styles`` and then writes the new
    sizes into every text box. Only the boxes were in the snapshot, so
    Ctrl+Z put the boxes back and left the definitions scaled; the next
    ``applyStyleTo`` -- editing a box, Re-apply, Match slide -- silently
    brought the scaling back, and because scaleStyles multiplies the
    CURRENT definition, scale/undo/scale drifted the type further every
    time (2026-08-22).

    Page size and page background failed the other way round: annots are
    stored in percentages, so changing either left the snapshot identical,
    histPush's "nothing actually changed" guard fired, and no undo entry
    was created at all.
    """
    assert "function histState(){" in out
    # the three that were missing
    assert "page:pres.page||null,pageBg:pres.pageBg||null," in out
    assert "cropMarks:pres.cropMarks||0});" in out
    assert "?pres.styles:null," in out
    # ...and restored, not merely recorded
    assert ("['wmark','head','foot','styles','tokens','components','cuts',\n"
            "     'guides','masters','page','pageBg',") in out
    assert "'cropMarks'].forEach(function(k){" in out
    # an empty styles object and no styles object are the same deck, or
    # merely READING a style records a phantom undo step
    assert "(pres.styles&&Object.keys(pres.styles).length)" in out
    # a restored page size is not repainted by refresh()
    assert "if(pageChanged) applyPage();" in out
    # the styles come back as DEFINITIONS: restyling here would overwrite
    # the restored boxes with the restored definitions
    assert "restyleAll" not in out.split("function histRestore(")[1][:1200]
    # written on every keystroke, so deliberately NOT snapshotted
    assert "notes:pres.notes" not in out
    assert "pad:pres.pad" not in out


def test_match_slide_moves_a_line_which_has_no_x_y_w_h(out):
    """A line is stored as its two endpoints, not as a box.

    MATCH_PROPS named only x/y/w/h, which an arrow does not use, so Match
    slide copied nothing an arrow is made of: it counted the arrow as
    moved and left it exactly where it was (2026-08-22).
    """
    assert "'x1','y1','x2','y2','mid','curve','bend'" in out
    # the heads and the line style travel too
    assert "'head','tail','nohead'," in out
    # ...but the TIES do not: c1/c2 name items on the other slide, and an
    # attached end is placed from its tie, so copying one drags the arrow
    # onto a stranger
    assert "'c1'" not in out.split("var MATCH_PROPS=[")[1][:400]
    assert "'c2'" not in out.split("var MATCH_PROPS=[")[1][:400]
    # a freehand stroke's points ARE its content, never its layout
    assert "'pts'" not in out.split("var MATCH_PROPS=[")[1][:400]


def test_the_view_group_folds_rather_than_letting_the_row_clip(out):
    """The density ladder's last rung promised to drop a group "rather
    than let the row clip". It never dropped anything -- erc-tight only
    tightened padding -- so at 1366px with a text box selected the row ran
    66px over and Bold, Italic, Underline and Layout were clipped away.

    The bar is ``overflow-x:clip`` and must stay that way (a scroll
    container cuts off every downward dropdown at the ribbon's edge), so
    the fix is to fold, not to scroll and not to drop: seven buttons
    become one that opens them as a menu.
    """
    assert 'id="vw-morewrap"' in out and 'id="vw-more-menu"' in out
    assert "function foldViewGroup(on){" in out
    # folded exactly at the rung whose comment promised it
    assert "cl.add('erc-tight');\n      foldViewGroup(true);" in out
    # ...and the count of showing controls re-run, since seven just left
    assert "foldViewGroup(true);\n      sizeRibbonGroups();" in out
    # every rung is judged against the FULL row, or a bar folded at 1280px
    # would stay folded after the window is maximised
    assert "foldViewGroup(false);\n    sizeRibbonGroups();" in out
    # the rows drive the real buttons, so each keeps its implementation
    assert "closeViewMenu();real.click();" in out
    # a row stands in for a toggle, so it has to show the toggle's state
    assert ".vw-more-menu .vw-opt.on{" in out
    # unfolding must not reveal a control this page never had
    assert "viewWasHidden[p[0]]=b.hidden;b.hidden=true;" in out


def test_typed_text_reaches_the_model_without_a_blur(out):
    """The only thing that committed on-canvas text was `blur`.

    So Ctrl+S while typing opened the browser's own Save-page dialog and
    saved nothing; renderAnnots' ``layer.innerHTML=''`` removed the focused
    node, which fires no blur in Chrome or Firefox, and every slide change
    or notebook refresh ate the paragraph; closing the tab lost it; and
    markDirty never ran, so the 1.2s autosave was not running during the
    one activity that produces unrecoverable text -- while the readout said
    "autosaved" (2026-08-22).
    """
    assert "function flushTextEdits(){" in out
    # a debounced commit while you type, so a crash costs a phrase
    assert "typeT=setTimeout(function(){commitNow(true);},900);" in out
    # ...which persists WITHOUT an undo step, or a paragraph would evict
    # real slide edits from the 50-deep stack
    assert "function markDirty(quiet){" in out
    assert "if(!quiet) histPush();" in out
    # every path that persists, re-renders or tears down flushes first
    assert "flushTextEdits();\n    layer.innerHTML='';" in out
    assert "flushTextEdits();   /* the words still in the DOM are part" in out
    assert "if((e.ctrlKey||e.metaKey)&&(e.key==='s'||e.key==='S'))" in out
    # a tab can close or be backgrounded without ever firing blur
    assert "window.addEventListener('pagehide',lastChance);" in out
    # table cells had the identical blur-only shape
    assert "td.__jvFlush=function(){writeCell();markDirty(true);};" in out


def test_a_failed_browser_save_is_not_reported_as_a_save(out):
    """lsSet swallowed QuotaExceededError and returned nothing, and all
    seventeen callers ignored it -- so once a draft outgrew the ~5MB budget
    every later write was discarded while Save toasted "Kept in this
    browser" and the readout said "saved". In the browser and static builds
    that store IS the presentation (2026-08-22)."""
    assert "function lsIsFull(){return lsFull;}" in out
    # the Save button must not stamp a save that did not happen
    assert "toast('NOT saved — this browser is full." in out
    # ...and the readout outranks every other reading while it is true
    assert "el.textContent='NOT saved — browser full';" in out
    # an image is the thing that fills it, so cap what can arrive
    assert "var IMG_MAX_EDGE=2400;" in out
    # the cap is still there; T21 gave it a second, smaller edge for the
    # copy that goes ON THE PAGE, keeping the original in IndexedDB
    assert "function shrinkImage(img,dataUrl,edge){" in out
    assert "var IMG_VIEW_EDGE=1600;" in out


def test_the_project_file_is_not_clobbered_by_a_second_window(out):
    """Every tab autosaves its ENTIRE view of every presentation 1.2s after
    each keystroke, and the server did a whole-array replace with no
    version -- so a second window continuously overwrote the first
    (2026-08-22). The client now echoes the revision it last saw."""
    assert "{presentations:body,rev:projectRev}" in out
    assert "if(e&&e.status===409&&e.data" in out
    # The merge keeps the click-time deck and takes everyone else's. It
    # must not rediscover pres.name after the request -- the user may have
    # renamed the live deck while the first write was in flight.
    assert "return !p||p.name!==savedName;});" in out
    assert "return p&&p.name===savedName;});" in out
    # api() has to carry the status and body, or there is nothing to merge
    assert "err.status=r.status;err.data=j;" in out


def test_a_rename_or_delete_does_not_strip_the_embedded_figures(out):
    """`projectPres` can never carry `emb` (normPres absorbs it into the
    session store), so posting it raw made a rename or a delete quietly
    strip every embedded figure out of junoview_project.json -- and the
    1.2s refs-only autosave, being the LAST writer, undid every manual
    embed a second after the next keystroke (2026-08-22)."""
    # ONE saveProject() helper owns the embedAssets save; rename and
    # delete (File menu and rail bins alike) route through it (2026-08-23)
    assert out.count(
        "APP.api('/api/save',{presentations:embedAssets(deep(projectPres))})"
    ) == 1
    assert "function saveProject(){" in out
    assert out.count("saveProject();") == 2
    # the idle consolidation that puts the figures back
    assert "function saveToProject(silent,embed){" in out
    assert "var body=(silent&&!embed)?merged:embedAssets(deep(merged));" in out


def test_pdf_export_prints_the_ink(out):
    """Chrome and Edge default "Background graphics" to OFF, and every
    colour in a deck is a CSS background -- so Export PDF on the default
    dark deck produced white pages with white text (2026-08-22)."""
    assert "print-color-adjust:exact!important;" in out
    assert "-webkit-print-color-adjust:exact!important;" in out
    # the generated documents name their language
    assert "<!doctype html><html lang=\\\"en\\\"><head>" in out \
        or '<html lang="en"><head><meta charset="utf-8">' in out


def test_the_review_is_not_preflight(out):
    """TASKS T35. `preflight` asks "will this print" -- per slide,
    physical, millimetres and dpi and contrast. This asks "does it hold
    together" -- deck-wide, editorial, about words and figures. Folding
    one into the other would give you a list where "0.2mm line" sits
    beside "slide 12 has 90 words on it" as if those were the same kind
    of problem.
    """
    assert "function deckReview(){" in out
    assert "function reviewLints(){" in out
    assert "function openReview(){" in out
    assert 'id="mi-review"' in out
    # and the panel says which list is which
    assert "is the other list" in out


def test_the_export_is_markdown_because_it_has_to_travel(out):
    """junoview is offline and stays offline; what travels is the words.
    Markdown because it pastes into anything, because a model reads
    structure out of it untold, and because a colleague can read it as
    it stands -- which is the difference between an export and a dump.
    """
    assert "L.push('# '+(pres.name||'Untitled deck'));" in out
    assert "L.push('### '+(i+1)+'. '+(revHeading(sl)||'(untitled)'));" in out
    assert "a.download=(pres.name||'deck')+'.review.md';" in out
    # in READING order, not storage order
    assert "orderedIdx(sl).forEach(function(j){" in out


def test_it_says_where_each_figure_came_from(out):
    """The part no other export of a deck can do: a deck knows its
    figures by notebook anchor, so the review says "the toe map, from
    demo::toe_map" rather than "[image]". Reviewing a talk without
    knowing which figure is which is reviewing it with the pictures cut
    out.
    """
    assert "function revFigLine(sl,a,map){" in out
    assert "bits.push('from '+a.ref);" in out
    assert "bits.push('pasted in, not from a notebook');" in out
    assert "bits[0]='Figure '+num+' \\u2014 '+bits[0];" in out \
        or "bits[0]='Figure '+num+' — '+bits[0];" in out


def test_a_private_item_does_not_travel_in_the_export(out):
    """T31's promise, kept in the one place that would have broken it
    twice: the body drops private items, and so does the HEADING --
    `filmText` names a slide by the first thing written on it, so a
    slide whose only text was an "only me" note would have been headed
    with that note. Caught in a browser, not by reading the code.
    """
    assert "if(!a||a.hide||a.priv) return;" in out
    assert "function revHeading(sl){" in out
    i = out.index("function revHeading(sl){")
    assert "if(!a||a.hide||a.priv||a.capOf) return;" in out[i:i + 600]


def test_two_spellings_of_one_thing_looks_at_words_and_at_pairs(out):
    """"sea-level" is one token and "sea level" is two, so a pass that
    only looked at single tokens found the hyphenated form and never the
    spaced one -- the two could never meet in a bucket. Both are
    collected, normalised by dropping hyphens, spaces and case.

    Forms differing only in the first letter's case are a sentence
    beginning, not an inconsistency, and are excluded -- which is why
    "The"/"the" is not reported.

    And there is NO minimum count: a first pass wanted three
    occurrences, which silently hid the commonest real case, the term
    said once each way. Both slips were found in a browser.
    """
    assert "function termKey(w){" in out
    assert "if(i+1<toks.length){" in out
    assert "if(termKey(pair).length>=6) surf(pair);" in out
    assert "return a!==b&&a.slice(1)!==b.slice(1);" in out
    assert "NO MINIMUM COUNT" in out


def test_each_lint_shows_what_it_counted(out):
    """A heuristic that will not show its working is one you cannot
    argue with. Every lint reports the numbers behind it: how many words
    and how many things on a dense slide, and how many times each
    spelling appeared.
    """
    assert "var DENSE_WORDS=55, DENSE_ITEMS=12;" in out
    assert "why:wc+' words and '+ic+' things on it." in out
    assert "return '\\u201c'+f+'\\u201d \\u00d7'+surfaces[k][f];" in out \
        or "'” ×'+surfaces[k][f]" in out


def test_a_position_lock_does_not_excuse_an_item_from_a_resize(out):
    """selRects filtered on pinned() for every caller, so the SIZE-only
    verbs skipped position-locked items too: "Match widths to the widest"
    silently left one out and said nothing about it -- a size verb
    refusing on the strength of a promise about where things are
    (2026-08-26 audit, T57).
    """
    assert "function selRects(sizeOnly){" in out
    assert "if(sizeOnly?lockedAll(a):pinned(a)) return null;" in out
    # TWO callers ask for the size-only reading: the verb, and the gate
    # that offers it. Everything else keeps the pinned filter it is
    # actually about. It was one, and the odd one out was the gate --
    # which meant the fix below could not be reached from the ribbon in
    # exactly the case it was written for (2026-08-30).
    assert "var items=selRects(true); if(items.length<2) return;" in out
    assert "show('#fmt-samewrap',selRects(true).length>=2);" in out
    assert out.count("selRects(true)") == 2
    # the MOVEMENT verbs must not have drifted onto it
    assert "selRects()" in out


def test_an_alt_click_that_never_moved_is_not_a_copy(out):
    """The clone is made on mousedown precisely so that it is the copy
    that travels. When the gesture turns out to be a click, that left an
    exact-overlap duplicate on top of its original -- nothing to see and
    no toast -- where Ctrl+D offsets by CLONE_OFF so a copy is never
    invisible (2026-08-26 audit, T57).
    """
    assert "var cloning=false,cloneIdx=null,selWas=selIdxs().slice();" in out
    assert "cloning=true;cloneIdx=clones.slice();" in out
    assert "if(cloning&&!movedAny&&cloneIdx&&cloneIdx.length){" in out
    # spliced from the back, or the second index is wrong by one
    assert ("cloneIdx.slice().sort(function(p,q){return q-p;})\n"
            "          .forEach(function(ci){ann.splice(ci,1);});") in out
    # the selection you had, back; and nothing to undo, because the
    # clone was made quietly in the first place
    assert "if(selWas.length) selectMany(layer,selWas);" in out
    assert "markDirty(true);\n        return;" in out


def test_speaker_notes_cost_one_undo_entry_not_one_per_keystroke(out):
    """Per-slide notes ride inside `slides`, so an un-quiet markDirty
    stringified every slide in the deck and pushed an undo entry for
    EACH KEYSTROKE -- filling the 50-entry stack with single characters
    and evicting the slide edits undo is for. markDirty's own comment
    describes the pattern; both notes inputs were simply not following
    it (2026-08-26 audit, T57).
    """
    # the overlay editor...
    assert ("if(ta.value.trim()) sl.notes=ta.value; else delete sl.notes;"
            in out)
    # ...and the pane, which is the same handler written twice
    assert "markDirty(true);presenterPush();" in out
    # the entry is taken when you leave: on close, on blur, and when the
    # editor walks to another slide
    assert "if(ov&&typeof histPush==='function') histPush();" in out
    assert ("ta.addEventListener('blur',function(){\n"
            "        if(typeof histPush==='function') histPush();});") in out
