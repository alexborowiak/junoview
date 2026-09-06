"""'@section': a colour that depends on which section a slide is in (T316).

The user, 2026-09-06: "some that have different colours per section".

It is a reserved reference, not a key of the palette: resolved when the
slide is PAINTED, from the section that slide is in, so a box holds the
reference and never a stamped colour. Move the slide and it repaints;
delete a section and the survivors renumber; nothing is re-stamped and
no membership verb has to remember to. The exporters get a concrete hex
through the same tokVal they already call.

The resolver RUNS: which hue the third section gets, that a section's
own colour wins, that a light page picks the light column, and that a
slide in no section answers '' -- arithmetic over the section list, not
something a substring can check.
"""

from __future__ import annotations

import json
import subprocess
import tempfile
from pathlib import Path

import pytest

from junoview import assets

_STUBS = """
var pres={slides:[],sections:{},pageBg:''},cur=0;
function sectionRuns(){
  var out=[],last=null;
  (pres.slides||[]).forEach(function(s,i){
    var id=(s&&s.sec)||'';
    if(!last||last.id!==id){last={id:id,at:i,n:0};out.push(last);}
    last.n++;});
  return out;
}
var LIGHT=false;
function pageIsLight(bg){return LIGHT;}
"""


def _run(script: str):
    from helpers_js import js_engine, lift_fn
    eng = js_engine()
    if eng is None:
        pytest.skip("no node or VS Code Electron on this machine")
    cmd, env = eng
    src = assets.deck_js()
    i = src.index("var SECTION_HUES=")
    hues = src[i:src.index(";", src.index("]]", i)) + 1]
    pre = (_STUBS + hues + "\nvar paintSlide=null;\n"
           + "\n".join(lift_fn(src, f)
                       for f in ("sectionOrdinal", "sectionColorFor")) + "\n")
    with tempfile.TemporaryDirectory() as d:
        p = Path(d) / "run.js"
        p.write_text(pre + script, encoding="utf-8")
        r = subprocess.run(cmd + [str(p)], capture_output=True, text=True,
                           encoding="utf-8", env=env, timeout=60)
        assert r.returncode == 0, r.stderr[:2000]
        return json.loads([ln for ln in r.stdout.splitlines()
                           if ln.startswith("{")][-1])


def test_each_section_takes_its_turn_in_the_cycle():
    """Three sections, three hues, in section order -- and the seventh
    wraps, because the deck speaks in six."""
    got = _run("""
      pres.slides=[{sec:'a'},{sec:'a'},{sec:'b'},{sec:'c'},{sec:'d'},
                   {sec:'e'},{sec:'f'},{sec:'g'}];
      ['a','b','c','d','e','f','g'].forEach(function(k){pres.sections[k]={name:k};});
      console.log(JSON.stringify({
        a:sectionColorFor({sec:'a'}), b:sectionColorFor({sec:'b'}),
        c:sectionColorFor({sec:'c'}), g:sectionColorFor({sec:'g'}),
        hues:SECTION_HUES.map(function(h){return h[0];})}));
    """)
    hues = got["hues"]
    assert (got["a"], got["b"], got["c"]) == (hues[0], hues[1], hues[2])
    assert got["g"] == hues[0], "the seventh wraps"


def test_a_sections_own_colour_wins():
    got = _run("""
      pres.slides=[{sec:'a'},{sec:'b'}];
      pres.sections={a:{name:'A',color:'#123456'},b:{name:'B'}};
      console.log(JSON.stringify({a:sectionColorFor({sec:'a'}),
        b:sectionColorFor({sec:'b'})}));
    """)
    assert got["a"] == "#123456"
    assert got["b"] != "#123456"


def test_a_light_page_takes_the_light_column():
    """The dark column is the chart palette, chosen for the built-in
    page; each hue has a partner that reads on white."""
    got = _run("""
      pres.slides=[{sec:'a'}];pres.sections={a:{name:'A'}};
      var dark=sectionColorFor({sec:'a'});
      LIGHT=true;
      var light=sectionColorFor({sec:'a'});
      console.log(JSON.stringify({dark:dark,light:light,
        pair:SECTION_HUES[0]}));
    """)
    assert [got["dark"], got["light"]] == got["pair"]
    assert got["dark"] != got["light"]


def test_a_slide_in_no_section_answers_nothing():
    """'' means "the page's ink" at every tokVal site, which is the
    honest answer for a heading that asked to follow a section it is
    not in."""
    got = _run("""
      pres.slides=[{},{sec:'a'}];pres.sections={a:{name:'A'}};
      console.log(JSON.stringify({none:sectionColorFor({}),
        missing:sectionColorFor({sec:'zz'}), nul:sectionColorFor(null)}));
    """)
    assert got == {"none": "", "missing": "", "nul": ""}


# ------------------------------------------------------- the wiring


def test_the_reference_is_resolved_at_paint_time(out):
    """tokVal's first two lines are pinned elsewhere and stay; the branch
    goes after them and reads the slide being painted."""
    assert ("    if(k==='section')\n"
            "      return sectionColorFor(paintSlide||(pres&&pres.slides||[])"
            "[cur])||'';") in out
    # the three funnels set it; a master-synth slide never clobbers it
    assert "    if(s&&(pres.slides||[]).indexOf(s)>=0) paintSlide=s;" in out
    assert "    if((pres.slides||[]).indexOf(s)>=0) paintSlide=s;   /* T316 */" in out
    assert out.count("paintSlide=ent.s;") == 2, "both pptx passes"


def test_a_sections_colour_travels_and_survives_a_rename(out):
    """normPres keeps it, secNames writes it, histRestore carries it --
    and renameSection edits in place, which also stops it dropping
    `trans` as it did."""
    assert "        if(/^#[0-9a-f]{6}$/i.test(d.color||'')) keep[k].color=d.color;" \
        in out
    assert "        if(m[k].color) out[k].color=m[k].color;   /* T316 */" in out
    assert "        if(!pres.sections[k].color) delete pres.sections[k].color;" \
        in out
    assert ("    var rec=secMap()[id]||(secMap()[id]={});\n"
            "    rec.name=v;") in out


def test_a_new_section_repaints_the_slide(out):
    """newSection ended in renderFilm(); every other membership verb ends
    in refresh(), and a heading wearing '@section' has to repaint the
    moment the section it now sits in exists."""
    body = out.split("  function newSection(at,name){")[1].split("\n  }")[0]
    assert "normSections();markDirty();refresh();" in body


def test_the_doors(out):
    """Three, none on the ribbon: the chip in the text colour menu's deck
    row (text only), the dot on every divider, and the divider menu's way
    back to the automatic colour."""
    assert "        sb.setAttribute('data-c','@section');" in out
    assert ("      if(!isFill&&pres&&pres.sections"
            "&&Object.keys(pres.sections).length){") in out
    assert "    dot.className='film-sec-dot';dot.type='button';" in out
    assert "  function setSectionColor(id,hex){" in out
    assert "        row('Back to the automatic colour',function(){" in out
    assert "section:'Section colour'" in out
