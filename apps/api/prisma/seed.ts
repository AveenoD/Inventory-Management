import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/** Default shop owner (created/updated on every seed run) */
const SEED_EMAIL = "skmobile@gmail.com";
const SEED_PASSWORD = "SK@7869123";

async function main() {
  const hash = await bcrypt.hash(SEED_PASSWORD, 12);

  const user = await prisma.user.upsert({
    where: { email: SEED_EMAIL },
    create: { email: SEED_EMAIL, passwordHash: hash },
    update: { passwordHash: hash },
  });

  console.log(`Seeded user: ${user.email}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
