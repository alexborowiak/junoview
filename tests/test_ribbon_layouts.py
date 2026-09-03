"""Ribbon layouts: many arrangements of the one ribbon.

There is no one right grouping of a hundred controls -- the argument has
always had the same shape, somebody sure the slide controls belong
together and somebody else sure the things that CHANGE a selected object
do, both right for the way they work. So the editor stops deciding: a
LAYOUT is a complete re-assignment of every control into tabs and
groups, there are many, and you switch between them from a gallery.

These pin the decisions. What the layouts DO is verified in a browser --
every one of them applied in turn, every control accounted for after
each -- because a string in the page cannot tell you whether a button
moved.
"""

from __future__ import annotations

import re


def _layouts(out: str) -> list[tuple[str, list[str]]]:
    """Every layout in the catalogue, as (id, control ids it places).

    Only what sits inside an ``items:[...]`` run counts. A looser sweep
    for quoted kebab-case strings also collects the GROUP ids, which look
    exactly the same and are not controls -- which is what the first
    version of this did.
    """
    i = out.index("var RIBBON_LAYOUTS=[")
    body = out[i:out.index("\n  ];", i)]
    blocks = re.split(r"\n    \{id:'", body)[1:]
    out_l = []
    for b in blocks:
        lid = b[: b.index("'")]
        ids: list[str] = []
        for run in re.finditer(r"items:\[(.*?)\]\}", b, re.S):
            ids.extend(re.findall(r"'([A-Za-z][\w-]*)'", run.group(1)))
        out_l.append((lid, ids))
    return out_l


def test_the_catalogue_is_a_pile_not_a_handful(out):
    """REWRITTEN for T139 (user decision, 2026-09-01): the pile became
    NINE. The 108-alternative catalogue was 17% of the deck editor's
    JavaScript and meant no two users shared an interface; the user
    chose Default plus eight of the best, each a genuinely different
    way of working rather than a permutation. The deleted entries are
    a git log -p away."""
    lays = _layouts(out)
    ids = [lid for lid, _ in lays]
    assert ids == ["familiar-office-ribbon", "scope-deck-slide-object",
                   "sources-own-tab", "density-everyday-first",
                   "journey-poster-first", "density-one-row",
                   "web-canvas-rail", "radical-ten-then-more"], ids
    # a stored id from the old hundred lands on Default, said out loud
    assert "you are on Default now" in out


def test_every_layout_places_exactly_the_same_controls(out):
    """The failure that would make nobody trust this is a button that
    vanishes when you change layout. Every layout must account for every
    control -- so the set each one places is identical to the set every
    other one places, and the emitter refuses to write a catalogue where
    it is not.

    Checked here across the catalogue, and in a browser by applying
    every one and comparing the ribbon's contents after each.
    """
    lays = _layouts(out)
    sets = {lid: set(ids) for lid, ids in lays}
    first, want = next(iter(sets.items()))
    assert len(want) > 80, f"{first} places only {len(want)} controls"
    for lid, got in sets.items():
        assert got == want, (
            f"{lid} differs: missing {sorted(want - got)}, "
            f"extra {sorted(got - want)}")


def test_deck_wide_commands_are_explicit_in_every_layout(out):
    """Tokens and page tidy do not belong to an arbitrary rest group.
    Every arrangement places each permanent Design control exactly once,
    so switching layouts cannot hide or duplicate either door.
    """
    for lid, ids in _layouts(out):
        for cid in ("dsg-tokens", "dsg-tidy"):
            assert ids.count(cid) == 1, f"{lid} places {cid} {ids.count(cid)}x"


def test_one_group_per_layout_catches_a_control_nobody_placed(out):
    """A control added by a later version is one the catalogue has never
    heard of. Dropping it silently would be the button-that-vanished
    failure by another route, so every layout names the group where
    strays land.
    """
    lays = _layouts(out)
    i = out.index("var RIBBON_LAYOUTS=[")
    body = out[i:out.index("\n  ];", i)]
    for lid, _ in lays:
        block = body[body.index("{id:'" + lid + "'"):]
        nxt = block.find("\n    {id:'")
        if nxt > 0:
            block = block[:nxt]
        assert block.count("rest:1") == 1, (
            f"{lid} has {block.count('rest:1')} catch-all groups, want 1")
    assert "function rbnRestGroup(lay){" in out


