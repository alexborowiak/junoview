"""T275: matching never deletes a heading's type.

MATCH_PROPS includes `style`, and the copy loops follow "undefined on
the model means DELETE on the target". So matching a typed heading
against an untyped model box used to strip `a.style` and keep the
baked-on look: the box still LOOKED like a heading and was no longer
one, which the outline, "apply to all headings" and the standardiser
cannot see. Matching means "look like this one", so a model with no
name leaves the target's alone. One helper, three callers.
"""

from __future__ import annotations


def test_the_rule_lives_in_one_helper(out):
    rule = out.split("function matchProp(from,to,p){")[1].split("\n  }")[0]
    assert ("    if(from[p]===undefined){\n"
            "      if(p!=='style') delete to[p];\n"
            "      return;\n"
            "    }") in rule
    assert ("    to[p]=(typeof from[p]==='object'&&from[p])"
            "?deep(from[p]):from[p];") in rule


def test_all_three_loops_use_it(out):
    # Match this slide
    body = out.split("function matchSlide(fromIdx,toIdx){")[1].split("\n  }")[0]
    assert "MATCH_PROPS.forEach(function(prop){matchProp(m,p2.a,prop);});" in body
    assert "delete p2.a[prop]" not in body
    # Apply to all of this type
    body = out.split("function applyToType(key,src,want,idxs){")[1]
    body = body.split("\n  }")[0]
    assert "if(want[p]) matchProp(src,a,p);" in body
    assert "delete a[p]" not in body
    # Copy this look to objects I click
    body = out.split("function matchCopy(from,to,want){")[1].split("\n  }")[0]
    assert "if(want[p]) matchProp(from,to,p);" in body
    assert "delete to[p]" not in body


def test_a_named_model_still_carries_its_name(out):
    """The guard is only for a model WITHOUT a name: a Heading 2 model
    still makes the target a Heading 2, which is what "Named style" in
    the Apply dialog is for."""
    assert "['style',  'Named style',               'Type',      'text'," in out
    rule = out.split("function matchProp(from,to,p){")[1].split("\n  }")[0]
    assert "if(p!=='style') delete to[p];" in rule
    assert rule.count("delete") == 1
