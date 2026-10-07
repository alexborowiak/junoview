"""Narration recorded per slide while presenting, played in the show (T564).

Present > Record narration... asks for the microphone, starts the show
from this slide, and records each slide as a take of its own, split where
the rehearsal clock splits (go()) and filed against the slide OBJECT it
began on. A slide passed through in under NARR_MIN seconds is no take.
When the show ends the takes are offered (after the ink's question); kept,
each becomes s.narr = {vkey, dur} with its bytes in the deck's media
store, so it rides every self-contained save beside the clips. Escape
keeps; only Discard throws away. In the show a slide with narration
speaks when it arrives unless the Talk panel has it off.

Driven at 1366x657 with Chromium's fake microphone: two slides recorded
and kept (strip marks 0:04 and 0:03), each spoke when it came up, the
Talk switch silenced it, the Notes pane played and deleted a take and
Ctrl+Z put it back, and a reload kept both and played them from storage.
"""

from __future__ import annotations

import json
import subprocess
import tempfile
from pathlib import Path

import pytest

from helpers_js import js_engine, lift_fn
from junoview import assets
from junoview.notebook.deck_schema import SLIDE_KEYS
from junoview.notebook.presentations import as_presentations


def _run(src: str) -> object:
    eng = js_engine()
    if eng is None:
        pytest.skip("no JS engine")
    cmd, env = eng
    with tempfile.TemporaryDirectory() as d:
        p = Path(d) / "t.js"
        p.write_text(src, encoding="utf-8", newline="\n")
        r = subprocess.run(cmd + [str(p)], capture_output=True, text=True,
                           env=env, timeout=60)
    assert r.returncode == 0, r.stderr[:3000]
    return json.loads(r.stdout.strip().splitlines()[-1])


def test_the_part_the_door_and_the_switch():
    assert "65-narration" in assets.DECK_PARTS
    js = assets.deck_js()
    assert "  narrationBoot();" in js.split("THE BOOT SEQUENCE", 1)[1]
    html = assets.load("html/deck.html")
    talk = html.split('class="rbn-grp rbn-talk"', 1)[1].split(
        '<span class="rbn-lab">', 1)[0]
    assert 'id="pr-narrate"' in talk
    assert '<i data-ic="mic"></i> Record narration&#8230;</button>' in talk
    assert 'id="talk-narr"' in html and 'id="np-narr"' in html
    assert "'pr-narrate':'record narration narrate voice over" in js
    from junoview import branding
    for k in ("mic", "pause", "stop"):
        assert k in branding._ICON_PATHS, k


def test_the_show_hooks():
    js = assets.deck_js()
    # (the slide change's go(n), not the nested image-retry go())
    go = js.split("  function go(n){", 1)[1].split("\n  }\n", 1)[0]
    assert go.index("rehSlideChanged();") < go.index(
        "if(typeof narrSlideChanged==='function') narrSlideChanged();")
    ui = lift_fn(js, "setUIMode")
    assert ("if(startingTalk&&typeof narrShowStart==='function') "
            "narrShowStart();") in ui
    assert ("if(endingTalk&&typeof narrShowStop==='function') "
            "narrShowStop();") in ui
    close = lift_fn(js, "closeDeck")
    # once the deck is hidden, so the question sits on the page
    assert close.index("deckEl.hidden=true;") < close.index(
        "if(wasTalk&&typeof narrShowStop==='function') narrShowStop();")
    assert "try{if(typeof narrHalt==='function') narrHalt();}catch(err){}" \
        in js
    # the presenter's Pause pauses the take with the clock
    assert "rehPause();\n        if(typeof narrPause==='function') " \
        "narrPause(true);}" in js


def test_recording_comes_before_the_show_and_never_plays_over_itself():
    js = assets.deck_js()
    rec = lift_fn(js, "narrRecord")
    assert rec.index("getUserMedia({audio:true})") < rec.index("b.click()")
    play = lift_fn(js, "narrPlay")
    assert "if(!n||narrMute||narrRec||mode!=='view') return;" in play


def test_escape_keeps_and_only_discard_throws_away():
    js = assets.deck_js()
    ask = lift_fn(js, "narrAsk")
    assert "ok:'Keep narration',alt:'Discard'" in ask
    assert "if(v==='alt'){toast('Narration discarded');return;}" in ask
    assert "narrKeep(R,takes);" in ask
    assert "var c=$('#ask-cancel'); if(c) c.hidden=true;" in ask
    # one question at a time: after the ink's
    assert "if(d&&!d.hidden){setTimeout(function(){narrAsk(R);},300);" \
        "return;}" in ask
    keep = lift_fn(js, "narrKeep")
    assert keep.count("markDirty()") == 1
    assert "s.narr={vkey:k,dur:v.dur};" in keep
    assert "if(R.deck!==pres){" in keep


