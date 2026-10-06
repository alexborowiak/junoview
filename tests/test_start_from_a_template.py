"""New presentation offers starting decks as well as blank (T559).

A small dialog, never a screen of its own (T607): Blank is the verb and
Enter, and four decks -- a conference talk, a lab meeting, a thesis
defence and an A0 poster -- are drawn from the decks they make. A starting
deck is data: each slide names a layout from the catalogue and what goes
in its text slots, real words for a section's own name and prompts (the
T366 placeholder) for what you will write.
"""

from __future__ import annotations

import json
import subprocess
import tempfile
from pathlib import Path

import pytest

from helpers_js import js_engine
from junoview import assets


def _cut(js: str, head: str) -> str:
    at = js.index(head)
    end = js.index("\n  ];\n", at) + 4
    return js[at:end]


def _data() -> dict | None:
    """The template list and the layout catalogue, as the JS has them."""
    eng = js_engine()
    if eng is None:
        return None
    cmd, env = eng
    js = assets.deck_js()
    src = (_cut(js, "  var LAYOUTS=[") + "\n"
           + _cut(js, "  var DECK_TEMPLATES=[") + "\n"
           + "console.log(JSON.stringify({layouts: LAYOUTS.map(l => ({id: "
           "l.id, texts: l.items.filter(i => i.k === 'text').length})), "
           "templates: DECK_TEMPLATES}));\n")
    with tempfile.TemporaryDirectory() as d:
        p = Path(d) / "t.js"
        p.write_text(src, encoding="utf-8", newline="\n")
        r = subprocess.run(cmd + [str(p)], capture_output=True, text=True,
                           env=env, timeout=60)
    assert r.returncode == 0, r.stderr[:2000]
    return json.loads(r.stdout.strip().splitlines()[-1])


def test_the_four_starting_decks():
    data = _data()
    if data is None:
        pytest.skip("no JS engine")
    ids = [t["id"] for t in data["templates"]]
    assert ids == ["talk", "lab", "defence", "poster"]
    poster = data["templates"][3]
    assert poster["page"] == "a0p"
    assert poster["slides"] == [["poster-3col", []]]


def test_every_slide_names_a_real_layout_and_fits_its_slots():
    data = _data()
    if data is None:
        pytest.skip("no JS engine")
    slots = {lay["id"]: lay["texts"] for lay in data["layouts"]}
    for t in data["templates"]:
        for lay, words in t["slides"]:
            assert lay in slots, (t["id"], lay)
            # never more words than the layout has boxes for them
            assert len(words) <= slots[lay], (t["id"], lay, words)
            for w in words:
                assert isinstance(w, str) or set(w) == {"ph"}, w


def test_sections_start_in_order_and_on_a_slide():
    data = _data()
    if data is None:
        pytest.skip("no JS engine")
    for t in data["templates"]:
        starts = [s[1] for s in t.get("secs", [])]
        assert starts == sorted(starts), t["id"]
        assert all(0 <= i < len(t["slides"]) for i in starts), t["id"]
        if starts:
            assert starts[0] == 0, t["id"]   # no slide left outside


def test_new_presentation_asks_and_blank_is_the_verb(out):
    html = assets.deck_html()
    assert '<div class="aa-dlg" id="nt-dlg" hidden role="dialog"' in html
    assert ('<button class="dbtn primary" id="nt-blank"\n'
            '        title="An empty presentation (Enter)">'
            'Blank presentation</button>') in html
    js = assets.deck_js()
    # the shared Esc / Enter keys know the dialog
    assert "+'#nt-dlg," in js and "#chart-data';" in js
    # every door that made a blank deck now asks first
    assert "  function newPresentation(){\n    var dlg=$('#nt-dlg')" in js
    assert "  function newBlankPresentation(){" in js


def test_a_template_is_made_by_the_layouts_new_slide_uses():
    js = assets.deck_js()
    fn = js[js.index("  function tplSlide(spec){"):]
    fn = fn[:fn.index("\n  }\n") + 4]
    assert "applyLayout(s,layoutById(spec[0]));" in fn
    # words are content; prompts are placeholders, never shown
    assert "if(typeof w==='string'){a.text=w;delete a.ph;}" in fn
    assert "else if(w.ph){a.text=w.ph;a.ph=1;}" in fn
    build = js[js.index("  function tplBuild(t){"):]
    build = build[:build.index("\n  }\n") + 4]
    # built against the new deck, and the deck in hand put back after
    assert "    pres=d;\n    try{" in build
    assert "} finally {pres=keep;}" in build


def test_the_poster_prompt_fits_its_box():
    js = assets.deck_js()
    assert "text:'Your finding, in one line',size:3.1,b:1," in js
    assert "Poster title — the finding in one line" not in js


def test_the_chooser_is_a_dialog_not_a_screen():
    css = assets.deck_css()
    assert ".aa-box.nt-box{width:min(980px,94vw);}" in css
    assert "grid-template-columns:repeat(auto-fill,minmax(176px,1fr));" in css
