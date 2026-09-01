  /* ---- TEXT BUILDS: a box that arrives a piece at a time ---------------
     (2026-08-30, user: "Can there be options for text as well, like the
     dot point by dot point, line by line, sentence by sentence.")

     THE MODEL IS NEVER SPLIT. `a.anim.by` says how finely this box
     builds -- 'para' or 'sent' -- and NOTHING else about the box
     changes: a.text, a.html, a.list and a.md are byte-for-byte what they
     were. The pieces are cut at RENDER time out of the node renderAnnots
     has already built, by wrapping runs in <span class="an-part">. That
     is the only design that keeps the rest of the editor honest: the
     caret, the bullet escape hatch (T72), sanitizeRich, the markdown
     source (T74), the fit pass (T15), search, the review outline and the
     .pptx writer all go on seeing exactly the words they always did.

     WHY 'para' AND 'sent' AND NOTHING ELSE.
     * PARAGRAPH is a bullet, or a line you pressed Enter on. It EXISTS
       in the stored text -- a \n, a top-level <br>, an <li>, a markdown
       block -- so it means the same thing at every zoom, on every page
       size, in the presenter view, in the PDF and in PowerPoint (whose
       own paragraphs are the same \n split, pptx.js paragraphs()).
     * SENTENCE is cut by SENT_END below, which is deliberately shy.
     * LINE, in the sense of a WRAPPED line, is NOT shipped and should
       not be. A wrapped line is nowhere in the deck: it is a product of
       the box width, the font, --an-fit, --talk-text, the page size and
       the browser's own line breaker. Its CLICK COUNT would change when
       you dragged a resize handle, which is a build you cannot rehearse
       against. Text you hard-broke IS built line by line -- by 'para',
       which is what those Enters mean, and the pane says so.
     * WORD is not shipped either. Every piece here costs a CLICK (there
       is no timed auto-advance anywhere in this playback model), so a
       forty-word paragraph would be forty clicks and one mis-click on a
       body box would make the slide unpresentable. Revisit it if "with
       previous, after 0.3s" ever exists.

     A PIECE IS AN INDEX, NOT AN ELEMENT. data-part="4" may sit on
     several spans -- a sentence with a <b> in the middle of it is three
     wrapped runs -- because a wrapper may never cross an element
     boundary without rewriting the markup, which is the one thing this
     feature must not do. Everything downstream selects by the index.

     HIDING IS opacity, NEVER display. A text box auto-heights from its
     words, so display:none would make it grow line by line and, with a
     bottom or centre anchor, walk up the slide while it built.
     .an-prebuild is opacity + pointer-events, so the full height is
     reserved from the first frame and nothing moves. */
  /* which granularities exist. 'rise' is shown as 'Float up' by the
     pane; these labels are the pane's too, kept here so the picker and
     the pane cannot drift. */
  var TEXT_BY=[['','All at once'],['para','Bullet by bullet'],
    ['sent','Sentence by sentence']];
  /* what this box is split into, or '' -- ONE reader, so a stray value
     from a hand-edited deck can never reach the splitter */
  function textBy(a){
    if(!a||a.k!=='text'||!a.anim) return '';
    var by=a.anim.by;
    return (by==='para'||by==='sent')?by:'';
  }
  /* THE SENTENCE CUT, AND WHAT IT GETS WRONG.

     A candidate is a run of . ! or ?, any closing quotes or brackets
     after it, then whitespace. It becomes a cut only when the character
     after the gap starts something -- a capital, a digit, an opening
     quote or bracket -- and the word in front of the stop is not an
     abbreviation.

     What that buys, on the cases that actually turn up in a talk:
     * "Fig. 3 shows" stays whole. Note the next character is a DIGIT and
       would otherwise have passed, so ABBREV is doing the work.
     * "et al. found" stays whole twice over: `al.` is listed AND `found`
       is lowercase.
     * "0.05" is never a candidate at all -- there is no whitespace after
       that dot. Decimals are structurally immune, not specially cased.
     * "A. Borowiak" and "U.S. policy" stay whole: a lone letter is the
       first alternative in ABBREV.
     * "and so on... he said" stays whole -- `he` fails SENT_NEXT.

     What it gets wrong. The direction is deliberate: it UNDER-cuts, so a
     piece is sometimes bigger than a sentence and never starts in the
     middle of a clause.
     * A sentence that really does end in an abbreviation ("...sold by
       Acme Ltd. The next year...") is not cut.
     * A sentence starting with a lowercase word ("...done. iPhone sales
       fell.") is not cut.
     * An abbreviation not in the list IS cut: "Assoc. Prof. Smith" cuts
       after "Assoc.". This is the one over-cut, and it is why the list
       is long rather than clever.
     * Terminators that are not English full stops -- CJK 。,
       Devanagari ॥ -- are not recognised, so a CJK box builds one
       piece per paragraph. Better said than pretended.
     The remedy for any single wrong cut is the one that has always
     existed: press Enter there and use Bullet by bullet. */
  var ABBREV=new RegExp('(?:^|[\\s(\\[“‘"\'])(?:[A-Za-z]|'
    +'Fig|Figs|Eq|Eqs|Tab|Tabs|Ref|Refs|No|Nos|vs|cf|al|et|etc|approx|'
    +'ca|est|Dr|Prof|Mr|Mrs|Ms|St|Jr|Sr|Inc|Ltd|Co|Corp|Univ|Dept|Ch|'
    +'Sec|Vol|Ed|Eds|pp|p|min|max|std|avg|sd|Jan|Feb|Mar|Apr|Jun|Jul|'
    +'Aug|Sept|Sep|Oct|Nov|Dec|Mon|Tue|Tues|Wed|Thu|Thur|Thurs|Fri|'
    +'Sat|Sun|i\\.e|e\\.g|w\\.r\\.t)\\.$');
  var SENT_END=/([.!?]+)(["'”’)\]]*)(\s+)/g;
  var SENT_NEXT=/^[A-Z0-9À-Þ("'“‘\[]/;
  /* every offset in `t` at which a new sentence starts */
  function sentenceCuts(t){
    var out=[],m;
    SENT_END.lastIndex=0;
    while((m=SENT_END.exec(t))){
      var end=m.index+m[0].length;        /* first character after the gap */
      if(end>=t.length) continue;         /* trailing space: no piece there */
      if(!SENT_NEXT.test(t.slice(end))) continue;
      if(ABBREV.test(t.slice(0,m.index+1))) continue;
      out.push(end);
    }
    return out;
  }
  /* WHICH BLOCK a node sits in. Two text nodes belong to the same piece
     when this returns the same element for both -- so an <li> (at any
     depth), a <p>, a heading, a blockquote and a <pre> each start one,
     and the inline markup inside them does not. It is the same rule
     contentLines() already uses to answer "what are this box's lines",
     which is what keeps a piece, a \n in a.text and an <a:p> in the
     .pptx the same unit. */
  var BLOCK_TAG={LI:1,P:1,H1:1,H2:1,H3:1,H4:1,H5:1,H6:1,BLOCKQUOTE:1,
    PRE:1,DIV:1,UL:1,OL:1,HR:1};
  function blockOf(n,root){
    for(var e=n.parentNode;e&&e!==root;e=e.parentNode)
      if(e.nodeType===1&&BLOCK_TAG[e.tagName]) return e;
    return root;
  }
  /* PUT IT BACK. Called before every split (so the pass is idempotent),
     before the caret ever enters the box, and by sanitizeRich -- the one
     choke point every commit already goes through. */
  function unsplitParts(el){
    if(!el||!el.querySelectorAll) return;
    var ps=el.querySelectorAll('[data-part]'),i,p;
    for(i=0;i<ps.length;i++){
      p=ps[i];
      if(p.tagName==='SPAN'&&p.classList&&p.classList.contains('an-part')
         &&!p.classList.contains('an-blk')){
        while(p.firstChild) p.parentNode.insertBefore(p.firstChild,p);
        p.parentNode.removeChild(p);
        continue;
      }
      /* a PROMOTED block: the piece is the <li> or <p> itself, so only
         the marks come off and the element stays exactly where it was */
      p.removeAttribute('data-part');
      if(p.classList){
        p.classList.remove('an-part','an-blk','an-prebuild');
        var ct=p.getAttribute('class');
        if(ct!=null&&!ct.trim()) p.removeAttribute('class');
      }
    }
    if(el.normalize) el.normalize();
  }
  /* one text node -> one or more wrapped runs. `part` is the index the
     first run takes; the return value is the index the LAST run took, so
     the caller carries straight on from there. */
  function cutTextNode(n,part,by,used){
    var t=n.nodeValue,cuts=[],i;
    /* A HARD NEWLINE IS A LINE. .an-tx is white-space:pre-wrap, so in a
       plain box the \n IS the break on screen and there is no <br> to
       see. Cut on both sides of it, and the \n itself falls out as a
       whitespace-only segment that costs no click. */
    for(i=0;i<t.length;i++)
      if(t.charAt(i)==='\n'){cuts.push(i);cuts.push(i+1);}
    if(by==='sent') cuts=cuts.concat(sentenceCuts(t));
    cuts.sort(function(x,y){return x-y;});
    cuts.push(t.length);
    var doc=n.ownerDocument,frag=doc.createDocumentFragment(),at=0,k;
    for(k=0;k<cuts.length;k++){
      var end=cuts[k];
      if(end<=at) continue;
      var seg=t.slice(at,end);
      at=end;
      if(/^\s*$/.test(seg)){
        /* whitespace between pieces belongs to neither, so it goes back
           bare: it can never be the thing that costs a click, and
           leaving it unwrapped is what keeps the line breaks identical */
        frag.appendChild(doc.createTextNode(seg));
      } else {
        var sp=doc.createElement('span');
        sp.className='an-part';
        sp.setAttribute('data-part',part);
        sp.appendChild(doc.createTextNode(seg));
        frag.appendChild(sp);
        used[part]=1;
      }
      if(k<cuts.length-1) part++;
    }
    n.parentNode.replaceChild(frag,n);
    return part;
  }
  /* PROMOTE A WHOLE BLOCK. When a piece turned out to be everything in
     its own <li> or <p>, the piece IS that block: the marks move up and
     the wrapper goes. Three things fall out of it and all three matter.
     The bullet MARKER now hides with its words (a dot sitting on its own
     in front of nothing reads as a rendering fault). The piece is
     block-level, so `transform` applies to it and Float up / Zoom can
     really play on a bullet -- on an inline run they cannot, and
     display:inline-block to force it would break line wrapping, which is
     a worse bug than a fade. And there is one element per piece rather
     than several.
     A bullet WITH SUB-BULLETS is deliberately not promoted: hiding it
     would take its children with it. Its marker is handled in CSS. */
  function promoteBlocks(el){
    var blocks=el.querySelectorAll(
      'li,p,h1,h2,h3,h4,h5,h6,blockquote'),i,j;
    for(i=0;i<blocks.length;i++){
      var b=blocks[i],kids=b.childNodes,only=null,ok=true;
      for(j=0;j<kids.length;j++){
        var c=kids[j];
        if(c.nodeType===3){
          if(!/^\s*$/.test(c.nodeValue)){ok=false;break;}
          continue;
        }
        if(c.nodeType!==1){ok=false;break;}
        if(c.classList&&c.classList.contains('an-part')&&!only){
          only=c;continue;
        }
        ok=false;break;
      }
      if(!ok||!only) continue;
      b.setAttribute('data-part',only.getAttribute('data-part'));
      b.classList.add('an-part','an-blk');
      while(only.firstChild) b.insertBefore(only.firstChild,only);
      b.removeChild(only);
    }
  }
  /* CUT ONE RENDERED BOX INTO PIECES, in place. Returns how many pieces
     it made. Idempotent -- it un-splits first -- and layout-neutral: <br>
     and the whitespace between pieces are left exactly where they were,
     so a split box and an unsplit one wrap identically. */
  function splitParts(el,by){
    unsplitParts(el);
    if(!el||(by!=='para'&&by!=='sent')) return 0;
    /* COLLECT FIRST. A live walk would see the spans it is creating. */
    var w=document.createTreeWalker(el,
      NodeFilter.SHOW_TEXT|NodeFilter.SHOW_ELEMENT,null,false);
    var nodes=[],n,i;
    while((n=w.nextNode())){
      if(n.nodeType===3){if(n.nodeValue!=='') nodes.push(n);}
      else if(n.tagName==='BR') nodes.push(n);
    }
    var part=-1,blk=null,used={};
    for(i=0;i<nodes.length;i++){
      n=nodes[i];
      /* a <br> ENDS a piece and starts nothing on its own: clearing the
         block is enough, and it means <br><br> costs one break, not two */
      if(n.nodeType===1){blk=null;continue;}
      var b=blockOf(n,el);
      if(b!==blk){blk=b;part++;}
      part=cutTextNode(n,part,by,used);
    }
    promoteBlocks(el);
    /* DENSE NUMBERING, LAST. A blank line, a <br><br>, an empty heading:
       a piece with no ink must not cost a click, so the indices actually
       written are renumbered 0..n-1 here rather than left with holes. */
    var keys=Object.keys(used).map(Number).sort(function(x,y){
      return x-y;});
    var ren={};
    keys.forEach(function(k,j){ren[k]=j;});
    var ps=el.querySelectorAll('[data-part]');
    for(i=0;i<ps.length;i++)
      ps[i].setAttribute('data-part',
        ren[+ps[i].getAttribute('data-part')]);
    return keys.length;
  }
  /* WHAT THE PIECES SAY, off the MODEL -- asked by the timeline, the
     filmstrip's build mark, the animation pane's sub-rows and the .pptx
     writer, none of which has a rendered layer in front of it.

     IT IS THE SAME CODE THE SCREEN RUNS. The node renderAnnots would
     build is built again inside an inert <template> and cut by the very
     same splitParts, because a count that disagreed with the screen by
     one is a slide that never finishes building. Nothing the splitter
     needs requires the node to be attached.

     figSubst with the DEFAULT figure map, not renderAnnots' _figMap:
     that one is a local of the render and does not exist here. A {fig}
     resolving to a different number cannot change where a bullet or a
     sentence begins, and if it somehow did, the reveal pass fails OPEN
     (see 20-notes-and-tables) rather than hiding anything. */
  var _pcCache={},_pcOrder=[];
  function textPieceSig(a){
    return textBy(a)+''+(a.md?'m':'')+(listOf(a)||'')+''
      +(a.html||'')+''+(a.text||'');
  }
  function textPieces(a){
    var by=textBy(a);
    if(!by) return [];
    var sig=textPieceSig(a);
    if(_pcCache[sig]) return _pcCache[sig];
    var host=document.createElement('template'),tx,lst=listOf(a);
    var showTx=figSubst(a.text,a),showHtml=a.html?figSubst(a.html,a):null;
    if(lst){
      tx=document.createElement(lst==='number'?'ol':'ul');
      if(a.html) tx.innerHTML=sanitizeRich(showHtml).html;
      else String(showTx||'').split('\n').forEach(function(line){
        var li=document.createElement('li');
        li.textContent=line;tx.appendChild(li);});
    } else {
      tx=document.createElement('span');
      if(a.md) tx.innerHTML=notesHtml(showTx);
      else if(a.html) tx.innerHTML=sanitizeRich(showHtml).html;
      else tx.textContent=showTx||'';
    }
    host.content.appendChild(tx);
    var n=splitParts(tx,by),texts=[],j;
    for(j=0;j<n;j++){
      var t='';
      $$('[data-part="'+j+'"]',tx).forEach(function(p){t+=p.textContent;});
      texts.push(t.replace(/\s+/g,' ').trim());
    }
    if(!texts.length) texts=[String(a.text||'')];
    _pcCache[sig]=texts;_pcOrder.push(sig);
    /* a small cap: this is asked once per animated annot per render, and
       a deck is not a cache */
    while(_pcOrder.length>64) delete _pcCache[_pcOrder.shift()];
    return texts;
  }
  function textPieceCount(a){
    var p=textPieces(a);
    return p.length?p.length:1;
  }
