import * as S from './store.js';
import {
  PRESETS, esc, fmtNum, money, plural, todayStr, nowTime, fmtDate,
  carRows, allRows, countLevels, itemStatus, costSummary,
} from './logic.js';

const root = document.getElementById('app');
let carTab = 'maintenance';
let costPeriod = 'year';

const num = (v) => {
  const s = String(v ?? '').replace(/,/g, '').trim();
  if (s === '') return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
};

/* ---------- small UI helpers ---------- */

function toast(msg) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = msg;
  document.body.appendChild(el);
  requestAnimationFrame(() => el.classList.add('show'));
  setTimeout(() => { el.classList.remove('show'); setTimeout(() => el.remove(), 250); }, 2200);
}

function openSheet(title, body) {
  closeSheet();
  const wrap = document.createElement('div');
  wrap.className = 'sheet-wrap';
  wrap.innerHTML = `
    <div class="sheet-backdrop" data-act="closeSheet"></div>
    <div class="sheet" role="dialog" aria-label="${esc(title)}">
      <div class="sheet-head"><h2>${esc(title)}</h2>
        <button class="icon-btn" data-act="closeSheet" aria-label="Close">&#10005;</button></div>
      <div class="sheet-body">${body}</div>
    </div>`;
  document.body.appendChild(wrap);
  document.body.classList.add('noscroll');
  requestAnimationFrame(() => wrap.classList.add('open'));
  return wrap;
}

function closeSheet() {
  document.querySelectorAll('.sheet-wrap').forEach((w) => w.remove());
  document.body.classList.remove('noscroll');
}

const levelLabel = { overdue: 'Overdue', soon: 'Due soon', ok: 'Good', unset: 'Not set up' };

/* ---------- data helpers ---------- */

function setOdo(car, odo, date = todayStr()) {
  car.odo = odo;
  S.data.odoLog.push({ carId: car.id, date, odo });
}

function carIcon() {
  return '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 16l1.4-5.2A2 2 0 0 1 8.3 9.3h7.4a2 2 0 0 1 1.9 1.5L19 16"/><path d="M3.5 16h17v3h-2.2v-1.2H5.7V19H3.5z"/><circle cx="7.5" cy="13.2" r=".6" fill="currentColor"/><circle cx="16.5" cy="13.2" r=".6" fill="currentColor"/></svg>';
}

/* ---------- views ---------- */

function itemRow(r, { showCar, showDone }) {
  const { item, car, st } = r;
  return `
    <div class="row ${st.level}">
      <button class="row-main" data-act="openItem" data-id="${item.id}">
        <span class="dot ${st.level}"></span>
        <span class="row-text">
          <span class="row-title">${esc(item.name)}</span>
          <span class="row-status ${st.level}">${esc(st.main)}</span>
          <span class="row-sub">${showCar ? esc(car.name) + (st.sub ? ' · ' : '') : ''}${esc(st.sub)}</span>
        </span>
      </button>
      ${showDone ? `<button class="btn small" data-act="logItem" data-id="${item.id}">${item.type === 'doc' ? 'Renew' : 'Done'}</button>` : ''}
    </div>`;
}

