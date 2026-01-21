import { describe, it, expect, vi, beforeEach } from "vitest";
import { handleUiTool } from "../../src/tools/ui.js";

describe("Visual Fallback", () => {
  let mockContext: any;
  const defaultUiConfig = {
    visualModePackages: [],
    autoFallbackScreenshot: true,
    includeBase64: false,
  };

  beforeEach(() => {
    mockContext = {
      deviceState: {
        ensureDevice: vi.fn().mockResolvedValue({ id: "emulator-5554" }),
      },
      ui: {
        findWithOcrFallback: vi.fn(),
        find: vi.fn(),
        visualSnapshot: vi.fn(),
        tap: vi.fn(),
      },
      cache: {
        generateId: vi.fn().mockReturnValue("test-id"),
        set: vi.fn(),
      },
    };
  });

  describe("visual-snapshot operation", () => {
    it("returns visual snapshot with screen metadata and app info", async () => {
      mockContext.ui.visualSnapshot.mockResolvedValue({
        screenshotPath: "/tmp/screenshot.png",
        screen: { width: 1080, height: 2400, density: 2.75 },
        app: { packageName: "com.example", activityName: ".MainActivity" },
      });

      const result = await handleUiTool(
        { operation: "visual-snapshot" },
        mockContext,
        defaultUiConfig
      );

      expect(result.screenshotPath).toBe("/tmp/screenshot.png");
      expect(result.screen).toEqual({ width: 1080, height: 2400, density: 2.75 });
      expect(result.app).toEqual({ packageName: "com.example", activityName: ".MainActivity" });
      expect(result.deviceId).toBe("emulator-5554");
    });

    it("includes base64 when inline=true", async () => {
      mockContext.ui.visualSnapshot.mockResolvedValue({
        screenshotPath: "/tmp/screenshot.png",
        screenshotBase64: "base64data...",
        screen: { width: 1080, height: 2400, density: 2.75 },
        app: { packageName: "com.example", activityName: ".MainActivity" },
      });

      const result = await handleUiTool(
        { operation: "visual-snapshot", inline: true },
        mockContext,
        defaultUiConfig
      );

      expect(mockContext.ui.visualSnapshot).toHaveBeenCalledWith("emulator-5554", { includeBase64: true });
      expect(result.screenshotBase64).toBe("base64data...");
    });
  });

  describe("find with visual fallback", () => {
    it("includes visualFallback when no results found and autoFallbackScreenshot=true", async () => {
      mockContext.ui.findWithOcrFallback.mockResolvedValue({
        elements: [],
        source: "ocr",
        visualFallback: {
          screenshotPath: "/tmp/fallback.png",
          screen: { width: 1080, height: 2400, density: 2.75 },
          app: { packageName: "com.example", activityName: ".MainActivity" },
          hint: "No elements matched selector. Use screenshot to identify tap coordinates.",
        },
      });

      const result = await handleUiTool(
        { operation: "find", selector: { text: "NonExistent" } },
        mockContext,
        defaultUiConfig
      );

      expect(result.count).toBe(0);
      expect(result.visualFallback).toBeDefined();
      expect(result.visualFallback.screenshotPath).toBe("/tmp/fallback.png");
      expect(result.visualFallback.hint).toContain("Use screenshot");
    });

    it("does not include visualFallback when autoFallbackScreenshot=false", async () => {
      mockContext.ui.findWithOcrFallback.mockResolvedValue({
        elements: [],
        source: "ocr",
      });

      const result = await handleUiTool(
        { operation: "find", selector: { text: "NonExistent" } },
        mockContext,
        { ...defaultUiConfig, autoFallbackScreenshot: false }
      );

      expect(result.count).toBe(0);
      expect(result.visualFallback).toBeUndefined();
    });

    it("does not include visualFallback when results are found", async () => {
      mockContext.ui.findWithOcrFallback.mockResolvedValue({
        elements: [
          { text: "Login", centerX: 200, centerY: 300, bounds: {}, clickable: true },
        ],
        source: "accessibility",
      });

      const result = await handleUiTool(
        { operation: "find", selector: { text: "Login" } },
        mockContext,
        defaultUiConfig
      );

      expect(result.count).toBe(1);
      expect(result.visualFallback).toBeUndefined();
    });
  });

  describe("find with non-text selector fallback", () => {
    it("includes visualFallback for non-text selectors when no results", async () => {
      mockContext.ui.find.mockResolvedValue([]);
      mockContext.ui.visualSnapshot.mockResolvedValue({
        screenshotPath: "/tmp/fallback.png",
        screen: { width: 1080, height: 2400, density: 2.75 },
        app: { packageName: "com.example", activityName: ".MainActivity" },
      });

      const result = await handleUiTool(
        { operation: "find", selector: { resourceId: "nonexistent" } },
        mockContext,
        defaultUiConfig
      );

      expect(result.count).toBe(0);
      expect(result.visualFallback).toBeDefined();
      expect(result.visualFallback.hint).toContain("Use screenshot");
    });

    it("does not include visualFallback for non-text selectors when results found", async () => {
      mockContext.ui.find.mockResolvedValue([
        { text: "", resourceId: "btn", className: "Button", centerX: 100, centerY: 100, bounds: {}, clickable: true },
      ]);

      const result = await handleUiTool(
        { operation: "find", selector: { resourceId: "btn" } },
        mockContext,
        defaultUiConfig
      );

      expect(result.count).toBe(1);
      expect(result.visualFallback).toBeUndefined();
      expect(mockContext.ui.visualSnapshot).not.toHaveBeenCalled();
    });
  });
});
