import { describe, it, expect, vi } from "vitest";
import { EventEmitter } from "node:events";
import {
  preflight,
  buildProxyArgs,
  formatBanner,
  runServe,
  checkUvAvailable,
  type ServeDeps,
  type ServeOptions,
} from "../../src/cli/serve.js";

const fakeRunner = (run: ReturnType<typeof vi.fn>) =>
  ({ run } as unknown as ServeDeps["runner"]);

const baseOpts = (over: Partial<ServeOptions> = {}): ServeOptions => ({
  http: true,
  port: 8765,
  ...over,
});

describe("checkUvAvailable", () => {
  it("returns true when `uv --version` exits 0", async () => {
    const run = vi.fn().mockResolvedValue({ stdout: "uv 0.8", stderr: "", exitCode: 0 });
    expect(await checkUvAvailable(fakeRunner(run))).toBe(true);
  });

  it("returns false when `uv --version` exits non-zero", async () => {
    const run = vi.fn().mockResolvedValue({ stdout: "", stderr: "", exitCode: 1 });
    expect(await checkUvAvailable(fakeRunner(run))).toBe(false);
  });

  it("returns false when uv isn't on PATH (spawn throws)", async () => {
    const run = vi.fn().mockRejectedValue(new Error("ENOENT"));
    expect(await checkUvAvailable(fakeRunner(run))).toBe(false);
  });
});

describe("preflight", () => {
  it("rejects when --http is missing", async () => {
    const run = vi.fn();
    const detectIp = vi.fn();
    const result = await preflight(baseOpts({ http: false }), { runner: fakeRunner(run), detectIp });
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/--http/);
    expect(detectIp).not.toHaveBeenCalled();
  });

  it("rejects when uv is not available", async () => {
    const run = vi.fn().mockRejectedValue(new Error("ENOENT"));
    const detectIp = vi.fn();
    const result = await preflight(baseOpts(), { runner: fakeRunner(run), detectIp });
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/uv/);
    expect(result.reason).toMatch(/astral.sh/);
    expect(detectIp).not.toHaveBeenCalled();
  });

  it("uses --host override when provided (skips Tailscale detection)", async () => {
    const run = vi.fn().mockResolvedValue({ stdout: "uv 0.8", stderr: "", exitCode: 0 });
    const detectIp = vi.fn();
    const result = await preflight(baseOpts({ host: "10.0.0.5" }), {
      runner: fakeRunner(run),
      detectIp,
    });
    expect(result).toEqual({ ok: true, bindHost: "10.0.0.5" });
    expect(detectIp).not.toHaveBeenCalled();
  });

  it("uses Tailscale-detected IP when --host is omitted", async () => {
    const run = vi.fn().mockResolvedValue({ stdout: "uv 0.8", stderr: "", exitCode: 0 });
    const detectIp = vi.fn().mockResolvedValue("100.64.1.42");
    const result = await preflight(baseOpts(), { runner: fakeRunner(run), detectIp });
    expect(result).toEqual({ ok: true, bindHost: "100.64.1.42" });
  });

  it("rejects when Tailscale isn't detected and no --host is given", async () => {
    const run = vi.fn().mockResolvedValue({ stdout: "uv 0.8", stderr: "", exitCode: 0 });
    const detectIp = vi.fn().mockResolvedValue(null);
    const result = await preflight(baseOpts(), { runner: fakeRunner(run), detectIp });
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/Tailscale/);
    expect(result.reason).toMatch(/--host/);
  });
});

describe("buildProxyArgs", () => {
  it("emits the expected mcp-proxy invocation", () => {
    const args = buildProxyArgs("100.64.1.42", 8765, "/usr/bin/node", "/path/to/dist/index.js");
    expect(args).toEqual([
      "mcp-proxy",
      "--port", "8765",
      "--host", "100.64.1.42",
      "--pass-environment",
      "--",
      "/usr/bin/node",
      "/path/to/dist/index.js",
    ]);
  });
});

