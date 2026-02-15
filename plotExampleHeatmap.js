/*
 * ══════════════════════════════════════════════════════════════════════════════
 * READING HEATMAP EXAMPLE GENERATOR
 * ══════════════════════════════════════════════════════════════════════════════
 *
 * This script plots an example reading heatmap with randomly generated data.
 *
 * HOW TO USE:
 * ───────────
 * 1. Open Zotero
 * 2. Go to Tools → Developer → Run JavaScript
 * 3. Copy and paste this script into the code panel
 * 4. Click "Run" or press Ctrl+R (Cmd+R on Mac)
 * 5. Select a browser to open the randomly generated heatmap
 *
 * ══════════════════════════════════════════════════════════════════════════════
 */

// ── Generate fake data ──
var counts = {};
var today = new Date();
var d = new Date(today);
d.setFullYear(d.getFullYear() - 1);

while (d <= today) {
    var key = d.toISOString().split("T")[0];
    var rand = Math.random();
    if (rand < 0.4) {
        if (rand < 0.15) { counts[key] = 1; }
        else if (rand < 0.28) { counts[key] = 2; }
        else if (rand < 0.35) {
            counts[key] = Math.floor(Math.random() * 3) + 3;
        }
        else {
            counts[key] = Math.floor(Math.random() * 4) + 6;
        }
    }
    d.setDate(d.getDate() + 1);
}

// ── Streak ──
var streak = 0;
var s = new Date(today);
var todayStr = s.toISOString().split("T")[0];
if (!counts[todayStr]) { s.setDate(s.getDate() - 1); }
while (true) {
    var sk = s.toISOString().split("T")[0];
    if (counts[sk] && counts[sk] > 0) {
        streak++;
        s.setDate(s.getDate() - 1);
    }
    else { break; }
}

// ── Stats ──
var totalPapers = 0;
var activeDays = 0;
var maxInDay = 0;
for (var dk in counts) {
    totalPapers += counts[dk];
    activeDays++;
    if (counts[dk] > maxInDay) { maxInDay = counts[dk]; }
}

// ── Config ──
var CELL = 13, GAP = 3, RAD = 2, ML = 40, MT = 24, MR = 8, MB = 8;
var DAYLABELS = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
var MONTHLABELS = ["Jan","Feb","Mar","Apr","May","Jun",
    "Jul","Aug","Sep","Oct","Nov","Dec"];
var DARK_COLORS = ["#2d333b","#0e4429","#006d32","#26a641","#39d353"];
var LIGHT_COLORS = ["#ebedf0","#9be9a8","#40c463","#30a14e","#216e39"];
var DARK_TEXT = "#8b949e";
var LIGHT_TEXT = "#57606a";

function getColor(count, colors) {
    if (count === 0) return colors[0];
    if (count === 1) return colors[1];
    if (count <= 3) return colors[2];
    if (count <= 5) return colors[3];
    return colors[4];
}

// ── Build day list ──
var oneYearAgo = new Date(today);
oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
oneYearAgo.setDate(oneYearAgo.getDate() + 1);
var start = new Date(oneYearAgo);
start.setDate(start.getDate() - start.getDay());

var days = [];
var cur = new Date(start);
while (cur <= today) {
    var ck = cur.toISOString().split("T")[0];
    days.push({
        dow: cur.getDay(),
        dateStr: ck,
        month: cur.getMonth(),
        count: counts[ck] || 0
    });
    cur.setDate(cur.getDate() + 1);
}

var weeks = [];
var cw = [];
for (var i = 0; i < days.length; i++) {
    if (days[i].dow === 0 && cw.length > 0) {
        weeks.push(cw);
        cw = [];
    }
    cw.push(days[i]);
}
if (cw.length > 0) { weeks.push(cw); }

var svgW = ML + weeks.length * (CELL + GAP) + MR;
var svgH = MT + 7 * (CELL + GAP) + MB;

