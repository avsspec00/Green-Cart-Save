# Green Cart Save — Product Requirements Document

## Overview
Green Cart Save is a playful, eco-friendly mobile grocery shopping app built
with React Native (Expo) + FastAPI + MongoDB. Customers shop, scan barcodes,
and one-tap-swap items for greener alternatives. Advertisers (grocery stores
& brands) pay the app owner to surface their products first in the storefront.

## User Choices Captured
- Curated mock catalog (112 products across 7 categories and 7 stores: existing brands + Trader Joe's, ShopRite, A&P, Kings, Whole Foods, Wegmans, Aldi)
- Camera barcode scanning via `expo-camera` + manual fallback
- Rule-based eco scoring (eco-score A/B/C/D + CO₂ kg + packaging + organic/local/plant-based flags)
- Cart persistence: AsyncStorage via `@/src/utils/storage`
- Playful eco aesthetic (emerald primary, amber accent), real product photos with emoji fallback
- Sponsored placements: in-app Admin tab, manual paid-status tracking (Stripe later), "Sponsored" badge visible, highest-bid-wins ranking

## Architecture
- **Frontend**: Expo Router with 5 bottom tabs — Shop / Scan / Cart / Impact / Admin
- **Backend**: FastAPI at `/api/*`, MongoDB collections: `admins`, `advertisers`, `sponsorships`
- **Auth**: JWT-based custom admin auth (single seeded admin from `.env`), `bcrypt` password hashing, idempotent seed on startup

## Backend Endpoints
| Method | Path | Auth | Description |
| ------ | ---- | ---- | ----------- |
| POST | `/api/admin/login` | public | Form-encoded login → JWT |
| GET | `/api/admin/me` | bearer | Current admin |
| GET / POST / DELETE | `/api/admin/advertisers[/{id}]` | bearer | CRUD advertisers (delete cascades sponsorships) |
| GET / POST / PATCH / DELETE | `/api/admin/sponsorships[/{id}]` | bearer | CRUD sponsorships |
| GET | `/api/sponsorships/active` | public | Active placements (bid desc) — used by Shop to rank+badge |

## Key Features (Shipped)
1. **Shop**: search + category chips, product grid, sponsored ranking & badge, qty controls, floating cart CTA
2. **Scan**: live camera scanner + manual barcode fallback
3. **Cart**: line items, "Swap all greener" one-tap, CO₂/plastic stats, checkout
4. **Impact**: Green Score, CO₂, plastic, organic/local stats, eco champions
5. **Admin (NEW)**: JWT login, manage advertisers, create/pause/delete sponsorships per product with bid amounts

## Monetization Hooks
- Sponsorships are stored in MongoDB with `bid_cents`. Highest bid for a product wins the top slot in Shop search. Multiple advertisers can compete for the same product — only the highest-bid is surfaced.
- "Sponsored" badge is shown transparently to customers (app-store friendly).
- Ready to plug Stripe Checkout at the sponsorship-create step in a future iteration.

## Tested Flows
- Backend: 16/16 pytest cases passing (auth, CRUD, public ranking, cascade)
- Frontend: 10/10 e2e flows passing (login, dashboard, create advertiser/sponsorship, sponsored badge on Shop, pause/delete, logout)

## Future Enhancements
- Stripe Checkout for advertiser self-serve billing
- Daily impression/click counters per sponsorship → analytics dashboard
- Multi-tier auctions (e.g. CPC vs daily-fee)
