"""One Update verb, and it asks WHERE (T280).

The user, 2026-09-05: "What is the difference between update figures and
reload pictures. Also that is a big much that. Should be an option, and
it should then be able to then take you to the images tab, or 'update
for whole presentatin' or 'just update this slide' or smoehting."

Two tall tiles sat side by side whose labels differed only in the noun,
so you had to classify your own content -- is that thing a "figure" or a
"picture"? -- before you could choose a button. Neither offered a scope:
both walked the whole deck. And pressing both raced for the single
#deck-toast, so half the answer was lost.

They remain two MECHANISMS behind one door, because they are two
mechanisms: a figure re-reads its notebook through APP.reloadTab, a
picture re-reads a File System Access handle out of IndexedDB. What is
merged is the question you ask and the sentence you get back.

Driven at 1440x900 on the example deck: the group is now "Update" and
"Images"; the menu offers Just this slide / The whole presentation /
Where each one came from; the deck-wide run says "7 figures updated on
the presentation" and the slide-scoped run "1 figure updated on this
slide"; and the third row opens the Images pane.
"""

from __future__ import annotations

from junoview import assets


def test_the_two_tiles_are_one_door():
    html = assets.deck_html()
    assert 'id="hm-update"' in html and 'id="hm-upd-menu"' in html
    assert 'id="hm-refresh-figs"' not in html
    assert 'id="hm-refresh-img"' not in html
    # a CARET, not an ellipsis: the press opens a menu (T267)
    assert "<span>Update &#9662;</span></button>" in html
    # the group keeps its name and its no-fold rule (T202)
    assert 'class="rbn-grp rbn-sources"' in html


def test_the_menu_offers_a_scope_and_the_inventory(out):
    assert "      menuHead(hum,'update from sources');" in out
    assert "      [['Just this slide',true," in out
    assert "       ['The whole presentation',false," in out
    # ..."take you to the images tab": the inventory that answers which
    # of these even has a source
    assert "      inv.innerHTML=bic('image')+' Where each one came from';" in out
    assert "        var ib=$('#hm-images'); if(ib) ib.click();" in out


def test_both_halves_run_quiet_and_one_sentence_is_written(out):
    """There is one #deck-toast and the two verbs used to race for it."""
    assert "  function updateFromSources(slideOnly){" in out
    assert "        ? resyncAllFigures(only,true)" in out
    assert "      pics.length ? refreshImagesReport(pics,true)" in out
    assert "      if(bits.length) msg=bits.join(' and ')+' updated on '+where;" in out
    # the trouble from BOTH halves lands in the same sentence
    assert "      if(trouble.length) msg+=' \\u2014 '+trouble.join('; ');" in out


def test_the_scope_reaches_every_walker(out):
    """A scope that only reached half of them would silently do the whole
    deck for the other half."""
    for sig in ("function staleFigures(only){",
                "function refSourceStems(only){",
                "function chartResyncAll(only){",
                "function linkedImages(only){",
                "function resyncAllFigures(only,quiet){"):
        assert sig in out, sig
    # ...and each guards the same way, so -1/undefined is the whole deck
    assert out.count("if(only>=0&&si!==only) return;") >= 4


def test_the_empty_case_asks_the_right_question(out):
    """staleFigures answers "is anything here OUT OF DATE", which is not
    "does anything here HAVE a source" -- asking the first would tell a
    slide whose figure is perfectly current that it has nothing to
    re-read. Driven: slide 1 said exactly that until this was fixed."""
    assert ("        if(a&&!a.hide&&typeof provRef==='function'"
            "&&provRef(a)) figs++;});") in out
    assert "    if(!pics.length&&!figs){" in out


def test_the_no_pictures_sentence_is_suppressed_under_the_merged_verb(out):
    """"No pictures on this deck are linked to a file" is exactly the
    wrong thing to say on a deck that is all figures."""
    assert "      if(!quiet)" in out
    assert "  function refreshImagesReport(list,quiet){" in out
