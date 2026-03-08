import React, { useState } from "react";
import { Button } from "@fluentui/react-components";
import { useDocumentStore } from "@/store/documentStore";
import { getDocumentBlob } from "@/services/storage/DocumentStore";
import { loadPdf, renderPage, extractNativeText, extractNativeTextLines } from "@/services/pdf/PdfService";
import { tesseractService } from "@/services/ocr/TesseractService";
import {
  INVOICE_COLUMNS,
  InvoiceRecord,
  extractInvoiceRecordFromLines,
} from "@/services/invoice/InvoiceExtractorService";
import { writeInvoiceTable } from "@/services/excel/ExcelService";

export function InvoicePanel() {
  const documents = useDocumentStore((s) => s.documents);
  const pdfs = documents.filter((d) => d.type === "pdf");

  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState("");
  const [results, setResults] = useState<{ name: string; record: InvoiceRecord }[]>([]);
  const [written, setWritten] = useState(false);

  const handleExtractAll = async () => {
    setRunning(true);
    setWritten(false);
    const extracted: { name: string; record: InvoiceRecord }[] = [];

    for (let i = 0; i < pdfs.length; i++) {
      const doc = pdfs[i];
      setProgress(`${i + 1}/${pdfs.length}: ${doc.name}`);

      const buffer = await getDocumentBlob(doc.id);
      if (!buffer) continue;

      const pdfDoc = await loadPdf(doc.id, buffer);
      const pages = Array.from({ length: pdfDoc.numPages }, (_, j) => j + 1);

      // Try native text first (line-structured)
      const nativeLineArrays = await Promise.all(
        pages.map((p) => extractNativeTextLines(pdfDoc, p))
      );
      let allLines: string[] = nativeLineArrays.flat();
      const nativeText = allLines.join(" ").trim();

      // Fallback to OCR if native text is too short
      if (nativeText.length <= 30) {
        setProgress(`${i + 1}/${pdfs.length}: ${doc.name} (OCR...)`);
        const ocrLines: string[] = [];
        for (const pageNum of pages) {
          const offscreen = document.createElement("canvas");
          await renderPage(pdfDoc, pageNum, 2.0, offscreen);
          const result = await tesseractService.recognise(offscreen, doc.id, pageNum);
          // OCR blocks already have natural line order
          result.blocks.forEach((b) => {
            b.text.split(/\r?\n/).forEach((l) => {
              const t = l.trim();
              if (t) ocrLines.push(t);
            });
          });
        }
        allLines = ocrLines;
      }

      extracted.push({ name: doc.name, record: extractInvoiceRecordFromLines(allLines) });
    }

    setResults(extracted);
    setProgress("");

    // Write to Excel
    if (extracted.length > 0) {
      const rows = extracted.map((e) =>
        INVOICE_COLUMNS.map((col) => e.record[col])
      );
      await writeInvoiceTable(INVOICE_COLUMNS, rows);
      setWritten(true);
    }

    setRunning(false);
  };

  return (
    <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ fontSize: 13, fontWeight: 600 }}>Rechnungen auslesen</div>

      <div style={{ fontSize: 12, color: "#555" }}>
        {pdfs.length === 0
          ? "Keine PDFs geladen. Bitte zuerst Rechnungen im Dokumente-Tab hochladen."
          : `${pdfs.length} PDF${pdfs.length > 1 ? "s" : ""} geladen.`}
      </div>

      <Button
        appearance="primary"
        disabled={pdfs.length === 0 || running}
        onClick={handleExtractAll}
      >
        {running ? "Auslesen..." : "Alle Rechnungen auslesen → Excel"}
      </Button>

      {progress && (
        <div style={{ fontSize: 11, color: "#0078d4" }}>{progress}</div>
      )}

      {written && (
        <div style={{ fontSize: 12, color: "#107c10", fontWeight: 500 }}>
          {results.length} Rechnung(en) nach Excel geschrieben (ab Zeile A1).
        </div>
      )}

      {/* Preview table */}
      {results.length > 0 && (
        <div style={{ overflowX: "auto", marginTop: 8 }}>
          <table style={{ fontSize: 10, borderCollapse: "collapse", width: "100%" }}>
            <thead>
              <tr>
                <th style={th}>Datei</th>
                {INVOICE_COLUMNS.map((col) => (
                  <th key={col} style={th}>{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {results.map((r, i) => (
                <tr key={i}>
                  <td style={td}>{r.name}</td>
                  {INVOICE_COLUMNS.map((col) => (
                    <td key={col} style={{ ...td, color: r.record[col] ? "#000" : "#bbb" }}>
                      {r.record[col] || "–"}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const th: React.CSSProperties = {
  textAlign: "left",
  padding: "3px 6px",
  borderBottom: "1px solid #ccc",
  background: "#f0f0f0",
  whiteSpace: "nowrap",
};

const td: React.CSSProperties = {
  padding: "3px 6px",
  borderBottom: "1px solid #eee",
  whiteSpace: "nowrap",
  maxWidth: 120,
  overflow: "hidden",
  textOverflow: "ellipsis",
};
