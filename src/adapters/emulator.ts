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
      this.runner.runAvdManager(["list", "avd"]),
      this.runner.runEmulator(["-list-avds"]),
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
    const result = await this.runner.runAvdManager([
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
    // Snapshot existing emulators before starting a new one
    const existingIds = await this.getRunningEmulatorIds();

    // Start emulator fully detached so it outlives this MCP process.
    // (Previously this used runEmulator() with a 5s timeout, but that timeout
    // SIGTERMs the non-detached child — killing the emulator mid-boot.)
    await this.runner.runEmulatorDetached([
      "-avd", avdName,
      "-no-snapshot-load",
      "-no-boot-anim",
    ]);

    // Give it a moment to register
    await new Promise((r) => setTimeout(r, 2000));

    // Find the NEW emulator by diffing against pre-existing ones
    const currentIds = await this.getRunningEmulatorIds();
    const newIds = currentIds.filter((id) => !existingIds.includes(id));

    if (newIds.length === 1) {
      return newIds[0];
    }

    // Ambiguous or no new emulator — fall back to matching by AVD name
    for (const id of currentIds) {
      if (existingIds.includes(id)) continue;
      const name = await this.getAvdName(id);
      if (name === avdName) return id;
    }

    // Last resort: check all current emulators by AVD name
    for (const id of currentIds) {
      const name = await this.getAvdName(id);
      if (name === avdName) return id;
    }

    throw new ReplicantError(
      ErrorCode.EMULATOR_START_FAILED,
      `Emulator ${avdName} failed to start`,
      "Check the AVD name and try again"
    );
  }

  private async getRunningEmulatorIds(): Promise<string[]> {
    const result = await this.runner.runAdb(["devices"]);
    const matches = result.stdout.match(/emulator-\d+/g);
    return matches ?? [];
  }

  private async getAvdName(emulatorId: string): Promise<string> {
    try {
      const result = await this.runner.runAdb(["-s", emulatorId, "emu", "avd", "name"]);
      return result.stdout.trim().split("\n")[0].trim();
    } catch {
      return "";
    }
  }

  async kill(emulatorId: string): Promise<void> {
    await this.runner.runAdb(["-s", emulatorId, "emu", "kill"]);
  }

  async wipe(avdName: string): Promise<void> {
    await this.runner.runEmulator(["-avd", avdName, "-wipe-data", "-no-window"], { timeoutMs: 5000 }).catch(() => {
      // Expected behavior
    });
  }

  async snapshotSave(emulatorId: string, name: string): Promise<void> {
    await this.runner.runAdb(["-s", emulatorId, "emu", "avd", "snapshot", "save", name]);
  }

  async snapshotLoad(emulatorId: string, name: string): Promise<void> {
    await this.runner.runAdb(["-s", emulatorId, "emu", "avd", "snapshot", "load", name]);
  }

  async snapshotList(emulatorId: string): Promise<string[]> {
    const result = await this.runner.runAdb(["-s", emulatorId, "emu", "avd", "snapshot", "list"]);
    return parseSnapshotList(result.stdout);
  }

  async snapshotDelete(emulatorId: string, name: string): Promise<void> {
    await this.runner.runAdb(["-s", emulatorId, "emu", "avd", "snapshot", "delete", name]);
  }
}
