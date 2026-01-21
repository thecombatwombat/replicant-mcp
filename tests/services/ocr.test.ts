import { describe, it, expect, vi, afterEach } from "vitest";
import { extractText, terminateOcr } from "../../src/services/ocr.js";

// Mock tesseract.js with v7 API structure (blocks -> paragraphs -> lines -> words)
vi.mock("tesseract.js", () => ({
  createWorker: vi.fn().mockResolvedValue({
    recognize: vi.fn().mockResolvedValue({
      data: {
        blocks: [
          {
            paragraphs: [
              {
                lines: [
                  {
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
                ],
              },
            ],
          },
        ],
      },
    }),
    terminate: vi.fn(),
  }),
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
      const tesseract = await import("tesseract.js");
      vi.mocked(tesseract.createWorker).mockResolvedValueOnce({
        recognize: vi.fn().mockResolvedValue({
          data: {
            blocks: [
              {
                paragraphs: [
                  {
                    lines: [
                      {
                        words: [
                          { text: "Valid", confidence: 90, bbox: { x0: 0, y0: 0, x1: 10, y1: 10 } },
                          { text: "   ", confidence: 80, bbox: { x0: 20, y0: 0, x1: 30, y1: 10 } },
                          { text: "", confidence: 70, bbox: { x0: 40, y0: 0, x1: 50, y1: 10 } },
                        ],
                      },
                    ],
                  },
                ],
              },
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
      const tesseract = await import("tesseract.js");

      await extractText("/fake/path1.png");
      await extractText("/fake/path2.png");

      // Worker should only be created once
      expect(tesseract.createWorker).toHaveBeenCalledTimes(1);
    });

    it("handles empty blocks gracefully", async () => {
      const tesseract = await import("tesseract.js");
      vi.mocked(tesseract.createWorker).mockResolvedValueOnce({
        recognize: vi.fn().mockResolvedValue({
          data: {
            blocks: null,
          },
        }),
        terminate: vi.fn(),
      } as any);

      await terminateOcr();
      const results = await extractText("/fake/path.png");

      expect(results).toHaveLength(0);
    });
  });

  describe("terminateOcr", () => {
    it("terminates worker when called", async () => {
      const tesseract = await import("tesseract.js");
      const mockWorker = await tesseract.createWorker("eng");

      await extractText("/fake/path.png");
      await terminateOcr();

      expect(mockWorker.terminate).toHaveBeenCalled();
    });
  });
});
