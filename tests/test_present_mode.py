"""Full-screen present mode and its floating control bar. The bar carries the
app bar's real controls (moved, not duplicated) in a collapsible tray with
only Exit outside it, reproduces the ribbon's labelled groups rather than
flattening them, shares the app bar's theming and sizing in both themes,
docks to an edge and insets the document instead of floating over it, slides
off-screen on either axis, and folds toward its docked edge with a restore
arrow.
"""

from __future__ import annotations


def test_present_bar_slides_in_and_docks(out):
    """The present bar hides off-screen on either axis and measures its own
    size so it can dock; leaving is always one labelled button away."""
    assert "translateY(-101%)" in out and "translateX(101%)" in out
    assert "function measurePb" in out and "function applyPbDock" in out
    assert "Exit presentation</button>" in out


def test_present_mode_moves_the_real_controls_into_a_tray(out):
    """Present mode carries the REAL filter/code controls in a collapsible
    tray (moved, not duplicated) -- only Exit stays outside it -- and the
    section sidebar can slide back in.

    The presenting controls ARE the app bar's (same .toggle class, not a
    bespoke look-alike), the dock choice is remembered, and the
    fixed-position filter menus ride into the fullscreen layer with them.
    """
    assert 'id="pb-tools"' in out and 'class="pb-own"' in out
    assert "function pbTakeTools" in out and "function pbReturnTools" in out
    assert 'id="pb-rail"' in out and "body.doc-presenting.present-rail" in out
    assert 'id="pb-move"' in out and "'junoview:presentbar:dock'" in out
    assert '<button class="toggle" id="pb-rail" aria-pressed="false"' in out
    assert '<button class="toggle pb-exit" id="pb-exit"' in out
    assert '<button class="toggle" id="pb-auto"' in out
    # …and the fixed-position filter menus ride into the fullscreen layer
    assert "var PB_MENUS=" in out


def test_present_bar_reproduces_the_appbar_ribbon_groups(out):
    """The present bar takes the whole labelled SECTIONS, so it reproduces
    the ribbon grid instead of flattening the groups into its own wrap flow.
    The app bar reads as groups because of full-height separators between
    them.
    """
    assert ("var PB_TOOLS=['#ab-filters','#ab-scope','#ab-size','#ab-view'];"
            in out)
    assert ".appbar-div{flex:none;width:1px;height:70px" in out
    # 3 plain ribbon dividers (the third closes View off from the
    # right-aligned App group) + 2 grouping the custom-view styling bar
    # (the other 2 carry filt-div and disappear with the filters in tree)
    assert out.count('class="appbar-div"') == 5


def test_present_bar_has_one_fold_button_and_autohide(out):
    """Present mode: button, floating control bar + its restore edge-arrow."""
    assert 'id="doc-present"' in out and 'id="present-bar"' in out
    # ONE fold/unfold button, pinned in one place, plus taskbar auto-hide
    assert 'id="present-bar-show"' in out and 'class="pb-toggle"' in out
    assert 'id="pb-collapse"' not in out
    assert 'id="pb-auto"' in out and "body.pb-auto.pb-peek" in out
    # presenting: hiding itself is the DEFAULT, "Pin" keeps it in place
    assert "'junoview:presentbar:pinned'" in out
    assert "var pbAuto=!pbPinned" in out and "Auto-hide</span></button>" in out


def test_present_bar_docks_and_insets_the_document(out):
    """The bar DOCKS (top = the app bar verbatim, right = groups as rows),
    insets the document instead of floating over it, and folds toward the
    edge it is docked on."""
    assert ("function enterDocPresent" in out
            and "function exitDocPresent" in out)
    assert "body.doc-presenting" in out and "pb-folded" in out
    assert "body.pbpos-top .present-bar" in out
    assert "body.pbpos-right .present-bar" in out
    assert "body.doc-presenting.pbpos-top .docs{top:var(--pbh" in out
    assert "body.doc-presenting.pbpos-right .docs{right:var(--pbw" in out


def test_present_bar_shares_appbar_toggle_theming_and_sizing(out):
    """The present bar shares the app bar's button theming.

    It used to fall back to the LIGHT styling in dark mode. Sub filter
    buttons are comfortably tall; expanded tree nodes widen.
    """
    assert ".appbar .toggle,.present-bar .toggle{" in out
    assert "body.light .appbar .toggle,body.light .present-bar .toggle{" in out
    assert ".appbar .toggle.sub,.present-bar .toggle.sub{height:28px" in out
    assert ".tree-node.expanded{width:min(380px" in out


