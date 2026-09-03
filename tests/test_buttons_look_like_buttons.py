"""A button looks like a button (T219).

The user, 2026-09-03, with the Design tab and the Saved layouts dialog
screenshotted: "all the buttons still look really weird, and are all
over the place. Like the spacing stuff is weird, why is that word where
it is? Also the words like 'Slide', 'Layout' and all that are tiny down
the bottom... all of the pop up menus are god awful... the most unclear
thing ever and I cannot tell what is going on... They are all just
floating text with icons. This is a mess to look at."

T207 had made every ribbon control flat at rest. What these pin is the
reversal: one surface on every control, a run as one box, the group's
name and every menu and dialog heading in readable words, and the Saved
layouts dialog saying what it is for. How it looks was driven in a
browser at 1400 and 1800 wide, dark and light.
"""

from __future__ import annotations

import re

from junoview import assets


def test_every_ribbon_control_wears_the_one_surface(out):
    """Fill, hairline and 6px corner come from three variables set once
    on the ribbon (and once again for the light theme), so no control can
    have a surface of its own."""
    assert (".edit-tools{--rbn-btn:#ffffff0d;--rbn-btn-bd:#ffffff21;"
            "--rbn-btn-hi:#ffffff1c;}") in out
    assert "body.light .edit-tools{--rbn-btn:#00000007;--rbn-btn-bd:var(--line);" in out
    assert ("  background:var(--rbn-btn);border:1px solid var(--rbn-btn-bd);\n"
            "  border-radius:6px;box-shadow:none;}") in out
    # flat at rest is gone, and so is the light theme's flat rule
    assert ("border-color:transparent;background:transparent;box-shadow:none;}"
            not in out)
    assert "body.light .edit-tools .dbtn.lay{border-color:transparent;" not in out
    # the tile keeps the same corner as a small button
    assert re.search(r"\.fx-tile\{[^}]*border-radius:6px;", out)


def test_a_run_is_one_box_with_its_caption_inside(out):
    """Spacing | Tight | Normal | Airy is one control. The caption is the
    first segment, in the box; the buttons are divided by a hairline and
    have no box of their own. A three-column grid had put the caption in
    a column and wrapped Airy under it."""
    html = assets.deck_html()
    # (tx-run-by left with the Object tab's Animation group in T220)
    for cid in ("hm-lay-tidy", "anim-start", "anim-by", "tx-run-style",
                "tx-run-align"):
        assert re.search(rf'class="rbn-cell rbn-seg[^"]*" id="{cid}"', html), cid
    assert ".lay-tidy{display:grid;grid-template-columns:repeat(3,1fr);" not in out
    assert (".edit-tools .rbn-row>.rbn-cell.rbn-seg{gap:0;background:var(--rbn-btn);"
            in out)
    assert (".edit-tools .rbn-cell.rbn-seg>.dbtn{border:0;border-radius:0;\n"
            "  background:transparent;border-left:1px solid var(--rbn-btn-bd);") in out
    assert ".edit-tools .rbn-cell.rbn-seg>.cell-lab+.dbtn{border-left:0;}" in out
    assert (".edit-tools .rbn-cell.rbn-seg>.cell-lab{display:flex;align-items:center;\n"
            "  align-self:stretch;padding:0 8px 0 9px;\n"
            "  border-right:1px solid var(--rbn-btn-bd);}") in out
    # the base cell rule is untouched: a stepper is still one cell
    assert ".rbn-cell{display:flex;align-items:stretch;gap:3px;height:30px;}" in out


