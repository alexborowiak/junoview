"""T587: a finished crop is the frame.

The user, 2026-09-30: "cropping and object is aweful. The outline of it
still stays the pre-cropped." A trim was a mask (a.crop's insets, a
clip-path) over a frame that never changed size, so the outline, the
handles, the snapping and anything attached all went on treating the
picture as uncropped.

Now a picture's trim is edited on the whole picture, and when the trim
ends (Esc, the Crop button again, selecting something else, arming a
tool) the frame becomes the part kept and the picture wears that part as
its window (a.win) -- what PowerPoint's frame is, and what the .pptx
export already writes as srcRect. Trimming again puts the whole picture
back round it, with the old trim as insets; leaving without a change puts
back exactly what was there.

Driven: a 400x200 picture trimmed 25% off the right and 30% off the
bottom went from a 415x207 frame to 307x141 on Esc, showing the three
bands kept; re-entering showed the whole picture at 2:1 again.
"""

from __future__ import annotations

from junoview import assets


def test_the_trim_ends_in_a_window(out):
    assert "  function cropBake(a,nat,ar){" in out
    assert "  function cropUnbake(a){" in out
    fin = out.split("  function cropFinish(){")[1].split("\n  }\n")[0]
    assert "if(cropBake(a,c.nat,c.ar)) markDirty();" in fin
    # nothing trimmed: exactly what was there, no rounding, no undo entry
    assert "if(JSON.stringify(a.crop||null)===c.trim){" in fin


def test_every_way_out_of_trim_mode_finishes_it(out):
    # Esc and the Crop button go through setCropMode
    assert "    if(ended) cropFinish();" in out
    # selecting something else, and arming a tool
    assert "      cropModeOff();\n" in out
    assert "cropModeOff();                     /* T587: the frame takes the trim */" \
        in out
    # the old silent drops are gone
    assert "if(cropMode&&idx!==selAnnot) cropMode=false;" not in out
    assert "if(t!=='select') cropMode=false;" not in out


def test_the_crop_menu_is_the_same_trim(out):
    assert "      if(!cropMode&&typeof selAnnot==='number') setCropMode(true);" \
        in out
    # Reset clears the window too
    assert "        if(a.k==='image') cropUnbake(a);" in out


def test_a_window_clips_inside_the_frame_not_the_frame(out):
    assert "var iw=document.createElement('div');iw.className='an-imgwin';" in out
    css = assets.deck_css()
    assert ".an-imgwin{position:absolute;inset:0;overflow:hidden;" in css
    # the item itself no longer clips (it cut its own handles off)
    assert ".an-image.an-win{overflow:hidden;}" not in css
    # the whole picture, faint, while trimming
    assert ".an-crop-ghost{" in css


def test_the_thumbnail_and_a_callout_follow_the_window(out):
    assert "bx.classList.add('is-win');" in out
    assert "var cwin=sw0?{x:(sw0.x||0)+win.x*sw0.w/100," in out
