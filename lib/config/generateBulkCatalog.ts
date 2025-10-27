import crypto from "crypto";

// Generates 100 unique catalog items with category & tax
export function generateBulkCatalog() {
  const NUM_ITEMS = 100;
  const objects: any[] = [];

  // Add category
  objects.push({
    type: "CATEGORY",
    id: "#CATEGORY_GENERAL",
    presentAtAllLocations: true,
    categoryData: { name: "General" },
  });

  // Add tax
  objects.push({
    type: "TAX",
    id: "#TAX_STANDARD",
    presentAtAllLocations: true,
    taxData: {
      name: "Standard Tax",
      calculationPhase: "TAX_SUBTOTAL_PHASE",
      inclusionType: "ADDITIVE",
      percentage: "5.0",
      appliesToCustomAmounts: true,
      enabled: true,
    },
  });

  // Generate items
  for (let i = 0; i < NUM_ITEMS; i++) {
    const itemId = `#ITEM_${crypto.randomUUID()}`;
    const variationId = `#VAR_${crypto.randomUUID()}`;
    const price = BigInt(Math.floor(Math.random() * 4900 + 100)); // 1.00–50.00 USD
    const variationNames = ["Small", "Medium", "Large", "Regular", "Deluxe"];
    const variationName =
      variationNames[Math.floor(Math.random() * variationNames.length)];

    objects.push({
      type: "ITEM",
      id: itemId,
      presentAtAllLocations: true,
      itemData: {
        name: `Product ${i + 1}`,
        descriptionHtml: `<p>Description for Product ${i + 1}</p>`,
        categories: [{ id: "#CATEGORY_GENERAL" }],
        taxIds: ["#TAX_STANDARD"],
        variations: [
          {
            type: "ITEM_VARIATION",
            id: variationId,
            presentAtAllLocations: true,
            itemVariationData: {
              itemId,
              name: variationName,
              pricingType: "FIXED_PRICING",
              priceMoney: {
                amount: price,
                currency: "USD",
              },
            },
          },
        ],
      },
    });
  }

  return { idempotencyKey: crypto.randomUUID(), batches: [{ objects }] };
}
