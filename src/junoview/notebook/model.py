"""The semantic model: what a notebook becomes once it is understood.

A :class:`Document` holds :class:`Section` objects, each holding :class:`Item`
cards. An item is one idea -- usually a figure with the code behind it folded
underneath as :class:`CodeStep` chunks. These are plain dataclasses with no
behaviour, so the parser and the renderer can share them without either owning
the other.
"""

from __future__ import annotations

from dataclasses import dataclass, field

from .outputs import RenderedOutput


@dataclass
class CodeStep:
    label: str
    code: str
    outputs: list[RenderedOutput] = field(default_factory=list)
    is_primary: bool = False


@dataclass
class Item:
    kind: str                      # card display type
    title: str
    code: str = ""                 # kept for notes / simple use
    code_visible: bool = False
    outputs: list[RenderedOutput] = field(default_factory=list)  # face outputs
    caption: str = ""
    item_id: str = ""              # explicit slug or auto
    node_id: str = ""              # provenance node (only if user gave `id`)
    anchor: str = ""               # stable deck ref: node_id > nb cell id > slug
    chain: list[str] = field(default_factory=list)  # upstream card anchors
    depends: list[str] = field(default_factory=list)
    subsection: str = ""
    is_note: bool = False          # pure-markdown interpretation card
    title_echo: bool = False       # title merely repeats a code line
    code_kind: str = "code"        # primary code kind (code_kinds[0])
    code_kinds: list = field(default_factory=lambda: ["code"])
    steps: list[CodeStep] = field(default_factory=list)  # folded code chunks
    members: list = field(default_factory=list)          # transient, build-only

    @property
    def has_image(self) -> bool:
        return any(o.has_image for o in self.outputs)

    @property
    def has_xarray(self) -> bool:
        return any(o.has_xarray for o in self.outputs)


@dataclass
class Section:
    title: str
    section_id: str
    level: int = 2                 # heading tier: 1 (#), 2 (##) or 3 (###)
    number: str = ""               # outline number ("2", "2.1", "2.1.3")
    items: list[Item] = field(default_factory=list)
    from_heading: bool = False     # authored `#`/`##`/`###` heading — keep


@dataclass
class Document:
    title: str
    sections: list[Section] = field(default_factory=list)
    presentations: list = field(default_factory=list)  # named slide decks
    source_name: str = ""          # notebook stem, names deck downloads
    raw_html: str = ""             # linear "raw notebook" view of the cells
