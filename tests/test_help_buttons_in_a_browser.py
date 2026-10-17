"""The "?" buttons, driven in Chromium (T624).

Opt-in like every Chromium check: set ``JUNOVIEW_BROWSER_TESTS=1``. The
fast half (where a "?" may go, that each one is a real disclosure, the
component's keys and aria in node) is tests/test_help_buttons.py.

Every surface that holds a "?" (T624 section 2.9) is opened by its own
door, at the two laptop sizes the plan is held to (1366x657 and
1280x600), in the light and the dark scheme, and its "?" must:

- open a popover that is wholly inside the window;
- toggle on Enter and Space, with aria-expanded following;
- close on Escape ALONE -- the host menu, pane or dialog stays, the
  editor stays up, and the keys go back to the "?" -- after which a
  second Escape closes a host that Escape closes;
- close on a click elsewhere in the host without closing the host;
- take no click meant for a control beside it (its hit halo is a
  positioned ::after, which paints over a plain button next to it --
  Images' "Every slide" lost two thirds of its left edge to it);
- read at 3:1 or better against its host at rest (it inherits the
  host's ink and dims it: three muted hosts fell to about 2:1).

And, once: a second "?" closes the first (the custom view bar and the
outline's colour key are both on screen there), and a dialog's open "?"
leaves the ribbon's fit exactly as it was.

Two are not reached here, and say why: the Quick animate "?" (Q22) waits
for T625's animation work (plan section 7.3), and the Check consistency
PANE's (#stdpane) has had no door since T209 -- its full-screen view,
with the same words, is driven instead. The two questions that need a
live talk (Keep your ink?, Keep the narration?) are asked through the
same dialog with their own words; that their callers pass `help` is
pinned in tests/test_help_buttons.py.

THE TEXT GUARD (test_no_wall_of_text_outside_a_help_button): the main
surfaces at 1366x657 are read for visible text, and no block may carry
more than WORDS_PER_BLOCK words outside a "?" popover. 30 words is about
two lines of a dialog: room for a heading, a one-line note or a short
empty state, and too little for the paragraphs the user asked to be
moved behind a "?" (2026-10-11). What the user writes (notebooks,
slides, notes), the Help dialog and the review's markdown text are the
content itself and are not counted.
"""

from __future__ import annotations

import json
import os
import threading
from http.server import ThreadingHTTPServer
from pathlib import Path

import pytest

from junoview.notebook.loader import load_doc
from junoview.render.page import render_page

ROOT = Path(__file__).resolve().parent.parent
EXAMPLE = ROOT / "examples" / "example_climate_analysis.ipynb"
SIZES = ((1366, 657), (1280, 600))
SCHEMES = ("dark", "light")
WORDS_PER_BLOCK = 30


def _need_browser():
    if os.environ.get("JUNOVIEW_BROWSER_TESTS") != "1":
        pytest.skip("set JUNOVIEW_BROWSER_TESTS=1 for the Chromium checks")
    pytest.importorskip("playwright.sync_api")


@pytest.fixture(scope="module")
def browser():
    _need_browser()
    from playwright.sync_api import sync_playwright
    pw = sync_playwright().start()
    try:
        try:
            b = pw.chromium.launch()
        except Exception as e:  # noqa: BLE001
            pytest.skip(f"Chromium will not launch here: {e}")
        yield b
        b.close()
    finally:
        pw.stop()


@pytest.fixture(scope="module")
def page_file(tmp_path_factory):
    _need_browser()
    doc = load_doc(EXAMPLE)
    doc.source_name = "example_climate_analysis"
    p = tmp_path_factory.mktemp("q") / "page.html"
    p.write_text(render_page([doc]), encoding="utf-8")
    return p


