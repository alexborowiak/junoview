"""T533: the right-click menu leads with the everyday.

The 2026-09-29 audit counted 45 rows on a title's right-click menu. Two
things made it long for no reason:

- one "Insert a reference to Figure n" row PER FIGURE -- seven on the
  example deck, thirty on a thesis poster. One figure is still one row;
  more are one row, "Insert a reference to a figure...", that opens a
  picker naming each figure by its number and title. Every figure is
  still reachable (the T58 promise).
- Paste was the menu's LAST section, eight headings below the Cut and
  Copy it belongs with. It follows the first section now, and with
  nothing copied it is a greyed Paste rather than the sentence "Nothing
  copied yet".

Kept where the user put them: repeat on slides and make-default stay
above More (2026-09-11), and "shows with" (T162).

Driven: the title's menu reads this object / paste / repeat on slides /
where it goes / refer to a figure (one row) / flip book / make default,
then More; the picker lists all seven figures and inserts the chosen one.
"""

from __future__ import annotations


def test_one_row_and_a_picker_for_many_figures(out):
    menu = out[out.index("function openCanvasMenu(layer,s,ev){"):]
    menu = menu[:menu.index("function deleteSel(){")]
    assert "if(figs.length===1){" in menu
    assert "askText({title:'Refer to a figure'," in menu
    assert "rows:[{k:'cap',label:'Figure',type:'select',value:figs[0].cap," \
        in menu
    assert "if(v&&v.cap) refCaption(capSel[0],v.cap);" in menu
    assert "fbox" not in menu


def test_paste_sits_with_cut_and_copy(out):
    fn = out.split("  function cmPasteUp(m){")[1].split("\n  }\n")[0]
    assert "if(!/^this object$|objects$/.test(first)) return;" in fn
    assert "block.forEach(function(k){m.insertBefore(k,heads[1]);});" in fn
    assert "    cmPasteUp(m);\n    cmFold(m);" in out
    assert "pz.disabled=true;pz.title='Nothing copied yet';" in out
    assert "row('Nothing copied yet'" not in out
