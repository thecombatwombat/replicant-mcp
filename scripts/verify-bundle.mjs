#!/usr/bin/env node
/**
 * Verify a packed .mcpb bundle actually runs.
 *
 * v1.6.7 and six releases before it shipped a bundle with no node_modules. The
 * server died on its first import and Claude Desktop reported only
 * "Server disconnected". Release CI checked the version string inside the bundle
 * but never started it, so nothing caught this.
 *
 * This script unpacks the bundle and drives it over stdio exactly as Claude
 * Desktop does — full MCP handshake, tools/list, and a real tools/call — then
 * asserts the native and data dependencies resolve from inside the bundle.
 *
 * Usage: node scripts/verify-bundle.mjs [path/to/bundle.mcpb]
 */

import { spawn, execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, existsSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const PROJECT_DIR = dirname(dirname(fileURLToPath(import.meta.url)));
const bundlePath = resolve(process.argv[2] ?? join(PROJECT_DIR, "replicant-mcp.mcpb"));

// sharp binaries the bundle must carry. Keep in sync with SHARP_PLATFORMS in
// scripts/build-bundle.sh.
const REQUIRED_SHARP_PLATFORMS = [
  "sharp-darwin-arm64",
  "sharp-darwin-x64",
  "sharp-win32-x64",
  "sharp-win32-arm64",
  "sharp-linux-x64",
  "sharp-linux-arm64",
];

// Packages that must never appear in a production bundle.
const FORBIDDEN_PACKAGES = ["typescript", "vitest", "eslint", "tsx", "@anthropic-ai/mcpb"];

let failures = 0;
let checks = 0;

function check(label, ok, detail = "") {
  checks++;
  if (ok) {
    console.log(`  \x1b[32m✓\x1b[0m ${label}`);
  } else {
    failures++;
    console.log(`  \x1b[31m✗\x1b[0m ${label}${detail ? `\n      ${detail}` : ""}`);
  }
  return ok;
}

/** Drive the unpacked server over stdio and collect JSON-RPC responses. */
function driveServer(entry, cwd, requests) {
  return new Promise((resolvePromise) => {
    const child = spawn(process.execPath, [entry], {
      cwd,
      stdio: ["pipe", "pipe", "pipe"],
      // Desktop does not forward the user's shell environment. Strip anything
      // that could mask a bundle-resolution failure by falling back to the
      // developer's own node_modules or config.
      env: {
        PATH: process.env.PATH,
        HOME: process.env.HOME,
        USERPROFILE: process.env.USERPROFILE,
        SystemRoot: process.env.SystemRoot,
      },
    });

    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (c) => (stdout += c));
    child.stderr.on("data", (c) => (stderr += c));

    const timer = setTimeout(() => child.kill("SIGKILL"), 60_000);

    child.on("close", (code) => {
      clearTimeout(timer);
      const messages = [];
      for (const line of stdout.split("\n")) {
        if (!line.trim()) continue;
        try {
          messages.push(JSON.parse(line));
        } catch {
          /* non-JSON on stdout is reported via rawStdout below */
        }
      }
      resolvePromise({ code, messages, stderr, rawStdout: stdout });
    });

    for (const req of requests) child.stdin.write(JSON.stringify(req) + "\n");
    child.stdin.end();
  });
}

console.log(`\n🔍 Verifying bundle: ${bundlePath}\n`);

if (!existsSync(bundlePath)) {
  console.error(`❌ Bundle not found: ${bundlePath}\n   Run: bash scripts/build-bundle.sh`);
  process.exit(1);
}

const workDir = mkdtempSync(join(tmpdir(), "mcpb-verify-"));
const unpacked = join(workDir, "unpacked");

