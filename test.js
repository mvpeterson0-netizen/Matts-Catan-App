const assert = require('assert');
const L = require('./logic.js');

const props = [
  { id: 1, type: 'settlement', hexes: [{ res: 'brick', num: 6 }, { res: 'ore', num: 8 }, { res: 'wool', num: 4 }] },
  { id: 2, type: 'city', hexes: [{ res: 'brick', num: 6 }, { res: 'grain', num: 9 }] },
];

// Settlement pays 1, city pays 2; same resource stacks
assert.strictEqual(L.payout(props, 6).brick, 3);
assert.strictEqual(L.payout(props, 9).grain, 2);
assert.strictEqual(L.payout(props, 8).ore, 1);
assert.strictEqual(L.total(L.payout(props, 7)), 0, '7 pays nothing');
assert.strictEqual(L.total(L.payout(props, 12)), 0);

// Robber-blocked hex pays nothing
const blocked = JSON.parse(JSON.stringify(props));
blocked[1].hexes[0].blocked = true;
assert.strictEqual(L.payout(blocked, 6).brick, 1);

// Pips
assert.strictEqual(L.pips(6), 5);
assert.strictEqual(L.pips(8), 5);
assert.strictEqual(L.pips(2), 1);
assert.strictEqual(L.pips(12), 1);
assert.strictEqual(L.pips(7), 6);

// Expected per roll: brick = (1*5 + 2*5)/36
assert.ok(Math.abs(L.expectedPerRoll(props).brick - 15 / 36) < 1e-9);

// Pay table has only paying numbers
assert.deepStrictEqual(Object.keys(L.payTable(props)).map(Number).sort((a, b) => a - b), [4, 6, 8, 9]);

// Histogram
const h = L.histogram([6, 6, 8, 2]);
assert.strictEqual(h[6], 2);
assert.strictEqual(h[8], 1);
assert.strictEqual(h[7], 0);

// Hand math
const sum = L.addHands(L.emptyHand(), L.payout(props, 6));
assert.strictEqual(sum.brick, 3);
assert.strictEqual(L.addHands(sum, L.payout(props, 6), -1).brick, 0);

console.log('All logic tests passed');
