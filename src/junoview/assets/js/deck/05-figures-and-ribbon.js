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
      body=el?el.querySelector('.cardbody'):embBody(a.ref);
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
  function stdInk(){
    return pageIsLight((pres&&pres.pageBg)||'#0b141d')?'#0b141d':'#ffffff';
  }
  function stdSize(a){return (a&&a.size)||2.6;}
  function stdCol(a){return (a&&a.color)||stdInk();}
  /* two numbers, because "a different colour" is true in two ways and one
     distance hides one behind the other */
  function colDrift(c1,c2){
    var a=rgbOf(c1),b=rgbOf(c2);
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
    var left=styleOrder();
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
     or a ninth style property would silently stop being noticed. */
  var STYLE_FIELDS=['size','b','i','font','color','align','lh','pspace'];
  function stdMatchesStyle(a,d){
    if(Math.max(stdSize(a),d.size)/Math.min(stdSize(a),d.size)
      >STD_SIZE_TOL) return false;
    if(!!a.b!==!!d.b||!!a.i!==!!d.i) return false;
    if((a.font||'')!==(d.font||'')) return false;
    if(colDrift(stdCol(a),d.color||stdInk())) return false;
    if((a.align||'')!==(d.align||'')) return false;
    if(Math.abs((a.lh||0)-(d.lh||0))>0.02) return false;
    if(Math.abs((a.pspace||0)-(d.pspace||0))>0.02) return false;
    return true;
  }
  function stdBandWhy(b,d,inner){
    if(inner.length)
      return inner.length===1
        ?('Their '+inner[0].prop.label+' does not agree: '
          +inner[0].odd.length+' of '+b.boxes.length+' differ.')
        :('Their '+inner[0].prop.label+' and '+(inner.length-1)+' other '
          +'thing'+(inner.length===2?'':'s')+' do not agree.');
    return 'They already match each other. Calling them '+d.label
      +' means changing them all later is one edit instead of '
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
        head:odd.length+' of '+list.length+' '+d.label+' boxes have '
          +'drifted',
        why:'They wear the '+d.label+' style but have been changed by '
          +'hand since. Re-applying the style puts them back.'});
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
          +' pt'+(inner.length?(' — '+inner[0].odd.length
            +' do not match'):' wear no style'),
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
    return {findings:out,boxes:boxes.length,bands:bands,
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
     ['lh',0],['pspace',0]].forEach(function(pr){
      var m=stdMode(band.boxes,function(p){
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
      else if(pr.k==='color') a.color=inner.mode;
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
  function stdRow(f){
    var box=document.createElement('div');
    box.className='std-find std-'+f.sev;
    var h=document.createElement('div');
    h.className='std-h';h.textContent=f.head;box.appendChild(h);
    var w=document.createElement('div');
    w.className='std-why';w.textContent=f.why;box.appendChild(w);
    var who=document.createElement('div');who.className='std-who';
    (f.g?f.g.odd:(f.odd||f.list)).slice(0,12).forEach(function(p){
      var c=document.createElement('button');
      c.className='std-chip';
      c.textContent=(p.si+1)+' · '
        +(p.fixed?(p.ai==='t'?'title':'subtitle'):annotLabel(p.a));
      c.title='Go to it';
      c.addEventListener('click',function(){
        /* go() clears the selection and re-renders, so the layer this box
           lives on does not exist until after it returns */
        go(p.si);
        if(typeof p.ai==='number'){
          var l=stage.querySelector('.annot-layer');
          if(l) selectAnnot(l,p.ai);
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
      act.textContent='Put these '+f.odd.length+' back to '
        +styleDef(f.style).label;
      act.addEventListener('click',function(){
        stdFix(f.odd,function(a){applyStyleTo(a,f.style);},
          f.odd.length+' box'+(f.odd.length===1?'':'es')+' put back');
      });
    } else {
      act.textContent='Make all '+f.band.boxes.length+' '
        +styleDef(f.band.suggest).label;
      act.title='Names this size, and pulls the odd ones into line with '
        +'the rest. The majority do not move.';
      act.addEventListener('click',function(){stdAdopt(f.band);});
    }
    box.appendChild(act);
    if(f.kind==='band'&&f.inner&&f.inner.length){
      var alt=document.createElement('button');
      alt.className='dbtn std-do std-do2';
      alt.textContent='Just make them match each other';
      alt.title='Fix the '+f.inner[0].prop.label+' without giving them a '
        +'named style';
      alt.addEventListener('click',function(){stdFlatten(f.inner[0]);});
      box.appendChild(alt);
    }
    return box;
  }
  function renderStdPane(){
    var list=$('#stdpane-list'),head=$('#stdpane-count');
    if(!list) return;
    var r=standardise();
    /* THE FIGURE FINDINGS ARE IN THIS PANE and were not in this count,
       so a deck whose only problem was its figures read "nothing
       drifting" above a list of figure findings (2026-08-26 audit,
       T58) */
    var figs=figBoxes().length,fl=figLint().length;
    var n=r.findings.length+fl;
    var what=r.boxes+' text box'+(r.boxes===1?'':'es')
      +(figs?(' · '+figs+' figure'+(figs===1?'':'s')):'');
    if(head) head.textContent=n
      ?(n+' to look at · '+what):('nothing drifting · '+what);
    list.innerHTML='';
    if(!r.findings.length){
      /* TWO empty states. Saying "all fine" to a deck that has never used
         a style would be true about drift and false about the question
         that was asked, so the unstyled case says what is actually so and
         offers the names, phrased as an offer rather than a fault. And no
         'err' severity anywhere: nothing this finds is broken, and a
         consistency check that shouts is one people stop opening. */
      var msg=document.createElement('div');
      msg.className='pf-ok';
      msg.textContent=r.styled
        ?('Your type is consistent. Every heading, paragraph and caption '
          +'across these '+(pres.slides||[]).length+' slides matches the '
          +'style it wears.')
        :('Nothing is drifting — but nothing here wears a named style '
          +'either. Your text falls into '+r.bands.length+' size'
          +(r.bands.length===1?'':'s')+'; naming them means changing '
          +'every heading later is one edit instead of '+r.boxes+'.');
      list.appendChild(msg);
      if(!r.styled) r.bands.forEach(function(b){
        if(b.boxes.length<2) return;
        list.appendChild(stdRow({kind:'band',band:b,list:b.boxes,
          inner:[],sev:'info',
          head:b.boxes.length+' boxes at '+Math.round(b.size*5.4)+' pt',
          why:'These look like your '+styleDef(b.suggest).label+'.'}));
      });
      appendFigLint(list);
      return;
    }
    r.findings.forEach(function(f){list.appendChild(stdRow(f));});
    appendFigLint(list);
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
    btn.addEventListener('click',function(e){
      e.stopPropagation();set(pane.hidden);});
    var cl=$('#stdpane-close');
    if(cl) cl.addEventListener('click',function(){set(false);});
    var rr=$('#stdpane-rerun');
    if(rr) rr.addEventListener('click',renderStdPane);
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
      e.stopPropagation();m.remove();openRibbonGallery();});
    m.appendChild(lay);
    var note=document.createElement('div');
    note.className='ff-none';
    note.textContent='The '+activeTab()+' tab. Untick to put a button '
      +'away; the arrows move it within its group. Buttons never move '
      +'between tabs, and the row still never wraps.';
    m.appendChild(note);
    ribbonGroupsHere().forEach(function(g){
      var gid=ribbonGroupId(g);
      var lab=g.querySelector('.rbn-lab');
      menuHead(m,((lab&&lab.textContent)||gid).trim().toLowerCase());
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
      m.remove();
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
    document.body.appendChild(m);
    floatMenu(bar,m);
    setTimeout(function(){
      document.addEventListener('click',function off(e){
        if(m.contains(e.target)) return;
        m.remove();document.removeEventListener('click',off);
      });
    },0);
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
     Object is where everything selection-driven lives. It is contextual,
     so Home keeps its page-level meaning instead of growing a different
     ribbon every time the canvas selection changes (2026-08-26, user). */
  /* Animation is a tab of its own again (T176): a build is something
     you give a slide AFTER it is full, which is the opposite moment
     from Insert. */
  var TABS=['home','insert','design','animation','object'];
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
      else if(t==='view') t='home';
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
  function applyTab(){
    var bar=$('#edit-tools'); if(!bar) return;
    var t=activeTab();
    /* the build numbers show whenever the Animation tab is up (T186):
       the tab is about them, so they should not wait for the order
       pane or Quick animate */
    deckEl.classList.toggle('tab-animation',t==='animation');
    $$('.rbn-grp[data-tab]',bar).forEach(function(g){
      if(g.dataset.tab===t) g.removeAttribute('data-off');
      else g.setAttribute('data-off','1');
    });
    syncTabStrip();
  }
  function setTab(t){
    if(TABS.indexOf(t)<0||t===activeTab()) return;
    curTab=t;lsSet(tabKey(),t);
    applyTab();
    /* the row's content just changed wholesale, so its column counts and
       its density both have to be judged again */
    syncRibbonGroups();
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
    ['overview','Overview map…','Overview map…']];
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
  function fitEditRibbon(){
    var bar=$('#edit-tools');
    if(!bar||bar.hidden||mode!=='edit') return;
    /* a folded bar has no width to measure: scrollWidth would read 0 and
       the ladder would climb every rung for nothing */
    if(deckEl.classList.contains('rbn-fold')) return;
    /* BEFORE anything is measured: a stale column count is a wrong width,
       so re-counting here is both the fix for a group that grew a control
       since the last count and the only way the density rungs below are
       judged against the row that is actually on screen.
       Unfolding View first is part of that — every rung has to be judged
       against the full row, or a bar that folded once at 1280px would
       stay folded after you maximised the window. */
    foldViewGroup(false);
    sizeRibbonGroups();
    var cl=deckEl.classList;
    ERC.forEach(function(c){cl.remove(c);});
    cl.remove('erc-nohint');cl.remove('erc-nostatus');cl.remove('erc-tight');
    if(cl.contains('rbn-side')){
      /* a column is not short of width and has no rungs at all — leaving
         one stamped on would shrink the rail's type for no reason */
      ERCW.forEach(function(r){cl.remove(r[0]);});
      if(typeof rbnOverflowNotice==='function') rbnOverflowNotice(bar);
      return;
    }
    if(!bar.clientWidth) return;
    ERCW.forEach(function(r){cl.toggle(r[0],bar.clientWidth<r[1]);});
    /* the reminder text gives up its room before any control tightens */
    if(bar.scrollWidth>bar.clientWidth+1) cl.add('erc-nohint');
    for(var i=0;i<ERC.length;i++){
      if(bar.scrollWidth<=bar.clientWidth+1) break;
      cl.add(ERC[i]);
    }
    /* the save readout goes AFTER the density rungs, not with the hint:
       it is informative (where your work is) where the hint is
       decorative — but it still goes before any control shrinks to its
       last rung or the row clips (2026-08-18) */
    if(bar.scrollWidth>bar.clientWidth+1) cl.add('erc-nostatus');
    /* still over after every rung: fold the one group that is not about
       the selection, rather than let the row clip. sizeRibbonGroups has
       to run again — it counts the controls that are showing, and seven
       of them just stopped */
    if(bar.scrollWidth>bar.clientWidth+1){
      cl.add('erc-tight');
      foldViewGroup(true);
      sizeRibbonGroups();
    }
    /* Below the floor the row genuinely does not fit even flattened, and
       the only moves left — clip, scroll, wrap — are all forbidden.
       Standing the toolbar on its end is the layout that has room, and
       the Side button does exactly that; it is NOT done automatically,
       because a toolbar that teleports over a choice you just made was
       tried and rejected (2026-08-07).
       Floor measured by squeezing the resting ribbon 10px at a time:
       929px on 2026-08-10, 959px on 2026-08-16. The 30px is what View
       costs once its three controls are honestly sized across two columns
       instead of stacking into a third row and printing over their own
       label; the tight rung's spacing gave 40px of the ~70px back. Below
       it the remedy is Guides ▸ Toolbar on the right. */
    if(typeof rbnOverflowNotice==='function') rbnOverflowNotice(bar);
  }
  /* ---- the strip may not eat the ribbon --------------------------------
     The slide column and the ribbon are two tracks of ONE grid, so every
     pixel the strip's drag handle takes comes straight out of the row of
     tools -- and the drag was clamped to 46vw/900px, numbers that know
     nothing about how wide the tools actually are. Past the bottom of the
     ladder there is no rung left and .edit-tools is overflow-x:clip, so
     the right-hand end of the row is simply cut off; with an object
     selected the contextual groups need ~90px more, which is why it bit
     there first (2026-08-29, T80, user: "making the thumbnail view bigger
     can result in the ribbon getting eaten").
     ribbonMinW MEASURES that floor rather than guessing it: it stamps on
     the whole ladder at once -- every width rung, both text drops, the
     tight rung and a folded View group -- reads what the row still needs,
     then puts the classes and the fold back exactly as it found them.
     That is the state fitEditRibbon reaches at the bottom of its own
     climb, so the two cannot disagree. */
  function ribbonMinW(){
    var bar=$('#edit-tools');
    if(!bar||bar.hidden||mode!=='edit') return 0;
    /* nothing to measure: a folded bar reads 0 (the same reason
       fitEditRibbon bails), and a side-docked one is a column that does
       not compete with the strip for width at all */
    if(deckEl.classList.contains('rbn-fold')) return 0;
    if(deckEl.classList.contains('rbn-side')) return 0;
    if(!bar.clientWidth) return 0;
    var cl=deckEl.classList,rungs=[],had={},wasFolded=viewFolded,min;
    ERCW.forEach(function(r){rungs.push(r[0]);});
    ERC.forEach(function(c){rungs.push(c);});
    rungs.push('erc-nohint');rungs.push('erc-nostatus');rungs.push('erc-tight');
    rungs.forEach(function(c){had[c]=cl.contains(c);cl.add(c);});
    foldViewGroup(true);
    sizeRibbonGroups();
    /* WHAT THE ROW NEEDS, WHICH IS NOT WHAT scrollWidth REPORTS (T152).
       scrollWidth is floored at the element's own client width: a bar
       with slack returns its BOX, never its content. So this measured
       (deck width - strip width) instead of the ribbon's real floor, and
       fitFilmMax's `W - filmFloorW` gave back exactly the strip's
       CURRENT width. The ceiling was the current width at every window
       size, so the drag could shrink the column and never widen it, and
       the handle sat frozen against its own limit. Measured on a 1900px
       window: box 1685px, true need ~635px, ceiling 200px where 867px
       was available. (890px is the row's RESTING need; this measures it
       with the whole ladder stamped on and View folded, which is the
       state fitEditRibbon reaches at the bottom of its own climb. The
       shipped number is visible at a 1200px window, where the floor is
       the binding term: --film-max comes back 545px on a 1185px deck.) width:max-content asks the flex row what it actually
       wants; the bar is already stamped with the whole compaction ladder
       here, and both are put back below. */
    var hadW=bar.style.width;
    bar.style.width='max-content';
    min=Math.ceil(bar.getBoundingClientRect().width);
    bar.style.width=hadW;
    rungs.forEach(function(c){cl.toggle(c,had[c]);});
    foldViewGroup(wasFolded);
    sizeRibbonGroups();
    return min;
  }
  /* The ceiling the strip is allowed to reach, published to CSS as
     --film-max so ONE number drives the rendered column, the handle's own
     position and the drag. The two old caps stay as the other terms: 46vw
     and the 900px the drag has always stopped at.
     The last measured floor is REMEMBERED, so folding the ribbon -- the
     one state where the floor cannot be read -- does not let the strip
     lurch wider only to be shoved back the moment it unfolds. */
  var filmFloorW=0;
  function fitFilmMax(){
    var W=deckEl.clientWidth||window.innerWidth||0;
    if(!W) return 900;
    var f=ribbonMinW();
    if(f) filmFloorW=f;
    var hi=Math.min(900,Math.round(W*0.46));
    if(filmFloorW) hi=Math.min(hi,W-filmFloorW);
    /* 150px is the strip's own minimum and wins the tie: below the
       ribbon's floor the honest answer is the side toolbar, which
       rbnOverflowNotice already offers, not a strip too narrow to read */
    hi=Math.max(150,Math.round(hi));
    deckEl.style.setProperty('--film-max',hi+'px');
    return hi;
  }
  /* ---- the thin top bar must never clip --------------------------------
     #deck-qat is ~14 fixed-width controls on flex-wrap:nowrap, and no
     fitter covered it: below ~750-800px the RIGHT end — Present, the
     primary action, and Help — clipped away unreachable, which the
     ladder forbids ("clip, scroll, wrap — all forbidden", fitEditRibbon).
     Same shape as fitRibbon / fitEditRibbon: reset, measure, escalate.
       rung 1 (.qat-c1)     the save readout gives up its text — its
                            words also live in the Save button's tooltip
       rung 2 (.qat-c2)     spacing tightens and the long label shortens
                            ("Autosave" → "Auto"); words are shortened,
                            NEVER hidden (the twice-rejected icon-only)
       floor  (.qat-scroll) the bar scrolls sideways (overflow-x:auto,
                            thin scrollbar) so nothing is ever
                            unreachable. Safe for the bar's own menus:
                            File / Saved-to / Present all float
                            (floatMenu, position:fixed), so the scroll
                            box cannot cut them off. */
  function fitQat(){
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
  }
  /* ---- the View group folds when the row runs out of width ------------
     The density ladder's last rung says it drops "the one group that is
     not about the selection rather than let the row clip". It never did:
     erc-tight only tightened padding, so a 1366px window with a text box
     selected clipped Bold, Italic, Underline and Layout off the right-hand
     edge — unreachable, because the bar is overflow-x:clip and cannot be
     scrolled (and must stay that way, or every downward dropdown gets cut
     off at the ribbon's edge again; see the comment on .edit-tools).
     So the group folds instead of vanishing: seven buttons become one that
     opens them as a menu, which is ~300px back — far more than the 66px
     the row was over (2026-08-22). */
  var VIEW_FOLD=[['vw-rulers','Rulers'],['vw-grid','Grid'],
    ['vw-guides','Guides'],['vw-guidebox','Guide box'],
    ['vw-full','Full screen'],['vw-side','Side toolbar'],
    ['vw-check','Review'],['objects-btn','Layers'],['notes-btn','Notes']];
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
      o.textContent=p[1];
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
      if(!deckEl.hidden){fitFilmMax();fitEditRibbon();fitQat();applyZoom();}});
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
        if(deckEl.hidden) return;
        requestAnimationFrame(function(){
          if(deckEl.hidden) return;
          fitEditRibbon();applyZoom();
        });
      }).observe(et);
      /* the thin top bar gets the same treatment for the same reason:
         its box changing (window resize, first real layout on open) is
         the one signal that catches every way it can get narrower */
      var qb=$('#deck-qat');
      if(qb) new ResizeObserver(function(){
        if(deckEl.hidden) return;
        requestAnimationFrame(function(){
          if(!deckEl.hidden) fitQat();
        });
      }).observe(qb);
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
        requestAnimationFrame(function(){
          if(!deckEl.hidden) syncGuides();
        });
      }).observe(stage);
    }
    /* a fit measured against the fallback font sticks, because the bar's
       box never changes when the real font finally arrives */
    try{
      if(document.fonts&&document.fonts.ready)
        document.fonts.ready.then(function(){
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
    var pb=$('#page-btn'),pm=$('#page-menu'),pd=$('#page-drop');
    if(!pb||!pm) return;
    PAGE_PRESETS.forEach(function(pg){
      var o=document.createElement('button');
      o.className='dc-mi page-opt';o.type='button';
      o.dataset.page=pg.id;
      o.textContent=pg.label
        +(pg.id==='16x9'?'':' · '+pg.mm[0]+'×'+pg.mm[1]+' mm');
      o.addEventListener('click',function(e){
        e.stopPropagation();
        if(pg.id==='16x9') delete pres.page; else pres.page=pg.id;
        overlayHide(pm);
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
      });
      pm.appendChild(o);
    });
    pb.addEventListener('click',function(e){
      e.stopPropagation();
      if(pm.hidden) overlayShow(pb,pm);
      else overlayHide(pm);
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
    'stdpane','tidypane','flippane','provpane','sizepane','objhist',
    'reviewpane'];
  var PANE_BTN={selpane:'#objects-btn',animpane:'#vw-anim',
    notespane:'#notes-btn',reviewpane:'#vw-check',stdpane:'#dsg-std'};
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
    var el=$('#'+id); if(el) el.hidden=true;
    paneSyncBtns();
    syncPaneDock();
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
    var docked=null;
    $$('.selpane',deckEl).forEach(function(p){
      if(!p.hidden&&p.style.right!=='auto') docked=p;});
    /* reserve the width the pane ACTUALLY has: it is resizable, and a
       strip sized to the default would leave a widened pane over the
       page again */
    if(docked)
      deckEl.style.setProperty('--pane-w',
        Math.round(docked.offsetWidth||232)+'px');
    deckEl.classList.toggle('pane-open',!!docked&&mode==='edit');
    /* the page is fitted to the stage's width, so the stage changing size
       has to re-fit it — otherwise the slide keeps the size it had when
       the pane was closed and the pane lands on top of it after all */
    applyZoom();
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
  var spActMenu=null;
  function openSpActions(btn,acts){
    if(spActMenu){
      var was=spActMenu; spActMenu=null;
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
    document.body.appendChild(m);
    spActMenu=m;
    overlayShow(btn,m);floatMenu(btn,m);
  }
  function renderSelPane(){
    var pane=$('#selpane'),list=$('#selpane-list');
    if(!pane||pane.hidden||!list) return;
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
    }
    function toggleFlag(i,flag){
      var a2=liveAnnot(i);
      if(!a2){renderSelPane();return;}
      if(a2[flag]) delete a2[flag]; else a2[flag]=1;
      markDirty();
      var l=stage.querySelector('.annot-layer');
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
      eye.title=a.hide?'Show while editing'
        :'Hide while editing (still shows when presenting)';
      eye.setAttribute('aria-label',
        a.hide?'Show while editing':'Hide while editing');
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
        var nm=prompt('Name this folder','Folder '
          +(folderNames(s).length+1));
        if(nm===null) return;
        nm=nm.trim(); if(!nm) return;
        selN.forEach(function(i){if(s.annots[i]) s.annots[i].fold=nm;});
        markDirty();renderSelPane();
        toast(selN.length+' item'+(selN.length===1?'':'s')+' filed under '
          +'“'+nm+'”');
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
    act(bic('group')+' Make component',
      'Save the arrangement and look of the selected items as a named '
      +'thing you can place again. Each copy keeps its own words and '
      +'its own figure',selN.length>=1&&!primInst,
      function(){
        var nm=prompt('Name for the component:','FigureCaption');
        if(nm===null) return;
        nm=nm.trim(); if(!nm) return;
        var id=cmpDefine(nm,selN);
        toast(id?('“'+nm+'” saved — place it again from '
          +'the canvas menu'):'Nothing there that could be saved');
        renderSelPane();
      });
    act(bic('locate')+' Every instance',
      'Every place in this deck this component has been put — pick '
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
        var nm=prompt('Rename this folder',fname);
        if(nm===null) return;
        nm=nm.trim();
        (s.annots||[]).forEach(function(a){
          if(a&&a.fold===fname){
            if(nm) a.fold=nm; else delete a.fold;}});
        markDirty();renderSelPane();
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
        var v=prompt('Group name:',meta.name||('Group '+g));
        if(v!=null){grpMeta(s,g).name=v.trim();markDirty();renderSelPane();}
      });
      f.appendChild(nm);
      var rn=document.createElement('button');
      rn.className='sp-act';rn.type='button';rn.innerHTML=bic('pen');
      rn.title='Rename this group';
      rn.setAttribute('aria-label','Rename this group');
      rn.addEventListener('click',function(e){
        e.stopPropagation();
        var v=prompt('Group name:',meta.name||('Group '+g));
        if(v!=null){grpMeta(s,g).name=v.trim();markDirty();renderSelPane();}
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
      var mine=a4.anim?(a4.anim.order||0):-1;
      var offered={};
      animSeq(pres.slides[cur]).forEach(function(st){
        if(st.order<=mine||offered[st.order]) return;
        offered[st.order]=1;
        var inf=spStepInfo(pres.slides[cur],
          (pres.slides[cur].annots||[])[st.items[0]]);
        var who=st.items.map(function(i2){
          return annotLabel((pres.slides[cur].annots||[])[i2]);
        }).join(', ').slice(0,34);
        rowIn('Goes when '+who+' arrives',function(){
          live().out=st.order;
          commit();
        },'One click: that arrives, this goes \u2014 which is what '
          +'replacing a picture actually is'
          +(inf.n!=null?(' (click '+inf.n+')'):''),
          bic('exit'),nowOut===st.order);
      });
      rowIn('Goes on one more click at the end',function(){
        live().out=nextAnimOrder(pres.slides[cur]);
        commit();
      },'Adds a click of its own, on which this object leaves and '
        +'nothing arrives',bic('exit'),
        nowOut!=null&&!offered[nowOut]);
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
        function mv(e2){
          place({moved:1,x:e2.clientX-hostR.left-dx,
            y:e2.clientY-hostR.top-dy});
        }
        function up(){
          document.removeEventListener('pointermove',mv);
          document.removeEventListener('pointerup',up);
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
  ['selpane','animpane','notespane','verpane','preflight','varspane',
   'stdpane','tidypane','objhist','provpane','flippane','sizepane']
    .forEach(function(id){wirePane(document.getElementById(id));});
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
