"""Zoom, and pan, inside the full-screen figure viewer (T255).

The user, 2026-09-04: "when viewing plots in full screen you can't zoom
in. that would be a really good feature to have".

The expand button (⤢) already gave a figure the whole window, but the
window was all it gave: whatever size the plot settled at was the only
size it had. A dense map or a small-multiples panel is exactly the plot
you open full screen and exactly the plot you then need to look INTO.

The zoom is CSS `zoom` on a wrapper whose size is pinned in px at open.
Both halves matter and neither works alone:

* `zoom` rather than a transform, because zoom grows the LAYOUT box --
  so .figmax-box overflows and gets real scrollbars, which is what a
  drag pans by moving. A transform paints outside the box and scrolls
  nothing.
* the px pin, because the figure carries `max-width:100%` of a box that
  is itself shrink-to-fit. Left free, every zoom step just re-clamped
  the image against a wider box: driven at 195% the plot came back
  1304px wide instead of 1455px and .figmax-box never overflowed at all
  (scrollWidth == clientWidth), so there was nothing to pan.

Driven on the example notebook at 1440x900: the plot fits at 746px,
three Bigger presses put it at 1455px (195%) with the box scrolling
1510 > 1357, a drag moved scrollLeft to 80, the wheel stepped 115%,
"+" 125%, "0" back to 100%, Smaller stopped and disabled at 50% and
Bigger at 800%, Escape emptied the wrapper, and the next figure opened
at 100% rather than inheriting the last one's zoom.
"""

from __future__ import annotations

from junoview import assets


def test_the_viewer_has_a_zoom_bar():
    page = assets.load("html/page.html")
    for cid in ("figmax", "figmax-bar", "figmax-box", "figmax-scale",
                "figmax-zout", "figmax-zval", "figmax-zin", "figmax-close"):
        assert f'id="{cid}"' in page, cid


def test_every_button_on_the_bar_carries_its_word():
    """Words PLUS icons, never icon-only — rejected twice (AGENTS.md)."""
    page = assets.load("html/page.html")
    bar = page.split('id="figmax-bar"')[1].split("</div>")[0]
    for word in ("Smaller", "Bigger", "Close"):
        assert f"> {word}</button>" in bar or f">{word}</button>" in bar, word
    for ic in ("minus", "plus", "exit"):
        assert f'data-ic="{ic}"' in bar, ic


def test_the_readout_is_a_zoom_percentage_not_the_word_fit():
    """"Fit" was tried on the feed's own zoom and rejected (2026-08-07,
    user: "the fit button is confusing... I think you mean zoom"). The
    same word must not come back on a second zoom control."""
    page = assets.load("html/page.html")
    assert ">Zoom 100%</button>" in page
    assert ">Fit</button>" not in page
    app = assets.app_js()
    assert "    if(v) v.textContent='Zoom '+Math.round(fmZoom*100)+'%';" in app


def test_the_zoom_grows_the_layout_box_so_the_viewer_can_pan():
    css = assets.load("css/core.css")
    # zoom, NOT transform: a transform would paint outside the box and
    # leave nothing to scroll
    assert ".figmax-scale{zoom:var(--fmz,1);}" in css
    assert "transform:scale(var(--fmz" not in css
    assert ".figmax-box{max-width:96vw;max-height:92vh;overflow:auto;" in css
    # the cursor says the plot can be dragged, and only while it can be
    assert ".figmax.zoomed .figmax-box{cursor:grab;}" in css
    assert ".figmax.zoomed .figmax-box.panning{cursor:grabbing;}" in css


def test_the_fitted_size_is_pinned_in_px_at_open():
    """Without the pin the figure's own max-width:100% re-clamps it
    against a box that grew, so zooming stops making it bigger."""
    app = assets.app_js()
    assert "  function fmFit(){" in app
    assert "      sc.style.width=Math.ceil(r.width)+'px';" in app
    assert "      sc.style.height=Math.ceil(r.height)+'px';" in app
    # measured again once an image has decoded — a lazy img is 0x0 at the
    # instant it is cloned in
    assert ("      if(!im.complete) "
            "im.addEventListener('load',fmFit,{once:true});});") in app


def test_the_wheel_and_a_drag_do_the_same_job_as_the_buttons():
    app = assets.app_js()
    assert "      box.addEventListener('wheel',function(e){" in app
    assert "      box.addEventListener('dblclick',function(e){" in app
    assert "      box.addEventListener('mousedown',function(e){" in app
    # panning is scrolling, so it needs somewhere to scroll to
    assert "        if(e.button!==0||fmZoom<=1) return;" in app
    assert "          box.scrollLeft=sl-(ev.clientX-x0);" in app


def test_zooming_anchors_on_the_painted_rect_not_on_scrollleft():
    """Until the plot overflows it is CENTRED in the box, so a
    scroll-origin model is out by the centring gap and the plot jumps
    sideways on the first wheel step (driven: the point under the cursor
    moved 190px)."""
    app = assets.app_js()
    assert ("    var br=box.getBoundingClientRect(),"
            "sr=sc.getBoundingClientRect();") in app
    assert "    var cx=(ax-sr.left)/fmZoom,cy=(ay-sr.top)/fmZoom;" in app
    assert "    box.scrollLeft+=(s2.left+cx*z)-ax;" in app


def test_the_keys_are_the_ones_every_viewer_uses():
    app = assets.app_js()
    assert ("      if(e.key==='+'||e.key==='='){"
            "e.preventDefault();e.stopPropagation();") in app
    assert ("      else if(e.key==='-'||e.key==='_'){"
            "e.preventDefault();e.stopPropagation();") in app
    assert ("      else if(e.key==='0'){"
            "e.preventDefault();e.stopPropagation();") in app
    # Escape still closes, and still before anything else sees it
    assert ("      if(e.key==='Escape'){"
            "e.stopPropagation();closeFigMax();return;}") in app


def test_each_figure_opens_at_100_percent():
    """A zoom carried over from the last figure is a plot that opens
    already scrolled off its own edge."""
    app = assets.app_js()
    open_fn = app.split("  function openFigMax(fig){")[1].split("\n  function ")[0]
    assert "fmZoom=1;fmApply();" in open_fn
    assert "box.scrollLeft=0;box.scrollTop=0;" in open_fn
    close_fn = app.split("  function closeFigMax(){")[1].split("\n  function ")[0]
    assert "sc.style.removeProperty('width');" in close_fn


def test_the_ends_of_the_range_disable_their_button():
    app = assets.app_js()
    assert "  var FM_MIN=0.5,FM_MAX=8,fmZoom=1;" in app
    assert "    if(zo) zo.disabled=fmZoom<=FM_MIN+0.001;" in app
    assert "    if(zi) zi.disabled=fmZoom>=FM_MAX-0.001;" in app


def test_the_backdrop_still_closes_but_the_bar_does_not():
    """The bar lives INSIDE the overlay now, so the old
    `e.target===host` test alone would swallow every button press."""
    app = assets.app_js()
    assert ("      if(e.target===host||(e.target.closest&&"
            "e.target.closest('#figmax-close')))") in app
