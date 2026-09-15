"""T385: three more entrances, motion that keeps going, highlight builds
and two more page turns (2026-09-12, user: "the big thing in websites is
people having cool animations ... page turn or it flies in and moves the
other out of the way; things wobbling and moving; text typing out like a
type writer; instead of having text come out one at a time, one dot point
is highlighted so you can still have all text out").

Driven in Chromium: Typewriter on the title typed "Southern He" 150ms
after the click and finished whole; Float put .an-move-bob on the item
in the show and nothing on it in the editor.
"""

from __future__ import annotations

from junoview.notebook.deck_schema import ANNOT_COMMON


def test_the_effect_table_has_the_three_new_ways_in(out):
    assert "['slide','Fly in','L'],['turn','Page turn','P']," in out
    assert "['type','Typewriter','T']];" in out
    # each has a literal icon (the icon contract scans for these)
    for t, ic in (("slide", "flyin"), ("turn", "pageturn"),
                  ("type", "typewriter")):
        assert f"if(t==='{t}') return bic('{ic}');" in out, t
    # the keyframes obey the two rules: individual properties, no `to`
    assert "@keyframes anIn-slide{from{opacity:0;translate:-60px 0}}" in out
    assert "@keyframes anIn-turn{from{opacity:.2;scale:.05 1}}" in out
    # the pane names an effect off the same table (T402: it has no list
    # of its own any more)
    assert "      var w='';SEQ_FX.forEach(function(f){if(f[0]===t) w=f[1];});" in out


def test_the_typewriter_types_in_place_and_puts_every_word_back(out):
    assert "  function typeInto(el,part){" in out   # T471: one piece, or all
    assert "  function typeStop(){" in out
    # the model is never split: text NODES are emptied and refilled
    assert "document.createTreeWalker(root,NodeFilter.SHOW_TEXT)" in out
    assert "    typeRun.nodes.forEach(function(n){n.node.textContent=n.text;});" in out
    # T471: a pace you can watch (30 a second), bounded at four seconds
    assert "  var TYPE_TICK=33,TYPE_MAX_MS=4000,TYPE_MIN_MS=1200;" in out
    assert ("    var per=Math.max(1,Math.ceil(total/(TYPE_MAX_MS/TYPE_TICK))),"
            "shown=0;") in out
    # words only -- on anything else it plays as a fade
    assert "            atype=(atype==='type'&&ba.k!=='text')?'fade':atype;" in out
    assert ("            if(atype==='type'&&typeof typeInto==='function'\n"
            "               &&!(typeof storyPaint!=='undefined'&&storyPaint))\n"
            "              typeInto(el,(typeof textBy==='function'&&textBy(ba)\n"
            "                &&!ba.anim.hl)?0:undefined);") in out
    # ...and each later bullet types on its own click
    assert "                typeInto(el,j);" in out
    # a stale run is stopped when the element leaves the page
    assert "      if(!el.isConnected){typeStop();return;}" in out


def test_motion_keeps_going(out):
    # T465: every movement is on the shelf, built from the panel's own
    # MOTIONS list beside the four markup tiles, so the door always has
    # a readout
    assert "  var MOTION_FX=[['','None']];" in out
    assert "    MOTIONS.forEach(function(m){MOTION_FX.push([m[0],m[1],m[4]]);});" in out
    assert ("        b.type='button';b.className='fx-tile';"
            "b.id='anim-move-'+pr[0];") in out
    for cid in ("anim-move-none", "anim-move-wobble", "anim-move-bob",
                "anim-move-pulse"):
        assert f'id="{cid}"' in out, cid
    assert '<span class="rbn-grp rbn-motion rbn-compact" data-tab="animation"' \
        in out
    # T453: Leaves early keeps rung 3, Motion moved to 4
    assert ".rbn-motion{order:4;}" in out
    # the class goes on in a pass of its own (T446: in the editor too)
    assert "    if(s.annots&&s.annots.some(function(a){" in out
    assert "          el.classList.add('an-move-'+ma.motion);" in out
    # T445: and the numbers on it
    assert "          if(typeof motionPaint==='function') motionPaint(el,ma);" \
        in out
    # infinite keyframes on individual properties, so a rotation survives
    # T445: how far is a number the keyframe multiplies by
    assert ("@keyframes an-wobble{0%,100%{rotate:calc(-2.5deg * "
            "var(--mo-amp,1))}") in out
    assert ".an-move-bob{animation:an-bob 2.6s ease-in-out infinite;}" in out
    # written down
    assert "motion" in ANNOT_COMMON
    # booted from the boot sequence, never mid-file
    assert "  motionBoot();" in out


