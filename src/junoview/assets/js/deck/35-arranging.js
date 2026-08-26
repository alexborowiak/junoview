/* 35-arranging.js — stacking, arranging, aligning and distributing.
   ONE FRAGMENT of deck.js's single IIFE, concatenated with its
   siblings in filename order by assets.deck_js(). It does not
   parse alone and is not meant to: see 00-page.js. */
  /* ---- STACKING ORDER -------------------------------------------------
     There is no z property: order in s.annots IS the order on the page,
     so every one of these is an array move. It used to act on selAnnot
     alone, so bringing a GROUP to the front brought one member of it and
     left the rest behind (2026-08-20).
     `step` moves one place instead of all the way, which is what you
     actually want when three things overlap - the user asked for "the
     bring to forewards send to back" and Word/PowerPoint give you both
     pairs. */
  function zReorder(front,step){
    var s=pres.slides[cur];
    if(!s||!s.annots) return;
    var idxs=selIdxs();
    if(!idxs.length) return;
    idxs=idxs.slice().sort(function(a,b){return a-b;});
    var n=s.annots.length;
    /* already as far as it goes: say so rather than silently doing
       nothing, which reads as a broken button */
    var atEnd=front
      ?idxs[0]===n-idxs.length
      :idxs[idxs.length-1]===idxs.length-1;
    if(atEnd&&!step) return;
    var moving=idxs.map(function(i){return s.annots[i];});
    var rest=s.annots.filter(function(a,i){return idxs.indexOf(i)<0;});
    /* idxs[0] is the LOWEST selected index, so every item below it is in
       `rest` — which makes idxs[0] exactly the insertion point that would
       leave the block where it is. One step is one either side of that. */
    var at0=idxs[0];
    var at=step
      ?(front?Math.min(rest.length,at0+1):Math.max(0,at0-1))
      :(front?rest.length:0);
    s.annots=rest.slice(0,at).concat(moving,rest.slice(at));
    /* the selection is a set of INDICES, so it has to be rebuilt */
    var moved=[];
    for(var k=0;k<moving.length;k++) moved.push(at+k);
    selSet=moved;selAnnot=moved[moved.length-1];
    markDirty();
    var l=stage.querySelector('.annot-layer');
    if(l){renderAnnots(l,s);paintSel(l);showFmt();renderSelPane();}
  }
  function zMove(front){zReorder(front,false);}
  var fwdBtn=$('#fmt-forward');
  if(fwdBtn) fwdBtn.addEventListener('click',function(){
    zReorder(true,true);});
  var bwdBtn=$('#fmt-backward');
  if(bwdBtn) bwdBtn.addEventListener('click',function(){
    zReorder(false,true);});
  var frontBtn=$('#fmt-front');
  if(frontBtn) frontBtn.addEventListener('click',function(){
    zMove(true);});
  var backBtn=$('#fmt-back');
  if(backBtn) backBtn.addEventListener('click',function(){
    zMove(false);});
  /* ---- Row / Grid arrange + "Make same size" (multi-selection) ---- */
  function selRects(){
    /* the selected, laid-out items with their VISUAL rects (an aspect-
       fitted figure answers with the plot it shows, not its stored box) */
    var s=pres.slides[cur]; if(!s) return [];
    var l=stage.querySelector('.annot-layer'); if(!l) return [];
    return selSet.filter(function(i){return typeof i==='number';})
      .map(function(i){
        var a=(s.annots||[])[i];
        if(!a||a.k==='arrow'||pinned(a)||a.hide) return null;
        var r=annotRectPct(l,s,i);
        return r?{i:i,a:a,r:r,w:r.r-r.l,h:r.b-r.t}:null;
      }).filter(Boolean);
  }
  function selBBox(items){
    var bb={l:1e9,r:-1e9,t:1e9,b:-1e9};
    items.forEach(function(x){
      bb.l=Math.min(bb.l,x.r.l);bb.r=Math.max(bb.r,x.r.r);
      bb.t=Math.min(bb.t,x.r.t);bb.b=Math.max(bb.b,x.r.b);});
    return bb;
  }
  function placeAt(x,l2,t2){
    anchorSet(x.a,l2,t2,x.w,x.h);
    /* figure frames: pin the model to the visual box so the aspect fit
       re-renders the plot exactly in the slot we computed */
    if(x.a.k==='cell'){x.a.w=x.w;x.a.h=x.h;}
  }
  function rerenderSel(){
    markDirty();
    var s=pres.slides[cur];
    var l=stage.querySelector('.annot-layer');
    if(l&&s){renderAnnots(l,s);paintSel(l);}
  }
  function arrangeRow(){
    var items=selRects(); if(items.length<2) return;
    var bb=selBBox(items);
    items.sort(function(p,q){return p.r.l-q.r.l;});
    var sum=0;items.forEach(function(x){sum+=x.w;});
    /* keep the selection's horizontal span; if the items cannot fit in
       it side by side, fall back to the DECK'S OWN gap — the spacing
       token, so one deck's rhythm is one number rather than a constant
       repeated in three arrange verbs (T12) */
    var gap=(bb.r-bb.l>=sum)
      ?((bb.r-bb.l-sum)/(items.length-1)):tokens().gap;
    var cy=(bb.t+bb.b)/2,x0=bb.l;
    items.forEach(function(x){
      placeAt(x,x0,cy-x.h/2);x0+=x.w+gap;});
    rerenderSel();
  }
  function arrangeGrid(){
    var items=selRects(); if(items.length<2) return;
    var bb=selBBox(items);
    /* reading order: rows top-to-bottom, then left-to-right */
    items.sort(function(p,q){return (p.r.t-q.r.t)||(p.r.l-q.r.l);});
    var n=items.length;
    var cols=Math.ceil(Math.sqrt(n)),rows=Math.ceil(n/cols);
    var mw=0,mh=0;
    items.forEach(function(x){mw=Math.max(mw,x.w);mh=Math.max(mh,x.h);});
    /* grid cells at least as big as the largest item, growing past the
       current bounding box when the items started stacked */
    var tg=tokens().gap;
    var cw=Math.max((bb.r-bb.l)/cols,mw+tg);
    var ch=Math.max((bb.b-bb.t)/rows,mh+tg);
    var ox=Math.max(0,Math.min(bb.l,100-cw*cols));
    var oy=Math.max(0,Math.min(bb.t,100-ch*rows));
    items.forEach(function(x,k){
      placeAt(x,
        ox+(k%cols)*cw+(cw-x.w)/2,
        oy+Math.floor(k/cols)*ch+(ch-x.h)/2);
    });
    rerenderSel();
  }
  function sameSize(mode){
    var items=selRects(); if(items.length<2) return;
    var nums=selSet.filter(function(i){return typeof i==='number';});
    var ref=null;
    if(mode==='first'||mode==='last'){
      var want=(mode==='first')?nums[0]:nums[nums.length-1];
      ref=items.filter(function(x){return x.i===want;})[0];
    } else {
      items.forEach(function(x){
        if(!ref||(mode==='smallest'
          ?x.w*x.h<ref.w*ref.h:x.w*x.h>ref.w*ref.h)) ref=x;});
    }
    /* w / h / both take the BIGGEST as the model: matching down to the
       smallest usually crops something, matching up never does
       (2026-08-20) */
    if(mode==='w'||mode==='h'||mode==='both'){
      ref=null;
      items.forEach(function(x){
        var v=(mode==='h')?x.h:(mode==='w'?x.w:x.w*x.h);
        var rv=ref?((mode==='h')?ref.h:(mode==='w'?ref.w:ref.w*ref.h)):-1;
        if(v>rv) ref=x;});
    }
    if(!ref) ref=items[items.length-1];  /* the reference was an arrow */
    items.forEach(function(x){
      if(x===ref) return;
      if(x.a.k==='cell'){x.a.x=x.r.l;x.a.y=x.r.t;}
      if(mode!=='h') x.a.w=ref.w;
      if(x.a.k!=='text'&&mode!=='w') x.a.h=ref.h;
    });
    toast(mode==='w'?'Matched widths to the widest'
      :mode==='h'?'Matched heights to the tallest'
      :mode==='both'?'Matched sizes to the biggest'
      :('Same size: matched the '+
        (mode==='first'?'first selected':mode==='last'?'last selected'
         :mode)+' item'));
    rerenderSel();
  }
  /* ---- centre on the PAGE ---------------------------------------------
     Aligning puts items in line with EACH OTHER; this puts them in line
     with the page. With one item selected the two look the same, which is
     why nobody notices the difference until they want a block of three
     centred and discover that aligning centres them on their own average
     (2026-08-20). The selection moves as one, so the arrangement inside
     it is preserved. */
  function centreOnPage(how){
    var items=selRects();
    if(!items.length){toast('Select something first');return;}
    var bb=selBBox(items);
    var dx=(how==='vmiddle')?0:(50-(bb.l+bb.r)/2);
    var dy=(how==='hcenter')?0:(50-(bb.t+bb.b)/2);
    items.forEach(function(x){placeAt(x,x.r.l+dx,x.r.t+dy);});
    rerenderSel();
    toast('Centred on the page');
  }
  /* ---- close the gaps -------------------------------------------------
     The opposite of "space them evenly": push everything up against its
     neighbour, in order, keeping the first one where it is. This is the
     one you want after deleting something out of a row. */
  function closeGaps(axis){
    var items=selRects();
    if(needTwo(items,'close the gaps between')) return;
    var horiz=(axis==='h');
    items.sort(function(a,b){
      return horiz?(a.r.l-b.r.l):(a.r.t-b.r.t);});
    /* a hair of air, not a hard butt joint — and it is the deck's own
       spacing token halved, so "close the gaps" is tighter than "space
       them out" by construction rather than by coincidence (T12) */
    var GAP=tokens().gap/2;
    var at=horiz?items[0].r.l:items[0].r.t;
    items.forEach(function(x){
      if(horiz){placeAt(x,at,x.r.t);at+=x.w+GAP;}
      else {placeAt(x,x.r.l,at);at+=x.h+GAP;}
    });
    rerenderSel();
    toast('Closed the gaps');
  }
  /* ---- flip ------------------------------------------------------------
     Mirror the selection within its own bounding box. With one item that
     is a no-op on its position and only matters to arrows and freehand,
     which carry real geometry to mirror; with several it reverses their
     order, which is the useful case. */
  function flipSel(axis){
    var items=selRects();
    if(!items.length){toast('Select something first');return;}
    var bb=selBBox(items),horiz=(axis==='h');
    items.forEach(function(x){
      if(horiz) placeAt(x,bb.l+bb.r-x.r.l-x.w,x.r.t);
      else placeAt(x,x.r.l,bb.t+bb.b-x.r.t-x.h);
      var a=x.a;
      /* an arrow's endpoints are its geometry, so they mirror too */
      if(a.k==='arrow'){
        if(horiz){var t1=a.x1;a.x1=bb.l+bb.r-a.x2;a.x2=bb.l+bb.r-t1;}
        else {var t2=a.y1;a.y1=bb.t+bb.b-a.y2;a.y2=bb.t+bb.b-t2;}
      } else if(a.k==='draw'&&Array.isArray(a.pts)){
        a.pts=a.pts.map(function(q){
          return horiz?[1-q[0],q[1]]:[q[0],1-q[1]];});
      }
    });
    rerenderSel();
    toast(horiz?'Flipped left to right':'Flipped top to bottom');
  }
  /* ---- quarter turns and straighten ----------------------------------- */
  function turnSel(deg){
    var n=0;
    fmtApply(function(a){
      n++;
      if(!deg){delete a.rot;return;}
      a.rot=(((+a.rot||0)+deg)%360+360)%360;
      if(!a.rot) delete a.rot;
    });
    if(!n) return;
    toast(!deg?'Straightened':(deg>0?'Turned right':'Turned left'));
  }
  /* ---- align / distribute --------------------------------------------
     Row and Grid RE-ARRANGE a selection into a formation. Aligning is the
     other thing, and the one poster work needs constantly: leave items
     where they are and make one edge agree. Everything is measured off
     the VISUAL rect, so a letterboxed figure aligns by the plot you can
     see rather than by its padded frame. */
  /* Arrange lives in a menu that also holds single-item actions, so it is
     offered whenever anything is selected — which means these four CAN be
     reached with nothing they are able to move. Say so rather than
     appearing to be broken (2026-08-07 audit). */
  function needTwo(items,what){
    if(items.length>=2) return false;
    toast('Select at least two items to '+what
      +' — arrows, locked and hidden items don’t count');
    return true;
  }
  function alignSel(edge){
    var items=selRects(); if(needTwo(items,'line up')) return;
    var bb=selBBox(items);
    items.forEach(function(x){
      if(edge==='left') placeAt(x,bb.l,x.r.t);
      else if(edge==='right') placeAt(x,bb.r-x.w,x.r.t);
      else if(edge==='hcenter') placeAt(x,(bb.l+bb.r)/2-x.w/2,x.r.t);
      else if(edge==='top') placeAt(x,x.r.l,bb.t);
      else if(edge==='bottom') placeAt(x,x.r.l,bb.b-x.h);
      else if(edge==='vmiddle') placeAt(x,x.r.l,(bb.t+bb.b)/2-x.h/2);
    });
    rerenderSel();
  }
  /* equal GAPS, not equal centres: with items of different sizes, even
     centres still look wrong — it is the whitespace between them the eye
     measures. The outermost two stay put and define the span. */
  function distributeSel(axis){
    var items=selRects();
    if(items.length<3){
      toast('Select at least three items to space them out evenly');
      return;
    }
    var horiz=(axis==='h');
    items.sort(function(p,q){
      return horiz?(p.r.l-q.r.l):(p.r.t-q.r.t);});
    var bb=selBBox(items),sum=0;
    items.forEach(function(x){sum+=horiz?x.w:x.h;});
    var span=horiz?(bb.r-bb.l):(bb.b-bb.t);
    var gap=(span-sum)/(items.length-1);
    var at=horiz?bb.l:bb.t;
    items.forEach(function(x){
      if(horiz) placeAt(x,at,x.r.t); else placeAt(x,x.r.l,at);
      at+=(horiz?x.w:x.h)+gap;
    });
    rerenderSel();
  }
  /* ---- MATCH ANOTHER SLIDE --------------------------------------------
     The single most tedious thing about building a deck is making slide 7
     sit exactly like slide 3 — the heading in the same place, the figure
     the same size, the caption the same style. PowerPoint's answer is to
     duplicate a slide and replace its contents, which loses the contents
     you already had (2026-08-20, user: "would be cool if there was a
     'match other slide' option ... the text style, locations and sizes of
     everything become that same").
     It works by KIND, in reading order: the first heading here takes the
     first heading there's box and look, the first figure takes the first
     figure's, and so on. That is enough to be right almost every time and
     simple enough to explain in one sentence — which matters more than
     cleverness for something that moves your work about.
     What it deliberately does NOT do is move content between slides.
     Nothing is added, nothing is deleted; only geometry and styling
     travel. */
  function matchKey(a){
    /* what counts as "the same kind of thing". A text box's ROLE is its
       named style when it has one, so a Heading 1 matches a Heading 1 and
       not just any old text. */
    if(!a) return '';
    if(a.k==='text') return 'text:'+(a.style||'body');
    if(a.k==='cell'){
      /* a placed figure and a placed table are not interchangeable */
      return 'cell:'+(a.part||'auto');
    }
    return a.k;
  }
  /* ---- WHAT COUNTS AS "ONE OF THESE" ----------------------------------
     matchKey answers a narrow question for Match slide: which item on
     THIS slide pairs with which item on THAT one. typeKeyOf answers the
     wider one the user asks out loud — "apply to all objects of this
     type" (2026-08-22) — and the two differ in exactly two places, which
     is why this is a sibling and matchKey is not touched.

     A placed frame is keyed by the part it ACTUALLY shows (partOf), not
     by the raw a.part: a figure left on 'auto' and a figure explicitly
     set to 'figure' are the same thing on the page, so a button that says
     "every figure in this deck" must not put them in two buckets. Match
     slide is right to keep the raw value — it is pairing, not counting.

     And an UNSTYLED text box is grouped by its SIZE rather than falling
     into Body. matchKey's 'body' default exists so a plain box still
     pairs with something on another slide; here it would take one
     hand-formatted heading and push its look onto every caption in the
     deck. That is not a corner case — most decks have never used a named
     style, which is the whole reason the standardise check exists — and
     it is exactly what happened the first time this was driven in a
     browser (2026-08-22).
     Quantised in LOG space at the same ~6% the standardise bands use,
     because a type scale is multiplicative: two sizes within 6% were
     nudged apart by hand and meant to be one size, and 12% apart is one
     press of A+ and is meant. */
  function textBand(a){
    return Math.round(Math.log((a&&a.size)||2.6)/Math.log(1.06));
  }
  function typeKeyOf(a){
    if(!a) return '';
    if(a.k==='text')
      return a.style?('text:'+a.style):('text:~'+textBand(a));
    if(a.k==='cell') return 'cell:'+partOf(a);
    return matchKey(a);
  }
  var TYPE_LABELS={
    'cell:figure':['figure','figures'],
    'cell:output':['output frame','output frames'],
    'cell:code':['code frame','code frames'],
    'cell:body':['placed note','placed notes'],
    table:['table','tables'],rect:['shape','shapes'],
    arrow:['arrow','arrows'],draw:['drawing','drawings'],
    image:['picture','pictures']
  };
  /* the words the dialog puts on its chip. A styled text box is named by
     its STYLE, read live out of the registry, so a type you invented
     yourself gets a correct chip for free and can never disagree with
     what the Styles list calls the same thing. */
  function typeLabel(key,plural,src){
    if(key&&key.indexOf('text:~')===0){
      /* an unstyled box has no name, so it is named by what it IS: its
         size, in the same pt the Styles menu prints. Read off the source
         item when there is one — reconstructing it from the quantised
         band would print a number a point or two off the box in front of
         you, which is worse than useless on a label. */
      var pt=src&&src.size
        ?Math.round(src.size*5.4)
        :Math.round(Math.pow(1.06,+key.slice(6))*5.4);
      return 'text box'+(plural?'es':'')+' at about '+pt+' pt';
    }
    if(key&&key.indexOf('text:')===0){
      var d=styleDef(key.slice(5));
      if(d) return d.label+(plural?' boxes':' box');
    }
    var p=TYPE_LABELS[key];
    if(p) return plural?p[1]:p[0];
    return plural?'objects':'object';
  }
  /* does this key name a STYLE, as against a size band or another kind?
     Only a styled bucket can drift away from a style definition, so only
     it needs the Re-apply warning. */
  function isStyleKey(key){
    return !!(key&&key.indexOf('text:')===0&&key.indexOf('text:~')!==0);
  }
  /* how many WOULD CHANGE over the slides in scope — which means the
     source item does not count, because applying a look to itself is not
     a change. Counting it made the button promise "Apply to 1" and then
     do nothing at all (2026-08-22, caught in the browser). */
  function typeCount(key,idxs,src){
    var n=0;
    (idxs||[]).forEach(function(i){
      var sl=(pres.slides||[])[i]; if(!sl) return;
      (sl.annots||[]).forEach(function(a){
        if(a&&a!==src&&!a.hide&&typeKeyOf(a)===key) n++;
      });
    });
    return n;
  }
  /* every distinct type present over these slides, in an order that
     reads: named styles in the deck's own style order first, then the
     unnamed size bands biggest first, then everything else.

     This is what makes the type CHOOSABLE rather than merely reported,
     and it is not a luxury. An unstyled box is grouped by its size, so
     the moment you make one heading bigger it is alone in its band and
     "apply to all of this type" has nothing left to apply to — which is
     precisely the flow the feature is for. Being able to say "no, THAT
     type" fixes it, and it answers the other half of the ask directly:
     "maybe should be highlighted which object type this is"
     (2026-08-22). */
  function deckTypeKeys(idxs,src){
    var seen={},list=[];
    (idxs||[]).forEach(function(i){
      var sl=(pres.slides||[])[i]; if(!sl) return;
      (sl.annots||[]).forEach(function(a){
        if(!a||a.hide) return;
        var k=typeKeyOf(a);
        if(!seen[k]){seen[k]={key:k,n:0,sample:a};list.push(seen[k]);}
        if(a!==src) seen[k].n++;
      });
    });
    var ord=styleOrder();
    function rank(e){
      if(e.key.indexOf('text:~')===0)
        return 1000-(e.sample.size||2.6);       /* biggest type first */
      if(e.key.indexOf('text:')===0){
        var at=ord.indexOf(e.key.slice(5));
        return at<0?900:at;
      }
      return 2000;
    }
    list.sort(function(x,y){return rank(x)-rank(y);});
    return list;
  }
  /* ---- SELECTING BY WHAT THINGS ARE ------------------------------------
     "Select all caption text boxes"; "select everything using this font,
     size or colour" (TASKS T5).

     A CRITERION is one named question about an object, answered off a
     REFERENCE object: key 'font', value 'georgia'. Keeping it a VALUE
     rather than a closure is the whole design: find & replace (T6) runs
     the identical question over every slide in the deck while the
     selection below runs it over one, and neither owns the question.

     `type` is not re-invented here. typeKeyOf / typeLabel already answer
     "what kind of thing is this" for the Apply dialog, in the deck's own
     vocabulary — including the styles you invented yourself, read live
     out of the registry. Everything else in the table is an APPEARANCE:
     one field, read raw, with the default folded in so two boxes nobody
     ever touched count as the same. */
  var SELECT_CRIT=[
    /* key,   read(a) -> value, or null when the question does not apply
                to this kind of object
              say(v,a) -> the whole menu row, minus its count */
    ['type',function(a){return typeKeyOf(a)||null;},
      function(v,a){return 'Every '+typeLabel(v,false,a);}],
    ['font',function(a){return a.k==='text'?(a.font||''):null;},
      function(v){return 'Everything in '+fontLabel(v);}],
    ['size',function(a){
        return (a.k==='text'||a.k==='table')?(a.size||2.6):null;},
      function(v){return 'Everything at '+Math.round(v*5.4)+' pt';}],
    ['color',function(a){
        return (a.k==='text'||a.k==='arrow'||a.k==='rect'||a.k==='draw')
          ?(a.color||''):null;},
      function(){return 'Everything in this colour';}],
    ['fillc',function(a){return a.k==='rect'?(a.fillc||''):null;},
      function(){return 'Every shape with this fill';}],
    ['sw',function(a){
        return (a.k==='arrow'||a.k==='rect'||a.k==='draw')
          ?(a.sw||SW_DEFAULT):null;},
      function(){return 'Every stroke at this thickness';}]
  ];
  /* does an object answer EVERY criterion in the set? The set is an
     AND, and an empty set matches nothing — "change everything" is a
     thing you should have to say another way. */
  function critsMatch(a,crit){
    if(!a||!crit||!crit.length) return false;
    for(var i=0;i<crit.length;i++)
      if(critRead(crit[i].key,a)!==crit[i].val) return false;
    return true;
  }
  function critRead(key,a){
    if(!a) return null;
    for(var i=0;i<SELECT_CRIT.length;i++)
      if(SELECT_CRIT[i][0]===key) return SELECT_CRIT[i][1](a);
    return null;
  }
  /* every index on ONE slide that answers a criterion the same way.

     Hidden items are out: they are not on the page you are looking at.
     FULLY LOCKED ones are out too — the same rule the marquee follows
     (T3), and the count in the menu is taken from this same function, so
     "Every Caption (4)" always selects exactly four. Position-locked
     items are ordinary here, as they are everywhere else. */
  function annotsBy(sl,key,val){
    var out=[];
    (sl&&sl.annots||[]).forEach(function(a,i){
      if(!a||a.hide||lockedAll(a)) return;
      if(critRead(key,a)===val) out.push(i);
    });
    return out;
  }
  /* the rows worth offering for the current selection: every criterion
     the reference object can answer, that more than one object on this
     slide answers the same way. A row that would select the one thing
     you already have selected is a row that does nothing. */
  function selectByRows(){
    var s2=pres.slides[cur];
    var idxs=selIdxs();
    var ref=s2&&(s2.annots||[])[idxs[idxs.length-1]];
    if(!ref) return [];
    var out=[];
    SELECT_CRIT.forEach(function(c){
      var v=c[1](ref);
      if(v==null) return;
      var hit=annotsBy(s2,c[0],v);
      if(hit.length<2) return;
      out.push({key:c[0],val:v,n:hit.length,idxs:hit,
        label:c[2](v,ref)});
    });
    return out;
  }
  function selectBy(key,val){
    var s2=pres.slides[cur]; if(!s2) return;
    var hit=annotsBy(s2,key,val);
    if(!hit.length) return;
    selectMany(stage.querySelector('.annot-layer'),hit);
    toast(hit.length+' selected');
  }
  /* the standalone menu, for the Arrange row. The canvas menu lists the
     same rows inline instead — it is already a menu, and burying them one
     level deeper there would cost a click for nothing. */
  function openSelectByMenu(anchor,ev){
    var old=$('#selby-menu'); if(old) old.remove();
    var rows=selectByRows();
    var m=document.createElement('div');
    m.className='sh-menu canvas-menu';m.id='selby-menu';
    menuHead(m,'select on this slide');
    if(!rows.length){
      var b0=document.createElement('button');
      b0.className='dbtn vw-opt';b0.disabled=true;
      b0.textContent='Nothing else on this slide is like it';
      m.appendChild(b0);
    }
    rows.forEach(function(r){
      var b=document.createElement('button');
      b.className='dbtn vw-opt';
      b.appendChild(document.createTextNode(r.label));
      var k=document.createElement('kbd');
      k.textContent=String(r.n);b.appendChild(k);
      b.addEventListener('click',function(e){
        e.stopPropagation();m.remove();selectBy(r.key,r.val);});
      m.appendChild(b);
    });
    if(ev) floatAt(m,ev);
    else {
      document.body.appendChild(m);
      floatMenu(anchor,m);
      setTimeout(function(){
        document.addEventListener('click',function off(e){
          if(m.contains(e.target)) return;
          m.remove();document.removeEventListener('click',off);
        });
      },0);
    }
  }
  /* the geometry + look that travel; content never does.

     A LINE IS NOT AN x/y/w/h BOX. It is stored as its two endpoints
     (x1,y1,x2,y2) plus any corners dragged into it, so a list that named
     only the box properties copied nothing an arrow actually uses: Match
     slide reported the arrow as moved and left it exactly where it was
     (2026-08-22). The endpoints, the corner route, the curve and the
     heads all travel now.
     NOT here on purpose: `c1`/`c2` (which item each end is tied to —
     they name items on the OTHER slide, and an attached end is placed by
     arrowEnds from the tie, so copying the tie would drag the arrow onto
     a stranger); `pts` (a freehand stroke's points ARE its content);
     `shape` and `crop` (what a thing IS, not how it is laid out); and
     `anim`, which is behaviour rather than layout. */
  var MATCH_PROPS=['x','y','w','h','rot','size','b','i','u','strike',
    'align','font','color','bg','bgc','op','style','sw','fill','fillc',
    'grad','ts','txcol','bgcol','arc','list','thead','grid','cols',
    'lh','pspace','ind',
    /* lines and arrows */
    'x1','y1','x2','y2','mid','curve','bend','head','tail','nohead',
    'hsz','dash'];
  /* ---- WHICH PROPERTIES TRAVEL ----------------------------------------
     "It should do everything by default (text size, spacing, indentation,
     width, height, x and y position), but then you can unselect ones you
     don't want" (2026-08-22). So: every row starts ticked, and the list
     is the vocabulary the dialog speaks in.

     A row is a USER-FACING idea, not a model field — "Bold, italic,
     underline" is one decision and three fields, and nobody wants three
     checkboxes for it. `kinds` is what the row means anything for; rows
     that do not fit the selected item are greyed and explained rather
     than hidden, so the list does not reshuffle under you when you pick a
     different object.

     EVERY field named here must also appear in MATCH_PROPS, because that
     is the list the copy loop walks. A field named here and missing there
     is a checkbox that silently does nothing — which is why `ind` was
     added to MATCH_PROPS in the same edit that invented it. */
  var APPLY_PROPS=[
    /* key      label                        group        kinds                              fields */
    ['size',   'Text size',                 'Type',      'text table',                      ['size']],
    ['font',   'Typeface',                  'Type',      'text',                            ['font']],
    ['emph',   'Bold, italic, underline',   'Type',      'text',                            ['b','i','u','strike']],
    ['style',  'Named style',               'Type',      'text',                            ['style']],
    ['tbl',    'Table rules and header row','Type',      'table',                           ['thead','grid','cols']],
    ['lh',     'Line spacing',              'Spacing',   'text table',                      ['lh']],
    ['pspace', 'Space between paragraphs',  'Spacing',   'text table',                      ['pspace']],
    ['ind',    'Indentation',               'Spacing',   'text',                            ['ind']],
    ['align',  'Alignment',                 'Spacing',   'text',                            ['align']],
    ['list',   'Bullets and numbering',     'Spacing',   'text',                            ['list']],
    ['arc',    'Curve',                     'Spacing',   'text',                            ['arc']],
    ['w',      'Width',                     'Size',      'text cell rect image table draw', ['w']],
    /* HEIGHT IS NOT A TEXT PROPERTY. A text box auto-heights — the
       renderer reads a.w and never a.h for one — and sameSize has
       excluded text from height since it was written. A ticked Height on
       a heading would be a control that does nothing, which is worse
       than a control that is not offered. */
    ['h',      'Height',                    'Size',      'cell rect image table draw',      ['h']],
    ['rot',    'Rotation',                  'Size',      '*',                               ['rot']],
    ['ts',     'Content zoom',              'Size',      'cell',                            ['ts']],
    ['x',      'Left / right position',     'Position',  'text cell rect image table draw', ['x']],
    ['y',      'Up / down position',        'Position',  'text cell rect image table draw', ['y']],
    /* an arrow is its two ends, not a box: the same row of the picker, a
       completely different set of fields — the bug where Match slide
       reported an arrow moved and left it exactly where it was */
    ['ends',   'Where the line runs',       'Position',  'arrow',                           ['x1','y1','x2','y2','mid','curve','bend']],
    ['color',  'Text colour',               'Colour',    'text arrow rect',                 ['color']],
    ['txcol',  'Note text colour',          'Colour',    'cell',                            ['txcol']],
    ['stroke', 'Line style and thickness',  'Colour',    'arrow rect draw table',           ['sw','style','dash','head','tail','nohead','hsz']],
    ['fill',   'Shape fill',                'Background','rect',                            ['fill','fillc','grad']],
    ['bg',     'Box background',            'Background','text table',                      ['bg','bgc']],
    ['bgcol',  'Note background',           'Background','cell',                            ['bgcol']],
    ['op',     'See-through',               'Background','*',                               ['op']]
  ];
  var APPLY_GROUPS=['Type','Spacing','Size','Position','Colour','Background'];
  /* why a row is greyed, said in words rather than in kind names */
  var APPLY_WHYNOT={text:'a text box',cell:'a placed frame',rect:'a shape',
    image:'a picture',arrow:'an arrow',draw:'a drawing',table:'a table'};
  /* everything ticked EXCEPT "Named style". Ticking that one re-tags the
     target boxes, which is a bigger claim than "make these look alike" —
     it changes what they ARE, and the next Re-apply would then move them.
     Everything the user actually listed is on by default. */
  function applyPickAll(){
    var o={};
    APPLY_PROPS.forEach(function(r){if(r[0]!=='style') o[r[0]]=1;});
    return o;
  }
  /* SESSION-LOCAL, deliberately. This is a preference about the TOOL, not
     a property of the deck: sending someone a presentation must not send
     them my checkbox state, and everything on `pres` has to be argued
     into normPres and then into or out of the undo snapshot. Ticking a
     box is not an edit and must never become an undo step — but it MUST
     survive until the tab closes, because the complaint this answers is
     repetition, and re-ticking six boxes every time is that same tax in a
     new coat. deckZoom is session-local for the same reason. */
  var applyPick=applyPickAll();
  function applyRowFits(row,kind){
    return row[3]==='*'||row[3].split(' ').indexOf(kind)>=0;
  }
  /* the object handed to the action: keyed by MODEL FIELD, not by row, so
     the copy loop is the one matchSlide already uses with one guard
     added. Narrowed to what this kind can carry, so a ticked row that
     does not apply cannot smuggle a field through. */
  function applyFieldsFor(pick,kind){
    var out={};
    APPLY_PROPS.forEach(function(r){
      if(!pick[r[0]]||!applyRowFits(r,kind)) return;
      r[4].forEach(function(f){out[f]=1;});
    });
    return out;
  }
  /* ---- WHICH SLIDES ---------------------------------------------------
     "The default should be 'all slides', but you can unselect slides and
     sections" (2026-08-22). So this is an EXCLUSION set: absent from
     scopeOff means in scope, and a deck you have never touched the picker
     on is entirely in scope with no state at all.

     Keyed on the slide OBJECT, not its index. pres.slides is spliced by
     move, delete, duplicate and the strip's drop handler, and histRestore
     replaces the array wholesale — an index-keyed exclusion would
     silently re-point at whatever slid into the slot, so unticking slide
     4 and then dragging it would leave slide 4's neighbour excluded.
     Object identity survives all of them, and a WeakMap empties itself
     for free on undo and on switching decks. */
  var scopeOff=new WeakMap();
  function scopeHas(s){return !!s&&!scopeOff.has(s);}
  function scopeSet(s,on){
    if(!s) return;
    if(on) scopeOff['delete'](s); else scopeOff.set(s,1);
  }
  function scopeAll(){
    (pres.slides||[]).forEach(function(s){scopeOff['delete'](s);});
  }
  /* ALWAYS an array, never null. A bug that produced null would have to
     mean "the whole deck", which is the most destructive reading
     available — so the interface simply has no way to say it. */
  function scopeIdxs(){
    var out=[];
    (pres.slides||[]).forEach(function(s,i){if(scopeHas(s)) out.push(i);});
    return out;
  }
  function scopeNoun(n){
    var w=pageOf().poster?'page':'slide';
    return n===1?w:w+'s';
  }
  function scopeWords(){
    var all=(pres.slides||[]).length,idxs=scopeIdxs(),n=idxs.length;
    if(!n) return 'No '+scopeNoun(0)+' chosen';
    if(n===all) return 'All '+all+' '+scopeNoun(all);
    if(n===1&&idxs[0]===cur) return 'This '+scopeNoun(1)+' only';
    return n+' of '+all+' '+scopeNoun(all);
  }
  /* ---- THE ACTION -----------------------------------------------------
     One source item, one type key, one property set, one list of slides.
     The loop walks MATCH_PROPS rather than the caller's own keys so that
     undefined-means-delete and the deep copy of a.grad / a.cols are
     handled in exactly one place, the same place Match slide handles
     them.
     ONE markDirty() and ONE refresh() at the end, never per item: a sweep
     over forty slides has to be a single undo step, and markDirty only
     repaints the CURRENT slide's thumbnail, so the other thirty-nine need
     the refresh to catch up. */
  function applyToType(key,src,want,idxs){
    var n=0;
    (idxs||[]).forEach(function(i){
      var sl=(pres.slides||[])[i]; if(!sl) return;
      (sl.annots||[]).forEach(function(a){
        if(!a||a===src||typeKeyOf(a)!==key) return;
        MATCH_PROPS.forEach(function(p){
          if(!want[p]) return;
          if(src[p]===undefined) delete a[p];
          else a[p]=(typeof src[p]==='object'&&src[p])
            ?deep(src[p]):src[p];
        });
        n++;
      });
    });
    markDirty();refresh();
    return n;
  }
  /* ---- WHAT AN UNSTYLED TEXT BOX IS FOR --------------------------------
     matchKey answers "what kind of thing is this", and for text it
     answers with the NAMED STYLE — which is right, and useless on the
     many decks that have never used one. There, every text box came back
     'text:body', so a heading and a caption were the same kind and got
     paired by position alone: the higher one won the higher slot and a
     heading could land where a caption belonged.

     The fix is to read the role the box is actually PLAYING, and the
     signal is RANK WITHIN ITS OWN SLIDE rather than absolute size. The
     biggest text on a slide is its heading whatever the number happens to
     be, the next is its body, the next its caption. Rank survives exactly
     the case that breaks a size threshold — a deck whose slides were
     formatted by hand and disagree about how big a heading is — which is
     precisely the deck that needed arranging in the first place
     (2026-08-22, user: "is there not a way for it to figure this out?").

     Sizes within ROLE_TOL of each other share a rank, so two paragraphs
     set the same size stay one bucket and pair between themselves in
     reading order, which is the right answer for them. */
  var ROLE_TOL=1.06;
  function inferRoles(sl){
    var list=[],out={};
    ((sl&&sl.annots)||[]).forEach(function(a,i){
      if(a&&a.k==='text'&&!a.hide
        &&!(a.style&&STYLE_DEFAULTS[a.style]))
        list.push({i:i,size:(a.size||2.6)});
    });
    if(!list.length) return out;
    list.sort(function(x,y){return y.size-x.size;});
    var rank=0,prev=null;
    list.forEach(function(e){
      if(prev!==null&&prev/e.size>ROLE_TOL) rank++;
      prev=e.size;
      out[e.i]=rank;
    });
    return out;
  }
  /* the bucket key one slide's items pair on. A box wearing a real style
     keeps it — a name you chose beats a rank we inferred — and everything
     that is not text is unchanged. */
  function slideRoleKey(sl){
    var roles=inferRoles(sl);
    return function(a,i){
      if(a&&a.k==='text'&&!a.style&&roles[i]!=null)
        return 'text:~'+roles[i];
      return matchKey(a);
    };
  }
  function matchSlide(fromIdx,toIdx){
    var src=pres.slides[fromIdx],dst=pres.slides[toIdx];
    if(!src||!dst) return null;
    /* buckets by kind, in reading order down the page then across */
    function bucket(sl){
      var m={},keyOf=slideRoleKey(sl);
      (sl.annots||[]).map(function(a,i){return {a:a,i:i};})
        .filter(function(p2){return p2.a&&!p2.a.hide;})
        .sort(function(p2,q2){
          var dy=(p2.a.y||0)-(q2.a.y||0);
          return Math.abs(dy)>4?dy:((p2.a.x||0)-(q2.a.x||0));})
        .forEach(function(p2){
          var k=keyOf(p2.a,p2.i);
          (m[k]=m[k]||[]).push(p2);});
      return m;
    }
    var sb=bucket(src),db=bucket(dst);
    var moved=0,missing=[];
    Object.keys(db).forEach(function(k){
      var from=sb[k]||[],to=db[k];
      if(!from.length){missing.push(k);return;}
      to.forEach(function(p2,n){
        /* run out of models? reuse the last one, so three bullets on this
           slide all take the styling of the one bullet on that one */
        var m=from[Math.min(n,from.length-1)].a;
        MATCH_PROPS.forEach(function(prop){
          if(m[prop]===undefined) delete p2.a[prop];
          else p2.a[prop]=(typeof m[prop]==='object'&&m[prop])
            ?deep(m[prop]):m[prop];
        });
        moved++;
      });
    });
    return {moved:moved,missing:missing,
      spare:Object.keys(sb).filter(function(k){return !db[k];})};
  }
  /* ---- ARRANGE THIS SLIDE ----------------------------------------------
     (2026-08-22, user: "there could be like an 'arrange slide button',
     which based upon what is there (the main big things and text boxes,
     and then anything little like shapes stay where they are in reference
     to if they are on top of something, and arrows point to the same xy
     in one image to the same xy in another image). Then there can be
     presets based upon both the size of something, as well as the
     difference between things can be configured.")

     This is the arrangement library's twin: it needs no saved layout at
     all, because it reads the slide and works one out. Three kinds of
     thing, and the whole design is in how they are treated differently:

       MAJOR   figures, images, tables, flip books — and any shape big
               enough to be scenery rather than a mark. These are placed.
       TEXT    placed too, by the ROLE inferRoles gives it: the biggest
               text on the slide is its heading, the smallest under a
               figure is that figure's caption.
       MINOR   a circle round part of a plot, a tick, a small label. These
               are NOT placed. They are recorded as a FRACTION of whatever
               they sit on and put back on top of it afterwards, so the
               annotation still annotates the same pixel of the same plot.

     Arrow endpoints get the same treatment, one end at a time and by
     fraction rather than by the a.c1/a.c2 tie — that tie aims at an
     item's centre and lands on its border, which is right for "this
     points AT that figure" and wrong for "this points at the peak in the
     top-left of that figure", which is what is being preserved here. */
  var ARRANGE_PRESETS=[
    ['tight','Tight',{gap:1.6,big:7,textShare:0.30}],
    ['normal','Normal',{gap:3.0,big:9,textShare:0.34}],
    ['airy','Airy',{gap:5.0,big:12,textShare:0.38}]
  ];
  function arrangeOpts(id){
    var o=ARRANGE_PRESETS[1][2];
    ARRANGE_PRESETS.forEach(function(p){if(p[0]===id) o=p[2];});
    return o;
  }
  function rectOf(a){
    if(!a) return null;
    if(a.k==='arrow')
      return {l:Math.min(a.x1,a.x2),r:Math.max(a.x1,a.x2),
              t:Math.min(a.y1,a.y2),b:Math.max(a.y1,a.y2)};
    if(a.w==null||a.h==null) return null;
    return {l:a.x,r:a.x+a.w,t:a.y,b:a.y+a.h};
  }
  function rectArea(r){
    return r?Math.max(0,r.r-r.l)*Math.max(0,r.b-r.t):0;
  }
  function overlapArea(p,q){
    if(!p||!q) return 0;
    var w=Math.min(p.r,q.r)-Math.max(p.l,q.l);
    var h=Math.min(p.b,q.b)-Math.max(p.t,q.t);
    return (w>0&&h>0)?w*h:0;
  }
  /* is this item scenery or a mark? Size is the signal the user named,
     and it is configurable per preset because "big" on an A0 poster and
     "big" on a 16:9 slide are not the same number of percent. */
  function isMajorKind(a){
    return a&&(a.k==='cell'||a.k==='image'||a.k==='flip'||a.k==='table');
  }
  function arrangeSlide(sl,layer,opt){
    if(!sl) return 0;
    opt=opt||arrangeOpts('normal');
    var m=marginPct(),gap=opt.gap;
    var annots=sl.annots||[];
    /* EVERY rect is measured BEFORE anything moves. Text auto-heights and
       a figure frame hugs its plot, so the live layer is the only honest
       source for those — and it goes stale the moment we write. */
    var rects=annots.map(function(a,i){
      var r=(layer?annotRectPct(layer,sl,i):null)||rectOf(a);
      return r;
    });
    var majors=[],texts=[],minors=[],arrows=[];
    annots.forEach(function(a,i){
      if(!a||a.hide) return;
      if(a.k==='arrow'){arrows.push(i);return;}
      var r=rects[i]; if(!r) return;
      if(a.k==='text'){texts.push(i);return;}
      if(isMajorKind(a)||rectArea(r)>=opt.big*opt.big) majors.push(i);
      else minors.push(i);
    });
    if(!majors.length&&!texts.length) return 0;
    /* ---- record what rides on what, before anything moves ---- */
    function hostOf(r){
      var best=-1,bo=0;
      majors.forEach(function(j){
        var o=overlapArea(r,rects[j]);
        if(o>bo){bo=o;best=j;}
      });
      /* half of it has to be over the host, or a shape merely NEAR a
         figure would be dragged across the slide with it */
      return (best>=0&&bo>=rectArea(r)*0.5)?best:-1;
    }
    function frac(r,h){
      var hw=(h.r-h.l)||1,hh=(h.b-h.t)||1;
      return {x:(r.l-h.l)/hw,y:(r.t-h.t)/hh,
              w:(r.r-r.l)/hw,h:(r.b-r.t)/hh};
    }
    var ride=[];
    minors.forEach(function(i){
      var h=hostOf(rects[i]);
      if(h>=0) ride.push({i:i,host:h,f:frac(rects[i],rects[h])});
    });
    function pointHost(x,y){
      var best=-1;
      majors.forEach(function(j){
        var r=rects[j];
        if(x>=r.l&&x<=r.r&&y>=r.t&&y<=r.b) best=j;
      });
      return best;
    }
    var tips=[];
    arrows.forEach(function(i){
      var a=annots[i];
      [['1',a.x1,a.y1],['2',a.x2,a.y2]].forEach(function(e){
        var h=pointHost(e[1],e[2]);
        if(h<0) return;
        var r=rects[h];
        tips.push({i:i,end:e[0],host:h,
          fx:(e[1]-r.l)/((r.r-r.l)||1),
          fy:(e[2]-r.t)/((r.b-r.t)||1)});
      });
    });
    /* ---- who is a heading, who is a caption ---- */
    var roles=inferRoles(sl);
    var maxRank=0;
    texts.forEach(function(i){
      if(roles[i]!=null&&roles[i]>maxRank) maxRank=roles[i];});
    var head=-1,caps={},bodies=[];
    texts.forEach(function(i){
      var rk=roles[i];
      if(rk===0&&head<0&&maxRank>0){head=i;return;}
      /* a caption is the smallest text that sits UNDER a figure and
         overlaps it across — the same signal the standardise check uses */
      if(rk===maxRank&&maxRank>0){
        var r=rects[i],hit=-1;
        majors.forEach(function(j){
          var q=rects[j];
          if(r.t>=q.b-2&&r.t<=q.b+14&&r.r>q.l&&r.l<q.r) hit=j;});
        if(hit>=0&&caps[hit]==null){caps[hit]=i;return;}
      }
      bodies.push(i);
    });
    /* ---- the regions ---- */
    var L=m.x,T=m.y,R=100-m.x,B=100-m.y;
    var put={};
    function setBox(i,x,y,w,h){put[i]={x:x,y:y,w:w,h:h};}
    if(head>=0){
      var hh=Math.max(6,(rects[head].b-rects[head].t));
      setBox(head,L,T,R-L,null);
      T+=hh+gap;
    }
    var capH=Math.max(4,(maxRank>0?5:0));
    var nb=bodies.length,nm=majors.length;
    if(!nm){
      /* text only: one column, stacked, sharing the height */
      var each=(B-T-gap*Math.max(0,nb-1))/Math.max(1,nb);
      bodies.forEach(function(i,k){
        setBox(i,L,T+k*(each+gap),R-L,null);});
    } else {
      var fx=L,fw=R-L;
      if(nb&&nm<=2){
        /* a short slide reads best as text beside the figure. With three
           or more figures the text goes underneath instead — a 30% column
           beside a 2x2 grid is a gutter, not a paragraph. */
        var tw=(R-L)*opt.textShare;
        fx=L+tw+gap;fw=(R-L)-tw-gap;
        var eachT=(B-T-gap*Math.max(0,nb-1))/Math.max(1,nb);
        bodies.forEach(function(i,k){
          setBox(i,L,T+k*(eachT+gap),tw,null);});
      }
      var fb=B;
      if(nb&&nm>2){
        var bandH=Math.max(8,(B-T)*0.24);
        fb=B-bandH-gap;
        var eachB=(R-L-gap*Math.max(0,nb-1))/Math.max(1,nb);
        bodies.forEach(function(i,k){
          setBox(i,L+k*(eachB+gap),fb+gap,eachB,null);});
      }
      var cols=nm<=1?1:(nm<=4?2:Math.ceil(Math.sqrt(nm)));
      var rows=Math.ceil(nm/cols);
      var cw=(fw-gap*(cols-1))/cols;
      var ch=(fb-T-gap*(rows-1))/rows;
      /* the caption strip is reserved for the whole ROW, not the one cell
         that has a caption. Charging it to that cell alone left two
         figures side by side at different heights, which reads as a
         mistake rather than as a caption (2026-08-22). */
      var rowCap={};
      majors.forEach(function(i,k){
        if(caps[i]!=null) rowCap[Math.floor(k/cols)]=1;});
      majors.forEach(function(i,k){
        var c=k%cols,r2=Math.floor(k/cols);
        var x=fx+c*(cw+gap),y=T+r2*(ch+gap);
        var mh=ch-(rowCap[r2]?(capH+gap*0.5):0);
        setBox(i,x,y,cw,mh);
        if(caps[i]!=null) setBox(caps[i],x,y+mh+gap*0.5,cw,null);
      });
    }
    /* ---- write it ---- */
    var moved=0;
    Object.keys(put).forEach(function(k){
      var i=+k,a=annots[i],b=put[i];
      if(!a) return;
      a.x=Math.round(b.x*10)/10;
      a.y=Math.round(b.y*10)/10;
      a.w=Math.round(b.w*10)/10;
      /* a text box auto-heights: writing a height on one would fix it at
         a size its words do not need (the rule MATCH_PROPS keeps too) */
      if(b.h!=null&&a.k!=='text') a.h=Math.round(b.h*10)/10;
      moved++;
    });
    /* ---- and put the marks back where they were, relative ---- */
    function newRect(i){
      var b=put[i];
      if(b) return {l:b.x,t:b.y,r:b.x+b.w,
        b:b.y+(b.h!=null?b.h:(rects[i].b-rects[i].t))};
      return rects[i];
    }
    ride.forEach(function(e){
      var h=newRect(e.host),a=annots[e.i];
      var hw=(h.r-h.l),hh=(h.b-h.t);
      a.x=Math.round((h.l+e.f.x*hw)*10)/10;
      a.y=Math.round((h.t+e.f.y*hh)*10)/10;
      a.w=Math.round(e.f.w*hw*10)/10;
      a.h=Math.round(e.f.h*hh*10)/10;
      moved++;
    });
    tips.forEach(function(e){
      var h=newRect(e.host),a=annots[e.i];
      var x=Math.round((h.l+e.fx*(h.r-h.l))*10)/10;
      var y=Math.round((h.t+e.fy*(h.b-h.t))*10)/10;
      if(e.end==='1'){a.x1=x;a.y1=y;} else {a.x2=x;a.y2=y;}
      /* a fractional tip is a POINT inside the figure, which is a
         different promise from a.c1/a.c2's "aim at this item and stop at
         its border" — so the tie is dropped for the end we just placed,
         or the render would immediately overrule us */
      if(e.end==='1') delete a.c1; else delete a.c2;
      moved++;
    });
    return moved;
  }
  /* ---- ARRANGEMENTS ----------------------------------------------------
     (2026-08-22, user: "there could be arrangements one has, that are
     like if the slide has heading, small paragraph, and large image ...
     I know there can be infinite numbers of these, but it would be cool
     if there was like a way to create ones of these, and like there was a
     view that had a list of what is being arranged, then like a little
     thumbnail of what it would be arranged to".)

     AN ARRANGEMENT IS JUST A SAVED SLIDE. That is the whole design, and
     it is why there is no new matching language here: matchSlide already
     buckets items by kind and pairs them in reading order, so applying an
     arrangement is matchSlide from a stored slide instead of from another
     slide in the deck. Creating one is therefore "make a slide look right
     and save it", which is the only authoring model that scales — and it
     dissolves the "infinite numbers of these" worry, because nobody
     enumerates them: you keep the five you actually use.

     They live in localStorage, not on the deck: an arrangement you only
     ever get to use on one presentation is not worth naming.

     WHAT IS DELIBERATELY NOT HERE is automatic application. Whether a
     paragraph is "small" is a consequence of the layout you have not
     applied yet, not a property of the content, so a rule keyed on it is
     circular and would rearrange slides you were happy with. The pane
     SUGGESTS: every slide, its best match, a thumbnail, and a tick you
     can clear. */
  var ARRKEY='jv-deck-arr:';
  function arrList(){
    try{
      var l=JSON.parse(lsGet(ARRKEY+SCOPE)||'[]');
      return Array.isArray(l)?l:[];
    }catch(e){return [];}
  }
  function arrSave(list){lsSet(ARRKEY+SCOPE,JSON.stringify(list));}
  function arrById(id){
    var hit=null;
    arrList().forEach(function(a){if(a&&a.id===id) hit=a;});
    return hit;
  }
  /* the shape of a slide, with the CONTENT stripped out. Only what
     matchSlide would ever copy is kept, so an arrangement cannot smuggle
     someone else's words or someone else's figure onto your slide. */
  function arrFromSlide(sl,name){
    var keep=[];
    (sl.annots||[]).forEach(function(a){
      if(!a||a.hide) return;
      var o={k:a.k};
      if(a.k==='text'&&a.style) o.style=a.style;
      if(a.k==='cell') o.part=a.part;
      MATCH_PROPS.forEach(function(p){
        if(a[p]===undefined) return;
        o[p]=(typeof a[p]==='object'&&a[p])
          ?deep(a[p]):a[p];
      });
      /* a placeholder word, so the saved slide can be DRAWN as a
         thumbnail without carrying the real text anywhere */
      if(a.k==='text') o.text=annotLabel(a).replace(/^Text — /,'')
        .slice(0,18)||'Text';
      keep.push(o);
    });
    return {id:'ar'+Date.now().toString(36),
      label:name||'Arrangement',
      page:pageOf().poster?'poster':'slide',
      annots:keep};
  }
  /* how well an arrangement fits a slide: the fraction of the slide's
     items it has somewhere to put. Reported, never acted on by itself. */
  function arrScore(arr,sl){
    /* the SAME key the pairing uses, or the percentage describes a
       different match from the one that would happen */
    function counts(sl){
      var m={},keyOf=slideRoleKey(sl);
      ((sl&&sl.annots)||[]).forEach(function(a,i){
        if(!a||a.hide) return;
        var k=keyOf(a,i);m[k]=(m[k]||0)+1;});
      return m;
    }
    var want=counts(sl),have=counts({annots:arr.annots});
    var nw=0,nh=0,hit=0;
    Object.keys(want).forEach(function(k){
      nw+=want[k];
      hit+=Math.min(want[k],have[k]||0);
    });
    Object.keys(have).forEach(function(k){nh+=have[k];});
    /* divided by the BIGGER of the two, so it is punished in both
       directions. Dividing by the slide's own count alone said a slide
       holding one text box fitted a three-item arrangement perfectly —
       every item it had could be placed, which is true and useless
       (2026-08-22, caught in the browser). */
    var tot=Math.max(nw,nh);
    return tot?(hit/tot):0;
  }
  function arrBest(sl){
    var best=null,bs=0;
    arrList().forEach(function(a){
      var s=arrScore(a,sl);
      if(s>bs){bs=s;best=a;}
    });
    return best?{arr:best,score:bs}:null;
  }
  /* applying one is matchSlide from the stored slide. It is spliced in as
     a temporary slide rather than matchSlide being re-signed, because
     matchSlide's pairing is characterised by tests and is the one thing
     here that must not change. */
  function arrApply(arr,idx){
    var sl=pres.slides[idx]; if(!sl||!arr) return 0;
    pres.slides.push({layout:'blank',panes:[],
      annots:deep(arr.annots||[])});
    var r=matchSlide(pres.slides.length-1,idx);
    pres.slides.pop();
    return r?r.moved:0;
  }
  /* ---- MATCHING ONE OBJECT TO ANOTHER ----------------------------------
     (2026-08-22, user: "click on an object, and be like 'match object to
     this', then if you click on something else it matches it to it ...
     then if you click on another slide it says in the ribbon something
     like 'matching to object on slide xx' with a cancel button as well.
     Would be good if there was the reverse as well".)

     Match slide answers "make this whole slide look like that one" and
     pairs items up by guessing. This answers the question that needs no
     guessing at all: you point at the two things yourself. It is the
     escape hatch for every case the bucket heuristic cannot get right —
     two paragraphs that belong the other way round, an item whose
     counterpart is a different kind, a look you want from three slides
     away.

     TWO DIRECTIONS, because which end you have selected depends on which
     one you noticed first:
       'to'   — the selection is the MODEL; click things to change them.
                Stays armed, so one look can be pushed to a dozen objects.
       'from' — the selection is what CHANGES; click the model once.
     Armed state lives here and nowhere else; the canvas reads it at the
     top of its mousedown handler. */
  var matchArm=null;
  var matchPick=applyPickAll();
  function matchLabelOf(sl,i){
    var a=(sl&&sl.annots||[])[i];
    return a?annotLabel(a):'object';
  }
  function armMatch(dir){
    var s=pres.slides[cur],idxs=selIdxs().filter(function(i){
      return (s&&s.annots||[])[i];});
    if(!idxs.length){
      toast('Select the object you want to match first');
      return;
    }
    /* 'to' pushes ONE look outwards, so it takes the primary selection —
       three models and one target is a question with no answer. 'from'
       genuinely wants the lot: several objects can all take one model. */
    if(dir==='to') idxs=[(typeof selAnnot==='number')?selAnnot:idxs[0]];
    if(dir==='layout'&&idxs.length<2){
      toast('Select the objects you want laid out \u2014 two or more');
      return;
    }
    matchArm={dir:dir,slide:cur,idxs:idxs,n:0};
    deckEl.classList.add('matching');
    syncMatchBar();
  }
  function cancelMatch(){
    if(!matchArm) return;
    var n=matchArm.n;
    matchArm=null;
    deckEl.classList.remove('matching');
    syncMatchBar();
    if(n) toast(n+' object'+(n===1?'':'s')+' matched. Ctrl+Z undoes it.');
  }
  /* the copy loop, once. Same rule MATCH_PROPS has always followed —
     undefined on the model means DELETE on the target — and the same deep
     copy for the object-valued properties. */
  function matchCopy(from,to,want){
    if(!from||!to||from===to) return false;
    MATCH_PROPS.forEach(function(p){
      if(!want[p]) return;
      if(from[p]===undefined) delete to[p];
      else to[p]=(typeof from[p]==='object'&&from[p])
        ?deep(from[p]):from[p];
    });
    return true;
  }
  function matchHit(idx){
    if(!matchArm) return;
    var s=pres.slides[cur];
    var hit=(s&&s.annots||[])[idx];
    var src=pres.slides[matchArm.slide];
    if(!hit||!src) return;
    var n=0;
    if(matchArm.dir==='layout'){
      /* A layout pattern needs the ARMED objects' rendered rectangles.
         The stage only contains the current slide, so matching elsewhere
         would apply their old array indexes to unrelated live objects.
         Keep the mode armed: going back to the named slide is the safe,
         predictable way to finish the gesture. */
      if(matchArm.slide!==cur){
        toast('Match layout works on the slide you armed it on \u2014 go '
          +'back to slide '+(matchArm.slide+1));
        return;
      }
      /* the reference is the group (or the run) the clicked object is
         part of, and the selection is what gets tidied to match it */
      var layer2=stage.querySelector('.annot-layer');
      var ref=refGroupAt(layer2,s,idx);
      var pat=readPattern(layer2,s,ref);
      if(!pat){
        toast('That object is not part of a row or a group \u2014 click '
          +'one that is');
        return;
      }
      n=applyPattern(layer2,s,matchArm.idxs,pat);
      if(!n){toast('Nothing to lay out');return;}
      matchArm.n+=n;
      markDirty();refresh();
      toast(n+' laid out like the '+pat.n+' you clicked \u2014 '
        +(pat.horiz?'across':'down')+', '
        +(pat.align==='mid'?'centres':pat.align==='near'
          ?(pat.horiz?'top edges':'left edges')
          :(pat.horiz?'bottom edges':'right edges'))
        +' agreeing, '+gapMm(pat.gap,pat.horiz)+' apart');
      cancelMatch();
      return;
    }
    if(matchArm.dir==='to'){
      var model=(src.annots||[])[matchArm.idxs[0]];
      /* the KIND of the thing being changed decides which properties are
         meaningful — pushing a text size onto a shape is a control that
         does nothing, and applyFieldsFor already knows that */
      if(matchCopy(model,hit,applyFieldsFor(matchPick,hit.k))) n++;
    } else {
      matchArm.idxs.forEach(function(i){
        var to=(src.annots||[])[i];
        if(matchCopy(hit,to,applyFieldsFor(matchPick,to.k))) n++;
      });
    }
    if(!n) return;
    matchArm.n+=n;
    markDirty();refresh();
    /* 'from' has exactly one model to find, so finding it finishes the
       job; 'to' stays armed so a look can be pushed to a dozen things
       without re-arming between each */
    if(matchArm.dir==='from') cancelMatch();
    else {syncMatchBar();
      toast(matchArm.n+' matched — keep clicking, or press Esc');}
  }
  /* ---- MATCHING A LAYOUT, NOT A LOOK -----------------------------------
     "Make these three look like the four above" (TASKS T8). Which is a
     third question, and none of the three neighbours above answers it:

       Match slide     copies a whole slide's arrangement, item for item.
       Match object    copies one object's PROPERTIES onto another.
       Arrangements    apply a saved slide's shape.

     This one copies neither properties nor positions. It copies the
     PATTERN — the axis a group runs along, the edge or centre its
     members agree on, the rhythm of the gaps between them, and where the
     run starts. Nothing about size or colour travels: two rows can look
     alike in the only sense that matters here while holding completely
     different things, and the counts need not even match, which is why
     "these three" can be laid out like "those four".

     The cross-axis position is NOT copied. Adopting it would drop the
     selection on top of the reference; what is adopted is the RULE (tops
     agree / centres agree / bottoms agree), applied to where the
     selection already is, so it tidies into its own band.

     Gaps are taken as the MEDIAN of the reference's gaps. One odd gap in
     a row of five is a mistake being copied, not a rhythm. */
  function patSpread(v){
    return Math.max.apply(null,v)-Math.min.apply(null,v);
  }
  function readPattern(layer,s,idxs){
    var rs=[];
    idxs.forEach(function(i){
      var r=annotRectPct(layer,s,i);
      if(r) rs.push(r);
    });
    if(rs.length<2) return null;
    /* the axis is whichever way the group actually runs */
    var cx=rs.map(function(r){return (r.l+r.r)/2;});
    var cy=rs.map(function(r){return (r.t+r.b)/2;});
    var horiz=patSpread(cx)>=patSpread(cy);
    rs.sort(function(p,q){return horiz?(p.l-q.l):(p.t-q.t);});
    var gaps=[];
    for(var k=1;k<rs.length;k++)
      gaps.push(horiz?(rs[k].l-rs[k-1].r):(rs[k].t-rs[k-1].b));
    gaps.sort(function(a,b){return a-b;});
    var gap=gaps[Math.floor(gaps.length/2)];
    /* which edge they agree on: the one they disagree about least */
    var near=rs.map(function(r){return horiz?r.t:r.l;});
    var mid=rs.map(function(r){
      return horiz?(r.t+r.b)/2:(r.l+r.r)/2;});
    var far=rs.map(function(r){return horiz?r.b:r.r;});
    var sn=patSpread(near),sm=patSpread(mid),sf=patSpread(far);
    var align=(sn<=sm&&sn<=sf)?'near':((sf<=sm)?'far':'mid');
    return {horiz:horiz,gap:gap,align:align,n:rs.length,
      start:horiz?rs[0].l:rs[0].t};
  }
  /* the value the TARGETS should agree on, read off where they are now
     by the reference's own rule — so they line up with each other, in
     their own band, rather than jumping onto the reference */
  function patCross(rs,pat){
    var v=rs.map(function(r){
      return pat.align==='near'?(pat.horiz?r.t:r.l)
        :pat.align==='far'?(pat.horiz?r.b:r.r)
        :(pat.horiz?(r.t+r.b)/2:(r.l+r.r)/2);});
    if(pat.align==='near') return Math.min.apply(null,v);
    if(pat.align==='far') return Math.max.apply(null,v);
    return v.reduce(function(a,b){return a+b;},0)/v.length;
  }
  function applyPattern(layer,s,idxs,pat){
    var rs=[];
    dropTiedCaptions(s,idxs).forEach(function(i){
      var a=(s.annots||[])[i];
      /* a pinned object is not moved by anything else on the canvas and
         is not moved by this either (T3) */
      if(!a||pinned(a)) return;
      var r=annotRectPct(layer,s,i);
      if(r) rs.push({i:i,a:a,r:r});
    });
    if(!rs.length) return 0;
    rs.sort(function(p,q){
      return pat.horiz?(p.r.l-q.r.l):(p.r.t-q.r.t);});
    var cross=patCross(rs.map(function(x){return x.r;}),pat);
    var pos=pat.start,n=0;
    rs.forEach(function(x){
      var len=pat.horiz?(x.r.r-x.r.l):(x.r.b-x.r.t);
      var da=pos-(pat.horiz?x.r.l:x.r.t);
      var now=pat.align==='near'?(pat.horiz?x.r.t:x.r.l)
        :pat.align==='far'?(pat.horiz?x.r.b:x.r.r)
        :(pat.horiz?(x.r.t+x.r.b)/2:(x.r.l+x.r.r)/2);
      var dc=cross-now;
      /* DELTAS, never absolute coordinates. An auto-sized text box and
         an aspect-fitted figure frame both answer annotRectPct with
         their RENDERED rect, which is not a.x/a.y — so moving by the
         difference is the only arithmetic that is right for every kind
         (the same reason snapping works on the bounding box). */
      shiftAnnot(x.a,pat.horiz?da:dc,pat.horiz?dc:da);
      pos+=len+pat.gap;
      n++;
    });
    return n;
  }
  /* WHAT COUNTS AS THE REFERENCE GROUP when you click one object. A real
     group is unambiguous and wins. Otherwise it is the run the object is
     part of: the items sharing its band, which is the same "is this next
     to that" test the equal-gap snapping uses (T7) — so the thing you
     see as a row is the thing that gets read as one. */
  function bandMates(layer,s,idx,horiz){
    var r0=annotRectPct(layer,s,idx); if(!r0) return [];
    var out=[];
    (s.annots||[]).forEach(function(a,i){
      if(!a||a.hide||a.k==='arrow') return;
      var r=annotRectPct(layer,s,i); if(!r) return;
      if(i===idx){out.push(i);return;}
      /* ACROSS the run, they must overlap generously — enough that a
         person would call them the same row */
      var ov=horiz?(Math.min(r.b,r0.b)-Math.max(r.t,r0.t))
                  :(Math.min(r.r,r0.r)-Math.max(r.l,r0.l));
      var ext=horiz?Math.min(r.b-r.t,r0.b-r0.t)
                   :Math.min(r.r-r.l,r0.r-r0.l);
      if(!(ext>0&&ov>=ext*0.5)) return;
      /* ALONG the run, they must sit BESIDE it rather than over it. A
         slide-wide background, or the empty cell frame a new slide
         starts with, overlaps every row's band and would otherwise be
         read as a member of all of them — caught in the browser
         2026-08-25, where the placeholder joined the reference row and
         dragged the run's start 92px to the left of where it looked. */
      var al=horiz?(Math.min(r.r,r0.r)-Math.max(r.l,r0.l))
                  :(Math.min(r.b,r0.b)-Math.max(r.t,r0.t));
      var alen=horiz?Math.min(r.r-r.l,r0.r-r0.l)
                    :Math.min(r.b-r.t,r0.b-r0.t);
      if(al>alen*0.5) return;
      out.push(i);
    });
    return out;
  }
  function refGroupAt(layer,s,idx){
    var mem=groupMembers(s,idx);
    if(mem.length>1) return mem;
    var row=bandMates(layer,s,idx,true);
    var col=bandMates(layer,s,idx,false);
    return (row.length>=col.length?row:col);
  }
  function syncMatchBar(){
    var bar=$('#matchbar'); if(!bar) return;
    bar.hidden=!matchArm;
    if(!matchArm) return;
    var w=$('#match-what');
    var src=pres.slides[matchArm.slide];
    var name=matchLabelOf(src,matchArm.idxs[0]);
    if(matchArm.idxs.length>1) name=matchArm.idxs.length+' objects';
    if(w&&matchArm.dir==='layout'){
      w.innerHTML=bic('align')+' <b>'+esc(name)
        +'</b> will be laid out like the group or row you click '
        +'&mdash; the axis, the alignment and the spacing, not the look';
      return;
    }
    if(w) w.innerHTML=(matchArm.dir==='to')
      ? (bic('swap')+' Copying the look of <b>'+esc(name)+'</b> on slide '
        +(matchArm.slide+1)+' &mdash; click an object to change it'
        +(matchArm.n?(' &middot; '+matchArm.n+' done'):''))
      : (bic('swap')+' <b>'+esc(name)+'</b> on slide '+(matchArm.slide+1)
        +' will take the look of the object you click');
  }
  (function(){
    var mc=$('#match-cancel');
    if(mc) mc.addEventListener('click',function(e){
      e.stopPropagation();cancelMatch();});
    var mb=$('#match-props'),mm=$('#match-props-menu');
    if(!mb||!mm) return;
    /* the same vocabulary the Apply dialog uses — "size, position, shape,
       colour" is exactly what APPLY_PROPS already groups, so this is that
       list rather than a second one that could disagree with it. Its own
       tick state, though: what you want carried between two objects you
       are pointing at is not the same question as what you want pushed
       across a whole deck. */
    function build(){
      mm.innerHTML='';
      var head=document.createElement('div');
      head.className='mp-head';
      [['All',function(){matchPick=applyPickAll();}],
       ['None',function(){matchPick={};}]].forEach(function(pr){
        var b=document.createElement('button');
        b.className='dbtn mp-b';b.textContent=pr[0];
        b.addEventListener('click',function(e){
          e.stopPropagation();pr[1]();build();});
        head.appendChild(b);
      });
      mm.appendChild(head);
      APPLY_GROUPS.forEach(function(g){
        var rows=APPLY_PROPS.filter(function(r){return r[2]===g;});
        if(!rows.length) return;
        menuHead(mm,g.toLowerCase());
        rows.forEach(function(r){
          var lab=document.createElement('label');
          lab.className='find-ck';
          var ck=document.createElement('input');
          ck.type='checkbox';ck.checked=!!matchPick[r[0]];
          ck.addEventListener('click',function(e){e.stopPropagation();});
          ck.addEventListener('change',function(){
            if(ck.checked) matchPick[r[0]]=1; else delete matchPick[r[0]];
          });
          lab.appendChild(ck);
          lab.appendChild(document.createTextNode(' '+r[1]));
          mm.appendChild(lab);
        });
      });
    }
    mb.addEventListener('click',function(e){
      e.stopPropagation();
      var open=mm.hidden;
      if(open) build();
      mm.hidden=!open;
      mb.setAttribute('aria-expanded',open?'true':'false');
    });
    document.addEventListener('click',function(e){
      if(!mm.hidden&&!mm.contains(e.target)&&e.target!==mb)
        mm.hidden=true;
    });
  })();
  (function(){
    var host=$('#lay-tidy'); if(!host) return;
    $$('[data-tidy]',host).forEach(function(b){
      b.addEventListener('click',function(e){
        e.stopPropagation();
        var s=pres.slides[cur]; if(!s) return;
        var lm=$('#lay-menu'); if(lm) lm.hidden=true;
        var n=arrangeSlide(s,stage.querySelector('.annot-layer'),
          arrangeOpts(b.getAttribute('data-tidy')));
        if(!n){toast('There is nothing on this slide to arrange');return;}
        markDirty();refresh();
        toast(n+' item'+(n===1?'':'s')+' arranged. Ctrl+Z undoes it.');
      });
    });
  })();
  /* READING ORDER, once, for everyone who needs it. The array is the
     order you happened to draw things in, which is nobody's idea of a
     sequence: draw the bottom caption first and it would animate first,
     and be Figure 1. A 4% band counts as "the same line", so a row of
     items reads across before the next row down.

     Hoisted here from the animation pane it was written in, because
     figure numbering needs the same order and two sweeps that agreed
     today would not agree forever (2026-08-25, T18). */
  function orderedIdx(s2){
    return (s2.annots||[])
      .map(function(a,i){return {a:a,i:i};})
      .filter(function(p2){return p2.a&&!p2.a.hide;})
      .sort(function(p2,q2){
        var ay=(p2.a.k==='arrow')?Math.min(p2.a.y1,p2.a.y2):(p2.a.y||0);
        var by=(q2.a.k==='arrow')?Math.min(q2.a.y1,q2.a.y2):(q2.a.y||0);
        var ax=(p2.a.k==='arrow')?Math.min(p2.a.x1,p2.a.x2):(p2.a.x||0);
        var bx=(q2.a.k==='arrow')?Math.min(q2.a.x1,q2.a.x2):(q2.a.x||0);
        return Math.abs(ay-by)>4?(ay-by):(ax-bx);
      })
      .map(function(p2){return p2.i;});
  }
  /* ---- WHERE THIS FIGURE CAME FROM ------------------------------------
     (TASKS T19 and T20.) The deck already knows all of this and had no
     way to say it: a frame names a card by anchor, chains.py computed
     the lineage at parse time, the trace view already draws it, and the
     deck already keeps a saved copy of every placed card. What was
     missing was a door from a frame ON A SLIDE to any of it.

     STALENESS, and the honest version of it. There is no timestamp
     anywhere in this format — not on a card, not on an embedded
     snapshot — so "the notebook output is newer than the deck's
     snapshot" cannot be answered by comparing dates, and inventing a
     date at save time would only tell you when the deck was saved.
     What CAN be answered, exactly, is whether the live card and the
     deck's saved copy still say the same thing. That is the question
     that actually matters — a stale snapshot is one that DIFFERS — and
     it is answered by comparing the two bodies. Where the notebook is
     not open there is nothing to compare against, and it says that
     rather than guessing.

     RE-SYNC (T20) is the other half and is almost free once the first
     half exists: a frame resolves its content by ref at render time, so
     a re-executed notebook already shows through the moment it is
     reopened. What was missing was the deliberate act — "take the live
     version for THIS figure" — which replaces the deck's saved copy and
     leaves position, crop and size alone, because those live on the
     annotation and were never part of the snapshot. The renderer still
     never executes anything: the notebook is re-run by the user. */
  function provOf(a){
    if(!a||a.k!=='cell'||!a.ref) return null;
    var live=ITEMS[a.ref]||null;
    if(!live&&String(a.ref).indexOf('::')<0){
      for(var i=0;i<APP.order.length;i++){
        var k=nsKey(APP.order[i],a.ref);
        if(ITEMS[k]){live=ITEMS[k];break;}
      }
    }
    var saved=embFor(a.ref)||null;
    var it=resolveRef(a.ref);
    return {live:live,saved:saved,it:it,ref:a.ref};
  }
  /* the only staleness question this format can answer honestly: does
     the deck's saved copy still say what the notebook says? */
  function provState(p){
    if(!p) return 'none';
    if(!p.live&&!p.saved) return 'missing';
    if(!p.live) return 'nolive';
    if(!p.saved) return 'nosaved';
    var a=liveCardHtml(p.ref),b=(p.saved&&p.saved.html)||'';
    if(!a) return 'nolive';
    return (a===b)?'same':'stale';
  }
  /* the LIVE card's body, in exactly the shape the save path captures
     it (cloneBody(...).outerHTML) — so "has the notebook moved on" is a
     comparison of like with like, not of one rendering against another.

     cloneBody falls back to the deck's OWN copy when the notebook is
     shut, which would make every figure look permanently in step. So
     the presence of a real card is checked first, and no card means no
     answer rather than a wrong one. */
  function liveCardHtml(ref){
    try{
      if(!cardEl(ref)) return '';
      var b=cloneBody(ref);
      return b?b.outerHTML:'';
    }catch(e){return '';}
  }
  function renderProvPane(){
    var list=$('#provpane-list'),head=$('#provpane-count');
    var ttl=$('#provpane-t');
    if(!list) return;
    var s2=pres.slides[cur];
    /* The clicked item is the inspector's subject. A group's last member
       can be a different annotation with different provenance. */
    var a=s2&&typeof selAnnot==='number'&&(s2.annots||[])[selAnnot];
    list.innerHTML='';
    var p=provOf(a);
    if(!p){
      if(head) head.textContent='';
      if(ttl) ttl.textContent='Where this came from';
      var g=document.createElement('div');
      g.className='pf-ok';
      g.textContent='Select a frame that shows a notebook card. A drawn '
        +'shape or a text box has no source to point at.';
      list.appendChild(g);
      return;
    }
    var st=provState(p);
    if(ttl) ttl.textContent=(p.it&&p.it.title)||'This figure';
    var pr=splitRef(p.ref);
    if(head) head.textContent=(pr[0]||'?')+' \u00b7 '+(pr[1]||'?');

    function line(cls,h,w){
      var d=document.createElement('div');
      d.className='std-find std-'+cls;
      var t1=document.createElement('div');
      t1.className='std-h';t1.textContent=h;d.appendChild(t1);
      if(w){var t2=document.createElement('div');
        t2.className='std-why';t2.textContent=w;d.appendChild(t2);}
      list.appendChild(d);
      return d;
    }
    var msg={
      same:['In step with its notebook',
        'The card in the notebook and the copy saved with this deck say '
        +'the same thing.'],
      stale:['The notebook has moved on',
        'The card in the notebook no longer matches the copy saved with '
        +'this deck \u2014 re-run it, or take the live version below.'],
      nolive:['Showing the deck\u2019s saved copy',
        'That notebook is not open, so there is nothing to compare '
        +'against. This is the copy saved with the deck.'],
      nosaved:['Live from the notebook',
        'No copy is saved with the deck yet; it will be written the '
        +'next time you save.'],
      missing:['Nothing to show',
        'Neither the notebook nor a saved copy can be found for this '
        +'reference.']
    }[st]||['Unknown',''];
    line(st==='stale'?'warn':(st==='missing'?'warn':'info'),
      msg[0],msg[1]);

    /* THE LINEAGE, from the chains the parser already computed */
    var group=p.it?lineageForItem(p.it.ns):null;
    var steps=(group&&group.steps)||[];
    if(steps.length){
      var lh=document.createElement('div');
      lh.className='hd-lab';lh.textContent='made by';
      list.appendChild(lh);
      steps.forEach(function(stp){
        var b=document.createElement('button');
        b.className='dbtn vw-opt';
        b.textContent=stp.title||stp.card||'a cell';
        b.title='Open this cell in its notebook';
        b.addEventListener('click',function(){
          if(window.SemApp&&window.SemApp.traceGoto)
            window.SemApp.traceGoto(stp.card);
        });
        list.appendChild(b);
      });
    }
    var ah=document.createElement('div');
    ah.className='hd-lab';ah.textContent='go to';
    list.appendChild(ah);
    var jump=document.createElement('button');
    jump.className='dbtn vw-opt';
    jump.textContent='Open the plot trace';
    jump.title='Every cell that built this figure, in execution order';
    jump.addEventListener('click',function(){
      if(window.SemTrace&&pr[0]) window.SemTrace.open(pr[0],pr[1]);
    });
    list.appendChild(jump);

    /* T20: take the live version for THIS figure */
    if(st==='stale'||st==='nosaved'){
      var uh=document.createElement('div');
      uh.className='hd-lab';uh.textContent='update';
      list.appendChild(uh);
      var up=document.createElement('button');
      up.className='dbtn vw-opt';
      up.textContent='Take the notebook\u2019s version of this figure';
      up.title='Replaces the copy saved with the deck. Where it sits, '
        +'its size and its crop are on the frame, not the snapshot, so '
        +'none of them change.';
      up.addEventListener('click',function(){
        var n=resyncFigure(a);
        toast(n?'Updated from the notebook \u2014 position, size and '
          +'crop unchanged':'Could not read the live card');
        renderProvPane();
      });
      list.appendChild(up);
    }
  }
  /* T20. The snapshot is replaced; the ANNOTATION is not touched at all,
     which is why position, crop and size survive by construction rather
     than by being carefully copied back. */
  function resyncFigure(a){
    var p=provOf(a);
    if(!p||!p.live) return 0;
    var html=liveCardHtml(p.ref);
    if(!html) return 0;
    /* the same record shape the save path writes, keyed the same way —
       one snapshot format, not two */
    var e={title:p.live.title||'',kind:p.live.kind||'',html:html};
    var cc=p.live.hasCode?cloneCode(p.ref):null;
    if(cc) e.code=cc.outerHTML;
    embStore(normRef(p.ref)||p.ref,e);
    markDirty();
    var l=stage.querySelector('.annot-layer');
    if(l) renderAnnots(l,pres.slides[cur]);
    return 1;
  }
  function showProvPane(){
    var pane=$('#provpane'); if(!pane) return;
    ['#selpane','#animpane','#preflight','#notespane','#stdpane',
     '#tidypane','#objhist'].forEach(function(sel){
      var o=$(sel); if(o) o.hidden=true;});
    pane.hidden=false;
    syncInspectorPanes(true);
    syncPaneDock();
  }
  (function(){
    var cl=$('#provpane-close');
    if(cl) cl.addEventListener('click',function(){
      var pn=$('#provpane'); if(pn) pn.hidden=true;
      syncPaneDock();
    });
  })();
  /* ---- FIGURE NUMBERS, AND REFERENCES TO THEM -------------------------
     (TASKS T18.) "Figure 7" numbered by deck order, and "see Figure 7"
     in a sentence renumbering itself when the slides move.

     THE ONE DECISION THAT MATTERS: A NUMBER IS NEVER STORED. It is
     derived, every render, from where the figure sits in the deck. The
     alternative — stamping "Figure 7" into the caption's words — is the
     thing this task exists to abolish: it is right until somebody drags
     slide 9 above slide 4, and then it is wrong everywhere and silently.
     Nothing here writes a number into any text.

     So a caption says `{fig}` and a sentence says `{fig:id}`, and both
     are resolved at render exactly the way the header and footer already
     resolve `{n}` and `{N}` — furnText has done this since the page
     furniture landed, and this is the same idea one level down. Deleting
     a figure renumbers the rest on the next repaint, for free, because
     there was never a number to go and update.

     READING ORDER, not array order. The array is the order things were
     DRAWN in, which is nobody's idea of a sequence; orderedIdx already
     solved this for build steps, using a row-band then left-to-right
     sweep, and figure numbers use the same one so a figure's number and
     its build order can never disagree.

     A reference names a figure by its `cap` id — the same opaque id T17
     mints to tie a caption on — so a reference survives the figure being
     moved, restyled, or given a different caption. It only breaks if the
     figure is deleted, and then it says so in words rather than
     rendering a wrong number. */
  function figNumbers(){
    var map={},n=0;
    (pres.slides||[]).forEach(function(sl,si){
      var ord=orderedIdx(sl);
      ord.forEach(function(i){
        var a=(sl.annots||[])[i];
        if(!isFigure(a)||a.hide) return;
        n++;
        if(!a.cap) a.cap=figId();
        map[a.cap]={n:n,si:si};
      });
    });
    return map;
  }
  /* the words a figure token resolves to. `{fig}` in a caption means
     "the number of the figure I am tied to"; `{fig:id}` anywhere means
     "the number of that one". A reference to a figure that has gone
     says so — a silently wrong number is the failure this replaces. */
  function figSubst(txt,a,map){
    var t=String(txt||'');
    if(t.indexOf('{fig')<0) return t;
    map=map||figNumbers();
    return t.replace(/\{fig(?::([A-Za-z0-9_]+))?\}/g,function(_,id){
      var key=id||(a&&a.capOf)||(a&&a.cap);
      var hit=key?map[key]:null;
      return hit?String(hit.n):(id?'[missing figure]':'[not a caption]');
    });
  }
