import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtempSync, rmSync, readFileSync, existsSync } from "fs";
import { tmpdir } from "os";
import path from "path";
import {
  saveBaseline,
  loadBaseline,
  clearBaseline,
  compareResults,
  TestBaseline,
  BaselineTestResult,
} from "../../src/services/test-baseline.js";

describe("TestBaseline", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(path.join(tmpdir(), "baseline-test-"));
    vi.spyOn(process, "cwd").mockReturnValue(tempDir);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    rmSync(tempDir, { recursive: true, force: true });
  });

  describe("saveBaseline and loadBaseline", () => {
    it("roundtrips save and load", () => {
      const results: BaselineTestResult[] = [
        { test: "com.example.LoginTest.testSuccess", status: "pass" },
        { test: "com.example.LoginTest.testFailure", status: "fail" },
      ];

      saveBaseline("my-task", results);
      const loaded = loadBaseline("my-task");

      expect(loaded).not.toBeNull();
      expect(loaded!.task).toBe("my-task");
      expect(loaded!.results).toEqual(results);
      expect(loaded!.savedAt).toBeTruthy();
    });

    it("sanitizes task name for filesystem", () => {
      const results: BaselineTestResult[] = [
        { test: "com.example.Test.method", status: "pass" },
      ];

      saveBaseline("task/with:special chars!", results);
      const loaded = loadBaseline("task/with:special chars!");

      expect(loaded).not.toBeNull();
      expect(loaded!.task).toBe("task/with:special chars!");

      // Verify the file was created with sanitized name
      const baselineDir = path.join(tempDir, ".replicant", "test-baselines");
      const sanitizedFile = path.join(baselineDir, "task_with_special_chars_.json");
      expect(existsSync(sanitizedFile)).toBe(true);
    });

    it("stores baseline as valid JSON", () => {
      const results: BaselineTestResult[] = [
        { test: "com.example.Test.method", status: "pass" },
      ];

      saveBaseline("json-check", results);

      const baselineDir = path.join(tempDir, ".replicant", "test-baselines");
      const filePath = path.join(baselineDir, "json-check.json");
      const raw = readFileSync(filePath, "utf-8");
      const parsed = JSON.parse(raw);

      expect(parsed.task).toBe("json-check");
      expect(parsed.results).toHaveLength(1);
    });
  });

  describe("loadBaseline", () => {
    it("returns null when no baseline exists", () => {
      const result = loadBaseline("nonexistent-task");
      expect(result).toBeNull();
    });
  });

  describe("clearBaseline", () => {
    it("removes the baseline file", () => {
      const results: BaselineTestResult[] = [
        { test: "com.example.Test.method", status: "pass" },
      ];

      saveBaseline("to-clear", results);
      expect(loadBaseline("to-clear")).not.toBeNull();

      clearBaseline("to-clear");
      expect(loadBaseline("to-clear")).toBeNull();
    });

    it("does not throw when baseline does not exist", () => {
      expect(() => clearBaseline("nonexistent")).not.toThrow();
    });
  });

  describe("compareResults", () => {
    it("detects regressions (pass to fail)", () => {
      const baseline: TestBaseline = {
        savedAt: "2025-01-01T00:00:00Z",
        task: "test",
        results: [
          { test: "com.example.Test.a", status: "pass" },
          { test: "com.example.Test.b", status: "pass" },
        ],
      };

      const current: BaselineTestResult[] = [
        { test: "com.example.Test.a", status: "pass" },
        { test: "com.example.Test.b", status: "fail" },
      ];

      const regressions = compareResults(baseline, current);

      expect(regressions).toHaveLength(1);
      expect(regressions[0]).toEqual({
        test: "com.example.Test.b",
        previousStatus: "pass",
        currentStatus: "fail",
      });
    });

    it("detects regressions (pass to skip)", () => {
      const baseline: TestBaseline = {
        savedAt: "2025-01-01T00:00:00Z",
        task: "test",
        results: [
          { test: "com.example.Test.a", status: "pass" },
        ],
      };

      const current: BaselineTestResult[] = [
        { test: "com.example.Test.a", status: "skip" },
      ];

      const regressions = compareResults(baseline, current);

      expect(regressions).toHaveLength(1);
      expect(regressions[0].currentStatus).toBe("skip");
    });

    it("ignores improvements (fail to pass)", () => {
      const baseline: TestBaseline = {
        savedAt: "2025-01-01T00:00:00Z",
        task: "test",
        results: [
          { test: "com.example.Test.a", status: "fail" },
        ],
      };

      const current: BaselineTestResult[] = [
        { test: "com.example.Test.a", status: "pass" },
      ];

      const regressions = compareResults(baseline, current);
      expect(regressions).toHaveLength(0);
    });

    it("handles new tests not in baseline", () => {
      const baseline: TestBaseline = {
        savedAt: "2025-01-01T00:00:00Z",
        task: "test",
        results: [
          { test: "com.example.Test.a", status: "pass" },
        ],
      };

      const current: BaselineTestResult[] = [
        { test: "com.example.Test.a", status: "pass" },
        { test: "com.example.Test.newTest", status: "fail" },
      ];

      const regressions = compareResults(baseline, current);
      expect(regressions).toHaveLength(0);
    });

    it("handles removed tests (in baseline but not in current)", () => {
      const baseline: TestBaseline = {
        savedAt: "2025-01-01T00:00:00Z",
        task: "test",
        results: [
          { test: "com.example.Test.a", status: "pass" },
          { test: "com.example.Test.removed", status: "pass" },
        ],
      };

      const current: BaselineTestResult[] = [
        { test: "com.example.Test.a", status: "pass" },
      ];

      // Removed tests should not count as regressions
      // (they're not in current, so currentMap.get returns undefined)
      const regressions = compareResults(baseline, current);
      expect(regressions).toHaveLength(0);
    });

    it("returns empty array when baseline has no passing tests", () => {
      const baseline: TestBaseline = {
        savedAt: "2025-01-01T00:00:00Z",
        task: "test",
        results: [
          { test: "com.example.Test.a", status: "fail" },
          { test: "com.example.Test.b", status: "skip" },
        ],
      };

      const current: BaselineTestResult[] = [
        { test: "com.example.Test.a", status: "fail" },
        { test: "com.example.Test.b", status: "fail" },
      ];

      const regressions = compareResults(baseline, current);
      expect(regressions).toHaveLength(0);
    });

    it("detects multiple regressions", () => {
      const baseline: TestBaseline = {
        savedAt: "2025-01-01T00:00:00Z",
        task: "test",
        results: [
          { test: "com.example.Test.a", status: "pass" },
          { test: "com.example.Test.b", status: "pass" },
          { test: "com.example.Test.c", status: "pass" },
        ],
      };

      const current: BaselineTestResult[] = [
        { test: "com.example.Test.a", status: "fail" },
        { test: "com.example.Test.b", status: "fail" },
        { test: "com.example.Test.c", status: "pass" },
      ];

      const regressions = compareResults(baseline, current);
      expect(regressions).toHaveLength(2);
    });
  });
});
