"""Native video and audio (T321).

The user's list, item 2: "Native video and audio with trimming, poster
frames, playback controls, offline copies and export support".

A clip is an item like a picture, but its bytes never sit in `pres`: a
deck lives in localStorage between saves and one film would empty the
budget. They live under `vkey` in the picture-original store and ride
into every self-contained save as `p.media`, the way placed figures
ride in `p.emb` -- so the .junoview file and the project file play with
no file beside them. The arithmetic (trim, clock, kind) is lifted and
RUN; the writer is driven through JunoPptx.build and read back with the
T320 reader, which is the export contract made checkable.
"""

from __future__ import annotations

import base64
import io
import json
import subprocess
import tempfile
import zipfile
from pathlib import Path

import pytest

import pptx_fixture
from junoview import assets
from junoview.notebook.pptx_read import read_pptx

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "src" / "junoview"

MP4 = b"\x00\x00\x00\x18ftypmp42\x00\x00\x00\x00mp42isom" + b"\x00" * 40
MP3 = b"ID3\x03\x00\x00\x00\x00\x00\x00" + b"\xff\xfb\x90\x00" * 8


def _uri(mime: str, data: bytes) -> str:
    return f"data:{mime};base64," + base64.b64encode(data).decode("ascii")


def _engine():
    from helpers_js import js_engine
    eng = js_engine()
    if eng is None:
        pytest.skip("no node or VS Code Electron on this machine")
    return eng


# ------------------------------------------------------------ the writer


SPEC = {
    "title": "clips", "widthMm": 339, "heightMm": 191, "bg": "#0b141d",
    "slides": [{"bg": "#0b141d", "trans": "", "notes": "", "items": [
        {"t": "video", "x": 10, "y": 10, "w": 40, "h": 22.5,
         "src": _uri("video/mp4", MP4), "poster": _uri("image/png",
                                                       pptx_fixture.png()),
         "name": "Onset", "alt": "the storm arriving"},
        {"t": "video", "x": 60, "y": 60, "w": 30, "h": 8, "audio": True,
         "src": _uri("audio/mpeg", MP3), "poster": _uri("image/png",
                                                        pptx_fixture.png()),
         "name": "Narration"},
    ]}]}


@pytest.fixture(scope="module")
def written() -> tuple[bytes, dict]:
    _engine()
    from helpers_js import build_pptx
    data, report = build_pptx(json.loads(json.dumps(SPEC)))
    return data, report


def test_a_clip_is_a_real_powerpoint_media_shape(written):
    """The 2006 videoFile link every reader understands AND the 2010
    p14:media embed that makes it play in PowerPoint; the poster is the
    picture everyone sees; ppaction://media is PowerPoint's own click."""
    data, report = written
    assert report["skipped"] == 0
    z = zipfile.ZipFile(io.BytesIO(data))
    names = set(z.namelist())
    assert "ppt/media/media1.mp4" in names and "ppt/media/image2.png" in names
    assert z.read("ppt/media/media1.mp4") == MP4
    assert z.read("ppt/media/image2.png") == pptx_fixture.png()
    xml = z.read("ppt/slides/slide1.xml").decode("utf-8")
    assert '<a:videoFile r:link="rId1"/>' in xml
    assert ('xmlns:p14="http://schemas.microsoft.com/office/powerpoint/'
            '2010/main" r:embed="rId2"') in xml
    assert 'action="ppaction://media"' in xml
    assert 'name="Onset"' in xml and 'descr="the storm arriving"' in xml
    rels = z.read("ppt/slides/_rels/slide1.xml.rels").decode("utf-8")
    assert 'relationships/video" Target="../media/media1.mp4"' in rels
    assert ('http://schemas.microsoft.com/office/2007/relationships/media"'
            ' Target="../media/media1.mp4"') in rels
    ct = z.read("[Content_Types].xml").decode("utf-8")
    assert '<Default Extension="mp4" ContentType="video/mp4"/>' in ct
    assert '<Default Extension="mp3" ContentType="audio/mpeg"/>' in ct


def test_an_audio_clip_is_an_audioFile(written):
    data, _ = written
    z = zipfile.ZipFile(io.BytesIO(data))
    xml = z.read("ppt/slides/slide1.xml").decode("utf-8")
    assert '<a:audioFile r:link="rId4"/>' in xml
    assert z.read("ppt/media/media3.mp3") == MP3


