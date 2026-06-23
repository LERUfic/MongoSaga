import pino from 'pino';

const isDev = process.env.NODE_ENV !== 'production';

// Configure the logger
// In development, use pino-pretty for human-readable console output.
// In production, emit raw JSON for parsing by Datadog, ELK, Splunk, etc.
const pinoLogger = pino({
  level: process.env.LOG_LEVEL || 'info',
  timestamp: pino.stdTimeFunctions.isoTime,
  transport: isDev
    ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:standard',
          ignore: 'pid,hostname',
        },
      }
    : undefined,
  formatters: {
    level: (label) => {
      return { level: label.toUpperCase() };
    },
  },
  base: {
    env: process.env.NODE_ENV,
  },
});

type LogLevel = 'INFO' | 'WARN' | 'ERROR';

export interface LogPayload {
  event: string;
  userId?: string;
  username?: string;
  metadata?: Record<string, unknown>;
  error?: unknown;
}

export const logger = {
  info: (payload: LogPayload) => {
    pinoLogger.info({
      event: payload.event,
      userId: payload.userId || 'SYSTEM',
      username: payload.username || 'SYSTEM',
      ...payload.metadata,
    });
  },
  warn: (payload: LogPayload) => {
    pinoLogger.warn({
      event: payload.event,
      userId: payload.userId || 'SYSTEM',
      username: payload.username || 'SYSTEM',
      ...payload.metadata,
    });
  },
  error: (payload: LogPayload) => {
    pinoLogger.error({
      event: payload.event,
      userId: payload.userId || 'SYSTEM',
      username: payload.username || 'SYSTEM',
      error: payload.error,
      ...payload.metadata,
    });
  }
};
