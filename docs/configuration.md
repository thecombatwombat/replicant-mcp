# Configuration

replicant-mcp can be configured via a YAML file. Set the `REPLICANT_CONFIG` environment variable to the path:

```bash
export REPLICANT_CONFIG=/path/to/config.yaml
```

## Example config.yaml

```yaml
build:
  # Absolute path to Android project root containing gradlew
  projectRoot: /home/user/my-android-app

ui:
  # Always use visual mode (skip accessibility) for these packages
  visualModePackages:
    - com.example.legacy.app

  # Auto-include screenshot when find returns no results (default: true)
  autoFallbackScreenshot: true

  # Include base64-encoded screenshot in responses (default: false)
  includeBase64: false
```

Most users won't need a config file—the defaults work well for typical Android apps.

## Environment Variables

| Variable | Description |
|----------|-------------|
| `REPLICANT_CONFIG` | Path to the YAML config file |
| `REPLICANT_PROJECT_ROOT` | Absolute path to the Android project root containing `gradlew`. Takes precedence over `build.projectRoot` in config. |

## Gradle Setup

When replicant-mcp runs as an MCP server (e.g., via Claude Desktop or Claude Code), it launches outside your Android project directory. This means Gradle commands will fail because `./gradlew` cannot be found.

To fix this, tell replicant-mcp where your project is using either:

1. **Environment variable** (quick, no config file needed):
   ```bash
   export REPLICANT_PROJECT_ROOT=/home/user/my-android-app
   ```

2. **Config file** (for users who already have a `replicant.yaml`):
   ```yaml
   build:
     projectRoot: /home/user/my-android-app
   ```

The environment variable takes precedence over the config file value, making it easy to override per-session. If neither is set, replicant-mcp uses the current working directory (which works when you run the server from within your project).

## Output Directory

replicant-mcp stores screenshots in `.replicant/screenshots/` within your current working directory. Add this to your `.gitignore`:

```gitignore
.replicant/
```
