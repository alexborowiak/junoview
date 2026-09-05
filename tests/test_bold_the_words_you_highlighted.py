"""B / I / U / S act on the highlighted run (T290).

From the 2026-09-05 review. `a.b` is a fact about the BOX, so pressing
Bold with a word selected emboldened the whole paragraph -- while the
browser's own Ctrl+B, inside the same box, emboldened just the word. The
two disagreed about what bold means, in the same text box, half a second
apart.

Nothing here needed a new capability. `RICH_TAGS` has kept `b`, `i`, `u`
and `s` all along, `sanitizeRich`'s own `rich:` detector already looks
for them, and the colour control one cell away has asked the selection
first since T232. These four buttons simply never asked.

Driven: highlighting "beta" in "alpha beta gamma" and pressing Bold
gives `alpha <b>beta</b> gamma` with the box's own `b` still 0, and it
survives the blur -- which is where sanitizeRich runs. With nothing
highlighted, Bold takes the box from `b:0` to `b:1` exactly as before.
"""

from __future__ import annotations


def test_the_write_back_is_shared_not_copied(out):
    """The fiddly half -- sanitise, find which PAGE of a multi-page box
    you are on, write both the plain text and the rich html -- belonged
    to colorSelection. One action in two places is the shape the review
    named as this codebase's first structural problem."""
    assert "  function richSelectionEdit(run){" in out
    assert "    if(!el||!selectionInside(el)) return false;" in out
    assert "      var n=textAt(s,a); if(!(n>0)) n=0;" in out
    assert "      textPageSet(a,n,el.innerText,r.rich?r.html:'');" in out


def test_real_tags_not_inline_styles(out):
    """styleWithCSS FALSE on purpose. With it true the browser emits
    <span style="font-weight:bold">, and sanitizeRich strips every
    inline style except colour -- so the run would look right until the
    next blur and then quietly lose its weight."""
    assert "  function runStyleSelection(cmd){" in out
    assert ("      try{document.execCommand('styleWithCSS',false,false);}"
            "catch(e){}") in out
    assert "      try{document.execCommand(cmd,false,null);}catch(e){}" in out
    # ...and the tags it emits are ones the sanitiser keeps
    assert "var RICH_TAGS={span:1,b:1,strong:1,i:1,em:1,u:1,s:1," in out


def test_all_four_buttons_ask_the_selection_first(out):
    assert "  function onRun(id,cmd,fn){" in out
    for bid, cmd in (("bold", "bold"), ("ital", "italic"),
                     ("under", "underline"), ("strike", "strikeThrough")):
        assert f"onRun('#fmt-{bid}','{cmd}'," in out, bid
    # ...and none of them goes straight to the box any more
    for bid in ("bold", "ital", "under", "strike"):
        assert f"onFmt('#fmt-{bid}'," not in out, bid


def test_the_caret_survives_the_click(out):
    """A plain click blurs the box first and the selection is gone
    before the handler runs. Same guard the colour door uses (T232)."""
    run = out.split("  function onRun(id,cmd,fn){")[1].split("\n  }")[0]
    assert "    b.addEventListener('mousedown',function(e){" in run
    assert "      if(activeTextEditable()) e.preventDefault();});" in run


def test_nothing_highlighted_still_means_the_whole_box(out):
    """The answer that needed no decision: they do exactly what they
    always did. runStyleSelection returns false when there is no caret
    selection, which is the caller's signal to fall back."""
    run = out.split("  function onRun(id,cmd,fn){")[1].split("\n  }")[0]
    assert "      if(runStyleSelection(cmd)){" in run
    assert "      fmtApply(fn);" in run
    assert "onRun('#fmt-bold','bold',function(a){a.b=a.b?0:1;});" in out
