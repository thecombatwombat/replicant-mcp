# OCR Fallback Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add automatic OCR fallback to the `find` operation so text can be found on screen even when apps don't expose it in their accessibility tree.

**Architecture:** When `ui { operation: "find", selector: { text: "..." } }` returns no results from the accessibility tree, automatically take a screenshot, run OCR via tesseract.js, and search the extracted text. Return matches with bounds/center coordinates that can be used for tapping.

**Tech Stack:** TypeScript, tesseract.js (WASM-based OCR), vitest for testing

---

## Task 1: Add tesseract.js Dependency

**Files:**
- Modify: `package.json`

**Step 1: Install tesseract.js**

Run:
```bash
npm install tesseract.js
```

**Step 2: Verify installation**

Run:
```bash
npm ls tesseract.js
```

Expected: Shows tesseract.js version (5.x)

**Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add tesseract.js dependency for OCR support"
```

---

## Task 2: Create OCR Types

**Files:**
- Create: `src/types/ocr.ts`
- Modify: `src/types/index.ts`

**Step 1: Create the OCR types file**

Create `src/types/ocr.ts`:

```typescript
export interface OcrBounds {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export interface OcrResult {
  text: string;
  confidence: number;
  bounds: OcrBounds;
}

export interface OcrElement {
  index: number;
  text: string;
  bounds: string; // Format: "[x0,y0][x1,y1]" for consistency with accessibility
  center: { x: number; y: number };
  confidence: number;
}
```

**Step 2: Export from index**

Modify `src/types/index.ts` - add at the end:

```typescript
export * from "./ocr.js";
```

**Step 3: Verify TypeScript compiles**

Run:
```bash
npm run build
```

Expected: No errors

**Step 4: Commit**

```bash
git add src/types/ocr.ts src/types/index.ts
git commit -m "feat: add OCR types for text extraction results"
```

---

## Task 3: Create OCR Service - Basic Structure

**Files:**
- Create: `src/services/ocr.ts`
- Modify: `src/services/index.ts`

**Step 1: Create the OCR service skeleton**

Create `src/services/ocr.ts`:

```typescript
import Tesseract from "tesseract.js";
import { OcrResult } from "../types/ocr.js";

let worker: Tesseract.Worker | null = null;

async function getWorker(): Promise<Tesseract.Worker> {
  if (!worker) {
    worker = await Tesseract.createWorker("eng");
  }
  return worker;
}

export async function extractText(imagePath: string): Promise<OcrResult[]> {
  const w = await getWorker();
  const { data } = await w.recognize(imagePath);

  const results: OcrResult[] = [];

  for (const word of data.words) {
    if (word.text.trim()) {
      results.push({
        text: word.text,
        confidence: word.confidence / 100, // Normalize to 0-1
        bounds: {
          x0: word.bbox.x0,
          y0: word.bbox.y0,
          x1: word.bbox.x1,
          y1: word.bbox.y1,
        },
      });
    }
  }

  return results;
}

export async function terminateOcr(): Promise<void> {
  if (worker) {
    await worker.terminate();
    worker = null;
  }
}
```

**Step 2: Export from services index**

Modify `src/services/index.ts` - add:

```typescript
export * from "./ocr.js";
```

**Step 3: Verify TypeScript compiles**

Run:
```bash
npm run build
```

Expected: No errors

**Step 4: Commit**

```bash
git add src/services/ocr.ts src/services/index.ts
git commit -m "feat: add OCR service with tesseract.js worker"
```

---

## Task 4: Create OCR Service Tests

**Files:**
- Create: `tests/services/ocr.test.ts`
- Create: `tests/fixtures/ocr-test-image.png` (we'll mock this)

**Step 1: Write the failing test for extractText**

Create `tests/services/ocr.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { extractText, terminateOcr } from "../../src/services/ocr.js";

// Mock tesseract.js
vi.mock("tesseract.js", () => ({
  default: {
    createWorker: vi.fn().mockResolvedValue({
      recognize: vi.fn().mockResolvedValue({
        data: {
          words: [
            {
              text: "Hello",
              confidence: 95,
              bbox: { x0: 10, y0: 20, x1: 100, y1: 50 },
            },
            {
              text: "World",
              confidence: 87,
              bbox: { x0: 110, y0: 20, x1: 200, y1: 50 },
            },
          ],
        },
      }),
      terminate: vi.fn(),
    }),
  },
}));

describe("OCR Service", () => {
  afterEach(async () => {
    await terminateOcr();
    vi.clearAllMocks();
  });

  describe("extractText", () => {
    it("extracts words with bounds from image", async () => {
      const results = await extractText("/fake/path.png");

      expect(results).toHaveLength(2);
      expect(results[0]).toEqual({
        text: "Hello",
        confidence: 0.95,
        bounds: { x0: 10, y0: 20, x1: 100, y1: 50 },
      });
      expect(results[1]).toEqual({
        text: "World",
        confidence: 0.87,
        bounds: { x0: 110, y0: 20, x1: 200, y1: 50 },
      });
    });

    it("filters out empty text results", async () => {
      const Tesseract = await import("tesseract.js");
      vi.mocked(Tesseract.default.createWorker).mockResolvedValueOnce({
        recognize: vi.fn().mockResolvedValue({
          data: {
            words: [
              { text: "Valid", confidence: 90, bbox: { x0: 0, y0: 0, x1: 10, y1: 10 } },
              { text: "   ", confidence: 80, bbox: { x0: 20, y0: 0, x1: 30, y1: 10 } },
              { text: "", confidence: 70, bbox: { x0: 40, y0: 0, x1: 50, y1: 10 } },
            ],
          },
        }),
        terminate: vi.fn(),
      } as any);

      // Force new worker creation
      await terminateOcr();
      const results = await extractText("/fake/path.png");

      expect(results).toHaveLength(1);
      expect(results[0].text).toBe("Valid");
    });

    it("normalizes confidence to 0-1 range", async () => {
      const results = await extractText("/fake/path.png");

      expect(results[0].confidence).toBe(0.95);
      expect(results[0].confidence).toBeLessThanOrEqual(1);
      expect(results[0].confidence).toBeGreaterThanOrEqual(0);
    });

    it("reuses worker across multiple calls", async () => {
      const Tesseract = await import("tesseract.js");

      await extractText("/fake/path1.png");
      await extractText("/fake/path2.png");

      // Worker should only be created once
      expect(Tesseract.default.createWorker).toHaveBeenCalledTimes(1);
    });
  });

  describe("terminateOcr", () => {
    it("terminates worker when called", async () => {
      const Tesseract = await import("tesseract.js");
      const mockWorker = await Tesseract.default.createWorker("eng");

      await extractText("/fake/path.png");
      await terminateOcr();

      expect(mockWorker.terminate).toHaveBeenCalled();
    });
  });
});
```

**Step 2: Run test to verify it passes**

Run:
```bash
npm test tests/services/ocr.test.ts
```

Expected: All tests PASS (we mocked tesseract.js)

**Step 3: Commit**

```bash
git add tests/services/ocr.test.ts
git commit -m "test: add OCR service unit tests"
```

---

## Task 5: Add OCR Text Search Function

**Files:**
- Modify: `src/services/ocr.ts`
- Modify: `tests/services/ocr.test.ts`

**Step 1: Write the failing test for searchText**

Add to `tests/services/ocr.test.ts`:

```typescript
import { extractText, terminateOcr, searchText } from "../../src/services/ocr.js";

// ... existing tests ...

describe("searchText", () => {
  it("finds text containing search term (case-insensitive)", async () => {
    const ocrResults = [
      { text: "Chobani", confidence: 0.95, bounds: { x0: 10, y0: 20, x1: 100, y1: 50 } },
      { text: "High", confidence: 0.90, bounds: { x0: 110, y0: 20, x1: 160, y1: 50 } },
      { text: "Protein", confidence: 0.88, bounds: { x0: 170, y0: 20, x1: 250, y1: 50 } },
    ];

    const results = searchText(ocrResults, "chobani");

    expect(results).toHaveLength(1);
    expect(results[0].text).toBe("Chobani");
  });

  it("returns elements with center coordinates", async () => {
    const ocrResults = [
      { text: "Button", confidence: 0.95, bounds: { x0: 100, y0: 200, x1: 200, y1: 250 } },
    ];

    const results = searchText(ocrResults, "button");

    expect(results[0].center).toEqual({ x: 150, y: 225 });
  });

  it("returns elements with formatted bounds string", async () => {
    const ocrResults = [
      { text: "Test", confidence: 0.90, bounds: { x0: 10, y0: 20, x1: 100, y1: 50 } },
    ];

    const results = searchText(ocrResults, "test");

    expect(results[0].bounds).toBe("[10,20][100,50]");
  });

  it("finds partial matches (contains)", async () => {
    const ocrResults = [
      { text: "Chobani High Protein Drinks", confidence: 0.92, bounds: { x0: 10, y0: 20, x1: 300, y1: 50 } },
    ];

    const results = searchText(ocrResults, "protein");

    expect(results).toHaveLength(1);
    expect(results[0].text).toBe("Chobani High Protein Drinks");
  });

  it("returns empty array when no matches", async () => {
    const ocrResults = [
      { text: "Hello", confidence: 0.95, bounds: { x0: 10, y0: 20, x1: 100, y1: 50 } },
    ];

    const results = searchText(ocrResults, "goodbye");

    expect(results).toHaveLength(0);
  });

  it("includes confidence in results", async () => {
    const ocrResults = [
      { text: "Target", confidence: 0.88, bounds: { x0: 10, y0: 20, x1: 100, y1: 50 } },
    ];

    const results = searchText(ocrResults, "target");

    expect(results[0].confidence).toBe(0.88);
  });

  it("assigns sequential indices to results", async () => {
    const ocrResults = [
      { text: "First Match", confidence: 0.95, bounds: { x0: 10, y0: 20, x1: 100, y1: 50 } },
      { text: "Second Match", confidence: 0.90, bounds: { x0: 10, y0: 60, x1: 100, y1: 90 } },
    ];

    const results = searchText(ocrResults, "match");

    expect(results[0].index).toBe(0);
    expect(results[1].index).toBe(1);
  });
});
```

**Step 2: Run test to verify it fails**

Run:
```bash
npm test tests/services/ocr.test.ts
```

Expected: FAIL - searchText not exported

**Step 3: Implement searchText**

Add to `src/services/ocr.ts`:

```typescript
import { OcrResult, OcrElement } from "../types/ocr.js";

// ... existing code ...

export function searchText(ocrResults: OcrResult[], searchTerm: string): OcrElement[] {
  const lowerSearch = searchTerm.toLowerCase();

  const matches = ocrResults.filter(
    (result) => result.text.toLowerCase().includes(lowerSearch)
  );

  return matches.map((match, index) => ({
    index,
    text: match.text,
    bounds: `[${match.bounds.x0},${match.bounds.y0}][${match.bounds.x1},${match.bounds.y1}]`,
    center: {
      x: Math.round((match.bounds.x0 + match.bounds.x1) / 2),
      y: Math.round((match.bounds.y0 + match.bounds.y1) / 2),
    },
    confidence: match.confidence,
  }));
}
```

**Step 4: Run test to verify it passes**

Run:
```bash
npm test tests/services/ocr.test.ts
```

Expected: All tests PASS

**Step 5: Commit**

```bash
git add src/services/ocr.ts tests/services/ocr.test.ts
git commit -m "feat: add searchText function for OCR results"
```

---

## Task 6: Add OCR Fallback to UiAutomatorAdapter

**Files:**
- Modify: `src/adapters/ui-automator.ts`
- Modify: `tests/adapters/ui-automator.test.ts`

**Step 1: Write the failing test for findWithOcrFallback**

Add to `tests/adapters/ui-automator.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
// ... existing imports ...

// Mock OCR service
vi.mock("../../src/services/ocr.js", () => ({
  extractText: vi.fn(),
  searchText: vi.fn(),
  terminateOcr: vi.fn(),
}));

import { extractText, searchText } from "../../src/services/ocr.js";

// ... existing tests ...

describe("findWithOcrFallback", () => {
  let mockAdb: {
    shell: ReturnType<typeof vi.fn>;
    pull: ReturnType<typeof vi.fn>;
  };
  let adapter: UiAutomatorAdapter;

  beforeEach(() => {
    mockAdb = {
      shell: vi.fn(),
      pull: vi.fn(),
    };
    adapter = new UiAutomatorAdapter(mockAdb as any);
    vi.clearAllMocks();
  });

  it("returns accessibility results when found", async () => {
    // Mock UI dump with matching element
    mockAdb.shell.mockResolvedValue({
      stdout: `<?xml version="1.0"?>
<hierarchy>
  <node text="Login" bounds="[100,200][300,250]" class="android.widget.Button" clickable="true" />
</hierarchy>`,
      stderr: "",
      exitCode: 0,
    });

    const result = await adapter.findWithOcrFallback("emulator-5554", { text: "Login" });

    expect(result.elements).toHaveLength(1);
    expect(result.elements[0].text).toBe("Login");
    expect(result.source).toBe("accessibility");
    expect(extractText).not.toHaveBeenCalled();
  });

  it("falls back to OCR when accessibility returns no matches", async () => {
    // Mock UI dump with no matching elements
    mockAdb.shell
      .mockResolvedValueOnce({ stdout: `<?xml version="1.0"?><hierarchy><node text="" bounds="[0,0][100,100]" class="View" /></hierarchy>`, stderr: "", exitCode: 0 }) // dump
      .mockResolvedValueOnce({ stdout: "", stderr: "", exitCode: 0 }) // rm dump
      .mockResolvedValueOnce({ stdout: "", stderr: "", exitCode: 0 }) // screencap
      .mockResolvedValueOnce({ stdout: "", stderr: "", exitCode: 0 }); // rm screenshot

    mockAdb.pull.mockResolvedValue(undefined);

    vi.mocked(extractText).mockResolvedValue([
      { text: "Chobani High Protein", confidence: 0.92, bounds: { x0: 10, y0: 100, x1: 200, y1: 150 } },
    ]);

    vi.mocked(searchText).mockReturnValue([
      { index: 0, text: "Chobani High Protein", bounds: "[10,100][200,150]", center: { x: 105, y: 125 }, confidence: 0.92 },
    ]);

    const result = await adapter.findWithOcrFallback("emulator-5554", { text: "Chobani" });

    expect(result.elements).toHaveLength(1);
    expect(result.elements[0].text).toBe("Chobani High Protein");
    expect(result.source).toBe("ocr");
    expect(extractText).toHaveBeenCalled();
    expect(searchText).toHaveBeenCalledWith(expect.any(Array), "Chobani");
  });

  it("includes debug info when debug=true", async () => {
    mockAdb.shell.mockResolvedValue({
      stdout: `<?xml version="1.0"?><hierarchy><node text="" bounds="[0,0][100,100]" class="View" /></hierarchy>`,
      stderr: "",
      exitCode: 0,
    });
    mockAdb.pull.mockResolvedValue(undefined);

    vi.mocked(extractText).mockResolvedValue([
      { text: "Test", confidence: 0.85, bounds: { x0: 0, y0: 0, x1: 50, y1: 25 } },
    ]);
    vi.mocked(searchText).mockReturnValue([
      { index: 0, text: "Test", bounds: "[0,0][50,25]", center: { x: 25, y: 12 }, confidence: 0.85 },
    ]);

    const result = await adapter.findWithOcrFallback("emulator-5554", { text: "test" }, { debug: true });

    expect(result.source).toBe("ocr");
    expect(result.fallbackReason).toBe("accessibility tree had no matching text");
  });

  it("returns empty results when both accessibility and OCR find nothing", async () => {
    mockAdb.shell.mockResolvedValue({
      stdout: `<?xml version="1.0"?><hierarchy><node text="" bounds="[0,0][100,100]" class="View" /></hierarchy>`,
      stderr: "",
      exitCode: 0,
    });
    mockAdb.pull.mockResolvedValue(undefined);

    vi.mocked(extractText).mockResolvedValue([
      { text: "Something Else", confidence: 0.90, bounds: { x0: 0, y0: 0, x1: 100, y1: 50 } },
    ]);
    vi.mocked(searchText).mockReturnValue([]);

    const result = await adapter.findWithOcrFallback("emulator-5554", { text: "NotFound" });

    expect(result.elements).toHaveLength(0);
    expect(result.source).toBe("ocr");
  });
});
```

**Step 2: Run test to verify it fails**

Run:
```bash
npm test tests/adapters/ui-automator.test.ts
```

Expected: FAIL - findWithOcrFallback not defined

**Step 3: Implement findWithOcrFallback**

Modify `src/adapters/ui-automator.ts`:

```typescript
import { AdbAdapter } from "./adb.js";
import { parseUiDump, findElements, flattenTree, AccessibilityNode } from "../parsers/ui-dump.js";
import { ReplicantError, ErrorCode } from "../types/index.js";
import { extractText, searchText } from "../services/ocr.js";
import { OcrElement } from "../types/ocr.js";

// ... existing interfaces ...

export interface FindWithOcrResult {
  elements: (AccessibilityNode | OcrElement)[];
  source: "accessibility" | "ocr";
  fallbackReason?: string;
}

export interface FindOptions {
  debug?: boolean;
}

export class UiAutomatorAdapter {
  constructor(private adb: AdbAdapter = new AdbAdapter()) {}

