import { ServerContext } from "../server.js";
import { OcrElement, UiConfig, ReplicantError, ErrorCode } from "../types/index.js";
import { AccessibilityNode, flattenTree, isInteractiveNode } from "../parsers/ui-dump.js";
import {
  FindElement,
  FindOptions,
  FindTier,
  FindWithFallbacksResult,
  GridElement,
} from "../types/icon-recognition.js";
import { getCurrentAppSafe } from "./util-current-app.js";
import { rankBestTappable } from "./util-rank.js";
import { computeFingerprints } from "./util-fingerprint.js";

export interface FindInput {
  selector?: {
    resourceId?: string;
    text?: string;
    textContains?: string;
    className?: string;
    nearestTo?: string;
    rank?: "bestTappable";
  };
  debug?: boolean;
  maxTier?: number;
  gridCell?: number;
  gridPosition?: number;
  interactiveOnly?: boolean;
}

export function isAccessibilityNode(el: FindElement): el is AccessibilityNode {
  return "centerX" in el && "className" in el;
}

export function isOcrElement(el: FindElement): el is OcrElement {
  return "confidence" in el && "center" in el;
}

export function isGridElement(el: FindElement): el is GridElement {
  return "center" in el && "bounds" in el && !("confidence" in el) && !("centerX" in el);
}

export function getElementCenter(element: FindElement): { x: number; y: number } {
  if (isAccessibilityNode(element)) {
    return { x: element.centerX, y: element.centerY };
  }
  return element.center;
}

function calculateDistance(p1: { x: number; y: number }, p2: { x: number; y: number }): number {
  return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
}

function isPointInBounds(
  point: { x: number; y: number },
  bounds: { left: number; top: number; right: number; bottom: number }
): boolean {
  return (
    point.x >= bounds.left &&
    point.x <= bounds.right &&
    point.y >= bounds.top &&
    point.y <= bounds.bottom
  );
}

function boundsArea(bounds: { left: number; top: number; right: number; bottom: number }): number {
  return (bounds.right - bounds.left) * (bounds.bottom - bounds.top);
}

function findContainingSiblingTargets(
  tree: AccessibilityNode[],
  anchorPoint: { x: number; y: number },
  targetElements: AccessibilityNode[]
): AccessibilityNode[] {
  const flat = flattenTree(tree);
  const containingTargets: AccessibilityNode[] = [];

  for (const target of targetElements) {
    const targetCenter = { x: target.centerX, y: target.centerY };

    let smallestContainerForTarget: AccessibilityNode | null = null;
    let smallestArea = Infinity;

    for (const node of flat) {
      if (!node.className?.includes("ViewGroup")) continue;
      if (!isPointInBounds(targetCenter, node.bounds)) continue;

      const area = boundsArea(node.bounds);
      if (area < smallestArea) {
        smallestArea = area;
        smallestContainerForTarget = node;
      }
    }

    if (smallestContainerForTarget && isPointInBounds(anchorPoint, smallestContainerForTarget.bounds)) {
      containingTargets.push(target);
    }
  }

  return containingTargets;
}

function formatElement(el: FindElement, index: number, debug: boolean): Record<string, unknown> {
  if (isAccessibilityNode(el)) {
    return {
      index,
      text: el.text,
      resourceId: el.resourceId,
      className: el.className,
      centerX: el.centerX,
      centerY: el.centerY,
      bounds: el.bounds,
      clickable: el.clickable,
    };
  } else if (isOcrElement(el)) {
    return {
      index,
      text: el.text,
      center: el.center,
      bounds: el.bounds,
      confidence: debug ? el.confidence : undefined,
    };
  }
  return { index, center: el.center, bounds: el.bounds };
}

function sortByProximity(
  elements: FindElement[],
  anchorCenter: { x: number; y: number },
  containingCenters: Set<string> | null
): boolean {
  if (containingCenters) {
    elements.sort((a, b) => {
      const aCenter = getElementCenter(a);
      const bCenter = getElementCenter(b);
      const aContains = containingCenters.has(`${aCenter.x},${aCenter.y}`);
      const bContains = containingCenters.has(`${bCenter.x},${bCenter.y}`);

      if (aContains && !bContains) return -1;
      if (!aContains && bContains) return 1;

      return calculateDistance(aCenter, anchorCenter) - calculateDistance(bCenter, anchorCenter);
    });
    return true;
  }

  elements.sort((a, b) =>
    calculateDistance(getElementCenter(a), anchorCenter) - calculateDistance(getElementCenter(b), anchorCenter)
  );
  return false;
}

