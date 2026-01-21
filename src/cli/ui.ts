import { Command } from "commander";
import { UiAutomatorAdapter } from "../adapters/index.js";
import { DeviceStateManager, CacheManager } from "../services/index.js";
import { formatUiDump, UiElement } from "./formatter.js";
import { AccessibilityNode } from "../parsers/ui-dump.js";
import { CACHE_TTLS } from "../types/index.js";

const adapter = new UiAutomatorAdapter();
const deviceState = new DeviceStateManager();
const cache = new CacheManager();

// Store last find results for tap --index
let lastFindResults: AccessibilityNode[] = [];

export function createUiCommand(): Command {
  const ui = new Command("ui").description("UI automation and accessibility inspection");

  // Dump subcommand
  ui.command("dump")
    .description("Dump the accessibility tree")
    .option("-d, --device <deviceId>", "Target device (uses active device if not specified)")
    .option("--json", "Output as JSON")
    .action(async (options) => {
      try {
        const deviceId = options.device || getDeviceId();
        const tree = await adapter.dump(deviceId);

        // Cache the dump
        const cacheId = cache.generateId("ui-dump");
        cache.set(cacheId, { tree }, "ui-dump", CACHE_TTLS.UI_TREE);

        if (options.json) {
          console.log(JSON.stringify({ tree, cacheId }, null, 2));
        } else {
          // Convert tree to UiElements for formatting
          const elements = treeToElements(tree);
          const screenName = extractScreenName(tree);

          console.log(
            formatUiDump({
              screenName,
              elements,
            })
          );
          console.log(`Cache ID: ${cacheId}`);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`Error: ${errorMessage}`);
        process.exit(1);
      }
    });

  // Find subcommand
  ui.command("find")
    .description("Find UI elements by selector")
    .option("-d, --device <deviceId>", "Target device (uses active device if not specified)")
    .option("-t, --text <text>", "Exact text match")
    .option("-c, --contains <text>", "Text contains match")
    .option("-i, --id <resourceId>", "Resource ID match")
    .option("--class <className>", "Class name match")
    .option("--json", "Output as JSON")
    .action(async (options) => {
      try {
        const deviceId = options.device || getDeviceId();

        const selector: {
          resourceId?: string;
          text?: string;
          textContains?: string;
          className?: string;
        } = {};

        if (options.text) selector.text = options.text;
        if (options.contains) selector.textContains = options.contains;
        if (options.id) selector.resourceId = options.id;
        if (options.class) selector.className = options.class;

        // Ensure at least one selector is provided
        if (Object.keys(selector).length === 0) {
          console.error("Error: At least one selector option required (--text, --contains, --id, or --class)");
          process.exit(1);
        }

        const results = await adapter.find(deviceId, selector);
        lastFindResults = results;

        // Cache the results
        const cacheId = cache.generateId("ui-find");
        cache.set(cacheId, { results, selector }, "ui-find", CACHE_TTLS.UI_TREE);

        if (options.json) {
          console.log(JSON.stringify({ results, count: results.length, cacheId }, null, 2));
        } else {
          if (results.length === 0) {
            console.log("No elements found matching selector");
          } else {
            console.log(`Found ${results.length} element(s):`);
            results.forEach((node, idx) => {
              const desc = node.text || node.contentDesc || node.resourceId || node.className;
              console.log(
                `  [${idx}] ${node.className.split(".").pop()} "${desc}" at (${node.centerX}, ${node.centerY})`
              );
            });
            console.log(`\nUse 'ui tap --index <n>' to tap an element`);
          }
          console.log(`Cache ID: ${cacheId}`);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`Error: ${errorMessage}`);
        process.exit(1);
      }
    });

  // Tap subcommand
  ui.command("tap")
    .description("Tap a UI element or coordinates")
    .option("-d, --device <deviceId>", "Target device (uses active device if not specified)")
    .option("-i, --index <index>", "Index from last find results")
    .option("-x, --x <x>", "X coordinate")
    .option("-y, --y <y>", "Y coordinate")
    .action(async (options) => {
      try {
        const deviceId = options.device || getDeviceId();

        if (options.index !== undefined) {
          const index = parseInt(options.index, 10);

          if (lastFindResults.length === 0) {
            console.error("Error: No previous find results. Run 'ui find' first.");
            process.exit(1);
          }

          if (index < 0 || index >= lastFindResults.length) {
            console.error(`Error: Index ${index} out of range (0-${lastFindResults.length - 1})`);
            process.exit(1);
          }

          const element = lastFindResults[index];
          await adapter.tapElement(deviceId, element);
          console.log(`Tapped element [${index}] at (${element.centerX}, ${element.centerY})`);
        } else if (options.x !== undefined && options.y !== undefined) {
          const x = parseInt(options.x, 10);
          const y = parseInt(options.y, 10);
          await adapter.tap(deviceId, x, y);
          console.log(`Tapped at (${x}, ${y})`);
        } else {
          console.error("Error: Provide either --index or both --x and --y");
          process.exit(1);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`Error: ${errorMessage}`);
        process.exit(1);
      }
    });

  // Input subcommand
  ui.command("input <text>")
    .description("Input text to the focused element")
    .option("-d, --device <deviceId>", "Target device (uses active device if not specified)")
    .action(async (text, options) => {
      try {
        const deviceId = options.device || getDeviceId();
        await adapter.input(deviceId, text);
        console.log(`Input text: "${text}"`);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`Error: ${errorMessage}`);
        process.exit(1);
      }
    });

  // Screenshot subcommand
  ui.command("screenshot [path]")
    .description("Take a screenshot")
    .option("-d, --device <deviceId>", "Target device (uses active device if not specified)")
    .action(async (path, options) => {
      try {
        const deviceId = options.device || getDeviceId();
        const outputPath = path || `screenshot-${Date.now()}.png`;
        await adapter.screenshot(deviceId, outputPath);
        console.log(`Screenshot saved: ${outputPath}`);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`Error: ${errorMessage}`);
        process.exit(1);
      }
    });

  return ui;
}

function getDeviceId(): string {
  const device = deviceState.requireCurrentDevice();
  return device.id;
}

function extractScreenName(tree: AccessibilityNode[]): string {
  // Try to find an activity or window name from the tree
  if (tree.length > 0) {
    const root = tree[0];
    // Common patterns for activity names in class names
    if (root.className.includes("Activity")) {
      return root.className.split(".").pop() || "Unknown";
    }
    if (root.className.includes("DecorView")) {
      return "Main Window";
    }
  }
  return "Unknown Screen";
}

function treeToElements(tree: AccessibilityNode[]): UiElement[] {
  const elements: UiElement[] = [];
  let elementIndex = 0;

  function walk(node: AccessibilityNode) {
    // Only include interactive or text-containing elements
    if (node.clickable || node.focusable || node.text || node.contentDesc) {
      elements.push({
        index: elementIndex++,
        type: node.className.split(".").pop() || "Unknown",
        text: node.text || undefined,
        hint: node.contentDesc || undefined,
        focused: node.focusable,
      });
    }

    if (node.children) {
      for (const child of node.children) {
        walk(child);
      }
    }
  }

  for (const node of tree) {
    walk(node);
  }

  return elements;
}