def test_presenting_outline_rail_reaches_the_floor(out):
    """The outline rail is full height while presenting.

    Docked, the rail is sized `100vh - --chrome-h` so it clears the app
    ribbon. Presenting hides that ribbon and pins the rail top:0/bottom:0 --
    but an explicit height beats `bottom`, so without resetting it the rail
    stopped exactly one ribbon-height short of the floor.
    """
    assert "body.doc-presenting.present-rail .nbshell .rail{display:block;" in out
    assert "position:fixed;left:0;top:0;bottom:0;width:290px;z-index:84;" in out
    assert "height:auto;" in out


def test_presenter_view_is_a_second_window(out):
    """2026-08-20, user: "presentation mode where you can have like the
    different screens one with the slides and the other with like notes
    and the next slide and stuff when you have multiple screens".

    A POPUP you drag to the other display, not an automatic placement.
    The Window Management API that can put a window on a named screen is
    Chromium-only and needs a permission prompt; a popup works in every
    browser and on every setup, including the common one where the second
    screen is a projector the OS is mirroring.

    The slides in it are REAL renders, not pictures: buildSlideNode runs
    the same renderAnnots every other output uses and the nodes are
    imported into the popup, so the presenter view cannot drift from what
    is on the screen behind it.

    Verified live: clock ticking, "2 / 2", "target 2:30", "talk 3 min",
    the notes text, one real .slide node, "end of the deck" for next --
    and Back in the presenter moved the main window to 1 / 2.
    """
    assert "function openPresenter(){" in out
    # `priv` is opt-in, so the default render is the safe one (T31)
    assert "function buildSlideNode(i,priv){" in out
    assert "buildSlideNode(pr[1],true)" in out
    assert "function presenterPush(){" in out
    assert "function presenterCommand(msg){" in out
    assert 'id="pl-presenter"' in out
    # every stylesheet rides along, or the imported nodes are unstyled
    assert "$$('style').forEach(function(st){css+=st.textContent" in out
    # presenter view does NOT start playback: you want to move the window
    # to the other screen before anything goes full screen
    assert "mi('#pl-presenter',openPresenter);" in out
    # navigation in the main window tells the presenter
    assert "function presenterSync(){" in out


def test_running_late_is_reachable_during_the_talk(out):
    """T48. The original T25 control was built inside ``#play-menu``.
    That menu belongs to ``#deck-qat``, and present mode hides the whole
    QAT -- so the mid-talk escape hatch existed only before or after the
    talk.

    The presenter bar is the chrome that remains on screen. Its control
    keeps both its words and icon, says when it is on, and ``L`` clicks
    that same button so the mouse and keyboard routes cannot drift.
    """
    assert 'id="deck-topright"' in out
    assert 'id="deck-late"' in out
    assert "function syncLateButton(){" in out
    assert "b.hidden=(mode!=='view');" in out
    assert "b.setAttribute('aria-pressed',on?'true':'false');" in out
    assert "b.innerHTML=bic('flag')+(on?' Running late: on'" in out
    assert "var late=$('#deck-late');" in out
    assert "if(late){e.preventDefault();late.click();}" in out
    assert "['#deck-late','L']" in out
    assert "presentation bar (or press <kbd>L</kbd>)" in out
    # There is no second, unreachable copy left in Present's edit menu.
    assert "lb.textContent=(lateFrom>=0)?'Running late: on'" not in out


def test_presenting_closes_the_notes_pane_before_render(out):
    """An editing pane must not survive the transition after its ribbon
    button disappears. The synchronous dock update matters: the observer
    runs on a later turn, after present mode has already fitted the slide.
    """
    start = out.index("function setUIMode(m){")
    body = out[start:out.index("  function refresh(){", start)]
    assert "var np=$('#notespane'); if(np) np.hidden=true;" in body
    assert "var nb=$('#notes-btn');" in body
    assert "if(nb) nb.setAttribute('aria-pressed','false');" in body
    assert "syncPaneDock();" in body
    assert body.index("np.hidden=true") < body.index("syncPaneDock();")
    assert body.index("syncPaneDock();") < body.index("renderSlide();")


