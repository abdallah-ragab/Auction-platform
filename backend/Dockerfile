FROM node:20-alpine

RUN apk add --no-cache openssl

RUN npm install -g pnpm

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/shared-types/package.json   ./packages/shared-types/package.json
COPY packages/shared-events/package.json  ./packages/shared-events/package.json
COPY packages/shared-utils/package.json   ./packages/shared-utils/package.json
COPY backend/package.json                 ./backend/package.json
COPY apps/web/package.json                ./apps/web/package.json

RUN pnpm install --frozen-lockfile --ignore-scripts=false

COPY packages/ ./packages/
COPY backend/  ./backend/

WORKDIR /app/backend

RUN /app/node_modules/.pnpm/prisma@5.22.0/node_modules/prisma/node_modules/.bin/prisma generate

CMD ["sh", "-c", "/app/node_modules/.pnpm/prisma@5.22.0/node_modules/prisma/node_modules/.bin/prisma migrate deploy && npx tsx src/index.ts"]