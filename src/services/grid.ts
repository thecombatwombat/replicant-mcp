// src/services/grid.ts
import sharp from "sharp";

export const GRID_COLS = 4;
export const GRID_ROWS = 6;
export const TOTAL_CELLS = GRID_COLS * GRID_ROWS; // 24

export interface CellBounds {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/**
 * Calculate the pixel bounds for a grid cell (1-24).
 * Grid is 4 columns x 6 rows, numbered left-to-right, top-to-bottom.
 */
export function calculateGridCellBounds(
  cell: number,
  screenWidth: number,
  screenHeight: number
): CellBounds {
  if (cell < 1 || cell > TOTAL_CELLS) {
    throw new Error(`Invalid cell number: ${cell}. Must be 1-${TOTAL_CELLS}`);
  }

  const cellWidth = screenWidth / GRID_COLS;
  const cellHeight = screenHeight / GRID_ROWS;

  // Convert 1-based cell to 0-based row/col
  const index = cell - 1;
  const col = index % GRID_COLS;
  const row = Math.floor(index / GRID_COLS);

  return {
    x0: Math.round(col * cellWidth),
    y0: Math.round(row * cellHeight),
    x1: Math.round((col + 1) * cellWidth),
    y1: Math.round((row + 1) * cellHeight),
  };
}

/**
 * Calculate tap coordinates for a position within a cell.
 * Position: 1=TL, 2=TR, 3=Center, 4=BL, 5=BR
 */
export function calculatePositionCoordinates(
  position: 1 | 2 | 3 | 4 | 5,
  cellBounds: CellBounds
): { x: number; y: number } {
  const width = cellBounds.x1 - cellBounds.x0;
  const height = cellBounds.y1 - cellBounds.y0;

  // Position multipliers (fraction of width/height from x0/y0)
  const positionMap: Record<number, { xMult: number; yMult: number }> = {
    1: { xMult: 0.25, yMult: 0.25 }, // Top-left
    2: { xMult: 0.75, yMult: 0.25 }, // Top-right
    3: { xMult: 0.5, yMult: 0.5 }, // Center
    4: { xMult: 0.25, yMult: 0.75 }, // Bottom-left
    5: { xMult: 0.75, yMult: 0.75 }, // Bottom-right
  };

  const { xMult, yMult } = positionMap[position];

  return {
    x: Math.round(cellBounds.x0 + width * xMult),
    y: Math.round(cellBounds.y0 + height * yMult),
  };
}

export const POSITION_LABELS = [
  "Top-left",
  "Top-right",
  "Center",
  "Bottom-left",
  "Bottom-right",
];

const GRID_LINE_WIDTH = 3;
const LABEL_FONT_SIZE = 36;

/**
 * Create a 4x6 numbered grid overlay on a screenshot.
 * Returns base64 PNG.
 */
export async function createGridOverlay(imagePath: string): Promise<string> {
  const image = sharp(imagePath);
  const metadata = await image.metadata();
  const width = metadata.width!;
  const height = metadata.height!;

  const cellWidth = width / GRID_COLS;
  const cellHeight = height / GRID_ROWS;

  // Create SVG overlay with grid lines and numbers
  const svgParts: string[] = [];

  // Grid lines (vertical)
  for (let col = 1; col < GRID_COLS; col++) {
    const x = Math.round(col * cellWidth);
    svgParts.push(
      `<line x1="${x}" y1="0" x2="${x}" y2="${height}" stroke="rgba(255,165,0,0.8)" stroke-width="${GRID_LINE_WIDTH}"/>`
    );
  }

  // Grid lines (horizontal)
  for (let row = 1; row < GRID_ROWS; row++) {
    const y = Math.round(row * cellHeight);
    svgParts.push(
      `<line x1="0" y1="${y}" x2="${width}" y2="${y}" stroke="rgba(255,165,0,0.8)" stroke-width="${GRID_LINE_WIDTH}"/>`
    );
  }

  // Cell numbers
  for (let cell = 1; cell <= TOTAL_CELLS; cell++) {
    const index = cell - 1;
    const col = index % GRID_COLS;
    const row = Math.floor(index / GRID_COLS);
    const centerX = Math.round((col + 0.5) * cellWidth);
    const centerY = Math.round((row + 0.5) * cellHeight);

    // Background circle for visibility
    svgParts.push(
      `<circle cx="${centerX}" cy="${centerY}" r="25" fill="rgba(0,0,0,0.6)"/>`
    );
    // Number text
    svgParts.push(
      `<text x="${centerX}" y="${centerY}" font-family="Arial, sans-serif" font-size="${LABEL_FONT_SIZE}" font-weight="bold" fill="white" text-anchor="middle" dominant-baseline="central">${cell}</text>`
    );
  }

  const svgOverlay = `<svg width="${width}" height="${height}">${svgParts.join("")}</svg>`;

  const buffer = await image
    .composite([{ input: Buffer.from(svgOverlay), top: 0, left: 0 }])
    .png()
    .toBuffer();

  return buffer.toString("base64");
}