// ── SVG builder function ──
function buildSVG(colors, textColor) {
    var svg = "";
    for (var dd = 0; dd < 7; dd++) {
        var ty = MT + dd * (CELL + GAP) + CELL * 0.75;
        svg += '<text x="' + (ML - 6) + '" y="' + ty + '"'
            + ' text-anchor="end" fill="' + textColor + '"'
            + ' font-size="10"'
            + ' font-family="-apple-system,sans-serif">'
            + DAYLABELS[dd] + '</text>';
    }
    var lastMonth = -1;
    for (var w = 0; w < weeks.length; w++) {
        var m = weeks[w][0].month;
        if (m !== lastMonth) {
            lastMonth = m;
            svg += '<text x="' + (ML + w * (CELL + GAP)) + '"'
                + ' y="' + (MT - 8) + '" fill="' + textColor + '"'
                + ' font-size="11"'
                + ' font-family="-apple-system,sans-serif">'
                + MONTHLABELS[m] + '</text>';
        }
    }
    for (var w = 0; w < weeks.length; w++) {
        for (var j = 0; j < weeks[w].length; j++) {
            var day = weeks[w][j];
            var cx = ML + w * (CELL + GAP);
            var cy = MT + day.dow * (CELL + GAP);
            var tip = day.count + " paper"
                + (day.count !== 1 ? "s" : "")
                + " on " + day.dateStr;
            svg += '<rect x="' + cx + '" y="' + cy + '"'
                + ' width="' + CELL + '" height="' + CELL + '"'
                + ' rx="' + RAD + '" ry="' + RAD + '"'
                + ' fill="' + getColor(day.count, colors) + '"'
                + ' data-count="' + day.count + '"'
                + ' data-date="' + day.dateStr + '">'
                + '<title>' + tip + '</title></rect>';
        }
    }
    return svg;
}

// ── Full standalone SVG builder ──
function buildFullSVG(colors, textColor, titleColor, bg) {
    var fullW = svgW + 20;
    var fullH = svgH + 160;
    var out = '<svg xmlns="http://www.w3.org/2000/svg"'
        + ' width="' + fullW + '" height="' + fullH + '">';
    out += '<rect width="100%" height="100%"'
        + ' fill="' + bg + '" rx="6"/>';
    out += '<text x="' + (fullW / 2) + '" y="28"'
        + ' text-anchor="middle" fill="' + titleColor + '"'
        + ' font-size="16" font-weight="600"'
        + ' font-family="-apple-system,sans-serif">'
        + '\uD83D\uDCDA Reading Heatmap</text>';
    out += '<text x="' + (fullW / 2) + '" y="46"'
        + ' text-anchor="middle" fill="' + textColor + '"'
        + ' font-size="12"'
        + ' font-family="-apple-system,sans-serif">'
        + 'Your paper reading activity over the past year</text>';
    var statWidth = 90;
    var statsStartX = (fullW - 4 * statWidth) / 2;
    var statsY = 75;
    var numColor = bg === "#0d1117" ? "#58a6ff" : "#0969da";
    var fireColor = bg === "#0d1117" ? "#f0883e" : "#cf222e";
    var stats = [
        { value: totalPapers, label: "Papers read", color: numColor },
        { value: activeDays, label: "Active days", color: numColor },
        { value: maxInDay, label: "Best day", color: numColor },
        { value: "\uD83D\uDD25 " + streak, label: "Day streak", color: fireColor }
    ];
    for (var si = 0; si < stats.length; si++) {
        var sx = statsStartX + si * statWidth + statWidth / 2;
        out += '<text x="' + sx + '" y="' + statsY + '"'
            + ' text-anchor="middle" fill="' + stats[si].color + '"'
            + ' font-size="22" font-weight="700"'
            + ' font-family="-apple-system,sans-serif">'
            + stats[si].value + '</text>';
        out += '<text x="' + sx + '" y="' + (statsY + 16) + '"'
            + ' text-anchor="middle" fill="' + textColor + '"'
            + ' font-size="11"'
            + ' font-family="-apple-system,sans-serif">'
            + stats[si].label + '</text>';
    }
    out += '<g transform="translate(10, 105)">'
        + buildSVG(colors, textColor) + '</g>';
    var legY = svgH + 120;
    var legX = fullW / 2 - 60;
    out += '<text x="' + (legX - 4) + '" y="' + (legY + 10) + '"'
        + ' fill="' + textColor + '" font-size="11"'
        + ' font-family="-apple-system,sans-serif"'
        + ' text-anchor="end">Less</text>';
    for (var c = 0; c < colors.length; c++) {
        out += '<rect x="' + (legX + c * 16) + '"'
            + ' y="' + legY + '" width="12" height="12"'
            + ' rx="2" fill="' + colors[c] + '"/>';
    }
    out += '<text x="' + (legX + colors.length * 16 + 4) + '"'
        + ' y="' + (legY + 10) + '" fill="' + textColor + '"'
        + ' font-size="11"'
        + ' font-family="-apple-system,sans-serif">More</text>';
    out += '</svg>';
    return out;
}

