import { z } from "zod";
import { ServerContext } from "../server.js";
import { ReplicantError, ErrorCode, UiConfig } from "../types/index.js";
import { DEFAULT_CONFIG } from "../types/config.js";
import { getElementCenter, handleFind, isAccessibilityNode } from "./ui-find.js";
import { AccessibilityNode, flattenTree } from "../parsers/ui-dump.js";
import { FindElement } from "../types/icon-recognition.js";
import { booleanInput, jsonObjectInput, numberInput, toolSchema } from "../schemas/inputs.js";
import { toMcpJsonSchema } from "../schemas/derive.js";

export const uiActionInputSchema = toolSchema({
  operation: z.enum(["tap", "input", "scroll"]),
  x: numberInput().optional(),
  y: numberInput().optional(),
  elementIndex: numberInput().optional(),
  selector: jsonObjectInput({
    resourceId: z.string().optional(),
    text: z.string().optional(),
    textContains: z.string().optional(),
    className: z.string().optional(),
    nearestTo: z.string().optional(),
  }).optional(),
  text: z.string().optional(),
  direction: z.enum(["up", "down", "left", "right"]).optional(),
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

async function resolveSelector(
  input: UiActionInput,
  context: ServerContext,
  config: UiConfig,
  deviceId: string,
): Promise<FindElement[]> {
  if (!input.selector) return [];
  await handleFind({ selector: input.selector }, context, config, deviceId);
  return context.lastFindResults;
}

function findScrollableAncestor(
  tree: AccessibilityNode[],
  target: AccessibilityNode,
): AccessibilityNode | null {
  const flat = flattenTree(tree);
  const SCROLLABLE = ["ScrollView", "RecyclerView", "ListView", "ViewPager"];

  let best: AccessibilityNode | null = null;
  let smallestArea = Infinity;
  for (const node of flat) {
    if (!SCROLLABLE.some((s) => node.className.includes(s))) continue;
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

async function handleTap(
  input: UiActionInput,
  context: ServerContext,
  config: UiConfig,
  deviceId: string,
): Promise<Record<string, unknown>> {
  let x: number, y: number;
  let usedSelector = false;

  if (input.selector) {
    const matches = await resolveSelector(input, context, config, deviceId);
    if (matches.length === 0) {
      throw new ReplicantError(
        ErrorCode.ELEMENT_NOT_FOUND,
        `No element matched selector: ${JSON.stringify(input.selector)}`,
        "Try a broader selector (textContains), capture a screenshot, or use ui-query find for fallback tiers.",
      );
    }
    if (matches.length > 1) {
      throw new ReplicantError(
        ErrorCode.AMBIGUOUS_MATCH,
        `Selector matched ${matches.length} elements; cannot decide which to tap.`,
        "Disambiguate via 'nearestTo', a tighter resourceId, or use ui-query find + elementIndex.",
        { buildResult: { matches: describeMatches(matches) } },
      );
    }
    const center = getElementCenter(matches[0]);
    x = center.x;
    y = center.y;
    usedSelector = true;
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
      "tap requires x/y, elementIndex, or selector",
      "Provide one of: x+y coords, elementIndex from a prior find, or a selector.",
    );
  }

  const deviceSpace = input.deviceSpace ?? true;
  await context.ui.tap(deviceId, x, y, deviceSpace);
  const response: Record<string, unknown> = { tapped: { x, y, deviceSpace }, deviceId };
  if (usedSelector) response.matchedSelector = input.selector;
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
    const matches = await resolveSelector(input, context, config, deviceId);
    if (matches.length === 0) {
      throw new ReplicantError(
        ErrorCode.ELEMENT_NOT_FOUND,
        `No element matched selector: ${JSON.stringify(input.selector)}`,
        "Provide a selector that resolves to a single focusable input field.",
      );
    }
    if (matches.length > 1) {
      throw new ReplicantError(
        ErrorCode.AMBIGUOUS_MATCH,
        `Selector matched ${matches.length} elements; cannot decide which to focus.`,
        "Disambiguate via 'nearestTo' or a tighter resourceId.",
        { buildResult: { matches: describeMatches(matches) } },
      );
    }
    const center = getElementCenter(matches[0]);
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
    const matches = await resolveSelector(input, context, config, deviceId);
    if (matches.length === 0) {
      throw new ReplicantError(
        ErrorCode.ELEMENT_NOT_FOUND,
        `No element matched selector for scroll: ${JSON.stringify(input.selector)}`,
        "Selector must resolve to an element inside a scrollable container.",
      );
    }
    if (matches.length > 1) {
      throw new ReplicantError(
        ErrorCode.AMBIGUOUS_MATCH,
        `Selector matched ${matches.length} elements; cannot decide which container to scroll.`,
        "Disambiguate via 'nearestTo' or a tighter resourceId.",
        { buildResult: { matches: describeMatches(matches) } },
      );
    }
    const target = matches[0];
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
        warning: "no scrollable ancestor (ScrollView/RecyclerView/ListView/ViewPager) found; scrolled the screen center.",
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
  description: "Interact with app UI: tap, input, scroll. Use selector or coords.",
  inputSchema: toMcpJsonSchema(uiActionInputSchema),
  annotations: {
    readOnlyHint: false,
    destructiveHint: true,
    idempotentHint: false,
    openWorldHint: false,
  },
};
