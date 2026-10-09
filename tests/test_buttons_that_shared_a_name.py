"""T530: buttons that shared a name stop sharing it.

The 2026-09-29 audit, then read live at 1440x900:

- Table's four buttons read "Row, Row, Column, Column" -- add and remove
  told apart only by a 12px icon. They say Add row, Remove row, Add
  column, Remove column; the column-types door beside them says Column
  types rather than a fifth "Columns".
- Arrange's "Left / Right" meant ROTATE a group away from Paragraph's
  "Left / Right" that mean ALIGN; its "Row / Grid" sat under the table's
  Row. They say Rotate left / right and In a row / In a grid.
- Home's "Main" had no verb: it MAKES a version the main one. It says
  Make main, and Main version on the main one.
- Object's History tile opened this OBJECT's history, beside Home's
  History of the deck: it says Object history.
- A text box's colour doors read "Text / Fill": Text colour and Box
  colour now (a shape's already said Border colour / Fill colour, T467).
- The figure-part pills read "figure / code / split" in lower-case mono
  beside sans buttons: Figure, Code and Split in two, with icons.
- The Source cell elided a path in the middle and then cut it at 170px,
  so it read "C:/Users/rvgp59.../example_cli...". The file's name is
  first now, its folder quieter beneath; the whole path stays on hover
  and the cell stays the first thing on the tab (T438).
"""

from __future__ import annotations


def test_the_table_buttons_say_their_verb(out):
    for bid, words in (("fmt-tbl-rowplus", "Add row"),
                       ("fmt-tbl-rowminus", "Remove row"),
                       ("fmt-tbl-colplus", "Add column"),
                       ("fmt-tbl-colminus", "Remove column")):
        btn = out.split(f'id="{bid}"')[1].split("</button>")[0]
        assert btn.rstrip().endswith(words), bid
    assert out.split('id="fmt-table"')[1].split("</button>")[0] \
        .rstrip().endswith("Column types")


def test_rotate_and_arrange_say_what_they_do(out):
    for bid, words in (("fmt-rotl", "Rotate left"),
                       ("fmt-rotr", "Rotate right"),
                       ("fmt-arline", "In a row"),
                       ("fmt-argrid", "In a grid")):
        btn = out.split(f'id="{bid}"')[1].split("</button>")[0]
        assert btn.rstrip().endswith(words), bid


def test_main_object_history_and_the_colour_doors(out):
    assert "var stLab=bic('star')+' '+(isA?'Make main':'Main version');" \
        in out
    assert "<span>Object history</span></button>" in out
    assert "((isText||kind==='cell')?'Text colour ▾'" in out
    assert "((kind==='rect')?'Fill colour ▾':'Box colour ▾')" in out


def test_the_part_pills_are_words_and_icons(out):
    fn = out.split("  function buildPartChooser(s,ai){")[1].split("\n  }\n")[0]
    assert "var PART_IC={figure:'plots',code:'code',output:'output'};" in fn
    assert "+esc(fp.charAt(0).toUpperCase()+fp.slice(1));" in fn
    assert "sp.innerHTML=bic('outline')+' Split in two';" in fn
    assert "#fmt-parts .cellpartbtn{font-family:var(--sans);font-size:12px;" \
        in out


def test_the_source_cell_leads_with_the_file_name(out):
    assert "pth.innerHTML='<span>From</span><span><b></b><i></i></span>';" \
        in out
    assert "pth.querySelector('b').textContent=fbase;" in out
    assert "pth.title='From '+from;" in out
    assert ".fmt-path i{display:block;max-width:170px;" in out