var darkSvg = buildFullSVG(DARK_COLORS, DARK_TEXT, "#c9d1d9", "#0d1117");
var lightSvg = buildFullSVG(LIGHT_COLORS, LIGHT_TEXT, "#24292f", "#ffffff");
var gridSvg = buildSVG(DARK_COLORS, DARK_TEXT);

// ── CSS ──
var css = "";
css += "* { margin:0; padding:0; box-sizing:border-box; }";
css += "body { font-family:-apple-system,BlinkMacSystemFont,"
    + "Helvetica,Arial,sans-serif; background:#0d1117;"
    + " color:#c9d1d9; display:flex; flex-direction:column;"
    + " align-items:center; padding:32px 24px;"
    + " transition:background 0.3s, color 0.3s; }";
css += "h1 { font-size:20px; font-weight:600; margin-bottom:4px; }";
css += ".sub { font-size:14px; color:#8b949e; margin-bottom:24px; }";
css += ".stats { display:flex; gap:32px; margin-bottom:24px;"
    + " flex-wrap:wrap; justify-content:center; }";
css += ".stat { text-align:center; min-width:100px; }";
css += ".sv { font-size:28px; font-weight:700; color:#58a6ff; }";
css += ".sl { font-size:12px; color:#8b949e; margin-top:2px; }";
css += ".fire { color:#f0883e; }";
css += ".wrap { overflow-x:auto; max-width:100%; padding:16px;"
    + " background:#161b22; border:1px solid #30363d;"
    + " border-radius:6px; transition:background 0.3s,"
    + " border-color 0.3s; }";
css += "svg rect[data-count] { cursor:pointer; }";
css += "svg rect[data-count]:hover { stroke:#c9d1d9;"
    + " stroke-width:1.5; }";
css += ".leg { display:flex; align-items:center; gap:6px;"
    + " margin-top:12px; font-size:12px; color:#8b949e; }";
css += ".actions { display:flex; gap:12px; margin-top:24px;"
    + " flex-wrap:wrap; justify-content:center; }";
css += ".btn { background:#21262d; color:#c9d1d9;"
    + " border:1px solid #30363d; border-radius:6px;"
    + " padding:8px 16px; font-size:13px; cursor:pointer;"
    + " font-family:inherit; transition:all 0.2s; }";
css += ".btn:hover { background:#30363d; }";
css += ".btn-primary { background:#238636;"
    + " border-color:#238636; color:#fff; }";
css += ".btn-primary:hover { background:#2ea043; }";
css += ".toast { position:fixed; bottom:24px; left:50%;"
    + " transform:translateX(-50%); background:#238636;"
    + " color:#fff; padding:8px 20px; border-radius:6px;"
    + " font-size:13px; opacity:0; transition:opacity 0.3s;"
    + " pointer-events:none; }";
css += ".toast.show { opacity:1; }";
css += ".tip { position:fixed; background:#1b1f23; color:#c9d1d9;"
    + " border:1px solid #30363d; border-radius:6px;"
    + " padding:8px 12px; font-size:12px; pointer-events:none;"
    + " display:none; z-index:999; white-space:nowrap;"
    + " box-shadow:0 4px 12px rgba(0,0,0,0.4);"
    + " transition:background 0.3s, border-color 0.3s,"
    + " color 0.3s; }";
