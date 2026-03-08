import React, { useState } from "react";
import { Button, Badge } from "@fluentui/react-components";
import { FileUploader } from "./FileUploader";
import { DocumentViewer } from "@/components/DocumentViewer/DocumentViewer";
import { useDocumentStore } from "@/store/documentStore";
import { saveDocument, deleteDocument } from "@/services/storage/DocumentStore";
import { sha256 } from "@/utils/fileHash";
import { SnipDocument } from "@/models/Document";
import { formatBytes } from "@/utils/formatters";

export function DocumentPanel() {
  const { documents, activeDocumentId, addDocument, removeDocument, setActiveDocument } =
    useDocumentStore();
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const handleFile = async (file: File) => {
    setUploading(true);
    setUploadError(null);
    try {
      const buffer = await file.arrayBuffer();
      const hash = await sha256(buffer);
      const type = file.name.toLowerCase().endsWith(".pdf") ? "pdf" : "image";

      let pageCount = 1;
      if (type === "pdf") {
        const { loadPdf } = await import("@/services/pdf/PdfService");
        const id = crypto.randomUUID();
        const doc = await loadPdf(id, buffer.slice(0));
        pageCount = doc.numPages;
      }

      const snipDoc: SnipDocument = {
        id: crypto.randomUUID(),
        name: file.name,
        type,
        hash,
        pageCount,
        storedAt: Date.now(),
        sizeBytes: file.size,
      };

      await saveDocument(snipDoc, buffer);
      addDocument(snipDoc);
      setActiveDocument(snipDoc.id);
    } catch (e) {
      console.error("Upload failed", e);
      setUploadError(String(e));
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: string) => {
    await deleteDocument(id);
    removeDocument(id);
  };

  return (
    <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 12, flex: 1, minHeight: 0 }}>
      <FileUploader onFile={handleFile} />

      {uploading && (
        <div style={{ textAlign: "center", color: "#0078d4", fontSize: 12 }}>
          Wird geladen…
        </div>
      )}

      {uploadError && (
        <div style={{ background: "#fde7e9", padding: 8, color: "#a80000", fontSize: 12, borderRadius: 4 }}>
          Fehler: {uploadError}
        </div>
      )}

      {documents.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {documents.map((doc) => (
            <div
              key={doc.id}
              onClick={() => setActiveDocument(doc.id)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "6px 8px",
                border: `1px solid ${activeDocumentId === doc.id ? "#0078d4" : "#e0e0e0"}`,
                borderRadius: 4,
                cursor: "pointer",
                background: activeDocumentId === doc.id ? "#e8f0fe" : "white",
              }}
            >
              <span>{doc.type === "pdf" ? "📄" : "🖼"}</span>
              <span style={{ flex: 1, fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {doc.name}
              </span>
              <Badge size="small" appearance="outline">{doc.pageCount}S</Badge>
              <span style={{ fontSize: 11, color: "#888" }}>{formatBytes(doc.sizeBytes)}</span>
              <button
                onClick={(e) => { e.stopPropagation(); handleDelete(doc.id); }}
                style={{ border: "none", background: "none", cursor: "pointer", color: "#c00", fontSize: 14 }}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      {activeDocumentId && (
        <div style={{ flex: 1, minHeight: 0, border: "1px solid #e0e0e0", borderRadius: 4, overflow: "hidden" }}>
          <DocumentViewer documentId={activeDocumentId} />
        </div>
      )}
    </div>
  );
}
