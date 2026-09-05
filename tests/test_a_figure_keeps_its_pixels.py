"""A placed figure is the deck's own, not a link to somewhere else.

The user, 2026-09-05: "most of the images, e.g. from notebooks or paths
can dissapear as they are kind of a sim lin. I think that all images
should be embedded into the thing, but should have the option to
refreshed from the path."

Three separate holes made that true, and each is closed here:

* EMBED was written on a DELIBERATE save (`embedAssets`) or an import
  and NOWHERE ELSE. A deck that had only ever autosaved carried refs and
  no pixels, so closing the notebook emptied it (T297).
* `embStore` writes MEMORY; `embSaveSoon` is what reaches IndexedDB, and
  `resyncFigure` never called it -- so even a deliberate per-figure
  refresh was gone on the next reload (T297).
* `cloneBody` read the open card FIRST and the deck's own copy only as a
  fallback, so re-running a notebook silently rewrote finished slides
  (T298). The kept copy wins now, and a live link is opt-in.

The T298 half RUNS: which copy a frame renders is a decision, and the
default matters more than any other line in this file. A substring can
see `refIsLive` being called and cannot see it answering wrongly.
"""

from __future__ import annotations

import json
import re
import subprocess
import tempfile
from pathlib import Path

import pytest

from junoview import assets

# `refIsLive`/`setRefLive` reach two collaborators that need a DOM or the
# item registry. Both are stubbed to the SHAPE that matters here: normRef
# namespaces a bare ref, dropFrameCache is a side effect with no answer.
_STUBS = """
var pres={};
var nsSeen=[];
function normRef(r){
  if(!r) return null;
  r=String(r);
  return r.indexOf('::')>=0?r:('nb::'+r);
}
function dropFrameCache(k){nsSeen.push(k);}
"""
_FNS = ("refIsLive", "setRefLive")


def _prelude() -> str:
    from helpers_js import lift_fn
    src = assets.deck_js()
    return _STUBS + "\n".join(lift_fn(src, f) for f in _FNS) + "\n"


def _run(script: str):
    from helpers_js import js_engine
    eng = js_engine()
    if eng is None:
        return None
    cmd, env = eng
    with tempfile.TemporaryDirectory() as d:
        p = Path(d) / "run.js"
        p.write_text(_prelude() + script, encoding="utf-8")
        r = subprocess.run(cmd + [str(p)], capture_output=True, text=True,
                           env=env, timeout=60)
        assert r.returncode == 0, r.stderr[:2000]
        line = [ln for ln in r.stdout.splitlines()
                if ln.startswith("{") or ln.startswith("[")][-1]
        return json.loads(line)


def _get(script):
    got = _run(script)
    if got is None:
        pytest.skip("no node or VS Code Electron on this machine")
    return got


# --------------------------------------------------------------- T298


def test_a_figure_is_kept_unless_you_ask_for_a_live_link():
    """The default is the whole feature. Every deck ever written carries
    no `live` key at all, and every one of them must render its own
    snapshots rather than reach for a notebook that may not be there."""
    got = _get("""
      console.log(JSON.stringify({
        noKey:refIsLive('clim'),
        emptyKey:(pres.live={},refIsLive('clim')),
        nullRef:refIsLive(null)
      }));
    """)
    assert got == {"noKey": False, "emptyKey": False, "nullRef": False}


def test_a_live_link_answers_to_both_spellings_of_its_ref():
    """A ref reaches `refIsLive` bare from an annotation written before
    the notebook was registered, and namespaced from everywhere else.
    One of those two spellings answering "kept" while the other answered
    "live" would render one frame from the notebook and its twin from
    the snapshot, on the same slide, with nothing to see."""
    got = _get("""
      pres={};
      setRefLive('clim',1);
      console.log(JSON.stringify({
        stored:Object.keys(pres.live),
        bare:refIsLive('clim'),
        namespaced:refIsLive('nb::clim')
      }));
    """)
    assert got["stored"] == ["nb::clim"], "stored under the namespaced key"
    assert got["bare"] is True and got["namespaced"] is True


def test_turning_a_live_link_off_leaves_nothing_behind():
    """`setRefLive(ref,0)` deletes BOTH spellings. A deck saved when only
    the bare key was cleared would come back live -- silently, and in the
    one direction the author explicitly opted out of."""
    got = _get("""
      pres={live:{'clim':1,'nb::clim':1}};
      setRefLive('clim',0);
      console.log(JSON.stringify({
        left:Object.keys(pres.live),
        live:refIsLive('clim'),
        dropped:nsSeen
      }));
    """)
    assert got["left"] == []
    assert got["live"] is False
    # the frame cache is keyed by ref and holds a node built from the
    # source that just changed; both spellings have to go
    assert "nb::clim" in got["dropped"] and "clim" in got["dropped"]


