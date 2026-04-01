/**
 * Behavioral tests for Phase 4 marketplace verification evidence.
 *
 * These tests validate that the Phase 2 and Phase 3 SUMMARY documents
 * contain the required submission confirmation strings for VER-05 (MCPB)
 * and VER-07 (Cursor). They are pure local file reads — no network needed.
 *
 * Requirements covered: VER-05, VER-07
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "../..");

function readPlanningFile(relPath: string): string {
  return readFileSync(resolve(root, relPath), "utf8");
}

// VER-05: Phase 2 SUMMARY confirms MCPB Desktop Extensions form was submitted
describe("VER-05: Phase 2 SUMMARY — MCPB Desktop Extensions form submission is evidenced", () => {
  it("Phase 2 02-01-SUMMARY.md exists and is readable", () => {
    expect(() =>
      readPlanningFile(
        ".planning/phases/02-form-submissions/02-01-SUMMARY.md"
      )
    ).not.toThrow();
  });

  it("Phase 2 SUMMARY contains evidence that the MCPB form was submitted", () => {
    const summary = readPlanningFile(
      ".planning/phases/02-form-submissions/02-01-SUMMARY.md"
    );
    // Pattern from 04-01-PLAN.md key_links: "MCPB.*submitted"
    expect(summary).toMatch(/MCPB.*submitted/i);
  });

  it("Phase 2 SUMMARY contains the exact MCPB form submission confirmation line", () => {
    const summary = readPlanningFile(
      ".planning/phases/02-form-submissions/02-01-SUMMARY.md"
    );
    expect(summary).toContain(
      "User submitted MCPB Desktop Extensions form with bundle upload"
    );
  });
});

// VER-07: Phase 3 SUMMARY confirms Cursor marketplace submission was completed
describe("VER-07: Phase 3 SUMMARY — Cursor marketplace submission is evidenced", () => {
  it("Phase 3 03-02-SUMMARY.md exists and is readable", () => {
    expect(() =>
      readPlanningFile(
        ".planning/phases/03-registry-publishing/03-02-SUMMARY.md"
      )
    ).not.toThrow();
  });

  it("Phase 3 SUMMARY contains evidence that the Cursor submission was completed", () => {
    const summary = readPlanningFile(
      ".planning/phases/03-registry-publishing/03-02-SUMMARY.md"
    );
    // Pattern from 04-01-PLAN.md key_links: "Cursor.*submitted"
    expect(summary).toMatch(/Cursor.*submitted/i);
  });

  it("Phase 3 SUMMARY contains the exact Cursor submission confirmation line", () => {
    const summary = readPlanningFile(
      ".planning/phases/03-registry-publishing/03-02-SUMMARY.md"
    );
    expect(summary).toContain(
      "Submitted Cursor marketplace plugin application with all fields filled"
    );
  });
});
