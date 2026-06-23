import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { auth } from '@/lib/auth';
import { getMongoClient, serializeEjson } from '@/lib/mongodb';

export async function GET(request: Request) {
  const session = await auth();
  const user = session?.user?.name || 'anonymous';
  try {
    const uri = request.headers.get('x-mongodb-uri');
    const { searchParams } = new URL(request.url);
    const dbName = searchParams.get('db');
    const colName = searchParams.get('collection');

    if (!uri) {
      return NextResponse.json({ error: 'Connection URI is required' }, { status: 400 });
    }
    if (!dbName) {
      return NextResponse.json({ error: 'Database name is required' }, { status: 400 });
    }

    const client = await getMongoClient(uri);
    const db = client.db(dbName);

    if (colName) {
      // Collection stats
      try {
        const stats = await db.command({ collStats: colName });
        return NextResponse.json({ stats: serializeEjson(stats) });
      } catch (err: any) {
        // Fallback for newer mongo versions or environments where collStats isn't available
        // e.g. run a basic aggregate or get index details
        const col = db.collection(colName);
        const count = await col.estimatedDocumentCount().catch(() => 0);
        return NextResponse.json({
          stats: {
            ns: `${dbName}.${colName}`,
            count,
            storageSize: 0,
            totalIndexSize: 0,
            info: 'collStats command not supported by this server or user permissions. Basic count returned.',
          }
        });
      }
    } else {
      // Database stats
      const stats = await db.command({ dbStats: 1 });
      return NextResponse.json({ stats: serializeEjson(stats) });
    }
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Failed to fetch statistics' },
      { status: 500 }
    );
  }
}
