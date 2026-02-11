import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

describe("logger", () => {
  let originalLogLevel: string | undefined;
  let originalLogFormat: string | undefined;

  beforeEach(() => {
    originalLogLevel = process.env.REPLICANT_LOG_LEVEL;
    originalLogFormat = process.env.REPLICANT_LOG_FORMAT;
  });

  afterEach(() => {
    // Restore env vars
    if (originalLogLevel === undefined) {
      delete process.env.REPLICANT_LOG_LEVEL;
    } else {
      process.env.REPLICANT_LOG_LEVEL = originalLogLevel;
    }
    if (originalLogFormat === undefined) {
      delete process.env.REPLICANT_LOG_FORMAT;
    } else {
      process.env.REPLICANT_LOG_FORMAT = originalLogFormat;
    }
  });

  describe("default level (warn)", () => {
    it("filters out info messages", async () => {
      delete process.env.REPLICANT_LOG_LEVEL;
      delete process.env.REPLICANT_LOG_FORMAT;
      vi.resetModules();
      const { logger } = await import("../../src/utils/logger.js");
      const spy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);

      logger.info("should not appear");

      expect(spy).not.toHaveBeenCalled();
      spy.mockRestore();
    });

    it("filters out debug messages", async () => {
      delete process.env.REPLICANT_LOG_LEVEL;
      delete process.env.REPLICANT_LOG_FORMAT;
      vi.resetModules();
      const { logger } = await import("../../src/utils/logger.js");
      const spy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);

      logger.debug("should not appear");

      expect(spy).not.toHaveBeenCalled();
      spy.mockRestore();
    });

    it("allows error messages", async () => {
      delete process.env.REPLICANT_LOG_LEVEL;
      delete process.env.REPLICANT_LOG_FORMAT;
      vi.resetModules();
      const { logger } = await import("../../src/utils/logger.js");
      const spy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);

      logger.error("error message");

      expect(spy).toHaveBeenCalledOnce();
      spy.mockRestore();
    });

    it("allows warn messages", async () => {
      delete process.env.REPLICANT_LOG_LEVEL;
      delete process.env.REPLICANT_LOG_FORMAT;
      vi.resetModules();
      const { logger } = await import("../../src/utils/logger.js");
      const spy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);

      logger.warn("warn message");

      expect(spy).toHaveBeenCalledOnce();
      spy.mockRestore();
    });
  });

  describe("REPLICANT_LOG_LEVEL=debug", () => {
    it("enables all log levels", async () => {
      process.env.REPLICANT_LOG_LEVEL = "debug";
      delete process.env.REPLICANT_LOG_FORMAT;
      vi.resetModules();
      const { logger } = await import("../../src/utils/logger.js");
      const spy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);

      logger.error("e");
      logger.warn("w");
      logger.info("i");
      logger.debug("d");

      expect(spy).toHaveBeenCalledTimes(4);
      spy.mockRestore();
    });
  });

  describe("text format (default)", () => {
    it("outputs [LEVEL] message format", async () => {
      delete process.env.REPLICANT_LOG_LEVEL;
      delete process.env.REPLICANT_LOG_FORMAT;
      vi.resetModules();
      const { logger } = await import("../../src/utils/logger.js");
      const spy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);

      logger.error("something went wrong");

      expect(spy).toHaveBeenCalledWith("[ERROR] something went wrong\n");
      spy.mockRestore();
    });

    it("includes context in text format", async () => {
      delete process.env.REPLICANT_LOG_LEVEL;
      delete process.env.REPLICANT_LOG_FORMAT;
      vi.resetModules();
      const { logger } = await import("../../src/utils/logger.js");
      const spy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);

      logger.error("failed", { path: "/tmp/x" });

      expect(spy).toHaveBeenCalledWith('[ERROR] failed {"path":"/tmp/x"}\n');
      spy.mockRestore();
    });

    it("outputs warn level correctly", async () => {
      delete process.env.REPLICANT_LOG_LEVEL;
      delete process.env.REPLICANT_LOG_FORMAT;
      vi.resetModules();
      const { logger } = await import("../../src/utils/logger.js");
      const spy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);

      logger.warn("a warning");

      expect(spy).toHaveBeenCalledWith("[WARN] a warning\n");
      spy.mockRestore();
    });
  });

  describe("invalid log level", () => {
    it("falls back to warn for unknown level", async () => {
      process.env.REPLICANT_LOG_LEVEL = "verbose";
      delete process.env.REPLICANT_LOG_FORMAT;
      vi.resetModules();
      const { logger } = await import("../../src/utils/logger.js");
      const spy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);

      logger.info("should be filtered");
      expect(spy).not.toHaveBeenCalled();

      logger.warn("should appear");
      expect(spy).toHaveBeenCalledOnce();
      spy.mockRestore();
    });
  });

  describe("REPLICANT_LOG_FORMAT=json", () => {
    it("outputs valid JSON to stderr", async () => {
      process.env.REPLICANT_LOG_LEVEL = "debug";
      process.env.REPLICANT_LOG_FORMAT = "json";
      vi.resetModules();
      const { logger } = await import("../../src/utils/logger.js");
      const spy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);

      logger.info("test message");

      expect(spy).toHaveBeenCalledOnce();
      const output = spy.mock.calls[0][0] as string;
      const parsed = JSON.parse(output);
      expect(parsed.level).toBe("info");
      expect(parsed.msg).toBe("test message");
      expect(parsed.ts).toBeDefined();
      spy.mockRestore();
    });

    it("includes context object in JSON output", async () => {
      process.env.REPLICANT_LOG_LEVEL = "debug";
      process.env.REPLICANT_LOG_FORMAT = "json";
      vi.resetModules();
      const { logger } = await import("../../src/utils/logger.js");
      const spy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);

      logger.warn("config issue", { path: "/tmp/config.yml", code: 42 });

      expect(spy).toHaveBeenCalledOnce();
      const output = spy.mock.calls[0][0] as string;
      const parsed = JSON.parse(output);
      expect(parsed.level).toBe("warn");
      expect(parsed.msg).toBe("config issue");
      expect(parsed.path).toBe("/tmp/config.yml");
      expect(parsed.code).toBe(42);
      spy.mockRestore();
    });

    it("includes ISO timestamp", async () => {
      process.env.REPLICANT_LOG_LEVEL = "debug";
      process.env.REPLICANT_LOG_FORMAT = "json";
      vi.resetModules();
      const { logger } = await import("../../src/utils/logger.js");
      const spy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);

      logger.error("ts check");

      const output = spy.mock.calls[0][0] as string;
      const parsed = JSON.parse(output);
      // ISO 8601 format check
      expect(new Date(parsed.ts).toISOString()).toBe(parsed.ts);
      spy.mockRestore();
    });
  });

  describe("stdout isolation", () => {
    it("does not write to stdout", async () => {
      process.env.REPLICANT_LOG_LEVEL = "debug";
      delete process.env.REPLICANT_LOG_FORMAT;
      vi.resetModules();
      const { logger } = await import("../../src/utils/logger.js");
      const stdoutSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
      const stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);

      logger.error("e");
      logger.warn("w");
      logger.info("i");
      logger.debug("d");

      expect(stdoutSpy).not.toHaveBeenCalled();
      expect(stderrSpy).toHaveBeenCalledTimes(4);
      stdoutSpy.mockRestore();
      stderrSpy.mockRestore();
    });
  });
});