def test_the_round_trip_brings_the_clip_back(written):
    """Out through the writer, back through the T320 reader: bytes,
    poster, which of the two it is, and nothing in the loss report."""
    data, _ = written
    got = read_pptx(data, "clips.pptx")
    assert got["lost"] == []
    items = got["spec"]["slides"][0]["items"]
    vid = [it for it in items if it["t"] == "video"]
    assert len(vid) == 2
    v, a = vid
    assert base64.b64decode(v["src"].split(",", 1)[1]) == MP4
    assert v["mime"] == "video/mp4" and v["audio"] is False
    assert base64.b64decode(v["poster"].split(",", 1)[1]) == pptx_fixture.png()
    assert v["name"] == "Onset" and v["alt"] == "the storm arriving"
    assert (v["x"], v["y"], v["w"], v["h"]) == pytest.approx(
        (10, 10, 40, 22.5), abs=0.05)
    assert base64.b64decode(a["src"].split(",", 1)[1]) == MP3
    assert a["mime"] == "audio/mpeg" and a["audio"] is True


def test_a_clip_no_browser_plays_is_named(written):
    """wmv is PowerPoint's own; the poster arrives, the clip is said."""
    data, _ = written
    src = zipfile.ZipFile(io.BytesIO(data))
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as z:
        for info in src.infolist():
            body = src.read(info.filename)
            name = info.filename
            if name == "ppt/media/media1.mp4":
                name = "ppt/media/media1.wmv"
            elif name == "ppt/slides/_rels/slide1.xml.rels":
                body = body.replace(b"media1.mp4", b"media1.wmv")
            z.writestr(name, body)
    got = read_pptx(buf.getvalue())
    items = got["spec"]["slides"][0]["items"]
    assert [it["t"] for it in items] == ["image", "video"]
    assert any("no browser plays (wmv)" in ln for ln in got["lost"])


# --------------------------------------------------------- the arithmetic

_FNS = ("mediaClock", "mediaTrimOf", "mediaTrimTidy", "mediaKind",
        "mediaLabel")


def _run(script: str):
    from helpers_js import lift_fn
    cmd, env = _engine()
    src = assets.deck_js()
    pre = "\n".join(lift_fn(src, f) for f in _FNS) + "\n"
    with tempfile.TemporaryDirectory() as d:
        p = Path(d) / "run.js"
        p.write_text(pre + script, encoding="utf-8")
        r = subprocess.run(cmd + [str(p)], capture_output=True, text=True,
                           encoding="utf-8", env=env, timeout=60)
        assert r.returncode == 0, r.stderr[:2000]
        return json.loads([ln for ln in r.stdout.splitlines()
                           if ln.startswith("{")][-1])


def test_trim_resolves_against_the_length():
    """A start past the end or an end before the start is the whole clip,
    never silence; an end of 0 means 'to the end'."""
    got = _run("""
      var out={
        whole:mediaTrimOf({dur:30}),
        cut:mediaTrimOf({dur:30,trim:{s:5,e:12}}),
        open:mediaTrimOf({dur:30,trim:{s:5,e:0}}),
        bad:mediaTrimOf({dur:30,trim:{s:20,e:10}}),
        past:mediaTrimOf({dur:30,trim:{s:40,e:50}}),
        nodur:mediaTrimOf({trim:{s:2,e:9}})};
      out.whole.e=out.whole.e===Infinity?'inf':out.whole.e;
      out.open.e=out.open.e===Infinity?'inf':out.open.e;
      out.past.e=out.past.e===Infinity?'inf':out.past.e;
      console.log(JSON.stringify(out));
    """)
    assert got["whole"] == {"s": 0, "e": 30}
    assert got["cut"] == {"s": 5, "e": 12}
    assert got["open"] == {"s": 5, "e": 30}
    assert got["bad"] == {"s": 0, "e": 30}
    assert got["past"] == {"s": 0, "e": 30}
    assert got["nodur"] == {"s": 2, "e": 9}


def test_tidy_drops_a_trim_that_means_nothing():
    got = _run("""
      var a={dur:20,trim:{s:0,e:0}};mediaTrimTidy(a);
      var b={dur:20,trim:{s:3.26,e:9.94}};mediaTrimTidy(b);
      var c={dur:20,trim:{s:12,e:5}};mediaTrimTidy(c);
      console.log(JSON.stringify({a:a.trim||null,b:b.trim,c:c.trim}));
    """)
    assert got["a"] is None
    assert got["b"] == {"s": 3.3, "e": 9.9}
    assert got["c"] == {"s": 12, "e": 0}        # end before start: open


