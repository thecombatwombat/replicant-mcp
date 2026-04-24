import { z } from "zod";

type McpInputSchema = {
  type: "object";
  properties?: Record<string, unknown>;
  required?: string[];
};

export function toMcpJsonSchema(schema: z.ZodType): McpInputSchema {
  const json = z.toJSONSchema(schema) as Record<string, unknown>;
  const {
    $schema: _schema,
    additionalProperties: _additionalProperties,
    ...rest
  } = json;
  void _schema;
  void _additionalProperties;
  return rest as McpInputSchema;
}
