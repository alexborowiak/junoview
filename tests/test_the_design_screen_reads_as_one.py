"""The Style system screen reads as one thing (T230).

The user, 2026-09-03: "This is looking good, but would be good to edit
the text in here as well, and maybe the x, y, w (called it widht), and
size boxes are too big? The slide thumbnails should be down the side as
that's the way people are used to viewing them. This text is hard to
view... all the text is a bit confusing here. There is text of heaps of
different sizes and different width everywhere, and the buttons are a
bit crammed. There is a lot of things again that feel like they are
floating in no where."

And, mid-round: "When selecting the slide thumbnails on this view it
would be good if they stayed selected and became cumulative and that fed
into things like the table. And the view of the slide thing... right now
it shows you the masters, but there can be individuals. Would be good if
you could see not just the master, but location of all individual
headings, then you can also tick a box that show 'all other items', so
you know if your heading is going to overlap with something (should be a
colour for every different thing, but the one in question glows and has
a thicker border)."

Driven at 1700px: the slides sit in a column on the right, the controls
read as five captioned clusters, ticking Show everything else drew eight
other boxes with a key, and picking two slides accumulated and filtered
both the table and the board.
"""

from __future__ import annotations


def test_the_slides_go_down_the_side(out):
    assert "'<div class=\"dg-sheetcol\" id=\"dg-sheetcol\"></div></div>';" in out
    assert "  function dgSheet(_unused,ov){" in out
    assert "    var body=ov&&ov.querySelector('#dg-sheetcol');" in out
    assert ".dg-sheetcol{width:250px;flex:none;overflow-y:auto;" in out
    # one column, so a thumbnail is big enough to read
    assert (".dg-sheet{display:grid;gap:10px;margin-top:10px;\n"
            "  grid-template-columns:1fr;}") in out


def test_the_headings_are_words_and_the_controls_are_clusters(out):
    assert (".dg-h{font-family:var(--sans);font-size:15px;font-weight:600;\n"
            "  letter-spacing:0;text-transform:none;") in out
    assert ".dg-count{font-family:var(--sans);font-size:11.5px;" in out
    assert "    function grp(name){" in out
    for name in ("Size", "Weight", "Alignment", "Typeface", "Colours"):
        assert f"    grp('{name}');" in out, name
    assert ".dg-grp{display:flex;align-items:center;gap:4px;" in out
    assert ".dg-grplab:empty{display:none;}" in out
    # ...and the three numbers under the board are a captioned group too
    assert "    nlab.className='dg-grplab';nlab.textContent='Exactly';" in out
    assert ".dg-nums{border:1px solid #ffffff1c;border-radius:8px;" in out


def test_the_board_shows_the_real_boxes_not_only_the_master(out):
    """The dragged rectangle is the default the style stamps. Behind it,
    every box that actually wears it; and on request everything else,
    one colour per kind."""
    assert "  var dgShowOthers=false;" in out
    assert "  var DG_KIND_COL={text:'#6b9bff',cell:'#f0a848',image:'#a586e8'," in out
    assert "  function dgGhostsFor(board,id){" in out
    assert "        var mine=(a.k==='text'&&a.style===id);" in out
    assert "        if(!mine&&!dgShowOthers) return;" in out
    assert "createTextNode(' Show everything else')" in out
    assert "  function dgKeyList(key,id){" in out
    # the one in question glows and is thicker
    assert (".dg-ghost{box-shadow:0 0 0 1px rgba(240,168,72,.35),\n"
            "  0 0 14px rgba(240,168,72,.45);border-width:2px;z-index:3;}") in out
    assert ".dg-real{position:absolute;border:1px solid rgba(240,168,72,.55);" in out
    assert ".dg-other{position:absolute;border:1px dashed currentColor;" in out
    assert ".dg-keyit.dg-keymine::before{border:2px solid var(--amber,#f0a848);" in out


def test_picking_slides_is_cumulative_and_feeds_the_table(out):
    assert "  var dgSheetPick={};" in out
    assert "  function dgPickedAny(){" in out
    assert "  function dgPickedCount(){" in out
    assert ("        if(dgSheetPick[i]) delete dgSheetPick[i]; "
            "else dgSheetPick[i]=1;") in out
    # the table and the board both narrow to them
    assert "      if(dgPickedAny()&&!dgSheetPick[si]) return;" in out
    assert "      if(dgPickedAny()&&!dgSheetPick[si]) return;" in out
    assert "      only.textContent=np+' slide'+(np===1?'':'s')+' picked " in out


def test_the_table_edits_the_words_and_its_boxes_are_smaller(out):
    assert "    var heads=['','Slide','Text',' X',' Y',' Width'];" in out
    assert "        ti.type='text';ti.className='dgt-tx';" in out
    assert "        ti.value=String(r.a.text||'');" in out
    assert "          if(r.a.html!==undefined) r.a.html=esc(v);" in out
    # a list keeps its label: a one-line input cannot say what one is
    assert "      if(r.a.k==='text'&&!listOf(r.a)){" in out
    assert "          ?'A list: edit its words on the slide'" in out
    assert ".dgt-n{max-width:74px;}" in out
    assert "    repeat(calc(var(--dgt-cols) - 5),minmax(52px,.5fr)) 34px 34px;" in out
