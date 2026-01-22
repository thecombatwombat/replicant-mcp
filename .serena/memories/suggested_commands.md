# Development Commands

## Build & Run
```bash
npm run build         # Compile TypeScript to dist/
npm run dev           # Watch mode (tsc --watch)
npm start             # Build and start MCP server
```

## Testing
```bash
npm test              # Run all tests in watch mode
npm run test -- --run # Run all tests once (216 tests)
npm run test:unit     # Unit tests only (services, adapters, tools)
npm run test:integration  # MCP protocol compliance tests
npm run test:coverage # Tests with coverage report
npm run validate      # Build + all tests (use before commits)
```

## Utilities
```bash
npm run check-prereqs # Verify Android SDK setup
npm run smoke-test    # Basic functionality test
npm run test:device   # Real device test (tsx scripts/real-device-test.ts)
```

## Git Workflow

**No direct pushes to master** - all changes via PR.

### Branch Naming
```bash
git checkout -b feature/<name>   # New functionality
git checkout -b fix/<name>       # Bug fixes
git checkout -b docs/<name>      # Documentation only
git checkout -b refactor/<name>  # Code restructuring
git checkout -b chore/<name>     # Maintenance (deps, CI, tooling)
```

### Commit Messages
Use conventional commits:
- `feat:` - New feature
- `fix:` - Bug fix
- `refactor:` - Code restructuring
- `docs:` - Documentation
- `chore:` - Maintenance

## Android SDK Commands
```bash
adb devices              # List connected devices
adb logcat               # Device logs
emulator -list-avds      # List available emulators
avdmanager list avd      # List AVDs with details
```

## Environment
- **ANDROID_HOME**: Android SDK path (`$HOME/Library/Android/sdk` on macOS)
- **REPLICANT_CONFIG**: Path to YAML config file (optional)
- **Screenshots**: Saved to `.replicant/screenshots/` in working directory
