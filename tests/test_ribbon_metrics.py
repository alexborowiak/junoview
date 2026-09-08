"""The ribbon's measurements are tokens now, so something has to pin the
VALUES (T369).

Every other ribbon test in this suite reads the stylesheet as text and
asserts a rule it expects to find. That was a real guard while each rule
carried its own number: `height:56px` in eleven places meant eleven
assertions, and moving a tile meant editing eleven of them. Once the
number lives in one custom property those assertions pin a NAME, and one
line in the `.deck` token block could move every tile, every button and
the whole band with the suite still green -- which is exactly the shape
of the two failures this project has already had (T139 deleted every
ribbon tab with 954 tests passing; T177 left the Colour group invisible
for a week).

So this file pins the values themselves, and the arithmetic between them
that no single rule states:

* the band really is two tracks and the gap between them,
* the bar really is tall enough for a group's whole stack,
* the button really is smaller than the track it is centred in, which is
  the only vertical slack the row has left,
* the gallery's scroll step in JS really is the tile plus its gap, and
* every rung of the density ladder really is TIGHTER than the resting
  size -- which is the bug T369 found: the ladder had been written
  against a 9px group and an 8px button, so its first two rungs made a
  compacted ribbon WIDER and the ladder climbed to its last rung, and
  then folded groups behind doors, at widths where nothing needed to
  move at all.
"""

from __future__ import annotations

import re

import junoview.assets as assets

# What the numbers are for is documented in deck.css's token block; these
# are PowerPoint's, measured at 100% on a 96dpi screen.
DECK_TOKENS = {
    "--rbn-btn-h": 26,
    "--rbn-track": 28,
    "--rbn-row-gap": 4,
    "--rbn-band": 60,
    "--rbn-col-gap": 3,
    "--rbn-btn-px": 6,
    "--rbn-btn-gap": 4,
    "--rbn-grp-px": 6,
    "--rbn-tile-w": 64,
    "--rbn-tile-h": 56,
    "--rbn-tile-gap": 4,
}

APP_TOKENS = {"--ab-btn-h": 28, "--ab-btn-px": 5, "--ab-btn-gap": 4}

# the group's own box: padding-top, gap, padding-bottom, and the label
GRP_PAD_TOP = 6
GRP_PAD_BOTTOM = 4
GRP_GAP = 4
LAB_H = 12.5     # 11.5px sans at line-height 1, plus 1px of padding-top
BAR_H = 92       # .edit-tools.ribbon


def _tokens(css: str, block: str, names) -> dict[str, int]:
    """Read the declarations of one rule block, in px."""
    i = css.index(block)
    body = css[i + len(block):css.index("}", i)]
    got = {}
    for name in names:
        m = re.search(re.escape(name) + r":\s*(\d+(?:\.\d+)?)px", body)
        assert m, f"{name} is not declared in {block!r}"
        got[name] = float(m.group(1))
    return got


def test_the_deck_ribbon_states_its_measurements_once(out):
    """One token block, and nothing else in the sheet restates a number
    it owns."""
    css = assets.deck_css()
    got = _tokens(css, ".deck{\n", DECK_TOKENS)
    assert got == {k: float(v) for k, v in DECK_TOKENS.items()}, got
    # and the block is reachable from the rendered page, not just the file
    assert "--rbn-tile-w:64px" in out


def test_the_viewer_bar_states_its_measurements_once():
    css = assets.load("css/app.css")
    got = _tokens(css, ":root{", APP_TOKENS)
    assert got == {k: float(v) for k, v in APP_TOKENS.items()}, got


def test_the_band_is_its_two_tracks_and_the_gap_between_them():
    """`.rbn-row` states the band height as well as its tracks, so the
    one rule can disagree with itself."""
    t = DECK_TOKENS
    assert t["--rbn-band"] == 2 * t["--rbn-track"] + t["--rbn-row-gap"]


def test_the_bar_is_tall_enough_for_a_group_and_no_taller_than_it_needs():
    """106px used to hide ~10px of slack that .rbn-grp's space-between
    quietly distributed, so lowering the band alone changed nothing and
    lowering the bar alone put the label through the row. The bar is
    computed from the stack now, with a couple of px of absorption and
    no more."""
    need = (GRP_PAD_TOP + DECK_TOKENS["--rbn-band"] + GRP_GAP
            + LAB_H + GRP_PAD_BOTTOM)
    slack = BAR_H - 1 - need          # -1 for the bar's own bottom border
    assert 0 <= slack <= 6, f"group needs {need}px in a {BAR_H}px bar"
    css = assets.deck_css()
    assert f"flex:none;height:{BAR_H}px;" in css
    assert (f".rbn-grp{{display:flex;flex-direction:column;align-items:center;\n"
            f"  justify-content:space-between;gap:{GRP_GAP}px;\n"
            f"  padding:{GRP_PAD_TOP}px var(--rbn-grp-px) {GRP_PAD_BOTTOM}px;")\
        in css


def test_the_button_is_smaller_than_the_track_it_sits_in():
    """The 2px of track around a 26px button is the row's only vertical
    absorption: a control that arrives a little tall is centred in it
    rather than bursting the band. Zero would make every future control
    a bug in the bar's height."""
    t = DECK_TOKENS
    assert t["--rbn-btn-h"] < t["--rbn-track"]
    assert t["--rbn-track"] - t["--rbn-btn-h"] >= 2
    # ...and the button was NOT shrunk to buy width (2026-08-20, user:
    # "buttons could also have more height")
    assert t["--rbn-btn-h"] == 26


