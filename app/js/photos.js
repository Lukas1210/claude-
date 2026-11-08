// Fotos: Komprimieren, lokal speichern, anzeigen (lazy) und bei Bedarf aus der Cloud laden.
import { blobsDB } from './db.js';
import { uuid, saveMany, remove, get, all } from './store.js';
import { readExif } from './exif.js';
import { isoDate, entryDate } from './model.js';

const FULL_MAX = 2048;
const THUMB_MAX = 560;
const urlCache = new Map();
const inflight = new Map();
let remoteFetcher = null;

/** Wird vom Sync gesetzt: async (id, size) => Blob | null */
export function setRemoteFetcher(fn) { remoteFetcher = fn; }

const key = (id, size) => `${id}:${size}`;

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => resolve({ img, url });
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Bild konnte nicht gelesen werden')); };
    img.src = url;
  });
}

function resize(img, max, quality) {
  const w0 = img.naturalWidth, h0 = img.naturalHeight;
  const scale = Math.min(1, max / Math.max(w0, h0));
  const w = Math.max(1, Math.round(w0 * scale)), h = Math.max(1, Math.round(h0 * scale));
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, w, h);
  return new Promise((resolve) => c.toBlob((b) => {
    c.width = c.height = 0; // Speicher auf iOS sofort freigeben
    resolve({ blob: b, w, h });
  }, 'image/jpeg', quality));
}

/**
 * Bilddateien verarbeiten und lokal ablegen (noch ohne Eintrag in der Datenbank).
 * Liefert "pending"-Fotos: [{ id, data }]
 */
export async function processFiles(files, { onProgress } = {}) {
  const out = [];
  const list = Array.from(files || []);
  for (let i = 0; i < list.length; i++) {
    const file = list[i];
    try {
      const exif = await readExif(file);
      const { img, url } = await loadImage(file);
      const full = await resize(img, FULL_MAX, 0.82);
      const thumb = await resize(img, THUMB_MAX, 0.78);
      URL.revokeObjectURL(url);
      const id = uuid();
      await blobsDB.put(key(id, 'full'), full.blob);
      await blobsDB.put(key(id, 'thumb'), thumb.blob);
      urlCache.set(key(id, 'thumb'), URL.createObjectURL(thumb.blob));
      out.push({
        id,
        data: {
          takenAt: exif.date || isoDate(new Date(file.lastModified || Date.now())),
          exifDate: !!exif.date,
          gps: exif.gps || null,
          w: full.w,
          h: full.h,
          caption: '',
          favorite: false,
          entryId: null,
          uploaded: false,
        },
      });
    } catch (e) {
      console.warn('Foto übersprungen', e);
    }
    onProgress && onProgress(i + 1, list.length);
  }
  return out;
}

/** Verarbeitete Fotos speichern und optional einem Eintrag zuordnen. */
export async function commitPhotos(pending, entryId = null, fallbackDate = null) {
  if (!pending.length) return [];
  return saveMany(pending.map((p) => ({
    id: p.id,
    type: 'photo',
    // Ohne EXIF-Datum übernimmt das Foto das Datum des Erlebnisses (für die Galerie)
    data: { ...p.data, entryId, takenAt: !p.data.exifDate && fallbackDate ? fallbackDate : p.data.takenAt },
  })));
}

/** Nicht gespeicherte Fotos wieder verwerfen. */
export async function discardPending(pending) {
  for (const p of pending) {
    await blobsDB.delete(key(p.id, 'full'));
    await blobsDB.delete(key(p.id, 'thumb'));
    const u = urlCache.get(key(p.id, 'thumb'));
    if (u) URL.revokeObjectURL(u);
    urlCache.delete(key(p.id, 'thumb'));
  }
}

export async function deletePhotos(ids) {
  for (const id of ids) {
    await remove(id);
    await blobsDB.delete(key(id, 'full'));
    await blobsDB.delete(key(id, 'thumb'));
  }
}

export async function getBlob(id, size = 'thumb') {
  let b = await blobsDB.get(key(id, size));
  if (!b && remoteFetcher) {
    try {
      b = await remoteFetcher(id, size);
      if (b) await blobsDB.put(key(id, size), b);
    } catch (e) {
      console.warn('Foto-Download fehlgeschlagen', e);
    }
  }
  if (!b && size === 'full') return getBlob(id, 'thumb');
  return b || null;
}

export async function photoUrl(id, size = 'thumb') {
  const k = key(id, size);
  if (urlCache.has(k)) return urlCache.get(k);
  if (inflight.has(k)) return inflight.get(k);
  const p = getBlob(id, size).then((b) => {
    inflight.delete(k);
    if (!b) return null;
    const u = URL.createObjectURL(b);
    urlCache.set(k, u);
    // Vollbilder nicht unbegrenzt im Speicher halten
    if (size === 'full') {
      const fulls = [...urlCache.keys()].filter((x) => x.endsWith(':full'));
      if (fulls.length > 12) {
        const old = fulls[0];
        URL.revokeObjectURL(urlCache.get(old));
        urlCache.delete(old);
      }
    }
    return u;
  });
  inflight.set(k, p);
  return p;
}

export const hasLocal = async (id, size = 'thumb') => !!(await blobsDB.get(key(id, size)));

// ---------- Lazy-Loading für <img data-photo="id" data-size="thumb"> ----------
let io;
function loadImg(img) {
  if (img.dataset.hyd) return;
  img.dataset.hyd = '1';
  const wrap = img.closest('.ph-wrap');
  wrap && wrap.classList.add('loading');
  photoUrl(img.dataset.photo, img.dataset.size || 'thumb').then((u) => {
    wrap && wrap.classList.remove('loading');
    if (!u) { img.dataset.missing = '1'; return; }
    img.onload = () => img.classList.add('loaded');
    img.src = u;
  });
}

export function hydrate(root = document) {
  const imgs = root.querySelectorAll('img[data-photo]:not([data-hyd])');
  if (!imgs.length) return;
  if (!('IntersectionObserver' in window)) { imgs.forEach(loadImg); return; }
  if (!io) {
    io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) { io.unobserve(e.target); loadImg(e.target); }
      });
    }, { rootMargin: '400px 0px' });
  }
  imgs.forEach((img) => {
    const k = key(img.dataset.photo, img.dataset.size || 'thumb');
    if (urlCache.has(k)) {
      img.dataset.hyd = '1';
      img.src = urlCache.get(k);
      img.classList.add('loaded');
    } else io.observe(img);
  });
}

// ---------- Abfragen ----------
export function photosOf(entry) {
  const ids = entry?.data?.photoIds || [];
  return ids.filter((id) => get(id));
}

export function coverOf(entry) {
  const ids = photosOf(entry);
  if (entry?.data?.coverId && ids.includes(entry.data.coverId)) return entry.data.coverId;
  return ids[0] || null;
}

/** Alle Fotos, neueste zuerst. */
export function allPhotos() {
  return all('photo').sort((a, b) => String(b.data.takenAt || entryDate(b)).localeCompare(String(a.data.takenAt || entryDate(a))) || String(b.createdAt).localeCompare(String(a.createdAt)));
}

export async function sharePhoto(id) {
  const blob = await getBlob(id, 'full');
  if (!blob) return false;
  const file = new File([blob], `couple-journal-${id.slice(0, 8)}.jpg`, { type: 'image/jpeg' });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file] }); return true; } catch { return false; }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = file.name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  return true;
}
