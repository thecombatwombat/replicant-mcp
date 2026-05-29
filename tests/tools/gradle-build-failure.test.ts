import { describe, it, expect, vi } from "vitest";
import { handleGradleBuildTool } from "../../src/tools/gradle-build.js";
import { handleGradleGetDetailsTool } from "../../src/tools/gradle-get-details.js";
import { CacheManager } from "../../src/services/index.js";
import { ReplicantError, ErrorCode } from "../../src/types/errors.js";
import { ServerContext } from "../../src/server.js";

const FAILED_OUTPUT = [
  "> Task :app:compileDjborzeDebugKotlin FAILED",
  "e: file:///app/src/main/java/Foo.kt:12:34 Unresolved reference: bar",
  "BUILD FAILED in 2s",
].join("\n");

function contextWithFailingBuild(cache: CacheManager): ServerContext {
  return {
    gradle: {
      build: vi.fn().mockRejectedValue(
        new ReplicantError(
          ErrorCode.BUILD_FAILED,
          "Build failed: :app:compileDjborzeDebugKotlin",
          "Check gradle-get-details for full error output",
          {
            buildResult: { success: false, failedTask: ":app:compileDjborzeDebugKotlin", errors: 1 },
            fullOutput: FAILED_OUTPUT,
          }
        )
      ),
    },
    cache,
  } as unknown as ServerContext;
}

describe("gradle-build failure caching", () => {
  it("caches a failed build under a buildId and rethrows BUILD_FAILED with that id", async () => {
    const cache = new CacheManager();
    const context = contextWithFailingBuild(cache);

    const error = await handleGradleBuildTool(
      { operation: "assembleDebug", flavor: "djborze" },
      context
    ).catch((e) => e);

    expect(error).toBeInstanceOf(ReplicantError);
    expect(error.code).toBe(ErrorCode.BUILD_FAILED);
    expect(error.context?.buildId).toBeDefined();
    // The bulky output must NOT be inlined in the rethrown error.
    expect(error.context?.fullOutput).toBeUndefined();
  });

  it("makes the failed build's errors retrievable via gradle-get-details", async () => {
    const cache = new CacheManager();
    const context = contextWithFailingBuild(cache);

    const error = await handleGradleBuildTool(
      { operation: "assembleDebug", flavor: "djborze" },
      context
    ).catch((e) => e);

    const buildId = error.context.buildId as string;
    const details = await handleGradleGetDetailsTool(
      { id: buildId, detailType: "errors" },
      context
    );

    expect(details.detailType).toBe("errors");
    expect(String(details.errors)).toContain("Unresolved reference: bar");
  });
});
