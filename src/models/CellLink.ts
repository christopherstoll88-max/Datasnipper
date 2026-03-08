import { DocumentRegion } from "./Region";

export type ExtractedType = "raw_text" | "amount" | "date" | "table_row";

export interface CellLink {
  id: string;
  workbookId: string;
  sheetName: string;
  cellAddress: string; // e.g. "B4"
  region: DocumentRegion;
  extractedText: string;
  extractedType: ExtractedType;
  confidence: number;
}
