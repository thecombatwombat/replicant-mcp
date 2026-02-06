export const ErrorCode = {
  // Device errors
  NO_DEVICE_SELECTED: "NO_DEVICE_SELECTED",
  DEVICE_NOT_FOUND: "DEVICE_NOT_FOUND",
  DEVICE_OFFLINE: "DEVICE_OFFLINE",

  // Build errors
  BUILD_FAILED: "BUILD_FAILED",
  GRADLE_NOT_FOUND: "GRADLE_NOT_FOUND",
  MODULE_NOT_FOUND: "MODULE_NOT_FOUND",

  // App errors
  APK_NOT_FOUND: "APK_NOT_FOUND",
  PACKAGE_NOT_FOUND: "PACKAGE_NOT_FOUND",
  INSTALL_FAILED: "INSTALL_FAILED",

  // Emulator errors
  AVD_NOT_FOUND: "AVD_NOT_FOUND",
  EMULATOR_NOT_FOUND: "EMULATOR_NOT_FOUND",
  EMULATOR_START_FAILED: "EMULATOR_START_FAILED",
  SNAPSHOT_NOT_FOUND: "SNAPSHOT_NOT_FOUND",

  // Safety errors
  COMMAND_BLOCKED: "COMMAND_BLOCKED",
  TIMEOUT: "TIMEOUT",

  // Cache errors
  CACHE_MISS: "CACHE_MISS",

  // New "Just Works" UX error codes
  SDK_NOT_FOUND: "SDK_NOT_FOUND",
  ADB_NOT_FOUND: "ADB_NOT_FOUND",
  ADB_NOT_EXECUTABLE: "ADB_NOT_EXECUTABLE",
  ADB_SERVER_ERROR: "ADB_SERVER_ERROR",
  NO_DEVICES: "NO_DEVICES",
  MULTIPLE_DEVICES: "MULTIPLE_DEVICES",
  SCREENSHOT_FAILED: "SCREENSHOT_FAILED",
  PULL_FAILED: "PULL_FAILED",
  HEALTH_CHECK_FAILED: "HEALTH_CHECK_FAILED",
} as const;

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

export interface ErrorContext {
  command?: string;
  exitCode?: number;
  stderr?: string;
  checkedPaths?: string[];
  buildResult?: Record<string, unknown>;
}

export interface ToolError {
  error: ErrorCode;
  message: string;
  suggestion?: string;
  details?: ErrorContext;
}

export class ReplicantError extends Error {
  constructor(
    public readonly code: ErrorCode,
    message: string,
    public readonly suggestion?: string,
    public readonly context?: ErrorContext
  ) {
    super(message);
    this.name = "ReplicantError";
  }

  toJSON() {
    return {
      error: this.code,
      message: this.message,
      suggestion: this.suggestion,
      context: this.context,
    };
  }

  toToolError(): ToolError {
    return {
      error: this.code,
      message: this.message,
      suggestion: this.suggestion,
      details: this.context,
    };
  }
}
