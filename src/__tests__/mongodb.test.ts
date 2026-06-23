import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockDbCommand, mockDb, mockConnect, mockClose } = vi.hoisted(() => {
  const cmd = vi.fn().mockResolvedValue({ ok: 1 });
  return {
    mockDbCommand: cmd,
    mockDb: vi.fn().mockReturnValue({ command: cmd }),
    mockConnect: vi.fn().mockResolvedValue(undefined),
    mockClose: vi.fn().mockResolvedValue(undefined),
  };
});

vi.mock('mongodb', () => {
  return {
    MongoClient: class {
      connect = mockConnect;
      close = mockClose;
      db = mockDb;
    },
  };
});

import { validateMongoUri, getMongoClient, serializeEjson, deserializeEjson } from '../lib/mongodb';

describe('mongodb lib', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    if (global._mongoClientCache?.clients) {
      Object.keys(global._mongoClientCache.clients).forEach(k => {
        delete global._mongoClientCache!.clients[k];
      });
    }
  });

  describe('validateMongoUri', () => {
    it('returns true for valid uris', () => {
      expect(validateMongoUri('mongodb://localhost:27017')).toBe(true);
      expect(validateMongoUri('mongodb+srv://cluster0.example.com')).toBe(true);
    });

    it('returns false for invalid uris', () => {
      expect(validateMongoUri('http://localhost')).toBe(false);
      expect(validateMongoUri('')).toBe(false);
      // @ts-expect-error: testing invalid null input
      expect(validateMongoUri(null)).toBe(false);
    });
  });

  describe('getMongoClient', () => {
    it('throws on invalid uri', async () => {
      await expect(getMongoClient('invalid://uri')).rejects.toThrow('Invalid MongoDB connection string');
    });

    it('creates a new client and connects if not cached', async () => {
      const client = await getMongoClient('mongodb://test');
      expect(client).toBeDefined();
      expect(mockConnect).toHaveBeenCalledTimes(1);
    });

    it('returns cached client if ping succeeds', async () => {
      const client1 = await getMongoClient('mongodb://test');
      const client2 = await getMongoClient('mongodb://test');
      
      expect(client1).toBe(client2);
      expect(mockConnect).toHaveBeenCalledTimes(1); // Only connected once
      expect(mockDbCommand).toHaveBeenCalledWith({ ping: 1 });
    });

    it('reconnects if cached client ping fails', async () => {
      await getMongoClient('mongodb://test'); // first connect
      
      // Force ping to fail
      mockDbCommand.mockRejectedValueOnce(new Error('Network error'));
      
      await getMongoClient('mongodb://test'); // should close and reconnect
      
      expect(mockClose).toHaveBeenCalledTimes(1);
      expect(mockConnect).toHaveBeenCalledTimes(2); // re-connected
    });
  });

  describe('EJSON serialization', () => {
    it('serializes objects properly', () => {
      const data = { _id: { $oid: '123' }, date: new Date('2023-01-01T00:00:00Z') };
      const result = serializeEjson(data);
      expect(result).toBeDefined();
      expect(result.date).toBeDefined();
    });

    it('deserializes objects properly', () => {
      const str = '{"_id":{"$oid":"507f191e810c19729de860ea"}}';
      const result = deserializeEjson(str);
      expect(result._id).toBeDefined();
    });

    it('handles nulls', () => {
      expect(serializeEjson(null)).toBeNull();
    });
  });
});