def test_highlight_lights_a_piece_instead_of_hiding_the_rest(out):
    assert 'id="anim-by-hl"' in out
    # (T401: a box with no entrance gets one on the way)
    assert ("        else {var an=ensureAnim(s,a,no);an.hl=1; "
            "if(!an.by) an.by='para';}") in out
    # whole-box takes the highlight with it: no pieces, nothing to light
    assert "        else if(a.anim){delete a.anim.by;delete a.anim.hl;}" in out
    # the renderer keeps every piece visible and marks the current one
    assert "              pe.style.visibility=(wait&&!hl)?'hidden':'';" in out
    assert "                pe.classList.toggle('an-hl',jp===revealCount-1);" in out
    assert "                pe.classList.toggle('an-hl-wait',wait);" in out
    # T471: the highlight configured -- the lit piece's look and the rest's
    assert ("                pe.classList.toggle('an-hl-rest',"
            "jp!==revealCount-1);") in out
    assert '.an-item[data-hlrest="blur"] .an-part.an-hl-rest{filter:blur(2.5px);' in out
    assert ".an-part.an-hl{color:var(--accent,#39a9c0);scale:1.04;" in out
    # four tiles, so that strip is four wide
    assert "width:calc(4 * var(--rbn-tile-w) + 3 * var(--rbn-tile-gap) + 8px);}" in out


def test_a_flip_book_page_can_turn_or_push(out):
    assert "    ['turn','Page turn'],['push','Push']];" in out
    assert 'id="anim-flip-turn"' in out and 'id="anim-flip-push"' in out
    assert "@keyframes fturn-push{from{transform:translateX(100%);}" in out
    assert "  transform:perspective(900px) rotateY(-85deg);}" in out


def test_a_focus_is_a_click_of_its_own(out):
    """T472 (2026-09-15, user: "blur everything else but this", "zoom in
    here", "show magnify of this box"). A focus is a peer of `anim` like
    the exit: it claims a stop, it plays on that one stop, and the next
    click puts the slide back. Three effects, one ribbon strip, a section
    in the Configure panel with the click it goes on, a row in the Order
    tab, and Remove all clears it."""
    assert "  function animFocus(a){" in out
    assert "  function animFocusing(s,a){" in out
    assert "    return revealCount===sp+1;" in out
    # the model: at + fx, fx one of the three
    assert "  var FOCUS_FX=[" in out
    for fx in ("['spot','Blur the rest',", "['zoom','Zoom in',", "['lens','Magnify',"):
        assert fx in out
    # a claim on a stop, and the next free order counts it
    assert "      if(f&&!(f.at in seen)) seen[f.at]=1;});" in out
    assert "      var f=animFocus(a); if(f&&f.at>mx) mx=f.at;});   /* T472 */" in out
    # painted by the reveal pass on its stop; the stage zoom settles after
    assert "          focusPaint(layer,el,ba);" in out
    assert "    if(typeof focusSettle==='function') focusSettle(layer);" in out
    # the three paints
    assert ("      requestAnimationFrame(function(){"
            "layer.classList.add('an-spotlit');});") in out
    assert "      requestAnimationFrame(function(){stage.style.transform=tf;});" in out
    assert "      c.classList.add('an-lens');" in out
    # the ribbon strip, four wide, with a hover preview; the caption wears the click
    assert 'id="anim-focus-strip"' in out
    for k in ("none", "spot", "zoom", "lens"):
        assert f'id="anim-focus-{k}"' in out
    assert ".strip-frame>#anim-focus-strip.trans-strip{" in out
    assert "      say.textContent=f?('on click '+(((sp==null?st:sp)|0)+1)):'';" in out
    assert "  function focusPreview(fx){" in out
    # the panel's section and its when-rows; the Order tab's row; Remove all
    assert "    cfgHead(host,'focus, on a click');" in out
    assert "    cfgChip(row,bic('locate'),'On a click of its own',own," in out
    assert "        if(f) exits.push({i:i,a:a,o:f.at,kind:'focus',f:f});});" in out
    assert "        if(animFocus(a)){delete a.focus;nf++;}   /* T472 */" in out
    # the show's CSS: the rest soften, the stage moves, the lens floats
    assert ".annot-layer.an-spotlit .an-item:not(.an-spot):not(.an-lens){" in out
    assert ".deck-stage{transition:transform .55s cubic-bezier(.2,.7,.2,1);}" in out
    assert ".an-item.an-lens{pointer-events:none;z-index:30;opacity:0;" in out
    assert "  focusBoot();                /* T472: focus, on its click */" in out


