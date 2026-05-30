# SK Mobile Shop

SK Mobile Shop management app — inventory, POS sales, recharge, money transfer, repair jobs, party ledger, and Excel-compatible monthly reports. Monorepo with Express API, Next.js web, and shared types.

## Stack

- **API:** Node.js, Express, Prisma, PostgreSQL (Supabase)
- **Web:** Next.js 15, TanStack Query
- **Shared:** Zod schemas + API client (`packages/shared`)

## Quick start (local)

### 1. Supabase

1. Create a project at [supabase.com](https://supabase.com).
2. Copy the **Connection string** (URI, use pooler in production).
3. Create `apps/api/.env`:

```env
DATABASE_URL="postgresql://..."
JWT_SECRET="your-long-random-secret"
JWT_EXPIRES_IN="24h"
CORS_ORIGIN="http://localhost:3000"
PORT=4000
SEED_EMAIL="owner@skmobile.local"
SEED_PASSWORD="changeme"
```

### 2. Install & database

```bash
npm install
npm run db:generate
npm run db:migrate
npm run db:seed
```

### 3. Run

```bash
# Terminal 1 — API
npm run dev:api

# Terminal 2 — Web
cp .env.example apps/web/.env.local
# Set NEXT_PUBLIC_API_URL=http://localhost:4000
npm run dev:web
```

Open [http://localhost:3000](http://localhost:3000) and sign in with seed credentials.

### App modules

- **Today** — daily snapshot (sales, recharge, transfer, repair, low stock)
- **Inventory** — products, stock in, low-stock alerts
- **Sales** — POS billing with automatic stock deduction
- **Recharge / Money Transfer / Repair** — form-based entries (not Excel grids)
- **Parties** — supplier ledger transactions
- **Reports** — dashboard with Excel parity + CSV export
- **Settings** — import `.xlsx` workbook

## Deploy

### API (Railway or Render)

- Root directory: `apps/api`
- Build: `npm install && npm run build && npm run db:generate`
- Start: `npm run start`
- Run migrations: `npm run db:migrate`
- Env: `DATABASE_URL`, `JWT_SECRET`, `CORS_ORIGIN` (your Vercel URL)

`render.yaml` and `railway.toml` are included as templates.

### Web (Vercel)

- Root directory: `apps/web`
- Env: `NEXT_PUBLIC_API_URL=https://your-api.example.com`

### Domain

Point `app.yourdomain.com` → Vercel, `api.yourdomain.com` → Railway/Render. Update `CORS_ORIGIN` on the API.

## API overview

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/v1/auth/login` | Login |
| GET | `/api/v1/months` | List months (paginated) |
| POST | `/api/v1/months` | Create month |
| GET | `/api/v1/months/:id/dashboard` | Dashboard totals |
| PUT | `/api/v1/months/:id/money-transfers/bulk` | Upsert daily rows |
| … | `/recharges/bulk`, `/repairs/bulk`, etc. | Same pattern |

Health: `GET /health`

## Tests

```bash
npm run test
```

Dashboard formula tests use golden values from the May 2026 Excel file.

## Expo (later)

Use `@sk-mobile/shared` `createApiClient` with `expo-secure-store` for the JWT. Same API base URL—no Supabase client in the app.
