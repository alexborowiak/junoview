"""T623: indent moves the line, and lists hold.

The user, 2026-10-10: "Also, I am finding, but I might have been on an old
version, indenting affects whole of text box, and still issues with dot
points and lists". It was not an old version. A text box had no paragraph:
its lines were "\\n"s in one text node once it was drawn again, so List on
a box you came back to made ONE bullet of every line from the caret down,
and Tab then moved all of them -- the whole box. Tab on a plain line left
the box; the ribbon's Indent there said "Click into the list first"; the
Paragraph window's indent was the whole box's; an outdent at the first
level split the list and threw away its markers' colour; and the show,
the strip and the .pptx each read the list from a different place.

A box is its PARAGRAPHS now (THE PARAGRAPH, 20-notes-and-tables.js): one
<p> each, with its own level and marker, read from every shape a deck has
stored and drawn the same everywhere. These are the fast checks: the pure
arithmetic the drawing and the .pptx share, run as it ships, and the
writer's XML. The gestures themselves are driven in a real browser by
tests/test_lists_and_indent_in_a_browser.py.
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

from helpers_js import build_pptx, js_engine, lift_fn, lift_var
from junoview import assets

needs_js = pytest.mark.skipif(js_engine() is None, reason="no JS engine")

_FNS = ("listKind", "listIsOrdered", "paraRing", "paraDrawKind",
        "paraBaseKind", "paraPos", "paraHang", "parasMarks", "paraLevel",
        "paraListSet", "paraNew", "paraPlain", "mathsOpen", "parasMaths",
        "parasPlain", "paraMarkText", "parasLines", "paraCss")
_VARS = ("LIST_KINDS", "PARA_RINGS", "PARA_LVL_MAX", "PARA_CH", "PARA_LST")


def _run(expr: str):
    """Evaluate `expr` beside the paragraph model's pure functions, lifted
    from the deck exactly as they ship."""
    eng = js_engine()
    cmd, env = eng
    src = assets.deck_js()
    script = ("\n".join(lift_var(src, v) for v in _VARS) + "\n"
              + "\n".join(lift_fn(src, f) for f in _FNS) + "\n"
              + "console.log(JSON.stringify(" + expr + "));\n")
    with tempfile.TemporaryDirectory() as d:
        p = Path(d) / "run.js"
        p.write_text(script, encoding="utf-8")
        r = subprocess.run(cmd + [str(p)], capture_output=True, text=True,
                           env=env, timeout=60)
        assert r.returncode == 0, r.stderr[:2000]
        return json.loads(r.stdout.strip().splitlines()[-1])


def _lines(paras: list[dict]) -> str:
    return _run("parasLines(" + json.dumps(paras) + ".map(function(p){"
                "return paraNew(p,p.h);}))")


def _marks(paras: list[dict]) -> list[list]:
    got = _run("parasMarks(" + json.dumps(paras) + ").map(function(m){"
               "return [m.k,m.n,m.first,m.pos];})")
    return got


@needs_js
def test_numbering_counts_per_level_and_a_sub_point_turns_the_kind():
    # 1. one / a. sub / 2. two -- the sub-level is a. and the run at the
    # first level goes on counting past it
    assert _marks([{"list": "number"}, {"list": "number", "lvl": 1},
                   {"list": "number"}]) == [
        ["number", 1, 1, 1.7], ["alpha", 1, 1, 2.95], ["number", 2, 1, 1.7]]
    # a dot, a ring and a square take turns down the levels
    assert [m[0] for m in _marks([{"list": "bullet", "lvl": i}
                                  for i in range(4)])] == [
        "bullet", "circle", "square", "bullet"]
    # an alpha list's sub-level is roman, never alpha again (the finding)
    assert _marks([{"list": "alpha"}, {"list": "alpha", "lvl": 1}])[1][0] \
        == "roman"
    # a kind picked from the gallery that is not on a ring stays put
    assert [m[0] for m in _marks([{"list": "arrow", "lvl": i}
                                  for i in range(3)])] == ["arrow"] * 3


@needs_js
def test_a_start_is_the_lists_and_survives_a_line_taken_out():
    # a list that starts at 5, its second item taken out of it: the next
    # one is 6 (it carries the list's start), not a second 5
    m = _marks([{"list": "number", "start": 5},
                {"list": "number", "start": 5},
                {},
                {"list": "number", "start": 5}])
    assert [x[1] for x in m] == [5, 6, 0, 7]
    # ...and the .pptx starts the resumed run where it resumes
    assert [x[2] for x in m] == [5, 5, 0, 7]
    # a list with no start of its own begins again after a plain line, as
    # two lists always did here (T609's "1." under "After the list")
    assert [x[1] for x in _marks([{"list": "number"}, {},
                                  {"list": "number"}])] == [1, 0, 1]
    # a plain line at a DEEPER level does not end the run above it
    assert [x[1] for x in _marks([{"list": "number"}, {"lvl": 1},
                                  {"list": "number"}])] == [1, 0, 2]
    # a start in the middle restarts there
    assert [x[1] for x in _marks([{"list": "number"},
                                  {"list": "number", "start": 5},
                                  {"list": "number"}])] == [1, 5, 6]


@needs_js
def test_where_the_words_start():
    # a plain paragraph at a level sits under the words of the level above
    assert _run("[0,1,2].map(function(l){return paraPos(l,'');})") == \
        [0, 1.7, 3.2]
    assert _run("[0,1,2].map(function(l){return paraPos(l,'bullet');})") \
        == [1.7, 3.2, 4.7]
    assert _run("[0,1,2].map(function(l){return paraPos(l,'number');})") \
        == [1.7, 2.95, 4.2]


@needs_js
def test_the_kind_stored_is_the_one_it_turns_from():
    """A gallery pick, a pasted list and a .pptx's paragraph arrive with
    the kind they SHOW at their level; the stored kind is the one that
    draws it there, so every surface draws the same marker."""
    got = _run("""(function(){var out=[];
      LIST_KINDS.forEach(function(k){for(var l=0;l<6;l++){
        if(paraDrawKind(paraBaseKind(k[0],l),l)!==k[0]) out.push([k[0],l]);
        if(paraBaseKind(paraDrawKind(k[0],l),l)!==k[0]) out.push([k[0],l,'b']);
      }});return out;})()""")
    assert got == []


@needs_js
def test_a_level_and_a_marker_change_nothing_else():
    got = _run("""(function(){
      var p=paraNew({lvl:0,list:'number',start:5,lc:'#ff0000',ls:1.5},'w');
      paraLevel(p,1);var a=JSON.parse(JSON.stringify(p));
      paraLevel(p,-1);paraLevel(p,-1);var b=JSON.parse(JSON.stringify(p));
      for(var i=0;i<12;i++) paraLevel(p,1);var c=p.lvl;
      var q=paraNew({lvl:2},'x');paraListSet(q,'square');
      var r=paraNew({lvl:1},'y');paraListSet(r,'bullet');
      paraListSet(p,'');
      return [a,b,c,q.list,r.list,p];})()""")
    a, b, top, sq, bul, off = got
    # a paragraph moved to another level leaves its run's start behind,
    # and keeps its words, its kind, its colour and its size
    assert a == {"lvl": 1, "list": "number", "start": 0, "lc": "#ff0000",
                 "ls": 1.5, "h": "w"}
    # never above the first level: Shift+Tab there does nothing
    assert b["lvl"] == 0
    assert top == 8
    # Square picked at level 2 draws a square there (stored as its turn)
    assert sq == "bullet"
    # the List button's plain dot takes the levels' turns
    assert bul == "bullet"
    # a marker off: the level and the words stay
    assert off == {"lvl": 8, "list": "", "start": 0, "lc": "", "ls": 0,
                   "h": "w"}


@needs_js
def test_a_display_formula_over_several_lines_is_one_paragraph():
    """"$$", a line of LaTeX, "$$" -- typed with Enter, or an older box's
    lines -- is ONE paragraph, its lines kept, so MathJax can pair the two
    "$$" (it never looks across a block); and the box is still stored as
    its plain lines (2026-10-10 review)."""
    got = _run("""(function(){
      function L(t){return t.split('\\n').map(function(l){
        return paraNew({},l);});}
      function H(ps){return ps.map(function(p){return p.h;});}
      return [
        H(parasMaths(L('Area of a circle:\\n$$\\nA = \\\\pi r^2\\n$$\\nafter'))),
        H(parasMaths(L('\\\\[\\nx^2\\n\\\\]'))),
        H(parasMaths(L('$$x$$\\nnext'))),
        H(parasMaths(L('$$\\nnever closed'))),
        H(parasMaths(L('costs \\\\$$ 5\\nplain'))),
        H(parasMaths([paraNew({},'$$'),paraNew({list:'bullet'},'x'),
                      paraNew({},'$$')])),
        H(parasMaths([paraNew({},'$$'),paraNew({lvl:1},'x'),
                      paraNew({},'$$')])),
        parasPlain(parasMaths(L('a\\n$$\\nx\\n$$'))),
        parasPlain([paraNew({},'a\\nb')])];})()""")
    assert got[0] == ["Area of a circle:", "$$\nA = \\pi r^2\n$$", "after"]
    assert got[1] == ["\\[\nx^2\n\\]"]
    # a formula on one line, one that never closes, an escaped dollar: as
    # they were
    assert got[2] == ["$$x$$", "next"]
    assert got[3] == ["$$", "never closed"]
    assert got[4] == ["costs \\$$ 5", "plain"]
    # never across a bullet or a level
    assert got[5] == ["$$", "x", "$$"]
    assert got[6] == ["$$", "x", "$$"]
    # a.text says the formula's lines as lines and reads back the same
    assert got[7] is True
    # a line break that is not a formula's is not plain text
    assert got[8] is False


@needs_js
def test_a_number_is_written_only_where_counting_on_would_not_reach_it():
    """The paragraphs are siblings and the browser counts each one with a
    marker on from the one before; a counter-set goes only where that
    would be wrong -- so an Enter in a long numbered list writes the new
    paragraph and nothing below it (2026-10-10 review: 26 style writes)."""
    got = _run("""(function(){
      function css(ps){var mk=parasMarks(ps),cnt={v:0};
        return ps.map(function(p,i){
          var c=paraCss(p,mk[i],cnt).match(/counter-set:list-item (\\d+)/);
          return c?+c[1]:0;});}
      var n30=[];for(var i=0;i<30;i++) n30.push({list:'number'});
      return [css(n30).filter(function(x){return x;}).length,
        css([{list:'number',start:5},{list:'number',start:5},{},
             {list:'number',start:5}]),
        css([{list:'number'},{list:'number',lvl:1},{list:'number',lvl:1},
             {list:'number'},{list:'bullet'},{list:'number'}]),
        css([{list:'paren'},{list:'paren'},{list:'paren'}])];})()""")
    assert got[0] == 0
    # a list from 5, a line taken out, the rest counting on from it
    assert got[1] == [5, 0, 0, 0]
    # a sub-list starts at a. and the run above it picks up at 2; a
    # bullet ends the numbering, which then begins again
    assert got[2] == [0, 1, 0, 2, 0, 1]
    # 1) 2) 3) counts on by itself as well (a counter style, deck.css)
    assert got[3] == [0, 0, 0]


@pytest.mark.skipif(js_engine() is None, reason="no JS engine")
def test_the_pptx_has_each_paragraphs_own_level_marker_and_line_breaks():
    """Each <a:p> at its own level with the marker it draws THERE, its
    words where the slide puts them (marL in em of the type), the box
    indent added, a Shift+Enter line an <a:br/> inside its bullet, and
    the slide's gap between paragraphs."""
    paras = [
        {"lvl": 0, "bullet": True, "lkind": "bullet", "marEm": 1.7,
         "hangEm": 1.7, "spcEm": 0.18,
         "runs": [{"t": "one"}, {"t": "", "br": 1}, {"t": "more"}]},
        {"lvl": 1, "bullet": True, "lkind": "circle", "marEm": 3.2,
         "hangEm": 1.5, "spcEm": 0.18, "lcol": "#ff0000",
         "runs": [{"t": "sub"}]},
        {"lvl": 0, "num": True, "lkind": "alpha", "lstart": 3, "marEm": 1.7,
         "hangEm": 1.7, "spcEm": 0.18, "runs": [{"t": "c"}]},
        {"lvl": 1, "marEm": 1.7, "hangEm": 0, "spcEm": 0.18,
         "runs": [{"t": "plain"}]}]
    spec = {"title": "t", "widthMm": 254, "heightMm": 190.5, "slides": [
        {"items": [{"t": "text", "x": 5, "y": 5, "w": 60, "h": 20,
                    "text": "one\nmore\nsub\nc\nplain", "sizePct": 4,
                    "indEm": 2, "paras": paras}]}]}
    data, _ = build_pptx(spec)
    xml = zipfile.ZipFile(io.BytesIO(data)).read(
        "ppt/slides/slide1.xml").decode("utf-8")
    ps = re.findall(r"<a:p>(.*?)</a:p>", xml)
    assert len(ps) == 4
    pt = 4 / 100 * 190.5 / 25.4 * 72      # the type size the runs carry

    def emu(em):
        return round(em * pt * 12700)
    # the box indent (2em) on every paragraph, the level's own margin
    assert f'marL="{emu(1.7 + 2)}"' in ps[0]
    assert f'indent="-{emu(1.7)}"' in ps[0]
    assert '<a:buChar char="&#8226;"/>' in ps[0]
    assert ps[0].count("<a:br>") == 1 and "<a:t>more</a:t>" in ps[0]
    assert 'lvl="1"' in ps[1] and f'marL="{emu(3.2 + 2)}"' in ps[1]
    assert '<a:buChar char="&#9702;"/>' in ps[1]
    assert '<a:buClr><a:srgbClr val="FF0000"/></a:buClr>' in ps[1]
    assert '<a:buAutoNum type="alphaLcPeriod" startAt="3"/>' in ps[2]
    # a plain paragraph at a level is indented with no marker
    assert '<a:buNone/>' in ps[3] and f'marL="{emu(1.7 + 2)}"' in ps[3]
    assert "<a:spcBef><a:spcPts" in ps[1]


