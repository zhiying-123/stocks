import "dotenv/config";
import prisma from "@/lib/prisma";
import { ensureDefaultPolymarketGroups, syncPolymarketGroups } from "@/lib/polymarket-groups";

function parseArg(flag: string): string | null {
    const index = process.argv.indexOf(flag);
    if (index < 0) return null;
    return process.argv[index + 1] || null;
}

async function main() {
    const slug = parseArg("--slug");
    const systemOnly = process.argv.includes("--system-only");

    await ensureDefaultPolymarketGroups(prisma);

    const groups = await prisma.polymarketMarketGroup.findMany({
        where: slug ? { slug } : systemOnly ? { is_system: true } : {},
        orderBy: [{ is_system: "desc" }, { created_at: "asc" }],
    });

    if (groups.length === 0) {
        throw new Error("No groups found to sync.");
    }

    const result = await syncPolymarketGroups(prisma, groups);

    console.log("[GROUP SYNC] Done");
    console.log(JSON.stringify(result, null, 2));
}

main()
    .catch((error) => {
        console.error("[GROUP SYNC] Failed", error);
        process.exitCode = 1;
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
