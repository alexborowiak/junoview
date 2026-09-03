"""Home opened out, shapes as tiles, and the Object tab's provenance
row (T195-T199).

The user, seventh review of 2026-09-02: "the dot points appear where the
dashed selection line is... where is the animate by dot point thing
gone... the slide layouts, the match slide options, there is so many
good options in there... the shapes should be on their own... when
selecting an image, the object view should have the object paths,
refresh from path button, lock option... where has the ability to
refresh all images gone?"
"""

from __future__ import annotations


def test_the_bullet_marker_sits_inside_the_box(out):
    """T195. An outside marker sits about 1em left of its text; at
    1.15em of padding it was drawn on the box's edge, under the dashed
    selection line."""
    assert ".an-tx.an-ul{margin:0;padding-left:calc(1.7em + var(--an-ind,0));}" in out
    assert ".an-tx.an-ul ul{list-style:circle;margin:0;padding-left:1.5em;}" in out


def test_homes_layout_system_is_groups_and_a_strip(out):
    """T196. The Layouts dropdown becomes Layout (tiles), Arrange this
    slide, Saved layouts and Sources. Every row keeps its id and its
    wiring; the picker renders into the strip as its third home; the
    review's sweep lights the one this slide wears."""
    # ...regrouped by what you are doing in T201: make a slide, lay it
    # out (built-in and saved layouts as one strip), arrange what is on
    # it, keep the sources fresh, push a layout to other slides
    # ...and again in T202 ("the groupings still make no sense"): a tile
    # on Home MAKES a slide, This slide holds what you do to it, Keep up
    # to date is three tall tiles, Masters went back to Design
    # ...and in T204 the layout groups left Home for Design ("this is
    # getting confusing all the parts everywhere"); Home is three things
    for lab in ("New slide", "This slide", "Keep up to date",
                "Layout", "Apply to other slides"):
        assert f'<span class="rbn-lab">{lab}</span>' in out, lab
    for gone in ("Saved layouts", "Sources", "Slides", "Arrange this slide"):
        assert f'<span class="rbn-lab">{gone}</span>' not in out, gone
    assert 'id="hm-lay-masters"' not in out
    assert "function syncSavedTiles(){" in out
    assert "b.type='button';b.className='dbtn lay lay-saved';" in out
    assert "if(typeof syncSavedTiles==='function') syncSavedTiles();" in out
    # the strip's tile makes a slide; the Design menu's changes this one
    assert "if(sel==='#layout-strip'){" in out
    assert "function newVersion(lay,arr){" in out
    # (since T218 a saved tile is CHOSEN for the next New slide, like the
    # built-in tiles; newVersion reads the choice back)
    assert "lsSet(newLayKey(),'arr:'+b.dataset.arr);" in out
    assert "ns.annots=deep(arr.annots);" in out
    for tile in ("hm-refresh-figs", "hm-refresh-img", "hm-images"):
        assert f'class="fx-tile big-tile" id="{tile}"' in out, tile
    assert ".big-strip .fx-tile{height:56px;}" in out   # the one tile (T205)
    # ...and it never folds: the point of it is to be seen
    assert "&&!g.classList.contains('rbn-sources')" in out
    # the All images pane
    assert 'class="selpane imgpane" id="imgpane" hidden' in out
    assert "function renderImgPane(){" in out
    assert "imgpane:'#hm-images'," in out
    assert "if(lockMode(a2)) delete a2.lock; else a2.lock='pos';" in out
    assert 'id="layout-strip"' in out
    assert "['#layout-row','#layout-menu-grid','#layout-strip']" in out
    # the slide's own sweep leaves the strip alone since T218: the strip
    # lights the layout the NEXT slide takes
    assert "$$('#layout-row .lay,#layout-menu-grid .lay')" in out
    assert "if(typeof syncNewSlideMarks==='function') syncNewSlideMarks();" in out
    for cid in ("hm-lay-ideas", "hm-lay-tidy", "hm-lay-arrs", "hm-lay-arrsave",
                "hm-lay-give"):
        assert f'id="{cid}"' in out, cid
    for gone in ('id="hm-lay"', 'id="hm-laywrap"', 'id="hm-lay-menu"',
                 'id="layout-home-grid"'):
        assert gone not in out, gone
    # the two refresh-all doors press the File menu rows
    assert 'id="hm-refresh-figs"' in out and 'id="hm-refresh-img"' in out
    assert "var m2=$('#mi-refresh-img'); if(m2) m2.click();});" in out
    assert "var m3=$('#mi-refresh-figs'); if(m3) m3.click();});" in out
    # the rarer two sit last, so they fold first and View stays in sight
    assert ".rbn-layout,.rbn-this,.rbn-arrange{order:1;}" in out
    assert ".rbn-sources{order:2;}" in out and ".rbn-apply{order:1;}" in out
    assert ".lay-strip>.hd-lab,.lay-strip>.lay-sec{display:none;}" in out


def test_shapes_are_a_strip_of_their_own(out):
    """T197. Fifteen tiles by the same shapeIcon the Object tab's Shape
    menu uses; the armed one lit; click again to put the tool down."""
    assert '<span class="rbn-lab">Shapes</span>' in out
    assert 'id="shape-strip"' in out
    assert "function shapeStripBoot(){" in out
    assert "  shapeStripBoot();" in out
    assert "b.className='fx-tile shape-tile';" in out
    assert "if(tool==='rect'&&pendingShape===pair[0]){setTool('select');return;}" in out
    assert "if(typeof shapeStripSync==='function') shapeStripSync();" in out
    for gone in ('id="sh-btn"', 'id="sh-menu"', 'id="sh-drop"'):
        assert gone not in out, gone


def test_where_it_came_from_is_on_the_row(out):
    """T198. From, Refresh from file and Lock in place in the Object
    group; the by-bullet trio beside the effects, with a Fade first for a
    box that has no entrance."""
    for cid in ("fmt-path", "fmt-lock", "fmt-imgrefresh",
                "fmt-by-all", "fmt-by-para", "fmt-by-sent"):
        assert f'id="{cid}"' in out, cid
    assert "if(kind==='image'&&a.fname) from=a.fname;" in out
    assert "show('#fmt-lock',isNum,isNum&&pinned(a));" in out
    assert "else if(lockMode(a)==='') a.lock='pos';});" in out
    assert "if(!a2.anim) setType('fade');\n        setBy(p[1]);" in out
    assert "b.hidden=!isTx;" in out
    # governed, so the completeness audit stays quiet
    assert "#fmt-path #fmt-lock #fmt-by-all #fmt-by-para #fmt-by-sent" in out
