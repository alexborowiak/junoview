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

  /* ---- MERGED CELLS (T551) --------------------------------------------
     "Tables grow up": merge and split cells, fill a cell, and a small
     gallery of table styles. A merge is a REGION, `a.merge` a list of
     [r, c, rows, cols] with its words in the top-left cell -- the cells
     it covers keep a slot in `a.rows` (so every row stays as long as the
     header, the rule tableNormalise keeps) and are drawn by nobody.
     Regions are read through tableMerges, which drops what no longer
     fits the table and the later of two that overlap, so a hand-edited
     or stale list can never draw a cell twice. Rows and columns are
     inserted and removed through tblInsert/tblDelete, which move the
     regions, the fills and every per-column list (widths, what a column
     holds, its footer, its colour rule, the header groups) with them. */
  function tableMerges(a){
    var rows=tableRows(a),nr=rows.length,nc=(rows[0]||[]).length;
    var raw=(a&&Array.isArray(a.merge))?a.merge:[];
    var taken={},out=[];
    raw.forEach(function(m){
      if(!Array.isArray(m)||m.length<4) return;
      var r=m[0]|0,c=m[1]|0,rs=Math.max(1,m[2]|0),cs=Math.max(1,m[3]|0);
      if(r<0||c<0||r>=nr||c>=nc) return;
      rs=Math.min(rs,nr-r);cs=Math.min(cs,nc-c);
      if(rs===1&&cs===1) return;
      var i,j;
      for(i=r;i<r+rs;i++) for(j=c;j<c+cs;j++) if(taken[i+','+j]) return;
      for(i=r;i<r+rs;i++) for(j=c;j<c+cs;j++) taken[i+','+j]=1;
      out.push({r:r,c:c,rs:rs,cs:cs});
    });
    return out;
  }
  /* who draws each cell: null for a plain cell, {rs,cs} for the top-left
     of a region, and {at:[r,c]} for a cell a region covers */
  function tableCover(a){
    var rows=tableRows(a),grid=rows.map(function(row){
      return row.map(function(){return null;});});
    tableMerges(a).forEach(function(m){
      for(var i=m.r;i<m.r+m.rs;i++)
        for(var j=m.c;j<m.c+m.cs;j++)
          grid[i][j]=(i===m.r&&j===m.c)?{rs:m.rs,cs:m.cs}:{at:[m.r,m.c]};
    });
    return grid;
  }
  function tableMergeAt(a,r,c){
    var hit=null;
    tableMerges(a).forEach(function(m){
      if(!hit&&r>=m.r&&r<m.r+m.rs&&c>=m.c&&c<m.c+m.cs) hit=m;});
    return hit;
  }
  function tableMergeWrite(a,list){
    var keep=list.filter(function(m){return m.rs>1||m.cs>1;})
      .map(function(m){return [m.r,m.c,m.rs,m.cs];});
    if(keep.length) a.merge=keep; else delete a.merge;
  }
  /* a cell's own fill: a colour, '@token' or '' -- kept as rows of the
     same shape as a.rows, and absent when no cell has one */
  function tableFillAt(a,r,c){
    var f=a&&a.fills;
    return (Array.isArray(f)&&Array.isArray(f[r])&&f[r][c])||'';
  }
  function tableFillSet(a,r,c,v){
    var rows=tableRows(a),nr=rows.length,nc=(rows[0]||[]).length;
    var f=Array.isArray(a.fills)?a.fills:[];
    var out=[],i,j;
    for(i=0;i<nr;i++){
      var row=[];
      for(j=0;j<nc;j++)
        row.push((Array.isArray(f[i])&&f[i][j])?String(f[i][j]):'');
      out.push(row);
    }
    if(r>=0&&r<nr&&c>=0&&c<nc) out[r][c]=v||'';
    if(out.some(function(row){return row.some(function(x){return x;});}))
      a.fills=out;
    else delete a.fills;
  }
  /* insert ONE row or column before `at` (at === length appends) */
  function tblInsert(a,what,at){
    tableNormalise(a);
    var rows=a.rows,nr=rows.length,nc=(rows[0]||[]).length,i;
    var ms=tableMerges(a),fills=a.fills;
    if(what==='row'){
      at=Math.max(0,Math.min(nr,at));
      var blank=[];for(i=0;i<nc;i++) blank.push('');
      rows.splice(at,0,blank);
      if(Array.isArray(fills)){
        var fb=[];for(i=0;i<nc;i++) fb.push('');
        fills.splice(at,0,fb);
      }
      ms.forEach(function(m){
        if(m.r>=at) m.r++;
        else if(m.r+m.rs>at) m.rs++;     /* the new row runs through it */
      });
    } else {
      at=Math.max(0,Math.min(nc,at));
      rows.forEach(function(row){row.splice(at,0,'');});
      if(Array.isArray(fills)) fills.forEach(function(row){
        if(Array.isArray(row)) row.splice(at,0,'');});
      ms.forEach(function(m){
        if(m.c>=at) m.c++;
        else if(m.c+m.cs>at) m.cs++;
      });
      ['ctype','calc','rules'].forEach(function(k){
        if(Array.isArray(a[k])&&a[k].length>at) a[k].splice(at,0,null);
      });
      if(Array.isArray(a.calc)) a.calc=a.calc.map(function(x){
        return x||'';});
      if(Array.isArray(a.groups)) a.groups.forEach(function(g){
        if((g.at|0)>=at) g.at=(g.at|0)+1;
        else if((g.at|0)+(g.n|0)>at) g.n=(g.n|0)+1;
      });
    }
    tableMergeWrite(a,ms);
    tableNormalise(a);
    if(Array.isArray(a.fills)) tableFillSet(a,-1,-1,'');
  }
  /* remove row or column `at`; a region loses that line, and one left a
     single cell is no region at all */
  function tblDelete(a,what,at){
    tableNormalise(a);
    var rows=a.rows,nr=rows.length,nc=(rows[0]||[]).length;
    if(what==='row'?nr<=1:nc<=1) return false;
    var ms=tableMerges(a),fills=a.fills,out=[];
    if(what==='row'){
      at=Math.max(0,Math.min(nr-1,at));
      /* the words of a region's top-left cell go down a row rather than
         out with the row they started on */
      ms.forEach(function(m){
        if(m.r===at&&m.rs>1&&!String(rows[at+1][m.c]||'').trim())
          rows[at+1][m.c]=rows[at][m.c];
      });
      rows.splice(at,1);
      if(Array.isArray(fills)&&fills.length>at) fills.splice(at,1);
      /* a region whose last row this was goes with it: kept at 0 rows
         it read back as 1 and merged the row that moved up into its
         place (2026-10-06 review) */
      ms.forEach(function(m){
        if(m.r>at){m.r--;out.push(m);}
        else if(m.r+m.rs>at){m.rs--;if(m.rs>0) out.push(m);}
        else out.push(m);
      });
    } else {
      at=Math.max(0,Math.min(nc-1,at));
      ms.forEach(function(m){
        if(m.c===at&&m.cs>1&&!String(rows[m.r][at+1]||'').trim())
          rows[m.r][at+1]=rows[m.r][at];
      });
      rows.forEach(function(row){row.splice(at,1);});
      if(Array.isArray(fills)) fills.forEach(function(row){
        if(Array.isArray(row)&&row.length>at) row.splice(at,1);});
      ms.forEach(function(m){
        if(m.c>at){m.c--;out.push(m);}
        else if(m.c+m.cs>at){m.cs--;if(m.cs>0) out.push(m);}
        else out.push(m);
      });
      ['ctype','calc','rules'].forEach(function(k){
        if(Array.isArray(a[k])&&a[k].length>at) a[k].splice(at,1);
        if(Array.isArray(a[k])&&!a[k].some(function(x){return x;}))
          delete a[k];
      });
      if(Array.isArray(a.groups)){
        a.groups=a.groups.filter(function(g){
          if((g.at|0)>at){g.at=(g.at|0)-1;return true;}
          if((g.at|0)+(g.n|0)>at){g.n=(g.n|0)-1;return g.n>0;}
          return true;
        });
        if(!a.groups.length) delete a.groups;
      }
    }
    tableMergeWrite(a,out);
    tableNormalise(a);
    if(Array.isArray(a.fills)) tableFillSet(a,-1,-1,'');
    return true;
  }
  /* one region over the rectangle; its words are every non-empty cell's
     in reading order, as PowerPoint gathers them -- joined by a space,
     since a cell's words are drawn as one run that wraps */
  function tableMerge(a,r0,c0,r1,c1){
    tableNormalise(a);
    var words=[],i,j;
    for(i=r0;i<=r1;i++) for(j=c0;j<=c1;j++){
      var cov=tableMergeAt(a,i,j);
      if(cov&&(cov.r!==i||cov.c!==j)) continue;
      var w=String(a.rows[i][j]||'').trim();
      if(w) words.push(w);
      if(i!==r0||j!==c0) a.rows[i][j]='';
    }
    a.rows[r0][c0]=words.join(' ');
    var ms=tableMerges(a).filter(function(m){
      return m.r+m.rs-1<r0||m.r>r1||m.c+m.cs-1<c0||m.c>c1;});
    ms.push({r:r0,c:c0,rs:r1-r0+1,cs:c1-c0+1});
    tableMergeWrite(a,ms);
  }
  function tableUnmerge(a,r,c){
    var m=tableMergeAt(a,r,c); if(!m) return false;
    tableMergeWrite(a,tableMerges(a).filter(function(x){
      return x.r!==m.r||x.c!==m.c;}));
    return true;
  }
  /* SPLIT A SINGLE CELL in two, PowerPoint's Split Cells for 2 x 1: a new
     column (or row) beside it, and every other cell on that line merged
     across the new one so only this cell is divided. A merged cell is
     split by taking its region apart (tableUnmerge). */
  function tableSplit(a,r,c,what){
    if(what==='col'){
      var ws=tableCols(a).slice(),w=ws[c]/2;
      tblInsert(a,'col',c+1);
      ws.splice(c,1,w,w);a.cols=ws;
      var ms=tableMerges(a);
      /* a region ENDING on the split column runs across the new one
         too, or its rows grew a stray empty cell beside it (the split
         cell itself is never in a region) */
      ms.forEach(function(m){if(m.c+m.cs-1===c) m.cs++;});
      for(var i=0;i<a.rows.length;i++){
        if(i===r||tableMergeAt(a,i,c)) continue;
        ms.push({r:i,c:c,rs:1,cs:2});
      }
      tableMergeWrite(a,ms);
    } else {
      tblInsert(a,'row',r+1);
      var ms2=tableMerges(a);
      ms2.forEach(function(m){if(m.r+m.rs-1===r) m.rs++;});
      for(var j=0;j<a.rows[0].length;j++){
        if(j===c||tableMergeAt(a,r,j)) continue;
        ms2.push({r:r,c:j,rs:2,cs:1});
      }
      tableMergeWrite(a,ms2);
    }
  }

  /* ---- TABLE STYLES (T551) ----------------------------------------------
     PowerPoint's Table Design, cut to what a slide table wants: a gallery
     of looks and three switches -- Header row (a.thead, which the table
     has had since it was made), Banded rows (a.band) and First column
     (a.first). A look is drawn from the DECK'S colours (the accent, the
     ink, the page), never from fixed ones, so a table follows a colour
     theme the way the words around it do; and it is resolved to plain
     colours here, once, for the slide, the thumbnail and the .pptx alike.
     Precedence, cell by cell: a cell's own fill, then its column's colour
     rule, then the look. */
  var TBL_STYLES=[
    ['','Plain','No fills: the rules and the words'],
    ['soft','Soft','A pale accent header and pale bands'],
    ['accent','Accent','The header in the accent colour'],
    ['ink','Strong','The header in the ink colour, words in the page colour'],
    ['warm','Warm','The header in the warm colour'],
    ['lines','Lines','No fills; a heavier rule under the header']];
  function tblHex(c){
    var rgb=Array.isArray(c)?c:rgbOf(c); if(!rgb) return '';
    return '#'+rgb.map(function(v){
      return ('0'+Math.max(0,Math.min(255,Math.round(v))).toString(16))
        .slice(-2);}).join('');
  }
  /* t of the way from b to a: tblMix(accent, page, .2) is a pale accent */
  function tblMix(a,b,t){
    var x=rgbOf(a),y=rgbOf(b);
    if(!x||!y) return tblHex(a)||tblHex(b);
    return tblHex([0,1,2].map(function(k){return x[k]*t+y[k]*(1-t);}));
  }
  function tblContrast(x,y){
    var p=rgbOf(x),q=rgbOf(y); if(!p||!q) return 1;
    var l1=relLum(p),l2=relLum(q);
    return (Math.max(l1,l2)+0.05)/(Math.min(l1,l2)+0.05);
  }
  /* the look as colours: hd/hdInk the header's fill and words, band the
     banded rows', first the first column's fill, rule the header's
     underline weight (1 is the table's own) */
  function tableLook(a){
    var id=(a&&a.tstyle)||'';
    var page=tblHex(tokVal('@page'))||'#0b141d';
    var ink=tblHex(tokVal(a&&a.color)||tokVal('@ink'))||'#ffffff';
    var acc=tblHex(tokVal('@accent'))||'#39a9c0';
    var warm=tblHex(tokVal('@warm'))||'#ff6b57';
    function on(bg){return tblContrast(bg,ink)>=tblContrast(bg,page)?ink:page;}
    var L={id:id,hd:'',hdInk:'',band:'',first:'',rule:1};
    if(id==='soft'){L.hd=tblMix(acc,page,.40);L.hdInk=on(L.hd);
      L.band=tblMix(acc,page,.14);}
    else if(id==='accent'){L.hd=acc;L.hdInk=on(acc);
      L.band=tblMix(acc,page,.18);}
    else if(id==='ink'){L.hd=ink;L.hdInk=page;L.band=tblMix(ink,page,.11);}
    else if(id==='warm'){L.hd=warm;L.hdInk=on(warm);
      L.band=tblMix(warm,page,.16);}
    else {L.band=tblMix(ink,page,.10);if(id==='lines') L.rule=2.5;}
    if(L.hd) L.first=tblMix(L.hd,page,.30);
    return L;
  }
  /* the words over a cell's OWN fill: the table's ink while it reads
     there (3:1, WCAG's large-text floor, since a slide table is big
     type), else the page colour when that reads better -- so a cell
     filled amber on a dark deck does not keep white words on it */
  function tableInkOver(a,bg){
    var b=tblHex(tokVal(bg)); if(!b) return '';
    var ink=tblHex(tokVal(a&&a.color)||tokVal('@ink'))||'#ffffff';
    var page=tblHex(tokVal('@page'))||'#0b141d';
    if(tblContrast(b,ink)>=3) return '';
    return tblContrast(b,page)>tblContrast(b,ink)?page:'';
  }
  /* one cell's fill, words and weight under the look -- '' where the look
     says nothing, so the table's own colours show through */
  function tableCellLook(a,L,ri,ci,head){
    var o={bg:'',ink:'',b:false};
    if(head){o.bg=L.hd;o.ink=L.hdInk;return o;}
    var from=tableBodyFrom(a);
    if(a.band&&((ri-from)%2===1)) o.bg=L.band;
    if(a.first&&ci===0){o.b=true;if(L.first) o.bg=L.first;}
    return o;
  }
  /* every cell's resolved fill, words and weight, as rows: what the
     .pptx writes, so PowerPoint shows the table the slide does */
  function tableResolvedLook(a){
    var L=tableLook(a),rows=tableRows(a),metas=tableColMeta(a);
    var ranges=metas.map(function(m,ci){
      return (tableRuleOf(a,ci)||{}).kind==='scale'
        ?tableColRange(a,ci,tableBodyFrom(a)):null;});
    return rows.map(function(row,ri){
      return row.map(function(val,ci){
        var head=!!(a.thead&&ri===0);
        var o=tableCellLook(a,L,ri,ci,head);
        var own=tableFillAt(a,ri,ci);
        var rule=head?'':tableRuleFill(a,ci,val,ranges[ci]);
        var bg=own?tokVal(own):(rule?'':o.bg);
        /* a rule is a share of a colour over whatever is under it; the
           .pptx needs a plain colour, so it is mixed over the page */
        if(!own&&rule){
          var m=/color-mix\(in srgb,(.+) (\d+)%,transparent\)/.exec(rule);
          if(m) bg=tblMix(tokVal(m[1]),tokVal('@page'),(+m[2])/100);
        }
        var ink=own?(tableInkOver(a,own)||o.ink):o.ink;
        return {bg:tblHex(bg)||'',ink:ink||'',b:o.b||head};
      });
    });
  }

  /* ---- THE CELL SELECTION (T551) ------------------------------------------
     A table had no cell selection: "a second kind of selection living
     beside the item selection, and nothing else in this editor has one"
     (30-format-bar.js). Merging needs one. It is as small as it can be:
     a click on a cell that does not move the table picks that cell, a
     Shift+click stretches it to a rectangle, typing in a cell picks it,
     and it belongs to the one table that is selected -- choose anything
     else and it is gone. A region is picked whole. The commands read it
     through tblPick(), which answers null when it is stale. */
  var tblSel=null;
  function tblPick(a){
    if(!tblSel||!a||a.k!=='table') return null;
    var s=pres.slides[cur];
    if(tblSel.s!==s||tblSel.i!==selAnnot||(s.annots||[])[tblSel.i]!==a)
      return null;
    var nr=tableRows(a).length,nc=(tableRows(a)[0]||[]).length;
    var r0=Math.min(tblSel.r0,tblSel.r1),r1=Math.max(tblSel.r0,tblSel.r1);
    var c0=Math.min(tblSel.c0,tblSel.c1),c1=Math.max(tblSel.c0,tblSel.c1);
    if(r1>=nr||c1>=nc) return null;
    /* grow until no region is cut by the edge */
    var grew=true,ms=tableMerges(a);
    while(grew){
      grew=false;
      ms.forEach(function(m){
        var hit=m.r<=r1&&m.r+m.rs-1>=r0&&m.c<=c1&&m.c+m.cs-1>=c0;
        if(!hit) return;
        if(m.r<r0){r0=m.r;grew=true;}
        if(m.c<c0){c0=m.c;grew=true;}
        if(m.r+m.rs-1>r1){r1=m.r+m.rs-1;grew=true;}
        if(m.c+m.cs-1>c1){c1=m.c+m.cs-1;grew=true;}
      });
    }
    return {r0:r0,c0:c0,r1:r1,c1:c1,
      n:(r1-r0+1)*(c1-c0+1),one:!!(function(){
        var m=tableMergeAt(a,r0,c0);
        return (r0===r1&&c0===c1)||(m&&m.r===r0&&m.c===c0
          &&m.r+m.rs-1===r1&&m.c+m.cs-1===c1);})()};
  }
  function tblPickCell(i,r,c,extend){
    var s=pres.slides[cur];
    if(extend&&tblSel&&tblSel.s===s&&tblSel.i===i){tblSel.r1=r;tblSel.c1=c;}
    else tblSel={s:s,i:i,r0:r,c0:c,r1:r,c1:c};
    tblPaint();
    if(typeof showFmt==='function') showFmt();
  }
  function tblUnpick(){
    if(!tblSel) return;
    tblSel=null;tblPaint();
  }
  /* the picked cells wear .tc-sel; drawn on the live table without a
     re-render, and again by drawTable on every render after */
  function tblPaint(){
    $$('.an-table td.tc-sel,.an-table th.tc-sel').forEach(function(td){
      td.classList.remove('tc-sel');});
    var s=pres.slides[cur],a=s&&(s.annots||[])[selAnnot];
    var p=tblPick(a); if(!p) return;
    var host=document.querySelector('.deck-stage .an-item.an-table[data-idx="'
      +selAnnot+'"]');
    if(!host) return;
    $$('[data-r]',host).forEach(function(td){
      var r=+td.dataset.r,c=+td.dataset.c;
      if(r>=p.r0&&r<=p.r1&&c>=p.c0&&c<=p.c1) td.classList.add('tc-sel');
    });
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
      askText({title:'Group these columns',multi:true,
        label:'One group per line: first column, how many, label',
        placeholder:'2, 3, 2020\n5, 3, 2021',
        note:'Columns are numbered from 1. Empty removes the groups. '
          +'Ctrl+Enter to apply.',ok:'Apply',
        value:gs.map(function(g){
          return ((g.at|0)+1)+', '+(g.n|0)+', '+(g.text||'');}).join('\n')},
      function(txt){
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
      });
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
