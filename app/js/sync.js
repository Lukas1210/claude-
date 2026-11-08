// Synchronisation über Supabase (optional). Die App arbeitet immer lokal ("offline first");
// Änderungen werden im Hintergrund hochgeladen und die des Partners heruntergeladen.
import { dirtyItems, markClean, applyRemote, getDevice, setDevice, subscribe, get, update, nameOf, partner, me } from './store.js';
import { blobsDB, metaDB } from './db.js';
import { setRemoteFetcher } from './photos.js';
import { debounce } from './ui/dom.js';

const PAGE = 500;
const PUSH_BATCH = 200;
const statusListeners = new Set();
let status = { state: 'off', message: '', lastSync: null };
let backend = null;
let running = null;
let again = false;
let started = false;
let realtimeChannel = null;
let client = null;

// ---------- Status ----------
export const getStatus = () => status;
export function onStatus(fn) { statusListeners.add(fn); fn(status); return () => statusListeners.delete(fn); }
function setStatus(patch) {
  status = { ...status, ...patch };
  statusListeners.forEach((fn) => { try { fn(status); } catch {} });
}

// ---------- Konfiguration ----------
export function config() {
  const c = window.CJ_CONFIG || {};
  const d = getDevice();
  return { url: (d.supabaseUrl || c.supabaseUrl || '').trim().replace(/\/+$/, ''), key: (d.supabaseAnonKey || c.supabaseAnonKey || '').trim() };
}
export const isConfigured = () => { const c = config(); return !!(c.url && c.key); };

let libPromise;
function loadLib() {
  if (window.supabase?.createClient) return Promise.resolve(window.supabase);
  if (!libPromise) {
    libPromise = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'vendor/supabase.min.js';
      s.onload = () => resolve(window.supabase);
      s.onerror = () => { libPromise = null; reject(new Error('Sync-Bibliothek konnte nicht geladen werden')); };
      document.head.appendChild(s);
    });
  }
  return libPromise;
}

async function getClient() {
  if (client) return client;
  const { url, key } = config();
  const lib = await loadLib();
  client = lib.createClient(url, key, {
    auth: { persistSession: true, autoRefreshToken: true, storageKey: 'cj-auth', detectSessionInUrl: false },
    realtime: { params: { eventsPerSecond: 5 } },
  });
  return client;
}

