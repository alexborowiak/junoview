"""Citations and a bibliography (T325).

The user's list, item 6: "Citation and bibliography manager: BibTeX,
DOI lookup, numbered references, footnotes, citation styles".

The gap was already written down in the LaTeX reader: "\\cite has
nowhere to resolve to -- a .bib is a second input file and load_doc has
no slot for one, so a citation stays a key in brackets". The DECK is the
slot.

A citation is resolved AT PAINT TIME, like `{fig:id}` and `@section`
before it, because a number comes from ORDER and order changes whenever
a slide moves. That is the property worth testing hardest: move a slide
and every marker renumbers with no edit anywhere.
"""

from __future__ import annotations

import json
import re
import subprocess
import tempfile
from pathlib import Path

import pytest

from junoview import assets

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "src" / "junoview"

_STUBS = """
var pres={slides:[]},cur=0;
function slideIsAlt(){return false;}
"""
_FNS = ("bibOf", "citeCfg", "bibUnbrace", "bibParse", "bibAuthors",
        "bibYear", "bibShort", "bibFormat", "citeKeysIn", "citeTextsOf",
        "citeOrder", "citeUsed", "citeSubst", "citeMissing", "bibListText",
        "citeFootFor")

BIB = r"""
% a comment line
@article{smith2020,
  author = {Smith, Jane and Doe, John},
  title  = {On the {ENSO} teleconnection},
  journal= {J. Climate},
  volume = {33},
  pages  = {1--20},
  year   = {2020},
  doi    = {10.1000/xyz123}
}
@book{brown1999,
  author    = "Brown, Ann",
  title     = "Blocking",
  publisher = "CUP",
  year      = "1999"
}
@misc{nokey
"""


def _run(script: str):
    from helpers_js import js_engine, lift_fn
    eng = js_engine()
    if eng is None:
        pytest.skip("no node or VS Code Electron on this machine")
    cmd, env = eng
    src = assets.deck_js()
    # the two module-level constants the lifted functions read: the
    # citation regex, and the brace pair bibParse spells out so that no
    # string literal in that file is left unbalanced (lift_fn cuts by
    # counting raw braces, so a lone '{' in a string swallows the rest)
    rx = re.search(r"var CITE_RE=/.*?/g;", src).group(0)
    braces = re.search(r"var BIB_OPEN=.*?;", src).group(0)
    pre = (_STUBS + braces + "\n" + rx + "\n"
           + "\n".join(lift_fn(src, f) for f in _FNS) + "\n")
    with tempfile.TemporaryDirectory() as d:
        p = Path(d) / "run.js"
        p.write_text(pre + script, encoding="utf-8")
        r = subprocess.run(cmd + [str(p)], capture_output=True, text=True,
                           encoding="utf-8", env=env, timeout=60)
        assert r.returncode == 0, r.stderr[:2000]
        return json.loads([ln for ln in r.stdout.splitlines()
                           if ln.startswith("{")][-1])


# ------------------------------------------------------------- BibTeX


def test_bibtex_reads_what_a_slide_needs_and_counts_what_it_cannot():
    got = _run("var BIB=" + json.dumps(BIB) + """;
      var g=bibParse(BIB);
      console.log(JSON.stringify({keys:Object.keys(g.entries).sort(),
        bad:g.bad,smith:g.entries.smith2020,brown:g.entries.brown1999}));
    """)
    assert got["keys"] == ["brown1999", "smith2020"]
    s = got["smith"]
    assert s["type"] == "article"
    assert s["author"] == "Smith, Jane and Doe, John"
    # braces inside a title are protection, not content
    assert s["title"] == "On the ENSO teleconnection"
    assert s["pages"] == "1--20" and s["doi"] == "10.1000/xyz123"
    # a quoted value reads the same as a braced one
    assert got["brown"]["publisher"] == "CUP"
    # the unterminated entry is counted, never guessed at
    assert got["bad"] == 1


def test_a_reference_reads_as_a_reference():
    got = _run("var BIB=" + json.dumps(BIB) + """;
      var e=bibParse(BIB).entries;
      console.log(JSON.stringify({
        fmt:bibFormat(e.smith2020),book:bibFormat(e.brown1999),
        short:[bibShort(e.smith2020),bibShort(e.brown1999)],
        three:bibShort({author:'A, X and B, Y and C, Z',year:'2001'}),
        none:bibShort({title:'no author'})}));
    """)
    assert got["fmt"] == ("Smith, Doe (2020). On the ENSO teleconnection. "
                          "J. Climate 33, 1–20. doi:10.1000/xyz123.")
    assert got["book"] == "Brown (1999). Blocking. CUP."
    assert got["short"] == ["Smith & Doe 2020", "Brown 1999"]
    assert got["three"] == "A et al. 2001"
    assert got["none"] == "Anon"


