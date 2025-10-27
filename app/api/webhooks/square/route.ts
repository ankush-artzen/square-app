import { NextRequest } from 'next/server';
import prisma from '@/lib/db/prisma-connect';
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    if (body.event_type !== 'oauth.authorization.revoked') {
      return new Response('Ignored: not a deauthorization event', { status: 200 });
    }

    const merchantId = body.data?.id;

    if (!merchantId) {
      return new Response('Missing merchant ID in payload', { status: 400 });
    }

    // Delete or deactivate the Square account
    await prisma.squareAccount.deleteMany({
      where: { merchantId },
    });

    console.log(`✅ Square deauthorization webhook processed for merchantId: ${merchantId}`);

    return new Response('Success', { status: 200 });
  } catch (error) {
    console.error('❌ Error in Square deauthorization webhook:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
}
