"""Custom views: the third saved kind, which styles the notebook document
itself rather than building slides. Covers the entry points and the style
panel, the cascade implemented as inherited custom properties (shell ->
section -> card), the dark-mode overrides honouring those vars (an
equality-only test used to walk straight past this), a view styling ITS OWN
notebook rather than whichever tab is in front, and the round trip through
the notebook's saved presentations.
"""

from __future__ import annotations

from junoview.branding import _ICON_PATHS
from junoview.notebook.presentations import _as_presentations


def test_custom_view_entry_points_and_style_panel(out):
    """CUSTOM VIEWS: a third saved kind, styling the notebook itself."""
    assert 'id="pr-newview"' in out and "function newCustomView" in out
    # the three '+ New ...' rail buttons must be tellable apart when the
    # rail is collapsed to icons (they were '+', a box and a triple bar)
    for _ni in ("newdeck", "newposter", "newview"):
        assert f'<i data-ic="{_ni}"></i>' not in out, _ni   # expanded
        assert _ICON_PATHS[_ni][:24] in out, _ni
    # and the feature is documented where people look for it
    assert "Custom views &mdash; a styled, filtered copy" in out
    assert "+ New custom view</b> in the left rail" in out
    assert "function openCustomView" in out and "function isViewPres" in out
    assert 'id="stylebar"' in out and 'id="stylepanel"' in out
    for _sb in ("sb-md", "sb-hd", "sb-doc", "sb-override", "sb-reset",
                "sb-done", "sb-name"):
        assert f'id="{_sb}"' in out, _sb


def test_view_style_cascade_is_inherited_custom_properties(out):
    """the cascade is inherited custom properties: shell -> section -> card
    """
    assert "var MD_PROPS=[" in out and "var HD_PROPS=[" in out
    assert "APP.enterStyling=function(view,onChange)" in out
    assert "APP.exitStyling=function()" in out
    assert "APP.syncStylingView=function()" in out
    assert "function applyViewStyle" in out and "function stamp(el,obj" in out
    assert ".note{font-family:var(--md-font,var(--serif));" in out
    assert "color:var(--md-col,var(--ink-2))" in out
    assert 'background:var(--md-bg,var(--paper))' in out
    assert "font-size:calc(26px * var(--hd-size,1))" in out
    assert "color:var(--hd-col,var(--ink))" in out
    assert "display:var(--hd-eyebrow,block)" in out
    assert "margin:var(--vw-gap,14px) 0;" in out


def test_view_style_vars_are_honoured_in_dark_mode(out):
    """dark mode overrides colour explicitly, so it must honour the vars too
    (without this the whole feature silently did nothing in the default
    theme -- an equality-only test walked right past it)
    """
    assert "body:not(.light) .note{color:var(--md-col,#c3cfda);}" in out
    assert "body:not(.light) .sectionhead h2{color:var(--hd-col,#e6edf3);}" \
        in out
    assert 'body:not(.light) .card[data-note="1"]{' \
        'background:var(--md-bg,#101c28);' in out


def test_view_styles_its_own_notebook_with_override_buttons(out):
    """a view styles ITS notebook, never whatever tab is in front"""
    assert "var stem=(styView&&styView.nb)||APP.active;" in out
    # per-target buttons + the override affordance
    assert "function ensureStyBtns" in out and "b.className='sty-btn'" in out
    assert "function markStyOwn" in out and "sty-own" in out
    assert "'Override those '+narrow+' individual style'" in out


def test_custom_view_round_trips_through_saved_presentations():
    """a view round-trips through the notebook's saved presentations"""
    _v = _as_presentations([{"name": "v", "kind": "view", "nb": "nb1",
                             "style": {"all": {"size": 1.4}},
                             "view": {"def": {"code": 0}, "v": 1},
                             "filters": {}, "folder": "f"}])
    assert _v[0]["kind"] == "view" and _v[0]["nb"] == "nb1"
    assert _v[0]["style"]["all"]["size"] == 1.4
    assert _v[0]["view"]["def"] == {"code": 0} and _v[0]["slides"] == []
    assert _v[0]["folder"] == "f"
    # a view entry has no slides, and must not be dropped for that
    assert _as_presentations([{"name": "x", "kind": "view"}])[0]["name"] == "x"
