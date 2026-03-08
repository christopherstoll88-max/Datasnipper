import { openDB, IDBPDatabase, DBSchema } from "idb";

interface DataSnipperDB extends DBSchema {
  documents: {
    key: string;
    value: { id: string; blob: ArrayBuffer; meta: object };
  };
  ocrCache: {
    key: string; // hash_page
    value: { key: string; result: object; storedAt: number };
  };
  auditRecords: {
    key: string;
    value: object;
    indexes: { byTimestamp: number };
  };
  thumbnails: {
    key: string; // docId_page
    value: { key: string; dataUrl: string };
  };
}

let _db: IDBPDatabase<DataSnipperDB> | null = null;

export async function getDb(): Promise<IDBPDatabase<DataSnipperDB>> {
  if (_db) return _db;
  _db = await openDB<DataSnipperDB>("datasnipper", 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains("documents")) {
        db.createObjectStore("documents", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("ocrCache")) {
        db.createObjectStore("ocrCache", { keyPath: "key" });
      }
      if (!db.objectStoreNames.contains("auditRecords")) {
        const store = db.createObjectStore("auditRecords", { keyPath: "id" });
        store.createIndex("byTimestamp", "timestamp");
      }
      if (!db.objectStoreNames.contains("thumbnails")) {
        db.createObjectStore("thumbnails", { keyPath: "key" });
      }
    },
  });
  return _db;
}
