import { Command } from "commander";
import { AdbAdapter } from "../adapters/index.js";
import { DeviceStateManager, CacheManager } from "../services/index.js";
import { formatDeviceList, formatLogcat, DeviceInfo } from "./formatter.js";
import { CACHE_TTLS, ReplicantError } from "../types/index.js";

const adapter = new AdbAdapter();
const deviceState = new DeviceStateManager();
const cache = new CacheManager();

export function createAdbCommand(): Command {
  const adb = new Command("adb").description("ADB device and app management");

  // Devices subcommand
  adb
    .command("devices")
    .description("List connected devices")
    .option("--json", "Output as JSON")
    .action(async (options) => {
      try {
        const devices = await adapter.getDevices();
        const currentDevice = deviceState.getCurrentDevice();

        // Auto-select if single device
        const autoSelected = deviceState.autoSelectIfSingle(devices);

        const deviceInfos: DeviceInfo[] = devices.map((d) => ({
          id: d.id,
          name: d.name,
          state: d.status,
          selected: currentDevice?.id === d.id || (autoSelected && devices[0].id === d.id),
        }));

        if (options.json) {
          console.log(JSON.stringify({ devices: deviceInfos }, null, 2));
        } else {
          console.log(formatDeviceList({ devices: deviceInfos }));
          if (autoSelected) {
            console.log(`\nAuto-selected: ${devices[0].id}`);
          }
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`Error: ${errorMessage}`);
        process.exit(1);
      }
    });

  // Select subcommand
  adb
    .command("select <deviceId>")
    .description("Set active device for subsequent commands")
    .action(async (deviceId) => {
      try {
        const devices = await adapter.getDevices();
        const device = devices.find((d) => d.id === deviceId);

        if (!device) {
          console.error(`Device not found: ${deviceId}`);
          console.error("Available devices:");
          devices.forEach((d) => console.error(`  ${d.id} (${d.name})`));
          process.exit(1);
        }

        deviceState.setCurrentDevice(device);
        console.log(`Selected device: ${device.id} (${device.name})`);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`Error: ${errorMessage}`);
        process.exit(1);
      }
    });

  // Install subcommand
  adb
    .command("install <apkPath>")
    .description("Install APK on the active device")
    .option("-d, --device <deviceId>", "Target device (uses active device if not specified)")
    .action(async (apkPath, options) => {
      try {
        const deviceId = options.device || getDeviceId();
        await adapter.install(deviceId, apkPath);
        console.log(`Installed: ${apkPath}`);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`Error: ${errorMessage}`);
        process.exit(1);
      }
    });

  // Launch subcommand
  adb
    .command("launch <package>")
    .description("Launch an app on the active device")
    .option("-d, --device <deviceId>", "Target device (uses active device if not specified)")
    .action(async (packageName, options) => {
      try {
        const deviceId = options.device || getDeviceId();
        await adapter.launch(deviceId, packageName);
        console.log(`Launched: ${packageName}`);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`Error: ${errorMessage}`);
        process.exit(1);
      }
    });

  // Stop subcommand
  adb
    .command("stop <package>")
    .description("Force stop an app on the active device")
    .option("-d, --device <deviceId>", "Target device (uses active device if not specified)")
    .action(async (packageName, options) => {
      try {
        const deviceId = options.device || getDeviceId();
        await adapter.stop(deviceId, packageName);
        console.log(`Stopped: ${packageName}`);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`Error: ${errorMessage}`);
        process.exit(1);
      }
    });

  // Uninstall subcommand
  adb
    .command("uninstall <package>")
    .description("Uninstall an app from the active device")
    .option("-d, --device <deviceId>", "Target device (uses active device if not specified)")
    .action(async (packageName, options) => {
      try {
        const deviceId = options.device || getDeviceId();
        await adapter.uninstall(deviceId, packageName);
        console.log(`Uninstalled: ${packageName}`);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`Error: ${errorMessage}`);
        process.exit(1);
      }
    });

  // Clear subcommand
  adb
    .command("clear <package>")
    .description("Clear app data on the active device")
    .option("-d, --device <deviceId>", "Target device (uses active device if not specified)")
    .action(async (packageName, options) => {
      try {
        const deviceId = options.device || getDeviceId();
        await adapter.clearData(deviceId, packageName);
        console.log(`Cleared data: ${packageName}`);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`Error: ${errorMessage}`);
        process.exit(1);
      }
    });

  // Logcat subcommand
  adb
    .command("logcat")
    .description("Read device logs")
    .option("-d, --device <deviceId>", "Target device (uses active device if not specified)")
    .option("-l, --level <level>", "Log level filter (verbose, debug, info, warn, error)", "info")
    .option("-n, --lines <count>", "Number of lines to retrieve", "50")
    .option("-t, --tag <tag>", "Filter by tag")
    .option("--json", "Output as JSON")
    .action(async (options) => {
      try {
        const deviceId = options.device || getDeviceId();

        // Build filter string
        let filter = "";
        if (options.tag) {
          const levelChar = getLevelChar(options.level);
          filter = `${options.tag}:${levelChar} *:S`;
        } else {
          const levelChar = getLevelChar(options.level);
          filter = `*:${levelChar}`;
        }

        const logs = await adapter.logcat(deviceId, {
          lines: parseInt(options.lines, 10),
          filter,
        });

        const lines = logs.split("\n").filter((line) => line.trim());
        const cacheId = cache.generateId("logcat");
        cache.set(cacheId, { logs, level: options.level }, "logcat", CACHE_TTLS.LOGCAT);

        if (options.json) {
          console.log(
            JSON.stringify(
              {
                level: options.level,
                count: lines.length,
                lines,
                cacheId,
              },
              null,
              2
            )
          );
        } else {
          console.log(
            formatLogcat({
              level: options.level,
              count: lines.length,
              lines,
              cacheId,
            })
          );
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`Error: ${errorMessage}`);
        process.exit(1);
      }
    });

  // Shell subcommand
  adb
    .command("shell <command...>")
    .description("Run a shell command on the active device")
    .option("-d, --device <deviceId>", "Target device (uses active device if not specified)")
    .option("--json", "Output as JSON")
    .action(async (commandParts, options) => {
      try {
        const deviceId = options.device || getDeviceId();
        const command = commandParts.join(" ");
        const result = await adapter.shell(deviceId, command);

        if (options.json) {
          console.log(
            JSON.stringify(
              {
                command,
                exitCode: result.exitCode,
                stdout: result.stdout,
                stderr: result.stderr,
              },
              null,
              2
            )
          );
        } else {
          if (result.stdout) {
            console.log(result.stdout);
          }
          if (result.stderr) {
            console.error(result.stderr);
          }
        }

        if (result.exitCode !== 0) {
          process.exit(result.exitCode);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`Error: ${errorMessage}`);
        process.exit(1);
      }
    });

  return adb;
}

function getDeviceId(): string {
  const device = deviceState.requireCurrentDevice();
  return device.id;
}

function getLevelChar(level: string): string {
  const levels: Record<string, string> = {
    verbose: "V",
    debug: "D",
    info: "I",
    warn: "W",
    error: "E",
  };
  return levels[level.toLowerCase()] || "I";
}
