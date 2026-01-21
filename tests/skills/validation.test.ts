import { describe, it, expect } from "vitest";
import { existsSync, readFileSync, statSync } from "fs";
import { join } from "path";

const SKILL_DIR = join(import.meta.dirname, "../../skills/replicant-dev");

// Expected scripts grouped by category
const EXPECTED_SCRIPTS = {
  gradle: ["build-apk.sh", "run-tests.sh", "list-modules.sh", "build-details.sh"],
  adb: [
    "list-devices.sh",
    "select-device.sh",
    "install-app.sh",
    "launch-app.sh",
    "stop-app.sh",
    "uninstall-app.sh",
    "clear-data.sh",
    "read-logs.sh",
    "shell-cmd.sh",
  ],
  emulator: ["list-emulators.sh", "start-emulator.sh", "stop-emulator.sh", "snapshot.sh"],
  ui: ["dump-ui.sh", "find-element.sh", "tap-element.sh", "input-text.sh", "screenshot.sh"],
  cache: ["cache-stats.sh"],
};

// Flatten all scripts for validation
const ALL_SCRIPTS = Object.values(EXPECTED_SCRIPTS).flat();

describe("Skill Validation", () => {
  describe("SKILL.md", () => {
    it("exists in skill directory", () => {
      const skillMdPath = join(SKILL_DIR, "SKILL.md");
      expect(existsSync(skillMdPath)).toBe(true);
    });
  });

  describe("Script Existence", () => {
    it.each(ALL_SCRIPTS)("%s exists", (script) => {
      const scriptPath = join(SKILL_DIR, script);
      expect(existsSync(scriptPath)).toBe(true);
    });

    it("has exactly 23 scripts", () => {
      expect(ALL_SCRIPTS).toHaveLength(23);
    });
  });

  describe("Script Permissions", () => {
    it.each(ALL_SCRIPTS)("%s is executable", (script) => {
      const scriptPath = join(SKILL_DIR, script);
      const stats = statSync(scriptPath);
      // Check if user execute bit is set (0o100)
      const isExecutable = (stats.mode & 0o100) !== 0;
      expect(isExecutable).toBe(true);
    });
  });

  describe("Script Format", () => {
    it.each(ALL_SCRIPTS)("%s has proper shebang (#!/bin/bash)", (script) => {
      const scriptPath = join(SKILL_DIR, script);
      const content = readFileSync(scriptPath, "utf-8");
      const firstLine = content.split("\n")[0];
      expect(firstLine).toBe("#!/bin/bash");
    });

    it.each(ALL_SCRIPTS)("%s has set -e for error handling", (script) => {
      const scriptPath = join(SKILL_DIR, script);
      const content = readFileSync(scriptPath, "utf-8");
      // set -e should be on its own line (not in a comment)
      const lines = content.split("\n");
      const hasSetE = lines.some((line) => {
        const trimmed = line.trim();
        return trimmed === "set -e" || trimmed.startsWith("set -e ");
      });
      expect(hasSetE).toBe(true);
    });
  });

  describe("Script Categories", () => {
    it("has 4 gradle scripts", () => {
      expect(EXPECTED_SCRIPTS.gradle).toHaveLength(4);
    });

    it("has 9 adb scripts", () => {
      expect(EXPECTED_SCRIPTS.adb).toHaveLength(9);
    });

    it("has 4 emulator scripts", () => {
      expect(EXPECTED_SCRIPTS.emulator).toHaveLength(4);
    });

    it("has 5 ui scripts", () => {
      expect(EXPECTED_SCRIPTS.ui).toHaveLength(5);
    });

    it("has 1 cache script", () => {
      expect(EXPECTED_SCRIPTS.cache).toHaveLength(1);
    });
  });
});
