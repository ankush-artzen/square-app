import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

// POST: Save forwarded catalog items
export async function POST(req: NextRequest) {
  try {
    const { shop, items } = await req.json();
    if (!shop || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: "Missing shop or items in request" },
        { status: 400 }
      );
    }

    const shopDir = path.join(process.cwd(), "data", "catalogs", shop);
    await fs.mkdir(shopDir, { recursive: true });

    const filePath = path.join(shopDir, `catalog-${Date.now()}.json`);
    await fs.writeFile(filePath, JSON.stringify({ items }, null, 2), "utf-8");

    return NextResponse.json({
      message: `Catalog saved successfully: ${items.length} items`,
      file: filePath,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// GET: Retrieve all forwarded catalog items
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const shop = searchParams.get("shop");
    if (!shop)
      return NextResponse.json(
        { error: "Missing shop parameter" },
        { status: 400 }
      );

    const shopDir = path.join(process.cwd(), "data", "catalogs", shop);
    let allItems: any[] = [];

    try {
      const files = await fs.readdir(shopDir);
      for (const file of files) {
        const content = await fs.readFile(path.join(shopDir, file), "utf-8");
        const parsed = JSON.parse(content);
        if (Array.isArray(parsed.items)) allItems.push(...parsed.items);
      }
    } catch {}

    return NextResponse.json({
      message: "All forwarded catalog items",
      totalItems: allItems.length,
      items: allItems,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
