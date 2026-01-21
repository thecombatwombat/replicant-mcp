import { z } from "zod";
import { ServerContext } from "../server.js";
import { CACHE_TTLS } from "../types/index.js";
import { AccessibilityNode } from "../parsers/ui-dump.js";

export const uiInputSchema = z.object({
  operation: z.enum(["dump", "find", "tap", "input", "screenshot", "accessibility-check"]),
  selector: z.object({
    resourceId: z.string().optional(),
    text: z.string().optional(),
    textContains: z.string().optional(),
    className: z.string().optional(),
  }).optional(),
  x: z.number().optional(),
  y: z.number().optional(),
  elementIndex: z.number().optional(),
  text: z.string().optional(),
  localPath: z.string().optional(),
  inline: z.boolean().optional(),
});

export type UiInput = z.infer<typeof uiInputSchema>;

// Store last find results for elementIndex reference
let lastFindResults: AccessibilityNode[] = [];

export async function handleUiTool(
  input: UiInput,
  context: ServerContext
): Promise<Record<string, unknown>> {
  const device = await context.deviceState.ensureDevice(context.adb);
  const deviceId = device.id;

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
      const elements = await context.ui.find(deviceId, input.selector);
      lastFindResults = elements;

      return {
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
    }

    case "tap": {
      let x: number, y: number;

      if (input.elementIndex !== undefined) {
        if (!lastFindResults[input.elementIndex]) {
          throw new Error(`Element at index ${input.elementIndex} not found. Run 'find' first.`);
        }
        const element = lastFindResults[input.elementIndex];
        x = element.centerX;
        y = element.centerY;
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

    default:
      throw new Error(`Unknown operation: ${input.operation}`);
  }
}

export const uiToolDefinition = {
  name: "ui",
  description: "Interact with app UI via accessibility tree. Operations: dump, find, tap, input, screenshot, accessibility-check.",
  inputSchema: {
    type: "object",
    properties: {
      operation: {
        type: "string",
        enum: ["dump", "find", "tap", "input", "screenshot", "accessibility-check"],
      },
      selector: {
        type: "object",
        properties: {
          resourceId: { type: "string" },
          text: { type: "string" },
          textContains: { type: "string" },
          className: { type: "string" },
        },
        description: "Element selector (for find)",
      },
      x: { type: "number", description: "X coordinate (for tap)" },
      y: { type: "number", description: "Y coordinate (for tap)" },
      elementIndex: { type: "number", description: "Element index from last find (for tap)" },
      text: { type: "string", description: "Text to input" },
      localPath: { type: "string", description: "Local path for screenshot" },
    },
    required: ["operation"],
  },
};
