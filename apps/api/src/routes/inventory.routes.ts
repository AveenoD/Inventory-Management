import { Router } from "express";
import {
  createProductSchema,
  batchCreateCoversSchema,
  createCoverTypeSchema,
  createPhoneModelSchema,
  updateProductSchema,
  stockInSchema,
  createSaleSchema,
  paginationQuerySchema,
  buildProductName,
  PRODUCT_KIND_LABELS,
  getEffectiveSalePrice,
  parseProductScanCode,
  type ProductKind,
} from "@sk-mobile/shared";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { paginate } from "../lib/pagination.js";
import { d, fmt } from "../lib/decimal.js";
import { resolveMonthForDate } from "../services/month-resolver.js";
import { rollupMobileDayFromSales } from "../services/rollup.service.js";
import {
  mapProductDto,
  ensureDefaultCoverTypesForPhoneModel,
  resolvePhoneModel,
  resolveCoverType,
  ensureCategoryForKind,
  productInclude,
  allocateProductSku,
  findProductByScanCode,
} from "../services/inventory-product.service.js";
import {
  fireNotification,
  notifyLowStockIfNeeded,
  notifyRepairPickup,
  notifyRepairReceived,
} from "../services/notification.service.js";
import { allocateInvoiceNo, getSaleInvoice } from "../services/invoice.service.js";

export const inventoryRouter = Router();
inventoryRouter.use(requireAuth);

function parseDate(s: string) {
  return new Date(`${s}T00:00:00.000Z`);
}

function mapSaleDto(s: {
  id: string;
  invoiceNo: string | null;
  date: Date;
  customerName: string | null;
  paymentMethod: string;
  discount: { toString(): string };
  total: { toString(): string };
  totalCost: { toString(): string };
  warrantyNote: string | null;
  lines: Array<{
    id: string;
    productId: string;
    product: { name: string };
    quantity: number;
    unitPrice: { toString(): string };
    lineTotal: { toString(): string };
  }>;
}) {
  const subtotal = s.lines.reduce((sum, l) => sum.plus(d(l.lineTotal)), d(0));
  return {
    id: s.id,
    invoiceNo: s.invoiceNo,
    date: s.date.toISOString().slice(0, 10),
    customerName: s.customerName,
    paymentMethod: s.paymentMethod,
    subtotal: fmt(subtotal),
    discount: fmt(d(s.discount)),
    total: fmt(d(s.total)),
    totalCost: fmt(d(s.totalCost)),
    warrantyNote: s.warrantyNote,
    lines: s.lines.map((l) => ({
      id: l.id,
      productId: l.productId,
      productName: l.product.name,
      quantity: l.quantity,
      unitPrice: fmt(d(l.unitPrice)),
      lineTotal: fmt(d(l.lineTotal)),
    })),
  };
}

inventoryRouter.get("/products", async (req, res, next) => {
  try {
    const q = paginationQuerySchema.parse(req.query);
    const search = String(req.query.search ?? "").trim();
    const categoryId = req.query.categoryId as string | undefined;
    const phoneModelId = req.query.phoneModelId as string | undefined;
    const coverTypeId = req.query.coverTypeId as string | undefined;
    const coverTypeName = String(req.query.coverTypeName ?? "").trim();
    const kind = req.query.kind as ProductKind | undefined;
    const excludeKinds =
      typeof req.query.excludeKinds === "string" && req.query.excludeKinds.trim()
        ? req.query.excludeKinds
            .split(",")
            .map((k) => k.trim())
            .filter(Boolean) as ProductKind[]
        : undefined;
    const kindFilter =
      kind ?? (excludeKinds?.length ? ({ notIn: excludeKinds } as const) : undefined);
    const segment = String(req.query.segment ?? "").trim();

    const where = {
      userId: req.user!.userId,
      isActive: true,
      ...(categoryId && { categoryId }),
      ...(phoneModelId && segment !== "covers" && { phoneModelId }),
      ...(coverTypeId && { coverTypeId }),
      ...(coverTypeName && {
        coverType: { name: { equals: coverTypeName, mode: "insensitive" as const } },
      }),
      ...(kindFilter && segment !== "covers" && segment !== "other_accessories" && { kind: kindFilter }),
      ...(segment === "covers" && {
        kind: "MOBILE_ACCESSORY" as const,
        phoneModelId: phoneModelId ?? { not: null },
      }),
      ...(segment === "other_accessories" && {
        kind: "MOBILE_ACCESSORY" as const,
        phoneModelId: null,
      }),
      ...(search && {
        OR: [
          { name: { contains: search, mode: "insensitive" as const } },
          { phoneModel: { contains: search, mode: "insensitive" as const } },
          { variantName: { contains: search, mode: "insensitive" as const } },
          { sku: { contains: search, mode: "insensitive" as const } },
          { coverType: { name: { contains: search, mode: "insensitive" as const } } },
          { phoneModelRef: { name: { contains: search, mode: "insensitive" as const } } },
        ],
      }),
    };
    const total = await prisma.product.count({ where });
    const { skip, take, totalPages } = paginate(q.page, q.limit, total);
    const products = await prisma.product.findMany({
      where,
      include: productInclude,
      orderBy: { name: "asc" },
      skip,
      take,
    });
    res.json({
      data: products.map(mapProductDto),
      meta: { page: q.page, limit: q.limit, total, totalPages },
    });
  } catch (e) {
    next(e);
  }
});