/** Backend-Adapter für Supabase. Eine Fake-Variante mit derselben Form wird in den Tests benutzt. */
export function supabaseBackend(c) {
  const bucket = () => c.storage.from('photos');
  const q = (v) => `"${v}"`;
  return {
    async userId() {
      const { data } = await c.auth.getSession();
      return data.session?.user?.id || null;
    },
    async push(rows) {
      const { data, error } = await c.from('items').upsert(rows, { onConflict: 'id' }).select('id, updated_at');
      if (error) throw error;
      return data;
    },
    async pull(afterTs, afterId, limit) {
      let query = c.from('items').select('*').order('updated_at', { ascending: true }).order('id', { ascending: true }).limit(limit);
      if (afterTs && afterId) query = query.or(`updated_at.gt.${q(afterTs)},and(updated_at.eq.${q(afterTs)},id.gt.${afterId})`);
      else if (afterTs) query = query.gt('updated_at', afterTs);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    async uploadPhoto(id, size, blob) {
      const { error } = await bucket().upload(`${id}/${size}.jpg`, blob, { upsert: true, contentType: 'image/jpeg', cacheControl: '31536000' });
      if (error) throw error;
    },
    async downloadPhoto(id, size) {
      const { data, error } = await bucket().download(`${id}/${size}.jpg`);
      if (error) return null;
      return data;
    },
    async removePhoto(id) {
      await bucket().remove([`${id}/full.jpg`, `${id}/thumb.jpg`]);
    },
  };
}

// ---------- Mapping lokal <-> Server ----------
const toRow = (it) => ({
  id: it.id,
  type: it.type,
  data: it.data,
  deleted: !!it.deleted,
  created_by: it.createdBy || null,
  created_at: it.createdAt,
  client_updated_at: it.updatedAt,
});
const fromRow = (r) => ({
  id: r.id,
  type: r.type,
  data: r.data || {},
  deleted: !!r.deleted,
  createdBy: r.created_by,
  createdAt: r.created_at,
  updatedAt: r.client_updated_at || r.updated_at,
  serverUpdatedAt: r.updated_at,
  updatedBy: r.updated_by || null,
});
const msTs = (ts) => Date.parse(String(ts).replace(/(\.\d{3})\d+/, '$1'));

// ---------- Kern-Ablauf ----------
async function uploadPendingPhotos(be) {
  const pending = dirtyItems().filter((it) => it.type === 'photo' && !it.deleted && !it.data.uploaded);
  for (const it of pending) {
    const full = await blobsDB.get(`${it.id}:full`);
    const thumb = await blobsDB.get(`${it.id}:thumb`);
    if (!full || !thumb) continue; // Foto stammt nicht von diesem Gerät
    await be.uploadPhoto(it.id, 'thumb', thumb);
    await be.uploadPhoto(it.id, 'full', full);
    const cur = get(it.id);
    if (cur) await update(it.id, { uploaded: true });
  }
}

async function pushItems(be) {
  const dirty = dirtyItems();
  for (let i = 0; i < dirty.length; i += PUSH_BATCH) {
    const batch = dirty.slice(i, i + PUSH_BATCH);
    const res = await be.push(batch.map(toRow));
    const times = Object.fromEntries((res || []).map((r) => [r.id, r.updated_at]));
    // Nur als sauber markieren, wenn sich der Eintrag während des Uploads nicht erneut geändert hat
    const unchanged = batch.filter((b) => {
      const now = dirtyItems().find((d) => d.id === b.id);
      return now && now.updatedAt === b.updatedAt;
    }).map((b) => b.id);
    await markClean(unchanged, times);
    for (const it of batch) {
      if (it.type === 'photo' && it.deleted) { try { await be.removePhoto(it.id); } catch {} }
    }
  }
  return dirty.length;
}

async function pullItems(be, myId) {
  const cursor = await metaDB.get('syncCursor', null);
  let afterTs = cursor ? new Date(msTs(cursor) - 10000).toISOString() : null;
  let afterId = null;
  let maxTs = cursor;
  const fromPartner = [];
  for (;;) {
    const rows = await be.pull(afterTs, afterId, PAGE);
    if (!rows || !rows.length) break;
    const changed = await applyRemote(rows.map(fromRow));
    const changedIds = new Set(changed.map((c) => c.id));
    for (const r of rows) {
      if (changedIds.has(r.id) && myId && r.updated_by && r.updated_by !== myId && !r.deleted) fromPartner.push(r);
      if (!maxTs || msTs(r.updated_at) >= msTs(maxTs)) maxTs = r.updated_at;
    }
    const last = rows[rows.length - 1];
    afterTs = last.updated_at;
    afterId = last.id;
    if (rows.length < PAGE) break;
  }
  if (maxTs) await metaDB.set('syncCursor', maxTs);
  return fromPartner;
}

/** Ein kompletter Sync-Durchlauf mit beliebigem Backend (für Tests exportiert). */
export async function syncWith(be) {
  const myId = await be.userId();
  if (!myId) throw Object.assign(new Error('Nicht angemeldet'), { code: 'auth' });
  await uploadPendingPhotos(be);
  const pushed = await pushItems(be);
  const fromPartner = await pullItems(be, myId);
  return { pushed, fromPartner };
}

function friendlyError(e) {
  const msg = String(e?.message || e || '');
  if (e?.code === 'auth') return 'Nicht angemeldet';
  if (/row-level security|permission denied|42501/i.test(msg)) return 'Kein Zugriff – ist dein Konto in der Tabelle „members“ eingetragen?';
  if (/JWT|token/i.test(msg)) return 'Anmeldung abgelaufen – bitte neu anmelden';
  if (/Failed to fetch|NetworkError|Load failed|network/i.test(msg)) return 'Keine Verbindung';
  if (/relation .* does not exist|42P01/i.test(msg)) return 'Datenbank nicht eingerichtet – setup.sql ausführen';
  return msg || 'Unbekannter Fehler';
}

export async function syncNow({ silent = false } = {}) {
  if (!backend) return;
  if (running) { again = true; return running; }
  if (!navigator.onLine) { setStatus({ state: 'offline', message: 'Offline – Änderungen werden später übertragen' }); return; }
  setStatus({ state: 'busy', message: 'Synchronisiere …' });
  running = (async () => {
    try {
      const { fromPartner } = await syncWith(backend);
      setStatus({ state: 'idle', message: 'Alles synchronisiert', lastSync: new Date().toISOString() });
      await metaDB.set('lastSync', status.lastSync);
      const interesting = fromPartner.filter((r) => ['entry', 'milestone', 'letter', 'wish'].includes(r.type));
      const photos = fromPartner.filter((r) => r.type === 'photo').length;
      if (!silent && (interesting.length || photos)) {
        const { toast } = await import('./ui/sheet.js');
        const letter = interesting.find((r) => r.type === 'letter' && r.data?.to === me());
        const who = nameOf(partner());
        if (letter) toast(`${who} hat dir einen Liebesbrief geschrieben`, { emoji: '💌', duration: 4000 });
        else if (interesting.length) toast(`${who} hat etwas Neues hinzugefügt ♡`, { emoji: '✨', duration: 3500 });
        else toast(`${who} hat ${photos === 1 ? 'ein Foto' : `${photos} Fotos`} hinzugefügt`, { emoji: '📸', duration: 3500 });
      }
    } catch (e) {
      console.warn('Sync-Fehler', e);
      setStatus({ state: 'error', message: friendlyError(e) });
      if (e?.code === 'auth') stopRealtime();
    } finally {
      running = null;
      if (again) { again = false; setTimeout(() => syncNow({ silent }), 300); }
    }
  })();
  return running;
}

function startRealtime(c) {
  if (realtimeChannel) return;
  realtimeChannel = c.channel('items-changes')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'items' }, () => scheduleSync())
    .subscribe();
}
function stopRealtime() {
  if (realtimeChannel && client) { client.removeChannel(realtimeChannel); }
  realtimeChannel = null;
}

