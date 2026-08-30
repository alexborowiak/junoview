/* 55-sections-and-strip.js — sections as units, the film strip and its menus, and mode switching.
   ONE FRAGMENT of deck.js's single IIFE, concatenated with its
   siblings in filename order by assets.deck_js(). It does not
   parse alone and is not meant to: see 00-page.js. */
  /* ---- A SECTION AS A UNIT (TASKS T23) ---------------------------------
     Sections already existed as a model and half a UI: a `sec` tag on
     the slide, a names map, a contiguous-run invariant that normSections
     restores after every mutation, dividers in the strip, fold, rename,
     remove, and move-a-slide-into-one. Three things were missing, and
     each of them is "the section behaves like one thing" rather than a
     new model.

     MOVE AS A UNIT. Dragging the divider moved nothing; the arrows moved
     one slide at a time. `moveSection` lifts the whole run out and puts
     it back somewhere else, and because membership is the tag ON each
     slide, the tags travel with the slides and normSections has nothing
     to repair.

     DUPLICATE AS A UNIT. dupSlide clones one. A section's copy needs a
     NEW id — two runs sharing one id is exactly the state the
     contiguity invariant exists to forbid — and its own name, because
     "Methods" appearing twice in a strip is not a section, it is a
     puzzle.

     SECTION-SCOPED NUMBERING. Slide numbers are global by deliberate
     decision (renderFilm's comment says so, and the furniture resolves
     {n} to the deck index). That decision is right for the strip and
     wrong for a talk in parts, so it becomes a CHOICE rather than a
     reversal: {sn} and {sN} are the number within the section and the
     size of the section, alongside the {n} and {N} that already mean
     the whole deck. Nothing that exists changes meaning. */
  function moveSection(id,dir){
    var runs=sectionRuns(),at=-1,i;
    for(i=0;i<runs.length;i++) if(runs[i].id===id) at=i;
    if(at<0) return 0;
    var to=at+dir;
    if(to<0||to>=runs.length) return 0;
    var me=runs[at],other=runs[to];
    var block=pres.slides.splice(me.at,me.n);
    /* removing the block shifts anything after it, so the destination is
       computed from where the OTHER run sits once the hole is closed */
    var dest=(dir<0)?other.at:(other.at+other.n-me.n);
    for(i=0;i<block.length;i++) pres.slides.splice(dest+i,0,block[i]);
    normSections();
    cur=dest;activePane=-1;selAnnot=null;selSet=[];
    markDirty();refresh();
    return block.length;
  }
  function dupSection(id){
    var runs=sectionRuns(),run=null;
    runs.forEach(function(r){if(r.id===id) run=r;});
    if(!run) return 0;
    var nid=secId();
    var name=(secName(id)||'Section')+' copy';
    secMap()[nid]={name:name};
    var copies=[];
    for(var i=0;i<run.n;i++){
      var cp=deep(pres.slides[run.at+i]);
      cp.sec=nid;          /* a NEW id: two runs cannot share one */
      delete cp.label;
      copies.push(cp);
    }
    for(var j=0;j<copies.length;j++)
      pres.slides.splice(run.at+run.n+j,0,copies[j]);
    normSections();
    cur=run.at+run.n;activePane=-1;selAnnot=null;selSet=[];
    markDirty();refresh();
    return copies.length;
  }
  /* which section a slide is in, and where in it — the numbers {sn}/{sN}
     resolve to. Derived from the slide list like everything else about
     sections; nothing is stored. */
  function sectionPos(i){
    var runs=sectionRuns();
    for(var k=0;k<runs.length;k++){
      var r=runs[k];
      if(i>=r.at&&i<r.at+r.n)
        return {n:i-r.at+1,of:r.n,id:r.id,name:r.name};
    }
    return {n:i+1,of:(pres.slides||[]).length,id:'',name:''};
  }
  function moveSlideToSection(i,id){
    var runs=sectionRuns(),r=null,j,to;
    for(j=0;j<runs.length;j++) if(runs[j].id===id) r=runs[j];
    /* a tag on its own would break contiguity, so the slide MOVES to the
       end of that section's run — re-tagging without moving is the bug
       normSections would then immediately have to undo */
    to=r?(r.at+r.n):pres.slides.length;
    var moved=pres.slides.splice(i,1)[0]; if(!moved) return;
    if(to>i) to--;
    if(id) moved.sec=id; else delete moved.sec;
    pres.slides.splice(to,0,moved);
    cur=to;normSections();markDirty();refresh();
  }
  /* a WHOLE-SECTION drop is a different move: lift the run out and put it
     back at a divider boundary. `cur` is refound by IDENTITY afterwards —
     the single-slide path's four-branch arithmetic does not generalise to
     moving n slides at once, and getting it wrong strands you on somebody
     else's slide.

     NAMED moveSectionTo, and it matters. This was `moveSection` too, and
     deck/ is ONE scope in fifteen files: two declarations of a name are
     not two functions, they are the later one. "Move the section up"
     called it with dir=-1, which this body read as beforeAt=-1 and
     spliced the run in before the LAST slide; "down" with 1 was a no-op
     for any section already at the front. Neither toasted either, since
     this one returns nothing (2026-08-25). */
  function moveSectionTo(id,beforeAt){
    var runs=sectionRuns(),r=null,i;
    for(i=0;i<runs.length;i++) if(runs[i].id===id) r=runs[i];
    if(!r||(beforeAt>=r.at&&beforeAt<=r.at+r.n)) return;
    var keep=pres.slides[cur];
    var block=pres.slides.splice(r.at,r.n);
    var to=beforeAt>r.at?beforeAt-r.n:beforeAt;
    for(i=0;i<block.length;i++) pres.slides.splice(to+i,0,block[i]);
    var k=pres.slides.indexOf(keep);
    cur=k<0?0:k;
    normSections();markDirty();refresh();
  }
  var draggingSlide=-1,draggingSec=null;
  /* ONE divider row. Deliberately NOT class `film-row` and deliberately
     without a data-idx: refreshThumb looks up
     '.film-row[data-idx="N"]' and takes the first match, so a divider
     wearing either would quietly collect a slide's thumbnail. */
  function secRow(r){
    var el=document.createElement('div');
    el.className='film-sec'+(r.fold?' folded':'');
    el.dataset.sec=r.id;el.dataset.at=r.at;
    el.draggable=true;
    el.title='Drag to move the whole section';
    var f=document.createElement('button');
    f.className='film-sec-fold';
    f.innerHTML=r.fold?'&#9656;':'&#9662;';
    f.title=r.fold?'Show these slides':'Hide these slides';
    f.addEventListener('click',function(e){
      e.stopPropagation();foldSection(r.id,!r.fold);});
    el.appendChild(f);
    var t=document.createElement('span');
    t.className='film-sec-t';t.textContent=r.name;el.appendChild(t);
    var n=document.createElement('span');
    n.className='film-sec-n';
    /* the count is the whole point of a collapsed section — a divider
       that hides four slides and does not say four is just a deck with
       slides missing */
    n.textContent=r.fold?(r.n+' hidden'):String(r.n);
    el.appendChild(n);
    var ctr=document.createElement('span');ctr.className='film-ctr';
    [[bic('pen'),function(){renameSection(r.id);},'Rename this section'],
     [bic('minus'),function(){removeSection(r.id,false);},
      'Remove this divider — the slides stay, and join the section '
      +'above']]
      .forEach(function(p){
        var b=document.createElement('button');b.className='film-mini';
        b.innerHTML=p[0];b.title=p[2];
        b.setAttribute('aria-label',p[2]);
        b.addEventListener('click',function(ev){
          ev.stopPropagation();p[1]();});
        ctr.appendChild(b);
      });
    el.appendChild(ctr);
    el.addEventListener('dragstart',function(e){
      draggingSec=r.id;el.classList.add('dragging');
      try{e.dataTransfer.setData('text/plain','sec-'+r.id);}catch(err){}
      try{e.dataTransfer.setDragImage(el,12,12);}catch(err){}
      e.dataTransfer.effectAllowed='move';
    });
    el.addEventListener('dragend',function(){
      draggingSec=null;el.classList.remove('dragging');clearFilmMarks();});
    el.addEventListener('contextmenu',function(ev){
      ev.preventDefault();openFilmMenu(r.at,ev,r);});
    return el;
  }
  function renderFilm(){
    var list=$('#film-list');list.innerHTML='';
    /* the strip rebuilds every row, so a context menu left open is
       holding an index into nodes that no longer exist */
    var om=$('#film-menu'); if(om) om.remove();
    /* Headers are INSERTED into the flat loop rather than the loop being
       rewritten sections-outer / slides-inner. `i` stays the ARRAY index,
       which is what keeps the numbers global (1..n straight through every
       section) and keeps row.dataset.idx equal to the array index —
       refreshThumb and the drop maths both read it back. */
    var runs=sectionRuns(),head={},fold={};
    runs.forEach(function(r){
      if(r.id) head[r.at]=r;
      if(r.fold) for(var k=r.at;k<r.at+r.n;k++) fold[k]=1;
    });
    /* the mode is stamped ONCE on the list and the CSS branches off it,
       the way applyTab() stamps data-off — not a style per row, and not
       on the body or the deck, because filmToPane MOVES this list into
       the Versions pane and an ancestor class would be left behind */
    var fv=filmMode();
    list.setAttribute('data-fv',fv);
    miniHNow=miniH();
    pres.slides.forEach(function(s,i){
      if(head[i]) list.appendChild(secRow(head[i]));
      /* the CURRENT slide is drawn even inside a folded section: it is
         where you are standing, and it is also the row refreshThumb goes
         looking for on every edit — hide it and the live thumbnail dies */
      if(fold[i]&&i!==cur) return;
      var filmCut=activeCut(),skipped=slideSkipped(i);
      var row=document.createElement('div');
      row.className='film-row'+(i===cur?' current':'')
        +(fold[i]?' peek':'')+(s.sec?' in-sec':'')
        +(s.opt?' opt':'')+(skipped?' cut':'');
      row.dataset.idx=i;
      row.draggable=true;
      var rowTips=['Drag to reorder'];
      if(s.opt) rowTips.push('Optional: Running late can skip this slide');
      if(skipped) rowTips.push(filmCut&&!inCut(s,filmCut)
        ?'Not shown in the “'+((cutMap()[filmCut]||{}).name||filmCut)
          +'” version'
        :'Skipped by Running late');
      row.title=rowTips.join('\n');
      row.addEventListener('contextmenu',function(ev){
        ev.preventDefault();openFilmMenu(i,ev,null);});
      row.addEventListener('dragstart',function(e){
        draggingSlide=i;
        row.classList.add('dragging');
        try{e.dataTransfer.setData('text/plain','slide-'+i);}
        catch(err){}
        /* drag the ROW as the ghost — the browser otherwise picks up the
           figure <img> inside the thumbnail as the drag image/payload */
        try{e.dataTransfer.setDragImage(row,12,12);}catch(err){}
        e.dataTransfer.effectAllowed='move';
      });
      row.addEventListener('dragend',function(){
        draggingSlide=-1;
        row.classList.remove('dragging');
        clearFilmMarks();
      });
      row.dataset.lvl=headLevel(s);
      var lbl=document.createElement('div');lbl.className='film-label';
      var num=document.createElement('span');num.className='film-n';
      num.textContent=(i+1);lbl.appendChild(num);
      if(i===cur&&mode==='create'&&s.layout!=='title'){
        /* notebook view: the current slide IS the big inline pane editor
           (paired with your visible notebook cells to fill it). In slide
           view the CANVAS is the single editor, so the strip stays thumbnails */
        var view=document.createElement('div');view.className='film-view';
        view.appendChild(buildSlideEditor(s));
        lbl.appendChild(view);
      } else if(fv!=='head'){
        /* in headings mode no thumbnail is BUILT, rather than one being
           built and hidden: miniDiagram emits an <img> per figure, a real
           <table> per table and an <svg> per slide, and a sixty-slide
           deck should not pay for all of that to draw a list of names */
        lbl.appendChild(miniDiagram(s));
      }
      var tt=document.createElement('span');tt.className='film-t';
      tt.textContent=filmText(s);lbl.appendChild(tt);
      var marks=document.createElement('span');marks.className='film-marks';
      function mark(cls,text,title){
        var tag=document.createElement('span');
        tag.className='film-mark '+cls;tag.textContent=text;tag.title=title;
        marks.appendChild(tag);
      }
      if(s.opt) mark('opt','optional','Running late can skip this slide');
      if(skipped) mark('cut','not shown',filmCut&&!inCut(s,filmCut)
        ?'Not shown in the “'+((cutMap()[filmCut]||{}).name||filmCut)
          +'” version'
        :'Skipped by Running late');
      if(marks.childNodes.length) lbl.appendChild(marks);
      /* WHILE ARMED the thumbnail is a target, not a destination --
         and every row is one, including the current slide, which is why
         this listener is no longer conditional on i!==cur (T66) */
      lbl.addEventListener('click',function(){
        if(slideMatchHit(i)) return;
        if(i===cur) return;
        cur=i;activePane=-1;selAnnot=null;selSet=[];refresh();});
      row.appendChild(lbl);
      var ctr=document.createElement('span');ctr.className='film-ctr';
      var poster=pageOf().poster;
      var acts=[['↑',function(){moveSlide(i,-1);},
                 poster?'Move this version up':'Move slide up'],
                ['↓',function(){moveSlide(i,1);},
                 poster?'Move this version down':'Move slide down'],
                [bic('copy'),function(){dupSlide(i);},
                 poster?'Duplicate this version':'Duplicate slide'],
                [bic('exit'),function(){delSlide(i);},
                 poster?'Delete this version':'Delete slide']];
      /* an autoname is a starting point, not a decision. This goes on a
         BUTTON rather than a double-click on the row: the row's own click
         re-renders the strip, so by the time a dblclick arrived the node
         it was editing had already been replaced (2026-08-10). */
      if(poster) acts.splice(2,0,[bic('pen'),function(){
        var s2=pres.slides[i]; if(!s2) return;
        var v=prompt('Name this version:',s2.label||slideTitle(s2));
        if(v==null) return;
        v=v.trim();
        if(v) s2.label=v; else delete s2.label;
        markDirty();renderFilm();
      },'Rename this version']);
      acts.forEach(function(p){
        var b=document.createElement('button');b.className='film-mini';
        b.innerHTML=p[0];   /* fixed strings / bic() markup from above */
        b.title=p[2];
        b.setAttribute('aria-label',p[2]);
        b.addEventListener('click',function(ev){
          ev.stopPropagation();p[1]();});
        ctr.appendChild(b);
      });
      row.appendChild(ctr);
      list.appendChild(row);
    });
  }
  function clearFilmMarks(){
    $$('#film-list .film-row.drop-above,#film-list .film-row.drop-below,'
      +'#film-list .film-sec.drop-above,#film-list .film-sec.drop-below')
      .forEach(function(r){
        r.classList.remove('drop-above');
        r.classList.remove('drop-below');
      });
  }
  /* ---- WHERE A DROP LANDS ----------------------------------------------
     Before sections a drop was one number: the row's dataset.idx, plus
     one if you were past its midpoint. With dividers interleaved a drop
     is TWO answers — where in the array, and which section the slide now
     belongs to — and on a divider they are decided by the SAME midpoint
     from opposite sides: above the divider is the last slide of the run
     before it, below it is the first slide of the run after. Same index,
     different owner. That is the whole change. */
  function filmDropTarget(row,clientY){
    var r=row.getBoundingClientRect(),below=clientY>r.top+r.height/2;
    if(row.classList.contains('film-sec')){
      var at=+row.dataset.at,id=row.dataset.sec;
      if(!below){
        var prev=pres.slides[at-1];
        return {to:at,sec:(prev&&prev.sec)||''};
      }
      if(row.classList.contains('folded')){
        /* a folded section shows no rows to aim between, so a drop onto
           it can only mean "put this one in there", at the end */
        var runs=sectionRuns(),k,n=0;
        for(k=0;k<runs.length;k++) if(runs[k].id===id) n=runs[k].n;
        return {to:at+n,sec:id};
      }
      return {to:at,sec:id};
    }
    var idx=+row.dataset.idx,s=pres.slides[idx];
    return {to:below?idx+1:idx,sec:(s&&s.sec)||''};
  }
  (function(){
    var list=$('#film-list'); if(!list) return;
    list.addEventListener('dragover',function(e){
      if(draggingSlide<0&&!draggingSec) return;
      e.preventDefault();
      e.dataTransfer.dropEffect='move';
      clearFilmMarks();
      var row=e.target.closest&&e.target.closest('.film-row,.film-sec');
      if(!row) return;
      var r=row.getBoundingClientRect();
      row.classList.add(
        e.clientY>r.top+r.height/2?'drop-below':'drop-above');
    });
    list.addEventListener('dragleave',function(e){
      if(e.target===list) clearFilmMarks();
    });
    list.addEventListener('drop',function(e){
      if(draggingSlide<0&&!draggingSec) return;
      e.preventDefault();
      var from=draggingSlide,sec=draggingSec;
      draggingSlide=-1;draggingSec=null;
      clearFilmMarks();
      var row=e.target.closest&&e.target.closest('.film-row,.film-sec');
      if(!row) return;
      var tgt=filmDropTarget(row,e.clientY);
      /* a whole section moves as a block and refinds `cur` by identity */
      if(sec){moveSectionTo(sec,tgt.to);return;}
      var to=tgt.to;
      if(to>from) to--;
      var moved=pres.slides.splice(from,1)[0];
      /* the slide joins whatever section it landed in — a slide dragged
         under a divider that kept its old tag would make the section
         discontiguous, and normSections would drag it straight back */
      if(tgt.sec) moved.sec=tgt.sec; else delete moved.sec;
      pres.slides.splice(to,0,moved);
      if(cur===from) cur=to;
      else if(from<cur&&to>=cur) cur--;
      else if(from>cur&&to<=cur) cur++;
      normSections();markDirty();refresh();
    });
  })();
  /* ---- the strip's right-click menu ------------------------------------
     The section verbs live HERE rather than on a ribbon button because
     this is where the thing being sectioned is visible, and because Home
     has no room to give (2026-08-22). Mounted on the body like
     openMatchMenu, and closed at the top of renderFilm — the strip
     rebuilds every row, so a menu left open holds a dead index. */
  function openFilmMenu(i,ev,run){
    var old=$('#film-menu'); if(old) old.remove();
    var m=document.createElement('div');
    m.className='sh-menu film-menu';m.id='film-menu';
    var poster=pageOf().poster;
    function row(label,fn,title,icon){
      var b=document.createElement('button');
      b.className='dbtn vw-opt';
      /* the icon arrives as trusted bic() markup; the LABEL stays a
         text node — section names are user data */
      if(icon) b.innerHTML=bic(icon)+' ';
      b.appendChild(document.createTextNode(label));
      if(title) b.title=title;
      b.addEventListener('click',function(e){
        e.stopPropagation();m.remove();fn();});
      m.appendChild(b);
      /* RETURNED, so a caller can mark the row the deck is currently in
         — the canvas menu's row() has always done this, and the two are
         otherwise the same idiom (2026-08-25, T27) */
      return b;
    }
    if(run){
      menuHead(m,'this section');
      row('Rename…',function(){renameSection(run.id);},null,'pen');
      row(run.fold?'▾ Show these slides':'▸ Hide these slides',
        function(){foldSection(run.id,!run.fold);});
      /* THE UNIT VERBS (T23): the whole run moves and copies as one
         thing, which is what makes a section an object rather than a
         label on a slide */
      row('↑ Move the section up',function(){
        var n=moveSection(run.id,-1);
        if(n) toast(n+' slide'+(n===1?'':'s')+' moved as one');},
        'The whole run, in order, above the section before it');
      row('↓ Move the section down',function(){
        var n=moveSection(run.id,1);
        if(n) toast(n+' slide'+(n===1?'':'s')+' moved as one');},
        'The whole run, in order, below the section after it');
      row('Duplicate the whole section',function(){
        var n=dupSection(run.id);
        if(n) toast(n+' slide'+(n===1?'':'s')+' copied into a new '
          +'section');},
        'A copy of every slide in it, under a new name — two runs '
        +'cannot share one section','copy');
      /* a SECTION default, which is what T23's "section transitions"
         asked for and had no substrate for until now */
      menuHead(m,'how its slides arrive'
        +(motionOK()?'':' — not on this machine'));
      TRANS.forEach(function(t){
        var m2=(pres.sections||{})[run.id]||{};
        var b=row(t[1],function(){setSectionTrans(run.id,t[0]);},t[2]);
        if((m2.trans||'')===t[0]) b.classList.add('on');
      });
      menuHead(m,'this section');
      row('Remove the divider',function(){removeSection(run.id,false);},
        'The slides stay — they join the section above','minus');
      row('Delete the section AND its '+run.n+' slide'
        +(run.n===1?'':'s'),function(){
          if(confirm('Delete '+run.n+' slide'+(run.n===1?'':'s')
            +' along with the section "'+run.name+'"?'))
            removeSection(run.id,true);
        },null,'exit');
      floatAt(m,ev);
      return;
    }
    menuHead(m,poster?'this page':'slide '+(i+1));
    row('§ Start a section here',function(){newSection(i,'New section');},
      'Everything from here down to the next divider goes in it');
    var runs=sectionRuns().filter(function(r){return r.id;});
    if(runs.length){
      menuHead(m,'move this one into');
      runs.forEach(function(r){
        if(pres.slides[i]&&pres.slides[i].sec===r.id) return;
        row('→ '+r.name,function(){moveSlideToSection(i,r.id);});
      });
      if(pres.slides[i]&&pres.slides[i].sec)
        row('→ (no section)',function(){moveSlideToSection(i,'');});
    }
    menuHead(m,poster?'this page':'this slide');
    /* OPTIONAL, and which versions this slide is in (T24). On the SLIDE
       menu because that is where you are looking when you decide a
       slide is a nice-to-have. */
    var oSl=pres.slides[i];
    /* HOW IT ARRIVES (T27). On the slide menu: a transition is a fact
       about one slide, and this is where you are looking at it. */
    menuHead(m,'how it arrives'
      +(motionOK()?'':' — not on this machine'));
    var nowT=(oSl&&typeof oSl.trans==='string')?oSl.trans:null;
    var secM=(oSl&&oSl.sec)?((pres.sections||{})[oSl.sec]||null):null;
    TRANS.forEach(function(t){
      var b=row(t[1],function(){setTrans(i,t[0]);},t[2]);
      /* ticked on the slide's OWN answer. Outside a section there is
         nothing to inherit, so the effective one is its own. */
      var mine=(nowT===null)?(secM?null:transFor(i)):nowT;
      if(mine===t[0]) b.classList.add('on');
    });
    /* THE WAY BACK, which is why Cut had quietly been wired to mean both
       "arrive cut" and "stop overriding": there was no row for the
       second, so the falsy value did double duty and an explicit Cut
       inside a section was unreachable (T57). Offered only inside a
       section, the only place an override has anything to fall back
       to. */
    if(secM){
      var sd=(typeof secM.trans==='string')?secM.trans:'';
      var ub=row('Use the section default ('
        +transLabel(sd).toLowerCase()+')',
        function(){setTrans(i,null);},
        'Stop deciding it on this slide \u2014 \u201c'
        +(secM.name||'this section')+'\u201d decides');
      if(nowT===null) ub.classList.add('on');
    }
    menuHead(m,poster?'this page':'this slide');
    row((oSl&&oSl.opt)?'✓ Optional':'Mark it optional',function(){
      toggleOptional(i);},
      'Running late in present mode skips the optional slides from '
      +'wherever you have got to');
    var cuts=cutList();
    if(cuts.length){
      menuHead(m,'in these versions');
      cuts.forEach(function(c){
        var inIt=!!(oSl&&oSl.cuts&&oSl.cuts.indexOf(c.id)>=0);
        var none=!(oSl&&oSl.cuts&&oSl.cuts.length);
        row((inIt||none?'✓ ':'')+c.name,function(){
          toggleSlideCut(i,c.id);},
          none?'In every version, because it names none'
            :(inIt?'Remove it from this version'
              :'Add it to this version'));
      });
    }
    menuHead(m,poster?'this page':'this slide');
    row('Duplicate',function(){dupSlide(i);},null,'copy');
    row('Delete',function(){delSlide(i);},null,'exit');
    floatAt(m,ev);
  }
  /* floatMenu positions against an element's rect; a context menu has
     only a point, so it is handed a zero-size one at the cursor */
  function floatAt(m,ev){
    document.body.appendChild(m);
    floatMenu({getBoundingClientRect:function(){
      return {left:ev.clientX,right:ev.clientX,
        top:ev.clientY,bottom:ev.clientY,width:0,height:0};
    }},m);
    setTimeout(function(){
      document.addEventListener('click',function off(e){
        if(m.contains(e.target)) return;
        m.remove();document.removeEventListener('click',off);
      });
    },0);
  }
  function presNbs(p){
    var set={},order=[];
    (p&&p.slides||[]).forEach(function(s){
      (s.annots||[]).forEach(function(a){
        if(a.k==='cell'&&a.ref){
          var stem=splitRef(a.ref)[0];
          if(stem&&!set[stem]){set[stem]=1;order.push(stem);}
        }
      });
    });
    return order;
  }
  function renderPresNbs(){
    var nbs=presNbs(pres);
    /* the column shows the list whenever this build can DO anything with
       notebooks; the bare static export has none at all */
    var col=$('#dc-nbs');
    if(col) col.hidden=!(nbs.length||nbsCanOpen());
    buildNbsInto(col,true);
  }
  /* ---- "notebooks in this presentation" popover: open all / refresh all ----
     stem -> path resolves from an open shell, else a recent path with the
     same filename (paths only exist in the app + web builds) */
  function pathStem(p){
    var s=String(p||''),parts=s.split(/[\/\\]/),nm=parts[parts.length-1]||s;
    nm=nm.split('?')[0].split('#')[0];
    try{nm=decodeURIComponent(nm);}catch(e){}
    return nm.replace(/\.ipynb$/i,'');
  }
  function nbPathFor(stem){
    var sh=APP.shells&&APP.shells[stem];
    if(sh&&sh.path) return sh.path;
    var rec=(APP.project&&APP.project.recent)||[];
    for(var i=0;i<rec.length;i++)
      if(pathStem(rec[i])===stem) return rec[i];
    return null;
  }
  /* a path is actually openable only if APP.openPath can act on it: any path
     in the app (the server resolves it), but ONLY http(s) URLs in the web
     build (relative recent entries like the bundled demo can't be re-fetched
     by openPath) */
  function nbOpenable(path){
    if(!path) return false;
    return APP.mode==='web'?/^https?:\/\//i.test(path):true;
  }
  function nbInfo(){
    return presNbs(pres).map(function(stem){
      var open=APP.order.indexOf(stem)>=0;
      var path=open?((APP.shells[stem]&&APP.shells[stem].path)||'')
        :nbPathFor(stem);
      return {stem:stem,open:open,path:path,openable:nbOpenable(path)};
    });
  }
  function nbsCanOpen(){return APP.mode==='app'||APP.mode==='web';}
  function openPresNbs(missingOnly){
    if(!nbsCanOpen()){toast('Opening notebooks needs the Junoview app');return;}
    var info=nbInfo(),acted=0,cannot=0;
    info.forEach(function(n){
      if(missingOnly&&n.open) return;
      if(n.openable){APP.openPath(n.path);acted++;} else cannot++;
    });
    var verb=missingOnly?'Opening ':'Reloading ';
    if(!acted&&!cannot)
      toast(missingOnly?'All notebooks are already open':'Nothing to reload');
    else if(!acted)
      toast('Could not '+(missingOnly?'open':'reload')+' those notebooks');
    else if(cannot)
      toast(verb+acted+'; '+cannot+' unavailable');
    else
      toast(verb+acted+' notebook'+(acted===1?'':'s')+'…');
    setTimeout(renderNbsMenu,600);   /* refresh statuses, stay open */
  }
  function hideNbsMenu(){}   /* nothing floats any more; see renderNbsMenu */
  /* ---- Lock all / Unlock all / prefetch locked versions ---- */
  function allCellAnnots(){
    var out=[];
    (pres.slides||[]).forEach(function(s){
      (s.annots||[]).forEach(function(a){
        if(a.k==='cell'&&a.ref) out.push(a);});});
    return out;
  }
  function lockAllFrames(){
    if(APP.mode!=='app'){toast('Locking needs the Junoview app');return;}
    var ann=allCellAnnots().filter(function(a){return !a.lockver;});
    if(!ann.length){toast('Every figure is already locked');return;}
    var byStem={};
    ann.forEach(function(a){
      var pr=splitRef(normRef(a.ref)||String(a.ref||''));
      if(pr[0]) (byStem[pr[0]]=byStem[pr[0]]||[]).push(a);
    });
    var stems=Object.keys(byStem),done=0,locked=0,norepo=0;
    if(!stems.length){toast('Nothing to lock');return;}
    stems.forEach(function(st){
      var path=nbPathFor(st);
      function fin(){
        if(++done!==stems.length) return;
        markDirty();refresh();
        toast(locked
          ?('Locked '+locked+' figure'+(locked===1?'':'s')
            +(norepo?' — '+norepo+' not in git':''))
          :'Nothing lockable — are the notebooks committed to git?');
      }
      if(!path||/^https?:/i.test(path)){
        norepo+=byStem[st].length;fin();return;}
      APP.api('/api/gitstate',{path:path}).then(function(g){
        if(g&&g.repo&&g.commit){
          byStem[st].forEach(function(a){
            a.lockver={commit:g.commit.id,msg:g.commit.msg||'',
              date:g.commit.date||''};
            locked++;
          });
        } else norepo+=byStem[st].length;
        fin();
      }).catch(fin);
    });
  }
  function unlockAllFrames(){
    var ann=allCellAnnots().filter(function(a){return a.lockver;});
    if(!ann.length){toast('No locked figures');return;}
    if(!window.confirm('Unlock all '+ann.length+' figure'
      +(ann.length===1?'':'s')+'? They will follow notebook refreshes '
      +'again — locked versions stop showing.')) return;
    ann.forEach(function(a){delete a.lockver;});
    markDirty();refresh();
    toast('Unlocked '+ann.length+' figure'+(ann.length===1?'':'s'));
  }
  function loadLockedVersions(){
    var groups={};
    allCellAnnots().forEach(function(a){
      if(!(a.lockver&&a.lockver.commit)) return;
      var lp=lockParts(a); if(!lp) return;
      (groups[lp.pkey]=groups[lp.pkey]||{path:lp.path,
        commit:a.lockver.commit,anchors:[]});
      if(groups[lp.pkey].anchors.indexOf(lp.anchor)<0)
        groups[lp.pkey].anchors.push(lp.anchor);
    });
    var keys=Object.keys(groups);
    if(!keys.length){toast('No locked figures to load');return;}
    var total=0;
    keys.forEach(function(k){total+=groups[k].anchors.length;});
    toast('Loading '+total+' locked figure'+(total===1?'':'s')
      +' from '+keys.length+' version'+(keys.length===1?'':'s')+'…');
    keys.forEach(function(k){
      fetchVerCards(groups[k].path,groups[k].commit,
        groups[k].anchors);});
  }
  /* ONE place the notebook list lives: the top of the left column, on
     screen the whole time you are editing. There used to be a second copy
     in a floating pane behind a ribbon button, which is a group's worth of
     ribbon width spent on something already showing (2026-08-20, user: "so
     the notebook button can be removed now. Haven't we put all the
     functionality on the left hand side?"). */
  function renderNbsMenu(){
    buildNbsInto($('#dc-nbs'),true);
  }
  /* T78: THE COLUMN'S HEIGHT IS THE STRIP'S HEIGHT. Everything above
     the thumbnails is height the thumbnails do not get, and this block
     was a header, one row per notebook and FIVE full-width buttons --
     around 180px of a laptop's column, spent on actions you use once a
     session (2026-08-29, user: "slide thumbnails seem to be compressed
     by the buttons that are on the top right ... even though they are
     above, they seem to compress the thumbnail view"). Three answers,
     smallest first: the four rare actions fold into one More menu, the
     rows scroll inside a capped box instead of pushing the strip down,
     and the whole body folds away from a header that keeps the count.
     The list still shows by default -- it is the way back and the
     open/closed state, which is the 2026-08-20 invariant. */
  var NBS_FOLD_KEY='junoview-nbs-fold';
  /* a per-BROWSER preference, like the ribbon fold: it says how you like
     this column, not what the presentation is, so it is not a deck field
     and needs none of the four places one of those lives in */
  function nbsFolded(){
    try{return localStorage.getItem(NBS_FOLD_KEY)==='1';}
    catch(e){return false;}
  }
  function setNbsFolded(v){
    try{
      if(v) localStorage.setItem(NBS_FOLD_KEY,'1');
      else localStorage.removeItem(NBS_FOLD_KEY);
    }catch(e){}
  }
  function buildNbsInto(m,column){
    if(!m) return;
    m.innerHTML='';
    var info=nbInfo();
    if(!info.length){
      m.innerHTML='<div class="dc-nbs-empty">No notebooks yet &mdash; add cells '
        +'from your notebooks to a slide.</div>';return;}
    var h=document.createElement('div');h.className='dc-nbs-menuh';
    h.textContent=column?'\u21a9 notebooks':'notebooks in this presentation';
    if(column){
      h.title='Back to all notebooks. Nothing is closed or lost.';
      h.addEventListener('click',function(){closeDeck();});
    }
    /* the header is a ROW now: the way back on the left, then the count
       (so folding costs no information) and the fold itself */
    var head=document.createElement('div');head.className='dc-nbs-head';
    head.appendChild(h);
    var nbBody=document.createElement('div');nbBody.className='dc-nbs-body';
    if(column){
      var nOpen=0;
      info.forEach(function(n){if(n.open) nOpen++;});
      var sum=document.createElement('span');sum.className='dc-nbs-sum';
      sum.textContent=info.length+' listed · '+nOpen+' open';
      sum.title=info.length+' notebook'+(info.length===1?'':'s')+' in this '
        +'presentation, '+nOpen+' of them open';
      head.appendChild(sum);
      var tg=document.createElement('button');tg.className='dbtn dc-nbs-tog';
      var shut=nbsFolded();
      var paintTog=function(){
        tg.innerHTML=shut?bic('expand')+' Show':bic('collapse')+' Hide';
        tg.title=shut
          ?'Show the notebook list and its actions again'
          :'Fold the list away and give the height to the thumbnails';
        tg.setAttribute('aria-expanded',(!shut).toString());
        m.classList.toggle('nbs-folded',shut);
      };
      tg.addEventListener('click',function(e){
        e.stopPropagation();shut=!shut;setNbsFolded(shut);paintTog();});
      head.appendChild(tg);
      paintTog();
    }
    m.appendChild(head);
    m.appendChild(nbBody);
    info.forEach(function(n){
      /* openable-but-closed = "avail"; can't be opened here = "gone" */
      var cls=n.open?'open':(n.openable?'avail':'gone');
      var row=document.createElement('div');
      row.className='dc-nbrow '+cls;
      var dot=document.createElement('span');dot.className='dc-nbrow-dot';
      var nm=document.createElement('span');nm.className='dc-nbrow-nm';
      nm.textContent=n.stem;
      var st=document.createElement('span');st.className='dc-nbrow-st';
      st.textContent=n.open?'open':(n.openable?'closed':'not found');
      row.appendChild(dot);row.appendChild(nm);row.appendChild(st);
      if(n.open){
        row.classList.add('clickable');
        row.title='View this notebook';
        row.addEventListener('click',function(){
          closeDeck();
          if(APP.activate) APP.activate(n.stem);
        });
      } else if(n.openable){
        row.title=n.path;row.classList.add('clickable');
        row.addEventListener('click',function(){
          /* the pane stays open: you asked to SEE the notebooks, and
             acting on one row is not done looking (2026-08-18, user:
             "keep open, only close when clicking cross") */
          APP.openPath(n.path);
          setTimeout(renderNbsMenu,600);});
      } else if(n.path){row.title=n.path;}
      nbBody.appendChild(row);
    });
    if(nbsCanOpen()){
      var acts=document.createElement('div');acts.className='dc-nbacts';
      var ob=document.createElement('button');ob.className='dbtn';
      ob.innerHTML=bic('open')+' Open notebooks';
      ob.title='Open every notebook this presentation uses that is not '
        +'already open';
      ob.addEventListener('click',function(){openPresNbs(true);});
      var rb=document.createElement('button');rb.className='dbtn';
      rb.innerHTML=bic('reload')+' Refresh all';
      rb.title='Reload every notebook this presentation uses from disk / URL';
      rb.addEventListener('click',function(){openPresNbs(false);});
      acts.appendChild(ob);nbBody.appendChild(acts);
      /* FOUR ROWS BECAME ONE. Refresh all and the three lock actions are
         once-a-session verbs, and the lock three HAD to stack full width
         -- their labels are phrases, not words (2026-08-21) -- so four
         rows of buttons stood permanently in front of the thumbnails.
         They keep their words, their icons and their
         disabled-with-a-reason treatment; they just wait behind More.
         The menu floats (position:fixed, set by floatMenu), so the
         capped scrolling body cannot clip it. */
      var mb=document.createElement('button');mb.className='dbtn';
      mb.innerHTML=bic('menu')+' More';
      mb.setAttribute('aria-haspopup','true');
      mb.setAttribute('aria-expanded','false');
      mb.title='Refresh every notebook, and lock or unlock every figure';
      acts.appendChild(mb);
      /* shown everywhere, working only in the app - see the per-figure
         Lock button for why (2026-08-20) */
      if(true){
        var appMode=(APP.mode==='app');
        var acts2=document.createElement('div');
        acts2.className='sh-menu nbs-more-menu';acts2.hidden=true;
        acts2.appendChild(rb);
        var la=document.createElement('button');la.className='dbtn';
        la.disabled=!appMode;
        la.innerHTML=bic('lock')+' Lock all figures';
        la.title=appMode
          ?('Pin every frame to its notebook\u2019s current git commit '
            +'\u2014 refreshes stop changing them')
          :('Needs the Junoview app: locking reads git through the local '
            +'server, and this page was exported as a standalone file.');
        la.addEventListener('click',function(){lockAllFrames();});
        var ua=document.createElement('button');ua.className='dbtn';
        ua.disabled=!appMode;
        ua.innerHTML=bic('unlock')+' Unlock all';
        ua.title='Every frame follows notebook refreshes again';
        ua.addEventListener('click',function(){unlockAllFrames();});
        var lv=document.createElement('button');lv.className='dbtn';
        lv.disabled=!appMode;
        lv.innerHTML=bic('reload')+' Load locked versions';
        lv.title='Fetch every locked figure’s content from git — the '
          +'notebooks don’t need to be open';
        lv.addEventListener('click',function(){loadLockedVersions();});
        menuHead(acts2,'every figure at once');
        acts2.appendChild(la);acts2.appendChild(ua);
        acts2.appendChild(lv);
        nbBody.appendChild(acts2);
        var armed=false;
        var closer=function(e){
          if(acts2.contains(e.target)) return;
          acts2.hidden=true;mb.setAttribute('aria-expanded','false');
          document.removeEventListener('click',closer);armed=false;
        };
        mb.addEventListener('click',function(e){
          e.stopPropagation();
          var willOpen=acts2.hidden;
          acts2.hidden=!willOpen;
          mb.setAttribute('aria-expanded',willOpen.toString());
          if(!willOpen) return;
          floatMenu(mb,acts2);
          if(armed) return;
          armed=true;
          setTimeout(function(){document.addEventListener('click',closer);},0);
        });
      }
    } else {
      var note=document.createElement('div');note.className='dc-nbs-empty';
      note.textContent='Open / refresh is available in the Junoview app.';
      nbBody.appendChild(note);
    }
  }
  /* ---- the Home tab's Slides group -----------------------------------
     The same four actions the thumbnail strip offers on hover, in the
     place you look for them when the strip is scrolled away from the
     current slide. They call the strip's own implementations, so there is
     one of each. */
  (function(){
    var b;
    b=$('#hm-newslide');
    if(b) b.addEventListener('click',function(){
      var add=$('#film-add'); if(add) add.click();});
    b=$('#hm-dupslide');
    if(b) b.addEventListener('click',function(){dupSlide(cur);});
    b=$('#hm-delslide');
    if(b) b.addEventListener('click',function(){delSlide(cur);});
    b=$('#hm-match');
    if(b) b.addEventListener('click',function(e){
      e.stopPropagation();openMatchMenu(this);});
    wireMenuToggle('hm-laywrap','hm-lay','hm-lay-menu');
  })();
  function renderCreate(){
    renderPresRow();renderControls();renderPresNbs();renderFilm();
    syncFurnBtns();   /* the furniture toggles show their own state */
  }
  function moveSlide(i,d){
    var j=i+d; if(j<0||j>=pres.slides.length) return;
    var t=pres.slides[i];pres.slides[i]=pres.slides[j];pres.slides[j]=t;
    if(cur===i)cur=j; else if(cur===j)cur=i;
    /* BOTH swapped slides take their section from the neighbour on their
       far side — the one OUTSIDE the pair. Without this, stepping a slide
       across a divider left its old tag behind, normSections dragged it
       back on the next pass, and the arrow button looked like it had done
       nothing at all (2026-08-22). */
    var far=function(at,dir){
      var nb=pres.slides[at+dir];
      return nb?((nb.sec)||''):null;
    };
    var sj=far(j,d),si=far(i,-d);
    if(sj!==null){if(sj) pres.slides[j].sec=sj; else delete pres.slides[j].sec;}
    if(si!==null){if(si) pres.slides[i].sec=si; else delete pres.slides[i].sec;}
    normSections();markDirty();refresh();
  }
  function delSlide(i){
    pres.slides.splice(i,1);
    if(cur>=pres.slides.length) cur=Math.max(0,pres.slides.length-1);
    activePane=-1;
    normSections();markDirty();refresh();
  }
  /* duplicate in place — decks never had this at all (2026-08-19, user:
     "still no duplicate slide"); a poster's copy becomes a named version
     like "+ Create new version" makes */
  function dupSlide(i){
    var s=pres.slides[i]; if(!s) return;
    var cp=deep(s);
    if(pageOf().poster) cp.label=nextVersionName();
    else delete cp.label;
    pres.slides.splice(i+1,0,cp);
    cur=i+1;activePane=-1;selAnnot=null;selSet=[];
    markDirty();refresh();
  }

  /* ---------- mode switching ---------- */
  /* ---- edit mode borrows the FILE controls into the ribbon
     (2026-08-05, user: the docked column "basically just feels like
     having the File button open all the time"). The real nodes MOVE —
     every existing handler and menu keeps working — and move back when
     create mode needs the panel again. With its head gone the panel is
     just the slide strip, and posters (one page, no slides) drop the
     panel entirely. ---- */
  /* fileToRibbon / fileToPanel are GONE (2026-08-19): the document
     actions used to be borrowed into the ribbon's File group while
     editing and restored on leaving. They live permanently in the left
     column now — Notebooks, then File/Save/undo/redo and the save
     readout, then the thumbnails — so there is nothing to borrow and
     nothing to restore, and the whole class of "moved node lost its
     styling/anchor" bugs goes with the machinery. */
  function syncTopBar(){
    var dt=$('.deck-top',deckEl);
    /* Row 1 of the deck holds exactly one bar. Presenting gets .deck-top,
       which is only a way out; editing and building get .deck-qat, which
       is the document's own controls — File, Save, undo/redo, the name,
       Find, zoom, Present (2026-08-20). Never both. */
    var qat=$('#deck-qat',deckEl);
    var editing=(mode==='edit'||mode==='create');
    if(dt) dt.hidden=editing;
    if(qat) qat.hidden=!editing;
    /* the first moment the bar has a real width to be judged against */
    if(editing) requestAnimationFrame(fitQat);
    var tabs=$('#rbn-tabs',deckEl);
    if(tabs) tabs.hidden=(mode!=='edit');
    var xb=$('#deck-exit');
    if(xb){
      /* say where it GOES. "Back" beside an armed drawing tool reads as
         the way out of that tool, which is Cancel's job. */
      var presenting=(mode==='view');
      xb.innerHTML=presenting?bic('return')+' Stop presenting'
        :bic('return')+' Close the editor';
      xb.title=presenting
        ?'Stop presenting and go back to the builder (Esc). Nothing is '
          +'closed or lost.'
        :'Leave the editor and go back to the builder. Nothing is closed '
          +'or lost.';
    }
    syncLateButton();
  }
  function setUIMode(m){
    var startingTalk=(m==='view'&&mode!=='view');
    var endingTalk=(m!=='view'&&mode==='view');
    /* Running late belongs to ONE run. A named version survives the run,
       but its first audience slide must actually belong to it (T50). */
    if(startingTalk){
      lateFrom=-1;
      if(slideSkipped(cur)){
        var to=nextShown(cur,1);
        if(to<0) to=nextShown(cur,-1);
        if(to>=0) cur=to;
        else {
          var emptyName=(cutMap()[activeCut()]||{}).name||'version';
          showCut='';
          toast('“'+emptyName+'” has no slides — showing every slide');
        }
      }
    }
    /* entering Present must not leave a fresher deck in memory than in
       the draft — the debounced write lands before the talk starts */
    if(m==='view') flushDraftWrite();
    /* a rehearsal is exactly "present mode, from when it starts to when
       it ends" -- so it begins and ends where the mode does (T29) */
    if(startingTalk) rehStart();
    else if(endingTalk){
      rehStop();lateFrom=-1;
    }
    mode=m;
    var creating=(m==='create'), editing=(m==='edit');
    deckEl.classList.toggle('creating',creating);
    deckEl.classList.toggle('editing',editing);
    /* nothing moves any more: the document actions LIVE in the left
       column in every mode (2026-08-19) */
    /* the builder panel stays visible while editing a slide */
    $('#deck-create').hidden=!(creating||editing);
    var et=$('#edit-tools'); if(et) et.hidden=!editing;
    if(editing){
      applyTab();
      /* the folded state is remembered per project, like the tab */
      if(!deckEl._foldInit){
        deckEl._foldInit=1;
        setRibbonFold(lsGet(FOLDKEY2+SCOPE)==='1');
      }
    }
    /* The top bar earns its row or it does not appear. While editing it
       is only needed by a POSTER, which has no panel and therefore keeps
       File and Save up here; a presentation keeps them in the panel head,
       leaving the bar with nothing but a redundant button and a whole row
       of wasted height (2026-08-07). fileToRibbon has already run, so the
       slot's contents are the honest test. */
    syncTopBar();
    document.body.classList.toggle('creating-docs',
      (creating||editing)&&!deckEl.hidden);
    document.body.classList.toggle('slide-editing',
      editing&&!deckEl.hidden);
    document.body.classList.toggle('deck-open',
      !creating&&!deckEl.hidden);
    selAnnot=null;selSet=[];
    if(m==='view') revealCount=0;   /* start the build sequence fresh */
    if(!editing){                   /* Objects pane is an editing tool */
      var sp=$('#selpane'); if(sp) sp.hidden=true;
      var ob=$('#objects-btn');
      if(ob) ob.setAttribute('aria-pressed','false');
      /* Notes are an editing pane too. Leaving it open put the pane over
         the audience's slide after the ribbon disappeared (T48). */
      var np=$('#notespane'); if(np) np.hidden=true;
      var nb=$('#notes-btn');
      if(nb) nb.setAttribute('aria-pressed','false');
      /* ...and so is the Versions pane. Put the strip back where the
         builder expects to find it before the builder renders. */
      showVerpane(false);
      animPaneClose();
      filmToPanel();
      rbnGalleryClose();
      /* MutationObserver catches every ordinary pane toggle, but it is
         asynchronous; presenting must fit the page before this turn's
         render/fullscreen work starts. */
      syncPaneDock();
    }
    /* A custom layout may have moved contextual controls out of #et-fmt,
       so hiding that one holder cannot reset the ribbon. showFmt owns the
       complete list and now sees the cleared selection above. */
    showFmt();
    if(editing) setTool('select');
    /* real full screen while presenting (browser chrome gone) */
    try{
      if(m==='view'&&!deckEl.hidden&&fullTarget().requestFullscreen
         &&!document.fullscreenElement)
        fullTarget().requestFullscreen().catch(function(){});
      /* ...but full-screen EDITING is deliberate, not a leftover from
         presenting: leaving it alone here is what lets a poster be edited
         full screen at all (every mode re-apply would otherwise drop it) */
      else if(m!=='view'&&document.fullscreenElement&&!editFull)
        document.exitFullscreen().catch(function(){});
    }catch(err){}
    if(m!=='edit'&&editFull){
      editFull=false;deckEl.classList.remove('editfull');
      try{if(document.fullscreenElement)
        document.exitFullscreen().catch(function(){});}catch(err2){}
    }
    applySideRibbon();
    syncViewBtns();
    /* entering edit mode is the first moment the ribbon has a real width
       -- and therefore the first moment the strip's ceiling can be
       measured. A width restored from localStorage is clamped by
       --film-max here rather than eating the row on open (T80) */
    if(m==='edit') requestAnimationFrame(function(){
      fitFilmMax();fitEditRibbon();});
    if(creating||editing){
      activePane=-1;
      renderCreate();
    }
    if(!creating) renderSlide();
    /* the bar's title depends on the mode, and openDeck calls status()
       BEFORE the mode is set — so it is refreshed once more here */
    status();
    if(startingTalk||endingTalk) presenterSync();
  }
  function refresh(){
    if(mode==='create'){renderCreate();}
    else if(mode==='edit'){renderCreate();renderSlide();}
    else renderSlide();
  }
  function routeSync(){
    if(window.SemApp&&window.SemApp.updateHash) window.SemApp.updateHash();
  }
  function openDeck(m){
    deckEl.hidden=false;
    histReset();   /* undo history starts fresh per editing session */
    /* ONE ON ARRIVAL, so "how it was when I sat down" is always
       reachable -- the same rule the notebook's own snapshots follow,
       and deduped, so opening and closing without touching anything
       costs nothing (T32) */
    snapTake('opened');
    status();
    setUIMode(m||'view');
    routeSync();
    /* the welcome screen can now be showing WITH the deck opening over
       it (its presentations column, or Home with nothing else open), so
       the chrome has to be told a deck exists (2026-08-21) */
    if(APP.refreshChrome) APP.refreshChrome();
  }
  /* WHAT GOES OUT. A poster is one page: its other pages are drafts and
     variants, and you send one to the print shop, not the pile. Since
     "+ Create new version" makes those easy to accumulate, exporting all
     of them would quietly turn one A0 into three (2026-08-10). A deck's
     slides ARE the deck, so they all go. */
  function outputSlides(){
    var all=[];
    (pres.slides||[]).forEach(function(s,i){
      /* A FLIP BOOK EXPLODES ON THE WAY OUT. This is the whole payoff:
         the complaint was "heaps of new slides each with a new figure",
         so the editor keeps ONE slide with the figures stacked inside it
         and the exporter builds the pile — six frames become six real
         PowerPoint slides, each with the items tied to that frame and
         nothing else (2026-08-22).
         The FIRST flip book on the slide is the one that explodes it.
         Two of them multiplying into a grid of pages is nobody's
         intention, and the second simply rests on its own frame. */
      var fl=flipsOn(s)[0];
      var n=fl?flipFrames(fl.a).length:0;
      if(n>1){
        for(var f=0;f<n;f++) all.push({s:s,i:i,f:f});
        return;
      }
      all.push({s:s,i:i,f:null});
    });
    if(!pageOf().poster||all.length<2) return all;
    var k=0;
    all.forEach(function(e,j){if(e.i===cur&&!k) k=j;});
    return all[k]?[all[k]]:all;
  }
  /* named for the toast, so it is never a silent choice */
  function outputNote(){
    var all=(pres.slides||[]).length;
    if(!pageOf().poster||all<2) return '';
    var s=pres.slides[Math.min(Math.max(cur,0),all-1)];
    return ' Sent "'+((s&&s.label)||slideTitle(s||{}))+'" only — a poster '
      +'goes out one version at a time; open Versions to switch.';
  }
  function closeDeck(){
    /* SPA navigation does not fire pagehide. Home/hash routing can close
       this surface directly, so it is just as real an end to a rehearsal
       as the visible Stop presenting button (T48). */
    if(mode==='view') rehStop();
    try{
      if(document.fullscreenElement)
        document.exitFullscreen().catch(function(){});
    }catch(err){}
    closeVFull();
    rbnGalleryClose();
    showVerpane(false);filmToPanel();   /* the strip goes home */
    deckEl.hidden=true;
    document.body.classList.remove('deck-open');
    document.body.classList.remove('creating-docs');
    document.body.classList.remove('slide-editing');
    deckEl.classList.remove('creating');
    deckEl.classList.remove('editing');
    renderPresTabs();
    routeSync();
    /* ...and told when it stops existing: closing the last deck with no
       notebook open has to land back on the welcome, not a blank page */
    if(APP.refreshChrome) APP.refreshChrome();
  }
  /* ---- URL routing hooks used by the SemApp router (docs side) ---- */
  window.SemApp.deckState=function(){
    return deckEl.hidden?null:{name:pres.name,slide:cur};
  };
  window.SemApp.deckClose=function(){closeDeck();};
  /* ---- what the welcome screen lists ---------------------------------
     The presentations rail is not the only door any more: it collapses,
     and once it was away the front door had no route to a deck at all
     (2026-08-21, user: "you can't get to the presentations from here
     either"). Same source of truth as the rail's own rows. */
  window.SemApp.deckNames=function(){
    var out=[],seen={},saved=allSaved(),savedNames={};
    saved.forEach(function(p){savedNames[p.name]=1;});
    function push(nm,p,draft){
      if(!nm||seen[nm]) return;
      seen[nm]=1;
      out.push({name:nm,
        slides:(((p||{}).slides)||[]).length,
        poster:/^a\d/.test(String((p||{}).page||'')),
        view:isViewPres(p||{}),
        folder:(p||{}).folder||'',
        draft:!!draft});
    }
    saved.forEach(function(p){push(p.name,p,false);});
    draftNames().forEach(function(nm){
      push(nm,loadDraft(nm)||{},!savedNames[nm]);});
    return out;
  };
  /* opening one is the rail's own action, so a deck, a poster and a
     custom view each land where they belong */
  window.SemApp.deckChoose=function(nm){choosePresentation(nm);};
  /* a presentation needs no notebook: every tool except the cell frame
     works on an empty deck, so the front door can offer this as a way
     IN rather than as something you reach after opening a notebook
     (2026-08-22, user: "you can really only create a presentation once
     you have a notebook open"). */
  window.SemApp.deckNew=function(){newPresentation();};
  /* (the chrome redraw for these hooks runs from THE BOOT SEQUENCE) */
  window.SemApp.deckGo=function(slide){   /* move slide, keep the current mode */
    if(deckEl.hidden) return;
    go(Math.max(0,Math.min(((pres.slides||[]).length||1)-1,slide||0)));
  };
  window.SemApp.deckOpen=function(name,slide){
    if(!name) return false;
    if(pres.name!==name){
      if(!(savedByName(name)||loadDraft(name))) return false;
      lsSet(PFX+'last',name);
      loadPresentation(name);
      activePane=-1;
    }
    cur=0;
    if(typeof slide==='number'&&slide>0)
      cur=Math.max(0,Math.min(((pres.slides||[]).length||1)-1,slide));
    openDeck('edit');
    return true;
  };
  /* wrap so the click Event isn't forwarded (closeDeck takes no args) */
  var prDocs=document.getElementById('pr-docs');
  if(prDocs) prDocs.addEventListener('click',function(){closeDeck();});
  var prNew=document.getElementById('pr-new');
  if(prNew) prNew.addEventListener('click',newPresentation);
  var prNewPost=document.getElementById('pr-newpost');
  if(prNewPost) prNewPost.addEventListener('click',newPoster);
  var prNewView=document.getElementById('pr-newview');
  if(prNewView) prNewView.addEventListener('click',newCustomView);
  var sbDone=document.getElementById('sb-done');
  if(sbDone) sbDone.addEventListener('click',closeCustomView);
  $('#pres-current').addEventListener('click',function(){
    var inp=$('#pres-name');
    this.hidden=true;
    inp.hidden=false;inp.value=pres.name;
    inp.focus();inp.select();
  });
  var presentFrom='create';
  /* ---- the Present menu ------------------------------------------------
     Play from here, play from the start, or open the presenter view first
     and then play. Presenter view deliberately does NOT start playback:
     you want to drag the window to the other screen before anything goes
     full screen (2026-08-20). */
  (function(){
    var wrap=$('#dc-playmore'),menu=$('#play-menu');
    if(!wrap||!menu) return;
    wrap.addEventListener('click',function(e){
      e.stopPropagation();
      var open=menu.hidden;
      menu.hidden=!open;
      wrap.setAttribute('aria-expanded',open?'true':'false');
      /* floated for the same reason as the File menu: the qat's scroll
         floor must not clip it */
      if(open) floatMenu(wrap,menu);
    });
    document.addEventListener('click',function(e){
      if(!menu.hidden&&!menu.contains(e.target)&&e.target!==wrap)
        menu.hidden=true;
    });
    function mi(id,fn){
      var b=$(id);
      if(b) b.addEventListener('click',function(e){
        e.stopPropagation();menu.hidden=true;fn();});
    }
    /* WHICH VERSION (T24). Built rather than written into the markup
       because the list is the deck's, and a deck with no cuts must show
       nothing at all here. Running late is in the presenter bar: an
       edit-only menu was the one place it could not work mid-talk. */
    function syncCuts(){
      $$('.pl-cut',menu).forEach(function(n){n.remove();});
      var list=cutList();
      var selected=activeCut();
      var anchor=$('#pl-here');
      if(!anchor||!anchor.parentNode) return;
      function add(el){
        el.classList.add('pl-cut');
        menu.insertBefore(el,anchor);
      }
      var hd=document.createElement('div');
      hd.className='hd-lab';hd.textContent='which version';
      add(hd);
      function opt(id,label,why){
        var b=document.createElement('button');
        b.className='dbtn dc-mi';
        b.textContent=label;
        if(why) b.title=why;
        b.setAttribute('aria-pressed',(selected===id).toString());
        b.addEventListener('click',function(e){
          e.stopPropagation();menu.hidden=true;setCut(id);syncCuts();});
        add(b);
      }
      opt('','Every slide','The whole deck, which is what a deck with '
        +'no cuts always shows');
      list.forEach(function(c){
        var box=document.createElement('div');
        box.className='pl-cutrow';box.dataset.cut=c.id;
        var choose=document.createElement('button');
        choose.className='dbtn dc-mi pl-cutpick';
        choose.textContent=c.name;
        choose.title='Only the slides that name this version';
        choose.setAttribute('aria-pressed',(selected===c.id).toString());
        choose.addEventListener('click',function(e){
          e.stopPropagation();menu.hidden=true;setCut(c.id);syncCuts();});
        box.appendChild(choose);
        [[bic('pen'),'Rename',function(){return renameCut(c.id);}],
         [bic('exit'),'Delete',function(){return delCut(c.id);}]]
          .forEach(function(p){
            var b=document.createElement('button');
            b.className='dbtn pl-cutact';
            b.innerHTML=p[0]+' ';
            b.appendChild(document.createTextNode(p[1]));
            b.title=p[1]+' the “'+c.name+'” version';
            b.addEventListener('click',function(e){
              e.stopPropagation();if(p[2]()) syncCuts();});
            box.appendChild(b);
          });
        add(box);
      });
      var nb=document.createElement('button');
      nb.className='dbtn dc-mi';
      nb.textContent='New version…';
      nb.title='Name a shorter cut of this same deck — no second '
        +'file, no diverging copies';
      nb.addEventListener('click',function(e){
        e.stopPropagation();menu.hidden=true;
        var nm=prompt('Name for this version:','20-min');
        if(nm==null) return;
        nm=nm.trim();if(!nm) return;
        var id=newCut(nm);if(!id) return;
        toast('“'+nm+'” created — right-click a '
          +'slide to put it in');
        setCut(id);syncCuts();
      });
      add(nb);
      var sep=document.createElement('div');
      sep.className='hd-lab';sep.textContent='play';
      add(sep);
    }
    wrap.addEventListener('click',syncCuts);
    mi('#pl-here',function(){$('#dc-play').click();});
    mi('#pl-start',function(){cur=0;refresh();$('#dc-play').click();});
    mi('#pl-presenter',openPresenter);
    mi('#pl-notes',function(){
      if(window.SemDeckNotes) window.SemDeckNotes();});
    function syncTap(){
      var b=$('#pl-tap'); if(!b) return;
      b.textContent='Click a figure to enlarge it: '
        +(pres&&pres.tapzoom?'on':'off');
      b.title=pres&&pres.tapzoom
        ?'Clicking an item during the talk blows it up. Clicking anywhere '
          +'else still moves you on.'
        :'Off: a click anywhere moves the talk on, and Alt+click (or Z) '
          +'blows up whatever is under the pointer.';
    }
    mi('#pl-tap',function(){
      if(pres.tapzoom) delete pres.tapzoom; else pres.tapzoom=1;
      markDirty();syncTap();
      toast(pres.tapzoom
        ?'Clicking a figure or a text box now enlarges it while presenting'
        :'Back to a plain click moving the talk on');
    });
    /* THE CODE TRAIL DOOR (T69). ONE flag suppresses the trail, the
       "Show code" pill, the up/down arrows and the scroll region
       together, because updateVNav shows the pill purely from whether a
       .vtrace node exists and renderSlide is the only thing that ever
       builds one -- so the gate goes there and nothing else has to know.
       Stored as hideTrace (SUPPRESSION) rather than showTrace, so every
       deck already saved keeps the trail it has with no migration. */
    function syncTrace(){
      var b=$('#pl-trace'); if(!b) return;
      b.textContent='Show the code trail under the slide: '
        +(pres&&pres.hideTrace?'off':'on');
      b.title=pres&&pres.hideTrace
        ?'Off: the slide is the whole screen and nothing scrolls under '
          +'it. The lineage is still there in the notebook.'
        :'On: the cells that made each figure sit under the slide -- '
          +'scroll, or press the Show code pill, to reach them.';
    }
    mi('#pl-trace',function(){
      if(pres.hideTrace) delete pres.hideTrace; else pres.hideTrace=1;
      markDirty();syncTrace();
      /* the menu lives in the builder chrome, so this is normally set
         between talks -- but re-render if it somehow fires mid-talk */
      if(mode==='view') renderSlide();
      toast(pres.hideTrace
        ?'The code trail is hidden while presenting'
        :'The code trail is back under every slide');
    });
    var plBtn=$('#dc-playmore');
    if(plBtn) plBtn.addEventListener('click',function(){
      syncTap();syncTrace();});
    syncTap();syncTrace();
  })();
  $('#dc-play').addEventListener('click',function(){
    presentFrom=mode;setUIMode('view');});
  var undoBtn=$('#dc-undo');
  if(undoBtn) undoBtn.addEventListener('click',undo);
  var redoBtn=$('#dc-redo');
  if(redoBtn) redoBtn.addEventListener('click',redo);
  $('#deck-exit').addEventListener('click',function(){
    setUIMode(presentFrom==='edit'?'edit':'create');});

  $('#deck-prev').addEventListener('click',function(){backStep();});
  $('#deck-next').addEventListener('click',function(){advance();});
  /* click the letterbox AROUND the slide to clear the selection (clicks on
     the canvas itself are already handled by the annot-layer). Scoped to the
     stage element only, so it never fights a fresh text/arrow placement. */
  if(stage) stage.addEventListener('mousedown',function(ev){
    if(mode!=='edit'||tool!=='select'||ev.target!==stage) return;
    var l=stage.querySelector('.annot-layer');
    if(l) selectAnnot(l,null);
  });
  /* ONE mode toggle: swaps between the slide editor and the notebook view */
  var editBtn=$('#dc-edit');
  if(editBtn) editBtn.addEventListener('click',function(){
    /* "Swap to notebooks" now actually goes to the notebooks. It used to
       run setUIMode('create'), landing you in the presentation BUILDER —
       slide layouts, slide strip, the lot — which is not where the label
       said you were going and is meaningless for a poster (2026-08-07,
       user: "it takes you to the view for presentations"). */
    if(mode==='edit') closeDeck();
    else if(pres.slides[cur]) setUIMode('edit');
  });
  var cxBtn=$('#et-cancel');
  if(cxBtn) cxBtn.addEventListener('click',function(){setTool('select');});
  $$('#edit-tools .et').forEach(function(b){
    /* pressing an armed tool again is the second way out, and the one
       people try first */
    b.addEventListener('click',function(){
      setTool(tool===b.dataset.tool?'select':b.dataset.tool);});
  });
  /* ---- "+ Shapes" dropdown: choose a shape, then draw it ---- */
  function shapeIcon(shp){
    var svg=document.createElementNS(SVGNS,'svg');
    svg.setAttribute('class','sh-ico');svg.setAttribute('viewBox','0 0 100 100');
    if(shp==='rect'){
      var rc=document.createElementNS(SVGNS,'rect');
      rc.setAttribute('x','12');rc.setAttribute('y','22');
      rc.setAttribute('width','76');rc.setAttribute('height','56');
      rc.setAttribute('rx','7');rc.setAttribute('fill','#c9d6e2');
      svg.appendChild(rc);
    } else if(shp==='ellipse'){
      var el=document.createElementNS(SVGNS,'ellipse');
      el.setAttribute('cx','50');el.setAttribute('cy','50');
      el.setAttribute('rx','42');el.setAttribute('ry','33');
      el.setAttribute('fill','#c9d6e2');svg.appendChild(el);
    } else if(SHAPE_GLYPH[shp]){
      var tx=document.createElementNS(SVGNS,'text');
      tx.setAttribute('x','50');tx.setAttribute('y','56');
      tx.setAttribute('text-anchor','middle');
      tx.setAttribute('dominant-baseline','central');
      tx.setAttribute('font-size','98');tx.setAttribute('font-weight','800');
      tx.setAttribute('fill','#c9d6e2');tx.textContent=SHAPE_GLYPH[shp];
      svg.appendChild(tx);
    } else {
      var p=document.createElementNS(SVGNS,'path');
      p.setAttribute('d',SHAPE_PATHS[shp]||'');
      p.setAttribute('fill','#c9d6e2');svg.appendChild(p);
    }
    return svg;
  }
  (function(){
    var shBtn=$('#sh-btn'),shMenu=$('#sh-menu'),shDrop=$('#sh-drop');
    if(!shBtn||!shMenu) return;
    /* Built by the same drawnOpt as every other drawn menu, so the two
       shape galleries — this one for INSERT and the Line & shape group's
       for CHANGING one — cannot look like different features. It used to
       write its own option element and add a caption under each icon,
       which made this the only drawn menu in the editor that spelled its
       pictures out (2026-08-17 audit). Names live in the tooltip, as
       PowerPoint's shape gallery does. */
    SHAPE_LIST.forEach(function(pair){
      drawnOpt(shMenu,shBtn,pair[1],shapeIcon(pair[0]),'ins:'+pair[0],
        function(){pendingShape=pair[0];setTool('rect');});
    });
    shBtn.addEventListener('click',function(e){
      e.stopPropagation();
      var willOpen=shMenu.hidden;
      shMenu.hidden=!willOpen;
      shBtn.setAttribute('aria-expanded',willOpen.toString());
    });
    document.addEventListener('click',function(e){
      if(!shMenu.hidden&&shDrop&&!shDrop.contains(e.target)){
        shMenu.hidden=true;shBtn.setAttribute('aria-expanded','false');}
    });
  })();
  /* ---- WHAT KIND OF TEXT BOX ------------------------------------------
     The caret beside Insert > Text, built like the Shapes gallery beside
     it: pick, and the tool arms. Naming a box as you make it is the half
     of named styles that was missing — until now the only way to get a
     Heading 2 was to draw a plain box and then go and find the Styles
     menu (2026-08-22).
     The armed type is NOT written into the button's label. deck.js
     records the rule where the format bar is built: a label whose width
     changes with what you clicked makes the ribbon's required width
     depend on the selection, and the fit ladder has no rung left to
     absorb that. It shows in the caret's tooltip, in the pressed state
     of the menu row, and in the tool hint — exactly where pendingShape
     shows. */
  (function(){
    var btn=$('#tx-type-btn'),menu=$('#tx-type-menu'),drop=$('#tx-drop');
    if(!btn||!menu) return;
    function syncCaret(){
      var d=pendingStyle&&styleDef(pendingStyle);
      btn.title=d
        ?('The next text box will be a '+d.label
          +'. Click to change it or go back to plain text')
        :'Make the next text box a heading, a caption or any other named '
          +'type, instead of a plain one';
    }
    function build(){
      menu.innerHTML='';
      menuHead(menu,'make the next text box a');
      var rows=[['','Plain text box',null]];
      styleOrder().forEach(function(id){
        rows.push([id,styleDef(id).label,styleDef(id)]);});
      rows.forEach(function(r){
        var b=document.createElement('button');
        b.className='dbtn vw-opt jv-styleopt';
        b.setAttribute('aria-pressed',(pendingStyle===r[0]).toString());
        var t=document.createElement('span');
        t.className='jv-stylename';t.textContent=r[1];
        /* the row is a SPECIMEN, the same way the Styles menu's rows are:
           you pick by looking rather than by reading a number */
        if(r[2]){
          t.style.fontWeight=r[2].b?'700':'400';
          if(r[2].i) t.style.fontStyle='italic';
          t.style.fontSize=Math.max(11,Math.min(21,r[2].size*3.1))+'px';
          if(r[2].color) t.style.color=tokVal(r[2].color);
          if(r[2].font) t.style.fontFamily=fontCss(r[2].font);
        }
        b.appendChild(t);
        if(r[2]){
          var n=document.createElement('span');
          n.className='jv-stylesz';
          n.textContent=Math.round(r[2].size*5.4)+' pt';
          b.appendChild(n);
        }
        b.addEventListener('click',function(e){
          e.stopPropagation();
          pendingStyle=r[0];
          menu.hidden=true;
          btn.setAttribute('aria-expanded','false');
          syncCaret();
          setTool('text');
        });
        menu.appendChild(b);
      });
    }
    btn.addEventListener('click',function(e){
      /* stopPropagation, and no `et` class and no data-tool on this
         button: the shared tool wiring would otherwise arm setTool(
         undefined) off it */
      e.stopPropagation();
      var open=menu.hidden;
      if(open) build();
      menu.hidden=!open;
      btn.setAttribute('aria-expanded',open?'true':'false');
      if(open) floatMenu(btn,menu);
    });
    document.addEventListener('click',function(e){
      if(!menu.hidden&&drop&&!drop.contains(e.target)){
        menu.hidden=true;btn.setAttribute('aria-expanded','false');}
    });
    syncCaret();
  })();
  var downBtn=$('#deck-down');
  if(downBtn) downBtn.addEventListener('click',scrollToTrace);
  var upBtn=$('#deck-up');
  if(upBtn) upBtn.addEventListener('click',scrollToSlide);
  var vfClose=$('#vfull-close');
  if(vfClose) vfClose.addEventListener('click',closeVFull);
  /* ---- "Plot trace" opens a new DOCS tab, subset to the cells that build
     this plot. The deck (which owns the lineage) hands the cell ids + a
     dependency graph to the docs side, which clones those cards into a tab —
     every document filter and button keeps working because the tab IS made
     of real document cards. ---- */
  window.SemTrace={
    open:function(stem,anchor){
      var it=traceItemFor(stem,anchor); if(!it) return;
      if(!(window.SemApp&&window.SemApp.openTraceTab)) return;
      var group=lineageForItem(it.ns);
      var ids={},list=[];
      if(group) group.steps.forEach(function(s){
        if(s.card&&!ids[s.card]){ids[s.card]=1;list.push(s.card);}});
      if(it.card&&!ids[it.card]) list.push(it.card);   /* the plot itself */
      var graph=group?plotGraph(group,function(step){
        if(window.SemApp.traceGoto) window.SemApp.traceGoto(step.card);
      }):null;
      window.SemApp.openTraceTab(
        it.nb,list,it.title||'Plot trace',graph,anchor);
    }
  };
  /* close any open code-trail filter menu on an outside click */
  document.addEventListener('click',function(e){
    $$('.vo-fmenu').forEach(function(m){
      if(!m.hidden&&m.parentNode&&!m.parentNode.contains(e.target))
        m.hidden=true;});
  });
  /* ---- "Notebooks" popover in the deck header ---- */
  document.addEventListener('fullscreenchange',function(){
    /* Esc always exits browser fullscreen (the page cannot prevent
       it), so Esc while presenting leaves the presentation entirely —
       never a windowed half-presentation state. Inner layers (the code
       overlay, the trace) close via their own ✕ / scroll instead. */
    if(document.fullscreenElement) return;
    if(mode!=='view'||deckEl.hidden) return;
    closeVFull();
    /* BACK WHERE YOU WERE: presenting from the editor returned to the
       builder, a view you then had to climb out of via "Open the editor"
       (2026-08-19, user: "takes you to some cursed view") */
    setUIMode(presentFrom==='edit'?'edit':'create');
  });
  document.addEventListener('keydown',function(e){
    if(picking>=0){
      if(e.key==='Escape'){e.preventDefault();endPick();}
      return;
    }
    if(deckEl.hidden) return;
    /* while the document is being presented full screen over an open
       builder, its own Esc / Ctrl+Z own the keyboard — don't let the deck
       also close or undo underneath it */
    if(document.body.classList.contains('doc-presenting')) return;
    var tag=(e.target.tagName||'').toLowerCase();
    if(tag==='input'||tag==='select'||tag==='textarea') return;
    /* BEFORE the early return: Ctrl+S while a caret is in a text box was
       not handled here at all, so it was not preventDefault'ed either and
       the browser's own "Save page as..." dialog opened over the editor,
       saving nothing. Flush first, then let the save branch below run. */
    if(e.target.isContentEditable){
      if((e.ctrlKey||e.metaKey)&&(e.key==='s'||e.key==='S')) flushTextEdits();
      else return;
    }
    if(e.key==='Escape'){
      var vf=$('#vfull');
      /* an armed match is the OUTERMOST mode you can be standing in — you
         cannot be trimming or inside a group while the canvas is a
         picker — so it goes first and swallows the key */
      if(slideArm){e.preventDefault();cancelSlideMatch();return;}
      if(matchArm){e.preventDefault();cancelMatch();return;}
      if(vf&&!vf.hidden) closeVFull();
      /* trim mode is the innermost state: the first Esc leaves IT,
         keeping the selection, before any tool/selection drops */
      else if(mode==='edit'&&cropMode){setCropMode(false);}
      /* then the group you have stepped into — also inner, and also worth
         keeping the selection through (2026-08-20) */
      else if(mode==='edit'&&inGroup!=null){
        leaveGroup(stage.querySelector('.annot-layer'));
        var lg=stage.querySelector('.annot-layer');
        if(lg&&typeof selAnnot==='number') selectAnnot(lg,selAnnot);
      }
      else if(spotEl){closeSpot();}
      else if(mode==='view'&&(stage.scrollTop||0)>50) scrollToSlide();
      else if(mode==='edit'
              &&(tool!=='select'||selAnnot!==null||selSet.length)){
        /* first Esc drops the tool / selection; the next one leaves the
           editor (there are no Select/Delete buttons — Esc and Del do it) */
        setTool('select');
        var l=stage.querySelector('.annot-layer');
        if(l) selectAnnot(l,null);
        else {selAnnot=null;selSet=[];showFmt();}
      }
      /* leaving a presentation goes back to WHERE IT STARTED — Esc is the
         third exit route (exit button and fullscreen-change had this, the
         Esc branch still dumped an edit-mode presenter into the builder:
         the "cursed view", 2026-08-20 re-verify) */
      else if(mode==='view')
        setUIMode(presentFrom==='edit'?'edit':'create');
      else if(mode==='edit'){setUIMode('create');}
      else closeDeck();
    }
    else if((e.ctrlKey||e.metaKey)&&(e.key==='z'||e.key==='Z')
            &&mode!=='view'){
      e.preventDefault();
      if(e.shiftKey) redo(); else undo();
    }
    else if((e.ctrlKey||e.metaKey)&&(e.key==='y'||e.key==='Y')
            &&mode!=='view'){
      e.preventDefault();redo();
    }
    else if((e.ctrlKey||e.metaKey)&&(e.key==='s'||e.key==='S')){
      /* saves to wherever "Saved to" points, exactly like the Save button
         (2026-08-19, user: "more shortcuts — ctrl+s"). Present mode still
         swallows it so the browser's save dialog never covers a talk. */
      e.preventDefault();
      if(mode!=='view'){var sb2=$('#dc-save');if(sb2) sb2.click();}
    }
    else if((e.ctrlKey||e.metaKey)&&e.key==='F1'&&mode==='edit'){
      /* PowerPoint's own shortcut for the same thing (2026-08-20) */
      e.preventDefault();setRibbonFold(!ribbonFolded());
    }
    else if((e.ctrlKey||e.metaKey)&&(e.key==='f'||e.key==='F')
            &&mode!=='view'){
      /* the browser's own find can only see the ONE slide that is
         rendered, which for a deck is almost always the wrong answer —
         so Ctrl+F opens the deck's find instead (2026-08-20) */
      e.preventDefault();
      if(window.SemDeckFind) window.SemDeckFind();
    }
    else if(mode==='edit'){
      if(e.key==='Delete'||e.key==='Backspace'){
        e.preventDefault();deleteSel();
      }
      /* SELECT EVERYTHING ON THIS SLIDE. There was no Ctrl+A at all, so
         the one shortcut every person reaches for when "selecting
         multiple objects" fell straight through to the BROWSER's
         Select All: the entire document highlighted and not one object
         selected -- "it just results in everything being selected"
         (T63). Hidden and fully locked items stay out, the same rule
         the marquee follows; hold Alt as well to sweep the locked ones
         in, exactly as an Alt-marquee does. A caret in a text box never
         reaches here (the isContentEditable early return above), so
         Ctrl+A still means "select these words" while typing. */
      else if((e.ctrlKey||e.metaKey)&&(e.key==='a'||e.key==='A')){
        e.preventDefault();
        var sA=pres.slides[cur],lA=stage.querySelector('.annot-layer');
        var allA=[];
        ((sA&&sA.annots)||[]).forEach(function(a,i){
          if(!a||a.hide) return;
          if(lockedAll(a)&&!e.altKey) return;
          allA.push(i);
        });
        leaveGroup(lA);
        selectMany(lA,allA);
        toast(allA.length
          ?(allA.length+' item'+(allA.length===1?'':'s')+' selected')
          :'Nothing on this slide to select');
      }
      /* T93, AND IT MUST COME FIRST. The plain branch below matches 'D'
         as well as 'd', and e.key is 'D' whenever Shift is down -- so
         Ctrl+Shift+D already fired today as a silent alias for plain
         Duplicate. Putting the variant above it spends no new key and
         retires the alias. Exactly the ordering the two placed pastes
         further down are written around. */
      else if((e.ctrlKey||e.metaKey)&&e.shiftKey
              &&(e.key==='d'||e.key==='D')){
        e.preventDefault();duplicateSel(1);
      }
      else if((e.ctrlKey||e.metaKey)&&(e.key==='d'||e.key==='D')){
        e.preventDefault();duplicateSel();
      }
      /* copy and cut; PASTE rides the real paste event instead, so a
         system-clipboard image can come in too */
      else if((e.ctrlKey||e.metaKey)&&(e.key==='c'||e.key==='C')){
        var nc=copySel();
        if(nc){e.preventDefault();
          toast(nc+' item'+(nc===1?'':'s')+' copied');}
      }
      else if((e.ctrlKey||e.metaKey)&&(e.key==='x'||e.key==='X')){
        var nx=cutSel();
        if(nx){e.preventDefault();
          toast(nx+' item'+(nx===1?'':'s')+' cut');}
      }
      /* the two PLACED pastes. They come first because the plain-paste
         branch below matches 'v' and 'V' alike and would swallow them,
         and they preventDefault because there is nothing the native
         paste event could add: the buffer is ours. */
      else if((e.ctrlKey||e.metaKey)&&e.shiftKey
              &&(e.key==='v'||e.key==='V')){
        e.preventDefault();tookPaste();
        if(!clipBuf.length) toast('Nothing copied yet');
        else {pasteBuf('place');
          toast('Pasted in place — the coordinates it was copied '
            +'from');}
      }
      else if((e.ctrlKey||e.metaKey)&&e.altKey
              &&(e.key==='v'||e.key==='V')){
        e.preventDefault();tookPaste();
        if(!clipBuf.length) toast('Nothing copied yet');
        else {pasteBuf('here');
          toast(pointerPct()?'Pasted at the pointer'
            :'Pasted in the middle — the pointer was off the page');}
      }
      /* NOT preventDefaulted: the native paste event stays the primary
         path (it can carry a system-clipboard image). This one-shot timer
         only fires where that event never arrives, so an internal copy
         still pastes there (2026-08-20) */
      else if((e.ctrlKey||e.metaKey)&&(e.key==='v'||e.key==='V')){
        if(pendingPaste) clearTimeout(pendingPaste);
        pendingPaste=setTimeout(function(){
          pendingPaste=null;
          if(clipBuf.length) pasteBuf();
        },150);
      }
      else if((e.ctrlKey||e.metaKey)&&(e.key==='g'||e.key==='G')){
        e.preventDefault();
        if(e.shiftKey) ungroupSel(); else groupSel();
      }
      else if(e.key.indexOf('Arrow')===0
              &&(selSet.length||selAnnot!==null)){
        e.preventDefault();
        var st=e.shiftKey?2:0.4;
        nudgeSel(e.key==='ArrowLeft'?-st:e.key==='ArrowRight'?st:0,
                 e.key==='ArrowUp'?-st:e.key==='ArrowDown'?st:0);
      }
      /* with NOTHING selected, up/down walk the deck like the thumbnail
         strip (2026-08-19, user: "pressing the down key on the slide
         thumbnails should move you through the slides") */
      else if(!e.ctrlKey&&!e.metaKey
              &&(e.key==='ArrowDown'||e.key==='ArrowUp'
                 ||e.key==='PageDown'||e.key==='PageUp')){
        var dd=(e.key==='ArrowDown'||e.key==='PageDown')?1:-1;
        var nn=cur+dd;
        if(nn>=0&&nn<pres.slides.length){
          e.preventDefault();
          cur=nn;activePane=-1;selAnnot=null;selSet=[];refresh();
        }
      }
      /* Z spotlights whatever the pointer is over. Alt+click does the
         same with the mouse alone; this is the version you can use from a
         lectern with a clicker in one hand (2026-08-20). */
      else if(!e.ctrlKey&&!e.metaKey&&(e.key==='z'||e.key==='Z')
              &&mode==='view'){
        e.preventDefault();
        if(spotEl) closeSpot(); else if(spotHover) spotlight(spotHover);
      }
      /* R rulers, G grid — plain keys, so Ctrl+G still groups. H and B
         join them for the guides you drew yourself: H shows or hides
         them (Photoshop's Ctrl+H, without the Ctrl this row does not
         use), B arms the Box. Each DRIVES THE REAL BUTTON rather than
         calling the handler, so the key and the ribbon can never come to
         disagree about what the toggle now says. */
      else if(!e.ctrlKey&&!e.metaKey&&(e.key==='r'||e.key==='R')){
        e.preventDefault();
        var rb=$('#vw-rulers'); if(rb) rb.click();
      }
      else if(!e.ctrlKey&&!e.metaKey&&(e.key==='g'||e.key==='G')){
        e.preventDefault();
        var gb=$('#vw-grid'); if(gb) gb.click();
      }
      else if(!e.ctrlKey&&!e.metaKey&&(e.key==='h'||e.key==='H')){
        e.preventDefault();
        var hb=$('#vw-guides'); if(hb) hb.click();
      }
      else if(!e.ctrlKey&&!e.metaKey&&(e.key==='b'||e.key==='B')){
        e.preventDefault();
        var bb=$('#vw-guidebox');
        /* the button is the door, but it can be hidden by the fit ladder
           or by T11's customiser, and a shortcut must not go with it */
        if(bb&&!bb.hidden) bb.click();
        else setTool(tool==='guide'?'select':'guide');
      }
      /* page zoom from the keyboard, mirroring the -/Fit/+ buttons */
      else if(!e.ctrlKey&&!e.metaKey
              &&(e.key==='+'||e.key==='='||e.key==='-'||e.key==='0')){
        var zb=$(e.key==='-'?'#zoom-out'
          :e.key==='0'?'#zoom-val':'#zoom-in');
        if(zb){e.preventDefault();zb.click();}
      }
    }
    else if(mode==='view'){
      /* FIND A SLIDE, MID-TALK. "/" is the type-to-search key everywhere
         else on a keyboard, and the map it opens is the one T26 already
         built -- so this is a door, not a second piece of navigation
         (T30). */
      if(!e.ctrlKey&&!e.metaKey&&!e.altKey
         &&(e.key==='l'||e.key==='L')){
        var late=$('#deck-late');
        if(late){e.preventDefault();late.click();}
        return;
      }
      if(e.key==='/'||((e.ctrlKey||e.metaKey)&&(e.key==='f'||e.key==='F'))){
        e.preventDefault();
        openOverview();
        var fi=$('#ovw-find'); if(fi) fi.focus();
        return;
      }
      if(e.key==='ArrowRight'||e.key==='PageDown'
         ||(e.key===' '&&tag!=='button')){e.preventDefault();advance();}
      else if(e.key==='ArrowLeft'||e.key==='PageUp'){
        e.preventDefault();backStep();}
      else if(e.key==='ArrowDown'){
        e.preventDefault();
        if((stage.scrollTop||0)<60) scrollToTrace();
        else stage.scrollBy({top:stage.clientHeight*0.7,
          behavior:'smooth'});
      }
      else if(e.key==='ArrowUp'){
        e.preventDefault();
        if((stage.scrollTop||0)<=stage.clientHeight*0.8) scrollToSlide();
        else stage.scrollBy({top:-stage.clientHeight*0.7,
          behavior:'smooth'});
      }
    }
    /* F5 — the PowerPoint convention — presents from the current slide
       in either editing view (it shadows the browser's refresh only
       while the editor is open, a deliberate trade) */
    if(e.key==='F5'&&(mode==='edit'||mode==='create')){
      var pl=$('#dc-play');
      if(pl){e.preventDefault();pl.click();}
    }
  });
  /* every deck shortcut is advertised in its button's tooltip, exactly
     like the document ribbon's (the data-kbd chip in app.js) */
  [['#dc-play','F5'],['#dc-undo','Ctrl+Z'],['#dc-redo','Ctrl+Y'],
   ['#dc-save','Ctrl+S'],['#fmt-dup','Ctrl+D'],
   ['#zoom-in','+'],['#zoom-out','-'],['#zoom-val','0'],
   ['#deck-late','L']]
    .forEach(function(p){
      var el=$(p[0]); if(el) el.dataset.kbd=p[1];});

  /* ---------- create mode: click a card in ANY open tab to place it */
  document.addEventListener('click',function(e){
    if(deckEl.hidden||mode!=='create') return;
    var t=e.target;
    if(!t||!t.closest) return;
    if(deckEl.contains(t)) return;
    if(t.closest('.apptop,.opendlg,.welcome')) return;
    var shellEl=t.closest('.nbshell');
    if(!shellEl) return;
    var card=t.closest('.card');
    if(!card) return;
    if(t.closest('.codetoggle,.depchip,a')) return;
    var s=pres.slides[cur];
    if(!s){pres.slides.push(emptySlide());cur=pres.slides.length-1;
      s=pres.slides[cur];}
    if(s.layout==='title'){
      e.preventDefault();e.stopPropagation();
      toast('This is a title slide — pick a layout to add card frames');
      return;
    }
    /* a Plot-trace tab's cards are clones — resolve to the real notebook */
    var ref=nsKey(shellEl.dataset.src||shellEl.dataset.nb,
      card.dataset.anchor);
    if(slideCells(s).some(function(c){return c.a.ref===ref;})){
      e.preventDefault();e.stopPropagation();
      toast('That card is already on this slide');
      card.classList.add('target-flash');
      setTimeout(function(){card.classList.remove('target-flash');},700);
      return;
    }
    /* placement: an ARMED frame wins; with none armed the card takes the
       first EMPTY frame in reading order. Poster templates ship full of
       placeholder frames, and demanding a selection before every single
       click made "Swap to notebooks" feel broken (2026-08-04) — in
       create mode clicking a card IS the intent to place it, so
       successive clicks fill successive slots. A slide with no frames
       at all still creates one. */
    var target=annotByIdx(s,activePane);
    if(!target||target.k!=='cell'||target.ref){
      if(slideCells(s).length===0){
        s.annots=s.annots||[];
        /* the SAME rect a blank slide used to be born with, so
           clicking a card onto an empty slide lands exactly where it
           always did now that emptySlide leaves the page bare (T61) */
        s.annots.push(fullFrame(null));
        target=annotByIdx(s,s.annots.length-1);
      } else {
        var best=null;
        (s.annots||[]).forEach(function(a){
          if(a.k!=='cell'||a.ref) return;
          if(!best||a.y<best.y-0.5
             ||(Math.abs(a.y-best.y)<=0.5&&a.x<best.x)) best=a;
        });
        if(best) target=best;
        else {
          toast('Every frame is full — select a frame on the page '
            +'to replace');
          return;
        }
      }
    }
    e.preventDefault();e.stopPropagation();
    target.ref=ref;
    activePane=-1;   /* disarm: adding again needs a fresh frame selection */
    markDirty();refresh();
    card.classList.add('target-flash');
    setTimeout(function(){card.classList.remove('target-flash');},700);
  },true);

  /* ---------- create mode: slide + presentation operations ---------- */
  $('#film-add').addEventListener('click',newVersion);
  /* ---- the slide column's own three controls ---------------------------
     Section, the display-mode chooser and the drag handle. All three are
     about the STRIP, so all three live on it rather than in a ribbon that
     has no room and cannot see what it is acting on (2026-08-22). */
  (function(){
    var sec=$('#film-sec');
    if(sec) sec.addEventListener('click',function(){
      newSection(cur,'New section');
      /* the name is the point of a section, so ask for it straight away
         rather than leaving "New section" sitting there */
      var runs=sectionRuns(),i;
      for(i=0;i<runs.length;i++)
        if(runs[i].at<=cur&&cur<runs[i].at+runs[i].n&&runs[i].id)
          {renameSection(runs[i].id);break;}
    });
    var btn=$('#film-view-btn'),menu=$('#film-view-menu');
    function label(){
      var pg=pageOf().poster?2:1,m=filmMode(),i;
      for(i=0;i<FILM_VIEWS.length;i++)
        if(FILM_VIEWS[i][0]===m) return FILM_VIEWS[i][pg];
      return FILM_VIEWS[0][pg];
    }
    function syncFilmBtn(){
      if(btn) btn.innerHTML=bic('layouts')+' '+label()+' &#9662;';
    }
    function setFilmMode(m){
      /* the overview is a VIEW of the deck, not a mode of the strip: it
         opens and the strip keeps whatever it was showing */
      if(m==='overview'){openOverview();return;}
      filmView=m;
      lsSet(FILMKEY+SCOPE,m);
      syncFilmBtn();renderFilm();
    }
    if(btn&&menu){
      btn.addEventListener('click',function(e){
        e.stopPropagation();
        var open=menu.hidden;
        if(open){
          menu.innerHTML='';
          var pg=pageOf().poster?2:1;
          FILM_VIEWS.forEach(function(v){
            var b=document.createElement('button');
            b.className='dc-mi';
            b.textContent=v[pg];
            b.setAttribute('aria-pressed',(filmMode()===v[0]).toString());
            b.addEventListener('click',function(ev){
              ev.stopPropagation();menu.hidden=true;setFilmMode(v[0]);});
            menu.appendChild(b);
          });
        }
        menu.hidden=!open;
        btn.setAttribute('aria-expanded',open?'true':'false');
      });
      document.addEventListener('click',function(e){
        if(!menu.hidden&&!menu.contains(e.target)&&e.target!==btn)
          menu.hidden=true;
      });
      syncFilmBtn();
      window.SemDeckFilmBtn=syncFilmBtn;
    }
    /* the drag. --film-w is set on the DECK and never on --dc-w, which
       the document view's own margin also reads — overloading that one
       makes dragging the slide column shove the notebook sideways. */
    var h=$('#film-resize');
    var wPref=parseInt(lsGet(FILMWKEY+SCOPE),10);
    if(wPref>=150&&wPref<=900)
      deckEl.style.setProperty('--film-w',wPref+'px');
    if(h) h.addEventListener('pointerdown',function(e){
      e.preventDefault();
      h.classList.add('on');
      try{h.setPointerCapture(e.pointerId);}catch(err){}
      /* the ceiling is measured ONCE, here: the ribbon cannot change what
         it holds while you are holding the handle, and re-measuring would
         stamp the whole density ladder on and off sixty times a second */
      var hi=fitFilmMax();
      var w=0;
      function mv(ev){
        w=Math.max(150,Math.min(hi,ev.clientX));
        deckEl.style.setProperty('--film-w',w+'px');
        /* the stage just lost or gained that width, so the page has to
           re-fit as you drag or the slide sits wrong until you let go */
        applyZoom();
      }
      function up(){
        h.classList.remove('on');
        document.removeEventListener('pointermove',mv);
        document.removeEventListener('pointerup',up);
        /* ONE re-render at the end: the thumbnails re-measure their type
           off the new width, and doing that on every pointermove would
           rebuild sixty <svg>s a second */
        if(w){lsSet(FILMWKEY+SCOPE,String(w));renderFilm();}
        /* ...and ONE run of the fit ladder, so the row settles on the rung
           its new width earns. #edit-tools' ResizeObserver re-fits it live
           as the column moves; this is what guarantees the final state,
           and re-publishes --film-max for the next drag (T80) */
        fitFilmMax();fitEditRibbon();
      }
      document.addEventListener('pointermove',mv);
      document.addEventListener('pointerup',up);
    });
  })();
  /* (the picker's first render runs from THE BOOT SEQUENCE) */
  /* title-slide text fields (panel); the slide canvas mirrors them */
  [['#ts-title','title'],['#ts-sub','sub']].forEach(function(p){
    var inp=$(p[0]); if(!inp) return;
    inp.addEventListener('input',function(){
      var s=pres.slides[cur];
      if(!s||s.layout!=='title') return;
      s[p[1]]=this.value;
      markDirty();renderFilm();
      if(mode==='edit') renderSlide();
    });
  });
  /* ---- File menu ---- */
  var fileBtn=$('#dc-file'), fileMenu=$('#dc-menu');
  function closeMenu(){
    if(fileMenu&&!fileMenu.hidden){
      fileMenu.hidden=true;
      fileBtn.setAttribute('aria-expanded','false');
    }
  }
  if(fileBtn){
    fileBtn.addEventListener('click',function(e){
      e.stopPropagation();
      var open=!fileMenu.hidden;
      fileMenu.hidden=open;
      fileBtn.setAttribute('aria-expanded',(!open).toString());
      /* floated (position:fixed) so fitQat's scroll floor can never
         cut the menu off at the bar's edge */
      if(!open) floatMenu(fileBtn,fileMenu);
    });
    document.addEventListener('click',function(e){
      if(!fileMenu.hidden&&!fileMenu.contains(e.target)) closeMenu();
    });
  }
  function menuAction(id,fn){
    var b=$(id);
    if(b) b.addEventListener('click',function(){closeMenu();fn();});
  }
  menuAction('#mi-new',newPresentation);
  /* ONE rename, reached from the File menu and from the name in the top
     bar. It used to un-hide #pres-name, which lives in .dc-controls — a
     block that is display:none the whole time you are editing, so the
     input was 0x0 and unfocusable and File ▸ Rename… appeared to do
     nothing at all in the primary flow (2026-08-20 diagnosis). */
  menuAction('#mi-rename',startQatRename);
  var qatName=$('#qat-name');
  if(qatName) qatName.addEventListener('click',startQatRename);
  menuAction('#mi-auto-figs',function(){
    pres.slides=autoSlides(false);cur=0;activePane=0;
    markDirty();refresh();
    toast(pres.slides.length+' slides: one per figure, in order');
  });
  menuAction('#mi-auto-figdocs',function(){
    pres.slides=autoSlides(true);cur=0;activePane=0;
    markDirty();refresh();
    toast(pres.slides.length+' slides: figures + docs, in order');
  });
  function updateNumsLabel(){
    var b=$('#mi-nums');
    if(b) b.textContent='Slide numbers: '+(pres.showNums?'on':'off');
  }
  menuAction('#mi-nums',function(){
    if(pres.showNums){delete pres.showNums;} else {pres.showNums=1;}
    updateNumsLabel();markDirty();refresh();
    toast('Slide numbers '+(pres.showNums?'on':'off'));
  });
  function updateCropLabel(){
    var b=$('#mi-crop');
    if(b) b.textContent='Crop marks: '+(pres.cropMarks?'on':'off');
  }
  menuAction('#mi-crop',function(){
    if(pres.cropMarks){delete pres.cropMarks;} else {pres.cropMarks=1;}
    updateCropLabel();markDirty();
    toast(pres.cropMarks
      ?'Crop marks on — the exported sheet grows '+BLEED_MM
        +'mm on each side; the page keeps its exact size'
      :'Crop marks off');
  });
  $('#pres-name').addEventListener('input',function(){
    /* NOTHING happens per keystroke any more. This used to set pres.name
       and lsDel the old draft on every letter typed, so renaming "talk"
       to "talk2" walked through "tal", "ta", "t" — deleting the draft
       under each prefix on the way and leaving four half-named ghosts in
       the rail (2026-08-20 diagnosis). Renaming is a single committed
       action; see renamePresentation. */
  });
  $('#pres-name').addEventListener('keydown',function(e){
    if(e.key==='Enter'||e.key==='Escape') this.blur();
    e.stopPropagation();
  });
  $('#pres-name').addEventListener('blur',function(){
    this.hidden=true;
    var lbl=$('#pres-current');
    if(lbl) lbl.hidden=false;
    if(this.value.trim()) renamePresentation(this.value.trim());
    renderPresRow();
  });

  /* ---- watermark / header / footer, edited in one small prompt each --
     A dialog would be a whole modal for three fields nobody changes twice
     a year; a prompt says exactly what it wants and leaves the ribbon
     button showing whether the thing is on. Empty turns it off, which is
     the same gesture as clearing any other field. */
  function furnEdit(key,label,hint,dflt){
    var cur_=pres[key]||{};
    var v=prompt(label+'\n\n'+hint,cur_.text||dflt||'');
    if(v===null) return;
    v=v.trim();
    if(!v) delete pres[key];
    else {
      pres[key]=pres[key]||{};
      pres[key].text=v;
      if(key==='wmark'){
        if(pres[key].size==null) pres[key].size=12;
        if(pres[key].op==null) pres[key].op=0.12;
      } else if(pres[key].size==null) pres[key].size=2;
    }
    markDirty();refresh();syncFurnBtns();
    toast(v?(label+' set'):(label+' removed'));
  }
  function syncFurnBtns(){
    [['#dc-wmark','wmark'],['#dc-head','head'],['#dc-foot','foot']]
      .forEach(function(p2){
        var b=$(p2[0]); if(!b) return;
        var on=!!(pres[p2[1]]&&String(pres[p2[1]].text||'').trim());
        b.setAttribute('aria-pressed',on?'true':'false');
      });
    var nb=$('#dc-nums');
    if(nb) nb.setAttribute('aria-pressed',pres.showNums?'true':'false');
  }
  var wmB=$('#dc-wmark');
  if(wmB) wmB.addEventListener('click',function(){
    furnEdit('wmark','Watermark',
      'One word or phrase, printed faintly across every page and always '
      +'BEHIND your content.\nLeave it empty to remove it.','DRAFT');
  });
  var hdB=$('#dc-head');
  if(hdB) hdB.addEventListener('click',function(){
    furnEdit('head','Header',
      'A line along the top of every page.\n'
      +'{name} the presentation, {date} today, {n} this page, {N} the '
      +'total, {sn}/{sN} the number and count within the section, '
      +'{sec} its name.\nLeave it empty to remove it.','{name}');
  });
  var ftB=$('#dc-foot');
  if(ftB) ftB.addEventListener('click',function(){
    furnEdit('foot','Footer',
      'A line along the bottom of every page.\n'
      +'{name} the presentation, {date} today, {n} this page, {N} the '
      +'total, {sn}/{sN} the number and count within the section, '
      +'{sec} its name.\nLeave it empty to remove it.','{n} / {N}');
  });
  var numB=$('#dc-nums');
  if(numB) numB.addEventListener('click',function(){
    var mi=$('#mi-nums'); if(mi) mi.click();
    syncFurnBtns();
  });
