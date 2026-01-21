import { ProcessRunner } from "../services/index.js";
import { ReplicantError, ErrorCode } from "../types/index.js";
import { parseAvdList, parseEmulatorList, parseSnapshotList, AvdInfo } from "../parsers/emulator-output.js";

export interface EmulatorListResult {
  available: AvdInfo[];
  running: string[];
}

export class EmulatorAdapter {
  constructor(private runner: ProcessRunner = new ProcessRunner()) {}

  async list(): Promise<EmulatorListResult> {
    const [avdResult, runningResult] = await Promise.all([
      this.runner.run("avdmanager", ["list", "avd"]),
      this.runner.run("emulator", ["-list-avds"]),
    ]);

    return {
      available: parseAvdList(avdResult.stdout),
      running: parseEmulatorList(runningResult.stdout),
    };
  }

  async create(
    name: string,
    device: string,
    systemImage: string
  ): Promise<void> {
    const result = await this.runner.run("avdmanager", [
      "create", "avd",
      "-n", name,
      "-k", systemImage,
      "-d", device,
      "--force",
    ], { timeoutMs: 60000 });

    if (result.exitCode !== 0) {
      throw new ReplicantError(
        ErrorCode.EMULATOR_START_FAILED,
        `Failed to create AVD: ${result.stderr}`,
        "Check device and system image names"
      );
    }
  }

  async start(avdName: string): Promise<string> {
    // Start emulator in background - don't wait for it
    // Returns immediately, emulator boots in background
    this.runner.run("emulator", [
      "-avd", avdName,
      "-no-snapshot-load",
      "-no-boot-anim",
    ], { timeoutMs: 5000 }).catch(() => {
      // Expected to "timeout" as emulator runs forever
    });

    // Give it a moment to register
    await new Promise((r) => setTimeout(r, 2000));

    // Find the new emulator ID
    const result = await this.runner.run("adb", ["devices"]);
    const match = result.stdout.match(/emulator-\d+/);

    if (!match) {
      throw new ReplicantError(
        ErrorCode.EMULATOR_START_FAILED,
        `Emulator ${avdName} failed to start`,
        "Check the AVD name and try again"
      );
    }

    return match[0];
  }

  async kill(emulatorId: string): Promise<void> {
    await this.runner.run("adb", ["-s", emulatorId, "emu", "kill"]);
  }

  async wipe(avdName: string): Promise<void> {
    await this.runner.run("emulator", ["-avd", avdName, "-wipe-data", "-no-window"], { timeoutMs: 5000 }).catch(() => {
      // Expected behavior
    });
  }

  async snapshotSave(emulatorId: string, name: string): Promise<void> {
    await this.runner.run("adb", ["-s", emulatorId, "emu", "avd", "snapshot", "save", name]);
  }

  async snapshotLoad(emulatorId: string, name: string): Promise<void> {
    await this.runner.run("adb", ["-s", emulatorId, "emu", "avd", "snapshot", "load", name]);
  }

  async snapshotList(emulatorId: string): Promise<string[]> {
    const result = await this.runner.run("adb", ["-s", emulatorId, "emu", "avd", "snapshot", "list"]);
    return parseSnapshotList(result.stdout);
  }

  async snapshotDelete(emulatorId: string, name: string): Promise<void> {
    await this.runner.run("adb", ["-s", emulatorId, "emu", "avd", "snapshot", "delete", name]);
  }
}
