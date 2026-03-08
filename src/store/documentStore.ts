import { create } from "zustand";
import { SnipDocument } from "@/models/Document";

interface DocumentState {
  documents: SnipDocument[];
  activeDocumentId: string | null;
  currentPage: number;
  totalPages: number;
  zoom: number;
  addDocument: (doc: SnipDocument) => void;
  removeDocument: (id: string) => void;
  setActiveDocument: (id: string | null) => void;
  setCurrentPage: (page: number) => void;
  setTotalPages: (total: number) => void;
  setZoom: (zoom: number) => void;
}

export const useDocumentStore = create<DocumentState>((set) => ({
  documents: [],
  activeDocumentId: null,
  currentPage: 1,
  totalPages: 1,
  zoom: 1.5,
  addDocument: (doc) => set((s) => ({ documents: [...s.documents, doc] })),
  removeDocument: (id) =>
    set((s) => ({
      documents: s.documents.filter((d) => d.id !== id),
      activeDocumentId: s.activeDocumentId === id ? null : s.activeDocumentId,
    })),
  setActiveDocument: (id) => set({ activeDocumentId: id, currentPage: 1 }),
  setCurrentPage: (page) => set({ currentPage: page }),
  setTotalPages: (total) => set({ totalPages: total }),
  setZoom: (zoom) => set({ zoom: Math.max(0.5, Math.min(3, zoom)) }),
}));
