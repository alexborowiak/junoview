"""T410: clicking a line opens Style, where the Line window is.

The user, 2026-09-13: "When clicking on a line, it always tries to
take me away from line and to the object tab." showFmt sent every
selected thing that was not words or a table to Object -- and Object
has nothing for a line but arrange and size. Its dash, weight, ends
and route are the Line window on Style, so a line or a pen stroke
lands there now, and stays there when you are already on it. A shape
still goes to Object: its fill and edge live there.
"""

from __future__ import annotations


def test_a_stroke_is_not_sent_to_object(out):
    # T465: a shape too -- its fill, border and shape controls are the
    # Style tab's Line & shape group, and Object had nothing for it but
    # arrange, size, opacity and reuse
    assert "    var strokeSel=(kind==='arrow'||kind==='draw'||kind==='rect');" in out
    # ...and the tab follows a NEW selection only: a re-render of the same
    # selection (a colour hover's preview, any fmtApply) must not yank the
    # ribbon back to the tab it would have chosen
    assert "    var freshSel=(selSig!==fmtSelSig);" in out
    assert ("    var wantTab=(freshSel&&activeTab()!==selT&&tool==='select'"
            "&&!justDrew") in out
    assert ("    if(selT==='style'&&kind!=='text'&&kind!=='table'&&!strokeSel)\n"
            "      selT='object';") in out


def test_the_line_window_really_is_on_style(out):
    from junoview import assets
    html = assets.deck_html()
    # the group the line lands on is the one that holds its controls
    i = html.index('class="rbn-grp rbn-linegrp" data-tab="style"')
    j = html.index('id="fmt-linewrap"')
    assert i < j
    # and a shape's stroke section is on the same window
    assert "'#fmt-stylewrap':'arrow rect draw'" in out
