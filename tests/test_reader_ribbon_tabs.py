"""T605: the reader's ribbon is tabs, the editor's shape.

2026-10-01, user: "the ribbon in the notebooks thing is a bit cursed. It
is still too big and eats up too much of the vertical and things don't
line up well. Maybe there needs to be different tabs like presentation:
a filter tab etc." File, Filters, View and the verbs on one strip; ONE
row of the chosen tab's groups under it; it folds away.
"""
from junoview import assets


def _page():
    return assets.load("html/page.html")


def test_every_group_belongs_to_one_tab():
    page = _page()
    band = page.split('id="filters-panel"')[1].split('<div class="stylebar"')[0]
    on = {"filters": ("ab-filters", "ab-scope", "ab-saveview", "ab-tree"),
          "view": ("ab-nav", "ab-look", "ab-pages", "ab-size")}
    for tab, ids in on.items():
        for gid in ids:
            assert f'id="{gid}" data-abtab="{tab}"' in band, gid
    # the controls kept their ids and their homes in the right tab
    order = ["tv-plots", "pt-filter-btn", "tv-markdown", "tv-code",
             "ck-filter-btn", "tv-output", "ot-filter-btn", "marks-grp",
             "sec-scope-btn", "filters-reset", "ab-newview", "tree-expand",
             "menubtn", "vars-btn", "view-raw", "view-tree", "sec-pages",
             "fig-size-val", "md-size-val"]
    at = [band.index(f'id="{i}"') for i in order]
    assert at == sorted(at)


def test_the_strip_is_file_tabs_verbs_and_the_fold():
    page = _page()
    strip = page.split('<div class="ab-tabs" id="ab-tabs">')[1].split(
        '<span class="filter-wrap"')[0]
    order = ["app-file", "ab-tab-filters", "ab-tab-view", "doc-full",
             "doc-present", "doc-autoslides", "filters-toggle"]
    at = [strip.index(f'id="{i}"') for i in order]
    assert at == sorted(at)
    # the count of filters in play rides the Filters tab
    tab = strip.split('id="ab-tab-filters"')[1].split("</button>")[0]
    assert 'id="filters-count"' in tab
    assert 'role="tab"' in strip and 'role="tablist"' in strip


def test_tabs_and_fold_behave_like_the_editors():
    app = assets.app_js()
    body = app.split("T605: THE RIBBON'S TABS AND ITS FOLD")[1].split(
        "  })();")[0]
    # a click shows the tab and brings a folded ribbon back
    assert "show(b.dataset.abtab);\n        if(panel.hidden) set(true);" in body
    # double-click, the chevron and Ctrl+F1 fold it
    assert "b.addEventListener('dblclick',function(e){" in body
    assert "if(e.key!=='F1'||!(e.ctrlKey||e.metaKey)) return;" in body
    assert "if(b.contains('deck-open')||b.contains('doc-presenting')) return;" \
        in body
    # remembered, both
    assert "TAB_KEY='jv-reader-tab',FOLD_KEY='jv-reader-fold'" in body
    assert "show(lsGet(TAB_KEY)==='view'?'view':'filters');" in body
    # Escape closes menus; it no longer takes the ribbon with them
    assert "e.key==='Escape'" not in body


def test_the_band_folds_groups_and_never_wraps():
    app = assets.app_js()
    assert ("var BAND_FOLD=['#ab-saveview','#ab-scope','#ab-tree','#ab-size',"
            in app)
    fit = app.split("  function fitRibbon(){")[1].split("\n  }\n")[0]
    # a resize step that would change nothing writes nothing (bandFitStill,
    # 2026-10-09); anything else unfolds the band's doors before it measures
    assert fit.index("if(bandFitStill([tabs,band,bar,sb])) return;") \
        < fit.index("$$('.abgrp.ab-folded',top||document).forEach(bandUnfold);") \
        < fit.index("cl.add('rbc1');")
    assert "if(live.length<2) return;" in fit
    # the present bar carries whole groups, never a door
    take = app.split("  function pbTakeTools(){")[1].split("\n  }\n")[0]
    assert "if(APP.bandUnfoldAll) APP.bandUnfoldAll();" in take
    css = assets.load("css/app.css")
    assert ".ab-foldmenu{position:fixed;z-index:190;" in css
    # padding must not ease between rungs, or the fit measures the old one
    assert (".appbar .toggle{transition:color .15s,background-color .15s,\n"
            "  border-color .15s,opacity .15s;}") in css


def test_save_as_view_is_a_door_to_the_one_custom_view_button():
    page = _page()
    assert 'id="ab-newview" type="button" data-for="pr-newview"' in page
    app = assets.app_js()
    assert "var b=$('#ab-newview');" in app
    assert "var real=$('#'+b.dataset.for);" in app


def test_the_tree_relabels_the_filters_tab():
    css = assets.load("css/app.css")
    assert "body.tree-mode .ab-tab .abt-doc{display:none;}" in css
    assert "body.tree-mode .ab-tab .abt-tree{display:inline;}" in css
