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
    assert "function buildSlideNode(i){" in out
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
