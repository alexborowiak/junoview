/* PowerPoint (.pptx) writer — dependency-free, runs in the browser.
 *
 * A .pptx is a ZIP of XML parts (OOXML). Both halves are built here from
 * scratch: a STORE-method ZIP writer (no compression, which a .pptx is
 * perfectly allowed to be) and just enough PresentationML to carry text
 * boxes, pictures, shapes and lines.
 *
 * This file knows NOTHING about Junoview's deck model. It takes a plain
 * spec — slide size in millimetres, a background, and a list of items in
 * PERCENT coordinates — and returns a Blob. deck.js does the translating.
 * That seam is why this can be tested on its own.
 *
 *   JunoPptx.build({
 *     title: 'My poster', widthMm: 841, heightMm: 1189,
 *     slides: [{bg: '#ffffff', items: [
 *       {t:'text', x:5, y:4, w:90, text:'Hello', sizePct:4, b:1},
 *       {t:'image', x:10, y:20, w:40, h:30, src:'data:image/png;base64,…'},
 *     ]}],
 *   })  ->  {blob, skipped, slides}
 *
 * Units: OOXML measures length in EMU (914400 per inch, so 36000 per mm)
 * and font size in hundredths of a point. Item coordinates arrive as
 * percentages of the slide, which is also how Junoview stores them, so a
 * poster and a 16:9 slide use the same numbers at different scales.
 */