def test_the_gallery_scroll_step_is_a_tile_and_its_gap():
    """55-sections-and-strip.js moves the strip by whole rows with a
    hard-coded number. It cannot read a CSS token, so the two have to be
    checked against each other or a tile change silently leaves the
    arrows scrolling to a cut tile."""
    js = assets.deck_js()
    m = re.search(r"var ROW=(\d+);", js)
    assert m, "the strip's row step is gone"
    assert int(m.group(1)) == (DECK_TOKENS["--rbn-tile-h"]
                               + DECK_TOKENS["--rbn-tile-gap"])
    # the frame gives the strip 2px of top padding, so a row still starts
    # at an exact multiple of that step
    css = assets.deck_css()
    assert ".strip-frame>.fx-strip{height:calc(var(--rbn-band) - 2px);\n" in css
    assert "  padding:2px 4px 0;box-sizing:border-box;" in css
    assert "align-content:flex-start" in css


def _rung_paddings(css: str, pat: str) -> list[tuple[str, float]]:
    out = []
    for m in re.finditer(pat + r"[^{]*\{([^}]*)\}", css):
        sel = m.group(0)[:m.group(0).index("{")]
        for d in re.finditer(r"padding(?:-left|-right)?:\s*([^;}]+)", m.group(1)):
            v = d.group(1).strip().split()[-1]
            if v.endswith("px") and v[:-2].replace(".", "").isdigit():
                out.append((sel.strip(), float(v[:-2])))
    return out


def test_no_density_rung_is_looser_than_the_resting_ribbon():
    """THE BUG T369 FOUND. Every rung was written against a 9px group and
    an 8px button. Compact the resting bar past those numbers and erc1
    and erc2 become a step UP: the row grew when the ladder tried to
    shrink it, so fitEditRibbon climbed every rung and then folded
    groups behind doors on a 1560px window. A rung is a step DOWN or it
    is not a rung."""
    css = assets.deck_css()
    base_grp = DECK_TOKENS["--rbn-grp-px"]
    base_btn = DECK_TOKENS["--rbn-btn-px"]
    # the CHANGING half's ladder
    for sel, px in _rung_paddings(css, r"\.deck\.erc(?:\d|-tight) [^{]*\.rbn-grp"):
        assert px <= base_grp, f"{sel} pads a group to {px}px over {base_grp}px"
    btn = r"\.deck\.erc(?:\d|-tight) [^{]*\.(?:dbtn\.rbn-sm|rbn-row \.dbtn\.etm)"
    for sel, px in _rung_paddings(css, btn):
        assert px <= base_btn, f"{sel} pads a button to {px}px over {base_btn}px"
    # the CONSTANT half opts out of that ladder at a slightly wider
    # resting size and has width rungs of its own; they step down from
    # the opt-out, not from the token
    m = re.search(r"\.deck \.edit-tools \.rbn-grp\.rbn-fixed\{padding-left:(\d+)px",
                  css)
    assert m, "the constant half's opt-out is gone"
    fixed = int(m.group(1))
    assert base_grp <= fixed <= base_grp + 2, fixed
    for sel, px in _rung_paddings(css, r"\.deck\.ercw\d [^{]*\.rbn-fixed"):
        assert px <= fixed, f"{sel} pads to {px}px over the {fixed}px opt-out"


def test_every_width_rung_actually_steps():
    """ercw4 had no .rbn-row rule at all, so the last width rung
    inherited ercw3's gaps and bought nothing but 1px of group
    padding."""
    css = assets.deck_css()
    for n in (1, 2, 3, 4):
        assert f".deck.ercw{n} .edit-tools .rbn-fixed .rbn-row{{" in css, n


def test_the_icon_has_one_spacer_not_two():
    """`.dbtn .bic` carries margin-right:4px and `.dbtn.rbn-sm` a 6px
    flex gap; they stacked, so a button holding a .bic had 10px between
    icon and word and one holding a bare svg had 6px -- two rhythms on
    one row, and 4px of width on most of the bar."""
    css = assets.deck_css()
    assert ".dbtn .bic{display:inline-block;vertical-align:-2px;width:13px;" in css
    assert "margin-right:4px;}" in css        # the base rule is untouched
    assert (".dbtn.rbn-sm i,.dbtn.rbn-sm svg{width:15px;height:15px;flex:none;\n"
            "  margin-right:0;}") in css


def test_one_type_size_for_a_worded_ribbon_button():
    """T219 set the ribbon's words in the sans at 12px and said no
    density rung may shrink them. `.rbn-row .dbtn.etm` was shrinking
    them at REST: the same class read 12px outside the row and 10.5px
    inside it, so "Duplicate" on Home and "Duplicate" on Object were
    different sizes."""
    css = assets.deck_css()
    assert (".rbn-row .dbtn.etm{display:inline-flex;align-items:center;\n"
            "  justify-content:center;font-size:12px;") in css
    row = css[css.index(".rbn-row .dbtn.etm,"):css.index(".rbn-row .fmt-range{")]
    assert "10.5px" not in row, row
