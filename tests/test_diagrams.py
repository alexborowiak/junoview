"""Process, cycle, list and hierarchy diagrams as ordinary objects (T561).

Images > Draw > Diagram opens a small dialog: four kinds, the steps typed
one to a line (indent a line to put it under the one above), and a
preview drawn by the same layout Insert uses. What lands on the slide is
ordinary: a text box per step (a fill, an accent edge, a height it keeps,
its words in the middle and shrunk to fit) and an arrow between steps
with both ends attached, all in one named group -- one undo step. The
layout is a pure function of the steps and the page's shape, so it is
tested here under node, as are the boxes and arrows it becomes.
"""

from __future__ import annotations

import io
import json
import subprocess
import tempfile
import zipfile
from pathlib import Path

import pytest

from helpers_js import build_pptx, js_engine, lift_fn
from junoview import assets

_PURE = ("diagClamp", "diagR", "diagParse", "diagLayout", "diagNodeAnnot",
         "diagLinkAnnot")


def _run(body: str) -> object:
    eng = js_engine()
    if eng is None:
        pytest.skip("no JS engine")
    cmd, env = eng
    js = assets.deck_js()
    src = ("var DIAG_REGION={x:8,y:24,w:84,h:64};var SW_DEFAULT=3;\n"
           + "\n".join(lift_fn(js, n) for n in _PURE) + "\n" + body)
    with tempfile.TemporaryDirectory() as d:
        p = Path(d) / "t.js"
        p.write_text(src, encoding="utf-8", newline="\n")
        r = subprocess.run(cmd + [str(p)], capture_output=True, text=True,
                           env=env, timeout=60)
    assert r.returncode == 0, r.stderr[:2000]
    return json.loads(r.stdout.strip().splitlines()[-1])


def _overlap(a: dict, b: dict) -> bool:
    return (a["x"] < b["x"] + b["w"] and b["x"] < a["x"] + a["w"]
            and a["y"] < b["y"] + b["h"] and b["y"] < a["y"] + a["h"])


def _inside(n: dict, region=(8, 24, 84, 64)) -> bool:
    x, y, w, h = region
    eps = 0.05
    return (n["x"] >= x - eps and n["y"] >= y - eps
            and n["x"] + n["w"] <= x + w + eps
            and n["y"] + n["h"] <= y + h + eps)


def test_the_door_the_dialog_and_every_layout():
    assert "36-diagrams" in assets.DECK_PARTS
    html = assets.load("html/deck.html")
    draw = html.split('data-tab="images" data-fold-ic="pen">', 1)[1]
    draw = draw.split('<span class="rbn-lab">', 1)[0]
    assert 'id="dc-diagram"' in draw
    assert '<i data-ic="diagram"></i><span>Diagram</span></button>' in draw
    for i in ("dgm-dlg", "dgm-kinds", "dgm-text", "dgm-preview",
              "dgm-count", "dgm-cancel", "dgm-insert", "dgm-close"):
        assert f'id="{i}"' in html, i
    js = assets.deck_js()
    # Esc cancels and Ctrl+Enter inserts, like every dialog (T568)
    assert "'#nt-dlg,#dgm-dlg,#chart-data'" in js
    assert "    diagramBoot();" in js.split("function initEditorTools(){")[1]
    layouts = assets.load("js/deck/07-ribbon-layouts.js")
    assert layouts.count("'icon-strip-frame','dc-diagram'") == 8
    assert "'dc-diagram':'smartart diagram process cycle" in js
    from junoview import branding
    assert "diagram" in branding._ICON_PATHS


def test_the_steps_are_read_one_to_a_line():
    got = _run(
        "console.log(JSON.stringify(["
        "diagParse('Plan\\n\\n  - Build\\n\\t\\tTest\\n\\u2022 Ship  '),"
        "diagParse('A\\n      B\\nC')]));")
    first, second = got
    assert first == [{"text": "Plan", "lvl": 0}, {"text": "Build", "lvl": 1},
                     {"text": "Test", "lvl": 2}, {"text": "Ship", "lvl": 0}]
    # never deeper than one under the line above
    assert second == [{"text": "A", "lvl": 0}, {"text": "B", "lvl": 1},
                      {"text": "C", "lvl": 0}]


