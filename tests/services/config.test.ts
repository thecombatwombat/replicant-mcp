import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { loadConfig, ConfigManager } from "../../src/services/config.js";
import { DEFAULT_CONFIG } from "../../src/types/config.js";
import * as fs from "fs/promises";
import { existsSync } from "fs";

vi.mock("fs/promises");
vi.mock("fs", () => ({
  existsSync: vi.fn(),
}));

describe("Config Loading", () => {
  const originalEnv = process.env.REPLICANT_CONFIG;

  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.REPLICANT_CONFIG;
  });

  afterEach(() => {
    if (originalEnv) {
      process.env.REPLICANT_CONFIG = originalEnv;
    } else {
      delete process.env.REPLICANT_CONFIG;
    }
  });

  describe("loadConfig", () => {
    it("returns defaults when REPLICANT_CONFIG is not set", async () => {
      const config = await loadConfig();
      expect(config).toEqual(DEFAULT_CONFIG);
    });

    it("returns defaults when config file does not exist", async () => {
      process.env.REPLICANT_CONFIG = "/nonexistent/config.yaml";
      vi.mocked(existsSync).mockReturnValue(false);

      const config = await loadConfig();
      expect(config).toEqual(DEFAULT_CONFIG);
    });

    it("loads and merges config from YAML file", async () => {
      process.env.REPLICANT_CONFIG = "/path/to/config.yaml";
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(fs.readFile).mockResolvedValue(`
ui:
  visualModePackages:
    - com.problematic.app
  autoFallbackScreenshot: false
`);

      const config = await loadConfig();

      expect(config.ui.visualModePackages).toEqual(["com.problematic.app"]);
      expect(config.ui.autoFallbackScreenshot).toBe(false);
      expect(config.ui.includeBase64).toBe(false); // default preserved
    });

    it("handles partial config (merges with defaults)", async () => {
      process.env.REPLICANT_CONFIG = "/path/to/config.yaml";
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(fs.readFile).mockResolvedValue(`
ui:
  includeBase64: true
`);

      const config = await loadConfig();

      expect(config.ui.visualModePackages).toEqual([]); // default
      expect(config.ui.autoFallbackScreenshot).toBe(true); // default
      expect(config.ui.includeBase64).toBe(true); // overridden
    });

    it("handles empty config file", async () => {
      process.env.REPLICANT_CONFIG = "/path/to/config.yaml";
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(fs.readFile).mockResolvedValue("");

      const config = await loadConfig();
      expect(config).toEqual(DEFAULT_CONFIG);
    });

    it("handles malformed YAML gracefully", async () => {
      process.env.REPLICANT_CONFIG = "/path/to/config.yaml";
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(fs.readFile).mockResolvedValue("invalid: yaml: content: [");

      const config = await loadConfig();
      expect(config).toEqual(DEFAULT_CONFIG);
    });
  });

  describe("ConfigManager", () => {
    it("returns defaults before load is called", () => {
      const manager = new ConfigManager();
      expect(manager.get()).toEqual(DEFAULT_CONFIG);
    });

    it("loads config asynchronously", async () => {
      process.env.REPLICANT_CONFIG = "/path/to/config.yaml";
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(fs.readFile).mockResolvedValue(`
ui:
  visualModePackages:
    - com.test.app
`);

      const manager = new ConfigManager();
      await manager.load();

      expect(manager.getUiConfig().visualModePackages).toEqual(["com.test.app"]);
    });

    it("isVisualModePackage checks visualModePackages list", async () => {
      process.env.REPLICANT_CONFIG = "/path/to/config.yaml";
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(fs.readFile).mockResolvedValue(`
ui:
  visualModePackages:
    - com.visual.app
    - com.another.visual
`);

      const manager = new ConfigManager();
      await manager.load();

      expect(manager.isVisualModePackage("com.visual.app")).toBe(true);
      expect(manager.isVisualModePackage("com.another.visual")).toBe(true);
      expect(manager.isVisualModePackage("com.normal.app")).toBe(false);
    });
  });
});
