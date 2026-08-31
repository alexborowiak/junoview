"""The interaction substrate Phase 0 repaired (T134-T138, group 15).

Four mechanical defects from reviews/2026-08-31_23-07.md, each
REPRODUCED live before fixing and re-driven after: duplicate ids
(T134, pinned in test_js_contract's unique-id test), stacking menus
with stale aria-expanded (T135), stacking inspector panes (T136), and
the 31-button three-column context menu (T137).

What a substring cannot hold is recorded here instead: the live drives
showed File→Present and Background→Layouts each leaving exactly one
menu open with the loser's aria-expanded false; an outside click
resetting Present's aria (the stale-true bug); Escape closing with
focus returned best-effort; Tidy→Check→Standardise→Animations→Objects
showing exactly one pane at every step; and the folded context menu at
7 visible rows, no horizontal overflow, a folded row still opening its
panel. The review's full browser-test list (screenshots at two sizes,
keyboard paths) needs a browser in CI this repo does not have — that
gap is recorded here deliberately rather than silently skipped.
"""

from __future__ import annotations

import re

from junoview import assets


def _out() -> str:
    return assets.deck_js()


def test_the_overlay_owner_exists_and_boots_from_the_boot_sequence():
    out = _out()
    assert "function overlayShow(btn,menu){" in out
    assert "function overlayHide(menu){" in out
    assert "function overlayBoot(){" in out
    # load-time listeners are installed from THE BOOT SEQUENCE only
    # (the T133 rule), and exactly once
    assert out.count("overlayBoot();") == 1
    boot = out[out.index("THE BOOT SEQUENCE"):]
    assert "overlayBoot();" in boot


def test_every_wired_menu_routes_through_the_owner():
    """wireMenuToggle registers; the formerly bespoke menus call the
    owner by name. A menu that opens with a bare .hidden write would
    stack again, so the old idiom must stay dead in the toggle paths."""
    out = _out()
    assert ("if(menu.hidden){overlayShow(btn,menu);floatMenu(btn,menu);}"
            in out)
    for site in ("overlayShow(wrap,menu);floatMenu(wrap,menu);",   # Present
                 "overlayShow(fileBtn,fileMenu);",                 # File
                 "overlayShow(lb,lm);floatMenu(lb,lm);",           # Layouts
                 "overlayShow(pb,pm);",                            # Page
                 "overlayShow(shBtn,shMenu);",                     # shapes
                 "overlayShow(mb,acts2);"):                        # nb More
        assert site in out, site
    # the per-menu document closers are gone from the migrated blocks:
    # the one owner is the only outside-click closer menus rely on
    assert "if(!fileMenu.hidden&&!fileMenu.contains(e.target))" not in out
    assert "if(!menu.hidden&&!menu.contains(e.target)&&e.target!==wrap)" \
        not in out


def test_the_pane_registry_matches_the_markup():
    """PANE_IDS must name every .selpane the editor renders — a pane
    missing from the registry is a pane the owner cannot close, which
    is the exact bug class T136 removed."""
    out = _out()
    m = re.search(r"var PANE_IDS=\[([^\]]+)\]", out)
    assert m, "PANE_IDS gone"
    in_js = set(re.findall(r"'(\w+)'", m.group(1)))
    html = assets.deck_html()
    in_html = set(re.findall(
        r'<aside class="selpane[^"]*" id="([^"]+)"', html))
    assert in_js == in_html, (in_js ^ in_html)


def test_every_show_site_uses_the_owner_and_the_hand_lists_are_gone():
    out = _out()
    for pane in ("selpane", "animpane", "verpane", "notespane",
                 "preflight", "stdpane", "tidypane", "flippane",
                 "provpane", "sizepane", "objhist"):
        assert f"paneShow('{pane}');" in out, pane
    # the diverged sibling hand-lists must not come back
    assert "'#selpane','#animpane','#preflight'" not in out


def test_the_context_menu_folds_and_speaks_menu():
    out = _out()
    assert "function cmFold(m){" in out
    assert "cmFold(m);\n    floatAt(m,ev);" in out
    assert "m.setAttribute('role','menu');" in out
    assert "b.setAttribute('role','menuitem');});" in out
    # small menus never fold
    assert "if(m.querySelectorAll('button').length<=12) return;" in out
    css = assets.deck_css()
    # the [hidden] fix the first screenshot caught
    assert ".cm-more[hidden]{display:none;}" in css
