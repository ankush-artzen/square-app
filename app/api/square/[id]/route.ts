// /app/api/square/deauthorize/route.ts

import { NextResponse } from 'next/server';
import prisma from '@/lib/db/prisma-connect';

export async function POST(req: Request, { params }: { params: { id: string }}) {
  try {
    console.log("✅ [SQUARE DEAUTHORIZE] POST API triggered");

    const { id } = params;
    console.log("🆔 Square Account ID:", id);

    if (!id) {
      console.warn("⚠️ Missing Square Account ID in request");
      return NextResponse.json({ error: 'Missing ID' }, { status: 400 });
    }

    const squareAccount = await prisma.squareAccount.findUnique({
      where: { id },
    });

    if (!squareAccount) {
      console.warn("⚠️ No Square account found in DB for ID:", id);
      return NextResponse.json({ error: 'Square account not found' }, { status: 404 });
    }

    console.log("🔍 Found Square Account in DB:", {
      merchantId: squareAccount.merchantId,
      createdAt: squareAccount.createdAt,
    });

    const revokeUrl = `${process.env.SQUARE_BASE_URL}/oauth2/revoke`;
    console.log("🌐 Square Revoke URL:", revokeUrl);

    const revokeRes = await fetch(`${process.env.SQUARE_BASE_URL}/oauth2/revoke`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Square-Version': '2024-07-17',
      },
      body: JSON.stringify({
        client_id: process.env.SQUARE_APPLICATION_ID,
        access_token: squareAccount.accessToken,
      }),
    });
    
    if (!revokeRes.ok) {
      console.warn("⚠️ Token missing or already revoked on Square.");
    }
    
    await prisma.squareAccount.delete({ where: { id } });
    
    return NextResponse.json({
      success: true,
      message: 'Token revoked (or already removed). DB cleaned.'
    });
    

    console.log("🔁 Square API Revoke Response Status:", revokeRes.status);

    if (!revokeRes.ok) {
      const errorDetails = await revokeRes.json().catch(() => ({
        message: 'No JSON response body',
      }));

      console.error("❌ Failed to revoke Square access token:", errorDetails);

      return NextResponse.json(
        { error: 'Failed to revoke token from Square', details: errorDetails },
        { status: 500 }
      );
    }

    console.log("🗑️ Removing Square account from DB...");
    await prisma.squareAccount.delete({ where: { id } });

    console.log("✅ Successfully deauthorized & removed from DB");

    return NextResponse.json({
      success: true,
      message: 'Successfully deauthorized and removed from DB',
    });

  } catch (err) {
    console.error("💥 [SQUARE_DEAUTHORIZE_ERROR]", err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

