"""T404: a hidden object is hidden everywhere.

The user, 2026-09-13: "Bug: hidden object still appear in present mode."
The Layers pane's eye meant "out of my way while editing, still shown
to the audience" (DECK-FORMAT called it scaffolding), and nobody read it
that way. Hidden now means not on the slide: not while editing, not in
playback, not in print or PowerPoint, and it claims no click.
"""

from __future__ import annotations

from junoview.notebook.deck_schema import ANNOT_COMMON


def test_the_three_render_sites_skip_a_hidden_object_in_every_mode(out):
    assert out.count("      if(a.hide) return;") >= 1
    assert ("      if(a.hide) return;                     "
            "/* T404: hidden is hidden */") in out
    assert ("        if(a.hide) return;                   "
            "/* T404: hidden is hidden */") in out
    assert "a.hide&&editing" not in out


def test_a_hidden_object_claims_no_click(out):
    assert ("      if(!a||!a.anim||a.hide) return;\n"
            "      var o=a.anim.order||0;") in out
    assert ("      if(a&&a.anim&&!a.hide){var o=a.anim.order||0;"
            "   /* T404 */") in out
    assert ("      if(a&&!a.hide&&stopsFor(s,a)>0) out.push({a:a,i:i});});"
            "   /* T404 */") in out


def test_powerpoint_leaves_it_out_too(out):
    assert ("      if(a.hide) return;   "
            "/* T404: hidden is hidden, in PowerPoint too */") in out


def test_the_eye_says_what_it_does(out):
    assert "      eye.title=a.hide?'Show it again'" in out
    assert ("        :'Hide it: not shown while editing, presenting or in "
            "exports';") in out


def test_the_schema_says_so():
    assert "not drawn while editing, in playback, in print or in PowerPoint" in (
        ANNOT_COMMON["hide"][1])