def test_a_figure_arrives_panel_by_panel(out):
    """T473 (2026-09-15, user: "people like to reveal panel by panel in
    figures ... people usually have to have white boxes that disappear").
    A grid of covers in the page's colour over a figure or a picture, one
    lifted per click -- the model is never cut, the covers are drawn at
    render time like the text pieces, and every panel is a click on the
    one plan."""
    assert "  function panelsOf(a){" in out
    assert "    if(a.k!=='cell'&&a.k!=='image') return null;" in out
    assert ("    var m=/^([1-6])x([1-6])$/.exec("
            "String(a.anim.grid||'2x1'));") in out
    assert "  function pieceCount(a){" in out
    assert "  function panelCovers(el,a,bg){" in out
    assert "  function panelPaint(el,a,s,st,plan,editing,storyK){" in out
    # the plan counts panels the way it counts bullets
    assert "      var n=(typeof pieceCount==='function')?pieceCount(a)" in out
    # painted in the editor (faint, numbered) and in the show (lifted per click)
    assert ("          if(typeof panelPaint==='function') "
            "panelPaint(el,ba,s,st,plan,true,storyK);") in out
    assert ("          if(typeof panelPaint==='function') "
            "panelPaint(el,ba,s,st,plan,false,null);") in out
    assert "      var covered=(!editing&&mode==='view'&&jp>=revealCount)" in out
    # the strip of grids beside the text strip, the panel's chips and sliders
    assert 'id="anim-panels-strip"' in out
    assert ("    var PANEL_GRIDS=[['1x1','Whole figure',"
            "'On one click, all of it'],") in out
    assert "      if(pf) pf.hidden=poster||armed||!st.fig;" in out
    assert "        :(st.fig?'Timing & panels':'Timing');" in out
    assert ("        cfgRange(host,'Across',g.c,1,6,1,"
            "function(v){return String(v);},") in out
    # the Order tab names the panels; the story strip counts them
    assert ("              for(var q3=0;q3<g.c*g.r;q3++) "
            "o.push('Panel '+(q3+1)+' of '+(g.c*g.r));") in out
    assert "              :textPieceCount(a);   /* T473: panels too */" in out
    # the CSS: covers down in the show, outlines in the editor
    assert ".an-cover.on{display:flex;}" in out
    assert (".an-cover.an-cover-edit{display:flex;"
            "background:transparent!important;") in out


def test_a_clone_can_be_added_with_nothing_selected(out):
    """T474 (2026-09-15, user: "I go to another slide, then click 'add a
    clone' and it would also be there. But that didn't seem to work").
    Add a clone… needs a clone selected, and on the other slide there is
    none: Images > Place > Clone… lists the sets and puts one here."""
    assert 'id="et-clone"' in out
    assert "  function cmpPickMenu(btn){" in out
    assert "  function cmpDoorSync(){" in out
    assert "        var k=cmpPlace(c.id,null,cur,null,false);" in out
    # greyed until a set exists; wakes with the first set and on every render
    assert ("    cmpDoorSync();   /* T474: the Clone… door wakes with the "
            "first set */") in out
    assert ("      if(mode==='edit'&&typeof cmpDoorSync==='function') cmpDoorSync();"
            "   /* T474 */") in out
    # the ribbon layouts keep it beside the flip book
    assert "'et-flip','et-clone'" in out
    # Home: Save version last; the flip book's doors say what they add
    assert ".rbn-vers{order:9;}" in out
    assert "&#43; Notebook figures&#8230;</button>" in out


