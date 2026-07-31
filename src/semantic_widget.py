"""Deprecated alias for :mod:`junoview.widget`.

Kept so existing ``from semantic_widget import SemanticNotebook`` code keeps
working. New code should use::

    from junoview.widget import SemanticNotebook

Needs the widget extras: ``pip install "junoview[widget]"``.
"""

from __future__ import annotations

import warnings

from junoview.widget import SemanticNotebook

warnings.warn(
    "semantic_widget is deprecated; import junoview.widget instead "
    "(the module was split into a package in 0.2.0).",
    DeprecationWarning, stacklevel=2,
)

__all__ = ["SemanticNotebook"]
