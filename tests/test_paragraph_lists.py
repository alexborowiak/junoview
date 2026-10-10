"""Bullets belong to paragraphs, not to an entire text box (T513).

The old editor made the contenteditable element itself a ``ul``. Browsers
cannot split one item out of a root list, so pressing Bullets on the middle
paragraph necessarily changed the whole box. A neutral editable wrapper let
the browser keep ``ul / plain paragraph / ul`` as ordinary rich text.

T623 (2026-10-10, user: "indenting affects whole of text box, and still
issues with dot points and lists") made it true all the way down. The
paragraph is the unit -- a <p> with its own level and marker -- and every
command acts on the paragraphs the caret or the selection touches, or with
the box selected on all of them, writing those attributes itself rather
than asking the browser's list and indent commands (which made one bullet
of every line from the caret down, nested <ul> in <ul>, made <blockquote>s
for plain lines and split the list at an outdent).
"""

from __future__ import annotations


def test_the_list_button_edits_the_paragraphs_you_are_in(out):
    fn = out.split("  function paraCmd(fn,pre){", 1)[1].split(
        "\n  function listApply", 1)[0]
    # typing: the paragraphs the caret or selection touches...
    assert "var ps=paraTouched(el);" in fn
    assert "paraEdit(el,ps,f||fn,true);" in fn
    # ...or, with the box selected, every paragraph of every selected box
    assert "fmtApply(function(a){" in fn
    assert "parasEdit(a,function(p,i,pg){if(mine(a,i,pg)) f2(p,i,pg);});" \
        in fn
    assert "  function listApply(style){\n    paraCmd(null,function(list)" \
        "{return paraListToggle(list,style);});\n  }" in out


def test_a_selection_is_its_paragraphs_whichever_way_it_was_dragged(out):
    fn = out.split("  function paraTouched(el,look){", 1)[1].split(
        "\n  }\n", 1)[0]
    # a range runs start to end however the mouse moved
    assert "var r=s.getRangeAt(0);" in fn
    assert "a=paraAt(el,r.startContainer,r.startOffset)" in fn
    assert "b=paraAt(el,r.endContainer,r.endOffset);" in fn
    # from the first to the last, walking only the paragraphs between them
    # (the buttons ask on every caret move: never the whole box)
    assert "if(a===b) return [a];" in fn
    assert "for(var c=a;c;c=c.nextElementSibling){" in fn
    assert "paraEls(" not in fn
    # a drag that ends at the very start of a paragraph does not take it
    assert ("if(!r.collapsed&&paraAtStart(b,r.endContainer,r.endOffset)) "
            "out.pop();") in fn


def test_paragraphs_round_trip_with_their_level_and_marker(out):
    """The sanitizer keeps a <p>'s level and marker -- each value checked
    the way the paragraph model reads them -- and nothing else."""
    assert "    p:1};" in out
    san = out.split("  function sanitizeRich(html){")[1].split("\n  }\n")[0]
    assert "var pAt=(tag==='p')?paraAttrs(n):null;" in san
    assert "if(pAt) paraAttrsSet(n,pAt);" in san
    # a paragraph's style is the drawing's and is never stored
    assert "var color=(tag!=='p'&&n.style&&n.style.color)||" in san
    attrs = out.split("  function paraAttrs(e){")[1].split("\n  }\n")[0]
    assert "if(l>0) at.lvl=Math.min(PARA_LVL_MAX,l);" in attrs
    assert "if(k) at.list=listKind(k)?k:'bullet';" in attrs
    assert "if(st>=1&&st<=999&&listIsOrdered(at.list)) at.start=st;" in attrs
    assert "if(PARA_LC.test(lc)) at.lc=lc;" in attrs
    assert "if(ls>=0.5&&ls<=3&&ls!==1) at.ls=Math.round(ls*100)/100;" \
        in attrs


def test_tab_and_indent_follow_the_paragraph_not_a_list(out):
    """Tab worked only inside a list (caretList); elsewhere it fell to the
    browser and the box lost the focus. It always stays in the box now:
    a level for the paragraph(s), or a tab character mid-line in a plain
    one, as in PowerPoint."""
    kd = out.split("      if(e.key==='Tab'&&!mod&&!e.altKey){")[1].split(
        "\n        return;\n      }\n", 1)[0]
    assert kd.lstrip().startswith("e.preventDefault();e.stopPropagation();")
    assert "try{document.execCommand('insertText',false,'\\t');}" in kd
    assert "paraEdit(el,ps,function(p){paraLevel(p,e.shiftKey?-1:1);});" \
        in kd
    assert "caretList" not in out
    assert "Click into the list first" not in out
