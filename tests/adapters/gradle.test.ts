import { describe, it, expect } from "vitest";
import { parseBuildOutput, parseTestOutput, parseModuleList } from "../../src/parsers/gradle-output.js";

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
