import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { CacheManager, DeviceStateManager, ProcessRunner, EnvironmentService, ConfigManager } from "./services/index.js";
import { AdbAdapter, EmulatorAdapter, GradleAdapter, UiAutomatorAdapter } from "./adapters/index.js";
import { ReplicantError } from "./types/index.js";
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
  };
}

export async function createServer(context: ServerContext): Promise<Server> {
  const server = new Server(
    {
      name: "replicant-mcp",
      version: "1.0.0",
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

  // Register tool list handler
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
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
    ],
  }));

  // Register tool call handler
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    try {
      let result: Record<string, unknown>;

      switch (name) {
        case "cache":
          result = await handleCacheTool(args as Parameters<typeof handleCacheTool>[0], context.cache);
          break;
        case "rtfm":
          result = await handleRtfmTool(args as Parameters<typeof handleRtfmTool>[0]);
          break;
        case "adb-device":
          result = await handleAdbDeviceTool(args as Parameters<typeof handleAdbDeviceTool>[0], context);
          break;
        case "adb-app":
          result = await handleAdbAppTool(args as Parameters<typeof handleAdbAppTool>[0], context);
          break;
        case "adb-logcat":
          result = await handleAdbLogcatTool(args as Parameters<typeof handleAdbLogcatTool>[0], context);
          break;
        case "adb-shell":
          result = await handleAdbShellTool(args as Parameters<typeof handleAdbShellTool>[0], context);
          break;
        case "emulator-device":
          result = await handleEmulatorDeviceTool(args as Parameters<typeof handleEmulatorDeviceTool>[0], context);
          break;
        case "gradle-build":
          result = await handleGradleBuildTool(args as Parameters<typeof handleGradleBuildTool>[0], context);
          break;
        case "gradle-test":
          result = await handleGradleTestTool(args as Parameters<typeof handleGradleTestTool>[0], context);
          break;
        case "gradle-list":
          result = await handleGradleListTool(args as Parameters<typeof handleGradleListTool>[0], context);
          break;
        case "gradle-get-details":
          result = await handleGradleGetDetailsTool(args as Parameters<typeof handleGradleGetDetailsTool>[0], context);
          break;
        case "ui":
          result = await handleUiTool(args as Parameters<typeof handleUiTool>[0], context, context.config.getUiConfig());
          break;
        default:
          throw new Error(`Unknown tool: ${name}`);
      }

      // Return images as native MCP image content blocks for efficiency
      // (avoids Claude tokenizing base64 as text)
      if (result && typeof result === "object" && "base64" in result && "mimeType" in result) {
        const { base64, mimeType, ...metadata } = result as { base64: string; mimeType: string; [key: string]: unknown };
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
