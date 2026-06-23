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
    const { db: dbName, collection: colName } = body;

    if (!dbName || !colName) {
      return NextResponse.json({ error: 'Database and Collection names are required' }, { status: 400 });
    }

    let filter = {};
    try {
      if (body.filter) {
        filter = typeof body.filter === 'string'
          ? deserializeEjson(body.filter)
          : deserializeEjson(JSON.stringify(body.filter));
      }
    } catch (err: any) {
      return NextResponse.json({ error: `Invalid Filter JSON: ${err.message}` }, { status: 400 });
    }

    const client = await getMongoClient(uri);
    const col = client.db(dbName).collection(colName);

    // Run explain plan
    const explainPlan = await col.find(filter).explain();

        logger.info({ event: 'explain_success', username: user, metadata: { dbName, colName, filter } });
    return NextResponse.json({
      success: true,
      explainPlan: serializeEjson(explainPlan),
    });
  } catch (err: any) {
    logger.error({ event: 'explain_error', username: user, error: err.message || err });
    return NextResponse.json(
      { error: err.message || 'Failed to explain query plan' },
      { status: 500 }
    );
  }
}
