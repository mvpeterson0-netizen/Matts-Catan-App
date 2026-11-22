// Pure Catan logic (no DOM) so it can be unit tested in Node.
(function (root) {
  const RESOURCES = ['lumber', 'brick', 'wool', 'grain', 'ore'];
  const NUMBERS = [2, 3, 4, 5, 6, 8, 9, 10, 11, 12];

  // Dots shown on the number token = ways to roll it with two dice (out of 36)
  const pips = (n) => 6 - Math.abs(7 - n);

  const emptyHand = () => Object.fromEntries(RESOURCES.map((r) => [r, 0]));

  // A property: { id, type: 'settlement'|'city', hexes: [{res, num, blocked}] }
  const multiplier = (p) => (p.type === 'city' ? 2 : 1);

  // What one roll pays for the given properties.
  function payout(properties, roll) {
    const out = emptyHand();
    if (roll === 7) return out;
    for (const p of properties) {
      for (const h of p.hexes) {
        if (h.num === roll && !h.blocked) out[h.res] += multiplier(p);
      }
    }
    return out;
  }

  const total = (hand) => RESOURCES.reduce((s, r) => s + hand[r], 0);

  function addHands(a, b, sign = 1) {
    const out = emptyHand();
    for (const r of RESOURCES) out[r] = a[r] + sign * b[r];
    return out;
  }

  // Expected resources per roll (all numbers) for a property set.
  function expectedPerRoll(properties) {
    const out = emptyHand();
    for (const p of properties) {
      for (const h of p.hexes) {
        if (!h.blocked) out[h.res] += (multiplier(p) * pips(h.num)) / 36;
      }
    }
    return out;
  }

  // Which roll numbers pay me, and what.
  function payTable(properties) {
    const t = {};
    for (const n of NUMBERS) {
      const p = payout(properties, n);
      if (total(p) > 0) t[n] = p;
    }
    return t;
  }

  // Count of rolls by number, from a log of numbers.
  function histogram(rolls) {
    const h = {};
    for (let n = 2; n <= 12; n++) h[n] = 0;
    for (const r of rolls) h[r]++;
    return h;
  }

  const api = { RESOURCES, NUMBERS, pips, emptyHand, payout, total, addHands, expectedPerRoll, payTable, histogram, multiplier };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.CatanLogic = api;
})(typeof self !== 'undefined' ? self : this);
