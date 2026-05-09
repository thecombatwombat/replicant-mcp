# Privacy Policy

**Effective date:** May 9, 2026

Replicant MCP is a local Model Context Protocol (MCP) server for Android development. This policy explains what data it accesses, where that data goes, and what it does not do.

## Data accessed

Replicant MCP connects to Android devices and emulators via ADB (Android Debug Bridge). Through this connection it may access:

- **Screenshots and UI hierarchy** for screen analysis and interaction
- **Logcat output** for debugging
- **Device information** such as model, OS version, and installed apps
- **Gradle project structure** for build and test operations
- **Shell command output** from user-initiated ADB commands
- **On-screen text** via local OCR (Tesseract.js)

## Where data goes

All data stays within the local MCP protocol loop:

```
Android device  -->  Replicant MCP (local)  -->  AI assistant
```

Replicant MCP runs entirely on your machine. It does not transmit data to any external server, and it does not include telemetry, analytics, or crash reporting.

## Remote mode (`serve --http`)

Remote mode (`replicant-mcp serve --http`) makes the host machine reachable as an MCP server over HTTP/SSE so an agent on a *different* machine can drive the phone. When you opt in to remote mode:

- The host binds an HTTP/SSE listener (default: your Tailscale interface, default port 8765). Any client on the same private network the host is bound to (Tailscale tailnet by default) can reach it.
- Device data (screenshots, logs, UI state, shell output) flows from the host to the connecting MCP client over that interface, and from the client to whichever AI assistant the client is wired to.
- Trust comes from the network boundary you choose: by default that is Tailscale's WireGuard tunnel between known peers. There is no bearer-token auth in remote mode — do not bind the listener to a public-internet address without your own auth layer.

Remote mode does not change *what* data is accessed (it's the same screenshots / logs / UI state listed above). It changes *where the listener lives*: from a stdio subprocess on your laptop to a network endpoint on the host machine. See `docs/remote.md` for the full setup.

## Third-party fetches

- **First launch of `serve --http` only:** the host runs `uvx mcp-proxy ...`. `uvx` (from [Astral's uv](https://docs.astral.sh/uv/)) downloads the [`sparfenyuk/mcp-proxy`](https://github.com/sparfenyuk/mcp-proxy) Python package from PyPI and caches it locally. Subsequent launches use the cache and make no network call. PyPI is reached for package metadata and the package archive only; no usage data about your replicant-mcp session is sent.
- **Environment propagation:** mcp-proxy is invoked with `--pass-environment`, which forwards the host shell's environment to the spawned replicant-mcp backend. The backend is the same process replicant-mcp would run in stdio mode on the host, so this is the same env exposure as running locally — it does not transmit your environment off the host.

Stdio mode (the default, no `serve --http`) makes no third-party fetches.

## AI assistant processing

Replicant MCP sends device data (screenshots, logs, UI state) to whichever AI assistant invokes it (e.g., Claude, ChatGPT). **That data is then subject to your AI provider's privacy policy**, not this one. Review your provider's data handling practices. For example:

- [Anthropic Privacy Policy](https://www.anthropic.com/privacy)
- [OpenAI Privacy Policies](https://openai.com/policies/)

This is not an exhaustive list. If you use a different AI provider, consult their privacy policy directly.

## Local processing

All image processing (Sharp) and text recognition (Tesseract.js) run locally. No cloud vision or OCR services are used.

## Data storage

Replicant MCP maintains an in-memory cache for performance during a session. It does not persist device data to disk beyond what the user explicitly saves. Cache contents are discarded when the server stops.

## No data collection

Replicant MCP does not:

- Collect personal information
- Track usage or behavior
- Send data to third parties
- Store device data after the session ends
- Require user accounts or authentication

## Changes to this policy

Updates will be posted to this file in the repository. The effective date at the top will be updated accordingly.

## Contact

For privacy questions, open an issue at [github.com/thecombatwombat/replicant-mcp](https://github.com/thecombatwombat/replicant-mcp/issues).
