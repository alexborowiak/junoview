"""PowerPoint IN (T320).

The user's list, item 1: "PowerPoint import preserving editable text,
shapes, notes, charts, images and as much animation as possible".

The reader is stdlib Python (notebook/pptx_read.py) and answers in the
spec pptx.js already WRITES, so the exporter's documented seam is the
importer's too -- and the strongest test here is the round trip: a spec
goes out through JunoPptx.build and comes back through read_pptx with
its text, shapes, lines, pictures, tables, charts, notes, links and
builds intact. The deck side (specToPres) is lifted out of the IIFE and
RUN, because whether "then bold and red" arrives bold and red is not a
question a substring can settle.

The fixture (tests/pptx_fixture.py) is a real, minimal .pptx written by
hand, so a test can assert exact values back; the round-trip deck is
whatever the writer produces, which is what a user's export looks like.
"""

from __future__ import annotations

import base64
import io
import json
import subprocess
import tempfile
import zipfile
from pathlib import Path

import pytest

import pptx_fixture
from junoview import assets
from junoview.notebook.pptx_read import (
    PPTX_CAP,
    is_pptx_name,
    read_pptx,
    read_pptx_b64,
)

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "src" / "junoview"


@pytest.fixture(scope="module")
def fixture_bytes(tmp_path_factory) -> bytes:
    p = tmp_path_factory.mktemp("pptx") / "fixture.pptx"
    pptx_fixture.build(p)
    return p.read_bytes()


@pytest.fixture(scope="module")
def got(fixture_bytes) -> dict:
    return read_pptx(fixture_bytes, "fixture.pptx")


def _items(got: dict, i: int) -> list[dict]:
    return got["spec"]["slides"][i]["items"]


def _rezip(data: bytes, edit) -> bytes:
    """A copy of a .pptx with `edit(name, bytes) -> bytes | None` applied
    to every part (None drops it); `edit` may also return extra parts
    through the `extra` dict it closes over."""
    src = zipfile.ZipFile(io.BytesIO(data))
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as z:
        for info in src.infolist():
            out = edit(info.filename, src.read(info.filename))
            if out is not None:
                z.writestr(info.filename, out)
        for name, body in getattr(edit, "extra", {}).items():
            z.writestr(name, body)
    return buf.getvalue()


# ------------------------------------------------------------ the fixture


def test_the_page_and_the_deck(got):
    spec = got["spec"]
    assert (spec["widthMm"], spec["heightMm"]) == (338.7, 190.5)
    assert spec["bg"] == "#ffffff"           # PowerPoint's white master
    assert spec["title"] == "fixture"
    assert len(spec["slides"]) == 2
    assert got["lost"] == []


def test_a_title_arrives_as_editable_text_at_its_size(got):
    """44pt on a 540pt page is 8.15% of the height -- the currency every
    text box in the deck is sized in, so the title lands at the size it
    had rather than a default."""
    t = _items(got, 0)[0]
    assert t["t"] == "text" and t["text"] == "Blocking and ENSO"
    assert t["sizePct"] == pytest.approx(8.148, abs=0.01)
    assert t["b"] is True and t["i"] is False
    assert (t["x"], t["y"]) == pytest.approx((6.875, 5.324), abs=0.01)
    assert (t["w"], t["h"]) == pytest.approx((86.25, 19.329), abs=0.01)
    assert t["name"] == "Title 1"


def test_runs_keep_their_own_bold_and_colour(got):
    """A paragraph is a list of RUNS, each with what it wears, so the
    deck side can decide between a plain box and a rich one."""
    body = _items(got, 0)[1]
    assert body["text"] == ("Plain body text then bold and red\n"
                            "A second paragraph")
    p0, p1 = body["paras"]
    assert p0["bullet"] is True and p1["bullet"] is False
    assert [r["t"] for r in p0["runs"]] == ["Plain body text ",
                                            "then bold and red"]
    assert p0["runs"][0]["b"] is False and p0["runs"][0]["color"] == ""
    assert p0["runs"][1]["b"] is True and p0["runs"][1]["color"] == "#c0392b"
    # the box itself is neither bold nor coloured: the runs disagree
    assert body["b"] is False and body["color"] == ""
    assert body["bullets"] is False        # only one of the two paragraphs


