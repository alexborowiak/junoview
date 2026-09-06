"""Alternative versions of ONE slide (T318).

The user, 2026-09-06: "create different version of slides e.g. like the
version collapse under one version that is starred and that is the main
version that appears in presenter mode or when you click through with
arrows, but you can uncollapse and have different versions of the one
slide".

THE MODEL IS ONE TAG. A group is a contiguous run of slides sharing `alt`;
the FIRST of the run is the main and nothing stores that -- starring an
alternative moves it to the head, which the ordinary slides snapshot
already undoes. The alternatives stay real entries in pres.slides, never
nested, so everything that walks the list treats one as a full slide for
free, and the four places that must skip it are exactly the four the
request names: what plays, what exports, what the strip shows and what
the numbers count.

The model half RUNS: where a run starts and ends, which member is the
main, what the numbers say, and what the normaliser does to a stray tag
are arithmetic over the list, not something a substring can check.
"""

from __future__ import annotations

import json
import subprocess
import tempfile
from pathlib import Path

import pytest

from junoview import assets

_STUBS = """
var pres={slides:[]},cur=0;
"""
_FNS = ("altRun", "slideIsAlt", "slideNo", "slideCount", "normAlts")


def _run(script: str):
    from helpers_js import js_engine, lift_fn
    eng = js_engine()
    if eng is None:
        pytest.skip("no node or VS Code Electron on this machine")
    cmd, env = eng
    src = assets.deck_js()
    pre = _STUBS + "\n".join(lift_fn(src, f) for f in _FNS) + "\n"
    with tempfile.TemporaryDirectory() as d:
        p = Path(d) / "run.js"
        p.write_text(pre + script, encoding="utf-8")
        r = subprocess.run(cmd + [str(p)], capture_output=True, text=True,
                           encoding="utf-8", env=env, timeout=60)
        assert r.returncode == 0, r.stderr[:2000]
        return json.loads([ln for ln in r.stdout.splitlines()
                           if ln.startswith("{")][-1])


# ------------------------------------------------------------ the model


def test_the_first_of_a_run_is_the_main():
    got = _run("""
      pres.slides=[{},{alt:'g'},{alt:'g'},{alt:'g'},{}];
      console.log(JSON.stringify({
        run:altRun(2), alts:[0,1,2,3,4].map(slideIsAlt),
        single:altRun(0)}));
    """)
    assert got["run"] == {"at": 1, "n": 3, "gid": "g"}
    assert got["alts"] == [False, False, True, True, False]
    assert got["single"] is None


def test_numbers_count_mains_only():
    """The strip, the furniture's {n}/{N} and the counter all agree with
    the talk and the paper: five entries, three slides."""
    got = _run("""
      pres.slides=[{},{alt:'g'},{alt:'g'},{alt:'g'},{}];
      console.log(JSON.stringify({
        nos:[0,1,2,3,4].map(slideNo), count:slideCount()}));
    """)
    assert got["nos"] == [1, 2, 2, 2, 3]
    assert got["count"] == 3


def test_a_stray_tag_becomes_a_slide_of_its_own():
    """A tag that reappears after its run has closed is dropped -- a
    dragged-away version is not teleported back, it just stops being a
    version. A run of one dissolves."""
    got = _run("""
      pres.slides=[{alt:'g'},{alt:'g'},{},{alt:'g'},{alt:'lone'}];
      normAlts();
      console.log(JSON.stringify({tags:pres.slides.map(
        function(s){return s.alt||'';})}));
    """)
    assert got["tags"] == ["g", "g", "", "", ""]


def test_a_divider_can_never_split_a_group():
    """Every member takes the head's section."""
    got = _run("""
      pres.slides=[{sec:'a',alt:'g'},{sec:'b',alt:'g'},{alt:'g'},{sec:'b'}];
      normAlts();
      console.log(JSON.stringify({secs:pres.slides.map(
        function(s){return s.sec||'';})}));
    """)
    assert got["secs"] == ["a", "a", "a", "b"]


# ---------------------------------------------------- the four places


def test_an_alternative_is_never_part_of_the_show(out):
    """slideSkipped is the one predicate presenter mode, the arrows, the
    counter, the overview dimming and the strip's mark all read. It is
    the FIRST clause, before cuts and Running late."""
    body = out.split("function slideSkipped(i){")[1].split("\n  }")[0]
    assert "    if(slideIsAlt(i)) return true;" in body
    assert body.index("slideIsAlt(i)") < body.index("inCut(sl,activeCut())")


