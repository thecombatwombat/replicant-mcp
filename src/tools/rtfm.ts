import { z } from "zod";
import { readFile } from "fs/promises";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const RTFM_DIR = join(__dirname, "../../docs/rtfm");

export const rtfmInputSchema = z.object({
  category: z.string().optional(),
  tool: z.string().optional(),
});

export type RtfmInput = z.infer<typeof rtfmInputSchema>;

const TOOL_TO_CATEGORY: Record<string, string> = {
  "gradle-build": "build",
  "gradle-test": "build",
  "gradle-list": "build",
  "gradle-get-details": "build",
  "adb-device": "adb",
  "adb-app": "adb",
  "adb-logcat": "adb",
  "adb-shell": "adb",
  "emulator-device": "emulator",
  "ui-query": "ui",
  "ui-action": "ui",
  "ui-capture": "ui",
  "cache": "cache",
  "rtfm": "index",
};

export async function handleRtfmTool(input: RtfmInput): Promise<{ content: string }> {
  if (!input.category && !input.tool) {
    const content = await readFile(join(RTFM_DIR, "index.md"), "utf-8");
    return { content };
  }

  if (input.category) {
    try {
      const content = await readFile(join(RTFM_DIR, `${input.category}.md`), "utf-8");
      return { content };
    } catch {
      return { content: `Category '${input.category}' not found. Available: build, adb, emulator, ui, cache` };
    }
  }

  const category = TOOL_TO_CATEGORY[input.tool!] || "index";
  try {
    const content = await readFile(join(RTFM_DIR, `${category}.md`), "utf-8");
    const toolSection = extractToolSection(content, input.tool!);
    return { content: toolSection || content };
  } catch {
    return { content: `Tool '${input.tool}' not found.` };
  }
}

function extractToolSection(content: string, toolName: string): string | null {
  const regex = new RegExp(`## ${toolName}[\\s\\S]*?(?=## |$)`, "i");
  const match = content.match(regex);
  return match ? match[0].trim() : null;
}

export const rtfmToolDefinition = {
  name: "rtfm",
  description: "Get documentation. Pass category or tool name.",
  inputSchema: {
    type: "object",
    properties: {
      category: { type: "string", description: "Category: build, adb, emulator, ui, cache" },
      tool: { type: "string", description: "Tool name for specific docs" },
    },
  },
  annotations: {
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false,
  },
};
