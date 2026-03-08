/** Normalised [0,1] coordinates, origin = top-left of page */
export interface DocumentRegion {
  documentId: string;
  pageNumber: number; // 1-indexed
  x: number;
  y: number;
  width: number;
  height: number;
  /** base64 thumbnail of the cropped region (not persisted to custom properties) */
  pixelSnapshot?: string;
}
