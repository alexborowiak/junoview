"""Mismatched text, Tidy page and Layout ideas open full screen (T209).

The user, 2026-09-02: "This mismatched text thing is a good idea, but
horrible execution. It is so small in the side bar. Some of these
things should not be sidebars but should always open as full screen and
also need to be proper buttons." And of Layout ideas, a screenshot of
its popover overflowing its own heading.
"""

from __future__ import annotations


def test_the_two_reviews_have_a_full_screen_view_each(out):
    for oid, title in (("std-ov", "Mismatched text"), ("tidy-ov", "Tidy up this page")):
        assert f'<div class="img-ov" id="{oid}" hidden role="dialog"' in out, oid
        assert f'<span class="img-ov-t">{title}</span>' in out, title
        for part in ("sub", "rerun", "close", "body"):
            assert f'id="{oid}-{part}"' in out, f"{oid}-{part}"


def test_the_cards_are_drawn_once_for_pane_and_view(out):
    """The renderer takes its target; the pane's renderer refreshes the
    view when it is open so a fix pressed there redraws there; a slide
    chip closes the view so you can see where it took you."""
    assert "function renderStdInto(list,head){" in out
    assert "function renderStdOverview(){" in out
    assert "if(ov&&!ov.hidden) renderStdOverview();" in out
    assert "renderStdOverview();overlayShow(btn,ov);return;" in out
    assert "function renderTidyInto(list,head){" in out
    assert "function renderTidyOverview(){" in out
    assert "renderTidyOverview();overlayShow($('#dsg-tidy'),ov);return;" in out
    assert out.count("if(e.target.closest&&e.target.closest('.std-chip'))") == 2
    # the doors the tests and the Review centre already know still exist
    assert "function showTidyPane(){" in out
    assert "if(open) open.addEventListener('click',showTidyPane);" in out


def test_layout_ideas_is_full_screen_and_on_the_overlay_stack(out):
    assert ".sh-menu.lay-ideas{display:block;position:fixed;inset:0;" in out
    assert "ht.textContent='Ways to lay this slide out';" in out
    assert ("var W=Math.max(220,Math.min(420,"
            "Math.round(window.innerWidth*0.28)));") in out
    assert "overlayShow($('#hm-lay-ideas'),p);" in out
    assert "if(p){if(!p.hidden) overlayHide(p); p.remove();}" in out
    # its private dismissal is gone
    assert "document.addEventListener('keydown',ideasKey,true);" not in out


def test_the_review_grid_has_room_to_read(out):
    assert (".std-list{display:grid;"
            "grid-template-columns:repeat(auto-fill,minmax(360px,1fr));") in out
    assert ".img-ov .std-h{font-size:14px;}" in out