def _deck(pg) -> str:
    ref = pg.evaluate(
        "(()=>{const c=[...document.querySelectorAll('.nbshell .card"
        "[data-anchor]')].find(c=>c.dataset.kind==='figure');"
        "const s=(window.SemApp&&window.SemApp.active)||'';"
        "return c?(s+'::'+c.dataset.anchor):null})()")
    an = [{"k": "text", "x": 6, "y": 5, "w": 60, "text": "A heading",
           "size": 4, "style": "h1"},
          {"k": "text", "x": 6, "y": 18, "w": 40, "text": "Some words"},
          {"k": "rect", "x": 70, "y": 60, "w": 20, "h": 20},
          # a live page: the .pptx export has something to ask about
          {"k": "web", "x": 60, "y": 10, "w": 30, "h": 30,
           "url": "https://example.org/"}]
    if ref:
        an.append({"k": "cell", "x": 6, "y": 30, "w": 50, "h": 55,
                   "ref": ref})
    return json.dumps({"name": "help-walk", "slides": [
        {"layout": "blank", "annots": an},
        {"layout": "blank", "annots": [dict(an[0], text="Two")]}]})


def _open(browser, page_file, w, h, scheme, editor=True):
    ctx = browser.new_context(viewport={"width": w, "height": h})
    ctx.add_init_script(
        "try{localStorage.setItem('plotline-tour','1');"
        "localStorage.setItem('plotline-tour-editor','1');"
        f"localStorage.setItem('plotline-scheme','{scheme}');"
        "}catch(e){}")
    ctx.route("https://**", lambda rt: rt.fulfill(status=404, body=""))
    pg = ctx.new_page()
    errors: list[str] = []
    pg.on("pageerror", lambda e: errors.append(
        str(e) + " :: " + str(getattr(e, "stack", ""))[:600]))
    pg.goto(page_file.as_uri())
    pg.wait_for_selector(".nbshell .card")
    if editor:
        pg.evaluate("window.SemApp.deckLoad&&window.SemApp.deckLoad()")
        pg.wait_for_function("!!window.SemDeckImport")
        pg.evaluate("t=>window.SemDeckImport(t,false)", _deck(pg))
        pg.wait_for_function(
            "document.body.classList.contains('slide-editing')")
        pg.wait_for_timeout(400)
    return ctx, pg, errors


def _visible(pg, sel: str) -> bool:
    return pg.evaluate(
        "s=>{const e=document.querySelector(s);"
        "return !!(e&&e.getClientRects().length&&!e.closest('[hidden]'))}",
        sel)


def _q_state(pg, qsel: str) -> dict:
    return pg.evaluate("""s=>{
      const q=[...document.querySelectorAll(s)].find(e=>e.getClientRects().length);
      if(!q) return null;
      const pops=[...document.querySelectorAll('.jv-qpop')];
      const p=pops[0]||null;let r=null;
      if(p){const b=p.getBoundingClientRect();
        r=[b.left,b.top,b.right,b.bottom];}
      return {exp:q.getAttribute('aria-expanded'),
        ctl:q.getAttribute('aria-controls'),pops:pops.length,
        popId:p&&p.id,next:!!(p&&q.nextElementSibling===p),rect:r,
        chars:p?p.textContent.trim().length:0,
        focus:document.activeElement===q,
        label:q.getAttribute('aria-label')};}""", qsel)


def _q_center(pg, qsel: str):
    return pg.evaluate("""s=>{
      const q=[...document.querySelectorAll(s)].find(e=>e.getClientRects().length);
      const r=q.getBoundingClientRect();return [r.x+r.width/2,r.y+r.height/2];}""",
                       qsel)


def _click_at(pg, sel: str):
    """A plain click on the visible part of `sel` no popover covers."""
    pt = pg.evaluate("""s=>{
      const e=[...document.querySelectorAll(s)].find(x=>x.getClientRects().length);
      if(!e) return null;const r=e.getBoundingClientRect();
      const pop=document.querySelector('.jv-qpop');
      const pr=pop?pop.getBoundingClientRect():null;
      const pts=[[r.left+4,r.top+r.height/2],[r.left+r.width/2,r.top+4],
                 [r.right-4,r.top+r.height/2],[r.left+r.width/2,r.bottom-4]];
      for(const p of pts){
        if(pr&&p[0]>=pr.left&&p[0]<=pr.right&&p[1]>=pr.top&&p[1]<=pr.bottom)
          continue;
        const hit=document.elementFromPoint(p[0],p[1]);
        if(hit&&(hit===e||e.contains(hit))&&!hit.closest('.jv-q,button,a,input'))
          return p;
      }
      return null;}""", sel)
    assert pt, f"no clear spot on {sel} to click"
    pg.mouse.click(pt[0], pt[1])
    pg.wait_for_timeout(120)


