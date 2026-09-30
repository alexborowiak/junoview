"""T555: header & footer, with the date.

The group was already "Header & footer" (T529) and {date} already
resolved; {date:long} is PowerPoint's written-out date, and both doors
now say which fields exist.
"""
from junoview import assets


def test_the_group_says_what_it_is():
    html = assets.load("html/deck.html")
    assert '<span class="rbn-lab">Header &amp; footer</span>' in html


def test_the_date_comes_short_and_written_out():
    js = assets.load("js/deck/15-annotations.js")
    body = js.split("function furnText(txt,idx){")[1].split("\n  }\n")[0]
    assert r".replace(/\{date:long\}/g," in body
    assert "{day:'numeric',month:'long',year:'numeric'}" in body
    # the long form first, or {date} would eat its front
    assert body.index("{date:long") < body.index(r".replace(/\{date\}/g")


def test_both_doors_list_the_fields():
    html = assets.load("html/deck.html")
    for bid in ("dc-head", "dc-foot"):
        btn = html.split(f'id="{bid}"')[1].split("</button>")[0]
        assert "{name}, {date}, {n}/{N}" in btn, bid
    js = assets.load("js/deck/55-sections-and-strip.js")
    assert js.count("({date:long} written out; ") == 2
