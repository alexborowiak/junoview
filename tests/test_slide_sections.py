"""Slide sections, the deck-wide Apply dialog, custom text types and the
slide strip's width and display modes.

NOT ``test_sections.py`` -- that one is the notebook's markdown-heading
parser, and the two have nothing to do with each other beyond the word.

The four features arrived together on 2026-08-22 from one brief: name the
type an action is about instead of hard-coding "all headings", choose which
properties travel and which slides they travel to, let a deck invent types
of its own, group the slides into sections, and let the strip be resized
and switched between pictures and an outline.

Most of what is pinned here is *persistence*. A field that normPres or the
Python rebuild does not name is not merely un-saved -- it works perfectly
in the browser and vanishes on the next load, which is the failure mode
this file exists to catch early.
"""

from __future__ import annotations

from junoview.notebook.presentations import as_presentations

# --------------------------------------------------------------- sections

def test_a_section_is_a_tag_plus_a_name_and_the_order_is_derived(out):
    """Sections are ``s.sec`` on the slide plus ``pres.sections`` for the
    names; the ORDER is read back off the slide list and never stored.

    Every slide mutation in the editor is a raw splice -- move, delete,
    duplicate, insert, and the strip's own drop handler -- and histRestore
    replaces the array outright. A tag rides through all six for free,
    where a stored start-index would have to be shifted correctly in every
    one of them and would be silently wrong the first time one was missed.
    """
    assert "function sectionRuns(){" in out
    assert "function normSections(){" in out
    # the five verbs, each of which ends by restoring the invariant
    for verb in ("newSection", "renameSection", "foldSection",
                 "removeSection", "moveSlideToSection"):
        assert f"function {verb}(" in out
    # a whole section moves as a block and refinds `cur` by IDENTITY --
    # the single-slide four-branch arithmetic does not generalise to
    # moving n slides at once
    assert "function moveSection(id,beforeAt){" in out
    assert "pres.slides.indexOf(keep)" in out


def test_a_divider_row_is_not_a_slide_row(out):
    """``.film-sec`` carries neither the ``film-row`` class nor a
    ``data-idx``.

    refreshThumb looks up ``.film-row[data-idx="N"]`` and takes the first
    match, so a divider wearing either would quietly collect a slide's
    thumbnail on every edit.
    """
    assert "el.className='film-sec'" in out
    assert "el.dataset.sec=r.id;el.dataset.at=r.at;" in out
    # the slide loop stays FLAT, which is what keeps the numbers global
    # (1..n straight through every section) and data-idx equal to the
    # array index
    assert "pres.slides.forEach(function(s,i){" in out
    assert "if(head[i]) list.appendChild(secRow(head[i]));" in out
    assert "num.textContent=(i+1);" in out


def test_the_current_slide_is_drawn_even_inside_a_folded_section(out):
    """Folding hides the run -- except the slide you are standing on.

    It is also the row refreshThumb goes looking for after every edit, so
    hiding it would freeze the live thumbnail for as long as the section
    stayed shut.
    """
    assert "if(fold[i]&&i!==cur) return;" in out
    assert "peek" in out


def test_a_drop_on_a_divider_answers_two_questions(out):
    """Where in the array, and which section the slide now belongs to.

    On a divider the two are decided by the SAME midpoint from opposite
    sides: above it is the end of the run before, below it is the start of
    the run after. Same index, different owner.
    """
    assert "function filmDropTarget(row,clientY){" in out
    assert "return {to:at,sec:(prev&&prev.sec)||''};" in out
    assert "return {to:at,sec:id};" in out
    # the moved slide JOINS what it landed in, or normSections drags it
    # straight back and the drag looks like it did nothing
    assert "if(tgt.sec) moved.sec=tgt.sec; else delete moved.sec;" in out


def test_stepping_a_slide_across_a_divider_retags_both(out):
    """``moveSlide`` swaps two slides, so BOTH take the section of the
    neighbour on their far side -- the one outside the pair.

    Without it the arrow button moved the slide, normSections put the tag
    back on the next pass, and the button looked like it had done nothing.
    """
    assert "var sj=far(j,d),si=far(i,-d);" in out
    # an inserted slide joins the run it was inserted into, or it splits
    # the section and grows a divider out of nowhere
    assert "if(prev&&prev.sec) pres.slides[at].sec=prev.sec;" in out


