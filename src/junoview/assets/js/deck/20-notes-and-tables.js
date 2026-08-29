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
      if(!confirm('Delete the timing from '+st.runs.length
        +' rehearsal'+(st.runs.length===1?'':'s')+'?')) return;
      try{lsSet(rehKey(),'[]');}catch(e){}
      renderReh();renderNotesPane();
    });
    host.appendChild(clr);
  }
  function renderNotesPane(){
    var pane=$('#notespane');
    if(!pane||pane.hidden) return;
    var sl=pres.slides[cur];
    var ta=$('#np-notes'),gi=$('#np-goal'),ti=$('#np-total'),
        tot=$('#np-tot');
    if(ta&&document.activeElement!==ta) ta.value=(sl&&sl.notes)||'';
    if(gi&&document.activeElement!==gi)
      gi.value=slideGoal(sl)||'';
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
      if(open){
        /* the panes share one corner: only one can be what you are
           looking at, the rule showVerpane has always kept */
        ['#selpane','#animpane','#preflight'].forEach(function(sel){
          var o=$(sel); if(o) o.hidden=true;});
        var ob=$('#objects-btn');
        if(ob) ob.setAttribute('aria-pressed','false');
        showVerpane(false);
      }
      pane.hidden=!open;
      btn.setAttribute('aria-pressed',open.toString());
      if(open) renderNotesPane();
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
      ta.addEventListener('input',function(){
        var sl=pres.slides[cur]; if(!sl) return;
        var v=ta.value;
        if(v.trim()) sl.notes=v; else delete sl.notes;
        /* quiet, and one undo entry on blur — see the notes editor's
           copy of this handler (T57) */
        markDirty(true);presenterPush();
      });
      ta.addEventListener('blur',function(){
        if(typeof histPush==='function') histPush();});
    }
    var gi=$('#np-goal');
    if(gi){
      gi.addEventListener('keydown',function(e){e.stopPropagation();});
      gi.addEventListener('input',function(){
        var sl=pres.slides[cur]; if(!sl) return;
        var v=parseFloat(gi.value);
        if(v>0) sl.goal=v; else delete sl.goal;
        markDirty();renderNotesPane();presenterPush();
      });
    }
    var gc=$('#np-goalclear');
    if(gc) gc.addEventListener('click',function(){
      var sl=pres.slides[cur]; if(!sl) return;
      delete sl.goal;markDirty();renderNotesPane();presenterPush();
    });
    var ti=$('#np-total');
    if(ti){
      ti.addEventListener('keydown',function(e){e.stopPropagation();});
      ti.addEventListener('input',function(){
        var v=parseFloat(ti.value);
        if(v>0) pres.talkMins=v; else delete pres.talkMins;
        markDirty();renderNotesPane();presenterPush();
      });
    }
    /* three kinds of note, one pane: this slide, the whole talk, and a
       scratchpad that belongs to neither (2026-08-20) */
    $$('#np-tabs .np-tab').forEach(function(t){
      t.addEventListener('click',function(){
        $$('#np-tabs .np-tab').forEach(function(o){
          o.classList.toggle('on',o===t);});
        var which=t.dataset.np;
        var b1=$('#notespane-body'),b2=$('#notespane-deck'),
            b3=$('#notespane-pad');
        if(b1) b1.hidden=(which!=='slide');
        if(b2) b2.hidden=(which!=='deck');
        if(b3) b3.hidden=(which!=='pad');
        var b4=$('#notespane-reh');
        if(b4) b4.hidden=(which!=='reh');
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
    (pres.slides||[]).forEach(function(sl,si){
      if(scope&&scope.indexOf(si)<0) return;
      (sl.annots||[]).forEach(function(a){
        if(a&&a.k==='text'&&a.style&&(!ids||ids.indexOf(a.style)>=0)){
          applyStyleTo(a,a.style);n++;
        }
      });
    });
    markDirty();refresh();
    return n;
  }
  /* every style one step up or down, in proportion - the whole deck's
     type at once, which is the thing you actually want when a room turns
     out to be bigger than you expected */
  function scaleStyles(k){
    styleOrder().forEach(function(id){
      var d=styleDef(id);
      var over=deckStyles()[id]||{};
      over.label=STYLE_DEFAULTS[id].label;
      over.size=Math.max(0.8,Math.min(24,
        Math.round(d.size*k*100)/100));
      ['b','i','font','color','align'].forEach(function(pr){
        if(d[pr]!==undefined) over[pr]=d[pr];});
      deckStyles()[id]=over;
    });
    var n=restyleAll(null);
    toast('Every text style '+(k>1?'bigger':'smaller')
      +' \u2014 '+n+' box'+(n===1?'':'es')+' followed');
  }
  (function(){
    var wrap=$('#dsg-stylewrap'),btn=$('#dsg-styles'),
        menu=$('#dsg-style-menu');
    if(!wrap||!btn||!menu) return;
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
           that half-followed */
        o.label=d.label;o.size=d.size;
        ['b','i','font','color','align','lh','pspace','head']
          .forEach(function(k){
            if(d[k]!==undefined) o[k]=d[k]; else delete o[k];});
        deckStyles()[id]=o;
        return o;
      }
      function toggle(label,key,title){
        var b=document.createElement('button');
        b.className='dbtn stm-tg';b.textContent=label;
        b.setAttribute('aria-pressed',(!!d[key]).toString());
        b.title=title;
        b.addEventListener('click',function(e){
          e.stopPropagation();
          var o=over();
          if(d[key]) delete o[key]; else o[key]=1;
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
      menu.innerHTML='';
      /* FIRST, above the individual styles: picking a whole look is the
         thing you do once at the start, and tuning one style is what you
         do afterwards. The old menu offered only the second (2026-08-22). */
      var sets=document.createElement('button');
      sets.className='dbtn vw-opt';
      sets.textContent='\u25f1 Style sets \u2014 restyle the whole deck\u2026';
      sets.title='Ready-made looks, and any you have saved. Works even '
        +'on a deck that has never used a named style.';
      sets.addEventListener('click',function(e){
        e.stopPropagation();menu.hidden=true;
        if(typeof window.SemDeckStyleSets==='function')
          window.SemDeckStyleSets();
      });
      menu.appendChild(sets);
      menuHead(menu,'this presentation\u2019s type');
      styleOrder().forEach(function(id){
        var d=styleDef(id);
        var row=document.createElement('div');row.className='stm-row';
        var spec=document.createElement('span');
        spec.className='stm-spec';spec.textContent=d.label;
        spec.style.fontWeight=d.b?'700':'400';
        if(d.i) spec.style.fontStyle='italic';
        spec.style.fontSize=Math.max(11,Math.min(22,d.size*3.1))+'px';
        if(d.color) spec.style.color=tokVal(d.color);
        if(d.font) spec.style.fontFamily=fontCss(d.font);
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
            over.label=STYLE_DEFAULTS[id].label;
            over.size=Math.max(0.8,Math.min(24,
              Math.round(d.size*pr[1]*100)/100));
            ['b','i','font','color','align'].forEach(function(k2){
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
        menu.appendChild(row);
        if(openEdit===id) menu.appendChild(styleEditor(id,d,build));
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
      menu.appendChild(add);
      var rst=document.createElement('button');
      rst.className='dbtn vw-opt';
      rst.innerHTML=bic('reset')+' Back to the built-in sizes';
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
      menu.appendChild(rst);
    }
    /* not wireFloatDropdown: this menu REBUILDS itself on every open
       (build()), so the static options list the helper wants never fits */
    btn.addEventListener('click',function(e){
      e.stopPropagation();
      var open=menu.hidden;
      if(open) build();
      menu.hidden=!open;
      btn.setAttribute('aria-expanded',open?'true':'false');
      if(open) floatMenu(btn,menu);
    });
    document.addEventListener('click',function(e){
      if(!menu.hidden&&!wrap.contains(e.target)) menu.hidden=true;
    });
  })();
  (function(){
    var d=$('#dsg-scale-down');
    if(d) d.addEventListener('click',function(){scaleStyles(1/1.12);});
    var u=$('#dsg-scale-up');
    if(u) u.addEventListener('click',function(){scaleStyles(1.12);});
    var r=$('#dsg-restyle');
    if(r) r.addEventListener('click',function(){
      var n=restyleAll(null);
      toast(n?('Re-applied the styles to '+n+' box'+(n===1?'':'es'))
        :'Nothing on this deck is wearing a named style yet');
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
     on the way out, is the fix. */
  function listOf(a){
    /* an older deck stored a.list as the boolean 1 */
    return a&&a.list?(a.list===true||a.list===1?'bullet':a.list):0;
  }
  /* strip markup for the plain projection */
  function plainOf(html){
    var t=document.createElement('template');
    t.innerHTML=String(html||'');
    return t.content.textContent||'';
  }
  /* the box's content as ONE HTML CHUNK PER LINE, whichever form it is in */
  function contentLines(a){
    var out=[],t=document.createElement('template');
    if(listOf(a)&&a.html){
      t.innerHTML=a.html;
      $$('li',t.content).forEach(function(li){
        /* a nested list is a line of its own, at a deeper level; flattened
           here because a plain run of text has no levels to keep */
        var kid=li.querySelector('ul,ol');
        if(kid) kid.remove();
        out.push(li.innerHTML);
      });
      return out.length?out:[''];
    }
    if(a.html){
      /* split on top-level <br>, keeping the inline markup around each */
      t.innerHTML=a.html;
      var cur=document.createElement('template');
      var n=t.content.firstChild;
      while(n){
        var next=n.nextSibling;
        if(n.nodeType===1&&(n.tagName||'').toLowerCase()==='br'){
          out.push(cur.innerHTML);cur.innerHTML='';
        } else cur.content.appendChild(n);
        n=next;
      }
      out.push(cur.innerHTML);
      return out;
    }
    return String(a.text||'').split('\n');
  }
  /* set (or clear) the list style, converting the content either way */
  function setListStyle(a,style){
    if(!a) return;
    var was=listOf(a);
    style=style||0;
    if(was===style) return;
    var lines=contentLines(a);
    if(style){
      /* an empty line still needs a bullet to stand on */
      a.html=lines.map(function(h){
        return '<li>'+(h||'<br>')+'</li>';}).join('');
      a.list=style;
      /* a list has several baselines and no single curve to follow */
      delete a.arc;
    } else {
      a.html=lines.join('<br>');
      delete a.list;
    }
    a.text=lines.map(plainOf).join('\n');
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
  /* colour just the highlighted run inside the text box being edited;
     returns false when there is no live selection to recolour */
  function colorSelection(col){
    var el=activeTextEditable();
    if(!el||!selectionInside(el)) return false;
    try{document.execCommand('styleWithCSS',false,true);}catch(e){}
    try{document.execCommand('foreColor',false,col);}catch(e){}
    var s=pres.slides[cur],a=annotByIdx(s,selAnnot);
    if(a){
      var r=sanitizeRich(el.innerHTML);
      a.text=el.innerText;
      if(r.rich) a.html=r.html; else delete a.html;
      markDirty();
    }
    return true;
  }
  /* the ⠿ move handle is gone: everything drags from its own body now,
     and the handle was both fiddly to hit and sat on top of the artwork
     you were trying to judge (2026-08-07, user) */
  function mkResize(tip){
    /* all four corners resize (anchored on the opposite corner) */
    var frag=document.createDocumentFragment();
    ['nw','ne','sw','se'].forEach(function(cn){
      var r=document.createElement('span');
      r.className='an-resize an-rs-'+cn;
      r.dataset.corner=cn;
      r.title=tip||'Drag to resize';
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
  function flushTextEdits(){
    var live=document.querySelectorAll(
      '[contenteditable="true"],[contenteditable="plaintext-only"]');
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
      /* the draft write is debounced now — a closing tab cannot wait */
      try{flushDraftWrite();}catch(e){}
      if(e&&e.type==='pagehide'){
        try{rehStop();}catch(err){}
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
  function editableText(layer,el,getVal,setVal,idx,rich){
    /* Text is NOT editable on contact. It used to be, which is why a text
       box could only be moved by a little ⠿ handle: clicking the words
       put a caret in them instead of picking the box up. So: click to
       select and drag like anything else, DOUBLE-click to type — which is
       what every other tool on the machine does (2026-08-07, user: "just
       make it normal moving controls"). */
    var editMode=(el.tagName==='UL'||rich)?'true':'plaintext-only';
    function beginEdit(){
      /* WHAT YOU EDIT IS WHAT YOU TYPED. MathJax replaces the text node
         with its own <mjx-container>, so putting a caret into a typeset
         box put it among rendered glyphs — and the commit reads the
         element back as the new source, so one edit turned the LaTeX
         into whatever those glyphs flatten to. Ask the model for the
         stored string and put it back before the caret lands. Not for
         `rich`, which owns its own markup and never carries maths. */
      if(!rich&&el.querySelector&&el.querySelector('mjx-container')){
        var raw=getVal();
        if(raw) el.textContent=raw;
      }
      try{el.contentEditable=editMode;}catch(e){el.contentEditable='true';}
      el.focus();
      var host=el.closest?el.closest('.an-item'):null;
      if(host) host.classList.add('an-editing');
    }
    function endEdit(){
      el.contentEditable='false';
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
      beginEdit();
      /* put the caret where the words were double-clicked, not at the end */
      try{
        var r=document.caretRangeFromPoint
          ? document.caretRangeFromPoint(e.clientX,e.clientY):null;
        if(r){var sel=window.getSelection();sel.removeAllRanges();
          sel.addRange(r);}
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
      if(!getVal()) el.textContent='';
    });
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
    function commitNow(quiet){
      if(!el.isContentEditable) return;
      var v0=(el.innerText||'').replace(/\r/g,'').replace(/\n+$/,'');
      var r0=rich?sanitizeRich(el.innerHTML):null;
      setVal(v0,r0);
      markDirty(quiet);
    }
    el.__jvFlush=function(){commitNow(true);};
    var typeT=null;
    el.addEventListener('input',function(){
      clearTimeout(typeT);
      typeT=setTimeout(function(){commitNow(true);},900);
    });
    el.addEventListener('blur',function(){
      clearTimeout(typeT);
      delete el.__jvFlush;
      var v=(el.innerText||'').replace(/\r/g,'')
        .replace(/\n+$/,'');
      var r=rich?sanitizeRich(el.innerHTML):null;
      setVal(v,r);
      endEdit();
      /* a text box with nothing in it is invisible once deselected (they
         are born with no placeholder and no background) — so an empty one
         removes itself rather than haunting the slide */
      var s2=pres.slides[cur],a2=s2&&(s2.annots||[])[idx];
      if(a2&&a2.k==='text'&&!String(a2.text||'').trim()&&!a2.html){
        s2.annots.splice(idx,1);
        if(selAnnot===idx) selAnnot=null;
        else if(typeof selAnnot==='number'&&selAnnot>idx) selAnnot--;
        /* A mousedown on another object can select it before this blur.
           Removing the empty editor shifts every later annotation index. */
        selSet=selSet.filter(function(i2){return i2!==idx;})
          .map(function(i2){
            return typeof i2==='number'&&i2>idx?i2-1:i2;
          });
        renderAnnots(layer,s2);
        showFmt();
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
      /* and re-fit, for the same reason: the words that just arrived are
         the ones the fit height is about (T15) */
      fitTexts(layer,s2,true);
      markDirty();
    });
    /* AUTO-BULLETS. Typing "- " or "* " at the start of a plain text box
       turns it into a bullet list, and "1. " into a numbered one — the
       markdown habit everybody already has, and the reason nobody could
       find the List button until they had already given up (2026-08-20,
       user: "need auto-dot points"). It only fires on the FIRST
       characters of a box that is not already a list, so it can never
       eat a hyphen you meant to keep. */
    el.addEventListener('input',function(){
      if(!el.isContentEditable) return;
      if(el.classList.contains('an-ul')) return;
      var t=el.textContent||'';
      var m=/^\s*([-*\u2022]|1[.)])\s$/.exec(t);
      if(!m) return;
      var s3=pres.slides[cur],a3=s3&&annotByIdx(s3,idx);
      if(!a3||a3.k!=='text') return;
      var kind=/^1/.test(m[1])?'number':'bullet';
      el.textContent='';
      a3.text='';delete a3.html;
      setListStyle(a3,kind);
      markDirty();
      var l3=stage.querySelector('.annot-layer');
      if(!l3) return;
      renderAnnots(l3,s3);selectAnnot(l3,idx);
      /* put the caret back in the first bullet so typing carries on */
      var ne=l3.querySelector('.an-item[data-idx="'+idx+'"] .an-tx');
      if(ne&&ne._beginEdit){
        ne._beginEdit();
        try{
          var li=ne.querySelector('li')||ne;
          var r3=document.createRange();r3.selectNodeContents(li);
          r3.collapse(true);
          var sel3=window.getSelection();
          sel3.removeAllRanges();sel3.addRange(r3);
        }catch(err){}
      }
      toast(kind==='number'?'Numbered list \u2014 Tab indents'
        :'Bullet list \u2014 Tab indents, Shift+Tab goes back');
    });
    /* Tab makes a SUB-BULLET, the way it does in every outliner and in
       PowerPoint — not a jump to the next control. Only inside a list:
       in a plain text box Tab still has nothing useful to do and is left
       alone. execCommand builds the nested <ul>/<ol>, which is exactly
       the structure the model now keeps (RICH_TAGS allows ul/ol/li). */
    el.addEventListener('keydown',function(e){
      if(!el.isContentEditable) return;
      if(e.key==='Tab'&&el.classList.contains('an-ul')){
        e.preventDefault();e.stopPropagation();
        try{document.execCommand(e.shiftKey?'outdent':'indent',
          false,null);}catch(err){}
        return;
      }
      /* while typing, the deck's own single-letter shortcuts (R, G, …)
         must not fire — they would arm a tool mid-sentence */
      e.stopPropagation();
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
    var ends=arrowEnds(layer,s,a,i);
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
    var lrA=layer.getBoundingClientRect();
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
    svg.appendChild(hit);
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
  function redrawArrows(layer,s){
    if(!layer||!layer.isConnected||!s) return;
    var svg=layer.querySelector('svg:not(.an-svgtop)');
    var svgTop=layer.querySelector('svg.an-svgtop');
    if(!svg||!svgTop) return;
    var defs=svgTop.querySelector('defs');
    if(!defs){defs=document.createElementNS(AN_NS,'defs');
      svgTop.insertBefore(defs,svgTop.firstChild);}
    $$('.an-arrow-line,.an-endpt',layer).forEach(function(n){n.remove();});
    $$('.an-arrow-hit',svg).forEach(function(n){n.remove();});
    $$('marker',defs).forEach(function(n){n.remove();});
    var editing=(mode==='edit');
    (s.annots||[]).forEach(function(a,i){
      if(!a||a.k!=='arrow') return;
      if(a.hide&&editing) return;
      if(a.priv&&!privShown()) return;      /* T31 */
      drawArrow(layer,s,a,i,svg,svgTop,defs,editing);
    });
    markPrivateItems(layer,s);
    if(editing) paintSel(layer);
  }
  /* several figures on a slide all settle within a frame or two of each
     other, so coalesce their redraw requests into one */
  var arrowRedrawT=null;
  function scheduleArrowRedraw(layer){
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
  function drawTable(layer,s,a,i,editing){
    tableNormalise(a);
    var rows=tableRows(a),cols=tableCols(a);
    var host=document.createElement('div');
    host.className='an-item an-table'+(selAnnot===i?' sel':'')
      +(a.grid===0?' nogrid':'');
    var ap0=anchorPos(a,a.w,a.h);
    host.style.left=ap0.x+'%';host.style.top=ap0.y+'%';
    host.style.width=(a.w||40)+'%';host.style.height=(a.h||20)+'%';
    host.style.fontSize=fontPx(layer,a.size||2.2);
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
    /* an even share each, as a HINT: a browser treats a row height as a
       minimum, so short rows sit on the grid the box was drawn to and a
       long one still grows rather than clipping its own words */
    var rowPct=(100/rows.length).toFixed(4)+'%';
    rows.forEach(function(row,ri){
      var tr=document.createElement('tr');
      tr.style.height=rowPct;
      if(a.thead&&ri===0) tr.className='an-tbl-head';
      row.forEach(function(val,ci){
        var td=document.createElement(
          (a.thead&&ri===0)?'th':'td');
        td.textContent=val==null?'':String(val);
        if(a.align) td.style.textAlign=a.align;
        if(editing){
          td.dataset.r=ri;td.dataset.c=ci;
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
    layer.appendChild(host);
  }
  /* type into ONE cell. contenteditable on the <td> itself, so the caret,
     selection and spellcheck all behave the way they do in a text box. */
  function startTableEdit(layer,s,a,idx,td,ri,ci){
    if(lockedAll(a)) return;
    td.contentEditable='plaintext-only';
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
    /* a table cell is a text edit too, and had the same blur-only commit */
    td.__jvFlush=function(){writeCell();markDirty(true);};
    var cellT=null;
    td.addEventListener('input',function(){
      clearTimeout(cellT);
      cellT=setTimeout(function(){writeCell();markDirty(true);},900);
    });
    function commit(){
      clearTimeout(cellT);
      delete td.__jvFlush;
      writeCell();
      td.contentEditable='false';
      markDirty();
    }
    td.addEventListener('blur',commit,{once:true});
    td.addEventListener('keydown',function(e){
      e.stopPropagation();
      /* Tab along, Enter down - the two moves that make a table usable
         without reaching for the mouse between every cell */
      var nr=ri,nc=ci;
      if(e.key==='Tab'){e.preventDefault();
        nc=ci+(e.shiftKey?-1:1);
        if(nc>=a.rows[ri].length){nc=0;nr=ri+1;}
        else if(nc<0){nc=a.rows[ri].length-1;nr=ri-1;}
      } else if(e.key==='Enter'){e.preventDefault();
        nr=ri+(e.shiftKey?-1:1);
      } else if(e.key==='Escape'){e.preventDefault();td.blur();return;}
      else return;
      commit();
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
  function tableGrow(a,what,by){
    tableNormalise(a);
    var rows=a.rows,n=(rows[0]||[]).length;
    if(what==='row'){
      if(by>0){
        var blank=[],j;
        for(j=0;j<n;j++) blank.push('');
        rows.push(blank);
      } else if(rows.length>1) rows.pop();
    } else {
      if(by>0) rows.forEach(function(r){r.push('');});
      else if(n>1) rows.forEach(function(r){r.pop();});
      delete a.cols;   /* equal widths again rather than a stale set */
    }
    tableNormalise(a);
  }
  /* the fit pass itself. Called from renderAnnots and from the text
     commit -- see the note at its call site. */
  function fitTexts(layer,s,editing){
    if(!layer||!s) return;
      (s.annots||[]).forEach(function(a,i){
        if(!a||a.k!=='text'||!a.fh) return;
        if(a.hide&&editing) return;
        var el=layer.querySelector('div.an-item[data-idx="'+i+'"]');
        if(!el) return;
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
  function renderAnnots(layer,s){
    /* the one funnel every slide render passes through, which makes it
       the only place identity has to be minted — see WHAT HAS THIS
       OBJECT LOOKED LIKE. Idempotent, and it re-mints a duplicate, so
       no copy site has to remember to strip one. */
    ensureOids(s);
    var editing=(mode==='edit');
    /* removing a focused node fires no blur in Chrome or Firefox, so
       without this every rebuild — a slide change, a notebook refresh,
       the async embedded-cards arrival — silently threw away whatever
       was being typed (2026-08-22) */
    flushTextEdits();
    layer.innerHTML='';
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
    /* drop the "empty slide" hint once the slide has any content (placement
       only re-renders the layer, not the whole slide, so clear it here) */
    var _host=layer.parentNode;
    if(_host){
      var _eh=_host.querySelector('.slide-emptyhint');
      if(_eh&&(s.annots||[]).length) _eh.remove();
    }
    /* two svg layers: fat invisible hit-lines UNDER the items (so
       frames stay clickable), visible strokes ON TOP of everything
       (click-transparent) so arrows are never hidden behind frames */
    var svg=document.createElementNS(AN_NS,'svg');
    layer.appendChild(svg);
    var svgTop=document.createElementNS(AN_NS,'svg');
    svgTop.setAttribute('class','an-svgtop');
    var defs=document.createElementNS(AN_NS,'defs');
    svgTop.appendChild(defs);

    if(s.layout==='title'){
      ['t','s'].forEach(function(which){
        var p=titleProps(s,which);
        var d=document.createElement('div');
        d.className='an-item an-title'+(which==='t'?' t-main':'')
          +(selAnnot===which?' sel':'');
        d.style.left=p.x+'%';d.style.top=p.y+'%';
        d.style.fontSize=fontPx(layer,p.size);
        if(p.color) d.style.color=tokVal(p.color); /* default lives in CSS */
        if(p.b) d.style.fontWeight='700';
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
        layer.appendChild(d);
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
    var _figMap=(s.annots||[]).some(function(a){
      return a&&a.k==='text'
        &&String(a.text||a.html||'').indexOf('{fig')>=0;
    })?figNumbers():null;
    var _arrows=[];
    (s.annots||[]).forEach(function(a,i){
      /* hidden via the Objects pane: skipped while editing, still
         rendered in playback / print */
      if(a.hide&&editing) return;
      /* ...and the other way round: yours, so NOT rendered in playback,
         print or PowerPoint (T31) */
      if(a.priv&&!privShown()) return;
      if(a.k==='arrow'){_arrows.push(i);return;}
      if(a.k==='rect'){
        var shp=a.shape||'rect';
        var col=tokVal(a.color)||'#ff6b57';
        var r=document.createElement('div');
        var svgShape=!!(SHAPE_PATHS[shp]||SHAPE_GLYPH[shp]);
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
        layer.appendChild(r);
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
        layer.appendChild(dv);
      } else if(a.k==='cell'){
        var c=document.createElement('div');
        var it=a.ref?resolveRef(a.ref):null;
        var locked=!!(a.lockver&&a.lockver.commit);
        var lkCard=locked?verCardFor(a):null;
        c.className='an-item an-cell'+((it||locked)?'':' empty')
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
          pb.style.fontSize=fontPx(layer,1.15);
          pb.textContent=a.ref?('missing: '+a.ref)
            :'Click to add from notebook';
          pb.addEventListener('mousedown',function(e){
            if(tool==='select') e.stopPropagation();});
          pb.addEventListener('click',function(e){
            if(tool!=='select') return;
            e.stopPropagation();startPick(i);});
          c.appendChild(pb);
        }
        if(editing){
          if(cropMode&&selAnnot===i) mkCropHandles(c,layer,s,i);
          else {c.appendChild(mkResize());c.appendChild(mkRotate());}
        }
        layer.appendChild(c);
      } else if(a.k==='text'){
        var d2=document.createElement('div');
        d2.className='an-item an-text'+(a.bg===0?' nobg':'')
          +(selAnnot===i?' sel':'');
        var ap4=anchorPos(a,a.w,a.h);
        d2.style.left=ap4.x+'%';d2.style.top=ap4.y+'%';
        /* the fit multiplier rides on the element as a variable, so
           shrink-to-fit never rewrites a.size (T15) */
        d2.style.fontSize='calc('+fontPx(layer,a.size)
          +' * var(--an-fit,1))';
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
        if(a.w){d2.style.width=a.w+'%';d2.style.maxWidth='none';}
        applyCommon(d2,a);
        d2.setAttribute('data-idx',i);
        
        if(editing){d2.appendChild(mkResize());
          d2.appendChild(mkRotate());}
        /* {fig} RESOLVES AT RENDER, never in the stored words (T18).
           Not while the box is being edited: what you type is what is
           stored, and a caret sitting inside a substituted number would
           be a caret in text that does not exist. */
        var showTx=(editing&&document.activeElement
                    &&d2.contains(document.activeElement))
          ?(a.text||''):figSubst(a.text,a,_figMap);
        var showHtml=a.html?figSubst(a.html,a,_figMap):null;
        var tx2,lst=listOf(a);
        if(lst){
          /* the ELEMENT carries the marker style and a.html carries only
             the items, so switching bullets to numbering rewrites no
             content at all */
          tx2=document.createElement(lst==='number'?'ol':'ul');
          tx2.className='an-tx an-ul an-ul-'+lst;
          if(a.html) tx2.innerHTML=sanitizeRich(showHtml).html;
          else String(a.text||'').split('\n').forEach(function(line){
            var li=document.createElement('li');
            li.textContent=line;
            tx2.appendChild(li);
          });
        } else {
          tx2=document.createElement('span');
          tx2.className='an-tx';
          if(a.html) tx2.innerHTML=sanitizeRich(showHtml).html;
          else tx2.textContent=showTx||'';
        }
        if(editing){
          editableText(layer,tx2,
            function(){return a.text;},
            /* rich BOTH ways now. A list used to be saved as plain lines
               only, so bold inside a bullet — or a sub-level — was thrown
               away the moment the box lost focus. */
            function(v,r){a.text=v;
              if(r&&r.rich) a.html=r.html; else delete a.html;},
            i,true);
        }
        d2.appendChild(tx2);
        layer.appendChild(d2);
        /* Curved text. Drawn as SVG on a bowed baseline, which HTML has no
           way to do — but only when the box is NOT being typed into:
           contenteditable does not work on an SVG <textPath>, so the flat
           version is what you edit and the curve is what you see the rest
           of the time. Measured in px after the box is in the DOM so the
           glyphs are never stretched by a viewBox. */
        if(a.arc&&!listOf(a)&&d2!==document.activeElement
           &&!d2.contains(document.activeElement)){
          /* the box has to be tall enough to hold the arch before it is
             measured — a one-line box has no room to curve in */
          var afs=parseFloat(window.getComputedStyle(tx2).fontSize)||16;
          d2.style.minHeight=
            (afs*(1.25+Math.abs(+a.arc||0)/26))+'px';
          applyTextArc(d2,tx2,a,i);
        }
      } else if(a.k==='table'){
        drawTable(layer,s,a,i,editing);
      } else if(a.k==='image'){
        var im=document.createElement('div');
        im.className='an-item an-image'+(selAnnot===i?' sel':'');
        var ap5=anchorPos(a,a.w,a.h);
        im.style.left=ap5.x+'%';im.style.top=ap5.y+'%';
        im.style.width=(a.w||30)+'%';im.style.height=(a.h||24)+'%';
        applyCommon(im,a);
        im.setAttribute('data-idx',i);
        var img=document.createElement('img');
        img.className='an-imgel';img.src=a.src||'';img.alt='';
        img.draggable=false;
        if(a.crop) im.classList.add('an-cropped');
        applyCrop(img,a);
        im.appendChild(img);
        if(editing){if(cropMode&&selAnnot===i) mkCropHandles(im,layer,s,i);
          else {im.appendChild(mkResize(a.crop
              ?'Drag to resize the crop window'
              :'Drag to resize — the picture keeps its shape. '
                +'Hold Shift to stretch it'));
            im.appendChild(mkRotate());}}
        layer.appendChild(im);
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
        if(!fr.length){
          var fph=document.createElement('div');
          fph.className='an-flipempty';
          fph.textContent=editing
            ?'Empty flip book — use Figures ▾ to add frames'
            :'';
          fst.appendChild(fph);
        } else if(fdef&&fdef.src){
          var fim=document.createElement('img');
          fim.className='an-flipimg';fim.src=fdef.src;fim.alt='';
          fim.draggable=false;
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
        }
        fl.appendChild(fst);
        if(fr.length>1){
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
        layer.appendChild(fl);
      }
    });
    /* ---- WHAT BELONGS TO ANOTHER FRAME --------------------------------
       Done as a pass over the rendered layer rather than inside the loop
       above, the way the build animations are: every kind builds its own
       element, and one predicate applied afterwards cannot be forgotten by
       a branch added later.
       In PLAYBACK an item of another frame is removed. In the EDITOR it is
       dimmed instead and left where it is — you have to be able to see and
       click the caption you are about to tie to frame 4 while you are
       standing on frame 1. */
    (s.annots||[]).forEach(function(a,i){
      if(!a||!a.fb||flipShows(s,a)) return;
      var fel=layer.querySelector('[data-idx="'+i+'"]');
      if(!fel) return;
      if(editing) fel.classList.add('an-fbother');
      else if(fel.parentNode) fel.parentNode.removeChild(fel);
    });
    /* BEFORE the arrows: an attached endpoint is derived from where its
       target sits, and an anchored target has not finished moving until
       anchorFix has measured it */
    if(_anchorFixWanted) anchorFix(layer,s);
    _arrows.forEach(function(i){
      drawArrow(layer,s,(s.annots||[])[i],i,svg,svgTop,defs,editing);
    });
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
    if(slideHasMaths(s)) typeset(layer);
    /* build animations: number the builds in the editor; in playback, hide the
       ones not yet revealed and animate the one just revealed */
    if(s.annots&&s.annots.some(function(a){return a&&a.anim;})){
      var steps=slideBuildSteps(s);
      /* .an-arrow-line is the visible stroke and carries no .an-item
         class (the fat invisible hit path under the items does), so an
         ANIMATED arrow was never hidden before its build and simply sat
         on the slide from the first frame (2026-08-20 audit) */
      $$('.an-item[data-idx],.an-arrow-line[data-idx]',layer).forEach(function(el){
        var raw=el.getAttribute('data-idx');
        if(raw==='t'||raw==='s') return;
        var bi=+raw,ba=(s.annots||[])[bi];
        if(!ba||!ba.anim) return;
        var st=steps.map[ba.anim.order||0];   /* which build step (0-based) */
        if(st==null) return;
        if(editing){
          var bd=document.createElement('span');
          bd.className='an-buildno';bd.textContent=(st+1);
          bd.title='Build '+(st+1)+' — '+(ba.anim.type||'fade')
            +' (items on the same build appear together)';
          el.appendChild(bd);
        } else if(mode==='view'){
          if(st>=revealCount) el.classList.add('an-prebuild');
          else if(st===revealCount-1){
            var atype=ba.anim.type||'fade';
            /* "appear" is instant (no keyframe); rise/zoom animate transform,
               which would fight a rotation and snap — a rotated item fades */
            if(ba.rot&&(atype==='rise'||atype==='zoom')) atype='fade';
            if(atype!=='appear') el.classList.add('an-anim-'+atype);
          }
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
    fitTexts(layer,s,editing);
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
  }
  function selectAnnot(layer,idx,additive){
    if(cropMode&&idx!==selAnnot) cropMode=false;
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
    showFmt();
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
