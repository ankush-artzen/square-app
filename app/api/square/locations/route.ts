import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db/prisma-connect';
import { SquareClient, SquareEnvironment } from 'square';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const shop = searchParams.get('shop');
    if (!shop) {
      return NextResponse.json({ error: 'Missing shop' }, { status: 400 });
    }

    const account = await prisma.squareAccount.findFirst({
      where: { shopDomain: shop },
    });

    if (!account?.accessToken) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 });
    }

    const client = new SquareClient({
      token: account.accessToken,
      environment: SquareEnvironment.Production,
    });

    const response = await client.locations.list();
    const locations = response.locations ?? [];

    for (const loc of locations) {
      if (!loc.id) {
        console.warn('Skipping location with missing ID', loc);
        continue; 
      }
    
      await prisma.squareLocation.upsert({
        where: { locationId: loc.id },
        update: {
          name: loc.name ?? '',
          timezone: loc.timezone ?? '',
          capabilities: loc.capabilities ?? {},
          status: loc.status ?? '',
          merchantId: loc.merchantId ?? '',
          country: loc.country ?? '',
          currency: loc.currency ?? '',
          type: loc.type ?? '',
          businessHours: loc.businessHours
            ? JSON.parse(JSON.stringify(loc.businessHours))
            : null,
        },
        create: {
          locationId: loc.id, 
          shopDomain: shop,
          name: loc.name ?? '',
          timezone: loc.timezone ?? '',
          capabilities: loc.capabilities ?? {},
          status: loc.status ?? '',
          merchantId: loc.merchantId ?? '',
          country: loc.country ?? '',
          currency: loc.currency ?? '',
          type: loc.type ?? '',
          businessHours: loc.businessHours
            ? JSON.parse(JSON.stringify(loc.businessHours))
            : null,
          createdAt: new Date(),
        },
      });
    }
    

    return NextResponse.json({ locations });
  } catch (error: any) {
    console.error('Error listing Square locations:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
