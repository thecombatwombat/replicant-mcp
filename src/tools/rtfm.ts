import { z } from "zod";
import { readFile } from "fs/promises";
import { join, dirname, resolve } from "path";
import { fileURLToPath } from "url";
import { ReplicantError, ErrorCode } from "../types/index.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const RTFM_DIR = resolve(join(__dirname, "../../docs/rtfm"));

export const rtfmInputSchema = z.object({
  category: z.string().optional(),
  tool: z.string().optional(),
});

export type RtfmInput = z.infer<typeof rtfmInputSchema>;

function safeRtfmPath(filename: string): string {
  const resolved = resolve(RTFM_DIR, filename);
  if (!resolved.startsWith(RTFM_DIR + "/") && resolved !== RTFM_DIR) {
    throw new ReplicantError(
      ErrorCode.INPUT_VALIDATION_FAILED,
      "Invalid documentation path",
      "Use a valid category name: build, adb, emulator, ui",
    );
  }
  return resolved;
}

export async function handleRtfmTool(input: RtfmInput): Promise<{ content: string }> {
  if (!input.category && !input.tool) {
    // Return index
    const content = await readFile(join(RTFM_DIR, "index.md"), "utf-8");
    return { content };
  }

  if (input.category) {
    try {
      const filePath = safeRtfmPath(`${input.category}.md`);
      const content = await readFile(filePath, "utf-8");
      return { content };
    } catch (error) {
      if (error instanceof ReplicantError) throw error;
      return { content: `Category '${input.category}' not found. Available: build, adb, emulator, ui` };
    }
  }

  if (input.tool) {
    // Map tool to category
    const toolToCategory: Record<string, string> = {
      "gradle-build": "build",
      "gradle-test": "build",
      "gradle-list": "build",
      "gradle-get-details": "build",
      "adb-device": "adb",
      "adb-app": "adb",
      "adb-logcat": "adb",
      "adb-shell": "adb",
      "emulator-device": "emulator",
      "ui": "ui",
      "cache": "build",
      "rtfm": "build",
    };

    const category = toolToCategory[input.tool] || "index";
    try {
      const filePath = safeRtfmPath(`${category}.md`);
      const content = await readFile(filePath, "utf-8");

      // Try to extract just the relevant section
      const toolSection = extractToolSection(content, input.tool);
      return { content: toolSection || content };
    } catch {
      return { content: `Tool '${input.tool}' not found.` };
    }
  }

  return { content: "No documentation found." };
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
      category: { type: "string", description: "Category: build, adb, emulator, ui" },
      tool: { type: "string", description: "Tool name for specific docs" },
    },
  },
};
