"""The ribbon fit decides from what it has measured (2026-10-09, speed).

Every tab click, selection and window-drag step used to climb the whole
ladder in fitEditRibbon with a forced layout per rung and per fold: 7.2 s
of main thread for a 22-step drag at 4x, 0.2-0.4 s for the Design tab or a
figure selected. Now:

- what goes in (each group's controls, words and visibility, never its
  fold door) is kept per group and keyed (ribbonFitInput);
- what each state of the row needs -- how far its last group reaches -- is
  measured once per input and answers "does it fit?" at any width in the
  bracket (ribbonFitDecide), within two pixels of the edge it is measured
  again;
- fold states are worked out from the group and door widths of a state
  that was measured (ribbonFitPredict), every door measured at once;
- the spacing rungs are halved between what is known to run over and
  what is known to fit (monotone: measured over 750 ladders);
- a decision from memory is checked after the frame (ribbonFitVerify).

These run the shipped functions: the climb against a model row, beside
the ladder exactly as fitEditRibbon climbed it before, over hundreds of
random rows -- same rungs, same folds, every time, in fewer measurements.
The no-wrap invariant in a real browser is
tests/test_ribbon_never_wraps_in_a_browser.py (opt-in).
"""

from __future__ import annotations

import json
import subprocess
import tempfile
from pathlib import Path

import pytest

from helpers_js import js_engine, lift_fn
from junoview import assets

DECK = assets.deck_js()
APP = assets.app_js()


def _run(code: str):
    eng = js_engine()
    if eng is None:
        pytest.skip("JavaScript engine unavailable")
    cmd, env = eng
    with tempfile.TemporaryDirectory() as d:
        p = Path(d) / "run.js"
        p.write_text(code, encoding="utf-8")
        r = subprocess.run(cmd + [str(p)], capture_output=True, text=True,
                           env=env, timeout=120)
    assert r.returncode == 0, r.stderr[:3000]
    return json.loads(r.stdout.strip().splitlines()[-1])


def _var(src: str, name: str) -> str:
    """the `var NAME=[...];` declaration, by bracket depth"""
    i = src.index(f"var {name}=[")
    depth = 0
    for k in range(src.index("[", i), len(src)):
        if src[k] == "[":
            depth += 1
        elif src[k] == "]":
            depth -= 1
            if depth == 0:
                return src[i:k + 2]
    raise AssertionError(name)