def test_the_paragraph_window_says_what_moves(out):
    html = assets.deck_html()
    menu = html.split('id="fmt-para-menu"')[1].split("</div>\n              </span>")[0]
    # the line's level first, the box's indent second, each named for
    # what it moves -- it used to say only "indent the whole box", and
    # with the caret in one bullet every line moved
    assert menu.index('id="fmt-para-lvl"') < menu.index('id="fmt-para-ind"')
    assert "level &#8212; the line(s) you are\n                    in, like Tab" \
        in menu
    assert "box indent &#8212; moves the whole\n                    box, every line" \
        in menu
    fmt = assets.load("js/deck/30-format-bar.js")
    assert "optChip(lvlRow,'+ Level',false," in fmt
    assert "optChip(ind,'+ Box in',false," in fmt
    # the box indent keeps you typing, as the alignments do (T534)
    assert "function(){keepTyping(function(){paraApply('i:+');});})" in fmt


def test_indent_and_outdent_act_on_paragraphs_or_the_whole_selected_box(out):
    html = assets.deck_html()
    for bid in ("fmt-indent", "fmt-outdent"):
        b = html.split(f'id="{bid}"')[1].split("</button>")[0]
        assert "with the box selected, every paragraph" in \
            re.sub(r"\s+", " ", b)
        assert "Never the box itself" in re.sub(r"\s+", " ", b)
    fn = out.split("  function listIndent(out){")[1].split("\n  }\n")[0]
    assert "var how=paraCmd(function(p){paraLevel(p,out?-1:1);}" in fn
    assert "'Already at the first level'" in fn


