"""The bracket directive shorthand and multi-line captions (2026-08-05).

`#| title:` reads as machinery; the user asked for something quicker to
type and a sane way to continue a caption over several lines (a repeated
``#| caption:`` used to silently OVERWRITE the first line — data loss,
not just awkwardness).
"""

from __future__ import annotations

from junoview.notebook.directives import is_directive_line, split_directives
from junoview.notebook.parser import parse_notebook


def _one(src, outputs=None):
    doc = parse_notebook({"cells": [
        {"cell_type": "code", "source": src, "outputs": outputs or []}]})
    return [i for s in doc.sections for i in s.items][0]


def test_bracket_shorthand_keys():
    d, code = split_directives(
        "#(t) DJF mean height\n#(i) clim\n#(d) load, grid\nplot()")
    assert d == {"title": "DJF mean height", "id": "clim",
                 "depends": "load, grid"}
    assert code == "plot()"


def test_full_names_work_in_brackets_and_spellings_mix():
    d, _ = split_directives(
        "#(display) figure\n#| title: Mixed\n#(c) A caption\nplot()")
    assert d == {"display": "figure", "title": "Mixed",
                 "caption": "A caption"}


def test_empty_brackets_continue_the_previous_directive():
    d, _ = split_directives(
        "#(c) Averaged over all blocked days,\n"
        "#()  1980-2020.\n"
        "plot()")
    assert d["caption"] == "Averaged over all blocked days, 1980-2020."


def test_repeated_caption_joins_lines_instead_of_overwriting():
    # the old behaviour LOST the first line; now it is a deliberate break
    d, _ = split_directives(
        "#| caption: Line one.\n#| caption: Line two.\nplot()")
    assert d["caption"] == "Line one.\nLine two."
    d2, _ = split_directives("#(c) Line one.\n#(c) Line two.\nplot()")
    assert d2["caption"] == "Line one.\nLine two."


def test_repeated_title_joins_with_a_space():
    d, _ = split_directives(
        "#| title: A very long\n#| title: title indeed\nplot()")
    assert d["title"] == "A very long title indeed"


def test_other_repeated_keys_keep_last_wins():
    d, _ = split_directives("#| id: one\n#| id: two\nplot()")
    assert d["id"] == "two"


def test_shorthand_flows_through_the_parser():
    it = _one("#(t) Shorthand title\n#(c) And a caption\nplot()")
    assert it.title == "Shorthand title"
    assert it.caption == "And a caption"
    assert it.labelled is True


def test_is_directive_line_covers_both_spellings():
    assert is_directive_line("#| title: x")
    assert is_directive_line("#(t) x")
    assert is_directive_line("#() continued")
    assert not is_directive_line("# a plain comment")
    assert not is_directive_line("plot()")
    # ...so a shorthand line mid-cell is never mistaken for a leading
    # comment heading when titles are inferred
    it = _one("plot()\n#(c) stray note")
    assert it.title != "(c) stray note"
