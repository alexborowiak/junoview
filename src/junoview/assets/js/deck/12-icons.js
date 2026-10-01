/* 12-icons.js — the Icons gallery's line icons (T560), as data.
   ONE FRAGMENT of deck.js's single IIFE, concatenated with its
   siblings in the order assets.DECK_PARTS names. It does not parse
   alone and is not meant to: see 00-page.js. */
  /* ---- LINE ICONS (T560) -----------------------------------------------
     PowerPoint's Icons, the everyday ones: a tick, an arrow, a warning, a
     lightbulb, a person, a chart. An icon is a SHAPE (k:'rect',
     shape:'ic-NAME'), so everything a shape already has -- its line
     colour, its weight, a fill, resize, rotate, flip, a shadow, the
     Layers pane, the .pptx -- is the icon's without a line of its own.

     Each is drawn on a 24-unit grid from three kinds of part, chosen
     because SVG and PowerPoint's freeform geometry both say them
     exactly, so the slide and the .pptx draw the same lines:
       ['l', [x,y, x,y, ...], closed]   a polyline (closed: a polygon)
       ['c', cx, cy, r]                 a circle
       ['e', cx, cy, rx, ry, a0, a1]    an ellipse, or its arc from
                                        angle a0 to a1 (degrees, 0 is
                                        +x and 90 is DOWN, as on screen)
     The icon keeps its proportions in its box (drawn "meet"); a new one
     is drawn square and keeps its shape when resized (lockar). */
  var LINE_ICONS=[
    ['check','Tick','tick check done yes correct',
      [['l',[5,12.5,10,17.5,19,7]]]],
    ['cross','Cross','cross x no wrong close cancel',
      [['l',[6,6,18,18]],['l',[18,6,6,18]]]],
    ['plus','Plus','plus add more new',
      [['l',[12,5,12,19]],['l',[5,12,19,12]]]],
    ['minus','Minus','minus subtract less',
      [['l',[5,12,19,12]]]],
    ['arrowr','Arrow right','arrow right next forward',
      [['l',[4,12,20,12]],['l',[14,6,20,12,14,18]]]],
    ['arrowl','Arrow left','arrow left back previous',
      [['l',[20,12,4,12]],['l',[10,6,4,12,10,18]]]],
    ['arrowu','Arrow up','arrow up increase rise',
      [['l',[12,20,12,4]],['l',[6,10,12,4,18,10]]]],
    ['arrowd','Arrow down','arrow down decrease fall',
      [['l',[12,4,12,20]],['l',[6,14,12,20,18,14]]]],
    ['cycle','Cycle','cycle refresh repeat loop again',
      [['e',12,12,7,7,-20,270],['l',[9.4,2.4,12.2,5,9.4,7.6]]]],
    ['info','Information','information info about help',
      [['c',12,12,9],['l',[12,11,12,17]],['c',12,7.7,0.6]]],
    ['warning','Warning','warning caution alert danger exclamation',
      [['l',[12,3.5,21.5,20,2.5,20],1],['l',[12,9.5,12,14]],
       ['c',12,17,0.5]]],
    ['question','Question','question help unknown ask',
      [['c',12,12,9],['l',[9.3,9.4,9.9,7.9,11,7.2,12.4,7.1,13.8,7.6,
        14.6,8.8,14.5,10.2,13.6,11.2,12.4,12,12,13.4,12,14.2]],
       ['c',12,16.8,0.5]]],
    ['star','Star','star favourite favorite rating best',
      [['l',[12,3,14.6,8.6,20.6,9.3,16.1,13.4,17.3,19.4,12,16.4,6.7,
        19.4,7.9,13.4,3.4,9.3,9.4,8.6],1]]],
    ['heart','Heart','heart love like health',
      [['l',[12,20,4.6,12.6,3.5,9.8,4.4,6.8,7,5.1,9.8,5.3,12,7.6,14.2,
        5.3,17,5.1,19.6,6.8,20.5,9.8,19.4,12.6],1]]],
    ['bulb','Idea','idea lightbulb light bulb insight',
      [['c',12,9.5,5.5],['l',[9.6,14.6,9.6,18,14.4,18,14.4,14.6]],
       ['l',[10.4,21,13.6,21]]]],
    ['user','Person','person user people individual profile',
      [['c',12,8,4],['e',12,21,8,7,180,360]]],
    ['users','People','people group team users',
      [['c',9,8.5,3.5],['e',9,21,6.5,6,180,360],['c',16.5,7.5,3],
       ['e',17.5,18.5,4.5,5,240,360]]],
    ['clock','Time','time clock hour schedule',
      [['c',12,12,9],['l',[12,7,12,12,15.5,14.5]]]],
    ['calendar','Calendar','calendar date day month schedule',
      [['l',[4,6,20,6,20,20,4,20],1],['l',[4,10,20,10]],
       ['l',[8,3.5,8,8]],['l',[16,3.5,16,8]]]],
    ['mail','Mail','mail email envelope message',
      [['l',[3,6,21,6,21,18,3,18],1],['l',[3,6,12,13,21,6]]]],
    ['chat','Speech','speech chat talk comment message',
      [['l',[4,5,20,5,20,16,10,16,6,20,6,16,4,16],1]]],
    ['lock','Lock','lock secure private closed',
      [['l',[6,11,18,11,18,20,6,20],1],['l',[8,11,8,8]],
       ['e',12,8,4,4,180,360],['l',[16,8,16,11]]]],
    ['search','Search','search find magnifier look',
      [['c',10.5,10.5,6],['l',[15,15,20.5,20.5]]]],
    ['home','Home','home house start',
      [['l',[3,11.5,12,3.5,21,11.5]],['l',[5.5,9.5,5.5,20,18.5,20,18.5,
        9.5]]]],
    ['sliders','Settings','settings sliders options adjust controls',
      [['l',[4,7,20,7]],['l',[4,12,20,12]],['l',[4,17,20,17]],
       ['c',9,7,2],['c',15,12,2],['c',8,17,2]]],
    ['bars','Bar chart','bar chart graph statistics results',
      [['l',[4,20,20,20]],['l',[7,20,7,13]],['l',[12,20,12,6]],
       ['l',[17,20,17,10]]]],
    ['line','Line chart','line chart graph trend growth',
      [['l',[4,4,4,20,20,20]],['l',[6.5,16,10,11,13,14,19,6.5]]]],
    ['globe','Globe','globe world earth international web',
      [['c',12,12,9],['l',[3,12,21,12]],['e',12,12,4.2,9]]],
    ['target','Target','target goal aim objective',
      [['c',12,12,9],['c',12,12,5],['c',12,12,1.3]]],
    ['flag','Flag','flag milestone goal finish',
      [['l',[5,21,5,4]],['l',[5,4,18,4,15,8,18,12,5,12]]]],
    ['trophy','Trophy','trophy award prize win',
      [['l',[7,4,17,4,17,9]],['e',12,9,5,5,0,180],['l',[7,9,7,4]],
       ['l',[7,6,4,6,4,8,7,11]],['l',[17,6,20,6,20,8,17,11]],
       ['l',[12,14,12,18]],['l',[8.5,20,15.5,20]]]],
    ['book','Book','book read study reference',
      [['l',[3.5,5,10,5,12,7,14,5,20.5,5,20.5,18,14,18,12,20,10,18,3.5,
        18],1],['l',[12,7,12,20]]]],
    ['doc','Document','document page paper file report',
      [['l',[6,3,14,3,19,8,19,21,6,21],1],['l',[14,3,14,8,19,8]],
       ['l',[9,13,16,13]],['l',[9,17,16,17]]]],
    ['folder','Folder','folder directory files',
      [['l',[3,6,10,6,12,8.5,21,8.5,21,19,3,19],1]]],
    ['pin','Place','place pin location map marker where',
      [['e',12,10,6,6,150,390],['l',[6.8,13,12,21,17.2,13]],
       ['c',12,10,2]]],
    ['camera','Camera','camera photo picture image',
      [['l',[3,8,7,8,9,5,15,5,17,8,21,8,21,19,3,19],1],
       ['c',12,13,3.5]]],
    ['play','Play','play start video run',
      [['c',12,12,9],['l',[10,8,16,12,10,16],1]]],
    ['pause','Pause','pause stop wait',
      [['c',12,12,9],['l',[10,8,10,16]],['l',[14,8,14,16]]]],
    ['leaf','Leaf','leaf nature plant environment green',
      [['e',5,5,14,14,0,90],['e',19,19,14,14,180,270],
       ['l',[3,21,15,9]]]],
    ['sun','Sun','sun weather light day warm',
      [['c',12,12,4],['l',[12,2.5,12,5]],['l',[12,19,12,21.5]],
       ['l',[2.5,12,5,12]],['l',[19,12,21.5,12]],['l',[5.3,5.3,7,7]],
       ['l',[17,17,18.7,18.7]],['l',[5.3,18.7,7,17]],
       ['l',[17,7,18.7,5.3]]]],
    ['cloud','Cloud','cloud weather sky storage',
      [['l',[6.5,18,3.8,16.6,3,14,4.4,11.6,7,10.6,8.1,7.6,11,5.7,14.4,6,
        16.6,8.5,17.5,10.6,20,11.6,21,14,20.1,16.8,17.5,18],1]]],
    ['flask','Flask','flask experiment chemistry science lab',
      [['l',[8.5,3,15.5,3]],['l',[10,3,10,9,4.5,19,5.5,21,18.5,21,19.5,
        19,14,9,14,3]],['l',[7.2,15,16.8,15]]]],
    ['data','Data','data database storage records',
      [['e',12,6,7,2.5],['l',[5,6,5,18]],['l',[19,6,19,18]],
       ['e',12,18,7,2.5,0,180],['e',12,12,7,2.5,0,180]]],
    ['code','Code','code programming software brackets',
      [['l',[8,7,3,12,8,17]],['l',[16,7,21,12,16,17]]]],
    ['pencil','Edit','edit pencil write draw',
      [['l',[4,20,8,19,19,8,16,5,5,16],1],['l',[14,7,17,10]]]],
    ['percent','Percent','percent percentage rate proportion',
      [['c',7,7,2.5],['c',17,17,2.5],['l',[18,5,6,19]]]]
  ];
  function lineIcon(shp){
    var id=String(shp||'');
    if(id.indexOf('ic-')!==0) return null;
    id=id.slice(3);
    for(var i=0;i<LINE_ICONS.length;i++)
      if(LINE_ICONS[i][0]===id) return LINE_ICONS[i];
    return null;
  }
  /* a point on an ellipse at an angle, y down */
  function icPt(cx,cy,rx,ry,deg){
    var t=deg*Math.PI/180;
    return [cx+rx*Math.cos(t),cy+ry*Math.sin(t)];
  }
  function icN(v){return String(Math.round(v*100)/100);}
  /* the SVG path of an icon's parts */
  function lineIconD(parts){
    var d=[];
    (parts||[]).forEach(function(p){
      if(p[0]==='l'){
        var q=p[1];
        for(var k=0;k<q.length;k+=2)
          d.push((k?'L':'M')+icN(q[k])+' '+icN(q[k+1]));
        if(p[2]) d.push('Z');
      } else if(p[0]==='c'){
        var r=p[3];
        d.push('M'+icN(p[1]+r)+' '+icN(p[2])+'A'+r+' '+r+' 0 1 1 '
          +icN(p[1]-r)+' '+icN(p[2])+'A'+r+' '+r+' 0 1 1 '
          +icN(p[1]+r)+' '+icN(p[2])+'Z');
      } else if(p[0]==='e'){
        var cx=p[1],cy=p[2],rx=p[3],ry=p[4];
        if(p[5]==null){
          d.push('M'+icN(cx+rx)+' '+icN(cy)+'A'+rx+' '+ry+' 0 1 1 '
            +icN(cx-rx)+' '+icN(cy)+'A'+rx+' '+ry+' 0 1 1 '
            +icN(cx+rx)+' '+icN(cy)+'Z');
        } else {
          var a0=p[5],a1=p[6],s0=icPt(cx,cy,rx,ry,a0),s1=icPt(cx,cy,rx,ry,a1);
          d.push('M'+icN(s0[0])+' '+icN(s0[1])+'A'+rx+' '+ry+' 0 '
            +(Math.abs(a1-a0)>180?1:0)+' '+(a1>a0?1:0)+' '
            +icN(s1[0])+' '+icN(s1[1]));
        }
      }
    });
    return d.join('');
  }
