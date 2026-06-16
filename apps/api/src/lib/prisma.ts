import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

function databaseUrl(): string {
  const url = process.env.DATABASE_URL ?? "";
  if (url && !url.includes("connection_limit") && url.includes("supabase.com")) {
    return `${url}${url.includes("?") ? "&" : "?"}connection_limit=3`;
  }
  return url;
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasources: { db: { url: databaseUrl() } },
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
