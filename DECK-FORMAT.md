# The deck format

[← back to the README](README.md) · [architecture](ARCHITECTURE.md) · [how to write code here](AGENTS.md)

A deck is JSON. It travels in three places — a notebook's
`metadata.semantic.presentations`, a `<notebook>.deck.json` sidecar, or
the app's project file — and `junoview.notebook.presentations`
normalises all three into the one shape described here.

**Two functions, deliberately opposite.** `_as_presentations` *coerces*
and never complains: it rebuilds a deck field by field, drops what it
does not recognise and skips what it cannot use, which is why a deck
saved months ago still opens. `deck_schema.validate_deck` *complains*
and never changes anything: it reports every problem it can find and
returns them as a list. Neither raises.

The tables in `src/junoview/notebook/deck_schema.py` are the schema;
this file is prose over the same list, and `tests/test_deck_schema.py`
checks the two agree.

## Geometry

Everything placed on a slide is positioned in **percent of the page** —
`x` and `w` of its width, `y` and `h` of its height. That is what lets
one deck render at 16:9, on A4 and on an A0 poster without a single
stored coordinate changing. Text size is a percentage of page *height*.

Values outside 0–100 are legal: an item parked off the page is a
supported state, and the editor marks it rather than forbidding it.

## Deck keys

| key | type | what it is |
| --- | --- | --- |
| `components` | dict | {id: {name, w, h, items}}. Named groups that can be placed repeatedly; every instance stays linked to the definition. |
| `cropMarks` | int | 1 when trim marks are printed outside the page. |
| `cuts` | dict | {id: {name}}. Named subsets of one deck — a 45-minute version and a 5-minute one in the same file. Membership is the slide's `cuts` list. |
| `emb` | dict | The deck's own copy of every placed card, so it shows its figures with no notebook and no network. |
| `filters` | dict | For a view: its saved filters. Tolerated on read and never written back. |
| `folder` | str | The folder the deck is filed under in the rail. |
| `foot` | dict | Running footer. |
| `head` | dict | Running header. |
| `kind` | str | Only ever "view" — a saved filtered view of one notebook rather than a deck of slides. |
| `name` | str | What the deck is called. |
| `nb` | str | For a view: which notebook it is a view of. |
| `notes` | str | Whole-talk speaker notes (per-slide notes live on the slide). |
| `pad` | list | The scratchpad's notes. |
| `page` | str | Page-size preset id ("a4", "a0", "wide", …). |
| `pageBg` | str | The page's own background colour. |
| `sections` | dict | {id: {name, fold}}. Membership is the slide's `sec` tag; the ORDER is read back off the slide list and never stored. |
| `showNums` | int | 1 when slide numbers are drawn. |
| `slides` | list | The slides, in order. The order IS the story. |
| `style` | dict | For a view: its saved styling. |
| `styles` | dict | This deck's overrides of the named text types. |
| `talkMins` | int or float | How long the whole talk should run. |
| `tapzoom` | int | 1 when tapping an item enlarges it in playback. |
| `tokens` | dict | The deck's design tokens: {c:{name:colour}, rad, gap}. An item referencing one stores '@name'. |
| `types` | list | Text types this deck invented, beyond the built-in seven. |
| `view` | dict | For a view: its saved view state. |
| `wmark` | dict | Watermark across every page. |

## Slide keys

| key | type | what it is |
| --- | --- | --- |
| `annots` | list | Everything placed freely on the slide. |
| `bg` | str | This slide's own background colour. |
| `border` | dict | This slide's own border. |
| `cuts` | list | Which named cuts this slide is in. A slide naming none is in every cut. |
| `goal` | int or float | Minutes this slide should take. |
| `grpmeta` | dict | Names for the groups on this slide. |
| `hidden` | list | Card refs kept out of this slide's code trail. |
| `label` | str | A name for this version of a poster. |
| `layout` | str | Which pane arrangement this slide uses. |
| `notes` | str | Speaker notes for this slide. |
| `opt` | int | 1 when this slide is optional — "Running late" in present mode skips it. |
| `panes` | list | One card anchor per pane, or null for an empty one. |
| `sec` | str | Which section this slide belongs to. |
| `sprops` | dict | Geometry and look of the subtitle text. |
| `sub` | str | Title-slide subheading. |
| `title` | str | Title-slide heading. |
| `tprops` | dict | Geometry and look of the title text. |
| `trans` | str | How this slide arrives: "" (cut), "fade" or "move" (matching objects travel). A section may set a default for the slides in it. |

### Layouts

A slide's `layout` fixes how many `panes` it has:

| layout | panes |
| --- | --- |
| `blank` | 0 |
| `full` | 1 |
| `halves` | 2 |
| `quarters` | 4 |
| `rows` | 2 |
| `title` | 0 |

A slide whose `panes` list is the wrong length still loads — it is
padded or truncated — so a mismatch is reported as a warning, not an
error.

## Items on a slide (`annots`)

Each carries a kind in `k`. The required fields are only what it takes
to place the thing at all; everything else about how it looks is
optional and defaulted.

| `k` | must have | what it is |
| --- | --- | --- |
| `arrow` | `x1`, `y1`, `x2`, `y2` | A line or arrow — two endpoints, not a box. |
| `cell` | `x`, `y` | A frame showing a card from a notebook, named by `ref`. |
| `draw` | `x`, `y` | A freehand stroke: a box plus points normalised inside it. |
| `flip` | `x`, `y` | A flip book: several figures stepped through in place. |
| `image` | `x`, `y` | A placed picture, carried as a data URI. |
| `rect` | `x`, `y` | A drawn shape; `shape` picks which one. |
| `table` | `x`, `y` | Rows of plain strings, not HTML. |
| `text` | `x`, `y` | A text box. Auto-heights from its words, so it has no required h. |

### Anchoring

An item may name one **anchor** in `anch` — `tl` `tc` `tr` `cl` `c` `cr`
`bl` `bc` `br` — and then its `x`/`y` are measured from that corner or
edge rather than from the top left. A footer pinned `bl` stays the same
distance off the bottom whatever shape the page becomes; a page number
pinned `br` stays in its corner. Absent, `x`/`y` mean exactly what they
always did.

One anchor per item, deliberately: an anchor per axis is what a
constraint solver grows out of, and this is not one.

### Colours and tokens

A colour field (`color`, `fillc`, `bgc`, `txcol`, `bgcol`) holds a CSS
colour — or a **token reference**: the string `@accent`, naming an
entry in the deck's `tokens.c`. A reference is not a copy, so changing
the token changes every item wearing it.

## Checking a file

```python
from junoview.notebook.deck_schema import validate_deck

for problem in validate_deck(json.loads(text)):
    print(problem.level, problem.path, problem.message)
```

An empty list means there is nothing to say. Unknown keys are
**warnings**: the format has grown by adding keys, older files carry
keys since retired, and a hand-edited deck with one stray field is
still basically fine.