def test_the_editor_asks_its_own_questions(out):
    """T475 (2026-09-15 review: three of the Layout group's doors used the
    browser's native prompt()). Thirty-six of them did, across the
    editor: one dialog on the .aa-dlg shell asks every one now, and the
    word prompt( appears nowhere in the deck's code but its comment."""
    assert "  function askText(o,cb){" in out
    assert 'id="ask-dlg"' in out and 'id="ask-in"' in out and 'id="ask-area"' in out
    # its keys are its own even over a menu: window capture, before the
    # overlay owner's document capture
    assert ("    window.addEventListener('keydown',function(e){"
            "\n      if(dlg.hidden) return;") in out
    # the old box is gone from the editor: every prompt( left in deck.js
    # is inside a comment
    from junoview import assets
    deck = assets.deck_js()
    body = "\n".join(ln for ln in deck.split("\n")
                     if not ln.lstrip().startswith(("*", "/*", "//")))
    assert "prompt(" not in body
    # the layout's word is the ribbon's (T194), not "arrangement"
    assert "Call this arrangement" not in out
    assert "label:'Call this layout'" in out


def test_presenter_view_from_inside_the_show_and_late_from_the_presenter(out):
    """T476 (2026-09-15 review). The presenter window could only be opened
    before F5; the window that says you are behind had no Running late."""
    assert 'id="talk-presenter"' in out
    assert "    if(k==='n'||k==='N'){" in out
    assert "      if(typeof openPresenter==='function') openPresenter();" in out
    assert "+'<button class=\"jvp-b\" id=\"jvp-late\" aria-pressed=\"false\">'" in out
    assert "    else if(msg.do==='late'){   /* T476 */" in out
    assert "      lb2.textContent=lateOn?'Running late: on':'Running late';" in out


def test_which_version_is_a_chooser_on_the_present_tab(out):
    """T477 (2026-09-15 review). The version to play was only in the Play
    menu; the Present tab has a compact chooser now, one tile per
    version, built from the same list, and one sync redraws both."""
    assert 'id="pr-version-strip"' in out and 'id="pr-newversion"' in out
    assert ".rbn-version{order:2;}" in out
    assert "    function versionStripSync(){" in out
    assert "    cutsSync=function(){syncCuts();versionStripSync();};" in out
    # the stub is declared BEFORE the menu's sub-IIFE assigns it
    assert out.index("  var cutsSync=function(){};") < out.index(
        "    cutsSync=function(){syncCuts();versionStripSync();};")
    # renameCut and renderFilm redraw both doors
    assert "    cutsSync();   /* T477: the menu and the tab's strip */" in out
    assert "    if(typeof cutsSync==='function') cutsSync();" in out


def test_a_master_is_chosen_from_swatches_and_pressed_runs(out):
    """T478 (2026-09-15 review). The master panel typed a hex into a
    prompt and cycled Furniture / Corner by clicking a row with no list."""
    assert "        bgChips(chips,m.bg||'',function(v){" in out
    assert "        opt(run,'None',!m.cmp,'Nothing drawn behind the wearers'," in out
    assert "          none.textContent='No clone sets yet " in out
    assert "          lab3.textContent='where it sits';" in out
    assert "Click to cycle through the deck" not in out


def test_background_is_a_chooser_on_the_shelf(out):
    """T479 (2026-09-15 review). Background was the one Design chooser
    still in a pop-up over the slide, with no readout and 22 unlabelled
    swatches. A compact door wearing this slide's answer; the rows on the
    shelf; every swatch named."""
    assert '<span class="rbn-grp rbn-slide rbn-compact" data-tab="design"' in out
    assert 'id="bg-run-this"' in out and 'id="bg-run-every"' in out
    assert 'id="bg-run-border"' in out and 'id="bg-run-bcol"' in out
    assert "  function bgSync(){" in out
    assert ("      if(mode==='edit'&&typeof bgSync==='function') bgSync();"
            "   /* T479 */") in out
    # the door wears the answer the feature says, and the observer hears it
    assert ("    if(g.hasAttribute('data-say')) "
            "txt=g.getAttribute('data-say')||'';") in out
    assert "attributeFilter:['aria-pressed','disabled','data-say']" in out
    assert "        g.setAttribute('data-say',name+(bw?' \\u00b7 border':''));" in out
    # the border's colours say their names; the verb says what it does
    assert "  var BG_BORDER_COLS=[['#39a9c0','Teal'],['#ff6b57','Coral']," in out
    assert "Make every slide match this one" in out
    assert "wireMenuToggle('bg-drop','bg-btn','bg-menu')" not in out