function dashboard() {
  const cars = S.data.cars.filter((c) => !c.archived);
  const rows = allRows(S.data);
  const n = countLevels(rows);
  const urgent = rows.filter((r) => r.st.level === 'overdue' || r.st.level === 'soon');

  const activeIds = new Set(cars.map((c) => c.id));
  const yearSpent = costSummary(S.data.logs.filter((l) => activeIds.has(l.carId)), 'year').total;

  const lastBackup = S.data.settings.lastBackup;
  const needBackup = cars.length && (!lastBackup || Date.now() - lastBackup > 30 * 86400000);

  let html = `
    <header class="top">
      <h1>Oil-Be-Back</h1>
      <button class="icon-btn" data-act="openSettings" aria-label="Settings">&#9881;</button>
    </header>`;

  if (!cars.length) {
    return html + `
      <div class="empty">
        <div class="empty-icon">${carIcon()}</div>
        <h2>Add your first car</h2>
        <p>Track oil, tires, brakes, documents and everything else that expires &mdash; for as many cars as you like.</p>
        <button class="btn primary" data-act="addCar">Add a car</button>
      </div>`;
  }

  html += `
    ${needBackup ? `<button class="banner" data-act="openSettings">Your data only lives on this device. <b>Back it up</b> &rsaquo;</button>` : ''}
    <div class="summary">
      <div class="sum overdue"><b>${n.overdue}</b><span>Overdue</span></div>
      <div class="sum soon"><b>${n.soon}</b><span>Due soon</span></div>
      <div class="sum"><b>${cars.length}</b><span>${cars.length === 1 ? 'Car' : 'Cars'}</span></div>
    </div>

    <section>
      <h3 class="section-title">Priorities</h3>
      ${urgent.length
        ? `<div class="list">${urgent.map((r) => itemRow(r, { showCar: true, showDone: true })).join('')}</div>`
        : `<div class="allclear"><b>All clear</b><span>Nothing overdue or due soon across your cars.</span></div>`}
    </section>

    <section>
      <div class="section-head">
        <h3 class="section-title">Cars</h3>
        <button class="link" data-act="addCar">+ Add car</button>
      </div>
      <div class="cars">
        ${cars.map((c) => {
          const cn = countLevels(carRows(S.data, c));
          const badges = [
            cn.overdue ? `<span class="badge overdue">${cn.overdue} overdue</span>` : '',
            cn.soon ? `<span class="badge soon">${cn.soon} soon</span>` : '',
          ].join('') || `<span class="badge ok">${cn.ok + cn.unset ? 'All good' : 'No items yet'}</span>`;
          return `
          <div class="card car-card">
            <button class="car-main" data-act="openCar" data-id="${c.id}">
              <span class="car-ico">${carIcon()}</span>
              <span class="car-text">
                <span class="car-name">${esc(c.name)}</span>
                <span class="car-meta">${c.plate ? esc(c.plate) + ' · ' : ''}${fmtNum(c.odo)} km</span>
              </span>
              <span class="badges">${badges}</span>
            </button>
            <button class="btn ghost small" data-act="updateOdo" data-id="${c.id}">Update odometer</button>
          </div>`;
        }).join('')}
      </div>
      ${yearSpent ? `<p class="spent-line">Spent this year across all cars: <b>${money(yearSpent)}</b></p>` : ''}
    </section>`;
  return html;
}

const periodLabel = { year: 'This year', '12m': 'Last 12 months', all: 'All time' };

function costsView(logs) {
  const s = costSummary(logs, costPeriod);
  if (!logs.length) return `<div class="empty small"><p>No costs yet. Enter a cost when you mark something as done and it will be summed up here.</p></div>`;

  const peak = s.months.reduce((a, b) => (b.amount > a.amount ? b : a), s.months[0]);
  const max = peak.amount || 1;
  return `
    <div class="pills">
      ${Object.entries(periodLabel).map(([k, v]) => `<button class="pill ${costPeriod === k ? 'on' : ''}" data-act="period" data-p="${k}">${v}</button>`).join('')}
    </div>
    <div class="card cost-total">
      <span class="muted">${periodLabel[costPeriod]}</span>
      <div class="big">${money(s.total)}</div>
      <span class="muted">Last 30 days: <b>${money(s.last30)}</b></span>
    </div>
    ${s.missing ? `<p class="note">${plural(s.missing, 'entry').replace('entrys', 'entries')} in this period ${s.missing === 1 ? 'has' : 'have'} no cost and ${s.missing === 1 ? "isn't" : "aren't"} counted.</p>` : ''}

    <h3 class="section-title">By type</h3>
    ${s.types.length ? `<div class="card stack">${s.types.map((t) => `
      <div class="crow">
        <div class="crow-top"><span>${esc(t.name)}</span><b>${money(t.amount)}</b></div>
        <div class="bar"><i style="width:${Math.max(t.pct, 2).toFixed(1)}%"></i></div>
        <small>${Math.round(t.pct)}%</small>
      </div>`).join('')}</div>` : `<p class="muted">No costs recorded in this period.</p>`}

    <h3 class="section-title">Last 12 months</h3>
    <div class="card">
      <div class="months">
        ${s.months.map((m) => `
          <div class="mcol" title="${esc(m.label)}: ${money(m.amount)}">
            <div class="mbar-wrap"><div class="mbar ${m.amount ? '' : 'zero'}" style="height:${m.amount ? Math.max((m.amount / max) * 100, 4) : 0}%"></div></div>
            <span>${esc(m.label)}</span>
          </div>`).join('')}
      </div>
      ${peak.amount ? `<p class="muted peak">Highest: <b>${esc(peak.label)}</b> &middot; ${money(peak.amount)}</p>` : ''}
    </div>`;
}

