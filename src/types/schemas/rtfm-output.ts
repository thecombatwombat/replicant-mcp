import { z } from "zod";

/**
 * Output for rtfm tool - always returns { content: string }
 */
export const RtfmOutput = z.object({
  content: z.string(),
});

export type RtfmOutputType = z.infer<typeof RtfmOutput>;
