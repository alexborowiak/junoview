"""T403: a flip-book page can be its own object.

The user, 2026-09-13: "there should be ways to change the size of one
and not others, e.g. in object there is like a 'unlink this frame' or
something and then individual ones can be moved around and changed
opacity and size individually whilst still being part of the book."

A book's pages share one box by design (the letterbox note in
renderAnnots says why). So a page that wants its own place is taken
OUT of the box and TIED to it: the picture becomes an ordinary object
on the slide that shows with this page only -- the a.fb/a.fbf tie
every caption already uses -- and the page stays in the book as a
blank leaf ({own:1}) so the click stops, the numbering and every other
tie are untouched. "Put back" is the reverse.
"""

from __future__ import annotations


def test_a_page_leaves_the_box_and_stays_tied_to_it(out):
    assert "  function flipUnlink(a,i){" in out
    assert "    if(!a.fid) a.fid=flipId();" in out
    assert ("    var o={x:a.x,y:a.y,w:a.w||40,h:a.h||32,"
            "fb:a.fid,fbf:i,fbm:'only'};") in out
    assert "    if(f.src){o.k='image';o.src=f.src;if(f.okey) o.okey=f.okey;}" in out
    assert "      o.k='cell';o.ref=f.ref;" in out
    # the leaf keeps the page's place in the book
    assert "    var leaf={own:1};" in out
    assert "    fr[i]=leaf;a.frames=fr;a.at=i;" in out
    # the object takes the box the picture filled, not the whole book
    assert "  function fitObjToPicture(o,s){" in out
    assert "      if(bw/bh>ar) fw=bh*ar; else fh=bw/ar;" in out


def test_put_back_is_the_reverse(out):
    assert "  function flipRelink(a,i){" in out
    assert "  function flipOwnObj(s,a,i){" in out
    assert "    if(o.k==='image'){back.src=o.src;if(o.okey) back.okey=o.okey;}" in out
    assert "    fr[i]=back;a.frames=fr;a.at=i;" in out
    assert "    if(at>=0) s.annots.splice(at,1);" in out


def test_the_doors_are_the_pane_row_and_the_object_tab(out):
    # the pane row: words on the verb, and the number says it is out
    assert "        :[bic('unlink')+' Own object',function(){flipUnlink(a,i);}," in out
    assert "        ?[bic('link')+' Put back',function(){flipRelink(a,i);}," in out
    assert "        +(f&&f.own?' own':'');   /* T403 */" in out
    # the Object tab's door for the page showing (T439: a button on the
    # row, named for the direction it goes)
    assert "      if(pgF.own) flipRelink(bk,pgAt); else flipUnlink(bk,pgAt);" in out
    assert "          +(pgF.own?'Back in book':'Own object');" in out


def test_a_blank_leaf_says_so_while_editing_and_costs_nothing_in_pptx(out):
    assert "        } else if(fdef&&fdef.own&&editing){" in out
    assert "          fown.className='an-flipempty an-flipown';" in out
    assert "        else if(!(fsel&&fsel.own)) note.skipped++;" in out
    assert ("    if(f.own) return 'Page '+(i+1)+' \\u2014 its own object';"
            "   /* T403 */") in out


def test_the_format_says_what_a_leaf_is():
    fmt = open("DECK-FORMAT.md", encoding="utf-8").read()
    assert "`{own: 1}`" in fmt and "(T403)" in fmt
    from junoview.notebook import deck_schema
    src = open(deck_schema.__file__, encoding="utf-8").read()
    assert "{own: 1} -- a blank leaf" in src
