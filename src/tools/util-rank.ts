import { AccessibilityNode } from "../parsers/ui-dump.js";
import { FindElement } from "../types/icon-recognition.js";
import { isAccessibilityNode } from "./ui-find.js";

// THE-108: rank candidate matches by tappability. Heuristics:
//   + strong bonus for clickable
//   + medium bonus for long-clickable
//   + small bonus for focusable
//   - penalty proportional to bounding-box area (smaller = better)
//   - heavy penalty for candidates whose area is >= 90% of the largest area
//     in the candidate set (treated as a full-screen / root container)
// Non-accessibility candidates (OCR, grid) score 0 — they're already
// point-shaped tap targets and the heuristic doesn't apply.

const ROOT_AREA_RATIO = 0.9;
const ROOT_PENALTY = 10000;

export interface RankResult<T> {
  ranked: T[];
  pickedRationale?: string;
  alternativeSummaries?: Array<Record<string, unknown>>;
}

function nodeArea(node: AccessibilityNode): number {
  const { bounds: b } = node;
  return Math.max(0, b.right - b.left) * Math.max(0, b.bottom - b.top);
}

function scoreAxNode(node: AccessibilityNode, maxAreaInSet: number): number {
  let score = 0;
  if (node.clickable) score += 1000;
  if (node.longClickable) score += 500;
  if (node.focusable) score += 100;
  const area = nodeArea(node);
  score -= area;
  if (maxAreaInSet > 0 && area >= maxAreaInSet * ROOT_AREA_RATIO) {
    score -= ROOT_PENALTY;
  }
  return score;
}

function summarizeAxNode(node: AccessibilityNode): Record<string, unknown> {
  return {
    text: node.text || node.contentDesc || undefined,
    resourceId: node.resourceId || undefined,
    className: node.className,
    centerX: node.centerX,
    centerY: node.centerY,
    bounds: node.bounds,
    clickable: node.clickable,
  };
}

function summarizeFindElement(el: FindElement): Record<string, unknown> {
  if (isAccessibilityNode(el)) return summarizeAxNode(el);
  return {
    text: (el as { text?: string }).text,
    center: (el as { center?: unknown }).center,
    bounds: (el as { bounds?: unknown }).bounds,
  };
}

export function rankBestTappable<T extends FindElement>(elements: T[]): RankResult<T> {
  if (elements.length <= 1) return { ranked: elements };

  const axElements = elements.filter((e): e is T & AccessibilityNode => isAccessibilityNode(e));
  const maxArea = axElements.reduce((max, n) => Math.max(max, nodeArea(n)), 0);

  const scored = elements.map((el) => {
    const ax = isAccessibilityNode(el) ? (el as unknown as AccessibilityNode) : null;
    return {
      el,
      ax,
      score: ax ? scoreAxNode(ax, maxArea) : 0,
      area: ax ? nodeArea(ax) : null,
    };
  });

  scored.sort((a, b) => b.score - a.score);

  const ranked = scored.map((s) => s.el);
  const top = scored[0];
  const topNode = top.ax;

  const reasons: string[] = [];
  if (topNode?.clickable) reasons.push("clickable=true");
  if (topNode?.longClickable) reasons.push("long-clickable=true");
  if (topNode?.focusable) reasons.push("focusable=true");
  if (top.area !== null) {
    reasons.push(`bbox area ${top.area} px²` + (maxArea > 0 ? ` (of ${maxArea} max)` : ""));
  }
  reasons.push(`score=${top.score}`);

  const pickedRationale = `bestTappable picked candidate #0: ${reasons.join(", ")}`;

  const alternativeSummaries = scored.slice(1).map((s) => ({
    ...summarizeFindElement(s.el),
    rankScore: s.score,
  }));

  return { ranked, pickedRationale, alternativeSummaries };
}
