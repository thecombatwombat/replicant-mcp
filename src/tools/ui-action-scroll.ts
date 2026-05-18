import { ServerContext } from "../server.js";
import { ReplicantError, ErrorCode, UiConfig } from "../types/index.js";
import { isAccessibilityNode } from "./ui-find.js";
import { AccessibilityNode, flattenTree } from "../parsers/ui-dump.js";
import { FindElement } from "../types/icon-recognition.js";

// Handler for the `scroll` op on ui-action. Lives in its own module so
// ui-action.ts stays under the 500-line file cap once CU-9's verify path
// pushes handleInput beyond its previous size.

export interface ScrollOpInput {
  direction?: "up" | "down" | "left" | "right";
  amount?: number;
  selector?: {
    resourceId?: string;
    text?: string;
    textContains?: string;
    className?: string;
    nearestTo?: string;
    rank?: "bestTappable";
  };
}

export interface ScrollOpDeps {
  resolveSelector: (
    input: ScrollOpInput,
    context: ServerContext,
    config: UiConfig,
    deviceId: string,
  ) => Promise<{ elements: FindElement[]; candidates?: unknown; visualFallback?: unknown }>;
  pickSelectorMatch: (
    resolution: { elements: FindElement[]; candidates?: unknown; visualFallback?: unknown },
    selector: NonNullable<ScrollOpInput["selector"]>,
    operation: "scroll",
  ) => FindElement;
}

function isScrollableContainer(node: AccessibilityNode): boolean {
  if (node.scrollable !== undefined) return node.scrollable;
  const scrollableClassFragments = [
    "ScrollView",
    "RecyclerView",
    "ListView",
    "ViewPager",
    "AndroidComposeView",
    "ComposeView",
    "GridView",
    "Gallery",
    "NumberPicker",
  ];
  return scrollableClassFragments.some((fragment) => node.className.includes(fragment));
}

function findScrollableAncestor(
  tree: AccessibilityNode[],
  target: AccessibilityNode,
): AccessibilityNode | null {
  const flat = flattenTree(tree);
  let best: AccessibilityNode | null = null;
  let smallestArea = Infinity;
  for (const node of flat) {
    if (!isScrollableContainer(node)) continue;
    const { bounds: b } = node;
    if (
      target.centerX >= b.left &&
      target.centerX <= b.right &&
      target.centerY >= b.top &&
      target.centerY <= b.bottom
    ) {
      const area = (b.right - b.left) * (b.bottom - b.top);
      if (area < smallestArea) {
        smallestArea = area;
        best = node;
      }
    }
  }
  return best;
}

export async function handleScrollOp(
  input: ScrollOpInput,
  context: ServerContext,
  config: UiConfig,
  deviceId: string,
  deps: ScrollOpDeps,
): Promise<Record<string, unknown>> {
  if (!input.direction) {
    throw new ReplicantError(
      ErrorCode.INPUT_VALIDATION_FAILED,
      "direction is required for scroll operation",
      "Provide a direction: up, down, left, or right",
    );
  }
  const amount = input.amount ?? 0.5;

  if (input.selector) {
    const resolution = await deps.resolveSelector(input, context, config, deviceId);
    const target = deps.pickSelectorMatch(resolution, input.selector, "scroll");
    if (!isAccessibilityNode(target)) {
      // OCR/grid match — fall back to screen-center scroll with a warning.
      await context.ui.scroll(deviceId, input.direction, amount);
      return {
        scrolled: { direction: input.direction, amount },
        deviceId,
        warning: "selector resolved to a non-accessibility match; scrolled the screen center.",
      };
    }
    const tree = await context.ui.dump(deviceId);
    const scrollable = findScrollableAncestor(tree, target);
    if (!scrollable) {
      await context.ui.scroll(deviceId, input.direction, amount);
      return {
        scrolled: { direction: input.direction, amount },
        deviceId,
        warning: "no scrollable container found; scrolled the screen center.",
      };
    }
    await context.ui.scroll(deviceId, input.direction, amount, scrollable.bounds);
    return {
      scrolled: { direction: input.direction, amount, container: scrollable.className },
      deviceId,
      matchedSelector: input.selector,
    };
  }

  await context.ui.scroll(deviceId, input.direction, amount);
  return { scrolled: { direction: input.direction, amount }, deviceId };
}
