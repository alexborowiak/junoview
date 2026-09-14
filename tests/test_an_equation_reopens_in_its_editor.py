"""T442: an equation goes back into the equation editor.

The user, 2026-09-14: "with equations it would be good if you can go
back into the equation and edit in the equation editor. Currently you
cannot do this."

The Edit equation button on the Text tab was the only way back in,
and a double-click -- the way into every other box -- put a bare caret
on the LaTeX instead. A double-click on a maths box now opens the
equation editor on it (SemDeckEquation(idx), the dialog's own open
with the box's LaTeX unwrapped and "Update it" on the button), and the
right-click menu offers the same under "equation".

Driven live: an equation put on the slide, double-clicked, came back
in the dialog with its LaTeX; Update it rewrote the box.
"""

from __future__ import annotations


def test_a_double_click_opens_the_editor(out):
    fn = out.split("    el.addEventListener('dblclick',function(e){")[1] \
        .split("\n    });")[0]
    assert ("      if(typeof idx==='number'&&ag&&typeof isMaths==='function'\n"
            "         &&isMaths(ag)&&window.SemDeckEquation){\n"
            "        window.SemDeckEquation(idx);return;\n"
            "      }") in fn
    # the dialog reopens on the box's own LaTeX
    assert "      var u=a?unwrap(a.text):{tex:'E = mc^2',display:true};" in out
    assert "      $('#eq-ok').textContent=(editIdx!=null)?'Update it'" in out


def test_the_right_click_menu_offers_it(out):
    assert "          menuHead(m,'equation');" in out
    assert "          row('Edit the equation\\u2026','',function(){" in out
