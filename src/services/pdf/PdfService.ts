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