# A model row: groups with a width at each of the seven ladder states
# (base, nohint, erc1, erc2, erc3, nostatus, tight -- never wider down the
# ladder), a door width, a visual position, and the classes the climb
# reads. R(state) is the row's reach. `measure` counts layouts.
_MODEL = r"""
var ERC=['erc1','erc2','erc3'];
function rnd(seed){return function(){seed=(seed*1103515245+12345)%2147483648;
  return seed/2147483648;};}
function cls(list){return {contains:function(c){return list.indexOf(c)>=0;}};}
function makeRow(r){
  var n=4+Math.floor(r()*9),gs=[];
  var kinds=['','','','','rbn-fixed','rbn-nofold','rbn-nofold rbn-order',
    'rbn-compact','rbn-stylesys','rbn-paragrp',''];
  for(var i=0;i<n;i++){
    var k=kinds[Math.floor(r()*kinds.length)].split(' ').filter(Boolean);
    var w0=40+Math.floor(r()*260),w=[w0],x=w0;
    for(var l=1;l<7;l++){x=Math.max(30,x-Math.floor(r()*30));w.push(x);}
    gs.push({i:i,classList:cls(k),w:w,door:60+Math.floor(r()*50),
      row:r()>0.05,pos:0,compact:k.indexOf('rbn-compact')>=0});
  }
  /* flex `order` puts them on screen in an order of its own */
  var ord=gs.slice().sort(function(){return r()-0.5;});
  ord.forEach(function(g,p){g.pos=p;});
  return gs;
}
function level(st){
  if(st.tight) return 6;
  if(st.nostatus) return 5;
  if(st.erc) return 1+st.erc;
  return st.nohint?1:0;
}
function reach(gs,st){
  var L=level(st),R=10;
  gs.forEach(function(g){
    R+=(g.compact||st.F.indexOf(g)>=0)?Math.min(g.door,g.w[L]+40):g.w[L];});
  return R;
}
/* THE LADDER AS fitEditRibbon CLIMBED IT, before 2026-10-09 */
var NEVER=['rbn-fixed','rbn-sources','rbn-stylesys','rbn-paragrp',
  'rbn-nofold','rbn-check','rbn-cancel'];
function oldClimb(gs,W){
  var st={nohint:0,erc:0,nostatus:0,tight:0,F:[]},n=0;
  function over(){n++;return reach(gs,st)>W+1;}
  if(over()) st.nohint=1;
  for(var i=0;i<3;i++){if(!over()) break;st.erc=i+1;}
  if(over()) st.nostatus=1;
  if(over()) st.tight=1;
  var guard=0;
  while(over()&&guard++<12){
    var c=gs.filter(function(g){
      return !g.compact&&st.F.indexOf(g)<0&&!NEVER.some(function(k){
        return g.classList.contains(k);});});
    c.sort(function(a,b){return a.pos-b.pos;});
    var g=c[c.length-1];
    if(!g||!g.row) break;
    st.F.push(g);
  }
  if(over()){
    var last=gs.filter(function(g){return g.classList.contains('rbn-nofold')
      &&!g.compact&&st.F.indexOf(g)<0;});
    last.sort(function(x,y){return (x.classList.contains('rbn-order')?1:0)
      -(y.classList.contains('rbn-order')?1:0);});
    for(var li=0;li<last.length&&over();li++)
      if(last[li].row) st.F.push(last[li]);
  }
  var back=st.F.slice().sort(function(a,b){return a.pos-b.pos;});
  back.forEach(function(g){
    var keep=st.F;st.F=st.F.filter(function(x){return x!==g;});
    if(over()) st.F=keep;
  });
  return {st:st,n:n};
}
function sigOf(st){
  return ''+st.nohint+st.erc+st.nostatus+st.tight+'|'
    +st.F.map(function(g){return g.i;}).sort().join(',');
}
function ribbonGroupRow(g){return g.row?{}:null;}
"""


def _climb_src():
    return "\n".join([
        _var(DECK, "RBN_NEVER_FOLD"),
        lift_fn(DECK, "ribbonFitBase"),
        lift_fn(DECK, "ribbonFitCopy"),
        lift_fn(DECK, "ribbonFitClimb"),
    ])


def test_the_climb_is_the_ladder_it_always_was():
    """Over 600 random rows and widths -- monotone rungs, doors, groups that
    never fold, Build order last, flex order on screen -- the climb asked of
    states lands on exactly the rungs and the folds the old climb did, and
    asks no more questions than it did (the halving of the spacing rungs)."""
    code = _MODEL + _climb_src() + r"""
var out={same:0,diff:[],fewer:0,more:0,asked:0,old:0};
var r=rnd(7);
for(var t=0;t<600;t++){
  var gs=makeRow(r),W=300+Math.floor(r()*1600);
  var ref=oldClimb(gs,W);
  var known={},asked=0,idx=new Map(),order=new Map();
  gs.forEach(function(g){idx.set(g,g.i);order.set(g.i,g.pos);});
  var ctx={stale:false,shown:gs,idx:idx,fam:{order:order},
    peek:function(st){var s=sigOf(st);
      return (s in known)?known[s]:null;},
    over:function(st){var s=sigOf(st);
      if(!(s in known)){asked++;known[s]=reach(gs,st)>W+1;}
      return known[s];}};
  var st=ribbonFitClimb(ctx);
  if(sigOf(st)===sigOf(ref.st)) out.same++;
  else out.diff.push([t,W,sigOf(st),sigOf(ref.st)]);
  out.asked+=asked;out.old+=ref.n;
}
console.log(JSON.stringify(out));
"""
    got = _run(code)
    assert got["diff"] == [], got["diff"][:5]
    assert got["same"] == 600
    # distinct states measured, against the old climb's over() calls
    assert got["asked"] < got["old"] * 0.75, got