describe("formatBanner", () => {
  it("includes the bind URL and a paste-ready client config", () => {
    const banner = formatBanner("100.64.1.42", 8765);
    expect(banner).toContain("100.64.1.42:8765");
    expect(banner).toContain("http://100.64.1.42:8765/sse");
    expect(banner).toContain("replicant-remote");
  });
});

class FakeChild extends EventEmitter {
  killed = false;
  kill(_sig: NodeJS.Signals) {
    this.killed = true;
    return true;
  }
}

function fakeDeps(over: Partial<ServeDeps> = {}): { deps: ServeDeps; err: string[]; exitCodes: number[]; spawn: ReturnType<typeof vi.fn> } {
  const err: string[] = [];
  const exitCodes: number[] = [];
  const spawn = over.spawnChild
    ? (vi.fn(over.spawnChild) as unknown as ReturnType<typeof vi.fn>)
    : vi.fn(() => new FakeChild());
  const deps: ServeDeps = {
    runner: { run: vi.fn().mockResolvedValue({ stdout: "uv 0.8", stderr: "", exitCode: 0 }) } as unknown as ServeDeps["runner"],
    detectIp: vi.fn().mockResolvedValue("100.64.1.42"),
    spawnChild: spawn as unknown as ServeDeps["spawnChild"],
    exit: (code: number) => { exitCodes.push(code); },
    errLog: (line: string) => { err.push(line); },
    selfNode: "/usr/bin/node",
    selfBin: "/abs/dist/index.js",
    signals: [],
    ...over,
  };
  return { deps, err, exitCodes, spawn };
}

