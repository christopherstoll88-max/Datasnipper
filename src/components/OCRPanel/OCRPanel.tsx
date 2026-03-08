import React, { useState } from "react";
import { Button, ProgressBar, Spinner } from "@fluentui/react-components";
import { useDocumentStore } from "@/store/documentStore";
import { useAuditStore } from "@/store/auditStore";
import { getDocumentBlob } from "@/services/storage/DocumentStore";
import { loadPdf, renderPage } from "@/services/pdf/PdfService";
import { tesseractService } from "@/services/ocr/TesseractService";
import { extractAmounts } from "@/services/extraction/AmountExtractor";
import { extractDates } from "@/services/extraction/DateExtractor";
import { extractTables, tableToTsv } from "@/services/extraction/TableExtractor";
import { writeCellLink, onSelectionChange } from "@/services/excel/ExcelService";
import { getWorkbookId } from "@/utils/officeHelpers";
import { OcrResult } from "@/models/OcrResult";
import { CellLink } from "@/models/CellLink";

export function OCRPanel() {
  const { activeDocumentId, documents, currentPage, zoom } = useDocumentStore();
  const addRecord = useAuditStore((s) => s.addRecord);
  const activeDoc = documents.find((d) => d.id === activeDocumentId);

  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<OcrResult | null>(null);
  const [awaitingCell, setAwaitingCell] = useState<string | null>(null);

  const runOcr = async () => {
    if (!activeDocumentId || !activeDoc) return;
    setRunning(true);
    setProgress(0);
    setResult(null);

    try {
      const buffer = await getDocumentBlob(activeDocumentId);
      if (!buffer) throw new Error("Dokument nicht gefunden");

      // Render to offscreen canvas
      const canvas = document.createElement("canvas");
      if (activeDoc.type === "pdf") {
        const pdfDoc = await loadPdf(activeDocumentId, buffer);
        await renderPage(pdfDoc, currentPage, zoom, canvas);
      } else {
        await new Promise<void>((res) => {
          const img = new Image();
          img.onload = () => {
            canvas.width = img.width;
            canvas.height = img.height;
            canvas.getContext("2d")!.drawImage(img, 0, 0);
            res();
          };
          img.src = URL.createObjectURL(new Blob([buffer]));
        });
      }

      const ocrResult = await tesseractService.recognise(
        canvas,
        activeDocumentId,
        currentPage,
        setProgress
      );
      setResult(ocrResult);
    } catch (e) {
      console.error(e);
    } finally {
      setRunning(false);
      setProgress(1);
    }
  };

  const insertToCell = async (text: string, type: CellLink["extractedType"]) => {
    if (!result || !activeDocumentId) return;
    setAwaitingCell(text);

    const unsub = onSelectionChange(async (sheet, address) => {
      unsub();
      setAwaitingCell(null);

      const link: CellLink = {
        id: crypto.randomUUID(),
        workbookId: getWorkbookId(),
        sheetName: sheet,
        cellAddress: address,
        region: {
          documentId: activeDocumentId,
          pageNumber: currentPage,
          x: 0, y: 0, width: 1, height: 1,
        },
        extractedText: text,
        extractedType: type,
        confidence: 90,
      };

      await writeCellLink(link);
      await addRecord({
        id: crypto.randomUUID(),
        timestamp: Date.now(),
        action: "ocr_extract",
        cellLink: link,
        newValue: text,
      });
    });
  };

  const fullText = result?.blocks.map((b) => b.text).join(" ") ?? "";
  const amounts = result ? extractAmounts(result.blocks) : [];
  const dates = result ? extractDates(result.blocks) : [];
  const tables = result ? extractTables(result.blocks) : [];

  return (
    <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 12 }}>
      {!activeDocumentId ? (
        <p style={{ color: "#888", fontSize: 12 }}>Zuerst ein Dokument im Tab "Dokumente" öffnen.</p>
      ) : (
        <>
          <Button appearance="primary" onClick={runOcr} disabled={running}>
            {running ? <Spinner size="tiny" /> : "🔍"} OCR auf Seite {currentPage} ausführen
          </Button>

          {running && (
            <ProgressBar value={progress} max={1} />
          )}

          {awaitingCell && (
            <div style={{ padding: 8, background: "#fff3cd", borderRadius: 4, fontSize: 12 }}>
              → Zielzelle in Excel anklicken um "{awaitingCell.slice(0, 30)}…" einzufügen
            </div>
          )}

          {result && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {/* Full text */}
              <Section title="Volltext">
                <pre style={{ fontSize: 11, whiteSpace: "pre-wrap", maxHeight: 120, overflow: "auto" }}>
                  {fullText || "(kein Text erkannt)"}
                </pre>
                {fullText && (
                  <Button size="small" onClick={() => insertToCell(fullText, "raw_text")}>
                    → In Zelle einfügen
                  </Button>
                )}
              </Section>

              {/* Amounts */}
              {amounts.length > 0 && (
                <Section title={`Beträge (${amounts.length})`}>
                  {amounts.map((a, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
                      <span style={{ flex: 1 }}>{a.currency ?? ""}{a.negative ? "-" : ""}{a.value.toLocaleString("de-DE", { minimumFractionDigits: 2 })}</span>
                      <Button size="small" onClick={() => insertToCell(String(a.value), "amount")}>→</Button>
                    </div>
                  ))}
                </Section>
              )}

              {/* Dates */}
              {dates.length > 0 && (
                <Section title={`Datumsangaben (${dates.length})`}>
                  {dates.map((d, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
                      <span style={{ flex: 1 }}>{d.raw} → {d.formatted}</span>
                      <Button size="small" onClick={() => insertToCell(d.formatted, "date")}>→</Button>
                    </div>
                  ))}
                </Section>
              )}

              {/* Tables */}
              {tables.length > 0 && (
                <Section title={`Tabellen (${tables.length})`}>
                  {tables.map((table, i) => (
                    <div key={i}>
                      <table style={{ fontSize: 11, borderCollapse: "collapse", width: "100%" }}>
                        <tbody>
                          {table.map((row, ri) => (
                            <tr key={ri}>
                              {row.map((cell, ci) => (
                                <td key={ci} style={{ border: "1px solid #ddd", padding: "2px 4px" }}>
                                  {cell}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      <Button size="small" onClick={() => insertToCell(tableToTsv(table), "table_row")}>
                        → Tabelle einfügen
                      </Button>
                    </div>
                  ))}
                </Section>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ border: "1px solid #e0e0e0", borderRadius: 4, overflow: "hidden" }}>
      <div style={{ padding: "4px 8px", background: "#f0f0f0", fontWeight: 600, fontSize: 12 }}>
        {title}
      </div>
      <div style={{ padding: 8, display: "flex", flexDirection: "column", gap: 4 }}>
        {children}
      </div>
    </div>
  );
}
