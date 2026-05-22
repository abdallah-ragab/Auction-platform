import 'dotenv/config';
import express from 'express';
import http from 'http';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { Server as SocketIOServer } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import Redis from 'ioredis';
import * as Sentry from '@sentry/node';

import { logger } from '@auction/shared-utils';

// ─── Startup env validation ───────────────────────────────────────────────────
// Fail fast in production when required secrets are absent.

function requireEnv(name: string): void {
  if (!process.env[name] && process.env.NODE_ENV === 'production') {
    throw new Error(`Required environment variable ${name} is not set`);
  }
}
requireEnv('JWT_ACCESS_SECRET');
requireEnv('JWT_REFRESH_SECRET');
requireEnv('STRIPE_SECRET_KEY');
requireEnv('STRIPE_WEBHOOK_SECRET');
requireEnv('DATABASE_URL');
requireEnv('REDIS_URL');

// ─── Route modules ────────────────────────────────────────────────────────────
import { authRouter }           from './modules/auth/auth.routes';
import { usersRouter }          from './modules/users/users.routes';
import { auctionsRouter }       from './modules/auctions/auctions.routes';
import { bidsRouter }           from './modules/bids/bids.routes';
import { paymentsRouter }       from './modules/payments/payments.routes';
import { searchRouter }         from './modules/search/search.routes';
import { mediaRouter }          from './modules/media/media.routes';
import { watchlistRouter }      from './modules/watchlist/watchlist.routes';
import { reviewsRouter }        from './modules/reviews/reviews.routes';
import { adminRouter }          from './modules/admin/admin.routes';
import { notificationsRouter }  from './modules/notifications/notifications.routes';

// ─── Middleware + startup ─────────────────────────────────────────────────────
import { errorMiddleware }           from './middlewares/error.middleware';
import { correlationIdMiddleware }   from './middlewares/correlationId.middleware';
import { requireAuth }               from './middlewares/auth.middleware';
import { startConsumer }             from './events/consumer';
import { startAuctionStatusJob }     from './jobs/auctionStatus.job';
import { registerBidSocketHandlers } from './modules/bids/bids.socket';
import { setIO }                     from './utils/socket';

const PORT         = Number(process.env.PORT ?? 3000);
const FRONTEND_URL = process.env.FRONTEND_URL ?? 'http://localhost:5173';
const REDIS_URL    = process.env.REDIS_URL ?? 'redis://localhost:6379';

// Support comma-separated lists of domains in FRONTEND_URL
const allowedOrigins = FRONTEND_URL.includes(',')
  ? FRONTEND_URL.split(',').map(url => url.trim())
  : FRONTEND_URL;

// ─── Sentry ───────────────────────────────────────────────────────────────────
const sentryEnabled = Boolean(process.env.SENTRY_DSN?.length);
if (sentryEnabled) {
  Sentry.init({ dsn: process.env.SENTRY_DSN });
}

// ─── App ──────────────────────────────────────────────────────────────────────

const app    = express();
const server = http.createServer(app);

// ─── Socket.io with Redis adapter ────────────────────────────────────────────
// Two separate ioredis connections are required — one for pub, one for sub.
// This makes socket broadcasts work correctly across multiple backend processes.

const ioServer = new SocketIOServer(server, {
  cors: { origin: allowedOrigins, methods: ['GET', 'POST'] },
});

// Two dedicated ioredis clients for the Socket.IO Redis adapter.
// A subscribed client cannot issue other commands, so pub and sub must be separate.
// Error handlers are mandatory — without them ioredis will emit an uncaught 'error'
// event that silently breaks the adapter before Redis is ready.
const socketPubClient = new Redis(REDIS_URL);
const socketSubClient = socketPubClient.duplicate();

socketPubClient.on('error', (err) => logger.error({ err }, 'Socket.IO adapter pub-client error'));
socketSubClient.on('error', (err) => logger.error({ err }, 'Socket.IO adapter sub-client error'));
socketPubClient.on('connect', () => logger.info('Socket.IO adapter pub-client connected'));
socketSubClient.on('connect', () => logger.info('Socket.IO adapter sub-client connected'));

ioServer.adapter(createAdapter(socketPubClient, socketSubClient));

setIO(ioServer);

// ─── Global Middleware ────────────────────────────────────────────────────────

if (sentryEnabled) Sentry.setupExpressErrorHandler(app);
app.use(helmet());
app.use(cors({ origin: allowedOrigins, credentials: true }));
app.use(correlationIdMiddleware);
app.use(morgan('combined', {
  stream: { write: (msg) => logger.http(msg.trim()) },
}));

// Raw body for Stripe webhooks MUST come before express.json()
app.use('/payments/webhook', express.raw({ type: 'application/json' }));
app.use(express.json());


// ─── Routes ───────────────────────────────────────────────────────────────────

app.use('/auth',           authRouter);
app.use('/users',          usersRouter);
app.use('/auctions',       auctionsRouter);
app.use('/bids',           bidsRouter);
app.use('/payments',       paymentsRouter);
app.use('/search',         searchRouter);
app.use('/media',          mediaRouter);
app.use('/watchlist',      watchlistRouter);
app.use('/reviews',        reviewsRouter);
app.use('/admin',          adminRouter);
app.use('/notifications',  notificationsRouter);

// ─── Health ───────────────────────────────────────────────────────────────────

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

// ─── Error Handling ───────────────────────────────────────────────────────────

app.use(errorMiddleware);

// ─── Start ────────────────────────────────────────────────────────────────────

if (process.env.NODE_ENV !== 'test') {
  server.listen(PORT, async () => {
    logger.info(`Backend running on port ${PORT}`);
    registerBidSocketHandlers(ioServer);
    startConsumer();
    startAuctionStatusJob();
  }).on('error', (err) => {
    logger.error({ err }, 'Server failed to start');
    process.exit(1);
  });
}

export { app, server };
