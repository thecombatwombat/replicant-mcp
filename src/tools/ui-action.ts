import { z } from "zod";
import { ServerContext } from "../server.js";
import { ReplicantError, ErrorCode, UiConfig } from "../types/index.js";
import { DEFAULT_CONFIG } from "../types/config.js";
import { getElementCenter, handleFind, isAccessibilityNode } from "./ui-find.js";
import { AccessibilityNode, flattenTree } from "../parsers/ui-dump.js";
import { FindElement } from "../types/icon-recognition.js";
import { rankBestTappable } from "./util-rank.js";
import { ScreenshotScalingEntry } from "./ui-capture.js";
import { toDeviceSpace } from "../services/scaling.js";
import { booleanInput, jsonObjectInput, numberInput, toolSchema } from "../schemas/inputs.js";
import { toMcpJsonSchema } from "../schemas/derive.js";

export const uiActionInputSchema = toolSchema({
  operation: z.enum(["tap", "input", "scroll"]),
  x: numberInput().optional(),
  y: numberInput().optional(),
  imageX: numberInput()
    .optional()
    .describe(
      "Image-space X coord. Pair with `screenshotId` to tap what you see in a screenshot without manually unscaling (THE-111).",
    ),
  imageY: numberInput()
    .optional()
    .describe("Image-space Y coord. See `imageX`."),
  screenshotId: z
    .string()
    .optional()
    .describe(
      "Screenshot id from a prior `ui-capture screenshot`. Combined with `imageX`/`imageY`, the tap is converted to device-space using THAT screenshot's scaling (not the global adapter state).",
    ),
  elementIndex: numberInput().optional(),
  selector: jsonObjectInput({
    resourceId: z.string().optional(),
    text: z.string().optional(),
    textContains: z.string().optional(),
    className: z.string().optional(),
    nearestTo: z.string().optional(),
    rank: z
      .enum(["bestTappable"])
      .optional()
      .describe(
        "Auto-pick the top-ranked match when matches > 1 (THE-108). Without this, ambiguous matches throw AMBIGUOUS_MATCH.",
      ),
  }).optional(),
  text: z.string().optional(),
  direction: z
    .enum(["up", "down", "left", "right"])
    .optional()
    .describe(
      "Scroll direction is gesture-based (the way the user's finger moves), NOT the direction content moves. So `down` = swipe up = content scrolls down = next page of a feed. `up` = swipe down = content scrolls up = pull-to-refresh territory. `left` / `right` mirror this for horizontal scrolling.",
    ),
  amount: numberInput({ min: 0, max: 1 })
    .optional()
    .describe("Scroll fraction (0-1, default: 0.5)"),
  deviceSpace: booleanInput()
    .optional()
    .describe("x/y in device-space (default true). Set false only for image-space coords."),
});

export type UiActionInput = z.infer<typeof uiActionInputSchema>;

type OperationHandler = (
  input: UiActionInput,
  context: ServerContext,
  config: UiConfig,
  deviceId: string,
) => Promise<Record<string, unknown>>;

const operations: Record<string, OperationHandler> = {
  tap: handleTap,
  input: handleInput,
  scroll: handleScroll,
};

export async function handleUiActionTool(
  input: UiActionInput,
  context: ServerContext,
  uiConfig?: UiConfig,
): Promise<Record<string, unknown>> {
  const device = await context.deviceState.ensureDevice(context.adb);
  const config = uiConfig ?? DEFAULT_CONFIG.ui;

  const handler = operations[input.operation];
  if (!handler) {
    throw new ReplicantError(
      ErrorCode.INVALID_OPERATION,
      `Unknown operation: ${input.operation}`,
      "Valid operations: tap, input, scroll",
    );
  }
  return handler(input, context, config, device.id);
}

function describeMatches(matches: FindElement[]): Array<Record<string, unknown>> {
  return matches.map((el, index) => {
    const base: Record<string, unknown> = { index };
    if (isAccessibilityNode(el)) {
      base.text = el.text || el.contentDesc || undefined;
      base.resourceId = el.resourceId || undefined;
      base.bounds = el.bounds;
    } else {
      base.text = (el as { text?: string }).text;
      base.center = (el as { center?: unknown }).center;
      base.bounds = (el as { bounds?: unknown }).bounds;
    }
    return base;
  });
}

