export type StorageBackend = "indexedDB" | "localStorage";

const DB_NAME = "gaveteira-da-vida";
const DB_VERSION = 1;
const STORE_NAME = "key-value";

let dbPromise: Promise<IDBDatabase> | null = null;

export function readLocalJson<T>(key: string): T | null {
  if (!canUseLocalStorage()) return null;

  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) as T : null;
  } catch {
    return null;
  }
}

export function writeLocalJson<T>(key: string, value: T) {
  localStorage.setItem(key, JSON.stringify(value));
}

export function removeLocalValue(key: string) {
  if (!canUseLocalStorage()) return;
  localStorage.removeItem(key);
}

export async function readStoredJson<T>(key: string): Promise<T | null> {
  if (canUseIndexedDb()) {
    try {
      const value = await readIndexedJson<T>(key);
      if (value !== undefined) return value;
    } catch (error) {
      console.warn("IndexedDB read failed; falling back to localStorage.", error);
    }
  }

  return readLocalJson<T>(key);
}

export async function readIndexedJson<T>(key: string): Promise<T | undefined> {
  return readIndexedDbValue<T>(key);
}

export async function writeStoredJson<T>(key: string, value: T): Promise<StorageBackend> {
  if (canUseIndexedDb()) {
    try {
      await writeIndexedDbValue(key, value);
      return "indexedDB";
    } catch (error) {
      console.warn("IndexedDB write failed; falling back to localStorage.", error);
    }
  }

  writeLocalJson(key, value);
  return "localStorage";
}

export async function removeStoredJson(key: string) {
  if (canUseIndexedDb()) {
    try {
      await deleteIndexedDbValue(key);
    } catch (error) {
      console.warn("IndexedDB delete failed.", error);
    }
  }

  removeLocalValue(key);
}

export async function migrateLocalJsonToIndexedDb<T>(
  key: string,
  normalize: (value: T) => T,
): Promise<T | null> {
  if (!canUseIndexedDb() || !canUseLocalStorage()) return null;

  const localValue = readLocalJson<T>(key);
  if (!localValue) return null;

  const normalized = normalize(localValue);
  const backend = await writeStoredJson(key, normalized);
  if (backend !== "indexedDB") return normalized;

  const stored = await readIndexedJson<T>(key);
  if (stored === undefined) {
    throw new Error("IndexedDB migration verification failed.");
  }

  removeLocalValue(key);
  return normalized;
}

function canUseIndexedDb() {
  return typeof indexedDB !== "undefined";
}

function canUseLocalStorage() {
  return typeof localStorage !== "undefined";
}

function openDatabase() {
  if (!dbPromise) {
    dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => reject(request.error ?? new Error("Could not open IndexedDB."));
      request.onblocked = () => reject(new Error("IndexedDB is blocked by another tab."));
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      };
      request.onsuccess = () => resolve(request.result);
    });
  }

  return dbPromise;
}

async function readIndexedDbValue<T>(key: string): Promise<T | undefined> {
  const db = await openDatabase();

  return new Promise<T | undefined>((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readonly");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(key);

    request.onerror = () => reject(request.error ?? new Error("Could not read from IndexedDB."));
    request.onsuccess = () => resolve(request.result as T | undefined);
  });
}

async function writeIndexedDbValue<T>(key: string, value: T) {
  const db = await openDatabase();

  return new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.put(value, key);

    request.onerror = () => reject(request.error ?? new Error("Could not write to IndexedDB."));
    transaction.onerror = () => reject(transaction.error ?? new Error("IndexedDB transaction failed."));
    transaction.oncomplete = () => resolve();
  });
}

async function deleteIndexedDbValue(key: string) {
  const db = await openDatabase();

  return new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(key);

    request.onerror = () => reject(request.error ?? new Error("Could not delete from IndexedDB."));
    transaction.onerror = () => reject(transaction.error ?? new Error("IndexedDB transaction failed."));
    transaction.oncomplete = () => resolve();
  });
}