def test_the_clock_and_the_kind():
    got = _run("""
      console.log(JSON.stringify({
        c:[mediaClock(0),mediaClock(9.6),mediaClock(65),mediaClock(3600)],
        k:[mediaKind({type:'video/mp4',name:'a.mp4'}),
           mediaKind({type:'audio/mpeg',name:'a.mp3'}),
           mediaKind({type:'',name:'clip.MOV'}),
           mediaKind({type:'',name:'song.flac'}),
           mediaKind({type:'image/png',name:'a.png'})],
        l:[mediaLabel({name:'Onset',dur:12.4}),
           mediaLabel({audio:1,dur:65,trim:{s:5,e:15}}),
           mediaLabel({})]}));
    """)
    assert got["c"] == ["0:00", "0:10", "1:05", "60:00"]
    assert got["k"] == ["video", "audio", "video", "audio", ""]
    assert got["l"] == ["Video — Onset · 0:12", "Audio · 0:10", "Video"]


def test_a_self_contained_save_carries_every_clip_once():
    """mediaEmbed writes p.media from the session store: one entry per
    clip however many slides place it, and nothing for a clip the store
    does not hold (which the server then carries forward)."""
    from helpers_js import lift_fn
    cmd, env = _engine()
    src = assets.deck_js()
    script = ("var MEDIA={'med:a':{src:'data:video/mp4;base64,AAAA',"
              "mime:'video/mp4',name:'a.mp4'}};\n"
              + lift_fn(src, "mediaEmbed") + "\n"
              "var p={slides:[{annots:[{k:'video',vkey:'med:a'},"
              "{k:'image',src:'x'}]},{annots:[{k:'video',vkey:'med:a'},"
              "{k:'video',vkey:'med:gone'}]}]};\n"
              "var n=mediaEmbed(p);\n"
              "console.log(JSON.stringify({n:n,media:p.media}));\n")
    with tempfile.TemporaryDirectory() as d:
        pth = Path(d) / "run.js"
        pth.write_text(script, encoding="utf-8")
        r = subprocess.run(cmd + [str(pth)], capture_output=True, text=True,
                           encoding="utf-8", env=env, timeout=60)
        assert r.returncode == 0, r.stderr[:2000]
        got = json.loads([ln for ln in r.stdout.splitlines()
                          if ln.startswith("{")][-1])
    assert got["n"] == 1
    assert got["media"] == {"med:a": {"src": "data:video/mp4;base64,AAAA",
                                      "mime": "video/mp4", "name": "a.mp4"}}


# ------------------------------------------------------- offline copies


def test_the_bytes_never_sit_in_pres_but_ride_every_save(out):
    """The store, the absorb on the way in, the embed on the way out --
    and the render branch reading from the store, never from the item."""
    assert "  var MEDIA={};" in out
    norm = out.split("function normPres(p,stem){")[1].split(
        "\n  function registerShell(")[0]
    assert "mediaAbsorb(p);" in norm
    emb = out.split("function embedAssets(list){")[1].split("\n  }")[0]
    assert "if(typeof mediaEmbed==='function') mediaEmbed(p);" in emb
    branch = out.split("} else if(a.k==='video'){")[1].split(
        "} else if(a.k==='flip'){")[0]
    assert "mv.appendChild(mediaElement(a,i,editing,inlineSrc));" in branch
    assert "layer.closest('#print-root')" in branch
    # every path that installs a deck warms its clips
    load = out.split("function loadPresentation(name){")[1].split("\n  }")[0]
    assert "if(typeof mediaWarm==='function') mediaWarm(pres);" in load


def test_python_carries_media_like_emb():
    from junoview.notebook.deck_schema import ANNOT_KINDS, DECK_KEYS
    from junoview.notebook.presentations import as_presentations
    from junoview.server.state import _keep_embedded
    assert "media" in DECK_KEYS and "video" in ANNOT_KINDS
    deck = {"name": "d", "slides": [{"layout": "blank", "annots": [
        {"k": "video", "x": 1, "y": 1, "vkey": "med:a"}]}],
        "media": {"med:a": {"src": "data:video/mp4;base64,AAAA",
                            "mime": "video/mp4", "name": "a.mp4"},
                  "bad": {"src": ""}, 7: {"src": "x"}}}
    kept = as_presentations([deck])[0]
    assert kept["media"] == {"med:a": {"src": "data:video/mp4;base64,AAAA",
                                       "mime": "video/mp4", "name": "a.mp4"}}
    # a lean autosave omits it; the server keeps what it held
    old = [{"name": "d", "slides": [], "emb": {"r": {"html": "<p>"}},
            "media": {"med:a": {"src": "data:x"}}}]
    new = [{"name": "d", "slides": []}]
    back = _keep_embedded(old, new)[0]
    assert back["media"] == {"med:a": {"src": "data:x"}}
    assert back["emb"] == {"r": {"html": "<p>"}}
    # an explicit (even empty) block replaces it
    back2 = _keep_embedded(old, [{"name": "d", "slides": [],
                                  "media": {}}])[0]
    assert back2["media"] == {} and back2["emb"] == {"r": {"html": "<p>"}}
    doc = (ROOT / "DECK-FORMAT.md").read_text(encoding="utf-8")
    assert "| `media` | dict |" in doc and "| `video` | `x`, `y` |" in doc


