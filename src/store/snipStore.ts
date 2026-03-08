import { create } from "zustand";
import { DocumentRegion } from "@/models/Region";
import { OcrResult } from "@/models/OcrResult";

type SnipPhase = "idle" | "selecting" | "ocr" | "awaiting_cell" | "done";

interface SnipState {
  phase: SnipPhase;
  pendingRegion: DocumentRegion | null;
  ocrResult: OcrResult | null;
  ocrProgress: number;
  startSnip: () => void;
  setRegion: (region: DocumentRegion) => void;
  setOcrResult: (result: OcrResult, progress: number) => void;
  setOcrProgress: (progress: number) => void;
  awaitCell: () => void;
  reset: () => void;
}

export const useSnipStore = create<SnipState>((set) => ({
  phase: "idle",
  pendingRegion: null,
  ocrResult: null,
  ocrProgress: 0,
  startSnip: () => set({ phase: "selecting", pendingRegion: null, ocrResult: null, ocrProgress: 0 }),
  setRegion: (region) => set({ pendingRegion: region, phase: "ocr" }),
  setOcrResult: (result, progress) => set({ ocrResult: result, ocrProgress: progress }),
  setOcrProgress: (progress) => set({ ocrProgress: progress }),
  awaitCell: () => set({ phase: "awaiting_cell" }),
  reset: () => set({ phase: "idle", pendingRegion: null, ocrResult: null, ocrProgress: 0 }),
}));
