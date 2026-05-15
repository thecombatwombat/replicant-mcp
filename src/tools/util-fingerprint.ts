import { AccessibilityNode } from "../parsers/ui-dump.js";
import { FindElement } from "../types/icon-recognition.js";

// Local guard to avoid a circular import with ui-find.ts (which re-exports
// isAccessibilityNode). The shape check is the same: AccessibilityNode is
// the only FindElement variant that carries centerX + className.
function isAccessibilityNode(el: FindElement): el is AccessibilityNode {
  return "centerX" in el && "className" in el;
}

/**
 * THE-112 (CU-8): cross-call element stability check.
 *
 * `ui-query find` stores results in `context.lastFindResults` so `ui-action`
 * can refer to them by `elementIndex`. Between the two calls the screen can
 * change — a list scrolls, a dialog dismisses, a transient toast appears —
 * and the cached centerX/centerY now points at something else entirely.
 *
 * We compute a content fingerprint of each element at find time and re-compute
 * it at consume time. If the recomputed value of the node currently at the
 * cached location differs (or no node exists there), the index is STALE and
 * ui-action rejects with STALE_ELEMENT_INDEX rather than tapping the wrong
 * thing.
 *
 * Fingerprint = text|resourceId|className|bounds. Lightweight (no hashing
 * library), deterministic, and stable across redundant dumps of the same
 * frame. Non-accessibility elements (OCR, grid) get an empty fingerprint —
 * they don't have stable identity anyway, so we skip the stale check.
 */

const SEP = "";

export function computeAccessibilityFingerprint(node: AccessibilityNode): string {
  // Some test/mock fixtures omit bounds. Treat missing bounds as 0,0,0,0 —
  // the fingerprint still works as an identity comparison and any real dump
  // from `parseUiDump` populates the field.
  const b = node.bounds ?? { left: 0, top: 0, right: 0, bottom: 0 };
  return [
    node.text ?? "",
    node.resourceId ?? "",
    node.className ?? "",
    `${b.left},${b.top},${b.right},${b.bottom}`,
  ].join(SEP);
}

export function computeElementFingerprint(el: FindElement): string {
  if (isAccessibilityNode(el)) {
    return computeAccessibilityFingerprint(el);
  }
  // OCR/grid elements have no stable identity across calls — skip the check.
  return "";
}

export function computeFingerprints(elements: FindElement[]): string[] {
  return elements.map(computeElementFingerprint);
}
