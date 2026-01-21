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
  EMULATOR_START_FAILED: "EMULATOR_START_FAILED",
  SNAPSHOT_NOT_FOUND: "SNAPSHOT_NOT_FOUND",

  // Safety errors
  COMMAND_BLOCKED: "COMMAND_BLOCKED",
  TIMEOUT: "TIMEOUT",

  // Cache errors
  CACHE_MISS: "CACHE_MISS",
} as const;

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

export interface ToolError {
  error: ErrorCode;
  message: string;
  suggestion?: string;
  details?: Record<string, unknown>;
}

export class ReplicantError extends Error {
  constructor(
    public readonly code: ErrorCode,
    message: string,
    public readonly suggestion?: string,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = "ReplicantError";
  }

  toToolError(): ToolError {
    return {
      error: this.code,
      message: this.message,
      suggestion: this.suggestion,
      details: this.details,
    };
  }
}
