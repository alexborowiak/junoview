"""A saved presentation file opens its presentation (T597).

The user, 2026-09-30: "when I try and open a file from local that is a
junoview, junoview opens, but it just says that this file can be opened
with juno view, why can't it be opened?"

A .junoview.html is a real page so the OS opens it in a browser; it then
told you to go and find Junoview yourself. It carries Open in Junoview now
(``assets/js/saved-file.js``): a new tab on the Junoview it was saved from,
or on the web, which says when it is ready, is handed the deck, asks once,
and opens it through File > Open's importer.

The file's half RUNS here against a stub page -- who is opened, what is
posted, to which origin, and what is refused -- because a substring cannot
tell a handoff that posts to the right origin from one that posts to '*'.
"""

from __future__ import annotations

import json
import subprocess
import tempfile
from pathlib import Path

import pytest

from junoview import assets

_STUB = r"""
var DOM={},sent=[],opened=[],handlers={},timers=[];
function el(id,text){
  var e={id:id,textContent:text||'',className:'',hidden:false,
    ls:{},addEventListener:function(k,f){this.ls[k]=f;}};
  DOM[id]=e;return e;
}
var CFG=__CFG__;
el('junoview-open',JSON.stringify(CFG));
el('junoview-data','{"junoview":1,"presentations":[{"name":"T","slides":[]}]}');
el('jv-open');el('jv-open-msg');el('jv-open-next');el('jv-open-close');
var win={postMessage:function(m,o){sent.push([m,o]);}};
var document={getElementById:function(id){return DOM[id]||null;}};
var location={pathname:'/C:/talks/My%20talk.junoview.html',
  href:'file:///C:/talks/My%20talk.junoview.html'};
var window={
  open:function(u,t){opened.push(u);return __BLOCK__?null:win;},
  addEventListener:function(k,f){handlers[k]=f;},
  close:function(){}
};
function setTimeout(f,ms){timers.push(f);return timers.length;}
function clearTimeout(){}
"""


def _run(cfg: dict, script: str, block: bool = False):
    from helpers_js import js_engine
    eng = js_engine()
    if eng is None:
        pytest.skip("no node or VS Code Electron on this machine")
    cmd, env = eng
    pre = (_STUB.replace("__CFG__", json.dumps(cfg))
           .replace("__BLOCK__", "true" if block else "false"))
    with tempfile.TemporaryDirectory() as d:
        p = Path(d) / "run.js"
        p.write_text(pre + assets.saved_file_js() + "\n" + script,
                     encoding="utf-8")
        r = subprocess.run(cmd + [str(p)], capture_output=True, text=True,
                           encoding="utf-8", env=env, timeout=60)
    assert r.returncode == 0, r.stderr[:2000]
    return json.loads(r.stdout.strip().splitlines()[-1])


WEB = {"name": "T", "file": "T.junoview.html",
       "app": "https://junoview.com/", "web": "https://junoview.com/"}


def test_open_goes_to_the_junoview_it_was_saved_from():
    got = _run({**WEB, "app": "https://lab.example.org/jv/?x=1#/pres/T"}, """
      DOM['jv-open'].ls.click();
      console.log(JSON.stringify(opened));
    """)
    # the saved-from address, its own hash dropped for the handoff's
    assert got == ["https://lab.example.org/jv/?x=1#junoview-handoff"]


def test_the_deck_goes_only_to_the_tab_it_opened_and_only_once():
    got = _run(WEB, """
      DOM['jv-open'].ls.click();
      var h=handlers.message;
      h({source:{},data:{junoview:'ready'}});      /* someone else */
      var before=sent.length;
      h({source:win,data:{junoview:'ready'}});
      h({source:win,data:{junoview:'ready'}});     /* a second ready */
      console.log(JSON.stringify({before:before,sent:sent}));
    """)
    assert got["before"] == 0
    assert len(got["sent"]) == 1
    msg, origin = got["sent"][0]
    # to that origin and nowhere else
    assert origin == "https://junoview.com"
    assert msg["junoview"] == "deck"
    assert json.loads(msg["text"])["presentations"][0]["name"] == "T"
    # the name the file has NOW, not the one it was saved under
    assert msg["file"] == "My talk.junoview.html"
    assert msg["path"].startswith("file:///")


