"""T535: format painter, the PowerPoint way.

Junoview's copy-a-look mode ("Copy this look to objects I click",
2026-08-22) already stays on until Esc -- the user asked for it that
way -- so PowerPoint's double-click-to-keep is its only mode. What was
missing was the keyboard pair: Ctrl+Shift+C copies the selected
object's look and Ctrl+Shift+V puts it on the selection. Ctrl+Shift+V
was already Paste in place and stays that: it pastes a LOOK only when a
look was copied more recently than an object. Copy look / Paste look
are rows on the right-click menu too.

Driven: the title's look copied (toast), a body text box selected,
Ctrl+Shift+V -- the box took 28.8px bold and kept its words, no object
added; then Ctrl+C, Ctrl+Shift+V pasted the box in place (four objects).
"""

from __future__ import annotations


def test_the_look_buffer(out):
    assert "  var lookBuf=null,lookStamp=0,objStamp=0,clipSeq=0;" in out
    fn = out.split("  function pasteLook(){")[1].split("\n  }\n")[0]
    assert ("if(to&&matchCopy(lookBuf,to,applyFieldsFor(matchPick,to.k))) "
            "n++;") in fn
    assert "return !!lookBuf&&lookStamp>objStamp&&selectedIdxs().length>0;" \
        in out
    # every object copy moves the stamp on
    assert "    objStamp=++clipSeq;" in out


def test_the_keys_and_the_rows(out):
    keys = out.split("  document.addEventListener('keydown',function(e){\n"
                     "    if(picking>=0){")[1]
    assert keys.index("if(copyLook()) toast(") \
        < keys.index("var nc=copySel();")          # before plain Ctrl+C
    assert keys.index("if(pasteLookWanted()){") \
        < keys.index("if(!clipBuf.length){")       # before paste in place
    assert "row('Copy look','Ctrl+Shift+C',function(){" in out
    assert "row('Paste look','Ctrl+Shift+V',function(){" in out