try {
  execFileSync("unzip", ["-q", bundlePath, "-d", unpacked], { stdio: "pipe" });

  // ---- Structure -----------------------------------------------------------
  console.log("Bundle contents:");
  check("manifest.json present", existsSync(join(unpacked, "manifest.json")));
  check("dist/index.js present", existsSync(join(unpacked, "dist", "index.js")));
  check(
    "node_modules bundled",
    existsSync(join(unpacked, "node_modules")),
    "MCPB bundles must be self-contained; Desktop never runs npm install",
  );
  check(
    "@modelcontextprotocol/sdk resolvable",
    existsSync(join(unpacked, "node_modules", "@modelcontextprotocol", "sdk")),
  );
  check(
    "tesseract.js entry point intact",
    existsSync(join(unpacked, "node_modules", "tesseract.js", "src", "index.js")),
    "tesseract.js main is src/index.js — an unanchored ignore pattern can strip it",
  );
  check(
    "docs/rtfm present (rtfm tool reads it)",
    existsSync(join(unpacked, "docs", "rtfm", "index.md")),
  );
  check("eng.traineddata present (offline OCR)", existsSync(join(unpacked, "eng.traineddata")));

  for (const platform of REQUIRED_SHARP_PLATFORMS) {
    check(`sharp binary: ${platform}`, existsSync(join(unpacked, "node_modules", "@img", platform)));
  }

  const installed = existsSync(join(unpacked, "node_modules"))
    ? readdirSync(join(unpacked, "node_modules"))
    : [];
  for (const pkg of FORBIDDEN_PACKAGES) {
    const [scope, name] = pkg.startsWith("@") ? pkg.split("/") : [null, pkg];
    const present = scope
      ? existsSync(join(unpacked, "node_modules", scope, name))
      : installed.includes(pkg);
    check(`dev dependency excluded: ${pkg}`, !present);
  }

  // ---- Native / data dependencies load from inside the bundle --------------
  console.log("\nNative dependencies:");
  try {
    execFileSync(process.execPath, ["-e", "require('sharp')"], {
      cwd: unpacked,
      stdio: "pipe",
    });
    check(`sharp loads on host platform (${process.platform}-${process.arch})`, true);
  } catch (err) {
    check(
      `sharp loads on host platform (${process.platform}-${process.arch})`,
      false,
      String(err.stderr ?? err).split("\n").slice(0, 3).join("\n      "),
    );
  }

  try {
    execFileSync(
      process.execPath,
      ["-e", "require('tesseract.js-core/tesseract-core-relaxedsimd-lstm')"],
      { cwd: unpacked, stdio: "pipe" },
    );
    check("tesseract wasm core resolves after trim", true);
  } catch (err) {
    check(
      "tesseract wasm core resolves after trim",
      false,
      String(err.stderr ?? err).split("\n").slice(0, 3).join("\n      "),
    );
  }

  // Run OCR for real, from a directory that is NOT the bundle root. Checking only
  // that eng.traineddata exists is not enough: tesseract.js reads
  // <cachePath>/eng.traineddata before consulting langPath, and cachePath
  // defaults to the working directory. Running from the bundle root therefore
  // succeeds by accident and hides a broken langPath (e.g. the gzip default
  // makes it look for eng.traineddata.gz). Claude Desktop's working directory is
  // not the bundle root, so this must be exercised from elsewhere.
  const ocrCwd = join(workDir, "neutral-cwd");
  execFileSync("mkdir", ["-p", ocrCwd]);
  const ocrProbe = `
    const path = ${JSON.stringify(unpacked)};
    const sharp = require(path + "/node_modules/sharp");
    const svg = '<svg width="360" height="110"><rect width="360" height="110" fill="white"/>'
      + '<text x="18" y="72" font-family="Helvetica" font-size="44" fill="black">Settings</text></svg>';
    const img = path + "/../ocr-probe.png";
    sharp(Buffer.from(svg)).png().toFile(img)
      .then(() => import(path + "/dist/services/ocr.js"))
      .then(async (ocr) => {
        const words = await ocr.extractText(img);
        await ocr.terminateOcr();
        const text = words.map((w) => w.text).join(" ");
        if (!/Settings/i.test(text)) throw new Error("unexpected OCR output: " + text);
        process.exit(0);
      })
      .catch((e) => { console.error(String(e && e.message || e)); process.exit(1); });
  `;
  try {
    execFileSync(process.execPath, ["-e", ocrProbe], {
      cwd: ocrCwd,
      stdio: "pipe",
      timeout: 120_000,
    });
    check("OCR runs offline from a non-bundle working directory", true);
  } catch (err) {
    check(
      "OCR runs offline from a non-bundle working directory",
      false,
      String(err.stderr ?? err.message ?? err).split("\n").slice(0, 3).join("\n      "),
    );
  }

  // ---- Live MCP session ----------------------------------------------------
  console.log("\nMCP protocol:");
  const entry = join(unpacked, "dist", "index.js");
  const { code, messages, stderr, rawStdout } = await driveServer(entry, unpacked, [
    {
      jsonrpc: "2.0",
      id: 0,
      method: "initialize",
      params: {
        protocolVersion: "2025-06-18",
        capabilities: {},
        clientInfo: { name: "verify-bundle", version: "1" },
      },
    },
    { jsonrpc: "2.0", method: "notifications/initialized" },
    { jsonrpc: "2.0", id: 1, method: "tools/list" },
    { jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: "rtfm", arguments: {} } },
  ]);

  const init = messages.find((m) => m.id === 0);
  const initOk = check(
    "initialize returns serverInfo",
    Boolean(init?.result?.serverInfo?.name),
    stderr.trim().split("\n").slice(0, 6).join("\n      ") ||
      `exit=${code} stdout=${rawStdout.slice(0, 200)}`,
  );
  if (initOk) {
    check(
      "server identifies as replicant-mcp",
      init.result.serverInfo.name === "replicant-mcp",
      `got ${init.result.serverInfo.name}`,
    );
  }

  const list = messages.find((m) => m.id === 1);
  check(
    `tools/list returns 14 tools`,
    list?.result?.tools?.length === 14,
    `got ${list?.result?.tools?.length ?? "no response"}`,
  );

  const call = messages.find((m) => m.id === 2);
  check(
    "tools/call rtfm succeeds",
    Boolean(call?.result) && !call.error,
    call?.error ? JSON.stringify(call.error) : "no response",
  );

  // A stdio MCP server must keep stdout clean — stray writes corrupt the stream.
  const nonJsonStdout = rawStdout
    .split("\n")
    .filter((l) => l.trim() && !l.trim().startsWith("{"));
  check(
    "stdout contains only JSON-RPC",
    nonJsonStdout.length === 0,
    nonJsonStdout.slice(0, 3).join("\n      "),
  );
} finally {
  rmSync(workDir, { recursive: true, force: true });
}

console.log(
  `\n${failures === 0 ? "\x1b[32m✅ All checks passed\x1b[0m" : "\x1b[31m❌ FAILED\x1b[0m"} ` +
    `(${checks - failures}/${checks})\n`,
);
process.exit(failures === 0 ? 0 : 1);
