import { Command } from "commander";
import { spawn, ChildProcess } from "node:child_process";
import { ProcessRunner, detectTailscaleIp } from "../services/index.js";

export interface ServeOptions {
  http: boolean;
  port: number;
  host?: string;
}

type SignalListener = (sig: NodeJS.Signals) => void;

export interface ServeDeps {
  runner: ProcessRunner;
  detectIp: typeof detectTailscaleIp;
  spawnChild: (cmd: string, args: string[]) => ChildProcess;
  exit: (code: number) => void;
  // Serve mode never writes to stdout — stdout is reserved for the MCP wire
  // when this same Node binary is re-spawned in stdio mode by mcp-proxy.
  // Banner + diagnostics + errors all go through errLog (stderr).
  errLog: (line: string) => void;
  selfBin: string;
  selfNode: string;
  signals?: NodeJS.Signals[];
  // Injected so tests can verify listener cleanup without poking the real
  // global `process` event emitter.
  processOn?: (sig: NodeJS.Signals, fn: SignalListener) => void;
  processOff?: (sig: NodeJS.Signals, fn: SignalListener) => void;
}

export interface PreflightResult {
  ok: boolean;
  bindHost?: string;
  reason?: string;
}

const DEFAULT_PORT = 8765;

export async function checkUvAvailable(runner: ProcessRunner): Promise<boolean> {
  try {
    const result = await runner.run("uv", ["--version"], { timeoutMs: 2000 });
    return result.exitCode === 0;
  } catch {
    return false;
  }
}

export async function preflight(
  options: ServeOptions,
  deps: Pick<ServeDeps, "runner" | "detectIp">
): Promise<PreflightResult> {
  if (!options.http) {
    return { ok: false, reason: "serve currently requires --http (stdio is the default; just run `replicant-mcp` with no args)" };
  }

  if (!(await checkUvAvailable(deps.runner))) {
    return {
      ok: false,
      reason: [
        "uv (the Python package runner) is required for `serve --http`.",
        "Install: https://docs.astral.sh/uv/getting-started/installation/",
        "  curl -LsSf https://astral.sh/uv/install.sh | sh",
      ].join("\n"),
    };
  }

  if (options.host) {
    return { ok: true, bindHost: options.host };
  }

  const tsIp = await deps.detectIp(deps.runner);
  if (!tsIp) {
    return {
      ok: false,
      reason: [
        "Tailscale interface not detected.",
        "Either install/start Tailscale (https://tailscale.com/download) or",
        "pass --host <ip> to bind to a different private network address.",
      ].join("\n"),
    };
  }
  return { ok: true, bindHost: tsIp };
}

export function buildProxyArgs(bindHost: string, port: number, selfNode: string, selfBin: string): string[] {
  return [
    "mcp-proxy",
    "--port", String(port),
    "--host", bindHost,
    "--pass-environment",
    "--",
    selfNode,
    selfBin,
  ];
}

export function formatBanner(bindHost: string, port: number): string {
  return [
    "",
    "replicant-mcp remote mode",
    "─────────────────────────",
    `  bind:  ${bindHost}:${port}`,
    `  url:   http://${bindHost}:${port}/sse`,
    "",
    "Client config (paste into Claude Desktop / Cursor / etc.):",
    "",
    "  {",
    '    "replicant-remote": {',
    `      "url": "http://${bindHost}:${port}/sse"`,
    "    }",
    "  }",
    "",
    "Press Ctrl-C to stop.",
    "",
  ].join("\n");
}

export async function runServe(options: ServeOptions, deps: ServeDeps): Promise<void> {
  const result = await preflight(options, deps);
  if (!result.ok || !result.bindHost) {
    deps.errLog(result.reason ?? "preflight failed");
    deps.exit(1);
    return;
  }

  const port = options.port;
  const args = buildProxyArgs(result.bindHost, port, deps.selfNode, deps.selfBin);

  deps.errLog(formatBanner(result.bindHost, port));

  const child = deps.spawnChild("uvx", args);

  // The signal handlers below close over `cleanupSignals`. We declare it
  // after wiring child listeners so that an immediate `error` event from
  // a failed spawn can be reported without racing the signal-handler
  // install. The handlers themselves only call cleanupSignals on child
  // exit, by which time it's defined.
  const installedSignals: Array<{ sig: NodeJS.Signals; fn: SignalListener }> = [];
  const cleanupSignals = () => {
    const off = deps.processOff ?? ((s, f) => { process.removeListener(s, f); });
    for (const { sig, fn } of installedSignals) off(sig, fn);
    installedSignals.length = 0;
  };

  // Wire child listeners BEFORE signal handlers. A synchronous `error`
  // event from a failed spawn must be observable, and the signal handlers
  // assume `child.exit` will eventually fire to clean them up.
  child.on("exit", (code, sig) => {
    cleanupSignals();
    if (sig && !code) {
      deps.exit(0);
    } else {
      deps.exit(code ?? 1);
    }
  });
  child.on("error", (err) => {
    cleanupSignals();
    deps.errLog(`failed to spawn uvx: ${err.message}`);
    deps.exit(1);
  });

  let shuttingDown = false;
  const onSignal: SignalListener = (sig) => {
    if (shuttingDown) {
      // Second Ctrl-C (or repeated SIGTERM): escalate. The proxy may be
      // taking time to drain SSE clients; the user wants out now.
      child.kill("SIGKILL");
      return;
    }
    shuttingDown = true;
    child.kill(sig);
  };

  const signals: NodeJS.Signals[] = deps.signals ?? ["SIGINT", "SIGTERM"];
  const on = deps.processOn ?? ((s, f) => { process.on(s, f); });
  for (const sig of signals) {
    on(sig, onSignal);
    installedSignals.push({ sig, fn: onSignal });
  }
}

export function createServeCommand(): Command {
  return new Command("serve")
    .description("Run replicant-mcp as a long-lived server (remote mode via mcp-proxy)")
    .option("--http", "Expose over HTTP/SSE via mcp-proxy (required for now)", false)
    .option("--port <port>", "Port to listen on", (v) => parseInt(v, 10), DEFAULT_PORT)
    .option("--host <host>", "Bind address (overrides Tailscale auto-detect)")
    .action(async (options: ServeOptions) => {
      await runServe(options, {
        runner: new ProcessRunner(),
        detectIp: detectTailscaleIp,
        spawnChild: (cmd, args) => spawn(cmd, args, { stdio: "inherit" }),
        exit: (code) => process.exit(code),
        errLog: (line) => process.stderr.write(line + "\n"),
        selfNode: process.execPath,
        selfBin: process.argv[1] ?? "",
      });
    });
}

