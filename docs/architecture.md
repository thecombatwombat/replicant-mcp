# Architecture & Design Philosophy

## Progressive Disclosure

Gradle builds can produce thousands of lines of output. Dumping all of that into an AI context is wasteful and confusing.

Instead, replicant-mcp returns **summaries with cache IDs**:

```json
{
  "buildId": "build-a1b2c3-1705789200",
  "summary": {
    "success": true,
    "duration": "34s",
    "apkSize": "12.4 MB",
    "warnings": 2
  }
}
```

If the AI needs the full output (e.g., to debug a failure), it can request it:

```json
{ "tool": "gradle-get-details", "id": "build-a1b2c3-1705789200", "detailType": "errors" }
```

This typically reduces token usage by **90-99%**.

## Accessibility-First UI

Most AI-driven UI automation uses screenshots: capture the screen, send it to a vision model, get coordinates, click.

replicant-mcp takes a different approach: it reads the **accessibility tree**—the same structured data that powers screen readers. This is:

- **Faster** — No image processing
- **Cheaper** — Text is smaller than images
- **More reliable** — Elements are identified by text/ID, not pixel coordinates
- **Better for apps** — Encourages accessible app development

When accessibility data isn't available, the tool falls back through multiple tiers:
1. **Accessibility tree** — fast, reliable, text-based
2. **OCR fallback** — Tesseract extracts text from screenshot
3. **Visual fallback** — returns screenshot + metadata for AI vision

## Single Device Focus

Instead of passing `deviceId` to every command, you select a device once:

```json
{ "tool": "adb-device", "operation": "select", "deviceId": "emulator-5554" }
```

All subsequent commands target that device automatically.

## Safety Guards

The `adb-shell` tool blocks dangerous commands like `rm -rf /`, `reboot`, and `su`. You can run shell commands, but not brick your device.