def test_the_words_on_the_ribbon_can_be_read(out):
    """Sans, not 8.5px spaced capitals: 12px on a button, 11px on a tile,
    11.5px for a group's name, and a half step up on a wide screen. No
    density rung touches a font size any more: the ladder trades space,
    then folds a group, and the words stay the size they are."""
    assert (".rbn-lab{font-family:var(--sans);font-size:11.5px;letter-spacing:0;\n"
            "  text-transform:none;color:#8ea3b5;") in out
    assert (".dbtn.rbn-sm{display:flex;align-items:center;gap:6px;padding:3px 8px;\n"
            "  font-family:var(--sans);font-size:12px;") in out
    i = out.index("the compaction ladder. Every stage trades SPACE")
    ladder = out[i:out.index("/* ---- ...and the changing region pays for it", i)]
    for rule in re.findall(r"\.deck\.erc[^{]*\{[^}]*\}", ladder):
        assert "font-size" not in rule, rule
    assert (".deck.erc-tight .et-fmt .dbtn.rbn-sm,\n"
            ".deck.erc-tight .et-fmt .rbn-row .dbtn.etm{\n  padding-left:5px;") in out
    assert ".dbtn.rbn-sm i,.dbtn.rbn-sm svg{width:15px;height:15px;flex:none;}" in out
    assert ".dbtn.etm{padding:5px 9px;font-family:var(--sans);font-size:12px;}" in out
    assert ".rbn-tab{font-family:var(--sans);font-size:13px;letter-spacing:0;" in out
    assert (".rbn-cell .cell-lab{align-self:center;font-family:var(--sans);"
            "font-size:11.5px;") in out
    for rule in re.findall(r"\.rbn-lab\{[^}]*\}", out):
        m = re.search(r"font-size:([\d.]+)px", rule)
        if m:
            assert float(m.group(1)) >= 10.5, rule
        assert "letter-spacing:.1" not in rule, rule
    assert "  .edit-tools .rbn-lab{font-size:12px;}" in out
    assert "  .rbn-tab{font-size:13.5px;}" in out


def test_menu_and_dialog_headings_are_words(out):
    """A heading inside a menu, a dialog's title and a column's heading
    were all the same 8.5-10.5px spaced capitals. They are sentence-case
    sans now, at three sizes that say which is which."""
    assert (".hd-lab{font-family:var(--sans);font-size:11px;font-weight:600;"
            "letter-spacing:0;\n  text-transform:none;") in out
    assert ".hd-lab::first-letter{text-transform:uppercase;}" in out
    assert (".eq-t{font-family:var(--sans);font-size:12.5px;font-weight:600;"
            "letter-spacing:0;\n  text-transform:none;") in out
    assert ".aa-head .eq-t,.eq-head .eq-t{font-size:15px;color:#f2f7fa;}" in out
    assert (".aa-box .dbtn,.eq-box .dbtn{font-family:var(--sans);font-size:12.5px;}"
            in out)
    # a menu row is set in the same type as the rest of the menu
    assert ("  justify-content:flex-start;text-align:left;font-family:var(--sans);"
            in out)
    assert ("  min-height:26px;padding:4px 9px!important;font-size:12px!important;"
            in out)


def test_saved_layouts_says_what_it_is_for(out):
    """One sentence at the top, the two halves named as steps, the one
    thing you can do with an empty library as a button under it, and
    the empty states in plain words."""
    i = out.index('id="ar-dlg"')
    dlg = out[i:out.index('id="ss-dlg"', i)]
    assert ('<div class="aa-what">A saved layout is the way one slide is arranged,'
            in dlg)
    assert "<span class=\"eq-t\">1. Layouts you have saved</span>" in dlg
    assert "<span class=\"eq-t\">2. Slides that will take one</span>" in dlg
    assert dlg.index('id="ar-lib"') < dlg.index('id="ar-save"')
    assert 'class="dbtn ar-savebtn" id="ar-save"' in dlg
    assert ">Tick all</button>" in dlg and ">Untick all</button>" in dlg
    assert "Your saved layouts" not in dlg and "Apply it to these slides" not in dlg
    assert "None saved yet. Arrange " in out
    assert "Once a layout is saved, " in out
    assert "'No slides ticked'" in out and "'Nothing chosen'" not in out
