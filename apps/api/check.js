require('dotenv').config({ path: '../../.env' });
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const month = await prisma.businessMonth.findFirst({ orderBy: { createdAt: 'desc' } });
  console.log('Month ID:', month.id);
  
  const salesToday = await prisma.sale.count({ 
    where: { businessMonthId: month.id, date: new Date('2026-06-29T00:00:00Z') } 
  });
  
  const salesMonth = await prisma.sale.count({ 
    where: { businessMonthId: month.id } 
  });
  
  console.log('Today sales:', salesToday);
  console.log('Month sales:', salesMonth);
  process.exit(0);
}
main();
