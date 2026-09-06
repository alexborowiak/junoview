"""A small, real .pptx built from the standard library, for the importer's
tests (T320).

The project is pure stdlib and has no PowerPoint dependency, so the
fixture is the minimal OOXML PowerPoint writes: a presentation part, a
slide master and layout, two slides, and the relationships and content
types that bind them. Slide 1 carries a title, a body with two runs (the
second bold and coloured) and speaker notes; slide 2 carries a rectangle
shape with a fill and an embedded PNG picture. Coordinates are EMU on a
16:9 page (12192000 x 6858000), which is what PowerPoint itself writes.

Everything is deliberately plain so a test can assert exact values back.
"""

from __future__ import annotations

import struct
import zipfile
import zlib
from pathlib import Path

W, H = 12192000, 6858000                         # EMU, 16:9

NS = ('xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" '
      'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/'
      'relationships" '
      'xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"')


def png(w: int = 8, h: int = 8, rgb=(20, 140, 220)) -> bytes:
    def chunk(t: bytes, d: bytes) -> bytes:
        c = t + d
        return (struct.pack(">I", len(d)) + c
                + struct.pack(">I", zlib.crc32(c) & 0xFFFFFFFF))
    raw = b"".join(b"\x00" + bytes(rgb) * w for _ in range(h))
    return (b"\x89PNG\r\n\x1a\n"
            + chunk(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 2, 0, 0, 0))
            + chunk(b"IDAT", zlib.compress(raw)) + chunk(b"IEND", b""))


def _sp(sid: int, name: str, x: int, y: int, w: int, h: int, body: str,
        geom: str = "rect", fill: str | None = None) -> str:
    fill_xml = (f'<a:solidFill><a:srgbClr val="{fill}"/></a:solidFill>'
                if fill else "")
    return (f'<p:sp><p:nvSpPr><p:cNvPr id="{sid}" name="{name}"/>'
            f'<p:cNvSpPr/><p:nvPr/></p:nvSpPr>'
            f'<p:spPr><a:xfrm><a:off x="{x}" y="{y}"/><a:ext cx="{w}" cy="{h}"/>'
            f'</a:xfrm><a:prstGeom prst="{geom}"><a:avLst/></a:prstGeom>'
            f'{fill_xml}</p:spPr>{body}</p:sp>')


def _run(text: str, sz: int = 1800, b: bool = False,
         color: str | None = None) -> str:
    bold = ' b="1"' if b else ""
    rpr = f'<a:rPr lang="en-GB" sz="{sz}"{bold}>'
    if color:
        rpr += f'<a:solidFill><a:srgbClr val="{color}"/></a:solidFill>'
    rpr += "</a:rPr>"
    return f"<a:r>{rpr}<a:t>{text}</a:t></a:r>"


SLIDE1 = (
    f'<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    f'<p:sld {NS}><p:cSld><p:spTree>'
    f'<p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/>'
    f'</p:nvGrpSpPr><p:grpSpPr/>'
    + _sp(2, "Title 1", 838200, 365125, 10515600, 1325563,
          '<p:txBody><a:bodyPr/><a:lstStyle/><a:p>'
          + _run("Blocking and ENSO", sz=4400, b=True)
          + "</a:p></p:txBody>")
    + _sp(3, "Content 2", 838200, 1825625, 10515600, 4351338,
          '<p:txBody><a:bodyPr/><a:lstStyle/>'
          '<a:p><a:pPr marL="342900" indent="-342900"><a:buChar char="•"/></a:pPr>'
          + _run("Plain body text ")
          + _run("then bold and red", b=True, color="C0392B")
          + "</a:p><a:p>" + _run("A second paragraph") + "</a:p></p:txBody>")
    + '</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr>'
    '</p:sld>')

SLIDE2 = (
    f'<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    f'<p:sld {NS}><p:cSld><p:spTree>'
    f'<p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/>'
    f'</p:nvGrpSpPr><p:grpSpPr/>'
    + _sp(2, "Rectangle 1", 914400, 914400, 3048000, 1524000,
          '<p:txBody><a:bodyPr/><a:lstStyle/><a:p>'
          + _run("In a box") + "</a:p></p:txBody>", fill="2F6DB5")
    + '<p:pic><p:nvPicPr><p:cNvPr id="3" name="Picture 2"/><p:cNvPicPr/>'
      '<p:nvPr/></p:nvPicPr><p:blipFill><a:blip r:embed="rId2"/>'
      '<a:stretch><a:fillRect/></a:stretch></p:blipFill>'
      '<p:spPr><a:xfrm><a:off x="6096000" y="914400"/>'
      '<a:ext cx="4572000" cy="3429000"/></a:xfrm>'
      '<a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr></p:pic>'
    + '</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr>'
    '</p:sld>')

NOTES1 = (
    f'<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    f'<p:notes {NS}><p:cSld><p:spTree>'
    f'<p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/>'
    f'</p:nvGrpSpPr><p:grpSpPr/>'
    + _sp(2, "Notes Placeholder 1", 0, 0, 100, 100,
          '<p:txBody><a:bodyPr/><a:lstStyle/><a:p>'
          + _run("Remember to mention the 1997 event.")
          + "</a:p></p:txBody>")
    + '</p:spTree></p:cSld></p:notes>')