# every pixel of a neighbouring control that the "?"'s halo takes: hit
# the "?" with its ::after on, and that control with it off
HALO_STEALS = r"""sel=>{
  const q=[...document.querySelectorAll(sel)].find(e=>e.getClientRects().length);
  const r=q.getBoundingClientRect(),hits=[];
  for(const el of document.querySelectorAll(
      'button,a,input,select,textarea,label,[role=button]')){
    if(el===q||q.contains(el)||!el.getClientRects().length) continue;
    const e=el.getBoundingClientRect();
    const l=Math.max(r.left-4,e.left),t=Math.max(r.top-4,e.top),
      rr=Math.min(r.right+4,e.right),b=Math.min(r.bottom+4,e.bottom);
    if(rr<=l||b<=t) continue;
    for(let x=l+0.5;x<rr;x+=1) for(let y=t+0.5;y<b;y+=1){
      if(x>=r.left&&x<=r.right&&y>=r.top&&y<=r.bottom) continue;
      if(document.elementFromPoint(x,y)===q) hits.push([el,x,y]);
    }
  }
  if(!hits.length) return {};
  const st=document.createElement('style');
  st.textContent='button.jv-q::after{display:none!important}';
  document.head.appendChild(st);
  const out={};
  for(const [el,x,y] of hits){
    const h=document.elementFromPoint(x,y);
    if(h&&(h===el||el.contains(h))){
      const k=el.id||el.tagName+'.'+String(el.className).split(' ')[0];
      out[k]=(out[k]||0)+1;}
  }
  st.remove();
  return out;}"""

# the "?"'s glyph against what is behind it, at rest: its colour blended
# by its opacity (and its ancestors') over the host's composited background
Q_CONTRAST = r"""sel=>{
  const q=[...document.querySelectorAll(sel)].find(e=>e.getClientRects().length);
  const parse=c=>{const m=String(c).match(/rgba?\(([^)]+)\)/);if(!m) return null;
    const p=m[1].split(/[ ,\/]+/).filter(Boolean).map(Number);
    return [p[0],p[1],p[2],p.length>3?p[3]:1];};
  const stack=[];
  for(let e=q.parentElement;e;e=e.parentElement){
    const c=parse(getComputedStyle(e).backgroundColor);
    if(c&&c[3]>0){stack.push(c);if(c[3]>=1) break;}}
  let bg=[255,255,255];
  for(let i=stack.length-1;i>=0;i--){const c=stack[i];
    bg=bg.map((v,j)=>v*(1-c[3])+c[j]*c[3]);}
  let o=1;for(let e=q;e;e=e.parentElement) o*=+getComputedStyle(e).opacity;
  const c=parse(getComputedStyle(q).color);o*=c[3];
  const fg=bg.map((v,j)=>v*(1-o)+c[j]*o);
  const lum=a=>{const s=a.map(v=>{v/=255;
    return v<=0.03928?v/12.92:Math.pow((v+0.055)/1.055,2.4)});
    return 0.2126*s[0]+0.7152*s[1]+0.0722*s[2];};
  const x=lum(fg),y=lum(bg);
  return (Math.max(x,y)+0.05)/(Math.min(x,y)+0.05);}"""