def test_sections_survive_normpres_and_the_python_rebuild(out):
    """Both whitelists name ``s.sec`` and ``pres.sections``."""
    assert "if(typeof s.sec==='string'&&s.sec) o.sec=s.sec;" in out
    # deck-level names are FILTERED to ids a slide still uses, so a deck
    # that never used sections serialises exactly as it did before
    assert "out.slides.forEach(function(s2){if(s2.sec) used[s2.sec]=1;});" in out
    assert "if(anySec) out.sections=keep;" in out


def test_python_rebuild_keeps_sections_and_custom_types():
    """The two whitelists must agree, as they had to for speaker notes.

    ``sections`` is a dict and joins the existing tuple; ``types`` is a
    LIST and cannot -- that loop guards ``isinstance(..., dict)``. Missing
    the list branch is the quiet failure: custom types work perfectly in
    the browser and vanish the moment the deck is saved to the project and
    reopened.
    """
    pres = as_presentations([{
        "name": "n",
        "types": [{"id": "t1", "label": "Pull quote", "size": 3.1,
                   "i": 1, "head": 1},
                  {"label": "no id, dropped"}],
        "sections": {"s1": {"name": "Results", "fold": 1}},
        "slides": [{"layout": "blank", "sec": "s1"},
                   {"layout": "blank"}],
    }])
    p = pres[0]
    assert p["types"] == [{"id": "t1", "label": "Pull quote", "size": 3.1,
                           "i": 1, "head": 1}]
    assert p["sections"]["s1"]["name"] == "Results"
    assert p["slides"][0]["sec"] == "s1"
    assert "sec" not in p["slides"][1]


def test_the_fold_flag_is_saved_but_never_undone(out):
    """Whether a section is collapsed is a way of LOOKING at the strip,
    not an edit to the deck.

    So it rides the file but is stripped out of the undo snapshot, and
    histRestore merges names while preserving the current fold flags --
    Ctrl+Z must never open or close a section.
    """
    assert "function secNames(){" in out
    assert "sections:secNames()," in out
    assert "markDirty(true);renderFilm();" in out          # foldSection
    assert "if(was[k]&&was[k].fold) pres.sections[k].fold=1;" in out


# ----------------------------------------------------------- custom types

def test_a_deck_can_invent_its_own_text_types(out):
    """``pres.types`` is grafted into STYLE_DEFAULTS at load.

    Four places index ``STYLE_DEFAULTS[id]`` directly and every menu,
    specimen row and exporter reads the registry without asking whether an
    id is built in -- so one live registry fixes all of them at once and
    changes none of them.
    """
    assert "var BUILTIN_STYLE_IDS=STYLE_ORDER.slice();" in out
    assert "function syncCustomTypes(){" in out
    assert "function styleOrder(){" in out
    for fn in ("customTypes", "mintTypeId", "addCustomType",
               "deleteCustomType", "isHeadingStyle", "headingStyles"):
        assert f"function {fn}(" in out
    # STYLE_ORDER itself is untouched: BUILTIN_STYLE_IDS is taken from it
    assert "var STYLE_ORDER=['title','h1','h2','h3','body','small','caption'];" in out


def test_syncing_the_registry_survives_running_before_it_exists(out):
    """histReset runs during boot, from loadPresentation -- and the first
    presentation is loaded ABOVE the line that assigns STYLE_DEFAULTS.

    Function declarations hoist; ``var`` initialisers do not, so the
    registry is genuinely undefined on that one call. It threw, the whole
    deck IIFE died from that point on, and the editor silently lost every
    handler wired below it. Nothing in the rendered HTML shows that, which
    is why it is pinned here.
    """
    assert "if(!STYLE_DEFAULTS) return;" in out
    # ...and the boot sequence calls it again once everything is declared
    assert "syncCustomTypes();\n  status();" in out


def test_deleting_a_type_moves_nothing(out):
    """applyStyleTo has already written every property onto each box, so
    dropping the NAME leaves the slides looking exactly as they did.

    Guarded on ``a.k==='text'`` because ``a.style`` on a line or an arrow
    is the DASH style and shares nothing with this but the word.
    """
    assert "if(a&&a.k==='text'&&a.style===id){delete a.style;n++;}" in out