def test_a_file_address_can_only_be_posted_to_star():
    got = _run({**WEB, "app": "file:///C:/notes/analysis.html"}, """
      DOM['jv-open'].ls.click();
      handlers.message({source:win,data:{junoview:'ready'}});
      console.log(JSON.stringify(sent.map(function(s){return s[1];})));
    """)
    assert got == ["*"]


def test_the_app_on_this_computer_hands_over_to_the_web():
    """A file saved from the local app records no address of its own
    (the app's carries a session token), so Open goes to the web."""
    got = _run({**WEB, "app": ""}, """
      DOM['jv-open'].ls.click();
      console.log(JSON.stringify(opened));
    """)
    assert got == ["https://junoview.com/#junoview-handoff"]


def test_no_answer_offers_the_next_place_and_says_so():
    got = _run({**WEB, "app": "http://127.0.0.1:8811/"}, """
      DOM['jv-open'].ls.click();
      timers[timers.length-1]();                  /* 20 s, no ready */
      var m1=DOM['jv-open-msg'].textContent,cls=DOM['jv-open-msg'].className;
      var nx=DOM['jv-open-next'];
      var offer={hidden:nx.hidden,text:nx.textContent};
      nx.ls.click();
      console.log(JSON.stringify({m1:m1,cls:cls,offer:offer,opened:opened}));
    """)
    assert "did not answer at 127.0.0.1:8811" in got["m1"]
    assert "jv-warn" in got["cls"]
    assert got["offer"] == {"hidden": False,
                            "text": "Open it in Junoview at junoview.com "
                                    "instead"}
    assert got["opened"] == ["http://127.0.0.1:8811/#junoview-handoff",
                             "https://junoview.com/#junoview-handoff"]


def test_a_blocked_tab_is_said():
    got = _run(WEB, """
      DOM['jv-open'].ls.click();
      console.log(JSON.stringify([DOM['jv-open-msg'].textContent,sent.length]));
    """, block=True)
    assert "stopped the new tab" in got[0] and got[1] == 0


def test_opened_and_declined_are_reported():
    got = _run(WEB, """
      DOM['jv-open'].ls.click();
      var h=handlers.message;
      h({source:win,data:{junoview:'ready'}});
      h({source:win,data:{junoview:'declined'}});
      var no=DOM['jv-open-msg'].textContent;
      h({source:win,data:{junoview:'opened'}});
      console.log(JSON.stringify({no:no,yes:DOM['jv-open-msg'].textContent,
        close:DOM['jv-open-close'].hidden}));
    """)
    assert got["no"].startswith("Not opened")
    assert got["yes"].startswith("Opened in Junoview")
    assert got["close"] is False


# ------------------------------------------------------ the Python readers


def _page(deck: dict) -> str:
    """The shape junoviewFileHtml writes: a config block BEFORE the data
    block and the handoff script AFTER it."""
    return ('<!doctype html>\n<html lang="en"><head><meta charset="utf-8">'
            '<title>T</title></head><body><main><h1>T</h1>'
            '<p class="jv-actions"><button type="button" id="jv-open">'
            'Open in Junoview</button></p><ol class="jv-slides"><li>A</li>'
            '</ol></main><script type="application/json" id="junoview-open">'
            '{"name":"T","file":"T.junoview.html","app":"","web":'
            '"https://junoview.com/"}</script>'
            '<script type="application/json" id="junoview-data">\n'
            + json.dumps({"junoview": 1, "presentations": [deck]})
            + '\n</script><script>' + assets.saved_file_js()
            + '</script></body></html>\n')


