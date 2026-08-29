"""The editing affordances a poster needs before anyone trusts it in print.

Everything here answers a specific way a real poster goes wrong: a typo that
nothing flagged, an item copied nowhere because there was no clipboard, edges
that never quite agreed, whitespace that was almost even, a figure that
printed soft. String pins against the built page; the behaviour was verified
out-of-band in a headless browser -- spellcheck reported ``true`` on canvas
text, a copy/paste took a poster from 20 items to 21, the pre-print check
found "inside the margin" on a real placement, and crop marks grew the
exported sheet to 851x1199mm while the page stayed exactly A0.
"""

from __future__ import annotations


def test_items_drag_from_their_body_not_a_handle(out):
    """A text box could only be moved by a small six-dot handle, because
    the words were editable on contact and clicking them put a caret in
    instead of picking the box up. Click to select and drag, DOUBLE-click
    to type -- and the handle, which also sat on top of the artwork you
    were trying to judge, is gone (2026-08-07, user: "just make it normal
    moving controls").
    """
    assert "function mkHandle" not in out
    assert "an-handle'" not in out          # nothing builds one any more
    assert "el.contentEditable='false';" in out
    assert "el.addEventListener('dblclick'" in out
    # everything drags from its body; only a box being typed in does not
    assert "if(!item.classList.contains('an-editing'))" in out
    assert ".deck.editing .an-text,.deck.editing .an-title{cursor:move;}" in out


def test_the_top_bar_names_what_it_belongs_to(out):
    """Buttons with a void beside them read as floating chrome. For a
    poster this is also the only place the name appears, since the panel
    that normally carries it is hidden.
    """
    assert 'id="deck-title"' in out
    assert "ti.textContent=(mode==='edit'&&pres&&pres.name)?pres.name:'';" in out
    # openDeck calls status() before the mode is set, so it runs again
    assert "if(!creating) renderSlide();\n    /* the bar's title" in out


def test_text_scales_with_the_page_at_every_zoom(out):
    """Text is a percentage of the page height, worked out from the layer
    when the annotations render. Zooming resized the page but never
    re-rendered them, so every text kept its old size and burst out of its
    box; and a hard 9px floor meant that at a small zoom the text stopped
    shrinking while its box carried on (2026-08-07, user: "when you zoom
    out the text fucks up"). Measured after the fix: 3% -> 4.1px,
    11% -> 15.8px, 22% -> 31.1px, nothing overflowing at any level.
    """
    assert "return Math.max(0.5,h*(size||2.6)/100)+'px';" in out
    assert "Math.max(9,h*(size||2.6)/100)" not in out
    # resizing the page has to re-render what is sized from it -- and that
    # now includes PLAYBACK, because line weight is page-relative too and a
    # poster presented full screen kept whatever the layer last measured
    # (2026-08-10). Since 2026-08-20 the guard is unconditional: 16:9
    # playback letterboxes too (text grew ~19% at 1400x900 because the
    # presented canvas took the WINDOW's shape), so every mode re-renders.
    assert "if(s0&&l0){" in out
    assert "if(mode==='edit') paintSel(l0);" in out


def test_insert_groups_by_what_a_tool_does(out):
    """Source order IS the layout once the rows fill across, so things you
    PLACE share the top row and things you DRAW share the bottom one --
    which is how Line and Arrow, the same tool with and without a head,
    end up beside each other (2026-08-07, user).
    """
    place = [out.index('data-tool="cell"'), out.index('data-tool="text"'),
             out.index('id="et-image"'), out.index('id="dc-qr"')]
    draw = [out.index('id="sh-btn"'), out.index('id="dc-line"'),
            out.index('data-tool="arrow"'), out.index('id="dc-draw"')]
    assert place == sorted(place), "the placing tools are out of order"
    assert draw == sorted(draw), "the drawing tools are out of order"
    assert max(place) < min(draw), "placing and drawing tools are interleaved"
    # Draw comes AFTER Arrow, not between Line and Arrow: the side rail
    # pairs from source order, and the newcomer briefly split the
    # Line+Arrow pairing kept since 2026-08-07 -- Line+Draw shared a line
    # and Arrow sat orphaned under them (2026-08-18)
    # Objects is a way of LOOKING at the page, so it lives in the View
    # group -- asserted by CONTAINMENT, because View precedes Insert in
    # the markup and is moved after it by CSS order, so source position
    # says nothing about where it appears
    view = out.split('class="rbn-grp rbn-fixed rbn-view"')[1].split(
        ">View</span>")[0]
    assert 'id="objects-btn"' in view


