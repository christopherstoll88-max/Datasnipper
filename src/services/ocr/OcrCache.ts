import { getDb } from "@/services/storage/IndexedDbStore";
import { OcrResult } from "@/models/OcrResult";

const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export class OcrCache {
  async get(key: string): Promise<OcrResult | null> {
    const db = await getDb();
    const entry = await db.get("ocrCache", key);
    if (!entry) return null;
    if (Date.now() - entry.storedAt > CACHE_TTL_MS) {
      await db.delete("ocrCache", key);
      return null;
    }
    return entry.result as OcrResult;
  }

  async set(key: string, result: OcrResult): Promise<void> {
    const db = await getDb();
    await db.put("ocrCache", { key, result, storedAt: Date.now() });
  }
}