def test_presenter_preview_and_numbering_follow_the_playback_filter(out):
    """Named cuts and Running late can leave gaps in raw slide indexes.
    The presenter must preview the slide ``advance`` will actually reach,
    and both halves of its counter must describe that same shown set.
    """
    start = out.index("function presenterPush(){")
    body = out[start:out.index("  function presenterHtml(){", start)]
    assert "var shown=shownSlides(),shownAt=shown.indexOf(cur);" in body
    assert "var next=nextShown(cur,1);" in body
    assert "['jvp-next',next]" in body
    assert "pr[1]>=0&&pr[1]<n" in body
    assert "(shownAt>=0?shownAt+1:0)+' / '+shown.length" in body
    assert "count:shown.length" in body
    assert "['jvp-next',cur+1]" not in body
    assert "(cur+1)+' / '+n" not in body


def test_every_real_rehearsal_exit_records_and_repaints(out):
    """Stopping via the UI, SPA routing, and closing the physical page
    are all ends to a run. Merely changing windows is not. A kept run also
    redraws the already-selected Rehearsals tab instead of leaving its
    empty-state message behind.
    """
    start = out.index("function rehStop(){")
    stop = out[start:out.index("  function rehStats(){", start)]
    assert "rehSave(runs);" in stop
    assert "renderReh();" in stop
    assert stop.index("rehSave(runs);") < stop.index("renderReh();")

    start = out.index("function lastChance(e){")
    leave = out[start:out.index("  function editableText(", start)]
    assert "if(e&&e.type==='pagehide'){" in leave
    assert "try{rehStop();}catch(err){}" in leave
    assert "window.addEventListener('pagehide',lastChance);" in leave
    hidden = leave[leave.index("visibilitychange"):]
    assert "if(document.visibilityState==='hidden') lastChance();" in hidden
    assert "lastChance(document" not in hidden

    start = out.index("function closeDeck(){")
    close = out[start:out.index("  /* ---- URL routing hooks", start)]
    assert "if(mode==='view') rehStop();" in close


def test_speaker_notes_and_time_goals(out):
    """Notes are per slide and never drawn on the page -- they exist for
    the presenter view and for you. The per-slide goal is in minutes and
    the pane adds them up, so a talk that cannot fit its slot says so
    before you give it rather than during (2026-08-20, user: "you can set
    time goals per slide and have a timer per slide and shows you time
    remaining and/or total time and or time over").

    Measured: "1 slide timed - 2:30 total, leaving 0:30 of your 3
    minutes".
    """
    assert 'id="notespane"' in out
    assert "function renderNotesPane(){" in out
    assert "function slideGoal(sl){" in out
    assert "function goalTotal(){" in out
    # they survive a save, which is where per-slide fields usually die
    assert "if(typeof s.notes==='string'&&s.notes) o.notes=s.notes;" in out
    assert "if(typeof s.goal==='number'&&s.goal>0) o.goal=s.goal;" in out
    assert "if(typeof p.talkMins==='number'&&p.talkMins>0)" in out
    # ...and are in the undo snapshot
    assert "talkMins:pres.talkMins||0," in out
    # over your slot is the one thing worth alarming about
    assert "tot.classList.toggle('over'," in out


def test_a_slide_gets_a_durable_name_before_it_can_be_timed(out):
    """TASKS T29. Every annot has had an `oid` since T10, but a SLIDE
    was only ever an index -- and an index is worthless here, because
    the whole value is comparing runs made days apart, across which you
    will have inserted, deleted and reordered slides.

    `sid` is minted lazily on first rehearsal, the way oids are minted
    on first sight rather than at creation, so a deck that is never
    rehearsed never grows the field.
    """
    assert "function ensureSids(){" in out
    assert "sl.sid='s'+Math.random().toString(36).slice(2,8)" in out
    assert "ensureSids();" in out
    # minting is a change to the deck: a name that is not written down
    # is minted again next session, orphaning every run against it
    assert "if(minted) markDirty();" in out
    assert "if(typeof s.sid==='string'&&s.sid) o.sid=s.sid;" in out


