import * as path from "path";
import * as fs from "fs";
import * as os from "os";

/**
 * Get default screenshot path in .replicant/screenshots directory.
 * Creates the directory if it doesn't exist.
 *
 * In sandboxed environments (Claude Desktop), process.cwd() returns '/'
 * which isn't writable, so we fall back to the user's home directory.
 *
 * @param baseDir - Override base directory (for testing). If not provided,
 *                  uses process.cwd() or os.homedir() in sandbox environments.
 */
export function getDefaultScreenshotPath(baseDir?: string): string {
  const effectiveBaseDir = baseDir ?? (process.cwd() === "/" ? os.homedir() : process.cwd());
  const dir = path.join(effectiveBaseDir, ".replicant", "screenshots");
  fs.mkdirSync(dir, { recursive: true });
  const randomSuffix = Math.random().toString(36).substring(2, 8);
  return path.join(dir, `screenshot-${Date.now()}-${randomSuffix}.png`);
}
