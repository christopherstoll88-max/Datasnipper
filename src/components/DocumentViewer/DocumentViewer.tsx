import React, { useEffect, useRef, useState, useCallback } from "react";
import { Button } from "@fluentui/react-components";
import { SelectionOverlay } from "./SelectionOverlay";
import { useDocumentStore } from "@/store/documentStore";
import { useSnipStore } from "@/store/snipStore";
import { getDocumentBlob } from "@/services/storage/DocumentStore";
import { loadPdf, renderPage } from "@/services/pdf/PdfService";
import { pixelToNorm, normToPixel, cropCanvas, rectFromPoints } from "@/utils/geometry";
import { tesseractService } from "@/services/ocr/TesseractService";
import { writeCellLink, getActiveCell } from "@/services/excel/ExcelService";
import { useAuditStore } from "@/store/auditStore";
import { CellLink } from "@/models/CellLink";
import { DocumentRegion } from "@/models/Region";

interface Props {
  documentId: string;
}

export function DocumentViewer({ documentId }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState<string | null>(null);

  const { documents, currentPage, totalPages, zoom, setCurrentPage, setTotalPages } =
    useDocumentStore();
  const doc = documents.find((d) => d.id === documentId);

  const { phase, startSnip, setRegion, setOcrProgress, setOcrResult, awaitCell, reset } =
    useSnipStore();
  const addRecord = useAuditStore((s) => s.addRecord);

  // Render current page
  useEffect(() => {
    if (!doc || !canvasRef.current) return;
    let cancelled = false;

    const render = async () => {
      try {
        const buffer = await getDocumentBlob(documentId);
        if (!buffer) return;

        if (doc.type === "pdf") {
          const pdfDoc = await loadPdf(documentId, buffer);
          if (cancelled) return;
          setTotalPages(pdfDoc.numPages);
          await renderPage(pdfDoc, currentPage, zoom, canvasRef.current!);
        } else {
          // Image
          setTotalPages(1);
          const blob = new Blob([buffer]);
          const url = URL.createObjectURL(blob);
          const img = new Image();
          img.onload = () => {
            if (cancelled) return;
            const canvas = canvasRef.current!;
            canvas.width = img.width * zoom;
            canvas.height = img.height * zoom;
            const ctx = canvas.getContext("2d")!;
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            URL.revokeObjectURL(url);
          };
          img.src = url;
        }
      } catch (e) {
        setError(String(e));
      }
    };

    render();
    return () => { cancelled = true; };
  }, [documentId, currentPage, zoom, doc]);

  const handleRegionSelected = useCallback(
    async (x1: number, y1: number, x2: number, y2: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const pixelRect = rectFromPoints(x1, y1, x2, y2);
      const normRect = pixelToNorm(pixelRect, canvas.width, canvas.height);

      const region: DocumentRegion = {
        documentId,
        pageNumber: currentPage,
        ...normRect,
      };

      setRegion(region);

      // Crop and OCR
      const cropped = cropCanvas(canvas, pixelRect);
      region.pixelSnapshot = cropped.toDataURL("image/png");

      try {
        const ocrResult = await tesseractService.recognise(
          cropped,
          documentId,
          currentPage,
          (p) => setOcrProgress(p)
        );
        setOcrResult(ocrResult, 1);

        const text = ocrResult.blocks.map((b) => b.text).join(" ").trim();
        const confidence =
          ocrResult.blocks.length > 0
            ? ocrResult.blocks.reduce((s, b) => s + b.confidence, 0) / ocrResult.blocks.length
            : 0;

        awaitCell();

        // Wait for user to click a cell
        const { writeCellLink: writeLink, onSelectionChange } = await import("@/services/excel/ExcelService");
        const { getWorkbookId } = await import("@/utils/officeHelpers");

        const unsubscribe = onSelectionChange(async (sheet, address) => {
          unsubscribe();

          const cellLink: CellLink = {
            id: crypto.randomUUID(),
            workbookId: getWorkbookId(),
            sheetName: sheet,
            cellAddress: address,
            region,
            extractedText: text,
            extractedType: "raw_text",
            confidence,
          };

          await writeLink(cellLink);
          await addRecord({
            id: crypto.randomUUID(),
            timestamp: Date.now(),
            action: "snip",
            cellLink,
            newValue: text,
          });

          reset();
        });
      } catch (e) {
        setError(String(e));
        reset();
      }
    },
    [documentId, currentPage, setRegion, setOcrProgress, setOcrResult, awaitCell, addRecord, reset]
  );

  if (error) {
    return <div style={{ padding: 12, color: "#c00" }}>Fehler: {error}</div>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
      {/* Toolbar */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 8px", borderBottom: "1px solid #e0e0e0", background: "#f8f8f8" }}>
        <Button
          size="small"
          appearance={phase === "selecting" ? "primary" : "secondary"}
          onClick={() => phase === "idle" ? startSnip() : reset()}
        >
          {phase === "selecting" ? "✕ Abbrechen" : "✂ Snip"}
        </Button>

        {phase === "awaiting_cell" && (
          <span style={{ fontSize: 11, color: "#0078d4" }}>
            → Zielzelle in Excel anklicken
          </span>
        )}

        <div style={{ flex: 1 }} />

        {totalPages > 1 && (
          <>
            <Button size="small" disabled={currentPage <= 1} onClick={() => setCurrentPage(currentPage - 1)}>‹</Button>
            <span style={{ fontSize: 12 }}>{currentPage} / {totalPages}</span>
            <Button size="small" disabled={currentPage >= totalPages} onClick={() => setCurrentPage(currentPage + 1)}>›</Button>
          </>
        )}

        <Button size="small" onClick={() => useDocumentStore.getState().setZoom(zoom - 0.25)}>−</Button>
        <span style={{ fontSize: 11 }}>{Math.round(zoom * 100)}%</span>
        <Button size="small" onClick={() => useDocumentStore.getState().setZoom(zoom + 0.25)}>+</Button>
      </div>

      {/* Canvas + overlay */}
      <div style={{ flex: 1, overflow: "auto", position: "relative", background: "#666" }}>
        <div style={{ display: "inline-block", position: "relative" }}>
          <canvas ref={canvasRef} style={{ display: "block" }} />
          <SelectionOverlay
            active={phase === "selecting"}
            onSelect={handleRegionSelected}
          />
        </div>
      </div>
    </div>
  );
}
