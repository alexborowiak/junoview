"""The PowerPoint writer, checked against the file it actually produces.

``tests/test_pptx_export.py`` pins the deck-side translation and the
strings ``pptx.js`` emits. That is useful and it is not enough: a .pptx
is a ZIP of related XML parts, and every way it can be *invalid* is
invisible to a substring. A bad CRC, a part no content type covers, a
relationship pointing at nothing -- each of those gives PowerPoint's
repair prompt while every string the other file looks for is present and
correct.

So these run ``pptx.js`` and read the bytes back. ``pptx.js`` says of
itself that it "knows NOTHING about Junoview's deck model... That seam is
why this can be tested on its own"; T111 is that sentence finally being
true. The engine is whatever ``tests/helpers_js.py`` finds -- node, or VS
Code's Electron -- and everything skips when there is none.

What is checked is the structure PowerPoint enforces, not the layout:
CRCs, content-type coverage in both directions, relationship targets,
well-formed XML in the right namespaces, and the EMU arithmetic, which is
the one piece of real maths in the writer.
"""

from __future__ import annotations

import base64
import io
import posixpath
import xml.etree.ElementTree as ET
import zipfile

import pytest

from helpers_js import build_pptx, js_engine

pytestmark = pytest.mark.skipif(
    js_engine() is None,
    reason="no JS engine found (no node on PATH, no VS Code Electron)")

# a 1x1 transparent PNG
PNG = ("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAA"
       "ACklEQVR4nGNgAAAAAgABc3UBGAAAAABJRU5ErkJggg==")

W_MM, H_MM = 254.0, 190.5
EMU_PER_MM = 36000

SPEC = {
    "title": "A talk", "widthMm": W_MM, "heightMm": H_MM,
    "slides": [
        {"bg": "#ffffff", "items": [
            {"t": "text", "x": 10, "y": 20, "w": 50, "text": "Hello",
             "sizePct": 4, "b": 1},
            {"t": "image", "x": 5, "y": 50, "w": 20, "h": 20, "src": PNG},
            {"t": "rect", "x": 60, "y": 10, "w": 30, "h": 15,
             "fill": "#ff0000"},
            {"t": "table", "x": 5, "y": 75, "w": 90, "h": 15, "grid": 1,
             "rows": [["a", "b"], ["1", "2"]]},
        ]},
        {"bg": "#000000", "items": [
            {"t": "line", "x": 10, "y": 10, "w": 50, "h": 0},
        ]},
    ],
}

NS = {
    "ct": "http://schemas.openxmlformats.org/package/2006/content-types",
    "r": "http://schemas.openxmlformats.org/package/2006/relationships",
    "p": "http://schemas.openxmlformats.org/presentationml/2006/main",
    "a": "http://schemas.openxmlformats.org/drawingml/2006/main",
}


def q(prefix: str, tag: str) -> str:
    """ElementTree wants Clark notation for a direct tag comparison; the
    short prefixes above only work in find()/findall()."""
    return "{" + NS[prefix] + "}" + tag


@pytest.fixture(scope="module")
def built():
    data, info = build_pptx(SPEC)
    return zipfile.ZipFile(io.BytesIO(data)), info, data


def test_the_zip_itself_is_sound(built):
    """testzip() walks every entry, decompresses it and checks its CRC
    against the header. It is the cheapest real answer to "would this
    open", and nothing in the suite asked it before."""
    z, info, data = built
    assert z.testzip() is None
    assert len(data) == info["bytes"]
    assert info["slides"] == 2
    # a .pptx is allowed to be STOREd, and this writer stores
    assert all(i.compress_type == zipfile.ZIP_STORED for i in z.infolist())


def test_the_parts_a_presentation_must_have_are_all_there(built):
    z, _, _ = built
    for part in ("[Content_Types].xml", "_rels/.rels",
                 "ppt/presentation.xml", "ppt/_rels/presentation.xml.rels",
                 "ppt/slides/slide1.xml", "ppt/slides/slide2.xml",
                 "ppt/slideLayouts/slideLayout1.xml",
                 "ppt/slideMasters/slideMaster1.xml",
                 "ppt/theme/theme1.xml", "docProps/core.xml"):
        assert part in z.namelist(), part


def test_every_part_has_a_content_type_and_every_type_has_a_part(built):
    """Both directions, because both are repair prompts. A part no
    Default or Override covers is a part PowerPoint will not read; an
    Override naming a part that is not in the package is a dangling
    declaration."""
    z, _, _ = built
    root = ET.fromstring(z.read("[Content_Types].xml"))
    defaults = {d.get("Extension", "").lower()
                for d in root.findall("ct:Default", NS)}
    overrides = {o.get("PartName", "").lstrip("/")
                 for o in root.findall("ct:Override", NS)}

    for name in z.namelist():
        if name in overrides:
            continue
        ext = name.rsplit(".", 1)[-1].lower()
        assert ext in defaults, (
            f"{name} is in the package and no content type covers it")

    for part in overrides:
        assert part in z.namelist(), (
            f"[Content_Types].xml declares {part}, which is not in the "
            "package")


def test_every_relationship_points_at_something_that_exists(built):
    """A dangling r:id is the other classic repair prompt, and the one a
    new part is most likely to introduce: it is easy to write the XML and
    forget the .rels line, or the reverse."""
    z, _, _ = built
    names = set(z.namelist())
    for rels in [n for n in names if n.endswith(".rels")]:
        base = posixpath.dirname(posixpath.dirname(rels))
        for rel in ET.fromstring(z.read(rels)).findall("r:Relationship", NS):
            if rel.get("TargetMode") == "External":
                continue
            target = rel.get("Target", "")
            resolved = posixpath.normpath(posixpath.join(base, target))
            assert resolved in names, (
                f"{rels} points at {target!r} -> {resolved}, which is not "
                "in the package")


