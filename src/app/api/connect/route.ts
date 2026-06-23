import { logger } from '@/lib/logger';
import { auth } from '@/lib/auth';
import { NextResponse } from 'next/server';
   import { getMongoClient } from '@/lib/mongodb';

   export async function POST(request: Request) {
  const session = await auth();
  const user = session?.user?.name || 'anonymous';
     try {
       const body = await request.json().catch(() => ({}));
       const headerUri = request.headers.get('x-mongodb-uri');
       const uri = body.uri || headerUri;

       if (!uri) {
         return NextResponse.json(
           { error: 'Connection URI is required' },
           { status: 400 }
         );
       }

       const client = await getMongoClient(uri);
       const adminDb = client.db('admin');

       // Test connection with ping
       await adminDb.command({ ping: 1 });

       // Get server status / build info
       const serverStatus = await adminDb.command({ buildInfo: 1 }).catch(() => null);

       // List databases
       const dbList = await adminDb.admin().listDatabases();

           logger.info({ event: 'connect_success', username: user });
    return NextResponse.json({
      success: true,
         version: serverStatus?.version || 'Unknown',
         databases: dbList.databases,
       });
     } catch (err: any) {
       logger.error({ event: 'connect_error', username: user, error: err.message || err });
       return NextResponse.json(
         { error: err.message || 'Failed to connect to MongoDB' },
         { status: 500 }
       );
     }
   }
   
