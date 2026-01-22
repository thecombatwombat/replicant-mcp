import { AccessibilityNode } from "../parsers/ui-dump.js";

export const MIN_ICON_SIZE = 16;
export const MAX_ICON_SIZE = 200;
export const MIN_ASPECT_RATIO = 0.5;
export const MAX_ASPECT_RATIO = 2.0;
export const MAX_CANDIDATES = 6;

/**
 * Check if dimensions are within icon size constraints.
 */
export function isIconSized(width: number, height: number): boolean {
  if (width < MIN_ICON_SIZE || width > MAX_ICON_SIZE) return false;
  if (height < MIN_ICON_SIZE || height > MAX_ICON_SIZE) return false;

  const aspectRatio = width / height;
  if (aspectRatio < MIN_ASPECT_RATIO || aspectRatio > MAX_ASPECT_RATIO) return false;

  return true;
}

/**
 * Filter accessibility nodes to find unlabeled clickable elements that are icon-sized.
 * Returns max 6 candidates sorted by position (top-to-bottom, left-to-right).
 */
export function filterIconCandidates(nodes: AccessibilityNode[]): AccessibilityNode[] {
  const candidates = nodes.filter((node) => {
    // Must be clickable
    if (!node.clickable) return false;

    // Must not have text or contentDesc (we're looking for unlabeled icons)
    if (node.text || node.contentDesc) return false;

    // Must be icon-sized
    const width = node.bounds.right - node.bounds.left;
    const height = node.bounds.bottom - node.bounds.top;
    if (!isIconSized(width, height)) return false;

    return true;
  });

  // Sort by Y first (top-to-bottom), then X (left-to-right)
  candidates.sort((a, b) => {
    if (a.centerY !== b.centerY) return a.centerY - b.centerY;
    return a.centerX - b.centerX;
  });

  // Limit to max candidates
  return candidates.slice(0, MAX_CANDIDATES);
}

/**
 * Format candidate bounds as string "[x0,y0][x1,y1]"
 */
export function formatBounds(node: AccessibilityNode): string {
  return `[${node.bounds.left},${node.bounds.top}][${node.bounds.right},${node.bounds.bottom}]`;
}