def test_custom_types_are_whitelisted_everywhere(out):
    """normPres, the undo snapshot and histRestore all name ``types``."""
    assert "types:(pres.types&&pres.types.length)?pres.types:null," in out
    assert "if(d.types) pres.types=d.types; else delete pres.types;" in out
    # a file naming a built-in id would silently redefine Heading 1 for
    # everybody who opened it
    assert "if(BUILTIN_STYLE_IDS.indexOf(t.id)>=0) return;" in out
    # the undo array literal is NOT touched -- types are restored by their
    # own statement after it, so the registry can be re-grafted
    assert ("['wmark','head','foot','styles','tokens','components','cuts',\n"
            "     'page','pageBg',") in out


def test_a_text_box_can_be_born_wearing_a_type(out):
    """The caret beside Insert > Text arms the next box's type.

    Factored into textBorn so the armed type has ONE place to be honoured
    and a user who never opens the caret gets a byte-identical annot.
    """
    assert "var pendingStyle='';" in out
    assert "function textBorn(p0){" in out
    assert ("if(pendingStyle&&styleDef(pendingStyle)) "
            "applyStyleTo(a,pendingStyle);") in out
    assert 'id="tx-type-btn"' in out and 'id="tx-type-menu"' in out
    # the caret carries NEITHER `et` NOR data-tool: that exact pairing is
    # what armed setTool(undefined) off #dc-qr
    caret = out.split('id="tx-type-btn"')[1][:200]
    assert "data-tool" not in caret


def test_the_armed_type_never_widens_the_ribbon_label(out):
    """A label whose width changes with what you clicked would make the
    ribbon's required width depend on the selection, and the fit ladder
    has no rung left to absorb that.

    The armed type shows in the caret's tooltip and in the tool hint,
    exactly where pendingShape already shows.
    """
    assert "Text · " not in out
    assert "The next text box will be a " in out
    assert "' box, or click for one that sizes itself')" in out


# ------------------------------------------------------------ apply dialog

def test_the_action_names_the_type_it_is_about(out):
    """"Apply to all headings" was a fixed list of four, text only, whole
    deck, every property. All three open up, and the type is named.
    """
    assert 'id="aa-dlg"' in out and 'id="aa-what"' in out
    assert "function typeKeyOf(a){" in out
    assert "function typeLabel(key,plural,src){" in out
    # matchKey is NEVER edited: Match slide's pairing depends on its exact
    # semantics, and every deck already built with it
    assert "if(a.k==='text') return 'text:'+(a.style||'body');" in out
    # a frame is keyed by the part it ACTUALLY shows, so a figure on
    # 'auto' and one set to 'figure' are not two buckets
    assert "if(a.k==='cell') return 'cell:'+partOf(a);" in out


def test_unstyled_text_is_grouped_by_size_not_lumped_together(out):
    """Most decks have never used a named style -- which is the whole
    reason the standardise check exists.

    Bucketing every unstyled box together meant "apply to all objects of
    this type" on a heading pushed its look onto every caption in the
    deck. Quantised in log space at the same ~6% the standardise bands
    use, because a type scale is multiplicative.
    """
    assert "function textBand(a){" in out
    assert "Math.log((a&&a.size)||2.6)/Math.log(1.06)" in out
    assert "return a.style?('text:'+a.style):('text:~'+textBand(a));" in out


def test_the_count_excludes_the_item_you_copied_from(out):
    """Counting it made the button promise "Apply to 1" and then do
    nothing at all, because applyToType skips the source."""
    assert "function typeCount(key,idxs,src){" in out
    assert "if(a&&a!==src&&!a.hide&&typeKeyOf(a)===key) n++;" in out


def test_the_type_is_choosable_not_merely_reported(out):
    """An unstyled box is grouped by size, so the moment you make one
    heading bigger it is alone in its band and the action has nothing left
    to apply to -- which is precisely the flow the feature is for.
    """
    assert "function deckTypeKeys(idxs,src){" in out
    assert "aa-chipbtn" in out
    # built in JS rather than shipped in the markup: its rows are the
    # types this deck actually has, which is not knowable until it loads
    assert "pick.id='aa-typemenu';" in out
    assert "menuHead(pick,'change every…');" in out


