import { createWorker, Worker } from "tesseract.js";
import { OcrResult, OcrElement } from "../types/ocr.js";

let worker: Worker | null = null;

async function getWorker(): Promise<Worker> {
  if (!worker) {
    worker = await createWorker("eng");
  }
  return worker;
}

export async function extractText(imagePath: string): Promise<OcrResult[]> {
  const w = await getWorker();
  const { data } = await w.recognize(imagePath, {}, { blocks: true });

  const results: OcrResult[] = [];

  // Navigate through blocks -> paragraphs -> lines -> words
  if (data.blocks) {
    for (const block of data.blocks) {
      for (const paragraph of block.paragraphs) {
        for (const line of paragraph.lines) {
          for (const word of line.words) {
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
        }
      }
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
