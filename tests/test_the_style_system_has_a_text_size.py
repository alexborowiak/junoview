"""T411: the Style system has a text size you can type.

The user, 2026-09-13: "Style systems does not have a text size
property in the tab. That was half the point of this :(" A named type
had a "Text size 26 pt" READOUT between − and + steppers; the
plain-text-boxes bucket ("Text boxes, all of them") had only a table,
and its Size cell was blank for every box that had not been sized by
hand, in a unit nothing else on the screen used.

Now: the table's bar has a Text size box in points, given to the
ticked rows or to every row when none is ticked; a Size cell reads and
writes points and shows the size a box actually gets when it says
nothing itself; and the named type's readout is a box you can type
in.
"""

from __future__ import annotations


def test_the_table_bar_has_a_size_for_all_of_them(out):
    assert ("    var isTx=!dgIsObj()||dgObjKind()==='text';\n"
            "    if(isTx&&rows.length){") in out
    assert "      szl.textContent='Text size';szw.appendChild(szl);" in out
    assert "      szi.type='number';szi.className='dgt-n dgt-szin';" in out
    assert "        var to=marked.length?marked:rows;" in out
    assert ("        to.forEach(function(r){r.a.size=Math.round(pt/5.4*100)/100;});"
            ) in out
    assert "      szb.className='dbtn dg-b';szb.textContent='Set';" in out
    assert "        if(e.key==='Enter'){e.preventDefault();setSize();}" in out


def test_the_size_cell_speaks_points_and_shows_the_effective_size(out):
    assert "  function dgNum(r,key,step,pt){" in out
    assert "      inp.value=(v0!=null)?Math.round(v0*5.4):'';" in out
    assert "      var eff=(st&&st.size)||(r.a.k==='table'?2.2:2.6);" in out
    assert "      inp.placeholder=String(Math.round(eff*5.4));" in out
    assert ("      else r.a[key]=pt?Math.round(v/5.4*100)/100"
            ":Math.round(v*10)/10;") in out
    assert ("        cell(dgNum(r,'size','1',true),'dgt-num');"
            "   /* T411: in pt */") in out
    # the other number cells are untouched
    assert "      cell(dgNum(r,'x'),'dgt-num');" in out


def test_a_named_type_s_size_is_typed_not_read(out):
    assert "    szIn.type='number';szIn.className='dgt-n dg-sizein';" in out
    assert "    szIn.value=String(Math.round(typePct*5.4));" in out
    assert ("      rec.size=Math.max(0.6,Math.min(30,Math.round(pt/5.4*100)/100));"
            ) in out
    assert "sz.textContent='Text size '+Math.round(typePct*5.4)+' pt';" not in out
