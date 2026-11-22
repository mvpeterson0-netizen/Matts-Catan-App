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


  // ---------- Board ----------
  const LETTERS = { L: 'lumber', B: 'brick', W: 'wool', G: 'grain', O: 'ore' };
  const LETTER_OF = Object.fromEntries(Object.entries(LETTERS).map(([k, v]) => [v, k]));
  const ROWS = [3, 4, 5, 4, 3]; // standard board, top to bottom, left to right

  // Code format: 19 tokens, e.g. "O10 W2 L9 / G12 B6 W4 G10 / ..." (D = desert, ? = not set yet)
  function parseBoard(str) {
    const tokens = String(str || '').toUpperCase().replace(/[\/,;|\n\r]+/g, ' ').trim().split(/\s+/).filter(Boolean);
    if (tokens.length !== 19) return { error: `Expected 19 hexes but found ${tokens.length}.` };
    const board = [];
    for (let i = 0; i < 19; i++) {
      const t = tokens[i];
      if (t === 'D') { board.push({ res: 'desert', num: null }); continue; }
      if (t === '?') { board.push({ res: null, num: null }); continue; }
      const m = /^([LBWGO])(\d{1,2})$/.exec(t);
      if (!m || !NUMBERS.includes(+m[2])) return { error: `Hex ${i + 1} ("${tokens[i]}") isn't valid. Use a letter L/B/W/G/O plus a number, or D for desert.` };
      board.push({ res: LETTERS[m[1]], num: +m[2] });
    }
    return { board, warnings: validateBoard(board) };
  }

  function boardToCode(board) {
    const tok = (h) => (h.res === 'desert' ? 'D' : !h.res || !h.num ? '?' : LETTER_OF[h.res] + h.num);
    let i = 0;
    return ROWS.map((n) => board.slice(i, (i += n)).map(tok).join(' ')).join(' / ');
  }

  // Non-blocking sanity check against the standard 19-hex board (catches misread photos).
  function validateBoard(board) {
    const w = [];
    const want = { lumber: 4, grain: 4, wool: 4, brick: 3, ore: 3, desert: 1 };
    const have = {};
    for (const h of board) if (h.res) have[h.res] = (have[h.res] || 0) + 1;
    for (const r in want) if ((have[r] || 0) !== want[r]) w.push(`${have[r] || 0} ${r} (standard board has ${want[r]})`);
    const wantNum = { 2: 1, 3: 2, 4: 2, 5: 2, 6: 2, 8: 2, 9: 2, 10: 2, 11: 2, 12: 1 };
    const haveNum = {};
    for (const h of board) if (h.num) haveNum[h.num] = (haveNum[h.num] || 0) + 1;
    for (const n in wantNum) if ((haveNum[n] || 0) !== wantNum[n]) w.push(`${haveNum[n] || 0}× number ${n} (standard has ${wantNum[n]})`);
    return w;
  }

  // Pointy-top hex geometry. R = center-to-corner. Returns hex centers and de-duplicated corners (intersections).
  function boardLayout(R) {
    const w = Math.sqrt(3) * R;
    const hexes = [];
    const vmap = new Map();
    let idx = 0;
    ROWS.forEach((count, row) => {
      for (let i = 0; i < count; i++) {
        const cx = (i + (5 - count) / 2) * w + w / 2;
        const cy = R + row * 1.5 * R;
        const corners = [];
        for (let k = 0; k < 6; k++) {
          const a = ((60 * k - 30) * Math.PI) / 180;
          const x = cx + R * Math.cos(a), y = cy + R * Math.sin(a);
          const key = Math.round(x) + ',' + Math.round(y);
          if (!vmap.has(key)) vmap.set(key, { key, x, y, hexIdx: [] });
          vmap.get(key).hexIdx.push(idx);
          corners.push([x, y]);
        }
        hexes.push({ idx, cx, cy, corners });
        idx++;
      }
    });
    return { hexes, vertices: [...vmap.values()], width: 5 * w, height: 8 * R };
  }

  const api = { LETTERS, ROWS, parseBoard, boardToCode, validateBoard, boardLayout, RESOURCES, NUMBERS, pips, emptyHand, payout, total, addHands, expectedPerRoll, payTable, histogram, multiplier };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.CatanLogic = api;
})(typeof self !== 'undefined' ? self : this);
