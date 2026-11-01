type LogLevel = 'debug' | 'info' | 'warn' | 'error';
type LogEntry = Record<string, unknown>;

const LEVELS: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 };

let currentLevel: LogLevel = 'info';

export function setLogLevel(level: LogLevel): void {
  currentLevel = level;
}

function log(level: LogLevel, message: string, fields: LogEntry = {}): void {
  if (LEVELS[level] < LEVELS[currentLevel]) return;
  const entry = {
    level,
    message,
    timestamp: new Date().toISOString(),
    ...fields,
  };
  const output = JSON.stringify(entry);
  if (level === 'error') {
    process.stderr.write(output + '\n');
  } else {
    process.stdout.write(output + '\n');
  }
}

export const logger = {
  debug: (msg: string, fields?: LogEntry) => log('debug', msg, fields),
  info: (msg: string, fields?: LogEntry) => log('info', msg, fields),
  warn: (msg: string, fields?: LogEntry) => log('warn', msg, fields),
  error: (msg: string, fields?: LogEntry) => log('error', msg, fields),
};