def test_a_process_is_a_row_with_an_arrow_between_each_pair():
    L = _run("var it=diagParse('a\\nb\\nc\\nd\\ne');"
             "console.log(JSON.stringify(diagLayout('process',it,16/9)));")
    nodes, links = L["nodes"], L["links"]
    assert [n["text"] for n in nodes] == list("abcde")
    assert len({(n["w"], n["h"], n["y"]) for n in nodes}) == 1
    xs = [n["x"] for n in nodes]
    assert xs == sorted(xs)
    assert all(_inside(n) for n in nodes)
    assert not any(_overlap(a, b) for i, a in enumerate(nodes)
                   for b in nodes[i + 1:])
    assert links == [{"a": i, "b": i + 1} for i in range(4)]


def test_a_cycle_goes_clockwise_from_the_top_and_bows_out():
    L = _run("var it=diagParse('a\\nb\\nc\\nd');"
             "console.log(JSON.stringify(diagLayout('cycle',it,16/9)));")
    nodes, links = L["nodes"], L["links"]
    top, right, foot, left = nodes
    cx = lambda n: n["x"] + n["w"] / 2  # noqa: E731
    cy = lambda n: n["y"] + n["h"] / 2  # noqa: E731
    assert cy(top) < cy(right) < cy(foot)
    assert cx(right) > cx(top) > cx(left)
    assert abs(cx(top) - cx(foot)) < 0.01
    assert all(_inside(n) for n in nodes)
    assert not any(_overlap(a, b) for i, a in enumerate(nodes)
                   for b in nodes[i + 1:])
    assert [(k["a"], k["b"]) for k in links] == [(0, 1), (1, 2), (2, 3),
                                                  (3, 0)]
    # negative: to the right of travel, which going clockwise is outward
    assert all(k["curve"] < 0 for k in links)


def test_two_steps_make_one_round_and_one_step_has_no_arrow():
    two, one = _run(
        "console.log(JSON.stringify(["
        "diagLayout('cycle',diagParse('a\\nb'),16/9),"
        "diagLayout('cycle',diagParse('a'),16/9)]));")
    assert [(k["a"], k["b"]) for k in two["links"]] == [(0, 1), (1, 0)]
    assert one["links"] == [] and len(one["nodes"]) == 1


def test_a_list_indents_its_sub_points():
    L = _run("var it=diagParse('a\\n  a1\\nb');"
             "console.log(JSON.stringify(diagLayout('list',it,16/9)));")
    a, a1, b = L["nodes"]
    assert L["links"] == []
    assert a1["x"] > a["x"] and a1["x"] + a1["w"] == pytest.approx(
        a["x"] + a["w"])
    assert a["y"] < a1["y"] < b["y"]
    assert a["x"] == b["x"] and a1["lvl"] == 1


def test_a_hierarchy_puts_a_parent_over_its_children():
    L = _run("var it=diagParse('r\\n  a\\n    a1\\n    a2\\n  b\\n    b1');"
             "console.log(JSON.stringify(diagLayout('hierarchy',it,16/9)));")
    n, links = L["nodes"], L["links"]
    names = [x["text"] for x in n]
    assert names == ["r", "a", "a1", "a2", "b", "b1"]
    cx = [x["x"] + x["w"] / 2 for x in n]
    # a sits over the middle of a1 and a2; r over the middle of a and b
    assert cx[1] == pytest.approx((cx[2] + cx[3]) / 2)
    assert cx[0] == pytest.approx((cx[1] + cx[4]) / 2)
    # one row per level, top to bottom
    assert n[0]["y"] < n[1]["y"] == n[4]["y"] < n[2]["y"] == n[5]["y"]
    assert sorted((k["a"], k["b"]) for k in links) == [
        (0, 1), (0, 4), (1, 2), (1, 3), (4, 5)]
    assert all(k == {"a": k["a"], "b": k["b"], "bend": "v", "nohead": 1}
               for k in links)
    assert all(_inside(x) for x in n)
    assert not any(_overlap(a, b) for i, a in enumerate(n)
                   for b in n[i + 1:])


