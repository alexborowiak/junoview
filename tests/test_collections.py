"""T606: Collections.

2026-10-01, user: "it would be good if I could create something ... that
creates a view similar to the notebooks perhaps, but you can add cells
and images etc. from other notebooks", with notes of your own under a
figure that can be hidden, and code and notes LINKED to it so that
expanding it shows them.

A collection is a fourth saved kind (kind:'collection'): items that are
collected cells (refs, with the deck's kept copies) or notes of your own,
each able to carry `under` -- what is linked beneath it.
"""
from __future__ import annotations

import json

import pytest

from helpers_js import js_engine, lift_fn
from junoview import assets
from junoview.notebook.deck_schema import validate_deck
from junoview.notebook.presentations import as_presentations


def _js():
    return assets.load("js/deck/64-collections.js")


def test_it_is_a_deck_part():
    parts = assets.DECK_PARTS
    assert "64-collections" in parts
    assert parts.index("62-pptx-import") < parts.index("64-collections") \
        < parts.index("99-boot")
    assert "colBoot();" in assets.load("js/deck/99-boot.js")


def test_the_store_knows_the_kind():
    decks = assets.load("js/deck/10-decks.js")
    norm = decks.split("  function normPres(p,stem){")[1]
    assert "if(p&&p.kind==='collection') return colNorm(p,stem);" in norm
    # one rule for absorbing embedded copies, a deck's and a collection's
    assert "  function embAbsorb(p,ns){" in decks
    assert "    embAbsorb(p,ns);\n" in norm
    # (the summary reads the deck's facts -- presFacts, its item count
    # among them -- rather than the whole deck)
    assert "col:isColPres(p),items:isColPres(p)?p.items:0," in decks
    assert "items:Array.isArray(p.items)?p.items.length:0};" in decks
    save = assets.load("js/deck/60-saving-and-export.js")
    assert "var refs=isColPres(p)?colRefsOf(p):[];" in save


@pytest.mark.skipif(js_engine() is None, reason="no JS engine")
def test_items_are_shape_checked_on_the_way_in():
    import subprocess
    import tempfile
    from pathlib import Path
    js = _js()
    src = ("function splitRef(r){var i=String(r).indexOf('::');"
           "return i<0?[null,String(r)]:[String(r).slice(0,i),"
           "String(r).slice(i+2)];}\n"
           "function deep(o){return JSON.parse(JSON.stringify(o));}\n"
           + lift_fn(js, "colId") + "\n" + lift_fn(js, "colNormItem") + "\n"
           + "function ns(a){return a.indexOf('::')>=0?a:'nb::'+a;}\n"
           + "var raw=" + json.dumps([
               {"id": "a", "k": "cell", "ref": "fig1", "title": "F",
                "meta": {"cls": "k-figure"}, "fold": 1,
                "under": [{"k": "note", "md": "why"},
                          {"k": "cell", "ref": "x::c2",
                           "under": [{"k": "note", "md": "too deep"}]},
                          {"k": "nonsense"}]},
               {"k": "note", "md": "# Hello"},
               {"k": "cell"},
               "junk"]) + ";\n"
           + "console.log(JSON.stringify(raw.map(function(x){"
             "return colNormItem(x,ns,true);})));\n")
    cmd, env = js_engine()
    with tempfile.TemporaryDirectory() as d:
        p = Path(d) / "run.js"
        p.write_text(src, encoding="utf-8")
        r = subprocess.run(cmd + [str(p)], capture_output=True, text=True,
                           env=env, timeout=60)
    assert r.returncode == 0, r.stderr[:2000]
    out = json.loads([ln for ln in r.stdout.splitlines()
                      if ln.startswith("[")][-1])
    cell, note, nocell, junk = out
    assert cell["ref"] == "nb::fig1" and cell["src"] == "nb"
    assert cell["fold"] == 1 and cell["meta"] == {"cls": "k-figure"}
    # linked items are one level deep; junk among them is dropped
    assert [u["k"] for u in cell["under"]] == ["note", "cell"]
    assert "under" not in cell["under"][1]
    assert note["k"] == "note" and note["md"] == "# Hello" and note["id"]
    assert nocell is None and junk is None


