// Pure helpers: dates, formatting and the due-status maths.

export const DEFAULT_RATE = 40; // km/day, used only until we can learn the real rate

export const PRESETS = [
  { name: 'Engine oil', kind: 'service', km: 5000, months: 6 },
  { name: 'Transmission oil', kind: 'service', km: 40000, months: 24 },
  { name: 'Differential / transfer case oil', kind: 'service', km: 40000, months: 24 },
  { name: 'Brake pads', kind: 'service', km: 30000, months: null },
  { name: 'Brake fluid', kind: 'service', km: null, months: 24 },
  { name: 'Coolant / radiator water', kind: 'service', km: 40000, months: 24 },
  { name: 'Tires', kind: 'service', km: 40000, months: 60 },
  { name: 'Battery', kind: 'service', km: null, months: 48 },
  { name: 'Air filter', kind: 'service', km: 15000, months: 12 },
  { name: 'Cabin / AC filter', kind: 'service', km: 15000, months: 12 },
  { name: 'Spark plugs', kind: 'service', km: 40000, months: null },
  { name: 'Wiper blades', kind: 'service', km: null, months: 12 },
  { name: 'Insurance', kind: 'doc' },
  { name: 'Registration', kind: 'doc' },
  { name: 'Periodic inspection', kind: 'doc' },
];

export const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const fmtNum = (n) => Math.round(n).toLocaleString('en-US');
export const money = (n) => 'SAR ' + Number(n).toLocaleString('en-US', { maximumFractionDigits: 2 });
export const plural = (n, w) => `${fmtNum(n)} ${w}${n === 1 ? '' : 's'}`;

const pad = (n) => String(n).padStart(2, '0');
export const todayStr = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const nowTime = () => { const d = new Date(); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
export const parseDate = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const startOfToday = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
export const daysBetween = (a, b) => Math.round((b - a) / 86400000);

export function fmtDate(v) {
  const d = typeof v === 'string' ? parseDate(v) : v;
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function addMonths(d, n) {
  const r = new Date(d);
  const day = r.getDate();
  r.setDate(1);
  r.setMonth(r.getMonth() + n);
  const last = new Date(r.getFullYear(), r.getMonth() + 1, 0).getDate();
  r.setDate(Math.min(day, last));
  return r;
}

// Average km/day for a car, learned from its odometer history (last 12 months).
export function kmPerDay(odoLog, carId) {
  const pts = odoLog
    .filter((p) => p.carId === carId)
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.odo - b.odo));
  const cutoff = todayStr(new Date(Date.now() - 365 * 86400000));
  const recent = pts.filter((p) => p.date >= cutoff);
  if (recent.length < 2) return null;
  const first = recent[0];
  const last = recent[recent.length - 1];
  const days = daysBetween(parseDate(first.date), parseDate(last.date));
  const km = last.odo - first.odo;
  if (days < 14 || km <= 0) return null;
  return km / days;
}