function carPage(id) {
  const car = S.car(id);
  if (!car) { location.hash = '#/'; return ''; }
  const rows = carRows(S.data, car);
  const services = rows.filter((r) => r.item.type !== 'doc');
  const docs = rows.filter((r) => r.item.type === 'doc');
  const logs = S.data.logs.filter((l) => l.carId === id).sort((a, b) => (b.date + (b.time || '')).localeCompare(a.date + (a.time || '')));
  const spent = logs.reduce((s, l) => s + (l.cost || 0), 0);

  let body;
  if (carTab === 'maintenance') {
    body = rows.length ? `
      ${services.length ? `<h3 class="section-title">Maintenance</h3><div class="list">${services.map((r) => itemRow(r, { showDone: true })).join('')}</div>` : ''}
      ${docs.length ? `<h3 class="section-title">Documents</h3><div class="list">${docs.map((r) => itemRow(r, { showDone: true })).join('')}</div>` : ''}
      <button class="btn block" data-act="addItem" data-id="${id}">+ Add item</button>`
      : `<div class="empty small">
          <p>No items yet. Add the usual ones in one go, or create your own.</p>
          <button class="btn primary" data-act="quickSetup" data-id="${id}">Quick setup</button>
          <button class="btn" data-act="addItem" data-id="${id}">Add custom item</button>
        </div>`;
  } else if (carTab === 'costs') {
    body = costsView(logs);
  } else {
    body = logs.length ? `
      <div class="spent">Total spent <b>${money(spent)}</b> <span>&middot; ${plural(logs.length, 'entry').replace('entrys', 'entries')}</span></div>
      <div class="list">
        ${logs.map((l) => `
          <button class="row log" data-act="openLog" data-id="${l.id}">
            <span class="row-text">
              <span class="row-title">${esc(l.name)}</span>
              <span class="row-sub">${fmtDate(l.date)}${l.time ? ' · ' + esc(l.time) : ''}${l.odo != null ? ' · ' + fmtNum(l.odo) + ' km' : ''}</span>
            </span>
            ${l.cost ? `<span class="log-cost">${money(l.cost)}</span>` : ''}
          </button>`).join('')}
      </div>`
      : `<div class="empty small"><p>No history yet. Mark an item as done and it will show up here.</p></div>`;
  }

  return `
    <header class="top">
      <button class="icon-btn" data-act="home" aria-label="Back">&#8249;</button>
      <h1 class="ellipsis">${esc(car.name)}</h1>
      <button class="icon-btn" data-act="carMenu" data-id="${id}" aria-label="Car options">&#8943;</button>
    </header>
    <div class="card car-head">
      <div>
        <div class="car-meta">${car.plate ? esc(car.plate) : 'No plate'}</div>
        <div class="odo">${fmtNum(car.odo)} <small>km</small></div>
      </div>
      <button class="btn small" data-act="updateOdo" data-id="${id}">Update odometer</button>
    </div>
    <div class="seg">
      <button class="${carTab === 'maintenance' ? 'on' : ''}" data-act="tab" data-tab="maintenance">Maintenance</button>
      <button class="${carTab === 'history' ? 'on' : ''}" data-act="tab" data-tab="history">History</button>
      <button class="${carTab === 'costs' ? 'on' : ''}" data-act="tab" data-tab="costs">Costs</button>
    </div>
    ${body}`;
}

