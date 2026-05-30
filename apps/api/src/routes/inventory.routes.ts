import { Router } from "express";
import {
  createProductSchema,
  createCoverTypeSchema,
  updateProductSchema,
  stockInSchema,
  createSaleSchema,
  paginationQuerySchema,
  buildProductName,
  PRODUCT_KIND_LABELS,
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
  ensureDefaultCoverTypes,
  resolveCoverType,
  ensureCategoryForKind,
} from "../services/inventory-product.service.js";

export const inventoryRouter = Router();
inventoryRouter.use(requireAuth);

function parseDate(s: string) {
  return new Date(`${s}T00:00:00.000Z`);
}

inventoryRouter.get("/products", async (req, res, next) => {
  try {
    const q = paginationQuerySchema.parse(req.query);
    const search = String(req.query.search ?? "").trim();
    const categoryId = req.query.categoryId as string | undefined;
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

    const where = {
      userId: req.user!.userId,
      isActive: true,
      ...(categoryId && { categoryId }),
      ...(kindFilter && { kind: kindFilter }),
      ...(search && {
        OR: [
          { name: { contains: search, mode: "insensitive" as const } },
          { sku: { contains: search, mode: "insensitive" as const } },
        ],
      }),
    };
    const total = await prisma.product.count({ where });
    const { skip, take, totalPages } = paginate(q.page, q.limit, total);
    const products = await prisma.product.findMany({
      where,
      include: { category: true, coverType: true },
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
    const products = await prisma.product.findMany({
      where: {
        userId: req.user!.userId,
        isActive: true,
      },
    });
    const low = products.filter((p) => p.stockQty <= p.minStock);
    res.json({
      data: low.map((p) => ({
        id: p.id,
        name: p.name,
        stockQty: p.stockQty,
        minStock: p.minStock,
      })),
    });
  } catch (e) {
    next(e);
  }
});

inventoryRouter.get("/cover-types", async (req, res, next) => {
  try {
    const userId = req.user!.userId;
    await ensureDefaultCoverTypes(userId);
    const types = await prisma.coverType.findMany({
      where: { userId },
      orderBy: { name: "asc" },
    });
    res.json({ data: types.map((t) => ({ id: t.id, name: t.name })) });
  } catch (e) {
    next(e);
  }
});

inventoryRouter.post("/cover-types", async (req, res, next) => {
  try {
    const userId = req.user!.userId;
    const body = createCoverTypeSchema.parse(req.body);
    const type = await prisma.coverType.upsert({
      where: { userId_name: { userId, name: body.name.trim() } },
      create: { userId, name: body.name.trim() },
      update: {},
    });
    res.status(201).json({ id: type.id, name: type.name });
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

    let coverTypeId: string | undefined;
    let coverTypeName: string | undefined;
    if (kind === "MOBILE_ACCESSORY") {
      const ct = await resolveCoverType(userId, body.coverTypeId, body.coverTypeName);
      if (ct) {
        coverTypeId = ct.id;
        coverTypeName = ct.name;
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
    const repairChargeFixed =
      repairCharge != null ? fmt(d(repairCharge)) : null;

    const name = buildProductName({
      kind,
      name: body.name,
      phoneModel: body.phoneModel,
      coverTypeName,
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

    if (kind === "REPAIR_PART" && !body.phoneModel?.trim()) {
      res.status(400).json({ error: "Phone model is required" });
      return;
    }
    if (kind === "MOBILE_ACCESSORY" && !body.phoneModel?.trim() && !body.name?.trim()) {
      res.status(400).json({ error: "Product name is required" });
      return;
    }

    if (kind === "REPAIR_PART" && !body.partType?.trim()) {
      res.status(400).json({ error: "Part type is required" });
      return;
    }

    const product = await prisma.product.create({
      data: {
        userId,
        kind,
        name,
        sku: body.sku,
        categoryId,
        phoneModel: body.phoneModel?.trim() || null,
        coverTypeId: coverTypeId ?? null,
        partType: kind === "REPAIR_PART" ? body.partType?.trim() || null : null,
        repairCharge: repairChargeFixed,
        buyPrice: buyPriceFixed,
        sellPrice: sellPriceFixed,
        minStock: body.minStock,
        stockQty: body.openingStock,
      },
      include: { category: true, coverType: true },
    });
    if (body.openingStock > 0) {
      await prisma.stockMovement.create({
        data: {
          productId: product.id,
          type: "IN",
          quantity: body.openingStock,
          unitCost: buyPriceFixed,
          note: "Opening stock",
        },
      });
    }
    res.status(201).json(mapProductDto(product));
  } catch (e) {
    next(e);
  }
});

inventoryRouter.patch("/products/:id", async (req, res, next) => {
  try {
    const body = updateProductSchema.parse(req.body);
    const existing = await prisma.product.findFirst({
      where: { id: req.params.id, userId: req.user!.userId },
    });
    if (!existing) {
      res.status(404).json({ error: "Product not found" });
      return;
    }
    const product = await prisma.product.update({
      where: { id: req.params.id },
      data: {
        ...(body.name !== undefined && { name: body.name }),
        ...(body.sku !== undefined && { sku: body.sku }),
        ...(body.buyPrice !== undefined && { buyPrice: fmt(d(body.buyPrice)) }),
        ...(body.sellPrice !== undefined && { sellPrice: fmt(d(body.sellPrice)) }),
        ...(body.minStock !== undefined && { minStock: body.minStock }),
      },
      include: { category: true, coverType: true },
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
      where: { id: body.productId, userId: req.user!.userId },
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
      data: sales.map((s) => ({
        id: s.id,
        date: s.date.toISOString().slice(0, 10),
        customerName: s.customerName,
        paymentMethod: s.paymentMethod,
        total: fmt(d(s.total)),
        totalCost: fmt(d(s.totalCost)),
        lines: s.lines.map((l) => ({
          id: l.id,
          productId: l.productId,
          productName: l.product.name,
          quantity: l.quantity,
          unitPrice: fmt(d(l.unitPrice)),
          lineTotal: fmt(d(l.lineTotal)),
        })),
      })),
      meta: { page: q.page, limit: q.limit, total, totalPages },
    });
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
      let total = d(0);
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
          where: { id: line.productId, userId: req.user!.userId },
        });
        if (!product) throw new Error(`Product not found: ${line.productId}`);
        if (product.stockQty < line.quantity) {
          throw new Error(`Insufficient stock for ${product.name}`);
        }
        const unitPrice = d(line.unitPrice ?? product.sellPrice);
        const unitCost = d(product.buyPrice);
        const lineTotal = unitPrice.times(line.quantity);
        total = total.plus(lineTotal);
        totalCost = totalCost.plus(unitCost.times(line.quantity));
        lineData.push({
          productId: product.id,
          quantity: line.quantity,
          unitPrice: fmt(unitPrice),
          unitCost: fmt(unitCost),
          lineTotal: fmt(lineTotal),
        });
      }

      const sale = await tx.sale.create({
        data: {
          userId: req.user!.userId,
          businessMonthId: month.id,
          date,
          customerName: body.customerName,
          paymentMethod: body.paymentMethod,
          total: fmt(total),
          totalCost: fmt(totalCost),
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

      return sale;
    });

    await rollupMobileDayFromSales(month.id, date);

    const sale = await prisma.sale.findUniqueOrThrow({
      where: { id: result.id },
      include: { lines: { include: { product: true } } },
    });

    res.status(201).json({
      id: sale.id,
      date: sale.date.toISOString().slice(0, 10),
      customerName: sale.customerName,
      paymentMethod: sale.paymentMethod,
      total: fmt(d(sale.total)),
      totalCost: fmt(d(sale.totalCost)),
      lines: sale.lines.map((l) => ({
        id: l.id,
        productId: l.productId,
        productName: l.product.name,
        quantity: l.quantity,
        unitPrice: fmt(d(l.unitPrice)),
        lineTotal: fmt(d(l.lineTotal)),
      })),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Sale failed";
    res.status(400).json({ error: msg });
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
