"""Notebook identity, outline controls and temporary visibility (T502)."""

import subprocess
from html.parser import HTMLParser

import pytest

from helpers_js import js_engine, lift_fn
from junoview import assets


def test_view_commands_are_inside_ribbon_and_identity_is_not_in_outline(out):
    class Elements(HTMLParser):
        def __init__(self):
            super().__init__()
            self.stack = []
            self.parents = {}

        def handle_starttag(self, tag, attrs):
            attrs = dict(attrs)
            if "id" in attrs:
                self.parents[attrs["id"]] = list(self.stack)
            if tag not in {"meta", "link", "input", "img", "br", "hr"}:
                self.stack.append((tag, attrs.get("class", "")))

        def handle_endtag(self, tag):
            for i in range(len(self.stack) - 1, -1, -1):
                if self.stack[i][0] == tag:
                    del self.stack[i:]
                    break

    page = Elements()
    page.feed(out)
    for control in ("view-raw", "view-tree", "doc-present", "doc-autoslides"):
        assert ("div", "appbar") in page.parents[control]
    shell = assets.shell_template()
    assert 'class="railtitle"' not in shell
    assert 'class="railmeta"' not in shell
    assert 'class="outline-hidden"' in shell
    assert 'aria-label="View full file path"' in out


def test_section_collapse_changes_no_hidden_flags():
    engine = js_engine()
    if engine is None:
        pytest.skip("No JavaScript engine")
    command, env = engine
    script = """
const flags=new Set(['sec-off']);
const node={classList:{toggle:(k,v)=>v?flags.add(k):flags.delete(k)},
  querySelector:()=>null};
const shell={querySelector:()=>node,querySelectorAll:()=>[]};
const $$=()=>[];
let saves=0;
/* the section's head, row and items (from the notebook's index, 2026-10-09) */
function secParts(sid){return {sec:node,row:node,items:node};}
function recalcSecCascade(){}
function scheduleSaveLayout(){saves++;}
""" + lift_fn(assets.app_js(), "setSecCollapsed") + """
setSecCollapsed('one',true);
if(!flags.has('sec-collapsed')||!flags.has('sec-off')) throw Error('collapse');
setSecCollapsed('one',false);
if(flags.has('sec-collapsed')||!flags.has('sec-off')||saves!==2)
  throw Error('expand changed visibility');
"""
    result = subprocess.run(command + ["-e", script], env=env,
                            capture_output=True, text=True, timeout=30)
    assert result.returncode == 0, result.stderr


def test_open_tabs_are_one_list_in_one_place():
    """The top strip is a normal tab row and the side panel a list, both
    built from one source. T503 kept them on screen together; T596 made
    them one list in one place (2026-09-30, user: "these should be the
    same thing not both") -- tabs by default, the side list by choice
    (App > Open files). A single open item is a tab too now: the row
    carries Home, New and Open once the side panel is not there to.
    """
    page = assets.page_template()
    js = assets.app_js()
    assert 'id="open-tabs-row"' in page
    assert 'id="top-tabstrip"' in page
    assert "topTabstrip.innerHTML='';" in js
    # one list of stems builds both strips (tabStems; a switch that changes
    # nothing else only moves the highlight, 2026-10-09 speed)
    assert "        var side=makeTab(stem);" in js
    assert "tabstrip.appendChild(side);" in js
    assert "        var top=makeTab(stem);" in js
    assert "topTabstrip.appendChild(top);" in js
    assert "if(APP.renderPresentationTabs) APP.renderPresentationTabs();" in js
    assert "function refreshOpenTabsRow(){" in js
    assert "topTabstrip.querySelectorAll('.tab').length" in js
    assert "    var on=filesAt()==='top'&&n>0;" in js
    assert "    if(openTabsRow) openTabsRow.hidden=!on;" in js
    assert "var FILES_AT_KEY='junoview:openfiles';" in js
    # one choice, not a placement per surface
    assert "setTabPlacement" not in js
