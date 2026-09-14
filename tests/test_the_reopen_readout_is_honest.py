"""T431: the remembered file's deck is announced, and the readout clears.

A deck that lived only in its file came back after a reload as a
default deck plus a small "click to reopen" pill beside Save -- the one
thing on the page that knew where the real deck was. It is said in a
toast now. And once a file is opened or picked by hand, the pill's wait
is over: it went on saying "click to reopen" after a file had been
opened and saved, and its click then said "nothing to reopen".
"""

from __future__ import annotations


def test_boot_says_where_the_deck_is(out):
    fn = out.split("  function rememberedFileBoot(h,forName){")[1].split("\n  }")[0]
    assert ("          fileWaits='reopen';status();\n"
            "          /* T431: SAID OUT LOUD.") in fn
    assert ("            +' \\u2014 click \\u201cclick to reopen\\u201d "
            "beside Save to '") in fn


def test_binding_a_file_settles_the_wait(out):
    fn = out.split("  function bindFile(name,h){")[1].split("\n  }")[0]
    assert "    if(fileWaits==='reopen') fileWaits='';" in fn
    assert "    if(fileReopen&&(!name||fileReopen.name===name)) fileReopen=null;" in fn
