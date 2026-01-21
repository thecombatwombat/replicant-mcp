import { describe, it, expect } from "vitest";
import { ReplicantError, ErrorCode } from "../../src/types/errors.js";

describe("ReplicantError", () => {
  it("includes suggestion in JSON output", () => {
    const error = new ReplicantError(
      ErrorCode.SDK_NOT_FOUND,
      "Android SDK not found",
      "Install Android Studio or set ANDROID_HOME"
    );

    const json = error.toJSON();

    expect(json.error).toBe("SDK_NOT_FOUND");
    expect(json.message).toBe("Android SDK not found");
    expect(json.suggestion).toBe("Install Android Studio or set ANDROID_HOME");
  });

  it("includes optional context in JSON output", () => {
    const error = new ReplicantError(
      ErrorCode.ADB_NOT_FOUND,
      "adb not found",
      "Check SDK installation",
      { checkedPaths: ["/usr/bin/adb", "/opt/android/adb"] }
    );

    const json = error.toJSON();

    expect(json.context?.checkedPaths).toEqual(["/usr/bin/adb", "/opt/android/adb"]);
  });
});

describe("ErrorCode", () => {
  it("has SDK_NOT_FOUND code", () => {
    expect(ErrorCode.SDK_NOT_FOUND).toBe("SDK_NOT_FOUND");
  });

  it("has ADB_NOT_FOUND code", () => {
    expect(ErrorCode.ADB_NOT_FOUND).toBe("ADB_NOT_FOUND");
  });

  it("has NO_DEVICES code", () => {
    expect(ErrorCode.NO_DEVICES).toBe("NO_DEVICES");
  });

  it("has MULTIPLE_DEVICES code", () => {
    expect(ErrorCode.MULTIPLE_DEVICES).toBe("MULTIPLE_DEVICES");
  });

  it("has SCREENSHOT_FAILED code", () => {
    expect(ErrorCode.SCREENSHOT_FAILED).toBe("SCREENSHOT_FAILED");
  });

  it("has PULL_FAILED code", () => {
    expect(ErrorCode.PULL_FAILED).toBe("PULL_FAILED");
  });
});
