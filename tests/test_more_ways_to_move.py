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
    assert "  function typeInto(el){" in out
    assert "  function typeStop(){" in out
    # the model is never split: text NODES are emptied and refilled
    assert "document.createTreeWalker(host,NodeFilter.SHOW_TEXT)" in out
    assert "    typeRun.nodes.forEach(function(n){n.node.textContent=n.text;});" in out
    # bounded: at most ~100 ticks however long the box
    assert "    var per=Math.max(1,Math.ceil(total/100)),shown=0;" in out
    # words only -- on anything else it plays as a fade
    assert "            atype=(atype==='type'&&ba.k!=='text')?'fade':atype;" in out
    assert ("            if(atype==='type'&&typeof typeInto==='function'\n"
            "               &&!(typeof storyPaint!=='undefined'&&storyPaint)) "
            "typeInto(el);") in out
    # a stale run is stopped when the element leaves the page
    assert "      if(!el.isConnected){typeStop();return;}" in out


def test_motion_keeps_going_in_the_show_only(out):
    assert "  var MOTION_FX=[['','None'],['wobble','Wobble'],['bob','Float']," in out
    for cid in ("anim-move-none", "anim-move-wobble", "anim-move-bob",
                "anim-move-pulse"):
        assert f'id="{cid}"' in out, cid
    assert '<span class="rbn-grp rbn-motion" data-tab="animation"' in out
    assert ".rbn-motion{order:3;}" in out
    # the class goes on in view mode, in a pass of its own
    assert "    if(mode==='view'&&s.annots&&s.annots.some(function(a){" in out
    assert "        if(ma&&ma.motion) el.classList.add('an-move-'+ma.motion);" in out
    # infinite keyframes on individual properties, so a rotation survives
    assert "@keyframes an-wobble{0%,100%{rotate:-2.5deg}50%{rotate:2.5deg}}" in out
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
    assert ".an-part.an-hl{color:var(--accent,#39a9c0);scale:1.04;" in out
    # four tiles, so that strip is four wide
    assert "width:calc(4 * var(--rbn-tile-w) + 3 * var(--rbn-tile-gap) + 8px);}" in out


def test_a_flip_book_page_can_turn_or_push(out):
    assert "    ['turn','Page turn'],['push','Push']];" in out
    assert 'id="anim-flip-turn"' in out and 'id="anim-flip-push"' in out
    assert "@keyframes fturn-push{from{transform:translateX(100%);}" in out
    assert "  transform:perspective(900px) rotateY(-85deg);}" in out
