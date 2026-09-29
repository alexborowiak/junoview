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
"""

from __future__ import annotations


def test_the_readout_sits_in_the_canvas_beside_the_zoom(out):
    wrap = out.split('<span class="deck-where" id="deck-where">')[1] \
        .split('<span class="deck-zoombar" id="deck-zoombar">')[0]
    assert 'id="where-btn"' in wrap
    assert 'id="where-t">Slide 1 of 1</span>' in wrap


def test_it_floats_like_the_zoom_and_only_while_editing(out):
    assert (".deck-where{position:absolute;left:18px;bottom:12px;z-index:8;"
            in out)
    assert ".deck.editing .deck-where{display:flex;}" in out


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
    assert "    whereBoot();                /* \"Slide 3 of 14\", bottom-left" \
        in out
