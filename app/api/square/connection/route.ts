import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db/prisma-connect';


export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const shop = searchParams.get('shop');

  if (!shop) {
    return NextResponse.json({ error: 'Missing `shopId` query parameter' }, { status: 400 });
  }

  try {
    const squareAccount = await prisma.squareAccount.findFirst({
      where: { shopDomain:shop },
    });

    if (!squareAccount) {
      return NextResponse.json({ connected: false });
    }

    return NextResponse.json({
      connected: true,
      id:squareAccount.id,
      merchantId: squareAccount.merchantId,
      expiresAt: squareAccount.expiresAt,
    });
  } catch (error) {
    console.error('Error checking Square connection:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

