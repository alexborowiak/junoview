"""Slides from the notebook viewer (T362).

The user, 2026-09-06: "we also need the auto generate presentations
from notebooks but this should be just in the notebook viewer now. And
there should be From all / From just this section / From just
favourites. Presentation should be just markdown, headings and images
... using the section headings as titles for slides, and images and md".

The viewer decides what is in scope and hands the deck a PLAN; the deck
turns the plan into slides. The builder is pure, so it is lifted out of
the IIFE and RUN: which items share a slide, where they land and what
the title says are arithmetic a substring cannot check.
"""

from __future__ import annotations

import json
import subprocess
import tempfile
from pathlib import Path

import pytest

from junoview import assets

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "src" / "junoview"


def _build(plan: dict) -> dict:
    from helpers_js import js_engine, lift_fn
    eng = js_engine()
    if eng is None:
        pytest.skip("no node or VS Code Electron on this machine")
    cmd, env = eng
    src = assets.deck_js()
    script = ("var AUTO_KINDS={note:1,figure:1,diagnostic:1};\n"
              + lift_fn(src, "autoDeckBuild") + "\n"
              "console.log(JSON.stringify(autoDeckBuild("
              + json.dumps(plan) + ")));\n")
    with tempfile.TemporaryDirectory() as d:
        p = Path(d) / "run.js"
        p.write_text(script, encoding="utf-8")
        r = subprocess.run(cmd + [str(p)], capture_output=True, text=True,
                           encoding="utf-8", env=env, timeout=60)
        assert r.returncode == 0, r.stderr[:2000]
        return json.loads([ln for ln in r.stdout.splitlines()
                           if ln.startswith("{")][-1])


PLAN = {"name": "Blocking talk", "sections": [
    {"title": "Introduction", "items": [
        {"ref": "nb::intro-md", "kind": "note"},
        {"ref": "nb::fig-1", "kind": "figure"},
        {"ref": "nb::more-md", "kind": "note"},
        {"ref": "nb::fig-2", "kind": "figure"},
        {"ref": "nb::fig-3", "kind": "diagnostic"},
    ]},
    {"title": "Setup", "items": [
        {"ref": "nb::code-1", "kind": "code"},      # not slide material
    ]},
    {"title": "Results", "items": [
        {"ref": "nb::fig-4", "kind": "figure"},
    ]},
    {"title": "", "items": [{"ref": "nb::tail-md", "kind": "note"}]},
]}


def test_a_section_heading_titles_every_slide_of_its_section():
    pr = _build(PLAN)
    assert pr["name"] == "Blocking talk"
    titles = [[a["text"] for a in s["annots"] if a["k"] == "text"]
              for s in pr["slides"]]
    # Introduction runs on to three slides; Setup (code only) is skipped;
    # the untitled section gets no title box
    assert titles == [["Introduction"], ["Introduction"], ["Introduction"],
                      ["Results"], []]
    t = pr["slides"][0]["annots"][0]
    assert t == {"k": "text", "x": 5, "y": 4, "w": 90, "h": 11,
                 "text": "Introduction", "size": 5, "b": 1, "style": "h1"}


def test_one_markdown_and_one_figure_per_slide_side_by_side():
    """Nothing is shrunk to fit: a slide takes at most one of each, the
    markdown on the left and the figure on the right, and the section's
    remaining items run on under the same heading."""
    pr = _build(PLAN)
    s1, s2, s3 = pr["slides"][:3]
    cells = lambda s: [(a["ref"], a["x"], a["y"], a["w"], a["h"])  # noqa: E731
                       for a in s["annots"] if a["k"] == "cell"]
    assert cells(s1) == [("nb::intro-md", 5, 18, 42, 76),
                         ("nb::fig-1", 50, 18, 45, 76)]
    assert cells(s2) == [("nb::more-md", 5, 18, 42, 76),
                         ("nb::fig-2", 50, 18, 45, 76)]
    # a figure with no markdown beside it takes the width
    assert cells(s3) == [("nb::fig-3", 10, 18, 80, 76)]
    # markdown alone keeps a natural text height rather than expanding
    # one sentence into a full-slide notebook card
    assert cells(pr["slides"][4]) == [("nb::tail-md", 8, 6, 84, 18)]


def test_a_figure_first_then_its_markdown_still_share_a_slide():
    pr = _build({"name": "x", "sections": [{"title": "S", "items": [
        {"ref": "n::f", "kind": "figure"}, {"ref": "n::m", "kind": "note"},
        {"ref": "n::f2", "kind": "figure"}, {"ref": "n::f3", "kind": "figure"},
    ]}]})
    refs = [[a["ref"] for a in s["annots"] if a["k"] == "cell"]
            for s in pr["slides"]]
    assert refs == [["n::f", "n::m"], ["n::f2"], ["n::f3"]]


def test_short_markdown_cells_share_a_slide_at_their_natural_height():
    pr = _build({"name": "x", "sections": [{"title": "S", "items": [
        {"ref": "n::m1", "kind": "note", "words": 3},
        {"ref": "n::m2", "kind": "note", "words": 5},
        {"ref": "n::m3", "kind": "note", "words": 4},
    ]}]})
    cells = [a for a in pr["slides"][0]["annots"] if a["k"] == "cell"]
    assert [a["ref"] for a in cells] == ["n::m1", "n::m2", "n::m3"]
    assert all(a["h"] < 25 for a in cells)
    assert [a["part"] for a in cells] == ["output", "output", "output"]
    assert all(a["autoNote"] == 1 for a in cells)


