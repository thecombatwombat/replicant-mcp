import { z } from "zod";
import { ServerContext } from "../server.js";
import { CACHE_TTLS, UiConfig, ReplicantError, ErrorCode } from "../types/index.js";
import { AccessibilityNode, flattenTree } from "../parsers/ui-dump.js";
import { handleFind, getElementCenter } from "./ui-find.js";

export const uiInputSchema = z.object({
  operation: z.enum(["dump", "find", "tap", "input", "scroll", "screenshot", "accessibility-check", "visual-snapshot"]),
  selector: z.object({
    resourceId: z.string().optional(),
    text: z.string().optional(),
    textContains: z.string().optional(),
    className: z.string().optional(),
    nearestTo: z.string().optional(),
  }).optional(),
  x: z.number().optional(),
  y: z.number().optional(),
  elementIndex: z.number().optional(),
  text: z.string().optional(),
  localPath: z.string().optional(),
  inline: z.boolean().optional(),
  debug: z.boolean().optional(),
  gridCell: z.number().min(1).max(24).optional(),
  gridPosition: z.number().min(1).max(5).optional(),
  deviceSpace: z.boolean().optional(),
  maxDimension: z.number().optional(),
  raw: z.boolean().optional(),
  compact: z.boolean().optional(),
  direction: z.enum(["up", "down", "left", "right"]).optional(),
  amount: z.number().min(0).max(1).optional(),
  limit: z.number().min(1).max(100).optional(),
  offset: z.number().min(0).optional(),
});

export type UiInput = z.infer<typeof uiInputSchema>;

const DEFAULT_CONFIG: UiConfig = {
  visualModePackages: [],
  autoFallbackScreenshot: true,
  includeBase64: false,
  maxImageDimension: 800,
};

type OperationHandler = (
  input: UiInput,
  context: ServerContext,
  config: UiConfig,
  deviceId: string,
) => Promise<Record<string, unknown>>;

const uiOperations: Record<string, OperationHandler> = {
  dump: handleDump,
  find: handleFind,
  tap: handleTap,
  input: handleInput,
  scroll: handleScroll,
  screenshot: handleScreenshot,
  "accessibility-check": handleAccessibilityCheck,
  "visual-snapshot": handleVisualSnapshot,
};

export async function handleUiTool(
  input: UiInput,
  context: ServerContext,
  uiConfig?: UiConfig
): Promise<Record<string, unknown>> {
  const device = await context.deviceState.ensureDevice(context.adb);
  const config = uiConfig ?? DEFAULT_CONFIG;

  const handler = uiOperations[input.operation];
  if (!handler) {
    throw new ReplicantError(
      ErrorCode.INVALID_OPERATION,
      `Unknown operation: ${input.operation}`,
      "Valid operations: dump, find, tap, input, scroll, screenshot, accessibility-check, visual-snapshot",
    );
  }
  return handler(input, context, config, device.id);
}

async function handleDump(
  input: UiInput,
  context: ServerContext,
  _config: UiConfig,
  deviceId: string
): Promise<Record<string, unknown>> {
  const tree = await context.ui.dump(deviceId);

  const dumpId = context.cache.generateId("ui-dump");
  context.cache.set(dumpId, { tree, deviceId }, "ui-dump", CACHE_TTLS.UI_TREE);

  const emptyWarning = tree.length === 0
    ? "No accessibility nodes found. Possible causes: (1) UI still loading - wait and retry, (2) App uses custom rendering (Flutter, games, video players) - use screenshot instead, (3) App blocks accessibility services."
    : undefined;

  if (input.compact) {
    return handleCompactDump(tree, input, dumpId, deviceId, emptyWarning);
  }

  return handleFullDump(tree, dumpId, deviceId, emptyWarning);
}

