/* 20-notes-and-tables.js — the scratchpad, the style manager, lists, tables, and things only you can see.
   ONE FRAGMENT of deck.js's single IIFE, concatenated with its
   siblings in filename order by assets.deck_js(). It does not
   parse alone and is not meant to: see 00-page.js. */
  /* ---- THE SCRATCHPAD --------------------------------------------------
     Loose notes, in folders, belonging to the presentation rather than to
     any one slide (2026-08-20, user asked for "overall notes, and then
     also notes per slide, and make little notes and folders of notes").
     It is the place to put a thought without first deciding where it goes
     - which is the entire reason people keep a text file open beside
     their deck. Stored on pres.pad, so it travels with the file. */
  function padList(){
    if(!Array.isArray(pres.pad)) pres.pad=[];
    return pres.pad;
  }
  function renderPad(){
    var host=$('#np-padlist'); if(!host) return;
    host.innerHTML='';
    var items=padList();
    if(!items.length){
      host.innerHTML='<div class="selpane-empty">Nothing here yet. '
        +'Notes you put here belong to the talk, not to a slide.</div>';
      return;
    }
    /* folders first, each with the notes filed under it, then the loose
       ones - the same shape the Layers pane uses for groups */
    var folders=items.filter(function(n){return n.t==='f';});
    function noteRow(n,i){
      var row=document.createElement('div');row.className='np-note';
      var head=document.createElement('div');head.className='np-nhead';
      var ttl=document.createElement('input');
      ttl.className='np-ntitle';ttl.type='text';
      ttl.value=n.title||'';ttl.placeholder='untitled note';
      ttl.addEventListener('keydown',function(e){e.stopPropagation();});
      ttl.addEventListener('input',function(){
        n.title=ttl.value;markDirty();});
      head.appendChild(ttl);
      if(folders.length){
        var sel=document.createElement('select');
        sel.className='np-nfold';
        var o0=document.createElement('option');
        o0.value='';o0.textContent='(loose)';sel.appendChild(o0);
        folders.forEach(function(f){
          var o=document.createElement('option');
          o.value=f.id;o.textContent=f.title||'folder';
          sel.appendChild(o);});
        sel.value=n.folder||'';
        sel.title='Which folder this note is filed under';
        sel.addEventListener('change',function(){
          if(sel.value) n.folder=sel.value; else delete n.folder;
          markDirty();renderPad();});
        head.appendChild(sel);
      }
      var x=document.createElement('button');
      x.className='dbtn dc-icon np-nx';x.innerHTML=bic('exit');
      x.title='Delete this note';
      x.addEventListener('click',function(){
        var at=padList().indexOf(n);
        if(at>=0) padList().splice(at,1);
        markDirty();renderPad();});
      head.appendChild(x);
      row.appendChild(head);
      var body=document.createElement('textarea');
      body.className='np-nbody';body.value=n.body||'';
      body.placeholder='…';
      body.addEventListener('keydown',function(e){e.stopPropagation();});
      body.addEventListener('input',function(){
        n.body=body.value;markDirty();});
      row.appendChild(body);
      return row;
    }
    folders.forEach(function(f){
      var box=document.createElement('div');box.className='np-fold';
      var fh=document.createElement('div');fh.className='np-fhead';
      var ft=document.createElement('input');
      ft.className='np-ftitle';ft.type='text';
      ft.value=f.title||'';ft.placeholder='folder name';
      ft.addEventListener('keydown',function(e){e.stopPropagation();});
      ft.addEventListener('input',function(){
        f.title=ft.value;markDirty();});
      fh.appendChild(ft);
      var fx=document.createElement('button');
      fx.className='dbtn dc-icon np-nx';fx.innerHTML=bic('exit');
      fx.title='Delete the folder — its notes become loose';
      fx.addEventListener('click',function(){
        padList().forEach(function(n){
          if(n.folder===f.id) delete n.folder;});
        var at=padList().indexOf(f);
        if(at>=0) padList().splice(at,1);
        markDirty();renderPad();});
      fh.appendChild(fx);
      box.appendChild(fh);
      var any=false;
      items.forEach(function(n,i){
        if(n.t==='f'||n.folder!==f.id) return;
        any=true;box.appendChild(noteRow(n,i));});
      if(!any){
        var e2=document.createElement('div');
        e2.className='selpane-empty';e2.textContent='empty';
        box.appendChild(e2);
      }
      host.appendChild(box);
    });
    items.forEach(function(n,i){
      if(n.t==='f'||n.folder) return;
      host.appendChild(noteRow(n,i));});
  }
  /* THE REHEARSALS TAB. Per slide and per SECTION, because a section is
     the unit you actually cut ("the methods run long"), and sectionRuns()
     already knows the grouping -- so this reads the same clusters the
     strip and the overview map draw rather than inventing a third. */
  function renderReh(){
    var host=$('#np-rehlist'); if(!host) return;
    host.innerHTML='';
    var st=rehStats();
    if(!st.runs.length){
      host.innerHTML='<div class="selpane-empty">No rehearsals yet. '
        +'Present the deck and this fills in — a run counts once it '
        +'reaches a second slide and lasts half a minute.</div>';
      return;
    }
    function line(cls,label,secs,extra){
      var r=document.createElement('div');
      r.className='np-rehrow'+(cls?(' '+cls):'');
      var a=document.createElement('span');
      a.className='np-rehlab';a.textContent=label;
      var b=document.createElement('span');
      b.className='np-rehnum';b.textContent=fmtMins(secs/60);
      r.appendChild(a);r.appendChild(b);
      if(extra){
        var c=document.createElement('span');
        c.className='np-rehex';c.textContent=extra;
        r.appendChild(c);
      }
      host.appendChild(r);
      return r;
    }
    var head=document.createElement('div');
    head.className='np-rehhead';
    var tot=0;
    st.runs.forEach(function(r){tot+=r.total||0;});
    head.textContent=st.runs.length+' rehearsal'
      +(st.runs.length===1?'':'s')+' — '
      +fmtMins(tot/st.runs.length/60)+' on average'
      +(st.runs.length>=REH_KEEP
        ?(' (the last '+REH_KEEP+' are kept)'):'');
    host.appendChild(head);
    /* whole talk against the slot, which is the number you act on */
    if(pres.talkMins){
      var avg=tot/st.runs.length, want=pres.talkMins*60;
      line(avg>want?'over':'', 'against your '+pres.talkMins+'-minute slot',
        Math.abs(avg-want),
        avg>want?'over':'to spare');
    }
    sectionRuns().forEach(function(run){
      var secTot=0,secN=0;
      for(var k=0;k<run.n;k++){
        var sl=pres.slides[run.at+k];
        var a=sl&&sl.sid&&st.by[sl.sid];
        if(a){secTot+=a.mean;secN++;}
      }
      if(run.id||sectionRuns().length>1)
        line('sec',run.id?(run.name||'Section')
          :'(no section)',secTot,
          secN?(secN+' timed'):'none timed');
      for(var j=0;j<run.n;j++){
        (function(i){
          var sl=pres.slides[i];
          var a=sl&&sl.sid&&st.by[sl.sid];
          var g=slideGoal(sl);
          var row=line('slide',(i+1)+'. '+(filmText(sl)||'—'),
            a?a.mean:0,
            !a?'not timed'
              :g?((a.mean>g*60?'over ':'under ')+'target '+fmtMins(g))
              :(a.n+' run'+(a.n===1?'':'s')));
          if(a&&g&&a.mean>g*60) row.classList.add('over');
          row.addEventListener('click',function(){
            cur=i;selAnnot=null;selSet=[];refresh();});
        })(run.at+j);
      }
    });
    var clr=document.createElement('button');
    clr.className='dbtn np-padb';
    clr.innerHTML=bic('exit')+' Forget these rehearsals';
    clr.addEventListener('click',function(){
      askYes({title:'Forget '+st.runs.length+' rehearsal'
          +(st.runs.length===1?'':'s')+'?',
        what:'The timing from every run of this talk is deleted from this '
          +'computer. The slides and your notes are not touched.',
        ok:'Forget them',cancel:'Keep them',danger:true},function(y){
        if(y!==true) return;
        try{lsSet(rehKey(),'[]');}catch(e){}
        renderReh();renderNotesPane();
      });
    });
    host.appendChild(clr);
  }
  function renderNotesPane(){
    var pane=$('#notespane');
    if(!pane||pane.hidden) return;
    /* T564: this slide's narration, to hear or delete */
    if(typeof narrPaneSync==='function') narrPaneSync();
    var sl=pres.slides[cur];
    var ta=$('#np-notes'),gi=$('#np-goal'),ti=$('#np-total'),
        tot=$('#np-tot');
    if(ta&&document.activeElement!==ta) ta.value=(sl&&sl.notes)||'';
    /* T228: the target is stored in minutes and typed in two boxes,
       so 2:20 is sayable */
    var gs=$('#np-goalsec'),g0=slideGoal(sl)||0;
    if(gi&&document.activeElement!==gi)
      gi.value=g0?Math.floor(g0):'';
    if(gs&&document.activeElement!==gs)
      gs.value=g0?Math.round((g0-Math.floor(g0))*60):'';
    if(ti&&document.activeElement!==ti)
      ti.value=pres.talkMins||'';
    var dn=$('#np-decknotes');
    if(dn&&document.activeElement!==dn) dn.value=pres.notes||'';
    /* what you ACTUALLY take here, beside the target you set -- the two
       numbers are only useful next to each other (T29) */
    var rh=$('#np-reh');
    if(rh){
      var st=rehFor(sl);
      if(!st) rh.textContent='';
      else {
        var g=slideGoal(sl);
        rh.textContent='You average '+fmtMins(st.mean/60)+' here over '
          +st.n+' rehearsal'+(st.n===1?'':'s')
          +(g?(st.mean>g*60
              ?(' \u2014 '+fmtMins(st.mean/60-g)+' over target')
              :(' \u2014 inside your target')):'');
        rh.classList.toggle('over',!!g&&st.mean>g*60);
      }
    }
    renderPad();
    if(tot){
      var g=goalTotal(),want=pres.talkMins||0;
      if(!g&&!want) tot.textContent='';
      else {
        var n=(pres.slides||[]).filter(function(x){
          return slideGoal(x);}).length;
        var txt=n+' slide'+(n===1?'':'s')+' timed \u2014 '
          +fmtMins(g)+' total';
        if(want){
          var d=g-want;
          txt+=d>0.008?(', which is '+fmtMins(d)+' OVER your '
              +want+' minutes')
            :d<-0.008?(', leaving '+fmtMins(-d)+' of your '
              +want+' minutes')
            :', exactly your slot';
        }
        tot.textContent=txt;
        tot.classList.toggle('over',!!want&&g-want>0.008);
      }
    }
  }
  (function(){
    var btn=$('#notes-btn'),pane=$('#notespane');
    if(!btn||!pane) return;
    function set(open){
      if(open){paneShow('notespane');renderNotesPane();}
      else paneHide('notespane');
    }
    btn.addEventListener('click',function(e){
      e.stopPropagation();set(pane.hidden);});
    var big=$('#np-big');
    if(big) big.addEventListener('click',function(){openNotesEditor(cur);});
    var cl=$('#notespane-close');
    if(cl) cl.addEventListener('click',function(){set(false);});
    var ta=$('#np-notes');
    if(ta){
      ta.addEventListener('keydown',function(e){e.stopPropagation();});
      /* THE WORDS AT ONCE, THE BOOKKEEPING AT MOST EVERY 300 MS
         (2026-10-09, speed, editor #12). Every keystroke was a whole
         markDirty -- the readout, the Objects and numbers panes, the
         thumbnail, the draft and autosave timers -- 25-55 ms a character
         at 4x, competing with the typing on a slow laptop. The note is
         in the model the moment it is typed; the quiet markDirty that
         counts it runs once per 300 ms of typing (a timer, not a
         debounce, so a long note still arms the autosave as it is typed),
         and anything that saves, re-renders or leaves the page settles
         it first (quietSettle, from flushTextEdits), as the blur does. */
      var notesT=null,notesPres=null;
      var notesDirty=function(){
        clearTimeout(notesT);notesT=null;quietPaid(notesDirty);
        /* a deck changed under the typing is not the deck it went into */
        if(pres===notesPres) markDirty(true);
      };
      ta.addEventListener('input',function(){
        var sl=pres.slides[cur]; if(!sl) return;
        var v=ta.value;
        if(v.trim()) sl.notes=v; else delete sl.notes;
        /* quiet, and one undo entry on blur — see the notes editor's
           copy of this handler (T57) */
        if(!notesT){
          notesPres=pres;quietOwe(notesDirty);
          notesT=setTimeout(notesDirty,300);
        }
        presenterPush();
      });
      ta.addEventListener('blur',function(){
        if(notesT) notesDirty();
        if(typeof histPush==='function') histPush();});
    }
    /* T228: the target is two boxes, minutes and seconds, and both
       write the one stored number -- which is still minutes, so every
       deck already written reads back unchanged */
    function goalWrite(){
      var sl=pres.slides[cur]; if(!sl) return;
      var gi2=$('#np-goal'),gs2=$('#np-goalsec');
      var m=parseFloat(gi2&&gi2.value)||0;
      var sec=parseFloat(gs2&&gs2.value)||0;
      var v=Math.round((m+sec/60)*1000)/1000;
      if(v>0) sl.goal=v; else delete sl.goal;
      markDirty(true);presenterPush();
    }
    var gs=$('#np-goalsec');
    if(gs){
      gs.addEventListener('keydown',function(e){e.stopPropagation();});
      gs.addEventListener('input',goalWrite);
      gs.addEventListener('blur',function(){
        if(typeof histPush==='function') histPush();
        renderNotesPane();});
    }
    var gi=$('#np-goal');
    if(gi){
      gi.addEventListener('keydown',function(e){e.stopPropagation();});
      /* QUIET, and one undo entry on blur -- the rule #np-notes above
         already follows. Typing "10.5" here pushed four whole-deck
         snapshots, and the history keeps twenty, so setting the times
         on a few slides quietly evicted real work from the undo
         stack. Found by the parallel branch's T57 (2026-08-30).
         The pane is NOT redrawn on every keystroke either: it would
         rewrite the two boxes under the caret (T228). */
      gi.addEventListener('input',goalWrite);
      gi.addEventListener('blur',function(){
        if(typeof histPush==='function') histPush();
        renderNotesPane();});
    }
    var gc=$('#np-goalclear');
    if(gc) gc.addEventListener('click',function(){
      var sl=pres.slides[cur]; if(!sl) return;
      delete sl.goal;markDirty();renderNotesPane();presenterPush();
    });
    var ti=$('#np-total');
    if(ti){
      ti.addEventListener('keydown',function(e){e.stopPropagation();});
      /* ...and the whole-talk total beside it, which has the same
         handler and the same defect. NEITHER branch caught this one. */
      ti.addEventListener('blur',function(){
        if(typeof histPush==='function') histPush();});
      ti.addEventListener('input',function(){
        var v=parseFloat(ti.value);
        if(v>0) pres.talkMins=v; else delete pres.talkMins;
        markDirty(true);renderNotesPane();presenterPush();
      });
    }
    /* three kinds of note, one pane: this slide, the whole talk, and a
       scratchpad that belongs to neither (2026-08-20) */
    $$('#np-tabs .np-tab').forEach(function(t){
      t.addEventListener('click',function(){
        $$('#np-tabs .np-tab').forEach(function(o){
          o.setAttribute('aria-selected',o===t?'true':'false');});   /* T470 */
        var which=t.dataset.np;
        var b1=$('#notespane-body'),b2=$('#notespane-deck'),
            b3=$('#notespane-pad');
        if(b1) b1.hidden=(which!=='slide');
        if(b2) b2.hidden=(which!=='deck');
        if(b3) b3.hidden=(which!=='pad');
        var b4=$('#notespane-reh');
        if(b4) b4.hidden=(which!=='reh');
        var b5=$('#notespane-time');   /* T465 */
        if(b5) b5.hidden=(which!=='time');
        if(which==='pad') renderPad();
        if(which==='reh') renderReh();
      });
    });
    var dn=$('#np-decknotes');
    if(dn){
      dn.addEventListener('keydown',function(e){e.stopPropagation();});
      dn.addEventListener('input',function(){
        if(dn.value.trim()) pres.notes=dn.value; else delete pres.notes;
        markDirty();
      });
    }
    var an=$('#np-addnote');
    if(an) an.addEventListener('click',function(){
      padList().push({t:'n',id:'n'+padList().length+'-'+Math.floor(
        performance.now()),title:'',body:''});
      markDirty();renderPad();
    });
    var af=$('#np-addfold');
    if(af) af.addEventListener('click',function(){
      padList().push({t:'f',id:'f'+padList().length+'-'+Math.floor(
        performance.now()),title:'New folder'});
      markDirty();renderPad();
    });
    window.SemDeckNotes=function(){set(true);};
  })();
  /* ---- THE STYLE MANAGER ----------------------------------------------
     The deck's type, editable without selecting anything. Until now a
     style could only be changed by formatting one box and pushing its
     look outwards, which meant you had to have a box of that style on the
     slide you happened to be on (2026-08-20).
     Re-stamping is explicit rather than automatic: applyStyleTo WRITES a
     style's properties onto an item, so changing the registry does not
     move anything until something walks the deck and says so. */
  /* `scope` is an array of slide indexes, or null/omitted for the whole
     deck. It exists so the Apply dialog can restyle a chosen run of
     slides; the four callers that came first pass one argument and get
     exactly the behaviour they always had. */
  function restyleAll(ids,scope){
    var n=0;
    /* T293: RESTYLING A PARENT RESTYLES ITS FAMILY. applyStyleTo BAKES,
       so a box wearing a variation of Heading 1 carries Heading 1's old
       size on it until something re-stamps it -- and this walk matched
       on a.style exactly, so pushing a new look to Heading 1 moved every
       plain heading and left every variation of it behind at the old
       numbers. Driven: Heading 1 went to 6.25 and the varied box stayed
       at 5, while styleDef already resolved it to 6.25. The registry was
       right and the slides did not know. */
    var want=null;
    if(ids){
      want={};
      ids.forEach(function(id){
        want[id]=1;
        if(typeof variantsOf==='function')
          variantsOf(id).forEach(function(v){want[v]=1;});
      });
    }
    (pres.slides||[]).forEach(function(sl,si){
      if(scope&&scope.indexOf(si)<0) return;
      (sl.annots||[]).forEach(function(a){
        if(a&&a.k==='text'&&a.style&&(!want||want[a.style])){
          applyStyleTo(a,a.style);n++;
        }
      });
    });
    markDirty();refresh();
    /* T465: the Text tab's tiles are specimens of these styles and were
       rebuilt only when the registry changed -- a Heading 1 made red,
       serif and italic stayed white bold sans on its tile, with the
       old point size on the tooltip (2026-09-15 review, driven) */
    if(typeof txStripSync==='function') txStripSync(true);
    return n;
  }
  /* every style one step up or down, in proportion - the whole deck's
     type at once, which is the thing you actually want when a room turns
     out to be bigger than you expected */
  function scaleStyles(k){
    styleOrder().forEach(function(id){
      /* T292: A VARIATION IS NOT A SIZE OF ITS OWN. Writing one here
         would give every variation an own size on the first press of
         Bigger, after which it would never follow its parent again --
         and the press would ALSO scale it twice, once through the
         parent it inherits from and once through the copy. Its parent
         is in this same loop and moving it moves the family. */
      if(typeof parentOf==='function'&&parentOf(id)) return;
      var d=styleDef(id);
      var over=deckStyles()[id]||{};
      over.label=d.label;   /* T480 */
      over.size=Math.max(0.8,Math.min(24,
        Math.round(d.size*k*100)/100));
      STYLE_FIELDS.forEach(function(pr){
        if(d[pr]!==undefined) over[pr]=d[pr];});
      deckStyles()[id]=over;
    });
    var n=restyleAll(null);
    toast('Every text style '+(k>1?'bigger':'smaller')
      +' \u2014 '+n+' box'+(n===1?'':'es')+' followed');
  }
  /* the open window redraws its list when something outside build()
     changes the styles -- the whole-deck scale and Re-apply sit INSIDE
     it now (T178), so a click on Bigger must show the new sizes */
  var styleMgrSync=null;
  (function(){
    var btn=$('#dsg-styles'),menu=$('#dsg-style-menu');
    if(!btn||!menu) return;
    styleMgrSync=function(){if(!menu.hidden) build();};
    var openEdit='';   /* which row's arrow is open; one at a time */
    /* the expander behind one style's arrow. Everything here writes an
       OVERRIDE into pres.styles (or, for a rename, into the custom type
       itself) and then re-stamps the boxes wearing it — the registry
       never moves anything on its own, which is the contract
       applyStyleTo's comment sets out. */
    function styleEditor(id,d,build){
      var box=document.createElement('div');box.className='stm-edit';
      var custom=BUILTIN_STYLE_IDS.indexOf(id)<0;
      function over(){
        var o=deckStyles()[id]||{};
        /* carry the whole resolved definition, not just the one field
           being changed: styleDef merges the override OVER the base, so
           a partial override plus a later base change reads as a style
           that half-followed.
           T292: EXCEPT FOR A VARIATION, where half-following is the
           entire point. Materialising the resolved definition here would
           freeze the parent's size, weight and colour into the child the
           first time anyone touched any toggle -- and the variation
           would stop following its parent for good, silently, which is
           the one promise it makes. A variation writes only what it
           actually says. */
        var varying=(typeof parentOf==='function')&&!!parentOf(id);
        o.label=d.label;
        if(!varying) o.size=d.size;
        STYLE_FIELDS.forEach(function(k){
          if(varying) return;
          if(d[k]!==undefined) o[k]=d[k]; else delete o[k];});
        deckStyles()[id]=o;
        return o;
      }
      function toggle(label,key,title){
        var b=document.createElement('button');
        b.className='dbtn stm-tg';b.textContent=label;
        /* T465: "counts as a heading" is answered by isHeadingStyle,
           which knows the four built-in headings; d.head is unset for
           them, so the toggle read OFF on Heading 1 (2026-09-15 review) */
        var onNow=(key==='head'&&typeof isHeadingStyle==='function')
          ?isHeadingStyle(id):!!d[key];
        b.setAttribute('aria-pressed',onNow.toString());
        b.title=title;
        if(key==='head'&&onNow&&HEADING_STYLES.indexOf(id)>=0){
          b.disabled=true;b.title='Always a heading';
        }
        b.addEventListener('click',function(e){
          e.stopPropagation();
          var o=over();
          /* T465: OFF IS A VALUE. Deleting the override left the
             base's own bold or italic in force, so B and I could never
             be turned off on Title, the headings or Caption -- the
             toggle stayed lit and the boxes stayed bold (2026-09-15
             review, driven). styleDef lays the override over the base,
             and applyStyleTo already reads 0 as "not bold". */
          if(d[key]) o[key]=0; else o[key]=1;
          restyleAll([id]);build();
        });
        return b;
      }
      var row=document.createElement('div');row.className='stm-erow';
      row.appendChild(toggle('B','b','Bold — everywhere in this deck'));
      row.appendChild(toggle('I','i','Italic — everywhere in this deck'));
      /* "counts as a heading" stopped being a fixed list of four the
         moment types could be invented: only you know whether your
         "Section label" is one */
      row.appendChild(toggle('¶ Heading','head',
        'Counts as a heading — for "apply to all headings", the outline '
        +'view and the standardise check'));
      box.appendChild(row);
      /* ---- T223: THE REST OF WHAT A STYLE IS -----------------------
         The typeface, the colour of the words, the colour behind them
         and the colour of the edge. Each writes the same override
         record the toggles do and re-stamps every box wearing it. */
      var crow=document.createElement('div');crow.className='stm-erow';
      var fsel=document.createElement('select');
      fsel.className='stm-font';
      fsel.title='The typeface every box of this style takes';
      [['','Default face'],['sans','Sans'],['serif','Serif'],
       ['mono','Mono'],['system','System'],['hand','Handwritten']]
        .forEach(function(pr){
          var o=document.createElement('option');
          o.value=pr[0];o.textContent=pr[1];
          if((d.font||'')===pr[0]) o.selected=true;
          fsel.appendChild(o);
        });
      fsel.addEventListener('click',function(e){e.stopPropagation();});
      fsel.addEventListener('change',function(){
        var o=over();
        if(fsel.value) o.font=fsel.value; else delete o.font;
        restyleAll([id]);build();
      });
      crow.appendChild(fsel);
      /* a colour, and a way to say NONE -- which is a different
         answer from not having said anything */
      function colCtl(key,label,fallback,none){
        var wrap=document.createElement('span');
        wrap.className='stm-col';
        var lb=document.createElement('span');
        lb.className='stm-collab';lb.textContent=label;
        wrap.appendChild(lb);
        var ci=document.createElement('input');
        ci.type='color';ci.className='stm-colin';
        var v=d[key];
        /* T480: a deck colour shows as what it resolves to, and says
           so; it showed the fallback after any colour theme */
        var rv=tokVal(v);
        ci.value=(v&&v!=='none'&&/^#[0-9a-f]{6}$/i.test(rv))?rv:fallback;
        ci.title=label+' \u2014 everywhere in this deck'
          +(tokRef(v)?(' (a deck colour: '+tokRef(v)+'; a change here '
            +'unhooks it)'):'');
        ci.addEventListener('click',function(e){e.stopPropagation();});
        ci.addEventListener('change',function(){
          var o=over();o[key]=ci.value;
          restyleAll([id]);build();
        });
        wrap.appendChild(ci);
        if(none){
          var nb=document.createElement('button');
          nb.className='dbtn stm-tg';nb.textContent=none;
          nb.title='No '+label.toLowerCase();
          nb.setAttribute('aria-pressed',(v==='none').toString());
          nb.addEventListener('click',function(e){
            e.stopPropagation();
            var o=over();
            if(v==='none') delete o[key]; else o[key]='none';
            restyleAll([id]);build();
          });
          wrap.appendChild(nb);
        }
        return wrap;
      }
      /* T469: the format bar's words (Text, Fill, Border), not a
         second vocabulary ("Words / Behind / Edge") */
      crow.appendChild(colCtl('color','Text','#e6eef5',''));
      crow.appendChild(colCtl('bg','Fill','#16273a','None'));
      crow.appendChild(colCtl('bdc','Border','#8aa0b0','None'));
      box.appendChild(crow);
      var ren=document.createElement('input');
      ren.className='stm-ren';ren.type='text';ren.value=d.label;
      ren.placeholder='name for this style';
      ren.title='What this style is called';
      ren.addEventListener('keydown',function(e){
        e.stopPropagation();
        if(e.key==='Enter') ren.blur();
      });
      /* committed on blur, not per keystroke: a rename that fired on
         every letter would push a dozen undo steps and rebuild the menu
         under the caret (2026-08-20, the presentation-rename lesson) */
      ren.addEventListener('blur',function(){
        var v=ren.value.trim(); if(!v||v===d.label) return;
        if(custom) customTypes().forEach(function(t){
          if(t&&t.id===id) t.label=v;});
        var o=over();o.label=v;
        syncCustomTypes();markDirty();build();
      });
      box.appendChild(ren);
      var act=document.createElement('button');
      act.className='dbtn vw-opt stm-del';
      if(custom){
        act.innerHTML=bic('exit')+' Delete this style';
        act.title='The boxes wearing it keep exactly the look they have '
          +'— they just stop being a group';
        act.addEventListener('click',function(e){
          e.stopPropagation();
          var n=deleteCustomType(id);
          openEdit='';markDirty();build();
          toast('"'+d.label+'" removed — '+n+' box'+(n===1?'':'es')
            +' kept the look they had');
        });
      } else {
        act.innerHTML=bic('reset')+' Back to the built-in "'
          +esc(STYLE_DEFAULTS[id].label)+'"';
        act.title='Undo the changes made to this one style';
        act.disabled=!(pres.styles&&pres.styles[id]);
        act.addEventListener('click',function(e){
          e.stopPropagation();
          if(pres.styles) delete pres.styles[id];
          restyleAll([id]);build();
        });
      }
      box.appendChild(act);
      return box;
    }
    function build(){
      /* into the LIST, not the menu: the whole-deck buttons below
         it are real controls in the markup and survive every
         rebuild (T178) */
      var list=$('#dsg-style-list')||menu;
      list.innerHTML='';
      /* FIRST, above the individual styles: picking a whole look is the
         thing you do once at the start, and tuning one style is what you
         do afterwards. The old menu offered only the second (2026-08-22). */
      var sets=document.createElement('button');
      sets.className='dbtn vw-opt';
      sets.textContent='\u25f1 Style sets \u2014 restyle the whole deck\u2026';
      sets.title='Ready-made looks, and any you have saved. Works even '
        +'on a deck that has never used a named style.';
      sets.addEventListener('click',function(e){
        e.stopPropagation();overlayHide(menu);
        if(typeof window.SemDeckStyleSets==='function')
          window.SemDeckStyleSets();
      });
      list.appendChild(sets);
      /* This is an editor for styles the presentation actually wears, not
         a catalogue of every possible heading. The full Style system still
         lets a reader inspect text and non-text objects together. */
      var worn={};
      (pres.slides||[]).forEach(function(sl){
        (sl.annots||[]).forEach(function(a){
          if(a&&a.k==='text'&&a.style) worn[a.style]=1;});});
      var ids=styleOrder().filter(function(id){return worn[id]||id===openEdit;});
      menuHead(list,'styles used in this presentation');
      if(!ids.length){
        var none=document.createElement('div');
        none.className='stm-empty';
        none.textContent='No named text styles are used yet \u2014 a text '
          +'box gets one from the Text tab, or from a layout.';
        list.appendChild(none);
      }
      /* T470: Smaller, Bigger and Re-apply act on boxes wearing a
         style; with none they toasted "0 boxes followed" (2026-09-15
         review). Dead until there is something to move. */
      ['#dsg-scale-down','#dsg-scale-up','#dsg-restyle'].forEach(function(s){
        var b=$(s); if(!b) return;
        b.disabled=!ids.length;
        if(!ids.length) b.title='Nothing wears a named style yet';
        else if(b.dataset.tt) b.title=b.dataset.tt;
        if(!b.dataset.tt) b.dataset.tt=b.title;
      });
      ids.forEach(function(id){
        var d=styleDef(id);
        var row=document.createElement('div');row.className='stm-row';
        var spec=document.createElement('span');
        spec.className='stm-spec';spec.textContent=d.label;
        spec.style.fontWeight=d.b?'700':'400';
        if(d.i) spec.style.fontStyle='italic';
        spec.style.fontSize=Math.max(11,Math.min(22,d.size*3.1))+'px';
        if(d.color) spec.style.color=tokVal(d.color);
        if(d.font) spec.style.fontFamily=fontCss(d.font);
        specimenGround(spec,d);
        row.appendChild(spec);
        var sz=document.createElement('span');sz.className='stm-sz';
        sz.textContent=Math.round(d.size*5.4)+' pt';
        row.appendChild(sz);
        [['\u2212',1/1.12],['+',1.12]].forEach(function(pr){
          var b=document.createElement('button');
          b.className='dbtn stm-b';b.textContent=pr[0];
          b.title=(pr[1]>1?'Bigger':'Smaller')+' \u2014 '+d.label
            +' everywhere in this presentation';
          b.addEventListener('click',function(e){
            e.stopPropagation();
            var over=deckStyles()[id]||{};
            over.label=d.label;   /* T480: the name you gave it stays */
            over.size=Math.max(0.8,Math.min(24,
              Math.round(d.size*pr[1]*100)/100));
            /* T467: a VARIATION writes only what it says (T292). Copying
               the resolved weight, face and colour into it froze its
               parent's look into the child, and it stopped following
               (2026-09-15 review, driven). A root style keeps the full
               copy, for the reason over() in the editor gives. */
            var varying=(typeof parentOf==='function')&&!!parentOf(id);
            if(!varying) STYLE_FIELDS.forEach(function(k2){
              if(d[k2]!==undefined) over[k2]=d[k2];});
            deckStyles()[id]=over;
            restyleAll([id]);
            build();
          });
          row.appendChild(b);
        });
        /* "a little arrow option to the right of each" (2026-08-22). It
           opens ONE inline expander rather than a second floating menu:
           floatMenu positions fixed and clamps without scrolling, so a
           menu hanging off a menu would need its own dismissal, its own
           clamping and somewhere to go when the first one is already at
           the bottom of the screen. */
        var arw=document.createElement('button');
        arw.className='dbtn stm-b stm-arrow';
        arw.innerHTML=(openEdit===id)?'&#9662;':'&#9656;';
        arw.title='Change what "'+d.label+'" is';
        arw.addEventListener('click',function(e){
          e.stopPropagation();
          openEdit=(openEdit===id)?'':id;
          build();
        });
        row.appendChild(arw);
        list.appendChild(row);
        if(openEdit===id) list.appendChild(styleEditor(id,d,build));
      });
      /* "people could create their own types" \u2014 the seven built-ins are a
         scale, not a vocabulary, and a deck that needs a Quote had
         nowhere to put one */
      var add=document.createElement('button');
      add.className='dbtn vw-opt';
      add.textContent='\uff0b New style of my own';
      add.title='Add a type of your own \u2014 a Quote, a Source note, '
        +'whatever this deck needs';
      add.addEventListener('click',function(e){
        e.stopPropagation();
        var t=addCustomType('My style','body');
        openEdit=t.id;
        markDirty();build();
      });
      list.appendChild(add);
      var rst=document.createElement('button');
      rst.className='dbtn vw-opt';
      rst.innerHTML=bic('reset')+' Back to the built-in sizes';
      rst.disabled=!ids.length&&!pres.styles;   /* T470: nothing to reset */
      /* it clears the OVERRIDES, and it must never touch pres.types:
         "back to the built-in sizes" is not "throw away the types I
         invented" */
      rst.title='Clears the size and weight changes. The types you made '
        +'yourself are kept.';
      rst.addEventListener('click',function(e){
        e.stopPropagation();
        delete pres.styles;
        var n=restyleAll(null);
        build();
        toast('Styles reset \u2014 '+n+' box'+(n===1?'':'es')+' followed');
      });
      list.appendChild(rst);
    }
    /* not wireFloatDropdown: this menu REBUILDS itself on every open
       (build()), so the static options list the helper wants never fits */
    btn.addEventListener('click',function(e){
      e.stopPropagation();
      if(!menu.hidden){overlayHide(menu);return;}
      build();
      overlayShow(btn,menu);floatMenu(btn,menu);
    });
  })();
  (function(){
    var d=$('#dsg-scale-down');
    if(d) d.addEventListener('click',function(e){
      e.stopPropagation();scaleStyles(1/1.12);
      if(styleMgrSync) styleMgrSync();});
    var u=$('#dsg-scale-up');
    if(u) u.addEventListener('click',function(e){
      e.stopPropagation();scaleStyles(1.12);
      if(styleMgrSync) styleMgrSync();});
    var r=$('#dsg-restyle');
    if(r) r.addEventListener('click',function(e){
      e.stopPropagation();
      var n=restyleAll(null);
      toast(n?('Re-applied the styles to '+n+' box'+(n===1?'':'es'))
        :'Nothing on this deck is wearing a named style yet');
      if(styleMgrSync) styleMgrSync();
    });
  })();
  /* ---- LISTS ----------------------------------------------------------
     A text box is a list when a.list says so: 'bullet' or 'number'. The
     ITEMS live in a.html as plain <li>…</li> (no wrapper), so switching
     bullets to numbering is a one-word model change that rewrites no
     content, and a.text keeps the flat plain-text projection everything
     else reads (pptx, export, search, the Layers pane).

     What was here before had two states that each remembered the other's
     content: a.list drew a <ul> from a.text's newlines, while a.html —
     the rich version — was left untouched underneath it. Turning bullets
     OFF fell straight back to that stale a.html, so whatever you had
     typed as a list disappeared and text from before it came back
     (2026-08-20, user: "the bullet list on/off is cursed. PLEASE DO
     EVERYTHING PROPERLY"). One content field, converted on the way in and
     on the way out, is the fix.
     (T623: a.list, and a.lcol / a.lsz / a.lstart with it, is now only how
     an OLDER deck says its whole box is a list. The paragraphs carry their
     own markers -- THE PARAGRAPH, below -- and parasFrom reads a.list into
     them; the box-wide fields go the first time the box is edited.) */
  /* ---- KINDS OF LIST (T227) ----------------------------------------
     (2026-09-03, user: "there are no different types of bullet
     points, and different lists.") There were two: a disc and 1-2-3.
     The machinery never needed more than a word -- `a.list` holds the
     style NAME, the rendered element carries it as a class, and the
     content is only the items -- so each kind here is one entry and
     one CSS rule, and switching between them rewrites nothing.
     The marker in the third column is what the picker draws and what
     `::marker` shows, so the gallery cannot disagree with the page. */
  var LIST_KINDS=[
    ['bullet','Dot','\u2022',0],
    ['circle','Ring','\u25e6',0],
    ['square','Square','\u25aa',0],
    ['dash','Dash','\u2013',0],
    ['arrow','Arrow','\u25b8',0],
    ['check','Tick','\u2713',0],
    ['number','1. 2. 3.','1.',1],
    ['paren','1) 2) 3)','1)',1],
    ['alpha','a. b. c.','a.',1],
    ['alpha-upper','A. B. C.','A.',1],
    ['roman','i. ii. iii.','i.',1],
    ['roman-upper','I. II. III.','I.',1]
  ];
  function listKind(id){
    var hit=null;
    LIST_KINDS.forEach(function(k){if(!hit&&k[0]===id) hit=k;});
    return hit;
  }
  function listIsOrdered(id){
    var k=listKind(id);
    return !!(k&&k[3]);
  }
  /* the nth marker a kind draws, for the gallery's preview */
  function listMarker(id,n){
    var k=listKind(id); if(!k) return '\u2022';
    if(!k[3]) return k[2];
    var tail=(id==='paren')?')':'.';
    if(id==='alpha') return 'abc'.charAt(n-1)+tail;
    if(id==='alpha-upper') return 'ABC'.charAt(n-1)+tail;
    if(id==='roman') return ['i','ii','iii'][n-1]+tail;
    if(id==='roman-upper') return ['I','II','III'][n-1]+tail;
    return n+tail;
  }
  function listOf(a){
    /* an older deck stored a.list as the boolean 1 */
    var v=a&&a.list?(a.list===true||a.list===1?'bullet':a.list):0;
    /* a kind this build does not know falls back to its family's
       default rather than to no list at all */
    if(v&&!listKind(v)) v=(v==='number')?'number':'bullet';
    return v;
  }
  /* strip markup for the plain projection (one inert template, reused:
     a commit asks this of every paragraph of the box) */
  var plainTpl=null;
  function plainOf(html){
    var t=plainTpl||(plainTpl=document.createElement('template'));
    t.innerHTML=String(html||'');
    var v=t.content.textContent||'';
    t.innerHTML='';
    return v;
  }
  /* ---- THE PARAGRAPH (T623) -------------------------------------------
     (2026-10-10, user: "indenting affects whole of text box, and still
     issues with dot points and lists".) A text box is an ordered run of
     PARAGRAPHS, as in PowerPoint, and each paragraph carries its own
     level (0-8) and, if it has one, its own marker: the kind, the number
     a numbered run starts at, the marker's colour and size. Stored flat
     and canonical in a.html as sibling <p>s --
       <p data-lvl="1" data-list="number" data-start="5" data-lc="@warm"
          data-ls="1.5">words</p>
     -- with no ul/ol/li nesting, and a line break inside a paragraph
     (Shift+Enter) is a "\n" or a <br> INSIDE its <p>. a.text stays the
     plain projection, one line per paragraph, and a box with no levels,
     no markers and no formatting is still stored as a.text alone.

     What was here before had no paragraph at all: a box's lines were
     whatever the browser had left behind -- "\n" in one pre-wrap text
     node, <div>s, <br>s or <li>s -- and the list was two models that
     disagreed (the box-wide a.list with a.lcol/a.lsz/a.lstart drawn on a
     root <ul>, and ul/ol sections inside a.html). So the List button on a
     box you came back to made ONE bullet of every line from the caret to
     the end (the browser's list command on one text node), Tab then
     moved all of them -- "indenting affects whole of text box" -- a plain
     line could not be indented at all (Tab left the box), an outdent at
     the first level split the list and threw away every marker's colour,
     and each surface (the editor, the show, the strip, the .pptx) read
     the list from a different place.

     ONE READER, parasFrom/parasParse, reads every shape a box has ever
     been stored in, so an old deck opens exactly as it looked: a.text
     lines, the box-wide a.list (its items, nested levels, colour, size
     and start copied onto each paragraph), ul/ol sections with their
     data-list, the <div> and <br> lines of the block editor. A box is
     written back in the canonical form only when it is edited
     (parasStore), and the box-wide fields go then -- for every page of
     it at once, since a.list belonged to all of them.

     ONE DRAWER, parasDraw, makes the same <p class="an-p">s for the
     editor, the show, the strip's thumbnails, the presenter, the
     scrolling page, the print root (HTML export, PDF) and the build
     pieces, and paraDecorate works out what each one shows (parasMarks:
     the marker and its number, and where the words start) -- so every
     surface and the .pptx agree about every paragraph. The marker is
     the paragraph's own ::marker (display:list-item, the shape and the
     numbering the browser has always drawn) placed by a margin, which is
     what lets each column of a two-column box have its own gutter. */
  var PARA_LVL_MAX=8;
  /* A dot, a ring and a square take turns down the levels, as 1. a. i.
     do, so a sub-point never looks like its parent; any other marker you
     picked stays at every level. The stored kind is the one the
     paragraph would wear at the first level (paraBaseKind). */
  var PARA_RINGS=[['bullet','circle','square'],['number','alpha','roman']];
  function paraRing(k){
    for(var i=0;i<PARA_RINGS.length;i++)
      if(PARA_RINGS[i].indexOf(k)>=0) return PARA_RINGS[i];
    return null;
  }
  function paraDrawKind(k,l){
    var r=paraRing(k);
    return r?r[(r.indexOf(k)+(l||0))%r.length]:k;
  }
  function paraBaseKind(drawn,l){
    var r=paraRing(drawn); if(!r) return drawn;
    var n=r.length;
    return r[(((r.indexOf(drawn)-(l||0))%n)+n)%n];
  }
  /* a marker colour is a deck token or a colour, never anything that
     could carry markup into an attribute */
  var PARA_LC=/^(@[a-z][a-z0-9-]{0,24}|#[0-9a-f]{3,8}|rgba?\([0-9., %]{1,40}\)|[a-z]{3,24})$/i;
  function paraNew(at,h){
    at=at||{};
    return {lvl:at.lvl||0,list:at.list||'',start:at.start||0,lc:at.lc||'',
      ls:at.ls||0,h:h||''};
  }
  /* what one <p> says about itself, every value checked */
  function paraAttrs(e){
    var at=paraNew();
    var l=parseInt(e.getAttribute('data-lvl'),10);
    if(l>0) at.lvl=Math.min(PARA_LVL_MAX,l);
    var k=e.getAttribute('data-list')||'';
    /* a kind a later build invented is still a list */
    if(k) at.list=listKind(k)?k:'bullet';
    if(at.list){
      var st=parseInt(e.getAttribute('data-start'),10);
      if(st>=1&&st<=999&&listIsOrdered(at.list)) at.start=st;
      var lc=e.getAttribute('data-lc')||'';
      if(PARA_LC.test(lc)) at.lc=lc;
      var ls=parseFloat(e.getAttribute('data-ls'));
      if(ls>=0.5&&ls<=3&&ls!==1) at.ls=Math.round(ls*100)/100;
    }
    return at;
  }
  function paraAttrsSet(e,p){
    function put(n,v){
      if(v) {if(e.getAttribute(n)!==String(v)) e.setAttribute(n,String(v));}
      else if(e.hasAttribute(n)) e.removeAttribute(n);
    }
    put('data-lvl',p.lvl||'');
    put('data-list',p.list||'');
    put('data-start',p.list&&p.start?p.start:'');
    put('data-lc',p.list&&p.lc?p.lc:'');
    put('data-ls',p.list&&p.ls?p.ls:'');
  }
  function paraKey(p){
    return [p.lvl,p.list,p.start,p.lc,p.ls].join('|');
  }
  /* THE READER. `box` is the box-wide list of an older deck ({list, lc,
     ls, start}); its items arrive wrapped in a root list so that they
     are read exactly as they were drawn. Outside a <p> or an <li> a
     "\n", a <br> and a block each begin a line (the T609 rules); inside
     one they are a line break within the paragraph. A run that spans a
     break is closed and re-opened, so bold stays bold on both lines. */
  var PARA_BLOCK=/^(DIV|H[1-6]|BLOCKQUOTE|PRE|SECTION|ARTICLE|TABLE|TBODY|THEAD|TR|TD|TH)$/;
  function parasParse(html,box){
    var t=document.createElement('template');t.innerHTML=String(html||'');
    var out=[],cur=null;
    function para(at){cur=paraNew(at,'');out.push(cur);return cur;}
    /* a line ends -- with none open, it was an empty line of its own */
    function hard(cx){if(!cur) para(cx.at);cur=null;}
    function put(h,cx){if(!cur) para(cx.at);cur.h+=h;}
    function walk(n,cx){
      for(var c=n.firstChild;c;c=c.nextSibling){
        if(c.nodeType===3){
          var v=String(c.nodeValue);
          if(cx.soft){if(v) put(cx.w[0]+esc(v)+cx.w[1],cx);continue;}
          v.split('\n').forEach(function(p,j){
            if(j) hard(cx);
            if(p) put(cx.w[0]+esc(p)+cx.w[1],cx);
          });
          continue;
        }
        if(c.nodeType!==1) continue;
        var tg=c.tagName;
        if(tg==='BR'){if(cx.soft) put(cx.w[0]+'<br>'+cx.w[1],cx); else hard(cx);continue;}
        if(tg==='P'){
          /* a <p> inside an item (as a pasted list brings them) is that
             item's words, and a second one a line of it */
          if(cx.li){
            if(cur&&cur.h) put('<br>',cx);
            walk(c,{w:cx.w,soft:true,d:cx.d,lk:cx.lk,at:cx.at,root:cx.root,
              li:true});
            continue;
          }
          cur=null;para(paraAttrs(c));
          walk(c,{w:['',''],soft:true,d:cx.d,lk:cx.lk,at:cx.at,root:cx.root});
          cur=null;continue;
        }
        if(tg==='UL'||tg==='OL'){
          cur=null;
          var d=cx.d+1,ord=(tg==='OL'),own=c.getAttribute('data-list')||'',k;
          /* a list's own kind, at the depth it sits at; one that says
             nothing wears its family's first kind, which the levels
             then turn (circle under a dot, a. under 1.) as they did */
          if(own&&listKind(own)&&listIsOrdered(own)===ord)
            k=paraBaseKind(own,d-1);
          else k=ord?'number':'bullet';
          /* words loose in a list, outside any item, sit where its items'
             words do, with no marker */
          walk(c,{w:['',''],soft:false,d:d,lk:k,
            at:{lvl:Math.min(PARA_LVL_MAX,d)},root:cx.root});
          cur=null;continue;
        }
        if(tg==='LI'){
          cur=null;
          var at={lvl:Math.min(PARA_LVL_MAX,Math.max(0,cx.d-1)),
            list:cx.lk||'bullet'};
          if(cx.root){
            at.lc=cx.root.lc;at.ls=cx.root.ls;
            if(cx.d===1&&listIsOrdered(at.list)) at.start=cx.root.start;
          }
          para(at);
          walk(c,{w:['',''],soft:true,d:cx.d,lk:cx.lk,at:at,root:cx.root,
            li:true});
          cur=null;continue;
        }
        if(PARA_BLOCK.test(tg)){cur=null;walk(c,cx);cur=null;continue;}
        /* a <span> that says nothing -- what the sanitizer leaves of the
           browser's tab span, or of an outdent's font-size -- is only its
           words, and is no reason to keep a plain box as markup */
        if(tg==='SPAN'&&!c.attributes.length){walk(c,cx);continue;}
        var tag=tg.toLowerCase(),o=c.cloneNode(false).outerHTML;
        o=o.slice(0,o.length-tag.length-3);
        walk(c,{w:[cx.w[0]+o,'</'+tag+'>'+cx.w[1]],soft:cx.soft,d:cx.d,
          lk:cx.lk,at:cx.at,root:cx.root,li:cx.li});
      }
    }
    walk(t.content,{w:['',''],soft:false,d:0,lk:'',at:{},root:box||null});
    /* a block's last <br> is the browser's placeholder, not a line */
    out.forEach(function(p){
      p.h=p.h.replace(/<br>((?:<\/[a-z0-9]+>)*)$/i,'$1');
      if(!paraPlain(p.h)) p.h=p.h.replace(/^(?:<([a-z0-9]+)[^>]*><\/\1>)+$/i,'');
    });
    return parasMaths(out);
  }
  /* A DISPLAY FORMULA IS ONE PARAGRAPH (2026-10-10 review). "$$", a line
     of LaTeX, "$$" -- typed with Enter, or an older box's a.text lines --
     were one text node before T623, and MathJax paired the two "$$"
     across the newlines. As three paragraphs they are three blocks, and
     MathJax never looks for a pair across a block (only a <br> is a
     newline to it): the slide, the show and the export printed the raw
     LaTeX. So the lines from one that leaves a display formula open
     ("$$" or "\[") to the one that closes it are read as ONE paragraph,
     its lines kept as lines -- only plain lines at one level, never a
     bullet, and never a formula that does not close. `open` is what was
     open at the start of `s`; the answer is what is open at its end. */
  function mathsOpen(s,open){
    for(var i=0;i<s.length;){
      var c=s.charAt(i);
      if(c==='\\'){
        var nx=s.charAt(i+1);
        if(!open&&nx==='['){open=']';i+=2;continue;}
        if(open===']'&&nx===']'){open='';i+=2;continue;}
        i+=2;continue;            /* \$ is a dollar, \\ a LaTeX newline */
      }
      if(c==='$'&&s.charAt(i+1)==='$'){
        if(!open) open='$'; else if(open==='$') open='';
        i+=2;continue;
      }
      i++;
    }
    return open;
  }
  function parasMaths(ps){
    var out=[],i=0;
    function may(p){return !p.list&&(p.h.indexOf('$$')>=0||p.h.indexOf('\\')>=0);}
    while(i<ps.length){
      var p=ps[i],o=may(p)?mathsOpen(paraPlain(p.h),''):'';
      if(o){
        var j=i+1,st=o;
        for(;j<ps.length;j++){
          var q=ps[j];
          if(q.list||(q.lvl||0)!==(p.lvl||0)){j=ps.length;break;}
          st=mathsOpen(paraPlain(q.h),st);
          if(!st) break;
        }
        if(j<ps.length){
          var m=paraNew(p,'');
          m.h=ps.slice(i,j+1).map(function(q){return q.h;}).join('\n');
          out.push(m);i=j+1;continue;
        }
      }
      out.push(p);i++;
    }
    return out;
  }
  /* the paragraphs of a box, from any page's words: `t` and `h` are that
     page's (figSubst'd by a renderer, raw for an editor).
     READ ONCE PER WORDS (2026-10-10 review): the strip, the slide, the
     buttons' state and the build pieces all ask this of the same box,
     and each answer was a sanitise and a parse -- the strip's scroll
     took 2.4x the script it did before T623. The answer is kept by what
     it was read from, and each caller gets a copy of its own to change. */
  var parasMemo=new Map();
  function parasBox(a){
    var lst=a&&a.k==='text'?listOf(a):0;
    return lst?{list:lst,lc:(a.lcol&&PARA_LC.test(a.lcol))?a.lcol:'',
      ls:(+a.lsz>=0.5&&+a.lsz<=3&&+a.lsz!==1)?+a.lsz:0,
      start:(a.lstart>1&&listIsOrdered(lst))?Math.min(999,a.lstart|0):0}:null;
  }
  function parasKey(a,t,h,box){
    return (box?[box.list,box.lc,box.ls,box.start].join('|'):'')
      +(a&&a.maths?'\u0001m':'')+(h?'\u0002'+h:'\u0003'+String(t||''));
  }
  function parasCopy(got){
    return got.map(function(p){return paraNew(p,p.h);});
  }
  function parasFrom(a,t,h){
    var box=parasBox(a),key=parasKey(a,t,h,box);
    var got=parasMemo.get(key);
    if(!got){
      got=parasRead(a,t,h,box);
      if(parasMemo.size>=600) parasMemo.clear();
      parasMemo.set(key,got);
    }
    return parasCopy(got);
  }
  /* ...only if they have been read already, or null: for a surface that
     can draw the words first and the markers when there is time */
  function parasKnown(a,t,h){
    var got=parasMemo.get(parasKey(a,t,h,parasBox(a)));
    return got?parasCopy(got):null;
  }
  function parasRead(a,t,h,box){
    var lst=box?box.list:0;
    if(h){
      h=sanitizeRich(h).html;
      if(box){
        var tg=listIsOrdered(lst)?'ol':'ul';
        h='<'+tg+' data-list="'+lst+'">'+h+'</'+tg+'>';
      }
      return parasParse(h,box);
    }
    t=String(t||'');
    if(box) return t.split('\n').map(function(l){
      return paraNew({list:lst,start:box.start,lc:box.lc,ls:box.ls},esc(l));});
    if(!t) return [];
    /* an equation is one paragraph: a display formula over several lines
       has to reach MathJax as one run of text */
    if(a&&a.maths) return [paraNew({},esc(t))];
    return parasMaths(t.split('\n').map(function(l){return paraNew({},esc(l));}));
  }
  function parasOf(a,n){
    var pg=textPage(a,n||0);
    return parasFrom(a,pg.t,pg.h);
  }
  /* written as it is read: every value checked again, so nothing a
     form handed over reaches the stored markup unexamined */
  function paraOpen(p){
    var s='<p',l=Math.min(PARA_LVL_MAX,Math.max(0,p.lvl|0));
    if(l) s+=' data-lvl="'+l+'"';
    if(p.list){
      s+=' data-list="'+(listKind(p.list)?p.list:'bullet')+'"';
      if(p.start>=1&&p.start<=999) s+=' data-start="'+(p.start|0)+'"';
      if(p.lc&&PARA_LC.test(p.lc)) s+=' data-lc="'+p.lc+'"';
      if(+p.ls>=0.5&&+p.ls<=3&&+p.ls!==1) s+=' data-ls="'+(+p.ls)+'"';
    }
    return s+'>';
  }
  function parasHtml(ps){
    return ps.map(function(p){return paraOpen(p)+p.h+'</p>';}).join('');
  }
  /* strip markup for the plain projection: a line break inside a
     paragraph is still a line. Words with no markup and no entity are
     their own plain text -- most paragraphs, and no parse at all. */
  function paraPlain(h){
    h=String(h||'');
    if(h.indexOf('<')<0&&h.indexOf('&')<0) return h;
    return plainOf(h.replace(/<br\s*\/?>/gi,'\n'));
  }
  function parasText(ps){
    return ps.map(function(p){return paraPlain(p.h);}).join('\n');
  }
  /* can these be kept as a.text alone? Only plain lines: no level, no
     marker, no markup and no line break inside a paragraph (a.text's
     "\n" means a new paragraph). An equation's one paragraph is its
     text, line breaks and all. */
  function parasPlain(ps,a){
    function bare(p){return !p.lvl&&!p.list&&p.h.indexOf('<')<0;}
    if(a&&a.maths&&ps.length===1&&bare(ps[0])) return true;
    if(!ps.every(bare)) return false;
    if(ps.every(function(p){return p.h.indexOf('\n')<0;})) return true;
    /* a display formula's lines are one paragraph (parasMaths) that a.text
       says as lines: plain, if reading the lines back makes these very
       paragraphs again */
    var back=parasMaths(ps.map(function(p){return p.h;}).join('\n').split('\n')
      .map(function(l){return paraNew({},l);}));
    return back.length===ps.length&&back.every(function(q,i){
      return q.h===ps[i].h;});
  }
  /* empty plain paragraphs at the end are not words (the plain text
     always dropped its trailing newlines); an empty bullet is the
     marker you are about to type after, and stays */
  function parasTrim(ps){
    while(ps.length){
      var p=ps[ps.length-1];
      if(p.list||p.lvl||paraPlain(p.h).replace(/\u200b/g,'')) break;
      ps.pop();
    }
    return ps;
  }
  /* the box-wide list of an older deck, baked into the paragraphs of
     every page but `skip`, then gone */
  function parasMigrate(a,skip){
    if(!a) return;
    if(a.list&&listOf(a)) textPages(a).forEach(function(pg,n){
      if(n===skip) return;
      var ps=parasTrim(parasFrom(a,pg.t,pg.h));
      textPageSet(a,n,parasText(ps),parasPlain(ps,a)?'':parasHtml(ps));
    });
    delete a.list;delete a.lcol;delete a.lsz;delete a.lstart;
  }
  /* write one page's paragraphs (an editor's commit) */
  function parasStore(a,n,ps){
    parasMigrate(a,n||0);
    ps=parasTrim(ps);
    textPageSet(a,n||0,parasText(ps),parasPlain(ps,a)?'':parasHtml(ps));
    /* a list has several baselines and no single curve to follow */
    if(ps.some(function(p){return p.list;})) delete a.arc;
  }
  /* change a box's paragraphs as a whole, every page: fn(p, i, page) */
  function parasEdit(a,fn){
    if(!a||a.k!=='text'||a.md) return false;
    var pages=textPages(a).map(function(pg){
      var ps=parasFrom(a,pg.t,pg.h);
      /* an empty box is one empty paragraph to put a marker on */
      return ps.length?ps:[paraNew({},'')];
    });
    parasMigrate(a,-1);
    var anyList=false;
    pages.forEach(function(ps,n){
      ps.forEach(function(p,i){fn(p,i,n);});
      if(ps.some(function(p){return p.list;})) anyList=true;
      ps=parasTrim(ps);
      textPageSet(a,n,parasText(ps),parasPlain(ps,a)?'':parasHtml(ps));
    });
    if(anyList) delete a.arc;
    return true;
  }
  /* WHAT EACH PARAGRAPH DRAWS. A numbered run counts on at its level
     while the paragraphs at that level keep the same kind; a paragraph
     nearer the margin, or a different kind or none at the same level,
     ends it, and data-start begins one at that number (a paragraph whose
     start is the run's own goes on counting -- Enter copies it). A
     paragraph with a start, after a plain one at its level that ended a
     run with that same start, takes that list up again, as Word does:
     the start says which list it belongs to -- so taking "6." out of a
     list that starts at 5 leaves the next one 6, not a second 5. `pos`
     is where the words start, in em of the box's type: the bullet gutter
     (1.7em, T195) and a step a level -- 1.5em for a marker, 1.25em for a
     number, the nested lists' own steps -- and a plain paragraph at a
     level sits under the words of the level above it. `first` is where
     the number its run began (a .pptx says it as startAt). */
  function paraPos(l,k){
    if(k) return Math.round((1.7+l*(listIsOrdered(k)?1.25:1.5))*100)/100;
    return l?Math.round((1.7+1.5*(l-1))*100)/100:0;
  }
  function paraHang(l,k){
    if(!k) return 0;
    return l?(listIsOrdered(k)?1.25:1.5):1.7;
  }
  function parasMarks(ps){
    var runs=[],gone=[];
    return ps.map(function(p){
      var L=p.lvl||0;
      if(runs.length>L+1) runs.length=L+1;
      if(gone.length>L+1) gone.length=L+1;
      while(runs.length<L+1) runs.push(null);
      while(gone.length<L+1) gone.push(null);
      if(!p.list){
        if(runs[L]&&runs[L].n) gone[L]=runs[L];
        runs[L]=null;
        return {k:'',n:0,first:0,ord:false,pos:paraPos(L,'')};
      }
      var ord=listIsOrdered(p.list),r=runs[L],g=gone[L],n=0,run;
      if(!ord) run={list:p.list,n:0,start:0,first:0};
      else if(r&&r.list===p.list&&(!p.start||p.start===r.start))
        run={list:p.list,n:r.n+1,start:r.start,first:r.first};
      else if(!r&&p.start&&g&&g.list===p.list&&g.start===p.start)
        run={list:p.list,n:g.n+1,start:p.start,first:g.n+1};
      else run={list:p.list,n:p.start||1,start:p.start||0,
        first:p.start||1};
      runs[L]=run;gone[L]=null;n=run.n;
      return {k:paraDrawKind(p.list,L),n:n,first:run.first,ord:ord,
        pos:paraPos(L,p.list)};
    });
  }
  /* the marker each kind draws -- the browser's own shapes and counters,
     so a dot is the dot every list here has always had */
  /* (1) 2) 3) is deck.css's @counter-style jv-paren: a counter style
     counts with the paragraphs, where a ::marker's counter() did not) */
  var PARA_LST={bullet:'disc',circle:'circle',square:'square',
    dash:'"\u2013\u00a0"',arrow:'"\u25b8\u00a0"',check:'"\u2713\u00a0"',
    number:'decimal',paren:'jv-paren',alpha:'lower-alpha',
    'alpha-upper':'upper-alpha',roman:'lower-roman',
    'roman-upper':'upper-roman'};
  /* put each paragraph of `host` where it goes, wearing its marker. Only
     what changed is written, so running it on every structural keystroke
     costs a walk over a box's few paragraphs.
     A NUMBER IS WRITTEN ONLY WHERE COUNTING ON WOULD NOT REACH IT
     (2026-10-10 review). The paragraphs are siblings, and the browser
     counts every one with a marker on from the one before -- 1. 2. 3.
     by itself, as an <ol> did. Writing every paragraph's number on it
     made one Enter near the top of a numbered list rewrite the style of
     every paragraph below it (26 writes, and a long task, in a 30-item
     list); now only a paragraph that begins a run, picks one up again,
     or follows a sub-list carries its number. */
  function paraCss(p,m,cnt){
    var css='';
    if(m.pos) css+='margin-left:'+m.pos+'em;';
    if(p.list){
      css+='list-style-type:'+PARA_LST[m.k]+';';
      cnt.v++;
      if(m.ord&&m.n!==cnt.v){css+='counter-set:list-item '+m.n+';';cnt.v=m.n;}
      if(p.lc) css+='--an-lc:'+tokVal(p.lc)+';';
      if(p.ls) css+='--an-ls:'+p.ls+';';
    }
    return css;
  }
  function paraDecorate(host){
    var els=[],ps=[];
    for(var c=host.firstElementChild;c;c=c.nextElementSibling)
      if(c.tagName==='P'){els.push(c);ps.push(paraAttrs(c));}
    var mk=parasMarks(ps),cnt={v:0};
    els.forEach(function(e,i){
      var m=mk[i],css=paraCss(ps[i],m,cnt);
      if(e.className!=='an-p') e.className='an-p';
      if((e.getAttribute('style')||'')!==css){
        if(css) e.setAttribute('style',css); else e.removeAttribute('style');}
      var dk=m.k||'';
      if((e.getAttribute('data-k')||'')!==dk){
        if(dk) e.setAttribute('data-k',dk); else e.removeAttribute('data-k');}
    });
    host.__jvN=host.childNodes.length;
  }
  /* THE ONE DRAWER: the paragraphs as one piece of markup, already
     wearing what paraDecorate would give them -- one parse for the box,
     where a <p> made and filled at a time was one parse a paragraph */
  function parasDraw(host,ps){
    if(host.firstElementChild){
      ps.forEach(function(p){
        var e=document.createElement('p');
        paraAttrsSet(e,p);
        e.innerHTML=p.h||'<br>';
        host.appendChild(e);
      });
      paraDecorate(host);
      return;
    }
    var mk=parasMarks(ps),cnt={v:0},out='';
    ps.forEach(function(p,i){
      var m=mk[i],css=paraCss(p,m,cnt),o=paraOpen(p);
      out+=o.slice(0,-1)+' class="an-p"'
        +(css?' style="'+css.replace(/&/g,'&amp;').replace(/"/g,'&quot;')+'"':'')
        +(m.k?' data-k="'+m.k+'"':'')+'>'+(p.h||'<br>')+'</p>';
    });
    host.insertAdjacentHTML('beforeend',out);
    host.__jvN=host.childNodes.length;
  }
  /* THE MARKER AS A CHARACTER: what a paragraph's ::marker shows, for a
     surface that draws words and nothing else (the strip) */
  var PARA_CH={bullet:'\u2022',circle:'\u25e6',square:'\u25aa',dash:'\u2013',
    arrow:'\u25b8',check:'\u2713'};
  function paraMarkText(k,n){
    if(PARA_CH[k]) return PARA_CH[k];
    var v=String(n),x=n;
    if(k==='alpha'||k==='alpha-upper'){
      v='';
      while(x>0){x--;v=String.fromCharCode(97+x%26)+v;x=Math.floor(x/26);}
    } else if(k==='roman'||k==='roman-upper'){
      v='';
      [[1000,'m'],[900,'cm'],[500,'d'],[400,'cd'],[100,'c'],[90,'xc'],
       [50,'l'],[40,'xl'],[10,'x'],[9,'ix'],[5,'v'],[4,'iv'],[1,'i']]
        .forEach(function(r){while(x>=r[0]){v+=r[1];x-=r[0];}});
    }
    if(/-upper$/.test(k)) v=v.toUpperCase();
    return v+(k==='paren'?')':'.');
  }
  /* A BOX AS LINES OF WORDS, each wearing its marker and set in by its
     level -- what the strip's thumbnail draws (2026-10-10 review): one
     text node, as it drew a.text before T623, where a <p> a paragraph
     sanitised, parsed and laid out every list box of every thumbnail
     again as the strip scrolled (2.4x the script, 30 fps) */
  function parasLines(ps){
    var mk=parasMarks(ps);
    return ps.map(function(p,i){
      var m=mk[i],at=m.pos-paraHang(p.lvl||0,p.list);
      var pad=new Array(Math.max(0,Math.round(at))+1).join('\u2003');
      var lead=p.list?paraMarkText(m.k,m.n)+'\u00a0':'';
      return pad+lead+paraPlain(p.h).replace(/\n/g,'\n'+pad
        +(p.list?'\u2003':''));
    }).join('\n');
  }
  /* the box as a whole, for the controls that show a state: the kind
     every paragraph with words shares, or '' */
  function boxListKind(a){
    if(!a||a.k!=='text'||a.md) return '';
    var ps=parasOf(a,0),full=ps.filter(function(p){
      return paraPlain(p.h).trim();});
    if(!full.length) full=ps;
    if(!full.length||!full.every(function(p){return p.list;})) return '';
    var fam=listIsOrdered(full[0].list);
    return full.every(function(p){return listIsOrdered(p.list)===fam;})
      ?paraDrawKind(full[0].list,full[0].lvl):'';
  }
  /* any marker or level at all -- a box that is more than its lines */
  function boxHasList(a){
    if(!a||a.k!=='text'||a.md) return false;
    if(listOf(a)) return true;
    if(!a.html) return false;
    return parasOf(a,0).some(function(p){return p.list||p.lvl;});
  }
  /* new words for a box whose paragraphs should keep their markers and
     levels: one line per paragraph (find and replace, the style table).
     EACH PARAGRAPH TAKES ITS OWN LINES (2026-10-10 review): a.text has a
     line for every paragraph AND for every line break inside one
     (Shift+Enter), so the lines are handed out by how many each
     paragraph has -- a break stays a break inside its bullet, where
     counting paragraphs against lines threw every marker away. A
     paragraph whose words did not change keeps its formatting too. */
  function parasReplaceText(a,v){
    v=String(v||'');
    var ps=parasOf(a,0),lines=v.split('\n');
    var marked=ps.some(function(p){return p.list||p.lvl;});
    if(marked||a.html){
      var has=ps.map(function(p){return paraPlain(p.h).split('\n');});
      var total=has.reduce(function(n,l){return n+l.length;},0);
      if(ps.length&&total===lines.length){
        var k=0;
        parasStore(a,0,ps.map(function(p,i){
          var mine=lines.slice(k,k+has[i].length);k+=has[i].length;
          if(mine.join('\n')===has[i].join('\n')) return p;
          return paraNew(p,mine.map(esc).join(p.h.indexOf('<br')>=0?'<br>':'\n'));
        }));
        return;
      }
    }
    var same=ps.length&&ps.every(function(p){return paraKey(p)===paraKey(ps[0]);});
    if(marked&&same){
      parasStore(a,0,lines.map(function(l){return paraNew(ps[0],esc(l));}));
      return;
    }
    parasMigrate(a,0);
    a.text=v;delete a.html;
  }
  /* ---- THE PARAGRAPHS OF THE BOX BEING TYPED IN -------------------------
     The editor is a block of the same <p>s (parasDraw), so the browser
     makes a paragraph per Enter, and Enter copies the paragraph's own
     attributes -- its level and its marker carry on, as in PowerPoint. */
  function paraEls(el){
    var o=[];
    for(var c=el.firstElementChild;c;c=c.nextElementSibling)
      if(c.tagName==='P') o.push(c);
    return o;
  }
  /* is `el` already exactly these paragraphs, as parasDraw would make
     them? (its own attributes and words; what paraDecorate draws aside) */
  var PARA_OWN=/^(class|style|data-k|data-lvl|data-list|data-start|data-lc|data-ls)$/;
  function paraSame(el,ps){
    var i=0;
    for(var c=el.firstChild;c;c=c.nextSibling,i++){
      if(c.nodeType!==1||c.tagName!=='P'||i>=ps.length) return false;
      for(var k=0;k<c.attributes.length;k++)
        if(!PARA_OWN.test(c.attributes[k].name)) return false;
      if(paraKey(paraAttrs(c))!==paraKey(ps[i])
         ||c.innerHTML!==(ps[i].h||'<br>')) return false;
    }
    return i===ps.length;
  }
  /* the paragraph (a <p> of the editor) a boundary point is in */
  function paraAt(el,n,off){
    if(!n||!el.contains(n)) return null;
    if(n===el){
      var k=el.childNodes; if(!k.length) return null;
      n=k[Math.min(off,k.length-1)];
    }
    while(n&&n.parentNode!==el) n=n.parentNode;
    return (n&&n.nodeType===1&&n.tagName==='P')?n:null;
  }
  /* nothing but empty markup between the paragraph's start and (n,off) */
  function paraAtStart(p,n,off){
    var r=document.createRange();
    try{r.setStart(p,0);r.setEnd(n,off);}catch(e){return false;}
    return r.toString().replace(/\u200b/g,'')==='';
  }
  function paraEmpty(p){
    return !String(p.textContent||'').replace(/\u200b/g,'');
  }
  /* a line of code in by a tab, or out by one (or by up to four spaces),
     in its own words: the live caret moves with the characters */
  function codeIndent(p,out){
    var w=document.createTreeWalker(p,NodeFilter.SHOW_TEXT),t=w.nextNode();
    while(t&&!t.nodeValue) t=w.nextNode();
    if(!out){
      if(t) t.insertData(0,'\t');
      else p.insertBefore(document.createTextNode('\t'),p.firstChild);
      return;
    }
    if(!t) return;
    var m=/^(\t| {1,4})/.exec(t.nodeValue);
    if(m) t.deleteData(0,m[0].length);
  }
  /* every paragraph the selection touches, first to last WHICHEVER WAY IT
     WAS DRAGGED (a range runs start to end), or the caret's one. A drag
     that ends at the very start of a paragraph does not take it. */
  function paraTouched(el,look){
    /* a command puts stray words into paragraphs first; a look (the
       buttons' state, as the caret moves) changes nothing */
    if(!look) paraNormalize(el);
    var s=window.getSelection();
    if(!s||!s.rangeCount) return [];
    var r=s.getRangeAt(0);
    if(!el.contains(r.startContainer)||!el.contains(r.endContainer)) return [];
    var a=paraAt(el,r.startContainer,r.startOffset),
        b=paraAt(el,r.endContainer,r.endOffset);
    if(!a||!b) return [];
    if(a===b) return [a];
    /* from the first to the last, walking only the paragraphs between
       them: the buttons ask this on every caret move, and a box's other
       paragraphs are none of their business */
    var out=[];
    for(var c=a;c;c=c.nextElementSibling){
      if(c.tagName==='P') out.push(c);
      if(c===b) break;
    }
    if(out[out.length-1]!==b) return [a];
    if(!r.collapsed&&paraAtStart(b,r.endContainer,r.endOffset)) out.pop();
    return out;
  }
  /* where the selection is, and back -- by node, so the text nodes a
     step moves keep the caret */
  function edSel(el){
    var s=window.getSelection();
    if(!s||!s.rangeCount) return null;
    var r=s.getRangeAt(0);
    if(!el.contains(r.startContainer)) return null;
    return {sc:r.startContainer,so:r.startOffset,ec:r.endContainer,
      eo:r.endOffset};
  }
  function edSelPut(x){
    if(!x) return;
    try{
      var r=document.createRange();
      r.setStart(x.sc,x.so);r.setEnd(x.ec,x.eo);
      var s=window.getSelection();s.removeAllRanges();s.addRange(r);
    }catch(e){}
  }
  /* EVERYTHING IN A <p>. Words typed into an empty editor, a <div> line
     or a list that arrived some other way are taken into paragraphs of
     their own, nodes and caret kept. */
  function paraNormalize(el){
    var bad=false,c;
    for(c=el.firstChild;c;c=c.nextSibling){
      if(c.nodeType===1&&c.tagName==='P') continue;
      if(c.nodeType===3&&!c.nodeValue) continue;
      bad=true;break;
    }
    if(!bad){
      if(!el.firstChild&&el.isContentEditable){
        var e0=document.createElement('p');
        e0.appendChild(document.createElement('br'));
        el.appendChild(e0);
        edSelPut({sc:e0,so:0,ec:e0,eo:0});
        paraDecorate(el);
      }
      return false;
    }
    var sv=edSel(el),run=null,prev=null;
    [].slice.call(el.childNodes).forEach(function(n){
      if(n.nodeType===1&&n.tagName==='P'){run=null;prev=n;return;}
      if(n.nodeType===3&&!n.nodeValue) return;
      if(n.nodeType===1&&(n.tagName==='UL'||n.tagName==='OL')){
        var f=document.createElement('div');
        parasDraw(f,parasParse(sanitizeRich(n.outerHTML).html,null));
        var last=null;
        while(f.firstChild){last=f.firstChild;el.insertBefore(last,n);}
        el.removeChild(n);run=null;prev=last;return;
      }
      if(n.nodeType===1&&PARA_BLOCK.test(n.tagName)){
        /* a line the browser made a block of: a paragraph like the one
           before it, as an Enter there would have made */
        var p=prev?prev.cloneNode(false):document.createElement('p');
        el.insertBefore(p,n);
        while(n.firstChild) p.appendChild(n.firstChild);
        el.removeChild(n);
        if(!p.firstChild) p.appendChild(document.createElement('br'));
        run=null;prev=p;return;
      }
      if(!run){
        run=prev?prev.cloneNode(false):document.createElement('p');
        el.insertBefore(run,n);prev=run;
      }
      run.appendChild(n);
    });
    edSelPut(sv);
    paraDecorate(el);
    return true;
  }
  /* what a paste brings, as words and structure only: no colour of its
     own, nothing a page carries besides its text (Word's <style> block,
     a <meta>) */
  function pasteClean(html){
    var t=document.createElement('template');t.innerHTML=String(html||'');
    $$('style,script,meta,title,head,link,xml',t.content).forEach(function(n){
      n.remove();});
    $$('[style],[color]',t.content).forEach(function(n){
      n.removeAttribute('style');n.removeAttribute('color');});
    return sanitizeRich(t.innerHTML).html;
  }
  /* put pasted paragraphs in at the caret: the first joins the caret's
     paragraph, the words after the caret follow the last, and each new
     one is a copy of the caret's paragraph -- its level and marker --
     unless it brought a marker of its own (its level then counted from
     the caret's) */
  function paraPaste(el,ps){
    var s=window.getSelection();
    if(!s||!s.rangeCount) return;
    paraNormalize(el);
    edOp(el,function(){
      var s2=window.getSelection(); if(!s2.rangeCount) return;
      var r=s2.getRangeAt(0),p0=paraAt(el,r.startContainer,r.startOffset);
      if(!p0) return;
      var tail=document.createRange();
      tail.setStart(r.startContainer,r.startOffset);
      tail.setEnd(p0,p0.childNodes.length);
      var rest=tail.extractContents();
      var empty0=paraEmpty(p0);
      if(empty0) while(p0.firstChild) p0.removeChild(p0.firstChild);
      var at0=paraAttrs(p0),last=p0,made=[p0];
      ps.forEach(function(q,i){
        var e=p0;
        if(i){e=p0.cloneNode(false);el.insertBefore(e,last.nextSibling);
          made.push(e);}
        if(q.list&&(i||empty0)){
          var at=paraNew(q,'');
          at.lvl=Math.min(PARA_LVL_MAX,(at0.lvl||0)+(q.lvl||0));
          paraAttrsSet(e,at);
        }
        var tp=document.createElement('template');tp.innerHTML=q.h;
        e.appendChild(tp.content);
        last=e;
      });
      var at1=last.childNodes.length;
      /* the words after the caret follow the last line; an empty
         paragraph's placeholder <br> is not words */
      if(String(rest.textContent||'').replace(/​/g,''))
        last.appendChild(rest);
      made.forEach(function(e){
        if(!e.firstChild) e.appendChild(document.createElement('br'));});
      edSelPut({sc:last,so:at1,ec:last,eo:at1});
    },s.isCollapsed?null:function(){
      document.execCommand('delete',false,null);});
    paraDecorate(el);
    if(el.__jvFlush) el.__jvFlush();
  }
  /* ---- THE EDITOR'S OWN UNDO -----------------------------------------
     A level or a marker is an attribute the browser's editing commands
     know nothing of (execCommand's indent made <blockquote>s, split the
     list at the first level and nested <ul> in <ul>), so the paragraph
     commands write the DOM themselves -- which the browser's own undo
     cannot see. So a box of paragraphs keeps ONE undo of its own, for
     every step: what you type, Enter, a paste, a cut, a Tab, a marker.
     A step is the mutation records it made, undone in reverse and
     redone in order, so Ctrl+Z steps back strictly in the order things
     happened and Ctrl+Y puts back every step it took.
     (2026-10-10 review: the first version kept only the paragraph
     commands, marked every run of the browser's steps as one entry and
     left those to the browser -- so the two stacks drifted, an op's
     execCommand('undo') popped whichever browser step was on top, and a
     Ctrl+Y that found nothing of ours did nothing: "Second line", typed
     and then undone, could never come back, and after an auto-bullet
     Ctrl+Z jumped to states that never existed. The browser's stack is
     now never used in a box of paragraphs.)
     Typing is one step while it goes on where the last key left the
     caret, as in Word; Enter, a paste, a cut and every command are a step
     each. What paraDecorate draws (style, class, data-k) is not a step:
     it follows from the paragraphs and is drawn again after each undo. */
  var ED_DRAWN=/^(style|class|data-k)$/;
  function edStart(el){
    edStop(el);
    var j={st:[],re:[],open:null,dirty:false,mute:0,inp:null};
    j.mo=new MutationObserver(function(rs){edTake(el,rs);});
    j.mo.observe(el,{subtree:true,childList:true,attributes:true,
      attributeOldValue:true,characterData:true,characterDataOldValue:true});
    el.__jvJ=j;
  }
  function edStop(el){
    var j=el&&el.__jvJ;
    if(!j) return;
    try{j.mo.disconnect();}catch(e){}
    delete el.__jvJ;
  }
  /* records into the step that is open (a new one if none is) */
  function edTake(el,rs){
    var j=el.__jvJ;
    if(!j||!rs.length||j.mute) return;
    var keep=[];
    rs.forEach(function(r){
      if(r.type==='attributes'&&(r.target===el||(ED_DRAWN.test(r.attributeName)
         &&r.target.parentNode===el))) return;
      keep.push({type:r.type,t:r.target,name:r.attributeName,old:r.oldValue,
        add:[].slice.call(r.addedNodes||[]),rem:[].slice.call(r.removedNodes||[]),
        prev:r.previousSibling,next:r.nextSibling});
    });
    if(!keep.length) return;
    j.dirty=true;
    if(!j.open) j.open=edPush(j,{kind:'',recs:[],before:j.sel||null,after:null});
    j.open.recs.push.apply(j.open.recs,keep);
    j.re.length=0;
  }
  /* whatever the observer still holds, into the open step, now */
  function edFlush(el){
    var j=el&&el.__jvJ;
    if(j) edTake(el,j.mo.takeRecords());
    return j;
  }
  /* the open step is done: nothing more joins it */
  function edSeal(el){
    var j=edFlush(el);
    if(j){
      if(j.open) j.open.after=j.open.after||edSel(el);
      j.open=null;j.sel=edSel(el);
    }
    return j;
  }
  function edSame(x,y){
    return !!(x&&y&&x.sc===y.sc&&x.so===y.so&&x.ec===y.ec&&x.eo===y.eo);
  }
  function edPush(j,st){
    j.st.push(st);
    if(j.st.length>200) j.st.shift();
    return st;
  }
  /* a key the browser is about to act on (beforeinput): the same step
     as the one before while you keep typing (or deleting) where the last
     key left you, a step of its own otherwise */
  var ED_RUN={insertText:'type',insertCompositionText:'type',
    deleteContentBackward:'del',deleteContentForward:'del',
    deleteWordBackward:'del',deleteWordForward:'del'};
  function edBefore(el,t){
    var j=edFlush(el);
    if(!j) return;
    /* the browser's input follows in this same task; one it never sends
       (a Backspace with nothing before it) must not make the next
       command's input look like this key's */
    j.inp=true;
    clearTimeout(j.inpT);
    j.inpT=setTimeout(function(){j.inp=false;},0);
    var kind=ED_RUN[t]||t,now=edSel(el),o=j.open;
    if(o&&ED_RUN[t]&&o.kind===kind
       &&(t==='insertCompositionText'||edSame(now,o.after))) return;
    if(o&&!o.recs.length){o.kind=kind;o.before=now;o.after=null;return;}
    if(o) o.after=o.after||now;
    j.open=edPush(j,{kind:kind,recs:[],before:now,after:null});
  }
  /* ...and done (input): where it left the caret. An input with no
     beforeinput is a command the browser ran for this page (execCommand:
     bold, a colour from the ribbon) -- a step of its own: what the last
     key did was taken into its step as that key's input arrived. */
  function edAfter(el){
    var j=el&&el.__jvJ;
    if(!j) return;
    if(!j.inp){
      if(j.open) j.open.after=j.open.after||edSel(el);
      j.open=null;j.sel=edSel(el);
      edFlush(el);
      if(j.open) j.open.kind='cmd';
      edSeal(el);
      return;
    }
    j.inp=false;
    edFlush(el);
    if(j.open) j.open.after=edSel(el);
  }
  /* ONE STEP of ours: fn's writes (and `native`'s first, a browser
     command the step begins with -- the typed "- " an auto-list
     deletes), so the first Ctrl+Z after an auto-list gives the "- " back.
     One that writes nothing is no step, and typing goes on as one. */
  function edOp(el,fn,native){
    var j=edFlush(el),prev=j?j.open:null;
    if(j){j.open=null;j.sel=edSel(el);}
    el.__jvOp=1;
    try{
      if(native) native();
      fn();
    }finally{el.__jvOp=0;}
    if(!j) return true;
    edFlush(el);
    if(!j.open){j.open=prev;return false;}
    j.open.kind='op';
    if(prev) prev.after=prev.after||j.open.before;
    edSeal(el);
    return true;
  }
  function edPut(r,fwd){
    if(r.type==='attributes'){
      if(!fwd) r.now=r.t.getAttribute(r.name);
      var v=fwd?r.now:r.old;
      if(v==null) r.t.removeAttribute(r.name); else r.t.setAttribute(r.name,v);
    } else if(r.type==='characterData'){
      if(!fwd) r.now=r.t.nodeValue;
      r.t.nodeValue=fwd?r.now:r.old;
    } else {
      var out=fwd?r.rem:r.add,inn=fwd?r.add:r.rem;
      out.forEach(function(n){if(n.parentNode===r.t) r.t.removeChild(n);});
      var ref=(r.next&&r.next.parentNode===r.t)?r.next
        :(r.prev&&r.prev.parentNode===r.t)?r.prev.nextSibling:null;
      inn.forEach(function(n){r.t.insertBefore(n,ref);});
    }
  }
  /* Ctrl+Z (back) or Ctrl+Y (forward) in a box of paragraphs. A step's
     records are put back in reverse (each record's value after it is
     read as it is undone, for the redo) and the caret goes where the
     step found it, or left it. */
  function edHistory(el,back){
    var j=edSeal(el);
    if(!j) return;
    var from=back?j.st:j.re,to=back?j.re:j.st;
    while(from.length&&!from[from.length-1].recs.length) from.pop();
    var top=from.pop();
    if(!top) return;
    j.mute++;
    try{
      var i;
      if(back){
        for(i=top.recs.length-1;i>=0;i--) edPut(top.recs[i],false);
        edSelPut(top.before);
      } else {
        for(i=0;i<top.recs.length;i++) edPut(top.recs[i],true);
        edSelPut(top.after);
      }
    }catch(e){}
    paraDecorate(el);
    edFlush(el);
    j.mute--;
    to.push(top);
    j.dirty=true;j.sel=edSel(el);
    if(el.__jvSoon) el.__jvSoon();
  }
  /* ONE CHANGE to some of the editor's paragraphs: fn(p, i, element) on
     each one's attributes. `loud` is a ribbon command -- a step of the
     deck's undo too, as every other format change is; a key (Tab,
     Backspace, Enter) is part of the typing, committed as typing is. */
  function paraEdit(el,ps,fn,loud){
    if(!el||!ps||!ps.length) return false;
    if(loud) histSettle();
    var did=edOp(el,function(){
      ps.forEach(function(e,i){
        var p=paraAttrs(e),was=paraKey(p);
        fn(p,i,e);
        if(paraKey(p)!==was) paraAttrsSet(e,p);
      });
    });
    paraDecorate(el);
    if(loud){
      if(el.__jvFlush) el.__jvFlush();
      if(did) markDirty();
    } else {
      if(el.__jvSoon) el.__jvSoon();
      /* List and Numbered say what the caret's paragraph now is */
      listButtonsSync(el,true);
    }
    return did;
  }
  /* the paragraphs a command found in the search box is about: noted as
     the search opened, while the box was still being typed in
     (58-command-search.js) -- {a, n (its page), set (indices), t} */
  var paraHint=null;
  /* the three things a paragraph command does to one paragraph */
  /* a paragraph moved to another level joins the run there (or begins
     one at a. or 1.) -- a start it carried was its old run's */
  function paraLevel(p,d){
    var l=Math.max(0,Math.min(PARA_LVL_MAX,(p.lvl||0)+d));
    if(l!==(p.lvl||0)) p.start=0;
    p.lvl=l;
  }
  /* a marker ON (a kind) or OFF (''). The List and Numbered buttons'
     plain dot and 1. take the levels' turns; a kind picked from a gallery
     is what every level draws */
  function paraListSet(p,kind){
    if(!kind){p.list='';p.start=0;p.lc='';p.ls=0;return;}
    p.list=(kind==='bullet'||kind==='number')?kind:paraBaseKind(kind,p.lvl||0);
    if(!listIsOrdered(p.list)) p.start=0;
  }
  /* the List / Numbered toggle over a set of paragraphs: OFF when every
     one already has a marker of that family, otherwise ON for those
     that do not (one that has that family's marker keeps its kind) */
  function paraListToggle(list,kind){
    var ord=listIsOrdered(kind);
    var on=list.length&&list.every(function(p){
      return p.list&&listIsOrdered(p.list)===ord;});
    return function(p){
      if(on) paraListSet(p,'');
      else if(!(p.list&&listIsOrdered(p.list)===ord)) paraListSet(p,kind);
    };
  }
  function activeTextEditable(){
    var ae=document.activeElement;
    if(ae&&ae.classList&&ae.classList.contains('an-tx')&&ae.isContentEditable
       &&ae.contentEditable!=='plaintext-only') return ae;
    return null;
  }
  function selectionInside(el){
    var sel=window.getSelection();
    if(!sel||sel.rangeCount===0||sel.isCollapsed) return false;
    var r=sel.getRangeAt(0);
    return el.contains(r.startContainer)&&el.contains(r.endContainer);
  }
  /* the words of an EDITOR, one line per paragraph */
  function editorText(el){
    return parasText(parasParse(el.innerHTML,null));
  }
  /* an editor's words into the page it is turned to */
  function paraCommit(a,n,el){
    parasStore(a,n,parasParse(sanitizeRich(el.innerHTML).html,null));
  }
  /* colour just the highlighted run inside the text box being edited;
     returns false when there is no live selection to recolour */
  /* ---- EDITING THE HIGHLIGHTED RUN (T290) ------------------------------
     colorSelection was the only control that asked "is a run selected?"
     before writing to the whole box. The write-back below is the fiddly
     half -- sanitise, find which PAGE of a multi-page box you are on,
     write both the plain text and the rich html -- so it is shared
     rather than copied: one action in two places is the shape this
     codebase already has too much of.
     Returns false when there is no caret selection, which is the
     caller's signal to fall back to the box-level property. */
  function richSelectionEdit(run){
    var el=activeTextEditable();
    if(!el||!selectionInside(el)) return false;
    histSettle();   /* T494: the typing is its own entry, under this one */
    run();
    var s=pres.slides[cur],a=annotByIdx(s,selAnnot);
    if(a){
      /* T261: write to the page the box is TURNED TO, not always page
         one. renderAnnots binds the editor's get/set to textAt(s,a) via
         textPage/textPageSet; assigning a.text/a.html directly meant
         recolouring a run on page 2 of a multi-page text box overwrote
         page ONE with page two's words -- silently, and persisted by
         autosave. textAt returns 0 for a single-page box and for the
         title/subtitle annots, so nothing else changes. */
      var n=textAt(s,a); if(!(n>0)) n=0;
      paraCommit(a,n,el);
      markDirty();
    }
    return true;
  }
  /* B / I / U / S on the highlighted words. styleWithCSS FALSE on
     purpose: we want real <b>/<i>/<u>/<strike> tags; sanitizeRich
     canonicalises Chromium's obsolete <strike> spelling to <s>. With it
     true the browser emits
     <span style="font-weight:bold">, and sanitizeRich strips every
     inline style except colour -- so the run would look right until the
     next blur and then quietly lose its weight. */
  function runStyleSelection(cmd){
    return richSelectionEdit(function(){
      try{document.execCommand('styleWithCSS',false,false);}catch(e){}
      try{document.execCommand(cmd,false,null);}catch(e){}
    });
  }
  /* T543: THE HIGHLIGHTER. A marker colour behind the highlighted words
     -- or none, which takes it off. The browser's hiliteColor writes the
     background; every run it touched is marked data-hl so the sanitizer
     can tell a highlight from a pasted background. Same commit path as
     colorSelection. */
  var HL_MARKS=[['#fff176','Yellow'],['#aef0b4','Green'],['#9ee7f5','Blue'],
    ['#ffb3d1','Pink'],['#ffd08a','Orange']];
  function highlightSelection(col){
    var el=activeTextEditable();
    if(!el||!selectionInside(el)) return false;
    histSettle();
    try{document.execCommand('styleWithCSS',false,true);}catch(e){}
    try{document.execCommand('hiliteColor',false,col||'transparent');}
    catch(e){}
    $$('span',el).forEach(function(sp){
      var bg=sp.style.backgroundColor; if(!bg) return;
      if(/transparent|rgba\(0, 0, 0, 0\)/.test(bg)){
        sp.style.backgroundColor='';sp.removeAttribute('data-hl');}
      else sp.setAttribute('data-hl','1');
    });
    var s=pres.slides[cur],a=annotByIdx(s,selAnnot);
    if(a){
      var n=textAt(s,a); if(!(n>0)) n=0;
      paraCommit(a,n,el);
      markDirty();
    }
    return true;
  }
  /* the marker row, for the Text colour door and the mini toolbar */
  function hlRow(host,compact){
    var row=document.createElement('div');
    row.className='hl-row'+(compact?' hl-compact':'');
    HL_MARKS.forEach(function(m){
      var b=document.createElement('button');
      b.type='button';b.className='hl-sw';b.dataset.hl=m[0];
      b.id=compact?'':('fmt-hl-'+m[1].toLowerCase());
      if(!b.id) b.removeAttribute('id');
      b.style.background=m[0];
      b.title=m[1]+' highlight behind the highlighted words';
      b.setAttribute('aria-label',m[1]+' highlight');
      row.appendChild(b);
    });
    var no=document.createElement('button');
    no.type='button';no.className='dbtn hl-none';no.dataset.hl='';
    if(!compact) no.id='fmt-hl-none';
    no.innerHTML=bic('none')+(compact?'':' No highlight');
    no.title='Take the highlight off the highlighted words';
    no.setAttribute('aria-label','No highlight');
    row.appendChild(no);
    row.addEventListener('mousedown',function(e){e.preventDefault();});
    row.addEventListener('click',function(e){
      var b=e.target.closest&&e.target.closest('[data-hl]');
      if(!b) return;
      e.stopPropagation();
      if(highlightSelection(b.dataset.hl)){
        renderSlide();
        if(typeof showFmt==='function') showFmt();
      } else toast('Highlight the words first \u2014 double-click into '
        +'the box and select them');
      var om=row.closest('.sh-menu'); if(om) overlayHide(om);
    });
    host.appendChild(row);
    return row;
  }
  function colorSelection(col){
    var el=activeTextEditable();
    if(!el||!selectionInside(el)) return false;
    histSettle();   /* T494: as richSelectionEdit */
    try{document.execCommand('styleWithCSS',false,true);}catch(e){}
    try{document.execCommand('foreColor',false,col);}catch(e){}
    var s=pres.slides[cur],a=annotByIdx(s,selAnnot);
    if(a){
      /* T261: write to the page the box is TURNED TO, not always page
         one. renderAnnots binds the editor's get/set to textAt(s,a) via
         textPage/textPageSet; this assigned a.text/a.html directly, so
         recolouring a run on page 2 of a multi-page text box overwrote
         page ONE with page two's words -- silently, and persisted by
         autosave. textAt returns 0 for a single-page box and for the
         title/subtitle annots, so nothing else changes. */
      var n=textAt(s,a); if(!(n>0)) n=0;
      paraCommit(a,n,el);
      markDirty();
    }
    return true;
  }
  /* ---- T544: CLEAR FORMATTING AND CHANGE CASE -------------------------
     PowerPoint's eraser (Ctrl+Space) and its Aa (Shift+F3 steps through
     the cases). Both follow the rule B, I and U keep (T290): the
     highlighted words while you type, the whole box otherwise.
     A WHOLE BOX GOES BACK TO ITS TEXT STYLE -- Body when it wears none,
     which is what every drawn box is born wearing -- and that is this
     editor's "default formatting". What a paragraph is (its alignment,
     spacing, bullets) and what the BOX is (its fill, its edge) are not
     formatting of the words, and PowerPoint's Ctrl+Space leaves them
     too. */
  /* the box being typed in, rich OR plain: a title, a subtitle and a
     Markdown box edit as plain text, and a case change, or a caret kept
     across a redraw, means them as well (activeTextEditable is the rich
     ones alone, because only those can hold a run of bold) */
  function liveTextEditable(){
    var ae=document.activeElement;
    return (ae&&ae.classList&&ae.classList.contains('an-tx')
      &&ae.isContentEditable)?ae:null;
  }
  /* where the caret is, as characters into the box, and back again --
     the node it sat in may not survive what happens in between */
  function caretAt(el){
    try{
      var sel=window.getSelection();
      if(!sel||!sel.rangeCount) return null;
      var r=sel.getRangeAt(0),pre=r.cloneRange();
      if(!el.contains(r.startContainer)) return null;
      pre.selectNodeContents(el);pre.setEnd(r.startContainer,r.startOffset);
      return {s:pre.toString().length,n:r.toString().length};
    }catch(e){return null;}
  }
  function caretPut(el,at){
    if(!el||!at) return;
    try{
      var walk=document.createTreeWalker(el,NodeFilter.SHOW_TEXT,null);
      var node,seen=0,rg=document.createRange(),started=false;
      while((node=walk.nextNode())){
        var len=node.nodeValue.length;
        if(!started&&seen+len>=at.s){
          rg.setStart(node,at.s-seen);started=true;}
        if(started&&seen+len>=at.s+at.n){
          rg.setEnd(node,at.s+at.n-seen);break;}
        seen+=len;
      }
      if(started){
        var sl=window.getSelection();sl.removeAllRanges();sl.addRange(rg);}
    }catch(e){}
  }
  /* the words and their lines without their looks: every inline wrapper
     comes off (bold, a colour, a highlight, a raised run, a face) and the
     structure stays -- the lines, and a list's items and marker kind */
  var PLAIN_DROP={b:1,strong:1,i:1,em:1,u:1,s:1,strike:1,sup:1,sub:1,
    font:1,span:1};
  function plainRuns(html){
    var t=document.createElement('template');t.innerHTML=String(html||'');
    [].slice.call(t.content.querySelectorAll('*')).reverse()
      .forEach(function(n){
        if(!PLAIN_DROP[(n.tagName||'').toLowerCase()]) return;
        while(n.firstChild) n.parentNode.insertBefore(n.firstChild,n);
        n.parentNode.removeChild(n);
      });
    return t.innerHTML;
  }
  /* a whole box's words, back to the style it wears */
  function clearBoxLook(a,which){
    if(!a) return;
    if(which==='t'||which==='s'){
      /* a title slide's two lines wear no style: their look is the one
         titleProps gives them on a fresh slide */
      ['b','i','u','strike','font'].forEach(function(k){delete a[k];});
      a.size=(which==='t')?6:2.6;
      if(which==='s') a.color='@quiet'; else delete a.color;
      return;
    }
    if(a.k!=='text') return;
    var d=styleDef(a.style&&styleDef(a.style)?a.style:'body')||{};
    if(d.size) a.size=d.size;
    if(d.b) a.b=1; else delete a.b;
    if(d.i) a.i=1; else delete a.i;
    if(d.font) a.font=d.font; else delete a.font;
    if(d.color) a.color=d.color; else delete a.color;
    delete a.u;delete a.strike;
    textPages(a).forEach(function(p,n){
      if(!p.h) return;
      var r=sanitizeRich(plainRuns(p.h));
      /* a line break inside a paragraph (Shift+Enter, T623) is not a
         new paragraph, which is all the plain text could say */
      textPageSet(a,n,p.t,(r.rich||/<br\b/i.test(r.html))?r.html:'');
    });
  }
  /* the highlighted run, stripped by the browser's own removeFormat --
     it splits the bold or the colour at the run's edges, which is the
     fiddly half -- and committed like every other run edit */
  function clearRunSelection(){
    return richSelectionEdit(function(){
      try{document.execCommand('removeFormat',false,null);}catch(e){}
    });
  }
  /* CHANGE CASE. What each character becomes -- 'U', 'L' or '' to leave
     it -- is decided over the whole run of words, because a sentence or
     a word does not end where a text node does, and applied only where
     asked. Maths, code, a {field}, a [@citation] and a web address stay
     exactly as typed: upper-casing \alpha, {fig:a} or a link breaks it. */
  var CASE_MODES=[['sentence','Sentence case.'],['lower','lowercase'],
    ['upper','UPPERCASE'],['title','Capitalise Each Word'],
    ['toggle','tOGGLE cASE']];
  var CASE_KEEP=new RegExp(['\\$\\$[\\s\\S]*?\\$\\$','\\$[^$\\n]+\\$',
    '\\\\\\([\\s\\S]*?\\\\\\)','`[^`\\n]*`','\\{[^{}\\n]*\\}',
    '\\[@[^\\]\\n]*\\]','\\\\[a-zA-Z]+(\\{[^}\\n]*\\})?',
    '\\]\\([^)\\n]*\\)','(https?:\\/\\/|www\\.)[^\\s<>"]+',
    '[^\\s@<>"()]+@[^\\s@<>"()]+\\.[a-zA-Z]{2,}'].join('|'),'g');
  function caseIsLetter(c){return c.toUpperCase()!==c.toLowerCase();}
  function caseWordStart(str,i){
    if(i<=0) return true;
    var p=str.charAt(i-1);
    if(caseIsLetter(p)||/[0-9]/.test(p)) return false;
    /* don't, it's: an apostrophe between two letters is inside a word */
    if((p==='\''||p==='\u2019')&&i>1&&caseIsLetter(str.charAt(i-2)))
      return false;
    return true;
  }
  function caseMarks(str,mode){
    var n=str.length,out=[],keep=[],m,k;
    CASE_KEEP.lastIndex=0;
    while((m=CASE_KEEP.exec(str))){
      for(k=m.index;k<m.index+m[0].length;k++) keep[k]=1;
      if(!m[0].length) CASE_KEEP.lastIndex++;
    }
    var start=true,ended=false;
    for(var i=0;i<n;i++){
      var c=str.charAt(i);
      out[i]='';
      if(keep[i]){start=false;ended=false;continue;}
      if(!caseIsLetter(c)){
        if(c==='\n'){start=true;ended=false;}
        else if(/[.!?]/.test(c)) ended=true;
        else if(/\s/.test(c)){if(ended){start=true;ended=false;}}
        else if(/[0-9]/.test(c)){start=false;ended=false;}
        continue;
      }
      if(mode==='upper') out[i]='U';
      else if(mode==='lower') out[i]='L';
      else if(mode==='toggle') out[i]=(c===c.toUpperCase())?'L':'U';
      else if(mode==='title') out[i]=caseWordStart(str,i)?'U':'L';
      else out[i]=start?'U':'L';
      start=false;ended=false;
    }
    return out;
  }
  /* one character; a mapping that would change the length (ß to SS)
     leaves it alone, so every caret offset still means the same place */
  function caseChar(c,mk){
    if(!mk) return c;
    var x=(mk==='U')?c.toUpperCase():c.toLowerCase();
    return x.length===c.length?x:c;
  }
  function caseString(str,mode){
    str=String(str||'');
    var mk=caseMarks(str,mode),o='';
    for(var i=0;i<str.length;i++) o+=caseChar(str.charAt(i),mk[i]);
    return o;
  }
  /* Shift+F3's next step, PowerPoint's order: lowercase becomes
     Capitalise Each Word, that becomes UPPERCASE, and UPPERCASE comes
     back down to lowercase */
  function caseNext(sample){
    sample=String(sample||'');
    if(sample.toUpperCase()===sample&&sample.toLowerCase()!==sample)
      return 'lower';
    if(sample.toLowerCase()===sample) return 'title';
    return 'upper';
  }
  /* the text nodes of a box in reading order, with a line break where a
     line or a list item begins, so a sentence ends where a line does */
  function caseNodes(root){
    var list=[],full='';
    function brk(){if(full&&full.charAt(full.length-1)!=='\n') full+='\n';}
    (function walk(n){
      for(var c=n.firstChild;c;c=c.nextSibling){
        if(c.nodeType===3){list.push({n:c,at:full.length});full+=c.nodeValue;}
        else if(c.nodeType===1){
          if(c.tagName==='BR'){full+='\n';continue;}
          var blk=/^(DIV|P|LI|UL|OL|H[1-6])$/.test(c.tagName);
          if(blk) brk();
          walk(c);
          if(blk) brk();
        }
      }
    })(root);
    return {list:list,full:full};
  }
  /* change the case of a box's words in place: inside `range`, or all
     of them. Text nodes are rewritten, never replaced, so the bold and
     the colours around them stay exactly where they were. Every edit is
     worked out BEFORE the first is written: writing a node moves a live
     range's boundary inside it, and the range is what says where the
     next node's edit starts. */
  function caseDom(root,mode,range){
    var cn=caseNodes(root),mk=caseMarks(cn.full,mode),edits=[];
    cn.list.forEach(function(e){
      var t=e.n.nodeValue,from=0,to=t.length;
      if(range){
        if(!range.intersectsNode(e.n)) return;
        if(e.n===range.startContainer) from=range.startOffset;
        if(e.n===range.endContainer) to=range.endOffset;
      }
      var o=t.slice(0,from);
      for(var i=from;i<to;i++) o+=caseChar(t.charAt(i),mk[e.at+i]);
      o+=t.slice(to);
      if(o!==t) edits.push([e.n,o]);
    });
    edits.forEach(function(x){x[0].nodeValue=x[1];});
    return edits.length>0;
  }
  /* a whole box, in the model: every page of it, its plain words and its
     rich ones alike. An equation's words are LaTeX and are left alone. */
  function caseBox(a,which,s,mode){
    if(which==='t'){s.title=caseString(s.title,mode);return;}
    if(which==='s'){s.sub=caseString(s.sub,mode);return;}
    if(!a||a.k!=='text'||a.maths) return;
    textPages(a).forEach(function(p,n){
      var h='';
      if(p.h){
        var t=document.createElement('template');t.innerHTML=p.h;
        caseDom(t.content,mode,null);
        h=t.innerHTML;
      }
      textPageSet(a,n,caseString(p.t,mode),h);
    });
  }
  /* the words the next Shift+F3 is about, for deciding where it goes */
  function caseSample(){
    var el=liveTextEditable();
    if(el){
      var sel=window.getSelection();
      if(sel&&sel.rangeCount&&!sel.isCollapsed&&el.contains(sel.anchorNode))
        return sel.toString();
      return el.textContent||'';
    }
    var s=pres.slides[cur];
    if(selAnnot==='t') return (s&&s.title)||'';
    if(selAnnot==='s') return (s&&s.sub)||'';
    var a=s&&annotByIdx(s,selAnnot);
    return (a&&a.k==='text')?(textPage(a,0).t||''):'';
  }
  /* CHANGE CASE, from the door or the key. Typing: the highlighted
     words (or, with none, the whole box) change where they stand, the
     highlight stays so Shift+F3 can go round again, and the box commits
     through its own editor. Otherwise every selected text box, in the
     model. Returns false when there is no text to change. */
  function applyCase(mode){
    if(mode==='next') mode=caseNext(caseSample());
    var el=liveTextEditable();
    if(el){
      var sel=window.getSelection(),rg=null;
      if(sel&&sel.rangeCount&&!sel.isCollapsed){
        var r=sel.getRangeAt(0);
        if(el.contains(r.startContainer)&&el.contains(r.endContainer)) rg=r;
      }
      var at=caretAt(el);
      histSettle();
      caseDom(el,mode,rg);
      if(typeof el.__jvFlush==='function') el.__jvFlush();
      markDirty();
      caretPut(el,at);
      return true;
    }
    var s=pres.slides[cur]; if(!s) return false;
    var any=selAnnot==='t'||selAnnot==='s';
    selIdxs().forEach(function(i){
      var x=(s.annots||[])[i]; if(x&&x.k==='text'&&!x.maths) any=true;});
    if(!any) return false;
    fmtApply(function(a){
      caseBox(a,a===s.tprops?'t':a===s.sprops?'s':'',s,mode);
    });
    return true;
  }
  /* the ⠿ move handle is gone: everything drags from its own body now,
     and the handle was both fiddly to hit and sat on top of the artwork
     you were trying to judge (2026-08-07, user) */
  /* EIGHT handles, not four. "Why can pictures it seems only be dragged
     on diagonal, so can't be made taller or wider" (2026-08-29, user,
     T65): the four corners were the whole set, so there was no gesture
     that changed one dimension. A corner anchors the opposite corner; a
     SIDE anchors the opposite edge and leaves the other axis alone.
     `noH` drops the top and bottom handles for an item that has no
     height of its own -- a text box auto-heights from its words, which
     is why startResize guards every height write with a.k!=='text'.
     An n/s handle on one would be a control that cannot do anything. */
  function mkResize(tip,noH){
    var frag=document.createDocumentFragment();
    var sides=noH?['nw','ne','sw','se','e','w']
      :['nw','ne','sw','se','n','e','s','w'];
    sides.forEach(function(cn){
      var r=document.createElement('span');
      r.className='an-resize an-rs-'+cn;
      r.dataset.corner=cn;
      r.title=tip||(cn.length===2?'Drag to resize'
        :(cn==='e'||cn==='w')?'Drag to change the width'
        :'Drag to change the height');
      frag.appendChild(r);
    });
    return frag;
  }
  function mkRotate(){
    var r=document.createElement('span');r.className='an-rotate';
    r.title='Drag to rotate freely (Shift snaps to 15°)';
    return r;
  }
  function attachAnnots(slideEl,s){
    /* Every real slide path comes through here: canvas, playback,
       presenter previews, print and standalone HTML. Put the deck CSS
       tokens on the page before any object asks for them. */
    applyTokens(slideEl);
    var layer=document.createElement('div');
    layer.className='annot-layer tool-'+tool;
    /* while EDITING the layer does not clip: an item nudged past the edge
       has to stay visible so you can drag it back (2026-08-20). Playback
       and every export still clip to the page, which is what a page IS. */
    if(mode==='edit') layer.classList.add('an-spill');
    slideEl.appendChild(layer);
    renderAnnots(layer,s);
    if(mode==='edit') wireEditor(layer,s);
    /* draw any Plotly figures cloned into cell frames (json specs only —
       cloned scripts would clash on duplicate ids) */
    if(window.SemActivate) window.SemActivate(layer,true);
  }
  /* Commit every live on-canvas edit into the model, right now. Anything
     that is about to persist, re-render or tear down the page calls this
     first; see the long note in editableText for what each of those used
     to lose. Safe to call when nothing is being edited. */
  /* THE OPEN EDITORS, KEPT AS THEY OPEN (2026-10-09, speed). Finding the
     box being typed in was a selector list over the whole document --
     the notebook behind the editor included, 13-40k nodes -- on every
     render, every save, every slide change and every format click: 5-7
     ms a time at 4x, 60 times over in a print. Only two things in the
     app ever become editable, a text box (beginEdit) and a table cell
     (startTableEdit), and both say so here as they do. A member counts
     while it is still in the page and still editable -- exactly what
     the selector used to find -- and one that has left the page is
     dropped the next time anyone asks. */
  var liveEds=new Set();
  function liveEdOn(el){if(el) liveEds.add(el);}
  function liveEdOff(el){if(el) liveEds.delete(el);}
  function liveEditors(){
    var out=[];
    liveEds.forEach(function(el){
      if(!el.isConnected){liveEds.delete(el);return;}
      var ce=el.getAttribute('contenteditable');
      if(ce==='true'||ce==='plaintext-only') out.push(el);
    });
    return out;
  }
  /* DEFERRED COMMITS. An input whose every keystroke used to be a quiet
     markDirty (the slide notes, editor #12) now writes the model at once
     and owes the bookkeeping a moment later; anything about to save,
     re-render or leave the page settles what is owed first, here, so the
     draft and the save always see it counted. */
  var quietOwed=[];
  function quietOwe(fn){if(quietOwed.indexOf(fn)<0) quietOwed.push(fn);}
  function quietPaid(fn){
    var k=quietOwed.indexOf(fn); if(k>=0) quietOwed.splice(k,1);}
  function quietSettle(){
    while(quietOwed.length){
      var f=quietOwed.shift();
      try{f();}catch(e){}
    }
  }
  function flushTextEdits(){
    /* NOTHING IS TYPED INTO A TALK (2026-10-09, speed). Every step of a
       show re-renders the slide, and each render asked the whole page --
       the notebook behind it included, ~40k nodes -- for live editors:
       8 ms a click at 4x. An editor exists only while editing (wireEditor),
       and the one switch into a talk commits whatever was still open
       before it changes anything (setUIModeRun's first line). */
    /* ...and nothing is SETTLED in one either. View mode here is a render
       borrowing the moment -- a print page, the presenter's previews, a
       History thumbnail of another deck, a ghost of another slide -- with
       cur, the selection or the deck itself swapped out, and the owed
       markDirty would fill the panes from that, or (another deck) be
       dropped. What is owed stays owed for the real moment. */
    if(mode==='view') return;
    quietSettle();
    if(!liveEds.size) return;
    var live=liveEditors();
    for(var i=0;i<live.length;i++){
      var f=live[i].__jvFlush;
      if(typeof f==='function'){try{f();}catch(e){}}
    }
  }
  window.SemDeckFlush=flushTextEdits;   /* test hook */
  /* THE LAST CHANCE. A tab can be closed, crashed or backgrounded without
     ever firing blur, and the editor had no unload handler of any kind —
     the only grep hit in the file was the presenter popup clearing its own
     handle. pagehide and visibilitychange are the pair that actually fire
     (beforeunload is skipped on mobile and unreliable on a crash); both
     are cheap, because the flush's own markDirty writes the draft. */
  (function(){
    function lastChance(e){
      try{flushTextEdits();}catch(e){}
      /* a talk's address waits for its clicks to pause; not for this */
      try{if(typeof routeFlush==='function') routeFlush();}catch(e){}
      /* the draft write is debounced now — a closing tab cannot wait */
      try{flushDraftWrite();}catch(e){}
      if(e&&e.type==='pagehide'){
        try{rehStop();}catch(err){}
        /* T564: the microphone goes down with the page */
        try{if(typeof narrHalt==='function') narrHalt();}catch(err){}
      }
    }
    /* Only leaving the page ends the run. Visibility hidden also fires
       when the speaker changes windows, and must remain a flush rather
       than quietly chopping the rehearsal in two (T48). */
    window.addEventListener('pagehide',lastChance);
    document.addEventListener('visibilitychange',function(){
      if(document.visibilityState==='hidden') lastChance();
    });
  })();
  function editableText(layer,el,getVal,setVal,idx,rich,getHtml,getParas){
    /* Text is NOT editable on contact. It used to be, which is why a text
       box could only be moved by a little ⠿ handle: clicking the words
       put a caret in them instead of picking the box up. So: click to
       select and drag like anything else, DOUBLE-click to type — which is
       what every other tool on the machine does (2026-08-07, user: "just
       make it normal moving controls"). */
    var editMode=(el.tagName==='UL'||rich)?'true':'plaintext-only';
    /* T623: a rich box is edited as PARAGRAPHS -- its <p>s, their levels
       and markers (THE PARAGRAPH). A title, a subtitle and a Markdown box
       are typed as plain text and have none. */
    var paraOn=(editMode==='true'&&typeof getParas==='function');
    /* WHAT YOU EDIT IS WHAT YOU TYPED. Two renderers replace the text
       node with markup of their own -- MathJax with an <mjx-container>,
       and notesHtml with the <h4>/<ul>/<p> of a markdown box -- and the
       blur commit reads the element back as the new source. So a caret
       landing in either, plus one keystroke, turned "$$E = mc^2$$" or
       "## Results" into whatever those glyphs flatten to.

       THE MATHS HALF WAS GATED ON `!rich` AND SO NEVER FIRED (found by
       the parallel branch's T53, ported 2026-08-30). The comment that
       stood here claimed `rich` "owns its own markup and never carries
       maths", and that premise is false in this codebase: the annot
       call site passes `!a.md`, so rich is TRUE for every text box that
       is not a markdown box -- the equation editor's own box included,
       since it writes {k:'text',...,maths:1} and no html. Titles and
       subtitles pass no rich argument at all, which is why THEY were
       protected and the equations on the page were not. Double-clicking
       an equation box, the ordinary way to edit anything else, cost you
       the LaTeX; the box then no longer matched hasMaths, so it would
       never be typeset again either.

       Asked of what the box actually HOLDS, not of a flag: a rich box
       restores its stored markup through the sanitiser, anything else
       restores the model's string. */
    function restoreSource(){
      if(!el.querySelector) return;
      if(el.classList.contains('an-md')){
        var md=getVal();
        if(md) el.textContent=md;
        return;
      }
      if(!el.querySelector('mjx-container')) return;
      /* a box of paragraphs is drawn again from them, markers and all */
      if(paraOn){el.innerHTML='';parasDraw(el,getParas());return;}
      var h=getHtml&&getHtml();
      if(h) el.innerHTML=sanitizeRich(h).html;
      else {
        var raw=getVal();
        if(raw) el.textContent=raw;
      }
    }
    /* AN EMPTY BOX OPENS EMPTY (T366). A box of paragraphs keeps one, with
       its marker: an empty bullet is not an empty element -- the dot is
       the caret target, and clearing it removed it the moment an
       auto-list had made it. A box with words keeps them. A plain one
       opens with nothing in it at all, so it still wears its "Type..."
       while the caret waits in it (T191: a caret and nothing else read as
       "nothing happened"); the first key makes it a paragraph. */
    function openEmpty(){
      if(getVal()) return;
      if(!paraOn){if(!el.querySelector('li')) el.textContent='';return;}
      var first=paraEls(el)[0];
      if(!first||(!first.hasAttribute('data-list')
                  &&!first.hasAttribute('data-lvl'))){
        if(el.firstChild) el.innerHTML='';
        el.__jvN=0;
        return;
      }
      if(el.childNodes.length===1&&paraEmpty(first)) return;
      var keep=first.cloneNode(false);
      keep.appendChild(document.createElement('br'));
      el.innerHTML='';el.appendChild(keep);
      paraDecorate(el);
    }
    function beginEdit(){
      restoreSource();
      /* T366: AN EMPTY BOX OPENS EMPTY, and a placeholder is an empty
         box wearing a hint (getVal answers '' for one). Done here and
         not only on `focus`, because focus does not fire when the
         element already holds it -- clicking into a box you are already
         in left the hint sitting there to be selected and deleted,
         which is the annoyance being removed. */
      /* An empty LIST is not an empty element: its first <li><br></li>
         is the marker and caret target. Clearing the root here removed
         that item immediately after dash-to-bullet rebuilt the editor,
         and the apparently-created box then vanished. */
      openEmpty();
      try{el.contentEditable=editMode;}catch(e){el.contentEditable='true';}
      liveEdOn(el);   /* the open editors (flushTextEdits) */
      el.focus();
      /* the box's own undo (THE EDITOR'S OWN UNDO), from the words it
         opened with; a double-click inside a box being typed in keeps
         the one it has */
      if(paraOn&&!el.__jvJ) edStart(el);
      var host=el.closest?el.closest('.an-item'):null;
      if(host) host.classList.add('an-editing');
    }
    function endEdit(){
      edStop(el);
      el.contentEditable='false';
      liveEdOff(el);
      var host=el.closest?el.closest('.an-item'):null;
      if(host) host.classList.remove('an-editing');
    }
    el.contentEditable='false';
    /* a JUST-DRAWN box must open ready to type without the double-click —
       focus() on a non-editable span silently does nothing, so focusText
       could never land the caret (found 2026-08-20, in-browser: the
       active element stayed on <body> and typing went nowhere) */
    el._beginEdit=beginEdit;
    el.addEventListener('dblclick',function(e){
      if(tool!=='select') return;
      /* inside a group, the FIRST double-click steps in and selects this
         item; only once you are inside does it start typing */
      var sg=pres.slides[cur],ag=sg&&annotByIdx(sg,idx);
      if(ag&&ag.grp!=null&&inGroup!==ag.grp) return;
      e.stopPropagation();
      /* T442: A MATHS BOX OPENS IN THE EQUATION EDITOR (2026-09-14,
         user: "with equations it would be good if you can go back into
         the equation and edit in the equation editor. Currently you
         cannot do this"). The Edit equation button on the Text tab was
         the only way back in, and a double-click -- the way into every
         other box -- put a bare caret on the LaTeX instead. */
      if(typeof idx==='number'&&ag&&typeof isMaths==='function'
         &&isMaths(ag)&&window.SemDeckEquation){
        window.SemDeckEquation(idx);return;
      }
      /* WHICH CLICK THIS IS. The caret-placing below is right for the
         double-click that OPENS the box — you want the caret where you
         pointed, not at the end. It was running on every double-click,
         including ones fired inside a box already being edited, and
         caretRangeFromPoint returns a COLLAPSED range: so it threw away
         the word the browser had just selected and left a bare caret.
         Double-click-to-select-a-word could never work (2026-08-29). */
      var wasEditing=el.isContentEditable;
      beginEdit();
      if(wasEditing) return;   /* let the browser select the word */
      /* put the caret where the words were double-clicked, not at the end */
      try{
        var r=document.caretRangeFromPoint
          ? document.caretRangeFromPoint(e.clientX,e.clientY):null;
        if(r){var sel=window.getSelection();sel.removeAllRanges();
          sel.addRange(r);}
      }catch(err){}
    });
    /* ...and the FOURTH click takes the whole box. Two and three are the
       browser's own (word, then line); there is no native fourth, and
       "select everything in here" is the one people reach for before
       restyling a caption. `detail` counts the clicks in a run. */
    el.addEventListener('click',function(e){
      if(e.detail<4||!el.isContentEditable) return;
      e.preventDefault();e.stopPropagation();
      try{
        var r2=document.createRange();
        r2.selectNodeContents(el);
        var s3=window.getSelection();
        s3.removeAllRanges();s3.addRange(r2);
      }catch(err){}
    });
    /* Spellcheck ON while editing. It used to be off everywhere, which
       meant a typo could travel all the way onto a printed A0 poster with
       nothing ever flagging it (2026-08-07). Only editable text is
       checked, so Present, print and every export stay squiggle-free —
       editableText is wired in edit mode alone. */
    el.spellcheck=true;
    el.addEventListener('focus',function(){
      if(tool!=='select') el.blur();
    });
    el.addEventListener('focus',function(){
      /* beginEdit already preserves an empty list's first paragraph;
         focus must make the same distinction or it erases that caret
         target one event later. */
      openEmpty();
    });
    /* THE CARET NEVER ENTERS A BUILD WRAPPER. The pieces a text build is
       cut into are render-time <span>s (17-text-builds.js): typing
       inside one would put the caret in markup that is about to be
       thrown away, and Enter inside one would split the wrapper in two.
       They come off here and go back on in the blur below -- which has
       to do it itself, because committing a box writes into the element
       IN PLACE and never re-renders the layer. That is the same reason
       the markdown and maths fixups live down there. */
    el.addEventListener('focus',function(){unsplitParts(el);});
    /* WHAT YOU HAVE TYPED IS NOT IN THE DECK UNTIL THIS RUNS, and until
       2026-08-22 the only thing that ran it was `blur`. So: Ctrl+S while
       typing opened the browser's own Save-page dialog and saved nothing;
       renderAnnots' `layer.innerHTML=''` removes the focused node, which
       fires no blur in Chrome or Firefox, so every notebook refresh and
       every slide change silently ate the paragraph; closing the tab lost
       it; and because markDirty never ran, the 1.2s autosave was not
       running during the one activity that produces unrecoverable text —
       while the readout said "autosaved". Hence a named flush the other
       paths can call, plus a debounced one while you type, so a crash
       costs a phrase rather than a slide. */
    /* WHAT THIS BOX LAST COMMITTED, so the same words are not committed
       twice (2026-10-09). Every save flushes the box being typed in, the
       flush called markDirty, and markDirty armed the next autosave: a
       caret left in a box saved the whole project every 15 s for as long
       as it sat there -- 400 ms of jank and a whole-file rewrite each
       time -- and kept re-arming the 20-second consolidation so it never
       ran. Words that changed since the last commit still commit; the
       blur below always commits, as it always has. */
    var lastCommit=null;
    /* THE EDITOR'S WORDS, READ ONCE: the sanitised markup, its paragraphs
       and their plain lines. A commit read the box three or four times
       over (the plain text, the sanitiser, the paragraphs, then the
       paragraphs again to store them) -- 40 ms a commit at 4x in a
       30-item list (2026-10-10 review). */
    function readNow(){
      var r=rich?sanitizeRich(el.innerHTML):null;
      var ps=(r&&paraOn)?parasParse(r.html,null):null;
      var v=(ps?parasText(ps):editorText(el)).replace(/\r/g,'')
        .replace(/\n+$/,'');
      return {v:v,r:r,ps:ps};
    }
    function commitNow(quiet){
      if(!el.isContentEditable) return;
      /* nothing changed since the last commit: nothing to read. A ribbon
         command settles the typing first (T494), and that read the whole
         box even with nothing typed -- twice per click with the second
         read after the change (2026-10-10 review) */
      var j=paraOn?edFlush(el):null;
      if(j&&!j.dirty) return;
      var w=readNow();
      if(j) j.dirty=false;
      var sig=w.v+'\u0000'+(w.r?w.r.html:'');
      if(sig===lastCommit) return;
      lastCommit=sig;
      setVal(w.v,w.r,w.ps);
      markDirty(quiet);
    }
    el.__jvFlush=function(){commitNow(true);};
    var typeT=null;
    /* a commit owed, as typing owes one: an undo or a redo */
    el.__jvSoon=function(){
      clearTimeout(typeT);
      typeT=setTimeout(function(){commitNow(true);},900);
    };
    el.addEventListener('input',function(e){
      clearTimeout(typeT);
      typeT=setTimeout(function(){commitNow(true);},900);
      /* T545: AutoCorrect, as the last character of a rule lands (in a
         box of paragraphs, as a step of its undo -- below) */
      if(el.isContentEditable&&!paraOn){
        var s5=pres.slides[cur];
        autoCorrect(el,e,s5&&annotByIdx(s5,idx));
      }
    });
    el.addEventListener('blur',function(){
      clearTimeout(typeT);
      delete el.__jvFlush;
      delete el.__jvSoon;
      /* (an auto-list no longer replaces this node -- T623 sets the
         paragraph's marker in place -- so there is no stale blur to skip) */
      var w=readNow();
      setVal(w.v,w.r,w.ps);
      endEdit();
      /* An empty box is still an object the author placed. Keep it: its
         visible edit-state outline says where it is, and Delete remains the
         explicit way to remove it. */
      var s2=pres.slides[cur],a2=s2&&(s2.annots||[])[idx];
      /* MARKDOWN YOU JUST TYPED. Committing a text box writes into the
         element in place, so renderAnnots -- the only thing that turns
         source into markup -- never runs, and the box would sit there
         showing its own asterisks until something else happened to
         rebuild the layer. Exactly the shape of the maths gate below,
         and BEFORE it, because the fit pass at the end of this handler
         measures what is on screen and what is on screen is now the
         rendering. ONE ELEMENT, not the whole layer: `el` is the node
         that just lost focus and is still in the DOM, and re-rendering
         a whole layer from inside a blur is a bigger promise than this
         needs (T74). */
      if(a2&&a2.md&&String(a2.text||'').trim())
        el.innerHTML=notesHtml(figSubst(a2.text,a2));
      /* T623: WHAT YOU SEE IS WHAT WAS SAVED. The box is drawn again from
         the paragraphs it now holds -- a commit does not redraw, so
         anything the browser left on screen that the model does not
         keep (a <blockquote> its indent made, an empty last line) stayed
         there until the next render, and went at a slide change */
      else if(paraOn&&a2&&!a2.ph){
        /* ...unless it already is exactly what was stored, as it nearly
           always is: the redraw rebuilt every paragraph of a long list on
           every click away (2026-10-10 review). w.ps is what the commit
           stored, trimmed as it was stored. */
        if(!(w.ps&&paraSame(el,w.ps))){el.innerHTML='';parasDraw(el,getParas());}
      }
      /* MATHS YOU JUST TYPED. Committing a text box writes into the
         element in place — that is the whole point of the edit path,
         and it means renderAnnots (which carries the re-typeset gate)
         never runs. So maths typed into a box rendered as raw "$x$"
         until something else happened to rebuild the layer, which is a
         very strange thing to have to discover (2026-08-25, found in
         the browser while closing TASKS T16). */
      /* a title or subtitle is a string on the slide and not an
         annot, so a2 is undefined for it and this gate never fired —
         the maths you had just typed into a title stayed raw until
         something else rebuilt the layer (T53) */
      if((idx==='t'||idx==='s')
         ?hasMathsStr((idx==='t'?(s2&&s2.title):(s2&&s2.sub))||'')
         :hasMaths(a2)) typeset(layer);
      /* ...and the build pieces back ON, for the reason given on the
         focus handler above: nothing else is going to re-render this
         layer, so without this the bubbles and the split vanish the
         moment you click into a box and click out of it again. After
         the markdown fixup, which rewrites innerHTML, and before the
         fit pass, which measures what is finally there. */
      if(a2&&a2.k==='text'&&textBy(a2)&&!a2.arc)
        splitParts(el,textBy(a2));
      /* and re-fit, for the same reason: the words that just arrived are
         the ones the fit height is about (T15) */
      fitTexts(layer,s2,true);
      markDirty();
    });
    /* AUTO-BULLETS, ON ANY PARAGRAPH (2026-08-20, T591, T623). "- ", "* "
       or "• " typed at the start of a paragraph makes it a bullet, "1. "
       a number and "1) " a 1) 2) 3) -- the markdown habit everybody
       already has, and the reason nobody could find the List button
       until they had already given up (user: "need auto-dot points";
       "There is not auto-numbering like dot points being created
       automatically"). Only on a paragraph with no marker yet, never in a
       Markdown box (T74: "- " there is a bullet you MEANT, in the
       language of the box), and only for a marker TYPED, not one left
       behind by deleting the words after a literal "- " (2026-10-08
       review). The marker is deleted through the browser and the marker
       set as ONE step of the editor's undo, so the first Ctrl+Z puts back
       the "- " you typed, as AutoFormat's does -- it used to rebuild the
       whole box, which emptied the browser's undo, and "1) " made 1. 2. */
    function autoList(e){
      if(!e||e.inputType!=='insertText'||el.__jvOp) return;
      /* every marker ends in the space just typed: any other key costs
         nothing here */
      if(e.data!==' '&&e.data!=='\u00a0') return;
      var s4=pres.slides[cur],a4=s4&&annotByIdx(s4,idx);
      /* nor in code, whose "- " is code (2026-10-10 review) */
      if(!a4||a4.k!=='text'||a4.md||a4.font==='mono') return;
      var sel4=window.getSelection();
      if(!sel4||!sel4.rangeCount||!sel4.isCollapsed) return;
      var tn=sel4.focusNode,off4=sel4.focusOffset;
      if(!tn||tn.nodeType!==3||!el.contains(tn)) return;
      var p4=paraAt(el,tn,off4);
      if(!p4||p4.hasAttribute('data-list')) return;
      var r4=document.createRange();
      try{r4.setStart(p4,0);r4.setEnd(tn,off4);}catch(err){return;}
      var m4=/^([-*\u2022]|1[.)])[ \u00a0]$/.exec(r4.toString());
      /* the whole marker in the words the caret is in */
      if(!m4||off4<m4[0].length) return;
      var kind=m4[1]==='1.'?'number':m4[1]==='1)'?'paren':'bullet';
      edOp(el,function(){
        var s6=window.getSelection(),
            p6=s6.rangeCount?paraAt(el,s6.focusNode,s6.focusOffset):null;
        if(!p6) return;
        var at=paraAttrs(p6);paraListSet(at,kind);paraAttrsSet(p6,at);
      },function(){
        var r5=document.createRange();
        r5.setStart(tn,off4-m4[0].length);r5.setEnd(tn,off4);
        sel4.removeAllRanges();sel4.addRange(r5);
        document.execCommand('delete',false,null);
      });
      paraDecorate(el);
      commitNow(true);
      toast((kind==='bullet'?'Bullet list \u2014 Tab indents, Shift+Tab goes '
        +'back':'Numbered list \u2014 Tab indents')+'; Ctrl+Z gives back the '
        +'\u201c'+m4[1]+'\u201d you typed');
    }
    /* ...and what the browser's own steps did to the paragraphs: a <div>
       or bare words taken into a <p>, the numbers and the places worked
       out again. Not on a plain keystroke that changed no paragraph --
       typing a word costs nothing here. */
    /* the browser is about to act on a key: a step of the box's undo
       begins, or typing goes on in the one open (THE EDITOR'S OWN UNDO).
       Undo and Redo from the menu are the box's own as well. */
    el.addEventListener('beforeinput',function(e){
      if(!el.isContentEditable||!paraOn||el.__jvOp) return;
      var t=(e&&e.inputType)||'';
      if(t==='historyUndo'||t==='historyRedo'){
        e.preventDefault();
        edHistory(el,t==='historyUndo');
        return;
      }
      edBefore(el,t);
    });
    el.addEventListener('input',function(e){
      /* a command of ours writes its own step and draws it itself */
      if(!el.isContentEditable||!paraOn||el.__jvOp) return;
      var t=(e&&e.inputType)||'';
      if(t==='insertText'||t==='insertCompositionText'){
        /* never move the words an input method is still composing */
        if(e.isComposing){edAfter(el);return;}
        /* the first words in an empty box arrive bare: a paragraph first,
           so a marker typed there is the paragraph's */
        var f0=el.firstChild;
        if(el.childNodes.length!==el.__jvN||(f0&&f0.nodeName!=='P')){
          paraNormalize(el);paraDecorate(el);}
        edAfter(el);
        /* T545: AutoCorrect, as the last character of a rule lands -- a
           step of its own, so Ctrl+Z straight after puts back what you
           typed, as its toast says. Only for a key that can end a rule:
           a letter costs nothing here. */
        var ch5=String(e.data||'');ch5=ch5.charAt(ch5.length-1);
        if(ch5&&AC_LAST.indexOf(ch5)>=0){
          var s5=pres.slides[cur],a5=s5&&annotByIdx(s5,idx);
          edOp(el,function(){autoCorrect(el,e,a5);});
        }
        autoList(e);
        return;
      }
      paraNormalize(el);
      paraDecorate(el);
      edAfter(el);
    });
    el.addEventListener('compositionend',function(){
      if(!el.isContentEditable||!paraOn) return;
      var f1=el.firstChild;
      if(el.childNodes.length!==el.__jvN||(f1&&f1.nodeName!=='P')){
        paraNormalize(el);paraDecorate(el);}
    });
    /* THE PARAGRAPH KEYS (T623), PowerPoint's and Word's:
       * Tab and Shift+Tab move the paragraph(s) the caret or selection is
         in a level in or out -- a bullet or a plain paragraph alike, never
         the whole box, and never out of the box (Tab used to fall through
         to the browser, which moved the focus away and ended the edit).
         Mid-line in a plain paragraph Tab types a tab, as it does there.
         At the first level Shift+Tab does nothing: the bullet stays.
       * Backspace at the very start of a paragraph with a marker or a
         level takes a sub-bullet up a level, or the bullet off, and
         leaves the words on their line (T590: "IF the dot points there is
         no line before e.g. at the top, then dot points cannot be
         backspaced"); the next Backspace joins the lines.
       * Enter on an EMPTY bullet takes it up a level, or off -- how you
         leave a list.
       * Ctrl+Z / Ctrl+Y (and Ctrl+Shift+Z) are the box's own undo and
         redo, every step of it (edHistory, THE EDITOR'S OWN UNDO). */
    el.addEventListener('keydown',function(e){
      if(!el.isContentEditable) return;
      /* T481: Escape ends the edit -- a rung the ladder ("one
         deselects, two leave") had no answer for while the caret was
         in a box; a table cell already did this (2026-09-15 review) */
      if(e.key==='Escape'){
        e.preventDefault();e.stopPropagation();el.blur();return;}
      var mod=e.ctrlKey||e.metaKey;
      if(e.key==='Tab'&&!mod&&!e.altKey){
        e.preventDefault();e.stopPropagation();
        /* a title, a subtitle or a Markdown box has no levels: Tab types
           a tab there, as PowerPoint's title does, and Shift+Tab nothing
           -- neither leaves the box */
        if(!paraOn){
          if(!e.shiftKey){
            try{document.execCommand('insertText',false,'\t');}catch(err){}
          }
          return;
        }
        var ps=paraTouched(el),s7=window.getSelection();
        if(!ps.length) return;
        /* CODE IS INDENTED BY ITS OWN CHARACTERS (2026-10-10 review): in
           a code box Tab puts a tab at the caret, or at the start of each
           line a selection touches, and Shift+Tab takes one off (or up
           to four spaces) -- so the code, a copy of it and the export
           carry the indent. A level is a paragraph's, and code has none. */
        var s9=pres.slides[cur],a9=s9&&annotByIdx(s9,idx);
        if(a9&&a9.font==='mono'){
          if(!e.shiftKey&&s7.isCollapsed)
            edOp(el,function(){
              document.execCommand('insertText',false,'\t');});
          else edOp(el,function(){
            ps.forEach(function(q){codeIndent(q,e.shiftKey);});});
          if(el.__jvSoon) el.__jvSoon();
          return;
        }
        if(!e.shiftKey&&ps.length===1&&s7.isCollapsed
           &&!ps[0].hasAttribute('data-list')
           &&!paraAtStart(ps[0],s7.focusNode,s7.focusOffset)){
          edOp(el,function(){
            document.execCommand('insertText',false,'\t');});
          if(el.__jvSoon) el.__jvSoon();
          return;
        }
        paraEdit(el,ps,function(p){paraLevel(p,e.shiftKey?-1:1);});
        return;
      }
      if(paraOn){
        if(mod&&!e.altKey&&(e.key==='z'||e.key==='Z'||e.key==='y'||e.key==='Y')){
          /* the box's own undo, always: the browser's knows only some of
             its steps (THE EDITOR'S OWN UNDO) */
          e.preventDefault();e.stopPropagation();
          edHistory(el,(e.key==='z'||e.key==='Z')&&!e.shiftKey);
          return;
        }
        var s8=window.getSelection();
        var p8=(s8&&s8.rangeCount&&s8.isCollapsed)
          ?paraAt(el,s8.focusNode,s8.focusOffset):null;
        if(p8&&e.key==='Backspace'&&!e.shiftKey&&!mod&&!e.altKey
           &&(p8.hasAttribute('data-list')||p8.hasAttribute('data-lvl'))
           &&paraAtStart(p8,s8.focusNode,s8.focusOffset)){
          e.preventDefault();e.stopPropagation();
          paraEdit(el,[p8],function(p){
            if(p.list&&!p.lvl) paraListSet(p,''); else paraLevel(p,-1);
          });
          return;
        }
        if(p8&&e.key==='Enter'&&!e.shiftKey&&!mod&&!e.altKey
           &&p8.hasAttribute('data-list')&&paraEmpty(p8)){
          e.preventDefault();e.stopPropagation();
          paraEdit(el,[p8],function(p){
            if(p.lvl) paraLevel(p,-1); else paraListSet(p,'');
          });
          return;
        }
      }
      /* T534: TWO KINDS OF KEY ARE THE DECK'S EVEN WHILE TYPING. Ctrl+S
         is the save: stopped here, it never reached the deck's handler
         -- whose comment says it flushes and saves from inside a box --
         so the browser's own "Save page as" opened over the editor
         (driven 2026-09-29: the keydown came back not prevented). And
         the PowerPoint text keys (Ctrl+L/E/R align, Ctrl+Shift+> / <
         size) act on the box being typed in. */
      if((e.ctrlKey||e.metaKey)&&!e.altKey&&(e.key==='s'||e.key==='S')) return;
      if(pptTextKey(e)){e.preventDefault();e.stopPropagation();return;}
      /* while typing, the deck's own single-letter shortcuts (R, G, …)
         must not fire — they would arm a tool mid-sentence */
      e.stopPropagation();
    });
    /* PASTE CODE, GET CODE (T92). Slack's trick with one rule that keeps
       it safe: ONLY INTO AN EMPTY BOX. Converting a box you are halfway
       through writing would rewrite its font, background and width under
       your caret -- and a monospace RUN inside a prose box is not merely
       unbuilt but impossible, because sanitizeRich keeps colour and
       nothing else, so an inline mono span would lose its font at the
       next blur and leave coloured prose behind. A paste into a box with
       words in it falls through to the browser's plain paste, as before.
       Ctrl+Shift+V says "plain, please". Armed on keydown for a beat
       rather than read off the paste event, which carries no modifiers
       -- the shape tookPaste uses in 30-format-bar.js. Inside a text box
       that chord is free: the keydown handler above stops it reaching
       the canvas's paste-in-place. */
    var codePlain=0;
    el.addEventListener('keydown',function(e){
      if((e.ctrlKey||e.metaKey)&&e.shiftKey
         &&(e.key==='v'||e.key==='V')){
        codePlain=1;
        setTimeout(function(){codePlain=0;},300);
      }
    });
    /* T274: WATCH THE WORDS LEAVE. A caret copy inside a box never
       reaches copySel -- the deck keydown returns early on a
       contenteditable target -- so the object buffer never learns this
       box exists and the next canvas paste built an untyped one. Record
       the box here, where we still know which it is (`idx` is this
       editor's own), and pasteTextBox puts it back if the words on the
       clipboard are still these. Cleared when the selection is empty,
       so a copy of nothing cannot leave a stale type behind. */
    function rememberTextCopy(txt){
      var s7=pres.slides[cur],a7=s7&&annotByIdx(s7,idx);
      var sl=String((typeof txt==='string')?txt
        :((window.getSelection&&window.getSelection().toString())||''))
        .replace(/\r/g,'').trim();
      lastTextCopy=(a7&&a7.k==='text'&&sl)?{txt:sl,a:deep(a7)}:null;
    }
    /* T623 review (2026-10-10): A COPY IS ONE LINE A PARAGRAPH. The browser
       writes the plain text of <p>s with a blank line between every two
       (innerText's rule for <p>), so three lines copied out of a box
       pasted as five -- into notes, into another app, as a new box on the
       canvas. The plain text is written here from the paragraphs, a line
       each (a Shift+Enter break a line too), and the markup with them:
       each paragraph as the slide draws it, its level and marker on it,
       which a paste back into a box keeps (pasteParas). */
    function copyParas(e,cut){
      if(!paraOn||!el.isContentEditable||!e.clipboardData) return null;
      var sel=window.getSelection();
      if(!sel||!sel.rangeCount||sel.isCollapsed) return null;
      var r=sel.getRangeAt(0);
      if(!el.contains(r.startContainer)||!el.contains(r.endContainer)) return null;
      var box=document.createElement('div');
      box.appendChild(r.cloneContents());
      var ps=parasParse(sanitizeRich(box.innerHTML).html,null);
      /* a selection that ends at the very start of a paragraph does not
         take it (paraTouched's rule) */
      if(ps.length>1&&!paraPlain(ps[ps.length-1].h)) ps.pop();
      if(!ps.length) return null;
      var txt=parasText(ps).replace(/\u200b/g,'');
      var host=document.createElement('div');
      parasDraw(host,ps);
      [].forEach.call(host.children,function(q){
        if(q.hasAttribute('data-list')) q.style.display='list-item';});
      try{
        e.clipboardData.setData('text/plain',txt);
        e.clipboardData.setData('text/html',host.innerHTML);
      }catch(err){return null;}
      e.preventDefault();
      if(cut){
        edOp(el,function(){
          document.execCommand('delete',false,null);paraNormalize(el);});
        paraDecorate(el);
        if(el.__jvSoon) el.__jvSoon();
      }
      return txt;
    }
    el.addEventListener('copy',function(e){
      rememberTextCopy(copyParas(e,false));});
    el.addEventListener('cut',function(e){
      rememberTextCopy(copyParas(e,true));});
    /* T623: SEVERAL PARAGRAPHS PASTED ARE SEVERAL PARAGRAPHS. Left to the
       browser, lines pasted as plain text stayed "\n"s inside the
       paragraph the caret was in -- three pasted lines under one bullet,
       and in the .pptx two of them unbulleted at the margin. As in
       PowerPoint and Word, each line is a paragraph of its own and takes
       the caret paragraph's level and marker; a pasted list keeps its
       own. Its colours are the page's, not the source's (PowerPoint's
       "use destination theme"): a copy from this editor carries the
       white the words were drawn in. One step of the editor's undo. */
    function pasteParas(cd,plainOnly,e){
      var html='',txt='',ps=null;
      try{txt=String(cd.getData('text/plain')||'').replace(/\r\n?/g,'\n');}
      catch(err){}
      if(!plainOnly){try{html=cd.getData('text/html')||'';}catch(err){}}
      if(html&&/<(p|div|li|br|h[1-6]|tr|pre)\b/i.test(html))
        ps=parasParse(pasteClean(html),null);
      if((!ps||ps.length<2)&&txt.indexOf('\n')>=0)
        ps=txt.replace(/\n+$/,'').split('\n').map(function(l){
          return paraNew({},esc(l));});
      if(!ps||ps.length<2) return false;
      e.preventDefault();e.stopPropagation();
      paraPaste(el,ps);
      return true;
    }
    el.addEventListener('paste',function(e){
      if(!el.isContentEditable) return;
      var cd=e.clipboardData;
      /* plain, please: the browser's own plain paste, and nobody else's
         -- the document's handler would have made a copied figure's
         words a figure (2026-10-08 review) -- its lines still lines */
      if(codePlain){
        codePlain=0;e.stopPropagation();
        if(paraOn&&cd) pasteParas(cd,true,e);
        return;
      }
      if(!cd) return;
      /* T612: a notebook figure this page has is the slide's, not this
         box's (the document's paste puts it there); one it does not
         have is words like any others */
      var cc5=cellClipOf(cd);
      if(cc5&&cellRefHere(cc5)) return;
      var txt='';
      try{txt=cd.getData('text/plain')||'';}catch(err){return;}
      var s5=pres.slides[cur],a5=s5&&annotByIdx(s5,idx);
      /* a title, a subtitle and a bullet list all reach editableText and
         none of them is a thing to turn into a code block */
      /* ...and not a markdown box: a fenced paste is markdown's OWN
         code block, and codeBoxify would answer it by repainting the
         box mono-on-navy and writing an a.html the renderer then
         ignores -- a state with no way back out (T74) */
      var code5=!!txt&&!!a5&&a5.k==='text'&&!a5.md&&!boxHasList(a5)
        &&!paraEls(el).some(function(q){return q.hasAttribute('data-list');})
        &&!String(el.innerText||'').trim()&&looksLikeCode(txt);
      var f5=code5?codeFence(txt):null;
      var src5=code5?(f5?f5.src:txt).replace(/\r/g,'').replace(/\s+$/,''):'';
      if(!src5){
        if(paraOn) pasteParas(cd,false,e);
        return;
      }
      e.preventDefault();e.stopPropagation();
      codeBoxify(a5,src5);
      /* the model is already right, so DO NOT go through commitNow: it
         would read the words back out of innerText and give whitespace
         one more chance to be normalised. Re-render instead, which ends
         the edit -- correct, the box is finished. Removing a focused
         node fires no blur in Chrome or Firefox, so nothing races this.
         markDirty is loud on purpose: the toast promises an undo and
         histPush is what makes that true. */
      markDirty();
      var l5=stage.querySelector('.annot-layer');
      if(l5){renderAnnots(l5,s5);selectAnnot(l5,idx);}
      toast('Pasted as code — Ctrl+Z undoes it, or '
        +'Ctrl+Shift+V pastes it as plain text');
    });
    el.addEventListener('mousedown',function(e){
      if(tool!=='select') return;   /* placing mode: draw over me */
      /* the span owns the mouse only while TYPING (caret placement).
         Otherwise the event must bubble to the layer handler — the only
         place startMove is armed. Stopping it unconditionally was why a
         text box showed a move cursor but could only ever be selected,
         never dragged (2026-08-20 diagnosis, verified live: body-drags
         moved 0.00% before, moved normally once bubbling). It also ate
         shift-multi-select on text boxes. */
      if(el.isContentEditable) e.stopPropagation();
    });
  }
  /* a figure frame hugs its plot: the frame ELEMENT is sized to the
     image's contained fit inside the stored rect, so the selection outline
     + resize handle sit exactly on the plot with no letterbox gap. The
     stored rect is left alone at render time (a slide renders at several
     scales — stage, film thumbnails, vpage — and mutating the model from
     whichever layer happens to render would compound); only an explicit
     resize gesture normalises it (startResize). */
  function figFit(layer,a,img){
    if(!img||!img.naturalWidth||!img.naturalHeight) return null;
    var lw=layer.clientWidth,lh=layer.clientHeight;
    if(!lw||!lh) return null;
    var aw=a.w||34,ah=a.h||30,ap=anchorPos(a,aw,ah);
    var fw=lw*aw/100,fh=lh*ah/100;
    var r=img.naturalWidth/img.naturalHeight;
    var w2=Math.min(fw,fh*r),h2=w2/r;
    return {x:ap.x+(fw-w2)/2/lw*100,
            y:ap.y+(fh-h2)/2/lh*100,
            w:w2/lw*100,h:h2/lh*100,ratio:r};
  }
  function figImg(c){
    if(c.querySelector('.figpager')) return null;   /* pager: several plots */
    var imgs=$$('.figframe img',c);
    return imgs.length===1?imgs[0]:null;   /* plotly/html figs: no fit */
  }
  function fitFigFrame(layer,a,c){
    var img=figImg(c); if(!img) return;
    var tries=0;
    function go(){
      /* the slide renders detached (no layout yet) and a freshly cloned
         <img> can lack its natural size — retry over a few frames until
         both have real dimensions; a replaced render just stops */
      var f=c.isConnected?figFit(layer,a,img):null;
      if(!f){if(tries++<8) requestAnimationFrame(go);return;}
      var moved=(c.style.left!==f.x+'%'||c.style.top!==f.y+'%'
        ||c.style.width!==f.w+'%'||c.style.height!==f.h+'%');
      c.style.left=f.x+'%';c.style.top=f.y+'%';
      c.style.width=f.w+'%';c.style.height=f.h+'%';
      /* the frame has just MOVED, and any arrow attached to it was routed
         to where it used to be — annotRectPct measures the rendered
         element for an aspect-fitted figure, and this fit lands a frame
         or two after the arrows were drawn. Nothing told them, so an
         attached arrow ended up off its figure, worst on the first render
         of a slide in playback where nothing re-renders afterwards
         (2026-08-20, user: "arrows and lines when going to present do not
         stay in the same place"). Arrows only — redrawing the figures
         from here would fit them again and never settle. */
      if(moved) scheduleArrowRedraw(layer);
    }
    if(!img.naturalWidth){
      img.addEventListener('load',go,{once:true});
      if(img.decode) img.decode().then(go).catch(function(){});
    }
    go();
  }
  var dpiT=null;
  /* ONE arrow, drawn. Lifted out of the render loop so it can run in a
     SECOND pass, after every other item is in the DOM — see the two-pass
     comment in renderAnnots — and so a figure that finishes fitting later
     can ask for the arrows alone to be redrawn (redrawArrows). */
  function drawArrow(layer,s,a,i,svg,svgTop,defs,editing){
    var col=tokVal(a.color)||'#ff6b57';
    /* inside a render, measured up front with the rest (paintAnnots) */
    var pre=layer._hPass&&layer._hPass.arrows;
    var ends=(pre&&pre.ends[i])||arrowEnds(layer,s,a,i);
    var hs=headSize(a),sw=a.sw||3,swPx=strokePx(a,layer);
    /* a head is scaled by the LINE's width as well as its own size
       setting, so a fat arrow does not end in a pinhead.
       This reads the STORED weight, never the resolved pixels:
       markerUnits defaults to strokeWidth, so the head already grows
       with the page for free. Clamping on pixels instead would make
       the head-to-line ratio change with the zoom. */
    var mw=hs.mul*Math.max(0.55,Math.min(2.2,sw/3));
    function mkHead(which,type){
      var h=HEAD_BY[type];
      if(!h||type==='none'||!h.path) return '';
      var id='an-h'+which+'-'+i;
      var mk=document.createElementNS(AN_NS,'marker');
      mk.setAttribute('id',id);
      mk.setAttribute('viewBox','0 0 10 10');
      mk.setAttribute('refX',h.open?'9':'8');
      mk.setAttribute('refY','5');
      mk.setAttribute('markerWidth',mw);
      mk.setAttribute('markerHeight',mw);
      /* auto-start-reverse points a START marker back down the line,
         so one path definition serves both ends */
      mk.setAttribute('orient','auto-start-reverse');
      var mp=document.createElementNS(AN_NS,'path');
      mp.setAttribute('d',h.path);
      if(h.open){
        mp.setAttribute('fill','none');
        mp.setAttribute('stroke',col);
        mp.setAttribute('stroke-width','1.8');
        mp.setAttribute('stroke-linecap','round');
      } else mp.setAttribute('fill',col);
      mk.appendChild(mp);defs.appendChild(mk);
      return 'url(#'+id+')';
    }
    var mEnd=mkHead('e',headEnd(a)),mStart=mkHead('s',headStart(a));
    var lrA=(pre&&pre.lr)||layer.getBoundingClientRect();
    var d=arrowPath(ends,a,lrA.width,lrA.height);
    var ln=document.createElementNS(AN_NS,'path');
    ln.setAttribute('d',d);
    ln.setAttribute('class','an-arrow-line'+(selAnnot===i?' sel':''));
    ln.setAttribute('data-idx',i);
    ln.setAttribute('stroke',col);
    ln.setAttribute('fill','none');
    ln.setAttribute('stroke-width',swPx);
    ln.setAttribute('stroke-linecap',
      lineStyle(a)==='dot'?'round':'butt');
    ln.setAttribute('stroke-linejoin','round');
    var dsh=dashPx(a,layer);
    if(dsh) ln.setAttribute('stroke-dasharray',dsh);
    if(a.op!=null&&a.op<1) ln.style.opacity=a.op;
    if(mEnd) ln.setAttribute('marker-end',mEnd);
    if(mStart) ln.setAttribute('marker-start',mStart);
    svgTop.appendChild(ln);
    var hit=document.createElementNS(AN_NS,'path');
    hit.setAttribute('d',d);
    hit.setAttribute('fill','none');
    /* the grab path is CHROME, so its 16px stays screen-measured and
       does not scale with the page — otherwise a zoomed-out poster
       would leave a 2px target. But the ink can now be wider than 16px
       on a big page, so take whichever is larger. */
    hit.setAttribute('stroke-width',Math.max(16,swPx+10));
    hit.setAttribute('class','an-arrow-hit an-item');
    hit.setAttribute('data-idx',i);
    /* T585: WHILE EDITING, THE GRAB PATH IS ON TOP WITH THE INK. Under
       the items it kept frames clickable -- and made an arrow drawn over
       a picture unclickable, because the picture took every click on it
       (2026-09-30, user: "I cannot click on it with the map in the
       background"). The ink is always on top, so the thing you can see
       is the thing you get; a frame under it stays clickable everywhere
       but the arrow's own band. svgTop is pointer-events:none, and only
       this path (an .an-item) takes clicks inside it. Presenting keeps
       it underneath, so tapping a picture to zoom still reaches it. */
    (editing?svgTop:svg).appendChild(hit);
    if(editing&&!pinned(a)){  /* a pinned arrow gets no live endpoints */
      /* a handle per corner, plus a faint one halfway along each segment
         that ADDS a corner there - the gesture every vector editor uses,
         so nobody has to be told it exists (2026-08-20) */
      arrowMids(a).forEach(function(m,mi){
        var h=document.createElement('span');
        h.className='an-endpt an-mid'+(selAnnot===i?' sel':'');
        h.style.left=m[0]+'%';h.style.top=m[1]+'%';
        h.setAttribute('data-idx',i);
        h.setAttribute('data-mid',mi);
        h.title='Drag to shape the line. Alt+click or right-click to '
          +'take this corner out again';
        layer.appendChild(h);
      });
      if(selAnnot===i){
        var pts0=[[ends.x1,ends.y1]].concat(
          arrowMids(a).map(function(m){return [m[0],m[1]];}),
          [[ends.x2,ends.y2]]);
        for(var sgi=0;sgi<pts0.length-1;sgi++){
          var ad=document.createElement('span');
          ad.className='an-endpt an-addpt';
          ad.style.left=((pts0[sgi][0]+pts0[sgi+1][0])/2)+'%';
          ad.style.top=((pts0[sgi][1]+pts0[sgi+1][1])/2)+'%';
          ad.setAttribute('data-idx',i);
          ad.setAttribute('data-addat',sgi);
          ad.title='Drag to bend the line here';
          layer.appendChild(ad);
        }
      }
      ['1','2'].forEach(function(which){
        /* an endpoint PINNED to an item is not free to drag: it
           reports the attachment instead, and moves when that item
           moves */
        var tied=(which==='1'?a.c1:a.c2);
        var ep=document.createElement('span');
        ep.className='an-endpt an-endpt-'+which
          +(tied?' tied':'')+(selAnnot===i?' sel':'');
        ep.style.left=(which==='1'?ends.x1:ends.x2)+'%';
        ep.style.top=(which==='1'?ends.y1:ends.y2)+'%';
        ep.setAttribute('data-idx',i);
        ep.setAttribute('data-ep',which);
        ep.title=tied
          ?'Attached — it follows that item. Drag to re-aim, or drop '
            +'on empty page to detach'
          :'Drag to redirect the arrow. Drop it on an item to attach, '
            +'and it will follow that item from then on';
        layer.appendChild(ep);
      });
    }
  }
  /* One private marking pass for both ordinary HTML items and the visible
     SVG stroke an arrow/line owns. Kept as a verb because fitted figures
     redraw their attached arrows after the main render pass (T49). */
  function markPrivateItems(layer,s){
    if(!privShown()) return;
    $$('.an-item[data-idx],.an-arrow-line[data-idx]',layer)
      .forEach(function(el){
        var a=(s.annots||[])[+el.getAttribute('data-idx')];
        if(a&&a.priv) el.classList.add('an-priv');
      });
  }
  /* Redraw JUST the arrows against the layer as it stands now. A figure
     frame settles into its aspect-fitted box asynchronously (fitFigFrame
     retries until the <img> reports a natural size), so an arrow attached
     to one was routed to the pre-fit rect and then never told the figure
     had moved — the arrow ended up somewhere else, most visibly on the
     first render of a slide in playback (2026-08-20, user: "arrows and
     lines when going to present do not stay in the same place"). */
  /* `live`: a drag or a held arrow key is moving things RIGHT NOW. The
     selection cannot change mid-gesture, so the arrows' own selection
     marks are put on the strokes just drawn (paintSelArrows) instead of
     a whole paintSel -- a class walk over every item and a measure of
     the selected one, on every mousemove. */
  function redrawArrows(layer,s,live){
    if(!layer||!layer.isConnected||!s) return;
    var svg=layer.querySelector('svg:not(.an-svgtop)');
    var svgTop=layer.querySelector('svg.an-svgtop');
    if(!svg||!svgTop) return;
    var defs=svgTop.querySelector('defs');
    if(!defs){defs=document.createElementNS(AN_NS,'defs');
      svgTop.insertBefore(defs,svgTop.firstChild);}
    $$('.an-arrow-line,.an-endpt',layer).forEach(function(n){n.remove();});
    $$('.an-arrow-hit',layer).forEach(function(n){n.remove();});   /* T585: either svg */
    $$('marker',defs).forEach(function(n){n.remove();});
    var editing=(mode==='edit');
    var draw=[];
    (s.annots||[]).forEach(function(a,i){
      if(!a||a.k!=='arrow') return;
      if(a.hide) return;                     /* T404: hidden is hidden */
      if(a.priv&&!privShown()) return;      /* T31 */
      draw.push(i);
    });
    /* EVERY END MEASURED BEFORE ANY ARROW IS DRAWN, and the page's height
       with them -- paintAnnots' rule, for the same reason: each arrow
       drawn put paths and handles into the layer, so the next one's
       measure (its ends, its stroke's share of the page) laid the page
       out again. Per arrow, per mousemove, during every drag on a slide
       with a diagram on it (2026-10-09, speed, editor #6). Nothing an
       arrow draws moves an item, so the boxes measured first are the
       boxes the old order found. */
    var own=!layer._hPass,pass=own?{h:0}:layer._hPass,outer=pass.arrows;
    if(own) layer._hPass=pass;
    try{
      if(draw.length){
        var pre={ends:{},lr:null};
        draw.forEach(function(i){
          pre.ends[i]=arrowEnds(layer,s,s.annots[i],i);});
        pre.lr=layer.getBoundingClientRect();
        layerH(layer);
        pass.arrows=pre;
      }
      draw.forEach(function(i){
        drawArrow(layer,s,s.annots[i],i,svg,svgTop,defs,editing);
      });
    } finally {
      pass.arrows=outer;
      if(own) layer._hPass=undefined;
    }
    markPrivateItems(layer,s);
    if(editing){
      if(live) paintSelArrows(layer);
      else paintSel(layer);
    }
  }
  /* several figures on a slide all settle within a frame or two of each
     other, so coalesce their redraw requests into one */
  var arrowRedrawT=null;
  function scheduleArrowRedraw(layer){
    /* T622: a layer that is a PICTURE of another slide (the scroll
       view's) redraws its own slide's arrows, the way the show draws
       them, on a timer of its own. Through the shared one below it drew
       `cur`'s arrows into the picture, and cancelled the live page's
       pending redraw on the way. */
    if(layer&&layer.closest&&layer.closest('.sv-pic')){
      if(typeof svArrowsSoon==='function') svArrowsSoon(layer);
      return;
    }
    clearTimeout(arrowRedrawT);
    arrowRedrawT=setTimeout(function(){
      var s=pres&&pres.slides&&pres.slides[cur];
      if(s&&layer&&layer.isConnected) redrawArrows(layer,s);
    },0);
  }
  /* ---- TABLES ---------------------------------------------------------
     a.rows is an array of arrays of plain strings; a.thead marks the first
     row as headings; a.grid draws the rules; a.sw and a.color are the same
     stroke currency every other item uses, so the lines scale with the
     page like everything else instead of being a fixed pixel hairline that
     vanishes on an A0 poster.
     Column widths are equal unless a.cols says otherwise (percentages that
     sum to 100), which is what the column-drag handles write. */
  function tableRows(a){
    var r=a&&a.rows;
    return (Array.isArray(r)&&r.length)?r:[['']];
  }
  function tableCols(a){
    var n=(tableRows(a)[0]||[]).length||1;
    var c=a&&a.cols;
    if(Array.isArray(c)&&c.length===n) return c;
    var out=[],i;
    for(i=0;i<n;i++) out.push(100/n);
    return out;
  }
  /* keep every row the same length: a ragged model would put the column
     handles and the exports out of step with what is on screen */
  function tableNormalise(a){
    var rows=tableRows(a),n=0,i,j;
    for(i=0;i<rows.length;i++) n=Math.max(n,rows[i].length);
    n=Math.max(1,n);
    for(i=0;i<rows.length;i++){
      for(j=rows[i].length;j<n;j++) rows[i][j]='';
      rows[i].length=n;
    }
    a.rows=rows;
    if(Array.isArray(a.cols)&&a.cols.length!==n) delete a.cols;
    return a;
  }
  function drawTable(layer,s,a,i,editing,place){
    tableNormalise(a);
    var rows=tableRows(a),cols=tableCols(a);
    var host=document.createElement('div');
    host.className='an-item an-table'+(selAnnot===i?' sel':'')
      +(a.grid===0?' nogrid':'')
      +(a.tstyle?' tst-'+a.tstyle:'');
    var ap0=anchorPos(a,a.w,a.h);
    host.style.left=ap0.x+'%';host.style.top=ap0.y+'%';
    host.style.width=(a.w||40)+'%';host.style.height=(a.h||20)+'%';
    host.style.fontSize='calc('+fontPx(layer,a.size||2.2)
      +' * var(--talk-text,1))';   /* T88 */
    if(a.lh) host.style.lineHeight=a.lh;
    if(a.color) host.style.color=tokVal(a.color);
    /* a.bg===0 is "no fill", and the format bar's swatch has always read
       it that way — but this renderer only ever looked at a.bgc, so
       setting a table to no fill left the colour on the page and the
       swatch and the slide disagreed (2026-08-22, found while giving the
       Apply dialog a Box background row that covers tables). */
    if(a.bg!==0&&a.bgc) host.style.background=tokVal(a.bgc);
    /* the rules are page-relative like every other stroke on the canvas */
    host.style.setProperty('--tbl-sw',strokePx(a,layer).toFixed(2)+'px');
    host.style.setProperty('--tbl-line',tokVal(a.line)||'currentColor');
    applyCommon(host,a);
    applyCrop(host,a);
    host.setAttribute('data-idx',i);
    var tbl=document.createElement('table');
    tbl.className='an-tbl';
    var cg=document.createElement('colgroup');
    cols.forEach(function(w){
      var c=document.createElement('col');
      c.style.width=w+'%';cg.appendChild(c);});
    tbl.appendChild(cg);
    /* T324: what each column HOLDS, and everything that follows from it
       -- the alignment, the decimals, the unit, the colour rule and the
       footer. Computed once per draw, never stored, so editing a cell
       moves all five and none of them can go stale. */
    var metas=tableColMeta(a);
    var ranges=metas.map(function(m,ci){
      return (tableRuleOf(a,ci)||{}).kind==='scale'
        ?tableColRange(a,ci,tableBodyFrom(a)):null;});
    var groups=tableGroups(a);
    /* T551: who draws each cell (a region's top-left draws it all), the
       look the table wears, and which cells are picked */
    var cover=tableCover(a),look=tableLook(a);
    var pick=(editing&&selAnnot===i)?tblPick(a):null;
    if(groups){
      var gtr=document.createElement('tr');
      gtr.className='an-tbl-head an-tbl-grouprow';
      groups.forEach(function(g){
        var gth=document.createElement('th');
        gth.colSpan=g.n;gth.textContent=g.text;
        if(!g.text) gth.className='an-tbl-gapgroup';
        if(look.hd){gth.style.background=look.hd;gth.style.color=look.hdInk;}
        gtr.appendChild(gth);
      });
      tbl.appendChild(gtr);
    }
    /* an even share each, as a HINT: a browser treats a row height as a
       minimum, so short rows sit on the grid the box was drawn to and a
       long one still grows rather than clipping its own words */
    var drawn=rows.length+(groups?1:0)+(tableHasCalc(a)?1:0);
    var rowPct=(100/Math.max(1,drawn)).toFixed(4)+'%';
    rows.forEach(function(row,ri){
      var tr=document.createElement('tr');
      tr.style.height=rowPct;
      if(a.thead&&ri===0) tr.className='an-tbl-head';
      row.forEach(function(val,ci){
        var cov=cover[ri]&&cover[ri][ci];
        if(cov&&cov.at) return;          /* drawn by its region's corner */
        var isHead=(a.thead&&ri===0);
        var td=document.createElement(isHead?'th':'td');
        if(cov){td.rowSpan=cov.rs;td.colSpan=cov.cs;}
        var m=metas[ci]||{};
        td.textContent=isHead?(val==null?'':String(val))
          :tableFmtCell(val,m);
        /* the box's own alignment still wins where it is set; a numeric
           column falls to the right, which with a shared number of
           decimals IS alignment on the point */
        if(a.align) td.style.textAlign=a.align;
        else if(!isHead&&m.align) td.style.textAlign=m.align;
        /* T551: a cell's own fill, else its column's colour rule, else
           the table's look; the look's words and weight likewise */
        var lk=tableCellLook(a,look,ri,ci,isHead);
        var own=tableFillAt(a,ri,ci);
        var fill=isHead?'':tableRuleFill(a,ci,val,ranges[ci]);
        if(own) td.style.background=tokVal(own);
        else if(fill) td.style.background=fill;
        else if(lk.bg) td.style.background=lk.bg;
        var oink=own?tableInkOver(a,own):'';
        if(oink||lk.ink) td.style.color=oink||lk.ink;
        if(lk.b) td.style.fontWeight='700';
        if(!isHead&&m.t==='num') td.classList.add('an-tbl-num');
        td.dataset.r=ri;td.dataset.c=ci;
        if(pick&&ri>=pick.r0&&ri<=pick.r1&&ci>=pick.c0&&ci<=pick.c1)
          td.classList.add('tc-sel');
        if(editing){
          /* T551: a click that does not move the table picks the cell;
             Shift+click stretches the pick to a rectangle */
          var down=null;
          td.addEventListener('mousedown',function(e){
            down={x:e.clientX,y:e.clientY};});
          td.addEventListener('click',function(e){
            if(!down||e.detail>1) return;
            if(Math.abs(e.clientX-down.x)>4||Math.abs(e.clientY-down.y)>4)
              return;
            if(td.isContentEditable) return;
            tblPickCell(i,ri,ci,!!e.shiftKey);
          });
          /* the WHOLE table drags from any cell; only a double-click puts
             a caret in one, the same contract text boxes keep */
          td.addEventListener('dblclick',function(e){
            e.stopPropagation();
            startTableEdit(layer,s,a,i,td,ri,ci);
          });
        }
        tr.appendChild(td);
      });
      tbl.appendChild(tr);
    });
    /* the footer, computed from the cells above it every time */
    var calc=tableCalcRow(a,metas);
    if(calc){
      var ctr=document.createElement('tr');
      ctr.className='an-tbl-calc';
      ctr.style.height=rowPct;
      calc.forEach(function(v,ci){
        var ctd=document.createElement('td');
        ctd.textContent=v;
        if(a.align) ctd.style.textAlign=a.align;
        else if((metas[ci]||{}).align) ctd.style.textAlign=metas[ci].align;
        ctr.appendChild(ctd);
      });
      tbl.appendChild(ctr);
    }
    host.appendChild(tbl);
    if(editing){
      host.appendChild(mkResize());
      host.appendChild(mkRotate());
      /* a grip per column boundary, so widths are dragged rather than
         typed into a dialog */
      if(selAnnot===i&&!lockedAll(a)){
        var acc=0;
        cols.forEach(function(w,ci){
          if(ci===cols.length-1) return;
          acc+=w;
          var g=document.createElement('span');
          g.className='an-tblgrip';
          g.style.left=acc+'%';
          g.title='Drag to resize this column';
          (function(at,pct){
            g.addEventListener('mousedown',function(ev){
              startColDrag(layer,s,a,i,at,ev);
            });
          })(ci,acc);
          host.appendChild(g);
        });
      }
    }
    if(place) place(host); else layer.appendChild(host);
  }
  /* type into ONE cell. contenteditable on the <td> itself, so the caret,
     selection and spellcheck all behave the way they do in a text box. */
  function startTableEdit(layer,s,a,idx,td,ri,ci){
    if(lockedAll(a)) return;
    /* T551: the cell being typed in is the picked cell, so Cell fill and
       Merge act on it without leaving the words */
    tblSel={s:s,i:idx,r0:ri,c0:ci,r1:ri,c1:ci};
    td.contentEditable='plaintext-only';
    liveEdOn(td);   /* the open editors (flushTextEdits) */
    td.spellcheck=true;
    td.focus();
    try{
      var r=document.createRange();r.selectNodeContents(td);
      var sel=window.getSelection();sel.removeAllRanges();sel.addRange(r);
    }catch(e){}
    function writeCell(){
      a.rows[ri][ci]=(td.innerText||'').replace(/\r/g,'')
        .replace(/\n+$/,'');
    }
    /* a table cell is a text edit too, and had the same blur-only commit.
       The flush commits words that changed since the last one, and only
       those -- the same reason as commitNow's (2026-10-09) */
    var cellWas=null;
    function flushCell(){
      var v=(td.innerText||'').replace(/\r/g,'').replace(/\n+$/,'');
      if(v===cellWas) return;
      cellWas=v;
      writeCell();markDirty(true);
    }
    td.__jvFlush=flushCell;
    var cellT=null;
    td.addEventListener('input',function(e){
      clearTimeout(cellT);
      cellT=setTimeout(flushCell,900);
      autoCorrect(td,e,a);      /* T545: a cell is typed in too */
    });
    function commit(){
      clearTimeout(cellT);
      delete td.__jvFlush;
      writeCell();
      td.contentEditable='false';
      liveEdOff(td);
      markDirty();
    }
    td.addEventListener('blur',commit,{once:true});
    td.addEventListener('keydown',function(e){
      /* T534: Ctrl+S saves from a cell too, as from a text box */
      if((e.ctrlKey||e.metaKey)&&!e.altKey&&(e.key==='s'||e.key==='S')) return;
      if(pptTextKey(e)){e.preventDefault();e.stopPropagation();return;}
      e.stopPropagation();
      /* Tab along, Enter down - the two moves that make a table usable
         without reaching for the mouse between every cell */
      var nr=ri,nc=ci;
      if(e.key==='Tab'){e.preventDefault();
        nc=ci+(e.shiftKey?-1:1);
        if(nc>=a.rows[ri].length){nc=0;nr=ri+1;}
        else if(nc<0){nc=a.rows[ri].length-1;nr=ri-1;}
        /* T469: Tab out of the last cell adds a row, as PowerPoint
           does, rather than ending the edit */
        if(nr>=a.rows.length&&!e.shiftKey){tableGrow(a,'row',1);}
      } else if(e.key==='Enter'){e.preventDefault();
        nr=ri+(e.shiftKey?-1:1);
      } else if(e.key==='Escape'){e.preventDefault();td.blur();return;}
      else return;
      commit();
      /* T551: past the cells a region covers, to the next one drawn --
         a region's corner is reached from its own row and column */
      var cv=tableCover(a),guard=0;
      while(nr>=0&&nr<a.rows.length&&nc>=0&&nc<a.rows[0].length
            &&cv[nr][nc]&&cv[nr][nc].at&&guard++<500){
        var anc=cv[nr][nc].at;
        if(e.key==='Tab'){
          /* jump to a corner only on the row being entered: a corner a
             row up (a vertical region's) is behind us, and going back
             to it looped Tab round it forever (2026-10-06 review) */
          if((anc[0]===ri&&anc[1]===ci)||anc[0]!==nr){
            nc+=e.shiftKey?-1:1;
            if(nc>=a.rows[nr].length){nc=0;nr++;}
            else if(nc<0){nc=a.rows[0].length-1;nr--;}
          } else {nr=anc[0];nc=anc[1];}
        } else {
          if(anc[0]===ri&&anc[1]===ci) nr+=e.shiftKey?-1:1;
          else {nr=anc[0];nc=anc[1];}
        }
      }
      if(nr<0||nr>=a.rows.length||nc<0||nc>=a.rows[0].length){
        td.blur();return;
      }
      renderAnnots(layer,s);selectAnnot(layer,idx);
      var nxt=layer.querySelector('.an-item[data-idx="'+idx+'"] '
        +'[data-r="'+nr+'"][data-c="'+nc+'"]');
      if(nxt) startTableEdit(layer,s,a,idx,nxt,nr,nc);
    });
  }
  /* drag a column boundary. Only the two columns either side of the grip
     change, so the table's own width never moves. */
  function startColDrag(layer,s,a,idx,at,ev0){
    ev0.preventDefault();ev0.stopPropagation();
    var cols=tableCols(a).slice();
    var lr=layer.getBoundingClientRect();
    var tw=(a.w||40)/100*lr.width;
    var x0=ev0.clientX,a0=cols[at],b0=cols[at+1];
    function mm(ev){
      var d=(ev.clientX-x0)/(tw||1)*100;
      d=Math.max(-(a0-6),Math.min(b0-6,d));
      cols[at]=a0+d;cols[at+1]=b0-d;
      a.cols=cols.slice();
      renderAnnots(layer,s);selectAnnot(layer,idx);
    }
    function mu(){
      document.removeEventListener('mousemove',mm);
      document.removeEventListener('mouseup',mu);
      markDirty();
    }
    document.addEventListener('mousemove',mm);
    document.addEventListener('mouseup',mu);
  }
  /* add / remove rows and columns, relative to nothing in particular -
     the ribbon buttons act on the END, which is what you want 90% of the
     time and needs no cell to be selected first */
  /* T551: through tblInsert / tblDelete, so merged regions, cell fills
     and the per-column lists move with the line that went; `at` is the
     line to add after or take away, the end when absent */
  function tableGrow(a,what,by,at){
    tableNormalise(a);
    var rows=a.rows,n=(rows[0]||[]).length;
    var len=what==='row'?rows.length:n;
    if(by>0) tblInsert(a,what,at==null?len:at+1);
    else tblDelete(a,what,at==null?len-1:at);
    if(what!=='row')
      delete a.cols;   /* equal widths again rather than a stale set */
    tableNormalise(a);
  }
  /* the fit pass itself. Called from renderAnnots and from the text
     commit -- see the note at its call site. */
  function fitTexts(layer,s,editing,kept){
    if(!layer||!s) return;
    /* no box keeps a height, nothing to fit -- and nothing to restyle:
       the class below re-styles every handle on the slide twice */
    if(!(s.annots||[]).some(function(a){
      return a&&a.k==='text'&&a.fh&&!a.hide;})) return;
    /* the selection's handles hang below a box (bottom:-7px, -16px on a
       small one) and scrollHeight counts them, so a selected box sized
       exactly to its fit line read as overflowing: flagged "does not
       fit", or its words shrunk, for words that fit (2026-10-08 review).
       They are out of the measure while it runs. */
    layer.classList.add('an-fitting');
    try{fitEach(layer,s,editing,kept);}
    finally{layer.classList.remove('an-fitting');}
  }
  function fitEach(layer,s,editing,kept){
      (s.annots||[]).forEach(function(a,i){
        if(!a||a.k!=='text'||!a.fh) return;
        if(a.hide) return;                   /* T404: hidden is hidden */
        var el=layer.querySelector('div.an-item[data-idx="'+i+'"]');
        if(!el||(kept&&kept.has(el))) return;
        var lr=layer.getBoundingClientRect();
        var want=a.fh/100*(lr.height||600);
        if(!(want>0)) return;
        el.style.removeProperty('--an-fit');
        el.classList.remove('an-overflowing');
        var got=el.scrollHeight||el.getBoundingClientRect().height||0;
        if(!(got>0)) return;
        if(a.fit==='shrink'&&got>want){
          /* ONE ratio, then one refinement. Line wrapping is not linear
             in font size — shrinking can pull a word up onto the line
             above and free a whole line — so a single division
             overshoots. Two passes lands within a line; a loop would
             cost a layout per step for a difference nobody can see. */
          var k=Math.max(FIT_MIN,want/got);
          el.style.setProperty('--an-fit',k.toFixed(3));
          var got2=el.scrollHeight||0;
          if(got2>want&&got2>0){
            k=Math.max(FIT_MIN,k*(want/got2));
            el.style.setProperty('--an-fit',k.toFixed(3));
          }
          /* it can still fail: FIT_MIN is a floor, because text shrunk
             past legibility is not a fit, it is a different problem
             being hidden */
          if((el.scrollHeight||0)>want+1&&editing)
            el.classList.add('an-overflowing');
        } else if(got>want+1&&editing){
          el.classList.add('an-overflowing');
        }
      });
  }
  /* ---- THINGS ONLY YOU CAN SEE ----------------------------------------
     (TASKS T31.) "On-slide annotations visible only in presenter view,
     never to the audience or in exports."

     ONE PREDICATE, AT THE ONE FUNNEL. renderAnnots already calls itself
     the funnel every slide render passes through, and it is right: the
     stage, the presenter view, the notes editor's preview and the PDF
     pages all arrive here. So "should this be drawn" is asked once, in
     the same breath as the `hide` flag it sits beside, rather than in
     each of the four callers — which is how three of them would agree
     and the fourth would leak.

     WHAT MAKES A RENDER PRIVATE. Editing is private by definition: you
     have to see the thing to write it, and it is marked so you know the
     audience will not. Everything else has to SAY it is private, and
     the default is therefore safe — a render path added next year shows
     nothing private unless it asks, rather than leaking until someone
     notices.

     WHAT THIS DOES NOT CLAIM. A private annotation is not drawn for the
     audience and never reaches a PDF or a .pptx. It IS stored in the
     deck, exactly as your speaker notes are, so a deck FILE you hand to
     somebody contains it. Pretending otherwise would mean dropping it
     from the save, and a private note that does not survive a reload is
     not a feature. The menu says which of the two it is. */
  var privCtx=false;
  function privShown(){return privCtx||mode==='edit';}
  /* WHAT A PICTURE SAYS IT SHOWS (T105).
     Every image the deck draws had alt="" hard-coded, which is the
     markup for "this carries no information, skip it" -- asserted, for
     every figure in the deck, including the ones carrying the science.
     This is the ONE load-bearing site: buildSlideNode and buildPrintRoot
     both funnel through renderAnnots, and exportDeckHtml serialises
     buildPrintRoot, so present mode, the presenter view, PDF and the
     standalone HTML all follow from here.

     Three states, and alt="" is only one of them. `a.dec` means the
     author said it is decorative, and alt="" is then correct and is
     paired with aria-hidden so nothing announces it at all. `a.alt` is
     what they wrote. Neither means we do not know, and the honest
     fallback is whatever the object is already called -- its name, its
     caption, its title -- because "unlabelled image" helps nobody. */
  function altAttrs(img,a,extra){
    if(a&&a.dec){
      img.alt='';
      img.setAttribute('aria-hidden','true');
      return;
    }
    var t=(a&&a.alt)||annotLabel(a)||'';
    if(extra&&t&&String(extra).trim()) t+=' \u2014 '+extra;
    else if(extra&&!t) t=String(extra);
    img.alt=t;
  }
  /* ---- T548: SHADOWS ---------------------------------------------------
     Four answers, PowerPoint's Shadow gallery cut to what gets used:
     none, soft (just off the page), hard (a flat offset copy, no blur)
     and lifted (a card held up). The numbers are px on a 720px-tall page
     (SW_REF_H), scaled like a stroke, so a shadow is the same share of
     the page in the editor, a thumbnail and full screen. What casts it
     depends on the thing: a box (a figure, a table, a book, a clip, a
     filled text box, a plain rectangle or ellipse) casts a box-shadow
     from the item, which its handles never share; a drawn shape and a
     picture cast one from their own ink (drop-shadow on the SVG or the
     picture, so a star's shadow is a star and a logo's follows its
     outline); a text box with no fill shadows its words, as PowerPoint
     does; and a cropped picture casts from the item, since a crop would
     clip a shadow drawn inside it. */
  var SHADOWS={soft:{x:0,y:3,b:10,a:0.45},hard:{x:4,y:4,b:0,a:0.55},
    lift:{x:0,y:9,b:20,a:0.42}};
  var SHADOWABLE={rect:1,image:1,cell:1,table:1,text:1,flip:1,video:1};
  /* T550: a picture's corrections as a CSS filter, '' for none */
  function pfxCss(a){
    var p=a&&a.pfx; if(!p) return '';
    var f=[];
    if(p.b) f.push('brightness('+(1+p.b/100).toFixed(2)+')');
    if(p.c) f.push('contrast('+(1+p.c/100).toFixed(2)+')');
    if(p.s!=null&&p.s!==100) f.push('saturate('+(p.s/100).toFixed(2)+')');
    if(p.g) f.push('grayscale(1)');
    return f.join(' ');
  }
  function picPaint(layer,s){
    if(!layer||!s) return;
    (s.annots||[]).forEach(function(a,i){
      if(!a||(a.k!=='image'&&a.k!=='flip'&&a.k!=='cell')) return;
      var el=layer.querySelector('div.an-item[data-idx="'+i+'"]');
      if(!el) return;
      var f=pfxCss(a);
      [].forEach.call(el.querySelectorAll('img'),function(im){
        im.style.filter=f;});
    });
  }
  function shadowCss(p,k,box){
    var f=function(v){return (v*k).toFixed(1)+'px';};
    var c='rgba(0,0,0,'+p.a+')';
    return box?(f(p.x)+' '+f(p.y)+' '+f(p.b)+' '+c)
      :('drop-shadow('+f(p.x)+' '+f(p.y)+' '+f(p.b/2)+' '+c+')');
  }
  function shadowPaint(layer,s){
    if(!layer||!s) return;
    var k=null;
    (s.annots||[]).forEach(function(a,i){
      if(!a||!SHADOWABLE[a.k]) return;
      var p=SHADOWS[a.shadow]; if(!p) return;
      var el=layer.querySelector('div.an-item[data-idx="'+i+'"]');
      if(!el) return;
      if(k===null) k=pageScale(layer);
      var kid=function(sel){
        return [].filter.call(el.children,function(c){
          return c.matches&&c.matches(sel);})[0]||null;};
      if(a.k==='rect'){
        var sv=kid('.an-shape-svg');
        if(sv) sv.style.filter=shadowCss(p,k,false);
        else el.style.boxShadow=shadowCss(p,k,true);
      } else if(a.k==='image'){
        var pic=a.crop?null:(kid('.an-imgwin')||kid('.an-imgel'));
        /* T550: a picture's own corrections ride with its shadow */
        var pf=(pic&&pic.classList.contains('an-imgel'))?pfxCss(a):'';
        (pic||el).style.filter=(pf?pf+' ':'')+shadowCss(p,k,false);
      } else if(a.k==='text'&&!(a.bg!==0&&a.bgc)){
        [].forEach.call(el.querySelectorAll('.an-tx'),function(t){
          t.style.filter=shadowCss(p,k,false);});
      } else el.style.boxShadow=shadowCss(p,k,true);
    });
  }
  /* T552: THE OTHER PICTURES. A placed picture and a flip book's page
     take their alt text as they are drawn (altAttrs, above); a figure
     placed from a notebook, a chart and a clip are drawn by code of
     their own, so what the author wrote is put on them here, after the
     layer is built. A notebook figure with nothing written keeps the
     notebook's own alt; the author's words, or "decorative", win. */
  function altPaint(layer,s){
    if(!layer||!s) return;
    (s.annots||[]).forEach(function(a,i){
      if(!a||!(a.alt||a.dec)) return;
      if(a.k!=='cell'&&a.k!=='chart'&&a.k!=='video') return;
      var el=layer.querySelector('div.an-item[data-idx="'+i+'"]');
      if(!el) return;
      if(a.k==='cell'){
        [].forEach.call(el.querySelectorAll('img'),function(im){
          altAttrs(im,a);});
        return;
      }
      var tgt=(a.k==='video')?(el.querySelector('video,audio')||el):el;
      if(a.dec){
        tgt.setAttribute('aria-hidden','true');
        tgt.removeAttribute('aria-label');
      } else {
        if(a.k==='chart') tgt.setAttribute('role','img');
        tgt.setAttribute('aria-label',String(a.alt));
        tgt.removeAttribute('aria-hidden');
      }
    });
  }
  /* Only animation edits and playback use this key. Content/geometry
     edits still take the normal render path, so large image payloads
     never need serialising just to advance a bullet. */
  function annotRenderKey(s,a,steps,plan){
    var st=a.anim?steps.map[a.anim.order||0]:null;
    var sp=st==null?null:plan.stop[st];
    if(sp==null) sp=st;
    var cursor=mode==='view'?revealCount:
      (typeof storyAt==='number'?storyAt:null);
    var pieces=[];
    if(st!=null&&(cursor!=null||mode==='edit')){
      var pst=pieceSteps(steps,a);   /* T577: a piece's own step */
      for(var j=0;j<pst.length;j++){
        var p=plan.stop[pst[j]];if(p==null) p=pst[j];
        /* Editor badges number actual clicks, even in Whole slide mode. */
        if(mode==='edit') pieces.push(p);
        pieces.push(cursor==null?null:(p<cursor?1:0));
        if(a.anim&&a.anim.hl) pieces.push(p===cursor-1?1:0);
      }
    }
    var out=animOut(a),focus=animFocus(a);
    var exitStep=out==null?null:steps.map[out];
    var focusStep=focus?steps.map[focus.at]:null;
    return JSON.stringify([a.anim||null,a.out,a.focus,a.motion,a.mo,a.fanim,
      st,sp,cursor==null?null:(sp==null||sp<cursor),pieces,
      exitStep,plan.stop[exitStep],focusStep,plan.stop[focusStep],
      animGoing(s,a),animGone(s,a),animFocusing(s,a),
      a.k==='flip'?flipAtNow(s,a):null,
      a.k==='chart'?chartSeriesShown(s,a):null,
      a.k==='text'?textAt(s,a):null,
      cursor==null?null:stepShows(s,a)]);
  }
  /* ONE MEASURE OF THE PAGE PER RENDER. Every text size and stroke
     weight on a layer is a share of the layer's height (fontPx,
     pageScale), and the render asked for that height item by item --
     each time just after placing the item before, so each ask made the
     browser style and lay out the page again: a forced layout per text
     box or figure, on every slide change and every edit (2026-10-08,
     user: "the slide changing and the clicking on things is super duper
     slow"). A layer is position:absolute;inset:0, so nothing placed in
     it can change its height: for the length of one render the first
     measure is kept on the layer (layerH) and the rest read it back. A
     render nested inside another keeps its own, and puts the outer one
     back. */
  function renderAnnots(layer,s,incremental){
    var was=layer._hPass;layer._hPass={h:0};
    layer._zoomStamp=null;   /* a render that throws leaves none */
    try{paintAnnots(layer,s,incremental);}
    finally{layer._hPass=was;}
    /* what applyZoom asks before re-rendering */
    if(typeof zoomStampMark==='function') zoomStampMark(layer,s);
  }
  function paintAnnots(layer,s,incremental){
    /* the one funnel every slide render passes through, which makes it
       the only place identity has to be minted — see WHAT HAS THIS
       OBJECT LOOKED LIKE. Idempotent, and it re-mints a duplicate, so
       no copy site has to remember to strip one. */
    ensureOids(s);
    /* T316: which slide '@section' resolves against. A master-synth
       slide is not in pres.slides and must not clobber the wearer's. */
    if(s&&(pres.slides||[]).indexOf(s)>=0) paintSlide=s;
    var editing=(mode==='edit');
    /* removing a focused node fires no blur in Chrome or Firefox, so
       without this every rebuild — a slide change, a notebook refresh,
       the async embedded-cards arrival — silently threw away whatever
       was being typed (2026-08-22) */
    flushTextEdits();
    var prior=incremental&&layer._paintSlide===s&&layer._paintMode===mode
      ?layer._paintItems:null;
    var kept=new Set(),nextItems={},changed=[],motionTimes=[];
    var keySteps=slideBuildSteps(s),keyPlan=flipPlan(s),paintKey='';
    if(!prior) layer.innerHTML='';
    else {
      /* Preserve the actual nodes: moving an iframe or animated element
         through a detached fragment would restart it as well. */
      Array.from(layer.children).forEach(function(el){
        if(el.tagName.toLowerCase()==='svg'||el.classList.contains('an-lens')
           ||el.classList.contains('an-endpt'))
          el.remove();
      });
      layer.removeAttribute('data-focus');layer.classList.remove('an-spotlit');
      $$('.an-spot',layer).forEach(function(el){el.classList.remove('an-spot');});
    }
    function placeAnnot(el){
      var idx=el.getAttribute('data-idx'),old=prior&&prior[idx];
      if(!prior){
        layer.appendChild(el);
      } else if(old&&old.el.parentNode===layer){
        var a=(s.annots||[])[+idx];
        if(a&&a.motion&&old.el.getAnimations){
          old.el.getAnimations().forEach(function(an){
            if(an.animationName==='an-'+a.motion)
              motionTimes.push({el:el,name:an.animationName,time:an.currentTime});
          });
        }
        layer.replaceChild(el,old.el);
      } else {
        var after=Array.from(layer.children).find(function(n){
          var k=n.getAttribute('data-idx');
          return k!=null&&isFinite(+k)&&+k>+idx;
        });
        layer.insertBefore(el,after||null);
      }
      nextItems[idx]={el:el,key:paintKey};changed.push(el);
    }
    /* every layer rebuild destroys the dpi chips — re-judge (debounced)
       once the edit settles, so resizing a figure ONTO a poster column
       actually raises the warning it exists for (2026-08-05 review) */
    if(editing&&pageOf().poster){
      clearTimeout(dpiT);
      dpiT=setTimeout(function(){
        var se=stage.querySelector('.slide');
        if(se&&mode==='edit') checkFigDpi(se);
      },300);
    }
    /* two svg layers: visible strokes ON TOP of everything (click-
       transparent) so arrows are never hidden behind frames, and the fat
       invisible hit-lines -- on top with them while editing (T585),
       UNDER the items while presenting, where frames take the taps */
    var svg=document.createElementNS(AN_NS,'svg');
    layer.insertBefore(svg,layer.firstChild);
    var svgTop=document.createElementNS(AN_NS,'svg');
    svgTop.setAttribute('class','an-svgtop');
    var defs=document.createElementNS(AN_NS,'defs');
    svgTop.appendChild(defs);

    if(s.layout==='title'){
      ['t','s'].forEach(function(which){
        if(prior&&prior[which]){
          nextItems[which]=prior[which];kept.add(prior[which].el);return;
        }
        var p=titleProps(s,which);
        var d=document.createElement('div');
        d.className='an-item an-title'+(which==='t'?' t-main':'')
          +(selAnnot===which?' sel':'');
        d.style.left=p.x+'%';d.style.top=p.y+'%';
        /* a title slide's title and subtitle are headings for the
           per-type control's purposes (T126) */
        d.style.fontSize='calc('+fontPx(layer,p.size)
          +' * var(--talk-text,1) * var(--talk-head,1))';   /* T88 */
        if(p.color) d.style.color=tokVal(p.color); /* default lives in CSS */
        if(p.b) d.style.fontWeight='700';
        /* ...and tell the SPAN too. Its own CSS weight is more specific
           than anything inherited from here, so the div's 700 never
           reached the words. Three states on purpose: untouched keeps
           the designed 600, on is 700, and off is a real 400 — which is
           what makes the toggle a toggle (T62). */
        if(p.b!==undefined)
          d.style.setProperty('--ttl-w',p.b?'700':'400');
        if(p.i) d.style.fontStyle='italic';
        var tdeco=(p.u?'underline ':'')+(p.strike?'line-through':'');
        if(tdeco.trim()) d.style.textDecoration=tdeco.trim();
        if(p.align) d.style.textAlign=p.align;
        if(p.font) d.style.fontFamily=fontCss(p.font);
        applyCommon(d,p,'translate(-50%,-50%)');
        d.setAttribute('data-idx',which);
        if(editing){
          d.appendChild(mkRotate());}
        var tx=document.createElement('span');tx.className='an-tx';
        var val=which==='t'?s.title:s.sub;
        tx.textContent=val
          ||(editing?(which==='t'?'Click to edit title':'subtitle'):'');
        if(editing){
          editableText(layer,tx,
            function(){return which==='t'?s.title:s.sub;},
            function(v){
              if(which==='t') s.title=v.trim();
              else s.sub=v.trim();
              renderFilm();renderControls();
            },which);
        }
        d.appendChild(tx);
        placeAnnot(d);
      });
    }

    /* TWO passes. An attached endpoint is DERIVED from where its target
       item is on the layer, and annotRectPct measures the rendered
       element for anything auto-sized (text) or aspect-fitted (a figure
       frame). An arrow drawn during the same pass as its target therefore
       measured an element that was not in the DOM yet whenever the target
       came LATER in the array, and silently fell back to its stored
       coordinates — so the arrow moved (2026-08-20, user: "arrows and
       lines when going to present do not stay in the same place").
       Deferring every arrow to a second pass makes attachment
       order-independent. It changes nothing about z-order: the visible
       strokes have always gone into svgTop, which is appended last. */
    /* anchored items are placed from measurement BEFORE the arrows go
       down, because an attached endpoint is derived from where its
       target sits — and again after fitTexts below, which can change a
       box's height. Both calls are cheap: they touch anchored items
       only, and a deck has none unless someone asked for them. */
    var _anchorFixWanted=(s.annots||[]).some(function(a){
      return a&&a.anch;});
    /* ONE walk of the deck per render, not one per text box: figNumbers
       walks every slide and a poster can hold thirty captions (T18) */
    var _figMap=null;
    var _arrows=[];
    (s.annots||[]).forEach(function(a,i){
      /* T404: HIDDEN IS HIDDEN. The Layers pane's eye used to mean
         "out of my way while editing, still shown to the audience", and
         nobody read it that way (2026-09-13, user: "Bug: hidden object
         still appear in present mode"). A hidden object is not on the
         slide: not while editing, not in playback, not in print or
         PowerPoint, and it claims no click (slideBuildSteps). */
      if(a.hide) return;
      /* ...and the other way round: yours, so NOT rendered in playback,
         print or PowerPoint (T31) */
      if(a.priv&&!privShown()) return;
      if(a.k==='arrow'){_arrows.push(i);return;}
      paintKey=annotRenderKey(s,a,keySteps,keyPlan);
      var old=prior&&prior[i];
      if(old&&old.key===paintKey&&old.el.parentNode===layer){
        nextItems[i]=old;kept.add(old.el);return;
      }
      if(a.k==='rect'){
        var shp=a.shape||'rect';
        /* T465: a shape with no colour of its own follows "Lines and
           edges" once that has been changed (the T455 bargain: the
           literal stays the default, the token answers when somebody
           picks one). A newborn shape still carries coral -- T458 is
           the open question of whether it should. */
        var col=tokVal(a.color)
          ||(tokens().c.line!==TOKENS_DEFAULT.c.line?tokVal('@line'):'#ff6b57');
        var r=document.createElement('div');
        var svgShape=!!(SHAPE_PATHS[shp]||SHAPE_GLYPH[shp]
          ||(typeof lineIcon==='function'&&lineIcon(shp)));   /* T560 */
        r.className='an-item an-rect'+(svgShape?' an-svgshape':'')
          +(selAnnot===i?' sel':'');
        var ap1=anchorPos(a,a.w,a.h);
        r.style.left=ap1.x+'%';r.style.top=ap1.y+'%';
        r.style.width=(a.w||10)+'%';r.style.height=(a.h||10)+'%';
        if(svgShape){
          r.appendChild(drawShapeSvg(shp,col,strokePx(a,layer),a,i,layer));
        } else {
          r.style.borderColor=col;
          r.style.borderWidth=strokePx(a,layer)+'px';
          var lsD=dashFor(a);
          r.style.borderStyle=lsD
            ?(lineStyle(a)==='dot'?'dotted':'dashed'):'solid';
          r.style.background=cssFill(a,col);
          if(shp==='ellipse') r.style.borderRadius='50%';
        }
        applyCommon(r,a);
        r.setAttribute('data-idx',i);
        if(editing){r.appendChild(mkResize());
          r.appendChild(mkRotate());}
        placeAnnot(r);
      } else if(a.k==='draw'){
        var dv=document.createElement('div');
        dv.className='an-item an-rect an-svgshape an-draw'
          +(selAnnot===i?' sel':'');
        var ap2=anchorPos(a,a.w,a.h);
        dv.style.left=ap2.x+'%';dv.style.top=ap2.y+'%';
        dv.style.width=(a.w||10)+'%';dv.style.height=(a.h||10)+'%';
        dv.appendChild(drawFreeSvg(a,layer));
        applyCommon(dv,a);
        dv.setAttribute('data-idx',i);
        if(editing){dv.appendChild(mkResize());dv.appendChild(mkRotate());}
        placeAnnot(dv);
      } else if(a.k==='cell'){
        var c=document.createElement('div');
        var it=a.ref?resolveRef(a.ref):null;
        var locked=!!(a.lockver&&a.lockver.commit);
        var lkCard=locked?verCardFor(a):null;
        c.className='an-item an-cell'+(a.autoNote?' an-auto-note':'')
          +((it||locked)?'':' empty')
          +(selAnnot===i?' sel':'');
        var ap3=anchorPos(a,a.w,a.h);
        c.style.left=ap3.x+'%';c.style.top=ap3.y+'%';
        c.style.width=(a.w||34)+'%';c.style.height=(a.h||30)+'%';
        applyCommon(c,a);
        c.setAttribute('data-idx',i);
        /* text INSIDE a cell is page-relative like everything else: the
           body renders at its natural size and is zoomed by
           a.ts x pageScale, so zooming the page cannot change a
           markdown table's size relative to the poster (2026-08-18,
           user: "make sure everything doesn't change size relative to
           poster or slide when zooming"). */
        var kz=pageScale(layer)||1;
        if(locked&&lkCard){
          /* pinned to a git commit: render THAT version's card — refresh
             never touches it, the notebook needn't even be open */
          c.title=(lkCard.title||'')+' @ '+a.lockver.commit;
          var vb=frameFromVerCard(lkCard,a.part);
          if(vb){
            vb.style.zoom=(a.ts||1)*kz;
            applyCrop(vb,a);
            if(a.crop) c.classList.add('an-cropped');
            c.appendChild(vb);
            if(!a.crop&&vb.querySelector(
                '.figframe,.figpager,.plotframe')){
              c.classList.add('an-figonly');
              fitFigFrame(layer,a,c);
            }
          }
          lockChip(c,a,true);
          applyCellColor(c,a);
        } else if(locked&&lkCard===undefined){
          var w8=document.createElement('div');w8.className='an-verwait';
          w8.innerHTML=bic('lock')+' '+esc(a.lockver.commit)
            +' — loading…';
          c.appendChild(w8);
        } else if(locked&&!it){
          var w9=document.createElement('div');w9.className='an-verwait';
          w9.innerHTML=bic('lock')+' '+esc(a.lockver.commit)
            +' — not available';
          c.appendChild(w9);
          lockChip(c,a,false);
        } else if(it){
          if(locked) lockChip(c,a,false);  /* lock set, live fallback */
          c.title=it.nb+' — '+it.title;
          var pt0=partOf(a),facs0=facetList(it.ns);
          /* a figure frame carries NO title header, even selected — a
             placed plot is JUST the plot (its name lives in the tooltip
             and the ribbon's Locate in notebook) */
          if(pt0!=='figure'){
            var ch=document.createElement('div');
            ch.className='an-cellhead';
            var chT=document.createElement('span');
            chT.className='an-cellhead-t';
            chT.textContent=it.title;
            ch.appendChild(chT);
            if(facs0.length>1||pt0==='code'){
              var pl=document.createElement('span');
              pl.className='an-cellpart';pl.textContent=pt0;
              ch.appendChild(pl);
            }
            if(multiNb()) ch.appendChild(nbChip('spane-nb',it.nb));
            ch.style.zoom=kz;
            c.appendChild(ch);
          }
          var fro=frozenFrames.get(a);
          var b=fro?framePartFromSnap(fro,a.part):framePart(it.ns,a.part);
          if(fro&&!b) b=framePart(it.ns,a.part);
          if(b){
            b.style.zoom=(a.ts||1)*kz;
            applyCrop(b,a);
            if(a.crop) c.classList.add('an-cropped');
            c.appendChild(b);
          }
          if(fro){
            c.classList.add('an-frozen');
            if(editing){
              var fz=document.createElement('span');
              fz.className='an-frozenchip';
              fz.innerHTML=bic('reset')+' previous';
              fz.title='This frame shows the figure from BEFORE the last '
                +'notebook refresh — select it and press “Live figure” '
                +'to catch up';
              c.appendChild(fz);
            }
          }
          if(pt0==='figure'&&!a.crop){
            c.classList.add('an-figonly');
            fitFigFrame(layer,a,c);
          }
          applyCellColor(c,a);
          if(it.emb&&editing){
            /* the notebook isn't open: the frame shows the copy saved
               inside the deck. Edit-time only, like the lock chip — an
               audience never needs to know. */
            var ez=document.createElement('span');
            ez.className='an-embchip';
            ez.textContent='saved copy';
            ez.title='This frame shows the copy saved with the deck — '
              +'its notebook is not open. Open the notebook to show the '
              +'live card again.';
            c.appendChild(ez);
          }
          /* No on-frame Replace / part-picker / caption: those controls now
             live in the top ribbon's Object group (cleaner), and a placed
             figure is JUST the figure — so the selection outline hugs the
             content instead of a caption-padded box. */
        } else if(editing){
          var pb=document.createElement('button');
          pb.className='an-cellpick';
          /* sized off the page like every other piece of text on it. Left
             at a fixed 11px it was the only thing that did not shrink when
             you zoomed out, so an empty frame's placeholder swelled to
             fill the poster (2026-08-07, user: text "changes size when I
             zoom in and out"). */
          /* T468: ...but never below a readable floor -- it drew at 6.9px
             on a fitted slide (2026-09-15 review) */
          pb.style.fontSize='max(10px,'+fontPx(layer,1.15)+')';
          pb.textContent=a.ref?('missing: '+a.ref)
            :'Click to choose what goes here';
          pb.addEventListener('mousedown',function(e){
            if(tool==='select') e.stopPropagation();});
          pb.addEventListener('click',function(e){
            if(tool!=='select') return;
            e.stopPropagation();
            /* a frame that has LOST its card wants that card back, so
               it goes straight to the picker; an empty one has not
               decided yet and is asked (T61). It used to say "click to
               add from notebook" and mean it: there was no gesture
               anywhere that put a picture inside a frame you had
               drawn. */
            if(a.ref){startPick(i);return;}
            openObjSrc(pb,i);});
          c.appendChild(pb);
        }
        if(editing){
          if(cropMode&&selAnnot===i) mkCropHandles(c,layer,s,i);
          else {c.appendChild(mkResize());c.appendChild(mkRotate());}
        }
        placeAnnot(c);
      } else if(a.k==='text'){
        if(!_figMap&&String(a.text||a.html||'').indexOf('{fig')>=0)
          _figMap=figNumbers();
        var d2=document.createElement('div');
        d2.className='an-item an-text'+(a.bg===0?' nobg':'')
          +(selAnnot===i?' sel':'')
          /* T480: a heading wears the deck's Heading text colour (the
             CSS reads --tk-heading off the class; only .an-title did,
             so Deck colours' Heading text governed nothing a text box
             wore -- 2026-09-15 review) */
          +((a.style&&typeof isHeadingStyle==='function'
             &&isHeadingStyle(a.style))?' an-head':'');
        var ap4=anchorPos(a,a.w,a.h);
        d2.style.left=ap4.x+'%';d2.style.top=ap4.y+'%';
        /* T542: WHERE THE WORDS SIT, in a box that keeps a height (the
           fit line, a.fh): the middle or the foot of it. Only then -- a
           box that grows with its words has no spare room to sit
           anywhere in, which is the T15 model and is not changed. */
        if(a.fh&&(a.va==='m'||a.va==='b')){
          /* the WHOLE box is the fit line. core.css makes every box
             border-box, so min-height already counts the .35em padding
             and the 1px border: taking them off again drew the box
             0.7em+2px short of its height -- shorter than the .pptx
             writes it, and off-centre for an arrow attached to it,
             which measures the stored box (T561, 2026-10-06) */
          d2.style.minHeight=a.fh+'%';
          d2.classList.add('an-va-'+a.va);
        }
        /* the fit multiplier rides on the element as a variable, so
           shrink-to-fit never rewrites a.size (T15) */
        /* --talk-text is 1 everywhere but a live talk (T88); it rides
           in the same calc as the fit multiplier because both are
           "scale what a.size asked for" and neither writes the model */
        d2.style.fontSize='calc('+fontPx(layer,a.size)
          +' * var(--an-fit,1) * var(--talk-text,1) * var('
          +talkVarFor(a)+',1))';
        /* only an EXPLICIT colour goes inline: the default comes from
           CSS so .page-light can flip it — a baked '#ffffff' default
           made every template text white-on-white on a light poster
           (2026-08-05 review) */
        if(a.color) d2.style.color=tokVal(a.color);
        if(a.b) d2.style.fontWeight='700';
        if(a.i) d2.style.fontStyle='italic';
        var deco=(a.u?'underline ':'')+(a.strike?'line-through':'');
        if(deco.trim()) d2.style.textDecoration=deco.trim();
        if(a.align) d2.style.textAlign=a.align;
      /* MARKERS TRAVEL WITH THE WORDS. `list-style-position` defaults to
         `outside`, which pins every bullet to the fixed 1.15em gutter —
         so a centred or right-aligned list had its words in the middle
         and its dots stranded at the left margin, which is the "dot
         points sit in a weird way" (2026-08-29). Only for the alignments
         where it is wrong: a left-aligned list wants the hanging indent
         it already has. */
      if(a.align==='center'||a.align==='right')
        d2.style.listStylePosition='inside';
        if(a.font) d2.style.fontFamily=fontCss(a.font);
        /* a.lh is a MULTIPLE of the type size, the way every word
           processor states it, so it survives every zoom and page size
           for free; a.pspace is the gap between paragraphs in the same
           currency (2026-08-20) */
        if(a.lh) d2.style.lineHeight=a.lh;
        if(a.pspace) d2.style.setProperty('--an-pspace',a.pspace+'em');
        /* indentation, in em of the box's own type size — so it means the
           same thing on a 16:9 slide and on an A0 poster, exactly as a.lh
           and a.pspace already do. It is one of the properties the user
           named for the Apply dialog and the only one that did not exist
           yet (2026-08-22). */
        if(a.ind) d2.style.setProperty('--an-ind',a.ind+'em');
        else d2.style.removeProperty('--an-ind');
        if(a.bg!==0&&a.bgc){
          d2.style.background=tokVal(a.bgc);
          d2.style.borderColor='transparent';
        }
        /* T223: an explicit edge colour wins over both the default
           and the transparent edge a background sets */
        if(a.bdc) d2.style.borderColor=
          (a.bdc==='none')?'transparent':tokVal(a.bdc);
        if(a.w){d2.style.width=a.w+'%';d2.style.maxWidth='none';}
        applyCommon(d2,a);
        d2.setAttribute('data-idx',i);
        
        /* a text box has width and no height: only the six handles that
           can actually change something (T65) */
        /* T542: a box that keeps a height (a.fh) has it to drag, top and
           bottom; one that grows with its words has width handles only */
        if(editing){d2.appendChild(mkResize(null,a.fh?0:1));
          d2.appendChild(mkRotate());}
        /* {fig} RESOLVES AT RENDER, never in the stored words (T18).
           Not while the box is being edited: what you type is what is
           stored, and a caret sitting inside a substituted number would
           be a caret in text that does not exist. */
        /* WHICH PAGE (T163). A box with one page is a.text/a.html and
           nothing below this line changes; a book turns to the page its
           walk says. -1 means this book has nothing to say about the
           figure showing now -- it renders its first page and the pass
           at the end of renderAnnots takes it off the slide. */
        var _pn=textAt(s,a),_pi=(_pn<0?0:_pn),_pg=textPage(a,_pi);
        /* T325: a REFERENCES BOX draws the bibliography rather than
           storing it, so it is right the moment a citation is added,
           removed or moved and there is nothing to regenerate. */
        var showTx=(editing&&document.activeElement
                    &&d2.contains(document.activeElement)&&!a.bib)
          ?(_pg.t||'')
          :(a.bib?bibListText():figSubst(_pg.t,a,_figMap));
        /* T465: with nothing cited yet the box says what it is for, in
           the editor only (the same an-ph rule as a placeholder: never
           in the show, never printed) */
        var _bibHint=!!(a.bib&&!showTx&&mode==='edit');
        if(_bibHint) showTx='References appear here once a box cites [@key]';
        var showHtml=(a.bib||!_pg.h)?null:figSubst(_pg.h,a,_figMap);
        /* T366: a placeholder is a hint about the SHAPE of the slide,
           so it is drawn only where the shape is what you are working
           on. Anywhere else -- the show, the printed page, a thumbnail,
           every export -- an untouched slot is empty, because "Body
           text" printed on a slide is the bug this closes. */
        var _isPh=!!a.ph||_bibHint;
        if(_isPh&&mode!=='edit'){showTx='';showHtml=null;}
        /* T623: THE BOX AS ITS PARAGRAPHS (THE PARAGRAPH): one <p> each,
           with its level and its marker, the SAME in the editor and in
           the show -- a whole-box list used to be a root <ul> in the show
           and a wrapper round it in the editor, so the spacing between
           its items and the gutter of its second column differed between
           the two. A block, so the browser makes a paragraph per Enter
           (T609: inside a <span> Enter was a bare "\n", and a list typed
           out of lost its next item the first time the box was drawn
           again). A Markdown box renders from its source instead. */
        var tx2=document.createElement(a.md?'span':'div');
        /* A MARKDOWN BOX RENDERS FROM ITS SOURCE, EVERY TIME (T74).
           `a.text` is the markdown you typed and the only copy
           stored; the markup is derived here and dies with the layer,
           so it can never go stale against the words -- which is the
           one thing `a.html` has to be careful about. It is the same
           notesHtml the notes pane, the notes overlay and the
           presenter view already use, so there is ONE markdown in
           this editor, it is the fifty-line subset T28 argued for,
           and it escapes every character before it marks anything up.
           Ahead of a.html on purpose: a stale rich copy left behind
           by some earlier life of the box must not outrank the
           source. */
        tx2.className='an-tx'+(a.md?' an-md':'');
        if(a.md) tx2.innerHTML=notesHtml(showTx);
        /* a placeholder off the editor is nothing at all (T366) -- not
           even the empty bullet an older box-wide list would draw */
        else if(!(_isPh&&mode!=='edit'))
          parasDraw(tx2,(a.bib||_bibHint)?parasFrom(null,showTx,'')
            :parasFrom(a,showTx,showHtml||''));
        /* T547: TEXT IN COLUMNS. The words' own element is the
           multi-column box, so its paragraphs (each with its own marker
           gutter, T623) and a Markdown box all flow the same way, and
           balancing makes a growing box as tall as its longest column. A
           curved box has one baseline and takes none. */
        if(a.ncol>1&&!a.arc){
          tx2.style.columnCount=String(Math.min(3,a.ncol));
          tx2.style.columnGap=((a.cgap!=null)?+a.cgap:COL_GAP_DEF)+'em';
          tx2.classList.add('an-cols');
        }
        if(editing){
          /* THE PAGE, THROUGH THE SAME TWO CLOSURES (T163). editableText
             never knew where the words lived -- it was handed accessors
             -- so pointing them at a page is the whole of the change,
             and the caret, the debounced commit, __jvFlush, the blur
             flush, Tab-to-indent, paste-as-code and the maths and
             markdown re-render gates all keep working untouched. */
          if(_isPh) tx2.classList.add('an-ph');
          /* T465: a references box is drawn from the deck's citations
             and has no words of its own to edit -- the editor opened
             BLANK on a double-click and the list vanished */
          if(a.bib){
            tx2.title='This box draws the deck’s references — cite '
              +'something ([@key] in any text box) to change it';
          } else
          editableText(layer,tx2,
            /* T366: the editor opens EMPTY on a placeholder, so the
               first keystroke is the first word instead of something
               to select and delete first. */
            function(){return a.ph?'':textPage(a,_pi).t;},
            /* rich BOTH ways now. A list used to be saved as plain lines
               only, so bold inside a bullet — or a sub-level — was thrown
               away the moment the box lost focus. */
            function(v,r,ps){
              /* T366: the first real character makes the words yours.
                 Leaving without typing puts the placeholder back --
                 otherwise the empty-box rule below would delete every
                 slot in a template the moment you clicked through it. */
              if(a.ph){
                /* left without typing: the hint goes back. The layer is
                   not re-rendered by a commit, so the words have to be
                   put back by hand or the box reads empty until the
                   next full render -- and the empty-box rule below
                   would then delete every untouched slot in a template. */
                if(!String(v||'').trim()){
                  tx2.innerHTML='';
                  parasDraw(tx2,parasOf(a,_pi));
                  return;
                }
                delete a.ph;
                /* committing writes into the element IN PLACE and never
                   re-renders the layer (see the blur comment above), so
                   the faint class has to come off here or the words you
                   just typed stay ghosted until the next full render */
                tx2.classList.remove('an-ph');
              }
              /* T623: the editor's paragraphs ARE the box: every
                 level and marker on them, an older box-wide list
                 included (parasStore takes it off the box) */
              if(r) parasStore(a,_pi,ps||parasParse(r.html,null));
              else textPageSet(a,_pi,v,'');},
            /* a markdown box is NOT rich: what you edit is the SOURCE,
               so plaintext-only is the right editor (Enter must give a
               newline, not a <div>) and `a.html` has to stay empty, or
               a copy of the rendered markup would be saved beside the
               words and outlive them (T74).
               The seventh argument is how a typeset box gets its own
               formatting back rather than only its plain string: with
               no a.html there is nothing to restore but the LaTeX, and
               with one the box keeps its bold and its colours too. */
            i,!a.md,function(){return textPage(a,_pi).h;},
            /* ...and a box of paragraphs is drawn again from them */
            function(){return parasOf(a,_pi);});
        }
        d2.appendChild(tx2);
        /* CUT IT INTO PIECES (17-text-builds.js). After the content is
           in and before the item joins the layer, so the split sees
           exactly the markup the reader will.
           NOT while the caret is in this box: the wrappers come off at
           focus and go back on at blur, so a re-render mid-typing must
           not put them back underneath the caret.
           NOT on an ARCED box either -- it is redrawn as SVG on a bowed
           baseline and its .an-tx is hidden, so there is nothing on
           screen for a piece to be. It builds as one box. */
        if(typeof textBy==='function'&&textBy(a)&&!a.arc
           &&!(editing&&document.activeElement
               &&d2.contains(document.activeElement)))
          splitParts(tx2,textBy(a));
        /* ---- TURNING THE PAGES (T163) --------------------------------
           The same bar as a figure book's, with PIPS instead of a
           counter. A reader has to be able to tell at a glance whether
           the arrows under a thing turn a figure or a paragraph, and
           dots under words is the one idiom everybody already reads as
           "there is more here"; they also cost no width on a box the
           words have already claimed.
           A book WALKING WITH a flip book draws nothing: the figure's
           arrows are the only cursor, which is the same rule that keeps
           the frame out of a second piece of state. And on an EXPORTED
           page there is nowhere to go -- each page IS one page -- so the
           arrows are left off and the pips stay on as the printed index
           of where you are. */
        var _pgs=textPages(a);
        if(_pgs.length>1&&!(a.fb&&flipById(s,a.fb))){
          var pbar=document.createElement('div');
          pbar.className='an-flipbar an-pgbar';
          pbar.style.justifyContent=(a.align==='center')?'center'
            :(a.align==='right')?'flex-end':'flex-start';
          var pgNav=function(dz,tip){
            if(flipForce!=null) return;
            var nb=document.createElement('button');
            nb.className='an-flipnav';nb.type='button';
            nb.textContent=dz<0?'‹':'›';nb.title=tip;
            nb.disabled=dz<0?(_pi<=0):(_pi>=_pgs.length-1);
            nb.addEventListener('click',function(ev){
              ev.stopPropagation();ev.preventDefault();textStep(i,dz);});
            /* the layer's own mousedown starts a MOVE on whatever is
               under the pointer; without this, dragging off an arrow
               drags the whole text box across the slide */
            nb.addEventListener('mousedown',function(ev){
              ev.stopPropagation();});
            pbar.appendChild(nb);
          };
          pgNav(-1,'Back');
          var pips=document.createElement('span');
          pips.className='an-pgpips';
          _pgs.forEach(function(_pv,pj){
            var dot=document.createElement('button');
            dot.className='an-pgpip'+(pj===_pi?' on':'');
            dot.type='button';
            dot.title=(pj+1)+' of '+_pgs.length;
            dot.setAttribute('aria-label',dot.title);
            if(pj===_pi) dot.setAttribute('aria-current','true');
            if(flipForce!=null) dot.disabled=true;
            dot.addEventListener('click',function(ev){
              ev.stopPropagation();ev.preventDefault();textGo(i,pj);});
            dot.addEventListener('mousedown',function(ev){
              ev.stopPropagation();});
            pips.appendChild(dot);
          });
          pbar.appendChild(pips);
          pgNav(1,'Forward');
          d2.appendChild(pbar);
        }
        placeAnnot(d2);
        /* Curved text. Drawn as SVG on a bowed baseline, which HTML has no
           way to do — but only when the box is NOT being typed into:
           contenteditable does not work on an SVG <textPath>, so the flat
           version is what you edit and the curve is what you see the rest
           of the time. Measured in px after the box is in the DOM so the
           glyphs are never stretched by a viewBox. */
        if(a.arc&&!boxHasList(a)&&d2!==document.activeElement
           &&!d2.contains(document.activeElement)){
          /* the box has to be tall enough to hold the arch before it is
             measured — a one-line box has no room to curve in */
          var afs=parseFloat(window.getComputedStyle(tx2).fontSize)||16;
          d2.style.minHeight=
            (afs*(1.25+Math.abs(+a.arc||0)/26))+'px';
          applyTextArc(d2,tx2,a,i);
        }
      } else if(a.k==='table'){
        drawTable(layer,s,a,i,editing,placeAnnot);
      } else if(a.k==='chart'){
        drawChart(layer,s,a,i,placeAnnot);
      } else if(a.k==='image'){
        var im=document.createElement('div');
        im.className='an-item an-image'+(selAnnot===i?' sel':'');
        var ap5=anchorPos(a,a.w,a.h);
        im.style.left=ap5.x+'%';im.style.top=ap5.y+'%';
        im.style.width=(a.w||30)+'%';im.style.height=(a.h||24)+'%';
        applyCommon(im,a);
        im.setAttribute('data-idx',i);
        var img=document.createElement('img');
        img.className='an-imgel';img.src=a.src||'';
        img.draggable=false;
        altAttrs(img,a);
        if(a.crop) im.classList.add('an-cropped');
        /* T387: A WINDOW ONTO THE PICTURE. a.win names a region of the
           picture, in percent of the picture, and the box shows THAT,
           filled -- the picture is scaled so the window fills the box.
           A zoom callout is an ordinary picture wearing a window, and
           since T587 so is every picture whose trim is finished.
           The window CLIPS in a wrapper of its own, and a shape crop is
           cut there too: on the <img> it would be measured on the whole
           picture, and on the item it would cut off the handles (which
           the item's own overflow:hidden used to do to a callout). */
        if(a.win&&a.win.w>0&&a.win.h>0){
          im.classList.add('an-win');
          img.style.width=(10000/a.win.w).toFixed(2)+'%';
          img.style.height=(10000/a.win.h).toFixed(2)+'%';
          img.style.left=(-(a.win.x||0)*100/a.win.w).toFixed(2)+'%';
          img.style.top=(-(a.win.y||0)*100/a.win.h).toFixed(2)+'%';
          var iw=document.createElement('div');iw.className='an-imgwin';
          applyCrop(iw,a);
          iw.appendChild(img);im.appendChild(iw);
        } else {applyCrop(img,a);im.appendChild(img);}
        /* a DRAWN crop has no edges to drag: the outline is the crop,
           and four inset handles over it would claim to move something
           they cannot (T64) */
        if(editing){if(cropMode&&selAnnot===i&&!(a.crop&&a.crop.path))
            mkCropHandles(im,layer,s,i);
          else {im.appendChild(mkResize(
              'Drag to resize — the picture keeps its shape. '
                +'Hold Shift to stretch it'));   /* T588: cropped too */
            im.appendChild(mkRotate());}}
        placeAnnot(im);
      } else if(a.k==='video'){
        /* T321: a clip. The element plays from a blob: URL minted from
           the deck's own store; inside a print root (a standalone
           export) the bytes go inline so the file plays anywhere. */
        var mv=document.createElement('div');
        mv.className='an-item an-video'+(a.audio?' an-audio':'')
          +(selAnnot===i?' sel':'');
        var apv=anchorPos(a,a.w,a.h);
        mv.style.left=apv.x+'%';mv.style.top=apv.y+'%';
        mv.style.width=(a.w||40)+'%';mv.style.height=(a.h||22)+'%';
        applyCommon(mv,a);
        mv.setAttribute('data-idx',i);
        var inlineSrc=!!(layer.closest&&layer.closest('#print-root'));
        mv.appendChild(mediaElement(a,i,editing,inlineSrc));
        if(editing){
          var chip=document.createElement('div');
          chip.className='an-mediachip';
          chip.textContent=(a.audio?'\u266a ':'\u25b6 ')+mediaLabel(a);
          mv.appendChild(chip);
          mv.appendChild(mkResize('Drag to resize the clip'));
          mv.appendChild(mkRotate());
        }
        placeAnnot(mv);
      } else if(a.k==='web'){
        /* T388: a live page. Sandboxed, lazy, and covered while editing
           so the box can be picked up -- an iframe eats the pointer. */
        var wb=document.createElement('div');
        wb.className='an-item an-web'+(selAnnot===i?' sel':'');
        var apw=anchorPos(a,a.w,a.h);
        wb.style.left=apw.x+'%';wb.style.top=apw.y+'%';
        wb.style.width=(a.w||60)+'%';wb.style.height=(a.h||60)+'%';
        applyCommon(wb,a);
        wb.setAttribute('data-idx',i);
        if(webUrlOk(a.url)){
          var ifr=document.createElement('iframe');
          ifr.className='an-webframe';
          ifr.setAttribute('sandbox',WEB_SANDBOX);
          ifr.setAttribute('loading','lazy');
          ifr.setAttribute('referrerpolicy','no-referrer');
          ifr.setAttribute('title',a.name||('Web page: '+webHost(a.url)));
          ifr.src=a.url;
          wb.appendChild(ifr);
        } else {
          var bad=document.createElement('div');
          bad.className='an-webempty';
          bad.textContent='No web address yet';
          wb.appendChild(bad);
        }
        if(editing){
          var cov=document.createElement('div');
          cov.className='an-webcover';
          var lab=document.createElement('span');
          lab.textContent=webHost(a.url)||'web page';
          cov.appendChild(lab);
          wb.appendChild(cov);
          wb.appendChild(mkResize('Drag to resize the page'));
          wb.appendChild(mkRotate());
        }
        placeAnnot(wb);
      } else if(a.k==='flip'){
        var fr=flipFrames(a),at=flipAtNow(s,a),fdef=fr[at]||null;
        var fl=document.createElement('div');
        fl.className='an-item an-flip'+(selAnnot===i?' sel':'')
          +(fr.length?'':' empty');
        var ap6=anchorPos(a,a.w,a.h);
        fl.style.left=ap6.x+'%';fl.style.top=ap6.y+'%';
        fl.style.width=(a.w||40)+'%';fl.style.height=(a.h||32)+'%';
        applyCommon(fl,a);
        fl.setAttribute('data-idx',i);
        /* the frame is LETTERBOXED into a box that never changes size.
           Frames differ in shape — a wide plot, then the same plot with a
           legend — and a box that hugged each one would move every caption
           tied to it on every click, which is precisely the jitter people
           duplicate slides to avoid. */
        var fst=document.createElement('div');
        fst.className='an-flipstage';
        /* T234: THE PAGE TURN, AS AN EFFECT. Turning a page has
           always cost a click in the show, but it looked like a cut,
           so nothing about a flip book said "animation" (2026-09-04,
           user: "can there be a make each flip an animation that
           appears in animations when selected"). The class is added
           only when the frame CHANGED since the last render, so an
           edit elsewhere on the slide does not replay it. */
        var fkey=a.fid||(cur+':'+i);
        if(flipSeen[fkey]!==at){
          /* not on the FIRST sight of a book: opening a slide is not
             a page turn */
          if(flipSeen[fkey]!=null) flipTurn[fkey]=Date.now();
          flipSeen[fkey]=at;
        }
        if(a.fanim&&motionOK()&&flipTurn[fkey]
          &&(Date.now()-flipTurn[fkey])<FTURN_MS)
          fst.className+=' fturn fturn-'+a.fanim;
        if(!fr.length){
          var fph=document.createElement('div');
          fph.className='an-flipempty';
          fph.textContent=editing
            ?'Empty flip book — Notebook figures, Pictures… or Pages… on the Object tab put pages in it'
            :'';
          fst.appendChild(fph);
        } else if(fdef&&fdef.src){
          var fim=document.createElement('img');
          fim.className='an-flipimg';fim.src=fdef.src;
          fim.draggable=false;
          /* a flip book's frames are one figure shown many ways, so the
             book's alt text describes each of them; a named frame adds
             which one is showing */
          altAttrs(fim,a,fdef&&fdef.label);
          fst.appendChild(fim);
        } else if(fdef&&fdef.ref){
          var fnode=framePart(fdef.ref,fdef.part);
          if(fnode){
            /* the same currency a placed cell uses: natural size, zoomed
               by a.ts x pageScale, so the page's zoom cannot change how
               big the figure is relative to the slide */
            fnode.style.zoom=(a.ts||1)*(pageScale(layer)||1);
            fst.appendChild(fnode);
          } else {
            var fmiss=document.createElement('div');
            fmiss.className='an-flipempty';
            fmiss.textContent=editing
              ?'That notebook is not open, and the deck holds no copy of '
                +'this frame'
              :'';
            fst.appendChild(fmiss);
          }
        } else if(fdef&&fdef.own&&editing){
          /* T403: the page's picture is an object of its own on the
             slide, tied to this page; the leaf in the book is blank */
          var fown=document.createElement('div');
          fown.className='an-flipempty an-flipown';
          fown.textContent='This page is its own object on the slide '
            +'\u2014 select it there to move, resize or fade it';
          fst.appendChild(fown);
        }
        fl.appendChild(fst);
        if(fr.length>1&&a.fbtn){
          /* ONE BUTTON PER FIGURE (T86, user: "it would be cool if you
             could have an option for 'buttons per image'"). The arrows
             are a walk; these are a menu — with nine figures, reaching
             figure 7 in front of an audience should not be six clicks.
             Real <button>s for the same reason the arrows are: the
             click-to-advance handler already skips button,a,input,select,
             so jumping to a figure cannot also advance the slide. A named
             frame names its button, so the row reads the way the frames
             pane does. */
          var fbtns=document.createElement('div');
          fbtns.className='an-flipbar an-flipbtns';
          fr.forEach(function(fd,fi){
            var jb=document.createElement('button');
            jb.className='an-flipbtn'+(fi===at?' on':'');
            jb.type='button';
            jb.textContent=(fd&&fd.label)?fd.label:String(fi+1);
            jb.title='Go to '+frameLabel(fd,fi);
            if(fi===at) jb.setAttribute('aria-current','true');
            /* an EXPORTED page IS one frame, so there is nowhere to go:
               the row stays as the printed index of where you are, which
               is what tells a reader on paper this is step 2 of 3 */
            if(flipForce!=null) jb.disabled=true;
            jb.addEventListener('click',function(ev){
              ev.stopPropagation();ev.preventDefault();flipGo(i,fi);});
            /* the layer's own mousedown starts a MOVE on whatever is
               under the pointer; without this, dragging off a button
               drags the whole flip book across the slide */
            jb.addEventListener('mousedown',function(ev){
              ev.stopPropagation();});
            fbtns.appendChild(jb);
          });
          fl.appendChild(fbtns);
        } else if(fr.length>1){
          var fbar=document.createElement('div');
          fbar.className='an-flipbar';
          /* real <button>s, which is what makes them safe in playback:
             the click-to-advance handler already skips
             button,a,input,select, so stepping a frame cannot also
             advance the slide.
             On an EXPORTED page there is nothing to click — each page IS
             one frame — so the arrows are left off and only the counter
             goes on, which is what tells a reader on paper that they are
             looking at step 2 of 3 (2026-08-22). */
          function flipNav(d,tip){
            if(flipForce!=null) return;
            var nb=document.createElement('button');
            nb.className='an-flipnav';nb.type='button';
            nb.textContent=d<0?'‹':'›';nb.title=tip;
            nb.disabled=d<0?(at<=0):(at>=fr.length-1);
            nb.addEventListener('click',function(ev){
              ev.stopPropagation();ev.preventDefault();flipStep(i,d);});
            /* the layer's own mousedown starts a MOVE on whatever is
               under the pointer; without this, dragging off an arrow
               drags the whole flip book across the slide */
            nb.addEventListener('mousedown',function(ev){
              ev.stopPropagation();});
            fbar.appendChild(nb);
          }
          flipNav(-1,'Previous figure');
          var fn=document.createElement('span');
          fn.className='an-flipn';
          fn.textContent=(at+1)+' / '+fr.length;
          if(fdef&&fdef.label) fn.title=fdef.label;
          fbar.appendChild(fn);
          flipNav(1,'Next figure');
          fl.appendChild(fbar);
        }
        if(editing){fl.appendChild(mkResize());fl.appendChild(mkRotate());}
        placeAnnot(fl);
      }
    });
    if(prior) Object.keys(prior).forEach(function(k){
      if(!nextItems[k]&&prior[k].el.parentNode===layer) prior[k].el.remove();
    });
    /* ---- WHAT BELONGS TO ANOTHER FRAME --------------------------------
       Done as a pass over the rendered layer rather than inside the loop
       above, the way the build animations are: every kind builds its own
       element, and one predicate applied afterwards cannot be forgotten by
       a branch added later.
       In PLAYBACK an item of another frame is removed. In the EDITOR it is
       dimmed instead and left where it is — you have to be able to see and
       click the caption you are about to tie to frame 4 while you are
       standing on frame 1.
       A TIE TO A CHART'S SERIES (T162) comes through the same predicate
       and takes the removal branch only. It never dims: a chart is whole
       in the editor by design and has no arrows to step, so a dim there
       would be permanent — see seriesShows for the whole argument. */
    (s.annots||[]).forEach(function(a,i){
      /* the fast path has to know about EVERY reason an object might
         not be on screen -- both kinds of tie (T173) and an exit
         (T174) -- or a feature is skipped here and quietly does
         nothing. One predicate, so adding the next kind of stop is one
         edit rather than a hunt. */
      if(!a) return;
      if(!(typeof stepTied==='function'?stepTied(a):a.fb)) return;
      /* A TEXT BOOK IS NOT HIDDEN BY ITS TIE -- the tie turns its pages.
         It goes only on a figure it has NO page for, which is a
         different thing from having run out: stale words beside a new
         figure is the failure this feature exists to prevent. */
      /* ONE QUESTION, however many kinds of stop can answer it (T173):
         a flip book's figure, and now a chart's SERIES. stepShows asks
         both, and each half returns true for an item that carries no
         tie of its own -- so a deck written before either existed is
         byte-for-byte unchanged. */
      var gone=(a.k==='text'&&textPages(a).length>1)
        ?(textAt(s,a)<0)
        :!((typeof stepShows==='function')?stepShows(s,a):flipShows(s,a));
      if(!gone) return;
      var fel=layer.querySelector('[data-idx="'+i+'"]');
      if(!fel) return;
      if(editing) fel.classList.add('an-fbother');
      else if(fel.parentNode) fel.parentNode.removeChild(fel);
    });
    /* BEFORE the arrows: an attached endpoint is derived from where its
       target sits, and an anchored target has not finished moving until
       anchorFix has measured it */
    /* ...and EVERY END MEASURED BEFORE ANY ARROW IS DRAWN. Drawing one
       puts its paths and handles into the layer, so the next arrow's
       measure laid the page out again: once per arrow, seven times for a
       seven-step cycle (2026-10-08). Nothing an arrow draws moves an
       item, so measuring first finds the same boxes; drawArrow reads
       them back. */
    var _pre={ends:{},lr:null};
    if(_anchorFixWanted) anchorFix(layer,s);
    _arrows.forEach(function(i){
      _pre.ends[i]=arrowEnds(layer,s,(s.annots||[])[i],i);});
    if(_arrows.length){
      _pre.lr=layer.getBoundingClientRect();
      layer._hPass.arrows=_pre;
    }
    _arrows.forEach(function(i){
      drawArrow(layer,s,(s.annots||[])[i],i,svg,svgTop,defs,editing);
    });
    layer._hPass.arrows=null;
    /* The visible strokes live in svgTop. Attach it before the shared
       privacy/build passes query the layer; it is still the last child,
       so the z-order promise above is unchanged (T49). */
    layer.appendChild(svgTop);
    /* ONE marking pass rather than a class in each of the nine branches
       that build an item. A private thing has to LOOK private in both
       places it is drawn -- the editor and the presenter view -- or you
       cannot tell what the audience is seeing (T31). */
    markPrivateItems(layer,s);
    /* the layer is rebuilt on every change, which throws away whatever
       MathJax had already typeset - so ask for it again, but ONLY when
       the slide actually carries maths. Typesetting a whole layer on
       every mousemove of a drag would be a real cost for nothing.
       slideHasMaths, not `s.annots.some(hasMaths)`: a title slide's
       title and subtitle are strings on the slide, so the annot-only
       question threw their LaTeX away on every rebuild (T53). */
    if(slideHasMaths(s)){
      if(prior) changed.forEach(function(el){typeset(el);});
      else typeset(layer);
    }
    /* build animations: number the builds in the editor; in playback, hide the
       ones not yet revealed and animate the one just revealed.
       The editor's .an-buildno badges are still BUILT on every render, but
       deck.css shows them only while the Timeline pane (#animpane) is open
       (T76, user: "the animation bubbles ... you can't get rid of them").
       Do NOT "fix" the missing bubbles here: the pane is the one place you
       are actually reading build numbers, and everywhere else they were
       clutter with no off switch. The filmstrip's ▸N mark is what says a
       slide is animated when the pane is shut. */
    /* reading-order badges (T106): built on every render like the
       build bubbles below, and CSS-gated the same way (T76) — shown
       only while the Reading order panel (#rd-order) is open. Cyan and
       top-RIGHT so an open Timeline's amber top-left build numbers can
       be read at the same time. */
    if(editing){
      var rmap={},rn=0;
      orderedIdx(s).forEach(function(ri){rmap[ri]=++rn;});
      $$('.an-item[data-idx],.an-arrow-line[data-idx]',layer)
        .forEach(function(el){
          if(kept.has(el)) return;
          var raw=el.getAttribute('data-idx');
          if(raw==='t'||raw==='s') return;
          if(rmap[+raw]==null) return;
          var rb=document.createElement('span');
          rb.className='an-readno';rb.textContent=rmap[+raw];
          rb.title='Reading order: '+rmap[+raw];
          el.appendChild(rb);
        });
    }
    /* T238: an EXIT is a build too, so a slide whose only animation
       is something leaving still needs this pass */
    /* T491: ...and so does a focus (a slide whose only animation was
       a Zoom in ate its click and showed nothing -- third review pass) */
    if(s.annots&&s.annots.some(function(a){
      return a&&(a.anim||animOut(a)!=null
        ||(typeof animFocus==='function'&&animFocus(a)));})){
      var steps=slideBuildSteps(s),plan=flipPlan(s);
      /* .an-arrow-line is the visible stroke and carries no .an-item
         class (the fat invisible hit path under the items does), so an
         ANIMATED arrow was never hidden before its build and simply sat
         on the slide from the first frame (2026-08-20 audit) */
      $$('.an-item[data-idx],.an-arrow-line[data-idx]',layer).forEach(function(el){
        var raw=el.getAttribute('data-idx');
        if(raw==='t'||raw==='s') return;
        var bi=+raw,ba=(s.annots||[])[bi];
        if(!ba) return;
        /* the fade OUT, on the one stop it goes (T238) */
        if(mode==='view'&&animGoing(s,ba))
          el.classList.add('an-anim-out');
        /* T472: the click on which it is the point */
        if(mode==='view'&&typeof animFocusing==='function'
           &&animFocusing(s,ba)&&typeof focusPaint==='function')
          focusPaint(layer,el,ba);
        if(kept.has(el)) return;
        /* T391: THE STORY. Editing at stop k, an object that has
           already left is not on the slide -- not dimmed, not there --
           so what is under it can be reached. Checked before the
           entrance, because an object that simply sits there can still
           leave. */
        var storyK=(editing&&typeof storyAt==='number')?storyAt:null;
        if(storyK!=null){
          var oo=animOut(ba);
          if(oo!=null&&steps.map[oo]!=null){
            var so=plan.stop[steps.map[oo]];
            if(so==null) so=steps.map[oo];
            if(storyK>so) el.classList.add('an-storyout');
          }
        }
        if(!ba.anim) return;
        var st=steps.map[ba.anim.order||0];   /* which build step (0-based) */
        if(st==null) return;
        if(editing){
          /* T402: the badge is the CLICK the space bar counts, which is
             what the animation pane numbers -- the build's stop index
             skipped a flip book's page turns, so a shape after a
             three-page book wore "5" on the slide and "7" in the pane */
          var clk=plan.stop[st]; if(clk==null) clk=st;
          var bd=document.createElement('span');
          bd.className='an-buildno';bd.textContent=(clk+1);
          bd.title='Click '+(clk+1)+' — '+(ba.anim.type||'fade')
            +' (items on the same click appear together)';
          el.appendChild(bd);
          /* T391: ...and what has not arrived by stop k is not there
             either; a box arriving in pieces shows the pieces that are */
          if(storyK!=null){
            var spk=plan.stop[st]; if(spk==null) spk=st;
            /* T578: text that is all there is there at every stop */
            var hlAll=(ba.anim.hl===1||ba.anim.hl===true)
              &&typeof textBy==='function'&&!!textBy(ba);
            if(hlAll){}
            else if(spk>=storyK) el.classList.add('an-storyout');
            else if(typeof textBy==='function'&&textBy(ba)){
              var spst=pieceSteps(steps,ba);   /* T577 */
              $$('[data-part]',el).forEach(function(pe){
                var j=+pe.getAttribute('data-part');
                var jb=spst[j]; if(jb==null) jb=st+j;
                var jp=plan.stop[jb]; if(jp==null) jp=jb;
                pe.style.visibility=(jp>=storyK)?'hidden':'';
              });
            }
          }
          /* T473: the grid of covers, faint and numbered while editing */
          if(typeof panelPaint==='function') panelPaint(el,ba,s,st,plan,true,storyK);
        } else if(mode==='view'){
          /* WHICH STOP, not which build number: a flip book with a build
             of its own puts its frames straight after itself, so anything
             built behind one sits later in the sequence than its build
             number says (T86). The badge above stays the BUILD number,
             which is what the animation pane counts. */
          var sp=plan.stop[st];
          if(sp==null) sp=st;
          /* PIECE BY PIECE (T172). A cut box is on screen from its own
             build -- the frame it occupies must not jump as bullets
             arrive -- and its pieces come one per stop after it, read
             off the same cursor everything else uses. `visibility`, not
             `display`, so nothing reflows underneath the words. */
          if(typeof textBy==='function'&&textBy(ba)){
            /* piece j lives on build step st+j, so it is showing exactly
               when its own stop has been taken. Read off the same plan
               everything else uses -- no second cursor.
               T385: with anim.hl the pieces are never hidden. The one
               whose stop was just taken is lit, the ones still to come
               sit quiet, the ones already done are plain. */
            var hl=!!ba.anim.hl;
            /* T578: APPEAR + HIGHLIGHT (anim.hl 2). The pieces still to
               come are hidden as Reveal hides them, the one arriving is
               lit, and "the rest" are the ones already said -- so the
               dimmed / blurred choice acts on those. */
            var hlIn=(ba.anim.hl===2);
            if(hl) el.setAttribute('data-hlin',hlIn?'1':'0');
            /* T471: the lit piece's look and the rest's, as data the
               CSS reads (hlfx: bigger & coloured / bigger / coloured;
               hlrest: dimmed / blurred / as they are) */
            if(hl){
              el.setAttribute('data-hlfx',ba.anim.hlfx||'both');
              el.setAttribute('data-hlrest',ba.anim.hlrest||'dim');
              /* T493: ITS COLOUR AND ITS SIZE (2026-09-15, user: "I am
                 confused if that is an option to change the colour of
                 the highlight and size"). Two more facts on the box,
                 read by the CSS as variables: hlcol is a deck colour
                 (@accent by default) or a hex, hlsize a percent. */
              el.style.setProperty('--hl-col',tokVal(ba.anim.hlcol||'@accent'));
              el.style.setProperty('--hl-scale',
                String((ba.anim.hlsize>0?ba.anim.hlsize:104)/100));
            }
            var vpst=pieceSteps(steps,ba);   /* T577: its own step */
            var firstAt=-1;   /* the piece that arrives WITH the box */
            $$('[data-part]',el).forEach(function(pe){
              var j=+pe.getAttribute('data-part');
              var jb=vpst[j]; if(jb==null) jb=st+j;
              var jp=plan.stop[jb];
              if(jp==null) jp=jb;
              var wait=(mode==='view'&&jp>=revealCount);
              pe.style.visibility=(wait&&(!hl||hlIn))?'hidden':'';
              /* T623: a paragraph (or item) whose first words are still
                 to come holds its marker back with them (deck.css,
                 .an-mk-wait) -- a dot on its own in front of nothing
                 reads as a fault, not as a build */
              var bp=pe.parentNode;
              if(bp&&bp.firstElementChild===pe&&bp.classList
                 &&(bp.tagName==='LI'||bp.classList.contains('an-p')))
                bp.classList.toggle('an-mk-wait',
                  pe.style.visibility==='hidden');
              if(hl&&mode==='view'){
                pe.classList.toggle('an-hl',jp===revealCount-1);
                pe.classList.toggle('an-hl-wait',wait);
                pe.classList.toggle('an-hl-rest',jp!==revealCount-1);
              }
              /* T471: a typewriter box types each bullet on its own
                 click, not the whole box on the first */
              if(jp===sp&&(firstAt<0||j<firstAt)) firstAt=j;
              if((!hl||hlIn)&&mode==='view'&&jp!==sp&&jp===revealCount-1
                 &&ba.anim.type==='type'&&typeof typeInto==='function'
                 &&!(typeof storyPaint!=='undefined'&&storyPaint))
                typeInto(el,j);
            });
          }
          /* T473: a figure in panels -- cover k lifts on build step
             st+k, read off the same plan as a text piece */
          if(typeof panelPaint==='function') panelPaint(el,ba,s,st,plan,false,null);
          /* T578: HIGHLIGHT ONLY is text that is ALL THERE -- on the
             slide from the start, every piece waiting to be lit -- so
             the box is never held back and has no entrance to play */
          var allThere=(ba.anim.hl===1||ba.anim.hl===true)
            &&typeof textBy==='function'&&!!textBy(ba);
          if(allThere){}
          else if(sp>=revealCount) el.classList.add('an-prebuild');
          else if(sp===revealCount-1){
            var atype=ba.anim.type||'fade';
            /* "appear" is instant (no keyframe); rise/zoom animate transform,
               which would fight a rotation and snap — a rotated item fades */
            /* the rotated-item swap is GONE (T156). It existed because
               the keyframes animated the `transform` SHORTHAND, which
               replaced the inline rotate(); they now animate `translate`
               and `scale`, which compose with it. An effect that names
               itself must be the effect that plays. */
            /* T385: the typewriter is for words; anything else fades */
            atype=(atype==='type'&&ba.k!=='text')?'fade':atype;
            if(atype!=='appear') el.classList.add('an-anim-'+atype);
            if(atype==='type'&&typeof typeInto==='function'
               &&!(typeof storyPaint!=='undefined'&&storyPaint))
              typeInto(el,(typeof textBy==='function'&&textBy(ba)
                &&(!ba.anim.hl||ba.anim.hl===2))?Math.max(0,firstAt)
                :undefined);   /* T471 */
          }
        }
      });
    }
    /* T472: nothing on this slide is the point right now -- the zoom,
       if the stage still carries one, comes back */
    if(typeof focusSettle==='function') focusSettle(layer);
    /* ---- T385: MOTION THAT KEEPS GOING. One class per item. A pass
       of its own, like the builds above, so no kind's branch can forget
       it. T446: IN THE EDITOR TOO (2026-09-14, user: "just applied some
       motions to things and they did not work"). It played in the show
       only, so applying one changed nothing on screen and read as
       broken. The selected item alone stays still (deck.css), so a
       wobbling box can still be grabbed. */
    if(s.annots&&s.annots.some(function(a){
      return a&&a.motion;})){
      $$('.an-item[data-idx]',layer).forEach(function(el){
        if(kept.has(el)) return;
        var raw=el.getAttribute('data-idx');
        if(raw==='t'||raw==='s') return;
        var ma=(s.annots||[])[+raw];
        if(ma&&ma.motion){
          el.classList.add('an-move-'+ma.motion);
          /* T445: and the numbers on it -- speed, how far, easing,
             when it starts, how many times, which way round */
          if(typeof motionPaint==='function') motionPaint(el,ma);
        }
      });
    }
    /* ---- SHRINK TO FIT, AND SAY SO WHEN IT CANNOT ---------------------
       (TASKS T15.) Two halves of one question: does this text fit in the
       space you meant it to have, and what should happen when it does
       not.

       THE DESIGN DECISION, which had to come first: what box does a text
       box overflow? It has none. `a.h` is not a text property — the
       renderer has never read it for one, sameSize excludes text from
       height, and APPLY_PROPS says so in a comment ("a ticked Height on
       a heading would be a control that does nothing"). Text auto-heights
       from its words, which is right and is not being changed.

       So the fit target is a SEPARATE, OPT-IN field: `a.fh`, the height
       you are asking the words to live within, in % of the page. It is
       not the box's height — the box still grows with its content, which
       is what makes the overflow visible instead of clipped. It is the
       line you have drawn and asked the text to respect. Absent, and
       nothing here does anything at all, which is every text box in
       every deck to date.

       SHRINKING IS A RENDER-TIME SCALE, never a rewrite of a.size.
       Writing the size would bake it (the T12 argument), fight the style
       system on the next Re-apply, and lose the original the moment you
       shortened the words again. A multiplier on the element leaves the
       model saying what you asked for and the screen showing what fits.

       fitTexts runs HERE, with the strays pass, because both need the
       same thing: a DOM that has been laid out — and again at the text
       COMMIT, because committing a box writes into the element in place
       and never rebuilds the layer, so a box that had just been filled
       past its fit height was measured before the words arrived
       (2026-08-25, found in the browser). */
    fitTexts(layer,s,editing,kept);
    altPaint(layer,s);    /* T552: charts, clips and notebook figures */
    picPaint(layer,s);    /* T550: picture corrections */
    shadowPaint(layer,s); /* T548 */
    /* ...and AFTER the fit pass, which can change a box's height */
    if(_anchorFixWanted) anchorFix(layer,s);
    /* ---- STRAYS ------------------------------------------------------
       Anything sitting outside the page. They used to be clipped by the
       stage and unreachable — you could not scroll to them and you could
       not see they were there (2026-08-20, user). Marked here, and the
       stage is told so it can grow scrollbars; the print check has always
       flagged them, but flagging a thing you cannot get to is only half
       an answer. */
    if(editing){
      var spill=false;
      (s.annots||[]).forEach(function(a,i){
        if(!a||a.hide) return;
        var r=annotRectPct(layer,s,i);
        if(!r) return;
        var out=(r.l<-1||r.t<-1||r.r>101||r.b>101);
        if(out) spill=true;
        $$('.an-item[data-idx="'+i+'"]',layer).forEach(function(el){
          el.classList.toggle('an-offpage',out);});
      });
      stage.classList.toggle('spill',spill);
    }
    /* FULLY locked: visible but untouchable on the canvas (an-locked is
       pointer-events:none). Position locked is a different animal — it
       stays clickable and resizable, and only says so with a cursor. */
    if(editing) (s.annots||[]).forEach(function(a,i){
      var lm=lockMode(a); if(!lm) return;
      $$('.an-item[data-idx="'+i+'"]',layer).forEach(function(el){
        el.classList.add(lm==='all'?'an-locked':'an-pinned');});
    });
    /* T563: the comment markers, while editing only -- after the items,
       whose boxes they sit on */
    if(typeof cmtMount==='function') cmtMount(layer,s);
    layer._paintSlide=s;layer._paintMode=mode;layer._paintItems=nextItems;
    /* Replacing the object whose contents changed must not reset its
       independent looping motion. Unchanged objects never leave the DOM. */
    motionTimes.forEach(function(m){
      if(m.time==null||!m.el.getAnimations) return;
      m.el.getAnimations().forEach(function(an){
        if(an.animationName===m.name) an.currentTime=m.time;
      });
    });
    if(prior&&window.SemActivate) changed.forEach(function(el){
      if(el.parentNode===layer) window.SemActivate(el,true);
    });
  }
  function selectAnnot(layer,idx,additive){
    if(cropMode&&idx!==selAnnot){
      cropModeOff();
      /* T587: the picture has just taken its trimmed frame; draw it now,
         before anything that follows measures the layer */
      if(layer&&pres.slides[cur]) renderAnnots(layer,pres.slides[cur]);
    }
    var s=pres.slides[cur];
    if(idx===null){selAnnot=null;selSet=[];}
    else {
      var mem=groupMembers(s,idx);
      if(additive&&typeof idx==='number'){
        if(selSet.indexOf(idx)>=0){
          selSet=selSet.filter(function(i){return mem.indexOf(i)<0;});
          selAnnot=selSet.length?selSet[selSet.length-1]:null;
        } else {
          mem.forEach(function(i){if(selSet.indexOf(i)<0) selSet.push(i);});
          selAnnot=idx;
        }
      } else {selAnnot=idx;selSet=mem.slice();}
    }
    paintSel(layer);
    /* T593: THE RIBBON FOLLOWING A SELECTION MUST NOT BE ABLE TO CANCEL
       IT. Every gesture on the canvas -- a resize handle, a rotate grip,
       an arrow's end -- selects first and starts its drag second, so a
       throw anywhere in showFmt's dozens of syncs ended the gesture
       before it began: one missing key in T578 (see T583) left plain
       text boxes selectable but impossible to resize (2026-09-30, user:
       "I have a text box that cannot be resized at all"), and the
       Animation panel unreachable. The fault is still reported, loudly,
       in the console; the drag goes ahead. */
    try{showFmt();}
    catch(err){
      if(window.console&&console.error)
        console.error('Junoview: the ribbon could not follow the selection',
          err);
    }
    /* refresh the Objects pane only when the selection actually CHANGED
       (resize/endpoint drags re-select every mousemove) */
    var sig=String(selAnnot)+'|'+selSet.join(',');
    if(sig!==lastSelSig){
      lastSelSig=sig;renderSelPane();
      /* a line's CORNER handles - and the faint ones that add a corner -
         only exist for the selected line, and they are drawn by
         renderAnnots. Selecting is not a re-render (paintSel only
         toggles classes), so the handles never appeared on a line you
         had just drawn or just clicked (2026-08-20, found live: 0 of
         them on a freshly drawn arrow). Arrows only: cheap, and nothing
         else on the layer cares about selection at render time. */
      if(mode==='edit'&&layer&&(s&&s.annots||[]).some(function(a){
        return a&&a.k==='arrow';})) redrawArrows(layer,s);
    }
  }
  var lastSelSig='';
  /* select a whole BATCH at once. selectAnnot(...,true) toggles, so
     looping it over a set whose members share a group takes them back
     out again -- which is why the marquee sets selSet directly too. */
  function selectMany(layer,idxs){
    selSet=idxs.slice();
    selAnnot=idxs.length?idxs[idxs.length-1]:null;
    lastSelSig='';
    if(layer) paintSel(layer);
    showFmt();renderSelPane();
  }
  function defaultColor(kind){
    return kind==='text'?'#ffffff':'#ff6b57';
  }
