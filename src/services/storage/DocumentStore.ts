import { getDb } from "./IndexedDbStore";
import { SnipDocument } from "@/models/Document";

export async function saveDocument(doc: SnipDocument, blob: ArrayBuffer): Promise<void> {
  const db = await getDb();
  await db.put("documents", { id: doc.id, blob, meta: doc });
}

export async function getDocumentBlob(id: string): Promise<ArrayBuffer | null> {
  const db = await getDb();
  const entry = await db.get("documents", id);
  return entry?.blob ?? null;
}

export async function getAllDocumentMeta(): Promise<SnipDocument[]> {
  const db = await getDb();
  const all = await db.getAll("documents");
  return all.map((e) => e.meta as SnipDocument);
}

export async function deleteDocument(id: string): Promise<void> {
  const db = await getDb();
  await db.delete("documents", id);
}
