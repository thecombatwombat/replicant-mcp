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
  let deviceId: string | null = null;

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
    if (data.devices.length === 0) {
      throw new Error("No devices found. Start an emulator or connect a device.");
    }
    // Capture the first device for subsequent tests
    deviceId = data.devices[0].id;
    console.log(`\n   Found ${data.devices.length} device(s)`);
    console.log(`   Using: ${deviceId} (${data.devices[0].status || "unknown"})`);
  });

  // Test 2: adb-device select
  await test("adb-device select", async () => {
    if (!deviceId) throw new Error("No device discovered from list");
    const result = await client.callTool({
      name: "adb-device",
      arguments: { operation: "select", deviceId },
    });
    const data = JSON.parse(result.content[0].text as string);
    if (!data.selected || data.selected.id !== deviceId) {
      throw new Error(`Expected selected.id=${deviceId}, got ${JSON.stringify(data.selected)}`);
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
    if (!data.summary || typeof data.propertyCount !== "number") {
      throw new Error("Expected summarized properties payload");
    }
    console.log(`\n   SDK: ${data.summary.sdkVersion || "unknown"}`);
    console.log(`   Model: ${data.summary.model || "unknown"}`);
  });

  // Test 4: emulator-device list (may fail if cmdline-tools not installed)
  await test("emulator-device list", async () => {
    const result = await client.callTool({
      name: "emulator-device",
      arguments: { operation: "list" },
    });
    const data = JSON.parse(result.content[0].text as string);

    if (result.isError === true) {
      if (data?.error === "SDK_NOT_FOUND") {
        console.log("\n   ⚠️  Skipped (cmdline-tools not installed)");
        return; // Don't fail - avdmanager is optional
      }
      throw new Error(`Expected list response, got error: ${JSON.stringify(data)}`);
    }

    if (!data.avds || !Array.isArray(data.avds)) {
      throw new Error("Expected avds array");
    }
    console.log(`\n   Found ${data.avds.length} AVD(s): ${data.avds.join(", ")}`);
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
  await test("ui dump (compact by default)", async () => {
    const result = await client.callTool({
      name: "ui",
      arguments: { operation: "dump" },
    });
    const data = JSON.parse(result.content[0].text as string);
    if (!Array.isArray(data.elements)) {
      throw new Error("Expected compact elements array in response");
    }
    console.log(`\n   Got ${data.count} interactive elements (of ${data.totalCount})`);
  });

  // Test 7: ui find
  await test("ui find (clickable elements)", async () => {
    const result = await client.callTool({
      name: "ui",
      arguments: {
        operation: "find",
        selector: { className: "android.widget.TextView" },
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
