"""Editing a deck from Python, and round-tripping it back to the editor.

``notebook/deck_api.py`` is a VIEW over the deck JSON, never a parallel
model of it: every wrapper holds the dict that was loaded and mutates it
in place. The tests that matter most here are the ones about what
survives a round trip, because the browser is always ahead of Python and
a rebuild-on-save would delete whatever this file has not heard of yet.
"""

from __future__ import annotations

import json

import pytest

from junoview.notebook.deck_api import Deck, Item, open_deck
from junoview.notebook.presentations import _as_presentations


def _deck() -> dict:
    return {
        "name": "The talk",
        "sections": {"s1": {"name": "Methods"}},
        "slides": [
            {"layout": "title", "title": "A claim", "sub": "and a hedge",
             "sid": "sa1", "annots": []},
            {"layout": "blank", "sec": "s1", "sid": "sb2", "goal": 3,
             "notes": "remember the confounder",
             "annots": [
                 {"k": "cell", "ref": "demo::toe_map", "x": 10, "y": 12,
                  "w": 40, "h": 30},
                 {"k": "text", "x": 55, "y": 20, "text": "the residuals"},
                 {"k": "arrow", "x1": 20, "y1": 60, "x2": 70, "y2": 70},
             ]},
        ],
    }


# ---------------------------------------------------------------------------
# the decision everything else follows from
# ---------------------------------------------------------------------------

def test_a_key_python_has_never_heard_of_survives_a_round_trip():
    """THE test. The browser is always ahead of this file: `sid` arrived
    with rehearsal timing, `trans` with transitions, `priv` with private
    annotations. A dataclass-per-key design would have silently deleted
    each of them on the first Python round trip made before somebody
    remembered to add a field, and this repo already has a test whose
    whole job is catching that (test_deck_schema_parity) -- which is how
    often it has happened.

    A view cannot lose a key it does not know about, because it never
    touches one.
    """
    raw = _deck()
    raw["slides"][1]["annots"][0]["somethingNewIn2027"] = {"deep": [1, 2]}
    raw["slides"][1]["trans"] = "move"
    raw["totallyUnknownDeckKey"] = 7
    d = Deck.from_json(raw)
    d.slide(2).figures["toe_map"].place(x=8)
    out = json.loads(d.to_json())
    assert out["totallyUnknownDeckKey"] == 7
    assert out["slides"][1]["trans"] == "move"
    assert (out["slides"][1]["annots"][0]["somethingNewIn2027"]
            == {"deep": [1, 2]})
    assert out["slides"][1]["annots"][0]["x"] == 8


def test_editing_mutates_the_deck_that_was_loaded():
    """No copy, no rebuild: the wrapper is a handle on the live dict, so
    two handles on the same slide see each other's edits."""
    raw = _deck()
    d = Deck.from_json(raw)
    d.slide(2).figures["toe_map"].place(x=1, y=2, w=3, h=4)
    assert raw["slides"][1]["annots"][0]["x"] == 1
    assert Deck.from_json(raw).slide(2).figures["toe_map"].box == (1, 2, 3, 4)


# ---------------------------------------------------------------------------
# reaching things
# ---------------------------------------------------------------------------

def test_a_figure_is_reached_by_the_name_of_the_card_it_shows():
    """`deck.slides[7].figures["toe_map"]` is the shape TASKS asked for.
    Refs are namespaced `notebook::anchor`, so the short name is the last
    segment -- and the full ref works too, for the case where two
    notebooks use the same anchor.
    """
    d = Deck.from_json(_deck())
    sl = d.slide(2)
    assert sl.figures["toe_map"].ref == "demo::toe_map"
    assert sl.figures["demo::toe_map"].kind == "cell"
    assert sl.figures.names() == ["toe_map"]
    assert "toe_map" in sl.figures
    assert "nope" not in sl.figures


def test_two_frames_showing_one_card_are_both_reachable():
    """People really do put the same figure on a slide twice. Named
    lookup gives the first, which is what you meant; all_named gives
    both, which is what you need when it is not.
    """
    raw = _deck()
    raw["slides"][1]["annots"].append(
        {"k": "cell", "ref": "demo::toe_map", "x": 60, "y": 60})
    figs = Deck.from_json(raw).slide(2).figures
    assert len(figs) == 2
    assert len(figs.all_named("toe_map")) == 2
    assert figs["toe_map"].box[0] == 10        # the first one


def test_slides_are_numbered_the_way_the_screen_numbers_them():
    """`deck.slide(2)` is the slide labelled 2. The list is still a list
    for everything else, so `deck.slides[1]` is the same slide -- but the
    number you were just looking at should not need arithmetic.
    """
    d = Deck.from_json(_deck())
    assert d.slide(1).title == "A claim"
    assert d.slide(2).raw is d.slides[1].raw
    assert d.slide(2).goal == 3
    assert d.slide(2).section == "s1"
    assert d.sections["s1"]["name"] == "Methods"


