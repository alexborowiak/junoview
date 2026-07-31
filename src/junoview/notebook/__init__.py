"""Reading notebooks and working out what they mean.

Nothing here produces HTML. The job of this subpackage is to take an executed
``.ipynb`` and hand back a :class:`~junoview.notebook.model.Document`: sections,
cards, folded code, captions and a provenance graph. :mod:`junoview.render`
takes it from there.

The reading order, if you are new to the codebase:

1. :mod:`~junoview.notebook.model` -- the shapes everything else fills in.
2. :mod:`~junoview.notebook.directives` -- what the notebook's author declared.
3. :mod:`~junoview.notebook.classify` -- what gets inferred when they didn't.
4. :mod:`~junoview.notebook.outputs` -- what the stored outputs actually are.
5. :mod:`~junoview.notebook.parser` -- the pass that ties those together.
6. :mod:`~junoview.notebook.chains` -- which card feeds which.
"""

from __future__ import annotations

from .model import CodeStep, Document, Item, Section
from .parser import parse_notebook

__all__ = ["CodeStep", "Document", "Item", "Section", "parse_notebook"]
