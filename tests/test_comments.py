"""Comments on a slide or an object, for the working deck only (T563).

A comment is pinned to an object by its durable oid (or to a spot on the
slide, or to the slide), lives in ``s.comments``, can be answered and
resolved, and is listed in the Comments pane on View. It is part of the
working document -- a project save and a .junoview file keep it, like the
speaker notes -- and never part of the talk: the markers are drawn only
on the live editing page, the show closes the pane, and the standalone
web page leaves the comments out of the deck it carries.
"""

from __future__ import annotations

import json
import subprocess
import tempfile
from pathlib import Path

import pytest

from helpers_js import js_engine, lift_fn
from junoview import assets
from junoview.notebook.deck_schema import SLIDE_KEYS
from junoview.notebook.presentations import as_presentations


def _run(src: str) -> object:
    eng = js_engine()
    if eng is None:
        pytest.skip("no JS engine")
    cmd, env = eng
    with tempfile.TemporaryDirectory() as d:
        p = Path(d) / "t.js"
        p.write_text(src, encoding="utf-8", newline="\n")
        r = subprocess.run(cmd + [str(p)], capture_output=True, text=True,
                           env=env, timeout=60)
    assert r.returncode == 0, r.stderr[:2000]
    return json.loads(r.stdout.strip().splitlines()[-1])


def test_the_part_is_concatenated_and_booted():
    assert "63-comments" in assets.DECK_PARTS
    js = assets.deck_js()
    assert "function commentsBoot(){" in js
    boot = js.split("THE BOOT SEQUENCE", 1)[1]
    assert "  commentsBoot();" in boot


def test_the_door_the_pane_and_every_ribbon_layout():
    html = assets.load("html/deck.html")
    assert 'id="comments-btn"' in html
    assert '<i data-ic="comment"></i> Comments</button>' in html
    assert ('<aside class="selpane compane" id="compane" hidden'
            in html)
    js = assets.deck_js()
    assert "compane:'#comments-btn'" in js
    assert "'reviewpane','a11ypane','compane'];" in js
    # wherever a layout puts the Notes door, Comments is beside it
    layouts = assets.load("js/deck/07-ribbon-layouts.js")
    assert layouts.count("'notes-btn','comments-btn'") == 8


def test_python_keeps_comments_and_drops_the_malformed():
    good = {"id": "c1", "text": "Units?", "t": 5, "oid": "o1",
            "re": [{"text": "Done", "t": 6}], "done": 1}
    deck = {"name": "d", "slides": [
        {"layout": "blank", "panes": [],
         "comments": [good, {"id": "c2", "text": ""}, "junk",
                      {"id": "c3"}]},
        {"layout": "blank", "panes": [], "comments": []},
    ]}
    out = as_presentations([deck])[0]["slides"]
    assert out[0]["comments"] == [good]
    # an empty list is not written back at all
    assert "comments" not in out[1]
    assert "comments" in SLIDE_KEYS


def test_normpres_keeps_them_the_same_way():
    js = assets.deck_js()
    assert ("        if(Array.isArray(s.comments)){\n"
            "          var cms=s.comments.filter(function(c){\n"
            "            return c&&typeof c==='object'&&typeof c.text"
            "==='string'\n              &&c.text;}).map(deep);\n"
            "          if(cms.length) o.comments=cms;\n") in js


def test_the_web_page_export_leaves_them_out_and_the_file_keeps_them():
    js = assets.deck_js()
    export = lift_fn(js, "exportDeckHtml")
    assert "deckFileText({noComments:1})" in export
    # the .junoview file (and the saved page) call it plain
    assert js.count("deckFileText()") >= 1
    src = (
        "function embedAssets(x){return x;}\n"
        "function plainIfSingle(x){return x;}\n"
        "var DECK=[{name:'d',slides:[{lay:'blank',notes:'n',"
        "comments:[{id:'c1',text:'Units?',t:1}]},{lay:'blank'}]}];\n"
        "function filePresentations(){return DECK;}\n"
        + lift_fn(js, "deckFileText") + "\n"
        "var a=JSON.parse(deckFileText());\n"
        "var b=JSON.parse(deckFileText({noComments:1}));\n"
        "console.log(JSON.stringify([a.presentations[0].slides,"
        "b.presentations[0].slides,DECK[0].slides[0].comments.length]));\n")
    kept, stripped, still = _run(src)
    assert kept[0]["comments"][0]["text"] == "Units?"
    assert "comments" not in stripped[0]
    # everything else on the slide survives the strip
    assert stripped[0]["notes"] == "n" and stripped[1] == {"lay": "blank"}
    # and stripping a copy never touches the deck you are editing
    assert still == 1