def test_every_property_the_brief_named_can_be_unticked(out):
    """Everything on by default, each one deselectable: text size,
    spacing, indentation, width, height, x and y position.
    """
    assert "var APPLY_PROPS=[" in out
    for label in ("'Text size'", "'Line spacing'",
                  "'Space between paragraphs'", "'Indentation'",
                  "'Width'", "'Height'", "'Left / right position'",
                  "'Up / down position'", "'Box background'"):
        assert label in out
    # a row that does not fit the selected kind is greyed and explained,
    # never hidden -- a list that reshuffles when you click a different
    # object is one you have to re-read every time
    assert "aa-no" in out and "var APPLY_WHYNOT=" in out


def test_every_applied_field_is_a_field_match_props_actually_copies():
    """The copy loop walks MATCH_PROPS, so a field named in APPLY_PROPS
    and missing from MATCH_PROPS is a checkbox that does nothing at all.

    This is the drift guard: it is the only thing standing between a new
    picker row and a control that silently lies.
    """
    import re

    from junoview import assets
    js = assets.deck_js()
    match = set(re.findall(r"'([a-z0-9]+)'",
                           js.split("var MATCH_PROPS=[")[1].split("];")[0]))
    body = js.split("var APPLY_PROPS=[")[1].split("\n  ];")[0]
    applied = set()
    for row in re.findall(r"\[([^\[\]]*)\]\]", body):
        applied |= set(re.findall(r"'([a-z0-9]+)'", row.split(",[")[-1]))
    missing = applied - match
    assert not missing, (
        f"APPLY_PROPS names {sorted(missing)}, which MATCH_PROPS does "
        "not copy -- ticking those rows would do nothing")


def test_a_sweep_over_forty_slides_is_one_undo_step(out):
    """markDirty pushes the history entry, so it is called ONCE at the end
    of the sweep and never per item -- and refresh() follows it because
    markDirty only repaints the CURRENT slide's thumbnail.
    """
    body = out.split("function applyToType(key,src,want,idxs){")[1]
    body = body.split("\n  }")[0]
    assert body.count("markDirty();") == 1
    assert "markDirty();refresh();" in body
    # scope is an ARRAY of indexes, never null: a bug producing null would
    # have to mean "the whole deck", the most destructive reading available
    assert "function scopeIdxs(){" in out
    assert "var scopeOff=new WeakMap();" in out


def test_the_deck_background_can_really_be_pushed_to_every_slide(out):
    """The deck default only shows through where a slide has no override,
    so on any slide that HAS one the "Every slide" chips silently did
    nothing -- you set the background for every slide and watched the one
    in front of you not change.
    """
    assert "id='bg-pushall'" in out or "aa-" in out
    assert "Use this on every slide (clears per-slide ones)" in out
    assert "(pres.slides||[]).forEach(function(x){if(x) delete x.bg;});" in out


def test_a_table_that_says_no_fill_has_no_fill(out):
    """drawTable painted ``a.bgc`` and never checked ``a.bg``, so the
    format bar's swatch and the renderer disagreed and setting a table to
    "no fill" did nothing."""
    # through tokVal since T12 -- an identity for every colour that
    # is not a "@token" reference, so this rule is unchanged for a hex
    assert ("if(a.bg!==0&&a.bgc) host.style.background=tokVal(a.bgc);"
            ) in out


# ------------------------------------------------------- standardise text

def test_standardise_answers_for_the_deck_nobody_has_styled(out):
    """A check that only read ``a.style`` would look at forty slides of
    hand-set text, find no styles to disagree, and report "all fine".

    That is not a weak answer, it is a false one -- so the boxes wearing
    nothing are bucketed by what they LOOK like and the bucket is then
    offered a name.
    """
    assert 'id="dsg-std"' in out and 'id="stdpane"' in out
    assert "Standardise text" in out
    assert "function stdBands(boxes){" in out
    assert "function stdName(bands){" in out
    # named biggest-first in LOG space with styles consumed as they go, so
    # the naming is MONOTONE and a bigger band never gets a smaller style
    assert "Math.abs(Math.log(b.size/styleDef(id).size))" in out
    assert "left=left.filter(function(id){return id!==b.suggest;});" in out


def test_standardise_leaves_the_print_check_alone(out):
    """preflight is current-slide by contract, its row is a whole button,
    and its strings are pinned elsewhere. This is a second pane."""
    assert "function preflight(){" in out
    assert "function standardise(){" in out
    assert "function renderStdPane(){" in out
    assert "window.SemDeckStandardise=standardise;" in out
    # and it joins the panes that share the corner
    assert "'stdpane'" in out


