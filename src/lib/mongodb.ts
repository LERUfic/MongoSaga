import { MongoClient } from 'mongodb';
import { EJSON } from 'bson';

// Cache client connections in a global map to avoid leaking connections in Next.js dev hot-reloads
// or multiple rapid requests.
interface GlobalMongoCache {
  clients: { [uri: string]: MongoClient };
}

declare global {
   
  var _mongoClientCache: GlobalMongoCache | undefined;
}

if (!global._mongoClientCache) {
  global._mongoClientCache = { clients: {} };
}

const clientCache = global._mongoClientCache.clients;

/**
 * Validates a MongoDB URI.
 */
export function validateMongoUri(uri: string): boolean {
  if (!uri) return false;
  return uri.startsWith('mongodb://') || uri.startsWith('mongodb+srv://');
}

/**
 * Gets or creates a MongoClient for the given URI.
 */
export async function getMongoClient(uri: string): Promise<MongoClient> {
  if (!validateMongoUri(uri)) {
    throw new Error('Invalid MongoDB connection string. Must start with "mongodb://" or "mongodb+srv://"');
  }

  // Check if we already have an active client for this URI
  if (clientCache[uri]) {
    try {
      // Test the connection if cached
      await clientCache[uri].db('admin').command({ ping: 1 });
      return clientCache[uri];
    } catch {
      // If ping fails, delete from cache and reconnect
      try {
        await clientCache[uri].close();
      } catch {
        // Ignore close errors
      }
      delete clientCache[uri];
    }
  }

  // Create new client
  const client = new MongoClient(uri, {
    connectTimeoutMS: 5000,
    socketTimeoutMS: 30000,
    serverSelectionTimeoutMS: 5000,
  });

  await client.connect();
  clientCache[uri] = client;
  return client;
}

/**
 * Helper to serialize MongoDB documents using Extended JSON (EJSON).
 * This preserves BSON types (like ObjectId, Date, Long) as special JSON objects.
 */
export function serializeEjson(data: any): any {
  if (data === null || data === undefined) return data;
  return JSON.parse(EJSON.stringify(data, { relaxed: true }));
}

/**
 * Helper to deserialize Extended JSON (EJSON) string or object back to MongoDB/BSON types.
 */
export function deserializeEjson(data: string | object): any {
  if (typeof data === 'string') {
    return EJSON.parse(data);
  }
  return EJSON.deserialize(data);
}
