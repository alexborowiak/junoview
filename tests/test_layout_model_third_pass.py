"""T494: the layout model, after the third review pass (2026-09-15).

Eight findings from the layout-model lens, each reproduced live by a
skeptic agent and driven again A/B after the fix. These are substring
pins only; the live drive (drive6.py, impl_layout-model/) is the guard
for the runtime half -- a substring test cannot see a tile lit for the
wrong layout or "Confidential resul" printed on another deck's slide.
"""

from __future__ import annotations


def test_a_saved_layout_keeps_no_words_and_arrives_as_placeholders(out):
    # [31] the slot's word, never the slide's; old stores read the same way
    assert "  function arrWord(a){" in out
    assert "      if(a.k==='text') o.text=arrWord(o);" in out
    assert "          if(a&&a.k==='text') a.text=arrWord(a);" in out
    assert "annotLabel(a).replace(" not in out
    # New slide places the shapes as placeholders (T366), cells empty
    assert "        ns.annots=deep(arr.annots).map(function(a){" in out
    assert "          if(a&&a.k==='text') a.ph=1;" in out
    assert "          if(a&&a.k==='cell') a.ref=null;" in out


def test_the_pickers_stamp_which_layouts_not_how_many(out):
    # [32] two decks with one custom layout each must not share tiles
    assert "      var stamp=variant+':'+((pres&&pres.layouts)||[]).map(" in out
    assert "((pres&&pres.layouts)?pres.layouts.length:0);" not in out


def test_new_slide_lands_after_the_whole_version_group(out):
    # [33] the same rule dupSlide follows (T318)
    assert ("    var ar=(typeof altRun==='function')?altRun(cur):null;\n"
            "    var at=ar?(ar.at+ar.n):(pres.slides.length?cur+1:0);") in out


def test_a_saved_tile_is_known_by_its_id_and_relit(out):
    # [34] id, not index; a store entry without one gets a steady one
    assert "      b.dataset.arrId=arr.id;" in out
    assert "        lsSet(newLayKey(),'arr:'+b.dataset.arrId);" in out
    assert "        var hit=arrById(key.slice(4));" in out
    assert "        if(!arr.id) arr.id='arr'+i;" in out
    assert "arrList()[+key.slice(4)]" not in out
    # the rebuilt tiles re-light, so Forget leaves the readout honest
    assert ("    if(typeof syncNewSlideMarks==='function') syncNewSlideMarks();\n"
            "  }\n"
            "  function arrById(id){") in out


def test_a_placeholder_is_never_carried_by_change_layout(out):
    # [35] only typed boxes enter the reuse pool (cells: only with a ref)
    assert ("    var texts=old.filter(function(a){"
            "return a.k==='text'&&!a.ph;});") in out
    assert ("    for(;ci<cells.length;ci++) if(cells[ci].ref) "
            "next.push(cells[ci]);") in out


def test_a_placeholder_leaves_the_editor_nowhere(out):
    # [36] not to PowerPoint, not as the slide's name, faint in a thumbnail
    assert "      if(a.k==='text'&&a.ph) return;" in out
    assert "      return a.k==='text'&&a.text&&!a.ph;})[0];" in out
    assert "      if(a.ph) return;   /* T494: a hint is not a heading */" in out
    assert ("      if(a.k==='text'){miniText(d,a,a.text||'',"
            "a.ph?'is-ph':'');return;}") in out
    assert ".mini-tx.is-ph{opacity:.38;outline:1px solid currentColor;" in out


def test_a_choice_that_no_longer_exists_is_the_default(out):
    # [37] the builder's Delete, the strip's re-light, and newVersion agree
    assert ("          if(lsGet(newLayKey())===l.id) "
            "lsSet(newLayKey(),'cell-text');") in out
    assert ("    if(!chosen&&key!=='cell-text'&&tiles.length"
            "&&!pageOf().poster){") in out
    assert "      lsSet(newLayKey(),'cell-text');" in out
    assert ("        lay=lay||layoutById(/^arr:/.test(key)?'cell-text':key)\n"
            "          ||layoutById('cell-text');") in out


def test_on_a_poster_the_tile_is_new_version(out):
    # [38] the tile wears the verb it does; the small door stands down
    assert "      if(nw) nw.textContent=poster?'New version':'New slide';" in out
    assert "      if(glab) glab.textContent=poster?'New version':'New slide';" in out
    assert "      if(vb) vb.hidden=poster;" in out
    assert ("        ?'Copy this poster to a new version you can change "
            "independently. '") in out
