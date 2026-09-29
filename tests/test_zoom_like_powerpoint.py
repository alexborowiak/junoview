"""T540: zoom like PowerPoint.

Ctrl+scroll already zoomed the page at the pointer (the pinch handler
reads ctrlKey), and clicking the zoom value already fitted the page.
What was missing was Ctrl+0: the browser's own reset zoomed the whole
app instead. Driven: two clicks of + took the page to 118%, Ctrl+0 back
to the fit (75%), and a real Ctrl+wheel event zoomed it to 124%.
"""

from __future__ import annotations


def test_ctrl_zero_fits(out):
    fn = out.split("  function pptEditKey(e){")[1].split("\n  }\n")[0]
    assert ("if(!e.shiftKey&&(e.key==='0'||e.code==='Digit0')) "
            "return pptClick('#zoom-val');") in fn
    assert "if(zv) zv.addEventListener('click',function(){setZoom(0);});" in out
    assert "fit the whole page in the window (Ctrl+0)" in out
