import { z } from "zod";
import { ServerContext } from "../server.js";
import { UiConfig, ReplicantError, ErrorCode, CACHE_TTLS } from "../types/index.js";
import { DEFAULT_CONFIG } from "../types/config.js";
import { booleanInput, numberInput, toolSchema } from "../schemas/inputs.js";
import { toMcpJsonSchema } from "../schemas/derive.js";
import { getCurrentAppSafe } from "./util-current-app.js";

// THE-111: cached payload for a per-screenshot scaling lookup. Stored under
// the returned `screenshotId` so a follow-up `ui-action tap` can convert
// image-space coords against THIS screenshot's scaling, not whatever global
// adapter state happens to be in effect.
export interface ScreenshotScalingEntry {
  scaleFactor: number;
  deviceWidth: number;
  deviceHeight: number;
  imageWidth: number;
  imageHeight: number;
}

export const uiCaptureInputSchema = toolSchema({
  operation: z.enum(["screenshot", "visual-snapshot"]),
  localPath: z.string().optional(),
  inline: booleanInput().optional(),
  maxDimension: numberInput()
    .optional()
    .describe(
      `Max image dimension in pixels (default: ${DEFAULT_CONFIG.ui.maxImageDimension}). Higher = better quality, more tokens.`,
    ),
  raw: booleanInput().optional().describe("Skip scaling, full device resolution."),
});

export type UiCaptureInput = z.infer<typeof uiCaptureInputSchema>;

type OperationHandler = (
  input: UiCaptureInput,
  context: ServerContext,
  config: UiConfig,
  deviceId: string,
) => Promise<Record<string, unknown>>;

const operations: Record<string, OperationHandler> = {
  screenshot: handleScreenshot,
  "visual-snapshot": handleVisualSnapshot,
};

export async function handleUiCaptureTool(
  input: UiCaptureInput,
  context: ServerContext,
  uiConfig?: UiConfig,
): Promise<Record<string, unknown>> {
  const device = await context.deviceState.ensureDevice(context.adb);
  const config = uiConfig ?? DEFAULT_CONFIG.ui;

  const handler = operations[input.operation];
  if (!handler) {
    throw new ReplicantError(
      ErrorCode.INVALID_OPERATION,
      `Unknown operation: ${input.operation}`,
      "Valid operations: screenshot, visual-snapshot",
    );
  }
  return handler(input, context, config, device.id);
}

async function handleScreenshot(
  input: UiCaptureInput,
  context: ServerContext,
  config: UiConfig,
  deviceId: string,
): Promise<Record<string, unknown>> {
  const [result, app] = await Promise.all([
    context.ui.screenshot(deviceId, {
      localPath: input.localPath,
      inline: input.inline ?? false,
      maxDimension: input.maxDimension ?? config.maxImageDimension,
      raw: input.raw,
    }),
    getCurrentAppSafe(context, deviceId),
  ]);

  // THE-111: pin per-screenshot scaling under a stable id so a later
  // `ui-action tap` with image-space coords converts against THIS screenshot,
  // not the global adapter state (which the next screenshot would overwrite).
  const screenshotId = context.cache.generateId("screenshot");
  if (
    result.scaleFactor !== undefined &&
    result.device !== undefined &&
    result.image !== undefined
  ) {
    const entry: ScreenshotScalingEntry = {
      scaleFactor: result.scaleFactor,
      deviceWidth: result.device.width,
      deviceHeight: result.device.height,
      imageWidth: result.image.width,
      imageHeight: result.image.height,
    };
    context.cache.set(screenshotId, entry, "screenshot-scaling", CACHE_TTLS.SCREENSHOT_SCALING);
  }
  return { ...result, deviceId, app, screenshotId };
}

async function handleVisualSnapshot(
  input: UiCaptureInput,
  context: ServerContext,
  config: UiConfig,
  deviceId: string,
): Promise<Record<string, unknown>> {
  const snapshot = await context.ui.visualSnapshot(deviceId, {
    includeBase64: input.inline ?? config.includeBase64,
  });
  return { ...snapshot, deviceId };
}

export const uiCaptureToolDefinition = {
  name: "ui-capture",
  description: "Capture screenshots or visual snapshots.",
  inputSchema: toMcpJsonSchema(uiCaptureInputSchema),
  annotations: {
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: false,
    openWorldHint: false,
  },
};