css += ".tip .tip-count { font-size:16px; font-weight:700;"
    + " color:#58a6ff; }";
css += ".tip .tip-label { color:#8b949e; font-size:11px; }";
css += ".tip .tip-date { color:#8b949e; font-size:11px;"
    + " margin-top:2px; }";
css += ".theme-toggle { position:fixed; top:16px; right:16px;"
    + " background:#21262d; border:1px solid #30363d;"
    + " border-radius:50%; width:40px; height:40px;"
    + " cursor:pointer; display:flex; align-items:center;"
    + " justify-content:center; font-size:20px;"
    + " transition:all 0.3s; z-index:1000; padding:0; }";
css += ".theme-toggle:hover { background:#30363d; }";

// Light mode
css += "body.light { background:#ffffff; color:#24292f; }";
css += "body.light h1 { color:#24292f; }";
css += "body.light .sub { color:#57606a; }";
css += "body.light .sv { color:#0969da; }";
css += "body.light .sl { color:#57606a; }";
css += "body.light .fire { color:#cf222e; }";
css += "body.light .wrap { background:#f6f8fa;"
    + " border-color:#d0d7de; }";
css += "body.light svg rect[data-count]:hover {"
    + " stroke:#24292f; stroke-width:1.5; }";
css += "body.light .leg { color:#57606a; }";
css += "body.light .btn { background:#f6f8fa; color:#24292f;"
    + " border-color:#d0d7de; }";
css += "body.light .btn:hover { background:#eaeef2; }";
css += "body.light .btn-primary { background:#2da44e;"
    + " border-color:#2da44e; color:#fff; }";
css += "body.light .btn-primary:hover { background:#218838; }";
css += "body.light .toast { background:#2da44e; }";
css += "body.light .tip { background:#ffffff; color:#24292f;"
    + " border-color:#d0d7de;"
    + " box-shadow:0 4px 12px rgba(0,0,0,0.1); }";
css += "body.light .tip .tip-count { color:#0969da; }";
css += "body.light .tip .tip-label { color:#57606a; }";
css += "body.light .tip .tip-date { color:#57606a; }";
css += "body.light .theme-toggle { background:#f6f8fa;"
    + " border-color:#d0d7de; }";
css += "body.light .theme-toggle:hover { background:#eaeef2; }";

// ── Page script ──
var js = "";
js += "function showToast(msg) {"
    + " var t = document.getElementById('toast');"
    + " t.textContent = msg; t.classList.add('show');"
    + " setTimeout(function(){t.classList.remove('show');},2000);"
    + "}";

js += "var isDark = true;"
    + "var darkColors = ['" + DARK_COLORS.join("','") + "'];"
    + "var lightColors = ['" + LIGHT_COLORS.join("','") + "'];"
    + "var darkText = '#8b949e';"
    + "var lightText = '#57606a';";

js += "function getRawSvg() {"
    + " return isDark"
    + " ? document.getElementById('svgDark').textContent"
    + " : document.getElementById('svgLight').textContent;"
    + "}";

js += "function getColor(count, dark) {"
    + " var c = dark ? darkColors : lightColors;"
    + " if (count===0) return c[0];"
    + " if (count===1) return c[1];"
    + " if (count<=3) return c[2];"
    + " if (count<=5) return c[3];"
    + " return c[4];"
    + "}";