def test_speaker_notes_come_across(got):
    assert got["spec"]["slides"][0]["notes"] == (
        "Remember to mention the 1997 event.")
    assert got["spec"]["slides"][1]["notes"] == ""


def test_a_filled_shape_with_words_is_a_text_box_on_that_ground(got):
    """One editable object, not a rectangle with a text box floating over
    it: the fill becomes the box's own background (bgc), which is the
    same thing pptx.js writes it back out as. The words sit in its
    middle, as PowerPoint draws them."""
    box = _items(got, 1)[0]
    assert box["t"] == "text" and box["text"] == "In a box"
    assert box["bgc"] == "#2f6db5"
    assert box["anchor"] == "ctr" and box["align"] == "center"
    assert box["inShape"] == 1


def test_a_picture_keeps_its_bytes(got):
    pic = _items(got, 1)[1]
    assert pic["t"] == "image"
    assert pic["src"].startswith("data:image/png;base64,")
    assert base64.b64decode(pic["src"].split(",", 1)[1]) == pptx_fixture.png()
    assert (pic["x"], pic["y"]) == pytest.approx((50.0, 13.333), abs=0.01)
    assert (pic["w"], pic["h"]) == pytest.approx((37.5, 50.0), abs=0.01)


def test_the_browser_transport_is_the_same_reader(fixture_bytes, got):
    """A picked or dropped file arrives as name + base64; the answer is
    the one a path gives, plus the name."""
    b64 = base64.b64encode(fixture_bytes).decode("ascii")
    back = read_pptx_b64("fixture.pptx", b64)
    assert back["name"] == "fixture.pptx"
    assert back["spec"] == got["spec"] and back["lost"] == got["lost"]
    with pytest.raises(ValueError, match="not a PowerPoint"):
        read_pptx_b64("notes.docx", b64)
    with pytest.raises(ValueError, match="base64"):
        read_pptx_b64("x.pptx", "@@not base64@@")


def test_the_suffixes_the_doors_accept():
    for n in ("a.pptx", "A.PPTX", "t.potx", "s.ppsx", "m.pptm"):
        assert is_pptx_name(n)
    for n in ("a.ppt", "a.docx", "a.junoview.html", "", "pptx"):
        assert not is_pptx_name(n)


# ------------------------------------------------------------- the gates


def test_what_is_not_a_deck_is_refused_by_name():
    with pytest.raises(ValueError, match="not a PowerPoint"):
        read_pptx(b"hello, not a zip")
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as z:
        z.writestr("word/document.xml", "<w/>")
    with pytest.raises(ValueError, match="no ppt/presentation.xml"):
        read_pptx(buf.getvalue())
    with pytest.raises(ValueError, match="over the"):
        read_pptx(b"x" * (PPTX_CAP + 1))


def test_a_doctype_is_refused_not_parsed(fixture_bytes):
    """A .pptx is a zip of XML, which is the classic carrier for an
    entity bomb; the reader never hands a DOCTYPE to the parser."""
    def edit(name, body):
        if name == "ppt/slides/slide1.xml":
            return body.replace(b"?>", b"?><!DOCTYPE p [<!ENTITY a 'b'>]>",
                                1)
        return body
    with pytest.raises(ValueError, match="refused"):
        read_pptx(_rezip(fixture_bytes, edit))


def test_a_metafile_picture_is_named_not_faked(fixture_bytes):
    """No browser draws EMF; the honest answer is a line in the report
    and no picture, never a broken one."""
    def edit(name, body):
        if name == "ppt/slides/_rels/slide2.xml.rels":
            return body.replace(b"image1.png", b"image1.emf")
        if name == "ppt/media/image1.png":
            return None
        return body
    edit.extra = {"ppt/media/image1.emf": b"\x01\x00\x00\x00EMF"}
    got = read_pptx(_rezip(fixture_bytes, edit))
    assert not [it for it in _items(got, 1) if it["t"] == "image"]
    assert any("Windows metafile" in ln for ln in got["lost"])


