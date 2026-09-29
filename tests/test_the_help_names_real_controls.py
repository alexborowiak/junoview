"""T531: the help page describes this ribbon.

The 2026-09-29 audit found the help page naming things that had moved:
"Home -> Shared colours" (Design -> Deck colours... since T444),
"Insert -> Video / audio" (Insert became Images and Text in T220),
"File -> History..." (History is on Home), "the Layout control in Home",
Full screen as a View-tab control, "Review" where Print check was meant,
slide numbers "from the File menu", "Present ▾ -> New version" and "more
than a hundred" ribbon layouts (T139 kept nine). Every one is fixed, and
this test keeps them fixed: each "A -> B -> C" path in help.html is read
and checked against the markup that ships.

- A ribbon tab first: every later step must be written on that tab's
  own groups (their captions, buttons and doors), except that a step
  after the second may be a control a door or screen opens (any
  button's words anywhere in the editor).
- File first: the next step must be an item of the File menu.
- Anything else (a door, the rail's New): every step must be a real
  control's words somewhere in the page.
"""

from __future__ import annotations

import html as H
import re

from junoview import assets

# the doors a path may start from that are not tabs: the rail's New menu
# and two of the Style/Object doors
DOORS = {"new", "paragraph", "arrange"}


def _norm(s: str) -> str:
    s = H.unescape(re.sub(r"<[^>]+>", " ", s))
    s = s.replace("▾", " ").replace("…", " ").replace("...", " ")
    return re.sub(r"\s+", " ", s).strip().lower()


def _paths() -> list[list[str]]:
    src = assets.load("html/help.html")
    src = re.sub(r'<i data-ic="[a-z0-9-]+"></i>', "", src)
    src = re.sub(r"</i>\s*<i>", " ", src)          # "Design ->" + "Deck colours"
    src = re.sub(r"</b>\s*&rarr;\s*<b>", " &rarr; ", src)
    out = []
    for m in re.finditer(r"<(i|b)>([^<]*&rarr;[^<]*)</\1>", src):
        segs = [_norm(p) for p in m.group(2).split("&rarr;")]
        if segs[0] in ("on", "load"):              # not UI: a cycle, a lineage
            continue
        out.append([s for s in segs if s])
    return out


def _tab_texts(deck: str) -> dict[str, str]:
    tabs = dict((_norm(lab), key) for key, lab in re.findall(
        r'<button class="rbn-tab" id="rbn-tab-[a-z]+" role="tab"\s+'
        r'data-tab="([a-z]+)"[^>]*>(.*?)</button>', deck, flags=re.S))
    groups: dict[str, str] = {}
    for m in re.finditer(r'<span class="rbn-grp[^"]*"[^>]*?data-tab="([a-z]+)"',
                         deck):
        rest = deck[m.end():]
        nxt = rest.find('<span class="rbn-grp')
        body = rest[:nxt if nxt > 0 else len(rest)]
        body = re.sub(r"<!--.*?-->", "", body, flags=re.S)
        groups[m.group(1)] = groups.get(m.group(1), "") + " " + _norm(body)
    return {lab: groups.get(key, "") for lab, key in tabs.items()}


def test_every_help_path_names_a_real_control(out):
    deck = assets.deck_html()
    tabs = _tab_texts(deck)
    assert "home" in tabs and "design" in tabs and "images" in tabs
    file_menu = " ".join(_norm(t) for t in re.findall(
        r'<button class="dc-mi" id="mi-[a-z-]+"[^>]*>(.*?)</button>', deck,
        flags=re.S))
    anywhere = _norm(out) + " " + " ".join(
        _norm(t) for t in re.findall(r"'([^'\\]{2,80})'", out))
    paths = _paths()
    assert len(paths) >= 18, paths
    bad = []
    for p in paths:
        head, rest = p[0], p[1:]
        if head in tabs:
            if rest[0] not in tabs[head]:
                bad.append((p, f"{rest[0]!r} is not on the {head} tab"))
            for s in rest[1:]:
                if s not in tabs[head] and s not in anywhere:
                    bad.append((p, f"{s!r} is nowhere"))
        elif head == "file":
            if rest[0] not in file_menu:
                bad.append((p, f"{rest[0]!r} is not in the File menu"))
        elif head not in DOORS:
            # "Insert -> Video / audio" named a tab that no longer exists
            bad.append((p, f"{head!r} is not a tab, File or a known door"))
        else:
            for s in p:
                if s not in anywhere:
                    bad.append((p, f"{s!r} is nowhere"))
    assert not bad, bad


def test_the_stale_names_are_gone():
    helptext = _norm(assets.load("html/help.html"))
    for stale in ("shared colours", "insert video", "more than a hundred",
                  "file history", "animation pane,"):
        assert stale not in helptext, stale
    assert "so there are nine" in helptext
