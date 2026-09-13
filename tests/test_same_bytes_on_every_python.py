"""T393: the same page on every Python CI runs (3.10 and 3.13).

Two things differed by interpreter and turned a test job red on one
version but not the other:

- Python 3.12 (PEP 701) tokenizes an f-string as FSTRING_START, its
  pieces, FSTRING_END, so `{name}` inside one was highlighted as an
  operator and a name; 3.10 and 3.11 give one STRING. The highlighter now
  folds the run back into one string span, so the byte-for-byte pin in
  test_characterization.py holds on every version.
- Python 3.10's csv module refuses a line with a NUL byte in it; 3.11+
  reads through it. A .csv with a stray NUL opens everywhere now.
"""

from junoview.notebook.sources import doc_from_text
from junoview.render.highlight import highlight_python


def test_an_f_string_is_one_string_span():
    out = highlight_python('print(f"period {a!r:>{w}} {b}")\n')
    assert '<span class="st">f&quot;period {a!r:&gt;{w}} {b}&quot;</span>' in out
    # nothing inside the braces got its own colour
    assert out.count('<span class="op">') == 2       # the two parens only
    assert 'class="bn">print' in out


def test_nested_and_multiline_f_strings_fold_too():
    src = 'x = f"""a {f"{b}"} c\n{d}"""\ny = 1\n'
    out = highlight_python(src)
    q = "&quot;"
    assert (f'<span class="st">f{q}{q}{q}a {{f{q}{{b}}{q}}} c\n{{d}}{q}{q}{q}</span>'
            in out)
    assert '<span class="nu">1</span>' in out


def test_a_csv_with_a_nul_byte_still_opens():
    doc = doc_from_text("x.csv", "a,b\n1,\x002\n")
    html = doc.sections[0].items[0].outputs[0].payload
    assert "<td>1</td><td>2</td>" in html
    assert "\x00" not in html
