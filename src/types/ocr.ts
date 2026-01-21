export interface OcrBounds {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export interface OcrResult {
  text: string;
  confidence: number;
  bounds: OcrBounds;
}

export interface OcrElement {
  index: number;
  text: string;
  bounds: string; // Format: "[x0,y0][x1,y1]" for consistency with accessibility
  center: { x: number; y: number };
  confidence: number;
}