def test_what_is_known_is_used_and_not_asked_again():
    """A second fit of the same row at another width asks only about the
    states it has never seen -- and when everything it needs is known it
    measures nothing at all (a revisited tab, a window drag)."""
    code = _MODEL + _climb_src() + r"""
var r=rnd(11),res=[];
for(var t=0;t<200;t++){
  var gs=makeRow(r),known={},idx=new Map(),order=new Map();
  gs.forEach(function(g){idx.set(g,g.i);order.set(g.i,g.pos);});
  var R={};
  function ctxAt(W){
    var c={n:0,stale:false,shown:gs,idx:idx,fam:{order:order}};
    /* what is known is a LENGTH, so it answers at any width */
    c.peek=function(st){var s=sigOf(st);return (s in R)?R[s]>W+1:null;};
    c.over=function(st){var s=sigOf(st);
      if(!(s in R)){c.n++;R[s]=reach(gs,st);}
      return R[s]>W+1;};
    return c;
  }
  var W=500+Math.floor(r()*1200);
  var a=ctxAt(W);ribbonFitClimb(a);
  var b=ctxAt(W);var st=ribbonFitClimb(b);
  var W2=W-1-Math.floor(r()*120);
  var c=ctxAt(W2);var st2=ribbonFitClimb(c);
  res.push([b.n,sigOf(st2)===sigOf(oldClimb(gs,W2).st),sigOf(st)===sigOf(oldClimb(gs,W).st)]);
}
console.log(JSON.stringify(res));
"""
    res = _run(code)
    # the same row at the same width again: nothing measured
    assert all(n == 0 for n, _, _ in res)
    # ...and every answer is still the ladder's
    assert all(ok2 and ok for _, ok2, ok in res)


def test_a_fold_state_is_worked_out_from_one_that_was_measured():
    """ribbonFitPredict: a measured state at the same rungs, less each newly
    folded group's open width and plus its door's (and the reverse for one
    the measured state folded) -- exactly, since every group is its own
    flex:none item. A door wearing another choice, or a width never
    measured, is not guessed."""
    code = lift_fn(DECK, "ribbonRungKey") + "\n" + lift_fn(
        DECK, "ribbonFitPredict") + r"""
var fam={byRung:new Map(),u:new Map(),d:new Map()};
var g=[{i:0},{i:1},{i:2},{i:3}];
var idx=new Map();g.forEach(function(x){idx.set(x,x.i);});
var say={0:'Fade',1:'',2:'On click',3:''};
var ctx={fam:fam,idx:idx,readout:function(x){return say[x.i];}};
var rk='1310';
/* measured: nothing folded, every group open: 100+200+150+50 */
fam.byRung.set(rk,[{r:510,wrapped:false,F:new Map()}]);
[100,200,150,50].forEach(function(w,i){fam.u.set(rk+'|'+i,w);});
fam.d.set(rk+'|1:',82);fam.d.set(rk+'|2:On click',90);
var st=function(F){return {nohint:1,erc:3,nostatus:1,tight:0,F:F};};
var out=[ribbonFitPredict(st([g[1]]),ctx),            /* 510-200+82 */
  ribbonFitPredict(st([g[1],g[2]]),ctx),             /* -150+90 too */
  ribbonFitPredict(st([g[0]]),ctx),                  /* no door known */
  ribbonFitPredict({nohint:1,erc:2,nostatus:0,tight:0,F:[g[1]]},ctx)];
/* from a measured FOLDED state back to an open one */
fam.byRung.set(rk,[{r:392,wrapped:false,F:new Map([[1,'']])}]);
out.push(ribbonFitPredict(st([]),ctx));               /* not asked: F empty */
out.push(ribbonFitPredict(st([g[2]]),ctx));          /* +200-82, -150+90 */
/* the door now wears another choice than when it was measured */
say[1]='Fade';
out.push(ribbonFitPredict(st([g[1]]),ctx));
console.log(JSON.stringify(out));
"""
    got = _run(code)
    assert got[0] == 510 - 200 + 82
    assert got[1] == 510 - 200 + 82 - 150 + 90
    assert got[2] is None          # Pictures' door never measured
    assert got[3] is None          # another set of rungs
    assert got[5] == 392 + 200 - 82 - 150 + 90
    assert got[6] is None          # a door wearing a new choice


