import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { ReplicantError, ErrorCode } from "../types/index.js";

export interface Environment {
  sdkPath: string | null;
  adbPath: string | null;
  emulatorPath: string | null;
  platform: "darwin" | "linux" | "win32";
  isValid: boolean;
  issues: string[];
}

export class EnvironmentService {
  private cached: Environment | null = null;

  async detect(): Promise<Environment> {
    if (this.cached) {
      return this.cached;
    }

    const platform = os.platform() as "darwin" | "linux" | "win32";
    const issues: string[] = [];

    // Try to find SDK
    const sdkPath = this.findSdkPath(platform);

    if (!sdkPath) {
      this.cached = {
        sdkPath: null,
        adbPath: null,
        emulatorPath: null,
        platform,
        isValid: false,
        issues: ["Android SDK not found. Install Android Studio or set ANDROID_HOME environment variable."],
      };
      return this.cached;
    }

    const adbPath = path.join(sdkPath, "platform-tools", this.getExecutableName("adb", platform));
    const emulatorPath = path.join(sdkPath, "emulator", this.getExecutableName("emulator", platform));

    // Verify adb exists
    if (!fs.existsSync(adbPath)) {
      issues.push(`adb not found at ${adbPath}`);
    }

    // Emulator is optional - just note if missing
    if (!fs.existsSync(emulatorPath)) {
      issues.push(`emulator not found at ${emulatorPath} (optional)`);
    }

    this.cached = {
      sdkPath,
      adbPath: fs.existsSync(adbPath) ? adbPath : null,
      emulatorPath: fs.existsSync(emulatorPath) ? emulatorPath : null,
      platform,
      isValid: fs.existsSync(adbPath),
      issues,
    };

    return this.cached;
  }

  async getAdbPath(): Promise<string> {
    const env = await this.detect();
    if (!env.adbPath) {
      throw new ReplicantError(
        ErrorCode.ADB_NOT_FOUND,
        "Android SDK not found",
        "Install Android Studio or set ANDROID_HOME environment variable",
        { checkedPaths: this.getSearchPaths(env.platform) }
      );
    }
    return env.adbPath;
  }

  async getEmulatorPath(): Promise<string> {
    const env = await this.detect();
    if (!env.emulatorPath) {
      throw new ReplicantError(
        ErrorCode.EMULATOR_NOT_FOUND,
        "Android emulator not found",
        "Install Android Emulator via Android Studio SDK Manager"
      );
    }
    return env.emulatorPath;
  }

  async getAvdManagerPath(): Promise<string> {
    const env = await this.detect();
    if (!env.sdkPath) {
      throw new ReplicantError(
        ErrorCode.SDK_NOT_FOUND,
        "Android SDK not found",
        "Install Android Studio or set ANDROID_HOME environment variable"
      );
    }
    const avdManagerPath = path.join(env.sdkPath, "cmdline-tools", "latest", "bin", this.getExecutableName("avdmanager", env.platform));
    // Fallback to older location
    const legacyPath = path.join(env.sdkPath, "tools", "bin", this.getExecutableName("avdmanager", env.platform));

    if (fs.existsSync(avdManagerPath)) {
      return avdManagerPath;
    }
    if (fs.existsSync(legacyPath)) {
      return legacyPath;
    }

    throw new ReplicantError(
      ErrorCode.SDK_NOT_FOUND,
      "avdmanager not found",
      "Install Android SDK Command-line Tools via Android Studio SDK Manager"
    );
  }

  private findSdkPath(platform: string): string | null {
    // 1. Check ANDROID_HOME
    if (process.env.ANDROID_HOME) {
      const adbPath = path.join(process.env.ANDROID_HOME, "platform-tools", this.getExecutableName("adb", platform));
      if (fs.existsSync(adbPath)) {
        return process.env.ANDROID_HOME;
      }
    }

    // 2. Check ANDROID_SDK_ROOT
    if (process.env.ANDROID_SDK_ROOT) {
      const adbPath = path.join(process.env.ANDROID_SDK_ROOT, "platform-tools", this.getExecutableName("adb", platform));
      if (fs.existsSync(adbPath)) {
        return process.env.ANDROID_SDK_ROOT;
      }
    }

    // 3. Probe common paths
    const searchPaths = this.getSearchPaths(platform);
    for (const sdkPath of searchPaths) {
      const adbPath = path.join(sdkPath, "platform-tools", this.getExecutableName("adb", platform));
      if (fs.existsSync(adbPath)) {
        return sdkPath;
      }
    }

    return null;
  }

  private getSearchPaths(platform: string): string[] {
    const home = os.homedir();

    if (platform === "darwin") {
      return [
        path.join(home, "Library", "Android", "sdk"),
        "/opt/homebrew/share/android-sdk",
        "/usr/local/share/android-sdk",
      ];
    }

    if (platform === "linux") {
      return [
        path.join(home, "Android", "Sdk"),
        "/opt/android-sdk",
        "/usr/lib/android-sdk",
      ];
    }

    if (platform === "win32") {
      const localAppData = process.env.LOCALAPPDATA || path.join(home, "AppData", "Local");
      return [
        path.join(localAppData, "Android", "Sdk"),
        "C:\\Android\\sdk",
      ];
    }

    return [];
  }

  // Clear cache (for testing)
  clearCache(): void {
    this.cached = null;
  }

  private getExecutableName(baseName: string, platform?: string): string {
    const currentPlatform = platform ?? os.platform();
    if (currentPlatform !== "win32") {
      return baseName;
    }

    const windowsExtensions: Record<string, string> = {
      adb: ".exe",
      emulator: ".exe",
      avdmanager: ".bat",
    };

    return baseName + (windowsExtensions[baseName] || ".exe");
  }
}
