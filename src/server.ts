import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { ZodError } from "zod";
import { CacheManager, DeviceStateManager, ProcessRunner, EnvironmentService, ConfigManager } from "./services/index.js";
import { AdbAdapter, EmulatorAdapter, GradleAdapter, UiAutomatorAdapter } from "./adapters/index.js";
import { ReplicantError, FindElement, ErrorCode } from "./types/index.js";
import { VERSION } from "./version.js";
import {
  ALL_TOOL_DEFINITIONS,
  cacheInputSchema,
  handleCacheTool,
  rtfmInputSchema,
  handleRtfmTool,
  adbDeviceInputSchema,
  handleAdbDeviceTool,
  adbAppInputSchema,
  handleAdbAppTool,
  adbLogcatInputSchema,
  handleAdbLogcatTool,
  adbShellInputSchema,
  handleAdbShellTool,
  emulatorDeviceInputSchema,
  handleEmulatorDeviceTool,
  gradleBuildInputSchema,
  handleGradleBuildTool,
  gradleTestInputSchema,
  handleGradleTestTool,
  gradleListInputSchema,
  handleGradleListTool,
  gradleGetDetailsInputSchema,
  handleGradleGetDetailsTool,
  uiQueryInputSchema,
  handleUiQueryTool,
  uiActionInputSchema,
  handleUiActionTool,
  uiCaptureInputSchema,
  handleUiCaptureTool,
} from "./tools/index.js";

export interface ServerContext {
  cache: CacheManager;
  deviceState: DeviceStateManager;
  processRunner: ProcessRunner;
  environment: EnvironmentService;
  config: ConfigManager;
  adb: AdbAdapter;
  emulator: EmulatorAdapter;
  gradle: GradleAdapter;
  ui: UiAutomatorAdapter;
  lastFindResults: FindElement[];
}

export function createServerContext(): ServerContext {
  const environment = new EnvironmentService();
  const processRunner = new ProcessRunner(environment);
  const adb = new AdbAdapter(processRunner);

  return {
    cache: new CacheManager(),
    deviceState: new DeviceStateManager(),
    processRunner,
    environment,
    config: new ConfigManager(),
    adb,
    emulator: new EmulatorAdapter(processRunner),
    gradle: new GradleAdapter(processRunner),
    ui: new UiAutomatorAdapter(adb),
    lastFindResults: [],
  };
}

const toolDefinitions = ALL_TOOL_DEFINITIONS;

async function dispatchToolCall(
  name: string,
  args: Record<string, unknown> | undefined,
  context: ServerContext
): Promise<Record<string, unknown>> {
  const rawArgs = args ?? {};

  const parseOrThrow = <T>(toolName: string, parser: { parse: (data: unknown) => T }): T => {
    try {
      return parser.parse(rawArgs);
    } catch (error) {
      if (error instanceof ZodError) {
        const message = error.issues
          .map((issue) => {
            const path = issue.path.length > 0 ? issue.path.join(".") : "input";
            return `${path}: ${issue.message}`;
          })
          .join("; ");

        throw new ReplicantError(
          ErrorCode.INPUT_VALIDATION_FAILED,
          `Invalid input for ${toolName}: ${message}`,
          "Check the tool input schema and provide valid arguments",
        );
      }

      throw error;
    }
  };

  switch (name) {
    case "cache":
      return handleCacheTool(parseOrThrow("cache", cacheInputSchema), context.cache);
    case "rtfm":
      return handleRtfmTool(parseOrThrow("rtfm", rtfmInputSchema));
    case "adb-device":
      return handleAdbDeviceTool(parseOrThrow("adb-device", adbDeviceInputSchema), context);
    case "adb-app":
      return handleAdbAppTool(parseOrThrow("adb-app", adbAppInputSchema), context);
    case "adb-logcat":
      return handleAdbLogcatTool(parseOrThrow("adb-logcat", adbLogcatInputSchema), context);
    case "adb-shell":
      return handleAdbShellTool(parseOrThrow("adb-shell", adbShellInputSchema), context);
    case "emulator-device":
      return handleEmulatorDeviceTool(parseOrThrow("emulator-device", emulatorDeviceInputSchema), context);
    case "gradle-build":
      return handleGradleBuildTool(parseOrThrow("gradle-build", gradleBuildInputSchema), context);
    case "gradle-test":
      return handleGradleTestTool(parseOrThrow("gradle-test", gradleTestInputSchema), context);
    case "gradle-list":
      return handleGradleListTool(parseOrThrow("gradle-list", gradleListInputSchema), context);
    case "gradle-get-details":
      return handleGradleGetDetailsTool(parseOrThrow("gradle-get-details", gradleGetDetailsInputSchema), context);
    case "ui-query":
      return handleUiQueryTool(parseOrThrow("ui-query", uiQueryInputSchema), context, context.config.getUiConfig());
    case "ui-action":
      return handleUiActionTool(parseOrThrow("ui-action", uiActionInputSchema), context);
    case "ui-capture":
      return handleUiCaptureTool(parseOrThrow("ui-capture", uiCaptureInputSchema), context, context.config.getUiConfig());
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

export async function createServer(context: ServerContext): Promise<Server> {
  const server = new Server(
    {
      name: "replicant-mcp",
      version: VERSION,
    },
    {
      capabilities: {
        tools: {},
      },
      instructions: `Use these tools for Android — never raw adb/gradle/emulator commands. Auto-selects single device. Start: \`adb-device list\`. Docs: \`rtfm\`.`,
    }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: toolDefinitions,
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    try {
      const result = await dispatchToolCall(name, args as Record<string, unknown> | undefined, context);

      if (result && typeof result === "object" && "base64" in result && "mimeType" in result) {
        const { base64, mimeType, ...metadata } = result as Record<string, unknown> & { base64: string; mimeType: string };
        return {
          content: [
            { type: "image", data: base64, mimeType },
            { type: "text", text: JSON.stringify(metadata) },
          ],
        };
      }

      return {
        content: [{ type: "text", text: JSON.stringify(result) }],
      };
    } catch (error) {
      if (error instanceof ReplicantError) {
        return {
          content: [{ type: "text", text: JSON.stringify(error.toToolError()) }],
          isError: true,
        };
      }
      throw error;
    }
  });

  return server;
}

export async function runServer(): Promise<void> {
  const context = createServerContext();

  await context.config.load();

  const projectRoot = process.env.REPLICANT_PROJECT_ROOT || context.config.get().build?.projectRoot;
  if (projectRoot) {
    context.gradle.setProjectPath(projectRoot);
  }

  const server = await createServer(context);
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
