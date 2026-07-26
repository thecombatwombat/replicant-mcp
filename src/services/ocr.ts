import { existsSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { createWorker, Worker } from "tesseract.js";
import { OcrResult, OcrElement } from "../types/ocr.js";
import { logger } from "../utils/logger.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

// eng.traineddata ships at the package root (../.. from dist/services).
const LANG_DIR = join(__dirname, "../..");

let worker: Worker | null = null;

/**
 * Point tesseract.js at the bundled language file.
 *
 * With langPath unset, tesseract.js downloads eng.traineddata from the jsdelivr
 * CDN on first use (see tesseract.js/src/worker-script/index.js). That made OCR
 * require network access and silently ignored the copy we already ship.
 */
function resolveLangPath(): string | undefined {
  if (existsSync(join(LANG_DIR, "eng.traineddata"))) {
    return LANG_DIR;
  }
  logger.warn("Bundled eng.traineddata not found; tesseract.js will download it", {
    searched: LANG_DIR,
  });
  return undefined;
}

async function getWorker(): Promise<Worker> {
  if (!worker) {
    const langPath = resolveLangPath();
    worker = await createWorker("eng", undefined, langPath ? { langPath } : undefined);
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

  // Index represents position in filtered matches (0, 1, 2...) for use with elementIndex tap
  // This is intentional - users tap by match index, not original OCR result position
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
