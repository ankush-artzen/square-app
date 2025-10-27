import { NextRequest, NextResponse } from "next/server";
import { SquareClient, SquareEnvironment } from "square";
import prisma from "@/lib/db/prisma-connect";
import crypto from "crypto";
import { ObjectId } from "mongodb";

function safeStringify(obj: any) {
  return JSON.stringify(obj, (_, value) =>
    typeof value === "bigint" ? value.toString() : value
  );
}

export async function POST(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const shop = searchParams.get("shop"); 
    const body = await req.json();

    const { name, variationName, quantity, basePriceAmount, itemType } = body;

    if (!shop || !name || !quantity || !basePriceAmount || !itemType) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Generate a new ObjectId string for orderId
    const orderId = new ObjectId().toHexString();

    // Get Square account for the shop
    const account = await prisma.squareAccount.findFirst({
      where: { shopDomain: shop },
    });

    if (!account?.accessToken) {
      return NextResponse.json(
        { error: "Square account not found" },
        { status: 404 }
      );
    }

    // Initialize Square client
    const client = new SquareClient({
      environment: SquareEnvironment.Production,
      token: account.accessToken,
    });

    // Create catalog item using batchUpsert
    const response: any = await client.catalog.batchUpsert({
      idempotencyKey: crypto.randomUUID(),
      batches: [
        {
          objects: [
            {
              type: "ITEM",
              id: `#TEMP_ITEM_${crypto.randomUUID()}`,
              itemData: {
                name,
                variations: [
                  {
                    type: "ITEM_VARIATION",
                    id: `#TEMP_VAR_${crypto.randomUUID()}`,
                    itemVariationData: {
                      name: variationName || "Default",
                      pricingType: "FIXED_PRICING",
                      priceMoney: {
                        amount: BigInt(basePriceAmount), // BigInt required
                        currency: "USD",
                      },
                    },
                  },
                ],
              },
            },
          ],
        },
      ],
    });

    // Use `any` type for catalog object
    const createdItem: any = response.objects?.[0];

    if (!createdItem) {
      return NextResponse.json(
        { error: "Failed to create item in Square" },
        { status: 500 }
      );
    }

    // Extract variation ID safely
    const variationId: string =
      createdItem?.itemData?.variations?.[0]?.id ?? createdItem?.id ?? "";

    // Save the item in MongoDB (LineItem)
    const savedLineItem = await prisma.lineItem.create({
      data: {
        orderId,
        name,
        variationName: variationName || null,
        quantity,
        basePriceAmount,
        totalAmount: quantity * basePriceAmount,
        itemType,
        catalogObjectId: variationId,
      },
    });

    return new Response(
      safeStringify({
        message: "Item created successfully",
        squareItem: createdItem,
        dbItem: savedLineItem,
      }),
      { status: 201, headers: { "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Catalog create error:", error);
    return NextResponse.json(
      { error: "Failed to create catalog item", detail: error.message },
      { status: 500 }
    );
  }
}
