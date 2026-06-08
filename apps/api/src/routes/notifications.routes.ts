import { Router } from "express";
import { paginationQuerySchema, registerPushDeviceSchema } from "@sk-mobile/shared";
import { requireAuth } from "../middleware/auth.js";
import { prisma } from "../lib/prisma.js";
import { paginate } from "../lib/pagination.js";
import { mapNotificationDto } from "../services/notification.service.js";

export const notificationsRouter = Router();
notificationsRouter.use(requireAuth);

notificationsRouter.get("/", async (req, res, next) => {
  try {
    const userId = req.user!.userId;
    const q = paginationQuerySchema.parse(req.query);
    const where = { userId };
    const [total, unreadCount, rows] = await Promise.all([
      prisma.notification.count({ where }),
      prisma.notification.count({ where: { ...where, readAt: null } }),
      prisma.notification.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (q.page - 1) * q.limit,
        take: q.limit,
      }),
    ]);
    const { totalPages } = paginate(q.page, q.limit, total);
    res.json({
      data: rows.map(mapNotificationDto),
      meta: { page: q.page, limit: q.limit, total, totalPages, unreadCount },
    });
  } catch (e) {
    next(e);
  }
});

notificationsRouter.patch("/read-all", async (req, res, next) => {
  try {
    const userId = req.user!.userId;
    await prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });
    res.status(204).send();
  } catch (e) {
    next(e);
  }
});

notificationsRouter.patch("/:id/read", async (req, res, next) => {
  try {
    const userId = req.user!.userId;
    const existing = await prisma.notification.findFirst({
      where: { id: req.params.id, userId },
    });
    if (!existing) {
      res.status(404).json({ error: "Notification not found" });
      return;
    }
    const updated = await prisma.notification.update({
      where: { id: existing.id },
      data: { readAt: new Date() },
    });
    res.json(mapNotificationDto(updated));
  } catch (e) {
    next(e);
  }
});

notificationsRouter.post("/devices", async (req, res, next) => {
  try {
    const userId = req.user!.userId;
    const body = registerPushDeviceSchema.parse(req.body);
    const device = await prisma.pushDevice.upsert({
      where: { userId_token: { userId, token: body.token } },
      create: {
        userId,
        platform: body.platform,
        token: body.token,
      },
      update: {
        platform: body.platform,
        lastSeenAt: new Date(),
      },
    });
    res.status(201).json({
      id: device.id,
      platform: device.platform,
      lastSeenAt: device.lastSeenAt.toISOString(),
    });
  } catch (e) {
    next(e);
  }
});
