import { z } from "zod";
import { ServerContext } from "../server.js";
import { CACHE_TTLS } from "../types/index.js";

export const gradleListInputSchema = z.object({
  operation: z.enum(["variants", "modules", "tasks"]),
  module: z.string().optional(),
});

export type GradleListInput = z.infer<typeof gradleListInputSchema>;

export async function handleGradleListTool(
  input: GradleListInput,
  context: ServerContext
): Promise<Record<string, unknown>> {
  switch (input.operation) {
    case "modules": {
      const modules = await context.gradle.listModules();
      return { modules };
    }

    case "variants": {
      const variants = await context.gradle.listVariants(input.module);
      return { variants, module: input.module || "all" };
    }

    case "tasks": {
      const tasks = await context.gradle.listTasks(input.module);

      // Cache full task list
      const listId = context.cache.generateId("tasks");
      context.cache.set(listId, { tasks }, "tasks", CACHE_TTLS.GRADLE_VARIANTS);

      // Return categorized summary
      const buildTasks = tasks.filter((t) => t.includes("assemble") || t.includes("bundle"));
      const testTasks = tasks.filter((t) => t.includes("test") || t.includes("Test"));
      const cleanTasks = tasks.filter((t) => t.includes("clean"));

      return {
        listId,
        summary: {
          totalTasks: tasks.length,
          buildTasks: buildTasks.slice(0, 10),
          testTasks: testTasks.slice(0, 10),
          cleanTasks: cleanTasks.slice(0, 5),
        },
        module: input.module || "all",
      };
    }

    default:
      throw new Error(`Unknown operation: ${input.operation}`);
  }
}

export const gradleListToolDefinition = {
  name: "gradle-list",
  description: "Introspect project structure. Operations: modules, variants, tasks.",
  inputSchema: {
    type: "object",
    properties: {
      operation: {
        type: "string",
        enum: ["variants", "modules", "tasks"],
      },
      module: { type: "string", description: "Module path (for variants/tasks)" },
    },
    required: ["operation"],
  },
};
