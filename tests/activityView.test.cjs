"use strict";

var assert = require("assert");
var fs = require("fs");
var path = require("path");
var vm = require("vm");
var source = fs.readFileSync(path.join(__dirname, "..", "activityView.js"), "utf8");

source = source.replace("global.ResearchActivityView =", "global.__activityTest = { ratioCounts: ratioCounts, safeState: safeState, countLabel: countLabel, tree: collectionTree, descendants: descendants, path: collectionPath, load: function (next) { snapshot = next; } }; global.ResearchActivityView =");
var context = { window: {}, document: {}, CustomEvent: function () {} };
vm.runInNewContext(source, context);
var test = context.window.__activityTest;

assert.deepStrictEqual(JSON.parse(JSON.stringify(test.ratioCounts({ read: 0, note: 0, save: 0 }))), { read: 0, note: 0, save: 0 });
assert.deepStrictEqual(JSON.parse(JSON.stringify(test.ratioCounts({ read: 1, note: 1, save: 1 }))), { read: 34, note: 33, save: 33 });
assert.deepStrictEqual(JSON.parse(JSON.stringify(test.ratioCounts({ read: 0, note: 0, save: 7 }))), { read: 0, note: 0, save: 100 });
assert.deepStrictEqual(JSON.parse(JSON.stringify(test.safeState({ year: 2026, collection: "models", type: "read", month: null, date: "2026-10-06" }))), { year: 2026, collection: "models", type: "read", month: null, date: "2026-10-06" });
assert.deepStrictEqual(JSON.parse(JSON.stringify(test.safeState({ year: 1800, collection: "x".repeat(257), type: "unknown", month: 13, date: "bad" }))), {});
assert.strictEqual(test.countLabel(1, "activity"), "1 activity");
assert.strictEqual(test.countLabel(2, "activity"), "2 activities");

test.load({
    records: [], items: [], reading: [], today: "2026-10-06",
    collections: [
        { key: "root", name: "Root" }, { key: "child", name: "Child", parentKey: "root" },
        { key: "grand", name: "Grand", parentKey: "child" }, { key: "orphan", name: "Orphan", parentKey: "missing" },
        { key: "cycle-a", name: "Cycle A", parentKey: "cycle-b" }, { key: "cycle-b", name: "Cycle B", parentKey: "cycle-a" }
    ]
});
assert.deepStrictEqual(Array.from(Object.keys(test.descendants("root")).sort()), ["child", "grand", "root"]);
assert.strictEqual(test.path("grand"), "Root / Child / Grand");
assert.strictEqual(test.path("orphan"), "Orphan");
assert.deepStrictEqual(Array.from(test.tree().roots.map(function (item) { return item.key; }).sort()), ["cycle-a", "cycle-b", "orphan", "root"]);
console.log("activityView tests passed");
