import { create } from "zustand";
import { AuditRecord } from "@/models/AuditRecord";
import { saveAuditRecord, getAllAuditRecords } from "@/services/storage/AuditStore";
import { saveToCustomProperties } from "@/services/excel/CustomPropertiesStore";

interface AuditState {
  records: AuditRecord[];
  isLoading: boolean;
  load: () => Promise<void>;
  addRecord: (record: AuditRecord) => Promise<void>;
}

export const useAuditStore = create<AuditState>((set, get) => ({
  records: [],
  isLoading: false,
  load: async () => {
    set({ isLoading: true });
    const records = await getAllAuditRecords();
    set({ records, isLoading: false });
  },
  addRecord: async (record) => {
    await saveAuditRecord(record);
    const updated = [record, ...get().records];
    set({ records: updated });
    // Best-effort sync to Excel custom properties
    saveToCustomProperties(updated).catch(console.warn);
  },
}));
