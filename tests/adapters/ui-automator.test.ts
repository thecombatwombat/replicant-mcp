import { describe, it, expect, vi, beforeEach } from "vitest";
import { parseUiDump } from "../../src/parsers/ui-dump.js";
import { UiAutomatorAdapter } from "../../src/adapters/ui-automator.js";

// Mock OCR service
vi.mock("../../src/services/ocr.js", () => ({
  extractText: vi.fn(),
  searchText: vi.fn(),
  terminateOcr: vi.fn(),
}));

import { extractText, searchText } from "../../src/services/ocr.js";

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
      expect(result.path).toMatch(/^\/tmp\/replicant-screenshot-\d+\.png$/);
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

      vi.mocked(extractText).mockResolvedValue([
        { text: "Test", confidence: 0.85, bounds: { x0: 0, y0: 0, x1: 50, y1: 25 } },
      ]);
      vi.mocked(searchText).mockReturnValue([
        { index: 0, text: "Test", bounds: "[0,0][50,25]", center: { x: 25, y: 12 }, confidence: 0.85 },
      ]);

      const result = await adapter.findWithOcrFallback("emulator-5554", { text: "test" }, { debug: true });

      expect(result.source).toBe("ocr");
      expect(result.fallbackReason).toBe("accessibility tree had no matching text");
    });

    it("returns empty results when both accessibility and OCR find nothing", async () => {
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
        { text: "Something Else", confidence: 0.90, bounds: { x0: 0, y0: 0, x1: 100, y1: 50 } },
      ]);
      vi.mocked(searchText).mockReturnValue([]);

      const result = await adapter.findWithOcrFallback("emulator-5554", { text: "NotFound" });

      expect(result.elements).toHaveLength(0);
      expect(result.source).toBe("ocr");
    });
  });
});
