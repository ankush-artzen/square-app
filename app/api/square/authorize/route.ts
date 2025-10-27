import { appurl } from '@/lib/config/constant';
import { NextRequest } from 'next/server';

export async function GET(req: NextRequest) {
  
    console.log("inside auth api")
  const shop = req.nextUrl.searchParams.get('shop');
  if (!shop) return new Response('Missing shop', { status: 400 });

  const redirectUri = `${appurl}/api/square/callback`
  const scopes = 'MERCHANT_PROFILE_READ PAYMENTS_READ PAYMENTS_WRITE CUSTOMERS_READ ORDERS_READ ORDERS_WRITE ITEMS_READ ITEMS_WRITE';

  const authUrl = `${process.env.SQUARE_BASE_URL}/oauth2/authorize?client_id=${process.env.SQUARE_APPLICATION_ID}&scope=${encodeURIComponent(
    scopes
  )}&session=false&redirect_uri=${encodeURIComponent(
    redirectUri
  )}&state=${encodeURIComponent(shop)}`;

  return Response.redirect(authUrl);
}
