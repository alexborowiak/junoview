"""Every box of a kind, in a table you can pull into line (T224).

The user, 2026-09-03, on the Style system screen: "I wanted more than
just titles, also images etc. Also clicking one of the slides down the
bottom takes you to the slide, it should just select it and bring up the
types of objects... There should be unselect all, and select all button
... Would be good if there was also a table of them all to the right,
which has things like colour, font etc. of them all and you can make
them all match, or change them individually here, or change title
colours in a range... it would be good if you could click a bunch and
they get selected, then you click a button that says 'match style of',
then click one and they all match to that. And you can choose as well
what gets matched, whether it's all, or just position, or colour, or
font etc. Do you get the point of this? So it is hard to make things
match across slides, so this will help with this."

The table was driven in a browser on a three-box deck: ticking two rows
and matching them to the third moved all three to the same X, Y, W and
size, and the slide thumbnails followed.
"""

from __future__ import annotations


def test_the_rail_lists_things_that_are_not_text(out):
    """A figure has no style registry to edit, but it has a position, a
    size and a place in the table."""
    assert ("  var DG_OBJ_KINDS=[['text','Text boxes, all of them','text'],\n"
            "    ['cell','Figures','cellcard'],") in out
    for kind in ("image', 'Pictures".replace("', '", "','"),
                 "rect','Shapes", "table','Tables",
                 "flip','Flip books", "arrow','Arrows and lines"):
        assert kind in out, kind
    assert "  function dgIsObj(){return /^obj:/.test(dgSel);}" in out
    assert "    hd.className='hd-lab';hd.textContent='everything else';" in out
    # a box with no named style used to appear in no table at all
    assert "a box that has never been given a named style" not in out
    assert "in no table at" in out


def test_the_table_is_the_real_annots(out):
    """No copy and no import step: a number typed here is the number the
    canvas renders."""
    assert "  function dgRows(){" in out
    assert "        if(dgAnnotMatches(a)) out.push({si:si,ai:ai,a:a});" in out
    assert "  function dgRowKey(r){return r.si+':'+r.ai;}" in out
    # typing writes straight onto the annot and redraws the page
    assert "      else r.a[key]=Math.round(v*10)/10;" in out
    assert "      if(key==='x'||key==='y') delete r.a.anch;" in out
    assert "      markDirty();refresh();renderFilm();" in out
    # the columns
    assert "    var heads=['','Slide','What',' X',' Y',' W'];" in out
    assert "    if(isTx) heads=heads.concat(['Size','Face']);" in out
    assert "    heads=heads.concat(['Words','Behind']);" in out
    assert "    var isTx=!dgIsObj()||dgObjKind()==='text';" in out


def test_select_all_unselect_all_and_the_count(out):
    assert "    btn('Select all','Tick every box of this kind, on every slide'," in out
    assert "    btn('Unselect all','Clear every tick',function(){" in out
    assert ("      ?(marked.length?(marked.length+' of '+rows.length+' ticked')") in out


def test_match_style_of_and_what_travels(out):
    """Tick several, press the button, click the one they should follow.
    The chooser says what travels; 'everything' is the union of the
    others, so the two cannot drift apart."""
    assert "  var DG_MATCH={" in out
    assert "    pos:['x','y']," in out
    assert "    size:['w','h','size']," in out
    assert "    colour:['color','bg','bgc','bdc','fill','fillc']," in out
    assert "    font:['font','b','i','align','lh','pspace']" in out
    assert "  function dgMatchFields(){" in out
    assert "    if(dgMatchWhat!=='all') return DG_MATCH[dgMatchWhat]||[];" in out
    assert "  function dgMatchTo(src,rows){" in out
    assert "        if(src[f]===undefined) delete r.a[f];" in out
    assert "      if(fields.indexOf('x')>=0) delete r.a.anch;" in out
    # the chooser
    assert "    [['all','everything'],['pos','only where it sits']," in out
    assert "     ['size','only how big it is'],['colour','only its colours']," in out
    assert "     ['font','only its type']].forEach(function(pr){" in out
    # armed state says what to do next
    assert "        ?'Now click the one to match'" in out
    assert "            var n=dgMatchTo(r.a,dgMarkedRows(dgRows()));" in out


def test_the_slide_strip_selects_instead_of_walking_you_out(out):
    """Clicking a slide used to close the screen and take you there.
    It narrows the table to that slide; clicking an object in it ticks
    that object, or switches the rail to its kind."""
    assert "        dgSheetPick=(dgSheetPick===i)?-1:i;" in out
    assert "      if(dgSheetPick>=0&&si!==dgSheetPick) return;" in out
    assert "only.textContent='Slide '+(dgSheetPick+1)+' only " in out
    assert "      cell.classList.toggle('dg-pick',dgSheetPick===i);" in out
    # the object proxy
    assert "          if(!dgAnnotMatches(a)){" in out
    assert "            dgSel=(a.k==='text'&&a.style)?a.style:('obj:'+a.k);" in out
    assert "          var ai=(sl.annots||[]).indexOf(a);" in out
    # ...and nothing in the strip closes the screen any more
    assert "dgClose();refresh();" not in out


def test_the_outline_sheet_serves_both_views(out):
    """It was inline in dgBody, so only the text-style view had it."""
    assert "  function dgSheet(body,ov){" in out
    assert out.count("    dgSheet(body,ov);") == 2
    assert ".dgt-grid{display:grid;" in out
    assert ".dg-cell.dg-pick{outline:2px solid var(--cyan);" in out