function settingsPage() {
  const archived = S.data.cars.filter((c) => c.archived);
  const lb = S.data.settings.lastBackup;
  return `
    <header class="top">
      <button class="icon-btn" data-act="home" aria-label="Back">&#8249;</button>
      <h1>Settings</h1><span class="icon-btn ghost"></span>
    </header>
    <h3 class="section-title">Backup</h3>
    <div class="card stack">
      <p class="muted">Your data is stored only on this device. Save a backup file regularly, especially before clearing Safari data or switching phones.</p>
      <p class="muted">Last backup: <b>${lb ? fmtDate(new Date(lb)) : 'never'}</b></p>
      <button class="btn primary" data-act="exportJson">Save backup file</button>
      <button class="btn" data-act="importJson">Restore from backup</button>
      <button class="btn" data-act="exportCsv">Export history (CSV)</button>
      <input type="file" id="importFile" accept="application/json,.json" hidden>
    </div>
    ${archived.length ? `
      <h3 class="section-title">Archived cars</h3>
      <div class="list">${archived.map((c) => `
        <div class="row">
          <button class="row-main" data-act="openCar" data-id="${c.id}"><span class="row-text"><span class="row-title">${esc(c.name)}</span><span class="row-sub">${fmtNum(c.odo)} km</span></span></button>
          <button class="btn small" data-act="restoreCar" data-id="${c.id}">Restore</button>
        </div>`).join('')}</div>` : ''}
    <p class="foot">Oil-Be-Back &middot; works offline &middot; no account, no tracking.</p>`;
}

function render() {
  const h = location.hash || '#/';
  let html;
  if (h.startsWith('#/car/')) html = carPage(h.slice(6));
  else if (h === '#/settings') html = settingsPage();
  else html = dashboard();
  root.innerHTML = html;
}

/* ---------- forms ---------- */

const field = (label, input, hint = '') =>
  `<label class="field"><span>${label}</span>${input}${hint ? `<small>${hint}</small>` : ''}</label>`;

function carForm(car) {
  return `
    <form data-form="car" data-id="${car ? car.id : ''}" class="form">
      ${field('Name', `<input name="name" required maxlength="40" placeholder="e.g. Camry 2022" value="${esc(car?.name)}" autocomplete="off">`)}
      ${field('Plate (optional)', `<input name="plate" maxlength="20" value="${esc(car?.plate)}" autocomplete="off">`)}
      ${field('Odometer (km)', `<input name="odo" type="number" inputmode="numeric" min="0" required value="${car ? car.odo : ''}">`)}
      <button class="btn primary block" type="submit">${car ? 'Save' : 'Add car'}</button>
    </form>`;
}

function itemForm(car, item) {
  const kind = item?.type || 'service';
  return `
    <form data-form="item" data-car="${car.id}" data-id="${item ? item.id : ''}" class="form">
      ${item ? '' : `<div class="chips">${PRESETS.map((p, i) => `<button type="button" class="chip" data-act="preset" data-i="${i}">${esc(p.name)}</button>`).join('')}</div>`}
      ${field('Name', `<input name="name" required maxlength="50" placeholder="e.g. Engine oil" value="${esc(item?.name)}" autocomplete="off">`)}
      ${field('Type', `<select name="kind"><option value="service" ${kind === 'service' ? 'selected' : ''}>Maintenance (by km / months)</option><option value="doc" ${kind === 'doc' ? 'selected' : ''}>Document (expires on a date)</option></select>`)}
      <div data-show="service" ${kind === 'service' ? '' : 'hidden'} class="grid">
        ${field('Every (km)', `<input name="km" type="number" inputmode="numeric" min="0" placeholder="5000" value="${item?.intervalKm ?? ''}">`)}
        ${field('Every (months)', `<input name="months" type="number" inputmode="numeric" min="0" placeholder="6" value="${item?.intervalMonths ?? ''}">`)}
        ${field('Last done (date)', `<input name="lastDate" type="date" value="${item?.lastDate ?? todayStr()}">`)}
        ${field('Last done (km)', `<input name="lastOdo" type="number" inputmode="numeric" min="0" value="${item?.lastOdo ?? car.odo}">`)}
        ${item?.dueDateOverride ? field('Valid until (override)', `<input name="override" type="date" value="${item.dueDateOverride}">`) : ''}
      </div>
      <div data-show="doc" ${kind === 'doc' ? '' : 'hidden'}>
        ${field('Expiry date', `<input name="dueDate" type="date" value="${item?.dueDate ?? ''}">`)}
      </div>
      ${field('Notes (optional)', `<textarea name="notes" rows="2" placeholder="e.g. 5W-30 synthetic">${esc(item?.notes)}</textarea>`)}
      <button class="btn primary block" type="submit">${item ? 'Save' : 'Add item'}</button>
    </form>`;
}

