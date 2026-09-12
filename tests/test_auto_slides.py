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
    """A short markdown block keeps its natural 21pt-height beside the
    figure; the section's remaining items run on under the same heading."""
    pr = _build(PLAN)
    s1, s2, s3 = pr["slides"][:3]
    cells = lambda s: [(a["ref"], a["x"], a["y"], a["w"], a["h"])  # noqa: E731
                       for a in s["annots"] if a["k"] == "cell"]
    assert cells(s1) == [("nb::intro-md", 5, 18, 42, 14),
                         ("nb::fig-1", 50, 18, 45, 76)]
    assert cells(s2) == [("nb::more-md", 5, 18, 42, 14),
                         ("nb::fig-2", 50, 18, 45, 76)]
    # a figure with no markdown beside it takes the width
    assert cells(s3) == [("nb::fig-3", 10, 18, 80, 76)]
    # markdown alone keeps a natural text height rather than expanding
    # one sentence into a full-slide notebook card
    assert cells(pr["slides"][4]) == [("nb::tail-md", 8, 6, 84, 14)]


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
    assert all("ts" not in a for a in cells)


def test_long_markdown_does_not_squeeze_beside_the_next_figure():
    """Measured prose that would overflow a half-width column gets its
    own slide; the following figure is revisited, not lost or reordered."""
    pr = _build({"name": "x", "sections": [{"title": "S", "items": [
        {"ref": "n::m", "kind": "note", "sourceWidth": 900,
         "sourceHeight": 310, "sourceFontSize": 15,
         "sourceLineHeight": 22},
        {"ref": "n::f", "kind": "figure", "aspect": 1.5},
    ]}]})
    refs = [[a["ref"] for a in s["annots"] if a["k"] == "cell"]
            for s in pr["slides"]]
    assert refs == [["n::m"], ["n::f"]]


def test_measured_markdown_widens_when_its_body_type_gets_larger():
    pr = _build({"name": "x", "sections": [{"title": "S", "items": [
        {"ref": "n::m", "kind": "note", "sourceWidth": 600,
         "sourceHeight": 72, "sourceFontSize": 15,
         "sourceLineHeight": 22},
    ]}]})
    note = [a for a in pr["slides"][0]["annots"] if a["k"] == "cell"][0]
    assert note["w"] == 84
    assert note["h"] > 18


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


def test_the_viewer_owns_one_complete_create_slides_dialog(out):
    """The user sees every scope and the animation choice before one
    explicit Create slides action; neither the rail nor a section row is
    a competing, half-configured route."""
    page = assets.page_template()
    assert 'id="auto-slides-dialog" hidden' in page
    assert 'id="auto-slides-create"' in page
    assert 'id="auto-animations"' in page
    for scope in ("all", "section", "marks"):
        assert f'name="auto-slides-scope" value="{scope}"' in page, scope
    assert 'id="pr-autoslides"' not in page
    assert 'id="auto-menu"' not in page
    items = (SRC / "render" / "items.py").read_text(encoding="utf-8")
    assert 'sec-slides' not in items
    css = assets.core_css()
    assert '.sec-slides' not in css
    app = assets.app_js()
    assert "function autoPlan(stem,scope,sid){" in app
    assert "function autoSlidesFrom(stem,scope,sid,animations){" in app
    assert "function autoSlidesDialogOpen(){" in app
    assert "function autoSlidesDialogClose(){" in app
    assert "$$('.sec-slides',shell)" not in app
    # the plan filters to the three kinds the slides are made of...
    assert ("return it.kind==='note'||it.kind==='figure'"
            "||it.kind==='diagnostic';") in app
    # ...scopes on the section id and on the marks store...
    assert "if(scope==='section') return it.section===sid;" in app
    assert "var st=markOf(stem,it.card);" in app
    assert "var tagged=Array.isArray(st.tags)?st.tags.length:!!st.f;" in app
    assert "return !!(st.p||tagged);" in app
    # ...and hands the deck refs it can resolve
    assert "Object.assign({ref:stem+'::'+it.anchor,kind:it.kind" in app
    assert "APP.deckAuto(plan);" in app
    assert "plan.animations=!!animations;" in app
    # The button route is an actual dialog -> Create handler, not merely
    # a visible label which can drift away from the builder.
    assert "e.preventDefault();autoSlidesDialogOpen();" in app
    assert "var create=$('#auto-slides-create');" in app
    assert "autoSlidesFrom(stem,scope,sid,animations);" in app
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
    help_html = assets.help_html()
    assert "Create slides" in help_html
    assert "Slides from this notebook" not in help_html


def test_the_door_is_on_the_ribbon_of_the_notebook_it_reads():
    """Create slides stays next to Present, but no longer hides its
    choices behind a rail menu or a floating per-section action."""
    page = assets.page_template()
    assert '<button class="toggle" id="doc-autoslides"' in page
    assert "Create slides" in page
    assert 'aria-controls="auto-slides-dialog"' in page
    # beside Present, in the View group -- not a menu of its own
    assert page.index('id="doc-present"') < page.index('id="doc-autoslides"')
    assert (page.index('id="doc-autoslides"')
            < page.index('<span class="abgrp-lab">View</span>'))
    app = assets.app_js()
    assert "    var rb=$('#doc-autoslides');" in app
    assert "      e.preventDefault();autoSlidesDialogOpen();});" in app
    assert "d.addEventListener('click',function(e){" in app
    css = assets.load("css/app.css")
    assert ".auto-slides-dialog{position:fixed;inset:0;z-index:230;" in css
    assert ".pr-newmenu.auto-float" not in css


def test_the_section_row_names_the_section_on_screen():
    """The This section radio names the active section and disables only
    that option when the document has none."""
    app = assets.app_js()
    cur = app.split("function autoCurrentSection(stem){")[1].split("\n  }")[0]
    assert "querySelector('.navsec.active')" in cur
    body = app.split("function autoSlidesDialogOpen(){")[1].split("\n  }")[0]
    assert "var sec=autoCurrentSection(stem);" in body
    assert "sectionInput.disabled=!sec;" in body
    assert "sectionLabel.textContent=sec" in body
