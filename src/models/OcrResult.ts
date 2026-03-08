export interface OcrBlock {
  text: string;
  confidence: number; // 0–100
  bbox: { x: number; y: number; width: number; height: number }; // page pixels
  blockType: "word" | "line" | "paragraph" | "table_cell";
}

export interface OcrResult {
  documentId: string;
  pageNumber: number;
  generatedAt: number;
  blocks: OcrBlock[];
  rawTsv: string;
}
