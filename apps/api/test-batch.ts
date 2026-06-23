import "dotenv/config";
import { prisma } from "./src/lib/prisma.js";
import { allocateProductSku } from "./src/services/inventory-product.service.js";

async function run() {
  const userId = "test-user-id"; // We can fetch an actual user ID
  const user = await prisma.user.findFirst();
  if (!user) throw new Error("No user found");
  
  const pm = await prisma.phoneModel.findFirst({ where: { userId: user.id } });
  if (!pm) throw new Error("No phone model found");

  const ct1 = await prisma.coverType.findFirst({ where: { userId: user.id, phoneModelId: pm.id } });
  if (!ct1) throw new Error("No cover type found");

  const body = {
    phoneModelId: pm.id,
    covers: [
      {
        coverTypeId: ct1.id,
        buyPrice: 50,
        sellPrice: 100,
        offerPrice: 90,
        openingStock: 5,
      }
    ]
  };

  try {
    const createdIds: string[] = [];
    await prisma.$transaction(async (tx) => {
      for (const cover of body.covers) {
        const ct = await tx.coverType.findFirst({
          where: { id: cover.coverTypeId, userId: user.id, phoneModelId: pm.id }
        });
        if (!ct) continue;

        const name = "Test Cover " + Math.random();

        const sku = await allocateProductSku(user.id, tx);
        const created = await tx.product.create({
          data: {
            userId: user.id,
            kind: "MOBILE_ACCESSORY",
            name,
            sku,
            phoneModel: pm.name,
            phoneModelId: pm.id,
            coverTypeId: ct.id,
            buyPrice: "50.00",
            sellPrice: "100.00",
            offerPrice: "90.00",
            minStock: 2,
            stockQty: cover.openingStock,
          },
        });
        createdIds.push(created.id);
      }
    });
    console.log("Success! Created:", createdIds);
  } catch (e) {
    console.error("TRANSACTION FAILED:", e);
  } finally {
    await prisma.$disconnect();
  }
}

run();
