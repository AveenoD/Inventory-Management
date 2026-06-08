import { z } from "zod";

export const notificationTypeSchema = z.enum([
  "LOW_STOCK",
  "REPAIR_PICKUP",
  "REPAIR_RECEIVED",
  "SALE",
]);

export type NotificationType = z.infer<typeof notificationTypeSchema>;

export const pushPlatformSchema = z.enum(["ios", "android", "web"]);

export type PushPlatform = z.infer<typeof pushPlatformSchema>;

export type NotificationDto = {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  data: Record<string, unknown> | null;
  readAt: string | null;
  createdAt: string;
};

export type NotificationsResponse = {
  data: NotificationDto[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    unreadCount: number;
  };
};

export const registerPushDeviceSchema = z.object({
  platform: pushPlatformSchema,
  token: z.string().min(1),
});

export type RegisterPushDeviceInput = z.infer<typeof registerPushDeviceSchema>;
