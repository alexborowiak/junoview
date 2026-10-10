/* The ribbon's no-wrap invariant, read off a live page (opt-in browser
   test: tests/test_ribbon_never_wraps_in_a_browser.py).

   window.__rbnProbe(tag) returns what the user would see wrong with the
   editor ribbon as it stands -- an empty list when it is right -- and
   window.__rbnSettle() resolves once every fit the last gesture asked
   for has run (the frame's fit, and the after-paint check behind it).

   WRONG, for the horizontal ribbon:
   - a second row: a showing group not on the first group's line;
   - a group whose controls spill out of its two tracks;
   - the row running past the bar's edge while any rung or fold is still
     left to take (below the floor the ladder has nothing left, and the
     T498 notice says so -- that case is reported as `floor`, not wrong);
   - a button that has lost its words (CLAUDE.md: words plus icons,
     never icon-only) -- judged against the words it had at the start.
   For the side rail: anything wider than the rail. */
(function(){
  var words=new Map();
  function letters(el){
    var t=(el.textContent||'').replace(/\s+/g,' ');
    return /[A-Za-z0-9]/.test(t);
  }
  function shown(el){return el.getClientRects().length>0;}
  window.__rbnWords=function(){
    document.querySelectorAll('#edit-tools button').forEach(function(b){
      if(!words.has(b)) words.set(b,letters(b));
    });
    return words.size;
  };
  window.__rbnSettle=function(){
    return new Promise(function(res){
      var n=0;
      function step(){
        if(++n>4){res(1);return;}
        requestAnimationFrame(function(){setTimeout(step,0);});
      }
      step();
    });
  };
  window.__rbnProbe=function(tag){
    var bad=[],bar=document.getElementById('edit-tools');
    var deck=document.getElementById('deck');
    if(!bar||bar.hidden||!shown(bar)) return {bad:['no ribbon'],floor:false};
    var side=deck.classList.contains('rbn-side');
    var cw=bar.clientWidth,sw=bar.scrollWidth;
    var gs=[].slice.call(bar.querySelectorAll('.rbn-grp')).filter(function(g){
      return !g.hidden&&!g.hasAttribute('data-off')&&shown(g);});
    var floor=false;
    if(side){
      /* KNOWN, and not the fit's (59cc6b1, before any of the 2026-10-09
         speed work): with a text box or a shape selected, two Object-tab
         groups run 2px into the rail's padding -- the selection's first
         group, which wears the seam (`.et-fmt>.rbn-grp:first-of-type`: a
         4px border and a 2px margin) on top of the rail's width:100%, and
         Appearance, whose Opacity cell (#fmt-opcell) is 203px in 201px.
         The rail has no fit -- it wraps by CSS -- so it is held to exactly
         these and nothing more. */
      var known=0,br=bar.getBoundingClientRect();
      var edge=br.left+bar.clientLeft+cw
        -parseFloat(getComputedStyle(bar).paddingRight||'0');
      gs.forEach(function(g){
        var app=g.matches('.et-fmt>.rbn-grp:first-of-type')
          ||!!g.querySelector('#fmt-opcell');
        var over=Math.max(g.scrollWidth-g.clientWidth,
          g.getBoundingClientRect().right-edge);
        if(over<=1) return;
        if(app&&over<=2.5){known=Math.max(known,Math.ceil(over));return;}
        var lab=g.querySelector(':scope>.rbn-lab');
        var ids=[].map.call(g.querySelectorAll('[id]'),function(e){
          return e.id;}).slice(0,6).join(',');
        bad.push('side group '+(g.className)+' "'+(lab?lab.textContent.trim():'')
          +'" ['+ids+'] runs '+over.toFixed(1)+'px past the rail');
      });
      if(sw>cw+1+known) bad.push('side rail '+sw+' wide in '+cw);
    } else {
      var top=null;
      gs.forEach(function(g){
        var r=g.getBoundingClientRect();
        if(top===null) top=r.top;
        else if(Math.abs(r.top-top)>1)
          bad.push('second row: '+g.className+' at '+Math.round(r.top-top)+'px');
        var row=null;
        for(var c=g.firstElementChild;c;c=c.nextElementSibling)
          if(c.classList.contains('rbn-row')) row=c;
        /* a third track is another 28px; a tile a few px taller than
           the band (the Present group at 1040px, before and after the
           2026-10-09 speed work alike) is not a row */
        if(row&&row.scrollHeight>row.clientHeight+8)
          bad.push('third track in '+g.className+' '+row.scrollHeight+'>'+row.clientHeight);
      });
      if(sw>cw+1){
        /* the ladder is spent when every rung is on and nothing that may
           fold is still open */
        var cl=deck.classList;
        var rungs=['erc-nohint','erc1','erc2','erc3','erc-nostatus','erc-tight']
          .every(function(c){return cl.contains(c);});
        var open=gs.filter(function(g){
          var k=g.classList;
          return !k.contains('rbn-folded')&&!k.contains('rbn-fixed')
            &&!k.contains('rbn-sources')&&!k.contains('rbn-stylesys')
            &&!k.contains('rbn-paragrp')&&!k.contains('rbn-check')
            &&!k.contains('rbn-cancel')&&!!g.querySelector(':scope>.rbn-row');
        });
        if(rungs&&!open.length) floor=true;
        else bad.push('row '+sw+' wide in '+cw+' with the ladder unspent'
          +(rungs?'':' (rungs: '+[].filter.call(cl,function(c){
            return /^erc/.test(c);}).join(' ')+')')
          +(open.length?' (open: '+open.map(function(g){
            return g.className;}).join(', ')+')':''));
      }
    }
    bar.querySelectorAll('button').forEach(function(b){
      if(!shown(b)) return;
      if(words.get(b)&&!letters(b))
        bad.push('lost its words: '+(b.id||b.className));
    });
    return {bad:bad.map(function(x){return tag+': '+x;}),floor:floor,
      state:[].filter.call(deck.classList,function(c){return /^erc/.test(c);}).join(' ')
        +' | '+gs.filter(function(g){return g.classList.contains('rbn-folded');})
          .map(function(g){
            var l=g.querySelector('.rbn-lab');
            return (l&&l.textContent.trim())||g.className;}).join(',')};
  };
})();
