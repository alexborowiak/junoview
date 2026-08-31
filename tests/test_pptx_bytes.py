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
            {"t": "chart", "x": 55, "y": 40, "w": 40, "h": 30, "ct": "bar",
             "cats": ["Jan", "Feb"], "numeric": False, "leg": True,
             "ink": "#dbe7ef", "title": "Trend",
             "series": [{"name": "One", "ys": [3, 5], "color": "#4fb3d9"},
                        {"name": "Two", "ys": [2, 4],
                         "color": "#f0a848"}]},
        ]},
        {"bg": "#000000", "items": [
            {"t": "line", "x": 10, "y": 10, "w": 50, "h": 0},
            {"t": "chart", "x": 10, "y": 30, "w": 40, "h": 30,
             "ct": "scatter", "cats": ["1", "2", "3"], "numeric": True,
             "leg": False, "ink": "#111111",
             "series": [{"name": "S", "ys": [1, 4, 9],
                         "color": "#8fd18a"}]},
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


# ---------------------------------------------------------------------------
# crops and transitions (T107)
# ---------------------------------------------------------------------------
#
# Both were counted as losses and disclosed in a toast. Both are now
# carried, and these check the thing a string could not: that the picture
# ends up the right size in the right place, and that the transition part
# lands where the schema wants it.


def _slide(data, n=1):
    z = zipfile.ZipFile(io.BytesIO(data))
    assert z.testzip() is None
    return z, ET.fromstring(z.read(f"ppt/slides/slide{n}.xml"))


def _cropped(crop, shape=""):
    item = {"t": "image", "x": 20, "y": 10, "w": 40, "h": 30, "src": PNG}
    if crop:
        item["crop"] = crop
    if shape:
        item["cropShape"] = shape
    return build_pptx({"title": "c", "widthMm": W_MM, "heightMm": H_MM,
                       "slides": [{"bg": "#fff", "items": [item]}]})[0]


def test_a_crop_trims_the_source_and_shrinks_the_shape_to_match():
    """The two currencies differ, and getting only one of them right is
    the visible bug. Junoview's crop is a CSS inset() mask: what is left
    stays exactly where it was. DrawingML's srcRect trims the source and
    then fillRect STRETCHES the remainder over the whole shape -- so
    passing the insets through alone blows the picture back up to its
    uncropped size, in the uncropped box.
    """
    data = _cropped({"l": 10, "r": 20, "t": 25, "b": 5})
    z, slide = _slide(data)
    pic = next(slide.iter(q("p", "pic")))

    src = next(pic.iter(q("a", "srcRect")))
    # 1000ths of a percent
    assert (src.get("l"), src.get("t"), src.get("r"), src.get("b")) == \
        ("10000", "25000", "20000", "5000")

    off = next(pic.iter(q("a", "off")))
    ext = next(pic.iter(q("a", "ext")))
    # x 20% + 10% of a 40%-wide box = 24% across; y 10% + 25% of 30% = 17.5%
    assert int(off.get("x")) == round(0.24 * W_MM * EMU_PER_MM)
    assert int(off.get("y")) == round(0.175 * H_MM * EMU_PER_MM)
    # 70% of 40% wide, 70% of 30% tall
    assert int(ext.get("cx")) == round(0.28 * W_MM * EMU_PER_MM)
    assert int(ext.get("cy")) == round(0.21 * H_MM * EMU_PER_MM)


def test_srcRect_comes_before_stretch():
    """The schema fixes the order inside <a:blipFill>, and PowerPoint
    rejects the part rather than ignoring the element."""
    xml = zipfile.ZipFile(io.BytesIO(
        _cropped({"l": 5, "r": 5}))).read("ppt/slides/slide1.xml")\
        .decode("utf-8")
    assert xml.index("<a:srcRect") < xml.index("<a:stretch")


def test_an_uncropped_picture_is_exactly_as_it_was():
    """No srcRect, no moved box: the change must be invisible to every
    image that has no crop."""
    z, slide = _slide(_cropped(None))
    pic = next(slide.iter(q("p", "pic")))
    assert not list(pic.iter(q("a", "srcRect")))
    off = next(pic.iter(q("a", "off")))
    assert int(off.get("x")) == round(0.20 * W_MM * EMU_PER_MM)


def test_a_crop_that_would_leave_nothing_is_ignored_rather_than_inverted():
    """l+r >= 100 is a degenerate crop; srcRect would make it a negative
    extent, which is a corrupt part rather than a small picture."""
    z, slide = _slide(_cropped({"l": 60, "r": 60}))
    pic = next(slide.iter(q("p", "pic")))
    assert not list(pic.iter(q("a", "srcRect")))


def test_a_crop_shape_becomes_the_preset_geometry():
    """The shapes are drawn INSIDE the trim box, so the same four
    handles move and size them -- which is exactly prstGeom over the
    cropped extent."""
    z, slide = _slide(_cropped({"t": 10, "b": 10}, shape="circle"))
    geom = next(slide.iter(q("a", "prstGeom")))
    assert geom.get("prst") == "ellipse"


def test_a_transition_lands_after_the_colour_map():
    """<p:transition> is not a free-floating element: the schema puts it
    after <p:clrMapOvr>, and out of order is a repair prompt."""
    data, _ = build_pptx({
        "title": "t", "widthMm": W_MM, "heightMm": H_MM,
        "slides": [{"bg": "#fff", "trans": "fade", "items": []},
                   {"bg": "#fff", "trans": "move", "items": []},
                   {"bg": "#fff", "trans": "", "items": []}]})
    z = zipfile.ZipFile(io.BytesIO(data))
    assert z.testzip() is None

    one = z.read("ppt/slides/slide1.xml").decode("utf-8")
    assert "<p:transition" in one
    assert one.index("<p:clrMapOvr") < one.index("<p:transition")
    assert "<p:fade/>" in one

    # `move` has no faithful OOXML equivalent this writer can be sure of,
    # so it is approximated rather than silently promised
    assert "<p:push" in z.read("ppt/slides/slide2.xml").decode("utf-8")

    # `cut` IS the absence of a transition, and writes nothing
    assert "<p:transition" not in z.read("ppt/slides/slide3.xml")\
        .decode("utf-8")


def test_a_slide_with_no_transition_key_at_all_is_unchanged():
    """Every existing caller passed {bg, items} and must keep working."""
    data, _ = build_pptx({"title": "t", "widthMm": W_MM, "heightMm": H_MM,
                          "slides": [{"bg": "#fff", "items": []}]})
    assert "<p:transition" not in zipfile.ZipFile(io.BytesIO(data))\
        .read("ppt/slides/slide1.xml").decode("utf-8")


# ---------------------------------------------------------------------------
# speaker notes (T108)
# ---------------------------------------------------------------------------
#
# The writer emitted <p:notesSz> and then no notes master and no notes
# slides, so a talk exported without the half that is the talk. A notes
# page needs parts in three places and relationships in both directions,
# and every one of those is a silent failure on its own -- which is
# exactly what a substring cannot see and a package walk can.


def _with_notes(*notes):
    return build_pptx({
        "title": "n", "widthMm": W_MM, "heightMm": H_MM,
        "slides": [{"bg": "#fff", "notes": n, "items": [
            {"t": "text", "x": 1, "y": 1, "w": 90, "text": "body"}]}
            for n in notes]})


def test_a_slide_with_notes_gets_a_notes_page():
    data, _ = _with_notes("Remember the caveat about 1998.")
    z = zipfile.ZipFile(io.BytesIO(data))
    assert z.testzip() is None
    assert "ppt/notesSlides/notesSlide1.xml" in z.namelist()
    assert "ppt/notesMasters/notesMaster1.xml" in z.namelist()
    notes = ET.fromstring(z.read("ppt/notesSlides/notesSlide1.xml"))
    assert notes.tag == q("p", "notes")
    texts = [t.text for t in notes.iter(q("a", "t"))]
    assert "Remember the caveat about 1998." in texts


def test_the_notes_placeholder_is_the_body_placeholder():
    """type="body" idx="1" is what makes it THE notes text rather than a
    stray text box sitting on the notes page."""
    data, _ = _with_notes("hello")
    z = zipfile.ZipFile(io.BytesIO(data))
    notes = ET.fromstring(z.read("ppt/notesSlides/notesSlide1.xml"))
    ph = next(notes.iter(q("p", "ph")))
    assert ph.get("type") == "body" and ph.get("idx") == "1"


def test_the_relationship_runs_in_both_directions():
    """The slide points at its notes page and the notes page points back
    at the slide. One direction alone is a notes page PowerPoint never
    opens."""
    data, _ = _with_notes("hello")
    z = zipfile.ZipFile(io.BytesIO(data))

    slide_rels = ET.fromstring(z.read("ppt/slides/_rels/slide1.xml.rels"))
    targets = [r.get("Target") for r in slide_rels.findall("r:Relationship", NS)]
    assert "../notesSlides/notesSlide1.xml" in targets

    notes_rels = ET.fromstring(
        z.read("ppt/notesSlides/_rels/notesSlide1.xml.rels"))
    back = [r.get("Target") for r in notes_rels.findall("r:Relationship", NS)]
    assert "../slides/slide1.xml" in back
    assert "../notesMasters/notesMaster1.xml" in back


def test_the_presentation_declares_the_notes_master_in_schema_order():
    """CT_Presentation is a sequence: sldMasterIdLst, notesMasterIdLst,
    then sldIdLst. Out of order is a repair prompt, not a warning."""
    data, _ = _with_notes("hello")
    xml = zipfile.ZipFile(io.BytesIO(data)).read("ppt/presentation.xml")\
        .decode("utf-8")
    assert xml.index("<p:sldMasterIdLst") < xml.index("<p:notesMasterIdLst")
    assert xml.index("<p:notesMasterIdLst") < xml.index("<p:sldIdLst")


def test_the_new_parts_are_declared_and_every_link_resolves():
    """The same two package-wide invariants the rest of this file
    checks, re-run over a deck that has notes -- because the parts, the
    rels, the content types and presentation.xml are written in four
    places and all four have to agree."""
    data, _ = _with_notes("one", "", "three")
    z = zipfile.ZipFile(io.BytesIO(data))
    names = set(z.namelist())

    root = ET.fromstring(z.read("[Content_Types].xml"))
    overrides = {o.get("PartName", "").lstrip("/")
                 for o in root.findall("ct:Override", NS)}
    assert "ppt/notesSlides/notesSlide1.xml" in overrides
    assert "ppt/notesSlides/notesSlide3.xml" in overrides
    assert "ppt/notesMasters/notesMaster1.xml" in overrides
    for part in overrides:
        assert part in names, part

    import posixpath as pp
    for rels in [n for n in names if n.endswith(".rels")]:
        base = pp.dirname(pp.dirname(rels))
        for rel in ET.fromstring(z.read(rels)).findall("r:Relationship", NS):
            resolved = pp.normpath(pp.join(base, rel.get("Target", "")))
            assert resolved in names, f"{rels} -> {resolved}"


def test_only_the_slides_with_notes_get_a_part():
    """A notes page for every slide would put an empty Notes page under
    each one, which is worse than none."""
    data, _ = _with_notes("one", "", "three")
    names = zipfile.ZipFile(io.BytesIO(data)).namelist()
    assert "ppt/notesSlides/notesSlide1.xml" in names
    assert "ppt/notesSlides/notesSlide2.xml" not in names
    assert "ppt/notesSlides/notesSlide3.xml" in names


def test_whitespace_only_notes_do_not_count_as_notes():
    data, _ = _with_notes("   \n\t ")
    names = zipfile.ZipFile(io.BytesIO(data)).namelist()
    assert not [n for n in names if "notesSlide" in n]
    assert not [n for n in names if "notesMaster" in n]


def test_a_deck_with_no_notes_is_byte_for_byte_what_it_was():
    """The notes master appears only when something needs it, so every
    existing export is unchanged -- which is the cheapest possible proof
    that this did not disturb anything."""
    plain = {"title": "n", "widthMm": W_MM, "heightMm": H_MM,
             "slides": [{"bg": "#fff", "items": [
                 {"t": "text", "x": 1, "y": 1, "w": 90, "text": "body"}]}]}
    a, _ = build_pptx(plain)
    b, _ = build_pptx({**plain, "slides": [
        {**plain["slides"][0], "notes": ""}]})
    assert a == b
    assert "<p:notesMasterIdLst" not in zipfile.ZipFile(io.BytesIO(a))\
        .read("ppt/presentation.xml").decode("utf-8")


def test_notes_keep_their_line_breaks_and_escape_their_text():
    """A paragraph per line, because the Notes page is where people put
    a list -- and an ampersand in a note must not corrupt the part."""
    data, _ = _with_notes("first line\nsecond & third\nlast")
    z = zipfile.ZipFile(io.BytesIO(data))
    notes = ET.fromstring(z.read("ppt/notesSlides/notesSlide1.xml"))
    texts = [t.text for t in notes.iter(q("a", "t"))]
    assert texts == ["first line", "second & third", "last"]
    assert len(list(notes.iter(q("a", "p")))) == 3


# ---------------------------------------------------------------------------
# native charts (T117)
# ---------------------------------------------------------------------------


def test_a_chart_leaves_as_a_real_chart_part(built):
    """The point of T117: the numbers travel in a real <c:chart> part,
    so PowerPoint restyles and recolours it natively. The structural
    tests above already prove the part is covered by a content type and
    reached by a resolving relationship; this pins what is IN it."""
    z, _, _ = built
    assert "ppt/charts/chart1.xml" in z.namelist()
    x = z.read("ppt/charts/chart1.xml").decode("utf-8")
    c = "{http://schemas.openxmlformats.org/drawingml/2006/chart}"
    assert ET.fromstring(x).tag == c + "chartSpace"
    # the cached values are what PowerPoint renders (no workbook part,
    # on purpose -- the cut is recorded in TASKS T117)
    assert "<c:v>Jan</c:v>" in x and "<c:v>3</c:v>" in x
    assert "barChart" in x and "<c:v>One</c:v>" in x
    # the slide reaches it through a graphicFrame
    s1 = z.read("ppt/slides/slide1.xml").decode("utf-8")
    assert "graphicFrame" in s1
    rels = z.read("ppt/slides/_rels/slide1.xml.rels").decode("utf-8")
    assert "../charts/chart1.xml" in rels


def test_a_numeric_scatter_gets_two_value_axes(built):
    """Numeric categories make a real x axis (c:valAx twice), which is
    what separates a scatter from a marker-only line chart."""
    z, _, _ = built
    x = z.read("ppt/charts/chart2.xml").decode("utf-8")
    assert "scatterChart" in x
    assert x.count("<c:valAx>") == 2 and "<c:catAx>" not in x

