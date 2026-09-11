"""Notebook content dimensions survive the handoff to auto-slide layout."""

from __future__ import annotations

import base64
import json
import struct
import subprocess
import tempfile
from pathlib import Path

import pytest

from junoview import assets


def _run(body: str) -> object:
    from helpers_js import js_engine, lift_fn

    engine = js_engine()
    if engine is None:
        pytest.skip("no JavaScript engine")
    command, env = engine
    functions = "\n".join(lift_fn(assets.app_js(), name) for name in (
        "autoNoteText", "autoFigureSize", "autoItemMetrics", "autoPlan"))
    setup = """
var window={getComputedStyle:()=>({fontSize:'18px',lineHeight:'27px'})};
function text(value){return {nodeType:3,nodeValue:value};}
function node(tag,children){return {nodeType:1,tagName:tag,
  childNodes:children||[],clientWidth:600,scrollHeight:72,
  getBoundingClientRect:()=>({width:600,height:72})};}
function figure(attrs){return {getAttribute:key=>attrs[key],
  getBoundingClientRect:()=>({width:0,height:0})};}
function card(anchor,note,fig){return {id:'card-'+anchor,
  dataset:{anchor:anchor},querySelector:s=>s==='.note'?note:fig};}
"""
    with tempfile.TemporaryDirectory() as directory:
        script = Path(directory) / "metrics.js"
        script.write_text(functions + setup + "\n" + body, encoding="utf-8")
        result = subprocess.run(command + [str(script)], env=env,
                                capture_output=True, text=True,
                                encoding="utf-8", timeout=60)
        assert result.returncode == 0, result.stderr
        return json.loads(result.stdout.strip().splitlines()[-1])


def test_markdown_keeps_paragraphs_and_real_source_size():
    result = _run("""
var note=node('DIV',[node('P',[text('One sentence.')]),
  node('P',[text('A second'),node('BR'),text('line here.')])]);
console.log(JSON.stringify(autoItemMetrics(card('m',note),'note')));
""")
    assert result["text"] == "One sentence.\nA second\nline here."
    assert result["words"] == 6
    assert result["lines"] == 3
    assert result["sourceWidth"] == 600
    assert result["sourceHeight"] == 72
    assert result["sourceFontSize"] == 18
    assert result["sourceLineHeight"] == 27
    assert result["part"] == "output"


def test_hidden_notes_keep_the_text_needed_for_a_layout_estimate():
    result = _run("""
var note=node('DIV',[node('P',[text('First sentence.')]),
  node('P',[text('Second sentence.')])]);
note.clientWidth=0;note.scrollHeight=0;
note.getBoundingClientRect=()=>({width:0,height:0});
console.log(JSON.stringify(autoItemMetrics(card('m',note),'note')));
""")
    assert result["words"] == 4
    assert result["lines"] == 2
    assert result["sourceHeight"] == 0


def test_lazy_png_svg_and_plotly_keep_their_figure_aspect():
    # A lazy PNG has no naturalWidth until it is decoded, but its stored
    # header is already enough to distinguish a portrait from a wide plot.
    header = b"\x89PNG\r\n\x1a\n" + struct.pack(">I4sII", 13, b"IHDR", 240, 720)
    png = "data:image/png;base64," + base64.b64encode(header).decode()
    result = _run("""
var inputs=[figure({src:PNG}),figure({viewBox:'0 0 1200 300'}),
  figure({'data-plotly':'{"layout":{"width":450,"height":600}}'})];
console.log(JSON.stringify(inputs.map(f=>
  autoItemMetrics(card('f',null,f),'figure'))));
""".replace("PNG", json.dumps(png)))
    assert [r["aspect"] for r in result] == [1 / 3, 4, 0.75]
    assert all(r["part"] == "figure" for r in result)


def test_plan_preserves_scope_order_source_path_and_metrics():
    result = _run("""
var notes=[card('a',node('DIV',[node('P',[text('First note.')])])),
  card('b',node('DIV',[node('P',[text('Second note.')])]))];
var APP={shells:{demo:{el:{dataset:{path:'C:/work/demo.ipynb'}},data:{
  title:'Demo',sections:[{id:'s1',title:'First'},{id:'s2',title:'Second'}],
  items:[{anchor:'a',card:'a',kind:'note',section:'s1'},
    {anchor:'b',card:'b',kind:'note',section:'s2'}]}}}};
function $$(selector,root){return notes;}
function markOf(stem,id){return {p:id==='b'};}
console.log(JSON.stringify([autoPlan('demo','all'),
  autoPlan('demo','section','s1'),autoPlan('demo','marks')]));
""")
    whole, section, marks = result
    assert [s["title"] for s in whole["sections"]] == ["First", "Second"]
    assert section["sections"][0]["items"][0]["ref"] == "demo::a"
    item = marks["sections"][0]["items"][0]
    assert item["ref"] == "demo::b"
    assert item["nbpath"] == "C:/work/demo.ipynb"
    assert item["words"] == 2
    assert item["sourceHeight"] == 72
