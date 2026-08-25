/* 40-captions-and-components.js — a figure and its caption, anchoring, components, and the dialogs.
   ONE FRAGMENT of deck.js's single IIFE, concatenated with its
   siblings in filename order by assets.deck_js(). It does not
   parse alone and is not meant to: see 00-page.js. */
  /* ---- A FIGURE AND ITS CAPTION ARE ONE THING -------------------------
     (TASKS T17.) A caption that moves with its figure, scales with it,
     and survives every layout operation.

     WHY NOT A GROUP. Grouping already makes several things move
     together, and it would have been the cheap answer. It is the wrong
     one, for three reasons this file already knows:
       - a group is symmetric, and this relationship is not. The caption
         belongs TO the figure; the figure does not belong to the
         caption. Delete the figure and the caption is orphaned rubbish;
         delete the caption and the figure is fine.
       - `matchKey`/`typeKeyOf` bucket items by KIND for Match slide and
         the Apply dialog. A caption must stay a caption there, and a
         group tells them nothing.
       - T18 has to number figures and re-number them when slides move.
         "The caption of figure N" has to be a question with an answer.

     SO IT IS A TIE, not a bag: the caption carries `capOf`, the opaque
     id of its figure, and the figure carries `cap` — its own id. Two
     fields rather than one because both directions get asked: "what is
     this caption for" on the caption, and "does this figure have one"
     on the figure, and neither should mean walking the slide.

     WHAT THE TIE DOES. The caption follows the figure when the figure
     moves (any mover, because it goes through shiftAnnot), keeps its
     width when the figure is resized, and rides along in a component or
     a clone. It is NOT a group: you can still select, restyle and edit
     the caption on its own, which is the entire point of a caption. */
  function figId(){
    return 'f'+Math.random().toString(36).slice(2,8);
  }
  function capOfFig(s,a){
    if(!a||!a.cap) return -1;
    var hit=-1;
    (s&&s.annots||[]).forEach(function(x,i){
      if(x&&x.capOf===a.cap) hit=i;});
    return hit;
  }
  function figOfCap(s,a){
    if(!a||!a.capOf) return -1;
    var hit=-1;
    (s&&s.annots||[]).forEach(function(x,i){
      if(x&&x.cap===a.capOf) hit=i;});
    return hit;
  }
  /* WHAT COUNTS AS A FIGURE for a caption to belong to. A placed frame
     showing a figure is the obvious one; a picture and a flip book are
     the same thing to a reader, and saying so here is what stops T18
     numbering three different ways. */
  function isFigure(a){
    if(!a) return false;
    if(a.k==='image'||a.k==='flip') return true;
    return a.k==='cell'&&partOf(a)==='figure';
  }
  function tieCaption(figIdx,capIdx){
    var s2=pres.slides[cur];
    var f=s2&&(s2.annots||[])[figIdx];
    var c=s2&&(s2.annots||[])[capIdx];
    if(!f||!c) return false;
    if(!f.cap) f.cap=figId();
    c.capOf=f.cap;
    markDirty();
    var l=stage.querySelector('.annot-layer');
    if(l){renderAnnots(l,s2);paintSel(l);}
    return true;
  }
  /* the tokens are typed OR inserted. Inserted, because nobody guesses
     a syntax, and typed, because anyone who has learned it should not
     have to hunt for a menu (T18). */
  function numberCaption(i){
    var s2=pres.slides[cur];
    var a=s2&&(s2.annots||[])[i];
    if(!a||a.k!=='text') return;
    var t=String(a.text||'');
    if(t.indexOf('{fig}')>=0){toast('It already has its number');return;}
    a.text='Figure {fig}. '+t;
    delete a.html;      /* a plain-text edit cannot keep rich runs */
    markDirty();
    var l=stage.querySelector('.annot-layer');
    if(l){renderAnnots(l,s2);paintSel(l);}
    toast('Numbered — it renumbers itself when slides move');
  }
  function refCaption(i,figKey){
    var s2=pres.slides[cur];
    var a=s2&&(s2.annots||[])[i];
    if(!a||a.k!=='text') return;
    a.text=String(a.text||'')+(a.text?' ':'')+'Figure {fig:'+figKey+'}';
    delete a.html;
    markDirty();
    var l=stage.querySelector('.annot-layer');
    if(l){renderAnnots(l,s2);paintSel(l);}
    toast('Reference added — it follows that figure');
  }
  function untieCaption(i){
    var s2=pres.slides[cur];
    var a=s2&&(s2.annots||[])[i];
    if(!a) return false;
    if(a.capOf){delete a.capOf;}
    else if(a.cap){
      var ci=capOfFig(s2,a);
      if(ci>=0) delete s2.annots[ci].capOf;
      delete a.cap;
    } else return false;
    markDirty();
    var l=stage.querySelector('.annot-layer');
    if(l){renderAnnots(l,s2);paintSel(l);}
    return true;
  }
  /* ---- ANCHORING: WHAT HAPPENS WHEN THE PAGE CHANGES SHAPE ------------
     (TASKS T14.) The design note, and the first thing it has to say is
     what is ALREADY true, because half this task is done and saying so
     is the difference between building the right thing and rebuilding
     the wrong one.

     RELATIVE SIZING ALREADY IS THE WHOLE COORDINATE SYSTEM. Every item
     is stored in percent of the page — x and w of its width, y and h of
     its height, text size as a percent of height — which is why one deck
     renders at 16:9, on A4 and on an A0 poster with no stored number
     changing. There is nothing to add there and nothing to opt into.

     WHAT IS ACTUALLY MISSING is that the two percentages are of
     DIFFERENT things. Go from 16:9 to a portrait poster and a box 30%
     wide by 30% tall stops being square; a caption 2% below its figure
     is suddenly 5% below it; a footer 4% from the bottom drifts. Every
     item is relative, and the RELATIONSHIP between them is not.

     THE MINIMAL USEFUL SUBSET, and it is deliberately not a constraint
     solver: an item may name ONE anchor — which corner or edge of the
     page it is measured from — and that is all. `a.anch`:

       (absent)  today's behaviour exactly: x/y are the top-left corner.
       'tr' 'bl' 'br'   measured from that corner instead, so a footer
                 pinned 'bl' stays 4% off the bottom whatever the page
                 does, and a page-number 'br' stays in its corner.
       'tc' 'bc' 'cl' 'cr'   an edge midpoint: centred across, pinned to
                 that edge.
       'c'       the page's middle, both ways.

     WHY ONE ANCHOR AND NOT TWO. An anchor per axis (left+bottom,
     right+top) is what a constraint solver grows out of, and the task
     explicitly rules that out. One anchor per item answers the cases
     people actually hit — furniture in a corner, a title centred across
     the top, a logo bottom-right — and stays a single lookup with no
     solving, no ordering, and no cycles.

     HOW IT IS APPLIED. Not by rewriting x/y — that would bake the
     current page into the model, which is exactly what a poster reflow
     must not do. The stored numbers keep meaning "this far from my
     anchor", and the anchor is resolved at RENDER time into the
     left/top the layer wants. anchorPos is the one function that does
     it, and it is an identity for an item with no anchor, which is
     every item in every deck to date. */
  var ANCHORS={
    tl:['Top left',0,0],      tc:['Top, centred',50,0],
    tr:['Top right',100,0],
    cl:['Left, middle',0,50], c:['Centre of the page',50,50],
    cr:['Right, middle',100,50],
    bl:['Bottom left',0,100], bc:['Bottom, centred',50,100],
    br:['Bottom right',100,100]
  };
  /* the left/top an item should render at, given its anchor. `w`/`h` are
     the item's own size in page percent, needed because an item anchored
     to the right edge is measured from ITS right edge — otherwise
     "10% from the right" would put its left edge there and hang the item
     off the page. */
  function anchorPos(a,w,h){
    var an=a&&a.anch;
    if(!an||!ANCHORS[an]) return {x:a.x||0,y:a.y||0};
    var A=ANCHORS[an];
    var dx=a.x||0,dy=a.y||0;
    var x,y;
    if(A[1]===0) x=dx;
    else if(A[1]===100) x=100-dx-(w||0);
    else x=50-(w||0)/2+dx;
    if(A[2]===0) y=dy;
    else if(A[2]===100) y=100-dy-(h||0);
    else y=50-(h||0)/2+dy;
    return {x:x,y:y};
  }
  /* THE INVERSE. Everything that positions an item thinks in PAGE
     coordinates — a drag, an arrange, a snap — and must not have to know
     about anchors. This is the one place that converts, and it is the
     identity for an unanchored item. */
  /* THE MEASURED PASS, and the reason the naive one is not enough.
     anchorPos needs the item's SIZE to measure from a right or bottom
     edge — and the items that most want anchoring are exactly the ones
     whose size is not stored: an auto-height text box, an aspect-fitted
     figure frame, a box that shrink-to-fit has just scaled. With a.h
     undefined the maths put their TOP at the bottom edge and pushed
     them off the page, which is worse than not anchoring at all.

     So anchored items are placed twice: once from the stored numbers,
     as everything else is, and again here from what they actually
     measured. Only the ELEMENT is corrected — the model keeps saying
     "this far from my corner", which is the whole point (2026-08-25,
     found by A/B-ing a pinned and an unpinned text box across a page
     shape change: both drifted identically, so the feature was inert
     for the case it exists for). */
  function anchorFix(layer,s){
    if(!layer||!s) return;
    (s.annots||[]).forEach(function(a,i){
      if(!a||!a.anch||a.k==='arrow') return;
      var A=ANCHORS[a.anch];
      if(!A||(A[1]===0&&A[2]===0)) return;   /* top-left: nothing to do */
      var el=layer.querySelector('div.an-item[data-idx="'+i+'"]');
      if(!el) return;
      var lr=layer.getBoundingClientRect();
      if(!lr.width||!lr.height) return;
      var er=el.getBoundingClientRect();
      var p=anchorPos(a,er.width/lr.width*100,er.height/lr.height*100);
      el.style.left=p.x+'%';el.style.top=p.y+'%';
    });
  }
  function anchorSet(a,x,y,w,h){
    var an=a&&a.anch;
    if(!an||!ANCHORS[an]){a.x=x;a.y=y;return;}
    var A=ANCHORS[an];
    a.x=(A[1]===0)?x:(A[1]===100)?(100-x-(w||0)):(x-(50-(w||0)/2));
    a.y=(A[2]===0)?y:(A[2]===100)?(100-y-(h||0)):(y-(50-(h||0)/2));
  }
  /* setting an anchor must not MOVE the item: the stored offset is
     re-expressed against the new corner so the thing stays exactly where
     it is and only its future behaviour changes. Anything else would
     make the control feel like it did something random. */
  function setAnchor(i,an){
    var s2=pres.slides[cur];
    var a=s2&&(s2.annots||[])[i];
    if(!a||a.k==='arrow') return;
    var layer=stage.querySelector('.annot-layer');
    var r=layer?annotRectPct(layer,s2,i):null;
    var w=r?(r.r-r.l):(a.w||0),h=r?(r.b-r.t):(a.h||0);
    var absX=r?r.l:(a.x||0),absY=r?r.t:(a.y||0);
    if(!an||!ANCHORS[an]) delete a.anch; else a.anch=an;
    anchorSet(a,absX,absY,w,h);
    markDirty();
    if(layer){renderAnnots(layer,s2);paintSel(layer);}
    toast(an&&ANCHORS[an]?('Pinned to '+ANCHORS[an][0].toLowerCase())
      :'No longer pinned \u2014 measured from the top left again');
  }
  /* ---- COMPONENTS: ONE DEFINITION, MANY LINKED INSTANCES ---------------
     (TASKS T13.) A named group you can place again and again, where
     editing the definition updates every instance — and where each
     instance keeps its own words and its own figure.

     THE DESIGN NOTE.

     1. WHICH PROPERTIES ARE THE COMPONENT, AND WHICH ARE THE INSTANCE.
        This question is already answered in this file, argued at length,
        and used by three features: MATCH_PROPS is "the geometry + look
        that travel; content never does". That is exactly a component's
        contract, so it is exactly what a definition stores. Nothing new
        is invented, and the per-instance overrides the task asks for —
        text, image, which card a frame shows — are simply the fields
        MATCH_PROPS has always refused to copy.

     2. GEOMETRY IS RELATIVE, SO AN INSTANCE CAN LIVE ANYWHERE. Each
        member is stored as a fraction of the component's own box
        (0..1), not as a page position. Placing one multiplies back out
        at the origin you dropped it. A component therefore has an
        intrinsic SIZE, and an instance is not resized as a unit —
        stated here because it is a real limit, not an oversight: making
        instances scalable means deciding what happens to type size, and
        that is a different feature.

     3. AN INSTANCE IS IDENTIFIED BY THREE FIELDS, all on the item:
        `cmp` (which component), `ci` (which member of it) and `cinst`
        (which instance). Three rather than one because all three
        questions get asked: "is this a component", "what should this
        member look like", and "which copies move together".

     4. UPDATING IS A RE-STAMP, and it is deliberate that local edits to
        an instance are lost by it. That IS staying linked; a component
        whose instances quietly diverge is a component in name only. The
        escape hatch is Detach, which is one menu row away and turns the
        instance into ordinary objects.

     5. SCHEMA. `pres.components = {id:{name, w, h, items:[…]}}`. It is
        deck-level, so it rides in normPres, _as_presentations, the undo
        snapshot and DECK-FORMAT.md — the five places T33 exists to make
        it obvious you have to touch. */
  function cmpStore(){
    if(!pres.components) pres.components={};
    return pres.components;
  }
  function cmpList(){
    var st=cmpStore();
    return Object.keys(st).map(function(id){
      return {id:id,name:(st[id]&&st[id].name)||'Component',
        n:((st[id]&&st[id].items)||[]).length};
    }).sort(function(a,b){
      return a.name.localeCompare(b.name);});
  }
  function nextCmpId(){
    var st=cmpStore(),n=1;
    while(st['c'+n]) n++;
    return 'c'+n;
  }
  /* the props a definition keeps: MATCH_PROPS minus the geometry, which
     is stored relatively instead. Content is not in MATCH_PROPS at all,
     which is the whole point (see the note above). */
  var CMP_SKIP={x:1,y:1,w:1,h:1,x1:1,y1:1,x2:1,y2:1,mid:1};
  function cmpDefine(name,idxs){
    var s2=pres.slides[cur];
    if(!s2||!idxs.length) return null;
    var layer=stage.querySelector('.annot-layer');
    var boxes=[];
    idxs.forEach(function(i){
      var r=annotRectPct(layer,s2,i);
      if(r) boxes.push({i:i,r:r});
    });
    if(!boxes.length) return null;
    var bb={l:1e9,t:1e9,r:-1e9,b:-1e9};
    boxes.forEach(function(x){
      bb.l=Math.min(bb.l,x.r.l);bb.t=Math.min(bb.t,x.r.t);
      bb.r=Math.max(bb.r,x.r.r);bb.b=Math.max(bb.b,x.r.b);});
    var W=Math.max(0.01,bb.r-bb.l),H=Math.max(0.01,bb.b-bb.t);
    var items=boxes.map(function(x){
      var a=s2.annots[x.i];
      var it={k:a.k,props:{}};
      MATCH_PROPS.forEach(function(p){
        if(CMP_SKIP[p]) return;
        if(a[p]!==undefined)
          it.props[p]=(typeof a[p]==='object'&&a[p])?deep(a[p]):a[p];
      });
      if(a.k==='arrow'){
        it.rel={x1:(a.x1-bb.l)/W,y1:(a.y1-bb.t)/H,
                x2:(a.x2-bb.l)/W,y2:(a.y2-bb.t)/H};
        if(Array.isArray(a.mid)) it.rel.mid=a.mid.map(function(m){
          return [(m[0]-bb.l)/W,(m[1]-bb.t)/H];});
      } else {
        it.rel={x:(x.r.l-bb.l)/W,y:(x.r.t-bb.t)/H,
                w:(x.r.r-x.r.l)/W,h:(x.r.b-x.r.t)/H};
      }
      /* the SHAPE of a shape is what it is, not how it is laid out, and
         MATCH_PROPS excludes it for that reason — but a component that
         forgot its members were stars would be useless */
      if(a.shape) it.shape=a.shape;
      if(a.nohead) it.nohead=a.nohead;
      return it;
    });
    var id=nextCmpId();
    cmpStore()[id]={name:name||'Component',w:W,h:H,items:items};
    /* the objects you defined it FROM become its first instance, so the
       thing you were looking at is a component now rather than a copy of
       one sitting beside it */
    var inst=nextCinst();
    boxes.forEach(function(x,n){
      var a=s2.annots[x.i];
      a.cmp=id;a.ci=n;a.cinst=inst;
    });
    markDirty();
    var l=stage.querySelector('.annot-layer');
    if(l){renderAnnots(l,s2);paintSel(l);}
    return id;
  }
  var cinstSeq=0;
  function nextCinst(){
    cinstSeq++;
    return 'i'+cinstSeq+Math.random().toString(36).slice(2,5);
  }
  function cmpPlace(id,at){
    var def=cmpStore()[id]; if(!def) return 0;
    var s2=pres.slides[cur]; if(!s2) return 0;
    s2.annots=s2.annots||[];
    var W=def.w||20,H=def.h||20;
    var ox=(at?at.x:50)-W/2,oy=(at?at.y:50)-H/2;
    ox=Math.max(0,Math.min(100-W,ox));
    oy=Math.max(0,Math.min(100-H,oy));
    var inst=nextCinst(),made=[];
    (def.items||[]).forEach(function(it,n){
      var a={k:it.k,cmp:id,ci:n,cinst:inst};
      Object.keys(it.props||{}).forEach(function(p){
        a[p]=(typeof it.props[p]==='object'&&it.props[p])
          ?deep(it.props[p]):it.props[p];});
      if(it.shape) a.shape=it.shape;
      if(it.nohead) a.nohead=it.nohead;
      cmpPlaceOne(a,it,ox,oy,W,H);
      s2.annots.push(a);made.push(s2.annots.length-1);
    });
    if(!made.length) return 0;
    markDirty();
    var l=stage.querySelector('.annot-layer');
    if(l){renderAnnots(l,s2);selectMany(l,made);}
    return made.length;
  }
  function cmpPlaceOne(a,it,ox,oy,W,H){
    var r=it.rel||{};
    if(a.k==='arrow'){
      a.x1=ox+(r.x1||0)*W;a.y1=oy+(r.y1||0)*H;
      a.x2=ox+(r.x2||0)*W;a.y2=oy+(r.y2||0)*H;
      if(Array.isArray(r.mid)) a.mid=r.mid.map(function(m){
        return [ox+m[0]*W,oy+m[1]*H];});
    } else {
      a.x=ox+(r.x||0)*W;a.y=oy+(r.y||0)*H;
      if(r.w) a.w=r.w*W;
      if(r.h) a.h=r.h*H;
    }
  }
  /* every instance of a component, across the whole deck, as
     {si, idxs:[…]} — the unit an update walks */
  function cmpInstances(id){
    var seen={},out=[];
    (pres.slides||[]).forEach(function(sl,si){
      (sl.annots||[]).forEach(function(a,i){
        if(!a||a.cmp!==id||!a.cinst) return;
        var key=si+'|'+a.cinst;
        if(!seen[key]){seen[key]={si:si,inst:a.cinst,idxs:[]};
          out.push(seen[key]);}
        seen[key].idxs.push(i);
      });
    });
    return out;
  }
  /* PUSH: this instance becomes the definition, and every other instance
     follows. Content never travels — each instance keeps its own words
     and its own figure, which is the per-instance override the task
     asked for and which MATCH_PROPS gives for free. */
  function cmpPush(id,si,inst){
    var def=cmpStore()[id]; if(!def) return 0;
    var sl=(pres.slides||[])[si]; if(!sl) return 0;
    var layer=(si===cur)?stage.querySelector('.annot-layer'):null;
    var mine=[];
    (sl.annots||[]).forEach(function(a,i){
      if(a&&a.cmp===id&&a.cinst===inst) mine.push({i:i,a:a});});
    if(!mine.length) return 0;
    mine.sort(function(p,q){return (p.a.ci||0)-(q.a.ci||0);});
    var bb={l:1e9,t:1e9,r:-1e9,b:-1e9};
    mine.forEach(function(x){
      var r=layer?annotRectPct(layer,sl,x.i):null;
      if(!r&&x.a.w!=null) r={l:x.a.x,t:x.a.y,
        r:x.a.x+x.a.w,b:x.a.y+x.a.h};
      if(!r&&x.a.k==='arrow') r={l:Math.min(x.a.x1,x.a.x2),
        r:Math.max(x.a.x1,x.a.x2),t:Math.min(x.a.y1,x.a.y2),
        b:Math.max(x.a.y1,x.a.y2)};
      if(!r) return;
      x.r=r;
      bb.l=Math.min(bb.l,r.l);bb.t=Math.min(bb.t,r.t);
      bb.r=Math.max(bb.r,r.r);bb.b=Math.max(bb.b,r.b);});
    var W=Math.max(0.01,bb.r-bb.l),H=Math.max(0.01,bb.b-bb.t);
    def.w=W;def.h=H;
    def.items=mine.map(function(x){
      var a=x.a,it={k:a.k,props:{}};
      MATCH_PROPS.forEach(function(p){
        if(CMP_SKIP[p]) return;
        if(a[p]!==undefined)
          it.props[p]=(typeof a[p]==='object'&&a[p])?deep(a[p]):a[p];
      });
      if(a.k==='arrow'){
        it.rel={x1:(a.x1-bb.l)/W,y1:(a.y1-bb.t)/H,
                x2:(a.x2-bb.l)/W,y2:(a.y2-bb.t)/H};
        if(Array.isArray(a.mid)) it.rel.mid=a.mid.map(function(m){
          return [(m[0]-bb.l)/W,(m[1]-bb.t)/H];});
      } else if(x.r){
        it.rel={x:(x.r.l-bb.l)/W,y:(x.r.t-bb.t)/H,
                w:(x.r.r-x.r.l)/W,h:(x.r.b-x.r.t)/H};
      } else it.rel={x:0,y:0,w:1,h:1};
      if(a.shape) it.shape=a.shape;
      if(a.nohead) it.nohead=a.nohead;
      return it;
    });
    return cmpSyncAll(id,si,inst);
  }
  /* re-stamp every OTHER instance from the definition. The origin is the
     instance's own top-left corner, so an instance you dragged somewhere
     stays where you dragged it. */
  function cmpSyncAll(id,skipSi,skipInst){
    var def=cmpStore()[id]; if(!def) return 0;
    var n=0;
    cmpInstances(id).forEach(function(g){
      if(g.si===skipSi&&g.inst===skipInst) return;
      var sl=pres.slides[g.si];
      var mine=g.idxs.map(function(i){return {i:i,a:sl.annots[i]};})
        .filter(function(x){return !!x.a;});
      if(!mine.length) return;
      var ox=1e9,oy=1e9;
      mine.forEach(function(x){
        var a=x.a;
        ox=Math.min(ox,a.k==='arrow'?Math.min(a.x1,a.x2):(a.x||0));
        oy=Math.min(oy,a.k==='arrow'?Math.min(a.y1,a.y2):(a.y||0));
      });
      var W=def.w||20,H=def.h||20;
      /* the definition may have gained or lost members. Extra instance
         items are removed, missing ones are added — an instance that
         silently kept an old member would not be an instance. */
      var byCi={};
      mine.forEach(function(x){byCi[x.a.ci]=x;});
      (def.items||[]).forEach(function(it,k){
        var hit=byCi[k];
        if(hit){
          var a=hit.a;
          /* CONTENT IS NEVER TOUCHED: only the fields the definition
             carries are written, and content is not among them */
          Object.keys(it.props||{}).forEach(function(p){
            a[p]=(typeof it.props[p]==='object'&&it.props[p])
              ?deep(it.props[p]):it.props[p];});
          if(it.shape) a.shape=it.shape;
          cmpPlaceOne(a,it,ox,oy,W,H);
          delete byCi[k];
        } else {
          var na={k:it.k,cmp:id,ci:k,cinst:g.inst};
          Object.keys(it.props||{}).forEach(function(p){
            na[p]=(typeof it.props[p]==='object'&&it.props[p])
              ?deep(it.props[p]):it.props[p];});
          if(it.shape) na.shape=it.shape;
          if(it.nohead) na.nohead=it.nohead;
          cmpPlaceOne(na,it,ox,oy,W,H);
          sl.annots.push(na);
        }
      });
      Object.keys(byCi).forEach(function(k){
        var at=sl.annots.indexOf(byCi[k].a);
        if(at>=0) sl.annots.splice(at,1);
      });
      n++;
    });
    markDirty();refresh();
    return n;
  }
  function cmpDetach(si,inst){
    var sl=(pres.slides||[])[si]; if(!sl) return 0;
    var n=0;
    (sl.annots||[]).forEach(function(a){
      if(!a||a.cinst!==inst) return;
      delete a.cmp;delete a.ci;delete a.cinst;n++;});
    if(!n) return 0;
    markDirty();
    var l=stage.querySelector('.annot-layer');
    if(l){renderAnnots(l,sl);paintSel(l);}
    return n;
  }
  /* ---- THE ARRANGEMENTS DIALOG -----------------------------------------
     The library on the left, drawn; the per-slide suggestions on the
     right, ticked but overridable. Nothing is applied until you say so. */
  (function(){
    var dlg=$('#ar-dlg'); if(!dlg) return;
    var pickFor={};      /* slide index -> arrangement id, '' = leave it */
    function chosen(){
      var out=[];
      (pres.slides||[]).forEach(function(sl,i){
        var id=pickFor[i];
        if(id) out.push({i:i,arr:arrById(id)});
      });
      return out.filter(function(e){return e.arr;});
    }
    function sync(){
      var n=chosen().length,c=$('#ar-count');
      if(c) c.textContent=n?(n+' slide'+(n===1?'':'s')+' will be re-laid '
        +'out'):'Nothing chosen';
      var ok=$('#ar-ok');
      if(ok){ok.disabled=!n;
        ok.textContent=n?('Arrange '+n+' slide'+(n===1?'':'s')):'Arrange';}
    }
    /* the thumbnail of what it would arrange TO. miniDiagram draws any
       slide-shaped thing, and an arrangement IS a slide, so this is free
       and cannot drift from what the canvas would render. */
    function arrThumb(arr){
      return miniDiagram({layout:'blank',panes:[],annots:arr.annots||[]});
    }
    function buildLib(){
      var host=$('#ar-lib'); if(!host) return;
      host.innerHTML='';
      var list=arrList();
      if(!list.length){
        host.innerHTML='<div class="selpane-empty">None yet. Lay a slide '
          +'out the way you like it, then “Save this slide” — the words '
          +'and figures are not kept, only the arrangement.</div>';
        return;
      }
      list.forEach(function(a){
        var row=document.createElement('div');row.className='ar-row';
        var th=document.createElement('div');th.className='ar-th';
        th.appendChild(arrThumb(a));
        row.appendChild(th);
        var mid=document.createElement('div');mid.className='ar-mid';
        var nm=document.createElement('input');
        nm.className='ar-name';nm.type='text';nm.value=a.label||'';
        nm.title='What to call this arrangement';
        nm.addEventListener('keydown',function(e){e.stopPropagation();});
        nm.addEventListener('blur',function(){
          var v=nm.value.trim(); if(!v||v===a.label) return;
          var l=arrList();
          l.forEach(function(x){if(x.id===a.id) x.label=v;});
          arrSave(l);buildLib();buildSug();
        });
        mid.appendChild(nm);
        var sub=document.createElement('div');
        sub.className='ar-sub';
        sub.textContent=(a.annots||[]).length+' item'
          +((a.annots||[]).length===1?'':'s')
          +(a.page==='poster'?' · poster':'');
        mid.appendChild(sub);
        row.appendChild(mid);
        var ctr=document.createElement('span');ctr.className='fp-ctr';
        [['⤓',function(){
            /* apply it to the slide you are on, right now — the shortest
               path from "that one" to "do it" */
            var n=arrApply(a,cur);
            if(!n){toast('Nothing on this slide matches that '
              +'arrangement');return;}
            markDirty();refresh();buildSug();
            toast(n+' item'+(n===1?'':'s')+' re-laid out on this slide');
          },'Use it on this slide now'],
         [bic('exit'),function(){
            arrSave(arrList().filter(function(x){return x.id!==a.id;}));
            Object.keys(pickFor).forEach(function(k){
              if(pickFor[k]===a.id) delete pickFor[k];});
            buildLib();buildSug();sync();
          },'Forget this arrangement']]
          .forEach(function(pr){
            var b=document.createElement('button');
            b.className='film-mini';b.innerHTML=pr[0];b.title=pr[2];
            b.setAttribute('aria-label',pr[2]);
            b.addEventListener('click',function(ev){
              ev.stopPropagation();pr[1]();});
            ctr.appendChild(b);
          });
        row.appendChild(ctr);
        host.appendChild(row);
      });
    }
    function buildSug(){
      var host=$('#ar-sug'); if(!host) return;
      host.innerHTML='';
      var list=arrList();
      if(!list.length){
        host.innerHTML='<div class="selpane-empty">Save an arrangement '
          +'first and every slide will be checked against it here.</div>';
        return;
      }
      (pres.slides||[]).forEach(function(sl,i){
        var row=document.createElement('label');
        row.className='find-ck ar-srow';
        var ck=document.createElement('input');ck.type='checkbox';
        ck.checked=!!pickFor[i];
        /* NOT disabled when empty: clearing a suggestion and taking one
           up are the same control, and a checkbox you cannot tick is a
           checkbox that looks broken */
        ck.addEventListener('change',function(){
          if(!ck.checked) pickFor[i]=''; else {
            var b=arrBest(sl); pickFor[i]=b?b.arr.id:'';
          }
          buildSug();sync();});
        row.appendChild(ck);
        var n=document.createElement('span');
        n.className='aa-slide-n';n.textContent=(i+1);
        row.appendChild(n);
        var t=document.createElement('span');
        t.className='ar-st';t.textContent=slideTitle(sl);
        row.appendChild(t);
        /* WHICH arrangement, changeable per slide: the suggestion is a
           starting point, not a verdict */
        var sel=document.createElement('select');
        sel.className='ar-ssel';
        var o0=document.createElement('option');
        o0.value='';o0.textContent='leave it';
        sel.appendChild(o0);
        list.forEach(function(a){
          var o=document.createElement('option');
          o.value=a.id;
          o.textContent=a.label+' · '
            +Math.round(arrScore(a,sl)*100)+'%';
          sel.appendChild(o);
        });
        sel.value=pickFor[i]||'';
        sel.addEventListener('click',function(e){e.stopPropagation();});
        sel.addEventListener('change',function(){
          pickFor[i]=sel.value;buildSug();sync();});
        row.appendChild(sel);
        host.appendChild(row);
      });
    }
    function seed(){
      pickFor={};
      (pres.slides||[]).forEach(function(sl,i){
        var b=arrBest(sl);
        /* only a CONFIDENT match is ticked for you. A half-fitting
           arrangement offered as a default is how an automatic tool
           earns its reputation for wrecking things. */
        pickFor[i]=(b&&b.score>=0.75)?b.arr.id:'';
      });
    }
    function open(){seed();buildLib();buildSug();sync();dlg.hidden=false;}
    function close(){dlg.hidden=true;}
    $('#ar-close').addEventListener('click',close);
    $('#ar-cancel').addEventListener('click',close);
    dlg.addEventListener('click',function(e){if(e.target===dlg) close();});
    dlg.addEventListener('keydown',function(e){
      e.stopPropagation();
      if(e.key==='Escape'){e.preventDefault();close();}
    });
    $('#ar-save').addEventListener('click',function(e){
      e.stopPropagation();
      var sl=pres.slides[cur];
      if(!sl||!(sl.annots||[]).length){
        toast('Lay something out on this slide first');return;}
      var nm=prompt('Call this arrangement:',
        slideTitle(sl).slice(0,30)||'Arrangement');
      if(nm==null) return;
      nm=nm.trim(); if(!nm) return;
      var l=arrList();
      l.push(arrFromSlide(sl,nm));
      arrSave(l);
      /* re-seed: the suggestions were computed against a library that did
         not contain this yet — and on the first save that library was
         empty, so nothing was suggested at all */
      seed();buildLib();buildSug();sync();
      toast('“'+nm+'” saved — offered on every deck you open here');
    });
    $('#ar-all').addEventListener('click',function(){
      (pres.slides||[]).forEach(function(sl,i){
        var b=arrBest(sl);
        if(b&&b.score>0) pickFor[i]=b.arr.id;});
      buildSug();sync();});
    $('#ar-none').addEventListener('click',function(){
      pickFor={};buildSug();sync();});
    $('#ar-ok').addEventListener('click',function(){
      var list=chosen(),moved=0;
      list.forEach(function(e){moved+=arrApply(e.arr,e.i);});
      close();
      if(!moved){toast('Nothing on those slides matched');return;}
      markDirty();refresh();
      toast(moved+' item'+(moved===1?'':'s')+' re-laid out across '
        +list.length+' slide'+(list.length===1?'':'s')
        +'. Ctrl+Z undoes the lot.');
    });
    window.SemDeckArrange=open;
  })();
  /* ---- THE STYLE-SET GALLERY -------------------------------------------
     Every card is SET IN the type it is offering, because a look is
     chosen by looking. The same reason the Styles menu's rows are
     specimens rather than a list of point sizes. */
  (function(){
    var dlg=$('#ss-dlg'); if(!dlg) return;
    function unstyledCount(){
      return stdBoxes().filter(function(p){
        return !(p.a.style&&STYLE_DEFAULTS[p.a.style]);}).length;
    }
    function card(t){
      var c=document.createElement('button');
      c.className='ss-card';c.type='button';
      var h=document.createElement('div');h.className='ss-name';
      h.textContent=t.label;
      if(t.mine){
        var chip=document.createElement('span');
        chip.className='ss-mine';chip.textContent='yours';
        h.appendChild(chip);
      }
      c.appendChild(h);
      /* the specimen: three real lines at the set's own relative sizes,
         scaled to fit the card rather than to the page */
      var spec=document.createElement('div');spec.className='ss-spec';
      [['title','Title'],['h2','A heading'],
       ['body','Body text that runs on a little.'],
       ['caption','A caption']].forEach(function(pr){
        var d=(t.styles||{})[pr[0]]; if(!d) return;
        var ln=document.createElement('div');
        ln.className='ss-line';ln.textContent=pr[1];
        ln.style.fontSize=Math.max(8,Math.min(23,d.size*2.5))+'px';
        ln.style.fontWeight=d.b?'700':'400';
        if(d.i) ln.style.fontStyle='italic';
        if(d.font) ln.style.fontFamily=fontCss(d.font);
        if(d.color) ln.style.color=d.color;
        if(d.lh) ln.style.lineHeight=d.lh;
        spec.appendChild(ln);
      });
      c.appendChild(spec);
      var note=document.createElement('div');
      note.className='ss-note';note.textContent=t.note||'';
      c.appendChild(note);
      if(t.mine){
        var x=document.createElement('span');
        x.className='ss-del';x.innerHTML=bic('exit');
        x.title='Forget this set';
        x.addEventListener('click',function(e){
          e.stopPropagation();
          saveMyStyleSets(myStyleSets().filter(function(m){
            return m.id!==t.id;}));
          build();
        });
        c.appendChild(x);
      }
      c.addEventListener('click',function(){
        var auto=$('#ss-auto');
        var r=(auto&&auto.checked)?autoStyleDeck(t.id)
          :{named:0,styled:applyStyleSet(t.id),set:t};
        markDirty();refresh();build();
        var msg='“'+t.label+'” applied';
        if(r&&r.named) msg+=' — '+r.named+' box'+(r.named===1?'':'es')
          +' were named from their size first';
        else if(r&&!r.styled) msg+=' — but nothing here wears a named '
          +'style, so nothing moved. Tick the box below to name them.';
        toast(msg+(r&&r.styled?'. Ctrl+Z undoes it.':''));
      });
      return c;
    }
    function build(){
      var g=$('#ss-grid'); if(!g) return;
      g.innerHTML='';
      STYLE_SETS.forEach(function(t){g.appendChild(card(t));});
      myStyleSets().forEach(function(t){
        var m=deep(t);m.mine=1;
        g.appendChild(card(m));});
      var w=$('#ss-what'),n=unstyledCount();
      if(w) w.textContent=n
        ? (n+' text box'+(n===1?'':'es')+' on this deck wear no named '
          +'style. Picking a set below will name them from their size and '
          +'then style them.')
        : 'Everything here already wears a named style, so a set restyles '
          +'it straight away.';
      var aw=$('#ss-autowrap'); if(aw) aw.hidden=!n;
    }
    function open(){build();dlg.hidden=false;}
    function close(){dlg.hidden=true;}
    $('#ss-close').addEventListener('click',close);
    $('#ss-cancel').addEventListener('click',close);
    dlg.addEventListener('click',function(e){if(e.target===dlg) close();});
    dlg.addEventListener('keydown',function(e){
      e.stopPropagation();
      if(e.key==='Escape'){e.preventDefault();close();}
    });
    $('#ss-save').addEventListener('click',function(e){
      e.stopPropagation();
      var nm=prompt('Call this style set:','My set');
      if(nm==null) return;
      nm=nm.trim(); if(!nm) return;
      var st={};
      styleOrder().forEach(function(id){
        var d=styleDef(id); if(!d) return;
        var o={size:d.size};
        ['b','i','font','color','align','lh','pspace'].forEach(function(k){
          if(d[k]!==undefined) o[k]=d[k];});
        st[id]=o;
      });
      var list=myStyleSets();
      list.push({id:'ss'+Date.now().toString(36),label:nm,
        note:'Saved from “'+(pres.name||'a deck')+'”.',styles:st});
      saveMyStyleSets(list);
      build();
      toast('“'+nm+'” saved — it is offered on every deck you open here');
    });
    window.SemDeckStyleSets=open;
  })();
  /* ---- ONE SLIDE'S LAYOUT, GIVEN TO SEVERAL ----------------------------
     The Match slide menu only ever PULLED — pick another slide and this
     one takes its arrangement — so making six slides agree meant doing it
     six times, standing on a different slide each time (2026-08-22).
     The model is the slide you are ON, which is the one you have just got
     looking right. */
  (function(){
    var dlg=$('#ms-dlg'); if(!dlg) return;
    var msOff=new WeakMap();       /* excluded, keyed on the slide OBJECT */
    function has(s){return !!s&&!msOff.has(s)&&s!==pres.slides[cur];}
    function idxs(){
      var out=[];
      (pres.slides||[]).forEach(function(s,i){if(has(s)) out.push(i);});
      return out;
    }
    function words(){
      var n=idxs().length;
      return n?(n+' slide'+(n===1?'':'s')+' will be re-laid out')
        :'No slides chosen';
    }
    function sync(){
      var c=$('#ms-count'); if(c) c.textContent=words();
      var ok=$('#ms-ok'),n=idxs().length;
      if(ok){ok.disabled=!n;
        ok.textContent=n?('Match '+n+' slide'+(n===1?'':'s')):'Match';}
    }
    function build(){
      var w=$('#ms-what');
      if(w) w.innerHTML='Every one of them takes the layout of '
        +'<span class="aa-chip">slide '+(cur+1)+'</span> — the position, '
        +'size and styling of what is on it, matched up by kind. '
        +'Content never moves.';
      var host=$('#ms-scope'); if(!host) return;
      host.innerHTML='';
      sectionRuns().forEach(function(r){
        if(r.id){
          var h=document.createElement('div');h.className='aa-sech';
          var hck=document.createElement('input');hck.type='checkbox';
          var on=0,tot=0,i;
          for(i=r.at;i<r.at+r.n;i++){
            if(i===cur) continue;
            tot++; if(has(pres.slides[i])) on++;
          }
          hck.checked=on>0;
          hck.indeterminate=on>0&&on<tot;
          hck.disabled=!tot;
          hck.addEventListener('change',function(){
            for(var j=r.at;j<r.at+r.n;j++){
              if(j===cur) continue;
              if(hck.checked) msOff['delete'](pres.slides[j]);
              else msOff.set(pres.slides[j],1);
            }
            build();sync();
          });
          h.appendChild(hck);
          var ht=document.createElement('span');
          ht.textContent=r.name;h.appendChild(ht);
          host.appendChild(h);
        }
        var grid=document.createElement('div');grid.className='aa-grid';
        for(var k=r.at;k<r.at+r.n;k++)(function(i2){
          var sl=pres.slides[i2]; if(!sl) return;
          var lab=document.createElement('label');
          lab.className='find-ck'+(i2===cur?' aa-no':'');
          var ck=document.createElement('input');ck.type='checkbox';
          ck.checked=has(sl);
          /* the model cannot also be a destination */
          ck.disabled=(i2===cur);
          ck.addEventListener('change',function(){
            if(ck.checked) msOff['delete'](sl); else msOff.set(sl,1);
            sync();});
          lab.appendChild(ck);
          var n2=document.createElement('span');
          n2.className='aa-slide-n';n2.textContent=(i2+1);
          lab.appendChild(n2);
          var t=document.createElement('span');
          t.className='aa-slide-t';
          t.textContent=(i2===cur)?(slideTitle(sl)+' (the model)')
            :slideTitle(sl);
          lab.appendChild(t);
          lab.title=t.textContent;
          grid.appendChild(lab);
        })(k);
        host.appendChild(grid);
      });
    }
    function open(){
      if((pres.slides||[]).length<2){
        toast('There is only one slide to match');return;}
      build();sync();dlg.hidden=false;
    }
    function close(){dlg.hidden=true;}
    $('#ms-ok').addEventListener('click',function(){
      var list=idxs(),moved=0,none=0;
      list.forEach(function(i){
        var r=matchSlide(cur,i);
        if(!r) return;
        if(r.moved) moved+=r.moved; else none++;
      });
      close();
      if(!moved){toast('Nothing on those slides matched what is on this '
        +'one — only items of the same kind travel');return;}
      var msg=moved+' item'+(moved===1?'':'s')+' re-laid out across '
        +list.length+' slide'+(list.length===1?'':'s');
      if(none) msg+=' — '+none+' had nothing in common with this one';
      markDirty();refresh();
      toast(msg+'. Ctrl+Z undoes the lot.');
    });
    $('#ms-cancel').addEventListener('click',close);
    $('#ms-close').addEventListener('click',close);
    dlg.addEventListener('click',function(e){if(e.target===dlg) close();});
    dlg.addEventListener('keydown',function(e){
      e.stopPropagation();
      if(e.key==='Escape'){e.preventDefault();close();}
    });
    $('#ms-all').addEventListener('click',function(){
      (pres.slides||[]).forEach(function(s){msOff['delete'](s);});
      build();sync();});
    $('#ms-none').addEventListener('click',function(){
      (pres.slides||[]).forEach(function(s){msOff.set(s,1);});
      build();sync();});
    window.SemDeckMatchMany=open;
  })();
  /* pick which slide to match, from a small list of the others */
  function openMatchMenu(btn){
    var old=$('#match-menu'); if(old) old.remove();
    var m=document.createElement('div');
    m.className='sh-menu match-menu';m.id='match-menu';
    /* the OTHER direction, first, because it is the one that scales: you
       have just got this slide looking right and want the rest to follow
       (2026-08-22). Pulling one slide's layout onto this one is still
       below it, unchanged. */
    var push=document.createElement('button');
    push.className='dbtn vw-opt';
    push.innerHTML=bic('inherit')+' Give this slide’s layout to…';
    push.title='Choose which slides take the arrangement of this one';
    push.addEventListener('click',function(e){
      e.stopPropagation();m.remove();
      if(typeof window.SemDeckMatchMany==='function')
        window.SemDeckMatchMany();
    });
    m.appendChild(push);
    /* the saved-arrangements library, in the same menu: matching to
       another slide and matching to a saved layout are the same verb with
       a different model, so they belong one click apart (2026-08-22) */
    var arr=document.createElement('button');
    arr.className='dbtn vw-opt';
    arr.innerHTML=bic('layouts')+' Arrangements…';
    arr.title='Layouts you have saved, with a thumbnail of each — and '
      +'which slides they would fit';
    arr.addEventListener('click',function(e){
      e.stopPropagation();m.remove();
      if(typeof window.SemDeckArrange==='function') window.SemDeckArrange();
    });
    m.appendChild(arr);
    menuHead(m,'take the layout of…');
    var any=false;
    (pres.slides||[]).forEach(function(sl,i){
      if(i===cur) return;
      any=true;
      var b=document.createElement('button');
      b.className='dbtn vw-opt';
      var n=document.createElement('span');n.className='fh-n';
      n.textContent=(i+1);b.appendChild(n);
      var t=document.createElement('span');
      t.textContent=slideTitle(sl);b.appendChild(t);
      b.addEventListener('click',function(e){
        e.stopPropagation();m.remove();
        var r=matchSlide(i,cur);
        if(!r) return;
        if(!r.moved){
          toast('Slide '+(i+1)+' and this one have no matching items — '
            +'nothing to copy a layout from');
          return;
        }
        markDirty();refresh();
        var note='Matched '+r.moved+' item'+(r.moved===1?'':'s')
          +' to slide '+(i+1);
        if(r.missing.length)
          note+=' — '+r.missing.length+' kind'
            +(r.missing.length===1?'':'s')+' here had nothing to match';
        toast(note);
      });
      m.appendChild(b);
    });
    if(!any) menuHead(m,'there is only one slide');
    document.body.appendChild(m);
    floatMenu(btn,m);
    setTimeout(function(){
      document.addEventListener('click',function once(e){
        if(!m.contains(e.target)) m.remove();
        document.removeEventListener('click',once);
      });
    },0);
  }
  /* one worded menu for everything that arranges: line up, space out,
     stack order, rotate, tidy into a formation */
  wireFloatDropdown('fmt-alignwrap','fmt-align-btn','fmt-align-menu',
    [['left','Align left edges'],
     ['hcenter','Align centres (side to side)'],
     ['right','Align right edges'],
     ['top','Align top edges'],
     ['vmiddle','Align middles (top to bottom)'],
     ['bottom','Align bottom edges'],
     /* align to the PAGE, not to each other. With one item selected the
        two are indistinguishable, which is why the six above already do
        the right thing on their own — these are for centring a whole
        group on the page without first selecting something at its edge
        (2026-08-20, user asked for arrange "like what there is in photo
        shop editors ... really thorough") */
     ['p:hcenter','Centre on the page, side to side'],
     ['p:vmiddle','Centre on the page, top to bottom'],
     ['p:both','Centre on the page, both ways'],
     ['d:h','Equal gaps across (3+ items)'],
     ['d:v','Equal gaps down (3+ items)'],
     ['g:h','Close the gaps across'],
     ['g:v','Close the gaps down'],
     ['o:front','Bring to front'],
     ['o:forward','Bring forward one'],
     ['o:backward','Send backward one'],
     ['o:back','Send to back'],
     ['f:h','Flip left to right'],
     ['f:v','Flip top to bottom'],
     ['o:rotl','Rotate left 15°'],
     ['o:rotr','Rotate right 15°'],
     ['r:90','Turn a quarter turn right'],
     ['r:-90','Turn a quarter turn left'],
     ['r:0','Straighten (no rotation)'],
     ['o:row','Tidy into a row'],
     ['o:grid','Tidy into a grid'],
     ['m:w','Match widths to the widest'],
     ['m:h','Match heights to the tallest'],
     ['m:both','Match both to the biggest'],
     /* the deck-wide version of the three rows above it, which is why it
        lives here and not in a group of its own: this menu is already
        where "make these things match" is kept, and it is shown for
        every kind of item, which the Styles menu beside it is not
        (2026-08-22) */
     ['a:type','Apply this look to every one of its type…'],
     /* the two POINT-AT-IT verbs. They live here, with the other
        make-things-match rows, and cost the ribbon nothing (2026-08-22) */
     ['x:to','Copy this look to objects I click…'],
     ['x:from','Take the look of an object I click…'],
     /* the LAYOUT sibling of the two rows above: same gesture, but what
        travels is the arrangement rather than the look (TASKS T8) */
     ['x:layout','Lay these out like a group I click…'],
     /* the REPORT-first sibling of "Tidy into a row" above: that one
        rearranges what you selected, this one looks at the whole page
        and asks first (TASKS T9) */
     ['o:tidyup','Tidy up this page…'],
     /* the deck's own colours, reached from the menu that is shown for
        every kind of item — the Design tab's own row is the other door
        (TASKS T12) */
     ['k:tokens','This deck\u2019s colours and corner…'],
     /* SELECTING is not arranging, but this is the menu that is shown
        for every kind of item and already keeps the "everything like
        this one" verbs — and the ribbon has no width to spare for a
        button of its own (TASKS T5) */
     ['s:by','Select everything on this slide like this…']],'al',
    function(what){
      if(what==='s:by'){openSelectByMenu($('#fmt-align-btn'));return;}
      if(what==='o:tidyup'){showTidyPane();return;}
      if(what==='k:tokens'){openTokenPicker($('#fmt-align-btn'));return;}
      if(what.indexOf('a:')===0){
        if(typeof window.SemDeckApplyDlg==='function')
          window.SemDeckApplyDlg();
        return;
      }
      if(what.indexOf('x:')===0){armMatch(what.slice(2));return;}
      if(what.indexOf('d:')===0){distributeSel(what.slice(2));return;}
      if(what.indexOf('p:')===0){centreOnPage(what.slice(2));return;}
      if(what.indexOf('g:')===0){closeGaps(what.slice(2));return;}
      if(what.indexOf('f:')===0){flipSel(what.slice(2));return;}
      if(what.indexOf('r:')===0){turnSel(+what.slice(2));return;}
      if(what.indexOf('m:')===0){sameSize(what.slice(2));return;}
      if(what.indexOf('o:')===0){
        /* drive the original buttons so each keeps its one implementation */
        var b=$({front:'#fmt-front',back:'#fmt-back',rotl:'#fmt-rotl',
          rotr:'#fmt-rotr',row:'#fmt-arline',grid:'#fmt-argrid',
          forward:'#fmt-forward',backward:'#fmt-backward'
        }[what.slice(2)]);
        if(b) b.click();
        return;
      }
      alignSel(what);
    });
  var arRowBtn=$('#fmt-arline');
  if(arRowBtn) arRowBtn.addEventListener('click',arrangeRow);
  var arGridBtn=$('#fmt-argrid');
  if(arGridBtn) arGridBtn.addEventListener('click',arrangeGrid);
  wireFloatDropdown('fmt-samewrap','fmt-same','fmt-same-menu',
    [['last','Match LAST selected'],
     ['first','Match FIRST selected'],
     ['largest','Match the largest'],
     ['smallest','Match the smallest']],'same',
    function(mode){sameSize(mode);});
  var repBtn=$('#fmt-replace');
  if(repBtn) repBtn.addEventListener('click',function(){
    if(typeof selAnnot==='number') startPick(selAnnot);
  });
  /* Previous figure <-> Live figure: rescue ONE frame after a notebook
     re-run broke its plot, without giving up the other frames' updates */
  var revBtn=$('#fmt-revert');
  if(revBtn) revBtn.addEventListener('click',function(){
    var s=pres.slides[cur]; if(!s) return;
    var a=annotByIdx(s,selAnnot);
    if(!a||a.k!=='cell'||!a.ref) return;
    if(frozenFrames.has(a)){
      frozenFrames.delete(a);
      toast('Back to the live figure');
    } else {
      var prev=frameSnapsPrev[normRef(a.ref)];
      if(!prev){toast('No pre-refresh figure for this frame yet');return;}
      frozenFrames.set(a,prev);
      toast('Showing the figure from before the refresh');
    }
    var l=stage.querySelector('.annot-layer');
    if(l){renderAnnots(l,s);paintSel(l);}
    showFmt();
  });
  /* Lock figure <-> Unlock: pin a frame to its notebook's current git
     commit — refreshes stop touching it (and it renders even when the
     notebook is closed) */
  function lockFrame(a){
    var pr=splitRef(normRef(a.ref)||String(a.ref||''));
    var path=pr[0]?nbPathFor(pr[0]):null;
    if(!path||/^https?:/i.test(path)){
      toast('Locking needs a local notebook file');
      return Promise.resolve(false);
    }
    var sh=APP.shells[pr[0]];
    if(sh&&sh.version&&/^git:/.test(sh.version)){
      a.lockver={commit:sh.version.slice(4)};
      toast('Locked to '+a.lockver.commit+' (the version being viewed)');
      return Promise.resolve(true);
    }
    return APP.api('/api/gitstate',{path:path}).then(function(g){
      if(!g||!g.repo||!g.commit){
        toast('Not in a git repository — commit the notebook first');
        return false;
      }
      a.lockver={commit:g.commit.id,msg:g.commit.msg||'',
        date:g.commit.date||''};
      toast('Locked to '+g.commit.id
        +(g.commit.msg?' “'+g.commit.msg+'”':''));
      return true;
    }).catch(function(e){
      toast('Lock failed: '+((e&&e.message)||e));
      return false;
    });
  }
  var lockVBtn=$('#fmt-lockver');
  if(lockVBtn) lockVBtn.addEventListener('click',function(){
    var s=pres.slides[cur]; if(!s) return;
    var a=annotByIdx(s,selAnnot);
    if(!a||a.k!=='cell'||!a.ref) return;
    function done(){
      markDirty();
      var l=stage.querySelector('.annot-layer');
      if(l){renderAnnots(l,s);paintSel(l);}
      showFmt();
    }
    if(a.lockver){
      delete a.lockver;
      toast('Unlocked — this figure follows notebook refreshes again');
      done();
      return;
    }
    lockFrame(a).then(function(ok){if(ok) done();});
  });
  /* Locate in notebook: leave the deck and land on the card this frame
     was placed from — its home in the notebook, scrolled to + flashed */
  var locBtn=$('#fmt-locate');
  if(locBtn) locBtn.addEventListener('click',function(){
    var s=pres.slides[cur]; if(!s) return;
    var a=annotByIdx(s,selAnnot);
    if(!a||a.k!=='cell'||!a.ref) return;
    var it=resolveRef(a.ref);
    var card=cardEl(a.ref);
    if(!it||!card){toast("That card's notebook is not open");return;}
    closeDeck();
    if(APP.activate) APP.activate(it.nb);
    setTimeout(function(){
      card.scrollIntoView({behavior:'smooth',block:'center'});
      card.classList.add('target-flash');
      setTimeout(function(){card.classList.remove('target-flash');},1400);
    },60);
  });
  var pickCancel=$('#pick-cancel');
  if(pickCancel) pickCancel.addEventListener('click',function(){
    endPick();
  });
  /* ---- QR generator (2026-08-04): byte mode, ECC level M, versions
     1-10 (~200 chars — plenty for a repo / DOI link), all 8 masks with
     spec penalty scoring; output is vector SVG so it prints crisp at A0.
     Self-contained on purpose: a poster QR must not depend on someone
     else's URL-shortener service. Verified by machine-decoding the
     rendered output (see tests). ---- */
  var QR_M_TAB=[            /* [version, ecPerBlock, data cw per block] */
    [1,10,[16]],[2,16,[28]],[3,26,[44]],[4,18,[32,32]],[5,24,[43,43]],
    [6,16,[27,27,27,27]],[7,18,[31,31,31,31]],[8,22,[38,38,39,39]],
    [9,22,[36,36,36,37,37]],[10,26,[43,43,43,43,44]]];
  var QR_ALIGN=[[],[6,18],[6,22],[6,26],[6,30],[6,34],[6,22,38],
    [6,24,42],[6,26,46],[6,28,50]];
  var GF_EXP=new Array(512),GF_LOG=new Array(256);
  (function(){
    var x=1,i;
    for(i=0;i<255;i++){
      GF_EXP[i]=x;GF_LOG[x]=i;
      x<<=1; if(x&256) x^=0x11d;
    }
    for(i=255;i<512;i++) GF_EXP[i]=GF_EXP[i-255];
  })();
  function gfMul(a,b){return (a&&b)?GF_EXP[GF_LOG[a]+GF_LOG[b]]:0;}
  function rsEc(data,n){
    var g=[1],i,j;                 /* generator, highest degree first */
    for(i=0;i<n;i++){
      var ng=[],k;
      for(k=0;k<=g.length;k++) ng.push(0);
      for(j=0;j<g.length;j++){
        ng[j]^=g[j];
        ng[j+1]^=gfMul(g[j],GF_EXP[i]);
      }
      g=ng;
    }
    var res=[];
    for(i=0;i<n;i++) res.push(0);
    for(i=0;i<data.length;i++){
      var f=data[i]^res[0];
      res.shift();res.push(0);
      if(f) for(j=0;j<n;j++) res[j]^=gfMul(g[j+1],f);
    }
    return res;
  }
  function qrMatrix(text){
    var bytes=[],enc=encodeURIComponent(text),i,j,x,y;
    for(i=0;i<enc.length;i++){
      if(enc[i]==='%'){bytes.push(parseInt(enc.substr(i+1,2),16));i+=2;}
      else bytes.push(enc.charCodeAt(i));
    }
    var ver=0,tab=null,dataCw=0;
    for(i=0;i<QR_M_TAB.length;i++){
      var cw=0;
      for(j=0;j<QR_M_TAB[i][2].length;j++) cw+=QR_M_TAB[i][2][j];
      if(4+(QR_M_TAB[i][0]<10?8:16)+bytes.length*8<=cw*8){
        ver=QR_M_TAB[i][0];tab=QR_M_TAB[i];dataCw=cw;break;}
    }
    if(!ver) return null;
    var bits=[];
    function put(v,n){for(var k=n-1;k>=0;k--) bits.push((v>>k)&1);}
    put(4,4);
    put(bytes.length,ver<10?8:16);
    for(i=0;i<bytes.length;i++) put(bytes[i],8);
    put(0,Math.min(4,dataCw*8-bits.length));
    while(bits.length%8) bits.push(0);
    var data=[];
    for(i=0;i<bits.length;i+=8){
      var v8=0;
      for(j=0;j<8;j++) v8=(v8<<1)|bits[i+j];
      data.push(v8);
    }
    var pi=0;
    while(data.length<dataCw) data.push([0xec,0x11][(pi++)%2]);
    var blocks=[],ecs=[],off=0,maxD=0;
    for(i=0;i<tab[2].length;i++){
      var d=data.slice(off,off+tab[2][i]);off+=tab[2][i];
      blocks.push(d);ecs.push(rsEc(d,tab[1]));
      maxD=Math.max(maxD,d.length);
    }
    var seq=[];
    for(i=0;i<maxD;i++) for(j=0;j<blocks.length;j++)
      if(i<blocks[j].length) seq.push(blocks[j][i]);
    for(i=0;i<tab[1];i++) for(j=0;j<ecs.length;j++)
      seq.push(ecs[j][i]);
    var N=17+ver*4,m=[],rsv=[];
    for(y=0;y<N;y++){
      var r1=[],r2=[];
      for(x=0;x<N;x++){r1.push(0);r2.push(0);}
      m.push(r1);rsv.push(r2);
    }
    function set(px,py,v){
      if(px<0||py<0||px>=N||py>=N) return;
      m[py][px]=v?1:0;rsv[py][px]=1;
    }
    function finder(cx,cy){
      for(var dy=-1;dy<=7;dy++)for(var dx=-1;dx<=7;dx++)
        set(cx+dx,cy+dy,dx>=0&&dx<=6&&dy>=0&&dy<=6
          &&(dx===0||dx===6||dy===0||dy===6
             ||(dx>=2&&dx<=4&&dy>=2&&dy<=4)));
    }
    finder(0,0);finder(N-7,0);finder(0,N-7);
    for(i=8;i<N-8;i++){
      if(!rsv[6][i]) set(i,6,i%2===0);
      if(!rsv[i][6]) set(6,i,i%2===0);
    }
    var ac=QR_ALIGN[ver-1];
    for(i=0;i<ac.length;i++) for(j=0;j<ac.length;j++){
      var cy=ac[i],cx=ac[j];
      /* skip only the three FINDER corners. An alignment pattern that
         crosses the timing lines (any middle coordinate from v7 up) IS
         drawn — an any-reserved-cell test silently dropped those two
         patterns and shifted the whole bit stream (2026-08-04). */
      if((cy<9&&cx<9)||(cy<9&&cx>N-10)||(cy>N-10&&cx<9)) continue;
      for(var dy2=-2;dy2<=2;dy2++)for(var dx2=-2;dx2<=2;dx2++)
        set(cx+dx2,cy+dy2,
          Math.max(Math.abs(dx2),Math.abs(dy2))!==1);
    }
    set(8,N-8,1);                              /* the dark module */
    for(i=0;i<9;i++){rsv[8][i]=1;rsv[i][8]=1;}
    for(i=N-8;i<N;i++){rsv[8][i]=1;rsv[i][8]=1;}
    if(ver>=7) for(i=0;i<6;i++) for(j=N-11;j<N-8;j++){
      rsv[j][i]=1;rsv[i][j]=1;}
    var bi=0,total=seq.length*8;
    function bitAt(k){return (seq[k>>3]>>(7-(k&7)))&1;}
    var cx2=N-1,up=true;
    while(cx2>0){
      if(cx2===6) cx2--;
      for(var yy=0;yy<N;yy++){
        var py2=up?N-1-yy:yy;
        for(var xx=0;xx<2;xx++){
          var px2=cx2-xx;
          if(rsv[py2][px2]) continue;
          m[py2][px2]=bi<total?bitAt(bi):0;bi++;
        }
      }
      up=!up;cx2-=2;
    }
    function maskBit(mk,my,mx){
      switch(mk){
        case 0:return (mx+my)%2===0;
        case 1:return my%2===0;
        case 2:return mx%3===0;
        case 3:return (mx+my)%3===0;
        case 4:return (Math.floor(my/2)+Math.floor(mx/3))%2===0;
        case 5:return (mx*my)%2+(mx*my)%3===0;
        case 6:return ((mx*my)%2+(mx*my)%3)%2===0;
        default:return ((mx+my)%2+(mx*my)%3)%2===0;
      }
    }
    function fmtBits(mk){
      var d=mk,v=d<<10,k;      /* EC level M = 00, then 3 mask bits */
      for(k=14;k>=10;k--) if((v>>k)&1) v^=0x537<<(k-10);
      return ((d<<10)|v)^0x5412;
    }
    function writeFormat(c,mk){
      var f=fmtBits(mk),k,bit;
      for(k=0;k<15;k++){
        bit=(f>>k)&1;
        if(k<6) c[k][8]=bit;
        else if(k===6) c[7][8]=bit;
        else if(k===7) c[8][8]=bit;
        else if(k===8) c[8][7]=bit;
        else c[8][14-k]=bit;
        if(k<8) c[8][N-1-k]=bit;
        else c[N-15+k][8]=bit;
      }
    }
    function writeVersion(c){
      var v=ver<<12,k;
      for(k=17;k>=12;k--) if((v>>k)&1) v^=0x1f25<<(k-12);
      v|=ver<<12;
      for(k=0;k<18;k++){
        var bit=(v>>k)&1,a2=Math.floor(k/3),b2=k%3+N-11;
        c[a2][b2]=bit;c[b2][a2]=bit;
      }
    }
    function penalty(c){
      var p=0,py,px,run,v;
      for(py=0;py<N;py++){
        run=1;
        for(px=1;px<=N;px++){
          if(px<N&&c[py][px]===c[py][px-1]) run++;
          else{if(run>=5)p+=3+run-5;run=1;}
        }
      }
      for(px=0;px<N;px++){
        run=1;
        for(py=1;py<=N;py++){
          if(py<N&&c[py][px]===c[py-1][px]) run++;
          else{if(run>=5)p+=3+run-5;run=1;}
        }
      }
      for(py=0;py<N-1;py++)for(px=0;px<N-1;px++){
        v=c[py][px];
        if(c[py][px+1]===v&&c[py+1][px]===v&&c[py+1][px+1]===v) p+=3;
      }
      var P1=[1,0,1,1,1,0,1,0,0,0,0],P2=[0,0,0,0,1,0,1,1,1,0,1];
      function scan(get){
        for(var a2=0;a2<N;a2++)for(var b2=0;b2<=N-11;b2++){
          var o1=true,o2=true;
          for(var k=0;k<11;k++){
            var vv=get(a2,b2+k);
            if(vv!==P1[k]) o1=false;
            if(vv!==P2[k]) o2=false;
          }
          if(o1) p+=40;
          if(o2) p+=40;
        }
      }
      scan(function(a2,b2){return c[a2][b2];});
      scan(function(a2,b2){return c[b2][a2];});
      var dark=0;
      for(py=0;py<N;py++)for(px=0;px<N;px++) dark+=c[py][px];
      p+=Math.floor(Math.abs(dark*100/(N*N)-50)/5)*10;
      return p;
    }
    var best=null,bestPen=1e9;
    for(var mk=0;mk<8;mk++){
      var c=[];
      for(y=0;y<N;y++) c.push(m[y].slice());
      for(y=0;y<N;y++)for(x=0;x<N;x++)
        if(!rsv[y][x]&&maskBit(mk,y,x)) c[y][x]^=1;
      writeFormat(c,mk);
      if(ver>=7) writeVersion(c);
      var pen=penalty(c);
      if(pen<bestPen){bestPen=pen;best=c;}
    }
    return best;
  }
  function qrSvgData(text){
    var m2=qrMatrix(text); if(!m2) return null;
    var n=m2.length,q=4,S=n+q*2,d='';
    for(var y=0;y<n;y++)for(var x=0;x<n;x++)
      if(m2[y][x]) d+='M'+(x+q)+' '+(y+q)+'h1v1h-1z';
    var svg='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 '
      +S+' '+S+'" shape-rendering="crispEdges">'
      +'<rect width="'+S+'" height="'+S+'" fill="#fff"/>'
      +'<path d="'+d+'" fill="#000"/></svg>';
    return 'data:image/svg+xml;base64,'
      +btoa(unescape(encodeURIComponent(svg)));
  }
  window.SemDeckQr=qrMatrix;   /* test hook */
  /* Line has NO handler here: it is a tool now (data-tool="line"), wired
     generically with every other .et button, and drawn by dragging like a
     shape. A listener here would fire ALONGSIDE that wiring, so clicking
     Line would both arm the tool and drop a ready-made rule on the page
     (2026-08-10). */
  /* ---- EQUATION -------------------------------------------------------
     A text box that starts with the LaTeX delimiters already in it. There
     is no new item kind and no new renderer: MathJax is loaded on every
     page (render/page.py always splices it in) and renderSlide already
     calls typeset() on the finished slide, so an ordinary text box whose
     words happen to be "$$ ... $$" is typeset for free - and moves,
     colours, scales, exports and animates like any other text box
     (2026-08-20, user asked for "Maths inserts").
     What it DOES add is re-typesetting after an edit: the annot layer is
     rebuilt on every change, so the rendered maths would otherwise be
     thrown away the moment you touched anything. */
  /* ---- THE EQUATION EDITOR --------------------------------------------
     The old "Insert equation" dropped a text box containing "$$ E = mc^2
     $$" and walked away: no preview, no symbols, and no way to tell
     whether what you typed was valid (2026-08-20, user: "what the hell
     does insert equation do? There is no latex render and no symbols and
     stuff to add?").
     Type on the left, see it set on the right, click a symbol to drop it
     at the caret. A template like \frac{}{} leaves the caret in the first
     empty brace, because landing after the closing brace means deleting
     your way back every single time. */
  var EQ_PAL=[
    ['Structures',[
      ['\\frac{a}{b}','\\frac{}{}','fraction'],
      ['a^{b}','^{}','superscript / power'],
      ['a_{b}','_{}','subscript'],
      ['\\sqrt{x}','\\sqrt{}','square root'],
      ['\\sqrt[n]{x}','\\sqrt[]{}','nth root'],
      ['\\sum','\\sum_{i=1}^{n} ','sum'],
      ['\\prod','\\prod_{i=1}^{n} ','product'],
      ['\\int','\\int_{a}^{b} ','integral'],
      ['\\iint','\\iint ','double integral'],
      ['\\oint','\\oint ','contour integral'],
      ['\\lim','\\lim_{x \\to 0} ','limit'],
      ['(\\;)','\\left( \\right)','auto-sized brackets'],
      ['[\\;]','\\left[ \\right]','auto-sized square brackets'],
      ['\\{\\;\\}','\\left\\{ \\right\\}','auto-sized braces'],
      ['|\\;|','\\left| \\right|','absolute value'],
      ['\\binom{n}{k}','\\binom{}{}','binomial coefficient'],
      ['\\overline{x}','\\overline{}','overline / mean'],
      ['\\hat{x}','\\hat{}','hat'],
      ['\\vec{x}','\\vec{}','vector'],
      ['\\dot{x}','\\dot{}','time derivative'],
      ['\\text{if}','\\text{}','ordinary words inside maths'],
      ['2\\times2','\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}',
       'matrix'],
      ['cases','\\begin{cases} a & x<0 \\\\ b & x\\ge 0 \\end{cases}',
       'a case split'],
      ['align','\\begin{aligned} a &= b \\\\ &= c \\end{aligned}',
       'several lines, aligned on =']]],
    ['Greek',[
      ['\\alpha','\\alpha ',''],['\\beta','\\beta ',''],
      ['\\gamma','\\gamma ',''],['\\delta','\\delta ',''],
      ['\\epsilon','\\varepsilon ',''],['\\zeta','\\zeta ',''],
      ['\\eta','\\eta ',''],['\\theta','\\theta ',''],
      ['\\kappa','\\kappa ',''],['\\lambda','\\lambda ',''],
      ['\\mu','\\mu ',''],['\\nu','\\nu ',''],['\\xi','\\xi ',''],
      ['\\pi','\\pi ',''],['\\rho','\\rho ',''],['\\sigma','\\sigma ',''],
      ['\\tau','\\tau ',''],['\\phi','\\varphi ',''],['\\chi','\\chi ',''],
      ['\\psi','\\psi ',''],['\\omega','\\omega ',''],
      ['\\Gamma','\\Gamma ',''],['\\Delta','\\Delta ',''],
      ['\\Theta','\\Theta ',''],['\\Lambda','\\Lambda ',''],
      ['\\Sigma','\\Sigma ',''],['\\Phi','\\Phi ',''],
      ['\\Psi','\\Psi ',''],['\\Omega','\\Omega ','']]],
    ['Operators & relations',[
      ['\\times','\\times ',''],['\\div','\\div ',''],
      ['\\pm','\\pm ',''],['\\mp','\\mp ',''],['\\cdot','\\cdot ',''],
      ['\\ast','\\ast ',''],['\\circ','\\circ ',''],
      ['\\leq','\\leq ',''],['\\geq','\\geq ',''],['\\neq','\\neq ',''],
      ['\\approx','\\approx ',''],['\\equiv','\\equiv ',''],
      ['\\sim','\\sim ',''],['\\propto','\\propto ',''],
      ['\\ll','\\ll ',''],['\\gg','\\gg ',''],
      ['\\in','\\in ',''],['\\notin','\\notin ',''],
      ['\\subset','\\subset ',''],['\\cup','\\cup ',''],
      ['\\cap','\\cap ',''],['\\forall','\\forall ',''],
      ['\\exists','\\exists ',''],['\\nabla','\\nabla ',''],
      ['\\partial','\\partial ',''],['\\infty','\\infty ',''],
      ['30^\\circ','^\\circ ','degrees']]],
    ['Arrows & accents',[
      ['\\to','\\to ',''],['\\gets','\\gets ',''],
      ['\\Rightarrow','\\Rightarrow ',''],
      ['\\Leftarrow','\\Leftarrow ',''],
      ['\\Leftrightarrow','\\Leftrightarrow ',''],
      ['\\mapsto','\\mapsto ',''],['\\uparrow','\\uparrow ',''],
      ['\\downarrow','\\downarrow ',''],
      ['\\tilde{x}','\\tilde{}',''],['\\bar{x}','\\bar{}',''],
      ['\\ddot{x}','\\ddot{}',''],['\\underline{x}','\\underline{}',''],
      ['\\mathbb{R}','\\mathbb{R}','the reals'],
      ['\\mathcal{L}','\\mathcal{}','script letter'],
      ['\\mathbf{v}','\\mathbf{}','bold (a vector)'],
      ['thin space','\\, ','a thin space'],
      ['wide space','\\quad ','a wide space']]],
    ['Ready-made',[
      ['E=mc^2','E = mc^2',''],
      ['quadratic','x = \\frac{-b \\pm \\sqrt{b^2-4ac}}{2a}',''],
      ['Gaussian','f(x) = \\frac{1}{\\sigma\\sqrt{2\\pi}}'
       +' e^{-\\frac{(x-\\mu)^2}{2\\sigma^2}}',''],
      ['mean','\\bar{x} = \\frac{1}{n}\\sum_{i=1}^{n} x_i',''],
      ['RMSE','\\mathrm{RMSE} = \\sqrt{\\frac{1}{n}'
       +'\\sum_{i=1}^{n}(y_i-\\hat{y}_i)^2',''],
      ['derivative','\\frac{\\partial u}{\\partial t}',''],
      ['integral','\\int_{a}^{b} f(x)\\,dx','']]]
  ];
  (function(){
    var dlg=$('#eq-dlg'); if(!dlg) return;
    var src=$('#eq-src'),prev=$('#eq-prev'),warn=$('#eq-warn'),
        pal=$('#eq-pal'),disp=$('#eq-display');
    var editIdx=null,prevT=null;
    function wrap(tex,display){
      return display?('$$ '+tex+' $$'):('$ '+tex+' $');
    }
    /* pull the LaTeX back out of a stored text item */
    function unwrap(t){
      var m=/^\s*\$\$([\s\S]*)\$\$\s*$/.exec(t||'');
      if(m) return {tex:m[1].trim(),display:true};
      m=/^\s*\$([\s\S]*)\$\s*$/.exec(t||'');
      if(m) return {tex:m[1].trim(),display:false};
      return {tex:(t||'').trim(),display:true};
    }
    function render(){
      clearTimeout(prevT);
      prevT=setTimeout(function(){
        var tex=src.value.trim();
        prev.textContent=tex?wrap(tex,disp.checked):'';
        if(!window.MathJax||!MathJax.typesetPromise){
          /* MathJax comes from a CDN. Offline, or on a network that
             blocks it, there is no renderer at all — and a blank preview
             would read as "your LaTeX is wrong" rather than "nothing here
             can draw it" (2026-08-20). */
          warn.hidden=false;
          warn.textContent='No maths renderer available — MathJax is '
            +'loaded from the internet and could not be reached. The '
            +'LaTeX is still saved with the slide and will typeset '
            +'anywhere that can load it.';
          return;
        }
        warn.hidden=true;
        MathJax.typesetPromise([prev]).then(function(){
          /* MathJax never REJECTS on bad input, and it fails in two
             different ways depending on how bad it is: a command it does
             not know gets a red "Math input error" box, while something
             it cannot parse at all - an unclosed brace, say - is left as
             raw "$$ ... $$" text with no container produced at all.
             Neither throws, so the test is "did a container come out,
             and is it clean", not "did anything reject" (2026-08-20,
             both observed live in the browser). */
          var bad=prev.querySelector('mjx-merror,.MathJax_Error');
          var setOk=prev.querySelector('mjx-container');
          if(setOk&&!bad) return;
          warn.hidden=false;
          warn.textContent=bad
            ?('That is not valid LaTeX yet — '
              +(bad.getAttribute('title')
                ||'check the braces and backslashes')
              +'. The red box shows where it gave up.')
            :('That did not typeset — usually an unclosed { or a '
              +'misspelt command. It is still saved exactly as you '
              +'typed it.');
        }).catch(function(e){
          warn.hidden=false;
          warn.textContent='That does not parse as LaTeX yet: '
            +(e&&e.message?e.message:'check the braces');
        });
      },160);
    }
    function insert(txt){
      var a=src.selectionStart||0,b=src.selectionEnd||0;
      src.value=src.value.slice(0,a)+txt+src.value.slice(b);
      /* land the caret in the FIRST empty pair of braces, not after the
         template — otherwise every insert is followed by arrowing back */
      var hole=txt.indexOf('{}');
      var at=hole>=0?(a+hole+1):(a+txt.length);
      src.focus();src.setSelectionRange(at,at);
      render();
    }
    function buildPal(){
      pal.innerHTML='';
      EQ_PAL.forEach(function(grp){
        var h=document.createElement('div');
        h.className='eq-palh';h.textContent=grp[0];
        pal.appendChild(h);
        var row=document.createElement('div');row.className='eq-palrow';
        grp[1].forEach(function(it){
          var b=document.createElement('button');
          b.type='button';b.className='eq-key';
          /* the KEY is SET in maths, not spelled in LaTeX. A palette
             reading "\alpha \beta \gamma" is the same words-where-a-
             picture-belongs problem the fill menu had: you should be able
             to find sigma by looking for a sigma (2026-08-20). Labels
             that are ordinary words stay words. */
          if(/[\\^_]/.test(it[0])){
            b.className+=' eq-key-tex';
            b.textContent='\\('+it[0]+'\\)';
          } else b.textContent=it[0];
          b.title=(it[2]||it[1].trim())+'  →  '+it[1].trim();
          b.addEventListener('click',function(e){
            e.preventDefault();insert(it[1]);});
          row.appendChild(b);
        });
        pal.appendChild(row);
      });
      /* ONE typeset pass over the whole palette, once it is built */
      if(window.MathJax&&MathJax.typesetPromise)
        MathJax.typesetPromise([pal]).catch(function(){
          /* no renderer reachable: fall back to the LaTeX, which is at
             least readable and is what you would have typed anyway */
          $$('.eq-key-tex',pal).forEach(function(b){
            b.textContent=b.textContent.replace(/^\\\(|\\\)$/g,'');});
        });
    }
    function open(idx){
      editIdx=(typeof idx==='number')?idx:null;
      var s2=pres.slides[cur];
      var a=(editIdx!=null)?(s2.annots||[])[editIdx]:null;
      var u=a?unwrap(a.text):{tex:'E = mc^2',display:true};
      src.value=u.tex;disp.checked=u.display;
      if(!pal.childNodes.length) buildPal();
      dlg.hidden=false;
      $('#eq-ok').textContent=(editIdx!=null)?'Update it'
        :'Put it on the slide';
      src.focus();src.select();
      render();
    }
    function close(){dlg.hidden=true;editIdx=null;}
    function commit(){
      var tex=src.value.trim();
      if(!tex){close();return;}
      var s2=pres.slides[cur];
      if(!s2){toast('Add a slide first');close();return;}
      var txt=wrap(tex,disp.checked);
      s2.annots=s2.annots||[];
      var idx;
      if(editIdx!=null&&s2.annots[editIdx]){
        s2.annots[editIdx].text=txt;
        delete s2.annots[editIdx].html;
        idx=editIdx;
      } else {
        s2.annots.push({k:'text',x:28,y:40,w:44,text:txt,
          size:disp.checked?3.6:2.6,bg:0,align:'center',maths:1});
        idx=s2.annots.length-1;
      }
      markDirty();setTool('select');
      var l=stage.querySelector('.annot-layer');
      if(l){renderAnnots(l,s2);selectAnnot(l,idx);}
      else renderSlide();
      close();
    }
    src.addEventListener('input',render);
    src.addEventListener('keydown',function(e){
      e.stopPropagation();
      if(e.key==='Escape'){e.preventDefault();close();}
      else if(e.key==='Enter'&&(e.ctrlKey||e.metaKey)){
        e.preventDefault();commit();}
    });
    disp.addEventListener('change',render);
    $('#eq-ok').addEventListener('click',commit);
    $('#eq-cancel').addEventListener('click',close);
    $('#eq-close').addEventListener('click',close);
    dlg.addEventListener('click',function(e){if(e.target===dlg) close();});
    var mb=$('#dc-maths');
    if(mb) mb.addEventListener('click',function(){open(null);});
    /* editing an existing one: the Text group grows an Edit button when
       the selected box is maths */
    var eb=$('#fmt-eqedit');
    if(eb) eb.addEventListener('click',function(){
      if(typeof selAnnot==='number') open(selAnnot);});
    window.SemDeckEquation=open;
  })();
  /* ---- THE APPLY DIALOG ------------------------------------------------
     One surface answering the three questions the old "apply to all
     headings" answered for you: WHAT type, WHICH properties, WHICH
     slides (2026-08-22).

     It always DIRECT-WRITES the fields onto the matching items; it never
     edits the style registry. A registry entry carries only the eight
     properties applyStyleTo writes, so it cannot express width, height,
     x, y, indentation or see-through, and it is one object for the whole
     deck, so it cannot express a slide subset either. A path that quietly
     switched between the two depending on which boxes you happened to
     tick would be untestable. The price is real and the toast says it:
     the boxes stop matching their named style, so Re-apply would put them
     back. The two one-click registry actions in the Styles menu are
     untouched and are still the right tool when a style is what you
     mean. */
  (function(){
    var dlg=$('#aa-dlg'); if(!dlg) return;
    var srcA=null,srcKey='',srcKind='text';
    function selNow(){
      var s=pres.slides[cur]; if(!s) return null;
      if(typeof selAnnot==='number') return annotByIdx(s,selAnnot);
      return null;
    }
    /* an item of the CHOSEN type, for the wording. Once the type is
       choosable it is no longer necessarily the source's own type, and
       "text boxes at about 42 pt" read off the source would be naming the
       size of the box you copied FROM rather than the ones about to
       change. Falls back to the source when nothing else matches. */
    function keySample(){
      if(srcA&&typeKeyOf(srcA)===srcKey) return srcA;
      var found=null;
      (pres.slides||[]).forEach(function(sl){
        (sl.annots||[]).forEach(function(a){
          if(!found&&a&&!a.hide&&typeKeyOf(a)===srcKey) found=a;});
      });
      return found||srcA;
    }
    function close(){
      dlg.hidden=true;
      unmark();
      srcA=null;
    }
    function unmark(){
      $$('.an-typematch').forEach(function(n){
        n.classList.remove('an-typematch');});
    }
    /* outline the matching items on the slide behind the dialog. A class
       toggle over nodes that are already on the page — never a re-render,
       and never markDirty: looking at something is not an edit. */
    function mark(on){
      unmark();
      if(!on) return;
      var layer=stage&&stage.querySelector('.annot-layer');
      if(!layer) return;
      var s=pres.slides[cur]; if(!s) return;
      $$('[data-idx]',layer).forEach(function(n){
        var a=annotByIdx(s,+n.getAttribute('data-idx'));
        if(a&&typeKeyOf(a)===srcKey) n.classList.add('an-typematch');
      });
    }
    function buildWhat(){
      var host=$('#aa-what'); if(!host) return;
      host.innerHTML='';
      var lead=document.createElement('span');
      lead.textContent='Make every';
      host.appendChild(lead);
      /* the chip is a BUTTON, not a label. It names the type in the
         accent colour — which is what was asked for — and it opens the
         list of every other type in the deck, which is what makes the
         action usable after you have already changed the box you are
         copying from. */
      var chip=document.createElement('button');
      chip.className='aa-chip aa-chipbtn';
      chip.type='button';
      chip.textContent=typeLabel(srcKey,false,keySample())+' ▾';
      chip.title='Which kind of object to change. Hover to outline them '
        +'on this slide.';
      chip.setAttribute('aria-haspopup','true');
      host.appendChild(chip);
      var tail=document.createElement('span');
      tail.textContent='look like this one.';
      host.appendChild(tail);
      var n=document.createElement('span');
      n.className='aa-n';n.id='aa-n';
      host.appendChild(n);
      var pick=document.createElement('div');
      pick.className='sh-menu aa-typemenu';pick.id='aa-typemenu';
      pick.hidden=true;
      host.appendChild(pick);
      chip.addEventListener('click',function(e){
        e.stopPropagation();
        var open=pick.hidden;
        if(open){
          pick.innerHTML='';
          menuHead(pick,'change every…');
          var idxs=pageOf().poster?[cur]:scopeIdxs();
          deckTypeKeys(idxs,srcA).forEach(function(t){
            var b=document.createElement('button');
            b.className='dbtn vw-opt';
            b.setAttribute('aria-pressed',(t.key===srcKey).toString());
            b.textContent=typeLabel(t.key,t.n!==1,t.sample)
              +'  ('+t.n+')';
            b.disabled=!t.n;
            b.addEventListener('click',function(ev){
              ev.stopPropagation();
              srcKey=t.key;pick.hidden=true;
              buildWhat();syncWords();
            });
            pick.appendChild(b);
          });
        }
        pick.hidden=!open;
      });
      document.addEventListener('click',function(e){
        if(!pick.hidden&&!pick.contains(e.target)&&e.target!==chip)
          pick.hidden=true;
      });
      chip.addEventListener('mouseenter',function(){mark(true);});
      chip.addEventListener('mouseleave',function(){mark(false);});
    }
    function buildProps(){
      var host=$('#aa-props'); if(!host) return;
      host.innerHTML='';
      APPLY_GROUPS.forEach(function(g){
        var rows=APPLY_PROPS.filter(function(r){return r[2]===g;});
        if(!rows.length) return;
        menuHead(host,g.toLowerCase());
        rows.forEach(function(r){
          var fits=applyRowFits(r,srcKind);
          var lab=document.createElement('label');
          lab.className='find-ck'+(fits?'':' aa-no');
          var ck=document.createElement('input');
          ck.type='checkbox';
          ck.checked=!!applyPick[r[0]];
          ck.disabled=!fits;
          ck.addEventListener('change',function(){
            if(ck.checked) applyPick[r[0]]=1; else delete applyPick[r[0]];
          });
          lab.appendChild(ck);
          lab.appendChild(document.createTextNode(' '+r[1]));
          if(!fits) lab.title=r[1]+' is not something '
            +(APPLY_WHYNOT[srcKind]||'this')+' has.';
          host.appendChild(lab);
        });
      });
    }
    /* the scope column, grouped by section when there are any. Numbered
       titles rather than thumbnails: sixty pictures is a second filmstrip
       inside a dialog, and the thing you are picking here is a NAME. */
    function buildScope(){
      var host=$('#aa-scope'),col=$('#aa-scopecol');
      if(!host||!col) return;
      /* a poster's other pages are deliberately different drafts of one
         sheet, and its export only ever writes the page you are on — so
         there is no scope to pick */
      col.hidden=!!pageOf().poster;
      if(col.hidden) return;
      host.innerHTML='';
      sectionRuns().forEach(function(r){
        var grid;
        if(r.id){
          var h=document.createElement('div');h.className='aa-sech';
          var hck=document.createElement('input');hck.type='checkbox';
          var on=0,i;
          for(i=r.at;i<r.at+r.n;i++) if(scopeHas(pres.slides[i])) on++;
          hck.checked=on>0;
          /* a section that is half in and half out says so rather than
             lying in either direction */
          hck.indeterminate=on>0&&on<r.n;
          hck.addEventListener('change',function(){
            for(var j=r.at;j<r.at+r.n;j++)
              scopeSet(pres.slides[j],hck.checked);
            buildScope();syncWords();
          });
          h.appendChild(hck);
          var ht=document.createElement('span');
          ht.textContent=r.name;h.appendChild(ht);
          host.appendChild(h);
        }
        grid=document.createElement('div');grid.className='aa-grid';
        for(var k=r.at;k<r.at+r.n;k++)(function(i2){
          var sl=pres.slides[i2]; if(!sl) return;
          var lab=document.createElement('label');lab.className='find-ck';
          var ck=document.createElement('input');ck.type='checkbox';
          ck.checked=scopeHas(sl);
          ck.addEventListener('change',function(){
            scopeSet(sl,ck.checked);buildScope();syncWords();});
          lab.appendChild(ck);
          var n=document.createElement('span');
          n.className='aa-slide-n';n.textContent=(i2+1);
          lab.appendChild(n);
          var t=document.createElement('span');
          t.className='aa-slide-t';t.textContent=slideTitle(sl);
          lab.appendChild(t);
          lab.title=slideTitle(sl);
          grid.appendChild(lab);
        })(k);
        host.appendChild(grid);
      });
    }
    function syncWords(){
      var idxs=pageOf().poster?[cur]:scopeIdxs();
      var c=$('#aa-count');
      if(c) c.textContent=pageOf().poster?'This page':scopeWords();
      var n=$('#aa-n');
      var hits=typeCount(srcKey,idxs,srcA);
      if(n) n.textContent=hits+' to change';
      var ok=$('#aa-ok');
      if(ok){
        ok.disabled=!idxs.length||!hits;
        ok.textContent=hits
          ?('Apply to '+hits+' '+typeLabel(srcKey,hits!==1,keySample()))
          :'Nothing to change';
      }
    }
    function open(){
      var a=selNow();
      if(!a){toast('Select the object you want the others to match');
        return;}
      srcA=a;srcKey=typeKeyOf(a);
      srcKind=(selAnnot==='t'||selAnnot==='s')?'text':a.k;
      buildWhat();buildProps();buildScope();syncWords();
      dlg.hidden=false;
    }
    function commit(){
      if(!srcA) return;
      var idxs=pageOf().poster?[cur]:scopeIdxs();
      var want=applyFieldsFor(applyPick,srcKind);
      /* the words are read off a MATCHING item, not off the source: once
         the type is choosable the two are different things, and "5 text
         boxes at about 42 pt" would be naming the size of the box you
         copied FROM rather than the ones that changed */
      var samp=keySample();
      var n=applyToType(srcKey,srcA,want,idxs);
      close();
      if(!n){toast('Nothing else on those slides is a '
        +typeLabel(srcKey,false,samp));return;}
      var msg=n+' '+typeLabel(srcKey,n!==1,samp)+' now match this one';
      /* the one real cost of writing the fields rather than the style,
         said plainly rather than discovered later */
      if(isStyleKey(srcKey))
        msg+=' — they no longer match the '
          +typeLabel(srcKey,false,samp)+' style, so Re-apply would put '
          +'them back';
      toast(msg+'. Ctrl+Z undoes the lot.');
    }
    $('#aa-ok').addEventListener('click',commit);
    $('#aa-cancel').addEventListener('click',close);
    $('#aa-close').addEventListener('click',close);
    dlg.addEventListener('click',function(e){if(e.target===dlg) close();});
    dlg.addEventListener('keydown',function(e){
      /* stopPropagation because the canvas listens for Escape and for
         plain letters, and a dialog on top of it must not nudge a shape */
      e.stopPropagation();
      if(e.key==='Escape'){e.preventDefault();close();}
    });
    $('#aa-all-props').addEventListener('click',function(){
      applyPick=applyPickAll();buildProps();});
    $('#aa-no-props').addEventListener('click',function(){
      applyPick={};buildProps();});
    $('#aa-all-slides').addEventListener('click',function(){
      scopeAll();buildScope();syncWords();});
    window.SemDeckApplyDlg=open;
  })();
  /* is this text item an equation? either it was made as one or its words
     are wrapped in $ … $ */
  /* TWO DIFFERENT QUESTIONS, and answering them with one predicate is
     what broke inline maths.

     isMaths — "this box IS an equation". It gates the equation editor
     button, which opens the whole box as one formula, so it is right
     that it demands the text be nothing but maths.

     hasMaths — "this box CONTAINS maths ANYWHERE". That is what the
     re-typeset gate in renderAnnots needs, and it used to ask isMaths's
     question instead (in an inlined copy): a hand-typed $lpha$ inside
     an ordinary sentence typeset once, on the first renderSlide, and
     was then thrown away by every rebuild of the annot layer — which is
     every drag, every edit, every selection change. inlineMath ['$','$']
     has been configured in mathjax.html all along; nothing was ever
     wrong but this gate (2026-08-25, TASKS T16).

     Kept CHEAP on purpose: renderAnnots runs on every mousemove of a
     drag, so the overwhelmingly common no-maths case must cost one
     indexOf and no regex at all. */
  function isMaths(a){
    return !!(a&&a.k==='text'
      &&(a.maths||/^\s*\$[\s\S]*\$\s*$/.test(a.text||'')));
  }
  function hasMaths(a){
    if(!a||a.k!=='text') return false;
    if(a.maths) return true;
    var t=a.text||'',h=a.html||'';
    var src=(t.indexOf('$')>=0)?t:((h.indexOf('$')>=0)?h:'');
    if(!src) return false;
    /* display $$…$$, or an inline $…$ pair that does not span a line —
       a lone $ in prose ("$5") must not drag the whole layer through
       MathJax on every frame */
    return /\$\$[\s\S]*\$\$/.test(src)
      ||/\$[^$\n]+\$/.test(src);
  }
  var qrBtn=$('#dc-qr');
  if(qrBtn) qrBtn.addEventListener('click',function(){
    var s=pres.slides[cur];
    if(!s){toast('Add a slide first');return;}
    var url=prompt('Link for the QR code (repo / paper / data):',
      'https://');
    if(!url||url==='https://') return;
    var src=qrSvgData(url);
    if(!src){
      toast('That link is too long for a QR code (about 200 characters '
        +'at most)');
      return;
    }
    var l=stage.querySelector('.annot-layer');
    var lr=l?l.getBoundingClientRect():null;
    var w2=12,h2=12;
    if(lr&&lr.height) h2=w2*(lr.width/lr.height);
    h2=Math.max(4,Math.min(60,h2));
    s.annots=s.annots||[];
    s.annots.push({k:'image',x:84,y:Math.max(2,94-h2),w:w2,h:h2,src:src});
    markDirty();
    setTool('select');
    if(l){renderAnnots(l,s);selectAnnot(l,s.annots.length-1);}
    else renderSlide();
  });

