# BidHouse Frontend — Project Handoff

This document provides a comprehensive overview of the BidHouse frontend application, detailing the environment, architecture, state management, and core features to facilitate seamless onboarding and future development, specifically the upcoming Arabic localization phase.

## 1. Environment Variables

The application relies on the following environment variables (typically defined in `.env`):

- `VITE_API_URL`: The base URL for the REST API (e.g., `http://localhost:8000/api`).
- `VITE_SOCKET_URL`: The URL for the real-time Socket.io server (e.g., `http://localhost:8000`).

## 2. Running in Development

To run the frontend locally:

1. Ensure the backend (FastAPI/Node) and infrastructure (Postgres, Redis) are running.
2. Navigate to the frontend workspace: `cd apps/web`
3. Install dependencies: `pnpm install`
4. Start the development server: `pnpm dev`
5. The application will be available at `http://localhost:5173`.

## 3. Component Map

A high-level map of where key reusable components are utilized:

- **`PageShell`**: Wraps virtually every page. Injects `Navbar`, `Footer`, and sets max-width boundaries.
- **`AuctionCard`**: Used heavily in `Home` (Trending, Ending Soon), `Browse` (Grid view), `OwnProfile` (My Auctions), and `Watchlist`.
- **`AnimatedGrid`**: Wraps lists of `AuctionCard`s to provide staggered Framer Motion entrance animations.
- **`FilterSidebar`**: Used exclusively on the `Browse` page for desktop filtering, and nested within a `Sheet` on mobile.
- **`BidSidebar` & `BidForm`**: Used on `AuctionDetail` for real-time bid execution and socket updates.
- **`ImageGallery`**: Used on `AuctionDetail` for thumbnail/hero image crossfading.

## 4. Locale State & Arabic Extension

Localization is currently scaffolded via Zustand and ready for the `i18next` integration:

- **Location**: `src/store/appStore.ts` stores the active `locale` (`'en'` | `'ar'`) and persists it to `localStorage`.
- **UI Integration**: The `Navbar` features a `Globe2` icon that safely toggles this state.
- **Next Steps (Arabic Phase)**: 
  1. Install `i18next` and `react-i18next`.
  2. Map the `locale` from `useAppStore` to the `i18n.changeLanguage()` method.
  3. Implement RTL (Right-to-Left) CSS direction based on the active locale.

## 5. API Endpoints

The application utilizes Axios (`apiClient`) and React Query for data fetching.

**Auth (`authApi`)**:
- `POST /auth/register`: `{ name, email, password }` -> Returns `user`, `accessToken`.
- `POST /auth/login`: `{ email, password }` -> Returns `user`, `accessToken`.
- `GET /auth/me`: -> Returns full `user` profile (stats included).

**Auctions (`auctionsApi`)**:
- `GET /auctions`: Filters via `?q=&category=&sort=` -> Returns `{ auctions, total }`.
- `GET /auctions/:id`: -> Returns full `auction` object + `bids`.
- `POST /auctions`: `{ title, description, startingPrice, ... }` -> Creates a listing.

**Bids (`bidsApi`)**:
- `POST /auctions/:id/bids`: `{ amount }` -> Submits a bid. Returns updated `auction` or throws 400/402/409 errors (mapped to AI Fraud components).
- `GET /bids/my`: -> Returns array of user's active/won/lost bids.

**Admin**:
- `GET /admin/stats`: Dashboard metrics.
- `GET /admin/fraud-flags`: Fraud investigation queue.

## 6. Socket.io Real-Time Events

The `useSocket` hook manages all real-time interactions, deeply integrated into `BidSidebar`:

**Listened Events (Client Receives)**:
- `bid:new`: Triggered when any user places a bid on the viewed auction. Contains `{ amount, user, createdAt }`. Updates the React Query cache and pulses the UI.
- `auction:ended`: Triggered when the timer hits zero. Disables the `BidForm`.
- `auction:extended`: Triggered if a bid is placed in the final minutes (Anti-sniper). Updates the countdown timer.

**Emitted Events (Client Sends)**:
- `auction:join`: `{ auctionId }` — Emitted on mount of `AuctionDetail` to join the room.
- `auction:leave`: `{ auctionId }` — Emitted on unmount.

## 7. Animation System

All animations strictly use GPU-composited properties (opacity, transform) to guarantee 60fps performance without layout thrashing. 

- **File**: `src/lib/animations.ts`
- **Adding New Animations**: Simply define a new `Variants` object in `animations.ts`. 
  - `pageVariants`: Used on `<motion.div>` wrapping full page content (`initial`, `animate`, `exit`).
  - `alertSlideIn`: Dropdown/Toast style alerts.
  - `bidNewVariants`: Green flash/slide used specifically for new bid rows.

## 8. Adding a New Page

To correctly add a new page while maintaining the project's strict architecture:

1. **Create the Component**: `src/pages/NewPage.tsx`. Use `PageShell` as the root wrapper. Wrap the internal content in `<motion.div variants={pageVariants} ...>`.
2. **Setup Lazy Loading**: In `src/App.tsx`, import using React's `lazy`: `const NewPage = lazy(() => import('./pages/NewPage').then(m => ({ default: m.NewPage })));`.
3. **Register Route**: Add the `<Route>` inside `<AnimatedRoutes>`. If it requires auth, wrap it in `<ProtectedRoute>`.
4. **Document Title**: Update the `useDocumentTitle` hook inside `App.tsx` to set the `document.title` conditionally when `location.pathname` matches your new route.
5. **Data Fetching**: Strictly use `useQuery` or `useMutation` via `@tanstack/react-query` to pull data. Do not use local `useEffect` for data fetching.
