import { z } from "zod";
import { ServerContext } from "../server.js";
import { ReplicantError, ErrorCode, UiConfig } from "../types/index.js";
import { DEFAULT_CONFIG } from "../types/config.js";
import { getElementCenter, handleFind, isAccessibilityNode } from "./ui-find.js";
import { AccessibilityNode, flattenTree } from "../parsers/ui-dump.js";
import { FindElement } from "../types/icon-recognition.js";
import { rankBestTappable } from "./util-rank.js";
import { computeAccessibilityFingerprint } from "./util-fingerprint.js";
import { ScreenshotScalingEntry } from "./ui-capture.js";
import { toDeviceSpace } from "../services/scaling.js";
import { booleanInput, jsonObjectInput, numberInput, toolSchema } from "../schemas/inputs.js";
import { toMcpJsonSchema } from "../schemas/derive.js";
import { handleScrollOp } from "./ui-action-scroll.js";

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
  // THE-113 (CU-9): when true on `input`, capture the target field's text
  // before and after the input call and report whether it changed/contains
  // the desired text. Requires a selector (we need to know which field to
  // inspect). Default false — opt-in because it costs an extra ui dump.
  verify: booleanInput()
    .optional()
    .describe(
      "On `input`: capture the field's text before/after and report whether the input took effect. Requires a selector. Default false.",
    ),
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

// THE-112 (CU-8): stale-element check on the elementIndex path.
//
// `ui-query find` cached an element at this index plus its content
// fingerprint. Between find and tap, the screen can change. Re-dump the tree,
// locate the node whose center matches the cached center (within a small
// tolerance so float rounding doesn't false-positive), recompute its
// fingerprint, and compare.
//
// - If no node matches the cached center, STALE.
// - If a node matches the center but fingerprint differs (text changed,
//   resourceId changed, bounds shifted), STALE.
// - If the cached element is non-accessibility (OCR/grid), its stored
//   fingerprint is "" — skip the check (no stable identity).
// - If `lastFindFingerprints` is missing or empty (older callers),
//   skip the check (backward compat).
//
// Matches at exact (centerX, centerY). If multiple nodes share that center
// (overlay siblings), prefer one with matching className.
async function assertElementStillFresh(
  context: ServerContext,
  deviceId: string,
  elementIndex: number,
  element: FindElement,
): Promise<void> {
  const fingerprints = context.lastFindFingerprints;
  if (!fingerprints || fingerprints.length === 0) return;
  const cachedFingerprint = fingerprints[elementIndex];
  if (cachedFingerprint === undefined || cachedFingerprint === "") return;
  if (!isAccessibilityNode(element)) return;

  const tree = await context.ui.dump(deviceId);
  const flat = flattenTree(tree);

  const cx = element.centerX;
  const cy = element.centerY;
  const candidates = flat.filter((n) => n.centerX === cx && n.centerY === cy);
  const current: AccessibilityNode | undefined =
    candidates.find((n) => n.className === element.className) ?? candidates[0];

  if (!current) {
    throw new ReplicantError(
      ErrorCode.STALE_ELEMENT_INDEX,
      `Element at index ${elementIndex} is stale: no node found at (${cx}, ${cy}).`,
      "Re-run ui-query find — the screen has changed since the original find call.",
      {
        buildResult: {
          elementIndex,
          cachedCenter: { x: cx, y: cy },
          cachedFingerprint,
        },
      },
    );
  }

  const liveFingerprint = computeAccessibilityFingerprint(current);
  if (liveFingerprint !== cachedFingerprint) {
    throw new ReplicantError(
      ErrorCode.STALE_ELEMENT_INDEX,
      `Element at index ${elementIndex} is stale: content fingerprint changed since find.`,
      "Re-run ui-query find — the screen has changed since the original find call.",
      {
        buildResult: {
          elementIndex,
          cachedFingerprint,
          liveFingerprint,
        },
      },
    );
  }
}