def test_default_is_a_restoration_not_a_catalogue_entry(out):
    """The markup is still the truth. A nineteenth entry mirroring
    deck.html would be one more thing to keep in step, and it would
    drift the first time a button was added -- so Default puts every
    control back where the markup had it, recorded as "these containers
    held exactly these children, in this order".
    """
    assert "fromMarkup:true" in out
    assert "function rbnHome(){" in out
    assert "function rbnRestoreHome(){" in out
    assert "holders:holders," in out


def test_nothing_is_ever_duplicated(out):
    """Applying a layout MOVES the real controls. Rendering a layout's
    own copy would mean two elements answering to one id, two sets of
    handlers, and showFmt toggling whichever it found first. There is
    one Bold button in this application and there always will be.
    """
    assert "row.appendChild(a);" in out
    assert "var atoms=rbnAllAtoms()" in out


def test_a_generated_group_does_not_answer_to_its_family_name(out):
    """`rbn-lay` is worn by EVERY group a layout generates, so without it
    in RBN_GENERIC all of them would answer to the same id and one
    group's saved button order would be applied to the lot -- the exact
    bug T11 shipped once and fixed by reading the stored key in a
    browser.
    """
    assert "'rbn-lay':1" in out
    assert "el.className='rbn-grp rbn-lay rbn-lg-'+lay.id+'-'+g.id;" in out


def test_the_tab_strip_is_built_and_delegated(out):
    """A layout declares its own tabs, including how many: one of them
    has a single tab and several have four. So the strip is generated,
    and its clicks are delegated -- per-button listeners would work only
    on the buttons that happened to be in the markup at boot.
    """
    assert "function rbnBuildTabs(lay){" in out
    assert "TABS=lay.tabs.map(function(t){return t.id;});" in out
    assert "curTab=TABS.indexOf(t)>=0?t:TABS[0];" in out
    assert "strip.addEventListener('click',function(e){" in out


def test_hiding_a_contextual_control_is_about_the_control(out):
    """Hiding the #et-fmt bar used to be enough, because every
    selection-driven control lived inside it. A layout may put any of
    them in a group of its own, and one that relied on an ancestor for
    its hiding then sat there visible with nothing selected -- keeping
    its whole group on screen, which is how a tab that should have been
    empty stayed in the strip. Found in a browser.
    """
    assert "function fmtAllIds(){" in out
    assert "fmtAllIds().forEach(function(id){" in out


def test_the_selection_opens_the_layouts_own_format_tab(out):
    """Default answers "where do selected-object tools live?" with Object.

    Other layouts may call that tab something else, so the selection still
    asks the active layout rather than hard-coding either name.

    And the switch happens AFTER the controls are revealed: done first,
    the tab was still empty and the empty-tab fallback bounced straight
    back off it, so selecting appeared to do nothing. Also found in a
    browser.
    """
    assert "selTab:'object',fromMarkup:true" in out
    assert "{id:'object',label:'Object'}" in out
    assert "function ribbonSelTab(){" in out
    assert "var wantTab=(activeTab()!==selT" in out
    assert "if(wantTab) setTab(wantTab); else syncRibbonGroups();" in out


def test_ribbon_layouts_have_a_persistent_worded_door(out):
    """The gallery existed behind a ribbon right-click and an overflow-only
    View menu. A feature for choosing the whole UI needs a normal visible
    door, outside the UI it rearranges (2026-08-26, user).
    """
    i = out.index('id="rbn-layouts"')
    door = out[i:i + 700]
    assert 'class="bic"' in door and "Ribbon layouts" in door
    assert "function initRibbonLayoutDoor(){" in out
    assert "initRibbonLayoutDoor();" in out
    assert "ribbonFolded())" in out and "setRibbonFold(false);" in out
    assert ".rbn-tabs .rbn-layouts{" in out


def test_returning_to_default_removes_generated_tabs_first(out):
    """A custom layout builds new tab nodes. Restoring the saved markup
    without removing those nodes duplicated labels and ids in the strip.
    """
    i = out.index("function rbnRestoreHome(){")
    block = out[i:i + 1400]
    assert "$$('.rbn-tab',h.strip.el).forEach(function(b){b.remove();});" \
        in block
    assert block.index("b.remove();") < block.index("h.strip.kids.forEach")


