"""The local app: notebooks as browser tabs, backed by a small HTTP server.

This is the half of Junoview that can touch your disk -- opening notebooks,
saving decks, writing notes back into ``.ipynb`` files and optionally committing
them. It binds to localhost and guards every mutating request with a per-session
token, because a page it did not serve must never be able to drive it.

:mod:`~junoview.server.app` starts it; :mod:`~junoview.server.routes` is the
request surface; :mod:`~junoview.server.state` is what a session remembers.
"""

from __future__ import annotations

from .app import run_app

__all__ = ["run_app"]
