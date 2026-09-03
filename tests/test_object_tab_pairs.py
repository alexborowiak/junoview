"""The Object tab paired on purpose, and tooltips in plain words (T208).

The user, 2026-09-02: "buttons in buttons that are confusing and do
nothing... What does 'colours and spacing' do? I have tried to figure
this out so many times, the description makes no sense either... there
are all these cool features hidden under buttons in stupid places and
stupid names."
"""

from __future__ import annotations

import re

from junoview import assets


def _row(html: str, label: str) -> str:
    fmt = html.index('<span class="et-fmt" id="et-fmt" hidden>')
    lab = html.index('<span class="rbn-lab">' + label + "</span>", fmt)
    row = html.rfind('<span class="rbn-row">', fmt, lab)
    return html[row:lab]


def _ids(row: str) -> list[str]:
    return re.findall(r'\bid="([a-z0-9-]+)"', row)


def test_the_text_group_has_two_runs_and_deliberate_pairs():
    html = assets.deck_html()
    row = _row(html, "Text")
    ids = _ids(row)
    # Font over Styles, then the two runs, then bullets over numbers
    order = ["fmt-fontwrap", "fmt-stylewrap-tx", "tx-run-style", "tx-run-align",
             "fmt-bullets", "fmt-numbers", "fmt-parawrap"]
    at = [ids.index(i) for i in order]
    assert at == sorted(at), order
    style = row[row.index('id="tx-run-style"'):row.index('id="tx-run-align"')]
    for cid in ("fmt-bold", "fmt-ital", "fmt-under"):
        assert f'id="{cid}"' in style, cid
    align = row[row.index('id="tx-run-align"'):row.index('id="fmt-bullets"')]
    for cid in ("fmt-al-left", "fmt-al-center", "fmt-al-right"):
        assert f'id="{cid}"' in align, cid


def test_arrange_and_object_groups_pair_what_belongs_together():
    html = assets.deck_html()
    ids = _ids(_row(html, "Arrange"))
    assert ids[:4] == ["fmt-dup", "fmt-alignwrap", "fmt-align-btn", "fmt-align-menu"] \
        or ids[:2] == ["fmt-dup", "fmt-alignwrap"]
    assert ids.index("fmt-front") < ids.index("fmt-back") < ids.index("fmt-group")
    obj = _ids(_row(html, "Object"))
    assert obj.index("fmt-lock") < obj.index("fmt-lockar") < obj.index("fmt-geom-xy") \
        < obj.index("fmt-geom-wh") < obj.index("fmt-cropwrap")


def test_a_run_with_nothing_showing_takes_no_column(out):
    assert ".rbn-row>.rbn-cell:not(:has(:not([hidden]))){display:none;}" in out
    assert ".edit-tools .dbtn.rbn-sm,.edit-tools .dbtn.etm,.edit-tools .fx-tile," in out


def test_no_tooltip_carries_a_developer_note():
    """A tooltip is for the person pressing the button. Dates, ticket
    codes, task codes and 'used to' are for the commit message."""
    html = assets.deck_html()
    bad = []
    for m in re.finditer(r'title="([^"]*)"', html):
        t = m.group(1)
        note = r"\(20\d\d-|JVUX-|\bT1\d\d\b|\bT2\d\d\b|used to point|caught it"
        if re.search(note, t):
            bad.append(t[:80])
    assert not bad, bad


def test_the_palette_door_says_what_a_named_colour_is():
    html = assets.deck_html()
    i = html.index('id="dsg-tokens"')
    btn = html[i:html.index("</button>", i)]
    # T215: a door with a chevron like Background, named for what it holds
    assert "Deck colours &#9662;" in btn
    assert "The six colours this deck shares" in btn
    assert "every box wearing it changes too" in btn
    js = assets.deck_js()
    # on the overlay stack, so Escape and an outside click close it
    assert "overlayShow(anchor,m);" in js
    assert "if(open){overlayHide(open);return;}" in js
    assert "These six colours are shared by the whole deck." in js
