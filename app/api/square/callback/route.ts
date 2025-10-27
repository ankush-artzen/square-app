import { NextRequest } from "next/server";
import prisma from "@/lib/db/prisma-connect";
import { appurl } from "@/lib/config/constant";

export async function GET(req: NextRequest) {
  console.log("📥 Inside Square OAuth callback");

  const baseUrl = process.env.SQUARE_BASE_URL;
  const redirectUri = `${appurl}/api/square/callback`
    // process.env.SQUARE_REDIRECT_URI ||
    // "https://caroline-iron-additional-pounds.trycloudflare.com/api/square/callback";

  // Extract params
  const searchParams = req.nextUrl.searchParams;
  const code = searchParams.get("code");
  const shop = searchParams.get("state"); // Shopify shop

  if (!code || !shop) {
    console.error("❌ Missing code or shop in callback");
    return new Response(
      JSON.stringify({ error: "Missing code or shop" }),
      { status: 400 }
    );
  }

  console.log("✅ Received code and shop", { code, shop });

  // Check environment variables
  if (
    !process.env.SQUARE_APPLICATION_ID ||
    !process.env.SQUARE_APPLICATION_SECRET ||
    !baseUrl
  ) {
    console.error("❌ Missing required environment variables", {
      hasAppId: !!process.env.SQUARE_APPLICATION_ID,
      hasSecret: !!process.env.SQUARE_APPLICATION_SECRET,
      baseUrl,
    });
    return new Response(
      JSON.stringify({ error: "Server missing Square OAuth config" }),
      { status: 500 }
    );
  }

  try {
    // Request token from Square
    const tokenBody = {
      client_id: process.env.SQUARE_APPLICATION_ID,
      client_secret: process.env.SQUARE_APPLICATION_SECRET,
      code,
      grant_type: "authorization_code",
      redirect_uri: redirectUri,
    };

    console.log("📡 Requesting Square token", {
      ...tokenBody,
      client_secret: "****", // mask secret in logs
    });

    const tokenRes = await fetch(`${baseUrl}/oauth2/token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(tokenBody),
    });

    const tokenData = await tokenRes.json();
    console.log("🔍 Square token response", tokenData);

    // Handle errors from Square
    if (!tokenRes.ok || !tokenData.access_token) {
      const reason =
        tokenData?.message ||
        tokenData?.error_description ||
        "Unknown error from Square";
      console.error("❌ Square OAuth failed:", reason);

      let userHint = reason;
      if (reason.includes("Not Authorized")) {
        userHint =
          "Your Square OAuth credentials or redirect URI are incorrect. Check that you're using the correct environment (sandbox vs production) and that your redirect URI matches exactly.";
      }

      return new Response(
        JSON.stringify({
          error: "Square OAuth failed",
          reason,
          hint: userHint,
        }),
        { status: 400 }
      );
    }

    const { access_token, refresh_token, merchant_id, expires_at } = tokenData;

    // Save to database
    const existingAccount = await prisma.squareAccount.findFirst({
      where: { shopDomain: shop },
    });
    
    if (existingAccount) {
      // Update existing record
      await prisma.squareAccount.update({
        where: { shopDomain: shop },
        data: {
          accessToken: access_token,
          refreshToken: refresh_token,
          merchantId: merchant_id,
          expiresAt: new Date(expires_at),
        },
      });
    } else {
      // Create new record
      await prisma.squareAccount.create({
        data: {
          shopDomain: shop,
          accessToken: access_token,
          refreshToken: refresh_token,
          merchantId: merchant_id,
          expiresAt: new Date(expires_at),
        },
      });
    }
    

    console.log("✅ Square account saved to DB");

    // Redirect to Shopify app
    const redirectUrl = `https://${shop}/admin/apps/${process.env.APP_HANDLE}`;
    return new Response(null, {
      status: 302,
      headers: { Location: redirectUrl },
    });
  } catch (error: any) {
    console.error("💥 Unexpected error in Square OAuth callback:", error);
    return new Response(
      JSON.stringify({ error: "Internal Server Error", detail: String(error) }),
      { status: 500 }
    );
  }
}
