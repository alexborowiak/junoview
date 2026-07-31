"""First contact: what someone sees before they have opened anything, and whose
name is on it. The welcome screen and its deferred demo reel, the help
overlay's coverage, the open dialog's two explicit paths (local file and
URL), and the generator tag an exported page carries. Branding lives here
because this is where it is read: the PlotLine-to-Junoview rename is pinned
against the surfaces a newcomer actually looks at.
"""

from __future__ import annotations

import re

from helpers import _web_page
from junoview import assets
from junoview.branding import _REPO_URL
from junoview.render.page import render_page


def test_web_mode_page_chrome_and_welcome_hero(out):
    """The browser build's chrome and its welcome screen.

    welcome screen: big wordmark, a real tagline, a narrative lead + a note
    a tight welcome hero: big logo, wordmark, one tagline, prominent buttons
    """
    web_page = render_page([], mode="web")
    assert '"mode": "web"' in web_page and 'id="fileinput"' in web_page
    assert 'id="helpdlg"' in web_page and 'id="help-btn"' in web_page
    assert "ko-fi.com/plotline" in web_page
    assert 'id="support-btn"' in web_page
    assert 'id="welcome-demo"' in web_page
    assert 'class="welcome-hero"' in web_page \
        and 'class="welcome-wordmark"' in web_page
    assert "Filter, view and present your Jupyter notebooks" in web_page
    assert 'class="welcome-btns"' in web_page \
        and 'id="welcome-open"' in web_page
    # BOTH open paths are explicit on the welcome: local files and a
    # GitHub/URL button that opens the dialog focused on the URL input
    assert 'id="welcome-url"' in web_page and "'#welcome-url'" in out


def test_welcome_tour_reel_is_deferred_and_laid_out_in_column(out):
    """the welcome screen carries the demo reel, deferred behind data-src"""
    assert 'id="wtour"' in out and 'id="wtour-toggle"' in out
    assert out.count('<img data-src="gifs/') == 7
    # the promise the product rests on, stated in words (no GIF for it)
    assert 'class="wtour-said"' in out
    assert 'class="wquote"' in out and 'Alanah Chapman' in out
    assert out.count('&#9733;') == 5   # a five-star rating, five stars
    # the reel breaks out of the 560px welcome column or the demos are
    # unreadable thumbnails
    # the reel sits INSIDE its container: a viewport-relative width on a
    # rail-inset column overflowed left, under the fixed rail
    assert ("width:100%;max-width:880px;"
            "margin-left:auto;margin-right:auto;}") in out
    # caption ABOVE its clip, and readable in the default dark theme
    assert ".wtour figcaption{order:-1;}" in out
    assert "body:not(.light) .wtour figcaption b{color:#fff;}" in out
    assert "body.light .wtour figcaption b{color:#0f1b28;}" in out
    # the reel is sized by its CONTAINER, never the viewport: a vw width
    # inside a rail-inset column overflows left, under the fixed rail
    assert (".wtour{margin-top:30px;display:grid;gap:40px;"
            "text-align:left;\n  width:100%;max-width:880px;") in out
    assert 'it updates straight away in the' in out
    assert "<img src=\"gifs/" not in out          # never fetched eagerly
    assert ".wtour.lite img{display:none;}" in out
    assert "probe.src='gifs/code_folding.gif';" in out


def test_welcome_open_button_and_getting_started_steps(out):
    """The open-local-files call to action survives HTML reflow, and the
    getting-started steps moved to the bottom (seen on scroll)."""
    assert "Open\n          local files" in out.replace("\r\n", "\n") \
        or "Open local files" in re.sub(r"\s+", " ", out)
    web_page = _web_page()
    assert ('class="welcome-more"' in web_page
            and web_page.count('class="ws-n"') == 4)


def test_guided_tour_and_help_content(out):
    """Guided tour (skippable, shown once) + entry points, and help
    content covering the new model + what Support funds.

    The stored flag is still ``plotline-tour``: the id predates the
    PlotLine -> Junoview rename and is kept so the tour is not re-shown
    to everyone who already skipped it.
    """
    # _HELP_HTML is now assets.help_html()
    help_html = assets.help_html()
    assert 'id="tour"' in out and "var TOUR_STEPS" in out
    assert 'id="welcome-tour"' in out and 'id="help-tour"' in out
    assert "function tourShow" in out and "plotline-tour" in out
    # help content covers the new model + what Support funds
    assert "Support this project" in out and "hosted" in help_html
    assert "Filtering what you see" in help_html and "Plot trace" in help_html


def test_rebrand_plotline_to_junoview(out):
    """Rebrand: PlotLine -> Junoview, with the peacock-eye ocellus mark."""
    web_page = _web_page()
    web_loader = assets.web_loader()
    assert "Junoview" in out and "PlotLine" not in out
    assert out.count('class="jv-logo"') >= 2   # welcome hero + presrail brand
    assert 'rel="icon"' in out and "data:image/svg+xml," in out
    assert "<title>Junoview" in web_page
    assert ('content="Junoview"' in web_loader
            and "PlotLine" not in web_loader)


def test_repo_url_stays_out_of_the_ui_but_directives_are_documented():
    """The GitHub repo link is intentionally NOT surfaced in the UI
    (privacy); the cell directives are documented in the help dialog."""
    web_page = _web_page()
    assert _REPO_URL not in web_page
    assert "#| title:" in web_page          # directives documented in help


def test_exported_page_names_the_generator(out):
    """Every exported page names the tool.

    A generator tag, not a fake description of someone else's notebook.
    """
    assert '<meta name="generator" content="Junoview' in out
    assert "https://junoview.dev" in out
