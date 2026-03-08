import * as pdfjsLib from "pdfjs-dist";
import type { PDFDocumentProxy } from "pdfjs-dist";

// Worker must be served from same origin (copied by webpack CopyPlugin)
pdfjsLib.GlobalWorkerOptions.workerSrc = "https://localhost:3000/pdf.worker.mjs";

const loadedDocs = new Map<string, PDFDocumentProxy>();

export async function loadPdf(
  id: string,
  buffer: ArrayBuffer
): Promise<PDFDocumentProxy> {
  if (loadedDocs.has(id)) return loadedDocs.get(id)!;
  const doc = await pdfjsLib.getDocument({ data: new Uint8Array(buffer) }).promise;
  loadedDocs.set(id, doc);
  return doc;
}

export function unloadPdf(id: string): void {
  const doc = loadedDocs.get(id);
  if (doc) {
    doc.destroy();
    loadedDocs.delete(id);
  }
}

import type { RenderTask } from "pdfjs-dist";

let activeRenderTask: RenderTask | null = null;

/**
 * Render a PDF page to a canvas at the given scale.
 * Cancels any ongoing render on the same canvas first.
 */
export async function renderPage(
  doc: PDFDocumentProxy,
  pageNumber: number,
  scale: number,
  canvas: HTMLCanvasElement
): Promise<void> {
  if (activeRenderTask) {
    activeRenderTask.cancel();
    activeRenderTask = null;
  }

  const page = await doc.getPage(pageNumber);
  const viewport = page.getViewport({ scale });
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  const ctx = canvas.getContext("2d")!;

  const task = page.render({ canvasContext: ctx, viewport });
  activeRenderTask = task;

  try {
    await task.promise;
  } catch (e: any) {
    if (e?.name === "RenderingCancelledException") return;
    throw e;
  } finally {
    if (activeRenderTask === task) activeRenderTask = null;
    page.cleanup();
  }
}

/** Extract native text layer from a PDF page (fast path, no OCR needed) */
export async function extractNativeText(
  doc: PDFDocumentProxy,
  pageNumber: number
): Promise<string> {
  const page = await doc.getPage(pageNumber);
  const textContent = await page.getTextContent();
  page.cleanup();
  return textContent.items
    .map((item) => ("str" in item ? item.str : ""))
    .join(" ");
}

/**
 * Extract native text preserving line structure using y-coordinate grouping.
 * Returns an array of lines (top to bottom), each line being the concatenated
 * text of items on the same horizontal level.
 */
export async function extractNativeTextLines(
  doc: PDFDocumentProxy,
  pageNumber: number
): Promise<string[]> {
  const page = await doc.getPage(pageNumber);
  const textContent = await page.getTextContent();
  page.cleanup();

  const raw = textContent.items
    .filter((item): item is typeof item & { str: string; transform: number[] } =>
      "str" in item && typeof (item as any).str === "string" && (item as any).str.trim() !== ""
    )
    .map((item) => ({
      text: (item as any).str as string,
      x: (item as any).transform[4] as number,
      y: (item as any).transform[5] as number,
    }));

  if (raw.length === 0) return [];

  // Sort top-to-bottom (PDF y is bottom-up → descending y = top-to-bottom), then left-to-right
  raw.sort((a, b) => b.y - a.y || a.x - b.x);

  // Group into lines: items within LINE_TOLERANCE px of the same y belong to one line
  const LINE_TOLERANCE = 4;
  const lines: string[] = [];
  let group: typeof raw = [raw[0]];
  let lastY = raw[0].y;

  for (let i = 1; i < raw.length; i++) {
    if (Math.abs(raw[i].y - lastY) <= LINE_TOLERANCE) {
      group.push(raw[i]);
    } else {
      lines.push(group.map((g) => g.text).join(" ").trim());
      group = [raw[i]];
      lastY = raw[i].y;
    }
  }
  if (group.length > 0) lines.push(group.map((g) => g.text).join(" ").trim());

  return lines.filter((l) => l.length > 0);
}
