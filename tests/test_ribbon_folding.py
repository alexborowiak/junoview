"""Group folding, and the tabs it makes affordable (T187-T191).

The user, fifth review of 2026-09-02: "the insert options like text
should be like 'Effect'... you currently can't insert text... what
happened to the notebook cell option... why is the cancel button in the
weirdest spot... what is the charts??? get rid of it... too many things
are in buttons in buttons... do the same with the Design tab... what is
'design tokens'?"

Spreading controls out makes rows wider than a window. The mechanism
that pays for it is group folding: still over after the whole ladder,
the rightmost group becomes one worded door over a popover holding its
row, and again until the bar fits -- the way PowerPoint collapses a
group on a narrow window. What it does was driven in a browser.
"""

from __future__ import annotations


def test_a_group_that_does_not_fit_folds_into_one_door(out):
    """T187. The last rung of the ladder. Unfold everything before
    measuring, fold from the right until it fits; never the fixed groups,
    never a mode's exit; a layout unfolds all before it moves anything.
    """
    assert "function rbnFoldGroup(g){" in out
    assert "function rbnUnfoldGroup(g){" in out
    assert "function rbnUnfoldAll(){" in out
    assert "function rbnFoldOne(){" in out
    # before anything is measured
    assert ("    foldViewGroup(false);\n    rbnUnfoldAll();\n"
            "    sizeRibbonGroups();") in out
    # after every other rung
    assert ("    while(bar.scrollWidth>bar.clientWidth+1&&guard++<12&&rbnFoldOne())\n"
            "      sizeRibbonGroups();") in out
    # the real row moves into the popover; nothing is copied
    assert "    menu.appendChild(row);\n" in out
    assert "    if(row) g.insertBefore(row,wrap);\n" in out
    # the door is words plus an icon, named for the group
    assert "btn.innerHTML=bic('menu')+' '+esc(name)+' \\u25be';" \
        in out
    # rightmost ON SCREEN, since flex order decides the visual order
    assert ("return x.getBoundingClientRect().left"
            "-y.getBoundingClientRect().left;") in out
    for never in ("'rbn-fixed'", "'rbn-seq'", "'rbn-cancel'"):
        assert f"&&!g.classList.contains({never})" in out, never
    # a layout moves atoms out of rows; nothing may be folded meanwhile
    assert "if(typeof rbnUnfoldAll==='function') rbnUnfoldAll();" in out
    assert ".sh-menu.rbn-foldmenu{display:block;width:auto;padding:8px 10px;}" in out


def test_insert_is_tiles_a_named_cell_and_a_drawing_group(out):
    """T188. The kinds of text box are tiles in the row (a specimen
    "Aa" over the name, lit while armed, click again to put the tool
    down); Notebook cell has its name back; Chart is gone from the
    ribbon; and the armed mode is a group of its own with its name, a
    short hint and Cancel.
    """
    assert 'id="tx-strip"' in out and "function txStripBoot(){" in out
    assert "  txStripBoot();" in out
    assert "b.className='fx-tile tx-tile';" in out
    assert "ic.textContent='Aa';" in out
    # the registry tells the strip when a type comes or goes
    assert "if(typeof txStripSync==='function') txStripSync(true);" in out
    # setTool lights the armed tile and shows the Drawing group
    assert "if(typeof txStripSync==='function') txStripSync();" in out
    assert 'class="rbn-grp rbn-cancel" data-tab="insert"' in out
    assert "stc.innerHTML='<span><b>Drawing: '+esc(word)+'</b></span>'" in out
    assert ".deck.erc-tight .et-status span+span{display:none;}" in out
    assert "Notebook cell</button>" in out
    assert 'id="ins-chart"' not in out and "var ic2=$('#ins-chart');" not in out
    # ...and the shapes are tiles of their own since T197 ("the shapes
    # should be on their own")
    assert 'id="shape-strip"' in out and "function shapeStripBoot(){" in out
    assert 'id="sh-btn"' not in out


def test_the_page_size_is_tiles_and_tokens_have_a_plain_name(out):
    """T190. Eight presets drawn at their own proportion, the one in use
    lit, from the same table the menu was; and Colours & spacing for
    what Design tokens are.
    """
    assert 'id="page-strip"' in out and 'id="page-menu"' not in out
    assert "o.className='fx-tile page-tile';" in out
    assert "var k=Math.min(26/pg.aw,18/pg.ah);" in out
    assert "$$('#page-strip .page-tile').forEach(function(o){" in out
    assert "function closePageMenu(){}" in out
    assert "Colours &amp; spacing</button>" in out
    assert ".page-ico{display:block;border:1.5px solid currentColor;" in out


def test_a_born_empty_text_box_says_it_is_there(out):
    """T191. With no placeholder words and no panel (2026-08-19) a fresh
    box was a caret and nothing else, which read as "you can't insert
    text". The box now says Type... until you do, and the Effect and
    Timing labels stop instructing.
    """
    assert ('.deck.editing .an-item.an-text .an-tx[contenteditable="true"]'
            ':empty::before{') in out
    assert "if(lab) lab.textContent='Effect';" in out
    assert "if(lab) lab.textContent=(st.on&&st.text)?'Timing & text':'Timing';" in out
