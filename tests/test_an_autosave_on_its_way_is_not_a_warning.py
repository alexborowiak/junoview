"""T526: an autosave on its way is not a warning.

The 2026-09-29 audit called the save readout noisy: after every edit it
read "unsaved -- saving..." in the warning colour for the fifteen seconds
until the timer fired, so the bar flashed orange all day for the one
state that needs nothing from you. The countdown button stays exactly as
T70 made it (the user asked for a visible auto-save timer); only the
colour changes, and it is kept for the states that DO need you: autosave
off, a file waiting on a click, a full browser.

Driven: a fresh auto-built deck reads "unsaved -- saving..." with
`deck-status draft pending` in the chrome's quiet ink.
"""

from __future__ import annotations


def test_the_pending_state_is_marked(out):
    assert ("    if(source==='draft'&&auto&&deckEdited()) "
            "el.classList.add('pending');") in out
    # after the className assignment, which would wipe it
    fn = out.split("  function status(){")[1].split("\n  }\n")[0]
    assert fn.index("el.className='deck-status '+source;") \
        < fn.index("el.classList.add('pending');")


def test_it_reads_quietly_and_the_warning_stays_for_the_rest(out):
    assert (".deck-status.draft.pending{background:var(--surface-active);\n"
            "  color:var(--chrome-ink-2);}") in out
    assert ".deck-status.draft{background:color-mix(in srgb,var(--warning)" \
        in out
