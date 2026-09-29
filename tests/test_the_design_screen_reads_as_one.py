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


def test_the_style_editor_is_three_clear_views(out):
    assert (".dg-h{font-family:var(--sans);font-size:15px;font-weight:600;\n"
            "  letter-spacing:0;text-transform:none;") in out
    assert ".dg-count{font-family:var(--sans);font-size:11.5px;" in out
    assert "    function grp(name){" in out
    assert "      g.dataset.group=name.toLowerCase()||'reset';" in out
    for name in ("Size", "Emphasis", "Alignment", "Typeface", "Colours"):
        assert f"    grp('{name}');" in out, name
    assert (".dg-ctrls{display:grid;grid-template-columns:repeat(2,"
            "minmax(0,1fr));") in out
    assert ".dg-grp{display:flex;align-items:center;gap:4px;min-width:0;" in out
    assert '.dg-grp[data-group="colours"],.dg-grp[data-group="reset"]{' in out
    assert ".dg-grplab:empty{display:none;}" in out
    # T519: the former two-column board over a table is three views. Each
    # keeps the existing controls but only the selected job is visible.
    assert "nlab.textContent='Exactly';" not in out
    assert "  function dgTabs(body,ov,count){" in out
    assert "    [['look','Appearance'],['place','Placement']," in out
    assert "     ['boxes','Individual boxes ('+count+')']].forEach(function(pr){" in out
    assert "    body.className='dg-body dg-view-'+dgView;" in out
    assert "    left.hidden=dgView!=='look';right.hidden=dgView!=='place';" in out
    assert "    if(dgView==='boxes') dgTable(body,ov);" in out
    assert "    if(dgView==='place'||dgView==='boxes'){" in out
    assert "    var top=document.createElement('div');top.className='dg-top';" in out
    assert ".dg-top{display:block;width:100%;max-width:980px;" in out


def test_the_rail_is_navigation_not_a_second_specimen(out):
    rail = out.split("  function dgRail(ov){", 1)[1].split(
        "\n  /* ---- the board:", 1)[0]
    assert "nm.className='dg-name';nm.textContent=d.label||id;" in rail
    assert "dgSpecimen(nm,id);" not in rail
    assert (".dg-name{line-height:1.15;min-width:0;overflow:hidden;\n"
            "  text-overflow:ellipsis;white-space:nowrap;font-size:15px;") in out
    assert "stylesHead.textContent='Text styles';" in out
    assert "hd.className='hd-lab';hd.textContent='Objects';" in out


def test_unused_variation_ideas_stay_behind_one_door(out):
    assert "lab.className='dg-lookslab';lab.textContent='Variations';" in out
    assert "sum.className='dbtn dg-lookadd';sum.textContent='Add variation…';" in out
    assert "sum.setAttribute('role','button');" in out
    assert "sum.setAttribute('aria-expanded','false');" in out
    assert ("offers=document.createElement('div');"
            "offers.className='dg-lookoffers';") in out
    assert ".dg-lookmore>summary{list-style:none;cursor:pointer;" in out


def test_the_board_shows_the_real_boxes_not_only_the_master(out):
    """Every box that actually wears the style, and everything else, one
    colour per kind. T367 took the dragged prototype off the board; T384
    (2026-09-12, user: "the visual display is gone and confusing") puts
    the WORDS on it -- each text box carries its own text at its own
    size, in cqh so a style's percent-of-page is percent-of-board, one
    set of words per place so fourteen headings at 5,4 are one title and
    thirteen outlines -- and turns everything else on by default, so the
    board reads as the slide it is. The key says "figure", not "cell"."""
    assert "  var dgShowOthers=true;" in out
    assert "  var DG_KIND_COL={text:'#6b9bff',cell:'#f0a848',image:'#a586e8'," in out
    assert "  function dgGhostsFor(board,id){" in out
    assert "        var mine=(a.k==='text'&&a.style===id);" in out
    assert "        if(!mine&&!dgShowOthers) return;" in out
    # T470: the same boxed switch as the sheet column's Outlines
    assert "ck.className='dbtn dg-b dg-keyck';" in out
    assert "ck.innerHTML=bic('eye')+' Show other objects';" in out
    assert "  function dgKeyList(key,id){" in out
    assert "  function dgBoardWords(b,a,def){" in out
    assert "    t.style.fontSize=size.toFixed(2)+'cqh';" in out
    assert "        var at=(mine?'m':'o')+a.k+':'+dgPlaceKey(a);" in out
    assert "      it.textContent=DG_KIND_WORD[k]||k;" in out
    assert ".dg-board{position:relative;width:100%;container-type:size;" in out
    # the prototype's CSS went with it
    assert ".dg-ghost{" not in out
    # an EMPTY bubble no longer sits over the key: hidden beats flex
    assert ".dg-bub[hidden]{display:none!important;}" in out
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
    assert "    var heads=['','Slide','Contents',' X',' Y',' Width'];" in out
    assert "        ti.type='text';ti.className='dgt-tx';" in out
    assert "        ti.value=String(r.a.text||'');" in out
    assert "          if(r.a.html!==undefined) r.a.html=esc(v);" in out
    # a list keeps its label: a one-line input cannot say what one is
    assert "      if(r.a.k==='text'&&!listOf(r.a)){" in out
    assert "          ?'A list: edit its words on the slide'" in out
    assert ".dgt-n{max-width:74px;}" in out
    # (T490: the two colour columns hold a picker and its Default / None)
    assert "    repeat(calc(var(--dgt-cols) - 5),minmax(52px,.5fr)) 88px 74px;" in out


def test_the_slide_column_has_select_all_and_unselect_all(out):
    """It picks slides, so it needs the two buttons the table has."""
    assert "picks.className='dg-picks';" in out
    assert "    pickBtn('All slides','Pick every slide shown here',function(){" in out
    assert "    pickBtn('Clear','Clear every picked slide',function(){" in out
    # Select all takes what the column is showing, which its scope decides
    assert "        if(dgInScope(dgSheetScope,i)) dgSheetPick[i]=1;});" in out
    # T367: "none picked - everything counts" meant "you have picked no
    # slides, so the table covers all of them"; it says that now
    assert "      ?(dgPickedCount()+' of these slides')" in out
    assert "      :'all slides';" in out
    assert ".dg-picks{display:flex;align-items:center;gap:6px;" in out
    assert "    dgSectionHead(body,'Slides'," in out
    assert ".dg-sheetcol[hidden]{display:none!important;}" in out


def test_apply_is_for_the_selection_and_has_no_scope_of_its_own(out):
    """Three answers to "which slides" and only one of them did
    anything. The selector is gone; the button reads the selection."""
    assert "var dgPutScope" not in out
    assert "    var pickMode=function(){" in out
    assert "      if(ticked.length) return {ws:ticked,how:'ticked'};" in out
    assert "      return {ws:wear,how:'all'};" in out
    assert "    function putWhat(){" in out
    assert "      if(m.how==='ticked') return m.ws.length+' ticked box'" in out
    assert "          ?'No boxes wear this style'" in out
    assert "          :'None of what you selected wears this style')" in out
    # ...and the put row is the button alone now
    assert "    putRow.appendChild(put);" in out
    assert "    putSync();" in out
