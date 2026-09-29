"""T534: the shortcuts PowerPoint users type.

Driven with real key events in headless Edge on the example deck:

- F2 (and Enter) on a selected text box starts typing; Tab / Shift+Tab
  walk the slide's objects.
- Ctrl+B / I / U format a selected box, not only selected words.
- Ctrl+L / E / R align and Ctrl+Shift+> / < size text, with the caret
  in a box too: F2, End, Ctrl+E, then typing carried on at the caret
  (the alignment redraws the box; keepTyping puts the caret back).
- Ctrl+M adds a slide after this one ("Slide 2 of 15").
- Ctrl+] / Ctrl+[ bring forward / send backward -- promised by the
  Arrange buttons' own tooltips since they were written, and handled
  by nothing. Shift goes to the front / the back.

Two bugs the drive found on the way:

- Ctrl+S with the caret in a box went to the BROWSER ("Save page
  as"): the box's keydown stopped every key from bubbling, so the
  deck's Ctrl+S branch -- whose comment says it saves from a box --
  never saw it. The box and the table cell now let Ctrl+S through.
- A canvas click never moved keyboard focus (every gesture
  preventDefaults its mousedown), so after pressing a ribbon button and
  clicking an object, Enter pressed that button again and Tab walked
  the ribbon. A click on the page now hands the keys to the page.

Ctrl+K stays the rail's Find from anywhere (its own deliberate design).
"""

from __future__ import annotations


def test_the_edit_keys(out):
    fn = out.split("  function pptEditKey(e){")[1].split("\n  }\n")[0]
    assert "(e.key==='F2'||e.key==='Enter')&&onCanvas&&layer" in fn
    assert "focusText(layer,selAnnot);return true;" in fn
    assert "e.key==='Tab'&&onCanvas&&layer" in fn
    assert "(e.key==='m'||e.key==='M')) return pptClick('#hm-newslide');" in fn
    assert "return pptClick(e.shiftKey?'#fmt-front':'#fmt-forward');" in fn
    assert "return pptClick(e.shiftKey?'#fmt-back':'#fmt-backward');" in fn
    assert "return pptClick('#fmt-bold');" in fn
    assert "      else if(pptEditKey(e)){e.preventDefault();}" in out


def test_the_text_keys_work_with_a_caret_in_a_box(out):
    fn = out.split("  function pptTextKey(e){")[1].split("\n  }\n")[0]
    for sel in ("#fmt-al-left", "#fmt-al-center", "#fmt-al-right",
                "#fmt-bigger", "#fmt-smaller"):
        assert sel in fn, sel
    assert out.count("if(pptTextKey(e)){e.preventDefault();"
                     "e.stopPropagation();return;}") == 2   # box and cell
    assert "keepTyping(function(){paraApply('a:'+p[0]);});" in out


def test_save_is_not_swallowed_by_the_box(out):
    assert out.count("if((e.ctrlKey||e.metaKey)&&!e.altKey&&(e.key==='s'"
                     "||e.key==='S')) return;") == 2


def test_a_canvas_click_takes_the_keyboard(out):
    assert ("      if(fa&&fa!==document.body&&fa.blur&&!layer.contains(fa)) "
            "fa.blur();") in out


def test_the_help_lists_them():
    from junoview import assets
    h = assets.load("html/help.html")
    for k in ("<kbd>F2</kbd>", "<kbd>Ctrl</kbd>+<kbd>M</kbd>",
              "<kbd>Ctrl</kbd>+<kbd>]</kbd>", "<kbd>Tab</kbd>"):
        assert k in h, k
