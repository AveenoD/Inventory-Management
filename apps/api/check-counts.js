const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const sales = await prisma.sale.count();
  const salesWithMonth = await prisma.sale.count({ where: { businessMonthId: { not: null } } });
  
  const recharges = await prisma.rechargeEntry.count();
  const transfers = await prisma.transferEntry.count();
  const repairs = await prisma.repairJob.count();
  
  console.log('Total sales:', sales, 'With month:', salesWithMonth);
  console.log('Total recharges:', recharges);
  console.log('Total transfers:', transfers);
  console.log('Total repairs:', repairs);
  
  const month = await prisma.businessMonth.findFirst({
    orderBy: { createdAt: 'desc' }
  });
  console.log('Latest month:', month.id, month.year, month.month);
  
  const salesThisMonth = await prisma.sale.count({ where: { businessMonthId: month.id } });
  console.log('Sales linked to this month:', salesThisMonth);
}
main().finally(() => prisma.$disconnect());
