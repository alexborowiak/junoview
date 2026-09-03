"""A text style carries everything (T223).

The user, 2026-09-03: "In the text styles, you can only change size and
bold and stuff. I said I wanted also colours of text, background colour,
box border colour, font style. I said I wanted everything." And, of the
Style system screen: "why doesn't it show the x and y position as well,
and then things like the size... The button says 'put all 8 of them
there', what the heck. Do you think about writing? 'Apply to all'."
"""

from __future__ import annotations


def test_the_vocabulary_lives_in_one_list(out):
    """There were four hand-kept copies of it and they had already
    drifted: addCustomType silently dropped `head`, so a style based on
    Heading 2 was not a heading."""
    assert ("  var STYLE_FIELDS=['b','i','font','color','align','lh','pspace',\n"
            "    'head','bg','bdc'];") in out
    # every place that used to carry its own list now reads the one
    assert "      STYLE_FIELDS.forEach(function(k){\n" in out
    assert "    STYLE_FIELDS.forEach(function(k){\n" in out
    assert "        STYLE_FIELDS.forEach(function(k){\n" in out
    assert "            STYLE_FIELDS.forEach(function(k2){\n" in out
    for gone in ("['b','i','font','color','align','lh','pspace','head']",
                 "['b','i','font','color','align','lh','pspace']",
                 "['b','i','font','color','align'].forEach"):
        assert gone not in out, gone


def test_a_style_can_set_the_two_new_colours(out):
    """Behind the words and round the box. 'none' is a real answer and
    different from not having said anything, which is why neither is
    just absent-or-set."""
    assert ("    if(d.bg==='none'){a.bg=0;delete a.bgc;}\n"
            "    else if(d.bg){a.bg=1;a.bgc=d.bg;}\n"
            "    else {delete a.bg;delete a.bgc;}") in out
    assert ("    if(d.bdc&&d.bdc!=='none') a.bdc=d.bdc;\n"
            "    else if(d.bdc==='none') a.bdc='none';\n"
            "    else delete a.bdc;") in out
    # ...and a text box draws the edge it is given
    assert ("        if(a.bdc) d2.style.borderColor=\n"
            "          (a.bdc==='none')?'transparent':tokVal(a.bdc);") in out


def test_both_style_editors_offer_the_whole_vocabulary(out):
    """The inline editor in the Text styles window and the Style system
    screen. Neither is allowed to be the poorer one."""
    # the window's editor
    assert "      var fsel=document.createElement('select');\n" in out
    assert "      crow.appendChild(colCtl('color','Words','#e6eef5',''));" in out
    assert "      crow.appendChild(colCtl('bg','Behind','#16273a','None'));" in out
    assert "      crow.appendChild(colCtl('bdc','Edge','#8aa0b0','None'));" in out
    # the screen
    # (T230 put them in a captioned Colours cluster)
    assert "    cg.appendChild(dgCol('color','Words','#e6eef5',''));" in out
    assert "    cg.appendChild(dgCol('bg','Behind','#16273a','None'));" in out
    assert "    cg.appendChild(dgCol('bdc','Edge','#8aa0b0','None'));" in out
    assert "    fsel.className='dg-font';" in out
    # both offer the same five faces plus "default"
    assert out.count("['','Default face'],['sans','Sans'],['serif','Serif'],") == 2


def test_the_screen_shows_the_numbers_not_just_the_drag(out):
    """Dragging sets it roughly; typing sets it exactly, and typing is
    the only way to make two decks agree."""
    assert "    var nums=document.createElement('div');nums.className='dg-nums';" in out
    assert "    [['x','X',8],['y','Y',6],['w','Width',60]].forEach(function(pr){" in out
    assert "        rec[pr[0]]=Math.round(v*10)/10;" in out
    assert ".dg-nums{display:flex;gap:14px;align-items:center;" in out


def test_the_put_button_says_apply(out):
    # (T231: the count is whatever the selection is)
    assert "?(bic('align')+' Apply to '+esc(putWhat()))" in out
    assert "    function putWhat(){" in out
    # the old wording survives only where it is quoted as history
    assert "' Put '" not in out
    assert "+' of them there')" not in out
