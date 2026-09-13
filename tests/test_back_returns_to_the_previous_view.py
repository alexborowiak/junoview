"""T395: the browser's Back button returns to the previous VIEW.

Every hash change used replaceState, so the back stack never flooded --
and Back from a presentation left the site (2026-09-13, user: "the back
button when you open a presentation doesn't work, it takes you out of
the website, when it should take you to what you were on previously").
A new view (Home, a notebook, a presentation) is a history entry now; a
move between the slides of one presentation still replaces.
"""

from __future__ import annotations


def test_a_new_view_pushes_and_a_slide_move_replaces(out):
    assert "  function viewOf(h){return String(h||'').replace(/\\/s\\d+$/i,'');}" in out
    assert ("    var view=viewOf(h),push=!applyingRoute&&lastView!==null"
            "&&view!==lastView;") in out
    assert ("    try{ if(push&&history.pushState) "
            "history.pushState(null,'',url);") in out
    assert ("         else if(history.replaceState) "
            "history.replaceState(null,'',url);") in out


def test_home_over_open_notebooks_is_a_view_of_its_own(out):
    assert "    if(atHome&&APP.order.length){setHash('#/home');return;}" in out
    assert "    if(parts[0]==='home'){" in out
    assert ("    updateHash();   /* T395: Home is a view, "
            "so Back can come back to it */") in out
    # the initial route accepts it too
    assert "parts[0]==='pres'||parts[0]==='home'))" in out


def test_back_to_the_first_entry_closes_what_opened_since(out):
    start = out.index("  function applyHash(hash){")
    body = out[start:start + 700]
    assert "    if(!parts.length){" in body
    assert "      if(open&&APP.deckClose) APP.deckClose();" in body
    assert "      if(atHome&&APP.order.length) goHome(false);" in body


def test_applying_a_history_entry_never_pushes_another(out):
    assert "    lastView=viewOf(location.hash||'#/');" in out
    assert ("    applyingRoute=true;\n"
            "    try{applyHash(location.hash);}finally{applyingRoute=false;}") in out
