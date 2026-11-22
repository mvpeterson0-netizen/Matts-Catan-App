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

// ---- Board ----
const code = 'O10 W2 L9 / G12 B6 W4 G10 / L9 G11 D L3 O8 / B3 W11 L4 G5 / O5 B8 W6';
const pb = L.parseBoard(code);
assert.ok(pb.board, pb.error);
assert.strictEqual(pb.board.length, 19);
assert.deepStrictEqual(pb.board[2], { res: 'lumber', num: 9 });
assert.strictEqual(pb.board[9].res, 'desert');
assert.strictEqual(L.boardToCode(pb.board), code);
assert.ok(L.parseBoard('L6 B8').error, 'wrong count rejected');
assert.ok(L.parseBoard(code.replace('O10', 'O7')).error, '7 is not a valid number');
assert.ok(L.parseBoard(code.replace('O10', 'X10')).error);
assert.strictEqual(L.parseBoard(code.toLowerCase().replace(/ \//g, ',')).board.length, 19, 'case/separators tolerant');
assert.deepStrictEqual(pb.warnings, [], 'sample is a standard distribution');
const bad = L.parseBoard(code.replace('O10', 'O9'));
assert.ok(bad.warnings.length > 0, 'misread number is flagged');

const lay = L.boardLayout(36);
assert.strictEqual(lay.hexes.length, 19);
assert.strictEqual(lay.vertices.length, 54, '54 intersections on a standard board');
assert.ok(lay.vertices.every((v) => v.hexIdx.length >= 1 && v.hexIdx.length <= 3));
assert.strictEqual(lay.vertices.filter((v) => v.hexIdx.length === 3).length, 24);
assert.strictEqual(lay.vertices.filter((v) => v.hexIdx.length === 2).length, 12);
assert.strictEqual(lay.vertices.filter((v) => v.hexIdx.length === 1).length, 18);

console.log('All logic tests passed');
