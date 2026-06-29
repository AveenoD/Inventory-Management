require('dotenv').config({ path: __dirname + '/.env' });
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const month = await prisma.businessMonth.findFirst({ orderBy: { createdAt: 'desc' } });
  
  const salesToday = await prisma.sale.count({ 
    where: { businessMonthId: month.id, date: new Date('2026-06-29T00:00:00Z') } 
  });
  
  const salesMonth = await prisma.sale.count({ 
    where: { businessMonthId: month.id } 
  });

  const rechargesMonth = await prisma.rechargeEntry.count({
    where: { businessMonthId: month.id, isActive: true }
  });

  const transfersMonth = await prisma.transferEntry.count({
    where: { businessMonthId: month.id }
  });

  console.log('--- DB RESULTS ---');
  console.log('Today Sales:', salesToday);
  console.log('Month Sales:', salesMonth);
  console.log('Month Recharges:', rechargesMonth);
  console.log('Month Transfers:', transfersMonth);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
