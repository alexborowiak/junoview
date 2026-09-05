"""Three places where you did the normal thing and nothing did (T285).

From the 2026-09-05 review's ordered plan. None of these is exotic: they
are the keystroke, the clock and the gesture a person tries first.
"""

from __future__ import annotations


def test_the_browser_is_offered_as_a_temporary_answer(out):
    """T296. T283 put three destinations in the first-run prompt as
    peers, but one of them is the only answer that can lose your work --
    and it is still the right default for somebody who just wants to
    start (2026-09-05, user: "an option keep in browser memory for now
    or something with a warning attached to that").

    The label carries the provisional, the note carries the warning, and
    the row is marked so it does not look like the two that keep a file.
    Amber and not red, because choosing it is reasonable and nothing is
    broken -- the same distinction, and the same token, as T279."""
    assert "    var br=row('Keep it in this browser for now'," in out
    assert "      'Nothing is written to a file." in out
    assert "    if(br) br.classList.add('sa-warn');" in out
    assert ".save-ask .sa-opt.sa-warn{border-left:2px solid var(--warning);}" in out
    # ...and the two that DO keep a file are not marked
    assert "      row('This project'" in out


def test_ctrl_p_prints_the_deck_not_the_editor(out):
    """PDF is this product's most-used way out, and Ctrl+P went to the
    browser -- which prints the EDITOR: the ribbon, the strip, the panes
    and whichever single slide was on the stage. printDeck builds the
    real print root (every slide at the page's true size, crop marks,
    the background forced through print-color-adjust in both spellings)
    and File > Print already called it."""
    assert ("    else if((e.ctrlKey||e.metaKey)&&(e.key==='p'||e.key==='P')\n"
            "            &&!deckEl.hidden){") in out
    assert "      if(typeof printDeck==='function') printDeck();" in out
    # guarded on the deck: Ctrl+P over the notebook still prints the
    # notebook, which is the right answer there
    assert "&&!deckEl.hidden){" in out


def test_the_presenter_clock_starts_when_the_talk_does(out):
    """presStart was set when the presenter WINDOW opened, so the
    elapsed time already included however long you spent dragging that
    window onto the second screen and lining it up. The behind/ahead
    badge reads straight off it."""
    assert "  function presTimerStart(){" in out
    assert "    presStart=Date.now();presPaused=0;presPauseAt=0;" in out
    # called from the one place that knows a talk has begun
    assert "    if(startingTalk){\n      rehStart();" in out
    assert "      if(typeof presTimerStart==='function') presTimerStart();" in out
    # ...and opening the window no longer starts it on its own
    assert ("    if(!presStart&&typeof rehOn!=='undefined'&&rehOn) "
            "presStart=Date.now();") in out


def test_an_image_dropped_on_a_slide_lands_on_the_slide(out):
    """The window drop handler filtered to decks and to SRC_RE sources,
    so a PNG matched neither: the full-window "Drop .ipynb files" sheet
    appeared, went away, and the file was discarded in silence.

    Driven on a web build: an image/png dropped with the editor open
    takes the slide's image count from 0 to 1. On a rendered export the
    handler is not wired at all (it sits behind
    `APP.mode==='app'||APP.mode==='web'`), which is correct -- there is
    nothing to open there.
    """
    assert "  window.SemApp.deckDropImage=function(file){" in out
    # only while the editor is up: on the notebook view an image still
    # has nowhere to go, and saying nothing there is at least honest
    assert "    if(deckEl.hidden||mode!=='edit') return false;" in out
    assert "      var imgs=files.filter(function(f){" in out
    assert "      if(imgs.length&&APP.deckDropImage){" in out
    # ...and it does not fall through to the notebook parsers after
    assert "        if(took) return;" in out
