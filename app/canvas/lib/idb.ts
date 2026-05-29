import type { AssetRecord } from "./canvas-types";

export const IDB_NAME = "denkraum_db";
export const IDB_VERSION = 1;
export const IDB_STORE = "assets";

export let _idbPromise: Promise<IDBDatabase> | null = null;

export function openDB(): Promise<IDBDatabase> {
  if (!_idbPromise) {
    _idbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(IDB_NAME, IDB_VERSION);
      req.onupgradeneeded = () => req.result.createObjectStore(IDB_STORE);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => {
        _idbPromise = null;
        reject(req.error);
      };
    });
  }
  return _idbPromise;
}

export async function setAsset(id: number, record: AssetRecord): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, "readwrite");
    tx.objectStore(IDB_STORE).put(record, String(id));
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function deleteAsset(id: number): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, "readwrite");
    tx.objectStore(IDB_STORE).delete(String(id));
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// Loads the entire store in one transaction — used at hydration time.
export async function getAllAssets(): Promise<Map<number, AssetRecord>> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE);
    const store = tx.objectStore(IDB_STORE);
    const kReq = store.getAllKeys();
    const vReq = store.getAll();
    tx.oncomplete = () => {
      const map = new Map<number, AssetRecord>();
      (kReq.result as string[]).forEach((k, i) =>
        map.set(Number(k), vReq.result[i]),
      );
      resolve(map);
    };
    tx.onerror = () => reject(tx.error);
  });
}
