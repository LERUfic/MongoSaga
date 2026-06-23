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
    if (!dbName || !colName) {
      return NextResponse.json({ error: 'Database and Collection names are required' }, { status: 400 });
    }

    const client = await getMongoClient(uri);
    const col = client.db(dbName).collection(colName);

    // Get list of indexes
    const indexes = await col.indexes();

    return NextResponse.json({ indexes: serializeEjson(indexes) });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Failed to fetch indexes' },
      { status: 500 }
    );
  }
}
