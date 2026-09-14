"""T277: there is a Subtitle type.

The built-in seven were title / h1 / h2 / h3 / body / small / caption.
The Title layout's "Subtitle" slot and every poster's author line had
nowhere right to land: the four headings are bold and body/small are
body copy. An eighth built-in sits under Title in the ladder, every
style set and colour theme name it, and the Title layout stamps it.

Driven live: New slide with the Title layout gave a box typed
`subtitle` at 3.4 with no drift reported; the Styles menu lists
Subtitle between Title and Heading 1.
"""

from __future__ import annotations

import re


def test_the_eighth_built_in_sits_under_title(out):
    assert ("  var BUILTIN_STYLE_IDS=[\n"
            "    'title','subtitle','h1','h2','h3','body','small','caption'];") in out
    assert "    subtitle:{label:'Subtitle',  size:3.4}," in out
    # not a heading: "apply to all headings" leaves it alone
    assert "var HEADING_STYLES=['title','h1','h2','h3'];" in out


def test_every_set_and_theme_names_it(out):
    sets = out.split("  var STYLE_SETS=[")[1].split("\n  ];")[0]
    assert sets.count("subtitle:{") == 6, sets.count("subtitle:{")
    themes = out.split("  var COLOUR_THEMES=[")[1].split("\n  ];")[0]
    assert themes.count("subtitle:{color:'@quiet'") == 4


def test_the_title_layout_stamps_it(out):
    block = out.split("  var LAYOUTS=[")[1].split("{id:'section'")[0]
    slot = re.search(r"\{k:'text',[^}]*Subtitle[^}]*\}", block).group(0)
    assert "style:'subtitle'" in slot and "size:3.4" in slot


def test_size_alone_never_suggests_it(out):
    """A subtitle is the line under a title -- a place, not a size band --
    so a deck of 3.4% body paragraphs must still be named Body."""
    fn = out.split("  function stdName(bands){")[1].split("\n  }")[0]
    assert ("    var left=styleOrder().filter(function(id){"
            "return id!=='subtitle';});") in fn
