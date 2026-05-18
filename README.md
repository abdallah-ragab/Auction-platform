# BidSpace (مزاد) 🏺✨
> **An AI-Enhanced High-Aesthetic Real-Time Auction Sanctuary for Rare Antiquities & Collectibles**

BidSpace is a premium, real-time digital auction house specifically tailored for high-value items, fine watches, archival cameras, jewelry, and art. Protected by custom neural fraud detection models and featuring zero-latency transaction verification, it brings modern real-time bidding to the MENA region with a tailored Arabic/Egyptian prestige aesthetic.

---

## 🏗️ System Architecture & Stack

BidSpace is designed as a highly optimized monolithic monorepo using **pnpm** and **Turborepo** for clean dependency management and parallelized workflows:

```mermaid
graph TD
    A[React 19 Client app/web] <-->|Real-Time WebSockets| B[Express monolith backend]
    B <-->|PostgreSQL 15| C[(Prisma ORM & pgvector)]
    B <-->|Bull Queues & Pub/Sub| D[(Redis 7 Session/Cache)]
    B <-->|HTTP Fallback Integration| E[FastAPI AI Service port 8000]
    E <-->|Scikit-Learn & PyTorch| F[Fraud / Recommendations Engine]
```

### 💻 Tech Stack Highlights
*   **Frontend (`apps/web`)**: React 19, TypeScript, Vite, TailwindCSS v4, Zustand (auth, socket & theme stores), TanStack React Query, Socket.io Client, Axios JWT Interceptor, Framer Motion animations.
*   **Backend (`backend`)**: Node.js 20, Express monolithic architecture, Prisma ORM, PostgreSQL 15 + `pgvector` for similarity matching, Redis 7 (Express sessions, pub/sub adapters, Bull job queues for auction timers).
*   **AI Service (`ai-service`)**: FastAPI (Python 3.11), PyTorch/Scikit-Learn, Sentry monitoring, offering real-time AI recommendation scoring and anti-shill bidding prediction.
*   **Infrastructure**: Multi-container setup managed via Docker (PostgreSQL, Redis, AI service, Node backend).

---

## 🚀 Setup & Installation (One-Time)

