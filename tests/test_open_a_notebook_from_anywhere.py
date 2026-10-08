"""Open a notebook from anywhere, as an ordinary tab (T610).

"When I am in a presentation in the app there is no way to open
notebooks ... It would be good to be able to open notebooks as tabs as
well. I don't think they should show up as any different. You have to go
back to the home to be able to open a new notebook." T602 meant Open a
notebook to be a row of File in both views; only the reader's had it.
Now the editor's File has it, Ctrl+O opens it from the editor, and the
library Ctrl+K and Open a presentation land in offers it too -- all
pressing the one real door (#tab-open). A notebook's tab wears its
kind's icon, as a presentation's does. Escape over the Open dialog no
longer also leaves the editor.

Driven at 1366x657: File > Open a notebook... from the slide editor,
the notebook opened as a tab beside the presentation's, the same shape.
"""

from __future__ import annotations

from helpers_js import lift_fn
from junoview import assets


def test_the_editors_file_opens_a_notebook():
    deck = assets.deck_html()
    menu = deck[deck.index('id="dc-menu"'):deck.index('id="mi-del"')]
    assert ('id="mi-open-nb" data-for="tab-open"' in menu)
    assert menu.index('id="mi-open"') < menu.index('id="mi-open-nb"') \
        < menu.index('id="mi-load"')
    row = menu[menu.index('id="mi-open-nb"'):]
    row = row[:row.index("</button>")]
    assert " hidden" in row and "Open a notebook&#8230;" in row


def test_a_door_shows_only_where_a_notebook_can_open():
    app = assets.load("js/app.js")
    chrome = lift_fn(app, "refreshChrome")
    assert ("['#mi-open-nb','#presentation-hub-nb'].forEach(function(s){\n"
            "      var b=$(s); if(b) b.hidden=!canOpen;});") in chrome


def test_ctrl_o_opens_one_from_the_editor():
    app = assets.load("js/app.js")
    assert ("    if(b.contains('doc-presenting')||b.contains('picking')) "
            "return;\n"
            "    if(b.contains('deck-open')&&!b.contains('slide-editing')) "
            "return;\n"
            "    if(!openBtn||openBtn.hidden) return;\n") in app
    # the library's own door, when the library is up (it sits over the
    # Open dialog); otherwise the Open door itself
    assert ("    if(hub&&!hub.hidden&&hn&&!hn.hidden){e.preventDefault();"
            "hn.click();return;}\n"
            "    e.preventDefault();openBtn.click();") in app


def test_escape_over_the_open_dialog_keeps_the_editor():
    app = assets.load("js/app.js")
    assert ("      if(e.key!=='Escape'||!dlg||dlg.hidden) return;\n") in app
    # a question asked over it ("That did not open") has its own Escape
    assert ("      var ask=$('#ask-dlg'); if(ask&&!ask.hidden) return;\n"
            "      e.preventDefault();e.stopPropagation();hideDlg();\n"
            "    },true);") in app
    assert "if(e.key==='Escape'&&dlg&&!dlg.hidden) hideDlg();" not in app


def test_the_open_library_offers_a_notebook():
    page = assets.page_template()
    assert 'id="presentation-hub-nb"' in page
    assert '<i data-ic="nb"></i> Open a notebook&#8230;</button>' in page
    hub = lift_fn(assets.deck_js(), "presentationHubBoot")
    assert ("closePresentationHub();var t=$('#tab-open');if(t) t.click();"
            in hub)


def test_a_notebook_tab_is_drawn_like_a_presentation_tab():
    app = assets.load("js/app.js")
    tab = lift_fn(app, "makeTab")
    assert "nic.className='tab-ico';" in tab
    assert "nic.innerHTML=sh.kind?bic('doc'):bic('nb');" in tab
    assert "ic.className=top?'tab-ico':'pr-ico';" in assets.deck_js()
    css = assets.load("css/app.css")
    assert ".top-tabstrip .tab-ico{" in css and "top-pres-ico" not in css


def test_what_the_open_dialog_says_is_seen_and_not_in_a_talk():
    """2026-10-08 review: an Open that failed from the editor was told
    underneath the Open dialog (the editor's stacking context), unseen,
    holding the keyboard; and the library's notebook door was offered in
    a slideshow, where the notebook opened out of sight."""
    js = assets.deck_js()
    host = js.split("  function askHost(dlg){", 1)[1].split("\n  }\n", 1)[0]
    assert ("    if(document.querySelector('#opendlg:not([hidden]),'\n"
            "      +'#presentation-hub:not([hidden])')) host=document.body;"
            ) in host
    hub = js.split("  function openPresentationHub(opts){", 1)[1].split(
        "\n  }\n", 1)[0]
    assert "||(!deckEl.hidden&&mode==='view');" in hub
