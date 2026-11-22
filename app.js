(function () {
  const L = window.CatanLogic;
  const KEY = 'matts-catan-v1';
  const $ = (s) => document.querySelector(s);
  const cap = (s) => s[0].toUpperCase() + s.slice(1);
  const ICON = { lumber: '🌲', brick: '🧱', wool: '🐑', grain: '🌾', ore: '⛰️' };

  const fresh = () => ({ name: '', hexes: [], props: [], rolls: [], hand: L.emptyHand(), gathered: L.emptyHand(), nextId: 1, nextHexId: 1 });
  let S;
  try { S = Object.assign(fresh(), JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) { S = fresh(); }
  // Migrate older saves where hexes were stored inline on each spot
  S.props.forEach((p) => {
    if (p.hexes && !p.hexIds) {
      p.hexIds = p.hexes.map((h) => {
        let x = S.hexes.find((e) => e.res === h.res && e.num === h.num);
        if (!x) { x = { id: S.nextHexId++, res: h.res, num: h.num, blocked: !!h.blocked }; S.hexes.push(x); }
        return x.id;
      });
      delete p.hexes;
    }
  });
  const hexById = (id) => S.hexes.find((h) => h.id === id);
  // Spots with their hex objects filled in (robber lives on the hex, shared by every spot touching it)
  const resolved = () => S.props.map((p) => ({ id: p.id, type: p.type, hexes: p.hexIds.map(hexById).filter(Boolean) }));
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} };

  const resPill = (r, n) => `<span class="res ${r}">${ICON[r]} ${n}</span>`;
  const pillsFor = (hand) => L.RESOURCES.filter((r) => hand[r] > 0).map((r) => resPill(r, hand[r])).join('') || '<span class="muted">nothing</span>';
  const numBadge = (n) => `<b class="${n === 6 || n === 8 ? 'red' : ''}">${n}</b>`;

  // ---- Tabs ----
  document.querySelectorAll('#tabs button').forEach((b) => b.addEventListener('click', () => {
    document.querySelectorAll('#tabs button').forEach((x) => x.classList.toggle('active', x === b));
    document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('active', t.id === 'tab-' + b.dataset.tab));
    render();
  }));

  $('#playerName').value = S.name;
  $('#playerName').addEventListener('input', (e) => { S.name = e.target.value; save(); });

  // ---- Roll ----
  function buildPad() {
    const pad = $('#rollPad');
    pad.innerHTML = '';
    const table = L.payTable(resolved());
    for (let n = 2; n <= 12; n++) {
      const b = document.createElement('button');
      const paid = table[n];
      b.className = (paid ? 'pays ' : '') + (n === 7 ? 'seven ' : '') + (n === 6 || n === 8 ? 'red' : '');
      b.innerHTML = `${n}<small>${n === 7 ? 'robber' : '•'.repeat(L.pips(n))}</small>`;
      b.addEventListener('click', () => doRoll(n));
      pad.appendChild(b);
    }
  }

  function doRoll(n) {
    const gained = L.payout(resolved(), n);
    S.rolls.push({ n, gained });
    S.hand = L.addHands(S.hand, gained);
    S.gathered = L.addHands(S.gathered, gained);
    save();
    const box = $('#rollResult');
    box.hidden = false;
    if (n === 7) {
      const t = L.total(S.hand);
      box.innerHTML = `<div class="big">🦹 Rolled a 7</div><p>No one collects. Move the robber.${t > 7 ? ` <b>You hold ${t} cards — discard ${Math.floor(t / 2)}.</b>` : ''}</p>`;
    } else if (L.total(gained) === 0) {
      box.innerHTML = `<div class="big">Rolled ${n}</div><p class="muted">Nothing for you this time.</p>`;
    } else {
      box.innerHTML = `<div class="big">Rolled ${n} — you collect</div><div>${pillsFor(gained)}</div>`;
    }
    render();
  }

  $('#undoRoll').addEventListener('click', () => {
    const last = S.rolls.pop();
    if (!last) return;
    S.hand = clamp(L.addHands(S.hand, last.gained, -1));
    S.gathered = clamp(L.addHands(S.gathered, last.gained, -1));
    $('#rollResult').hidden = true;
    save(); render();
  });
  const clamp = (h) => { for (const r of L.RESOURCES) h[r] = Math.max(0, h[r]); return h; };

  // ---- Properties ----
  let editingId = null;
  function renderProps() {
    const list = $('#propList');
    list.innerHTML = '';
    if (!S.props.length) list.innerHTML = '<div class="card muted">No settlements yet. Add your starting two.</div>';
    S.props.forEach((p) => {
      const d = document.createElement('div');
      d.className = 'prop';
      const chips = p.hexIds.map(hexById).filter(Boolean).map((h) => `<button class="chip ${h.res} ${h.blocked ? 'blocked' : ''}" data-hid="${h.id}">${ICON[h.res]} ${numBadge(h.num)}</button>`).join('');
      d.innerHTML = `<div class="top"><span>${p.type === 'city' ? '🏙️ City (2×)' : '🏠 Settlement (1×)'}</span>
        <span class="acts">${p.type === 'settlement' ? `<button class="ghost" data-up="${p.id}">Upgrade</button>` : ''}
        <button class="ghost" data-edit="${p.id}">Edit</button><button class="ghost" data-del="${p.id}">✕</button></span></div><div>${chips}</div>`;
      list.appendChild(d);
    });
    list.querySelectorAll('.chip').forEach((c) => c.addEventListener('click', () => {
      const h = hexById(+c.dataset.hid);
      h.blocked = !h.blocked;
      save(); render();
    }));
    list.querySelectorAll('[data-up]').forEach((b) => b.addEventListener('click', () => {
      S.props.find((x) => x.id == b.dataset.up).type = 'city'; save(); render();
    }));
    list.querySelectorAll('[data-del]').forEach((b) => b.addEventListener('click', () => {
      if (confirm('Remove this spot?')) { S.props = S.props.filter((x) => x.id != b.dataset.del); save(); render(); }
    }));
    list.querySelectorAll('[data-edit]').forEach((b) => b.addEventListener('click', () => openDialog(+b.dataset.edit)));

    const t = L.payTable(resolved());
    const keys = Object.keys(t);
    $('#payTable').innerHTML = keys.length
      ? keys.map((n) => `<div class="handrow"><span class="big">${n}</span><span>${pillsFor(t[n])}</span></div>`).join('')
      : '<span class="muted">Add spots to see what each number pays.</span>';
  }

  const dlg = $('#propDialog');
  const blank = () => ({ res: null, num: null });
  const done = (s) => s.res && s.num;
  let draft = { type: 'settlement', slots: [blank()], active: 0 };
  const shake = (sel) => $(sel).animate([{ transform: 'translateX(-4px)' }, { transform: 'translateX(4px)' }, { transform: 'none' }], 200);
  const chipHtml = (h, extra = '') => `<button type="button" class="chip ${h.res} ${extra}" data-hid="${h.id}">${ICON[h.res]} ${numBadge(h.num)}</button>`;

  // After a slot is completed: make sure there is a next empty slot (max 3) and move to the first incomplete one.
  function advance() {
    if (draft.slots.length < 3 && draft.slots.every(done)) draft.slots.push(blank());
    const next = draft.slots.findIndex((s) => !done(s));
    if (next >= 0) draft.active = next;
  }

  function renderDialog() {
    document.querySelectorAll('#typePick button').forEach((b) => b.classList.toggle('on', b.dataset.type === draft.type));
    $('#selCount').textContent = `(${draft.slots.filter(done).length}/3)`;
    const s = draft.slots[draft.active];

    $('#slots').innerHTML = draft.slots.map((x, i) => `<div class="slot ${i === draft.active ? 'active' : ''}" data-i="${i}">
      ${(x.res || x.num || draft.slots.length > 1) ? `<span class="x" data-x="${i}">✕</span>` : ''}
      <div>${x.res ? ICON[x.res] + ' ' + cap(x.res) : '<span class="muted">resource?</span>'}</div>
      <b class="${x.num ? (x.num === 6 || x.num === 8 ? 'red' : '') : 'q'}">${x.num || '?'}</b></div>`).join('');
    $('#slots').querySelectorAll('.slot').forEach((el) => el.addEventListener('click', (e) => {
      const rm = e.target.dataset.x;
      if (rm !== undefined) {
        draft.slots.splice(+rm, 1);
        if (!draft.slots.length) draft.slots.push(blank());
        draft.active = Math.min(draft.active, draft.slots.length - 1);
        if (draft.slots.length < 3 && draft.slots.every(done)) draft.slots.push(blank());
      } else draft.active = +el.dataset.i;
      renderDialog();
    }));
    $('#slotHint').textContent = !s.res && !s.num ? 'Pick this hex’s resource and its number.'
      : !s.num ? 'Now tap the number on that hex.' : !s.res ? 'Now tap the resource on that hex.' : 'Tap another slot to change it.';

    $('#resPick').innerHTML = L.RESOURCES.map((r) => `<button type="button" class="${s.res === r ? 'on' : ''}" data-res="${r}">${ICON[r]} ${cap(r)}</button>`).join('');
    $('#resPick').querySelectorAll('button').forEach((bt) => bt.addEventListener('click', () => { s.res = bt.dataset.res; advance(); renderDialog(); }));
    $('#numPick').innerHTML = L.NUMBERS.map((n) => `<button type="button" class="${(n === 6 || n === 8 ? 'r6 ' : '') + (s.num === n ? 'on' : '')}" data-n="${n}">${n}</button>`).join('');
    $('#numPick').querySelectorAll('button').forEach((bt) => bt.addEventListener('click', () => { s.num = +bt.dataset.n; advance(); renderDialog(); }));

    const has = (h) => draft.slots.findIndex((x) => x.res === h.res && x.num === h.num);
    $('#hexPick').innerHTML = S.hexes.length
      ? S.hexes.slice().sort((p, q) => p.res.localeCompare(q.res) || p.num - q.num).map((h) => chipHtml(h, has(h) >= 0 ? 'sel' : '')).join('')
      : '<span class="muted">None yet.</span>';
    $('#hexPick').querySelectorAll('.chip').forEach((c) => c.addEventListener('click', () => {
      const h = hexById(+c.dataset.hid);
      const at = has(h);
      if (at >= 0) { draft.slots.splice(at, 1); if (!draft.slots.length) draft.slots.push(blank()); draft.active = Math.min(draft.active, draft.slots.length - 1); }
      else {
        let i = draft.slots.findIndex((x) => !x.res && !x.num);
        if (i < 0 && draft.slots.length < 3) { draft.slots.push(blank()); i = draft.slots.length - 1; }
        if (i < 0) { shake('#slots'); return; }
        draft.slots[i] = { res: h.res, num: h.num };
      }
      advance(); renderDialog();
    }));
  }

  function openDialog(id) {
    editingId = id || null;
    const p = id ? S.props.find((x) => x.id === id) : null;
    $('#dlgTitle').textContent = p ? 'Edit spot' : 'Add spot';
    const slots = p ? p.hexIds.map(hexById).filter(Boolean).map((h) => ({ res: h.res, num: h.num })) : [];
    if (slots.length < 3) slots.push(blank());
    draft = { type: p ? p.type : 'settlement', slots, active: slots.length - 1 };
    renderDialog();
    dlg.showModal();
  }
  $('#addProp').addEventListener('click', () => openDialog());
  $('#typePick').querySelectorAll('button').forEach((bt) => bt.addEventListener('click', () => { draft.type = bt.dataset.type; renderDialog(); }));
  $('#dlgCancel').addEventListener('click', () => dlg.close());
  $('#dlgSave').addEventListener('click', () => {
    if (draft.slots.some((x) => (x.res || x.num) && !done(x))) { $('#slotHint').textContent = 'Finish or clear the half-filled hex first (needs both resource and number).'; shake('#slots'); return; }
    const full = draft.slots.filter(done);
    if (!full.length) { shake('#slots'); return; }
    const ids = [];
    full.forEach((x) => {
      let h = S.hexes.find((e) => e.res === x.res && e.num === x.num);
      if (!h) { h = { id: S.nextHexId++, res: x.res, num: x.num, blocked: false }; S.hexes.push(h); }
      if (!ids.includes(h.id)) ids.push(h.id);
    });
    if (editingId) { const p = S.props.find((x) => x.id === editingId); p.type = draft.type; p.hexIds = ids; }
    else S.props.push({ id: S.nextId++, type: draft.type, hexIds: ids });
    save(); dlg.close(); render();
  });

  // ---- Hand ----
  const COSTS = {
    Road: { lumber: 1, brick: 1 },
    Settlement: { lumber: 1, brick: 1, wool: 1, grain: 1 },
    City: { grain: 2, ore: 3 },
    'Dev card': { wool: 1, grain: 1, ore: 1 },
  };
  function renderHand() {
    $('#hand').innerHTML = L.RESOURCES.map((r) => `<div class="handrow"><span class="res ${r}">${ICON[r]} ${cap(r)}</span>
      <span class="stepper"><button data-r="${r}" data-d="-1">−</button><span>${S.hand[r]}</span><button data-r="${r}" data-d="1">+</button></span></div>`).join('');
    $('#hand').querySelectorAll('button').forEach((b) => b.addEventListener('click', () => {
      S.hand[b.dataset.r] = Math.max(0, S.hand[b.dataset.r] + +b.dataset.d); save(); renderHand();
    }));
    const t = L.total(S.hand);
    $('#handTotal').innerHTML = `<b>${t}</b> cards${t > 7 ? ' — <b style="color:#b23a1e">over 7, you discard on a 7</b>' : ''}`;
    $('#builds').innerHTML = Object.entries(COSTS).map(([name, c]) => {
      const ok = L.RESOURCES.every((r) => S.hand[r] >= (c[r] || 0));
      const cost = Object.entries(c).map(([r, n]) => `${n}${ICON[r]}`).join(' ');
      return `<button data-b="${name}" ${ok ? '' : 'disabled'}>${name}<small>${cost}</small></button>`;
    }).join('');
    $('#builds').querySelectorAll('button').forEach((b) => b.addEventListener('click', () => {
      const c = COSTS[b.dataset.b];
      for (const r in c) S.hand[r] -= c[r];
      save(); renderHand();
    }));
  }
  $('#resetHand').addEventListener('click', () => { S.hand = L.emptyHand(); save(); renderHand(); });

  // ---- Stats ----
  function renderStats() {
    const nums = S.rolls.map((r) => r.n);
    const h = L.histogram(nums);
    const max = Math.max(1, ...Object.values(h));
    const bars = Object.keys(h).map((n) => `<div title="${n}: ${h[n]}"><span>${h[n]}</span><i style="height:${(h[n] / max) * 80}%"></i></div>`).join('');
    const labels = Object.keys(h).map((n) => `<div style="font-size:12px;text-align:center;flex:1">${n}<br><span class="muted">${(nums.length * L.pips(+n) / 36).toFixed(1)}</span></div>`).join('');
    const exp = L.expectedPerRoll(resolved());
    const expTotal = L.total(exp);
    $('#statsBody').innerHTML = `
      <div class="card"><b>${nums.length}</b> rolls · <b>${nums.filter((n) => n === 7).length}</b> sevens<br>
      <span class="muted">Under each number: how many times you'd expect it so far.</span>
      <div class="bar">${bars}</div><div style="display:flex">${labels}</div></div>
      <h3>Gathered this game</h3><div class="card">${pillsFor(S.gathered)}<br><span class="muted">${L.total(S.gathered)} cards total</span></div>
      <h3>Expected per roll</h3><div class="card">${L.RESOURCES.map((r) => resPill(r, exp[r].toFixed(2))).join('')}
      <br><span class="muted">≈ ${expTotal.toFixed(2)} cards per roll with your current spots.</span></div>`;
  }
  $('#newGame').addEventListener('click', () => {
    if (confirm('Clear all spots, rolls and hand for a new game?')) { const n = S.name; S = fresh(); S.name = n; save(); render(); }
  });

  function render() {
    buildPad();
    $('#rollCount').textContent = `${S.rolls.length} rolls`;
    $('#rollLog').innerHTML = S.rolls.slice().reverse().slice(0, 40).map((r) => `<span class="${r.n === 7 ? 'seven' : ''}">${r.n}</span>`).join('');
    renderProps(); renderHand(); renderStats();
  }
  render();
})();