def test_bytes_that_are_not_their_suffix_are_refused(fixture_bytes):
    def edit(name, body):
        if name == "ppt/media/image1.png":
            return b"GIF89a not a png"
        return body
    got = read_pptx(_rezip(fixture_bytes, edit))
    assert not [it for it in _items(got, 1) if it["t"] == "image"]
    assert any("not the format they claim" in ln for ln in got["lost"])


def test_a_shape_this_has_no_outline_for_is_named(fixture_bytes):
    def edit(name, body):
        if name == "ppt/slides/slide2.xml":
            return body.replace(b'prst="rect"', b'prst="chevron"', 1)
        return body
    got = read_pptx(_rezip(fixture_bytes, edit))
    assert any("chevron" in ln and "a rectangle" in ln for ln in got["lost"])


def test_the_picture_magic_agrees_with_the_path_route():
    """Two tables of magic bytes is how they drift apart; a test keeps
    them the same until one of them moves."""
    from junoview.notebook.pptx_read import _MAGIC
    from junoview.server.routes import _IMG_MAGIC
    assert _MAGIC == _IMG_MAGIC


# ---------------------------------------------------------- the round trip


def _engine():
    from helpers_js import js_engine
    eng = js_engine()
    if eng is None:
        pytest.skip("no node or VS Code Electron on this machine")
    return eng


def _png_uri() -> str:
    return "data:image/png;base64," + base64.b64encode(
        pptx_fixture.png()).decode("ascii")


ROUND_TRIP = {
    "title": "rt", "widthMm": 339, "heightMm": 191, "bg": "#0b141d",
    "slides": [
        {"bg": "#0b141d", "trans": "fade", "notes": "Say hello.",
         "items": [
             {"t": "text", "x": 10, "y": 10, "w": 60, "h": 10,
              "text": "Hello\nWorld", "sizePct": 5, "color": "#ffcc00",
              "b": 1, "align": "center", "bullets": 1,
              "animStep": 0, "animType": "fade",
              "link": {"to": "url", "href": "https://example.org/x"}},
             {"t": "rect", "x": 10, "y": 30, "w": 20, "h": 10,
              "color": "#ff6b57", "fill": "#123456", "swPct": 0.5,
              "dash": "dash", "shape": "ellipse",
              "animStep": 1, "animType": "appear"},
             {"t": "line", "x1": 10, "y1": 50, "x2": 40, "y2": 60,
              "color": "#00ff00", "swPct": 0.4, "dash": "solid",
              "head": "triangle", "tail": "none", "hsz": "lg"},
             {"t": "image", "x": 50, "y": 50, "w": 20, "h": 20,
              "src": _png_uri(), "alt": "a blue square",
              "crop": {"l": 10, "t": 0, "r": 0, "b": 10}},
             {"t": "table", "x": 50, "y": 10, "w": 40, "h": 20,
              "rows": [["a", "b"], ["1", "2"]], "cols": [50, 50],
              "thead": 1, "grid": 1, "sizePct": 2, "color": "#ffffff"},
             {"t": "chart", "x": 10, "y": 70, "w": 40, "h": 25,
              "ct": "bar", "cats": ["x", "y", "z"],
              "series": [{"name": "S1", "ys": [1, 2, 3],
                          "color": "#4fb3d9"}],
              "numeric": False, "title": "T", "leg": 1, "ink": "#ffffff"},
             {"t": "draw", "x": 60, "y": 75, "w": 20, "h": 20,
              "color": "#ff00ff", "swPct": 0.3,
              "pts": [[0, 0], [1, 0], [1, 1]]},
         ]},
        {"bg": "#0b141d", "trans": "", "notes": "",
         "items": [{"t": "text", "x": 5, "y": 5, "w": 50, "h": 10,
                    "text": "Two", "sizePct": 4,
                    "link": {"to": "slide", "slide": 1}}]},
    ]}


