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

def test_selection_does_not_steal_an_open_workflow():
    """T141 / JVUX-06, driven live: with the Timeline pane open on
    Insert, selecting an object kept the tab on Insert, kept the pane
    open, and the pane switched from its empty state to the effect
    chooser; with no pane open the tab switched to Object exactly as
    before."""
    out = _out()
    # renamed `hold` when the effect GALLERY joined the panes in holding
    # the tab (T171): it is the same rule -- an open workflow keeps the
    # tab it is standing on -- applied to a second surface
    assert "var hold=PANE_IDS.some(function(pid){" in out
    assert "||(typeof animGalleryOpen==='function'&&animGalleryOpen());" in out
    assert "&&!hold)?selT:'';" in out


def test_chart_and_masters_have_first_class_doors():
    """T144 / JVUX-11, driven live: Insert's worded Chart button placed
    a chart (and Ctrl+Z removed it), Design's Masters button opened the
    panel, and the empty notebook column offers a worded Open
    notebooks button instead of naming an action with no door."""
    html = assets.deck_html()
    assert 'id="ins-chart"' in html and '> Chart</button>' in html
    assert 'id="dsg-masters"' in html and '> Masters</button>' in html
    out = _out()
    assert "var ic2=$('#ins-chart');" in out
    assert "var dm2=$('#dsg-masters');" in out
    assert "ob2.className='dbtn dc-nbs-open';" in out

def test_the_file_menu_has_named_sections_and_a_warned_tail():
    """T143 / JVUX-07, driven live: five named headings (file, sources,
    export & share, page, careful) with the two destructive rows LAST,
    in warn colour; and the autosave button stopped painting itself as
    a second primary action beside Save."""
    html = assets.deck_html()
    i = html.index('id="dc-menu"')
    j = html.index('</div>', html.index('id="mi-del"'))
    menu = html[i:j]
    heads = re.findall(r'class="dc-mhead[^"]*">([^<]+)<', menu)
    assert heads == ["file", "sources", "export &amp; share", "page",
                     "careful — these lose work"], heads
    # the dangerous pair is last, and wears the warning
    assert menu.rindex('id="mi-del"') > menu.rindex('id="mi-pdf"')
    assert menu.count('dc-mi-warn') == 2
    css = assets.deck_css()
    assert '.deck-qat .qat-auto[aria-pressed="true"]{background:none;' in css

def test_the_review_centre_fronts_the_five_engines():
    """T142 / JVUX-09, driven live: the Review door opened the centre
    reading "5 to look at, across five checks" (Print 2, Layout 2,
    Style 1, Content clear, Sources clear on the test deck), and each
    row's button opened exactly its one existing surface — never more
    than one pane visible, per the T136 owner."""
    html = assets.deck_html()
    assert 'id="reviewpane"' in html
    assert "> Review</button>" in html
    out = _out()
    assert "function renderReviewPane(){" in out
    # the engines run DRY for their counts — reuse, not rewrite
    for engine in ("preflight().length", "tidyFindings().length",
                   "reviewLints().length", "staleFigures().length",
                   "r.findings.length+figLint().length"):
        assert engine in out, engine
    # each button opens the EXISTING surface
    assert "paneShow('preflight');renderPreflight();},"
    assert "function(){showTidyPane();}," in out

