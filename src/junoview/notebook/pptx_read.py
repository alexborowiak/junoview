"""A PowerPoint deck, read into the editor's own item spec (T320).

The user's list, item 1: "PowerPoint import preserving editable text,
shapes, notes, charts, images and as much animation as possible".

The spec this produces is the SAME shape ``pptx.js`` consumes on the way
out -- items in percent of the page, text with ``sizePct``, ``rect`` /
``line`` / ``image`` / ``table`` / ``chart`` / ``draw`` kinds, a
``notes`` string and ``animStep`` per item -- so the exporter's documented
seam is the importer's too, and a deck can go round the trip in a test.
``specToPres`` in the deck JS turns it into slides.

Pure stdlib, like ``parse_workbook`` beside it: ``zipfile`` and
``ElementTree``, relationships resolved by hand. python-pptx is not a
dependency and this project has none.

THE GATES. A .pptx is a zip of XML, and a zip is the classic way of
carrying something worse: the input is capped (``PPTX_CAP``), the part
count and inflated size are capped, a part carrying a DOCTYPE is refused
outright rather than parsed, media is admitted only through ``IMG_MIME``
plus its magic bytes, and a hyperlink survives only as http, https or
mailto. Nothing here runs anything, fetches anything or writes anything.

WHAT IS LOST IS SAID. Every branch that cannot carry something adds a
line to ``lost`` -- named by kind and counted -- and the editor shows
that list BEFORE the import lands, the same way the export dialog does.
Silence would be worse than a rectangle where a chevron was.
"""

from __future__ import annotations

import base64
import binascii
import colorsys
import io
import posixpath
import re
import xml.etree.ElementTree as ET
import zipfile
from typing import Any

from .sources import EMBED_CAP, IMG_MIME

__all__ = ["PPTX_CAP", "PPTX_SUFFIXES", "is_pptx_name", "read_pptx",
           "read_pptx_b64"]

#: An input larger than this is refused before the zip is even opened.
PPTX_CAP = 64 * 1024 * 1024
#: A zip with more parts than this, or inflating past this, is a bomb
#: rather than a deck. A real deck has a few hundred parts.
PART_CAP = 20000
INFLATE_CAP = 512 * 1024 * 1024
#: The suffixes the doors accept. .potx is a template, .ppsx a show,
#: .pptm a macro-enabled deck: all the same package.
PPTX_SUFFIXES = (".pptx", ".potx", ".ppsx", ".pptm", ".potm", ".ppsm")

EMU_PER_MM = 36000
EMU_PER_PT = 12700

_A = "http://schemas.openxmlformats.org/drawingml/2006/main"
_P = "http://schemas.openxmlformats.org/presentationml/2006/main"
_R = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
_C = "http://schemas.openxmlformats.org/drawingml/2006/chart"
_REL = "http://schemas.openxmlformats.org/package/2006/relationships"
_P14 = "http://schemas.microsoft.com/office/powerpoint/2010/main"
_DGM = "http://schemas.openxmlformats.org/drawingml/2006/diagram"
NS = {"a": _A, "p": _P, "r": _R, "c": _C, "p14": _P14, "dgm": _DGM}

#: The same heads routes.py checks a picture against on the way in from
#: a path. SVG has no magic and is parsed instead; webp/avif are
#: containers and pass on suffix alone, the same known gap.
_MAGIC = {
    "image/png": [b"\x89PNG\r\n\x1a\n"],
    "image/jpeg": [b"\xff\xd8\xff"],
    "image/gif": [b"GIF87a", b"GIF89a"],
    "image/bmp": [b"BM"],
}
_METAFILES = (".emf", ".wmf")
#: The clips a browser can play (T321). wmv/avi/wma are PowerPoint's own
#: and no browser has them; they are named in the report instead.
_CLIP_MIME = {
    ".mp4": "video/mp4", ".m4v": "video/mp4", ".webm": "video/webm",
    ".mov": "video/quicktime", ".ogv": "video/ogg", ".mp3": "audio/mpeg",
    ".m4a": "audio/mp4", ".wav": "audio/wav", ".ogg": "audio/ogg",
    ".oga": "audio/ogg", ".weba": "audio/webm", ".aac": "audio/aac",
    ".flac": "audio/flac",
}

#: OOXML preset geometry -> the editor's shape id. Anything else arrives
#: as a rectangle and is named in the loss report.
_SHAPES = {
    "rect": "rect", "roundRect": "rect", "snipRoundRect": "rect",
    "snip1Rect": "rect", "snip2SameRect": "rect", "snip2DiagRect": "rect",
    "round1Rect": "rect", "round2SameRect": "rect", "round2DiagRect": "rect",
    "flowChartProcess": "rect", "flowChartAlternateProcess": "rect",
    "ellipse": "ellipse", "flowChartConnector": "ellipse",
    "triangle": "triangle", "rtTriangle": "triangle",
    "diamond": "diamond", "flowChartDecision": "diamond",
    "pentagon": "pentagon", "hexagon": "hexagon",
    "star4": "star", "star5": "star", "star6": "star", "star8": "star",
    "star10": "star", "star12": "star",
    "plus": "cross", "mathPlus": "cross",
    "rightArrow": "arrow", "leftArrow": "arrow", "upArrow": "arrow",
    "downArrow": "arrow", "notchedRightArrow": "arrow", "homePlate": "arrow",
    "heart": "heart", "cloud": "cloud", "cloudCallout": "cloud",
    "wedgeRectCallout": "bubble", "wedgeRoundRectCallout": "bubble",
    "wedgeEllipseCallout": "bubble",
    "lightningBolt": "lightning",
}
_LINE_GEOMS = ("line", "straightConnector1", "bentConnector2",
               "bentConnector3", "bentConnector4", "bentConnector5",
               "curvedConnector2", "curvedConnector3", "curvedConnector4",
               "curvedConnector5")
_DASHES = {"solid": "solid", "dash": "dash", "sysDash": "dash",
           "lgDash": "lgDash", "dot": "sysDot", "sysDot": "sysDot",
           "dashDot": "dashDot", "sysDashDot": "dashDot",
           "lgDashDot": "dashDot", "lgDashDotDot": "dashDot",
           "sysDashDotDot": "dashDot"}
_HEADS = {"triangle": "triangle", "stealth": "stealth", "arrow": "arrow",
          "diamond": "diamond", "oval": "oval", "none": "none"}
#: PowerPoint's entrance presets, by id, onto the four the editor has.
#: Appear and Fade are exact; the fly/float/rise family is Float up; the
#: two Zooms are Zoom. The rest are fades and are counted.
_ENTRANCES = {1: "appear", 10: "fade", 2: "rise", 12: "rise", 13: "rise",
              42: "rise", 47: "rise", 48: "rise", 24: "zoom", 53: "zoom"}
_PRESET_COLOURS = {
    "black": "#000000", "white": "#ffffff", "red": "#ff0000",
    "green": "#008000", "blue": "#0000ff", "yellow": "#ffff00",
    "gray": "#808080", "grey": "#808080", "orange": "#ffa500",
    "purple": "#800080", "navy": "#000080", "teal": "#008080",
    "silver": "#c0c0c0", "maroon": "#800000", "lime": "#00ff00",
    "aqua": "#00ffff", "cyan": "#00ffff", "magenta": "#ff00ff",
    "fuchsia": "#ff00ff", "olive": "#808000", "darkGray": "#a9a9a9",
    "lightGray": "#d3d3d3", "dkGray": "#a9a9a9", "ltGray": "#d3d3d3",
}
_SCHEME_MAP = {"bg1": "lt1", "tx1": "dk1", "bg2": "lt2", "tx2": "dk2"}
#: the colour a run gets when nothing names one: the editor's own ink,
#: which follows the page. These are left UNSET on purpose.
_INK_NAMES = ("tx1", "dk1", "lt1", "bg1")


def is_pptx_name(name: str) -> bool:
    return str(name or "").lower().endswith(PPTX_SUFFIXES)


def _local(tag: str) -> str:
    return tag.rsplit("}", 1)[-1] if "}" in tag else tag


def _int(v: Any, default: int = 0) -> int:
    try:
        return int(str(v))
    except (TypeError, ValueError):
        return default


def _hexpair(v: str) -> str:
    v = str(v or "").strip().lstrip("#")
    if re.fullmatch(r"[0-9A-Fa-f]{6}", v):
        return "#" + v.lower()
    return ""


# ---------------------------------------------------------------------------
# the loss report
# ---------------------------------------------------------------------------

