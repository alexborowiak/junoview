/* 22-autocorrect.js — AutoCorrect as you type (T545).
   ONE FRAGMENT of deck.js's single IIFE, concatenated with its
   siblings in the order assets.DECK_PARTS names. It does not parse
   alone and is not meant to: see 00-page.js. */
  /* ---- AUTOCORRECT --------------------------------------------------------
     PowerPoint's, the parts people notice (2026-09-29 audit): straight
     quotes curl, -- is an en dash and a third hyphen makes it an em
     dash, (c) (r) (tm) are the three signs, ... is an ellipsis, and
     -> <- => <=> are arrows.

     1. THE MOMENT THE LAST CHARACTER IS TYPED, as PowerPoint does it,
        and through the browser's own insertText -- so the correction is a
        step of the box's own undo, and Ctrl+Z straight after puts back
        what you typed. That is PowerPoint's way out too.
     2. NOT WHERE IT WOULD BREAK SOMETHING: a Markdown box (its words are
        source), a box set in the mono face (code), an equation, and --
        on the line being typed -- inside $maths$ or `code`: the prime in
        $f'(x)$ has to stay a prime.
     3. ONE SWITCH, Text > AutoCorrect, lit while it is on and kept in
        this browser: a habit of the person, not a fact about the deck.
        The first correction this browser ever makes says what happened
        and offers to turn it off, so nobody meets it without being told
        where the switch is. */
  var AC_KEY='jv-autocorrect',AC_TOLD='jv-autocorrect-told';
  function acOn(){
    try{return localStorage.getItem(AC_KEY)!=='0';}catch(e){return true;}
  }
  function acSet(on){
    try{
      if(on) localStorage.removeItem(AC_KEY);
      else localStorage.setItem(AC_KEY,'0');
    }catch(e){}
    acSync();
  }
  function acSync(){
    var b=$('#tx-autocorrect'); if(!b) return;
    b.setAttribute('aria-pressed',acOn().toString());
  }
  /* longest first: <=> before =>, the em dash before the en dash */
  var AC_RULES=[['<=>','\u21d4'],['(tm)','\u2122'],['(TM)','\u2122'],
    ['(c)','\u00a9'],['(C)','\u00a9'],['(r)','\u00ae'],['(R)','\u00ae'],
    ['...','\u2026'],['\u2013-','\u2014'],['--','\u2013'],
    ['\u2013>','\u2192'],['->','\u2192'],['<-','\u2190'],['=>','\u21d2']];
  /* every rule's last character: anything else is typed straight on */
  var AC_LAST='"\'->).';
  /* a quote OPENS at the start of a line, after a space, an opening
     bracket or a dash, and closes everywhere else -- which is what gives
     "it's" its apostrophe */
  function acQuote(prev,dbl){
    /* an opening brace is asked for by its code: a brace in the
       pattern would throw every brace-counting reader of this file */
    var open=!prev||/[\s(\[\u2014\u2013\u201c\u2018\/-]/.test(prev)
      ||prev.charCodeAt(0)===123;
    if(dbl) return open?'\u201c':'\u201d';
    return open?'\u2018':'\u2019';
  }
  /* the line being typed, up to the caret, read the way caseNodes reads
     a box: a line break wherever a line or a list item begins */
  function acLine(el,node,off){
    var cn=caseNodes(el),at=-1;
    for(var i=0;i<cn.list.length;i++)
      if(cn.list[i].n===node){at=cn.list[i].at+off;break;}
    if(at<0) return null;
    return cn.full.slice(cn.full.lastIndexOf('\n',at-1)+1,at);
  }
  /* inside maths or code on this line: an odd number of $ (an escaped
     \$ is a dollar sign) or of backticks, or an open \( */
  function acGuarded(line){
    var d=(line.replace(/\\\$/g,'').match(/\$/g)||[]).length;
    var b=(line.match(/`/g)||[]).length;
    var po=(line.match(/\\\(/g)||[]).length,pc=(line.match(/\\\)/g)||[]).length;
    return d%2===1||b%2===1||po>pc;
  }
  /* what `line` (ending in the character just typed) becomes: [pattern
     length, replacement], or null */
  function acRule(line){
    var ch=line.charAt(line.length-1);
    if(ch==='"'||ch==='\'')
      return [1,acQuote(line.charAt(line.length-2),ch==='"')];
    for(var i=0;i<AC_RULES.length;i++){
      var r=AC_RULES[i];
      if(line.slice(-r[0].length)===r[0]) return [r[0].length,r[1]];
    }
    return null;
  }
  /* one `input` from a box or a table cell being typed in; `a` is its
     item, for the boxes that are never corrected */
  function autoCorrect(el,e,a){
    if(!e||e.inputType!=='insertText'||e.isComposing) return false;
    var ch=String(e.data||'');
    ch=ch.charAt(ch.length-1);
    if(!ch||AC_LAST.indexOf(ch)<0||!acOn()) return false;
    if(el.classList&&el.classList.contains('an-md')) return false;
    if(a&&(a.md||a.maths||a.font==='mono')) return false;
    var sel=window.getSelection();
    if(!sel||!sel.rangeCount||!sel.isCollapsed) return false;
    var node=sel.focusNode,off=sel.focusOffset;
    if(!node||node.nodeType!==3||!el.contains(node)) return false;
    var line=acLine(el,node,off);
    if(line==null||acGuarded(line)) return false;
    var hit=acRule(line); if(!hit) return false;
    var len=hit[0],was=line.slice(-len);
    /* the whole pattern must be in the text the caret is in: one typed
       across the edge of a bold run is left exactly as typed */
    if(off<len||node.nodeValue.slice(off-len,off)!==was) return false;
    var rg=document.createRange();
    rg.setStart(node,off-len);rg.setEnd(node,off);
    sel.removeAllRanges();sel.addRange(rg);
    try{document.execCommand('insertText',false,hit[1]);}
    catch(err){return false;}
    acTell(was,hit[1]);
    return true;
  }
  function acTell(was,now){
    try{
      if(localStorage.getItem(AC_TOLD)) return;
      localStorage.setItem(AC_TOLD,'1');
    }catch(e){
      if(acTell.done) return;
      acTell.done=true;
    }
    toastUndo('AutoCorrect: '+was+' became '+now+' \u2014 Ctrl+Z straight '
      +'after puts back what you typed.','Turn AutoCorrect off',function(){
        acSet(false);
        toast('AutoCorrect is off \u2014 Text \u203a AutoCorrect turns it '
          +'back on');
      },10000);
  }
  /* the switch, from THE BOOT SEQUENCE */
  function acBoot(){
    var b=$('#tx-autocorrect'); if(!b) return;
    acSync();
    /* the caret stays in the box, so the switch can be flipped mid-word */
    b.addEventListener('mousedown',function(e){
      if(liveTextEditable()) e.preventDefault();});
    b.addEventListener('click',function(){
      var on=!acOn();
      acSet(on);
      toast(on?'AutoCorrect is on \u2014 straight quotes curl, -- is a dash, '
        +'(c) is \u00a9 and -> is \u2192 as you type'
        :'AutoCorrect is off \u2014 what you type stays as typed');
    });
  }