# ------------------------------------------------- finding the citations


def test_both_spellings_of_a_citation_are_found():
    got = _run("""
      console.log(JSON.stringify({
        a:citeKeysIn('as shown [@smith2020] and [@a;@b]'),
        b:citeKeysIn('see \\\\cite{brown1999} and \\\\citep{x,y}'),
        none:citeKeysIn('no citation here'),
        empty:citeKeysIn('[@]')}));
    """)
    assert got["a"] == ["smith2020", "a", "b"]
    assert got["b"] == ["brown1999", "x", "y"]
    assert got["none"] == [] and got["empty"] == []


def test_the_number_comes_from_where_the_slide_sits():
    """The property the whole design rests on: nothing is stamped, so
    moving a slide renumbers every marker in the deck with no edit."""
    got = _run("""
      pres.bib={a:{author:'A',year:'2001',title:'Ay'},
                b:{author:'B',year:'2002',title:'Bee'}};
      pres.slides=[
        {annots:[{k:'text',text:'first [@b]'}]},
        {annots:[{k:'text',text:'second [@a] and [@b]'}]}];
      var before=citeOrder();
      var beforeText=citeSubst('see [@a] and [@b]');
      pres.slides.reverse();
      var after=citeOrder();
      console.log(JSON.stringify({before:before,after:after,
        beforeText:beforeText,afterText:citeSubst('see [@a] and [@b]'),
        used:citeUsed()}));
    """)
    assert got["before"] == {"b": 1, "a": 2}
    assert got["beforeText"] == "see [2] and [1]"
    # the slides swap and every number follows, with nothing edited
    assert got["after"] == {"a": 1, "b": 2}
    assert got["afterText"] == "see [1] and [2]"
    assert got["used"] == ["a", "b"]


def test_an_alternative_version_never_claims_a_number():
    """A version of a slide nobody shows must not take reference [1]
    from the slide that is shown (T318's rule, one feature over)."""
    got = _run("""
      slideIsAlt=function(i){return i===0;};
      pres.slides=[
        {annots:[{k:'text',text:'hidden [@ghost]'}]},
        {annots:[{k:'text',text:'shown [@real]'}]}];
      console.log(JSON.stringify({order:citeOrder()}));
    """)
    assert got["order"] == {"real": 1}


def test_an_unknown_key_is_shown_not_dropped():
    got = _run("""
      pres.bib={known:{author:'A',year:'2000',title:'T'}};
      pres.slides=[{annots:[{k:'text',text:'[@known] [@missing]'}]}];
      console.log(JSON.stringify({
        out:citeSubst('[@known] and [@missing]'),
        missing:citeMissing()}));
    """)
    # a citation that silently vanished would be the worst outcome
    assert got["out"] == "[1] and [?missing]"
    assert got["missing"] == ["missing"]


def test_the_two_styles_read_differently():
    got = _run("var BIB=" + json.dumps(BIB) + """;
      pres.bib=bibParse(BIB).entries;
      pres.slides=[{annots:[{k:'text',
        text:'a [@smith2020] b [@brown1999]'}]}];
      var num=citeSubst('[@smith2020] and [@brown1999;@smith2020]');
      pres.cite={style:'ay'};
      var ay=citeSubst('[@smith2020] and [@brown1999;@smith2020]');
      console.log(JSON.stringify({num:num,ay:ay}));
    """)
    assert got["num"] == "[1] and [2, 1]"
    assert got["ay"] == ("(Smith & Doe 2020) and "
                         "(Brown 1999; Smith & Doe 2020)")


# --------------------------------------------------- the bibliography


def test_the_bibliography_lists_only_what_is_cited_in_order():
    got = _run("var BIB=" + json.dumps(BIB) + """;
      pres.bib=bibParse(BIB).entries;
      pres.bib.never={author:'Z',year:'1900',title:'Uncited'};
      pres.slides=[{annots:[{k:'text',text:'[@brown1999] [@smith2020]'}]}];
      var num=bibListText();
      pres.cite={style:'ay'};
      var ay=bibListText();
      pres.slides=[{annots:[]}];
      console.log(JSON.stringify({num:num,ay:ay,empty:bibListText()}));
    """)
    lines = got["num"].split("\n")
    # numbered, in the order the numbers were handed out
    assert lines[0].startswith("1. Brown (1999).")
    assert lines[1].startswith("2. Smith, Doe (2020).")
    # an entry nobody cites is in the library, not in the bibliography
    assert "Uncited" not in got["num"]
    # author-year sorts by name instead of numbering
    ay = got["ay"].split("\n")
    assert ay[0].startswith("Brown") and ay[1].startswith("Smith")
    assert not ay[0][0].isdigit()
    assert got["empty"] == ""