def _check_q(pg, name, qsel, host, outside, w, h, esc_host, editor=True):
    """The plan's six behaviours, for one "?"."""
    pg.wait_for_timeout(250)
    # a host still placing itself (a dialog sizing to its preview) has
    # not settled where its "?" is: wait until it has
    last = None
    for _ in range(20):
        now = pg.evaluate(
            "s=>{const q=[...document.querySelectorAll(s)]"
            ".find(e=>e.getClientRects().length);if(!q) return null;"
            "const r=q.getBoundingClientRect();return [r.x,r.y]}", qsel)
        if now is not None and now == last:
            break
        last = now
        pg.wait_for_timeout(100)
    assert _visible(pg, host), f"{name}: host {host} did not open"
    st = _q_state(pg, qsel)
    assert st, f"{name}: no visible {qsel}"
    assert st["exp"] == "false" and st["pops"] == 0, (name, st)
    assert st["label"].startswith("Help"), (name, st)
    # its halo takes no click meant for the control beside it
    stolen = pg.evaluate(HALO_STEALS, qsel)
    assert not stolen, (name, w, h, "the '?' takes clicks from", stolen)
    # and it is legible at rest (pointer off it: hover undims it)
    pg.mouse.move(0, 0)
    ratio = pg.evaluate(Q_CONTRAST, qsel)
    assert ratio >= 3, (name, w, h, f"the '?' at rest is {ratio:.2f}:1")
    # a click opens it, after its button, on screen
    x, y = _q_center(pg, qsel)
    pg.mouse.click(x, y)
    pg.wait_for_timeout(150)
    st = _q_state(pg, qsel)
    assert st["exp"] == "true" and st["pops"] == 1, (name, st)
    assert st["ctl"] == st["popId"] and st["next"], (name, st)
    lft, top, rgt, bot = st["rect"]
    assert lft >= 0 and top >= 0 and rgt <= w and bot <= h, (name, w, h, st)
    assert st["chars"] > 15, (name, st)
    assert _visible(pg, host), f"{name}: the host closed under its own '?'"
    # Escape closes it alone, and the keys go back to the "?"
    pg.keyboard.press("Escape")
    pg.wait_for_timeout(150)
    st = _q_state(pg, qsel)
    assert st["exp"] == "false" and st["pops"] == 0, (name, st)
    assert st["focus"], (name, "focus did not return to the '?'")
    assert _visible(pg, host), f"{name}: Escape closed the host too"
    if editor:
        assert pg.evaluate("document.body.classList.contains('slide-editing')"
                           "||!document.getElementById('deck').hidden"), \
            f"{name}: Escape left the editor"
    # Enter and Space toggle it (focus is on it now)
    pg.keyboard.press("Enter")
    pg.wait_for_timeout(120)
    assert _q_state(pg, qsel)["exp"] == "true", (name, "Enter")
    pg.keyboard.press(" ")
    pg.wait_for_timeout(120)
    st = _q_state(pg, qsel)
    assert st["exp"] == "false" and st["pops"] == 0, (name, "Space", st)
    # a click elsewhere closes it and leaves the host
    pg.mouse.click(x, y)
    pg.wait_for_timeout(120)
    assert _q_state(pg, qsel)["pops"] == 1, (name, "reopen")
    _click_at(pg, outside)
    st = _q_state(pg, qsel)
    assert st["pops"] == 0 and st["exp"] == "false", (name, "outside", st)
    assert _visible(pg, host), f"{name}: an outside click closed the host"
    # and then a second Escape closes a host that Escape closes
    if esc_host:
        pg.mouse.click(x, y)
        pg.wait_for_timeout(120)
        pg.keyboard.press("Escape")
        pg.wait_for_timeout(120)
        assert _visible(pg, host), f"{name}: first Escape closed the host"
        pg.keyboard.press("Escape")
        pg.wait_for_timeout(250)
        assert not _visible(pg, host), f"{name}: second Escape left the host"


def _js_click(pg, sel):
    pg.evaluate("s=>{const b=document.querySelector(s);b.click();}", sel)
    pg.wait_for_timeout(300)


