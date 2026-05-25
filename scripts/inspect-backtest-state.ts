import "dotenv/config";
import prisma from "../lib/prisma";

async function main() {
    const schedules = await prisma.backtestSchedule.findMany();
    const historyCount = await prisma.backtestHistory.count();

    console.log(JSON.stringify({ schedules, historyCount }, null, 2));
}

main()
    .catch((error) => {
        console.error(error);
        process.exitCode = 1;
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