def test_a_tab_with_nothing_on_it_leaves_the_strip(out):
    """A layout may give the format groups a tab of their own --
    PowerPoint's "Picture Format" is the same idea -- and such a tab is
    empty until something is selected. A button that does nothing when
    clicked is worse than no button; and being left standing on one when
    you deselect would show a blank row, so the ribbon falls back to the
    first tab that has anything.
    """
    assert "b.classList.toggle('rbn-tab-off',!on&&!tabHasContent(" in out
    assert ".rbn-tab.rbn-tab-off{display:none;}" in out
    assert "if(!tabHasContent(activeTab())){" in out


def test_the_gallery_shows_arrangements_and_stays_out_of_the_way(out):
    """A list of names tells you nothing: the thing being
    chosen IS an arrangement, so each card draws the tabs and the groups
    on them. Picking one applies it and leaves the gallery open, because
    the ask was to flick through a pile.

    And it is the one panel here that does NOT take the whole screen --
    an overlay across the ribbon would hide the only evidence you have.
    """
    assert "function openRibbonGallery(){" in out
    assert "function rbnGalleryPlace(){" in out
    assert "ov.style.top=Math.max(0,Math.round(r.bottom))+'px';" in out
    # A vertical ribbon reaches the viewport bottom, so its bottom cannot
    # be the gallery's top. The tab strip anchors the top and the ribbon's
    # measured left edge reserves the right-hand rail instead.
    assert "var side=deckEl.classList.contains('rbn-side');" in out
    assert "var anchor=side?$('#rbn-tabs'):bar;" in out
    assert "window.innerWidth-br.left" in out
    assert "if(typeof rbnGalleryPlace==='function') rbnGalleryPlace();" in out
    side_i = out.index("function applySideRibbon(){")
    side_body = out[side_i:out.index("/* ---- fit the ribbon", side_i)]
    assert "fitEditRibbon();" in side_body
    assert "Math.round(window.innerWidth-br.left)" in out
    assert "+'px':'0px';" in out
    # applying does not close it
    assert "applyRibbonLayout(lay.id,true);" in out
    assert "rbnGalleryFill();" in out


def test_the_gallery_closes_with_the_editor(out):
    """The chooser belongs to edit mode. Presenting or closing the deck
    must not leave it pinned over the page, and reopening the editor must
    not retain contextual controls from a previous selection either.
    """
    i = out.index("function setUIMode(m){")
    body = out[i:out.index("\n  function refresh(){", i)]
    off = body[body.index("if(!editing){"):]
    assert "rbnGalleryClose();" in off
    assert body.index("selAnnot=null;selSet=[];") < body.index("showFmt();")

    j = out.index("function closeDeck(){")
    closed = out[j:out.index("\n  /* ---- URL routing", j)]
    assert "rbnGalleryClose();" in closed

    k = out.index("function startPick(idx,multi){")
    picked = out[k:out.index("\n  function ", k + 20)]
    assert picked.index("rbnGalleryClose();") < picked.index("deckEl.hidden=true")

    close_i = out.index("function rbnGalleryClose(){")
    gallery_close = out[close_i:out.index("\n  }", close_i)]
    assert "window.removeEventListener('resize',rbnGalleryPlace);" in gallery_close
    assert "document.removeEventListener('keydown',rbnGalleryKey,true);" in (
        gallery_close)


def test_an_oversized_layout_names_the_existing_remedy(out):
    """Experimental one-row layouts may remain wider than the window
    after every never-wrap density rung. That is allowed, but silently
    clipping their controls is not: the user is pointed to Side toolbar.
    """
    i = out.index("function applyRibbonLayout(id,quiet){")
    body = out[i:out.index("\n  /* WHAT A LAYOUT MISSED", i)]
    assert body.index("showFmt();") < body.index("rbnOverflowNotice(bar)")
    notice_i = out.index("function rbnOverflowNotice(bar){")
    notice = out[notice_i:out.index("\n  function ", notice_i + 20)]
    assert "bar.scrollWidth>bar.clientWidth+1" in notice
    assert "!deckEl.classList.contains('rbn-side')" in notice
    assert "This ribbon layout is wider than the window" in body
    assert "turn on Side toolbar to reach all of it" in body
    # While the chooser is open its z-index is above the deck (and its
    # toast), so the same warning must also live inside the gallery.
    assert 'id="rbn-gal-warn" role="status" hidden' in out
    assert "if(note) note.hidden=!clipped;" in notice
    assert ".rbn-gwarn{" in out
    assert ".rbn-gwarn[hidden]{display:none!important;}" in out
    # The layouts which overflow can clip their own Side control, so the
    # visible warning provides a reachable word-and-icon action itself.
    assert 'id="rbn-gal-side">\'+bic(\'dockright\')' in out
    assert "var side=$('#vw-side'); if(side) side.click();" in out