def test_command_search_knows_powerpoints_words(out):
    for words in ("increase list level", "decrease list level",
                  "increase indent", "decrease indent"):
        assert words in out, words
    # ...and acts on the paragraphs you were in, noted as it opened
    assert "inp.addEventListener('mousedown',paraHintNote);" in out
    # ...for the one command run from the search, never a later one
    assert "      paraHint=cmdHint;cmdHint=null;\n      b.click();\n" \
        "      paraHint=null;" in out


def test_the_editor_keeps_every_step_in_its_own_undo(out):
    """Ctrl+Z and Ctrl+Y in a box of paragraphs are the box's own undo for
    EVERY step -- typing, Enter, a paste, a Tab, a marker -- never the
    browser's, which cannot see a level or a marker (2026-10-10 review: two
    stacks drifted, and a Ctrl+Y that found nothing of ours did nothing,
    so words typed and undone could never come back)."""
    h = out.split("  function edHistory(el,back){")[1].split("\n  }\n")[0]
    assert "for(i=top.recs.length-1;i>=0;i--) edPut(top.recs[i],false);" in h
    assert "for(i=0;i<top.recs.length;i++) edPut(top.recs[i],true);" in h
    assert "document.execCommand('undo'" not in out
    assert "document.execCommand('redo'" not in out
    kd = out.split("        if(mod&&!e.altKey&&(e.key==='z'||e.key==='Z'")[1]
    kd = kd.split("\n        }\n")[0]
    assert "e.preventDefault();e.stopPropagation();" in kd
    assert "edHistory(el,(e.key==='z'||e.key==='Z')&&!e.shiftKey);" in kd
    # the menu's Undo and Redo too
    bi = out.split("    el.addEventListener('beforeinput',function(e){")[1]
    bi = bi.split("\n    });\n")[0]
    assert "if(t==='historyUndo'||t==='historyRedo'){" in bi
    assert "edBefore(el,t);" in bi
    # what paraDecorate draws is not a step of its own
    assert "  var ED_DRAWN=/^(style|class|data-k)$/;" in out


