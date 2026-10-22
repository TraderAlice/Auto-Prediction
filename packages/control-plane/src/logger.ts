export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogRecord {
  readonly level: LogLevel;
  readonly time: string;
  readonly name: string;
  readonly message: string;
  readonly fields: Readonly<Record<string, string | number | boolean | null>>;
}

export type LogSink = (line: string) => void;

export interface Logger {
  debug(message: string, fields?: LogRecord["fields"]): void;
  info(message: string, fields?: LogRecord["fields"]): void;
  warn(message: string, fields?: LogRecord["fields"]): void;
  error(message: string, fields?: LogRecord["fields"]): void;
}

const LEVEL_RANK: Readonly<Record<LogLevel, number>> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

export interface LoggerOptions {
  readonly level?: LogLevel;
  readonly sink?: LogSink;
  readonly now?: () => Date;
}

// One line per event, written as JSON so it can be grepped or parsed later.
// Callers must not pass secrets; this module does not redact fields.
export function createLogger(name: string, options: LoggerOptions = {}): Logger {
  const threshold = LEVEL_RANK[options.level ?? "info"];
  const sink: LogSink = options.sink ?? ((line) => process.stderr.write(`${line}\n`));
  const now = options.now ?? (() => new Date());

  const write = (level: LogLevel, message: string, fields: LogRecord["fields"] = {}): void => {
    if (LEVEL_RANK[level] < threshold) return;
    const record: LogRecord = { level, time: now().toISOString(), name, message, fields };
    sink(JSON.stringify(record));
  };

  return {
    debug: (message, fields) => write("debug", message, fields),
    info: (message, fields) => write("info", message, fields),
    warn: (message, fields) => write("warn", message, fields),
    error: (message, fields) => write("error", message, fields),
  };
}
