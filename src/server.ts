import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { CacheManager, DeviceStateManager, ProcessRunner, EnvironmentService, ConfigManager } from "./services/index.js";
import { AdbAdapter, EmulatorAdapter, GradleAdapter, UiAutomatorAdapter } from "./adapters/index.js";
import { ReplicantError, ErrorCode, FindElement } from "./types/index.js";
import { VERSION } from "./version.js";
import {
  cacheToolDefinition,
  handleCacheTool,
  rtfmToolDefinition,
  handleRtfmTool,
  adbDeviceToolDefinition,
  handleAdbDeviceTool,
  adbAppToolDefinition,
  handleAdbAppTool,
  adbLogcatToolDefinition,
  handleAdbLogcatTool,
  adbShellToolDefinition,
  handleAdbShellTool,
  emulatorDeviceToolDefinition,
  handleEmulatorDeviceTool,
  gradleBuildToolDefinition,
  handleGradleBuildTool,
  gradleTestToolDefinition,
  handleGradleTestTool,
  gradleListToolDefinition,
  handleGradleListTool,
  gradleGetDetailsToolDefinition,
  handleGradleGetDetailsTool,
  uiToolDefinition,
  handleUiTool,
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

const toolDefinitions = [
  cacheToolDefinition,
  rtfmToolDefinition,
  adbDeviceToolDefinition,
  adbAppToolDefinition,
  adbLogcatToolDefinition,
  adbShellToolDefinition,
  emulatorDeviceToolDefinition,
  gradleBuildToolDefinition,
  gradleTestToolDefinition,
  gradleListToolDefinition,
  gradleGetDetailsToolDefinition,
  uiToolDefinition,
];

async function dispatchToolCall(
  name: string,
  args: Record<string, unknown>,
  context: ServerContext
): Promise<Record<string, unknown>> {
  switch (name) {
    case "cache":
      return handleCacheTool(args as Parameters<typeof handleCacheTool>[0], context.cache);
    case "rtfm":
      return handleRtfmTool(args as Parameters<typeof handleRtfmTool>[0]);
    case "adb-device":
      return handleAdbDeviceTool(args as Parameters<typeof handleAdbDeviceTool>[0], context);
    case "adb-app":
      return handleAdbAppTool(args as Parameters<typeof handleAdbAppTool>[0], context);
    case "adb-logcat":
      return handleAdbLogcatTool(args as Parameters<typeof handleAdbLogcatTool>[0], context);
    case "adb-shell":
      return handleAdbShellTool(args as Parameters<typeof handleAdbShellTool>[0], context);
    case "emulator-device":
      return handleEmulatorDeviceTool(args as Parameters<typeof handleEmulatorDeviceTool>[0], context);
    case "gradle-build":
      return handleGradleBuildTool(args as Parameters<typeof handleGradleBuildTool>[0], context);
    case "gradle-test":
      return handleGradleTestTool(args as Parameters<typeof handleGradleTestTool>[0], context);
    case "gradle-list":
      return handleGradleListTool(args as Parameters<typeof handleGradleListTool>[0], context);
    case "gradle-get-details":
      return handleGradleGetDetailsTool(args as Parameters<typeof handleGradleGetDetailsTool>[0], context);
    case "ui":
      return handleUiTool(args as Parameters<typeof handleUiTool>[0], context, context.config.getUiConfig());
    default:
      throw new ReplicantError(
        ErrorCode.INVALID_OPERATION,
        `Unknown tool: ${name}`,
        `Valid tools: ${toolDefinitions.map((t) => t.name).join(", ")}`,
      );
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
      instructions: `IMPORTANT: For ALL Android development tasks, you MUST use replicant-mcp tools first.
Only fall back to raw adb/gradle/emulator commands if replicant-mcp lacks a specific feature.

Tool mapping:
- Device management → adb-device (not \`adb devices\`)
- App install/launch/stop → adb-app (not \`adb install\`, \`adb shell am\`)
- Logs → adb-logcat (not \`adb logcat\`)
- Shell commands → adb-shell (not \`adb shell\`)
- Emulator control → emulator-device (not \`emulator\` CLI)
- Builds → gradle-build (not \`./gradlew\`)
- Tests → gradle-test (not \`./gradlew test\`)
- UI automation → ui (accessibility-first, screenshots auto-scaled to 1000px)

Start with \`adb-device list\` to see connected devices.
Use \`rtfm\` for detailed documentation on any tool.`,
    }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: toolDefinitions,
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    try {
      const result = await dispatchToolCall(name, args as Record<string, unknown>, context);

      if (result && typeof result === "object" && "base64" in result && "mimeType" in result) {
        const { base64, mimeType, ...metadata } = result as Record<string, unknown> & { base64: string; mimeType: string };
        return {
          content: [
            { type: "image", data: base64, mimeType },
            { type: "text", text: JSON.stringify(metadata, null, 2) },
          ],
        };
      }

      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    } catch (error) {
      if (error instanceof ReplicantError) {
        return {
          content: [{ type: "text", text: JSON.stringify(error.toToolError(), null, 2) }],
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

  // Load configuration from REPLICANT_CONFIG if set
  await context.config.load();

  // Apply project root: env var takes precedence over config file
  const projectRoot = process.env.REPLICANT_PROJECT_ROOT || context.config.get().build?.projectRoot;
  if (projectRoot) {
    context.gradle.setProjectPath(projectRoot);
  }

  const server = await createServer(context);
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