def test_sids_and_oids_de_duplicate_at_opposite_scopes(out):
    """The same mechanism, deliberately opposite. `ensureOids`
    de-duplicates WITHIN a slide but not across them, so a duplicated
    slide keeps its oids and T27 can match the objects. `ensureSids`
    de-duplicates across the WHOLE deck, so a duplicated slide gets a
    fresh sid -- a copy is a different slide you will spend a different
    amount of time on.

    Verified in a browser: duplicating a slide produced two different
    sids, and the run recorded 19s against one and 18s against the
    other.
    """
    js = out
    a = js.index("function ensureOids(s){")
    b = js.index("function ensureSids(){")
    # oid: the seen-set is per slide, built inside the function that
    # takes ONE slide
    assert "function ensureOids(s){" in js
    assert "s.annots.forEach(function(a){" in js[a:a + 400]
    # sid: the seen-set spans pres.slides
    assert "(pres.slides||[]).forEach(function(sl){" in js[b:b + 400]


def test_the_rehearsal_history_is_not_in_the_deck_file(out):
    """Three reasons, in order: sending someone your deck must not send
    them the fact that you spent 4:12 stuck on slide 3; the history
    grows every run while a deck in localStorage has a quota that has
    bitten this project before; and it is the argument showCut and
    matchPick already made -- what you are doing with the deck today is
    not a property of the document.
    """
    assert "function rehKey(){return 'jvreh:'+SCOPE+':'" in out
    assert "var REH_KEEP=12, REH_MIN_SEC=30;" in out
    # and the cap is said out loud rather than silently truncating
    assert "' (the last '+REH_KEEP+' are kept)'" in out


def test_not_every_run_counts_as_a_rehearsal(out):
    """Opening present mode to check a colour and pressing Escape is not
    a data point, and averaging it in would quietly halve every number
    on the page. A run is kept once it reached a second slide AND lasted
    half a minute; anything shorter is dropped and says so.

    Verified in a browser: a five-second run recorded nothing and raised
    "Too short to record as a rehearsal"; a thirty-seven-second run over
    two slides was kept.
    """
    assert "if(rehSeen<2||total<REH_MIN_SEC){" in out
    assert "toast('Too short to record as a rehearsal')" in out


def test_the_clock_starts_and_stops_where_present_mode_does(out):
    """A rehearsal is exactly "present mode, from when it starts to when
    it ends", so it begins and ends where the mode does -- and the time
    so far belongs to the slide you are LEAVING, which is why the mark
    is taken in go() before the render rather than after it.
    """
    assert "var startingTalk=(m==='view'&&mode!=='view');" in out
    assert "if(startingTalk) rehStart();" in out
    assert "else if(endingTalk){\n      rehStop();lateFrom=-1;" in out
    assert "rehSlideChanged();" in out
    assert out.index("rehSlideChanged();") < out.index("    refresh();\n"
                                                      "    playFlip();")
    # pausing the presenter clock pauses the rehearsal with it
    assert "presPauseAt=Date.now();rehPause();" in out


def test_the_stats_are_shown_where_you_would_act_on_them(out):
    """Three places, and no fourth: beside the per-slide target (the two
    numbers are only useful next to each other), in the presenter view
    ("usually 3:42" is the number that changes what you do next), and a
    Rehearsals tab that groups by SECTION -- because a section is the
    unit you actually cut.

    The tab reads sectionRuns(), the same clusters the strip and the
    overview map draw, so it cannot disagree with them.
    """
    assert "function renderReh(){" in out
    assert "rh.textContent='You average '+fmtMins(st.mean/60)+' here over '" \
        in out
    assert "if(st) bits.push('usually '+fmtMins(st.mean/60));" in out
    assert "sectionRuns().forEach(function(run){" in out
    assert 'data-np="reh"' in out


def test_one_matcher_answers_the_same_question_in_both_windows(out):
    """TASKS T30. "Where is the slide about the residuals?" is the same
    question whether you are looking at the presenter view or driving
    from the only screen you have, so slideHits is written once and both
    doors call it. A second matcher would be a second answer, and they
    would disagree the first time either grew a field.
    """
    assert "function slideWords(sl){" in out
    assert "function slideHits(q){" in out
    # the map's filter and the presenter window's list, same function
    assert "slideHits(q).forEach(function(h){hits[h.i]=h;n++;});" in out
    assert "var found=slideHits(q);" in out