def test_a_poster_is_not_told_it_has_slides(out):
    """A poster is ONE PAGE to work on, so none of the DECK machinery
    applies: no permanent thumbnail strip, no slide counter, no step
    arrows, no slide numbering, and no Auto-build (which makes one slide
    per figure and would turn a poster into seven).

    A poster may still have more than one page -- a draft, a variant --
    but they are "versions", reached from a button rather than a panel
    that dominates a page this big (2026-08-07, user: "having slides for
    posters is ok, but the view doesn't need to be dominant").
    """
    # nothing deck-shaped is on screen by default
    assert ".deck.poster-page .dc-film{display:none!important;}" in out
    assert ".deck.poster-page .deck-count{display:none!important;}" in out
    assert ".deck.poster-page .deck-arrow{display:none!important;}" in out
    # the group is called Page, and only a deck is told about slides
    assert "slideLab.textContent=pg.poster?'Page':'Slide';" in out
    assert "if(nums) nums.hidden=!!pg.poster;" in out
    # ...and a poster cannot GAIN pages through auto-build
    assert "['#mi-auto-figs','#mi-auto-figdocs'].forEach" in out
    # all of it keyed on the page, so switching back to 16:9 restores it
    assert "deckEl.classList.toggle('poster-page',!!pg.poster);" in out
    # the versions strip is opt-in, and named for what it holds -- it now
    # opens in the same floating pane the Objects list uses (2026-08-10)
    assert 'class="selpane verpane" id="verpane"' in out
    assert "add.textContent=pg.poster?'+ Create new version':'+ Add slide';" in out


def test_spellcheck_is_on_for_editable_text(out):
    """It used to be off everywhere, so a typo could travel all the way to
    a printed A0 poster with nothing ever flagging it. Only editable text
    is checked, so Present and every export stay squiggle-free.
    """
    assert "el.spellcheck=true;" in out
    assert "el.spellcheck=false" not in out


def test_copy_cut_paste_including_images_from_the_clipboard(out):
    """Ctrl+D duplicates in place, which cannot carry an item to another
    poster and cannot bring anything in. Paste rides the real paste event
    so a screenshot or logo on the system clipboard lands on the page.
    """
    assert "function copySel" in out and "function cutSel" in out
    assert "function pasteBuf" in out and "function pasteImageFile" in out
    assert "document.addEventListener('paste'" in out
    assert "items[i].type.indexOf('image/')===0" in out
    # a pasted group is its own NEW group, rather than joining the source
    # or falling apart into unrelated items
    assert "var copies=independentCopies(clipBuf,s,clipGrpMeta);" in out
    assert "delete cp.grp;" not in out
    # typing into a text box must still paste text, not an annotation
    assert "e.target.isContentEditable) return;" in out


def test_align_and_distribute_measure_the_visual_rect(out):
    """Row and Grid re-arrange into a formation; aligning leaves items
    where they are and makes one edge agree. Equal GAPS, not equal
    centres -- with different-sized items it is the whitespace the eye
    measures.
    """
    assert "function alignSel" in out and "function distributeSel" in out
    for edge in ("left", "right", "hcenter", "top", "bottom", "vmiddle"):
        assert f"edge==='{edge}'" in out, edge
    assert "var gap=(span-sum)/(items.length-1);" in out
    assert 'wireFloatDropdown(\'fmt-alignwrap\'' in out
    assert 'id="fmt-align-menu"' in out


def test_equal_gap_guides_while_dragging(out):
    """Only items on the same band count as neighbours, and an edge snap
    beats a gap snap: agreeing with a line is a stronger intention than
    matching a distance.
    """
    assert "function bestGap" in out and "function gapCands" in out
    assert "function drawGapMarks" in out
    assert "var overlap=horiz?(r.b>bb.t&&r.t<bb.b):(r.r>bb.l&&r.l<bb.r);" in out
    assert "if(!bx){" in out and "if(!by){" in out


