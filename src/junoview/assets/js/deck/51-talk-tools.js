  /* ---- T386: THE TALK'S OWN TOOLS ------------------------------------
     (2026-09-12, user: "the during presentation features, having
     something like a magnifying glass that can be swapped to. I feel
     like there are a lot of extra cool creative things that can get
     added.") Three things a presenter reaches for in front of a room,
     none of which touch the deck: a LASER dot that follows the pointer,
     a MAGNIFIER that shows the slide under the pointer at twice the
     size, and a BLACK SCREEN for when the room should look at the
     speaker. Each is one key in the show (P, M, B) and one button on
     the Talk panel; Escape puts everything down. View mode only, like
     the panel itself: these are facts about the room, not the deck, so
     nothing here is stored.

     The magnifier is a clone of the slide, scaled, inside a round
     window that rides with the pointer -- a picture, not the slide, so
     nothing in it can take a click (pointer-events:none on the whole
     lens) and a click still advances. The clone is refreshed when the
     slide's DOM changes (a build, a page turn, a new slide), through a
     MutationObserver that is only connected while the lens is up. */
  var talkTool='',talkBlackEl=null,laserEl=null,lensEl=null,lensIn=null;
  var lensObs=null,lensSyncT=null,lensPt=null;
  var LENS_D=300,LENS_Z=2;
  function talkToolsSync(){
    [['talk-laser','laser'],['talk-lens','lens']].forEach(function(p){
      var b=$('#'+p[0]); if(!b) return;
      b.setAttribute('aria-pressed',(talkTool===p[1]).toString());
    });
    var bb=$('#talk-black');
    if(bb) bb.setAttribute('aria-pressed',(!!talkBlackEl).toString());
    document.body.classList.toggle('jv-laser',talkTool==='laser');
    document.body.classList.toggle('jv-lens',talkTool==='lens');
  }
  function laserMove(e){
    if(!laserEl) return;
    laserEl.style.left=e.clientX+'px';
    laserEl.style.top=e.clientY+'px';
  }
  function slideEl(){
    return (stage&&(stage.querySelector('.slide')||stage.firstElementChild))
      ||null;
  }
  function lensRebuild(){
    if(!lensEl) return;
    /* renderSlide empties the stage, lens and all: a new slide puts the
       lens back before it fills it */
    if(!lensEl.isConnected) (stage||document.body).appendChild(lensEl);
    var src=slideEl(); if(!src) return;
    var clone=src.cloneNode(true);
    /* a picture of the slide: no ids twice in one document, no chrome */
    clone.removeAttribute('id');
    $$('[id]',clone).forEach(function(n){n.removeAttribute('id');});
    $$('.an-resize,.an-rotate,.an-buildno,.an-endpt,.an-cellbtn,.cellparts',
      clone).forEach(function(n){n.remove();});
    var r=src.getBoundingClientRect();
    clone.style.position='absolute';
    clone.style.left='0';clone.style.top='0';
    clone.style.margin='0';
    clone.style.width=r.width+'px';clone.style.height=r.height+'px';
    clone.style.transformOrigin='0 0';
    lensIn.innerHTML='';
    lensIn.appendChild(clone);
    lensIn._w=r.width;lensIn._h=r.height;
    lensPlace();
  }
  function lensPlace(){
    if(!lensEl||!lensPt) return;
    var src=slideEl(); if(!src) return;
    var r=src.getBoundingClientRect(),R=LENS_D/2;
    lensEl.style.left=(lensPt.x-R)+'px';
    lensEl.style.top=(lensPt.y-R)+'px';
    var px=lensPt.x-r.left,py=lensPt.y-r.top;
    var clone=lensIn.firstElementChild; if(!clone) return;
    clone.style.transform='translate('+(R-px*LENS_Z)+'px,'+(R-py*LENS_Z)
      +'px) scale('+LENS_Z+')';
  }
  function lensMove(e){
    lensPt={x:e.clientX,y:e.clientY};
    lensPlace();
  }
  function lensSyncSoon(recs){
    /* the lens lives inside the stage (see setTalkTool), so its own
       redraws reach this observer too; only the slide's count */
    if(lensEl&&recs&&recs.length&&!recs.some(function(r){
      return !lensEl.contains(r.target);})) return;
    if(lensSyncT) clearTimeout(lensSyncT);
    lensSyncT=setTimeout(function(){lensSyncT=null;lensRebuild();},120);
  }
  function setTalkTool(t){
    if(mode!=='view'||deckEl.hidden) t='';
    if(t===talkTool) t='';
    /* put the old one down */
    if(laserEl){laserEl.remove();laserEl=null;
      document.removeEventListener('mousemove',laserMove);}
    if(lensEl){
      lensEl.remove();lensEl=null;lensIn=null;lensPt=null;
      document.removeEventListener('mousemove',lensMove);
      if(lensObs){lensObs.disconnect();lensObs=null;}
    }
    talkTool=t;
    if(t==='laser'){
      laserEl=document.createElement('div');
      laserEl.className='jv-laserdot';
      document.body.appendChild(laserEl);
      document.addEventListener('mousemove',laserMove);
    } else if(t==='lens'){
      lensEl=document.createElement('div');
      lensEl.className='jv-lensbox';   /* T465: not the body flag's name */
      lensEl.style.width=LENS_D+'px';lensEl.style.height=LENS_D+'px';
      lensIn=document.createElement('div');
      lensIn.className='jv-lens-in';
      lensEl.appendChild(lensIn);
      /* INSIDE THE STAGE, not on the body: the slide's type is sized by
         custom properties the stage carries (--talk-text and the rest),
         and a clone on the body inherited none of them -- two letters
         filled the whole lens. Fixed positioning still measures from
         the viewport, so it rides with the pointer all the same. */
      (stage||document.body).appendChild(lensEl);
      document.addEventListener('mousemove',lensMove);
      lensRebuild();
      if(window.MutationObserver&&stage){
        lensObs=new MutationObserver(lensSyncSoon);
        lensObs.observe(stage,{childList:true,subtree:true,attributes:true});
      }
    }
    talkToolsSync();
  }
  function talkBlack(on){
    if(on==null) on=!talkBlackEl;
    if(on&&(mode!=='view'||deckEl.hidden)) on=false;
    if(!on){
      if(talkBlackEl){talkBlackEl.remove();talkBlackEl=null;}
    } else if(!talkBlackEl){
      talkBlackEl=document.createElement('div');
      talkBlackEl.className='jv-black';
      talkBlackEl.title='Black screen — press B, Esc or click to '
        +'bring the slide back';
      talkBlackEl.addEventListener('click',function(e){
        e.stopPropagation();talkBlack(false);});
      document.body.appendChild(talkBlackEl);
    }
    talkToolsSync();
    talkBlackSync();
  }
  /* T574: whichever window blacked it, the presenter view's button
     follows */
  function talkBlackSync(){
    if(typeof presenterPush==='function') presenterPush();
  }
  /* leaving the show puts every tool down: setUIMode calls this */
  function talkToolsReset(){
    if(talkTool) setTalkTool('');
    if(talkBlackEl) talkBlack(false);
  }
  /* the show's keys for these (55-sections-and-strip's key map calls
     this first in view mode); true when the key was taken */
  /* T574: A SLIDE BY ITS NUMBER. PowerPoint's own: type the number the
     strip gives it, then Enter. The digits wait a moment for the next
     one; anything else lets them go. A hidden slide can be reached this
     way, as in PowerPoint -- it is the one way into it during a show. */
  var talkNum='',talkNumT=0;
  function slideAtNumber(n){
    for(var i=0;i<(pres.slides||[]).length;i++)
      if(!slideIsAlt(i)&&slideNo(i)===n) return i;
    return -1;
  }
  function talkNumKey(k){
    if(/^[0-9]$/.test(k)){
      talkNum=(talkNum+k).slice(-4);
      clearTimeout(talkNumT);
      talkNumT=setTimeout(function(){talkNum='';},2500);
      return true;
    }
    if(k==='Enter'&&talkNum){
      var want=+talkNum,at=slideAtNumber(want);
      talkNum='';clearTimeout(talkNumT);
      if(at>=0) go(at); else toast('There is no slide '+want);
      return true;
    }
    talkNum='';
    return false;
  }
  function talkToolKey(e){
    if(mode!=='view'||deckEl.hidden) return false;
    if(e.ctrlKey||e.metaKey||e.altKey) return false;
    var k=String(e.key||'');
    if(talkNumKey(k)) return true;
    if(k==='Escape'&&(talkTool||talkBlackEl)){talkToolsReset();return true;}
    if(k==='p'||k==='P'){setTalkTool('laser');return true;}
    if(k==='m'||k==='M'){setTalkTool('lens');return true;}
    if(k==='b'||k==='B'){talkBlack();return true;}
    /* T476: the presenter window, from the lectern */
    if(k==='n'||k==='N'){
      if(typeof openPresenter==='function') openPresenter();
      return true;
    }
    return false;
  }
  function talkToolsBoot(){
    var la=$('#talk-laser'),le=$('#talk-lens'),bl=$('#talk-black');
    if(la) la.addEventListener('click',function(e){
      e.stopPropagation();setTalkTool('laser');});
    if(le) le.addEventListener('click',function(e){
      e.stopPropagation();setTalkTool('lens');});
    if(bl) bl.addEventListener('click',function(e){
      e.stopPropagation();talkBlack();});
    var pv=$('#talk-presenter');   /* T476 */
    if(pv) pv.addEventListener('click',function(e){
      e.stopPropagation();
      if(typeof openPresenter==='function') openPresenter();
    });
    if(window.SemDeckTalk){
      window.SemDeckTalk.tool=setTalkTool;
      window.SemDeckTalk.black=talkBlack;
    }
    /* Escape puts a tool down BEFORE the editor's own Escape ladder can
       read it as "stop presenting": that ladder runs at capture, so
       this has to as well, and it only speaks when a tool is up */
    document.addEventListener('keydown',function(e){
      if(e.key!=='Escape'||!(talkTool||talkBlackEl)) return;
      if(mode!=='view'||deckEl.hidden) return;
      e.preventDefault();e.stopPropagation();
      talkToolsReset();
    },true);
  }
  /* ---- T581: THE PRESENTING BAR FOLDS AWAY -----------------------------
     (2026-09-30, user: "why does present mode have these options up the
     top. They are distracting and not necessary. I would also want
     options to be things that are collapsable by default not always
     there.") Stop presenting, Open now and Running late sat in a bar
     across the top of the audience's screen for the whole talk. The bar
     is folded away now, and what is left is a faint Controls tab at the
     top edge. Three ways back, none of them needing the bar first: the
     pointer at the top edge (it folds again once the pointer leaves),
     the tab (it stays until Hide), and the keyboard (a focused control
     keeps it open). Esc still stops presenting, and L is still Running
     late. Kept open or not is remembered, the way the other auto-hides
     are. */
  var PRESBAR_KEY='jv-deck-presbar:';
  var presBarPinned=false,presBarT=null;
  function presBarApply(){
    if(!deckEl) return;
    var peek=deckEl.classList.contains('top-peek');
    deckEl.classList.toggle('top-pinned',presBarPinned);
    var h=$('#deck-top-handle');
    if(h) h.setAttribute('aria-expanded',String(presBarPinned||peek));
  }
  function presBarPeek(on){
    clearTimeout(presBarT);presBarT=null;
    if(deckEl) deckEl.classList.toggle('top-peek',!!on);
    presBarApply();
  }
  function presBarPin(on){
    presBarPinned=!!on;
    lsSet(PRESBAR_KEY+SCOPE,presBarPinned?'1':'0',true);
    presBarPeek(false);
  }
  function presBarBoot(){
    presBarPinned=lsGet(PRESBAR_KEY+SCOPE)==='1';
    var h=$('#deck-top-handle'),fold=$('#deck-top-fold');
    var bar=$('#deck-top-bar');
    if(h) h.addEventListener('click',function(e){
      e.stopPropagation();presBarPin(true);});
    if(fold) fold.addEventListener('click',function(e){
      e.stopPropagation();presBarPin(false);
      if(document.activeElement&&document.activeElement.blur)
        document.activeElement.blur();
    });
    /* the top edge brings it; leaving lets it go a beat later, so a
       pointer on its way to a button does not lose the bar under it --
       and never while the Open now drawer it anchors is out */
    if(deckEl) deckEl.addEventListener('mousemove',function(e){
      if(mode!=='view'||presBarPinned) return;
      var peek=deckEl.classList.contains('top-peek');
      if(!peek){if(e.clientY<=6) presBarPeek(true);return;}
      var r=bar?bar.getBoundingClientRect():null;
      var dr=$('#deck-pres-drawer');
      if((r&&e.clientY<=r.bottom+14)||(dr&&!dr.hidden)){
        clearTimeout(presBarT);presBarT=null;return;}
      if(!presBarT) presBarT=setTimeout(function(){
        presBarT=null;
        if(bar&&bar.contains(document.activeElement)) return;
        presBarPeek(false);
      },450);
    });
    presBarApply();
  }
