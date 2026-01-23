import { describe, it, expect, vi, beforeEach } from "vitest";
import { parseUiDump } from "../../src/parsers/ui-dump.js";
import { UiAutomatorAdapter } from "../../src/adapters/ui-automator.js";

// Mock OCR service
vi.mock("../../src/services/ocr.js", () => ({
  extractText: vi.fn(),
  searchText: vi.fn(),
  terminateOcr: vi.fn(),
}));

// Mock fs/promises for base64 reading and file operations
vi.mock("fs/promises", () => ({
  readFile: vi.fn(),
  unlink: vi.fn().mockResolvedValue(undefined),
  rename: vi.fn().mockResolvedValue(undefined),
}));

// Mock icon-patterns service
vi.mock("../../src/services/icon-patterns.js", () => ({
  matchIconPattern: vi.fn(),
  matchesResourceId: vi.fn(),
}));

// Mock visual-candidates service
vi.mock("../../src/services/visual-candidates.js", () => ({
  filterIconCandidates: vi.fn(),
  formatBounds: vi.fn(),
  cropCandidateImage: vi.fn(),
}));

// Mock grid service
vi.mock("../../src/services/grid.js", () => ({
  calculateGridCellBounds: vi.fn(),
  calculatePositionCoordinates: vi.fn(),
  createGridOverlay: vi.fn(),
  POSITION_LABELS: ["Top-left", "Top-right", "Center", "Bottom-left", "Bottom-right"],
}));

// Mock sharp
vi.mock("sharp", () => ({
  default: vi.fn(() => ({
    metadata: vi.fn().mockResolvedValue({ width: 1080, height: 2400 }),
    resize: vi.fn().mockReturnThis(),
    toFile: vi.fn().mockResolvedValue(undefined),
  })),
}));
import sharp from "sharp";

import { extractText, searchText } from "../../src/services/ocr.js";
import { matchIconPattern, matchesResourceId } from "../../src/services/icon-patterns.js";
import { filterIconCandidates, formatBounds, cropCandidateImage } from "../../src/services/visual-candidates.js";
import { calculateGridCellBounds, calculatePositionCoordinates, createGridOverlay } from "../../src/services/grid.js";
import * as fs from "fs/promises";

describe("UI Dump Parsing", () => {
  it("parses simple UI hierarchy", () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<hierarchy rotation="0">
  <node index="0" text="" resource-id="" class="android.widget.FrameLayout" bounds="[0,0][1080,2400]">
    <node index="0" text="Hello" resource-id="com.example:id/text" class="android.widget.TextView" bounds="[100,200][300,250]" />
    <node index="1" text="" resource-id="com.example:id/button" class="android.widget.Button" bounds="[100,300][300,350]">
      <node index="0" text="Click Me" class="android.widget.TextView" bounds="[120,310][280,340]" />
    </node>
  </node>
</hierarchy>`;

    const tree = parseUiDump(xml);
    expect(tree).toHaveLength(1);
    expect(tree[0].className).toBe("android.widget.FrameLayout");
    expect(tree[0].children).toHaveLength(2);
    expect(tree[0].children![0].text).toBe("Hello");
    expect(tree[0].children![0].resourceId).toBe("com.example:id/text");
  });

  it("extracts bounds as coordinates", () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<hierarchy>
  <node bounds="[100,200][300,400]" class="android.widget.Button" />
</hierarchy>`;

    const tree = parseUiDump(xml);
    expect(tree[0].bounds).toEqual({ left: 100, top: 200, right: 300, bottom: 400 });
    expect(tree[0].centerX).toBe(200);
    expect(tree[0].centerY).toBe(300);
  });
});

