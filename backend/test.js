const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
prisma.auction.findMany({ where: { status: 'ENDED' } })
  .then(auctions => console.log(JSON.stringify(auctions, null, 2)))
  .catch(console.error)
  .finally(() => prisma.$disconnect());