_LOST_TEXT = {
    "shape": "{n} shape{s} of kinds this editor has no outline for "
             "({kinds}) — {they} arrive{s3} as {rect}",
    "metafile": "{n} picture{s} in a Windows metafile (EMF/WMF) — no "
                "browser can draw one, so {they} {are} left out",
    "picfmt": "{n} picture{s} in a format this cannot carry ({kinds}) "
              "— left out",
    "piclink": "{n} picture{s} linked to a file outside the deck — "
               "left out",
    "picbig": "{n} picture{s} over the {cap} MB a deck will carry — "
              "left out",
    "picbad": "{n} picture{s} whose bytes are not the format they claim "
              "— left out",
    "media": "{n} video or audio clip{s} whose file is missing from the "
             "deck — the poster frame arrives as a picture; the clip does "
             "not",
    "medialink": "{n} video or audio clip{s} linked to a file outside "
                 "the deck — the poster frame arrives as a picture; the "
                 "clip does not",
    "mediafmt": "{n} clip{s} in a format no browser plays ({kinds}) — the "
                "poster frame arrives as a picture; the clip does not",
    "chartkind": "{n} chart{s} of a kind this cannot read ({kinds}) — "
                 "left out; save {it} as a picture in PowerPoint and "
                 "place that",
    "chartcache": "{n} chart{s} with no values cached in the file — "
                  "left out",
    "ole": "{n} embedded object{s} (Excel sheets, equations or other "
           "documents) — left out",
    "smartart": "SmartArt on {n} slide{s} — its words arrive as a "
                "bulleted list; the diagram does not",
    "anim": "{n} entrance{s} of kinds this deck does not have — "
            "{they} arrive{s3} as fades on the same click",
    "emph": "{n} emphasis or motion-path effect{s} — not carried",
    "trans": "{n} slide transition{s} this deck does not have ({kinds}) "
             "— {they} arrive{s3} as fades",
    "mixsize": "{n} text box{es} whose words change size part-way "
               "— each box takes the size of its first words",
    "levels": "{n} text box{es} with indented bullet levels — every "
              "bullet arrives at the first level",
    "runlink": "{n} link{s} on words inside a text box — each box "
               "takes its first link as a click on the whole box",
    "hiddenobj": "{n} object{s} PowerPoint had hidden — left out",
    "merged": "{n} merged table cell{s} — split back into single "
              "cells",
    "curve": "{n} freehand curve{s} drawn with straight segments",
    "hidden": "{n} hidden slide{s} — imported as Optional, which "
              "Running late can skip",
    "picfill": "{n} shape{s} filled with a picture — the outline "
               "arrives, the picture does not",
    "vertical": "{n} text box{es} set vertically — shown horizontal",
    "gradtext": "{n} text box{es} with gradient or patterned letters "
                "— shown in one colour",
}