def test_custom_guides_belong_to_the_presentation(out):
    """Dragged off a ruler, dropped back on it to delete, and saved with
    the poster -- a guide you had to redraw every session is a chore.
    """
    assert "function customGuides" in out and "function startGuideDrag" in out
    # written through ONE builder, because a guide DRAG rewrites
    # pres.guides live on every mousemove -- a drag that forgot a
    # field would quietly delete every guide of the kind it forgot
    # (T4's guide boxes nearly were born that way)
    assert "function liveGuides(g){" in out
    assert "if(pres) pres.guides=liveGuides(cg);" in out
    assert "if(v==null||v<0||v>100){cg[axis].splice(idx,1);}" in out
    # the ruler bars take clicks; the rest of the overlay stays transparent
    assert ".ruler{position:absolute;" in out and "pointer-events:auto;}" in out


def test_fonts_come_from_one_table(out):
    """The picker, the canvas CSS and the .pptx writer all read the same
    list, so they cannot drift; an unlisted value is a family you typed
    and passes through to both the browser and PowerPoint.
    """
    assert "var FONTS=[" in out
    assert "function fontCss" in out and "function fontPpt" in out
    assert "FONTS.forEach(function(f){FONTMAP[f.id]=f.css;" in out
    for fam in ("Arial", "Helvetica", "Georgia", "Garamond", "Verdana"):
        assert fam in out, fam
    assert "value=\"__custom\"" in out
    assert "font:fontPpt(a.font)" in out          # the pptx writer agrees


def test_preflight_composes_signals_that_already_existed(out):
    """The dpi judgement, the margin, the page bounds and the page
    background were all already known. What was missing was one place
    that asks them all at once.
    """
    assert "function preflight" in out
    assert "function contrast" in out and "function relLum" in out
    assert "runs off the page" in out
    assert "is inside the margin" in out
    assert "Text is hard to read" in out
    assert "Empty frame" in out
    assert "$$('.dpi-warn',slideEl)" in out       # reuses the existing chip
    assert 'id="vw-check"' in out and 'id="preflight"' in out
    # 4.5:1 is the WCAG AA threshold
    assert "cr<4.5" in out


def test_crop_marks_grow_the_sheet_not_the_page(out):
    """An A0 poster must stay 841x1189mm whether or not trim marks are
    asked for; the marks need somewhere to live, so the SHEET grows.
    """
    assert "BLEED_MM=5" in out
    assert "var sheetW=pg.mm[0]+2*bleed,sheetH=pg.mm[1]+2*bleed;" in out
    assert "'@media print{@page{size:'+sheetW+'mm '+sheetH+'mm;'" in out
    assert 'id="mi-crop"' in out and "pres.cropMarks" in out
    assert "cropmark cm-" in out
    # always black: an instruction to a machine, not part of the design
    assert ".cropmark::before,.cropmark::after{content:\"\";" in out


def test_a_guide_box_is_never_an_annotation(out):
    """TASKS T4. A guide LINE answers "is this edge where I said"; a guide
    BOX answers "does this belong in this area at all" -- a title band, a
    figure well, the column a poster's text must stay inside.

    The load-bearing part is that a guide is not an annotation. It forks
    off BEFORE startDraw, whose whole job is building s.annots entries,
    so there is nothing in the document model to remember to exclude: a
    guide cannot reach a render, a PDF, a .pptx or a saved standalone
    page through somebody forgetting a filter. The CSS says the rest.
    """
    assert "function startGuideBox(layer,p0){" in out
    assert "if(tool==='guide'){\n        startGuideBox(layer," in out
    assert "table:1,flip:1,guide:1};" in out
    # nothing about a guide is an annot kind
    assert "k:'guide'" not in out
    # ...and the exclusions it inherits by living in .cguides
    assert ".deck:not(.editing) .cguides{display:none;}" in out
    assert "@media print{.pgrid,.rulers,.cguides{display:none!important;}}" \
        in out
    assert "#print-root .cguides{display:none!important;}" in out


def test_a_guide_box_is_click_through_except_at_its_edges(out):
    """A guide box is mostly empty middle. One clickable rectangle would
    swallow every click on the canvas underneath it -- which, for a box
    drawn round the figure well, is most of the page. Edge strips,
    corners and the move grip listen; nothing else does.
    """
    assert ".cg-box{position:absolute;pointer-events:none;" in out
    assert ".cg-edge{position:absolute;pointer-events:auto;}" in out
    assert ".cg-corner{position:absolute;pointer-events:auto;" in out
    # the grip sits ABOVE the top edge, never over the area you are
    # laying out inside -- that middle has to go on taking clicks
    assert ".cg-grip{position:absolute;pointer-events:auto;cursor:move;" in out
    assert "left:50%;margin-left:-9px;top:-11px;" in out
    assert "var GB_SIDES=['t','r','b','l'],GB_CORNERS=['tl','tr','bl','br'];" \
        in out


