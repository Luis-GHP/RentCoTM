# RentCo

A mobile app for Philippine landlords to manage rental properties, units, tenants, payments, utility bills, and maintenance — and for tenants to view their own lease, payments, and submit maintenance requests.

**Platform:** iOS & Android (single codebase via React Native + Expo)
**Target market:** Small to mid-scale PH landlords (1–20 units)
**Currency:** PHP (₱) · **Legal context:** RA 9653 (Rent Control Act)

---

## Features

### Landlord
- Dashboard with monthly summary (collected / pending / overdue), portfolio overview, and alerts
- Property and unit management
- Tenant invite system (invite-only, token-based deep link)
- Payment recording and confirmation with sequential OR numbering (OR-YYYY-XXXXXX)
- Utility bill management with LLM-assisted PDF parsing (Claude Haiku)
- Maintenance request tracking
- Rent increase logging with RA 9653 (7% cap) compliance check
- Push notifications for payment confirmations, overdue reminders, and lease expiry

### Tenant
- Home screen with current rent status and payment history
- Upload GCash/bank payment receipts for landlord confirmation
- View utility bills and maintenance request status
- Submit new maintenance requests
- Invite-only registration via landlord-generated deep link

---

## Tech Stack

| Layer | Technology |
|---|---|
| Mobile framework | React Native + Expo (managed workflow) |
| Navigation | Expo Router (file-based) |
| Styling | NativeWind v4 (Tailwind CSS for React Native) |
| Data fetching | TanStack Query (React Query v5) |
| Database + Auth | Supabase (Postgres + RLS) |
| File storage | Supabase Storage |
| Server functions | Supabase Edge Functions (Deno/TypeScript) |
| LLM parsing | Claude Haiku via Edge Function (server-side only) |
| Push notifications | Expo Notifications |
| Deferred deep links | Branch.io |
| Scheduled jobs | Supabase pg_cron |
| OR PDF generation | pdf-lib via Edge Function |

---

## Project Structure

```
app/
  (auth)/          # Login, register (landlord), tenant invite join
  (landlord)/      # Dashboard, properties, payments, maintenance, more
  (tenant)/        # Home, payments, utilities, maintenance, more
components/
  landlord/
  tenant/
  shared/          # Avatar, StatusBadge
lib/
  supabase.ts      # Supabase client
  auth.tsx         # Auth context + session management
  format.ts        # Currency, date, initials formatters
  types.ts         # TypeScript types for all DB tables
  query/           # TanStack Query hooks (dashboard, payments, properties, tenant-home)
supabase/
  functions/       # Edge Functions: parse-utility-bill, generate-or-pdf, send-notification, validate-invite
  migrations/      # 001_schema.sql — full schema
```

---

## Getting Started

### Prerequisites
- Node.js 18+
- Expo CLI (`npm install -g expo-cli`)
- Supabase project (see setup below)

### Installation

```bash
npm install
```

### Environment variables

Create a `.env` file in the project root:

```env
EXPO_PUBLIC_SUPABASE_URL=your_supabase_url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### Supabase Setup

1. Create a Supabase project
2. Run `supabase/migrations/001_schema.sql` in the SQL editor
3. Enable Email auth provider
4. Enable `pg_cron` and `pgcrypto` extensions
5. Create Storage buckets: `documents`, `utility-bills`, `receipts`, `or-pdfs`
6. Add Edge Function secrets: `ANTHROPIC_API_KEY`, `EXPO_ACCESS_TOKEN`

### Run the app

```bash
npx expo start
```

Open in Expo Go, an Android emulator, or an iOS simulator.

---

## Auth Architecture

- **Landlords** register freely via email + password
- **Tenants** are invite-only — landlord generates a secure token link, tenant taps it, sets up their account
- Session persistence via Expo SecureStore
- Route guards check `user_profile.role` and `user_profile.is_active` on every protected route
- Tenant data is fully isolated at the Supabase RLS level — tenants cannot see other tenants' data

---

## Key Database Rules

- `lease.monthly_rent` is snapshotted at lease creation and never recalculated from the unit
- `rent_payment.amount_due` is always copied from `lease.monthly_rent`, never from `unit.monthly_rent`
- `utility_bill.rate_per_kwh` is snapshotted at bill generation time
- Rent increases must go through the `record_rent_increase()` RPC (enforces RA 9653 cap)
- OR numbers are sequential with no gaps — use `claim_or_number()` / `void_or_number()` RPCs
- Tenant applications are approved atomically via `approve_application()` RPC
