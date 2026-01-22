# Code Style and Conventions

## TypeScript Configuration
- **Strict mode**: `"strict": true`
- **Target**: ES2022
- **Module**: NodeNext (ES Modules)
- **Imports**: Use `.js` extension (`import { foo } from "./bar.js"`)

## Naming Conventions
| Type | Convention | Example |
|------|------------|---------|
| Files | kebab-case | `cache-manager.ts`, `ui-dump.ts` |
| Functions | camelCase | `handleUiTool`, `getElementCenter` |
| Types/Interfaces | PascalCase | `AccessibilityNode`, `UiInput` |
| Constants (config) | UPPER_SNAKE_CASE | `CACHE_TTLS`, `DEFAULT_CONFIG` |
| Zod schemas | camelCase + Schema | `uiInputSchema` |

## Tool Implementation Pattern

Each tool in `src/tools/` exports:
```typescript
// 1. Zod schema for input validation
export const exampleInputSchema = z.object({
  operation: z.enum(["list", "get"]),
  id: z.string().optional(),
});

// 2. Inferred TypeScript type
export type ExampleInput = z.infer<typeof exampleInputSchema>;

// 3. MCP tool definition
export const exampleToolDefinition = {
  name: "example-tool",
  description: "Tool description",
  inputSchema: zodToJsonSchema(exampleInputSchema),
};

// 4. Handler function
export async function handleExampleTool(
  input: ExampleInput,
  context: ServerContext
): Promise<ToolResult> {
  // Implementation
}
```

## Type Guards
Use type guard functions for union types:
```typescript
function isAccessibilityNode(el: FindElement): el is AccessibilityNode {
  return "centerX" in el && "className" in el;
}
```

## Import Organization
1. External dependencies first
2. Internal modules second
3. Use named exports (not default)
4. Re-export from index.ts files

## Error Handling
- Use custom error types from `src/types/errors.ts`
- Return structured error responses from tools
- Include actionable hints in error messages

## Comments
- JSDoc for public APIs (optional but encouraged)
- Inline comments for non-obvious logic
- Design docs in `docs/plans/YYYY-MM-DD-<topic>-design.md`
