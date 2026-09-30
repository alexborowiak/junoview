"""T593: the ribbon following a selection cannot cancel the gesture.

The user, 2026-09-30: "For some reason I have a text box that cannot be
resized at all." Every canvas gesture -- a resize handle, a rotate grip,
an arrow's end -- selects first (selectAnnot, which calls showFmt) and
starts its drag second. T578 left one key out of timingState's early
answer (T583), so showFmt threw for every text box with no animation,
and the throw ended the gesture before startResize ran: the box showed
its handles and nothing would move them. Only un-animated boxes were
affected, which is why it looked like one box "for some reason".

showFmt's dozens of syncs are guarded at the gesture's door: a fault is
reported in the console and the drag goes ahead. Driven with the T578
fault put back into a scratch build: the box still selects and resizes
519 -> 269 -> 389px, re-wrapping its words, with the error logged.
"""

from __future__ import annotations


def test_select_survives_a_throw_in_show_fmt(out):
    sel = out.split("  function selectAnnot(layer,idx,additive){")[1] \
        .split("\n  }\n")[0]
    assert "    try{showFmt();}" in sel
    assert "console.error('Junoview: the ribbon could not follow the selection'," \
        in sel
    # the objects pane and the arrow handles still follow after it
    assert sel.index("try{showFmt();}") < sel.index("renderSelPane();")


def test_a_handle_still_selects_then_drags(out):
    assert ("          selectAnnot(layer,idxR);\n"
            "          startResize(layer,s,idxR,ev,t.dataset.corner);") in out
