"""Font and Paragraph, and the popover that would not go (T221).

The user, 2026-09-03, with four screenshots: "With the Text [tab] I mean
a lot of other things in there as well: text styles, deck colours, style
system, find mismatched text. All of these are text related... why is
the background button so weird. Gross. Please move the slides button to
view, that is a view. That layout looks hectic, why is tidy page huge?
... This box from the layers can never be removed... The object menu
still looks horrible... what is the difference between text and deck?
... There should be a text style (e.g. colour, fill, font, font size),
then a text idk something else that has the (list, paragraph left,
spacing). Why does the button with A- also have the word smaller. That
is weird. Why is the strike through button huge. The transparent isn't
labelled and is just a weird little thing to drag. This history button
is so small."
"""

from __future__ import annotations

import re

from junoview import assets


def _row(html: str, label: str) -> str:
    fmt = html.index('<span class="et-fmt" id="et-fmt" hidden>')
    lab = html.index('<span class="rbn-lab">' + label + "</span>", fmt)
    return html[html.rfind('<span class="rbn-row">', fmt, lab):lab]


def test_the_decks_type_is_on_the_text_tab(out):
    """Text styles, Deck colours, Style system and Fix mismatched text are
    all about text, so they sit on the tab called Text rather than under
    Design."""
    assert 'class="rbn-grp rbn-type" data-tab="text"' in out
    assert 'class="rbn-grp rbn-type" data-tab="design"' not in out
    assert '<span class="rbn-lab">The whole deck</span>' in out
    for cid in ("dsg-styles", "dsg-tokens", "dsg-std", "dsg-design-btn"):
        assert f'id="{cid}"' in out, cid
    # Design keeps the four groups that are about the page itself
    for lab in ("Slide", "Layout", "Apply to other slides", "Page furniture"):
        assert f'<span class="rbn-lab">{lab}</span>' in out, lab


def test_design_stops_looking_hectic(out):
    """Background was a half-height button alone in a column with an empty
    cell under it; the page strip's toggle is a view; and a lone button
    was drawn the width of whatever wide run shared its column, which is
    how Tidy page ended up the size of the Spacing run."""
    html = assets.deck_html()
    assert '<span class="sh-drop rbn-tall" id="bg-drop">' in html
    assert '<button class="fx-tile big-tile" id="bg-btn"' in html
    assert "#bg-drop.rbn-tall>.fx-tile{width:72px;height:56px;" in out
    # the strip toggle is a View control now
    view = out.split('class="rbn-grp rbn-fixed rbn-view"')[1].split(">View</span>")[0]
    assert 'id="vw-versions"' in view
    # a cell is its own width, the way PowerPoint's are
    assert "  align-items:stretch;justify-items:start;height:65px;}" in out
    assert (".rbn-row>.rbn-cell,.rbn-row>.sh-drop,.rbn-row>.dc-menuwrap,\n"
            ".rbn-row>.strip-frame,.rbn-row>.fx-strip{justify-self:stretch;}") in out
    assert ".rbn-row>.rbn-cell.rbn-seg{justify-self:start;}" in out


def test_the_object_tab_is_font_then_paragraph(out):
    """How the letters look, then how the block is set."""
    html = assets.deck_html()
    assert 'class="rbn-grp rbn-fontgrp" data-tab="object"' in html
    assert 'class="rbn-grp rbn-paragrp" data-tab="object"' in html
    assert '<span class="rbn-lab">Colour</span>' not in html
    font = re.findall(r'\bid="([a-z0-9-]+)"', _row(html, "Font"))
    for cid in ("fmt-font", "fmt-sizecell", "fmt-stylewrap-tx", "tx-run-style",
                "fmt-txcolwrap", "fmt-fillcolwrap", "fmt-txquick", "fmt-bgquick"):
        assert cid in font, cid
    para = re.findall(r'\bid="([a-z0-9-]+)"', _row(html, "Paragraph"))
    for cid in ("fmt-bullets", "fmt-numbers", "tx-run-align", "fmt-lhwrap",
                "fmt-parawrap"):
        assert cid in para, cid
    # neither group holds the other's controls
    assert "fmt-parawrap" not in font and "fmt-txcolwrap" not in para
    assert ".rbn-fontgrp{order:2;}" in out and ".rbn-paragrp{order:3;}" in out


def test_the_small_things_the_screenshots_showed(out):
    """A- carrying the word Smaller, a strikethrough wider than its
    neighbours, an unlabelled opacity slider and a History button too
    small for the feature behind it."""
    html = assets.deck_html()
    assert 'title="Smaller text">A&#8722;</button>' in html
    assert 'title="Bigger text">A+</button>' in html
    cell = html[html.index('id="fmt-sizecell"'):html.index('id="fmt-stylewrap-tx"')]
    assert "Smaller</button>" not in cell and "Bigger</button>" not in cell
    # the whole-deck scale rows inside the Text styles window keep their
    # words: they are menu rows, not glyph buttons in a row
    assert "the whole deck's type, in proportion\">A&#8722; Smaller</button>" in html
    # four segments of one width, so the S is not the wide one
    assert (".rbn-cell#tx-run-style .dbtn.etm{min-width:30px;"
            "justify-content:center;") in out
    assert ("#fmt-sizecell .dbtn.etm{min-width:30px;justify-content:center;"
            in out)
    # opacity says what it is
    assert 'class="rbn-cell rbn-seg" id="fmt-opcell"' in html
    assert '<span class="cell-lab">Opacity</span>' in html
    assert "show('#fmt-opcell',!!opw&&!opw.hidden);" in out
    # History is the one tall tile in the Object group
    assert '<button class="fx-tile big-tile" id="fmt-hist"' in html
    assert ".rbn-row>#fmt-hist.big-tile{width:72px;height:56px;" in out


def test_the_colour_popup_says_whose_colours_they_are(out):
    """It headed one row "Deck" and the next "Text", which read as a
    difference in what they colour rather than in where they come from."""
    assert "lab.textContent='This deck\\u2019s colours';" in out
    assert ">Standard colours</span>" in out
    assert out.count("lab.textContent='Deck';") == 0


def test_the_layers_actions_popover_can_always_be_dismissed(out):
    """THE SECOND SHIPPED BUG THE BROWSER CAUGHT. The popover was appended
    to document.body and anchored to a button the pane destroys on every
    rebuild, and the pane's own buttons stop propagation before the
    owner's outside-click listener sees them -- so pressing By build left
    it standing over the canvas with no way back. Driven before and
    after."""
    assert "  var spActMenu=null,spActBtn=null;" in out
    assert "  function closeSpActions(){" in out
    assert "  function spActionsBoot(){" in out
    assert "  spActionsBoot();" in out
    # mounted inside the editor's layer, like every other runtime menu
    assert ("    ((typeof deckEl!=='undefined'&&deckEl)||document.body)"
            ".appendChild(m);\n    spActMenu=m;spActBtn=btn;") in out
    assert "    document.body.appendChild(m);\n    spActMenu=m;" not in out
    # the pane closes it before it destroys the button it hangs from
    assert ("    closeSpActions();          "
            "/* its anchor is about to be destroyed */") in out
    # ...and its own button still toggles rather than closing and reopening
    guard = ("      if(spActBtn&&(e.target===spActBtn\n"
             "        ||(spActBtn.contains&&spActBtn.contains(e.target))))"
             " return;")
    assert guard in out
