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
    """The ask was "heaps of different layouts, so I can try a bunch and
    see what works" (2026-08-25). A chooser with three entries is a
    decision wearing a disguise.
    """
    lays = _layouts(out)
    assert len(lays) >= 15, f"only {len(lays)} layouts"
    # ...and they span the space rather than being one idea relabelled
    ids = " ".join(i for i, _ in lays)
    for family in ("familiar-", "scope-", "sources-", "verbs-", "tasks-",
                   "density-", "journey-"):
        assert family in ids, f"no {family} layout in the catalogue"


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
    # applying does not close it
    assert "applyRibbonLayout(lay.id,true);" in out
    assert "rbnGalleryFill();" in out


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
    assert "applyRibbonLayout(rbnCurrentId(),true);" in out
    i = out.index("applyRibbonLayout(rbnCurrentId(),true);")
    assert "applyRibbonPrefs();" in out[i:i + 400]
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
    assert len(declared) >= 8, declared
    # font-family: would match a bare `family:'...'`, hence the [^-]
    used = set(re.findall(r"[^-]family:'([a-z]+)'", out))
    assert set(declared) == used, (
        f"declared but empty: {sorted(set(declared) - used)}; "
        f"used but undeclared: {sorted(used - set(declared))}")


def test_the_catalogue_recreates_the_applications_people_already_use(out):
    """"Think about what photoshop and power point and others have and
    recreate those" (2026-08-25). Somebody who uses one of these every
    day should find the shape of it here -- the tab names, what shares a
    group, what is up front -- which is a harder promise than "there are
    a lot of layouts", and the one that was actually asked for.
    """
    ids = " ".join(i for i, _ in _layouts(out))
    for app in ("microsoft-powerpoint-2003", "microsoft-word",
                "adobe-raster-options-bar", "adobe-layout-indesign-frames",
                "consumer-pres-keynote", "consumer-design-figma-panel",
                "opensource-inkscape", "opensource-blender",
                "web-slash-bar", "radical-a-to-z"):
        assert app in ids, f"no {app} in the catalogue"


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
