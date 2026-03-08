import { CellLink } from "./CellLink";

export type AuditAction = "snip" | "ocr_extract" | "manual_edit" | "cell_cleared";

export interface AuditRecord {
  id: string;
  timestamp: number;
  action: AuditAction;
  userId?: string;
  cellLink: CellLink;
  previousValue?: string;
  newValue: string;
  notes?: string;
}
