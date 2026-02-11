import { describe, it, expect } from "vitest";
import { VERSION } from "../src/version.js";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const pkg = require("../package.json") as { version: string };

describe("Version", () => {
  it("should export a version string", () => {
    expect(typeof VERSION).toBe("string");
    expect(VERSION.length).toBeGreaterThan(0);
  });

  it("should match package.json version", () => {
    expect(VERSION).toBe(pkg.version);
  });

  it("should be valid semver", () => {
    expect(VERSION).toMatch(/^\d+\.\d+\.\d+/);
  });
});