def test_the_type_and_colour_model_after_the_second_pass(out):
    """T480 (2026-09-15, the second review pass). Eight things the styles
    model got wrong, each verified by driving."""
    # a heading-styled box wears the deck's Heading text colour
    assert "             &&isHeadingStyle(a.style))?' an-head':'');" in out
    assert ".an-text.an-head{color:var(--tk-heading,#f0f6fa);}" in out
    # the resolver's defaults follow the page
    assert "  function tokDefaults(){" in out
    assert "    var dd=tokDefaults();" in out
    # the quiet greys are the role
    assert "    caption:{label:'Caption',    size:1.7, i:1, color:'@quiet'}" in out
    assert "      :{x:50,y:58,size:2.6,color:'@quiet'};" in out
    assert "color:'#9aa8b4'" not in out and "color:'#7f93a4'" not in out
    # a renamed built-in keeps its name through +, Bigger, a set and an update
    assert ("            over.label=d.label;   "
            "/* T480: the name you gave it stays */") in out
    assert "      over.label=d.label;   /* T480 */" in out
    assert "      if(STYLE_DEFAULTS[k]) o.label=styleDef(k).label;" in out
    # Update the style from this box goes through the one promoter
    assert "        promoteStyleFromBox(a3,true);" in out
    # the colour inputs show what a deck colour resolves to
    assert ("      ci.value=(v&&v!=='none'&&/^#[0-9a-f]{6}$/i.test(rv))"
            "?rv:fallback;") in out
    # the check resolves the page's ink through the resolver
    assert "  function stdInk(){\n    return tokVal('@ink');\n  }" in out
    assert "    var a=rgbOf(tokVal(c1)),b=rgbOf(tokVal(c2));" in out
    assert ("        if(inner.mode===stdInk()) delete a.color; "
            "else a.color=inner.mode;}") in out


def test_selection_and_object_after_the_second_pass(out):
    """T481 (2026-09-15, the second review pass): eight selection and
    Object-tab bugs, each driven."""
    # a typed X/Y/W/H is a committed edit, so a place-linked set follows
    assert "          /* T481: a COMMITTED edit, like the drag's end" in out
    # a duplicate of a place-linked clone is a free object
    assert "        delete cp.cmp;delete cp.ci;delete cp.cinst;freed++;}" in out
    # one answer for the whole selection: B/I/U/S and the lock
    assert "  function setFromPrimary(key){" in out
    assert "    var pin=!(a0&&lockMode(a0)==='pos');" in out
    # the ribbon's lock readout follows the menu and the pane
    assert "    showFmt();   /* T481: the ribbon's Lock in place reads" in out
    assert "showFmt();   /* T481: the ribbon's readout */" in out
    # a hidden thing is not selected
    assert "      if(flag==='hide'&&a2.hide&&selSet.indexOf(i)>=0){" in out
    # Escape ends a text edit
    assert "        e.preventDefault();e.stopPropagation();el.blur();return;}" in out
    # a contextual tab keeps you; the way back is the tab you chose
    assert "    if(wantTab&&!ctxNow) tabBeforeSel=activeTab();" in out
    assert "      if(activeTab()===ctxTab&&tabHasContent(ctxTab)) wantTab='';" in out


