"""T249: the widget does not show dead pin, label and eye buttons.

render_item emits the app's per-cell chrome for every frontend, and
widget.js wired none of it -- the widget adds its own hide button --
so it presented three controls per card that looked interactive and
did nothing. They come off in mount() before anything shows.
"""

from __future__ import annotations

from junoview import assets


def test_mount_strips_the_controls_it_does_not_wire():
    js = assets.load("js/widget.js")
    mount = js.split("function mount(model, el){")[1].split("\nfunction ")[0]
    assert "  $$('.cell-pin,.cell-mark,.cell-eye').forEach(b=>b.remove());" in mount
    # before the widget's own chrome is added, and never wired
    assert mount.index(".cell-pin,.cell-mark,.cell-eye") < mount.index(
        "b.className='hidebtn';")
    for never in ("'.cell-pin'", "'.cell-mark'", "'.cell-eye'"):
        assert never not in js
