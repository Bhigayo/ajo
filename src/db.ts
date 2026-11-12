// Groups are saved on this device in IndexedDB. Backups are a single file you can save and restore.

import type { Group } from "./model";

let opening: Promise<IDBDatabase> | null = null;

export function openDb(): Promise<IDBDatabase> {
  opening ??= new Promise((resolve, reject) => {
    const req = indexedDB.open("ajo", 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains("groups")) req.result.createObjectStore("groups", { keyPath: "id" });
    };
    req.onsuccess = () => {
      const db = req.result;
      db.onversionchange = () => {
        db.close();
        opening = null;
      };
      resolve(db);
    };
    req.onerror = () => {
      opening = null;
      reject(req.error);
    };
  });
  return opening;
}

function run<T>(mode: IDBTransactionMode, work: (s: IDBObjectStore) => IDBRequest<T> | void): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction("groups", mode);
        const req = work(tx.objectStore("groups"));
        tx.oncomplete = () => resolve(req ? req.result : (undefined as T));
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
      }),
  );
}

export const db = {
  allGroups: () => run<Group[]>("readonly", (s) => s.getAll() as IDBRequest<Group[]>),
  putGroup: (g: Group) => run("readwrite", (s) => void s.put(g)),
  deleteGroup: (id: string) => run("readwrite", (s) => void s.delete(id)),
};

export type Backup = { app: "ajo"; version: 1; saved: string; groups: Group[] };

export async function makeBackup(): Promise<Backup> {
  return { app: "ajo", version: 1, saved: new Date().toISOString(), groups: await db.allGroups() };
}

/** Restores groups from a backup. A group already on this device (same id) is replaced by the backup's copy. */
export async function restoreBackup(data: unknown) {
  const b = data as Backup;
  if (b?.app !== "ajo" || !Array.isArray(b.groups)) throw new Error("That file isn't an Ajo backup.");
  for (const g of b.groups) await db.putGroup(g);
  return b.groups.length;
}