interface TapResolution {
  x: number;
  y: number;
  usedSelector: boolean;
  viaScreenshotId: boolean;
  pickedExtras?: PickedExtras;
}

async function resolveScreenshotIdTap(
  input: UiActionInput,
  context: ServerContext,
): Promise<TapResolution> {
  if (input.imageX === undefined || input.imageY === undefined) {
    throw new ReplicantError(
      ErrorCode.INPUT_VALIDATION_FAILED,
      "screenshotId requires imageX and imageY",
      "Provide imageX/imageY (image-space pixel coords) alongside screenshotId.",
    );
  }
  const cached = context.cache.get<ScreenshotScalingEntry>(input.screenshotId!);
  if (!cached) {
    throw new ReplicantError(
      ErrorCode.UNKNOWN_SCREENSHOT_ID,
      `Screenshot id '${input.screenshotId}' is unknown or has expired.`,
      "Take a new screenshot via ui-capture screenshot — entries are kept for 5 minutes.",
    );
  }
  const converted = toDeviceSpace(input.imageX, input.imageY, cached.data.scaleFactor);
  return { x: converted.x, y: converted.y, usedSelector: false, viaScreenshotId: true };
}

async function resolveElementIndexTap(
  input: UiActionInput,
  context: ServerContext,
  deviceId: string,
): Promise<TapResolution> {
  if (!context.lastFindResults[input.elementIndex!]) {
    throw new ReplicantError(
      ErrorCode.ELEMENT_NOT_FOUND,
      `Element at index ${input.elementIndex} not found. Run 'find' first.`,
      "Use ui-query find to locate elements, then reference them by index",
    );
  }
  const element = context.lastFindResults[input.elementIndex!];
  await assertElementStillFresh(context, deviceId, input.elementIndex!, element);
  const center = getElementCenter(element);
  return { x: center.x, y: center.y, usedSelector: false, viaScreenshotId: false };
}

async function resolveTap(
  input: UiActionInput,
  context: ServerContext,
  config: UiConfig,
  deviceId: string,
): Promise<TapResolution> {
  if (input.selector) {
    const resolution = await resolveSelector(input, context, config, deviceId);
    const pickedExtras: PickedExtras = {};
    const match = pickSelectorMatch(resolution, input.selector, "tap", pickedExtras);
    const center = getElementCenter(match);
    return { x: center.x, y: center.y, usedSelector: true, viaScreenshotId: false, pickedExtras };
  }
  if (input.screenshotId !== undefined) {
    return resolveScreenshotIdTap(input, context);
  }
  if (input.elementIndex !== undefined) {
    return resolveElementIndexTap(input, context, deviceId);
  }
  if (input.x !== undefined && input.y !== undefined) {
    return { x: input.x, y: input.y, usedSelector: false, viaScreenshotId: false };
  }
  throw new ReplicantError(
    ErrorCode.INPUT_VALIDATION_FAILED,
    "tap requires x/y, elementIndex, selector, or screenshotId+imageX+imageY",
    "Provide one of: x+y coords, elementIndex from a prior find, a selector, or screenshotId paired with imageX/imageY.",
  );
}

async function handleTap(
  input: UiActionInput,
  context: ServerContext,
  config: UiConfig,
  deviceId: string,
): Promise<Record<string, unknown>> {
  const tap = await resolveTap(input, context, config, deviceId);

  // Selector/elementIndex paths always yield device-space coords. screenshotId
  // path is already converted. Only raw x/y lets the caller override.
  const fromResolvedElement =
    tap.usedSelector || input.elementIndex !== undefined || tap.viaScreenshotId;
  const deviceSpace = fromResolvedElement ? true : (input.deviceSpace ?? true);
  await context.ui.tap(deviceId, tap.x, tap.y, deviceSpace);

  const response: Record<string, unknown> = {
    tapped: { x: tap.x, y: tap.y, deviceSpace },
    deviceId,
  };
  if (tap.usedSelector) response.matchedSelector = input.selector;
  if (tap.pickedExtras?.pickedRationale) response.pickedRationale = tap.pickedExtras.pickedRationale;
  if (tap.pickedExtras?.alternatives) response.alternatives = tap.pickedExtras.alternatives;
  if (tap.viaScreenshotId) {
    response.viaScreenshotId = input.screenshotId;
    response.imageCoords = { x: input.imageX, y: input.imageY };
  }
  return response;
}