def test_a_slides_words_are_everything_written_on_it(out):
    """Its name, every piece of text (text boxes, table cells, captions,
    a title slide's title and subtitle) and its speaker notes.

    slideTitle usually returns one of the pieces already collected -- a
    slide whose only text is its heading is NAMED by that heading -- so
    the parts are de-duplicated or the snippet reads "the word · the
    word", which is what the browser check showed before this went in.
    """
    assert "if(a.k==='text'&&a.text) on.push(a.text);" in out
    assert "if(a.k==='table'&&Array.isArray(a.rows))" in out
    assert "if(a.cap&&typeof a.cap==='string') on.push(a.cap);" in out
    assert "var seen={},uniq=[];" in out
    assert "uniq.join(" in out and "notes:(sl.notes||'')};" in out


def test_a_hit_that_is_only_in_the_notes_says_so(out):
    """Notes are searched because "where did I say that" is exactly the
    question being asked at the lectern. But jumping to a slide expecting
    to see a word on the screen and not finding it is worse than not
    finding the slide, so the hit carries where it came from.
    """
    assert "where:inOn?'':'in the notes'," in out
    assert "var src=inOn?w.on:w.notes;" in out


def test_the_map_is_the_search_results(out):
    """T26 already built the overview: every slide, in its sections,
    click to go. A filter on top of that IS "type-to-search and jump",
    so the door is a search box in the map rather than a second piece of
    navigation furniture.

    Typing hides the tiles that do not match rather than rebuilding the
    map, so the slides do not jump about under the pointer; a section
    left with nothing in it stops taking up a heading.
    """
    assert "find.className='ovw-find'" in out
    assert "function applyFind(){" in out
    assert "t.classList.toggle('hit',!!h);" in out
    assert "g.hidden=!$$('.ovw-tile',g).some(function(t){return !t.hidden;});" \
        in out


def test_finding_a_slide_mid_talk_is_one_key(out):
    """"/" is the type-to-search key everywhere else on a keyboard, and
    the map it opens is the one T26 already built -- so this is a door,
    not a second piece of navigation.

    And the jump goes through go(), so the transition plays, the
    rehearsal clock attributes the time and the presenter view follows.
    Setting cur by hand would skip all three.
    """
    assert "if(e.key==='/'||((e.ctrlKey||e.metaKey)&&(e.key==='f'" in out
    assert "var fi=$('#ovw-find'); if(fi) fi.focus();" in out
    assert "if(mode==='view'){go(i);return;}" in out


def test_the_presenter_window_searches_from_this_side(out):
    """The popup has no script of its own: everything it does is wired
    from the opener, which is what keeps the two windows from drifting.
    Enter takes the first hit; Escape clears; and the box stops the
    arrow keys, which drive the TALK.
    """
    assert "id=\"jvp-find\"" in out and "id=\"jvp-hits\"" in out
    assert "function drawHits(){" in out
    assert "send({jv:'cmd',do:'goto',n:h.i});" in out
    assert "e.stopPropagation();      /* the arrow keys below drive the TALK */" \
        in out


def test_the_words_on_a_notebook_card_are_words_on_the_slide(out):
    """slideWords knew about text boxes, table cells and captions; the
    only route to a CELL was one slideTitle() call, which returns a
    title. So a paragraph of prose placed from a notebook was visibly on
    the slide and invisible to the presenter's own search (2026-08-26
    audit, T57).

    embBody has already parsed that html for cellFacets, so nothing here
    is new work -- it was simply never asked.
    """
    words = out[out.index("function slideWords(sl){"):
                out.index("function slideHits(q){")]
    assert "if(a.k==='cell'&&a.ref){" in words
    assert "var it=resolveRef(a.ref);" in words
    assert "var bn=(typeof embBody==='function')?embBody(a.ref):null;" in words
    # a live page keeps the card in the notebook's own DOM rather than in
    # the embedded map, and a deck can be opened either way
    assert ("var live=(!bn&&typeof cardEl==='function')"
            "?cardEl(a.ref):null;") in words
    # the CODE counts too: a frame showing a code card draws the code, so
    # a name defined in it is as visibly on the slide as a paragraph
    assert "var ef=(typeof embFor==='function')?embFor(a.ref):null;" in words
    # generous, because this string is what the search MATCHES and the
    # snippet is cut from around the hit rather than from the front of it
    assert "if(w) on.push(w.length>4000?w.slice(0,4000):w);" in words
