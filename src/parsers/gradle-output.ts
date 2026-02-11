export interface BuildResult {
  success: boolean;
  duration?: string;
  tasksExecuted?: number;
  warnings: number;
  errors: number;
  failedTask?: string;
  apkPath?: string;
}

export interface TestResult {
  passed: number;
  failed: number;
  skipped: number;
  total: number;
  duration?: string;
  failures: Array<{ test: string; message: string }>;
  passedTests: string[];
}

export function parseBuildOutput(output: string): BuildResult {
  const success = output.includes("BUILD SUCCESSFUL");
  const durationMatch = output.match(/BUILD (?:SUCCESSFUL|FAILED) in (\S+)/);
  const tasksMatch = output.match(/(\d+) actionable tasks/);
  const failedTaskMatch = output.match(/Task (:\S+) FAILED/);
  const warnings = (output.match(/^w:/gm) || []).length;
  const errors = (output.match(/^e:/gm) || []).length;

  // Try to find APK path
  const apkMatch = output.match(/(\S+\.apk)/);

  return {
    success,
    duration: durationMatch?.[1],
    tasksExecuted: tasksMatch ? parseInt(tasksMatch[1], 10) : undefined,
    warnings,
    errors,
    failedTask: failedTaskMatch?.[1],
    apkPath: apkMatch?.[1],
  };
}

export function parseTestOutput(output: string): TestResult {
  const summaryMatch = output.match(/(\d+) tests? completed(?:, (\d+) failed)?(?:, (\d+) skipped)?/);

  const total = summaryMatch ? parseInt(summaryMatch[1], 10) : 0;
  const failed = summaryMatch?.[2] ? parseInt(summaryMatch[2], 10) : 0;
  const skipped = summaryMatch?.[3] ? parseInt(summaryMatch[3], 10) : 0;
  const passed = total - failed - skipped;

  const durationMatch = output.match(/in (\S+)/);

  // Extract failure details
  const failures: Array<{ test: string; message: string }> = [];
  const failureRegex = /(\S+) > (\S+) FAILED/g;
  let match;
  while ((match = failureRegex.exec(output)) !== null) {
    failures.push({ test: `${match[1]}.${match[2]}`, message: "" });
  }

  // Extract passed test names
  const passedTests: string[] = [];
  const passedRegex = /(\S+) > (\S+) PASSED/g;
  while ((match = passedRegex.exec(output)) !== null) {
    passedTests.push(`${match[1]}.${match[2]}`);
  }

  return {
    passed,
    failed,
    skipped,
    total,
    duration: durationMatch?.[1],
    failures,
    passedTests,
  };
}

export function parseModuleList(output: string): string[] {
  const modules: string[] = [];
  const regex = /Project '(:\S+)'/g;
  let match;
  while ((match = regex.exec(output)) !== null) {
    modules.push(match[1]);
  }
  return modules;
}

export interface VariantInfo {
  name: string;
  buildType: string;
  flavors: string[];
}

export function parseVariantList(output: string): VariantInfo[] {
  // This is a simplified parser - actual output varies by project
  const variants: VariantInfo[] = [];
  const lines = output.split("\n");

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith(">") || trimmed.startsWith("Task")) continue;

    // Common pattern: "debug", "release", "freeDebug", "paidRelease"
    if (/^[a-z]+[A-Z]?[a-z]*$/.test(trimmed)) {
      const isDebug = trimmed.toLowerCase().includes("debug");
      const isRelease = trimmed.toLowerCase().includes("release");
      const buildType = isDebug ? "debug" : isRelease ? "release" : trimmed;

      const flavorPart = trimmed.replace(/debug|release/gi, "");
      const flavors = flavorPart ? [flavorPart.toLowerCase()] : [];

      variants.push({ name: trimmed, buildType, flavors });
    }
  }

  return variants;
}

export function parseTaskList(output: string): string[] {
  const tasks: string[] = [];
  const regex = /^(\S+) - /gm;
  let match;
  while ((match = regex.exec(output)) !== null) {
    tasks.push(match[1]);
  }
  return tasks;
}
