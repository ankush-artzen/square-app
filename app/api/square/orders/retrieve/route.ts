import { NextRequest, NextResponse } from 'next/server';
import { SquareClient, SquareEnvironment } from 'square';
import prisma from '@/lib/db/prisma-connect';
function safeStringify(obj: any) {
  return JSON.stringify(obj, (_, value) =>
    typeof value === 'bigint' ? value.toString() : value
  );
}
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const shop = searchParams.get('shop');
    const orderId = searchParams.get('id');

    if (!shop || !orderId) {
      return NextResponse.json({ error: 'Missing shop or order ID' }, { status: 400 });
    }

    const account = await prisma.squareAccount.findFirst({
      where: { shopDomain: shop },
    });

    if (!account?.accessToken) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 });
    }

    const client = new SquareClient({
      environment: SquareEnvironment.Production,
      token: account.accessToken,
    });

    const  result  = await client.orders.get({orderId});

 const jsonString = safeStringify({ orders: result.order || [] });

    return new Response(jsonString, {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });  } catch (error: any) {
    console.error('Failed to retrieve order:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve order', detail: error?.message },
      { status: 500 }
    );
  }
}