def test_markers_only_on_the_live_editing_page():
    js = assets.deck_js()
    mount = lift_fn(js, "cmtMount")
    assert ("if(mode!=='edit'||!s||!stage||!stage.contains(layer)) return;"
            in mount)
    # resolved comments leave no marker
    assert "return c&&!c.done;" in mount
    # renderAnnots, the one funnel every slide render takes, mounts them
    assert ("    if(typeof cmtMount==='function') cmtMount(layer,s);\n"
            "    layer._paintSlide=s;") in js


def test_leaving_the_editor_closes_the_pane():
    js = assets.deck_js()
    assert ("      var cpn=$('#compane'); if(cpn) cpn.hidden=true;\n"
            "      var cbn=$('#comments-btn');\n"
            "      if(cbn) cbn.setAttribute('aria-pressed','false');\n"
            ) in js


def test_the_keys_and_the_right_click_row():
    js = assets.deck_js()
    boot = lift_fn(js, "commentsBoot")
    assert "if(!(e.ctrlKey||e.metaKey)||!e.altKey) return;" in boot
    assert "e.code!=='KeyM'" in boot
    assert "if(deckEl.hidden||mode!=='edit') return;" in boot
    assert ("    if(typeof cmtMenuRows==='function') cmtMenuRows(m,row,at);"
            in js)
    rows = lift_fn(js, "cmtMenuRows")
    assert "row('New comment','Ctrl+Alt+M'" in rows
    helpp = assets.load("html/help.html")
    assert "<kbd>Ctrl</kbd>+<kbd>Alt</kbd>+<kbd>M</kbd></span>" in helpp
    assert "<li><b>Comments.</b>" in helpp


def test_a_twin_slide_never_resolves_the_other():
    """Duplicating a slide copies its comments, ids and all: an action on
    one card must land on that card's slide, and the pane re-mints the
    copies' ids before it keys anything by them."""
    js = assets.deck_js()
    src = (
        "var cmtSeq=0;\n"
        + lift_fn(js, "cmtId") + "\n"
        + lift_fn(js, "cmtList") + "\n"
        + lift_fn(js, "cmtFind") + "\n"
        + lift_fn(js, "cmtUniq") + "\n"
        "var A={comments:[{id:'c1',text:'x'}]},"
        "B={comments:[{id:'c1',text:'x'}]};\n"
        "var pres={slides:[A,B]};\n"
        "var onA=cmtFind('c1',A).s===A,onB=cmtFind('c1',B).s===B;\n"
        "cmtUniq();\n"
        "console.log(JSON.stringify([onA,onB,A.comments[0].id,"
        "B.comments[0].id!=='c1'&&!!B.comments[0].id]));\n")
    on_a, on_b, a_id, b_new = _run(src)
    assert on_a and on_b
    assert a_id == "c1" and b_new


def test_when_reads_like_a_person_wrote_it():
    js = assets.deck_js()
    src = (lift_fn(js, "cmtWhen") + "\n"
           "var n=Date.now();\n"
           "console.log(JSON.stringify([cmtWhen(n-5000),"
           "cmtWhen(n-5*60000),cmtWhen(n-3*3600000),cmtWhen(n+60000)]));\n")
    now, mins, hours, future = _run(src)
    assert now == "just now"
    assert mins == "5 min ago"
    assert hours == "3 h ago"
    assert future == ""
