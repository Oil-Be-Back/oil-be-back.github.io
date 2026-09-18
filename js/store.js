// Local storage layer. Everything lives under a single, prefixed key so the
// app never touches anything else on the same origin.
const KEY = 'obb.data.v1';

const empty = () => ({ cars: [], items: [], logs: [], odoLog: [], settings: {} });

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...empty(), ...JSON.parse(raw) };
  } catch (e) { /* fall through to empty */ }
  return empty();
}

export let data = load();

export function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
    return true;
  } catch (e) {
    alert('Could not save your data. Storage may be full or blocked.');
    return false;
  }
}

export function replaceAll(next) {
  data = { ...empty(), ...next };
  save();
}

export function uid() {
  return (crypto.randomUUID && crypto.randomUUID()) || 'id' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export const car = (id) => data.cars.find((c) => c.id === id);
export const item = (id) => data.items.find((i) => i.id === id);
export const log = (id) => data.logs.find((l) => l.id === id);
