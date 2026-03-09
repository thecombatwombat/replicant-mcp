import { describe, it, expect } from "vitest";
import { DEFAULT_CONFIG } from "../../src/types/config.js";
import { uiCaptureToolDefinition } from "../../src/tools/ui-capture.js";

describe("UI default consistency", () => {
  it("documents maxDimension default to match runtime config", () => {
    const description = uiCaptureToolDefinition.inputSchema.properties.maxDimension.description;
    expect(description).toContain(`default: ${DEFAULT_CONFIG.ui.maxImageDimension}`);
  });
});
