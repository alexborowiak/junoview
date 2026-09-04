"""Disappear has a door, and leaving is an effect (T238).

The user, 2026-09-04: "Animations is missing dissapear."

The exit itself has worked since T174 -- an object can go on the click
another arrives, which is what replacing a picture actually is -- but
its only door was a popover inside the Layers pane's build column, so
the effect gallery offered five ways to arrive and none to leave.

Driven at 1700px: the button armed it ("Leaves on click 1"), the caret
listed "Stays" and "Goes on one more click at the end", and in playback
the first click left the object on screen fading (.an-anim-out) while
the second dropped it -- on the same slide, three items to two.
"""

from __future__ import annotations

from junoview import assets


def test_the_door_is_on_the_animation_tab():
    html = assets.deck_html()
    assert '<span class="rbn-grp rbn-exit" data-tab="animation"' in html
    assert '<span class="rbn-lab">Disappear</span>' in html
    for cid in ("anim-outwrap", "anim-out", "anim-out-caret",
                "anim-out-menu", "anim-out-say"):
        assert f'id="{cid}"' in html, cid


def test_the_button_is_the_common_case_and_the_caret_the_rest(out):
    assert "  function animOutBoot(){" in out
    assert "  animOutBoot();" in out
    assert "      if(animOut(a)!=null) delete a.out;" in out
    assert "      else a.out=nextAnimOrder(s);" in out
    assert "  function animOutMenu(m){" in out
    assert "    menuHead(m,'when it goes');" in out
    assert "      row('Goes when '+who+' arrives'," in out
    assert "    row('Goes on one more click at the end'," in out


def test_the_ribbon_does_not_report_the_state_it_had_before_the_click(out):
    """refresh() re-runs the ribbon's sync on a SELECTION change, and
    pressing a button is not one -- so the button read as off until you
    clicked the object again (caught by driving it)."""
    assert "      animRibbonSync();\n" in out
    assert "      animOutSync();" in out
    assert "  function animOutSync(){" in out
    assert "    if(b) b.setAttribute('aria-pressed',(now!=null).toString());" in out
    assert "      say.querySelector('b').textContent=now==null?'never'" in out


def test_leaving_is_an_effect_not_a_cut(out):
    """The stop it goes on keeps the element so the exit can play."""
    assert "    return revealCount>sp+1;" in out
    assert "  function animGoing(s,a){" in out
    assert "    return revealCount===sp+1;" in out
    assert ("        if(mode==='view'&&animGoing(s,ba))\n"
            "          el.classList.add('an-anim-out');") in out
    css = assets.deck_css()
    assert "@keyframes an-out{from{opacity:1;}to{opacity:0;}}" in css
    assert (".an-anim-out{animation:an-out .28s ease forwards;"
            "pointer-events:none;}") in css
    assert ("@media (prefers-reduced-motion: reduce){\n"
            "  .an-anim-out{animation:none;opacity:0;}}") in css


def test_a_slide_whose_only_animation_is_an_exit_still_builds(out):
    """The reveal pass ran only when something had an entrance."""
    assert ("    if(s.annots&&s.annots.some(function(a){\n"
            "      return a&&(a.anim||animOut(a)!=null);})){") in out
    # ...and an exit has always claimed a stop of its own
    assert ("      var o=animOut(a);\n"
            "      if(o!=null&&!(o in seen)) seen[o]=1;});") in out
