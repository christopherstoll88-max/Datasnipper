import React, { useEffect } from "react";
import { useUiStore, ActivePanel } from "@/store/uiStore";
import { useAuditStore } from "@/store/auditStore";
import { DocumentPanel } from "@/components/shared/DocumentPanel";
import { OCRPanel } from "@/components/OCRPanel/OCRPanel";
import { AuditPanel } from "@/components/AuditTrail/AuditPanel";

const TABS: { id: ActivePanel; label: string }[] = [
  { id: "documents", label: "Dokumente" },
  { id: "ocr", label: "OCR" },
  { id: "audit", label: "Audit" },
];

export function App() {
  const { activePanel, setActivePanel, errorMessage, setError } = useUiStore();
  const loadAudit = useAuditStore((s) => s.load);

  useEffect(() => {
    loadAudit().catch(console.warn);
  }, []);

  return (
    <div className="app-container">
      <div className="toolbar">
        <span className="toolbar-title">📎 DataSnipper</span>
      </div>

      <div className="tab-bar">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            className={`tab ${activePanel === tab.id ? "active" : ""}`}
            onClick={() => setActivePanel(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {errorMessage && (
        <div style={{ background: "#fde7e9", padding: "8px", color: "#a80000", fontSize: 12 }}>
          ⚠ {errorMessage}
          <button
            style={{ marginLeft: 8, fontSize: 11, cursor: "pointer" }}
            onClick={() => setError(null)}
          >
            ✕
          </button>
        </div>
      )}

      <div className="panel-content">
        {activePanel === "documents" && <DocumentPanel />}
        {activePanel === "ocr" && <OCRPanel />}
        {activePanel === "audit" && <AuditPanel />}
      </div>

      <div className="status-bar">
        DataSnipper v1.0 · Tesseract OCR · Lokal
      </div>
    </div>
  );
}
