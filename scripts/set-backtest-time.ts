import "dotenv/config";
import prisma from "../lib/prisma";

async function main() {
    const result = await prisma.backtestSchedule.updateMany({
        where: { key: "polymarket_daily_backtest" },
        data: {
            run_time: "22:16",
            timezone: "Asia/Kuala_Lumpur",
            enabled: true,
        },
    });

    console.log(JSON.stringify({ updatedCount: result.count }, null, 2));
}

main()
    .catch((error) => {
        console.error(error);
        process.exitCode = 1;
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
