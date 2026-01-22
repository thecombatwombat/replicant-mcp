# Code Style and Conventions

## TypeScript
- **Strict mode enabled** (`"strict": true` in tsconfig)
- **ES Modules**: Use `.js` extension in imports (e.g., `import { foo } from "./bar.js"`)
- **Target**: ES2022
- **Module resolution**: NodeNext

## Naming Conventions
- **Files**: kebab-case (`ui-dump.ts`, `cache-manager.ts`)
- **Functions**: camelCase (`handleUiTool`, `getElementCenter`)
- **Types/Interfaces**: PascalCase (`AccessibilityNode`, `UiInput`)
- **Constants**: UPPER_SNAKE_CASE for config values (`CACHE_TTLS`)
- **Schemas**: camelCase with `Schema` suffix (`uiInputSchema`)

## Code Patterns

### Zod Schemas
Use Zod for input validation with inferred types:
```typescript
export const uiInputSchema = z.object({
  operation: z.enum(["dump", "find", "tap"]),
  text: z.string().optional(),
});
export type UiInput = z.infer<typeof uiInputSchema>;
```

### Tool Definitions
Each tool in `src/tools/` exports:
- `*InputSchema` - Zod schema
- `*ToolDefinition` - MCP tool definition object
- `handle*Tool` - Handler function

### Type Guards
Use type guard functions for union types:
```typescript
function isAccessibilityNode(el: FindElement): el is AccessibilityNode {
  return "centerX" in el && "className" in el;
}
```

### Imports
- Group imports: external deps first, then internal
- Use named exports, not default exports
- Re-export from index files for clean imports

## Documentation
- JSDoc comments for public APIs (optional but encouraged)
- Inline comments for complex logic
- Design docs in `docs/plans/` with format `YYYY-MM-DD-<topic>-design.md`

## Git Commits
- Use conventional commits: `feat:`, `fix:`, `refactor:`, `docs:`, `chore:`
- Keep commits atomic and focused
