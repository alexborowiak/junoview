  /* ================================================================
     21-table-columns.js — STRUCTURED TABLES (T324)

     ONE FRAGMENT of deck.js's single IIFE: assets.DECK_PARTS names the
     order, 00-page.js opens the function and 99-boot.js closes it. It
     does not parse alone; check the ASSEMBLED file.

     The user's list, item 5: "Structured tables: column types, decimal
     alignment, number formats, conditional formatting, merged headers,
     formulas".

     Six requests, ONE idea: A COLUMN KNOWS WHAT IT HOLDS. Everything
     else follows from the type -- a numeric column right-aligns, pads to
     a common number of decimals (which IS decimal alignment), takes a
     thousands separator and a unit, can be coloured by its own values
     and can be totalled. A text column does none of that. So the model
     is one array beside `cols`, not six new keys.

     `a.ctype[i]` = {t, dp, thou, pre, suf, align} and every field is
     optional: an ABSENT type is INFERRED from the cells, so a table
     scraped out of a notebook -- which is where most of them come from
     here -- arrives already aligned and already totalable with nothing
     configured. Typing over a number does not silently change its
     column's mind, because inference reads the whole column.

     `a.calc[i]` names a footer function for column i; `a.rules[i]` is
     its conditional format; `a.groups` is the spanning row above the
     header. All three are plain data, so they survive the deck file,
     the undo stack and the .pptx the same way the rows do.

     Nothing here runs at load time: tablePaneBoot() is called from THE
     BOOT SEQUENCE. */

  /* ---- WHAT IS A NUMBER ---------------------------------------------
     Deliberately generous, because these cells come from a rendered
     notebook: a thousands separator, a leading currency mark, a
     trailing unit or per-cent, a minus sign that might be a hyphen or a
     real U+2212, and parentheses for negatives (which is how a lot of
     tabular output writes them). Anything else is text. */
  var TBL_NUM_RE=/^[\s ]*\(?\s*([-−+]?)\s*[$£€]?\s*([0-9][0-9,  ]*(?:\.[0-9]+)?|\.[0-9]+)\s*(%|[a-zA-Z°µ/²³]{0,6})\s*\)?[\s ]*$/;
  function tableNum(v){
    if(v==null) return null;
    if(typeof v==='number') return isFinite(v)?v:null;
    var s=String(v);
    if(!s.trim()) return null;
    var m=TBL_NUM_RE.exec(s);
    if(!m) return null;
    var n=Number(m[2].replace(/[,  ]/g,''));
    if(!isFinite(n)) return null;
    if(m[1]==='-'||m[1]==='−') n=-n;
    else if(/^\s*\(/.test(s)&&/\)\s*$/.test(s)) n=-n;
    return n;
  }
  /* how many decimals a cell shows, for the "pad them all the same"
     rule that makes a column line up on its point */
  function tableDp(v){
    var m=/\.([0-9]+)/.exec(String(v==null?'':v));
    return m?m[1].length:0;
  }
  /* the rows a column's VALUES live in: every row but the header */
  function tableBodyFrom(a){return (a&&a.thead)?1:0;}
  /* WHAT EACH COLUMN HOLDS. An explicit a.ctype[i] wins; otherwise the
     column is numeric when it has at least one number in it and nothing
     that is neither a number nor blank. One empty cell does not make a
     numeric column text -- a gap in a table is a gap, not a word. */
  function tableColMeta(a){
    var rows=tableRows(a),n=(rows[0]||[]).length;
    var from=tableBodyFrom(a),out=[],ci;
    for(ci=0;ci<n;ci++){
      var set=(a&&a.ctype&&a.ctype[ci])||{};
      var nums=0,words=0,dp=0,ri;
      for(ri=from;ri<rows.length;ri++){
        var raw=(rows[ri]||[])[ci];
        if(raw==null||!String(raw).trim()) continue;
        var num=tableNum(raw);
        if(num==null){words++;continue;}
        nums++;
        dp=Math.max(dp,tableDp(raw));
      }
      var t=set.t||((nums&&!words)?'num':'text');
      var m={t:t,
        dp:(set.dp!=null&&set.dp!=='')?Math.max(0,Math.min(9,set.dp|0)):dp,
        thou:set.thou?1:0,
        pre:String(set.pre||''),suf:String(set.suf||''),
        align:set.align||(t==='num'?'right':'')};
      out.push(m);
    }
    return out;
  }
  function tableThou(s){
    var p=String(s).split('.');
    p[0]=p[0].replace(/\B(?=(\d{3})+(?!\d))/g,' ');
    return p.join('.');
  }
  /* one cell, as it is READ. A number becomes its own column's number:
     the same decimals, so the points line up under one another; the
     separator and the unit if the column wears them. Anything the
     column cannot read as a number is left exactly as it was typed --
     a footnote marker in a numeric column is still a footnote marker. */
  function tableFmtCell(v,m){
    if(!m||m.t!=='num') return v==null?'':String(v);
    var n=tableNum(v);
    if(n==null) return v==null?'':String(v);
    var s=Math.abs(n).toFixed(m.dp);
    if(m.thou) s=tableThou(s);
    return (n<0?'−':'')+m.pre+s+m.suf;
  }
  /* ---- THE FOOTER (the "formulas" half) ------------------------------
     Five functions, over the column's own numbers, and no expression
     language: a slide table wants a total or a mean under a column, and
     a spreadsheet grammar in a presentation is a second product. The
     row is COMPUTED at draw time, never stored, so editing a cell moves
     it and nothing can go stale. */
  var TBL_CALCS=[['','None'],['sum','Sum'],['mean','Mean'],
    ['min','Minimum'],['max','Maximum'],['count','Count']];
  function tableCalcOne(vals,fn){
    if(!fn||!vals.length) return null;
    if(fn==='count') return vals.length;
    if(fn==='min') return Math.min.apply(null,vals);
    if(fn==='max') return Math.max.apply(null,vals);
    var t=0;vals.forEach(function(v){t+=v;});
    return fn==='mean'?t/vals.length:t;
  }
  function tableHasCalc(a){
    return !!(a&&Array.isArray(a.calc)&&a.calc.some(function(c){return c;}));
  }
  /* the footer row as display strings, or null when no column asks for
     one. `count` is a count and never wears the column's unit. */
  function tableCalcRow(a,metas){
    if(!tableHasCalc(a)) return null;
    var rows=tableRows(a),from=tableBodyFrom(a);
    return (metas||tableColMeta(a)).map(function(m,ci){
      var fn=(a.calc||[])[ci];
      if(!fn) return '';
      var vals=[];
      for(var ri=from;ri<rows.length;ri++){
        var num=tableNum((rows[ri]||[])[ci]);
        if(num!=null) vals.push(num);
      }
      var got=tableCalcOne(vals,fn);
      if(got==null) return '';
      if(fn==='count') return String(got);
      var mm=m;
      if(fn==='mean'&&Math.abs(got-Math.round(got))>1e-9&&m.dp<2){
        mm={};for(var k in m) mm[k]=m[k];
        mm.dp=2;
      }
      return tableFmtCell(String(got),mm);
    });
  }
  /* ---- CONDITIONAL FORMAT --------------------------------------------
     Two rules, because they are the two a table on a slide is for:
     "colour this column by its own values" and "mark the ones over (or
     under) a threshold". A rule paints the cell's BACKGROUND and leaves
     the words alone, so it never fights the deck's ink. */
  var TBL_RULES=[['','None'],['scale','Colour by value'],
    ['above','Above a number'],['below','Below a number']];
  function tableRuleOf(a,ci){
    var r=(a&&a.rules&&a.rules[ci])||null;
    return (r&&r.kind)?r:null;
  }
  function tableColRange(a,ci,from){
    var rows=tableRows(a),lo=Infinity,hi=-Infinity;
    for(var ri=from;ri<rows.length;ri++){
      var n=tableNum((rows[ri]||[])[ci]);
      if(n==null) continue;
      if(n<lo) lo=n; if(n>hi) hi=n;
    }
    return isFinite(lo)?{lo:lo,hi:hi}:null;
  }
  /* the cell's fill for a rule, or '' */
  function tableRuleFill(a,ci,val,range){
    var r=tableRuleOf(a,ci);
    if(!r) return '';
    var n=tableNum(val);
    if(n==null) return '';
    var col=tokVal(r.color)||'#39a9c0';
    if(r.kind==='scale'){
      if(!range||range.hi===range.lo) return '';
      var f=(n-range.lo)/(range.hi-range.lo);
      /* a share of the colour, so the column reads as one ramp rather
         than as a set of unrelated tints */
      return 'color-mix(in srgb,'+col+' '
        +Math.round(6+f*52)+'%,transparent)';
    }
    var at=(r.at===''||r.at==null)?NaN:Number(r.at);
    if(!isFinite(at)) return '';
    var hit=(r.kind==='above')?(n>at):(n<at);
    return hit?('color-mix(in srgb,'+col+' 34%,transparent)'):'';
  }
  /* ---- MERGED HEADERS -------------------------------------------------
     A row ABOVE the header that spans groups of columns -- "2020" over
     three months, "2021" over the next three. Stored as a list of
     {at, n, text}; anything a group does not cover is a blank cell, so
     the row is always exactly as wide as the table. */
  function tableGroups(a){
    var n=(tableRows(a)[0]||[]).length;
    var raw=(a&&Array.isArray(a.groups))?a.groups:[];
    var out=[],at=0;
    raw.slice().sort(function(x,y){return (x.at|0)-(y.at|0);})
      .forEach(function(g){
        var gAt=Math.max(at,g.at|0),gN=Math.max(1,g.n|0);
        if(gAt>=n) return;
        gN=Math.min(gN,n-gAt);
        if(gAt>at) out.push({at:at,n:gAt-at,text:''});
        out.push({at:gAt,n:gN,text:String(g.text||'')});
        at=gAt+gN;
      });
    if(at<n) out.push({at:at,n:n-at,text:''});
    return out.length&&raw.length?out:null;
  }
  /* ---- WHAT THE EXPORTS AND THE SCRAPERS SEE -------------------------
     One list of rows, formatted, with the group row on top and the
     footer underneath -- so the .pptx, the PDF, the review markdown and
     the standalone HTML all show the table the slide shows, instead of
     the raw cells with the structure quietly dropped. */
  function tableViewRows(a){
    var metas=tableColMeta(a);
    var rows=tableRows(a).map(function(row,ri){
      return row.map(function(v,ci){
        return (a.thead&&ri===0)?(v==null?'':String(v))
          :tableFmtCell(v,metas[ci]);
      });
    });
    var gs=tableGroups(a);
    if(gs){
      var g=[];
      gs.forEach(function(one){
        for(var k=0;k<one.n;k++) g.push(k===0?one.text:'');
      });
      rows.unshift(g);
    }
    var calc=tableCalcRow(a,metas);
    if(calc) rows.push(calc);
    return rows;
  }

  /* ---- THE TABLE PANE ------------------------------------------------
     Per COLUMN, because that is what the feature is about, and one
     column at a time so the pane is a column's card rather than a
     spreadsheet of its own. */
  var tablePaneCol=0;
  function tablePaneItem(){
    var s=pres.slides[cur];
    var a=(s&&typeof selAnnot==='number')?(s.annots||[])[selAnnot]:null;
    return (a&&a.k==='table')?a:null;
  }
  function showTablePane(on){
    var p=$('#tablepane'); if(!p) return;
    if(on){paneShow('tablepane');tablePaneSync();}
    else paneHide('tablepane');
  }
  function tablePaneWrite(fn){
    var a=tablePaneItem(); if(!a) return;
    fn(a);
    markDirty();renderSlide();tablePaneSync();
  }
  function tableSetCol(a,ci,key,val){
    a.ctype=a.ctype||[];
    while(a.ctype.length<=ci) a.ctype.push(null);
    var m=a.ctype[ci]||{};
    if(val===''||val==null) delete m[key]; else m[key]=val;
    a.ctype[ci]=Object.keys(m).length?m:null;
    if(!a.ctype.some(function(x){return x;})) delete a.ctype;
  }
  /* the same busy rule the Chart pane learned the hard way (T322's
     review): a write renders the slide, the slide syncs the panes, and a
     pane that rebuilt itself under the pointer destroyed the control
     being used. */
  var tablePaneAt=null;
  function tablePaneBusy(){
    var p=$('#tablepane');
    return !!(p&&!p.hidden&&p.contains(document.activeElement)
      &&document.activeElement!==document.body);
  }
  function tablePaneSync(){
    var p=$('#tablepane'); if(!p||p.hidden) return;
    var body=$('#tablepane-body'); if(!body) return;
    var a=tablePaneItem();
    if(a&&a===tablePaneAt&&tablePaneBusy()) return;
    tablePaneAt=a;
    body.innerHTML='';
    function lab(t,cls){
      var l=document.createElement('div');
      l.className='np-lab'+(cls?' '+cls:'');
      l.textContent=t;body.appendChild(l);return l;
    }
    if(!a){lab('Select a table on the slide');return;}
    var rows=tableRows(a),metas=tableColMeta(a);
    var ncol=(rows[0]||[]).length;
    if(tablePaneCol>=ncol) tablePaneCol=0;
    function row(cls){
      var r=document.createElement('div');
      r.className='np-row tp-row'+(cls?' '+cls:'');
      body.appendChild(r);return r;
    }
    function btn(host,label,on,fn,title){
      var b=document.createElement('button');
      b.className='dbtn tp-btn'+(on?' on':'');b.textContent=label;
      if(title) b.title=title;
      b.setAttribute('aria-pressed',(!!on).toString());
      b.addEventListener('click',function(e){e.stopPropagation();fn();});
      host.appendChild(b);return b;
    }
    function field(host,val,ph,wide,fn){
      var i=document.createElement('input');
      i.className='np-goal tp-in'+(wide?' tp-wide':'');
      i.type='text';i.value=(val==null?'':String(val));
      i.placeholder=ph||'';
      i.addEventListener('keydown',function(e){
        e.stopPropagation();if(e.key==='Enter') i.blur();});
      i.addEventListener('change',function(){
        tablePaneWrite(function(){fn(i.value.trim());});});
      host.appendChild(i);return i;
    }
    /* which column this card is about */
    lab('Column');
    var cr=row('tp-cols');
    for(var ci=0;ci<ncol;ci++){
      (function(k){
        var head=(a.thead&&rows[0]&&rows[0][k])?String(rows[0][k]):'';
        btn(cr,head?head.slice(0,12):('Column '+(k+1)),
          k===tablePaneCol,function(){
            tablePaneCol=k;tablePaneSync();},
          'Set what column '+(k+1)+' holds');
      })(ci);
    }
    var m=metas[tablePaneCol]||{t:'text'};
    var set=(a.ctype&&a.ctype[tablePaneCol])||{};
    lab('Holds');
    var tr2=row();
    [['','Whatever it looks like'],['num','Numbers'],['text','Text']]
      .forEach(function(o){
        btn(tr2,o[1],(set.t||'')===o[0],function(){
          tablePaneWrite(function(){
            tableSetCol(a,tablePaneCol,'t',o[0]);});},
          o[0]?'':'Read from the cells: a column of numbers is numeric');
      });
    if(m.t==='num'){
      lab('Decimals · they all take the same, which is what lines '
        +'the column up on its point','tp-hint');
      var nr=row();
      field(nr,set.dp,String(m.dp),false,function(v){
        tableSetCol(a,tablePaneCol,'dp',v===''?'':(v|0));});
      btn(nr,'Thousands',!!m.thou,function(){
        tablePaneWrite(function(){
          tableSetCol(a,tablePaneCol,'thou',m.thou?'':1);});},
        'A thin space every three digits');
      lab('Before and after each number');
      var ur=row();
      field(ur,set.pre,'£',false,function(v){
        tableSetCol(a,tablePaneCol,'pre',v);});
      field(ur,set.suf,'%  km  °C',false,function(v){
        tableSetCol(a,tablePaneCol,'suf',v);});
      lab('Footer');
      var fr=row();
      TBL_CALCS.forEach(function(c){
        btn(fr,c[1],((a.calc||[])[tablePaneCol]||'')===c[0],function(){
          tablePaneWrite(function(a2){
            a2.calc=a2.calc||[];
            while(a2.calc.length<ncol) a2.calc.push('');
            a2.calc[tablePaneCol]=c[0];
            if(!a2.calc.some(function(x){return x;})) delete a2.calc;
          });},
          c[0]?('A row under the table with this column’s '
            +c[1].toLowerCase()):'');
      });
      lab('Colour the cells by their values');
      var rr=row(),rule=tableRuleOf(a,tablePaneCol)||{};
      TBL_RULES.forEach(function(c){
        btn(rr,c[1],(rule.kind||'')===c[0],function(){
          tablePaneWrite(function(a2){
            a2.rules=a2.rules||[];
            while(a2.rules.length<ncol) a2.rules.push(null);
            a2.rules[tablePaneCol]=c[0]
              ?{kind:c[0],at:rule.at,color:rule.color||'@accent'}:null;
            if(!a2.rules.some(function(x){return x;})) delete a2.rules;
          });});
      });
      if(rule.kind){
        var rr2=row();
        if(rule.kind!=='scale')
          field(rr2,rule.at,'number',false,function(v){
            tablePaneWrite(function(a2){
              a2.rules[tablePaneCol].at=v;});});
        var ciCol=document.createElement('input');
        ciCol.type='color';ciCol.className='tp-col';
        ciCol.title='The colour it paints';
        ciCol.value=/^#[0-9a-f]{6}$/i.test(tokVal(rule.color)||'')
          ?tokVal(rule.color):'#39a9c0';
        ciCol.addEventListener('change',function(){
          tablePaneWrite(function(a2){
            a2.rules[tablePaneCol].color=ciCol.value;});});
        rr2.appendChild(ciCol);
      }
    } else {
      lab('A text column is left as it was typed. Set it to Numbers to '
        +'align it, format it, total it or colour it.','tp-hint');
    }
    /* the spanning row above the header */
    lab('Header groups');
    var gr=row();
    var gs=(a.groups||[]);
    var gAt=document.createElement('span');
    gAt.className='tp-hint';
    gAt.textContent=gs.length
      ?(gs.length+' group'+(gs.length===1?'':'s')):'none';
    btn(gr,'Group these columns…',false,function(){
      var txt=prompt('One group per line, as "first column, how many, '
        +'label" — for example:\n\n2, 3, 2020\n5, 3, 2021\n\n'
        +'Columns are numbered from 1. Leave empty to remove them.',
        gs.map(function(g){
          return ((g.at|0)+1)+', '+(g.n|0)+', '+(g.text||'');}).join('\n'));
      if(txt==null) return;
      var made=[];
      String(txt).split(/\r?\n/).forEach(function(ln){
        if(!ln.trim()) return;
        var bits=ln.split(',');
        var at=parseInt(bits[0],10),nn=parseInt(bits[1],10);
        if(!isFinite(at)||!isFinite(nn)) return;
        made.push({at:Math.max(0,at-1),n:Math.max(1,nn),
          text:bits.slice(2).join(',').trim()});
      });
      tablePaneWrite(function(a2){
        if(made.length) a2.groups=made; else delete a2.groups;});
    },'A row above the header spanning groups of columns');
    gr.appendChild(gAt);
  }
  function tablePaneBoot(){
    var b=$('#fmt-table'),p=$('#tablepane');
    if(b&&p) b.addEventListener('click',function(){showTablePane(p.hidden);});
    var cl=$('#tablepane-close');
    if(cl) cl.addEventListener('click',function(){showTablePane(false);});
    window.SemDeckTable={pane:showTablePane,meta:tableColMeta,
      fmt:tableFmtCell,view:tableViewRows,calc:tableCalcRow,
      num:tableNum,groups:tableGroups};
  }