export function itemStatus(item, car, odoLog) {
  const t = startOfToday();
  let dueDate = null, dueOdo = null, kmLeft = null;

  if (item.type === 'doc') {
    if (item.dueDate) dueDate = parseDate(item.dueDate);
  } else {
    if (item.dueDateOverride) dueDate = parseDate(item.dueDateOverride);
    else if (item.intervalMonths && item.lastDate) dueDate = addMonths(parseDate(item.lastDate), item.intervalMonths);
    if (item.intervalKm && item.lastOdo != null) {
      dueOdo = item.lastOdo + item.intervalKm;
      kmLeft = dueOdo - car.odo;
    }
  }

  const daysLeft = dueDate ? daysBetween(t, dueDate) : null;
  const rate = kmPerDay(odoLog, car.id);
  const rateKnown = rate != null;
  const kmDays = kmLeft != null ? Math.round(kmLeft / (rate || DEFAULT_RATE)) : null;

  const parts = [];
  if (kmLeft != null) {
    const n = fmtNum(Math.abs(kmLeft));
    parts.push({
      eff: kmDays,
      text: kmLeft < 0 ? `Overdue by ${n} km` : `${n} km left${rateKnown && kmDays > 0 ? ` (~${kmDays} d)` : ''}`,
    });
  }
  if (daysLeft != null) {
    let text;
    if (daysLeft < 0) text = item.type === 'doc' ? `Expired ${plural(-daysLeft, 'day')} ago` : `Overdue by ${plural(-daysLeft, 'day')}`;
    else if (daysLeft === 0) text = item.type === 'doc' ? 'Expires today' : 'Due today';
    else if (daysLeft > 90) text = `${item.type === 'doc' ? 'Expires' : 'Due'} ${fmtDate(dueDate)}`;
    else text = `${plural(daysLeft, 'day')} left · ${fmtDate(dueDate)}`;
    parts.push({ eff: daysLeft, text });
  }
  parts.sort((a, b) => a.eff - b.eff);

  let level = 'unset';
  if (parts.length) {
    const overdue = (kmLeft != null && kmLeft < 0) || (daysLeft != null && daysLeft < 0);
    const kmSoon = kmLeft != null && (kmLeft <= Math.max(500, 0.1 * item.intervalKm) || (rateKnown && kmDays <= 30));
    const dateSoon = daysLeft != null && daysLeft <= 30;
    level = overdue ? 'overdue' : kmSoon || dateSoon ? 'soon' : 'ok';
  }

  // How much of the interval has been used up (0 = just serviced, 1 = due, >1 = overdue).
  let progress = null;
  if (item.type !== 'doc') {
    if (kmLeft != null) progress = Math.max(0, (car.odo - item.lastOdo) / item.intervalKm);
    if (dueDate && item.lastDate) {
      const start = parseDate(item.lastDate);
      const total = daysBetween(start, dueDate);
      if (total > 0) {
        const used = Math.max(0, daysBetween(start, t) / total);
        progress = progress == null ? used : Math.max(progress, used);
      }
    }
  }

  return {
    level, progress,
    eff: parts.length ? parts[0].eff : Infinity,
    dueDate, dueOdo, kmLeft, daysLeft, rateKnown,
    main: parts[0] ? parts[0].text : 'Not set up',
    sub: parts[1] ? parts[1].text : '',
  };
}

// Spending summary over a list of history entries. period: 'year' | '12m' | 'all'.
export function costSummary(logs, period) {
  const now = new Date();
  const year = String(now.getFullYear());
  const cutoff12 = todayStr(new Date(now.getTime() - 365 * 86400000));
  const cutoff30 = todayStr(new Date(now.getTime() - 30 * 86400000));
  const sum = (arr) => arr.reduce((s, l) => s + (l.cost || 0), 0);

  const inPeriod = logs.filter((l) => period === 'all' || (period === 'year' ? l.date.startsWith(year) : l.date >= cutoff12));

  const byName = new Map();
  inPeriod.forEach((l) => { if (l.cost) byName.set(l.name, (byName.get(l.name) || 0) + l.cost); });
  const total = sum(inPeriod);
  const types = [...byName].map(([name, amount]) => ({ name, amount, pct: total ? (amount / total) * 100 : 0 }))
    .sort((a, b) => b.amount - a.amount);

  const months = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
    months.push({ key, label: d.toLocaleString('en-GB', { month: 'short' }), amount: sum(logs.filter((l) => l.date.startsWith(key))) });
  }

  return {
    total, types, months,
    last30: sum(logs.filter((l) => l.date >= cutoff30)),
    missing: inPeriod.filter((l) => !l.cost).length,
    count: inPeriod.length,
  };
}

export function carRows(data, car) {
  return data.items
    .filter((i) => i.carId === car.id)
    .map((item) => ({ item, car, st: itemStatus(item, car, data.odoLog) }))
    .sort((a, b) => a.st.eff - b.st.eff);
}

export function allRows(data) {
  return data.cars.filter((c) => !c.archived).flatMap((c) => carRows(data, c)).sort((a, b) => a.st.eff - b.st.eff);
}

export function countLevels(rows) {
  const n = { overdue: 0, soon: 0, ok: 0, unset: 0 };
  rows.forEach((r) => n[r.st.level]++);
  return n;
}
