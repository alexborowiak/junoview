"""T546: Link has a button.

"Make this a link..." (T118) was a row of the right-click menu and
nothing else. Now: a Link tile on Text (its own Links group, after
Write), Ctrl+K, and Link on the mini toolbar -- one door, the rule B, I
and U keep: highlighted words are linked, otherwise the one selected
object (a title too); with nothing selected Ctrl+K stays the rail's Find.

Words are a link of their own, as in PowerPoint: an <a> in the box's
rich text -- href for an address mdHref allows, data-sid for a slide --
kept by the sanitizer and nothing else. They export as run hyperlinks
(a relationship each) and import back as linked words, where a .pptx
used to lose all but the first.

Found driving it: while presenting, nothing on a slide took a mouse
click -- .an-item is pointer-events:none so a click anywhere advances --
so linked objects (T118), clips (T321) and tap-to-enlarge had never
answered a click either. And the ask dialog focused its field a tick
late, so an answer typed straight after Ctrl+K landed in the box, over
the highlighted words.

Driven at 1440x900: "method paper" linked with Ctrl+K and "example.org/
paper" (https added); "today" linked to slide 2 typing straight on; a
click on linked words in the editor selected the box and went nowhere;
Ctrl+K on a shape linked the shape; with nothing selected Ctrl+K focused
the rail's Find; presenting, the words opened their page, the shape its
page, "today" and a Markdown [slide two](#2) went to slide 2, and a click
elsewhere still advanced.
"""

from __future__ import annotations

import io
import zipfile

import pytest

from helpers_js import build_pptx, js_engine
from junoview import assets


def test_the_sanitizer_keeps_a_link_and_nothing_else(out):
    san = out.split("  function sanitizeRich(html){")[1].split("\n  }\n")[0]
    assert "aHref=mdHref(n.getAttribute('href')||'');" in san
    assert "if(!/^[A-Za-z0-9_-]{1,40}$/.test(aSid)) aSid='';" in san
    # an anchor going nowhere allowed is just its words
    assert "if(!RICH_TAGS[tag]||(tag==='a'&&!aHref&&!aSid)){" in san
    assert "if(aSid) n.setAttribute('data-sid',aSid);" in san
    assert "a:1,                           /* T546: a link on words */" in out


def test_one_door_three_ways_in(out):
    deck = assets.deck_html()
    grp = deck.split('<span class="rbn-grp rbn-links" data-tab="text"')[1]
    grp = grp.split('<span class="rbn-lab">Links</span>')[0]
    assert 'id="tx-link"' in grp and '<span>Link</span>' in grp
    assert ".rbn-links{order:6;}" in assets.load("css/deck.css")
    assert "linkBoot();" in out
    now = out.split("  function linkNow(){")[1].split("\n  }\n")[0]
    assert "return linkWords(el);" in now
    assert "if(selAnnot==='t'||selAnnot==='s'){setObjLink(selAnnot);return true;}" \
        in now
    # the keys: typing, and an object selected; the rail keeps the rest
    assert "if(!e.shiftKey&&(k==='k'||k==='K')) return linkNow();" in out
    assert "if(!e.shiftKey&&(e.key==='k'||e.key==='K')&&any) return linkNow();" \
        in out
    assert "if(window.SemDeckLinkable&&window.SemDeckLinkable()) return;" in \
        assets.load("js/app.js")
    assert "['#tx-link','Link','Link the highlighted words (Ctrl+K)','mini-link']" \
        in out
    lays = assets.load("js/deck/07-ribbon-layouts.js")
    assert lays.count("'tx-autocorrect','tx-link'") == 8


