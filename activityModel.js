/* Pure activity storage helpers. Load before the Zotero collector/UI. */
var ResearchActivityModel = (function () {
    var VERSION = 1;
    var MAX_TICK_GAP_MS = 10000;
    var IDLE_MS = 120000;

    function fail(message) {
        throw new TypeError("Research activity store: " + message);
    }

    function requireKey(key) {
        if (typeof key !== "string" || !key) fail("item key is required");
    }

    function dateFrom(value) {
        var date;
        if (value instanceof Date) {
            date = new Date(value.getTime());
        } else if (typeof value === "number") {
            date = new Date(value);
        } else {
            fail("timestamp must be a Date or millisecond number");
        }
        if (!isFinite(date.getTime())) fail("timestamp is invalid");
        return date;
    }

    function two(value) {
        return String(value).padStart(2, "0");
    }

    function validCalendarDate(year, month, day) {
        var date = new Date(Date.UTC(year, month - 1, day));
        return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1
            && date.getUTCDate() === day;
    }

    function localDate(value) {
        var date = dateFrom(value);
        return date.getFullYear() + "-" + two(date.getMonth() + 1)
            + "-" + two(date.getDate());
    }

    function parseDateAdded(value) {
        var match;
        var date;
        if (value instanceof Date || typeof value === "number") return localDate(value);
        if (typeof value !== "string" || !value.trim()) {
            fail("dateAdded must be SQL UTC or ISO text");
        }
        value = value.trim();
        match = value.match(/^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?$/);
        if (match) {
            if (!validCalendarDate(Number(match[1]), Number(match[2]), Number(match[3]))) {
                fail("dateAdded is invalid");
            }
            date = new Date(Date.UTC(
                Number(match[1]), Number(match[2]) - 1, Number(match[3]),
                Number(match[4]), Number(match[5]), Number(match[6]),
                Number((match[7] || "0").padEnd(3, "0"))
            ));
            if (date.getUTCFullYear() !== Number(match[1])
                || date.getUTCMonth() !== Number(match[2]) - 1
                || date.getUTCDate() !== Number(match[3])
                || date.getUTCHours() !== Number(match[4])
                || date.getUTCMinutes() !== Number(match[5])
                || date.getUTCSeconds() !== Number(match[6])) {
                fail("dateAdded is invalid");
            }
            return localDate(date);
        }
        match = value.match(/^(\d{4})-(\d{2})-(\d{2})(?:T|$)/);
        if (match && !validCalendarDate(Number(match[1]), Number(match[2]), Number(match[3]))) {
            fail("dateAdded is invalid");
        }
        date = new Date(value);
        if (!isFinite(date.getTime())) fail("dateAdded is invalid");
        return localDate(date);
    }

    function emptyStore(now) {
        return {
            version: VERSION,
            createdAt: dateFrom(now === undefined ? Date.now() : now).toISOString(),
            origins: {},
            reading: {}
        };
    }

    function mutableStore(store) {
        if (!store || typeof store !== "object" || Array.isArray(store)
            || store.version !== VERSION || !store.origins || typeof store.origins !== "object"
            || Array.isArray(store.origins) || !store.reading || typeof store.reading !== "object"
            || Array.isArray(store.reading)) {
            fail("is not a mutable activity store");
        }
    }

    function validateStore(store) {
        var key;
        var day;
        if (!store || typeof store !== "object" || Array.isArray(store)) fail("must be an object");
        if (store.version !== VERSION) fail("unsupported version");
        if (typeof store.createdAt !== "string" || !isFinite(new Date(store.createdAt).getTime())) {
            fail("createdAt is missing or invalid");
        }
        if (!store.origins || typeof store.origins !== "object" || Array.isArray(store.origins)) fail("origins is missing");
        if (!store.reading || typeof store.reading !== "object" || Array.isArray(store.reading)) fail("reading is missing");
        for (key in store.origins) {
            if (!Object.prototype.hasOwnProperty.call(store.origins, key)) continue;
            requireKey(key);
            if (store.origins[key] !== "restored" && store.origins[key] !== "observed") {
                fail("origin must be restored or observed");
            }
        }
        for (key in store.reading) {
            if (!Object.prototype.hasOwnProperty.call(store.reading, key)) continue;
            requireKey(key);
            if (!store.reading[key] || typeof store.reading[key] !== "object" || Array.isArray(store.reading[key])) {
                fail("reading day map is invalid");
            }
            for (day in store.reading[key]) {
                if (!Object.prototype.hasOwnProperty.call(store.reading[key], day)) continue;
                if (!/^\d{4}-\d{2}-\d{2}$/.test(day)
                    || !validCalendarDate(Number(day.slice(0, 4)), Number(day.slice(5, 7)), Number(day.slice(8, 10)))
                    || typeof store.reading[key][day] !== "number"
                    || !isFinite(store.reading[key][day]) || store.reading[key][day] < 0) {
                    fail("reading entry is invalid");
                }
            }
        }
        return true;
    }

    /* Preserve the first known source: restoration never overwrites observation, or vice versa. */
    function origin(store, key, observed) {
        var source = observed === "observed" || observed === true ? "observed" : "restored";
        mutableStore(store);
        requireKey(key);
        if (!Object.prototype.hasOwnProperty.call(store.origins, key)) {
            store.origins[key] = source;
        }
        return store.origins[key];
    }

    function addReading(store, key, startMs, endMs) {
        var start = dateFrom(startMs).getTime();
        var end = dateFrom(endMs).getTime();
        var cursor = start;
        var date;
        var nextMidnight;
        var day;
        mutableStore(store);
        requireKey(key);
        if (end <= start) fail("reading interval must end after it starts");
        if (!store.reading[key]) store.reading[key] = {};
        while (cursor < end) {
            date = new Date(cursor);
            nextMidnight = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1).getTime();
            if (nextMidnight <= cursor) fail("could not find next local midnight");
            day = localDate(cursor);
            store.reading[key][day] = (store.reading[key][day] || 0)
                + (Math.min(end, nextMidnight) - cursor) / 1000;
            cursor = Math.min(end, nextMidnight);
        }
        return store;
    }

    function itemFor(validItems, key) {
        var i;
        if (validItems === undefined || validItems === null) return {};
        if (typeof Map !== "undefined" && validItems instanceof Map) return validItems.get(key) || null;
        if (Array.isArray(validItems)) {
            for (i = 0; i < validItems.length; i++) {
                if (validItems[i] && validItems[i].key === key) return validItems[i];
            }
            return null;
        }
        fail("validItems must be an array or Map");
    }

    function readingRecords(store, validItems) {
        var records = [];
        var key;
        var day;
        var item;
        validateStore(store);
        for (key in store.reading) {
            if (!Object.prototype.hasOwnProperty.call(store.reading, key)) continue;
            item = itemFor(validItems, key);
            if (item === null) continue;
            for (day in store.reading[key]) {
                if (!Object.prototype.hasOwnProperty.call(store.reading[key], day)) continue;
                if (store.reading[key][day] < 60) continue;
                records.push({
                    id: key + ":" + day + ":read",
                    key: key,
                    parentKey: key,
                    type: "read",
                    date: day,
                    seconds: store.reading[key][day],
                    title: item.title || "",
                    source: "observed"
                });
            }
        }
        return records.sort(function (a, b) {
            return a.date === b.date ? a.key.localeCompare(b.key) : a.date.localeCompare(b.date);
        });
    }

    /* Returns a creditable interval only; callers persist the returned interval with addReading(). */
    function creditedInterval(previousKey, currentKey, lastInputMs, lastTickMs, nowMs) {
        var input = dateFrom(lastInputMs).getTime();
        var tick = dateFrom(lastTickMs).getTime();
        var now = dateFrom(nowMs).getTime();
        if (!previousKey || previousKey !== currentKey || now <= tick
            || now - tick > MAX_TICK_GAP_MS || now <= input || now - input > IDLE_MS) {
            return null;
        }
        return { key: currentKey, startMs: Math.max(tick, input), endMs: now };
    }

    return {
        emptyStore: emptyStore,
        validateStore: validateStore,
        origin: origin,
        addOrigin: origin,
        addReading: addReading,
        readingRecords: readingRecords,
        creditedInterval: creditedInterval,
        localDate: localDate,
        parseDateAdded: parseDateAdded,
        VERSION: VERSION,
        MAX_TICK_GAP_MS: MAX_TICK_GAP_MS,
        IDLE_MS: IDLE_MS
    };
}());

if (typeof module !== "undefined") module.exports = ResearchActivityModel;
