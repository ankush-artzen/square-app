// /app/api/square/deauthorize/route.ts
import { NextResponse } from 'next/server';
import prisma from '@/lib/db/prisma-connect';
export async function POST(req: Request,{ params }: { params: { id: string }}) {
  try {
    console.log("inside post api")
    const { id } = params;
    console.log("Id:",id)
    if (!id) {
      return NextResponse.json({ error: 'Missing ID' }, { status: 400 });
    }

    const squareAccount = await prisma.squareAccount.findUnique({
      where: { id },
    });
    console.log("token:",squareAccount?.accessToken)
    console.log("SQUARE_APPLICATION_ID:",process.env.SQUARE_APPLICATION_ID)

    if (!squareAccount?.accessToken) {
      return NextResponse.json({ error: 'Square account not found' }, { status: 404 });
    }

    const revokeRes = await fetch(`${process.env.SQUARE_BASE_URL}/oauth2/revoke`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Square-Version': '2024-07-17',
        Authorization: `Client ${process.env.SQUARE_APPLICATION_SECRET}`,

      },

      body: JSON.stringify({
        client_id: process.env.SQUARE_APPLICATION_ID,
        access_token: squareAccount.accessToken,
      }),
    });

    if (!revokeRes.ok) {
      let errorDetails = {};
      try {
        errorDetails = await revokeRes.json();
      } catch {
        errorDetails = { message: 'No JSON body returned by Square' };
      }

      return NextResponse.json(
        { error: 'Failed to revoke token from Square', details: errorDetails },
        { status: 500 }
      );
    }

    await prisma.squareAccount.delete({
      where: { id },
    });

    return NextResponse.json({success:true, message: 'Successfully deauthorized and removed from DB' });
  } catch (err) {
    console.error('[SQUARE_DEAUTHORIZE_ERROR]', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