inventoryRouter.get("/products/low-stock", async (req, res, next) => {
  try {
    const userId = req.user!.userId;
    const low = await prisma.$queryRaw<
      Array<{ id: string; name: string; stockQty: number; minStock: number }>
    >`
      SELECT "id", "name", "stockQty", "minStock"
      FROM "Product"
      WHERE "userId" = ${userId}
        AND "isActive" = true
        AND "stockQty" <= "minStock"
      ORDER BY ("stockQty" - "minStock") ASC, "name" ASC
    `;
    res.json({ data: low });
  } catch (e) {
    next(e);
  }
});

inventoryRouter.get("/products/covers-stats", async (req, res, next) => {
  try {
    const userId = req.user!.userId;
    const coversWhere = {
      userId,
      isActive: true,
      kind: "MOBILE_ACCESSORY" as const,
      phoneModelId: { not: null },
    };
    const [byModel, byType] = await Promise.all([
      prisma.product.groupBy({
        by: ["phoneModelId"],
        where: coversWhere,
        _count: { _all: true },
      }),
      prisma.$queryRaw<Array<{ name: string; count: number }>>`
        SELECT ct."name" AS name, COUNT(*)::int AS count
        FROM "Product" p
        INNER JOIN "CoverType" ct ON p."coverTypeId" = ct."id"
        WHERE p."userId" = ${userId}
          AND p."isActive" = true
          AND p."kind" = 'MOBILE_ACCESSORY'
          AND p."phoneModelId" IS NOT NULL
        GROUP BY ct."name"
      `,
    ]);
    res.json({
      byModel: byModel
        .filter((r) => r.phoneModelId)
        .map((r) => ({ phoneModelId: r.phoneModelId!, count: r._count._all })),
      byType,
    });
  } catch (e) {
    next(e);
  }
});

inventoryRouter.get("/phone-models", async (req, res, next) => {
  try {
    const userId = req.user!.userId;
    const models = await prisma.phoneModel.findMany({
      where: { userId },
      orderBy: { name: "asc" },
    });
    res.json({ data: models.map((m) => ({ id: m.id, name: m.name })) });
  } catch (e) {
    next(e);
  }
});

inventoryRouter.post("/phone-models", async (req, res, next) => {
  try {
    const userId = req.user!.userId;
    const body = createPhoneModelSchema.parse(req.body);
    const model = await prisma.phoneModel.upsert({
      where: { userId_name: { userId, name: body.name.trim() } },
      create: { userId, name: body.name.trim() },
      update: {},
    });
    await ensureDefaultCoverTypesForPhoneModel(userId, model.id);
    res.status(201).json({ id: model.id, name: model.name });
  } catch (e) {
    next(e);
  }
});

