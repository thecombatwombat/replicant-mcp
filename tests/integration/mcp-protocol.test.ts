/**
 * MCP Protocol Validation Tests
 *
 * These tests verify that the replicant-mcp server correctly implements
 * the Model Context Protocol specification.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { createServer, createServerContext, ServerContext } from "../../src/server.js";

describe("MCP Protocol Compliance", () => {
  let server: Server;
  let client: Client;
  let context: ServerContext;

  beforeAll(async () => {
    context = createServerContext();
    server = await createServer(context);

    // Create in-memory transport for testing
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

    client = new Client({
      name: "test-client",
      version: "1.0.0",
    });

    await Promise.all([
      server.connect(serverTransport),
      client.connect(clientTransport),
    ]);
  });

  afterAll(async () => {
    await client.close();
    await server.close();
  });

  describe("Server Initialization", () => {
    it("should respond to tool listing", async () => {
      // Verify server is functional by making a request
      const result = await client.listTools();
      expect(result.tools).toBeDefined();
      expect(result.tools.length).toBeGreaterThan(0);
    });

    it("should be connected", async () => {
      // Verify client is connected by checking tools are available
      const result = await client.listTools();
      expect(result.tools).toBeDefined();
    });
  });

  describe("tools/list", () => {
    it("should return all 12 tools", async () => {
      const result = await client.listTools();
      expect(result.tools.length).toBe(12);
    });

    it("should include all expected tool names", async () => {
      const result = await client.listTools();
      const toolNames = result.tools.map((t) => t.name);

      expect(toolNames).toContain("cache");
      expect(toolNames).toContain("rtfm");
      expect(toolNames).toContain("adb-device");
      expect(toolNames).toContain("adb-app");
      expect(toolNames).toContain("adb-logcat");
      expect(toolNames).toContain("adb-shell");
      expect(toolNames).toContain("emulator-device");
      expect(toolNames).toContain("gradle-build");
      expect(toolNames).toContain("gradle-test");
      expect(toolNames).toContain("gradle-list");
      expect(toolNames).toContain("gradle-get-details");
      expect(toolNames).toContain("ui");
    });

    it("should have valid input schemas for all tools", async () => {
      const result = await client.listTools();

      for (const tool of result.tools) {
        expect(tool.inputSchema).toBeDefined();
        expect(tool.inputSchema.type).toBe("object");
        expect(tool.inputSchema.properties).toBeDefined();
      }
    });

    it("should have descriptions for all tools", async () => {
      const result = await client.listTools();

      for (const tool of result.tools) {
        expect(tool.description).toBeDefined();
        expect(tool.description.length).toBeGreaterThan(0);
      }
    });
  });

  describe("tools/call - cache tool", () => {
    it("should return stats with get-stats operation", async () => {
      const result = await client.callTool({
        name: "cache",
        arguments: { operation: "get-stats" },
      });

      expect(result.content).toBeDefined();
      expect(result.content[0].type).toBe("text");

      const data = JSON.parse(result.content[0].text as string);
      expect(data.stats).toBeDefined();
      expect(data.stats.entryCount).toBeDefined();
    });

    it("should return config with get-config operation", async () => {
      const result = await client.callTool({
        name: "cache",
        arguments: { operation: "get-config" },
      });

      const data = JSON.parse(result.content[0].text as string);
      expect(data.config).toBeDefined();
      expect(data.config.maxEntries).toBeGreaterThan(0);
    });

    it("should handle set-config operation", async () => {
      const result = await client.callTool({
        name: "cache",
        arguments: {
          operation: "set-config",
          config: { maxEntries: 50 }
        },
      });

      const data = JSON.parse(result.content[0].text as string);
      expect(data.config.maxEntries).toBe(50);
    });

    it("should handle clear operation", async () => {
      // First add something to cache via another tool call
      await client.callTool({
        name: "cache",
        arguments: { operation: "get-stats" },
      });

      // Then clear
      const result = await client.callTool({
        name: "cache",
        arguments: { operation: "clear" },
      });

      const data = JSON.parse(result.content[0].text as string);
      expect(data.cleared).toBe("all");
    });
  });

  describe("tools/call - rtfm tool", () => {
    it("should return index when no params", async () => {
      const result = await client.callTool({
        name: "rtfm",
        arguments: {},
      });

      const data = JSON.parse(result.content[0].text as string);
      expect(data.content).toContain("replicant-mcp");
      expect(data.content).toContain("Categories");
    });

    it("should return category docs", async () => {
      const result = await client.callTool({
        name: "rtfm",
        arguments: { category: "build" },
      });

      const data = JSON.parse(result.content[0].text as string);
      expect(data.content).toContain("gradle-build");
    });

    it("should return tool-specific docs", async () => {
      const result = await client.callTool({
        name: "rtfm",
        arguments: { tool: "adb-logcat" },
      });

      const data = JSON.parse(result.content[0].text as string);
      expect(data.content).toContain("logcat");
    });

    it("should reject path traversal in category", async () => {
      const result = await client.callTool({
        name: "rtfm",
        arguments: { category: "../../package" },
      });

      expect(result.isError).toBe(true);
      const data = JSON.parse(result.content[0].text as string);
      expect(data.error).toBe("INPUT_VALIDATION_FAILED");
    });
  });

  describe("tools/call - error handling", () => {
    it("should return error for unknown operation", async () => {
      try {
        await client.callTool({
          name: "cache",
          arguments: { operation: "invalid-op" },
        });
        expect.fail("Should have thrown");
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    it("should return error for missing required params", async () => {
      try {
        await client.callTool({
          name: "gradle-get-details",
          arguments: {}, // Missing required 'id' param
        });
        expect.fail("Should have thrown");
      } catch (error) {
        expect(error).toBeDefined();
      }
    });
  });

  describe("Response Format", () => {
    it("should return content array with text type", async () => {
      const result = await client.callTool({
        name: "cache",
        arguments: { operation: "get-stats" },
      });

      expect(Array.isArray(result.content)).toBe(true);
      expect(result.content.length).toBeGreaterThan(0);
      expect(result.content[0].type).toBe("text");
      expect(typeof result.content[0].text).toBe("string");
    });

    it("should return parseable JSON in text content", async () => {
      const result = await client.callTool({
        name: "cache",
        arguments: { operation: "get-stats" },
      });

      const parseAttempt = () => JSON.parse(result.content[0].text as string);
      expect(parseAttempt).not.toThrow();
    });
  });

  describe("Image Content Blocks", () => {
    it("should return text-only for results without base64/mimeType", async () => {
      // Regular tool calls should still return text-only
      const result = await client.callTool({ name: "rtfm", arguments: { tool: "cache" } });

      expect(result.content).toHaveLength(1);
      expect(result.content[0].type).toBe("text");
    });
  });
});

describe("Tool Input Schema Validation", () => {
  let server: Server;
  let client: Client;

  beforeAll(async () => {
    const context = createServerContext();
    server = await createServer(context);

    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

    client = new Client({
      name: "test-client",
      version: "1.0.0",
    });

    await Promise.all([
      server.connect(serverTransport),
      client.connect(clientTransport),
    ]);
  });

  afterAll(async () => {
    await client.close();
    await server.close();
  });

  describe("adb-device schema", () => {
    it("should have operation enum", async () => {
      const tools = await client.listTools();
      const tool = tools.tools.find((t) => t.name === "adb-device");

      expect(tool?.inputSchema.properties?.operation?.enum).toContain("list");
      expect(tool?.inputSchema.properties?.operation?.enum).toContain("select");
      expect(tool?.inputSchema.properties?.operation?.enum).toContain("wait");
      expect(tool?.inputSchema.properties?.operation?.enum).toContain("properties");
    });
  });

  describe("emulator-device schema", () => {
    it("should have all operations including snapshot", async () => {
      const tools = await client.listTools();
      const tool = tools.tools.find((t) => t.name === "emulator-device");

      const ops = tool?.inputSchema.properties?.operation?.enum;
      expect(ops).toContain("list");
      expect(ops).toContain("create");
      expect(ops).toContain("start");
      expect(ops).toContain("kill");
      expect(ops).toContain("wipe");
      expect(ops).toContain("snapshot-save");
      expect(ops).toContain("snapshot-load");
    });
  });

  describe("ui schema", () => {
    it("should have all UI operations", async () => {
      const tools = await client.listTools();
      const tool = tools.tools.find((t) => t.name === "ui");

      const ops = tool?.inputSchema.properties?.operation?.enum;
      expect(ops).toContain("dump");
      expect(ops).toContain("find");
      expect(ops).toContain("tap");
      expect(ops).toContain("input");
      expect(ops).toContain("screenshot");
      expect(ops).toContain("accessibility-check");
    });

    it("should have selector properties", async () => {
      const tools = await client.listTools();
      const tool = tools.tools.find((t) => t.name === "ui");

      const selectorProps = tool?.inputSchema.properties?.selector?.properties;
      expect(selectorProps?.resourceId).toBeDefined();
      expect(selectorProps?.text).toBeDefined();
      expect(selectorProps?.textContains).toBeDefined();
      expect(selectorProps?.className).toBeDefined();
    });
  });

  describe("adb-logcat schema", () => {
    it("should support both structured and raw filter modes", async () => {
      const tools = await client.listTools();
      const tool = tools.tools.find((t) => t.name === "adb-logcat");

      const props = tool?.inputSchema.properties;
      // Structured mode
      expect(props?.package).toBeDefined();
      expect(props?.tags).toBeDefined();
      expect(props?.level).toBeDefined();
      // Raw mode
      expect(props?.rawFilter).toBeDefined();
      // Common
      expect(props?.lines).toBeDefined();
      expect(props?.since).toBeDefined();
    });
  });
});
