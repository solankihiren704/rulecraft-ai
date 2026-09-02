/**
 * logger.ts
 * Minimal structured logger placeholder. Centralized here so later phases
 * (or a swap to pino/winston) only require changing this one file.
 */
type LogMeta = Record<string, unknown>

function log(level: 'info' | 'warn' | 'error', message: string, meta?: LogMeta) {
  const entry = { level, message, time: new Date().toISOString(), ...meta }
  console[level === 'info' ? 'log' : level](JSON.stringify(entry))
}

export const logger = {
  info: (message: string, meta?: LogMeta) => log('info', message, meta),
  warn: (message: string, meta?: LogMeta) => log('warn', message, meta),
  error: (message: string, meta?: LogMeta) => log('error', message, meta),
}
