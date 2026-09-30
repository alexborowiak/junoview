"""T569: the File menu keeps the destructive rows apart, and they ask.

Discard changes and Delete presentation already sat at the foot of File
under "Careful -- these lose work". Delete asked; Discard asked only when
there was no saved copy, so with one a single click threw every change
away -- and in this browser, where Save and the autosave write the same
draft, it found no saved copy at all and offered to DELETE a deck that had
just been saved.
"""
from junoview import assets


def _js():
    return assets.load("js/deck/60-saving-and-export.js")


def _discard():
    js = _js()
    return js.split("menuAction('#mi-discard',function(){")[1].split(
        "\n  });\n")[0]


def test_the_careful_rows_are_last_in_their_own_section():
    html = assets.load("html/deck.html")
    head = html.index("dc-mhead-warn")
    assert head < html.index('id="mi-discard"') < html.index('id="mi-del"')
    # nothing else of File's comes after them
    tail = html[head:].split("</div>")[1]
    assert tail.count('class="dc-mi') == 2


def test_discard_always_asks_and_says_what_it_goes_back_to():
    body = _discard()
    # nothing changed: nothing to ask
    assert "if(source==='saved'||saveKind==='manual'){" in body
    assert "Nothing to discard" in body
    # a file, this browser, a saved copy, no copy -- four questions
    assert body.count("askYes({") == 4
    assert body.count("ok:'Discard changes',cancel:'Keep editing'") == 3
    # the old unconditional discardNow(nm) at the end is gone
    assert not body.rstrip().endswith("discardNow(nm);")


def test_a_browser_save_names_the_version_discard_goes_back_to():
    js = _js()
    assert "deckMetaSet(snapNm,{savedSnap:e.id});" in js
    body = _discard()
    assert ("var sp=saveTarget==='browser'?deckMeta(nm).savedSnap:null;"
            in body)
    # through the history's own restore, so Ctrl+Z brings it back
    assert "histRestoreDeck(then,sp);" in body
    assert "Ctrl+Z brings the changes back" in body


def test_delete_still_asks():
    js = _js()
    assert ("askDeleteDeck(nm,function(){deletePresByName(nm);});") in js
