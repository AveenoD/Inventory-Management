import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const KEEP_EMAIL = "skmobile@gmail.com";
const KEEP_PASSWORD = "SK@7869123";

async function wipeAllBusinessData() {
  await prisma.saleLine.deleteMany();
  await prisma.stockMovement.deleteMany();
  await prisma.sale.deleteMany();
  await prisma.rechargeEntry.deleteMany();
  await prisma.transferEntry.deleteMany();
  await prisma.repairJob.deleteMany();
  await prisma.partyTransaction.deleteMany();
  await prisma.party.deleteMany();
  await prisma.product.deleteMany();
  await prisma.businessMonth.deleteMany();
  await prisma.category.deleteMany();
  await prisma.coverType.deleteMany();
  await prisma.moneyTransferDay.deleteMany();
  await prisma.rechargeDay.deleteMany();
  await prisma.repairDay.deleteMany();
  await prisma.mobileAccessoryDay.deleteMany();
  await prisma.extraIncomeEntry.deleteMany();
  await prisma.shopExpenseDay.deleteMany();
  await prisma.damageDay.deleteMany();
  await prisma.partyLedgerEntry.deleteMany();
  await prisma.udhharDay.deleteMany();
  await prisma.bankBalanceDay.deleteMany();
  await prisma.withdrawal.deleteMany();
}

async function ensureOwnerUser() {
  const hash = await bcrypt.hash(KEEP_PASSWORD, 12);
  const user = await prisma.user.upsert({
    where: { email: KEEP_EMAIL },
    create: { email: KEEP_EMAIL, passwordHash: hash },
    update: { passwordHash: hash },
  });
  return user;
}

async function main() {
  console.log("Wiping all business data…");
  await wipeAllBusinessData();

  const removedUsers = await prisma.user.deleteMany({
    where: { email: { not: KEEP_EMAIL } },
  });
  console.log(`Removed ${removedUsers.count} extra user(s).`);

  const user = await ensureOwnerUser();
  console.log(`Fresh database ready. Login: ${user.email}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