def test_the_footnote_strip_is_this_slides_citations():
    got = _run("var BIB=" + json.dumps(BIB) + """;
      pres.bib=bibParse(BIB).entries;
      pres.slides=[{annots:[{k:'text',text:'[@smith2020]'}]},
                   {annots:[{k:'text',text:'[@brown1999] [@brown1999]'}]}];
      var off=citeFootFor(pres.slides[1]);
      pres.cite={foot:1};
      console.log(JSON.stringify({off:off,
        one:citeFootFor(pres.slides[0]),
        two:citeFootFor(pres.slides[1])}));
    """)
    assert got["off"] == ""                 # only when the deck asks
    assert got["one"].startswith("[1] Smith, Doe (2020).")
    # the deck's numbering, and a key cited twice appears once
    assert got["two"].startswith("[2] Brown (1999).")
    assert got["two"].count("Brown") == 1


# ------------------------------------------------------- the DOI route


def test_a_doi_lookup_is_held_to_one_host_and_one_shape():
    """The only outbound fetch this server makes, so the shape of the
    input is the difference between a lookup and an open proxy."""
    from junoview.server.routes import _DOI_RE, fetch_doi
    for good in ("10.1000/xyz123", "10.1038/s41586-020-2649-2"):
        assert _DOI_RE.match(good), good
    for bad in ("", "not-a-doi", "10.x/y", "http://evil.test/",
                "10.1000/with space", "../../etc/passwd"):
        assert not _DOI_RE.match(bad), bad
    for bad in ("evil.test", "10.1000/a b", ""):
        with pytest.raises(ValueError, match="not a DOI"):
            fetch_doi(bad)


def test_the_doi_route_is_wired_behind_the_token():
    src = (SRC / "server" / "routes.py").read_text(encoding="utf-8")
    i = src.index("if not self._authed(")
    j = src.index('elif url.path == "/api/readpptx":')
    assert i < src.index('elif url.path == "/api/doi":') < j
    assert "self._json(fetch_doi(" in src
    # the reach is one host, built from the validated DOI
    assert 'url = "https://doi.org/" + urllib.parse.quote(' in src
    assert "DOI_CAP" in src and "timeout=15" in src


# ----------------------------------------------------------- the doors


def test_the_doors(out):
    html = assets.deck_html()
    assert 'id="dsg-cites"' in html
    assert 'id="citepane" hidden' in html and 'id="citepane-body"' in html
    assert '<input type="file" id="bibfile" accept=".bib' in html
    assert "23-citations" in assets.DECK_PARTS
    assert "  citeBoot();" in (SRC / "assets" / "js" / "deck"
                               / "99-boot.js").read_text("utf-8")
    assert out.count("'dsg-sets','dsg-cites','dsg-stylewrap'") >= 8
    assert "'imgpane','mediapane','chartpane','tablepane','citepane'," in out
    # ONE funnel: a citation resolves wherever a figure number does
    fs = out.split("function figSubst(txt,a,map){")[1].split("\n  }")[0]
    assert "if(typeof citeSubst==='function') t=citeSubst(t);" in fs
    assert fs.index("citeSubst") < fs.index("indexOf('{fig')")
    # a references box DRAWS the list rather than storing it
    assert "?(_pg.t||'')\n          :(a.bib?bibListText()" in out
    # the footnote strip is furniture, painted and cleared with the rest
    assert ".slide-citefoot" in out
    assert "var cfoot=citeFootFor((pres.slides||[])[idx]);" in out
    # the deck carries the library and the style
    assert ("     'components','cuts','guides','masters','bib','cite']\n"
            "      .forEach(function(k){") in out
    css = assets.deck_css()
    for cls in (".citepane .ct-entry", ".citepane .ct-warn",
                ".slide-citefoot"):
        assert cls in css, cls
    boot = out.split("function citeBoot(){")[1].split("\n  }")[0]
    assert "showCitePane" in boot and "bibfile" in boot


def test_python_keeps_the_library():
    from junoview.notebook.deck_schema import DECK_KEYS
    from junoview.notebook.presentations import as_presentations
    assert "bib" in DECK_KEYS and "cite" in DECK_KEYS
    deck = {"name": "d", "slides": [{"layout": "blank", "annots": []}],
            "bib": {"a2020": {"type": "article", "author": "A",
                              "year": "2020", "title": "T"}},
            "cite": {"style": "ay", "foot": 1}}
    kept = as_presentations([deck])[0]
    assert kept["bib"]["a2020"]["title"] == "T"
    assert kept["cite"] == {"style": "ay", "foot": 1}
    doc = (ROOT / "DECK-FORMAT.md").read_text(encoding="utf-8")
    assert "| `bib` | dict |" in doc and "| `cite` | dict |" in doc
    tasks = (ROOT / "TASKS.md").read_text(encoding="utf-8")
    assert "- [x] **T325" in tasks
