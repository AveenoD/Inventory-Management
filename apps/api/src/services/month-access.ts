import { prisma } from "../lib/prisma.js";

export async function getMonthForUser(monthId: string, userId: string) {
  return prisma.businessMonth.findFirst({
    where: { id: monthId, userId },
  });
}

export async function assertMonthAccess(monthId: string, userId: string) {
  const month = await getMonthForUser(monthId, userId);
  if (!month) {
    const err = new Error("Month not found");
    (err as Error & { status: number }).status = 404;
    throw err;
  }
  return month;
}
