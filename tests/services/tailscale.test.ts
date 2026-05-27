import { describe, it, expect, vi } from "vitest";
import type { NetworkInterfaceInfo } from "node:os";
import { detectTailscaleIp } from "../../src/services/tailscale.js";

type IfaceMap = Record<string, NetworkInterfaceInfo[] | undefined>;

const makeRunner = (run: ReturnType<typeof vi.fn>) =>
  ({ run } as unknown as Parameters<typeof detectTailscaleIp>[0]);

const cgnat = (address: string): NetworkInterfaceInfo => ({
  address,
  netmask: "255.255.255.255",
  family: "IPv4",
  mac: "00:00:00:00:00:00",
  internal: false,
  cidr: `${address}/32`,
});

describe("detectTailscaleIp", () => {
  it("returns the IPv4 reported by `tailscale ip -4`", async () => {
    const run = vi.fn().mockResolvedValue({ stdout: "100.64.1.42\n", stderr: "", exitCode: 0 });
    const ip = await detectTailscaleIp(makeRunner(run), () => ({}));
    expect(ip).toBe("100.64.1.42");
    expect(run).toHaveBeenCalledWith("tailscale", ["ip", "-4"], expect.anything());
  });

  it("picks the first IPv4 line when CLI returns multiple addresses", async () => {
    const run = vi.fn().mockResolvedValue({
      stdout: "100.64.1.42\nfd7a:115c:a1e0::1\n",
      stderr: "",
      exitCode: 0,
    });
    const ip = await detectTailscaleIp(makeRunner(run), () => ({}));
    expect(ip).toBe("100.64.1.42");
  });

  it("falls back to scanning interfaces when CLI exits non-zero", async () => {
    const run = vi.fn().mockResolvedValue({ stdout: "", stderr: "not running", exitCode: 1 });
    const ifaces: IfaceMap = {
      en0: [cgnat("192.168.1.10")],
      utun3: [cgnat("100.64.1.42")],
    };
    const ip = await detectTailscaleIp(makeRunner(run), () => ifaces);
    expect(ip).toBe("100.64.1.42");
  });

  it("falls back to scanning interfaces when CLI throws (ENOENT)", async () => {
    const run = vi.fn().mockRejectedValue(new Error("ENOENT: tailscale"));
    const ifaces: IfaceMap = { tailscale0: [cgnat("100.100.100.100")] };
    const ip = await detectTailscaleIp(makeRunner(run), () => ifaces);
    expect(ip).toBe("100.100.100.100");
  });

  it("ignores non-CGNAT IPv4 addresses during fallback", async () => {
    const run = vi.fn().mockRejectedValue(new Error("ENOENT"));
    const ifaces: IfaceMap = {
      en0: [cgnat("192.168.1.10"), cgnat("10.0.0.5")],
      lo0: [{ ...cgnat("127.0.0.1"), internal: true }],
    };
    const ip = await detectTailscaleIp(makeRunner(run), () => ifaces);
    expect(ip).toBeNull();
  });

  it("ignores internal interfaces even if they happen to be in CGNAT range", async () => {
    const run = vi.fn().mockRejectedValue(new Error("ENOENT"));
    const ifaces: IfaceMap = { lo0: [{ ...cgnat("100.64.0.1"), internal: true }] };
    const ip = await detectTailscaleIp(makeRunner(run), () => ifaces);
    expect(ip).toBeNull();
  });

  it("returns null when neither CLI nor interfaces yield a tailnet IP", async () => {
    const run = vi.fn().mockResolvedValue({ stdout: "", stderr: "", exitCode: 1 });
    const ip = await detectTailscaleIp(makeRunner(run), () => ({}));
    expect(ip).toBeNull();
  });

  it("treats CGNAT boundary correctly (100.63.x and 100.128.x are NOT tailnet)", async () => {
    const run = vi.fn().mockRejectedValue(new Error("ENOENT"));
    const ifaces: IfaceMap = {
      a: [cgnat("100.63.255.255")],
      b: [cgnat("100.128.0.1")],
    };
    const ip = await detectTailscaleIp(makeRunner(run), () => ifaces);
    expect(ip).toBeNull();
  });

  it("accepts boundary 100.64.0.0 and 100.127.255.255", async () => {
    const run = vi.fn().mockRejectedValue(new Error("ENOENT"));
    const lower: IfaceMap = { a: [cgnat("100.64.0.0")] };
    const upper: IfaceMap = { a: [cgnat("100.127.255.255")] };
    expect(await detectTailscaleIp(makeRunner(run), () => lower)).toBe("100.64.0.0");
    expect(await detectTailscaleIp(makeRunner(run), () => upper)).toBe("100.127.255.255");
  });
});
