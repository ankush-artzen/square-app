import { NextRequest, NextResponse } from "next/server";
import { SquareClient, SquareEnvironment } from "square";
import prisma from "@/lib/db/prisma-connect";
import { generateBulkCatalog } from "@/lib/config/generateBulkCatalog"; 

// Helper to safely serialize BigInt
function safeStringify(obj: any) {
  return JSON.stringify(obj, (_, value) =>
    typeof value === "bigint" ? value.toString() : value
  );
}

export async function POST(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const shop = searchParams.get("shop");

    if (!shop) {
      return NextResponse.json(
        { error: "Shop parameter is required" },
        { status: 400 }
      );
    }

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

    const bulkCatalog = generateBulkCatalog();

    // Upsert all items in Square
    const response: any = await client.catalog.batchUpsert(bulkCatalog);

    return new Response(
      safeStringify({
        message: "Bulk catalog created successfully",
        squareResponse: response,
      }),
      { status: 201, headers: { "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Bulk catalog error:", error);
    return NextResponse.json(
      { error: "Failed to create bulk catalog", detail: error.message },
      { status: 500 }
    );
  }
}
