(function () {
  const L = window.CatanLogic;
  const KEY = 'matts-catan-v1';
  const $ = (s) => document.querySelector(s);
  const cap = (s) => s[0].toUpperCase() + s.slice(1);
  const ICON = { lumber: '🌲', brick: '🧱', wool: '🐑', grain: '🌾', ore: '⛰️' };

  const fresh = () => ({ name: '', props: [], rolls: [], hand: L.emptyHand(), gathered: L.emptyHand(), nextId: 1 });
  let S;
  try { S = Object.assign(fresh(), JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) { S = fresh(); }
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
    const table = L.payTable(S.props);
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
    const gained = L.payout(S.props, n);
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
      const chips = p.hexes.map((h, i) => `<button class="chip ${h.res} ${h.blocked ? 'blocked' : ''}" data-pid="${p.id}" data-i="${i}">${ICON[h.res]} ${numBadge(h.num)}</button>`).join('');
      d.innerHTML = `<div class="top"><span>${p.type === 'city' ? '🏙️ City (2×)' : '🏠 Settlement (1×)'}</span>
        <span class="acts">${p.type === 'settlement' ? `<button class="ghost" data-up="${p.id}">Upgrade</button>` : ''}
        <button class="ghost" data-edit="${p.id}">Edit</button><button class="ghost" data-del="${p.id}">✕</button></span></div><div>${chips}</div>`;
      list.appendChild(d);
    });
    list.querySelectorAll('.chip').forEach((c) => c.addEventListener('click', () => {
      const p = S.props.find((x) => x.id == c.dataset.pid);
      p.hexes[c.dataset.i].blocked = !p.hexes[c.dataset.i].blocked;
      save(); render();
    }));
    list.querySelectorAll('[data-up]').forEach((b) => b.addEventListener('click', () => {
      S.props.find((x) => x.id == b.dataset.up).type = 'city'; save(); render();
    }));
    list.querySelectorAll('[data-del]').forEach((b) => b.addEventListener('click', () => {
      if (confirm('Remove this spot?')) { S.props = S.props.filter((x) => x.id != b.dataset.del); save(); render(); }
    }));
    list.querySelectorAll('[data-edit]').forEach((b) => b.addEventListener('click', () => openDialog(+b.dataset.edit)));

    const t = L.payTable(S.props);
    const keys = Object.keys(t);
    $('#payTable').innerHTML = keys.length
      ? keys.map((n) => `<div class="handrow"><span class="big">${n}</span><span>${pillsFor(t[n])}</span></div>`).join('')
      : '<span class="muted">Add spots to see what each number pays.</span>';
  }

  const dlg = $('#propDialog');
  function hexRow(h = { res: 'lumber', num: 6 }) {
    const row = document.createElement('div');
    row.className = 'hexrow';
    row.innerHTML = `<select class="res">${L.RESOURCES.map((r) => `<option value="${r}" ${r === h.res ? 'selected' : ''}>${ICON[r]} ${cap(r)}</option>`).join('')}</select>
      <select class="num">${L.NUMBERS.map((n) => `<option ${n === h.num ? 'selected' : ''}>${n}</option>`).join('')}</select>
      <button type="button" class="ghost rm">✕</button>`;
    row.querySelector('.rm').addEventListener('click', () => { if ($('#hexRows').children.length > 1) row.remove(); });
    row.dataset.blocked = h.blocked ? '1' : '';
    return row;
  }
  function openDialog(id) {
    editingId = id || null;
    const p = id ? S.props.find((x) => x.id === id) : null;
    $('#dlgTitle').textContent = p ? 'Edit spot' : 'Add spot';
    document.querySelector(`input[name=ptype][value=${p ? p.type : 'settlement'}]`).checked = true;
    $('#hexRows').innerHTML = '';
    (p ? p.hexes : [undefined, undefined, undefined]).forEach((h) => $('#hexRows').appendChild(hexRow(h)));
    dlg.showModal();
  }
  $('#addProp').addEventListener('click', () => openDialog());
  $('#addHexRow').addEventListener('click', () => { if ($('#hexRows').children.length < 3) $('#hexRows').appendChild(hexRow()); });
  $('#dlgCancel').addEventListener('click', () => dlg.close());
  $('#propForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const hexes = [...$('#hexRows').children].map((r) => ({
      res: r.querySelector('.res').value, num: +r.querySelector('.num').value, blocked: !!r.dataset.blocked,
    }));
    const type = document.querySelector('input[name=ptype]:checked').value;
    if (editingId) { const p = S.props.find((x) => x.id === editingId); p.type = type; p.hexes = hexes; }
    else S.props.push({ id: S.nextId++, type, hexes });
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
    const exp = L.expectedPerRoll(S.props);
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
