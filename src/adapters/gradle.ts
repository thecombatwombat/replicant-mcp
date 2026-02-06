import { ProcessRunner } from "../services/index.js";
import { ReplicantError, ErrorCode } from "../types/index.js";
import {
  parseBuildOutput,
  parseTestOutput,
  parseModuleList,
  parseVariantList,
  parseTaskList,
  BuildResult,
  TestResult,
  VariantInfo,
} from "../parsers/gradle-output.js";

export class GradleAdapter {
  constructor(
    private runner: ProcessRunner = new ProcessRunner(),
    private projectPath?: string
  ) {}

  setProjectPath(path: string): void {
    this.projectPath = path;
  }

  async build(
    operation: "assembleDebug" | "assembleRelease" | "bundle",
    module?: string,
    flavor?: string
  ): Promise<{ result: BuildResult; fullOutput: string }> {
    const task = module ? `${module}:${operation}` : operation;
    const args = [task];

    if (flavor) {
      args.push(`-Pflavor=${flavor}`);
    }

    const result = await this.gradle(args, 300000); // 5 min timeout for builds
    const parsed = parseBuildOutput(result.stdout + result.stderr);

    if (!parsed.success) {
      throw new ReplicantError(
        ErrorCode.BUILD_FAILED,
        `Build failed: ${parsed.failedTask || "unknown error"}`,
        "Check gradle-get-details for full error output",
        { buildResult: { ...parsed } }
      );
    }

    return { result: parsed, fullOutput: result.stdout + result.stderr };
  }

  async test(
    operation: "unitTest" | "connectedTest",
    module?: string,
    filter?: string
  ): Promise<{ result: TestResult; fullOutput: string }> {
    const taskName = operation === "unitTest" ? "testDebugUnitTest" : "connectedDebugAndroidTest";
    const task = module ? `${module}:${taskName}` : taskName;
    const args = [task];

    if (filter) {
      args.push("--tests", filter);
    }

    const result = await this.gradle(args, 600000); // 10 min timeout for tests
    const parsed = parseTestOutput(result.stdout + result.stderr);

    return { result: parsed, fullOutput: result.stdout + result.stderr };
  }

  async listModules(): Promise<string[]> {
    const result = await this.gradle(["projects"]);
    return parseModuleList(result.stdout);
  }

  async listVariants(module?: string): Promise<VariantInfo[]> {
    // Try to get variants - this varies by project setup
    const task = module ? `${module}:printVariants` : "printVariants";
    try {
      const result = await this.gradle([task]);
      return parseVariantList(result.stdout);
    } catch {
      // Fallback: return common defaults
      return [
        { name: "debug", buildType: "debug", flavors: [] },
        { name: "release", buildType: "release", flavors: [] },
      ];
    }
  }

  async listTasks(module?: string): Promise<string[]> {
    const args = module ? [`${module}:tasks`, "--all"] : ["tasks", "--all"];
    const result = await this.gradle(args);
    return parseTaskList(result.stdout);
  }

  async clean(stopDaemons = false): Promise<void> {
    await this.gradle(["clean"]);
    if (stopDaemons) {
      await this.gradle(["--stop"]);
    }
  }

  private async gradle(
    args: string[],
    timeoutMs = 120000
  ): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    const gradleCmd = process.platform === "win32" ? "gradlew.bat" : "./gradlew";

    try {
      return await this.runner.run(gradleCmd, args, {
        timeoutMs,
        cwd: this.projectPath,
      });
    } catch (error) {
      if (error instanceof Error && error.message.includes("ENOENT")) {
        throw new ReplicantError(
          ErrorCode.GRADLE_NOT_FOUND,
          "Gradle wrapper not found",
          "Set REPLICANT_PROJECT_ROOT to your Android project directory, " +
          "or add build.projectRoot to your config file. " +
          "See: https://github.com/thecombatwombat/replicant-mcp#configuration"
        );
      }
      throw error;
    }
  }
}
