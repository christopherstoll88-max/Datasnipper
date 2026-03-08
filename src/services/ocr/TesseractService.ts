import { createWorker, Worker } from "tesseract.js";
import { OcrResult, OcrBlock } from "@/models/OcrResult";
import { OcrCache } from "./OcrCache";
import { sha256 } from "@/utils/fileHash";

export type OcrProgressCallback = (progress: number) => void;

class TesseractService {
  private worker: Worker | null = null;
  private initPromise: Promise<void> | null = null;
  private cache = new OcrCache();

  private async init(): Promise<void> {
    if (this.worker) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = (async () => {
      this.worker = await createWorker("deu+eng", 1, {
        workerPath: "/tesseract-worker.min.js",
        langPath: "https://tessdata.projectnaptha.com/4.0.0",
        corePath: "/tesseract-core.wasm.js",
        logger: () => {}, // suppress internal logs
      });
    })();
    return this.initPromise;
  }

  async recognise(
    canvas: HTMLCanvasElement,
    documentId: string,
    pageNumber: number,
    onProgress?: OcrProgressCallback
  ): Promise<OcrResult> {
    // Check cache first
    const blob = await new Promise<Blob>((res) =>
      canvas.toBlob((b) => res(b!), "image/png")
    );
    const buffer = await blob.arrayBuffer();
    const hash = await sha256(buffer);
    const cacheKey = `${hash}_${pageNumber}`;
    const cached = await this.cache.get(cacheKey);
    if (cached) return cached;

    await this.init();
    onProgress?.(0.05);

    const { data } = await this.worker!.recognize(canvas, {}, { tsv: true });
    onProgress?.(0.9);

    const blocks = this.parseTsv((data as any).tsv as string);
    const result: OcrResult = {
      documentId,
      pageNumber,
      generatedAt: Date.now(),
      blocks,
      rawTsv: (data as any).tsv as string,
    };

    await this.cache.set(cacheKey, result);
    onProgress?.(1.0);
    return result;
  }

  private parseTsv(tsv: string): OcrBlock[] {
    const lines = tsv.split("\n").slice(1); // skip header
    const blocks: OcrBlock[] = [];
    for (const line of lines) {
      const cols = line.split("\t");
      if (cols.length < 12) continue;
      const level = parseInt(cols[0]);
      const text = cols[11]?.trim();
      if (!text) continue;
      const x = parseInt(cols[6]);
      const y = parseInt(cols[7]);
      const width = parseInt(cols[8]) - x;
      const height = parseInt(cols[9]) - y;
      const conf = parseFloat(cols[10]);
      let blockType: OcrBlock["blockType"] = "word";
      if (level === 3) blockType = "paragraph";
      else if (level === 4) blockType = "line";
      else if (level === 5) blockType = "word";
      blocks.push({ text, confidence: conf, bbox: { x, y, width, height }, blockType });
    }
    return blocks;
  }

  async terminate(): Promise<void> {
    if (this.worker) {
      await this.worker.terminate();
      this.worker = null;
      this.initPromise = null;
    }
  }
}

// Singleton
export const tesseractService = new TesseractService();