def _close_all(pg):
    pg.evaluate("""()=>{
      if(window.SemApp&&window.SemApp.deckOverlayCloseAll)
        window.SemApp.deckOverlayCloseAll();
      document.querySelectorAll('#ask-dlg,#nt-dlg,#ar-dlg,#ms-dlg,#md-dlg,'
        +'#eq-dlg').forEach(d=>{const c=d.querySelector('[id$="-cancel"],'
        +'[id$="-close"]');if(!d.hidden&&c) c.click();});
      ['#deck-history','#deck-design','#deck-review','#deck-parts']
        .forEach(s=>{const e=document.querySelector(s);if(e){
          const c=e.querySelector('#dh-close,#dg-close,#rv-close,'
            +'.prt-head .dbtn:last-child');if(c) c.click();}});
      const g=document.getElementById('rbn-gal-close');
      if(g&&g.getClientRects().length) g.click();
      ['#imgpane-close','#reviewpane-close','#talkpane-close']
        .forEach(s=>{const c=document.querySelector(s);
          if(c&&c.getClientRects().length) c.click();});
    }""")
    pg.wait_for_timeout(250)


def _review_btn(pg, word):
    _js_click(pg, "#vw-check")
    pg.evaluate("""w=>{const b=[...document.querySelectorAll('.rv-cat-open')]
      .find(b=>b.textContent.indexOf(w)>=0);b.click();}""", word)
    pg.wait_for_timeout(300)


# name, how it opens, "?" selector, host, a spot in the host, Escape closes it
EDITOR = (
    ("Q1 New presentation",
     lambda pg: pg.evaluate("window.SemApp.deckNew()"),
     "#nt-dlg .jv-q", "#nt-dlg", "#nt-title", True),
    ("Q6 History", lambda pg: _js_click(pg, "#hm-history"),
     "#deck-history .dh-head .jv-q", "#deck-history",
     "#deck-history .dh-t", True),
    ("Q7 Images", lambda pg: _js_click(pg, "#hm-images"),
     "#imgpane .jv-q", "#imgpane", "#imgpane .selpane-h>span", False),
    ("Q8 Check consistency", lambda pg: _js_click(pg, "#dsg-std"),
     "#std-ov .jv-q", "#std-ov", "#std-ov .img-ov-t", True),
    ("Q9 Tidy page", lambda pg: _review_btn(pg, "Tidy page"),
     "#tidy-ov .jv-q", "#tidy-ov", "#tidy-ov .img-ov-t", True),
    ("Q10 Before you print", lambda pg: _review_btn(pg, "Before you print"),
     "#pf-ov .jv-q", "#pf-ov", "#pf-ov .img-ov-t", True),
    ("Q11 Saved layouts", lambda pg: pg.evaluate("window.SemDeckArrange()"),
     "#ar-dlg .aa-head .jv-q", "#ar-dlg", "#ar-dlg .aa-head .eq-t", True),
    ("Q12 Slide master", lambda pg: pg.evaluate("window.SemDeckMasters()"),
     "#mast-panel .jv-q", "#mast-panel", "#mast-panel .hd-lab", True),
    ("Q13 Copy layout to slides",
     lambda pg: pg.evaluate("window.SemDeckMatchMany()"),
     "#ms-dlg .jv-q", "#ms-dlg", "#ms-dlg .aa-head .eq-t", True),
    ("Q14 Header", lambda pg: _js_click(pg, "#dc-head"),
     "#ask-q", "#ask-dlg", "#ask-t", True),
    ("Q15 Deck colours", lambda pg: _js_click(pg, "#dsg-tokens"),
     "#tok-pop .jv-q", "#tok-pop", "#tok-pop .tok-preview", True),
    ("Q16 Markdown", lambda pg: pg.evaluate("window.SemDeckMarkdown()"),
     "#md-dlg .md-help .jv-q", "#md-dlg", "#md-dlg .md-help", True),
    ("Q17 Style system", lambda pg: pg.evaluate("window.SemDeckDesign()"),
     "#deck-design .dh-head .jv-q", "#deck-design", "#deck-design .dh-t",
     True),
    ("Q18 Export .pptx?", lambda pg: _js_click(pg, "#mi-pptx"),
     "#ask-q", "#ask-dlg", "#ask-what", True),
    ("Q19 Export for review", lambda pg: _js_click(pg, "#mi-review"),
     "#deck-review .rv-head .jv-q", "#deck-review", "#deck-review .rv-t",
     True),
    ("Q20 Parts", lambda pg: _js_click(pg, "#mi-parts"),
     "#deck-parts .prt-head .jv-q", "#deck-parts", "#prt-title", True),
    ("Q21 Ribbon layouts", lambda pg: _js_click(pg, "#rbn-layouts"),
     "#rbn-gallery .jv-q", "#rbn-gallery", "#rbn-gallery .rbn-gt", True),
    ("Q24 Keep your ink?",
     lambda pg: pg.evaluate("""window.SemDeckAsk({yes:true,
       title:'Keep your ink?',what:'1 stroke on 1 slide',
       help:'Kept, each stroke becomes a drawing on its slide that you can '
         +'move, recolour or delete. Ctrl+Z takes them all back off.',
       ok:'Keep ink',cancel:'Discard'},function(){})"""),
     "#ask-q", "#ask-dlg", "#ask-what", True),
    ("Q25 Keep the narration?",
     lambda pg: pg.evaluate("""window.SemDeckAsk({yes:true,
       title:'Keep the narration?',what:'2 slides, 0:10',
       help:'Kept, each slide speaks when it comes up in the show, and the '
         +'recording travels with the deck. Ctrl+Z takes it all back off.',
       ok:'Keep narration',alt:'Discard'},function(){})"""),
     "#ask-q", "#ask-dlg", "#ask-what", True),
)


