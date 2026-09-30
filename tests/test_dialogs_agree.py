"""T568: dialogs agree on their buttons.

Cancel on the left, the verb on the right, Escape cancels and Enter does
the verb -- in every dialog. The markup already put Cancel first; the keys
were each dialog's own, wired on its own box, and a box only hears a key
while the focus is inside it. After a ribbon door opened Saved layouts the
focus was still on the ribbon, so Escape went past the dialog to the
canvas behind (driven 2026-09-30). One listener now answers for all of
them, and each comes up with the focus inside it.
"""
import re

from junoview import assets


def _deck():
    return assets.deck_js()


def test_one_listener_answers_for_every_editor_dialog():
    js = _deck()
    assert "function dlgKeysBoot(){" in js
    body = js.split("function dlgKeysBoot(){")[1].split("\n  }\n")[0]
    # on window, in capture: ahead of the canvas and the overlay owner
    assert "window.addEventListener('keydown',function(e){" in body
    assert body.rstrip().endswith("},true);")
    # Escape presses Cancel (or the close), Enter presses the verb
    assert "if(e.key==='Escape'){" in body
    assert "var c=dlgButton(d,'cancel');" in body
    assert "var v=dlgButton(d,'verb');" in body
    # a text area keeps Enter for new lines; Ctrl+Enter is the verb
    assert "(tag==='TEXTAREA'&&!(e.ctrlKey||e.metaKey))" in body
    # the question keeps its own keys, and this stands down under it
    assert "if(ask&&dlgShown(ask)) return;" in body
    # booted from THE BOOT SEQUENCE, after the overlay owner
    boot = assets.load("js/deck/99-boot.js")
    assert boot.index("overlayBoot();") < boot.index("dlgKeysBoot();")


def test_every_dialog_in_the_markup_is_in_the_list():
    """A new .aa-dlg or .eq-dlg that is not listed would be back to
    hearing keys only while it happened to hold the focus."""
    html = assets.load("html/deck.html")
    ids = re.findall(r'<div class="(?:aa-dlg|eq-dlg)[^"]*" id="([a-z-]+)"',
                     html)
    assert len(ids) >= 7
    js = _deck()
    keyed = js.split("var DLG_KEYED=")[1].split(";")[0]
    for i in ids:
        if i == "ask-dlg":
            continue
        assert "#" + i in keyed, i


def test_a_dialog_comes_up_with_the_focus_in_it():
    js = _deck()
    assert "function dlgFocus(d){" in js
    assert ("new MutationObserver(function(){\n"
            "          if(dlgShown(d)) dlgFocus(d);") in js


def test_the_chart_numbers_put_cancel_first():
    js = assets.load("js/deck/47-charts.js")
    assert "rowb.appendChild(no);rowb.appendChild(ok);" in js
    assert "rowb.appendChild(ok);rowb.appendChild(no);" not in js
    assert "no.id='chart-data-cancel';" in js


def test_markup_dialogs_put_cancel_before_the_verb():
    html = assets.load("html/deck.html") + assets.load("html/page.html")
    for cancel, verb in (("eq-cancel", "eq-ok"), ("md-cancel", "md-ok"),
                         ("aa-cancel", "aa-ok"), ("ar-cancel", "ar-ok"),
                         ("ms-cancel", "ms-ok"), ("ts-cancel", "ts-ok"),
                         ("ask-cancel", "ask-ok"),
                         ("auto-slides-cancel", "auto-slides-create"),
                         ("note-dlg-cancel", "note-dlg-save")):
        assert html.index(f'id="{cancel}"') < html.index(f'id="{verb}"')


def test_the_notebook_note_saves_on_ctrl_enter():
    app = assets.app_js()
    assert ("else if(ev.key==='Enter'&&(ev.ctrlKey||ev.metaKey)"
            "&&!e.dlg.hidden") in app
