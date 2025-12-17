import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const hasKey = !!process.env.DAYTONA_API_KEY;
  const serverUrl = process.env.DAYTONA_SERVER_URL || null;

  // Debug logging (server-side only)
  // eslint-disable-next-line no-console
  console.log('Daytona status check:', {
    hasKey,
    hasServerUrl: !!serverUrl,
    serverUrl: serverUrl ? `${serverUrl.substring(0, 20)}...` : 'null'
  });

  return NextResponse.json({
    connected: hasKey && !!serverUrl,
    hasKey,
    serverUrl
  });
}

