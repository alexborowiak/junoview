"""T590: Backspace at the start of a bullet takes the bullet off.

The user, 2026-09-30: "It's still really hard to get rid-of dot points.
Like you seem to be only be able to get rid of them if the line is empty.
E.g. if there is a line above and you try and delete, then it just takes
everything back to the line before. IF the dot points there is no line
before e.g. at the top, then dot points cannot be backspaced."

Left to the browser, Backspace at the start of a bullet merged it into
the line above, words and all, and on the first line did nothing. Word
and PowerPoint: the first Backspace takes a sub-bullet up a level or the
bullet off, keeping the words on their own line; the next one joins.

Driven: "- one / two / three" typed as a list; Backspace at the start of
"two" left <ul>one</ul> two <ul>three</ul>, and at the start of "one"
left one and two plain above the "three" bullet.
"""

from __future__ import annotations


def test_the_caret_at_an_items_start_is_recognised(out):
    assert "  function caretAtItemStart(el){" in out
    fn = out.split("  function caretAtItemStart(el){")[1].split("\n  }\n")[0]
    assert "li=(li&&li.closest)?li.closest('li'):null;" in fn
    assert "r.toString().replace(/\\u200b/g,'')===''?li:null;" in fn


def test_backspace_there_outdents_or_unbullets(out):
    kd = out.split("        var li0=caretAtItemStart(el);")[1] \
        .split("          return;\n        }\n      }")[0]
    # a sub-bullet goes up a level first
    assert "if(up0&&up0.tagName==='LI'){" in kd
    assert "document.execCommand('outdent',false,null);" in kd
    # a top-level one loses its marker through the List button's toggle
    assert "listSelection((ls0&&ls0.getAttribute('data-list'))" in kd
    # the lone empty bullet keeps its own rule, which runs first
    assert out.index("el.querySelectorAll('li').length===1){") \
        < out.index("        var li0=caretAtItemStart(el);")
