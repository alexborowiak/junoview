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
    assert ("    if(!fromLive&&!refIsLive(ref)){\n"
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
    assert "      if(!ref||embFor(ref)) return;" in out
    assert ("    target.ref=ref;\n"
            "    /* T297: keep the pixels NOW, while the notebook is "
            "definitely open") in out
    assert "    if(typeof embedIfAbsent==='function') embedIfAbsent(target);" \
        in out


def test_placing_the_same_figure_twice_does_not_re_read_it(out):
    """`embFor(ref)` short-circuits. Dropping a figure onto a second
    slide must not silently re-read the notebook underneath the first
    one -- that is a refresh, and a refresh asks."""
    assert "      if(!ref||embFor(ref)) return;" in out


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


# --------------------------------------------------------------- T301

_STORE_STUBS = """
var EMBED={},embItems={},pres={slides:[],live:{}},cur=0,saved=0,dirty=0;
var stage={querySelector:function(){return null;}};
function dropFrameCache(){}
function embSaveSoon(){saved++;}
function markDirty(){dirty++;}
function renderAnnots(){}
function normRef(r){return r?String(r):null;}
"""


def _store_run(script):
    from helpers_js import js_engine, lift_fn
    eng = js_engine()
    if eng is None:
        pytest.skip("no node or VS Code Electron on this machine")
    cmd, env = eng
    src = assets.deck_js()
    body = "\n".join(lift_fn(src, f) for f in
                     ("embStore", "embRestore", "refIsLive", "setRefLive"))
    # EMBPREV is declared beside embStore, not inside it
    pre = _STORE_STUBS + "var EMBPREV={};\n" + body + "\n"
    with tempfile.TemporaryDirectory() as d:
        p = Path(d) / "run.js"
        p.write_text(pre + script, encoding="utf-8")
        r = subprocess.run(cmd + [str(p)], capture_output=True, text=True,
                           env=env, timeout=60)
        assert r.returncode == 0, r.stderr[:2000]
        line = [ln for ln in r.stdout.splitlines() if ln.startswith("{")][-1]
        return json.loads(line)


def test_a_refresh_keeps_the_copy_it_replaced():
    """embStore assigns straight over the one slot this store has per
    ref. Nothing else in the deck can put a figure back: histState does
    not carry EMBED, and a resync changes nothing inside `pres`, so
    histPush's early return means no undo entry is pushed AT ALL and
    Ctrl+Z rewinds the previous slide edit instead."""
    got = _store_run("""
      embStore('nb::a',{title:'t',kind:'figure',html:'<i>OLD</i>'});
      var afterFirst=EMBPREV['nb::a']||null;
      embStore('nb::a',{title:'t',kind:'figure',html:'<i>NEW</i>'});
      console.log(JSON.stringify({
        firstWriteKeptNothing:afterFirst,
        now:EMBED['nb::a'].html,
        prev:EMBPREV['nb::a'].html
      }));
    """)
    # the FIRST write has nothing to displace, so it remembers nothing
    assert got["firstWriteKeptNothing"] is None
    assert got["now"] == "<i>NEW</i>"
    assert got["prev"] == "<i>OLD</i>"


def test_putting_it_back_restores_and_persists():
    """The restore has to reach the disk too: embStore writes memory,
    and the 20-second autosave was already writing the bad copy over
    the good one."""
    got = _store_run("""
      embStore('nb::a',{title:'t',kind:'figure',html:'<i>OLD</i>'});
      embStore('nb::a',{title:'t',kind:'figure',html:'<i>NEW</i>'});
      var n=embRestore(['nb::a']);
      console.log(JSON.stringify({
        n:n.n, html:EMBED['nb::a'].html,
        prevGone:!EMBPREV['nb::a'], persisted:saved, dirtied:dirty
      }));
    """)
    assert got == {"n": 1, "html": "<i>OLD</i>", "prevGone": True,
                   "persisted": 1, "dirtied": 1}


def test_putting_back_twice_does_nothing_the_second_time():
    """One step deep, not a history. The second press must say nothing
    rather than claim a restore it did not make -- and must not put the
    figure back to something older still."""
    got = _store_run("""
      embStore('nb::a',{title:'t',kind:'figure',html:'<i>OLD</i>'});
      embStore('nb::a',{title:'t',kind:'figure',html:'<i>NEW</i>'});
      embRestore(['nb::a']);
      var second=embRestore(['nb::a']);
      console.log(JSON.stringify({second:second.n,html:EMBED['nb::a'].html}));
    """)
    assert got == {"second": 0, "html": "<i>OLD</i>"}


def test_a_ref_with_nothing_behind_it_is_not_counted():
    """embRestore's count is what the toast reports. Counting a ref that
    had nothing to go back to would promise a recovery that did not
    happen."""
    got = _store_run("""
      embStore('nb::a',{title:'t',kind:'figure',html:'<i>ONLY</i>'});
      console.log(JSON.stringify({
        n:embRestore(['nb::a','nb::never']).n,
        untouched:EMBED['nb::a'].html, persisted:saved}));
    """)
    assert got["n"] == 0
    assert got["untouched"] == "<i>ONLY</i>"
    assert got["persisted"] == 0, "nothing changed, so nothing is written"


def test_the_deck_wide_update_ends_in_a_way_out(out):
    """The user, 2026-09-05: "The update figures button that applies to
    all where it is right nwo is just too dangerous and I have lost too
    many things." The verb is unchanged; the sentence announcing it now
    ends in a way back."""
    assert "  function toastUndo(msg,label,fn,ms){" in out
    assert "          toastUndo(resyncMsg(reread,bad,n,list.length)," in out
    assert "            'Put them back'," in out
    assert "              var back=embRestore(touched);" in out
    # ...and the per-row refresh, which is the safe one, still offers it
    assert ("    toastUndo('Re-read from the notebook, and kept.',"
            "'Put it back'," in out)
    # a run that changed nothing says so with a plain toast
    assert "        else toast(resyncMsg(reread,bad,n,list.length)," in out


def test_the_refresh_reports_only_what_it_actually_changed(out):
    """`touched` is built from the resyncs that RETURNED 1, not from the
    stale list -- a figure whose notebook went away mid-run has nothing
    to put back and must not be offered."""
    # T307: and it refreshes the SOURCE the entry named. staleFigures
    # emits one entry per source now, so a flip book's other pages are
    # no longer left behind by a refresh that claims to cover them --
    # and `touched` dedupes, because two pages can share a ref.
    assert ("      list.forEach(function(p){\n"
            "        if(!resyncFigure(p.a,p.ref)) return;\n"
            "        n++;\n"
            "        var k=normRef(p.ref||provRef(p.a));\n"
            "        if(k&&touched.indexOf(k)<0) touched.push(k);\n"
            "      });") in out
    assert "        if(touched.length)" in out


def test_putting_back_a_live_link_actually_changes_what_you_see():
    """Found by driving, not by reading. "Put it back" is a promise
    about what you SEE, and a live link renders from the notebook -- so
    restoring the snapshot under one changed the store and nothing on
    the screen, while the toast reported success.

    A 74,606-character figure was replaced by a 122-character one, the
    undo said it had worked, and the wrong figure stayed on the slide.
    Undo and "always show me the notebook's current version" are in
    direct conflict; the click just made is the more explicit of the
    two, so the restore unlinks -- and reports that it did, because a
    silent mode change is its own surprise."""
    got = _store_run("""
      pres={slides:[],live:{}};
      setRefLive('nb::a',1);
      embStore('nb::a',{title:'t',kind:'figure',html:'<i>OLD</i>'});
      embStore('nb::a',{title:'t',kind:'figure',html:'<i>NEW</i>'});
      var r=embRestore(['nb::a']);
      console.log(JSON.stringify({
        n:r.n, unlinked:r.unlinked,
        stillLive:refIsLive('nb::a'), html:EMBED['nb::a'].html}));
    """)
    assert got == {"n": 1, "unlinked": 1, "stillLive": False,
                   "html": "<i>OLD</i>"}


def test_a_kept_figure_restored_reports_no_unlinking():
    """The common case must not claim a mode change that did not
    happen."""
    got = _store_run("""
      pres={slides:[],live:{}};
      embStore('nb::a',{title:'t',kind:'figure',html:'<i>OLD</i>'});
      embStore('nb::a',{title:'t',kind:'figure',html:'<i>NEW</i>'});
      var r=embRestore(['nb::a']);
      console.log(JSON.stringify({n:r.n,unlinked:r.unlinked}));
    """)
    assert got == {"n": 1, "unlinked": 0}


def test_both_undo_toasts_read_the_new_shape(out):
    """embRestore returns {n, unlinked}; a caller still treating it as a
    number would report "Back to the figures" for a restore of nothing,
    because {} is truthy."""
    assert "              var back=embRestore(touched);" in out
    assert "              toast(back.n" in out
    assert "        var back=embRestore(k?[k]:[]);" in out
    assert "        toast(back.n" in out
    # and each says so when the mode changed under them
    assert ("+' kept copies again rather than live links'):''))") in out
    assert ("            +(back.unlinked?' \\u2014 and it is a kept copy "
            "again, not a '") in out


# --------------------------------------------------------------- T302


def test_asking_the_notebook_is_a_different_question(out):
    """T298 made cloneBody prefer the kept copy, and three callers that
    mean "what does the NOTEBOOK say" went through it: the staleness
    comparison, the capture it feeds, and a chart re-reading its table.

    So provState compared the kept copy against the kept copy, nothing
    was ever stale, "Update figures" answered "every figure already
    matches" against a notebook that had visibly moved on, and the
    refresh had nothing new to store. The whole refresh feature was
    dead. Driving it caught this; no substring assertion in this file
    would have."""
    assert "  function cloneBody(ref,fromLive){" in out
    assert "    if(!fromLive&&!refIsLive(ref)){" in out
    assert "      var b=cloneBody(ref,1);      /* the NOTEBOOK's answer" in out
    assert "      var b=cloneBody(ref,1); if(!b) return null;   /* live" in out


def test_the_render_and_the_save_still_show_what_the_deck_shows(out):
    """framePart and embedAssets deliberately do NOT pass the flag: one
    draws the frame and the other writes the self-contained file, and
    both must agree with what is on the slide. A save that re-read the
    notebook would be the danger the user reported, happening quietly on
    Ctrl+S."""
    assert "      b=cloneBody(ref);\n" in out
    assert "            var b=cloneBody(ref);\n            if(!b) return;" in out
    # T303: the code facet goes through frameCode, which applies the same
    # kept-first preference. cloneCode itself stays live-first, because
    # two of its five callers -- openVFull and the review step box --
    # show a NOTEBOOK cell's code rather than a deck frame.
    assert "    if(part==='code') b=frameCode(ref)||cloneBody(ref);" in out
    assert "      b=b?applyPartFilter(b,part):frameCode(ref);" in out
    assert "            var cc=it.hasCode?frameCode(ref):null;" in out


def test_a_write_that_changes_nothing_is_not_a_step_to_undo():
    """embedAssets re-stores what it just read on every deliberate save.
    Each of those would otherwise overwrite the one slot holding the
    copy a real refresh replaced -- so saving twice after a bad refresh
    would quietly throw away the way back."""
    got = _store_run("""
      embStore('nb::a',{title:'t',kind:'figure',html:'<i>OLD</i>'});
      embStore('nb::a',{title:'t',kind:'figure',html:'<i>NEW</i>'});
      embStore('nb::a',{title:'t',kind:'figure',html:'<i>NEW</i>'});
      console.log(JSON.stringify({prev:EMBPREV['nb::a'].html}));
    """)
    assert got == {"prev": "<i>OLD</i>"}, "the identical re-save kept the way back"


# ---------------------------------------------------------- T303-T305
#
# An adversarial review of T297-T302 found that "the kept copy is what
# you see" was true of cloneBody and of almost nothing else. Each of
# these is a surface that still read the notebook, or a place the new
# deck key fell through.


def test_the_thumbnails_match_the_slide(out):
    """paneImgSrc read the live card first -- the order T298 inverted --
    and it is miniDiagram's cell branch. So the film strip, the slide
    overview, the outline sheet, the history rows, the layout-card
    previews, the saved-arrangement thumbnails and the trace overview
    all repainted with the notebook's current figure while the slide
    kept the old one. An index that does not match the deck has failed
    at the one job it has."""
    assert ("  function paneImgSrc(ref){\n"
            "    var kept=(!ref||refIsLive(ref))?null:embBody(ref);\n"
            "    var card=ref?(kept||cardEl(ref)||embBody(ref)):null;") in out


def test_the_code_facet_is_kept_too(out):
    """A placed CODE frame was still a sym link: re-run the notebook and
    the code on a finished slide rewrote itself. splitFrame exists to put
    a code frame beside a figure frame, so kept and live sat on one
    slide -- and closing the notebook changed a finished slide, because
    the kept code was only ever the fallback."""
    assert "  function frameCode(ref){" in out
    assert "    if(!refIsLive(ref)){\n      var e=embFor(ref);\n" in out
    assert "      if(e&&e.code){" in out


def test_the_notebook_review_surfaces_stay_live(out):
    """cloneCode has five callers and two of them -- openVFull and the
    review step box -- show a NOTEBOOK cell's code, not a deck frame.
    Putting the preference inside cloneCode would have switched those to
    the deck's snapshot while the notebook was open, which is why it
    lives in frameCode instead."""
    body = out[out.index("  function cloneCode(ref){"):]
    body = body[:body.index("  /* a cell can contribute")]
    assert "refIsLive" not in body, "cloneCode must stay live-first"
    assert "    var c=cardEl(ref);" in body


def test_the_staleness_probe_leaves_no_trail(out):
    """frameSnaps feeds "Previous figure". The line sits in cloneBody's
    live branch, which a kept ref now returns before reaching -- right in
    itself. But liveCardHtml passes fromLive=1 to answer the staleness
    question, and that re-armed it: pressing Previous figure on a kept
    frame then put a picture on the slide the slide had never shown."""
    assert "    if(it&&!fromLive) frameSnaps[it.ns]=b.outerHTML;" in out


def test_the_figure_lint_reads_the_figure_it_judged(out):
    """figLint decided WHICH frames are figures from the kept copy
    (through cellFacets) and then reported their typefaces from the
    notebook -- so "2 figures use different type sizes from the rest"
    could be a sentence about a figure nobody can see."""
    assert "      var keptB=refIsLive(a.ref)?null:embBody(a.ref);" in out
    assert "      body=keptB||(el?el.querySelector('.cardbody')" in out


def test_flipping_a_figure_to_live_is_undoable(out):
    """T301's own comment describes this trap for EMBED. T298's new key
    walked into it from the other side: setRefLive DOES mutate pres.live,
    but histState did not serialise it, so the snapshot was identical and
    histPush's `st===histSnap` early return fired -- no undo entry, and
    Ctrl+Z rewound the edit before it while the switch stayed flipped."""
    assert ("      live:(pres.live&&Object.keys(pres.live).length)"
            "?pres.live:null,") in out
    assert "'cropMarks','live']\n      .forEach(function(k){" in out


def test_the_liveness_map_is_stripped_with_the_refs_it_names(out):
    """plainIfSingle strips the single-notebook stem from every ref on
    the way into a .junoview.html, and embedAssets then keys `emb` by the
    bare ref. Leaving `live` namespaced made the two halves of the file
    disagree about the same figure, and refIsLive answered "kept" for one
    the author had explicitly made live."""
    assert "      if(c.live&&typeof c.live==='object'){" in out
    assert "          if(c.live[k]) lv[strip(k)]=1;});" in out
    # the same omission normPres had to fix: a flip book's frames are
    # refs too, and they were being stripped nowhere
    assert ("          if(a.k==='flip'&&Array.isArray(a.frames))\n"
            "            a.frames.forEach(function(f){\n"
            "              if(f&&f.ref) f.ref=strip(f.ref);});") in out


def test_the_deck_nobody_placed_keeps_its_pixels_too(out):
    """autoSlides builds one slide per figure straight out of SHELLITEMS,
    so the deck a first-time user is handed went through none of the four
    placement doors: N refs, no copies. Close the notebook and every
    slide is blank -- the reported complaint verbatim, for the deck
    nobody placed."""
    assert "    var p={name:'presentation',slides:autoSlides(false)};" in out
    assert ("      (s.annots||[]).forEach(function(a){\n"
            "        if(typeof embedIfAbsent==='function') embedIfAbsent(a);"
            "});") in out


def test_an_import_does_not_overwrite_a_copy_you_already_hold(out):
    """EMBED is session-global and keyed by ref, not per deck. normPres's
    absorb had no existence check, unlike its sibling the IndexedDB
    rehydrate -- and it runs before every one of importDeckText's
    bail-outs, so even a deck that was NOT imported could replace your
    kept pixels, with no toast and no way back."""
    assert ("        var key=ns(k)||k;\n"
            "        if(EMBED[key]&&EMBED[key].html) return;") in out


def test_the_images_pane_agrees_with_the_toast(out):
    """embRestore unlinks what it restores. Without a repaint, a switch
    still reading "Live link" after the toast said the opposite turns the
    live link ON when pressed."""
    assert ("              if(typeof imgPaneRefresh==='function') "
            "imgPaneRefresh();") in out


# cloneBody is the single most-called function in this change, and a
# substring suite cannot see a ReferenceError in it. One did ship: the
# T303 edit removed `var it=resolveRef(ref)` while leaving the line that
# reads `it`, so every live-path render threw. ~840 green tests, a clean
# JS syntax check, and the figure simply did not draw. Driving found it
# in one page load. This runs the function.

_BODY_STUBS = """
var pres={live:{}}, frameSnaps={}, CALLS=[];
function normRef(r){return r?String(r):null;}
function resolveRef(r){return {ns:normRef(r)};}
function node(tag){
  return {tag:tag, outerHTML:'<'+tag+'>',
          cloneNode:function(){return this;},
          classList:{remove:function(){}}, style:{}};
}
var KEPT=null, LIVE=null;
function embBody(r){return KEPT;}
function cardEl(r){return LIVE?{card:1}:null;}
function stripIds(n){return n;}
function $(sel,root){CALLS.push(sel); return LIVE;}
function $$(sel,root){return [];}
"""


def _body_run(script):
    from helpers_js import js_engine, lift_fn
    eng = js_engine()
    if eng is None:
        pytest.skip("no node or VS Code Electron on this machine")
    cmd, env = eng
    src = assets.deck_js()
    body = "\n".join(lift_fn(src, f) for f in ("refIsLive", "cloneBody"))
    with tempfile.TemporaryDirectory() as d:
        p = Path(d) / "run.js"
        p.write_text(_BODY_STUBS + body + "\n" + script, encoding="utf-8")
        r = subprocess.run(cmd + [str(p)], capture_output=True, text=True,
                           env=env, timeout=60)
        assert r.returncode == 0, r.stderr[:2000]
        line = [ln for ln in r.stdout.splitlines() if ln.startswith("{")][-1]
        return json.loads(line)


def test_clone_body_runs_and_picks_the_kept_copy():
    """The decision, executed. Kept wins when a snapshot exists; the live
    card is still the fallback when none does; and fromLive reaches the
    notebook past a snapshot that exists."""
    got = _body_run("""
      var out={};
      KEPT=node('kept'); LIVE=node('live');
      out.keptWins=cloneBody('nb::a').tag;
      out.fromLiveBypasses=cloneBody('nb::a',1).tag;
      pres.live['nb::a']=1;
      out.liveRefReadsTheCard=cloneBody('nb::a').tag;
      delete pres.live['nb::a'];
      KEPT=null;
      out.noSnapshotFallsBack=cloneBody('nb::a').tag;
      LIVE=null;
      out.neitherIsNull=cloneBody('nb::a');
      console.log(JSON.stringify(out));
    """)
    assert got["keptWins"] == "kept"
    assert got["fromLiveBypasses"] == "live"
    assert got["liveRefReadsTheCard"] == "live"
    # a stale figure beats a blank one
    assert got["noSnapshotFallsBack"] == "live"
    assert got["neitherIsNull"] is None


def test_the_staleness_probe_records_no_previous_figure():
    """frameSnaps feeds "Previous figure". A render fills it; the
    staleness probe -- which passes fromLive=1 and is not a render --
    must not, or pressing Previous figure puts a picture on the slide
    that the slide never showed."""
    got = _body_run("""
      KEPT=null; LIVE=node('live');
      cloneBody('nb::a',1);
      var afterProbe=Object.keys(frameSnaps).length;
      cloneBody('nb::a');
      console.log(JSON.stringify({afterProbe:afterProbe,
        afterRender:Object.keys(frameSnaps).length}));
    """)
    assert got == {"afterProbe": 0, "afterRender": 1}


# ---------------------------------------------------------- T306-T307


def test_the_figure_number_comes_back_when_the_notebook_does(out):
    """An empty array is truthy. With the notebook shut SHELLITEMS[stem]
    is gone, so figOrder computed [] -- and handed that same [] back for
    the life of the page, so opening the notebook never restored the
    number. Computed while open and then closed, the row kept asserting
    an ordinal from a card list that no longer existed. Nothing
    invalidated the memo."""
    assert "    if(!SHELLITEMS[stem]) return [];" in out
    # a reload can add or remove figures, so the memo goes with the frames
    assert out.count("delete figOrderMemo[e.detail.stem];") == 2


def test_a_flip_book_is_as_many_sources_as_it_has_pages(out):
    """provRef answers for whichever page `a.at` is on, so "Update
    figures" on a seven-page book compared and refreshed one page and
    left six stale with nothing said -- and embedIfAbsent kept the pixels
    of that page only, so closing the notebook emptied the rest. The two
    picker doors hid it by setting `a.at` to the frame just pushed."""
    assert "  function provRefs(a){" in out
    assert ("      flipFrames(a).forEach(function(f){\n"
            "        if(f&&f.ref&&out.indexOf(f.ref)<0) out.push(f.ref);});") in out
    # capture and staleness both go through it
    assert "    provRefs(a).forEach(function(ref){" in out
    assert "        provRefs(a).forEach(function(ref){" in out


def test_a_chart_is_refreshed_as_a_chart(out):
    """provRef hands back a chart's source TABLE card, so resyncFigure
    stored a snapshot of the table and reported "Updated from the
    notebook" while the chart had not moved -- and if that card was also
    placed as a cell frame on another slide, the capture refreshed THAT
    figure instead. The numbers live in a.cats/a.series."""
    assert "  function chartResyncOne(a){" in out
    assert ("    if(a&&a.k==='chart')\n      return (typeof chartResyncOne"
            "==='function')?chartResyncOne(a):0;") in out
    # ...and the deck-wide loop is now the one-shot in a loop, not a copy
    assert ("      (sl.annots||[]).forEach(function(a){nn+=chartResyncOne(a);});"
            ) in out


def test_a_chart_with_no_notebook_does_not_call_the_snapshot_a_source(out):
    """cloneBody's no-card branch ignores fromLive and hands back the
    deck's own snapshot. So with the notebook shut, a chart "refresh from
    source" read the kept table and, if the numbers had been hand-edited
    through the chart data dialog, silently reverted them -- with no
    notebook anywhere in the transaction. liveCardHtml has guarded this
    since T20; chartRowsOfCard did not."""
    body = out[out.index("  function chartRowsOfCard(ref){"):]
    body = body[:body.index("  function chartResyncOne(a){")]
    assert "      if(!cardEl(ref)) return null;" in body
