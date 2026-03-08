import React, { useRef, useState, useCallback } from "react";

interface Props {
  active: boolean;
  onSelect: (x1: number, y1: number, x2: number, y2: number) => void;
}

interface DragState {
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
}

export function SelectionOverlay({ active, onSelect }: Props) {
  const [drag, setDrag] = useState<DragState | null>(null);
  const overlayRef = useRef<SVGSVGElement>(null);

  const getRelativePos = (e: React.MouseEvent) => {
    const rect = overlayRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (!active) return;
      e.preventDefault();
      const { x, y } = getRelativePos(e);
      setDrag({ startX: x, startY: y, currentX: x, currentY: y });
    },
    [active]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!drag) return;
      const { x, y } = getRelativePos(e);
      setDrag((d) => d ? { ...d, currentX: x, currentY: y } : null);
    },
    [drag]
  );

  const handleMouseUp = useCallback(
    (e: React.MouseEvent) => {
      if (!drag) return;
      const { x, y } = getRelativePos(e);
      const w = Math.abs(x - drag.startX);
      const h = Math.abs(y - drag.startY);
      if (w > 5 && h > 5) {
        onSelect(drag.startX, drag.startY, x, y);
      }
      setDrag(null);
    },
    [drag, onSelect]
  );

  // Compute selection rect for display
  const selRect = drag
    ? {
        x: Math.min(drag.startX, drag.currentX),
        y: Math.min(drag.startY, drag.currentY),
        width: Math.abs(drag.currentX - drag.startX),
        height: Math.abs(drag.currentY - drag.startY),
      }
    : null;

  return (
    <svg
      ref={overlayRef}
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        cursor: active ? "crosshair" : "default",
        pointerEvents: active ? "all" : "none",
        userSelect: "none",
      }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {selRect && selRect.width > 0 && selRect.height > 0 && (
        <>
          {/* Dimming overlay */}
          <rect x="0" y="0" width="100%" height="100%" fill="rgba(0,0,0,0.3)" />
          {/* Selection cutout */}
          <rect
            x={selRect.x}
            y={selRect.y}
            width={selRect.width}
            height={selRect.height}
            fill="transparent"
            stroke="#0078d4"
            strokeWidth={2}
            strokeDasharray="6 3"
          />
        </>
      )}
    </svg>
  );
}
