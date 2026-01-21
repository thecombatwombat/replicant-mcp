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