def test_every_xml_part_parses_and_the_slides_are_presentationml(built):
    z, _, _ = built
    for name in z.namelist():
        if not name.endswith(".xml") and not name.endswith(".rels"):
            continue
        ET.fromstring(z.read(name))          # raises if malformed
    slide = ET.fromstring(z.read("ppt/slides/slide1.xml"))
    assert slide.tag == q("p", "sld")


def test_the_slide_size_is_the_millimetres_it_was_given(built):
    """EMU is the one piece of real arithmetic in the writer, and a
    factor-of-ten slip here is a slide the size of a postage stamp that
    every string assertion still passes."""
    z, _, _ = built
    pres = ET.fromstring(z.read("ppt/presentation.xml"))
    sz = pres.find("p:sldSz", NS)
    assert int(sz.get("cx")) == round(W_MM * EMU_PER_MM)
    assert int(sz.get("cy")) == round(H_MM * EMU_PER_MM)


def test_an_item_lands_where_its_percentage_says(built):
    """x/y arrive as percentages of the slide -- the same numbers
    Junoview stores -- so a poster and a 16:9 slide differ only in
    scale."""
    z, _, _ = built
    slide = ET.fromstring(z.read("ppt/slides/slide1.xml"))
    # the shape holding "Hello", not the first <a:off> in the file --
    # that one belongs to the background rectangle, at the origin
    shape = next(sp for sp in slide.iter(q("p", "sp"))
                 if any(t.text == "Hello"
                        for t in sp.iter(q("a", "t"))))
    off = next(shape.iter(q("a", "off")))
    assert int(off.get("x")) == round(0.10 * W_MM * EMU_PER_MM)
    assert int(off.get("y")) == round(0.20 * H_MM * EMU_PER_MM)


def test_the_text_that_went_in_comes_out(built):
    z, _, _ = built
    xml = z.read("ppt/slides/slide1.xml").decode("utf-8")
    assert "<a:t>Hello</a:t>" in xml
    assert "<a:t>a</a:t>" in xml and "<a:t>2</a:t>" in xml


def test_an_image_arrives_as_its_own_bytes(built):
    """The picture is a real media part, not a re-encoded copy: the
    decoded data: URI should be in the package verbatim."""
    z, _, _ = built
    media = [n for n in z.namelist() if n.startswith("ppt/media/")]
    assert len(media) == 1
    expected = base64.b64decode(PNG.split(",", 1)[1])
    assert z.read(media[0]) == expected


def test_the_second_slide_is_a_separate_part_with_its_own_rels(built):
    z, _, _ = built
    assert "ppt/slides/_rels/slide2.xml.rels" in z.namelist()
    # and slide 2 has no media of its own, so its rels are the layout only
    rels = ET.fromstring(z.read("ppt/slides/_rels/slide2.xml.rels"))
    targets = [r.get("Target") for r in rels.findall("r:Relationship", NS)]
    assert any("slideLayout" in t for t in targets)


def test_an_item_kind_the_writer_does_not_know_is_counted_not_dropped():
    """`skipped` is the writer's only channel for saying what it could
    not carry, and the deck's export toast reads it."""
    data, info = build_pptx({
        "title": "x", "widthMm": 254, "heightMm": 190.5,
        "slides": [{"bg": "#fff", "items": [
            {"t": "text", "x": 1, "y": 1, "w": 10, "text": "ok"},
            {"t": "something-new", "x": 1, "y": 1},
            {"t": "another", "x": 1, "y": 1},
        ]}]})
    assert info["skipped"] == 2
    z = zipfile.ZipFile(io.BytesIO(data))
    assert z.testzip() is None
    assert "<a:t>ok</a:t>" in z.read("ppt/slides/slide1.xml").decode("utf-8")


def test_an_empty_deck_still_produces_a_package_that_opens():
    """The degenerate case, which is where a hand-written ZIP writer
    usually falls over -- an empty central directory, or a presentation
    with no sldIdLst."""
    data, info = build_pptx({"title": "empty", "widthMm": 254,
                             "heightMm": 190.5, "slides": []})
    z = zipfile.ZipFile(io.BytesIO(data))
    assert z.testzip() is None
    assert info["slides"] == 0
    ET.fromstring(z.read("ppt/presentation.xml"))


def test_text_that_would_break_the_xml_is_escaped():
    """The writer builds XML by string concatenation, which is fine right
    up until a slide title contains an ampersand."""
    data, _ = build_pptx({
        "title": "R&D <ok>", "widthMm": 254, "heightMm": 190.5,
        "slides": [{"bg": "#fff", "items": [
            {"t": "text", "x": 1, "y": 1, "w": 90,
             "text": 'a & b < c > d "e" \'f\''},
        ]}]})
    z = zipfile.ZipFile(io.BytesIO(data))
    for name in z.namelist():
        if name.endswith((".xml", ".rels")):
            ET.fromstring(z.read(name))
    slide = ET.fromstring(z.read("ppt/slides/slide1.xml"))
    texts = [t.text for t in slide.iter(q("a", "t"))]
    assert 'a & b < c > d "e" \'f\'' in texts