def test_folding_the_ribbon_closes_its_layout_preview(out):
    """A gallery cannot preview a hidden ribbon, and measuring the folded
    bar on the next resize would otherwise move the gallery over the tabs.
    """
    i = out.index("function setRibbonFold(on){")
    body = out[i:out.index("\n  /* DELEGATED", i)]
    assert "if(on&&typeof rbnGalleryClose==='function')" in body
    assert "rbnGalleryClose();" in body


def test_the_overflow_notice_tracks_every_ribbon_refit(out):
    """Side toggles and window resizes can resolve or recreate overflow
    while the gallery remains open, so the inline status follows the fit
    function rather than only the card click that first opened it.
    """
    i = out.index("function fitEditRibbon(){")
    body = out[i:out.index("\n  /* ---- the thin top bar", i)]
    assert body.count("rbnOverflowNotice(bar);") == 2
    side = body.index("if(cl.contains('rbn-side')){")
    assert body.index("ERC.forEach(function(c){cl.remove(c);});") < side
    assert body.index("cl.remove('erc-nohint')") < side
    assert side < body.index("rbnOverflowNotice(bar);", side) < body.index(
        "return;", side)


def test_every_control_on_the_ribbon_can_be_addressed(out):
    """A layout places controls by id, so a control without one cannot
    be placed -- and, worse, never leaves the group a layout emptied,
    keeping it on screen. Four tool buttons had no id, including Cell,
    which is the notebook figure button and exactly the one somebody
    wants beside Lock figure.
    """
    for cid in ('id="et-cell"', 'id="et-flip"', 'id="et-table"',
                'id="et-arrow"'):
        assert cid in out, f"{cid} is missing"
    # and the two colour dropdowns move as one thing with their menus
    assert 'id="fmt-txcolwrap"' in out and 'id="fmt-fillcolwrap"' in out
    assert "#fmt-txcolwrap #fmt-fillcolwrap " in out


def test_the_layout_is_a_fact_about_the_person(out):
    """Unscoped, like T11's per-button preferences and for the same
    reason: it would be absurd for one deck to know where you keep Bold.
    """
    assert "var RIBBON_LAYOUT_KEY='jv-ribbon-layout';" in out
    assert "/* NOT +SCOPE, as T11's */" in out


def test_it_composes_with_the_per_button_customiser(out):
    """A layout decides which group a control is in; T11 still hides and
    reorders within a group. Order matters at boot -- the layout first,
    the preferences after -- or the preferences would sort a group the
    control is about to leave.
    """
    # the BOOT call, not merely the first one in the file: T57 gave the
    # same pair to "Put the ribbon back to normal", which is a second
    # caller and sits earlier in the concatenation
    assert ("applyRibbonLayout(rbnCurrentId(),true);\n"
            "  applyRibbonPrefs();") in out
    assert out.count("applyRibbonLayout(rbnCurrentId(),true);") == 2
    assert "Ribbon layouts\\u2026" in out or "Ribbon layouts" in out


def test_every_family_the_gallery_declares_has_layouts_in_it(out):
    """A family is a heading the gallery draws, and RBN_FAMILIES is the
    order it draws them in. One declared with nothing under it is a
    heading that never appears -- which is exactly how this sat
    half-finished for a while: the taxonomy was written ahead of the
    catalogue and six of its ten families stayed empty. Declaring a
    family is a promise to fill it.
    """
    i = out.index("var RBN_FAMILIES=[")
    block = out[i:out.index("\n  ];", i)]
    declared = re.findall(r"\['([a-z]+)',", block)
    # five families since the T139 cut to nine layouts
    assert len(declared) == 5, declared
    # font-family: would match a bare `family:'...'`, hence the [^-]
    used = set(re.findall(r"[^-]family:'([a-z]+)'", out))
    assert set(declared) == used, (
        f"declared but empty: {sorted(set(declared) - used)}; "
        f"used but undeclared: {sorted(used - set(declared))}")


