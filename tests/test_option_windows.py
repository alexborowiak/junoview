"""Windows of options (T177): a worded door opens a room of controls.

The user, 2026-09-02: "there are just heaps of buttons that you always
have to click through... it would be good if more things, like the text
options, had their own little window of options." With a text box
selected the Object tab held 41 controls; the Text group alone fifteen.

These pin the SHAPE of the fix -- the real controls moved into the
windows in the markup, one owner opening every door, a ribbon layout
resolving a member to its window -- and the two shipped bugs driving it
uncovered. What the windows DO was driven in a browser (see the T177
note in TASKS.md); a string in the page cannot tell you whether a door
opens.
"""

from __future__ import annotations

import re


def _window(out: str, wrap_id: str) -> str:
    """The markup of one window, from its wrapper to its panel's end."""
    i = out.index(f'id="{wrap_id}"')
    j = out.index("</div>\n              </span>", i)
    return out[i:j]


def test_the_text_group_is_three_doors_not_fifteen_buttons(out):
    """Font holds the typeface, the size and the four emphasis toggles;
    Paragraph holds alignment, the list toggles, the box indent, both
    spacings and the curve; Styles stays as it was. The controls keep
    their ids: there is still exactly one Bold in the application.
    """
    # ...and T189 put the everyday ones BACK in the row -- bold, italic,
    # underline, the two lists, the three alignments -- because "too
    # many things are in buttons in buttons".
    # T220 finished the job: the Font window is GONE. The Animation group
    # leaving the Object tab paid for the typeface and the size on the
    # row (2026-09-03, user: "this would allow things like the text size
    # to be actually always visible as it should be. That should not be
    # behind two clicks"), and strikethrough joined B I U as a fourth
    # segment.
    for gone in ('id="fmt-fontwrap"', 'id="fmt-font-btn"',
                 'id="fmt-font-menu"'):
        assert gone not in out, gone
    for cid in ("fmt-font", "fmt-sizecell", "fmt-szwrap", "fmt-size",
                "fmt-smaller", "fmt-bigger", "fmt-strike"):
        assert f'id="{cid}"' in out, cid
    style = out[out.index('id="tx-run-style"'):out.index('id="tx-run-align"')]
    assert 'id="fmt-strike"' in style
    para = _window(out, "fmt-parawrap")
    for cid in ("fmt-para", "fmt-para-menu", "fmt-outdent", "fmt-indent",
                "fmt-para-ind", "fmt-para-curve"):
        assert f'id="{cid}"' in para, cid
    # ...and spacing left it for a door of its own on the row (T220)
    assert 'id="fmt-lhwrap"' not in para
    assert 'id="fmt-lh-btn"' in out and 'id="fmt-lh-menu"' in out
    for cid in ("fmt-bullets", "fmt-numbers"):
        assert f'id="{cid}"' not in para, cid
    for cid in ("fmt-al-left", "fmt-al-center", "fmt-al-right"):
        assert f'id="{cid}"' in out, cid
    # the old Spacing and Layout doors are gone; the wrapper stays because
    # showFmt governs spacing by kind (a table's words take it too)
    assert 'id="fmt-lh"' not in out
    assert "wireFloatDropdown('fmt-parawrap'" not in out
    assert "function buildParaPanel(){" in out
    assert "function buildSpacingRows(){" in out
    for cid in ("fmt-bold", "fmt-font", "fmt-bullets", "fmt-smaller"):
        assert out.count(f'id="{cid}"') == 1, cid
    # a window that fills itself when it opens is not empty just because
    # it is closed -- without this the Paragraph door vanished for every
    # text box the moment spacing moved out of it (T220)
    assert "if(panel.dataset.built) return;" in out


def test_the_line_window_lays_four_drawn_menus_flat(out):
    """Style, Weight, Ends and Route were four dropdown doors in three
    stacked columns. They are sections of one window now: the wrappers
    keep their ids (FMT_KINDS governs each by kind) and their old doors
    (buildLineMenus wires the drawn menus to them), and the doors are
    never shown. A pick inside a section leaves the window up.
    """
    line = _window(out, "fmt-linewrap")
    for cid in ("fmt-line", "fmt-line-menu", "fmt-stylewrap", "fmt-style",
                "fmt-style-menu", "fmt-swwrap", "fmt-sw", "fmt-sw-lab",
                "fmt-sw-menu", "fmt-headwrap", "fmt-head", "fmt-head-menu",
                "fmt-bendwrap", "fmt-bend", "fmt-bend-menu"):
        assert f'id="{cid}"' in line, cid
    assert line.count('class="dbtn rbn-sm opt-sec-btn"') == 4
    assert ".opt-panel .opt-sec>.opt-sec-btn{display:none!important;}" in out
    assert "if(menu.closest&&menu.closest('.opt-panel')) return;" in out
    # the stacked columns that held them are gone
    assert "rbn-stack rbn-cols" not in out
    # the printed thickness moved from the old door's tooltip to the
    # section heading, where the reader is looking now
    assert "if(swL) swL.textContent='weight — '+swSay;" in out


