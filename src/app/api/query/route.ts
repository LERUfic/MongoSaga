import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { auth } from '@/lib/auth';
import { getMongoClient, serializeEjson, deserializeEjson } from '@/lib/mongodb';

export async function POST(request: Request) {
  const session = await auth();
  const user = session?.user?.name || 'anonymous';
  try {
    const uri = request.headers.get('x-mongodb-uri');
    if (!uri) {
      return NextResponse.json({ error: 'Connection URI is required' }, { status: 400 });
    }

    const body = await request.json().catch(() => ({}));
    const { db: dbName, collection: colName, limit = 20, skip = 0 } = body;

    if (!dbName || !colName) {
      return NextResponse.json({ error: 'Database and Collection names are required' }, { status: 400 });
    }

    // Safely parse filter, sort, and projection using EJSON
    let filter = {};
    let sort = {};
    let projection = {};

    try {
      if (body.filter) {
        filter = typeof body.filter === 'string' 
          ? deserializeEjson(body.filter) 
          : deserializeEjson(JSON.stringify(body.filter));
      }
    } catch (err: any) {
      return NextResponse.json({ error: `Invalid Filter JSON: ${err.message}` }, { status: 400 });
    }

    try {
      if (body.sort) {
        sort = typeof body.sort === 'string' 
          ? deserializeEjson(body.sort) 
          : deserializeEjson(JSON.stringify(body.sort));
      }
    } catch (err: any) {
      return NextResponse.json({ error: `Invalid Sort JSON: ${err.message}` }, { status: 400 });
    }

    try {
      if (body.projection) {
        projection = typeof body.projection === 'string' 
          ? deserializeEjson(body.projection) 
          : deserializeEjson(JSON.stringify(body.projection));
      }
    } catch (err: any) {
      return NextResponse.json({ error: `Invalid Projection JSON: ${err.message}` }, { status: 400 });
    }

    const client = await getMongoClient(uri);
    const col = client.db(dbName).collection(colName);

    // Enforce limits to prevent memory overflow
    const maxLimit = Math.min(Number(limit) || 20, 1000);
    const parsedSkip = Math.max(Number(skip) || 0, 0);

    // Run find query (Strictly Read-Only!)
    const cursor = col.find(filter, { projection })
      .sort(sort)
      .skip(parsedSkip)
      .limit(maxLimit);

    const documents = await cursor.toArray();

    // Try to get total count matching filter
    let totalCount = 0;
    try {
      // Use countDocuments with maxTimeMS to prevent hanging on huge collections
      totalCount = await col.countDocuments(filter, { maxTimeMS: 2000 });
    } catch {
      // Fallback if counting times out or is slow
      totalCount = -1; 
    }

        logger.info({ event: 'query_success', username: user, metadata: { dbName, colName, filter, sort, projection, limit, skip } });
    return NextResponse.json({
      success: true,
      documents: serializeEjson(documents),
      count: documents.length,
      totalCount,
      limit: maxLimit,
      skip: parsedSkip,
    });
  } catch (err: any) {
    logger.error({ event: 'query_error', username: user, error: err.message || err });
    return NextResponse.json(
      { error: err.message || 'Failed to execute query' },
      { status: 500 }
    );
  }
}
