"""The strip stops fighting you, and history reads as a table (T228/T229).

The user, 2026-09-03: "So idk why the thumbnails only view for a slide
has the title still, also when you hover over a slide it brings up all
the options around moving and duplicating. These are not needed here as
you can just do that with other buttons or click and drag and just make
it really hard to actually click on a slide. Also the slide numbers are
way too small... The history is kind of weird. Make it when a list that
are all rows, and columns are some of the info. 'Put it back to this'
should be revert lol. Then there should be a preview if it is small,
says a shape, or a preview button if it is something large like a
table... Put the notes with the home next to layers. I like the notes.
Also make the time not just in 30 second intervals, but can be seconds
and minutes... Where is the clone object features as well and then the
ability to see the clones... How are slides made optional?"
"""

from __future__ import annotations

from junoview import assets


def test_a_slide_row_is_a_slide_not_a_toolbar(out):
    """Four buttons appeared over every thumbnail on hover, on top of the
    thing you were trying to click. Reordering is the drag the row
    already is; Duplicate and Delete are on Home; and the right-click
    menu keeps every one of them, move and rename included."""
    assert "      var ctr=document.createElement('span');ctr.className='film-ctr';" \
        not in out
    assert "      row.appendChild(ctr);\n      list.appendChild(row);" not in out
    # the menu is where they went
    assert "    row('Move it up',function(){moveSlide(i,-1);},null,'prev');" in out
    assert "    row('Move it down',function(){moveSlide(i,1);},null,'next');" in out
    assert "    row('Duplicate',function(){dupSlide(i);},null,'copy');" in out
    assert "row('Rename this version" in out
    # the section rows keep their own controls
    assert ".film-sec:hover .film-ctr{display:flex;}" in out


def test_thumbnails_view_shows_thumbnails(out):
    assert '#film-list[data-fv="thumb"] .film-t{display:none;}' in out
    # ...except the current slide, whose row is the inline editor
    assert ('#film-list[data-fv="thumb"] .film-row.current .film-t'
            '{display:block;}') in out


def test_a_slide_number_can_be_read(out):
    assert (".film-label .film-n{font-family:var(--mono);font-size:12.5px;\n"
            "  color:#8ea3b5;width:22px;flex:none;text-align:right;}") in out


def test_notes_and_optional_have_doors(out):
    html = assets.deck_html()
    assert 'id="hm-notes"' in html and 'id="hm-optional"' in html
    assert "<span>Notes</span></button>" in html
    # Notes sits beside Layers, on the tab you build from
    i, j = html.index('id="hm-notes"'), html.index('id="hm-layers"')
    assert i < j
    assert "  function homeDoorsBoot(){" in out
    assert "  homeDoorsBoot();" in out
    assert "      e.stopPropagation();toggleOptional(cur);syncHomeDoors();" in out
    assert "  function syncHomeDoors(){" in out


def test_a_target_can_be_given_in_seconds(out):
    """It was one field stepping in halves of a minute, so two and a half
    minutes was the finest thing you could ask for."""
    html = assets.deck_html()
    assert 'id="np-goalsec"' in html
    assert '<span class="np-unit">min</span>' in html
    assert '<span class="np-unit">sec</span>' in html
    assert 'step="0.5"' not in html.split('id="np-goal"')[1][:200]
    # both boxes write the one stored number, still in minutes
    assert "    function goalWrite(){" in out
    assert "      var v=Math.round((m+sec/60)*1000)/1000;" in out
    # ...and typing does not redraw the boxes under the caret
    assert "      gi.addEventListener('input',goalWrite);" in out


def test_the_history_is_a_table(out):
    assert "head.className='oh-head';" in out
    assert "    ['When','What changed','Looked like',''].forEach(function(t){" in out
    assert "        b.className='dbtn oh-do';b.textContent='Revert';" in out
    assert "Put it back to this" not in out
    # small draws itself; big is a button
    assert "  function ohIsBig(a){" in out
    assert "    if(a.k==='table'||a.k==='cell'||a.k==='flip'||a.k==='chart')" in out
    assert "    return ((a.w||0)*(a.h||0))>=1200;" in out
    assert "      } else look.appendChild(ohThumb(e.a));" in out
    assert "          pb.textContent=open?'Hide':'Preview';" in out
    assert ".oh-head,.oh-row{display:grid;" in out


def test_clones_have_two_doors(out):
    """Both were rows inside the Layers pane's Actions popover -- a menu,
    in a pane, behind a button."""
    html = assets.deck_html()
    assert 'id="fmt-cmp-make"' in html and 'id="fmt-cmp-find"' in html
    assert "Make clones&#8230;</button>" in html
    assert "  function cloneDoorsBoot(){" in out
    assert "  cloneDoorsBoot();" in out
    assert "      var id=cmpDefine(nm,idxs);" in out
    assert "      if(a2&&a2.cmp) cmpInstMenu(a2.cmp,fd);" in out
    # the count is on the button, so you know there are any
    assert "      cf.innerHTML=bic('locate')+' Its clones ('+cn+')';" in out
    assert "    show('#fmt-cmp-make',isNum&&selCount>=1&&!cmpOn);" in out
    assert "    show('#fmt-cmp-find',cmpOn);" in out