@pytest.mark.parametrize("scheme", SCHEMES)
@pytest.mark.parametrize("w,h", SIZES)
def test_every_editor_help_button(browser, page_file, w, h, scheme):
    ctx, pg, errors = _open(browser, page_file, w, h, scheme)
    try:
        for name, opener, qsel, host, outside, esc in EDITOR:
            opener(pg)
            _check_q(pg, name, qsel, host, outside, w, h, esc)
            _close_all(pg)
        # Q2: the save-where prompt a new presentation asks once
        pg.evaluate("window.SemApp.deckNew()")
        pg.wait_for_timeout(300)
        _js_click(pg, "#nt-blank")
        pg.wait_for_timeout(500)
        assert _visible(pg, ".save-ask"), "no save-where prompt"
        _check_q(pg, "Q2 Save where", ".save-ask .jv-q", ".save-ask",
                 ".save-ask .hd-lab", w, h, False)
        _close_all(pg)
        # Q23: the talk pane, in the show
        _js_click(pg, "#dc-play")
        pg.wait_for_timeout(600)
        pg.evaluate("window.SemDeckTalk&&window.SemDeckTalk.open(true)")
        _check_q(pg, "Q23 This talk", "#talkpane .jv-q", "#talkpane",
                 "#talkpane .tk-h>span", w, h, False, editor=False)
        # every control in the pane is wholly inside it, on one line (at
        # 266px fixed, the Ink row's Eraser ran out past the pane's edge)
        out = pg.evaluate("""()=>{const p=document.getElementById('talkpane');
          const r=p.getBoundingClientRect();
          return [...p.querySelectorAll('button')]
            .filter(b=>b.getClientRects().length).filter(b=>{
              const q=b.getBoundingClientRect();
              return q.left<r.left||q.right>r.right+0.5||q.height>40;})
            .map(b=>b.id||b.textContent.trim());}""")
        assert not out, (w, h, scheme, out)
        assert not errors, errors
    finally:
        ctx.close()


