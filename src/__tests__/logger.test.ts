import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockPinoInfo, mockPinoWarn, mockPinoError } = vi.hoisted(() => {
  return {
    mockPinoInfo: vi.fn(),
    mockPinoWarn: vi.fn(),
    mockPinoError: vi.fn(),
  };
});

vi.mock('pino', () => {
  return {
    default: Object.assign(
      () => ({
        info: mockPinoInfo,
        warn: mockPinoWarn,
        error: mockPinoError,
      }),
      {
        stdTimeFunctions: { isoTime: vi.fn() },
      }
    ),
  };
});

// Import after mocking pino
import { logger } from '../lib/logger';

describe('Logger', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should call pino info with correct payload', () => {
    logger.info({ event: 'test_event', userId: 'user1', metadata: { key: 'value' } });
    expect(mockPinoInfo).toHaveBeenCalledWith({
      event: 'test_event',
      userId: 'user1',
      username: 'SYSTEM',
      key: 'value',
    });
  });

  it('should call pino warn with correct payload', () => {
    logger.warn({ event: 'warn_event' });
    expect(mockPinoWarn).toHaveBeenCalledWith({
      event: 'warn_event',
      userId: 'SYSTEM',
      username: 'SYSTEM',
    });
  });

  it('should call pino error with correct payload and error object', () => {
    const testError = new Error('test error');
    logger.error({ event: 'error_event', username: 'admin', error: testError, metadata: { context: 'test' } });
    expect(mockPinoError).toHaveBeenCalledWith({
      event: 'error_event',
      userId: 'SYSTEM',
      username: 'admin',
      error: testError,
      context: 'test',
    });
  });
});