inventoryRouter.get("/cover-types", async (req, res, next) => {
  try {
    const userId = req.user!.userId;
    const phoneModelId = String(req.query.phoneModelId ?? "").trim();

    if (!phoneModelId) {
      const types = await prisma.coverType.findMany({
        where: { userId },
        include: { phoneModel: true },
        orderBy: [{ phoneModel: { name: "asc" } }, { name: "asc" }],
      });
      res.json({
        data: types.map((t) => ({
          id: t.id,
          name: t.name,
          phoneModelId: t.phoneModelId,
          phoneModelName: t.phoneModel?.name ?? null,
        })),
      });
      return;
    }

    const model = await prisma.phoneModel.findFirst({
      where: { id: phoneModelId, userId },
    });
    if (!model) {
      res.status(404).json({ error: "Phone model not found" });
      return;
    }
    await ensureDefaultCoverTypesForPhoneModel(userId, phoneModelId);
    const types = await prisma.coverType.findMany({
      where: { userId, phoneModelId },
      orderBy: { name: "asc" },
    });
    res.json({
      data: types.map((t) => ({
        id: t.id,
        name: t.name,
        phoneModelId: t.phoneModelId,
        phoneModelName: model.name,
      })),
    });
  } catch (e) {
    next(e);
  }
});

inventoryRouter.post("/cover-types", async (req, res, next) => {
  try {
    const userId = req.user!.userId;
    const body = createCoverTypeSchema.parse(req.body);
    const model = await prisma.phoneModel.findFirst({
      where: { id: body.phoneModelId, userId },
    });
    if (!model) {
      res.status(404).json({ error: "Phone model not found" });
      return;
    }
    const type = await prisma.coverType.upsert({
      where: {
        userId_phoneModelId_name: {
          userId,
          phoneModelId: body.phoneModelId,
          name: body.name.trim(),
        },
      },
      create: { userId, phoneModelId: body.phoneModelId, name: body.name.trim() },
      update: {},
    });
    res.status(201).json({ id: type.id, name: type.name, phoneModelId: type.phoneModelId });
  } catch (e) {
    next(e);
  }
});

inventoryRouter.post("/products", async (req, res, next) => {
  try {
    const body = createProductSchema.parse(req.body);
    const userId = req.user!.userId;
    const kind = body.kind;

    const cat = await ensureCategoryForKind(userId, kind);
    let categoryId = body.categoryId ?? cat.id;

    let phoneModelId: string | null = null;
    let phoneModelName: string | undefined;
    let coverTypeId: string | null = null;
    let coverTypeName: string | undefined;
    const isDefaultCoverAccessory =
      kind === "MOBILE_ACCESSORY" && !body.categoryId && !body.categoryName;

    if (kind === "MOBILE_ACCESSORY" || kind === "REPAIR_PART") {
      const pm = await resolvePhoneModel(userId, body.phoneModelId, body.phoneModel);
      if (pm) {
        phoneModelId = pm.id;
        phoneModelName = pm.name;
      }
    }

    if (isDefaultCoverAccessory) {
      if (!phoneModelId) {
        res.status(400).json({ error: "Phone model is required" });
        return;
      }
      await ensureDefaultCoverTypesForPhoneModel(userId, phoneModelId);
      const ct = await resolveCoverType(
        userId,
        phoneModelId,
        body.coverTypeId,
        body.coverTypeName,
      );
      if (!ct) {
        res.status(400).json({ error: "Cover category is required" });
        return;
      }
      coverTypeId = ct.id;
      coverTypeName = ct.name;
      if (!body.variantName?.trim()) {
        res.status(400).json({ error: "Design / variant name is required" });
        return;
      }
    }

    const repairCharge =
      kind === "REPAIR_PART" ? (body.repairCharge ?? body.sellPrice ?? 0) : undefined;
    const sellPrice =
      kind === "REPAIR_PART"
        ? (body.sellPrice ?? repairCharge ?? 0)
        : (body.sellPrice ?? 0);

    const buyPriceFixed = fmt(d(body.buyPrice));
    const sellPriceFixed = fmt(d(sellPrice));
    const offerRaw = body.offerPrice;
    const offerPriceFixed =
      offerRaw != null && offerRaw > 0 && offerRaw < parseFloat(sellPriceFixed)
        ? fmt(d(offerRaw))
        : null;
    const repairChargeFixed =
      repairCharge != null ? fmt(d(repairCharge)) : null;

    const name = buildProductName({
      kind,
      name: body.name,
      phoneModel: phoneModelName ?? body.phoneModel,
      coverTypeName,
      variantName: body.variantName,
      partType: body.partType,
    });

    if (!name.trim()) {
      res.status(400).json({ error: "Product name is required" });
      return;
    }

    if (
      (kind === "MOBILE" || kind === "SPEAKERS_SOUND" || kind === "CHARGER_CABLE") &&
      !body.name?.trim()
    ) {
      res.status(400).json({ error: "Product name is required" });
      return;
    }

    if (kind === "REPAIR_PART" && !phoneModelName && !body.phoneModel?.trim()) {
      res.status(400).json({ error: "Phone model is required" });
      return;
    }
    if (
      kind === "MOBILE_ACCESSORY" &&
      !isDefaultCoverAccessory &&
      !body.name?.trim()
    ) {
      res.status(400).json({ error: "Product name is required" });
      return;
    }

    if (kind === "REPAIR_PART" && !body.partType?.trim()) {
      res.status(400).json({ error: "Part type is required" });
      return;
    }

    const product = await prisma.$transaction(async (tx) => {
      const sku = await allocateProductSku(userId, tx);
      const created = await tx.product.create({
        data: {
          userId,
          kind,
          name,
          sku,
          categoryId,
          phoneModel: (phoneModelName ?? body.phoneModel?.trim()) || null,
          phoneModelId,
          variantName: isDefaultCoverAccessory ? body.variantName?.trim() || null : null,
          coverTypeId,
          partType: kind === "REPAIR_PART" ? body.partType?.trim() || null : null,
          repairCharge: repairChargeFixed,
          buyPrice: buyPriceFixed,
          sellPrice: sellPriceFixed,
          offerPrice: offerPriceFixed,
          minStock: body.minStock,
          stockQty: body.openingStock,
        },
      });
      if (body.openingStock > 0) {
        await tx.stockMovement.create({
          data: {
            productId: created.id,
            type: "IN",
            quantity: body.openingStock,
            unitCost: buyPriceFixed,
            note: "Opening stock",
          },
        });
      }
        
      return tx.product.findFirstOrThrow({
        where: { id: created.id },
        include: productInclude,
      });
    });
    res.status(201).json(mapProductDto(product));
  } catch (e) {
    next(e);
  }
});

