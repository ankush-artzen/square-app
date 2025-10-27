import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db/prisma-connect";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const shop = searchParams.get("shop");
    if (!shop) return NextResponse.json({ error: "Missing shop" }, { status: 400 });

    const counts = {
      total: await prisma.order.count({ where: { shopDomain: shop } }),
      open: await prisma.order.count({ where: { shopDomain: shop, state: "OPEN" } }),
      completed: await prisma.order.count({ where: { shopDomain: shop, state: "COMPLETED" } }),
    };

    return NextResponse.json({ shop, counts });
  } catch (error: any) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
