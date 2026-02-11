import { Command } from "commander";
import { execSync } from "child_process";
import { existsSync } from "fs";

export interface CheckResult {
  name: string;
  status: "ok" | "warn" | "fail";
  detail: string;
  suggestion?: string;
}

// All commands below are hardcoded literals (no user input), so execSync is safe here.
function exec(cmd: string): string {
  return execSync(cmd, { encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] }).toString().trim();
}

function checkNode(): CheckResult {
  const version = process.version;
  const major = parseInt(version.slice(1).split(".")[0], 10);
  if (major >= 18) {
    return { name: "Node.js", status: "ok", detail: version };
  }
  return { name: "Node.js", status: "fail", detail: version, suggestion: "Upgrade to Node.js >= 18" };
}

function checkNpm(): CheckResult {
  try {
    return { name: "npm", status: "ok", detail: exec("npm --version") };
  } catch {
    return { name: "npm", status: "fail", detail: "not found", suggestion: "Install npm (comes with Node.js)" };
  }
}

function checkAndroidHome(): CheckResult {
  const home = process.env.ANDROID_HOME;
  if (!home) {
    return { name: "ANDROID_HOME", status: "fail", detail: "not set", suggestion: "Set ANDROID_HOME to your Android SDK path" };
  }
  if (!existsSync(home)) {
    return { name: "ANDROID_HOME", status: "fail", detail: `${home} (not found)`, suggestion: "Path does not exist. Check ANDROID_HOME value" };
  }
  return { name: "ANDROID_HOME", status: "ok", detail: home };
}

function checkAdb(): CheckResult {
  try {
    const out = exec("adb version");
    const match = out.match(/Android Debug Bridge version ([\d.]+)/);
    return { name: "adb", status: "ok", detail: match ? match[1] : "installed" };
  } catch {
    return { name: "adb", status: "fail", detail: "not found", suggestion: "Install Android SDK platform-tools and add to PATH" };
  }
}

function checkEmulator(): CheckResult {
  try {
    const out = exec("emulator -version");
    const match = out.match(/version ([\d.]+)/);
    return { name: "emulator", status: "ok", detail: match ? match[1] : "installed" };
  } catch {
    return { name: "emulator", status: "fail", detail: "not found", suggestion: "Install Android SDK emulator and add to PATH" };
  }
}

function checkAvdmanager(): CheckResult {
  try {
    exec("avdmanager list avd");
    return { name: "avdmanager", status: "ok", detail: "installed" };
  } catch {
    return { name: "avdmanager", status: "fail", detail: "not found", suggestion: "Install Android SDK cmdline-tools and add to PATH" };
  }
}

function checkAvds(avdmanagerResult: CheckResult): CheckResult {
  if (avdmanagerResult.status === "fail") {
    return { name: "AVDs", status: "fail", detail: "skipped (avdmanager unavailable)", suggestion: "Install avdmanager first" };
  }
  try {
    const out = exec("avdmanager list avd");
    const matches = out.match(/Name:/g);
    const count = matches ? matches.length : 0;
    if (count === 0) {
      return { name: "AVDs", status: "warn", detail: "none found", suggestion: "Create an AVD: avdmanager create avd ..." };
    }
    return { name: "AVDs", status: "ok", detail: `${count} available` };
  } catch {
    return { name: "AVDs", status: "fail", detail: "could not list", suggestion: "avdmanager command failed" };
  }
}

function checkDevices(): CheckResult {
  try {
    const out = exec("adb devices");
    const lines = out.split("\n").filter((l) => l.includes("\tdevice"));
    return { name: "Connected devices", status: lines.length > 0 ? "ok" : "warn", detail: `${lines.length} connected` };
  } catch {
    return { name: "Connected devices", status: "warn", detail: "could not query", suggestion: "adb not available" };
  }
}

function checkGradle(): CheckResult {
  try {
    const out = exec("gradle --version");
    const match = out.match(/Gradle ([\d.]+)/);
    return { name: "System gradle", status: "ok", detail: match ? match[1] : "installed" };
  } catch {
    return { name: "System gradle", status: "warn", detail: "not found (optional)", suggestion: "Most projects use the Gradle wrapper (gradlew) instead" };
  }
}

export function runChecks(): CheckResult[] {
  const avdmanagerResult = checkAvdmanager();
  return [
    checkNode(), checkNpm(), checkAndroidHome(), checkAdb(),
    checkEmulator(), avdmanagerResult, checkAvds(avdmanagerResult), checkDevices(), checkGradle(),
  ];
}

function formatTty(checks: CheckResult[]): string {
  const symbols = { ok: "\u2713 OK", warn: "\u26A0 WARN", fail: "\u2717 FAIL" };
  const colors = { ok: "\x1b[32m", warn: "\x1b[33m", fail: "\x1b[31m" };
  const reset = "\x1b[0m";
  const lines = ["\nReplicant Doctor\n================\n"];
  for (const c of checks) {
    const sym = `${colors[c.status]}${symbols[c.status]}${reset}`;
    lines.push(`  ${sym}  ${c.name}: ${c.detail}`);
    if (c.suggestion) lines.push(`       ${c.suggestion}`);
  }
  const summary = { ok: 0, warn: 0, fail: 0 };
  for (const c of checks) summary[c.status]++;
  lines.push(`\n${summary.ok} passed, ${summary.warn} warnings, ${summary.fail} failures\n`);
  return lines.join("\n");
}

export function formatJson(checks: CheckResult[]): string {
  const summary = { ok: 0, warn: 0, fail: 0 };
  for (const c of checks) summary[c.status]++;
  const status = summary.fail > 0 ? "fail" : summary.warn > 0 ? "warn" : "ok";
  return JSON.stringify({ status, checks, summary }, null, 2);
}

export function createDoctorCommand(): Command {
  return new Command("doctor")
    .description("Check environment for Android development readiness")
    .option("--json", "Output as JSON")
    .action((options) => {
      const checks = runChecks();
      const useJson = options.json || !process.stdout.isTTY;
      if (useJson) {
        console.log(formatJson(checks));
      } else {
        console.log(formatTty(checks));
      }
      const hasFail = checks.some((c) => c.status === "fail");
      if (hasFail) process.exit(1);
    });
}