const scheduleSync = debounce(() => syncNow(), 1500);

async function startEngine() {
  const c = await getClient();
  backend = supabaseBackend(c);
  setRemoteFetcher((id, size) => backend.downloadPhoto(id, size));
  const uid = await backend.userId();
  if (!uid) { setStatus({ state: 'loggedout', message: 'Nicht angemeldet' }); return false; }
  const lastSync = await metaDB.get('lastSync', null);
  setStatus({ state: 'idle', message: '', lastSync });
  startRealtime(c);
  if (!started) {
    started = true;
    subscribe((evt) => { if (evt.source === 'local' && backend) scheduleSync(); });
    document.addEventListener('visibilitychange', () => { if (!document.hidden && backend) syncNow(); });
    window.addEventListener('online', () => backend && syncNow());
    setInterval(() => { if (!document.hidden && backend) syncNow({ silent: false }); }, 3 * 60 * 1000);
  }
  syncNow();
  return true;
}

/** Beim App-Start aufrufen. */
export async function initSync() {
  if (!isConfigured()) { setStatus({ state: 'off', message: 'Sync nicht eingerichtet' }); return; }
  try {
    await startEngine();
  } catch (e) {
    setStatus({ state: 'error', message: friendlyError(e) });
  }
}

export async function currentUser() {
  if (!isConfigured()) return null;
  try {
    const c = await getClient();
    const { data } = await c.auth.getSession();
    return data.session?.user || null;
  } catch { return null; }
}

export async function login(email, password) {
  const c = await getClient();
  const { error } = await c.auth.signInWithPassword({ email: email.trim(), password });
  if (error) throw new Error(/Invalid login/i.test(error.message) ? 'E-Mail oder Passwort falsch' : error.message);
  await startEngine();
  await (running || Promise.resolve());
  return true;
}

export async function logout() {
  stopRealtime();
  if (client) await client.auth.signOut().catch(() => {});
  backend = null;
  await metaDB.delete('syncCursor');
  setStatus({ state: 'loggedout', message: 'Abgemeldet' });
}

/** Zugangsdaten auf diesem Gerät ändern (Alternative zu config.js). */
export async function setCredentials(url, key) {
  stopRealtime();
  client = null;
  backend = null;
  await setDevice({ supabaseUrl: url.trim(), supabaseAnonKey: key.trim() });
  await metaDB.delete('syncCursor');
  await initSync();
}

/** Für den Fall, dass vollständig neu geladen werden soll. */
export async function resetCursor() {
  await metaDB.delete('syncCursor');
}
