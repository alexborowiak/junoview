# The deck format

[← back to the README](README.md) · [architecture](ARCHITECTURE.md) · [how to write code here](AGENTS.md)

A deck is JSON. It travels in three places — a notebook's
`metadata.semantic.presentations`, a `<notebook>.deck.json` sidecar, or
the app's project file — and `junoview.notebook.presentations`
normalises all three into the one shape described here.

**Two functions, deliberately opposite.** `as_presentations` *coerces*
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
| `guides` | dict | The guides you drew on this page: {x, y} lists of line positions and `b` of [x, y, w, h] boxes, all in page percentages. An editing aid — never rendered in present mode or any export. |
| `head` | dict | Running header. |
| `hideTrace` | int | 1 when the code trail under the slide is suppressed in playback — the trail, the "Show code" pill and the scroll region all go. |
| `kind` | str | Only ever "view" — a saved filtered view of one notebook rather than a deck of slides. |
| `name` | str | What the deck is called. |
| `nb` | str | For a view: which notebook it is a view of. |
| `notes` | str | Whole-talk speaker notes (per-slide notes live on the slide). |
| `pad` | list | The scratchpad's notes. |
| `page` | str | Page-size preset id ("a4", "a0", "wide", …). |
| `pageBg` | str | The page's own background colour. |
| `masters` | dict | {id: {name, bg, cmp, pos}}: looks slides inherit live. `bg` is the wearers' background (the slide's own still wins), `cmp` names the component drawn behind their content, `pos` its corner. Membership is the slide's `mast` tag. |
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
| `lay` | str | The id of the slide template last applied; annotations hold its actual geometry. |
| `layout` | str | Which pane arrangement this slide uses. |
| `notes` | str | Speaker notes for this slide. |
| `opt` | int | 1 when this slide is optional — "Running late" in present mode skips it. |
| `panes` | list | One card anchor per pane, or null for an empty one. |
| `rord` | list | The authored reading order: annotation oids, first-to-last. Absent means automatic (top-to-bottom, left-to-right); objects the list does not name read last. |
| `mast` | str | Which master this slide wears — a look inherited live, never stamped. |
| `sec` | str | Which section this slide belongs to. |
| `sprops` | dict | Geometry and look of the subtitle text. |
| `sub` | str | Title-slide subheading. |
| `title` | str | Title-slide heading. |
| `tprops` | dict | Geometry and look of the title text. |
| `sid` | str | This slide's durable name, minted the first time the deck is rehearsed. Rehearsal times are keyed by it and live beside the deck, never inside it. |
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
| `chart` | `x`, `y` | A native chart: `ct` (bar/line/scatter/pie), `cats`, and `series` [{name, ys, color}] carry the numbers; `ref` links it to the table card it was born from. It exports as a real PowerPoint chart. |
| `text` | `x`, `y` | A text box. Auto-heights from its words, so it has no required h. |

### Fields any item may carry

Whatever its kind, an item may also carry these.

| key | type | what it means |
| --- | --- | --- |
| `hide` | int | 1 to leave this out **while editing** — scaffolding you do not want in the way. It is still drawn in playback and print. |
| `priv` | int | 1 when only you may see it: drawn on your own screen and in the presenter view, never for the audience and never in a PDF or a `.pptx`. Like speaker notes it is stored in the deck, so a deck file you hand over contains it. |
| `after` | Seconds this build waits after the one before it, running itself instead of waiting for a click. Absent means wait for the click. |
| `oid` | str | This object's durable name, used to follow it through its own history and to match it across slides for a "move" transition. |
| `crop` | dict | How this picture or figure is cropped. `t`/`r`/`b`/`l` trim each edge by a percentage; `shape` names one of the preset outlines, drawn **inside** the trim box so the same four handles move and size it; `path` is an outline you drew yourself, a list of `[x, y]` points in percent of the item's own box, which wins over both. The picture itself is never altered — a crop is a mask, so clearing it brings everything back. |
| `md` | int | 1 when this text box's words are Markdown source and what is drawn is that source rendered — headings, bullets, numbers, quotes, code, emphasis and links. Editing goes through the Markdown editor rather than the caret, because the face of the box is the output. |
| `maths` | int | 1 when this text box was built by the equation editor: its words are LaTeX between `$` or `$$` delimiters, typeset after every edit. |
| `lockar` | int | 1 to keep this item's shape while it is dragged by a resize handle: the other side follows, so a logo stays square and a plot keeps its proportions. The shape itself is not stored — it is read off the box when the drag begins — and holding Shift during a drag does the opposite of whatever this says. |
| `fbtn` | int | Flip books only: 1 to give the book one button per figure instead of the back/forward arrows, so any figure is one click away. A named frame names its button. |
| `name` | str | What to call this object in the Objects pane, in the Selection Pane of an exported `.pptx`, and anywhere else it has to be listed. Absent means the object is described by its kind and its content. |
| `link` | dict | What happens when this object is clicked while presenting. An **allow-listed action**, never a piece of script: `to` is either `"url"` with an `href` (http, https or mailto only) or `"slide"` with a `sid` — the target slide's durable name, so reordering the deck cannot break the link the way a slide *number* would. |
| `alt` | str | What this picture **shows**, for somebody who cannot see it: the image's alt text in every rendered page, and its description in an exported `.pptx`. A **caption** says what to think about the figure and everyone reads it; **alt text** says what is in it and is read instead of it. |
| `dec` | int | 1 when this picture carries no information — a rule, a texture, a logo already named in the words. It is then marked decorative and skipped by a screen reader, rather than announced as an unlabelled image. Empty alt text is how you set it, because "I have not written this yet" and "there is nothing to write" must not look the same. |

`alt` and `dec` are the two halves of one answer, and a picture with
neither is a picture nobody has decided about yet: it falls back to
whatever the object is already called, because "unlabelled image" helps
nobody.

`hide` and `priv` are deliberate opposites: one is hidden from **you**
while you work and shown to everyone afterwards, the other is shown to
you and hidden from everyone else.

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

## Editing a deck from Python

The public API is a live view over the file's JSON: it changes the same dicts
the editor reads, so fields added by a newer browser are not lost on save.
The numbered verbs are 1-based, like the numbers on screen; ordinary indexing
through `deck.slides` remains Python's usual zero-based indexing.

```python
from junoview import Deck, open_deck

deck = open_deck("talk.junoview.html", name="Conference talk")
deck.slide(3).figures["toe_map"].place(x=8, w=60)
deck.remove_slide(7)
problems = deck.save("talk.json")   # the explicit target chooses JSON

# Data already in memory uses the same live view.
view = Deck.from_json(deck.raw)
```

`save()` returns the validator's problems and writes unless `strict=True`
finds an error. An `.ipynb` target requires a deck opened from a notebook,
because this API does not invent notebook cells; an `.html` target requires
an existing Junoview HTML wrapper, because the wrapper belongs to the browser
exporter. Any other explicit suffix writes JSON. A suffixless target, or
`save()` with no new path, preserves the source form.

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
