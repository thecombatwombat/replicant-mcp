# Remote mode

Run replicant-mcp on the machine your phone is plugged into, and drive it
from an agent running anywhere on your Tailscale network.

By default, an MCP client (Claude Desktop, Cursor, etc.) launches replicant-mcp
as a stdio subprocess on the same machine — you have to be at the machine the
phone is connected to. Remote mode lifts that restriction: you run
`replicant-mcp serve --http` on the **host** (the box with the phone), and any
client on your tailnet can connect to it over SSE.

## How it works

```
agent machine                    host machine (phone-host.tailnet)
─────────────                    ─────────────
MCP client      ──── SSE ────▶   uvx mcp-proxy --port 8765 --host 100.64.1.42
                                          │
                                          └─▶ replicant-mcp (stdio, unchanged)
                                                    │
                                                    └─▶ adb ─▶ phone (USB)
```

`mcp-proxy` ([sparfenyuk/mcp-proxy]) is a Python tool that bridges stdio
MCP servers to HTTP/SSE. We don't reimplement transport in replicant-mcp —
the stdio server is unchanged; mcp-proxy just spawns it as a backend.

## Prerequisites (host machine)

- **Node.js 18+** and `replicant-mcp` (`npm install -g replicant-mcp`)
- **Android SDK** (adb, optional emulator) reachable on PATH or via `ANDROID_HOME`
- **[Tailscale]** running and signed in
- **[uv]** (`curl -LsSf https://astral.sh/uv/install.sh | sh`) — used to fetch
  and run `mcp-proxy` on first launch

You don't need to install `mcp-proxy` separately; `uvx` fetches it on first
run and caches it.

## Quick start

On the **host** (the machine with the phone):

```sh
replicant-mcp serve --http
```

You'll see something like:

```
replicant-mcp remote mode
─────────────────────────
  bind:  100.64.1.42:8765
  url:   http://100.64.1.42:8765/sse

Client config (paste into Claude Desktop / Cursor / etc.):

  {
    "replicant-remote": {
      "url": "http://100.64.1.42:8765/sse"
    }
  }

Press Ctrl-C to stop.
```

By default, `serve --http` auto-detects your Tailscale IP via `tailscale ip -4`
(falling back to scanning interfaces in the CGNAT range `100.64.0.0/10`) and
binds to that interface only. Other machines on the same tailnet can reach it;
nothing else can.

### Client config

In your MCP client, point at the URL printed above.

**Claude Desktop** (`~/Library/Application Support/Claude/claude_desktop_config.json`)
needs `mcp-remote` to bridge SSE → stdio:

```json
{
  "mcpServers": {
    "replicant-remote": {
      "command": "npx",
      "args": ["-y", "mcp-remote", "http://100.64.1.42:8765/sse"]
    }
  }
}
```

**Cursor** (`~/.cursor/mcp.json`):

```json
{
  "mcpServers": {
    "replicant-remote": {
      "url": "http://100.64.1.42:8765/sse"
    }
  }
}
```

**Claude Code** (CLI):

```sh
claude mcp add replicant-remote --transport sse http://100.64.1.42:8765/sse
```

## CLI reference

```
replicant-mcp serve [options]

Options:
  --http              Expose over HTTP/SSE via mcp-proxy (required)
  --port <port>       Port to listen on (default: 8765)
  --host <host>       Bind address (overrides Tailscale auto-detect)
```

The `--host` override is for users on private networks other than Tailscale
(e.g., a wireguard mesh, a lab VLAN). `--host 0.0.0.0` exposes on every
interface — only do that if your firewall blocks the port from the public
internet.

## Keeping it running

`serve --http` runs in the foreground. For an always-on host, wrap it with
launchd (macOS) or systemd (Linux).

### macOS — launchd

