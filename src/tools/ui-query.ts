import { z } from "zod";
import { ServerContext } from "../server.js";
import { CACHE_TTLS, UiConfig, ReplicantError, ErrorCode } from "../types/index.js";
import { AccessibilityNode, flattenTree, isInteractiveNode } from "../parsers/ui-dump.js";
import { DEFAULT_CONFIG } from "../types/config.js";
import { handleFind } from "./ui-find.js";
import { getCurrentAppSafe, CurrentAppField } from "./util-current-app.js";
import {
  booleanInput,
  jsonObjectInput,
  numberInput,
  toolSchema,
} from "../schemas/inputs.js";
import { toMcpJsonSchema } from "../schemas/derive.js";

export const uiQueryInputSchema = toolSchema({
  operation: z.enum(["dump", "find", "accessibility-check"]),
  selector: jsonObjectInput({
    resourceId: z.string().optional(),
    text: z.string().optional(),
    textContains: z.string().optional(),
    className: z.string().optional(),
    nearestTo: z
      .string()
      .optional()
      .describe("Find elements nearest to this text (spatial proximity)"),
    rank: z
      .enum(["bestTappable"])
      .optional()
      .describe(
        "Rank matches by tappability heuristics (THE-108). Prefers clickable, smaller bounding box, penalizes full-screen containers.",
      ),
  }).optional(),
  debug: booleanInput().optional(),
  maxTier: numberInput({ min: 1, max: 5 })
    .optional()
    .describe("Max fallback tier (1-5). Use 3 to stop before visual/grid payloads."),
  gridCell: numberInput({ min: 1, max: 24 }).optional(),
  gridPosition: numberInput({ min: 1, max: 5 }).optional(),
  compact: booleanInput()
    .optional()
    .describe("Paginated flat list (default: true). false for full tree."),
  interactiveOnly: booleanInput()
    .optional()
    .describe(
      "If true, keep only nodes where any of clickable, long-clickable, focusable, editable, or scrollable is true. Applied after selector matching, before pagination.",
    ),
  limit: numberInput({ min: 1, max: 100 }).optional().describe("Default: 20"),
  offset: numberInput({ min: 0 }).optional(),
});

export type UiQueryInput = z.infer<typeof uiQueryInputSchema>;

type OperationHandler = (
  input: UiQueryInput,
  context: ServerContext,
  config: UiConfig,
  deviceId: string,
) => Promise<Record<string, unknown>>;

const operations: Record<string, OperationHandler> = {
  dump: handleDump,
  find: handleFind,
  "accessibility-check": handleAccessibilityCheck,
};

export async function handleUiQueryTool(
  input: UiQueryInput,
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
      "Valid operations: dump, find, accessibility-check",
    );
  }
  return handler(input, context, config, device.id);
}

interface DumpCoordinateMeta {
  coordinateSpace: "device";
  scaleFactor: number;
  deviceDimensions?: { width: number; height: number };
  imageDimensions?: { width: number; height: number };
}

function buildCoordinateMeta(context: ServerContext): DumpCoordinateMeta {
  const scalingState = context.ui.getScalingState();
  if (!scalingState) {
    return { coordinateSpace: "device", scaleFactor: 1.0 };
  }
  return {
    coordinateSpace: "device",
    scaleFactor: scalingState.scaleFactor,
    deviceDimensions: { width: scalingState.deviceWidth, height: scalingState.deviceHeight },
    imageDimensions: { width: scalingState.imageWidth, height: scalingState.imageHeight },
  };
}

async function handleDump(
  input: UiQueryInput,
  context: ServerContext,
  _config: UiConfig,
  deviceId: string,
): Promise<Record<string, unknown>> {
  const [tree, app] = await Promise.all([
    context.ui.dump(deviceId),
    getCurrentAppSafe(context, deviceId),
  ]);

  const dumpId = context.cache.generateId("ui-dump");
  context.cache.set(dumpId, { tree, deviceId }, "ui-dump", CACHE_TTLS.UI_TREE);

  const emptyWarning = tree.length === 0
    ? "No accessibility nodes found. Possible causes: (1) UI still loading - wait and retry, (2) App uses custom rendering (Flutter, games, video players) - use screenshot instead, (3) App blocks accessibility services."
    : undefined;

  const coordMeta = buildCoordinateMeta(context);

  if (input.compact !== false) {
    return handleCompactDump(tree, input, dumpId, deviceId, emptyWarning, coordMeta, app);
  }

  return handleFullDump(tree, input, dumpId, deviceId, emptyWarning, coordMeta, app);
}

// CU-5 follow-up: prune a tree to keep only subtrees that contain at least
// one interactive descendant (or that are interactive themselves). The shape
// of the tree is preserved — structural ancestors of interactive nodes stay
// so callers retain the hierarchical context that distinguishes full-tree
// mode from compact mode.
function pruneToInteractive(node: AccessibilityNode): AccessibilityNode | null {
  const prunedChildren = node.children
    ?.map(pruneToInteractive)
    .filter((c): c is AccessibilityNode => c !== null);
  const keep = isInteractiveNode(node) || (prunedChildren !== undefined && prunedChildren.length > 0);
  if (!keep) return null;
  return { ...node, children: prunedChildren };
}

function handleCompactDump(
  tree: AccessibilityNode[],
  input: UiQueryInput,
  dumpId: string,
  deviceId: string,
  emptyWarning: string | undefined,
  coordMeta: DumpCoordinateMeta,
  app: CurrentAppField | null,
): Record<string, unknown> {
  const flat = flattenTree(tree);
  const interactive = input.interactiveOnly === true
    ? flat.filter(isInteractiveNode)
    : flat.filter((n) => n.clickable || n.focusable);

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
    ? "Accessibility tree exists but no interactive elements found. Try ui-query find with a text selector, or use screenshot for visual targeting."
    : undefined;

  const hint = hasMore
    ? `${elements.length} of ${totalCount} elements shown. Use ui-query find for specific elements, or add offset: ${offset + limit} for more.`
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
    app,
    ...coordMeta,
    hint,
    warning: emptyWarning || noInteractiveWarning,
  };
}

function handleFullDump(
  tree: AccessibilityNode[],
  input: UiQueryInput,
  dumpId: string,
  deviceId: string,
  emptyWarning: string | undefined,
  coordMeta: DumpCoordinateMeta,
  app: CurrentAppField | null,
): Record<string, unknown> {
  const effectiveTree = input.interactiveOnly === true
    ? tree
        .map(pruneToInteractive)
        .filter((n): n is AccessibilityNode => n !== null)
    : tree;

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
    tree: effectiveTree.map((n) => simplifyNode(n)),
    deviceId,
    app,
    ...coordMeta,
    warning: emptyWarning,
  };
}

async function handleAccessibilityCheck(
  _input: UiQueryInput,
  context: ServerContext,
  _config: UiConfig,
  deviceId: string,
): Promise<Record<string, unknown>> {
  const result = await context.ui.accessibilityCheck(deviceId);
  return { ...result, deviceId };
}

export const uiQueryToolDefinition = {
  name: "ui-query",
  description: "Query app UI. Accessibility-first.",
  inputSchema: toMcpJsonSchema(uiQueryInputSchema),
  annotations: {
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false,
  },
};
