"""T543: a highlighter for words.

Five marker colours and No highlight, at the foot of the Text colour
door and in the mini toolbar (which appears exactly when words are
highlighted). The browser's hiliteColor paints the background; the runs
it touched are marked data-hl, and the sanitizer keeps a background ONLY
on a marked run -- a background pasted in from a web page is not a
highlight and still goes. The .pptx carries it both ways as
<a:highlight>.

Driven: "Southern" in the title highlighted yellow from the mini
toolbar; it survived Escape and a slide change as
<span data-hl="1" style="background-color: rgb(255, 241, 118)">.
"""

from __future__ import annotations

import io
import zipfile

import pytest

from helpers_js import build_pptx, js_engine


def test_only_a_marked_run_keeps_its_background(out):
    san = out.split("  function sanitizeRich(html){")[1].split("\n  }\n")[0]
    assert "var hlBg=(n.getAttribute('data-hl')==='1'&&n.style)" in san
    assert "if(hlBg){n.style.backgroundColor=hlBg;n.setAttribute('data-hl','1');}" \
        in san


def test_the_highlighter_and_its_doors(out):
    fn = out.split("  function highlightSelection(col){")[1].split("\n  }\n")[0]
    assert "document.execCommand('hiliteColor',false,col||'transparent');" in fn
    assert "else sp.setAttribute('data-hl','1');" in fn
    assert "hh.textContent='highlight behind the words';" in out
    assert "hlRow(hl,true);m.appendChild(hl);" in out      # mini toolbar


@pytest.mark.skipif(js_engine() is None, reason="no JS engine")
def test_the_pptx_carries_it_both_ways():
    from junoview.notebook.pptx_read import read_pptx
    spec = {"title": "t", "widthMm": 254, "heightMm": 190.5, "slides": [
        {"items": [{"t": "text", "x": 10, "y": 10, "w": 60, "h": 10,
                    "text": "mark this", "sizePct": 4, "paras": [
                        {"runs": [{"t": "mark", "hl": "#fff176"},
                                  {"t": " this"}]}]}]}]}
    data, _ = build_pptx(spec)
    xml = zipfile.ZipFile(io.BytesIO(data)).read(
        "ppt/slides/slide1.xml").decode("utf-8")
    assert '<a:highlight><a:srgbClr val="FFF176"/></a:highlight>' in xml
    runs = read_pptx(data, "hl.pptx")["spec"]["slides"][0]["items"][0][
        "paras"][0]["runs"]
    assert runs[0].get("hl", "").lower() == "#fff176"
    assert not runs[1].get("hl")
