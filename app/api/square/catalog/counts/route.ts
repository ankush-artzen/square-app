import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db/prisma-connect";

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

    // Total catalog objects
    const total = await prisma.squareCatalog.count({ where: { shopDomain: shop } });

    // Count by type
    const itemCount = await prisma.squareCatalog.count({
      where: { shopDomain: shop, type: "ITEM" },
    });
    const categoryCount = await prisma.squareCatalog.count({
      where: { shopDomain: shop, type: "CATEGORY" },
    });

    return NextResponse.json({
      shop,
      counts: {
        total,
        items: itemCount,
        categories: categoryCount,
      },
    });
  } catch (error: any) {
    console.error("Catalog counts error:", error);
    return NextResponse.json(
      { error: "Failed to get catalog counts", detail: error.message },
      { status: 500 },
    );
  }
}
