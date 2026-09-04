/* 46-history.js — the version graph: what changed, when, on which branch, and how to get back to it.
   ONE FRAGMENT of deck.js's single IIFE, concatenated with its
   siblings in filename order by assets.deck_js(). It does not
   parse alone and is not meant to: see 00-page.js.

   The STORE is 45-images.js's — snapTake, snapWrite, snapRead, the
   index and the head pointer. This file is the surface over it, and
   T237 rebuilt that surface whole:

     "The history is a bit much as well. Like how you can see the git
      history thing where you can just see the little lines with the
      dots for versions and then can see branches as different colours
      from that. I really like that design. Also then there can be named
      versions, and the default name should just be the time... Then
      there should be like summary of changes from last version or
      something, and it should have quick overview that can be either
      type of by slide (e.g. slide 14: heading: (color: red -> yellow,
      image added))... and then also by type (e.g. heading changed red
      -> yellow (slide 13, 14, 15)), then ways to compare different
      changes and yeah also have the more visual one like you had, but
      only showing slides that changed and differences maybe but also
      an ability to view the whole thing. Then the ability to go back to
      old version and branch from there."  (2026-09-04)

   What it holds, in order: when a version is taken, what a version is
   called, the graph, the change model, the three views over it, and
   the two ways back (restore, branch). */

  /* ---- WHEN A DOT APPEARS ---------------------------------------------
     Not every change — that was never the question. A version is taken
     when you SAVE, when you OPEN the deck, when you take a CHECKPOINT,
     before anything that replaces the deck, and — new in T237 — once you
     have been editing for a while and then stop. That last one is the
     rule Overleaf's history follows and the reason its timeline is
     readable: a session of work is one entry, not four hundred.
     DH_IDLE_MS is how long a pause counts as a stop; DH_GAP_MS is how
     much work has to have happened since the last version for the pause
     to be worth recording. */
  var DH_IDLE_MS=30000, DH_GAP_MS=300000;
  var histIdleT=null, histLastAt=0;
  function histIdleTick(){
    if(histIdleT) clearTimeout(histIdleT);
    histIdleT=setTimeout(function(){
      histIdleT=null;
      if(!pres||!pres.slides) return;
      if(Date.now()-histLastAt<DH_GAP_MS) return;
      histLastAt=Date.now();
      snapTake('while you worked');
    },DH_IDLE_MS);
  }
  /* every write through snapWrite resets the clock, so a save inside the
     five minutes means the pause after it is not a second entry */
  function histNoteWrite(){histLastAt=Date.now();}

  /* ---- WHAT A VERSION IS CALLED ---------------------------------------
     The time, unless you named it. "14:32" is what you look for on a
     timeline; "saved" is not a name, it is a reason, and it belongs in
     the second line with the slide count. */
  function histClock(ms){
    try{
      return new Date(ms).toLocaleTimeString([],
        {hour:'2-digit',minute:'2-digit'});
    }catch(e){return '';}
  }
  function histLabel(e){
    return (e&&e.nm)||histClock(e&&e.at)||'version';
  }
  function histWhen(ms){
    var d=Math.round((Date.now()-ms)/1000);
    if(d<90) return 'just now';
    if(d<5400) return Math.round(d/60)+' min ago';
    if(d<86400*2) return Math.round(d/3600)+' h ago';
    return new Date(ms).toLocaleDateString();
  }
  /* naming one is an index edit: the snapshot itself never changes */
  function histSetName(id,nm){
    var name=pres.name;
    return histRun(function(){
      return histIndexAt(name).then(function(ix){
        var hit=null;
        ix.forEach(function(e){if(e.id===id) hit=e;});
        if(!hit) return false;
        if(nm) hit.nm=nm; else delete hit.nm;
        return idbPut(histKeyFor(name),ix).then(function(){return true;});
      });
    });
  }

  /* ---- THE GRAPH ------------------------------------------------------
     One lane per branch, a dot per version, an elbow where a branch
     leaves its parent — the shape every version-control client draws,
     because it is the only drawing that answers "what came from what"
     at a glance. The lane order is the order the branches first appear
     going forwards in time, so the trunk is lane 0 and always leftmost. */
  var DH_LANE_COL=['#39a9c0','#f0a848','#a586e8','#46a892','#ff6b57',
    '#6b9bff','#e5484d','#8aa0b0'];
  var DH_LANE_W=18, DH_ROW_H=46;
  function histLanes(ix){
    var lane={},n=0;
    ix.forEach(function(e){
      var br=e.br||'';
      if(lane[br]==null) lane[br]=n++;
    });
    return lane;
  }
  function laneColor(i){return DH_LANE_COL[i%DH_LANE_COL.length];}
  function histGraphSvg(i,rows,lane,span,pos){
    var e=rows[i],own=lane[e.br||'']||0;
    var lanes=Object.keys(lane).length;
    var w=Math.max(1,lanes)*DH_LANE_W,h=DH_ROW_H,mid=h/2;
    var s='<svg class="dh-gsvg" width="'+w+'" height="'+h+'" '
      +'viewBox="0 0 '+w+' '+h+'" aria-hidden="true">';
    /* every lane alive across this row keeps its thread visible */
    Object.keys(span).forEach(function(L){
      var sp=span[L],x=(+L)*DH_LANE_W+DH_LANE_W/2;
      if(i<sp.a||i>sp.b) return;
      var y1=(i===sp.a)?mid:0, y2=(i===sp.b)?mid:h;
      if(y1===y2) return;
      s+='<line x1="'+x+'" y1="'+y1+'" x2="'+x+'" y2="'+y2+'" '
        +'stroke="'+laneColor(+L)+'" stroke-width="2" opacity=".55"/>';
    });
    /* ...and a branch shows where it left the line it came from */
    var pi=e.p!=null?pos[e.p]:null;
    if(pi!=null&&pi>i){
      var pl=lane[rows[pi].br||'']||0;
      if(pl!==own){
        var x1=own*DH_LANE_W+DH_LANE_W/2, x2=pl*DH_LANE_W+DH_LANE_W/2;
        s+='<path d="M'+x1+' '+mid+' C'+x1+' '+(mid+12)+' '
          +x2+' '+(mid+10)+' '+x2+' '+h+'" fill="none" stroke="'
          +laneColor(own)+'" stroke-width="2" opacity=".55"/>';
      }
    }
    var cx=own*DH_LANE_W+DH_LANE_W/2;
    s+='<circle class="dh-dot" cx="'+cx+'" cy="'+mid+'" r="'
      +(e.mk?5.5:4.5)+'" fill="'+(e.mk?laneColor(own):'#0e1b28')
      +'" stroke="'+laneColor(own)+'" stroke-width="2.5"/>';
    return s+'</svg>';
  }

  /* ---- WHAT CHANGED ---------------------------------------------------
     deckDiff answers "which slides"; this answers "and what about
     them". The field vocabulary is OH_WORDS's — the same words the
     object's own history uses, so one change is described one way
     wherever you read about it. */
  var DH_ROLE={text:'text box',cell:'figure',image:'picture',
    table:'table',rect:'shape',arrow:'arrow',draw:'drawing',
    flip:'flip book',chart:'chart'};
  function chRole(a){
    if(!a) return 'item';
    if(a.k==='text'&&a.style){
      var d=styleDef(a.style);
      if(d&&d.label) return d.label.toLowerCase();
    }
    return DH_ROLE[a.k]||a.k||'item';
  }
  var CH_FIELDS=[['color','colour'],['txcol','colour'],
    ['bgc','background'],['bgcol','background'],['fillc','fill'],
    ['size','text size'],['font','typeface'],['style','named style'],
    ['align','alignment'],['op','see-through'],['rot','rotation'],
    ['ref','the card it shows'],['b','bold'],['i','italic']];
  var CH_NAMED={'#e5484d':'red','#ff6b57':'coral','#f0a848':'amber',
    '#39a9c0':'cyan','#46a892':'green','#6b9bff':'blue',
    '#a586e8':'violet','#ffffff':'white','#16202b':'ink',
    '#0e1926':'dark'};
  function chVal(k,v){
    if(v==null||v==='') return 'none';
    if(v===0) return 'off';
    if(v===1&&(k==='b'||k==='i')) return 'on';
    if(typeof v==='string'&&v.charAt(0)==='@')
      return (TOKEN_LABELS[v.slice(1)]||v.slice(1)).toLowerCase();
    if(typeof v==='string'&&CH_NAMED[v.toLowerCase()])
      return CH_NAMED[v.toLowerCase()];
    /* "rgba(57, 169, 192, 0.25)" is a dump, not a sentence. Parse it
       and say the nearest named hue with how see-through it is, which
       is what you would say out loud. */
    if(typeof v==='string'&&/^(#|rgb)/i.test(v)){
      var c=parseColor(v);
      if(c){
        var hex='#'+[c.r,c.g,c.b].map(function(n){
          return ('0'+n.toString(16)).slice(-2);}).join('');
        var near='',best=1e9;
        Object.keys(CH_NAMED).forEach(function(k){
          var p=parseColor(k); if(!p) return;
          var d=Math.abs(p.r-c.r)+Math.abs(p.g-c.g)+Math.abs(p.b-c.b);
          if(d<best){best=d;near=CH_NAMED[k];}
        });
        var nm2=(best<=60?near:hex);
        return c.a<1?(nm2+' at '+Math.round(c.a*100)+'%'):nm2;
      }
    }
    if(k==='style'){
      var d=styleDef(v);
      return d&&d.label?d.label.toLowerCase():String(v);
    }
    if(typeof v==='number') return (Math.round(v*10)/10)+'';
    return String(v).slice(0,24);
  }
  function chText(a){
    if(!a) return '';
    return String(a.text||a.html||'').replace(/<[^>]*>/g,' ')
      .replace(/\s+/g,' ').trim();
  }
  function annotChanges(a,b){
    var out=[];
    CH_FIELDS.forEach(function(p){
      var k=p[0];
      if(JSON.stringify(a[k])===JSON.stringify(b[k])) return;
      out.push({field:p[1],from:chVal(k,a[k]),to:chVal(k,b[k])});
    });
    if(Math.abs((a.x||0)-(b.x||0))>0.4||Math.abs((a.y||0)-(b.y||0))>0.4)
      out.push({field:'moved'});
    if(Math.abs((a.w||0)-(b.w||0))>0.4||Math.abs((a.h||0)-(b.h||0))>0.4)
      out.push({field:'resized'});
    if(chText(a)!==chText(b)) out.push({field:'words'});
    return out;
  }
  /* PAIR THE BOXES of two versions of one slide. Object ids first,
     because they are exact; then position-and-kind for whatever is
     left, because a snapshot older than oids has nothing else to
     offer -- and neither does one side of the comparison having them
     while the other does not, which is the case every time you look
     back past the day they were added. Requiring BOTH sides to be
     oid-less made that case report every box as removed AND added
     (2026-09-04, caught by driving it). */
  function chPair(A,B){
    var pairs=[],usedA={},takenB={},byA={};
    A.forEach(function(a,i){if(a&&a.oid) byA[a.oid]=i;});
    /* 1. exact, by id */
    B.forEach(function(b,j){
      if(!b||!b.oid||byA[b.oid]==null) return;
      var i=byA[b.oid];
      if(usedA[i]) return;
      usedA[i]=1;takenB[j]=1;pairs.push({a:A[i],b:b});
    });
    /* 2. same slot, same kind */
    B.forEach(function(b,j){
      if(!b||takenB[j]) return;
      if(!A[j]||usedA[j]||A[j].k!==b.k) return;
      usedA[j]=1;takenB[j]=1;pairs.push({a:A[j],b:b});
    });
    /* 3. anywhere, same kind -- one box of a kind that moved down the
       list is still that box */
    B.forEach(function(b,j){
      if(!b||takenB[j]) return;
      for(var i=0;i<A.length;i++){
        if(!A[i]||usedA[i]||A[i].k!==b.k) continue;
        usedA[i]=1;takenB[j]=1;pairs.push({a:A[i],b:b});
        return;
      }
    });
    /* 4. what is left really is new, or really is gone */
    B.forEach(function(b,j){
      if(b&&!takenB[j]) pairs.push({a:null,b:b});});
    A.forEach(function(a,i){
      if(a&&!usedA[i]) pairs.push({a:a,b:null});});
    return pairs;
  }
  function deckChanges(then,now){
    var d=deckDiff(then,now),out=[];
    d.rows.forEach(function(r){
      var no=(r.bi>=0?r.bi:r.ai)+1;
      var nm=r.b?slideTitle(r.b):(r.a?slideTitle(r.a):'');
      if(r.st==='added'){
        out.push({no:no,name:nm,role:'slide',verb:'added'});return;}
      if(r.st==='removed'){
        out.push({no:no,name:nm,role:'slide',verb:'removed'});return;}
      if(r.st==='moved')
        out.push({no:no,name:nm,role:'slide',verb:'moved'});
      if(r.st!=='changed'&&r.st!=='moved') return;
      chPair((r.a&&r.a.annots)||[],(r.b&&r.b.annots)||[])
        .forEach(function(p){
          if(p.a&&p.b){
            annotChanges(p.a,p.b).forEach(function(c){
              out.push({no:no,name:nm,role:chRole(p.b),verb:'changed',
                field:c.field,from:c.from,to:c.to});
            });
          } else if(p.b){
            out.push({no:no,name:nm,role:chRole(p.b),verb:'added'});
          } else {
            out.push({no:no,name:nm,role:chRole(p.a),verb:'removed'});
          }
        });
    });
    return out;
  }
  /* one change, as a sentence. The slide it happened on is the caller's
     to add, because that is the half the two views disagree about. */
  function chSentence(c){
    if(c.verb==='added') return c.role+' added';
    if(c.verb==='removed') return c.role+' removed';
    if(c.verb==='moved') return c.role+' moved';
    if(c.field==='moved'||c.field==='resized')
      return c.role+' '+c.field;
    if(c.field==='words') return c.role+' reworded';
    return c.role+' '+c.field+' '+c.from+' \u2192 '+c.to;
  }
  function chSummary(list){
    if(!list.length) return 'no difference';
    var kinds={};
    list.forEach(function(c){
      var k=c.verb==='changed'?(c.field||'changed'):c.verb;
      kinds[k]=(kinds[k]||0)+1;
    });
    return Object.keys(kinds).slice(0,4).map(function(k){
      return kinds[k]+' '+k;}).join(', ')
      +(Object.keys(kinds).length>4?', and more':'');
  }

  /* ---- THE PANEL ------------------------------------------------------
     An overlay, like the overview map and the notes editor: it wants the
     screen while you are comparing and none of it after. */
  var histSel='', histAgainst='', histView='slide', histAllSlides=false;
  function histPanelClose(){
    var ov=$('#deck-history');
    if(ov) ov.remove();
    document.removeEventListener('keydown',histPanelKey,true);
  }
  function histPanelKey(e){
    if(!$('#deck-history')) return;
    if(e.key==='Escape'){
      e.preventDefault();e.stopPropagation();histPanelClose();}
  }
  function histRows(ov,ix){
    var rail=ov.querySelector('#dh-list');
    rail.innerHTML='';
    if(!ix.length){
      rail.innerHTML='<div class="selpane-empty">Nothing yet \u2014 the '
        +'history starts filling from now.</div>';
      return;
    }
    var rows=ix.slice().reverse();
    var lane=histLanes(ix),lanes=Object.keys(lane).length;
    var pos={},span={},kids={};
    ix.forEach(function(e){if(e.p) kids[e.p]=(kids[e.p]||0)+1;});
    rows.forEach(function(e,i){pos[e.id]=i;});
    rows.forEach(function(e,i){
      var L=lane[e.br||'']||0;
      if(!span[L]) span[L]={a:i,b:i};
      else {span[L].a=Math.min(span[L].a,i);span[L].b=Math.max(span[L].b,i);}
    });
    rail.style.setProperty('--dh-gutter',
      (Math.max(1,lanes)*DH_LANE_W)+'px');
    rows.forEach(function(e,i){
      var L=lane[e.br||'']||0;
      var row=document.createElement('div');
      row.className='dh-r';
      var g=document.createElement('span');
      g.className='dh-gutter';
      g.innerHTML=histGraphSvg(i,rows,lane,span,pos);
      row.appendChild(g);
      var b=document.createElement('button');
      b.className='dh-snap'+(e.id===histSel?' on':'')
        +(e.id===histHead?' head':'')
        +(e.mk?' checkpoint':'');
      b.style.setProperty('--dh-lane',laneColor(L));
      var l1=document.createElement('span');
      l1.className='dh-when';
      l1.textContent=histLabel(e)
        +(e.id===histHead?' \u00b7 you are here':'');
      var l2=document.createElement('span');
      l2.className='dh-why';
      l2.textContent=(e.br||'main')+' \u00b7 '+e.why+' \u00b7 '
        +histWhen(e.at)
        +((kids[e.id]||0)>1?(' \u00b7 '+kids[e.id]+' branches'):'');
      b.appendChild(l1);b.appendChild(l2);
      b.title=new Date(e.at).toLocaleString()
        +'\nBranch: '+(e.br||'main')
        +(e.mk?'\nA checkpoint: kept even when older versions are '
          +'dropped':'')
        +(e.id===histHead
          ?'\nThis is where the deck you are editing came from':'');
      b.addEventListener('click',function(){
        histSel=e.id;histRows(ov,ix);
        histAgainst=histAutoAgainst(ix,e);
        histCompare(ov,e);});
      row.appendChild(b);
      var ren=document.createElement('button');
      ren.className='dbtn dh-ren';
      ren.innerHTML=bic('pen');
      ren.title='Give this version a name. Without one it goes by the '
        +'time it was taken.';
      ren.setAttribute('aria-label','Name this version');
      ren.addEventListener('click',function(ev){
        ev.stopPropagation();
        var v=prompt('Call this version:',e.nm||histClock(e.at));
        if(v===null) return;
        v=v.trim();
        histSetName(e.id,v).then(function(){
          if(v) e.nm=v; else delete e.nm;
          histRows(ov,ix);
        });
      });
      row.appendChild(ren);
      rail.appendChild(row);
    });
  }
  /* The diagrams make a forty-slide comparison cheap. A real render is
     opt-in per row, built by the same 960x540 renderer used by presenter
     and notes previews, then scaled into the two comparison columns. */
  function histFullSlides(row,r,then,now,btn){
    var old=row.querySelector('.dh-full');
    if(old){
      old.remove();row.classList.remove('dh-open');
      btn.setAttribute('aria-expanded','false');
      btn.innerHTML=bic('expand')+' Show full slides';
      return;
    }
    var full=document.createElement('div');full.className='dh-full';
    var made=[];
    [['then',r.a,then,r.ai],['now',r.b,now,r.bi]]
      .forEach(function(side){
        var cell=document.createElement('div');
        cell.className='dh-fullcell';
        var cap=document.createElement('span');cap.className='dh-cap';
        cap.textContent=side[0]+(side[1]?' \u00b7 full slide':' \u2014 not there');
        cell.appendChild(cap);
        if(side[1]&&side[3]>=0){
          var frame=document.createElement('div');
          frame.className='dh-fullframe';
          var node=withDeck(side[2],function(){
            return buildSlideNode(side[3],true);
          });
          if(node){
            /* History is a comparison, never a second live editor. */
            node.setAttribute('inert','');
            node.setAttribute('aria-hidden','true');
            frame.appendChild(node);made.push({frame:frame,node:node});
          }
          cell.appendChild(frame);
        } else {
          var miss=document.createElement('div');
          miss.className='dh-fullmissing';miss.textContent='No slide here';
          cell.appendChild(miss);
        }
        full.appendChild(cell);
      });
    row.appendChild(full);
    made.forEach(function(p){
      var k=Math.min((p.frame.clientWidth||480)/960,
        (p.frame.clientHeight||270)/540);
      p.node.style.transform='scale('+(k||0.5).toFixed(4)+')';
      p.node.style.transformOrigin='top left';
    });
    row.classList.add('dh-open');
    btn.setAttribute('aria-expanded','true');
    btn.innerHTML=bic('minus')+' Hide full slides';
  }
  /* ---- THE THREE VIEWS -------------------------------------------------
     By slide, by type, and the pictures. They are three readings of one
     list, which is why they share deckChanges rather than each walking
     the decks again. */
  function chBySlide(body,list){
    var by={},order=[];
    list.forEach(function(c){
      var k=c.no+'|'+c.name;
      if(!by[k]){by[k]=[];order.push(k);}
      by[k].push(c);
    });
    order.forEach(function(k){
      var no=k.split('|')[0],nm=k.slice(no.length+1);
      var row=document.createElement('div');
      row.className='dh-ch';
      var h=document.createElement('span');
      h.className='dh-chslide';
      h.textContent='Slide '+no+(nm?(' \u00b7 '+nm):'');
      row.appendChild(h);
      var w=document.createElement('span');
      w.className='dh-chwhat';
      w.textContent=by[k].map(chSentence).join(', ');
      row.appendChild(w);
      body.appendChild(row);
    });
  }
  function chByType(body,list){
    var by={},order=[];
    list.forEach(function(c){
      var k=chSentence(c);
      if(!by[k]){by[k]=[];order.push(k);}
      if(by[k].indexOf(c.no)<0) by[k].push(c.no);
    });
    order.sort(function(x,y){return by[y].length-by[x].length;});
    order.forEach(function(k){
      var row=document.createElement('div');
      row.className='dh-ch';
      var h=document.createElement('span');
      h.className='dh-chwhat dh-chlead';
      h.textContent=k;
      row.appendChild(h);
      var w=document.createElement('span');
      w.className='dh-chslide';
      var ns=by[k].slice().sort(function(x,y){return x-y;});
      w.textContent='slide'+(ns.length===1?' ':'s ')+ns.join(', ');
      row.appendChild(w);
      body.appendChild(row);
    });
  }
  function chSlideRows(body,d,then,now){
    var any=false;
    d.rows.forEach(function(r){
      if(!histAllSlides&&r.st==='same') return;
      any=true;
      var row=document.createElement('div');
      row.className='dh-row st-'+r.st;
      var lab=document.createElement('span');
      lab.className='dh-st';
      lab.textContent=r.st==='same'?'unchanged':r.st;
      row.appendChild(lab);
      [['then',r.a,then],['now',r.b,now]].forEach(function(side){
        var cell=document.createElement('div');
        cell.className='dh-cell';
        var cap=document.createElement('span');
        cap.className='dh-cap';
        cap.textContent=side[1]
          ?(side[0]+' \u00b7 '+((side[0]==='then'?r.ai:r.bi)+1))
          :(side[0]+' \u2014 not there');
        cell.appendChild(cap);
        if(side[1])
          cell.appendChild(withDeck(side[2],function(){
            return miniDiagram(side[1]);}));
        row.appendChild(cell);
      });
      var acts=document.createElement('div');
      acts.className='dh-acts';
      var look=document.createElement('button');
      look.className='dbtn dh-look';
      look.innerHTML=bic('expand')+' Show full slides';
      look.setAttribute('aria-expanded','false');
      look.addEventListener('click',function(){
        histFullSlides(row,r,then,now,look);
      });
      acts.appendChild(look);
      /* putting one slide back only means anything against the LIVE
         deck: against another version there is nothing to put it into */
      if(r.a&&!histAgainst&&(r.st==='removed'||r.st==='changed')){
        var rb=document.createElement('button');
        rb.className='dbtn dh-one';
        rb.innerHTML=bic('reload')
          +(r.st==='removed'?' Put it back':' Use the old one');
        rb.addEventListener('click',function(){
          snapTake('before putting a slide back').then(function(){
            histRestoreSlide(r,then);
            histPanelClose();
          });
        });
        acts.appendChild(rb);
      }
      row.appendChild(acts);
      body.appendChild(row);
    });
    if(!any){
      var e2=document.createElement('div');
      e2.className='selpane-empty';
      e2.textContent='No slide is different. Tick "every slide" to see '
        +'them all anyway.';
      body.appendChild(e2);
    }
  }
  function histCompare(ov,ent){
    var body=ov.querySelector('#dh-body');
    body.innerHTML='<div class="selpane-empty">Reading\u2026</div>';
    var wantB=histAgainst?snapRead(histAgainst):Promise.resolve(null);
    Promise.all([snapRead(ent.id),wantB]).then(function(got){
      var then=got[0],now=histAgainst?got[1]:pres;
      body.innerHTML='';
      if(!then||(histAgainst&&!now)){
        body.innerHTML='<div class="selpane-empty">That version '
          +'could not be read.</div>';
        return;
      }
      var d=deckDiff(then,now),list=deckChanges(then,now);
      /* ---- what this version is, and what it is being read against */
      var head=document.createElement('div');
      head.className='dh-head2';
      var ttl=document.createElement('span');
      ttl.className='dh-h2t';
      ttl.textContent=histLabel(ent)+' \u2192 '
        +(histAgainst?histLabel(histAgainstEnt(ov)):'now')
        +': '+chSummary(list);
      head.appendChild(ttl);
      if(!d.byName){
        var warn=document.createElement('span');
        warn.className='dh-h2note';
        warn.textContent='Compared by position: this version is older '
          +'than slide names, so an inserted slide shifts everything '
          +'below it.';
        head.appendChild(warn);
      }
      body.appendChild(head);
      /* ---- the two ways back, and the compare-with picker */
      var acts=document.createElement('div');
      acts.className='dh-tools';
      var restoreAll=document.createElement('button');
      restoreAll.className='dbtn dh-all';
      restoreAll.innerHTML=bic('reload')+' Go back to this version';
      restoreAll.addEventListener('click',function(){
        if(!confirm('Replace all '+(pres.slides||[]).length
          +' slides with the '+((then.slides||[]).length)+' from '
          +histLabel(ent)+'?')) return;
        snapTake('before going back').then(function(){
          histRestoreDeck(then,ent.id,ent.br||'');histPanelClose();});
      });
      acts.appendChild(restoreAll);
      /* Same restore, plus a name -- so the work you do next is recorded
         as descending from THIS version instead of from whatever
         happened to be latest (T90). */
      var branch=document.createElement('button');
      branch.className='dbtn dh-all dh-branch';
      branch.innerHTML=bic('route')+' Branch from here\u2026';
      branch.title='Go back to this version AND give what you do next '
        +'its own name, so it shows as a branch instead of overwriting '
        +'the line you were on';
      branch.addEventListener('click',function(){
        var suggest=ent.br?(ent.br+' 2'):'alternative';
        var nm=prompt('Call this branch:',suggest);
        if(nm===null) return;
        nm=nm.trim()||suggest;
        snapTake('before branching').then(function(){
          histRestoreDeck(then,ent.id,nm);
          histPanelClose();
          snapTake('branched: '+nm);
          toast('On branch \u201c'+nm+'\u201d \u2014 what you save next '
            +'descends from '+histLabel(ent)+', not from where you '
            +'were');
        });
      });
      acts.appendChild(branch);
      acts.appendChild(histAgainstPicker(ov,ent));
      body.appendChild(acts);
      /* ---- the three readings */
      var tabs=document.createElement('div');
      tabs.className='dh-tabs';
      [['slide','By slide','Every slide that is different, and what is '
        +'different about it'],
       ['type','By type','The same changes grouped by what they ARE, '
        +'with the slides each one happened on \u2014 for "did I recolour '
        +'every heading?"'],
       ['pic','Pictures','The two versions side by side']]
        .forEach(function(p){
          var b=document.createElement('button');
          b.className='dbtn dh-tab'+(histView===p[0]?' on':'');
          b.textContent=p[1];b.title=p[2];
          b.setAttribute('aria-pressed',(histView===p[0]).toString());
          b.addEventListener('click',function(){
            histView=p[0];histCompare(ov,ent);});
          tabs.appendChild(b);
        });
      if(histView==='pic'){
        var lab=document.createElement('label');
        lab.className='dh-every';
        var cb=document.createElement('input');
        cb.type='checkbox';cb.checked=histAllSlides;
        cb.addEventListener('change',function(){
          histAllSlides=cb.checked;histCompare(ov,ent);});
        lab.appendChild(cb);
        lab.appendChild(document.createTextNode(' every slide'));
        lab.title='Off, this shows only the slides that differ \u2014 '
          +'which on a forty-slide deck is the whole point';
        tabs.appendChild(lab);
      }
      body.appendChild(tabs);
      var list2=document.createElement('div');
      list2.className='dh-chlist';
      if(!list.length&&histView!=='pic'){
        /* T269: an empty answer is still an answer, but it has to say
           which two it compared -- "nothing is different between these
           two" on a screen whose two ends you cannot see is what makes
           the panel feel broken. */
        list2.innerHTML='<div class="selpane-empty">'
          +(histAgainst
            ?'These two versions are the same.'
            :'This version is the deck you are editing \u2014 nothing '
             +'has changed since. Pick an older version on the left to '
             +'see what you have done since then.')
          +'</div>';
      } else if(histView==='slide') chBySlide(list2,list);
      else if(histView==='type') chByType(list2,list);
      else chSlideRows(list2,d,then,now);
      body.appendChild(list2);
    });
  }
  /* which version the selected one is being read against ('' = the deck
     you are editing, which is what you want nine times in ten) */
  /* T269: ...but NOT for the newest version, which is the one this
     screen opens on. That one IS the deck you are editing, so reading it
     against "now" is guaranteed to say "no difference" -- the history
     opened on a dead end every single time (2026-09-04, user: "the
     history tab looks mid"). For the newest version the useful question
     is what it changed, so it is read against the one before it.
     Only ever applied when nothing has been picked by hand: choosing a
     comparison from the dropdown and then clicking about must keep it. */
  function histAutoAgainst(ix,ent){
    if(histAgainst) return histAgainst;
    if(!ix||ix.length<2||!ent) return '';
    if(ent.id!==ix[ix.length-1].id) return '';
    return ix[ix.length-2].id;
  }
  var histIxCache=[];
  function histAgainstEnt(){
    var hit=null;
    histIxCache.forEach(function(e){if(e.id===histAgainst) hit=e;});
    return hit||{at:Date.now()};
  }
  function histAgainstPicker(ov,ent){
    var wrap=document.createElement('label');
    wrap.className='dh-vs';
    var cap=document.createElement('span');
    cap.className='dh-vslab';cap.textContent='compare with';
    wrap.appendChild(cap);
    var sel=document.createElement('select');
    sel.className='etm dh-vssel';
    sel.title='By default a version is read against the deck you are '
      +'editing. Pick another version to see what changed between the '
      +'two of them instead.';
    var o0=document.createElement('option');
    o0.value='';o0.textContent='now (the deck you are editing)';
    sel.appendChild(o0);
    histIxCache.slice().reverse().forEach(function(e){
      if(e.id===ent.id) return;
      var o=document.createElement('option');
      o.value=e.id;
      o.textContent=histLabel(e)+' \u00b7 '+(e.br||'main');
      sel.appendChild(o);
    });
    sel.value=histAgainst;
    sel.addEventListener('change',function(){
      histAgainst=sel.value;histCompare(ov,ent);});
    wrap.appendChild(sel);
    return wrap;
  }
  /* ONE SLIDE BACK. In place when the deck still has it, and otherwise
     at the index it used to hold -- which is where you will look for it. */
  function histRestoreSlide(r,then){
    var copy=JSON.parse(JSON.stringify(r.a));
    var at;
    if(r.bi>=0){pres.slides[r.bi]=copy;at=r.bi;}
    else {
      at=Math.min(Math.max(r.ai,0),(pres.slides||[]).length);
      pres.slides.splice(at,0,copy);
    }
    cur=at;selAnnot=null;selSet=[];
    markDirty();refresh();
    toast(r.bi>=0?'Slide '+(at+1)+' is the older one again'
      :'Slide '+(at+1)+' is back');
  }
  function histRestoreDeck(then,fromId,branch){
    /* WHERE YOU NOW ARE IN THE TREE. Restoring puts the live deck at
       that snapshot, so the next save descends from IT -- which is what
       makes carrying on from an old version a fork rather than a lie
       about what came before (T90). */
    if(fromId!==undefined) histHead=fromId||null;
    if(branch!==undefined) histBranch=branch||'';
    if(fromId!==undefined||branch!==undefined) histPtrSave(pres.name);
    var pageWas=pres.page||null,bgWas=pres.pageBg||null;
    var copy=JSON.parse(JSON.stringify(then));
    copy.name=pres.name;      /* the NAME is where you are, not where it was */
    pres=copy;              /* replace/delete every normPres key together */
    if((pres.page||null)!==pageWas||(pres.pageBg||null)!==bgWas) deckZoom=0;
    cur=0;activePane=-1;selAnnot=null;selSet=[];
    /* Installs this version's custom type registry and discards undo
       entries whose object references belong to the replaced deck. */
    histReset();
    markDirty();refresh();renderFilm();renderPresTabs();renderPresRow();
    toast('Back to the older version \u2014 the deck as it was is in the '
      +'history too, so this is undoable');
  }
  /* T225: the one gesture the tree was missing. It is an ordinary
     snapshot with a name and a mark, so going back to it and
     branching from it are the buttons that already exist. */
  function histCheckpoint(ov){
    var nm=prompt('Call this checkpoint:','before the rewrite');
    if(nm===null) return;
    nm=nm.trim()||'checkpoint';
    snapTake('checkpoint',undefined,undefined,1).then(function(){
      /* the name you gave it IS the version's name: a checkpoint is
         the one version you definitely meant to be able to find */
      return histSetName(histHead,nm);
    }).then(function(){
      toast('Checkpoint \u201c'+nm+'\u201d saved \u2014 it is kept '
        +'even when older versions are dropped');
      if(ov&&document.body.contains(ov))
        histIndex().then(function(ix){histIxCache=ix;histRows(ov,ix);});
    });
  }
  function openHistory(){
    histPanelClose();
    histAgainst='';
    var ov=document.createElement('div');
    ov.className='deck-history';ov.id='deck-history';
    ov.innerHTML='<div class="dh-head">'
      +'<span class="dh-t">History of \u201c'+esc(pres.name||'this deck')
      +'\u201d</span>'
      +'<span class="dh-onbr">'+bic('route')+' on '
      +esc(histBranch||'main')+'</span>'
      +'<span class="deck-spring"></span>'
      +'<button class="dbtn primary" id="dh-check">'+bic('flag')
      +' Save a checkpoint\u2026</button>'
      +'<button class="dbtn" id="dh-close">'+bic('exit')+' Close</button>'
      +'</div><div class="dh-main">'
      +'<div class="dh-rail" id="dh-list"></div>'
      +'<div class="dh-body" id="dh-body">'
      +'<div class="selpane-empty">Pick a version on the left to see '
      +'what is different about it.</div></div></div>'
      +'<div class="dh-when-note">A version is kept when you open this '
      +'deck, when you save it, when you take a checkpoint, before '
      +'anything that replaces the deck, and once you have been working '
      +'for five minutes and then pause for half a minute. Not every '
      +'change \u2014 a session of work is one dot, not four hundred.'
      +'</div>';
    /* WHERE GIT IS. A deck is not a file on disk -- it lives inside the
       notebook or the project file -- so the deck's own history is this
       local store, and the repository's history of the file it is saved
       INTO is the notebook's, which server/vcs.py already lists and
       opens. Naming that rather than duplicating it is the honest hook:
       two histories that answer different questions, and neither
       pretending to be the other. */
    if(APP.mode==='app'){
      var git=document.createElement('div');
      git.className='dh-git';
      git.textContent='This is the deck\u2019s own history \u2014 the '
        +'moments between commits. The repository\u2019s history of the '
        +'file it is saved into is the notebook\u2019s: its Version '
        +'history menu lists the git commits and opens them.';
      ov.querySelector('.dh-main').appendChild(git);
    }
    document.body.appendChild(ov);
    ov.querySelector('#dh-close').addEventListener('click',histPanelClose);
    ov.querySelector('#dh-check')
      .addEventListener('click',function(){histCheckpoint(ov);});
    document.addEventListener('keydown',histPanelKey,true);
    histIndex().then(function(ix){
      histIxCache=ix;
      histRows(ov,ix);
      /* the most recent one is the one you meant */
      if(ix.length){histSel=ix[ix.length-1].id;histRows(ov,ix);
        histAgainst=histAutoAgainst(ix,ix[ix.length-1]);
        histCompare(ov,ix[ix.length-1]);}
    });
  }
