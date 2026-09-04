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


def test_every_scheme_supplies_the_whole_theme_contract():
    selectors = (
        "body:not(.light)",
        "body.light",
        "body.th-forest",
        "body.light.th-lforest",
        "body.th-forestblue",
        "body.th-colorful",
        "body.th-contrast",
        "body.light.th-warm",
        "body.th-navy",
        "body.th-purple",
        "body.th-dim",
        "body.light.th-lcontrast",
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


def test_colourful_detached_surfaces_follow_the_active_tab_zone():
    css = assets.core_css()
    app = assets.app_js()
    deck = assets.deck_js()
    hues = {
        "home": ("#f2b85b", "#9a5c00"),
        "images": ("#b89bf4", "#7150b8"),
        "text": ("#b89bf4", "#7150b8"),
        "design": ("#82a8ff", "#3b61ba"),
        "animation": ("#65d7c0", "#167561"),
        "view": ("#62d49b", "#19764d"),
        "object": ("#eea4cc", "#a34276"),
        "present": ("#f18ab1", "#a63c68"),
    }
    for zone, (accent, deep) in hues.items():
        start = css.index(
            f'body.th-colorful[data-theme-zone="{zone}"]'
        )
        rule = css[start:css.index("}", start)]
        assert f"--accent:{accent}" in rule, zone
        assert f"--accent-deep:{deep}" in rule, zone
    assert "document.body.setAttribute('data-theme-zone',zone)" in app
    assert "document.addEventListener('sem:ribbon-tab'" in app
    assert "new CustomEvent('sem:ribbon-tab'" in deck


def _relative_luminance(value: str) -> float:
    assert re.fullmatch(r"#[0-9a-fA-F]{6}", value), value
    channels = [int(value[i:i + 2], 16) / 255 for i in (1, 3, 5)]
    linear = [
        channel / 12.92 if channel <= 0.04045
        else ((channel + 0.055) / 1.055) ** 2.4
        for channel in channels
    ]
    return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2]


def _contrast(first: str, second: str) -> float:
    light, dark = sorted(
        (_relative_luminance(first), _relative_luminance(second)),
        reverse=True,
    )
    return (light + 0.05) / (dark + 0.05)


def test_scheme_text_focus_and_selected_states_meet_contrast_targets():
    selectors = (
        "body:not(.light)", "body.light", "body.th-forest",
        "body.light.th-lforest", "body.th-forestblue",
        "body.th-colorful", "body.th-contrast", "body.light.th-warm",
        "body.th-navy", "body.th-purple", "body.th-dim",
        "body.light.th-lcontrast",
    )
    for selector in selectors:
        tokens = _tokens_for(selector)
        pairs = (
            ("ink", "paper", 4.5),
            ("ink-2", "paper", 4.5),
            ("ink-3", "paper", 3.0),
            ("chrome-ink", "chrome-2", 4.5),
            ("chrome-ink-2", "chrome-2", 4.5),
            ("chrome-ink-3", "chrome-2", 3.0),
            ("accent", "paper", 4.5),
            ("focus", "chrome-2", 3.0),
            ("on-accent-deep", "accent-deep", 4.5),
        )
        for foreground, background, minimum in pairs:
            ratio = _contrast(tokens[foreground], tokens[background])
            assert ratio >= minimum, (
                selector, foreground, background, ratio, minimum
            )


def test_picker_registry_preview_keyboard_and_system_contract():
    js = assets.app_js()
    block = js.split("var SCHEMES=[", 1)[1].split("];", 1)[0]
    ids = [
        value for value in re.findall(
            r"^\s+\['([^']+)',", block, re.MULTILINE
        )
        if not value.startswith("#")
    ]
    assert ids == [
        "system", "dark", "light", "forest", "forest-light",
        "forest-blue", "colourful", "contrast-dark", "warm", "navy",
        "purple", "dim", "contrast-light",
    ]
    assert "parts=['page','surface','text','accent']" in js
    assert "o.setAttribute('role','menuitemradio')" in js
    assert "o.setAttribute('aria-checked'" in js
    for key in ("ArrowDown", "ArrowUp", "Home", "End", "Escape"):
        assert f"e.key==='{key}'" in js
    assert "matchMedia('(prefers-color-scheme: light)')" in js
    assert "systemTheme.addEventListener('change',systemThemeChanged)" in js
    assert "localStorage.setItem('plotline-scheme',activeSchemeId)" in js
    html = assets.deck_html()
    assert 'aria-haspopup="menu"' in html
    assert 'aria-controls="jv-scheme-menu"' in html
