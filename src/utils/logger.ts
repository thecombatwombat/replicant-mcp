const LOG_LEVELS = { error: 0, warn: 1, info: 2, debug: 3 } as const;
type LogLevel = keyof typeof LOG_LEVELS;

const currentLevel: LogLevel = (process.env.REPLICANT_LOG_LEVEL as LogLevel) || "warn";
const useJson = process.env.REPLICANT_LOG_FORMAT === "json";

export const logger = {
  error: (msg: string, ctx?: Record<string, unknown>) => log("error", msg, ctx),
  warn: (msg: string, ctx?: Record<string, unknown>) => log("warn", msg, ctx),
  info: (msg: string, ctx?: Record<string, unknown>) => log("info", msg, ctx),
  debug: (msg: string, ctx?: Record<string, unknown>) => log("debug", msg, ctx),
};

function log(level: LogLevel, msg: string, ctx?: Record<string, unknown>) {
  if (LOG_LEVELS[level] > LOG_LEVELS[currentLevel]) return;
  if (useJson) {
    process.stderr.write(
      JSON.stringify({ level, msg, ts: new Date().toISOString(), ...ctx }) + "\n",
    );
  } else {
    process.stderr.write(`[${level.toUpperCase()}] ${msg}\n`);
  }
}
