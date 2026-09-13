"""T388: a live web page on a slide (2026-09-12, user: "maybe web page
view, where you can put a full interactive website on there").

An object of kind `web` carries only an address and is drawn as a
sandboxed iframe: live in the show and in an exported page, covered by a
label while editing so the box can be picked up. Driven in Chromium: the
frame drew the page, the cover carried its host, and the show had it live.
"""

from __future__ import annotations

from junoview import assets
from junoview.notebook.deck_schema import ANNOT_KINDS, validate_deck


def test_the_kind_is_one_fragment_and_a_documented_kind(out):
    assert "53-web-page" in assets.DECK_PARTS
    assert "  webBoot();" in out
    part = assets.load("js/deck/53-web-page.js")
    assert "})();" not in part
    assert "web" in ANNOT_KINDS
    deck = {"name": "t", "slides": [{"annots": [
        {"k": "web", "x": 10, "y": 16, "w": 80, "h": 70,
         "url": "https://example.org/"}]}]}
    assert validate_deck(deck) == []


def test_only_http_addresses_and_only_inside_a_sandbox(out):
    assert "    return /^https?:\\/\\/[^\\s]+$/i.test(String(u||'').trim());" in out
    assert ("  var WEB_SANDBOX='allow-scripts allow-same-origin allow-forms "
            "allow-popups '") in out
    # never top-navigation: the page cannot take the deck's window
    assert "allow-top-navigation" not in out
    assert "          ifr.setAttribute('sandbox',WEB_SANDBOX);" in out
    assert "          ifr.setAttribute('referrerpolicy','no-referrer');" in out
    assert "          ifr.setAttribute('loading','lazy');" in out
    # the notebook renderer's own posture is untouched
    from junoview.render import sanitize
    assert "iframe" in sanitize._DROP_CONTENT_TAGS


def test_editing_covers_the_frame_and_the_show_leaves_it_live(out):
    assert "          cov.className='an-webcover';" in out
    assert "          lab.textContent=webHost(a.url)||'web page';" in out
    assert (".an-webcover{position:absolute;inset:0;display:flex;"
            "align-items:flex-end;") in out
    # the doors: Insert places one by address, Object changes it
    assert 'id="et-web"' in out and 'id="fmt-weburl"' in out
    assert "    '#fmt-weburl':'web'," in out
    assert "  function placeWebPage(url){" in out
    assert "    var a={k:'web',x:10,y:16,w:80,h:70,url:url};" in out
    # it has a name in the Objects pane and a signature for tidying
    assert "    if(a.k==='web') return 'Web page \\u2014 '+webHost(a.url);" in out
    assert "    if(a.k==='web') return 'web:'+String(a.url||'');" in out
    # PowerPoint is told, not silently shorted
    assert "        note.web=(note.web||0)+1;" in out
    assert "    if(note.web) lost.push(note.web+' live web page'" in out
