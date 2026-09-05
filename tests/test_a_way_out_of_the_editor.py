"""There is a way out of the editor, and it says where it goes (T239).

The user, 2026-09-04: "Also for the whole website, a full screen editor
is missing. There is no home button to go back home."

Worse than reported. While you edit, `.deck-top` is hidden (syncTopBar)
so #deck-exit is not on screen, and the presentations rail is minimised
AND `inert` (deckIsolate, 2026-08-30) so its Notebooks button cannot be
clicked either. app.js's own comment says "the way back out of the
editor is #deck-exit in the QAT, which is visible throughout" -- it is
not in the QAT, it is in the bar the QAT replaces. There was no way out
at all.

Driven on a web build: Home closed the deck and showed the welcome
screen; Close left the editor for the builder. On a rendered page
(mode 'static') Home hides itself, because goHome's own gate is
app-or-web and a button that does nothing is worse than no button.
"""

from __future__ import annotations

from junoview import assets


def test_both_journeys_are_on_the_bar_you_can_see():
    html = assets.deck_html()
    i = html.index('id="deck-qat"')
    j = html.index('id="dc-file"')
    assert i < j, "the way out comes before File"
    assert 'class="rbn-stack qat-way"' in html
    assert 'id="qat-home"' in html and 'id="qat-close"' in html
    assert '<i data-ic="home"></i> Home</button>' in html
    assert '<i data-ic="return"></i> Close</button>' in html


def test_they_are_two_destinations_not_one(out):
    """Home is the start screen; Close is the notebook you were
    building from."""
    assert "  var qatClose=$('#qat-close');" in out
    assert "    if(APP&&typeof APP.goHome==='function') APP.goHome(true);" in out


def test_close_climbs_the_same_ladder_escape_does(out):
    """T239 gave Close one rung. But syncTopBar shows the QAT in create
    mode too, so the second press re-entered the mode it was already in
    and the button was visibly dead (2026-09-05, user: "the close button
    is broken"). It steps out to the builder, then out of the deck --
    which is what the Esc branch has always done."""
    assert "    if(mode==='edit') setUIMode('create'); else closeDeck();" in out
    # ...and Escape's own ladder is still the thing it mirrors
    assert "      else if(mode==='edit'){setUIMode('create');}" in out
    assert "      else closeDeck();" in out


def test_close_takes_its_open_menus_with_it(out):
    """closeDeck() hides the deck without emptying the overlay stack, and
    the handler's stopPropagation keeps the click away from overlayBoot's
    outside-click listener -- so a menu left open would still be
    hidden=false the next time the deck opened."""
    assert "    overlayCloseAll();" in out


def test_the_pick_bars_primary_button_is_wired(out):
    """#pick-done was shown by syncPickbar and referenced nowhere else in
    the JS tree: the one blue button in the flip-book flow did nothing."""
    assert "  var pickDone=$('#pick-done');" in out
    assert "  if(pickDone) pickDone.addEventListener('click',function(){" in out


def test_home_hides_where_there_is_no_home(out):
    """A rendered page is not the app."""
    assert "    var qh=$('#qat-home');" in out
    assert "    if(qh) qh.hidden=!(APP.mode==='app'||APP.mode==='web');" in out


def test_the_home_icon_exists():
    """A roof over a doorway. The icon contract wants every key used."""
    from junoview import branding
    assert "home" in branding._ICON_PATHS
    assert "data-ic=\"home\"" in assets.deck_html()
