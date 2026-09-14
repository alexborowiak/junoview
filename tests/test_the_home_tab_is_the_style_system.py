"""T444: the Home tab reorganised around the Style system.

The user, 2026-09-14: "Move citations to the text tab not home. Move
text styles and style sets to text away from home. Shared colours also
can go somewhere else (and this still makes no sense to me whatever
this is doing ... This needs an overhaul). Moving all these buttons
means style systems can always be present, not collapsed. This is a
really important feature and I NEVER want this to be hidden. NEVER.
Move slide master out of page furniture (why would you put that
there????)."

- Text styles, Style sets and Citations sit in a Presentation type
  group on the Text tab.
- Deck colours (was Shared colours) and Deck layout sit in a Whole
  deck group on Design; the colours panel opens with a preview slide
  painted from the five colours the rows are, and says so.
- The Style system is a tall tile in a group of its own on Home,
  excluded from the fold ladder.
- Slide master sits with the layouts, not the page furniture.

Driven live: Home listed Style system open; Text listed Presentation
type with the three doors; Design listed Whole deck and Slide master
in Layout.
"""

from __future__ import annotations


def test_the_type_doors_are_on_text(out):
    grp = out.split('<span class="rbn-grp rbn-decktype" data-tab="text"')[1] \
        .split('<span class="rbn-lab">Presentation type</span>')[0]
    for cid in ("dsg-stylewrap", "dsg-sets", "dsg-cites"):
        assert f'id="{cid}"' in grp, cid


def test_the_deck_wide_doors_are_on_design(out):
    grp = out.split('<span class="rbn-grp rbn-deckwide" data-tab="design"')[1] \
        .split('<span class="rbn-lab">Whole deck</span>')[0]
    for cid in ("dsg-tokens", "dsg-layout"):
        assert f'id="{cid}"' in grp, cid
    assert "Deck colours&#8230;</button>" in grp
    # the panel: a preview of the five, and a note that says what they are
    assert "    var pv=document.createElement('div');pv.className='tok-preview';" \
        in out
    assert "    menuHead(m,'deck colours');" in out


def test_the_style_system_never_folds(out):
    grp = out.split('<span class="rbn-grp rbn-type rbn-stylesys" data-tab="home"')[1] \
        .split('<span class="rbn-lab">Style system</span>')[0]
    assert 'class="fx-tile big-tile rbn-tall" id="dsg-design-btn"' in grp
    assert "        &&!g.classList.contains('rbn-stylesys')" in out
    assert ".rbn-row>#dsg-design-btn.big-tile{width:var(--rbn-tile-w);" in out


def test_the_master_sits_with_the_layouts(out):
    lay = out.split('<span class="rbn-grp rbn-layout" data-tab="design"')[1] \
        .split('<span class="rbn-lab">Layout</span>')[0]
    assert 'id="dsg-masters"' in lay
    furn = out.split('<span class="rbn-grp rbn-furn" data-tab="design"')[1] \
        .split('<span class="rbn-lab">Page furniture</span>')[0]
    assert 'id="dsg-masters"' not in furn
