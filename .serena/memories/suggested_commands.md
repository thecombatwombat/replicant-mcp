# Suggested Commands

## Development Commands
```bash
# Build
npm run build          # Compile TypeScript to dist/
npm run dev            # Watch mode for development

# Testing
npm test               # Run all tests (Vitest, watch mode)
npm run test:unit      # Unit tests only (services, adapters, tools)
npm run test:integration  # MCP protocol compliance tests
npm run test:live      # Live device tests
npm run test:coverage  # Tests with coverage report

# Validation
npm run validate       # Build + run all tests (use before commits)

# Running
npm start              # Start MCP server
npm run check-prereqs  # Verify Android SDK setup
npm run smoke-test     # Basic functionality test
```

## Git Workflow
```bash
# Branch naming conventions:
git checkout -b feature/<name>   # New functionality
git checkout -b fix/<name>       # Bug fixes
git checkout -b docs/<name>      # Documentation only
git checkout -b refactor/<name>  # Code restructuring
git checkout -b chore/<name>     # Maintenance tasks

# No direct pushes to master - all changes via PR
```

## System Commands (macOS/Darwin)
```bash
# Standard unix commands work
ls, cd, grep, find, cat, head, tail

# Android SDK tools (must be in PATH)
adb devices            # List connected devices
adb logcat             # Device logs
emulator -list-avds    # List available emulators
avdmanager list avd    # List AVDs with details
```

## Useful Paths
- Android SDK: `$HOME/Library/Android/sdk` (typical macOS location)
- Screenshots: `.replicant/screenshots/` (in project root)
- Config file: Set `REPLICANT_CONFIG` env var to YAML config path
