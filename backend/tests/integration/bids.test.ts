/**
 * Integration tests — POST /bids and GET /auctions
 *
 * Requirements:
 *   - Real PostgreSQL database (DATABASE_URL env var)
 *   - Redis NOT required — the consumer and job are never started in tests
 *   - AI service NOT required — axios is vi.mocked to return safe fallbacks
 *
 * Run:
 *   cd backend && pnpm test
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import { PrismaClient }  from '@prisma/client';
import bcrypt            from 'bcryptjs';
import jwt               from 'jsonwebtoken';

// ─── Mock axios BEFORE importing the app ─────────────────────────────────────
// The AI service is not running in CI. We mock axios so every call returns the
// safe fallback (confidence 0, score 0) — bids are always allowed.
vi.mock('axios', () => ({
  default: {
    post: vi.fn().mockImplementation((url: string) => {
      if (url.includes('/ai/anti-bot')) {
        return Promise.resolve({
          data: { is_bot: false, confidence: 0.0, reason: 'mocked' },
        });
      }
      if (url.includes('/ai/fraud')) {
        return Promise.resolve({
          data: { flagged: false, score: 0.0, signals: [] },
        });
      }
      return Promise.resolve({ data: {} });
    }),
  },
}));

// ─── Mock Redis publish so tests never need a live Redis ─────────────────────
// The singleton is imported lazily, so we mock the module before app import.
vi.mock('../../src/utils/redis', () => ({
  redis: {
    publish:     vi.fn().mockResolvedValue(1),
    get:         vi.fn().mockResolvedValue(null),
    setex:       vi.fn().mockResolvedValue('OK'),
    on:          vi.fn(),
    subscribe:   vi.fn(),
  },
}));

// ─── Mock socket.ts so no Socket.io server is needed ─────────────────────────
vi.mock('../../src/utils/socket', () => ({
  setIO:  vi.fn(),
  getIO:  vi.fn().mockReturnValue({
    to: vi.fn().mockReturnValue({ emit: vi.fn() }),
  }),
}));

// ─── Import app AFTER mocks are in place ─────────────────────────────────────
// We import only { app } — not server.listen — so no port is bound.
import { app } from '../../src/index';

// ─── Test database client ─────────────────────────────────────────────────────
const prisma = new PrismaClient();

const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET ?? 'dev-access-secret';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Mint a signed access token for a user without hitting the DB. */
function makeToken(userId: string, isAdmin = false): string {
  return jwt.sign(
    { sub: userId, email: 'test@example.com', isAdmin },
    ACCESS_SECRET,
    { expiresIn: '15m' },
  );
}

/** Unique suffix to isolate each test run's data. */
const RUN_ID = Date.now().toString(36);

interface TestUser {
  id:       string;
  email:    string;
  password: string;
  token:    string;
}

interface TestAuction {
  id:           string;
  currentPrice: number;
  version:      number;
}

/** Creates a real user in the DB and returns it with a pre-signed token. */
async function createTestUser(suffix = ''): Promise<TestUser> {
  const email    = `test-${RUN_ID}${suffix}@auction-test.com`;
  const password = await bcrypt.hash('Test1234!', 10);
  const user     = await prisma.user.create({
    data: { email, password, name: `Test User ${suffix}`, abGroup: 'a' },
  });
  return { id: user.id, email, password, token: makeToken(user.id) };
}

/** Creates an ACTIVE auction in the DB. */
async function createTestAuction(sellerId: string, overrides: Record<string, unknown> = {}): Promise<TestAuction> {
  const startsAt = new Date(Date.now() - 60_000);           // started 1 min ago
  const endsAt   = new Date(Date.now() + 60 * 60_000);     // ends in 1 hour
  const auction  = await prisma.auction.create({
    data: {
      title:         `Test Auction ${RUN_ID}`,
      description:   'Integration test auction',
      sellerId,
      category:      'electronics',
      startingPrice: 100,
      currentPrice:  100,
      reservePrice:  50,
      imageUrls:     [],
      status:        'ACTIVE',
      startsAt,
      endsAt,
      ...overrides,
    },
  });
  return { id: auction.id, currentPrice: auction.currentPrice, version: auction.version };
}

