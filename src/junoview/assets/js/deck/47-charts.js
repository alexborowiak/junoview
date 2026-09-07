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
    function nums(arr){
      return (Array.isArray(arr)?arr:[]).map(function(v){
        var n=Number(v);return isFinite(n)?n:0;});
    }
    function numsOrNull(arr){
      return (Array.isArray(arr)?arr:[]).map(function(v){
        if(v==null||v==='') return null;
        var n=Number(v);return isFinite(n)?n:null;});
    }
    var series=(Array.isArray(a&&a.series)?a.series:[])
      .map(function(se,si){
        var o={name:String((se&&se.name)||('Series '+(si+1))),
          ys:nums(se&&se.ys),
          color:(se&&se.color)||CHART_PALETTE[si%CHART_PALETTE.length]};
        /* T322: what a series may also carry -- a second axis, a
           trend line, a line drawn over a bar chart, error bars, a
           confidence band, and being hidden from the plot */
        if(se&&se.axis==='y2') o.axis='y2';
        if(se&&se.trend) o.trend='linear';
        if(se&&se.ct==='line') o.ct='line';
        if(se&&se.hide) o.hide=1;
        if(se&&Array.isArray(se.err)&&se.err.length) o.err=numsOrNull(se.err);
        if(se&&se.band&&Array.isArray(se.band.lo)&&Array.isArray(se.band.hi))
          o.band={lo:numsOrNull(se.band.lo),hi:numsOrNull(se.band.hi)};
        return o;
      }).filter(function(se){return se.ys.length;});
    var n=cats.length;
    series.forEach(function(se){n=Math.max(n,se.ys.length);});
    while(cats.length<n) cats.push(String(cats.length+1));
    var stack=(a&&a.stack==='pct')?'pct':((a&&a.stack)?'std':'');
    var ylog=!!(a&&a.ylog);
    if(stack&&(a&&a.ct||'bar')==='bar') ylog=false;
    return {cats:cats,series:series,
      numeric:n>0&&cats.every(function(c){
        return c!==''&&isFinite(Number(c));}),
      /* T322: the chart-wide switches, normalised. STACKING WINS OVER
         A LOG AXIS, decided here and nowhere else: a stack is a sum of
         parts and a log axis has no addition on it, so the two cannot
         both be honoured. The renderer used to drop the stacking
         silently while the pane showed it pressed and the .pptx went
         out stacked -- three surfaces, three answers (found by the
         2026-09-07 review of 030392a). Now every reader of chartParse
         gets the same one, and the pane says which lost. */
      stack:stack,
      ylog:ylog,labels:!!(a&&a.labels),
      xlab:String((a&&a.xlab)||''),ylab:String((a&&a.ylab)||''),
      y2lab:String((a&&a.y2lab)||'')};
  }
  function chartStep(range){
    if(!(range>0)) return 1;
    var raw=range/4,mag=Math.pow(10,Math.floor(Math.log(raw)/Math.LN10));
    var r=raw/mag;
    return (r>=5?10:r>=2?5:r>=1?2:1)*mag;
  }
  /* ---- THE ARITHMETIC (T322), pure so a test can run it ------------ */
  /* the y scale for a set of values: linear from the data, zero forced
     when asked (a bar's length IS its value), or log10 over the positive
     values with the axis snapped to whole decades */
  function chartScale(vals,opts){
    opts=opts||{};
    var lo=Infinity,hi=-Infinity;
    (vals||[]).forEach(function(v){
      if(v==null||!isFinite(v)) return;
      if(opts.log&&v<=0) return;
      if(v<lo) lo=v; if(v>hi) hi=v;
    });
    if(!isFinite(lo)||!isFinite(hi)){lo=opts.log?1:0;hi=opts.log?10:1;}
    if(opts.log){
      var da=Math.floor(Math.log(lo)/Math.LN10+1e-9);
      var db=Math.ceil(Math.log(hi)/Math.LN10-1e-9);
      if(db<=da) db=da+1;
      return {lo:Math.pow(10,da),hi:Math.pow(10,db),step:0,log:true,
        decades:[da,db]};
    }
    if(opts.zero){if(lo>0) lo=0; if(hi<0) hi=0;}
    if(hi===lo){lo-=0.5;hi+=0.5;}
    var step=chartStep(hi-lo);
    lo=Math.floor(lo/step)*step;hi=Math.ceil(hi/step)*step;
    return {lo:lo,hi:hi,step:step,log:false};
  }
  function chartTicks(sc){
    var out=[];
    if(sc.log){
      for(var d=sc.decades[0];d<=sc.decades[1];d++) out.push(Math.pow(10,d));
      return out;
    }
    for(var g=sc.lo;g<=sc.hi+sc.step/2;g+=sc.step)
      out.push(Math.round(g*1e6)/1e6);
    return out;
  }
  /* where a value sits along its axis, 0..1; NaN when it cannot be
     placed (a non-positive value on a log axis) */
  function chartPos(sc,v){
    if(v==null||!isFinite(v)) return NaN;
    if(sc.log){
      if(!(v>0)) return NaN;
      return (Math.log(v)-Math.log(sc.lo))/(Math.log(sc.hi)-Math.log(sc.lo));
    }
    return (v-sc.lo)/(sc.hi-sc.lo);
  }
  /* least squares y = m x + b over the finite pairs, or null */
  function chartLinFit(xs,ys){
    var n=0,sx=0,sy=0,sxx=0,sxy=0;
    for(var i=0;i<xs.length&&i<ys.length;i++){
      var x=+xs[i],y=+ys[i];
      if(!isFinite(x)||!isFinite(y)) continue;
      n++;sx+=x;sy+=y;sxx+=x*x;sxy+=x*y;
    }
    if(n<2) return null;
    var den=n*sxx-sx*sx;
    if(!den) return null;
    var m=(n*sxy-sx*sy)/den;
    return {m:m,b:(sy-m*sx)/n,n:n};
  }
  /* stacked bars: each series' segment per category, positives piling
     up and negatives piling down; `pct` scales every stack to 100 */
  function chartStackTops(series,n,pct){
    var up=[],down=[],tot=[],i;
    for(i=0;i<n;i++){up[i]=0;down[i]=0;tot[i]=0;}
    if(pct) series.forEach(function(se){
      for(i=0;i<n;i++) tot[i]+=Math.abs(+se.ys[i]||0);});
    return series.map(function(se){
      var seg=[];
      for(i=0;i<n;i++){
        var v=+se.ys[i]||0;
        if(pct) v=tot[i]?v/tot[i]*100:0;
        if(v>=0){seg[i]={y0:up[i],y1:up[i]+v,v:v};up[i]+=v;}
        else{seg[i]={y0:down[i],y1:down[i]+v,v:v};down[i]+=v;}
      }
      return seg;
    });
  }
  /* A NUMBER IS FORMATTED AGAINST ITS NEIGHBOUR, not against zero.
     Given the spacing it is being read at -- an axis step -- this keeps
     exactly the places that tell one tick from the next, so an axis of
     0, 0.005, 0.01, 0.015 reads as itself instead of 0, 0, 0.01, 0.01
     (2026-09-07 review; the pre-T322 tick code printed three places and
     T322 replaced it with two). With no spacing to go on -- a data
     label, a log decade -- it keeps three significant figures, which is
     what a label on a mark wants. */
  function chartFmt(v,step){
    if(v==null||!isFinite(v)) return '';
    var s=Math.abs(+step||0);
    if(s>0){
      var dp=Math.max(0,Math.min(6,
        Math.ceil(-Math.log(s)/Math.LN10)));
      var p=Math.pow(10,dp);
      return String(Math.round(v*p)/p);
    }
    if(v===0) return '0';
    return String(Number(v.toPrecision(3)));
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
  /* how many addressable series this chart has. One number, used by the
     timeline (extraStops) and by the renderer, so they cannot disagree
     about how many clicks a chart is worth (T160). Pie is excluded: its
     slices are CATEGORIES, and "reveal one category at a time" is a
     different feature with a different meaning. */
  /* HIDDEN SERIES ARE NOT ADDRESSABLE. chartSvg draws no <g> for one,
     so counting it here spent a click of the slow reveal on nothing at
     all -- the audience pressed space and the plot did not change
     (2026-09-07 review). Hiding a series therefore shortens the build,
     which is the only honest answer; a tie naming a hidden series stops
     resolving and fails OPEN, like every other unresolvable tie. */
  function chartShownSeries(a){
    return chartParse(a).series.filter(function(se){return !se.hide;});
  }
  function chartSeriesCount(a){
    if(!a||a.k!=='chart'||a.ct==='pie') return 0;
    return chartShownSeries(a).length;
  }
  /* THE NAMES, in build order, and the one place they are read off.
     drawChart, the tie picker and seriesShows all address a series by
     name (T159/T160) -- three copies of `chartParse(a).series.map(...)`
     is three chances for one of them to start disagreeing about what a
     series is called, which is the whole failure mode a name-keyed
     build exists to avoid. Pie is excluded here for the same reason it
     is excluded above: its slices are categories, not series. */
  function chartSeriesNames(a){
    if(!a||a.k!=='chart'||a.ct==='pie') return [];
    return chartShownSeries(a).map(function(se){return se.name;});
  }
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
    /* ---- WHICH MARKS BELONG TO WHICH SERIES (T159) ------------------
       Every mark used to be appended straight onto the <svg>. The loops
       below have always KNOWN which series they were drawing -- they sit
       inside `d.series.forEach(function(se){...})` -- and threw that
       away on the append, leaving one flat bag of shapes. A build step
       cannot address what has no name.

       So each series' marks go into their own `<g data-series="NAME">`,
       and everything that is not a series -- title, gridlines, axis
       labels, category labels, the legend -- goes into the SKELETON
       group. That is the split the "slow reveal" wants: axes first, then
       one series at a time.

       Keyed by NAME, never by index, and that is the whole durability
       story. `chartResyncAll` already replaces `a.series` wholesale on a
       refresh and carries the author's per-series COLOUR across by
       matching `se.name` -- so a build order keyed the same way survives
       a column being added, removed or reordered upstream. PowerPoint's
       animation list is keyed to shape index, which is exactly why it
       breaks when the data changes under it. */
    var gSkel=svgEl('g');
    gSkel.setAttribute('data-part','skeleton');
    svg.appendChild(gSkel);
    var gSeries={};
    function seriesG(name){
      var k=String(name==null?'':name);
      if(!gSeries[k]){
        var g=svgEl('g');
        g.setAttribute('data-series',k);
        svg.appendChild(g);
        gSeries[k]=g;
      }
      return gSeries[k];
    }
    /* T288: THE PAGE'S INK, NOT THE EDITOR'S. These three were the
       dark chrome's colours written as literals, so every chart on a
       LIGHT page -- which is every poster, since a new one starts white
       -- drew its title, axis labels, legend and gridlines in #dbe7ef
       on white: about 1.2:1, i.e. nothing. buildPrintRoot and the pptx
       exporter both already ask pageIsLight; the on-screen renderer was
       the one that did not. */
    var lightPg=(typeof pageIsLight==='function')
      &&pageIsLight((pres&&pres.pageBg)||'#0b141d');
    var ink=lightPg?'#0b141d':'#dbe7ef';
    var dim=lightPg?'#4a5b68':'#8aa0b0';
    var grid=lightPg?'#4a5b6833':'#8aa0b033';
    /* T322: a hidden series keeps its place in the data (ties and
       builds still count it) but draws nothing */
    var shown=d.series.filter(function(se){return !se.hide;});
    var legend=(a.leg!==0)&&(shown.length>1||a.ct==='pie');
    var hasY2=a.ct!=='pie'&&shown.some(function(se){return se.axis==='y2';});
    var T=(a.title?30:12),B=H-(legend?48:30)-(d.xlab?14:0);
    var L=46+(d.ylab?16:0),R=W-12-(hasY2?(d.y2lab?56:40):0);
    if(a.title) gSkel.appendChild(
      svgText(W/2,19,String(a.title),15,ink,'middle'));
    if(!shown.length){
      svg.appendChild(svgText(W/2,H/2,'No data — right-click '
        +'→ Edit data…',12,dim,'middle'));
      return svg;
    }
    if(a.ct==='pie'){
      var ys=shown[0].ys.map(function(v){return Math.max(0,v);});
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
        /* T322: a slice's share, when labels are on */
        if(d.labels&&v>0){
          var am=(a0+a1)/2,lr=r*0.62;
          svg.appendChild(svgText(cx+lr*Math.cos(am),cy+lr*Math.sin(am)+4,
            Math.round(v/tot*100)+'%',10,'#fff','middle'));
        }
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
    /* ---- THE SCALES (T322) -----------------------------------------
       T288: FROM THE DATA. It started at 0..1 and only ever widened, so
       a series of 95..105 got an axis of 0..105 and drew as a flat line
       in the top tenth of the plot -- the shape of the data, which is
       the whole reason for a chart, was gone.
       Zero is still forced for BARS, where it is not a preference: a
       bar's length IS its value, and a bar chart cut off above zero
       misstates every comparison on it. A line or a scatter says where
       the points are, and cropping to them is the honest scale.
       Now with a second axis on the right for the series that ask for
       it, a log axis when asked, and a stacked scale that is the sum of
       the stack, not the tallest member. Error bars and bands are part
       of the data's extent, so nothing is clipped. */
    /* the x each point sits at, hoisted above the scale: the trend
       line's endpoints depend on it, and the scale has to cover them */
    var isBar=(a.ct==='bar');
    var xsPre=d.numeric&&!isBar
      ?d.cats.map(function(c){return Number(c);}):null;
    var barSeries=shown.filter(function(se){
      return !(isBar&&se.ct==='line');});
    var lineOver=isBar?shown.filter(function(se){return se.ct==='line';}):[];
    var stacked=isBar&&!!d.stack;      /* d.ylog is already false then */
    var n=d.cats.length;
    function extent(list){
      var vals=[];
      list.forEach(function(se){
        se.ys.forEach(function(v,i){
          vals.push(v);
          if(se.err&&se.err[i]!=null){vals.push(v-se.err[i]);vals.push(v+se.err[i]);}
          if(se.band){vals.push(se.band.lo[i]);vals.push(se.band.hi[i]);}
        });
        /* the FITTED ends too: a regression line runs past the points
           it was fitted to, so an axis sized to the points alone drew
           it across the category labels (2026-09-07 review) */
        if(se.trend&&se.ys.length>1){
          var xv=se.ys.map(function(_,i){return xsPre?xsPre[i]:i;});
          var ft=chartLinFit(xv,se.ys);
          if(ft){
            vals.push(ft.m*xv[0]+ft.b);
            vals.push(ft.m*xv[xv.length-1]+ft.b);
          }
        }
      });
      return vals;
    }
    /* WHAT A STACK CANNOT SHOW. A band and a trend line both describe a
       series' own values, and a stacked segment is not drawn at its own
       values -- it is drawn at a running total. Drawing them anyway put
       a band in data units over an axis in cumulative units, which
       washed the whole plot (2026-09-07 review). So they stand down on
       a stack and the pane says so. An error bar CAN be honest, around
       the segment's top, except on a 100% stack where the segment is a
       share and the error is not. */
    var stackErrOK=stacked&&d.stack!=='pct';
    var prim=shown.filter(function(se){return se.axis!=='y2';});
    var sec=shown.filter(function(se){return se.axis==='y2';});
    var segs=null,pvals;
    if(stacked){
      var stackSeries=barSeries.filter(function(se){return se.axis!=='y2';});
      segs=chartStackTops(stackSeries,n,d.stack==='pct');
      pvals=[];
      segs.forEach(function(sg,si2){
        var es=stackSeries[si2];
        sg.forEach(function(s2,i2){
          pvals.push(s2.y0);pvals.push(s2.y1);
          /* an error bar on a stacked segment is drawn around the
             segment's TOP, so the axis has to reach it */
          if(stackErrOK&&es&&es.err&&es.err[i2]!=null){
            pvals.push(s2.y1-es.err[i2]);pvals.push(s2.y1+es.err[i2]);}
        });
      });
      pvals=pvals.concat(extent(lineOver.filter(function(se){
        return se.axis!=='y2';})));
    } else pvals=extent(prim);
    var scY=chartScale(pvals,{log:d.ylog,zero:isBar&&!d.ylog});
    var scY2=hasY2?chartScale(extent(sec),{log:false,zero:isBar}):null;
    function Y(v,se){
      var sc=(se&&se.axis==='y2')?scY2:scY;
      var f=chartPos(sc,v);
      return isFinite(f)?B-f*(B-T):NaN;
    }
    var yZero=isFinite(Y(0))?Y(0):B;
    chartTicks(scY).forEach(function(g){
      var gl=svgEl('line');
      gl.setAttribute('x1',L);gl.setAttribute('x2',R);
      gl.setAttribute('y1',Y(g));gl.setAttribute('y2',Y(g));
      gl.setAttribute('stroke',g===0?dim:grid);
      gSkel.appendChild(gl);
      gSkel.appendChild(svgText(L-5,Y(g)+3,chartFmt(g,scY.step),9,dim,
        'end'));
    });
    if(scY2) chartTicks(scY2).forEach(function(g){
      var f=chartPos(scY2,g),yy=B-f*(B-T);
      gSkel.appendChild(svgText(R+5,yy+3,chartFmt(g,scY2.step),9,dim,
        'start'));
    });
    /* axis titles */
    if(d.ylab){
      var yl=svgText(0,0,d.ylab,10,dim,'middle');
      yl.setAttribute('transform','translate(11,'+((T+B)/2)+') rotate(-90)');
      gSkel.appendChild(yl);
    }
    if(d.y2lab&&hasY2){
      var yl2=svgText(0,0,d.y2lab,10,dim,'middle');
      yl2.setAttribute('transform','translate('+(W-8)+','+((T+B)/2)
        +') rotate(90)');
      gSkel.appendChild(yl2);
    }
    if(d.xlab) gSkel.appendChild(svgText((L+R)/2,B+27,d.xlab,10,dim,'middle'));
    var xs=d.numeric&&!isBar
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
        gSkel.appendChild(svgText(px,B+13,chartFmt(xv,xstep),9,dim,
          'middle'));
      }
    } else {
      d.cats.forEach(function(c,i){
        gSkel.appendChild(svgText(X(i),B+13,
          c.length>9?c.slice(0,8)+'…':c,9,dim,'middle'));
      });
    }
    /* ---- the marks --------------------------------------------------- */
    function band(se){
      if(!se.band||stacked) return;
      var pts=[],back=[];
      se.ys.forEach(function(v,i){
        var yh=Y(se.band.hi[i],se),ylo=Y(se.band.lo[i],se);
        if(!isFinite(yh)||!isFinite(ylo)) return;
        pts.push(X(i)+','+yh);back.unshift(X(i)+','+ylo);
      });
      if(pts.length<2) return;
      var pg2=svgEl('polygon');
      pg2.setAttribute('points',pts.concat(back).join(' '));
      pg2.setAttribute('fill',se.color);
      pg2.setAttribute('fill-opacity','0.18');
      pg2.setAttribute('stroke','none');
      seriesG(se.name).appendChild(pg2);
    }
    function errBars(se,xAt){
      if(!se.err) return;
      var g=seriesG(se.name);
      se.ys.forEach(function(v,i){
        var e=se.err[i];
        if(e==null||!(e>0)) return;
        var y1=Y(v-e,se),y2=Y(v+e,se),x=xAt(i);
        if(!isFinite(y1)||!isFinite(y2)) return;
        var ln=svgEl('path');
        ln.setAttribute('d','M'+x+' '+y1+'V'+y2+'M'+(x-4)+' '+y1+'h8'
          +'M'+(x-4)+' '+y2+'h8');
        ln.setAttribute('stroke',ink);ln.setAttribute('stroke-width',1);
        ln.setAttribute('fill','none');ln.setAttribute('opacity','0.8');
        g.appendChild(ln);
      });
    }
    function trend(se,xAt){
      if(!se.trend||stacked) return;
      var xv=se.ys.map(function(_,i){return xs?xs[i]:i;});
      var fit=chartLinFit(xv,se.ys);
      if(!fit) return;
      var i0=0,i1=se.ys.length-1;
      var ya=Y(fit.m*xv[i0]+fit.b,se),yb=Y(fit.m*xv[i1]+fit.b,se);
      if(!isFinite(ya)||!isFinite(yb)) return;
      var ln=svgEl('line');
      ln.setAttribute('x1',xAt(i0));ln.setAttribute('y1',ya);
      ln.setAttribute('x2',xAt(i1));ln.setAttribute('y2',yb);
      ln.setAttribute('stroke',se.color);ln.setAttribute('stroke-width',1.5);
      ln.setAttribute('stroke-dasharray','5 3');
      seriesG(se.name).appendChild(ln);
    }
    /* `where`: true above the mark, 'mid' on it, false below. The
       stacked branch used false and added its own +4, so a label landed
       15px under its segment's centre -- on the series below it, for
       any segment shorter than about 30px (2026-09-07 review). */
    function label(se,x,y,v,where){
      if(!d.labels||!isFinite(y)) return;
      var yy=where===true?y-4:where==='mid'?y+3:y+11;
      seriesG(se.name).appendChild(
        svgText(x,yy,chartFmt(v),9,ink,'middle'));
    }
    function lineOf(se,xAt){
      var gl2=seriesG(se.name);
      var pl=svgEl('polyline');
      var pts=[];
      se.ys.forEach(function(v,i){
        var y=Y(v,se); if(isFinite(y)) pts.push(xAt(i)+','+y);});
      pl.setAttribute('points',pts.join(' '));
      pl.setAttribute('fill','none');
      pl.setAttribute('stroke',se.color);
      pl.setAttribute('stroke-width',2);
      gl2.appendChild(pl);
      se.ys.forEach(function(v,i){
        var y=Y(v,se); if(!isFinite(y)) return;
        var c=svgEl('circle');
        c.setAttribute('cx',xAt(i));c.setAttribute('cy',y);
        c.setAttribute('r',2.6);c.setAttribute('fill',se.color);
        gl2.appendChild(c);
        label(se,xAt(i),y,v,true);
      });
    }
    shown.forEach(band);                     /* bands sit behind everything */
    if(a.ct==='line'){
      shown.forEach(function(se){lineOf(se,X);errBars(se,X);trend(se,X);});
    } else if(a.ct==='scatter'){
      shown.forEach(function(se){
        var gs=seriesG(se.name);
        se.ys.forEach(function(v,i){
          var y=Y(v,se); if(!isFinite(y)) return;
          var c=svgEl('circle');
          c.setAttribute('cx',X(i));c.setAttribute('cy',y);
          c.setAttribute('r',3.4);c.setAttribute('fill',se.color);
          gs.appendChild(c);
          label(se,X(i),y,v,true);
        });
        errBars(se,X);trend(se,X);
      });
    } else {   /* bar, the default */
      var gw=(R-L)/n;
      if(stacked){
        var stackSeries2=barSeries.filter(function(se){return se.axis!=='y2';});
        var bw0=gw*0.72;
        stackSeries2.forEach(function(se,si){
          var gb=seriesG(se.name);
          var xMid=function(i){return L+i*gw+gw*0.14+bw0/2;};
          segs[si].forEach(function(sg,i){
            var y0=Y(sg.y0),y1=Y(sg.y1);
            if(!isFinite(y0)||!isFinite(y1)) return;
            var b=svgEl('rect');
            b.setAttribute('x',L+i*gw+gw*0.14);
            b.setAttribute('y',Math.min(y0,y1));
            b.setAttribute('width',Math.max(1,bw0-1));
            b.setAttribute('height',Math.max(0.5,Math.abs(y1-y0)));
            b.setAttribute('fill',se.color);
            gb.appendChild(b);
            if(sg.v) label(se,xMid(i),(y0+y1)/2,
              d.stack==='pct'?Math.round(sg.v):se.ys[i],'mid');
            /* around the segment's top, in the stack's own units */
            if(stackErrOK&&se.err&&se.err[i]!=null&&se.err[i]>0){
              var ea=Y(sg.y1-se.err[i]),eb2=Y(sg.y1+se.err[i]);
              if(isFinite(ea)&&isFinite(eb2)){
                var el2=svgEl('path');
                el2.setAttribute('d','M'+xMid(i)+' '+ea+'V'+eb2
                  +'M'+(xMid(i)-4)+' '+ea+'h8M'+(xMid(i)-4)+' '+eb2+'h8');
                el2.setAttribute('stroke',ink);
                el2.setAttribute('stroke-width',1);
                el2.setAttribute('fill','none');
                el2.setAttribute('opacity','0.8');
                gb.appendChild(el2);
              }
            }
          });
        });
        /* a y2 bar in a stacked chart stands beside the stack */
        barSeries.filter(function(se){return se.axis==='y2';})
          .forEach(function(se){
            var gb=seriesG(se.name),bw2=gw*0.2;
            se.ys.forEach(function(v,i){
              var y=Y(v,se),z=Y(0,se); if(!isFinite(y)) return;
              var b=svgEl('rect');
              b.setAttribute('x',L+i*gw+gw*0.86-bw2);
              b.setAttribute('y',Math.min(y,z));
              b.setAttribute('width',Math.max(1,bw2-1));
              b.setAttribute('height',Math.max(0.5,Math.abs(y-z)));
              b.setAttribute('fill',se.color);
              gb.appendChild(b);
            });
          });
      } else {
        var ns=barSeries.length||1,bw=gw*0.72/ns;
        barSeries.forEach(function(se,si){
          var gb=seriesG(se.name);
          var xAt=function(i){return L+i*gw+gw*0.14+si*bw+bw/2;};
          se.ys.forEach(function(v,i){
            var y=Y(v,se);
            var z=se.axis==='y2'?Y(0,se):yZero;
            if(!isFinite(z)) z=B;
            if(!isFinite(y)){
              /* a value the axis cannot place (log, non-positive) */
              if(d.ylog&&!(v>0)) return;
              y=B;
            }
            var b=svgEl('rect');
            b.setAttribute('x',xAt(i)-bw/2);
            b.setAttribute('y',Math.min(y,z));
            b.setAttribute('width',Math.max(1,bw-1));
            b.setAttribute('height',Math.max(0.5,Math.abs(y-z)));
            b.setAttribute('fill',se.color);
            gb.appendChild(b);
            label(se,xAt(i),Math.min(y,z),v,true);
          });
          errBars(se,xAt);trend(se,xAt);
        });
      }
      /* T322: a line drawn OVER the bars -- the combo chart -- on its
         own axis when it asks for one */
      lineOver.forEach(function(se){lineOf(se,X);errBars(se,X);trend(se,X);});
    }
    if(legend){
      var lx2=L;
      shown.forEach(function(se){
        var sw2=svgEl('rect');
        sw2.setAttribute('x',lx2);sw2.setAttribute('y',H-22);
        sw2.setAttribute('width',10);sw2.setAttribute('height',10);
        sw2.setAttribute('fill',se.color);
        /* the legend entry travels WITH its series (T159). A key naming a
           line the audience cannot see yet is the spoiler the slow reveal
           exists to avoid -- the layout is still computed for every
           series, so nothing reflows as they arrive. */
        var gL=seriesG(se.name);
        gL.appendChild(sw2);
        var nm=se.name+(se.axis==='y2'?' (right)':'');
        gL.appendChild(svgText(lx2+14,H-13,nm,10,dim));
        lx2+=14+Math.max(34,nm.length*6)+10;
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
    var svg=chartSvg(a);
    /* THE SERIES REVEAL (T160). The axes were computed from ALL the data
       before a single mark was drawn, so they are fixed from the first
       frame -- which is the exact defect of the way everyone else does
       this. Exporting N pictures of the same plot rescales each one, so
       the plot JUMPS as you step through it; here the frame is nailed
       down and the lines arrive into it.
       Hidden with visibility, not display: a hidden <g> still occupies
       its place in the layout and still contributes to nothing that
       moves, so nothing reflows as series arrive. */
    var shown=chartSeriesShown(s,a);
    var names=chartSeriesNames(a);
    if(shown<names.length){
      names.forEach(function(nm,si){
        if(si<shown) return;
        var g=svg.querySelector('g[data-series="'+String(nm)
          .replace(/"/g,'\\"')+'"]');
        if(g) g.style.visibility='hidden';
      });
    }
    d2.appendChild(svg);
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
    /* T322: HELPER COLUMNS. "Temp ±" is Temp's error bar, "Temp lo" and
       "Temp hi" its confidence band; each folds into the series it names
       and leaves the plot. A helper naming no series stays a series of
       its own, so nothing typed is ever thrown away. */
    var byName={};
    series.forEach(function(se){byName[se.name]=se;});
    function helperOf(se){
      var m=/^(.*\S)\s*(\u00b1|\+\/-|err|lo|hi)$/i.exec(se.name);
      var base=m?byName[m[1]]:null;
      return (base&&base!==se)?{base:base,kind:m[2].toLowerCase()}:null;
    }
    /* A BAND NEEDS BOTH HALVES. "Name hi" alone used to be folded in and
       then thrown away when the pair came up short, taking its numbers
       with it -- a column you typed simply disappeared (2026-09-07
       review). Half a band is not a helper at all; it stays a series. */
    var pairs={};
    series.forEach(function(se){
      var h=helperOf(se);
      if(!h||(h.kind!=='lo'&&h.kind!=='hi')) return;
      (pairs[h.base.name]=pairs[h.base.name]||{})[h.kind]=1;
    });
    var keep=[];
    series.forEach(function(se){
      var h=helperOf(se);
      if(!h){keep.push(se);return;}
      if(h.kind==='lo'||h.kind==='hi'){
        var p=pairs[h.base.name];
        if(!p||!p.lo||!p.hi){keep.push(se);return;}
        h.base.band=h.base.band||{lo:[],hi:[]};
        h.base.band[h.kind]=se.ys.slice();
        return;
      }
      h.base.err=se.ys.slice();
    });
    keep.forEach(function(se,i){
      se.color=CHART_PALETTE[i%CHART_PALETTE.length];
    });
    series=keep;
    if(!series.length) return null;
    return {cats:cats,series:series};
  }
  function chartRowsOfCard(ref){
    /* the LIVE card's table, read off the open shell the same way the
       provenance pane compares bodies (T20) */
    try{
      /* T307: NO NOTEBOOK, NO SOURCE READ. cloneBody's no-card branch
         ignores fromLive and hands back the deck's own snapshot, so
         with the notebook shut a "refresh from source" read the kept
         table and, if the numbers had been hand-edited through the
         chart data dialog, silently reverted them -- with no notebook
         anywhere in the transaction. liveCardHtml has guarded this
         since T20; this did not. */
      if(!cardEl(ref)) return null;
      var b=cloneBody(ref,1); if(!b) return null;   /* live (T302) */
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
    /* T322: the helper columns go back out beside their series, so the
       dialog round-trips what the pane shows */
    var head=[''],cols=[];
    d.series.forEach(function(se){
      head.push(se.name);
      cols.push(function(i){return se.ys[i]==null?'':se.ys[i];});
      if(se.err){
        head.push(se.name+' \u00b1');
        cols.push(function(i){return se.err[i]==null?'':se.err[i];});
      }
      if(se.band){
        head.push(se.name+' lo');
        cols.push(function(i){return se.band.lo[i]==null?'':se.band.lo[i];});
        head.push(se.name+' hi');
        cols.push(function(i){return se.band.hi[i]==null?'':se.band.hi[i];});
      }
    });
    var out=[head.join(', ')];
    d.cats.forEach(function(c,i){
      out.push([c].concat(cols.map(function(f){return f(i);})).join(', '));
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
      +'numeric axis for line and scatter). A column \u201cName \u00b1\u201d '
      +'is Name\u2019s error bar; \u201cName lo\u201d and \u201cName hi\u201d '
      +'are its band.';
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
      /* keep each series' colour -- and, T322, its own switches --
         where the name survives the edit */
      var old={};(a.series||[]).forEach(function(se){
        if(se&&se.name) old[se.name]=se;});
      data.series.forEach(function(se){
        var o=old[se.name]; if(!o) return;
        if(o.color) se.color=o.color;
        ['axis','trend','ct','hide'].forEach(function(k){
          if(o[k]) se[k]=o[k];});
      });
      /* A TIE POINTS AT A SERIES BY NAME (T162), and a hand edit can
         rename or drop one. The tie then fails OPEN -- the item shows
         all the time rather than vanishing -- but silently reverting to
         "always shown" is still a change worth being told about, and
         this is the one moment the old names and the new ones are both
         in hand. */
      var nowNm={};data.series.forEach(function(se){nowNm[se.name]=1;});
      var orph=0;
      (s.annots||[]).forEach(function(x){
        if(!x||!x.tie||x.tie.to!=='series'||x.tie.id!==a.oid) return;
        if(old[x.tie.at]!==undefined&&!nowNm[x.tie.at]) orph++;});
      a.cats=data.cats;a.series=data.series;
      /* hand-edited numbers are yours now, not the table's */
      delete a.ref;
      markDirty();refresh();chartDlgClose();
      toast('Chart updated — Ctrl+Z undoes it'
        +(orph?('. '+orph+' item'+(orph===1?'':'s')+' tied to a series '
          +'that is no longer in the numbers — '
          +(orph===1?'it shows':'they show')+' all the time now'):''));
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

  /* ---- WHICH SERIES DOES THIS BELONG TO (T162) ------------------------
     The second door of the object menu's "shows with" section. A flip
     book has a pane with its figures already listed, so T161 could just
     open it and point; a chart has no pane, and inventing one for a
     two-line question would be a new surface to keep in step for
     nothing. So this borrows openTokenPicker's idiom instead: a floating
     .canvas-menu of rows, dismissed by clicking away or by Escape.

     IT RE-RENDERS RATHER THAN CLOSING. Every row is one commit and the
     slide behind redraws, so you watch the answer as you pick it -- and
     the mode rows cannot mean anything until a series is chosen, so a
     menu that closed on the first click would make "just this one" a
     two-visit job. */
  function seriesTieClose(){
    var p=$('#series-tie'); if(p) p.remove();
  }
  function openSeriesTie(ci,idxs,ev){
    seriesTieClose();
    var s=pres.slides[cur];
    var ch=s&&(s.annots||[])[ci];
    if(!ch||ch.k!=='chart') return;
    /* idempotent, and the tie needs the chart to have a durable name.
       renderAnnots already calls it on every render; this is belt and
       braces for a chart placed and tied inside one frame. */
    ensureOids(s);
    /* a chart cannot tie to itself, and an item with no annot behind it
       is a stale index */
    var mine=(idxs||[]).filter(function(i){
      return i!==ci&&(s.annots||[])[i];});
    if(!mine.length) return;
    var m=document.createElement('div');
    m.className='sh-menu canvas-menu';m.id='series-tie';
    function rowIn(host,label,fn,title,icon){
      var b=document.createElement('button');
      b.className='dbtn vw-opt';
      /* the icon is trusted bic() markup; the LABEL stays a text node --
         a series is named by its data and could contain anything */
      if(icon) b.innerHTML=bic(icon)+' ';
      b.appendChild(document.createTextNode(label));
      if(title) b.title=title;
      b.setAttribute('role','menuitem');
      b.addEventListener('click',function(e){
        e.stopPropagation();fn();});
      host.appendChild(b);
      return b;
    }
    function first(){return (s.annots||[])[mine[0]]||{};}
    /* the tie the SELECTION already has to THIS chart, or null. Read off
       the first item, the way renderTiePanel does: a mixed selection
       shows the first one's answer and one click makes them agree. */
    function tieNow(){
      var t=first().tie;
      return (t&&t.to==='series'&&t.id===ch.oid)?t:null;
    }
    function setTie(name,md){
      mine.forEach(function(i){
        var x=(s.annots||[])[i]; if(!x) return;
        if(name==null) delete x.tie;
        else x.tie={to:'series',id:ch.oid,at:name,m:md||'from'};
      });
      markDirty();renderSlide();build();
    }
    function build(){
      m.innerHTML='';
      menuHead(m,mine.length===1
        ?('“'+annotLabel(first()).slice(0,26)+'” shows with')
        :(mine.length+' items show with'));
      var now=tieNow();
      var b0=rowIn(m,'Nothing — always shown',function(){setTie(null);},
        'The default: it is on the slide from the moment its own build '
        +'lets it be','none');
      if(!now) b0.classList.add('on');
      /* EVERY series, in a box that scrolls when there are many -- the
         lesson the figure-reference list learned the hard way (T58) */
      var box=document.createElement('div');
      box.className='menu-scroll';m.appendChild(box);
      chartSeriesNames(ch).forEach(function(nm){
        var on=!!(now&&now.at===nm);
        var b=rowIn(box,(on?'✓ ':'')+nm,function(){
          setTie(nm,(now&&now.m)||'from');},
          'Appears with this series of '
          +(annotLabel(ch)||'the chart'),'plots');
        if(on) b.classList.add('on');
      });
      if(!now) return;
      menuHead(m,'and then');
      SERIES_MODES.forEach(function(md){
        var on=(now.m||'from')===md[0];
        var b=rowIn(m,(on?'✓ ':'')+md[1],function(){
          setTie(now.at,md[0]);},SERIES_TIPS[md[0]],'stagger');
        if(on) b.classList.add('on');
      });
    }
    m.setAttribute('role','menu');
    build();
    floatAt(m,ev);
  }

  /* ---- refresh from the source --------------------------------------- */
  /* the chart half of "Update figures from their sources" (T123): a
     chart that still carries `ref` re-reads the table it came from.
     Type, colours, position and size are yours and stay; only the
     numbers move — the same split resyncFigure keeps for snapshots. */
  /* T307: ONE CHART, so the Images row's Refresh and the provenance
     pane can offer a chart the verb that actually moves it. The body is
     chartResyncAll's forEach, lifted unchanged; the loop below now
     calls it rather than repeating it. Returns 1 when the numbers
     moved, so a caller can say nothing rather than claim a refresh. */
  function chartResyncOne(a){
    if(!a||a.k!=='chart'||!a.ref) return 0;
    var data=chartFromRows(chartRowsOfCard(a.ref));
    if(!data) return 0;
    /* names, error bars and bands are part of "has the table changed":
       comparing the values alone let a helper-column-only or a
       rename-only edit report no change, so "Refresh from table" said
       the table had not moved while the plot showed the old error bars
       (2026-09-07 review) */
    function sig(cats,ss){
      return JSON.stringify([cats,ss.map(function(se){
        return [se.name,se.ys,se.err||null,se.band||null];})]);
    }
    var p0=chartParse(a);
    if(sig(p0.cats,p0.series)===sig(data.cats,data.series)) return 0;
    /* the author's per-series choices survive a refresh by NAME: the
       colour (T123), and since T322 the axis, the trend line, a line
       drawn over the bars and being hidden -- err/band come from the
       table's own helper columns, so they are the table's to give */
    var old={};chartParse(a).series.forEach(function(se){
      old[se.name]=se;});
    data.series.forEach(function(se){
      var o=old[se.name]; if(!o) return;
      if(o.color) se.color=o.color;
      ['axis','trend','ct','hide'].forEach(function(k){
        if(o[k]) se[k]=o[k];});
    });
    a.cats=data.cats;a.series=data.series;
    return 1;
  }
  function chartResyncAll(only){          /* T280: a slide, or the deck */
    var nn=0;
    (pres.slides||[]).forEach(function(sl,si){
      if(only>=0&&si!==only) return;
      (sl.annots||[]).forEach(function(a){nn+=chartResyncOne(a);});
    });
    if(nn){markDirty();refresh();}
    return nn;
  }
  /* ---- THE CHART PANE (T322) ------------------------------------------
     The user's list, item 3: "Advanced chart editor: stacked charts,
     secondary axes, log axes, error bars, confidence bands, labels,
     trend lines, per-series editing". The right-click menu kept the
     four kinds and the numbers; everything else a chart can be asked
     lives here, one pane, rebuilt from the item on every sync so it can
     never disagree with the slide. Error bars and bands come in through
     the NUMBERS (helper columns), because they are numbers; the pane
     says so and shows which series carry them. */
  function chartPaneItem(){
    var s=pres.slides[cur];
    var a=(s&&typeof selAnnot==='number')?(s.annots||[])[selAnnot]:null;
    return (a&&a.k==='chart')?a:null;
  }
  function showChartPane(on){
    var p=$('#chartpane'); if(!p) return;
    if(on){paneShow('chartpane');chartPaneSync();}
    else paneHide('chartpane');
  }
  function chartPaneWrite(fn){
    var a=chartPaneItem(); if(!a) return;
    fn(a);
    markDirty();renderSlide();chartPaneSync();
  }
  /* ties and series builds address a series by NAME; a rename moves them */
  function chartRenameTies(a,was,now){
    if(!a||!a.oid||was===now) return;
    var s=pres.slides[cur]; if(!s) return;
    (s.annots||[]).forEach(function(x){
      if(x&&x.tie&&x.tie.to==='series'&&x.tie.id===a.oid&&x.tie.at===was)
        x.tie.at=now;
    });
  }
  /* WHILE YOU ARE USING IT, THE PANE DOES NOT REBUILD ITSELF. Every
     write renders the slide, renderSlide syncs the inspector panes, and
     this function empties its own body -- so the first `input` of a
     colour drag deleted the well under the pointer, and a text field's
     `change` deleted the button whose click had caused the blur
     (2026-09-07 review). A rebuild while the pane holds focus is
     deferred to the moment it loses it, unless the SUBJECT changed, in
     which case what is on screen is about the wrong object and has to
     go. */
  var chartPaneAt=null;
  function chartPaneBusy(){
    var p=$('#chartpane');
    return !!(p&&!p.hidden&&p.contains(document.activeElement)
      &&document.activeElement!==document.body);
  }
  function chartPaneSync(){
    var p=$('#chartpane'); if(!p||p.hidden) return;
    var body=$('#chartpane-body'); if(!body) return;
    var a=chartPaneItem();
    if(a&&a===chartPaneAt&&chartPaneBusy()) return;
    chartPaneAt=a;
    body.innerHTML='';
    function lab(t){
      var l=document.createElement('div');l.className='np-lab';
      l.textContent=t;body.appendChild(l);return l;
    }
    if(!a){lab('Select a chart on the slide');return;}
    function row(){
      var r=document.createElement('div');r.className='np-row cp-row';
      body.appendChild(r);return r;
    }
    function text(host,val,ph,fn){
      var i=document.createElement('input');
      i.className='np-goal cp-text';i.type='text';
      i.value=val||'';i.placeholder=ph||'';
      /* the canvas owns arrows, Delete and the tool keys */
      i.addEventListener('keydown',function(e){
        e.stopPropagation();if(e.key==='Enter') i.blur();});
      i.addEventListener('change',function(){
        chartPaneWrite(function(a2){fn(a2,i.value.trim());});});
      host.appendChild(i);return i;
    }
    function check(label,on,fn){
      var l=document.createElement('label');
      l.className='np-lab md-check cp-check';
      var c=document.createElement('input');c.type='checkbox';c.checked=!!on;
      c.addEventListener('change',function(){
        chartPaneWrite(function(a2){fn(a2,c.checked);});});
      l.appendChild(c);l.appendChild(document.createTextNode(' '+label));
      body.appendChild(l);return c;
    }
    function btn(host,label,on,fn,title){
      var b=document.createElement('button');
      b.className='dbtn cp-btn'+(on?' on':'');b.textContent=label;
      if(title) b.title=title;
      b.setAttribute('aria-pressed',(!!on).toString());
      b.addEventListener('click',function(e){e.stopPropagation();fn();});
      host.appendChild(b);return b;
    }
    function ser(a2,si){return (a2.series||[])[si];}
    lab('Title');
    text(row(),a.title,'none',function(a2,v){
      if(v) a2.title=v; else delete a2.title;});
    lab('Kind');
    var kr=row();
    CHART_TYPES.forEach(function(t){
      btn(kr,t[1],(a.ct||'bar')===t[0],function(){
        chartPaneWrite(function(a2){a2.ct=t[0];});});
    });
    var isBar=(a.ct||'bar')==='bar',isPie=a.ct==='pie';
    if(isBar){
      lab('Stacking');
      var sr=row(),now=a.stack==='pct'?'pct':(a.stack?'std':'');
      [['','Side by side'],['std','Stacked'],['pct','100%']].forEach(
        function(o){
          btn(sr,o[1],now===o[0],function(){
            chartPaneWrite(function(a2){
              if(o[0]) a2.stack=o[0]; else delete a2.stack;});},
            o[0]==='pct'?'Every stack scaled to 100%':'');
        });
    }
    if(!isPie){
      check('Logarithmic value axis',a.ylog,function(a2,on){
        if(on) a2.ylog=1; else delete a2.ylog;});
      if(a.ylog&&isBar&&a.stack)
        lab('Stacking wins: a stack is a sum of parts and a log axis '
          +'has no addition on it, so this chart is drawn, exported and '
          +'counted stacked.').className='np-lab cp-hint';
    }
    check(isPie?'Slice labels (per cent)':'Data labels',a.labels,
      function(a2,on){if(on) a2.labels=1; else delete a2.labels;});
    check('Legend',a.leg!==0,function(a2,on){
      if(on) delete a2.leg; else a2.leg=0;});
    if(!isPie){
      lab('Axis titles');
      var ar=row();
      text(ar,a.xlab,'x axis',function(a2,v){
        if(v) a2.xlab=v; else delete a2.xlab;});
      text(ar,a.ylab,'y axis',function(a2,v){
        if(v) a2.ylab=v; else delete a2.ylab;});
      if((a.series||[]).some(function(se){return se&&se.axis==='y2';}))
        text(row(),a.y2lab,'right axis',function(a2,v){
          if(v) a2.y2lab=v; else delete a2.y2lab;});
    }
    lab('Series');
    (a.series||[]).forEach(function(se,si){
      if(!se) return;
      var r=row();r.className+=' cp-series';
      if(isPie){
        /* a pie's slices are categories and take the palette in order,
           so a per-series colour well here would control nothing */
        var pd=document.createElement('span');
        pd.className='cp-tags';
        pd.textContent='slices take the deck\u2019s chart palette';
        r.appendChild(pd);
      }
      var ci=document.createElement('input');ci.type='color';
      ci.hidden=!!isPie;
      ci.className='cp-col';ci.title='Colour';
      ci.value=/^#[0-9a-f]{6}$/i.test(se.color||'')
        ?se.color:CHART_PALETTE[si%CHART_PALETTE.length];
      /* the drag PREVIEWS on the slide and the release is what the
         history keeps: one snapshot per colour chosen, not one per
         pointer move */
      ci.addEventListener('input',function(){
        se.color=ci.value;
        var l2=stage.querySelector('.annot-layer'),s2=pres.slides[cur];
        if(l2&&s2) renderAnnots(l2,s2);
      });
      ci.addEventListener('change',function(){
        chartPaneWrite(function(a2){
          var s2=ser(a2,si); if(s2) s2.color=ci.value;});
      });
      r.appendChild(ci);
      var nm=document.createElement('input');nm.type='text';
      nm.className='np-goal cp-name';nm.value=se.name||('Series '+(si+1));
      nm.title='Rename the series (ties and builds follow the name)';
      nm.addEventListener('keydown',function(e){
        e.stopPropagation();if(e.key==='Enter') nm.blur();});
      nm.addEventListener('change',function(){
        chartPaneWrite(function(a2){
          var s2=ser(a2,si); if(!s2) return;
          var was=s2.name;s2.name=nm.value.trim()||was;
          chartRenameTies(a2,was,s2.name);
        });
      });
      r.appendChild(nm);
      if(!isPie){
        btn(r,se.axis==='y2'?'Right':'Left',se.axis==='y2',function(){
          chartPaneWrite(function(a2){var s2=ser(a2,si); if(!s2) return;
            if(s2.axis==='y2') delete s2.axis; else s2.axis='y2';});},
          'Which value axis this series is read against');
        if(isBar) btn(r,'Line',se.ct==='line',function(){
          chartPaneWrite(function(a2){var s2=ser(a2,si); if(!s2) return;
            if(s2.ct==='line') delete s2.ct; else s2.ct='line';});},
          'Draw this series as a line over the bars');
        btn(r,'Trend',!!se.trend,function(){
          chartPaneWrite(function(a2){var s2=ser(a2,si); if(!s2) return;
            if(s2.trend) delete s2.trend; else s2.trend='linear';});},
          'A least-squares line through this series');
      }
      btn(r,se.hide?'Hidden':'Shown',!se.hide,function(){
        chartPaneWrite(function(a2){var s2=ser(a2,si); if(!s2) return;
          if(s2.hide) delete s2.hide; else s2.hide=1;});},
        'Hide this series from the plot (it stays in the numbers)');
      var tags=[];
      if(se.err) tags.push('\u00b1 error bars');
      if(se.band) tags.push('band');
      if(tags.length){
        var tg=document.createElement('span');tg.className='cp-tags';
        tg.textContent=tags.join(' \u00b7 ');r.appendChild(tg);
      }
    });
    if(isBar&&a.stack&&(a.series||[]).some(function(se){
      return se&&(se.band||se.trend);}))
      lab('Stacked: bands and trend lines are not drawn \u2014 both '
        +'describe a series\u2019 own values, and a stacked segment is '
        +'drawn at a running total.').className='np-lab cp-hint';
    lab('Error bars and bands come from the numbers: a column '
      +'\u201cName \u00b1\u201d is Name\u2019s error bar, \u201cName lo\u201d '
      +'and \u201cName hi\u201d its band.').className='np-lab cp-hint';
    var br=row();
    btn(br,'Edit numbers\u2026',false,function(){
      if(typeof selAnnot==='number') chartDataDlg(selAnnot);},
      'One row per category; helper columns for \u00b1 / lo / hi');
    if(a.ref) btn(br,'Refresh from table',false,function(){
      var n=chartResyncOne(a);
      if(n){markDirty();refresh();chartPaneSync();
        toast('Numbers refreshed from the table');}
      else toast('The table has not changed');},
      'Re-read the numbers from the table this chart came from');
  }
  function chartBoot(){
    var fb=$('#fmt-chart'),p=$('#chartpane');
    if(fb&&p) fb.addEventListener('click',function(){showChartPane(p.hidden);});
    var cl=$('#chartpane-close');
    if(cl) cl.addEventListener('click',function(){showChartPane(false);});
  }
  window.SemDeckChart={place:placeChart,dataOf:chartDataOf,
    fromRows:chartFromRows,dataDlg:chartDataDlg,resync:chartResyncAll,
    seriesCount:chartSeriesCount,seriesNames:chartSeriesNames,
    tieDlg:openSeriesTie,pane:showChartPane,
    scale:chartScale,fit:chartLinFit,stacks:chartStackTops,
    svg:chartSvg};