describe("UiAutomatorAdapter", () => {
  let mockAdb: {
    shell: ReturnType<typeof vi.fn>;
    pull: ReturnType<typeof vi.fn>;
  };
  let adapter: UiAutomatorAdapter;

  beforeEach(() => {
    mockAdb = {
      shell: vi.fn(),
      pull: vi.fn(),
    };
    adapter = new UiAutomatorAdapter(mockAdb as any);
  });

  describe("screenshot", () => {
    it("captures screenshot and pulls to local path (file mode)", async () => {
      mockAdb.shell.mockResolvedValue({ stdout: "", stderr: "", exitCode: 0 });
      mockAdb.pull.mockResolvedValue(undefined);

      const result = await adapter.screenshot("emulator-5554", { localPath: "/tmp/test.png" });

      expect(mockAdb.shell).toHaveBeenCalledWith("emulator-5554", "screencap -p /sdcard/replicant-screenshot.png");
      expect(mockAdb.pull).toHaveBeenCalledWith("emulator-5554", "/sdcard/replicant-screenshot.png", "/tmp/test.png");
      expect(result.mode).toBe("file");
      expect(result.path).toBe("/tmp/test.png");
    });

    it("uses default path when localPath not provided", async () => {
      mockAdb.shell.mockResolvedValue({ stdout: "", stderr: "", exitCode: 0 });
      mockAdb.pull.mockResolvedValue(undefined);

      const result = await adapter.screenshot("emulator-5554", {});

      expect(result.mode).toBe("file");
      expect(result.path).toMatch(/\.replicant\/screenshots\/screenshot-\d+\.png$/);
    });

    it("returns base64 when inline mode requested", async () => {
      mockAdb.shell
        .mockResolvedValueOnce({ stdout: "", stderr: "", exitCode: 0 }) // screencap
        .mockResolvedValueOnce({ stdout: "iVBORw0KGgo=", stderr: "", exitCode: 0 }) // base64
        .mockResolvedValueOnce({ stdout: "12345", stderr: "", exitCode: 0 }) // stat
        .mockResolvedValueOnce({ stdout: "", stderr: "", exitCode: 0 }); // rm

      const result = await adapter.screenshot("emulator-5554", { inline: true });

      expect(result.mode).toBe("inline");
      expect(result.base64).toBe("iVBORw0KGgo=");
      expect(result.sizeBytes).toBe(12345);
    });

    it("clears scaling state when inline mode requested", async () => {
      // First take a scaled screenshot to set scalingState
      mockAdb.shell.mockResolvedValue({ stdout: "", stderr: "", exitCode: 0 });
      mockAdb.pull.mockResolvedValue(undefined);
      await adapter.screenshot("emulator-5554", { localPath: "/tmp/test.png" });

      // Verify scaling state was set
      expect((adapter as unknown as { scalingState: unknown }).scalingState).not.toBeNull();

      // Now take inline screenshot
      mockAdb.shell
        .mockResolvedValueOnce({ stdout: "", stderr: "", exitCode: 0 }) // screencap
        .mockResolvedValueOnce({ stdout: "iVBORw0KGgo=", stderr: "", exitCode: 0 }) // base64
        .mockResolvedValueOnce({ stdout: "12345", stderr: "", exitCode: 0 }) // stat
        .mockResolvedValueOnce({ stdout: "", stderr: "", exitCode: 0 }); // rm

      await adapter.screenshot("emulator-5554", { inline: true });

      // Verify scaling state is cleared
      expect((adapter as unknown as { scalingState: unknown }).scalingState).toBeNull();
    });

    it("throws SCREENSHOT_FAILED when capture fails", async () => {
      mockAdb.shell.mockResolvedValue({ stdout: "", stderr: "error", exitCode: 1 });

      await expect(
        adapter.screenshot("emulator-5554", {})
      ).rejects.toThrow("Failed to capture screenshot");
    });

    it("cleans up remote file after pull", async () => {
      mockAdb.shell.mockResolvedValue({ stdout: "", stderr: "", exitCode: 0 });
      mockAdb.pull.mockResolvedValue(undefined);

      await adapter.screenshot("emulator-5554", { localPath: "/tmp/test.png" });

      // Last shell call should be rm
      const rmCall = mockAdb.shell.mock.calls.find(call => call[1].includes("rm"));
      expect(rmCall).toBeDefined();
    });

    it("scales screenshot when device exceeds max dimension", async () => {
      mockAdb.shell.mockResolvedValue({ stdout: "", stderr: "", exitCode: 0 });
      mockAdb.pull.mockResolvedValue(undefined);

      const result = await adapter.screenshot("emulator-5554", {
        localPath: "/tmp/test.png",
        maxDimension: 1000,
      });

      expect(result.mode).toBe("file");
      expect(result.device).toEqual({ width: 1080, height: 2400 });
      expect(result.image).toEqual({ width: 450, height: 1000 });
      expect(result.scaleFactor).toBe(2.4);
      expect(sharp).toHaveBeenCalled();
    });

    it("skips scaling when raw=true", async () => {
      mockAdb.shell.mockResolvedValue({ stdout: "", stderr: "", exitCode: 0 });
      mockAdb.pull.mockResolvedValue(undefined);

      const result = await adapter.screenshot("emulator-5554", {
        localPath: "/tmp/test.png",
        raw: true,
      });

      expect(result.scaleFactor).toBe(1.0);
      expect(result.warning).toContain("Raw mode");
    });

    it("skips scaling when device fits within max dimension", async () => {
      vi.mocked(sharp).mockImplementation(() => ({
        metadata: vi.fn().mockResolvedValue({ width: 800, height: 600 }),
        resize: vi.fn().mockReturnThis(),
        toFile: vi.fn().mockResolvedValue(undefined),
      } as any));

      mockAdb.shell.mockResolvedValue({ stdout: "", stderr: "", exitCode: 0 });
      mockAdb.pull.mockResolvedValue(undefined);

      const result = await adapter.screenshot("emulator-5554", {
        localPath: "/tmp/test.png",
        maxDimension: 1000,
      });

      expect(result.scaleFactor).toBe(1.0);
    });
  });

  describe("findWithOcrFallback", () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it("returns accessibility results when found", async () => {
      // Mock UI dump with matching element
      mockAdb.shell
        .mockResolvedValueOnce({ stdout: "", stderr: "", exitCode: 0 }) // uiautomator dump
        .mockResolvedValueOnce({
          stdout: `<?xml version="1.0"?>
<hierarchy>
  <node text="Login" bounds="[100,200][300,250]" class="android.widget.Button" clickable="true" />
</hierarchy>`,
          stderr: "",
          exitCode: 0,
        }) // cat dump
        .mockResolvedValueOnce({ stdout: "", stderr: "", exitCode: 0 }); // rm dump

      const result = await adapter.findWithOcrFallback("emulator-5554", { text: "Login" });

      expect(result.elements).toHaveLength(1);
      expect((result.elements[0] as any).text).toBe("Login");
      expect(result.source).toBe("accessibility");
      expect(extractText).not.toHaveBeenCalled();
    });

    it("falls back to OCR when accessibility returns no matches", async () => {
      // Mock UI dump with no matching elements
      mockAdb.shell
        .mockResolvedValueOnce({ stdout: "", stderr: "", exitCode: 0 }) // uiautomator dump
        .mockResolvedValueOnce({
          stdout: `<?xml version="1.0"?><hierarchy><node text="" bounds="[0,0][100,100]" class="View" /></hierarchy>`,
          stderr: "",
          exitCode: 0,
        }) // cat dump
        .mockResolvedValueOnce({ stdout: "", stderr: "", exitCode: 0 }) // rm dump
        .mockResolvedValueOnce({ stdout: "", stderr: "", exitCode: 0 }) // screencap
        .mockResolvedValueOnce({ stdout: "", stderr: "", exitCode: 0 }); // rm screenshot

      mockAdb.pull.mockResolvedValue(undefined);

      vi.mocked(extractText).mockResolvedValue([
        { text: "Chobani High Protein", confidence: 0.92, bounds: { x0: 10, y0: 100, x1: 200, y1: 150 } },
      ]);

      vi.mocked(searchText).mockReturnValue([
        { index: 0, text: "Chobani High Protein", bounds: "[10,100][200,150]", center: { x: 105, y: 125 }, confidence: 0.92 },
      ]);

      const result = await adapter.findWithOcrFallback("emulator-5554", { text: "Chobani" });

      expect(result.elements).toHaveLength(1);
      expect((result.elements[0] as any).text).toBe("Chobani High Protein");
      expect(result.source).toBe("ocr");
      expect(extractText).toHaveBeenCalled();
      expect(searchText).toHaveBeenCalledWith(expect.any(Array), "Chobani");
    });

    it("includes debug info when debug=true", async () => {
      mockAdb.shell
        .mockResolvedValueOnce({ stdout: "", stderr: "", exitCode: 0 }) // uiautomator dump
        .mockResolvedValueOnce({
          stdout: `<?xml version="1.0"?><hierarchy><node text="" bounds="[0,0][100,100]" class="View" /></hierarchy>`,
          stderr: "",
          exitCode: 0,
        }) // cat dump
        .mockResolvedValueOnce({ stdout: "", stderr: "", exitCode: 0 }) // rm dump
        .mockResolvedValueOnce({ stdout: "", stderr: "", exitCode: 0 }) // screencap
        .mockResolvedValueOnce({ stdout: "", stderr: "", exitCode: 0 }); // rm screenshot

      mockAdb.pull.mockResolvedValue(undefined);

      // No pattern match
      vi.mocked(matchIconPattern).mockReturnValue(null);

      vi.mocked(extractText).mockResolvedValue([
        { text: "Test", confidence: 0.85, bounds: { x0: 0, y0: 0, x1: 50, y1: 25 } },
      ]);
      vi.mocked(searchText).mockReturnValue([
        { index: 0, text: "Test", bounds: "[0,0][50,25]", center: { x: 25, y: 12 }, confidence: 0.85 },
      ]);

      const result = await adapter.findWithOcrFallback("emulator-5554", { text: "test" }, { debug: true });

      expect(result.source).toBe("ocr");
      // Updated message with new findWithFallbacks
      expect(result.fallbackReason).toBe("no accessibility or pattern match, found via OCR");
    });

    it("returns empty results when both accessibility and OCR find nothing", async () => {
      // Use mockImplementation to handle any order of calls
      mockAdb.shell.mockImplementation(async (deviceId: string, cmd: string) => {
        if (cmd.includes("uiautomator dump")) {
          return { stdout: "", stderr: "", exitCode: 0 };
        }
        if (cmd.includes("cat /sdcard/ui-dump.xml")) {
          return {
            stdout: `<?xml version="1.0"?><hierarchy><node text="" bounds="[0,0][100,100]" class="View" /></hierarchy>`,
            stderr: "",
            exitCode: 0,
          };
        }
        if (cmd.includes("rm")) {
          return { stdout: "", stderr: "", exitCode: 0 };
        }
        if (cmd.includes("screencap")) {
          return { stdout: "", stderr: "", exitCode: 0 };
        }
        if (cmd.includes("wm size")) {
          return { stdout: "Physical size: 1080x2400\n", stderr: "", exitCode: 0 };
        }
        if (cmd.includes("wm density")) {
          return { stdout: "Physical density: 440\n", stderr: "", exitCode: 0 };
        }
        return { stdout: "", stderr: "", exitCode: 0 };
      });

      mockAdb.pull.mockResolvedValue(undefined);

      // No pattern match
      vi.mocked(matchIconPattern).mockReturnValue(null);

      vi.mocked(extractText).mockResolvedValue([
        { text: "Something Else", confidence: 0.90, bounds: { x0: 0, y0: 0, x1: 100, y1: 50 } },
      ]);
      vi.mocked(searchText).mockReturnValue([]);

      // No visual candidates
      vi.mocked(filterIconCandidates).mockReturnValue([]);

      // Mock grid overlay
      vi.mocked(createGridOverlay).mockResolvedValue("base64GridImage");

      const result = await adapter.findWithOcrFallback("emulator-5554", { text: "NotFound" });

      expect(result.elements).toHaveLength(0);
      // With the new tiers, when OCR fails and no candidates, it falls to grid (Tier 5)
      expect(result.source).toBe("grid");
      expect(result.tier).toBe(5);
    });
  });

  describe("getScreenMetadata", () => {
    it("parses screen size and density from wm commands", async () => {
      mockAdb.shell
        .mockResolvedValueOnce({ stdout: "Physical size: 1080x2400\n", stderr: "", exitCode: 0 })
        .mockResolvedValueOnce({ stdout: "Physical density: 440\n", stderr: "", exitCode: 0 });

      const result = await adapter.getScreenMetadata("emulator-5554");

      expect(result.width).toBe(1080);
      expect(result.height).toBe(2400);
      expect(result.density).toBe(2.75); // 440/160
    });

    it("uses defaults when parsing fails", async () => {
      mockAdb.shell
        .mockResolvedValueOnce({ stdout: "Unknown format", stderr: "", exitCode: 0 })
        .mockResolvedValueOnce({ stdout: "Unknown format", stderr: "", exitCode: 0 });

      const result = await adapter.getScreenMetadata("emulator-5554");

      expect(result.width).toBe(1080);
      expect(result.height).toBe(1920);
      expect(result.density).toBe(2.75);
    });
  });

  describe("getCurrentApp", () => {
    it("parses current app from dumpsys activity", async () => {
      mockAdb.shell.mockResolvedValueOnce({
        stdout: "  mResumedActivity: ActivityRecord{abc123 u0 com.example.app/.MainActivity t456}",
        stderr: "",
        exitCode: 0,
      });

      const result = await adapter.getCurrentApp("emulator-5554");

      expect(result.packageName).toBe("com.example.app");
      expect(result.activityName).toBe(".MainActivity");
    });

    it("falls back to window manager when activity not found", async () => {
      mockAdb.shell
        .mockResolvedValueOnce({ stdout: "", stderr: "", exitCode: 0 }) // empty dumpsys activity
        .mockResolvedValueOnce({
          stdout: "  mCurrentFocus=Window{abc com.test.app/.TestActivity}",
          stderr: "",
          exitCode: 0,
        });

      const result = await adapter.getCurrentApp("emulator-5554");

      expect(result.packageName).toBe("com.test.app");
      expect(result.activityName).toBe(".TestActivity");
    });

    it("returns unknown when both methods fail", async () => {
      mockAdb.shell
        .mockResolvedValueOnce({ stdout: "", stderr: "", exitCode: 0 })
        .mockResolvedValueOnce({ stdout: "", stderr: "", exitCode: 0 });

      const result = await adapter.getCurrentApp("emulator-5554");

      expect(result.packageName).toBe("unknown");
      expect(result.activityName).toBe("unknown");
    });
  });

  describe("visualSnapshot", () => {
    it("returns screenshot path, screen metadata, and app info", async () => {
      // Since visualSnapshot runs screenshot, getScreenMetadata, getCurrentApp in parallel,
      // we need to use mockImplementation to handle any order
      mockAdb.shell.mockImplementation(async (deviceId: string, cmd: string) => {
        if (cmd.includes("screencap")) {
          return { stdout: "", stderr: "", exitCode: 0 };
        }
        if (cmd.includes("rm")) {
          return { stdout: "", stderr: "", exitCode: 0 };
        }
        if (cmd.includes("wm size")) {
          return { stdout: "Physical size: 1080x2400\n", stderr: "", exitCode: 0 };
        }
        if (cmd.includes("wm density")) {
          return { stdout: "Physical density: 440\n", stderr: "", exitCode: 0 };
        }
        if (cmd.includes("dumpsys activity")) {
          return {
            stdout: "  mResumedActivity: ActivityRecord{abc com.example/.Main t1}",
            stderr: "",
            exitCode: 0,
          };
        }
        return { stdout: "", stderr: "", exitCode: 0 };
      });

      mockAdb.pull.mockResolvedValue(undefined);

      const result = await adapter.visualSnapshot("emulator-5554");

      expect(result.screenshotPath).toMatch(/\.replicant\/screenshots\/screenshot-\d+\.png$/);
      expect(result.screen).toEqual({ width: 1080, height: 2400, density: 2.75 });
      expect(result.app.packageName).toBe("com.example");
      expect(result.app.activityName).toBe(".Main");
    });

    it("includes base64 when requested", async () => {
      mockAdb.shell.mockImplementation(async (deviceId: string, cmd: string) => {
        if (cmd.includes("screencap")) {
          return { stdout: "", stderr: "", exitCode: 0 };
        }
        if (cmd.includes("rm")) {
          return { stdout: "", stderr: "", exitCode: 0 };
        }
        if (cmd.includes("wm size")) {
          return { stdout: "Physical size: 1080x2400\n", stderr: "", exitCode: 0 };
        }
        if (cmd.includes("wm density")) {
          return { stdout: "Physical density: 440\n", stderr: "", exitCode: 0 };
        }
        if (cmd.includes("dumpsys activity")) {
          return {
            stdout: "  mResumedActivity: ActivityRecord{abc com.example/.Main t1}",
            stderr: "",
            exitCode: 0,
          };
        }
        return { stdout: "", stderr: "", exitCode: 0 };
      });

      mockAdb.pull.mockResolvedValue(undefined);

      // Mock fs.readFile for base64 encoding
      vi.mocked(fs.readFile).mockResolvedValue(Buffer.from("base64data"));

      const result = await adapter.visualSnapshot("emulator-5554", { includeBase64: true });

      expect(result.screenshotBase64).toBe("YmFzZTY0ZGF0YQ=="); // "base64data" encoded
    });
  });

  describe("dump with scaling", () => {
    it("converts bounds to image space when scaling state exists", async () => {
      // First take a screenshot to set scaling state
      vi.mocked(sharp).mockImplementation(() => ({
        metadata: vi.fn().mockResolvedValue({ width: 1080, height: 2400 }),
        resize: vi.fn().mockReturnThis(),
        toFile: vi.fn().mockResolvedValue(undefined),
      } as any));

      mockAdb.shell.mockResolvedValue({ stdout: "", stderr: "", exitCode: 0 });
      mockAdb.pull.mockResolvedValue(undefined);

      await adapter.screenshot("emulator-5554", { maxDimension: 1000 });

      // Now dump should return converted bounds
      mockAdb.shell
        .mockResolvedValueOnce({ stdout: "", stderr: "", exitCode: 0 }) // uiautomator dump
        .mockResolvedValueOnce({
          stdout: `<?xml version="1.0"?>
<hierarchy>
  <node text="Button" bounds="[240,480][480,720]" class="android.widget.Button" clickable="true" />
</hierarchy>`,
          stderr: "",
          exitCode: 0,
        }) // cat dump
        .mockResolvedValueOnce({ stdout: "", stderr: "", exitCode: 0 }); // rm dump

      const tree = await adapter.dump("emulator-5554");

      // With scaleFactor 2.4: [240,480][480,720] -> [100,200][200,300]
      expect(tree[0].bounds).toEqual({ left: 100, top: 200, right: 200, bottom: 300 });
      expect(tree[0].centerX).toBe(150);
      expect(tree[0].centerY).toBe(250);
    });

    it("returns original bounds when no scaling state exists", async () => {
      mockAdb.shell
        .mockResolvedValueOnce({ stdout: "", stderr: "", exitCode: 0 }) // uiautomator dump
        .mockResolvedValueOnce({
          stdout: `<?xml version="1.0"?>
<hierarchy>
  <node text="Button" bounds="[240,480][480,720]" class="android.widget.Button" clickable="true" />
</hierarchy>`,
          stderr: "",
          exitCode: 0,
        }) // cat dump
        .mockResolvedValueOnce({ stdout: "", stderr: "", exitCode: 0 }); // rm dump

      const tree = await adapter.dump("emulator-5554");

      // No scaling state, bounds should be unchanged
      expect(tree[0].bounds).toEqual({ left: 240, top: 480, right: 480, bottom: 720 });
      expect(tree[0].centerX).toBe(360);
      expect(tree[0].centerY).toBe(600);
    });

    it("converts nested children bounds recursively", async () => {
      // First take a screenshot to set scaling state
      vi.mocked(sharp).mockImplementation(() => ({
        metadata: vi.fn().mockResolvedValue({ width: 1080, height: 2400 }),
        resize: vi.fn().mockReturnThis(),
        toFile: vi.fn().mockResolvedValue(undefined),
      } as any));

      mockAdb.shell.mockResolvedValue({ stdout: "", stderr: "", exitCode: 0 });
      mockAdb.pull.mockResolvedValue(undefined);

      await adapter.screenshot("emulator-5554", { maxDimension: 1000 });

      // Now dump should return converted bounds for nested nodes
      mockAdb.shell
        .mockResolvedValueOnce({ stdout: "", stderr: "", exitCode: 0 }) // uiautomator dump
        .mockResolvedValueOnce({
          stdout: `<?xml version="1.0"?>
<hierarchy>
  <node text="" bounds="[0,0][1080,2400]" class="android.widget.FrameLayout">
    <node text="Child" bounds="[240,480][480,720]" class="android.widget.TextView" />
  </node>
</hierarchy>`,
          stderr: "",
          exitCode: 0,
        }) // cat dump
        .mockResolvedValueOnce({ stdout: "", stderr: "", exitCode: 0 }); // rm dump

      const tree = await adapter.dump("emulator-5554");

      // Parent should be scaled: [0,0][1080,2400] -> [0,0][450,1000]
      expect(tree[0].bounds).toEqual({ left: 0, top: 0, right: 450, bottom: 1000 });
      // Child should be scaled: [240,480][480,720] -> [100,200][200,300]
      expect(tree[0].children![0].bounds).toEqual({ left: 100, top: 200, right: 200, bottom: 300 });
      expect(tree[0].children![0].centerX).toBe(150);
      expect(tree[0].children![0].centerY).toBe(250);
    });
  });

  describe("findWithFallbacks", () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    describe("Tier 2: ResourceId pattern matching", () => {
      it("finds overflow menu by resourceId pattern when text match fails", async () => {
        // Mock UI dump - first for find() (returns no match), then for Tier 2 dump
        const overflowXml = `<?xml version="1.0"?>
<hierarchy>
  <node text="" resource-id="com.example:id/overflow_menu" class="android.widget.ImageButton" bounds="[1000,50][1048,98]" clickable="true" content-desc="" />
</hierarchy>`;

        mockAdb.shell
          .mockResolvedValueOnce({ stdout: "", stderr: "", exitCode: 0 }) // uiautomator dump for find()
          .mockResolvedValueOnce({
            stdout: `<?xml version="1.0"?><hierarchy><node text="" bounds="[0,0][100,100]" class="View" resource-id="" /></hierarchy>`,
            stderr: "",
            exitCode: 0,
          }) // cat dump for find() - no text match
          .mockResolvedValueOnce({ stdout: "", stderr: "", exitCode: 0 }) // rm dump
          .mockResolvedValueOnce({ stdout: "", stderr: "", exitCode: 0 }) // uiautomator dump for Tier 2
          .mockResolvedValueOnce({ stdout: overflowXml, stderr: "", exitCode: 0 }) // cat dump for Tier 2
          .mockResolvedValueOnce({ stdout: "", stderr: "", exitCode: 0 }); // rm dump

        // Mock pattern matching
        vi.mocked(matchIconPattern).mockReturnValue(["overflow", "more", "options"]);
        vi.mocked(matchesResourceId).mockImplementation((resourceId: string, patterns: string[]) => {
          return resourceId.toLowerCase().includes("overflow");
        });

        const result = await adapter.findWithFallbacks("emulator-5554", { text: "overflow menu" });

        expect(result.elements.length).toBe(1);
        expect(result.source).toBe("accessibility");
        expect(result.tier).toBe(2);
        expect(result.confidence).toBe("high");
        expect(matchIconPattern).toHaveBeenCalledWith("overflow menu");
      });

      it("skips Tier 2 when no pattern match found", async () => {
        // Use mockImplementation to handle any order of calls
        mockAdb.shell.mockImplementation(async (deviceId: string, cmd: string) => {
          if (cmd.includes("uiautomator dump")) {
            return { stdout: "", stderr: "", exitCode: 0 };
          }
          if (cmd.includes("cat /sdcard/ui-dump.xml")) {
            return {
              stdout: `<?xml version="1.0"?><hierarchy><node text="" bounds="[0,0][100,100]" class="View" resource-id="" /></hierarchy>`,
              stderr: "",
              exitCode: 0,
            };
          }
          if (cmd.includes("rm")) {
            return { stdout: "", stderr: "", exitCode: 0 };
          }
          if (cmd.includes("screencap")) {
            return { stdout: "", stderr: "", exitCode: 0 };
          }
          if (cmd.includes("wm size")) {
            return { stdout: "Physical size: 1080x2400\n", stderr: "", exitCode: 0 };
          }
          if (cmd.includes("wm density")) {
            return { stdout: "Physical density: 440\n", stderr: "", exitCode: 0 };
          }
          return { stdout: "", stderr: "", exitCode: 0 };
        });

        mockAdb.pull.mockResolvedValue(undefined);

        // No pattern match
        vi.mocked(matchIconPattern).mockReturnValue(null);
        vi.mocked(extractText).mockResolvedValue([]);
        vi.mocked(searchText).mockReturnValue([]);
        vi.mocked(filterIconCandidates).mockReturnValue([]);
        vi.mocked(createGridOverlay).mockResolvedValue("base64GridImage");

        const result = await adapter.findWithFallbacks("emulator-5554", { text: "random text" });

        expect(matchIconPattern).toHaveBeenCalledWith("random text");
        // Should skip to Tier 3 OCR, not Tier 2
        expect(matchesResourceId).not.toHaveBeenCalled();
      });
    });

    describe("Tier 4: Visual candidates", () => {
      it("returns visual candidates when accessibility and OCR fail", async () => {
        const mockClickableNode = {
          index: 0,
          text: "",
          resourceId: "",
          className: "android.widget.ImageButton",
          contentDesc: "",
          bounds: { left: 100, top: 100, right: 148, bottom: 148 },
          centerX: 124,
          centerY: 124,
          clickable: true,
          focusable: false,
        };

        // Mock UI dump
        mockAdb.shell
          .mockResolvedValueOnce({ stdout: "", stderr: "", exitCode: 0 }) // uiautomator dump for find()
          .mockResolvedValueOnce({
            stdout: `<?xml version="1.0"?><hierarchy><node text="" bounds="[100,100][148,148]" class="android.widget.ImageButton" resource-id="" clickable="true" content-desc="" /></hierarchy>`,
            stderr: "",
            exitCode: 0,
          }) // cat dump
          .mockResolvedValueOnce({ stdout: "", stderr: "", exitCode: 0 }) // rm dump
          .mockResolvedValueOnce({ stdout: "", stderr: "", exitCode: 0 }) // screencap
          .mockResolvedValueOnce({ stdout: "", stderr: "", exitCode: 0 }) // rm screenshot (later)
          .mockResolvedValueOnce({ stdout: "", stderr: "", exitCode: 0 }) // uiautomator dump for Tier 4
          .mockResolvedValueOnce({
            stdout: `<?xml version="1.0"?><hierarchy><node text="" bounds="[100,100][148,148]" class="android.widget.ImageButton" resource-id="" clickable="true" content-desc="" /></hierarchy>`,
            stderr: "",
            exitCode: 0,
          }) // cat dump
          .mockResolvedValueOnce({ stdout: "", stderr: "", exitCode: 0 }); // rm dump

        mockAdb.pull.mockResolvedValue(undefined);

        // No pattern match
        vi.mocked(matchIconPattern).mockReturnValue(null);
        // No OCR match
        vi.mocked(extractText).mockResolvedValue([]);
        vi.mocked(searchText).mockReturnValue([]);
        // Mock visual candidates
        vi.mocked(filterIconCandidates).mockReturnValue([mockClickableNode]);
        vi.mocked(formatBounds).mockReturnValue("[100,100][148,148]");
        vi.mocked(cropCandidateImage).mockResolvedValue("base64ImageData");

        const result = await adapter.findWithFallbacks("emulator-5554", { text: "some icon" });

        expect(result.elements).toHaveLength(0);
        expect(result.source).toBe("visual");
        expect(result.tier).toBe(4);
        expect(result.confidence).toBe("medium");
        expect(result.candidates).toBeDefined();
        expect(result.candidates!.length).toBe(1);
        expect(result.candidates![0].image).toBe("base64ImageData");
      });
    });

    describe("Tier 5: Grid fallback", () => {
      it("returns grid overlay when no visual candidates exist", async () => {
        // Use mockImplementation to handle any order of calls
        mockAdb.shell.mockImplementation(async (deviceId: string, cmd: string) => {
          if (cmd.includes("uiautomator dump")) {
            return { stdout: "", stderr: "", exitCode: 0 };
          }
          if (cmd.includes("cat /sdcard/ui-dump.xml")) {
            return {
              stdout: `<?xml version="1.0"?><hierarchy><node text="" bounds="[0,0][100,100]" class="View" resource-id="" clickable="false" /></hierarchy>`,
              stderr: "",
              exitCode: 0,
            };
          }
          if (cmd.includes("rm")) {
            return { stdout: "", stderr: "", exitCode: 0 };
          }
          if (cmd.includes("screencap")) {
            return { stdout: "", stderr: "", exitCode: 0 };
          }
          if (cmd.includes("wm size")) {
            return { stdout: "Physical size: 1080x2400\n", stderr: "", exitCode: 0 };
          }
          if (cmd.includes("wm density")) {
            return { stdout: "Physical density: 440\n", stderr: "", exitCode: 0 };
          }
          return { stdout: "", stderr: "", exitCode: 0 };
        });

        mockAdb.pull.mockResolvedValue(undefined);

        // No pattern match
        vi.mocked(matchIconPattern).mockReturnValue(null);
        // No OCR match
        vi.mocked(extractText).mockResolvedValue([]);
        vi.mocked(searchText).mockReturnValue([]);
        // No visual candidates
        vi.mocked(filterIconCandidates).mockReturnValue([]);
        // Mock grid overlay
        vi.mocked(createGridOverlay).mockResolvedValue("base64GridImage");

        const result = await adapter.findWithFallbacks("emulator-5554", { text: "invisible element" });

        expect(result.elements).toHaveLength(0);
        expect(result.source).toBe("grid");
        expect(result.tier).toBe(5);
        expect(result.confidence).toBe("low");
        expect(result.gridImage).toBe("base64GridImage");
        expect(result.gridPositions).toEqual(["Top-left", "Top-right", "Center", "Bottom-left", "Bottom-right"]);
      });

      it("handles grid refinement when gridCell and gridPosition provided (no scaling)", async () => {
        // Mock screen metadata - used when no scaling state exists
        mockAdb.shell
          .mockResolvedValueOnce({ stdout: "Physical size: 1080x2400\n", stderr: "", exitCode: 0 })
          .mockResolvedValueOnce({ stdout: "Physical density: 440\n", stderr: "", exitCode: 0 });

        // Mock grid calculations
        vi.mocked(calculateGridCellBounds).mockReturnValue({ x0: 0, y0: 0, x1: 270, y1: 400 });
        vi.mocked(calculatePositionCoordinates).mockReturnValue({ x: 135, y: 200 });

        const result = await adapter.findWithFallbacks(
          "emulator-5554",
          { text: "any" },
          { gridCell: 1, gridPosition: 3 }
        );

        expect(result.elements.length).toBe(1);
        expect(result.source).toBe("grid");
        expect(result.tier).toBe(5);
        expect(result.confidence).toBe("low");
        expect((result.elements[0] as any).center).toEqual({ x: 135, y: 200 });
        // Without scaling, uses device dimensions
        expect(calculateGridCellBounds).toHaveBeenCalledWith(1, 1080, 2400);
        expect(calculatePositionCoordinates).toHaveBeenCalledWith(3, { x0: 0, y0: 0, x1: 270, y1: 400 });
      });

      it("uses image dimensions for grid refinement when scaling is active", async () => {
        // First take a screenshot to set scaling state
        vi.mocked(sharp).mockImplementation(() => ({
          metadata: vi.fn().mockResolvedValue({ width: 1080, height: 2400 }),
          resize: vi.fn().mockReturnThis(),
          toFile: vi.fn().mockResolvedValue(undefined),
        } as any));

        mockAdb.shell.mockResolvedValue({ stdout: "", stderr: "", exitCode: 0 });
        mockAdb.pull.mockResolvedValue(undefined);

        // Take screenshot to establish scaling state (scaleFactor 2.4, image 450x1000)
        await adapter.screenshot("emulator-5554", { maxDimension: 1000 });

        // Clear mocks for the findWithFallbacks call
        vi.mocked(calculateGridCellBounds).mockClear();
        vi.mocked(calculatePositionCoordinates).mockClear();

        // Mock grid calculations for image-space dimensions
        vi.mocked(calculateGridCellBounds).mockReturnValue({ x0: 0, y0: 0, x1: 112, y1: 167 });
        vi.mocked(calculatePositionCoordinates).mockReturnValue({ x: 56, y: 83 });

        const result = await adapter.findWithFallbacks(
          "emulator-5554",
          { text: "any" },
          { gridCell: 1, gridPosition: 3 }
        );

        expect(result.elements.length).toBe(1);
        expect(result.source).toBe("grid");
        expect(result.tier).toBe(5);
        // With scaling active, should use IMAGE dimensions (450x1000), not device (1080x2400)
        expect(calculateGridCellBounds).toHaveBeenCalledWith(1, 450, 1000);
        // Coordinates should be in image space
        expect((result.elements[0] as any).center).toEqual({ x: 56, y: 83 });
      });
    });

    describe("Tier 1: Accessibility text match (backward compatibility)", () => {
      it("returns accessibility results with tier info", async () => {
        mockAdb.shell
          .mockResolvedValueOnce({ stdout: "", stderr: "", exitCode: 0 }) // uiautomator dump
          .mockResolvedValueOnce({
            stdout: `<?xml version="1.0"?><hierarchy><node text="Login" bounds="[100,200][300,250]" class="android.widget.Button" clickable="true" /></hierarchy>`,
            stderr: "",
            exitCode: 0,
          }) // cat dump
          .mockResolvedValueOnce({ stdout: "", stderr: "", exitCode: 0 }); // rm dump

        const result = await adapter.findWithFallbacks("emulator-5554", { text: "Login" });

        expect(result.elements).toHaveLength(1);
        expect(result.source).toBe("accessibility");
        expect(result.tier).toBe(1);
        expect(result.confidence).toBe("high");
      });
    });

    describe("Backward compatibility", () => {
      it("findWithOcrFallback still works as alias", async () => {
        mockAdb.shell
          .mockResolvedValueOnce({ stdout: "", stderr: "", exitCode: 0 }) // uiautomator dump
          .mockResolvedValueOnce({
            stdout: `<?xml version="1.0"?><hierarchy><node text="Submit" bounds="[100,200][300,250]" class="android.widget.Button" clickable="true" /></hierarchy>`,
            stderr: "",
            exitCode: 0,
          }) // cat dump
          .mockResolvedValueOnce({ stdout: "", stderr: "", exitCode: 0 }); // rm dump

        const result = await adapter.findWithOcrFallback("emulator-5554", { text: "Submit" });

        expect(result.elements).toHaveLength(1);
        expect(result.source).toBe("accessibility");
        // Should have new tier info even when using old method name
        expect(result.tier).toBe(1);
      });
    });
  });

  describe("tap with scaling", () => {
    it("converts image coordinates to device coordinates", async () => {
      // Set up scaling state via screenshot
      vi.mocked(sharp).mockImplementation(() => ({
        metadata: vi.fn().mockResolvedValue({ width: 1080, height: 2400 }),
        resize: vi.fn().mockReturnThis(),
        toFile: vi.fn().mockResolvedValue(undefined),
      } as any));

      mockAdb.shell.mockResolvedValue({ stdout: "", stderr: "", exitCode: 0 });
      mockAdb.pull.mockResolvedValue(undefined);

      await adapter.screenshot("emulator-5554", { maxDimension: 1000 });

      // Clear mock to check tap call
      mockAdb.shell.mockClear();
      mockAdb.shell.mockResolvedValue({ stdout: "", stderr: "", exitCode: 0 });

      // Tap at image coordinates (200, 500)
      await adapter.tap("emulator-5554", 200, 500);

      // Should convert to device coordinates (480, 1200) with scaleFactor 2.4
      expect(mockAdb.shell).toHaveBeenCalledWith("emulator-5554", "input tap 480 1200");
    });

    it("does not convert when no scaling state", async () => {
      mockAdb.shell.mockResolvedValue({ stdout: "", stderr: "", exitCode: 0 });

      await adapter.tap("emulator-5554", 200, 500);

      expect(mockAdb.shell).toHaveBeenCalledWith("emulator-5554", "input tap 200 500");
    });
  });
});