// ─── Cleanup helpers ──────────────────────────────────────────────────────────

const createdUserIds:    string[] = [];
const createdAuctionIds: string[] = [];

function trackUser(id: string)    { createdUserIds.push(id); }
function trackAuction(id: string) { createdAuctionIds.push(id); }

async function cleanupAll(): Promise<void> {
  // Delete in dependency order
  if (createdAuctionIds.length) {
    await prisma.bid.deleteMany({ where: { auctionId: { in: createdAuctionIds } } });
    await prisma.fraudFlag.deleteMany({ where: { bid: { auctionId: { in: createdAuctionIds } } } });
    await prisma.botBlock.deleteMany({ where: { auctionId: { in: createdAuctionIds } } });
    await prisma.auction.deleteMany({ where: { id: { in: createdAuctionIds } } });
    createdAuctionIds.length = 0;
  }
  if (createdUserIds.length) {
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    createdUserIds.length = 0;
  }
}

// ─── Suite setup / teardown ───────────────────────────────────────────────────

beforeAll(async () => {
  await prisma.$connect();
});

afterAll(async () => {
  await cleanupAll();
  await prisma.$disconnect();
});

afterEach(async () => {
  await cleanupAll();
});

// ═════════════════════════════════════════════════════════════════════════════
// POST /bids
// ═════════════════════════════════════════════════════════════════════════════

describe('POST /bids', () => {
  let seller:  TestUser;
  let bidder:  TestUser;
  let auction: TestAuction;

  beforeEach(async () => {
    seller  = await createTestUser('-seller'); trackUser(seller.id);
    bidder  = await createTestUser('-bidder'); trackUser(bidder.id);
    auction = await createTestAuction(seller.id); trackAuction(auction.id);
  });

  // ── 1. Happy path ──────────────────────────────────────────────────────────
  it('accepts a valid bid and returns { bid, newHighestBid }', async () => {
    const res = await request(app)
      .post('/bids')
      .set('Authorization', `Bearer ${bidder.token}`)
      .send({ auctionId: auction.id, amount: 150 });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      bid: {
        auctionId: auction.id,
        amount:    150,
      },
      newHighestBid: 150,
    });

    // Verify the DB was actually updated
    const updated = await prisma.auction.findUnique({ where: { id: auction.id } });
    expect(updated?.currentPrice).toBe(150);
  });

  // ── 2. 410 auction_ended ───────────────────────────────────────────────────
  it('returns 410 auction_ended when auction endsAt is in the past', async () => {
    // Override to an already-ended auction
    const endedAuction = await createTestAuction(seller.id, {
      endsAt: new Date(Date.now() - 1000),  // 1 second in the past
      status: 'ENDED',
    });
    trackAuction(endedAuction.id);

    const res = await request(app)
      .post('/bids')
      .set('Authorization', `Bearer ${bidder.token}`)
      .send({ auctionId: endedAuction.id, amount: 150 });

    expect(res.status).toBe(410);
    expect(res.body.error).toBe('auction_ended');
  });

  // ── 3. 409 outbid — optimistic concurrency conflict ───────────────────────
  it('returns 409 outbid with currentPrice when a concurrent bid wins the race', async () => {
    // Simulate the scenario: another bid already moved the price to 200
    // before our bid (at 150) runs. We do this by manually advancing the
    // auction's version + price in the DB, then submitting a stale-version bid.
    await prisma.auction.update({
      where: { id: auction.id },
      data:  { currentPrice: 200, version: { increment: 1 } },
    });

    // amount: 150 is now lower than currentPrice: 200, so the raw SQL
    // UPDATE WHERE current_price < 150 will match 0 rows → 409
    const res = await request(app)
      .post('/bids')
      .set('Authorization', `Bearer ${bidder.token}`)
      .send({ auctionId: auction.id, amount: 150 });

    expect(res.status).toBe(409);
    expect(res.body.error).toBe('outbid');
    expect(res.body.data).toHaveProperty('currentPrice');
    expect(res.body.data.currentPrice).toBe(200);
  });

  // ── 4. 401 unauthorized ────────────────────────────────────────────────────
  it('returns 401 when no Authorization header is provided', async () => {
    const res = await request(app)
      .post('/bids')
      .send({ auctionId: auction.id, amount: 150 });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('unauthorized');
  });

  // ── 5. 422 validation error ────────────────────────────────────────────────
  it('returns 422 when amount is missing from the request body', async () => {
    const res = await request(app)
      .post('/bids')
      .set('Authorization', `Bearer ${bidder.token}`)
      .send({ auctionId: auction.id });  // amount omitted

    expect(res.status).toBe(422);
    expect(res.body.error).toBe('validation_error');
    expect(res.body.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: 'amount' }),
      ]),
    );
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// GET /auctions
// ═════════════════════════════════════════════════════════════════════════════

