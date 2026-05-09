import os from "node:os";
import { ProcessRunner } from "./process-runner.js";

const IPV4_RE = /^(?:\d{1,3}\.){3}\d{1,3}$/;

// Tailscale assigns IPs from the CGNAT range 100.64.0.0/10
// (100.64.x.x – 100.127.x.x). We use this as a fallback when the
// `tailscale` CLI isn't on PATH but tailscaled is running and has
// brought up a tun interface.
function isTailscaleCgnat(ip: string): boolean {
  if (!IPV4_RE.test(ip)) return false;
  const [a, b] = ip.split(".").map((n) => parseInt(n, 10));
  return a === 100 && b >= 64 && b <= 127;
}

export async function detectTailscaleIp(
  runner: ProcessRunner,
  ifaces: typeof os.networkInterfaces = os.networkInterfaces
): Promise<string | null> {
  // Preferred: ask the CLI directly. It returns one IP per line; we want
  // the first IPv4.
  try {
    const result = await runner.run("tailscale", ["ip", "-4"], { timeoutMs: 2000 });
    if (result.exitCode === 0) {
      const ip = result.stdout.split(/\r?\n/).map((s) => s.trim()).find((s) => IPV4_RE.test(s));
      if (ip) return ip;
    }
  } catch {
    // tailscale CLI not on PATH or other spawn error — fall through.
  }

  // Fallback: scan network interfaces for an IPv4 in the CGNAT range.
  const map = ifaces();
  for (const list of Object.values(map)) {
    for (const entry of list ?? []) {
      if (entry.family === "IPv4" && !entry.internal && isTailscaleCgnat(entry.address)) {
        return entry.address;
      }
    }
  }
  return null;
}
