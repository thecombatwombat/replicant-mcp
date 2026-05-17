import { describe, it, expect } from "vitest";
import {
  parseCurrentAppFromDumpsysActivities,
  parseCurrentAppFromDumpsysWindow,
} from "../../src/parsers/dumpsys-current-app.js";

describe("parseCurrentAppFromDumpsysActivities", () => {
  it("returns first mResumedActivity package/activity from realistic output", () => {
    const stdout = `ACTIVITY MANAGER ACTIVITIES (dumpsys activity activities)
Display #0 (activities from top to bottom):
  Stack #0:
    Task id #42
      mResumedActivity: ActivityRecord{abc123 u0 com.example.app/.MainActivity t42}
      mLastResumedActivity: ActivityRecord{def456 u0 com.previous/.Prev t41}
`;
    expect(parseCurrentAppFromDumpsysActivities(stdout)).toEqual({
      packageName: "com.example.app",
      activityName: ".MainActivity",
    });
  });

  it("ignores non-mResumedActivity lines that mention activity records", () => {
    // mLastResumedActivity / mFocusedActivity must not win. Pre-fix the code
    // relied on `grep mResumedActivity` for this filtering; the parser must do
    // the same in TS.
    const stdout = `      mLastResumedActivity: ActivityRecord{x u0 com.wrong.last/.Wrong t1}
      mFocusedActivity: ActivityRecord{y u0 com.wrong.focused/.Wrong t2}
      mResumedActivity: ActivityRecord{z u0 com.correct/.Right t3}
`;
    expect(parseCurrentAppFromDumpsysActivities(stdout)).toEqual({
      packageName: "com.correct",
      activityName: ".Right",
    });
  });

  it("returns the first mResumedActivity when multiple users are present", () => {
    const stdout = `      mResumedActivity: ActivityRecord{a u0 com.foreground.user0/.MainActivity t1}
      mResumedActivity: ActivityRecord{b u10 com.foreground.user10/.WorkActivity t2}
`;
    expect(parseCurrentAppFromDumpsysActivities(stdout)).toEqual({
      packageName: "com.foreground.user0",
      activityName: ".MainActivity",
    });
  });

  it("returns null when stdout has no mResumedActivity line", () => {
    expect(parseCurrentAppFromDumpsysActivities("Display #0:\n  (no resumed activity)\n")).toBeNull();
  });

  it("returns null on empty input", () => {
    expect(parseCurrentAppFromDumpsysActivities("")).toBeNull();
  });

  it("handles CRLF line endings", () => {
    const stdout = "      mResumedActivity: ActivityRecord{a u0 com.crlf/.Activity t1}\r\n";
    expect(parseCurrentAppFromDumpsysActivities(stdout)).toEqual({
      packageName: "com.crlf",
      activityName: ".Activity",
    });
  });
});

describe("parseCurrentAppFromDumpsysWindow", () => {
  it("returns package/activity from a realistic mCurrentFocus line", () => {
    const stdout = `WINDOW MANAGER POLICY STATE
  mStable=(0,0)-(1080,2400)
  mCurrentFocus=Window{abc u0 com.test.app/.TestActivity}
  mFocusedApp=AppWindowToken{def}
`;
    expect(parseCurrentAppFromDumpsysWindow(stdout)).toEqual({
      packageName: "com.test.app",
      activityName: ".TestActivity",
    });
  });

  it("returns null when stdout has no mCurrentFocus line", () => {
    expect(parseCurrentAppFromDumpsysWindow("WINDOW MANAGER STATE\n  nothing here\n")).toBeNull();
  });

  it("returns null when mCurrentFocus has no package/activity (e.g. mCurrentFocus=null)", () => {
    expect(parseCurrentAppFromDumpsysWindow("  mCurrentFocus=null\n")).toBeNull();
  });
});
