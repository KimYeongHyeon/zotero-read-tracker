var ZoteroReadTrackerHeatmap = {

    // ───────────────── Theme colors ─────────────────

    _themes: {
        dark: {
            empty: "#2d333b",
            l1: "#0e4429",
            l2: "#006d32",
            l3: "#26a641",
            l4: "#39d353",
            bg: "#0d1117",
            wrapBg: "#161b22",
            border: "#30363d",
            title: "#c9d1d9",
            text: "#8b949e",
            stat: "#58a6ff",
            fire: "#f0883e"
        },
        light: {
            empty: "#ebedf0",
            l1: "#9be9a8",
            l2: "#40c463",
            l3: "#30a14e",
            l4: "#216e39",
            bg: "#ffffff",
            wrapBg: "#f6f8fa",
            border: "#d0d7de",
            title: "#24292f",
            text: "#57606a",
            stat: "#0969da",
            fire: "#cf222e"
        }
    },

    _getColor: function(count, theme) {
        var t = this._themes[theme || "dark"];
        if (count === 0) return t.empty;
        if (count === 1) return t.l1;
        if (count <= 3) return t.l2;
        if (count <= 5) return t.l3;
        return t.l4;
    },

    _getColors: function(theme) {
        var t = this._themes[theme || "dark"];
        return [t.empty, t.l1, t.l2, t.l3, t.l4];
    },

    // ───────────────── SVG Builder ─────────────────

    buildSVG: function(counts, theme) {
        var th = theme || "dark";
        var t = this._themes[th];
        var CELL = 13;
        var GAP = 3;
        var RAD = 2;
        var ML = 40;
        var MT = 24;
        var MR = 8;
        var MB = 8;
        var DAYLABELS = [
            "Sun", "Mon", "Tue", "Wed",
            "Thu", "Fri", "Sat"
        ];
        var MONTHLABELS = [
            "Jan", "Feb", "Mar", "Apr", "May", "Jun",
            "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
        ];

        var today = new Date();
        var oneYearAgo = new Date(today);
        oneYearAgo.setFullYear(
            oneYearAgo.getFullYear() - 1
        );
        oneYearAgo.setDate(oneYearAgo.getDate() + 1);
        var start = new Date(oneYearAgo);
        start.setDate(start.getDate() - start.getDay());

        var days = [];
        var current = new Date(start);
        while (current <= today) {
            var key = current.toISOString().split("T")[0];
            days.push({
                dow: current.getDay(),
                dateStr: key,
                month: current.getMonth(),
                count: counts[key] || 0
            });
            current.setDate(current.getDate() + 1);
        }

        var weeks = [];
        var currentWeek = [];
        for (var i = 0; i < days.length; i++) {
            if (days[i].dow === 0
                && currentWeek.length > 0) {
                weeks.push(currentWeek);
                currentWeek = [];
            }
            currentWeek.push(days[i]);
        }
        if (currentWeek.length > 0) {
            weeks.push(currentWeek);
        }

        var numWeeks = weeks.length;
        var svgW = ML + numWeeks * (CELL + GAP) + MR;
        var svgH = MT + 7 * (CELL + GAP) + MB;

        var svg = "";

        // Day labels
        for (var d = 0; d < 7; d++) {
            var ty = MT + d * (CELL + GAP) + CELL * 0.75;
            svg += '<text x="' + (ML - 6) + '"';
            svg += ' y="' + ty + '"';
            svg += ' text-anchor="end"';
            svg += ' fill="' + t.text + '"';
            svg += ' font-size="10"';
            svg += ' font-family='
                + '"-apple-system,sans-serif">';
            svg += DAYLABELS[d] + '</text>';
        }

        // Month labels
        var lastMonth = -1;
        for (var w = 0; w < weeks.length; w++) {
            var m = weeks[w][0].month;
            if (m !== lastMonth) {
                lastMonth = m;
                svg += '<text x="'
                    + (ML + w * (CELL + GAP)) + '"';
                svg += ' y="' + (MT - 8) + '"';
                svg += ' fill="' + t.text + '"';
                svg += ' font-size="11"';
                svg += ' font-family='
                    + '"-apple-system,sans-serif">';
                svg += MONTHLABELS[m] + '</text>';
            }
        }

        // Day cells
        var self = this;
        for (var w = 0; w < weeks.length; w++) {
            for (var j = 0; j < weeks[w].length; j++) {
                var day = weeks[w][j];
                var cx = ML + w * (CELL + GAP);
                var cy = MT + day.dow * (CELL + GAP);
                var color = self._getColor(day.count, th);
                var tip = day.count + " paper"
                    + (day.count !== 1 ? "s" : "")
                    + " on " + day.dateStr;
                svg += '<rect x="' + cx + '"';
                svg += ' y="' + cy + '"';
                svg += ' width="' + CELL + '"';
                svg += ' height="' + CELL + '"';
                svg += ' rx="' + RAD + '"';
                svg += ' ry="' + RAD + '"';
                svg += ' fill="' + color + '"';
                svg += ' data-count="' + day.count + '"';
                svg += ' data-date="' + day.dateStr + '">';
                svg += '<title>' + tip + '</title></rect>';
            }
        }

        return {
            svg: svg,
            width: svgW,
            height: svgH
        };
    },

    // ───────────────── Full standalone SVG ─────────────────

    buildFullSVGString: function(counts, theme, streak) {
        var th = theme || "dark";
        var t = this._themes[th];
        var titleColor = t.title;
        var textColor = t.text;
        var bg = t.bg;
        var data = this.buildSVG(counts, th);
        var COLORS = this._getColors(th);

        var totalPapers = 0;
        var activeDays = 0;
        var maxInDay = 0;
        for (var k in counts) {
            if (counts.hasOwnProperty(k)) {
                totalPapers += counts[k];
                activeDays++;
                if (counts[k] > maxInDay) {
                    maxInDay = counts[k];
                }
            }
        }

        var fullW = data.width + 20;
        var fullH = data.height + 160;

        var out = '';
        out += '<svg xmlns="http://www.w3.org/2000/svg"';
        out += ' width="' + fullW + '"';
        out += ' height="' + fullH + '">';
        out += '<rect width="100%" height="100%"';
        out += ' fill="' + t.bg + '" rx="6"/>';

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

        var statsY = 52;
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

        out += '<g transform="translate(10, 105)">';
        out += data.svg + '</g>';

        var legY = data.height + 120;
        var legStartX = fullW / 2 - 60;
        out += '<text x="' + (legStartX - 4) + '"';
        out += ' y="' + (legY + 10) + '"';
        out += ' fill="' + t.text + '"';
        out += ' font-size="11"';
        out += ' font-family="-apple-system,sans-serif"';
        out += ' text-anchor="end">Less</text>';
        for (var c = 0; c < COLORS.length; c++) {
            out += '<rect x="'
                + (legStartX + c * 16) + '"';
            out += ' y="' + legY + '"';
            out += ' width="12" height="12" rx="2"';
            out += ' fill="' + COLORS[c] + '"/>';
        }
        out += '<text x="'
            + (legStartX + COLORS.length * 16 + 4) + '"';
        out += ' y="' + (legY + 10) + '"';
        out += ' fill="' + t.text + '"';
        out += ' font-size="11"';
        out += ' font-family="-apple-system,sans-serif">';
        out += 'More</text>';

        out += '</svg>';
        return out;
    },

    // ───────────────── CSS strings ─────────────────

    _buildCSS: function() {
        var css = "";

        // Base / dark mode
        css += "* { margin:0; padding:0;";
        css += "  box-sizing:border-box; }";
        css += "body { font-family:-apple-system,";
        css += "  BlinkMacSystemFont,Helvetica,Arial,";
        css += "  sans-serif;";
        css += "  background:#0d1117; color:#c9d1d9;";
        css += "  display:flex; flex-direction:column;";
        css += "  align-items:center; padding:32px 24px;";
        css += "  transition:background 0.3s,";
        css += "  color 0.3s; }";
        css += "h1 { font-size:20px; font-weight:600;";
        css += "  margin-bottom:4px; }";
        css += ".sub { font-size:14px; color:#8b949e;";
        css += "  margin-bottom:24px; }";
        css += ".stats { display:flex; gap:32px;";
        css += "  margin-bottom:24px; flex-wrap:wrap;";
        css += "  justify-content:center; }";
        css += ".stat { text-align:center;";
        css += "  min-width:100px; }";
        css += ".sv { font-size:28px; font-weight:700;";
        css += "  color:#58a6ff; }";
        css += ".sl { font-size:12px; color:#8b949e;";
        css += "  margin-top:2px; }";
        css += ".fire { color:#f0883e; }";
        css += ".wrap { overflow-x:auto; max-width:100%;";
        css += "  padding:16px; background:#161b22;";
        css += "  border:1px solid #30363d;";
        css += "  border-radius:6px;";
        css += "  transition:background 0.3s,";
        css += "  border-color 0.3s; }";
        css += "svg rect[data-count] { cursor:pointer; }";
        css += "svg rect[data-count]:hover {";
        css += "  stroke:#c9d1d9; stroke-width:1.5; }";
        css += ".leg { display:flex; align-items:center;";
        css += "  gap:6px; margin-top:12px;";
        css += "  font-size:12px; color:#8b949e; }";
        css += ".actions { display:flex; gap:12px;";
        css += "  margin-top:24px; flex-wrap:wrap;";
        css += "  justify-content:center; }";
        css += ".btn { background:#21262d; color:#c9d1d9;";
        css += "  border:1px solid #30363d;";
        css += "  border-radius:6px; padding:8px 16px;";
        css += "  font-size:13px; cursor:pointer;";
        css += "  font-family:inherit;";
        css += "  transition:all 0.2s; }";
        css += ".btn:hover { background:#30363d; }";
        css += ".btn-primary { background:#238636;";
        css += "  border-color:#238636; color:#fff; }";
        css += ".btn-primary:hover {";
        css += "  background:#2ea043; }";
        css += ".toast { position:fixed; bottom:24px;";
        css += "  left:50%; transform:translateX(-50%);";
        css += "  background:#238636; color:#fff;";
        css += "  padding:8px 20px; border-radius:6px;";
        css += "  font-size:13px; opacity:0;";
        css += "  transition:opacity 0.3s;";
        css += "  pointer-events:none; }";
        css += ".toast.show { opacity:1; }";
        css += ".tip { position:fixed;";
        css += "  background:#1b1f23;";
        css += "  color:#c9d1d9;";
        css += "  border:1px solid #30363d;";
        css += "  border-radius:6px; padding:8px 12px;";
        css += "  font-size:12px; pointer-events:none;";
        css += "  display:none; z-index:999;";
        css += "  white-space:nowrap;";
        css += "  box-shadow:0 4px 12px rgba(0,0,0,0.4);";
        css += "  transition:background 0.3s,";
        css += "  border-color 0.3s, color 0.3s; }";
        css += ".tip .tip-count { font-size:16px;";
        css += "  font-weight:700; color:#58a6ff; }";
        css += ".tip .tip-label { color:#8b949e;";
        css += "  font-size:11px; }";
        css += ".tip .tip-date { color:#8b949e;";
        css += "  font-size:11px; margin-top:2px; }";
        css += ".theme-toggle { position:fixed;";
        css += "  top:16px; right:16px;";
        css += "  background:#21262d;";
        css += "  border:1px solid #30363d;";
        css += "  border-radius:50%; width:40px;";
        css += "  height:40px; cursor:pointer;";
        css += "  display:flex; align-items:center;";
        css += "  justify-content:center; font-size:20px;";
        css += "  transition:all 0.3s;";
        css += "  z-index:1000; padding:0; }";
        css += ".theme-toggle:hover {";
        css += "  background:#30363d; }";

        // Light mode overrides
        css += "body.light { background:#ffffff;";
        css += "  color:#24292f; }";
        css += "body.light h1 { color:#24292f; }";
        css += "body.light .sub { color:#57606a; }";
        css += "body.light .sv { color:#0969da; }";
        css += "body.light .sl { color:#57606a; }";
        css += "body.light .fire { color:#cf222e; }";
        css += "body.light .wrap { background:#f6f8fa;";
        css += "  border-color:#d0d7de; }";
        css += "body.light svg rect[data-count]:hover {";
        css += "  stroke:#24292f; stroke-width:1.5; }";
        css += "body.light .leg { color:#57606a; }";
        css += "body.light .btn { background:#f6f8fa;";
        css += "  color:#24292f;";
        css += "  border-color:#d0d7de; }";
        css += "body.light .btn:hover {";
        css += "  background:#eaeef2; }";
        css += "body.light .btn-primary {";
        css += "  background:#2da44e;";
        css += "  border-color:#2da44e;";
        css += "  color:#fff; }";
        css += "body.light .btn-primary:hover {";
        css += "  background:#218838; }";
        css += "body.light .toast {";
        css += "  background:#2da44e; }";
        css += "body.light .tip { background:#ffffff;";
        css += "  color:#24292f;";
        css += "  border-color:#d0d7de;";
        css += "  box-shadow:0 4px 12px rgba(0,0,0,0.1);}";
        css += "body.light .tip .tip-count {";
        css += "  color:#0969da; }";
        css += "body.light .tip .tip-label {";
        css += "  color:#57606a; }";
        css += "body.light .tip .tip-date {";
        css += "  color:#57606a; }";
        css += "body.light .theme-toggle {";
        css += "  background:#f6f8fa;";
        css += "  border-color:#d0d7de; }";
        css += "body.light .theme-toggle:hover {";
        css += "  background:#eaeef2; }";

        return css;
    },

    // ───────────────── Page script ─────────────────

    _buildScript: function(colorsDark, colorsLight) {
        var js = "";

        // Toast helper
        js += "function showToast(msg) {";
        js += "  var t = document.getElementById('toast');";
        js += "  t.textContent = msg;";
        js += "  t.classList.add('show');";
        js += "  setTimeout(function() {";
        js += "    t.classList.remove('show');";
        js += "  }, 2000);";
        js += "}";

        // Theme state
        js += "var isDark = true;";
        js += "var darkColors = ["
            + '"' + colorsDark.join('","') + '"];';
        js += "var lightColors = ["
            + '"' + colorsLight.join('","') + '"];';
        js += "var darkText = '#8b949e';";
        js += "var lightText = '#57606a';";

        js += "function getRawSvg() {";
        js += "  return isDark";
        js += "    ? document.getElementById('svgDark')";
        js += "      .textContent";
        js += "    : document.getElementById('svgLight')";
        js += "      .textContent;";
        js += "}";

        js += "function getColor(count, dark) {";
        js += "  var c = dark ? darkColors : lightColors;";
        js += "  if (count === 0) return c[0];";
        js += "  if (count === 1) return c[1];";
        js += "  if (count <= 3) return c[2];";
        js += "  if (count <= 5) return c[3];";
        js += "  return c[4];";
        js += "}";

        // Theme toggle
        js += "document.getElementById('themeBtn')";
        js += "  .onclick = function() {";
        js += "  isDark = !isDark;";
        js += "  document.body.classList.toggle('light');";
        js += "  this.textContent = isDark";
        js += "    ? '\\uD83C\\uDF19'";
        js += "    : '\\u2600\\uFE0F';";
        js += "  var rects = document.getElementById(";
        js += "    'heatsvg').querySelectorAll(";
        js += "    'rect[data-count]');";
        js += "  for (var i=0; i<rects.length; i++) {";
        js += "    var cnt = parseInt(";
        js += "      rects[i].getAttribute('data-count')";
        js += "      , 10);";
        js += "    rects[i].setAttribute('fill',";
        js += "      getColor(cnt, isDark));";
        js += "  }";
        js += "  var texts = document.getElementById(";
        js += "    'heatsvg').querySelectorAll('text');";
        js += "  var txtColor = isDark";
        js += "    ? darkText : lightText;";
        js += "  for (var j=0; j<texts.length; j++) {";
        js += "    texts[j].setAttribute('fill',";
        js += "      txtColor);";
        js += "  }";
        js += "  var swatches = document";
        js += "    .querySelectorAll('.leg-swatch');";
        js += "  var cols = isDark";
        js += "    ? darkColors : lightColors;";
        js += "  for (var s=0; s<swatches.length; s++){";
        js += "    swatches[s].setAttribute('fill',";
        js += "      cols[s]);";
        js += "  }";
        js += "};";

        // Tooltip
        js += "var tip = document.getElementById('tip');";
        js += "var tipCount = document.getElementById(";
        js += "  'tipCount');";
        js += "var tipLabel = document.getElementById(";
        js += "  'tipLabel');";
        js += "var tipDate = document.getElementById(";
        js += "  'tipDate');";
        js += "var allRects = document.getElementById(";
        js += "  'heatsvg').querySelectorAll(";
        js += "  'rect[data-count]');";
        js += "for (var i=0; i<allRects.length; i++) {";
        js += "  (function(r) {";
        js += "    r.addEventListener('mouseenter',";
        js += "      function(e) {";
        js += "      var count = parseInt(";
        js += "        r.getAttribute('data-count'),10);";
        js += "      var date = r.getAttribute(";
        js += "        'data-date');";
        js += "      tipCount.textContent = count;";
        js += "      tipLabel.textContent = count === 1";
        js += "        ? 'paper read' : 'papers read';";
        js += "      tipDate.textContent = date;";
        js += "      tip.style.display = 'block';";
        js += "      tip.style.left =";
        js += "        (e.clientX + 14) + 'px';";
        js += "      tip.style.top =";
        js += "        (e.clientY - 60) + 'px';";
        js += "    });";
        js += "    r.addEventListener('mousemove',";
        js += "      function(e) {";
        js += "      tip.style.left =";
        js += "        (e.clientX + 14) + 'px';";
        js += "      tip.style.top =";
        js += "        (e.clientY - 60) + 'px';";
        js += "    });";
        js += "    r.addEventListener('mouseleave',";
        js += "      function() {";
        js += "      tip.style.display = 'none';";
        js += "    });";
        js += "  })(allRects[i]);";
        js += "}";

        // Copy SVG
        js += "document.getElementById('btnCopy')";
        js += "  .onclick = function() {";
        js += "  try {";
        js += "    var ta = document.createElement(";
        js += "      'textarea');";
        js += "    ta.value = getRawSvg();";
        js += "    ta.style.position = 'fixed';";
        js += "    ta.style.left = '-9999px';";
        js += "    document.body.appendChild(ta);";
        js += "    ta.select();";
        js += "    document.execCommand('copy');";
        js += "    document.body.removeChild(ta);";
        js += "    showToast('SVG copied to clipboard!');";
        js += "  } catch(e) {";
        js += "    showToast('Copy failed'); }";
        js += "};";

        // Save SVG
        js += "document.getElementById('btnSave')";
        js += "  .onclick = function() {";
        js += "  var blob = new Blob([getRawSvg()],";
        js += "    {type:'image/svg+xml'});";
        js += "  var a = document.createElement('a');";
        js += "  a.href = URL.createObjectURL(blob);";
        js += "  a.download = 'reading-heatmap.svg';";
        js += "  a.click();";
        js += "  showToast('SVG saved!');";
        js += "};";

        // Save PNG
        js += "document.getElementById('btnPng')";
        js += "  .onclick = function() {";
        js += "  var scale = 4;";
        js += "  var svgBlob = new Blob([getRawSvg()],";
        js += "    {type:'image/svg+xml;charset=utf-8'});";
        js += "  var url = URL.createObjectURL(svgBlob);";
        js += "  var img = new Image();";
        js += "  img.onload = function() {";
        js += "    var cvs = document.getElementById(";
        js += "      'cvs');";
        js += "    cvs.width = img.width * scale;";
        js += "    cvs.height = img.height * scale;";
        js += "    var ctx = cvs.getContext('2d');";
        js += "    ctx.scale(scale, scale);";
        js += "    ctx.drawImage(img, 0, 0);";
        js += "    URL.revokeObjectURL(url);";
        js += "    cvs.toBlob(function(blob) {";
        js += "      var a = document.createElement('a');";
        js += "      a.href = URL.createObjectURL(blob);";
        js += "      a.download = 'reading-heatmap.png';";
        js += "      a.click();";
        js += "      showToast('PNG saved!');";
        js += "    }, 'image/png');";
        js += "  };";
        js += "  img.onerror = function() {";
        js += "    showToast('PNG export failed');";
        js += "  };";
        js += "  img.src = url;";
        js += "};";

        // Save shareable HTML
        js += "document.getElementById('btnShare')";
        js += "  .onclick = function() {";
        js += "  var bg = isDark";
        js += "    ? '#0d1117' : '#ffffff';";
        js += "  var shareHTML = '<!DOCTYPE html>';";
        js += "  shareHTML += '<html><head>';";
        js += "  shareHTML += '<meta charset=utf-8>';";
        js += "  shareHTML += '<title>Reading ";
        js += "Heatmap</title>';";
        js += "  shareHTML += '<style>';";
        js += "  shareHTML += 'body{background:' + bg";
        js += "    + ';display:flex;";
        js += "    justify-content:center;";
        js += "    align-items:center;min-height:100vh;";
        js += "    margin:0;}';";
        js += "  shareHTML += '</style></head><body>';";
        js += "  shareHTML += getRawSvg();";
        js += "  shareHTML += '</body></html>';";
        js += "  var blob = new Blob([shareHTML],";
        js += "    {type:'text/html'});";
        js += "  var a = document.createElement('a');";
        js += "  a.href = URL.createObjectURL(blob);";
        js += "  a.download = 'reading-heatmap.html';";
        js += "  a.click();";
        js += "  showToast('HTML saved!');";
        js += "};";

        return js;
    },

    // ───────────────── Assemble full HTML page ─────────────────

    /**
     * Build the complete heatmap HTML page.
     *
     * @param {Object} counts - Date count map
     * @param {number} streak - Current streak
     * @return {string} Full HTML string
     */
    buildHTML: function(counts, streak) {
        var svgData = this.buildSVG(counts, "dark");
        var COLORS_DARK = this._getColors("dark");
        var COLORS_LIGHT = this._getColors("light");

        var totalPapers = 0;
        var activeDays = 0;
        var maxInDay = 0;
        for (var k in counts) {
            if (counts.hasOwnProperty(k)) {
                totalPapers += counts[k];
                activeDays++;
                if (counts[k] > maxInDay) {
                    maxInDay = counts[k];
                }
            }
        }

        var darkSvgStr = this.buildFullSVGString(
            counts, "dark", streak
        );
        var lightSvgStr = this.buildFullSVGString(
            counts, "light", streak
        );

        var html = "";
        html += "<!DOCTYPE html>";
        html += "<html><head><meta charset='utf-8'>";
        html += "<title>Reading Heatmap</title>";
        html += "<style>";
        html += this._buildCSS();
        html += "</style></head><body>";

        // Theme toggle
        html += "<button class='theme-toggle'";
        html += " id='themeBtn'";
        html += " title='Toggle light/dark mode'>";
        html += "\uD83C\uDF19</button>";

        // Header
        html += "<h1>\uD83D\uDCDA Reading Heatmap</h1>";
        html += "<div class='sub'>Your paper reading";
        html += " activity over the past year</div>";

        // Stats
        html += "<div class='stats'>";
        html += "<div class='stat'><div class='sv'>";
        html += totalPapers;
        html += "</div><div class='sl'>";
        html += "Papers read</div></div>";
        html += "<div class='stat'><div class='sv'>";
        html += activeDays;
        html += "</div><div class='sl'>";
        html += "Active days</div></div>";
        html += "<div class='stat'><div class='sv'>";
        html += maxInDay;
        html += "</div><div class='sl'>";
        html += "Best day</div></div>";
        html += "<div class='stat'><div class='sv fire'>";
        html += "\uD83D\uDD25 " + streak;
        html += "</div><div class='sl'>";
        html += "Day streak</div></div>";
        html += "</div>";

        // Heatmap SVG
        html += "<div class='wrap'>";
        html += '<svg id="heatsvg"';
        html += ' width="' + svgData.width + '"';
        html += ' height="' + svgData.height + '"';
        html += ' xmlns="http://www.w3.org/2000/svg">';
        html += svgData.svg;
        html += "</svg></div>";

        // Legend
        html += "<div class='leg' id='legend'>Less ";
        for (var c = 0; c < COLORS_DARK.length; c++) {
            html += '<svg width="12" height="12">';
            html += '<rect class="leg-swatch"';
            html += ' width="12" height="12" rx="2"';
            html += ' fill="' + COLORS_DARK[c]
                + '"/></svg>';
        }
        html += " More</div>";

        // Hidden export data
        html += "<div id='svgDark' style='display:none'>";
        html += darkSvgStr
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;");
        html += "</div>";
        html += "<div id='svgLight' style='display:none'>";
        html += lightSvgStr
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;");
        html += "</div>";

        html += "<canvas id='cvs'";
        html += " style='display:none'></canvas>";

        // Tooltip
        html += "<div class='tip' id='tip'>";
        html += "<div class='tip-count'";
        html += " id='tipCount'></div>";
        html += "<div class='tip-label'";
        html += " id='tipLabel'></div>";
        html += "<div class='tip-date'";
        html += " id='tipDate'></div>";
        html += "</div>";

        // Buttons
        html += "<div class='actions'>";
        html += "<button class='btn' id='btnCopy'>";
        html += "\uD83D\uDCCB Copy SVG</button>";
        html += "<button class='btn' id='btnSave'>";
        html += "\uD83D\uDCBE Save SVG File</button>";
        html += "<button class='btn' id='btnPng'>";
        html += "\uD83D\uDDBC Save PNG</button>";
        html += "<button class='btn btn-primary'";
        html += " id='btnShare'>";
        html += "\uD83D\uDCE4 Save Shareable HTML";
        html += "</button>";
        html += "</div>";

        html += "<div class='toast' id='toast'>";
        html += "Copied!</div>";

        // Script
        html += "<script>";
        html += this._buildScript(
            COLORS_DARK, COLORS_LIGHT
        );
        html += "<\/script>";
        html += "</body></html>";

        return html;
    }
};