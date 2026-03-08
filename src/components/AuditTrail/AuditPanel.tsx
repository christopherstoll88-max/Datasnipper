import React, { useState } from "react";
import { Button } from "@fluentui/react-components";
import { useAuditStore } from "@/store/auditStore";
import { formatTimestamp } from "@/utils/formatters";
import { AuditRecord } from "@/models/AuditRecord";

const ACTION_LABELS: Record<string, string> = {
  snip: "Snip",
  ocr_extract: "OCR-Extraktion",
  manual_edit: "Manuelle Bearbeitung",
  cell_cleared: "Zelle geleert",
};

const ACTION_COLORS: Record<string, string> = {
  snip: "#0078d4",
  ocr_extract: "#107c10",
  manual_edit: "#ca5010",
  cell_cleared: "#888",
};

export function AuditPanel() {
  const { records, isLoading } = useAuditStore();
  const [filter, setFilter] = useState("");

  const filtered = records.filter(
    (r) =>
      !filter ||
      r.cellLink.cellAddress.toLowerCase().includes(filter.toLowerCase()) ||
      r.cellLink.region.documentId.includes(filter) ||
      r.newValue.toLowerCase().includes(filter.toLowerCase())
  );

  const exportCsv = () => {
    const header = "Zeitstempel,Aktion,Zelle,Blatt,Wert,Dokument,Seite\n";
    const rows = records
      .map(
        (r) =>
          `"${formatTimestamp(r.timestamp)}","${ACTION_LABELS[r.action] ?? r.action}","${r.cellLink.cellAddress}","${r.cellLink.sheetName}","${r.newValue.replace(/"/g, '""')}","${r.cellLink.region.documentId}","${r.cellLink.region.pageNumber}"`
      )
      .join("\n");
    const blob = new Blob([header + rows], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `datasnipper_audit_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (isLoading) {
    return <div style={{ padding: 12, color: "#888" }}>Laden…</div>;
  }

  return (
    <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 10, height: "100%" }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <input
          placeholder="Suchen…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          style={{ flex: 1, padding: "4px 8px", border: "1px solid #ccc", borderRadius: 4, fontSize: 12 }}
        />
        <Button size="small" onClick={exportCsv} disabled={records.length === 0}>
          CSV ↓
        </Button>
      </div>

      {filtered.length === 0 ? (
        <p style={{ color: "#888", fontSize: 12, textAlign: "center", marginTop: 24 }}>
          {records.length === 0
            ? "Noch keine Verknüpfungen erstellt."
            : "Keine Ergebnisse für die Suche."}
        </p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, overflowY: "auto" }}>
          {filtered.map((record) => (
            <AuditEntry key={record.id} record={record} />
          ))}
        </div>
      )}

      <div style={{ fontSize: 11, color: "#888", textAlign: "center" }}>
        {records.length} Einträge gesamt
      </div>
    </div>
  );
}

function AuditEntry({ record }: { record: AuditRecord }) {
  const [expanded, setExpanded] = useState(false);
  const color = ACTION_COLORS[record.action] ?? "#888";

  return (
    <div
      style={{
        border: "1px solid #e0e0e0",
        borderLeft: `3px solid ${color}`,
        borderRadius: 4,
        padding: "6px 8px",
        cursor: "pointer",
        background: "white",
      }}
      onClick={() => setExpanded((e) => !e)}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span
          style={{
            fontSize: 10,
            padding: "1px 6px",
            borderRadius: 10,
            background: color,
            color: "white",
            fontWeight: 600,
          }}
        >
          {ACTION_LABELS[record.action] ?? record.action}
        </span>
        <span style={{ fontWeight: 600, fontSize: 12 }}>
          {record.cellLink.sheetName}!{record.cellLink.cellAddress}
        </span>
        <span style={{ flex: 1, fontSize: 11, color: "#666", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {record.newValue.slice(0, 50)}
        </span>
        <span style={{ fontSize: 10, color: "#888", flexShrink: 0 }}>
          {formatTimestamp(record.timestamp)}
        </span>
      </div>

      {expanded && (
        <div style={{ marginTop: 6, fontSize: 11, color: "#555", display: "flex", flexDirection: "column", gap: 2 }}>
          <div>📄 Dok: {record.cellLink.region.documentId.slice(0, 8)}… · Seite {record.cellLink.region.pageNumber}</div>
          <div>📍 Region: x={record.cellLink.region.x.toFixed(3)}, y={record.cellLink.region.y.toFixed(3)}, w={record.cellLink.region.width.toFixed(3)}, h={record.cellLink.region.height.toFixed(3)}</div>
          <div>🎯 Konfidenz: {record.cellLink.confidence.toFixed(0)}%</div>
          {record.cellLink.region.pixelSnapshot && (
            <img
              src={record.cellLink.region.pixelSnapshot}
              alt="Snip-Vorschau"
              style={{ maxWidth: "100%", maxHeight: 80, marginTop: 4, border: "1px solid #ddd" }}
            />
          )}
        </div>
      )}
    </div>
  );
}
