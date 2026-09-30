"""T594: the Animation tab shows what applies, and nothing else.

The user, 2026-09-30: "the animations are sooo confusing. Have all these
boxes with all these categories is so weird. Like when I click on
something without any animations there are all these options. Like i
wish it was like a much easier way to do this." The tab had nine doors
before anything was animated: Slide transition, Entrance effect, Start,
Text sequence, Each text step, Disappear, Focus, Motion and Whole slide,
with Build order squeezed off the right edge on a laptop. The redesign
the user approved:

- always: Build order (Preview, Animation panel, Quick animate, Layers),
  first, and one Add animation gallery of tiles;
- once the thing has an animation: one Timing door (Start, Text
  sequence and Each text step as labelled sections) and Disappear;
- Focus and Motion in the Animation panel's Configure tab only;
- Slide transition on the Present tab;
- Whole slide one door.

Driven at 1500x900: nothing selected and a plain text box both show
Build order | Add animation | Whole slide; after Fade, Timing and Exit
join them; the Timing door opens one 37px line with its three labelled
sections; Present shows Play | Custom show | During the talk | Slide
transition.
"""

from __future__ import annotations

from junoview import assets


def _tag(html, cls):
    i = html.index('class="rbn-grp ' + cls)
    return html[html.rfind("<span", 0, i):html.index(">", i) + 1]


def test_the_tab_holds_four_groups_to_begin_with():
    html = assets.deck_html()
    assert 'data-tab="animation"' in _tag(html, "rbn-order rbn-nofold")
    assert 'data-tab="animation"' in _tag(html, "rbn-anim")
    assert "rbn-compact" not in _tag(html, "rbn-anim")
    assert '<span class="rbn-lab" id="anim-strip-lab">Add animation</span>' \
        in html
    # Focus and Motion are the panel's: data-tab="panel" is no tab
    assert 'data-tab="panel"' in _tag(html, "rbn-focus")
    assert 'data-tab="panel"' in _tag(html, "rbn-motion")
    # the transition is the talk's
    assert 'data-tab="present"' in _tag(html, "rbn-trans")
    # Whole slide is one door
    assert "rbn-compact" in _tag(html, "rbn-build")


def test_timing_is_one_door_with_three_named_sections():
    html = assets.deck_html()
    g = html[html.index('id="anim-timing-group"'):]
    g = g[:g.index('<span class="rbn-lab">Timing</span>')]
    for sid, lab in (("anim-start-group", "Start"),
                     ("anim-sequence-group", "Text sequence"),
                     ("anim-textmode-group", "Each text step")):
        assert f'id="{sid}"' in g, sid
        assert f">{lab}</span>" in g, lab
    css = assets.deck_css()
    assert ".tm-sec+.tm-sec{border-left:1px solid" in css


def test_timing_and_disappear_wait_for_an_animation(out):
    assert "if(stg) stg.hidden=poster||armed||!st.on;" in out
    assert "if(mg) mg.hidden=poster||armed||!st.on||!st.text;" in out
    assert "    if(wrap) wrap.hidden=poster||!live;" in out
    # picking an effect is not a selection, so the groups are judged
    # again when one of them comes or goes
    assert "      if(animShownSig()!==sig0&&!animJudging" in out
    assert "        try{syncRibbonGroups();}finally{animJudging=false;}" in out


def test_what_left_the_tab_is_still_reachable(out):
    # the panel sends anything away, whatever the ribbon shows
    assert "      cfgLeaves(host);   /* T594 */" in out
    # and command search takes Focus and Motion words to the panel
    assert "'vw-anim':'animation pane animations list focus blur zoom magnify '" \
        in out
