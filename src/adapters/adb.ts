import { ProcessRunner, RunResult } from "../services/index.js";
import { Device, ReplicantError, ErrorCode } from "../types/index.js";
import { parseDeviceList, parsePackageList } from "../parsers/adb-output.js";

// CU-2 (THE-106): typed-intent input shape. Each field is validated before
// being passed to argv — even though the per-arg shell-payload guard would
// catch most attacks, defence-in-depth is cheap here.
export interface StartIntentInput {
  action: string;
  data?: string;
  package?: string;
  component?: string;
  extras?: Record<string, string>;
}

export interface StartIntentResult {
  raw: string;
  status?: string;
  ok: boolean;
}

// Tight enough to forbid spaces, shell composition characters, and most
// non-identifier punctuation, but loose enough for Android's actual action
// alphabet (letters, digits, `.`, `_`). 128 chars is well above any real
// action string.
const ACTION_REGEX = /^[a-zA-Z][a-zA-Z0-9_.]{0,128}$/;
// Android package: `com.example.foo`, segments dot-separated, each segment
// starts with a letter. Length capped well above realistic packages.
const PACKAGE_REGEX = /^[a-zA-Z][a-zA-Z0-9_]*(?:\.[a-zA-Z][a-zA-Z0-9_]*)*$/;
// Component spec: `pkg/.Activity` or `pkg/pkg.Activity`. Slash-separated.
const COMPONENT_REGEX = /^[a-zA-Z][a-zA-Z0-9_.]*\/\.?[a-zA-Z][a-zA-Z0-9_.]*$/;
// Conservative key regex for extras — alphanumeric + dot/underscore. The
// `am start` CLI uses key=value with `--es key value`, where the key is a
// shell arg of its own; this just stops obvious metacharacter sneaks.
const EXTRA_KEY_REGEX = /^[a-zA-Z][a-zA-Z0-9_.]{0,64}$/;
const MAX_DATA_LENGTH = 2048;
const MAX_EXTRA_VALUE_LENGTH = 4096;

function assertNoNullByte(field: string, value: string): void {
  if (value.includes("\0")) {
    throw new ReplicantError(
      ErrorCode.INPUT_VALIDATION_FAILED,
      `${field} contains a null byte`,
      "Strip control characters before calling start-intent",
    );
  }
}

function validateStartIntentInput(intent: StartIntentInput): void {
  if (!ACTION_REGEX.test(intent.action)) {
    throw new ReplicantError(
      ErrorCode.INPUT_VALIDATION_FAILED,
      `Invalid intent action: ${intent.action}`,
      "Use a dotted identifier like android.intent.action.VIEW",
    );
  }
  if (intent.data !== undefined) {
    if (intent.data.length === 0) {
      throw new ReplicantError(
        ErrorCode.INPUT_VALIDATION_FAILED,
        "intent.data must be non-empty when provided",
        "Omit `data` or provide a non-empty URI",
      );
    }
    if (intent.data.length > MAX_DATA_LENGTH) {
      throw new ReplicantError(
        ErrorCode.INPUT_VALIDATION_FAILED,
        `intent.data exceeds ${MAX_DATA_LENGTH} chars`,
        "Truncate the URI",
      );
    }
    assertNoNullByte("intent.data", intent.data);
  }
  if (intent.package !== undefined && !PACKAGE_REGEX.test(intent.package)) {
    throw new ReplicantError(
      ErrorCode.INPUT_VALIDATION_FAILED,
      `Invalid package: ${intent.package}`,
      "Use a dotted identifier like com.example.app",
    );
  }
  if (intent.component !== undefined && !COMPONENT_REGEX.test(intent.component)) {
    throw new ReplicantError(
      ErrorCode.INPUT_VALIDATION_FAILED,
      `Invalid component: ${intent.component}`,
      "Use pkg/.Activity or pkg/pkg.Activity form",
    );
  }
  if (intent.extras !== undefined) {
    for (const [key, value] of Object.entries(intent.extras)) {
      if (!EXTRA_KEY_REGEX.test(key)) {
        throw new ReplicantError(
          ErrorCode.INPUT_VALIDATION_FAILED,
          `Invalid extras key: ${key}`,
          "Keys must be dotted identifiers (letters, digits, ., _)",
        );
      }
      if (typeof value !== "string") {
        throw new ReplicantError(
          ErrorCode.INPUT_VALIDATION_FAILED,
          `Extras value for '${key}' must be a string`,
          "Convert non-string values to strings before calling start-intent",
        );
      }
      if (value.length > MAX_EXTRA_VALUE_LENGTH) {
        throw new ReplicantError(
          ErrorCode.INPUT_VALIDATION_FAILED,
          `Extras value for '${key}' exceeds ${MAX_EXTRA_VALUE_LENGTH} chars`,
          "Truncate the value",
        );
      }
      assertNoNullByte(`extras.${key}`, value);
    }
  }
}

function parseStartIntentOutput(output: string): { status?: string; ok: boolean } {
  // `am start -W` prints a key/value block. Example:
  //   Starting: Intent { act=android.intent.action.VIEW dat=... }
  //   Status: ok
  //   LaunchState: COLD
  // Failures usually print `Error type 3` / `Error: Activity not started, ...`.
  const statusMatch = output.match(/^Status:\s*(\S+)/m);
  const errorMatch = /^Error\b/m.test(output);
  const status = statusMatch?.[1];
  const ok = status?.toLowerCase() === "ok" && !errorMatch;
  return { status, ok };
}

export class AdbAdapter {
  constructor(private runner: ProcessRunner = new ProcessRunner()) {}

