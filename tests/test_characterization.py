"""The whole renderer, pinned by the bytes it produces.

Every other test checks one behaviour. This one checks that rendering the
example notebook produces *exactly* the page it produced before -- which is what
caught the one real bug in the split from a single module into this package
(`dir(__builtins__)` returns the builtins module's names in ``__main__`` but
dict methods inside an imported module, so syntax highlighting silently started
marking ``.update`` as a builtin and stopped marking ``print``).

When you change the output on purpose, update ``EXPECTED_MD5`` in the same
commit and say in the message what changed and why. Run this to get the new
value::

    pytest tests/test_characterization.py -q
"""

from __future__ import annotations

import hashlib
from pathlib import Path

import pytest

from junoview.notebook.loader import load_doc
from junoview.render.page import render_page

EXAMPLE = Path(__file__).resolve().parent.parent / "examples" \
    / "example_climate_analysis.ipynb"

# md5 of the rendered page as a string.
#
# Deliberately hashed in memory rather than after writing to disk: `write_text`
# translates \n to \r\n on Windows, so the file's bytes -- and its hash -- differ
# by platform while the render itself does not.
#
# The package split itself changed nothing: this matched the old single-file
# renderer byte for byte. It has moved since only for the chrome fixes listed
# under "Fixed — interface" in CHANGELOG.md, each of which has its own test
# pinning the specific rule. If this is the ONLY test that fails, you changed
# the page's bytes without meaning to.
# Moved 2026-08-22 for the deck editor's typing and sections work: the
# Apply dialog and its property/scope pickers, user-defined text types,
# the Standardise text pane, slide sections in the strip, and the
# strip's resize handle and three display modes. All of it is editor
# chrome -- the document half of the page is unchanged -- and each
# piece is pinned by its own test in tests/test_slide_sections.py.
# ...and again for the flip book: a new item kind (k:'flip') holding
# many figures with arrows to step through them, the bindings that tie
# other items to a figure, the frames pane, and the export that
# explodes one flip book into one slide per figure. Editor chrome plus
# one render branch; the document half of the page is unchanged. Each
# piece is pinned by its own test in tests/test_flip_book.py.
# ...and again for matching: one slide's layout given to many, and
# object-to-object matching in both directions with its own property
# picker. Pinned per-piece in tests/test_matching.py.
EXPECTED_MD5 = "4b76143c6cac3310c3d47382bf50c79c"
EXPECTED_BYTES = 2532075


def _render_example() -> str:
    """Render exactly as ``junoview NOTEBOOK.ipynb`` does."""
    doc = load_doc(EXAMPLE)
    doc.source_name = "example_climate_analysis"
    return render_page([doc])


@pytest.mark.skipif(not EXAMPLE.exists(),
                    reason="example notebook not in this checkout")
def test_example_notebook_renders_byte_for_byte_as_before():
    html = _render_example()
    digest = hashlib.md5(html.encode("utf-8")).hexdigest()
    assert digest == EXPECTED_MD5, (
        f"rendered output changed: {len(html)} bytes, md5 {digest} "
        f"(expected {EXPECTED_BYTES} bytes, md5 {EXPECTED_MD5}). "
        "If you meant to change the output, update EXPECTED_MD5 and "
        "EXPECTED_BYTES in this file and explain the change in your commit."
    )


@pytest.mark.skipif(not EXAMPLE.exists(),
                    reason="example notebook not in this checkout")
def test_rendering_is_deterministic():
    """Two renders in one process must agree.

    Guards against anything order-dependent leaking into the page -- a set
    iterated directly, a dict keyed on object identity, a cached asset mutated
    in place.
    """
    assert _render_example() == _render_example()


def test_assets_load_from_the_installed_package():
    """Every asset resolves through importlib.resources and is non-empty.

    This is what fails first if package-data is misdeclared: imports still work
    from a source checkout, and only an installed wheel goes missing its CSS.
    """
    from junoview import assets

    loaders = {
        "core.css": assets.core_css, "app.css": assets.app_css,
        "deck.css": assets.deck_css, "app.js": assets.app_js,
        "deck.js": assets.deck_js, "pptx.js": assets.pptx_js,
        "page.html": assets.page_template,
        "shell.html": assets.shell_template, "deck.html": assets.deck_html,
        "help.html": assets.help_html, "mathjax.html": assets.mathjax_html,
        "web-loader.html": assets.web_loader, "sw.js": assets.sw_js,
    }
    for name, load in loaders.items():
        assert load().strip(), f"asset {name} is empty or missing"


def test_page_template_placeholders_match_what_render_page_supplies():
    """The template and its caller must agree on every named placeholder.

    A stray ``{`` in the HTML, or a renamed keyword in ``render_page``, raises
    KeyError/IndexError only at render time -- and only for the code path that
    happens to be exercised. Checking the field set directly is cheaper.
    """
    import string

    from junoview import assets

    supplied = {
        "title", "shells", "css", "app_css", "js", "mathjax", "deck_shell",
        "app_data", "deck_css", "deck_js", "pptx_js", "repo", "kofi",
        "help_html", "logo", "favicon", "head_extra",
    }
    required = {name for _, name, _, _
                in string.Formatter().parse(assets.page_template())
                if name}
    # Only the missing direction is fatal -- a placeholder the template needs
    # and nobody supplies is a KeyError at render time. A supplied name the
    # template ignores is merely dead weight (`repo` currently is).
    assert not required - supplied, (
        f"page.html uses {sorted(required - supplied)}, which render_page "
        "does not pass; rendering would raise KeyError"
    )