async function resolveAnchorCenter(
  context: ServerContext,
  deviceId: string,
  nearestTo: string,
  maxTier: FindTier | undefined
): Promise<{ x: number; y: number } | null> {
  const anchorOptions: FindOptions = {
    debug: false,
    includeVisualFallback: false,
  };
  if (maxTier !== undefined) {
    anchorOptions.maxTier = maxTier;
  }

  const anchorResult = await context.ui.findWithFallbacks(deviceId, { text: nearestTo }, anchorOptions);
  if (anchorResult.elements.length > 0) {
    return getElementCenter(anchorResult.elements[0]);
  }
  return null;
}

function buildFindOptions(input: FindInput, debug: boolean, config: UiConfig): FindOptions {
  const maxTier = input.maxTier as FindTier | undefined;
  const options: FindOptions = {
    debug,
    includeVisualFallback: config.autoFallbackScreenshot,
    includeBase64: config.includeBase64,
    maxTier,
  };

  if (input.gridCell !== undefined) {
    options.gridCell = input.gridCell;
  }
  if (input.gridPosition !== undefined) {
    options.gridPosition = input.gridPosition as 1 | 2 | 3 | 4 | 5;
  }
  return options;
}

function appendResultMetadata(
  response: Record<string, unknown>,
  result: FindWithFallbacksResult,
  debug: boolean
): void {
  if (result.tier !== undefined) response.tier = result.tier;
  if (result.confidence) response.confidence = result.confidence;
  if (result.stoppedEarly !== undefined) response.stoppedEarly = result.stoppedEarly;
  if (result.stoppedAtTier !== undefined) response.stoppedAtTier = result.stoppedAtTier;
  if (result.nextTierAvailable !== undefined) response.nextTierAvailable = result.nextTierAvailable;
  if (result.stopReason) response.stopReason = result.stopReason;

  if (debug) {
    response.source = result.source;
    if (result.fallbackReason) response.fallbackReason = result.fallbackReason;
  }
}

function appendFallbackPayload(response: Record<string, unknown>, result: FindWithFallbacksResult): void {
  if (result.candidates) {
    response.candidates = result.candidates;
    if (result.truncated) response.truncated = result.truncated;
    if (result.totalCandidates) response.totalCandidates = result.totalCandidates;
  }
  if (result.gridImage) response.gridImage = result.gridImage;
  if (result.gridPositions) response.gridPositions = result.gridPositions;
  if (result.visualFallback) response.visualFallback = result.visualFallback;
}

function appendNearestToMetadata(
  response: Record<string, unknown>,
  nearestTo: string | undefined,
  anchorCenter: { x: number; y: number } | null,
  usedContainment: boolean
): void {
  if (nearestTo && anchorCenter) {
    response.sortedByProximityTo = {
      query: nearestTo,
      anchor: anchorCenter,
      method: usedContainment ? "containment" : "distance",
    };
  } else if (nearestTo && !anchorCenter) {
    response.nearestToWarning = `Could not find anchor element: "${nearestTo}"`;
  }
}

export async function handleFind(
  input: FindInput,
  context: ServerContext,
  config: UiConfig,
  deviceId: string
): Promise<Record<string, unknown>> {
  if (!input.selector) {
    throw new ReplicantError(
      ErrorCode.INPUT_VALIDATION_FAILED,
      "selector is required for find operation",
      "Provide a selector with text, textContains, resourceId, or className",
    );
  }

  const debug = input.debug ?? false;
  const nearestTo = input.selector.nearestTo;

  if (input.selector.text || input.selector.textContains) {
    return handleTextFind(input, context, config, deviceId, debug, nearestTo);
  }

  return handleSelectorFind(input, context, config, deviceId);
}