@pytest.fixture(scope="module")
def round_trip() -> dict:
    """The writer's own output, read back."""
    _engine()
    from helpers_js import build_pptx
    data, report = build_pptx(json.loads(json.dumps(ROUND_TRIP)))
    assert report["skipped"] == 0
    return read_pptx(data, "rt.pptx")


def _one(got: dict, i: int, t: str) -> dict:
    hits = [it for it in _items(got, i) if it["t"] == t]
    assert len(hits) == 1, f"{t}: {hits}"
    return hits[0]


def test_round_trip_nothing_is_lost(round_trip):
    assert round_trip["lost"] == []
    assert len(round_trip["spec"]["slides"]) == 2


def test_round_trip_text(round_trip):
    t = _one(round_trip, 0, "text")
    assert t["text"] == "Hello\nWorld"
    assert t["sizePct"] == pytest.approx(5, abs=0.05)
    assert t["color"] == "#ffcc00" and t["b"] is True
    assert t["align"] == "center" and t["bullets"] is True
    assert t["link"] == {"to": "url", "href": "https://example.org/x"}
    assert (t["x"], t["y"], t["w"], t["h"]) == pytest.approx(
        (10, 10, 60, 10), abs=0.05)


def test_round_trip_builds(round_trip):
    """The click each shape arrives on, exactly as it went out."""
    t = _one(round_trip, 0, "text")
    r = _one(round_trip, 0, "rect")
    assert (t["animStep"], t["animType"]) == (0, "fade")
    assert (r["animStep"], r["animType"]) == (1, "appear")
    assert "animStep" not in _one(round_trip, 0, "line")


def test_round_trip_shape(round_trip):
    r = _one(round_trip, 0, "rect")
    assert r["shape"] == "ellipse"
    assert r["fill"] == "#123456" and r["color"] == "#ff6b57"
    assert r["dash"] == "dash"
    assert r["swPct"] == pytest.approx(0.5, abs=0.02)


def test_round_trip_line(round_trip):
    ln = _one(round_trip, 0, "line")
    assert (ln["x1"], ln["y1"], ln["x2"], ln["y2"]) == pytest.approx(
        (10, 50, 40, 60), abs=0.05)
    assert ln["color"] == "#00ff00"
    assert (ln["head"], ln["tail"], ln["hsz"]) == ("triangle", "none", "lg")


def test_round_trip_picture(round_trip):
    """The bytes, the alt text and the crop. The writer shrinks the box
    to the visible part and writes the trim as srcRect, so the box that
    comes back is the visible one and the crop rides beside it."""
    p = _one(round_trip, 0, "image")
    assert base64.b64decode(p["src"].split(",", 1)[1]) == pptx_fixture.png()
    assert p["alt"] == "a blue square"
    assert p["crop"] == {"l": 10.0, "t": 0.0, "r": 0.0, "b": 10.0}
    assert (p["x"], p["w"]) == pytest.approx((52, 18), abs=0.05)


def test_round_trip_table(round_trip):
    tb = _one(round_trip, 0, "table")
    assert tb["rows"] == [["a", "b"], ["1", "2"]]
    assert tb["thead"] is True
    assert tb["cols"] == pytest.approx([50, 50], abs=0.1)


def test_round_trip_chart(round_trip):
    """A real PowerPoint chart comes back as NUMBERS, not a picture."""
    c = _one(round_trip, 0, "chart")
    assert c["ct"] == "bar" and c["cats"] == ["x", "y", "z"]
    assert c["series"] == [{"name": "S1", "ys": [1.0, 2.0, 3.0],
                            "color": "#4fb3d9"}]
    assert c["title"] == "T" and c["leg"] is True


def test_round_trip_freeform(round_trip):
    d = _one(round_trip, 0, "draw")
    assert d["pts"] == [[0, 0], [1, 0], [1, 1]]
    assert d["color"] == "#ff00ff"


def test_round_trip_notes_transition_and_slide_link(round_trip):
    s0, s1 = round_trip["spec"]["slides"]
    assert s0["notes"] == "Say hello." and s0["trans"] == "fade"
    assert s0["bg"] == "#0b141d"
    assert _one(round_trip, 1, "text")["link"] == {"to": "slide", "si": 0}