def test_words_are_linked_by_the_browser_and_committed(out):
    fn = out.split("  function linkWords(el){")[1].split("\n  }\n")[0]
    assert "document.execCommand('createLink',false,t.href||mark);" in fn
    assert "document.execCommand('unlink',false,null);" in fn
    assert "x.removeAttribute('href');x.setAttribute('data-sid',t.sid);" in fn
    # the question takes the focus; the highlight comes back by offsets
    assert "nt.focus();caretPut(nt,at);" in fn
    tgt = out.split("  function linkTarget(got){")[1].split("\n  }\n")[0]
    assert "got='https://'+got;" in tgt


def test_presenting_follows_and_editing_does_not(out):
    css = assets.load("css/deck.css")
    assert (".deck:not(.editing) .an-linked,\n"
            ".deck:not(.editing) .an-tx a,\n"
            ".deck:not(.editing) .an-video,\n"
            ".deck:not(.editing) .slide.tapzoom .an-item{pointer-events:auto;}"
            ) in css
    assert "slideEl.classList.toggle('tapzoom',!!pres.tapzoom);" in out
    click = out.split("var wl=e.target.closest&&e.target.closest('.an-tx a');")[1]
    assert click.index("followLink(wl)") < click.index(
        "closest('button,a,input,select')")
    follow = out.split("  function followLink(el){")[1].split("\n  }\n")[0]
    assert "if(wnum&&/^\\d+$/.test(wnum)){" in follow
    # in the editor a click on linked words selects; it never navigates
    assert "var a=e.target.closest&&e.target.closest('.an-tx a');\n" \
        "      if(a) e.preventDefault();" in out


def test_the_answer_goes_to_the_question(out):
    ask = out.split("  function askText(o,cb){")[1].split("\n  }\n")[0]
    assert "grab();\n    setTimeout(function(){\n" \
        "      if(field&&document.activeElement!==field) grab();},0);" in ask


@pytest.mark.skipif(js_engine() is None, reason="no JS engine")
def test_the_pptx_carries_links_on_words_both_ways():
    from junoview.notebook.pptx_read import read_pptx
    spec = {"title": "t", "widthMm": 254, "heightMm": 190.5, "slides": [
        {"items": [{"t": "text", "x": 10, "y": 10, "w": 60, "h": 10,
                    "text": "read this now", "sizePct": 4, "paras": [
                        {"runs": [{"t": "read "},
                                  {"t": "this", "link": {
                                      "to": "url",
                                      "href": "https://example.org/a"}},
                                  {"t": " now", "link": {
                                      "to": "slide", "slide": 2}}]}]}]},
        {"items": [{"t": "text", "x": 10, "y": 10, "w": 60, "h": 10,
                    "text": "two", "sizePct": 4}]}]}
    data, _ = build_pptx(spec)
    z = zipfile.ZipFile(io.BytesIO(data))
    xml = z.read("ppt/slides/slide1.xml").decode("utf-8")
    rels = z.read("ppt/slides/_rels/slide1.xml.rels").decode("utf-8")
    assert xml.count("<a:hlinkClick") == 2
    assert 'action="ppaction://hlinksldjump"' in xml
    assert 'Target="https://example.org/a"' in rels
    assert 'Target="slide2.xml"' in rels
    got = read_pptx(data, "links.pptx")
    runs = got["spec"]["slides"][0]["items"][0]["paras"][0]["runs"]
    by = {r["t"].strip(): r for r in runs}
    assert by["this"].get("href") == "https://example.org/a"
    assert by["now"].get("jump") == 1
    assert "href" not in by["read"] and "jump" not in by["read"]
    assert not any("link" in s and "words" in s for s in got["lost"])


def test_an_import_keeps_the_words_linked(out):
    fn = out.split("  function pptRunHtml(r,box,sids){")[1].split("\n  }\n")[0]
    assert "if(wh&&wh.charAt(0)!=='#') h='<a href=\"'+pptEsc(wh)+'\">'+h+'</a>';" \
        in fn
    assert "h='<a data-sid=\"'+sids[r.jump]+'\">'+h+'</a>';" in fn
    assert "the box takes the first one" not in out