# ----------------------------------------------------------- the doors


def test_the_doors(out):
    """Insert > Video / audio, a drop on the slide, the Object tab's Clip
    options and its pane, the pptx importer -- and the one boot call."""
    html = assets.deck_html()
    assert 'id="et-media"' in html
    assert '<input type="file" id="media-file" accept="video/*,audio/*"' in html
    assert 'id="fmt-mediawrap" hidden' in html and 'id="fmt-media"' in html
    assert 'id="mediapane" hidden' in html and 'id="md-preview"' in html
    for i in ("md-start", "md-end", "md-start-now", "md-end-now",
              "md-poster-now", "md-poster-file", "md-ctrl", "md-auto",
              "md-loop", "md-mute"):
        assert f'id="{i}"' in html, i
    assert "49-media" in assets.DECK_PARTS
    assert "  mediaBoot();" in (SRC / "assets" / "js" / "deck"
                                / "99-boot.js").read_text("utf-8")
    boot = out.split("function mediaBoot(){")[1].split("\n  }")[0]
    assert "et.addEventListener('click',function(){fi.value='';fi.click();});" in boot
    assert "window.SemApp.deckDropMedia=function(file){" in boot
    assert "    '#fmt-mediawrap':'video'," in out
    assert out.count("'et-image','et-media',") >= 3
    assert out.count("'fmt-mediawrap','fmt-cropwrap','fmt-lockar'") >= 8
    app = assets.app_js()
    drop = app.split("window.addEventListener('drop',function(e){")[1]
    assert "if(APP.deckDropMedia(f)) tookM++;" in drop
    # the importer lands a .pptx clip in the store
    imp = out.split("function pptxSettleImages(pr){")[1].split("\n  }")[0]
    assert "a.vkey=key;delete a.src;delete a.mime;" in imp
    from junoview.branding import icons_map
    assert "film" in icons_map()
    assert "Video / audio" in assets.help_html()


def test_a_click_on_a_clip_never_advances_the_talk(out):
    """Present mode: a plain click advances (the standing rule), so the
    clip claims only itself -- and the space bar on a focused clip is
    play/pause, not next."""
    click = out.split("var mvc=e.target.closest&&e.target.closest('.an-video');")[1]
    click = click.split("var lk=e.target.closest")[0]
    assert "e.stopPropagation();" in click
    assert "if(me.paused) me.play().catch(function(){}); else me.pause();" in click
    assert "      if(tag==='video'||tag==='audio') return;" in out
    # and the next slide's clips start afresh
    go = out.split("  function go(n){")[1].split("\n  }")[0]
    assert "mediaForget();" in go


def test_exports_carry_the_clip(out):
    """pptxOriginals fetches the bytes by vkey, pptxItems hands the writer
    a media item (an audio clip on a generated tile), and the print root
    -- PDF and standalone HTML -- gets the bytes inline."""
    orig = out.split("function pptxOriginals(){")[1].split("\n  }")[0]
    assert "jobs.push(mediaGet(a.vkey).then(function(r){" in orig
    items = out.split("} else if(a.k==='video'){\n        /* T321: the clip "
                      "and its poster")[1]
    items = items.split("} else if(a.k==='rect'){")[0]
    assert "var vpost=a.poster||(a.audio?mediaTile(a):'');" in items
    assert "items.push({t:'video'," in items
    el = out.split("function mediaElement(a,i,editing,inline){")[1].split(
        "\n  }")[0]
    assert "if(inline){if(rec) v.src=rec.src;}" in el
    assert "v.controls=!editing&&a.ctrl!==0;" in el
    # trim is enforced by the element's own clock, and a rebuild resumes
    assert "if(tr.e<Infinity&&v.currentTime>=tr.e){" in el
    assert "var key=cur+':'+i,st=mediaState[key];" in el
