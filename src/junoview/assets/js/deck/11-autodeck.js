  /* ================================================================
     11-autodeck.js — SLIDES FROM THE NOTEBOOK (T362)

     ONE FRAGMENT of deck.js's single IIFE: assets.DECK_PARTS names the
     order, 00-page.js opens the function and 99-boot.js closes it. It
     does not parse alone; check the ASSEMBLED file.

     The user, 2026-09-06: "we also need the auto generate presentations
     from notebooks but this should be just in the notebook viewer now.
     And there should be From all / From just this section / From just
     favourites. Presentation should be just markdown, headings and
     images ... using the section headings as titles for slides, and
     images and md".

     The viewer (app.js) decides WHAT is in scope -- it owns the section
     list, the marks and the notebook on screen -- and hands a PLAN
     here: {name, sections:[{title, items:[{ref, kind}]}]}. This file
     turns the plan into slides: one section heading per slide as its
     title, the section's markdown and figures placed beneath, short
     prose blocks sharing a slide, and figures sharing only when the
     prose still fits at the presentation's 21pt body size. Frames, not
     copies: every
     item is a notebook cell frame with its provenance, captured at once
     (embedIfAbsent) so the deck keeps its pixels when the notebook
     closes (T297/T305). autoDeckBuild is pure so a test can run it;
     autoDeckBoot() is called from THE BOOT SEQUENCE. */

  var AUTO_KINDS={note:1,figure:1,diagnostic:1};
  function autoDeckBuild(plan){
    var pr={name:String((plan&&plan.name)||'slides'),slides:[]};
    ((plan&&plan.sections)||[]).forEach(function(sec){
      var title=String((sec&&sec.title)||'').trim();
      var items=((sec&&sec.items)||[]).filter(function(it){
        return it&&it.ref&&AUTO_KINDS[it.kind];})
        .map(function(it,n){return {it:it,seq:n};});
      /* a section with nothing to show is not a slide: twelve code-only
         sections would be twelve empty headings */
      if(!items.length) return;
      function titleBox(){
        return {k:'text',x:5,y:4,w:90,h:11,text:title,size:5,b:1,style:'h1'};
      }
      function wordsOf(e){
        var it=e.it;
        return typeof it.words==='number'&&it.words>0?it.words:0;
      }
      /* T523: THE HEIGHT THE WORDS REALLY TAKE. The estimate below scales
         the notebook's measurement to the deck's 21pt body, and on the
         example notebook it came up short on four slides of fourteen --
         slide 13 by two whole lines, clipped (2026-09-29 audit). The
         import passes plan.measure, which renders the note at the slide
         width and reads it; the estimate stays for a plan without one
         (and for the tests that run this builder on its own). */
      function noteNeed(e,width){
        var m=(plan&&typeof plan.measure==='function')
          ?+plan.measure(e.it,Math.max(1,+width||84)):0;
        return m>0?m:noteEstimate(e,width);
      }
      function noteHeight(e,width){
        return Math.max(9,Math.min(88,noteNeed(e,width)));
      }
      /* ...and how much wider than its column it is drawn: a display
         equation or a table does not wrap, so beside a figure it was
         cut off at the column's edge (slide 9 of the example). 1 when it
         fits, or when nothing measured it. */
      function noteWide(e,width){
        var m=(plan&&typeof plan.measureWide==='function')
          ?+plan.measureWide(e.it,Math.max(1,+width||84)):1;
        return m>1?m:1;
      }
      function noteEstimate(e,width){
        var it=e.it,px=+it.sourceHeight||0,lines=+it.lines||0;
        var w=Math.max(1,+width||84),srcW=+it.sourceWidth||0;
        /* 28 CSS px at the deck's 1280x720 reference is 21pt. Scale the
           browser-measured notebook block by line height, then account
           for reflow when it is put beside a figure. This is deliberately
           allowed past one-slide height: the caller then gives the prose
           its own slide rather than manufacturing a scrollbar. */
        var srcFont=+it.sourceFontSize||15;
        var srcLine=+it.sourceLineHeight||srcFont*1.45;
        var typeScale=(28*1.35)/srcLine;
        /* Larger glyphs also consume more horizontal space. Without this
           second scale a two-line notebook paragraph became five lines on
           the slide while its frame was only made two lines tall. */
        var glyphScale=28/srcFont;
        var wrapScale=srcW?Math.max(1,
          srcW*glyphScale/(w*12.8)):1;
        if(px) return (px*typeScale*wrapScale+8)/7.2;
        var n=wordsOf(e),perLine=Math.max(6,Math.floor(w/4.5));
        var rows=Math.max(lines||0,n?Math.ceil(n/perLine):0);
        return rows?4+rows*5.25:14;
      }
      function noteWidth(e){
        var it=e.it,px=+it.sourceWidth||0;
        /* Keep approximately the same line breaks after moving from the
           notebook's body size to the deck's 21pt body size, within the
           slide's ordinary 8% margins. */
        var scale=28/(+it.sourceFontSize||15);
        return px?Math.max(48,Math.min(84,px*scale/12.8)):84;
      }
      function cell(e,box){
        var it=e.it,a={k:'cell',ref:it.ref,part:it.part
          ||(it.kind==='note'?'output':'figure')};
        Object.keys(box).forEach(function(k){a[k]=box[k];});
        if(it.nbpath) a.nbpath=it.nbpath;
        if(it.kind==='note'){
          a.autoNote=1;
          /* a note longer than the room it was given is not clipped: its
             words shrink until they fit, the way an AutoFit box does, and
             never below 60% (T523) */
          var need=noteNeed(e,box.w),wide=noteWide(e,box.w),ts=1;
          if(need>box.h+0.5) ts=box.h/need;
          if(wide>1) ts=Math.min(ts,1/wide);
          if(ts<1) a.ts=Math.max(0.6,+ts.toFixed(3));
        }
        return {a:a,seq:e.seq};
      }
      function addCells(annots,cells){
        cells.sort(function(a,b){return a.seq-b.seq;});
        cells.forEach(function(p,n){
          if(plan&&plan.animations) p.a.anim={type:'fade',order:n};
          annots.push(p.a);
        });
      }
      var i=0;
      while(i<items.length){
        var md=null,fig=null;
        var first=items[i],next=items[i+1];
        if(first.it.kind==='note'){
          md=first;i++;
          if(next&&next.it.kind!=='note'){fig=next;i++;}
        } else {
          fig=first;i++;
          if(next&&next.it.kind==='note'){md=next;i++;}
        }
        var annots=title?[titleBox()]:[];
        var top=title?18:6,h=title?76:88;
        var tall=!!(fig&&typeof fig.it.aspect==='number'
          &&fig.it.aspect<0.82);
        if(md&&fig){
          var pairH=noteHeight(md,tall?84:42);
          /* A portrait figure below prose needs a real picture area. A
             side-by-side pair only needs the prose to fit its column.
             If it does not, put the first item on this slide and revisit
             the second next time; decrementing i preserves source order. */
          var pairFits=(tall?pairH<=h-35:pairH<=h)
            &&noteWide(md,tall?84:42)<=1;
          if(!pairFits){
            if(md.seq<fig.seq) fig=null;
            else md=null;
            i--;
            tall=false;
          }
        }
        var notes=md?[md]:[],usedH=0;
        if(md&&!fig){
          var firstW=noteWidth(md);
          usedH=noteHeight(md,firstW);
          while(i<items.length&&items[i].it.kind==='note'){
            var nw2=noteWidth(items[i]);
            var nh2=noteHeight(items[i],nw2);
            if(usedH+2+nh2>h) break;
            notes.push(items[i]);usedH+=2+nh2;i++;
          }
        }
        var placed=[];
        if(md&&fig&&tall){
          var mh=noteHeight(md,84);
          placed.push(cell(md,{x:8,y:top,w:84,h:mh}));
          placed.push(cell(fig,{x:14,y:top+mh+3,w:72,h:h-mh-3}));
        } else if(md&&fig){
          placed.push(cell(md,{x:5,y:top,w:42,h:noteHeight(md,42)}));
          placed.push(cell(fig,{x:50,y:top,w:45,h:h}));
        } else if(fig){
          var asp=+fig.it.aspect||1.4,fh=asp>1.9?Math.min(h,54):h;
          placed.push(cell(fig,{x:tall?20:10,y:top+(h-fh)/2,
            w:tall?60:80,h:fh}));
        } else if(notes.length){
          var y=top;
          notes.forEach(function(e){
            var nw=noteWidth(e),nh=Math.min(h,noteHeight(e,nw));
            placed.push(cell(e,{x:(100-nw)/2,y:y,w:nw,h:nh}));
            y+=nh+2;
          });
        }
        addCells(annots,placed);
        pr.slides.push({layout:'blank',panes:[],annots:annots});
      }
    });
    return pr;
  }
  /* the plan, into a NEW presentation that opens in the editor. Never
     replaces the deck you had: T236 removed the old Auto-build for
     exactly that. */
  /* T523: measure a note the way the canvas will draw it -- the frame's
     own classes, the deck's 1280x720 reference, zoom 1 -- in a host off
     the screen, and give the builder its height as a page percentage.
     Memoised per note and width: the builder asks the same question
     while it tries a note beside a figure and then on its own. */
  function autoNoteMeasurer(){
    var host=document.createElement('div');
    host.setAttribute('aria-hidden','true');
    host.style.cssText='position:fixed;left:-30000px;top:0;width:1280px;'
      +'visibility:hidden;pointer-events:none;';
    document.body.appendChild(host);
    var memo={},memoW={};
    function measure(it,w){
      var key=String(it.ref)+'|'+(+w).toFixed(2);
      if(memo[key]!=null) return memo[key];
      memoW[key]=1;
      var b=(typeof framePart==='function')
        ?framePart(it.ref,it.part||'output'):null;
      if(!b) return (memo[key]=0);
      $$('[id]',b).forEach(function(n){n.removeAttribute('id');});
      var c=document.createElement('div');
      c.className='an-cell an-auto-note';
      c.style.cssText='position:relative;height:auto;width:'
        +(1280*w/100).toFixed(2)+'px;';
      c.appendChild(b);host.appendChild(c);
      var n=c.querySelector('.note')||b;
      /* + the frame's two 1.5px borders, then a hair of slack for the
         rounding between this and the zoomed canvas */
      var px=Math.max(n.scrollHeight||0,b.scrollHeight||0);
      /* the right-most edge of anything inside, against the column */
      var nr=n.getBoundingClientRect(),maxR=nr.right;
      $$('*',n).forEach(function(el){
        var r=el.getBoundingClientRect();
        if(r.width&&r.right>maxR) maxR=r.right;});
      var wide=nr.width?(maxR-nr.left)/nr.width:1;
      memoW[key]=wide>1.02?wide:1;
      host.removeChild(c);
      return (memo[key]=px?(px+3)/7.2+0.8:0);
    }
    measure.wide=function(it,w){
      var key=String(it.ref)+'|'+(+w).toFixed(2);
      if(memoW[key]==null) measure(it,w);
      return memoW[key]||1;
    };
    measure.done=function(){
      if(host.parentNode) host.parentNode.removeChild(host);};
    return measure;
  }
  function autoDeckImport(plan){
    var measure=autoNoteMeasurer(),pr;
    try{
      if(plan){plan.measure=measure;plan.measureWide=measure.wide;}
      pr=autoDeckBuild(plan);
    } finally {
      measure.done();
      if(plan){delete plan.measure;delete plan.measureWide;}
    }
    var where=(plan&&plan.scopeLabel)||'the notebook';
    if(!pr.slides.length){
      toast('Nothing to make slides from in '+where
        +' — it holds no markdown or figures',5000);
      return 0;
    }
    pr.slides.forEach(function(s){
      (s.annots||[]).forEach(function(a){
        if(a.k==='cell'&&typeof embedIfAbsent==='function') embedIfAbsent(a);
      });
    });
    /* 'keep': a deck made from the notebook is always a NEW deck, so a
       name that is taken takes the next free one (T236, T527) */
    var n=importDeckText(JSON.stringify({presentations:[pr]}),false,'keep');
    if(n) toast(pr.slides.length+' slide'+(pr.slides.length===1?'':'s')
      +' from '+where+' — section headings as titles, the markdown '
      +'and figures placed beneath. It is a new presentation; edit away.',
      6000);
    return n;
  }
  function autoDeckBoot(){
    window.SemApp.deckAuto=autoDeckImport;
    window.SemDeckAutoBuild=autoDeckBuild;    /* browser-verification hook */
  }
