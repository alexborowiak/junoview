"""Configure and Order are two tabs, not one scroll (T452).

The user, 2026-09-14: "the animation pane is not the right place for
configuring the animation details e.g. for things like the wobble and
such. The animation pane is for the order. Please do not mix them. Or
perhaps put tabs on the pane e.g. configuration and order."

T445 stacked the per-object settings on top of the click list, so the
six numbers of a wobble sat between you and the order every time you
opened the pane to check it.
"""

from __future__ import annotations


def test_the_pane_has_a_tab_strip(out):
    assert 'id="animpane-tab-cfg"' in out
    assert 'id="animpane-tab-ord"' in out
    assert 'role="tablist" aria-label="Animation pane"' in out
    assert 'aria-controls="animpane-cfg"' in out
    assert 'aria-controls="animpane-body"' in out
    assert "> Configure</button>" in out
    assert "> Order</button>" in out
    assert ".anim-tabs{display:flex;gap:2px;flex:none;padding:0 8px;" in out
    # T465: the theme's ink, not white -- white-on-white in Light
    assert '.anim-tab[aria-selected="true"]{color:var(--chrome-ink);' in out


def test_one_half_shows_and_the_other_hides(out):
    """A class flip, never a rebuild: both halves are built either way,
    so switching cannot lose a drag or a half-typed number."""
    assert "  function animTabApply(){" in out
    assert "    cfg.hidden=(on!=='cfg');" in out
    assert "    ord.hidden=(on!=='ord');" in out
    assert "    if(tc) tc.setAttribute('aria-selected',(on==='cfg').toString());" in out
    # ...and which one you were on is remembered per project
    assert "var ANIMTAB_KEY='semopts:'+SCOPE+':animtab';" in out
    assert "    return lsGet(ANIMTAB_KEY)==='ord'?'ord':'cfg';" in out
    assert "    lsSet(ANIMTAB_KEY,which==='ord'?'ord':'cfg');" in out
    # opening the pane lands you back on it
    assert "        if(typeof animTabApply==='function') animTabApply();" in out


def test_quick_animate_moved_to_the_order_tab(out):
    """Clicking things in turn IS setting the order, so its count and
    its three verbs belong above the list it is writing -- and arming
    it switches the pane there."""
    assert "    if(on&&typeof animTabSet==='function') animTabSet('ord');" in out
    assert ("      if(typeof seqOn==='function'&&seqOn()\n"
            "         &&typeof cfgSeq==='function'){") in out
    assert "        qa.className='anim-cfg anim-quick';" in out
    assert "        cfgSeq(qa);" in out
    assert ".anim-quick{margin:0 0 10px;padding-bottom:9px;" in out
    # the Configure tab says where it went rather than going blank
    assert "    if(typeof seqOn==='function'&&seqOn()){" in out
    assert "      cfgNote(host,'Quick animate is running " in out
    # ...and the list's own door stands down while the mode is running
    assert "      if(typeof seqOn==='function'&&seqOn()) return;" in out