PRESENTATION = (
    f'<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    f'<p:presentation {NS}>'
    '<p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/>'
    '</p:sldMasterIdLst>'
    '<p:sldIdLst><p:sldId id="256" r:id="rId2"/><p:sldId id="257" r:id="rId3"/>'
    '</p:sldIdLst>'
    f'<p:sldSz cx="{W}" cy="{H}"/><p:notesSz cx="6858000" cy="9144000"/>'
    '</p:presentation>')

MASTER = (
    f'<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    f'<p:sldMaster {NS}><p:cSld><p:spTree>'
    '<p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/>'
    '</p:nvGrpSpPr><p:grpSpPr/></p:spTree></p:cSld>'
    '<p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" '
    'accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" '
    'accent6="accent6" hlink="hlink" folHlink="folHlink"/>'
    '<p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="rId1"/>'
    '</p:sldLayoutIdLst></p:sldMaster>')

LAYOUT = (
    f'<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    f'<p:sldLayout {NS} type="blank"><p:cSld name="Blank"><p:spTree>'
    '<p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/>'
    '</p:nvGrpSpPr><p:grpSpPr/></p:spTree></p:cSld></p:sldLayout>')


def _rels(pairs) -> str:
    body = "".join(
        f'<Relationship Id="{rid}" Type="http://schemas.openxmlformats.org/'
        f'officeDocument/2006/relationships/{typ}" Target="{tgt}"/>'
        for rid, typ, tgt in pairs)
    return ('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            '<Relationships xmlns="http://schemas.openxmlformats.org/package/'
            f'2006/relationships">{body}</Relationships>')


CONTENT_TYPES = (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-'
    'package.relationships+xml"/>'
    '<Default Extension="xml" ContentType="application/xml"/>'
    '<Default Extension="png" ContentType="image/png"/>'
    '<Override PartName="/ppt/presentation.xml" ContentType="application/vnd.'
    'openxmlformats-officedocument.presentationml.presentation.main+xml"/>'
    '<Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType='
    '"application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/>'
    '<Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType='
    '"application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/>'
    '<Override PartName="/ppt/slides/slide1.xml" ContentType="application/vnd.'
    'openxmlformats-officedocument.presentationml.slide+xml"/>'
    '<Override PartName="/ppt/slides/slide2.xml" ContentType="application/vnd.'
    'openxmlformats-officedocument.presentationml.slide+xml"/>'
    '<Override PartName="/ppt/notesSlides/notesSlide1.xml" ContentType='
    '"application/vnd.openxmlformats-officedocument.presentationml.notesSlide+xml"/>'
    '</Types>')


def build(path: Path) -> Path:
    """Write the fixture deck to `path` and return it."""
    parts = {
        "[Content_Types].xml": CONTENT_TYPES,
        "_rels/.rels": _rels([("rId1", "officeDocument", "ppt/presentation.xml")]),
        "ppt/presentation.xml": PRESENTATION,
        "ppt/_rels/presentation.xml.rels": _rels([
            ("rId1", "slideMaster", "slideMasters/slideMaster1.xml"),
            ("rId2", "slide", "slides/slide1.xml"),
            ("rId3", "slide", "slides/slide2.xml")]),
        "ppt/slideMasters/slideMaster1.xml": MASTER,
        "ppt/slideMasters/_rels/slideMaster1.xml.rels": _rels([
            ("rId1", "slideLayout", "../slideLayouts/slideLayout1.xml")]),
        "ppt/slideLayouts/slideLayout1.xml": LAYOUT,
        "ppt/slideLayouts/_rels/slideLayout1.xml.rels": _rels([
            ("rId1", "slideMaster", "../slideMasters/slideMaster1.xml")]),
        "ppt/slides/slide1.xml": SLIDE1,
        "ppt/slides/_rels/slide1.xml.rels": _rels([
            ("rId1", "slideLayout", "../slideLayouts/slideLayout1.xml"),
            ("rId2", "notesSlide", "../notesSlides/notesSlide1.xml")]),
        "ppt/slides/slide2.xml": SLIDE2,
        "ppt/slides/_rels/slide2.xml.rels": _rels([
            ("rId1", "slideLayout", "../slideLayouts/slideLayout1.xml"),
            ("rId2", "image", "../media/image1.png")]),
        "ppt/notesSlides/notesSlide1.xml": NOTES1,
        "ppt/notesSlides/_rels/notesSlide1.xml.rels": _rels([
            ("rId1", "slide", "../slides/slide1.xml")]),
    }
    with zipfile.ZipFile(path, "w", zipfile.ZIP_DEFLATED) as z:
        for name, xml in parts.items():
            z.writestr(name, xml.encode("utf-8"))
        z.writestr("ppt/media/image1.png", png())
    return path


if __name__ == "__main__":
    import sys
    out = Path(sys.argv[1] if len(sys.argv) > 1 else "fixture.pptx")
    build(out)
    print("wrote", out, out.stat().st_size, "bytes")
