import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const shop = searchParams.get("shop");

    if (!shop) {
      return NextResponse.json({ error: "Missing shop parameter" }, { status: 400 });
    }

    // 1️⃣ Fetch internal catalog
    const catalogRes = await fetch(`${process.env.HOST}/api/square/catalog?shop=${shop}`);
    if (!catalogRes.ok) {
      throw new Error(`Catalog API failed with status ${catalogRes.status}`);
    }

    let catalogData: any = {};
    try {
      catalogData = await catalogRes.json();
    } catch {
      catalogData = { items: [] };
    }

    const items = Array.isArray(catalogData.items) ? catalogData.items : [];
    console.log(`🔹 Fetched ${items.length} catalog items`);

    // 2️⃣ Forward catalog to POST endpoint
    const forwardRes = await fetch(`${process.env.HOST}/api/square/catalog/receive-data`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ shop, items }),
    });

    let forwardedResult: any;
    try {
      forwardedResult = await forwardRes.json();
    } catch {
      console.warn("⚠ No JSON returned from receive-data endpoint");
      forwardedResult = {
        message: "Data forwarded but no JSON returned",
        shop,
        forwardedItems: items.length,
        status: forwardRes.status,
      };
    }

    console.log("✅ Forwarded result:", forwardedResult);

    // 3️⃣ Return the forwarded result
    return NextResponse.json(forwardedResult);

  } catch (err: any) {
    console.error("❌ Error in forwarding:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
