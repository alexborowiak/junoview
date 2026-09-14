"""T437: a picture is embedded by default; link-only is a choice you make.

The user, 2026-09-14: "images are still just loading from their path
by default. The default should be that they are embedded, and then
there are options to make them just from the path and so load each
time, as well as refresh from the path even if they are embedded ...
The load always from path (symbolic link) needs to be a compression
thing that is only active manually so people are aware."

A web address typed at the address door, pasted as HTML, or pasted
onto a flip book used to be kept AS the address and loaded on every
render. Every door now reads the picture into the deck (fetchDataUrl)
and keeps the address beside the bytes (psrc); only a site that
refuses the read leaves it as a link, and the toast says so. "Link
only" is a switch on the Images pane row and on the Object tab,
worded as the size saving it is; Refresh re-reads from a file, a path
or an address, and turns a link back into bytes.

Driven live against a small CORS-enabled server: the typed address
landed as data: with psrc set; Link only swapped the bytes for the
address and back; an unreachable address stayed a link with the toast.
"""

from __future__ import annotations


def test_every_door_reads_the_picture_in(out):
    assert "  function fetchDataUrl(url){" in out
    fn = out.split("  function placeFromAddress(addr){")[1].split("\n  }")[0]
    assert "      fetchDataUrl(addr).then(function(full){" in fn
    assert "          if(a&&a.k==='image'){a.psrc=addr;markDirty();showFmt();}" \
        in fn
    assert "        placeImage(addr,0);\n        toast('That site did not let" in fn
    # the paste doors go through the same door
    assert "    placeFromAddress(pic.src);\n    return true;" in out
    assert "        .then(function(b){flipAddFiles(bk,[b],said);})" in out


def test_link_only_is_a_switch_you_see(out):
    assert "  function picSetLink(a,on){" in out
    assert "      act(r.pic==='link'?'Link only':'Embedded'," in out
    assert 'id="fmt-imglink" hidden' in out
    assert "'fmt-imgrefresh','fmt-imglink'," in out
    assert "      picSetLink(a,picState(a)!=='link').then(function(){showFmt();});" \
        in out
    # refresh re-reads from any address, and a link becomes bytes
    assert "        if(/^https?:\\/\\//i.test(addr)) return fetchDataUrl(addr);" \
        in out
    assert "          if(wasLink&&addr0) e.a.psrc=addr0;" in out
    assert "        ?' Refresh from file':' Refresh from path');" in out