function logForm(item, car) {
  const doc = item.type === 'doc';
  return `
    <form data-form="log" data-id="${item.id}" class="form">
      <p class="muted">${esc(car.name)} &middot; ${esc(item.name)}</p>
      <div class="grid">
        ${field('Date', `<input name="date" type="date" required value="${todayStr()}">`)}
        ${field('Time', `<input name="time" type="time" value="${nowTime()}">`)}
        ${field(doc ? 'Odometer (optional)' : 'Odometer (km)', `<input name="odo" type="number" inputmode="numeric" min="0" ${doc ? '' : 'required'} value="${car.odo}">`)}
        ${field('Cost (SAR)', `<input name="cost" type="number" inputmode="decimal" min="0" step="any" placeholder="0">`)}
      </div>
      ${field(doc ? 'New expiry date' : 'Valid until (optional)', `<input name="expiry" type="date" ${doc ? 'required' : ''}>`,
        doc ? '' : 'Only fill this if the part or service has its own expiry date. Otherwise the next due date comes from the interval.')}
      ${field('Notes (optional)', `<textarea name="notes" rows="2" placeholder="Workshop, brand, details&hellip;"></textarea>`)}
      <button class="btn primary block" type="submit">${doc ? 'Save renewal' : 'Mark as done'}</button>
    </form>`;
}

function syncItemForm(form) {
  const kind = form.elements.kind.value;
  form.querySelectorAll('[data-show]').forEach((el) => { el.hidden = el.dataset.show !== kind; });
}

/* ---------- form submit handlers ---------- */

