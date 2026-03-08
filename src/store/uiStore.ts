import { create } from "zustand";

export type ActivePanel = "documents" | "ocr" | "audit";

interface UiState {
  activePanel: ActivePanel;
  isLoading: boolean;
  errorMessage: string | null;
  setActivePanel: (panel: ActivePanel) => void;
  setLoading: (loading: boolean) => void;
  setError: (msg: string | null) => void;
}

export const useUiStore = create<UiState>((set) => ({
  activePanel: "documents",
  isLoading: false,
  errorMessage: null,
  setActivePanel: (panel) => set({ activePanel: panel }),
  setLoading: (loading) => set({ isLoading: loading }),
  setError: (msg) => set({ errorMessage: msg }),
}));
