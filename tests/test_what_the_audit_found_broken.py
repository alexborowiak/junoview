"""Five deck-editor faults the 2026-09-04 audit found (T261).

Each was confirmed against the code before being written down, and two
were confirmed in a browser. They are unrelated to each other; what
they share is that the substring suite was green through all five.

1. **Save wrote back to the wrong file.** `openDeckFile` stored the
   handle it had just been given under the key `'deckFile'`, which
   nothing in the tree ever reads; the restore path reads `HKEY`. So
   the file you opened was forgotten on the next visit -- and worse,
   any handle left under `HKEY` by an earlier Save-as WAS restored and
   became the live target while `saveTarget` was still `'file'`, so the
   first autosave after a reload wrote this deck into that other file.

2. **Undo deleted the masters.** `histRestore` has always carried
   `masters` in its delete-what-is-absent list, and `histState` never
   saved it -- so `d.masters` was always undefined and every restore
   took the `delete pres.masters` branch. One Ctrl+Z after ANY edit
   destroyed the whole registry while every slide kept its `mast` tag
   pointing at nothing, and the loss went straight into the draft.

3. **Hovering a swatch collapsed a multi-selection.** `pvRender` (the
   live colour preview) called `selectAnnot(l,selAnnot)`, which with no
   additive flag does `selSet=groupMembers(s,idx)` -- `[idx]` for
   anything ungrouped. Selecting three shapes and moving the pointer
   over a swatch silently dropped two of them, and the click that
   followed recoloured only the survivor. Recolouring a multi-selection
   is the exact thing fmtApply's own comment says it exists for.

4. **The ribbon gallery threw every time it opened.**
   `openRibbonGallery` called `rbnOverflowNotice(bar)` with `bar` never
   declared; the IIFE is strict, so it threw before its last two
   statements ran and neither listener was attached. Driven A/B on
   builds from before and after the fix: before, opening the gallery
   logged `Uncaught ReferenceError: bar is not defined` and Escape left
   all 9 cards on screen; after, no error and Escape closes it. The
   Escape handling is the very thing `rbnGalleryKey`'s comment says
   cannot live anywhere else.

5. **Recolouring text on page 2 overwrote page 1.** `colorSelection`
   assigned `a.text`/`a.html` directly while every other writer of a
   text box's words goes through `textPage`/`textPageSet` bound to
   `textAt(s,a)` -- the page the box is turned to. Highlighting a run
   on page two of a multi-page text box and picking a colour wrote page
   two's words over page ONE, silently, and autosave persisted it.
"""

from __future__ import annotations

from junoview import assets


def test_an_opened_file_is_remembered_under_the_key_that_is_read():
    deck = assets.deck_js()
    assert "            idbPut(HKEY,h).catch(function(){});" in deck
    # the key nothing read is gone
    assert "idbPut('deckFile'" not in deck
    # ...and HKEY is still what the restore path reads
    assert "  var HKEY='deck:'+SCOPE;" in deck
    assert "idbGet(HKEY).then(function(h){" in deck


def test_undo_keeps_the_masters():
    deck = assets.deck_js()
    state = deck.split("  function histState(){")[1].split("\n  function ")[0]
    assert "masters:" in state, "histState must serialise the registry"
    # empty-is-null, like its neighbours: opening the Masters panel
    # creates pres.masters={} lazily and must not record a phantom step
    assert ("      masters:(pres.masters&&Object.keys(pres.masters).length)\n"
            "        ?pres.masters:null,") in deck
    # the restore side still clears what is absent -- that half was right
    restore = deck.split("  function histRestore(")[1].split("\n  function ")[0]
    assert "'masters'" in restore


def test_a_colour_preview_does_not_rewrite_the_selection():
    deck = assets.deck_js()
    pv = deck.split("  function pvRender(){")[1].split("\n  function ")[0]
    assert "selectAnnot(" not in pv, "selectAnnot rewrites selSet"
    assert "paintSel(l);" in pv
    assert "showFmt();" in pv
    # the same pair fmtApply uses when it has more than one target
    assert "  function paintSel(layer){" in deck
    assert "  function showFmt(){" in deck


def test_the_ribbon_gallery_resolves_its_own_bar():
    deck = assets.deck_js()
    assert "    rbnOverflowNotice($('#edit-tools'));" in deck
    gal = deck.split("  function openRibbonGallery(){")[1].split("\n  function ")[0]
    # other callers pass a `bar` they have actually declared; this one
    # never did, which is the whole bug
    assert "rbnOverflowNotice(bar)" not in gal
    # the two listeners that never got attached while it threw
    assert "window.addEventListener('resize',rbnGalleryPlace);" in gal
    assert "document.addEventListener('keydown',rbnGalleryKey,true);" in gal


def test_recolouring_a_run_writes_to_the_page_you_are_on():
    deck = assets.deck_js()
    fn = deck.split("  function colorSelection(col){")[1].split("\n  function ")[0]
    assert "textPageSet(a,n,el.innerText,r.rich?r.html:'');" in fn
    # the direct page-one assignment is gone
    assert "a.text=el.innerText;" not in fn
    assert "var n=textAt(s,a); if(!(n>0)) n=0;" in fn
    # textAt is what the renderer binds the editor to, so the two agree
    assert "  function textAt(s,a){" in deck
    assert "  function textPageSet(a,n,t,h){" in deck
