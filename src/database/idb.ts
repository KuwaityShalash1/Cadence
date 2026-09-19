/**
 * Minimal typed IndexedDB wrapper. This is the ONLY module that talks to
 * IndexedDB directly — everything above goes through the repository layer.
 */

export const DB_NAME = "cadence-db";
export const DB_VERSION = 2;

export const STORES = [
  "habits",
  "habitLogs",
  "groups",
  "goals",
  "routines",
  "routineLogs",
  "badHabits",
  "meta",
] as const;

export type StoreName = (typeof STORES)[number];

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined") {
    return Promise.reject(new Error("IndexedDB unavailable"));
  }
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        for (const store of STORES) {
          if (!db.objectStoreNames.contains(store)) {
            db.createObjectStore(store, { keyPath: "id" });
          }
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }
  return dbPromise;
}

function tx<T>(
  store: StoreName,
  mode: IDBTransactionMode,
  run: (objectStore: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const transaction = db.transaction(store, mode);
        const request = run(transaction.objectStore(store));
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      }),
  );
}

export function getAll<T>(store: StoreName): Promise<T[]> {
  return tx<T[]>(store, "readonly", (s) => s.getAll() as IDBRequest<T[]>);
}

export function getOne<T>(store: StoreName, id: string): Promise<T | undefined> {
  return tx<T | undefined>(store, "readonly", (s) => s.get(id) as IDBRequest<T | undefined>);
}

export function put<T extends { id: string }>(store: StoreName, value: T): Promise<void> {
  return tx(store, "readwrite", (s) => s.put(value) as IDBRequest<IDBValidKey>).then(
    () => undefined,
  );
}

export function putMany<T extends { id: string }>(store: StoreName, values: T[]): Promise<void> {
  return openDb().then(
    (db) =>
      new Promise<void>((resolve, reject) => {
        const transaction = db.transaction(store, "readwrite");
        const objectStore = transaction.objectStore(store);

        transaction.oncomplete = () => resolve();
        transaction.onerror = () => {
          try {
            transaction.abort();
          } catch {
            // ignore
          }
          reject(transaction.error ?? new Error("IDB transaction failed"));
        };
        transaction.onabort = () => {
          reject(transaction.error ?? new Error("IDB transaction aborted"));
        };

        try {
          for (const v of values) {
            const req = objectStore.put(v);
            req.onerror = (e) => {
              e.stopPropagation();
              try {
                transaction.abort();
              } catch {
                // ignore
              }
              reject(transaction.error ?? req.error ?? new Error("Put request failed"));
            };
          }
        } catch (err) {
          try {
            transaction.abort();
          } catch {
            // ignore
          }
          reject(err);
        }
      }),
  );
}

export function remove(store: StoreName, id: string): Promise<void> {
  return tx(store, "readwrite", (s) => s.delete(id) as IDBRequest<undefined>).then(() => undefined);
}

export function clearStore(store: StoreName): Promise<void> {
  return tx(store, "readwrite", (s) => s.clear() as IDBRequest<undefined>).then(() => undefined);
}
