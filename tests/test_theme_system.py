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
    "surface-hover", "surface-active", "border-strong", "input-bg",
    "tooltip-bg", "tooltip-ink",
    "overlay", "shadow", "focus", "selection",
    "danger", "warning", "success", "on-accent", "on-accent-deep",
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
        actual = _tokens_for(selector).keys()
        assert actual == THEME_TOKENS, (
            f"{selector}: missing {sorted(THEME_TOKENS - actual)}, "
            f"extra {sorted(actual - THEME_TOKENS)}"
        )


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


def test_representative_surfaces_consume_theme_tokens():
    """Menus, dialogs, documents and authored output all have a token seam."""
    core = assets.core_css()
    app = assets.app_css()
    deck = assets.deck_css()
    consumers = (
        (core, ".stylepanel", "--chrome-2", "--chrome-line", "--shadow"),
        (core, ".jv-scheme-menu", "--chrome-2", "--chrome-line", "--shadow"),
        (app, ".help-box", "--chrome-2", "--chrome-line", "--shadow"),
        (app, ".odlg-box", "--chrome-2", "--chrome-line", "--shadow"),
        (app, ".note-dlg-box", "--chrome-2", "--chrome-line", "--shadow"),
        (app, ".apptip", "--tooltip-bg", "--tooltip-ink", "--shadow"),
        (app, "body:not(.light) .card", "--paper", "--line", "--shadow"),
        (core, ".figframe", "--output-paper", "--output-ink", "--output-line"),
        (deck, ".slide-fig .note", "--output-paper", "--output-ink"),
    )
    for css, selector, *tokens in consumers:
        matches = re.findall(re.escape(selector) + r"\{([^}]+)\}", css)
        assert matches, selector
        assert any(
            all(f"var({token}" in rule for token in tokens)
            for rule in matches
        ), (selector, tokens)


def test_deep_selected_states_have_their_own_contrast_token():
    core = assets.core_css()
    app = assets.app_css()
    deck = assets.deck_css()
    assert "color:var(--on-accent-deep)" in core
    assert "color:var(--on-accent-deep)" in app
    assert "color:var(--on-accent-deep,#fff)" in deck
