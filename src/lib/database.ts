import initSqlJs, { type Database } from 'sql.js';

const DB_NAME = 'comfyui-app-db';
const DB_STORE = 'sqlite';
const DB_KEY = 'main';

let db: Database | null = null;
let initPromise: Promise<Database> | null = null;

function openIDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(DB_STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function loadFromIDB(): Promise<Uint8Array | null> {
  return new Promise(async (resolve, reject) => {
    try {
      const idb = await openIDB();
      const tx = idb.transaction(DB_STORE, 'readonly');
      const store = tx.objectStore(DB_STORE);
      const req = store.get(DB_KEY);
      req.onsuccess = () => resolve(req.result ?? null);
      req.onerror = () => reject(req.error);
    } catch (err) {
      reject(err);
    }
  });
}

function saveToIDB(data: Uint8Array): Promise<void> {
  return new Promise(async (resolve, reject) => {
    try {
      const idb = await openIDB();
      const tx = idb.transaction(DB_STORE, 'readwrite');
      const store = tx.objectStore(DB_STORE);
      store.put(data, DB_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    } catch (err) {
      reject(err);
    }
  });
}

const CREATE_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS generations (
    id TEXT PRIMARY KEY,
    device_id TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('image', 'edit', 'audio', '3d')),
    prompt TEXT NOT NULL DEFAULT '',
    settings_json TEXT DEFAULT '{}',
    output_url TEXT,
    thumbnail_url TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    error_message TEXT,
    comfy_job_id TEXT,
    progress INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    completed_at TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_gen_device ON generations(device_id);
  CREATE INDEX IF NOT EXISTS idx_gen_type ON generations(type);
  CREATE INDEX IF NOT EXISTS idx_gen_created ON generations(created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_gen_status ON generations(status);
`;

async function initDB(): Promise<Database> {
  const SQL = await initSqlJs({
    locateFile: (file: string) => `/${file}`,
  });

  const saved = await loadFromIDB();
  const instance = saved ? new SQL.Database(saved) : new SQL.Database();
  instance.run(CREATE_TABLE_SQL);
  return instance;
}

export async function getDB(): Promise<Database> {
  if (db) return db;
  if (!initPromise) {
    initPromise = initDB().then((instance) => {
      db = instance;
      return instance;
    });
  }
  return initPromise;
}

export async function persist(): Promise<void> {
  if (!db) return;
  const data = db.export();
  await saveToIDB(data);
}
