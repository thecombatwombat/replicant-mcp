# Developer Experience: Simplified Tool Authoring

**Status:** Design complete
**Epic:** Developer Experience
**Created:** 2025-01-21

## Overview

Reduce boilerplate when adding new MCP tools by eliminating schema duplication and manual wiring.

## Problem

Currently, adding a new tool requires:
1. Zod schema for input validation
2. JSON schema for MCP tool definition (duplicates #1)
3. Handler function
4. Manual registration in `server.ts`

This is ~80 lines per tool, with redundant schema definitions.

## Goals

- Single source of truth for tool schemas (Zod only)
- Auto-generate JSON schema from Zod
- No manual wiring in `server.ts`
- Existing tests should pass with minimal changes

## Non-goals

- Rewriting in Python/FastMCP
- Changing the tool behavior or API surface
- Breaking existing tool implementations

## Solution

### 1. `defineTool()` helper

```typescript
// src/tools/define-tool.ts
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { ServerContext } from "../server.js";

export function defineTool<T extends z.ZodType>(config: {
  name: string;
  description: string;
  input: T;
  handler: (input: z.infer<T>, context: ServerContext) => Promise<unknown>;
}) {
  return {
    definition: {
      name: config.name,
      description: config.description,
      inputSchema: zodToJsonSchema(config.input),
    },
    handler: config.handler,
    schema: config.input,
  };
}
```

### 2. Tool definition (example: adb-logcat)

```typescript
// src/tools/adb-logcat.ts
import { z } from "zod";
import { defineTool } from "./define-tool.js";

export const adbLogcatTool = defineTool({
  name: "adb-logcat",
  description: "Read device logs. Returns summary with logId for full output.",
  input: z.object({
    lines: z.number().default(100).describe("Number of lines (default: 100)"),
    package: z.string().optional().describe("Filter by package name"),
    tags: z.array(z.string()).optional().describe("Filter by log tags"),
    level: z.enum(["verbose", "debug", "info", "warn", "error"]).optional(),
    rawFilter: z.string().optional().describe("Raw logcat filter string"),
    since: z.string().optional().describe("Time filter (e.g., '5m' or ISO timestamp)"),
  }),
  handler: async (input, context) => {
    // ... existing handler logic unchanged
  },
});
```

### 3. Auto-discovery in server.ts

```typescript
// src/server.ts
import * as tools from "./tools/index.js";

const allTools = Object.values(tools).filter(t => t.definition && t.handler);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: allTools.map(t => t.definition),
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const tool = allTools.find(t => t.definition.name === request.params.name);
  if (!tool) throw new Error(`Unknown tool: ${request.params.name}`);

  const validated = tool.schema.parse(request.params.arguments);
  const result = await tool.handler(validated, context);
  return { content: [{ type: "text", text: JSON.stringify(result) }] };
});
```

## Dependencies

New dev dependency: `zod-to-json-schema`

```bash
npm install zod-to-json-schema
```

## Migration Strategy

1. Add `defineTool()` helper and `zod-to-json-schema`
2. Migrate one tool as proof of concept
3. Run tests to verify schema compatibility
4. Migrate remaining tools incrementally
5. Remove old schema definitions and manual wiring

## Effort Estimate

- Initial setup + one tool migration: 1-2 hours
- Full migration (12 tools): 2-3 hours
- Total: ~4 hours

## Risks

- `zod-to-json-schema` output may differ slightly from hand-written schemas
- Need to verify MCP clients accept the generated schemas

## Open Questions

None - straightforward refactor.
