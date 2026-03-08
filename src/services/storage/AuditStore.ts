import { getDb } from "./IndexedDbStore";
import { AuditRecord } from "@/models/AuditRecord";

export async function saveAuditRecord(record: AuditRecord): Promise<void> {
  const db = await getDb();
  await db.put("auditRecords", record as unknown as object);
}

export async function getAllAuditRecords(): Promise<AuditRecord[]> {
  const db = await getDb();
  const all = await db.getAllFromIndex("auditRecords", "byTimestamp");
  return (all as unknown as AuditRecord[]).reverse();
}

export async function deleteAuditRecord(id: string): Promise<void> {
  const db = await getDb();
  await db.delete("auditRecords", id);
}

export async function getAuditRecordsByDocument(documentId: string): Promise<AuditRecord[]> {
  const all = await getAllAuditRecords();
  return all.filter((r) => r.cellLink.region.documentId === documentId);
}