window.JunoPptx = (function () {
  'use strict';

  var EMU_PER_MM = 36000;
  var PT_PER_MM = 72 / 25.4;

  /* ---------------------------------------------------------------- zip */

  var CRC_TABLE = (function () {
    var table = new Int32Array(256);
    for (var n = 0; n < 256; n++) {
      var c = n;
      for (var k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      table[n] = c;
    }
    return table;
  })();

  function crc32(bytes) {
    var c = -1;
    for (var i = 0; i < bytes.length; i++)
      c = (c >>> 8) ^ CRC_TABLE[(c ^ bytes[i]) & 0xFF];
    return (c ^ -1) >>> 0;
  }

  function utf8(str) { return new TextEncoder().encode(str); }

  /* A ZIP with stored (uncompressed) entries. Timestamps are fixed rather
     than "now" so the same deck exports byte-identically every time —
     the same reason the Python side writes junoview.zip deterministically. */
  function Zip() {
    this.files = [];
  }

  Zip.prototype.add = function (name, bytes) {
    this.files.push({ name: name, bytes: bytes, crc: crc32(bytes) });
  };

  Zip.prototype.addText = function (name, text) {
    this.add(name, utf8(text));
  };

  Zip.prototype.blob = function () {
    var chunks = [], central = [], offset = 0, self = this;

    function num(value, bytes) {
      var out = new Uint8Array(bytes);
      for (var i = 0; i < bytes; i++) out[i] = (value >>> (i * 8)) & 0xFF;
      return out;
    }

    function push(target, parts) {
      parts.forEach(function (p) { target.push(p); });
    }

    this.files.forEach(function (f) {
      var name = utf8(f.name);
      var size = f.bytes.length;
      var local = [
        num(0x04034B50, 4), num(20, 2), num(0, 2), num(0, 2),
        num(0, 2), num(0x21, 2),             /* fixed 1980-01-01 time/date */
        num(f.crc, 4), num(size, 4), num(size, 4),
        num(name.length, 2), num(0, 2), name,
      ];
      push(chunks, local);
      chunks.push(f.bytes);

      push(central, [
        num(0x02014B50, 4), num(20, 2), num(20, 2), num(0, 2), num(0, 2),
        num(0, 2), num(0x21, 2),
        num(f.crc, 4), num(size, 4), num(size, 4),
        num(name.length, 2), num(0, 2), num(0, 2), num(0, 2), num(0, 2),
        num(0, 4), num(offset, 4), name,
      ]);

      local.forEach(function (p) { offset += p.length; });
      offset += size;
    });

    var centralSize = 0;
    central.forEach(function (p) { centralSize += p.length; });
    var end = [
      num(0x06054B50, 4), num(0, 2), num(0, 2),
      num(self.files.length, 2), num(self.files.length, 2),
      num(centralSize, 4), num(offset, 4), num(0, 2),
    ];

    return new Blob(chunks.concat(central).concat(end),
      { type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' });
  };

  /* ------------------------------------------------------------- helpers */

  function esc(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /* "#4d90c0" / "#abc" / "rgb(1,2,3)" -> "4D90C0". OOXML wants bare hex. */
  function hex(color, fallback) {
    var c = String(color || '').trim();
    var m = c.match(/^#?([0-9a-f]{3})$/i);
    if (m) return m[1].split('').map(function (ch) { return ch + ch; })
      .join('').toUpperCase();
    m = c.match(/^#?([0-9a-f]{6})/i);
    if (m) return m[1].toUpperCase();
    m = c.match(/rgba?\(\s*(\d+)\D+(\d+)\D+(\d+)/i);
    if (m) return [m[1], m[2], m[3]].map(function (n) {
      var s = (+n).toString(16).toUpperCase();
      return s.length < 2 ? '0' + s : s;
    }).join('');
    return fallback || '000000';
  }

  /* PowerPoint rotates in 60000ths of a degree, positive clockwise. */
  function rotAttr(deg) {
    if (!deg) return '';
    return ' rot="' + Math.round(((deg % 360) + 360) % 360 * 60000) + '"';
  }

  function alpha(op) {
    if (op == null || op >= 1) return '';
    return '<a:alpha val="' + Math.round(Math.max(0, op) * 100000) + '"/>';
  }

  function solidFill(color, op, fallback) {
    return '<a:solidFill><a:srgbClr val="' + hex(color, fallback) + '">'
      + alpha(op) + '</a:srgbClr></a:solidFill>';
  }

  /* An rgba() stop carries its own transparency, which OOXML expresses as
     a separate alpha element rather than a fourth channel. */
  function alphaOf(color) {
    var m = String(color || '').match(/rgba\(\s*\d+\D+\d+\D+\d+\D+([\d.]+)/i);
    return m ? parseFloat(m[1]) : 1;
  }
  function gradFill(g, op) {
    if (!g) return '';
    var c1 = g.a, c2 = g.b;
    var stops = '<a:gsLst>'
      + '<a:gs pos="0"><a:srgbClr val="' + hex(c1, '39A9C0') + '">'
      + alpha(alphaOf(c1) * (op == null ? 1 : op)) + '</a:srgbClr></a:gs>'
      + '<a:gs pos="100000"><a:srgbClr val="' + hex(c2, 'FFFFFF') + '">'
      + alpha(alphaOf(c2) * (op == null ? 1 : op)) + '</a:srgbClr></a:gs>'
      + '</a:gsLst>';
    if (g.type === 'radial')
      /* path="circle" with the focus in the middle is PowerPoint's
         "radiate from the centre" */
      return '<a:gradFill rotWithShape="1">' + stops
        + '<a:path path="circle"><a:fillToRect l="50000" t="50000" '
        + 'r="50000" b="50000"/></a:path></a:gradFill>';
    return '<a:gradFill rotWithShape="1">' + stops + '<a:lin ang="'
      + Math.round((((+g.ang || 0) % 360) + 360) % 360 * 60000)
      + '" scaled="0"/></a:gradFill>';
  }
  /* the paint for a shape: gradient wins, then a solid colour, else none */
  function shapeFillXml(item) {
    if (item.grad) return gradFill(item.grad, item.op);
    if (item.fill) return solidFill(item.fill, item.op);
    return '<a:noFill/>';
  }
  var DASHES = { solid: '', dash: 'dash', sysDot: 'sysDot',
    dashDot: 'dashDot', lgDash: 'lgDash' };
  function dashXml(d) {
    var v = DASHES[d];
    return v ? '<a:prstDash val="' + v + '"/>' : '';
  }
  var HEAD_OK = { triangle: 1, stealth: 1, arrow: 1, diamond: 1, oval: 1 };
  function endXml(tag, type, size) {
    if (!type || type === 'none' || !HEAD_OK[type]) return '';
    var s = (size === 'sm' || size === 'lg') ? size : 'med';
    return '<a:' + tag + ' type="' + type + '" w="' + s + '" len="'
      + s + '"/>';
  }

  function dataUri(src) {
    var m = String(src || '').match(/^data:([^;,]+)(;base64)?,(.*)$/);
    if (!m) return null;
    var mime = m[1].toLowerCase(), body = m[3];
    var bytes;
    if (m[2]) {
      var bin = atob(body);
      bytes = new Uint8Array(bin.length);
      for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    } else {
      bytes = utf8(decodeURIComponent(body));
    }
    var ext = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/jpg': 'jpg',
      'image/gif': 'gif', 'image/svg+xml': 'svg', 'image/webp': 'webp',
    }[mime] || 'png';
    return { ext: ext, mime: mime, bytes: bytes };
  }

  /* -------------------------------------------------------------- shapes */

  function xfrm(geo, page) {
    var x = Math.round((geo.x || 0) / 100 * page.wEmu);
    var y = Math.round((geo.y || 0) / 100 * page.hEmu);
    var cx = Math.max(1, Math.round((geo.w || 10) / 100 * page.wEmu));
    var cy = Math.max(1, Math.round((geo.h || 10) / 100 * page.hEmu));
    return '<a:xfrm' + rotAttr(geo.rot) + '><a:off x="' + x + '" y="' + y
      + '"/><a:ext cx="' + cx + '" cy="' + cy + '"/></a:xfrm>';
  }

  function nvSp(id, name, extra) {
    return '<p:nvSpPr><p:cNvPr id="' + id + '" name="' + esc(name) + '"/>'
      + '<p:cNvSpPr' + (extra || '') + '/><p:nvPr/></p:nvSpPr>';
  }

  /* A run of text. `item` carries the character formatting; PowerPoint keeps
     it editable, which is the whole point of exporting shapes not pictures. */
  /* Character formatting, emitted into whichever element needs it: a real
     run (<a:rPr>) or the empty-paragraph placeholder (<a:endParaRPr>), which
     is what keeps a blank line's height right in PowerPoint. */
  function runProps(item, page, tag) {
    var pt = Math.max(1, (item.sizePct || 2.6) / 100 * page.hPt);
    var out = ' lang="en-US" sz="' + Math.round(pt * 100) + '"';
    if (item.b) out += ' b="1"';
    if (item.i) out += ' i="1"';
    if (item.u) out += ' u="sng"';
    if (item.strike) out += ' strike="sngStrike"';
    var body = solidFill(item.color, item.op, 'FFFFFF');
    if (item.font) body += '<a:latin typeface="' + esc(item.font) + '"/>';
    return '<a:' + tag + out + '>' + body + '</a:' + tag + '>';
  }

  function paragraphs(item, page) {
    var lines = String(item.text == null ? '' : item.text).split('\n');
    var align = { left: 'l', center: 'ctr', right: 'r', justify: 'just' }[
      item.align] || 'l';
    return lines.map(function (line) {
      var props = '<a:pPr algn="' + align + '"'
        + (item.bullets ? ' indent="-228600" marL="228600"' : '') + '>'
        + (item.bullets ? '<a:buChar char="&#8226;"/>' : '<a:buNone/>')
        + '</a:pPr>';
      if (!line)
        return '<a:p>' + props + runProps(item, page, 'endParaRPr') + '</a:p>';
      return '<a:p>' + props + '<a:r>' + runProps(item, page, 'rPr')
        + '<a:t>' + esc(line) + '</a:t></a:r></a:p>';
    }).join('');
  }

  function textShape(item, id, page) {
    /* A title is positioned by its CENTRE in Junoview (it is translated
       -50%,-50%); PowerPoint positions by the top-left corner, so recentre
       it here rather than shipping every title half a box off. */
    var geo = { x: item.x, y: item.y, w: item.w || 40, h: item.h || 10,
      rot: item.rot };
    if (item.centred) {
      geo.x = (item.x || 0) - geo.w / 2;
      geo.y = (item.y || 0) - geo.h / 2;
    }
    var fill = item.bgc ? solidFill(item.bgc, item.op) : '<a:noFill/>';
    /* Curved text is a real PowerPoint effect, so it arrives warped and
       still editable rather than as a picture. prstTxWarp must come
       FIRST inside bodyPr, and it cannot share the box with autofit —
       a warped run is sized by its path, not by the shape. */
    var arc = +item.arc || 0;
    /* Measured against real PowerPoint (2026-08-07): textArchUp is a true
       symmetric arch and matches the canvas exactly. Its downward twin
       wraps text around the BOTTOM of the circle, so it reads inverted
       the way a badge does; textCurve* stays upright but is a ramp that
       grows the letters, not a bow. textArch* is the closer shape, so it
       wins — and the one asymmetry (a downward arch reads round the
       bottom in PowerPoint, upright on the poster and in the PDF) is
       stated in the Curve menu rather than left to be discovered.
       The sweep must be given: an empty avLst renders all but flat. */
    var sweep = Math.round(Math.min(180, Math.abs(arc) * 3.2) * 60000);
    var warp = arc
      ? '<a:prstTxWarp prst="' + (arc > 0 ? 'textArchUp' : 'textArchDown')
        + '"><a:avLst><a:gd name="adj" fmla="val ' + sweep + '"/>'
        + '</a:avLst></a:prstTxWarp>'
      : '';
    var bodyPr = '<a:bodyPr wrap="square" anchor="'
      + (item.centred ? 'ctr' : 't') + '">' + warp
      + (arc ? '<a:noAutofit/>' : '<a:spAutoFit/>') + '</a:bodyPr>';
    return '<p:sp>' + nvSp(id, item.name || ('Text ' + id), ' txBox="1"')
      + '<p:spPr>' + xfrm(geo, page)
      + '<a:prstGeom prst="rect"><a:avLst/></a:prstGeom>' + fill + '</p:spPr>'
      + '<p:txBody>' + bodyPr
      + '<a:lstStyle/>' + paragraphs(item, page) + '</p:txBody></p:sp>';
  }

  function picShape(item, id, rid, page) {
    return '<p:pic><p:nvPicPr><p:cNvPr id="' + id + '" name="'
      + esc(item.name || ('Picture ' + id)) + '"/><p:cNvPicPr/><p:nvPr/>'
      + '</p:nvPicPr><p:blipFill><a:blip r:embed="' + rid + '">'
      + (item.op != null && item.op < 1
        ? '<a:alphaModFix amt="' + Math.round(item.op * 100000) + '"/>' : '')
      + '</a:blip><a:stretch><a:fillRect/></a:stretch></p:blipFill>'
      + '<p:spPr>' + xfrm(item, page)
      + '<a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr></p:pic>';
  }

  var SHAPE_GEOM = { rect: 'rect', ellipse: 'ellipse', oval: 'ellipse',
    circle: 'ellipse', round: 'roundRect', roundRect: 'roundRect',
    diamond: 'diamond', triangle: 'triangle', star: 'star5' };

  /* Line weight arrives as a PERCENTAGE OF PAGE HEIGHT, the same currency
     runProps already uses for text size. It used to arrive as canvas
     pixels and was multiplied by 12700 EMU — which is one POINT, not one
     pixel — so every exported line came out 1.33x too fat, and a rect and
     a line disagreed on the default (2 vs 3) into the bargain. */
  function lineWidthEmu(item, page, fallbackPct) {
    var pct = item.swPct != null ? item.swPct : fallbackPct;
    return Math.max(1, Math.round(pct / 100 * page.hPt * 12700));
  }

  function rectShape(item, id, page) {
    var stroke = '<a:ln w="' + lineWidthEmu(item, page, 0.41667) + '">'
      + solidFill(item.color, item.op, 'FF6B57')
      + dashXml(item.dash) + '</a:ln>';
    return '<p:sp>' + nvSp(id, item.name || ('Shape ' + id))
      + '<p:spPr>' + xfrm(item, page) + '<a:prstGeom prst="'
      + (SHAPE_GEOM[item.shape] || 'rect') + '"><a:avLst/></a:prstGeom>'
      + shapeFillXml(item)
      + stroke + '</p:spPr><p:txBody><a:bodyPr/><a:lstStyle/><a:p/>'
      + '</p:txBody></p:sp>';
  }

  /* A freehand stroke is a real PowerPoint FREEFORM, not a picture: it
     stays vector, keeps its colour, weight and dash, and can be reshaped
     in PowerPoint afterwards. custGeom wants its own coordinate space, so
     the points (already 0..1 inside the item's box) are scaled into a
     fixed 100000-unit grid rather than into EMU, which keeps the numbers
     integral and independent of the page size. */
  var FREE_N = 100000;
  function drawShape(item, id, page) {
    var pts = item.pts || [];
    if (pts.length < 2) return '';
    var path = '<a:path w="' + FREE_N + '" h="' + FREE_N + '">';
    pts.forEach(function (q, i) {
      var x = Math.round(Math.max(0, Math.min(1, q[0])) * FREE_N);
      var y = Math.round(Math.max(0, Math.min(1, q[1])) * FREE_N);
      var pt = '<a:pt x="' + x + '" y="' + y + '"/>';
      path += i === 0 ? '<a:moveTo>' + pt + '</a:moveTo>'
        : '<a:lnTo>' + pt + '</a:lnTo>';
    });
    path += '</a:path>';
    var stroke = '<a:ln w="' + lineWidthEmu(item, page, 0.41667)
      + '" cap="rnd"><a:round/>'
      + solidFill(item.color, item.op, '8AA0B0')
      + dashXml(item.dash) + '</a:ln>';
    return '<p:sp>' + nvSp(id, item.name || ('Drawing ' + id))
      + '<p:spPr>' + xfrm(item, page)
      + '<a:custGeom><a:avLst/><a:gdLst/><a:ahLst/><a:cxnLst/>'
      + '<a:rect l="0" t="0" r="r" b="b"/><a:pathLst>' + path
      + '</a:pathLst></a:custGeom><a:noFill/>'
      + stroke + '</p:spPr><p:txBody><a:bodyPr/><a:lstStyle/><a:p/>'
      + '</p:txBody></p:sp>';
  }

  /* A line/arrow is a connector: its endpoints can run in any direction, so
     the bounding box is normalised and the shape flipped to match. */
  function lineShape(item, id, page) {
    var x1 = (item.x1 || 0) / 100 * page.wEmu, y1 = (item.y1 || 0) / 100 * page.hEmu;
    var x2 = (item.x2 || 0) / 100 * page.wEmu, y2 = (item.y2 || 0) / 100 * page.hEmu;
    var flipH = x2 < x1, flipV = y2 < y1;
    var off = '<a:off x="' + Math.round(Math.min(x1, x2)) + '" y="'
      + Math.round(Math.min(y1, y2)) + '"/><a:ext cx="'
      + Math.max(1, Math.round(Math.abs(x2 - x1))) + '" cy="'
      + Math.max(1, Math.round(Math.abs(y2 - y1))) + '"/>';
    var ln = '<a:ln w="' + lineWidthEmu(item, page, 0.41667) + '">'
      + solidFill(item.color, item.op, 'FF6B57')
      + dashXml(item.dash)
      /* headEnd is the START of the line in OOXML, tailEnd the finish */
      + endXml('headEnd', item.tail, item.hsz)
      + endXml('tailEnd', item.head, item.hsz) + '</a:ln>';
    /* PowerPoint has real curved and elbowed connectors, so a curve or a
       bend stays editable there rather than being flattened to a
       straight line */
    var geom = item.bend ? 'bentConnector3'
      : (item.curve ? 'curvedConnector3' : 'line');
    return '<p:cxnSp><p:nvCxnSpPr><p:cNvPr id="' + id + '" name="Line '
      + id + '"/><p:cNvCxnSpPr/><p:nvPr/></p:nvCxnSpPr><p:spPr><a:xfrm'
      + (flipH ? ' flipH="1"' : '') + (flipV ? ' flipV="1"' : '') + '>'
      + off + '</a:xfrm><a:prstGeom prst="' + geom
      + '"><a:avLst/></a:prstGeom>'
      + ln + '</p:spPr></p:cxnSp>';
  }

  /* --------------------------------------------------------------- parts */

  var RELS_NS = 'http://schemas.openxmlformats.org/package/2006/relationships';
  var DOC_NS = 'http://schemas.openxmlformats.org/officeDocument/2006';
  var PML_NS = 'http://schemas.openxmlformats.org/presentationml/2006/main';
  var DML_NS = 'http://schemas.openxmlformats.org/drawingml/2006/main';
  var XML_HEAD = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';

  function relsDoc(entries) {
    return XML_HEAD + '<Relationships xmlns="' + RELS_NS + '">'
      + entries.map(function (r) {
        return '<Relationship Id="' + r.id + '" Type="' + r.type
          + '" Target="' + r.target + '"/>';
      }).join('') + '</Relationships>';
  }

  function themeXml() {
    var scheme = ['dk1', 'lt1', 'dk2', 'lt2', 'accent1', 'accent2', 'accent3',
      'accent4', 'accent5', 'accent6', 'hlink', 'folHlink'];
    var colors = ['000000', 'FFFFFF', '1F2A36', 'EEF4F8', '39A9C0', 'CF9A4E',
      '46A892', '9A7CC0', '4D90C0', 'FF6B57', '39A9C0', '9A7CC0'];
    return XML_HEAD + '<a:theme xmlns:a="' + DML_NS + '" name="Junoview">'
      + '<a:themeElements><a:clrScheme name="Junoview">'
      + scheme.map(function (n, i) {
        return '<a:' + n + '><a:srgbClr val="' + colors[i] + '"/></a:' + n + '>';
      }).join('')
      + '</a:clrScheme><a:fontScheme name="Junoview">'
      + '<a:majorFont><a:latin typeface="Calibri"/><a:ea typeface=""/>'
      + '<a:cs typeface=""/></a:majorFont>'
      + '<a:minorFont><a:latin typeface="Calibri"/><a:ea typeface=""/>'
      + '<a:cs typeface=""/></a:minorFont></a:fontScheme>'
      + '<a:fmtScheme name="Junoview">'
      + '<a:fillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill>'
      + '<a:solidFill><a:schemeClr val="phClr"/></a:solidFill>'
      + '<a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:fillStyleLst>'
      + '<a:lnStyleLst><a:ln><a:solidFill><a:schemeClr val="phClr"/>'
      + '</a:solidFill></a:ln><a:ln><a:solidFill><a:schemeClr val="phClr"/>'
      + '</a:solidFill></a:ln><a:ln><a:solidFill><a:schemeClr val="phClr"/>'
      + '</a:solidFill></a:ln></a:lnStyleLst>'
      + '<a:effectStyleLst><a:effectStyle><a:effectLst/></a:effectStyle>'
      + '<a:effectStyle><a:effectLst/></a:effectStyle>'
      + '<a:effectStyle><a:effectLst/></a:effectStyle></a:effectStyleLst>'
      + '<a:bgFillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill>'
      + '<a:solidFill><a:schemeClr val="phClr"/></a:solidFill>'
      + '<a:solidFill><a:schemeClr val="phClr"/></a:solidFill>'
      + '</a:bgFillStyleLst></a:fmtScheme></a:themeElements></a:theme>';
  }

  function emptyTree(name) {
    return '<p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name="' + name + '"/>'
      + '<p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm>'
      + '<a:off x="0" y="0"/><a:ext cx="0" cy="0"/>'
      + '<a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>'
      + '</p:spTree>';
  }

  function nsAttrs() {
    return ' xmlns:a="' + DML_NS + '" xmlns:r="' + DOC_NS
      + '/relationships" xmlns:p="' + PML_NS + '"';
  }

  /* ---------------------------------------------------------------- build */

  function build(spec) {
    var widthMm = spec.widthMm || 339, heightMm = spec.heightMm || 191;
    var page = {
      wEmu: Math.round(widthMm * EMU_PER_MM),
      hEmu: Math.round(heightMm * EMU_PER_MM),
      hPt: heightMm * PT_PER_MM,
    };
    var zip = new Zip();
    var slides = spec.slides || [];
    var media = [];          /* {name, mime, bytes} */
    var extensions = {};
    var skipped = 0;

    var slideXml = slides.map(function (slide) {
      var rels = [], id = 1, body = '';
      (slide.items || []).forEach(function (item) {
        if (!item) return;
        id++;
        if (item.t === 'text') {
          body += textShape(item, id, page);
        } else if (item.t === 'image') {
          var img = dataUri(item.src);
          if (!img) { skipped++; return; }
          var name = 'image' + (media.length + 1) + '.' + img.ext;
          media.push({ name: name, mime: img.mime, bytes: img.bytes });
          extensions[img.ext] = img.mime;
          var rid = 'rId' + (rels.length + 1);
          rels.push({ id: rid, type: DOC_NS + '/relationships/image',
            target: '../media/' + name });
          body += picShape(item, id, rid, page);
        } else if (item.t === 'rect') {
          body += rectShape(item, id, page);
        } else if (item.t === 'line') {
          body += lineShape(item, id, page);
        } else if (item.t === 'draw') {
          var free = drawShape(item, id, page);
          if (free) body += free; else skipped++;
        } else {
          skipped++;
        }
      });
      var bg = '<p:bg><p:bgPr>' + solidFill(slide.bg, null, '0B141D')
        + '<a:effectLst/></p:bgPr></p:bg>';
      /* function replacement, NOT a string: a "$&" or "$'" inside exported
         text would otherwise be read as a replacement pattern and corrupt
         the slide */
      var tree = emptyTree('Slide').replace('</p:spTree>',
        function () { return body + '</p:spTree>'; });
      return { rels: rels,
        xml: XML_HEAD + '<p:sld' + nsAttrs() + '><p:cSld>' + bg + tree
          + '</p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr>'
          + '</p:sld>' };
    });

    slideXml.forEach(function (s, i) {
      zip.addText('ppt/slides/slide' + (i + 1) + '.xml', s.xml);
      zip.addText('ppt/slides/_rels/slide' + (i + 1) + '.xml.rels',
        relsDoc(s.rels.concat([{ id: 'rIdL' + (i + 1),
          type: DOC_NS + '/relationships/slideLayout',
          target: '../slideLayouts/slideLayout1.xml' }])));
    });
    media.forEach(function (m) { zip.add('ppt/media/' + m.name, m.bytes); });

    zip.addText('ppt/slideLayouts/slideLayout1.xml',
      XML_HEAD + '<p:sldLayout' + nsAttrs() + ' type="blank" preserve="1">'
      + '<p:cSld name="Blank">' + emptyTree('Layout') + '</p:cSld>'
      + '<p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sldLayout>');
    zip.addText('ppt/slideLayouts/_rels/slideLayout1.xml.rels', relsDoc([
      { id: 'rId1', type: DOC_NS + '/relationships/slideMaster',
        target: '../slideMasters/slideMaster1.xml' }]));

    zip.addText('ppt/slideMasters/slideMaster1.xml',
      XML_HEAD + '<p:sldMaster' + nsAttrs() + '><p:cSld>'
      + '<p:bg><p:bgPr>' + solidFill(spec.bg, null, '0B141D')
      + '<a:effectLst/></p:bgPr></p:bg>' + emptyTree('Master') + '</p:cSld>'
      + '<p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1"'
      + ' accent2="accent2" accent3="accent3" accent4="accent4"'
      + ' accent5="accent5" accent6="accent6" hlink="hlink"'
      + ' folHlink="folHlink"/><p:sldLayoutIdLst>'
      + '<p:sldLayoutId id="2147483649" r:id="rId1"/></p:sldLayoutIdLst>'
      + '</p:sldMaster>');
    zip.addText('ppt/slideMasters/_rels/slideMaster1.xml.rels', relsDoc([
      { id: 'rId1', type: DOC_NS + '/relationships/slideLayout',
        target: '../slideLayouts/slideLayout1.xml' },
      { id: 'rId2', type: DOC_NS + '/relationships/theme',
        target: '../theme/theme1.xml' }]));

    zip.addText('ppt/theme/theme1.xml', themeXml());

    var sldIds = slides.map(function (_, i) {
      return '<p:sldId id="' + (256 + i) + '" r:id="rId' + (i + 2) + '"/>';
    }).join('');
    zip.addText('ppt/presentation.xml',
      XML_HEAD + '<p:presentation' + nsAttrs() + ' saveSubsetFonts="1">'
      + '<p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/>'
      + '</p:sldMasterIdLst><p:sldIdLst>' + sldIds + '</p:sldIdLst>'
      + '<p:sldSz cx="' + page.wEmu + '" cy="' + page.hEmu + '"/>'
      + '<p:notesSz cx="' + page.hEmu + '" cy="' + page.wEmu + '"/>'
      + '</p:presentation>');

    var presRels = [{ id: 'rId1', type: DOC_NS + '/relationships/slideMaster',
      target: 'slideMasters/slideMaster1.xml' }];
    slides.forEach(function (_, i) {
      presRels.push({ id: 'rId' + (i + 2),
        type: DOC_NS + '/relationships/slide',
        target: 'slides/slide' + (i + 1) + '.xml' });
    });
    presRels.push({ id: 'rIdTheme', type: DOC_NS + '/relationships/theme',
      target: 'theme/theme1.xml' });
    zip.addText('ppt/_rels/presentation.xml.rels', relsDoc(presRels));

    zip.addText('_rels/.rels', relsDoc([
      { id: 'rId1', type: DOC_NS + '/relationships/officeDocument',
        target: 'ppt/presentation.xml' },
      { id: 'rId2',
        type: 'http://schemas.openxmlformats.org/package/2006/relationships/'
          + 'metadata/core-properties', target: 'docProps/core.xml' }]));

    zip.addText('docProps/core.xml',
      XML_HEAD + '<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.'
      + 'org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/'
      + 'dc/elements/1.1/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-'
      + 'instance"><dc:title>' + esc(spec.title || 'Presentation')
      + '</dc:title><dc:creator>Junoview</dc:creator>'
      + '<cp:lastModifiedBy>Junoview</cp:lastModifiedBy></cp:coreProperties>');

    var defaults = '<Default Extension="rels" ContentType="application/'
      + 'vnd.openxmlformats-package.relationships+xml"/>'
      + '<Default Extension="xml" ContentType="application/xml"/>';
    Object.keys(extensions).forEach(function (ext) {
      defaults += '<Default Extension="' + ext + '" ContentType="'
        + extensions[ext] + '"/>';
    });
    var overrides = '<Override PartName="/ppt/presentation.xml" ContentType='
      + '"application/vnd.openxmlformats-officedocument.presentationml.'
      + 'presentation.main+xml"/>'
      + '<Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType='
      + '"application/vnd.openxmlformats-officedocument.presentationml.'
      + 'slideMaster+xml"/>'
      + '<Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType='
      + '"application/vnd.openxmlformats-officedocument.presentationml.'
      + 'slideLayout+xml"/>'
      + '<Override PartName="/ppt/theme/theme1.xml" ContentType="application/'
      + 'vnd.openxmlformats-officedocument.theme+xml"/>'
      + '<Override PartName="/docProps/core.xml" ContentType="application/'
      + 'vnd.openxmlformats-package.core-properties+xml"/>';
    slides.forEach(function (_, i) {
      overrides += '<Override PartName="/ppt/slides/slide' + (i + 1)
        + '.xml" ContentType="application/vnd.openxmlformats-officedocument.'
        + 'presentationml.slide+xml"/>';
    });
    zip.addText('[Content_Types].xml',
      XML_HEAD + '<Types xmlns="http://schemas.openxmlformats.org/package/'
      + '2006/content-types">' + defaults + overrides + '</Types>');

    return { blob: zip.blob(), skipped: skipped, slides: slides.length };
  }

  return { build: build, _zip: Zip, _hex: hex, _crc32: crc32 };
})();