async function handleTextFind(
  input: FindInput,
  context: ServerContext,
  config: UiConfig,
  deviceId: string,
  debug: boolean,
  nearestTo: string | undefined
): Promise<Record<string, unknown>> {
  const maxTier = input.maxTier as FindTier | undefined;
  const anchorCenter = nearestTo
    ? await resolveAnchorCenter(context, deviceId, nearestTo, maxTier)
    : null;
  const findOptions = buildFindOptions(input, debug, config);

  const [result, app] = await Promise.all([
    context.ui.findWithFallbacks(deviceId, input.selector!, findOptions),
    getCurrentAppSafe(context, deviceId),
  ]);

  if (input.interactiveOnly === true) {
    // THE-109: prune non-interactive accessibility nodes after selector match.
    // OCR/grid results pass through unchanged — they're inherently tap targets.
    result.elements = result.elements.filter(
      (el) => !isAccessibilityNode(el) || isInteractiveNode(el),
    );
  }

  let pickedRationale: string | undefined;
  let alternativeSummaries: Array<Record<string, unknown>> | undefined;
  if (input.selector?.rank === "bestTappable") {
    const ranked = rankBestTappable(result.elements);
    result.elements = ranked.ranked;
    pickedRationale = ranked.pickedRationale;
    alternativeSummaries = ranked.alternativeSummaries;
  }

  let usedContainment = false;
  if (anchorCenter && result.elements.length > 0) {
    const accessibilityElements = result.elements.filter(isAccessibilityNode);
    if (accessibilityElements.length > 0) {
      const tree = await context.ui.dump(deviceId);
      const containingMatches = findContainingSiblingTargets(tree, anchorCenter, accessibilityElements);

      const containingCenters = containingMatches.length > 0
        ? new Set(containingMatches.map((el) => `${el.centerX},${el.centerY}`))
        : null;
      usedContainment = sortByProximity(result.elements, anchorCenter, containingCenters);
    }
  }

  context.lastFindResults = result.elements;
  context.lastFindFingerprints = computeFingerprints(result.elements);

  const response: Record<string, unknown> = {
    elements: result.elements.map((el, index) => formatElement(el, index, debug)),
    count: result.elements.length,
    deviceId,
    app,
  };

  appendResultMetadata(response, result, debug);
  appendNearestToMetadata(response, nearestTo, anchorCenter, usedContainment);
  appendFallbackPayload(response, result);
  if (pickedRationale) response.pickedRationale = pickedRationale;
  if (alternativeSummaries) response.alternatives = alternativeSummaries;

  return response;
}

async function handleSelectorFind(
  input: FindInput,
  context: ServerContext,
  config: UiConfig,
  deviceId: string
): Promise<Record<string, unknown>> {
  const [elementsRaw, app] = await Promise.all([
    context.ui.find(deviceId, input.selector!),
    getCurrentAppSafe(context, deviceId),
  ]);
  let elements: AccessibilityNode[] = input.interactiveOnly === true
    ? elementsRaw.filter(isInteractiveNode)
    : elementsRaw;
  let pickedRationale: string | undefined;
  let alternativeSummaries: Array<Record<string, unknown>> | undefined;
  if (input.selector?.rank === "bestTappable") {
    const ranked = rankBestTappable(elements);
    elements = ranked.ranked as AccessibilityNode[];
    pickedRationale = ranked.pickedRationale;
    alternativeSummaries = ranked.alternativeSummaries;
  }
  context.lastFindResults = elements;
  context.lastFindFingerprints = computeFingerprints(elements);

  const response: Record<string, unknown> = {
    elements: elements.map((el, index) => ({
      index,
      text: el.text,
      resourceId: el.resourceId,
      className: el.className,
      centerX: el.centerX,
      centerY: el.centerY,
      bounds: el.bounds,
      clickable: el.clickable,
    })),
    count: elements.length,
    deviceId,
    app,
  };

  if (elements.length === 0 && config.autoFallbackScreenshot) {
    const snapshot = await context.ui.visualSnapshot(deviceId, {
      includeBase64: config.includeBase64,
    });
    response.visualFallback = {
      ...snapshot,
      hint: "No elements matched selector. Use screenshot to identify tap coordinates.",
    };
  }

  if (pickedRationale) response.pickedRationale = pickedRationale;
  if (alternativeSummaries) response.alternatives = alternativeSummaries;

  return response;
}