inventoryRouter.post("/products/batch-covers", async (req, res, next) => {
  try {
    const body = batchCreateCoversSchema.parse(req.body);
    const userId = req.user!.userId;
    const kind = "MOBILE_ACCESSORY";

    const cat = await ensureCategoryForKind(userId, kind);
    const pm = await resolvePhoneModel(userId, body.phoneModelId, undefined);
    if (!pm) {
      res.status(400).json({ error: "Phone model not found" });
      return;
    }

    const createdIds: string[] = [];

    await prisma.$transaction(async (tx) => {
      for (const cover of body.covers) {
        const ct = await tx.coverType.findFirst({
          where: { id: cover.coverTypeId, userId, phoneModelId: pm.id }
        });
        if (!ct) continue;

        const name = buildProductName({
          kind,
          phoneModel: pm.name,
          coverTypeName: ct.name,
        });

        const buyPriceFixed = fmt(d(cover.buyPrice));
        const sellPriceFixed = fmt(d(cover.sellPrice));
        const offerPriceFixed = cover.offerPrice !== undefined ? fmt(d(cover.offerPrice)) : null;

        const sku = await allocateProductSku(userId, tx);
        const created = await tx.product.create({
          data: {
            userId,
            kind,
            name,
            sku,
            categoryId: cat.id,
            phoneModel: pm.name,
            phoneModelId: pm.id,
            coverTypeId: ct.id,
            buyPrice: buyPriceFixed,
            sellPrice: sellPriceFixed,
            offerPrice: offerPriceFixed,
            minStock: 2,
            stockQty: cover.openingStock,
          },
        });
        
        createdIds.push(created.id);

        if (cover.openingStock > 0) {
          await tx.stockMovement.create({
            data: {
              productId: created.id,
              type: "IN",
              quantity: cover.openingStock,
              unitCost: buyPriceFixed,
              note: "Opening stock",
            },
          });
        }
      }
    }, { maxWait: 15000, timeout: 20000 });

    res.status(201).json({ success: true, count: createdIds.length, ids: createdIds });
  } catch (e) {
    next(e);
  }
});