def test_an_unreadable_chart_kind_is_named(round_trip, tmp_path):
    """Radar, stock, surface: PowerPoint has them, the deck does not."""
    from helpers_js import build_pptx
    data, _ = build_pptx(json.loads(json.dumps(ROUND_TRIP)))

    def edit(name, body):
        if name == "ppt/charts/chart1.xml":
            return body.replace(b"barChart", b"radarChart")
        return body
    got = read_pptx(_rezip(data, edit))
    assert not [it for it in _items(got, 0) if it["t"] == "chart"]
    assert any("radar" in ln for ln in got["lost"])


# ------------------------------------------------------ the deck's half

_STUBS = """
var FONTS=[{id:'sans',ppt:'Calibri'},{id:'calibri',ppt:'Calibri'},
  {id:'arial',ppt:'Arial'},{id:'times',ppt:'Times New Roman'}];
var PAGE_PRESETS=[{id:'16x9',label:'Slides 16:9',mm:[339,191]},
  {id:'4x3',label:'Slides 4:3',mm:[254,190]},
  {id:'a4p',label:'A4 portrait',mm:[210,297]}];
var PPT_HEADS={triangle:'triangle',stealth:'stealth',arrow:'open',
  diamond:'diamond',oval:'oval',none:'none'};
var PPT_DASH={solid:'solid',dash:'dash',sysDot:'dot',dashDot:'dashdot',
  lgDash:'lgdash'};
var SW_REF_H=720;
"""
_FNS = ("pptFontId", "pptPagePreset", "pptEsc", "pptRunHtml",
        "pptTextAnnot", "pptSw", "pptAnnot", "specToPres")


def _to_pres(spec: dict, name: str = "deck.pptx") -> dict:
    from helpers_js import lift_fn
    cmd, env = _engine()
    src = assets.deck_js()
    pre = _STUBS + "\n".join(lift_fn(src, f) for f in _FNS) + "\n"
    script = pre + ("const spec=" + json.dumps(spec) + ";\nvar lost=[];\n"
                    "var pr=specToPres(spec," + json.dumps(name)
                    + ",lost);\n"
                    "console.log(JSON.stringify({pr:pr,lost:lost}));\n")
    with tempfile.TemporaryDirectory() as d:
        p = Path(d) / "run.js"
        p.write_text(script, encoding="utf-8")
        r = subprocess.run(cmd + [str(p)], capture_output=True, text=True,
                           encoding="utf-8", env=env, timeout=60)
        assert r.returncode == 0, r.stderr[:2000]
        return json.loads([ln for ln in r.stdout.splitlines()
                           if ln.startswith("{")][-1])


def test_the_fixture_becomes_slides(got):
    res = _to_pres(got["spec"], "fixture.pptx")
    pr = res["pr"]
    assert res["lost"] == []
    assert pr["name"] == "fixture" and pr["page"] == "16x9"
    assert pr["pageBg"] == "#ffffff"
    assert [s["layout"] for s in pr["slides"]] == ["blank", "blank"]
    assert pr["slides"][0]["notes"] == "Remember to mention the 1997 event."
    assert pr["slides"][0]["sid"] == "ppt1"


def test_then_bold_and_red_arrives_bold_and_red(got):
    """The deck's own rich model (a.html, sanitised on every edit) carries
    per-run bold and colour; a run that agrees with the box wears
    nothing extra. The title, uniform, stays a PLAIN box."""
    pr = _to_pres(got["spec"])["pr"]
    title, body = pr["slides"][0]["annots"]
    assert title["text"] == "Blocking and ENSO" and title["b"] == 1
    assert "html" not in title
    assert body["html"] == (
        "• Plain body text <span style=\"color:#c0392b\"><b>then bold and "
        "red</b></span><br>A second paragraph")
    assert body["text"] == ("• Plain body text then bold and red\n"
                            "A second paragraph")
    assert "b" not in body and "color" not in body
    assert body["size"] == pytest.approx(3.333, abs=0.01)


