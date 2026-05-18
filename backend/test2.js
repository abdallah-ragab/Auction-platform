const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function run() {
  const bids = await prisma.bid.findMany({
    orderBy: { createdAt: 'desc' },
    take: 10,
    include: {
      user: { select: { email: true } },
      auction: { select: { title: true, status: true, winnerId: true } }
    }
  });
  console.log(JSON.stringify(bids, null, 2));
}
run().catch(console.error).finally(() => prisma.$disconnect());