def test_pasted_lines_are_paragraphs(out):
    h = out.split("    function pasteParas(cd,plainOnly,e){")[1].split(
        "\n    }\n")[0]
    assert ("ps=txt.replace(/\\n+$/,'').split('\\n').map(function(l){"
            in h)
    assert "paraPaste(el,ps);" in h
    paste = out.split("  function paraPaste(el,ps){")[1].split("\n  }\n")[0]
    # each new paragraph is a copy of the caret's -- its level and marker
    assert "if(i){e=p0.cloneNode(false);el.insertBefore(e,last.nextSibling);" \
        in paste


def test_a_pptx_level_is_no_longer_a_loss():
    from junoview.notebook import pptx_read
    src = Path(pptx_read.__file__).read_text(encoding="utf-8")
    assert 'self.lost.add("levels")' not in src
    assert '"levels":' not in src


def test_a_marker_waits_with_its_first_words_in_a_build(out):
    """A paragraph built sentence by sentence holds its marker back while
    its first words are still to come -- marked by the reveal pass, not
    found by a :has() the style engine would re-ask on every keystroke."""
    css = assets.deck_css()
    assert ".an-text .an-mk-wait::marker{color:transparent;}" in css
    assert ":has(> .an-part" not in css and ":has(>.an-part" not in css
    assert ("bp.classList.toggle('an-mk-wait',\n"
            "                  pe.style.visibility==='hidden');") in out


