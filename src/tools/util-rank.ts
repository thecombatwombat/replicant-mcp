import { AccessibilityNode } from "../parsers/ui-dump.js";
import { FindElement } from "../types/icon-recognition.js";
import { isAccessibilityNode } from "./ui-find.js";

// THE-108: rank candidate matches by tappability. Heuristics:
//   + strong bonus for clickable
//   + medium bonus for long-clickable
//   + small bonus for focusable
//   - penalty proportional to sqrt(bounding-box area) — smaller = better,
//     but grows slowly enough that wide full-width rows still beat tiny
//     non-interactive labels (typical Android list rows are ~1080x120 ≈
//     130k px², while truly full-screen containers are millions of px²;
//     sqrt lets us distinguish those scales without overpowering the
//     clickable bonus for the merely-wide-row case).
// Non-accessibility candidates (OCR, grid) score 0 — they're already
// point-shaped tap targets and the heuristic doesn't apply.

// CU-4 follow-up #2: the first follow-up scaled bonuses 100x to fix a
// scoring inversion against tiny non-clickable peers, but a linear
// `-area` term still demoted common full-width row targets (~130k px²)
// below their non-clickable children. Switching to sqrt(area) flattens
// the penalty curve so it grows from ~6k @ 4000 px² to ~36k @ 130k px²
// to ~158k @ 2.5M px² — leaving the bonus (100k for clickable) dominant
// across the typical-target range and still demotive for full-screen
// containers.
const CLICKABLE_BONUS = 100000;
const LONG_CLICKABLE_BONUS = 50000;
const FOCUSABLE_BONUS = 10000;
const AREA_PENALTY_SCALE = 100;

export interface RankResult<T> {
  ranked: T[];
  pickedRationale?: string;
  alternativeSummaries?: Array<Record<string, unknown>>;
}

function nodeArea(node: AccessibilityNode): number {
  const { bounds: b } = node;
  return Math.max(0, b.right - b.left) * Math.max(0, b.bottom - b.top);
}

function scoreAxNode(node: AccessibilityNode): number {
  let score = 0;
  if (node.clickable) score += CLICKABLE_BONUS;
  if (node.longClickable) score += LONG_CLICKABLE_BONUS;
  if (node.focusable) score += FOCUSABLE_BONUS;
  score -= Math.sqrt(nodeArea(node)) * AREA_PENALTY_SCALE;
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

  // Local predicate so the generic T is narrowed to (T & AccessibilityNode)
  // inside the conditional. Sidesteps the need for an opaque cast.
  const isAx = (e: T): e is T & AccessibilityNode => isAccessibilityNode(e);

  const axElements = elements.filter(isAx);
  const maxArea = axElements.reduce((max, n) => Math.max(max, nodeArea(n)), 0);

  const scored = elements.map((el) => {
    const ax: AccessibilityNode | null = isAx(el) ? el : null;
    return {
      el,
      ax,
      score: ax ? scoreAxNode(ax) : 0,
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
