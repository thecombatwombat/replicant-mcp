import { ServerContext } from "../server.js";
import { logger } from "../utils/logger.js";

export interface CurrentAppField {
  packageName: string;
  activityName: string;
}

// Best-effort foreground-app lookup for UI response surfaces. Never throws —
// returns null if the underlying call fails, so the parent operation is not
// taken down by an `unknown/unknown` resolution or a transient adb hiccup.
// See THE-107.
export async function getCurrentAppSafe(
  context: ServerContext,
  deviceId: string,
): Promise<CurrentAppField | null> {
  try {
    return await context.ui.getCurrentApp(deviceId);
  } catch (err) {
    logger.warn("getCurrentApp failed; returning null for response 'app' field", {
      deviceId,
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}
