// Datenhaltung: alle Einträge liegen im Speicher (Map) und in IndexedDB.
// Jede lokale Änderung wird als "dirty" markiert und später vom Sync hochgeladen.
import { itemsDB, metaDB } from './db.js';

const items = new Map();
const listeners = new Set();
let device = { me: 'a', onboarded: false };

export const uuid = () =>
  (crypto.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  }));

export async function loadStore() {
  const all = await itemsDB.all();
  items.clear();
  all.forEach((it) => items.set(it.id, it));
  device = { ...device, ...(await metaDB.get('device', {})) };
}

// ---------- Geräte-Einstellungen (nicht synchronisiert) ----------
export const getDevice = () => device;
export async function setDevice(patch) {
  device = { ...device, ...patch };
  await metaDB.set('device', device);
  emit({ ids: [], types: ['device'], source: 'local' });
}
export const me = () => device.me || 'a';
export const partner = () => (me() === 'a' ? 'b' : 'a');

// ---------- Events ----------
export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
function emit(evt) {
  listeners.forEach((fn) => {
    try { fn(evt); } catch (e) { console.error(e); }
  });
}

// ---------- Lesen ----------
export const get = (id) => {
  const it = items.get(id);
  return it && !it.deleted ? it : null;
};
export const getRaw = (id) => items.get(id) || null;

export function all(type) {
  const out = [];
  for (const it of items.values()) {
    if (!it.deleted && (!type || it.type === type)) out.push(it);
  }
  return out;
}

export const allRaw = () => Array.from(items.values());

// ---------- Schreiben ----------
export async function save(type, data, { id } = {}) {
  const now = new Date().toISOString();
  const existing = id ? items.get(id) : null;
  const item = existing
    ? { ...existing, data: { ...data }, updatedAt: now, dirty: 1, deleted: false }
    : { id: id || uuid(), type, data: { ...data }, createdAt: now, updatedAt: now, createdBy: me(), deleted: false, dirty: 1 };
  items.set(item.id, item);
  await itemsDB.put(item);
  emit({ ids: [item.id], types: [type], source: 'local' });
  return item;
}

export async function update(id, patch) {
  const it = items.get(id);
  if (!it) throw new Error('Eintrag nicht gefunden');
  return save(it.type, { ...it.data, ...patch }, { id });
}

/** Mehrere Einträge auf einmal speichern (z. B. Fotos). */
export async function saveMany(list) {
  const now = new Date().toISOString();
  const out = list.map(({ type, data, id }) => {
    const existing = id ? items.get(id) : null;
    return existing
      ? { ...existing, data: { ...data }, updatedAt: now, dirty: 1, deleted: false }
      : { id: id || uuid(), type, data: { ...data }, createdAt: now, updatedAt: now, createdBy: me(), deleted: false, dirty: 1 };
  });
  out.forEach((it) => items.set(it.id, it));
  await itemsDB.putMany(out);
  emit({ ids: out.map((i) => i.id), types: [...new Set(out.map((i) => i.type))], source: 'local' });
  return out;
}

export async function remove(id) {
  const it = items.get(id);
  if (!it) return;
  const next = { ...it, deleted: true, updatedAt: new Date().toISOString(), dirty: 1 };
  items.set(id, next);
  await itemsDB.put(next);
  emit({ ids: [id], types: [it.type], source: 'local' });
}

// ---------- Für den Sync ----------
export const dirtyItems = () => allRaw().filter((it) => it.dirty);

export async function markClean(ids, serverTimes = {}) {
  const changed = [];
  for (const id of ids) {
    const it = items.get(id);
    if (!it) continue;
    const next = { ...it, dirty: 0 };
    if (serverTimes[id]) next.serverUpdatedAt = serverTimes[id];
    items.set(id, next);
    changed.push(next);
  }
  if (changed.length) await itemsDB.putMany(changed);
}

/** Änderungen vom Server übernehmen. Lokale, noch nicht hochgeladene Änderungen bleiben erhalten. */
export async function applyRemote(remoteItems) {
  const changed = [];
  for (const r of remoteItems) {
    const local = items.get(r.id);
    if (local && local.dirty && new Date(local.updatedAt) > new Date(r.updatedAt)) continue;
    // Bereits bekannter Stand (z. B. durch das Überlappungsfenster beim Abholen) -> nichts zu tun
    if (local && !local.dirty && r.serverUpdatedAt && local.serverUpdatedAt === r.serverUpdatedAt) continue;
    const next = { ...r, dirty: 0 };
    items.set(r.id, next);
    changed.push(next);
  }
  if (changed.length) {
    await itemsDB.putMany(changed);
    emit({ ids: changed.map((i) => i.id), types: [...new Set(changed.map((i) => i.type))], source: 'remote', items: changed });
  }
  return changed;
}

/** Backup-Import: Einträge übernehmen (gleiche IDs werden überschrieben, andere bleiben). */
export async function importItems(list) {
  const now = new Date().toISOString();
  const out = list.filter((it) => it && it.id && it.type).map((it) => ({ ...it, updatedAt: now, dirty: 1 }));
  out.forEach((it) => items.set(it.id, it));
  await itemsDB.putMany(out);
  emit({ ids: out.map((i) => i.id), types: ['*'], source: 'local' });
  return out.length;
}

/** Alles als dirty markieren (z. B. nach erstem Login mit vorhandenen lokalen Daten). */
export async function markAllDirty() {
  const list = allRaw().map((it) => ({ ...it, dirty: 1 }));
  list.forEach((it) => items.set(it.id, it));
  await itemsDB.putMany(list);
}

// ---------- Paar-Einstellungen (synchronisiert, feste ID) ----------
export const SETTINGS_ID = '00000000-0000-4000-8000-00000000c0de';
const DEFAULT_SETTINGS = {
  names: { a: 'Ich', b: 'Du' },
  startDate: null,
  birthdays: { a: null, b: null },
  home: null,
  anniversaries: [],
};

export function settings() {
  const it = items.get(SETTINGS_ID);
  const d = it && !it.deleted ? it.data : {};
  return {
    ...DEFAULT_SETTINGS,
    ...d,
    names: { ...DEFAULT_SETTINGS.names, ...(d.names || {}) },
    birthdays: { ...DEFAULT_SETTINGS.birthdays, ...(d.birthdays || {}) },
  };
}

export async function saveSettings(patch) {
  const cur = settings();
  return save('settings', { ...cur, ...patch }, { id: SETTINGS_ID });
}

export const names = () => settings().names;
export const nameOf = (slot) => names()[slot] || (slot === 'a' ? 'Ich' : 'Du');