def test_a_length_answers_any_width_but_the_edge_is_measured():
    """Measured at this very width, the answer is T464's own (scrollWidth
    past clientWidth+1, or a group on a second line). At another width the
    row's length answers -- except within two pixels of the edge, after a
    wrap, or for a row with something besides groups in it."""
    code = lift_fn(DECK, "ribbonFitDecide") + "\n" + lift_fn(
        DECK, "ribbonFitDecideR") + r"""
var f={exact:false},x={exact:true};
var m={cw:1000,sw:1003,r:1003.4,wrapped:false};
console.log(JSON.stringify([
  ribbonFitDecide(m,1000,f),            /* here: 1003>1001 */
  ribbonFitDecide({cw:1000,sw:1001,r:1001,wrapped:false},1000,f),
  ribbonFitDecide(m,1100,f),            /* elsewhere: fits */
  ribbonFitDecide(m,900,f),             /* elsewhere: over */
  ribbonFitDecide(m,1001,f),            /* 1003.4 vs 1002: too close */
  ribbonFitDecide(m,1003,f),            /* too close */
  ribbonFitDecide({cw:1000,sw:1000,r:1300,wrapped:true},1000,f),
  ribbonFitDecide({cw:1000,sw:1000,r:900,wrapped:true},1200,f),
  ribbonFitDecide(m,1100,x),
  ribbonFitDecideR(1002.4,1000),ribbonFitDecideR(1002.5,1000),
  ribbonFitDecideR(1000.5,1000),ribbonFitDecideR(1000.6,1000)]));
"""
    got = _run(code)
    assert got == [True, False, False, True, None, False, True, None, None,
                   None, True, False, None]


def test_what_goes_in_leaves_out_what_the_fit_wrote():
    """A class the fit writes (a fold, the shelf, the counted columns, the
    door's readout) is never a reason to fit again; the classes T539's key
    watched still stir the bar (a pop-up shut on the next fit)."""
    code = "\n".join(lift_fn(DECK, n) for n in (
        "ribbonOutCls", "ribbonRungCls", "ribbonDeckVolatile",
        "ribbonClsLess", "ribbonClsStir")) + "\n" + _var(
        DECK, "RBN_STIR_CLS") + r"""
var RBN_FIT_OUT={'rbn-folded':1,'rbn-shelved':1,'rbn-fit':1,'rbn-odd':1,
  'has-val':1,'shelf-open':1,'fmt-open':1};
console.log(JSON.stringify([
  ribbonClsLess('rbn-grp rbn-view rbn-folded rbn-shelved',ribbonOutCls),
  ribbonClsLess('deck editing erc1 ercw2 film-peek tab-animation rbn-side',
    ribbonDeckVolatile),
  ribbonClsStir('dbtn rbn-fit','dbtn'),
  ribbonClsStir('dbtn rbn-hid','dbtn'),
  ribbonClsStir('x rbn-cell','rbn-cell x')]));
"""
    got = _run(code)
    assert got == ["rbn-grp rbn-view", "deck editing rbn-side", False, True,
                   False]
    # ...and the table the lift used is the one that ships
    assert ("  var RBN_FIT_OUT={'rbn-folded':1,'rbn-shelved':1,'rbn-fit':1,"
            "'rbn-odd':1,\n    'has-val':1,'shelf-open':1,'fmt-open':1};") \
        in DECK