describe("runServe", () => {
  it("spawns uvx mcp-proxy with the resolved bind address", async () => {
    const { deps, err, spawn } = fakeDeps();
    await runServe(baseOpts(), deps);
    expect(spawn).toHaveBeenCalledWith("uvx", [
      "mcp-proxy",
      "--port", "8765",
      "--host", "100.64.1.42",
      "--pass-environment",
      "--",
      "/usr/bin/node",
      "/abs/dist/index.js",
    ]);
    expect(err.join("\n")).toContain("http://100.64.1.42:8765/sse");
  });

  it("does not write the banner to stdout (stdout is reserved for MCP-stream cleanliness)", async () => {
    const writes: string[] = [];
    const original = process.stdout.write;
    (process.stdout as unknown as { write: (s: string) => boolean }).write = (s: string) => {
      writes.push(s);
      return true;
    };
    try {
      const { deps } = fakeDeps();
      await runServe(baseOpts(), deps);
    } finally {
      (process.stdout as unknown as { write: typeof original }).write = original;
    }
    expect(writes.join("")).not.toContain("replicant-mcp remote mode");
  });

  it("exits 1 with a clear reason when preflight fails", async () => {
    const { deps, err, exitCodes, spawn } = fakeDeps({
      runner: { run: vi.fn().mockRejectedValue(new Error("ENOENT")) } as unknown as ServeDeps["runner"],
    });
    await runServe(baseOpts(), deps);
    expect(spawn).not.toHaveBeenCalled();
    expect(exitCodes).toEqual([1]);
    expect(err.join("\n")).toMatch(/uv/);
  });

  it("propagates child exit code", async () => {
    const child = new FakeChild();
    const { deps, exitCodes } = fakeDeps({ spawnChild: () => child });
    await runServe(baseOpts(), deps);
    child.emit("exit", 7, null);
    expect(exitCodes).toEqual([7]);
  });

  it("treats signal-only exits (no code) as exit 0", async () => {
    const child = new FakeChild();
    const { deps, exitCodes } = fakeDeps({ spawnChild: () => child });
    await runServe(baseOpts(), deps);
    child.emit("exit", null, "SIGTERM");
    expect(exitCodes).toEqual([0]);
  });

  it("surfaces spawn errors with exit 1", async () => {
    const child = new FakeChild();
    const { deps, exitCodes, err } = fakeDeps({ spawnChild: () => child });
    await runServe(baseOpts(), deps);
    child.emit("error", new Error("boom"));
    expect(exitCodes).toEqual([1]);
    expect(err.join("\n")).toMatch(/uvx/);
  });

  it("uses --host override path", async () => {
    const { deps, spawn } = fakeDeps();
    await runServe(baseOpts({ host: "10.0.0.5" }), deps);
    expect(spawn).toHaveBeenCalledWith(
      "uvx",
      expect.arrayContaining(["--host", "10.0.0.5"])
    );
  });

  describe("signal handling", () => {
    function fakeProcessOn() {
      const listeners = new Map<string, Set<(...args: unknown[]) => void>>();
      const processOn = vi.fn((sig: string, fn: (...args: unknown[]) => void) => {
        if (!listeners.has(sig)) listeners.set(sig, new Set());
        listeners.get(sig)!.add(fn);
      });
      const processOff = vi.fn((sig: string, fn: (...args: unknown[]) => void) => {
        listeners.get(sig)?.delete(fn);
      });
      const fire = (sig: string) => {
        for (const fn of [...(listeners.get(sig) ?? [])]) fn(sig);
      };
      const count = (sig: string) => listeners.get(sig)?.size ?? 0;
      return { processOn, processOff, fire, count };
    }

    it("installs SIGINT/SIGTERM handlers on the injected processOn", async () => {
      const child = new FakeChild();
      const { processOn, count } = fakeProcessOn();
      const { deps } = fakeDeps({
        spawnChild: () => child,
        signals: ["SIGINT", "SIGTERM"],
        processOn: processOn as unknown as ServeDeps["processOn"],
      });
      await runServe(baseOpts(), deps);
      expect(count("SIGINT")).toBe(1);
      expect(count("SIGTERM")).toBe(1);
    });

    it("removes signal listeners after the child exits", async () => {
      const child = new FakeChild();
      const { processOn, processOff, count } = fakeProcessOn();
      const { deps } = fakeDeps({
        spawnChild: () => child,
        signals: ["SIGINT", "SIGTERM"],
        processOn: processOn as unknown as ServeDeps["processOn"],
        processOff: processOff as unknown as ServeDeps["processOff"],
      });
      await runServe(baseOpts(), deps);
      child.emit("exit", 0, null);
      expect(count("SIGINT")).toBe(0);
      expect(count("SIGTERM")).toBe(0);
    });

    it("escalates to SIGKILL on a second signal (Ctrl-C twice)", async () => {
      const child = new FakeChild();
      const killSpy = vi.spyOn(child, "kill");
      const { processOn, fire } = fakeProcessOn();
      const { deps } = fakeDeps({
        spawnChild: () => child,
        signals: ["SIGINT"],
        processOn: processOn as unknown as ServeDeps["processOn"],
      });
      await runServe(baseOpts(), deps);
      fire("SIGINT");
      fire("SIGINT");
      expect(killSpy).toHaveBeenNthCalledWith(1, "SIGINT");
      expect(killSpy).toHaveBeenNthCalledWith(2, "SIGKILL");
    });

    it("wires the child error listener before installing signal handlers", async () => {
      const child = new FakeChild();
      const { processOn } = fakeProcessOn();
      const order: string[] = [];
      const wrappedOn = vi.fn((sig: string, fn: (...args: unknown[]) => void) => {
        order.push(`process.on(${sig})`);
        processOn(sig, fn);
      });
      const originalOn = child.on.bind(child);
      child.on = ((event: string, listener: (...args: unknown[]) => void) => {
        order.push(`child.on(${event})`);
        return originalOn(event, listener);
      }) as typeof child.on;
      const { deps } = fakeDeps({
        spawnChild: () => child,
        signals: ["SIGINT", "SIGTERM"],
        processOn: wrappedOn as unknown as ServeDeps["processOn"],
      });
      await runServe(baseOpts(), deps);
      const firstChildIdx = order.findIndex((s) => s.startsWith("child.on"));
      const firstProcIdx = order.findIndex((s) => s.startsWith("process.on"));
      expect(firstChildIdx).toBeGreaterThanOrEqual(0);
      expect(firstProcIdx).toBeGreaterThanOrEqual(0);
      expect(firstChildIdx).toBeLessThan(firstProcIdx);
    });
  });
});
