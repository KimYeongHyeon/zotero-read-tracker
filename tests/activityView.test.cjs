const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
// Exercise actual private aggregation functions without changing the production API.
let source = fs.readFileSync(require.resolve('../activityView.js'), 'utf8');
source = source.replace('global.ResearchActivityView = {', 'global.__test = {ratioCounts, safeState, countLabel}; global.ResearchActivityView = {');
const window = {};
vm.runInNewContext(source, {window});
const plain = value => JSON.parse(JSON.stringify(value));
for (const [counts, expected] of [
    [{read:0,note:0,save:0}, {read:0,note:0,save:0}],
    [{read:1,note:1,save:1}, {read:34,note:33,save:33}],
    [{read:0,note:0,save:3}, {read:0,note:0,save:100}],
    [{read:1,note:4,save:1}, {read:17,note:67,save:16}]
]) assert.deepEqual(plain(window.__test.ratioCounts(counts)), expected);
assert.deepEqual(plain(window.__test.safeState({year:'bad',type:'unknown',month:30,garbage:true})), {});
assert.deepEqual(plain(window.__test.safeState({month:null})), {month:null});
console.log('activityView tests passed');

assert.equal(window.__test.countLabel(1, "activity"), "1 activity");
assert.equal(window.__test.countLabel(2, "reading activity"), "2 reading activities");
assert.equal(window.__test.countLabel(1, "paper"), "1 paper");
