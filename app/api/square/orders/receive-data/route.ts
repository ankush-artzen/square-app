import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

// POST: Save forwarded orders
export async function POST(req: NextRequest) {
  try {
    const { shop, orders } = await req.json();
    if (!shop || !Array.isArray(orders) || orders.length === 0) {
      return NextResponse.json({ error: "Missing shop or orders in request" }, { status: 400 });
    }

    const shopDir = path.join(process.cwd(), "data", "orders", shop);
    await fs.mkdir(shopDir, { recursive: true });

    const filePath = path.join(shopDir, `orders-${Date.now()}.json`);
    await fs.writeFile(filePath, JSON.stringify({ orders }, null, 2), "utf-8");

    return NextResponse.json({ message: `Orders saved successfully: ${orders.length} orders`, file: filePath });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// GET: Retrieve all forwarded orders
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const shop = searchParams.get("shop");
    if (!shop) return NextResponse.json({ error: "Missing shop parameter" }, { status: 400 });

    const shopDir = path.join(process.cwd(), "data", "orders", shop);
    let allOrders: any[] = [];

    try {
      const files = await fs.readdir(shopDir);
      for (const file of files) {
        const content = await fs.readFile(path.join(shopDir, file), "utf-8");
        const parsed = JSON.parse(content);
        if (Array.isArray(parsed.orders)) allOrders.push(...parsed.orders);
      }
    } catch {}

    return NextResponse.json({ message: "All forwarded orders", totalOrders: allOrders.length, orders: allOrders });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
