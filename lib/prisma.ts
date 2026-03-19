import { PrismaClient } from '../app/generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

const globalForPrisma = global as unknown as {
    prisma?: PrismaClient
}

const adapter = new PrismaPg({
    connectionString: process.env.DATABASE_URL,
})

const createClient = () => new PrismaClient({
    adapter,
})

let prisma = globalForPrisma.prisma || createClient()

if (!(prisma as any).polymarketPriceAlert) {
    prisma = createClient()
}

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

export default prisma