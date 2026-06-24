process.env.DATABASE_URL = "postgresql://postgres:Hello%40bound123%23@localhost:5432/sk_mobile";
import { prisma } from './apps/api/src/lib/prisma.ts';

async function run() {
  const month = await prisma.businessMonth.findFirst({ orderBy: { id: 'desc' } });
  if (!month) return console.log("No month found");
  console.log('Month:', month.id);
  
  const exp = await prisma.shopExpenseDay.aggregate({ where: { businessMonthId: month.id }, _sum: { total: true } });
  console.log('Expenses:', exp._sum.total?.toString() || '0');
  
  const wdl = await prisma.withdrawal.aggregate({ where: { businessMonthId: month.id }, _sum: { total: true } });
  console.log('Withdrawals:', wdl._sum.total?.toString() || '0');
  
  const dmg = await prisma.damageDay.aggregate({ where: { businessMonthId: month.id }, _sum: { amount: true } });
  console.log('Damages:', dmg._sum.amount?.toString() || '0');
  
  const mobile = await prisma.mobileAccessoryDay.aggregate({ where: { businessMonthId: month.id }, _sum: { sale: true, cost: true, profit: true } });
  console.log('Mobile/Accessories:', mobile._sum.sale?.toString() || '0', mobile._sum.cost?.toString() || '0', mobile._sum.profit?.toString() || '0');
}

run().catch(console.error).finally(() => prisma.$disconnect());
