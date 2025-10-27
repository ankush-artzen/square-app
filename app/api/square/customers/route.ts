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
        { status: 400 }
      );
    }

    const account = await prisma.squareAccount.findFirst({
      where: { shopDomain: shop },
    });

    if (!account?.accessToken) {
      return NextResponse.json(
        { error: "Square account not found" },
        { status: 404 }
      );
    }

    const client = new SquareClient({
      environment: SquareEnvironment.Production,
      token: account.accessToken,
    });

    const customerPager = await client.customers.list();
    const allCustomers: any[] = [];

    for await (const customer of customerPager) {
      allCustomers.push(customer);

      // Save only schema fields into DB
      await prisma.squareCustomer.upsert({
        where: { customerId: customer.id! }, 
        update: {
          givenName: customer.givenName ?? null,
          familyName: customer.familyName ?? null,
          emailAddress: customer.emailAddress ?? null,
          phoneNumber: customer.phoneNumber ?? null,
          createdAt: customer.createdAt
            ? new Date(customer.createdAt)
            : new Date(),
          updatedAt: customer.updatedAt
            ? new Date(customer.updatedAt)
            : new Date(),
        },
        create: {
          customerId: customer.id!,
          givenName: customer.givenName ?? null,
          familyName: customer.familyName ?? null,
          emailAddress: customer.emailAddress ?? null,
          phoneNumber: customer.phoneNumber ?? null,
          createdAt: customer.createdAt
            ? new Date(customer.createdAt)
            : new Date(),
          updatedAt: customer.updatedAt
            ? new Date(customer.updatedAt)
            : new Date(),
        },
      });
    }

    return new Response(
      safeStringify({ count: allCustomers.length, customers: allCustomers }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Customer list error:", error);
    return NextResponse.json(
      { error: "Failed to list customers", detail: error.message },
      { status: 500 }
    );
  }
}
