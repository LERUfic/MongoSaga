import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { auth } from '@/lib/auth';
import { getMongoClient } from '@/lib/mongodb';

export async function GET(request: Request) {
  const session = await auth();
  const user = session?.user?.name || 'anonymous';
  try {
    const uri = request.headers.get('x-mongodb-uri');
    const { searchParams } = new URL(request.url);
    const dbName = searchParams.get('db');

    if (!uri) {
      return NextResponse.json({ error: 'Connection URI is required' }, { status: 400 });
    }
    if (!dbName) {
      return NextResponse.json({ error: 'Database name parameter is required' }, { status: 400 });
    }

    const client = await getMongoClient(uri);
    const db = client.db(dbName);

    // List collections
    const collections = await db.listCollections().toArray();

    // Fetch stats for each collection
    const collectionsWithStats = await Promise.all(
      collections.map(async (colInfo) => {
        const colName = colInfo.name;
        const col = db.collection(colName);
        let docCount = 0;
        let storageSize = 0;
        let indexSize = 0;

        try {
          docCount = await col.estimatedDocumentCount();
        } catch {
          try {
            docCount = await col.countDocuments();
          } catch {
            docCount = -1; // Unknown
          }
        }

        try {
          const stats = await db.command({ collStats: colName });
          storageSize = stats.storageSize || 0;
          indexSize = stats.totalIndexSize || 0;
        } catch {
          // If collStats fails (e.g. Atlas Serverless or limited roles), try finding size via command
          storageSize = 0;
          indexSize = 0;
        }

        return {
          name: colName,
          type: colInfo.type,
          docCount,
          storageSize,
          indexSize,
        };
      })
    );

    return NextResponse.json({ collections: collectionsWithStats });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Failed to fetch collections' },
      { status: 500 }
    );
  }
}
