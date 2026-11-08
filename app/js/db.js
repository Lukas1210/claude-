// Minimaler IndexedDB-Wrapper. Stores: items (Daten), blobs (Fotos), meta (Geräte-Einstellungen).

const DB_NAME = 'couple-journal';
const DB_VERSION = 1;
let dbPromise;

export function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('items')) db.createObjectStore('items', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('blobs')) db.createObjectStore('blobs');
      if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta');
    };
    req.onsuccess = () => {
      const db = req.result;
      db.onversionchange = () => db.close();
      resolve(db);
    };
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error('IndexedDB blockiert'));
  });
  return dbPromise;
}

function reqP(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function run(storeName, mode, fn) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, mode);
    const store = tx.objectStore(storeName);
    let result;
    Promise.resolve(fn(store)).then((r) => { result = r; }, reject);
    tx.oncomplete = () => resolve(result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error('Transaktion abgebrochen'));
  });
}

export const itemsDB = {
  all: () => run('items', 'readonly', (s) => reqP(s.getAll())),
  put: (item) => run('items', 'readwrite', (s) => { s.put(item); }),
  putMany: (items) => run('items', 'readwrite', (s) => { items.forEach((it) => s.put(it)); }),
  delete: (id) => run('items', 'readwrite', (s) => { s.delete(id); }),
  clear: () => run('items', 'readwrite', (s) => { s.clear(); }),
};

export const blobsDB = {
  get: (key) => run('blobs', 'readonly', (s) => reqP(s.get(key))),
  put: (key, blob) => run('blobs', 'readwrite', (s) => { s.put(blob, key); }),
  delete: (key) => run('blobs', 'readwrite', (s) => { s.delete(key); }),
  keys: () => run('blobs', 'readonly', (s) => reqP(s.getAllKeys())),
  clear: () => run('blobs', 'readwrite', (s) => { s.clear(); }),
};

export const metaDB = {
  get: async (key, def) => {
    const v = await run('meta', 'readonly', (s) => reqP(s.get(key)));
    return v === undefined ? def : v;
  },
  set: (key, value) => run('meta', 'readwrite', (s) => { s.put(value, key); }),
  delete: (key) => run('meta', 'readwrite', (s) => { s.delete(key); }),
  clear: () => run('meta', 'readwrite', (s) => { s.clear(); }),
};

export async function wipeAll() {
  await Promise.all([itemsDB.clear(), blobsDB.clear(), metaDB.clear()]);
}