const forms = {
  car(fd, ds) {
    const name = fd.get('name').trim();
    const plate = fd.get('plate').trim();
    const odo = num(fd.get('odo'));
    if (!name) return toast('Enter a name');
    if (odo == null || odo < 0) return toast('Enter the current odometer');
    if (ds.id) {
      const c = S.car(ds.id);
      c.name = name; c.plate = plate;
      if (odo !== c.odo) setOdo(c, odo);
      S.save(); closeSheet(); render();
    } else {
      const c = { id: S.uid(), name, plate, odo, archived: false, createdAt: Date.now() };
      S.data.cars.push(c);
      S.data.odoLog.push({ carId: c.id, date: todayStr(), odo });
      S.save(); closeSheet();
      carTab = 'maintenance';
      location.hash = '#/car/' + c.id;
    }
  },

  odo(fd, ds) {
    const c = S.car(ds.id);
    const odo = num(fd.get('odo'));
    if (odo == null || odo < 0) return toast('Enter a valid odometer');
    if (odo < c.odo && !confirm(`That is lower than the current ${fmtNum(c.odo)} km. Use it anyway?`)) return;
    setOdo(c, odo);
    S.save(); closeSheet(); render();
    toast('Odometer updated');
  },

  item(fd, ds) {
    const name = fd.get('name').trim();
    const kind = fd.get('kind');
    if (!name) return toast('Enter a name');
    const car = S.car(ds.car);
    const base = { name, type: kind, notes: fd.get('notes').trim() };
    let fields;
    if (kind === 'doc') {
      const dueDate = fd.get('dueDate');
      if (!dueDate) return toast('Enter the expiry date');
      fields = { ...base, dueDate, intervalKm: null, intervalMonths: null, lastDate: null, lastOdo: null, dueDateOverride: null };
    } else {
      const km = num(fd.get('km')) || null;
      const months = num(fd.get('months')) || null;
      if (!km && !months) return toast('Set an interval in km, months, or both');
      const lastDate = fd.get('lastDate') || todayStr();
      const lastOdo = num(fd.get('lastOdo'));
      if (km && lastOdo == null) return toast('Enter the odometer at the last service');
      fields = {
        ...base, intervalKm: km, intervalMonths: months, lastDate, lastOdo, dueDate: null,
        dueDateOverride: fd.has('override') ? fd.get('override') || null : null,
      };
    }
    if (ds.id) Object.assign(S.item(ds.id), fields);
    else S.data.items.push({ id: S.uid(), carId: car.id, ...fields });
    S.save(); closeSheet(); render();
  },

  log(fd, ds) {
    const item = S.item(ds.id);
    const car = S.car(item.carId);
    const doc = item.type === 'doc';
    const date = fd.get('date');
    const odo = num(fd.get('odo'));
    const expiry = fd.get('expiry') || null;
    if (!date) return toast('Pick a date');
    if (!doc && odo == null) return toast('Enter the odometer');
    if (doc && !expiry) return toast('Enter the new expiry date');
    S.data.logs.push({
      id: S.uid(), carId: car.id, itemId: item.id, name: item.name, type: item.type,
      date, time: fd.get('time') || '', odo, cost: num(fd.get('cost')) || 0, expiry, notes: fd.get('notes').trim(),
    });
    if (doc) item.dueDate = expiry;
    else { item.lastDate = date; item.lastOdo = odo; item.dueDateOverride = expiry; }
    if (odo != null) {
      S.data.odoLog.push({ carId: car.id, date, odo });
      if (odo > car.odo) car.odo = odo;
    }
    S.save(); closeSheet(); render();
    toast(doc ? 'Renewal saved' : 'Logged');
  },

  quick(fd, ds) {
    const car = S.car(ds.id);
    const picked = fd.getAll('p').map(Number);
    if (!picked.length) return toast('Pick at least one item');
    picked.forEach((i) => {
      const p = PRESETS[i];
      S.data.items.push({
        id: S.uid(), carId: car.id, name: p.name, type: 'service', notes: '', dueDate: null, dueDateOverride: null,
        intervalKm: p.km, intervalMonths: p.months, lastDate: todayStr(), lastOdo: car.odo,
      });
    });
    S.save(); closeSheet(); render();
    toast(`${plural(picked.length, 'item')} added`);
  },
};

/* ---------- actions (click handlers) ---------- */

async function shareOrDownload(filename, text, type) {
  const file = new File([text], filename, { type });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file], title: filename }); return true; } catch (e) { if (e.name === 'AbortError') return false; }
  }
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return true;
}