Save as `~/Library/LaunchAgents/com.replicant.serve.plist`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
  <dict>
    <key>Label</key><string>com.replicant.serve</string>
    <key>ProgramArguments</key>
    <array>
      <string>/usr/local/bin/replicant-mcp</string>
      <string>serve</string>
      <string>--http</string>
    </array>
    <key>EnvironmentVariables</key>
    <dict>
      <key>PATH</key><string>/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin</string>
      <key>ANDROID_HOME</key><string>/Users/YOU/Library/Android/sdk</string>
    </dict>
    <key>RunAtLoad</key><true/>
    <key>KeepAlive</key><true/>
    <key>StandardOutPath</key><string>/tmp/replicant-mcp.out.log</string>
    <key>StandardErrorPath</key><string>/tmp/replicant-mcp.err.log</string>
  </dict>
</plist>
```

Load it:

```sh
launchctl load ~/Library/LaunchAgents/com.replicant.serve.plist
launchctl list | grep replicant     # should show running
```

### Linux — systemd (user unit)

Save as `~/.config/systemd/user/replicant-mcp.service`:

```ini
[Unit]
Description=replicant-mcp remote mode
After=network-online.target tailscaled.service
Wants=network-online.target

[Service]
Type=simple
ExecStart=/usr/local/bin/replicant-mcp serve --http
Environment=ANDROID_HOME=%h/Android/Sdk
Restart=on-failure
RestartSec=5

[Install]
WantedBy=default.target
```

Enable it:

```sh
systemctl --user daemon-reload
systemctl --user enable --now replicant-mcp
journalctl --user -u replicant-mcp -f
```

### Quick / temporary

For a one-off session, run inside `tmux` or `screen`:

```sh
tmux new -s replicant 'replicant-mcp serve --http'
# detach: Ctrl-b d
# reattach later: tmux attach -t replicant
```

## What happens when the phone disconnects

- **Brief USB flake (cable jostle, sleep/wake):** the next tool call may hit
  `device offline` once. replicant-mcp retries once after a 3-second
  `wait-for-device`, so most flakes are invisible to the agent.
- **Phone reboot:** the next tool call surfaces `device offline` or
  `no devices/emulators found`. After the device is back, the call after
  succeeds.
- **`replicant-mcp serve` crash:** mcp-proxy holds the SSE connection but the
  stdio backend is gone. `launchd`/`systemd` restarts the host process; the
  agent sees the connection drop and reconnects.

There's no background reconnect supervisor — by design, for the MVP. If you
need transparent recovery across reboots, run under `KeepAlive`/`Restart=on-failure`
and let the supervisor handle it.

## Troubleshooting

**`Tailscale interface not detected.`**
`tailscale status` should show your machine connected. If you're using a
non-Tailscale private network, pass `--host <ip>` explicitly.

**`uv (the Python package runner) is required.`**
Install uv: `curl -LsSf https://astral.sh/uv/install.sh | sh`, then re-run.

**`Address already in use`**
Something else is on port 8765. Choose another with `--port 8766` (and
update the URL in your client config).

**Client connects but tool calls hang**
Look at the host's stderr (`/tmp/replicant-mcp.err.log` if you used the
launchd plist). Common cause: the host can't reach `adb` because PATH /
`ANDROID_HOME` weren't set in the launch context. Add them to the
environment block of your unit/plist.

**Multiple agents pointed at the same host**
Don't, for now. Both clients share the same `ServerContext`, so calls to
`adb-device select` and the UI find/action sequencing race. One agent per
host until per-client isolation lands.

## Known limitations

- **Single client at a time.** The server has one `ServerContext`; concurrent
  clients race on the selected device and on UI find→action sequencing.
- **No bearer-token auth.** Trust comes from Tailscale's WireGuard tunnel.
  Don't bind to a public-internet address without your own auth layer.
- **No background reconnect.** Phone reboots surface as one failed call;
  the next call succeeds.
- **Foreground process.** Use launchd / systemd to keep it running across
  host reboots.

[sparfenyuk/mcp-proxy]: https://github.com/sparfenyuk/mcp-proxy
[Tailscale]: https://tailscale.com/download
[uv]: https://docs.astral.sh/uv/getting-started/installation/