def test_adopting_a_band_does_not_punish_you_for_tidying_up(out):
    """Stamping STYLE_DEFAULTS' values onto the band would resize and
    recolour the MAJORITY of it.

    The definition is built from the band's own commonest values first, so
    the majority does not move a pixel, only the strays snap into line,
    and the deck ends up with a style whose numbers are what it already
    looked like.
    """
    body = out.split("function stdAdopt(band){")[1].split("\n  }")[0]
    assert "deckStyles()[id]=o;" in body
    assert "o={label:d.label,size:band.size}" in body
    assert "stdFix(band.boxes," in body


def test_nothing_the_check_finds_is_reported_as_an_error(out):
    """Nothing it finds is broken, and a consistency check that shouts is
    one people stop opening. Two empty states, no 'err' severity."""
    std = out.split("function standardise(){")[1].split(
        "function renderStdPane(){")[0]
    assert "sev:'err'" not in std
    assert "Nothing is drifting" in out
    assert "Your type is consistent." in out


# ------------------------------------------------------------- the strip

def test_the_slide_column_can_be_dragged_wider(out):
    """200px was the RESTING width, but it was written as a hard cap with
    the resize handle hidden beside it -- so the slide column was the one
    part of the editor nobody could make bigger.

    The old expression stays as the clamp's DEFAULT, so a session that has
    never touched the handle is unchanged.
    """
    assert "clamp(150px,var(--film-w,min(var(--dc-w),200px)),46vw)" in out
    assert 'id="film-resize"' in out
    # --film-w on the deck, never --dc-w: the document view's own margin
    # reads that one, so overloading it makes dragging the slide column
    # shove the notebook sideways
    assert "deckEl.style.setProperty('--film-w',w+'px');" in out
    assert "min(var(--dc-w),200px)" in out


def test_a_thumbnail_grows_with_the_room_it_is_given(out):
    """MINI_H is the FLOOR now, not the height -- a 460px strip drawing
    3px lettering is not a thumbnail.

    Measured off the LIST, because renderFilm sizes type before the node
    is in the document and an unattached node has no height to read.
    """
    assert "var MINI_H=66;      /* mirrors --mini-h in deck.css */" in out
    assert "--mini-h:66px;" in out
    assert "var MINI_AR=116/66,miniHNow=MINI_H;" in out
    assert "miniHNow=miniH();" in out


def test_the_strip_lists_slides_three_ways(out):
    """Thumbnails (default), headings, or both."""
    assert 'id="film-view-btn"' in out
    assert "var FILM_VIEWS=[['thumb','Thumbnails','Pictures']," in out
    # stamped ONCE on the list, not per row and not on the body: filmToPane
    # MOVES this list into the Versions pane and an ancestor class would be
    # left behind
    assert "list.setAttribute('data-fv',fv);" in out
    assert '#film-list[data-fv="head"]' in out
    # in headings mode no thumbnail is BUILT, not one built and hidden
    assert "} else if(fv!=='head'){" in out


def test_headings_mode_is_a_real_outline(out):
    """A slide is named by the box wearing a heading STYLE when it has
    one, and by slideTitle's guesswork only when it does not."""
    assert "function slideHeading(s){" in out
    assert "function headLevel(s){" in out
    assert "function filmText(s){" in out
    # ONE source for the words, so refreshThumb cannot rename a row back
    # to the other function's answer on the first edit
    assert "if(tt) tt.textContent=filmText(s);" in out


def test_the_mode_and_the_width_are_preferences_not_document_state(out):
    """Sending someone a presentation must not send them your column
    width. Both live in localStorage beside the ribbon fold.

    Read through a lazy gate because SCOPE is declared further down the
    file: resolving at var-declaration time files every preference under
    the literal string "undefined".
    """
    assert "var FILMKEY='jv-deck-film:',FILMWKEY='jv-deck-filmw:';" in out
    assert "var filmView=null;" in out
    assert "if(filmView===null){" in out
    assert "lsSet(FILMKEY+SCOPE,m);" in out


