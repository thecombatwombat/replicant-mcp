import { Command } from "commander";
import { EmulatorAdapter } from "../adapters/index.js";

const adapter = new EmulatorAdapter();

export function createEmulatorCommand(): Command {
  const emulator = new Command("emulator").description("Android emulator management");

  // List subcommand
  emulator
    .command("list")
    .description("List available AVDs and running emulators")
    .option("--json", "Output as JSON")
    .action(async (options) => {
      try {
        const result = await adapter.list();

        if (options.json) {
          console.log(JSON.stringify(result, null, 2));
        } else {
          console.log("Available AVDs:");
          if (result.available.length === 0) {
            console.log("  (none)");
          } else {
            result.available.forEach((avd) => {
              const status = result.running.includes(avd.name) ? " [running]" : "";
              console.log(`  ${avd.name}${status}`);
              if (avd.skin) {
                console.log(`    Skin: ${avd.skin}`);
              }
              if (avd.target) {
                console.log(`    Target: ${avd.target}`);
              }
            });
          }

          console.log("\nRunning emulators:");
          if (result.running.length === 0) {
            console.log("  (none)");
          } else {
            result.running.forEach((id) => {
              console.log(`  ${id}`);
            });
          }
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`Error: ${errorMessage}`);
        process.exit(1);
      }
    });

  // Start subcommand
  emulator
    .command("start <avdName>")
    .description("Start an emulator")
    .option("--cold-boot", "Perform a cold boot (ignore snapshots)")
    .option("--wipe-data", "Wipe user data before starting")
    .option("--json", "Output as JSON")
    .action(async (avdName, options) => {
      try {
        if (options.wipeData) {
          console.log(`Wiping data for ${avdName}...`);
          await adapter.wipe(avdName);
        }

        console.log(`Starting emulator ${avdName}...`);
        const deviceId = await adapter.start(avdName);

        if (options.json) {
          console.log(JSON.stringify({ avdName, deviceId, status: "started" }, null, 2));
        } else {
          console.log(`Emulator started: ${deviceId}`);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`Error: ${errorMessage}`);
        process.exit(1);
      }
    });

  // Stop subcommand
  emulator
    .command("stop <deviceId>")
    .description("Stop a running emulator")
    .option("--json", "Output as JSON")
    .action(async (deviceId, options) => {
      try {
        await adapter.kill(deviceId);

        if (options.json) {
          console.log(JSON.stringify({ deviceId, status: "stopped" }, null, 2));
        } else {
          console.log(`Emulator stopped: ${deviceId}`);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`Error: ${errorMessage}`);
        process.exit(1);
      }
    });

  // Snapshot subcommand
  emulator
    .command("snapshot <action>")
    .description("Manage emulator snapshots (save, load, list, delete)")
    .requiredOption("-d, --device <deviceId>", "Target emulator device ID")
    .option("-n, --name <name>", "Snapshot name (required for save, load, delete)")
    .option("--json", "Output as JSON")
    .action(async (action, options) => {
      try {
        const deviceId = options.device;
        const snapshotName = options.name;

        switch (action) {
          case "save":
            if (!snapshotName) {
              console.error("Error: --name is required for save action");
              process.exit(1);
            }
            await adapter.snapshotSave(deviceId, snapshotName);
            if (options.json) {
              console.log(JSON.stringify({ action: "save", deviceId, name: snapshotName, status: "saved" }, null, 2));
            } else {
              console.log(`Snapshot saved: ${snapshotName}`);
            }
            break;

          case "load":
            if (!snapshotName) {
              console.error("Error: --name is required for load action");
              process.exit(1);
            }
            await adapter.snapshotLoad(deviceId, snapshotName);
            if (options.json) {
              console.log(JSON.stringify({ action: "load", deviceId, name: snapshotName, status: "loaded" }, null, 2));
            } else {
              console.log(`Snapshot loaded: ${snapshotName}`);
            }
            break;

          case "list":
            const snapshots = await adapter.snapshotList(deviceId);
            if (options.json) {
              console.log(JSON.stringify({ deviceId, snapshots }, null, 2));
            } else {
              console.log(`Snapshots for ${deviceId}:`);
              if (snapshots.length === 0) {
                console.log("  (none)");
              } else {
                snapshots.forEach((name) => {
                  console.log(`  ${name}`);
                });
              }
            }
            break;

          case "delete":
            if (!snapshotName) {
              console.error("Error: --name is required for delete action");
              process.exit(1);
            }
            await adapter.snapshotDelete(deviceId, snapshotName);
            if (options.json) {
              console.log(JSON.stringify({ action: "delete", deviceId, name: snapshotName, status: "deleted" }, null, 2));
            } else {
              console.log(`Snapshot deleted: ${snapshotName}`);
            }
            break;

          default:
            console.error(`Unknown action: ${action}`);
            console.error("Valid actions: save, load, list, delete");
            process.exit(1);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`Error: ${errorMessage}`);
        process.exit(1);
      }
    });

  return emulator;
}