const actions = {
  closeSheet,
  home() { location.hash = '#/'; },
  openSettings() { location.hash = '#/settings'; },
  openCar(d) { carTab = 'maintenance'; location.hash = '#/car/' + d.id; },
  tab(d) { carTab = d.tab; render(); },
  period(d) { costPeriod = d.p; render(); },

  addCar() { openSheet('Add car', carForm(null)); },

  updateOdo(d) {
    const c = S.car(d.id);
    openSheet('Update odometer', `
      <form data-form="odo" data-id="${c.id}" class="form">
        <p class="muted">${esc(c.name)} &middot; currently ${fmtNum(c.odo)} km</p>
        ${field('Odometer now (km)', `<input name="odo" type="number" inputmode="numeric" min="0" required value="${c.odo}" autofocus>`)}
        <button class="btn primary block" type="submit">Save</button>
      </form>`);
    const i = document.querySelector('.sheet input[name=odo]'); if (i) { i.focus(); i.select(); }
  },

  carMenu(d) {
    const c = S.car(d.id);
    openSheet(c.name, `
      <div class="stack">
        <button class="btn" data-act="editCar" data-id="${c.id}">Edit name, plate or odometer</button>
        <button class="btn" data-act="archiveCar" data-id="${c.id}">Archive car (keeps its history)</button>
        <button class="btn danger" data-act="deleteCar" data-id="${c.id}">Delete car and all its data</button>
      </div>`);
  },
  editCar(d) { openSheet('Edit car', carForm(S.car(d.id))); },
  archiveCar(d) {
    const c = S.car(d.id);
    if (!confirm(`Archive ${c.name}? It will disappear from the dashboard but you can restore it from Settings.`)) return;
    c.archived = true; S.save(); closeSheet(); location.hash = '#/';
  },
  restoreCar(d) { S.car(d.id).archived = false; S.save(); render(); toast('Car restored'); },
  deleteCar(d) {
    const c = S.car(d.id);
    if (!confirm(`Delete ${c.name} and ALL its items and history? This cannot be undone.`)) return;
    S.data.cars = S.data.cars.filter((x) => x.id !== c.id);
    S.data.items = S.data.items.filter((x) => x.carId !== c.id);
    S.data.logs = S.data.logs.filter((x) => x.carId !== c.id);
    S.data.odoLog = S.data.odoLog.filter((x) => x.carId !== c.id);
    S.save(); closeSheet(); location.hash = '#/';
  },

  addItem(d) { openSheet('Add item', itemForm(S.car(d.id), null)); },
  editItem(d) { const i = S.item(d.id); openSheet('Edit item', itemForm(S.car(i.carId), i)); },
  preset(d) {
    const p = PRESETS[Number(d.i)];
    const f = document.querySelector('form[data-form="item"]');
    f.elements.name.value = p.name;
    f.elements.kind.value = p.kind;
    if (p.kind === 'service') { f.elements.km.value = p.km ?? ''; f.elements.months.value = p.months ?? ''; }
    syncItemForm(f);
  },
  quickSetup(d) {
    openSheet('Quick setup', `
      <form data-form="quick" data-id="${d.id}" class="form">
        <p class="muted">Tick what this car uses. Each one starts counting from <b>today</b> at the current odometer &mdash; open an item later if you know the real last-service date.</p>
        <div class="checks">
          ${PRESETS.map((p, i) => p.kind === 'service' ? `
            <label class="check"><input type="checkbox" name="p" value="${i}" ${['Engine oil', 'Tires', 'Brake pads'].includes(p.name) ? 'checked' : ''}>
              <span>${esc(p.name)}<small>${[p.km ? 'every ' + fmtNum(p.km) + ' km' : '', p.months ? 'every ' + p.months + ' mo' : ''].filter(Boolean).join(' / ')}</small></span></label>` : '').join('')}
        </div>
        <button class="btn primary block" type="submit">Add selected</button>
      </form>`);
  },

  openItem(d) {
    const item = S.item(d.id);
    const car = S.car(item.carId);
    const st = itemStatus(item, car, S.data.odoLog);
    const recent = S.data.logs.filter((l) => l.itemId === item.id).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 3);
    const line = (k, v) => `<div class="kv"><span>${k}</span><b>${v}</b></div>`;
    openSheet(item.name, `
      <div class="stack">
        <div class="status-pill ${st.level}">${levelLabel[st.level]} &middot; ${esc(st.main)}${st.sub ? ' &middot; ' + esc(st.sub) : ''}</div>
        <div class="card kvs">
          ${line('Car', esc(car.name))}
          ${item.type === 'doc'
            ? line('Expires', item.dueDate ? fmtDate(item.dueDate) : '&ndash;')
            : `${line('Interval', [item.intervalKm ? fmtNum(item.intervalKm) + ' km' : '', item.intervalMonths ? item.intervalMonths + ' months' : ''].filter(Boolean).join(' / ') || '&ndash;')}
               ${line('Last done', item.lastDate ? fmtDate(item.lastDate) + (item.lastOdo != null ? ' &middot; ' + fmtNum(item.lastOdo) + ' km' : '') : '&ndash;')}
               ${line('Next due', [st.dueOdo != null ? fmtNum(st.dueOdo) + ' km' : '', st.dueDate ? fmtDate(st.dueDate) : ''].filter(Boolean).join(' / ') || '&ndash;')}`}
          ${item.notes ? line('Notes', esc(item.notes)) : ''}
        </div>
        ${recent.length ? `<div class="muted">Recent: ${recent.map((l) => fmtDate(l.date) + (l.cost ? ' (' + money(l.cost) + ')' : '')).join(', ')}</div>` : ''}
        <button class="btn primary block" data-act="logItem" data-id="${item.id}">${item.type === 'doc' ? 'Renew' : 'Mark as done'}</button>
        <div class="grid">
          <button class="btn" data-act="editItem" data-id="${item.id}">Edit</button>
          <button class="btn danger" data-act="deleteItem" data-id="${item.id}">Delete</button>
        </div>
      </div>`);
  },
  logItem(d) { const i = S.item(d.id); openSheet(i.type === 'doc' ? 'Renew document' : 'Mark as done', logForm(i, S.car(i.carId))); },
  deleteItem(d) {
    const i = S.item(d.id);
    if (!confirm(`Delete "${i.name}"? Its past history entries stay in the car's history.`)) return;
    S.data.items = S.data.items.filter((x) => x.id !== i.id);
    S.save(); closeSheet(); render();
  },

  openLog(d) {
    const l = S.log(d.id);
    const line = (k, v) => `<div class="kv"><span>${k}</span><b>${v}</b></div>`;
    openSheet(l.name, `
      <div class="stack">
        <div class="card kvs">
          ${line('Date', fmtDate(l.date) + (l.time ? ' &middot; ' + esc(l.time) : ''))}
          ${l.odo != null ? line('Odometer', fmtNum(l.odo) + ' km') : ''}
          ${l.cost ? line('Cost', money(l.cost)) : ''}
          ${l.expiry ? line('Valid until', fmtDate(l.expiry)) : ''}
          ${l.notes ? line('Notes', esc(l.notes)) : ''}
        </div>
        <button class="btn danger" data-act="deleteLog" data-id="${l.id}">Delete entry</button>
        <p class="muted">Deleting an entry does not change the item's current due date.</p>
      </div>`);
  },
  deleteLog(d) {
    if (!confirm('Delete this history entry?')) return;
    S.data.logs = S.data.logs.filter((x) => x.id !== d.id);
    S.save(); closeSheet(); render();
  },

  async exportJson() {
    const payload = JSON.stringify({ app: 'oil-be-back', version: 1, exportedAt: new Date().toISOString(), data: S.data }, null, 2);
    if (await shareOrDownload(`oil-be-back-backup-${todayStr()}.json`, payload, 'application/json')) {
      S.data.settings.lastBackup = Date.now(); S.save(); render(); toast('Backup saved');
    }
  },
  importJson() { document.getElementById('importFile').click(); },
  async exportCsv() {
    const q = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const rows = [['Car', 'Item', 'Date', 'Time', 'Odometer (km)', 'Cost (SAR)', 'Valid until', 'Notes']];
    [...S.data.logs].sort((a, b) => a.date.localeCompare(b.date)).forEach((l) =>
      rows.push([S.car(l.carId)?.name || '', l.name, l.date, l.time, l.odo ?? '', l.cost || '', l.expiry || '', l.notes]));
    await shareOrDownload(`oil-be-back-history-${todayStr()}.csv`, rows.map((r) => r.map(q).join(',')).join('\n'), 'text/csv');
  },
};