def test_a_section_moves_and_copies_as_one_thing(out):
    """TASKS T23. Sections already existed as a model and half a UI --
    a `sec` tag on the slide, a names map, the contiguous-run invariant
    normSections restores after every mutation, dividers, fold, rename,
    remove. What was missing is that the section did not behave like ONE
    thing.

    Because membership is the tag ON each slide, the tags travel with
    the slides when the run moves and normSections has nothing to
    repair. A duplicated run needs a NEW id, because two runs sharing
    one id is exactly the state the contiguity invariant forbids.
    """
    assert "function moveSection(id,dir){" in out
    assert "function dupSection(id){" in out
    assert "var dest=(dir<0)?other.at:(other.at+other.n-me.n);" in out
    assert "cp.sec=nid;          /* a NEW id: two runs cannot share one */" \
        in out
    assert "var name=(secName(id)||'Section')+' copy';" in out
    # and both end in normSections, like every other section verb
    assert "    normSections();\n    cur=dest;" in out


def test_section_numbering_is_a_choice_not_a_reversal(out):
    """Slide numbers are global by deliberate decision -- renderFilm's
    comment says so and the furniture resolves {n} to the deck index.
    That is right for the strip and wrong for a talk in parts, so the
    section's numbers are ADDED beside them rather than replacing them.
    Nothing that already existed changes meaning.
    """
    assert "function sectionPos(i){" in out
    assert ".replace(/\\{sn\\}/g,String(sp.n))" in out
    assert ".replace(/\\{sN\\}/g,String(sp.of))" in out
    assert ".replace(/\\{sec\\}/g,sp.name||'')" in out
    # the deck-wide ones are untouched, and still resolved after
    assert ".replace(/\\{n\\}/g,String(idx+1))" in out


def test_a_cut_is_membership_on_the_slide(out):
    """TASKS T24. The problem is three files called talk-45, talk-20 and
    talk-5, diverging from the day they were copied.

    Membership lives ON THE SLIDE -- `opt` and `cuts` -- for the reason
    sections chose the same shape and recorded it: membership stored on
    the slide travels through every splice, drag, duplicate and undo for
    free, while a stored list of indexes has to be repaired after each
    of them and eventually will not be. pres.cuts holds only the NAMES,
    exactly as pres.sections does.

    A slide naming no cuts is in EVERY cut, which is what makes the
    feature adoptable: an existing deck is already a complete
    "everything" version.
    """
    assert "function inCut(sl,cut){" in out
    assert "if(!c||!c.length) return true;" in out
    assert "function slideSkipped(i){" in out
    assert "function nextShown(from,dir){" in out
    # which cut you are rehearsing is session state, not deck state
    assert "var showCut='',lateFrom=-1;" in out
    # both keys survive a save, on both sides
    assert "if(s.opt) o.opt=1;" in out
    assert "cuts:(pres.cuts&&Object.keys(pres.cuts).length)?pres.cuts:null," \
        in out


def test_the_filter_lives_in_the_two_verbs_the_talk_runs_on(out):
    """A cut or a running-late skip is a fact about what to show NEXT,
    which is exactly what advance() asks -- so the filter goes there and
    in backStep, rather than in twenty callers.

    And it is playback only. A slide you have cut is still a slide you
    are editing, and hiding it from the strip is how you would lose it.
    """
    assert "var nx=nextShown(cur,1);" in out
    assert "var pv=nextShown(cur,-1);" in out
    assert "if(lateFrom>=0&&i>cur&&sl.opt)" in out or \
           "if(lateFrom>=0&&i>lateFrom&&sl.opt) return true;" in out


def test_running_late_starts_from_here(out):
    """TASKS T25, and three lines once T24 exists. From the CURRENT
    slide onward: what you have already shown is not the problem, and
    un-showing it is not on offer. Deliberately not a cut -- you do not
    choose it before the talk.
    """
    assert "function runLate(on){" in out
    assert "lateFrom=on?cur:-1;" in out
    assert "function toggleOptional(i){" in out
    assert "function toggleSlideCut(i,id){" in out
    # an empty cut list is dropped rather than stored, the same
    # empty-is-absent rule sections and styles follow
    assert "if(c.length) sl.cuts=c; else delete sl.cuts;" in out


def test_the_overview_is_a_navigation_layer_not_a_canvas(out):
    """TASKS T26, and TASKS.md is careful about what it is: "the
    realistic scope of the infinite-canvas wish -- an overview /
    navigation layer, not canvas-based authoring". That boundary is why
    it can be an overlay over the existing model rather than a second
    editor.

    An OVERLAY and not a pane: every pane docks beside the stage and
    takes width from the page, and this wants the opposite -- all the
    room there is while you look, and none afterwards. Same shape as the
    spotlight and the presenter view.
    """
    assert "function openOverview(){" in out
    assert "function overviewClose(){" in out
    assert ".deck-overview{position:fixed;inset:0;" in out
    # it draws what already exists and computes no fact of its own,
    # which is why it cannot disagree with the strip it zooms out of
    assert "var runs=sectionRuns();" in out
    assert "tile.appendChild(miniDiagram(sl));" in out
    assert "+(slideSkipped(i)?' cut':'');" in out


