import { Device, DeviceType, DeviceStatus } from "../types/index.js";

export function parseDeviceList(output: string): Device[] {
  const lines = output.split("\n").slice(1); // Skip header
  const devices: Device[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const [id, statusStr] = trimmed.split(/\s+/);
    if (!id) continue;

    const type: DeviceType = id.startsWith("emulator") ? "emulator" : "physical";
    const status: DeviceStatus = statusStr === "device" ? "online" : "offline";

    devices.push({
      id,
      type,
      name: id, // Can be enriched later with getprop
      status,
    });
  }

  return devices;
}

export function parsePackageList(output: string): string[] {
  return output
    .split("\n")
    .filter((line) => line.startsWith("package:"))
    .map((line) => line.replace("package:", "").trim());
}

export function parseGetProp(output: string, prop: string): string | undefined {
  const regex = new RegExp(`\\[${prop}\\]:\\s*\\[(.*)\\]`);
  const match = output.match(regex);
  return match?.[1];
}