def test_find_asks_the_question_the_editors_search_asks():
    """Text, table cells, captions and notes -- so a script can answer
    "which slide talks about the confounder" the same way the presenter
    view does.
    """
    d = Deck.from_json(_deck())
    assert [n for n, _ in d.find("residuals")] == [2]
    assert [n for n, _ in d.find("confounder")] == [2]   # in the notes
    assert d.find("nothing here") == []


# ---------------------------------------------------------------------------
# geometry
# ---------------------------------------------------------------------------

def test_geometry_is_percent_and_an_absent_size_stays_absent():
    """A text box auto-heights from its words, so it has no `h`.
    Returning 0 or inventing one would be a lie about the format -- the
    box says None and means it.
    """
    d = Deck.from_json(_deck())
    tx = d.slide(2).texts[0]
    assert tx.box == (55, 20, None, None)
    tx.place(w=30)
    assert tx.box == (55, 20, 30, None)


def test_an_arrow_moves_by_both_ends_because_it_is_not_a_box():
    """The same special case the editor makes everywhere it walks the
    geometry: an arrow has two endpoints and no x/y at all.
    """
    d = Deck.from_json(_deck())
    arrow = [i for i in d.slide(2).items if i.kind == "arrow"][0]
    arrow.move(dx=5, dy=-2)
    assert (arrow.raw["x1"], arrow.raw["x2"]) == (25, 75)
    assert (arrow.raw["y1"], arrow.raw["y2"]) == (58, 68)
    assert "x" not in arrow.raw


def test_update_with_none_removes_a_key_rather_than_storing_a_null():
    """The format's own rule is that absent means default, which is why
    the editor deletes rather than nulls everywhere. A null would be a
    third state nothing reads.
    """
    d = Deck.from_json(_deck())
    it = d.slide(2).figures["toe_map"]
    it.update(crop={"t": 1}, op=0.5)
    assert it.raw["op"] == 0.5
    it.update(crop=None)
    assert "crop" not in it.raw


# ---------------------------------------------------------------------------
# building
# ---------------------------------------------------------------------------

def test_adding_invents_no_defaults():
    """`add` writes `k` and what you pass, and nothing else. The editor
    defaults every optional field at draw time; a second set of defaults
    here is how two renderers start disagreeing about what a bare
    rectangle looks like.
    """
    d = Deck.from_json(_deck())
    sl = d.add_slide("blank", at=1)
    assert len(d.slides) == 3
    assert d.slide(1).raw is sl.raw
    it = sl.add("rect", x=5, y=5, w=20, h=10, color=None)
    assert it.raw == {"k": "rect", "x": 5, "y": 5, "w": 20, "h": 10}
    assert sl.remove(it) is True
    assert sl.raw["annots"] == []


def test_removing_is_by_identity_because_two_shapes_are_two_shapes():
    d = Deck.from_json(_deck())
    sl = d.add_slide()
    a = sl.add("rect", x=1, y=1, w=1, h=1)
    sl.add("rect", x=1, y=1, w=1, h=1)          # identical, different thing
    assert sl.remove(a) is True
    assert len(sl.items) == 1
    assert sl.remove(Item({"k": "rect", "x": 1, "y": 1, "w": 1, "h": 1})) \
        is False


def test_moving_a_slide_uses_the_numbers_on_the_screen():
    d = Deck.from_json(_deck())
    d.move_slide(1, 2)
    assert d.slide(1).raw.get("sec") == "s1"
    assert d.slide(2).title == "A claim"


# ---------------------------------------------------------------------------
# files
# ---------------------------------------------------------------------------

def test_it_opens_the_three_shapes_a_file_actually_holds(tmp_path):
    """A list, a {"presentations": [...]}, or a bare deck -- the same
    shapes _as_presentations accepts, because having to know which one
    you have before you can open it defeats the purpose.
    """
    one = _deck()
    for obj in (one, [one], {"presentations": [one]}):
        p = tmp_path / "d.junoview"
        p.write_text(json.dumps(obj), encoding="utf-8")
        assert Deck.open(p).name == "The talk"


def test_a_file_that_held_three_decks_still_holds_three(tmp_path):
    """Saving writes the DOCUMENT, not the one deck you were editing."""
    a, b = _deck(), _deck()
    b["name"] = "Another"
    p = tmp_path / "d.junoview"
    p.write_text(json.dumps({"presentations": [a, b]}), encoding="utf-8")
    d = Deck.open(p, name="Another")
    assert d.name == "Another"
    d.slide(1).title = "Changed"
    d.save()
    back = json.loads(p.read_text(encoding="utf-8"))
    assert [x["name"] for x in back["presentations"]] == ["The talk",
                                                          "Another"]
    assert back["presentations"][1]["slides"][0]["title"] == "Changed"
    assert back["presentations"][0]["slides"][0]["title"] == "A claim"


