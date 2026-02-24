# Build Tools

## gradle-build

Build an Android application.

**Operations:**
- `assembleDebug` - Build debug APK
- `assembleRelease` - Build release APK
- `bundle` - Build Android App Bundle

**Parameters:**
- `operation` (required): Build operation
- `module`: Module path (e.g., ":app", ":feature:login")
- `flavor`: Product flavor name

**Returns:** `{ buildId, summary: { success, duration, apkSize, warnings } }`

**Example:**
```json
{ "operation": "assembleDebug", "module": ":app" }
```

## gradle-test

Run tests.

**Operations:**
- `unitTest` - Run unit tests
- `connectedTest` - Run instrumented tests on device
- `saveBaseline` - Run tests and save current results as baseline
- `clearBaseline` - Remove a saved baseline

**Parameters:**
- `operation` (required): Test type
- `module`: Module path
- `filter`: Test filter (e.g., "com.example.MyTest", "*LoginTest*")
- `taskName`: Baseline key override (default: operation name)

## gradle-list

Introspect project structure.

**Operations:**
- `variants` - List build variants
- `modules` - List project modules
- `tasks` - List Gradle tasks

## gradle-get-details

Fetch full output for a previous build/test.

**Parameters:**
- `id` (required): Build or test ID from previous operation
- `detailType`: "logs" | "errors" | "tasks" | "all" (default: "all")
- `maxChars`: Truncate large text fields
- `summaryOnly`: Return compact summary payload for logs/tasks/all
- `previewChars`: Preview length for summary mode (logs/all, default: 400)
