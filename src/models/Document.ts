export interface SnipDocument {
  id: string;
  name: string;
  type: "pdf" | "image";
  hash: string;
  pageCount: number;
  storedAt: number;
  sizeBytes: number;
}
