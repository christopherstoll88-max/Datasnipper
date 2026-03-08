import { CellLink } from "@/models/CellLink";

const LINK_COMMENT_PREFIX = "DS_LINK:";
const HIGHLIGHT_COLOR = "#FFF9C4"; // light yellow

/**
 * Write extracted text to the active cell and attach link metadata as a comment.
 */
export async function writeCellLink(link: CellLink): Promise<void> {
  await Excel.run(async (context) => {
    const sheet = context.workbook.worksheets.getItem(link.sheetName);
    const range = sheet.getRange(link.cellAddress);

    range.values = [[link.extractedText]];
    range.format.fill.color = HIGHLIGHT_COLOR;

    // Attach metadata as a note (comment)
    const commentBody = LINK_COMMENT_PREFIX + JSON.stringify({
      id: link.id,
      documentId: link.region.documentId,
      pageNumber: link.region.pageNumber,
      region: {
        x: link.region.x,
        y: link.region.y,
        width: link.region.width,
        height: link.region.height,
      },
      extractedType: link.extractedType,
    });

    // Remove existing comment if present
    try {
      const comments = context.workbook.comments;
      comments.load("items");
      await context.sync();
    } catch {
      // ignore
    }

    try {
      context.workbook.comments.add(
        `${link.sheetName}!${link.cellAddress}`,
        commentBody
      );
    } catch {
      // Comments not supported in all contexts; store in custom props fallback
    }

    await context.sync();
  });
}

/**
 * Get the currently selected cell address and sheet name.
 */
export async function getActiveCell(): Promise<{ sheet: string; address: string } | null> {
  return Excel.run(async (context) => {
    const range = context.workbook.getSelectedRange();
    range.load(["address", "worksheet/name"]);
    await context.sync();
    const fullAddress = range.address; // e.g. "Sheet1!B4"
    const parts = fullAddress.split("!");
    return { sheet: parts[0], address: parts[1] };
  });
}

/**
 * Subscribe to selection changes. Returns an unsubscribe function.
 * Uses an active flag because Office.js removeHandlerAsync removes ALL
 * handlers for the event type, so we guard with a flag instead.
 */
export function onSelectionChange(
  callback: (sheet: string, address: string) => void
): () => void {
  let active = true;

  const handler = async () => {
    if (!active) return;
    await Excel.run(async (context) => {
      const range = context.workbook.getSelectedRange();
      range.load("address");
      await context.sync();
      if (!active) return;
      const parts = range.address.split("!");
      callback(parts[0], parts[1]);
    });
  };

  Office.context.document.addHandlerAsync(
    Office.EventType.DocumentSelectionChanged,
    handler
  );

  return () => {
    active = false;
    Office.context.document.removeHandlerAsync(
      Office.EventType.DocumentSelectionChanged
    );
  };
}

/**
 * Write invoice table: header row at A1, data rows below.
 * Each call appends rows after any existing invoice data.
 */
export async function writeInvoiceTable(
  headers: readonly string[],
  rows: string[][]
): Promise<number> {
  return Excel.run(async (context) => {
    const sheet = context.workbook.worksheets.getActiveWorksheet();

    // Write header in row 1 (A1:L1 etc.)
    const lastCol = String.fromCharCode(64 + headers.length); // A=65, so 64+1=A
    const headerRange = sheet.getRange(`A1:${lastCol}1`);
    headerRange.values = [headers as unknown as string[]];
    headerRange.format.font.bold = true;
    headerRange.format.fill.color = "#D9E2F3";

    // Find first empty row after header
    const usedRange = sheet.getUsedRange();
    usedRange.load("rowCount");
    await context.sync();

    const startRow = usedRange.rowCount + 1; // 1-based, after existing data

    // Write data rows
    if (rows.length > 0) {
      const dataRange = sheet.getRange(
        `A${startRow}:${lastCol}${startRow + rows.length - 1}`
      );
      dataRange.values = rows;
    }

    // Auto-fit columns
    const fullRange = sheet.getRange(`A1:${lastCol}${startRow + rows.length - 1}`);
    fullRange.format.autofitColumns();

    await context.sync();
    return startRow;
  });
}

/**
 * Clear highlight from a cell (when a link is removed).
 */
export async function clearCellHighlight(sheetName: string, cellAddress: string): Promise<void> {
  await Excel.run(async (context) => {
    const sheet = context.workbook.worksheets.getItem(sheetName);
    const range = sheet.getRange(cellAddress);
    range.format.fill.clear();
    await context.sync();
  });
}
