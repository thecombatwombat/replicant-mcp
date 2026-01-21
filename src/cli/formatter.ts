export interface BuildSuccessData {
  duration: string;
  apkPath?: string;
  apkSize?: string;
  warnings: number;
  cacheId: string;
}

export interface BuildFailureData {
  duration: string;
  error: string;
  cacheId: string;
}

export interface TestResultsData {
  passed: number;
  failed: number;
  skipped: number;
  duration: string;
  failures: string[];
  cacheId: string;
}

export interface UiElement {
  index: number;
  type: string;
  text?: string;
  hint?: string;
  focused?: boolean;
}

export interface UiDumpData {
  screenName: string;
  elements: UiElement[];
}

export interface LogcatData {
  level: string;
  count: number;
  lines: string[];
  cacheId: string;
}

export interface DeviceInfo {
  id: string;
  name: string;
  state: string;
  selected: boolean;
}

export interface DeviceListData {
  devices: DeviceInfo[];
}

export function formatBuildSuccess(data: BuildSuccessData): string {
  const lines = [`✓ Build successful (${data.duration})`];

  if (data.apkPath) {
    const filename = data.apkPath.split("/").pop();
    lines.push(`  APK: ${filename}${data.apkSize ? ` (${data.apkSize})` : ""}`);
  }

  if (data.warnings > 0) {
    lines.push(`  Warnings: ${data.warnings}`);
  }

  lines.push(`  Cache ID: ${data.cacheId}`);

  return lines.join("\n");
}

export function formatBuildFailure(data: BuildFailureData): string {
  const lines = [
    `✗ Build failed (${data.duration})`,
    "",
    `  Error: ${data.error}`,
    "",
    `  Cache ID: ${data.cacheId}`,
    `  Run: replicant gradle details ${data.cacheId} --errors`,
  ];

  return lines.join("\n");
}

export function formatTestResults(data: TestResultsData): string {
  const status = data.failed === 0 ? "✓" : "✗";
  const lines = [
    `${status} ${data.passed} passed, ${data.failed} failed, ${data.skipped} skipped (${data.duration})`,
  ];

  if (data.failures.length > 0) {
    lines.push("");
    lines.push("Failed:");
    data.failures.forEach(f => lines.push(`  • ${f}`));
  }

  lines.push("");
  lines.push(`Cache ID: ${data.cacheId}`);

  return lines.join("\n");
}

export function formatUiDump(data: UiDumpData): string {
  const lines = [`Screen: ${data.screenName}`];

  data.elements.forEach((el, i) => {
    const prefix = i === data.elements.length - 1 ? "└─" : "├─";
    let desc = el.text || el.hint || "";
    if (el.focused) desc += " (focused)";
    lines.push(`${prefix} [${el.index}] ${el.type}${desc ? ` "${desc}"` : ""}`);
  });

  lines.push("");
  lines.push(`${data.elements.length} interactive elements`);

  return lines.join("\n");
}

export function formatLogcat(data: LogcatData): string {
  const lines = [`${data.count} ${data.level}s in recent logs:`, ""];

  data.lines.forEach(line => lines.push(line));

  lines.push("");
  lines.push(`Cache ID: ${data.cacheId}`);

  return lines.join("\n");
}

export function formatDeviceList(data: DeviceListData): string {
  if (data.devices.length === 0) {
    return "No devices connected";
  }

  const lines = ["Devices:"];

  data.devices.forEach(device => {
    const indicator = device.selected ? "→ " : "  ";
    lines.push(`${indicator}${device.id} (${device.name}) [${device.state}]`);
  });

  return lines.join("\n");
}
