"""The history reads as a version graph (T237).

The user, 2026-09-04: "The history is a bit much as well. Like how you
can see the git history thing where you can just see the little lines
with the dots for versions and then can see branches as different
colours from that. I really like that design. Also then there can be
named versions, and the default name should just be the time. Idk when
a new dot on the timeline should be created, like obviously not every
change... Then there should be like summary of changes from last
version or something, and it should have quick overview that can be
either type of by slide (e.g. slide 14: heading: (color: red -> yellow,
image added)), ... and then also by type (e.g. heading changed red ->
yellow (slide 13, 14, 15)), then ways to compare different changes and
yeah also have the more visual one like you had, but only showing
slides that changed ... but also an ability to view the whole thing.
Then the ability to go back to old version and branch from there."

Driven at 1700px: the rail draws one lane per branch with a dot per
version and an elbow where the branch left the trunk (two lanes, cyan
and amber, one path); versions are labelled by their time; the summary
read "12:15 -> now: 1 colour"; By slide read "Slide 1 - empty slide >>
title colour cyan at 25% -> amber" and By type read the same change with
"(slide 1)" beside it; the compare-with picker listed nine versions.
"""

from __future__ import annotations

from junoview import assets


def test_the_surface_has_its_own_fragment():
    """The store stayed with the other IndexedDB work; the panel grew a
    graph, a change model and three readings, which is a file."""
    assert "46-history" in assets.DECK_PARTS
    src = assets.load("js/deck/46-history.js")
    assert "ONE FRAGMENT of deck.js's single IIFE" in src
    store = assets.load("js/deck/45-images.js")
    assert "function snapWrite(cap,ix,why,mark){" in store
    assert "function deckDiff(then,now){" in store
    assert "function openHistory(){" not in store


def test_the_rail_is_a_graph_not_an_indent(out):
    """T90 indented each row by its depth and headed each run with its
    branch name. That does not read past two branches."""
    assert "  var DH_LANE_COL=['#39a9c0','#f0a848','#a586e8','#46a892'," in out
    assert "  function histLanes(ix){" in out
    assert "  function histGraphSvg(i,rows,lane,span,pos){" in out
    assert "'<svg class=\"dh-gsvg\" width=\"'+w+'\" height=\"'+h+'\" '" in out
    assert "s+='<circle class=\"dh-dot\" cx=\"'+cx+'\" cy=\"'+mid+'\" r=\"'" in out
    # the elbow where a branch leaves the line it came from
    assert "    var pi=e.p!=null?pos[e.p]:null;" in out
    assert "      if(pl!==own){" in out
    css = assets.deck_css()
    assert ".dh-r{display:grid;" in css
    # a row is exactly one graph row high, or the lane breaks
    assert ".dh-snap{height:46px;" in css
    assert ".dh-when,.dh-why{white-space:nowrap;overflow:hidden;" in css


def test_a_version_is_called_by_its_time_unless_you_name_it(out):
    assert "  function histClock(ms){" in out
    assert "    return (e&&e.nm)||histClock(e&&e.at)||'version';" in out
    assert "  function histSetName(id,nm){" in out
    # ...and the pencil that does it
    assert "      ren.className='dbtn dh-ren';" in out
    assert "        var v=prompt('Call this version:',e.nm||histClock(e.at));" in out
    # a checkpoint's name IS the version's name
    assert "      return histSetName(histHead,nm);" in out


def test_a_dot_is_a_session_not_a_keystroke(out):
    """Not every change -- and the panel says which moments do count."""
    assert "  var DH_IDLE_MS=30000, DH_GAP_MS=300000;" in out
    assert "  function histIdleTick(){" in out
    assert "      if(Date.now()-histLastAt<DH_GAP_MS) return;" in out
    assert "      snapTake('while you worked');" in out
    assert "    if(!quiet) histIdleTick();" in out
    # a save inside the window means the pause after it is not a second dot
    assert "  function histNoteWrite(){histLastAt=Date.now();}" in out
    assert "    histNoteWrite();      /* the idle rule's clock (T237) */" in out
    assert "+'<div class=\"dh-when-note\">A version is kept when you open this '" in out


def test_what_changed_not_only_which_slides(out):
    assert "  function deckChanges(then,now){" in out
    assert "  function annotChanges(a,b){" in out
    assert "  function chPair(A,B){" in out
    assert "  function chSentence(c){" in out
    assert "    return c.role+' '+c.field+' '+c.from+' \\u2192 '+c.to;" in out
    # a role is what the box IS -- a named style says "title", not "text box"
    assert "      if(d&&d.label) return d.label.toLowerCase();" in out
    # ...and a colour reads as a name, not as an rgba() dump
    assert "        return c.a<1?(nm2+' at '+Math.round(c.a*100)+'%'):nm2;" in out


def test_pairing_survives_one_side_having_no_object_ids(out):
    """Requiring BOTH sides to be oid-less made every comparison against
    a snapshot older than oids report each box as removed AND added
    (caught by driving it, 2026-09-04)."""
    assert "    /* 1. exact, by id */" in out
    assert "    /* 2. same slot, same kind */" in out
    assert "    /* 3. anywhere, same kind" in out
    assert "    /* 4. what is left really is new, or really is gone */" in out


def test_three_readings_of_one_list(out):
    assert "  function chBySlide(body,list){" in out
    assert "  function chByType(body,list){" in out
    assert "  function chSlideRows(body,d,then,now){" in out
    assert "      h.textContent='Slide '+no+(nm?(' \\u00b7 '+nm):'');" in out
    assert "      w.textContent='slide'+(ns.length===1?' ':'s ')+ns.join(', ');" in out
    # the pictures show only what differs, until you ask for everything
    assert "      if(!histAllSlides&&r.st==='same') return;" in out
    assert "        histAllSlides=cb.checked;histCompare(ov,ent);});" in out


def test_any_two_versions_can_be_compared(out):
    """It could only ever read a version against the deck you were
    editing."""
    assert "  function histAgainstPicker(ov,ent){" in out
    assert "    o0.value='';o0.textContent='now (the deck you are editing)';" in out
    assert "      histAgainst=sel.value;histCompare(ov,ent);});" in out
    assert ("    var wantB=histAgainst?snapRead("
            "histAgainst):Promise.resolve(null);") in out
    # putting ONE slide back only means anything against the live deck
    assert "      if(r.a&&!histAgainst&&(r.st==='removed'||r.st==='changed')){" in out


def test_going_back_and_branching_are_still_there(out):
    assert "      restoreAll.innerHTML=bic('reload')+' Go back to this version';" in out
    assert "      branch.innerHTML=bic('route')+' Branch from here\\u2026';" in out
    assert "          histRestoreDeck(then,ent.id,nm);" in out