// Theme toggle
js += "document.getElementById('themeBtn').onclick = function() {"
    + " isDark = !isDark;"
    + " document.body.classList.toggle('light');"
    + " this.textContent = isDark"
    + " ? '\\uD83C\\uDF19' : '\\u2600\\uFE0F';"
    + " var rects = document.getElementById('heatsvg')"
    + ".querySelectorAll('rect[data-count]');"
    + " for (var i=0;i<rects.length;i++) {"
    + " var cnt=parseInt(rects[i].getAttribute('data-count'),10);"
    + " rects[i].setAttribute('fill',getColor(cnt,isDark));"
    + " }"
    + " var texts = document.getElementById('heatsvg')"
    + ".querySelectorAll('text');"
    + " var tc = isDark ? darkText : lightText;"
    + " for (var j=0;j<texts.length;j++) {"
    + " texts[j].setAttribute('fill',tc);"
    + " }"
    + " var sw = document.querySelectorAll('.leg-swatch');"
    + " var co = isDark ? darkColors : lightColors;"
    + " for (var s=0;s<sw.length;s++) {"
    + " sw[s].setAttribute('fill',co[s]);"
    + " }"
    + "};";

// Tooltip
js += "var tip=document.getElementById('tip');"
    + "var tipCount=document.getElementById('tipCount');"
    + "var tipLabel=document.getElementById('tipLabel');"
    + "var tipDate=document.getElementById('tipDate');"
    + "var allRects=document.getElementById('heatsvg')"
    + ".querySelectorAll('rect[data-count]');"
    + "for(var i=0;i<allRects.length;i++){"
    + "(function(r){"
    + "r.addEventListener('mouseenter',function(e){"
    + "var c=parseInt(r.getAttribute('data-count'),10);"
    + "var d=r.getAttribute('data-date');"
    + "tipCount.textContent=c;"
    + "tipLabel.textContent=c===1?'paper read':'papers read';"
    + "tipDate.textContent=d;"
    + "tip.style.display='block';"
    + "tip.style.left=(e.clientX+14)+'px';"
    + "tip.style.top=(e.clientY-60)+'px';});"
    + "r.addEventListener('mousemove',function(e){"
    + "tip.style.left=(e.clientX+14)+'px';"
    + "tip.style.top=(e.clientY-60)+'px';});"
    + "r.addEventListener('mouseleave',function(){"
    + "tip.style.display='none';});"
    + "})(allRects[i]);}";

// Copy SVG
js += "document.getElementById('btnCopy').onclick=function(){"
    + "try{"
    + "var ta=document.createElement('textarea');"
    + "ta.value=getRawSvg();"
    + "ta.style.position='fixed';ta.style.left='-9999px';"
    + "document.body.appendChild(ta);ta.select();"
    + "document.execCommand('copy');"
    + "document.body.removeChild(ta);"
    + "showToast('SVG copied to clipboard!');"
    + "}catch(e){showToast('Copy failed');}};";

// Save SVG
js += "document.getElementById('btnSave').onclick=function(){"
    + "var blob=new Blob([getRawSvg()],{type:'image/svg+xml'});"
    + "var a=document.createElement('a');"
    + "a.href=URL.createObjectURL(blob);"
    + "a.download='reading-heatmap.svg';a.click();"
    + "showToast('SVG saved!');};";

// Save PNG
js += "document.getElementById('btnPng').onclick=function(){"
    + "var scale=4;"
    + "var svgBlob=new Blob([getRawSvg()],"
    + "{type:'image/svg+xml;charset=utf-8'});"
    + "var url=URL.createObjectURL(svgBlob);"
    + "var img=new Image();"
    + "img.onload=function(){"
    + "var cvs=document.getElementById('cvs');"
    + "cvs.width=img.width*scale;"
    + "cvs.height=img.height*scale;"
    + "var ctx=cvs.getContext('2d');"
    + "ctx.scale(scale,scale);"
    + "ctx.drawImage(img,0,0);"
    + "URL.revokeObjectURL(url);"
    + "cvs.toBlob(function(blob){"
    + "var a=document.createElement('a');"
    + "a.href=URL.createObjectURL(blob);"
    + "a.download='reading-heatmap.png';a.click();"
    + "showToast('PNG saved!');},'image/png');};"
    + "img.onerror=function(){showToast('PNG export failed');};"
    + "img.src=url;};";