inventoryRouter.get("/products/scan/:code", async (req, res, next) => {
  try {
    const parsed = parseProductScanCode(req.params.code ?? "");
    if (!parsed) {
      res.status(400).json({ error: "Invalid scan code" });
      return;
    }
    const product = await findProductByScanCode(req.user!.userId, parsed);
    if (!product) {
      res.status(404).json({ error: "Product not found for this code" });
      return;
    }
    const dto = mapProductDto(product);
    res.json({ product: dto, effectivePrice: dto.effectivePrice });
  } catch (e) {
    next(e);
  }
});

inventoryRouter.get("/products/:id", async (req, res, next) => {
  try {
    const product = await prisma.product.findFirst({
      where: { id: req.params.id, userId: req.user!.userId, isActive: true },
      include: productInclude,
    });
    if (!product) {
      res.status(404).json({ error: "Product not found" });
      return;
    }
    res.json(mapProductDto(product));
  } catch (e) {
    next(e);
  }
});

inventoryRouter.delete("/products/:id", async (req, res, next) => {
  try {
    const existing = await prisma.product.findFirst({
      where: { id: req.params.id, userId: req.user!.userId, isActive: true },
    });
    if (!existing) {
      res.status(404).json({ error: "Product not found" });
      return;
    }

    await prisma.product.update({
      where: { id: existing.id },
      data: { isActive: false },
    });

    res.status(204).end();
  } catch (e) {
    next(e);
  }
});

inventoryRouter.patch("/products/:id", async (req, res, next) => {
  try {
    const body = updateProductSchema.parse(req.body);
    const existing = await prisma.product.findFirst({
      where: { id: req.params.id, userId: req.user!.userId, isActive: true },
    });
    if (!existing) {
      res.status(404).json({ error: "Product not found" });
      return;
    }
    const nextSell = body.sellPrice !== undefined ? body.sellPrice : parseFloat(fmt(d(existing.sellPrice)));
    if (body.offerPrice != null && body.offerPrice > nextSell) {
      res.status(400).json({ error: "Offer price cannot exceed MRP (sell price)" });
      return;
    }
    const offerPriceUpdate =
      body.offerPrice === undefined
        ? undefined
        : body.offerPrice == null || body.offerPrice <= 0
          ? null
          : fmt(d(body.offerPrice));
    const product = await prisma.product.update({
      where: { id: req.params.id },
      data: {
        ...(body.name !== undefined && { name: body.name }),
        ...(body.buyPrice !== undefined && { buyPrice: fmt(d(body.buyPrice)) }),
        ...(body.sellPrice !== undefined && { sellPrice: fmt(d(body.sellPrice)) }),
        ...(offerPriceUpdate !== undefined && { offerPrice: offerPriceUpdate }),
        ...(body.repairCharge !== undefined && { repairCharge: fmt(d(body.repairCharge)) }),
        ...(body.minStock !== undefined && { minStock: body.minStock }),
      },
      include: productInclude,
    });
    res.json(mapProductDto(product));
  } catch (e) {
    next(e);
  }
});

inventoryRouter.post("/stock/in", async (req, res, next) => {
  try {
    const body = stockInSchema.parse(req.body);
    const product = await prisma.product.findFirst({
      where: { id: body.productId, userId: req.user!.userId, isActive: true },
    });
    if (!product) {
      res.status(404).json({ error: "Product not found" });
      return;
    }
    const cost = body.unitCost != null ? fmt(d(body.unitCost)) : fmt(d(product.buyPrice));
    await prisma.$transaction([
      prisma.stockMovement.create({
        data: {
          productId: product.id,
          type: "IN",
          quantity: body.quantity,
          unitCost: cost,
          note: body.note,
        },
      }),
      prisma.product.update({
        where: { id: product.id },
        data: { stockQty: { increment: body.quantity } },
      }),
    ]);
    const updated = await prisma.product.findUniqueOrThrow({
      where: { id: product.id },
    });
    fireNotification(() =>
      notifyLowStockIfNeeded(
        req.user!.userId,
        updated.id,
        updated.name,
        updated.stockQty,
        updated.minStock,
      ),
    );
    res.json({ stockQty: updated.stockQty });
  } catch (e) {
    next(e);
  }
});

