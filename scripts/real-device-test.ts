/**
 * Real Device Integration Test
 *
 * Tests the MCP server against actual Android SDK tools and a real emulator.
 * Requires: ANDROID_HOME set, adb in PATH, running emulator or connected device
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { createServer, createServerContext } from "../src/server.js";

async function runTests() {
  console.log("🤖 Real Device Integration Test\n");
  console.log("=".repeat(50));

  // Setup
  const context = createServerContext();
  const server = await createServer(context);
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

  const client = new Client({
    name: "real-device-test",
    version: "1.0.0",
  });

  await Promise.all([
    server.connect(serverTransport),
    client.connect(clientTransport),
  ]);

  console.log("✅ Server connected\n");

  let passed = 0;
  let failed = 0;

  // Helper
  async function test(name: string, fn: () => Promise<void>) {
    process.stdout.write(`Testing: ${name}... `);
    try {
      await fn();
      console.log("✅ PASS");
      passed++;
    } catch (error) {
      console.log("❌ FAIL");
      console.log(`   Error: ${error instanceof Error ? error.message : error}`);
      failed++;
    }
  }

  // Test 1: adb-device list
  await test("adb-device list", async () => {
    const result = await client.callTool({
      name: "adb-device",
      arguments: { operation: "list" },
    });
    const data = JSON.parse(result.content[0].text as string);
    if (!data.devices || !Array.isArray(data.devices)) {
      throw new Error("Expected devices array");
    }
    console.log(`\n   Found ${data.devices.length} device(s)`);
    if (data.devices.length > 0) {
      console.log(`   First device: ${data.devices[0].id} (${data.devices[0].state})`);
    }
  });

  // Test 2: adb-device select
  await test("adb-device select", async () => {
    const result = await client.callTool({
      name: "adb-device",
      arguments: { operation: "select", deviceId: "emulator-5554" },
    });
    const data = JSON.parse(result.content[0].text as string);
    if (!data.selected || data.selected.id !== "emulator-5554") {
      throw new Error(`Expected selected.id=emulator-5554, got ${JSON.stringify(data.selected)}`);
    }
    console.log(`\n   Selected: ${data.selected.id}`);
  });

  // Test 3: adb-device properties
  await test("adb-device properties", async () => {
    const result = await client.callTool({
      name: "adb-device",
      arguments: { operation: "properties" },
    });
    const data = JSON.parse(result.content[0].text as string);
    if (!data.properties) {
      throw new Error("Expected properties object");
    }
    console.log(`\n   SDK: ${data.properties.sdkVersion || "unknown"}`);
    console.log(`   Model: ${data.properties.model || "unknown"}`);
  });

  // Test 4: emulator-device list (may fail if cmdline-tools not installed)
  await test("emulator-device list", async () => {
    try {
      const result = await client.callTool({
        name: "emulator-device",
        arguments: { operation: "list" },
      });
      const data = JSON.parse(result.content[0].text as string);
      if (!data.avds || !Array.isArray(data.avds)) {
        throw new Error("Expected avds array");
      }
      console.log(`\n   Found ${data.avds.length} AVD(s): ${data.avds.join(", ")}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes("ENOENT") || msg.includes("avdmanager")) {
        console.log("\n   ⚠️  Skipped (cmdline-tools not installed)");
        return; // Don't fail - avdmanager is optional
      }
      throw e;
    }
  });

  // Test 5: adb-logcat
  await test("adb-logcat (last 10 lines)", async () => {
    const result = await client.callTool({
      name: "adb-logcat",
      arguments: { lines: 10, level: "info" },
    });
    const data = JSON.parse(result.content[0].text as string);
    if (!data.summary || typeof data.summary.lineCount !== "number") {
      throw new Error("Expected summary with lineCount");
    }
    console.log(`\n   Got ${data.summary.lineCount} lines, ${data.summary.errorCount} errors`);
  });

  // Test 6: ui dump
  await test("ui dump (accessibility tree)", async () => {
    const result = await client.callTool({
      name: "ui",
      arguments: { operation: "dump" },
    });
    const data = JSON.parse(result.content[0].text as string);
    if (!data.tree) {
      throw new Error("Expected tree in response");
    }
    const nodeCount = JSON.stringify(data.tree).split("className").length - 1;
    console.log(`\n   Got accessibility tree (~${nodeCount} nodes)`);
  });

  // Test 7: ui find
  await test("ui find (clickable elements)", async () => {
    const result = await client.callTool({
      name: "ui",
      arguments: {
        operation: "find",
        selector: { clickable: "true" }
      },
    });
    const data = JSON.parse(result.content[0].text as string);
    if (!data.elements || !Array.isArray(data.elements)) {
      throw new Error("Expected elements array");
    }
    console.log(`\n   Found ${data.elements.length} clickable elements`);
  });

  // Test 8: adb-shell (safe command)
  await test("adb-shell (getprop ro.build.version.release)", async () => {
    const result = await client.callTool({
      name: "adb-shell",
      arguments: { command: "getprop ro.build.version.release" },
    });
    const data = JSON.parse(result.content[0].text as string);
    if (data.stdout === undefined) {
      throw new Error("Expected stdout");
    }
    console.log(`\n   Android version: ${data.stdout.trim()}`);
  });

  // Cleanup
  await client.close();
  await server.close();

  // Summary
  console.log("\n" + "=".repeat(50));
  console.log(`Results: ${passed} passed, ${failed} failed`);
  console.log("=".repeat(50));

  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
