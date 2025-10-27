import { NextRequest, NextResponse } from "next/server";
import { SquareClient, SquareEnvironment } from "square";
import { v4 as uuidv4 } from "uuid";
import prisma from "@/lib/db/prisma-connect";

interface ItemVariationData {
  priceMoney?: { amount?: number; currency?: string };
  sku?: string;
}

function isItemVariation(
  obj: any,
): obj is { type: string; itemVariationData: ItemVariationData } {
  return obj?.type === "ITEM_VARIATION" && obj?.itemVariationData != null;
}

function toInt(value: any): number {
  if (typeof value === "bigint") return Number(value);
  if (typeof value === "string") return parseInt(value, 10) || 0;
  if (typeof value === "number") return value;
  return 0;
}

export async function POST(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const shop = searchParams.get("shop");

  if (!shop) {
    return NextResponse.json(
      { error: "Missing shop parameter" },
      { status: 400 },
    );
  }

  const account = await prisma.squareAccount.findFirst({
    where: { shopDomain: shop },
  });
  if (!account?.accessToken) {
    return NextResponse.json(
      { error: "Square account not found" },
      { status: 404 },
    );
  }

  const square = new SquareClient({
    environment: SquareEnvironment.Production,
    token: account.accessToken,
  });

  const locationId = process.env.SQUARE_LOCATION_ID;
  if (!locationId) {
    throw new Error("No location ID found in environment variables");
  }
  try {
    // 1️⃣ Fetch catalog items
    const catalogResponse = await square.catalog.list();
    const catalogItems = (catalogResponse.data ?? []).filter(
      (obj) => obj.type === "ITEM",
    );
    if (!catalogItems.length)
      return NextResponse.json({ error: "No catalog items" }, { status: 400 });

    // 2️⃣ Fetch customers
    const customersResponse = await square.customers.list();
    const customers = customersResponse?.data ?? [];
    if (!customers.length)
      return NextResponse.json(
        { error: "No customers found" },
        { status: 400 },
      );

    const createdOrders: any[] = [];

    // 3️⃣ Create orders and save to DB
    for (const customer of customers) {
      const chunkSize = 30;
      for (let i = 0; i < catalogItems.length; i += chunkSize) {
        const chunk = catalogItems.slice(i, i + chunkSize);

        for (const item of chunk) {
          const name = item.itemData?.name ?? "";
          const variationObj = item.itemData?.variations?.[0];
          if (!variationObj || !isItemVariation(variationObj)) continue;

          const { priceMoney, sku } = variationObj.itemVariationData;

          // Cast currency to `any` to satisfy TS
          const lineItem = {
            catalogObjectId: variationObj.id,
            name,
            quantity: "1",
            basePriceMoney: {
              amount: BigInt(priceMoney?.amount ?? 0),
              currency: (priceMoney?.currency ?? "USD") as any,
            },
            sku: sku ?? "",
          };

          // ✅ Create order in Square
          const orderResponse = await square.orders.create({
            idempotencyKey: uuidv4(),
            order: {
              locationId,
              customerId: customer.id,
              lineItems: [lineItem],
              pricingOptions: {
                autoApplyTaxes: true,
                autoApplyDiscounts: true,
              },
            },
          });

          const squareOrder = orderResponse.order;
          if (!squareOrder?.id) continue;

          // ✅ Save order into DB with nested lineItems
          await prisma.order.create({
            data: {
              squareOrderId: squareOrder.id,
              customerId: customer.id,
              locationId,
              createdAt: new Date(),
              updatedAt: new Date(),
              state: "OPEN",
              totalAmount: toInt(squareOrder.totalMoney?.amount),
              currency: squareOrder.totalMoney?.currency ?? "USD",
              netAmountDue: toInt(squareOrder.totalMoney?.amount),
              shopDomain: shop,
              lineItems: {
                create:
                  squareOrder.lineItems?.map((li) => ({
                    name: li.name ?? "",
                    variationName: "",
                    quantity: parseInt(li.quantity ?? "1", 10),
                    basePriceAmount: toInt(li.basePriceMoney?.amount),
                    totalAmount: toInt(li.totalMoney?.amount),
                    itemType: "ITEM",
                    catalogObjectId: li.catalogObjectId ?? "",
                  })) ?? [],
              },
            },
          });

          // Prepare response for frontend
          createdOrders.push({
            squareOrderId: squareOrder.id,
            customerId: customer.id,
            totalAmount: squareOrder.totalMoney?.amount?.toString() ?? "0",
            currency: squareOrder.totalMoney?.currency ?? "USD",
            state: "OPEN",
            totalLineItems: squareOrder.lineItems?.length ?? 0,
            lineItems:
              squareOrder.lineItems?.map((li) => ({
                name: li.name,
                catalogObjectId: li.catalogObjectId,
                quantity: li.quantity,
                basePrice: li.basePriceMoney?.amount?.toString() ?? "0",
                currency: li.basePriceMoney?.currency ?? "USD",
              })) ?? [],
          });
        }
      }
    }

    return NextResponse.json({
      totalOrdersCreated: createdOrders.length,
      totalLineItemsAcrossOrders: createdOrders.reduce(
        (sum, o) => sum + (o.totalLineItems ?? 0),
        0,
      ),
      orders: createdOrders,
    });
  } catch (error: any) {
    console.error("[Square Catalog Order Error]", error);
    return NextResponse.json(
      { error: "Failed to create order from catalog", details: error.message },
      { status: 500 },
    );
  }
}