inventoryRouter.get("/sales", async (req, res, next) => {
  try {
    const q = paginationQuerySchema.parse(req.query);
    const date = req.query.date as string | undefined;
    const where = {
      userId: req.user!.userId,
      ...(date && { date: parseDate(date) }),
    };
    const total = await prisma.sale.count({ where });
    const { skip, take, totalPages } = paginate(q.page, q.limit, total);
    const sales = await prisma.sale.findMany({
      where,
      include: { lines: { include: { product: true } } },
      orderBy: { createdAt: "desc" },
      skip,
      take,
    });
    res.json({
      data: sales.map(mapSaleDto),
      meta: { page: q.page, limit: q.limit, total, totalPages },
    });
  } catch (e) {
    next(e);
  }
});

inventoryRouter.get("/sales/:saleId/invoice", async (req, res, next) => {
  try {
    const invoice = await getSaleInvoice(req.user!.userId, req.params.saleId);
    if (!invoice) {
      res.status(404).json({ error: "Sale not found" });
      return;
    }
    res.json(invoice);
  } catch (e) {
    next(e);
  }
});

inventoryRouter.get("/sales/:saleId", async (req, res, next) => {
  try {
    const sale = await prisma.sale.findFirst({
      where: { id: req.params.saleId, userId: req.user!.userId },
      include: { lines: { include: { product: true } } },
    });
    if (!sale) {
      res.status(404).json({ error: "Sale not found" });
      return;
    }
    res.json(mapSaleDto(sale));
  } catch (e) {
    next(e);
  }
});

inventoryRouter.post("/sales", async (req, res, next) => {
  try {
    const body = createSaleSchema.parse(req.body);
    const date = parseDate(body.date);
    const month = await resolveMonthForDate(req.user!.userId, date);

    const result = await prisma.$transaction(async (tx) => {
      let subtotal = d(0);
      let totalCost = d(0);
      const lineData: Array<{
        productId: string;
        quantity: number;
        unitPrice: string;
        unitCost: string;
        lineTotal: string;
      }> = [];

      for (const line of body.lines) {
        const product = await tx.product.findFirst({
          where: { id: line.productId, userId: req.user!.userId, isActive: true },
        });
        if (!product) throw new Error(`Product not found: ${line.productId}`);
        if (product.stockQty < line.quantity) {
          throw new Error(`Insufficient stock for ${product.name}`);
        }
        const unitPrice = d(
          line.unitPrice ??
            getEffectiveSalePrice({
              sellPrice: fmt(d(product.sellPrice)),
              offerPrice:
                product.offerPrice != null ? fmt(d(product.offerPrice)) : null,
            }),
        );
        const unitCost = d(product.buyPrice);
        const lineTotal = unitPrice.times(line.quantity);
        subtotal = subtotal.plus(lineTotal);
        totalCost = totalCost.plus(unitCost.times(line.quantity));
        lineData.push({
          productId: product.id,
          quantity: line.quantity,
          unitPrice: fmt(unitPrice),
          unitCost: fmt(unitCost),
          lineTotal: fmt(lineTotal),
        });
      }

      const discount = d(body.discount ?? 0);
      if (discount.gt(subtotal)) {
        throw new Error("Discount cannot exceed subtotal");
      }
      const total = subtotal.minus(discount);
      const invoiceNo = await allocateInvoiceNo(tx, req.user!.userId);

      const sale = await tx.sale.create({
        data: {
          userId: req.user!.userId,
          businessMonthId: month.id,
          date,
          invoiceNo,
          customerName: body.customerName,
          paymentMethod: body.paymentMethod,
          discount: fmt(discount),
          total: fmt(total),
          totalCost: fmt(totalCost),
          warrantyNote: body.warrantyNote?.trim() || null,
        },
      });

      for (const ld of lineData) {
        await tx.saleLine.create({
          data: { saleId: sale.id, ...ld },
        });
        await tx.stockMovement.create({
          data: {
            productId: ld.productId,
            type: "OUT",
            quantity: ld.quantity,
            saleId: sale.id,
            note: "Sale",
          },
        });
        await tx.product.update({
          where: { id: ld.productId },
          data: { stockQty: { decrement: ld.quantity } },
        });
      }

      return { sale, lineData };
    });

    for (const ld of result.lineData) {
      const product = await prisma.product.findUniqueOrThrow({
        where: { id: ld.productId },
      });
      fireNotification(() =>
        notifyLowStockIfNeeded(
          req.user!.userId,
          product.id,
          product.name,
          product.stockQty,
          product.minStock,
        ),
      );
    }

    await rollupMobileDayFromSales(month.id, date);

    const sale = await prisma.sale.findUniqueOrThrow({
      where: { id: result.sale.id },
      include: { lines: { include: { product: true } } },
    });

    res.status(201).json(mapSaleDto(sale));
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Sale failed";
    res.status(400).json({ error: msg });
  }
});