// Save HTML
js += "document.getElementById('btnShare').onclick=function(){"
    + "var bg=isDark?'#0d1117':'#ffffff';"
    + "var h='<!DOCTYPE html><html><head><meta charset=utf-8>';"
    + "h+='<title>Reading Heatmap</title><style>';"
    + "h+='body{background:'+bg+';display:flex;"
    + "justify-content:center;align-items:center;"
    + "min-height:100vh;margin:0;}';"
    + "h+='</style></head><body>'+getRawSvg()+'</body></html>';"
    + "var blob=new Blob([h],{type:'text/html'});"
    + "var a=document.createElement('a');"
    + "a.href=URL.createObjectURL(blob);"
    + "a.download='reading-heatmap.html';a.click();"
    + "showToast('HTML saved!');};";

// ── Assemble HTML ──
var html = "<!DOCTYPE html><html><head><meta charset='utf-8'>"
    + "<title>Demo Heatmap</title>"
    + "<style>" + css + "</style></head><body>";

// Theme toggle
html += "<button class='theme-toggle' id='themeBtn'"
    + " title='Toggle light/dark mode'>\uD83C\uDF19</button>";

// Header
html += "<h1>\uD83D\uDCDA Reading Heatmap</h1>"
    + "<div class='sub'>Your paper reading activity over the past year</div>";

// Stats
html += "<div class='stats'>"
    + "<div class='stat'><div class='sv'>" + totalPapers
    + "</div><div class='sl'>Papers read</div></div>"
    + "<div class='stat'><div class='sv'>" + activeDays
    + "</div><div class='sl'>Active days</div></div>"
    + "<div class='stat'><div class='sv'>" + maxInDay
    + "</div><div class='sl'>Best day</div></div>"
    + "<div class='stat'><div class='sv fire'>\uD83D\uDD25 "
    + streak + "</div><div class='sl'>Day streak</div></div>"
    + "</div>";

// Heatmap
html += "<div class='wrap'>"
    + '<svg id="heatsvg" width="' + svgW + '" height="' + svgH
    + '" xmlns="http://www.w3.org/2000/svg">'
    + gridSvg + '</svg></div>';

// Legend
html += "<div class='leg' id='legend'>Less ";
for (var ci = 0; ci < DARK_COLORS.length; ci++) {
    html += '<svg width="12" height="12">'
        + '<rect class="leg-swatch" width="12" height="12"'
        + ' rx="2" fill="' + DARK_COLORS[ci] + '"/></svg>';
}
html += " More</div>";

// Hidden export data
html += "<div id='svgDark' style='display:none'>"
    + darkSvg.replace(/</g,"&lt;").replace(/>/g,"&gt;")
    + "</div>";
html += "<div id='svgLight' style='display:none'>"
    + lightSvg.replace(/</g,"&lt;").replace(/>/g,"&gt;")
    + "</div>";

// Canvas, tooltip, buttons
html += "<canvas id='cvs' style='display:none'></canvas>";
html += "<div class='tip' id='tip'>"
    + "<div class='tip-count' id='tipCount'></div>"
    + "<div class='tip-label' id='tipLabel'></div>"
    + "<div class='tip-date' id='tipDate'></div></div>";
html += "<div class='actions'>"
    + "<button class='btn' id='btnCopy'>"
    + "\uD83D\uDCCB Copy SVG</button>"
    + "<button class='btn' id='btnSave'>"
    + "\uD83D\uDCBE Save SVG File</button>"
    + "<button class='btn' id='btnPng'>"
    + "\uD83D\uDDBC Save PNG</button>"
    + "<button class='btn btn-primary' id='btnShare'>"
    + "\uD83D\uDCE4 Save Shareable HTML</button>"
    + "</div>";
html += "<div class='toast' id='toast'>Copied!</div>";

// Script
html += "<script>" + js + "<\/script>";
html += "</body></html>";

// ── Write and open ──
var tmpFile = Zotero.getTempDirectory();
tmpFile.append("readtracker_demo_heatmap.html");
await Zotero.File.putContentsAsync(tmpFile, html);
var fileURI = Services.io.newFileURI(tmpFile).spec;
Zotero.launchURL(fileURI);