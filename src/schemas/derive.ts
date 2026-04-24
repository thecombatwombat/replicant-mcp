import { z } from "zod";

type McpInputSchema = {
  type: "object";
  properties?: Record<string, unknown>;
  required?: string[];
};

// Recursively removes $schema and additionalProperties from a JSON schema
// tree. Strict-mode enforcement happens at the Zod validator; the wire
// payload stays compact and consistent (top-level and nested alike).
function stripMeta(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(stripMeta);
  if (node && typeof node === "object") {
    const entries = Object.entries(node as Record<string, unknown>)
      .filter(([k]) => k !== "$schema" && k !== "additionalProperties")
      .map(([k, v]) => [k, stripMeta(v)] as const);
    return Object.fromEntries(entries);
  }
  return node;
}

export function toMcpJsonSchema(schema: z.ZodType): McpInputSchema {
  const json = z.toJSONSchema(schema);
  return stripMeta(json) as McpInputSchema;
}