def test_the_project_file_keeps_a_collection():
    deck = {"name": "Blocking", "kind": "collection", "slides": [],
            "folder": "Work",
            "items": [
                {"id": "a", "k": "cell", "ref": "nb::fig", "src": "nb",
                 "title": "Figure", "cap": "<i>c</i>",
                 "meta": {"cls": "k-figure has-fig", "kind": "figure",
                          "bad": {"x": 1}},
                 "under": [{"id": "b", "k": "note", "md": "why"},
                           {"id": "c", "k": "cell", "ref": "nb::code"}],
                 "fold": 1, "at": 5},
                {"id": "d", "k": "note", "md": "summary"},
                {"k": "cell"}, 7],
            "emb": {"nb::fig": {"html": "<div class=\"cardbody\"></div>",
                                "title": "Figure"},
                    "bad": {"html": ""}}}
    out = as_presentations({"presentations": [deck]})
    assert len(out) == 1
    c = out[0]
    assert c["kind"] == "collection" and c["slides"] == []
    assert c["folder"] == "Work"
    assert [i["id"] for i in c["items"]] == ["a", "d"]
    first = c["items"][0]
    assert first["meta"] == {"cls": "k-figure has-fig", "kind": "figure"}
    assert [u["id"] for u in first["under"]] == ["b", "c"]
    assert first["fold"] == 1 and first["cap"] == "<i>c</i>"
    assert list(c["emb"]) == ["nb::fig"]
    # and the validator does not ask a collection for slides
    assert not [p for p in validate_deck(c) if p.level == "error"]


def test_every_door_is_there():
    page = assets.load("html/page.html")
    deck = assets.load("html/deck.html")
    # File > New, in both views, and the side panel's New
    assert page.count('data-for="pr-newcol"') == 2
    assert deck.count('data-for="pr-newcol"') == 1
    assert 'id="pr-newcol"' in page
    # Collect showing on the Filters tab, beside Save as view
    keep = page.split('id="ab-saveview"')[1].split("</span></span>")[0]
    assert 'id="ab-collect"' in keep and "Collect showing" in keep
    # a Collect button on every notebook card (and trace clones)
    app = assets.app_js()
    wire = app.split("  function wireCardBehaviors(shell,stem){")[1]
    assert "b.className='cell-collect';" in wire
    assert "b.innerHTML=bic('collect')+' Collect';" in wire
    assert "window.SemCollect.card(b,colStem,card);" in wire
    js = _js()
    assert "window.SemCollect={" in js
    assert "var nb=$('#pr-newcol');" in js
    assert "var cs=$('#ab-collect');" in js


def test_it_opens_as_its_own_tab():
    rev = assets.load("js/deck/50-review-and-overview.js")
    assert "if(isColPres(pres)){openCollection(nm);return;}   /* T606 */" \
        in rev
    assert ("ic.innerHTML=bic(isCol?'newcol':isView?'newview'" in rev)
    assert "if(typeof colSync==='function') colSync();" in rev
    strip = assets.load("js/deck/55-sections-and-strip.js")
    assert "if(isColPres(pres)){openCollection(name);return true;}" in strip
    app = assets.app_js()
    assert "function tabList(){return APP.order.concat(APP.traces,APP.cols);}" \
        in app
    assert "var welcoming=canOpen&&!deckOn&&!colOn&&" in app
    assert ("if(a&&a.collection){setHash('#/pres/'"
            "+encodeURIComponent(a.title));return;}") in app
    # it reads like a notebook: code folded, not a trace's open code
    assert "defBy[k]=newF(!!(sh&&sh.trace&&!sh.collection));" in app


def test_the_feed_keeps_copies_and_links():
    js = _js()
    # a collected cell's picture is the deck's kept copy, taken now
    cap = lift_fn(js, "colCapture")
    assert "var b=cloneBody(ref,true);" in cap
    assert "embStore(normRef(ref)||ref,e);" in cap
    # the card's own facts ride along so the filters read it the same
    item = lift_fn(js, "colItemFromCard")
    for k in ("'kind','role','note','noout','labelled','ck'",
              "return /^(k-|has-|ckmain-)/.test(c);"):
        assert k in item
    # "its code" is what Plot trace finds, minus the figure itself
    code = lift_fn(js, "colCodeCards")
    assert "var g=lineageForItem(it.ns);" in code
    assert "if(s.ns===it.ns||!s.hasCode) return;" in code
    # what is linked folds away, and says what it holds
    render = lift_fn(js, "colRender")
    assert "fb.className='col-fold';" in render
    assert "ub.hidden=!open;" in render
    assert "if(A.wireCardBehaviors) A.wireCardBehaviors(sec,colKey(name));" \
        in render
    # Remove can be undone
    assert "[['Undo',function(){" in lift_fn(js, "colRemove")


def test_the_help_says_how():
    help_ = assets.load("html/help.html")
    assert "<h3>Collections &mdash; cells from any notebook, with your " \
        "notes</h3>" in help_
    fmt = open("DECK-FORMAT.md", encoding="utf-8").read()
    assert '"collection" for a collection' in fmt
    assert "| `items` | list | For a collection:" in fmt