def test_the_kept_copy_is_read_before_the_open_card(out):
    """cloneBody's order IS the feature. The live card is still the
    fallback when the deck holds no snapshot -- an old deck, or a
    capture that failed -- because a stale figure beats a blank one."""
    assert ("    if(!refIsLive(ref)){\n"
            "      var kept=embBody(ref);\n"
            "      if(kept) return stripIds(kept.cloneNode(true));\n"
            "    }\n"
            "    var c=cardEl(ref);") in out


def test_the_facets_come_from_the_body_that_will_be_rendered(out):
    """cellFacets picking the part from the LIVE card while cloneBody
    rendered the kept one is how you get an empty frame: a re-run
    notebook that gained a plot makes the frame choose part 'figure'
    from a snapshot with no figure in it."""
    assert "    var kept=refIsLive(ref)?null:embBody(ref);" in out
    assert "    var card=kept?null:cardEl(ref);" in out
    assert "      body=kept||embBody(ref);" in out


def test_liveness_survives_the_python_rebuild():
    """The deck round-trips through presentations.py on every project
    save. A key normPres keeps but the rebuild drops dies quietly --
    which is the bug class tests/test_deck_schema_parity.py exists for,
    and this is its tenth instance."""
    src = (Path(__file__).resolve().parent.parent / "src" / "junoview"
           / "notebook" / "presentations.py").read_text(encoding="utf-8")
    lists = re.findall(r'for key in \(([^)]*)\):', src)
    assert lists, "the deck-key carry loop moved; this test is now blind"
    assert any('"live"' in g for g in lists), lists


# --------------------------------------------------------------- T297


def test_placing_a_figure_keeps_its_pixels_there_and_then(out):
    """The click that puts a card on a slide is the only moment the deck
    can be sure the notebook is open. Before T297 nothing was captured
    until a deliberate save, which for an autosaved draft never came."""
    assert "  function embedIfAbsent(a){" in out
    assert "    if(!ref||embFor(ref)) return 0;" in out
    assert ("    target.ref=ref;\n"
            "    /* T297: keep the pixels NOW, while the notebook is "
            "definitely open") in out
    assert "    if(typeof embedIfAbsent==='function') embedIfAbsent(target);" \
        in out


def test_placing_the_same_figure_twice_does_not_re_read_it(out):
    """`embFor(ref)` short-circuits. Dropping a figure onto a second
    slide must not silently re-read the notebook underneath the first
    one -- that is a refresh, and a refresh asks."""
    assert "    if(!ref||embFor(ref)) return 0;" in out


def test_the_capture_reaches_the_disk(out):
    """embStore writes memory only. One capture point, and it persists
    -- so there is one answer to "is this kept" rather than one per
    caller."""
    body = out[out.index("function embedCapture(ref,live){"):]
    body = body[:body.index("function embedIfAbsent")]
    assert "embStore(normRef(ref)||ref,e);" in body
    assert "embSaveSoon();" in body


# --------------------------------------------------------------- T299


def test_the_source_options_are_in_the_images_tab(out):
    """2026-09-05: "All these optoins should be in the images tab btw".
    The row already showed the path; the number, the commit, the refresh
    and the live-link switch join it there rather than on the ribbon."""
    assert "  function imgActs(r){" in out
    assert "    mid.appendChild(imgActs(r));" in out
    # words, not more glyphs: the lock chip beside them is already
    # icon-only, and three more would be four mysteries in a 260px pane
    assert "      b.textContent=label;b.title=title;" in out


def test_refresh_is_one_figure_and_says_so(out):
    """The user, 2026-09-05: "The update figures button that applies to
    all where it is right nwo is just too dangerous and I have lost too
    many things." The per-row verb names its scope in the tooltip."""
    assert "  function imgRefreshRow(r){" in out
    assert "      refreshImagesReport([{si:r.si,ai:r.ai,a:a2}]);" in out
    assert "    if(!resyncFigure(a2)){" in out
    assert "\\u2014 only this one'" in out
    # a picture with no file behind it says so instead of failing silently
    assert ("      if(!a2.fkey){toast('This picture was pasted or dropped "
            "— there is '") in out


def test_the_live_switch_says_what_it_will_do_on_hover(out):
    """2026-09-05: "there should be an option 'make sym link', and then
    on hover tell them it will load from path each time." Both states
    explain themselves, because either one can be the surprising one."""
    assert ("          ?('Loads from the notebook every time this deck "
            "opens. If the '") in out
    assert ("          :('The copy in the deck is what you see, so it "
            "cannot go '") in out
    assert "      act(live?'Live link':'Kept'," in out


