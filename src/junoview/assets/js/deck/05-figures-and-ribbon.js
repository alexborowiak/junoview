/* 05-figures-and-ribbon.js — figures agreeing with each other, standardised text, and the ribbon.
   ONE FRAGMENT of deck.js's single IIFE, concatenated with its
   siblings in filename order by assets.deck_js(). It does not
   parse alone and is not meant to: see 00-page.js. */
  /* ---- DO THE FIGURES AGREE WITH EACH OTHER ---------------------------
     (TASKS T22.) The same question standardise() asks of the type, asked
     of the figures — which is why it renders into the same pane rather
     than growing a sixth one.

     "WHERE METADATA ALLOWS" is the whole scope of this task and it is
     worth being blunt about what that means, because the honest answer
     is narrow:

       A RASTER FIGURE IS A WALL. A PNG of a matplotlib plot carries no
       font name, no point size and no margin — there is nothing to read
       and no amount of cleverness will produce it. Anything claiming
       otherwise would be measuring pixels and calling them typography.

       AN SVG FIGURE CAN BE READ. Its text nodes carry font-family and
       font-size as attributes, so a deck whose figures are SVG really
       can be told that three of them are set in DejaVu Sans and one in
       Helvetica.

       AND THE ONE THING TRUE OF EVERY FIGURE is how big it is ON THE
       PAGE. That is not metadata about the figure, it is a fact about
       the deck — and it is the thing that actually makes a deck look
       careless, because a plot shown at 45% and another at 22% have
       type at half the size of each other whatever the notebook did.

     So: scale first, because it applies to everything and is fixable
     here; then content zoom; then fonts, for the SVG figures that can
     answer. The font finding has NO fix button, deliberately — the fix
     is in the notebook, and a button here would be a lie. */
  function figBoxes(){
    var out=[];
    (pres.slides||[]).forEach(function(sl,si){
      (sl.annots||[]).forEach(function(a,ai){
        if(!isFigure(a)||a.hide) return;
        out.push({si:si,ai:ai,a:a});
      });
    });
    return out;
  }
  /* the font faces and sizes an SVG figure actually uses. Read off the
     ATTRIBUTES, not computed style: these nodes are detached clones and
     a detached node has no computed font. */
  function figFonts(a){
    var body=null;
    try{
      var el=cardEl(a.ref);
      /* T303: the same body the frame renders. figLint decides WHICH
         frames are figures from the kept copy (cellFacets) and then
         reported their typefaces from the notebook, so "2 figures use
         different type sizes from the rest" could be a sentence about
         a figure nobody can see. */
      var keptB=refIsLive(a.ref)?null:embBody(a.ref);
      body=keptB||(el?el.querySelector('.cardbody'):embBody(a.ref));
    }catch(e){body=null;}
    if(!body) return null;
    var svg=body.querySelector&&body.querySelector('svg');
    if(!svg) return null;
    var fams={},sizes={},n=0;
    var texts=svg.querySelectorAll('text,tspan');
    for(var i=0;i<texts.length&&i<400;i++){
      var t=texts[i];
      var fam=t.getAttribute('font-family')
        ||(t.style&&t.style.fontFamily)||'';
      var sz=t.getAttribute('font-size')
        ||(t.style&&t.style.fontSize)||'';
      if(fam){fams[String(fam).split(',')[0].replace(/['"]/g,'').trim()]=1;}
      if(sz){sizes[String(sz).trim()]=1;}
      if(fam||sz) n++;
    }
    if(!n) return null;
    return {fams:Object.keys(fams),sizes:Object.keys(sizes)};
  }
  function figMedian(v){
    var a=v.slice().sort(function(p,q){return p-q;});
    return a[Math.floor(a.length/2)];
  }
  /* how far from the median a figure has to sit before it reads as a
     different size rather than a deliberate one. A quarter: two figures
     within 25% of each other look like a pair, and 40% apart looks like
     nobody checked. */
  var FIG_SCALE_TOL=0.25;
  function figLint(){
    var out=[],boxes=figBoxes();
    if(boxes.length<2) return out;

    /* ---- 1. shown at very different sizes ---- */
    var widths=boxes.map(function(p){return p.a.w||0;})
      .filter(function(w){return w>0;});
    if(widths.length>=2){
      var med=figMedian(widths);
      var odd=boxes.filter(function(p){
        var w=p.a.w||0;
        return w>0&&Math.abs(w-med)/med>FIG_SCALE_TOL;});
      if(odd.length&&odd.length<boxes.length){
        out.push({kind:'figscale',sev:'warn',
          head:odd.length+' figure'+(odd.length===1?' is':'s are')
            +' shown at a different size',
          why:'Most of this deck\u2019s figures are about '
            +med.toFixed(0)+'% of the page wide; '
            +(odd.length===1?'this one is':'these are')+' '
            +odd.map(function(p){
              return (p.a.w||0).toFixed(0)+'%';}).join(', ')
            +'. Type inside a figure scales with the figure, so this is '
            +'what makes the labels come out different sizes.',
          list:odd,
          act:'Make '+(odd.length===1?'it':'them')+' '
            +med.toFixed(0)+'% too',
          fix:(function(o,m){return function(){
            o.forEach(function(p){
              var w0=p.a.w||0;
              if(!(w0>0)) return;
              var k=m/w0;
              p.a.w=m;
              if(p.a.h) p.a.h=p.a.h*k;
            });
            return o.length;
          };})(odd,med)});
      }
    }

    /* ---- 2. content zoom set on some frames and not others ---- */
    var zs={};
    boxes.forEach(function(p){
      if(p.a.k!=='cell') return;
      var z=(p.a.ts||1);
      (zs[z]=zs[z]||[]).push(p);});
    var zk=Object.keys(zs);
    if(zk.length>1){
      zk.sort(function(x,y){return zs[y].length-zs[x].length;});
      var most=zk[0],rest=[];
      zk.slice(1).forEach(function(k){
        rest=rest.concat(zs[k]);});
      out.push({kind:'figzoom',sev:'warn',
        head:rest.length+' frame'+(rest.length===1?'':'s')
          +' zoom their contents differently',
        why:'Most are at '+(+most*100).toFixed(0)+'%. A frame\u2019s '
          +'content zoom multiplies everything inside it, so two frames '
          +'at different zooms cannot have matching labels.',
        list:rest,
        act:'Put '+(rest.length===1?'it':'them')+' at '
          +(+most*100).toFixed(0)+'%',
        fix:(function(r,z){return function(){
          r.forEach(function(p){
            if(+z===1) delete p.a.ts; else p.a.ts=+z;});
          return r.length;
        };})(rest,most)});
    }

    /* ---- 3. the SVG figures that can answer about their type ---- */
    var fams={},sizeSets={},read=0;
    boxes.forEach(function(p){
      var f=figFonts(p.a);
      if(!f) return;
      read++;
      f.fams.forEach(function(nm){(fams[nm]=fams[nm]||[]).push(p);});
      /* the figure's whole set of sizes, as one key: the question is
         whether two figures agree, not which sizes exist */
      var key=f.sizes.slice().sort().join('|');
      if(key) (sizeSets[key]=sizeSets[key]||[]).push(p);
    });
    var fk=Object.keys(fams);
    /* THE SIZES IT WAS ALREADY COLLECTING. figFonts returned {fams,
       sizes} and nothing ever read `.sizes` — so "flag mismatched
       fonts/SIZES" was half-built: the numbers were gathered on every
       run and thrown away (2026-08-26 audit, T58). Reported per FIGURE
       rather than per value, because one figure legitimately uses
       several sizes (a title, then ticks); what reads as careless is
       two figures whose type has nothing in common. */
    var szk=Object.keys(sizeSets);
    if(read>=2&&szk.length>1){
      szk.sort(function(x,y){
        return sizeSets[y].length-sizeSets[x].length;});
      var odds=[];
      szk.slice(1).forEach(function(k){
        odds=odds.concat(sizeSets[k]);});
      out.push({kind:'figsize',sev:'info',
        head:odds.length+' figure'+(odds.length===1?' uses':'s use')
          +' different type sizes from the rest',
        why:'Most are set at '+szk[0].replace(/\|/g,', ')+'. Read from '
          +'the SVG itself, so only the '+read+' vector figure'
          +(read===1?'':'s')+' could be asked. Two figures shown at the '
          +'same width whose type differs like this will not look like '
          +'a pair \u2014 and the fix is one rcParams in the notebook, '
          +'which is why there is no button here.',
        list:odds,
        act:null});
    }
    if(read>=2&&fk.length>1){
      fk.sort(function(x,y){return fams[y].length-fams[x].length;});
      out.push({kind:'figfont',sev:'info',
        head:'Your figures are set in '+fk.length+' different typefaces',
        why:fk.map(function(nm){
          return nm+' ('+fams[nm].length+')';}).join(', ')
          +'. Read from the SVG itself, so only the '+read+' vector '
          +'figure'+(read===1?'':'s')+' could be asked \u2014 a PNG '
          +'carries no font name at all. Fixing this means re-running '
          +'the notebook with one rcParams, which is why there is no '
          +'button here.',
        list:fams[fk[fk.length-1]],
        act:null});
    }
    /* ---- 4. trimmed on some figures and not others ---- */
    /* The "where metadata allows" argument covers a PNG's INTERNAL
       margins — there is nothing in the file to read. But the deck
       holds per-figure trim insets of its own, written by the trim
       handles, and they need no metadata at all: a.crop's t/r/b/l are
       right here. Two figures side by side, one trimmed to its axes and
       one not, is exactly the "different margins" the spec names
       (2026-08-26 audit, T58). */
    var trimmed=boxes.filter(function(p){
      var c=p.a.crop;
      return !!(c&&(c.t||c.r||c.b||c.l));});
    if(trimmed.length&&trimmed.length<boxes.length){
      var few=(trimmed.length*2<=boxes.length);
      var odd2=few?trimmed:boxes.filter(function(p){
        return trimmed.indexOf(p)<0;});
      out.push({kind:'figtrim',sev:'info',
        head:odd2.length+' figure'+(odd2.length===1?' is':'s are')
          +(few?' trimmed and the rest are not'
               :' untrimmed and the rest are'),
        why:'A trim changes how much white space a figure carries round '
          +'its plot, so a trimmed figure and an untrimmed one at the '
          +'same width put their axes at different sizes. This is the '
          +'deck\u2019s own trim, not anything inside the file.',
        list:odd2,
        act:few?null:'Clear the trims',
        fix:few?null:(function(o){return function(){
          o.forEach(function(p){delete p.a.crop;});
          return o.length;
        };})(odd2)});
    }
    return out;
  }
  function figRow(f){
    var box=document.createElement('div');
    box.className='std-find std-'+f.sev;
    var h=document.createElement('div');
    h.className='std-h';h.textContent=f.head;box.appendChild(h);
    var w=document.createElement('div');
    w.className='std-why';w.textContent=f.why;box.appendChild(w);
    var who=document.createElement('div');who.className='std-who';
    (f.list||[]).slice(0,12).forEach(function(p){
      var c=document.createElement('button');
      c.className='std-chip';
      c.textContent=(p.si+1)+' \u00b7 '+annotLabel(p.a);
      c.title='Go to it';
      c.addEventListener('click',function(){
        go(p.si);
        var l=stage.querySelector('.annot-layer');
        if(l&&typeof p.ai==='number') selectAnnot(l,p.ai);
      });
      who.appendChild(c);
    });
    box.appendChild(who);
    if(f.act&&f.fix){
      var act=document.createElement('button');
      act.className='dbtn std-do';
      act.textContent=f.act;
      act.addEventListener('click',function(){
        var n=f.fix()||0;
        markDirty();refresh();
        toast(n+' figure'+(n===1?'':'s')+' matched \u2014 Ctrl+Z '
          +'undoes it');
        renderStdPane();
      });
      box.appendChild(act);
    }
    return box;
  }
  /* ---- STANDARDISE TEXT -------------------------------------------------
     (2026-08-22, user: "it would be cool if there was a button that was
     called 'standardise text', and checked if all headings paragraphs,
     captions, are looking the same".)

     preflight() above asks whether THIS page is safe to print. This asks
     a different question — whether the DECK agrees with itself — and it
     has to answer it for the deck nobody has styled, because a check
     that only read a.style would look at forty slides of hand-set text,
     find no styles to disagree, and report "all fine". That is not a
     weak answer, it is a false one, and it is the half of this worth
     building carefully.

     So there are two passes. Boxes that WEAR a style are measured
     against the style they claim. Boxes wearing nothing are bucketed by
     what they LOOK like, and the bucket is then offered a name — which
     is the part that pays for itself, because once a band is named,
     restyleAll, "apply this look to all headings" and the Apply dialog's
     bucketing all start working on a deck that was invisible to them. */

  /* WHY THESE NUMBERS. Every one is anchored to a step the editor itself
     can take, so a threshold never fires on a difference nobody could
     have made deliberately, and never misses one they did.
       SIZE 1.03 — the pt readout is size*5.4, so 3% of a 2.6 body is
     0.4pt: below it nothing is visible, above it two headings side by
     side read as different sizes. It sits well inside the A+/A− stepper's
     1.12, so one deliberate press always registers as a real difference.
       BAND 1.06 — half a stepper press. Two sizes closer than this were
     nudged apart by hand and meant to be one size; 12% apart is one press
     and is meant.
       LUM 0.05 — about the gap between the Caption grey (#8aa0b0) and the
     subtitle grey (#7e93a4). Those two ARE two hand-picked greys doing
     the same job, which is exactly the thing to report.
       CHAN 0.10 — a different HUE at the same tone is invisible to a
     luminance test, so it needs its own number.
       POS 1.0 / W 2.0 — 1% of a 16:9 page is under half a character at
     body size; more than that and a heading visibly jumps as you page
     through, which is the drift nothing else in this file can see.
     Module-local: a threshold is a judgement about type, not a property
     of one deck. */
  var STD_SIZE_TOL=1.03, STD_BAND_TOL=1.06;
  var STD_LUM_TOL=0.05,  STD_CHAN_TOL=0.10;
  var STD_POS_TOL=1.0,   STD_W_TOL=2.0;
  /* an ABSENT a.color is not "unknown", it is the page ink — resolve it
     before comparing or a deck where half the boxes say #ffffff and half
     say nothing reports a drift that is not on the screen. The same ink
     preflight computes. */
  /* T480: the page's ink is the resolver's answer (tokDefaults follows
     the page), so a box wearing '@ink' and a box wearing nothing are
     the same colour to the check, as they are on the screen */
  function stdInk(){
    return tokVal('@ink');
  }
  function stdSize(a){return (a&&a.size)||2.6;}
  function stdCol(a){return tokVal(a&&a.color)||stdInk();}
  /* two numbers, because "a different colour" is true in two ways and one
     distance hides one behind the other */
  function colDrift(c1,c2){
    var a=rgbOf(tokVal(c1)),b=rgbOf(tokVal(c2));
    if(!a||!b) return String(c1||'')===String(c2||'')?0:1;
    var dl=Math.abs(relLum(a)-relLum(b));
    var dh=Math.max(Math.abs(a[0]-b[0]),Math.abs(a[1]-b[1]),
      Math.abs(a[2]-b[2]))/255;
    if(dl>STD_LUM_TOL) return dl;
    if(dh>STD_CHAN_TOL) return dh;
    return 0;
  }
  /* EVERY text-bearing thing in the deck, in reading order per slide.
     Title slides are in here on purpose: their title and subtitle are
     text the user thinks of as headings and they honour the same
     properties applyStyleTo writes, so a check that skipped them would
     call a deck consistent while its title slides disagreed. They carry
     no width and are centred, so the geometry checks skip them — that is
     what `fixed` marks. */
  function stdBoxes(){
    var out=[];
    (pres.slides||[]).forEach(function(sl,si){
      if(sl.layout==='title'){
        out.push({si:si,ai:'t',a:titleProps(sl,'t'),fixed:1});
        out.push({si:si,ai:'s',a:titleProps(sl,'s'),fixed:1});
      }
      (sl.annots||[]).map(function(a,ai){return {si:si,ai:ai,a:a};})
        .filter(function(p){return p.a&&p.a.k==='text'&&!p.a.hide;})
        /* the same reading-order sort matchSlide's bucket() uses, so
           "the first heading on the slide" means one thing in this file */
        .sort(function(p,q){
          var dy=(p.a.y||0)-(q.a.y||0);
          return Math.abs(dy)>4?dy:((p.a.x||0)-(q.a.x||0));})
        .forEach(function(p){out.push(p);});
    });
    return out;
  }
  /* the commonest value in a list. `n` against `of` is what decides
     whether there is a majority to fix TOWARDS or merely a disagreement
     to report. */
  function stdMode(list,key){
    var seen={},best=null;
    list.forEach(function(p){
      var v=String(key(p));
      if(!seen[v]) seen[v]={v:v,n:0};
      seen[v].n++;
      if(!best||seen[v].n>best.n) best=seen[v];
    });
    return best?{v:best.v,n:best.n,of:list.length}:null;
  }
  /* ---- bucketing the UNSTYLED half -------------------------------------
     RANKS, not absolute sizes. A poster's body is 2.6% of an A0 and a
     slide's body is 2.6% of a 16:9, but a deck built by hand may have
     settled on 4.0 for its body and 6.5 for its headings and be perfectly
     consistent. What matters is how many distinct sizes the deck uses and
     which of them is worn by the most boxes, so the bands are found first
     and named afterwards. */
  function stdBands(boxes){
    var sizes=[],bands=[],cur=null;
    boxes.forEach(function(p){sizes.push(stdSize(p.a));});
    sizes.sort(function(x,y){return x-y;});
    sizes.forEach(function(v){
      /* merge greedily against the band's SMALLEST member, so a long
         string of 3%-apart sizes cannot creep into one band that spans
         two real levels */
      if(cur&&v/cur.lo<=STD_BAND_TOL){cur.hi=v;return;}
      cur={lo:v,hi:v,boxes:[]};bands.push(cur);
    });
    boxes.forEach(function(p){
      var v=stdSize(p.a);
      for(var i=0;i<bands.length;i++)
        if(v>=bands[i].lo/1.0001&&v<=bands[i].hi*1.0001){
          bands[i].boxes.push(p);return;}
    });
    bands=bands.filter(function(b){return b.boxes.length;});
    /* the band's INTENDED size is the one worn by the most boxes, not the
       mean: drift is the minority, and averaging lets two stray large
       headings pull the whole band up */
    bands.forEach(function(b){
      var m=stdMode(b.boxes,function(p){return stdSize(p.a).toFixed(2);});
      b.size=parseFloat(m.v);b.agree=m.n;
    });
    bands.sort(function(x,y){return y.size-x.size;});
    return bands;
  }
  /* does this box sit directly beneath a placed figure? The cheapest
     reliable caption signal in the file, and the one thing size alone
     cannot find. */
  function stdUnderFigure(p){
    var sl=pres.slides[p.si]; if(!sl||p.fixed) return false;
    var y=p.a.y||0,x1=p.a.x||0,x2=x1+(p.a.w||0);
    return (sl.annots||[]).some(function(c){
      if(!c||c.k!=='cell'||c.hide) return false;
      var cb=(c.y||0)+(c.h||0),cx1=c.x||0,cx2=cx1+(c.w||0);
      return y>=cb-1&&y<=cb+6&&x2>cx1&&x1<cx2;
    });
  }
  /* Name a band: nearest style in LOG space, because the ladder is
     multiplicative (~1.3x a step) and a linear "closest" would drag every
     large band towards Title. Styles are consumed as they are used and
     the bands are walked biggest-first, which keeps the naming MONOTONE —
     a bigger band never gets a smaller style. That property is what makes
     the answer legible ("your three sizes are Heading 1, Body, Caption")
     and it matters more than the theoretically closest name for any one
     band. styleOrder(), so a type you invented can be suggested too. */
  function stdName(bands){
    /* T277: a subtitle is the line UNDER A TITLE -- a place, not a size
       band -- so size alone must never suggest it: a deck of 3.4% body
       paragraphs is Body, not a page of subtitles. Like caption, it is
       a name only the user gives. */
    var left=styleOrder().filter(function(id){return id!=='subtitle';});
    bands.forEach(function(b){
      var best=null,bestD=1e9;
      left.forEach(function(id){
        var d=Math.abs(Math.log(b.size/styleDef(id).size));
        if(d<bestD){bestD=d;best=id;}
      });
      b.suggest=best||'body';
      b.close=bestD<Math.log(1.35);
      left=left.filter(function(id){return id!==b.suggest;});
    });
    /* two cheap signals that beat size alone. A CAPTION is the one the
       user named and the one size cannot find. */
    bands.forEach(function(b){
      var capt=0,bold=0;
      b.boxes.forEach(function(p){
        if(p.a.b) bold++;
        if(stdUnderFigure(p)) capt++;
      });
      if(capt*2>b.boxes.length&&b===bands[bands.length-1]
        &&STYLE_DEFAULTS.caption) b.suggest='caption';
      /* the biggest band, mostly bold, is a heading however near Body its
         size happens to land */
      if(b===bands[0]&&bold*2>b.boxes.length&&b.suggest==='body')
        b.suggest='h1';
    });
    return bands;
  }
  var STD_PROPS=[
    {k:'size', label:'size',
     get:function(a){return stdSize(a).toFixed(2);},
     same:function(x,y){var l=Math.min(+x,+y),h=Math.max(+x,+y);
       return h/l<=STD_SIZE_TOL;}},
    {k:'b',      label:'weight',           get:function(a){return a.b?1:0;}},
    {k:'i',      label:'italics',          get:function(a){return a.i?1:0;}},
    {k:'u',      label:'underlining',      get:function(a){return a.u?1:0;}},
    {k:'strike', label:'strike-through',   get:function(a){return a.strike?1:0;}},
    {k:'font',   label:'typeface',         get:function(a){return a.font||'';}},
    {k:'align',  label:'alignment',        get:function(a){return a.align||'';}},
    {k:'color',  label:'colour', get:stdCol,
     same:function(x,y){return colDrift(x,y)===0;}},
    {k:'lh',     label:'line spacing',     get:function(a){return a.lh||0;},
     same:function(x,y){return Math.abs(x-y)<=0.02;}},
    {k:'pspace', label:'paragraph spacing',get:function(a){return a.pspace||0;},
     same:function(x,y){return Math.abs(x-y)<=0.02;}}
  ];
  /* boxes that disagree with the commonest value. A finding needs a
     MAJORITY to fix towards — two boxes disagreeing one-all is a choice,
     not a drift — so anything under two thirds is reported without an
     automatic answer. */
  function stdDrift(list,pr){
    var m=stdMode(list,function(p){return pr.get(p.a);});
    if(!m) return null;
    var same=pr.same||function(x,y){return String(x)===String(y);};
    var odd=list.filter(function(p){return !same(pr.get(p.a),m.v);});
    if(!odd.length) return null;
    return {prop:pr,mode:m.v,odd:odd,
      sev:(m.n*3>=list.length*2)?'warn':'info'};
  }
  /* GEOMETRY is compared ACROSS slides only, one box per slide. Two
     captions side by side on one slide legitimately sit at different x;
     the same heading landing somewhere else on slide 4 does not. Fewer
     than three slides is a layout, not a pattern — say nothing. */
  function stdGeom(list,k,tol){
    var perSlide=[],seenSlide={};
    list.forEach(function(p){
      if(p.fixed||seenSlide[p.si]) return;
      seenSlide[p.si]=1;perSlide.push(p);
    });
    if(perSlide.length<3) return null;
    var m=stdMode(perSlide,function(p){return (p.a[k]||0).toFixed(1);});
    var odd=perSlide.filter(function(p){
      return Math.abs((p.a[k]||0)-parseFloat(m.v))>tol;});
    if(!odd.length||m.n*3<perSlide.length*2) return null;
    return {geom:k,mode:parseFloat(m.v),odd:odd,sev:'warn',all:perSlide};
  }
  /* every property applyStyleTo would have written, still as written.
     Derived from ONE list shared with applyStyleTo rather than repeated,
     or a ninth style property would silently stop being noticed.
     That one list is STYLE_FIELDS, declared in 15-annotations.js. This
     file used to declare its OWN `var STYLE_FIELDS` here, with a
     different set ('size' in, head/bg/bdc out) -- and since the parts
     share one IIFE and 15 is concatenated after 05, 15's list simply
     replaced it before anything could read either. Nothing here read
     it, so the deleted copy changed no behaviour; what it did was tell
     every reader of this file something untrue (T259). */
  function stdMatchesStyle(a,d){
    if(Math.max(stdSize(a),d.size)/Math.min(stdSize(a),d.size)
      >STD_SIZE_TOL) return false;
    if(!!a.b!==!!d.b||!!a.i!==!!d.i) return false;
    if((a.font||'')!==(d.font||'')) return false;
    if(colDrift(stdCol(a),d.color||stdInk())) return false;
    /* T425: THE DEFAULT LOOK IS NOT A DIFFERENCE. Every template-born
       box carries align:'left' and bg:0, and a style that says nothing
       about either means "the default" -- left, transparent. Read
       strictly, 7 of 7 Heading 2 boxes on a poster fresh from its
       template "no longer matched the style" (2026-09-14). A style that
       ASKS for a ground (T314) still catches a box that lost it. */
    if((a.align||'left')!==(d.align||'left')) return false;
    if(Math.abs((a.lh||0)-(d.lh||0))>0.02) return false;
    if(Math.abs((a.pspace||0)-(d.pspace||0))>0.02) return false;
    var abg=(a.bg===0)?'':(a.bg?(a.bgc||''):''),dbg=d.bg||'';
    if(dbg==='none') dbg='';
    if(abg!==dbg) return false;
    var abd=a.bdc||'',dbd=d.bdc||'';
    if(abd==='none') abd=''; if(dbd==='none') dbd='';
    if(abd!==dbd) return false;
    return true;
  }
  /* T268: what the two values ARE. "2 of 7 differ" told you a count and
     left you to go and look; the whole job of this card is to save you
     that trip (2026-09-04, user: "the display for that is very confusing
     and I have no idea how to use it"). */
  function stdShow(pr,v){
    if(pr.k==='size') return Math.round(parseFloat(v)*5.4)+' pt';
    if(pr.k==='b') return +v?'bold':'not bold';
    if(pr.k==='i') return +v?'italic':'not italic';
    if(pr.k==='u') return +v?'underlined':'not underlined';
    if(pr.k==='strike') return +v?'struck through':'not struck through';
    return String(v||'').trim()||'unset';
  }
  /* the odd ones, as their values: "15 pt" or "15 pt and 16 pt" */
  function stdOddShow(pr,odd){
    var seen=[],out=[];
    odd.forEach(function(p){
      var v=stdShow(pr,pr.get(p.a));
      if(seen.indexOf(v)<0){seen.push(v);out.push(v);}
    });
    if(out.length<=2) return out.join(' and ');
    return out.slice(0,2).join(', ')+' and '+(out.length-2)+' more';
  }
  function stdBandWhy(b,d,inner){
    if(inner.length){
      var i0=inner[0];
      var first='Most are '+stdShow(i0.prop,i0.mode)+'; '
        +i0.odd.length+' '+(i0.odd.length===1?'is':'are')+' '
        +stdOddShow(i0.prop,i0.odd)+'.';
      return inner.length===1?first
        :(first+' Their '+(inner.length-1)+' other '
          +'difference'+(inner.length===2?'':'s')+' go too.');
    }
    return 'They match each other now. Give them the '+d.label
      +' style and a later change to all of them is one edit, not '
      +b.boxes.length+'.';
  }
  function standardise(){
    var boxes=stdBoxes(),out=[],named={},loose=[];
    boxes.forEach(function(p){
      if(p.a.style&&STYLE_DEFAULTS[p.a.style])
        (named[p.a.style]=named[p.a.style]||[]).push(p);
      else loose.push(p);
    });
    /* PASS ONE — boxes measured against the style they claim to wear.
       This one is easy and is not the point; it is here because a deck
       that HAS been styled and then hand-edited is the other half of the
       same question. */
    styleOrder().forEach(function(id){
      var list=named[id]; if(!list||list.length<2) return;
      var d=styleDef(id),odd=list.filter(function(p){
        return !stdMatchesStyle(p.a,d);});
      if(!odd.length) return;
      out.push({kind:'named',style:id,list:list,odd:odd,sev:'warn',
        head:odd.length+' of '+list.length+' '+d.label+' boxes no '
          +'longer match the style',
        why:'They have the '+d.label+' style but were changed by hand '
          +'afterwards. Putting the style back makes them match again.'});
    });
    /* PASS TWO — the boxes wearing nothing, which on most decks is all of
       them. Bands first, names second, drift within a band third. */
    var bands=stdName(stdBands(loose));
    bands.forEach(function(b){
      if(b.boxes.length<2) return;
      var d=styleDef(b.suggest),inner=[];
      STD_PROPS.forEach(function(pr){
        var r=stdDrift(b.boxes,pr); if(r) inner.push(r);
      });
      out.push({kind:'band',band:b,list:b.boxes,inner:inner,
        sev:inner.length?'warn':'info',
        head:b.boxes.length+' boxes at about '+Math.round(b.size*5.4)
          +' pt'+(inner.length?(' — '+inner[0].odd.length+' '
            +(inner[0].odd.length===1?'has':'have')+' a different '
            +inner[0].prop.label):', no named style yet'),
        why:stdBandWhy(b,d,inner)});
      ['x','w'].forEach(function(k){
        var g=stdGeom(b.boxes,k,k==='x'?STD_POS_TOL:STD_W_TOL);
        if(g) out.push({kind:'geom',band:b,g:g,sev:'warn',
          head:(k==='x'?'These move sideways between slides'
                       :'These are different widths between slides'),
          why:g.odd.length+' of '+g.all.length+' sit at a different '
            +(k==='x'?'left edge':'width')+' from the other '
            +(g.all.length-g.odd.length)+'. Paging through, they jump.'});
      });
    });
    return {findings:out,boxes:boxes.length,bands:bands,named:named,
      styled:Object.keys(named).length};
  }
  /* ---- THE FIX ---------------------------------------------------------
     ONE undo entry, always. Every writer mutates the model directly and
     hands the sweep to stdFix, which calls markDirty exactly once — the
     same contract restyleAll has kept since it was written. Going through
     fmtApply instead would push one entry per box AND touch only the
     current slide, which is both halves of wrong. */
  function stdFix(list,fn,note){
    list.forEach(function(p){fn(p.a,p);});
    markDirty();      /* the single histPush for the whole sweep */
    refresh();        /* markDirty repaints ONE thumbnail; this does the rest */
    renderStdPane();  /* the finding disappears: that is the feedback */
    toast(note+' — Ctrl+Z puts them back');
  }
  /* adopting a band does NOT stamp STYLE_DEFAULTS' values onto it. That
     would resize and recolour the MAJORITY of the band to punish the user
     for tidying up — the opposite of standardising. The definition is
     built from the band's own commonest values first, so the majority
     does not move a pixel, only the strays snap into line, and the deck
     ends up with a style whose numbers are what the deck already looked
     like (2026-08-22). */
  function stdAdopt(band){
    var id=band.suggest,d=styleDef(id),o={label:d.label,size:band.size};
    if(isHeadingStyle(id)&&BUILTIN_STYLE_IDS.indexOf(id)<0) o.head=1;
    [['b',1],['i',1],['font',''],['color',''],['align',''],
     ['lh',0],['pspace',0],['bg',''],['bdc','']].forEach(function(pr){
      var m=stdMode(band.boxes,function(p){
        /* T314: bg is a.bg/a.bgc, read through applyStyleTo's mapping */
        if(pr[0]==='bg') return (p.a.bg===0)?'none':(p.a.bg?(p.a.bgc||''):'');
        return pr[0]==='color'?stdCol(p.a):(p.a[pr[0]]||pr[1]&&0||'');});
      if(!m) return;
      var v=m.v;
      if(pr[0]==='b'||pr[0]==='i'){if(v==='1') o[pr[0]]=1;}
      else if(pr[0]==='lh'||pr[0]==='pspace'){
        if(parseFloat(v)>0) o[pr[0]]=parseFloat(v);}
      else if(v&&v!=='0'&&!(pr[0]==='color'&&v===stdInk())) o[pr[0]]=v;
    });
    deckStyles()[id]=o;
    /* EVERY box in the band, not only the odd ones: naming the band is
       the point, and half a band wearing a name is not a group */
    stdFix(band.boxes,function(a){applyStyleTo(a,id);},
      band.boxes.length+' box'+(band.boxes.length===1?'':'es')
        +' are now '+o.label);
  }
  /* the quieter half, for someone who does not want the style system:
     make them agree with each other and set no a.style at all */
  function stdFlatten(inner){
    stdFix(inner.odd,function(a){
      var pr=inner.prop;
      if(pr.k==='size') a.size=parseFloat(inner.mode);
      /* T480: the page's own ink is "no colour", never a baked literal
         that vanishes when the page turns light */
      else if(pr.k==='color'){
        if(inner.mode===stdInk()) delete a.color; else a.color=inner.mode;}
      else if(inner.mode==='0'||inner.mode===''||inner.mode==='NaN')
        delete a[pr.k];
      else a[pr.k]=(pr.k==='lh'||pr.k==='pspace')
        ?parseFloat(inner.mode):inner.mode;
    },'Their '+inner.prop.label+' now matches');
  }
  /* a style has no opinion about WHERE a box sits, so this is the one fix
     applyStyleTo cannot do */
  function stdAlign(g){
    stdFix(g.odd,function(a){a[g.geom]=g.mode;},
      g.odd.length+' box'+(g.odd.length===1?'':'es')+' lined up');
  }
  /* the slide number and a specimen of the box's own words, in its own
     colour, ground, face, weight and slant -- shared by the finding cards
     and the T383 "compared, and they match" rows */
  function stdSpecimenInto(c,p){
    var sn=document.createElement('span');
    sn.className='std-chipn';
    sn.textContent=String(p.si+1);
    c.appendChild(sn);
    var sp=document.createElement('span');
    sp.className='std-chiptx';
    var sl0=(pres.slides||[])[p.si]||{};
    var words=p.fixed
      ?String((p.ai==='t'?sl0.title:sl0.sub)||'')
      :String((p.a&&p.a.text)||'');
    words=words.replace(/\s+/g,' ').trim();
    sp.textContent=words
      ||(p.fixed?(p.ai==='t'?'title':'subtitle'):annotLabel(p.a));
    if(!words) sp.className+=' std-chipempty';
    if(!p.fixed&&p.a){
      var st0=(p.a.style&&typeof styleDef==='function')
        ?styleDef(p.a.style):null;
      var col0=p.a.color||(st0&&st0.color);
      var bg0=(p.a.bg!==0)&&(p.a.bgc||(st0&&st0.bg));
      var fam0=p.a.font||(st0&&st0.font);
      if(col0) sp.style.color=tokVal(col0);
      if(bg0&&bg0!=='none') sp.style.background=tokVal(bg0);
      if(fam0) sp.style.fontFamily=fontCss(fam0);
      if(p.a.b||(st0&&st0.b)) sp.style.fontWeight='700';
      if(p.a.i||(st0&&st0.i)) sp.style.fontStyle='italic';
    }
    c.appendChild(sp);
  }
  function stdRow(f){
    var box=document.createElement('div');
    box.className='std-find std-'+f.sev;
    var h=document.createElement('div');
    h.className='std-h';h.textContent=f.head;box.appendChild(h);
    var w=document.createElement('div');
    w.className='std-why';w.textContent=f.why;box.appendChild(w);
    var who=document.createElement('div');who.className='std-who';
    /* WHICH ONES ACTUALLY DISAGREE (T279). A `named` or `geom` card lists
       f.odd -- the offenders and nobody else -- but a BAND card has no
       f.odd, so this fell through to f.list and drew every box in the
       band, agreeing and disagreeing alike, as identical grey pills. On
       a hand-built deck the band card is most of the screen, so most of
       what you saw was a row of chips that would not tell you which one
       the head was talking about (2026-09-05, user: "the style system
       isn't helpful as you can't tell which boxes are not matching with
       the rest").
       Nothing is recomputed: f.inner already carries the verdict the
       head and the why are written from (T268). */
    var oddSet={},oddWhy={};
    (f.inner||[]).forEach(function(r){
      r.odd.forEach(function(p){
        var k=p.si+':'+p.ai;
        oddSet[k]=1;
        /* the sentence the card already knows, per box: "22 pt, where
           most are 24 pt" -- so the chip answers "what about it?" on
           hover instead of sending you to go and look */
        var line=stdShow(r.prop,r.prop.get(p.a))+', where most are '
          +stdShow(r.prop,r.mode);
        oddWhy[k]=oddWhy[k]?(oddWhy[k]+'; '+line):line;
      });
    });
    var chips=(f.g?f.g.odd:(f.odd||f.list)).slice();
    var anyOdd=Object.keys(oddSet).length>0;
    /* offenders first: the card is an offer to fix THEM, so they are
       what the eye should land on */
    if(anyOdd) chips.sort(function(p,q){
      return (oddSet[q.si+':'+q.ai]?1:0)-(oddSet[p.si+':'+p.ai]?1:0);});
    chips.slice(0,12).forEach(function(p){
      var k=p.si+':'+p.ai,bad=anyOdd?!!oddSet[k]:true;
      var c=document.createElement('button');
      /* a `named`/`geom` card lists only offenders, so everything on it
         is marked; a band card marks the ones that differ and mutes the
         rest rather than hiding them -- the fix moves the whole band, so
         you still need to see what it will touch */
      c.className='std-chip '+(bad?'std-odd':'std-ok');
      /* T368: THE BOX, NOT ITS KIND (2026-09-07, user: "it is hard to
         tell what any of these are as there are not previews of
         anything"). The card is about how these boxes LOOK, and it was
         listing them by their type -- three identical grey chips
         reading "Text - Presentation title". Each chip is a specimen of
         its own box now: its words, in its own colour, ground, face,
         weight and slant, with the style's answer where the box has
         none of its own. Same treatment as the Style system's Text
         column (T363), for the same reason. */
      stdSpecimenInto(c,p);
      c.title=bad?((oddWhy[k]||'This is the one that differs')
        +' — click to go to it')
        :'This one matches the rest — click to go to it';
      c.addEventListener('click',function(){
        /* go() clears the selection and re-renders, so the layer this box
           lives on does not exist until after it returns */
        go(p.si);
        if(typeof p.ai==='number'){
          var l=stage.querySelector('.annot-layer');
          if(l) selectAnnot(l,p.ai);
          /* AND SAY WHICH ONE, ON THE SLIDE. The ordinary selection ring
             is what every click puts on a box, so landing on one told
             you nothing about why you were sent.
             AFTER the paint, not during it. go() renders and selectAnnot
             renders again, and a class added between the two is thrown
             away by the second -- the "one change renders twice" trap
             this codebase has hit before. Driven: marked=0 until the
             mark was deferred. The element is re-queried inside the
             timeout for the same reason, and found by data-idx rather
             than child index, because renderAnnots puts two <svg> layers
             in first so the layer's children never line up with the
             annots array. */
          if(bad) setTimeout(function(){
            var l2=stage.querySelector('.annot-layer'); if(!l2) return;
            $$('.an-mismatch',l2).forEach(function(n){
              n.classList.remove('an-mismatch');});
            var el=l2.querySelector('.an-item[data-idx="'+p.ai+'"]');
            if(!el) return;
            el.classList.add('an-mismatch');
            setTimeout(function(){
              el.classList.remove('an-mismatch');},2600);
          },80);
        }
      });
      who.appendChild(c);
    });
    box.appendChild(who);
    var act=document.createElement('button');
    act.className='dbtn std-do';
    if(f.kind==='geom'){
      act.textContent='Line all '+f.g.all.length+' up';
      act.addEventListener('click',function(){stdAlign(f.g);});
    } else if(f.kind==='named'){
      act.textContent='Put the '+styleDef(f.style).label+' style back on '
        +'these '+f.odd.length;
      act.addEventListener('click',function(){
        stdFix(f.odd,function(a){applyStyleTo(a,f.style);},
          f.odd.length+' box'+(f.odd.length===1?'':'es')+' put back');
      });
    } else {
      act.textContent='Give all '+f.band.boxes.length+' the '
        +styleDef(f.band.suggest).label+' style';
      act.title='Every box here gets the '+styleDef(f.band.suggest).label
        +' style; the odd ones move to match the rest, the rest stay put.';
      act.addEventListener('click',function(){stdAdopt(f.band);});
    }
    box.appendChild(act);
    if(f.kind==='band'&&f.inner&&f.inner.length){
      var alt=document.createElement('button');
      alt.className='dbtn std-do std-do2';
      alt.textContent='Just make them match, no style';
      alt.title='Fix the '+f.inner[0].prop.label+' without giving them a '
        +'named style';
      alt.addEventListener('click',function(){stdFlatten(f.inner[0]);});
      box.appendChild(alt);
    }
    return box;
  }
  /* the pane and the full-screen view (T209) draw the same cards; the
     target is a parameter, and the pane's renderer refreshes the view
     when it is open so a fix pressed there redraws there */
  function renderStdInto(list,head){
    if(!list) return;
    var r=standardise();
    var figs=figBoxes().length,fl=figLint().length;
    /* A consistency check is a short list of possible problems, not a
       report of every thing that already matches. Suggestions for unnamed
       bands remain available in Style system, where naming a type is the
       task at hand. */
    var bad=r.findings.filter(function(f){return f.sev==='warn';});
    var n=bad.length+fl;
    var what=r.boxes+' text box'+(r.boxes===1?'':'es')
      +(figs?(' · '+figs+' figure'+(figs===1?'':'s')):'');
    if(head) head.textContent=n
      ?(n+' to check · '+what):('no differences found · '+what);
    list.innerHTML='';
    if(!bad.length){
      var msg=document.createElement('div');
      msg.className='pf-ok';
      msg.textContent=!r.boxes
        ?'No text boxes yet.'
        :r.styled
        ?'No text formatting differences found.'
        :'No clear differences found. Use Style system to name text types.';
      list.appendChild(msg);
      /* T383: SAY WHAT WAS CHECKED. "No differences found" over an empty
         screen read as a check that had not run (2026-09-12, user: "the
         execution was always weird"). One quiet line per group it
         compared -- the named styles, then the size bands -- each with
         a live specimen, so the screen shows its working without
         pushing a card for things that already match (T378). */
      var groups=[];
      styleOrder().forEach(function(id){
        var l=r.named&&r.named[id]; if(!l||l.length<2) return;
        groups.push({label:(styleDef(id)||{}).label||id,boxes:l});
      });
      (r.bands||[]).forEach(function(b){
        if(b.boxes.length<2) return;
        groups.push({label:b.boxes.length+' boxes at about '
          +Math.round(b.size*5.4)+' pt',boxes:b.boxes});
      });
      if(groups.length){
        menuHead(list,'compared, and they match');
        groups.forEach(function(g){
          var row=document.createElement('div');
          row.className='std-find std-checked';
          var h=document.createElement('div');
          h.className='std-h';
          h.textContent=g.label+' \u2014 '+g.boxes.length+' boxes match';
          row.appendChild(h);
          var who=document.createElement('div');who.className='std-who';
          g.boxes.slice(0,12).forEach(function(p){
            var c=document.createElement('button');
            c.className='std-chip std-ok';
            stdSpecimenInto(c,p);
            c.title='Slide '+(p.si+1)+' \u2014 click to go to it';
            c.addEventListener('click',function(){
              go(p.si);
              if(typeof p.ai==='number'){
                var l=stage.querySelector('.annot-layer');
                if(l) selectAnnot(l,p.ai);
              }
            });
            who.appendChild(c);
          });
          if(g.boxes.length>12){
            var more=document.createElement('span');
            more.className='std-more';
            more.textContent='and '+(g.boxes.length-12)+' more';
            who.appendChild(more);
          }
          row.appendChild(who);
          list.appendChild(row);
        });
      }
      appendFigLint(list);
      return;
    }
    bad.forEach(function(f){list.appendChild(stdRow(f));});
    appendFigLint(list);
  }
  function renderStdOverview(){
    renderStdInto($('#std-ov-body'),$('#std-ov-sub'));
  }
  function renderStdPane(){
    renderStdInto($('#stdpane-list'),$('#stdpane-count'));
    var ov=$('#std-ov');
    if(ov&&!ov.hidden) renderStdOverview();
  }
  /* the figure half (T22), in the same pane and under its own heading:
     the same question — does the deck agree with itself — asked of a
     different material. It is appended after the text findings in both
     the empty and the non-empty case, because "your type is consistent"
     is not an answer about the figures. */
  function appendFigLint(list){
    var fl=figLint();
    if(!fl.length) return;
    menuHead(list,'figures across the deck');
    fl.forEach(function(f){list.appendChild(figRow(f));});
  }
  (function(){
    var btn=$('#dsg-std'),pane=$('#stdpane');
    if(!btn||!pane) return;
    function set(open){
      if(open){
        paneShow('stdpane');
        /* rendered on open, on ↻ and after a fix — never from markDirty
           or refresh, or every keystroke would re-survey the deck */
        renderStdPane();
      } else paneHide('stdpane');
    }
    /* the ribbon door opens the FULL-SCREEN view (T209); the pane is
       still there for the pane owner but nothing on the ribbon opens it */
    var ov=$('#std-ov');
    btn.addEventListener('click',function(e){
      e.stopPropagation();
      if(ov){
        if(!ov.hidden){overlayHide(ov);return;}
        renderStdOverview();overlayShow(btn,ov);return;
      }
      set(pane.hidden);});
    var cl=$('#stdpane-close');
    if(cl) cl.addEventListener('click',function(){set(false);});
    var rr=$('#stdpane-rerun');
    if(rr) rr.addEventListener('click',renderStdPane);
    var oc=$('#std-ov-close');
    if(oc) oc.addEventListener('click',function(){overlayHide(ov);});
    var orr=$('#std-ov-rerun');
    if(orr) orr.addEventListener('click',renderStdOverview);
    /* a slide chip goes to the slide, so the view gets out of the way */
    if(ov) ov.addEventListener('click',function(e){
      if(e.target.closest&&e.target.closest('.std-chip'))
        setTimeout(function(){overlayHide(ov);},0);
    });
  })();
  window.SemDeckPreflight=preflight;                 /* test hook */
  window.SemDeckStandardise=standardise;             /* test hook */
  window.SemDeckGuides=function(){return guides;};   /* test hook */

  /* ---- the View group: rulers, grid, side toolbar, full-screen ---- */
  var editFull=false;      /* full screen while EDITING (not presenting) */
  /* Until you say otherwise, a PORTRAIT poster gets the side toolbar and
     everything else keeps the familiar top one: that is the shape where
     the horizontal ribbon eats the dimension the page needs most. Once
     you touch the button your choice sticks for every page. */
  function wantSide(){
    if(guides.sideSet) return !!guides.side;
    var pg=pageOf();
    return !!(pg.poster&&pg.mm[1]>pg.mm[0]);
  }
  function applySideRibbon(){
    var on=wantSide();
    /* T465: a shelf open when the ribbon turns sideways is not carried
       into the column */
    if(on&&mode==='edit'&&typeof rbnShelfDismiss==='function') rbnShelfDismiss();
    deckEl.classList.toggle('rbn-side',on&&mode==='edit');
    var b=$('#vw-side');
    if(b) b.setAttribute('aria-pressed',on?'true':'false');
    applyZoom();           /* the stage just changed width */
    /* The layout gallery measures the ribbon it deliberately leaves on
       screen. A side ribbon occupies the right edge instead of the top,
       so an open gallery has to move with it rather than keeping the old
       horizontal-ribbon bounds. */
    fitEditRibbon();
    if(typeof rbnGalleryPlace==='function') rbnGalleryPlace();
  }
  /* ---- fit the ribbon by DENSITY, never by wrapping, scrolling or
     dropping a word.
     It does NOT move the toolbar to the side on its own: that was tried
     (2026-08-07) and it both overrode a choice the user had just made
     with the Side button and left a half-built column behind. Where the
     row is genuinely fuller than the width allows, the answer is fewer
     things in it — hence the View menu — not a layout that teleports. ---- */
  var ERC=['erc1','erc2','erc3'];
  /* TWO ladders, because the ribbon has two halves with different rules.
     ERCW sizes the CONSTANT half (File, Slide, View) and is a pure
     function of the ribbon's WIDTH — never of what is in it. That is the
     whole point: the width is identical whether or not you have something
     selected, so no rung here can fire on a click. The constant half
     therefore steps only when you resize the window, which is the one
     moment a control moving is not a surprise.
     ERC below sizes the CHANGING half against the content, as before. */
  /* The thresholds are set from the WIDEST state the bar can be asked to
     hold — a text selection, which needs ~90px more than the resting row
     — not from the resting one. Sizing them to the resting row would fit
     beautifully until you clicked a text box, which is the only case that
     matters. */
  var ERCW=[['ercw1',1260],['ercw2',1170],['ercw3',1080],['ercw4',990]];
  /* ---- A RIBBON OF YOUR OWN --------------------------------------------
     Reorder and hide ribbon buttons, remembered per user (TASKS T11).
     The design note, and the three answers it had to give:

     WHAT IS CUSTOMISABLE: individual controls, within the group they
     already live in. Not whole groups, and NOT moving a control to
     another tab — a tab is a promise about where things are ("the tools
     for the thing you just clicked are in ONE named place you can go
     back to", showFmt), and letting a layout break that promise would
     make every other piece of guidance in this app wrong.

     WHERE IT IS REMEMBERED: an UNSCOPED localStorage key. Every other
     preference here is `+SCOPE` — per project, per notebook bundle — but
     a ribbon layout is a fact about the person, not about the deck, and
     it would be absurd for one deck to know where you keep Bold. That is
     the same argument matchPick makes for being session-local and
     arrangements make for being localStorage rather than deck data, so
     the departure is deliberate and consistent rather than an exception.

     HOW HIDING IS EXPRESSED: a class, never `hidden`. `hidden` is owned
     by showFmt and FMT_KINDS, which turn controls on and off by KIND —
     a customiser writing the same attribute would fight it on every
     click, and whoever wrote last would win. `.rbn-hid` is
     display:none, so the two compose: a control appears when its kind
     allows it AND you have not put it away. It also costs the fit
     ladder nothing, because display:none takes no width — hiding
     genuinely buys room rather than only looking like it.

     THE INVARIANTS HOLD BY CONSTRUCTION. Nothing here changes a label,
     so buttons stay words plus icons. Nothing here bypasses
     fitEditRibbon: the row is re-fitted after every change, so a custom
     layout compacts down the same ladder and still never wraps. */
  var RIBBON_KEY='jv-ribbon';        /* NOT +SCOPE — see above */
  function ribbonPrefs(){
    try{
      var o=JSON.parse(localStorage.getItem(RIBBON_KEY)||'{}');
      return (o&&typeof o==='object')?o:{};
    }catch(e){return {};}
  }
  function ribbonSave(o){
    try{
      if(!o||!Object.keys(o).length) localStorage.removeItem(RIBBON_KEY);
      else localStorage.setItem(RIBBON_KEY,JSON.stringify(o));
    }catch(e){}
  }
  /* a control is addressed by its id. Anything without one cannot be
     customised and is left exactly where it is — which is the right
     answer for the separators and the wrappers, and means the picker
     never offers you a row you cannot act on. */
  /* the GENERIC classes every group wears. Matching the first `rbn-*`
     token found `rbn-grp` on all of them, so every group answered to the
     same id and one group's saved order was applied to all of them
     (2026-08-25, caught by reading the stored key in a browser). The
     groups with no distinguishing class of their own fall back to their
     visible label, which is stable and unique across the row. */
  /* `rbn-lay` joins the generic list for exactly the reason the note
     above gives: it is worn by EVERY group a layout generates, so
     without it here all of them would answer to the same id and one
     group's saved order would be applied to the lot (T36's ribbon
     layouts, 2026-08-25). */
  var RBN_GENERIC={'rbn-grp':1,'rbn-fixed':1,'rbn-row':1,'rbn-lab':1,
    'rbn-lay':1};
  function ribbonGroupId(g){
    var hit='';
    String(g.className||'').split(/\s+/).forEach(function(c){
      if(!hit&&c.indexOf('rbn-')===0&&!RBN_GENERIC[c]) hit=c;});
    if(hit) return hit;
    var lab=g.querySelector('.rbn-lab');
    return 'grp-'+((((lab&&lab.textContent)||'').trim().toLowerCase()
      .replace(/[^a-z0-9]+/g,'-'))||'x');
  }
  function ribbonControls(g){
    var row=g.querySelector('.rbn-row')||g;
    return [].slice.call(row.children).filter(function(el){
      return el.id&&!el.classList.contains('rbn-lab');
    });
  }
  function ribbonGroups(){
    return $$('#edit-tools .rbn-grp').filter(function(g){
      return ribbonControls(g).length>1;});
  }
  /* the picker shows the TAB YOU ARE LOOKING AT. All tabs together
     is 87 controls in a floating menu, which is a wall rather than a
     list — and you customise a ribbon while looking at the thing you
     want moved, not by scrolling for it. applyRibbonPrefs still walks
     every group, so what you set on one tab keeps working while you are
     on another (2026-08-25, found by counting the rows in a browser). */
  function ribbonGroupsHere(){
    return ribbonGroups().filter(function(g){
      return g.offsetParent!==null;});
  }
  /* apply what is remembered: order first, then hiding. Order is written
     by re-appending, which is stable for anything the list does not
     name — a control added by a later version of the app keeps its place
     at the end rather than disappearing because an old saved list has
     never heard of it. */
  function applyRibbonPrefs(){
    var p=ribbonPrefs();
    ribbonGroups().forEach(function(g){
      var gid=ribbonGroupId(g),pref=p[gid];
      var row=g.querySelector('.rbn-row')||g;
      var ctl=ribbonControls(g);
      var byId={};ctl.forEach(function(el){byId[el.id]=el;});
      if(pref&&pref.order) pref.order.forEach(function(id){
        if(byId[id]) row.appendChild(byId[id]);});
      var hid=(pref&&pref.hide)||[];
      ctl.forEach(function(el){
        el.classList.toggle('rbn-hid',hid.indexOf(el.id)>=0);});
    });
    if(typeof fitEditRibbon==='function') fitEditRibbon();
  }
  /* the words a row goes by. A control's own label is the honest name —
     it is what you are looking for when you go hunting for it — and the
     tooltip is the fallback for the handful that are a caret or a
     glyph. */
  function ribbonCtlLabel(el){
    var t=(el.textContent||'').replace(/\s+/g,' ').trim();
    if(t&&t.length<=28) return t;
    if(t) return t.slice(0,26)+'\u2026';
    return (el.getAttribute('aria-label')||el.title||el.id)
      .split('\n')[0].slice(0,28);
  }
  function openRibbonCustomise(){
    var old=$('#rbn-cust'); if(old) old.remove();
    var m=document.createElement('div');
    m.className='sh-menu canvas-menu rbn-cust';m.id='rbn-cust';
    var head=document.createElement('div');
    head.className='hd-lab';
    head.textContent='your ribbon';
    m.appendChild(head);
    /* THE LAYOUT COMES FIRST, because it is the bigger question: this
       menu tunes an arrangement, and the gallery chooses which
       arrangement you are tuning (2026-08-25). */
    var lay=document.createElement('button');
    lay.className='dbtn vw-opt';lay.type='button';
    lay.innerHTML=bic('layouts')+' Ribbon layouts\u2026';
    lay.title='Try a different arrangement of the whole ribbon — '
      +'currently "'+((rbnLayoutById(rbnCurrentId())||{}).name||'Default')
      +'"';
    lay.addEventListener('click',function(e){
      e.stopPropagation();overlayDrop(m);openRibbonGallery();});
    m.appendChild(lay);
    var note=document.createElement('div');
    note.className='ff-none';
    note.textContent='The '+activeTab()+' tab. Untick to put a button '
      +'away; the arrows move it within its group.';
    m.appendChild(note);
    ribbonGroupsHere().forEach(function(g){
      var gid=ribbonGroupId(g);
      menuHead(m,(rbnGroupName(g)||gid).toLowerCase());
      ribbonControls(g).forEach(function(el){
        var row=document.createElement('div');
        row.className='ff-row rbn-crow';
        var l=document.createElement('label');
        l.className='find-ck';
        var b=document.createElement('input');
        b.type='checkbox';
        b.checked=!el.classList.contains('rbn-hid');
        l.appendChild(b);
        l.appendChild(document.createTextNode(' '+ribbonCtlLabel(el)));
        row.appendChild(l);
        b.addEventListener('change',function(){
          var pr=ribbonPrefs();
          pr[gid]=pr[gid]||{};
          var h=(pr[gid].hide||[]).filter(function(x){return x!==el.id;});
          if(!b.checked) h.push(el.id);
          if(h.length) pr[gid].hide=h; else delete pr[gid].hide;
          if(!pr[gid].hide&&!pr[gid].order) delete pr[gid];
          ribbonSave(pr);applyRibbonPrefs();
        });
        [['\u2191',-1],['\u2193',1]].forEach(function(dir){
          var mb=document.createElement('button');
          mb.className='dbtn rbn-move';mb.textContent=dir[0];
          mb.title=(dir[1]<0?'Move it earlier':'Move it later')
            +' in this group';
          mb.setAttribute('aria-label',
            (dir[1]<0?'Move earlier':'Move later')+': '
            +ribbonCtlLabel(el));
          mb.addEventListener('click',function(e){
            e.stopPropagation();
            var ids=ribbonControls(g).map(function(x){return x.id;});
            var at=ids.indexOf(el.id),to=at+dir[1];
            if(at<0||to<0||to>=ids.length) return;
            ids.splice(to,0,ids.splice(at,1)[0]);
            var pr=ribbonPrefs();
            pr[gid]=pr[gid]||{};pr[gid].order=ids;
            ribbonSave(pr);applyRibbonPrefs();
            openRibbonCustomise();
          });
          row.appendChild(mb);
        });
        m.appendChild(row);
      });
    });
    menuHead(m,'all of it');
    var rb=document.createElement('button');
    rb.className='dbtn vw-opt';
    rb.textContent='Put the ribbon back to normal';
    rb.addEventListener('click',function(e){
      e.stopPropagation();
      ribbonSave(null);
      $$('#edit-tools .rbn-hid').forEach(function(el){
        el.classList.remove('rbn-hid');});
      overlayDrop(m);
      /* ORDER CAN BE RESTORED NOW. This said "reload the page" under a
         comment that order 'cannot be un-appended', which was true when
         T11 shipped and stopped being true the moment the layout engine
         took a snapshot of the markup's own child order: rbnRestoreHome
         puts it back exactly, and applyRibbonLayout re-applies whichever
         arrangement is on and calls applyRibbonPrefs itself (2026-08-26
         audit, T57). */
      applyRibbonLayout(rbnCurrentId(),true);
      toast('Every button is back, in its original order.');
    });
    m.appendChild(rb);
    var bar=$('#edit-tools');
    overlayMount(bar,m);               /* on the stack (T213) */
  }
  (function(){
    var bar=$('#edit-tools');
    if(!bar) return;
    /* RIGHT-CLICK THE RIBBON. Where every other application of this
       shape puts it, and it costs the row no width at all — which
       matters more here than anywhere, the width being the thing the
       whole fit ladder exists to fight over. */
    bar.addEventListener('contextmenu',function(e){
      if(mode!=='edit') return;
      e.preventDefault();
      openRibbonCustomise();
    });
  })();
  /* ---- RIBBON TABS ----------------------------------------------------
     One ribbon stopped being able to hold the editor: every feature added
     a control, every control bought a density rung, and the row spent its
     whole life at the tight end of the ladder (2026-08-20, user: "there
     might not need to be tabs like power point and foxit pdf has ... there
     might be starting to get too many feature to have on one ribbon").
     A tab is just a filter: each .rbn-grp declares its data-tab, and
     everything not on the showing tab is taken OUT of the row with
     display:none — not visibility — so it costs nothing in the width the
     fit ladder measures. The ladder itself is unchanged, and with a third
     of the groups in the row it now almost never has to fire.
     Style and Object split everything selection-driven into how it looks
     and what it is. They are contextual, so Home keeps its page-level
     meaning instead of growing a different ribbon every time the canvas
     selection changes (2026-08-26; split 2026-09-11). */
  /* Animation is a tab of its own again (T176): a build is something
     you give a slide AFTER it is full, which is the opposite moment
     from Insert. */
  /* ...and View is one again (T200): the page-looking tools were on
     Home, and Home took the layout system. */
  /* ...and Insert is Images and Text (T220): one tab was holding
     four galleries and eleven doors. */
  var TABS=['home','images','text','design','animation','view',
    'present','style','object'];
  /* SCOPE is declared further down the file, so the remembered tab is read
     on first use rather than here — `var` hoisting would otherwise key it
     under the string "undefined" */
  var curTab=null;
  function tabKey(){return 'jv-deck-tab:'+SCOPE;}
  function activeTab(){
    if(curTab===null){
      var t=lsGet(tabKey());
      /* View was folded into Home on 2026-08-20, and the old Animate
         tab came back as Animation (T176); a browser that remembers
         either lands on its current home rather than on a tab that
         no longer exists */
      if(t==='animate') t='animation';
      /* Insert split in two (T220); a browser that remembers it
         lands on the half that kept the galleries */
      if(t==='insert') t='images';
      /* `view` is a real tab again (T200), so a browser that remembers
         it from before 2026-08-20 lands on it */
      /* TABS is the ACTIVE LAYOUT's tabs, which need not include
         `home` at all — so the fallback is "the first tab there is"
         rather than a name that may not exist (2026-08-25) */
      curTab=TABS.indexOf(t)>=0?t:TABS[0];
    }
    return curTab;
  }
  function tabHasContent(t){
    var bar=$('#edit-tools'); if(!bar) return false;
    var gs=$$('.rbn-grp[data-tab="'+t+'"]',bar);
    for(var i=0;i<gs.length;i++) if(!gs[i].hidden) return true;
    return false;
  }
  function syncTabStrip(){
    var strip=$('#rbn-tabs'); if(!strip) return;
    $$('.rbn-tab',strip).forEach(function(b){
      var on=(b.dataset.tab===activeTab());
      b.setAttribute('aria-selected',on.toString());
      /* a tab with nothing on it is taken out of the strip rather than
         left there to be clicked for no result — but never the one you
         are standing on, which would make the strip jump under the
         pointer (2026-08-25, ribbon layouts) */
      b.classList.toggle('rbn-tab-off',!on&&!tabHasContent(b.dataset.tab));
    });
  }
  /* the data-off half of applyTab and NOTHING else: which tab's groups
     are in the row, without dispatching sem:ribbon-tab or repainting
     the tab strip (it was split out for the strip's eight-tab floor
     walk, which T582 retired) */
  function tabGroupsOn(t){
    var bar=$('#edit-tools'); if(!bar) return;
    $$('.rbn-grp[data-tab]',bar).forEach(function(g){
      if(g.dataset.tab===t) g.removeAttribute('data-off');
      else if(g.getAttribute('data-off')!=='1') g.setAttribute('data-off','1');
    });
  }
  function applyTab(){
    var bar=$('#edit-tools'); if(!bar) return;
    var t=activeTab();
    /* the build numbers show whenever the Animation tab is up (T186):
       the tab is about them, so they should not wait for the order
       pane or Quick animate */
    deckEl.classList.toggle('tab-animation',t==='animation');
    tabGroupsOn(t);
    syncTabStrip();
    document.dispatchEvent(new CustomEvent('sem:ribbon-tab',
      {detail:{tab:t}}));
  }
  function setTab(t,transient){
    if(TABS.indexOf(t)<0||t===activeTab()) return;
    curTab=t;
    /* A TAB THE SELECTION CARRIED YOU TO IS NOT A TAB YOU CHOSE. Writing
       the contextual tab into the preference meant a reload landed you
       on Object with nothing selected -- an empty row, and then the
       empty-tab fall-back dropped you somewhere you had never asked to
       be, rather than back where you were working (2026-09-05, with the
       #fmt-hist fix that made the fall-back reachable at all). The
       deliberate setTab('animation') in 48-animation.js IS a choice and
       still persists. */
    if(!transient) lsSet(tabKey(),t);
    var hadShelf=!!rbnShelfFor;
    applyTab();
    /* T453: the shelf belongs to a group on the tab you just left */
    rbnShelfSync();
    /* the row's content just changed wholesale, so its column counts and
       its density both have to be judged again */
    syncRibbonGroups();
    /* T498: the shelf closes with the tab it belongs to and comes back
       with it (rbnShelfRestore, from the refit above), and either way
       the bar is a different height -- the same courtesy its clicks
       pay, or the slide sits under a bar that grew 65px */
    if(hadShelf!==!!rbnShelfFor) rbnShelfRefit();
  }
  /* ---- FOLDING THE TOOLS AWAY ------------------------------------------
     The ribbon is about 100px of a 700px laptop window, and there are long
     stretches - reading it back, rehearsing, nudging one thing into place
     - where the page matters and the tools do not (2026-08-20, user:
     "would be good if the editing tools can be made to pop up and down").
     The TAB STRIP always stays: it is one button high, it is how you get
     the tools back, and a bar that vanishes completely leaves you with no
     way to say "I want them again". */
  var FOLDKEY2='jv-deck-fold:';
  /* ---- ...and the two AUTO-hides -----------------------------------
     The document view's presentations panel has had one since 2026-08-04
     (#pr-auto / initRailAuto, app.js): opt-in, remembered, the surface
     slides away and comes back when the pointer reaches its edge, and
     `aria-pressed` means auto-hide is ON. The editor's two surfaces --
     the slide column and the ribbon -- had only manual hides (Slides,
     and the fold above). Same behaviour, same words, same aria; the KEYS
     follow this file's convention rather than app.js's, because every
     other editor preference here is SCOPE-keyed through lsGet/lsSet.
     DECLARATIONS ONLY. initFilmAuto/initRibbonAuto are called from THE
     BOOT SEQUENCE in 99-boot.js, never from here. */
  var FILMAUTOKEY='jv-deck-filmauto:',RBNAUTOKEY='jv-deck-rbnauto:';
  var filmAuto=false,rbnAuto=false;
  function filmAutoOn(){return filmAuto;}
  function setFilmAuto(on){
    filmAuto=!!on;
    deckEl.classList.toggle('film-auto',filmAuto);
    if(!filmAuto) deckEl.classList.remove('film-peek');
    lsSet(FILMAUTOKEY+SCOPE,filmAuto?'1':'0');
    /* the stage just changed width, and the ribbon just stopped (or
       started) sharing the row with a column */
    applyZoom();
    fitEditRibbon();
  }
  function initFilmAuto(){
    document.addEventListener('mousemove',function(e){
      if(!filmAuto||mode!=='edit'||deckEl.hidden) return;
      /* a poster has no column strip at all (.deck.poster-page .dc-film) */
      if(pageOf().poster) return;
      var col=$('#deck-create');
      var peek=deckEl.classList.contains('film-peek');
      if(!peek){
        if(e.clientX<=4) deckEl.classList.add('film-peek');
        return;
      }
      if(!col) return;
      /* the same 40px margin the present bar leaves, so the column does
         not vanish the instant you aim at a control near its edge */
      if(e.clientX>col.getBoundingClientRect().right+40)
        deckEl.classList.remove('film-peek');
    });
  }
  function setRibbonAuto(on){
    rbnAuto=!!on;
    /* one bar, one state: an explicit fold and an auto-hide both claim to
       hide it, so turning auto on clears the fold rather than stacking
       two hidden states the user has to undo twice */
    if(rbnAuto&&ribbonFolded()) setRibbonFold(false);
    deckEl.classList.toggle('rbn-auto',rbnAuto);
    if(!rbnAuto) deckEl.classList.remove('rbn-peek');
    var b=$('#rbn-auto');
    if(b){
      b.setAttribute('aria-pressed',rbnAuto?'true':'false');
      /* the title says what CLICKING will do, the way #pb-auto's does */
      b.title=rbnAuto
        ?'Auto-hide is on: the tools roll up and come back when you reach '
          +'the tab strip. Click to keep them in place.'
        :'Auto-hide: the tools roll up and come back when you reach the '
          +'tab strip. Off by default.';
    }
    lsSet(RBNAUTOKEY+SCOPE,rbnAuto?'1':'0');
    applyZoom();            /* the stage just changed height */
  }
  function initRibbonAuto(){
    var b=$('#rbn-auto');
    if(b) b.addEventListener('click',function(){setRibbonAuto(!rbnAuto);});
    document.addEventListener('mousemove',function(e){
      if(!rbnAuto||mode!=='edit'||deckEl.hidden) return;
      /* an explicit fold beats a peek -- the same precedence the CSS
         states with :not(.rbn-fold) */
      if(ribbonFolded()) return;
      var strip=$('#rbn-tabs'),bar=$('#edit-tools');
      if(!strip) return;
      var peek=deckEl.classList.contains('rbn-peek');
      var s=strip.getBoundingClientRect();
      if(e.clientY>=s.top-4&&e.clientY<=s.bottom+4
         &&e.clientX>=s.left&&e.clientX<=s.right){
        if(!peek) deckEl.classList.add('rbn-peek');
        return;
      }
      if(!peek||!bar) return;
      var r=bar.getBoundingClientRect();
      if(e.clientY<s.top-40||e.clientY>r.bottom+40
         ||e.clientX<r.left-40||e.clientX>r.right+40)
        deckEl.classList.remove('rbn-peek');
    });
  }
  /* how the slide column lists its slides, and how wide it is. Both are
     preferences about the TOOL, not properties of the deck — sending
     someone a presentation must not send them your column width — so
     they live in localStorage beside the ribbon fold rather than on
     `pres` (2026-08-22). Keyed on SCOPE, which is declared further down
     this file: read it at var-declaration time and every preference in
     the app files itself under the literal string "undefined". */
  var FILMKEY='jv-deck-film:',FILMWKEY='jv-deck-filmw:';
  var FILM_VIEWS=[['thumb','Thumbnails','Pictures'],
    ['head','Headings','Names'],
    ['both','Thumbnails and headings','Both'],
    /* not a strip mode at all, but the same question — how do I want to
       look at this deck — so it is the same menu (T26) */
    ['overview','Overview map…','Overview map…'],
    /* T601: the talk as its parts -- the other presentations it shows */
    ['parts','Parts of this talk…','Parts…']];
  var filmView=null;
  function filmMode(){
    if(filmView===null){
      var v=lsGet(FILMKEY+SCOPE);
      filmView=(v==='head'||v==='both')?v:'thumb';
    }
    return filmView;
  }
  function ribbonFolded(){
    return deckEl.classList.contains('rbn-fold');
  }
  function setRibbonFold(on){
    /* A chooser that previews a hidden ribbon has lost the thing it is
       choosing; it would also measure the folded bar at zero on resize. */
    if(on&&typeof rbnGalleryClose==='function') rbnGalleryClose();
    deckEl.classList.toggle('rbn-fold',!!on);
    var b=$('#rbn-fold');
    if(b){
      b.setAttribute('aria-pressed',on?'true':'false');
      b.innerHTML=on?'&#9662;':'&#9652;';
      b.title=on
        ?'Show the tools again (Ctrl+F1)'
        :'Hide the tools and give the page the room (Ctrl+F1). Click a '
          +'tab, or this, to bring them back';
    }
    lsSet(FOLDKEY2+SCOPE,on?'1':'0');
    /* the stage just changed height, so the page has to be re-fitted */
    applyZoom();
    if(!on) fitEditRibbon();
  }
  /* DELEGATED, not wired per button. A ribbon layout rebuilds this
     strip — a one-tab layout has one button, a four-tab layout has four
     — and per-button listeners would work only on the buttons that
     happened to be in the markup at boot (2026-08-25). */
  (function(){
    var strip=$('#rbn-tabs'); if(!strip) return;
    function tabOf(e){
      var t=e.target;
      return (t&&t.closest)?t.closest('.rbn-tab'):null;
    }
    strip.addEventListener('click',function(e){
      var b=tabOf(e); if(!b||!strip.contains(b)) return;
      /* a click on the tab you are already on, while folded, is a request
         for the tools back - not a no-op */
      if(ribbonFolded()){setRibbonFold(false);setTab(b.dataset.tab);return;}
      setTab(b.dataset.tab);
    });
    /* double-click toggles, the way PowerPoint has trained everyone */
    strip.addEventListener('dblclick',function(e){
      var b=tabOf(e); if(!b||!strip.contains(b)) return;
      e.preventDefault();setRibbonFold(!ribbonFolded());
    });
  })();
  (function(){
    var f=$('#rbn-fold');
    if(f) f.addEventListener('click',function(){
      setRibbonFold(!ribbonFolded());});
  })();
  /* ---- FITTING THE ROW: WHAT GOES IN, WHAT EACH STATE NEEDS -----------
     (2026-10-09, speed. The owner: "if this is not able to load quick,
     and not be laggy, then no matter how good the features are no one
     will ever use this".) A tab click, a selection and every step of a
     window drag re-fitted the row, and each fit climbed the ladder below
     from the bottom with a forced style-and-layout pass of the whole
     ribbon after every rung and every fold: 7.2 s of a 22-step window
     drag at 4x, 0.2-0.4 s for the Design tab or a figure selected.
     T539's memo was meant to stop that and almost never hit, because its
     key was the bar as the last fit LEFT it -- the doors it built and the
     words on them -- and a key was good for one exact width.
     Three parts now, and only the last one ever measures:
     - WHAT GOES IN (ribbonFitInput): what the fit is given, never what it
       did. Each group's controls, words and visibility -- its fold door
       left out, the door being the fit's -- kept on the group until a
       MutationObserver says that group changed; which groups are on the
       row; the page's classes less the rungs; the width's BRACKET (the
       ERCW rungs and the 1600px type step are functions of the width).
       Not the width itself.
     - WHAT EACH STATE NEEDS: a set of rungs and folded groups is a STATE,
       and the length of the row a state makes is a fact about the
       content, not the window -- every group is flex:none, so the row is
       as long at 1000px as at 1900px (measured: Home at rest scrolls to
       1339px at every width from 800 to 1300). A state is measured once
       per input, as how far its last group reaches, and that answers
       "does it fit?" at ANY width in the bracket: arithmetic for a tab
       seen before, a selection seen before and every width a window drag
       passes through again. A width within two pixels of the answer is
       measured rather than guessed.
     - THE CLIMB (ribbonFitClimb): the ladder exactly as it was -- the
       spacing rungs, the View fold, folding from the right, the never-
       fold groups last, the give-back -- asked of states instead of the
       screen. The row is changed to a state only to measure it, and once
       at the end for the answer; a fit that ends where the row already
       is writes nothing at all.
     What was decided without measuring is checked after the frame has
     painted (ribbonFitVerify), when reading the layout costs nothing: a
     row that did not come out as predicted is forgotten and fitted again
     by measuring, so a wrong memory costs a frame, never a clipped row.
     T539's "a state seen before is replayed, not re-measured" is this
     memory, with a key that can come round again. */
  var ribbonW=null;
  /* what the fit itself writes on a group, a door or the bar -- never a
     reason to fit again, and never part of what goes in */
  var RBN_FIT_OUT={'rbn-folded':1,'rbn-shelved':1,'rbn-fit':1,'rbn-odd':1,
    'has-val':1,'shelf-open':1,'fmt-open':1};
  function ribbonOutCls(c){return RBN_FIT_OUT[c]===1;}
  function ribbonRungCls(c){return c.indexOf('erc')===0;}
  /* the auto-hides' peeks follow the pointer and move nothing in the bar;
     tab-animation shows the slide's build numbers (its one rule) and comes
     and goes with the Animation tab, which the groups on the row say */
  function ribbonDeckVolatile(c){
    return ribbonRungCls(c)||c==='film-peek'||c==='rbn-peek'
      ||c==='tab-animation';
  }
  function ribbonClsLess(v,drop){
    var t=String(v||'').split(/\s+/),o=[];
    for(var i=0;i<t.length;i++) if(t[i]&&!drop(t[i])) o.push(t[i]);
    return o.join(' ');
  }
  /* WHOSE CHANGE IS IT: the group a node sits in, or the group whose row
     is on the shelf (T453). null: the bar's own holders, whose `hidden`
     is read live at every fit. */
  function ribbonSigOwner(el){
    if(!el||!el.closest) return null;
    var g=el.closest('.rbn-grp');
    if(g) return g;
    if(rbnShelfFor&&el.closest('#rbn-shelf-body')) return rbnShelfFor;
    return null;
  }
  var ribbonSigObs=null,ribbonSigBar=null,ribbonSigAll=true;
  /* SOMETHING ON THE BAR MOVED since the last fit -- a click in a door's
     pop-up, a door's words read again -- whether or not it is what goes
     in. Every fit used to rebuild the doors when anything on the bar had
     changed, which shut their pop-ups and the View menu; a fit that finds
     the row already right still does that much (ribbonFitClosePops). */
  var ribbonBarStir=false;
  /* the class changes T539's key saw: a control becoming or ceasing to be
     a group, a cell, a strip or put away */
  var RBN_STIR_CLS=['rbn-grp','rbn-cell','strip-frame','rbn-hid'];
  function ribbonClsStir(a,b){
    var x=' '+String(a||'')+' ',y=' '+String(b||'')+' ';
    for(var i=0;i<RBN_STIR_CLS.length;i++){
      var c=' '+RBN_STIR_CLS[i]+' ';
      if((x.indexOf(c)>=0)!==(y.indexOf(c)>=0)) return true;
    }
    return false;
  }
  function ribbonSigSeen(recs){
    for(var i=0;i<recs.length;i++){
      var r=recs[i],t=r.target;
      var el=(t&&t.nodeType===1)?t:(t&&t.parentNode);
      if(r.type!=='attributes') ribbonBarStir=true;
      else {
        var k=r.attributeName,now=t.getAttribute(k);
        if(now===r.oldValue) continue;
        if(k!=='class'||ribbonClsStir(now,r.oldValue)) ribbonBarStir=true;
        if(k==='class'&&ribbonClsLess(now,ribbonOutCls)
           ===ribbonClsLess(r.oldValue,ribbonOutCls)) continue;
      }
      /* the door and the words on it are the fit's own */
      if(el&&el.closest&&el.closest('.rbn-foldbtn')) continue;
      var g=ribbonSigOwner(el);
      if(g){
        /* whether a group is on the row at all is read live, every fit */
        if(!(r.type==='attributes'&&t===g
             &&(r.attributeName==='hidden'||r.attributeName==='data-off')))
          g._rbnSig=null;
        continue;
      }
      if(r.type==='attributes') continue;
      if(el&&el.closest&&el.closest('#rbn-shelf')) continue;
      /* something outside every group: read them all again */
      ribbonSigAll=true;
    }
  }
  function ribbonSigWatch(bar){
    if(ribbonSigBar===bar) return;
    if(ribbonSigObs) ribbonSigObs.disconnect();
    ribbonSigObs=null;ribbonSigBar=bar;ribbonSigAll=true;
    if(window.MutationObserver){
      ribbonSigObs=new MutationObserver(ribbonSigSeen);
      ribbonSigObs.observe(bar,{subtree:true,childList:true,
        characterData:true,characterDataOldValue:true,
        attributes:true,attributeOldValue:true,
        attributeFilter:['id','hidden','data-off','class','data-say']});
    }
  }
  /* a group's row, wherever it is: in place, in its door, or on the shelf */
  function ribbonGroupRow(g){
    for(var c=g.firstElementChild;c;c=c.nextElementSibling)
      if(c.classList.contains('rbn-row')) return c;
    return rbnFoldRow(g);
  }
  /* ONE GROUP'S SHARE OF WHAT GOES IN, kept on the group until the
     observer says it changed: its row and label -- what T539's key read
     of it -- never its fold door. The View fold is the fit's too: while
     it is down, the controls it hid are read as they were before it
     (viewWasHidden), which is how it gives them back. Interned, so a
     key holds a number per group rather than its words. */
  var RBN_SIG_SEL='.rbn-cell,.strip-frame,[hidden],[data-off],.rbn-hid,[data-say]';
  var RBN_VIEW_SEL=null,ribbonSigIds=new Map(),ribbonSigNext=0;
  /* the controls the View fold hides, and its door */
  function ribbonViewSel(){
    if(RBN_VIEW_SEL===null) RBN_VIEW_SEL=VIEW_FOLD.map(function(p){
      return '#'+p[0];}).join(',')+',#vw-morewrap';
    return RBN_VIEW_SEL;
  }
  function ribbonGroupSig(g){
    if(g._rbnSig!=null) return g._rbnSigId;
    var row=ribbonGroupRow(g),nodes=row?[row]:[];
    for(var c=g.firstElementChild;c;c=c.nextElementSibling)
      if(c!==row&&!c.classList.contains('rbn-foldwrap')) nodes.push(c);
    var sel=viewFolded?RBN_SIG_SEL+','+ribbonViewSel():RBN_SIG_SEL;
    var parts=[ribbonClsLess(g.className,ribbonOutCls),
      g.getAttribute('data-tab'),g.getAttribute('data-say'),
      g.getAttribute('data-fold-ic'),g.nextElementSibling?'':'last'];
    for(var i=0;i<nodes.length;i++){
      var n=nodes[i];
      parts.push(n.textContent);
      var els=[].slice.call(n.querySelectorAll(sel));
      if(n.matches(sel)) els.unshift(n);
      for(var j=0;j<els.length;j++){
        var el=els[j],cl=el.classList,hid=el.hidden;
        if(viewFolded&&el.id){
          if(el.id==='vw-morewrap') hid=true;
          else if(viewWasHidden&&Object.prototype.hasOwnProperty.call(
            viewWasHidden,el.id)) hid=!!viewWasHidden[el.id];
        }
        var off=el.getAttribute('data-off'),say=el.getAttribute('data-say');
        var hc=cl.contains('rbn-hid');
        if(!hid&&off===null&&say===null&&!hc&&!cl.contains('rbn-cell')
           &&!cl.contains('strip-frame')) continue;
        parts.push(el.id+'|'+hid+'|'+off+'|'+hc+'|'+say);
      }
    }
    var s=parts.join('\u0001'),id=ribbonSigIds.get(s);
    if(id===undefined){
      /* a long session's worth of distinct groups: start the table over,
         and the memory keyed by it. A number is never given out twice,
         so a group still holding an old one can never be taken for
         another. */
      if(ribbonSigIds.size>=1500){ribbonSigIds.clear();ribbonFitMemo.clear();}
      id=++ribbonSigNext;ribbonSigIds.set(s,id);
    }
    g._rbnSig=s;g._rbnSigId=id;
    return id;
  }
  /* on the row: neither the group nor anything holding it is hidden or
     off its tab (the selection's groups sit in .et-fmt, hidden whole) */
  function ribbonGrpShown(g,bar){
    for(var n=g;n&&n!==bar;n=n.parentNode)
      if(n.hidden||(n.nodeType===1&&n.hasAttribute('data-off'))) return false;
    return true;
  }
  /* WHAT GOES IN, as a key, with the groups it read. The key stops short
     of the width, which ribbonFitRun puts in front of it. */
  function ribbonFitInput(bar,head){
    ribbonSigWatch(bar);
    /* THE VIEW FOLD STAYS DOWN. A control it hid that something showed
       again meanwhile (applyPage un-hides Slides/Versions on every slide
       it draws) went back behind the fold on the next fit, which opened
       and refolded View every time; a fit that keeps the fold where it is
       has to put it back itself, or the control sits in the folded row
       and syncRibbonGroups judges its group by it (an empty Panes group
       on the Familiar layout's Design tab). */
    if(viewFolded){
      var vfix=[];
      VIEW_FOLD.forEach(function(p){
        var b=document.getElementById(p[0]);
        if(!b||b.hidden) return;
        b.hidden=true;
        var g=b.closest('.rbn-grp');
        if(g&&vfix.indexOf(g)<0) vfix.push(g);
      });
      if(vfix.length) sizeRibbonGroups(vfix);
    }
    if(ribbonSigObs) ribbonSigSeen(ribbonSigObs.takeRecords());
    else ribbonSigAll=true;
    var gs=$$('.rbn-grp',bar);
    if(ribbonSigAll){
      gs.forEach(function(g){g._rbnSig=null;});
      ribbonSigAll=!ribbonSigObs;
    }
    var W=head.w;
    var parts=[document.documentElement.className,document.body.className,
      ribbonClsLess(deckEl.className,ribbonDeckVolatile),head.font,head.big,
      window.devicePixelRatio||1,
      ERCW.map(function(r){return W<r[1]?1:0;}).join('')];
    var shown=[],idx=new Map(),calc=new Map();
    gs.forEach(function(g,i){
      idx.set(g,i);
      if(!ribbonGrpShown(g,bar)) return;
      shown.push(g);
      var p=i+':'+ribbonGroupSig(g);
      /* a chooser is a door at every width (T441), and a door is as wide
         as the choice it wears */
      if(g.classList.contains('rbn-compact')){
        var c=rbnReadoutCalc(g);calc.set(g,c);p+=':'+c.fin;
      }
      parts.push(p);
    });
    return {key:parts.join('\n'),gs:gs,shown:shown,idx:idx,calc:calc};
  }
  /* WHAT CAN MOVE THE BAR'S WIDTH: the classes and inline styles of the
     page, the deck and the bar -- less what only rearranges what is
     INSIDE the bar (the rungs, the shelf, the selection's styling hook:
     clientWidth reads 1351 under every rung at 1366px) */
  function ribbonHeadSig(bar){
    var de=document.documentElement,b=document.body;
    return [de.className,de.getAttribute('style'),b.getAttribute('style'),
      ribbonClsLess(deckEl.className,ribbonDeckVolatile),
      deckEl.getAttribute('style'),deckEl.hidden,
      ribbonClsLess(bar.className,ribbonOutCls),bar.getAttribute('style'),
      bar.hidden].join('|');
  }
  /* the width and the type, read for real only when something that could
     move them has happened: the bar's ResizeObserver and the window's
     resize clear it, and the signature above is checked every time */
  function ribbonFitHead(bar,fresh){
    var sig=ribbonHeadSig(bar);
    if(!fresh&&ribbonW&&ribbonW.bar===bar&&ribbonW.sig===sig) return ribbonW;
    var w=bar.clientWidth;
    var h={bar:bar,sig:sig,w:w,font:window.getComputedStyle(bar).font,
      big:!!(window.matchMedia&&window.matchMedia('(min-width:1600px)').matches)};
    /* a bar with no width (a hidden deck) is never the one trusted */
    ribbonW=(window.ResizeObserver&&w)?h:null;
    return h;
  }
  var ribbonFitFrame=null,qatFitFrame=null,guidesFitFrame=null;
  function scheduleRibbonFit(){
    if(ribbonFitFrame!=null) return;
    ribbonFitFrame=requestAnimationFrame(function(){ribbonFitFrame=null;
      if(!deckEl.hidden){fitEditRibbon();applyZoom();}
    });
  }
  function scheduleQatFit(){
    if(qatFitFrame!=null) return;
    qatFitFrame=requestAnimationFrame(function(){qatFitFrame=null;
      if(!deckEl.hidden) fitQat();
    });
  }
  function scheduleGuidesFit(){
    if(guidesFitFrame!=null) return;
    guidesFitFrame=requestAnimationFrame(function(){guidesFitFrame=null;
      if(!deckEl.hidden) syncGuides();
    });
  }
  /* ONE FIT PER MODE SWITCH (2026-10-09, speed). Opening the editor fitted
     the ribbon six times -- the fold restore, showFmt, setTool, the group
     pass, the side layout -- each against a bar the next step was about
     to change, and the first of them forced a style pass of the whole
     page: 400 ms of the first deck opened in a session at 4x. While
     setUIMode holds the fit it is only noted, and the switch fits once,
     when every control it shows or hides is in place (ribbonFitRelease),
     before the slide is fitted under the bar. */
  var ribbonFitHold=false,ribbonFitOwed=false;
  function ribbonFitRelease(){
    ribbonFitHold=false;
    if(!ribbonFitOwed) return;
    ribbonFitOwed=false;
    fitEditRibbon();
  }
  function fitEditRibbon(){
    if(ribbonFitHold){ribbonFitOwed=true;return;}
    var bar=$('#edit-tools');
    if(!bar||bar.hidden||mode!=='edit') return;
    /* a folded bar has no width to measure: scrollWidth would read 0 and
       the ladder would climb every rung for nothing */
    if(deckEl.classList.contains('rbn-fold')) return;
    /* a width taken on trust that the row turns out not to have (the bar
       moved before its ResizeObserver said so) is read again, once */
    if(!ribbonFitRun(bar,false)) ribbonFitRun(bar,true);
  }
  var ribbonFitLast=null;
  var ribbonFitStats={fits:0,measured:0,guessed:0,verified:0,refit:0,late:0};
  function ribbonFitRun(bar,fresh){
    var head=ribbonFitHead(bar,fresh),W=head.w;
    if(!W) return true;
    var inp=ribbonFitInput(bar,head);
    var side=deckEl.classList.contains('rbn-side');
    var key=W+'\n'+(side?'side':'row')+'\n'+inp.key;
    /* nothing that goes into the fit has changed, and the row is still
       as the last fit left it */
    if(bar._fitKey===key&&ribbonFitIntact(bar,inp)){
      if(ribbonBarStir){ribbonBarStir=false;ribbonFitClosePops(bar);}
      return true;
    }
    ribbonFitStats.fits++;
    var ctx={bar:bar,W:W,gs:inp.gs,shown:inp.shown,idx:inp.idx,
      calc:inp.calc,fam:null,measured:0,guessed:0,stale:false};
    ctx.calcOf=function(g){
      var c=ctx.calc.get(g);
      if(!c){c=rbnReadoutCalc(g);ctx.calc.set(g,c);}
      return c;
    };
    ctx.readout=function(g){return ctx.calcOf(g).fin;};
    ribbonFitPrepare(ctx);
    var cl=deckEl.classList,fin,finOver=false;
    if(side){
      /* a column is not short of width and has no rungs at all -- leaving
         one stamped on would shrink the rail's type for no reason */
      fin=ribbonFitBase();
      ERCW.forEach(function(r){if(cl.contains(r[0])) cl.remove(r[0]);});
      ribbonFitApply(fin,ctx,true);
    } else {
      /* the constant half's rungs are a pure function of the width */
      ERCW.forEach(function(r){
        var on=W<r[1]; if(cl.contains(r[0])!==on) cl.toggle(r[0],on);});
      ctx.fam=ribbonFitFamily(inp.key);
      ctx.r={};
      /* what is already known about a state, without measuring it */
      ctx.peek=function(st){
        var m=ctx.fam.m.get(ribbonStateSig(st,ctx));
        var d=m?ribbonFitDecide(m,W,ctx.fam):null;
        if(d!==null){ctx.guessed++;ribbonFitStats.guessed++;}
        return d;
      };
      ctx.over=function(st,quiet){
        if(ctx.stale) return false;
        var sig=ribbonStateSig(st,ctx),m=ctx.fam.m.get(sig),r=null;
        var d=m?ribbonFitDecide(m,W,ctx.fam):null;
        if(m) r=m.r;
        /* a fold state never measured: the row it makes is the row of one
           that was, less each newly folded group's width and plus its
           door's (ribbonFitPredict) */
        if(d===null&&st.F.length&&!ctx.fam.exact){
          r=ribbonFitPredict(st,ctx);
          if(r===null&&ribbonFitDoors(st,ctx)) r=ribbonFitPredict(st,ctx);
          if(ctx.stale) return false;
          d=(r===null)?null:ribbonFitDecideR(r,W);
        }
        if(d===null){
          ribbonFitApply(st,ctx,false);
          m=ribbonFitMeasure(ctx,st);
          if(m.cw!==W){ctx.stale=true;return false;}
          ctx.fam.m.set(sig,m);
          d=ribbonFitDecide(m,W,ctx.fam);r=m.r;
        } else if(!quiet){ctx.guessed++;ribbonFitStats.guessed++;}
        ctx.r[sig]=r;
        return d;
      };
      fin=ribbonFitClimb(ctx);
      /* the answer was asked about on the way up: this is a look-up */
      finOver=ctx.over(fin,true);
      if(ctx.stale){ribbonW=null;bar._fitKey=null;ribbonFitLast=null;return false;}
      ribbonFitApply(fin,ctx,false);
    }
    ribbonFitFinish(fin,ctx);
    bar._fitKey=key;
    ribbonFitLast={bar:bar,rungs:ribbonFitRungsOn(),view:viewFolded,
      F:fin.F.slice(),over:finOver};
    /* the fit's own changes -- doors built, rows moved, View folded -- are
       what it DID, and never a reason to read what goes in again */
    if(ribbonSigObs) ribbonSigObs.takeRecords();
    ribbonBarStir=false;
    var fsig=side?'':ribbonStateSig(fin,ctx);
    ribbonFitVerifyLater(side?null:{key:key,input:inp.key,W:W,
      fam:ctx.fam,fin:fin,idx:ctx.idx,sig:fsig,r:ctx.r[fsig],
      over:finOver,check:ctx.guessed>0});
    return true;
  }
  function ribbonFitDecideR(r,W){
    if(r>=W+2.5) return true;
    if(r<=W+0.5) return false;
    return null;
  }
  function ribbonRungKey(st){
    return ''+st.nohint+st.erc+st.nostatus+st.tight;
  }
  /* THE FOLDS ARE ARITHMETIC. Every group is its own flex:none item in one
     row, so folding one changes the row by exactly what the group gives up
     for its door: a state measured at the same rungs, less the width of
     each group it folds and plus that group's door, is the state's own
     length -- to the 1/64px the browser lays groups out in. The widths are
     kept per rung (an unfolded group's, and a door's for the choice it
     wears) from every measurement. null when one is not known. */
  function ribbonFitPredict(st,ctx){
    var fam=ctx.fam,rk=ribbonRungKey(st),list=fam.byRung.get(rk);
    if(!list) return null;
    var want=new Map();
    st.F.forEach(function(g){want.set(ctx.idx.get(g),g);});
    function door(i,g){return fam.d.get(rk+'|'+i+':'+ctx.readout(g));}
    for(var b=0;b<list.length;b++){
      var base=list[b],r=base.r,ok=!base.wrapped;
      want.forEach(function(g,i){
        if(!ok) return;
        var d=door(i,g);
        if(base.F.has(i)){
          /* folded in both: the door may be wearing another choice now */
          var was=fam.d.get(rk+'|'+i+':'+base.F.get(i));
          if(d===undefined||was===undefined) ok=false; else r+=d-was;
          return;
        }
        var u=fam.u.get(rk+'|'+i);
        if(u===undefined||d===undefined) ok=false; else r+=d-u;
      });
      base.F.forEach(function(said,i){
        if(!ok||want.has(i)) return;
        var u=fam.u.get(rk+'|'+i),was=fam.d.get(rk+'|'+i+':'+said);
        if(u===undefined||was===undefined) ok=false; else r+=u-was;
      });
      if(ok) return r;
    }
    return null;
  }
  /* EVERY DOOR AT ONCE: the first fold the climb asks about at a set of
     rungs folds every group that could ever fold and measures them all in
     one layout, so the folds and the give-back after it are arithmetic
     rather than a layout each (T187, T589, T464). Once per rung set. */
  function ribbonFitDoors(st,ctx){
    var fam=ctx.fam,rk=ribbonRungKey(st);
    if(fam.doors.has(rk)) return false;
    fam.doors.add(rk);
    /* never the group you are in: folding it moves its row into a menu
       and back, which drops the focus and ends a drag (the Opacity
       slider stopped after one step, and the arrow keys went on to nudge
       the selection) -- its door is measured if the climb ever asks */
    var act=document.activeElement;
    var all=ctx.shown.filter(function(g){
      if(g.classList.contains('rbn-compact')||!ribbonGroupRow(g)) return false;
      if(act&&act!==document.body&&g.contains(act)) return false;
      for(var k=0;k<RBN_NEVER_FOLD.length;k++)
        if(RBN_NEVER_FOLD[k]!=='rbn-nofold'&&g.classList.contains(RBN_NEVER_FOLD[k]))
          return false;
      return true;});
    if(!all.length) return false;
    var t={nohint:st.nohint,erc:st.erc,nostatus:st.nostatus,tight:st.tight,F:all};
    var sig=ribbonStateSig(t,ctx);
    if(fam.m.has(sig)) return false;
    ribbonFitApply(t,ctx,false);
    var m=ribbonFitMeasure(ctx,t);
    if(m.cw!==ctx.W){ctx.stale=true;return false;}
    fam.m.set(sig,m);
    return true;
  }
  function ribbonFitBase(){
    return {nohint:0,erc:0,nostatus:0,tight:0,F:[]};
  }
  function ribbonFitCopy(s){
    return {nohint:s.nohint,erc:s.erc,nostatus:s.nostatus,tight:s.tight,
      F:s.F.slice()};
  }
  function ribbonFitRungsOn(){
    var cl=deckEl.classList,s='';
    ['erc-nohint','erc1','erc2','erc3','erc-nostatus','erc-tight']
      .forEach(function(c){s+=cl.contains(c)?'1':'0';});
    return s;
  }
  /* the row is as the last fit left it: someone else (a layout, the
     shelf's own clicks) may have unfolded or folded a group since */
  function ribbonFitIntact(bar,inp){
    var L=ribbonFitLast;
    if(!L||L.bar!==bar||L.view!==viewFolded||L.rungs!==ribbonFitRungsOn())
      return false;
    for(var i=0;i<inp.shown.length;i++){
      var g=inp.shown[i];
      if(g.classList.contains('rbn-folded')
         !==(g.classList.contains('rbn-compact')||L.F.indexOf(g)>=0))
        return false;
    }
    return true;
  }
  /* THE ROW AS EVERY FIT STARTS IT: the choosers folded and wearing their
     choice (T441), a chooser that went away given its row back, the
     shelf's row back on the shelf (T453), and every group whose controls
     changed counted again (sizeRibbonGroups). The width folds stay where
     they are: the answer moves only what differs from it. */
  function ribbonFitPrepare(ctx){
    if(rbnShelfFor) rbnShelfWant=rbnShelfFor;
    ctx.gs.forEach(function(g){
      if(!g.classList.contains('rbn-compact')) return;
      var f=g.classList.contains('rbn-folded');
      if(g.hidden){if(f) rbnUnfoldGroup(g);}
      else if(!f) rbnFoldGroup(g);
      /* the door wears the choice the key was made with (a pressed change
         is read onto it a frame later otherwise, rbnReadoutBoot) */
      else if(ctx.calc.has(g)) rbnFoldReadoutWrite(g,ctx.calc.get(g));
    });
    rbnShelfRestore();
    var size=[];
    ctx.gs.forEach(function(g){
      /* the View fold changes the count only of the groups it hides in */
      var want=(g._rbnSigId||0)
        +(viewFolded&&g.querySelector(ribbonViewSel())?'v':'');
      if(g._rbnSized!==want){size.push(g);g._rbnSized=want;}
    });
    if(size.length) sizeRibbonGroups(size);
  }
  /* BRING THE ROW TO A STATE, touching only what differs from it. `all`
     unfolds every width fold, on the row or not (the side rail has none) */
  function ribbonFitApply(st,ctx,all){
    var cl=deckEl.classList;
    function rung(c,on){if(cl.contains(c)!==!!on) cl.toggle(c,!!on);}
    rung('erc-nohint',st.nohint);
    for(var i=0;i<ERC.length;i++) rung(ERC[i],i<st.erc);
    rung('erc-nostatus',st.nostatus);
    rung('erc-tight',st.tight);
    if(viewFolded!==!!st.tight){
      foldViewGroup(!!st.tight);
      /* sizeRibbonGroups counts the controls that are showing, and seven
         of them just stopped (or started) */
      var vg=[];
      ribbonViewSel().split(',').forEach(function(s){
        var el=document.querySelector(s),g=el&&el.closest('.rbn-grp');
        if(g&&vg.indexOf(g)<0) vg.push(g);
      });
      vg.forEach(function(g){g._rbnSized=(g._rbnSigId||0)+(viewFolded?'v':'');});
      if(vg.length) sizeRibbonGroups(vg);
    }
    (all?ctx.gs:ctx.shown).forEach(function(g){
      if(g.classList.contains('rbn-compact')) return;
      var want=st.F.indexOf(g)>=0,is=g.classList.contains('rbn-folded');
      if(is&&!want) rbnUnfoldGroup(g);
      else if(want&&!is) rbnFoldGroup(g);
      /* a door kept from before wears the choice it is measured by */
      else if(want&&ctx.calcOf) rbnFoldReadoutWrite(g,ctx.calcOf(g));
    });
  }
  /* THE ONE PLACE THE ROW IS MEASURED: its width, what scrolled past it,
     a group on a second line (T464), and how far the groups really reach
     -- which is what the state needs at any width. */
  function ribbonFitMeasure(ctx,st){
    var bar=ctx.bar,cw=bar.clientWidth,sw=bar.scrollWidth,fam=ctx.fam;
    var b=bar.getBoundingClientRect(),x0=b.left+bar.clientLeft;
    var top=null,wrapped=false,reach=0,lefts=fam.order?null:[];
    var rk=st?ribbonRungKey(st):null,F=new Map();
    ctx.shown.forEach(function(g){
      var r=g.getBoundingClientRect(),i=ctx.idx.get(g);
      if(lefts) lefts.push([r.left,i]);
      if(!r.width) return;
      if(top===null) top=r.top;
      else if(Math.abs(r.top-top)>1) wrapped=true;
      if(r.right-x0>reach) reach=r.right-x0;
      /* each group's own width at these rungs, folded or not (the
         choosers are doors in every state, and need no keeping) */
      if(rk===null||g.classList.contains('rbn-compact')) return;
      if(g.classList.contains('rbn-folded')){
        var said=ctx.readout(g);
        F.set(i,said);fam.d.set(rk+'|'+i+':'+said,r.width);
      } else fam.u.set(rk+'|'+i,r.width);
    });
    /* the order the groups stand in on screen (flex `order` decides it):
       rightmost first to fold, leftmost first to be given back */
    if(lefts){
      lefts.sort(function(p,q){return p[0]-q[0];});
      fam.order=new Map();
      lefts.forEach(function(p,k){fam.order.set(p[1],k);});
    }
    /* what scrolled past IS the row's length when it did. A reach that
       disagrees with it by more than rounding means something other than
       the groups is in the row, and this input is measured, never guessed */
    if(sw>cw+1&&Math.abs(sw-reach)>1.5) fam.exact=true;
    var m={cw:cw,sw:sw,r:reach,wrapped:wrapped,F:F};
    if(rk!==null){
      var list=fam.byRung.get(rk);
      if(!list) fam.byRung.set(rk,list=[]);
      list.push(m);
      ctx.measured++;ribbonFitStats.measured++;
    }
    return m;
  }
  /* DOES A STATE OVERFLOW AT WIDTH W. Measured at this very width, the
     answer is the one T464's over() gave: scrollWidth past clientWidth+1,
     or a group on a second line. Measured at another width, the row's own
     length answers -- but only where rounding cannot matter: within two
     pixels of the edge, after a wrap, or for a row with more than groups
     in it, null, and the state is measured again. */
  function ribbonFitDecide(m,W,fam){
    if(m.cw===W) return m.wrapped||m.sw>W+1;
    if(m.wrapped||fam.exact) return null;
    if(m.r>=W+2.5) return true;
    if(m.r<=W+0.5) return false;
    return null;
  }
  /* a state's name: its rungs, and the groups it folds with the choice
     each door would wear -- a door is as wide as its words */
  function ribbonStateSig(st,ctx){
    var s=''+st.nohint+st.erc+st.nostatus+st.tight;
    if(!st.F.length) return s;
    return s+'|'+st.F.map(function(g){
      return ctx.idx.get(g)+':'+ctx.readout(g);}).sort().join('|');
  }
  /* THE LADDER, asked of states (T187, T441, T445, T464, T589).
     Below the floor the row genuinely does not fit even flattened, and
     the only moves left -- clip, scroll, wrap -- are all forbidden.
     Standing the toolbar on its end is the layout that has room, and the
     Side button does exactly that; it is NOT done automatically, because
     a toolbar that teleports over a choice you just made was tried and
     rejected (2026-08-07). Floor measured by squeezing the resting ribbon
     10px at a time: 929px on 2026-08-10, 959px on 2026-08-16. Below it the
     remedy is Guides > Toolbar on the right, and T498 SAYS so, once
     (rbnOverflowNotice, after the frame). */
  var RBN_NEVER_FOLD=['rbn-fixed',
    /* Keep up to date never folds (T202: the point of it is to be seen) */
    'rbn-sources',
    /* T444: the Style system is never folded (2026-09-14, user: "I NEVER
       want this to be hidden. NEVER") */
    'rbn-stylesys',
    /* Lists are an editing primitive, not an infrequent option: keeping
       Paragraph open leaves List and Numbered direct targets when the
       ribbon is tight (2026-09-21) */
    'rbn-paragrp',
    /* T441/T445: a group that says so never folds -- Build order and
       Whole slide on Animation (2026-09-14, user: "make sure buttons like
       those in 'Order' are not getting squashed out, as they are really
       important") -- until the last resort below */
    'rbn-nofold',
    /* T383: one tile folds into one tile -- nothing to gain, and the
       check would wear a chevron for no reason */
    'rbn-check','rbn-cancel'];
  function ribbonFitClimb(ctx){
    var over=ctx.over,st=ribbonFitBase();
    var pos=function(g){
      var p=ctx.fam.order&&ctx.fam.order.get(ctx.idx.get(g));
      return p===undefined||p===null?-1:p;
    };
    var byLeft=function(list){
      return list.sort(function(x,y){return pos(x)-pos(y);});};
    var hasRow=function(g){return !!ribbonGroupRow(g);};
    /* THE SPACING RUNGS, in the order they are given up: the reminder
       text before any control tightens; the density rungs; then the save
       readout -- it is informative (where your work is) where the hint is
       decorative, but it still goes before any control shrinks to its
       last rung or the row clips (2026-08-18). The answer is the first of
       these that fits. Every rung only takes room away (measured over 750
       ladders: five layouts, four selections, every tab, 1000-1900px), so
       the first that fits is found by halving between what is already
       known to run over and what is known to fit -- after the row at
       rest, three measurements at most where the climb took up to six. */
    var L=[];
    for(var k=0;k<6;k++) L.push({nohint:k>=1?1:0,erc:Math.max(0,Math.min(3,k-1)),
      nostatus:k>=5?1:0,tight:0,F:[]});
    var lo=-1,hi=L.length;
    for(k=0;k<L.length;k++){
      var p=ctx.peek(L[k]);
      if(p===true&&k>lo) lo=k;
      if(p===false&&k<hi) hi=k;
    }
    if(lo<hi){
      /* the row at rest first: on most tabs at most widths it fits, and
         asking about a rung before it restyles the whole ribbon twice */
      if(lo<0&&hi>0){if(over(L[0])) lo=0; else hi=0;}
      while(hi-lo>1&&!ctx.stale){
        var mid=(lo+hi)>>1;
        if(over(L[mid])) lo=mid; else hi=mid;
      }
      st=ribbonFitCopy(L[Math.min(hi,L.length-1)]);
    } else {
      /* what is remembered disagrees with itself: ask in order, as the
         ladder always did */
      if(over(st)) st.nohint=1;
      for(var i=0;i<ERC.length;i++){
        if(ctx.stale||!over(st)) break;
        st.erc=i+1;
      }
      if(over(st)) st.nostatus=1;
    }
    /* still over after every rung: fold the one group that is not about
       the selection, rather than let the row clip (foldViewGroup) */
    if(over(st)) st.tight=1;
    /* STILL OVER: fold the rightmost group into a button that opens its
       row, and again until it fits (T187) -- the way PowerPoint collapses
       a group on a narrow window. A rightmost group with no row to fold
       ends the folding, as rbnFoldGroup's false always ended it. */
    var guard=0;
    while(!ctx.stale&&over(st)&&guard++<12){
      var cand=byLeft(ctx.shown.filter(function(g){
        if(g.classList.contains('rbn-compact')||st.F.indexOf(g)>=0) return false;
        for(var k=0;k<RBN_NEVER_FOLD.length;k++)
          if(g.classList.contains(RBN_NEVER_FOLD[k])) return false;
        return true;}));
      var g=cand.length?cand[cand.length-1]:null;
      if(!g||!hasRow(g)) break;
      st.F=st.F.concat([g]);
    }
    /* T589: THE LAST RESORT IS A DOOR, NEVER THE EDGE. Once every other
       group is a door and the row still does not fit, Whole slide folds,
       then Build order (at 1280px with a text box selected Build order
       began past the edge and the Animation panel could not be opened,
       2026-09-30); the give-back below opens either again if it can. */
    if(!ctx.stale&&over(st)){
      var last=ctx.shown.filter(function(g){
        return g.classList.contains('rbn-nofold')&&st.F.indexOf(g)<0
          &&!g.classList.contains('rbn-compact')&&hasRow(g);});
      last.sort(function(x,y){
        return (x.classList.contains('rbn-order')?1:0)
          -(y.classList.contains('rbn-order')?1:0);});
      for(var li=0;li<last.length&&!ctx.stale&&over(st);li++)
        st.F=st.F.concat([last[li]]);
    }
    /* T464: GIVE BACK WHAT THE LAST FOLD OVER-BOUGHT. Folding from the
       right stops the moment the row fits, and the fold that makes it fit
       is often a wide group whose door frees far more than was needed (on
       Design at 935px, Layout's 407px after four small ones). Each folded
       group is offered its row back, leftmost first -- the tab's own order
       of importance -- and keeps it if the row still fits. */
    byLeft(st.F.slice()).forEach(function(g){
      if(ctx.stale) return;
      var F=st.F.filter(function(x){return x!==g;});
      var t={nohint:st.nohint,erc:st.erc,nostatus:st.nostatus,tight:st.tight,F:F};
      if(!over(t)) st.F=F;
    });
    return st;
  }
  /* WHAT REBUILDING THE DOORS USED TO DO, done only where it is due: a
     door over a group whose controls changed reads its name and title
     again (rbnFoldRefresh), every door on the row wears its choice, and a
     change of fit closes what the old row had open -- a door's pop-up and
     the View menu -- as unfolding everything used to. */
  function ribbonFitClosePops(bar){
    $$('.rbn-foldmenu',bar).forEach(function(m){
      if(!m.hidden) overlayHide(m);});
    if(viewFolded) closeViewMenu();
  }
  function ribbonFitFinish(fin,ctx){
    ribbonFitClosePops(ctx.bar);
    ctx.shown.forEach(function(g){
      if(!g.classList.contains('rbn-folded')) return;
      if(g._rbnDoorSig!==g._rbnSigId){
        g._rbnDoorSig=g._rbnSigId;rbnFoldRefresh(g);}
      else rbnFoldReadoutWrite(g,ctx.calc.get(g)||rbnReadoutCalc(g));
    });
    rbnShelfRestore();
  }
  /* WHAT EACH STATE NEEDS, per input: a font and the width's bracket are
     part of the input. The most recently used are kept. */
  var ribbonFitMemo=new Map();
  function ribbonFitFamily(key){
    var f=ribbonFitMemo.get(key);
    if(f){ribbonFitMemo.delete(key);ribbonFitMemo.set(key,f);return f;}
    if(ribbonFitMemo.size>=48)
      ribbonFitMemo.delete(ribbonFitMemo.keys().next().value);
    /* m: state -> what it measured; u/d: each group's width at a set of
       rungs, open and as a door; byRung: the measurements at each set;
       doors: the sets every door has been measured at */
    f={m:new Map(),order:null,exact:false,u:new Map(),d:new Map(),
      byRung:new Map(),doors:new Set()};
    ribbonFitMemo.set(key,f);
    return f;
  }
  /* forget every answer: the next fit measures from the bottom of the
     ladder the way the climb always did (a font arriving, a test) */
  function ribbonFitForget(){
    ribbonFitMemo.clear();ribbonW=null;ribbonFitLast=null;
    var bar=$('#edit-tools'); if(bar) bar._fitKey=null;
  }
  /* AFTER THE FRAME, when the layout is already done and reading it costs
     nothing: the overflow notice and the shelf's fade (T498), and the
     check that a row decided from memory came out as predicted. One that
     did not is forgotten and fitted again by measuring, at once.
     A door that changed its words after the fit (rbnFoldReadouts, a frame
     later) asks for the same look: a row that now runs past the edge is
     fitted again -- the climb used to miss that until the next click. */
  var ribbonVerifyWant=null,ribbonRecheck=false,ribbonVerifyT=0;
  function ribbonFitVerifyLater(v){
    if(v!==undefined) ribbonVerifyWant=v;
    if(ribbonVerifyT) return;
    ribbonVerifyT=1;
    requestAnimationFrame(function(){
      setTimeout(function(){ribbonVerifyT=0;ribbonFitVerify();},0);});
  }
  function ribbonFitRecheckLater(){
    ribbonRecheck=true;ribbonFitVerifyLater();
  }
  function ribbonFitVerify(){
    var v=ribbonVerifyWant,re=ribbonRecheck;
    ribbonVerifyWant=null;ribbonRecheck=false;
    var bar=$('#edit-tools');
    if(!bar||bar.hidden||mode!=='edit'||deckEl.hidden||ribbonFolded()) return;
    if(typeof rbnOverflowNotice==='function') rbnOverflowNotice(bar);
    rbnShelfScrollSync();
    var L=ribbonFitLast;
    if(ribbonFitHold||!L||L.bar!==bar||deckEl.classList.contains('rbn-side'))
      return;
    var own=!!(v&&v.check&&bar._fitKey===v.key);
    if(!own&&!re) return;
    var all=$$('.rbn-grp',bar),idx=new Map();
    all.forEach(function(g,i){idx.set(g,i);});
    var m=ribbonFitMeasure({bar:bar,idx:idx,fam:{order:true},
      shown:all.filter(function(g){return ribbonGrpShown(g,bar);})});
    var now=m.wrapped||m.sw>m.cw+1;
    if(!own){
      if(now&&!L.over){
        ribbonFitStats.late++;
        bar._fitKey=null;ribbonFitLast=null;fitEditRibbon();
      }
      return;
    }
    /* the width moved since: its own fit is on the way */
    if(m.cw!==v.W) return;
    ribbonFitStats.verified++;
    /* the length it was decided by, measured or worked out */
    if(now===v.over&&(typeof v.r!=='number'||Math.abs(v.r-m.r)<=0.75)){
      if(!v.fam.m.has(v.sig)) v.fam.m.set(v.sig,m);
      return;
    }
    /* not what the memory promised. If what goes in changed after the fit
       (a door's choice read again), the fit was only late; otherwise the
       memory is wrong, and all of it for this input goes */
    var head=ribbonFitHead(bar,true);
    var same=ribbonFitInput(bar,head).key===v.input
      &&ribbonStateSig(v.fin,{idx:v.idx,readout:function(g){
        return rbnReadoutCalc(g).fin;}})===v.sig;
    if(same){
      ribbonFitStats.refit++;
      ribbonFitMemo.delete(v.input);
    } else ribbonFitStats.late++;
    bar._fitKey=null;ribbonFitLast=null;
    fitEditRibbon();
  }
  /* for the browser checks */
  window.SemDeckRibbonFit={stats:function(){return ribbonFitStats;},
    forget:ribbonFitForget,
    /* the fit as the climb always did it: nothing remembered */
    refit:function(){ribbonFitForget();fitEditRibbon();}};   /* test hook */
  /* ---- the strip's ceiling ---------------------------------------------
     published to CSS as --film-max so ONE number drives the rendered
     column, the handle's own position and the drag: 46% of the editor,
     and the 900px the drag has always stopped at.
     It USED to be the editor's width less the ribbon's measured floor as
     well (T80, T152, T539): the ribbon and the strip were two tracks of
     one row, so every pixel the handle took came out of the tools. T514
     moved the ribbon to span the window ABOVE the strip, and from then
     the term guarded nothing -- but it went on shrinking the ceiling as
     the widest tab grew. When T579 kept Disappear on the Animation tab
     with nothing selected, that tab's floor reached 1127px of a 1309px
     editor and the ceiling came out at the strip's own width: the handle
     could shrink the column and never widen it (2026-09-30, user: "the
     thumbnail view can now no longer be re-sized"). The eight-tab walk
     that measured the floor, and the memo T539 kept to hide its 98ms,
     went with it; nothing else read them. */
  function fitFilmMax(){
    var W=deckEl.clientWidth||window.innerWidth||0;
    if(!W) return 900;
    /* 150px is the strip's own minimum and wins the tie */
    var hi=Math.max(150,Math.min(900,Math.round(W*0.46)));
    deckEl.style.setProperty('--film-max',hi+'px');
    return hi;
  }
  /* ---- the thin top bar must never clip --------------------------------
     #deck-qat is ~14 fixed-width controls on flex-wrap:nowrap, and no
     fitter covered it: below ~750-800px the RIGHT end — Present, the
     primary action, and Help — clipped away unreachable, which the
     ladder forbids ("clip, scroll, wrap — all forbidden", fitEditRibbon).
     Same shape as fitRibbon / fitEditRibbon: reset, measure, escalate.
       rung 1 (.qat-c1)     spacing tightens and the long label shortens
                            ("Autosave" → "Auto"); words are shortened,
                            NEVER hidden (the twice-rejected icon-only)
       rung 2 (.qat-c2)     the save readout gives up its text — its
                            words also live in the Save button's tooltip
                            (T487: the cheap rung first; the readout was
                            dropped whole for a 30px shortfall)
       floor  (.qat-scroll) the bar scrolls sideways (overflow-x:auto,
                            thin scrollbar) so nothing is ever
                            unreachable. Safe for the bar's own menus:
                            File / Saved-to / Present all float
                            (floatMenu, position:fixed), so the scroll
                            box cannot cut them off. */
  function fitQat(){
    fitTabStrip();   /* T602: the rows are fitted together */
    var bar=$('#deck-qat');
    if(!bar||bar.hidden) return;
    var cl=bar.classList;
    cl.remove('qat-c1');cl.remove('qat-c2');cl.remove('qat-scroll');
    /* a hidden or zero-width bar is not a real fit — leave it relaxed */
    if(!bar.clientWidth) return;
    if(bar.scrollWidth>bar.clientWidth+1) cl.add('qat-c1');
    if(bar.scrollWidth>bar.clientWidth+1) cl.add('qat-c2');
    if(bar.scrollWidth>bar.clientWidth+1) cl.add('qat-scroll');
  }
  /* ---- T602: the tab strip's own rungs ---------------------------------
     The strip carries File, Find, Full screen and Present since T602 (the
     PowerPoint split), so a narrow window runs out of room: at 1100px it
     was 28px over with nothing selected, and Style and Object add two
     tabs more. The same ladder as fitQat's, each rung a step down: the
     tabs and buttons pack tighter and the hint goes, then the tab words
     are set a point smaller, and last the strip scrolls sideways. Never a
     second row, never a word lost. */
  function fitTabStrip(){
    var s=$('#rbn-tabs');
    if(!s||s.hidden) return;
    var cl=s.classList;
    cl.remove('rt-c1');cl.remove('rt-c2');cl.remove('rt-scroll');
    if(!s.clientWidth) return;
    if(s.scrollWidth>s.clientWidth+1) cl.add('rt-c1');
    if(s.scrollWidth>s.clientWidth+1) cl.add('rt-c2');
    if(s.scrollWidth>s.clientWidth+1) cl.add('rt-scroll');
  }
  function syncViewBtns(){
    var r=$('#vw-rulers'),g=$('#vw-grid'),f=$('#vw-full'),sd=$('#vw-side');
    if(r) r.setAttribute('aria-pressed',guides.rulers?'true':'false');
    if(g) g.setAttribute('aria-pressed',guides.grid?'true':'false');
    /* #vw-guidebox is NOT here: it is an `et` tool, so setTool owns its
       pressed state along with every other tool's. This one is a view
       toggle like its two neighbours and is owned here. */
    var cgv=$('#vw-guides');
    if(cgv) cgv.setAttribute('aria-pressed',guidesShown()?'true':'false');
    if(f) f.setAttribute('aria-pressed',editFull?'true':'false');
    /* out of the menu and into the row, so it shows its state too */
    if(sd) sd.setAttribute('aria-pressed',
      deckEl.classList.contains('rbn-side')?'true':'false');
    if(typeof svSyncBtns==='function') svSyncBtns();   /* T622 */
    var os=$('#vw-other-slides'),of=$('#vw-other-fill');
    if(os) os.setAttribute('aria-pressed',otherSlidesOn?'true':'false');
    if(of){
      of.disabled=!otherSlidesOn;
      of.setAttribute('aria-pressed',otherSlidesFill?'true':'false');
    }
  }
  /* ---- the View group folds when the row runs out of width ------------
     The density ladder's last rung says it drops "the one group that is
     not about the selection rather than let the row clip". It never did:
     erc-tight only tightened padding, so a 1366px window with a text box
     selected clipped Bold, Italic, Underline and Layout off the right-hand
     edge — unreachable, because the bar is overflow-x:clip and cannot be
     scrolled (and must stay that way, or every downward dropdown gets cut
     off at the ribbon's edge again; see the comment on .edit-tools).
     So the group folds instead of vanishing: the full-height tiles become
     one worded button whose menu still drives the real controls
     (2026-08-22; tiles completed 2026-09-12). */
  var VIEW_FOLD=[['vw-versions',null],
    ['vw-scroll','Scroll view'],['vw-scroll-lines',null],   /* T622 */
    ['vw-rulers','Rulers'],['vw-grid','Grid'],
    ['vw-other-slides','Other slides'],['vw-other-fill','Ghost fills'],
    ['vw-guides','Guides'],['vw-guidebox','Guide box'],
    ['vw-side','Side toolbar'],
    ['vw-check','Review'],['vw-preflight','Print check'],
    ['objects-btn','Layers'],['notes-btn','Notes'],
    ['comments-btn','Comments']];
  var viewFolded=false,viewWasHidden=null;
  function foldViewGroup(on){
    on=!!on;
    if(on===viewFolded) return;
    var w=$('#vw-morewrap');
    if(on){
      /* remember what was ALREADY hidden for its own reasons, so
         unfolding does not reveal a control this page never had */
      viewWasHidden={};
      VIEW_FOLD.forEach(function(p){
        var b=$('#'+p[0]); if(!b) return;
        viewWasHidden[p[0]]=b.hidden;b.hidden=true;});
      if(w) w.hidden=false;
    } else {
      VIEW_FOLD.forEach(function(p){
        var b=$('#'+p[0]); if(!b) return;
        b.hidden=viewWasHidden?!!viewWasHidden[p[0]]:false;});
      if(w) w.hidden=true;
      closeViewMenu();
      viewWasHidden=null;
    }
    viewFolded=on;
  }
  /* ---- GROUP FOLDING (T187) --------------------------------------
     A group whose row does not fit becomes ONE worded button that
     opens the row as a popover -- the group's own name on the door,
     its controls untouched inside (the real elements, moved, never
     copied). fitEditRibbon judges every rung with nothing folded and
     folds from the right until the bar fits, so a wider window opens
     the groups out again by itself. Never the fixed groups, never the
     Drawing or Quick animate groups (a mode's exit must stay on the
     bar), and a layout unfolds all before it moves anything. */
  /* ---- T453: THE SHELF ------------------------------------------------
     (2026-09-14, user: "put all the ones for whole slide and build order
     to the right hand side. Then each of these buttons opens up a
     horizontal display of all the options ... Like how we had it before,
     but instead of them all having a little horizontal thing of options,
     it just appears for the one that you click on out of transition,
     effect, time and text, motion".)
     T441 gave every chooser a door and a readout, which fixed the
     crowding but put the options in a pop-up over the slide -- the thing
     the user has objected to more than any other. The row is not
     rebuilt anywhere: the SAME element moves between its parked holder
     and the shelf, so every listener, pressed state and readout on it
     survives the move, and there is exactly one of it. */
  var rbnShelfFor=null,rbnShelfWant=null;
  /* T498: A GROUP'S NAME IS ITS CAPTION'S OWN WORDS. Focus's caption
     wears the click its focus is on (#anim-focus-say, a readout INSIDE
     the label, T472), and the door and the shelf took the whole
     caption as the name: after the first refit the door read "Focus on
     click 5 ▾" over "Blur the rest" and the shelf would have been
     titled FOCUS ON CLICK 5 (the third review pass). The words less
     any readout, from the one place both readers ask. */
  function rbnGroupName(g){
    var lab=g&&g.querySelector('.rbn-lab');
    if(!lab) return '';
    var src=lab.cloneNode(true);
    $$('.rbn-foldval',src).forEach(function(v){v.remove();});
    return src.textContent.replace(/\s+/g,' ').trim();
  }
  /* the row of a folded group, wherever it currently lives */
  function rbnFoldRow(g){
    if(!g) return null;
    var m=g.querySelector('.rbn-foldmenu');
    var r=m&&m.querySelector('.rbn-row');
    if(r) return r;
    if(rbnShelfFor===g){
      var b=$('#rbn-shelf-body');
      return b?b.querySelector('.rbn-row'):null;
    }
    return null;
  }
  /* The user closing it forgets it; everything else is bookkeeping and
     must not, or a measuring pass would dismiss what you are reading. */
  function rbnShelfDismiss(){rbnShelfWant=null;rbnShelfClose();}
  function rbnShelfClose(){
    var sh=$('#rbn-shelf'); if(!sh) return;
    var g=rbnShelfFor;
    rbnShelfFor=null;
    if(g){
      var menu=g.querySelector('.rbn-foldmenu');
      var body=$('#rbn-shelf-body');
      var row=body&&body.querySelector('.rbn-row');
      if(menu&&row) menu.appendChild(row);
      var b=g.querySelector('.rbn-foldbtn');
      if(b) b.setAttribute('aria-expanded','false');
      g.classList.remove('rbn-shelved');
    }
    sh.hidden=true;
    rbnShelfMark(false);
    var nm=$('#rbn-shelf-name'); if(nm) nm.textContent='';
  }
  /* THE BAR SAYS A SHELF IS OPEN (deck.css .edit-tools.ribbon.shelf-open,
     its two-row grid). Written here, beside the shelf's `hidden`, by the
     only two functions that write it -- it was a :has(.rbn-shelf:not(
     [hidden])) on the bar, and every change anywhere in the ribbon made
     the browser walk the whole bar to re-answer it (2026-10-09, speed).
     Only when it changes: rbnShelfClose runs on every fitting pass. */
  function rbnShelfMark(on){
    var bar=$('#edit-tools');
    if(bar&&bar.classList.contains('shelf-open')!==on)
      bar.classList.toggle('shelf-open',on);
  }
  /* WHERE AN OBJECT GROUP SITS. deck.css orders the Object tab's groups
     by the control each one holds (source first, then appearance,
     geometry, arranging, history). That was five :has(#fmt-...) rules,
     and a :has() on a group is re-checked on every change anywhere in
     the ribbon -- a keystroke, a selection, a fold (2026-10-09, speed).
     WHICH group holds a control changes only when a layout moves it
     (applyRibbonLayout, 07-ribbon-layouts.js), which calls this once the
     controls have landed, so the answer is written then, as
     data-fmt-ord. A later entry wins, as the later rule did. A row
     parked on the shelf (T453) still belongs to its group: the shelf is
     the group's, borrowed, and the group keeps its place. */
  var RBN_FMT_ORD=[['fmt-srcwrap','0'],['fmt-opwrap','2'],
    ['fmt-geom-xy','3'],['fmt-alignwrap','4'],['fmt-hist','5']];
  function rbnFmtOrder(){
    var bar=$('#edit-tools'); if(!bar) return;
    var shelf=$('#rbn-shelf-body'),want=new Map();
    RBN_FMT_ORD.forEach(function(p){
      var el=document.getElementById(p[0]);
      if(!el||!bar.contains(el)) return;
      var g=el.closest('.rbn-grp');
      if(!g&&shelf&&shelf.contains(el)) g=rbnShelfFor;
      if(g) want.set(g,p[1]);
    });
    $$('.rbn-grp',bar).forEach(function(g){
      var v=want.get(g)||null;
      if(g.getAttribute('data-fmt-ord')===v) return;
      if(v) g.setAttribute('data-fmt-ord',v);
      else g.removeAttribute('data-fmt-ord');
    });
  }
  /* The bar grows a line while the shelf is open and loses it again, so
     the stage is a different height either way and the page has to be
     re-fitted to it -- the same courtesy a docking pane gets.
     Only the CLICKS call this. Opening and closing must stay silent in
     themselves, because fitEditRibbon takes the shelf apart and puts it
     back on every pass and a refit from inside that would re-enter it. */
  function rbnShelfRefit(){
    if(typeof applyZoom==='function') applyZoom();
  }
  /* clicking the open door again closes it; clicking another swaps */
  function rbnShelfOpen(g){
    var sh=$('#rbn-shelf'),body=$('#rbn-shelf-body');
    if(!sh||!body||!g) return false;
    if(rbnShelfFor===g){rbnShelfDismiss();return true;}
    rbnShelfClose();
    var menu=g.querySelector('.rbn-foldmenu');
    var row=menu&&menu.querySelector('.rbn-row');
    if(!row) return false;
    body.appendChild(row);
    var nm=$('#rbn-shelf-name');
    if(nm) nm.textContent=rbnGroupName(g)||'Options';
    sh.hidden=false;
    rbnShelfMark(true);
    g.classList.add('rbn-shelved');
    var b=g.querySelector('.rbn-foldbtn');
    if(b) b.setAttribute('aria-expanded','true');
    rbnShelfFor=g;
    /* T454: twenty-two shapes are wider than any window, and a row that
       scrolls with no sign that it does is a row whose last third does
       not exist. The class draws a fade at the edge it runs off. */
    rbnShelfScrollSync();
    return true;
  }
  /* T498: ...measured again at the end of every fit, not only when the
     shelf opened: the ladder narrows the tiles and the window narrows
     the body after that, and a row that ran off the edge at 1050px
     wore no fade because it had fitted at 1500. */
  function rbnShelfScrollSync(){
    var sh=$('#rbn-shelf'),body=$('#rbn-shelf-body');
    if(!sh||!body||sh.hidden) return;
    sh.classList.toggle('can-scroll',body.scrollWidth>body.clientWidth+1);
  }
  /* A row parked in the shelf belongs to ONE group on ONE tab. Changing
     tab, or anything that hides that group, has to give it back first or
     the row is stranded in a shelf the tab it came from cannot see. */
  function rbnShelfSync(){
    var g=rbnShelfFor;
    if(!g) return;
    /* `data-off` is how a tab change takes a group away -- it is
       display:none, not `hidden` -- and a row left on the shelf after
       its tab has gone is a row its own tab can never get back */
    if(!document.contains(g)){rbnShelfDismiss();return;}
    /* T498: a tab change is bookkeeping, not the user closing it. The
       shelf rode through a deselect, a reselect and four resizes and
       was forgotten by a glance at Home (the third review pass): the
       row goes back to its group, and the wish stays, so rbnShelfRestore
       reopens it when its tab returns -- and refuses while the group is
       off or hidden, so nothing opens on the wrong tab. */
    if(g.hidden||g.hasAttribute('data-off')){rbnShelfWant=g;rbnShelfClose();}
  }
  function rbnShelfBoot(){
    var x=$('#rbn-shelf-close');
    if(x) x.addEventListener('click',function(e){
      e.stopPropagation();rbnShelfDismiss();rbnShelfRefit();});
    /* T586: the slim line scrolls with the wheel -- its thin scrollbar
       is a small target, and the wheel is where a hand on a mouse is */
    var body=$('#rbn-shelf-body');
    if(body) body.addEventListener('wheel',function(e){
      if(Math.abs(e.deltaY)<=Math.abs(e.deltaX)) return;
      if(body.scrollWidth<=body.clientWidth+1) return;
      body.scrollLeft+=e.deltaY;e.preventDefault();
    },{passive:false});
  }
  function rbnFoldTitle(name,compact){
    return compact
      ?(name+' \u2014 click to choose. The current choice is on the '
        +'button')
      :(name+' \u2014 folded because the window is too narrow to show '
        +'the whole row. Widen the window and it opens out again');
  }
  function rbnFoldGroup(g){
    if(!g||g.classList.contains('rbn-folded')) return false;
    var row=null;
    [].slice.call(g.children).forEach(function(c){
      if(!row&&c.classList.contains('rbn-row')) row=c;});
    if(!row) return false;
    var lab=g.querySelector('.rbn-lab');
    var name=rbnGroupName(g)||'More';
    /* THE DOOR IS A TILE (T218): the group's own icon over its name and
       a chevron, spanning both rows -- the shape PowerPoint collapses a
       group into, and the one tile every other tall control is. A small
       one-row button left a hole under it (2026-09-03, "same goofiness
       with buttons still exists"). */
    var wrap=document.createElement('span');
    wrap.className='sh-drop rbn-foldwrap rbn-tall';
    var btn=document.createElement('button');
    btn.type='button';btn.className='fx-tile big-tile rbn-foldbtn';
    btn.setAttribute('aria-haspopup','true');
    btn.setAttribute('aria-expanded','false');
    /* T441: THE DOOR SAYS WHAT IS CHOSEN (2026-09-14, user, of the
       Animation tab: "there are lots of menus that drop down when you
       click. These should all be buttons with what is currently
       selected beside it ... the transition button, then there should
       just be one beside it with what is the current option"). The
       tile carries the group's name over its current choice -- the
       pressed tile or button inside -- and rbnFoldReadouts keeps it
       true as the selection changes. A compact group (rbn-compact) is
       folded whatever the width; the rest still fold only when the
       row runs out of room. */
    var compact=g.classList.contains('rbn-compact');
    btn.innerHTML=bic(g.getAttribute('data-fold-ic')||'menu')
      /* T463: a no-break space before the chevron, so a name the door
         has to wrap keeps its chevron on the last word rather than
         dropping it onto a line of its own ("Text sequence" / "\u25be") */
      +'<span>'+esc(name)+'\u00a0\u25be</span><span class="rbn-foldval"></span>';
    btn.title=rbnFoldTitle(name,compact);
    /* T498: the live title, for the readout to put back after a dead spell */
    btn.setAttribute('data-title',btn.title);
    var menu=document.createElement('div');
    menu.className='sh-menu rbn-foldmenu';menu.hidden=true;
    menu.appendChild(row);
    wrap.appendChild(btn);wrap.appendChild(menu);
    g.insertBefore(wrap,lab||null);
    g.classList.add('rbn-folded');
    /* the door was built from what the group holds now (ribbonFitFinish) */
    g._rbnDoorSig=g._rbnSigId;
    btn.addEventListener('click',function(e){
      e.stopPropagation();
      /* T453: a COMPACT group is one the user chose to keep folded, so
         its options open in the ribbon's own shelf. A group folded only
         because the window is narrow keeps the pop-up: there is by
         definition no room for a shelf on that row. */
      /* T465: ...and a ribbon standing on its side (every portrait
         poster) has no line to give a shelf either -- the shelf became
         a 711px block at the foot of the column with one tile visible
         behind a 63px scrollbar (2026-09-15 review) */
      if(compact&&!deckEl.classList.contains('rbn-side')&&rbnShelfOpen(g)){
        rbnShelfRefit();return;}
      if(!menu.hidden){overlayHide(menu);return;}
      overlayShow(btn,menu);floatMenu(btn,menu);
    });
    rbnFoldReadout(g);
    return true;
  }
  /* T441: the current choice of a folded group, read off the pressed
     control inside its row: a tile's word, a button's words, never a
     chevron or a shortcut key.
     WORKED OUT, THEN WRITTEN ONLY WHERE IT CHANGED (2026-10-09, speed).
     The answer is a pure reading of the row (rbnReadoutCalc), which the
     ribbon's fit also asks of a group it is only thinking of folding --
     a door is as wide as its words -- and rbnFoldReadoutWrite puts it on
     the door. Rewriting the same words, `hidden` and class on every
     pressed or disabled change anywhere on the bar restyled every door
     and woke the observers watching them, 22 times in one resize drag. */
  function rbnReadoutCalc(g){
    /* T453: the row may be sitting in the shelf rather than in this
       group, and the readout is still this group's to keep true */
    var row=ribbonGroupRow(g);
    /* T467: EVERY choice in the row, one per strip or cell, joined.
       T518 split the former two-strip Timing group into separate doors,
       but custom layouts can still place several choosers in one group. */
    var ons=row?$$('[aria-pressed="true"]',row):[];
    var boxes=[],parts=[];
    /* T498: a control inside something HIDDEN is not a choice on show.
       The Familiar ribbon's Drawing door read "2.25 pt" off a .sh-opt
       inside the line-width menu that was not open (the third review
       pass); the dead check below already walks the ancestors, and so
       does this. */
    function shown(c){
      for(var n=c;n&&n!==row;n=n.parentNode) if(n.hidden) return false;
      return true;
    }
    /* A chooser can report Mixed even though none of its tiles is pressed.
       Keep the answer on that chooser so custom ribbon layouts can move it. */
    if(row) $$('.strip-frame[data-say]',row).forEach(function(box){
      var say=box.getAttribute('data-say');
      if(say&&shown(box)){boxes.push(box);parts.push(say);}
    });
    ons.forEach(function(on){
      if(!shown(on)) return;
      var box=on.closest&&on.closest('.strip-frame,.rbn-cell,.sh-drop');
      /* past the row, the box is the door's own wrap (an .sh-drop), which
         every loose choice in a folded row shares -- and so it is for a
         row the fit is still only thinking of folding, in place. The
         shelf is no wrap: there each loose choice is its own. */
      if(!box||!row.contains(box))
        box=(box||!(row.parentNode&&row.parentNode.id==='rbn-shelf-body'))
          ?g:on;
      if(boxes.indexOf(box)>=0) return;
      boxes.push(box);
      /* T464: the WHOLE control's words, less what is not a word. The
         first <span> of a tile used to be taken as its word, and a
         page-size tile's first span is its little page drawing -- so
         the Page size door read out nothing. A tile's own readout is
         dropped too, or a folded Leaves early would say "Send it away
         never". */
      var src=on.cloneNode(true);
      $$('kbd,.rbn-foldval,.page-ico',src).forEach(function(k){k.remove();});
      var t=src.textContent.replace(/[\u25be\u25bc]/g,'').replace(/\s+/g,' ')
        .trim();
      if(t) parts.push(t);
    });
    /* T498: TWO CHOICES AT MOST. T467's join is for a group of two
       strips ("On click \u00b7 By bullet"); a rest group holds eight
       unrelated choices and its door read "None \u00b7 Cut \u00b7 Still
       \u00b7 Whole box \u00b7 Every slide \u00b7 Code trail \u00b7
       Panel + text \u00b7 Left", cut to 56px (the third review pass).
       A door over more than two says nothing and lets what it opens
       speak. */
    var txt=parts.length>2?'':parts.join(' \u00b7 ');
    /* T479: a group may say its own answer (data-say) when the pressed
       controls are swatches with no words -- Background's */
    if(g.hasAttribute('data-say')) txt=g.getAttribute('data-say')||'';
    var res={row:!!row,txt:txt,fin:txt,dead:false,why:'',picked:false};
    /* T469: A DOOR OVER NOTHING LIVE IS NOT LIVE. Effect, Timing and
       Motion looked ready with nothing selected and opened shelves of
       disabled tiles (2026-09-15 review). A row whose every control
       is disabled greys its door and says why; Transition, whose row
       is about the slide, stays live.
       T498: a row whose every control is HIDDEN is not live either --
       on a poster the Effect strip was hidden and its door opened an
       empty shelf (belt and braces: applyPage hides the frames now).
       The readout says the STATE in the door's own width -- "select
       something" was cut to "select s\u2026" at the tight rung, four
       doors in a row (the third review pass) -- and the title carries
       the sentence. */
    if(row){
      var ctl=$$('button,select,input',row).filter(function(c){
        if(c.closest&&c.closest('.strip-nav')) return false;   /* arrows are not choices */
        for(var n=c;n&&n!==row;n=n.parentNode) if(n.hidden) return false;   /* nor hidden ones */
        return true;});
      var dead=ctl.every(function(c){return c.disabled;});
      /* T529: "no selection" was said with a figure selected -- the
         row is dead for another reason then, and the door says which:
         Start waits for an entrance, anything else does not apply to
         what you picked (2026-09-29 audit) */
      var picked=(typeof selAnnot!=='undefined'&&selAnnot!==null);
      var why=!picked?'no selection'
        :(g.classList.contains('rbn-start')
          ||g.classList.contains('rbn-timing'))?'no entrance'
        :'not for this';
      res.dead=dead;res.picked=picked;res.why=why;
      if(dead) res.fin=why;
    }
    return res;
  }
  /* true when the door's words changed */
  function rbnFoldReadoutWrite(g,c){
    var val=g.querySelector('.rbn-foldwrap>.rbn-foldbtn>.rbn-foldval');
    if(!val) return false;
    var btn=val.parentNode,moved=false;
    if(val.textContent!==c.fin){val.textContent=c.fin;moved=true;}
    if(val.hidden!==!c.fin) val.hidden=!c.fin;
    if(btn.classList.contains('has-val')!==!!c.fin)
      btn.classList.toggle('has-val',!!c.fin);
    if(c.row){
      var dead=c.dead,picked=c.picked,why=c.why;
      /* only when it changes: the observer that calls this watches
         `disabled`, and re-setting the same value is still a mutation */
      if(btn.disabled!==dead) btn.disabled=dead;
      var live=btn.getAttribute('data-title')||'';
      var want=dead?(live.split(' \u2014 ')[0]+' \u2014 '
        +(!picked?'select something on the slide first'
          :why==='no entrance'?'give it an entrance effect first'
          :'not available for what is selected')):live;
      if(live&&btn.title!==want) btn.title=want;
    }
    return moved;
  }
  function rbnFoldReadout(g){
    if(!g.querySelector('.rbn-foldwrap>.rbn-foldbtn>.rbn-foldval')) return false;
    return rbnFoldReadoutWrite(g,rbnReadoutCalc(g));
  }
  /* every folded door, or the ones named; true when any changed its words */
  function rbnFoldReadouts(list){
    var moved=false;
    (list||$$('#edit-tools .rbn-grp.rbn-folded')).forEach(function(g){
      if(g.classList.contains('rbn-folded')&&rbnFoldReadout(g)) moved=true;});
    return moved;
  }
  /* THE READOUTS FOLLOW EVERY PRESSED-STATE CHANGE ON THE BAR -- of the
     groups it happened in. A change outside every group reads them all,
     as before; a door's own `disabled` is the readout's writing, not a
     reason to read again. A door that changed its words may have changed
     its width, so the row is looked at again after the frame. */
  function rbnReadoutBoot(){
    var bar=$('#edit-tools'); if(!bar||!window.MutationObserver) return;
    var pending=false,dirty=new Set(),all=false;
    new MutationObserver(function(recs){
      for(var i=0;i<recs.length;i++){
        var r=recs[i],t=r.target;
        if(t.classList&&t.classList.contains('rbn-foldbtn')) continue;
        /* a write of the value it already had (sizePaneSync sets every
           field's `disabled` on every refresh) changes no choice */
        if(t.getAttribute(r.attributeName)===r.oldValue) continue;
        var g=ribbonSigOwner(t);
        if(g) dirty.add(g); else all=true;
      }
      if(pending||(!all&&!dirty.size)) return;
      pending=true;
      requestAnimationFrame(function(){
        pending=false;
        var list=all?null:Array.from(dirty);
        all=false;dirty.clear();
        if(rbnFoldReadouts(list)) ribbonFitRecheckLater();
      });
    })
      .observe(bar,{subtree:true,attributes:true,attributeOldValue:true,
        attributeFilter:['aria-pressed','disabled','data-say']});
  }
  function rbnUnfoldGroup(g){
    var wrap=null;
    [].slice.call(g.children).forEach(function(c){
      if(!wrap&&c.classList.contains('rbn-foldwrap')) wrap=c;});
    if(!wrap) return;
    /* T453: take the row back off the shelf before unfolding, or the
       group opens out around a row that is somewhere else */
    if(rbnShelfFor===g) rbnShelfClose();
    var menu=wrap.querySelector('.rbn-foldmenu');
    if(menu&&!menu.hidden) overlayHide(menu);
    var row=wrap.querySelector('.rbn-row');
    if(row) g.insertBefore(row,wrap);
    wrap.remove();
    g.classList.remove('rbn-folded');
  }
  /* WHAT REFOLDING WOULD HAVE GIVEN THE DOOR, without rebuilding it
     (the fit keeps a group folded that it would only have unfolded and
     folded straight back, and calls this when what the group holds has
     changed, ribbonFitFinish): the popover shut and the shelf
     given up exactly as rbnUnfoldGroup and rbnShelfRestore would leave
     them, and the name, title and readout read again as rbnFoldGroup
     would write them */
  function rbnFoldRefresh(g){
    var wrap=null;
    [].slice.call(g.children).forEach(function(c){
      if(!wrap&&c.classList.contains('rbn-foldwrap')) wrap=c;});
    if(!wrap) return;
    if(rbnShelfFor===g&&(g.hidden||g.hasAttribute('data-off'))) rbnShelfClose();
    var menu=wrap.querySelector('.rbn-foldmenu');
    if(menu&&!menu.hidden) overlayHide(menu);
    var btn=wrap.querySelector('.rbn-foldbtn');
    if(btn){
      var name=rbnGroupName(g)||'More';
      var sp=btn.querySelector(':scope>span:not(.rbn-foldval)');
      if(sp&&sp.textContent!==name+'\u00a0\u25be') sp.textContent=name+'\u00a0\u25be';
      var t=rbnFoldTitle(name,g.classList.contains('rbn-compact'));
      if(btn.getAttribute('data-title')!==t){
        btn.title=t;btn.setAttribute('data-title',t);}
      var ex=(rbnShelfFor===g)?'true':'false';
      if(btn.getAttribute('aria-expanded')!==ex) btn.setAttribute('aria-expanded',ex);
    }
    if(rbnShelfFor===g){
      var nm=$('#rbn-shelf-name'),w=rbnGroupName(g)||'Options';
      if(nm&&nm.textContent!==w) nm.textContent=w;
    }
    rbnFoldReadout(g);
  }
  function rbnUnfoldAll(){
    /* T453: a pass that unfolds the whole bar (a layout moving its
       controls; the fit did too, until 2026-10-09) hands the shelf's row
       back to its group. Remember whose it was here, once, so whoever
       refolds can put it back; patching the callers one at a time is how
       the shelf shut itself on every selection change. */
    if(rbnShelfFor) rbnShelfWant=rbnShelfFor;
    $$('#edit-tools .rbn-grp.rbn-folded').forEach(rbnUnfoldGroup);
  }
  /* ...and the other half: called wherever a pass has finished folding */
  function rbnShelfRestore(){
    var g=rbnShelfWant;
    if(!g||rbnShelfFor) return;
    if(g.hidden||g.hasAttribute('data-off')||!document.contains(g)
       ||!g.classList.contains('rbn-folded')) return;
    rbnShelfOpen(g);
  }
  function closeViewMenu(){
    var m=$('#vw-more-menu');
    if(m) overlayHide(m);
  }
  /* the rows DRIVE the real buttons, so each control keeps its one
     implementation and its own state — the same trick the Arrange menu
     uses for front/back/rotate */
  function openViewMenu(){
    var m=$('#vw-more-menu'),btn=$('#vw-more');
    if(!m||!btn) return;
    if(!m.hidden){closeViewMenu();return;}
    m.innerHTML='';
    menuHead(m,'view');
    VIEW_FOLD.forEach(function(p){
      var real=$('#'+p[0]);
      if(!real||(viewWasHidden&&viewWasHidden[p[0]])) return;
      var o=document.createElement('button');
      o.className='dbtn vw-opt';o.type='button';
      /* Slides renames itself Versions for posters; use the live word for
         that contextual control instead of freezing the menu's copy. */
      /* T622: a tile whose word is its state (Faint line) is named in
         full by its aria-label (Between slides: Faint line) */
      o.textContent=p[1]||(real.getAttribute('aria-label')
        ||real.textContent||'Slides').replace(/\s+/g,' ').trim();
      if(real.getAttribute('aria-pressed')==='true'){
        o.setAttribute('aria-pressed','true');
        o.classList.add('on');
      }
      if(real.disabled) o.disabled=true;
      o.title=real.title||'';
      o.addEventListener('click',function(e){
        e.stopPropagation();closeViewMenu();real.click();});
      m.appendChild(o);
    });
    /* THE OTHER DOOR. Right-clicking the ribbon is where this shape of
       thing lives in every other application, and it is also invisible
       to anyone who does not already know to try it (2026-08-25). */
    menuHead(m,'the ribbon itself');
    var gal=document.createElement('button');
    gal.className='dbtn vw-opt';gal.type='button';
    gal.textContent='Ribbon layouts\u2026';
    gal.title='Try a different arrangement of the whole ribbon';
    gal.addEventListener('click',function(e){
      e.stopPropagation();closeViewMenu();openRibbonGallery();});
    m.appendChild(gal);
    overlayShow(btn,m);
    floatMenu(btn,m);
  }
  (function(){
    var b=$('#vw-more');
    if(b) b.addEventListener('click',function(e){
      e.stopPropagation();openViewMenu();});
    document.addEventListener('click',function(e){
      var w=$('#vw-morewrap');
      if(w&&!w.contains(e.target)) closeViewMenu();
    });
  })();
  /* THE ROOT ELEMENT, not the deck. A fullscreen element paints its own
     subtree and nothing else, and half this app's overlays are siblings of
     .deck rather than children of it — the theme picker, the colour
     picker, find & replace, tooltips, the playback spotlight. Fullscreening
     .deck made every one of them invisible while it was on, which is why
     the theme could not be changed while editing full screen (2026-08-20,
     user). .deck is position:fixed;inset:0 either way, so this looks
     identical and simply stops swallowing the overlays. */
  function fullTarget(){
    return document.documentElement;
  }
  function toggleEditFull(){
    try{
      if(!document.fullscreenElement&&fullTarget().requestFullscreen){
        editFull=true;
        deckEl.classList.add('editfull');
        fullTarget().requestFullscreen().catch(function(){
          editFull=false;deckEl.classList.remove('editfull');syncViewBtns();});
      } else if(document.fullscreenElement){
        document.exitFullscreen().catch(function(){});
      }
    }catch(err){}
    syncViewBtns();
  }
  (function(){
    /* No View menu. Rulers, Grid, Full screen and Side toolbar are four
       buttons in the row now: each is a stateful TOGGLE, and a toggle you
       have to open a menu to read the state of is a toggle nobody trusts.
       Two of them were never guides in the first place (2026-08-20). */
    /* ONE button, two mechanisms, because the two page kinds want opposite
       defaults. A deck's strip is docked and on: toggling it is a class,
       and the slide list never leaves the panel. A poster's versions are
       rare enough to be worth no permanent width, so they stay in the
       floating pane the Objects list uses (2026-08-17). */
    var vsb=$('#vw-versions');
    if(vsb) vsb.addEventListener('click',function(){
      if(pageOf().poster){showVerpane(!!$('#verpane').hidden);return;}
      deckEl.classList.toggle('strip-off');
      syncStripBtn();
      applyZoom();          /* the stage just changed width */
    });
    var vpc=$('#verpane-close');
    if(vpc) vpc.addEventListener('click',function(){showVerpane(false);});
    var r=$('#vw-rulers'),g=$('#vw-grid'),sd=$('#vw-side'),f=$('#vw-full');
    if(r) r.addEventListener('click',function(){
      guides.rulers=!guides.rulers;saveGuides();syncViewBtns();syncGuides();});
    if(g) g.addEventListener('click',function(){
      guides.grid=!guides.grid;saveGuides();syncViewBtns();
      renderSlide();});
    var os=$('#vw-other-slides'),of=$('#vw-other-fill');
    if(os) os.addEventListener('click',function(){toggleOtherSlides();});
    if(of) of.addEventListener('click',function(){toggleOtherSlideFills();});
    /* SHOW/HIDE, not delete. Only the hiding half says so out loud: a
       guide going away used to mean it was gone, and nothing else in the
       editor makes something invisible without also removing it. */
    var cgv=$('#vw-guides');
    if(cgv) cgv.addEventListener('click',function(){
      var on=!guidesShown();
      showCustomGuides(on);
      if(!on) toast('Guides hidden \u2014 still in the deck, and they '
        +'stop snapping until you show them again');});
    if(sd) sd.addEventListener('click',function(){
      guides.side=!wantSide();guides.sideSet=true;
      saveGuides();applySideRibbon();});
    if(f) f.addEventListener('click',toggleEditFull);
    /* leaving full screen by any route (Esc, F11, the OS) must not leave
       the editor stamped with a full-screen class it no longer has */
    document.addEventListener('fullscreenchange',function(){
      if(document.fullscreenElement) return;
      if(!editFull) return;
      editFull=false;
      deckEl.classList.remove('editfull');
      syncViewBtns();applyZoom();
    });
    /* the pointer's position, shown on both rulers */
    if(stage) stage.addEventListener('mousemove',function(e){
      /* WHERE THE POINTER IS, which is the whole question "Paste here"
         asks. CLIENT coordinates only: turning them into slide
         percentages needs a rect, and a getBoundingClientRect on every
         mousemove is exactly the cost the 2026-08-23 pass took out of
         this handler. The conversion happens once, at the paste. */
      lastCanvasXY={x:e.clientX,y:e.clientY};
      if(!guides.rulers||mode!=='edit') return;
      var slideEl=stage.querySelector('.slide'); if(!slideEl) return;
      var sr=slideEl.getBoundingClientRect();
      if(!sr.width||!sr.height) return;
      rulerCursor.x=(e.clientX-sr.left)/sr.width;
      rulerCursor.y=(e.clientY-sr.top)/sr.height;
      if(rulerCursor.x<0||rulerCursor.x>1) rulerCursor.x=null;
      if(rulerCursor.y<0||rulerCursor.y>1) rulerCursor.y=null;
      /* the LIGHT path: shade the selection's extent (it follows a drag
         live) and move the 1px cursor — never rebuild the ticks, the
         grid or the custom guides from a mousemove (2026-08-23 perf:
         syncGuides() regenerated every tick node per event) */
      rulerPx.w=sr.width;rulerPx.h=sr.height;
      drawRulerSel();
      drawRulerCursor();
    });
    if(stage) stage.addEventListener('mouseleave',function(){
      lastCanvasXY=null;
      rulerCursor.x=rulerCursor.y=null;
      if(guides.rulers&&mode==='edit') drawRulerCursor();
    });
    if(stage) stage.addEventListener('scroll',function(){syncGuides();});
  })();
  (function(){
    var zi=$('#zoom-in'),zo=$('#zoom-out'),zv=$('#zoom-val');
    if(zi) zi.addEventListener('click',function(){
      setZoom(Math.min(6,(deckZoom||1)*1.25));});
    if(zo) zo.addEventListener('click',function(){
      setZoom(Math.max(0.25,(deckZoom||1)/1.25));});
    if(zv) zv.addEventListener('click',function(){setZoom(0);});
    window.addEventListener('resize',function(){
      ribbonW=null;   /* the fit's trusted head (ribbonFitHead) */
      if(!deckEl.hidden){fitFilmMax();scheduleRibbonFit();scheduleQatFit();}});
    /* the ribbon's height CHANGES now (the contextual format groups
       leave the layout when hidden), and so does the page picker — any
       toolbar reflow resizes the stage, so the page re-fits itself
       rather than waiting for a window resize */
    if(window.ResizeObserver){
      var et=$('#edit-tools');
      /* the ribbon's own box changing is the ONE signal that catches every
         way it can get narrower — window resize, the docked panel opening,
         the side rail collapsing, and the first real layout after load.
         Without this the bar was measured at zero width on open, bailed
         out, and never compacted again: the toolbar you saw was always
         full size and simply ran off the right-hand edge (2026-08-07). */
      if(et) new ResizeObserver(function(){
        ribbonW=null;
        if(deckEl.hidden) return;
        scheduleRibbonFit();
      }).observe(et);
      /* the thin top bar gets the same treatment for the same reason:
         its box changing (window resize, first real layout on open) is
         the one signal that catches every way it can get narrower */
      var qb=$('#deck-qat');
      if(qb){
        var qro=new ResizeObserver(function(){
          if(deckEl.hidden) return;
          scheduleQatFit();
        });
        qro.observe(qb);
        /* T487: and its CONTENTS. The bar's own box never changes when
           a control inside it grows -- the Autosave label was rewritten
           a beat after fitQat had measured, and at 1300px the bar sat
           16px past its box with the Present chevron clipped until the
           next window resize (driven). Its children are fixed markup,
           so watching them once at boot is watching every label. */
        [].forEach.call(qb.children,function(c){qro.observe(c);});
        /* T602: and the open tabs, which app.js moves into this bar
           while the editor is up and out again after: a tab opened or
           closed changes the row's width without changing the bar's */
        var otr=$('#open-tabs-row'); if(otr) qro.observe(otr);
      }
      /* T602: and the tab strip's contents -- Style and Object come and
         go with the selection, and a layout rebuilds the tabs, without
         the strip's box changing. Its own rung classes are ignored, or
         each fit would schedule the next. */
      var ts=$('#rbn-tabs');
      if(ts&&window.MutationObserver) new MutationObserver(function(ms){
        if(deckEl.hidden) return;
        for(var i=0;i<ms.length;i++)
          if(ms[i].target!==ts){scheduleQatFit();return;}
      }).observe(ts,{subtree:true,childList:true,attributes:true,
        attributeFilter:['hidden','class']});
    }
    /* The rulers are drawn at the slide's CURRENT position, so anything
       that moves the slide has to redraw them. The ribbon observer above
       does not see the docked panel opening, closing or being dragged
       wider — and that is exactly the slide case, where the panel appears
       after the rulers are first placed and leaves them stranded to the
       left of the page they are supposed to measure (2026-08-07, user:
       "ruler in slides is bugged"). Watching the STAGE catches all of it. */
    if(window.ResizeObserver&&stage){
      new ResizeObserver(function(){
        if(deckEl.hidden) return;
        scheduleGuidesFit();
      }).observe(stage);
    }
    /* a fit measured against the fallback font sticks, because the bar's
       box never changes when the real font finally arrives -- and every
       length the fit remembers was measured in the old one, so it forgets
       them (ribbonFitForget) */
    try{
      if(document.fonts&&document.fonts.ready)
        document.fonts.ready.then(function(){
          ribbonFitForget();
          if(!deckEl.hidden){fitEditRibbon();fitQat();}});
      /* T487: .ready settles ONCE, for the batch in flight at boot; a
         face that arrives later (the bar's mono, first used when the
         deck opens) widened the thin bar 16px past its box at 1300px
         and nothing re-judged it until the next window resize.
         MathJax's own faces (MJX*) arrive all through a reading session
         as equations are typeset and never set a word on the ribbon, so
         they leave its memory alone. */
      if(document.fonts&&document.fonts.addEventListener)
        document.fonts.addEventListener('loadingdone',function(e){
          var faces=(e&&e.fontfaces)||[];
          var math=faces.length&&[].every.call(faces,function(f){
            return /^["']?MJX/i.test(String(f.family||''));});
          if(!math) ribbonFitForget();
          if(!deckEl.hidden){fitEditRibbon();fitQat();}});
    }catch(e){}
    /* trackpad pinch (and ctrl+scroll) zooms the PAGE, not the browser:
       a Windows precision-trackpad pinch arrives as a wheel event with
       ctrlKey=true (macOS Chrome reports the same; meta accepted to
       match the editor's other shortcuts). The point under the cursor
       stays put: measure the slide before and after, then correct the
       stage scroll — rect math survives the margin:auto centring and
       the .zoomed overflow flip without reproducing either. */
    stage.addEventListener('wheel',function(e){
      if(!(e.ctrlKey||e.metaKey)||mode!=='edit'||deckEl.hidden) return;
      e.preventDefault();
      var slideEl=stage.querySelector('.slide'); if(!slideEl) return;
      var r=slideEl.getBoundingClientRect();
      if(!r.width||!r.height) return;
      var fx=(e.clientX-r.left)/r.width,
          fy=(e.clientY-r.top)/r.height;
      var z=Math.min(6,Math.max(0.25,
        (deckZoom||1)*Math.exp(-e.deltaY*0.002)));
      setZoom(z);
      /* setZoom is synchronous: .zoomed (overflow:auto) is already on
         when these scroll writes land */
      var nr=slideEl.getBoundingClientRect();
      stage.scrollLeft+=(nr.left+fx*nr.width)-e.clientX;
      stage.scrollTop+=(nr.top+fy*nr.height)-e.clientY;
    },{passive:false});
    /* over the rest of the open editor (ribbon, film strip, panes) a
       pinch must not browser-zoom the whole app either — swallow it,
       without zooming the page */
    deckEl.addEventListener('wheel',function(e){
      if((e.ctrlKey||e.metaKey)&&!deckEl.hidden) e.preventDefault();
    },{passive:false});
  })();
  (function(){
    var ps=$('#page-strip');
    if(!ps) return;
    /* TILES, drawn at their own proportion (T190): a 16:9 slide is a
       wide box, an A4 portrait a tall one, so the row reads without
       reading. The one in use is lit by applyPage. */
    PAGE_PRESETS.forEach(function(pg){
      var o=document.createElement('button');
      o.className='fx-tile page-tile';o.type='button';
      o.dataset.page=pg.id;
      var ic=document.createElement('span');ic.className='page-ico';
      var k=Math.min(26/pg.aw,18/pg.ah);
      ic.style.width=Math.max(8,Math.round(pg.aw*k))+'px';
      ic.style.height=Math.max(8,Math.round(pg.ah*k))+'px';
      o.appendChild(ic);
      var t=document.createElement('span');
      t.textContent=pg.label.replace(/^Poster\s+/,'').replace(/^Slides\s+/,'');
      o.appendChild(t);
      o.title=pg.label+' \u00b7 '+pg.mm[0]+'\u00d7'+pg.mm[1]+' mm';
      o.addEventListener('click',function(e){
        e.stopPropagation();
        if(pg.id==='16x9') delete pres.page; else pres.page=pg.id;
        /* T278: the scale was the poster sheet's; a slide page takes
           the built-in ladder back */
        if(!pg.poster) delete pres.scale;
        deckZoom=0;
        markDirty();applyPage();refresh();
        /* Changing the page can change WHERE the File controls belong: a
           poster hides the panel they live in, so without re-homing them
           they would disappear with it. Re-run the placement, then the
           bar re-decides whether it has earned its row. */
        syncTopBar();
        /* switching to a portrait poster moves the toolbar to the side
           (unless you have already chosen otherwise) */
        applySideRibbon();
        /* T498: applyPage just hid (or showed) the Animation tab's
           chooser frames by page kind, and a group is hidden by
           syncRibbonGroups once nothing in it shows -- which only the
           format pass runs. Without this the Effect door stood over an
           empty shelf until the next selection. The undo path (10-decks)
           already ends the same way. */
        if(typeof showFmt==='function') showFmt();
      });
      ps.appendChild(o);
    });
  })();
  /* ---- Objects pane (layers v1): list / select / hide / lock ---- */
  function annotLabel(a){
    if(a.k==='cell'){
      var it=a.ref?resolveRef(a.ref):null;
      return it?it.title:'Empty frame';
    }
    if(a.k==='text')
      return 'Text — '+(String(a.text||'').trim().slice(0,26)||'(empty)');
    /* a name you gave it wins over the kind we guessed. Twelve rows
       saying "Shape - box" is a list you cannot navigate (2026-08-20,
       user: "also be able to rename layers") */
    if(a.name) return a.name;
    if(a.k==='image') return 'Image';
    if(a.k==='video') return mediaLabel(a);
    if(a.k==='web') return 'Web page \u2014 '+webHost(a.url);
    if(a.k==='flip'){
      var nf=flipFrames(a).length;
      return 'Flip book \u2014 '+(nf?(nf+' figure'+(nf===1?'':'s')):'empty');
    }
    if(a.k==='table')
      return 'Table '+((a.rows||[]).length)+'\u00d7'
        +(((a.rows||[])[0]||[]).length);
    if(a.k==='arrow') return a.nohead?'Line':'Arrow';
    if(a.k==='chart')
      return 'Chart \u2014 '+(a.ct||'bar')+', '
        +((a.series||[]).length)+' series';
    if(a.k==='draw') return 'Drawing';
    if(a.k==='rect') return 'Shape — '+(a.shape||'box');
    return a.k;
  }
  /* ---- THE ONE OWNER OF INSPECTOR PANES (T136 / JVUX-03) ------------
     "One pane open at a time" was a comment, not a mechanism: every
     show function carried its own hand-list of siblings to hide, the
     lists diverged (Standardise forgot tidypane, Objects hid nothing
     at all), and Tidy + Check stood open together in the live DOM.
     The registry below is the mechanism. paneShow(id) hides every
     other pane, paneHide(id) closes one, and BOTH re-derive each
     registered trigger's aria-pressed from the DOM -- no feature
     enumerates sibling selectors again, so a new pane cannot fork the
     list a tenth time. */
  var PANE_IDS=['selpane','animpane','verpane','notespane','preflight',
    'imgpane','mediapane','chartpane','tablepane','citepane',
    'stdpane','tidypane','flippane','provpane','sizepane','objhist',
    'reviewpane','a11ypane','compane'];
  var PANE_BTN={selpane:'#objects-btn',animpane:'#vw-anim',
    imgpane:'#hm-images',citepane:'#dsg-cites',   /* T469: Citations too */
    notespane:'#notes-btn',reviewpane:'#vw-check',stdpane:'#dsg-std',
    compane:'#comments-btn'};   /* T563 */
  function paneSyncBtns(){
    Object.keys(PANE_BTN).forEach(function(p){
      var b=$(PANE_BTN[p]); if(!b) return;
      var el=$('#'+p);
      b.setAttribute('aria-pressed',(!!el&&!el.hidden).toString());
    });
    /* the Versions strip button repaints itself from the pane state */
    if(typeof syncStripBtn==='function') syncStripBtn();
  }
  function paneShow(id){
    PANE_IDS.forEach(function(p){
      if(p===id) return;
      var el=$('#'+p); if(el) el.hidden=true;
    });
    var el2=$('#'+id); if(el2) el2.hidden=false;
    paneSyncBtns();
    syncPaneDock();
  }
  function paneHide(id){
    var el=$('#'+id);
    /* ALREADY CLOSED IS NOTHING TO DO. applyPage closes the Versions
       pane on every render of a deck slide, and writing `hidden` onto a
       hidden pane is still a mutation: the observer below answered it
       with a second syncPaneDock a tick later, so every slide change
       re-fitted the page twice and re-rendered every item once more
       (2026-10-08, user: "the slide changing ... is super duper slow").
       Nothing docked or undocked, so the stage keeps its size -- unless
       the strip already disagrees with the panes: a pane left open
       through a talk still docks again on the way back to the editor,
       which this call used to do in passing. */
    if(el&&el.hidden){
      paneSyncBtns();
      if((!!dockedPane()&&mode==='edit')!==deckEl.classList.contains('pane-open'))
        syncPaneDock();
      return;
    }
    if(el) el.hidden=true;
    paneSyncBtns();
    syncPaneDock();
  }
  /* the open pane still in its default place, if any (syncPaneDock) */
  function dockedPane(){
    var docked=null;
    $$('.selpane',deckEl).forEach(function(p){
      if(!p.hidden&&p.style.right!=='auto') docked=p;});
    return docked;
  }
  /* ---- one pane open at a time, and the stage makes room for it -------
     Every pane is an .selpane in the stage wrapper. Rather than have each
     one remember to tell the stage, ask the DOM: if any is open, dock.
     Called after anything that opens or closes one. */
  function syncPaneDock(){
    /* Only a pane still in its DEFAULT place is docked. wirePane sets
       right:auto the moment you drag one, and a pane you have deliberately
       moved somewhere else is one you have chosen to float — reserving a
       strip on the right for it would leave a gap beside nothing
       (2026-08-20). Drag it back to the edge, or reopen it, to re-dock. */
    var docked=dockedPane();
    var was=paneDockState();
    /* reserve the width the pane ACTUALLY has: it is resizable, and a
       strip sized to the default would leave a widened pane over the
       page again */
    if(docked) paneWSet(Math.round(docked.offsetWidth||232)+'px');
    deckEl.classList.toggle('pane-open',!!docked&&mode==='edit');
    /* the page is fitted to the stage's width, so the stage changing size
       has to re-fit it — otherwise the slide keeps the size it had when
       the pane was closed and the pane lands on top of it after all.
       ...and ONLY then (2026-10-08, "really laggy again"): every slide
       change hides the already-hidden Versions pane, the observer below
       hears the write, and each call re-rendered every item on the slide
       twice for a stage that had not moved. What the dock does to the
       stage is the input: unchanged by this call and the same as the
       last one fitted is no change. (applyZoom does nothing while the
       deck is hidden or has no page, so neither counts as fitted.) */
    var dock=paneDockState();
    if(deckEl.hidden||!stage.querySelector('.slide')){paneDockWas=null;return;}
    if(dock===was&&dock===paneDockWas) return;
    paneDockWas=dock;
    applyZoom();
  }
  var paneDockWas=null;
  function paneDockState(){
    return [deckEl.classList.contains('pane-open'),paneWNow,mode].join('|');
  }
  /* THE PANE'S WIDTH, ON WHAT READS IT. deck.css sizes two things by
     --pane-w: the stage's right padding and a pane's own default width
     (the zoom bar's offset was a third until T619 put the bar in the tab
     row). It was written on the deck, and a custom
     property there is inherited by every element in the editor, so
     each step of dragging a pane's edge restyled all of them (2026-10-09,
     speed). Written on those two kinds of element instead, the rules
     read the same value and nothing else is touched. deck.css's
     .deck{--pane-w:272px} is still the value before the first write. */
  var paneWNow='';
  function paneWSet(v){
    if(v===paneWNow) return;
    paneWNow=v;
    $$('.deck-stage,.selpane',deckEl).forEach(function(el){
      el.style.setProperty('--pane-w',v);});
  }
  /* Five panes are opened from eight places between them, and one of them
     forgetting to dock would put us straight back to a pane covering the
     page. So WATCH the attribute instead of trusting the call sites. */
  (function(){
    if(!window.MutationObserver) return;
    var t=null;
    var ob=new MutationObserver(function(){
      clearTimeout(t);t=setTimeout(syncPaneDock,0);
    });
    $$('.selpane',deckEl).forEach(function(p){
      ob.observe(p,{attributes:true,attributeFilter:['hidden']});});
  })();
  /* every folder name in use on this slide, in the order items appear */
  function folderNames(s){
    var seen={},out=[];
    ((s&&s.annots)||[]).forEach(function(a){
      if(a&&a.fold&&!seen[a.fold]){seen[a.fold]=1;out.push(a.fold);}});
    return out;
  }
  /* THE LAYERS PANE IS ALSO THE TIMELINE (T174). Asked for directly:
     "the animations also appears in the layers ... you can hide layers
     and build animations this way". It is the right place for it --
     this pane is already open while you work, already lists everything
     on the slide, and already carries the one control (the eye) that
     decides whether a thing is seen. A build is the same question asked
     about a MOMENT rather than about the whole slide, and answering both
     in one list is what makes a swap -- this picture, then that one --
     something you can see rather than something you have to remember. */
  var spByBuild=false;
  /* THE ACTIONS MENU (T184): the pane's twelve verbs as rows of one
     popover, built on open so each row's enabling reflects the
     selection now, and opened through the one transient-menu owner so
     it closes on Escape or a click away. A row that opens a further
     chooser (Every instance, Match) anchors it to the Actions button. */
  var spActMenu=null,spActBtn=null;
  /* IT GOES WHEN ITS ANCHOR DOES (T221). The pane rebuilds its whole
     list on any change, which destroys the button this popover hangs
     under; the popover stayed, floating over the canvas anchored to a
     detached node, and the pane's own buttons stop propagation so the
     owner's outside-click never reached it (2026-09-03, user: "this
     box from the layers can never be removed"). Driven live before
     and after: By build left it standing, and does not now. */
  function closeSpActions(){
    var m=spActMenu; if(!m) return;
    spActMenu=null;spActBtn=null;
    overlayHide(m);if(m.parentNode) m.remove();
  }
  function spActionsBoot(){
    var pane=$('#selpane'); if(!pane) return;
    pane.addEventListener('click',function(e){
      if(!spActMenu) return;
      if(spActMenu.contains(e.target)) return;
      if(spActBtn&&(e.target===spActBtn
        ||(spActBtn.contains&&spActBtn.contains(e.target)))) return;
      closeSpActions();
    },true);
  }
  function openSpActions(btn,acts){
    if(spActMenu){
      var was=spActMenu; spActMenu=null;spActBtn=null;
      if(!was.hidden){overlayHide(was);was.remove();return;}
      was.remove();
    }
    var m=document.createElement('div');
    m.className='sh-menu opt-panel opt-list sp-actions';
    acts.forEach(function(x){
      if(x.label==='-'){menuHead(m,x.title);return;}
      var b=document.createElement('button');
      b.type='button';b.className='dbtn vw-opt';
      b.innerHTML=x.label;b.title=x.title;b.disabled=!x.on;
      b.addEventListener('click',function(e){
        e.stopPropagation();
        overlayHide(m);
        x.fn(btn);
      });
      m.appendChild(b);
    });
    /* inside the editor's layer, like every other runtime menu (T213) */
    ((typeof deckEl!=='undefined'&&deckEl)||document.body).appendChild(m);
    spActMenu=m;spActBtn=btn;
    overlayShow(btn,m);floatMenu(btn,m);
  }
  function renderSelPane(){
    var pane=$('#selpane'),list=$('#selpane-list');
    if(!pane||pane.hidden||!list) return;
    closeSpActions();          /* its anchor is about to be destroyed */
    list.innerHTML='';
    var s=pres.slides[cur];
    var ann=(s&&s.annots)||[];
    if(!ann.length){
      list.innerHTML='<div class="selpane-empty">Nothing on this '
        +'slide yet.</div>';
      return;
    }
    /* handlers resolve the CURRENT slide's annot at event time (never a
       closure) — the pane can't mutate or repaint a stale slide */
    function liveAnnot(i){
      var s2=pres.slides[cur];
      return (s2&&s2.annots||[])[i]||null;
    }
    /* THREE STATES, ONE BUTTON: not locked -> position -> fully -> not
       locked. Two locks are what people mean (see the LOCKS section), and
       a second button for the rarer one would cost this narrow row a
       quarter of its width. The tooltip names the state it is IN and
       what the click does next, because a cycling button that only says
       one of the two is a guessing game. */
    function cycleLock(i){
      var a2=liveAnnot(i);
      if(!a2){renderSelPane();return;}
      var m=lockMode(a2);
      if(m==='') a2.lock='pos';
      else if(m==='pos') a2.lock=1;
      else delete a2.lock;
      markDirty();
      var l=stage.querySelector('.annot-layer');
      if(l){renderAnnots(l,pres.slides[cur]);paintSel(l);}
      renderSelPane();
      if(typeof showFmt==='function') showFmt();   /* T481: the ribbon's readout */
    }
    function toggleFlag(i,flag){
      var a2=liveAnnot(i);
      if(!a2){renderSelPane();return;}
      if(a2[flag]) delete a2[flag]; else a2[flag]=1;
      markDirty();
      var l=stage.querySelector('.annot-layer');
      /* T481: A HIDDEN THING IS NOT SELECTED. The contextual bar stayed
         up for an object no longer on the canvas, and Duplicate made a
         hidden copy (2026-09-15 review). */
      if(flag==='hide'&&a2.hide&&selSet.indexOf(i)>=0){
        selSet=selSet.filter(function(x){return x!==i;});
        selAnnot=selSet.length?selSet[0]:null;
        if(l){renderAnnots(l,pres.slides[cur]);paintSel(l);}
        if(typeof showFmt==='function') showFmt();
        renderSelPane();
        return;
      }
      if(l){renderAnnots(l,pres.slides[cur]);paintSel(l);}
      renderSelPane();
    }
    function rowEl(a,i){
      var r=document.createElement('div');
      r.className='sp-row'+(selSet.indexOf(i)>=0?' sel':'')
        +(a.hide?' offrow':'');
      var k=document.createElement('span');
      k.className='sp-kind k-'+a.k;r.appendChild(k);
      var t=document.createElement('span');t.className='sp-t';
      t.textContent=annotLabel(a);
      t.title=t.textContent+' \u2014 double-click to rename';
      /* double-click to rename, the way the group folders above already
         work. Clearing it puts the kind-derived name back rather than
         leaving a blank row. */
      t.addEventListener('dblclick',function(e){
        e.stopPropagation();
        var inp=document.createElement('input');
        inp.className='sp-rename';inp.type='text';
        inp.value=(liveAnnot(i)||{}).name||'';
        inp.placeholder=annotLabel(a);
        t.replaceWith(inp);inp.focus();inp.select();
        var done=false;
        function commit(ok){
          if(done) return; done=true;
          var a3=liveAnnot(i);
          if(ok&&a3){
            var v=inp.value.trim();
            if(v) a3.name=v; else delete a3.name;
            markDirty();
          }
          renderSelPane();
        }
        inp.addEventListener('blur',function(){commit(true);});
        inp.addEventListener('keydown',function(e2){
          e2.stopPropagation();
          if(e2.key==='Enter'){e2.preventDefault();commit(true);}
          else if(e2.key==='Escape'){e2.preventDefault();commit(false);}
        });
      });
      r.appendChild(t);
      var eye=document.createElement('button');
      eye.className='sp-act'+(a.hide?' on':'');eye.type='button';
      eye.innerHTML=bic('eye');
      /* T404: hidden means hidden -- from the editor, the show, the PDF
         and the PowerPoint alike. It is how you keep a spare on a slide. */
      eye.title=a.hide?'Show it again'
        :'Hide it: not shown while editing, presenting or in exports';
      eye.setAttribute('aria-label',a.hide?'Show':'Hide');
      eye.addEventListener('click',function(e){
        e.stopPropagation();toggleFlag(i,'hide');});
      r.appendChild(eye);
      var lm=lockMode(a);
      var lk=document.createElement('button');
      lk.className='sp-act'+(lm?' on':'')+(lm==='pos'?' half':'');
      lk.type='button';
      lk.innerHTML=bic(lm==='pos'?'pin':'lock');
      lk.title=lm===''
        ? 'Not locked. Click to pin its position — still yours to '
          +'select, resize and restyle'
        : lm==='pos'
        ? 'Position locked. Click to lock it fully — no clicking or '
          +'dragging on the canvas'
        : 'Fully locked. Click to unlock';
      lk.setAttribute('aria-label',
        lm===''?'Lock position':lm==='pos'?'Lock fully':'Unlock');
      lk.addEventListener('click',function(e){
        e.stopPropagation();cycleLock(i);});
      r.appendChild(lk);
      /* THE BUILD, ON THE ROW. A number you can read down the list --
         which click this arrives on -- and, when it has one, the click
         it leaves on after an arrow. A dot means "on the slide from the
         start", which is what nearly everything is. Clicking it opens
         the one popover that sets both ends. */
      var inf=spStepInfo(s,a);
      var bg=document.createElement('button');
      bg.className='sp-step'+(inf.n!=null?' on':'')
        +(inf.tie?' tied':'');
      bg.type='button';
      var lab=(inf.n!=null?String(inf.n):'\u00b7')
        +(inf.out!=null?('\u2192'+inf.out):'');
      /* the icon is trusted bic()/fxIcon() markup; the number is a
         number this function computed, never anything typed */
      bg.innerHTML=(inf.tie?bic('flipbook')
        :(inf.type?fxIcon(inf.type):bic('none')))
        +'<span class="sp-stepn">'+lab+'</span>';
      bg.title=spStepTitle(inf);
      bg.setAttribute('aria-label',bg.title);
      bg.addEventListener('click',function(e){
        e.stopPropagation();
        var l3=stage.querySelector('.annot-layer');
        if(l3) selectAnnot(l3,i,false);
        renderSelPane();
        openStepMenu(i,e.currentTarget);
      });
      r.appendChild(bg);
      r.addEventListener('click',function(ev){
        if(!liveAnnot(i)){renderSelPane();return;}
        var l=stage.querySelector('.annot-layer');
        /* ctrl-click builds a multi-selection right in the pane, which
           is what makes Group up in the toolbar reachable from here */
        if(l) selectAnnot(l,i,ev.ctrlKey||ev.metaKey);
        renderSelPane();
      });
      return r;
    }
    /* pane header actions: group/ungroup/duplicate act on the pane's
       selection, so organising happens where you are looking
       (2026-08-18, user: "create folders and group things ...
       duplicate") */
    /* ---- THE BAR, KEPT TO THREE (T184) -------------------------------
       Twelve tool buttons in two wrapping rows stood between the heading
       and the list, so the pane read as a toolbar with a list under it
       (2026-09-02, user: "really packed, confusing to look at"). The
       LIST is the pane. Three things earn a seat above it: the view
       toggle, the pointing mode, and one door to everything else. Every
       action keeps its function and its enabling rule -- only the room
       it takes has changed. */
    var bar2=document.createElement('div');bar2.className='sp-tools';
    var selN=selSet.filter(function(i){return typeof i==='number';});
    function tool(label,title,on,fn){
      var b=document.createElement('button');
      /* innerHTML: the labels are fixed strings written just below,
         carrying bic() icons before their words */
      b.className='dbtn sp-tool';b.innerHTML=label;b.title=title;
      b.disabled=!on;
      b.addEventListener('click',function(e){e.stopPropagation();fn(b);});
      bar2.appendChild(b);
      return b;
    }
    /* THE TIMELINE VIEW. Layers is stacking order, which is the right
       default -- it is what the pane is for. But once every row carries
       a build number, the same list read in PLAYBACK order is the
       animation pane's job done in the place you were already looking,
       so it is a toggle rather than a fourth panel to keep in step. */
    tool(bic(spByBuild?'objects':'play')
      +(spByBuild?' By layer':' By build'),
      spByBuild
        ? 'Back to stacking order — what is in front of what'
        : 'Read the slide in playback order instead, one heading per '
          +'click',
      true,
      function(){spByBuild=!spByBuild;renderSelPane();});
    /* the click-everything mode, reachable from the list of the things
       you would be clicking */
    tool(bic('appear')+' Quick animate',
      'Click your objects in the order you want them to arrive, then '
      +'Finish — the same mode as the Animation tab’s',
      ann.length>=1&&typeof seqArmStart==='function',
      function(){seqArmStart();});
    /* everything else, as rows of one menu. A heading row (label '-')
       separates arranging what is here from doing it again elsewhere
       (T89's reuse verbs). */
    var acts=[];
    function act(label,title,on,fn){
      acts.push({label:label,title:title,on:on,fn:fn});}
    act('Group','Group the selected items (Ctrl+G)',selN.length>=2,
      function(){groupSel();renderSelPane();});
    var inGrp=typeof selAnnot==='number'&&ann[selAnnot]
      &&ann[selAnnot].grp!=null;
    act('Ungroup','Ungroup (Ctrl+Shift+G)',inGrp,
      function(){ungroupSel();renderSelPane();});
    act(bic('copy')+' Duplicate','Duplicate the selected items',
      selN.length>=1,
      function(){dupAnnots(selN);});
    /* A FOLDER IS NOT A GROUP. Grouping welds items together — they move
       and format as one, which is exactly what you do NOT want from a
       filing system. Until now the only folders in this pane were groups,
       so tidying twelve items into three folders also made three rigid
       blocks (2026-08-20, user: "there needs to be folders in the objects
       thing").
       A folder is just a name on the items in it: a.fold. Nothing about
       selection, movement or formatting changes. */
    act(bic('frame')+' New folder','Put the selected items in a named '
      +'folder — filing only, they are NOT grouped',selN.length>=1,
      function(){
        askText({title:'New folder',label:'Call this folder',
          value:'Folder '+(folderNames(s).length+1),ok:'File them'},
        function(nm){
        if(nm===null) return;
        nm=nm.trim(); if(!nm) return;
        selN.forEach(function(i){if(s.annots[i]) s.annots[i].fold=nm;});
        markDirty();renderSelPane();
        toast(selN.length+' item'+(selN.length===1?'':'s')+' filed under '
          +'“'+nm+'”');
        });
      });
    act(bic('exit')+' Out of folder','Take the selected items out of '
      +'their folder',
      selN.some(function(i){return s.annots[i]&&s.annots[i].fold;}),
      function(){
        selN.forEach(function(i){
          if(s.annots[i]) delete s.annots[i].fold;});
        markDirty();renderSelPane();
      });
    /* ---- REUSE, WHERE YOU ARE ALREADY LOOKING (T89) ------------------
       Five features shipped, worked, and could be reached only from a
       canvas right-click or from three clicks into the contextual
       Object tab: components, the per-object history, the provenance
       pane, and the two point-at-it matching verbs. Every row calls
       the same function its right-click row calls, and each one is
       disabled rather than lying when the selection cannot answer it. */
    act('-','reuse what is selected',true,null);
    /* the PRIMARY selection, the same subject the ribbon and the two
       inspector panes take — a group's last array member is not
       necessarily the item you clicked */
    var prim=(typeof selAnnot==='number')?ann[selAnnot]:null;
    var primInst=(prim&&prim.cmp&&prim.cinst)?prim:null;
    act(bic('group')+' Make clones\u2026',
      'Make the selected items a set of clones: same look, same place '
      +'on every slide, or both. Each copy keeps its own words and '
      +'its own figure',selN.length>=1&&!primInst,
      function(b){cmpMakeMenu(b,selN);});   /* T409 */
    act(bic('plus')+' Add a clone\u2026',
      'Another one here, on every slide, or on every slide after this '
      +'one \u2014 and what the clones share',!!primInst,
      function(b){cmpAddMenu(b,primInst);});
    act(bic('locate')+' Its clones',   /* T420: one name everywhere */
      'Every place in this deck this clone has been put \u2014 pick '
      +'one to go there',!!primInst,
      function(b){cmpInstMenu(primInst.cmp,b);});
    act(bic('history')+' History',
      'Every state this object has been through that the undo stack '
      +'still remembers, and a button to put any of them back',
      !!prim,function(){showObjHist();});
    act(bic('tree')+' Where from',
      'The notebook and cell that made this figure, every cell in its '
      +'lineage, and whether the notebook has moved on since',
      !!(prim&&provRef(prim)),function(){showProvPane();});
    act(bic('swap')+' Match…',
      'Copy this look onto objects you then click, take another '
      +'object’s look for this one, or lay these out like a group '
      +'you click',selN.length>=1,function(b){matchMenuAt(b);});
    var more=tool(bic('menu')+' Actions ▾',
      'Group, duplicate, file, and reuse what is selected',true,
      function(b){openSpActions(b,acts);});
    more.setAttribute('aria-haspopup','true');
    more.setAttribute('aria-expanded','false');
    list.appendChild(bar2);
    /* IN PLAYBACK ORDER. Folders and groups are deliberately ignored
       here: they answer "what is this filed under", and this view
       answers "when does it happen". Everything with no build of its own
       is listed once at the top, under the click it is already there
       for. */
    if(spByBuild){
      var rows=spByStop(s);
      rows.forEach(function(grp){
        var h=document.createElement('div');
        h.className='hd-lab';
        h.textContent=grp.head;
        list.appendChild(h);
        if(!grp.items.length){
          var e2=document.createElement('div');
          e2.className='selpane-empty';
          e2.textContent='nothing arrives here';
          list.appendChild(e2);
          return;
        }
        grp.items.forEach(function(i3){
          var r3=rowEl(ann[i3],i3);
          if(grp.leaving.indexOf(i3)>=0) r3.classList.add('sp-leaving');
          list.appendChild(r3);
        });
      });
      return;
    }
    /* NAMED FOLDERS first — filing, not grouping. Renaming one renames
       it on every item in it, because the name IS the folder (there is no
       folder object to rename). */
    folderNames(s).forEach(function(fname){
      var fw=document.createElement('div');fw.className='sp-folder sp-fold2';
      var fi=document.createElement('span');fi.className='sp-fico';
      fi.innerHTML=bic('frame');fw.appendChild(fi);
      var fn=document.createElement('span');
      fn.className='sp-t sp-gname';fn.textContent=fname;
      fn.title=fname+' \u2014 double-click to rename this folder';
      fn.addEventListener('dblclick',function(e){
        e.stopPropagation();
        askText({title:'Rename this folder',value:fname,
          note:'Empty takes the items out of it',ok:'Rename'},
        function(nm){
        if(nm===null) return;
        nm=nm.trim();
        (s.annots||[]).forEach(function(a){
          if(a&&a.fold===fname){
            if(nm) a.fold=nm; else delete a.fold;}});
        markDirty();renderSelPane();
        });
      });
      fw.appendChild(fn);
      var fsel=document.createElement('button');
      fsel.className='sp-act';fsel.type='button';
      fsel.innerHTML=bic('locate');
      fsel.title='Select everything in this folder';
      fsel.setAttribute('aria-label','Select everything in this folder');
      fsel.addEventListener('click',function(e){
        e.stopPropagation();
        var hit=[];
        (s.annots||[]).forEach(function(a,i){
          if(a&&a.fold===fname&&!lockedAll(a)) hit.push(i);});
        if(!hit.length) return;
        selSet=hit;selAnnot=hit[hit.length-1];
        var l2=stage.querySelector('.annot-layer');
        if(l2) paintSel(l2);
        lastSelSig='';showFmt();renderSelPane();
      });
      fw.appendChild(fsel);
      list.appendChild(fw);
      (s.annots||[]).forEach(function(a,i){
        if(!a||a.fold!==fname) return;
        var r=rowEl(a,i);r.classList.add('sp-infold');
        list.appendChild(r);
      });
    });
    /* GROUPS come next, as folders: a coloured chip, a name you can
       change, and the members indented under it */
    var seen={},orderG=[];
    ann.forEach(function(a2){
      if(a2&&a2.grp!=null&&!seen[a2.grp]){
        seen[a2.grp]=1;orderG.push(a2.grp);}
    });
    orderG.forEach(function(g){
      var meta=(s.grpmeta||{})[g]||{};
      var f=document.createElement('div');f.className='sp-folder';
      var chip=document.createElement('button');
      chip.className='sp-gcol';chip.type='button';
      chip.style.background=meta.color||GRP_COLORS[0];
      chip.title='Group colour — click to change';
      chip.setAttribute('aria-label','Group colour');
      chip.addEventListener('click',function(e){
        e.stopPropagation();
        var cur2=GRP_COLORS.indexOf(meta.color||GRP_COLORS[0]);
        grpMeta(s,g).color=GRP_COLORS[(cur2+1)%GRP_COLORS.length];
        markDirty();renderSelPane();
      });
      f.appendChild(chip);
      var nm=document.createElement('span');nm.className='sp-t sp-gname';
      nm.textContent=meta.name||('Group '+g);
      nm.title='Double-click to rename';
      nm.addEventListener('dblclick',function(){
        askText({title:'Name this group',value:meta.name||('Group '+g),
          ok:'Rename'},function(v){
          if(v!=null){grpMeta(s,g).name=v.trim();markDirty();renderSelPane();}
        });
      });
      f.appendChild(nm);
      var rn=document.createElement('button');
      rn.className='sp-act';rn.type='button';rn.innerHTML=bic('pen');
      rn.title='Rename this group';
      rn.setAttribute('aria-label','Rename this group');
      rn.addEventListener('click',function(e){
        e.stopPropagation();
        askText({title:'Name this group',value:meta.name||('Group '+g),
          ok:'Rename'},function(v){
          if(v!=null){grpMeta(s,g).name=v.trim();markDirty();renderSelPane();}
        });
      });
      f.appendChild(rn);
      var dp=document.createElement('button');
      dp.className='sp-act';dp.type='button';dp.innerHTML=bic('copy');
      dp.title='Duplicate the whole group';
      dp.setAttribute('aria-label','Duplicate the whole group');
      dp.addEventListener('click',function(e){
        e.stopPropagation();
        var idxs=[];ann.forEach(function(a2,i2){
          if(a2&&a2.grp===g) idxs.push(i2);});
        dupAnnots(idxs);
      });
      f.appendChild(dp);
      f.addEventListener('click',function(){
        var l=stage.querySelector('.annot-layer');
        var first=null;
        ann.forEach(function(a2,i2){
          if(first==null&&a2&&a2.grp===g) first=i2;});
        if(l&&first!=null) selectAnnot(l,first);
        renderSelPane();
      });
      list.appendChild(f);
      for(var i2=ann.length-1;i2>=0;i2--)
        if(ann[i2]&&ann[i2].grp===g&&!ann[i2].fold){
          var r2=rowEl(ann[i2],i2);
          r2.classList.add('sp-ing');
          r2.style.borderLeftColor=meta.color||GRP_COLORS[0];
          list.appendChild(r2);
        }
    });
    /* ...and finally everything filed nowhere. An item already listed
       under a named FOLDER above must not appear twice (2026-08-20). */
    for(var i=ann.length-1;i>=0;i--)
      if(!ann[i]||(ann[i].grp==null&&!ann[i].fold))
        list.appendChild(rowEl(ann[i],i));
  }
  /* ---- WHAT THE BUILD COLUMN SAYS (T174) ---------------------------
     One reader, used by the row badge, its tooltip and the timeline
     view, so the three cannot disagree about which click something
     happens on. Stops, not build numbers: a flip book with a build of
     its own puts its frames straight after itself, so a build behind
     one sits later in the sequence than its number says. That is the
     number the space bar counts, and so it is the number to show. */
  function spStepInfo(s,a){
    var out={n:null,type:null,out:null,tie:null};
    if(!a) return out;
    var bs=slideBuildSteps(s),pl=flipPlan(s);
    function stopOf(order){
      var st=bs.map[order];
      if(st==null) return null;
      var sp=pl.stop[st];
      return ((sp==null?st:sp)|0)+1;
    }
    if(a.anim){
      out.type=a.anim.type||'fade';
      out.n=stopOf(a.anim.order||0);
    }
    var o=animOut(a);
    if(o!=null) out.out=stopOf(o);
    out.tie=tieWhat(s,a);
    /* A TIED OBJECT STILL ARRIVES ON A CLICK -- somebody else's, which
       is the whole point of a tie -- and the column has to say which
       one. A dot beside a link icon reads as "no build", and a build
       column that lies about the thing it was added for is worse than
       no column. The arithmetic is the reveal's: base + the series'
       position, so this number and the space bar agree. */
    if(out.n==null&&out.tie){
      var t2=seriesTie(a);
      if(t2){
        var ch=annotByOid(s,t2.id);
        var si=ch?chartSeriesNames(ch).indexOf(t2.at):-1;
        var bb=(si<0)?null:stepBase(s,ch);
        if(bb!=null) out.n=(bb+si)+1;
      } else if(a.fb&&a.fbf!=null){
        var bk=null;
        ((s&&s.annots)||[]).forEach(function(x){
          if(!bk&&x&&x.k==='flip'&&x.fid===a.fb) bk=x;});
        var fb=bk?stepBase(s,bk):null;
        if(fb!=null) out.n=(fb+(a.fbf|0))+1;
      }
    }
    return out;
  }
  function spStepTitle(inf){
    var t=inf.tie
      ? ('Arrives with '+inf.tie)
      : inf.n==null
      ? 'On the slide from the start'
      : ('Arrives on click '+inf.n
         +(inf.type&&inf.type!=='none'?(' \u2014 '+fxName(inf.type)):''));
    if(inf.out!=null) t+=', and goes on click '+inf.out;
    return t+'. Click to change it.';
  }
  function fxName(t){
    var hit=null;
    SEQ_FX.forEach(function(f){if(f[0]===t) hit=f[1];});
    return hit||t;
  }
  /* the slide read as a sequence: one group per stop, plus the things
     that were never given a build and are simply there */
  function spByStop(s){
    var ann=(s&&s.annots)||[];
    var bs=slideBuildSteps(s),pl=flipPlan(s);
    function stopOf(order){
      var st=bs.map[order];
      if(st==null) return null;
      var sp=pl.stop[st];
      return (sp==null?st:sp)|0;
    }
    var n=Math.max(1,pl.count);
    var groups=[];
    var start=[];
    ann.forEach(function(a,i){if(a&&!a.anim) start.push(i);});
    groups.push({head:'on the slide to begin with',items:start,
      leaving:[]});
    for(var k=0;k<n;k++){
      var items=[],leaving=[];
      ann.forEach(function(a,i){
        if(!a) return;
        if(a.anim&&stopOf(a.anim.order||0)===k) items.push(i);
        var o=animOut(a);
        if(o!=null&&stopOf(o)===k&&items.indexOf(i)<0){
          items.push(i);leaving.push(i);}
      });
      groups.push({head:'click '+(k+1),items:items,leaving:leaving});
    }
    return groups;
  }
  /* ---- ONE POPOVER, BOTH ENDS OF A BUILD ---------------------------
     Borrowed wholesale from the series-tie panel (T173): a floating
     .canvas-menu of rows that RE-RENDERS rather than closing, because
     "arrives on a click" and "goes on a click" are two answers to one
     question and a menu that shut after the first would make a swap a
     two-visit job.
     It is not the ribbon's effect gallery. That one is about the
     SELECTION and lives beside its button; this one is about the row
     you clicked and has to stand next to it. */
  function spStepClose(){
    var p=$('#step-menu'); if(p) p.remove();
  }
  function openStepMenu(idx,atEl){
    spStepClose();
    var s=pres.slides[cur];
    var a=s&&(s.annots||[])[idx];
    if(!a) return;
    var m=document.createElement('div');
    m.className='sh-menu canvas-menu';m.id='step-menu';
    function rowIn(label,fn,title,icon,on){
      var b=document.createElement('button');
      b.className='dbtn vw-opt'+(on?' on':'');
      if(icon) b.innerHTML=icon+' ';
      b.appendChild(document.createTextNode(label));
      if(title) b.title=title;
      b.setAttribute('role','menuitem');
      b.addEventListener('click',function(e){e.stopPropagation();fn();});
      m.appendChild(b);
      return b;
    }
    function commit(){
      markDirty();renderSlide();renderFilm();
      if(typeof animPaneSync==='function') animPaneSync();
      renderSelPane();build();
    }
    function live(){return (pres.slides[cur].annots||[])[idx]||{};}
    function build(){
      m.innerHTML='';
      var a2=live();
      menuHead(m,'\u201c'+String(annotLabel(a2)).slice(0,24)+'\u201d arrives');
      var tie=tieWhat(pres.slides[cur],a2);
      if(tie){
        /* a tied object's moment is not this menu's to set -- saying so
           beats offering rows that would silently fight the tie */
        var note=document.createElement('div');
        note.className='selpane-empty';
        note.textContent='with '+tie+'. Change that from its own '
          +'right-click menu.';
        m.appendChild(note);
      } else {
        SEQ_FX.forEach(function(f){
          var isNow=(f[0]==='none')?!a2.anim
            :!!(a2.anim&&(a2.anim.type||'fade')===f[0]);
          rowIn(f[0]==='none'?'On the slide from the start':f[1],
            function(){
              var a3=live();
              if(f[0]==='none'){delete a3.anim;}
              else {
                a3.anim=a3.anim||{order:nextAnimOrder(pres.slides[cur])};
                a3.anim.type=f[0];
              }
              commit();
            },
            f[0]==='none'
              ?'No build of its own \u2014 it is there when the slide is'
              :('Arrives on its own click, '+f[1].toLowerCase()),
            fxIcon(f[0]),isNow);
        });
      }
      var a4=live();
      /* offered even when the object has no build of its own: "simply
         there, then gone" is the commonest half of a swap */
      if(!animSeq(pres.slides[cur]).length&&!animOut(a4)) return;
      menuHead(m,'and then');
      var nowOut=animOut(a4);
      rowIn('Stays on the slide',function(){
        delete live().out;
        commit();
      },'What every object did before this existed',bic('none'),
        nowOut==null);
      /* T577: every click something arrives on, bullets included */
      var s4=pres.slides[cur],ac=arrivalClicks(s4,idx,'out'),hit=false;
      var pl4=flipPlan(s4);
      ac.list.forEach(function(x){
        if(ac.now===x.c) hit=true;
        var n4=pl4.stop[x.c]; if(n4==null) n4=x.c;
        rowIn('Goes when '+x.who.slice(0,34)+' arrives',function(){
          claimSet(s4,ac.tl,idx,'out',x.c);
          commit();
        },'One click: that arrives, this goes \u2014 which is what '
          +'replacing a picture actually is (click '+(n4+1)+')',
          bic('exit'),ac.now===x.c);
      });
      rowIn('Goes on one more click at the end',function(){
        claimSet(s4,ac.tl,idx,'out',null);
        commit();
      },'Adds a click of its own, on which this object leaves and '
        +'nothing arrives',bic('exit'),
        nowOut!=null&&!hit);
    }
    build();
    deckEl.appendChild(m);
    overlayShow(atEl,m);
    floatMenu(atEl,m);
  }
  var GRP_COLORS=['#39a9c0','#ff6b57','#f0a848','#46a892','#a07be0',
    '#8ba0b2'];
  function grpMeta(s,g){
    s.grpmeta=s.grpmeta||{};
    return s.grpmeta[g]=s.grpmeta[g]||{};
  }
  /* the pane's own Duplicate. Same clone (see the CLONES section), a
     tighter offset because these rows are read side by side with the
     canvas. cloneAnnots itself gives a copied group one fresh id and
     copies its name/colour; doing that again here used to leave orphaned
     grpmeta behind. A locked item IS cloned here -- the pane is the one
     door to locked items, and refusing from inside it would leave no
     door at all. */
  function dupAnnots(idxs){
    var s=pres.slides[cur]; if(!s||!s.annots) return;
    var added=cloneAnnots(idxs,2,2);
    if(!added.length) return;
    markDirty();
    var l=stage.querySelector('.annot-layer');
    /* the WHOLE batch, the way Ctrl+D leaves it. Selecting the last copy
       alone meant duplicating five rows from the pane and then having to
       re-select four of them to move the copies anywhere (2026-08-26
       audit, T57). */
    if(l){renderAnnots(l,s);selectMany(l,added);}
    renderSelPane();
  }
  /* ---- panes are yours to place: drag by the header, resize by the
     corner, and both are remembered per pane across sessions
     (2026-08-18, user: "detach them and drag them around and re-size —
     this then gets remembered for when you re-open"). ---- */
  var PANE_KEY='jv-panes';
  function paneStore(){
    try{return JSON.parse(lsGet(PANE_KEY)||'{}');}catch(e){return {};}
  }
  function paneSave(id,box){
    var st=paneStore();st[id]=box;lsSet(PANE_KEY,JSON.stringify(st));
  }
  function wirePane(pane){
    if(!pane||pane._wired) return;pane._wired=1;
    var id=pane.id,h=pane.querySelector('.selpane-h');
    /* A HANDLE YOU CAN SEE (T184). The native corner grip is a few grey
       pixels on a dark pane, and a docked pane grows LEFT from its right
       edge -- so "can't be resized" was the honest reading (2026-09-02,
       user). This is a full-height strip down the left edge: drag it and
       the width follows; a pane you have floated moves its left edge.
       The ResizeObserver below remembers the result, as it does for the
       corner. */
    if(!pane.querySelector('.selpane-grip')){
      var grip=document.createElement('div');
      grip.className='selpane-grip';grip.title='Drag to resize';
      grip.addEventListener('pointerdown',function(ev){
        ev.preventDefault();ev.stopPropagation();
        var r0=pane.getBoundingClientRect(),right=r0.right;
        var hostR=pane.offsetParent
          ?pane.offsetParent.getBoundingClientRect():{left:0};
        var floating=(pane.style.right==='auto');
        function mv(e2){
          var w=Math.max(190,Math.min(window.innerWidth-40,
            right-e2.clientX));
          pane.style.width=w+'px';
          if(floating) pane.style.left=(right-w-hostR.left)+'px';
        }
        function up(){
          document.removeEventListener('pointermove',mv);
          document.removeEventListener('pointerup',up);
          syncPaneDock();
        }
        document.addEventListener('pointermove',mv);
        document.addEventListener('pointerup',up);
      });
      pane.appendChild(grip);
    }
    /* MOVED and RESIZED are different states. A pane keeps its docked
       right/bottom anchors until you actually DRAG it; resizing it by the
       corner grip changes its size and nothing else.
       They used to be the same thing, and the ResizeObserver below fires
       the moment a pane is first shown - so every pane recorded an x/y,
       came back "moved" on the next load, and could never dock again.
       That is what stopped the docked layout working on the second visit
       (2026-08-20, found live: selpane style.right was "auto" on a pane
       nobody had touched). */
    function place(box){
      var host=pane.offsetParent;
      var hw=host?host.clientWidth:innerWidth;
      var hh=host?host.clientHeight:innerHeight;
      if(box.moved){
        /* moving is what detaches it from the edge it was docked to */
        pane.style.right='auto';pane.style.bottom='auto';
        pane.style.left=Math.max(0,Math.min(hw-80,box.x))+'px';
        pane.style.top=Math.max(0,Math.min(hh-60,box.y))+'px';
      }
      if(box.w) pane.style.width=Math.min(hw,box.w)+'px';
      if(box.h) pane.style.height=Math.min(hh,box.h)+'px';
    }
    var saved=paneStore()[id];
    if(saved) place(saved);
    if(h){
      h.style.cursor='move';
      h.addEventListener('pointerdown',function(ev){
        if(ev.target.closest('button')) return;
        ev.preventDefault();
        var hostR=pane.offsetParent
          ?pane.offsetParent.getBoundingClientRect()
          :{left:0,top:0};   /* a fixed pane drags in viewport space */
        var r=pane.getBoundingClientRect();
        var dx=ev.clientX-r.left,dy=ev.clientY-r.top;
        /* T468: THE HEIGHT SURVIVES THE DRAG. A docked pane is sized by
           its top and bottom anchors; the first move sets bottom:auto
           and the pane collapsed to its content -- 629px to 240px on
           the first pixel of a drag (2026-09-15 review). Its measured
           height is written first. */
        if(!pane.style.height) pane.style.height=Math.round(r.height)+'px';
        function mv(e2){
          place({moved:1,x:e2.clientX-hostR.left-dx,
            y:e2.clientY-hostR.top-dy});
        }
        function up(e2){
          document.removeEventListener('pointermove',mv);
          document.removeEventListener('pointerup',up);
          /* T468: LET GO AT THE EDGE, AND IT DOCKS. syncPaneDock's note
             promised "drag it back to the edge to re-dock" and nothing
             did it: once moved, a pane floated over the page for good.
             Within 28px of the right edge (or dropped where a docked
             pane sits) the anchors come back and `moved` is not
             written. */
          var host=pane.offsetParent,hw=host?host.clientWidth:innerWidth;
          var pr=pane.getBoundingClientRect();
          var hr=host?host.getBoundingClientRect():{left:0,top:0};
          var nearEdge=(hw-(pr.right-hr.left))<=40&&(pr.top-hr.top)<=60;
          if(nearEdge){
            pane.style.left='';pane.style.top='';pane.style.right='';
            pane.style.bottom='';pane.style.height='';
            paneSave(id,{w:pane.offsetWidth});   /* the dock sizes its height */
            syncPaneDock();
            return;
          }
          /* `moved` is set HERE and only here: a drag is the one gesture
             that means "I want this somewhere else" */
          paneSave(id,{moved:1,x:pane.offsetLeft,y:pane.offsetTop,
            w:pane.offsetWidth,h:pane.offsetHeight});
          syncPaneDock();
        }
        document.addEventListener('pointermove',mv);
        document.addEventListener('pointerup',up);
      });
    }
    /* the native resize grip changes width/height; remember those too -
       and ONLY those, so a resize never counts as a move */
    if(window.ResizeObserver) new ResizeObserver(function(){
      if(pane.hidden||!pane.offsetParent) return;
      var st=paneStore()[id]||{};
      if(Math.abs((st.w||0)-pane.offsetWidth)<3
        &&Math.abs((st.h||0)-pane.offsetHeight)<3) return;
      st.w=pane.offsetWidth;st.h=pane.offsetHeight;
      paneSave(id,st);
      /* a widened pane needs a wider strip reserved for it - but NOT from
         inside the observer callback: syncPaneDock re-fits the page, the
         page reflows, and the browser reports "ResizeObserver loop
         completed with undelivered notifications" (seen live 2026-08-20).
         One frame later is outside the loop and looks identical. */
      if(!st.moved) requestAnimationFrame(syncPaneDock);
    }).observe(pane);
  }
  /* T465: PANE_IDS is the list -- this one named 'varspane', which no
     longer exists, and not 'reviewpane', so the Review pane was the
     one inspector you could not drag or resize (2026-09-15 review). */
  PANE_IDS.forEach(function(id){wirePane(document.getElementById(id));});
  (function(){
    var ob=$('#objects-btn'),pane=$('#selpane'),cl=$('#selpane-close');
    if(!ob||!pane) return;
    function set(open){
      if(open){paneShow('selpane');renderSelPane();}
      else paneHide('selpane');
    }
    ob.addEventListener('click',function(){set(pane.hidden);});
    if(cl) cl.addEventListener('click',function(){set(false);});
  })();
  (function(){
    var lb=$('#lay-btn'),lm=$('#lay-menu'),ld=$('#lay-drop');
    if(!lb||!lm) return;
    lb.addEventListener('click',function(e){
      e.stopPropagation();
      if(lm.hidden){
        /* this menu is 442px wide; opened from a toolbar standing on
           the right-hand edge it ran straight off the screen
           (2026-08-07, user). floatMenu clamps it into the viewport. */
        overlayShow(lb,lm);floatMenu(lb,lm);
      } else overlayHide(lm);
    });
  })();
  function slideCells(s){
    return (s&&s.annots||[]).map(function(a,i){return {a:a,i:i};})
      .filter(function(p){return p.a.k==='cell';});
  }