  // ... existing methods ...

  async findWithOcrFallback(
    deviceId: string,
    selector: {
      resourceId?: string;
      text?: string;
      textContains?: string;
      className?: string;
    },
    options: FindOptions = {}
  ): Promise<FindWithOcrResult> {
    // First try accessibility tree
    const accessibilityResults = await this.find(deviceId, selector);

    if (accessibilityResults.length > 0) {
      return {
        elements: accessibilityResults,
        source: "accessibility",
      };
    }

    // Fall back to OCR if we have a text-based selector
    if (selector.text || selector.textContains) {
      const searchTerm = selector.text || selector.textContains!;

      // Take screenshot for OCR
      const screenshotResult = await this.screenshot(deviceId, {});

      try {
        // Run OCR
        const ocrResults = await extractText(screenshotResult.path!);
        const matches = searchText(ocrResults, searchTerm);

        const result: FindWithOcrResult = {
          elements: matches,
          source: "ocr",
        };

        if (options.debug) {
          result.fallbackReason = "accessibility tree had no matching text";
        }

        return result;
      } finally {
        // Clean up screenshot file
        // Note: screenshot() already cleans up remote file, local file cleanup is optional
      }
    }

    // No text selector, can't use OCR
    return {
      elements: [],
      source: "accessibility",
    };
  }
}
```

**Step 4: Run test to verify it passes**

Run:
```bash
npm test tests/adapters/ui-automator.test.ts
```

Expected: All tests PASS

**Step 5: Commit**

```bash
git add src/adapters/ui-automator.ts tests/adapters/ui-automator.test.ts
git commit -m "feat: add findWithOcrFallback to UiAutomatorAdapter"
```

---

## Task 7: Update UI Tool to Use OCR Fallback

**Files:**
- Modify: `src/tools/ui.ts`
- Create: `tests/tools/ui-ocr.test.ts`

**Step 1: Write the failing test**

Create `tests/tools/ui-ocr.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { handleUiTool } from "../../src/tools/ui.js";

describe("UI Tool - OCR Fallback", () => {
  let mockContext: any;

  beforeEach(() => {
    mockContext = {
      deviceState: {
        ensureDevice: vi.fn().mockResolvedValue({ id: "emulator-5554" }),
      },
      ui: {
        findWithOcrFallback: vi.fn(),
        tap: vi.fn(),
      },
      cache: {
        generateId: vi.fn().mockReturnValue("test-id"),
        set: vi.fn(),
      },
    };
  });

  describe("find operation with OCR fallback", () => {
    it("uses findWithOcrFallback for text selectors", async () => {
      mockContext.ui.findWithOcrFallback.mockResolvedValue({
        elements: [
          { text: "Login", centerX: 200, centerY: 300, bounds: { left: 100, top: 250, right: 300, bottom: 350 }, clickable: true },
        ],
        source: "accessibility",
      });

      const result = await handleUiTool(
        { operation: "find", selector: { text: "Login" } },
        mockContext
      );

      expect(mockContext.ui.findWithOcrFallback).toHaveBeenCalledWith(
        "emulator-5554",
        { text: "Login" },
        { debug: false }
      );
      expect(result.count).toBe(1);
    });

    it("includes source in response when debug=true", async () => {
      mockContext.ui.findWithOcrFallback.mockResolvedValue({
        elements: [
          { index: 0, text: "Chobani", bounds: "[10,100][200,150]", center: { x: 105, y: 125 }, confidence: 0.92 },
        ],
        source: "ocr",
        fallbackReason: "accessibility tree had no matching text",
      });

      const result = await handleUiTool(
        { operation: "find", selector: { text: "Chobani" }, debug: true },
        mockContext
      );

      expect(result.source).toBe("ocr");
      expect(result.fallbackReason).toBe("accessibility tree had no matching text");
    });

    it("does not include source when debug=false", async () => {
      mockContext.ui.findWithOcrFallback.mockResolvedValue({
        elements: [],
        source: "ocr",
      });

      const result = await handleUiTool(
        { operation: "find", selector: { text: "NotFound" } },
        mockContext
      );

      expect(result.source).toBeUndefined();
    });

    it("stores OCR elements in lastFindResults for tapping", async () => {
      mockContext.ui.findWithOcrFallback.mockResolvedValue({
        elements: [
          { index: 0, text: "Chobani", bounds: "[10,100][200,150]", center: { x: 105, y: 125 }, confidence: 0.92 },
        ],
        source: "ocr",
      });

      await handleUiTool(
        { operation: "find", selector: { text: "Chobani" } },
        mockContext
      );

      // Now tap should work
      mockContext.ui.tap.mockResolvedValue(undefined);

      const tapResult = await handleUiTool(
        { operation: "tap", elementIndex: 0 },
        mockContext
      );

      expect(mockContext.ui.tap).toHaveBeenCalledWith("emulator-5554", 105, 125);
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run:
```bash
npm test tests/tools/ui-ocr.test.ts
```

Expected: FAIL - current implementation doesn't use findWithOcrFallback

**Step 3: Update ui.ts to add debug parameter and use findWithOcrFallback**

Modify `src/tools/ui.ts`:

```typescript
import { z } from "zod";
import { ServerContext } from "../server.js";
import { CACHE_TTLS } from "../types/index.js";
import { AccessibilityNode } from "../parsers/ui-dump.js";
import { OcrElement } from "../types/ocr.js";

export const uiInputSchema = z.object({
  operation: z.enum(["dump", "find", "tap", "input", "screenshot", "accessibility-check"]),
  selector: z.object({
    resourceId: z.string().optional(),
    text: z.string().optional(),
    textContains: z.string().optional(),
    className: z.string().optional(),
  }).optional(),
  x: z.number().optional(),
  y: z.number().optional(),
  elementIndex: z.number().optional(),
  text: z.string().optional(),
  localPath: z.string().optional(),
  inline: z.boolean().optional(),
  debug: z.boolean().optional(),
});

export type UiInput = z.infer<typeof uiInputSchema>;

// Store last find results for elementIndex reference
// Updated to support both accessibility and OCR elements
let lastFindResults: (AccessibilityNode | OcrElement)[] = [];

// Helper to get center coordinates from either element type
function getElementCenter(element: AccessibilityNode | OcrElement): { x: number; y: number } {
  if ("centerX" in element) {
    // AccessibilityNode
    return { x: element.centerX, y: element.centerY };
  } else {
    // OcrElement
    return element.center;
  }
}

export async function handleUiTool(
  input: UiInput,
  context: ServerContext
): Promise<Record<string, unknown>> {
  const device = await context.deviceState.ensureDevice(context.adb);
  const deviceId = device.id;

  switch (input.operation) {
    case "dump": {
      const tree = await context.ui.dump(deviceId);

      // Cache the tree
      const dumpId = context.cache.generateId("ui-dump");
      context.cache.set(dumpId, { tree, deviceId }, "ui-dump", CACHE_TTLS.UI_TREE);

      // Create a simplified view
      const simplifyNode = (node: AccessibilityNode, depth = 0): Record<string, unknown> => ({
        className: node.className.split(".").pop(),
        text: node.text || undefined,
        resourceId: node.resourceId ? node.resourceId.split("/").pop() : undefined,
        bounds: `[${node.bounds.left},${node.bounds.top}][${node.bounds.right},${node.bounds.bottom}]`,
        clickable: node.clickable || undefined,
        children: node.children?.map((c) => simplifyNode(c, depth + 1)),
      });

      return {
        dumpId,
        tree: tree.map((n) => simplifyNode(n)),
        deviceId,
      };
    }

    case "find": {
      if (!input.selector) {
        throw new Error("selector is required for find operation");
      }

      const debug = input.debug ?? false;

      // Use findWithOcrFallback for text-based selectors
      if (input.selector.text || input.selector.textContains) {
        const result = await context.ui.findWithOcrFallback(deviceId, input.selector, { debug });
        lastFindResults = result.elements;

        const response: Record<string, unknown> = {
          elements: result.elements.map((el, index) => {
            if ("centerX" in el) {
              // AccessibilityNode
              return {
                index,
                text: el.text,
                resourceId: el.resourceId,
                className: el.className,
                centerX: el.centerX,
                centerY: el.centerY,
                bounds: el.bounds,
                clickable: el.clickable,
              };
            } else {
              // OcrElement
              return {
                index,
                text: el.text,
                center: el.center,
                bounds: el.bounds,
                confidence: debug ? el.confidence : undefined,
              };
            }
          }),
          count: result.elements.length,
          deviceId,
        };

        if (debug) {
          response.source = result.source;
          if (result.fallbackReason) {
            response.fallbackReason = result.fallbackReason;
          }
        }

        return response;
      }

      // Non-text selectors use regular find (no OCR fallback)
      const elements = await context.ui.find(deviceId, input.selector);
      lastFindResults = elements;

      return {
        elements: elements.map((el, index) => ({
          index,
          text: el.text,
          resourceId: el.resourceId,
          className: el.className,
          centerX: el.centerX,
          centerY: el.centerY,
          bounds: el.bounds,
          clickable: el.clickable,
        })),
        count: elements.length,
        deviceId,
      };
    }

    case "tap": {
      let x: number, y: number;

      if (input.elementIndex !== undefined) {
        if (!lastFindResults[input.elementIndex]) {
          throw new Error(`Element at index ${input.elementIndex} not found. Run 'find' first.`);
        }
        const element = lastFindResults[input.elementIndex];
        const center = getElementCenter(element);
        x = center.x;
        y = center.y;
      } else if (input.x !== undefined && input.y !== undefined) {
        x = input.x;
        y = input.y;
      } else {
        throw new Error("Either x/y coordinates or elementIndex is required for tap");
      }

      await context.ui.tap(deviceId, x, y);
      return { tapped: { x, y }, deviceId };
    }

    case "input": {
      if (!input.text) {
        throw new Error("text is required for input operation");
      }
      await context.ui.input(deviceId, input.text);
      return { input: input.text, deviceId };
    }

    case "screenshot": {
      const result = await context.ui.screenshot(deviceId, {
        localPath: input.localPath,
        inline: input.inline,
      });
      return { ...result, deviceId };
    }

    case "accessibility-check": {
      const result = await context.ui.accessibilityCheck(deviceId);
      return { ...result, deviceId };
    }

    default:
      throw new Error(`Unknown operation: ${input.operation}`);
  }
}

export const uiToolDefinition = {
  name: "ui",
  description: "Interact with app UI via accessibility tree. Auto-selects device if only one connected. Operations: dump, find, tap, input, screenshot, accessibility-check.",
  inputSchema: {
    type: "object",
    properties: {
      operation: {
        type: "string",
        enum: ["dump", "find", "tap", "input", "screenshot", "accessibility-check"],
      },
      selector: {
        type: "object",
        properties: {
          resourceId: { type: "string" },
          text: { type: "string" },
          textContains: { type: "string" },
          className: { type: "string" },
        },
        description: "Element selector (for find)",
      },
      x: { type: "number", description: "X coordinate (for tap)" },
      y: { type: "number", description: "Y coordinate (for tap)" },
      elementIndex: { type: "number", description: "Element index from last find (for tap)" },
      text: { type: "string", description: "Text to input" },
      localPath: { type: "string", description: "Local path for screenshot" },
      inline: { type: "boolean", description: "Return base64 instead of file path" },
      debug: { type: "boolean", description: "Include source (accessibility/ocr) and confidence in response" },
    },
    required: ["operation"],
  },
};
```

**Step 4: Update ServerContext type**

The ServerContext needs to know about findWithOcrFallback. Check `src/server.ts` and update the ui property type if needed.

**Step 5: Run test to verify it passes**

Run:
```bash
npm test tests/tools/ui-ocr.test.ts
```

Expected: All tests PASS

**Step 6: Run all tests**

Run:
```bash
npm test
```

Expected: All tests PASS

**Step 7: Commit**

```bash
git add src/tools/ui.ts tests/tools/ui-ocr.test.ts
git commit -m "feat: integrate OCR fallback into UI find operation"
```

---

## Task 8: Update Server Context

**Files:**
- Modify: `src/server.ts`

**Step 1: Verify ServerContext includes findWithOcrFallback**

Check if `src/server.ts` exposes `context.ui.findWithOcrFallback`. If the UiAutomatorAdapter is already exposed as `context.ui`, this should work. If not, we need to update it.

**Step 2: Run build to verify**

Run:
```bash
npm run build
```

Expected: No TypeScript errors

**Step 3: Run all tests**

Run:
```bash
npm test
```

Expected: All tests PASS

**Step 4: Commit if changes were needed**

```bash
git add src/server.ts
git commit -m "fix: ensure ServerContext exposes findWithOcrFallback"
```

---

## Task 9: Add Integration Test with Mock

**Files:**
- Create: `tests/integration/ocr-fallback.test.ts`

**Step 1: Create integration test**

Create `tests/integration/ocr-fallback.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { handleUiTool } from "../../src/tools/ui.js";

// This test simulates the OCR fallback scenario end-to-end with mocked dependencies

describe("OCR Fallback Integration", () => {
  let mockContext: any;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("finds Chobani ad via OCR when accessibility tree has no text", async () => {
    // Simulate scenario where accessibility tree has elements but no text
    mockContext = {
      deviceState: {
        ensureDevice: vi.fn().mockResolvedValue({ id: "emulator-5554" }),
      },
      ui: {
        findWithOcrFallback: vi.fn().mockResolvedValue({
          elements: [
            {
              index: 0,
              text: "Chobani High Protein Drinks & Cups",
              bounds: "[10,761][535,1200]",
              center: { x: 272, y: 980 },
              confidence: 0.92,
            },
          ],
          source: "ocr",
          fallbackReason: "accessibility tree had no matching text",
        }),
        tap: vi.fn().mockResolvedValue(undefined),
      },
      cache: {
        generateId: vi.fn().mockReturnValue("test-id"),
        set: vi.fn(),
      },
    };

    // Step 1: Find the Chobani ad
    const findResult = await handleUiTool(
      { operation: "find", selector: { text: "Chobani" }, debug: true },
      mockContext
    );

    expect(findResult.count).toBe(1);
    expect(findResult.source).toBe("ocr");
    expect((findResult.elements as any[])[0].text).toContain("Chobani");

    // Step 2: Tap on the found element
    const tapResult = await handleUiTool(
      { operation: "tap", elementIndex: 0 },
      mockContext
    );

    expect(mockContext.ui.tap).toHaveBeenCalledWith("emulator-5554", 272, 980);
    expect(tapResult.tapped).toEqual({ x: 272, y: 980 });
  });

  it("prefers accessibility results over OCR when available", async () => {
    mockContext = {
      deviceState: {
        ensureDevice: vi.fn().mockResolvedValue({ id: "emulator-5554" }),
      },
      ui: {
        findWithOcrFallback: vi.fn().mockResolvedValue({
          elements: [
            {
              text: "Login",
              centerX: 540,
              centerY: 1200,
              bounds: { left: 100, top: 1150, right: 980, bottom: 1250 },
              clickable: true,
              resourceId: "com.example:id/login_btn",
              className: "android.widget.Button",
            },
          ],
          source: "accessibility",
        }),
        tap: vi.fn().mockResolvedValue(undefined),
      },
      cache: {
        generateId: vi.fn().mockReturnValue("test-id"),
        set: vi.fn(),
      },
    };

    const findResult = await handleUiTool(
      { operation: "find", selector: { text: "Login" }, debug: true },
      mockContext
    );

    expect(findResult.count).toBe(1);
    expect(findResult.source).toBe("accessibility");
    expect((findResult.elements as any[])[0].clickable).toBe(true);
  });
});
```

**Step 2: Run integration test**

Run:
```bash
npm test tests/integration/ocr-fallback.test.ts
```

Expected: All tests PASS

**Step 3: Run all tests**

Run:
```bash
npm test
```

Expected: All tests PASS

**Step 4: Commit**

```bash
git add tests/integration/ocr-fallback.test.ts
git commit -m "test: add OCR fallback integration tests"
```

---

## Task 10: Final Verification and Documentation

**Files:**
- None (verification only)

**Step 1: Run full test suite**

Run:
```bash
npm test
```

Expected: All tests PASS

**Step 2: Run build**

Run:
```bash
npm run build
```

Expected: No errors

**Step 3: Run linter if available**

Run:
```bash
npm run lint 2>/dev/null || echo "No lint script"
```

**Step 4: Verify feature works conceptually**

Review the implementation flow:
1. `ui { operation: "find", selector: { text: "Chobani" } }` is called
2. `handleUiTool` calls `context.ui.findWithOcrFallback()`
3. `findWithOcrFallback` first tries accessibility tree
4. If no matches, takes screenshot and runs OCR via tesseract.js
5. Returns elements with bounds/center that can be tapped

**Step 5: Create final commit summarizing the feature**

```bash
git log --oneline -10
```

Review commits are atomic and well-described.

---

## Summary

| Task | Description | Files |
|------|-------------|-------|
| 1 | Add tesseract.js dependency | package.json |
| 2 | Create OCR types | src/types/ocr.ts |
| 3 | Create OCR service | src/services/ocr.ts |
| 4 | Add OCR service tests | tests/services/ocr.test.ts |
| 5 | Add searchText function | src/services/ocr.ts |
| 6 | Add findWithOcrFallback | src/adapters/ui-automator.ts |
| 7 | Update UI tool | src/tools/ui.ts |
| 8 | Update server context | src/server.ts |
| 9 | Add integration test | tests/integration/ocr-fallback.test.ts |
| 10 | Final verification | - |
