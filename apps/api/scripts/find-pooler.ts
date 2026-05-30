import { PrismaClient } from "@prisma/client";

const ref = "zjunjfrkglcqjkrojjbz";
const pass = process.env.DB_PASSWORD ?? "Hello%40bound123%23";
const prefixes = ["aws-0", "aws-1"];
const regions = [
  "us-east-1",
  "us-east-2",
  "us-west-1",
  "us-west-2",
  "eu-west-1",
  "eu-west-2",
  "eu-central-1",
  "eu-central-2",
  "ap-south-1",
  "ap-southeast-1",
  "ap-southeast-2",
  "ap-northeast-1",
  "ap-northeast-2",
];
const ports = [5432, 6543];

async function tryUrl(url: string) {
  const prisma = new PrismaClient({ datasources: { db: { url } } });
  try {
    await prisma.$queryRaw`SELECT 1 AS ok`;
    return true;
  } catch {
    return false;
  } finally {
    await prisma.$disconnect();
  }
}

async function main() {
  for (const prefix of prefixes) {
    for (const region of regions) {
      const hostname = `${prefix}-${region}.pooler.supabase.com`;
      for (const port of ports) {
        const url = `postgresql://postgres.${ref}:${pass}@${hostname}:${port}/postgres?sslmode=require`;
        process.stdout.write(`try ${hostname}:${port} ... `);
        if (await tryUrl(url)) {
          console.log("SUCCESS");
          console.log(url.replace(pass, "***"));
          return;
        }
        console.log("fail");
      }
    }
  }
  console.log("No working pooler found");
  process.exit(1);
}

main();