def test_a_wholly_bulleted_box_is_a_real_list():
    spec = {"widthMm": 339, "heightMm": 191, "slides": [{"items": [
        {"t": "text", "x": 1, "y": 1, "w": 50, "h": 20, "text": "a\nb",
         "sizePct": 3, "paras": [
             {"bullet": True, "num": False, "runs": [{"t": "a"}]},
             {"bullet": True, "num": False, "runs": [{"t": "b", "i": True}]},
         ]}]}]}
    a = _to_pres(spec)["pr"]["slides"][0]["annots"][0]
    assert a["list"] == "bullet"
    assert a["html"] == "<li>a</li><li><i>b</i></li>"
    assert a["text"] == "a\nb"


def test_every_other_kind_maps_onto_the_deck_model():
    spec = {"widthMm": 254, "heightMm": 190, "bg": "#101010", "slides": [
        {"section": "Intro", "bg": "#202020", "trans": "fade",
         "hidden": True, "items": [
             {"t": "rect", "x": 1, "y": 2, "w": 3, "h": 4, "shape": "star",
              "color": "#ff0000", "fill": "#00ff00", "swPct": 0.2778,
              "dash": "sysDot", "rot": 15, "name": "Star 1",
              "animStep": 2, "animType": "zoom", "after": 2, "outStep": 3,
              "link": {"to": "slide", "si": 1}},
             {"t": "line", "x1": 1, "y1": 2, "x2": 3, "y2": 4,
              "color": "#0000ff", "swPct": 0.1389, "dash": "lgDash",
              "head": "arrow", "tail": "oval", "hsz": "sm", "curve": 1},
             {"t": "image", "x": 1, "y": 1, "w": 2, "h": 2,
              "src": "data:image/png;base64,AAAA", "alt": "pic",
              "crop": {"l": 1, "t": 2, "r": 3, "b": 4}, "op": 0.5},
             {"t": "table", "x": 0, "y": 0, "w": 9, "h": 9,
              "rows": [["h1", "h2"], ["1", "2"]], "cols": [30, 70],
              "thead": True, "sizePct": 1.5, "color": "#eeeeee"},
             {"t": "chart", "x": 0, "y": 0, "w": 9, "h": 9, "ct": "pie",
              "cats": ["a", "b"], "series": [{"name": "s", "ys": [1, 2]}],
              "title": "T", "leg": False},
             {"t": "draw", "x": 0, "y": 0, "w": 5, "h": 5,
              "pts": [[0, 0], [1, 1]], "color": "#123456", "swPct": 0.5},
             {"t": "text", "x": 0, "y": 0, "w": 5, "h": 5, "text": "t",
              "sizePct": 2, "font": "Times New Roman", "animStep": 0,
              "animBy": "para", "link": {"to": "url",
                                         "href": "https://a.b/c"}},
         ]},
        {"section": "Intro", "items": []},
        {"section": "Results", "items": []},
    ]}
    res = _to_pres(spec, "talk.PPTX")
    pr = res["pr"]
    assert res["lost"] == []                 # 4:3 is a preset of ours
    assert pr["page"] == "4x3" and pr["name"] == "talk"
    s0, s1, s2 = pr["slides"]
    assert s0["bg"] == "#202020" and s0["trans"] == "fade" and s0["opt"] == 1
    assert (s0["sec"], s1["sec"], s2["sec"]) == ("ps1", "ps1", "ps2")
    assert pr["sections"] == {"ps1": {"name": "Intro"},
                              "ps2": {"name": "Results"}}
    rect, line, img, tbl, chart, draw, txt = s0["annots"]
    assert rect["k"] == "rect" and rect["shape"] == "star"
    assert rect["fill"] == 1 and rect["fillc"] == "#00ff00"
    assert rect["color"] == "#ff0000" and rect["style"] == "dot"
    assert rect["sw"] == pytest.approx(2, abs=0.05)   # 1.5pt on 540pt
    assert rect["rot"] == 15 and rect["name"] == "Star 1"
    assert rect["anim"] == {"type": "zoom", "order": 2, "after": 2}
    assert rect["out"] == 3
    assert rect["link"] == {"to": "slide", "sid": "ppt2"}
    assert line["k"] == "arrow" and line["head"] == "open"
    assert line["tail"] == "oval" and line["hsz"] == "sm"
    assert line["curve"] == 1 and line["style"] == "lgdash"
    assert img["k"] == "image" and img["alt"] == "pic" and img["op"] == 0.5
    assert img["crop"] == {"l": 1, "t": 2, "r": 3, "b": 4}
    assert tbl["k"] == "table" and tbl["thead"] == 1 and tbl["cols"] == [30, 70]
    assert tbl["color"] == "#eeeeee" and tbl["size"] == 1.5
    assert chart["k"] == "chart" and chart["ct"] == "pie"
    assert chart["leg"] == 0 and chart["title"] == "T"
    assert draw["k"] == "draw" and draw["pts"] == [[0, 0], [1, 1]]
    assert txt["font"] == "times"
    assert txt["anim"] == {"type": "fade", "order": 0, "by": "para"}
    assert txt["link"] == {"to": "url", "href": "https://a.b/c"}


