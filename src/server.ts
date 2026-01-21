import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { CacheManager, DeviceStateManager, ProcessRunner } from "./services/index.js";
import { AdbAdapter, EmulatorAdapter, GradleAdapter, UiAutomatorAdapter } from "./adapters/index.js";

export interface ServerContext {
  cache: CacheManager;
  deviceState: DeviceStateManager;
  processRunner: ProcessRunner;
  adb: AdbAdapter;
  emulator: EmulatorAdapter;
  gradle: GradleAdapter;
  ui: UiAutomatorAdapter;
}

export function createServerContext(): ServerContext {
  const processRunner = new ProcessRunner();
  const adb = new AdbAdapter(processRunner);

  return {
    cache: new CacheManager(),
    deviceState: new DeviceStateManager(),
    processRunner,
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
    }
  );

  // Tool handlers will be registered here in subsequent tasks

  return server;
}

export async function runServer(): Promise<void> {
  const context = createServerContext();
  const server = await createServer(context);
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
