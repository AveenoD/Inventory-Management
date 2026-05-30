import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const email = process.env.SEED_EMAIL ?? "owner@skmobile.local";
  const password = process.env.SEED_PASSWORD ?? "changeme";
  const hash = await bcrypt.hash(password, 12);

  const user = await prisma.user.upsert({
    where: { email },
    create: { email, passwordHash: hash },
    update: { passwordHash: hash },
  });

  console.log(`Seeded user: ${user.email}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
