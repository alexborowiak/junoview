"""The colour schemes are one complete product theme (T250-T254)."""

from __future__ import annotations

import re

from junoview import assets

THEME_TOKENS = {
    "ink", "ink-2", "ink-3",
    "paper", "paper-2", "paper-3", "line",
    "chrome", "chrome-0", "chrome-1", "chrome-2", "chrome-3",
    "chrome-4", "chrome-line", "chrome-ink", "chrome-ink-2",
    "chrome-ink-3",
    "accent", "accent-deep", "accent-soft",
    "btn-bg", "btn-border", "btn-ink",
    "overlay", "shadow", "focus", "selection",
    "danger", "warning", "success", "on-accent",
}


def _tokens_for(selector: str) -> dict[str, str]:
    css = assets.core_css()
    match = re.search(re.escape(selector) + r"\{([^}]+)\}", css)
    assert match, selector
    return dict(re.findall(r"--([\w-]+):([^;]+);", match.group(1)))


def test_every_original_scheme_supplies_the_whole_theme_contract():
    selectors = (
        "body:not(.light)",
        "body.light",
        "body.th-forest",
        "body.light.th-lforest",
        "body.th-forestblue",
        "body.th-colorful",
        "body.th-contrast",
    )
    for selector in selectors:
        missing = THEME_TOKENS - _tokens_for(selector).keys()
        assert not missing, f"{selector}: missing {sorted(missing)}"


def test_dark_and_forest_themes_change_the_document_as_well_as_chrome():
    dark = _tokens_for("body:not(.light)")
    light = _tokens_for("body.light")
    forest = _tokens_for("body.th-forest")
    for token in ("paper", "paper-2", "paper-3", "ink", "line"):
        assert dark[token] != light[token], token
    assert forest["paper"] != dark["paper"]
    assert forest["paper-2"] != dark["paper-2"]


def test_the_theme_contract_names_content_and_feedback_colours():
    css = assets.core_css()
    assert "the PRODUCT theme tokens" in css
    assert "Content is deliberately NOT themed" not in css
    app = assets.app_js()
    assert "the complete product\n     token set" in app
    assert "Chrome only" not in app