def test_each_guide_box_handle_resizes_its_own_side(out):
    """T4 shipped a box that could be moved and never resized: all four
    strips ran startGuideBoxMove, so the only way to change one was to
    delete it and draw it again (2026-08-26 audit, T52).

    Each handle now names the coordinates it owns in ``data-side``, and
    'l' has to rewrite x AND w together or dragging the left edge would
    walk the right one along with it.
    """
    assert "function startGuideBoxResize(ev,i,side){" in out
    assert "var west=side.indexOf('l')>=0,east=side.indexOf('r')>=0;" in out
    assert "if(west){b[0]=o[0]+dx;b[2]=o[2]-dx;}" in out
    assert "if(north){b[1]=o[1]+dy;b[3]=o[3]-dy;}" in out
    # the cursor says which way each one goes -- one cursor:move on all
    # four was the tell that all four did the same thing
    assert ".cg-e-t{left:0;right:0;top:-4px;height:8px;cursor:ns-resize;}" \
        in out
    assert ".cg-c-tl{left:-5px;top:-5px;cursor:nwse-resize;}" in out
    # ...and MOVING still exists: the grip is the door, Alt/Shift the
    # shortcut, and the dispatcher is the one place that decides
    assert "if(sd==='move'||e.altKey||e.shiftKey) startGuideBoxMove(e,gi);" \
        in out
    assert "else startGuideBoxResize(e,gi,sd);" in out
    # a side pulled through its opposite must not reach the model as a
    # negative width -- it would draw nothing and snap to the wrong line
    assert "function gbNorm(b){" in out
    assert "if(w<0){x+=w;w=-w;}" in out
    # pulled shut is the same as drawn too small: gone, not un-grabbable
    assert "if(b[2]<GBOX_MIN||b[3]<GBOX_MIN) cg.b.splice(i,1);" in out


def test_a_guide_box_says_how_big_it_is_while_you_drag_it(out):
    """A guide box on a poster is a physical area -- "the figure well is
    380mm across" -- and that number was only knowable by drawing the box
    and then measuring it against the ruler.
    """
    assert "function gbTip(i,b,kind){" in out
    # the page's own millimetres, the units the rulers already speak
    assert "var mm=pageOf().mm;" in out.split("function gbTip(")[1][:600]
    # size while resizing, position while moving
    assert "gbTip(i,cg.b[i],'pos');" in out
    # live only: four permanent labels would shout over the layout
    assert "function gbTipClear(){" in out
    assert ".cg-tip{position:absolute;left:2px;top:2px;pointer-events:none;" \
        in out


def test_a_guide_box_snaps_and_puts_the_tool_back(out):
    """Lining things up with a guide is the entire reason for drawing one,
    so its edges AND its middles join the snap targets.

    The tool disarms itself after one box: a guide is furniture you put
    down, not a mode to live in, and a tool that stays armed is a tool
    that gets left armed.
    """
    assert "xs.push(v[0],v[0]+v[2]/2,v[0]+v[2]);" in out
    assert "ys.push(v[1],v[1]+v[3]/2,v[1]+v[3]);" in out
    assert "setCustomGuides(cg);drawCustomGuides(slideEl);gbTipClear();\n" \
        "      /* one box, then back to selecting." in out
    # a drag under the threshold was a click, and leaves nothing behind
    assert "if(box[2]<GBOX_MIN||box[3]<GBOX_MIN) cg.b.splice(idx,1);" in out
    # dropped with its middle off the page: the line guides' delete
    # gesture, not a second one to learn
    assert "if(cx<0||cx>100||cy<0||cy>100) cg.b.splice(i,1);" in out
    # FOUR doors now, and the ribbon button is the one anybody finds:
    # the ruler corner lives inside #rulers, so it does not exist at all
    # unless Rulers are on (2026-08-26 audit, T52)
    assert 'id="vw-guidebox"' in out and 'data-tool="guide"' in out
    assert "function armGuideBox(){" in out
    assert "if(mode==='edit') setTool('guide');" in out
    assert "if(rc) rc.addEventListener('click',armGuideBox);" in out
    assert "row('Draw a guide box','B',armGuideBox," in out
    assert "function clearGuides(boxesOnly){" in out