def test_the_catalogue_recreates_the_applications_people_already_use(out):
    """REWRITTEN for T139: of the two dozen product imitations, only
    the Office taxonomy survived the cut -- it is the one hands
    actually arrive trained on. The rest were retired by the user's
    decision and live in git history."""
    assert "familiar-office-ribbon" in out
    for gone in ("microsoft-powerpoint-2003", "adobe-raster-options-bar",
                 "consumer-pres-keynote", "opensource-blender"):
        assert gone not in out, f"{gone} came back"


def test_the_gallery_is_filtered_by_what_a_layout_would_give_you(out):
    """A hundred cards is a wall. The question somebody scrolling one is
    actually asking is "which of these puts Crop somewhere sensible", so
    the filter reads the tab and group LABELS a layout would give you as
    well as its name, its blurb and its family.
    """
    i = out.index("function rbnCardWords(lay){")
    body = out[i:out.index("function rbnGalleryFill(){", i)]
    assert "lay.name" in body and "lay.blurb" in body
    assert "rbnFamilyLabel(lay.family" in body
    assert "(lay.tabs||[]).forEach" in body
    assert "(lay.groups||[]).forEach" in body
    assert "return w.join(' ').toLowerCase();" in body
    # and the count says how much of the pile you are looking at
    assert "shown.length+' of '+all.length" in out


def test_escape_empties_the_filter_before_it_closes_the_gallery(out):
    """A filter with a word still in it is a state you can be stuck in --
    the card you want is not on screen -- and Escape is the key everyone
    reaches for. Saying so on the INPUT is dead code: the gallery's own
    keydown listener is on document in the CAPTURE phase, so it sees the
    key first and stops it. It was written there once and never ran once:
    Escape closed the gallery and left the word in the box (found in a
    browser; no string in the page could have shown it).
    """
    assert "document.addEventListener('keydown',rbnGalleryKey,true);" in out
    i = out.index("function rbnGalleryKey(e){")
    body = out[i:out.index("\n  }", i)]
    assert "if(e.key!=='Escape') return;" in body
    assert "if(fi&&fi.value){fi.value='';rbnGalleryFill();" in body
    assert "rbnGalleryClose();" in body
    # the input keeps only the job it can actually do: not letting the
    # deck's own shortcuts fire while you type
    j = out.index("gfind.addEventListener('keydown'")
    assert "e.stopPropagation();" in out[j:j + 80]
    assert "Escape" not in out[j:j + 80]


# ---------------------------------------------------------------------------
# layout ideas, and one Layouts menu equals the other (T131)
# ---------------------------------------------------------------------------
#
# Driven live 2026-08-31: Home's menu opened with the ideas row, the
# tidy trio, the three arrangement rows and the template grid; the
# chooser showed three tidy cards whose miniatures were ARRANGED clones
# (preview positions differed from the live slide, which was untouched);
# clicking Tight applied exactly the previewed layout; a saved
# arrangement appeared as "MyArr (dot) 100%" and clicking it laid a
# scattered slide back out; Esc and click-away both closed it.


def test_home_and_design_layouts_menus_carry_the_same_rows(out):
    """Two buttons both said "Layouts" and Home's silently hid the
    auto-arrange row, the ideas row and the saved arrangements --
    two-thirds of the layout system, depending on the tab. Twin ids,
    one set of wiring, and every handler shuts BOTH menus."""
    # ...and since T204 there is ONE set: the rows left the Design menu
    # (it is the grid alone) and the same verbs are the Layout group
    # beside it, so each has one id and one seat
    for i in ("hm-lay-ideas", "hm-lay-tidy", "hm-lay-arrs",
              "hm-lay-arrsave", "hm-lay-give"):
        assert f'id="{i}"' in out
    for gone in ("lay-ideas-btn", "lay-tidy", "lay-arrs", "lay-arrsave",
                 "lay-give", "lay-masters"):
        assert f'id="{gone}"' not in out, gone
    assert "var hosts=['#hm-lay-tidy']" in out
    assert "both('#hm-lay-arrs',null,function(){" in out
    assert "both('#hm-lay-ideas',null,function(){openLayoutIdeas();});" in out
    assert '<span class="rbn-lab">Layout</span>' in out
    assert '<span class="rbn-lab">Apply to other slides</span>' in out
    assert "$('#hm-lay-menu')" not in out


