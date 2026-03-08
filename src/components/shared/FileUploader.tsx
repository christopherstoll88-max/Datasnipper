import React, { useRef, useState, DragEvent } from "react";
import { Button } from "@fluentui/react-components";

interface FileUploaderProps {
  onFile: (file: File) => void;
  accept?: string;
}

export function FileUploader({ onFile, accept = ".pdf,.png,.jpg,.jpeg,.tiff" }: FileUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) onFile(file);
  };

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      style={{
        border: `2px dashed ${dragging ? "#0078d4" : "#bbb"}`,
        borderRadius: 8,
        padding: 24,
        textAlign: "center",
        background: dragging ? "#e8f0fe" : "#fafafa",
        cursor: "pointer",
        transition: "all 0.2s",
      }}
      onClick={() => inputRef.current?.click()}
    >
      <div style={{ fontSize: 32, marginBottom: 8 }}>📄</div>
      <div style={{ color: "#555", marginBottom: 12 }}>
        PDF oder Bild hierher ziehen
        <br />
        <span style={{ fontSize: 12, color: "#999" }}>oder klicken zum Auswählen</span>
      </div>
      <Button size="small" appearance="primary">Datei auswählen</Button>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        style={{ display: "none" }}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onFile(file);
          e.target.value = "";
        }}
      />
    </div>
  );
}
