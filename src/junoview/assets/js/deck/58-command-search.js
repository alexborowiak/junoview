/* 58-command-search.js — find any command by name and run it (T538).
   ONE FRAGMENT of deck.js's single IIFE, concatenated with its
   siblings in the order assets.DECK_PARTS names. It does not parse
   alone and is not meant to: see 00-page.js. */
  /* ---- SEARCH THE COMMANDS ---------------------------------------------
     PowerPoint's "Tell me" box (Alt+Q): the answer to "I know it can do
     this -- where is it?", which on a ribbon of nine tabs, folded doors
     and shelves is most of the questions anyone asks (2026-09-29 audit).

     1. THE INDEX IS THE RIBBON, READ LIVE. Every worded control in the
        editing tools -- including those inside a folded door or the
        shelf -- plus the File menu, the Present menu and the top bar.
        Nothing is written down twice, so a button added tomorrow is
        findable tomorrow, under its own name and its own tooltip.
     2. ONLY WHAT WOULD WORK NOW. A control the selection has hidden (a
        table's rows with a figure selected) or disabled is left out --
        a search that offers a dead command is worse than none. The tab
        a control is on is NOT a reason to leave it out: finding it is.
     3. RUNNING IT SHOWS WHERE IT LIVES. The tab is switched to, a
        folded door is opened, the real control is pressed and outlined
        for a moment -- so the next time you know where it is.
     4. POWERPOINT'S NAMES FIND OURS: "format painter" finds Copy look,
        "selection pane" Layers, "slide number" Page numbers. */
  var CMD_ALIASES={
    'hm-copylook':'format painter copy formatting',
    'hm-paste-look':'format painter paste formatting',
    'objects-btn':'selection pane layers list objects',
    'hm-layers':'selection pane layers list objects',
    'comments-btn':'comments comment review note feedback new comment',
    /* T594: Focus and Motion are the panel's now, so their words
       find the door onto it */
    'vw-anim':'animation pane animations list focus blur zoom magnify '
      +'motion movement wobble float pulse spin sway shake',
    /* T579: the words people look for it by */
    'anim-out':'disappear exit animation hide leave go away fade out '
      +'remove from slide vanish',
    'fmt-txcol-btn':'font colour font color text color',
    'tx-link':'hyperlink insert link url web address jump to slide',
    'tx-autocorrect':'autocorrect auto correct smart quotes curly quotes '
      +'dashes autoformat as you type',
    'fmt-clear':'clear formatting clear all formatting remove formatting '
      +'plain text reset',
    'fmt-case-btn':'change case uppercase lowercase sentence case '
      +'capitalise capitalize title case toggle case capitals',
    'fmt-fillcol-btn':'shape fill background colour highlight box',
    /* T572: what the Paragraph window holds, by PowerPoint's names */
    'fmt-para':'autofit auto fit shrink text on overflow do not autofit '
      +'resize shape to fit text columns indent curve vertical alignment',
    'dc-nums':'slide number slide numbers numbering',
    'dc-head':'header footer date',
    'dc-foot':'header footer date',
    'vw-grid':'gridlines grid lines',
    'vw-rulers':'ruler',
    'dsg-masters':'slide master master slide',
    'pr-newversion':'custom slide show custom show shorter talk',
    'fmt-shd':'shadow drop shadow shape effects picture effects outer '
      +'shadow',
    'fmt-rot':'rotate flip horizontal flip vertical mirror rotate right '
      +'90 rotate left 90 quarter turn straighten',
    'vw-check':'check accessibility accessibility checker alt text '
      +'contrast reading order review inspect',
    'pr-hide':'hide slide hidden slide skip slide unhide show slide',
    'pr-timing':'rehearse timings rehearsal timer',
    'hm-notes':'speaker notes notes pane',
    'hm-lay-ideas':'designer design ideas layout suggestions',
    'dsg-sets':'themes theme variants design',
    'dsg-tokens':'theme colours palette colors',
    'dc-play':'slide show start presenting from beginning',
    'qat-find':'find replace search',
    'hm-newslide':'insert new slide add slide',
    'hm-dupslide':'duplicate slide copy slide',
    'hm-delslide':'delete slide remove slide',
    'et-image':'insert picture image photo',
    'et-media':'insert video audio sound movie',
    'et-table':'insert table',
    'dc-maths':'insert equation formula latex maths math',
    'vw-full':'full screen',
    'fmt-group':'group objects',
    'fmt-ungroup':'ungroup',
    'fmt-front':'bring to front',
    'fmt-back':'send to back',
    'fmt-crop':'crop picture trim',
    'fmt-sizepos':'size position format shape width height',
    'mi-pdf':'export pdf print save as pdf',
    'mi-pptx':'export powerpoint pptx save as',
    'mi-import-pptx':'open powerpoint import pptx',
    /* T601: what Overleaf and LaTeX call it, and what Word calls it */
    'mi-parts':'parts include input subfile master document linked '
      +'presentations chapters combine talks join decks'
  };
  function cmdLabel(b){
    var c=b.cloneNode(true);
    $$('kbd,.rbn-foldval,.fx-val',c).forEach(function(n){n.remove();});
    var t=c.textContent.replace(/[▾▴]/g,' ').replace(/\s+/g,' ').trim();
    if(!t) t=b.getAttribute('aria-label')||'';
    if(!t&&b.title) t=b.title.split(/ — |\. /)[0];
    return t.replace(/…$/,'').trim();
  }
  /* a control the SELECTION has put away is not a command right now; a
     group hidden because its tab is not showing, or a door that is
     simply closed, is */
  function cmdLive(b){
    if(b.hidden||b.disabled) return false;
    for(var a=b.parentNode;a&&a!==document.body;a=a.parentNode){
      if(a.id==='edit-tools'||a.id==='deck-qat'||a.id==='rbn-shelf') break;
      if(a.hidden&&!(a.classList&&(a.classList.contains('rbn-grp')
         ||a.classList.contains('rbn-foldmenu')
         ||a.classList.contains('dc-menu')))) return false;
    }
    return true;
  }
  function cmdGroupOf(b){
    var g=b.closest('.rbn-grp');
    if(!g&&typeof rbnShelfFor!=='undefined'&&rbnShelfFor){
      var sh=$('#rbn-shelf'); if(sh&&sh.contains(b)) g=rbnShelfFor;}
    return g;
  }
  function cmdIndex(){
    var out=[],seen=[];
    function add(b,where,tab,g){
      if(!b||seen.indexOf(b)>=0||!cmdLive(b)) return;
      var lab=cmdLabel(b); if(!lab||lab.length<2) return;
      seen.push(b);
      /* a gallery tile's data-find is the words people use for it
         (T573 shapes, T560 icons): "lightbulb" finds the Idea icon */
      var hay=(lab+' '+(b.title||'')+' '+where+' '
        +(CMD_ALIASES[b.id]||'')+' '+((b.dataset&&b.dataset.find)||''))
        .toLowerCase();
      out.push({el:b,label:lab,where:where,tab:tab,g:g,hay:hay,
        lab:lab.toLowerCase()});
    }
    var bar=$('#edit-tools');
    if(bar) $$('button',bar).concat($$('#rbn-shelf button')).forEach(function(b){
      var c=b.classList;
      if(c.contains('strip-prev')||c.contains('strip-next')
         ||c.contains('strip-more')||c.contains('tx-caret')
         ||c.contains('qk-sw')||c.contains('sw')||c.contains('rbn-foldbtn')
         ||c.contains('cellpartbtn')) return;
      if(!(b.id||c.contains('fx-tile')||c.contains('dc-mi'))) return;
      var g=cmdGroupOf(b);
      var tab=g&&g.getAttribute('data-tab');
      var tb=tab&&$('#rbn-tab-'+tab);
      var where=(tb?tb.textContent.replace(/\s+/g,' ').trim():'Ribbon')
        +(g?' › '+rbnGroupName(g):'');
      add(b,where,tab,g);
    });
    $$('#dc-menu .dc-mi').forEach(function(b){add(b,'File',null,null);});
    $$('#play-menu .dc-mi').forEach(function(b){
      add(b,'Present ▾',null,null);});
    ['#dc-save','#qat-find','#dc-play','#vw-full','#dc-undo','#dc-redo']
      .forEach(function(id){add($(id),'Top bar',null,null);});
    return out;
  }
  function cmdMatch(q,idx){
    var words=q.toLowerCase().split(/\s+/).filter(Boolean);
    if(!words.length) return [];
    var hits=idx.filter(function(c){
      return words.every(function(w){return c.hay.indexOf(w)>=0;});});
    function score(c){
      var s=0,q0=q.toLowerCase().trim();
      if(c.lab===q0) s+=100;
      if(c.lab.indexOf(q0)===0) s+=60;
      else if(c.lab.indexOf(q0)>=0) s+=40;
      words.forEach(function(w){
        if(c.lab.indexOf(w)>=0) s+=10;
        if(c.where.toLowerCase().indexOf(w)>=0) s+=2;});
      return s;
    }
    hits.sort(function(a,b){return score(b)-score(a);});
    return hits.slice(0,12);
  }
  /* the tab it is on, a folded door opened, the control pressed and
     outlined for a moment */
  function cmdRun(c){
    var b=c.el;
    if(c.tab&&typeof setTab==='function') setTab(c.tab);
    var g=c.g;
    if(g&&g.classList.contains('rbn-folded')&&!(b.getClientRects().length)){
      var door=g.querySelector('.rbn-foldbtn');
      if(door) door.click();
    }
    setTimeout(function(){
      b.click();
      if(b.getClientRects().length){
        b.classList.add('cmd-found');
        setTimeout(function(){b.classList.remove('cmd-found');},1400);
      }
    },40);
  }
  var cmdHits=[],cmdAt=0;
  function cmdPaint(){
    var list=$('#rbn-search-list'),inp=$('#rbn-search-in');
    if(!list||!inp) return;
    list.innerHTML='';
    if(!cmdHits.length){
      if(inp.value.trim()){
        var none=document.createElement('div');
        none.className='rbn-search-none';
        none.textContent='No command called that — try another word';
        list.appendChild(none);
        list.hidden=false;
      } else list.hidden=true;
      inp.setAttribute('aria-expanded',(!list.hidden).toString());
      return;
    }
    cmdHits.forEach(function(c,i){
      var r=document.createElement('button');
      r.type='button';r.className='rbn-search-row'+(i===cmdAt?' on':'');
      r.setAttribute('role','option');
      r.setAttribute('aria-selected',(i===cmdAt).toString());
      var ic=c.el.querySelector('svg');
      if(ic) r.appendChild(ic.cloneNode(true));
      else {var sp=document.createElement('span');sp.className='rbn-search-noic';
        r.appendChild(sp);}
      var t=document.createElement('span');t.className='rbn-search-t';
      t.textContent=c.label;r.appendChild(t);
      var w=document.createElement('span');w.className='rbn-search-w';
      w.textContent=c.where;r.appendChild(w);
      if(c.el.title) r.title=c.el.title;
      r.addEventListener('mousedown',function(e){e.preventDefault();});
      r.addEventListener('click',function(e){
        e.stopPropagation();cmdClose();cmdRun(c);});
      list.appendChild(r);
    });
    var rr=inp.getBoundingClientRect();
    list.style.top=Math.round(rr.bottom+4)+'px';
    list.style.left=Math.round(Math.max(8,
      Math.min(rr.left,window.innerWidth-list.offsetWidth-8)))+'px';
    list.hidden=false;
    inp.setAttribute('aria-expanded','true');
    rr=inp.getBoundingClientRect();
    list.style.left=Math.round(Math.max(8,
      Math.min(rr.left,window.innerWidth-list.offsetWidth-8)))+'px';
  }
  function cmdClose(){
    var list=$('#rbn-search-list'),inp=$('#rbn-search-in');
    if(list) list.hidden=true;
    if(inp){inp.value='';inp.setAttribute('aria-expanded','false');inp.blur();}
    cmdHits=[];cmdAt=0;
  }
  function cmdSearchBoot(){
    var inp=$('#rbn-search-in'),list=$('#rbn-search-list');
    if(!inp||!list) return;
    /* the list lives with the editor's other floating surfaces, so the
       tab strip's clip never cuts it */
    deckEl.appendChild(list);
    inp.addEventListener('input',function(){
      cmdHits=cmdMatch(inp.value,cmdIndex());cmdAt=0;cmdPaint();});
    inp.addEventListener('keydown',function(e){
      e.stopPropagation();
      if(e.key==='ArrowDown'||e.key==='ArrowUp'){
        e.preventDefault();
        if(!cmdHits.length) return;
        cmdAt=(cmdAt+(e.key==='ArrowDown'?1:-1)+cmdHits.length)%cmdHits.length;
        cmdPaint();
      } else if(e.key==='Enter'){
        e.preventDefault();
        var c=cmdHits[cmdAt]; cmdClose(); if(c) cmdRun(c);
      } else if(e.key==='Escape'){
        e.preventDefault();cmdClose();
      }
    });
    inp.addEventListener('blur',function(){
      setTimeout(function(){
        if(document.activeElement!==inp) list.hidden=true;},150);
    });
    /* Alt+Q, PowerPoint's own chord for this box, from anywhere in the
       editor -- even with a caret in a text box */
    document.addEventListener('keydown',function(e){
      if(deckEl.hidden||mode!=='edit') return;
      if(e.altKey&&!e.ctrlKey&&!e.metaKey&&(e.key==='q'||e.key==='Q'
         ||e.code==='KeyQ')){
        e.preventDefault();e.stopPropagation();
        inp.focus();inp.select();
      }
    },true);
  }