inventoryRouter.delete("/sales/:saleId", async (req, res, next) => {
  try {
    const sale = await prisma.sale.findFirst({
      where: { id: req.params.saleId, userId: req.user!.userId },
      include: { lines: true },
    });
    if (!sale) {
      res.status(404).json({ error: "Sale not found" });
      return;
    }
    await prisma.$transaction(async (tx) => {
      for (const line of sale.lines) {
        await tx.product.update({
          where: { id: line.productId },
          data: { stockQty: { increment: line.quantity } },
        });
      }
      await tx.stockMovement.deleteMany({ where: { saleId: sale.id } });
      await tx.sale.delete({ where: { id: sale.id } });
    });
    if (sale.businessMonthId) {
      await rollupMobileDayFromSales(sale.businessMonthId, sale.date);
    }
    res.status(204).end();
  } catch (e) {
    next(e);
  }
});

inventoryRouter.get("/categories", async (req, res, next) => {
  try {
    const cats = await prisma.category.findMany({
      where: { userId: req.user!.userId },
      orderBy: { name: "asc" },
    });
    res.json({ data: cats.map((c) => ({ id: c.id, name: c.name })) });
  } catch (e) {
    next(e);
  }
});

inventoryRouter.post("/categories", async (req, res, next) => {
  try {
    const name = String(req.body?.name ?? "").trim();
    if (!name) {
      res.status(400).json({ error: "Category name is required" });
      return;
    }
    const reserved = new Set(Object.values(PRODUCT_KIND_LABELS));
    if (reserved.has(name)) {
      res.status(400).json({ error: "This category name is reserved" });
      return;
    }
    const cat = await prisma.category.upsert({
      where: { userId_name: { userId: req.user!.userId, name } },
      create: { userId: req.user!.userId, name },
      update: {},
    });
    res.status(201).json({ id: cat.id, name: cat.name });
  } catch (e) {
    next(e);
  }
});

inventoryRouter.patch("/categories/:id", async (req, res, next) => {
  try {
    const name = String(req.body?.name ?? "").trim();
    if (!name) {
      res.status(400).json({ error: "Category name is required" });
      return;
    }
    const reserved = new Set(Object.values(PRODUCT_KIND_LABELS));
    if (reserved.has(name)) {
      res.status(400).json({ error: "This category name is reserved" });
      return;
    }
    // Ensure ownership before updating
    const existing = await prisma.category.findUnique({ where: { id: req.params.id } });
    if (!existing || existing.userId !== req.user!.userId) {
      res.status(404).json({ error: "Category not found" });
      return;
    }
    const cat = await prisma.category.update({
      where: { id: req.params.id },
      data: { name },
    });
    res.json({ id: cat.id, name: cat.name });
  } catch (e: any) {
    if (e.code === "P2002") {
      res.status(409).json({ error: "A category with this name already exists" });
    } else {
      next(e);
    }
  }
});

inventoryRouter.delete("/categories/:id", async (req, res, next) => {
  try {
    const existing = await prisma.category.findUnique({ where: { id: req.params.id } });
    if (!existing || existing.userId !== req.user!.userId) {
      res.status(404).json({ error: "Category not found" });
      return;
    }
    await prisma.category.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (e) {
    next(e);
  }
});

