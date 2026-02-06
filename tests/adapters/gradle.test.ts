import { describe, it, expect, vi } from "vitest";
import { parseBuildOutput, parseTestOutput, parseModuleList } from "../../src/parsers/gradle-output.js";
import { GradleAdapter } from "../../src/adapters/gradle.js";
import { ProcessRunner } from "../../src/services/process-runner.js";
import { ReplicantError } from "../../src/types/errors.js";

const expectedGradleCmd = process.platform === "win32" ? "gradlew.bat" : "./gradlew";

describe("GradleAdapter", () => {
  describe("setProjectPath", () => {
    it("changes the cwd used for gradle commands", async () => {
      const mockRunner = {
        run: vi.fn().mockResolvedValue({
          stdout: "BUILD SUCCESSFUL in 5s\n1 actionable task: 1 executed",
          stderr: "",
          exitCode: 0,
        }),
      } as unknown as ProcessRunner;

      const adapter = new GradleAdapter(mockRunner);
      adapter.setProjectPath("/home/user/my-android-project");

      await adapter.clean();

      expect(mockRunner.run).toHaveBeenCalledWith(
        expectedGradleCmd,
        ["clean"],
        expect.objectContaining({ cwd: "/home/user/my-android-project" })
      );
    });

    it("overrides the initial projectPath", async () => {
      const mockRunner = {
        run: vi.fn().mockResolvedValue({
          stdout: "BUILD SUCCESSFUL in 5s\n1 actionable task: 1 executed",
          stderr: "",
          exitCode: 0,
        }),
      } as unknown as ProcessRunner;

      const adapter = new GradleAdapter(mockRunner, "/original/path");
      adapter.setProjectPath("/new/path");

      await adapter.clean();

      expect(mockRunner.run).toHaveBeenCalledWith(
        expectedGradleCmd,
        ["clean"],
        expect.objectContaining({ cwd: "/new/path" })
      );
    });
  });

  describe("error handling", () => {
    it("mentions REPLICANT_PROJECT_ROOT when gradlew not found", async () => {
      const mockRunner = {
        run: vi.fn().mockRejectedValue(new Error("ENOENT: no such file or directory")),
      } as unknown as ProcessRunner;

      const adapter = new GradleAdapter(mockRunner);

      try {
        await adapter.clean();
        expect.unreachable("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(ReplicantError);
        const replicantError = error as ReplicantError;
        expect(replicantError.suggestion).toContain("REPLICANT_PROJECT_ROOT");
        expect(replicantError.suggestion).toContain("build.projectRoot");
      }
    });
  });
});

describe("Gradle Output Parsing", () => {
  describe("parseBuildOutput", () => {
    it("parses successful build", () => {
      const output = `> Task :app:assembleDebug

BUILD SUCCESSFUL in 47s
42 actionable tasks: 42 executed
`;
      const result = parseBuildOutput(output);
      expect(result.success).toBe(true);
      expect(result.duration).toBe("47s");
      expect(result.tasksExecuted).toBe(42);
    });

    it("parses failed build", () => {
      const output = `> Task :app:compileDebugKotlin FAILED

FAILURE: Build failed with an exception.

* What went wrong:
Execution failed for task ':app:compileDebugKotlin'.

BUILD FAILED in 12s
`;
      const result = parseBuildOutput(output);
      expect(result.success).toBe(false);
      expect(result.failedTask).toBe(":app:compileDebugKotlin");
    });

    it("counts warnings", () => {
      const output = `w: Some warning here
w: Another warning
BUILD SUCCESSFUL in 5s
`;
      const result = parseBuildOutput(output);
      expect(result.warnings).toBe(2);
    });
  });

  describe("parseTestOutput", () => {
    it("parses test results", () => {
      const output = `> Task :app:testDebugUnitTest

com.example.MyTest > testSomething PASSED
com.example.MyTest > testAnother PASSED
com.example.MyTest > testFailing FAILED

3 tests completed, 1 failed
`;
      const result = parseTestOutput(output);
      expect(result.passed).toBe(2);
      expect(result.failed).toBe(1);
      expect(result.total).toBe(3);
    });
  });

  describe("parseModuleList", () => {
    it("parses project list", () => {
      const output = `
Root project 'MyApp'
+--- Project ':app'
+--- Project ':core'
\\--- Project ':feature:login'
`;
      const modules = parseModuleList(output);
      expect(modules).toEqual([":app", ":core", ":feature:login"]);
    });
  });
});