def test_the_source_window_holds_the_provenance_family(out):
    """Six of a placed figure's buttons were about where it came from.
    One door; every row closes the window as it acts (data-close),
    because these are things you do and leave.
    """
    src = _window(out, "fmt-srcwrap")
    for cid in ("fmt-src", "fmt-src-menu", "fmt-locate", "fmt-prov",
                "fmt-revert", "fmt-lockver", "fmt-replace"):
        assert f'id="{cid}"' in src, cid
    # Refresh from file sits on the row beside the path since T198
    assert 'id="fmt-imgrefresh"' not in src and 'id="fmt-imgrefresh"' in out
    assert 'hidden data-close="1"' in src
    # Caption and Crop stay OUTSIDE: one creates, one is the common edit
    assert 'id="fmt-caption"' not in src and 'id="fmt-cropwrap"' not in src


def test_one_owner_opens_every_door_from_the_boot_sequence(out):
    """No per-window JS: every .opt-drop is wired by optPanelBoot, from
    THE BOOT SEQUENCE, through the one transient-menu owner -- so a
    window is exclusive, floats clear of the ribbon's clip, and closes
    on Escape or a click away, while a click INSIDE keeps it open.
    """
    assert "function optPanelBoot(){" in out
    assert "  optPanelBoot();" in out
    assert "overlayShow(door,panel);floatMenu(door,panel);" in out
    # Source-style windows close as a row acts, in capture so a row that
    # stops propagation still closes the window it sits in
    assert "if(panel.dataset.close) panel.addEventListener('click'," in out
    # an open window is redrawn for whatever is selected now
    assert "function optPanelsSync(){" in out
    assert "if(typeof optPanelsSync==='function') optPanelsSync();" in out
    # ...and closed when the selection goes away
    assert "if(typeof optPanelsClose==='function') optPanelsClose();" in out


def test_a_door_shows_when_anything_behind_it_would(out):
    """showFmt says so explicitly for each window, and syncOptDoors is
    the safety net: a heading over an empty row goes with the row, and a
    door over an empty window goes too.
    """
    assert "show('#fmt-sizecell',isText||cellText||isTbl);" in out
    assert "show('#fmt-parawrap',isText&&isNum);" in out
    assert "show('#fmt-lh-btn',(isText||isTbl)&&isNum);" in out
    assert "show('#fmt-linewrap',isNum&&lineKinds.indexOf(kind)>=0);" in out
    assert "show('#fmt-srcwrap',srcOn);" in out
    assert "function syncOptDoors(){" in out
    assert "    syncOptDoors();\n" in out
    # every new id is governed, so the completeness audit stays quiet
    for cid in ("#fmt-sizecell", "#fmt-lh-btn", "#fmt-para-ind",
                "#fmt-al-left", "#fmt-al-center", "#fmt-al-right",
                "#fmt-linewrap", "#fmt-line", "#fmt-sw-lab",
                "#fmt-srcwrap", "#fmt-src"):
        assert cid in out[out.index("var FMT_MANUAL="):
                          out.index("function fmtAllIds(){")], cid


def test_a_ribbon_layout_places_a_window_where_its_first_member_went(out):
    """The catalogue names Bold; Bold lives inside the Font window now,
    and the window is the atom. A member resolves to its window, so
    Font lands in the Office ribbon's Font group and Paragraph in its
    Paragraph group -- driven on 2026-09-02, both groups on Home.
    """
    assert "function rbnResolve(cid,atoms){" in out
    assert "var a=rbnResolve(cid,atoms);" in out
    assert "if(!a||used[a.id]) return;" in out
    # the audit does not count two members of one window as a duplicate
    assert "if(r&&r.id!==cid){seen[r.id]=1;return;}" in out