function handleCompactDump(
  tree: AccessibilityNode[],
  input: UiInput,
  dumpId: string,
  deviceId: string,
  emptyWarning: string | undefined
): Record<string, unknown> {
  const flat = flattenTree(tree);
  const interactive = flat.filter((n) => n.clickable || n.focusable);

  const limit = input.limit ?? 20;
  const offset = input.offset ?? 0;
  const totalCount = interactive.length;
  const paginated = interactive.slice(offset, offset + limit);
  const hasMore = offset + limit < totalCount;

  const elements = paginated.map((n) => ({
    text: n.text || n.contentDesc || undefined,
    type: n.className.split(".").pop(),
    x: n.centerX,
    y: n.centerY,
    resourceId: n.resourceId ? n.resourceId.split("/").pop() : undefined,
  }));

  const noInteractiveWarning = tree.length > 0 && totalCount === 0
    ? "Accessibility tree exists but no interactive elements found. Try 'ui find' with a text selector, or use screenshot for visual targeting."
    : undefined;

  const hint = hasMore
    ? `${elements.length} of ${totalCount} elements shown. Use 'ui find' for specific elements, or add offset: ${offset + limit} for more.`
    : undefined;

  return {
    dumpId,
    elements,
    count: elements.length,
    totalCount,
    hasMore,
    offset,
    limit,
    deviceId,
    hint,
    warning: emptyWarning || noInteractiveWarning,
  };
}

function handleFullDump(
  tree: AccessibilityNode[],
  dumpId: string,
  deviceId: string,
  emptyWarning: string | undefined
): Record<string, unknown> {
  const simplifyNode = (node: AccessibilityNode): Record<string, unknown> => ({
    className: node.className.split(".").pop(),
    text: node.text || undefined,
    resourceId: node.resourceId ? node.resourceId.split("/").pop() : undefined,
    bounds: `[${node.bounds.left},${node.bounds.top}][${node.bounds.right},${node.bounds.bottom}]`,
    clickable: node.clickable || undefined,
    children: node.children?.map((c) => simplifyNode(c)),
  });

  return {
    dumpId,
    tree: tree.map((n) => simplifyNode(n)),
    deviceId,
    warning: emptyWarning,
  };
}

