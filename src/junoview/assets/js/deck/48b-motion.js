/* 48b-motion.js — movement that keeps going, with numbers on it, and the Animation panel that sets them.
   ONE FRAGMENT of deck.js's single IIFE, concatenated with its
   siblings in filename order by assets.deck_js(). It does not
   parse alone and is not meant to: see 00-page.js. */
  /* ---- T445: MOTION, WITH NUMBERS ON IT -------------------------------
     (2026-09-14, user: "the motion things are cool, but it would be
     cool to have more configurations on these, like speed, and how far
     they wobble. Like please don't just do this half arsed again ...
     this needs to be going really far ... I want this to be able to
     have lots of automatic things to be able to make slides come
     alive." And: "the animation need to be able to be configured with
     a side tab ... the quick animate should pop up as a side panel.")

     `a.motion` names the movement, as it has since T385; `a.mo` carries
     the numbers -- speed, how far, easing, when it starts, how many
     times, which way round. Each is a multiplier or a plain value with
     a documented default, so a deck saved before this renders exactly
     as it did and `a.mo` is absent on every one of them.

     HOW THE NUMBERS REACH THE KEYFRAMES. "How far" is a custom
     property the keyframes multiply by (`--mo-amp`), so one @keyframes
     per movement covers every amount of it; the rest are the
     `animation` shorthand's own terms, written onto the element by
     motionPaint. The entrance is written into the SAME shorthand when
     there is one -- two animations on one element is one property, and
     a class cannot compose with another class without a rule per pair
     (T446 shipped fifteen of those; thirteen movements would have made
     sixty-five). */
  var MOTIONS=[
    ['wobble','Wobble',1.6,'ease-in-out','Rocks from side to side'],
    ['bob','Float',2.6,'ease-in-out','Floats up and down'],
    ['pulse','Pulse',1.8,'ease-in-out','Grows and shrinks'],
    ['sway','Sway',3,'ease-in-out','Slides left and right'],
    ['shake','Shake',0.6,'ease-in-out','A quick nervous shake'],
    ['spin','Spin',6,'linear','Turns all the way round'],
    ['swing','Swing',2.4,'ease-in-out','Swings from its top edge'],
    ['breathe','Breathe',3.4,'ease-in-out','Fades softly in and out'],
    ['jelly','Jelly',1.4,'ease-in-out','Squashes and stretches'],
    ['drift','Drift',9,'linear','Wanders slowly in a small circle'],
    ['glow','Glow',2.2,'ease-in-out','Its edge brightens and fades'],
    ['tilt','Tilt',2.8,'ease-in-out','Leans one way and back'],
    ['flicker','Flicker',2.4,'linear','Blinks like a faulty light']];
  function moBase(k){
    var r=null;
    MOTIONS.forEach(function(m){if(m[0]===k) r=m;});
    return r;
  }
  function moLabel(k){var b=moBase(k);return b?b[1]:'';}
  /* ICONS, NAMED LITERALLY. bic() with a computed key works at runtime
     but is invisible to the icon contract, which scans for literal
     one-argument calls -- and artwork with no visible consumer is
     what that test exists to delete. */
  function moIcon(k){
    if(k==='wobble') return bic('wobble');
    if(k==='bob') return bic('bob');
    if(k==='pulse') return bic('pulse');
    if(k==='sway') return bic('sway');
    if(k==='shake') return bic('shake');
    if(k==='spin') return bic('rotr');
    if(k==='swing') return bic('swing');
    if(k==='breathe') return bic('fade');
    if(k==='jelly') return bic('jelly');
    if(k==='drift') return bic('drift');
    if(k==='glow') return bic('star');
    if(k==='tilt') return bic('rotl');
    if(k==='flicker') return bic('flicker');
    return bic('none');
  }
  /* the six numbers, their defaults, and the bounds a slider offers */
  var MO_EASE=[['','As the movement likes'],['linear','Steady'],
    ['ease-in-out','Slow at both ends'],['ease-in','Slow to start'],
    ['ease-out','Slow to stop'],
    ['cubic-bezier(.34,1.56,.64,1)','Springy']];
  function moNum(v,def,lo,hi){
    var n=parseFloat(v);
    if(!isFinite(n)) return def;
    return Math.max(lo,Math.min(hi,n));
  }
  function moOpt(a){
    var o=(a&&a.mo)||{};
    return {sp:moNum(o.sp,1,0.2,5),amp:moNum(o.amp,1,0.1,5),
      ease:(typeof o.ease==='string')?o.ease:'',
      dl:moNum(o.dl,0,0,20),
      n:Math.round(moNum(o.n,0,0,50)),
      dir:(o.dir<0)?-1:1};
  }
  /* a value that IS the default is not stored: a deck with nothing
     customised carries no `mo` at all, which is what keeps every deck
     saved before this byte-identical */
  function moWrite(a,key,val){
    var def={sp:1,amp:1,ease:'',dl:0,n:0,dir:1}[key];
    var mo=a.mo||{};
    if(val===def||val===''+def) delete mo[key];
    else mo[key]=val;
    if(Object.keys(mo).length) a.mo=mo; else delete a.mo;
  }
  /* how long one cycle takes, as the panel says it and the element
     plays it */
  function moDur(k,o){
    var b=moBase(k);
    return b?(b[2]/(o.sp||1)):1;
  }
  /* the entrances, and how long each takes -- the delay the movement
     waits before it starts when the object also arrives with one */
  var MO_IN={fade:['anIn-fade',0.45,'ease'],
    rise:['anIn-rise',0.5,'cubic-bezier(.2,.7,.2,1)'],
    zoom:['anIn-zoom',0.45,'ease'],
    slide:['anIn-slide',0.5,'cubic-bezier(.2,.7,.2,1)'],
    turn:['anIn-turn',0.55,'cubic-bezier(.2,.7,.2,1)']};
  /* ONE element, painted. Called from the renderer's motion pass for
     every item that has one; a reduced-motion reader's !important rule
     still wins over this inline style, which is the whole reason the
     guard is written that way. */
  function motionPaint(el,a){
    if(!el||!a||!a.motion) return;
    /* T465: AN OBJECT THAT IS LEAVING LEAVES. The exit is a class rule
       (.an-anim-out{animation:an-out ...}) and this writes the motion
       into the INLINE animation shorthand, which outranks it -- so a
       box with a Wobble or a Spin on it kept moving at full opacity on
       the click it was sent away, and was dropped only on the next
       stop, or never if that was the slide's last click (2026-09-15
       review, driven). Leave the inline shorthand empty on that stop
       so the exit runs; the movement is over anyway. */
    if(el.classList.contains('an-anim-out')){el.style.animation='';return;}
    var b=moBase(a.motion); if(!b) return;
    var o=moOpt(a);
    el.style.setProperty('--mo-amp',String(o.amp));
    var inL='',inSec=0;
    Object.keys(MO_IN).forEach(function(t){
      if(!el.classList.contains('an-anim-'+t)) return;
      var e=MO_IN[t];
      inL=e[0]+' '+e[1]+'s '+e[2];
      inSec=e[1];
    });
    var layer='an-'+a.motion+' '+(b[2]/(o.sp||1)).toFixed(2)+'s '
      +(o.ease||b[3])+' '+(inSec+o.dl).toFixed(2)+'s '
      +(o.n>0?String(o.n):'infinite')+(o.dir<0?' reverse':'');
    el.style.animation=(inL?(inL+','):'')+layer;
  }
  /* ---- WHAT THE PANEL WRITES -----------------------------------------
     Every setter walks the whole selection, the rule fmtApply follows,
     and commits once. */
  function moItems(){
    var s=pres.slides[cur],out=[];
    selIdxs().forEach(function(i){
      var a=(s&&s.annots||[])[i]; if(a) out.push(a);});
    return out;
  }
  function moCommit(){
    markDirty();
    repaintAnimation();
    if(typeof motionSync==='function') motionSync();
    animCfgSync();
  }
  function motionApply(k){
    var items=moItems(); if(!items.length) return false;
    items.forEach(function(a){
      if(k) a.motion=k; else {delete a.motion;delete a.mo;}});
    moCommit();
    return true;
  }
  function motionOpt(key,val){
    var items=moItems(); if(!items.length) return false;
    items.forEach(function(a){if(a.motion) moWrite(a,key,val);});
    moCommit();
    return true;
  }
  /* ---- MAKE THE SLIDE COME ALIVE -------------------------------------
     "lots of automatic things to be able to make slides come alive."
     Each of these is one click on the whole slide: it reads what is
     there and gives each kind the movement or the arrival that suits
     it. Every one is a single undo step. */
  var LIFE=[
    ['calm','Gentle life',
     'Pictures float, headings breathe, shapes sway \u2014 all slow and '
     +'small'],
    ['drift','Calm drift','Everything wanders very slowly'],
    ['attention','Attention','The biggest words pulse; nothing else moves'],
    ['cascade','Cascade in',
     'Every object arrives on its own click, floating up'],
    ['fadein','Fade, one per click',
     'Every object arrives on its own click, fading'],
    ['auto','Play by itself',
     'Every object after the first arrives a second after the one '
     +'before \u2014 no clicks to press'],
    ['still','Stop all movement','Takes every movement off this slide']];
  function lifeIcon(id){
    if(id==='calm') return bic('bob');
    if(id==='drift') return bic('drift');
    if(id==='attention') return bic('pulse');
    if(id==='cascade') return bic('rise');
    if(id==='fadein') return bic('fade');
    if(id==='auto') return bic('play');
    return bic('none');
  }
  function lifeBig(s){
    /* the biggest words on the slide: the one "Attention" is about */
    var best=null,bs=-1;
    (s.annots||[]).forEach(function(a){
      if(!a||a.k!=='text'||a.hide) return;
      var sz=+a.size||((a.style&&typeof styleDef==='function')
        ?((styleDef(a.style)||{}).size||2.6):2.6);
      if(sz>bs){bs=sz;best=a;}
    });
    return best;
  }
  function lifeApply(id){
    var s=pres.slides[cur]; if(!s) return;
    var live=(s.annots||[]).filter(function(a){return a&&!a.hide;});
    if(!live.length){toast('Nothing on this slide yet');return;}
    function moveIt(a,k,amp,sp){
      a.motion=k;delete a.mo;
      moWrite(a,'amp',amp);moWrite(a,'sp',sp);
    }
    function stillAll(){
      live.forEach(function(a){delete a.motion;delete a.mo;});
    }
    var said='';
    if(id==='still'){stillAll();said='Everything is still again';}
    else if(id==='drift'){
      live.forEach(function(a){moveIt(a,'drift',0.6,0.6);});
      said='Everything drifts';
    } else if(id==='attention'){
      stillAll();
      var big=lifeBig(s);
      if(!big){toast('No words on this slide to draw the eye to');return;}
      moveIt(big,'pulse',0.8,0.8);
      said='\u201c'+String(big.text||'that box').slice(0,24)+'\u201d pulses';
    } else if(id==='calm'){
      live.forEach(function(a){
        if(a.k==='image'||a.k==='flip'||a.k==='cell')
          moveIt(a,'bob',0.55,0.7);
        else if(a.k==='rect'||a.k==='draw') moveIt(a,'sway',0.5,0.5);
        else if(a.k==='text') moveIt(a,'breathe',0.4,0.7);
        else if(a.k==='arrow') moveIt(a,'tilt',0.5,0.6);
        /* a table, a chart, a clip, a web page: the quietest of them */
        else moveIt(a,'breathe',0.3,0.6);
      });
      said='The slide is alive, gently';
    } else {
      /* the three ARRIVAL treatments: reading order, one click each */
      var order=(typeof orderedIdx==='function')
        ?orderedIdx(s):(s.annots||[]).map(function(a,i){return i;});
      var n=0;
      order.forEach(function(i){
        var a=(s.annots||[])[i];
        if(!a||a.hide) return;
        a.anim={type:(id==='cascade')?'rise':'fade',order:n};
        if(id==='auto'&&n>0) a.anim.after=1;
        n++;
      });
      if(!n){toast('Nothing on this slide yet');return;}
      revealCount=0;
      said=(id==='auto')
        ?(n+' objects play themselves, a second apart')
        :(n+' objects arrive one per click');
    }
    markDirty();repaintAnimation();
    if(typeof animPaneSync==='function') animPaneSync();
    animCfgSync();
    toast(said+' \u2014 Ctrl+Z undoes the lot');
  }
  /* ---- THE ANIMATION PANEL -------------------------------------------
     Everything about the selected object's animation, and about the
     slide's, in the pane that already lists the clicks -- so the ribbon
     can be the compact choosers T441 made of it and nothing is squashed
     off the row. The controls DRIVE THE RIBBON'S OWN where one exists
     (two doors, one implementation, the rule anim-layers already
     follows) and write the model directly only where the ribbon has
     nothing -- which is every one of the numbers below. */
  /* T493: the deck's colours as dots, and a picker for any other;
     the pressed one is the box's hlcol (@accent when it says nothing) */
  var HL_TOKENS=[['@accent','Accent'],['@warm','Warm'],['@lift','Lift'],
    ['@calm','Calm'],['@heading','Heading'],['@ink','Ink']];
  function cfgHlColour(host,a){
    var row=cfgRow(host,'cfg-hlcol');
    var cur_=a.anim.hlcol||'@accent';
    HL_TOKENS.forEach(function(t){
      var c=cfgChip(row,'<i class="cfg-dot"></i>',t[1],cur_===t[0],
        'Deck colour '+t[1]+' \u2014 follows the deck colours',
        function(){animSetHl('hlcol',t[0]==='@accent'?'':t[0]);animCfgSync();});
      var dot=c.querySelector('.cfg-dot');
      if(dot) dot.style.background=tokVal(t[0]);
    });
    var pick=document.createElement('input');
    pick.type='color';
    var hex=/^#[0-9a-f]{6}$/i.test(cur_)?cur_:tokVal(cur_);
    pick.value=/^#[0-9a-f]{6}$/i.test(hex)?hex:'#39a9c0';
    pick.title='Any other colour';
    pick.setAttribute('aria-label','Highlight colour');
    pick.addEventListener('click',function(e){e.stopPropagation();});
    pick.addEventListener('input',function(){
      /* live on the sample while the picker is open */
      var pv=host.querySelector('.cfg-hlprev');
      if(pv) pv.style.setProperty('--hl-col',pick.value);
    });
    pick.addEventListener('change',function(){
      animSetHl('hlcol',pick.value);animCfgSync();});
    row.appendChild(pick);
  }
  function cfgHlPreview(host,a){
    var pv=document.createElement('div');
    pv.className='cfg-hlprev';
    pv.setAttribute('data-hlfx',a.anim.hlfx||'both');
    pv.setAttribute('data-hlrest',a.anim.hlrest||'dim');
    pv.style.setProperty('--hl-col',tokVal(a.anim.hlcol||'@accent'));
    pv.style.setProperty('--hl-scale',
      String((a.anim.hlsize>0?a.anim.hlsize:104)/100));
    [['an-hl-rest','The bullet before it'],['an-hl','The one this click is about'],
     ['an-hl-wait an-hl-rest','The one still to come']].forEach(function(p){
      var sp=document.createElement('span');
      sp.className='an-part '+p[0];sp.textContent=p[1];
      pv.appendChild(sp);
    });
    host.appendChild(pv);
    return pv;
  }
  function cfgHead(host,txt){
    var h=document.createElement('div');
    h.className='anim-h';h.textContent=txt;host.appendChild(h);
    return h;
  }
  function cfgNote(host,txt){
    var n=document.createElement('div');
    n.className='cfg-note';n.textContent=txt;host.appendChild(n);
    return n;
  }
  function cfgChip(row,html,label,on,tip,fn){
    var b=document.createElement('button');
    b.type='button';b.className='cfg-chip'+(on?' on':'');
    b.setAttribute('aria-pressed',on?'true':'false');
    b.innerHTML=html;
    var sp=document.createElement('span');sp.textContent=label;
    b.appendChild(sp);
    if(tip) b.title=tip;
    b.addEventListener('click',function(e){e.stopPropagation();fn();});
    row.appendChild(b);
    return b;
  }
  function cfgRow(host,cls){
    var r=document.createElement('div');
    r.className='cfg-chips'+(cls?(' '+cls):'');
    host.appendChild(r);return r;
  }
  /* a number with a slider, a live readout and a reset -- the shape
     every one of the motion settings takes */
  function cfgRange(host,label,val,lo,hi,step,fmt,tip,fn){
    var w=document.createElement('label');w.className='cfg-range';
    var t=document.createElement('span');t.className='cfg-rl';
    t.textContent=label;w.appendChild(t);
    var i=document.createElement('input');
    i.type='range';i.min=String(lo);i.max=String(hi);i.step=String(step);
    i.value=String(val);
    i.setAttribute('aria-label',label);
    if(tip) w.title=tip;
    w.appendChild(i);
    var out=document.createElement('span');
    out.className='cfg-rv';out.textContent=fmt(val);
    w.appendChild(out);
    i.addEventListener('input',function(){out.textContent=fmt(+i.value);});
    i.addEventListener('change',function(){fn(+i.value);});
    host.appendChild(w);
    return i;
  }
  function cfgSelect(host,label,opts,val,fn){
    var w=document.createElement('label');w.className='cfg-sel';
    var t=document.createElement('span');t.className='cfg-rl';
    t.textContent=label;w.appendChild(t);
    var s=document.createElement('select');
    s.className='fp-tiesel';
    s.setAttribute('aria-label',label);
    opts.forEach(function(o){
      var op=document.createElement('option');
      op.value=o[0];op.textContent=o[1];
      if(o[0]===val) op.selected=true;
      s.appendChild(op);
    });
    s.addEventListener('change',function(){fn(s.value);});
    w.appendChild(s);host.appendChild(w);
    return s;
  }
  /* a ribbon control, pressed from here. Hidden or folded makes no
     difference: the element is in the DOM either way. */
  function cfgPress(id){
    var b=$(id);
    if(b&&!b.disabled) b.click();
  }
  function cfgOn(id){
    var b=$(id);
    return !!b&&b.getAttribute('aria-pressed')==='true';
  }
  /* ---- the sections ---------------------------------------------- */
  function cfgSeq(host){
    /* QUICK ANIMATE LIVES HERE NOW (T445). It was three cells on the
       ribbon, competing for the row with everything else at the exact
       moment the mode needs your attention on the slide. */
    cfgHead(host,'quick animate \u2014 click things in order');
    var st=document.createElement('div');st.className='cfg-seqwhat';
    var done=seqArm.hits.length;
    st.innerHTML='<b>next: '+(seqArm.n+1)+'</b> \u00b7 click the next '
      +'thing to appear'+(done?(' \u00b7 '+done+' placed'):'');
    host.appendChild(st);
    cfgNote(host,'Shift-click puts one on the same click as the last; '
      +'hold 1\u20139 while clicking for a pause instead of a click.');
    var row=cfgRow(host);
    SEQ_FX.forEach(function(f){
      cfgChip(row,fxIcon(f[0]),f[1]+' ('+f[2]+')',seqType===f[0],
        f[1]+' \u2014 press '+f[2]
        +(f[0]==='none'?'. Clicking then TAKES an animation away.'
          :'. Every click from now gives this.'),
        function(){seqType=f[0];seqSync();});
    });
    /* T471: and how much of a text box each click gives */
    cfgHead(host,'a text box arrives');
    var rowb=cfgRow(host);
    SEQ_BY.forEach(function(f){
      cfgChip(rowb,bic(f[3]==='text'?'text':(f[3]==='indent'?'indent'
        :(f[3]==='spacing'?'spacing':'star'))),f[1]+' ('+f[2]+')',
        seqBy===f[0],f[1]+' \u2014 press '+f[2]+'. Every text box '
        +'clicked from now arrives this way.',
        function(){seqBy=f[0];seqSync();});
    });
    var acts=cfgRow(host,'cfg-acts');
    var u=document.createElement('button');
    u.type='button';u.className='anim-mini';
    u.textContent=done?('Undo last ('+done+')'):'Undo last';
    u.disabled=!done;
    u.addEventListener('click',function(){seqUndoOne();});
    acts.appendChild(u);
    var d=document.createElement('button');
    d.type='button';d.className='anim-mini primary';
    d.textContent=done?('Finish ('+done+')'):'Finish';
    d.addEventListener('click',function(){seqEnd(true);});
    acts.appendChild(d);
    var c=document.createElement('button');
    c.type='button';c.className='anim-mini';
    c.textContent='Cancel (Esc)';
    c.addEventListener('click',function(){seqEnd(false);});
    acts.appendChild(c);
  }
  function cfgArrival(host,a){
    cfgHead(host,'how it arrives');
    var row=cfgRow(host);
    var now=(a&&a.anim&&a.anim.type)||'';
    SEQ_FX.forEach(function(f){
      var on=(f[0]==='none')?!a.anim:(now===f[0]);
      cfgChip(row,fxIcon(f[0]),f[1],on,f[3]||'',
        function(){animSetType(f[0]);animCfgSync();});
    });
    if(!a.anim){
      cfgNote(host,'It is on the slide from the start.');
      return;
    }
    cfgHead(host,'when it starts');
    var r2=cfgRow(host);
    [['#anim-onclick','On click','locate'],
     ['#anim-withprev','With previous','together'],
     ['#anim-afterprev','After previous','reload']].forEach(function(p){
      var b=$(p[0]);
      var dis=!b||b.disabled;
      var c=cfgChip(r2,(p[2]==='locate'?bic('locate')
        :(p[2]==='together'?bic('together'):bic('reload'))),
        p[1],cfgOn(p[0]),'',function(){cfgPress(p[0]);animCfgSync();});
      if(dis) c.disabled=true;
    });
    if(cfgOn('#anim-afterprev')){
      var sec=+(($('#anim-delay')||{}).value||1);
      cfgRange(host,'Wait',sec,1,60,1,function(v){return v+'s';},
        'Seconds after the build before this one',function(v){
        var di=$('#anim-delay');
        if(di){di.value=v;di.dispatchEvent(new Event('change'));}
        animCfgSync();
      });
    }
    if(a.k==='text'){
      cfgHead(host,'how much arrives at a time');
      var r3=cfgRow(host);
      [['#anim-by-all','Whole box','text'],
       ['#anim-by-para','By bullet','indent'],
       ['#anim-by-sent','By sentence','spacing'],
       ['#anim-by-hl','Highlight','star']].forEach(function(p){
        cfgChip(r3,(p[2]==='text'?bic('text')
          :(p[2]==='indent'?bic('indent')
            :(p[2]==='spacing'?bic('spacing'):bic('star')))),
          p[1],cfgOn(p[0]),'',function(){cfgPress(p[0]);animCfgSync();});
      });
      /* T471: the highlight's two choices, once it is on. T493: and
         its colour and its size, with a sample that shows all four
         (2026-09-15, user: "I can't work out how to configure the dot
         point by dot point animation that is the highlight option ...
         confused if that is an option to change the colour of the
         highlight and size"). */
      if(a.anim&&a.anim.hl){
        cfgHead(host,'the lit bullet — a sample');
        cfgHlPreview(host,a);
        cfgHead(host,'the lit bullet');
        var r5=cfgRow(host);
        HL_FX.forEach(function(p){
          cfgChip(r5,bic('star'),p[1],(a.anim.hlfx||'')===p[0],'',
            function(){animSetHl('hlfx',p[0]);animCfgSync();});
        });
        if((a.anim.hlfx||'')!=='grow'){
          cfgHead(host,'its colour');
          cfgHlColour(host,a);
        }
        if((a.anim.hlfx||'')!=='colour'){
          var sz=(a.anim.hlsize>0)?a.anim.hlsize:104;
          cfgRange(host,'Bigger by',sz,100,150,1,
            function(v){return (v-100)+'%';},
            'How much larger the lit bullet grows',function(v){
              animSetHl('hlsize',v===104?'':v);animCfgSync();});
        }
        cfgHead(host,'the other bullets');
        var r6=cfgRow(host);
        HL_REST.forEach(function(p){
          cfgChip(r6,bic(p[0]==='blur'?'none':(p[0]==='plain'?'text':'eye')),
            p[1],(a.anim.hlrest||'')===p[0],'',
            function(){animSetHl('hlrest',p[0]);animCfgSync();});
        });
      }
    }
    /* T473: a figure arrives in panels -- the common grids as chips
       and the exact numbers as two sliders */
    if(a.k==='cell'||a.k==='image'){
      cfgHead(host,'how much arrives at a time');
      var rp=cfgRow(host);
      var g=(typeof panelsOf==='function')?panelsOf(a):null;
      var gk=g?(g.c+'x'+g.r):'1x1';
      [['1x1','Whole figure'],['2x1','2 across'],['3x1','3 across'],
       ['2x2','2 \u00d7 2'],['3x2','3 \u00d7 2']].forEach(function(p){
        cfgChip(rp,bic('grid'),p[1],gk===p[0],'',
          function(){animSetPanels(p[0]);animCfgSync();});
      });
      if(g){
        cfgRange(host,'Across',g.c,1,6,1,function(v){return String(v);},
          'Panels across',function(v){
            animSetPanels(Math.round(v)+'x'+g.r);animCfgSync();});
        cfgRange(host,'Down',g.r,1,6,1,function(v){return String(v);},
          'Panels down',function(v){
            animSetPanels(g.c+'x'+Math.round(v));animCfgSync();});
        cfgNote(host,'Each panel is a click, left to right and then down. '
          +'The covers are the page\u2019s own colour.');
      }
    }
    var ow=$('#anim-outwrap');
    if(ow&&!ow.hidden){
      cfgHead(host,'when it leaves');
      var r4=cfgRow(host);
      /* T467: the ribbon's own words (T453 renamed the verb for exactly
         this) -- two chips, the pressed one the truth, and the click it
         goes on beside them. It was one chip that read "Stays" until you
         pressed it and "Disappears" after, and never said which click. */
      var leaving=cfgOn('#anim-out');
      cfgChip(r4,bic('none'),'Stays',!leaving,
        'On the slide to the end',
        function(){if(leaving){cfgPress('#anim-out');animCfgSync();}});
      cfgChip(r4,bic('exit'),'Send it away',leaving,
        'Leaves partway through, on a click of its own. The caret beside '
        +'Send it away on the ribbon sends it away as something else '
        +'arrives instead',
        function(){if(!leaving){cfgPress('#anim-out');animCfgSync();}});
      if(leaving){
        var say=$('#anim-out-say');
        if(say&&say.textContent) cfgNote(host,'Goes '+say.textContent+'.');
      }
    }
  }
  /* T472: the click on which it is the point */
  function cfgFocus(host,a){
    cfgHead(host,'focus, on a click');
    var row=cfgRow(host);
    var f=animFocus(a),now=f?f.fx:'';
    cfgChip(row,bic('none'),'None',!f,'No focus click',
      function(){focusSet('');animCfgSync();});
    FOCUS_FX.forEach(function(p){
      cfgChip(row,bic(p[0]==='spot'?'eye':(p[0]==='zoom'?'expand':'find')),
        p[1],now===p[0],p[2],function(){focusSet(p[0]);animCfgSync();});
    });
    if(!f) return;
    cfgHead(host,'when');
    focusWhenRows(host);
  }
  function cfgMotion(host,a){
    cfgHead(host,'movement, while it is on the slide');
    var row=cfgRow(host,'cfg-mo');
    cfgChip(row,bic('none'),'Still',!a.motion,
      'Still, once it has arrived',function(){motionApply('');});
    MOTIONS.forEach(function(m){
      cfgChip(row,moIcon(m[0]),m[1],a.motion===m[0],m[4],function(){
        motionApply(m[0]);
        if(typeof motionPreview==='function') motionPreview(m[0]);
      });
    });
    if(!a.motion){
      cfgNote(host,'Pick one and its speed, size and timing appear here.');
      return;
    }
    var o=moOpt(a),b=moBase(a.motion);
    cfgNote(host,b[4]+'.');
    cfgRange(host,'Speed',o.sp,0.2,5,0.05,function(v){
      return String(+v.toFixed(2))+'\u00d7 \u00b7 '
        +(b[2]/v).toFixed(1)+'s a cycle';},
      'How fast one cycle runs. 1 is the movement\u2019s own pace',
      function(v){motionOpt('sp',v);});
    cfgRange(host,'How far',o.amp,0.1,5,0.05,function(v){
      return String(+v.toFixed(2))+'\u00d7';},
      'How far it moves each cycle. 1 is the movement\u2019s own size',
      function(v){motionOpt('amp',v);});
    cfgSelect(host,'Easing',MO_EASE,o.ease,function(v){
      motionOpt('ease',v);});
    cfgRange(host,'Starts after',o.dl,0,20,0.25,function(v){
      return v?(v+'s'):'straight away';},
      'Seconds it waits before it starts moving \u2014 counted from '
      +'the moment it arrives',function(v){motionOpt('dl',v);});
    cfgRange(host,'Repeat',o.n,0,50,1,function(v){
      return v?(v+(v===1?' time':' times')):'for ever';},
      'How many cycles it runs before it settles. 0 keeps going',
      function(v){motionOpt('n',v);});
    var dr=cfgRow(host);
    cfgChip(dr,bic('rotr'),'This way',o.dir>0,'',
      function(){motionOpt('dir',1);});
    cfgChip(dr,bic('rotl'),'The other way',o.dir<0,
      'Runs the cycle backwards \u2014 the way a spin turns, which side '
      +'a wobble starts on',function(){motionOpt('dir',-1);});
    var acts=cfgRow(host,'cfg-acts');
    var pv=document.createElement('button');
    pv.type='button';pv.className='anim-mini';
    pv.textContent='Play it here';
    pv.title='Runs it on the slide for a moment, so you can see the '
      +'numbers you just set';
    pv.addEventListener('click',function(){
      if(typeof motionPreview==='function') motionPreview(a.motion);});
    acts.appendChild(pv);
    var off=document.createElement('button');
    off.type='button';off.className='anim-mini';
    off.textContent='Take it off';
    off.addEventListener('click',function(){motionApply('');});
    acts.appendChild(off);
  }
  function cfgLife(host){
    cfgHead(host,'make this slide come alive');
    var row=cfgRow(host,'cfg-life');
    LIFE.forEach(function(p){
      cfgChip(row,lifeIcon(p[0]),p[1],false,p[2],function(){
        lifeApply(p[0]);});
    });
  }
  /* ---- T452: TWO TABS, NOT ONE SCROLL --------------------------------
     (2026-09-14, user: "the animation pane is not the right place for
     configuring the animation details e.g. for things like the wobble
     and such. The animation pane is for the order. Please do not mix
     them. Or perhaps put tabs on the pane e.g. configuration and
     order".) T445 stacked one on top of the other, which put the six
     numbers of a wobble between you and the list of clicks every time
     you opened the pane to check the order.
     CONFIGURE is what the selected thing does -- how it arrives, how it
     moves, when it leaves. ORDER is the list of clicks this pane has
     always been, and Quick animate moved there with it, because
     clicking things in turn IS setting the order. Which tab you were
     last on is remembered per project, like every other pane state. */
  var ANIMTAB_KEY='semopts:'+SCOPE+':animtab';
  function animTabGet(){
    return lsGet(ANIMTAB_KEY)==='ord'?'ord':'cfg';
  }
  function animTabSet(which){
    lsSet(ANIMTAB_KEY,which==='ord'?'ord':'cfg');
    animTabApply();
  }
  /* shows one host, hides the other, and lights the tab that won. Both
     halves are BUILT either way -- each is a few dozen nodes and the
     order list already redraws on every commit -- so switching tabs is
     only ever a class flip, never a rebuild that could lose a caret or
     a drag. */
  function animTabApply(){
    var cfg=$('#animpane-cfg'),ord=$('#animpane-body');
    var tc=$('#animpane-tab-cfg'),to=$('#animpane-tab-ord');
    if(!cfg||!ord) return;
    var on=animTabGet();
    cfg.hidden=(on!=='cfg');
    ord.hidden=(on!=='ord');
    if(tc) tc.setAttribute('aria-selected',(on==='cfg').toString());
    if(to) to.setAttribute('aria-selected',(on==='ord').toString());
  }
  function animTabBoot(){
    var tc=$('#animpane-tab-cfg'),to=$('#animpane-tab-ord');
    if(tc) tc.addEventListener('click',function(e){
      e.stopPropagation();animTabSet('cfg');});
    if(to) to.addEventListener('click',function(e){
      e.stopPropagation();animTabSet('ord');});
    animTabApply();
  }
  /* the whole panel, rebuilt from the selection. Cheap enough to
     rebuild: it is a few dozen nodes and it is only ever open while
     somebody is looking at it. */
  function animCfgSync(){
    var host=$('#animpane-cfg'); if(!host) return;
    var pane=$('#animpane');
    if(pane&&pane.hidden){host.innerHTML='';return;}
    host.innerHTML='';
    /* T452: Quick animate lives on Order now. Saying so beats an empty
       tab, because arming it switches the pane over and the eye is
       still here. */
    if(typeof seqOn==='function'&&seqOn()){
      cfgNote(host,'Quick animate is running — its count and its '
        +'three buttons are on the Order tab, because clicking things '
        +'in turn is what sets the order.');
      return;
    }
    var poster=!!(typeof pageOf==='function'&&pageOf().poster);
    if(poster){
      cfgNote(host,'A poster is one printed page: there is no click to '
        +'step through, so nothing here animates.');
      return;
    }
    var s=pres.slides[cur];
    var a=(typeof selAnnot==='number')?annotByIdx(s,selAnnot):null;
    if(!a){
      cfgNote(host,'Select something on the slide to give it an '
        +'entrance or a movement.');
      cfgLife(host);
      return;
    }
    var who=document.createElement('div');
    who.className='cfg-who';
    who.innerHTML=bic('objects')+' ';
    var nm=document.createElement('span');
    nm.textContent=(typeof itemLabel==='function')
      ?itemLabel(s,selAnnot):'this object';
    who.appendChild(nm);
    var n=selIdxs().length;
    if(n>1){
      var more=document.createElement('span');
      more.className='cfg-more';
      more.textContent='and '+(n-1)+' more';
      who.appendChild(more);
    }
    host.appendChild(who);
    cfgArrival(host,a);
    cfgFocus(host,a);   /* T472 */
    cfgMotion(host,a);
    cfgLife(host);
  }
  function animCfgBoot(){
    /* the panel follows the selection: showFmt already calls
       animPaneSync on every one, and that is where this hangs (see
       48-animation.js) */
    animTabBoot();
    animCfgSync();
  }