def test_a_reader_resize_step_that_changes_nothing_writes_nothing():
    """bandFitStill (app.js): a step of a window drag keeps the app bar as
    it is when every "too wide" the last fit saw is still too wide at the
    new width and the bar fits as it stands -- and climbs again otherwise:
    a header changed since, the spacing stage no longer earned, a door no
    longer needed, the band running over with doors still to fold."""
    code = lift_fn(APP, "bandOver") + "\n" + lift_fn(
        APP, "bandFitStill") + r"""
var rbc1=false,key='k',bandFit=null,bandFitDirty=false;
function bandFitKey(){return key;}
var document={body:{classList:{contains:function(c){
  return c==='rbc1'&&rbc1;}}}};
function el(cw,sw){return {hidden:false,clientWidth:cw,scrollWidth:sw};}
var out=[];
/* no stage: everything fits as it stands, or it does not */
bandFit={key:'k',rbc:false,r0:[null,null,null,null],rb:[],spent:false};
out.push(bandFitStill([el(900,900),el(800,700),el(1000,1000),null]));
out.push(bandFitStill([el(900,950),el(800,700),el(1000,1000),null]));
/* the stage stands while the bar that bought it would still run over */
rbc1=true;
bandFit={key:'k',rbc:true,r0:[null,1200,null,null],rb:[1100,1000],spent:false};
out.push(bandFitStill([el(900,900),el(950,950),el(1000,1000),null]));
out.push(bandFitStill([el(900,900),el(1300,1300),el(1000,1000),null]));
/* a door no longer needed at the new width */
out.push(bandFitStill([el(900,900),el(1000,1000),el(1000,1000),null]));
/* the band over: only when the last fit ran out of doors too */
out.push(bandFitStill([el(900,900),el(950,990),el(1000,1000),null]));
bandFit.spent=true;
out.push(bandFitStill([el(900,900),el(950,990),el(1000,1000),null]));
/* anything in the header changed since, or the page's classes */
bandFitDirty=true;
out.push(bandFitStill([el(900,900),el(950,950),el(1000,1000),null]));
bandFitDirty=false;key='other';
out.push(bandFitStill([el(900,900),el(950,950),el(1000,1000),null]));
key='k';rbc1=false;
out.push(bandFitStill([el(900,900),el(950,950),el(1000,1000),null]));
console.log(JSON.stringify(out));
"""
    got = _run(code)
    assert got == [True, False, True, False, False, False, True, False,
                   False, False]


def test_the_fit_reads_the_row_wherever_it_sits():
    """A group's share of what goes in is its row -- in place, in its
    door's pop-up or on the shelf -- and its label, never the door; while
    View is folded, the controls it hid are read as they were."""
    sig = lift_fn(DECK, "ribbonGroupSig")
    assert "if(c!==row&&!c.classList.contains('rbn-foldwrap')) nodes.push(c);" \
        in sig
    assert "if(el.id==='vw-morewrap') hid=true;" in sig
    assert "viewWasHidden,el.id)) hid=!!viewWasHidden[el.id];" in sig
    seen = lift_fn(DECK, "ribbonSigSeen")
    # the door and its words are the fit's own
    assert "if(el&&el.closest&&el.closest('.rbn-foldbtn')) continue;" in seen
    # whether a group is on the row at all is read live, every fit
    assert "(r.attributeName==='hidden'||r.attributeName==='data-off')))" \
        in seen
    run = lift_fn(DECK, "ribbonFitRun")
    # the fit's own changes are never read back as what goes in
    assert "if(ribbonSigObs) ribbonSigObs.takeRecords();\n    ribbonBarStir=false;" \
        in run


def test_the_hold_of_a_mode_switch_is_kept():
    """The switch package's one fit per mode switch: while setUIMode holds
    the fit it is only noted, and it runs once on release."""
    fit = lift_fn(DECK, "fitEditRibbon")
    assert fit.split("\n")[1].strip() == \
        "if(ribbonFitHold){ribbonFitOwed=true;return;}"


def test_the_readouts_change_only_where_they_changed():
    """editor #9: a pressed-state change reads again only the doors of the
    groups it happened in, a same-value write changes nothing, and a door
    writes its words, `hidden` and class only when they differ."""
    boot = lift_fn(DECK, "rbnReadoutBoot")
    assert "if(t.getAttribute(r.attributeName)===r.oldValue) continue;" in boot
    assert "if(g) dirty.add(g); else all=true;" in boot
    assert "attributeOldValue:true" in boot
    assert "if(rbnFoldReadouts(list)) ribbonFitRecheckLater();" in boot
    write = lift_fn(DECK, "rbnFoldReadoutWrite")
    assert "if(val.textContent!==c.fin){val.textContent=c.fin;moved=true;}" \
        in write
    assert "if(val.hidden!==!c.fin) val.hidden=!c.fin;" in write
