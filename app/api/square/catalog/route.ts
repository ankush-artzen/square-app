import { NextRequest, NextResponse } from "next/server";
import { SquareClient, SquareEnvironment } from "square";
import prisma from "@/lib/db/prisma-connect";

function safeStringify(obj: any) {
  return JSON.stringify(obj, (_, value) =>
    typeof value === "bigint" ? value.toString() : value,
  );
}

export async function GET(req: NextRequest) {
  try {
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

    const client = new SquareClient({
      environment: SquareEnvironment.Production,
      token: account.accessToken,
    });

    const catalogObjects: any[] = [];
    for await (const obj of await client.catalog.list()) {
      catalogObjects.push(obj);
    }

    const chunkSize = 10;

    for (let i = 0; i < catalogObjects.length; i += chunkSize) {
      const chunk = catalogObjects.slice(i, i + chunkSize);

      await Promise.all(
        chunk.map(async (obj) => {
          const type = obj.type;

          let name: string | null = null;
          let productType: string | null = null;
          let categoryId: string | null = null;
          let itemId: string | null = null;
          let amount: number | null = null;
          let currency: string | null = null;

          if (type === "ITEM") {
            name = obj.itemData?.name ?? null;
            productType = obj.itemData?.productType ?? null;
            categoryId = obj.itemData?.categories?.[0]?.id ?? null;

            if (obj.itemData?.variations?.length) {
              const firstVar = obj.itemData.variations[0].itemVariationData;
              itemId = firstVar?.itemId ?? null;
              amount = firstVar?.priceMoney
                ? parseInt(firstVar.priceMoney.amount ?? "0")
                : null;
              currency = firstVar?.priceMoney?.currency ?? null;
            }
          } else if (type === "CATEGORY") {
            name = obj.categoryData?.name ?? null;
          }

          await prisma.squareCatalog.upsert({
            where: { squareId: obj.id },
            update: {
              type,
              name,
              data: obj,
              productType,
              categoryId,
              itemId,
              amount,
              currency,
              updatedAt: new Date(),
            },
            create: {
              squareId: obj.id,
              shopDomain: shop,
              type,
              name,
              data: obj,
              productType,
              categoryId,
              itemId,
              amount,
              currency,
            },
          });
        }),
      );
    }

    return new Response(
      safeStringify({ count: catalogObjects.length, items: catalogObjects }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    );
  } catch (error: any) {
    console.error("Catalog list error:", error);
    return NextResponse.json(
      { error: "Failed to list catalog", detail: error.message },
      { status: 500 },
    );
  }
}
