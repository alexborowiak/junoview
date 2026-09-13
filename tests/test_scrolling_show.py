"""T389: the scrolling version of a presentation (2026-09-12, user:
"could there be a continuous scroll version of presentations, with some
like 'animate as scrolling down', so the animations only appear on first
scroll down then just are there after that").

Driven in Chromium: every slide stacked in one scrolling overlay, scaled
to the window; the title's Fly in played the first time its page came
into view and stayed put on the way back up.
"""

from __future__ import annotations

from junoview import assets


def test_it_is_one_fragment_with_two_doors(out):
    assert "54-scroll-show" in assets.DECK_PARTS
    assert "  scrollShowBoot();" in out
    part = assets.load("js/deck/54-scroll-show.js")
    assert "})();" not in part
    assert 'id="pl-scroll"' in out and 'id="pr-scroll"' in out
    assert "['pr-presenter','pl-presenter'],['pr-scroll','pl-scroll']," in out


def test_the_pages_are_the_export_pages_scaled_to_the_window(out):
    assert "    var root=buildPrintRoot();" in out
    # the id goes, so a later print builds its own root without deleting this
    assert "    root.removeAttribute('id');" in out
    assert "    root.classList.add('scroll-root');" in out
    assert "      p.style.zoom=Math.max(0.1,Math.min(1,avail/w)).toFixed(4);" in out
    assert (".deck-scroll .scroll-root{position:static;left:auto;top:auto;"
            "width:auto;") in out


def test_a_page_animates_once_on_first_sight_and_then_stays(out):
    # armed: held back, ranked by build order
    assert "      el.classList.add('an-prebuild','an-scrollin');" in out
    assert "      el.dataset.srank=String(orders.indexOf(a.anim.order||0));" in out
    # played once: the observer lets go of a page it has played
    assert "    if(page.dataset.played) return;" in out
    assert "          scrollShowIo.unobserve(e.target);" in out
    assert "      },{root:body,threshold:0.3});" in out
    # a beat apart, holding the from-state through the delay
    assert ("      el.style.animationDelay="
            "((+el.dataset.srank||0)*SCROLL_STAGGER)") in out
    assert ".an-scrollin{animation-fill-mode:backwards!important;}" in out
    # reduced motion: shown, not animated
    assert "    if(!motionOK()){" in out
    # the typewriter would run every box at once here, so it fades
    assert "      if(type==='type') type='fade';" in out
    # Esc closes, arrows step a page, both caught before the deck's keys
    assert "    document.addEventListener('keydown',scrollShowKey,true);" in out
    assert "        closeScrollShow();return;}" in out