describe('GET /auctions', () => {
  let seller: TestUser;

  beforeEach(async () => {
    seller = await createTestUser('-seller'); trackUser(seller.id);
  });

  // ── 6. Returns paginated list of ACTIVE auctions ───────────────────────────
  it('returns paginated list of ACTIVE auctions', async () => {
    const a1 = await createTestAuction(seller.id, { title: 'Auction Alpha', category: 'art' });
    const a2 = await createTestAuction(seller.id, { title: 'Auction Beta',  category: 'art' });
    trackAuction(a1.id); trackAuction(a2.id);

    const res = await request(app)
      .get('/auctions')
      .query({ status: 'ACTIVE', page: 1, limit: 20 });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('auctions');
    expect(res.body).toHaveProperty('total');

    const ids = res.body.auctions.map((a: { id: string }) => a.id);
    expect(ids).toContain(a1.id);
    expect(ids).toContain(a2.id);

    // All returned auctions must be ACTIVE
    for (const auction of res.body.auctions) {
      expect(auction.status).toBe('ACTIVE');
    }
  });

  // ── 7. Filters by category correctly ──────────────────────────────────────
  it('filters results by category', async () => {
    const elec  = await createTestAuction(seller.id, { title: 'Electronics Item', category: 'electronics' });
    const jewel = await createTestAuction(seller.id, { title: 'Jewellery Item',   category: 'jewellery'   });
    trackAuction(elec.id); trackAuction(jewel.id);

    const res = await request(app)
      .get('/auctions')
      .query({ category: 'electronics', page: 1, limit: 20 });

    expect(res.status).toBe(200);

    const ids = res.body.auctions.map((a: { id: string }) => a.id);
    expect(ids).toContain(elec.id);
    expect(ids).not.toContain(jewel.id);

    // Every returned auction must be in the requested category
    for (const auction of res.body.auctions) {
      expect(auction.category).toBe('electronics');
    }
  });

  // ── 8. Excludes soft-deleted auctions ─────────────────────────────────────
  it('never returns soft-deleted auctions', async () => {
    const live    = await createTestAuction(seller.id, { title: 'Live Auction'    });
    const deleted = await createTestAuction(seller.id, { title: 'Deleted Auction' });
    trackAuction(live.id); trackAuction(deleted.id);

    // Soft-delete the second auction
    await prisma.auction.update({
      where: { id: deleted.id },
      data:  { deletedAt: new Date(), status: 'CANCELLED' },
    });

    const res = await request(app)
      .get('/auctions')
      .query({ page: 1, limit: 100 });

    expect(res.status).toBe(200);

    const ids = res.body.auctions.map((a: { id: string }) => a.id);
    expect(ids).toContain(live.id);
    expect(ids).not.toContain(deleted.id);

    // Confirm no deletedAt records leaked through
    for (const auction of res.body.auctions) {
      expect(auction.deletedAt).toBeNull();
    }
  });
});
