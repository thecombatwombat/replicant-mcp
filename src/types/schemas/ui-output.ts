import { z } from "zod";

const BoundsSchema = z.object({
  left: z.number(),
  top: z.number(),
  right: z.number(),
  bottom: z.number(),
});

/**
 * Simplified node in full dump tree
 */
const SimplifiedNodeSchema: z.ZodType<{
  className?: string;
  text?: string;
  resourceId?: string;
  bounds: string;
  clickable?: boolean;
  children?: unknown[];
}> = z.lazy(() =>
  z.object({
    className: z.string().optional(),
    text: z.string().optional(),
    resourceId: z.string().optional(),
    bounds: z.string(),
    clickable: z.boolean().optional(),
    children: z.array(SimplifiedNodeSchema).optional(),
  })
);

/**
 * Output for ui dump operation (full mode)
 */
export const UiDumpFullOutput = z.object({
  dumpId: z.string(),
  tree: z.array(SimplifiedNodeSchema),
  deviceId: z.string(),
  warning: z.string().optional(),
});

/**
 * Compact element shape
 */
const CompactElementSchema = z.object({
  text: z.string().optional(),
  type: z.string().optional(),
  x: z.number(),
  y: z.number(),
  resourceId: z.string().optional(),
});

/**
 * Output for ui dump operation (compact mode)
 */
export const UiDumpCompactOutput = z.object({
  dumpId: z.string(),
  elements: z.array(CompactElementSchema),
  count: z.number(),
  totalCount: z.number(),
  hasMore: z.boolean(),
  offset: z.number(),
  limit: z.number(),
  deviceId: z.string(),
  hint: z.string().optional(),
  warning: z.string().optional(),
});

/**
 * Find element shape (accessibility node in find result)
 */
const FindElementSchema = z.object({
  index: z.number(),
  text: z.string().optional(),
  resourceId: z.string().optional(),
  className: z.string().optional(),
  centerX: z.number().optional(),
  centerY: z.number().optional(),
  center: z.object({ x: z.number(), y: z.number() }).optional(),
  bounds: z.union([BoundsSchema, z.string()]).optional(),
  clickable: z.boolean().optional(),
  confidence: z.number().optional(),
});

/**
 * Output for ui find operation
 */
export const UiFindOutput = z.object({
  elements: z.array(FindElementSchema),
  count: z.number(),
  deviceId: z.string(),
  tier: z.number().optional(),
  confidence: z.enum(["high", "medium", "low"]).optional(),
  source: z.enum(["accessibility", "ocr", "visual", "grid"]).optional(),
  fallbackReason: z.string().optional(),
  sortedByProximityTo: z.object({
    query: z.string(),
    anchor: z.object({ x: z.number(), y: z.number() }),
    method: z.enum(["containment", "distance"]),
  }).optional(),
  nearestToWarning: z.string().optional(),
  candidates: z.array(z.object({
    index: z.number(),
    bounds: z.string(),
    center: z.object({ x: z.number(), y: z.number() }),
    image: z.string(),
  })).optional(),
  truncated: z.boolean().optional(),
  totalCandidates: z.number().optional(),
  gridImage: z.string().optional(),
  gridPositions: z.array(z.string()).optional(),
  visualFallback: z.object({
    screenshotPath: z.string(),
    screenshotBase64: z.string().optional(),
    screen: z.object({
      width: z.number(),
      height: z.number(),
      density: z.number(),
    }),
    app: z.object({
      packageName: z.string(),
      activityName: z.string(),
    }),
    hint: z.string().optional(),
  }).optional(),
});

/**
 * Output for ui tap operation
 */
export const UiTapOutput = z.object({
  tapped: z.object({
    x: z.number(),
    y: z.number(),
    deviceSpace: z.boolean(),
  }),
  deviceId: z.string(),
});

/**
 * Output for ui input operation
 */
export const UiInputOutput = z.object({
  input: z.string(),
  deviceId: z.string(),
});

/**
 * Output for ui scroll operation
 */
export const UiScrollOutput = z.object({
  scrolled: z.object({
    direction: z.enum(["up", "down", "left", "right"]),
    amount: z.number(),
  }),
  deviceId: z.string(),
});

/**
 * Output for ui screenshot operation (passthrough from adapter)
 */
export const UiScreenshotOutput = z.object({
  screenshotPath: z.string().optional(),
  base64: z.string().optional(),
  width: z.number().optional(),
  height: z.number().optional(),
  deviceId: z.string(),
}).passthrough();

/**
 * Output for ui accessibility-check operation (passthrough from adapter)
 */
export const UiAccessibilityCheckOutput = z.object({
  deviceId: z.string(),
}).passthrough();

/**
 * Output for ui visual-snapshot operation (passthrough from adapter)
 */
export const UiVisualSnapshotOutput = z.object({
  screenshotPath: z.string().optional(),
  screenshotBase64: z.string().optional(),
  screen: z.object({
    width: z.number(),
    height: z.number(),
    density: z.number(),
  }).optional(),
  app: z.object({
    packageName: z.string(),
    activityName: z.string(),
  }).optional(),
  deviceId: z.string(),
}).passthrough();

/**
 * Union of all ui tool outputs
 */
export const UiOutput = z.union([
  UiDumpFullOutput,
  UiDumpCompactOutput,
  UiFindOutput,
  UiTapOutput,
  UiInputOutput,
  UiScrollOutput,
  UiScreenshotOutput,
  // accessibility-check and visual-snapshot use passthrough
]);

export type UiDumpFullOutputType = z.infer<typeof UiDumpFullOutput>;
export type UiDumpCompactOutputType = z.infer<typeof UiDumpCompactOutput>;
export type UiFindOutputType = z.infer<typeof UiFindOutput>;
export type UiTapOutputType = z.infer<typeof UiTapOutput>;
export type UiInputOutputType = z.infer<typeof UiInputOutput>;
export type UiScrollOutputType = z.infer<typeof UiScrollOutput>;