/* ---------- wiring ---------- */

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-act]');
  if (!el) return;
  const fn = actions[el.dataset.act];
  if (fn) fn(el.dataset, el);
});

document.addEventListener('submit', (e) => {
  const f = e.target.closest('form[data-form]');
  if (!f) return;
  e.preventDefault();
  forms[f.dataset.form](new FormData(f), f.dataset);
});

document.addEventListener('change', (e) => {
  if (e.target.matches('form[data-form="item"] select[name="kind"]')) syncItemForm(e.target.form);
  if (e.target.id === 'importFile' && e.target.files[0]) {
    const file = e.target.files[0];
    file.text().then((txt) => {
      try {
        const parsed = JSON.parse(txt);
        const d = parsed.data || parsed;
        if (!Array.isArray(d.cars) || !Array.isArray(d.items) || !Array.isArray(d.logs)) throw new Error('bad');
        if (!confirm(`Replace ALL current data with this backup (${plural(d.cars.length, 'car')})?`)) return;
        S.replaceAll(d);
        toast('Backup restored');
        render();
      } catch (err) { alert('That file is not a valid Oil-Be-Back backup.'); }
    });
    e.target.value = '';
  }
});

window.addEventListener('hashchange', () => { closeSheet(); render(); window.scrollTo(0, 0); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeSheet(); });

render();

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}
