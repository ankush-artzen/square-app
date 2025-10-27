import { NextRequest, NextResponse } from "next/server";
import { SquareClient, SquareEnvironment } from "square";
import prisma from "@/lib/db/prisma-connect";

function safeStringify(obj: any) {
  return JSON.stringify(obj, (_, value) =>
    typeof value === "bigint" ? value.toString() : value,
  );
}

function toInt(value: any): number {
  if (typeof value === "bigint") return Number(value);
  if (typeof value === "string") return parseInt(value, 10) || 0;
  if (typeof value === "number") return value;
  return 0;
}

interface LineItem {
  name?: string;
  variationName?: string;
  quantity?: string;
  basePriceMoney?: { amount?: number | bigint };
  totalMoney?: { amount?: number | bigint };
  itemType?: string;
  catalogObjectId?: string;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const shop = searchParams.get("shop");
    if (!shop) return NextResponse.json({ error: "Missing shop" }, { status: 400 });

    const account = await prisma.squareAccount.findFirst({ where: { shopDomain: shop } });
    if (!account || !account.accessToken)
      return NextResponse.json({ error: "Account not found" }, { status: 404 });

    const client = new SquareClient({
      token: account.accessToken,
      environment: SquareEnvironment.Production,
    });

    const locationId = process.env.SQUARE_LOCATION_ID;
    if (!locationId) throw new Error("No location ID found in environment variables");

    console.log(`Fetching orders for shop: ${shop}, location: ${locationId}`);

    let allOrders: any[] = [];
    let cursor: string | undefined = undefined;
    let page = 1;

    // Cursor-based pagination loop
    do {
      console.log(`Fetching page ${page}...`);
      const result = await client.orders.search({
        locationIds: [locationId],
        query: { filter: { stateFilter: { states: ["OPEN", "COMPLETED"] } } },
        cursor,
      });

      const fetched = result.orders?.length || 0;
      console.log(`Fetched ${fetched} orders in this page.`);

      allOrders = allOrders.concat(result.orders || []);
      cursor = result.cursor;
      page++;
    } while (cursor);

    console.log(`Total orders fetched: ${allOrders.length}`);

    // Save orders in smaller async chunks
    const chunkSize = 50;
    for (let i = 0; i < allOrders.length; i += chunkSize) {
      const chunk = allOrders.slice(i, i + chunkSize);
      // console.log(`Saving orders ${i + 1} to ${i + chunk.length}...`);

      await Promise.allSettled(
        chunk.map(async (order) => {
          if (!order.id) return;

          const existing = await prisma.order.findUnique({ where: { squareOrderId: order.id } });
          if (existing) return;

          return prisma.order.create({
            data: {
              squareOrderId: order.id ?? "",
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
              lineItems:
                order.lineItems && order.lineItems.length > 0
                  ? {
                      create: order.lineItems.map((item: LineItem) => ({
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
        }),
      );
    }

    const savedOrders = await prisma.order.findMany({
      where: { shopDomain: shop },
      include: { lineItems: true },
      orderBy: { createdAt: "desc" },
    });

    // console.log(`Total orders saved in DB: ${savedOrders.length}`);

    const counts = {
      total: savedOrders.length,
      open: savedOrders.filter((o) => o.state === "OPEN").length,
      completed: savedOrders.filter((o) => o.state === "COMPLETED").length,
    };

    return new NextResponse(
      safeStringify({ shop, counts, orders: savedOrders }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  } catch (error: any) {
    console.error("Failed to fetch orders:", error);
    return NextResponse.json({ error: "Failed to fetch orders", detail: error?.message }, { status: 500 });
  }
}
