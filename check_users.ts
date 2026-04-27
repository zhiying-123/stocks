import prisma from "./lib/prisma";
async function main() {
  try {
    const count = await prisma.user.count();
    console.log(`USER_COUNT: ${count}`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`DB_ERROR: ${message}`);
  } finally {
    // await prisma.$disconnect();
  }
}
main();