def test_exports_show_the_main_only(out):
    """outputSlides never consulted slideSkipped -- deliberately, so a
    rehearsal cut does not silently trim a PDF -- so the deck-state half
    of the test is asked there directly. PDF, pptx and standalone HTML
    all read that one list."""
    body = out.split("function outputSlides(){")[1].split("\n  }")[0]
    assert "      if(slideIsAlt(i)) return;" in body


def test_the_strip_collapses_versions_under_their_main(out):
    """Hidden unless the group is open -- or it is the slide you are on,
    which always shows because refreshThumb looks its row up by
    data-idx. The main wears the pill and the pill is the fold toggle;
    a version wears its name where 'not shown' would go."""
    film = out[out.index("function renderFilm(){"):]
    film = film[:film.index("  function clearFilmMarks(){")]
    assert "      var ar=altRun(i),isAlt=!!(ar&&i>ar.at);" in film
    assert "      if(isAlt&&!altOpen[ar.gid]&&i!==cur) return;" in film
    assert "        pill.className='film-mark alt-pill';" in film
    assert "          if(open) delete altOpen[ar.gid]; else altOpen[ar.gid]=1;" in film
    assert "      if(isAlt) mark('alt',s.label||('Version '+(i-ar.at+1))," in film
    # fold state is session-only: never on pres, never in the undo stack
    assert "  var altSeq=0,altOpen={};" in out
    assert "altOpen" not in out.split("function histState(){")[1].split("\n  }")[0]


def test_starring_moves_the_slide_to_the_head(out):
    """No stored flag: the main IS the first of the run, so starring is a
    splice the ordinary slides snapshot already undoes."""
    body = out.split("  function starVersion(i){")[1].split("\n  }")[0]
    assert ("    var s=pres.slides.splice(i,1)[0];\n"
            "    pres.slides.splice(r.at,0,s);") in body
    assert "    cur=pres.slides.indexOf(keep);" in body


def test_duplicate_never_grows_a_group(out):
    """New version is the verb that does. A duplicate is an ordinary
    slide placed after the whole group, or it would land inside the run
    and become a version."""
    body = out.split("  function dupSlide(i){")[1].split("\n  }")[0]
    assert "    delete cp.alt;delete cp.sid;" in body
    assert "    var at=ar?(ar.at+ar.n):(i+1);" in body


def test_deleting_the_main_promotes_the_next(out):
    body = out.split("  function delSlide(i){")[1].split("\n  }")[0]
    assert "    if(ar&&i===ar.at&&ar.n>1){" in body
    assert "is the main version now" in body


def test_the_doors(out):
    """Home > This slide > New version, always; the star only when the
    slide is grouped, pressed and inert on the main. And the right-click
    menu on the strip, where the thing being versioned is visible."""
    html = assets.deck_html()
    assert 'id="hm-version"' in html and 'id="hm-main" hidden' in html
    assert "    if(b) b.addEventListener('click',function(){addVersion(cur);});" in out
    assert "      st.hidden=!r;\n      st.disabled=!!(r&&!isA);" in out
    assert "      row('New version of this slide',function(){addVersion(i);}," in out
    assert ("        row('\\u2605 Make this the main version',"
            "function(){starVersion(i);},") in out
    # every ribbon layout lists the two new buttons beside Duplicate
    assert out.count("'hm-newslide','hm-dupslide','hm-version','hm-main',") >= 8


def test_the_tag_survives_every_rebuild():
    """The five schema touches, in one commit -- the parity test goes red
    if one is missed."""
    root = Path(__file__).resolve().parent.parent
    js = assets.deck_js()
    assert "        if(typeof s.alt==='string'&&s.alt) o.alt=s.alt;" in js
    py = (root / "src" / "junoview" / "notebook" / "presentations.py").read_text(
        encoding="utf-8")
    assert 'if isinstance(s.get("alt"), str) and s["alt"].strip():' in py
    schema = (root / "src" / "junoview" / "notebook" / "deck_schema.py").read_text(
        encoding="utf-8")
    assert '"alt": (str, "The version group this slide belongs to.' in schema
    doc = (root / "DECK-FORMAT.md").read_text(encoding="utf-8")
    assert "| `alt` | str |" in doc
