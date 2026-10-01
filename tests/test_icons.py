"""T560: Icons.

Images > Icons inserts a simple line icon as a SHAPE (k:'rect',
shape:'ic-NAME'), so it recolours, resizes, rotates, flips and exports
like any shape. The icons are data on a 24-unit grid, drawn as one SVG
path on the slide and as a custGeom in the .pptx.
"""
from __future__ import annotations

import io
import json
import re
import subprocess
import tempfile
import zipfile
from pathlib import Path

import pytest

from helpers_js import build_pptx, js_engine, lift_fn
from junoview import assets


def _icons_js():
    return assets.load("js/deck/12-icons.js")


def _icons():
    js = _icons_js()
    body = js.split("var LINE_ICONS=")[1].split("];")[0] + "]"
    return json.loads(body.replace("'", '"'))


def test_it_is_a_deck_part():
    assert "12-icons" in assets.DECK_PARTS
    assert assets.DECK_PARTS.index("12-icons") \
        > assets.DECK_PARTS.index("11-autodeck")


def test_the_icons_are_well_formed():
    icons = _icons()
    assert len(icons) >= 40
    ids = [ic[0] for ic in icons]
    assert len(ids) == len(set(ids))
    for ic in icons:
        assert len(ic) == 4 and ic[1] and ic[2], ic[0]
        for part in ic[3]:
            kind = part[0]
            assert kind in ("l", "c", "e"), (ic[0], part)
            nums = part[1] if kind == "l" else part[1:]
            if kind == "l":
                assert len(nums) >= 4 and len(nums) % 2 == 0, (ic[0], part)
            elif kind == "c":
                assert len(nums) == 3, (ic[0], part)
            else:
                assert len(nums) in (4, 6), (ic[0], part)
            for v in (nums if kind == "l" else nums[:2]):
                assert -0.5 <= v <= 24.5, (ic[0], part)


@pytest.mark.skipif(js_engine() is None, reason="no JS engine")
def test_every_icon_draws_a_path():
    js = _icons_js()
    lit = "var LINE_ICONS=" + js.split("var LINE_ICONS=")[1].split("];")[0] \
        + "];"
    src = "\n".join([lit] + [lift_fn(js, n) for n in
                             ("lineIcon", "icPt", "icN", "lineIconD")])
    src += ("\nconsole.log(JSON.stringify(LINE_ICONS.map(function(ic){"
            "return [ic[0],lineIconD(lineIcon('ic-'+ic[0])[3])];})"
            ".concat([lineIcon('rect'),lineIcon('ic-nope')])));")
    cmd, env = js_engine()
    with tempfile.TemporaryDirectory() as d:
        p = Path(d) / "run.js"
        p.write_text(src, encoding="utf-8")
        r = subprocess.run(cmd + [str(p)], capture_output=True, text=True,
                           env=env, timeout=60)
    assert r.returncode == 0, r.stderr[:2000]
    out = json.loads([ln for ln in r.stdout.splitlines()
                      if ln.startswith("[")][-1])
    assert out[-2:] == [None, None]
    for name, d in out[:-2]:
        assert d.startswith("M"), name
        assert "NaN" not in d and "undefined" not in d, name
    circle = dict(out[:-2])["info"]
    assert "A" in circle and circle.endswith("Z")


def test_the_slide_draws_it_in_proportion():
    js = assets.load("js/deck/10-decks.js")
    body = js.split("var licon=(typeof lineIcon==='function')"
                    "?lineIcon(shp):null;")[1].split("if(SHAPE_GLYPH[shp]){")[0]
    assert "svg.setAttribute('viewBox','0 0 24 24');" in body
    assert "svg.setAttribute('preserveAspectRatio','xMidYMid meet');" in body
    assert "ip.setAttribute('d',lineIconD(licon[3]));" in body
    assert "ip.setAttribute('vector-effect','non-scaling-stroke');" in body
    assert "if(dash) ip.setAttribute('stroke-dasharray',dash);" in body
    rend = assets.load("js/deck/20-notes-and-tables.js")
    assert "||(typeof lineIcon==='function'&&lineIcon(shp)));   /* T560 */" \
        in rend


