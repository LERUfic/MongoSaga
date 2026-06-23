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
    const { db: dbName, collection: colName, scope = 'query' } = body;

    if (!dbName || !colName) {
      return NextResponse.json({ error: 'Database and Collection names are required' }, { status: 400 });
    }

    let filter = {};
    let sort = {};
    let projection = {};

    // Only apply query parameters if scope is 'query'
    if (scope === 'query') {
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
    }

    const client = await getMongoClient(uri);
    const col = client.db(dbName).collection(colName);

    // Run find query without the tight 1000 limit cap, but with a safety cap (e.g. 50,000 docs) to prevent crash
    const safetyCap = 50000;
    const cursor = col.find(filter, { projection }).sort(sort).limit(safetyCap);
    const documents = await cursor.toArray();

    const ejsonArray = serializeEjson(documents);

    return new NextResponse(JSON.stringify(ejsonArray, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="${colName}_export.json"`,
      },
    });
  } catch (err: any) {
    logger.error({ event: 'export_error', username: user, error: err.message || err });
    return NextResponse.json(
      { error: err.message || 'Failed to export collection' },
      { status: 500 }
    );
  }
}
