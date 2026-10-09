"""Starting and serving the local app.
"""

from __future__ import annotations

import http.server
import socketserver
import sys
import threading
import webbrowser
from pathlib import Path

from ..notebook.loader import is_url, normalize_nb_url
from .routes import _make_handler
from .state import _app_page, _AppState


class _Server(http.server.ThreadingHTTPServer):
    """ThreadingHTTPServer without the reverse-DNS lookup at bind.

    HTTPServer.server_bind asks ``socket.getfqdn`` for the bound address
    only to fill ``server_name``, which nothing here reads -- and on some
    Windows DNS/VPN setups that lookup stalls startup for seconds. The
    server only ever binds 127.0.0.1, so the name is the address.
    """

    def server_bind(self) -> None:
        socketserver.TCPServer.server_bind(self)
        host, port = self.server_address[:2]
        self.server_name = str(host)
        self.server_port = int(port)


def _prerender(state: _AppState) -> None:
    """Build the page once while the browser starts, so its first GET
    finds every notebook already rendered (server/shells.py) and the
    static files hashed. Best effort: the GET builds whatever this did
    not, and reports any error itself."""
    try:
        _app_page(state, warm=True)
    except Exception:       # noqa: BLE001 -- the real GET will say
        pass


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
        httpd = _Server(("127.0.0.1", port), handler)
    except OSError:                 # port busy -> any free port
        httpd = _Server(("127.0.0.1", 0), handler)
    url = f"http://127.0.0.1:{httpd.server_address[1]}/?t={state.token}"
    print("Junoview")
    print(f"  url:     {url}")
    print(f"  project: {state.project_path}")
    print("  Open notebooks with '+ Open' or drop .ipynb files onto the "
          "page. Ctrl+C stops the app.")
    # The socket is already listening (the constructor binds and
    # listens), so a request the browser makes before serve_forever runs
    # waits in the backlog. There is nothing to wait FOR: this used to be
    # a fixed 0.4 s timer before the browser was even asked to start.
    # The page build itself runs alongside, while the browser launches.
    threading.Thread(target=_prerender, args=(state,), daemon=True).start()
    if open_browser:
        threading.Thread(target=webbrowser.open, args=(url,),
                         daemon=True).start()
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nstopped")
    finally:
        httpd.server_close()
    return 0
