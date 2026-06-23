import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { auth } from '@/lib/auth';
import { getMongoClient, serializeEjson, deserializeEjson } from '@/lib/mongodb';

/**
 * Recursively checks if an object contains keys that are write stages ($out, $merge).
 */
function containsWriteStages(obj: any): boolean {
  if (!obj || typeof obj !== 'object') return false;

  if (Array.isArray(obj)) {
    return obj.some(item => containsWriteStages(item));
  }

  for (const key of Object.keys(obj)) {
    const cleanKey = key.trim().toLowerCase();
    if (cleanKey === '$out' || cleanKey === '$merge') {
      return true;
    }
    if (containsWriteStages(obj[key])) {
      return true;
    }
  }

  return false;
}

export async function POST(request: Request) {
  const session = await auth();
  const user = session?.user?.name || 'anonymous';
  try {
    const uri = request.headers.get('x-mongodb-uri');
    if (!uri) {
      return NextResponse.json({ error: 'Connection URI is required' }, { status: 400 });
    }

    const body = await request.json().catch(() => ({}));
    const { db: dbName, collection: colName, pipeline: rawPipeline, limit = 20 } = body;

    if (!dbName || !colName) {
      return NextResponse.json({ error: 'Database and Collection names are required' }, { status: 400 });
    }

    if (!rawPipeline) {
      return NextResponse.json({ error: 'Aggregation pipeline is required' }, { status: 400 });
    }

    // Safely parse the pipeline using EJSON
    let pipeline: any[] = [];
    try {
      pipeline = typeof rawPipeline === 'string'
        ? deserializeEjson(rawPipeline)
        : deserializeEjson(JSON.stringify(rawPipeline));

      if (!Array.isArray(pipeline)) {
        return NextResponse.json({ error: 'Pipeline must be an array of stages' }, { status: 400 });
      }
    } catch (err: any) {
      return NextResponse.json({ error: `Invalid Pipeline JSON: ${err.message}` }, { status: 400 });
    }

    // STRICT SAFETY CHECK: Check for any write stages ($out or $merge)
    if (containsWriteStages(pipeline)) {
      return NextResponse.json(
        { error: 'Security Exception: Write operations ($out, $merge) are strictly prohibited in read-only mode.' },
        { status: 403 }
      );
    }

    const client = await getMongoClient(uri);
    const col = client.db(dbName).collection(colName);

    // Run aggregation
    const cursor = col.aggregate(pipeline);

    // Apply a safety limit to aggregation results if not already limited
    // to prevent fetching millions of documents in memory.
    // If the pipeline already contains a $limit stage at the end, we respect it,
    // otherwise we limit to 100 max results.
    let hasLimit = false;
    for (const stage of pipeline) {
      if (stage && typeof stage === 'object' && stage.$limit !== undefined) {
        hasLimit = true;
      }
    }

    let results = [];
    if (hasLimit) {
      results = await cursor.toArray();
    } else {
      // Limit to max 100 documents for UI display if no limit stage exists
      results = await cursor.limit(Math.min(Number(limit) || 20, 500)).toArray();
    }

        logger.info({ event: 'aggregate_success', username: user, metadata: { dbName, colName, pipeline } });
    return NextResponse.json({
      success: true,
      documents: serializeEjson(results),
      count: results.length,
    });
  } catch (err: any) {
    logger.error({ event: 'aggregate_error', username: user, error: err.message || err });
    return NextResponse.json(
      { error: err.message || 'Failed to execute aggregation pipeline' },
      { status: 500 }
    );
  }
}