class _Tally:
    def __init__(self) -> None:
        self.n: dict[str, int] = {}
        self.kinds: dict[str, list[str]] = {}

    def add(self, key: str, kind: str | None = None, n: int = 1) -> None:
        self.n[key] = self.n.get(key, 0) + n
        if kind:
            ks = self.kinds.setdefault(key, [])
            if kind not in ks:
                ks.append(kind)

    def render(self) -> list[str]:
        out = []
        for key, text in _LOST_TEXT.items():
            n = self.n.get(key, 0)
            if not n:
                continue
            one = n == 1
            out.append(text.format(
                n=n, s="" if one else "s", es="" if one else "es",
                they="it" if one else "they", are="is" if one else "are",
                it="it" if one else "them", s3="s" if one else "",
                kinds=", ".join(self.kinds.get(key, [])) or "unknown",
                rect="a rectangle" if one else "rectangles",
                cap=EMBED_CAP // (1024 * 1024)))
        return out


# ---------------------------------------------------------------------------
# the package
# ---------------------------------------------------------------------------

class _Pkg:
    """The zip, with parts parsed once and relationships resolved."""

    def __init__(self, data: bytes) -> None:
        if len(data) > PPTX_CAP:
            raise ValueError(
                f"this file is {len(data) // (1024 * 1024)} MB, over the "
                f"{PPTX_CAP // (1024 * 1024)} MB this will read")
        try:
            self.z = zipfile.ZipFile(io.BytesIO(data))
            infos = self.z.infolist()
        except zipfile.BadZipFile as e:
            raise ValueError("not a PowerPoint file (not a zip archive "
                             "inside)") from e
        if len(infos) > PART_CAP:
            raise ValueError("refused: this archive holds more parts than "
                             "any deck could")
        if sum(i.file_size for i in infos) > INFLATE_CAP:
            raise ValueError("refused: this archive inflates far beyond "
                             "what a deck could hold")
        self.names = {i.filename for i in infos}
        if "ppt/presentation.xml" not in self.names:
            raise ValueError("not a PowerPoint file (no "
                             "ppt/presentation.xml inside)")
        self._xml: dict[str, ET.Element | None] = {}
        self._rels: dict[str, dict[str, tuple[str, str, bool]]] = {}

    def has(self, name: str) -> bool:
        return name in self.names

    def read(self, name: str) -> bytes:
        return self.z.read(name)

    def xml(self, name: str) -> ET.Element | None:
        if name in self._xml:
            return self._xml[name]
        el: ET.Element | None = None
        if name in self.names:
            raw = self.z.read(name)
            head = raw[:4096].lstrip()
            if b"<!DOCTYPE" in raw or b"<!ENTITY" in raw or (
                    head and not head.startswith(b"<")):
                raise ValueError(
                    f"refused: {name} is not plain XML (it carries a "
                    "DOCTYPE or is not XML at all)")
            try:
                el = ET.fromstring(raw)
            except ET.ParseError as e:
                raise ValueError(f"{name} is not well-formed XML: "
                                 f"{e}") from e
        self._xml[name] = el
        return el

    def rels(self, part: str) -> dict[str, tuple[str, str, bool]]:
        """rId -> (relationship kind, target part or URL, external?)."""
        if part in self._rels:
            return self._rels[part]
        d, f = posixpath.split(part)
        name = posixpath.join(d, "_rels", f + ".rels") if d else (
            "_rels/" + f + ".rels")
        out: dict[str, tuple[str, str, bool]] = {}
        root = self.xml(name) if name in self.names else None
        if root is not None:
            for rel in root:
                if _local(rel.tag) != "Relationship":
                    continue
                rid = rel.get("Id") or ""
                typ = (rel.get("Type") or "").rsplit("/", 1)[-1]
                tgt = rel.get("Target") or ""
                ext = (rel.get("TargetMode") or "") == "External"
                if not ext:
                    tgt = (tgt[1:] if tgt.startswith("/")
                           else posixpath.normpath(posixpath.join(d, tgt)))
                out[rid] = (typ, tgt, ext)
        self._rels[part] = out
        return out

    def target(self, part: str, rid: str | None) -> str | None:
        if not rid:
            return None
        got = self.rels(part).get(rid)
        return got[1] if got and not got[2] else None


# ---------------------------------------------------------------------------
# the theme: colours and fonts a schemeClr or +mn-lt resolves through
# ---------------------------------------------------------------------------

class _Theme:
    def __init__(self, pkg: _Pkg, part: str | None) -> None:
        self.colors: dict[str, str] = {}
        self.major = ""
        self.minor = ""
        self.lines: list[int] = []
        root = pkg.xml(part) if part else None
        if root is None:
            return
        scheme = root.find(".//a:clrScheme", NS)
        for el in (scheme if scheme is not None else []):
            for ch in el:
                col = _plain_color(ch)
                if col:
                    self.colors[_local(el.tag)] = col
        maj = root.find(".//a:majorFont/a:latin", NS)
        mnr = root.find(".//a:minorFont/a:latin", NS)
        self.major = (maj.get("typeface") if maj is not None else "") or ""
        self.minor = (mnr.get("typeface") if mnr is not None else "") or ""
        for ln in root.findall(".//a:lnStyleLst/a:ln", NS):
            self.lines.append(_int(ln.get("w"), EMU_PER_PT))


def _plain_color(ch: ET.Element) -> str:
    """srgbClr / sysClr / prstClr / scrgbClr -> '#rrggbb', no scheme."""
    t = _local(ch.tag)
    if t == "srgbClr":
        return _hexpair(ch.get("val") or "")
    if t == "sysClr":
        return _hexpair(ch.get("lastClr") or "")
    if t == "prstClr":
        return _PRESET_COLOURS.get(ch.get("val") or "", "")
    if t == "scrgbClr":
        return _rgb_hex(*(_int(ch.get(k)) / 100000 for k in ("r", "g", "b")))
    return ""


def _rgb_hex(r: float, g: float, b: float) -> str:
    """0..1 channels -> '#rrggbb', clamped."""
    return "#" + "".join(
        f"{max(0, min(255, round(c * 255))):02x}" for c in (r, g, b))


def _mod_color(hexcol: str, ch: ET.Element) -> str:
    """Apply lumMod/lumOff/tint/shade the way PowerPoint's colour picker
    does when it says 'Accent 1, lighter 40%'."""
    if not hexcol:
        return hexcol
    r, g, b = (int(hexcol[i:i + 2], 16) / 255 for i in (1, 3, 5))
    for m in ch:
        k = _local(m.tag)
        v = _int(m.get("val")) / 100000
        if k == "lumMod" or k == "lumOff":
            h, lum, s = colorsys.rgb_to_hls(r, g, b)
            lum = lum * v if k == "lumMod" else lum + v
            r, g, b = colorsys.hls_to_rgb(h, max(0, min(1, lum)), s)
        elif k == "tint":
            r, g, b = (c * v + (1 - v) for c in (r, g, b))
        elif k == "shade":
            r, g, b = (c * v for c in (r, g, b))
    return _rgb_hex(r, g, b)


class _Ctx:
    """What a slide resolves against: theme, colour map, page size."""

    def __init__(self, pkg: _Pkg, theme: _Theme, clrmap: dict[str, str],
                 w: int, h: int, tally: _Tally) -> None:
        self.pkg = pkg
        self.theme = theme
        self.clrmap = clrmap
        self.w = max(1, w)
        self.h = max(1, h)
        self.hpt = self.h / EMU_PER_PT
        self.tally = tally

    def color(self, parent: ET.Element | None) -> tuple[str, float, bool]:
        """The colour a fill-ish element names: (hex, alpha, is_ink).

        is_ink is true for an unmodified text/background scheme colour,
        which the editor leaves unset so its own ink follows the page.
        """
        if parent is None:
            return "", 1.0, False
        for ch in parent:
            t = _local(ch.tag)
            if t not in ("srgbClr", "schemeClr", "sysClr", "prstClr",
                         "scrgbClr"):
                continue
            alpha = 1.0
            for m in ch:
                if _local(m.tag) == "alpha":
                    alpha = max(0.0, min(1.0, _int(m.get("val")) / 100000))
            ink = False
            if t == "schemeClr":
                name = ch.get("val") or ""
                mods = any(_local(m.tag) in ("lumMod", "lumOff", "tint",
                                              "shade") for m in ch)
                ink = name in _INK_NAMES and not mods
                key = self.clrmap.get(name, _SCHEME_MAP.get(name, name))
                col = self.theme.colors.get(key, "")
            else:
                col = _plain_color(ch)
            return _mod_color(col, ch), alpha, ink
        return "", 1.0, False

    def font(self, latin: ET.Element | None) -> str:
        if latin is None:
            return ""
        face = latin.get("typeface") or ""
        if face.startswith("+mj"):
            return self.theme.major
        if face.startswith("+mn"):
            return self.theme.minor
        return face

    def px(self, x: float) -> float:
        return round(x / self.w * 100, 3)

    def py(self, y: float) -> float:
        return round(y / self.h * 100, 3)

    def sz(self, hundredths: int) -> float:
        return round(hundredths / 100 / self.hpt * 100, 3)

    def sw(self, emu: int) -> float:
        return round(emu / EMU_PER_PT / self.hpt * 100, 4)


# ---------------------------------------------------------------------------
# geometry
# ---------------------------------------------------------------------------

class _Xf:
    """Child space -> slide EMU. A group scales its children from its
    chOff/chExt box into its own off/ext box; nesting composes."""

    def __init__(self, ox: float = 0, oy: float = 0, sx: float = 1,
                 sy: float = 1) -> None:
        self.ox, self.oy, self.sx, self.sy = ox, oy, sx, sy

    def pt(self, x: float, y: float) -> tuple[float, float]:
        return self.ox + x * self.sx, self.oy + y * self.sy

    def child(self, off: tuple[int, int], ext: tuple[int, int],
              choff: tuple[int, int], chext: tuple[int, int]) -> _Xf:
        sx = ext[0] / chext[0] if chext[0] else 1.0
        sy = ext[1] / chext[1] if chext[1] else 1.0
        ox, oy = self.pt(off[0], off[1])
        return _Xf(ox - choff[0] * sx * self.sx, oy - choff[1] * sy * self.sy,
                   sx * self.sx, sy * self.sy)


def _xfrm(el: ET.Element | None) -> dict | None:
    """off/ext/rot/flip of an <a:xfrm> (or <p:xfrm>), or None."""
    if el is None:
        return None
    off = el.find("a:off", NS)
    ext = el.find("a:ext", NS)
    if off is None or ext is None:
        return None
    return {"x": _int(off.get("x")), "y": _int(off.get("y")),
            "w": _int(ext.get("cx")), "h": _int(ext.get("cy")),
            "rot": _int(el.get("rot")) / 60000,
            "flipH": el.get("flipH") == "1", "flipV": el.get("flipV") == "1",
            "choff": _pair(el.find("a:chOff", NS), "x", "y"),
            "chext": _pair(el.find("a:chExt", NS), "cx", "cy")}


def _pair(el: ET.Element | None, a: str, b: str) -> tuple[int, int]:
    if el is None:
        return (0, 0)
    return (_int(el.get(a)), _int(el.get(b)))


def _box(ctx: _Ctx, xf: _Xf, g: dict) -> dict:
    x, y = xf.pt(g["x"], g["y"])
    w, h = g["w"] * xf.sx, g["h"] * xf.sy
    out = {"x": ctx.px(x), "y": ctx.py(y), "w": ctx.px(w), "h": ctx.py(h)}
    if g.get("rot"):
        out["rot"] = round(g["rot"], 2)
    return out


# ---------------------------------------------------------------------------
# placeholders: where a title sits when the slide does not say
# ---------------------------------------------------------------------------

_PH_KIND = {"title": "title", "ctrTitle": "title", "subTitle": "body",
            "body": "body", "obj": "body", "tbl": "body", "chart": "body",
            "dgm": "body", "media": "body", "pic": "body", "clipArt": "body",
            "dt": "furniture", "ftr": "furniture", "sldNum": "furniture",
            "hdr": "furniture", "sldImg": "furniture"}


def _ph(sp: ET.Element) -> tuple[str, str] | None:
    ph = sp.find("./p:nvSpPr/p:nvPr/p:ph", NS)
    if ph is None:
        ph = sp.find("./p:nvPicPr/p:nvPr/p:ph", NS)
    if ph is None:
        ph = sp.find("./p:nvGraphicFramePr/p:nvPr/p:ph", NS)
    if ph is None:
        return None
    return (ph.get("type") or "obj", ph.get("idx") or "")


class _Slots:
    """The placeholders of one layout or master, by idx and by type."""

    def __init__(self, root: ET.Element | None) -> None:
        self.by_idx: dict[str, ET.Element] = {}
        self.by_type: dict[str, ET.Element] = {}
        if root is None:
            return
        tree = root.find("./p:cSld/p:spTree", NS)
        for sp in (tree if tree is not None else []):
            if _local(sp.tag) != "sp":
                continue
            ph = _ph(sp)
            if not ph:
                continue
            typ, idx = ph
            if idx and idx not in self.by_idx:
                self.by_idx[idx] = sp
            self.by_type.setdefault(typ, sp)
            self.by_type.setdefault(_PH_KIND.get(typ, typ), sp)

    def find(self, typ: str, idx: str) -> ET.Element | None:
        if idx and idx in self.by_idx:
            return self.by_idx[idx]
        if typ in self.by_type:
            return self.by_type[typ]
        return self.by_type.get(_PH_KIND.get(typ, typ))


class _Master:
    def __init__(self, pkg: _Pkg, part: str) -> None:
        self.part = part
        self.root = pkg.xml(part)
        self.slots = _Slots(self.root)
        self.clrmap: dict[str, str] = {}
        self.bg: str = ""
        self.styles: dict[str, ET.Element | None] = {
            "title": None, "body": None, "other": None}
        theme_part = None
        for typ, tgt, ext in pkg.rels(part).values():
            if typ == "theme" and not ext:
                theme_part = tgt
        self.theme = _Theme(pkg, theme_part)
        if self.root is None:
            return
        cm = self.root.find("./p:clrMap", NS)
        if cm is not None:
            self.clrmap = {k: v for k, v in cm.attrib.items()}
        tx = self.root.find("./p:txStyles", NS)
        if tx is not None:
            self.styles["title"] = tx.find("p:titleStyle", NS)
            self.styles["body"] = tx.find("p:bodyStyle", NS)
            self.styles["other"] = tx.find("p:otherStyle", NS)


class _Layout:
    def __init__(self, pkg: _Pkg, part: str, master: _Master) -> None:
        self.part = part
        self.root = pkg.xml(part)
        self.slots = _Slots(self.root)
        self.master = master


# ---------------------------------------------------------------------------
# text
# ---------------------------------------------------------------------------

def _lvl_props(lst: ET.Element | None, lvl: int) -> ET.Element | None:
    if lst is None:
        return None
    return lst.find(f"a:lvl{lvl + 1}pPr", NS)


def _def_rpr_chain(shape: ET.Element | None, slots: list[_Slots],
                   master: _Master, kind: str, lvl: int) -> list[ET.Element]:
    """Every lvlNpPr that could say what a run at this level looks like,
    nearest first: the shape's own lstStyle, the layout placeholder's,
    the master placeholder's, then the master's text styles."""
    out: list[ET.Element] = []
    for sp in [shape] + [
            s.find(kind, "") for s in slots]:  # type: ignore[misc]
        if sp is None:
            continue
        lst = sp.find("./p:txBody/a:lstStyle", NS)
        p = _lvl_props(lst, lvl)
        if p is not None:
            out.append(p)
    st = master.styles.get(kind if kind in ("title", "body") else "other")
    p = _lvl_props(st, lvl)
    if p is not None:
        out.append(p)
    if kind != "other":
        p = _lvl_props(master.styles.get("other"), lvl)
        if p is not None:
            out.append(p)
    return out


def _first(chain: list[ET.Element], path: str) -> ET.Element | None:
    for el in chain:
        got = el.find(path, NS)
        if got is not None:
            return got
    return None


def _first_attr(chain: list[ET.Element], path: str, attr: str) -> str:
    for el in chain:
        got = el.find(path, NS) if path else el
        if got is not None and got.get(attr) is not None:
            return got.get(attr) or ""
    return ""


def _run_text(r: ET.Element) -> str:
    t = r.find("a:t", NS)
    return (t.text or "") if t is not None else ""


class _TextReader:
    """One shape's words, with the formatting each run resolves to."""

    def __init__(self, ctx: _Ctx, master: _Master, layout: _Layout,
                 slide_part: str) -> None:
        self.ctx = ctx
        self.master = master
        self.layout = layout
        self.slide_part = slide_part

    def read(self, sp: ET.Element, kind: str, ph_shape_chain: list,
             txbody: ET.Element | None = None) -> dict | None:
        body = txbody if txbody is not None else sp.find("p:txBody", NS)
        if body is None:
            body = sp.find("a:txBody", NS)
        if body is None:
            return None
        bp = body.find("a:bodyPr", NS)
        scale = 1.0
        if bp is not None:
            na = bp.find("a:normAutofit", NS)
            if na is not None and na.get("fontScale"):
                scale = max(0.1, _int(na.get("fontScale"), 100000) / 100000)
            if (bp.get("vert") or "horz") != "horz":
                self.ctx.tally.add("vertical")
        paras = []
        for p in body.findall("a:p", NS):
            paras.append(self._para(sp, p, kind, ph_shape_chain, scale))
        # trailing empty paragraphs are PowerPoint's caret, not content
        while paras and not paras[-1]["runs"] and len(paras) > 1:
            paras.pop()
        if not any(r["t"].strip() for pa in paras for r in pa["runs"]):
            return None
        return {"paras": paras, "anchor": _anchor(bp, ph_shape_chain)}

    def _para(self, sp: ET.Element, p: ET.Element, kind: str,
              chain_shapes: list, scale: float) -> dict:
        ppr = p.find("a:pPr", NS)
        lvl = _int(ppr.get("lvl")) if ppr is not None else 0
        chain = ([ppr] if ppr is not None else []) + _def_rpr_chain(
            sp, chain_shapes, self.master, kind, lvl)
        align = {"l": "left", "ctr": "center", "r": "right",
                 "just": "justify"}.get(_first_attr(chain, "", "algn"), "")
        bullet, num = self._bullet(chain, kind)
        runs = []
        for ch in p:
            t = _local(ch.tag)
            if t == "r" or t == "fld":
                text = _run_text(ch)
                if text == "" and t == "r":
                    continue
                runs.append(self._run(ch.find("a:rPr", NS), text, chain,
                                      scale))
            elif t == "br":
                runs.append(self._run(ch.find("a:rPr", NS), "\n", chain,
                                      scale))
        return {"lvl": lvl, "align": align, "bullet": bullet, "num": num,
                "runs": runs}

    def _bullet(self, chain: list[ET.Element], kind: str) -> tuple[bool, bool]:
        for el in chain:
            for ch in el:
                t = _local(ch.tag)
                if t == "buNone":
                    return False, False
                if t == "buAutoNum":
                    return True, True
                if t in ("buChar", "buBlip"):
                    return True, False
        return False, False

    def _run(self, rpr: ET.Element | None, text: str,
             chain: list[ET.Element], scale: float) -> dict:
        srcs: list[ET.Element] = ([rpr] if rpr is not None else [])
        defs = [d for d in (el.find("a:defRPr", NS) for el in chain)
                if d is not None]
        srcs += defs
        sz = _first_attr(srcs, "", "sz")
        b = _first_attr(srcs, "", "b")
        i = _first_attr(srcs, "", "i")
        u = _first_attr(srcs, "", "u")
        strike = _first_attr(srcs, "", "strike")
        color, alpha, ink = "", 1.0, False
        for s in srcs:
            fill = s.find("a:solidFill", NS)
            if fill is not None:
                color, alpha, ink = self.ctx.color(fill)
                break
            if s.find("a:gradFill", NS) is not None or (
                    s.find("a:pattFill", NS) is not None):
                self.ctx.tally.add("gradtext")
                break
        font = self.ctx.font(_first(srcs, "a:latin"))
        href = ""
        if rpr is not None:
            hl = rpr.find("a:hlinkClick", NS)
            if hl is not None:
                href = self._href(hl)
        out = {"t": text,
               "sizePct": self.ctx.sz(round(_int(sz, 0) * scale))
               if sz else 0.0,
               "b": b == "1", "i": i == "1",
               "u": bool(u) and u != "none",
               "strike": bool(strike) and strike != "noStrike",
               "color": "" if ink else color, "font": font}
        if alpha < 1:
            out["op"] = round(alpha, 3)
        if href:
            out["href"] = href
        return out

    def _href(self, hl: ET.Element) -> str:
        rid = hl.get(f"{{{_R}}}id")
        if not rid:
            return ""
        got = self.ctx.pkg.rels(self.slide_part).get(rid)
        if not got or not got[2]:
            return ""
        url = got[1]
        return url if re.match(r"^(https?://|mailto:)", url, re.I) else ""


def _anchor(bp: ET.Element | None, chain_shapes: list) -> str:
    cands = [bp] + [s.find("./p:txBody/a:bodyPr", NS)
                    for s in chain_shapes if s is not None]
    for c in cands:
        if c is not None and c.get("anchor"):
            return {"t": "t", "ctr": "ctr", "b": "b"}.get(
                c.get("anchor") or "", "t")
    return ""


def _link_of(ctx: _Ctx, slide_part: str, cnvpr: ET.Element | None,
             slide_parts: list[str]) -> dict | None:
    """A click action on a whole shape: a web link or a slide jump."""
    if cnvpr is None:
        return None
    hl = cnvpr.find("a:hlinkClick", NS)
    if hl is None:
        return None
    rid = hl.get(f"{{{_R}}}id")
    action = hl.get("action") or ""
    rel = ctx.pkg.rels(slide_part).get(rid or "")
    if "hlinksldjump" in action and rel and not rel[2]:
        if rel[1] in slide_parts:
            return {"to": "slide", "si": slide_parts.index(rel[1])}
        return None
    if rel and rel[2] and re.match(r"^(https?://|mailto:)", rel[1], re.I):
        return {"to": "url", "href": rel[1]}
    return None


# ---------------------------------------------------------------------------
# fills and lines
# ---------------------------------------------------------------------------

def _fill_of(ctx: _Ctx, sppr: ET.Element | None,
             style: ET.Element | None) -> tuple[str, dict | None, float]:
    """(solid hex, gradient, alpha) of a shape's own fill, else its
    theme style's. '' and None mean no fill."""
    if sppr is not None:
        for ch in sppr:
            t = _local(ch.tag)
            if t == "noFill":
                return "", None, 1.0
            if t == "solidFill":
                col, alpha, _ = ctx.color(ch)
                return col, None, alpha
            if t == "gradFill":
                return "", _grad_of(ctx, ch), 1.0
            if t == "blipFill":
                ctx.tally.add("picfill")
                return "", None, 1.0
            if t == "pattFill":
                fg = ch.find("a:fgClr", NS)
                col, alpha, _ = ctx.color(fg)
                return col, None, alpha
    if style is not None:
        ref = style.find("a:fillRef", NS)
        if ref is not None and _int(ref.get("idx")) > 0:
            col, alpha, _ = ctx.color(ref)
            return col, None, alpha
    return "", None, 1.0


def _grad_of(ctx: _Ctx, gf: ET.Element) -> dict | None:
    stops = []
    for gs in gf.findall("./a:gsLst/a:gs", NS):
        col, alpha, _ = ctx.color(gs)
        if col:
            stops.append({"o": round(_int(gs.get("pos")) / 100000, 3),
                          "c": col})
    if len(stops) < 2:
        return None
    lin = gf.find("a:lin", NS)
    path = gf.find("a:path", NS)
    if path is not None and (path.get("path") or "") in ("circle", "rect"):
        return {"type": "radial", "stops": stops, "a": stops[0]["c"],
                "b": stops[-1]["c"]}
    ang = _int(lin.get("ang")) / 60000 if lin is not None else 90
    return {"type": "linear", "ang": round(ang - 90, 1), "stops": stops,
            "a": stops[0]["c"], "b": stops[-1]["c"]}


def _line_of(ctx: _Ctx, sppr: ET.Element | None,
             style: ET.Element | None) -> dict | None:
    """{color, swPct, dash, head, tail, hsz, alpha} of the outline, or
    None when there is none."""
    ln = sppr.find("a:ln", NS) if sppr is not None else None
    if ln is not None:
        if ln.find("a:noFill", NS) is not None:
            return None
        fill = ln.find("a:solidFill", NS)
        col, alpha = "", 1.0
        if fill is not None:
            col, alpha, _ = ctx.color(fill)
        elif ln.find("a:gradFill", NS) is not None:
            g = _grad_of(ctx, ln.find("a:gradFill", NS))  # type: ignore[arg-type]
            col = g["a"] if g else ""
        if not col and style is not None:
            ref = style.find("a:lnRef", NS)
            if ref is not None and _int(ref.get("idx")) > 0:
                col, alpha, _ = ctx.color(ref)
        if not col and fill is None and ln.get("w") is None and (
                style is None or style.find("a:lnRef", NS) is None):
            return None
        w = _int(ln.get("w"), EMU_PER_PT * 3 // 4)
        pd = ln.find("a:prstDash", NS)
        dash = _DASHES.get(pd.get("val") or "solid", "solid") if (
            pd is not None) else "solid"
        head = ln.find("a:headEnd", NS)
        tail = ln.find("a:tailEnd", NS)
        return {"color": col or "#000000", "swPct": ctx.sw(w), "dash": dash,
                "start": _HEADS.get((head.get("type") if head is not None
                                     else "none") or "none", "none"),
                "end": _HEADS.get((tail.get("type") if tail is not None
                                   else "none") or "none", "none"),
                "hsz": _head_size(tail if tail is not None else head),
                "alpha": alpha}
    if style is not None:
        ref = style.find("a:lnRef", NS)
        idx = _int(ref.get("idx")) if ref is not None else 0
        if idx > 0:
            col, alpha, _ = ctx.color(ref)
            w = ctx.theme.lines[idx - 1] if idx - 1 < len(
                ctx.theme.lines) else EMU_PER_PT
            return {"color": col or "#000000", "swPct": ctx.sw(w),
                    "dash": "solid", "start": "none", "end": "none",
                    "hsz": "md", "alpha": alpha}
    return None


def _head_size(end: ET.Element | None) -> str:
    if end is None:
        return "md"
    return {"sm": "sm", "med": "md", "lg": "lg"}.get(end.get("w") or "med",
                                                     "md")


# ---------------------------------------------------------------------------
# one slide
# ---------------------------------------------------------------------------

class _SlideReader:
    def __init__(self, pkg: _Pkg, part: str, master: _Master,
                 layout: _Layout, ctx: _Ctx, slide_parts: list[str],
                 lost: _Tally) -> None:
        self.pkg = pkg
        self.part = part
        self.master = master
        self.layout = layout
        self.ctx = ctx
        self.slide_parts = slide_parts
        self.lost = lost
        self.items: list[dict] = []
        self.spids: dict[int, list[int]] = {}      # cNvPr id -> item idxs
        self.text = _TextReader(ctx, master, layout, part)

    # -- the tree -----------------------------------------------------------

    def read(self, root: ET.Element) -> dict:
        tree = root.find("./p:cSld/p:spTree", NS)
        if tree is not None:
            self._walk(tree, _Xf())
        bg = self._bg(root.find("./p:cSld/p:bg", NS))
        trans = self._trans(root)
        self._timing(root.find("./p:timing", NS))
        name = ""
        csld = root.find("./p:cSld", NS)
        if csld is not None:
            name = csld.get("name") or ""
        return {"bg": bg, "items": self.items, "trans": trans,
                "notes": self._notes(), "name": name}

    def _walk(self, tree: ET.Element, xf: _Xf) -> None:
        for el in tree:
            t = _local(el.tag)
            if t == "AlternateContent":
                fb = el.find("mc:Fallback", {"mc": (
                    "http://schemas.openxmlformats.org/markup-"
                    "compatibility/2006")})
                pick = fb if fb is not None else (
                    el[0] if len(el) else None)
                if pick is not None:
                    self._walk(pick, xf)
            elif t == "grpSp":
                g = _xfrm(el.find("./p:grpSpPr/a:xfrm", NS))
                child = xf
                if g and g["chext"] != (0, 0):
                    child = xf.child((g["x"], g["y"]), (g["w"], g["h"]),
                                     g["choff"], g["chext"])
                self._walk(el, child)
            elif t == "sp":
                self._sp(el, xf)
            elif t == "pic":
                self._pic(el, xf)
            elif t == "cxnSp":
                self._cxn(el, xf)
            elif t == "graphicFrame":
                self._frame(el, xf)

    def _push(self, el: ET.Element, item: dict) -> None:
        cnv = el.find("./*/p:cNvPr", NS)
        spid = _int(cnv.get("id")) if cnv is not None else 0
        if cnv is not None and cnv.get("name") and "name" not in item:
            item["name"] = cnv.get("name")
        if cnv is not None and cnv.get("hidden") == "1":
            self.lost.add("hiddenobj")
            return
        link = _link_of(self.ctx, self.part, cnv, self.slide_parts)
        if link:
            item["link"] = link
        self.spids.setdefault(spid, []).append(len(self.items))
        self.items.append(item)

    # -- shapes ---------------------------------------------------------------

    def _geo(self, el: ET.Element, xf: _Xf, ph: tuple[str, str] | None,
             ) -> tuple[dict | None, list]:
        """The box, from the shape or inherited; and the placeholder
        chain (layout shape, master shape) the text styles read."""
        chain: list = []
        if ph:
            typ, idx = ph
            ls = self.layout.slots.find(typ, idx)
            ms = self.master.slots.find(typ, idx)
            chain = [ls, ms]
        g = _xfrm(el.find("./p:spPr/a:xfrm", NS))
        if g is None:
            g = _xfrm(el.find("./p:xfrm", NS))
        if g is None:
            for c in chain:
                if c is not None:
                    g = _xfrm(c.find("./p:spPr/a:xfrm", NS))
                    if g is not None:
                        break
        if g is None:
            return None, chain
        return _box(self.ctx, xf, g), chain

    def _sp(self, el: ET.Element, xf: _Xf) -> None:
        ph = _ph(el)
        kind = "other"
        if ph:
            kind = _PH_KIND.get(ph[0], "body")
            if kind == "furniture":
                return                      # dates, footers, numbers
        box, chain = self._geo(el, xf, ph)
        if box is None:
            return
        sppr = el.find("p:spPr", NS)
        style = el.find("p:style", NS)
        geom = sppr.find("a:prstGeom", NS) if sppr is not None else None
        prst = (geom.get("prst") or "rect") if geom is not None else ""
        cust = sppr.find("a:custGeom", NS) if sppr is not None else None
        fill, grad, falpha = _fill_of(self.ctx, sppr, style)
        line = _line_of(self.ctx, sppr, style)
        cnvsp = el.find("./p:nvSpPr/p:cNvSpPr", NS)
        txbox = cnvsp is not None and cnvsp.get("txBox") == "1"
        text = self.text.read(el, kind, chain)
        if cust is not None:
            self._freeform(el, box, cust, line, fill, xf)
            if text:
                self._text_item(el, box, text, kind, ph, "", "ctr", True)
            return
        if prst in _LINE_GEOMS:
            self._line_item(el, box, xf, line, prst)
            return
        shape = _SHAPES.get(prst) if prst else "rect"
        if prst and shape is None:
            self.lost.add("shape", prst)
            shape = "rect"
        visible = bool(line) or bool(grad) or (
            bool(fill) and (shape != "rect" or line))
        if visible:
            item: dict[str, Any] = dict(box)
            item.update({"t": "rect", "shape": shape,
                         "color": (line or {}).get("color") or fill
                         or "#000000",
                         "fill": fill, "grad": grad,
                         "swPct": (line or {}).get("swPct", 0),
                         "dash": (line or {}).get("dash", "solid")})
            if not line:
                item["noline"] = 1
            if falpha < 1:
                item["op"] = round(falpha, 3)
            self._push(el, item)
            if text:
                self._text_item(el, box, text, kind, ph, "", "ctr", True)
            return
        if text:
            painted = bool(fill) and not txbox
            self._text_item(el, box, text, kind, ph, fill,
                            "ctr" if painted else ("t" if txbox else ""),
                            painted)

    def _text_item(self, el: ET.Element, box: dict, text: dict, kind: str,
                   ph: tuple[str, str] | None, bgc: str, anchor_default: str,
                   in_shape: bool) -> None:
        paras = text["paras"]
        runs = [r for p in paras for r in p["runs"] if r["t"].strip()]
        first = runs[0] if runs else {"sizePct": 0, "b": False, "i": False,
                                      "color": "", "font": ""}
        sizes = {r["sizePct"] for r in runs if r["sizePct"]}
        if len(sizes) > 1:
            self.lost.add("mixsize")
        if any(p["lvl"] > 0 and p["runs"] for p in paras):
            self.lost.add("levels")
        if sum(1 for r in runs if r.get("href")) > 1:
            self.lost.add("runlink")
        size = first["sizePct"] or (
            self.ctx.sz(4400) if kind == "title" else self.ctx.sz(1800))
        item: dict[str, Any] = dict(box)
        lines = []
        for p in paras:
            lines.append("".join(r["t"] for r in p["runs"]))
        item.update({
            "t": "text", "text": "\n".join(lines), "sizePct": size,
            "color": first["color"], "font": first["font"],
            "b": bool(runs) and all(r["b"] for r in runs),
            "i": bool(runs) and all(r["i"] for r in runs),
            "u": bool(runs) and all(r["u"] for r in runs),
            "strike": bool(runs) and all(r["strike"] for r in runs),
            "align": _box_align(paras, in_shape),
            "bullets": bool(paras) and all(p["bullet"] for p in paras
                                           if p["runs"]),
            "bgc": bgc, "paras": paras,
            "anchor": text["anchor"] or anchor_default,
            "ph": ph[0] if ph else "", "kind": kind})
        if in_shape:
            item["inShape"] = 1
        self._push(el, item)

    def _line_item(self, el: ET.Element, box: dict, xf: _Xf,
                   line: dict | None, prst: str) -> None:
        g = _xfrm(el.find("./p:spPr/a:xfrm", NS))
        if g is None:
            return
        x1, y1 = xf.pt(g["x"], g["y"])
        x2, y2 = xf.pt(g["x"] + g["w"], g["y"] + g["h"])
        if g["flipH"]:
            x1, x2 = x2, x1
        if g["flipV"]:
            y1, y2 = y2, y1
        ln = line or {"color": "#000000", "swPct": self.ctx.sw(EMU_PER_PT),
                      "dash": "solid", "start": "none", "end": "none",
                      "hsz": "md", "alpha": 1.0}
        item: dict[str, Any] = {
            "t": "line", "x1": self.ctx.px(x1), "y1": self.ctx.py(y1),
            "x2": self.ctx.px(x2), "y2": self.ctx.py(y2),
            "color": ln["color"], "swPct": ln["swPct"], "dash": ln["dash"],
            "head": ln["end"], "tail": ln["start"], "hsz": ln["hsz"]}
        if prst.startswith("curvedConnector"):
            item["curve"] = 1
        elif prst.startswith("bentConnector"):
            item["bend"] = 1
        if ln.get("alpha", 1.0) < 1:
            item["op"] = round(ln["alpha"], 3)
        self._push(el, item)

    def _cxn(self, el: ET.Element, xf: _Xf) -> None:
        box, _ = self._geo(el, xf, None)
        if box is None:
            return
        sppr = el.find("p:spPr", NS)
        geom = sppr.find("a:prstGeom", NS) if sppr is not None else None
        prst = (geom.get("prst") or "line") if geom is not None else "line"
        line = _line_of(self.ctx, sppr, el.find("p:style", NS))
        self._line_item(el, box, xf, line, prst)

    def _freeform(self, el: ET.Element, box: dict, cust: ET.Element,
                  line: dict | None, fill: str, xf: _Xf) -> None:
        path = cust.find("./a:pathLst/a:path", NS)
        if path is None:
            return
        g = _xfrm(el.find("./p:spPr/a:xfrm", NS)) or {"w": 1, "h": 1}
        pw = _int(path.get("w")) or g["w"] or 1
        ph = _int(path.get("h")) or g["h"] or 1
        pts: list[list[float]] = []
        curved = False
        for seg in path:
            t = _local(seg.tag)
            if t == "close":
                if pts:
                    pts.append(list(pts[0]))
                continue
            if t in ("cubicBezTo", "quadBezTo", "arcTo"):
                curved = True
            pt_els = seg.findall("a:pt", NS)
            if pt_els:
                last = pt_els[-1]
                pts.append([round(_int(last.get("x")) / pw, 4),
                            round(_int(last.get("y")) / ph, 4)])
        if curved:
            self.lost.add("curve")
        if len(pts) < 2:
            return
        item: dict[str, Any] = dict(box)
        ln = line or {"color": fill or "#000000",
                      "swPct": self.ctx.sw(EMU_PER_PT), "dash": "solid"}
        item.update({"t": "draw", "pts": pts, "color": ln["color"],
                     "swPct": ln["swPct"], "dash": ln["dash"]})
        self._push(el, item)

    # -- pictures -------------------------------------------------------------

    def _pic(self, el: ET.Element, xf: _Xf) -> None:
        ph = _ph(el)
        box, _ = self._geo(el, xf, ph)
        if box is None:
            return
        nvpr = el.find("./p:nvPicPr/p:nvPr", NS)
        clip = None
        if nvpr is not None:
            vf = nvpr.find("a:videoFile", NS)
            af = nvpr.find("a:audioFile", NS)
            mel = vf if vf is not None else af
            if mel is not None:
                clip = self._clip(mel, af is not None)
        blip = el.find("./p:blipFill/a:blip", NS)
        if blip is None:
            return
        rid = blip.get(f"{{{_R}}}embed")
        if not rid:
            if blip.get(f"{{{_R}}}link"):
                self.lost.add("piclink")
            return
        src = self._media(rid)
        if not src and not clip:
            return
        item: dict[str, Any] = dict(box)
        if clip:
            # T321: a clip the browser can play travels whole -- its
            # bytes, its poster and which of the two it is
            item.update({"t": "video", "src": clip["src"],
                         "mime": clip["mime"], "poster": src,
                         "audio": clip["audio"], "clipName": clip["name"]})
        else:
            item.update({"t": "image", "src": src})
        cnv = el.find("./p:nvPicPr/p:cNvPr", NS)
        if cnv is not None and cnv.get("descr"):
            item["alt"] = cnv.get("descr")
        crop = el.find("./p:blipFill/a:srcRect", NS)
        if crop is not None:
            c = {k: round(_int(crop.get(k)) / 1000, 2)
                 for k in ("l", "t", "r", "b")}
            if any(c.values()):
                item["crop"] = c
        am = blip.find("a:alphaModFix", NS)
        if am is not None:
            item["op"] = round(_int(am.get("amt"), 100000) / 100000, 3)
        self._push(el, item)

    def _clip(self, el: ET.Element, audio: bool) -> dict | None:
        """The bytes of a video or audio clip (T321), or None with the
        reason counted. Held to the containers a browser plays, checked
        by their heads where they have one."""
        rid = el.get(f"{{{_R}}}link") or el.get(f"{{{_R}}}embed")
        rel = self.pkg.rels(self.part).get(rid or "")
        if not rel:
            self.lost.add("media")
            return None
        typ, tgt, ext = rel
        if ext or not self.pkg.has(tgt):
            self.lost.add("medialink")
            return None
        suffix = posixpath.splitext(tgt)[1].lower()
        mime = _CLIP_MIME.get(suffix)
        if not mime:
            self.lost.add("mediafmt", suffix.lstrip(".") or "unknown")
            return None
        data = self.pkg.read(tgt)
        ok = True
        if suffix in (".mp4", ".m4v", ".m4a"):
            ok = data[4:8] == b"ftyp"
        elif suffix in (".webm", ".weba"):
            ok = data.startswith(b"\x1a\x45\xdf\xa3")
        elif suffix == ".wav":
            ok = data.startswith(b"RIFF")
        elif suffix in (".ogg", ".oga", ".ogv"):
            ok = data.startswith(b"OggS")
        elif suffix == ".mp3":
            ok = data.startswith(b"ID3") or data[:1] == b"\xff"
        if not ok:
            self.lost.add("mediafmt", suffix.lstrip("."))
            return None
        return {"src": f"data:{mime};base64,"
                       + base64.b64encode(data).decode("ascii"),
                "mime": mime, "audio": audio,
                "name": posixpath.basename(tgt)}

    def _media(self, rid: str) -> str:
        rel = self.pkg.rels(self.part).get(rid)
        if not rel:
            return ""
        typ, tgt, ext = rel
        if ext:
            self.lost.add("piclink")
            return ""
        suffix = posixpath.splitext(tgt)[1].lower()
        if suffix in _METAFILES:
            self.lost.add("metafile")
            return ""
        mime = IMG_MIME.get(suffix)
        if not mime:
            self.lost.add("picfmt", suffix.lstrip(".") or "unknown")
            return ""
        if not self.pkg.has(tgt):
            self.lost.add("piclink")
            return ""
        data = self.pkg.read(tgt)
        if len(data) > EMBED_CAP:
            self.lost.add("picbig")
            return ""
        heads = _MAGIC.get(mime)
        if heads and not any(data.startswith(h) for h in heads):
            self.lost.add("picbad")
            return ""
        if mime == "image/svg+xml":
            try:
                if b"<!DOCTYPE" in data or b"<!ENTITY" in data:
                    raise ValueError("DOCTYPE")
                ET.fromstring(data)
            except (ET.ParseError, ValueError):
                self.lost.add("picbad")
                return ""
        return f"data:{mime};base64," + base64.b64encode(data).decode(
            "ascii")

    # -- graphic frames: tables, charts, SmartArt, OLE ------------------------

    def _frame(self, el: ET.Element, xf: _Xf) -> None:
        ph = _ph(el)
        box, _ = self._geo(el, xf, ph)
        if box is None:
            return
        gd = el.find("./a:graphic/a:graphicData", NS)
        if gd is None:
            return
        uri = gd.get("uri") or ""
        if uri.endswith("/table"):
            tbl = gd.find("a:tbl", NS)
            if tbl is not None:
                self._table(el, box, tbl)
        elif uri.endswith("/chart"):
            ch = gd.find("c:chart", NS)
            rid = ch.get(f"{{{_R}}}id") if ch is not None else None
            part = self.pkg.target(self.part, rid)
            if part:
                self._chart(el, box, part)
        elif uri.endswith("/diagram"):
            self._smartart(el, box, gd)
        elif "ole" in uri.lower() or uri.endswith("/presentationml/2006/ole"):
            self.lost.add("ole")
        else:
            self.lost.add("ole")

    def _table(self, el: ET.Element, box: dict, tbl: ET.Element) -> None:
        pr = tbl.find("a:tblPr", NS)
        widths = [_int(gc.get("w")) for gc in tbl.findall(
            "./a:tblGrid/a:gridCol", NS)]
        rows: list[list[str]] = []
        size, color = 0.0, ""
        for tr in tbl.findall("a:tr", NS):
            row = []
            for tc in tr.findall("a:tc", NS):
                if tc.get("gridSpan") or tc.get("rowSpan") or (
                        tc.get("hMerge") or tc.get("vMerge")):
                    self.lost.add("merged")
                if tc.get("hMerge") == "1" or tc.get("vMerge") == "1":
                    row.append("")
                    continue
                text = self.text.read(tc, "other", [],
                                      tc.find("a:txBody", NS))
                cell = ""
                if text:
                    cell = "\n".join("".join(r["t"] for r in p["runs"])
                                     for p in text["paras"])
                    runs = [r for p in text["paras"] for r in p["runs"]
                            if r["t"].strip()]
                    if runs and not size and runs[0]["sizePct"]:
                        size = runs[0]["sizePct"]
                    if runs and not color:
                        color = runs[0]["color"]
                row.append(cell)
                span = _int(tc.get("gridSpan"), 1)
                for _ in range(span - 1):
                    row.append("")
            if row:
                rows.append(row)
        if not rows:
            return
        n = max(len(r) for r in rows)
        rows = [r + [""] * (n - len(r)) for r in rows]
        total = sum(widths) or 1
        cols = [round(w / total * 100, 2) for w in widths] if (
            len(widths) == n) else []
        item: dict[str, Any] = dict(box)
        item.update({"t": "table", "rows": rows, "cols": cols,
                     "thead": (pr.get("firstRow") == "1") if pr is not None
                     else False,
                     "grid": 1, "sizePct": size or self.ctx.sz(1400),
                     "color": color})
        self._push(el, item)

    def _chart(self, el: ET.Element, box: dict, part: str) -> None:
        root = self.pkg.xml(part)
        if root is None:
            return
        plot = root.find("./c:chart/c:plotArea", NS)
        if plot is None:
            return
        kinds = {"barChart": "bar", "bar3DChart": "bar", "lineChart": "line",
                 "line3DChart": "line", "scatterChart": "scatter",
                 "pieChart": "pie", "pie3DChart": "pie",
                 "doughnutChart": "pie", "areaChart": "line",
                 "area3DChart": "line"}
        ct, node = "", None
        for ch in plot:
            t = _local(ch.tag)
            if t.endswith("Chart"):
                if t in kinds:
                    ct, node = kinds[t], ch
                    break
                self.lost.add("chartkind", t.replace("Chart", ""))
                return
        if node is None:
            return
        cats: list[str] = []
        series = []
        for si, ser in enumerate(node.findall("c:ser", NS)):
            name = _chart_text(ser.find("c:tx", NS)) or f"Series {si + 1}"
            cat = ser.find("c:cat", NS)
            if cat is None:
                cat = ser.find("c:xVal", NS)
            val = ser.find("c:val", NS)
            if val is None:
                val = ser.find("c:yVal", NS)
            c = _chart_pts(cat)
            ys = _chart_pts(val)
            if not ys:
                continue
            if len(c) > len(cats):
                cats = c
            color = ""
            sppr = ser.find("c:spPr", NS)
            if sppr is not None:
                fill = sppr.find("a:solidFill", NS)
                if fill is None:
                    ln = sppr.find("a:ln", NS)
                    fill = ln.find("a:solidFill", NS) if ln is not None else None
                if fill is not None:
                    color = self.ctx.color(fill)[0]
            se: dict[str, Any] = {"name": name,
                                  "ys": [_num(v) for v in ys]}
            if color:
                se["color"] = color
            series.append(se)
        if not series:
            self.lost.add("chartcache")
            return
        title = _chart_text(root.find("./c:chart/c:title/c:tx", NS))
        item: dict[str, Any] = dict(box)
        item.update({"t": "chart", "ct": ct, "cats": cats, "series": series,
                     "title": title,
                     "leg": root.find("./c:chart/c:legend", NS) is not None})
        self._push(el, item)

    def _smartart(self, el: ET.Element, box: dict, gd: ET.Element) -> None:
        ids = gd.find("dgm:relIds", NS)
        part = self.pkg.target(self.part, ids.get(f"{{{_R}}}dm")
                               if ids is not None else None)
        root = self.pkg.xml(part) if part else None
        self.lost.add("smartart")
        if root is None:
            return
        lines = []
        for pt in root.iter(f"{{{_DGM}}}pt"):
            if (pt.get("type") or "node") not in ("node", "asst", ""):
                continue
            words = " ".join(
                (t.text or "") for t in pt.iter(f"{{{_A}}}t")).strip()
            if words:
                lines.append(words)
        if not lines:
            return
        item: dict[str, Any] = dict(box)
        item.update({"t": "text", "text": "\n".join(lines),
                     "sizePct": self.ctx.sz(1800), "color": "", "font": "",
                     "b": False, "i": False, "u": False, "strike": False,
                     "align": "", "bullets": True, "bgc": "",
                     "paras": [{"lvl": 0, "align": "", "bullet": True,
                                "num": False,
                                "runs": [{"t": ln, "sizePct": 0,
                                          "b": False, "i": False,
                                          "u": False, "strike": False,
                                          "color": "", "font": ""}]}
                               for ln in lines],
                     "anchor": "t", "ph": "", "kind": "body"})
        self._push(el, item)

    # -- the slide's own furniture --------------------------------------------

    def _bg(self, bg: ET.Element | None) -> str:
        if bg is None:
            return ""
        pr = bg.find("p:bgPr", NS)
        if pr is not None:
            col, grad, _ = _fill_of(self.ctx, pr, None)
            if col:
                return col
            if grad:
                return grad["a"]
            return ""
        ref = bg.find("p:bgRef", NS)
        if ref is not None:
            return self.ctx.color(ref)[0]
        return ""

    def _trans(self, root: ET.Element) -> str:
        tr = root.find("./p:transition", NS)
        if tr is None:
            for ac in root:
                if _local(ac.tag) == "AlternateContent":
                    for choice in ac:
                        got = choice.find("p:transition", NS)
                        if got is not None:
                            tr = got
                    if tr is not None:
                        # a morph in the Choice branch is the editor's
                        # own "move" transition
                        for choice in ac:
                            for t2 in choice.iter():
                                if _local(t2.tag) == "morph":
                                    return "move"
                        break
        if tr is None:
            return ""
        kinds = [_local(ch.tag) for ch in tr
                 if _local(ch.tag) not in ("sndAc", "extLst")]
        if not kinds:
            return ""
        k = kinds[0]
        if k == "fade":
            return "fade"
        if k == "morph":
            return "move"
        self.lost.add("trans", k)
        return "fade"

    def _notes(self) -> str:
        part = None
        for typ, tgt, ext in self.pkg.rels(self.part).values():
            if typ == "notesSlide" and not ext:
                part = tgt
        root = self.pkg.xml(part) if part else None
        if root is None:
            return ""
        body = None
        tree = root.find("./p:cSld/p:spTree", NS)
        for sp in (tree if tree is not None else []):
            if _local(sp.tag) != "sp":
                continue
            ph = _ph(sp)
            if ph and ph[0] == "body":
                body = sp
                break
        bodies = [body] if body is not None else [
            sp for sp in (tree if tree is not None else [])
            if _local(sp.tag) == "sp"
            and (_ph(sp) or ("", ""))[0] not in ("sldNum", "sldImg", "hdr",
                                                 "ftr", "dt")]
        out = []
        for b in bodies:
            for p in b.findall("./p:txBody/a:p", NS):
                out.append("".join(_run_text(r) for r in p
                                   if _local(r.tag) in ("r", "fld")))
        return "\n".join(out).strip()

    # -- timing: which click each shape arrives on ----------------------------

    def _timing(self, timing: ET.Element | None) -> None:
        if timing is None:
            return
        seq: ET.Element | None = None
        for node in timing.iter(f"{{{_P}}}cTn"):
            if node.get("nodeType") == "mainSeq":
                seq = node
                break
        if seq is None:
            return
        kids = seq.find("p:childTnLst", NS)
        if kids is None:
            return
        step = -1
        started: set[int] = set()
        for grp in kids:
            ctn = grp.find("p:cTn", NS)
            if ctn is None:
                continue
            cond = ctn.find("./p:stCondLst/p:cond", NS)
            delay = (cond.get("delay") if cond is not None else "") or ""
            ntype = ctn.get("nodeType") or ""
            effects = self._effects(ctn)
            if not effects:
                continue
            # a paragraph continuation of a shape already building is
            # the same build in the editor's model (by:'para'), and it
            # claims no click of its own
            fresh = [e for e in effects
                     if not (e["para"] >= 0 and e["spid"] in started)]
            if ntype == "withGroup" and step >= 0:
                pass
            elif fresh or step < 0:
                step += 1
            after = 0
            if delay not in ("", "indefinite") and ntype != "withGroup":
                after = max(1, round(_int(delay) / 1000))
            for e in effects:
                for idx in self.spids.get(e["spid"], []):
                    it = self.items[idx]
                    if e["cls"] == "exit":
                        it.setdefault("outStep", step)
                        continue
                    if e["cls"] != "entr":
                        continue
                    if e["spid"] in started:
                        if e["para"] >= 0:
                            it["animBy"] = "para"
                        continue
                    it["animStep"] = step
                    it["animType"] = e["type"]
                    if e["para"] >= 0:
                        it["animBy"] = "para"
                    if after and step > 0:
                        it["after"] = after
                started.add(e["spid"])

    def _effects(self, ctn: ET.Element) -> list[dict]:
        out = []
        for c in ctn.iter(f"{{{_P}}}cTn"):
            cls = c.get("presetClass") or ""
            if not cls:
                continue
            tgt = c.find(".//p:spTgt", NS)
            if tgt is None:
                continue
            pid = _int(c.get("presetID"))
            if cls == "entr":
                typ = _ENTRANCES.get(pid)
                if typ is None:
                    self.lost.add("anim")
                    typ = "fade"
            elif cls == "exit":
                typ = "exit"
            else:
                self.lost.add("emph")
                continue
            rng = tgt.find("./p:txEl/p:pRange", NS)
            out.append({"spid": _int(tgt.get("spid")), "cls": cls,
                        "type": typ,
                        "para": _int(rng.get("st")) if rng is not None
                        else -1})
        return out


def _box_align(paras: list[dict], in_shape: bool) -> str:
    aligns = [p["align"] for p in paras if p["runs"] and p["align"]]
    if aligns:
        return aligns[0]
    return "center" if in_shape else ""


def _chart_text(tx: ET.Element | None) -> str:
    if tx is None:
        return ""
    v = tx.find(".//c:v", NS)
    if v is not None and v.text:
        return v.text
    return "".join((t.text or "") for t in tx.iter(f"{{{_A}}}t")).strip()


def _chart_pts(ref: ET.Element | None) -> list[str]:
    if ref is None:
        return []
    pts: dict[int, str] = {}
    for pt in ref.iter(f"{{{_C}}}pt"):
        v = pt.find("c:v", NS)
        pts[_int(pt.get("idx"))] = (v.text or "") if v is not None else ""
    if not pts:
        lit = ref.find(".//c:numLit", NS)
        if lit is None:
            lit = ref.find(".//c:strLit", NS)
        if lit is not None:
            for pt in lit.iter(f"{{{_C}}}pt"):
                v = pt.find("c:v", NS)
                pts[_int(pt.get("idx"))] = (v.text or "") if (
                    v is not None) else ""
    if not pts:
        return []
    n = max(pts) + 1
    return [pts.get(i, "") for i in range(n)]


def _num(v: str) -> float:
    try:
        f = float(v)
    except (TypeError, ValueError):
        return 0.0
    return f if f == f and abs(f) != float("inf") else 0.0


# ---------------------------------------------------------------------------
# the deck
# ---------------------------------------------------------------------------

def read_pptx(data: bytes, name: str = "") -> dict:
    """A .pptx's bytes -> ``{"spec": ..., "lost": [...]}``.

    ``spec`` is the shape ``JunoPptx.build`` takes: page size in mm,
    a deck background, and per slide a background, items in percent of
    the page, a transition, speaker notes and a section name. ``lost``
    lists, in words, what the file held that the spec does not.
    """
    pkg = _Pkg(data)
    lost = _Tally()
    pres = pkg.xml("ppt/presentation.xml")
    if pres is None:
        raise ValueError("not a PowerPoint file (presentation.xml is "
                         "empty)")
    sz = pres.find("p:sldSz", NS)
    w = _int(sz.get("cx"), 12192000) if sz is not None else 12192000
    h = _int(sz.get("cy"), 6858000) if sz is not None else 6858000
    prels = pkg.rels("ppt/presentation.xml")
    masters: dict[str, _Master] = {}
    layouts: dict[str, _Layout] = {}

    def master_of(layout_part: str) -> tuple[_Master, _Layout]:
        if layout_part in layouts:
            lay = layouts[layout_part]
            return lay.master, lay
        mpart = None
        for typ, tgt, ext in pkg.rels(layout_part).values():
            if typ == "slideMaster" and not ext:
                mpart = tgt
        if mpart is None:
            mpart = next((tgt for typ, tgt, ext in prels.values()
                          if typ == "slideMaster" and not ext), "")
        if mpart not in masters:
            masters[mpart] = _Master(pkg, mpart)
        lay = _Layout(pkg, layout_part, masters[mpart])
        layouts[layout_part] = lay
        return lay.master, lay

    # slides in show order, from sldIdLst; hidden ones ride along
    slide_parts: list[str] = []
    slide_ids: list[str] = []
    for sid in pres.findall("./p:sldIdLst/p:sldId", NS):
        rid = sid.get(f"{{{_R}}}id")
        tgt = pkg.target("ppt/presentation.xml", rid)
        if tgt and pkg.has(tgt):
            slide_parts.append(tgt)
            slide_ids.append(sid.get("id") or "")
    if not slide_parts:
        raise ValueError("this PowerPoint file has no slides")

    # sections, from the 2010 extension every recent PowerPoint writes
    section_of: dict[str, str] = {}
    for sec in pres.iter(f"{{{_P14}}}section"):
        nm = sec.get("name") or ""
        for sid in sec.iter(f"{{{_P14}}}sldId"):
            section_of[sid.get("id") or ""] = nm

    deck_bg = ""
    slides = []
    for i, part in enumerate(slide_parts):
        root = pkg.xml(part)
        if root is None:
            continue
        lpart = next((tgt for typ, tgt, ext in pkg.rels(part).values()
                      if typ == "slideLayout" and not ext), "")
        master, layout = master_of(lpart)
        ctx = _Ctx(pkg, master.theme, master.clrmap, w, h, lost)
        if not deck_bg:
            mbg = master.root.find("./p:cSld/p:bg", NS) if (
                master.root is not None) else None
            if mbg is not None:
                deck_bg = _SlideReader(pkg, part, master, layout, ctx,
                                       slide_parts, lost)._bg(mbg)
        rd = _SlideReader(pkg, part, master, layout, ctx, slide_parts, lost)
        sl = rd.read(root)
        if not sl["bg"]:
            lbg = layout.root.find("./p:cSld/p:bg", NS) if (
                layout.root is not None) else None
            if lbg is not None:
                sl["bg"] = rd._bg(lbg)
        if root.get("show") == "0":
            sl["hidden"] = True
            lost.add("hidden")
        sl["section"] = section_of.get(slide_ids[i], "")
        slides.append(sl)

    stem = re.sub(r"\.[A-Za-z0-9]+$", "", posixpath.basename(
        str(name or "").replace("\\", "/"))) or "presentation"
    spec = {"title": stem, "widthMm": round(w / EMU_PER_MM, 1),
            "heightMm": round(h / EMU_PER_MM, 1),
            "bg": deck_bg or "#ffffff", "slides": slides}
    return {"spec": spec, "lost": lost.render()}


def read_pptx_b64(name: str, b64: str) -> dict:
    """The transport for a file the BROWSER holds -- picked, dropped or
    fetched -- as its name plus base64. The app's ``/api/importpptx``
    and the web build's ``semPy.importPptx`` both come through here, so
    the two doors cannot disagree about what a .pptx is."""
    nm = str(name or "").strip()
    if not is_pptx_name(nm):
        raise ValueError(f"{nm or 'that file'} is not a PowerPoint file "
                         "(.pptx)")
    raw = str(b64 or "")
    if len(raw) > PPTX_CAP * 4 // 3 + 4:
        raise ValueError(f"{nm} is over the {PPTX_CAP // (1024 * 1024)} MB "
                         "this will read")
    try:
        data = base64.b64decode(raw)
    except (ValueError, binascii.Error) as e:
        raise ValueError("the upload was not valid base64") from e
    got = read_pptx(data, nm)
    return {"name": nm, "spec": got["spec"], "lost": got["lost"]}