async function handleTap(
  input: UiInput,
  context: ServerContext,
  _config: UiConfig,
  deviceId: string
): Promise<Record<string, unknown>> {
  let x: number, y: number;

  if (input.elementIndex !== undefined) {
    if (!context.lastFindResults[input.elementIndex]) {
      throw new ReplicantError(
        ErrorCode.ELEMENT_NOT_FOUND,
        `Element at index ${input.elementIndex} not found. Run 'find' first.`,
        "Use 'ui find' to locate elements, then reference them by index",
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
      "Either x/y coordinates or elementIndex is required for tap",
      "Provide x and y coordinates, or use elementIndex from a previous 'ui find' result",
    );
  }

  await context.ui.tap(deviceId, x, y, input.deviceSpace);
  return { tapped: { x, y, deviceSpace: input.deviceSpace ?? false }, deviceId };
}

async function handleInput(
  input: UiInput,
  context: ServerContext,
  _config: UiConfig,
  deviceId: string
): Promise<Record<string, unknown>> {
  if (!input.text) {
    throw new ReplicantError(
      ErrorCode.INPUT_VALIDATION_FAILED,
      "text is required for input operation",
      "Provide the text string to input",
    );
  }
  await context.ui.input(deviceId, input.text);
  return { input: input.text, deviceId };
}

async function handleScroll(
  input: UiInput,
  context: ServerContext,
  _config: UiConfig,
  deviceId: string
): Promise<Record<string, unknown>> {
  if (!input.direction) {
    throw new ReplicantError(
      ErrorCode.INPUT_VALIDATION_FAILED,
      "direction is required for scroll operation",
      "Provide a direction: up, down, left, or right",
    );
  }
  const amount = input.amount ?? 0.5;
  await context.ui.scroll(deviceId, input.direction, amount);
  return { scrolled: { direction: input.direction, amount }, deviceId };
}

async function handleScreenshot(
  input: UiInput,
  context: ServerContext,
  config: UiConfig,
  deviceId: string
): Promise<Record<string, unknown>> {
  const result = await context.ui.screenshot(deviceId, {
    localPath: input.localPath,
    inline: input.inline ?? true,
    maxDimension: input.maxDimension ?? config.maxImageDimension,
    raw: input.raw,
  });
  return { ...result, deviceId };
}

async function handleAccessibilityCheck(
  _input: UiInput,
  context: ServerContext,
  _config: UiConfig,
  deviceId: string
): Promise<Record<string, unknown>> {
  const result = await context.ui.accessibilityCheck(deviceId);
  return { ...result, deviceId };
}

async function handleVisualSnapshot(
  input: UiInput,
  context: ServerContext,
  config: UiConfig,
  deviceId: string
): Promise<Record<string, unknown>> {
  const snapshot = await context.ui.visualSnapshot(deviceId, {
    includeBase64: input.inline ?? config.includeBase64,
  });
  return { ...snapshot, deviceId };
}

export const uiToolDefinition = {
  name: "ui",
  description: "Interact with app UI via accessibility tree. Auto-selects device if only one connected. Operations: dump, find, tap, input, scroll, screenshot, accessibility-check, visual-snapshot.",
  inputSchema: {
    type: "object",
    properties: {
      operation: {
        type: "string",
        enum: ["dump", "find", "tap", "input", "scroll", "screenshot", "accessibility-check", "visual-snapshot"],
      },
      selector: {
        type: "object",
        properties: {
          resourceId: { type: "string" },
          text: { type: "string" },
          textContains: { type: "string" },
          className: { type: "string" },
          nearestTo: { type: "string", description: "Find elements nearest to this text (spatial proximity)" },
        },
        description: "Element selector (for find)",
      },
      x: { type: "number", description: "X coordinate (for tap)" },
      y: { type: "number", description: "Y coordinate (for tap)" },
      elementIndex: { type: "number", description: "Element index from last find (for tap)" },
      text: { type: "string", description: "Text to input" },
      localPath: { type: "string", description: "Local path for screenshot (default: .replicant/screenshots/screenshot-{timestamp}.png)" },
      inline: { type: "boolean", description: "Return base64 image data (default: true). Set to false to save to file instead." },
      debug: { type: "boolean", description: "Include source (accessibility/ocr) and confidence in response" },
      gridCell: { type: "number", minimum: 1, maximum: 24, description: "Grid cell number (1-24) for Tier 5 refinement" },
      gridPosition: { type: "number", minimum: 1, maximum: 5, description: "Position within cell (1=TL, 2=TR, 3=Center, 4=BL, 5=BR)" },
      deviceSpace: {
        type: "boolean",
        description: "For tap: treat x/y as device coordinates (skip image→device scaling). Use when coordinates come from adb shell input tap testing.",
      },
      maxDimension: {
        type: "number",
        description: "Max image dimension in pixels (default: 1000). Higher = better quality, more tokens.",
      },
      raw: {
        type: "boolean",
        description: "Skip scaling, return full device resolution. Warning: may exceed API limits.",
      },
      compact: {
        type: "boolean",
        description: "For dump: return paginated flat list of interactive elements (default: 20, use limit/offset for more).",
      },
      direction: {
        type: "string",
        enum: ["up", "down", "left", "right"],
        description: "Scroll direction (for scroll operation)",
      },
      amount: {
        type: "number",
        minimum: 0,
        maximum: 1,
        description: "Scroll amount as fraction of screen (0-1, default: 0.5)",
      },
      limit: {
        type: "number",
        minimum: 1,
        maximum: 100,
        description: "For dump with compact: max elements to return (default: 20).",
      },
      offset: {
        type: "number",
        minimum: 0,
        description: "For dump with compact: skip first N elements for pagination.",
      },
    },
    required: ["operation"],
  },
};