@pytest.mark.parametrize("scheme", SCHEMES)
@pytest.mark.parametrize("w,h", SIZES)
def test_the_reader_help_buttons(browser, page_file, w, h, scheme):
    ctx, pg, errors = _open(browser, page_file, w, h, scheme, editor=False)
    try:
        # Q4: the outline's colour key -- a cloned template, not text.
        # The outline is the View tab's Outline toggle away.
        if not pg.evaluate("document.body.classList.contains('tocshow')"):
            _js_click(pg, "#menubtn")
        _check_q(pg, "Q4 colour key", ".nbshell .railhead>.jv-q",
                 ".nbshell .railhead", ".nbshell .railhead", w, h, False,
                 editor=False)
        pg.click(".nbshell .railhead>.jv-q")
        assert pg.evaluate(
            "document.querySelector('.jv-qpop .navkey .nk')!==null")
        pg.keyboard.press("Escape")
        # Q3: the custom view bar, made from the reader
        pg.evaluate("window.SemApp.deckLoad&&window.SemApp.deckLoad()")
        pg.wait_for_function("!!window.SemDeckImport")
        _js_click(pg, "#pr-newview")
        pg.wait_for_selector("#stylebar:not([hidden])")
        _check_q(pg, "Q3 Custom view", "#stylebar .jv-q", "#stylebar",
                 "#sb-name", w, h, False, editor=False)
        # a second "?" closes the first (by the keyboard: the first one's
        # popover may lie over the second)
        pg.click("#stylebar .jv-q")
        pg.wait_for_timeout(120)
        pg.evaluate("[...document.querySelectorAll('.railhead>.jv-q')]"
                    ".find(e=>e.getClientRects().length).focus()")
        pg.keyboard.press("Enter")
        pg.wait_for_timeout(150)
        assert pg.evaluate("[...document.querySelectorAll('.railhead>.jv-q')]"
                           ".find(e=>e.getClientRects().length)"
                           ".getAttribute('aria-expanded')") == "true"
        assert pg.evaluate("document.querySelectorAll('.jv-qpop').length") == 1
        assert pg.evaluate("document.querySelector('#stylebar .jv-q')"
                           ".getAttribute('aria-expanded')") == "false"
        pg.keyboard.press("Escape")
        # (at 27be2a9 already: a custom view being edited sends its idle
        # layout save through the deck's markDirty, whose slide code has
        # no slides to read -- sizeSubject throws. Not T624's; reported.)
        errors = [e for e in errors if "syncStylingView" not in e]
        assert not errors, errors
    finally:
        ctx.close()


def test_a_dialogs_help_leaves_the_ribbon_fit_alone(browser, page_file):
    for w, h in SIZES:
        ctx, pg, _errors = _open(browser, page_file, w, h, "dark")
        try:
            fit = ("(()=>{const b=document.getElementById('edit-tools');"
                   "const r=b.getBoundingClientRect();"
                   "return [Math.round(r.height),b.scrollWidth<=b.clientWidth+1,"
                   "b.className]})()")
            before = pg.evaluate(fit)
            assert before[1], ("the ribbon is clipped before anything opens",
                               w, before)
            _js_click(pg, "#dc-head")
            pg.click("#ask-q")
            pg.wait_for_timeout(300)
            assert pg.evaluate("document.querySelectorAll('.jv-qpop').length") == 1
            assert pg.evaluate(fit) == before, (w, h)
            pg.keyboard.press("Escape")
            pg.keyboard.press("Escape")
        finally:
            ctx.close()


def test_the_version_history_help_in_the_app(browser, tmp_path):
    """Q5 is the app's: a notebook opened with the app has no snapshot
    until it is reloaded, so its Version history says "No history yet"
    -- with the "?" beside it. Both schemes: it was the light one whose
    "?" read at 2.28:1 (T624 review)."""
    from junoview.server.routes import _make_handler
    from junoview.server.state import _PROJECT_FILE, _AppState
    nb = tmp_path / EXAMPLE.name
    nb.write_bytes(EXAMPLE.read_bytes())
    (tmp_path / _PROJECT_FILE).write_text(json.dumps(
        {"presentations": [], "open": [str(nb)], "recent": [str(nb)]}),
        encoding="utf-8")
    st = _AppState(tmp_path)
    srv = ThreadingHTTPServer(("127.0.0.1", 0), _make_handler(st))
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    try:
        for (w, h), scheme in [(sz, sc) for sz in SIZES for sc in SCHEMES]:
            ctx = browser.new_context(viewport={"width": w, "height": h})
            ctx.add_init_script(
                "try{localStorage.setItem('plotline-tour','1');"
                f"localStorage.setItem('plotline-scheme','{scheme}');"
                "}catch(e){}")
            pg = ctx.new_page()
            pg.goto(f"http://127.0.0.1:{srv.server_address[1]}/?t={st.token}")
            pg.wait_for_selector(".nbshell .card")
            pg.wait_for_timeout(600)
            info = pg.evaluate("""()=>{const b=[...document.querySelectorAll(
              '.rf-info')].find(b=>b.getClientRects().length);
              if(!b) return false;b.click();return true;}""")
            assert info, "no Info door"
            pg.wait_for_timeout(300)
            pg.evaluate("""()=>{const b=[...document.querySelectorAll(
              '.rf-acts button,.rf-acts .rf-act')].find(b=>/Version history/
              .test(b.textContent));b.click();}""")
            pg.wait_for_selector(".vers-menu .jv-q", timeout=8000)
            _check_q(pg, "Q5 Version history", ".vers-menu .jv-q",
                     ".vers-menu", ".vers-menu .ckf-h", w, h, False,
                     editor=False)
            ctx.close()
    finally:
        srv.shutdown()
        srv.server_close()


