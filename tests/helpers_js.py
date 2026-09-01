"""Run a frontend JS file and get its output back in Python.

The suite pins the frontend by reading it as text. That is the right
default -- it needs no toolchain, and this project deliberately has none
-- but it cannot settle a question about what the code *does*, and for
``pptx.js`` the question is binary-format correctness. A valid-looking
string in an invalid ZIP still opens with PowerPoint's repair prompt, and
no substring can tell the difference.

The engine is the one ``tests/test_js_contract.py`` already finds for its
syntax checks: node if it is on PATH, otherwise VS Code's Electron with
``ELECTRON_RUN_AS_NODE=1``. Nothing new is required of a dev machine, and
everything here skips cleanly when neither is present.

Only ``pptx.js`` is reachable this way, and deliberately so: it is the
one asset written to a documented seam ("This file knows NOTHING about
Junoview's deck model... That seam is why this can be tested on its
own"). The deck IIFE needs a DOM and is not a candidate.
"""

from __future__ import annotations

import json
import os
import shutil
import subprocess
import tempfile
from pathlib import Path

ASSETS = Path(__file__).resolve().parent.parent / "src" / "junoview" \
    / "assets"


def lift_fn(src: str, name: str) -> str:
    """Cut one function declaration out of a larger file, by brace depth.

    The deck IIFE as a whole needs a DOM, but a PURE function inside it
    does not, and a substring assertion cannot tell a correct clamp from
    a wrong one. Lifting the declaration lets a test run the arithmetic
    that actually ships instead of describing it.
    """
    head = f"function {name}("
    i = src.index(head)
    j = src.index("{", i)
    depth = 0
    for k in range(j, len(src)):
        if src[k] == "{":
            depth += 1
        elif src[k] == "}":
            depth -= 1
            if depth == 0:
                return src[i:k + 1]
    raise AssertionError(f"unbalanced braces lifting {name}")


def run_fn(src: str, name: str, calls: list[list[object]]) -> list[object]:
    """Run one lifted function over a list of argument lists.

    Returns None if no JS engine is present, so callers skip rather than
    fail on a machine without node or VS Code.
    """
    import json as _json
    import subprocess as _sp
    import tempfile as _tf

    eng = js_engine()
    if eng is None:
        return None
    cmd, env = eng
    body = lift_fn(src, name)
    with _tf.TemporaryDirectory() as d:
        p = Path(d) / "run.js"
        p.write_text(
            body + "\nconst calls=" + _json.dumps(calls) + ";\n"
            + "console.log(JSON.stringify(calls.map("
            + f"a => {name}.apply(null, a))));\n",
            encoding="utf-8")
        r = _sp.run(cmd + [str(p)], capture_output=True, text=True,
                    env=env, timeout=60)
        assert r.returncode == 0, r.stderr[:2000]
        line = [ln for ln in r.stdout.splitlines() if ln.startswith("[")][-1]
        return _json.loads(line)


def js_engine() -> tuple[list[str], dict[str, str]] | None:
    """node, else VS Code's Electron run as node, else None."""
    node = shutil.which("node")
    if node:
        return [node], dict(os.environ)
    for base in (os.environ.get("LOCALAPPDATA", ""),
                 os.environ.get("ProgramFiles", "")):
        if not base:
            continue
        exe = Path(base) / "Programs" / "Microsoft VS Code" / "Code.exe"
        if not exe.exists():
            exe = Path(base) / "Microsoft VS Code" / "Code.exe"
        if exe.exists():
            return [str(exe)], {**os.environ, "ELECTRON_RUN_AS_NODE": "1"}
    return None


_RUNNER = r"""
// pptx.js assigns window.JunoPptx; outside a browser, window IS the
// global object. That one line is the whole shim -- the file touches no
// other browser API, which is what its header promises.
globalThis.window = globalThis;
const fs = require('fs');
require(process.argv[2]);
const spec = JSON.parse(fs.readFileSync(process.argv[3], 'utf8'));
(async () => {
  const out = window.JunoPptx.build(spec);
  const buf = Buffer.from(await out.blob.arrayBuffer());
  fs.writeFileSync(process.argv[4], buf);
  process.stdout.write(JSON.stringify(
    {skipped: out.skipped, slides: out.slides, bytes: buf.length}));
})().catch(e => { process.stderr.write(String(e && e.stack || e));
                  process.exit(1); });
"""


def build_pptx(spec: dict) -> tuple[bytes, dict]:
    """Run ``JunoPptx.build(spec)`` and return the .pptx it wrote.

    Bytes rather than a path on purpose: a caller wants
    ``zipfile.ZipFile(io.BytesIO(...))``, and an open ZipFile inside a
    TemporaryDirectory cannot be cleaned up on Windows.

    Also returns the ``{skipped, slides, bytes}`` the writer reported,
    which is the only channel it has for saying what it could not carry.
    """
    engine = js_engine()
    assert engine is not None, "no JS engine (caller should have skipped)"
    cmd, env = engine
    with tempfile.TemporaryDirectory() as tmp:
        d = Path(tmp)
        (d / "run.js").write_text(_RUNNER, encoding="utf-8", newline="\n")
        (d / "spec.json").write_text(json.dumps(spec), encoding="utf-8")
        out = d / "out.pptx"
        proc = subprocess.run(
            cmd + [str(d / "run.js"), str(ASSETS / "js" / "pptx.js"),
                   str(d / "spec.json"), str(out)],
            capture_output=True, text=True, env=env, timeout=180,
        )
        assert proc.returncode == 0, (
            f"JunoPptx.build failed:\n{proc.stderr}")
        return out.read_bytes(), json.loads(proc.stdout or "{}")
