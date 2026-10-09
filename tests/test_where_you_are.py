"""T524: "Slide 3 of 14", where PowerPoint's status bar says it.

The 2026-09-29 audit asked for a status bar. The canvas keeps its height
by the user's own rule for the zoom cluster (2026-08-20: "that is a
prominent feature, and it needs to be somewhere good" -- the bottom-right
corner, floating), so this is the cluster's twin in the bottom-left
rather than a bar: the slide, of how many (mains only, as the strip and
the talk count), the version it is and its section. Clicking it opens
the Overview map.

Driven at 1440x900: slide 5 of the example deck reads "Slide 5 of 14";
the click opens #deck-overview with slide 5 ringed.

T619 (2026-10-09) took it off the canvas: at a laptop's size the two
floating pills sat over the page and the stage kept 50px under it for
them. It heads the slide list now, beside the Thumbnails chooser.
"""

from __future__ import annotations


def test_the_readout_heads_the_slide_list(out):
    head = out.split('<div class="film-head" id="film-head">')[1] \
        .split('<div class="film-list" id="film-list">')[0]
    assert head.index('id="film-view-btn"') \
        < head.index('<span class="deck-where" id="deck-where">')
    wrap = head.split('<span class="deck-where" id="deck-where">')[1]
    assert 'id="where-btn"' in wrap and 'id="where-part"' in wrap
    assert 'id="where-t">Slide 1 of 1</span>' in wrap
    # ...and nothing floats over the canvas's foot any more
    stage = out.split('<div class="deck-stagewrap"')[1] \
        .split('<div class="vfull"')[0]
    assert 'id="deck-where"' not in stage
    assert 'id="deck-zoombar"' not in stage


def test_it_sits_in_the_row_and_only_while_editing(out):
    assert (".deck-where{display:none;flex:0 1 auto;min-width:0;"
            "max-width:100%;}") in out
    assert ".deck-where{position:absolute" not in out
    assert ".deck.editing .deck-where{display:flex;}" in out
    # the column is ~185px on a 1366 laptop: the head wraps, the chooser
    # keeps its word whole and the readout drops under it
    assert ".film-head{display:flex;flex-wrap:wrap;gap:4px;" in out
    assert ".film-head .dc-menuwrap{flex:1 0 auto;}" in out
    assert (".film-head .deck-where .dbtn.rbn-sm{min-width:0;"
            "font-size:11px;") in out


def test_the_page_gets_the_foot_back(out):
    # T467's 50px was the floating bar's room; with no bar the foot is
    # the head's 18px, and sizeSlideTo (which measures this padding)
    # gives the page the rest
    assert (".deck.editing .deck-stage{align-items:center;"
            "justify-content:center;\n  padding:18px 26px 18px;}") in out
    assert "padding:18px 26px 50px" not in out


def test_it_counts_the_way_the_strip_counts(out):
    fn = out.split("  function syncWhere(){")[1].split("\n  }\n")[0]
    assert "var word=pageOf().poster?'Page':'Slide';" in fn
    assert "word+' '+slideNo(cur)+' of '+n" in fn
    assert "var sl=pres.slides||[],s=sl[cur],n=slideCount();" in fn
    assert "(s.label||('Version '+(cur-ar.at+1)))" in fn
    assert "if(s&&s.sec) txt+=' · '+secName(s.sec);" in fn


def test_every_slide_change_updates_it_and_the_click_opens_the_map(out):
    # updateVNav runs on every renderSlide
    nav = out.split("  function updateVNav(){")[1].split("\n  }\n")[0]
    assert nav.rstrip().endswith("syncWhere();")
    assert ("if(b) b.addEventListener('click',function(){openOverview();});"
            in out)
    assert ("    whereBoot();                "
            "/* \"Slide 3 of 14\", atop the slides") in out
