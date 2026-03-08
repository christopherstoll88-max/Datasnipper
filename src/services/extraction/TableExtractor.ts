import { OcrBlock } from "@/models/OcrResult";

export type TableRow = string[];
export type Table = TableRow[];

/**
 * Reconstruct table structure from OCR blocks using bounding box geometry.
 * Groups blocks into rows by Y-proximity, then sorts each row by X.
 */
export function extractTables(blocks: OcrBlock[]): Table[] {
  if (blocks.length === 0) return [];

  const wordBlocks = blocks.filter((b) => b.blockType === "word" && b.text.trim());
  if (wordBlocks.length === 0) return [];

  // Compute average line height
  const avgHeight =
    wordBlocks.reduce((sum, b) => sum + b.bbox.height, 0) / wordBlocks.length;
  const rowTolerance = avgHeight * 0.6;

  // Cluster blocks into rows by Y coordinate
  const rows: OcrBlock[][] = [];
  const sorted = [...wordBlocks].sort((a, b) => a.bbox.y - b.bbox.y);

  for (const block of sorted) {
    const matchingRow = rows.find(
      (row) => Math.abs(row[0].bbox.y - block.bbox.y) < rowTolerance
    );
    if (matchingRow) {
      matchingRow.push(block);
    } else {
      rows.push([block]);
    }
  }

  // Sort each row by X coordinate
  const table: Table = rows.map((row) =>
    row.sort((a, b) => a.bbox.x - b.bbox.x).map((b) => b.text)
  );

  // Only return if there are multiple rows and columns (looks like a table)
  if (table.length < 2) return [];
  const hasCols = table.some((row) => row.length > 1);
  if (!hasCols) return [];

  return [table];
}

export function tableToTsv(table: Table): string {
  return table.map((row) => row.join("\t")).join("\n");
}
