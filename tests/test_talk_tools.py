"""T386: a laser, a magnifier and a black screen for the talk itself
(2026-09-12, user: "the during presentation features, having something
like a magnifying glass that can be swapped to").

Driven in Chromium: M put a round lens over the slide showing the words
under the pointer at twice the size; P a red dot; B a black screen; Esc
took all of it down and left the body's class list empty.
"""

from __future__ import annotations

from junoview import assets


def test_the_tools_are_one_fragment_booted_from_the_boot_sequence(out):
    assert "51-talk-tools" in assets.DECK_PARTS
    assert "  talkToolsBoot();" in out
    # nothing runs at load: every entry point is a function
    part = assets.load("js/deck/51-talk-tools.js")
    assert "})();" not in part      # no executing sub-IIFE (T133)
    for fn in ("setTalkTool", "talkBlack", "talkToolsReset", "talkToolKey",
               "talkToolsBoot", "lensRebuild", "lensPlace"):
        assert f"function {fn}(" in part, fn


def test_each_tool_is_a_key_in_the_show_and_a_button_on_the_panel(out):
    for cid in ("talk-laser", "talk-lens", "talk-black"):
        assert f'id="{cid}"' in out, cid
    assert "    if(k==='p'||k==='P'){setTalkTool('laser');return true;}" in out
    assert "    if(k==='m'||k==='M'){setTalkTool('lens');return true;}" in out
    assert "    if(k==='b'||k==='B'){talkBlack();return true;}" in out
    # the show's key map asks first, and Escape puts everything down
    assert "      if(typeof talkToolKey==='function'&&talkToolKey(e)){" in out
    assert ("    if(k==='Escape'&&(talkTool||talkBlackEl))"
            "{talkToolsReset();return true;}") in out
    # view mode only, and leaving the show puts the tools down
    assert "    if(mode!=='view'||deckEl.hidden) t='';" in out
    assert ("    if(m!=='view'&&typeof talkToolsReset==='function') "
            "talkToolsReset();") in out


def test_the_magnifier_is_a_picture_that_cannot_take_a_click(out):
    # a clone with no ids twice in one document and no editing chrome
    assert "    clone.removeAttribute('id');" in out
    assert "    $$('[id]',clone).forEach(function(n){n.removeAttribute('id');});" in out
    # the point under the pointer lands in the middle of the lens
    assert ("    clone.style.transform='translate('+(R-px*LENS_Z)+'px,'"
            "+(R-py*LENS_Z)") in out
    # refreshed when the slide changes, only while the lens is up
    assert "        lensObs=new MutationObserver(lensSyncSoon);" in out
    assert "      if(lensObs){lensObs.disconnect();lensObs=null;}" in out
    # none of the three take the pointer: a click still advances
    assert (".jv-lensbox{position:fixed;z-index:420;border-radius:50%;"
            "overflow:hidden;\n  pointer-events:none;") in out
    # T465: the body FLAG (jv-lens, jv-laser) and the ELEMENT must not
    # share a name -- `.jv-lens{pointer-events:none}` matched body.jv-lens
    # and killed every click in the show while the magnifier was up
    import re
    css = assets.deck_css()
    flags = set(re.findall(r"classList\.toggle\('(jv-[a-z]+)'", out))
    assert {"jv-lens", "jv-laser"} <= flags, flags
    for flag in flags:
        bare = re.findall(r"(?<![\w.-])\." + re.escape(flag) + r"(?![\w-])\s*[{,]", css)
        assert not bare, f".{flag} is a body flag AND a bare element selector: {bare}"
    assert "lensEl.className='jv-lensbox';" in out
    assert (".jv-laserdot{position:fixed;z-index:420;width:16px;height:16px;\n"
            "  margin:-8px 0 0 -8px;border-radius:50%;pointer-events:none;") in out
    assert (".jv-black{position:fixed;inset:0;z-index:430;background:#000;"
            "cursor:pointer;}") in out
