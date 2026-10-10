"""T529: group names say what is in them.

The 2026-09-29 audit read every ribbon group against its contents,
live. Two names misled:

- "Presentation type" held the deck's text styles, A- / A+, Re-apply,
  Style sets and Citations -- and read as "what kind of presentation".
  It is Deck text now (the group T444 made; its place is unchanged).
- "Page furniture" held Header, Footer, Watermark and Page numbers --
  a printer's term; PowerPoint calls the same group Header & footer.
  Every ribbon layout that names the group says the same.

Kept deliberately: Build order (T140's glossary chose it over "Advance
sequence") and the Entrance door's "From start" (T508 replaced "None").

And one readout lied: a folded Animation door whose every control is
disabled said "no selection" even with a figure selected. It says why
now -- "no entrance" on Start, "not for this" elsewhere -- and the
tooltip carries the sentence. Driven: with a figure selected, Start
reads "no entrance" and Each text step "not for this".
"""

from __future__ import annotations


def test_the_two_names(out):
    assert '<span class="rbn-lab">Deck text</span>' in out
    assert '<span class="rbn-lab">Header &amp; footer</span>' in out
    assert "Presentation type</span>" not in out
    assert "Page furniture</span>" not in out
    assert "label:'Page furniture'" not in out
    assert out.count("label:'Header & footer'") == 4


def test_a_dead_door_says_why(out):
    # worked out in rbnReadoutCalc, written in rbnFoldReadoutWrite
    # (2026-10-09, speed: the fit asks the first of a door it may build)
    fn = (out.split("  function rbnReadoutCalc(g){")[1].split("\n  }\n")[0]
          + out.split("  function rbnFoldReadoutWrite(g,c){")[1]
          .split("\n  }\n")[0])
    assert "var picked=(typeof selAnnot!=='undefined'&&selAnnot!==null);" \
        in fn
    assert ":(g.classList.contains('rbn-start')" in fn
    assert "||g.classList.contains('rbn-timing'))?'no entrance'" in fn   # T594
    assert ":'not for this';" in fn
    assert "'give it an entrance effect first'" in fn
