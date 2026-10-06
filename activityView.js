/* global CustomEvent */
(function (global) {
    "use strict";

    var root;
    var snapshot;
    var handlers = {};
    var state = { year: null, collection: "all", type: "all", month: null, date: null };
    var viewMemory = { scrollTop: 0, open: {}, collectionPickerOpen: false, collectionBranches: {} };
    var labels = { all: "All", read: "Reading", note: "Notes", save: "Saved" };
    var colors = { read: "#2da44e", note: "#8250df", save: "#0969da" };
    var icons = { read: "▤", note: "✎", save: "＋" };
    var typeNames = { read: "Reading activity", note: "Notes and annotations", save: "Saved items" };
    var activityNames = { all: "activity", read: "reading activity", note: "note activity", save: "saved activity" };
    var months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    var shortMonths = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    var demoMode = !!(global.location && /(?:^|[?&])demo(?:=1|&|$)/.test(global.location.search));

    function node(name, attrs, text) {
        var el = document.createElement(name);
        attrs = attrs || {};
        Object.keys(attrs).forEach(function (key) {
            if (attrs[key] !== undefined && attrs[key] !== null) {
                if (key === "class") el.className = attrs[key];
                else if (key === "selected" || key === "open" || key === "disabled") {
                    if (attrs[key]) el[key] = true;
                }
                else if (key === "hidden") el.hidden = attrs[key];
                else if (key.indexOf("on") === 0) el.addEventListener(key.slice(2), attrs[key]);
                else el.setAttribute(key, String(attrs[key]));
            }
        });
        if (text !== undefined) el.textContent = text;
        return el;
    }

    function svgNode(name, attrs, text) {
        var el = document.createElementNS("http://www.w3.org/2000/svg", name);
        Object.keys(attrs || {}).forEach(function (key) { el.setAttribute(key, String(attrs[key])); });
        if (text !== undefined) el.textContent = text;
        return el;
    }

    function validDate(value) { return /^\d{4}-\d{2}-\d{2}$/.test(value || ""); }
    function monthName(month) { return months[Number(month) - 1] || ""; }
    function shortDate(value) { return validDate(value) ? shortMonths[Number(value.slice(5, 7)) - 1] + " " + Number(value.slice(8, 10)) : value; }
    function longDate(value) { return validDate(value) ? shortDate(value) + ", " + value.slice(0, 4) : value; }
    function countLabel(count, singular) { return Number(count).toLocaleString() + " " + (Number(count) === 1 ? singular : singular.endsWith("activity") ? singular.replace(/activity$/, "activities") : singular + "s"); }
    function dateOf(value) { return validDate(value) ? new Date(value + "T12:00:00") : null; }
    function number(value) { return typeof value === "number" && isFinite(value) ? value : 0; }
    function copy(value) { return JSON.parse(JSON.stringify(value)); }
    function clear(el) { while (el.firstChild) el.removeChild(el.firstChild); }
    function request(action, key) {
        var detail = { action: action, key: key || null, state: copy(state) };
        if (root) root.dispatchEvent(new CustomEvent("activity-action", { bubbles: true, detail: detail }));
        if (handlers.onAction) Promise.resolve(handlers.onAction(action, key || null)).catch(function () {});
    }
    function persist() {
        var next = copy(state);
        if (root) root.dispatchEvent(new CustomEvent("activity-action", { bubbles: true, detail: { action: "state", key: null, state: next } }));
        if (handlers.onState) Promise.resolve(handlers.onState(next)).catch(function () {});
    }
    function safeState(next) {
        var accepted = {};
        if (!next || typeof next !== "object") return accepted;
        if (Number.isInteger(next.year) && next.year >= 1900 && next.year <= 9999) accepted.year = next.year;
        if (typeof next.collection === "string" && next.collection.length <= 256) accepted.collection = next.collection;
        if (labels[next.type]) accepted.type = next.type;
        if (next.month === null || (Number.isInteger(next.month) && next.month >= 1 && next.month <= 12)) accepted.month = next.month;
        if (next.date === null || validDate(next.date)) accepted.date = next.date;
        return accepted;
    }
    function rememberView() {
        viewMemory.scrollTop = document.scrollingElement ? document.scrollingElement.scrollTop : 0;
        if (!root) return;
        viewMemory.open = {};
        Array.prototype.forEach.call(root.querySelectorAll("details[data-type]"), function (details) {
            viewMemory.open[details.getAttribute("data-type")] = details.open;
        });
        var picker = root.querySelector("details[data-collection-picker]");
        if (picker && !viewMemory.forceCollectionPickerClosed) viewMemory.collectionPickerOpen = picker.open;
        viewMemory.collectionBranches = {};
        Array.prototype.forEach.call(root.querySelectorAll("details[data-collection-branch]"), function (details) {
            viewMemory.collectionBranches[details.getAttribute("data-collection-branch")] = details.open;
        });
    }
    function set(next, save) {
        rememberView();
        state = Object.assign({}, state, safeState(next));
        if (snapshot) normalizeState();
        renderCurrent();
        if (document.scrollingElement) document.scrollingElement.scrollTop = viewMemory.scrollTop;
        if (snapshot && save !== false) persist();
    }
    function records() { return Array.isArray(snapshot && snapshot.records) ? snapshot.records.filter(function (r) { return r && validDate(r.date) && labels[r.type] && r.type !== "all"; }) : []; }
    function items() { return Array.isArray(snapshot && snapshot.items) ? snapshot.items.filter(function (i) { return i && i.key; }) : []; }
    function collections() { return Array.isArray(snapshot && snapshot.collections) ? snapshot.collections.filter(function (c) { return c && c.key; }) : []; }
    function today() { return validDate(snapshot && snapshot.today) ? snapshot.today : new Date().toISOString().slice(0, 10); }
    function years() {
        var found = {};
        records().forEach(function (r) { found[r.date.slice(0, 4)] = true; });
        items().forEach(function (i) { if (validDate(i.completedDate)) found[i.completedDate.slice(0, 4)] = true; });
        found[today().slice(0, 4)] = true;
        return Object.keys(found).map(Number).sort(function (a, b) { return b - a; });
    }
    function descendants(key) {
        if (key === "all") return null;
        var wanted = {};
        wanted[key] = true;
        var changed = true;
        while (changed) {
            changed = false;
            collections().forEach(function (c) {
                if (wanted[c.parentKey] && !wanted[c.key]) { wanted[c.key] = true; changed = true; }
            });
        }
        return wanted;
    }
    function collectionTree() {
        var byKey = {}, roots = [], children = {};
        collections().forEach(function (collection) { byKey[collection.key] = collection; children[collection.key] = []; });
        Object.keys(byKey).forEach(function (key) {
            var collection = byKey[key], parent = byKey[collection.parentKey], cursor = collection.parentKey, seen = {};
            while (cursor && byKey[cursor] && !seen[cursor]) { seen[cursor] = true; cursor = byKey[cursor].parentKey; }
            if (parent && !seen[key]) children[collection.parentKey].push(collection);
            else roots.push(collection);
        });
        function sort(items) { return items.sort(function (a, b) { return String(a.name || a.key).localeCompare(String(b.name || b.key)); }); }
        Object.keys(children).forEach(function (key) { sort(children[key]); });
        return { roots: sort(roots), children: children, byKey: byKey };
    }
    function collectionPath(key) {
        if (key === "all") return "All collections";
        var tree = collectionTree(), path = [], seen = {}, current = tree.byKey[key];
        while (current && !seen[current.key]) { path.unshift(current.name || current.key); seen[current.key] = true; current = tree.byKey[current.parentKey]; }
        return path.length ? path.join(" / ") : "All collections";
    }
    function collectionAncestors(key) {
        var tree = collectionTree(), result = {}, seen = {}, current = tree.byKey[key];
        while (current && !seen[current.key]) { result[current.key] = true; seen[current.key] = true; current = tree.byKey[current.parentKey]; }
        return result;
    }
    function itemMap() {
        var map = {};
        items().forEach(function (item) { map[item.key] = item; });
        return map;
    }
    function belongs(record, wanted, map) {
        if (!wanted) return true;
        var item = map[record.parentKey] || map[record.key];
        return !!(item && Array.isArray(item.collections) && item.collections.some(function (key) { return wanted[key]; }));
    }
    function filtered(options) {
        options = options || {};
        var map = itemMap();
        var wanted = descendants(options.collection === undefined ? state.collection : options.collection);
        var targetYear = String(options.year === undefined ? state.year : options.year);
        var type = options.type === undefined ? state.type : options.type;
        var date = options.date === undefined ? state.date : options.date;
        var month = options.month === undefined ? state.month : options.month;
        return records().filter(function (record) {
            if (record.date.slice(0, 4) !== targetYear || !belongs(record, wanted, map)) return false;
            if (type !== "all" && record.type !== type) return false;
            if (date && record.date !== date) return false;
            if (!date && month && Number(record.date.slice(5, 7)) !== Number(month)) return false;
            return true;
        });
    }
    function normalizeState() {
        var availableYears = years();
        if (!availableYears.length) availableYears = [Number(today().slice(0, 4))];
        var currentYear = Number(today().slice(0, 4));
        if (availableYears.indexOf(Number(state.year)) < 0) state.year = currentYear;
        if (state.collection !== "all" && !collections().some(function (c) { return c.key === state.collection; })) state.collection = "all";
        if (!labels[state.type]) state.type = "all";
        if (state.date && (!validDate(state.date) || Number(state.date.slice(0, 4)) !== Number(state.year))) state.date = null;
        var availableMonths = filtered({ type: "all", date: null, month: null }).map(function (r) { return Number(r.date.slice(5, 7)); });
        var latest = availableMonths.length ? Math.max.apply(null, availableMonths) : (Number(state.year) === Number(today().slice(0, 4)) ? Number(today().slice(5, 7)) : 12);
        if (state.date) state.month = Number(state.date.slice(5, 7));
        else if (availableMonths.indexOf(Number(state.month)) < 0) state.month = latest;
    }
    function activityCounts(rows) {
        var counts = { read: 0, note: 0, save: 0 };
        rows.forEach(function (row) { counts[row.type] += 1; });
        return counts;
    }
    function ratioCounts(counts) {
        var total = counts.read + counts.note + counts.save;
        var order = ["read", "note", "save"];
        var raw = {}, result = {}, assigned = 0;
        if (!total) return { read: 0, note: 0, save: 0 };
        order.forEach(function (type) { raw[type] = total ? counts[type] * 100 / total : 0; result[type] = Math.floor(raw[type]); assigned += result[type]; });
        order.slice().sort(function (a, b) { return (raw[b] - result[b]) - (raw[a] - result[a]); }).slice(0, 100 - assigned).forEach(function (type) { result[type] += 1; });
        return result;
    }
    function appendButton(parent, text, attrs, onClick) {
        var button = node("button", Object.assign({ type: "button" }, attrs || {}), text);
        if (onClick) button.addEventListener("click", onClick);
        parent.appendChild(button);
        return button;
    }
    function buildHeader(page) {
        var heading = node("header", { class: "ra-heading" });
        var copyBlock = node("div");
        copyBlock.appendChild(node("h1", {}, "My research activity"));
        if (demoMode) copyBlock.appendChild(node("span", { style: "display:inline-block;margin:0 0 7px 8px;padding:2px 7px;border:1px solid #d4a72c;border-radius:12px;background:#fff8c5;color:#633c01;font-size:11px;font-weight:600" }, "Demo data"));
        copyBlock.appendChild(node("p", {}, "A record of what you read, note, and save."));
        heading.appendChild(copyBlock);
        heading.appendChild(node("span", { class: "ra-small" }, "Through " + longDate(today())));
        page.appendChild(heading);
    }
    function buildWarnings(page) {
        var warnings = Array.isArray(snapshot && snapshot.warnings) ? snapshot.warnings.filter(function (warning) { return typeof warning === "string" && warning.trim(); }) : [];
        if (!warnings.length) return;
        var box = node("aside", { role: "status", style: "margin:0 0 18px;padding:10px 12px;border:1px solid #d4a72c;border-radius:6px;background:#fff8c5;color:#633c01;font-size:12px;line-height:1.5" });
        box.appendChild(node("strong", {}, "Activity record notice · "));
        box.appendChild(document.createTextNode(warnings.join(" ")));
        page.appendChild(box);
    }
    function buildControls(main) {
        var top = node("div", { class: "ra-topline" });
        var total = filtered({ type: state.type, date: null, month: null }).length;
        top.appendChild(node("h2", {}, state.year + " · " + countLabel(total, activityNames[state.type])));
        var filters = node("div", { class: "ra-filters", "aria-label": "Activity type" });
        ["all", "read", "note", "save"].forEach(function (type) {
            appendButton(filters, labels[type], { "aria-pressed": state.type === type }, function () { set({ type: type }); });
        });
        top.appendChild(filters);
        main.appendChild(top);
    }
    function buildHeatmap(panel) {
        var heat = node("section", { class: "ra-heatmap" });
        var calendar = node("div", { class: "ra-calendar" });
        var allRows = filtered({ date: null, month: null });
        var byDate = {};
        allRows.forEach(function (record) { byDate[record.date] = (byDate[record.date] || 0) + 1; });
        var year = Number(state.year);
        var start = new Date(year, 0, 1, 12);
        var end = new Date(year, 11, 31, 12);
        var svg = svgNode("svg", { viewBox: "0 0 920 151", role: "img", "aria-label": year + " activity calendar" });
        var offset = start.getDay();
        var lastMonth = -1;
        for (var cursor = new Date(start); cursor <= end; cursor.setDate(cursor.getDate() + 1)) {
            var day = Math.round((cursor - start) / 86400000);
            var week = Math.floor((day + offset) / 7);
            var date = cursor.getFullYear() + "-" + String(cursor.getMonth() + 1).padStart(2, "0") + "-" + String(cursor.getDate()).padStart(2, "0");
            var x = 35 + week * 16.5;
            var y = 26 + cursor.getDay() * 17;
            if (cursor.getMonth() !== lastMonth) {
                svg.appendChild(svgNode("text", { x: x, y: 13, fill: "#57606a", "font-size": 11 }, shortMonths[cursor.getMonth()]));
                lastMonth = cursor.getMonth();
            }
            var future = date > today();
            var value = byDate[date] || 0;
            var fill = value === 0 ? "#ebedf0" : value < 3 ? "#9be9a8" : value < 6 ? "#40c463" : value < 10 ? "#30a14e" : "#216e39";
            var rect = svgNode("rect", { class: "ra-calendar-cell", x: x, y: y, width: 12.5, height: 12.5, rx: 2, fill: fill, tabindex: future ? -1 : 0, role: "button", "aria-label": longDate(date) + ": " + countLabel(value, "activity"), "data-date": date, "data-selected": state.date === date, "data-future": future });
            if (!future) {
                rect.addEventListener("click", function (event) { set({ date: event.currentTarget.getAttribute("data-date") }); });
                rect.addEventListener("keydown", function (event) { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); event.currentTarget.click(); } });
                rect.addEventListener("pointerover", showTooltip);
                rect.addEventListener("pointerout", hideTooltip);
            }
            svg.appendChild(rect);
        }
        [["Mon", 1], ["Wed", 3], ["Fri", 5]].forEach(function (label) { svg.appendChild(svgNode("text", { x: 4, y: 36 + label[1] * 17, fill: "#57606a", "font-size": 10 }, label[0])); });
        calendar.appendChild(svg);
        heat.appendChild(calendar);
        var legend = node("div", { class: "ra-legend-row" });
        appendButton(legend, "How is activity counted?", { class: "ra-link" }, showRules);
        var swatches = node("div", { class: "ra-legend" }, "Less ");
        ["var(--ra-green-0)", "var(--ra-green-1)", "var(--ra-green-2)", "var(--ra-green-3)", "var(--ra-green-4)"].forEach(function (color) { swatches.appendChild(node("i", { class: "ra-swatch", style: "background:" + color })); });
        swatches.appendChild(document.createTextNode(" More"));
        legend.appendChild(swatches);
        heat.appendChild(legend);
        panel.appendChild(heat);
    }
    function buildOverview(panel) {
        var overview = node("section", { class: "ra-overview" });
        overview.appendChild(buildCollectionPicker());
        var summary = node("div", { class: "ra-summary" });
        var left = node("div", { class: "ra-summary-left" });
        left.appendChild(node("h3", {}, "Activity overview"));
        var annual = filtered({ type: "all", date: null, month: null });
        var counts = activityCounts(annual);
        var stats = node("div", { class: "ra-stats" });
        ["read", "note", "save"].forEach(function (type) { var stat = node("div", { class: "ra-stat" }); stat.appendChild(node("b", {}, counts[type].toLocaleString())); stat.appendChild(node("span", {}, typeNames[type])); stats.appendChild(stat); });
        left.appendChild(stats);
        var map = itemMap();
        var wanted = descendants(state.collection);
        var annualReadSeconds = (Array.isArray(snapshot.reading) ? snapshot.reading : []).filter(function (entry) { return entry && validDate(entry.date) && entry.date.slice(0, 4) === String(state.year) && belongs({ key: entry.key, parentKey: entry.key }, wanted, map); }).reduce(function (sum, entry) { return sum + number(entry.seconds); }, 0);
        var completed = items().filter(function (item) { return validDate(item.completedDate) && item.completedDate.slice(0, 4) === String(state.year) && belongs({ key: item.key, parentKey: item.key }, wanted, map); }).length;
        var completion = node("div", { class: "ra-completion" });
        [[formatTime(annualReadSeconds), "Reading time"], [completed.toLocaleString() + (completed === 1 ? " paper" : " papers"), "Completed papers"]].forEach(function (part) { var block = node("div"); block.appendChild(node("b", {}, part[0])); block.appendChild(node("span", { class: "ra-small" }, part[1])); completion.appendChild(block); });
        left.appendChild(completion);
        left.appendChild(node("p", { class: "ra-ratio-copy" }, "Saved items and notes include records restored from creation dates. Import or sync timing can differ from the actual work date; reading time is an estimate measured on this device."));
        summary.appendChild(left);
        var ratio = node("div");
        ratio.appendChild(node("h3", {}, "Activity mix"));
        ratio.appendChild(node("p", { class: "ra-ratio-copy" }, "All activities in the selected year"));
        ratio.appendChild(buildTriangle(counts));
        summary.appendChild(ratio);
        overview.appendChild(summary);
        panel.appendChild(overview);
    }
    function chooseCollection(key) {
        viewMemory.collectionPickerOpen = false;
        viewMemory.forceCollectionPickerClosed = true;
        set({ collection: key, date: null });
        viewMemory.forceCollectionPickerClosed = false;
    }
    function buildCollectionPicker() {
        var picker = node("details", { class: "ra-collection-picker", open: viewMemory.collectionPickerOpen, "data-collection-picker": "true" });
        picker.appendChild(node("summary", {}, "Collection: " + collectionPath(state.collection)));
        var choices = node("div", { class: "ra-collection-choices", "aria-label": "Collection picker" });
        appendButton(choices, "All collections", { class: "ra-collection-select", "aria-pressed": state.collection === "all" }, function () { chooseCollection("all"); });
        var tree = collectionTree(), ancestors = collectionAncestors(state.collection);
        function appendBranch(container, collection) {
            var childItems = tree.children[collection.key] || [];
            if (!childItems.length) {
                appendButton(container, collection.name || collection.key, { class: "ra-collection-select", "aria-pressed": state.collection === collection.key }, function () { chooseCollection(collection.key); });
                return;
            }
            var open = ancestors[collection.key] || viewMemory.collectionBranches[collection.key];
            var details = node("details", { class: "ra-collection-branch", open: !!open, "data-collection-branch": collection.key });
            details.appendChild(node("summary", {}, collection.name || collection.key));
            var content = node("div", { class: "ra-collection-branch-content" });
            appendButton(content, "Select " + (collection.name || collection.key), { class: "ra-collection-select", "aria-pressed": state.collection === collection.key }, function () { chooseCollection(collection.key); });
            childItems.forEach(function (child) { appendBranch(content, child); });
            details.appendChild(content); container.appendChild(details);
        }
        tree.roots.forEach(function (collection) { appendBranch(choices, collection); });
        picker.appendChild(choices);
        return picker;
    }
    function buildTriangle(counts) {
        var ratios = ratioCounts(counts);
        var total = counts.read + counts.note + counts.save;
        var wrap = node("div", { class: "ra-triangle-wrap" });
        var svg = svgNode("svg", { class: "ra-triangle", viewBox: "0 0 250 220", role: "img", "aria-label": "Reading, notes, and saved-item activity mix" });
        var center = { x: 125, y: 125 };
        var points = { read: { x: 125, y: 24 }, note: { x: 31, y: 184 }, save: { x: 219, y: 184 } };
        svg.appendChild(svgNode("polygon", { points: "125,24 31,184 219,184", fill: "none", stroke: "#d0d7de", "stroke-width": 1.5 }));
        Object.keys(points).forEach(function (type) { svg.appendChild(svgNode("line", { x1: center.x, y1: center.y, x2: points[type].x, y2: points[type].y, stroke: "#d0d7de", "stroke-width": 1 })); });
        if (total) {
            var activePoints = ["read", "note", "save"].map(function (type) { var p = ratios[type] / 100; return (center.x + (points[type].x - center.x) * p).toFixed(1) + "," + (center.y + (points[type].y - center.y) * p).toFixed(1); });
            svg.appendChild(svgNode("polygon", { points: activePoints.join(" "), fill: "#40c46355", stroke: "#2da44e", "stroke-width": 2 }));
            ["read", "note", "save"].forEach(function (type, index) { var coords = activePoints[index].split(","); svg.appendChild(svgNode("circle", { cx: coords[0], cy: coords[1], r: 3.5, fill: colors[type] })); });
        }
        svg.appendChild(svgNode("text", { x: 125, y: 13, "text-anchor": "middle" }, "Reading " + counts.read + " · " + ratios.read + "%"));
        svg.appendChild(svgNode("text", { x: 13, y: 204, "text-anchor": "start" }, "Notes " + counts.note + " · " + ratios.note + "%"));
        svg.appendChild(svgNode("text", { x: 237, y: 204, "text-anchor": "end" }, "Saved " + counts.save + " · " + ratios.save + "%"));
        wrap.appendChild(svg);
        var list = node("div", { class: "ra-ratio-list" });
        if (!total) list.appendChild(node("span", { class: "ra-small" }, "No recorded activity"));
        ["read", "note", "save"].forEach(function (type) { var row = node("div", { class: "ra-ratio-item" }); var name = node("span"); name.appendChild(node("i", { style: "background:" + colors[type] })); name.appendChild(document.createTextNode(labels[type])); row.appendChild(name); row.appendChild(node("span", {}, counts[type] + " · " + ratios[type] + "%")); list.appendChild(row); });
        wrap.appendChild(list);
        return wrap;
    }
    function buildTimeline(main) {
        var section = node("section", { class: "ra-timeline" });
        var head = node("div", { class: "ra-timeline-head" });
        head.appendChild(node("h2", {}, state.date ? "Activity on " + shortDate(state.date) : "Activity history"));
        var controls = node("div");
        if (state.date) appendButton(controls, "Clear date", { class: "ra-button" }, function () { set({ date: null }); });
        var select = node("select", { "aria-label": "Activity month" });
        var months = [];
        filtered({ type: "all", date: null, month: null }).forEach(function (record) { var value = Number(record.date.slice(5, 7)); if (months.indexOf(value) < 0) months.push(value); });
        if (!months.length) months = [state.month];
        months.sort(function (a, b) { return b - a; }).forEach(function (month) { select.appendChild(node("option", { value: month, selected: !state.date && Number(state.month) === month }, monthName(month))); });
        select.addEventListener("change", function () { set({ month: Number(select.value), date: null }); });
        controls.appendChild(select); head.appendChild(controls); section.appendChild(head);
        section.appendChild(buildEvents()); main.appendChild(section);
    }
    function buildEvents() {
        var content = node("div");
        var rows = filtered();
        content.appendChild(node("div", { class: "ra-month" }, state.date ? shortDate(state.date) : monthName(state.month) + " " + state.year));
        if (!rows.length) { content.appendChild(node("div", { class: "ra-empty" }, "There is no activity in this period.")); return content; }
        ["read", "note", "save"].forEach(function (type) {
            var group = rows.filter(function (record) { return record.type === type; });
            if (!group.length) return;
            var event = node("div", { class: "ra-event" });
            event.appendChild(node("span", { class: "ra-event-icon", "aria-hidden": "true" }, icons[type]));
            var details = node("details", { open: viewMemory.open[type] === undefined ? true : viewMemory.open[type], "data-type": type });
            details.appendChild(node("summary", {}, typeNames[type] + " · " + group.length));
            var list = node("div", { class: "ra-activity-list" });
            group.sort(function (a, b) { return b.date.localeCompare(a.date); }).forEach(function (record) {
                var line = node("div", { class: "ra-activity" });
                var title = record.title || (itemMap()[record.parentKey] || itemMap()[record.key] || {}).title || "Untitled item";
                appendButton(line, title, { class: "ra-activity-title", title: title }, function () { request("select", record.parentKey || record.key); });
                if (record.subtype === "annotation") appendButton(line, "View annotation", { class: "ra-action" }, function () { request("annotation", record.key); });
                else if (type === "read") appendButton(line, "Open document", { class: "ra-action" }, function () { request("open", record.parentKey || record.key); });
                else line.appendChild(node("span"));
                var metadata = node("span", { class: "ra-date" });
                metadata.appendChild(node("time", { datetime: record.date }, shortDate(record.date)));
                metadata.appendChild(document.createTextNode(" · " + (record.source === "restored" ? "restored" : "observed")));
                line.appendChild(metadata);
                list.appendChild(line);
            });
            details.appendChild(list); event.appendChild(details); content.appendChild(event);
        });
        return content;
    }
    function buildYears(yearBox) {
        years().forEach(function (year) { appendButton(yearBox, String(year), { "aria-pressed": Number(state.year) === year }, function () { set({ year: year, date: null, month: null }); }); });
    }
    function renderCurrent() {
        if (!root || !snapshot) return;
        rememberView();
        clear(root);
        var page = node("div", { class: "ra-page" });
        buildHeader(page);
        buildWarnings(page);
        var layout = node("div", { class: "ra-layout" });
        var main = node("div");
        buildControls(main);
        var panel = node("section", { class: "ra-panel" });
        buildHeatmap(panel); buildOverview(panel); main.appendChild(panel); buildTimeline(main);
        layout.appendChild(main);
        var yearBox = node("aside", { class: "ra-years", "aria-label": "Year selection" }); buildYears(yearBox); layout.appendChild(yearBox);
        page.appendChild(layout); root.appendChild(page); ensureOverlay();
        if (document.scrollingElement) document.scrollingElement.scrollTop = viewMemory.scrollTop;
    }
    function formatTime(seconds) { var minutes = Math.round(number(seconds) / 60); return minutes >= 60 ? Math.floor(minutes / 60) + "h " + (minutes % 60) + "m" : minutes + "m"; }
    function ensureOverlay() {
        if (!document.getElementById("ra-tooltip")) document.body.appendChild(node("div", { id: "ra-tooltip", class: "ra-tooltip", role: "tooltip" }));
    }
    function showTooltip(event) { var cell = event.currentTarget; var tip = document.getElementById("ra-tooltip"); if (!tip) return; tip.textContent = cell.getAttribute("aria-label"); tip.style.display = "block"; tip.style.left = Math.min(event.clientX + 12, window.innerWidth - 180) + "px"; tip.style.top = event.clientY - 37 + "px"; }
    function hideTooltip() { var tip = document.getElementById("ra-tooltip"); if (tip) tip.style.display = "none"; }
    function showRules() {
        var dialog = document.getElementById("ra-rules-dialog");
        if (!dialog) {
            dialog = node("dialog", { id: "ra-rules-dialog", class: "ra-dialog" });
            dialog.appendChild(node("h3", {}, "How activity is counted"));
            dialog.appendChild(node("p", {}, "Each new library item counts once when saved, and each new note or annotation counts once. Reading time is credited only in the active PDF Reader for up to 120 seconds after input; a document counts as read after at least 60 seconds on a day. Completed status is shown separately from reading activity. Records restored from creation dates can differ from the actual work date because of import or sync timing."));
            appendButton(dialog, "Close", { class: "ra-button" }, function () { dialog.close(); }); document.body.appendChild(dialog);
        }
        dialog.showModal();
    }
    function mount(options) {
        options = options || {}; handlers = options; root = options.root || document.getElementById("research-activity");
        if (!root) throw new Error("ResearchActivityView mount target not found");
        if (!options.getSnapshot) { error("Activity data is unavailable."); return; }
        Promise.resolve(options.getSnapshot()).then(function (next) { render(next); }).catch(function () { error("Could not load activity data."); });
    }
    function validSnapshot(next) {
        return !!(next && typeof next === "object" && Array.isArray(next.records)
            && Array.isArray(next.collections) && Array.isArray(next.items)
            && Array.isArray(next.reading) && validDate(next.today));
    }
    function render(next) {
        if (!root) root = document.getElementById("research-activity");
        if (!root) throw new Error("ResearchActivityView mount target not found");
        if (!validSnapshot(next)) { error("Activity data has an invalid format."); return; }
        snapshot = next; normalizeState(); renderCurrent();
    }
    function error(message) {
        if (!root) root = document.getElementById("research-activity");
        if (!root) return;
        clear(root); var page = node("div", { class: "ra-page" }); var block = node("div", { class: "ra-error" }, message || "Could not load activity data."); appendButton(block, "Try again", { class: "ra-button" }, function () { request("retry"); if (handlers.getSnapshot) mount(handlers); }); page.appendChild(block); root.appendChild(page);
    }
    global.ResearchActivityView = { mount: mount, render: render, error: error, getState: function () { return copy(state); }, setState: function (next) { set(next, false); } };
    function demoSnapshot() {
        var now = new Date();
        var year = now.getFullYear();
        var todayValue = localISO(now);
        var first = new Date(year, 0, 1, 12);
        var days = [];
        var cursor;
        var paperTitles = ["A Practical Guide to Generative Models", "Reliable Evaluation for Clinical AI", "Representation Learning in Medical Imaging", "Efficient Methods for Scientific Machine Learning", "Interpretable Models for Biomedical Data", "Foundations of Probabilistic Deep Learning", "Robust Validation for Machine Learning Systems", "Multimodal Learning for Health Research", "A Survey of Agentic AI Systems", "Statistical Perspectives on Model Calibration"];
        var collectionKeys = ["diffusion", "flow", "imaging", "agents", "evaluation"];
        var collectionsDemo = [
            { key: "models", name: "Generative Models" }, { key: "diffusion", name: "Diffusion", parentKey: "models" }, { key: "flow", name: "Flow Models", parentKey: "models" },
            { key: "medical", name: "Medical AI" }, { key: "imaging", name: "Imaging", parentKey: "medical" }, { key: "agents", name: "Clinical Agents", parentKey: "medical" },
            { key: "methods", name: "Research Methods" }, { key: "evaluation", name: "Evaluation", parentKey: "methods" }
        ];
        var itemsDemo = [], recordsDemo = [], readingDemo = [];
        for (cursor = new Date(first); localISO(cursor) <= todayValue; cursor.setDate(cursor.getDate() + 1)) days.push(localISO(cursor));
        for (var itemIndex = 0; itemIndex < 50; itemIndex++) {
            var key = "1/DM" + String(itemIndex + 1).padStart(6, "0");
            itemsDemo.push({ key: key, title: paperTitles[itemIndex % paperTitles.length] + " " + (Math.floor(itemIndex / paperTitles.length) + 1), collections: [collectionKeys[itemIndex % collectionKeys.length]], completedDate: itemIndex % 4 === 0 ? days[Math.min(days.length - 1, itemIndex * 3 + 7)] : null });
        }
        for (var activityIndex = 0; activityIndex < 150; activityIndex++) {
            var date = days[Math.min(days.length - 1, Math.floor((activityIndex + 1) * days.length / 151))];
            var type = ["read", "note", "save"][activityIndex % 3];
            var item = itemsDemo[type === "save" ? Math.floor(activityIndex / 3) : (activityIndex * 7) % itemsDemo.length];
            var record = { id: "demo-activity-" + String(activityIndex + 1).padStart(3, "0"), key: item.key, parentKey: item.key, type: type, date: date, title: item.title, source: type === "save" ? "restored" : "observed" };
            if (type === "note") { record.subtype = activityIndex % 2 ? "note" : "annotation"; if (record.subtype === "annotation") record.key = "1/AN" + String(activityIndex + 1).padStart(6, "0"); }
            if (type === "read") { record.seconds = 900 + (activityIndex % 5) * 420; readingDemo.push({ key: item.key, date: date, seconds: record.seconds }); }
            recordsDemo.push(record);
            if (activityIndex % 10 === 1) {
                recordsDemo.push({ id: "demo-followup-" + String(activityIndex).padStart(3, "0"), key: "1/NT" + String(activityIndex).padStart(6, "0"), parentKey: item.key, type: "note", subtype: "annotation", date: date, title: item.title, source: "observed" });
            }
        }
        return { today: todayValue, collections: collectionsDemo, items: itemsDemo, reading: readingDemo, records: recordsDemo };
    }
    function localISO(date) { return date.getFullYear() + "-" + String(date.getMonth() + 1).padStart(2, "0") + "-" + String(date.getDate()).padStart(2, "0"); }
    if (demoMode) {
        document.addEventListener("DOMContentLoaded", function () { mount({ getSnapshot: function () { return demoSnapshot(); } }); });
    }
}(window));