def test_the_gallery_sits_beside_shapes_and_arms_the_shape_tool():
    html = assets.load("html/deck.html")
    assert html.index('class="rbn-grp rbn-shapes') \
        < html.index('class="rbn-grp rbn-icons') \
        < html.index('class="rbn-grp rbn-draw"')
    for i in ("icon-strip-frame", "icon-strip", "icon-strip-prev",
              "icon-strip-next", "icon-strip-more"):
        assert f'id="{i}"' in html, i
    css = assets.load("css/deck.css")
    assert ".rbn-icons{order:6;}" in css
    js = assets.load("js/deck/55-sections-and-strip.js")
    body = js.split("function iconStripBoot(){")[1].split(
        "\n  function shapeStripBoot(){")[0]
    assert "b.dataset.shape='ic-'+ic[0];" in body
    assert "b.dataset.find=ic[1]+' '+ic[2];" in body
    assert "pendingShape=b.dataset.shape;" in body
    assert "setTool('rect');" in body
    assert "iconStripBoot();" in assets.load("js/deck/99-boot.js")
    sel = assets.load("js/deck/25-selecting.js")
    assert "if(typeof iconStripSync==='function') iconStripSync();" in sel
    # every layout that shows the shapes shows the icons beside them
    lay = assets.load("js/deck/07-ribbon-layouts.js")
    assert lay.count("'shape-strip-frame'") \
        == lay.count("'shape-strip-frame','icon-strip-frame'")


def test_it_is_drawn_square_and_a_click_drops_one():
    sel = assets.load("js/deck/25-selecting.js")
    assert "var square=(a.k==='rect'&&!!a.lockar);" in sel
    assert "var side=Math.max(Math.abs(dxp),Math.abs(dyp));" in sel
    assert "} else if(tiny&&square){" in sel
    assert "lockar:(typeof lineIcon==='function'&&lineIcon(pendingShape))" \
        in sel


def test_search_finds_them_by_their_words():
    js = assets.load("js/deck/58-command-search.js")
    assert "+(CMD_ALIASES[b.id]||'')+' '+((b.dataset&&b.dataset.find)||''))" \
        in js
    bulb = [ic for ic in _icons() if ic[0] == "bulb"][0]
    assert "lightbulb" in bulb[2]


def test_export_hands_the_writer_the_parts_in_a_square():
    js = assets.load("js/deck/60-saving-and-export.js")
    assert "var side=Math.min(wmm,hmm);" in js
    assert "icon:lic?lic[3]:null});" in js
    assert "op:a.op,color:lineCol,fill:lic&&!a.fill?'':fillCol," in js


@pytest.mark.skipif(js_engine() is None, reason="no JS engine")
def test_the_pptx_draws_it_as_a_freeform():
    icons = {ic[0]: ic[3] for ic in _icons()}

    def item(name, **kw):
        it = {"t": "rect", "x": 10, "y": 10, "w": 20, "h": 35.5,
              "color": "#2266cc", "fill": "", "swPct": 0.5,
              "shape": "ic-" + name, "icon": icons[name]}
        it.update(kw)
        return it
    spec = {"title": "t", "widthMm": 339, "heightMm": 191, "slides": [
        {"bg": "#ffffff", "items": [
            item("info"),
            item("heart", fill="#f5b7b1"),
            item("cycle")]}]}
    data, _ = build_pptx(spec)
    xml = zipfile.ZipFile(io.BytesIO(data)).read(
        "ppt/slides/slide1.xml").decode("utf-8")
    sps = re.findall(r"<p:sp>.*?</p:sp>", xml, re.S)
    assert len(sps) == 3
    info, heart, cyc = sps
    assert '<a:path w="24000" h="24000" fill="none">' in info
    # a circle is two half arcs, never one 360-degree one
    assert info.count('swAng="10800000"') >= 2
    assert '<a:noFill/>' in info and '<a:ln cap="rnd" w=' in info
    assert '<a:round/></a:ln>' in info
    # a filled icon fills its path
    assert '<a:path w="24000" h="24000">' in heart
    assert '<a:solidFill><a:srgbClr val="F5B7B1"' in heart
    # a partial arc: from -20 degrees, 290 of sweep, in halves
    assert 'stAng="-1200000" swAng="10800000"' in cyc
    assert cyc.count("<a:arcTo") == 2


def test_the_format_and_help_say_so():
    fmt = (Path(__file__).resolve().parent.parent / "DECK-FORMAT.md") \
        .read_text(encoding="utf-8")
    assert "or a line icon, `ic-NAME`" in fmt
    help_ = assets.load("html/help.html")
    assert "<li><b>Icons.</b> <i>Images &rarr; Icons</i>" in help_
