"""Three doors into and out of the slide editor (2026-10-10, from the
reviews of the speed work). Driven in Chromium by
tests/test_deck_doors_in_a_browser.py (opt-in); the lines that carry each
fix are pinned here, in the ordinary suite.

1. The keyboard is handed to the editor after the open files' tabs are in
   its title row. app.js moves them there from a MutationObserver on the
   body's class -- which runs after setUIMode returns -- and their arrival
   hides #qat-name, the control the hand-over had chosen; Chrome then
   dropped the keyboard on the page. What it is given now is the editor's
   own first control: not a tab of that row (the app's, and gone back to
   the reader when the editor closes) and not a field (the command search,
   where PageDown and Ctrl+Z would be typing).
2. A presentation opened from a file with the editor already up is put on
   the open list (and in Recent), as openDeck puts every other one: its
   tab went the moment you switched away. And it is handed the keyboard,
   as openDeck hands it over: File > Open's dialog had closed, so the
   keyboard was on the page.
3. Update figures re-reads its notebooks under the editor without leaving
   it: activate() leaves the editor for a notebook clicked in the rail,
   and APP.reloadTab goes through activate. What is under the editor is
   put back afterwards, so leaving it goes where it was opened from (a
   notebook, or Home) and not to the notebook re-read last.
"""

from __future__ import annotations

from helpers_js import lift_fn
from junoview import assets


def _between(src: str, start: str, end: str) -> str:
    i = src.index(start)
    return src[i:src.index(end, i)]


def test_the_tabs_are_placed_before_the_keyboard_is_handed_over():
    app = assets.app_js()
    assert "APP.homeTabsRow=homeTabsRow;" in app
    deck = assets.deck_js()
    body = lift_fn(deck, "setUIModeRun")
    # placed first, then chosen: what is chosen is still there afterwards
    assert ("    if(takeFocus&&!deckEl.hidden&&typeof APP.homeTabsRow"
            "==='function')\n      APP.homeTabsRow();\n"
            "    if(takeFocus&&!deckEl.hidden) deckFocusTake();") in body
    # the one hand-over: no other call chooses before the row is in place
    assert body.count("deckFocusTake();") == 1
    take = lift_fn(deck, "deckFocusTake")
    # the editor's own control: the open files' row is the app's, and goes
    # back to the reader with the editor; a field would take the keys the
    # editor answers (its keydown handler skips these three tags)
    assert "if(el.closest('#open-tabs-row')) continue;" in take
    assert "if(/^(INPUT|SELECT|TEXTAREA)$/.test(el.tagName)) continue;" in take
    assert ("if(tag==='input'||tag==='select'||tag==='textarea') return;"
            in deck)


def test_a_file_opened_in_the_editor_is_on_the_open_list():
    deck = assets.deck_js()
    body = lift_fn(deck, "importDeckText")
    tail = _between(body, "cur=0;activePane=-1;", "status();")
    # the editor already up: openDeck is skipped, so this is what notes it
    assert ("    if(!deckEl.hidden&&typeof notePresentationOpen==='function')"
            "\n      notePresentationOpen(pres.name);") in tail
    assert tail.index("notePresentationOpen(pres.name);") \
        < tail.index("if(wasHidden) openDeck('edit');")
    # and openDeck is still what notes every other door
    assert "notePresentationOpen(pres.name);" in lift_fn(deck, "openDeck")


def test_a_file_opened_in_the_editor_hands_it_the_keyboard():
    deck = assets.deck_js()
    body = lift_fn(deck, "importDeckText")
    # openDeck hands the keyboard over (setUIMode); with the editor already
    # up it is skipped, and File > Open's dialog had closed before the file
    # was chosen -- so the keyboard was on the page. Not in a talk: there
    # the first control is the show's Exit, which Space would press.
    line = "    if(!wasHidden&&mode==='edit') deckFocusTake();\n"
    assert line in body
    assert body.index("    if(!wasHidden) refresh();\n") < body.index(line)


def test_update_figures_does_not_leave_the_editor():
    app = assets.app_js()
    act = lift_fn(app, "activate")
    # the rail's click still leaves the editor; a re-read under it does not
    assert ("if(document.body.classList.contains('slide-editing')"
            "&&APP.deckClose\n       &&!reloadUnderDeck)") in act
    reload = _between(app, "APP.reloadTab=function(stem,pathHint){",
                      "function closeNotebook(")
    held = _between(reload, "reloadUnderDeck=true;",
                    "}finally{reloadUnderDeck=false;}")
    # both halves of the re-read run with the editor held up
    assert "if(j.unchanged) activate(stem);" in held
    assert "else mountShellHTML(j.shell,j.path||path,true);" in held
    # and nothing else sets it: every other activate is a real switch
    assert app.count("reloadUnderDeck=true;") == 1
    # ...and what is under the editor is put back: leaving it goes where it
    # was opened from (a notebook, or Home), not to the source re-read last
    assert ("var under=document.body.classList.contains('slide-editing'),\n"
            "          back=APP.active,home=atHome;") in reload
    assert ("        if(under){\n"
            "          if(back&&back!==APP.active&&APP.shells[back]) "
            "activate(back);\n"
            "          atHome=home;\n"
            "        }\n") in held
