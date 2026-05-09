import { Command } from "commander";
import { spawn, ChildProcess } from "node:child_process";
import { ProcessRunner, detectTailscaleIp } from "../services/index.js";

export interface ServeOptions {
  http: boolean;
  port: number;
  host?: string;
}

export interface ServeDeps {
  runner: ProcessRunner;
  detectIp: typeof detectTailscaleIp;
  spawnChild: (cmd: string, args: string[]) => ChildProcess;
  exit: (code: number) => void;
  log: (line: string) => void;
  errLog: (line: string) => void;
  selfBin: string;
  selfNode: string;
  signals?: NodeJS.Signals[];
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

  deps.log(formatBanner(result.bindHost, port));

  const child = deps.spawnChild("uvx", args);

  const signals: NodeJS.Signals[] = deps.signals ?? ["SIGINT", "SIGTERM"];
  for (const sig of signals) {
    process.on(sig, () => {
      if (!child.killed) child.kill("SIGTERM");
    });
  }

  child.on("exit", (code, sig) => {
    if (sig && !code) {
      deps.exit(0);
    } else {
      deps.exit(code ?? 1);
    }
  });
  child.on("error", (err) => {
    deps.errLog(`failed to spawn uvx: ${err.message}`);
    deps.exit(1);
  });
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
        log: (line) => process.stdout.write(line + "\n"),
        errLog: (line) => process.stderr.write(line + "\n"),
        selfNode: process.execPath,
        selfBin: process.argv[1] ?? "",
      });
    });
}

