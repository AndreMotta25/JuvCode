type Level = "debug" | "info" | "warn" | "error";

const LEVEL_ORDER: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };

function getLevel(): Level {
  const env = process.env.LOG_LEVEL?.toLowerCase();
  const nodeEnv = process.env.NODE_ENV?.toLowerCase();
  if (env === "debug" || env === "info" || env === "warn" || env === "error") return env;
  return nodeEnv === "production" ? "info" : "debug";
}

function ts() {
  return new Date().toISOString();
}

function safe(obj: unknown) {
  try {
    return JSON.stringify(obj);
  } catch {
    return String(obj);
  }
}

function log(level: Level, msg: string, meta?: unknown) {
  const current = getLevel();
  if (LEVEL_ORDER[level] < LEVEL_ORDER[current]) return;
  const base = `[${ts()}] ${level.toUpperCase()} ${msg}`;
  if (meta !== undefined) {
    // no comments
    const out = `${base} ${safe(meta)}`;
    if (level === "error") console.error(out);
    else if (level === "warn") console.warn(out);
    else console.log(out);
  } else {
    if (level === "error") console.error(base);
    else if (level === "warn") console.warn(base);
    else console.log(base);
  }
}

export const logger = {
  debug: (msg: string, meta?: unknown) => log("debug", msg, meta),
  info: (msg: string, meta?: unknown) => log("info", msg, meta),
  warn: (msg: string, meta?: unknown) => log("warn", msg, meta),
  error: (msg: string, meta?: unknown) => log("error", msg, meta),
};

export default logger;