import { NextRequest, NextResponse } from "next/server";
import { SquareClient, SquareEnvironment } from "square";
import prisma from "@/lib/db/prisma-connect";
import { verifySignatureAppRouter } from "@upstash/qstash/nextjs";

function toInt(value: any): number {
  if (typeof value === "bigint") return Number(value);
  if (typeof value === "string") return parseInt(value, 10) || 0;
  if (typeof value === "number") return value;
  return 0;
}

async function handler(req: NextRequest) {
  try {
    const bodyText = await req.text();
    console.log("===== Orders Hit =====");
    console.log("Headers:", Object.fromEntries(req.headers));
    console.log("Body:", bodyText);

    const { shop } = JSON.parse(bodyText);
    if (!shop) {
      console.log("Missing shop in request body");
      return NextResponse.json({ error: "Missing shop" }, { status: 400 });
    }

    // Fetch Square account
    const account = await prisma.squareAccount.findFirst({
      where: { shopDomain: shop },
    });
    if (!account || !account.accessToken) {
      console.log("Square account not found for shop:", shop);
      return NextResponse.json({ error: "Account not found" }, { status: 404 });
    }

    const client = new SquareClient({
      token: account.accessToken,
      environment: SquareEnvironment.Production,
    });

    const locationId = process.env.SQUARE_LOCATION_ID!;
    if (!locationId) throw new Error("No location ID in env");

    // Fetch all orders from Square
    let allOrders: any[] = [];
    let cursor: string | undefined = undefined;
    do {
      const result = await client.orders.search({
        locationIds: [locationId],
        query: { filter: { stateFilter: { states: ["OPEN", "COMPLETED"] } } },
        cursor,
      });
      console.log("Fetched batch of orders, count:", result.orders?.length || 0);
      allOrders = allOrders.concat(result.orders || []);
      cursor = result.cursor;
    } while (cursor);

    // console.log(`Total orders fetched from Square for shop ${shop}: ${allOrders.length}`);

    // Save orders in chunks
    const chunkSize = 50;
    for (let i = 0; i < allOrders.length; i += chunkSize) {
      const chunk = allOrders.slice(i, i + chunkSize);
      await Promise.allSettled(
        chunk.map(async (order) => {
          if (!order.id) return;

          const existing = await prisma.order.findUnique({ where: { squareOrderId: order.id } });
          if (existing) {
            // console.log("Order already exists in DB:", order.id);
            return;
          }

          await prisma.order.create({
            data: {
              squareOrderId: order.id,
              locationId: order.locationId ?? "",
              customerId: order.customerId ?? "",
              createdAt: new Date(order.createdAt ?? Date.now()),
              updatedAt: new Date(order.updatedAt ?? Date.now()),
              closedAt: order.closedAt ? new Date(order.closedAt) : null,
              state: order.state ?? "",
              totalAmount: toInt(order.totalMoney?.amount),
              currency: order.totalMoney?.currency ?? "USD",
              netAmountDue: toInt(order.netAmountDueMoney?.amount),
              shopDomain: shop,
              lineItems: order.lineItems?.length
                ? {
                    create: order.lineItems.map((item: any) => ({
                      name: item.name ?? "",
                      variationName: item.variationName ?? "",
                      quantity: parseInt(item.quantity ?? "1", 10),
                      basePriceAmount: toInt(item.basePriceMoney?.amount),
                      totalAmount: toInt(item.totalMoney?.amount),
                      itemType: item.itemType ?? "ITEM",
                      catalogObjectId: item.catalogObjectId ?? "",
                    })),
                  }
                : undefined,
            },
          });

          console.log("Saved order to DB:", order.id);
        })
      );
    }

    console.log(`Finished saving all orders for shop: ${shop}`);
    return NextResponse.json({ success: true, ordersFetched: allOrders.length });
  } catch (err: any) {
    console.error("Error in Orders route:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export const POST = verifySignatureAppRouter(handler);