def test_fifteen_steps_still_fit_the_region():
    rows = "\\n".join(["top"] + [f"  b{i}\\n    c{i}\\n    d{i}"
                                 for i in range(4)] + ["  e", "  f"])
    L = _run("var it=diagParse('" + rows + "');"
             "console.log(JSON.stringify(diagLayout('hierarchy',it,16/9)));")
    assert len(L["nodes"]) == 15
    assert all(_inside(x) for x in L["nodes"])
    assert not any(_overlap(a, b) for i, a in enumerate(L["nodes"])
                   for b in L["nodes"][i + 1:])


def test_what_lands_on_the_slide_is_ordinary():
    got = _run(
        "var it=diagParse('Boss\\n  A');"
        "var L=diagLayout('hierarchy',it,16/9);"
        "console.log(JSON.stringify([diagNodeAnnot('hierarchy',L.nodes[0]),"
        "diagNodeAnnot('hierarchy',L.nodes[1]),"
        "diagNodeAnnot('list',{x:1,y:2,w:3,h:10,text:'sub',lvl:1}),"
        "diagLinkAnnot(L,L.links[0],7)]));")
    boss, a, sub, arrow = got
    # a text box with no text style: a style's look is stamped onto the
    # boxes wearing it, and editing Body must not strip a diagram
    assert boss["k"] == "text" and "style" not in boss
    assert boss["fh"] == boss["h"] and boss["va"] == "m"
    assert boss["fit"] == "shrink" and boss["align"] == "center"
    assert (boss["bgc"], boss["color"]) == ("@accent", "@page")
    assert (a["bgc"], a["bdc"], a["color"]) == ("@surface", "@accent",
                                                "@ink")
    assert sub["align"] == "left" and sub["bdc"] == "@line"
    assert "b" not in sub
    # attached at both ends, to the boxes placed just before it
    assert arrow["k"] == "arrow"
    assert arrow["c1"] == {"i": 7} and arrow["c2"] == {"i": 8}
    assert arrow["nohead"] == 1 and arrow["bend"] == "v"
    assert arrow["color"] == "@line"


def test_insert_is_one_group_one_undo_step_all_selected():
    body = lift_fn(assets.deck_js(), "diagInsert")
    assert body.count("markDirty()") == 1
    assert "var base=s.annots.length,gid=nextGrp(s),idxs=[];" in body
    assert "a.grp=gid;" in body
    assert "grpMeta(s,gid).name=diagName(kind);" in body
    assert "selectMany(l,idxs);" in body


@pytest.mark.skipif(js_engine() is None, reason="no JS engine")
def test_the_pptx_draws_the_boxes_edge():
    spec = {"title": "t", "widthMm": 254, "heightMm": 142.875, "slides": [
        {"items": [{"t": "text", "x": 10, "y": 10, "w": 20, "h": 12,
                    "text": "edge", "sizePct": 3, "bgc": "#16273a",
                    "bdc": "#39a9c0", "va": "m", "fit": "shrink"},
                   {"t": "text", "x": 40, "y": 10, "w": 20, "h": 12,
                    "text": "plain", "sizePct": 3}]}]}
    data, _ = build_pptx(spec)
    xml = zipfile.ZipFile(io.BytesIO(data)).read(
        "ppt/slides/slide1.xml").decode("utf-8")
    edge, plain = xml.split("<a:t>edge</a:t>")[0], \
        xml.split("<a:t>edge</a:t>")[1].split("<a:t>plain</a:t>")[0]
    sp = edge.rsplit("<p:sp>", 1)[1]
    assert ('<a:solidFill><a:srgbClr val="16273A"></a:srgbClr></a:solidFill>'
            '<a:ln w="9525"><a:solidFill><a:srgbClr val="39A9C0">'
            in sp)
    assert "<a:ln" not in plain.rsplit("<p:sp>", 1)[1].split("</p:spPr>")[0]
    js = assets.load("js/deck/60-saving-and-export.js")
    # a box with Fill None has no edge on the canvas (.an-text.nobg), so
    # it has none in the .pptx either (2026-10-08 review)
    assert "bdc:(a.bg!==0&&a.bdc&&a.bdc!=='none')?tokVal(a.bdc):''," in js
    css = assets.deck_css()
    assert ".an-text.nobg{background:none;border:none;}" in css


