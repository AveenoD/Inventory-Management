import { Router } from "express";
import {
  createMonthSchema,
  updateMonthSchema,
  paginationQuerySchema,
} from "@sk-mobile/shared";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { paginate } from "../lib/pagination.js";
import { assertMonthAccess } from "../services/month-access.js";
import { getDashboard } from "../services/dashboard.service.js";
import { fmt, d } from "../lib/decimal.js";

export const monthsRouter = Router();
monthsRouter.use(requireAuth);

monthsRouter.get("/", async (req, res, next) => {
  try {
    const { page, limit } = paginationQuerySchema.parse(req.query);
    const where = { userId: req.user!.userId };
    const total = await prisma.businessMonth.count({ where });
    const { skip, take, totalPages } = paginate(page, limit, total);
    const months = await prisma.businessMonth.findMany({
      where,
      orderBy: [{ year: "desc" }, { month: "desc" }],
      skip,
      take,
    });
    res.json({
      data: months.map((m) => ({
        id: m.id,
        year: m.year,
        month: m.month,
        openingBalance: fmt(d(m.openingBalance)),
        createdAt: m.createdAt.toISOString(),
        updatedAt: m.updatedAt.toISOString(),
      })),
      meta: { page, limit, total, totalPages },
    });
  } catch (e) {
    next(e);
  }
});

monthsRouter.post("/", async (req, res, next) => {
  try {
    const body = createMonthSchema.parse(req.body);
    const month = await prisma.businessMonth.upsert({
      where: {
        userId_year_month: {
          userId: req.user!.userId,
          year: body.year,
          month: body.month,
        },
      },
      create: {
        userId: req.user!.userId,
        year: body.year,
        month: body.month,
        openingBalance: body.openingBalance,
      },
      update: {},
    });
    res.status(201).json({
      id: month.id,
      year: month.year,
      month: month.month,
      openingBalance: fmt(d(month.openingBalance)),
      createdAt: month.createdAt.toISOString(),
      updatedAt: month.updatedAt.toISOString(),
    });
  } catch (e) {
    next(e);
  }
});

monthsRouter.get("/:id", async (req, res, next) => {
  try {
    const month = await assertMonthAccess(req.params.id, req.user!.userId);
    res.json({
      id: month.id,
      year: month.year,
      month: month.month,
      openingBalance: fmt(d(month.openingBalance)),
      createdAt: month.createdAt.toISOString(),
      updatedAt: month.updatedAt.toISOString(),
    });
  } catch (e) {
    const status = (e as { status?: number }).status ?? 500;
    res.status(status).json({ error: (e as Error).message });
  }
});

monthsRouter.patch("/:id", async (req, res, next) => {
  try {
    await assertMonthAccess(req.params.id, req.user!.userId);
    const body = updateMonthSchema.parse(req.body);
    const month = await prisma.businessMonth.update({
      where: { id: req.params.id },
      data: {
        ...(body.openingBalance !== undefined && {
          openingBalance: body.openingBalance,
        }),
      },
    });
    res.json({
      id: month.id,
      year: month.year,
      month: month.month,
      openingBalance: fmt(d(month.openingBalance)),
      createdAt: month.createdAt.toISOString(),
      updatedAt: month.updatedAt.toISOString(),
    });
  } catch (e) {
    next(e);
  }
});

monthsRouter.get("/:id/dashboard", async (req, res, next) => {
  try {
    await assertMonthAccess(req.params.id, req.user!.userId);
    const dashboard = await getDashboard(req.params.id);
    res.json(dashboard);
  } catch (e) {
    const status = (e as { status?: number }).status ?? 500;
    res.status(status).json({ error: (e as Error).message });
  }
});
