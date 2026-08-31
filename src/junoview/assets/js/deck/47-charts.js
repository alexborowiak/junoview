  /* ================================================================
     47-charts.js — NATIVE DATA-BOUND CHARTS (T117)

     A figure used to leave for PowerPoint as a picture, so nobody could
     recolour a series on the other side. A chart annotation carries its
     NUMBERS instead: `{k:'chart', ct, cats, series:[{name,ys,color}]}`,
     drawn here as plain SVG (no Plotly, no network — a rendered deck
     opens from file://), and exported by pptx.js as a real <c:chart>
     part that PowerPoint will restyle, retype and recolour natively.

     The notebook-first half is `ref`: a chart born from a placed table
     keeps the card reference the way a figure keeps its provenance, so
     "Update figures from their sources" re-reads the numbers while the
     chart's position, type and colours stay yours. The renderer never
     executes anything — the numbers came from a table someone already
     rendered.

     Deliberate v1 cuts, recorded in TASKS T117: per-series colour
     editing lives in PowerPoint after export (the palette here is
     stable, so re-export keeps your colours consistent); no embedded
     workbook part (values are cached in the chart XML — PowerPoint
     renders and restyles it fully; only its "Edit Data" sheet needs
     the workbook, and that is a second file format); no 3D, stacking,
     or secondary axes.

     This file is a FRAGMENT of the deck IIFE (see 00-page.js): no code
     here runs at eval time beyond declarations and the window export,
     per the T133 rule. */

  /* ---- the data model ------------------------------------------------ */
  var CHART_PALETTE=['#4fb3d9','#f0a848','#8fd18a','#e07a9a',
    '#b39ddb','#f2d16b'];
  var CHART_TYPES=[['bar','Bar'],['line','Line'],
    ['scatter','Scatter'],['pie','Pie']];
  function chartParse(a){
    var cats=(Array.isArray(a&&a.cats)?a.cats:[]).map(function(c){
      return String(c==null?'':c);});
    var series=(Array.isArray(a&&a.series)?a.series:[])
      .map(function(se,si){
        return {name:String((se&&se.name)||('Series '+(si+1))),
          ys:(Array.isArray(se&&se.ys)?se.ys:[]).map(function(v){
            var n=Number(v);return isFinite(n)?n:0;}),
          color:(se&&se.color)||CHART_PALETTE[si%CHART_PALETTE.length]};
      }).filter(function(se){return se.ys.length;});
    var n=cats.length;
    series.forEach(function(se){n=Math.max(n,se.ys.length);});
    while(cats.length<n) cats.push(String(cats.length+1));
    return {cats:cats,series:series,
      numeric:n>0&&cats.every(function(c){
        return c!==''&&isFinite(Number(c));})};
  }
  function chartStep(range){
    if(!(range>0)) return 1;
    var raw=range/4,mag=Math.pow(10,Math.floor(Math.log(raw)/Math.LN10));
    var r=raw/mag;
    return (r>=5?10:r>=2?5:r>=1?2:1)*mag;
  }
  function svgEl(tag){
    return document.createElementNS('http://www.w3.org/2000/svg',tag);
  }
  function svgText(x,y,str,size,fill,anchor){
    var t=svgEl('text');
    t.setAttribute('x',x);t.setAttribute('y',y);
    t.setAttribute('font-size',size);
    t.setAttribute('fill',fill);
    if(anchor) t.setAttribute('text-anchor',anchor);
    t.textContent=str;
    return t;
  }
  /* the whole picture, sized by viewBox so the box scales it; aspect
     comes from the annot's real page shape so a pie stays round */
  function chartSvg(a){
    var d=chartParse(a);
    var pg=pageOf();
    var H=300;
    var W=Math.max(200,Math.min(900,Math.round(
      H*((a.w||30)*pg.mm[0])/(((a.h||24)||1)*pg.mm[1]))));
    var svg=svgEl('svg');
    svg.setAttribute('viewBox','0 0 '+W+' '+H);
    svg.setAttribute('class','an-chartsvg');
    svg.setAttribute('preserveAspectRatio','none');
    var ink='#dbe7ef',dim='#8aa0b0',grid='#8aa0b033';
    var legend=(a.leg!==0)&&(d.series.length>1||a.ct==='pie');
    var T=(a.title?30:12),B=H-(legend?48:30),L=46,R=W-12;
    if(a.title) svg.appendChild(
      svgText(W/2,19,String(a.title),15,ink,'middle'));
    if(!d.series.length){
      svg.appendChild(svgText(W/2,H/2,'No data — right-click '
        +'→ Edit data…',12,dim,'middle'));
      return svg;
    }
    if(a.ct==='pie'){
      var ys=d.series[0].ys.map(function(v){return Math.max(0,v);});
      var tot=ys.reduce(function(x,y){return x+y;},0)||1;
      var cx=W/2,cy=(T+B)/2,r=Math.min(R-L,B-T)/2;
      var a0=-Math.PI/2;
      ys.forEach(function(v,i){
        var a1=a0+(v/tot)*2*Math.PI;
        var p=svgEl('path');
        var x0=cx+r*Math.cos(a0),y0=cy+r*Math.sin(a0);
        var x1=cx+r*Math.cos(a1),y1=cy+r*Math.sin(a1);
        p.setAttribute('d','M'+cx+' '+cy+' L'+x0+' '+y0
          +' A'+r+' '+r+' 0 '+((a1-a0)>Math.PI?1:0)+' 1 '
          +x1+' '+y1+' Z');
        p.setAttribute('fill',CHART_PALETTE[i%CHART_PALETTE.length]);
        svg.appendChild(p);
        a0=a1;
      });
      /* a pie's legend is its categories, one colour each */
      var lx=12;
      d.cats.slice(0,ys.length).forEach(function(c,i){
        var sw=svgEl('rect');
        sw.setAttribute('x',lx);sw.setAttribute('y',H-22);
        sw.setAttribute('width',10);sw.setAttribute('height',10);
        sw.setAttribute('fill',CHART_PALETTE[i%CHART_PALETTE.length]);
        svg.appendChild(sw);
        var label=svgText(lx+14,H-13,c,10,dim);
        svg.appendChild(label);
        lx+=14+Math.max(30,c.length*6)+10;
      });
      return svg;
    }
    /* shared y scale for bar / line / scatter */
    var lo=0,hi=1;
    d.series.forEach(function(se){se.ys.forEach(function(v){
      if(v<lo) lo=v; if(v>hi) hi=v;});});
    if(hi===lo) hi=lo+1;
    var step=chartStep(hi-lo);
    lo=Math.floor(lo/step)*step;hi=Math.ceil(hi/step)*step;
    function Y(v){return B-(v-lo)/(hi-lo)*(B-T);}
    for(var g=lo;g<=hi+step/2;g+=step){
      var gl=svgEl('line');
      gl.setAttribute('x1',L);gl.setAttribute('x2',R);
      gl.setAttribute('y1',Y(g));gl.setAttribute('y2',Y(g));
      gl.setAttribute('stroke',g===0?dim:grid);
      svg.appendChild(gl);
      svg.appendChild(svgText(L-5,Y(g)+3,
        String(Math.round(g*1000)/1000),9,dim,'end'));
    }
    var n=d.cats.length;
    var xs=d.numeric&&a.ct!=='bar'
      ?d.cats.map(function(c){return Number(c);}):null;
    var xlo=xs?Math.min.apply(null,xs):0;
    var xhi=xs?Math.max.apply(null,xs):Math.max(1,n-1);
    if(xhi===xlo) xhi=xlo+1;
    function X(i){
      return xs?L+(xs[i]-xlo)/(xhi-xlo)*(R-L)
        :L+(i+0.5)/n*(R-L);
    }
    /* category labels (numeric x draws its own ticks) */
    if(xs){
      var xstep=chartStep(xhi-xlo);
      for(var xv=Math.ceil(xlo/xstep)*xstep;xv<=xhi+xstep/2;xv+=xstep){
        var px=L+(xv-xlo)/(xhi-xlo)*(R-L);
        svg.appendChild(svgText(px,B+13,
          String(Math.round(xv*1000)/1000),9,dim,'middle'));
      }
    } else {
      d.cats.forEach(function(c,i){
        svg.appendChild(svgText(X(i),B+13,
          c.length>9?c.slice(0,8)+'…':c,9,dim,'middle'));
      });
    }
    if(a.ct==='line'){
      d.series.forEach(function(se){
        var pl=svgEl('polyline');
        pl.setAttribute('points',se.ys.map(function(v,i){
          return X(i)+','+Y(v);}).join(' '));
        pl.setAttribute('fill','none');
        pl.setAttribute('stroke',se.color);
        pl.setAttribute('stroke-width',2);
        svg.appendChild(pl);
        se.ys.forEach(function(v,i){
          var c=svgEl('circle');
          c.setAttribute('cx',X(i));c.setAttribute('cy',Y(v));
          c.setAttribute('r',2.6);c.setAttribute('fill',se.color);
          svg.appendChild(c);
        });
      });
    } else if(a.ct==='scatter'){
      d.series.forEach(function(se){
        se.ys.forEach(function(v,i){
          var c=svgEl('circle');
          c.setAttribute('cx',X(i));c.setAttribute('cy',Y(v));
          c.setAttribute('r',3.4);c.setAttribute('fill',se.color);
          svg.appendChild(c);
        });
      });
    } else {   /* bar, the default */
      var ns=d.series.length,gw=(R-L)/n,bw=gw*0.72/ns;
      d.series.forEach(function(se,si){
        se.ys.forEach(function(v,i){
          var x=L+i*gw+gw*0.14+si*bw;
          var b=svgEl('rect');
          b.setAttribute('x',x);
          b.setAttribute('y',Math.min(Y(v),Y(0)));
          b.setAttribute('width',Math.max(1,bw-1));
          b.setAttribute('height',Math.max(0.5,Math.abs(Y(v)-Y(0))));
          b.setAttribute('fill',se.color);
          svg.appendChild(b);
        });
      });
    }
    if(legend){
      var lx2=L;
      d.series.forEach(function(se){
        var sw2=svgEl('rect');
        sw2.setAttribute('x',lx2);sw2.setAttribute('y',H-22);
        sw2.setAttribute('width',10);sw2.setAttribute('height',10);
        sw2.setAttribute('fill',se.color);
        svg.appendChild(sw2);
        svg.appendChild(svgText(lx2+14,H-13,se.name,10,dim));
        lx2+=14+Math.max(34,se.name.length*6)+10;
      });
    }
    return svg;
  }
  function drawChart(layer,s,a,i){
    var d2=document.createElement('div');
    d2.className='an-item an-chart'+(selAnnot===i?' sel':'');
    var ap=anchorPos(a,a.w,a.h);
    d2.style.left=ap.x+'%';d2.style.top=ap.y+'%';
    d2.style.width=(a.w||30)+'%';d2.style.height=(a.h||24)+'%';
    applyCommon(d2,a);
    d2.setAttribute('data-idx',i);
    d2.appendChild(chartSvg(a));
    layer.appendChild(d2);
  }

  /* ---- born from a table --------------------------------------------- */
  /* rows of strings -> {cats, series}: first row is the header (series
     names), first column the categories. A header the table does not
     have (every cell numeric) is invented as Series 1..n. */
  function chartFromRows(rows){
    rows=(rows||[]).filter(function(r){
      return Array.isArray(r)&&r.length;});
    if(rows.length<2||rows[0].length<2) return null;
    var head=rows[0].map(function(v){return String(v==null?'':v);});
    var headIsData=head.slice(1).every(function(v){
      return v!==''&&isFinite(Number(v));});
    var body=headIsData?rows:rows.slice(1);
    var names=headIsData
      ?head.slice(1).map(function(_,i){return 'Series '+(i+1);})
      :head.slice(1);
    var cats=[],series=names.map(function(nm,i){
      return {name:nm||('Series '+(i+1)),ys:[],
        color:CHART_PALETTE[i%CHART_PALETTE.length]};});
    body.forEach(function(r){
      cats.push(String(r[0]==null?'':r[0]));
      series.forEach(function(se,si){
        var v=Number(r[si+1]);
        se.ys.push(isFinite(v)?v:0);
      });
    });
    series=series.filter(function(se){
      return se.ys.some(function(v){return v!==0;})||se.ys.length;});
    if(!series.length) return null;
    return {cats:cats,series:series};
  }
  function chartRowsOfCard(ref){
    /* the LIVE card's table, read off the open shell the same way the
       provenance pane compares bodies (T20) */
    try{
      var b=cloneBody(ref); if(!b) return null;
      var t=b.querySelector('table'); if(!t) return null;
      return [].map.call(t.querySelectorAll('tr'),function(tr){
        return [].map.call(tr.querySelectorAll('th,td'),function(c){
          return c.textContent.trim();});
      });
    }catch(e){return null;}
  }
  function chartDataOf(a){
    if(a.k==='table') return chartFromRows(tableRows(a));
    if(a.k==='cell'&&a.ref) return chartFromRows(chartRowsOfCard(a.ref));
    return null;
  }
  function placeChart(data,opts){
    var s=pres.slides[cur]; if(!s) return null;
    s.annots=s.annots||[];
    var o=opts||{};
    var a={k:'chart',ct:o.ct||'bar',
      x:o.x!=null?o.x:34,y:o.y!=null?o.y:30,w:o.w||32,h:o.h||34,
      cats:data.cats,series:data.series};
    if(o.ref) a.ref=o.ref;
    if(o.title) a.title=o.title;
    s.annots.push(a);
    markDirty();refresh();
    return a;
  }

  /* ---- editing the numbers ------------------------------------------- */
  function chartCsvOf(a){
    var d=chartParse(a);
    var out=[[''].concat(d.series.map(function(se){return se.name;}))
      .join(', ')];
    d.cats.forEach(function(c,i){
      out.push([c].concat(d.series.map(function(se){
        return se.ys[i]==null?'':se.ys[i];})).join(', '));
    });
    return out.join('\n');
  }
  function chartDlgClose(){
    var p=$('#chart-data'); if(p) p.remove();
  }
  function chartDataDlg(idx){
    chartDlgClose();
    var s=pres.slides[cur];
    var a=s&&(s.annots||[])[idx];
    if(!a||a.k!=='chart') return;
    var p=document.createElement('div');
    p.className='sh-menu chart-data';p.id='chart-data';
    menuHead(p,'the chart’s numbers');
    var note=document.createElement('div');note.className='rd-note';
    note.textContent='One row per category. The first row names the '
      +'series, the first column is the category (numbers make a '
      +'numeric axis for line and scatter).';
    p.appendChild(note);
    var ta=document.createElement('textarea');
    ta.className='chart-ta';
    ta.value=chartCsvOf(a);
    ta.spellcheck=false;
    p.appendChild(ta);
    var rowb=document.createElement('div');rowb.className='chart-btns';
    var ok=document.createElement('button');
    ok.className='dbtn primary';ok.textContent='Apply';
    ok.addEventListener('click',function(e){
      e.stopPropagation();
      var rows=ta.value.split(/\r?\n/).map(function(ln){
        return ln.split(',').map(function(c){return c.trim();});
      }).filter(function(r){return r.join('')!=='';});
      var data=chartFromRows(rows);
      if(!data){toast('Could not read that — a header row plus '
        +'at least one data row, comma-separated');return;}
      /* keep each series' colour where the name survives the edit */
      var old={};chartParse(a).series.forEach(function(se){
        old[se.name]=se.color;});
      data.series.forEach(function(se){
        if(old[se.name]) se.color=old[se.name];});
      a.cats=data.cats;a.series=data.series;
      /* hand-edited numbers are yours now, not the table's */
      delete a.ref;
      markDirty();refresh();chartDlgClose();
      toast('Chart updated — Ctrl+Z undoes it');
    });
    var no=document.createElement('button');
    no.className='dbtn';no.textContent='Cancel';
    no.addEventListener('click',function(e){
      e.stopPropagation();chartDlgClose();});
    rowb.appendChild(ok);rowb.appendChild(no);
    p.appendChild(rowb);
    document.body.appendChild(p);
    ta.focus();
  }

  /* ---- refresh from the source --------------------------------------- */
  /* the chart half of "Update figures from their sources" (T123): a
     chart that still carries `ref` re-reads the table it came from.
     Type, colours, position and size are yours and stay; only the
     numbers move — the same split resyncFigure keeps for snapshots. */
  function chartResyncAll(){
    var nn=0;
    (pres.slides||[]).forEach(function(sl){
      (sl.annots||[]).forEach(function(a){
        if(!a||a.k!=='chart'||!a.ref) return;
        var data=chartFromRows(chartRowsOfCard(a.ref));
        if(!data) return;
        var before=JSON.stringify([chartParse(a).cats,
          chartParse(a).series.map(function(se){return se.ys;})]);
        var after=JSON.stringify([data.cats,
          data.series.map(function(se){return se.ys;})]);
        if(before===after) return;
        var old={};chartParse(a).series.forEach(function(se){
          old[se.name]=se.color;});
        data.series.forEach(function(se){
          if(old[se.name]) se.color=old[se.name];});
        a.cats=data.cats;a.series=data.series;
        nn++;
      });
    });
    if(nn){markDirty();refresh();}
    return nn;
  }
  window.SemDeckChart={place:placeChart,dataOf:chartDataOf,
    fromRows:chartFromRows,dataDlg:chartDataDlg,resync:chartResyncAll,
    svg:chartSvg};
