const LOG_LEVELS = { error: 0, warn: 1, info: 2, debug: 3 } as const;
type LogLevel = keyof typeof LOG_LEVELS;

const envLevel = process.env.REPLICANT_LOG_LEVEL as string | undefined;
const currentLevel: LogLevel = envLevel && envLevel in LOG_LEVELS ? (envLevel as LogLevel) : "warn";
const useJson = process.env.REPLICANT_LOG_FORMAT === "json";

export const logger = {
  error: (msg: string, ctx?: Record<string, unknown>) => log("error", msg, ctx),
  warn: (msg: string, ctx?: Record<string, unknown>) => log("warn", msg, ctx),
  info: (msg: string, ctx?: Record<string, unknown>) => log("info", msg, ctx),
  debug: (msg: string, ctx?: Record<string, unknown>) => log("debug", msg, ctx),
};

function safeStringify(obj: Record<string, unknown>): string {
  try {
    return JSON.stringify(obj);
  } catch {
    return "[unserializable]";
  }
}

function log(level: LogLevel, msg: string, ctx?: Record<string, unknown>) {
  if (LOG_LEVELS[level] > LOG_LEVELS[currentLevel]) return;
  if (useJson) {
    try {
      process.stderr.write(
        JSON.stringify({ level, msg, ts: new Date().toISOString(), ...ctx }) + "\n",
      );
    } catch {
      process.stderr.write(
        JSON.stringify({ level, msg, ts: new Date().toISOString(), ctx: "[unserializable]" }) + "\n",
      );
    }
  } else {
    const ctxStr = ctx ? " " + safeStringify(ctx) : "";
    process.stderr.write(`[${level.toUpperCase()}] ${msg}${ctxStr}\n`);
  }
}
