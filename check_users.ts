import { PrismaClient } from "./app/generated/prisma/client";
const prisma = new PrismaClient({});
async function main() {
  try {
    const count = await prisma.user.count();
    console.log(`USER_COUNT: ${count}`);
  } catch (err) {
    console.error(`DB_ERROR: ${err.message}`);
  } finally {
    // await prisma.$disconnect();
  }
}
main();
