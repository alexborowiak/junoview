"""What the adversarial check found still wrong after T207-T211 (T212).

Three checkers read the current files against every complaint in the
2026-09-02 brief and a refuter tried to knock each finding down; these
are the ones that stood.
"""

from __future__ import annotations

import html as htmlmod
import re
from pathlib import Path

import junoview.assets as assets


def _row(html: str, label: str, start: str = '<div class="edit-tools ribbon"') -> str:
    fmt = html.index(start)
    lab = html.index('<span class="rbn-lab">' + label + "</span>", fmt)
    row = html.rfind('<span class="rbn-row">', fmt, lab)
    return html[row:lab]


def _ids(row: str) -> list[str]:
    return re.findall(r'\bid="([a-z0-9-]+)"', row)


def test_the_three_bad_pairs_are_paired_now():
    html = assets.deck_html()
    # (T215 moved Tidy page into Layout, paired with Spacing, and put the
    # page itself first on Design)
    slide = _ids(_row(html, "Slide"))
    assert slide.index("bg-drop") < slide.index("page-strip-frame")
    assert "dsg-tidy" not in slide
    lay = _ids(_row(html, "Layout"))
    assert lay.index("hm-lay-tidy") < lay.index("dsg-tidy")
    furn = _ids(_row(html, "Page furniture"))
    assert furn[:4] == ["dc-head", "dc-foot", "dc-wmark", "dc-nums"]
    anim = _row(html, "Animation", start='<span class="et-fmt" id="et-fmt" hidden>')
    run = anim[anim.index('id="tx-run-by"'):]
    for cid in ("fmt-by-all", "fmt-by-para", "fmt-by-sent"):
        assert f'id="{cid}"' in run, cid


def test_the_redundant_door_and_the_boxed_doors_are_gone(out):
    assert "show('#fmt-sizepos',false);" in out
    assert 'class="dbtn etm" id="fmt-txcol-btn"' in out
    assert 'class="dbtn etm" id="fmt-fillcol-btn"' in out
    # the light theme no longer boxes the Object tab
    assert ("body.light .edit-tools .dbtn.rbn-sm,body.light .edit-tools .dbtn.etm,\n"
            "body.light .edit-tools .rbn-cell .dbtn,") in out
    assert ".edit-tools .dbtn.rbn-sm.primary," in out


def test_no_gallery_scrolls_with_a_scrollbar(out):
    for gone in (".fx-strip.lay-strip{width:330px;overflow-x:auto;",
                 ".fx-strip.shape-strip{width:300px;overflow-x:auto;",
                 ".fx-strip.tx-strip,.fx-strip.page-strip{width:312px;overflow-x:auto;",
                 ".sh-menu.lay-menu{display:block;width:442px;max-height:min(64vh,470px);"):
        assert gone not in out, gone
    assert (".lay-menu .lay-picker .dbtn.lay{flex:0 0 72px;width:72px;"
            "height:56px;") in out


def test_every_ribbon_button_has_an_icon_and_a_short_tooltip():
    html = assets.deck_html()
    a = html.index('<div class="edit-tools ribbon"')
    rib = html[a:html.index('<div class="deck-main">')]
    bare = []
    for m in re.finditer(r"<button\b([^>]*)>(.*?)</button>", rib, re.S):
        attrs, inner = m.group(1), m.group(2)
        if "strip-more" in attrs or "strip-prev" in attrs or "strip-next" in attrs:
            continue                      # the gallery's own arrows
        if "tx-caret" in attrs or "seq-" in attrs or 'class="sw' in attrs:
            continue                      # split carets, swatches
        if "Smaller" in inner or "Bigger" in inner:
            continue                      # the A-/A+ glyph is the icon
        if "data-ic" not in inner and "<b>" not in inner and "<i>" not in inner \
                and "<u>" not in inner and "<s>" not in inner:
            bare.append(re.sub(r"\s+", " ", inner)[:40])
    assert not bare, bare
    long = []
    for m in re.finditer(r'title="([^"]*)"', html):
        t = re.sub(r"\s+", " ", htmlmod.unescape(m.group(1))).strip()
        if len(t) > 160:
            long.append((len(t), t[:60]))
    assert not long, long


def test_every_ribbon_layout_names_controls_that_exist():
    """A layout that names an id nobody ships silently loses that control
    (every layout named page-drop, gone since T190)."""
    html = assets.deck_html()
    cat = Path(assets.__file__).parent / "js" / "deck" / "07-ribbon-layouts.js"
    js = cat.read_text(encoding="utf-8")
    ids = set(re.findall(r'\bid="([a-z0-9-]+)"', html))
    named = set()
    for m in re.finditer(r"items:\[([^\]]*)\]", js):
        named.update(re.findall(r"'([a-z0-9-]+)'", m.group(1)))
    runtime = {"hm-laywrap"}          # named for old layouts; harmless strays
    missing = sorted(i for i in named - ids - runtime if i)
    assert not missing, missing


def test_names_and_help_sentences_are_current():
    html = assets.deck_html()
    assert "Lock aspect ratio</button>" in html and "Keep shape</button>" not in html
    assert "Slide master&#8230;</button>" in html
    assert '<span class="cell-lab">Spacing</span>' in html
    assert 'id="dsg-design-btn"' in html
    help_html = (Path(assets.__file__).parent / "html" / "help.html").read_text(
        encoding="utf-8")
    for gone in ("Objects pane", "Layout &#9662; &rarr; Curve", "></i> Check</b>"):
        assert gone not in help_html, gone
