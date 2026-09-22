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


def test_tab_placement_preserves_open_tabs_and_remembers_choice():
    engine = js_engine()
    if engine is None:
        pytest.skip("No JavaScript engine")
    command, env = engine
    script = """
const classes=new Set();
const document={body:{classList:{toggle:(k,v)=>v?classes.add(k):classes.delete(k)}}};
const placement={value:'side'},stored={};
const localStorage={setItem:(k,v)=>stored[k]=v};
let measures=0,rail='min';
function setRailState(v){rail=v;}
function measureChrome(){measures++;}
""" + lift_fn(assets.app_js(), "setTabPlacement") + """
setTabPlacement('top');
if(!classes.has('tabs-top')||rail!=='full'||placement.value!=='top')
  throw Error('top tabs not visible');
setTabPlacement('side');
if(classes.has('tabs-top')||stored['sem-tab-placement']!=='side'||measures!==2)
  throw Error('sidebar not restored');
"""
    result = subprocess.run(command + ["-e", script], env=env,
                            capture_output=True, text=True, timeout=30)
    assert result.returncode == 0, result.stderr