interface SelectorResolution {
  elements: FindElement[];
  candidates?: unknown;
  visualFallback?: unknown;
}

interface PickedExtras {
  pickedRationale?: string;
  alternatives?: Array<Record<string, unknown>>;
}

async function resolveSelector(
  input: UiActionInput,
  context: ServerContext,
  config: UiConfig,
  deviceId: string,
): Promise<SelectorResolution> {
  if (!input.selector) return { elements: [] };
  const response = await handleFind({ selector: input.selector }, context, config, deviceId);
  return {
    elements: context.lastFindResults,
    candidates: response.candidates,
    visualFallback: response.visualFallback,
  };
}

/**
 * Resolves a selector match for an action operation.
 * - 0   matches → ELEMENT_NOT_FOUND, preserving any fallback candidates the
 *                 resolver already produced (so the caller doesn't pay the
 *                 screenshot/dump/crop cost twice).
 * - 1   match   → take it
 * - 1+  matches with `nearestTo` set → take matches[0]; the find resolver
 *                                     already proximity-sorted them.
 * - 1+  matches without `nearestTo`  → AMBIGUOUS_MATCH with candidate list.
 */
function pickSelectorMatch(
  resolution: SelectorResolution,
  selector: NonNullable<UiActionInput["selector"]>,
  operation: "tap" | "input" | "scroll",
  extras?: PickedExtras,
): FindElement {
  const { elements: matches, candidates, visualFallback } = resolution;
  if (matches.length === 0) {
    const hasFallbackPayload = candidates !== undefined || visualFallback !== undefined;
    throw new ReplicantError(
      ErrorCode.ELEMENT_NOT_FOUND,
      `No element matched selector: ${JSON.stringify(selector)}`,
      hasFallbackPayload
        ? "Inspect the candidates/visualFallback in error details, or refine the selector."
        : operation === "scroll"
          ? "Selector must resolve to an element inside a scrollable container."
          : "Try a broader selector (textContains), or use ui-query find for fallback tiers.",
      hasFallbackPayload ? { buildResult: { candidates, visualFallback } } : undefined,
    );
  }
  if (matches.length > 1 && !selector.nearestTo) {
    // THE-108: with rank=bestTappable, auto-pick the top-ranked candidate
    // instead of throwing AMBIGUOUS_MATCH.
    if (selector.rank === "bestTappable") {
      const ranked = rankBestTappable(matches);
      if (extras) {
        extras.pickedRationale = ranked.pickedRationale;
        extras.alternatives = ranked.alternativeSummaries;
      }
      return ranked.ranked[0];
    }
    throw new ReplicantError(
      ErrorCode.AMBIGUOUS_MATCH,
      `Selector matched ${matches.length} elements; cannot decide which to ${operation}.`,
      "Disambiguate via 'nearestTo', a tighter resourceId, or use ui-query find + elementIndex. Or set rank: 'bestTappable' to auto-pick.",
      { buildResult: { matches: describeMatches(matches) } },
    );
  }
  return matches[0];
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

async function handleTap(
  input: UiActionInput,
  context: ServerContext,
  config: UiConfig,
  deviceId: string,
): Promise<Record<string, unknown>> {
  let x: number, y: number;
  let usedSelector = false;

  let pickedExtras: PickedExtras | undefined;
  let viaScreenshotId = false;
  if (input.selector) {
    const resolution = await resolveSelector(input, context, config, deviceId);
    pickedExtras = {};
    const match = pickSelectorMatch(resolution, input.selector, "tap", pickedExtras);
    const center = getElementCenter(match);
    x = center.x;
    y = center.y;
    usedSelector = true;
  } else if (input.screenshotId !== undefined) {
    // THE-111: tap what's visible in a specific screenshot — convert
    // imageX/imageY to device-space using that screenshot's scaling.
    if (input.imageX === undefined || input.imageY === undefined) {
      throw new ReplicantError(
        ErrorCode.INPUT_VALIDATION_FAILED,
        "screenshotId requires imageX and imageY",
        "Provide imageX/imageY (image-space pixel coords) alongside screenshotId.",
      );
    }
    const cached = context.cache.get<ScreenshotScalingEntry>(input.screenshotId);
    if (!cached) {
      throw new ReplicantError(
        ErrorCode.UNKNOWN_SCREENSHOT_ID,
        `Screenshot id '${input.screenshotId}' is unknown or has expired.`,
        "Take a new screenshot via ui-capture screenshot — entries are kept for 5 minutes.",
      );
    }
    const converted = toDeviceSpace(input.imageX, input.imageY, cached.data.scaleFactor);
    x = converted.x;
    y = converted.y;
    viaScreenshotId = true;
  } else if (input.elementIndex !== undefined) {
    if (!context.lastFindResults[input.elementIndex]) {
      throw new ReplicantError(
        ErrorCode.ELEMENT_NOT_FOUND,
        `Element at index ${input.elementIndex} not found. Run 'find' first.`,
        "Use ui-query find to locate elements, then reference them by index",
      );
    }
    const element = context.lastFindResults[input.elementIndex];
    const center = getElementCenter(element);
    x = center.x;
    y = center.y;
  } else if (input.x !== undefined && input.y !== undefined) {
    x = input.x;
    y = input.y;
  } else {
    throw new ReplicantError(
      ErrorCode.INPUT_VALIDATION_FAILED,
      "tap requires x/y, elementIndex, selector, or screenshotId+imageX+imageY",
      "Provide one of: x+y coords, elementIndex from a prior find, a selector, or screenshotId paired with imageX/imageY.",
    );
  }

  // Selector and elementIndex paths always yield device-space coords (the find
  // result is already in device space). screenshotId path converted to
  // device-space above. Only the raw x/y path lets the caller override the
  // space; default true matches the new ui-query dump contract.
  const fromResolvedElement =
    usedSelector || input.elementIndex !== undefined || viaScreenshotId;
  const deviceSpace = fromResolvedElement ? true : (input.deviceSpace ?? true);
  await context.ui.tap(deviceId, x, y, deviceSpace);
  const response: Record<string, unknown> = { tapped: { x, y, deviceSpace }, deviceId };
  if (usedSelector) response.matchedSelector = input.selector;
  if (pickedExtras?.pickedRationale) response.pickedRationale = pickedExtras.pickedRationale;
  if (pickedExtras?.alternatives) response.alternatives = pickedExtras.alternatives;
  if (viaScreenshotId) {
    response.viaScreenshotId = input.screenshotId;
    response.imageCoords = { x: input.imageX, y: input.imageY };
  }
  return response;
}

async function handleInput(
  input: UiActionInput,
  context: ServerContext,
  config: UiConfig,
  deviceId: string,
): Promise<Record<string, unknown>> {
  if (!input.text) {
    throw new ReplicantError(
      ErrorCode.INPUT_VALIDATION_FAILED,
      "text is required for input operation",
      "Provide the text string to input",
    );
  }

  if (input.selector) {
    const resolution = await resolveSelector(input, context, config, deviceId);
    const match = pickSelectorMatch(resolution, input.selector, "input");
    const center = getElementCenter(match);
    await context.ui.tap(deviceId, center.x, center.y, true);
  }

  await context.ui.input(deviceId, input.text);
  return {
    input: input.text,
    deviceId,
    ...(input.selector ? { matchedSelector: input.selector } : {}),
  };
}

async function handleScroll(
  input: UiActionInput,
  context: ServerContext,
  config: UiConfig,
  deviceId: string,
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
    const resolution = await resolveSelector(input, context, config, deviceId);
    const target = pickSelectorMatch(resolution, input.selector, "scroll");
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

export const uiActionToolDefinition = {
  name: "ui-action",
  description:
    "Interact with app UI: tap, input, scroll. Use selector or coords. Scroll `direction` is the gesture direction (down = swipe up, content moves down).",
  inputSchema: toMcpJsonSchema(uiActionInputSchema),
  annotations: {
    readOnlyHint: false,
    destructiveHint: true,
    idempotentHint: false,
    openWorldHint: false,
  },
};
