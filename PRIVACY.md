# Privacy Policy

**Effective date:** April 6, 2026

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

On-device text recognition (used by `ui-query` and `ui-capture` in visual mode) runs locally against a language model file shipped inside the package. No image or text is uploaded, and no model is fetched at runtime.

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
