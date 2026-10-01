"""T575: touch and pen.

Every canvas gesture is written against mouse events, which a finger drag
never sends. A finger or a pen on the editing canvas is now spoken to
those handlers in the one language they know, with the browser's own
copies suppressed; two taps are a double-click, a held touch the menu,
and presenting, a sideways swipe steps the show.
"""
from junoview import assets


def _js():
    return assets.load("js/deck/25-selecting.js")


def test_pointer_input_is_bridged_to_the_mouse_handlers():
    js = _js()
    body = js.split("function touchBoot(){")[1].split(
        "/* presenting: a quick sideways swipe")[0]
    # never the mouse itself, and only one finger at a time
    assert "if(e.pointerType==='mouse'||!e.isPrimary) return;" in body
    assert "if(touchId!==null) return;" in body
    # the browser's own copies of the events are stopped
    assert "e.preventDefault();" in body
    assert "touchFire(t,'mousedown',e,1);" in body
    assert "touchFire(tg,'mousemove',ev,1);" in body
    assert "touchFire(document,'mouseup',ev,0);" in body
    # typing places its own caret
    assert "if(t.closest('[contenteditable=\"true\"]')) return;" in body


def test_double_tap_and_hold():
    js = _js()
    assert "touchFire(tg,'dblclick',ev,0);" in js
    assert "tg.dispatchEvent(new MouseEvent('contextmenu'" in js
    assert "},600);" in js


def test_presenting_a_swipe_steps():
    js = _js()
    sw = js.split("function touchSwipe(e){")[1].split("\n  }\n")[0]
    assert "if(dx<0) advance(); else backStep();" in sw


def test_the_canvas_keeps_its_fingers():
    css = assets.load("css/deck.css")
    assert ".deck.editing .annot-layer{touch-action:none;}" in css
    boot = assets.load("js/deck/99-boot.js")
    assert "touchBoot();" in boot
