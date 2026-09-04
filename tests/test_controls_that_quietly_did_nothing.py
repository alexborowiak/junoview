"""Six controls that looked live and were not (T263).

The common shape: the button is there, the click lands, and nothing
happens -- or, worse, something says it happened.

* **The eye on a pinned cell.** T242's pinned short-circuit stripped
  `cell-off` along with the filter classes, so pressing a pinned card's
  eye set the class and the very next pass took it off again. A pin is
  about the FILTERS; the eye is a deliberate press.
* **Undo could not undo a custom slide layout.** `histState` has always
  snapshotted `pres.layouts`; `histRestore`'s key list never mentioned
  it, so making or deleting a layout was the one design-level change
  Ctrl+Z could not reach.
* **`validate_deck` warned about every deck that designed a layout.**
  `layouts` is written by the layout builder, carried by `normPres` and
  named explicitly by `as_presentations`, but was missing from
  `DECK_KEYS` -- so the schema called a first-class key unknown.
* **The autosave menu threw on every outside click.** Its closer tested
  an undeclared `wrap` in a strict IIFE. It was also redundant:
  `overlayShow` already registers the menu with the single overlay
  owner, which closes it on an outside click and on Escape.
* **Import claimed success after storing nothing.** `lsSet` returns a
  boolean exactly so this cannot happen; `importDeckText` ignored it,
  so once the draft budget was full every write was discarded, the
  toast still said "Imported N presentations", and the view switched to
  a deck that is not stored.
* **Opening a deck in Firefox or Safari killed Save.** The `<input
  type=file>` fallback set `saveTarget='file'` on the promise that "the
  first Save asks where once" -- but asking requires a save picker, and
  the only browsers that reach this path are the ones without one. Save
  and autosave then did nothing at all and said nothing.
"""

from __future__ import annotations

from junoview import assets
from junoview.notebook.deck_schema import DECK_KEYS


def test_the_eye_still_works_on_a_pinned_cell():
    app = assets.app_js()
    pinned = app.split("        if(c.classList.contains('is-pinned')){")[1]
    pinned = pinned.split("          return;")[0]
    assert "var poff=c.classList.contains('cell-off');" in pinned
    assert "c.classList.toggle('is-hidden',poff);" in pinned
    # the filter classes are still cleared -- that half was the point
    assert "c.classList.remove('collapsed','expanded');" in pinned
    assert "'cell-off','collapsed'" not in pinned


def test_undo_reaches_a_custom_slide_layout():
    deck = assets.deck_js()
    state = deck.split("  function histState(){")[1].split("\n  function ")[0]
    assert "layouts:pres.layouts||[]" in state
    restore = deck.split("  function histRestore(")[1].split("\n  function ")[0]
    assert "'layouts'" in restore, "histRestore must read back what it saves"


def test_the_schema_knows_about_layouts():
    assert "layouts" in DECK_KEYS
    kind, blurb = DECK_KEYS["layouts"]
    assert kind is list
    assert "layout" in blurb.lower()
    # the table in DECK-FORMAT.md and the code agree -- there is a test
    # for that pairing already; this just pins that the row exists
    import pathlib
    doc = (pathlib.Path(__file__).resolve().parents[1] / "DECK-FORMAT.md"
           ).read_text(encoding="utf-8")
    assert "| `layouts` | list |" in doc


def test_the_autosave_menu_has_no_dead_outside_click_closer():
    deck = assets.deck_js()
    assert "if(!menu.hidden&&wrap&&!wrap.contains(e.target)) close();});" not in deck
    # the owner it delegates to is still how it opens
    assert "build();overlayShow(btn,menu);floatMenu(btn,menu);" in deck


def test_import_counts_only_what_was_actually_stored():
    deck = assets.deck_js()
    fn = deck.split("  function importDeckText(")[1].split("\n  function ")[0]
    assert "if(!lsSet(PFX+nm,JSON.stringify(np))){dropped++;return;}" in fn
    assert "var imported=0,dropped=0,firstName=null;" in fn
    # ...and says so rather than reporting a clean success
    assert "would not fit and " in fn
    assert "There was no room to store them" in fn


def test_a_browser_with_no_save_picker_is_not_told_it_has_one():
    deck = assets.deck_js()
    fallback = deck.split("    fi.addEventListener('change',function(){")[1]
    fallback = fallback.split("  })();")[0]
    assert "        if(canPickFile){" in fallback
    assert "          setTarget('file');" in fallback
    assert "          setTarget('browser');" in fallback
    assert "this browser cannot save straight back " in fallback
    # the guard that made saveTarget='file' unreachable-but-silent
    assert "  if(saveTarget==='file'&&!canPickFile) saveTarget='browser';" in deck
