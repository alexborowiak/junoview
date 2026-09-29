"""T528: nothing is refused on load.

Every app start put a refused request in the console (the 2026-09-29
audit): the Home screen's demo reel probed `gifs/code_folding.gif` to
learn whether the clips exist, and only the published site has that
folder. The app's own server refused it (403) and a file:// render
reported it missing, before the section quietly hid itself. The probe
now runs only in the web build, the one place the answer can be yes.

Driven: a fresh app start, and the editor open, both log no 4xx and no
console error; the web build (with docs/gifs beside it) still shows the
reel.
"""

from __future__ import annotations


def test_the_demo_probe_runs_only_in_the_web_build(out):
    reel = out.split("var KEY='junoview:demos';")[1] \
        .split("probe.src='gifs/code_folding.gif';")[0]
    assert "    if(APP.mode!=='web'){t.hidden=true;return;}\n" \
        "    var probe=new Image();" in reel
