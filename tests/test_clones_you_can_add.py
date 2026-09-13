"""T409: clones you can actually add, and what they share.

The user, 2026-09-13: "The make clones feature seems to be broken. I
tried to clone an object, but it just changed the clone button to say
'Its clones', and then I can't make clones? Also would be cool if
there were clones in style and clones in space, and also both. Like I
want one image that is going to be across multiple slides and I
always want in the one position on them all."

Three things were wrong. Making a set turned the only clone door into
a list of where the clones were, and placing another lived in the
canvas right-click menu alone. A clone placed from the definition had
no content -- an empty picture. And "changing the original changes
them all" was a tooltip's promise: nothing followed until you found
"Push this look".
"""

from __future__ import annotations

from junoview import assets


def test_the_ribbon_has_an_add_a_clone_door():
    html = assets.deck_html()
    assert 'id="fmt-cmp-add"' in html
    assert "Add a clone&#8230;</button>" in html
    out = assets.deck_js()
    assert ("    show('#fmt-cmp-add',cmpOn);"
            "   /* T409: the door that was missing */") in out
    assert "#fmt-cmp-make #fmt-cmp-add #fmt-cmp-find " in out
    assert "      if(a3&&a3.cmp&&a3.cinst) cmpAddMenu(ad,a3);" in out


def test_the_add_menu_offers_here_every_slide_and_after(out):
    assert "  function cmpAddMenu(btn,a){" in out
    assert "      row('On this slide, beside it'," in out
    assert "    var eb=row('On every slide \\u2014 '+free.length+' to go'," in out
    assert "    var ab=row('On every slide after this one \\u2014 '+after.length" in out
    assert "  function cmpPlaceMany(id,where,from){" in out
    assert "  function cmpFreeSlides(id){" in out
    # one history entry for the lot
    assert ("        if(cmpPlace(id,at,si,from,true)) n++;\n"
            "      });\n"
            "    }\n"
            "    if(!n) return 0;\n"
            "    markDirty();refresh();") in out
    # the canvas menu and the Layers pane open the same door
    assert ("        row('Add a clone\\u2026','',"
            "function(){cmpAddMenu(null,cInst);},") in out
    assert "      function(b){cmpAddMenu(b,primInst);});" in out


def test_a_set_is_made_with_its_kind_chosen_not_a_prompt(out):
    assert "  function cmpMakeMenu(btn,idxs){" in out
    assert ("      cmpMakeMenu(mk,selIdxs());"
            "   /* T409: name and kind, one menu */") in out
    assert "          function(){cmpMakeMenu(null,cSel);},   /* T409 */" in out
    assert "      function(b){cmpMakeMenu(b,selN);});   /* T409 */" in out
    assert "prompt('Name for this set of clones:'" not in out
    assert "prompt('Name for the component:'" not in out
    assert "  var CMP_LINKS=[" in out
    assert "    ['look','Same look'," in out
    assert "    ['place','Same place'," in out
    assert "    ['both','Same look and place'," in out


def test_what_the_clones_share_is_on_the_definition(out):
    assert "  function cmpLinkOf(def){" in out
    assert "    return (l==='place'||l==='both')?l:'look';" in out
    assert "  function cmpHasLook(def){return cmpLinkOf(def)!=='place';}" in out
    assert "  function cmpHasPlace(def){return cmpLinkOf(def)!=='look';}" in out
    assert ("    if(link==='place'||link==='both')"
            "{def.link=link;def.x=bb.l;def.y=bb.t;}") in out
    # a place-linked set's origin is the definition's spot, on every slide
    assert "      if(cmpHasPlace(def)&&def.x!=null){ox=def.x;oy=def.y||0;}" in out
    assert ("    if(cmpHasPlace(def)&&def.x!=null){ox=def.x;oy=def.y||0;}"
            "   /* T409 */") in out
    assert ("    if(cmpHasPlace(def)){def.x=bb.l;def.y=bb.t;}"
            "   /* T409: the spot */") in out
    # a place-linked clone keeps its own look
    assert ("          if(look){\n"
            "            Object.keys(it.props||{}).forEach(function(p){") in out
    assert "  function cmpSetLink(id,link,si,inst){" in out
    # a second place-linked clone on the SAME slide would sit on top of
    # the first, so that row is not offered
    assert ("    if(!cmpHasPlace(def))\n"
            "      row('On this slide, beside it',") in out


def test_following_is_live(out):
    """markDirty pushes from a selected clone before the history entry,
    so undo is one step and the draft holds the synced deck."""
    assert "    if(!quiet&&typeof cmpFollowSel==='function') cmpFollowSel();" in out
    assert "  function cmpFollowSel(){" in out
    assert "    if(cmpFollowing||mode!=='edit') return;" in out
    assert "      try{cmpPush(a.cmp,cur,a.cinst,true);}" in out
    assert "      finally{cmpFollowing=false;}" in out
    # a quiet sync writes no history and refills the layer that exists
    assert ("    if(quiet){if(n) cmpRepaint(onCur);}\n"
            "    else {markDirty();refresh();}") in out
    assert "      if(l){renderAnnots(l,pres.slides[cur]);paintSel(l);}" in out


def test_a_placed_clone_has_the_original_s_content(out):
    assert "  function cmpSeed(src,it){" in out
    assert "    var a=src?deep(src):{};" in out
    assert ("  var CMP_NOT_COPIED=['cmp','ci','cinst','cap','capOf',"
            "'grp','oid','anim',") in out
    assert "    var src=from||cmpInstances(id)[0]||null,srcBy={};" in out
    assert "      var a=cmpSeed(srcBy[n],it);" in out


def test_the_format_says_what_link_means():
    fmt = open("DECK-FORMAT.md", encoding="utf-8").read()
    assert "{id: {name, w, h, items, link, x, y}}" in fmt
    assert "`link` says what the clones share (T409)" in fmt
    from junoview.notebook import deck_schema
    text = str(deck_schema.__dict__.get("PRES_KEYS") or "")
    src = open(deck_schema.__file__, encoding="utf-8").read()
    assert "link, x, y}}" in src
    assert "'place' (one spot, x/y, on every " in src
    assert text is not None
