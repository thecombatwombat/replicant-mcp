import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { getDefaultScreenshotPath } from "../../src/utils/paths.js";

describe("getDefaultScreenshotPath", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "replicant-test-"));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("creates screenshot path in provided base directory", () => {
    const result = getDefaultScreenshotPath(tempDir);

    expect(result).toContain(path.join(tempDir, ".replicant", "screenshots"));
    expect(result).toMatch(/screenshot-\d+-[a-z0-9]+\.png$/);
    expect(fs.existsSync(path.dirname(result))).toBe(true);
  });

  it("creates nested directories if they do not exist", () => {
    const nestedBase = path.join(tempDir, "deep", "nested");

    const result = getDefaultScreenshotPath(nestedBase);

    expect(fs.existsSync(path.dirname(result))).toBe(true);
  });

  it("generates unique filenames with timestamps", () => {
    const result1 = getDefaultScreenshotPath(tempDir);
    const result2 = getDefaultScreenshotPath(tempDir);

    expect(result1).not.toBe(result2);
  });

  it("falls back to homedir when cwd is root (sandbox environment)", () => {
    // In sandbox environments like Claude Desktop, process.cwd() returns "/"
    // which isn't writable, so the function should fall back to os.homedir()
    const cwdSpy = vi.spyOn(process, "cwd").mockReturnValue("/");
    const actualHomedir = os.homedir();

    // Call without baseDir to trigger the fallback logic
    const result = getDefaultScreenshotPath();

    // Should use homedir instead of "/" when cwd is root
    // The path should start with the actual home directory, not "/"
    expect(result.startsWith("/.replicant")).toBe(false);
    expect(result.startsWith(actualHomedir)).toBe(true);
    expect(result).toContain(path.join(".replicant", "screenshots"));
    expect(result).toMatch(/screenshot-\d+-[a-z0-9]+\.png$/);

    cwdSpy.mockRestore();
  });
});
