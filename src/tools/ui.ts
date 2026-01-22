import { z } from "zod";
import { ServerContext } from "../server.js";
import { CACHE_TTLS, OcrElement, UiConfig } from "../types/index.js";
import { AccessibilityNode, flattenTree } from "../parsers/ui-dump.js";
import { FindElement, GridElement } from "../types/icon-recognition.js";

export const uiInputSchema = z.object({
  operation: z.enum(["dump", "find", "tap", "input", "screenshot", "accessibility-check", "visual-snapshot"]),
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
});

export type UiInput = z.infer<typeof uiInputSchema>;

// Store last find results for elementIndex reference
// Updated to support accessibility, OCR, and grid elements
let lastFindResults: FindElement[] = [];

// Type guards for different element types
function isAccessibilityNode(el: FindElement): el is AccessibilityNode {
  return "centerX" in el && "className" in el;
}

function isOcrElement(el: FindElement): el is OcrElement {
  return "confidence" in el && "center" in el;
}

function isGridElement(el: FindElement): el is GridElement {
  return "center" in el && "bounds" in el && !("confidence" in el) && !("centerX" in el);
}

// Helper to get center coordinates from any element type
function getElementCenter(element: FindElement): { x: number; y: number } {
  if (isAccessibilityNode(element)) {
    return { x: element.centerX, y: element.centerY };
  } else {
    // OcrElement or GridElement - both have center property
    return element.center;
  }
}

// Calculate Euclidean distance between two points
function calculateDistance(p1: { x: number; y: number }, p2: { x: number; y: number }): number {
  return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
}

// Check if a point is inside element bounds
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

// Calculate area of bounds
function boundsArea(bounds: { left: number; top: number; right: number; bottom: number }): number {
  return (bounds.right - bounds.left) * (bounds.bottom - bounds.top);
}

// Find targets whose smallest containing ViewGroup also contains the anchor point
function findContainingSiblingTargets(
  tree: AccessibilityNode[],
  anchorPoint: { x: number; y: number },
  targetElements: AccessibilityNode[]
): AccessibilityNode[] {
  const flat = flattenTree(tree);
  const containingTargets: AccessibilityNode[] = [];

  for (const target of targetElements) {
    const targetCenter = { x: target.centerX, y: target.centerY };

    // Find the smallest ViewGroup that contains the target
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

    // Check if that smallest container also contains the anchor point
    if (smallestContainerForTarget && isPointInBounds(anchorPoint, smallestContainerForTarget.bounds)) {
      containingTargets.push(target);
    }
  }

  return containingTargets;
}

