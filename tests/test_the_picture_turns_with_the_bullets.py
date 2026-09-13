"""T418: the picture turns with the bullets.

The user, 2026-09-13: "I want the image to change in the flip book as
the dot point changes, but there is no way to split them up." A text
box built in pieces can name a flip book on the slide (anim.sync, the
book's fid): figure k shows with piece k, on the same click, and the
book has no clicks of its own. Driven in Chromium: seven bullets and
a five-page book went from 11 clicks to 7; before the first click the
book showed figure 1 and no bullet; each click brought one bullet and
turned one page, and the last two bullets left the book on figure 5.
"""

from __future__ import annotations


def test_a_synced_book_has_no_stops_of_its_own(out):
    assert "    var steps=slideBuildSteps(s),anch={},tail=[],synced={};" in out
    assert ("      if(a&&a.anim&&a.anim.sync&&!a.hide&&textBy(a)"
            "&&flipById(s,a.anim.sync))") in out
    assert "        synced[a.anim.sync]=a.anim.order||0;" in out
    assert "      if(p.a.k==='flip'&&p.a.fid&&synced[p.a.fid]!=null) return;" in out
    # the walk index IS the piece index: figure 1 stays up until the first
    # piece arrives (driven: without the +1 the book was a page ahead)
    assert "      if(b0!=null) base[p.i]=stop[b0]+1;" in out
    assert "synced:synced};" in out


def test_the_turns_box_is_offered_for_a_box_in_pieces(out):
    from junoview import assets
    html = assets.deck_html()
    assert 'id="anim-synccell" hidden' in html
    assert 'id="anim-sync"' in html
    assert "<option value=\"\">no flip book</option>" in html
    assert ("        var books=(st.text&&st.by&&!poster&&!armed)\n"
            "          ?flipsOn(s2).filter(function(p){"
            "return flipFrames(p.a).length>1;})") in out
    assert "    function setSync(fid){" in out
    assert "        if(fid) a.anim.sync=fid; else delete a.anim.sync;" in out
    assert ("    if(ssel) ssel.addEventListener('change',"
            "function(){setSync(ssel.value);});") in out


def test_the_pane_names_the_figure_each_piece_turns_to(out):
    assert ("          var sfb=pieceA.anim.sync"
            "?flipById(s,pieceA.anim.sync):null;") in out
    assert "            if(sfr[k]) t+=' \\u00b7 '+frameLabel(sfr[k],k);" in out


def test_the_format_says_what_sync_is():
    fmt = open("DECK-FORMAT.md", encoding="utf-8").read()
    assert "`sync` (the `fid` of a flip book on the same slide" in fmt
    from junoview.notebook import deck_schema
    src = open(deck_schema.__file__, encoding="utf-8").read()
    assert "`sync` is the `fid` of a flip book" in src
