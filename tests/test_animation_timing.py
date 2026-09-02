"""Timing on the Animation tab, and the numbers that follow it (T185-T186).

The user, fourth review of 2026-09-02: "there should be a default thing
there with time like PowerPoint has, and something like 'With previous',
or 'on click' that you can swap around... where are the things for dot
points where you can have the options of animating by sentence, dot
point, etc... the animation numbers should appear when on the animation
tab always... you can't tell which button you are on."
"""

from __future__ import annotations


def test_start_is_on_click_with_previous_or_after_previous(out):
    """T185. PowerPoint's Start box on the model this deck already has:
    a stop of its own, the previous build's click (mergeUp), or T169's
    delay -- the stop runs itself N seconds after the one before, no
    click -- which was reachable only by holding a digit in Quick
    animate. Disabled until there is a selected build to time.
    """
    for cid in ("anim-onclick", "anim-withprev", "anim-afterprev",
                "anim-delay", "anim-delaywrap", "anim-start"):
        assert f'id="{cid}"' in out, cid
    assert 'class="rbn-grp rbn-timing" data-tab="animation"' in out
    assert "function setDelay(sec){" in out
    assert "function timingState(){" in out
    assert "function timingSync(){" in out
    # the whole stop carries the delay, as T169 ruled
    assert "if(sec>0) x.anim.after=sec; else delete x.anim.after;}});" in out
    # the three states, read off the model
    assert "mode:after?'after':(shared?'with':'click')," in out
    # nothing to be "with" on the first build
    assert "b.disabled=!st.on||(p[1]==='with'&&st.si<=0&&st.mode!=='with');" in out
    # every selection change and every commit re-reads it
    assert "    animRibbonSync=function(){\n      timingSync();" in out
    # and the group stands down while Quick animate has the row
    assert "if(start) start.hidden=poster||armed;" in out


def test_how_much_of_a_text_box_arrives_is_on_the_ribbon(out):
    """T185. T172's text builds lived only in the order pane. A text box
    with a build now shows Whole box / By bullet / By sentence beside
    the timing, through the pane's own setBy.
    """
    for cid in ("anim-by", "anim-by-all", "anim-by-para", "anim-by-sent"):
        assert f'id="{cid}"' in out, cid
    assert "if(by) by.hidden=poster||armed||!st.text;" in out
    assert "e.stopPropagation();setBy(p[1]);});" in out
    assert "by:(a.anim.by==='para'||a.anim.by==='sent')?a.anim.by:''};" in out


def test_the_numbers_show_whenever_the_animation_tab_is_up(out):
    """T186. They showed only while the order pane or Quick animate was
    open; the tab is about them."""
    assert "deckEl.classList.toggle('tab-animation',t==='animation');" in out
    assert ".deck.tab-animation .an-buildno{display:flex;}" in out


def test_the_lit_chip_beats_the_theme(out):
    """T186. The colourful theme paints every .dbtn three classes deep,
    which beat .seq-fxb.on and left the chosen effect in Quick animate
    looking like its neighbours. The pressed state is said at five."""
    assert ('.rbn-row .seq-fx .seq-fxb[aria-pressed="true"],\n'
            '.rbn-row .rbn-cell .dbtn.rbn-sm[aria-pressed="true"]{') in out
    # ...and the status line says what to do, not only where you are
    assert "click the '\n      +'next thing to appear'" in out
