
(function(){
  'use strict';
  var $=function(s,r){return (r||document).querySelector(s);};
  var $$=function(s,r){return Array.prototype.slice.call((r||document).querySelectorAll(s));};
  /* the chrome icon set. window.SemIcons is stamped into the page by
     branding.py (key -> the same <svg class="bic"> markup the template
     tokens expand to), so DOM built here wears the artwork the page
     already wears — no path data lives in this file. Soft on absence:
     a page without the map gets ''-icons, never a dead script. */
  var bic=function(k){return (window.SemIcons||{})[k]||'';};

  /* ================= app state ================= */
  var APP={mode:'static',token:'',root:'',project:{presentations:[],recent:[]}};
  var appEl=document.getElementById('app-data');
  if(appEl){try{APP=JSON.parse(appEl.textContent);}catch(e){}}
  APP.project=APP.project||{presentations:[],recent:[]};
  APP.shells={};          /* stem -> {el, data, path, title} */
  APP.order=[];           /* NOTEBOOK stems in tab order (deck/ref-facing) */
  APP.traces=[];          /* Plot-trace tab keys — kept OUT of APP.order so
                             the deck, refs + naming stay notebook-only */
  APP.active=null;
  window.SemApp=APP;
  /* every tab shown in the strip: notebooks first, then their trace tabs */
  function tabList(){return APP.order.concat(APP.traces);}

  function api(path,body){
    var url=path+(path.indexOf('?')<0?'?':'&')
      +'t='+encodeURIComponent(APP.token||'');
    var opt=body===undefined?{method:'GET'}
      :{method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify(body)};
    return fetch(url,opt).then(function(r){
      return r.json().catch(function(){throw new Error('HTTP '+r.status);})
        .then(function(j){
          if(!r.ok||(j&&j.error)){
            var err=new Error((j&&j.error)||('HTTP '+r.status));
            /* carry the STATUS and the BODY. A 409 from /api/save hands
               back the revision and presentations actually on disk so the
               caller can merge rather than guess, and that was being
               thrown away with everything but the message (2026-08-22). */
            err.status=r.status;err.data=j;
            throw err;
          }
          return j;
        });
    });
  }
  APP.api=api;

  /* ================= tab strip ================= */
  var tabstrip=$('#tabstrip'), openBtn=$('#tab-open');
  /* HOME IS A PLACE, not just the state of having nothing open. The
     wordmark is a home button now (2026-08-21, user: "clicking the
     Junoview logo should take you back to that screen"), so the welcome
     has to be reachable with notebooks still loaded — and once it can be,
     it needs a way out, which is #welcome-back. Nothing is closed either
     way: this only decides what is on top. */
  var atHome=false;
  function goHome(on){
    atHome=!!on&&(APP.mode==='app'||APP.mode==='web');
    /* a presentation is drawn over everything, so Home means leaving it */
    if(atHome&&APP.deckState&&APP.deckState()&&APP.deckClose) APP.deckClose();
    refreshChrome();
    if(atHome) window.scrollTo(0,0);
  }
  APP.goHome=goHome;
  function refreshChrome(){
    var canOpen=APP.mode==='app'||APP.mode==='web';
    if(openBtn) openBtn.hidden=!canOpen;
    var wel=$('#welcome');
    /* an open presentation owns the window even with no notebook behind
       it — a self-contained deck is a document in its own right */
    var deckOn=!!(APP.deckState&&APP.deckState());
    var welcoming=canOpen&&!deckOn&&(!APP.order.length||atHome);
    if(wel) wel.hidden=!welcoming;
    /* With nothing open there is nothing for the ribbon to act on: every
       filter, size and view control is inert, and Open is already on the
       welcome screen itself. Hiding it lets the welcome own the window. */
    document.body.classList.toggle('welcoming',welcoming);
    var back=$('#welcome-back');
    if(back) back.hidden=!(welcoming&&APP.order.length);
    var demo=$('#welcome-demo');
    if(demo) demo.hidden=(APP.mode!=='web');
    renderRecent();
    renderWelcomePres();
  }
  APP.refreshChrome=refreshChrome;
  (function(){
    var home=$('#presrail-home');
    if(home) home.addEventListener('click',function(){goHome(true);});
    var back=$('#welcome-back');
    if(back) back.addEventListener('click',function(){goHome(false);});
  })();
  /* ---- the tab's Version-history menu: automatic snapshots per
     open/reload */
  var versMenu=null;
  function closeVersMenu(){if(versMenu){versMenu.remove();versMenu=null;}}
  document.addEventListener('click',function(e){
    if(versMenu&&!versMenu.contains(e.target)) closeVersMenu();});
  function showVersMenu(btn,stem){
    /* the history button TOGGLES its own menu (no reopen flicker) */
    if(versMenu&&versMenu.dataset.stem===stem){closeVersMenu();return;}
    closeVersMenu();
    var sh=APP.shells[stem]; if(!sh||!sh.path) return;
    var m=document.createElement('div');
    m.className='ckfilter-menu vers-menu';
    m.dataset.stem=stem;
    var r=btn.getBoundingClientRect();
    m.style.top=(r.bottom+6)+'px';
    m.style.left=Math.max(6,
      Math.min(r.left,window.innerWidth-340))+'px';
    m.innerHTML='<div class="ckf-h">notebook versions</div>'
      +'<div class="ckf-empty vers-load">loading…</div>';
    document.body.appendChild(m);versMenu=m;
    api('/api/versions',{path:sh.path}).then(function(j){
      if(versMenu!==m) return;
      var ld=m.querySelector('.vers-load'); if(ld) ld.remove();
      function row(label,cur,fn,sub){
        var b=document.createElement('button');
        b.className='vers-row'+(cur?' on':'');b.type='button';
        var l1=document.createElement('span');l1.className='vers-l';
        l1.textContent=label;b.appendChild(l1);
        if(sub){
          var l2=document.createElement('span');l2.className='vers-sub';
          l2.textContent=sub;b.appendChild(l2);
        }
        b.title=label+(sub?'\n'+sub:'');
        b.addEventListener('click',function(e2){
          e2.stopPropagation();closeVersMenu();fn();});
        m.appendChild(b);
      }
      function openVer(req,toastMsg){
        api('/api/openversion',req).then(function(o){
          mountShellHTML(o.shell,o.path);
          var s2=APP.shells[o.stem];
          if(s2){
            s2.version=o.version;
            /* a version view is READ-ONLY: no add-note pencils (they
               would write into the LIVE file from an old anchor map) */
            $$('.card-addnote',s2.el).forEach(function(n){n.remove();});
            renderTabs();
          }
          /* prose stays WORDS — reload / Version history are button
             names, and glyphs inline in a sentence are what the icon
             sweep removed (2026-08-23) */
          docToast(toastMsg+' — reload, or the Version history menu, '
            +'returns to live');
        }).catch(function(err){
          alert('Open failed: '+err.message);});
      }
      row('● Live — the file on disk',!sh.version,function(){
        openPath(sh.path);});
      /* the notebook's GIT history: hash + message per commit */
      var commits=j.commits||[];
      if(commits.length){
        var h1=document.createElement('div');h1.className='ckf-h';
        h1.textContent='git commits';m.appendChild(h1);
        commits.forEach(function(cm){
          row(cm.id+' · '+cm.msg,sh.version==='git:'+cm.id,function(){
            openVer({path:sh.path,commit:cm.id},
              'Viewing commit '+cm.id+' “'+cm.msg+'”');
          },cm.date);
        });
      }
      if((j.versions||[]).length){
        var h2=document.createElement('div');h2.className='ckf-h';
        h2.textContent='auto snapshots';m.appendChild(h2);
      }
      (j.versions||[]).forEach(function(v){
        row(v.label,sh.version===v.id,function(){
          openVer({path:sh.path,id:v.id},
            'Viewing the snapshot from '+v.label);
        });
      });
      if(!(j.versions||[]).length&&!commits.length){
        var d=document.createElement('div');d.className='ckf-empty';
        d.textContent='No history yet — a snapshot is kept every time '
          +'this notebook is opened or refreshed, and git commits show '
          +'here when the notebook is in a repository.';
        m.appendChild(d);
      }
    }).catch(function(err){
      if(versMenu===m)
        m.innerHTML='<div class="ckf-empty">'
          +String((err&&err.message)||err)+'</div>';
    });
  }
  function makeTab(stem){
    var sh=APP.shells[stem]; if(!sh) return null;
    var t=document.createElement('div');
    t.className='tab'+(stem===APP.active?' current':'')
      +(sh.trace?' tab-trace tab-sub':'');
    t.setAttribute('role','tab');
    t.title=sh.trace?('Plot trace — '+(sh.title||'')
        +'  ·  a sub-tab of '+(sh.source||''))
      :(sh.path||sh.title||stem);
    var lbl=document.createElement('span');lbl.className='tab-t';
    if(sh.trace){
      /* the ↳ hook reads as "nested under the tab before me" */
      var ic=document.createElement('span');ic.className='tab-trace-ic';
      ic.textContent='↳';
      t.appendChild(ic);
      lbl.textContent=sh.title||'Plot trace';
    } else {
      /* a tab opened AT A COMMIT keeps the notebook's name and wears the
         short hash underneath — "draft_01-2" told you nothing */
      lbl.textContent=sh.label||stem;
      if(sh.version){
        lbl.classList.add('tab-t-ver');
        var vs=document.createElement('span');
        vs.className='tab-ver';
        vs.textContent=/^git:/.test(sh.version)
          ?sh.version.slice(4):'earlier version';
        vs.title='This tab is showing an earlier version';
        lbl.appendChild(vs);
      }
    }
    t.appendChild(lbl);
    /* a trace sub-tab is always closeable (in every mode); notebook tabs get
       reload+close only in the modes that can reopen them */
    if(sh.trace){
      var xc=document.createElement('button');xc.className='tab-b';
      xc.innerHTML=bic('exit')||'&#10005;';xc.title='Close trace';
      xc.setAttribute('aria-label','Close trace');
      xc.addEventListener('click',function(e){e.stopPropagation();
        closeNotebook(stem);});
      t.appendChild(xc);
    } else if(APP.mode==='app'||APP.mode==='web'){
      if(sh.version){
        var vm=document.createElement('span');vm.className='tab-vermark';
        vm.innerHTML=bic('history');
        vm.title='Viewing an earlier version — reload, or the Version '
          +'history menu, returns to live';
        t.insertBefore(vm,lbl);
      }
      /* reload + versions used to hide on the tab, where nobody found
         them; they live in the sidebar's File info block now */
      var x=document.createElement('button');x.className='tab-b';
      x.innerHTML=bic('exit')||'&#10005;';x.title='Close tab';
      x.setAttribute('aria-label','Close tab');
      x.addEventListener('click',function(e){e.stopPropagation();
        closeNotebook(stem);});
      t.appendChild(x);
    }
    t.addEventListener('click',function(){activate(stem);});
    return t;
  }
  /* ---- THE RAIL FILTER (T75) -------------------------------------
     Applied to the DOM after each render rather than folded into the two
     renderers: renderTabs lives here and renderPresTabs lives in the
     deck's own IIFE, so a filter each would be two implementations of
     one rule -- and they would disagree about the empty state, which is
     the only interesting part. Rows are hidden, never removed, so
     clearing the field costs no re-render and nothing loses its
     handlers. A label whose whole list is filtered away goes with it,
     the same rule #pr-nblabel already follows when nothing is open. */
  function railFilter(){
    var f=$('#rail-find');
    var q=f?String(f.value||'').trim().toLowerCase():'';
    var x=$('#rail-find-x');
    if(x) x.hidden=!q;
    var shown=0,total=0;
    ['#tabstrip','#presstrip'].forEach(function(sel){
      var strip=$(sel); if(!strip) return;
      var any=false;
      [].forEach.call(strip.children,function(row){
        /* a folder is a heading over its own rows: it survives if its
           NAME matches or if anything inside it did */
        var name=(row.textContent||'').toLowerCase();
        var hit=!q||name.indexOf(q)>=0;
        total++;
        row.classList.toggle('pr-filtered',!hit);
        if(hit){any=true;shown++;}
      });
      strip.classList.toggle('pr-filtering',!!q);
    });
    var nbl=$('#pr-nblabel');
    if(nbl){
      var ts=$('#tabstrip');
      nbl.hidden=!ts||![].some.call(ts.children,function(r){
        return !r.classList.contains('pr-filtered');});
    }
    var none=$('#pr-find-none');
    if(none) none.hidden=!(q&&total&&!shown);
  }
  window.SemApp=window.SemApp||{};
  window.SemApp.railFilter=railFilter;
  (function(){
    var f=$('#rail-find'); if(!f) return;
    f.addEventListener('input',railFilter);
    f.addEventListener('keydown',function(e){
      /* the field owns its own keys: the document handler bails inside an
         input, but Escape has to mean "clear" here rather than nothing */
      if(e.key==='Escape'){
        e.preventDefault();e.stopPropagation();
        if(f.value){f.value='';railFilter();}
        else f.blur();
      }
    });
    var x=$('#rail-find-x');
    if(x) x.addEventListener('click',function(){
      f.value='';railFilter();f.focus();});
    /* Ctrl+K from anywhere. NOT through APP_KEYS: that table clicks its
       element, which does nothing to an input, and it stands down while
       a deck is open -- but the rail is on screen the whole time and
       jumping to another notebook mid-edit is exactly when you want it. */
    document.addEventListener('keydown',function(e){
      if(e.defaultPrevented||e.altKey||e.shiftKey) return;
      if(!(e.ctrlKey||e.metaKey)) return;
      if(String(e.key).toLowerCase()!=='k') return;
      if(document.body.classList.contains('doc-presenting')) return;
      e.preventDefault();
      f.focus();f.select();
    });
  })();
  function renderTabs(){
    if(!tabstrip){refreshChrome();return;}
    tabstrip.innerHTML='';
    /* each notebook is followed inline by its own Plot-trace sub-tabs, so a
       trace reads as a child of the notebook it was opened from */
    APP.order.forEach(function(stem){
      var nb=makeTab(stem); if(nb) tabstrip.appendChild(nb);
      APP.traces.forEach(function(k){
        if(APP.shells[k]&&APP.shells[k].source===stem){
          var st=makeTab(k); if(st) tabstrip.appendChild(st);
        }
      });
    });
    /* defensive: a trace whose source is gone still gets a tab (at the end) */
    APP.traces.forEach(function(k){
      var sh=APP.shells[k];
      if(sh&&APP.order.indexOf(sh.source)<0){
        var st=makeTab(k); if(st) tabstrip.appendChild(st);
      }
    });
    /* the strip lives in the rail now, under a heading of its own — and a
       heading over an empty list is a heading promising something that is
       not there (2026-08-20) */
    var nbl=$('#pr-nblabel');
    if(nbl) nbl.hidden=!tabstrip.childNodes.length;
    railFilter();   /* a rebuilt strip arrives unfiltered (T75) */
    renderRailNbs();
    refreshChrome();
  }
  /* ---- the same list, inside each notebook's own sidebar -------------
     The presentations rail already lists open notebooks, but it
     collapses and auto-hides, and with it away nothing on screen said a
     second notebook was open (2026-08-21, user: "the sidebar doesn't
     show notebooks that are open"). Every shell carries its own copy
     because the rail is part of the shell; only the active one is
     visible, so the cost is a handful of rows. */
  function renderRailNbs(){
    var list=tabList();
    /* nothing to switch to and nothing to open: a list of one, with no
       way to make it two, is a heading over a fact you already know */
    var useful=list.length>1||APP.mode==='app'||APP.mode==='web';
    $$('.railnbs').forEach(function(host){
      host.innerHTML='';
      host.hidden=!useful;
      if(!useful) return;
      var h=document.createElement('div');h.className='railnbs-h';
      h.textContent='open notebooks';host.appendChild(h);
      list.forEach(function(stem){
        var sh=APP.shells[stem]; if(!sh) return;
        var on=(stem===APP.active);
        var b=document.createElement('button');
        b.type='button';
        b.className='rnb'+(on?' on':'')+(sh.trace?' trace':'');
        b.title=sh.trace
          ?('Plot trace — a sub-tab of '+(sh.source||''))
          :(sh.path||stem);
        var d=document.createElement('span');d.className='rnb-dot';
        b.appendChild(d);
        var nm=document.createElement('span');nm.className='rnb-nm';
        nm.textContent=sh.trace?('↳ '+(sh.title||'Plot trace'))
          :(sh.label||stem);
        b.appendChild(nm);
        if(!on) b.addEventListener('click',function(){activate(stem);});
        if(sh.trace||APP.mode==='app'||APP.mode==='web'){
          var x=document.createElement('span');x.className='rnb-x';
          x.setAttribute('role','button');
          x.innerHTML=bic('exit')||'&#10005;';
          x.title=sh.trace?'Close this trace':'Close this notebook';
          x.setAttribute('aria-label',x.title);
          x.addEventListener('click',function(e){
            e.stopPropagation();closeNotebook(stem);});
          b.appendChild(x);
        }
        host.appendChild(b);
      });
      if(APP.mode==='app'||APP.mode==='web'){
        var add=document.createElement('button');
        add.type='button';add.className='railnbs-add';
        add.textContent='+ Open another notebook…';
        add.addEventListener('click',function(){
          var ob=$('#tab-open'); if(ob) ob.click();});
        host.appendChild(add);
      }
    });
  }
  function activate(stem){
    if(!APP.shells[stem]) return;
    /* looking at a notebook is not being at Home; opening one from the
       welcome has to take you off it */
    atHome=false;
    APP.active=stem;
    tabList().forEach(function(s){APP.shells[s].el.hidden=(s!==stem);});
    renderTabs();
    invalidateSids();   /* the section list belongs to the new tab */
    renderRawBtn();renderViewBtns();relayoutActiveTree();
    /* filters belong to the NOTEBOOK, so the whole filter bar has to be
       rebound to the tab you just switched to — and EVERY open picker
       closed, not just "Apply to": the type menus' rows and counts are
       namespaced to the previous notebook too, and two switch paths skip
       the outside-click closers entirely (the tab ✕ stopPropagates; the
       hash router involves no click at all). A stale menu left open wrote
       the OLD notebook's type overrides into the NEW notebook's state
       (2026-08-04, adversarial review). */
    closeFilterMenus();
    renderTypeButtons();renderScopeBtn();
    updateHash();
    document.dispatchEvent(new CustomEvent('sem:activate',
      {detail:{stem:stem}}));
  }
  APP.activate=activate;

  /* ================= URL routing: a unique hash per view ================
     #/doc/<stem>  a document tab   #/pres/<name>[/s<n>]  a presentation slide.
     Bookmarkable + survives reload + back/forward, in every mode (hash only,
     so no server routing needed). The deck registers deckState/deckOpen. */
  var initialHash=location.hash, routeReady=false, pendingRoute=null,
      routeTimer=null;
  function setHash(h){
    if(location.hash===h||(!location.hash&&h==='#/')) return;
    /* replaceState (not location.hash=) so in-app navigation NEVER floods the
       back stack — the URL always mirrors the view, bookmarkable + reloadable,
       and Back leaves the app cleanly rather than stepping through tab switches */
    try{ if(history.replaceState)
           history.replaceState(null,'',
             location.pathname+location.search+(h==='#/'?'':h));
         else location.hash=h; }catch(e){}
  }
  function routeParse(hash){
    return String(hash||'').replace(/^#\/?/,'').split('/')
      .filter(Boolean).map(function(p){
        try{return decodeURIComponent(p);}catch(e){return p;}});
  }
  function updateHash(){
    if(!routeReady) return;
    var d=APP.deckState&&APP.deckState();
    if(d&&d.name){
      setHash('#/pres/'+encodeURIComponent(d.name)
        +(d.slide!=null?('/s'+(d.slide+1)):''));
      return;
    }
    var a=APP.active&&APP.shells[APP.active];
    var stem=a&&a.trace?a.source:APP.active;   /* a trace tab -> its source */
    setHash(stem?('#/doc/'+encodeURIComponent(stem)):'#/');
  }
  APP.updateHash=updateHash;
  /* idempotent: applying the hash for the view already showing is a no-op,
     so a programmatic setHash -> hashchange never loops or double-renders */
  function applyHash(hash){
    var parts=routeParse(hash);
    if(!parts.length) return;
    if(parts[0]==='pres'&&parts[1]){
      var slide=0;
      if(parts[2]&&/^s\d+$/i.test(parts[2]))
        slide=Math.max(0,parseInt(parts[2].slice(1),10)-1);
      var st=APP.deckState&&APP.deckState();
      if(st&&st.name===parts[1]){
        /* same presentation already open -> just move slide, keeping the
           current mode (don't reopen the editor / drop out of Present) */
        if(st.slide!==slide&&APP.deckGo) APP.deckGo(slide);
        return;
      }
      if(APP.deckOpen&&!APP.deckOpen(parts[1],slide)) updateHash();
    } else if(parts[0]==='doc'&&parts[1]){
      var open=APP.deckState&&APP.deckState();
      var ca=APP.shells[APP.active];
      var curStem=ca&&ca.trace?ca.source:APP.active;   /* symmetric w/ updateHash */
      if(!open&&curStem===parts[1]) return;
      if(open&&APP.deckClose) APP.deckClose();
      if(APP.shells[parts[1]]) activate(parts[1]);
    }
  }
  function tryRoute(){
    if(!pendingRoute) return;
    applyHash(pendingRoute);
    var parts=routeParse(pendingRoute);
    /* presentations open synchronously; a doc route may wait for its tab to
       mount (web mode restores notebooks asynchronously) */
    if(parts[0]!=='doc'||APP.shells[parts[1]]) pendingRoute=null;
  }
  APP.applyInitialRoute=function(){
    routeReady=true;
    var parts=routeParse(initialHash);
    if(parts.length&&(parts[0]==='doc'||parts[0]==='pres'))
      pendingRoute=initialHash;
    tryRoute();
    if(!location.hash) updateHash();   /* stamp the default view */
  };
  /* a tab mounting later (web restore) satisfies a still-pending route; debounce
     so it lands AFTER the restore's own mounting settles, not mid-storm */
  document.addEventListener('sem:shell',function(){
    if(!pendingRoute) return;
    if(routeTimer) clearTimeout(routeTimer);
    routeTimer=setTimeout(function(){
      applyHash(pendingRoute);pendingRoute=null;},250);
  });
  window.addEventListener('hashchange',function(){
    pendingRoute=null;   /* a real navigation supersedes the initial route */
    applyHash(location.hash);
  });

  /* ================= per-notebook document behaviors ================= */
  var scrim=$('#scrim');
  if(scrim) scrim.addEventListener('click',function(){
    $$('.rail.open').forEach(function(r){r.classList.remove('open');});
    scrim.classList.remove('show');
  });

  /* ---- global show/hide filters (top bar; apply to every tab) ----
     one state per ROLE. Markdown / Code / Plots / Output all cycle
     Visible -> Collapsed -> Hidden. The button LABEL shows the current
     state, not the action. */
  /* FILTERS ARE PER SECTION. `FDEF` is the notebook-wide default; a section
     the user has filtered differently gets its own state in `secF` (keyed
     stem::section so two notebooks never share one). Everything reads
     stateFor(); the appbar edits whichever sections "Apply to" selects. */
  /* a Plot-trace tab opens UNFILTERED — it is a fresh reading of the cells
     behind one figure, so the document's hidden code must not follow it
     (and its code shows, since the code is the point of a trace) */
  function newF(trace){
    return {md:'visible',code:trace?'visible':'collapsed',
      plot:'visible',out:'visible',ck:{},ot:{},pt:{}};
  }
  /* EVERYTHING here is per notebook: the default, the per-section
     overrides and the "Apply to" pick. One notebook's filters must never
     reach into another open tab. */
  var defBy={},secF={};
  function FDEFof(stem){
    var k=String(stem||'');
    if(!defBy[k]){
      var sh=APP.shells&&APP.shells[k];
      defBy[k]=newF(!!(sh&&sh.trace));
    }
    return defBy[k];
  }
  /* copy one notebook's filters onto another. `withOverrides` carries the
     per-section tweaks too — right for a trace (its cards keep the source's
     section ids), wrong across notebooks (their section ids differ). */
  function copyFiltersTo(destStem,srcStem,withOverrides){
    var s=String(srcStem),d=String(destStem);
    if(s===d) return;
    defBy[d]=cloneF(FDEFof(s));
    var dpre=d+'::',spre=s+'::',k;
    for(k in secF){if(k.indexOf(dpre)===0) delete secF[k];}
    for(k in secScope){if(k.indexOf(dpre)===0) delete secScope[k];}
    delete scopeSeeded[d];
    if(withOverrides){
      for(k in secF){
        if(k.indexOf(spre)===0)
          secF[dpre+k.slice(spre.length)]=cloneF(secF[k]);
      }
    }
  }
  function copyMap(o){
    var r={};for(var k in o){if(o[k]) r[k]=o[k];}return r;
  }
  function cloneF(s){
    return {md:s.md,code:s.code,plot:s.plot,out:s.out,
      ck:copyMap(s.ck),ot:copyMap(s.ot),pt:copyMap(s.pt)};
  }
  function fkey(stem,sid){return String(stem||'')+'::'+String(sid||'');}
  /* which section a CARD belongs to. data-secid travels with the node, so
     clones (tree view, plot-trace) keep obeying their source section. */
  function secIdOf(card){
    if(!card) return '';
    if(card.dataset&&card.dataset.secid) return card.dataset.secid;
    var s=card.closest?card.closest('.section'):null;
    return (s&&s.dataset.sec)||'';
  }
  function stateFor(stem,sid){
    return secF[fkey(stem,sid)]||FDEFof(stem);
  }
  var CODE_CYCLE=['visible','collapsed','hidden'];
  /* short enough that every state fits one fixed slot, so the button —
     and everything to the right of it — never moves */
  var CODE_LABEL={visible:'On',collapsed:'Fold',hidden:'Off',
    mixed:'Mix'};
  /* a per-type OUTPUT override is 'visible' | 'collapsed' | 'hidden';
     absent = the type follows the overall Output filter. Saved layouts
     from before the tri-state stored 1 for "hidden" — read that as
     'hidden' forever, old states must keep meaning what they meant. */
  function otVal(v){
    if(v==='visible'||v==='collapsed'||v==='hidden') return v;
    return v?'hidden':null;
  }
  /* ot-* classes that are STATE, not type — the type regex must skip them */
  var OT_STATE_CLASSES=['off','fold','open','stub'];
  /* when two explicit per-type states apply to one frame (its library
     AND its titled/untitled label), the more restrictive one wins */
  var ST_RANK={visible:0,collapsed:1,hidden:2};
  function stricterState(a,b){return ST_RANK[b]>ST_RANK[a]?b:a;}
  var CK_TYPES=['imports','function','data','settings',
    'plotting','print','comments','constant','code'];
  /* ---- "Apply to": which sections the filters act on. Empty = the whole
     notebook (every section). Ticking sections narrows the filters to
     them, so one chapter can hide its code while the next keeps it. ---- */
  /* The selection is just a SET of highlighted sections — no modes. A
     notebook starts with everything selected (so filters act on all of
     it), and "Select all" puts it back. */
  var secScope={},scopeSeeded={};
  /* a notebook starts with every section selected. The flag matters:
     "the user deselected everything" and "not set up yet" are both an
     empty set, and only the second should be filled in. */
  function seedScope(){
    var stem=String(activeStem()),ids=allSids();
    if(scopeSeeded[stem]||!ids.length) return;
    scopeSeeded[stem]=1;
    ids.forEach(function(id){secScope[fkey(stem,id)]=1;});
  }
  function scopeAll(){
    var ids=allSids();
    if(!ids.length) return true;
    var stem=activeStem();
    return ids.every(function(id){return !!secScope[fkey(stem,id)];});
  }
  function scopeCount(){return targetSids().length;}
  function renderScopeBtn(){
    var b=$('#sec-scope-btn'); if(!b) return;
    seedScope();
    var n=scopeCount(),tot=allSids().length;
    var lab=(!tot||n===tot)?'All'
      :(n?(n+' of '+tot):'none');
    /* write the LABEL, not innerHTML — innerHTML= wiped the scope icon
       (and the .btxt span the ribbon compaction stages hide) */
    setBtnText(b,'Sections: '+lab+' ▾');
    b.classList.toggle('on',!!tot&&n!==tot);
  }
  /* ---- which sections the appbar is currently EDITING, and how to read
     and write their filter state ------------------------------------- */
  function activeStem(){return APP.active||'';}
  /* the section list is asked for many times per filter change (every
     readF, countF and anyType goes through it), so it is memoised per
     notebook and dropped whenever a shell is mounted or swapped */
  var sidMemo=null,sidMemoFor=null;
  function invalidateSids(){sidMemo=null;sidMemoFor=null;}
  APP.invalidateSids=invalidateSids;
  function allSids(){
    var sh=APP.active&&APP.shells[APP.active];
    if(!sh) return [];
    if(sidMemoFor===APP.active&&sidMemo) return sidMemo;
    /* a Plot-trace tab builds bare <section> wrappers with no data-sec —
       they are not real notebook sections and must not become rows */
    sidMemo=$$('.section',sh.el).map(function(s){return s.dataset.sec;})
      .filter(Boolean);
    sidMemoFor=APP.active;
    return sidMemo;
  }
  function targetSids(){
    /* seed here, not only in the button renderer: a freshly activated
       notebook must already read as "all sections" the first time any
       filter asks, or the whole bar renders itself disabled */
    seedScope();
    var stem=activeStem();
    return allSids().filter(function(id){
      return !!secScope[fkey(stem,id)];});
  }
  /* the value of one filter across the selection — 'mixed' when they
     disagree, so the button never lies about a heterogeneous selection */
  function readF(key){
    var stem=activeStem(),ids=targetSids();
    if(!ids.length) return FDEFof(stem)[key];
    var first=stateFor(stem,ids[0])[key],same=true;
    ids.forEach(function(id){
      if(stateFor(stem,id)[key]!==first) same=false;});
    return same?first:'mixed';
  }
  /* how many of the selected sections hide this code/output/plot type */
  function countF(map,type){
    var stem=activeStem(),ids=targetSids(),n=0;
    if(!ids.length) return FDEFof(stem)[map][type]?1:0;
    ids.forEach(function(id){
      if(stateFor(stem,id)[map][type]) n++;});
    return n;
  }
  function targetCount(){
    var n=targetSids().length;
    return n||1;
  }
  /* apply a change to the selection. "Entire notebook" also rewrites the
     existing per-section overrides for THAT property, so the notebook
     really does become uniform without losing a section's other choices */
  function writeF(fn){
    var stem=activeStem(),ids=targetSids();
    if(scopeAll()){
      fn(FDEFof(stem));
      ids.forEach(function(id){
        var o=secF[fkey(stem,id)];
        if(o) fn(o);
      });
    } else {
      ids.forEach(function(id){
        var k=fkey(stem,id);
        if(!secF[k]) secF[k]=cloneF(FDEFof(stem));
        fn(secF[k]);
      });
    }
    pruneF(stem);
    markSecOverrides();
  }
  function sameMap(x,y){
    var kx=Object.keys(x);
    if(kx.length!==Object.keys(y).length) return false;
    /* VALUES matter now, not just key presence: the ot map holds
       tri-states, and {dataset:'hidden'} !== {dataset:'collapsed'}.
       otVal normalises so a legacy 1 still equals 'hidden'. */
    for(var i=0;i<kx.length;i++){
      if(otVal(x[kx[i]])!==otVal(y[kx[i]])) return false;}
    return true;
  }
  function sameF(a,b){
    return a.md===b.md&&a.code===b.code&&a.plot===b.plot&&a.out===b.out
      &&sameMap(a.ck,b.ck)&&sameMap(a.ot,b.ot)&&sameMap(a.pt,b.pt);
  }
  /* an override that has drifted back to its notebook's default is NOT an
     override — drop it, else the section keeps a "· filtered" badge that
     lies. Scoped to ONE notebook: another tab's overrides are compared
     against a different default and must not be touched. */
  function pruneF(stem){
    var pre=String(stem||'')+'::';
    for(var k in secF){
      if(k.indexOf(pre)!==0) continue;
      if(secF[k]&&sameF(secF[k],FDEFof(stem))) delete secF[k];
    }
  }
  /* a section filtered differently from the rest says so in its header */
  function markSecOverrides(){
    $$('.nbshell').forEach(function(sh){
      var stem=sh.dataset.nb;
      $$('.section',sh).forEach(function(s){
        s.classList.toggle('has-fover',
          !!secF[fkey(stem,s.dataset.sec)]);
      });
    });
  }
  /* Reset clears THIS notebook: its default, its per-section overrides and
     its "Apply to" pick. Other open tabs keep their own filters. */
  function resetFilters(){
    var stem=String(activeStem()),pre=stem+'::';
    var sh=APP.shells&&APP.shells[stem];
    defBy[stem]=newF(!!(sh&&sh.trace));
    [secF,secScope,scopeOpen].forEach(function(m){
      for(var k in m){if(k.indexOf(pre)===0) delete m[k];}
    });
    delete scopeSeeded[stem];
    seedScope();          /* back to "All sections" */
    markSecOverrides();renderScopeBtn();
    var m=$('#sec-scope-menu');
    if(m&&!m.hidden) renderScopeMenu();   /* an open picker must not lie */
    applyFilters();applyCodeState();
  }
  var scopeOpen={};   /* which parent rows are expanded in the picker */
  function scopeTree(){
    /* the section list as a tree: each node knows the ids of its whole
       subtree (the deeper sections that follow it) */
    var sh=APP.active&&APP.shells[APP.active];
    var rows=sh?$$('.section',sh.el):[];
    var stem=activeStem();
    return rows.map(function(s,i){
      var lv=+(s.dataset.level||2),kids=[];
      for(var j=i+1;j<rows.length;j++){
        if(+(rows[j].dataset.level||2)<=lv) break;
        kids.push(fkey(stem,rows[j].dataset.sec));
      }
      var t=s.querySelector('.sectionhead h2');
      var eb=s.querySelector('.sectionhead .eyebrow');
      return {id:fkey(stem,s.dataset.sec),lv:lv,kids:kids,
        num:eb?(eb.textContent||'').replace(/^section\s*/i,'').trim():'',
        title:(t&&t.textContent)||s.dataset.sec};
    });
  }
  function renderScopeMenu(){
    var m=$('#sec-scope-menu'); if(!m) return;
    m.innerHTML='';
    var nodes=scopeTree();
    var h=document.createElement('div');h.className='ckf-h';
    h.textContent='apply the filters to';m.appendChild(h);
    /* one button, one meaning, one label — always "Select all" */
    var all=document.createElement('button');
    all.className='ckf-all';
    all.textContent='Select all';
    all.addEventListener('click',function(e){
      e.stopPropagation();
      nodes.forEach(function(n){secScope[n.id]=1;});
      renderScopeMenu();renderScopeBtn();applyFilters();
    });
    m.appendChild(all);
    /* …and, at the foot, send these filters to the other notebooks */
    var many=(APP.order||[]).length>1;
    var cp=document.createElement('button');
    cp.className='ckf-all scope-copy';
    cp.textContent='Copy these filters to all notebooks';
    cp.disabled=!many;
    cp.title=many
      ?'Every other open notebook gets the filters this one is using '
        +'(their own per-section changes are cleared)'
      :'Open a second notebook to copy these filters across';
    cp.addEventListener('click',function(e){
      e.stopPropagation();
      var mm=$('#sec-scope-menu'); if(mm) mm.hidden=true;
      copyFiltersToAll();
    });
    if(!nodes.length){
      var e0=document.createElement('div');e0.className='ckf-empty';
      e0.textContent='No sections in this notebook';
      m.appendChild(e0);m.appendChild(cp);return;
    }
    function on(id){return !!secScope[id];}
    function setSub(n,val){
      /* a heading carries its sub-headings with it */
      if(val) secScope[n.id]=1; else delete secScope[n.id];
      n.kids.forEach(function(k){
        if(val) secScope[k]=1; else delete secScope[k];});
    }
    /* a row is visible only while every ancestor is expanded */
    var hideUnder=null;
    nodes.forEach(function(n,i){
      if(hideUnder!=null&&n.lv<=hideUnder) hideUnder=null;
      var hidden=(hideUnder!=null);
      if(!hidden&&n.kids.length&&!scopeOpen[n.id]) hideUnder=n.lv;
      if(hidden) return;
      var selfOn=on(n.id);
      /* the WHOLE ROW is the selection control (highlighted = selected);
         only the little arrow expands or collapses */
      var part=n.kids.some(function(k){return on(k)!==selfOn;});
      var row=document.createElement('div');
      row.className='ckf-row scope-row scope-l'+n.lv
        +(selfOn?' on':'')+(part?' part':'');
      row.setAttribute('role','button');
      row.tabIndex=0;
      row.title=(selfOn?'Selected':'Not selected')
        +(n.kids.length?' — click to '+(selfOn?'drop':'add')
          +' this heading and the '+n.kids.length+' inside it'
          :' — click to '+(selfOn?'drop':'add')+' this section');
      var tw=document.createElement('span');tw.className='scope-tw';
      if(n.kids.length){
        var ch=document.createElement('button');
        ch.className='scope-chev'+(scopeOpen[n.id]?' open':'');
        ch.type='button';
        ch.innerHTML='&#9656;';
        ch.title=(scopeOpen[n.id]?'Hide':'Show')
          +' the sub-headings under this one';
        ch.addEventListener('click',function(e){
          e.preventDefault();e.stopPropagation();
          scopeOpen[n.id]=!scopeOpen[n.id];
          renderScopeMenu();
        });
        tw.appendChild(ch);
      }
      row.appendChild(tw);
      var tx=document.createElement('span');tx.className='scope-t';
      tx.textContent=(n.num?n.num+'  ':'')+n.title;
      if(n.kids.length){
        var cnt=document.createElement('span');
        cnt.className='scope-n';
        cnt.textContent=n.kids.length;
        cnt.title=n.kids.length+' sub-section'
          +(n.kids.length>1?'s':'')+' inside';
        tx.appendChild(cnt);
      }
      row.appendChild(tx);
      function pick(e){
        e.preventDefault();e.stopPropagation();
        setSub(n,!selfOn);
        renderScopeMenu();renderScopeBtn();applyFilters();
      }
      row.addEventListener('click',pick);
      row.addEventListener('keydown',function(e){
        if(e.key==='Enter'||e.key===' '||e.key==='Spacebar') pick(e);});
      m.appendChild(row);
    });
    m.appendChild(cp);
  }
  function setTvBtn(id,label,state){
    var b=$('#'+id); if(!b) return;
    /* the state word sits in a fixed-width slot: without it the button
       (and everything after it) jumps as On -> Folded -> Off.
       Only the two SPANS are written — rewriting innerHTML here would
       delete the button's icon, which is an <svg> sibling. */
    var dot=b.querySelector('.tdot'),txt=b.querySelector('.btxt'),
        st=b.querySelector('.tvstate');
    if(!dot){
      dot=document.createElement('span');dot.className='tdot';
      b.appendChild(dot);
    }
    if(!txt){
      txt=document.createElement('span');txt.className='btxt';
      b.appendChild(txt);
    }
    if(!st){
      st=document.createElement('span');st.className='tvstate';
      b.appendChild(st);
    }
    txt.textContent=label;
    st.textContent=CODE_LABEL[state]||state;
    b.classList.toggle('off',state==='hidden');
    b.classList.toggle('half',state==='collapsed');
    b.classList.toggle('mixed',state==='mixed');
    b.setAttribute('data-cs',state);
  }
  /* which cross-notebook filter buttons make sense for the active tab */
  function renderFilterExtras(){
    var sh=APP.active&&APP.shells[APP.active];
    var isTrace=!!(sh&&sh.trace);
    /* "Present" is meaningless while you are already presenting */
    var dp=$('#doc-present');
    if(dp) dp.hidden=document.body.classList.contains('doc-presenting');
    var ti=$('#trace-inherit');
    if(ti) ti.hidden=!isTrace;
    /* an empty group still costs a gap in the bar */
    var cg=$('#copy-grp');
    if(cg) cg.hidden=!isTrace;
    /* a trace has no real sections, so "Apply to" has nothing to pick */
    var sc=$('#sec-scope-btn');
    if(sc) sc.hidden=isTrace;
  }
  function renderTypeButtons(){
    setTvBtn('tv-markdown','Markdown',readF('md'));
    setTvBtn('tv-code','Code',readF('code'));
    setTvBtn('tv-plots','Plots',readF('plot'));
    setTvBtn('tv-output','Output',readF('out'));
    renderFilterExtras();
    /* "Apply to" with nothing ticked: the filters have no target, so say
       so instead of letting clicks do nothing */
    var none=allSids().length>0&&targetSids().length===0;
    ['tv-markdown','tv-code','tv-plots','tv-output',
     'ck-filter-btn','ot-filter-btn','pt-filter-btn'].forEach(function(id){
      var b=$('#'+id); if(!b) return;
      /* keep the button's real explanation to restore afterwards */
      if(b.dataset.tip0==null) b.dataset.tip0=b.getAttribute('title')||'';
      b.disabled=none;
      b.classList.toggle('notarget',none);
      b.title=none?'Pick at least one section in "Apply to" first'
        :b.dataset.tip0;
    });
  }
  /* the figure part's real children (the zoom buttons are chrome) */
  function figCount(fig){
    var n=0;
    [].forEach.call(fig.children,function(el){
      if(!el.classList.contains('figzoom')) n++;});
    return n;
  }
  function applyFilters(){
    $$('.nbshell').forEach(function(sh){
      var stem=sh.dataset.nb;
      /* only the DOCUMENT feed: the tree view holds clones of these same
         cards and must always show every node in full */
      $$('.content .card',sh).forEach(function(c){
        /* a per-cell eye can hide one cell regardless of the filters */
        var off=c.classList.contains('cell-off');
        /* EVERY card obeys ITS OWN section's filter state, so one chapter
           can hide code while the next keeps it (the vars below shadow the
           old globals, which is why the body reads unchanged) */
        /* the card's OWN section id, stamped at render time — a clone in
           the tree view or a Plot-trace tab has no .section ancestor, and
           an ancestor lookup would silently fall back to the default */
        var st=stateFor(stem,secIdOf(c));
        var mdState=st.md,codeState=st.code,plotState=st.plot,
            outState=st.out;
        var ckHidden=st.ck,otHidden=st.ot,ptHidden=st.pt;
        var note=c.dataset.note==='1';
        var filtGone;
        if(note){
          /* a markdown note is one part — the Markdown filter owns the card */
          filtGone=mdState==='hidden';
          c.classList.toggle('collapsed',
            !filtGone&&!off&&mdState==='collapsed');
          if(filtGone||off||mdState!=='collapsed') c.classList.remove('expanded');
        } else {
          /* PART-BASED: every non-markdown cell may hold a code part, a plot
             part and an output part; each answers to its OWN filter. The card
             disappears only when none of its parts remain visible. */
          /* whether the author LABELLED this cell (title/caption/leading
             comment) — the titled/untitled rows of BOTH the Code-types
             and Plot-types menus key on it */
          var cardLab=c.dataset.labelled==='1'?'titled':'untitled';
          /* the card's code follows its TYPE's own tri-state where one is
             set (the Code-types menu) and its LABEL's tri-state — the
             stricter explicit state wins, any explicit beats the
             inherited overall Code filter */
          var ckT=c.dataset.ck?c.dataset.ck.split(' ')[0]:null;
          var ckExp=[];
          if(ckT){var vck=otVal(ckHidden[ckT]); if(vck) ckExp.push(vck);}
          var vcl=otVal(ckHidden[cardLab]); if(vcl) ckExp.push(vcl);
          var ckEff=ckExp.length?ckExp.reduce(stricterState):codeState;
          var fig=c.querySelector('.cb-fig'),
              out=c.querySelector('.cb-out'),
              cw=c.querySelector('.codewrap');
          /* with NO per-type overrides the whole output part answers to
             the Output filter (one part-level fold/hide, as always).
             With overrides, state applies PER OUTPUT instead — a type
             set to On must show even under Output: Off, so the part
             stays and each child carries its own effective state. */
          var otAnyOv=Object.keys(otHidden).length>0;
          if(out&&!otAnyOv){
            out.classList.toggle('part-off',outState==='hidden');
            out.classList.toggle('part-fold',outState==='collapsed');
            if(outState!=='collapsed') out.classList.remove('part-open');
          }
          if(cw) cw.classList.toggle('code-off',ckEff==='hidden');
          /* the advanced Plot-types menu gives each library its own
             On / Fold / Off; a type with no override follows the overall
             Plots filter. Stamp pt-off / pt-fold on every frame, then
             fold pager pages and the part upward; the plot part counts
             as visible only if some figure (or its fold stub) survives.
             A type overridden to On even shows under Plots = Off. */
          var figVis=false;
          var ptAnyOv=Object.keys(ptHidden).length>0;
          var wasFigOpen=!!fig&&fig.classList.contains('part-open');
          if(fig){
            $$('[data-pt]',fig).forEach(function(n){
              if(!ptAnyOv){
                n.classList.remove('pt-off','pt-fold','pt-open');return;}
              /* explicit overrides (library AND labelled dimension)
                 combine restrictively; ANY explicit beats the inherited
                 overall state — an override "does its own thing" */
              var pts=n.dataset.pt.split(' ').filter(Boolean);
              var exp=[];
              pts.forEach(function(t){
                var v=otVal(ptHidden[t]); if(v) exp.push(v);});
              var vl=otVal(ptHidden[cardLab]); if(vl) exp.push(vl);
              var eff=exp.length?exp.reduce(stricterState):plotState;
              n.classList.toggle('pt-off',eff==='hidden');
              n.classList.toggle('pt-fold',eff==='collapsed');
              if(eff==='collapsed'&&wasFigOpen)
                n.classList.add('pt-open');
              if(eff!=='collapsed') n.classList.remove('pt-open');
            });
            /* a pager PAGE is off when every frame on it is off; keep the
               'current' page a visible one and the ‹1 / N› count honest */
            $$('.figpage',fig).forEach(function(p){
              var fr=$$('[data-pt]',p);
              p.classList.toggle('pt-off',
                fr.length>0&&fr.every(function(n){
                  return n.classList.contains('pt-off');}));
            });
            $$('.figpager',fig).forEach(function(pgr){
              var pages=$$(':scope > .figpage',pgr);
              var vis=pages.filter(function(p){
                return !p.classList.contains('pt-off');});
              var curp=pages.filter(function(p){
                return p.classList.contains('current');})[0];
              if(vis.length&&(!curp||curp.classList.contains('pt-off'))){
                if(curp) curp.classList.remove('current');
                vis[0].classList.add('current');
                if(window.SemActivate) window.SemActivate(vis[0],true);
              }
              var ct=pgr.querySelector('.fp-count');
              if(ct&&vis.length){
                var ci=vis.indexOf(pgr.querySelector(
                  ':scope > .figpage.current'));
                ct.textContent=(Math.max(0,ci)+1)+' / '+vis.length;
              }
              var nav=pgr.querySelector('.figpager-nav');
              if(nav) nav.style.display=vis.length>1?'':'none';
            });
            [].forEach.call(fig.children,function(el){
              var off;
              if(el.classList.contains('figzoom')) return;  /* chrome */
              if(el.classList.contains('figpager')){
                var pgs=$$('.figpage',el);
                off=pgs.length>0&&pgs.every(function(p){
                  return p.classList.contains('pt-off');});
              } else {
                /* the frame's own class, or — for a wrapper — whether
                   every framed descendant is off */
                var infr=$$('[data-pt]',el);
                off=el.classList.contains('pt-off')
                  ||(infr.length>0&&infr.every(function(n){
                      return n.classList.contains('pt-off');}));
              }
              el.classList.toggle('pt-off',off);
              if(!off) figVis=true;
            });
            if(!figCount(fig)) figVis=true;
          }
          if(fig&&ptAnyOv){
            /* per-frame mode, exactly like the output part: the part-
               level fold yields to the frames' own states, and the part
               vanishes only when nothing survives (no "Show plot" stub
               over nothing) */
            fig.classList.remove('part-fold','part-open');
            fig.classList.toggle('part-off',
              !figVis&&figCount(fig)>0);
          } else if(fig){
            if(plotState==='hidden') figVis=false;
            fig.classList.toggle('part-off',plotState==='hidden');
            fig.classList.toggle('part-fold',plotState==='collapsed');
            if(plotState!=='collapsed') fig.classList.remove('part-open');
          }
          /* the advanced Output-types menu gives each kind its own
             On / Fold / Off; a type with no override follows the overall
             Output state. The part counts as visible only if some output
             (or its fold stub) survives. */
          var outVis=false;
          if(out&&otAnyOv){
            /* a part the reader had OPENED stays open: its part-open
               becomes ot-open on each newly folded child, instead of
               snapping everything they were reading shut (2026-08-04,
               adversarial review). part-open only exists in part-level
               mode, so this fires exactly once, at the switch. */
            var wasPartOpen=out.classList.contains('part-open');
            out.classList.remove('part-fold','part-open');
            var kids=[].slice.call(out.children);
            kids.forEach(function(el){
              if(el.classList.contains('ot-stub')) return; /* with its target */
              var mm=(el.className||'').match(/\bot-([a-z]+)\b/);
              var typ=mm&&OT_STATE_CLASSES.indexOf(mm[1])<0?mm[1]:null;
              var eff=typ?(otVal(otHidden[typ])||outState):outState;
              el.classList.toggle('ot-off',eff==='hidden');
              el.classList.toggle('ot-fold',eff==='collapsed');
              if(eff==='collapsed'&&wasPartOpen)
                el.classList.add('ot-open');
              if(eff!=='collapsed') el.classList.remove('ot-open');
              /* a folded output leaves a slim "▸ type" stub in its place,
                 exactly like the part-level "Show output" bar but per
                 output — the stub toggles just this one open */
              var stub=el.previousElementSibling;
              if(stub&&!stub.classList.contains('ot-stub')) stub=null;
              if(eff==='collapsed'){
                if(!stub){
                  stub=document.createElement('button');
                  stub.type='button';stub.className='ot-stub';
                  out.insertBefore(stub,el);
                }
                var lab=typ||'output';
                stub.textContent=(el.classList.contains('ot-open')
                  ?'▾  ':'▸  ')+lab;
                stub.onclick=function(){
                  var open=el.classList.toggle('ot-open');
                  stub.textContent=(open?'▾  ':'▸  ')+lab;
                };
              } else if(stub) stub.remove();
              if(eff!=='hidden') outVis=true;
            });
            /* every output effectively hidden -> the part goes entirely,
               so no empty box lingers where the outputs were */
            var realKids=kids.filter(function(el){
              return !el.classList.contains('ot-stub');});
            if(!realKids.length) outVis=true;
            out.classList.toggle('part-off',!outVis);
          } else if(out){
            /* no overrides: clear any per-output state left behind
               (snapshot first — removing stubs mid-walk skips nodes).
               The mirror of the transition above: an output the reader
               had opened per-type keeps the part open after a reset,
               rather than snapping shut behind the fold bar. */
            var hadOtOpen=false;
            [].slice.call(out.children).forEach(function(el){
              if(el.classList.contains('ot-stub')){el.remove();return;}
              if(el.classList.contains('ot-open')) hadOtOpen=true;
              el.classList.remove('ot-off','ot-fold','ot-open');
              if(outState!=='hidden') outVis=true;
            });
            if(!out.children.length&&outState!=='hidden') outVis=true;
            if(hadOtOpen&&outState==='collapsed')
              out.classList.add('part-open');
          }
          var codeVis=!!cw&&ckEff!=='hidden';
          filtGone=!figVis&&!outVis&&!codeVis;
          c.classList.remove('collapsed','expanded');   /* parts fold, not cards */
        }
        var id=c.id.replace(/^card-/,'');
        c.classList.toggle('is-hidden',filtGone||off);
        var nav=sh.querySelector('.navitem[data-item="'+id+'"]');
        if(nav){
          /* filtered out -> gone from the sidebar; manually hidden -> STAYS
             (dimmed, so you can bring it back) */
          nav.classList.toggle('nav-hidden',filtGone);
          nav.classList.toggle('cell-off',off);
        }
      });
      $$('.section',sh).forEach(function(sec){
        /* a section hidden via its eye is a manual state, kept out of the
           filter-driven fold so its (dimmed) sidebar row survives to restore */
        var secOff=sec.classList.contains('sec-off');
        var cards=$$('.card',sec);
        /* doc: an empty section header (all its cards hidden) folds away */
        var allGone=cards.length>0&&cards.every(function(c){
          return c.classList.contains('is-hidden');});
        sec.classList.toggle('is-hidden',allGone&&!secOff);
        var sid=sec.dataset.sec;
        var row=sh.querySelector('.navsec-row[data-sec="'+sid+'"]');
        var items=sh.querySelector('.navitems[data-sec="'+sid+'"]');
        /* nav: the section vanishes only if EVERY item is filtered out —
           manually-hidden cells/sections keep their (dimmed) rows to restore */
        var navs=items?$$('.navitem',items):[];
        var navGone=navs.length>0&&navs.every(function(n){
          return n.classList.contains('nav-hidden');});
        if(row) row.classList.toggle('nav-hidden',navGone&&!secOff);
        if(items) items.classList.toggle('nav-hidden',navGone&&!secOff);
      });
    });
    renderTypeButtons();
    /* an advanced picker lights up when ANY selected section hides a type
       (one section-list lookup for all three, not one each) */
    var anyStem=activeStem(),anyIds=targetSids();
    function anyType(map){
      var n=0;
      if(!anyIds.length) return Object.keys(FDEFof(anyStem)[map]).length>0;
      anyIds.forEach(function(id){
        if(Object.keys(stateFor(anyStem,id)[map]).length) n++;});
      return n>0;
    }
    var fb=$('#ck-filter-btn');
    if(fb) fb.classList.toggle('on',anyType('ck'));
    var ob=$('#ot-filter-btn');
    if(ob) ob.classList.toggle('on',anyType('ot'));
    var pb=$('#pt-filter-btn');
    if(pb) pb.classList.toggle('on',anyType('pt'));
    renderScopeBtn();
    markSecOverrides();
    syncTypeMenus();
    scheduleSaveLayout();   /* remember this for next time */
  }
  /* every type menu speaks the same language: the map it edits, the
     overall filter it inherits from, and the word on that filter's
     ribbon button */
  var MENU_KEY={ck:'code',pt:'plot',ot:'out'};
  var MENU_LABEL={ck:'Code',pt:'Plots',ot:'Output'};
  /* refresh an OPEN type menu's controls in place. Rebuilding it
     mid-click would yank the rows out from under a user working down
     the list. */
  function syncTypeMenus(){
    ['#ck-filter-menu','#pt-filter-menu','#ot-filter-menu']
      .forEach(function(sel){
        $$(sel+' .ckf-row').forEach(function(r){
          var t=r.dataset.t,map=r.dataset.map;
          if(!t||!map) return;
          var st=$('.ckf-state',r); if(!st) return;
          var vs=effVals(map,MENU_KEY[map],t);
          /* per-section disagreement reads "Mix", like the main buttons */
          var one=vs.length===1?vs[0]:'mixed';
          st.textContent=CODE_LABEL[one]||CODE_LABEL.mixed;
          st.className='ckf-state s-'+one
            +(countF(map,t)>0?' ovr':'');
        });
      });
    /* from the STATE, not the rendered rows — an override for a type
       with no rendered row must still enable the reset */
    [['#ot-reset','ot'],['#ck-reset','ck'],['#pt-reset','pt']]
      .forEach(function(p){
        var rs=$(p[0]);
        if(rs) rs.disabled=!overriddenTypes(p[1]).length;
      });
  }
  /* advanced filter menu: hide specific code subtypes */
  var ckCounts={};
  function presentCkTypes(){
    var set={};ckCounts={};
    /* the ACTIVE notebook's document feed only, like presentOtTypes */
    var sh=APP.active&&APP.shells[APP.active];
    if(!sh) return [];
    $$('.content .card[data-ck]',sh.el).forEach(function(c){
      /* the FIRST slug is the one the filter acts on (applyFilters
         hides by it), so it is the one the menu counts; each card also
         tallies its titled/untitled label for the label rows */
      var t=c.dataset.ck.split(' ')[0];
      if(t){set[t]=1;ckCounts[t]=(ckCounts[t]||0)+1;}
      var lab=c.dataset.labelled==='1'?'titled':'untitled';
      ckCounts[lab]=(ckCounts[lab]||0)+1;
    });
    return CK_TYPES.filter(function(t){return set[t];});
  }
  /* one row of any type menu: dot, "name (count)", and the type's OWN
     On/Fold/Off cycler. Setting it detaches the type from its overall
     filter ("does its own thing") until that menu's reset re-attaches
     it. The whole row cycles, like the old full-row checkbox label. */
  function typeMenuRow(map,t,count,dotClass){
    var key=MENU_KEY[map];
    var row=document.createElement('div');row.className='ckf-row';
    row.dataset.t=t;row.dataset.map=map;
    var sw=document.createElement('span');
    sw.className='ckf-dot '+dotClass;
    var tx=document.createElement('span');tx.className='ckf-name';
    tx.textContent=t+' ('+count+')';
    var st=document.createElement('button');st.type='button';
    st.className='ckf-state';
    st.title='This type’s own filter: On → Fold → Off. '
      +'Set, it no longer follows the '+MENU_LABEL[map]+' button; '
      +'Reset below re-attaches it.';
    st.addEventListener('click',function(e){
      e.preventDefault();e.stopPropagation();
      var vs=effVals(map,key,t);
      var cur=vs.length===1?vs[0]:'hidden';   /* Mix -> next is On */
      var nx=cycle3(cur);
      writeF(function(s){s[map][t]=nx;});
      applyFilters();
      if(map==='ck') applyCodeState();
    });
    row.addEventListener('click',function(e){
      if(e.target!==st) st.click();});
    row.appendChild(sw);row.appendChild(tx);row.appendChild(st);
    return row;
  }
  /* the menu's reset: every type back under the overall filter — for the
     WHOLE notebook, not just the targeted sections, or a stale override
     in an untargeted section survives every reset that claims to clear
     it */
  function typeMenuReset(map,id){
    var rs=document.createElement('button');rs.type='button';
    rs.id=id;rs.className='ckf-reset';
    rs.textContent='Reset: match '+MENU_LABEL[map];
    rs.title='Clear every per-type state above, so all types follow '
      +'the '+MENU_LABEL[map]+' filter again';
    rs.addEventListener('click',function(){
      var stem=activeStem();
      FDEFof(stem)[map]={};
      var pre=String(stem)+'::';
      for(var k in secF){if(k.indexOf(pre)===0) secF[k][map]={};}
      pruneF(stem);markSecOverrides();
      applyFilters();
      if(map==='ck') applyCodeState();
    });
    return rs;
  }
  function renderCkMenu(){
    var m=$('#ck-filter-menu'); if(!m) return;
    m.innerHTML='';
    var types=presentCkTypes();
    var ov=overriddenTypes('ck');
    ov.forEach(function(t){
      if(t==='titled'||t==='untitled') return;   /* rows added below */
      if(types.indexOf(t)<0) types.push(t);});
    /* code cells have titles too: the same titled/untitled rows as the
       Plot-types menu, shown when the notebook has both kinds */
    var showLab=((ckCounts.titled||0)>0&&(ckCounts.untitled||0)>0)
      ||ov.indexOf('titled')>=0||ov.indexOf('untitled')>=0;
    if(!types.length&&!showLab){
      m.innerHTML='<div class="ckf-empty">No typed code cells yet</div>';
      return;
    }
    var h=document.createElement('div');h.className='ckf-h';
    h.textContent='show code types';m.appendChild(h);
    types.forEach(function(t){
      m.appendChild(typeMenuRow('ck',t,ckCounts[t]||0,'ckmain-'+t));
    });
    if(showLab){
      m.appendChild(typeMenuRow('ck','titled',
        ckCounts.titled||0,'pt-sw-titled'));
      m.appendChild(typeMenuRow('ck','untitled',
        ckCounts.untitled||0,'pt-sw-untitled'));
    }
    m.appendChild(typeMenuReset('ck','ck-reset'));
    syncTypeMenus();
  }
  /* only one advanced filter menu open at a time */
  function closeFilterMenus(except){
    ['#ck-filter-menu','#pt-filter-menu','#ot-filter-menu',
     '#sec-scope-menu']
      .forEach(function(sel){
        if(sel===except) return;
        var m=$(sel); if(m&&!m.hidden) m.hidden=true;
      });
  }
  var scBtn=$('#sec-scope-btn'),scMenu=$('#sec-scope-menu');
  if(scBtn) scBtn.addEventListener('click',function(e){
    e.stopPropagation();
    if(!scMenu) return;
    if(scMenu.hidden){
      closeFilterMenus('#sec-scope-menu');
      renderScopeMenu();scMenu.hidden=false;
      var r=scBtn.getBoundingClientRect();
      scMenu.style.top=(r.bottom+6)+'px';
      scMenu.style.left=Math.max(6,
        Math.min(r.left,window.innerWidth-260))+'px';
    } else scMenu.hidden=true;
  });
  if(scMenu) scMenu.addEventListener('click',function(e){
    e.stopPropagation();});
  /* like the other pickers: a click anywhere else closes it */
  document.addEventListener('click',function(e){
    if(scMenu&&!scMenu.hidden&&e.target!==scBtn
       &&!scMenu.contains(e.target)) scMenu.hidden=true;});
  var ckBtn=$('#ck-filter-btn'),ckMenu=$('#ck-filter-menu');
  if(ckBtn) ckBtn.addEventListener('click',function(e){
    e.stopPropagation();
    if(!ckMenu) return;
    if(ckMenu.hidden){
      closeFilterMenus('#ck-filter-menu');
      renderCkMenu();ckMenu.hidden=false;
      var r=ckBtn.getBoundingClientRect();
      ckMenu.style.top=(r.bottom+6)+'px';
      ckMenu.style.left=Math.max(6,
        Math.min(r.left,window.innerWidth-190))+'px';
    } else ckMenu.hidden=true;
  });
  document.addEventListener('click',function(e){
    if(ckMenu&&!ckMenu.hidden&&!ckMenu.contains(e.target)
       &&e.target!==ckBtn) ckMenu.hidden=true;
  });
  /* advanced PLOT-type filter: hide figures by the library that drew them
     (matplotlib images, plotly, bokeh, vega/altair, folium, animations,
     video, other widgets) — like the code-type filter, but for plots */
  var PT_TYPES=['matplotlib','plotly','bokeh','vega','folium',
    'animation','video','widget'];
  var ptCounts={};
  function presentPtTypes(){
    var set={};ptCounts={};
    /* the ACTIVE notebook's document feed only, like presentOtTypes.
       Counted per FRAME (each drawn figure), not per part, so a pager
       of 4 matplotlib panels reads "matplotlib (4)". Every frame also
       tallies its part's titled/untitled label for the label rows. */
    var sh=APP.active&&APP.shells[APP.active];
    if(!sh) return [];
    $$('.content .card .cb-fig',sh.el).forEach(function(f){
      var card=f.closest('.card');
      var lab=card&&card.dataset.labelled==='1'?'titled':'untitled';
      var frames=$$('[data-pt]',f);
      /* a single-frame part carries data-pt on the part itself */
      if(!frames.length&&f.dataset.pt) frames=[f];
      frames.forEach(function(n){
        ptCounts[lab]=(ptCounts[lab]||0)+1;
        n.dataset.pt.split(' ').forEach(function(t){
          if(t){set[t]=1;ptCounts[t]=(ptCounts[t]||0)+1;}});
      });
    });
    var out=PT_TYPES.filter(function(t){return set[t];});
    Object.keys(set).forEach(function(t){
      if(PT_TYPES.indexOf(t)<0) out.push(t);});  /* unknown slugs still show */
    return out;
  }
  function renderPtMenu(){
    var m=$('#pt-filter-menu'); if(!m) return;
    m.innerHTML='';
    var types=presentPtTypes();
    var ov=overriddenTypes('pt');
    ov.forEach(function(t){
      if(t==='titled'||t==='untitled') return;   /* their own section */
      if(types.indexOf(t)<0) types.push(t);});
    /* the LABELLED dimension: filter plots by whether the author gave
       them a title/caption. Only offered when the notebook actually has
       both kinds (or a stale override must stay clearable) — "only
       titled plots" is meaningless when everything is titled. */
    var showLab=((ptCounts.titled||0)>0&&(ptCounts.untitled||0)>0)
      ||ov.indexOf('titled')>=0||ov.indexOf('untitled')>=0;
    if(!types.length&&!showLab){
      m.innerHTML='<div class="ckf-empty">No plots yet</div>';return;}
    var h=document.createElement('div');h.className='ckf-h';
    h.textContent='show plot types';m.appendChild(h);
    types.forEach(function(t){
      m.appendChild(typeMenuRow('pt',t,ptCounts[t]||0,'pt-sw-'+t));
    });
    /* plain rows in the one list, after the libraries — no sub-heading
       (2026-08-04, user: "these should just be in the filter options") */
    if(showLab){
      m.appendChild(typeMenuRow('pt','titled',
        ptCounts.titled||0,'pt-sw-titled'));
      m.appendChild(typeMenuRow('pt','untitled',
        ptCounts.untitled||0,'pt-sw-untitled'));
    }
    m.appendChild(typeMenuReset('pt','pt-reset'));
    syncTypeMenus();
  }
  var ptBtn=$('#pt-filter-btn'),ptMenu=$('#pt-filter-menu');
  if(ptBtn) ptBtn.addEventListener('click',function(e){
    e.stopPropagation();
    if(!ptMenu) return;
    if(ptMenu.hidden){
      closeFilterMenus('#pt-filter-menu');
      renderPtMenu();ptMenu.hidden=false;
      var r=ptBtn.getBoundingClientRect();
      ptMenu.style.top=(r.bottom+6)+'px';
      ptMenu.style.left=Math.max(6,
        Math.min(r.left,window.innerWidth-190))+'px';
    } else ptMenu.hidden=true;});
  document.addEventListener('click',function(e){
    if(ptMenu&&!ptMenu.hidden&&!ptMenu.contains(e.target)
       &&e.target!==ptBtn) ptMenu.hidden=true;});
  /* advanced OUTPUT-type filter: hide specific printed-output kinds (print,
     dataset, result, error) — like the code-type filter, but for output */
  /* preferred ordering; any other slug present (a finer repr type) is appended
     after these so the menu never drops a type it doesn't already know */
  var OT_TYPES=['print','numeric','string','bool','none','list','tuple','set',
    'dict','array','series','dataframe','dataset','function','class','module',
    'object','value','result','error'];
  /* how many outputs of each type the ACTIVE notebook holds — filled by
     presentOtTypes, read by the menu labels ("dataset (3)") */
  var otCounts={};
  function presentOtTypes(){
    var set={};otCounts={};
    /* the ACTIVE notebook only — scanning every .nbshell put the other
       open tabs' types in this notebook's menu — and only the document
       feed, so tree/slide clones can never double-count */
    var sh=APP.active&&APP.shells[APP.active];
    if(!sh) return [];
    $$('.content .card .cb-out',sh.el).forEach(function(o){
      [].forEach.call(o.children,function(el){
        var mm=(el.className||'').match(/\bot-([a-z]+)\b/);
        if(!mm||OT_STATE_CLASSES.indexOf(mm[1])>=0) return;
        set[mm[1]]=1;otCounts[mm[1]]=(otCounts[mm[1]]||0)+1;
      });
    });
    var out=OT_TYPES.filter(function(t){return set[t];});
    Object.keys(set).forEach(function(t){
      if(OT_TYPES.indexOf(t)<0) out.push(t);});   /* unknown slugs still show */
    return out;
  }
  /* every type carrying an override ANYWHERE in this notebook (default
     or any section) — even one whose cells/outputs no longer exist. A
     stale override still changes rendering and still lights the funnel,
     so the menu must SHOW it (count 0) and the reset must reach it, or
     it becomes invisible and unclearable (2026-08-04, adversarial
     review: saved layouts + re-run notebooks). */
  function overriddenTypes(map){
    var stem=activeStem(),set={};
    Object.keys(FDEFof(stem)[map]).forEach(function(t){set[t]=1;});
    var pre=String(stem)+'::';
    for(var k in secF){
      if(k.indexOf(pre)===0)
        Object.keys(secF[k][map]).forEach(function(t){set[t]=1;});
    }
    return Object.keys(set);
  }
  /* the EFFECTIVE state(s) of one type across the targeted sections:
     its own override where set, else the overall filter it inherits
     from. More than one distinct value -> the button reads "Mix". */
  function effVals(map,key,t){
    var stem=activeStem(),ids=targetSids(),vals={};
    (ids.length?ids:[null]).forEach(function(id){
      var s=id===null?FDEFof(stem):stateFor(stem,id);
      vals[otVal(s[map][t])||s[key]]=1;
    });
    return Object.keys(vals);
  }
  function renderOtMenu(){
    var m=$('#ot-filter-menu'); if(!m) return;
    m.innerHTML='';
    var types=presentOtTypes();
    /* overridden-but-absent types still show (count 0), or their
       override could never be seen or cleared */
    overriddenTypes('ot').forEach(function(t){
      if(types.indexOf(t)<0) types.push(t);});
    if(!types.length){
      m.innerHTML='<div class="ckf-empty">No printed output yet</div>';return;}
    var h=document.createElement('div');h.className='ckf-h';
    h.textContent='show output types';m.appendChild(h);
    types.forEach(function(t){
      m.appendChild(typeMenuRow('ot',t,otCounts[t]||0,'ot-sw-'+t));
    });
    m.appendChild(typeMenuReset('ot','ot-reset'));
    syncTypeMenus();
  }
  var otBtn=$('#ot-filter-btn'),otMenu=$('#ot-filter-menu');
  if(otBtn) otBtn.addEventListener('click',function(e){
    e.stopPropagation();
    if(!otMenu) return;
    if(otMenu.hidden){
      closeFilterMenus('#ot-filter-menu');
      renderOtMenu();otMenu.hidden=false;
      var r=otBtn.getBoundingClientRect();
      otMenu.style.top=(r.bottom+6)+'px';
      otMenu.style.left=Math.max(6,
        Math.min(r.left,window.innerWidth-190))+'px';
    } else otMenu.hidden=true;});
  document.addEventListener('click',function(e){
    if(otMenu&&!otMenu.hidden&&!otMenu.contains(e.target)
       &&e.target!==otBtn) otMenu.hidden=true;});
  /* the code state drives every code block: code cards AND the blocks
     folded under every figure / dataset card. Visible = expanded,
     Collapsed = folded, Hidden = the block disappears entirely. */
  function setCodeOpen(w,open){
    if(open) w.setAttribute('data-open','');
    else w.removeAttribute('data-open');
    var btn=$('.codetoggle',w);
    if(btn) btn.setAttribute('aria-expanded',open?'true':'false');
  }
  /* fold/expand each codewrap (data-open) to ITS OWN section's state —
     through its code-TYPE's tri-state when one is set (the Code-types
     menu), else the overall Code filter. HIDING a codewrap (code-off)
     is owned by applyFilters. */
  function applyCodeState(root){
    var shells=(root&&root.classList
      &&root.classList.contains('nbshell'))
      ?[root]:$$('.nbshell',root||document);
    shells.forEach(function(sh){
      var stem=sh.dataset.nb;
      $$('.content .codewrap',sh).forEach(function(w){
        var c=w.closest('.card');
        var s=stateFor(stem,secIdOf(c));
        var t=c&&c.dataset.ck?c.dataset.ck.split(' ')[0]:null;
        var lab=c&&c.dataset.labelled==='1'?'titled':'untitled';
        var exp=[];
        if(t){var v=otVal(s.ck[t]); if(v) exp.push(v);}
        var vl=otVal(s.ck[lab]); if(vl) exp.push(vl);
        var eff=exp.length?exp.reduce(stricterState):s.code;
        setCodeOpen(w,eff==='visible');
      });
    });
  }
  function cycle3(s){return CODE_CYCLE[(CODE_CYCLE.indexOf(s)+1)%3];}
  /* one click = advance the SELECTED sections. A mixed selection lands on
     a definite state first (Visible) rather than advancing from a lie. */
  function cycleF(key){
    var cur=readF(key);
    var next=(cur==='mixed')?'visible':cycle3(cur);
    writeF(function(s){s[key]=next;});
    applyFilters();
    if(key==='code') applyCodeState();
  }
  var mkBtn=$('#tv-markdown');
  if(mkBtn) mkBtn.addEventListener('click',function(){cycleF('md');});
  var plBtn=$('#tv-plots');
  if(plBtn) plBtn.addEventListener('click',function(){cycleF('plot');});
  var opBtn=$('#tv-output');
  if(opBtn) opBtn.addEventListener('click',function(){cycleF('out');});
  var cb=$('#tv-code');
  if(cb) cb.addEventListener('click',function(){cycleF('code');});
  var rsBtn=$('#filters-reset');
  if(rsBtn) rsBtn.addEventListener('click',function(){
    resetFilters();
    docToast('Filters reset for this notebook');
  });
  /* a trace opens unfiltered; this pulls its source document's filters in
     (its clones carry the source's section ids, so the per-section tweaks
     land on exactly the right cells) */
  var tiBtn=$('#trace-inherit');
  if(tiBtn) tiBtn.addEventListener('click',function(){
    var sh=APP.active&&APP.shells[APP.active];
    if(!sh||!sh.trace||!sh.source) return;
    copyFiltersTo(APP.active,sh.source,true);
    renderTypeButtons();renderScopeBtn();
    applyFilters();applyCodeState();
    docToast('Using the filters from '+sh.source);
  });
  /* "these filters, everywhere" — lives at the foot of the Apply-to menu,
     which is already the control for WHERE the filters land */
  function copyFiltersToAll(){
    var src=String(activeStem()),n=0;
    (APP.order||[]).forEach(function(s){
      if(String(s)===src) return;
      copyFiltersTo(s,src,false);n++;
    });
    if(!n){docToast('No other notebooks are open');return;}
    applyFilters();applyCodeState();
    docToast('Applied these filters to '+n+' other notebook'
      +(n>1?'s':'')+' — their per-section tweaks were cleared');
  }
  renderTypeButtons();

  /* ---- raw notebook toggle (applies to the ACTIVE tab) ---- */
  var rawBtn=$('#view-raw');
  /* write a button's LABEL without touching its icon: every chrome button
     carries an <svg class="bic"> first child, and textContent= on the
     button would silently delete it */
  function setBtnText(b,txt){
    if(!b) return;
    var s=b.querySelector('.btxt');
    if(!s){
      s=document.createElement('span');s.className='btxt';
      b.appendChild(s);
    }
    s.textContent=txt;
  }
  APP.setBtnText=setBtnText;
  function renderRawBtn(){
    if(!rawBtn) return;
    var sh=APP.active&&APP.shells[APP.active];
    if(sh&&sh.trace){   /* a Plot-trace tab has no raw notebook of its own */
      setBtnText(rawBtn,'Raw');
      rawBtn.setAttribute('aria-pressed','false');
      rawBtn.disabled=true;return;
    }
    var on=!!(sh&&sh.el.classList.contains('raw'));
    rawBtn.setAttribute('aria-pressed',on.toString());
    setBtnText(rawBtn,on?'Formatted':'Raw');
    rawBtn.disabled=!sh;
  }
  /* The raw view ships lightweight .rawph placeholders for every output
     whose full payload a card already embeds (data-jvout keys, stamped
     server-side) — one copy of each multi-MB figure per page, not two.
     Fill them on FIRST OPEN by cloning the card's already-parsed node —
     the same clone trick the deck uses for slides. Outputs the cards
     dropped (hidden cells, single-step folds — see _card_output_keys in
     render/items.py) arrive fully embedded and need no filling. */
  function populateRawView(shell){
    if(!shell) return;
    var phs=shell.querySelectorAll('.rawview .rawph:not([data-filled])');
    if(!phs.length) return;
    var content=$('.content',shell);
    [].forEach.call(phs,function(ph){
      ph.dataset.filled='1';
      var key=ph.dataset.jvout||'';
      /* scope to .content: tree-view/trace clones also carry the key */
      var src=(key&&content)
        ?content.querySelector('[data-jvout="'+key+'"]'):null;
      if(src) ph.appendChild(src.cloneNode(true));
      else{
        /* never silently nothing: say the mirror is missing */
        ph.classList.add('rawph-missing');
        ph.textContent='This output could not be mirrored from the '
          +'formatted view. Reload the notebook to rebuild the page.';
      }
    });
    var rv=$('.rawview',shell);
    /* clones of not-yet-drawn plotly embeds carry their data-plotly spec:
       draw them now (drawn ones carry .js-plotly-plot and are skipped) */
    if(rv) activateOutputs(rv,true);
  }
  if(rawBtn) rawBtn.addEventListener('click',function(){
    var sh=APP.active&&APP.shells[APP.active];
    if(!sh) return;
    var on=sh.el.classList.toggle('raw');
    if(on) sh.el.classList.remove('tree');   /* raw + tree are exclusive */
    if(on) populateRawView(sh.el);
    if(on&&!sh.el.dataset.rawTypeset){
      sh.el.dataset.rawTypeset='1';
      var rv=$('.rawview',sh.el);
      if(rv&&window.MathJax&&MathJax.typesetPromise)
        MathJax.typesetPromise([rv]).catch(function(){});
    }
    renderRawBtn();renderViewBtns();
  });

  /* ---- tree view: the analysis graph as a full, expandable view, plus a
     full-screen "present" mode for either view. Both the Narrative document
     and the Tree map can be presented; the Tree is built client-side from
     this shell's own card index (nb-data) + its rendered card DOM, so it
     works identically in the static file, the app and the web build. ---- */
  var treeBtn=$('#view-tree');
  function renderViewBtns(){
    var sh=APP.active&&APP.shells[APP.active];
    var isTree=!!(sh&&sh.el.classList.contains('tree'));
    if(treeBtn){
      treeBtn.setAttribute('aria-pressed',isTree.toString());
      /* write the LABEL only: the button's icon is a sibling <svg> and
         textContent= would delete it */
      setBtnText(treeBtn,isTree?'Document':'Tree');
      treeBtn.disabled=!sh;
    }
    /* there is no #pb-view: while presenting, this very button moves into
       the present bar with the rest of the View section */
    syncTreeRibbon(isTree);
  }
  /* ---- the tree shows the WHOLE analysis, so the filters do not apply
     there. Grey them out rather than removing them: a control that
     vanishes takes its neighbours' positions with it, and the whole point
     is that a button never moves when you change view (2026-07-30). ---- */
  function syncTreeRibbon(isTree){
    /* the CSS removes the filter sections outright in tree view; the
       disabling below is belt-and-braces for anything that stays reachable
       (a present-bar copy, keyboard focus mid-transition) */
    document.body.classList.toggle('tree-mode',isTree);
    var why='Filters do not apply in the tree — it always shows every '
      +'cell, so you can see the whole analysis. Switch back to Document '
      +'to filter.';
    ['#tv-plots','#tv-markdown','#tv-code','#tv-output','#pt-filter-btn',
     '#ck-filter-btn','#ot-filter-btn','#sec-scope-btn','#sec-reset',
     '#trace-inherit'].forEach(function(sel){
      var b=$(sel); if(!b) return;
      if(isTree){
        if(!b.dataset.t0) b.dataset.t0=b.title||'';
        b.disabled=true;b.title=why;
      } else if(b.dataset.t0!==undefined){
        b.disabled=false;b.title=b.dataset.t0;
      }
    });
    /* the figure sizer has nothing to size in the tree (node clones drop
       --fz), so the same three buttons drive the TREE ZOOM instead — same
       place, same shape, caption says which */
    var cap=$('#fig-size-grp .fgrp-cap');
    if(cap) cap.textContent=isTree?'Tree':'Figures';
    var fv=$('#fig-size-val');
    if(fv) fv.title=isTree
      ?'Tree zoom — click to reset to 100%'
      :'Figure size across the whole feed — click to reset to 100%';
    if(isTree&&APP.treeZoomPct) applyTreeZoomLabel();
  }
  function activeTreeHost(){
    var sh=APP.active&&APP.shells[APP.active];
    return sh?sh.el.querySelector('.treeview'):null;
  }
  function applyTreeZoomLabel(){
    var host=activeTreeHost(); if(!host) return;
    var cv=host.querySelector('.tree-canvas'); if(!cv) return;
    var v=$('#fig-size-val');
    if(v) v.textContent=Math.round(
      (parseFloat(cv.style.zoom||'1')||1)*100)+'%';
  }
  APP.treeZoomPct=applyTreeZoomLabel;
  /* ---- the tree's own controls, on the RIBBON. They used to live in a
     floating toolbar over the canvas, which the ribbon covered. Each acts
     on whichever tree is in front (activeTreeHost), so there is one copy,
     in one place, styled like every other ribbon button. ---- */
  var TW_NAMES={'tw-s':'S','tw-m':'M','tw-l':'L'};
  function treeCanvas(){
    var h=activeTreeHost();
    return h?h.querySelector('.tree-canvas'):null;
  }
  function syncTreeTools(){
    var cv=treeCanvas(),host=activeTreeHost();
    var wb=$('#tree-width');
    if(wb&&cv){
      var cur=['tw-s','tw-m','tw-l'].filter(function(c){
        return cv.classList.contains(c);})[0]||'tw-m';
      setBtnText(wb,'Width: '+TW_NAMES[cur]);
    }
    var ub=$('#tree-unhide');
    if(ub) ub.hidden=!(host&&host.querySelector('.tree-node.tn-off'));
  }
  APP.syncTreeTools=syncTreeTools;
  (function(){
    var ex=$('#tree-expand'),co=$('#tree-collapse'),
        wd=$('#tree-width'),un=$('#tree-unhide');
    if(ex) ex.addEventListener('click',function(){
      var host=activeTreeHost(); if(!host) return;
      /* batch across frames — cloning every card at once janks a big
         notebook; yield between chunks, relayout once at the end */
      var els=$$('.tree-node',host).filter(function(el){
        return !el.classList.contains('tn-off')
          &&!el.classList.contains('expanded');});
      var i=0,BATCH=6;
      (function step(){
        for(var end=Math.min(i+BATCH,els.length);i<end;i++){
          els[i].classList.add('expanded');fillNode(els[i]);
          /* "Expand all" means SHOW THE CODE, not merely open the node:
             a card clone arrives with its code folded behind a "Show
             code" toggle, so expanding left you looking at a title and a
             chevron. Open every code block inside it too. */
          $$('.codewrap',els[i]).forEach(function(cw){
            cw.setAttribute('data-open','1');
            var tg=cw.querySelector('.codetoggle');
            if(tg) tg.setAttribute('aria-expanded','true');
          });
        }
        if(i<els.length) requestAnimationFrame(step);
        else relayoutTreeHost(host);
      })();
    });
    if(co) co.addEventListener('click',function(){
      var host=activeTreeHost(); if(!host) return;
      $$('.tree-node.expanded',host).forEach(function(el){
        el.classList.remove('expanded');});
      relayoutTreeHost(host);
    });
    if(wd) wd.addEventListener('click',function(){
      var host=activeTreeHost(),cv=treeCanvas(); if(!cv) return;
      var order=['tw-m','tw-l','tw-s'];
      var cur=order.filter(function(c){
        return cv.classList.contains(c);})[0]||'tw-m';
      var nx=order[(order.indexOf(cur)+1)%order.length];
      order.forEach(function(c){cv.classList.remove(c);});
      cv.classList.add(nx);
      syncTreeTools();
      relayoutTreeHost(host);
    });
    if(un) un.addEventListener('click',function(){
      var host=activeTreeHost(); if(!host) return;
      $$('.tree-node.tn-off',host).forEach(function(n){
        n.classList.remove('tn-off');});
      var cv=treeCanvas(); if(cv) cv.classList.remove('has-hidden');
      syncTreeTools();
      relayoutTreeHost(host);
    });
  })();
  /* the ribbon's size steppers, routed by view */
  APP.ribbonSizeStep=function(dir){
    var sh=APP.active&&APP.shells[APP.active];
    var isTree=!!(sh&&sh.el.classList.contains('tree'));
    if(!isTree) return false;
    var host=activeTreeHost(); if(!host) return true;
    if(dir===0) treeZoomSet(host,1); else treeZoomBy(host,dir>0?1.2:1/1.2);
    applyTreeZoomLabel();
    return true;   /* handled: do not also zoom the figures */
  };
  function toggleTree(){
    var sh=APP.active&&APP.shells[APP.active];
    if(!sh) return;
    var on=sh.el.classList.toggle('tree');
    if(on){ sh.el.classList.remove('raw'); buildTree(sh); }
    renderRawBtn();renderViewBtns();
    if(on) relayoutActiveTree();
  }
  if(treeBtn) treeBtn.addEventListener('click',toggleTree);

  /* the code-kind palette — the single JS statement of it. Exported as
     window.SemView.kindFill so deck.js's NODE_FILL shares this table;
     the CSS twin is the --ck-* set on :root in core.css. */
  var TREE_FILL={figure:'#39a9c0',diagnostic:'#39a9c0',dataset:'#4d90c0',
    transform:'#5b7589',metric:'#46a892',note:'#cf9a4e',text:'#8ba0b2',
    imports:'#a3855c','function':'#46a892',data:'#4d90c0',constant:'#9a7cc0',
    settings:'#5b7589',plotting:'#39a9c0',print:'#cf9a4e',code:'#8ba0b2'};
  function treeColor(it){
    if(it.kind==='figure'||it.kind==='diagnostic') return TREE_FILL.figure;
    if(it.kind==='note') return TREE_FILL.note;
    var cks=it.codeKinds||[it.codeKind||'code'];
    return TREE_FILL[cks[0]]||TREE_FILL[it.kind]||'#4a5564';
  }
  var TSVGNS='http://www.w3.org/2000/svg';
  /* host-scoped: works for ANY tree (docs shells and the deck's trace
     tree). rAF can be throttled (background tab / headless) and late
     content (MathJax, image decode) shifts nodes — the timer pass
     re-routes edges regardless; treeLayoutEdges is idempotent + cheap. */
  function relayoutTreeHost(host){
    if(!host) return;
    requestAnimationFrame(function(){treeLayoutEdges(host);});
    setTimeout(function(){treeLayoutEdges(host);},120);
  }
  function relayoutActiveTree(){
    var sh=APP.active&&APP.shells[APP.active];
    if(!sh||!sh.el.classList.contains('tree')) return;
    relayoutTreeHost($('.treeview',sh.el));
  }
  /* tree zoom: CSS zoom on the canvas (layout scales, scrollbars stay
     honest); edges divide their measurements back into layout pixels */
  function treeZoomSet(host,z){
    z=Math.max(0.4,Math.min(2.2,z));
    var canvas=$('.tree-canvas',host); if(!canvas) return;
    canvas.style.zoom=z;
    var zl=$('.tt-zoomval',host);
    if(zl) zl.textContent=Math.round(z*100)+'%';
    relayoutTreeHost(host);
  }
  function treeZoomBy(host,f){
    var canvas=$('.tree-canvas',host); if(!canvas) return;
    treeZoomSet(host,(parseFloat(canvas.style.zoom||'1')||1)*f);
  }
  function buildTree(sh){
    var host=$('.treeview',sh.el); if(!host) return;
    if(host.dataset.built){ relayoutTreeHost(host); return; }
    host.dataset.built='1';
    var items=(sh.data&&sh.data.items)||[];
    /* one node per card that is actually present in this shell's DOM */
    var byAnchor={},nodes=[];
    items.forEach(function(it){
      var card=$('.card[id="card-'+it.card+'"]',sh.el);
      if(!card) return;
      var nd={it:it,card:card,anchor:it.anchor,parents:[],depth:0};
      byAnchor[it.anchor]=nd; nodes.push(nd);
    });
    host.textContent='';
    if(!nodes.length){
      var em=document.createElement('div');em.className='tree-empty';
      em.textContent='No cells to map in this notebook.';
      host.appendChild(em); return;
    }
    var idx={}; nodes.forEach(function(nd,i){idx[nd.anchor]=i;});
    /* ancestors named in each cell's data-flow chain (transitively reduced
       to direct parents) — same shape as the plot-trace dependency graph,
       but over EVERY cell, not one plot's lineage */
    var anc=nodes.map(function(nd){
      var set={};
      (nd.it.chain||[]).forEach(function(a){if(idx[a]!==undefined)set[a]=1;});
      return set;
    });
    nodes.forEach(function(nd,i){
      var a=Object.keys(anc[i]);
      nd.parents=a.filter(function(p){
        return !a.some(function(q){
          return q!==p&&anc[idx[q]]&&anc[idx[q]][p];});
      }).map(function(p){return idx[p];});
    });
    var depth=nodes.map(function(){return -1;});
    function dep(i){
      if(depth[i]>=0) return depth[i];
      depth[i]=0;                        /* cycle guard */
      var m=0; nodes[i].parents.forEach(function(p){m=Math.max(m,dep(p)+1);});
      depth[i]=m; return m;
    }
    nodes.forEach(function(nd,i){nd.depth=dep(i);});
    var maxD=0; nodes.forEach(function(nd){if(nd.depth>maxD)maxD=nd.depth;});
    var lanes=[]; for(var L=0;L<=maxD;L++) lanes.push([]);
    nodes.forEach(function(nd,i){nd.ti=i; lanes[nd.depth].push(nd);});
    /* barycenter pass: order each lane by the mean lane-position of its
       parents, so children sit under their parents and edges cross less */
    var lanePos={};
    lanes.forEach(function(lane,li){
      if(li>0){
        lane.forEach(function(nd,i){nd._o=i;});
        lane.sort(function(a,b){
          function bc(nd){
            var ps=nd.parents.map(function(p){return lanePos[p];})
              .filter(function(v){return v!=null;});
            return ps.length
              ?ps.reduce(function(s,v){return s+v;},0)/ps.length
              :nd._o;
          }
          return (bc(a)-bc(b))||(a._o-b._o);
        });
      }
      lane.forEach(function(nd,i){lanePos[nd.ti]=i;});
    });

    /* ---- toolbar ---- */
    var bar=document.createElement('div');bar.className='tree-toolbar';
    var ttl=document.createElement('span');ttl.className='tt-title';
    ttl.textContent='analysis tree';bar.appendChild(ttl);
    function toolBtn(label,fn){
      var b=document.createElement('button');b.className='tt-btn';
      b.type='button';b.textContent=label;b.addEventListener('click',fn);
      bar.appendChild(b);return b;
    }
    toolBtn('Expand all',function(){
      /* batch across frames — cloning every card at once can jank a big
         notebook; yield between chunks, relayout once at the end */
      var els=$$('.tree-node',host).filter(function(el){
        return !el.classList.contains('tn-off')
          &&!el.classList.contains('expanded');});
      var i=0,BATCH=6;
      (function step(){
        for(var end=Math.min(i+BATCH,els.length);i<end;i++){
          els[i].classList.add('expanded');fillNode(els[i]);}
        if(i<els.length) requestAnimationFrame(step);
        else relayoutTreeHost(host);
      })();
    });
    toolBtn('Collapse all',function(){
      $$('.tree-node.expanded',host).forEach(function(el){
        el.classList.remove('expanded');});
      relayoutTreeHost(host);
    });
    /* zoom lives on the RIBBON in tree view (the Size section's stepper
       drives it), so it is not repeated down here — one control, one
       place, and it does not move when you change view */
    var WNAMES={'tw-s':'S','tw-m':'M','tw-l':'L'};
    var wBtn=toolBtn('Width: M',function(){
      var canvas=$('.tree-canvas',host); if(!canvas) return;
      var order=['tw-m','tw-l','tw-s'];
      var cur=order.filter(function(c){
        return canvas.classList.contains(c);})[0]||'tw-m';
      var nx=order[(order.indexOf(cur)+1)%order.length];
      order.forEach(function(c){canvas.classList.remove(c);});
      canvas.classList.add(nx);
      wBtn.textContent='Width: '+WNAMES[nx];
      relayoutTreeHost(host);
    });
    wBtn.title='Cell width — cycle Small / Medium / Large '
      +'(drag a cell’s corner to size it individually)';
    /* only shown when some cells are eye-hidden — the one-click way back
       (each hidden chip's own eye restores it individually) */
    var unhideBtn=toolBtn('Unhide all',function(){
      $$('.tree-node.tn-off',host).forEach(function(el){
        el.classList.remove('tn-off');});
      updateHiddenNote();relayoutTreeHost(host);
    });
    unhideBtn.style.display='none';
    toolBtn('☲ Present',function(){enterDocPresent();})
      .classList.add('tt-present');
    var hnote=document.createElement('span');hnote.className='tt-hidden-note';
    bar.appendChild(hnote);
    host.appendChild(bar);

    /* ---- scroll + canvas + edge layer ---- */
    var scroll=document.createElement('div');scroll.className='tree-scroll';
    var canvas=document.createElement('div');
    canvas.className='tree-canvas tw-m';   /* medium cell width by default */
    var svg=document.createElementNS(TSVGNS,'svg');
    svg.setAttribute('class','tree-edges');
    canvas.appendChild(svg);

    function fillNode(el){
      var body=$('.tree-node-body',el); if(!body||body.dataset.filled) return;
      body.dataset.filled='1';
      var nd=nodes[+el.dataset.ti]; if(!nd) return;
      var clone=nd.card.cloneNode(true);
      clone.removeAttribute('id');clone.classList.add('in');
      /* the tree is the WHOLE analysis: a node shows its cell in full,
         whatever the document's filters are currently hiding */
      clone.classList.remove('is-hidden','cell-off','collapsed','zoomed');
      clone.style.removeProperty('--fz');
      $$('.code-off',clone).forEach(function(x){
        x.classList.remove('code-off');});
      $$('.part-off,.part-fold,.pt-off,.pt-fold,.ot-off,.ot-fold',clone)
        .forEach(function(x){
          x.classList.remove('part-off','part-fold','pt-off','pt-fold',
            'pt-open','ot-off','ot-fold','ot-open');});
      /* per-output fold stubs are filter chrome, not content */
      $$('.ot-stub',clone).forEach(function(x){x.remove();});
      $$('[id]',clone).forEach(function(x){x.removeAttribute('id');});
      $$('.cell-eye,.plot-trace-btn,.card-anchor,.card-addnote',clone)
        .forEach(function(x){x.remove();});
      body.appendChild(clone);
      /* cloneNode does not copy listeners: re-wire the clone so its code
         toggle / fig-fold / note-expand work (as the Plot-trace tab does) */
      var stem=(sh.data&&sh.data.stem)||sh.el.dataset.nb||'';
      wireCardBehaviors(clone,stem);
      activateOutputs(clone,true);   /* draw plotly specs in the tree node */
      $$('.mdmore',clone).forEach(function(x){x.remove();});
      $$('.cardbody[data-mdclamp]',clone).forEach(function(bd){
        bd.removeAttribute('data-mdclamp');
        bd.classList.remove('mdclamp');bd.classList.remove('mdopen');});
      mdClampScan(clone);
      if(window.MathJax&&MathJax.typesetPromise)
        MathJax.typesetPromise([body]).catch(function(){});
    }
    function updateHiddenNote(){
      var n=$$('.tree-node.tn-off',host).length;
      hnote.classList.toggle('show',n>0);
      hnote.textContent=n?('◉ '+n+' hidden'):'';
      unhideBtn.style.display=n?'':'none';
    }

    /* edges must follow EVERY size change — expanding, MathJax finishing,
       images decoding, corner-resizes, width presets. Watching the nodes
       is the one mechanism that catches all of them. */
    var ro=window.ResizeObserver
      ?new ResizeObserver(function(){relayoutTreeHost(host);}):null;
    host._ro=ro;
    lanes.forEach(function(lane){
      var laneEl=document.createElement('div');laneEl.className='tree-lane';
      lane.forEach(function(nd){
        var el=document.createElement('div');el.className='tree-node';
        if(ro) ro.observe(el);
        el.dataset.ti=nd.ti;
        el.dataset.parents=nd.parents.join(',');
        el.style.setProperty('--nc',treeColor(nd.it));
        var head=document.createElement('div');head.className='tree-node-head';
        var dot=document.createElement('span');dot.className='tn-dot';
        head.appendChild(dot);
        var tw=document.createElement('div');tw.style.flex='1';tw.style.minWidth='0';
        var tt=document.createElement('div');tt.className='tn-title';
        tt.textContent=nd.it.title||nd.anchor;tw.appendChild(tt);
        var kd=document.createElement('div');kd.className='tn-kind';
        kd.textContent=nd.it.kind||'cell';tw.appendChild(kd);
        head.appendChild(tw);
        var eye=document.createElement('button');eye.className='tn-btn tn-eye';
        eye.type='button';eye.innerHTML=bic('eye');eye.title='Hide this cell';
        eye.setAttribute('aria-label','Hide this cell');
        head.appendChild(eye);
        var chev=document.createElement('button');chev.className='tn-btn tn-chev';
        chev.type='button';chev.innerHTML='&#8250;';
        chev.title='Expand to see the cell';
        chev.setAttribute('aria-label','Expand to see the cell');
        head.appendChild(chev);
        var body=document.createElement('div');body.className='tree-node-body';
        el.appendChild(head);el.appendChild(body);
        /* per-cell resize: drag the corner — width, and height of the
           opened body (zoom-corrected deltas) */
        var rs=document.createElement('span');rs.className='tn-resize';
        rs.title='Drag to resize this cell';
        rs.addEventListener('mousedown',function(e){
          e.preventDefault();e.stopPropagation();
          if(!el.classList.contains('expanded')){
            el.classList.add('expanded');fillNode(el);}
          var cv=$('.tree-canvas',host);
          var z=cv?(parseFloat(cv.style.zoom||'1')||1):1;
          var sw=el.getBoundingClientRect().width/z;
          var sh0=body.getBoundingClientRect().height/z;
          var sx=e.clientX,sy=e.clientY;
          function mm(ev){
            el.style.width=Math.max(200,
              Math.min(900,sw+(ev.clientX-sx)/z))+'px';
            body.style.maxHeight=Math.max(120,
              Math.min(1400,sh0+(ev.clientY-sy)/z))+'px';
          }
          function mu(){
            document.removeEventListener('mousemove',mm);
            document.removeEventListener('mouseup',mu);
            relayoutTreeHost(host);
          }
          document.addEventListener('mousemove',mm);
          document.addEventListener('mouseup',mu);
        });
        el.appendChild(rs);
        head.addEventListener('click',function(e){
          if(e.target.closest('.tn-eye')) return;
          if(el.classList.contains('tn-off')) return;
          var open=el.classList.toggle('expanded');
          if(open) fillNode(el);
          relayoutTreeHost(host);
        });
        eye.addEventListener('click',function(e){
          e.stopPropagation();
          var off=el.classList.toggle('tn-off');
          if(off){el.classList.remove('expanded');
            eye.title='Show this cell';}
          else eye.title='Hide this cell';
          updateHiddenNote();relayoutTreeHost(host);
        });
        el.addEventListener('mouseenter',function(){litEdges(host,nd.ti,true);});
        el.addEventListener('mouseleave',function(){litEdges(host,nd.ti,false);});
        laneEl.appendChild(el);
      });
      canvas.appendChild(laneEl);
    });
    scroll.appendChild(canvas);host.appendChild(scroll);
    if(ro) ro.observe(canvas);   /* window resizes shift lanes too */
    relayoutTreeHost(host);
  }
  function litEdges(host,ti,on){
    var el=$('.tree-node[data-ti="'+ti+'"]',host);
    if(el) el.classList.toggle('active',on);
    $$('.tree-edge',host).forEach(function(p){
      if(p.dataset.from===String(ti)||p.dataset.to===String(ti))
        p.classList.toggle('lit',on);
    });
  }
  function treeLayoutEdges(host){
    var svg=$('.tree-edges',host),canvas=$('.tree-canvas',host);
    if(!svg||!canvas) return;
    var cb=canvas.getBoundingClientRect();
    if(!cb.width) return;                 /* not visible yet */
    var W=canvas.scrollWidth,H=canvas.scrollHeight;
    svg.setAttribute('viewBox','0 0 '+W+' '+H);
    svg.setAttribute('width',W);svg.setAttribute('height',H);
    svg.style.width=W+'px';svg.style.height=H+'px';   /* px, not 100%, so the
      viewBox maps 1:1 even when lanes overflow and the canvas scrolls */
    while(svg.firstChild) svg.removeChild(svg.firstChild);
    /* measurements come back in VISUAL px — divide by the canvas zoom to
       get layout px, the space the SVG viewBox lives in */
    var z=parseFloat(canvas.style.zoom||'1')||1;
    var heads={};
    $$('.tree-node',host).forEach(function(el){
      var h=$('.tree-node-head',el); if(!h) return;
      var r=h.getBoundingClientRect();
      heads[el.dataset.ti]={
        cx:(r.left-cb.left+r.width/2)/z+canvas.scrollLeft,
        top:(r.top-cb.top)/z+canvas.scrollTop,
        bot:(r.bottom-cb.top)/z+canvas.scrollTop,
        /* the node's own type colour, so its incoming branch can carry it */
        nc:el.style.getPropertyValue('--nc')
          ||getComputedStyle(el).getPropertyValue('--nc'),
        off:el.classList.contains('tn-off')};
    });
    $$('.tree-node',host).forEach(function(el){
      var ci=heads[el.dataset.ti]; if(!ci) return;
      (el.dataset.parents||'').split(',').filter(Boolean).forEach(function(pi){
        var pr=heads[pi]; if(!pr) return;
        var x1=pr.cx,y1=pr.bot,x2=ci.cx,y2=ci.top,mid=(y1+y2)/2;
        var path=document.createElementNS(TSVGNS,'path');
        path.setAttribute('class','tree-edge'+((ci.off||pr.off)?' dim':''));
        /* a branch takes the colour of what it PRODUCES — the child — so
           you can follow "where do the figures come from" by colour alone,
           and the lanes read as coloured flows rather than one grey mesh.
           The .lit hover and .dim states still override it in CSS. */
        var nc=(el.style.getPropertyValue('--nc')||ci.nc||'').trim();
        if(nc) path.style.stroke=nc;
        path.setAttribute('d','M'+x1+' '+y1+' C'+x1+' '+mid+' '
          +x2+' '+mid+' '+x2+' '+y2);
        path.dataset.from=pi;path.dataset.to=el.dataset.ti;
        svg.appendChild(path);
      });
    });
  }

  /* ---- present (full-screen) mode for the active document ---- */
  var docsEl=$('#docs');
  /* The present bar carries the REAL filter controls: they are moved out of
     the appbar on enter and put back (in place) on exit, so every existing
     handler, menu and state read keeps working — no duplicate widgets. */
  var pbMoved=[];
  /* move the whole LABELLED SECTIONS, not the bare groups inside them.
     Moving the inner groups left their .abgrp wrappers behind, so the
     present bar lost the ribbon's grid: the two size steppers stopped
     being stacked, Raw/Tree came apart from Present, and the section
     names (FILTERS / SIZE / VIEW) vanished. Now the bar IS the ribbon. */
  var PB_TOOLS=['#ab-filters','#ab-scope','#ab-size','#ab-view'];
  var PB_MENUS=['#ck-filter-menu','#pt-filter-menu','#ot-filter-menu',
                '#sec-scope-menu'];
  function pbTakeTools(){
    var host=$('#pb-tools'); if(!host) return;
    pbMoved=[];
    PB_TOOLS.forEach(function(sel){
      var el=$(sel); if(!el) return;
      pbMoved.push({el:el,parent:el.parentNode,next:el.nextSibling});
      host.appendChild(el);
    });
    /* the dropdowns are position:fixed at body level — inside a fullscreen
       #docs they would paint UNDER the top layer, so they ride along */
    PB_MENUS.forEach(function(sel){
      var m=$(sel); if(!m||!docsEl) return;
      pbMoved.push({el:m,parent:m.parentNode,next:m.nextSibling});
      m.hidden=true;docsEl.appendChild(m);
    });
  }
  function pbReturnTools(){
    /* restore in reverse so each insertBefore anchor is still valid */
    pbMoved.slice().reverse().forEach(function(m){
      if(!m.parent) return;
      if(m.el.classList.contains('ckfilter-menu')) m.el.hidden=true;
      if(m.next&&m.next.parentNode===m.parent)
        m.parent.insertBefore(m.el,m.next);
      else m.parent.appendChild(m.el);
    });
    pbMoved=[];
  }
  function enterDocPresent(){
    var sh=APP.active&&APP.shells[APP.active]; if(!sh) return;
    document.body.classList.add('doc-presenting');
    document.body.classList.remove('pb-folded');
    pbTakeTools();
    /* the controls must live INSIDE #docs: when #docs goes fullscreen it is
       promoted to the browser top layer, and a sibling bar would render
       beneath it (dead). As descendants they join the top layer. */
    var pb=$('#present-bar'); if(pb){pb.hidden=false;
      if(docsEl) docsEl.appendChild(pb);}
    var pbs=$('#present-bar-show'); if(pbs){pbs.hidden=false;
      if(docsEl) docsEl.appendChild(pbs);}
    renderViewBtns();
    if(APP.applyPbDock) APP.applyPbDock();   /* size the inset */
    relayoutActiveTree();
    try{
      if(docsEl&&docsEl.requestFullscreen&&!document.fullscreenElement)
        docsEl.requestFullscreen().catch(function(){});
    }catch(e){}
  }
  function exitDocPresent(){
    if(!document.body.classList.contains('doc-presenting')) return;
    document.body.classList.remove('doc-presenting');
    document.body.classList.remove('pb-folded');
    document.body.classList.remove('present-rail');
    pbReturnTools();
    renderViewBtns();   /* the Tree button must work again immediately */
    var pb=$('#present-bar'); if(pb){pb.hidden=true;
      document.body.appendChild(pb);}
    var pbs=$('#present-bar-show'); if(pbs){pbs.hidden=true;
      document.body.appendChild(pbs);}
    try{if(document.fullscreenElement) document.exitFullscreen().catch(function(){});}
    catch(e){}
    relayoutActiveTree();
  }
  var dpBtn=$('#doc-present');
  if(dpBtn) dpBtn.addEventListener('click',enterDocPresent);
  (function(){
    var x=$('#pb-exit'); if(x) x.addEventListener('click',exitDocPresent);
    /* deliberately NO #pb-view: while presenting, the ribbon's whole View
       section (Raw / Tree / Present) MOVES into this bar, so there is
       never a second Tree button with a second name */
    var rl=$('#pb-rail');
    if(rl){
      rl.setAttribute('aria-pressed','false');
      rl.addEventListener('click',function(){
        var on=document.body.classList.toggle('present-rail');
        rl.setAttribute('aria-pressed',on.toString());
        rl.title=on?'Hide the section sidebar':'Show the section sidebar';
        relayoutActiveTree();
      });
    }
    /* the two dock icons (SemIcons dockright / docktop), swapped in
       place so the glyph always shows the edge the button would move
       the bar TO. The path data used to be copied here as PB_ICO;
       branding.py is the only place it lives now (2026-08-23). */
    /* dock across the top (where it IS the app bar) or down the right
       (where the groups become rows) — remembered between talks */
    var PKEY='junoview:presentbar:dock';
    var pbDock='top';
    try{pbDock=(localStorage.getItem(PKEY)==='right')?'right':'top';}
    catch(e){}
    /* the document is inset by the bar's real size, so the bar never
       covers content — measured, because the bar wraps to fit */
    function measurePb(){
      var bar=$('#present-bar');
      if(!bar||bar.hidden) return;
      var r=bar.getBoundingClientRect();
      if(pbDock==='top'){
        document.body.style.setProperty('--pbh',Math.ceil(r.height)+'px');
        /* Exit and the fold button are PINNED to the top-right corner, out
           of the wrap flow, so that a narrow window can never push the way
           out onto a second row. Being out of flow, they reserve no space:
           measure what they occupy and pad the bar by it, or the buttons
           that did stay in the flow render underneath them. */
        var ex=$('#pb-exit');
        document.body.style.setProperty('--pb-corner', ex
          ? Math.ceil(window.innerWidth-ex.getBoundingClientRect().left)+10+'px'
          : '60px');
      }
      else
        document.body.style.setProperty('--pbw',Math.ceil(r.width)+'px');
    }
    function applyPbDock(){
      document.body.classList.toggle('pbpos-top',pbDock==='top');
      document.body.classList.toggle('pbpos-right',pbDock==='right');
      var mv=$('#pb-move');
      if(mv){
        /* name the DESTINATION, never the current position: "Dock right"
           while docked right reads as a state, and the user cannot tell
           whether it is telling them where the bar is or offering to move
           it. "Move right" / "Move to top" can only be an action. */
        /* icon-only: the glyph IS the destination edge, and the title
           still says it in words. The present bar is the tightest bar we
           have — these words cost it the Exit button's place on line 1. */
        var mi=mv.querySelector('.bic');
        var mh=(pbDock==='top')?bic('dockright'):bic('docktop');
        if(mi&&mh) mi.outerHTML=mh;   /* whole-node swap: bic() is the
                                         full <svg>, not inner paths */
        mv.title=(pbDock==='top')
          ?'Move these controls down the right-hand side'
          :'Move these controls back across the top';
      }
      if(APP.syncPbToggle) APP.syncPbToggle();
      try{localStorage.setItem(PKEY,pbDock);}catch(e){}
      measurePb();relayoutActiveTree();
      setTimeout(measurePb,60);   /* after the wrap settles */
    }
    var mv=$('#pb-move');
    if(mv) mv.addEventListener('click',function(){
      pbDock=(pbDock==='top')?'right':'top';applyPbDock();});
    APP.applyPbDock=applyPbDock;
    APP.measurePb=measurePb;
    window.addEventListener('resize',function(){
      if(document.body.classList.contains('doc-presenting')) measurePb();});
    applyPbDock();
    /* one button, one place: it folds the bar away and brings it back */
    var s=$('#present-bar-show');
    /* Is the bar actually on screen right now? Auto-hide and an explicit
       fold are two different mechanisms and BOTH move it, so the handle
       has to ask about the result, not about one flag. */
    function pbHidden(){
      return document.body.classList.contains('pb-folded')
        ||(pbAuto&&!document.body.classList.contains('pb-peek'));
    }
    function syncToggleBtn(){
      if(!s) return;
      var hidden=pbHidden();
      /* never a hamburger: ☰ is the OUTLINE button's glyph, and two
         controls wearing the same symbol is what made this one look
         broken. A chevron points the way the bar will travel. */
      s.innerHTML=hidden
        ?(pbDock==='top'?'&#9660;':'&#9664;')
        :(pbDock==='top'?'&#9650;':'&#9654;');
      s.title=hidden?'Show the presenting controls'
        :'Hide the presenting controls';
      s.setAttribute('aria-expanded',(!hidden).toString());
    }
    if(s) s.addEventListener('click',function(){
      /* it used to just toggle pb-folded — which auto-hide (the default)
         overrode with !important, so the button did nothing at all */
      if(pbHidden()){
        document.body.classList.remove('pb-folded');
        if(pbAuto) document.body.classList.add('pb-peek');
      } else {
        document.body.classList.add('pb-folded');
        document.body.classList.remove('pb-peek');
      }
      syncToggleBtn();measurePb();relayoutActiveTree();});
    APP.syncPbToggle=syncToggleBtn;
    /* ---- auto-hide is the DEFAULT while presenting (the slide is the
       point, not the chrome); "Pin" keeps the bar in place, the way a
       taskbar or a docked panel does ---- */
    var AKEY='junoview:presentbar:pinned';
    var pbPinned=false;
    try{pbPinned=localStorage.getItem(AKEY)==='1';}catch(e){}
    var pbAuto=!pbPinned;
    function applyAuto(){
      pbAuto=!pbPinned;
      document.body.classList.toggle('pb-auto',pbAuto);
      var ab=$('#pb-auto');
      if(ab){
        /* the button is called "Auto-hide", so PRESSED must mean auto-hide
           is on — it used to mean "pinned", the exact opposite */
        ab.setAttribute('aria-pressed',pbAuto?'true':'false');
        ab.title=pbAuto
          ?'Auto-hide is on: the bar slides away and comes back when you '
            +'move to its edge. Click to keep it in place.'
          :'The bar stays in place. Click to let it hide itself again.';
      }
      if(!pbAuto) document.body.classList.remove('pb-peek');
      try{localStorage.setItem(AKEY,pbPinned?'1':'0');}catch(e){}
      measurePb();relayoutActiveTree();
    }
    var ab=$('#pb-auto');
    if(ab) ab.addEventListener('click',function(){
      pbPinned=!pbPinned;
      if(!pbPinned) document.body.classList.remove('pb-folded');
      applyAuto();syncToggleBtn();
    });
    document.addEventListener('mousemove',function(e){
      if(!pbAuto||!document.body.classList.contains('doc-presenting'))
        return;
      var bar=$('#present-bar');
      var peeking=document.body.classList.contains('pb-peek');
      var near=(pbDock==='top')?(e.clientY<=4)
        :(e.clientX>=window.innerWidth-4);
      if(near){
        if(!peeking) document.body.classList.add('pb-peek');
        return;
      }
      if(!peeking||!bar) return;
      /* leave a margin so the bar does not vanish the instant you aim
         at a button near its edge */
      var r=bar.getBoundingClientRect();
      var out=e.clientX<r.left-40||e.clientX>r.right+40
        ||e.clientY<r.top-40||e.clientY>r.bottom+40;
      if(out) document.body.classList.remove('pb-peek');
    });
    applyAuto();syncToggleBtn();
  })();
  document.addEventListener('fullscreenchange',function(){
    if(!document.fullscreenElement
       &&document.body.classList.contains('doc-presenting'))
      exitDocPresent();
  });
  document.addEventListener('keydown',function(e){
    if(e.key==='Escape'&&document.body.classList.contains('doc-presenting')){
      exitDocPresent();
    }
  });
  var treeRelayoutTimer=null;
  window.addEventListener('resize',function(){
    if(treeRelayoutTimer) clearTimeout(treeRelayoutTimer);
    treeRelayoutTimer=setTimeout(relayoutActiveTree,120);
  });
  window.SemView={tree:toggleTree,present:enterDocPresent,
    exitPresent:exitDocPresent,buildTree:buildTree,kindFill:TREE_FILL};

  /* ---- theme toggle (chrome only; the slide canvas stays dark) --- */
  function applyTheme(light){
    document.body.classList.toggle('light',light);

    try{localStorage.setItem('plotline-theme',
      light?'light':'dark');}catch(e){}
  }
  var themePref=null;
  try{themePref=localStorage.getItem('plotline-theme');}catch(e){}


  /* ---- colour SCHEMES: a body class re-defining the chrome tokens.
     Chrome only — content and exports keep their own colours, or a
     swatch would lie about what it applies (2026-08-18). ---- */
  /* ONE list. Light and dark are themes, not a separate toggle — a
     theme is "how the whole chrome looks", and dark-vs-light is exactly
     that (2026-08-19, user). Each entry is [classes, name, preview]. */
  var SCHEMES=[
    ['','Dark',['#39a9c0','#0e1926']],
    ['light','Light',['#1f7e93','#fbfcfd']],
    ['th-forest','Dark forest',['#41c493','#0c211a']],
    ['light th-lforest','Light forest',['#1e8f66','#f7fbf8']],
    ['th-forestblue','Dark forest, blue buttons',['#6b9bff','#0c211a']],
    ['th-colorful','Dark colourful',['#f0a848','#6b9bff','#41c493',
      '#e06a9a']],
    ['th-contrast','Dark high contrast',['#6fe3ff','#ffffff']]];
  var ALL_TH=['light','th-forest','th-lforest','th-forestblue',
    'th-colorful','th-contrast'];
  function applyScheme(id){
    var want=id?id.split(' '):[];
    ALL_TH.forEach(function(cl){
      document.body.classList.toggle(cl,want.indexOf(cl)>=0);});
    /* the old standalone theme key follows along, so anything still
       reading it (and older sessions) agrees about light vs dark */
    applyTheme(want.indexOf('light')>=0);
    try{localStorage.setItem('plotline-scheme',id);}catch(e){}
  }
  var schemePref=null;
  try{schemePref=localStorage.getItem('plotline-scheme');}catch(e){}
  if(schemePref!=null&&schemePref!=='') applyScheme(schemePref);
  else if(themePref==='light') applyScheme('light');
  var schemeMenu=null;
  function openSchemeMenu(btn){
    if(schemeMenu){schemeMenu.remove();schemeMenu=null;return;}
    var m=document.createElement('div');m.className='jv-scheme-menu';
    var cur='';
    try{cur=localStorage.getItem('plotline-scheme')||'';}catch(e){}
    SCHEMES.forEach(function(sc){
      var o=document.createElement('button');o.className='jv-scheme-opt';
      o.setAttribute('aria-pressed',(sc[0]===cur).toString());
      var dots=document.createElement('span');dots.className='jv-scheme-dots';
      sc[2].forEach(function(col){
        var i2=document.createElement('i');i2.style.background=col;
        dots.appendChild(i2);});
      var t2=document.createElement('span');t2.textContent=sc[1];
      o.appendChild(dots);o.appendChild(t2);
      o.addEventListener('click',function(){
        applyScheme(sc[0]);m.remove();schemeMenu=null;});
      m.appendChild(o);
    });
    document.body.appendChild(m);
    var r=btn.getBoundingClientRect();
    m.style.top=(r.bottom+6)+'px';
    m.style.left=Math.max(8,Math.min(innerWidth-m.offsetWidth-8,
      r.right-m.offsetWidth))+'px';
    schemeMenu=m;
    setTimeout(function(){
      document.addEventListener('click',function once(e){
        if(!m.contains(e.target)){m.remove();schemeMenu=null;}
        document.removeEventListener('click',once);
      });
    },0);
  }
  var deckScheme=$('#deck-scheme');
  if(deckScheme) deckScheme.addEventListener('click',function(e){
    e.stopPropagation();openSchemeMenu(deckScheme);});
  var abScheme=$('#scheme-btn');
  if(abScheme) abScheme.addEventListener('click',function(e){
    e.stopPropagation();openSchemeMenu(abScheme);});
  /* ---- the Variables PANE: the sidebar tab, detached. The panel node
     MOVES (never copies), so the filter, the ordering and every
     jump-to-cell link keep their wiring; it moves home when the pane
     closes or the tab changes (2026-08-18, user: "should be another
     thing on rhs that can be opened"). ---- */
  (function(){
    var btn=$('#vars-btn'),pane=$('#varspane'),body=$('#varspane-body');
    var cl=$('#varspane-close');
    if(!btn||!pane||!body) return;
    var home=null;
    function currentPanel(){
      var sh=document.querySelector('.shell:not([hidden]) .varpanel');
      return sh||document.querySelector('.varpanel');
    }
    function giveBack(){
      var vp=body.querySelector('.varpanel');
      if(vp&&home){home.parent.insertBefore(vp,home.next);vp.hidden=true;}
      home=null;
    }
    function set(open){
      if(open){
        giveBack();
        var vp=currentPanel();
        if(!vp){toast?toast('No notebook open'):0;return;}
        home={parent:vp.parentNode,next:vp.nextSibling};
        body.appendChild(vp);
        vp.hidden=false;
      } else giveBack();
      pane.hidden=!open;
      btn.setAttribute('aria-pressed',open.toString());
    }
    btn.addEventListener('click',function(){set(pane.hidden);});
    if(cl) cl.addEventListener('click',function(){set(false);});
    /* a tab switch swaps which notebook's variables you are looking at */
    document.addEventListener('sem:shell',function(){
      if(!pane.hidden) set(true);
    });
  })();
  /* support from inside the editor: same destination as the app-bar
     heart, resolved from it so the URL lives in one place */
  var dSup=$('#deck-support'),aSup=$('#support-btn');
  if(dSup&&aSup&&aSup.href) dSup.href=aSup.href;
  else if(dSup) dSup.hidden=true;
  window.SemTheme={applyTheme:applyTheme,applyScheme:applyScheme,
    schemes:SCHEMES};

  /* ---- builder panel width: draggable right edge, persisted ------- */
  var dcR=$('#dc-resize');
  var dcwPref=null;
  try{dcwPref=parseInt(localStorage.getItem('plotline-dcw'),10);}
  catch(e){}
  if(dcwPref&&dcwPref>=300&&dcwPref<=760)
    document.documentElement.style.setProperty('--dc-w',dcwPref+'px');
  if(dcR) dcR.addEventListener('mousedown',function(e){
    e.preventDefault();
    dcR.classList.add('on');
    var host=$('#deck-create');
    var left=host?host.getBoundingClientRect().left:0;
    var w=0;
    function mv(ev){
      w=Math.max(300,Math.min(760,ev.clientX-left));
      document.documentElement.style.setProperty('--dc-w',w+'px');
    }
    function up(){
      dcR.classList.remove('on');
      document.removeEventListener('mousemove',mv);
      document.removeEventListener('mouseup',up);
      if(w) try{localStorage.setItem('plotline-dcw',w);}catch(e){}
    }
    document.addEventListener('mousemove',mv);
    document.addEventListener('mouseup',up);
  });

  /* ---- instant tooltips: every [title] becomes a styled tip ------- */
  var tipEl=document.createElement('div');
  tipEl.className='apptip';
  document.body.appendChild(tipEl);
  var tipTimer=null,tipTarget=null;
  function hideTip(){
    clearTimeout(tipTimer);tipTimer=null;
    tipTarget=null;tipEl.style.display='none';
  }
  document.addEventListener('mouseover',function(e){
    var t=e.target.closest&&e.target.closest('[title],[data-tip]');
    if(!t){hideTip();return;}
    if(t===tipTarget) return;
    if(t.hasAttribute&&t.hasAttribute('title')){
      var tt=t.getAttribute('title');
      if(tt) t.setAttribute('data-tip',tt);
      t.removeAttribute('title');
    }
    var tip=t.getAttribute&&t.getAttribute('data-tip');
    if(!tip){hideTip();return;}
    tipTarget=t;
    clearTimeout(tipTimer);
    tipTimer=setTimeout(function(){
      if(tipTarget!==t||!document.contains(t)){return;}
      tipEl.textContent=tip;
      /* a control with a shortcut says so IN its tooltip: the key is
         only discoverable where you'd already be looking */
      var kb=t.getAttribute&&t.getAttribute('data-kbd');
      if(kb){
        var kEl=document.createElement('kbd');
        kEl.className='apptip-kbd';kEl.textContent=kb;
        tipEl.appendChild(kEl);
      }
      tipEl.style.display='block';
      var r=t.getBoundingClientRect();
      var tw=tipEl.offsetWidth,th=tipEl.offsetHeight;
      var x=r.left+r.width/2-tw/2;
      x=Math.max(6,Math.min(window.innerWidth-tw-6,x));
      var y=r.bottom+8;
      if(y+th>window.innerHeight-6) y=r.top-th-8;
      tipEl.style.left=x+'px';
      tipEl.style.top=Math.max(6,y)+'px';
    },220);
  });
  document.addEventListener('mouseout',function(e){
    if(tipTarget&&!tipTarget.contains(e.relatedTarget)) hideTip();
  });
  document.addEventListener('mousedown',hideTip,true);
  document.addEventListener('scroll',hideTip,true);

  /* ---- keyboard shortcuts (2026-08-04): conventional keys only — the
     four filters by their initials, R/T for the views, F to present
     (the fullscreen convention), ? for help, Ctrl+B for the sidebar
     (VS Code), Ctrl+O to open, +/−/0 for figure size (the zoom
     convention). A shortcut FIRES ITS BUTTON (el.click()) so behaviour
     can never drift from the control it mirrors, and every one is
     advertised as a key chip in that control's own tooltip (data-kbd)
     and in Help. The deck editor owns its own keys (deck.js). ---- */
  var APP_KEYS=[
    {k:'P',sel:'#tv-plots'},{k:'M',sel:'#tv-markdown'},
    {k:'C',sel:'#tv-code'},{k:'O',sel:'#tv-output'},
    {k:'R',sel:'#view-raw'},{k:'T',sel:'#view-tree'},
    {k:'F',sel:'#doc-present'},{k:'?',sel:'#help-btn'},
    {k:'Ctrl+B',sel:'#menubtn'},{k:'Ctrl+O',sel:'#tab-open'},
    {k:'+',sel:'#fig-bigger'},{k:'-',sel:'#fig-smaller'},
    {k:'0',sel:'#fig-size-val'}];
  APP_KEYS.forEach(function(s){
    var el=$(s.sel); if(el) el.dataset.kbd=s.k;});
  document.addEventListener('keydown',function(e){
    if(e.defaultPrevented||e.altKey) return;
    var t=e.target;
    if(t&&t.closest&&t.closest('input,textarea,select')) return;
    if(t&&t.isContentEditable) return;
    /* the DOCUMENT's keys: not while presenting, editing a deck,
       picking a cell, or on the welcome screen */
    var b=document.body.classList;
    if(b.contains('doc-presenting')||b.contains('deck-open')
       ||b.contains('creating-docs')||b.contains('slide-editing')
       ||b.contains('picking')||b.contains('welcoming')) return;
    var ctrl=e.ctrlKey||e.metaKey;
    var combo=(ctrl?'Ctrl+':'')
      +(e.key.length===1?e.key.toUpperCase():e.key);
    for(var i=0;i<APP_KEYS.length;i++){
      if(APP_KEYS[i].k!==combo) continue;
      var el=$(APP_KEYS[i].sel);
      if(!el||el.hidden||el.disabled) return;
      e.preventDefault();el.click();
      return;
    }
  });

  /* ---- guided tour: a spotlight + tooltip that steps through the UI;
     skippable, shown once, or re-run from "Take a tour" ---- */
  var TOUR_STEPS=[
    {title:'Welcome to Junoview',
     text:'A figure-first view of your notebooks, plus a presentation '
       +'builder. Here is a quick tour — skip it anytime.'},
    {sel:'#tabstrip',title:'Notebooks are tabs',
     text:'Every notebook you open is a tab. Drop .ipynb files anywhere on '
       +'the window, or use + Open.'},
    {sel:'#tv-code',title:'Filter what you see',
     text:'Plots, Markdown, Code and Output each cycle Visible → '
       +'Collapsed → Hidden. Code folds the source in EVERY cell at once.'},
    {sel:'#ot-filter-btn',title:'Fine-tune by type',
     text:'The Code types and Output types menus hide specific kinds — '
       +'imports, plotting, print, dataset, error…'},
    {sel:'.rail .nav',title:'The sidebar',
     text:'A key at the top; collapse or hide a whole section (also from its '
       +'heading in the document), and an eye beside every cell to hide just '
       +'that one — hidden things stay here so you can bring them back.'},
    {sel:'.plot-trace-btn',title:'Trace a plot',
     text:'Plot trace opens a new tab with just the cells that build a '
       +'plot — its whole lineage — plus a dependency graph. Every filter '
       +'still works there.'},
    {sel:'#pr-docs,.presrail,#presrail',title:'Build presentations',
     text:'The left rail holds presentations. Lay out slides, drop in cards '
       +'from any open notebook, and present full screen.'},
    {sel:'#help-btn',title:'Help & support',
     text:'Full docs live here. If Junoview helps you, Support funds a '
       +'hosted version with accounts — thank you!'}
  ];
  var tourI=0;
  function tourRect(step){
    if(!step.sel) return null;
    var el=$(step.sel);
    if(!el||el.hidden||el.offsetParent===null) return null;
    var r=el.getBoundingClientRect();
    if(r.width===0&&r.height===0) return null;
    return r;
  }
  function tourShow(i){
    var steps=TOUR_STEPS,dir=(i>=tourI)?1:-1;
    while(i>=0&&i<steps.length){
      if(!steps[i].sel||tourRect(steps[i])) break;
      i+=dir;
    }
    if(i>=steps.length){tourEnd();return;}
    if(i<0) i=0;
    tourI=i;
    var step=steps[i],tour=$('#tour'),hole=$('#tour-hole'),tip=$('#tour-tip');
    if(!tour) return;
    tour.hidden=false;
    $('#tour-step').textContent=(i+1)+' / '+steps.length;
    $('#tour-title').textContent=step.title;
    $('#tour-text').textContent=step.text;
    var back=$('#tour-back'),next=$('#tour-next');
    if(back) back.style.visibility=i>0?'visible':'hidden';
    if(next) next.textContent=(i===steps.length-1)?'Done':'Next';
    var r=tourRect(step);
    var tw=Math.min(400,window.innerWidth*0.90),th=tip.offsetHeight||170;
    if(r){
      var pad=6;
      hole.classList.remove('center');
      hole.style.left=(r.left-pad)+'px';hole.style.top=(r.top-pad)+'px';
      hole.style.width=(r.width+pad*2)+'px';
      hole.style.height=(r.height+pad*2)+'px';
      var top=(r.bottom+th+16<window.innerHeight)?r.bottom+12
        :(r.top-th-16>0)?r.top-th-12:Math.max(12,(window.innerHeight-th)/2);
      var left=Math.min(Math.max(12,r.left),window.innerWidth-tw-12);
      tip.style.left=left+'px';tip.style.top=top+'px';tip.style.transform='none';
    } else {
      hole.classList.add('center');
      hole.style.left='50%';hole.style.top='50%';
      hole.style.width='0px';hole.style.height='0px';
      tip.style.left='50%';tip.style.top='50%';
      tip.style.transform='translate(-50%,-50%)';
    }
  }
  function tourStart(){
    var hd=$('#helpdlg'); if(hd) hd.hidden=true;
    var wl=$('#welcome'); /* keep welcome as the backdrop is fine */
    tourI=0;tourShow(0);
  }
  function tourEnd(){
    var t=$('#tour'); if(t) t.hidden=true;
    try{localStorage.setItem('plotline-tour','1');}catch(e){}
  }
  (function(){
    var nx=$('#tour-next'),bk=$('#tour-back'),sk=$('#tour-skip');
    if(nx) nx.addEventListener('click',function(){
      if(tourI>=TOUR_STEPS.length-1) tourEnd(); else tourShow(tourI+1);});
    if(bk) bk.addEventListener('click',function(){tourShow(tourI-1);});
    if(sk) sk.addEventListener('click',tourEnd);
    document.addEventListener('keydown',function(e){
      var t=$('#tour'); if(!t||t.hidden) return;
      if(e.key==='Escape'){e.preventDefault();tourEnd();}
      else if(e.key==='ArrowRight'||e.key==='Enter'){e.preventDefault();
        if(tourI>=TOUR_STEPS.length-1) tourEnd(); else tourShow(tourI+1);}
      else if(e.key==='ArrowLeft'){e.preventDefault();tourShow(tourI-1);}
    });
    window.addEventListener('resize',function(){
      var t=$('#tour'); if(t&&!t.hidden) tourShow(tourI);});
    var wt=$('#welcome-tour');
    if(wt) wt.addEventListener('click',function(e){e.preventDefault();tourStart();});
    var ht=$('#help-tour');
    if(ht) ht.addEventListener('click',function(e){e.preventDefault();tourStart();});
  })();
  function maybeAutoTour(){
    try{if(localStorage.getItem('plotline-tour')) return;}catch(e){}
    if(!APP.order.length) return;       /* wait until there is content to tour */
    try{localStorage.setItem('plotline-tour','1');}catch(e){}
    setTimeout(function(){if($('#tour')) tourStart();},700);
  }
  APP.startTour=tourStart;
  document.addEventListener('sem:activate',maybeAutoTour);

  /* ---- figure pager: ‹ › flips between figures of one cell -------- */
  /* delegated so it works in cloned slide frames too */
  document.addEventListener('click',function(e){
    var b=e.target.closest&&e.target.closest('.fp-btn');
    if(!b) return;
    var pg=b.closest('.figpager'); if(!pg) return;
    e.preventDefault();e.stopPropagation();
    var pages=[].slice.call(pg.querySelectorAll(':scope > .figpage'));
    /* pages whose plot type is filtered out are skipped by the pager */
    var vis=pages.filter(function(p){
      return !p.classList.contains('pt-off');});
    if(!vis.length) return;
    var curEl=pg.querySelector(':scope > .figpage.current');
    var ci=curEl?vis.indexOf(curEl):0; if(ci<0) ci=0;
    var nx=(ci+(b.classList.contains('fp-next')?1:-1)
      +vis.length)%vis.length;
    if(curEl) curEl.classList.remove('current');
    vis[nx].classList.add('current');
    var ct=pg.querySelector('.fp-count');
    if(ct) ct.textContent=(nx+1)+' / '+vis.length;
    /* a live embed (plotly/bokeh/…) drawn while its page was display:none
       has no size — draw it now it is visible, and resize what's drawn */
    var page=vis[nx];
    if(window.SemActivate) window.SemActivate(page,true);
    if(window.Plotly&&window.Plotly.Plots)
      [].forEach.call(page.querySelectorAll('.js-plotly-plot'),
        function(g){try{window.Plotly.Plots.resize(g);}catch(err){}});
    try{window.dispatchEvent(new Event('resize'));}catch(err){}
  },true);

  /* ---- raw-HTML notes: toggle rendered <-> source ----------------- */
  document.addEventListener('click',function(e){
    var b=e.target.closest&&e.target.closest('.htmltoggle');
    if(!b) return;
    e.preventDefault();e.stopPropagation();
    var card=b.closest('.card');
    if(card) card.classList.toggle('showhtml');
  },true);

  /* ---- presentations rail: full -> icons -> hidden (edge handle
     brings it back) ---- */
  /* ---- rail auto-hide: opt-in, remembered, and it never fights the
     collapse states (turning it on leaves them alone). Wired + applied
     from the boot tail, not at this point in the file — it used to be a
     sub-IIFE running its apply() at load (same trap deck.js's boot
     sequence exists to end). ---- */
  function initRailAuto(){
    var AK='junoview:presrail:auto';
    var btn=$('#pr-auto'),on=false;
    try{on=localStorage.getItem(AK)==='1';}catch(e){}
    function apply(){
      document.body.classList.toggle('prrail-auto',on);
      if(!on) document.body.classList.remove('prrail-peek');
      if(btn) btn.setAttribute('aria-pressed',on?'true':'false');
      try{localStorage.setItem(AK,on?'1':'0');}catch(e){}
      if(APP.measureChrome) APP.measureChrome();
    }
    if(btn) btn.addEventListener('click',function(e){
      e.stopPropagation();on=!on;apply();});
    document.addEventListener('mousemove',function(e){
      if(!on) return;
      var peek=document.body.classList.contains('prrail-peek');
      if(!peek&&e.clientX<=4) document.body.classList.add('prrail-peek');
      else if(peek&&e.clientX>Math.max(200,
        (($('#presrail')||{}).getBoundingClientRect
          ?$('#presrail').getBoundingClientRect().right:200)+40))
        document.body.classList.remove('prrail-peek');
    });
    apply();
  }
  var prCollapse=$('#pr-collapse'), prShow=$('#presrail-show');
  function railState(){
    return document.body.classList.contains('presrail-hidden')?'hidden'
      :document.body.classList.contains('presrail-min')?'min':'full';
  }
  function setRailState(st){
    document.body.classList.toggle('presrail-min',st==='min');
    document.body.classList.toggle('presrail-hidden',st==='hidden');
    if(prCollapse)
      prCollapse.title=st==='full'
        ?'Collapse to icons (click again to hide)':'Hide this panel';
    try{localStorage.setItem('sempresrail2',st);}catch(e){}
    /* the rail's width is the ribbon's left edge: re-run the ribbon
       fit + chrome measure whenever it changes (guarded — the first call
       runs before measureChrome is assigned, and init calls it anyway) */
    if(APP.measureChrome) APP.measureChrome();
  }
  var railPref=null;
  try{railPref=localStorage.getItem('sempresrail2');}catch(e){}
  setRailState(railPref==='min'||railPref==='hidden'||railPref==='full'
    ?railPref:(window.innerWidth<1100?'min':'full'));
  if(prCollapse) prCollapse.addEventListener('click',function(){
    setRailState(railState()==='full'?'min':'hidden');
  });
  if(prShow) prShow.addEventListener('click',function(){
    setRailState('full');
  });

  /* ---- help overlay ---- */
  var helpDlg=$('#helpdlg');
  function showHelp(){if(helpDlg) helpDlg.hidden=false;}
  function hideHelp(){if(helpDlg) helpDlg.hidden=true;}
  /* two doors: the app bar's Help, and the deck editor's — editing hides
     the app bar entirely, so without the second one the help was
     unreachable from inside a presentation (2026-08-20) */
  ['#help-btn','#deck-help'].forEach(function(sel){
    var hb=$(sel);
    if(hb) hb.addEventListener('click',showHelp);
  });
  var wHelp=$('#welcome-help');
  if(wHelp) wHelp.addEventListener('click',function(e){
    e.preventDefault();showHelp();});
  var helpClose=$('#help-close');
  if(helpClose) helpClose.addEventListener('click',hideHelp);
  if(helpDlg) helpDlg.addEventListener('click',function(e){
    if(e.target===helpDlg) hideHelp();});
  document.addEventListener('keydown',function(e){
    if(e.key==='Escape'&&helpDlg&&!helpDlg.hidden){
      e.stopPropagation();hideHelp();
    }
  },true);

  /* ---- ☰ toggles the section sidebar (TOC). Desktop: body.tocshow
     (hidden by default, pref persisted); mobile keeps the slide-in. */
  /* ---- the ribbon must NEVER wrap onto a second row (2026-08-03: on a
     narrower laptop the View + App groups spilled onto a new line and the
     extra band of chrome ate the notebook's viewing space). Escalate
     through the compaction stages (see the body.rbc* rules in app.css)
     until the bar fits. ONE stage, spacing only — NO WORDS are ever
     hidden (2026-08-04, user, twice: icon-only buttons "make no sense to
     look at", and even losing just the On/Fold state words was
     "confusing without these"). Reset first so a WIDER window relaxes
     back; past rbc1 the bar scrolls sideways (overflow-x:auto) — a thin
     scrollbar, never a second row, never missing words. rbc2/rbc3 are
     also removed here in case an older session left them stamped. */
  function fitRibbon(){
    var bar=$('.appbar');
    /* a HIDDEN bar (welcome screen, present mode) measures 0 wide — do
       not escalate against that, it is not a real fit */
    if(!bar||!bar.clientWidth) return;
    var cl=document.body.classList;
    cl.remove('rbc1');cl.remove('rbc2');cl.remove('rbc3');
    /* the custom-view styling bar rides the same pass: it sits in
       #apptop under this bar and used to WRAP into a second band of
       chrome (2026-08-24). It now shares rbc1's spacing stage, and past
       that it scrolls sideways (its own overflow-x:auto floor) — the
       same ladder as the appbar, nothing clipped unreachable. */
    var sb=document.getElementById('stylebar');
    function over(el){
      return !!(el&&!el.hidden&&el.clientWidth
        &&el.scrollWidth>el.clientWidth+1);
    }
    if(over(bar)||over(sb)) cl.add('rbc1');
  }
  /* the header can still be more than one row TALL (the sub-pickers hang
     under their filters), so the page offset has to follow its REAL
     height — otherwise the controls hide under the document (or leave a
     gap) */
  var chromeT=null;
  function measureChrome(){
    if(chromeT) return;
    chromeT=setTimeout(function(){
      chromeT=null;
      var top=$('#apptop'); if(!top) return;
      /* compact BEFORE measuring: the stages change the bar's height
         requirements as well as its width */
      fitRibbon();
      var h=Math.ceil(top.getBoundingClientRect().height);
      if(h>0) document.documentElement.style.setProperty(
        '--chrome-h',h+'px');
      /* Tree view drops the filter and scope sections. Record how wide
         they are together, so the Tree section can reserve the same slot
         and Size / View stay put across the switch -- the button you use
         to get back must not move under the pointer. Measured rather than
         guessed, so relabelling a filter cannot put it out of step. */
      if(!document.body.classList.contains('tree-mode')){
        var f=$('#ab-filters'), s=$('#ab-scope');
        if(f&&s){
          var w=Math.ceil(s.getBoundingClientRect().right
                          -f.getBoundingClientRect().left);
          if(w>0) document.documentElement.style.setProperty(
            '--filters-slot',w+'px');
        }
      }
    },0);
  }
  APP.measureChrome=measureChrome;
  window.addEventListener('resize',measureChrome);
  document.addEventListener('sem:shell',measureChrome);
  document.addEventListener('sem:activate',measureChrome);
  /* the bar's width also changes WITHOUT a window resize — the rail
     collapses, the builder docks (creating-docs), its edge is dragged —
     so watch the element itself. Safe from feedback: the rbc* classes
     change the bar's CONTENT, never its own border box. */
  if(window.ResizeObserver){
    var barEl=$('.appbar');
    if(barEl) new ResizeObserver(function(){measureChrome();})
      .observe(barEl);
  }
  /* fonts change text metrics: a fit measured against the FALLBACK font
     saw wider labels, over-compacted, and then STUCK — the bar's box
     never changes when the real font arrives, so neither resize nor the
     ResizeObserver re-fires. Re-fit once the fonts are truly in
     (2026-08-04: the ribbon sat icon-only beside a mile of empty bar). */
  if(document.fonts&&document.fonts.ready)
    document.fonts.ready.then(function(){measureChrome();});
  measureChrome();
  var menuBtn=$('#menubtn');
  function applyToc(show){
    document.body.classList.toggle('tocshow',show);
    if(menuBtn) menuBtn.setAttribute('aria-pressed',
      show?'true':'false');
    try{localStorage.setItem('plotline-toc',
      show?'open':'hidden');}catch(e){}
  }
  var tocPref=null;
  try{tocPref=localStorage.getItem('plotline-toc');}catch(e){}
  applyToc(tocPref==='open');
  if(menuBtn) menuBtn.addEventListener('click',function(){
    if(window.matchMedia
       &&window.matchMedia('(max-width:860px)').matches){
      var sh=APP.active&&APP.shells[APP.active];
      if(!sh) return;
      var rail=$('.rail',sh.el);
      if(rail){rail.classList.toggle('open');
        if(scrim) scrim.classList.toggle('show');}
      return;
    }
    applyToc(!document.body.classList.contains('tocshow'));
  });

  /* huge markdown notes: clamp with a Show more toggle.
     Two passes on purpose: reading scrollHeight right after the previous
     note's classList/insertBefore writes forces a full reflow PER long
     note. All the measuring happens first, then all the mutating
     (2026-08-23 perf) — same callers, same result. */
  function mdClampScan(shell){
    var longOnes=[];
    $$('.card[data-note="1"] .cardbody',shell).forEach(function(bd){
      if(bd.dataset.mdclamp) return;
      var nt=$('.note',bd); if(!nt) return;
      if(nt.scrollHeight<=460) return;        /* read phase only */
      longOnes.push(bd);
    });
    longOnes.forEach(function(bd){            /* write phase */
      bd.dataset.mdclamp='1';
      bd.classList.add('mdclamp');
      var btn=document.createElement('button');
      btn.className='mdmore';
      btn.textContent='Show more';
      btn.title='This note is long — expand it to full length';
      btn.addEventListener('click',function(){
        var open=bd.classList.toggle('mdopen');
        btn.textContent=open?'Show less':'Show more';
      });
      bd.parentNode.insertBefore(btn,bd.nextSibling);
    });
  }
  APP.mdscan=mdClampScan;

  /* ---- "add a note": a pencil on every card (app mode, local files).
     Saves a markdown cell into the .ipynb right after that card's cells;
     optionally git-commits it, linking the commit on GitHub. ---- */
  var noteCtx=null;
  function noteEls(){
    return {dlg:$('#note-dlg'),src:$('#note-dlg-src'),sub:$('#note-dlg-sub'),
      gitrow:$('#note-dlg-gitrow'),commit:$('#note-dlg-commit'),
      gitlab:$('#note-dlg-gitlab'),err:$('#note-dlg-err'),
      save:$('#note-dlg-save')};
  }
  function docToast(text,url,label,ms){
    var t=$('#doc-toast'); if(!t) return;
    t.textContent=text;
    if(url){
      t.appendChild(document.createTextNode(' — '));
      var a=document.createElement('a');
      a.href=url;a.target='_blank';a.rel='noopener';
      a.textContent=label||url;
      t.appendChild(a);
    }
    t.hidden=false;
    clearTimeout(t._tm);
    t._tm=setTimeout(function(){t.hidden=true;},ms||6500);
  }
  function closeNoteDlg(){
    var e=noteEls(); if(e.dlg) e.dlg.hidden=true;
    noteCtx=null;
  }
  function openNoteDlg(stem,anchor,title){
    var sh=APP.shells[stem];
    if(!sh||!sh.path||/^https?:/i.test(sh.path)) return;
    var e=noteEls(); if(!e.dlg) return;
    noteCtx={stem:stem,path:sh.path,anchor:anchor};
    e.sub.textContent='after “'+title+'” · saved into '
      +sh.path;
    e.src.value='';e.err.textContent='';
    e.gitrow.hidden=true;e.commit.checked=false;
    e.dlg.hidden=false;e.src.focus();
    api('/api/gitstate',{path:sh.path}).then(function(g){
      if(g&&g.repo&&noteCtx){
        e.gitrow.hidden=false;
        e.gitlab.textContent='also commit to git'
          +(g.github
            ?' ('+g.github.replace('https://github.com/','')+')':'');
      }
    }).catch(function(){});
  }
  (function(){
    var e=noteEls(); if(!e.dlg) return;
    var cancel=$('#note-dlg-cancel');
    if(cancel) cancel.addEventListener('click',closeNoteDlg);
    e.dlg.addEventListener('click',function(ev){
      if(ev.target===e.dlg) closeNoteDlg();});
    document.addEventListener('keydown',function(ev){
      if(ev.key==='Escape'&&!e.dlg.hidden){
        ev.stopPropagation();closeNoteDlg();}
    },true);
    e.save.addEventListener('click',function(){
      if(!noteCtx) return;
      var src=e.src.value.trim();
      if(!src){e.err.textContent='Write something first';return;}
      e.save.disabled=true;e.err.textContent='';
      api('/api/addnote',{path:noteCtx.path,after:noteCtx.anchor,
        source:src,commit:!!(e.commit.checked&&!e.gitrow.hidden)})
      .then(function(j){
        e.save.disabled=false;
        closeNoteDlg();
        mountShellHTML(j.shell,j.path);
        var sh2=APP.shells[j.stem];
        var card=sh2&&sh2.el.querySelector(
          '.card[data-anchor="cell:'+j.cell+'"]');
        if(card){
          card.scrollIntoView({behavior:'smooth',block:'center'});
          card.classList.add('target-flash');
          setTimeout(function(){
            card.classList.remove('target-flash');},1400);
        }
        var g=j.git&&j.git.commit;
        if(g&&g.ok)
          docToast('Note saved ✓ · committed '+(g.sha||''),
            g.url||'',g.url?'view on GitHub':'');
        else if(g&&!g.ok)
          docToast('Note saved ✓ · git commit failed: '
            +(g.error||''),'','',9000);
        else docToast('Note saved into the notebook ✓');
      }).catch(function(err){
        e.save.disabled=false;
        e.err.textContent=(err&&err.message)||'save failed';
      });
    });
  })();
  function wireAddNote(shell,stem){
    /* only where the server can WRITE: app mode + a local .ipynb (never
       static exports, URL-opened notebooks or Plot-trace clones) */
    if(APP.mode!=='app') return;
    if(shell.classList.contains('tracetab')) return;
    var p=shell.dataset.path||'';
    if(!p||/^https?:/i.test(p)) return;
    $$('.card',shell).forEach(function(card){
      var head=$('.cardhead',card); if(!head) return;
      if(head.querySelector('.card-addnote')) return;
      var b=document.createElement('button');
      b.className='card-addnote';b.type='button';
      b.innerHTML=bic('pen')||'&#9998;';
      b.title='Add a markdown note after this cell (saved into the '
        +'.ipynb; optionally committed to git)';
      b.addEventListener('click',function(ev){
        ev.preventDefault();ev.stopPropagation();
        var t=$('.cardtitle',card);
        openNoteDlg(stem,card.dataset.anchor,
          ((t&&t.textContent)||'this cell').trim());
      });
      head.insertBefore(b,head.querySelector('.cell-eye')||null);
    });
  }

  /* ---- interactive outputs: run neutralised output scripts (plotly-html /
     bokeh / vega / folium) and draw embedded Plotly figure specs. Cell output
     was produced by running the notebook, so its own <script> is trusted
     (nbconvert does the same). jsonOnly=true for CLONES (deck / tree) — their
     duplicate element ids would clash if arbitrary scripts re-ran, but the
     id-less Plotly spec draws cleanly on the element itself. ---- */
  function ensurePlotly(cb){
    if(window.Plotly) return cb();
    window.__plCbs=window.__plCbs||[];window.__plCbs.push(cb);
    if(window.__plLoading) return;
    window.__plLoading=1;
    var s=document.createElement('script');
    s.src='https://cdn.plot.ly/plotly-2.35.2.min.js';
    s.async=true;
    s.onload=function(){var q=window.__plCbs||[];window.__plCbs=[];
      q.forEach(function(f){try{f();}catch(e){}});};
    /* keep the queue on failure: a later ensurePlotly retries the load and
       onload then draws the figures that were pending when it first failed
       (the draw callback skips already-rendered divs, so no double-draw) */
    s.onerror=function(){window.__plLoading=0;};
    document.head.appendChild(s);
  }
  function activateOutputs(root,jsonOnly){
    root=root||document;
    if(!jsonOnly){
      /* revive in DOCUMENT ORDER: an external <script src> must finish
         loading before the following (often inline) init runs, else the lib
         (Plotly/Bokeh/vegaEmbed) is undefined when the init executes. So we
         chain: block on each src script's onload before inserting the next. */
      var list=[].filter.call(
        root.querySelectorAll('script[type="text/plotline-embed"]'),
        function(o){return !o.dataset.ran;});
      (function runNext(i){
        if(i>=list.length) return;
        var old=list[i]; old.dataset.ran='1';
        var s=document.createElement('script');
        for(var j=0;j<old.attributes.length;j++){
          var a=old.attributes[j];
          if(a.name==='type'||a.name==='data-ran') continue;
          try{s.setAttribute(a.name,a.value);}catch(e){}
        }
        var hasSrc=!!old.getAttribute('src');
        if(hasSrc){s.async=false;
          s.onload=s.onerror=function(){runNext(i+1);};}
        else s.textContent=old.textContent;   /* inline runs on insert */
        if(old.parentNode) old.parentNode.replaceChild(s,old);
        if(!hasSrc) runNext(i+1);
      })(0);
    }
    var pe=root.querySelectorAll('.plotly-embed[data-plotly]');
    /* skip embeds on hidden pager pages — a plot drawn into display:none
       has no size; the pager draws it (via SemActivate) when flipped to */
    pe=[].filter.call(pe,function(d){
      var p=d.closest&&d.closest('.figpage');
      return !p||p.classList.contains('current');
    });
    if(!pe.length) return;
    ensurePlotly(function(){
      if(!window.Plotly) return;
      [].forEach.call(pe,function(div){
        /* a cloned card may carry a static copy already — leave it be */
        if(div.querySelector('.js-plotly-plot,.plotly')) return;
        var raw=div.getAttribute('data-plotly'); if(!raw) return;
        try{
          var spec=JSON.parse(raw);
          window.Plotly.newPlot(div,spec.data||[],spec.layout||{},
            {responsive:true,displaylogo:false});
        }catch(e){}
      });
    });
  }
  window.SemActivate=activateOutputs;

  /* The #/##/### section tiers form a real hierarchy: collapsing or hiding
     a section also folds every DEEPER section that follows it, until a
     heading at the same tier (or shallower) closes the subtree. Sections
     stay flat siblings in the DOM — this pass just stamps the classes. */
  function recalcSecCascade(sh){
    var hideLv=null,offLv=null;
    $$('.section',sh).forEach(function(sec){
      var lv=+(sec.dataset.level||2);
      if(hideLv!=null&&lv<=hideLv) hideLv=null;
      if(offLv!=null&&lv<=offLv) offLv=null;
      sec.classList.toggle('sec-under',hideLv!=null);
      sec.classList.toggle('sec-under-off',offLv!=null);
      var sid=sec.dataset.sec;
      var row=sh.querySelector('.navsec-row[data-sec="'+sid+'"]');
      var items=sh.querySelector('.navitems[data-sec="'+sid+'"]');
      if(row){
        row.classList.toggle('nav-under',hideLv!=null);
        row.classList.toggle('sec-under-off',offLv!=null);
      }
      if(items) items.classList.toggle('nav-under',
        hideLv!=null||offLv!=null);
      if(hideLv==null&&sec.classList.contains('sec-collapsed')) hideLv=lv;
      if(offLv==null&&sec.classList.contains('sec-off')) offLv=lv;
    });
  }
  /* ---- figure zoom: live embeds (plotly/bokeh/vega) size themselves to
     their container once, so a resized figure must be told to re-fit ---- */
  /* how far a card can grow before it runs past the stage and drags a
     horizontal scrollbar onto the whole page */
  /* "zoomed" = this card's figure should FILL its frame (see the CSS):
     only then does a wider card actually show a bigger plot */
  function syncZoomed(card){
    if(!card||!card.classList) return;
    var own=parseFloat(card.style.getPropertyValue('--fz'))||1;
    /* any deliberate zoom — smaller as well as bigger — makes the plot
       track its frame; at exactly 1 it goes back to its natural size */
    card.classList.toggle('zoomed',
      Math.abs(own*(figAll||1)-1)>0.001);
  }
  function maxZoomFor(card){
    var stage=card&&card.closest?card.closest('.stage'):null;
    var host=card&&card.parentNode;
    if(!stage||!host||!host.getBoundingClientRect) return 3;
    var avail=stage.getBoundingClientRect().width-28;
    var base=host.getBoundingClientRect().width;
    if(!base||!avail) return 3;
    return Math.max(1,Math.min(3,avail/base));
  }
  /* live embeds size themselves to their container, so a resized figure
     has to be told. Only the embeds actually present are touched, and the
     global resize event — which makes every other listener relayout — is
     fired ONLY when there is something that needs it. */
  var embedT=null;
  function resizeEmbeds(root){
    clearTimeout(embedT);
    embedT=setTimeout(function(){
      var plots=[];
      try{plots=$$('.js-plotly-plot',root&&root.querySelectorAll
        ?root:document);}catch(e){}
      if(!plots.length) return;
      try{
        if(window.Plotly&&Plotly.Plots)
          plots.forEach(function(g){
            try{Plotly.Plots.resize(g);}catch(e){}});
      }catch(e){}
      try{window.dispatchEvent(new Event('resize'));}catch(e){}
    },80);
  }
  /* ---- ⤢ : one figure, full screen. The node is CLONED (ids stripped) so
     the live figure in the feed is never detached. ---- */
  function openFigMax(fig){
    var host=$('#figmax'),box=$('#figmax-box');
    if(!host||!box||!fig) return;
    box.innerHTML='';
    var src=fig.querySelector(
      '.figpage.current, .figframe, .figpager')||fig;
    var cl=src.cloneNode(true);
    $$('[id]',cl).forEach(function(n){n.removeAttribute('id');});
    if(cl.removeAttribute) cl.removeAttribute('id');
    $$('.figzoom',cl).forEach(function(n){
      if(n.parentNode) n.parentNode.removeChild(n);});
    box.appendChild(cl);
    /* a fullscreen document keeps its own top layer — the overlay must
       live inside it or it paints underneath */
    var fsc=document.fullscreenElement;
    (fsc||document.body).appendChild(host);
    host.hidden=false;
    resizeEmbeds(box);
  }
  function closeFigMax(){
    var host=$('#figmax'),box=$('#figmax-box');
    if(!host) return;
    host.hidden=true;
    if(box) box.innerHTML='';
    if(host.parentNode!==document.body) document.body.appendChild(host);
  }
  (function(){
    var host=$('#figmax'); if(!host) return;
    host.addEventListener('click',function(e){
      if(e.target===host||e.target.id==='figmax-close') closeFigMax();});
    document.addEventListener('keydown',function(e){
      if(e.key==='Escape'&&!host.hidden){e.stopPropagation();closeFigMax();}
    },true);
  })();
  /* ---- universal figure size for the whole feed (appbar +/-) ---- */
  var figAll=1;
  function applyFigAll(){
    $$('.nbshell').forEach(function(sh){
      if(figAll===1) sh.style.removeProperty('--fzall');
      else sh.style.setProperty('--fzall',figAll);
      $$('.card.has-fig',sh).forEach(syncZoomed);
    });
    var lab=$('#fig-size-val');
    if(lab) lab.textContent=Math.round(figAll*100)+'%';
    resizeEmbeds(document);
    scheduleSaveLayout();
  }
  APP.getFigAll=function(){return figAll;};
  APP.setFigAll=function(v){figAll=v||1;applyFigAll();};
  function bumpFigAll(mult){
    /* same ceiling, measured on a real card in the active notebook */
    var probe=$('.nbshell:not([hidden]) .card.has-fig');
    var cap=probe?maxZoomFor(probe):2.5;
    figAll=Math.max(0.4,Math.min(Math.max(1,Math.min(2.5,cap)),
      Math.round(figAll*mult*100)/100));
    applyFigAll();
  }
  (function(){
    var i=$('#fig-bigger'),o=$('#fig-smaller'),v=$('#fig-size-val');
    /* in TREE view these same three buttons drive the tree's zoom — the
       tree has no figures to size, and a size control that lives in a
       different place per view is exactly what the user asked us to stop
       doing. ribbonSizeStep returns true when it handled it. */
    if(i) i.addEventListener('click',function(){
      if(!APP.ribbonSizeStep(1)) bumpFigAll(1.15);});
    if(o) o.addEventListener('click',function(){
      if(!APP.ribbonSizeStep(-1)) bumpFigAll(1/1.15);});
    if(v) v.addEventListener('click',function(){
      if(!APP.ribbonSizeStep(0)){figAll=1;applyFigAll();}});
  })();
  /* ---- markdown / prose text size (the same idea, for words) ---- */
  var mdAll=1;
  function applyMdAll(){
    $$('.nbshell').forEach(function(sh){
      if(mdAll===1) sh.style.removeProperty('--mdscale');
      else sh.style.setProperty('--mdscale',mdAll);});
    var lab=$('#md-size-val');
    if(lab) lab.textContent=Math.round(mdAll*100)+'%';
    scheduleSaveLayout();
  }
  APP.applyMdAll=applyMdAll;
  APP.setMdAll=function(v){mdAll=v||1;applyMdAll();};
  APP.getMdAll=function(){return mdAll;};
  (function(){
    var i=$('#md-bigger'),o=$('#md-smaller'),v=$('#md-size-val');
    function bump(m){
      mdAll=Math.max(0.7,Math.min(2,Math.round(mdAll*m*100)/100));
      applyMdAll();
    }
    if(i) i.addEventListener('click',function(){bump(1.12);});
    if(o) o.addEventListener('click',function(){bump(1/1.12);});
    if(v) v.addEventListener('click',function(){mdAll=1;applyMdAll();});
  })();
  APP.applyFigAll=applyFigAll;
  /* Per-card behaviours, shared by the docs shell and the Plot-trace tab so
     the trace is a genuine subset of the docs with every control live.
     (Nav/graph wiring stays in initShell — the trace tab has no sidebar.) */
  function wireCardBehaviors(shell,stem){
    /* ---- code toggles ---- */
    $$('.codetoggle',shell).forEach(function(btn){
      btn.addEventListener('click',function(){
        var wrap=btn.closest('.codewrap');
        var open=wrap.hasAttribute('data-open');
        if(open){wrap.removeAttribute('data-open');
          btn.setAttribute('aria-expanded','false');}
        else{wrap.setAttribute('data-open','');
          btn.setAttribute('aria-expanded','true');}
      });
    });
    /* ---- per-cell eye: hide/show one cell (it stays in the sidebar) ---- */
    function setCellOff(id,off){
      var card=shell.querySelector('.card[id="card-'+id+'"]');
      var nav=shell.querySelector('.navitem[data-item="'+id+'"]');
      if(card) card.classList.toggle('cell-off',off);
      if(nav) nav.classList.toggle('cell-off',off);
      applyFilters();
    }
    $$('.cell-eye',shell).forEach(function(btn){
      btn.addEventListener('click',function(e){
        e.preventDefault();e.stopPropagation();
        var card=btn.closest('.card'); if(!card) return;
        setCellOff(card.id.replace(/^card-/,''),true);   /* hide this cell */
      });
    });
    $$('.navitem-eye',shell).forEach(function(sp){
      var toggle=function(e){
        e.preventDefault();e.stopPropagation();
        var nav=sp.closest('.navitem'); if(!nav) return;
        setCellOff(nav.dataset.item,!nav.classList.contains('cell-off'));
      };
      sp.addEventListener('click',toggle);
      /* role=button span: Enter/Space must act (keyboard users restore a
         cell hidden via the card eye only through this control) */
      sp.addEventListener('keydown',function(e){
        if(e.key==='Enter'||e.key===' '||e.key==='Spacebar') toggle(e);
      });
    });
    /* ---- figure "Plot trace" button -> the deck's trace tab ---- */
    $$('.plot-trace-btn',shell).forEach(function(btn){
      btn.addEventListener('click',function(e){
        e.preventDefault();e.stopPropagation();
        if(window.SemTrace) window.SemTrace.open(stem,btn.dataset.trace);
      });
    });
    /* ---- "derives from" dep chip -> scroll to its source card (scoped to
       this shell, so it works in the docs AND the trace tab's clones) ---- */
    $$('.depchip',shell).forEach(function(a){
      a.addEventListener('click',function(e){
        e.preventDefault();
        var src=$('.card[data-node="'+a.dataset.dep+'"]',shell);
        if(src){src.scrollIntoView({behavior:'smooth',block:'center'});
          src.classList.add('target-flash');
          setTimeout(function(){src.classList.remove('target-flash');},1400);}
      });
    });
    /* ---- section collapse + hide: available in the MAIN view and the sidebar,
       kept in sync. Collapse folds a section's cards; hide drops the whole
       section (it stays in the sidebar, dimmed, so you can bring it back).
       Nav queries no-op on the trace tab (which has no sidebar). ---- */
    function setSecCollapsed(sid,val){
      var sec=shell.querySelector('.section[data-sec="'+sid+'"]');
      var row=shell.querySelector('.navsec-row[data-sec="'+sid+'"]');
      var items=shell.querySelector('.navitems[data-sec="'+sid+'"]');
      if(sec) sec.classList.toggle('sec-collapsed',val);
      if(row) row.classList.toggle('collapsed',val);
      if(items) items.classList.toggle('nav-collapsed',val);
      var chevs=shell.querySelectorAll('.sec-chev[data-sec="'+sid+'"],'
        +'.navsec-row[data-sec="'+sid+'"] .navsec-chev');
      [].forEach.call(chevs,function(ch){
        ch.setAttribute('aria-expanded',(!val).toString());});
      recalcSecCascade(shell);   /* fold/unfold the deeper tiers below */
      scheduleSaveLayout();
    }
    function setSecOff(sid,val){
      var sec=shell.querySelector('.section[data-sec="'+sid+'"]');
      var row=shell.querySelector('.navsec-row[data-sec="'+sid+'"]');
      if(sec) sec.classList.toggle('sec-off',val);
      if(row) row.classList.toggle('sec-off',val);
      recalcSecCascade(shell);   /* hide/restore the deeper tiers below */
      scheduleSaveLayout();
      applyFilters();   /* keep the sidebar in step (a hidden section stays) */
      syncUnhideBtn(shell);
    }
    /* ---- "Show all hidden": a REVEAL TOGGLE, not a reset. It brings the
       hidden sections, headings and cells back into view — marked, so you
       can see which ones they are — and clicking again puts them away.
       Nothing about what is hidden changes, so the saved layout is
       untouched and you can hide them all again with one click. While
       they are revealed each one's own eye still works, which is how you
       un-hide just the one you actually wanted back. ---- */
    function syncUnhideBtn(sh){
      var b=sh.querySelector('.rf-unhide'); if(!b) return;
      var n=sh.querySelectorAll('.section.sec-off,.section.sec-headoff,'
        +'.content .card.cell-off').length;
      var on=sh.classList.contains('reveal-hidden');
      /* with nothing hidden the button has no job — unless it is still
         revealing, in which case it is the only way back */
      b.hidden=!n&&!on;
      b.setAttribute('aria-pressed',on?'true':'false');
      b.textContent=on?('Hide them again ('+n+')')
                      :('Show all hidden ('+n+')');
      if(!n&&on) sh.classList.remove('reveal-hidden');
    }
    (function(){
      var ub=shell.querySelector('.rf-unhide');
      if(!ub) return;
      ub.addEventListener('click',function(e){
        e.stopPropagation();
        shell.classList.toggle('reveal-hidden');
        syncUnhideBtn(shell);
      });
      syncUnhideBtn(shell);
    })();
    /* hiding the HEADING is a different, smaller action than hiding the
       section: the cards stay in the document, only the title goes. */
    function setSecHeadOff(sid,val){
      var sec=shell.querySelector('.section[data-sec="'+sid+'"]');
      var row=shell.querySelector('.navsec-row[data-sec="'+sid+'"]');
      if(sec) sec.classList.toggle('sec-headoff',val);
      if(row) row.classList.toggle('head-off',val);
      scheduleSaveLayout();
      syncUnhideBtn(shell);
    }
    function isHeadOff(sid){
      var sec=shell.querySelector('.section[data-sec="'+sid+'"]');
      if(sec) return sec.classList.contains('sec-headoff');
      var row=shell.querySelector('.navsec-row[data-sec="'+sid+'"]');
      return !!(row&&row.classList.contains('head-off'));
    }
    function isCollapsed(sid){
      var sec=shell.querySelector('.section[data-sec="'+sid+'"]');
      return !!(sec&&sec.classList.contains('sec-collapsed'));
    }
    $$('.sec-chev',shell).forEach(function(ch){
      ch.addEventListener('click',function(e){
        e.preventDefault();e.stopPropagation();
        setSecCollapsed(ch.dataset.sec,!isCollapsed(ch.dataset.sec));
      });
    });
    $$('.navsec-chev',shell).forEach(function(ch){
      ch.addEventListener('click',function(e){
        e.preventDefault();e.stopPropagation();
        var row=ch.closest('.navsec-row'); if(!row) return;
        setSecCollapsed(row.dataset.sec,!row.classList.contains('collapsed'));
      });
    });
    /* clicking the section header (not a button) also collapses it */
    $$('.sectionhead',shell).forEach(function(h){
      h.addEventListener('click',function(e){
        if(e.target.closest('button,a')) return;
        var sec=h.closest('.section'); if(!sec) return;
        setSecCollapsed(sec.dataset.sec,!sec.classList.contains('sec-collapsed'));
      });
    });
    $$('.sec-eye',shell).forEach(function(b){
      b.addEventListener('click',function(e){
        e.preventDefault();e.stopPropagation();
        /* the heading only — and it toggles, because the thin hover strip
           left behind still carries this button */
        setSecHeadOff(b.dataset.sec,!isHeadOff(b.dataset.sec));
      });
    });
    $$('.sec-hideall',shell).forEach(function(b){
      b.addEventListener('click',function(e){
        e.preventDefault();e.stopPropagation();
        setSecOff(b.dataset.sec,true);   /* heading AND every card */
      });
    });
    $$('.navsec-eye',shell).forEach(function(sp){
      var toggle=function(e){
        e.preventDefault();e.stopPropagation();
        var row=sp.closest('.navsec-row'); if(!row) return;
        setSecHeadOff(row.dataset.sec,!isHeadOff(row.dataset.sec));
      };
      sp.addEventListener('click',toggle);
      sp.addEventListener('keydown',function(e){
        if(e.key==='Enter'||e.key===' '||e.key==='Spacebar') toggle(e);});
    });
    $$('.navsec-hideall',shell).forEach(function(sp){
      var toggle=function(e){
        e.preventDefault();e.stopPropagation();
        var row=sp.closest('.navsec-row'); if(!row) return;
        if(row.classList.contains('sec-under-off')){
          /* dimmed because an ANCESTOR is hidden: restore the hidden
             ancestors (bringing this row back with them) instead of
             stamping a stray hide on the child itself */
          var rows=$$('.navsec-row',shell);
          var lv=+(row.dataset.level||2);
          for(var k=rows.indexOf(row)-1;k>=0;k--){
            var r2=rows[k],l2=+(r2.dataset.level||2);
            if(l2>=lv) continue;
            if(r2.classList.contains('sec-off'))
              setSecOff(r2.dataset.sec,false);
            lv=l2;
            if(l2<=1) break;
          }
          if(row.classList.contains('sec-off'))
            setSecOff(row.dataset.sec,false);
          return;
        }
        setSecOff(row.dataset.sec,!row.classList.contains('sec-off'));
      };
      sp.addEventListener('click',toggle);
      sp.addEventListener('keydown',function(e){
        if(e.key==='Enter'||e.key===' '||e.key==='Spacebar') toggle(e);});
    });
    /* ---- a Collapsed markdown note opens when its header is clicked;
       clicking again folds it back ---- */
    $$('.card',shell).forEach(function(c){
      var head=$('.cardhead',c);
      if(head) head.addEventListener('click',function(e){
        if(e.target.closest('button,a')) return;   /* leave eye/trace clicks */
        if(c.classList.contains('collapsed')) c.classList.toggle('expanded');
      });
    });
    /* ---- a figure folded by Plots = Collapsed opens on click; a FRAME
       folded by its plot-type's own Fold toggles on its stub strip.
       Open, only the strip itself refolds — a click on the figure
       content must not snap it shut ---- */
    $$('.cb-fig',shell).forEach(function(f){
      f.addEventListener('click',function(e){
        var fr=e.target&&e.target.closest
          ?e.target.closest('[data-pt].pt-fold'):null;
        if(fr){
          if(!fr.classList.contains('pt-open')||e.target===fr)
            fr.classList.toggle('pt-open');
          return;
        }
        if(f.classList.contains('part-fold')) f.classList.toggle('part-open');
      });
    });
    /* ---- per-figure zoom (+ / - / expand full screen) ---- */
    $$('.cb-fig .figzoom',shell).forEach(function(z){
      var fig=z.parentNode;
      /* the factor lives on the CARD: widening the card takes its border
         and header with it, so the figure never sits outside its cell */
      var card=fig.closest('.card')||fig;
      function bump(mult){
        var cur=parseFloat(card.style.getPropertyValue('--fz'))||1;
        /* the ceiling is what actually fits — growing past the stage
           would put a scrollbar under the whole document */
        var cap=maxZoomFor(card)/(figAll||1);
        var next=Math.max(0.35,Math.min(Math.max(1,cap),
          Math.round(cur*mult*100)/100));
        if(next===1) card.style.removeProperty('--fz');
        else card.style.setProperty('--fz',next);
        syncZoomed(card);
        resizeEmbeds(card);
        scheduleSaveLayout();   /* this size is yours to keep */
      }
      z.addEventListener('click',function(e){e.stopPropagation();});
      var bi=$('.fz-in',z),bo=$('.fz-out',z),bx=$('.fz-max',z);
      if(bi) bi.addEventListener('click',function(e){
        e.stopPropagation();bump(1.25);});
      if(bo) bo.addEventListener('click',function(e){
        e.stopPropagation();bump(1/1.25);});
      if(bx) bx.addEventListener('click',function(e){
        e.stopPropagation();openFigMax(fig);});
    });
    /* ---- output folded by Output = Collapsed reveals on click. Open-only
       (unlike a figure): the output is text/tables you may want to select,
       so a click inside it must not fold it back up ---- */
    $$('.cb-out',shell).forEach(function(o){
      o.addEventListener('click',function(){
        if(o.classList.contains('part-fold')&&!o.classList.contains('part-open'))
          o.classList.add('part-open');
      });
    });
  }
  APP.wireCardBehaviors=wireCardBehaviors;
  /* ---- a notebook opened straight from GitHub still has a history: read
     it from the public API, so the hash + version list work with no local
     clone. Handles both the raw. and the blob/ form of the URL. ---- */
  function ghFromUrl(u){
    var m=/^https?:\/\/raw\.githubusercontent\.com\/([^\/]+)\/([^\/]+)\/([^\/]+)\/(.+)$/
      .exec(u||'');
    if(!m) m=/^https?:\/\/github\.com\/([^\/]+)\/([^\/]+)\/(?:blob|raw)\/([^\/]+)\/(.+)$/
      .exec(u||'');
    if(!m) return null;
    return {owner:m[1],repo:m[2],ref:m[3],
      path:m[4].split('?')[0].split('#')[0]};
  }
  function ghRawAt(gh,sha){
    return 'https://raw.githubusercontent.com/'+gh.owner+'/'+gh.repo
      +'/'+sha+'/'+gh.path;
  }
  /* Open a URL that is ANOTHER VERSION of a notebook already open. With
     `intoStem` it replaces that tab (same file, different moment) and is
     kept out of Recent; without it, a normal open in its own tab. */
  function openUrlVersion(url,intoStem,verTag,label){
    function tag(st){
      var sh=APP.shells[st];
      if(!sh) return;
      sh.version=verTag||'';sh.path=url;
      if(label) sh.label=label;
      renderTabs();
    }
    /* web mode: fetch the raw notebook and parse it in the page —
       shared by both branches; `taken` is the stems the parser must
       avoid, and done(shellHtml) runs after the mount */
    function webFetchParse(taken,done){
      fetch(url,{cache:'no-store'}).then(function(r){
        if(!r.ok) throw new Error('HTTP '+r.status);
        return r.text();
      }).then(function(txt){
        if(!webReady()) throw new Error('Python is still loading');
        var name=decodeURIComponent(
          url.split('?')[0].split('/').pop()||'notebook.ipynb');
        var shell=window.semPy.parse(name,txt,taken);
        mountShellHTML(shell,url,true);
        done(shell);
      }).catch(function(e){
        alert('Could not open that version: '+((e&&e.message)||e));});
    }
    if(!intoStem){
      /* its OWN tab, but still named for the notebook with the commit
         underneath — not "draft_01-2" */
      if(APP.mode==='web'){
        webFetchParse(APP.order.slice(),function(shell){
          var tmp=document.createElement('div');tmp.innerHTML=shell;
          var el=tmp.querySelector('.nbshell');
          tag(el?el.dataset.nb:'');
        });
        return;
      }
      api('/api/open',{path:url}).then(function(j){
        mountShellHTML(j.shell,url,true);
        tag(j.stem);
      }).catch(function(e){
        alert('Could not open that version: '+((e&&e.message)||e));});
      return;
    }
    if(APP.mode==='web'){
      /* exclude the tab we are replacing from the taken names, so the
         parser reproduces ITS stem instead of minting a second one */
      webFetchParse(APP.order.filter(function(s){return s!==intoStem;}),
        function(){tag(intoStem);});
      return;
    }
    api('/api/open',{path:url,stem:intoStem}).then(function(j){
      mountShellHTML(j.shell,url,true);
      tag(intoStem);
    }).catch(function(e){
      alert('Could not open that version: '+((e&&e.message)||e));});
  }
  function ghCommits(gh){
    var url='https://api.github.com/repos/'+encodeURIComponent(gh.owner)
      +'/'+encodeURIComponent(gh.repo)+'/commits?per_page=25&sha='
      +encodeURIComponent(gh.ref)+'&path='+encodeURIComponent(gh.path);
    return fetch(url,{headers:{'Accept':'application/vnd.github+json'}})
      .then(function(r){
        if(r.status===403)
          throw new Error('GitHub rate limit — try again later');
        if(!r.ok) throw new Error('GitHub said '+r.status);
        return r.json();
      }).then(function(list){
        return (list||[]).map(function(c){
          var d=((c.commit||{}).author||{}).date||'';
          var msg=((c.commit||{}).message||'').split('\n')[0];
          return {id:String(c.sha||'').slice(0,10),full:c.sha,
            msg:msg,date:d?d.slice(0,10):''};
        });
      });
  }
  /* ---- File info: where this notebook came from. The path, the git
     commit it is sitting on, and the way in to every earlier version —
     all in one place at the top of the sidebar, with Reload beside it. */
  function wireFileInfo(shell,stem){
    var bar=$('.railfile',shell),panel=$('.rf-panel',shell);
    if(!bar||!panel) return;
    var info=$('.rf-info',bar),rel=$('.rf-reload',bar);
    var path=shell.dataset.path||'';
    var isUrlPath=/^https?:/i.test(path);
    if(rel){
      rel.hidden=!path;
      rel.title=isUrlPath?'Reload from the URL':'Reload from disk';
      rel.addEventListener('click',function(){
        if(path) openPath(path);});
    }
    /* one line per fact, truncated with the full value on hover — a raw
       URL broken mid-word across three lines is what made this a mess */
    function row(k,v,cls){
      var r=document.createElement('div');r.className='rf-row';
      var kk=document.createElement('div');kk.className='rf-k';
      kk.textContent=k;
      var vv=document.createElement('div');
      vv.className='rf-v'+(cls?' '+cls:'');
      vv.textContent=v;
      vv.title=v;
      r.appendChild(kk);r.appendChild(vv);
      return r;
    }
    function baseName(p){
      var b=String(p||'').split('?')[0].split('#')[0]
        .split(/[\\/\\\\]/).pop();
      try{b=decodeURIComponent(b);}catch(e){}
      return b||String(p||'');
    }
    function folderOf(p){
      var s=String(p||'').split('?')[0].split('#')[0];
      var i=Math.max(s.lastIndexOf('/'),s.lastIndexOf('\\\\'));
      return i>0?s.slice(0,i):s;
    }
    function act(label,title,fn){
      var b=document.createElement('button');
      b.className='rf-btn';b.type='button';
      /* innerHTML: the labels are fixed strings from this file, now
         carrying a bic() icon before their words */
      b.innerHTML=label;b.title=title;
      b.addEventListener('click',function(e){e.stopPropagation();fn(b);});
      return b;
    }
    function closePanel(){
      panel.hidden=true;
      if(info) info.setAttribute('aria-expanded','false');
    }
    function fill(){
      panel.innerHTML='';
      var sh=APP.shells[stem]||{};
      var ghp=isUrlPath?ghFromUrl(path):null;
      /* the NAME first, then where it lives — not a wrapped raw URL */
      panel.appendChild(row('file',baseName(path)||'untitled'));
      panel.appendChild(row(isUrlPath?'from':'folder',
        ghp?(ghp.owner+'/'+ghp.repo)
          :(path?folderOf(path):'not saved to a file')));
      /* which version of the notebook you are looking at right now */
      var ver=sh.version||'';
      var vrow;
      if(ver){
        vrow=row('showing',
          /^git:/.test(ver)?('an earlier commit — '+ver.slice(4))
            :'an earlier snapshot','rf-old');
      } else vrow=row('showing','the latest version','rf-live');
      panel.appendChild(vrow);
      var acts=document.createElement('div');acts.className='rf-acts';
      panel.appendChild(acts);
      if(APP.mode==='app'&&path&&!isUrlPath){
        acts.appendChild(act(bic('history')+' Version history…',
          'Every saved snapshot and git commit of this notebook — '
          +'open any of them',
          function(b){showVersMenu(b,stem);}));
      }
      if(ver){
        acts.appendChild(act(bic('reload')+' Back to current',
          'Leave this old version and reload the file as it is now',
          function(){openPath(path);}));
      }
      /* --- the commit list, shown under the hash when you click it --- */
      function commitList(commits,openAt){
        var box=document.createElement('div');
        box.className='rf-commits';box.hidden=true;
        commits.forEach(function(c){
          var row=document.createElement('div');row.className='rf-crow';
          var b=document.createElement('button');
          b.className='rf-commit';b.type='button';
          var h=document.createElement('span');
          h.className='rf-ch';h.textContent=c.id;
          var m=document.createElement('span');
          m.className='rf-cm';m.textContent=c.msg||'(no message)';
          var d=document.createElement('span');
          d.className='rf-cd';d.textContent=c.date||'';
          b.appendChild(h);b.appendChild(m);b.appendChild(d);
          b.title='View this notebook as it was at '+c.id
            +' (same tab — it is the same file)';
          b.addEventListener('click',function(e){
            e.stopPropagation();closePanel();openAt(c,false);});
          /* …or side by side, when you actually want to compare */
          var nt=document.createElement('button');
          nt.className='rf-newtab';nt.type='button';
          nt.innerHTML=bic('copy')||'&#10697;';
          nt.title='Open this version in a new tab, to compare';
          nt.setAttribute('aria-label','Open this version in a new tab');
          nt.addEventListener('click',function(e){
            e.stopPropagation();closePanel();openAt(c,true);});
          row.appendChild(b);row.appendChild(nt);
          box.appendChild(row);
        });
        if(!commits.length){
          var e0=document.createElement('div');
          e0.className='rf-v rf-sub';
          e0.textContent='no commits found for this file';
          box.appendChild(e0);
        }
        return box;
      }
      /* the hash IS the way in: click it to see every version */
      function hashRow(label,c,commits,openAt){
        var r=document.createElement('div');r.className='rf-row';
        var kk=document.createElement('div');kk.className='rf-k';
        kk.textContent=label;
        var btn=document.createElement('button');
        btn.className='rf-v hash rf-hashbtn';btn.type='button';
        var hid=document.createElement('span');hid.textContent=c.id;
        var car=document.createElement('span');
        car.className='rf-caret';car.textContent='▾';
        btn.appendChild(hid);btn.appendChild(car);
        btn.title='Show every version of this notebook';
        var sub=document.createElement('div');
        sub.className='rf-v rf-sub';
        sub.textContent=(c.msg||'')+(c.date?('  ·  '+c.date):'');
        var list=commitList(commits,openAt);
        btn.addEventListener('click',function(e){
          e.stopPropagation();
          list.hidden=!list.hidden;
          btn.classList.toggle('open',!list.hidden);
        });
        r.appendChild(kk);r.appendChild(btn);r.appendChild(sub);
        r.appendChild(list);
        return r;
      }
      /* ---- a notebook opened from GitHub: read its history from the
         GitHub API, so the same hash/versions work with no local repo --- */
      var gh=ghp;
      if(gh){
        var pend=row('commit','loading history…');
        panel.insertBefore(pend,acts);
        ghCommits(gh).then(function(commits){
          if(pend.parentNode) pend.parentNode.removeChild(pend);
          if(!commits.length) return;
          panel.insertBefore(hashRow('commit',commits[0],commits,
            function(c,newTab){
              /* every commit is the SAME file at a different moment — it
                 belongs in this tab, not a new one, and it is not a new
                 entry in Recent. The new-tab (duplicate-icon) button is
                 the explicit opt-in to compare. */
              openUrlVersion(ghRawAt(gh,c.full||c.id),
                newTab?null:stem,'git:'+c.id,
                (APP.shells[stem]||{}).label||stem);
            }),acts);
        }).catch(function(e){
          var v=$('.rf-v',pend);
          if(v) v.textContent=(e&&e.message)||'could not reach GitHub';
        });
        acts.appendChild(act('↗ GitHub',
          'Open this file on GitHub',function(){
            try{window.open('https://github.com/'+gh.owner+'/'+gh.repo
              +'/blob/'+gh.ref+'/'+gh.path,'_blank','noopener');}catch(e){}
          }));
        return;
      }
      if(!(APP.mode==='app'&&path&&!isUrlPath)) return;
      /* git details come from the server */
      var gr=row('git','checking…');
      panel.insertBefore(gr,acts);
      APP.api('/api/gitstate',{path:path}).then(function(g){
        var v=$('.rf-v',gr);
        if(!g||!g.repo){
          v.textContent='not in a git repository';
          return;
        }
        v.textContent=(g.branch?('branch '+g.branch):'in a git repository');
        var c=g.commit;
        if(c&&c.id){
          /* the hash expands into the full commit list, each openable */
          APP.api('/api/versions',{path:path}).then(function(j){
            var commits=(j&&j.commits)||[c];
            panel.insertBefore(hashRow('commit',c,commits,
              function(cm,newTab){
                /* same file, different moment — it replaces this tab and
                   is not a new entry in Recent */
                APP.api('/api/openversion',
                  {path:path,commit:cm.id,stem:newTab?'':stem})
                  .then(function(r){
                    if(!r||!r.shell) return;
                    mountShellHTML(r.shell,r.path||path,!newTab);
                    var st=r.stem||stem;
                    var s2=APP.shells[st];
                    if(s2){
                      s2.version='git:'+cm.id;
                      if(!s2.label) s2.label=(APP.shells[stem]||{}).label
                        ||stem;
                      renderTabs();
                    }
                  }).catch(function(){});
              }),acts);
          }).catch(function(){
            panel.insertBefore(hashRow('current commit',c,[c],
              function(){}),acts);
          });
        }
        if(g.github){
          acts.appendChild(act('↗ GitHub',
            'Open this repository on GitHub',function(){
              try{window.open(g.github,'_blank','noopener');}catch(e){}
            }));
        }
      }).catch(function(){
        var v=$('.rf-v',gr);
        if(v) v.textContent='could not read git';
      });
    }
    function toggle(){
      var open=panel.hidden;
      panel.hidden=!open;
      if(info) info.setAttribute('aria-expanded',open.toString());
      if(open) fill();
    }
    if(info) info.addEventListener('click',function(e){
      e.stopPropagation();toggle();});
    /* clicking anywhere else closes it */
    document.addEventListener('click',function(e){
      if(panel.hidden||panel.contains(e.target)) return;
      if(info&&info.contains(e.target)) return;
      closePanel();
    });
    document.addEventListener('keydown',function(e){
      if(e.key==='Escape'&&!panel.hidden) closePanel();});
  }
  function initShell(shell){
    var data={};
    var de=$('.nb-data',shell);
    if(de){try{data=JSON.parse(de.textContent);}catch(e){}}
    var stem=shell.dataset.nb||data.stem||('nb-'+(APP.order.length+1));
    mdClampScan(shell);
    wireFileInfo(shell,stem);

    /* ---- filename + path bar at the top of the document ---- */
    var db=$('.docbar',shell);
    if(db){
      var p=shell.dataset.path||'';
      var nmEl=$('.docbar-nm',db), pEl=$('.docbar-p',db);
      if(p){
        var parts=p.split(/[\/\\]/);
        var base=parts[parts.length-1]||p;
        base=base.split('?')[0].split('#')[0];
        try{base=decodeURIComponent(base);}catch(e){}
        if(nmEl&&base) nmEl.textContent=base;
        if(pEl){pEl.textContent=p;pEl.dir='ltr';
          pEl.title=p;}
        /* the sidebar already names the notebook by its stem; give
           that name the full path as its tooltip, the way the tab
           and the docbar do. The stem, not the file name: a rail
           is 256px wide and "example_climate_analysis.ipynb" in
           mono wraps mid-word there, which reads worse than the
           extension reads useful. */
        var rt=$('.railtitle',shell);
        if(rt) rt.title=p;
      } else if(pEl){pEl.textContent='';}
      db.hidden=false;
    }

    /* ---- reveal on scroll ---- */
    var cards=$$('.card',shell);
    if('IntersectionObserver' in window){
      var io=new IntersectionObserver(function(es){
        es.forEach(function(e){if(e.isIntersecting){
          e.target.classList.add('in');io.unobserve(e.target);}});
      },{rootMargin:'0px 0px -8% 0px',threshold:0.04});
      cards.forEach(function(c){io.observe(c);});
    } else cards.forEach(function(c){c.classList.add('in');});

    /* ---- scroll-spy: active section + item + graph node ---- */
    var navSecs={},navItems={},graphNodes={};
    $$('.navsec',shell).forEach(function(a){navSecs[a.dataset.sec]=a;});
    $$('.navitem',shell).forEach(function(a){navItems[a.dataset.item]=a;});
    $$('.provnode',shell).forEach(function(g){graphNodes[g.dataset.node]=g;});
    function setActiveSection(id){
      $$('.navsec.active',shell).forEach(function(a){a.classList.remove('active');});
      if(navSecs[id]) navSecs[id].classList.add('active');
    }
    function setActiveItem(item){
      $$('.navitem.active',shell).forEach(function(a){a.classList.remove('active');});
      if(navItems[item]) navItems[item].classList.add('active');
      var node=$('.card[id="card-'+item+'"]',shell);
      var nodeId=node?node.dataset.node:'';
      $$('.provnode.active',shell).forEach(function(g){g.classList.remove('active');});
      $$('.provedge.lit',shell).forEach(function(p){p.classList.remove('lit');});
      if(nodeId&&graphNodes[nodeId]){
        graphNodes[nodeId].classList.add('active');
        $$('.provedge',shell).forEach(function(p){
          if(p.dataset.to===nodeId||p.dataset.from===nodeId)
            p.classList.add('lit');
        });
      }
    }
    if('IntersectionObserver' in window){
      var visible={};
      var spy=new IntersectionObserver(function(es){
        es.forEach(function(e){
          if(e.isIntersecting) visible[e.target.id]=e.intersectionRatio;
          else delete visible[e.target.id];
        });
        var bestC=null,bc=0;
        Object.keys(visible).forEach(function(k){
          if(k.indexOf('card-')===0&&visible[k]>=bc){bc=visible[k];bestC=k;}
        });
        if(bestC){
          var item=bestC.slice(5);
          setActiveItem(item);
          var card=$('.card[id="'+bestC+'"]',shell);
          var sec=card?card.closest('.section'):null;
          if(sec) setActiveSection(sec.dataset.sec);
        }
      },{rootMargin:'-12% 0px -55% 0px',threshold:[0,0.25,0.6,1]});
      cards.forEach(function(c){spy.observe(c);});
    }

    /* ---- nav links: resolve inside THIS shell (ids repeat across tabs) */
    var rail=$('.rail',shell);
    function closeRail(){
      if(rail) rail.classList.remove('open');
      if(scrim) scrim.classList.remove('show');
    }
    $$('.navsec,.navitem',shell).forEach(function(a){
      a.addEventListener('click',function(e){
        e.preventDefault();
        if(shell.classList.contains('raw')||shell.classList.contains('tree')){
          shell.classList.remove('raw');shell.classList.remove('tree');
          renderRawBtn();renderViewBtns();
        }
        var id=(a.getAttribute('href')||'').slice(1);
        var el=id?$('[id="'+id+'"]',shell):null;
        if(el) el.scrollIntoView({behavior:'smooth',block:'start'});
        if(window.innerWidth<=860) closeRail();
      });
    });

    /* ---- graph node / dep chip -> scroll to card ---- */
    function gotoItem(itemId){
      var card=$('.card[id="card-'+itemId+'"]',shell);
      if(!card) return;
      card.scrollIntoView({behavior:'smooth',block:'center'});
      card.classList.add('target-flash');
      setTimeout(function(){card.classList.remove('target-flash');},1400);
    }
    $$('.provnode',shell).forEach(function(g){
      function act(){gotoItem(g.dataset.target);}
      g.addEventListener('click',act);
      g.addEventListener('keydown',function(e){
        if(e.key==='Enter'||e.key===' '){e.preventDefault();act();}});
    });
    /* .depchip lives inside a card -> wired in wireCardBehaviors so it also
       works on the Plot-trace tab's cloned cards */
    var rgBtn=$('.rg-collapse',shell);
    if(rgBtn) rgBtn.addEventListener('click',function(){
      var rg=rgBtn.closest('.railgraph');
      var c=rg.classList.toggle('collapsed');
      rgBtn.setAttribute('aria-expanded',(!c).toString());
      rgBtn.textContent=c?'+':'\u2013';
    });
    /* ---- sidebar Variables view: the Sections | Variables tabs swap the
       nav for the variables index. The rows are server-rendered once in
       definition order; "type" regroups those same DOM rows under inserted
       headings, "order" restores them by data-i. Absent on the Plot-trace
       tab (its rail has no tabs), so all of this no-ops there. ---- */
    /* the varpanel's only door is the pane now (the x² button beside the
       sections hamburger); the sidebar itself is always the sections
       list, so there is no view to switch (2026-08-19) */
    var varpanel=$('.varpanel',shell),navEl=$('.rail .nav',shell);
    if(varpanel&&navEl){
      /* chevron unfolds one variable's defined/redefined/used cells */
      $$('.var-chev',varpanel).forEach(function(ch){
        ch.addEventListener('click',function(){
          var row=ch.closest('.varrow');if(!row)return;
          var open=row.classList.toggle('open');
          ch.setAttribute('aria-expanded',open?'true':'false');
          var u=$('.var-uses',row);if(u)u.hidden=!open;
        });
      });
      /* name + site links jump like nav links: resolve inside THIS shell
         (card ids repeat across tabs), leave raw/tree view first */
      $$('.var-name,.var-use',varpanel).forEach(function(a){
        a.addEventListener('click',function(e){
          e.preventDefault();
          if(shell.classList.contains('raw')||shell.classList.contains('tree')){
            shell.classList.remove('raw');shell.classList.remove('tree');
            renderRawBtn();renderViewBtns();
          }
          var id=(a.getAttribute('href')||'').slice(1);
          if(id.indexOf('card-')===0) gotoItem(id.slice(5));
          if(window.innerWidth<=860) closeRail();
        });
      });
      var varlist=$('.varlist',varpanel),vorder='order';
      /* group heading order mirrors GROUP_ORDER in notebook/variables.py */
      var VGROUPS=['imports','constants','data','functions','classes',
        'plotting','values','objects','computed','other'];
      function varRows(){return $$('.varrow',varlist);}
      function applyVarFilter(){
        var vfilter=$('.var-filter',varpanel);
        var q=((vfilter&&vfilter.value)||'').trim().toLowerCase();
        var any=false;
        varRows().forEach(function(r){
          var hit=!q||r.dataset.name.indexOf(q)>=0;
          r.classList.toggle('vf-out',!hit);
          if(hit)any=true;
        });
        /* a heading whose every row is filtered out goes too */
        $$('.vargroup-h',varlist).forEach(function(h){
          var n=h.nextElementSibling,vis=false;
          while(n&&!n.classList.contains('vargroup-h')){
            if(n.classList.contains('varrow')
               &&!n.classList.contains('vf-out')
               &&!n.classList.contains('vg-out'))vis=true;
            n=n.nextElementSibling;
          }
          h.classList.toggle('vf-out',!vis);
        });
        var empty=$('.var-empty',varpanel);
        if(empty)empty.hidden=any||!q;
      }
      function arrangeVars(){
        var rows=varRows();
        $$('.vargroup-h',varlist).forEach(function(h){h.remove();});
        if(vorder==='order'){
          rows.sort(function(a,b){return (+a.dataset.i)-(+b.dataset.i);});
          rows.forEach(function(r){varlist.appendChild(r);});
        }else{
          var groups={};
          rows.forEach(function(r){
            (groups[r.dataset.group]=groups[r.dataset.group]||[]).push(r);
          });
          VGROUPS.concat(Object.keys(groups).filter(function(g){
            return VGROUPS.indexOf(g)<0;
          })).forEach(function(g){
            if(!groups[g])return;
            var h=document.createElement('div');
            h.className='vargroup-h';h.textContent=g;
            varlist.appendChild(h);
            groups[g].sort(function(a,b){
              return (+a.dataset.i)-(+b.dataset.i);});
            groups[g].forEach(function(r){varlist.appendChild(r);});
          });
        }
        applyVarFilter();
      }
      $$('.varord-btn',varpanel).forEach(function(b){
        b.addEventListener('click',function(){
          vorder=b.dataset.vorder;
          $$('.varord-btn',varpanel).forEach(function(x){
            x.classList.toggle('active',x===b);});
          arrangeVars();
        });
      });
      var vfilterEl=$('.var-filter',varpanel);
      if(vfilterEl)vfilterEl.addEventListener('input',applyVarFilter);
      /* TYPE chips: hide whole kinds — "remove imports" is the first
         thing anyone wants from a variables index (2026-08-18, user).
         Built from the groups actually present, so nothing is offered
         that does nothing. */
      var hideG={};
      var present={};
      varRows().forEach(function(r){present[r.dataset.group]=1;});
      var kinds=VGROUPS.filter(function(g){return present[g];});
      if(kinds.length>1&&vfilterEl){
        var chipRow=document.createElement('div');
        chipRow.className='var-chips';
        kinds.forEach(function(g){
          var ch2=document.createElement('button');
          ch2.className='var-chip on';ch2.textContent=g;
          ch2.title='Click to hide '+g;
          ch2.addEventListener('click',function(){
            hideG[g]=!hideG[g];
            ch2.classList.toggle('on',!hideG[g]);
            ch2.title=(hideG[g]?'Click to show ':'Click to hide ')+g;
            applyVarFilter();
          });
          chipRow.appendChild(ch2);
        });
        vfilterEl.parentNode.insertBefore(chipRow,
          vfilterEl.nextSibling);
      }
      var applyBase=applyVarFilter;
      applyVarFilter=function(){
        varRows().forEach(function(r){
          r.classList.toggle('vg-out',!!hideG[r.dataset.group]);});
        applyBase();
      };
    }
    /* ---- per-card + per-section behaviours (code toggle, eyes, collapse,
       fig-fold, section collapse/hide incl. the nav chevrons): shared with
       the Plot-trace tab so the trace is a true subset of the docs ---- */
    wireCardBehaviors(shell,stem);
    wireAddNote(shell,stem);  /* app mode: pencil to add a markdown note */
    activateOutputs(shell);   /* run plotly/bokeh/vega + draw plotly specs */

    /* ---- register ---- */
    var replaced=!!APP.shells[stem];
    APP.shells[stem]={el:shell,data:data,path:shell.dataset.path||'',
      title:data.title||stem};
    if(APP.order.indexOf(stem)<0) APP.order.push(stem);
    applyFilters();
    applyCodeState(shell);   /* fold/hide code to match the current state */
    document.dispatchEvent(new CustomEvent('sem:shell',
      {detail:{stem:stem,el:shell,data:data,replaced:replaced}}));
    renderTabs();
    return stem;
  }

  /* ================= app mode: open / close / reload ================= */
  /* a refresh keeps YOUR VIEW: hidden cells/sections, collapsed sections,
     tree/raw mode and the scroll position carry over the shell swap
     (anchors + section ids are stable across re-parses) */
  function captureViewState(el){
    return {
      cellsOff:$$('.card.cell-off',el).map(function(c){
        return c.dataset.anchor;}).filter(Boolean),
      secsOff:$$('.section.sec-off',el).map(function(s2){
        return s2.dataset.sec;}).filter(Boolean),
      secsHeadOff:$$('.section.sec-headoff',el).map(function(s2){
        return s2.dataset.sec;}).filter(Boolean),
      secsClosed:$$('.section.sec-collapsed',el).map(function(s2){
        return s2.dataset.sec;}).filter(Boolean),
      tree:el.classList.contains('tree'),
      raw:el.classList.contains('raw'),
      scroll:window.scrollY||0
    };
  }
  function restoreViewState(shell,stem,keep){
    keep.cellsOff.forEach(function(an){
      var card=shell.querySelector(
        '.card[data-anchor="'+String(an).replace(/"/g,'\\"')+'"]');
      if(!card) return;
      card.classList.add('cell-off');
      var id=card.id.replace(/^card-/,'');
      var nav=shell.querySelector('.navitem[data-item="'+id+'"]');
      if(nav) nav.classList.add('cell-off');
    });
    keep.secsOff.forEach(function(sid){
      var sec=shell.querySelector('.section[data-sec="'+sid+'"]');
      var row=shell.querySelector('.navsec-row[data-sec="'+sid+'"]');
      if(sec) sec.classList.add('sec-off');
      if(row) row.classList.add('sec-off');
    });
    (keep.secsHeadOff||[]).forEach(function(sid){
      var sec=shell.querySelector('.section[data-sec="'+sid+'"]');
      var row=shell.querySelector('.navsec-row[data-sec="'+sid+'"]');
      if(sec) sec.classList.add('sec-headoff');
      if(row) row.classList.add('head-off');
    });
    keep.secsClosed.forEach(function(sid){
      var sec=shell.querySelector('.section[data-sec="'+sid+'"]');
      var row=shell.querySelector('.navsec-row[data-sec="'+sid+'"]');
      var items=shell.querySelector('.navitems[data-sec="'+sid+'"]');
      if(sec) sec.classList.add('sec-collapsed');
      if(row) row.classList.add('collapsed');
      if(items) items.classList.add('nav-collapsed');
    });
    recalcSecCascade(shell);   /* re-fold the tiers under restored state */
    if(keep.raw&&!keep.tree){
      shell.classList.add('raw');
      populateRawView(shell);  /* a reload/restore skips the Raw button */
    }
    if(keep.tree){
      shell.classList.add('tree');
      var sh=APP.shells[stem];
      if(sh) buildTree(sh);
    }
    applyFilters();
    renderRawBtn();renderViewBtns();
    if(keep.tree) relayoutActiveTree();
  }
  /* ---- YOUR LAYOUT, remembered per notebook -------------------------
     Hidden cells, hidden/collapsed sections, tree-or-raw mode and the
     whole filter setup are kept against the notebook's PATH, so closing
     the browser and coming back finds the document as you left it. ---- */
  function viewKey(path){
    return 'junoview:layout:'+String(path||'');
  }
  /* "your whole view", as data: hidden cells and sections, hidden
     headings, collapsed sections, tree/raw, every filter (including the
     per-section ones) and the figure/text sizes. ONE function builds it,
     so the layout cache and a saved custom view can never drift apart. */
  function layoutSnapshot(stem){
    var sh=APP.shells[stem];
    if(!sh||!sh.el) return null;
    var st=captureViewState(sh.el);
    delete st.scroll;                   /* where you were is not layout */
    var pre=String(stem)+'::';
    st.def=FDEFof(stem);
    st.sec={};st.scope=[];
    for(var k in secF){
      if(k.indexOf(pre)===0) st.sec[k.slice(pre.length)]=secF[k];}
    for(var k2 in secScope){
      if(k2.indexOf(pre)===0&&secScope[k2])
        st.scope.push(k2.slice(pre.length));}
    /* the size you set on individual figures is part of your layout */
    st.figs={};
    $$('.card.has-fig',sh.el).forEach(function(c){
      var f=parseFloat(c.style.getPropertyValue('--fz'));
      if(f&&f!==1&&c.dataset.anchor) st.figs[c.dataset.anchor]=f;
    });
    /* the two feed-wide sizers are layout too — a setting that resets on
       every visit reads as a feature that was taken away */
    st.figall=APP.getFigAll?APP.getFigAll():1;
    st.mdall=APP.getMdAll?APP.getMdAll():1;
    st.v=1;
    return st;
  }
  function applySnapshot(shell,stem,st){
    if(!st) return false;
    /* the filter state first, so the one applyFilters below is enough */
    if(st.def) defBy[String(stem)]=cloneF(st.def);
    var pre=String(stem)+'::';
    for(var k in secF){if(k.indexOf(pre)===0) delete secF[k];}
    for(var k2 in secScope){if(k2.indexOf(pre)===0) delete secScope[k2];}
    Object.keys(st.sec||{}).forEach(function(sid){
      secF[pre+sid]=cloneF(st.sec[sid]);});
    if(Array.isArray(st.scope)&&st.scope.length){
      st.scope.forEach(function(sid){secScope[pre+sid]=1;});
      scopeSeeded[String(stem)]=1;
    }
    invalidateSids();
    if(APP.setFigAll) APP.setFigAll(st.figall||1);
    if(APP.setMdAll) APP.setMdAll(st.mdall||1);
    $$('.card.has-fig',shell).forEach(function(c){
      c.style.removeProperty('--fz');syncZoomed(c);});
    Object.keys(st.figs||{}).forEach(function(an){
      var c=shell.querySelector(
        '.card[data-anchor="'+String(an).replace(/"/g,'\\"')+'"]');
      if(!c) return;
      c.style.setProperty('--fz',st.figs[an]);
      syncZoomed(c);
    });
    restoreViewState(shell,stem,{
      cellsOff:st.cellsOff||[],secsOff:st.secsOff||[],
      secsHeadOff:st.secsHeadOff||[],
      secsClosed:st.secsClosed||[],tree:!!st.tree,raw:!!st.raw});
    return true;
  }
  APP.layoutSnapshot=layoutSnapshot;
  APP.applySnapshot=function(stem,st){
    var sh=APP.shells[stem];
    if(!sh||!sh.el) return false;
    /* a restore must CLEAR what the document is wearing now, or the old
       hidden cells/sections survive underneath the incoming view */
    $$('.card.cell-off',sh.el).forEach(function(c){
      c.classList.remove('cell-off');});
    $$('.section',sh.el).forEach(function(s2){
      s2.classList.remove('sec-off','sec-headoff','sec-collapsed');});
    $$('.navsec-row',sh.el).forEach(function(r){
      r.classList.remove('sec-off','head-off','collapsed');});
    $$('.navitems',sh.el).forEach(function(n){
      n.classList.remove('nav-collapsed');});
    $$('.navitem.cell-off',sh.el).forEach(function(n){
      n.classList.remove('cell-off');});
    sh.el.classList.remove('tree','raw');
    return applySnapshot(sh.el,stem,st);
  };
  function saveLayout(stem){
    try{
      var sh=APP.shells[stem];
      if(!sh||!sh.el||sh.trace) return;
      /* a static export has no path — fall back to the notebook's name so
         the layout still sticks for that page */
      var key=sh.path||('stem:'+stem);
      var st=layoutSnapshot(stem);
      if(!st) return;
      localStorage.setItem(viewKey(key),JSON.stringify(st));
    }catch(e){}
  }
  var saveT=null;
  function scheduleSaveLayout(){
    clearTimeout(saveT);
    saveT=setTimeout(function(){
      if(!APP.active) return;
      saveLayout(APP.active);
      /* a custom view IS this snapshot plus its styling, so every filter
         or hide you change while editing one belongs to it */
      if(APP.syncStylingView) APP.syncStylingView();
    },400);
  }
  APP.scheduleSaveLayout=scheduleSaveLayout;
  function loadLayout(shell,stem,path){
    var st=null;
    try{
      var raw=localStorage.getItem(viewKey(path));
      if(raw) st=JSON.parse(raw);
    }catch(e){}
    if(!st||st.v!==1) return false;
    return applySnapshot(shell,stem,st);
  }
  /* ================= CUSTOM VIEW: styling the document =================
     A custom view is a saved, restyled, filtered view of ONE notebook. It
     is edited in the document itself, so what you see is what it is.

     Every property maps to an inherited CSS variable, which is what buys
     the cascade the user asked for: stamp it on .nbshell and it styles
     every markdown cell; stamp it on a .section and that section wins;
     stamp it on a .card and that one cell wins. "Override individual
     styles" is then just deleting the narrower entries. ------------- */
  var STY=null,styView=null,styOnChange=null,styTarget=null;
  var MD_PROPS=[
    {k:'col',v:'--md-col',t:'color',lab:'Text colour'},
    {k:'size',v:'--md-size',t:'num',lab:'Text size',
      d:1,min:0.6,max:2.4,step:0.05,pct:1},
    {k:'lh',v:'--md-lh',t:'num',lab:'Line height',
      d:1.65,min:1.1,max:2.4,step:0.05},
    {k:'bg',v:'--md-bg',t:'color',lab:'Background'},
    {k:'bd',v:'--md-bd',t:'color',lab:'Border colour'},
    {k:'bw',v:'--md-bw',t:'px',lab:'Border width',d:1,min:0,max:6,step:1},
    {k:'rad',v:'--md-rad',t:'px',lab:'Corner radius',
      d:10,min:0,max:28,step:1},
    {k:'pad',v:'--md-pad',t:'px',lab:'Padding',d:18,min:2,max:44,step:1},
    {k:'font',v:'--md-font',t:'font',lab:'Font'},
    {k:'align',v:'--md-align',t:'align',lab:'Alignment'}
  ];
  var HD_PROPS=[
    {k:'hcol',v:'--hd-col',t:'color',lab:'Heading colour'},
    {k:'hsize',v:'--hd-size',t:'num',lab:'Heading size',
      d:1,min:0.6,max:2.4,step:0.05,pct:1},
    {k:'hwt',v:'--hd-wt',t:'weight',lab:'Weight'},
    {k:'hfont',v:'--hd-font',t:'font',lab:'Font'},
    {k:'hcaps',v:'--hd-caps',t:'caps',lab:'Capitals'},
    {k:'hbg',v:'--hd-bg',t:'color',lab:'Background'},
    {k:'hbd',v:'--hd-bd',t:'color',lab:'Rule colour'},
    {k:'hbw',v:'--hd-bw',t:'px',lab:'Rule width',d:1,min:0,max:8,step:1},
    {k:'haccent',v:'--hd-accent',t:'color',lab:'Accent ("section N")'},
    {k:'heyebrow',v:'--hd-eyebrow',t:'show',lab:'Show "section N"'}
  ];
  var DOC_PROPS=[
    {k:'paper',v:'--vw-bg',t:'color',lab:'Page background'},
    {k:'gap',v:'--vw-gap',t:'px',lab:'Space between cells',
      d:14,min:0,max:48,step:1}
  ];
  var FONTS=[['','Default'],['var(--serif)','Serif'],
             ['var(--sans)','Sans'],['var(--mono)','Mono']];
  var ALIGNS=[['','Default'],['start','Left'],['center','Centre'],
              ['end','Right'],['justify','Justified']];
  var WEIGHTS=[['','Default'],['400','Regular'],['500','Medium'],
               ['600','Semibold'],['700','Bold']];
  function cssVal(p,val){
    if(p.t==='px') return String(val)+'px';
    if(p.t==='caps') return val?'uppercase':'none';
    if(p.t==='show') return val?'block':'none';
    return String(val);
  }
  function stamp(el,obj,props){
    props.forEach(function(p){
      var v=obj?obj[p.k]:null;
      if(v===undefined||v===null||v==='') el.style.removeProperty(p.v);
      else el.style.setProperty(p.v,cssVal(p,v));
    });
  }
  function ALLPROPS(){return MD_PROPS.concat(HD_PROPS).concat(DOC_PROPS);}
  function styShell(){
    /* a custom view belongs to ONE notebook: style that one, whatever tab
       happens to be in front, so switching tabs can never bleed a view's
       styling onto a different notebook */
    var stem=(styView&&styView.nb)||APP.active;
    var sh=APP.shells[stem];
    return (sh&&sh.el&&!sh.trace)?sh.el:null;
  }
  function countNarrow(){
    var S=STY||{};
    return Object.keys(S.sec||{}).length+Object.keys(S.cell||{}).length;
  }
  function cellsInSection(sid){
    var el=styShell(); if(!el) return [];
    var sec=el.querySelector('.section[data-sec="'+sid+'"]');
    if(!sec) return [];
    return [].map.call(sec.querySelectorAll('.card[data-note="1"]'),
      function(c){return c.dataset.anchor;}).filter(Boolean);
  }
  function applyViewStyle(){
    var el=styShell(); if(!el) return;
    var S=STY||{};
    stamp(el,S.all,MD_PROPS);
    stamp(el,S.head,HD_PROPS);
    stamp(el,S.doc,DOC_PROPS);
    $$('.section',el).forEach(function(s2){
      var o=(S.sec||{})[s2.dataset.sec];
      stamp(s2,o,MD_PROPS);stamp(s2,o,HD_PROPS);
    });
    $$('.card[data-note="1"]',el).forEach(function(c){
      stamp(c,(S.cell||{})[c.dataset.anchor],MD_PROPS);
    });
    markStyOwn();
  }
  function clearStamps(){
    var el=styShell(); if(!el) return;
    var props=ALLPROPS();
    [el].concat([].slice.call(el.querySelectorAll(
      '.section,.card[data-note="1"]'))).forEach(function(n){
      props.forEach(function(p){n.style.removeProperty(p.v);});
    });
  }
  /* a target wearing its OWN style is marked, so "Override individual
     styles" is never a blind action */
  function markStyOwn(){
    var el=styShell(); if(!el) return;
    var S=STY||{};
    $$('.sty-btn',el).forEach(function(b){
      var own=b.dataset.styKind==='sec'
        ?!!(S.sec||{})[b.dataset.styId]
        :!!(S.cell||{})[b.dataset.styId];
      b.classList.toggle('sty-own',own);
      b.textContent=own?'styled':'style';
    });
    var ov=$('#sb-override');
    if(ov){
      var n=countNarrow();
      ov.hidden=!n;
      ov.textContent='Override '+n+' individual style'+(n===1?'':'s');
    }
  }
  function ensureStyBtns(){
    var el=styShell(); if(!el) return;
    $$('.card[data-note="1"]',el).forEach(function(c){
      if(c.querySelector(':scope > .sty-btn')) return;
      var b=document.createElement('button');
      b.className='sty-btn';b.type='button';b.textContent='style';
      b.dataset.styKind='cell';b.dataset.styId=c.dataset.anchor||'';
      b.title='Style just this markdown cell';
      b.addEventListener('click',function(e){
        e.preventDefault();e.stopPropagation();
        openStyPanel({kind:'cell',id:b.dataset.styId},b);
      });
      c.appendChild(b);
    });
    $$('.sectionhead',el).forEach(function(h){
      if(h.querySelector(':scope > .sty-btn')) return;
      var sec=h.closest('.section'); if(!sec) return;
      var b=document.createElement('button');
      b.className='sty-btn';b.type='button';b.textContent='style';
      b.dataset.styKind='sec';b.dataset.styId=sec.dataset.sec||'';
      b.title='Style this section — its heading and its markdown cells';
      b.addEventListener('click',function(e){
        e.preventDefault();e.stopPropagation();
        openStyPanel({kind:'sec',id:b.dataset.styId},b);
      });
      h.insertBefore(b,h.querySelector('.sec-eye')||null);
    });
  }
  function dropStyBtns(){
    $$('.sty-btn').forEach(function(b){b.remove();});
    $$('.sty-sel').forEach(function(n){n.classList.remove('sty-sel');});
  }
  function styModelFor(t){
    var S=STY||{};
    if(t.kind==='all') return S.all||(S.all={});
    if(t.kind==='head') return S.head||(S.head={});
    if(t.kind==='doc') return S.doc||(S.doc={});
    if(t.kind==='sec'){
      S.sec=S.sec||{};return S.sec[t.id]||(S.sec[t.id]={});}
    S.cell=S.cell||{};return S.cell[t.id]||(S.cell[t.id]={});
  }
  function styPropsFor(t){
    if(t.kind==='head') return HD_PROPS;
    if(t.kind==='doc') return DOC_PROPS;
    if(t.kind==='sec') return MD_PROPS.concat(HD_PROPS);
    return MD_PROPS;
  }
  function styTitleFor(t){
    if(t.kind==='all') return 'every markdown cell';
    if(t.kind==='head') return 'every heading';
    if(t.kind==='doc') return 'the page';
    if(t.kind==='sec'){
      var el=styShell();
      var h=el&&el.querySelector(
        '.section[data-sec="'+t.id+'"] .sectionhead h2');
      return 'section “'+((h&&h.textContent)||t.id)+'”';
    }
    var el2=styShell();
    var c=el2&&el2.querySelector(
      '.card[data-anchor="'+String(t.id).replace(/"/g,'\\"')+'"]');
    var ct=c&&c.querySelector('.cardtitle');
    return 'the cell “'+((ct&&ct.textContent.trim())||t.id)+'”';
  }
  function styDirty(){
    applyViewStyle();
    if(styView&&styOnChange){
      styView.style=STY;
      styOnChange();
    }
  }
  function closeStyPanel(){
    var p=$('#stylepanel');
    if(p){p.hidden=true;p.innerHTML='';}
    styTarget=null;
    $$('.sty-sel').forEach(function(n){n.classList.remove('sty-sel');});
    ['#sb-md','#sb-hd','#sb-doc'].forEach(function(s){
      var b=$(s); if(b) b.setAttribute('aria-pressed','false');});
  }
  function openStyPanel(t,anchor){
    var p=$('#stylepanel'); if(!p||!STY) return;
    closeStyPanel();
    styTarget=t;
    if(p.parentNode!==document.body) document.body.appendChild(p);
    var model=styModelFor(t),props=styPropsFor(t);
    var h=document.createElement('div');h.className='sp-h';
    h.textContent='style '+(t.kind==='all'?'all markdown'
      :t.kind==='head'?'all headings':t.kind==='doc'?'page':t.kind);
    p.appendChild(h);
    var sub=document.createElement('div');sub.className='sp-sub';
    sub.textContent='Applies to '+styTitleFor(t)+'.';
    p.appendChild(sub);
    props.forEach(function(pr){
      var row=document.createElement('div');row.className='sp-row';
      var lab=document.createElement('span');lab.className='sp-rl';
      lab.textContent=pr.lab;row.appendChild(lab);
      var val=model[pr.k];
      if(pr.t==='color'){
        var ci=document.createElement('input');ci.type='color';
        ci.value=/^#/.test(String(val||''))?val:'#3fa9c4';
        ci.addEventListener('input',function(){
          model[pr.k]=ci.value;styDirty();});
        row.appendChild(ci);
        var cx=document.createElement('button');cx.className='toggle';
        cx.type='button';cx.textContent='clear';
        cx.style.height='24px';cx.style.padding='0 8px';
        cx.addEventListener('click',function(){
          delete model[pr.k];styDirty();openStyPanel(t,anchor);});
        row.appendChild(cx);
      } else if(pr.t==='num'||pr.t==='px'){
        var r=document.createElement('input');r.type='range';
        r.min=pr.min;r.max=pr.max;r.step=pr.step;
        r.value=(val==null||val==='')?pr.d:val;
        var out=document.createElement('span');out.className='sp-val';
        var show=function(v){
          out.textContent=pr.pct?Math.round(v*100)+'%'
            :(pr.t==='px'?v+'px':Number(v).toFixed(2));};
        show(r.value);
        r.addEventListener('input',function(){
          var v=pr.t==='px'?parseInt(r.value,10):parseFloat(r.value);
          model[pr.k]=v;show(v);styDirty();});
        row.appendChild(r);row.appendChild(out);
      } else {
        var sel=document.createElement('select');
        var opts=pr.t==='font'?FONTS:pr.t==='align'?ALIGNS
          :pr.t==='weight'?WEIGHTS
          :[['','Default'],['1','Yes'],['0','No']];
        opts.forEach(function(o){
          var op=document.createElement('option');
          op.value=o[0];op.textContent=o[1];sel.appendChild(op);});
        sel.value=(val==null||val==='')?'':String(val);
        sel.addEventListener('change',function(){
          if(sel.value==='') delete model[pr.k];
          else model[pr.k]=(pr.t==='caps'||pr.t==='show')
            ?(sel.value==='1'?1:0):sel.value;
          styDirty();});
        row.appendChild(sel);
      }
      p.appendChild(row);
    });
    /* the override action, scoped to what this panel edits */
    var narrow=t.kind==='all'||t.kind==='head'?countNarrow()
      :t.kind==='sec'?cellsInSection(t.id).filter(function(a){
        return !!(STY.cell||{})[a];}).length:0;
    if(narrow){
      var w=document.createElement('div');w.className='sp-warn';
      w.textContent=narrow+' item'+(narrow===1?'':'s')+' inside this '
        +'still carry their own style, so they ignore what you set here.';
      p.appendChild(w);
      var ob=document.createElement('button');ob.className='toggle';
      ob.type='button';ob.style.width='100%';
      ob.textContent='Override those '+narrow+' individual style'
        +(narrow===1?'':'s');
      ob.addEventListener('click',function(){
        if(t.kind==='sec'){
          cellsInSection(t.id).forEach(function(a){
            if(STY.cell) delete STY.cell[a];});
        } else {STY.sec={};STY.cell={};}
        styDirty();openStyPanel(t,anchor);
      });
      p.appendChild(ob);
    }
    var btns=document.createElement('div');btns.className='sp-btns';
    var clr=document.createElement('button');clr.className='toggle';
    clr.type='button';clr.textContent='Clear this style';
    clr.addEventListener('click',function(){
      if(t.kind==='sec'&&STY.sec) delete STY.sec[t.id];
      else if(t.kind==='cell'&&STY.cell) delete STY.cell[t.id];
      else if(t.kind==='all') STY.all={};
      else if(t.kind==='head') STY.head={};
      else if(t.kind==='doc') STY.doc={};
      styDirty();closeStyPanel();
    });
    var done=document.createElement('button');
    done.className='toggle primary';done.type='button';
    done.textContent='Close';
    done.addEventListener('click',closeStyPanel);
    btns.appendChild(clr);btns.appendChild(done);
    p.appendChild(btns);
    p.hidden=false;
    /* place it under whatever opened it, clamped to the window */
    var r2=(anchor||$('#sb-md')).getBoundingClientRect();
    var pr2=p.getBoundingClientRect();
    p.style.top=Math.min(r2.bottom+7,
      Math.max(8,window.innerHeight-pr2.height-8))+'px';
    p.style.left=Math.max(8,
      Math.min(r2.left,window.innerWidth-pr2.width-8))+'px';
    if(t.kind==='sec'||t.kind==='cell'){
      var el3=styShell();
      var node=t.kind==='sec'
        ?el3.querySelector('.section[data-sec="'+t.id+'"] .sectionhead')
        :el3.querySelector('.card[data-anchor="'
          +String(t.id).replace(/"/g,'\\"')+'"]');
      if(node) node.classList.add('sty-sel');
    }
    var bmap={all:'#sb-md',head:'#sb-hd',doc:'#sb-doc'};
    if(bmap[t.kind]){
      var bb=$(bmap[t.kind]);
      if(bb) bb.setAttribute('aria-pressed','true');
    }
  }
  APP.enterStyling=function(view,onChange){
    if(!view) return false;
    styView=view;
    STY=view.style||(view.style={});
    styOnChange=onChange||null;
    document.body.classList.add('styling');
    var b=$('#stylebar'); if(b) b.hidden=false;
    var n=$('#sb-name'); if(n) n.textContent=view.name||'';
    ensureStyBtns();
    applyViewStyle();
    measureChrome();
    return true;
  };
  APP.exitStyling=function(){
    if(!STY) return;
    closeStyPanel();
    clearStamps();
    dropStyBtns();
    STY=null;styView=null;styOnChange=null;
    document.body.classList.remove('styling');
    var b=$('#stylebar'); if(b) b.hidden=true;
    measureChrome();
  };
  APP.stylingView=function(){return styView;};
  APP.syncStylingView=function(){
    if(!styView||!styOnChange||!APP.active) return;
    var snap=layoutSnapshot(APP.active);
    if(!snap) return;
    styView.view=snap;
    styView.nb=APP.active;
    styOnChange();
  };
  (function(){
    var md=$('#sb-md'),hd=$('#sb-hd'),dc=$('#sb-doc');
    if(md) md.addEventListener('click',function(){
      openStyPanel({kind:'all',id:''},md);});
    if(hd) hd.addEventListener('click',function(){
      openStyPanel({kind:'head',id:''},hd);});
    if(dc) dc.addEventListener('click',function(){
      openStyPanel({kind:'doc',id:''},dc);});
    var ov=$('#sb-override');
    if(ov) ov.addEventListener('click',function(){
      if(!STY) return;
      STY.sec={};STY.cell={};styDirty();closeStyPanel();});
    var rs=$('#sb-reset');
    if(rs) rs.addEventListener('click',function(){
      if(!STY) return;
      STY.all={};STY.head={};STY.doc={};STY.sec={};STY.cell={};
      styDirty();closeStyPanel();});
    /* clicking the BODY of a markdown cell or a heading styles that one
       (real controls — chevrons, eyes, links — still do their own job) */
    document.addEventListener('click',function(e){
      if(!STY) return;
      var p=$('#stylepanel');
      if(p&&!p.hidden&&p.contains(e.target)) return;
      if(e.target.closest('.stylebar')) return;
      if(e.target.closest('button,a,input,select,textarea')) return;
      var card=e.target.closest('.card[data-note="1"]');
      if(card){
        e.preventDefault();e.stopPropagation();
        openStyPanel({kind:'cell',id:card.dataset.anchor||''},card);
        return;
      }
      var head=e.target.closest('.sectionhead');
      if(head){
        var sec=head.closest('.section');
        e.preventDefault();e.stopPropagation();
        openStyPanel({kind:'sec',id:(sec&&sec.dataset.sec)||''},head);
        return;
      }
      if(p&&!p.hidden) closeStyPanel();
    },true);
    /* a refresh re-mounts the shell: re-stamp and re-hang the buttons */
    document.addEventListener('sem:shell',function(){
      if(!STY) return;
      ensureStyBtns();applyViewStyle();
    });
  })();
  function mountShellHTML(htmlStr,path,quiet){
    var host=$('#docs');
    var tmp=document.createElement('div');
    tmp.innerHTML=htmlStr;
    var shell=tmp.querySelector('.nbshell');
    if(!shell){alert('Open failed: bad response');return;}
    if(path) shell.dataset.path=path;
    var stem=shell.dataset.nb;
    var old=APP.shells[stem];
    var keep=(old&&old.el)?captureViewState(old.el):null;
    /* a reload replaces the notebook's cards — its Plot-trace tabs now hold
       stale clones, so close them (a fresh trace re-clones the new cards) */
    if(old) APP.traces.slice().forEach(function(k){
      if(APP.shells[k]&&APP.shells[k].source===stem) closeNotebook(k);
    });
    if(old&&old.el.parentNode) host.replaceChild(shell,old.el);
    else host.appendChild(shell);
    initShell(shell);
    invalidateSids();   /* this notebook's sections were just replaced */
    /* a reload keeps the live view; a fresh open restores the layout you
       last left this notebook in */
    if(keep) restoreViewState(shell,stem,keep);
    else loadLayout(shell,stem,
      path||shell.dataset.path||('stem:'+stem));
    /* a VERSION of a notebook you already have open is not a new
       document — it must not turn up in Recent as a separate file */
    if(path&&!quiet&&APP.noteRecent) APP.noteRecent(path);
    activate(stem);
    if(keep&&keep.scroll){
      window.scrollTo(0,keep.scroll);
      /* once more after images/math settle the layout */
      setTimeout(function(){window.scrollTo(0,keep.scroll);},150);
    }
    if(window.MathJax&&MathJax.typesetPromise)
      MathJax.typesetPromise([shell]).catch(function(){});
  }
  APP.mountShellHTML=mountShellHTML;
  /* ---- "Plot trace" opens in its OWN TAB: a genuine subset of the docs
     holding just this plot's lineage cells + the dependency graph. The tab
     is a real .nbshell, so every global filter and per-card control works
     inside it exactly as it does in the full document. ---- */
  function traceGoto(itemId){
    /* the graph lives inside the active trace tab — scroll to a step there */
    var sh=APP.active&&APP.shells[APP.active];
    if(!sh||!sh.el) return;
    var card=sh.el.querySelector('.card[id="card-'+itemId+'"]');
    if(card){card.scrollIntoView({block:'center'});
      card.classList.add('target-flash');
      setTimeout(function(){card.classList.remove('target-flash');},1200);}
  }
  APP.traceGoto=traceGoto;
  function openTraceTab(stem,ids,title,graph,anchor){
    var src=APP.shells[stem];
    if(!src||!src.el) return;
    var key='trace::'+stem+'::'
      +(anchor||(ids&&ids.length&&ids[ids.length-1])||title||'plot');
    if(APP.shells[key]){          /* already open — just bring it forward */
      activate(key);return key;
    }
    /* clone the lineage cards in DOCUMENT order (a true subset of the docs) */
    var want={};(ids||[]).forEach(function(i){want[i]=1;});
    var section=document.createElement('section');
    section.className='section';
    $$('.content .card',src.el).forEach(function(card){
      var id=card.id.replace(/^card-/,'');
      if(want[id]) section.appendChild(card.cloneNode(true));
    });
    if(!section.children.length){        /* nothing matched: show the plot */
      var only=src.el.querySelector('.content .card');
      if(only) section.appendChild(only.cloneNode(true));
    }
    /* clones: drop per-cell eyes (no way back) and add-note pencils (their
       listeners don't survive cloneNode; notes belong on the source tab) */
    $$('.cell-eye,.card-addnote',section).forEach(function(b){
      if(b.parentNode) b.parentNode.removeChild(b);});
    $$('.card.cell-off',section).forEach(function(c){
      c.classList.remove('cell-off');});
    /* cards default to opacity:0 and are revealed by initShell's scroll
       observer; the trace tab is a deliberate, fully-shown subset and has no
       such observer, so force every clone visible up front */
    $$('.card',section).forEach(function(c){c.classList.add('in');});
    var shell=document.createElement('div');
    shell.className='shell nbshell tracetab';
    shell.dataset.nb=key;
    shell.dataset.src=stem;   /* the real notebook a placed clone resolves to */
    /* the lineage items actually present (covers the fallback case too) —
       they power the sidebar nav and the Tree view of this trace */
    var haveIds={};
    $$('.card',section).forEach(function(c){
      haveIds[c.id.replace(/^card-/,'')]=1;});
    var lineage=((src.data&&src.data.items)||[]).filter(function(it){
      return haveIds[it.card];});
    /* a real sidebar, so the ☰ sections toggle works here like in a
       notebook tab: one nav entry per lineage step */
    var KCLS={figure:'k-figure',diagnostic:'k-figure',dataset:'k-dataset',
      transform:'k-transform',metric:'k-metric',text:'k-print',
      note:'k-note',code:'k-code'};
    var rail=document.createElement('aside');rail.className='rail';
    var rh=document.createElement('div');rh.className='railhead';
    var rt=document.createElement('h1');rt.className='railtitle';
    rt.textContent=title||'Plot trace';
    var rmeta=document.createElement('div');rmeta.className='railmeta';
    rmeta.textContent=lineage.length+' steps · from '+stem;
    rh.appendChild(rt);rh.appendChild(rmeta);rail.appendChild(rh);
    var nav=document.createElement('nav');nav.className='nav';
    nav.setAttribute('aria-label','Plot lineage');
    lineage.forEach(function(it){
      var a=document.createElement('a');
      var kc=KCLS[it.kind]||'k-code';
      if(kc!=='k-figure'&&it.codeKinds
         &&(it.codeKinds.length!==1||it.codeKinds[0]!=='code'))
        kc+=' ckmain-'+it.codeKind;
      a.className='navitem '+kc;
      a.href='#card-'+it.card;
      var d=document.createElement('span');d.className='dot';
      var t=document.createElement('span');t.className='navitem-t';
      t.textContent=it.title;
      a.appendChild(d);a.appendChild(t);
      nav.appendChild(a);
    });
    nav.addEventListener('click',function(e){
      var a=e.target.closest?e.target.closest('.navitem'):null;
      if(!a) return;
      e.preventDefault();
      var id=(a.getAttribute('href')||'').slice(1);
      var el=id?shell.querySelector('[id="'+id+'"]'):null;
      if(el){el.scrollIntoView({behavior:'smooth',block:'center'});
        el.classList.add('target-flash');
        setTimeout(function(){el.classList.remove('target-flash');},1200);}
    });
    rail.appendChild(nav);
    shell.appendChild(rail);
    var stage=document.createElement('main');stage.className='stage';
    var content=document.createElement('div');content.className='content';
    var head=document.createElement('div');head.className='tracetab-head';
    var eb=document.createElement('span');eb.className='tracetab-eyebrow';
    eb.textContent='plot trace';
    var h=document.createElement('h2');h.className='tracetab-t';
    h.textContent=title||'Plot trace';
    var sub=document.createElement('span');sub.className='tracetab-sub';
    sub.textContent='the cells that build this plot, from '+stem;
    head.appendChild(eb);head.appendChild(h);head.appendChild(sub);
    /* view switcher IN the header: the same lineage as a readable LIST of
       cells or as an expandable dependency TREE (columns by step). The
       appbar's Tree button does the same, but here it's discoverable. */
    var vsw=document.createElement('div');vsw.className='trace-viewsw';
    var bList=document.createElement('button');
    bList.className='dbtn tvw';bList.type='button';
    bList.innerHTML=bic('menu')+' Cells';
    bList.title='The lineage as a readable list of cells';
    var bTree=document.createElement('button');
    bTree.className='dbtn tvw';bTree.type='button';
    bTree.innerHTML=bic('tree')+' Tree';
    bTree.title='The lineage as an expandable dependency tree — columns '
      +'by step, click a node to open the cell';
    function syncVsw(){
      var on=shell.classList.contains('tree');
      bList.classList.toggle('on',!on);
      bTree.classList.toggle('on',on);
    }
    function setTraceView(tree){
      if(shell.classList.contains('tree')===tree){syncVsw();return;}
      if(window.SemView&&window.SemView.tree) window.SemView.tree();
      else shell.classList.toggle('tree');
      syncVsw();
    }
    bList.addEventListener('click',function(){setTraceView(false);});
    bTree.addEventListener('click',function(){setTraceView(true);});
    vsw.appendChild(bList);vsw.appendChild(bTree);
    syncVsw();
    try{      /* the appbar Tree button toggles too — stay in sync */
      new MutationObserver(syncVsw)
        .observe(shell,{attributes:true,attributeFilter:['class']});
    }catch(e){}
    head.appendChild(vsw);
    content.appendChild(head);
    if(graph){var gw=document.createElement('div');
      gw.className='tracetab-graph';gw.appendChild(graph);
      content.appendChild(gw);}
    content.appendChild(section);
    stage.appendChild(content);
    /* an (initially empty) tree host so Tree view works on this trace */
    var tv=document.createElement('div');tv.className='treeview';
    tv.setAttribute('aria-label','Analysis tree view');
    stage.appendChild(tv);
    shell.appendChild(stage);
    var host=$('#docs')||document.body;
    host.appendChild(shell);
    /* wire the clones so their code toggles, eyes, collapse + fig-fold work */
    wireCardBehaviors(shell,stem);
    activateOutputs(shell,true);   /* draw plotly specs on the clones */
    APP.shells[key]={el:shell,
      data:{stem:stem,items:lineage},   /* subset: feeds buildTree */
      path:'',title:title||'Plot trace',
      trace:true,source:stem};
    if(APP.traces.indexOf(key)<0) APP.traces.push(key);
    activate(key);
    applyFilters();
    applyCodeState(shell);   /* fold/hide code to match the current state */
    var c=shell.querySelector('.content'); if(c) c.scrollTop=0;
    window.scrollTo(0,0);
    return key;
  }
  APP.openTraceTab=openTraceTab;
  /* one open per source at a time: repeated Enter/clicks are ignored
     while the fetch runs, and the dialog shows a loading bar */
  var OPENBUSY={},dlgBusyN=0;
  function setDlgBusy(b){
    /* counter, not flag: several sources can load at once and the
       dialog stays locked until the last one settles */
    dlgBusyN=Math.max(0,dlgBusyN+(b?1:-1));
    var on=dlgBusyN>0;
    var go=$('#odlg-go'),inp=$('#odlg-input'),ld=$('#odlg-load');
    if(go){go.disabled=on;go.textContent=on?'Opening…':'Open';}
    if(inp) inp.disabled=on;
    if(ld) ld.hidden=!on;
    /* the same signal on the WELCOME screen, which has its own ways in
       (the recent list, the big buttons) and used to show nothing at all
       while a notebook loaded (2026-08-21, user) */
    var wl=$('#welcome-load');
    if(wl) wl.hidden=!on;
    if(!on) $$('.recent-i.busy').forEach(function(b){
      b.classList.remove('busy');});
  }
  /* a saved presentation, by name — the .junoview.html polyglot save or a
     bare-JSON .junoview */
  function isDeckPath(p){
    return /\.junoview(\.html)?$/i
      .test(String(p||'').split('?')[0].split('#')[0]);
  }
  /* hand text to the deck importer (deck.js) — the same importer behind
     "+ New… → Open a .junoview file…", so every road in behaves alike */
  function importDeckTextSafe(txt,label){
    try{
      if(window.SemDeckImport) window.SemDeckImport(txt,false);
      else alert('The presentation editor has not loaded yet — '
        +'try again in a moment.');
    }catch(e){
      alert('Could not open '+(label||'that file')+': '
        +((e&&e.message)||e));
    }
    hideDlg();
  }
  function fetchDeckUrl(url){
    url=normNbUrl(url);   /* GitHub blob links become raw, like notebooks */
    setDlgBusy(true);
    fetch(url,{cache:'no-store'}).then(function(r){
      if(!r.ok) throw new Error('HTTP '+r.status);
      return r.text();
    }).then(function(txt){
      setDlgBusy(false);
      importDeckTextSafe(txt,decodeURIComponent(
        url.split('?')[0].split('/').pop()||url));
    }).catch(function(e){
      setDlgBusy(false);
      alert('Could not fetch '+url+'\n'+((e&&e.message)||e)
        +'\nIf that host blocks cross-site requests, download the '
        +'file and drop it here instead.');
    });
  }
  function openPath(path){
    /* saved presentations open from the SAME places notebooks do — the
       folder listing, a pasted path, a GitHub link (2026-08-20, user: on
       disk they carry the browser's icon and there was no way in) */
    if(isDeckPath(path)){
      /* in the browser build a deck beside the page is as openable as
         one on a host -- its URL is simply relative */
      if(isUrl(path)||APP.mode==='web'){fetchDeckUrl(path);return;}
      if(APP.mode!=='app') return;
      if(OPENBUSY[path]) return;
      OPENBUSY[path]=1;setDlgBusy(true);
      api('/api/readdeck',{path:path}).then(function(j){
        delete OPENBUSY[path];setDlgBusy(false);
        importDeckTextSafe(j.text,j.name||path);
      }).catch(function(e){
        delete OPENBUSY[path];setDlgBusy(false);
        alert('Open failed: '+e.message);});
      return;
    }
    if(APP.mode==='web'){
      /* NOT only absolute URLs. The bundled example is remembered as
         "example_climate_analysis.ipynb" -- a path relative to the page
         -- so gating on isUrl() meant clicking it in the recent list did
         nothing whatsoever: no fetch, no error, no sign that the click
         had landed (2026-08-21). fetch() resolves a relative path
         against the page, and anything that genuinely cannot be fetched
         reports itself through webOpenUrl's own catch. */
      webOpenUrl(path,false);
      return;
    }
    if(OPENBUSY[path]) return;
    OPENBUSY[path]=1;setDlgBusy(true);
    api('/api/open',{path:path}).then(function(j){
      delete OPENBUSY[path];setDlgBusy(false);
      mountShellHTML(j.shell,j.path||path);
      hideDlg();
    }).catch(function(e){
      delete OPENBUSY[path];setDlgBusy(false);
      alert('Open failed: '+e.message);});
  }
  APP.openPath=openPath;
  function closeNotebook(stem){
    var sh=APP.shells[stem]; if(!sh) return;
    /* closing a notebook also closes any Plot-trace tabs derived from it */
    if(!sh.trace) APP.traces.slice().forEach(function(k){
      if(APP.shells[k]&&APP.shells[k].source===stem) closeNotebook(k);
    });
    if(sh.el.parentNode) sh.el.parentNode.removeChild(sh.el);
    delete APP.shells[stem];
    /* drop this notebook's filter state — otherwise it lingers forever and
       a later notebook with the same stem reopens pre-filtered */
    var pre=String(stem)+'::';
    delete defBy[String(stem)];delete scopeSeeded[String(stem)];
    [secF,secScope,scopeOpen].forEach(function(m){
      for(var k in m){if(k.indexOf(pre)===0) delete m[k];}
    });
    var list=sh.trace?APP.traces:APP.order;
    var i=list.indexOf(stem);
    if(i>=0) list.splice(i,1);
    if(APP.active===stem){
      APP.active=null;
      /* closing a trace tab returns to its source notebook; otherwise fall
         back to the last remaining notebook (or trace) tab */
      var back=(sh.trace&&APP.shells[sh.source])?sh.source
        :(APP.order[APP.order.length-1]||APP.traces[APP.traces.length-1]);
      if(back) activate(back); else {renderRawBtn();renderViewBtns();}
    }
    renderTabs();
    if(sh.trace) return;   /* a trace tab is not a notebook — no teardown */
    document.dispatchEvent(new CustomEvent('sem:shellclosed',
      {detail:{stem:stem}}));
    if(APP.mode==='app'&&sh.path)
      api('/api/close',{path:sh.path}).catch(function(){});
    if(APP.mode==='web'&&sh.path) webUnnote(sh.path);
  }

  /* ================= web mode (Pyodide, fully client-side) ============ */
  var WEBKEY='semweb:'+location.pathname;
  function isUrl(s){return /^https?:\/\//i.test(String(s||''));}
  function normNbUrl(u){
    u=String(u||'').trim();
    var m=u.match(
      /^https?:\/\/github\.com\/([^\/]+)\/([^\/]+)\/(?:blob|raw)\/(.+)$/);
    if(m) return 'https://raw.githubusercontent.com/'
      +m[1]+'/'+m[2]+'/'+m[3];
    return u;
  }
  function webReady(){return !!window.semPy;}
  function webParseText(name,text){
    if(!webReady()){
      alert('Python is still loading — try again in a moment.');
      return;
    }
    try{
      var shell=window.semPy.parse(name,text,APP.order);
      mountShellHTML(shell,'');
      hideDlg();
    }catch(e){
      alert('Could not open '+name+': '+((e&&e.message)||e));
    }
  }
  /* WHAT THIS TOOL CAN OPEN (T91). Kept in step with SOURCES in
     notebook/sources.py, which is where the parsing actually happens --
     this list only decides which dropped files are worth handing over.
     A file that gets past it and cannot be parsed says so; a file that
     never gets here silently does nothing, which is the worse failure. */
  var SRC_RE=/\.(ipynb|md|markdown|qmd|tex|latex|csv|tsv)$/i;
  function webOpenFiles(files){
    Array.prototype.slice.call(files||[]).forEach(function(f){
      if(isDeckPath(f.name)){
        f.text().then(function(txt){importDeckTextSafe(txt,f.name);});
      } else if(SRC_RE.test(f.name)){
        f.text().then(function(txt){webParseText(f.name,txt);});
      } else if(/\.html?$/i.test(f.name)){
        /* a renamed save is still worth a try — the importer says
           plainly when an HTML file carries no Junoview data */
        f.text().then(function(txt){importDeckTextSafe(txt,f.name);});
      }
    });
  }
  function webOpenUrl(url,silent){
    if(isDeckPath(url)){fetchDeckUrl(url);return;}
    url=normNbUrl(url);
    var pend=OPENBUSY[url];
    if(pend){
      /* already loading; a real click on a silently-restoring URL
         surfaces the busy UI instead of dying quietly */
      if(!silent&&pend.s){pend.s=false;setDlgBusy(true);}
      return;
    }
    pend=OPENBUSY[url]={s:silent};
    if(!silent) setDlgBusy(true);
    function done(){delete OPENBUSY[url];if(!pend.s) setDlgBusy(false);}
    /* GitHub's raw CDN caches for minutes: bust its cache key on every
       (re)fetch so a refresh sees the latest commit immediately */
    var fu=url;
    if(/^https?:\/\/[^\/]*githubusercontent\.com\//i.test(url))
      fu=url+(url.indexOf('?')<0?'?':'&')+'jvr='+Date.now();
    fetch(fu,{cache:'no-store'}).then(function(r){
      if(!r.ok){
        /* carry the status: the restore path below has to tell "the
           server says this is gone" apart from "there is no network" */
        var he=new Error('HTTP '+r.status);he.status=r.status;throw he;
      }
      return r.text();
    }).then(function(txt){
      if(!webReady()) throw new Error('Python is still loading');
      var name=decodeURIComponent(
        url.split('?')[0].split('/').pop()||'notebook.ipynb');
      /* reloading: exclude the tab that already holds this URL from the
         "taken" names so the parser reproduces its stem and we REPLACE
         that tab in place instead of minting a new one */
      var taken=APP.order.filter(function(s){
        return !(APP.shells[s]&&APP.shells[s].path===url);});
      var shell=window.semPy.parse(name,txt,taken);
      mountShellHTML(shell,url);
      webNote(url);
      done();
      hideDlg();
    }).catch(function(e){
      var wasSilent=pend.s;
      done();
      if(wasSilent){
        /* A FAILED RESTORE MUST NOT FORGET THE NOTEBOOK. This used to
           call webUnnote() on any failure, so opening the app once with
           no connection erased the whole session — and the notebooks
           were still gone when the network came back (2026-08-21). A
           fetch that never reached a server rejects with no status;
           only the server saying the file is not there retires a URL. */
        if(e&&(e.status===404||e.status===410)) webUnnote(url);
        else noteRestoreMiss();
        return;
      }
      alert('Could not fetch '+url+'\n'+((e&&e.message)||e)
        +'\nIf that host blocks cross-site requests, download the '
        +'file and drop it here instead.');
    });
  }
  /* Notebooks kept in the session but not reachable this launch (almost
     always: no network). Silence here reads as "my notebooks are gone",
     which is exactly the panic the forgetting bug used to cause for
     real — so say it once, and say that they are coming back. */
  var restoreMissed=0,restoreMissT=null;
  function noteRestoreMiss(){
    restoreMissed++;
    clearTimeout(restoreMissT);
    restoreMissT=setTimeout(function(){
      var n=restoreMissed;restoreMissed=0;
      docToast(n+' notebook'+(n===1?'':'s')+' could not be reloaded'
        +(navigator.onLine?'':' — you are offline')
        +'. Still remembered; they return when you reconnect.');
    },600);
  }
  function webNote(url){
    try{
      var rec=JSON.parse(localStorage.getItem(WEBKEY+':recent')||'[]');
      rec=[url].concat(rec.filter(function(r){return r!==url;}))
        .slice(0,6);
      localStorage.setItem(WEBKEY+':recent',JSON.stringify(rec));
      var open=JSON.parse(localStorage.getItem(WEBKEY+':open')||'[]');
      if(open.indexOf(url)<0) open.push(url);
      localStorage.setItem(WEBKEY+':open',JSON.stringify(open));
      APP.project.recent=rec;
      renderRecent();
    }catch(e){}
  }
  function webUnnote(url){
    try{
      var open=JSON.parse(localStorage.getItem(WEBKEY+':open')||'[]');
      localStorage.setItem(WEBKEY+':open',
        JSON.stringify(open.filter(function(u){return u!==url;})));
    }catch(e){}
  }

  /* ================= open dialog (server file browser) ================= */
  var dlg=$('#opendlg'), dlgList=$('#odlg-list'), dlgPath=$('#odlg-path');
  var dlgDir='';
  function hideDlg(){if(dlg) dlg.hidden=true;}
  /* remembered files: name-over-path, reopen anything you've had open */
  function splitPath(p){
    var s=String(p||'');
    var parts=s.split(/[\/\\]/);
    var nm=parts[parts.length-1]||s;
    nm=nm.split('?')[0].split('#')[0];
    try{nm=decodeURIComponent(nm);}catch(e){}
    return {name:nm||s, path:s};
  }
  function renderDlgRecent(){
    var host=$('#odlg-recent'); if(!host) return;
    host.innerHTML='';
    var rec=(APP.project&&APP.project.recent)||[];
    if(!rec.length){host.hidden=true;return;}
    host.hidden=false;
    var h=document.createElement('div');h.className='odlg-recent-h';
    h.textContent='recent — reopen';host.appendChild(h);
    rec.slice(0,12).forEach(function(p){
      var sp=splitPath(p);
      var b=document.createElement('button');b.className='odlg-r';
      b.type='button';
      b.title='Reopen '+sp.path;
      /* an icon makes the row read as a thing you act on rather than a
         caption above a path (2026-08-21) */
      var ic=document.createElement('span');ic.className='odlg-r-ic';
      ic.innerHTML=isUrl(p)?bic('link'):bic('doc');b.appendChild(ic);
      var nm=document.createElement('span');nm.className='odlg-r-nm';
      nm.textContent=sp.name;b.appendChild(nm);
      var pt=document.createElement('span');pt.className='odlg-r-p';
      pt.textContent=sp.path;pt.dir='ltr';b.appendChild(pt);
      b.addEventListener('click',function(){openPath(p);});
      host.appendChild(b);
    });
  }
  APP.noteRecent=function(p){
    /* app mode: keep the client's recent list live as tabs open (the
       server persists it too); web mode uses webNote */
    if(!p||APP.mode!=='app') return;
    var rec=(APP.project&&APP.project.recent)||[];
    rec=[p].concat(rec.filter(function(r){return r!==p;})).slice(0,12);
    APP.project.recent=rec;
    renderRecent();
  };
  function showDlg(){
    if(!dlg) return;
    dlg.hidden=false;
    renderDlgRecent();
    var inp=$('#odlg-input'); if(inp) inp.value='';
    var up=$('#odlg-up'), fb=$('#odlg-files');
    if(APP.mode==='web'){
      if(up) up.hidden=true;
      if(fb) fb.hidden=false;
      if(dlgPath) dlgPath.textContent='Open notebooks';
      if(inp) inp.placeholder='…or paste a notebook, .md, .tex or '
        +'.csv URL (GitHub links work) and hit Open';
      dlgList.innerHTML='<div class="odlg-empty">Drop notebooks, '
        +'Markdown, LaTeX or csv files anywhere in the window, use '
        +'&#8220;Choose files&#8230;&#8221;, '
        +'or paste a URL below.<br><br>Everything runs in your browser '
        +'&#8212; nothing is ever uploaded anywhere.</div>';
      return;
    }
    /* this line, not page.html's placeholder attribute, is what a
       user reads: showDlg overwrites it on every open (T100). */
    if(inp) inp.placeholder='…or paste a folder, a notebook/.md/.tex/'
      +'.csv path, or a URL, and hit Open';
    listDir(dlgDir||APP.root||'');
  }
  function listDir(dir){
    api('/api/list?dir='+encodeURIComponent(dir||'')).then(function(j){
      dlgDir=j.dir;
      dlgPath.textContent=j.dir;dlgPath.title=j.dir;
      var up=$('#odlg-up');
      up.disabled=!j.parent;up.dataset.parent=j.parent||'';
      dlgList.innerHTML='';
      if(!j.dirs.length&&!j.notebooks.length&&!(j.decks||[]).length
         &&!(j.sources||[]).length)
        dlgList.innerHTML='<div class="odlg-empty">'
          +'Nothing here this can open.</div>';
      j.dirs.forEach(function(d){
        var b=document.createElement('button');b.className='odlg-i';
        b.innerHTML='<span class="ic">'+bic('open')+'</span>';
        var nm=document.createElement('span');nm.className='nm';
        nm.textContent=d.name;b.appendChild(nm);
        b.addEventListener('click',function(){listDir(d.path);});
        dlgList.appendChild(b);
      });
      j.notebooks.forEach(function(n){
        var b=document.createElement('button');b.className='odlg-i nb';
        b.innerHTML='<span class="ic">'+bic('nb')+'</span>';
        var nm=document.createElement('span');nm.className='nm';
        nm.textContent=n.name;b.appendChild(nm);
        var sz=document.createElement('span');sz.className='sz';
        sz.textContent=n.size||'';b.appendChild(sz);
        b.addEventListener('click',function(){openPath(n.path);});
        dlgList.appendChild(b);
      });
      /* every other source the producer table knows: Markdown,
         Quarto, LaTeX, csv/tsv. They have parsed since T91 and the
         browser did not list them, so the app was the one door that
         could not open a file the CLI could (T100). The row carries the
         KIND the server read off SOURCES rather than guessing from the
         extension here -- a second list is how the two drifted apart in
         the first place. */
      (j.sources||[]).forEach(function(n){
        var b=document.createElement('button');b.className='odlg-i src';
        b.innerHTML='<span class="ic">'+bic('doc')+'</span>';
        b.title='Open this '+(n.kind||'file');
        var nm=document.createElement('span');nm.className='nm';
        nm.textContent=n.name;b.appendChild(nm);
        var sz=document.createElement('span');sz.className='sz';
        sz.textContent=n.size||'';b.appendChild(sz);
        b.addEventListener('click',function(){openPath(n.path);});
        dlgList.appendChild(b);
      });
      /* saved presentations, openable like notebooks (2026-08-20) */
      (j.decks||[]).forEach(function(n){
        var b=document.createElement('button');b.className='odlg-i deck';
        b.innerHTML='<span class="ic">'+bic('present')+'</span>';
        b.title='Open this saved Junoview presentation';
        var nm=document.createElement('span');nm.className='nm';
        nm.textContent=n.name;b.appendChild(nm);
        var sz=document.createElement('span');sz.className='sz';
        sz.textContent=n.size||'';b.appendChild(sz);
        b.addEventListener('click',function(){openPath(n.path);});
        dlgList.appendChild(b);
      });
    }).catch(function(e){
      dlgList.innerHTML='';
      var d=document.createElement('div');d.className='odlg-empty';
      d.textContent=String(e.message);
      dlgList.appendChild(d);
    });
  }
  /* the two "jump back in" columns share a wrapper, which is only worth
     any vertical space when at least one of them has something in it */
  function syncJump(){
    var w=$('#welcome-jump'); if(!w) return;
    var r=$('#welcome-recent'), pz=$('#welcome-pres');
    w.hidden=!((r&&!r.hidden)||(pz&&!pz.hidden));
  }
  function renderRecent(){
    var host=$('#welcome-recent'); if(!host) return;
    host.innerHTML='';
    var rec=(APP.project&&APP.project.recent)||[];
    host.hidden=!rec.length;
    syncJump();
    if(!rec.length) return;
    var h=document.createElement('div');h.className='recent-h';
    h.textContent='recent notebooks';host.appendChild(h);
    rec.slice(0,6).forEach(function(p){
      var sp=splitPath(p);
      var b=document.createElement('button');b.className='recent-i';
      b.type='button';
      /* THE NAME, and the path on hover. These rows were the whole path
         — an https://raw.githubusercontent.com/... URL ellipsised from
         the left — so six remembered notebooks read as six near-identical
         strings (2026-08-21, user: "the recent should just be a file name
         with a path on hover"). */
      b.title=sp.path;
      var ic=document.createElement('span');ic.className='recent-ic';
      ic.innerHTML=isUrl(p)?bic('link'):bic('doc');
      var nm=document.createElement('span');nm.className='recent-nm';
      nm.textContent=sp.name;
      b.appendChild(ic);b.appendChild(nm);
      b.addEventListener('click',function(){
        if(b.classList.contains('busy')) return;
        /* SAY THAT SOMETHING IS HAPPENING. A remembered notebook is a
           fetch and a parse — seconds on a slow link — and the click
           used to change nothing on screen at all (2026-08-21, user:
           "you can't tell it's loading. You need a loading bar"). */
        b.classList.add('busy');
        openPath(p);
        /* openPath raises the busy counter synchronously when it starts
           work; if it did not start any, the row must not sit there
           pretending to load forever */
        if(!dlgBusyN) b.classList.remove('busy');
      });
      host.appendChild(b);
    });
  }
  /* presentations, on the front door. Populated from the deck's own list
     so a draft, a poster and a custom view all show up exactly as the
     rail shows them; absent entirely in a static export, where deck.js
     never registers the hook. */
  function renderWelcomePres(){
    var host=$('#welcome-pres'); if(!host) return;
    host.innerHTML='';
    var list=[];
    try{list=(APP.deckNames&&APP.deckNames())||[];}catch(e){list=[];}
    host.hidden=!list.length;
    syncJump();
    if(!list.length) return;
    var h=document.createElement('div');h.className='recent-h';
    h.textContent='presentations';host.appendChild(h);
    list.slice(0,6).forEach(function(p){
      var kind=p.view?'custom view':p.poster?'poster':'presentation';
      var b=document.createElement('button');b.className='recent-i';
      b.type='button';
      b.title='Open the '+kind+' “'+p.name+'”'
        +(p.draft?' (unsaved draft)':'')
        +(p.slides?(String.fromCharCode(10)+p.slides+' slide'
          +(p.slides===1?'':'s')):'');
      /* NOT the newdeck/newposter/newview icons: those carry the "make a
         new one" affordance; these rows OPEN something that exists */
      var ic=document.createElement('span');ic.className='recent-ic';
      ic.innerHTML=p.view?bic('eye'):p.poster?bic('pagep'):bic('present');
      var nm=document.createElement('span');nm.className='recent-nm';
      nm.textContent=p.name;
      b.appendChild(ic);b.appendChild(nm);
      if(p.draft){
        var d=document.createElement('span');d.className='recent-tag';
        d.textContent='draft';b.appendChild(d);
      }
      b.addEventListener('click',function(){
        if(APP.deckChoose) APP.deckChoose(p.name);
        goHome(false);
      });
      host.appendChild(b);
    });
  }

  /* ---- the welcome screen's demo reel ---------------------------------
     The GIFs sit beside the page (docs/gifs/). A locally rendered file or
     an export has no such folder, so nothing is assumed: each image is
     probed, a figure that 404s removes itself, and if none load the whole
     block stays hidden. Their URLs wait in data-src, so with the demos
     off the page downloads none of them (~22 MB) rather than fetching
     and hiding them.

     ON BY DEFAULT. This used to default to off whenever the browser
     reported prefers-reduced-motion — which headless Edge and any
     Windows box with animation effects switched off both do — so the
     section rendered as captions beside a "Show the demos" button and
     read as broken (2026-08-21, user: "the gifs aren't showing up?").
     The bandwidth argument that justified the default is answered
     properly now: each clip loads only when it is actually scrolled
     into view, so an unseen reel still costs nothing. A metered or
     genuinely slow connection still starts off, and your own choice
     wins and sticks either way. */
  (function(){
    var KEY='junoview:demos';
    var t=$('#wtour'),btn=$('#wtour-toggle');
    if(!t||!btn) return;
    var conn=navigator.connection||{};
    var slow=!!conn.saveData
      ||/2g$/.test(String(conn.effectiveType||''))
      ||String(conn.effectiveType||'')==='3g';
    var saved=null;
    try{saved=localStorage.getItem(KEY);}catch(e){}
    var on=saved===null?!slow:saved==='1';
    var armed=false,io=null;
    /* one clip's worth of fetching, at the moment it is worth fetching */
    function load(im){
      var src=im.getAttribute('data-src'); if(!src) return;
      im.addEventListener('error',function(){
        var fig=im.closest('figure'); if(fig) fig.remove();
        if(!t.querySelector('img')) t.hidden=true;
      });
      im.src=src;
      im.removeAttribute('data-src');
    }
    function paint(){
      t.classList.toggle('lite',!on);
      btn.setAttribute('aria-pressed',on?'true':'false');
      btn.textContent=on?'Hide the demos':'Play the demos';
      if(!on||armed) return;
      armed=true;
      var imgs=$$('img[data-src]',t);
      if(!('IntersectionObserver' in window)){
        imgs.forEach(load);return;}
      io=new IntersectionObserver(function(es){
        es.forEach(function(e){
          if(!e.isIntersecting) return;
          io.unobserve(e.target);load(e.target);
        });
      },{rootMargin:'400px 0px'});
      imgs.forEach(function(im){io.observe(im);});
    }
    /* does the folder exist at all? one HEAD-ish probe decides whether the
       section is offered, so a local render never shows broken frames */
    var probe=new Image();
    probe.addEventListener('load',function(){t.hidden=false;paint();});
    probe.addEventListener('error',function(){t.hidden=true;});
    probe.src='gifs/code_folding.gif';
    btn.addEventListener('click',function(){
      on=!on;
      try{localStorage.setItem(KEY,on?'1':'0');}catch(e){}
      paint();
    });
  })();
  if(APP.mode==='app'||APP.mode==='web'){
    var isWeb=(APP.mode==='web');
    if(openBtn) openBtn.addEventListener('click',showDlg);
    var wOpen=$('#welcome-open');
    if(wOpen) wOpen.addEventListener('click',showDlg);
    /* a presentation with no notebook behind it. Every tool except the
       cell frame works on an empty deck, so this is a real way IN and not
       a shortcut to a dead end — and it is the primary button, because
       the front door offering only ways to open a NOTEBOOK is what made
       the app read as notebook-first (2026-08-22, user). */
    var wNew=$('#welcome-new');
    if(wNew) wNew.addEventListener('click',function(){
      if(!APP.deckNew) return;
      APP.deckNew();
      goHome(false);
    });
    /* same dialog, but landed on the URL path: paste a GitHub link */
    var wUrl=$('#welcome-url');
    if(wUrl) wUrl.addEventListener('click',function(){
      showDlg();
      var inp2=$('#odlg-input');
      if(inp2) setTimeout(function(){inp2.focus();},50);
    });
    var up=$('#odlg-up');
    if(up&&!isWeb) up.addEventListener('click',function(){
      if(up.dataset.parent) listDir(up.dataset.parent);});
    var filesBtn=$('#odlg-files'), fileInput=$('#fileinput');
    if(filesBtn) filesBtn.addEventListener('click',function(){
      if(fileInput) fileInput.click();});
    if(fileInput) fileInput.addEventListener('change',function(){
      webOpenFiles(this.files);this.value='';});
    var cl=$('#odlg-close');
    if(cl) cl.addEventListener('click',hideDlg);
    if(dlg) dlg.addEventListener('click',function(e){
      if(e.target===dlg) hideDlg();});
    var inp=$('#odlg-input');
    function submitOpenInput(){
      if(!inp||inp.disabled) return;
      var v=inp.value.trim(); if(!v) return;
      if(isWeb){
        if(isUrl(v)) webOpenUrl(v,false);
        else alert('Paste an http(s) link to a notebook, .md, .tex '
          +'or .csv file, or use '
          +'Choose files / drag-and-drop.');
        return;
      }
      /* a path that names a source OPENS; anything else is still
         treated as a folder to browse. Before T100 only .ipynb took the
         first branch, so typing `paper.tex` tried to list it as a
         directory and reported that it is not a folder. */
      if(isUrl(v)||SRC_RE.test(v)||isDeckPath(v)) openPath(v);
      else listDir(v);
    }
    if(inp) inp.addEventListener('keydown',function(e){
      if(e.key!=='Enter') return;
      submitOpenInput();
    });
    var goBtn=$('#odlg-go');
    if(goBtn) goBtn.addEventListener('click',submitOpenInput);
    document.addEventListener('keydown',function(e){
      if(e.key==='Escape'&&dlg&&!dlg.hidden) hideDlg();
    });

    /* ---- drag & drop .ipynb anywhere on the window ---- */
    var hint=$('#drophint'), dragDepth=0;
    /* only a FILE drag earns the overlay: it used to appear for every
       drag, so reordering slide thumbnails painted the full-window "Drop
       .ipynb files" sheet (z-index 140) over the editor (100) for the
       whole gesture and drowned the drop markers — "can't re-arrange by
       dragging" (2026-08-20 diagnosis, reproduced) */
    function dragHasFiles(e){
      var t=e.dataTransfer&&e.dataTransfer.types;
      return !!t&&Array.prototype.indexOf.call(t,'Files')>=0;
    }
    window.addEventListener('dragover',function(e){e.preventDefault();});
    window.addEventListener('dragenter',function(e){
      e.preventDefault();
      if(!dragHasFiles(e)) return;
      dragDepth++;
      if(hint) hint.hidden=false;
    });
    window.addEventListener('dragleave',function(){
      dragDepth=Math.max(0,dragDepth-1);
      if(!dragDepth&&hint) hint.hidden=true;
    });
    window.addEventListener('drop',function(e){
      e.preventDefault();dragDepth=0;
      if(hint) hint.hidden=true;
      var files=Array.prototype.slice.call(
        (e.dataTransfer||{}).files||[]);
      /* a dropped saved presentation imports, in either mode */
      files.filter(function(f){return isDeckPath(f.name);})
        .forEach(function(f){
          f.text().then(function(txt){importDeckTextSafe(txt,f.name);});
        });
      /* SRC_RE, not /\.ipynb$/ (T100). This handler filtered to
         notebooks in BOTH modes, so dropping a .tex or a .csv did
         nothing at all -- silently, which is the worse failure the
         comment on SRC_RE warns about -- even in the web build, whose
         Choose-files path has taken them since T91. The server side
         posts `text` rather than `nb` for the same reason: /api/parse
         dispatches on the name through the producer table, and a
         notebook is one entry in it. */
      files.filter(function(f){return SRC_RE.test(f.name);})
        .forEach(function(f){
          if(isWeb){
            f.text().then(function(txt){webParseText(f.name,txt);});
            return;
          }
          f.text().then(function(txt){
            return api('/api/parse',{name:f.name,text:txt});
          }).then(function(j){mountShellHTML(j.shell,j.path||'');})
          .catch(function(err){
            alert('Could not open '+f.name+': '+err.message);});
        });
    });
  }
  if(APP.mode==='web'){
    var demoBtn=$('#welcome-demo');
    if(demoBtn) demoBtn.addEventListener('click',function(){
      webOpenUrl('example_climate_analysis.ipynb',false);
    });
    /* ---- the installable, offline-capable app (PWA) ----
       The install offer (`beforeinstallprompt`) usually fires on the BOOT
       document and is stashed on the window — which document.write keeps —
       by web-loader.html; it can also fire later, on this page. Either
       way the welcome screen grows an "Install as an app" link. */
    var wInst=$('#welcome-install'),wInstSep=$('#welcome-install-sep');
    /* ALWAYS OFFERED, not only when the browser volunteers. The link
       used to be hidden unless `beforeinstallprompt` had fired, which is
       Chrome and Edge only, only when the install criteria are met, and
       never once it is already installed -- so on Firefox, on Safari, on
       a second visit, there was no door at all and no way to find out
       there was one ("where is the download desktop app button",
       2026-08-29). Shown whenever this is the web build; the CLICK is
       what differs, because only the browser can actually install it. */
    function canInstall(){
      try{return matchMedia('(display-mode: standalone)').matches;}
      catch(e){return false;}
    }
    function paintInstall(){
      var on=(APP.mode==='web')&&!canInstall();
      if(wInst){
        wInst.hidden=!on;
        wInst.textContent=window.__jvInstall
          ?'Install as an app':'Install as an app\u2026';
      }
      if(wInstSep) wInstSep.hidden=!on;
    }
    if(wInst) wInst.addEventListener('click',function(e){
      e.preventDefault();
      var ev=window.__jvInstall;
      if(ev){
        window.__jvInstall=null;paintInstall();
        ev.prompt();
        return;
      }
      /* NO PROMPT TO REPLAY. Say what to do instead of doing nothing --
         the browsers that never fire the event still install a PWA, they
         just make you ask for it from their own menu. */
      docToast('Junoview installs from your browser\u2019s own menu: '
        +'look for Install Junoview, Install this site as an app, or '
        +'Add to Home Screen. It then opens in its own window and works '
        +'offline. There is no separate download.');
    });
    window.addEventListener('beforeinstallprompt',function(e){
      e.preventDefault();window.__jvInstall=e;paintInstall();
    });
    paintInstall();
    /* say ONCE when offline is actually ready — `ready` resolves after
       the worker's install precached the app and runtime, so the promise
       is the honest signal, not the registration */
    if('serviceWorker' in navigator){
      navigator.serviceWorker.ready.then(function(){
        var K=WEBKEY+':offline-ready';
        try{if(localStorage.getItem(K)) return;
          localStorage.setItem(K,'1');}catch(e){}
        docToast('Saved for offline — Junoview now opens here even '
          +'without internet');
      }).catch(function(){});
    }
    try{
      APP.project.recent=JSON.parse(
        localStorage.getItem(WEBKEY+':recent')||'[]');
    }catch(e){}
    /* reopen last session's URL notebooks once Python is up.
       WAITING FOR THE EVENT IS NOT ENOUGH. The loader writes this whole
       page with document.write() and fires sem:pyready immediately
       afterwards; whether this script has run by then is a race, and
       document.write() wipes the document (listeners included), so an
       early dispatch is simply lost and the session never comes back.
       The service worker made that race much easier to lose, because a
       cached boot writes the page faster (2026-08-21: reproduced — the
       first visit restored, every later one silently did not).
       window.semPy is set before the dispatch, so it is the reliable
       "already up" flag; the listener only covers the other ordering. */
    function restoreWebSession(){
      var open=[];
      try{open=JSON.parse(
        localStorage.getItem(WEBKEY+':open')||'[]');}catch(e){}
      open.forEach(function(u){webOpenUrl(u,true);});
    }
    if(window.semPy) restoreWebSession();
    else document.addEventListener('sem:pyready',restoreWebSession);
  }

  /* ================= boot: mount shells already on the page ============
     New load-time work belongs HERE, after every declaration. The other
     load-time restores above (theme/scheme, rail collapse state, chrome
     measure, TOC, tooltip host) are order-safe where they are — each
     only touches what is declared above it — but do not add more. */
  initRailAuto();
  $$('.nbshell').forEach(function(sh){initShell(sh);});
  if(APP.order.length) activate(APP.order[0]);
  else renderTabs();
  renderRawBtn();
})();
