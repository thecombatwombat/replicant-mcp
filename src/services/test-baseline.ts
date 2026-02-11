import * as fs from "fs";
import * as path from "path";
import * as os from "os";

export interface BaselineTestResult {
  test: string;
  status: "pass" | "fail" | "skip";
}

export interface TestBaseline {
  savedAt: string;
  task: string;
  results: BaselineTestResult[];
}

export interface Regression {
  test: string;
  previousStatus: string;
  currentStatus: string;
}

function getBaselineDir(): string {
  const base = process.cwd() === "/" ? os.homedir() : process.cwd();
  return path.join(base, ".replicant", "test-baselines");
}

function getBaselinePath(taskName: string): string {
  const safe = taskName.replace(/[^a-zA-Z0-9_-]/g, "_");
  return path.join(getBaselineDir(), `${safe}.json`);
}

export function saveBaseline(taskName: string, results: BaselineTestResult[]): void {
  const dir = getBaselineDir();
  fs.mkdirSync(dir, { recursive: true });
  const baseline: TestBaseline = {
    savedAt: new Date().toISOString(),
    task: taskName,
    results,
  };
  fs.writeFileSync(getBaselinePath(taskName), JSON.stringify(baseline, null, 2));
}

export function loadBaseline(taskName: string): TestBaseline | null {
  const filePath = getBaselinePath(taskName);
  if (!fs.existsSync(filePath)) return null;
  const content = fs.readFileSync(filePath, "utf-8");
  return JSON.parse(content) as TestBaseline;
}

export function clearBaseline(taskName: string): void {
  const filePath = getBaselinePath(taskName);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
}

export function compareResults(baseline: TestBaseline, current: BaselineTestResult[]): Regression[] {
  const currentMap = new Map(current.map(r => [r.test, r.status]));
  const regressions: Regression[] = [];

  for (const prev of baseline.results) {
    if (prev.status === "pass") {
      const currentStatus = currentMap.get(prev.test);
      if (currentStatus && currentStatus !== "pass") {
        regressions.push({
          test: prev.test,
          previousStatus: prev.status,
          currentStatus,
        });
      }
    }
  }

  return regressions;
}
