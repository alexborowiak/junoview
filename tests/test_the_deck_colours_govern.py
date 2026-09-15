"""The five deck colours actually govern the deck (T455).

The user, for the third time on 2026-09-14: "Shared colours also can go
somewhere else (and this still makes no sense to me whatever this is
doing, and I have said this so many times and you have never god damn
fixed this). This needs an overhaul."

Driven: setting Body text to red changed nothing, and every row read
"not used yet" beside a slide full of colour. A colour only followed a
token if the object carried '@ink' in its own field, which happens only
if you pick from the Deck row buried at the top of a colour menu -- so
the panel's own sentence, "change one here and every slide follows", was
false on every deck anybody has ever made.
"""

from __future__ import annotations


def test_the_base_colours_are_written_onto_the_slide(out):
    """...and ONLY when they differ from the default, so the literal in
    the CSS stays the one source of the default and an untouched deck
    renders exactly as it did."""
    assert "  var TOK_BASE={ink:1,page:1,surface:1,heading:1,line:1};" in out
    assert "    var t=tokens(),d=TOKENS_DEFAULT.c;" in out
    assert "    Object.keys(TOK_BASE).forEach(function(k){" in out
    assert "      if(v&&v!==d[k]) slideEl.style.setProperty('--tk-'+k,v);" in out
    assert "      else slideEl.style.removeProperty('--tk-'+k);" in out


def test_the_css_defaults_read_them(out):
    """Every default that used to be a bare literal now names the deck's
    answer first and keeps the literal as its fallback -- the bargain
    --tk-rad has had since T12."""
    assert ".an-text{position:absolute;max-width:60%;font-family:var(--sans);\n" \
           "  line-height:1.35;color:var(--tk-ink,#fff);" in out
    assert "    var(--tk-surface,var(--chrome-1,#0e1926)) 85%,transparent);" in out
    assert ".an-title{color:var(--tk-heading,#f0f6fa);}" in out
    assert ".an-rect{position:absolute;border:3px solid var(--tk-line,#ff6b57);" in out
    # the page is resolved in JS, so its last fallback is the token itself
    # T465: one resolver for the page's colour -- the token is the store,
    # a saved pres.pageBg is absorbed into it by normPres
    assert "  function deckPageBg(){return tokVal('@page');}" in out
    assert "    return tokVal((s&&s.bg)||mbg||'@page');" in out
    assert "    var bg=pageBgOf(s0);" in out


def test_a_base_colour_is_never_reported_as_unused(out):
    """"not used yet" beside a slide full of colour is what made the
    panel read as broken. One of the five is what everything without a
    colour of its own falls back to."""
    assert "  function tokUsesLabel(u,base){" in out
    assert "    if(base) bits.push('everything else');" in out
    assert "      var u=tokUses(k),base=!!TOK_BASE[k];" in out
    assert "      use.textContent=tokUsesLabel(u,base);" in out
    assert ("        ?('Everything that has not been given a colour of "
            "its own wears '") in out