def test_overlays_and_escape_after_the_second_pass(out):
    """T482 (2026-09-15, the second review pass): Escape reaches the thing
    that is open, and every transient surface is on the one owner."""
    # a modal dialog takes Escape before the ladder steps
    assert "      var dlgUp=$('.aa-dlg:not([hidden]),.eq-dlg:not([hidden]),'" in out
    # a context menu's Escape is in capture, like the owner's
    assert "      document.addEventListener('keydown',esc,true);" in out
    # picks close through the owner
    assert "      overlayHide(menu);   /* T482: through the owner" in out
    assert "        e.stopPropagation();fn();overlayHide(menu);});   /* T482 */" in out
    # the pop-up drawer and the find pop are on the stack
    assert "      overlayShow($('#qat-open')||null,d);" in out
    assert "overlayShow($('#qat-find'),pop);" in out
    # the theme menu closes the deck's menus first, and keeps its Escape
    assert "      window.SemApp.deckOverlayCloseAll();" in out
    assert "  window.SemApp.deckOverlayCloseAll=function(){" in out
    # the map's find field clears before the map closes
    assert "      if(fi&&document.activeElement===fi&&fi.value){" in out


def test_saving_and_export_after_the_second_pass(out):
    """T483 (2026-09-15, the second review pass)."""
    # the readout says where THIS deck's last write went, in the app too
    assert "  var saveWhere='';" in out
    assert "    if(saveWhere) return saveWhere;   /* T483: the last write" in out
    assert "      if(saveKind==='manual'&&saveStamp){" in out
    assert "    saveStamp=null;saveKind='';saveWhere='';" in out
    # a browser-kept deck is not a draft; the tooltips follow the target
    assert "draft:!!loadDraft(name)&&saveTarget!=='browser'};" in out
    assert "  function targetPhrase(){" in out
    assert "    if(typeof renderAutosaveItem==='function') renderAutosaveItem();" in out
    # Discard reverts or asks; Delete asks; reopen always reopens
    assert "has no saved copy to go back " in out
    assert "  function fileRestore(txt,forName,force){" in out
    assert "          if(!fileRestore(txt,nm,true)){" in out
    # the .pptx says the page's words and the numbers; the tallies count sources
    assert "        var _pg=textPage(a,_pn<0?0:_pn);" in out
    assert "          :figSubst(_pg.t,a,note.figs);" in out
    assert "        flipForce=ent.f;   /* T483: the page this output slide" in out
    # (T486: Markdown and rich boxes travel as runs now; a link is named)
    assert "    if(note.links) lost.push(note.links+' link'" in out
    assert "  function pptxParasFromHtml(html){" in out
    assert "            ti.paras=paras;" in out


def test_the_frame_after_the_second_pass(out):
    """T484 (2026-09-15, the second review pass)."""
    # a folded door's popover fits the window and its row wraps
    assert "  max-width:calc(100vw - 16px);box-sizing:border-box;}" in out
    assert ".rbn-foldmenu .rbn-row{height:auto;display:flex;flex-wrap:wrap;" in out
    # the strays of a layout have a group of their own
    assert "      {id:'of-rest',label:'Everything else',tab:'home',rest:1," in out
    assert "      {id:'day-rest',label:'Everything else',tab:'more',rest:1," in out
    assert "      {id:'of-slides',label:'Slides',tab:'home',\n" in out
    # a version row says why it exists, once
    assert "          var kind=v.why||'';" in out
    # the tour scrolls to its target, picks the visible selector, counts
    # the steps it will show
    assert "  function tourEl(step){" in out
    assert "  function tourVisible(){" in out
    assert "        try{tel.scrollIntoView({block:'center'});}catch(err){}" in out
    assert "    {sel:'#pr-docs,#pr-newbtn',title:'Build presentations'," in out


