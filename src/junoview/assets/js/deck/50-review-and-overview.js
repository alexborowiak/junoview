/* 50-review-and-overview.js — the deck as words, the overview map, cuts, and the builder's sidebar.
   ONE FRAGMENT of deck.js's single IIFE, concatenated with its
   siblings in filename order by assets.deck_js(). It does not
   parse alone and is not meant to: see 00-page.js. */
  /* ---- WHAT THE DECK SAYS, IN WORDS -----------------------------------
     (TASKS T35.) Two halves of one idea: write the deck out as text a
     person or a language model can read, and say what looks wrong with
     it while you are in there.

     WHY THIS IS NOT PREFLIGHT. `preflight` asks "will this print" — per
     slide, physical, millimetres and dpi and contrast. This asks "does
     this hold together" — deck-wide, editorial, about words and figures
     and whether the same thing is called two things. They share no
     question and no unit, and folding one into the other would give you
     a list where "0.2mm line" sits next to "slide 12 has 90 words on
     it" as if those were the same kind of problem.

     THE EXPORT IS TEXT, AND MARKDOWN. junoview is offline and stays
     offline; what travels is the words. Markdown because it pastes into
     anything, because a model reads structure out of it without being
     told the format, and because a colleague can read it as it stands —
     which is the difference between an export and a dump.

     IT SAYS WHERE A FIGURE CAME FROM, and that is the part no other
     export can do: a deck knows its figures by notebook anchor, so the
     review can say "the toe map, from demo::toe_map" rather than
     "[image]". Reviewing a talk without knowing which figure is which
     is reviewing a talk with the pictures cut out.

     THE FOUR LINTS ARE THE FOUR TASKS.md NAMES, and each one reports
     what it counted rather than a verdict, because a heuristic that
     will not show its working is one you cannot argue with:
       - a figure nobody mentions: on the slide, no caption, and no text
         or note on that slide that names it.
       - a caption with no figure: `capOf` pointing at nothing, or text
         that reads like a caption and is tied to nothing. T17 made the
         tie explicit, which is what makes this answerable at all.
       - two spellings of one thing: terms that are the same once
         hyphens, spaces and case are taken out. Grouped that way,
         "sea-level"/"sea level" and "Toe Map"/"toe map" fall out
         together, and "The"/"the" — which differ only in the first
         letter, i.e. a sentence beginning — deliberately do not.
       - a slide with a lot on it: words and items, both counted. */
  var DENSE_WORDS=55, DENSE_ITEMS=12;
  function revText(a){
    if(!a) return '';
    if(a.k==='text') return String(a.text||'');
    if(a.k==='table'&&Array.isArray(a.rows))
      return a.rows.map(function(r){
        return (r||[]).map(function(c){
          return typeof c==='string'?c:((c&&c.t)||'');}).join(' | ');
      }).join('\n');
    return '';
  }
  function slideWordCount(sl){
    var n=0;
    (sl.annots||[]).forEach(function(a){
      if(!a||a.hide||a.priv) return;
      var t=revText(a).trim();
      if(t) n+=t.split(/\s+/).length;
    });
    if(sl.layout==='title')
      n+=String((sl.title||'')+' '+(sl.sub||'')).trim()
        .split(/\s+/).filter(Boolean).length;
    return n;
  }
  /* capOfFig answers the editor's MODEL question and must see every tied
     caption. A review asks the narrower audience question instead. */
  function reviewCaption(sl,a){
    var ci=capOfFig(sl,a);
    var ca=ci>=0?(sl.annots||[])[ci]:null;
    return ca&&!ca.hide&&!ca.priv?ca:null;
  }
  /* WHERE A FIGURE CAME FROM, in one line. The deck knows this and no
     other export of it does. */
  function revFigLine(sl,a,map){
    var bits=[];
    var nm=a.ref?String(a.ref).split('::').pop():'';
    bits.push(nm||(a.k==='image'?'a placed picture'
      :a.k==='flip'?'a flip book':'a frame'));
    var num=(a.cap&&map[a.cap])?map[a.cap].n:0;
    if(num) bits[0]='Figure '+num+' — '+bits[0];
    var ca=reviewCaption(sl,a);
    /* A caption normally travels WITH its figure, which used to bypass
       deckReview's private/hidden guard entirely. Apply the same audience
       boundary before borrowing its words (T49). */
    var cap=ca?revText(ca).trim():'';
    if(cap) bits.push('“'+figSubst(cap,ca,map)+'”');
    if(a.ref) bits.push('from '+a.ref);
    else if(a.k==='image') bits.push('pasted in, not from a notebook');
    if(a.k==='flip'&&Array.isArray(a.frames))
      bits.push(a.frames.length+' frames');
    return bits.join(' · ');
  }
  /* WHAT TO CALL A SLIDE IN AN EXPORT THAT TRAVELS. `filmText` names a
     slide by the first thing written on it, which is right in the strip
     — you are looking at the slide, private items and all. Here it is
     wrong: a slide whose only text is an "only me" note would be
     HEADED with that note, and the whole promise of T31 is that those
     words do not leave. So the heading is taken from the same reading
     order with the private items already dropped. */
  function revHeading(sl){
    if(!sl) return '';
    if(sl.label) return String(sl.label);
    if(sl.layout==='title'&&sl.title) return String(sl.title);
    var out='';
    orderedIdx(sl).forEach(function(j){
      if(out) return;
      var a=(sl.annots||[])[j];
      if(!a||a.hide||a.priv||a.capOf) return;
      var t=revText(a).trim();
      if(t) out=t.split(/[\r\n]/)[0];
    });
    return out;
  }
  function deckReview(){
    var L=[],map=figNumbers();
    var runs=sectionRuns();
    var n=(pres.slides||[]).length;
    var mins=goalTotal();
    L.push('# '+(pres.name||'Untitled deck'));
    L.push('');
    L.push(n+' slide'+(n===1?'':'s')
      +(runs.filter(function(r){return r.id;}).length
        ?(' in '+runs.filter(function(r){return r.id;}).length
          +' sections'):'')
      +(mins?(' · '+fmtMins(mins)+' planned'):'')
      +(pres.talkMins?(' · '+pres.talkMins+' minute slot'):''));
    if(pres.notes){
      L.push('');
      L.push('## About the whole talk');
      L.push('');
      L.push(String(pres.notes).trim());
    }
    runs.forEach(function(run){
      L.push('');
      L.push('## '+(run.id?(run.name||'Section')
        :(runs.length>1?'(no section)':'The slides')));
      for(var k=0;k<run.n;k++){
        (function(i){
          var sl=pres.slides[i];
          if(!sl) return;
          L.push('');
          L.push('### '+(i+1)+'. '+(revHeading(sl)||'(untitled)'));
          var tags=[];
          if(sl.opt) tags.push('optional');
          if(sl.cuts&&sl.cuts.length)
            tags.push('only in: '+sl.cuts.map(function(c){
              return (cutMap()[c]||{}).name||c;}).join(', '));
          if(slideGoal(sl)) tags.push(fmtMins(slideGoal(sl))+' planned');
          if(tags.length) L.push('*'+tags.join(' · ')+'*');
          if(sl.layout==='title'){
            if(sl.title) L.push('');
            if(sl.title) L.push('**'+sl.title+'**');
            if(sl.sub) L.push(sl.sub);
          }
          /* IN READING ORDER, not storage order: the review has to say
             the slide in the order somebody looking at it would */
          var words=[],figs=[];
          orderedIdx(sl).forEach(function(j){
            var a=(sl.annots||[])[j];
            /* a private note is not part of the talk, and this export
               travels (T31) */
            if(!a||a.hide||a.priv) return;
            if(isFigure(a)){figs.push(revFigLine(sl,a,map));return;}
            if(a.capOf) return;         /* said with its figure */
            var t=figSubst(revText(a),a,map).trim();
            if(t) words.push(t);
          });
          if(words.length){
            L.push('');
            words.forEach(function(t){
              L.push(t.split('\n').map(function(ln,li){
                return (li?'  ':'- ')+ln;}).join('\n'));
            });
          }
          if(figs.length){
            L.push('');
            L.push('Figures:');
            figs.forEach(function(f){L.push('- '+f);});
          }
          if(sl.notes){
            L.push('');
            L.push('Speaker notes:');
            String(sl.notes).trim().split('\n').forEach(function(ln){
              L.push('> '+ln);});
          }
        })(run.at+k);
      }
    });
    L.push('');
    return L.join('\n');
  }
  /* the terms, normalised: hyphens, spaces and case out, so the
     variants of one thing land in one bucket */
  function termKey(w){
    return String(w||'').toLowerCase().replace(/[^a-z0-9]+/g,'');
  }
  function reviewLints(){
    var out=[],map=figNumbers();
    var surfaces={};
    (pres.slides||[]).forEach(function(sl,si){
      var texts=[];
      (sl.annots||[]).forEach(function(a){
        if(!a||a.hide||a.priv) return;
        var t=revText(a); if(t) texts.push(t);
      });
      if(sl.notes) texts.push(String(sl.notes));
      if(sl.layout==='title') texts.push((sl.title||'')+' '+(sl.sub||''));
      var all=texts.join(' ');
      /* --- 1. a figure nobody mentions --- */
      (sl.annots||[]).forEach(function(a,i){
        if(!isFigure(a)||a.hide||a.priv) return;
        if(reviewCaption(sl,a)) return;       /* a PUBLIC caption */
        var num=(a.cap&&map[a.cap])?map[a.cap].n:0;
        var nm=a.ref?String(a.ref).split('::').pop():'';
        var named=(num&&new RegExp('\\bfig(?:ure)?\\.?\\s*'+num+'\\b','i')
          .test(all))
          ||(nm&&all.toLowerCase().indexOf(nm.toLowerCase().replace(
            /[_-]+/g,' '))>=0)
          ||(nm&&all.toLowerCase().indexOf(nm.toLowerCase())>=0);
        if(named) return;
        out.push({sev:'warn',si:si,i:i,
          head:'Slide '+(si+1)+': a figure nothing mentions',
          why:(num?('Figure '+num):'This figure')+' has no caption, and '
            +'no text or note on the slide names it. An audience does '
            +'not know what they are looking at.'});
      });
      /* --- 2. a caption with no figure --- */
      (sl.annots||[]).forEach(function(a,i){
        if(!a||a.hide||a.priv||a.k!=='text') return;
        var t=revText(a).trim();
        var looks=/^\s*(fig(ure)?\.?\s*\d|table\s*\d)/i.test(t);
        if(a.capOf){
          if(figOfCap(sl,a)>=0) return;
          out.push({sev:'err',si:si,i:i,
            head:'Slide '+(si+1)+': a caption whose figure is gone',
            why:'“'+t.slice(0,60)+'” is tied to a figure that is no '
              +'longer on this slide. It will number as [missing '
              +'figure] and read as a caption for nothing.'});
        } else if(looks){
          out.push({sev:'warn',si:si,i:i,
            head:'Slide '+(si+1)+': a caption that is not tied to '
              +'anything',
            why:'“'+t.slice(0,60)+'” reads like a caption but belongs '
              +'to no figure, so it will not follow one, and its '
              +'number will not update when the slides move.'});
        }
      });
      /* --- 4. a slide with a lot on it --- */
      var wc=slideWordCount(sl);
      var ic=(sl.annots||[]).filter(function(a){
        return a&&!a.hide&&!a.priv&&!a.capOf;}).length;
      if(wc>DENSE_WORDS||ic>DENSE_ITEMS)
        out.push({sev:'warn',si:si,i:null,
          head:'Slide '+(si+1)+': a lot on one slide',
          why:wc+' words and '+ic+' things on it. Above about '
            +DENSE_WORDS+' words an audience reads instead of '
            +'listening.'});
      /* COLLECT THE SURFACES for lint 3. Single words AND adjacent
         pairs, because the whole point is that "sea-level" and "sea
         level" are the same term written two ways -- and one of those
         is one token while the other is two. A first pass that only
         looked at single tokens found the hyphenated form and never
         the spaced one, so the two could never meet in a bucket. */
      var toks=all.match(/[A-Za-z][A-Za-z0-9'-]*/g)||[];
      function surf(w){
        var k=termKey(w);
        if(k.length<4) return;
        (surfaces[k]=surfaces[k]||{})[w]=(surfaces[k][w]||0)+1;
      }
      toks.forEach(function(w,i){
        if(w.length>=4) surf(w);
        if(i+1<toks.length){
          var pair=w+' '+toks[i+1];
          if(termKey(pair).length>=6) surf(pair);
        }
      });
    });
    /* --- 3. two spellings of one thing --- */
    Object.keys(surfaces).forEach(function(k){
      var forms=Object.keys(surfaces[k]);
      if(forms.length<2) return;
      /* forms differing ONLY in the first letter's case are a sentence
         beginning, not an inconsistency */
      var real=forms.some(function(a){
        return forms.some(function(b){
          return a!==b&&a.slice(1)!==b.slice(1);});});
      if(!real) return;
      /* NO MINIMUM COUNT. A first pass wanted three occurrences before
         reporting, which silently hid the commonest real case -- the
         term said once each way, which is exactly the inconsistency
         worth catching. Two surfaces that normalise to the same string
         and differ by more than a capital is already a strong enough
         signal; the count is shown so you can judge it yourself. */
      var total=forms.reduce(function(t,f){return t+surfaces[k][f];},0);
      out.push({sev:'warn',si:null,i:null,
        head:'Two spellings of one thing',
        why:forms.map(function(f){
          return '“'+f+'” ×'+surfaces[k][f];}).join(', ')
          +'. Pick one — an audience reads the difference as a '
          +'distinction.'});
    });
    /* --- 4. a picture nobody has described (T105) ---
       Deliberately NOT "has no alt text": a picture is allowed to carry
       nothing, and saying so is a real answer. What this reports is the
       picture nobody has decided about, which is the only state that is
       an omission rather than a choice. It reads the same field the
       renderer does, so a deck this is quiet about is a deck whose alt
       text is really there. */
    (pres.slides||[]).forEach(function(sl,si){
      (sl.annots||[]).forEach(function(a,i){
        if(!a||a.priv) return;
        if(a.k!=='image'&&a.k!=='flip') return;
        if(a.dec||(a.alt&&String(a.alt).trim())) return;
        out.push({sev:'warn',si:si,i:i,
          head:'This picture does not say what it shows',
          why:'Somebody who cannot see it gets “'
            +(annotLabel(a)||'image')+'” — the name of the box, not '
            +'what is in it. Right-click the picture and write its alt '
            +'text, or leave that empty to mark it decorative if it '
            +'really carries nothing.'});
      });
    });
    /* --- 5. the talk does not fit the time it has (T121) ---
       Every part of this already existed and none of it was a LINT:
       slideGoal and goalTotal add the goals up, rehStats holds what
       each slide actually took, and the notes pane shows the verdict
       while you are presenting. That is the wrong moment -- the review
       is where you still have time to cut a slide. So this restates
       what those already know rather than measuring anything new. */
    var goal=goalTotal();
    var st=rehStats(),runs=(st.runs||[]).length;
    if(goal&&runs){
      var real=0,timed=0;
      (pres.slides||[]).forEach(function(sl){
        var a=sl&&sl.sid?st.by[sl.sid]:null;
        if(a&&a.n){real+=a.mean/60;timed++;}
      });
      /* only worth saying when most of the deck has actually been
         rehearsed -- half a run extrapolated to a whole talk is a
         number that looks like evidence and is not */
      if(timed>=Math.ceil((pres.slides||[]).length/2)&&real){
        var over=real-goal;
        if(Math.abs(over)>=Math.max(1,goal*0.1))
          out.push({sev:over>0?'err':'warn',si:null,i:null,
            head:over>0?'This runs long':'This runs short',
            why:'The goals add up to '+fmtMins(goal)+' and '+timed
              +' rehearsed slide'+(timed===1?'':'s')+' averaged '
              +fmtMins(real)+' \u2014 '+fmtMins(Math.abs(over))
              +(over>0?' over. Cut a slide, or move the goal.'
                :' under. There is room for the thing you left out.')});
      }
    }
    /* --- 6. a link that goes nowhere (T118) ---
       An internal jump is stored by `sid` precisely so reordering
       cannot repoint it -- but DELETING the target still can, and
       silently. This is the one lint that reports a broken thing
       rather than a debatable one. */
    (pres.slides||[]).forEach(function(sl,si){
      (sl.annots||[]).forEach(function(a,i){
        var l=a&&a.link;
        if(!l||l.to!=='slide') return;
        if(linkSlideIdx(l.sid)>=0) return;
        out.push({sev:'err',si:si,i:i,
          head:'This link goes nowhere',
          why:'It points at a slide that is no longer in the deck. '
            +'Clicking it while presenting says so and stays put, '
            +'which is not what you want an audience to see.'});
      });
    });
    /* --- 7. two slides that are the same slide --- */
    var seen={};
    (pres.slides||[]).forEach(function(sl,si){
      var key=(sl.annots||[]).filter(function(a){
        return a&&!a.hide&&!a.priv;
      }).map(function(a){
        return a.k+':'+(revText(a)||a.src||'').slice(0,80);
      }).sort().join('|');
      if(!key||key.length<20) return;    /* an empty slide is not a copy */
      if(seen[key]!=null){
        out.push({sev:'warn',si:si,i:null,
          head:'This slide is a copy of an earlier one',
          why:'Slide '+(seen[key]+1)+' has the same objects and the '
            +'same words. A duplicate left in by accident reads as a '
            +'stutter; one left in on purpose usually wants a build '
            +'instead.'});
      } else seen[key]=si;
    });
    return out;
  }
  /* THE WHOLE REVIEW AS ONE THING (T121).
     The panel showed the lints and the readable text side by side and
     then exported only the text, so the half you would send to a
     co-author was the half without the findings in it. The .md now
     carries both, and there is a JSON door beside it for anything that
     is not a person -- a pre-submission check in CI, most obviously.
     Neither recomputes: both read reviewLints(), so an export can never
     disagree with what the panel just showed you. */
  function reviewMarkdown(text,lints){
    if(!lints.length) return text;
    var head='## What this review found\n\n';
    var body=lints.map(function(l){
      var where=(l.si!=null)?('Slide '+(l.si+1)+' \u2014 '):'';
      return '- **'+(l.sev==='err'?'':'')+where+l.head+'.** '+l.why;
    }).join('\n');
    return head+body+'\n\n---\n\n'+text;
  }
  function reviewJson(lints){
    return JSON.stringify({
      deck:pres.name||'',
      slides:(pres.slides||[]).length,
      findings:lints.map(function(l){
        return {severity:l.sev,slide:(l.si==null?null:l.si+1),
          object:(l.i==null?null:l.i),title:l.head,detail:l.why};
      })
    },null,2);
  }
  /* THE PANEL. The lints first, because they are the reason to open it
     twice; the text below them, because it is the reason to open it at
     all. Both at once rather than two doors: what a lint says and what
     the reviewer will read are the same deck, and having to switch
     between them to check one against the other is the whole problem
     with a separate report. */
  function reviewClose(){
    var ov=$('#deck-review');
    if(ov) ov.remove();
    document.removeEventListener('keydown',reviewKey,true);
  }
  function reviewKey(e){
    if(!$('#deck-review')) return;
    if(e.key==='Escape'){
      e.preventDefault();e.stopPropagation();reviewClose();}
  }
  function openReview(){
    reviewClose();
    var text=deckReview(),lints=reviewLints();
    var ov=document.createElement('div');
    ov.className='deck-review';ov.id='deck-review';
    ov.innerHTML='<div class="rv-head">'
      +'<span class="rv-t">Send this deck out to be read</span>'
      +'<span class="deck-spring"></span>'
      +'<button class="dbtn" id="rv-copy">'+bic('copy')+' Copy</button>'
      +'<button class="dbtn" id="rv-dl">'+bic('markdown')
      +' Save as .md</button>'
      +'<button class="dbtn" id="rv-json" title="The same findings as '
      +'JSON, for something that is not a person to read \u2014 a '
      +'pre-submission check, say">'+bic('code')
      +' Save as .json</button>'
      +'<button class="dbtn" id="rv-close">'+bic('exit')
      +' Close</button></div>'
      +'<div class="rv-main">'
      +'<div class="rv-lints" id="rv-lints"></div>'
      +'<div class="rv-textwrap"><span class="rv-lab">'
      +'what a reader gets — markdown, so it pastes anywhere</span>'
      +'<textarea class="rv-text" id="rv-text" readonly '
      +'spellcheck="false"></textarea></div></div>';
    document.body.appendChild(ov);
    ov.querySelector('#rv-text').value=text;
    var host=ov.querySelector('#rv-lints');
    var hd=document.createElement('div');
    hd.className='rv-lhead';
    var errs=lints.filter(function(l){return l.sev==='err';}).length;
    hd.textContent=lints.length
      ?(lints.length+' thing'+(lints.length===1?'':'s')+' to look at'
        +(errs?(' · '+errs+' serious'):''))
      :'Nothing looks wrong with the content';
    host.appendChild(hd);
    var note=document.createElement('div');
    note.className='rv-note';
    note.textContent='These are heuristics about the CONTENT, and each '
      +'says what it counted so you can disagree with it. “Before you '
      +'print” is the other list — that one is about ink and '
      +'millimetres.';
    host.appendChild(note);
    lints.forEach(function(l){
      var b=document.createElement('button');
      b.className='rv-lint sev-'+l.sev;
      var h=document.createElement('span');
      h.className='rv-lh';h.textContent=l.head;
      var w=document.createElement('span');
      w.className='rv-lw';w.textContent=l.why;
      b.appendChild(h);b.appendChild(w);
      if(l.si!=null){
        b.title='Go to slide '+(l.si+1);
        b.addEventListener('click',function(){
          reviewClose();
          cur=l.si;selAnnot=(l.i==null?null:l.i);
          selSet=(l.i==null?[]:[l.i]);
          refresh();
        });
      } else b.classList.add('nogo');
      host.appendChild(b);
    });
    ov.querySelector('#rv-close').addEventListener('click',reviewClose);
    ov.querySelector('#rv-copy').addEventListener('click',function(){
      var ta=ov.querySelector('#rv-text');
      ta.select();
      var done=false;
      try{done=document.execCommand('copy');}catch(e){}
      if(!done&&navigator.clipboard)
        navigator.clipboard.writeText(text).then(function(){
          toast('Copied — paste it wherever it is being read');});
      else toast(done?'Copied — paste it wherever it is being read'
        :'Select the text and copy it');
    });
    ov.querySelector('#rv-dl').addEventListener('click',function(){
      /* the findings AND the readable text: the half you send to a
         co-author used to be the half without the findings (T121) */
      var blob=new Blob([reviewMarkdown(text,lints)],
        {type:'text/markdown'});
      var a=document.createElement('a');
      a.href=URL.createObjectURL(blob);
      a.download=(pres.name||'deck')+'.review.md';
      a.click();
      setTimeout(function(){URL.revokeObjectURL(a.href);},2000);
      toast('Saved — it travels; junoview stays here');
    });
    ov.querySelector('#rv-json').addEventListener('click',function(){
      var blob=new Blob([reviewJson(lints)],{type:'application/json'});
      var a=document.createElement('a');
      a.href=URL.createObjectURL(blob);
      a.download=(pres.name||'deck')+'.review.json';
      a.click();
      setTimeout(function(){URL.revokeObjectURL(a.href);},2000);
      toast(lints.length+' finding'+(lints.length===1?'':'s')
        +' saved as JSON');
    });
    document.addEventListener('keydown',reviewKey,true);
  }
  /* ---- THE OVERVIEW: THE WHOLE TALK AT ONCE ---------------------------
     (TASKS T26.) TASKS.md is careful about what this is: "the realistic
     scope of the infinite-canvas wish — an overview/navigation layer,
     not canvas-based authoring". So it navigates and it does not author,
     and that boundary is the reason it can be an overlay over the
     existing model rather than a second editor.

     WHY AN OVERLAY AND NOT A PANE. Every pane in this app docks beside
     the stage and takes width from the page; this needs the opposite —
     all the room there is, for as long as you are looking, and none
     afterwards. It is the same shape as the spotlight and the presenter
     view, which are the other two things here that take the screen and
     give it straight back.

     WHAT IT DRAWS is what already exists: sectionRuns() for the
     clusters, miniDiagram() for the tiles, and the same reading of
     optional/cut membership the playback filter uses. Nothing here
     computes a fact of its own, which is why it cannot disagree with
     the strip it is a zoom-out of. */
  function overviewClose(){
    var ov=$('#deck-overview');
    if(ov) ov.remove();
    document.removeEventListener('keydown',overviewKey,true);
  }
  function overviewKey(e){
    if(!$('#deck-overview')) return;
    if(e.key==='Escape'){
      e.preventDefault();e.stopPropagation();overviewClose();
    }
  }
  function openOverview(){
    overviewClose();
    var ov=document.createElement('div');
    ov.className='deck-overview';ov.id='deck-overview';
    var head=document.createElement('div');
    head.className='ovw-head';
    var t=document.createElement('span');
    t.className='ovw-t';
    var runs=sectionRuns();
    var n=(pres.slides||[]).length;
    t.textContent=(pres.name||'This deck')+' \u2014 '+n+' slide'
      +(n===1?'':'s')
      +(function(){
        var ns=runs.filter(function(r){return r.id;}).length;
        return ns?(' in '+ns+' section'+(ns===1?'':'s')):'';
      })();
    head.appendChild(t);
    var sp=document.createElement('span');
    sp.className='deck-spring';head.appendChild(sp);
    /* THE SEARCH BOX IS THE MAP'S (T30). Filtering a map you can already
       see beats a separate results list you cannot. */
    var find=document.createElement('input');
    find.className='ovw-find';find.id='ovw-find';find.type='search';
    find.placeholder='Find a slide\u2026';
    find.setAttribute('aria-label','Find a slide by its words or notes');
    head.appendChild(find);
    var cnt=document.createElement('span');
    cnt.className='ovw-fn';head.appendChild(cnt);
    var cl=document.createElement('button');
    cl.className='dbtn';cl.innerHTML=bic('exit')+' Close';
    cl.title='Esc';
    cl.addEventListener('click',overviewClose);
    head.appendChild(cl);
    ov.appendChild(head);
    var body=document.createElement('div');
    body.className='ovw-body';
    runs.forEach(function(r){
      var grp=document.createElement('div');
      grp.className='ovw-grp';
      var gh=document.createElement('div');
      gh.className='ovw-gh';
      gh.textContent=r.id?(r.name||'Section')
        :(runs.length>1?'(no section)':'');
      if(gh.textContent) grp.appendChild(gh);
      var tiles=document.createElement('div');
      tiles.className='ovw-tiles';
      for(var k=0;k<r.n;k++){
        (function(i){
          var sl=pres.slides[i];
          var tile=document.createElement('button');
          tile.className='ovw-tile'+(i===cur?' cur':'')
            +(sl&&sl.opt?' opt':'')
            +(slideSkipped(i)?' cut':'');
          var num=document.createElement('span');
          num.className='ovw-n';num.textContent=String(i+1);
          tile.appendChild(num);
          tile.appendChild(miniDiagram(sl));
          var lab=document.createElement('span');
          lab.className='ovw-lab';
          lab.textContent=filmText(sl)||'';
          tile.appendChild(lab);
          tile.dataset.i=String(i);
          tile.title=(sl&&sl.opt?'Optional \u2014 ':'')
            +'Go to slide '+(i+1);
          tile.addEventListener('click',function(){
            overviewClose();
            /* PRESENTING, go() -- so the transition plays, the rehearsal
               clock attributes the time and the presenter view follows.
               Setting cur by hand would skip all three (T30). */
            if(mode==='view'){go(i);return;}
            cur=i;activePane=-1;selAnnot=null;selSet=[];
            refresh();
          });
          tiles.appendChild(tile);
        })(r.at+k);
      }
      grp.appendChild(tiles);
      body.appendChild(grp);
    });
    ov.appendChild(body);
    /* TYPE TO NARROW. The tiles are already drawn; a hit hides the ones
       that do not match rather than rebuilding the map, so the slides
       do not jump about under the pointer as you type. */
    function applyFind(){
      var q=find.value.trim();
      if(!q){
        $$('.ovw-tile',ov).forEach(function(t){t.hidden=false;
          t.classList.remove('hit');
          var w=t.querySelector('.ovw-why'); if(w) w.remove();});
        $$('.ovw-grp',ov).forEach(function(g){g.hidden=false;});
        cnt.textContent='';
        return;
      }
      var hits={},n=0;
      slideHits(q).forEach(function(h){hits[h.i]=h;n++;});
      $$('.ovw-tile',ov).forEach(function(t){
        var i=+t.dataset.i;
        var h=hits[i];
        t.hidden=!h;
        t.classList.toggle('hit',!!h);
        var w=t.querySelector('.ovw-why');
        if(w) w.remove();
        if(h){
          var e=document.createElement('span');
          e.className='ovw-why';
          e.textContent=(h.where?(h.where+': '):'')+h.snip;
          t.appendChild(e);
        }
      });
      /* a section with nothing left in it stops taking up a heading */
      $$('.ovw-grp',ov).forEach(function(g){
        g.hidden=!$$('.ovw-tile',g).some(function(t){return !t.hidden;});
      });
      cnt.textContent=n?(n+' slide'+(n===1?'':'s')):'nothing';
    }
    find.addEventListener('input',applyFind);
    find.addEventListener('keydown',function(e){
      e.stopPropagation();
      if(e.key==='Escape'){
        if(find.value){find.value='';applyFind();e.preventDefault();}
        return;
      }
      /* Enter goes to the first one, which is what you meant */
      if(e.key==='Enter'){
        var first=$$('.ovw-tile',ov).filter(function(t){
          return !t.hidden;})[0];
        if(first){e.preventDefault();first.click();}
      }
    });
    document.body.appendChild(ov);
    /* CAPTURE, so Esc closes the map before the editor's own Esc ladder
       reads it as "drop the tool" — the innermost state wins, which is
       the rule that ladder already follows */
    document.addEventListener('keydown',overviewKey,true);
  }
  /* ---- OPTIONAL SLIDES, NAMED CUTS, AND RUNNING LATE ------------------
     (TASKS T24 and T25 — one model, and T25 is three lines once T24
     exists, so they are built together.)

     THE PROBLEM: three files called talk-45.deck, talk-20.deck and
     talk-5.deck, diverging from the day they were copied.

     THE MODEL. A slide carries `opt:1` when it is optional, and a set of
     cut names in `cuts` — a slide IS IN a cut when it names it. Both
     live ON THE SLIDE, for the reason sections chose the same shape and
     recorded it: membership stored on the slide travels through every
     splice, every drag, every duplicate and every undo for free, while a
     stored list of indexes has to be repaired after each of them and
     will eventually not be.

     `pres.cuts` holds only the NAMES, exactly as `pres.sections` holds
     only section names, and for the same reason: the order and the
     membership are read back off the slide list.

     WHAT A CUT MEANS. A slide with no `cuts` is in EVERY cut — that is
     what makes the feature adoptable, because an existing deck is
     already a complete "everything" cut and turning one on excludes
     nothing until you say so. Naming cuts on a slide narrows it.

     RUNNING LATE (T25) is then not a fourth concept: it is a live
     filter that also drops anything marked optional, from wherever you
     have got to. It is deliberately NOT a cut — you do not choose it
     before the talk, you reach for it at minute 34 — and it applies
     from the CURRENT slide onward, because the ones you have already
     shown are not the problem. */
  function cutMap(){
    /* Reads must not recreate an empty map after the last version is
       deleted. newCut is the one lifecycle verb allowed to create it. */
    return (pres&&pres.cuts)||{};
  }
  function hasCut(id){
    return Object.prototype.hasOwnProperty.call(cutMap(),id);
  }
  function cutList(){
    var m=cutMap();
    return Object.keys(m).map(function(id){
      return {id:id,name:String((m[id]&&m[id].name)||id)};
    }).sort(function(a,b){return a.name.localeCompare(b.name);});
  }
  function cutId(){
    var m=cutMap(),n=1;
    while(Object.prototype.hasOwnProperty.call(m,'k'+n)) n++;
    return 'k'+n;
  }
  function cutNameTaken(name,except){
    var want=String(name||'').toLowerCase();
    return cutList().some(function(c){
      return c.id!==except&&c.name.toLowerCase()===want;});
  }
  function newCut(name){
    name=String(name||'').trim()||'Short version';
    if(cutNameTaken(name,'')){
      toast('There is already a version called “'+name+'”');return '';
    }
    var id=cutId();
    if(!pres.cuts) pres.cuts={};
    pres.cuts[id]={name:name};
    markDirty();
    return id;
  }
  /* the cut currently being SHOWN, or '' for the whole deck. Session
     state, not deck state: which version you are rehearsing today is
     not a property of the document, and sending someone a deck must not
     send them your rehearsal. Same argument matchPick makes. */
  var showCut='',lateFrom=-1;
  var runFilterPres=null;
  /* A cut and Running late belong to one open deck, not to the next deck
     that happens to reuse k1. Also repair a deleted/stale active id at the
     one read boundary rather than asking every caller to remember (T50). */
  function activeCut(){
    if(runFilterPres!==pres){
      runFilterPres=pres;showCut='';lateFrom=-1;
    }
    if(showCut&&!hasCut(showCut)) showCut='';
    return showCut;
  }
  function renameCut(id){
    if(!hasCut(id)) return false;
    var d=cutMap()[id]; if(!d) return false;
    var old=d.name||id;
    var v=prompt('Name this version:',old);
    if(v==null) return false;
    v=v.trim(); if(!v||v===old) return false;
    if(cutNameTaken(v,id)){
      toast('There is already a version called “'+v+'”');return false;
    }
    d.name=v;
    markDirty();renderFilm();presenterSync&&presenterSync();
    toast('Version renamed to “'+v+'”');
    return true;
  }
  function delCut(id){
    if(!hasCut(id)) return false;
    var d=cutMap()[id]; if(!d) return false;
    var name=d.name||id;
    var universal=(pres.slides||[]).filter(function(sl){
      return sl&&Array.isArray(sl.cuts)&&sl.cuts.length
        &&sl.cuts.every(function(c){return c===id;});}).length;
    if(!confirm('Delete the version “'+name+'”? Slides stay in the deck. '
      +(universal?(universal+' slide'+(universal===1?'':'s')
        +' that names no other version will return to every version.')
        :'No slide will become universal.')))
      return false;
    var wasActive=activeCut()===id;
    delete pres.cuts[id];
    (pres.slides||[]).forEach(function(sl){
      if(!sl||!Array.isArray(sl.cuts)) return;
      var keep=sl.cuts.filter(function(c){return c!==id;});
      if(keep.length) sl.cuts=keep; else delete sl.cuts;
    });
    if(!Object.keys(pres.cuts).length) delete pres.cuts;
    if(wasActive) showCut='';
    markDirty();renderFilm();presenterSync&&presenterSync();
    toast('Deleted “'+name+'” — every slide stayed'
      +(wasActive?' · showing every slide':''));
    return true;
  }
  /* a slide is in a cut when it names it — and a slide that names no
     cuts is in all of them, which is what makes an existing deck a
     complete "everything" version on the day this ships. */
  function inCut(sl,cut){
    if(!cut) return true;
    var c=sl&&sl.cuts;
    if(!c||!c.length) return true;
    return c.indexOf(cut)>=0;
  }
  /* SKIPPED, for playback only. Never for the editor: a slide you have
     cut is still a slide you are editing, and hiding it from the strip
     would be how you lose it. */
  function slideSkipped(i){
    var sl=(pres.slides||[])[i];
    if(!sl) return false;
    if(!inCut(sl,activeCut())) return true;
    if(lateFrom>=0&&i>lateFrom&&sl.opt) return true;
    return false;
  }
  /* the next slide playback should land on, in a direction. Returns -1
     when there is nothing left that way. */
  function nextShown(from,dir){
    var n=(pres.slides||[]).length;
    for(var i=from+dir;i>=0&&i<n;i+=dir)
      if(!slideSkipped(i)) return i;
    return -1;
  }
  /* One ordered answer for presenter numbering as well as playback.
     Raw deck indexes are wrong as soon as a named cut or Running late
     removes anything between two shown slides (T48). */
  function shownSlides(){
    var out=[];
    (pres.slides||[]).forEach(function(sl,i){
      if(!slideSkipped(i)) out.push(i);
    });
    return out;
  }
  function setCut(id){
    activeCut();
    if(id&&!hasCut(id)) id='';
    showCut=id||'';
    /* landing on a slide the cut excludes would be a talk that starts
       on a slide it is not showing */
    if(mode==='view'&&slideSkipped(cur)){
      var to=nextShown(cur,1);
      if(to<0) to=nextShown(cur,-1);
      if(to>=0) go(to);
    }
    presenterSync&&presenterSync();
    renderFilm();
    toast(id?('Showing the \u201c'+(cutMap()[id]||{}).name
      +'\u201d version'):'Showing every slide');
  }
  /* T25. One control, mid-talk, that drops the rest of the optional
     slides. From HERE onward: what you have already shown is not the
     problem, and un-showing it is not on offer. */
  function syncLateButton(){
    var b=$('#deck-late'); if(!b) return;
    var on=lateFrom>=0;
    b.hidden=(mode!=='view');
    b.setAttribute('aria-pressed',on?'true':'false');
    b.innerHTML=bic('flag')+(on?' Running late: on':' Running late');
    b.title=on?'Show the remaining optional slides again (L)'
      :'Skip the remaining optional slides from here (L)';
  }
  function initPresenterControls(){
    var b=$('#deck-late');
    if(b) b.addEventListener('click',function(){
      runLate(lateFrom<0);
    });
    syncLateButton();
  }
  function runLate(on){
    var cut=activeCut();
    lateFrom=on?cur:-1;
    syncLateButton();
    renderFilm();
    presenterSync&&presenterSync();
    if(!on){toast('Back to the full run');return 0;}
    var n=0;
    (pres.slides||[]).forEach(function(sl,i){
      if(i>cur&&sl&&sl.opt&&inCut(sl,cut)) n++;});
    toast(n?(n+' optional slide'+(n===1?'':'s')
      +' will be skipped from here'):'No optional slides left to skip');
    return n;
  }
  function toggleOptional(i){
    var sl=(pres.slides||[])[i]; if(!sl) return;
    if(sl.opt) delete sl.opt; else sl.opt=1;
    markDirty();renderFilm();
    toast(sl.opt?'Optional \u2014 "Running late" will skip it'
      :'No longer optional');
  }
  function toggleSlideCut(i,id){
    var sl=(pres.slides||[])[i]; if(!sl||!id||!hasCut(id)) return;
    var c=(sl.cuts||[]).slice();
    var at=c.indexOf(id);
    if(at>=0) c.splice(at,1); else c.push(id);
    /* an empty list means "every cut", so it is dropped rather than
       stored — the same empty-is-absent rule sections and styles use */
    if(c.length) sl.cuts=c; else delete sl.cuts;
    markDirty();renderFilm();
  }
  function go(n){
    var prev=cur;
    /* a pending self-advance belongs to the slide that armed it (T169) */
    autoStop();
    cur=Math.max(0,Math.min(pres.slides.length-1,n));
    if(cur===prev) return;   /* clamped no-op: keep build + selection state */
    /* stepping back into a slide shows it fully built; forward starts fresh */
    revealCount=(mode==='view'&&cur<prev)?buildsForSlide(cur):0;
    /* arm on ARRIVAL too: a slide whose first build is delayed should
       start counting the moment you land on it, not on a click that
       would defeat the point (T169). Deferred so it arms against the
       slide that is actually on screen. */
    setTimeout(autoArm,0);
    selAnnot=null;selSet=[];   /* never carry a selection across slides */
    /* MEASURE BEFORE THE REBUILD. renderSlide empties the stage, so the
       outgoing geometry has to be taken here or it is gone (T27). */
    captureFlip(prev);
    /* ...and the time so far belongs to the slide you are LEAVING, which
       is why this is here rather than after the render (T29) */
    rehSlideChanged();
    refresh();
    playFlip();
    presenterSync();
    if(window.SemApp&&window.SemApp.updateHash) window.SemApp.updateHash();
  }
  /* advance: reveal the next build, else move to the next slide (no-op at the
     very end, so the final slide never collapses back to its pre-build state) */
  /* ---- THE TALK PANEL (T88) ---------------------------------------
     Present mode has no ribbon and no rail on purpose, so the two things
     you might want to change mid-talk had nowhere to live. One button in
     the corner beside the slide count, one small panel, and both
     settings also on a key -- because reaching for a panel in front of a
     room is exactly what you do not want to do. */
  function syncTalk(){
    var p=$('#talkpane'); if(!p) return;
    var b=$('#talk-builds');
    if(b){
      b.setAttribute('aria-pressed',talkNoBuilds?'true':'false');
      b.title=talkNoBuilds
        ? 'Animations are off: every slide arrives complete and slides '
          +'change with a plain cut. Press again to play them (A)'
        : 'Skip the animations: builds and slide transitions both, so '
          +'one click is one slide and nothing moves. Flip books still '
          +'step (A)';
      var lab=b.querySelector('.tk-state');
      if(lab) lab.textContent=talkNoBuilds?'skipped':'playing';
    }
    /* the reset button IS the readout: the current size, click to put
       it back. It used to say 100% forever while the real number sat
       in a hidden span (T126). */
    var r=$('#talk-reset');
    if(r){
      r.textContent=Math.round(talkText*100)+'%';
      r.disabled=(talkText===1);
    }
    [['h','head'],['b','body'],['c','cap']].forEach(function(t){
      var v=$('#talk-'+t[0]+'-val');
      if(v){
        v.textContent=Math.round(talkType[t[1]]*100)+'%';
        v.disabled=(talkType[t[1]]===1);
      }
    });
  }
  function talkBuilds(on){
    talkNoBuilds=on?1:0;
    /* a slide part-way through its builds must not be left showing
       fewer things than it now claims to have */
    if(talkNoBuilds) revealCount=0;
    syncTalk();renderSlide();presenterSync();
    toast(talkNoBuilds
      ? 'Animations skipped \u2014 slides arrive complete, and change '
        +'with a plain cut'
      : 'Animations are playing again');
  }
  /* bucket===undefined scales everything; a bucket name scales that
     kind of text on top of the global size. 0 always means "put it
     back", and the GLOBAL reset puts the types back too, because "the
     size the deck was made at" is one state, not four (T126). */
  function talkZoom(mult,bucket){
    if(bucket){
      var w=talkType[bucket];
      talkType[bucket]=Math.max(0.6,Math.min(2.2,
        mult===0?1:Math.round(w*mult*100)/100));
      if(talkType[bucket]===w) return;
      syncTalk();renderSlide();
      return;
    }
    var was=talkText;
    talkText=Math.max(0.6,Math.min(2.2,
      mult===0?1:Math.round(talkText*mult*100)/100));
    if(mult===0) talkType={head:1,body:1,cap:1};
    if(talkText===was&&mult!==0) return;
    syncTalk();renderSlide();
  }
  (function(){
    var btn=$('#talkbtn'),pane=$('#talkpane');
    if(!btn||!pane) return;
    function open(on){
      pane.hidden=!on;
      btn.setAttribute('aria-expanded',on?'true':'false');
      if(on) syncTalk();
    }
    btn.addEventListener('click',function(e){
      e.stopPropagation();open(pane.hidden);});
    var cl=$('#talkpane-close');
    if(cl) cl.addEventListener('click',function(){open(false);});
    var b=$('#talk-builds');
    if(b) b.addEventListener('click',function(){
      talkBuilds(!talkNoBuilds);});
    var sm=$('#talk-smaller');
    if(sm) sm.addEventListener('click',function(){talkZoom(1/1.12);});
    var bg=$('#talk-bigger');
    if(bg) bg.addEventListener('click',function(){talkZoom(1.12);});
    var rs=$('#talk-reset');
    if(rs) rs.addEventListener('click',function(){talkZoom(0);});
    [['h','head'],['b','body'],['c','cap']].forEach(function(t){
      var mi=$('#talk-'+t[0]+'-minus'),pl=$('#talk-'+t[0]+'-plus'),
        vl=$('#talk-'+t[0]+'-val');
      if(mi) mi.addEventListener('click',function(){
        talkZoom(1/1.12,t[1]);});
      if(pl) pl.addEventListener('click',function(){
        talkZoom(1.12,t[1]);});
      if(vl) vl.addEventListener('click',function(){talkZoom(0,t[1]);});
    });
    window.SemDeckTalk={open:open,builds:talkBuilds,zoom:talkZoom,
      sync:syncTalk};
  })();
  /* THE ONE TIMER. A stop with `after` runs on a clock instead of a
     click (T169), so exactly one may be pending at a time and ANY other
     movement cancels it -- a presenter who reaches for the space bar or
     jumps a slide has taken control back, and a talk that then advanced
     twice would be the worst possible bug in front of an audience. */
  var autoT=null;
  function autoStop(){
    if(autoT){clearTimeout(autoT);autoT=null;}
  }
  function autoArm(){
    autoStop();
    if(mode!=='view') return;
    var s=pres.slides[cur]; if(!s) return;
    if(revealCount>=slideStops(s)) return;
    var secs=(typeof autoAfter==='function')?autoAfter(s,revealCount):0;
    if(!secs) return;
    autoT=setTimeout(function(){
      autoT=null;
      if(mode!=='view') return;
      advance();
    },secs*1000);
  }
  function advance(){
    autoStop();
    var s=pres.slides[cur];
    /* a flip book's frames are stops in this same sequence, so the space
       bar walks the figure through its steps exactly as it walks a build
       — one gesture for the whole talk (2026-08-22) */
    if(mode==='view'&&s&&revealCount<slideStops(s)){
      revealCount++;renderSlide();presenterSync();autoArm();
    } else {
      /* THE FILTER LIVES HERE, in the two verbs the whole talk runs on,
         rather than in twenty callers. A cut or a running-late skip is
         a fact about what to show NEXT, which is exactly what advance
         asks (T24/T25). */
      var nx=nextShown(cur,1);
      if(nx>=0) go(nx);
    }
  }
  function backStep(){
    autoStop();
    if(mode==='view'&&revealCount>0){revealCount--;renderSlide();
      presenterSync();}
    else {
      var pv=nextShown(cur,-1);
      /* At the first slide in a cut, Back is a no-op. Raw cur-1 can be
         a slide this version explicitly leaves out (T50). */
      go(pv>=0?pv:cur);
    }
  }

  /* ---------- create mode: sidebar UI ---------- */
  /* ---------- presentations rail (vertical, left edge) ----------
     One item is active at any time: the "Notebooks" button (builder
     closed) or a presentation (builder open editing it). */
  var presstrip=document.getElementById('presstrip');
  var FOLDKEY='sempresfold:'+SCOPE;
  var FOLDERSKEY='sempresfolders:'+SCOPE;
  function foldState(){
    try{return JSON.parse(lsGet(FOLDKEY)||'{}');}catch(e){return {};}
  }
  function toggleFold(f){
    var s=foldState();
    if(s[f]) delete s[f]; else s[f]=1;
    lsSet(FOLDKEY,JSON.stringify(s));
    renderPresTabs();
  }
  /* folders exist on their own (created empty, dragged into) */
  function explicitFolders(){
    try{
      var l=JSON.parse(lsGet(FOLDERSKEY)||'[]');
      return Array.isArray(l)?l:[];
    }catch(e){return [];}
  }
  function saveFolders(list){lsSet(FOLDERSKEY,JSON.stringify(list));}
  /* move ANY presentation (current, saved, draft, embedded) */
  function setPresFolder(nm,folder){
    var f=(folder||'').trim();
    function apply(p){
      if(f) p.folder=f; else delete p.folder;
    }
    if(nm===pres.name){apply(pres);markDirty();renderPresRow();return;}
    var hit=false;
    projectPres.forEach(function(p){
      if(p.name===nm){apply(p);hit=true;}});
    nbPres.forEach(function(p){
      if(p.name===nm){apply(p);hit=true;}});
    var raw=lsGet(PFX+nm);
    if(raw){
      try{
        var d=JSON.parse(raw);apply(d);
        lsSet(PFX+nm,JSON.stringify(d));hit=true;
      }catch(e){}
    }
    if(hit&&APP.mode==='app') scheduleAutosave();
    renderPresTabs();
  }
  function newFolder(){
    var list=explicitFolders();
    var n=1,name='folder';
    function taken(x){
      return list.indexOf(x)>=0
        ||allSaved().some(function(p){return p.folder===x;});
    }
    while(taken(name)){n++;name='folder-'+n;}
    list.push(name);saveFolders(list);
    renderPresTabs();
    var h=presstrip.querySelector(
      '.pr-folder[data-folder="'+name+'"]');
    if(h) startFolderRename(h,name);
  }
  function renameFolder(oldName,newName){
    newName=(newName||'').trim();
    if(!newName||newName===oldName) return;
    var list=explicitFolders().map(function(x){
      return x===oldName?newName:x;});
    if(list.indexOf(newName)<0) list.push(newName);
    saveFolders(list.filter(function(x,i){
      return list.indexOf(x)===i;}));
    var st=foldState();
    if(st[oldName]){delete st[oldName];st[newName]=1;
      lsSet(FOLDKEY,JSON.stringify(st));}
    allSaved().concat([pres]).forEach(function(p){
      if(p.folder===oldName) setPresFolder(p.name,newName);
    });
    draftNames().forEach(function(nm){
      var d=loadDraft(nm);
      if(d&&d.folder===oldName) setPresFolder(nm,newName);
    });
    renderPresTabs();
  }
  function deleteFolder(f){
    saveFolders(explicitFolders().filter(function(x){return x!==f;}));
    allSaved().concat([pres]).forEach(function(p){
      if(p.folder===f) setPresFolder(p.name,'');
    });
    draftNames().forEach(function(nm){
      var d=loadDraft(nm);
      if(d&&d.folder===f) setPresFolder(nm,'');
    });
    renderPresTabs();
  }
  function startFolderRename(header,f){
    var t=header.querySelector('.pr-t');
    if(!t) return;
    var inp=document.createElement('input');
    inp.className='pr-frename';
    inp.value=f;inp.spellcheck=false;
    t.replaceWith(inp);
    inp.focus();inp.select();
    function commit(){
      var v=inp.value.trim();
      if(v&&v!==f) renameFolder(f,v);
      else renderPresTabs();
    }
    inp.addEventListener('keydown',function(e){
      e.stopPropagation();
      if(e.key==='Enter') this.blur();
      if(e.key==='Escape'){this.value=f;this.blur();}
    });
    inp.addEventListener('blur',commit);
    inp.addEventListener('click',function(e){e.stopPropagation();});
  }
  function renderPresTabs(){
    if(!presstrip) return;
    /* the rail's filter is re-applied at the end of this: the strip is
       rebuilt from scratch here, so it arrives unfiltered and a deck
       created while a filter is live would otherwise appear out of
       nowhere in a list that is meant to be showing only matches (T75) */
    presstrip.innerHTML='';
    var savedList=allSaved();
    var savedNames=savedList.map(function(p){return p.name;});
    var byName={};
    savedList.forEach(function(p){byName[p.name]=p;});
    var names=savedNames.slice();
    /* drafts stay listed even while another presentation is open */
    draftNames().forEach(function(n){
      if(names.indexOf(n)<0){
        names.push(n);
        byName[n]=loadDraft(n)||{name:n};
      }
    });
    if(names.indexOf(pres.name)<0) names.unshift(pres.name);
    byName[pres.name]=pres;   /* in-memory version wins (live folder) */
    var editing=!deckEl.hidden;

    function presItem(nm,folder){
      var isCur=nm===pres.name;
      var t=document.createElement('button');
      /* radio model: a row lights up ONLY while its deck is open — back on
         the notebook view, no presentation stays highlighted */
      t.className='pr-item ptab'+(isCur&&editing?' current editing':'')
        +(savedNames.indexOf(nm)<0?' draftonly':'');
      t.setAttribute('role','tab');
      t.dataset.pres=nm;
      t.dataset.folder=folder||'';
      var isPoster=/^a\d/.test(String((byName[nm]&&byName[nm].page)||''));
      var isView=isViewPres(byName[nm]);
      /* a custom view lights up while ITS styling bar is open, not while
         the slide stage is (it never opens the slide stage) */
      var vwOpen=isView&&isCur
        &&document.body.classList.contains('styling');
      if(vwOpen) t.className+=' current editing';
      var kindWord=isView?'custom view':isPoster?'poster':'presentation';
      t.title=((isCur&&(editing||vwOpen))
        ?('Editing "'+nm+'" — click Notebooks (top left) to go back')
        :('Open '+kindWord+' "'+nm+'"'
          +(isView?' — restyles the notebook itself':' in the builder')))
        +'\nDrag onto a folder to file it';
      /* the same drawn icons as the "+ New ..." buttons, so a row and the
         button that made it read as the same kind of thing — straight
         from SemIcons, where the "+ New" template tokens also resolve */
      t.innerHTML='<span class="pr-ico">'
        +bic(isView?'newview':isPoster?'newposter':'newdeck')
        +'</span>';
      var lbl=document.createElement('span');lbl.className='pr-t';
      lbl.textContent=nm||'(unnamed)';
      t.appendChild(lbl);
      /* delete where the thing IS, not three menu levels away. Shown on
         hover / while current; confirm() because there is no undo for a
         deleted presentation. */
      /* a real <button>, not a click-wired span: focusable, and named
         for screen readers — the icon is its only visible content
         (2026-08-24). .pr-del's CSS resets the button chrome. */
      var del=document.createElement('button');
      del.type='button';
      del.className='pr-del';del.title='Delete "'+nm+'"';
      del.setAttribute('aria-label','Delete "'+nm+'"');
      del.innerHTML=bic('exit')||'&#10005;';
      del.addEventListener('click',function(e){
        e.stopPropagation();e.preventDefault();
        if(confirm('Delete "'+nm+'"? This cannot be undone.'))
          deletePresByName(nm);
      });
      t.appendChild(del);
      t.draggable=true;
      t.addEventListener('dragstart',function(e){
        draggingPres=nm;
        t.classList.add('dragging');
        try{e.dataTransfer.setData('text/plain',nm);}catch(err){}
        e.dataTransfer.effectAllowed='move';
      });
      t.addEventListener('dragend',function(){
        draggingPres=null;
        t.classList.remove('dragging');
        clearDropMarks();
      });
      t.addEventListener('click',function(){
        if(isCur&&!deckEl.hidden) return;
        if(vwOpen) return;            /* already the open custom view */
        choosePresentation(nm);
      });
      return t;
    }

    /* group by folder; loose items first, then collapsible folders
       (explicitly created folders show even while empty) */
    var rootNames=[],folders={},folderOrder=[];
    explicitFolders().forEach(function(f){
      folders[f]=[];folderOrder.push(f);
    });
    names.forEach(function(nm){
      var f=(byName[nm]&&byName[nm].folder)||'';
      if(!f){rootNames.push(nm);return;}
      if(!folders[f]){folders[f]=[];folderOrder.push(f);}
      folders[f].push(nm);
    });
    rootNames.forEach(function(nm){
      presstrip.appendChild(presItem(nm,''));});
    folderOrder.sort().forEach(function(f){
      var collapsed=!!foldState()[f]
        &&!(editing&&folders[f].indexOf(pres.name)>=0);
      var h=document.createElement('div');
      h.className='pr-folder';
      h.dataset.folder=f;
      h.title='Folder "'+f+'" — click to '
        +(collapsed?'expand':'collapse')
        +'; drag presentations onto it';
      h.innerHTML='<span class="pr-fchev">'
        +(collapsed?'&#9656;':'&#9662;')+'</span>'
        +'<span class="pr-fico">'+bic('open')+'</span>';
      var ft=document.createElement('span');ft.className='pr-t';
      ft.textContent=f;h.appendChild(ft);
      var fc=document.createElement('span');fc.className='pr-fcount';
      fc.textContent=folders[f].length;h.appendChild(fc);
      var ctr=document.createElement('span');ctr.className='pr-fctrl';
      [[bic('pen'),'Rename folder',function(){startFolderRename(h,f);}],
       [bic('exit'),'Delete folder (contents move out)',
        function(){deleteFolder(f);}]].forEach(function(b){
        var btn=document.createElement('button');
        btn.innerHTML=b[0];btn.title=b[1];
        btn.addEventListener('click',function(e){
          e.stopPropagation();b[2]();});
        ctr.appendChild(btn);
      });
      h.appendChild(ctr);
      h.addEventListener('click',function(){toggleFold(f);});
      presstrip.appendChild(h);
      if(!collapsed) folders[f].forEach(function(nm){
        var it=presItem(nm,f);
        it.classList.add('infolder');
        presstrip.appendChild(it);
      });
    });
    var docsBtn=document.getElementById('pr-docs');
    if(docsBtn) docsBtn.classList.toggle('current',!editing);
    /* ...and re-applied, now the rows are back (T75) */
    var A2=window.SemApp;
    if(A2&&typeof A2.railFilter==='function') A2.railFilter();
  }
  /* drag & drop filing: onto a folder header (or an item inside one)
     files it; onto empty rail space moves it back to the top level */
  var draggingPres=null;
  function clearDropMarks(){
    $$('.pr-folder.dropping',presstrip).forEach(function(el){
      el.classList.remove('dropping');});
    var rail=document.getElementById('presrail');
    if(rail) rail.classList.remove('dropping-root');
  }
  (function(){
    var rail=document.getElementById('presrail');
    if(!rail) return;
    rail.addEventListener('dragover',function(e){
      if(!draggingPres) return;
      e.preventDefault();
      e.dataTransfer.dropEffect='move';
      clearDropMarks();
      var h=e.target.closest&&e.target.closest('.pr-folder');
      if(!h){
        var it=e.target.closest&&e.target.closest('.pr-item.ptab');
        if(it&&it.dataset.folder)
          h=presstrip.querySelector(
            '.pr-folder[data-folder="'+it.dataset.folder+'"]');
      }
      if(h) h.classList.add('dropping');
      else rail.classList.add('dropping-root');
    });
    rail.addEventListener('dragleave',function(e){
      if(e.target===rail) clearDropMarks();
    });
    rail.addEventListener('drop',function(e){
      if(!draggingPres) return;
      e.preventDefault();
      var f='';
      var h=e.target.closest&&e.target.closest('.pr-folder');
      if(h) f=h.dataset.folder;
      else{
        var it=e.target.closest&&e.target.closest('.pr-item.ptab');
        if(it) f=it.dataset.folder||'';
      }
      var nm=draggingPres;
      draggingPres=null;
      clearDropMarks();
      setPresFolder(nm,f);
    });
  })();
  var newFoldBtn=document.getElementById('pr-newfold');
  if(newFoldBtn) newFoldBtn.addEventListener('click',newFolder);
  function choosePresentation(nm){
    var A=window.SemApp||{};
    if(nm!==pres.name){
      if(A.exitStyling) A.exitStyling();   /* leave any open custom view */
      lsSet(PFX+'last',nm);
      loadPresentation(nm);
      cur=0;activePane=-1;
    }
    /* a custom view is edited in the document; a deck on the slide stage */
    if(isViewPres(pres)){openCustomView();return;}
    openDeck('edit');   /* land straight in the slide editor */
  }
  function newPresentation(){
    var n2=1,name='presentation';
    while(savedByName(name)||loadDraft(name)){
      n2++;name='presentation-'+n2;}
    /* deliberately NOT persisted yet: a new presentation only starts
       saving (draft + autosave) once you actually edit it, so clicking
       "New" never litters the project with empty decks */
    pres={name:name,slides:[emptySlide()]};
    source='auto';
    cur=0;activePane=0;
    openDeck('edit');   /* land straight in the slide editor */
  }
  /* ---- CUSTOM VIEW: a third kind of saved thing (2026-07-29) ---------
     Not slides. A custom view remembers how the NOTEBOOK looks: the
     styling of its markdown cells and headings, plus the whole filter /
     hidden-cell / figure-size state. It opens in the document, not on the
     slide stage, so the styling bar edits what you are looking at. ---- */
  function isViewPres(p){return !!(p&&p.kind==='view');}
  /* rail row icons come from SemIcons (newdeck/newposter/newview) in
     presItem — the RAIL_ICO copy of that path data was deleted
     2026-08-23 so branding.py stays the only place artwork lives */
  function newCustomView(){
    var A=window.SemApp||{};
    var stem=A.active;
    if(!stem||!A.enterStyling){
      toast('Open a notebook first — a custom view restyles a notebook');
      return;
    }
    var n2=1,name='custom view';
    while(savedByName(name)||loadDraft(name)){
      n2++;name='custom view '+n2;}
    /* seeded from what you are looking at right now, so a new view never
       throws away the filters you already set up */
    pres={name:name,kind:'view',nb:stem,style:{},
          view:(A.layoutSnapshot&&A.layoutSnapshot(stem))||{}};
    source='auto';
    cur=0;activePane=-1;
    openCustomView();
  }
  function openCustomView(){
    var A=window.SemApp||{};
    closeDeck();                     /* the document, not the slide stage */
    if(pres.nb&&A.shells&&A.shells[pres.nb]&&A.activate)
      A.activate(pres.nb);
    if(pres.view&&A.applySnapshot)
      A.applySnapshot(pres.nb||A.active,pres.view);
    A.enterStyling(pres,function(){markDirty();});
    renderPresTabs();
    status();
  }
  function closeCustomView(){
    var A=window.SemApp||{};
    if(A.exitStyling) A.exitStyling();
    renderPresTabs();
  }
  window.SemApp.viewClose=closeCustomView;
  function newPoster(){
    var n2=1,name='poster';
    while(savedByName(name)||loadDraft(name)){
      n2++;name='poster-'+n2;}
    /* like a new presentation, nothing persists until the first edit.
       Posters start WHITE: they exist to be printed (2026-08-04) */
    var s=emptySlide();
    /* BLANK, not pre-filled: the 3-column academic template used to be
       applied here, so a new poster opened already covered in headings
       and placeholder frames you had to clear before starting your own
       (2026-08-18, user: "opening a poster should open as blank not a
       default fill"). The templates are all still one click away in
       Layouts — which is where choosing one belongs. Even the blank
       slide's full-page ghost frame goes: on a deck it is the "click to
       fill" idiom, but stretched over an A0 sheet it is one more thing
       you did not put there. */
    s.annots=[];
    pres={name:name,slides:[s],page:'a0p',pageBg:'#ffffff'};
    source='auto';
    cur=0;activePane=-1;
    openDeck('edit');
  }

  function renderPresRow(){
    var lbl=$('#pres-current');
    if(lbl) lbl.textContent=pres.name||'(unnamed)';
    var inp=$('#pres-name');
    if(document.activeElement!==inp&&inp.value!==pres.name)
      inp.value=pres.name;
    renderPresTabs();
  }
  function renderControls(){
    updateNumsLabel();updateCropLabel();
    var s=pres.slides[cur];
    $$('#layout-row .lay,#layout-menu-grid .lay,#layout-strip .lay')
      .forEach(function(b){
      /* highlight the template last applied to this slide (if any) */
      b.setAttribute('aria-pressed',
        (!!s&&s.lay===b.dataset.lay).toString());
      b.disabled=!s;
    });
    var te=$('#title-editor'), eb=$('#dc-edit');
    var isTitle=!!s&&s.layout==='title';
    if(te){
      te.hidden=!isTitle;
      if(isTitle){
        var ti=$('#ts-title'),su=$('#ts-sub');
        if(ti&&document.activeElement!==ti) ti.value=s.title||'';
        if(su&&document.activeElement!==su) su.value=s.sub||'';
      }
    }
    if(eb){
      eb.disabled=!s;
      /* Only "get me into the editor" survives. Going the other way is
         already the Notebooks button on the rail, and this duplicate was
         badly named and awkwardly placed in the bargain (2026-08-07,
         user: "the 'swap to notebooks' button is a stupid name and in a
         stupid place"). */
      eb.hidden=(mode==='edit');
      eb.innerHTML=bic('pen')+' Open the editor';
    }
  }
  /* the current slide's interactive frame editor — embedded inline as
     the big view in the merged slides list (one view, not two) */
  function buildSlideEditor(s){
    var ed=document.createElement('div');
    ed.className='pane-editor freeform';ed.id='pane-editor';
    if(!s){
      ed.innerHTML='<div class="pane empty">'
        +'<span class="pane-t">no slide</span></div>';
      return ed;
    }
    var cells=slideCells(s);
    if(!cells.length){
      ed.innerHTML='<div class="pane empty"><span class="pane-t">'
        +'pick a layout above, or click a card in the document'
        +'</span></div>';
      return ed;
    }
    cells.forEach(function(pair){
      var a=pair.a, ai=pair.i;
      var it=a.ref?resolveRef(a.ref):null;
      var p=document.createElement('div');
      p.className='pane slot'+(it?' filled':' empty')
        +(ai===activePane?' active':'');
      var ap7=anchorPos(a,a.w,a.h);
      p.style.left=ap7.x+'%';p.style.top=ap7.y+'%';
      p.style.width=(a.w||10)+'%';p.style.height=(a.h||10)+'%';
      if(it){
        /* render the frame EXACTLY as it appears on the slide: the real
           card content for the chosen part (code / figure / output) */
        var frame=document.createElement('div');frame.className='an-cell';
        var ch=document.createElement('div');ch.className='an-cellhead';
        var chT=document.createElement('span');
        chT.className='an-cellhead-t';chT.textContent=it.title;
        ch.appendChild(chT);
        var pt0=partOf(a),facs0=facetList(it.ns);
        if(facs0.length>1||pt0==='code'){
          var pl=document.createElement('span');
          pl.className='an-cellpart';pl.textContent=pt0;
          ch.appendChild(pl);
        }
        if(multiNb()) ch.appendChild(nbChip('spane-nb',it.nb));
        frame.appendChild(ch);
        var b=framePart(it.ns,a.part);
        if(b){if(a.ts) b.style.zoom=a.ts;applyCrop(b,a);frame.appendChild(b);}
        applyCellColor(frame,a);
        p.title=it.nb+' — '+it.title;
        p.appendChild(frame);
        var pc=buildPartChooser(s,ai);
        if(pc) p.appendChild(pc);
      } else {
        var t=document.createElement('span');t.className='pane-t';
        t.textContent=a.ref?('missing: '+a.ref)
          :(ai===activePane?'▸ now click a card in the notebook'
            :'empty — click to select this frame');
        p.appendChild(t);
      }
      if(a.ref){
        var x=document.createElement('button');x.className='pane-x';
        x.innerHTML=bic('exit')||'&#10005;';x.title='Clear this frame';
        x.addEventListener('click',function(e){e.stopPropagation();
          a.ref=null;activePane=ai;markDirty();refresh();});
        p.appendChild(x);
      }
      p.addEventListener('click',function(e){
        e.stopPropagation();activePane=ai;refresh();});
      ed.appendChild(p);
    });
    return ed;
  }
  function paneImgSrc(ref){
    var card=ref?(cardEl(ref)||embBody(ref)):null;
    var img=card?$('.figframe img',card):null;
    return img?img.getAttribute('src'):null;
  }
  function paneThumb(ref){
    var w=document.createElement('span');w.className='mini-pane';
    var it=ref?resolveRef(ref):null;
    if(!it){w.className+=' empty';return w;}
    var src=paneImgSrc(ref);
    if(src){
      var m=document.createElement('img');
      m.src=src;m.alt='';m.loading='lazy';
      m.setAttribute('aria-hidden','true');   /* decorative (T105) */
      w.appendChild(m);
    } else if(it.kind==='note'){
      w.className+=' is-note';
    } else if(it.kind==='figure'||it.kind==='diagnostic'){
      w.className+=' is-fig';
    } else {
      w.className+=' is-code';
      w.textContent='</>';
    }
    return w;
  }
  /* ---- slide thumbnails ------------------------------------------------
     A thumbnail is a SCALE MODEL of the slide, not a picture of the
     notebook cells on it. It used to walk slideCells() and nothing else,
     so a slide made of text, arrows, shapes or images showed as an empty
     box and every such slide in the strip looked identical (2026-08-20,
     user: "thumbnails do now show text, or anything else for that matter,
     just the cells").
     Everything is placed in the same page percentages the canvas uses, so
     positions are exactly right at any size. Two things cannot scale
     linearly and get a floor instead — type and stroke width — because
     0.3px of either is nothing at all. That is the opposite of the rule
     fontPx follows on the real page, and deliberately: the page is the
     document and must stay true to itself, a thumbnail is an INDEX and
     has to be legible. */
  var MINI_H=66;      /* mirrors --mini-h in deck.css */
  /* MINI_H is the FLOOR now, not the height: the column is draggable, so
     a thumbnail grows with the room it is given and its type and strokes
     have to grow with it or a 460px strip draws 3px lettering
     (2026-08-22). Measured off the LIST rather than off a thumbnail —
     renderFilm sizes type before the node is in the document, and an
     unattached node has no height to read. Computed once per render, not
     once per item. */
  var MINI_AR=116/66,miniHNow=MINI_H;
  function miniH(){
    var l=$('#film-list');
    var w=l?l.clientWidth:0;
    if(!w) return MINI_H;
    /* the padding and the row's own gutters the CSS spends before the
       thumbnail gets the rest */
    return Math.max(MINI_H,Math.round((w-46)/MINI_AR));
  }
  /* svg ids (gradients) must be unique across every thumbnail in the
     strip, not just within one — a repeated id would silently paint every
     later slide's gradient with the first slide's */
  var miniSeq=0;
  function miniText(d,a,txt,cls,centred){
    if(!String(txt||'').trim()) return;
    var t=document.createElement('span');
    t.className='mini-tx'+(cls?' '+cls:'');
    t.style.left=(a.x||0)+'%';t.style.top=(a.y||0)+'%';
    if(a.w!=null) t.style.width=a.w+'%';
    t.style.fontSize=Math.max(2,miniHNow*(a.size||2.6)/100).toFixed(2)+'px';
    if(a.color) t.style.color=tokVal(a.color);
    if(a.b) t.style.fontWeight='700';
    if(a.i) t.style.fontStyle='italic';
    if(a.align) t.style.textAlign=a.align;
    if(a.font) t.style.fontFamily=fontCss(a.font);
    if(a.bg!==0&&a.bgc) t.style.background=tokVal(a.bgc);
    /* a title is anchored on its CENTRE, the way the canvas anchors it */
    var tr=centred?'translate(-50%,-50%)':'';
    if(a.rot) tr+=(tr?' ':'')+'rotate('+a.rot+'deg)';
    if(tr) t.style.transform=tr;
    if(a.op!=null&&a.op<1) t.style.opacity=a.op;
    t.textContent=String(txt);
    d.appendChild(t);
  }
  /* a box-shaped item (shape, image, cell frame) at its page rect */
  function miniBox(d,a,cls){
    var b=document.createElement('span');
    b.className='mini-it'+(cls?' '+cls:'');
    b.style.left=(a.x||0)+'%';b.style.top=(a.y||0)+'%';
    b.style.width=(a.w||10)+'%';b.style.height=(a.h||10)+'%';
    if(a.rot) b.style.transform='rotate('+a.rot+'deg)';
    if(a.op!=null&&a.op<1) b.style.opacity=a.op;
    d.appendChild(b);
    return b;
  }
  /* the stroke a thumbnail draws: the page weight scaled down, floored so
     a hairline is still a line */
  function miniSw(a){
    return Math.max(0.6,swOf(a)*miniHNow/SW_REF_H).toFixed(2);
  }
  /* re-weight a borrowed shape/freehand svg for thumbnail scale, and drop
     its dash: dashes are measured in the stroke's own units, so a pattern
     sized for an A0 poster is one long dash across a 116px thumbnail */
  function miniStroke(host,a){
    var p=host.querySelector('path'); if(!p) return;
    p.setAttribute('stroke-width',miniSw(a));
    p.removeAttribute('stroke-dasharray');
  }
  /* ---- THE DESIGN SURFACE (T87, 2026-08-29) ---------------------------
     "Where was the button where people can 'standardise presentation'...
     controlling things like 'global heading layouts'... Then it would be
     cool if you could also 'show outlines of all objects'."

     Three quarters of this was already built and scattered: the style
     registry (pres.styles) decides what a Heading looks like, the
     Standardise pane finds type that has drifted from it, the Apply
     dialog pushes a look across a deck, and T5's selection criteria find
     every box of a kind. What was missing was a PLACE -- one screen that
     puts a deck's type in front of you and lets you change it -- plus
     two things that did not exist at all: a default POSITION for a named
     type, and a way to see every object on every slide as an outline.

     Built on what is there, deliberately:
       * it writes pres.styles, the same registry styleDef reads, so a
         change here is the same change the Styles menu makes;
       * it re-stamps through applyStyleTo, the one function that puts a
         style onto a box, rather than writing size/weight/colour itself;
       * the outline sheet is miniDiagram, the renderer the film strip
         and the overview map already use.
     And it is NOT a second Apply dialog. Apply answers "which slides,
     which properties, which type"; this answers "what does a Heading
     look like in this deck". Position is the one thing here that Apply
     cannot express, and it is a button you press, never something
     applyStyleTo does on your behalf -- a style stamp that yanked boxes
     across the page would be unusable. */
  var dgSel='title', dgOutline=false;
  /* the smallest a drag proxy in the outline sheet may be, in page
     percent. A horizontal or vertical line's bounding box is
     zero-thickness and there is nothing to grab; the canvas answers the
     same question with a 12px tolerance round the segment (arrowAt).
     6% of a 116x66px miniature is ~7x4px, and the fallback box proxy
     below is already only 8% tall, so this is no outlier. */
  var DG_HIT=6;
  /* WHICH SLIDES (T130). The put gesture was all-wearers-everywhere and
     the outline sheet was every-slide-always; the ask named sections
     and ranges for both. One selector builder, two independent scopes,
     because "move the headings in section 2" and "show me outlines of
     slides 4-9" are different questions asked at different moments. */
  var dgPutScope={kind:'all'}, dgSheetScope={kind:'all'};
  function dgInScope(sc,si){
    if(!sc||sc.kind==='all') return true;
    if(sc.kind==='sec')
      return ((pres.slides||[])[si]||{}).sec===sc.sec;
    return (si+1)>=sc.from&&(si+1)<=sc.to;
  }
  function dgScopeLabel(sc){
    if(!sc||sc.kind==='all') return 'on every slide';
    if(sc.kind==='sec'){
      var meta=(pres.sections||{})[sc.sec];
      return 'in \u00a7'+((meta&&meta.name)||'section');
    }
    return 'slides '+sc.from+'\u2013'+sc.to;
  }
  /* a typed range, made safe (JVR-05). SORT FIRST, then clamp BOTH
     ends: clamping the first endpoint only upward and the second only
     downward and swapping afterwards let a reversed out-of-range input
     like 999-1 store from=1,to=999 on a twelve-slide deck. dgInScope
     compares against real slide numbers, so the SELECTION was never
     wrong -- but dgScopeLabel is the only place a user can read back
     which slides are in scope, and it read those numbers out. An empty
     deck yields 1..1 rather than the degenerate 1..0. */
  function dgRange(a,b,total){
    var last=Math.max(1,total);
    function fit(n){return Math.min(last,Math.max(1,n));}
    return {from:fit(Math.min(a,b)),to:fit(Math.max(a,b))};
  }
  function dgScopeSelect(sc,onchange){
    var sel=document.createElement('select');
    sel.className='dg-scope';
    sel.title='Which slides this applies to';
    function opt(v,label){
      var o=document.createElement('option');
      o.value=v;o.textContent=label;sel.appendChild(o);return o;
    }
    opt('all','on every slide');
    /* only sections actually in use: an empty registry entry is not a
       place a slide can be */
    var used={};
    (pres.slides||[]).forEach(function(sl){
      if(sl&&sl.sec) used[sl.sec]=1;});
    Object.keys(used).forEach(function(id){
      var meta=(pres.sections||{})[id];
      opt('sec:'+id,'in \u00a7'+((meta&&meta.name)||'section'));
    });
    opt('range','slides\u2026');
    sel.value=sc.kind==='all'?'all'
      :sc.kind==='sec'?('sec:'+sc.sec):'range';
    sel.addEventListener('change',function(){
      var v=sel.value;
      if(v==='all'){sc.kind='all';}
      else if(v.indexOf('sec:')===0){sc.kind='sec';sc.sec=v.slice(4);}
      else {
        var total=(pres.slides||[]).length;
        var got=prompt('Which slides? Like 4-9, or one number.',
          '1-'+total);
        var mm=got&&got.match(/^\s*(\d+)\s*(?:[-\u2013]\s*(\d+))?\s*$/);
        if(!mm){sel.value=sc.kind==='all'?'all'
          :sc.kind==='sec'?('sec:'+sc.sec):'range';return;}
        sc.kind='range';
        var r=dgRange(parseInt(mm[1],10),
          parseInt(mm[2]||mm[1],10),total);
        sc.from=r.from;sc.to=r.to;
      }
      onchange();
    });
    return sel;
  }
  /* re-render the body WITHOUT losing where you were in it: a drop in
     the sheet redraws everything, and snapping back to the top of a
     long panel would make a second drag a scroll hunt (T130) */
  function dgBodyKeep(ov){
    var b=ov&&ov.querySelector('#dg-body');
    var at=b?b.scrollTop:0;
    dgBody(ov);
    b=ov&&ov.querySelector('#dg-body');
    if(b) b.scrollTop=at;
  }

  function dgStyleRec(id){
    var st=deckStyles();
    if(!st[id]) st[id]={};
    return st[id];
  }
  /* every box wearing a named type, as {s, i, a} across the whole deck */
  function dgWearers(id){
    var out=[];
    (pres.slides||[]).forEach(function(sl,si){
      (sl.annots||[]).forEach(function(a,ai){
        if(a&&a.k==='text'&&a.style===id) out.push({s:si,i:ai,a:a});});
    });
    return out;
  }
  /* re-stamp the registry onto everything wearing it. THE point of a
     standardise surface: a definition nobody is wearing is a preference,
     not a standard. */
  function dgRestamp(id){
    var n=0;
    dgWearers(id).forEach(function(w){applyStyleTo(w.a,id);n++;});
    return n;
  }
  function dgClose(){
    var ov=$('#deck-design');
    if(ov) ov.remove();
    document.removeEventListener('keydown',dgKey,true);
  }
  function dgKey(e){
    if(!$('#deck-design')) return;
    if(e.key==='Escape'){
      e.preventDefault();e.stopPropagation();dgClose();}
  }
  function dgSpecimen(el,id){
    var d=styleDef(id); if(!d) return;
    el.style.fontWeight=d.b?'700':'400';
    el.style.fontStyle=d.i?'italic':'normal';
    el.style.fontFamily=d.font?fontCss(d.font):'';
    el.style.color=d.color?tokVal(d.color):'';
    /* the LADDER has to read as a ladder, so sizes are shown in
       proportion to each other rather than at their page size -- 7.2% of
       an A0 sheet does not fit in a rail */
    el.style.fontSize=(11+(d.size||2.6)*1.9)+'px';
  }
  function dgRail(ov){
    var rail=ov.querySelector('#dg-list');
    rail.innerHTML='';
    styleOrder().forEach(function(id){
      var d=styleDef(id); if(!d) return;
      var b=document.createElement('button');
      b.className='dg-row'+(id===dgSel?' on':'');
      var nm=document.createElement('span');
      nm.className='dg-name';nm.textContent=d.label||id;
      dgSpecimen(nm,id);
      /* the rail is chrome, not a slide: the style's own colour could be
         the page's ink and vanish here (2026-09-03, "a lot of the text
         can't be read"); weight, italic and size still draw the ladder */
      nm.style.color='';
      var ct=document.createElement('span');
      ct.className='dg-count';
      var n=dgWearers(id).length;
      ct.textContent=n?(n+' box'+(n===1?'':'es')):'unused';
      b.appendChild(nm);b.appendChild(ct);
      b.title=(d.label||id)+' — '+(d.size||2.6)+'% of the page height'
        +(n?(', worn by '+n+' box'+(n===1?'':'es')):', not used yet');
      b.addEventListener('click',function(){
        dgSel=id;dgRail(ov);dgBody(ov);});
      rail.appendChild(b);
    });
  }
  /* ---- the board: where a named type SITS by default ------------------
     The one genuinely new idea. A style has always said how a Heading
     looks and never where it goes, so "global heading layouts" could not
     be expressed at all. x/y/w live on the same pres.styles record, so
     no new deck key and no new documentation: `styles` is already "this
     deck's overrides of the named text types". */
  function dgBoard(host,id){
    var rec=dgStyleRec(id);
    var board=document.createElement('div');
    board.className='dg-board';
    var page=pageOf();
    board.style.aspectRatio=(page.mm[0]/page.mm[1]).toFixed(4);
    var ghost=document.createElement('div');
    ghost.className='dg-ghost';
    function paint(){
      ghost.style.left=(rec.x!=null?rec.x:8)+'%';
      ghost.style.top=(rec.y!=null?rec.y:6)+'%';
      ghost.style.width=(rec.w!=null?rec.w:60)+'%';
    }
    var lab=document.createElement('span');
    lab.className='dg-ghostlab';
    lab.textContent=(styleDef(id)||{}).label||id;
    dgSpecimen(lab,id);
    ghost.appendChild(lab);
    var grip=document.createElement('span');
    grip.className='dg-ghostgrip';
    grip.title='Drag to set how wide this type is by default';
    ghost.appendChild(grip);
    paint();
    board.appendChild(ghost);
    host.appendChild(board);

    function drag(ev,mode){
      ev.preventDefault();ev.stopPropagation();
      var r=board.getBoundingClientRect();
      var x0=ev.clientX,y0=ev.clientY;
      var sx=(rec.x!=null?rec.x:8),sy=(rec.y!=null?rec.y:6);
      var sw=(rec.w!=null?rec.w:60);
      function mv(e2){
        var dx=(e2.clientX-x0)/(r.width||1)*100;
        var dy=(e2.clientY-y0)/(r.height||1)*100;
        if(mode==='w') rec.w=Math.max(6,Math.min(100,Math.round(sw+dx)));
        else {
          rec.x=Math.max(0,Math.min(98,Math.round(sx+dx)));
          rec.y=Math.max(0,Math.min(98,Math.round(sy+dy)));
        }
        paint();
      }
      function up(){
        document.removeEventListener('pointermove',mv);
        document.removeEventListener('pointerup',up);
        markDirty();dgBody($('#deck-design'));
      }
      document.addEventListener('pointermove',mv);
      document.addEventListener('pointerup',up);
    }
    ghost.addEventListener('pointerdown',function(e){drag(e,'xy');});
    grip.addEventListener('pointerdown',function(e){drag(e,'w');});
  }
  function dgSectionHead(host,text,sub){
    var h=document.createElement('div');
    h.className='dg-h';h.textContent=text;
    host.appendChild(h);
    if(sub){
      var p=document.createElement('p');
      p.className='dg-sub';p.textContent=sub;
      host.appendChild(p);
    }
  }
  function dgBody(ov){
    if(!ov) return;
    var body=ov.querySelector('#dg-body');
    body.innerHTML='';
    var id=dgSel,d=styleDef(id);
    if(!d){body.innerHTML='<div class="selpane-empty">Pick a type on '
      +'the left.</div>';return;}
    var rec=dgStyleRec(id);
    var wear=dgWearers(id);

    /* ---- how it looks ---- */
    dgSectionHead(body,'How “'+(d.label||id)+'” looks',
      'Changing it here changes every box wearing it, everywhere in the '
      +'deck. That is what makes it a standard rather than a preference.');
    var spec=document.createElement('div');
    spec.className='dg-spec';
    spec.textContent='The quick brown fox jumps over the lazy dog';
    dgSpecimen(spec,id);
    /* on the deck's actual page colour, so a specimen reads the way the
       slide will */
    spec.style.background=tokVal((pres&&pres.pageBg)||'#0b141d');
    if(!d.color) spec.style.color=tokVal('@ink');
    body.appendChild(spec);

    var row=document.createElement('div');row.className='dg-ctrls';
    function ctl(label,title,on,fn){
      var b=document.createElement('button');
      b.className='dbtn dg-b';b.textContent=label;b.title=title;
      if(on!=null) b.setAttribute('aria-pressed',on?'true':'false');
      b.addEventListener('click',function(){
        fn();markDirty();dgRestamp(id);refresh();dgRail(ov);dgBody(ov);});
      row.appendChild(b);
      return b;
    }
    ctl('−','Smaller',null,function(){
      rec.size=Math.max(0.6,Math.round(((d.size||2.6)-0.2)*10)/10);});
    var sz=document.createElement('span');
    sz.className='dg-size';
    sz.textContent=(d.size||2.6).toFixed(1)+'%';
    sz.title='The type size, as a percentage of the page height — so it '
      +'means the same thing on a 16:9 slide and an A0 poster';
    row.appendChild(sz);
    ctl('+','Bigger',null,function(){
      rec.size=Math.min(30,Math.round(((d.size||2.6)+0.2)*10)/10);});
    ctl('B','Bold',!!d.b,function(){
      if(d.b) rec.b=0; else rec.b=1;});
    ctl('I','Italic',!!d.i,function(){
      if(d.i) rec.i=0; else rec.i=1;});
    ['left','center','right'].forEach(function(al){
      ctl(al==='left'?'←':al==='right'?'→':'↔',
        'Align '+al,(d.align||'left')===al,function(){rec.align=al;});
    });
    var col=document.createElement('input');
    col.type='color';col.className='dg-col';
    col.value=(d.color&&/^#/.test(d.color))?d.color:'#e6eef5';
    col.title='The colour every box of this type takes';
    col.addEventListener('input',function(){
      rec.color=col.value;markDirty();dgRestamp(id);refresh();});
    col.addEventListener('change',function(){dgRail(ov);dgBody(ov);});
    row.appendChild(col);
    var rst=document.createElement('button');
    rst.className='dbtn dg-b';rst.textContent='Reset';
    rst.title='Back to this type’s built-in look';
    rst.addEventListener('click',function(){
      var st=deckStyles();
      var keep={};
      ['x','y','w'].forEach(function(k){
        if(st[id]&&st[id][k]!=null) keep[k]=st[id][k];});
      st[id]=keep;
      markDirty();dgRestamp(id);refresh();dgRail(ov);dgBody(ov);
    });
    row.appendChild(rst);
    body.appendChild(row);

    /* ---- where it sits ---- */
    dgSectionHead(body,'Where “'+(d.label||id)+'” sits',
      'Drag the box to set where this type goes by default, and the '
      +'handle on its right edge to set how wide it is. Nothing moves '
      +'until you press the button underneath — a style stamp that '
      +'dragged your boxes about would be unusable.');
    dgBoard(body,id);
    /* the put, scoped (T130): everywhere stays the default, but "these
       headings, in this section" is the sentence the ask was written
       in, and a numeric range covers the rest */
    var putRow=document.createElement('div');
    putRow.className='dg-putrow';
    var inScope=function(){
      return wear.filter(function(w){return dgInScope(dgPutScope,w.s);});
    };
    var put=document.createElement('button');
    put.className='dbtn primary dg-put';
    function putSync(){
      var ws=inScope();
      /* "Put all 0 of them there" was the biggest button on the surface
         (JVUX-10): a zero-target command is an empty state, not a call
         to action */
      put.innerHTML=ws.length
        ?(bic('align')+' Put '
          +(dgPutScope.kind==='all'?('all '+ws.length):ws.length)
          +' of them there')
        :('No boxes wear this style '
          +esc(dgScopeLabel(dgPutScope)));
      put.classList.toggle('primary',!!ws.length);
      put.disabled=!ws.length;
      put.title=ws.length
        ?('Move every box wearing this type onto that rectangle, '
          +dgScopeLabel(dgPutScope)+'. Ctrl+Z undoes the lot.')
        :('Nothing wears this type '+dgScopeLabel(dgPutScope));
    }
    put.addEventListener('click',function(){
      var n=0;
      inScope().forEach(function(w){
        w.a.x=(rec.x!=null?rec.x:8);
        w.a.y=(rec.y!=null?rec.y:6);
        w.a.w=(rec.w!=null?rec.w:60);
        /* an anchored box measures from its anchor, so a default
           position has to clear the anchor or it lands somewhere else */
        delete w.a.anch;
        n++;
      });
      if(!n) return;
      markDirty();refresh();renderFilm();dgBodyKeep(ov);
      toast(n+' '+(d.label||id)+' box'+(n===1?'':'es')
        +' moved '+dgScopeLabel(dgPutScope)+' — Ctrl+Z undoes it');
    });
    putRow.appendChild(put);
    putRow.appendChild(dgScopeSelect(dgPutScope,putSync));
    putSync();
    body.appendChild(putRow);

    /* ---- every object, outlined ---- */
    dgSectionHead(body,'Every object, outlined',
      'The whole deck at once, with a box drawn round everything on '
      +'every slide. This is how you find the one heading that is 3mm '
      +'off, or the figure nobody lined up.');
    var tg=document.createElement('button');
    tg.className='dbtn dg-b';
    tg.setAttribute('aria-pressed',dgOutline?'true':'false');
    tg.innerHTML=bic('outline')+(dgOutline?' Outlines on':' Outlines off');
    tg.title='Draw a box round every object on every slide';
    tg.addEventListener('click',function(){
      dgOutline=!dgOutline;dgBody(ov);});
    body.appendChild(tg);
    var sheetScope=dgScopeSelect(dgSheetScope,function(){dgBodyKeep(ov);});
    sheetScope.title='Outlines from these slides only';
    body.appendChild(sheetScope);
    var sheet=document.createElement('div');
    sheet.className='dg-sheet'+(dgOutline?' outlined':'');
    (pres.slides||[]).forEach(function(sl,i){
      if(!dgInScope(dgSheetScope,i)) return;
      var cell=document.createElement('button');
      cell.className='dg-cell';
      /* the slide's NAME, not just its number: the whole point of
         hovering is finding out which slide you are looking at (T130) */
      var nm=slideTitle(sl);
      cell.title='Slide '+(i+1)+(nm?' \u2014 '+nm:'')
        +' \u2014 click to go there';
      var mini=miniDiagram(sl);
      cell.appendChild(mini);
      /* MOVE IT FROM HERE (T130). One drag proxy per object, sitting at
         the same page percentages inside the same relatively-positioned
         miniature, shown only while outlines are on. A drag writes the
         move through shiftAnnot -- the one translate helper, so a tied
         caption travels and an arrow moves by its endpoints exactly as
         it would on the canvas. A plain click still navigates: nothing
         is claimed until the pointer has actually moved. */
      (sl.annots||[]).forEach(function(a){
        if(!a||a.hide) return;
        /* AN ARROW IS ITS TWO ENDS, NOT A BOX (JVR-03). It used to be
           skipped here, which made "Every object" untrue for the one
           kind whose geometry is x1/y1,x2/y2 -- but the write-back was
           never the problem: shiftAnnot below already translates both
           endpoints and any dragged corners, exactly as a canvas drag
           does. Only the HANDLE was missing, and that is the bounding
           box of the line the miniature already draws -- arrowEnds is
           the same call the renderer makes, so a tied end puts the
           handle where the line really is rather than on the stale
           stored endpoint. */
        var bx,by,bw,bh;
        if(a.k==='arrow'){
          var ae=arrowEnds(null,sl,a,0);
          var axs=[ae.x1,ae.x2],ays=[ae.y1,ae.y2];
          arrowMids(a).forEach(function(m){
            axs.push(m[0]);ays.push(m[1]);});
          bx=Math.min.apply(null,axs);by=Math.min.apply(null,ays);
          bw=Math.max.apply(null,axs)-bx;bh=Math.max.apply(null,ays)-by;
          if(!isFinite(bx)||!isFinite(by)||!isFinite(bw)||!isFinite(bh))
            return;
          /* grow the HIT TARGET about the line without moving the line */
          if(bw<DG_HIT){bx-=(DG_HIT-bw)/2;bw=DG_HIT;}
          if(bh<DG_HIT){by-=(DG_HIT-bh)/2;bh=DG_HIT;}
        } else {
          bx=(a.x||0);by=(a.y||0);bw=(a.w||10);bh=(a.h||8);
        }
        var px=document.createElement('span');
        px.className='dg-drag'+(a.k==='arrow'?' is-arrow':'');
        px.style.left=bx+'%';px.style.top=by+'%';
        px.style.width=bw+'%';px.style.height=bh+'%';
        px.title=(annotLabel(a)||a.k)+' \u2014 slide '+(i+1)
          +(nm?' ('+nm+')':'')+'. Drag to move it from here.';
        px.addEventListener('pointerdown',function(e){
          var sx=e.clientX,sy=e.clientY,dragging=false;
          var mr=mini.getBoundingClientRect();
          if(!mr.width||!mr.height) return;
          try{px.setPointerCapture(e.pointerId);}catch(err){}
          function mv(ev){
            var dx=ev.clientX-sx,dy=ev.clientY-sy;
            if(!dragging&&Math.abs(dx)+Math.abs(dy)<3) return;
            dragging=true;
            ev.preventDefault();
            px.style.transform='translate('+dx+'px,'+dy+'px)';
          }
          function up(ev){
            px.removeEventListener('pointermove',mv);
            px.removeEventListener('pointerup',up);
            if(!dragging) return;   /* a plain click: the cell navigates */
            ev.preventDefault();ev.stopPropagation();
            px.style.transform='';
            /* pixels in the miniature are percent of the page, which is
               the whole reason the proxies live inside it */
            shiftAnnot(a,(ev.clientX-sx)/mr.width*100,
              (ev.clientY-sy)/mr.height*100);
            markDirty();
            if(i===cur) refresh();
            renderFilm();
            dgBodyKeep(ov);
            toast('Moved on slide '+(i+1)+' \u2014 Ctrl+Z undoes it');
          }
          px.addEventListener('pointermove',mv);
          px.addEventListener('pointerup',up);
        });
        /* a completed drag must not fall through as the cell's click */
        px.addEventListener('click',function(e){
          if(px.style.transform) return;
          e.stopPropagation();
          cur=i;activePane=-1;selAnnot=null;selSet=[];
          dgClose();refresh();
        });
        mini.appendChild(px);
      });
      var n=document.createElement('span');
      n.className='dg-celln';n.textContent=(i+1);
      cell.appendChild(n);
      cell.addEventListener('click',function(){
        cur=i;activePane=-1;selAnnot=null;selSet=[];
        dgClose();refresh();
      });
      sheet.appendChild(cell);
    });
    body.appendChild(sheet);
  }
  function openDesign(){
    dgClose();
    var ov=document.createElement('div');
    ov.className='deck-design';ov.id='deck-design';
    ov.innerHTML='<div class="dh-head">'
      +'<span class="dh-t">Design of “'+esc(pres.name||'this deck')
      +'”</span><span class="deck-spring"></span>'
      +'<button class="dbtn" id="dg-check">'+bic('scope')
      +' Check for drift</button>'
      +'<button class="dbtn" id="dg-close">'+bic('exit')+' Close</button>'
      +'</div><div class="dg-main">'
      +'<div class="dg-rail" id="dg-list"></div>'
      +'<div class="dg-body" id="dg-body"></div></div>';
    document.body.appendChild(ov);
    ov.querySelector('#dg-close').addEventListener('click',dgClose);
    ov.querySelector('#dg-check').addEventListener('click',function(){
      /* the drift CHECK stays where it is: this surface says what the
         standard is, that pane says who is not keeping to it, and one
         doing both would be a screen answering two questions */
      dgClose();
      var b=$('#dsg-std');
      if(b) b.click();
    });
    document.addEventListener('keydown',dgKey,true);
    if(styleOrder().indexOf(dgSel)<0) dgSel=styleOrder()[0]||'title';
    dgRail(ov);dgBody(ov);
  }
  window.SemDeckDesign=openDesign;
  function miniDiagram(s){
    var d=document.createElement('span');
    d.className='mini-diagram free';
    if(!s) return d;
    /* the slide's own background, so a recoloured slide reads as one */
    if(s.bg) d.style.background=tokVal(s.bg);
    var annots=s.annots||[];
    if(s.layout!=='title'&&!annots.length){
      var e=document.createElement('span');
      e.className='mini-pane empty';
      d.appendChild(e);
      return d;
    }
    if(s.layout==='title'){
      miniText(d,titleProps(s,'t'),s.title||'Title','is-t',true);
      miniText(d,titleProps(s,'s'),s.sub||'','is-s',true);
    }
    /* arrows go last so they sit on top, exactly as on the canvas */
    var arrows=[];
    annots.forEach(function(a,i){
      if(!a||a.hide) return;
      if(a.k==='arrow'){arrows.push(a);return;}
      if(a.k==='text'){miniText(d,a,a.text||'');return;}
      if(a.k==='image'){
        var bx=miniBox(d,a,'is-img');
        if(a.src){
          var im=document.createElement('img');
          im.src=a.src;im.alt='';im.loading='lazy';im.draggable=false;
          im.setAttribute('aria-hidden','true');   /* decorative (T105) */
          if(a.crop) bx.classList.add('is-crop');
          bx.appendChild(im);
        }
        return;
      }
      if(a.k==='flip'){
        /* the thumbnail shows the frame the slide RESTS on, which is the
           one the strip is an index to. Without a branch here a flip book
           is invisible in the film strip and every slide holding one
           looks empty (the lesson miniDiagram was rewritten for). */
        var bf=miniBox(d,a,'is-flip');
        var ff=flipFrames(a)[a.at||0];
        if(ff&&ff.src){
          var fim2=document.createElement('img');
          fim2.src=ff.src;fim2.alt='';fim2.loading='lazy';
          fim2.draggable=false;
          fim2.setAttribute('aria-hidden','true');  /* decorative (T105) */
          bf.appendChild(fim2);
        } else if(ff&&ff.ref){
          var fnode2=framePart(ff.ref,ff.part);
          var fimg2=fnode2?fnode2.querySelector('img'):null;
          if(fimg2&&fimg2.src){
            var fc=document.createElement('img');
            fc.src=fimg2.src;fc.alt='';fc.loading='lazy';fc.draggable=false;
            fc.setAttribute('aria-hidden','true');  /* decorative (T105) */
            bf.appendChild(fc);
          }
        }
        return;
      }
      if(a.k==='rect'){
        var bs=miniBox(d,a,'is-shape');
        bs.appendChild(drawShapeSvg(a.shape||'rect',a.color||'#ff6b57',
          miniSw(a),a,'m'+(miniSeq++),null));
        miniStroke(bs,a);
        return;
      }
      if(a.k==='draw'){
        var bd=miniBox(d,a,'is-shape');
        bd.appendChild(drawFreeSvg(a,null));
        miniStroke(bd,a);
        return;
      }
      if(a.k==='table'){
        /* a real miniature table: at 116px the words are a smudge, but
           the SHAPE of a table is unmistakable and that is what a
           thumbnail is for */
        var bt=miniBox(d,a,'is-tbl');
        var trows=tableRows(a),tcols=tableCols(a);
        var mt=document.createElement('table');
        mt.className='mini-tbl'+(a.grid===0?' nogrid':'');
        if(a.color) mt.style.color=tokVal(a.color);
        if(a.bg!==0&&a.bgc) bt.style.background=tokVal(a.bgc);
        mt.style.fontSize=Math.max(1.5,
          miniHNow*(a.size||2.2)/100).toFixed(2)+'px';
        trows.forEach(function(row,ri){
          var tr=document.createElement('tr');
          row.forEach(function(v,ci){
            var td=document.createElement((a.thead&&ri===0)?'th':'td');
            td.style.width=tcols[ci]+'%';
            td.textContent=v==null?'':String(v);
            tr.appendChild(td);});
          mt.appendChild(tr);});
        bt.appendChild(mt);
        return;
      }
      if(a.k==='cell'){
        var w2=paneThumb(a.ref);
        w2.style.position='absolute';
        w2.style.left=(a.x||0)+'%';w2.style.top=(a.y||0)+'%';
        w2.style.width=(a.w||10)+'%';w2.style.height=(a.h||10)+'%';
        if(a.rot) w2.style.transform='rotate('+a.rot+'deg)';
        d.appendChild(w2);
      }
    });
    if(arrows.length){
      /* ONE svg for every arrow, in the page's own 0..100 percentage
         space — preserveAspectRatio="none" makes that space the
         thumbnail, so no pixel measurement is needed and nothing has to
         be re-scaled when the strip is resized */
      var sv=document.createElementNS(AN_NS,'svg');
      sv.setAttribute('class','mini-svg');
      sv.setAttribute('viewBox','0 0 100 100');
      sv.setAttribute('preserveAspectRatio','none');
      arrows.forEach(function(a){
        var p=document.createElementNS(AN_NS,'path');
        p.setAttribute('d',arrowPath(arrowEnds(null,s,a,0),a,100,100));
        p.setAttribute('fill','none');
        p.setAttribute('stroke',tokVal(a.color)||'#ff6b57');
        p.setAttribute('stroke-width',miniSw(a));
        p.setAttribute('vector-effect','non-scaling-stroke');
        p.setAttribute('stroke-linecap','round');
        if(a.op!=null&&a.op<1) p.setAttribute('opacity',a.op);
        sv.appendChild(p);
      });
      d.appendChild(sv);
    }
    return d;
  }
  /* ---- the other pages, as a floating pane -----------------------------
     The strip is MOVED into #verpane rather than rebuilt there, so
     reordering, drag-and-drop, delete and the thumbnails keep working
     with no second copy of any of it (2026-08-10, user: "the bar for this
     should appear like the objects bar"). */
  var filmHome=null;
  function filmToPane(){
    var body=$('#verpane-body'),list=$('#film-list'),add=$('#film-adds'),
        head=$('#film-head');
    if(!body||!list||filmHome) return;
    filmHome={parent:list.parentNode,next:list.nextSibling};
    /* the chooser rides along as a THIRD node, above the list it chooses
       for. Building a second copy of it in the pane is how two controls
       that claim to do the same thing start disagreeing (2026-08-22). */
    if(head) body.appendChild(head);
    body.appendChild(list);
    if(add) body.appendChild(add);
  }
  function filmToPanel(){
    if(!filmHome) return;
    var list=$('#film-list'),add=$('#film-adds'),head=$('#film-head');
    if(list&&filmHome.parent){
      var at=(filmHome.next&&filmHome.next.parentNode===filmHome.parent)
        ?filmHome.next:null;
      /* head, list, adds — in that order and all before whatever followed
         the list when it left, so the column comes back exactly as it was
         rather than with its chooser stranded at the bottom */
      if(head) filmHome.parent.insertBefore(head,at);
      filmHome.parent.insertBefore(list,at);
      if(add) filmHome.parent.insertBefore(add,at);
    }
    filmHome=null;
  }
  /* The button reports the state of whichever strip this page kind uses:
     the docked one for a deck, the floating pane for a poster. Written
     once, because two of these drifting apart is a toggle that lies about
     what it will do. */
  function syncStripBtn(){
    var vb=$('#vw-versions'); if(!vb) return;
    var p=$('#verpane');
    var on=pageOf().poster
      ? !!(p&&!p.hidden)
      : !deckEl.classList.contains('strip-off');
    vb.setAttribute('aria-pressed',on.toString());
  }
  function showVerpane(on){
    var p=$('#verpane'); if(!p) return;
    if(on){
      paneShow('verpane');
      filmToPane();
      renderFilm();
    } else paneHide('verpane');
    var t=$('#verpane-title');
    if(t) t.textContent=pageOf().poster?'Versions':'Slides';
    syncStripBtn();
  }
  /* ---- versions --------------------------------------------------------
     A poster's other pages are drafts and variants, so a new one starts as
     a COPY of what you are looking at — that is what a variant is a
     variant OF — and it is named for you, because an unnamed pile of
     near-identical A0 sheets is unusable. The name is a starting point:
     Rename changes it. */
  function nextVersionName(){
    var n=0;
    (pres.slides||[]).forEach(function(s){
      var m=/^Version (\d+)$/.exec((s&&s.label)||'');
      if(m) n=Math.max(n,+m[1]);
    });
    return 'Version '+(n+1);
  }
  /* `lay` is a layout from the catalogue when a Home tile asked for
     this slide (T202), `arr` a saved layout whose shapes it should
     carry; the film strip's + passes its click event, which is
     neither */
  function newVersion(lay,arr){
    if(!(lay&&lay.items)) lay=null;
    var at=pres.slides.length?cur+1:0;
    if(!pageOf().poster){
      /* a DECK's slides are named by what is on them, which is more use
         than "Slide 3" — so no label is stamped here */
      var ns=emptySlide();
      /* THE LAYOUT YOU LAST CHOSE (T193). A new slide arrives laid out
         the way the last one you picked a layout for was, and a deck
         that has never picked one starts with a title, a panel and
         text -- the shape most slides in a talk have (2026-09-02,
         user: "when click add new it should remember the last one you
         added. The default slide choice should be the panel, title,
         text"). Blank is still one pick away. */
      if(arr&&arr.annots){
        ns.annots=deep(arr.annots);
      } else {
        lay=lay||layoutById(lsGet(newLayKey())||'cell-text');
        if(lay&&!lay.poster) applyLayout(ns,lay);
      }
      pres.slides.splice(at,0,ns);
    } else {
      var src=pres.slides[cur];
      /* name the page you were already on first, so the two read as a
         pair rather than "empty slide" and "Version 2" */
      if(src&&!src.label) src.label=nextVersionName();
      var cp=src?deep(src):emptySlide();
      cp.label=nextVersionName();
      pres.slides.splice(at,0,cp);
    }
    /* a new slide joins the section it was inserted into. Without this an
       insert splits the run in two and grows a divider out of nowhere. */
    var prev=pres.slides[at-1];
    if(prev&&prev.sec) pres.slides[at].sec=prev.sec;
    cur=at;activePane=-1;selAnnot=null;selSet=[];
    normSections();markDirty();refresh();
    if(!$('#verpane').hidden) renderFilm();
  }
  /* ---- THE OUTLINE ----------------------------------------------------
     In headings mode the strip stops being a contact sheet and becomes a
     table of contents, so it must name a slide by its HEADING and not by
     whatever text happens to sit highest on it. A box wearing a heading
     style says outright that it is the slide's title; slideTitle's
     guesswork is the fallback for slides that never used one. */
  function slideHeading(s){
    var best=null,bestAt=99;
    (s.annots||[]).forEach(function(a){
      if(!a||a.k!=='text'||a.hide||!String(a.text||'').trim()) return;
      if(!a.style||!isHeadingStyle(a.style)) return;
      var at=headingStyles().indexOf(a.style);
      if(at>=0&&at<bestAt){bestAt=at;best=a;}
    });
    return best?String(best.text).trim().split('\n')[0]:'';
  }
  /* how far the row indents in the outline. A title slide and a section
     divider are always level 0 — they are the top of something, whatever
     style their text happens to wear. */
  function headLevel(s){
    if(!s||s.layout==='title'||s.layout==='section') return 0;
    var lv=0;
    (s.annots||[]).forEach(function(a){
      if(!a||a.k!=='text'||a.hide||!a.style) return;
      var at=headingStyles().indexOf(a.style);
      if(at>=0&&(!lv||at<lv)) lv=at;
    });
    return Math.min(3,lv);
  }
  /* ONE source for the words on a row, so the strip and refreshThumb can
     never disagree about what a slide is called */
  function filmText(s){
    if(filmMode()==='thumb') return slideTitle(s);
    return slideHeading(s)||slideTitle(s);
  }
  function slideTitle(s){
    /* a version carries the name you were given or chose; only posters
       get one, so a deck slide is still named by what is ON it */
    if(s.label) return s.label;
    if(s.layout==='title') return s.title||'title slide';
    var cells=slideCells(s);
    for(var i=0;i<cells.length;i++){
      var it=cells[i].a.ref&&resolveRef(cells[i].a.ref);
      if(it) return it.title;
    }
    var tx=(s.annots||[]).filter(function(a){
      return a.k==='text'&&a.text;})[0];
    if(tx) return tx.text;
    /* a slide that is one big table is named by its first heading, which
       beats calling it "empty slide" (2026-08-20) */
    var tb=(s.annots||[]).filter(function(a){return a.k==='table';})[0];
    if(tb){
      var r0=(tb.rows||[])[0]||[];
      for(var j=0;j<r0.length;j++)
        if(String(r0[j]||'').trim()) return String(r0[j]).trim();
      return 'table';
    }
    return 'empty slide';
  }
  /* ---- SLIDE SECTIONS -------------------------------------------------
     "There should be the ability to create slide sections in the
     thumbnails part" (2026-08-22).

     THE SHAPE, and why it is this one. A section is a TAG on the slide
     (s.sec) plus a name in a keyed map (pres.sections). The ORDER is
     never stored: it is read back off pres.slides. Every slide mutation
     in this file is a raw splice — moveSlide, delSlide, dupSlide,
     newVersion, the strip's drop handler — and histRestore replaces the
     array outright; a tag rides through all six for free, while a stored
     start-INDEX would have to be shifted correctly in every one of them
     and would be silently wrong the first time one was missed.

     The one price of tags is that they permit a section to go
     discontiguous. normSections() below is what pays it, and every verb
     here ends by calling it. */
  var secSeq=0;
  function secId(){
    /* an id has to survive a save, a reload and an undo, so it cannot be
       a plain counter reset on load — two sections would collide the
       moment you reopened a deck and made another one */
    secSeq++;
    return 's'+Date.now().toString(36)+secSeq.toString(36);
  }
  function secMap(){
    if(!pres.sections||typeof pres.sections!=='object') pres.sections={};
    return pres.sections;
  }
  function secName(id){
    var d=(pres.sections||{})[id];
    return (d&&d.name)||'Untitled section';
  }
  /* THE ONE SHARED API. The strip, the Apply dialog's scope picker and
     the outline view must all agree on what a section IS, so all three
     read it from here rather than each grouping the slides their own
     way. Untagged spans come back too, with id '' — a caller that wants
     only real sections filters on run.id. */
  function sectionRuns(){
    var out=[],sl=pres.slides||[],i,id,last=null;
    for(i=0;i<sl.length;i++){
      id=(sl[i]&&sl[i].sec)||'';
      if(!last||last.id!==id){
        last={id:id,name:id?secName(id):'',at:i,n:0,
          fold:!!(id&&(pres.sections||{})[id]&&pres.sections[id].fold)};
        out.push(last);
      }
      last.n++;
    }
    return out;
  }
  /* THE INVARIANT. A section is a CONTIGUOUS run — that is what a divider
     in a strip means, and nothing in the UI can express anything else. A
     tag can still end up out of place (drag a slide past a boundary, or
     swap one across it with the arrows), so every mutation ends here: a
     tag that reappears after its run has closed is re-tagged to the run
     it now sits in, and any section no slide uses is thrown away.
     Dropping the map entirely when it empties is what keeps a deck that
     never used sections serialising exactly as it did before. */
  function normSections(){
    var sl=pres.slides||[],seen={},closed={},prev='',i,id;
    for(i=0;i<sl.length;i++){
      if(!sl[i]) continue;
      id=sl[i].sec||'';
      if(id&&id!==prev&&(closed[id]||seen[id])) id=prev;
      if(id) seen[id]=1;
      if(prev&&prev!==id) closed[prev]=1;
      if(id) sl[i].sec=id; else delete sl[i].sec;
      prev=id;
    }
    var m=pres.sections;
    if(m){
      Object.keys(m).forEach(function(k){if(!seen[k]) delete m[k];});
      if(!Object.keys(m).length) delete pres.sections;
    }
  }
  /* the five verbs. Everything that touches sections goes through one of
     these, so normSections() is guaranteed to have run before markDirty
     writes the deck out. */
  function newSection(at,name){
    var id=secId(),i;
    secMap()[id]={name:name||'New section'};
    /* a new section OWNS everything from `at` down to the next divider —
       that is what "start a section here" means in PowerPoint, and it is
       the only reading that leaves no orphan slides behind */
    var was=(pres.slides[at]&&pres.slides[at].sec)||'';
    for(i=at;i<pres.slides.length;i++){
      if(((pres.slides[i].sec)||'')!==was) break;
      pres.slides[i].sec=id;
    }
    normSections();markDirty();renderFilm();
  }
  function renameSection(id){
    /* prompt(), not an inline edit on the row. The row's own click
       re-renders the strip, so by the time a dblclick handler arrived the
       node it was editing had already been replaced — the same reason the
       poster version rename is a button and a prompt (2026-08-10) */
    var v=prompt('Name this section:',secName(id));
    if(v==null) return;
    v=v.trim(); if(!v) return;
    secMap()[id]={name:v,fold:(pres.sections[id]||{}).fold};
    if(!pres.sections[id].fold) delete pres.sections[id].fold;
    markDirty();renderFilm();
  }
  function foldSection(id,on){
    var d=secMap()[id]; if(!d) return;
    if(on) d.fold=1; else delete d.fold;
    /* markDirty(true): folding is a way of LOOKING at the deck, not an
       edit to it, so it persists in the file but never lands on the undo
       stack — Ctrl+Z must never open or close a section */
    markDirty(true);renderFilm();
  }
  function removeSection(id,withSlides){
    var runs=sectionRuns(),r=null,i;
    for(i=0;i<runs.length;i++) if(runs[i].id===id) r=runs[i];
    if(!r) return;
    if(withSlides) pres.slides.splice(r.at,r.n);
    /* the slides MERGE UPWARDS into whatever section is above — removing
       a divider must never delete work, which is why the destructive form
       is a separate and differently-worded verb */
    else for(i=r.at;i<r.at+r.n;i++){
      if(r.at>0&&pres.slides[r.at-1].sec)
        pres.slides[i].sec=pres.slides[r.at-1].sec;
      else delete pres.slides[i].sec;
    }
    if(pres.sections) delete pres.sections[id];
    if(cur>=pres.slides.length) cur=Math.max(0,pres.slides.length-1);
    normSections();markDirty();refresh();
  }
