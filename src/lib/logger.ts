/**
 * Structured logging for production observability.
 * Outputs JSON in production, readable format in development.
 */

type LogLevel = "info" | "warn" | "error";

interface LogEntry {
  level: LogLevel;
  msg: string;
  [key: string]: unknown;
}

const isProd = process.env.NODE_ENV === "production";

function emit(entry: LogEntry) {
  const { level, msg, ...extra } = entry;
  const ts = new Date().toISOString();

  if (isProd) {
    // Structured JSON for Vercel log drains
    const line = JSON.stringify({ ts, level, msg, ...extra });
    if (level === "error") console.error(line);
    else if (level === "warn") console.warn(line);
    else console.log(line);
  } else {
    const prefix = level === "error" ? "ERR" : level === "warn" ? "WRN" : "INF";
    const extraStr = Object.keys(extra).length > 0
      ? " " + Object.entries(extra).map(([k, v]) => `${k}=${JSON.stringify(v)}`).join(" ")
      : "";
    console.log(`[${prefix}] ${msg}${extraStr}`);
  }
}

export const log = {
  info: (msg: string, extra?: Record<string, unknown>) => emit({ level: "info", msg, ...extra }),
  warn: (msg: string, extra?: Record<string, unknown>) => emit({ level: "warn", msg, ...extra }),
  error: (msg: string, extra?: Record<string, unknown>) => emit({ level: "error", msg, ...extra }),
};