def test_tall_figures_drop_below_markdown_and_animation_is_opt_in():
    plan = {"name": "x", "animations": True, "sections": [{
        "title": "S", "items": [
            {"ref": "n::m", "kind": "note", "words": 10},
            {"ref": "n::f", "kind": "figure", "aspect": 0.5},
        ]}]}
    pr = _build(plan)
    cells = [a for a in pr["slides"][0]["annots"] if a["k"] == "cell"]
    assert cells[0]["y"] < cells[1]["y"]
    assert cells[0]["part"] == "output" and cells[1]["part"] == "figure"
    assert [a["anim"]["order"] for a in cells] == [0, 1]


def test_nothing_in_scope_is_no_slides_at_all():
    pr = _build({"name": "x", "sections": [
        {"title": "Only code", "items": [{"ref": "n::c", "kind": "code"}]},
        {"title": "Empty", "items": []}]})
    assert pr["slides"] == []


# ----------------------------------------------------------- the doors


def test_the_viewer_owns_the_doors(out):
    """Two doors in the notebook viewer and none in the deck: the New
    menu's three-way chooser, and a word on every section heading."""
    page = assets.page_template()
    assert 'data-for="pr-autoslides"' in page
    assert 'id="pr-autoslides"' in page
    assert 'id="auto-menu" hidden' in page
    assert 'id="auto-animations"' in page
    for scope in ("all", "section", "marks"):
        assert f'data-scope="{scope}"' in page, scope
    items = (SRC / "render" / "items.py").read_text(encoding="utf-8")
    assert 'class="sec-slides" data-sec="{sid}"' in items
    css = assets.core_css()
    assert ".sectionhead:hover .sec-slides" in css
    app = assets.app_js()
    assert "function autoPlan(stem,scope,sid){" in app
    assert "function autoSlidesFrom(stem,scope,sid){" in app
    assert "$$('.sec-slides',shell).forEach(function(b){" in app
    # the plan filters to the three kinds the slides are made of...
    assert ("return it.kind==='note'||it.kind==='figure'"
            "||it.kind==='diagnostic';") in app
    # ...scopes on the section id and on the marks store...
    assert "if(scope==='section') return it.section===sid;" in app
    assert "var st=markOf(stem,it.card);return !!(st.p||st.f);" in app
    # ...and hands the deck refs it can resolve
    assert "Object.assign({ref:stem+'::'+it.anchor,kind:it.kind" in app
    assert "APP.deckAuto(plan);" in app
    assert "plan.animations=!!(anim&&anim.checked);" in app
    # the deck's half: a pure builder, a new presentation, one boot call
    assert "11-autodeck" in assets.DECK_PARTS
    assert "  autoDeckBoot();" in (SRC / "assets" / "js" / "deck"
                                   / "99-boot.js").read_text("utf-8")
    boot = out.split("function autoDeckBoot(){")[1].split("\n  }")[0]
    assert "window.SemApp.deckAuto=autoDeckImport;" in boot
    imp = out.split("function autoDeckImport(plan){")[1].split("\n  }")[0]
    assert "embedIfAbsent(a);" in imp
    assert "importDeckText(JSON.stringify({presentations:[pr]}),false);" in imp
    # never the old Auto-build: the deck's own File menu offers no such row
    deck = assets.deck_html()
    assert 'id="mi-auto-figs"' not in deck and 'id="mi-auto-figdocs"' not in deck
    assert "Slides from this notebook" in assets.help_html()


def test_the_door_is_on_the_ribbon_of_the_notebook_it_reads():
    """T365 (2026-09-07, user: "Also where was the autogenerate
    presentation in the notebook view????").

    T362 gave this two doors and both are hard to find from the notebook
    you are reading: presentations rail > New > "Slides from this
    notebook..." is a menu inside a rail that collapses, which is the
    standing complaint about this app, and the per-section one is a
    small "slides" word beside "hide section". So the viewer's own
    ribbon carries it, next to Present -- the other control that turns
    this notebook into a talk -- and one press opens T362's three-scope
    chooser rather than a menu that opens another menu.
    """
    page = assets.page_template()
    assert '<button class="toggle" id="doc-autoslides"' in page
    assert "Make slides" in page
    # beside Present, in the View group -- not a menu of its own
    assert page.index('id="doc-present"') < page.index('id="doc-autoslides"')
    assert (page.index('id="doc-autoslides"')
            < page.index('<span class="abgrp-lab">View</span>'))
    app = assets.app_js()
    assert "    var rb=$('#doc-autoslides');" in app
    assert "      e.stopPropagation();autoMenuOpen(rb);});" in app
    # the same chooser, floated under whichever door opened it
    assert "      m.classList.add('auto-float');" in app
    assert "      m.classList.remove('auto-float');" in app
    css = assets.load("css/app.css")
    assert (".pr-newmenu.auto-float{position:fixed;left:auto;right:auto;"
            "width:280px;\n  z-index:200;}") in css
    # the rail's door still works, and is now optional rather than assumed
    assert "    if(b) b.addEventListener('click',function(e){" in app


def test_the_section_row_names_the_section_on_screen():
    """'From this section' says WHICH section before you click it."""
    app = assets.app_js()
    cur = app.split("function autoCurrentSection(stem){")[1].split("\n  }")[0]
    assert "querySelector('.navsec.active')" in cur
    body = app.split("function autoMenuOpen(anchor){")[1].split("\n  }")[0]
    assert "var sec=autoCurrentSection(stem);" in body
    assert "From this section" in body
