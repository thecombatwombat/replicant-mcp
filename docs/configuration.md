# Configuration

replicant-mcp can be configured via a YAML file. Set the `REPLICANT_CONFIG` environment variable to the path:

```bash
export REPLICANT_CONFIG=/path/to/config.yaml
```

## Example config.yaml

```yaml
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

## Output Directory

replicant-mcp stores screenshots in `.replicant/screenshots/` within your current working directory. Add this to your `.gitignore`:

```gitignore
.replicant/
```