def test_fill_none_takes_the_edge_off_in_the_pptx_too():
    """2026-10-08 review: Fill None hides a box's edge on the canvas
    (.an-text.nobg{border:none}) but the .pptx still drew it."""
    js = assets.deck_js()
    src = ("function pptxBox(a){return {x:a.x,y:a.y,w:a.w,h:a.h||5};}\n"
           "function tokVal(v){return v==='@accent'?'#39a9c0':v;}\n"
           "function listOf(){return '';}\nfunction fontPpt(){return '';}\n"
           "function mathsPlain(t){return t;}\n"
           + lift_fn(js, "pptxTextItem") + "\n"
           "var a={k:'text',x:1,y:1,w:9,text:'x',bdc:'@accent'};\n"
           "var on=pptxTextItem(a,false,'#fff');\n"
           "a.bg=0;var off=pptxTextItem(a,false,'#fff');\n"
           "console.log(JSON.stringify([on.bdc,off.bdc]));\n")
    from test_a_custom_heading_is_a_heading import _run
    got = _run(src)
    if got is None:
        pytest.skip("no JS engine")
    assert got == ["#39a9c0", ""]


def test_a_step_dragged_taller_keeps_its_arrows_on_its_edge():
    """2026-10-08 review: resizing a text box that keeps a height moves
    a.fh, not a.h, and annotRectPct answered from the stale a.h -- so the
    arrows off a diagram step dragged taller started inside it, on screen
    and in the .pptx."""
    js = assets.deck_js()
    src = ("function anchorPos(a,w,h){return {x:a.x,y:a.y};}\n"
           + lift_fn(js, "annotRectPct") + "\n"
           "var s={annots:[{k:'text',x:24,y:50,w:24,h:11.85,fh:21.49},"
           "{k:'rect',x:1,y:2,w:3,h:4}]};\n"
           "console.log(JSON.stringify([annotRectPct(null,s,0),"
           "annotRectPct(null,s,1)]));\n")
    from test_a_custom_heading_is_a_heading import _run
    got = _run(src)
    if got is None:
        pytest.skip("no JS engine")
    assert got[0] == {"l": 24, "r": 48, "t": 50, "b": 71.49}
    assert got[1] == {"l": 1, "r": 4, "t": 2, "b": 6}
    body = lift_fn(js, "annotRectPct")
    assert "var keepsH=a.k==='text'&&a.fh>0;" in body


def test_a_hierarchy_drops_from_the_middle_of_each_box():
    """2026-10-08 review: elbow ends were where the centre line crosses
    the border, so a parent's drops left it at scattered points and the
    outer ones ran down its sides. They leave the bottom middle and enter
    the top middle now, as the dialog's preview draws them."""
    js = assets.deck_js()
    src = ("function annotRectPct(l,s,i){var a=s.annots[i];"
           "return {l:a.x,r:a.x+a.w,t:a.y,b:a.y+a.h};}\n"
           + "\n".join(lift_fn(js, f) for f in
                       ("tiedRect", "edgePoint", "elbowPoint", "arrowMids",
                        "arrowEnds")) + "\n"
           "var s={annots:[{k:'text',x:44,y:36,w:12,h:13},"
           "{k:'text',x:9,y:62,w:12,h:8},{k:'text',x:23,y:62,w:12,h:8},"
           "{k:'arrow',bend:'v',c1:{i:0},c2:{i:1}},"
           "{k:'arrow',bend:'v',c1:{i:0},c2:{i:2}},"
           "{k:'arrow',bend:'v',c1:{i:0},c2:{i:1},mid:[[30,50]]}]};\n"
           "console.log(JSON.stringify([3,4,5].map(function(i){"
           "return arrowEnds(null,s,s.annots[i],i);})));\n")
    from test_a_custom_heading_is_a_heading import _run
    got = _run(src)
    if got is None:
        pytest.skip("no JS engine")
    for e, child_cx in ((got[0], 15), (got[1], 29)):
        assert (e["x1"], e["y1"]) == (50, 49)          # parent bottom middle
        assert (e["x2"], e["y2"]) == (child_cx, 62)    # child top middle
    # a line with corners dragged in by hand keeps the border-crossing ends
    assert (got[2]["x1"], got[2]["y1"]) != (50, 49)
