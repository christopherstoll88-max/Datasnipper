import pako from "pako";
import { AuditRecord } from "@/models/AuditRecord";

const PROP_KEY = "DataSnipperAuditTrail";
const MAX_BYTES = 900_000; // stay under 1 MB Excel limit

function compress(data: object): string {
  const json = JSON.stringify(data);
  const compressed = pako.deflate(json);
  return btoa(String.fromCharCode(...compressed));
}

function decompress(b64: string): object {
  const binary = atob(b64);
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  const json = pako.inflate(bytes, { to: "string" });
  return JSON.parse(json);
}

/** Persist audit records (without pixel snapshots) to Excel custom properties */
export async function saveToCustomProperties(records: AuditRecord[]): Promise<void> {
  // Strip pixelSnapshot to save space
  const stripped = records.map((r) => ({
    ...r,
    cellLink: {
      ...r.cellLink,
      region: { ...r.cellLink.region, pixelSnapshot: undefined },
    },
  }));

  const compressed = compress(stripped);
  if (compressed.length > MAX_BYTES) {
    console.warn("DataSnipper: Audit trail too large for custom properties, skipping.");
    return;
  }

  await Office.context.document.settings.set(PROP_KEY, compressed);
  await new Promise<void>((res, rej) =>
    Office.context.document.settings.saveAsync((r) =>
      r.status === Office.AsyncResultStatus.Succeeded ? res() : rej(r.error)
    )
  );
}

/** Load audit records from Excel custom properties */
export async function loadFromCustomProperties(): Promise<AuditRecord[]> {
  const compressed = Office.context.document.settings.get(PROP_KEY) as string | null;
  if (!compressed) return [];
  try {
    return decompress(compressed) as AuditRecord[];
  } catch {
    return [];
  }
}