def test_layout_ideas_previews_are_the_real_computation_on_a_clone(out):
    """The defining gesture of "a slide designer": candidates COMPUTED
    from this slide's objects, shown to pick from. The previews run
    arrangeSlide/arrApply -- exactly the code a click runs -- inside
    withDeck over a shallow copy whose slides array holds only a deep
    clone, so the live deck cannot be touched and the preview cannot
    disagree with what applying would do."""
    assert "function ideaPreviewTidy(id,sl){" in out
    assert "function ideaPreviewArr(arr,sl){" in out
    assert "var scratch=Object.assign({},pres,{slides:[c]});" in out
    assert "withDeck(scratch,function(){arrApply(arr,0);});" in out
    # your library, best fit first, with the number shown
    assert "return {arr:arr,fit:arrScore(arr,sl)};" in out
    assert ".sort(function(x,y){return y.fit-x.fit;})" in out
    # an empty slide gets a sentence, not an empty panel
    assert "ideas are computed " in out


def test_the_chooser_closes_like_the_menus_it_lives_beside(out):
    """Since T209 it is on the overlay stack with everything else: Escape
    and an outside click reach it through overlayBoot, not listeners of
    its own."""
    assert "function closeLayoutIdeas(){" in out
    assert "overlayShow($('#hm-lay-ideas'),p);" in out
    assert "if(p){if(!p.hidden) overlayHide(p); p.remove();}" in out
    assert "document.addEventListener('keydown',ideasKey,true);" not in out
    assert "if(!p.contains(e.target)) closeLayoutIdeas();" not in out


def test_the_tablist_wrapper_survives_a_layout_change(out):
    """T151, a regression T139 shipped and no substring test could see.

    T139 wrapped the four markup tabs in <span class="rbn-tabset"
    role="tablist"> so the layouts chooser beside them stopped reading as
    a fifth tab. But rbnHome() snapshots the STRIP'S ELEMENT CHILDREN,
    which after that change is the span rather than the buttons inside
    it, while rbnRestoreHome() removes `.rbn-tab` with a DESCENDANT
    query -- so restore deleted all four tabs and put back a set that no
    longer contained them. applyRibbonLayout() calls restore on every
    apply INCLUDING the one at boot, so the shipped deck came up with an
    empty tablist and no Home/Insert/Design/Object at all.

    Every test here passed throughout, because the markup this file reads
    was always right: the breakage was in what the JS did to that markup
    at runtime. It took opening the editor and counting the tabs. The
    pins below are the shape of the fix; the guarantee is the drive
    recorded in TASKS.md.
    """
    # the snapshot reaches inside the tablist...
    assert "tabset:(function(){" in out
    assert "var s=$('.rbn-tabset');" in out
    # ...restore puts those children back INTO it...
    assert "if(h.tabset){" in out
    assert "h.tabset.kids.forEach(function(k){" \
        "h.tabset.el.appendChild(k);});" in out
    # ...and a generated layout builds its tabs there too, so the role
    # never wraps an empty span
    assert "var set=$('.rbn-tabset',strip)||strip;" in out
    assert "if(before) set.insertBefore(b,before); else set.appendChild(b);" \
        in out
    assert "strip.insertBefore(b,before);" not in out


def test_every_markup_tab_sits_inside_the_tablist():
    """The other half of T151: role="tablist" must wrap the tabs.

    Checked against the markup rather than the assembled page, because
    this is a statement about deck.html's structure.
    """
    from junoview import assets

    html = assets.load("html/deck.html")
    m = re.search(r'<span class="rbn-tabset" role="tablist">(.*?)</span>',
                  html, re.S)
    assert m, "the tablist wrapper is gone"
    inside = m.group(1)
    # five since T176 put Animation back on the strip, six since T200's
    # View tab
    assert inside.count('class="rbn-tab"') == 7, inside.count('class="rbn-tab"')
    assert html.count('class="rbn-tab"') == 7, "a tab escaped the tablist"
    # and the Ribbon layouts door sits with the ribbon's own settings on
    # the right, after Auto-hide, not beside the tabs (T200)
    assert html.index('id="rbn-auto"') < html.index('id="rbn-layouts"') \
        < html.index('id="rbn-fold"')
