"""Two symbols, two buttons, and whether you are running late (T222).

The user, 2026-09-03: "Presentation mode: the running late [thing]
should be in the presentation view, the buttons should tell you if
clicking if not. Notes and timing should be two different buttons...
Layers and images button uses same symbol... I said style system should
be its own button."
"""

from __future__ import annotations

import re

from junoview import assets


def test_no_two_buttons_in_one_group_share_a_symbol():
    """The user met it as Layers and Images side by side on Home, but the
    rule is general: within one ribbon group, two buttons you can see at
    the same time must not wear the same icon. Buttons inside a window
    are excluded (you never see them beside the row), and the Table
    group's +/- pairs are deliberate -- Add row and Add column share a
    plus and are told apart by their words."""
    html = assets.deck_html()
    a = html.index('<div class="edit-tools ribbon"')
    rib = html[a:html.index('<div class="deck-main">')]
    bad = []
    grp = (r'<span class="rbn-grp[^"]*"[^>]*>(.*?)'
           r'<span class="rbn-lab">([^<]*)</span>')
    for g in re.finditer(grp, rib, re.S):
        body, lab = g.group(1), g.group(2)
        row = re.sub(r'<div class="sh-menu.*?</div>\s*</span>', "", body, flags=re.S)
        seen = {}
        for m in re.finditer(r'<button[^>]*id="([a-z0-9-]+)"(.*?)</button>',
                             row, re.S):
            cid, inner = m.group(1), m.group(2)
            ic = re.search(r'data-ic="([a-z0-9-]+)"', inner)
            if not ic:
                continue
            key = ic.group(1)
            if key in seen and seen[key] != cid:
                bad.append((lab, key, seen[key], cid))
            seen.setdefault(key, cid)
    deliberate = {("Table", "plus"), ("Table", "minus")}
    assert [b for b in bad if (b[0], b[1]) not in deliberate] == [], bad
    # the pair the user actually met
    for cid, ic in (("hm-layers", "objects"), ("hm-images", "image")):
        i = html.index(f'id="{cid}"')
        assert f'<i data-ic="{ic}"></i>' in html[i:html.index("</button>", i)], cid


def test_notes_and_timing_are_two_buttons(out):
    html = assets.deck_html()
    for cid in ("pr-notes", "pr-timing"):
        assert f'id="{cid}"' in html, cid
    assert '<i data-ic="clock"></i> Timing</button>' in html
    # both open the pane; they differ by the tab they land on
    assert ("     ['pr-notes','pl-notes'],['pr-timing','pl-notes'],\n"
            "     ['pr-tap','pl-tap'],['pr-trace','pl-trace']]") in out
    assert "          if(p[0]==='pr-notes'||p[0]==='pr-timing'){" in out
    assert "            var want=(p[0]==='pr-timing')?'deck':'slide';" in out
    # the pane's tabs are what they land on, and they still exist
    for np in ("slide", "deck", "pad", "reh"):
        assert f'data-np="{np}"' in html, np


def test_the_presenter_view_says_whether_you_are_running_late(out):
    """The bar had the clock and how much of the slot was left, but not
    the number that changes what you do next: whether you are behind for
    the slide you are actually on."""
    assert '<span class="jvp-pace" id="jvp-pace"></span>' in out
    assert ".jvp-pace.late{background:#ff6b571f;border-color:#ff6b57;" in out
    assert ".jvp-pace.ahead{background:#46a8921f;border-color:#46a892;" in out
    # planned-so-far: the per-slide targets if any are set, else the slot
    # shared out evenly
    assert "      if(any) planned=goals*60;" in out
    assert ("      else if(pres.talkMins&&shown.length)\n"
            "        planned=pres.talkMins*60*(shownAt+1)/shown.length;") in out
    assert "      planned:Math.round(planned),slideIndex:cur};" in out
    # and the readout itself
    assert "          var off=sec-st.planned;" in out
    assert ("          pc.textContent=Math.abs(off)<30?'on time'\n"
            "            :(mm+':'+ss+(off>0?' behind':' ahead'));") in out


def test_the_style_system_screen_has_one_door(out):
    """A row inside the Text styles window and a button on the ribbon,
    with the button forwarding its click to the row. The row is gone and
    the button carries the handler."""
    assert 'id="dsg-design"' not in out
    assert 'id="dsg-design-btn"' in out
    assert "    var b=$('#dsg-design-btn');" in out
    assert "function styleSystemDoorBoot(){" not in out
    assert "  styleSystemDoorBoot();" not in out
    assert "'dsg-design'," not in out          # the catalogue follows


def test_a_placed_figure_still_locks_and_says_where_it_came_from(out):
    """The user asked what happened to the per-image lock and the
    provenance. Both are here; this pins them so they cannot quietly
    go again."""
    # the lock, on every row of the All images pane and its full-screen view
    assert "      if(lockMode(a2)) delete a2.lock; else a2.lock='pos';" in out
    assert "    lk.title=lm===''?'Not locked. Click to lock its position'" in out
    # where it came from, on the row and in its own pane
    assert 'id="fmt-path"' in out and 'id="fmt-prov"' in out
    assert "function showProvPane(){" in out
    assert 'id="provpane"' in out
