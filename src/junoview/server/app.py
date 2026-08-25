"""Starting and serving the local app.
"""

from __future__ import annotations

import http.server
import sys
import threading
import webbrowser
from pathlib import Path

from ..notebook.loader import is_url, normalize_nb_url
from .routes import _make_handler
from .state import _AppState


def run_app(root: Path, notebooks: list, port: int = 8765,
            open_browser: bool = True) -> int:
    state = _AppState(root)
    for nb in notebooks:
        if isinstance(nb, str) and is_url(nb):
            state.note_open(normalize_nb_url(nb))
            continue
        f = Path(nb).expanduser().resolve()
        if f.exists():
            state.note_open(f)
        else:
            print(f"warning: {nb} not found, skipping", file=sys.stderr)
    handler = _make_handler(state)
    try:
        httpd = http.server.ThreadingHTTPServer(("127.0.0.1", port), handler)
    except OSError:                 # port busy -> any free port
        httpd = http.server.ThreadingHTTPServer(("127.0.0.1", 0), handler)
    url = f"http://127.0.0.1:{httpd.server_address[1]}/?t={state.token}"
    print("Junoview")
    print(f"  url:     {url}")
    print(f"  project: {state.project_path}")
    print("  Open notebooks with '+ Open' or drop .ipynb files onto the "
          "page. Ctrl+C stops the app.")
    if open_browser:
        threading.Timer(0.4, webbrowser.open, args=(url,)).start()
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nstopped")
    finally:
        httpd.server_close()
    return 0