### 📋 Prerequisites
*   **Node.js**: v20+ installed ([nodejs.org](https://nodejs.org))
*   **pnpm**: `npm install -g pnpm`
*   **Python**: v3.11+ ([python.org](https://python.org))
*   **Docker Desktop**: Installed and running ([docker.com](https://docker.com))

---

### 🛠️ Step-by-Step Installation

```bash
# 1. Clone the repository and enter workspace
git clone https://github.com/abdallah-ragab/auction-platform.git
cd auction-platform

# 2. Approve monorepo builds and install dependencies
pnpm approve-builds   # Select 'all' with 'a', then approve with 'y'
pnpm install

# 3. Create Local Environment Configuration Files
# On Windows (PowerShell):
copy backend\.env.example backend\.env
copy ai-service\.env.example ai-service\.env
# On Mac/Linux:
cp backend/.env.example backend/.env
cp ai-service/.env.example ai-service/.env

# 4. Start Infrastructure Containers (PostgreSQL & Redis)
docker compose up -d postgres redis

# 5. Execute Prisma Database Migrations
cd backend
pnpm prisma migrate dev --name init

# 6. Seed Dynamic Demo & Production Lots (Running from Host)
cd ..
# On Windows (PowerShell):
$env:DATABASE_URL="postgresql://user:pass@localhost:5432/auction_db"; pnpm seed
# On Mac/Linux:
DATABASE_URL="postgresql://user:pass@localhost:5432/auction_db" pnpm seed

# 7. Setup Python AI Virtual Environment & Dependencies (Only if running AI locally)
cd ai-service
pip install "numpy<2"
pip install -r requirements.txt
```

---

## ⚡ Daily Development Startup

You can run the application in two ways depending on your preferred workflow:

### Option A: Fully Containerised Services (Easiest - Recommended)
This runs the entire backend infrastructure, monolithic API, and neural AI service inside Docker. You only run the React frontend locally on your host:

1. **Terminal 1: Start Container Backend Stack**
   ```bash
   docker compose up postgres redis backend ai-service --build
   ```
2. **Terminal 2: Start React 19 Frontend Web App**
   ```bash
   pnpm --filter web dev
   ```

### Option B: Local Hybrid Development
If you prefer running services directly on your host machine to get hot reloading on backend / Python service:

1. **Terminal 1: Start Core DB & Cache Containers**
   ```bash
   docker compose up postgres redis
   ```
2. **Terminal 2: Start Node Monolith Backend (from Host)**
   ```bash
   cd backend
   $env:DATABASE_URL="postgresql://user:pass@localhost:5432/auction_db"; pnpm dev
   ```
3. **Terminal 3: Start FastAPI Neural AI Service (from Host)**
   ```bash
   cd ai-service
   uvicorn app.main:app --reload --port 8000
   ```
4. **Terminal 4: Start React 19 Frontend Web App**
   ```bash
   pnpm --filter web dev
   ```

---

## 🔑 Curated Seed & Test Accounts

Every single seeded profile has been pre-configured with the exact same password **`demo1234`** (including the Admin user) for effortless testing:

| Email | Role / Group | Purpose & Pre-seeded Context |
| :--- | :--- | :--- |
| **`admin@auction.test`** | **Platform Admin** | Accesses real-time fraud dashboards, isolation forests, and AI flag console. |
| **`james@auction.test`** | Watch Collector | High watch category engagement, watchlists, active bids. |
| **`priya@auction.test`** | Camera Collector | Detailed cameras interest, pre-seeded active camera bids. |
| **`marco@auction.test`** | Art Collector | Art catalog interactions and custom artwork consignment. |
| **`yuki@auction.test`** | Jewelry Designer | Curated high-end jewelry bidding profiles. |
| **`alex@auction.test`** | Tech Entrepreneur | Consistently bids on high-value electronics and gadgets. |
| **`nina@auction.test`** | Contemporary Curator | Fine art collector with detailed bidding histories. |
| **`omar@auction.test`** | القاهرة Egyptian Bidder | Cairo-based regional user with MENA-localized bids. |
| **`sofia@auction.test`** | Scandinavian Design | Focuses on minimalist Scandinavian design objects. |
| **`luca@auction.test`** | Italian Watch Dealer | Specialized watch bidding activity. |

---

## 🛠️ Key Architectural Guidelines for Developers

To maintain code hygiene and database integrity, developers must strictly adhere to the following rules:

1.  **Shared Types**: All model contracts must use imports from `@auction/shared-types`. Never duplicate interface declarations locally.
2.  **Shared Event Signatures**: Standardize Redis event keys and channel names using `@auction/shared-events`. Avoid using hardcoded/untyped event string publishers.
3.  **Graceful AI Interfacing**: Always route FastAPI AI communication through our backend's `callWithFallback()` wrapper to preserve functional uptime during service outages.
4.  **Database Reset/Wipes**: If schemas drift or seed integrity is broken, safely wipe and re-migrate the local stack via:
    ```bash
    docker compose down -v
    docker compose up postgres redis -d
    # Run from the workspace root folder:
    # On Windows (PowerShell):
    $env:DATABASE_URL="postgresql://user:pass@localhost:5432/auction_db"; pnpm seed
    # On Mac/Linux:
    DATABASE_URL="postgresql://user:pass@localhost:5432/auction_db" pnpm seed
    ```

---

## 🌟 Modern Egyptian & Arabesque Theme Polish

This platform includes dedicated subtle premium design flourishes of the Middle-Eastern Egyptian heritage:
*   **Amiri Serif Typography** applied across baseline logos, arabic sub-badges, and consignment sections.
*   **Egyptian Geometric Accent Brackets** elegantly framing high-value collection cards.
*   **The Curator's Sanctuary Selections** title overhaul on automated AI recommendations to reflect the premier Egyptian auction house atmosphere.
*   **Zero-latency WebSockets** powering bid synchronization.

---
*Developed as a high-fidelity, production-grade graduation project showcase.*