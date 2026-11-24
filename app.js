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
      ? keys.map((n) => `<div class="handrow"><span class="big">${numBadge(+n)}</span><span>${pillsFor(t[n])}</span></div>`).join('')
      : '<span class="muted">Add spots to see what each roll pays you.</span>';
    const exp = L.expectedPerRoll(resolved());
    $('#expected').innerHTML = `<b>Average per roll</b><br>${L.RESOURCES.filter((r) => exp[r] > 0).map((r) => resPill(r, exp[r].toFixed(2))).join('') || '<span class="muted">nothing yet</span>'}
      <br><span class="muted">≈ ${L.total(exp).toFixed(2)} cards per roll with your current spots.</span>`;
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

  $('#newGame').addEventListener('click', () => {
    if (confirm('Clear all spots for a new game?')) { const n = S.name; S = fresh(); S.name = n; save(); render(); }
  });

  function render() { renderProps(); }
  render();
})();