// THE-113 (CU-9): read the current text of the field identified by `selector`
// by running a fresh `find` (without populating lastFindResults) and pulling
// the text/contentDesc off the top accessibility match. Returns null when the
// selector resolves to no element or a non-accessibility match (OCR/grid
// can't reliably report current field contents).
async function readSelectorText(
  selector: NonNullable<UiActionInput["selector"]>,
  context: ServerContext,
  config: UiConfig,
  deviceId: string,
): Promise<string | null> {
  // Snapshot lastFindResults around the side-effecting call: we don't want
  // verify's internal find to clobber whatever the agent had in flight.
  const savedResults = context.lastFindResults;
  const savedFingerprints = context.lastFindFingerprints;
  try {
    const resolution = await resolveSelector(
      { selector } as UiActionInput,
      context,
      config,
      deviceId,
    );
    if (resolution.elements.length === 0) return null;
    const match = resolution.elements[0];
    if (!isAccessibilityNode(match)) return null;
    return match.text ?? match.contentDesc ?? "";
  } finally {
    context.lastFindResults = savedResults;
    context.lastFindFingerprints = savedFingerprints;
  }
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

  const verify = input.verify === true;
  if (verify && !input.selector) {
    throw new ReplicantError(
      ErrorCode.INPUT_VALIDATION_FAILED,
      "verify=true requires a selector",
      "Provide a selector so we know which field to read before/after.",
    );
  }

  let inputBefore: string | null = null;
  if (verify && input.selector) {
    inputBefore = await readSelectorText(input.selector, context, config, deviceId);
  }

  if (input.selector) {
    const resolution = await resolveSelector(input, context, config, deviceId);
    const match = pickSelectorMatch(resolution, input.selector, "input");
    const center = getElementCenter(match);
    await context.ui.tap(deviceId, center.x, center.y, true);
  }

  await context.ui.input(deviceId, input.text);

  const result: Record<string, unknown> = {
    input: input.text,
    deviceId,
    ...(input.selector ? { matchedSelector: input.selector } : {}),
  };

  if (verify && input.selector) {
    const inputAfter = await readSelectorText(input.selector, context, config, deviceId);
    // Verified = the new value contains the requested text, OR (looser) the
    // field's text changed at all. We report both signals so the caller can
    // decide which one matters for their use case.
    const containsRequested = inputAfter !== null && inputAfter.includes(input.text);
    const changed = inputAfter !== inputBefore;
    result.verified = containsRequested || changed;
    result.containsRequested = containsRequested;
    result.changed = changed;
    result.inputBefore = inputBefore;
    result.inputAfter = inputAfter;
  }

  return result;
}

async function handleScroll(
  input: UiActionInput,
  context: ServerContext,
  config: UiConfig,
  deviceId: string,
): Promise<Record<string, unknown>> {
  // Delegates to ui-action-scroll.ts so this file stays under the 500-line
  // file cap. The deps closure avoids a circular import: scroll needs
  // resolveSelector + pickSelectorMatch but those live here.
  return handleScrollOp(input, context, config, deviceId, {
    resolveSelector: (i, ctx, cfg, did) =>
      resolveSelector(i as UiActionInput, ctx, cfg, did),
    pickSelectorMatch: (resolution, selector) =>
      pickSelectorMatch(resolution, selector, "scroll"),
  });
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