def test_the_overview_closes_before_the_editors_esc_ladder(out):
    """Esc has a ladder in this editor -- trim mode, then the group you
    stepped into, then the tool, then the selection, then the mode. The
    map is inner to all of it, so it listens in CAPTURE and stops the
    event: the innermost state wins, which is the rule that ladder
    already follows.
    """
    assert "document.addEventListener('keydown',overviewKey,true);" in out
    assert "e.preventDefault();e.stopPropagation();overviewClose();" in out
    # and it is reached from the menu that already asks "how do I want to
    # look at this deck"
    assert "['overview','Overview map\u2026','Overview map\u2026']];" in out
    assert "if(m==='overview'){openOverview();return;}" in out


def test_a_slide_says_how_it_arrives(out):
    """TASKS T27, and the substrate T23 said it lacked.

    There was no transition model in this codebase at all -- not a
    missing feature, a missing FIELD. `s.trans` is per-slide because
    that is how anyone thinks about it ("this one flies in from the
    last"), with a SECTION default underneath it, which is what makes
    T23's section transitions real rather than a note.
    """
    assert "function transFor(i){" in out
    # the slide's own, else its section's, else none -- in that order
    assert "if(typeof sl.trans==='string') return sl.trans;" in out
    assert "if(sec&&typeof sec.trans==='string') return sec.trans;" in out
    assert "function setTrans(i,kind){" in out
    assert "function setSectionTrans(id,kind){" in out


def test_continuity_reuses_the_identity_T10_already_minted(out):
    """The hard part -- knowing that THIS square is THAT square on the
    next slide -- was already solved. `ensureOids` de-duplicates within
    a slide but never across them, so a DUPLICATED slide keeps its
    source's oids, which is exactly how a Magic Move gets built.

    matchKey plus reading order is the fallback for the pair of slides
    that were authored separately -- the same pairing Match slide has
    always used, rather than a second idea about sameness.
    """
    assert "function flipKeys(sl){" in out
    assert "var k=a.oid?('o:'+a.oid):null;" in out
    assert "k='m:'+mk+':'+seen[mk];" in out


def test_the_animation_is_flip_so_there_is_no_second_renderer(out):
    """Measure the outgoing slide, let renderSlide rebuild the page
    exactly as it always does, then put the survivors back with a
    transform and take it away. No item is drawn twice and no state is
    duplicated -- and if anything goes wrong the page underneath is
    already correct.

    The measurement has to happen BEFORE the rebuild, because
    renderSlide empties the stage.
    """
    assert "function captureFlip(fromIdx){" in out
    assert "function playFlip(){" in out
    assert "captureFlip(prev);" in out
    assert out.index("captureFlip(prev);") < out.index("playFlip();")


def test_the_flip_composes_with_rotation_rather_than_erasing_it(out):
    """applyCommon owns `transform` for a.rot. A flip that CLEARED the
    property would un-rotate every rotated object mid-talk, so the FLIP
    transform is PREFIXED onto whatever is there and removed by putting
    the original string back.

    Verified in a browser rather than only here: mid-flight the matrix
    keeps the 30-degree components while translating, and the object
    lands rotation-only.
    """
    assert "el.dataset.jvFlip=base;" in out
    assert "+sx.toFixed(4)+','+sy.toFixed(4)+') '+base;" in out
    # restored, never cleared
    assert "el.style.transform=el.dataset.jvFlip||'';" in out


def test_reduced_motion_is_answered_rather_than_ignored(out):
    """core.css already turns every transition off under
    prefers-reduced-motion, so the animation could not have played
    anyway -- playFlip would have moved twelve elements to produce a
    cut. Asking first means the preference is honoured deliberately,
    and it is why the menu can say so instead of offering a control
    that quietly does nothing.
    """
    assert "function motionOK(){" in out
    assert "matchMedia('(prefers-reduced-motion: reduce)').matches" in out
    assert "if(!from||mode!=='view'||!motionOK()) return;" in out
    assert "not on this machine" in out