def test_a_notebook_figure_shows_its_number_and_its_commit(out):
    """2026-09-05: "One that are form notebooks should have the notebook
    url, then the image number and also the git commit. With another
    option of 'update to current git commit'."

    The number counts FIGURES, not cards -- that is what a person means
    by "the image number" -- and is empty when the notebook is shut,
    because an ordinal nobody can check is worse than none."""
    assert "  function figNumber(ref){" in out
    assert "    return i<0?'':('figure '+(i+1)+' of '+ord.length);" in out
    assert "      try{if(cellFacets(k).figure) out.push(k);}catch(e){}" in out
    # the commit, and the one verb that moves it
    assert "        var lv=r.a.lockver&&r.a.lockver.commit;" in out
    assert "        act(lv?String(lv):'Pin to commit'," in out
    assert ("             +' \\u2014 click to move it to the notebook"
            "\\u2019s current '") in out
    # a pin needs a repository to point into
    assert "      if(APP.mode==='app'){" in out


# --------------------------------------------------------------- T300


def test_all_four_placement_doors_capture(out):
    """The mapping pass found four gestures that give a frame a ref, not
    one: the strip's click-to-place, the picker's cell branch, the
    picker's flip branch, and pickAdd filling a flip book. Capturing in
    one of them would have been the same bug with a smaller blast
    radius."""
    assert out.count("embedIfAbsent(a);") + out.count(
        "embedIfAbsent(target);") >= 4
    # the flip book reads the SELECTED frame, so a.at is set first
    assert ("    a.at=a.frames.length-1;\n"
            "    /* T300: and keep its pixels, like every other placement "
            "door --") in out
    assert ("        a.at=a.frames.length-1;\n"
            "        if(typeof embedIfAbsent==='function') "
            "embedIfAbsent(a);") in out


def test_the_lean_autosave_no_longer_wipes_the_files_figures():
    """save_presentations replaces the whole array, and the editor
    autosaves the LEAN form 1.2s after every keystroke -- so
    junoview_project.json lost every `emb` block and sat refs-only for
    most of an editing session, regaining them only on a deliberate Save
    or 20 idle seconds. Omission is not deletion."""
    from junoview.server.state import _keep_embedded

    old = [{"name": "talk", "slides": [], "emb": {"nb::a": {"html": "<i>"}}}]
    # the lean write: same deck, no emb key at all
    lean = [{"name": "talk", "slides": [1]}]
    got = _keep_embedded(old, lean)
    assert got[0]["emb"] == {"nb::a": {"html": "<i>"}}
    assert got[0]["slides"] == [1], "the incoming content still wins"


def test_an_explicit_empty_emb_still_clears_it():
    """A deck that no longer has a placed figure sends `emb: {}` on its
    deliberate Save. Carrying the old block forward there would make a
    removed figure immortal in the file."""
    from junoview.server.state import _keep_embedded

    old = [{"name": "talk", "emb": {"nb::a": {"html": "<i>"}}}]
    got = _keep_embedded(old, [{"name": "talk", "emb": {}}])
    assert got[0]["emb"] == {}


def test_the_carry_forward_does_not_leak_between_decks():
    """Keyed by name. A project holds several decks and the array is
    replaced wholesale, so a mismatch here would graft one deck's
    figures onto another's refs."""
    from junoview.server.state import _keep_embedded

    old = [{"name": "talk", "emb": {"nb::a": {"html": "<i>"}}},
           {"name": "poster"}]
    got = _keep_embedded(old, [{"name": "poster"}, {"name": "talk"}])
    assert "emb" not in got[0]
    assert got[1]["emb"] == {"nb::a": {"html": "<i>"}}


def test_a_deck_that_is_gone_does_not_come_back():
    """The carry-forward adds keys to decks the write mentions. It must
    never re-add a DECK the write dropped -- deleting one is exactly
    what the whole-array replace is for."""
    from junoview.server.state import _keep_embedded

    old = [{"name": "talk", "emb": {"nb::a": {"html": "<i>"}}},
           {"name": "poster", "emb": {"nb::b": {"html": "<i>"}}}]
    got = _keep_embedded(old, [{"name": "talk"}])
    assert [p["name"] for p in got] == ["talk"]


def test_the_commit_date_is_not_mangled_on_the_way_out():
    """Git on Windows takes its command line through the ANSI codepage,
    so the "·" that used to sit in the --date format came back as a
    replacement character -- and rode into the deck's saved
    `lockver.date`, seen on disk in junoview_project.json on 2026-09-05.
    ASCII on the wire, the separator added here."""
    src = (Path(__file__).resolve().parent.parent / "src" / "junoview"
           / "server" / "vcs.py").read_text(encoding="utf-8")
    assert '"--date=format:%d %b %Y @ %H:%M"' in src
    assert '.replace(" @ ", " \u00b7 ")' in src
    assert "%d %b %Y \u00b7 %H:%M" not in src, "the separator is back on the wire"
