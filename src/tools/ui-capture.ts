import { z } from "zod";
import { ServerContext } from "../server.js";
import { UiConfig, ReplicantError, ErrorCode } from "../types/index.js";
import { DEFAULT_CONFIG } from "../types/config.js";

export const uiCaptureInputSchema = z.object({
  operation: z.enum(["screenshot", "visual-snapshot"]),
  localPath: z.string().optional(),
  inline: z.boolean().optional(),
  maxDimension: z.number().optional(),
  raw: z.boolean().optional(),
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
  const result = await context.ui.screenshot(deviceId, {
    localPath: input.localPath,
    inline: input.inline ?? false,
    maxDimension: input.maxDimension ?? config.maxImageDimension,
    raw: input.raw,
  });
  return { ...result, deviceId };
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
  inputSchema: {
    type: "object",
    properties: {
      operation: {
        type: "string",
        enum: ["screenshot", "visual-snapshot"],
      },
      localPath: { type: "string" },
      inline: { type: "boolean" },
      maxDimension: {
        type: "number",
        description: `Max image dimension in pixels (default: ${DEFAULT_CONFIG.ui.maxImageDimension}). Higher = better quality, more tokens.`,
      },
      raw: { type: "boolean", description: "Skip scaling, full device resolution." },
    },
    required: ["operation"],
  },
};
