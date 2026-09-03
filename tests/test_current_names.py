"""Every sentence names a control by its current name (T210).

Controls were renamed across T176-T209 (the print check became Review,
Standardise became Fix mismatched text, Colours & spacing became the
Palette, Set order became Quick animate, the "Saved to" switch became
the chevron beside Save). Sentences elsewhere still used the old names,
which is "stupid names in stupid places" from the other side.
"""

from __future__ import annotations

from pathlib import Path

import junoview.assets as assets


def test_the_review_centre_and_toasts_use_current_names(out):
    # (the sentences, not the code comments that still name the old picker)
    for gone in ("' Open the print check'", "' Open Standardise'",
                 'switch "Saved to"', "Saved to › a file",
                 "Colours & spacing and everything",
                 "guides and the print check lead"):
        assert gone not in out, gone
    for now in ("' Open Before you print'", "' Open Mismatched text'",
                "Design \\u2192 Palette and everything using it follows.",
                "guides and Review lead"):
        assert now in out, now


def test_help_uses_current_names():
    help_html = (Path(assets.__file__).parent / "html" / "help.html").read_text(
        encoding="utf-8")
    assert "<i>Standardise text</i>" not in help_html
    assert "<i>Colours &amp; spacing</i>" not in help_html
    assert "<i>Fix mismatched text</i>" in help_html
    assert "<i>Palette</i>" in help_html
