"""T387: a zoom callout, the frame's shape, and pictures that zoom
together (2026-09-12, user: "a zoom on a feature in an image, like a new
box gets created with a zoom"; "the way cropping works can be pushed
further"; "having images linked so they zoom or change in the same way").

Driven in Chromium: a box dragged over the top-left of a test picture
produced an outline, a line and a callout showing that corner enlarged,
which arrived with a Grow in the show; 16:9 on a 3:2 box trimmed 8% off
the top and bottom; two linked pictures came up side by side on Alt+click.
"""

from __future__ import annotations

from junoview.notebook.deck_schema import ANNOT_COMMON, validate_deck


def test_a_window_onto_the_picture_is_drawn_and_exported(out):
    # the renderer scales and offsets the img so the window fills the box
    assert "        if(a.win&&a.win.w>0&&a.win.h>0){" in out
    assert "          im.classList.add('an-win');" in out
    assert "          img.style.width=(10000/a.win.w).toFixed(2)+'%';" in out
    assert (".an-image.an-win .an-imgel{position:absolute;object-fit:fill;"
            "max-width:none;}") in out
    # PowerPoint gets it as a source-rect crop
    assert "              ?{t:a.win.y||0,l:a.win.x||0," in out
    # written down, and a deck carrying it validates clean
    assert "win" in ANNOT_COMMON and "sync" in ANNOT_COMMON
    deck = {"name": "t", "slides": [{"annots": [
        {"k": "image", "x": 5, "y": 5, "w": 30, "h": 24, "src": "data:x",
         "sync": 0},
        {"k": "image", "x": 40, "y": 5, "w": 30, "h": 24, "src": "data:x",
         "sync": 0, "win": {"x": 10, "y": 10, "w": 40, "h": 40}}]}]}
    assert validate_deck(deck) == []


def test_the_zoom_callout_is_three_grouped_things(out):
    assert 'id="fmt-zoomcall"' in out
    assert "    '#fmt-zoomcall':'image'," in out
    assert "  function armZoomCall(){" in out
    assert "  function makeZoomCallout(idx,win){" in out
    # the callout's box has the window's shape, so nothing is stretched
    assert "    var wmm=aw/100*pw*win.w/100,hmm=ah/100*ph*win.h/100;" in out
    # outline + line + callout, one group, the callout on a build of its own
    assert "      anim:{type:'zoom',order:nextAnimOrder(s)}};" in out
    assert "    outline.grp=gid;line.grp=gid;call.grp=gid;" in out
    assert "    line.nohead=1;line.color=col;line.sw=SW_DEFAULT;" in out
    # Escape puts the overlay away with nothing changed
    assert ("    if(e.key==='Escape'){e.preventDefault();e.stopPropagation();"
            "endZoomCall(false);}") in out


def test_the_frame_has_a_shape_row(out):
    assert "ar.className='crop-inset crop-aspect';" in out
    assert "    [['16:9',16/9],['4:3',4/3],['1:1',1],['3:2',1.5],['2:3',2/3]]" in out
    # trims two OPPOSITE edges, centred, in the page's own millimetres
    assert ("            var R=((a.w||30)/100*page.mm[0])"
            "/((a.h||24)/100*page.mm[1]);") in out
    assert "            if(R>pr[1]){c.l=c.r=Math.round((1-pr[1]/R)/2*1000)/10;}" in out
    assert "            else {c.t=c.b=Math.round((1-R/pr[1])/2*1000)/10;}" in out


def test_linked_pictures_come_up_together(out):
    assert 'id="fmt-linkzoom"' in out
    assert "    '#fmt-linkzoom':'image cell'," in out
    assert "  function linkZoomSel(){" in out
    assert "  function pictureSync(){" in out
    assert ("      if(typeof pictureSync==='function') pictureSync();"
            "   /* T387 */") in out
    # the spotlight asks for mates first, and lays them out at ONE scale
    assert "  function syncMates(item){" in out
    assert "    var mates=syncMates(item);" in out
    assert "    if(mates.length>1){spotlightMany(mates);return;}" in out
    assert "  function spotlightMany(items){" in out
    assert "      k=Math.min(k,share/r.width,innerHeight*pad/r.height);});" in out
    # the same clone the single spotlight makes, in one helper
    assert "  function spotClone(item){" in out
