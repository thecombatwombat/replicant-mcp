import { z } from "zod";
import { ServerContext } from "../server.js";
import { ReplicantError, ErrorCode } from "../types/index.js";
import { getElementCenter } from "./ui-find.js";
import { booleanInput, numberInput, toolSchema } from "../schemas/inputs.js";
import { toMcpJsonSchema } from "../schemas/derive.js";

export const uiActionInputSchema = toolSchema({
  operation: z.enum(["tap", "input", "scroll"]),
  x: numberInput().optional(),
  y: numberInput().optional(),
  elementIndex: numberInput().optional(),
  text: z.string().optional(),
  direction: z.enum(["up", "down", "left", "right"]).optional(),
  amount: numberInput({ min: 0, max: 1 })
    .optional()
    .describe("Scroll fraction (0-1, default: 0.5)"),
  deviceSpace: booleanInput()
    .optional()
    .describe(
      "x/y are device-space coords (default: true, matches ui-query dump output). " +
      "Set false only when passing image-space coords read from a screenshot overlay.",
    ),
});

export type UiActionInput = z.infer<typeof uiActionInputSchema>;

type OperationHandler = (
  input: UiActionInput,
  context: ServerContext,
  deviceId: string,
) => Promise<Record<string, unknown>>;

const operations: Record<string, OperationHandler> = {
  tap: handleTap,
  input: handleInput,
  scroll: handleScroll,
};

export async function handleUiActionTool(
  input: UiActionInput,
  context: ServerContext,
): Promise<Record<string, unknown>> {
  const device = await context.deviceState.ensureDevice(context.adb);

  const handler = operations[input.operation];
  if (!handler) {
    throw new ReplicantError(
      ErrorCode.INVALID_OPERATION,
      `Unknown operation: ${input.operation}`,
      "Valid operations: tap, input, scroll",
    );
  }
  return handler(input, context, device.id);
}

async function handleTap(
  input: UiActionInput,
  context: ServerContext,
  deviceId: string,
): Promise<Record<string, unknown>> {
  let x: number, y: number;

  if (input.elementIndex !== undefined) {
    if (!context.lastFindResults[input.elementIndex]) {
      throw new ReplicantError(
        ErrorCode.ELEMENT_NOT_FOUND,
        `Element at index ${input.elementIndex} not found. Run 'find' first.`,
        "Use ui-query find to locate elements, then reference them by index",
      );
    }
    const element = context.lastFindResults[input.elementIndex];
    const center = getElementCenter(element);
    x = center.x;
    y = center.y;
  } else if (input.x !== undefined && input.y !== undefined) {
    x = input.x;
    y = input.y;
  } else {
    throw new ReplicantError(
      ErrorCode.INPUT_VALIDATION_FAILED,
      "Either x/y coordinates or elementIndex is required for tap",
      "Provide x and y coordinates, or use elementIndex from a previous ui-query find result",
    );
  }

  const deviceSpace = input.deviceSpace ?? true;
  await context.ui.tap(deviceId, x, y, deviceSpace);
  return { tapped: { x, y, deviceSpace }, deviceId };
}

async function handleInput(
  input: UiActionInput,
  context: ServerContext,
  deviceId: string,
): Promise<Record<string, unknown>> {
  if (!input.text) {
    throw new ReplicantError(
      ErrorCode.INPUT_VALIDATION_FAILED,
      "text is required for input operation",
      "Provide the text string to input",
    );
  }
  await context.ui.input(deviceId, input.text);
  return { input: input.text, deviceId };
}

async function handleScroll(
  input: UiActionInput,
  context: ServerContext,
  deviceId: string,
): Promise<Record<string, unknown>> {
  if (!input.direction) {
    throw new ReplicantError(
      ErrorCode.INPUT_VALIDATION_FAILED,
      "direction is required for scroll operation",
      "Provide a direction: up, down, left, or right",
    );
  }
  const amount = input.amount ?? 0.5;
  await context.ui.scroll(deviceId, input.direction, amount);
  return { scrolled: { direction: input.direction, amount }, deviceId };
}

export const uiActionToolDefinition = {
  name: "ui-action",
  description: "Interact with app UI: tap, input, scroll.",
  inputSchema: toMcpJsonSchema(uiActionInputSchema),
  annotations: {
    readOnlyHint: false,
    destructiveHint: true,
    idempotentHint: false,
    openWorldHint: false,
  },
};
