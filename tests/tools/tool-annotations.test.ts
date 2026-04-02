import { describe, it, expect } from "vitest";
import {
  cacheToolDefinition,
  rtfmToolDefinition,
  adbDeviceToolDefinition,
  adbAppToolDefinition,
  adbLogcatToolDefinition,
  adbShellToolDefinition,
  emulatorDeviceToolDefinition,
  gradleBuildToolDefinition,
  gradleTestToolDefinition,
  gradleListToolDefinition,
  gradleGetDetailsToolDefinition,
  uiQueryToolDefinition,
  uiActionToolDefinition,
  uiCaptureToolDefinition,
} from "../../src/tools/index.js";

const ANNOTATION_KEYS = [
  "readOnlyHint",
  "destructiveHint",
  "idempotentHint",
  "openWorldHint",
] as const;

const allToolDefinitions = [
  cacheToolDefinition,
  rtfmToolDefinition,
  adbDeviceToolDefinition,
  adbAppToolDefinition,
  adbLogcatToolDefinition,
  adbShellToolDefinition,
  emulatorDeviceToolDefinition,
  gradleBuildToolDefinition,
  gradleTestToolDefinition,
  gradleListToolDefinition,
  gradleGetDetailsToolDefinition,
  uiQueryToolDefinition,
  uiActionToolDefinition,
  uiCaptureToolDefinition,
];

describe("Tool annotations", () => {
  it.each(allToolDefinitions)(
    "$name has an annotations object",
    (tool) => {
      expect(tool).toHaveProperty("annotations");
      expect(typeof (tool as Record<string, unknown>).annotations).toBe("object");
      expect((tool as Record<string, unknown>).annotations).not.toBeNull();
    },
  );

  it.each(allToolDefinitions)(
    "$name has all four annotation boolean fields",
    (tool) => {
      const annotations = (tool as Record<string, unknown>).annotations as Record<string, unknown>;
      for (const key of ANNOTATION_KEYS) {
        expect(annotations).toHaveProperty(key);
        expect(typeof annotations[key]).toBe("boolean");
      }
    },
  );

  describe("read-only tools", () => {
    const readOnlyTools = [
      rtfmToolDefinition,
      adbLogcatToolDefinition,
      gradleListToolDefinition,
      gradleGetDetailsToolDefinition,
      uiQueryToolDefinition,
      uiCaptureToolDefinition,
    ];

    it.each(readOnlyTools)(
      "$name has readOnlyHint: true and destructiveHint: false",
      (tool) => {
        const annotations = (tool as Record<string, unknown>).annotations as Record<string, boolean>;
        expect(annotations.readOnlyHint).toBe(true);
        expect(annotations.destructiveHint).toBe(false);
      },
    );
  });

  describe("destructive tools", () => {
    const destructiveTools = [
      uiActionToolDefinition,
      adbShellToolDefinition,
      adbAppToolDefinition,
      cacheToolDefinition,
      emulatorDeviceToolDefinition,
      gradleTestToolDefinition,
    ];

    it.each(destructiveTools)(
      "$name has destructiveHint: true and readOnlyHint: false",
      (tool) => {
        const annotations = (tool as Record<string, unknown>).annotations as Record<string, boolean>;
        expect(annotations.destructiveHint).toBe(true);
        expect(annotations.readOnlyHint).toBe(false);
      },
    );
  });

  describe("non-destructive stateful tools", () => {
    const statefulNonDestructive = [
      adbDeviceToolDefinition,
      gradleBuildToolDefinition,
    ];

    it.each(statefulNonDestructive)(
      "$name has readOnlyHint: false and destructiveHint: false",
      (tool) => {
        const annotations = (tool as Record<string, unknown>).annotations as Record<string, boolean>;
        expect(annotations.readOnlyHint).toBe(false);
        expect(annotations.destructiveHint).toBe(false);
      },
    );
  });

  describe("open-world tools", () => {
    it("adb-shell has openWorldHint: true", () => {
      const annotations = (adbShellToolDefinition as Record<string, unknown>).annotations as Record<string, boolean>;
      expect(annotations.openWorldHint).toBe(true);
    });
  });
});