# ---------------------------------------------------------------- the guard

TEXT_BLOCKS = r"""limit=>{
  const SKIP='.docs .card,.cardbody,.rawmd,#deck-stage,.slide,.film-list,'
    +'#film-list,.helpdlg,.jv-qpop,.rv-text,textarea,input,select,'
    +'.np-notes,.ovw-body,.dg-sheetcol,.dh-body,.jvp-notes,.wquote,'
    +'.welcome-more,.nt-sheet,.ar-thumb,.pr-tip,[aria-hidden="true"]';
  const blocks=new Map();
  const w=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);
  let n;
  while((n=w.nextNode())){
    const t=n.nodeValue.trim(); if(!t) continue;
    const el=n.parentElement; if(!el||el.closest(SKIP)) continue;
    if(!el.getClientRects().length) continue;
    const cs=getComputedStyle(el);
    if(cs.visibility==='hidden'||cs.display==='none') continue;
    let b=el;
    while(b&&b!==document.body&&/^inline/.test(getComputedStyle(b).display))
      b=b.parentElement;
    const words=t.split(/\s+/).filter(x=>/[A-Za-z]/.test(x)).length;
    blocks.set(b,(blocks.get(b)||0)+words);
  }
  const out=[];
  blocks.forEach((v,b)=>{if(v>limit) out.push([v,
    (b.id?'#'+b.id:'')+'.'+String(b.className||'').split(' ')[0],
    b.textContent.trim().replace(/\s+/g,' ').slice(0,90)]);});
  return out;}"""


def _walls(pg):
    return pg.evaluate(TEXT_BLOCKS, WORDS_PER_BLOCK)


def test_no_wall_of_text_outside_a_help_button(browser, page_file, tmp_path):
    w, h = SIZES[0]
    found: list = []
    # Home, as the web build sends it
    home = tmp_path / "home.html"
    home.write_text(render_page([], mode="web"), encoding="utf-8")
    ctx = browser.new_context(viewport={"width": w, "height": h})
    ctx.route("https://**", lambda rt: rt.fulfill(status=404, body=""))
    pg = ctx.new_page()
    pg.goto(home.as_uri())
    pg.wait_for_timeout(800)
    found += [("Home",) + tuple(x) for x in _walls(pg)]
    ctx.close()
    # the reader, its File menu and its custom view
    ctx, pg, _e = _open(browser, page_file, w, h, "dark", editor=False)
    found += [("reader",) + tuple(x) for x in _walls(pg)]
    _js_click(pg, "#app-file")
    found += [("reader File",) + tuple(x) for x in _walls(pg)]
    ctx.close()
    # the editor, its File and Present menus, and every "?" host
    ctx, pg, _e = _open(browser, page_file, w, h, "dark")
    found += [("editor",) + tuple(x) for x in _walls(pg)]
    _js_click(pg, "#dc-file")
    found += [("editor File",) + tuple(x) for x in _walls(pg)]
    _close_all(pg)
    pg.keyboard.press("Escape")
    for name, opener, _q, _host, _o, _esc in EDITOR:
        opener(pg)
        pg.wait_for_timeout(250)
        found += [(name,) + tuple(x) for x in _walls(pg)]
        _close_all(pg)
    ctx.close()
    assert not found, "\n".join(map(str, found))
