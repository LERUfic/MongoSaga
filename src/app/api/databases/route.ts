import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { auth } from '@/lib/auth';
import { getMongoClient } from '@/lib/mongodb';

export async function GET(request: Request) {
  const session = await auth();
  const user = session?.user?.name || 'anonymous';
  try {
    const uri = request.headers.get('x-mongodb-uri');
    if (!uri) {
      return NextResponse.json({ error: 'Connection URI is required' }, { status: 400 });
    }

    const client = await getMongoClient(uri);
    const adminDb = client.db('admin');

    const dbList = await adminDb.admin().listDatabases();

    // Fetch collections count for each database (if possible, catch errors if unauthorized)
    const databasesWithDetails = await Promise.all(
      dbList.databases.map(async (dbInfo) => {
        try {
          const db = client.db(dbInfo.name);
          const collections = await db.listCollections().toArray();
          return {
            ...dbInfo,
            collectionCount: collections.length,
          };
        } catch {
          // If we lack permissions to list collections in a database, return default info
          return {
            ...dbInfo,
            collectionCount: null,
          };
        }
      })
    );

    return NextResponse.json({ databases: databasesWithDetails });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Failed to fetch databases' },
      { status: 500 }
    );
  }
}
