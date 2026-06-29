import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const month = await prisma.businessMonth.findFirst({ orderBy: { createdAt: 'desc' } });
  console.log('--- DB RESULTS ---');
  console.log('Month ID:', month.id);
  const salesToday = await prisma.sale.count({ 
    where: { businessMonthId: month.id, date: new Date('2026-06-29T00:00:00Z') } 
  });
  const salesMonth = await prisma.sale.count({ 
    where: { businessMonthId: month.id } 
  });
  console.log('Today Sales:', salesToday);
  console.log('Month Sales:', salesMonth);
}
main().finally(() => prisma.$disconnect());
