"""T552: alt text has a door on the Object tab.

It lived on the right-click menu only, for pictures and flip books. It is
now a button in the Object tab's Picture group, beside Caption, and it is
for every kind of picture: a placed picture, a notebook figure, a flip
book, a clip and a chart.
"""
from junoview import assets


def test_the_button_sits_beside_caption():
    html = assets.load("html/deck.html")
    cap = html.index('id="fmt-caption"')
    alt = html.index('id="fmt-alt"')
    assert cap < alt < html.index('<span class="rbn-lab">Picture</span>')
    btn = html[alt:].split("</button>")[0]
    assert 'data-ic="alttext"' in btn and "Alt text&#8230;" in btn


def test_every_layout_that_places_caption_places_it_too():
    js = assets.load("js/deck/07-ribbon-layouts.js")
    assert js.count("'fmt-caption',") == js.count("'fmt-caption','fmt-alt',")
    assert js.count("'fmt-alt'") >= 8


def test_it_has_an_icon_of_its_own():
    from junoview import branding
    assert "alttext" in branding.icons_map()


def test_it_is_for_every_kind_of_picture():
    js = assets.load("js/deck/25-selecting.js")
    assert "return !!a&&(isFigure(a)||a.k==='chart');" in js
    assert "show('#fmt-alt',altIx.length>0);" in js
    assert "'#fmt-caption #fmt-alt #fmt-prov" in js


def test_it_is_drawn_and_exported_for_the_new_kinds():
    js = assets.load("js/deck/20-notes-and-tables.js")
    assert "function altPaint(layer,s){" in js
    assert "if(a.k==='chart') tgt.setAttribute('role','img');" in js
    ex = assets.load("js/deck/60-saving-and-export.js")
    assert "alt:a.alt,dec:a.dec});   /* T552 */" in ex
    assert "alt:a.alt||img.alt||'',dec:a.dec});   /* T552 */" in ex
    assert "name:(fsel&&fsel.label)||'Figure',alt:a.alt,dec:a.dec});" in ex


def test_the_review_asks_about_charts_and_names_the_door():
    js = assets.load("js/deck/50-review-and-overview.js")
    assert "if(a.k!=='image'&&a.k!=='flip'&&a.k!=='chart') return;" in js
    assert "Select it and use Object \u203a Alt text" in js
