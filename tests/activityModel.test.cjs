"use strict";

process.env.TZ = "America/New_York";

var assert = require("assert");
var model = require("../activityModel.js");

function stamp(year, month, day, hour, minute, second) {
    return new Date(year, month - 1, day, hour, minute || 0, second || 0).getTime();
}

function throws(fn, text) {
    assert.throws(fn, new RegExp(text));
}

(function testEmptyAndInvalidStores() {
    var store = model.emptyStore(stamp(2026, 1, 1, 12));
    assert.strictEqual(store.version, 1);
    assert.strictEqual(model.validateStore(store), true);
    throws(function () { model.validateStore({ version: 2, origins: {}, reading: {} }); }, "unsupported version");
    throws(function () { model.validateStore({ version: 1, createdAt: "bad", origins: {}, reading: {} }); }, "createdAt");
    throws(function () { model.validateStore({ version: 1, createdAt: "2026-01-01T00:00:00Z", origins: {}, reading: { A: { "2026-02-31": 1 } } }); }, "reading entry");
    throws(function () { model.addReading(store, "A", NaN, 1); }, "timestamp is invalid");
}());

(function testDateParsingIsLocalAndStrict() {
    assert.strictEqual(model.parseDateAdded("2026-01-01 01:30:00"), "2025-12-31");
    assert.strictEqual(model.parseDateAdded("2026-03-08T07:01:00.000Z"), "2026-03-08");
    throws(function () { model.parseDateAdded("2026-02-30 12:00:00"); }, "dateAdded is invalid");
    throws(function () { model.parseDateAdded("2026-02-31T12:00:00Z"); }, "dateAdded is invalid");
}());

(function testOriginKeepsFirstProvenance() {
    var store = model.emptyStore(0);
    assert.strictEqual(model.origin(store, "L1:A", false), "restored");
    assert.strictEqual(model.origin(store, "L1:A", true), "restored");
    assert.strictEqual(model.origin(store, "L1:B", true), "observed");
    assert.strictEqual(model.addOrigin(store, "L1:C", "observed"), "observed");
}());

(function testReadingSplitsAtLocalMidnightAndThresholds() {
    var store = model.emptyStore(0);
    var start = stamp(2026, 3, 7, 23, 59);
    var end = stamp(2026, 3, 8, 0, 1);
    model.addReading(store, "L1:A", start, end);
    model.addReading(store, "L1:A", stamp(2026, 3, 8, 0, 1), stamp(2026, 3, 8, 0, 2));
    assert.strictEqual(store.reading["L1:A"]["2026-03-07"], 60);
    assert.strictEqual(store.reading["L1:A"]["2026-03-08"], 120);
    model.origin(store, "L1:A", false);
    assert.deepStrictEqual(model.readingRecords(store, [{ key: "L1:A", title: "Paper" }]).map(function (r) {
        return [r.date, r.seconds, r.title];
    }), [["2026-03-07", 60, "Paper"], ["2026-03-08", 120, "Paper"]]);
    assert.strictEqual(model.readingRecords(store)[0].source, "observed", "auto-reading is always observed");
    model.addReading(store, "L1:B", stamp(2026, 3, 8, 1, 59), stamp(2026, 3, 8, 3, 1));
    assert.strictEqual(store.reading["L1:B"]["2026-03-08"], 120, "DST skip counts elapsed time, not wall-clock time");
    model.addReading(store, "L1:C", stamp(2026, 3, 8, 12), stamp(2026, 3, 8, 12, 0, 59));
    assert.strictEqual(model.readingRecords(store).some(function (r) { return r.key === "L1:C"; }), false);
}());

(function testCreditsOnlyContinuousActiveIntervals() {
    var now = 1000000;
    assert.deepStrictEqual(model.creditedInterval("L1:A", "L1:A", now - 1000, now - 2000, now), {
        key: "L1:A", startMs: now - 1000, endMs: now
    });
    assert.strictEqual(model.creditedInterval("L1:A", "L1:A", now - 1000, now - 10001, now), null, "sleep gap is excluded, never capped");
    assert.strictEqual(model.creditedInterval("L1:A", "L1:A", now - 120001, now - 1000, now), null, "idle time is excluded");
    assert.strictEqual(model.creditedInterval("L1:A", "L1:B", now, now - 1000, now), null, "tab change is excluded");
}());

console.log("activityModel tests passed");
