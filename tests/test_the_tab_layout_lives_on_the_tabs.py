"""Where the open files are listed is switched on the list itself (T611).

User, 2026-10-08: "I changed my tabs to be vertical now. However, I have
no idea how to get back to the other view" and "Why is the tab layout
inside the file option inside presentation?". The switch was two rows
under "open files" in both File menus -- and at Home with the side list
there is no File menu on screen at all, so the way back could not be
reached. Now each list carries the one button that leads to the other:
"Tabs at side" after the tabs, "Tabs on top" at the foot of the side list.

Driven at 1366x657 and 1280x600: the reader's tab row ended in Tabs at
side; pressing it swapped to the side list with Tabs on top at its foot,
focused; at Home and in a presentation the same button brought the tabs
back, and the File menus no longer list the choice.
"""

from __future__ import annotations

from junoview import assets, branding


def test_each_list_carries_the_way_to_the_other():
    page = assets.page_template()
    row = page.split('id="open-tabs-row"', 1)[1].split("</nav>", 1)[0]
    side = row.split('id="ot-files-side"', 1)[1].split("</button>", 1)[0]
    assert 'data-at="side"' in side
    assert '<i data-ic="dockleft"></i><span class="btxt">Tabs at side</span>' \
        in side
    foot = page.split('class="pr-foot"', 1)[1].split("</div>", 1)[0]
    top = foot.split('id="pr-files-top"', 1)[1].split("</button>", 1)[0]
    assert 'data-at="top"' in top
    assert '<i data-ic="docktop"></i> Tabs on top' in top
    assert page.count("jv-files-to") == 2
    assert "dockleft" in branding._ICON_PATHS


def test_only_the_button_that_leads_away_shows():
    js = assets.app_js()
    assert ("    $$('.jv-files-to').forEach(function(b){b.hidden="
            "(b.dataset.at===at);});") in js
    assert "jv-files-at" not in js
    init = js.split("  function initFilesAt(){", 1)[1].split("\n  }\n", 1)[0]
    # the keyboard follows: the button pressed has gone, its twin has not
    assert init.index("setFilesAt(b.dataset.at);") < init.index(
        "o.focus({preventScroll:true});")
    assert "if(!o.hidden&&o.getClientRects().length)" in init


def test_the_button_on_the_tab_row_never_squeezes():
    css = assets.app_css()
    rule = css.split(".open-tabs-row .ot-files-at{", 1)[1].split("}", 1)[0]
    assert "flex:none;" in rule and "white-space:nowrap;" in rule


def test_it_can_be_found_and_the_help_says_where():
    js = assets.deck_js()
    assert ("['#ot-files-side','#pr-files-top'].forEach(function(id){\n"
            "      add($(id),'Open files',null,null);});") in js
    assert "'ot-files-side':'vertical tabs side list" in js
    assert "'pr-files-top':'horizontal tabs top" in js
    helpp = assets.load("html/help.html")
    assert "<b>Tabs at side</b>, after the tabs," in helpp
    assert "<b>Tabs on top</b>, at the foot of that list" in helpp
    assert "<i>Open files</i>" not in helpp
