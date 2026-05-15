// Integration test for THE-107: every UI response surface
// (ui-query dump, ui-query find, ui-capture screenshot) must include
// a top-level `app: { packageName, activityName } | null` field.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { handleUiQueryTool } from "../../src/tools/ui-query.js";
import { handleUiCaptureTool } from "../../src/tools/ui-capture.js";

describe("foreground-app field on UI responses (THE-107)", () => {
  let mockContext: any;
  const defaultUiConfig = {
    visualModePackages: [],
    autoFallbackScreenshot: false,
    includeBase64: false,
    maxImageDimension: 800,
  };

  beforeEach(() => {
    mockContext = {
      deviceState: {
        ensureDevice: vi.fn().mockResolvedValue({ id: "emulator-5554" }),
      },
      ui: {
        dump: vi.fn().mockResolvedValue([]),
        find: vi.fn().mockResolvedValue([]),
        findWithFallbacks: vi.fn().mockResolvedValue({ elements: [], source: "accessibility" }),
        visualSnapshot: vi.fn(),
        screenshot: vi.fn().mockResolvedValue({ mode: "file", path: "/tmp/x.png" }),
        getCurrentApp: vi.fn(),
        getScalingState: vi.fn().mockReturnValue(null),
        accessibilityCheck: vi.fn(),
      },
      cache: {
        generateId: vi.fn().mockReturnValue("test-id"),
        set: vi.fn(),
      },
    };
  });

  describe("ui-query dump", () => {
    it("includes app in compact response", async () => {
      mockContext.ui.getCurrentApp.mockResolvedValue({
        packageName: "com.example",
        activityName: ".MainActivity",
      });
      const result = await handleUiQueryTool({ operation: "dump" }, mockContext, defaultUiConfig);
      expect(result.app).toEqual({ packageName: "com.example", activityName: ".MainActivity" });
    });

    it("includes app in full response (compact=false)", async () => {
      mockContext.ui.getCurrentApp.mockResolvedValue({
        packageName: "com.example",
        activityName: ".MainActivity",
      });
      const result = await handleUiQueryTool(
        { operation: "dump", compact: false },
        mockContext,
        defaultUiConfig,
      );
      expect(result.app).toEqual({ packageName: "com.example", activityName: ".MainActivity" });
    });

    it("sets app=null when getCurrentApp throws but parent operation still succeeds", async () => {
      mockContext.ui.getCurrentApp.mockRejectedValue(new Error("adb offline"));
      const result = await handleUiQueryTool({ operation: "dump" }, mockContext, defaultUiConfig);
      expect(result.app).toBeNull();
      expect(result.elements).toBeDefined();
    });
  });

  describe("ui-query find (selector path, no text)", () => {
    it("includes app in response", async () => {
      mockContext.ui.getCurrentApp.mockResolvedValue({
        packageName: "com.example",
        activityName: ".MainActivity",
      });
      mockContext.ui.find.mockResolvedValue([]);
      const result = await handleUiQueryTool(
        { operation: "find", selector: { resourceId: "anything" } },
        mockContext,
        defaultUiConfig,
      );
      expect(result.app).toEqual({ packageName: "com.example", activityName: ".MainActivity" });
    });
  });

  describe("ui-query find (text path)", () => {
    it("includes app in response", async () => {
      mockContext.ui.getCurrentApp.mockResolvedValue({
        packageName: "com.example",
        activityName: ".MainActivity",
      });
      const result = await handleUiQueryTool(
        { operation: "find", selector: { text: "Login" } },
        mockContext,
        defaultUiConfig,
      );
      expect(result.app).toEqual({ packageName: "com.example", activityName: ".MainActivity" });
    });

    it("sets app=null when getCurrentApp fails", async () => {
      mockContext.ui.getCurrentApp.mockRejectedValue(new Error("boom"));
      const result = await handleUiQueryTool(
        { operation: "find", selector: { text: "Login" } },
        mockContext,
        defaultUiConfig,
      );
      expect(result.app).toBeNull();
    });
  });

  describe("ui-capture screenshot", () => {
    it("includes app in response", async () => {
      mockContext.ui.getCurrentApp.mockResolvedValue({
        packageName: "com.example",
        activityName: ".MainActivity",
      });
      const result = await handleUiCaptureTool(
        { operation: "screenshot" },
        mockContext,
        defaultUiConfig,
      );
      expect(result.app).toEqual({ packageName: "com.example", activityName: ".MainActivity" });
    });

    it("sets app=null when getCurrentApp fails", async () => {
      mockContext.ui.getCurrentApp.mockRejectedValue(new Error("boom"));
      const result = await handleUiCaptureTool(
        { operation: "screenshot" },
        mockContext,
        defaultUiConfig,
      );
      expect(result.app).toBeNull();
    });
  });
});