@needs_js
def test_a_thumbnail_draws_its_markers_as_characters():
    """The strip draws a box as one text node of lines, each wearing its
    marker as a character and set in by its level (2026-10-10 review: a
    <p> a paragraph in every thumbnail cost the strip's scroll 2.4x its
    script) -- at 2-3px the browser's own dot would not paint anyway."""
    got = _lines([{"list": "number", "start": 5, "h": "one"},
                  {"list": "number", "lvl": 1, "h": "two"},
                  {"list": "number", "start": 5, "h": "three"},
                  {"h": "plain"}, {"lvl": 1, "h": "under"},
                  {"list": "bullet", "lvl": 2, "h": "deep"},
                  {"list": "roman-upper", "start": 14, "h": "xiv"},
                  {"list": "paren", "h": "p"}])
    assert got.split("\n") == [
        "5.\u00a0one", "\u2003\u2003a.\u00a0two", "6.\u00a0three",
        "plain", "\u2003\u2003under", "\u2003" * 3 + "\u25aa\u00a0deep",
        "XIV.\u00a0xiv", "1)\u00a0p"]


def test_clear_formatting_keeps_a_line_break_inside_a_paragraph(out):
    """Shift+Enter is a line break inside a paragraph; Clear formatting
    on the selected box keeps it, where plain text could only have said
    "a new paragraph"."""
    fn = out.split("  function clearBoxLook(a,which){")[1].split("\n  }\n")[0]
    assert "(r.rich||/<br\\b/i.test(r.html))?r.html:''" in fn


def test_tab_in_a_title_never_leaves_it(out):
    """A title, a subtitle or a Markdown box has no levels: Tab types a
    tab and Shift+Tab does nothing, and neither moves the focus away."""
    kd = out.split("      if(e.key==='Tab'&&!mod&&!e.altKey){")[1].split(
        "        var ps=paraTouched(el)")[0]
    assert kd.lstrip().startswith("e.preventDefault();e.stopPropagation();")
    assert ("        if(!paraOn){\n          if(!e.shiftKey){\n"
            "            try{document.execCommand('insertText',false,'\\t');}"
            "catch(err){}\n          }\n          return;\n        }") in kd