def test_deselecting_hides_only_the_outermost_governed_control(out):
    """THE SHIPPED BUG driving T177 uncovered. On deselection every
    governed id was hidden one by one (2026-08-25), and a button inside a
    governed wrapper was never shown again -- only its wrapper was. So
    after the first deselection, which is to say at boot, the Colour
    group, Arrange, Styles, Spacing, Layout, the size field and the
    opacity slider had all gone. Driven against the build before T177:
    same result; 1,000 substring tests green throughout.
    """
    assert "var gov=fmtGovernedSet();" in out
    assert "if(!inner) el.hidden=true;" in out
    assert "function fmtGovernedSet(){" in out
    # and the colour wrappers copy their button's state AFTER it is set,
    # not before -- read first, Colour was one selection behind
    i = out.index("show('#fmt-fillcol-btn',showBg&&kind!=='rect');")
    j = out.index("if(cb&&cw) cw.hidden=cb.hidden;")
    assert i < j


def test_escape_closes_the_window_and_nothing_else(out):
    """An open menu is the innermost state you can be standing in. The
    owner closes it in CAPTURE and stops the key there, so the ladder
    (drop the tool, drop the selection, leave the editor) no longer
    also fires -- closing the Font window used to deselect the box it
    was about.
    """
    # (the owner keeps a stack since T207; Escape peels the innermost)
    i = out.index("if(e.key!=='Escape'||!overlayStack.length) return;")
    block = out[i:i + 400]
    assert "e.preventDefault();e.stopPropagation();" in block
    assert "},true);" in block
    assert "if(typeof overlayNow!=='undefined'&&overlayNow) return;" in out


def test_the_windows_are_styled_as_rooms(out):
    """Tall windows scroll, hidden means hidden whatever display a row
    asked for, and the ribbon's cell-sizing and density rungs do not
    reach inside.
    """
    assert re.search(r"\.sh-menu\.opt-panel\{[^}]*max-height:min\(72vh,560px\);"
                     r"overflow-y:auto", out)
    assert ".opt-panel [hidden]{display:none!important;}" in out
    assert ".opt-panel .dbtn.etm,.opt-panel .dbtn.rbn-sm{height:auto!important;" in out


def test_the_decks_type_is_one_window_under_design(out):
    """T178. Yes, under Design: the deck's type is a design decision
    about the whole deck. What was wrong was seven buttons for one
    idea. The whole-deck commands are real buttons at the foot of the
    Text styles window; the style manager builds its rows into a list
    container so a rebuild leaves them standing. Design tokens and
    Standardise stay beside it because neither is type.
    """
    i = out.index('id="dsg-style-menu"')
    j = out.index("</div>\n              </span>", i)
    win = out[i:j]
    for cid in ("dsg-style-list", "dsg-scale-down", "dsg-scale-up",
                "dsg-restyle", "dsg-design"):
        assert f'id="{cid}"' in win, cid
    assert 'id="dsg-tokens"' not in win and 'id="dsg-std"' not in win
    assert 'id="dsg-tokens"' in out and 'id="dsg-std"' in out
    assert "var list=$('#dsg-style-list')||menu;" in out
    assert "list.innerHTML='';" in out
    # the door goes through the one owner, like every other window
    assert "overlayShow(btn,menu);floatMenu(btn,menu);" in out


def test_insert_is_three_groups_that_say_what_a_tool_is_for(out):
    """T178. Place a thing of a known kind, write words in one of three
    notations, draw with an armed tool. The buttons moved with their
    comments and not one changed its id.
    """
    for lab in ("Place", "Write", "Draw"):
        assert f">{lab}</span>" in out, lab
    # four since T188 (the Drawing group, shown only while a tool is
    # armed), five since T197 (Shapes on their own) -- and since T220 the
    # tab is two: Images keeps Place, Shapes, Draw and Drawing; Text has
    # Write to itself
    assert out.count('data-tab="images" data-fold-ic=') == 4
    # two since T221 moved the deck's type here ("text styles, deck
    # colours, style system, find mismatched text... all text related")
    assert out.count('data-tab="text" data-fold-ic=') == 2
    assert 'data-tab="insert"' not in out
    # the whole-deck scale and re-apply redraw the open window's list,
    # now that they sit inside it
    assert "if(styleMgrSync) styleMgrSync();" in out
    assert ">Insert</span>" not in out
    assert ".rbn-write{order:6;}" in out and ".rbn-draw{order:6;}" in out