export async function handleUiTool(
  input: UiInput,
  context: ServerContext,
  uiConfig?: UiConfig
): Promise<Record<string, unknown>> {
  const device = await context.deviceState.ensureDevice(context.adb);
  const deviceId = device.id;

  // Get config - use provided or defaults
  const config = uiConfig ?? {
    visualModePackages: [],
    autoFallbackScreenshot: true,
    includeBase64: false,
  };

  switch (input.operation) {
    case "dump": {
      const tree = await context.ui.dump(deviceId);

      // Cache the tree
      const dumpId = context.cache.generateId("ui-dump");
      context.cache.set(dumpId, { tree, deviceId }, "ui-dump", CACHE_TTLS.UI_TREE);

      // Create a simplified view
      const simplifyNode = (node: AccessibilityNode, depth = 0): Record<string, unknown> => ({
        className: node.className.split(".").pop(),
        text: node.text || undefined,
        resourceId: node.resourceId ? node.resourceId.split("/").pop() : undefined,
        bounds: `[${node.bounds.left},${node.bounds.top}][${node.bounds.right},${node.bounds.bottom}]`,
        clickable: node.clickable || undefined,
        children: node.children?.map((c) => simplifyNode(c, depth + 1)),
      });

      return {
        dumpId,
        tree: tree.map((n) => simplifyNode(n)),
        deviceId,
      };
    }

    case "find": {
      if (!input.selector) {
        throw new Error("selector is required for find operation");
      }

      const debug = input.debug ?? false;
      const nearestTo = input.selector.nearestTo;

      // Use findWithFallbacks for text-based selectors
      if (input.selector.text || input.selector.textContains) {
        // If nearestTo is specified, first find the anchor element
        let anchorCenter: { x: number; y: number } | null = null;
        if (nearestTo) {
          const anchorResult = await context.ui.findWithFallbacks(deviceId, { text: nearestTo }, {
            debug: false,
            includeVisualFallback: false,
          });
          if (anchorResult.elements.length > 0) {
            anchorCenter = getElementCenter(anchorResult.elements[0]);
          }
        }

        const result = await context.ui.findWithFallbacks(deviceId, input.selector, {
          debug,
          includeVisualFallback: config.autoFallbackScreenshot,
          includeBase64: config.includeBase64,
          gridCell: input.gridCell,
          gridPosition: input.gridPosition as 1 | 2 | 3 | 4 | 5 | undefined,
        });

        // If we have an anchor, use containment-based matching
        let usedContainment = false;
        if (anchorCenter && result.elements.length > 0) {
          // Filter to AccessibilityNode elements for containment check
          const accessibilityElements = result.elements.filter(isAccessibilityNode);

          if (accessibilityElements.length > 0) {
            // Get the full tree for containment analysis
            const tree = await context.ui.dump(deviceId);

            // Find elements whose parent container contains the anchor point
            const containingMatches = findContainingSiblingTargets(
              tree,
              anchorCenter,
              accessibilityElements
            );

            if (containingMatches.length > 0) {
              // Prioritize containment matches, then sort remaining by distance
              usedContainment = true;
              const containingCenters = new Set(
                containingMatches.map((el) => `${el.centerX},${el.centerY}`)
              );

              result.elements.sort((a, b) => {
                const aCenter = getElementCenter(a);
                const bCenter = getElementCenter(b);
                const aContains = containingCenters.has(`${aCenter.x},${aCenter.y}`);
                const bContains = containingCenters.has(`${bCenter.x},${bCenter.y}`);

                // Containment matches come first
                if (aContains && !bContains) return -1;
                if (!aContains && bContains) return 1;

                // Within same group, sort by distance
                const distA = calculateDistance(aCenter, anchorCenter!);
                const distB = calculateDistance(bCenter, anchorCenter!);
                return distA - distB;
              });
            } else {
              // Fallback to pure distance sorting if no containment matches
              result.elements.sort((a, b) => {
                const distA = calculateDistance(getElementCenter(a), anchorCenter!);
                const distB = calculateDistance(getElementCenter(b), anchorCenter!);
                return distA - distB;
              });
            }
          }
        }

        lastFindResults = result.elements;

        const response: Record<string, unknown> = {
          elements: result.elements.map((el, index) => {
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
            } else {
              // GridElement
              return {
                index,
                center: el.center,
                bounds: el.bounds,
              };
            }
          }),
          count: result.elements.length,
          deviceId,
        };

        // Always include tier and confidence when available
        if (result.tier !== undefined) response.tier = result.tier;
        if (result.confidence) response.confidence = result.confidence;

        if (debug) {
          response.source = result.source;
          if (result.fallbackReason) {
            response.fallbackReason = result.fallbackReason;
          }
        }

        // Include nearestTo info when used
        if (nearestTo && anchorCenter) {
          response.sortedByProximityTo = {
            query: nearestTo,
            anchor: anchorCenter,
            method: usedContainment ? "containment" : "distance",
          };
        } else if (nearestTo && !anchorCenter) {
          response.nearestToWarning = `Could not find anchor element: "${nearestTo}"`;
        }

        // Include Tier 4 visual candidates if present
        if (result.candidates) {
          response.candidates = result.candidates;
          if (result.truncated) response.truncated = result.truncated;
          if (result.totalCandidates) response.totalCandidates = result.totalCandidates;
        }

        // Include Tier 5 grid fields if present
        if (result.gridImage) response.gridImage = result.gridImage;
        if (result.gridPositions) response.gridPositions = result.gridPositions;

        // Include visual fallback if present (when count is 0 and autoFallbackScreenshot is enabled)
        if (result.visualFallback) {
          response.visualFallback = result.visualFallback;
        }

        return response;
      }

      // Non-text selectors use regular find (no OCR fallback)
      const elements = await context.ui.find(deviceId, input.selector);
      lastFindResults = elements;

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
      };

      // Include visual fallback for non-text selectors when no results and config allows
      if (elements.length === 0 && config.autoFallbackScreenshot) {
        const snapshot = await context.ui.visualSnapshot(deviceId, {
          includeBase64: config.includeBase64,
        });
        response.visualFallback = {
          ...snapshot,
          hint: "No elements matched selector. Use screenshot to identify tap coordinates.",
        };
      }

      return response;
    }

    case "tap": {
      let x: number, y: number;

      if (input.elementIndex !== undefined) {
        if (!lastFindResults[input.elementIndex]) {
          throw new Error(`Element at index ${input.elementIndex} not found. Run 'find' first.`);
        }
        const element = lastFindResults[input.elementIndex];
        const center = getElementCenter(element);
        x = center.x;
        y = center.y;
      } else if (input.x !== undefined && input.y !== undefined) {
        x = input.x;
        y = input.y;
      } else {
        throw new Error("Either x/y coordinates or elementIndex is required for tap");
      }

      await context.ui.tap(deviceId, x, y);
      return { tapped: { x, y }, deviceId };
    }

    case "input": {
      if (!input.text) {
        throw new Error("text is required for input operation");
      }
      await context.ui.input(deviceId, input.text);
      return { input: input.text, deviceId };
    }

    case "screenshot": {
      const result = await context.ui.screenshot(deviceId, {
        localPath: input.localPath,
        inline: input.inline,
      });
      return { ...result, deviceId };
    }

    case "accessibility-check": {
      const result = await context.ui.accessibilityCheck(deviceId);
      return { ...result, deviceId };
    }

    case "visual-snapshot": {
      const snapshot = await context.ui.visualSnapshot(deviceId, {
        includeBase64: input.inline ?? config.includeBase64,
      });
      return { ...snapshot, deviceId };
    }

    default:
      throw new Error(`Unknown operation: ${input.operation}`);
  }
}

export const uiToolDefinition = {
  name: "ui",
  description: "Interact with app UI via accessibility tree. Auto-selects device if only one connected. Operations: dump, find, tap, input, screenshot, accessibility-check, visual-snapshot.",
  inputSchema: {
    type: "object",
    properties: {
      operation: {
        type: "string",
        enum: ["dump", "find", "tap", "input", "screenshot", "accessibility-check", "visual-snapshot"],
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
      inline: { type: "boolean", description: "Return base64 instead of file path (token-heavy, use sparingly)" },
      debug: { type: "boolean", description: "Include source (accessibility/ocr) and confidence in response" },
      gridCell: { type: "number", minimum: 1, maximum: 24, description: "Grid cell number (1-24) for Tier 5 refinement" },
      gridPosition: { type: "number", minimum: 1, maximum: 5, description: "Position within cell (1=TL, 2=TR, 3=Center, 4=BL, 5=BR)" },
    },
    required: ["operation"],
  },
};
