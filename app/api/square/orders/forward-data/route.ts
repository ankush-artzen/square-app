import { NextRequest, NextResponse } from "next/server";

const CHUNK_SIZE = 500;
const MAX_RETRIES = 3;

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const shop = searchParams.get("shop");

    if (!shop) {
      return NextResponse.json({ error: "Missing shop parameter" }, { status: 400 });
    }

    let allOrders: any[] = [];
    let cursor: string | undefined = undefined;
    let page = 1;

    // 1️⃣ Fetch all orders from internal API using pagination
    do {
      const url = new URL(`${process.env.HOST}/api/square/orders`);
      url.searchParams.set("shop", shop);
      if (cursor) url.searchParams.set("cursor", cursor);

      console.log(`Fetching page ${page} from internal orders API...`);
      const res = await fetch(url.toString(), { method: "GET", headers: { "Content-Type": "application/json" } });

      if (!res.ok) {
        throw new Error(`Orders API failed with status ${res.status}`);
      }

      const data = await res.json();
      const orders = Array.isArray(data.orders) ? data.orders : [];
      console.log(`Fetched ${orders.length} orders in page ${page}`);

      allOrders.push(...orders);
      cursor = data.nextCursor;
      page++;
    } while (cursor);

    console.log(`✅ Total orders fetched: ${allOrders.length}`);

    // 2️⃣ Forward orders in chunks with retries
    let totalForwarded = 0;

    for (let i = 0; i < allOrders.length; i += CHUNK_SIZE) {
      const chunk = allOrders.slice(i, i + CHUNK_SIZE);
      let success = false;

      for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
          const forwardRes = await fetch(`${process.env.HOST}/api/square/orders/receive-data`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ shop, orders: chunk }),
          });

          if (!forwardRes.ok) {
            console.warn(`Attempt ${attempt} failed for orders ${i + 1}-${i + chunk.length} (status ${forwardRes.status})`);
            continue;
          }

          const result = await forwardRes.json();
          totalForwarded += chunk.length;
          console.log(`✅ Forwarded orders ${i + 1}-${i + chunk.length} successfully`, result);
          success = true;
          break; // exit retry loop on success
        } catch (err: any) {
          console.error(`Attempt ${attempt} error forwarding orders ${i + 1}-${i + chunk.length}:`, err);
        }
      }

      if (!success) {
        console.error(`❌ Failed to forward orders ${i + 1}-${i + chunk.length} after ${MAX_RETRIES} attempts`);
      }
    }

    return NextResponse.json({
      message: "Orders fetched and forwarded successfully",
      shop,
      totalOrdersFetched: allOrders.length,
      totalOrdersForwarded: totalForwarded,
    });

  } catch (err: any) {
    console.error("❌ Error fetching or forwarding orders:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
