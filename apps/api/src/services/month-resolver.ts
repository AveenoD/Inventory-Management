import { prisma } from "../lib/prisma.js";

export async function resolveMonthForDate(userId: string, date: Date) {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth() + 1;
  return prisma.businessMonth.upsert({
    where: { userId_year_month: { userId, year, month } },
    create: { userId, year, month, openingBalance: 0 },
    update: {},
  });
}

export async function getCurrentMonth(userId: string) {
  const now = new Date();
  return resolveMonthForDate(userId, now);
}