def test_the_small_ends_of_the_second_pass(out):
    """T487 (2026-09-15, the second review pass: the small ones)."""
    # [7] Bring to front / Send to back at the end says so
    assert "      toast(front?'Already in front of everything on this page'" in out
    # [6] a typed X or Y moves the whole group, the way a drag does
    assert "      if(a.grp!=null&&inGroup!==a.grp){" in out
    assert "          shiftAnnot(m,k==='x'?d:0,k==='y'?d:0);" in out
    # [29] a group says so when made, wears one frame, offers Ungroup alone
    assert "    toast('Grouped \\u2014 '+idxs.length+' items move as one. '" in out
    assert "    toast('Ungrouped \\u2014 '+ng+' separate items again');" in out
    assert "  function selIsOneGroup(){" in out
    assert "        fr.className='an-grpframe';" in out
    assert "    show('#fmt-group',nSel>=2&&!selIsOneGroup());" in out
    assert ".deck.editing .an-grpframe{position:absolute;pointer-events:none;" in out
    assert "      el.classList.remove('sel','grpsel','an-grouped');});" in out
    # [30] a fully locked item's lock button is disabled and says where
    #      the lock comes off; Duplicate says why not
    assert "    show('#fmt-lock',isNum,isNum&&lockMode(a)==='pos');" in out
    assert "      lkB.disabled=full;" in out
    assert "      if(held) toast(held===1?'That item is fully locked" in out
    # [14] the thin bar: one height, the cheap rung first, no geometry
    #      transition under the fitter, the bar's children watched
    assert (".deck-qat .dbtn,.deck-qat .qat-name,.deck-qat .qat-nameedit{\n"
            "  height:var(--rbn-btn-h);box-sizing:border-box;") in out
    assert ".deck-qat.qat-c1 .qat-short{display:inline;}" in out
    assert ".deck-qat.qat-c2 .deck-status{display:none;}" in out
    assert ".deck-qat.qat-c1 .deck-status{display:none;}" not in out
    assert (".deck-qat .dbtn,.deck .edit-tools .dbtn{\n"
            "  transition-property:border-color,color,background-color,"
            "box-shadow;}") in out
    assert "        [].forEach.call(qb.children,function(c){qro.observe(c);});" in out
    assert "        document.fonts.addEventListener('loadingdone',function(){" in out
    assert "      if(typeof fitQat==='function') requestAnimationFrame(fitQat);" in out
    # [22] the download says how it IS opened
    assert "    toast('Downloaded '+a.download+'. Next to its .ipynb it loads '" in out
    assert "Keep it next to the .ipynb and it loads itself" not in out
    # [43] the standalone page carries the equation fonts it used
    assert "  function inlineFontUrls(css){" in out
    assert "      inlineFontUrls(css0).then(function(fo){" in out
    assert "        if(f.status==='loaded'||f.status==='loading'){" in out
    assert "could not be packed in, so equations '" in out


def test_a_deck_named_after_itself_loads_beside_its_notebook(tmp_path):
    """T487 [22]: since T415 a download is named after the DECK, and the
    loader only ever looked for <notebook>.junoview.html -- so the file's
    own words ("keep it next to its notebook and it loads itself") were
    a promise it could not keep (2026-09-15 review)."""
    import json

    from junoview.notebook.loader import load_doc

    def wrap(name):
        return ('<!doctype html><html><body>'
                '<script type="application/json" id="junoview-data">'
                + json.dumps({"junoview": 1, "presentations": [
                    {"name": name, "slides": []}]})
                + '</script></body></html>')

    nb = tmp_path / "analysis.ipynb"
    nb.write_text(json.dumps({"cells": [
        {"cell_type": "code", "source": "x=1", "outputs": []}]}),
        encoding="utf-8")
    (tmp_path / "Lab meeting.junoview.html").write_text(
        wrap("Lab meeting"), encoding="utf-8")
    (tmp_path / "Poster.junoview.html").write_text(
        wrap("Poster"), encoding="utf-8")
    # another notebook's stem-named deck is that notebook's, not ours
    (tmp_path / "other.ipynb").write_text(nb.read_text(encoding="utf-8"),
                                          encoding="utf-8")
    (tmp_path / "other.junoview.html").write_text(
        wrap("other's deck"), encoding="utf-8")
    # a stray broken file must not stop the notebook opening
    (tmp_path / "broken.junoview.html").write_text(
        "<html>no data block</html>", encoding="utf-8")
    names = [p["name"] for p in load_doc(nb).presentations]
    assert names == ["Lab meeting", "Poster"]
    # the stem-named sidecar still wins outright when it exists
    (tmp_path / "analysis.junoview.html").write_text(
        wrap("mine"), encoding="utf-8")
    assert [p["name"] for p in load_doc(nb).presentations] == ["mine"]
