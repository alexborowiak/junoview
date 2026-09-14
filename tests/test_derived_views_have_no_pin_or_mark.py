"""T248: pin and mark act on the source cell only.

Tree clones drop their card ids but kept the pin and mark buttons, so
a press there derived "" for an id and could persist a meaningless
mark; plot-trace clones kept their ids but repainted only the clone,
leaving the source document stale until a reload. Both derived views
now drop the two controls with the eye and the add-note pencil they
already dropped -- the source card and its outline row are where a pin
or a mark acts.

Driven on the example notebook: the source cards carried their pins;
an expanded Tree node showed its card with 0 pins and 0 marks; a Plot
trace tab's cards had 0 of each.
"""

from __future__ import annotations

from junoview import assets


def test_a_tree_node_drops_the_pin_and_the_mark():
    app = assets.app_js()
    node = app.split("    function fillNode(el){")[1].split("\n    function ")[0]
    assert ("      $$('.cell-eye,.plot-trace-btn,.card-anchor,.card-addnote,'\n"
            "        +'.cell-pin,.cell-mark',clone)\n"
            "        .forEach(function(x){x.remove();});") in node


def test_a_plot_trace_drops_them_too():
    app = assets.app_js()
    assert ("    $$('.cell-eye,.card-addnote,.cell-pin,.cell-mark',section)\n"
            "      .forEach(function(b){\n"
            "        if(b.parentNode) b.parentNode.removeChild(b);});") in app


def test_the_source_card_keeps_them():
    import inspect

    from junoview.render import items
    code = inspect.getsource(items)
    assert 'class="cell-pin"' in code
    assert 'class="cell-mark" type="button" data-mark=""' in code
