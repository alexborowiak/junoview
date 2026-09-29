"""T537: Clipboard, first on Home.

Cut, Copy and Paste lived only on keys and the right-click menu, and
Paste in place and Copy look had no button at all. Home opens with a
Clipboard group as PowerPoint's does: Paste (split: in place, as plain
text, a copied look) and Cut over Copy and Copy look. They act on
highlighted words while you type and on the selected objects otherwise,
falling through to the slide like the keys. Paste prefers Junoview's own
copy, then asks the browser for the system clipboard.

Driven at 1440: no Home group folds at 1920, 1440, 1366 or 1280; with
the title selected Copy toasted "1 item copied", Paste added it, and
Paste > Paste in place added another where it was copied from.
"""

from __future__ import annotations


def test_the_group_leads_home(out):
    grp = out.split('<span class="rbn-grp rbn-clip" data-tab="home"')[1] \
        .split('<span class="rbn-lab">Clipboard</span>')[0]
    for bid in ("hm-paste", "hm-paste-caret", "hm-cut", "hm-copy",
                "hm-copylook", "hm-paste-place", "hm-paste-plain",
                "hm-paste-look"):
        assert f'id="{bid}"' in grp, bid
    assert out.index('class="rbn-grp rbn-clip"') \
        < out.index('class="rbn-grp rbn-slides"')


def test_the_buttons_do_what_the_keys_do(out):
    fn = out.split("  function clipBtn(which){")[1].split("\n  function clipBoot")[0]
    assert "try{document.execCommand(which);}catch(e){}" in fn
    assert "var nc=copySel();" in fn and "var nx=cutSel();" in fn
    assert "else if(slideCopy(cur)) toast('Slide copied');" in fn
    assert "if(which==='paste'&&clipBuf.length){pasteBuf('auto');return;}" in fn
    assert "cb.read().then(function(items){" in fn
    assert "pasteBuf('place');" in fn
    assert "var nl=pasteLook();" in fn
    assert "    clipBoot();" in out
    assert "if(typeof clipSync==='function') clipSync();   /* T537 */" in out