def test_a_page_size_that_is_not_ours_is_said():
    spec = {"widthMm": 200, "heightMm": 200, "slides": []}
    res = _to_pres(spec)
    assert res["pr"]["page"] in ("4x3", "16x9", "a4p")
    assert any("200×200 mm page" in ln for ln in res["lost"])


def test_calibri_is_the_deck_s_own_sans():
    spec = {"widthMm": 339, "heightMm": 191, "slides": [{"items": [
        {"t": "text", "x": 0, "y": 0, "w": 5, "h": 5, "text": "t",
         "sizePct": 2, "font": "Calibri"},
        {"t": "text", "x": 0, "y": 0, "w": 5, "h": 5, "text": "t",
         "sizePct": 2, "font": "Bookman Old Style"}]}]}
    a, b = _to_pres(spec)["pr"]["slides"][0]["annots"]
    assert "font" not in a
    assert b["font"] == "Bookman Old Style"     # as typed, like the picker


# ----------------------------------------------------------- the doors


def test_the_doors(out):
    """File ▸ Import PowerPoint, the launcher's New ▸ Import a PowerPoint
    file, a .pptx dropped on the window, the Open dialog's rows and
    input, the web build's Choose files -- every road a file comes in by
    -- and the one boot call that wires them."""
    html = assets.deck_html()
    assert 'id="mi-import-pptx"' in html
    boot = out.split("function pptxImportBoot(){")[1].split("\n  }")[0]
    assert "    menuAction('#mi-import-pptx',openPptxFile);" in boot
    assert "document.getElementById('pptxfile')" in boot
    assert "    window.SemApp.deckImportPptx=importPptxFile;" in boot
    assert "    window.SemApp.deckImportPptxPath=importPptxPath;" in boot
    assert "  pptxImportBoot();" in (SRC / "assets" / "js" / "deck"
                                     / "99-boot.js").read_text("utf-8")
    assert "62-pptx-import" in assets.DECK_PARTS
    page = assets.page_template()
    assert 'data-for="pptxfile"' in page
    assert '<input type="file" id="pptxfile" accept=".pptx,.potx,' in page
    assert ".junoview,.html,.pptx\"" in page
    app = assets.app_js()
    assert "function isPptxPath(p){" in app
    drop = app.split("window.addEventListener('drop',function(e){")[1]
    assert "if(APP.deckImportPptx) APP.deckImportPptx(f);" in drop
    opener = app.split("function openPath(path){")[1].split("\n  }")[0]
    assert "APP.deckImportPptxPath(path);" in opener
    assert "fetchPptxUrl(path)" in opener
    files = app.split("function webOpenFiles(files){")[1].split("\n  }")[0]
    assert "isPptxPath(f.name)" in files
    assert "isDeckPath(v)||isPptxPath(v)" in app
    assert "sr.web_import_pptx_b64(_wname,_wtext)" in assets.web_loader()


