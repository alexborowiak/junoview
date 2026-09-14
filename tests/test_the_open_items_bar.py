"""The open-items bar, and the three places it can live (T448).

The user, 2026-09-14: "the button beside home that is the only way to
show what you currently have open is annoying. Often people want to swap
a lot between presentation and tabs and version (also you can't
duplicate a presentation or delete it from the main menu, there is very
little controls). Having the side bar before was good when you could
have it open all the time or pop it up more easily. Should also be able
to make it as a top bar and customise a lot about the way you want
things. Needs lots of user flexibility."

These pin the shape. What it does was driven in a browser (TASKS.md).
"""

from __future__ import annotations


def test_where_the_bar_sits_is_remembered(out):
    """Three docks, one remembered setting, per project scope -- the
    same key shape every other remembered deck option uses."""
    assert "var OPENBAR_KEY='semopts:'+SCOPE+':openbar';" in out
    assert "var BAR_DEF={dock:'pop',pres:1,nb:1,vers:1};" in out
    assert "    return {dock:(o.dock==='left'||o.dock==='top')?o.dock:'pop'," in out
    assert "      pres:o.pres===0?0:1,nb:o.nb===0?0:1,vers:o.vers===0?0:1};" in out
    assert "  function barDocked(){return barCfg().dock!=='pop';}" in out
    # every change writes it and repaints, so nothing can drift
    assert "    lsSet(OPENBAR_KEY,JSON.stringify(c));\n    barApply();" in out
    # and the bar is put where it belongs at boot, not on first open
    assert "      closeDeckPresentationDrawer(true);\n    });\n    barApply();" in out


def test_a_docked_bar_is_a_track_of_the_decks_own_grid(out):
    """Not a pop-up with the stage padded around it: the deck's grid
    grows a column (a rail) or a row (a strip), so the stage measures
    its own smaller box and sizeSlideTo fits the page to it -- the
    same bargain .deck.pane-open strikes for an inspector pane."""
    assert ".deck-pres-drawer.dock-left,.deck-pres-drawer.dock-top{" in out
    assert "  position:static;max-height:none;border-radius:0;box-shadow:none;}" in out
    assert ".deck.openbar-left{grid-template-columns:auto auto minmax(0,1fr);}" in out
    assert ".deck.openbar-left>.deck-pres-drawer{grid-column:1;grid-row:2/5;" in out
    assert (".deck.openbar-left>.rbn-tabs,.deck.openbar-left>.edit-tools,\n"
            ".deck.openbar-left>.deck-main{grid-column:3;}") in out
    assert (".deck.openbar-top{grid-template-rows:"
            "auto auto auto auto minmax(0,1fr);}") in out
    assert ".deck.openbar-top>.deck-pres-drawer{grid-column:1/-1;grid-row:2;" in out
    assert ".deck.openbar-top>.deck-main{grid-row:5;}" in out
    # across the top the list flows sideways, so the strip is one band
    assert ".deck-pres-drawer.dock-top .deck-pres-list{flex-direction:row;" in out
    # the classes that drive all of it, and the re-fit that follows
    assert "    d.classList.toggle('dock-left',c.dock==='left');" in out
    assert "    deckEl.classList.toggle('openbar-top',c.dock==='top');" in out
    assert "    if(typeof applyZoom==='function') applyZoom();" in out


def test_a_docked_bar_does_not_close_under_you(out):
    """"open it all the time" -- so the pointer leaving it, or the
    library dialog tidying up, must not hide a rail the layout has
    made room for. The X un-docks instead."""
    assert "  function closeDeckPresentationDrawer(force){" in out
    assert "    if(barDocked()&&!force) return;" in out
    # the edge peek stands down entirely
    assert "      if(barDocked()) return;" in out
    # ...and the head's X goes back to a pop-up rather than hiding
    assert "      if(barDocked()){barSet('dock','pop');return;}" in out
    assert "      closeDeckPresentationDrawer(true);" in out


def test_the_bar_lists_three_kinds_and_you_choose_which(out):
    """"swap a lot between presentation and tabs and version": the
    three sections, each with a heading and each switchable from the
    dock menu's second half."""
    for head in ("      head('presentations');", "      head('notebooks');",
                 "      head('versions of this presentation');"):
        assert head in out, head
    assert "    if(c.pres){" in out
    assert "    if(c.nb){" in out
    assert "    if(c.vers&&typeof histIndex==='function'){" in out
    assert "    menuHead(m,'where this bar sits');" in out
    assert "    menuHead(m,'what it lists');" in out
    assert "    [['pres','Presentations'],['nb','Notebooks']," in out
    # the six newest versions, newest first, opened in the history panel
    assert "        var rows=(ix||[]).slice(-6).reverse();" in out
    assert "              if(typeof openHistory==='function') openHistory();" in out
    # a notebook row still stops the talk and shows that notebook
    assert "            if(A.activate) A.activate(n.stem);" in out
    assert "          if(A.closeNotebook) A.closeNotebook(n.stem);" in out


def test_every_row_carries_its_verbs(out):
    """"there is very little controls". Duplicate, rename, pin, close
    and delete on the row itself -- and they float over its right end,
    because five icons in a column of their own clipped every name to
    "presentat…" whether you were pointing at the row or not."""
    assert "  function barRowActs(host,acts){" in out
    assert "    w.className='deck-pres-acts';" in out
    assert "      b.type='button';b.className='deck-pres-act'+(a[3]?' on':'');" in out
    assert ".deck-pres-acts{display:flex;gap:2px;flex:none;opacity:0;\n" \
           "  position:absolute;right:5px;top:50%;transform:translateY(-50%);" in out
    assert ".deck-pres-row:hover .deck-pres-acts," in out
    # the five verbs, by the function each one calls
    assert "          [bic('copy'),'Duplicate “'+nm+'”',function(){" in out
    assert "            if(v&&v.trim()&&typeof renamePresentation==='function')" in out
    assert "              togglePinPresentation(nm);" in out
    assert ("            if(typeof deletePresByName==='function') "
            "deletePresByName(nm);") in out
    # closing the one you are in still asks about unsaved work (T434)
    assert "            if(mine&&typeof closeGuard==='function'){" in out


def test_duplicating_a_presentation_opens_the_copy_beside_it(out):
    """"you can't duplicate a presentation". A deep copy under the
    first free "<name> copy" name, written to the draft store and
    noted open, so the bar lists both at once."""
    assert "  function duplicatePresentation(nm){" in out
    assert "    var base=nm+' copy',name=base,n2=1;" in out
    assert ("    while(savedByName(name)||loadDraft(name))"
            "{n2++;name=base+' '+n2;}") in out
    assert "    var cp=deep(src);cp.name=name;" in out
    assert "    if(!draftSet(name,JSON.stringify(cp),true)){" in out
    assert "    noteSessionOpen(name);" in out
    assert "    toast('Copied to “'+name+'” — it is open beside this one');" in out
