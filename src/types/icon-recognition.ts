export type ConfidenceLevel = "high" | "medium" | "low";
export type FindSource = "accessibility" | "ocr" | "visual" | "grid";
export type FindTier = 1 | 2 | 3 | 4 | 5;

export interface VisualCandidate {
  index: number;
  bounds: string; // "[x0,y0][x1,y1]"
  center: { x: number; y: number };
  image: string; // base64 JPEG
}

export interface GridPosition {
  cell: number; // 1-24
  position: 1 | 2 | 3 | 4 | 5; // TL, TR, C, BL, BR
  x: number;
  y: number;
}

export interface FindWithFallbacksResult {
  elements: unknown[]; // AccessibilityNode | OcrElement | VisualCandidate
  source: FindSource;
  tier?: FindTier;
  confidence?: ConfidenceLevel;
  fallbackReason?: string;

  // Tier 4: Visual candidates
  candidates?: VisualCandidate[];
  truncated?: boolean;
  totalCandidates?: number;

  // Tier 5: Grid fallback
  gridImage?: string; // base64 PNG with overlay
  gridCell?: number;
  gridPositions?: string[];

  // Visual fallback (existing)
  visualFallback?: import("./config.js").VisualSnapshot;
}

export interface FindOptions {
  debug?: boolean;
  includeVisualFallback?: boolean;
  includeBase64?: boolean;
  gridCell?: number; // For Tier 5 refinement
  gridPosition?: 1 | 2 | 3 | 4 | 5; // For Tier 5 final selection
}
