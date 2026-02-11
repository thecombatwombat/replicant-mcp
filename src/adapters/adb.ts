import { ProcessRunner, RunResult } from "../services/index.js";
import { Device, ReplicantError, ErrorCode } from "../types/index.js";
import { parseDeviceList, parsePackageList } from "../parsers/adb-output.js";

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