def test_takes_are_split_by_slide_and_short_ones_are_not_takes():
    js = assets.deck_js()
    src = (
        "var T=0;var performance={now:function(){return T;}};\n"
        "function toast(){}\n"
        "function readAsDataURL(b){return Promise.resolve('data:'+b.type"
        "+';base64,QUFB');}\n"
        "function MediaRecorder(stream,o){this.state='inactive';"
        "this.mimeType=(o&&o.mimeType)||'';}\n"
        "MediaRecorder.prototype.start=function(){this.state='recording';};\n"
        "MediaRecorder.prototype.pause=function(){};\n"
        "MediaRecorder.prototype.resume=function(){};\n"
        "MediaRecorder.prototype.stop=function(){var me=this;"
        "this.state='inactive';setTimeout(function(){"
        "me.ondataavailable({data:new Blob(['x'])});me.onstop();},0);};\n"
        "var NARR_MIN=1.5;\n"
        + lift_fn(js, "narrBase") + "\n"
        + lift_fn(js, "narrTakeStart") + "\n"
        + lift_fn(js, "narrTakeEnd") + "\n"
        "var A={n:'A'},B={n:'B'},C={n:'C'};var pres={slides:[A,B,C]};\n"
        "var R={stream:{},mime:'audio/webm;codecs=opus',base:"
        "narrBase('audio/webm;codecs=opus'),takes:new Map(),cur:null,"
        "paused:false,pending:[],seq:0,slideNo:0};\n"
        "narrTakeStart(R,A);T=3000;narrTakeEnd(R);\n"
        "narrTakeStart(R,B);T=3500;narrTakeEnd(R);\n"    # passed through
        "narrTakeStart(R,C);T=5500;narrTakeEnd(R);\n"
        "narrTakeStart(R,A);T=9500;narrTakeEnd(R);\n"    # A again: wins
        "Promise.all(R.pending).then(function(){\n"
        "  var out={};R.takes.forEach(function(v,s){out[s.n]=[v.dur,"
        "v.rec.mime,v.rec.src.slice(0,22)];});\n"
        "  console.log(JSON.stringify([R.base,out]));});\n")
    base, takes = _run(src)
    # the plain kind: ';codecs=' in a data URI defeats every reader
    assert base == "audio/webm"
    assert sorted(takes) == ["A", "C"]
    assert takes["A"][0] == 4.0          # the later take of A
    assert takes["C"] == [2.0, "audio/webm", "data:audio/webm;base64"]


def test_a_saved_deck_carries_the_narration_bytes():
    js = assets.deck_js()
    src = (lift_fn(js, "mediaStore") + "\nvar MEDIA;\n"
           + lift_fn(js, "mediaEmbed") + "\n"
           "MEDIA={'med:n':{src:'data:audio/webm;base64,AAAA',"
           "mime:'audio/webm',name:'Narration'}};\n"
           "var p={slides:[{annots:[]},{narr:{vkey:'med:n',dur:3}},"
           "{narr:{vkey:'med:gone',dur:2}}]};\n"
           "var n=mediaEmbed(p);console.log(JSON.stringify([n,p.media]));\n")
    n, media = _run(src)
    assert n == 1
    assert media == {"med:n": {"src": "data:audio/webm;base64,AAAA",
                               "mime": "audio/webm", "name": "Narration"}}
    warm = lift_fn(js, "mediaWarm")
    assert "if(nk&&!mediaStore()[nk]&&!seen[nk]){seen[nk]=1;mediaGet(nk);}" \
        in warm


def test_both_normalisers_keep_it_and_drop_the_malformed():
    js = assets.deck_js()
    assert ("          o.narr={vkey:s.narr.vkey};\n"
            "          if(+s.narr.dur>0) o.narr.dur=+s.narr.dur;") in js
    deck = {"name": "d", "slides": [
        {"layout": "blank", "panes": [],
         "narr": {"vkey": "med:a", "dur": 12.5, "junk": 1}},
        {"layout": "blank", "panes": [], "narr": {"vkey": ""}},
        {"layout": "blank", "panes": [], "narr": "med:x"},
        {"layout": "blank", "panes": [], "narr": {"vkey": "med:b",
                                                  "dur": True}},
    ]}
    out = as_presentations([deck])[0]["slides"]
    assert out[0]["narr"] == {"vkey": "med:a", "dur": 12.5}
    assert "narr" not in out[1] and "narr" not in out[2]
    assert out[3]["narr"] == {"vkey": "med:b"}
    assert "narr" in SLIDE_KEYS


def test_the_help_says_it_travels():
    helpp = assets.load("html/help.html")
    assert "<li><b>Record narration.</b>" in helpp
    assert "narration belongs to the deck" in helpp
