const STORAGE_KEY = 'linak_scan_history_v1';
const MAX_ITEMS = 100;

/**
 * @typedef {Object} HistoryEntry
 * @property {string} id
 * @property {number} timestamp
 * @property {string} model
 * @property {string|null} typeCode
 * @property {number|null} strokeMm
 * @property {import('./decoders/engine.js').MotorSpecs} specs
 */

function loadAll() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveAll(items) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(0, MAX_ITEMS)));
}

/**
 * @param {import('./decoders/engine.js').MotorSpecs} specs
 */
export function addToHistory(specs) {
  const items = loadAll();
  const entry = {
    id: crypto.randomUUID(),
    timestamp: Date.now(),
    model: specs.model || 'Unknown',
    typeCode: specs.typeCode,
    strokeMm: specs.strokeMm,
    specs,
  };
  items.unshift(entry);
  saveAll(items);
  return entry;
}

export function getHistory() {
  return loadAll();
}

export function getHistoryEntry(id) {
  return loadAll().find((e) => e.id === id) ?? null;
}

export function deleteHistoryEntry(id) {
  saveAll(loadAll().filter((e) => e.id !== id));
}

export function clearHistory() {
  localStorage.removeItem(STORAGE_KEY);
}