  async getDevices(): Promise<Device[]> {
    const result = await this.adb(["devices"]);
    return parseDeviceList(result.stdout);
  }

  async getPackages(deviceId: string): Promise<string[]> {
    const result = await this.adb(["-s", deviceId, "shell", "pm", "list", "packages"]);
    return parsePackageList(result.stdout);
  }

  async install(deviceId: string, apkPath: string): Promise<void> {
    const result = await this.adb(["-s", deviceId, "install", "-r", apkPath]);
    if (result.exitCode !== 0 || result.stdout.includes("Failure")) {
      throw new ReplicantError(
        ErrorCode.INSTALL_FAILED,
        `Failed to install APK: ${result.stdout}`,
        "Check the APK path and device state"
      );
    }
  }

  async uninstall(deviceId: string, packageName: string): Promise<void> {
    const result = await this.adb(["-s", deviceId, "uninstall", packageName]);
    if (result.exitCode !== 0) {
      throw new ReplicantError(
        ErrorCode.PACKAGE_NOT_FOUND,
        `Failed to uninstall ${packageName}`,
        "Check the package name"
      );
    }
  }

  async launch(deviceId: string, packageName: string): Promise<void> {
    // Get the main activity using dumpsys
    const result = await this.adb([
      "-s", deviceId, "shell", "monkey",
      "-p", packageName, "-c", "android.intent.category.LAUNCHER", "1"
    ]);
    if (result.exitCode !== 0) {
      throw new ReplicantError(
        ErrorCode.PACKAGE_NOT_FOUND,
        `Failed to launch ${packageName}`,
        "Check the package name and ensure the app is installed"
      );
    }
  }

  async stop(deviceId: string, packageName: string): Promise<void> {
    await this.adb(["-s", deviceId, "shell", "am", "force-stop", packageName]);
  }

  async clearData(deviceId: string, packageName: string): Promise<void> {
    await this.adb(["-s", deviceId, "shell", "pm", "clear", packageName]);
  }

  async shell(deviceId: string, command: string, timeoutMs?: number): Promise<RunResult> {
    return this.adb(["-s", deviceId, "shell", command], timeoutMs);
  }

  // CU-2 (THE-106): typed-intent entry point.
  //
  // Builds an `am start -W` invocation as argv — each user value lands in its
  // own arg, so URLs with `?` and `&` flow through to Android without being
  // mistaken for shell composition. Inputs are validated UP FRONT (action
  // regex, package/component regex, length caps, null-byte rejection) before
  // any argv is constructed, so even if the per-arg shell guard ever changes,
  // start-intent stays safe.
  async startIntent(deviceId: string, intent: StartIntentInput): Promise<StartIntentResult> {
    validateStartIntentInput(intent);

    const args: string[] = ["-s", deviceId, "shell", "am", "start", "-W"];
    args.push("-a", intent.action);
    if (intent.data !== undefined) {
      args.push("-d", intent.data);
    }
    if (intent.package !== undefined) {
      args.push("-n", intent.component ?? `${intent.package}/.MainActivity`);
    } else if (intent.component !== undefined) {
      args.push("-n", intent.component);
    }
    if (intent.extras) {
      for (const [key, value] of Object.entries(intent.extras)) {
        args.push("--es", key, value);
      }
    }

    const result = await this.adb(args);
    const parsed = parseStartIntentOutput(result.stdout);
    if (!parsed.ok && result.exitCode !== 0) {
      throw new ReplicantError(
        ErrorCode.COMMAND_BLOCKED,
        `am start failed (exit ${result.exitCode}): ${result.stderr || result.stdout}`,
        "Check the action, data URI, and target package/component",
      );
    }
    return {
      raw: result.stdout,
      status: parsed.status,
      ok: parsed.ok,
    };
  }

  async pull(deviceId: string, remotePath: string, localPath: string): Promise<void> {
    const result = await this.adb(["-s", deviceId, "pull", remotePath, localPath]);
    if (result.exitCode !== 0) {
      throw new ReplicantError(
        ErrorCode.PULL_FAILED,
        `Failed to pull ${remotePath} to ${localPath}`,
        result.stderr || "Check device connection and file paths"
      );
    }
  }

  async logcat(
    deviceId: string,
    options: { lines?: number; filter?: string; since?: string; package?: string }
  ): Promise<string> {
    const args = ["-s", deviceId, "logcat", "-d"];

    if (options.since) {
      args.push("-T", options.since);
    }

    if (options.lines) {
      args.push("-t", options.lines.toString());
    }

    if (options.filter) {
      args.push(...options.filter.split(" "));
    }

    const result = await this.adb(args);
    let output = result.stdout;

    // Package filtering: filter output lines containing the package name
    // We use string matching on output lines rather than --pid (requires pidof)
    // or -e regex (varies across adb versions)
    if (options.package) {
      const lines = output.split("\n");
      output = lines.filter((line) => line.includes(options.package!)).join("\n");
    }

    return output;
  }

  async waitForDevice(deviceId: string, timeoutMs = 30000): Promise<void> {
    await this.adb(["-s", deviceId, "wait-for-device"], timeoutMs);
  }

  async getProperties(deviceId: string): Promise<Record<string, string>> {
    const result = await this.adb(["-s", deviceId, "shell", "getprop"]);
    const props: Record<string, string> = {};

    const regex = /\[([^\]]+)\]:\s*\[([^\]]*)\]/g;
    let match;
    while ((match = regex.exec(result.stdout)) !== null) {
      props[match[1]] = match[2];
    }

    return props;
  }

  private async adb(args: string[], timeoutMs?: number): Promise<RunResult> {
    return this.runner.runAdb(args, { timeoutMs });
  }
}