def _deck() -> dict:
    return {"name": "T", "slides": [
        {"layout": "blank", "panes": [], "annots": [
            {"k": "text", "x": 5, "y": 5, "w": 50, "h": 10, "text": "A"}]}]}


def test_the_sidecar_reader_reads_the_page_that_opens():
    from junoview.notebook.presentations import deck_json
    obj = deck_json(_page(_deck()))
    assert obj["presentations"][0]["name"] == "T"


def test_the_deck_api_keeps_the_page_and_its_script(tmp_path):
    from junoview.notebook.deck_api import Deck
    p = tmp_path / "T.junoview.html"
    p.write_text(_page(_deck()), encoding="utf-8")
    d = Deck.open(p)
    d.slide(1).notes = "kept"
    d.save()
    text = p.read_text(encoding="utf-8")
    assert 'id="jv-open"' in text and 'id="junoview-open"' in text
    assert assets.saved_file_js().strip()[:40] in text
    obj = json.loads(text.split('id="junoview-data">')[1]
                     .split("</script>")[0])
    assert obj["presentations"][0]["slides"][0]["notes"] == "kept"


# --------------------------------------------------------------- the app


def test_the_page_carries_the_script_as_inert_text():
    page = assets.page_template()
    assert ('<script type="text/plain" id="jv-savedfile-js">'
            '{saved_file_js}</script>') in page
    assert "</script" not in assets.saved_file_js().lower()


def test_the_file_page_has_the_button_the_list_and_no_whole_closing_tag(out):
    body = out.split("function junoviewFileHtml(){")[1].split("\n  }\n")[0]
    assert "'class=\"jv-primary\">Open in Junoview</button></p>'" in body
    assert "var names=savedSlideNames();" in body
    assert "id=\"junoview-open\">'+cfg" in body
    # every closing script tag in the inline editor script is split
    assert "</script" not in body.replace("</'+'script", "")
    # the app on this computer writes no address -- its carries a token
    fn = out.split("function handoffAppUrl(){")[1].split("\n  }\n")[0]
    assert "    if(APP.mode==='app') return '';" in fn


def test_the_app_takes_a_deck_only_from_its_opener_once_after_asking(out):
    boot = out.split("function handoffBoot(){")[1].split("\n  }\n")[0]
    assert "if(!/^#junoview-handoff/.test(String(location.hash||''))) return;" in boot
    assert "history.replaceState(null,'',location.pathname+location.search);" in boot
    assert "      if(handoffTaken||e.source!==src) return;" in boot
    ready = out.split("function handoffReady(src,n){")[1].split("\n  }\n")[0]
    assert "APP.draftsPending&&APP.draftsPending()&&n<80" in ready
    opener = out.split("function handoffOpen(d,reply){")[1].split("\n  }\n")[0]
    assert "askYes({title:'Open \\u201c'" in opener
    assert "if(y!==true){reply('declined');return;}" in opener
    assert "Promise.resolve(importDeckTextAsk(d.text))" in opener
    # it runs before the route, whose hash it clears
    boot_seq = out[out.index("  handoffBoot();"):]
    assert "window.SemApp.applyInitialRoute();" in boot_seq


def test_a_dropped_file_stays_its_files(out):
    js = assets.app_js()
    assert "if(f&&isDeckPath(f.name)) hs.push(it.getAsFileSystemHandle());" in js
    # every file a handle, or none of them goes through the handles; the
    # editor that opens them may still be loading (app.js jvDeck), and the
    # handles were asked for in the event all the same
    assert ("if(got.length!==deckFiles.length){deckPlain();return;}\n"
            "          jvDeck.then(function(){\n"
            "            if(APP.deckOpenHandles) APP.deckOpenHandles(got);\n"
            "            else deckPlain();") in js
    assert ("if(deckFiles.length&&(APP.deckOpenHandles||jvDeck.pending()))"
            in js)
    assert "  APP.deckOpenHandles=openDeckHandles;" in out