def test_clearing_every_guide_asks_first_and_is_undoable(out):
    """One unconfirmed click took every guide on the poster, and guides
    were outside the undo snapshot, so there was no way back at all
    (2026-08-26 audit, T52). Both halves, or neither is enough.
    """
    # undo reaches them: recorded...
    assert "guides:pres.guides||null," in out
    # ...and restored, in the same array as every other deck-level key
    assert "'guides','page','pageBg','cropMarks'].forEach(function(k){" in out
    # the guide layer caches the signature it last drew, so an undo has
    # to ask it again or the restored model is invisible
    assert "if(typeof syncGuides==='function') syncGuides();" in out
    # ...and the question is asked above one, not for a click you can
    # obviously just repeat
    assert "if(n>1&&!confirm('Clear '+n+' guides?" in out
    assert "Ctrl+Z brings them back.')) return;" in out


def test_guides_can_be_hidden_without_being_deleted(out):
    """There was no show/hide toggle short of permanent deletion, which
    made "get these out of my way for a minute" mean "delete them"
    (2026-08-26 audit, T52).
    """
    # a view flag beside rulers and grid, defaulting ON -- your own
    # guides are things you drew, not furniture you asked for
    assert "var guides={rulers:false,grid:false,side:false,custom:true};" \
        in out
    assert "if('custom' in _g) guides.custom=!!_g.custom;}" in out
    assert "function guidesShown(){ return guides.custom!==false; }" in out
    # BOTH halves: hidden guides neither draw...
    assert "if(mode!=='edit'||!guidesShown()||guidesEmpty(cg)){" in out
    # ...nor snap. An invisible line that still pulls items onto itself
    # is worse than either state.
    assert "var cg=guidesShown()?customGuides():{x:[],y:[],b:[]};" in out
    # the same ribbon wiring Rulers and Grid use, and a key of its own
    assert 'id="vw-guides"' in out
    assert "if(cgv) cgv.setAttribute('aria-pressed',guidesShown()" in out
    assert "var hb=$('#vw-guides'); if(hb) hb.click();" in out
    # arming the tool un-hides what it is about to draw -- once, in
    # setTool, so every door onto it is covered
    assert "if(t==='guide') showCustomGuides(true);" in out


def test_a_guide_box_alone_still_gets_a_layer_to_draw_in(out):
    """Found in the browser, 2026-08-25, and invisible to every test
    here: "are there any guides at all" was asked in two places that did
    not agree. setCustomGuides counted boxes; drawCustomGuides counted
    only the LINES, so a page with guide boxes and no lines tore its own
    .cguides layer down and drew nothing at all.

    That is the common case -- draw a box, never touch a ruler -- so T4
    shipped broken. One function answers it now, which is the only shape
    of fix that cannot drift apart again.
    """
    assert "function guidesEmpty(g){" in out
    assert "return !g.x.length&&!g.y.length&&!g.b.length;" in out
    assert "if(guidesEmpty(g)) delete pres.guides;" in out
    assert "if(mode!=='edit'||!guidesShown()||guidesEmpty(cg)){" in out
    # the old one-sided test is gone
    assert "(!cg.x.length&&!cg.y.length)" not in out


def test_your_guides_survive_being_re_opened(out):
    """normPres REBUILDS the deck field by field, so a deck-level key it
    does not name does not survive. `guides` was named in histRestore's
    key list and not in normPres's, twelve lines of code away -- so a
    guide survived Ctrl+Z and survived the localStorage draft, and
    vanished the moment the deck was re-opened from the saved copy, the
    project file or a loaded JSON.

    T4 shipped that; T52 made it worse by putting guides in the undo
    snapshot and writing a comment saying they belong to the deck. This
    is the sixth instance of the bug class tests/test_deck_schema_parity
    exists to catch -- and it could not catch this one, because it
    derives its expectation FROM normPres, which was missing the key too
    (2026-08-29).
    """
    assert ("['wmark','head','foot','styles','tokens',\n"
            "     'components','cuts','guides'].forEach(function(k){") in out
