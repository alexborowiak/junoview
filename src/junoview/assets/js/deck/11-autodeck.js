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
     title, the section's markdown and figures placed beneath, a slide
     holding at most one markdown block and one figure so nothing is
     shrunk to fit, and a section with several of either running on to
     further slides under the same heading. Frames, not copies: every
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
        return it&&it.ref&&AUTO_KINDS[it.kind];});
      /* a section with nothing to show is not a slide: twelve code-only
         sections would be twelve empty headings */
      if(!items.length) return;
      function titleBox(){
        return {k:'text',x:5,y:4,w:90,h:11,text:title,size:5,b:1,style:'h1'};
      }
      var i=0;
      while(i<items.length){
        var md=null,fig=null;
        /* up to one of each, in the order they sit in the notebook,
           stopping the moment a kind would repeat */
        while(i<items.length){
          var it=items[i],isFig=(it.kind!=='note');
          if(isFig&&!fig){fig=it;i++;}
          else if(!isFig&&!md){md=it;i++;}
          else break;
        }
        var annots=title?[titleBox()]:[];
        var top=title?18:6,h=title?76:88;
        if(md&&fig){
          annots.push({k:'cell',x:5,y:top,w:42,h:h,ref:md.ref});
          annots.push({k:'cell',x:50,y:top,w:45,h:h,ref:fig.ref});
        } else if(fig){
          annots.push({k:'cell',x:10,y:top,w:80,h:h,ref:fig.ref});
        } else if(md){
          annots.push({k:'cell',x:8,y:top,w:84,h:h,ref:md.ref});
        }
        pr.slides.push({layout:'blank',panes:[],annots:annots});
      }
    });
    return pr;
  }
  /* the plan, into a NEW presentation that opens in the editor. Never
     replaces the deck you had: T236 removed the old Auto-build for
     exactly that. */
  function autoDeckImport(plan){
    var pr=autoDeckBuild(plan);
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
    var n=importDeckText(JSON.stringify({presentations:[pr]}),false);
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
