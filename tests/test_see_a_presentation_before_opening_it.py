"""See a presentation before opening it (T599).

The user, 2026-09-30: "would be cool when opening files if there was a way
to preview files. like I have been trying to find the one correct file, but
I had to keep opening heaps. Like would be cool if when hovering or
something the little thumbnails that you have during a presentation could
appear and you could scroll through to see if it is the right
presentation."

The Open dialog has a Find field (a presentation's name, or any words on
its slides) and a Preview column: pointing at a row, or tabbing to it,
paints that deck's slides with the strip's own thumbnails, in that deck's
own colours, lighting the slides that hold the words searched for. Home's
recent rows show the same preview in a card beside the row. And the
presentation files in a folder -- the one Junoview saves into, or any other
-- are listed, previewed and searched the same way, before any is opened.

Which slides a search lights RUNS here: it is a decision about words.
"""

from __future__ import annotations

import json
import subprocess
import tempfile
from pathlib import Path

import pytest

from junoview import assets


def _run(fns: tuple[str, ...], script: str):
    from helpers_js import js_engine, lift_fn
    eng = js_engine()
    if eng is None:
        pytest.skip("no node or VS Code Electron on this machine")
    cmd, env = eng
    src = assets.deck_js()
    pre = "\n".join(lift_fn(src, f) for f in fns) + "\n"
    with tempfile.TemporaryDirectory() as d:
        p = Path(d) / "run.js"
        p.write_text(pre + script, encoding="utf-8")
        r = subprocess.run(cmd + [str(p)], capture_output=True, text=True,
                           encoding="utf-8", env=env, timeout=60)
    assert r.returncode == 0, r.stderr[:2000]
    return json.loads(r.stdout.strip().splitlines()[-1])


def test_a_slide_is_found_by_every_word_it_shows():
    """Titles, text boxes, table cells and the speaker notes -- not the
    grey hints an untouched slide shows (T366: a hint is not content)."""
    got = _run(("pvSlideWords", "pvMatchWords"), """
      function tableRows(a){return a.rows;}
      var slides=[
        {title:'ENSO and blocking',annots:[{k:'text',text:'Why the Tasman'}]},
        {annots:[{k:'table',rows:[['Region','Niño-3.4'],['Tasman','x']]}]},
        {annots:[{k:'text',ph:1,text:'Body text'}],notes:'mention La Niña'},
        {annots:[{k:'text',text:'Composite on Niño-3.4 and blocking days'}]}];
      var w=slides.map(pvSlideWords);
      console.log(JSON.stringify({
        enso:pvMatchWords(w,'enso'),
        tasman:pvMatchWords(w,'  TASMAN '),
        hint:pvMatchWords(w,'body text'),
        notes:pvMatchWords(w,'la niña'),
        both:pvMatchWords(w,'blocking niño'),
        none:pvMatchWords(w,''),
        missing:pvMatchWords(w,'nothing like this')}));
    """)
    assert got["enso"] == [0]
    assert got["tasman"] == [0, 1]          # case and spaces do not matter
    assert got["hint"] == []                # a placeholder is not content
    assert got["notes"] == [2]              # the notes are the talk's words
    assert got["both"] == [3]               # every word, on the same slide
    assert got["none"] == [] and got["missing"] == []


def test_a_row_is_kept_by_its_name_or_by_its_slides():
    got = _run(("pvMatchWords", "hubMatch"), """
      var WORDS={'Lab meeting':['progress','revise the enso composite'],
                 'Thesis':['heatwaves']};
      function pvMatches(n,q){return pvMatchWords(WORDS[n]||[],q);}
      var a={name:'ENSO seminar'},b={name:'Lab meeting'},c={name:'Thesis'};
      console.log(JSON.stringify({
        all:[hubMatch(a,''),hubMatch(b,''),hubMatch(c,'')],
        enso:[hubMatch(a,'enso'),hubMatch(b,'enso'),hubMatch(c,'enso')],
        hits:b.hits}));
    """)
    assert got["all"] == [True, True, True]
    # by name, by a slide, and not at all
    assert got["enso"] == [True, True, False]
    # the row carries how many slides matched, to say so
    assert got["hits"] == [1]


# ------------------------------------------------------------- the paint


def test_another_decks_slides_are_painted_as_that_deck(out):
    """The renderer reads `pres` for palette, page and masters, so for one
    synchronous paint `pres` IS the previewed deck -- and is put back in a
    finally, with the two other globals a paint touches."""
    body = out.split("  function renderDeckPreview(host,name,opts){")[1] \
        .split("\n  }\n")[0]
    assert "    var keep={p:pres,paint:paintSlide,h:miniHNow};" in body
    assert "      pres=d;" in body
    assert "      pres=keep.p;paintSlide=keep.paint;miniHNow=keep.h;" in body
    assert body.index("    try{") < body.index("      pres=d;") \
        < body.index("    } finally {")
    # its own ink for text with no colour of its own
    assert "      applyTokens(list);" in body
    assert ("      list.classList.toggle('page-light',pageIsLight("
            "tokVal('@page')));") in body
    # one odd slide cannot blank the rest
    assert "        try{m=miniDiagram(s);}" in body


def test_the_open_dialog_finds_and_previews(out):
    page = assets.page_template()
    assert 'id="presentation-hub-find"' in page
    assert 'id="presentation-hub-pv"' in page
    assert 'id="presentation-hub-dirbtn"' in page
    row = out.split("  function presentationLibraryRow(p,click){")[1] \
        .split("\n  }\n")[0]
    assert ("    b.addEventListener('mouseenter',function(){"
            "hubPreview(p.name);});") in row
    assert "    b.addEventListener('focus',function(){hubPreview(p.name);});" in row
    # Ctrl+K (as tabs) lands in Find
    assert "APP.deckHub({find:true})" in assets.app_js()
    assert ":(opts&&opts.find)?'#presentation-hub-find':" in out
    # a closed dialog paints no preview behind itself
    assert "    if(!root.hidden){  /* a list re-drawn behind a closed" in out


def test_home_shows_the_same_preview_beside_a_row():
    js = assets.app_js()
    assert ("      b.addEventListener('mouseenter',function(){"
            "pvCardShow(b,p.name);});") in js
    assert "      b.addEventListener('mouseleave',pvCardHideSoon);" in js
    assert "        APP.deckPreview(c,name,{w:172,open:function(nm){" in js
    # it stays while the pointer is on it, so it can be scrolled
    assert ("    pvCard.addEventListener('mouseenter',function(){"
            "clearTimeout(pvHideT);});") in js


def test_a_folders_files_are_listed_read_late_and_opened_to_write_back(out):
    lst = out.split("  function hubDirList(dir){")[1].split("\n  }\n")[0]
    assert "try{it=dir.values();}" in lst
    assert "/\\.junoview(\\.html)?$/i.test(h.name||'')" in lst
    # newest first
    assert "return b.at-a.at;" in lst
    # read only when pointed at or searched
    assert "    return r.file.text().then(function(txt){" in out
    op = out.split("  function hubDirOpen(r){")[1].split("\n  }\n")[0]
    assert "    openDeckHandles([r.h]);" in op
