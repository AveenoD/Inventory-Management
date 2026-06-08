import type { NotificationType } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { logger } from "../lib/logger.js";

export type NotificationData = {
  productId?: string;
  jobId?: string;
  screen?: string;
};

async function sendExpoPush(
  tokens: string[],
  title: string,
  body: string,
  data?: Record<string, unknown>,
) {
  if (tokens.length === 0) return;

  const messages = tokens.map((token) => ({
    to: token,
    title,
    body,
    data,
    sound: "default" as const,
  }));

  try {
    const res = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(messages),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      logger.warn({ status: res.status, text }, "Expo push send failed");
    }
  } catch (err) {
    logger.error({ err }, "Expo push network error");
  }
}

async function createAndPush(
  userId: string,
  type: NotificationType,
  title: string,
  body: string,
  data?: NotificationData,
) {
  const notification = await prisma.notification.create({
    data: {
      userId,
      type,
      title,
      body,
      data: data ?? {},
    },
  });

  const devices = await prisma.pushDevice.findMany({
    where: {
      userId,
      platform: { in: ["ios", "android"] },
    },
  });

  await sendExpoPush(
    devices.map((d) => d.token),
    title,
    body,
    { ...data, notificationId: notification.id },
  );

  return notification;
}

export function fireNotification(fn: () => Promise<void>) {
  fn().catch((err) => logger.error({ err }, "notification trigger failed"));
}

export async function notifyLowStockIfNeeded(
  userId: string,
  productId: string,
  productName: string,
  stockQty: number,
  minStock: number,
) {
  if (stockQty > minStock) return;

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const recent = await prisma.notification.findFirst({
    where: {
      userId,
      type: "LOW_STOCK",
      createdAt: { gte: since },
      data: { path: ["productId"], equals: productId },
    },
  });
  if (recent) return;

  await createAndPush(
    userId,
    "LOW_STOCK",
    "Low stock alert",
    `${productName}: ${stockQty} left (min ${minStock})`,
    { productId, screen: "inventory" },
  );
}

export async function notifyRepairPickup(
  userId: string,
  job: { id: string; customerName: string | null; device: string | null },
) {
  await createAndPush(
    userId,
    "REPAIR_PICKUP",
    "Repair ready for pickup",
    `${job.device ?? "Device"} — ${job.customerName ?? "Customer"}`,
    { jobId: job.id, screen: "repair" },
  );
}

export async function notifyRepairReceived(
  userId: string,
  job: { id: string; customerName: string | null; device: string | null },
) {
  await createAndPush(
    userId,
    "REPAIR_RECEIVED",
    "New repair received",
    `${job.device ?? "Device"} from ${job.customerName ?? "Customer"}`,
    { jobId: job.id, screen: "repair" },
  );
}

export function mapNotificationDto(row: {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  data: unknown;
  readAt: Date | null;
  createdAt: Date;
}) {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    body: row.body,
    data: (row.data as Record<string, unknown> | null) ?? null,
    readAt: row.readAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}
