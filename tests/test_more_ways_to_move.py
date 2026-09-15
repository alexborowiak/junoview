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