def test_the_import_says_what_it_will_cost_first(out):
    """The export dialog's twin: the list, then the choice, then the
    deck -- never a deck with silent holes."""
    body = out.split("function importPptxSpec(got,name){")[1].split(
        "\n  }")[0]
    assert "if(!pptxConfirmImport(pr.name,lost)) return;" in body
    assert body.index("pptxConfirmImport") < body.index("pptxSettleImages")
    assert body.index("pptxSettleImages") < body.index("importDeckText(")
    conf = out.split("function pptxConfirmImport(name,lost){")[1].split(
        "\n  }")[0]
    assert "if(!lost.length) return true;" in conf


def test_a_rendered_export_says_it_cannot(out):
    body = out.split("function importPptxFile(file){")[1].split("\n  }")[0]
    assert "if(APP.mode!=='app'&&!web){" in body
    assert "needs the Junoview app or the web build" in body


def test_pictures_settle_like_a_paste(out):
    """Display copy on the slide, full bytes in the original store."""
    body = out.split("function pptxSettleImages(pr){")[1].split("\n  }")[0]
    assert "shrinkDataUrl(full)" in body
    assert "var k=okeyNew();" in body
    assert "idbPut(k,full).then(function(){a.okey=k;})" in body


def test_the_routes_are_wired_and_behind_the_token():
    src = (SRC / "server" / "routes.py").read_text(encoding="utf-8")
    i = src.index("if not self._authed(")
    j = src.index('elif url.path == "/api/parse":')
    assert i < src.index('elif url.path == "/api/readpptx":') < j
    assert i < src.index('elif url.path == "/api/importpptx":') < j
    assert "self._json(self._read_pptx(body))" in src
    assert "self._json(self._import_pptx(body))" in src


def test_a_path_route_reads_powerpoint_and_nothing_else(tmp_path):
    from junoview.server.routes import read_pptx_at
    pptx_fixture.build(tmp_path / "talk.pptx")
    got = read_pptx_at(tmp_path, "talk.pptx")
    assert got["name"] == "talk.pptx" and got["path"].endswith("talk.pptx")
    assert len(got["spec"]["slides"]) == 2 and got["lost"] == []
    (tmp_path / "notes.txt").write_text("hi")
    with pytest.raises(ValueError, match="not a PowerPoint"):
        read_pptx_at(tmp_path, "notes.txt")
    with pytest.raises(FileNotFoundError):
        read_pptx_at(tmp_path, "gone.pptx")
    with pytest.raises(ValueError, match="web address"):
        read_pptx_at(tmp_path, "https://example.org/x.pptx")
    with pytest.raises(ValueError, match="no path"):
        read_pptx_at(tmp_path, "")


def test_the_open_dialog_lists_a_deck_with_its_kind(tmp_path):
    from junoview.server.state import _list_dir
    (tmp_path / "talk.pptx").write_bytes(b"PK")
    (tmp_path / "old.junoview").write_text("{}")
    got = _list_dir(str(tmp_path))
    rows = {d["name"]: d for d in got["decks"]}
    assert rows["talk.pptx"]["kind"] == "PowerPoint"
    assert "kind" not in rows["old.junoview"]


def test_the_web_build_reaches_the_reader(tmp_path):
    """The bridge, the package attribute it resolves through, and the
    bundle Pyodide unpacks. `web_parse_b64` joins the lazy loader here
    too: the web-loader has called it since T113 and the loader never
    knew the name, so a workbook dropped on the web build raised
    AttributeError."""
    import junoview
    from junoview.web import bundle_package, web_import_pptx_b64
    assert junoview.web_import_pptx_b64 is web_import_pptx_b64
    assert callable(junoview.web_parse_b64)
    b64 = base64.b64encode(
        pptx_fixture.build(tmp_path / "f.pptx").read_bytes()).decode()
    back = json.loads(web_import_pptx_b64("f.pptx", b64))
    assert back["name"] == "f.pptx" and len(back["spec"]["slides"]) == 2
    names = zipfile.ZipFile(bundle_package(tmp_path / "pkg.zip")).namelist()
    assert "junoview/notebook/pptx_read.py" in names


def test_the_help_page_says_so():
    assert "Import PowerPoint" in assets.help_html()