def test_the_html_wrapper_the_browser_writes_is_kept(tmp_path):
    """`.junoview.html` is a real page with a name, an icon and
    instructions for opening it. Rebuilding it here would mean a second
    copy of that markup drifting away from deck.js's, so only the JSON
    block inside it moves.
    """
    page = ('<!doctype html><html><body><main><h1>Keep me</h1></main>'
            '<script type="application/json" id="junoview-data">\n'
            + json.dumps({"presentations": [_deck()]})
            + '\n</script></body></html>\n')
    p = tmp_path / "d.junoview.html"
    p.write_text(page, encoding="utf-8")
    d = Deck.open(p)
    d.slide(2).notes = "new note"
    d.save()
    text = p.read_text(encoding="utf-8")
    assert "<h1>Keep me</h1>" in text
    assert text.lstrip().startswith("<!doctype html>")
    obj = json.loads(text.split('id="junoview-data">')[1]
                     .split("</script>")[0])
    assert obj["presentations"][0]["slides"][1]["notes"] == "new note"


def test_a_notebook_keeps_everything_except_its_deck(tmp_path):
    """Decks travel in metadata.semantic.presentations. Everything else
    in the notebook -- its cells, its kernel, its other metadata -- is
    none of this module's business and comes back untouched.
    """
    nb = {"cells": [{"cell_type": "code", "source": ["1+1\n"]}],
          "metadata": {"kernelspec": {"name": "python3"},
                       "semantic": {"presentations": [_deck()]}},
          "nbformat": 4, "nbformat_minor": 5}
    p = tmp_path / "n.ipynb"
    p.write_text(json.dumps(nb), encoding="utf-8")
    d = Deck.open(p)
    d.slide(2).figures["toe_map"].place(x=99)
    d.save()
    back = json.loads(p.read_text(encoding="utf-8"))
    assert back["cells"] == nb["cells"]
    assert back["metadata"]["kernelspec"] == {"name": "python3"}
    got = back["metadata"]["semantic"]["presentations"][0]
    assert got["slides"][1]["annots"][0]["x"] == 99


def test_open_deck_is_the_same_door_under_a_function_name(tmp_path):
    p = tmp_path / "d.junoview"
    p.write_text(json.dumps(_deck()), encoding="utf-8")
    assert open_deck(p).name == Deck.open(p).name


def test_asking_for_a_deck_that_is_not_there_says_what_is(tmp_path):
    p = tmp_path / "d.junoview"
    p.write_text(json.dumps({"presentations": [_deck()]}), encoding="utf-8")
    with pytest.raises(KeyError) as e:
        Deck.open(p, name="Nope")
    assert "The talk" in str(e.value)


# ---------------------------------------------------------------------------
# checking, and the other half of the round trip
# ---------------------------------------------------------------------------

def test_saving_reports_and_does_not_coerce(tmp_path):
    """T33's split, kept. _as_presentations coerces and never complains;
    validate_deck complains and never changes anything; this writes and
    tells you. A deck with a warning in it is still a deck.
    """
    raw = _deck()
    raw["slides"][1]["annots"].append({"k": "text"})     # no x/y
    p = tmp_path / "d.junoview"
    d = Deck.from_json(raw)
    found = d.save(p)
    assert any("x" in f.message or "y" in f.message for f in found)
    # ...and it wrote anyway, exactly as given
    back = json.loads(p.read_text(encoding="utf-8"))
    assert back["slides"][1]["annots"][-1] == {"k": "text"}


def test_strict_is_for_the_script_that_would_rather_stop(tmp_path):
    raw = _deck()
    raw["slides"][1]["annots"].append({"k": "text"})
    with pytest.raises(ValueError):
        Deck.from_json(raw).save(tmp_path / "d.junoview", strict=True)
    assert not (tmp_path / "d.junoview").exists()


def test_what_it_writes_is_what_the_loader_reads_back(tmp_path):
    """The round trip that matters: everything this API changes has to
    survive _as_presentations, which is the function the rendered page
    and the editor both go through. A key kept here and dropped there
    would look saved and not be.
    """
    raw = _deck()
    d = Deck.from_json(raw)
    d.slide(2).notes = "markdown **notes**"
    d.slide(2).goal = 4.5
    d.slide(2).optional = True
    d.slide(2).update(trans="move")
    d.slide(2).figures["toe_map"].place(x=8, y=9, w=50, h=40)
    p = tmp_path / "d.junoview"
    d.save(p)
    got = _as_presentations(json.loads(p.read_text(encoding="utf-8")))[0]
    sl = got["slides"][1]
    assert sl["notes"] == "markdown **notes**"
    assert sl["goal"] == 4.5
    assert sl["opt"] == 1
    assert sl["trans"] == "move"
    assert sl["sid"] == "sb2"
    assert sl["annots"][0]["x"] == 8 and sl["annots"][0]["w"] == 50


def test_it_does_not_drag_the_renderer_in_behind_it():
    """A script that wants to move a figure should not have to load an
    HTML renderer to do it, which is why the two file forms are read
    here rather than imported from loader -- loader pulls in the whole
    render path.
    """
    import junoview.notebook.deck_api as api
    src = open(api.__file__, encoding="utf-8").read()
    assert "from .loader import" not in src
    assert "import loader" not in src
