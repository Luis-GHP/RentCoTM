# Tenant Management App — Claude Code Context

> Read this file fully before writing any code, creating any file,
> or running any command. Every architectural decision here was
> deliberate and reviewed. Do not deviate without flagging it.

---

## What This App Is

A mobile app for Philippine landlords to manage their rental properties,
units, tenants, payments, utility bills, and maintenance — and for tenants
to view their own lease, payments, and submit maintenance requests.

**Target market:** Small to mid-scale PH landlords (1–20 units).
**Platform:** iOS and Android (single codebase).
**Country context:** Philippines. Currency is PHP (₱). Laws referenced
include RA 9653 (Rent Control Act). Common payment methods are GCash,
Maya, bank transfer, and cash.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Mobile framework | React Native + Expo (managed workflow) |
| Navigation + deep links | Expo Router |
| Styling | NativeWind (Tailwind for React Native) |
| Data fetching | TanStack Query (React Query) |
| Database + auth | Supabase (Postgres) |
| File storage | Supabase Storage |
| Server functions | Supabase Edge Functions (Deno/TypeScript) |
| LLM parsing | Claude Haiku via Edge Function (server-side only) |
| Push notifications | Expo Notifications |
| Deferred deep links | Branch.io (free tier) |
| Scheduled jobs | Supabase pg_cron |
| OR PDF generation | pdf-lib via Edge Function |

---

## Two User Roles

### Landlord
- Self-registers freely via email + password
- Full access to their own properties, units, tenants, and financial records
- Controls all confirmation actions (payments, utility bills, maintenance status)
- Can invite, deactivate, and reactivate tenant accounts

### Tenant
- Cannot self-register — invite-only via landlord-generated link
- Sees only their own lease, payments, utility bills, maintenance requests
- Can upload payment receipts and utility bill PDFs
- Cannot confirm their own payments (landlord always confirms)
- Cannot see any other tenant's data (enforced at RLS level, not just UI)

---

## Auth Architecture

### Landlord registration
Standard Supabase Auth email + password. Email verification required.
On signup, create a `landlord` row and a `user_profile` row with role = 'landlord'.

### Tenant invite flow
1. Landlord taps "Invite Tenant" on tenant profile
2. System generates a cryptographically secure token via `gen_random_bytes(32)`
3. A `tenant_invite` row is created with 7-day expiry
4. Invite link: `https://[your-domain]/join?token=[token]`
5. Landlord shares via native phone share sheet (not hardcoded to any app)
6. Tenant taps link → Branch.io handles deferred deep linking
7. If app installed: opens directly to account setup screen
8. If not installed: redirects to App Store/Play Store, token survives install via Branch.io
9. Tenant sets email + password → call `accept_invite_token()` RPC
10. Token marked as accepted, `user_profile` row created with role = 'tenant'

### Account deactivation
When tenant moves out: landlord sets `user_profile.is_active = false`.
Tenant cannot log in. Data is preserved. Can be reactivated.

### Route guard rule
Check `user_profile.role` AND `user_profile.is_active` on every protected route.
Not just on login. Tenant must never reach a landlord screen, not even as a 404.

---

## Database Rules — Read These Before Touching Any Table

### FROZEN VALUES — Never recalculate from source
- `lease.monthly_rent` is copied from `unit.monthly_rent` ONCE at lease creation.
  After that, `lease.monthly_rent` is independent. All billing reads from lease, never unit.
- `rent_payment.amount_due` is always copied from `lease.monthly_rent` at generation.
  Never read from `unit.monthly_rent`.
- `utility_bill.rate_per_kwh` is snapshotted at the moment the bill is generated.
  Never re-fetched from any source when displaying existing bills.

### ATOMIC OPERATIONS — Use RPC functions, never multiple API calls
- Approving a tenant application: use `approve_application()` RPC only.
  This creates tenant, lease, lease_tenant, advance payments, deposit record,
  updates unit status, and marks application converted — all in one transaction.
- If you add new writes that must happen together with existing ones,
  update the RPC function, do not add separate API calls.

### OR NUMBERING — Sequential, no gaps, never delete
- Use `claim_or_number()` to get an OR number BEFORE writing the payment.
- If payment fails: call `void_or_number()`. Never delete the or_sequence row.
- OR format: OR-YYYY-XXXXXX (e.g., OR-2026-000047)

### CO-TENANTS — Always use lease_tenant table
- `lease.primary_tenant_id` is the main contact only.
- All tenant-to-lease relationships live in `lease_tenant`.
- When querying "who lives in this unit", always join via `lease_tenant`.

### RENT INCREASES — Always use record_rent_increase() RPC
- Never update `lease.monthly_rent` directly.
- Always call `record_rent_increase()` — it logs history, checks RA 9653 cap,
  and updates the lease in one operation.

### EXPENSES — unit_id is nullable
- Property-wide expenses (roof, insurance, building maintenance) have `unit_id = null`.
- Always require `property_id`. Never require `unit_id`.
- Do not create a dummy "General" unit to absorb these.

### ELECTRIC PROVIDER — Lives at property level, not unit level
- `property.electric_provider` and `property.default_rate_per_kwh` are property-wide.
- Units do not have their own provider field.
- Most PH buildings have one Meralco account with sub-meters per unit.

### DOCUMENTS — One table for all files
- `document` is the only file storage table in the app.
- No separate photo tables. No file_url fields on other tables (except bill_pdf_url
  on utility_bill for the original source PDF).
- Use `entity_type` + `entity_id` to attach any file to any record.
- Photo-specific fields (sort_order, area_tag, caption) are nullable.

---

## Utility Bill Upload — Either Side Can Upload

- Both landlords and tenants can upload a utility bill PDF.
- `utility_bill.uploaded_by` tracks who initiated.
- Tenant uploads: `confirmed_by` is null until landlord reviews and confirms.
- Landlord uploads: can confirm immediately.
- The LLM PDF parser (Claude Haiku) is called server-side via Edge Function.
- Always show a confirmation screen after parsing — never auto-save parse results.
- When Anthropic API is down: gray out Parse PDF button, show status banner,
  manual entry stays fully accessible. Never block the user entirely.

---

## Payment Receipt Flow — No LLM Parsing

- Tenants upload GCash screenshots or receipts to the `document` table.
  (`entity_type = 'rent_payment'`, `doc_type = 'receipt'`)
- Landlord sees a pending confirmation badge.
- Landlord verifies in their own GCash/bank, then confirms in-app.
- `rent_payment.confirmed_by` is always 'landlord'. Never 'tenant'. Never 'gateway'.
- Do NOT parse receipt screenshots with LLM. GCash screenshots can be faked.
- `gateway_payload` on rent_payment is null for MVP. Do not remove the column —
  it is reserved for future GCash for Business webhook integration.

---

## RA 9653 Compliance (PH Rent Control Act)

- Units with `monthly_rent <= 10000` are flagged as `is_rent_controlled = true`.
- `record_rent_increase()` RPC automatically computes whether an increase
  exceeds the 7% annual cap and sets `within_ra9653` on the history record.
- Surface a warning in the UI when a proposed increase exceeds 7% on a
  rent-controlled unit. Do not hard-block — warn and require confirmation.

---

## Notification Triggers

### System-triggered (pg_cron)
- 3 days before rent due date
- On rent due date
- When rent is overdue (1 day after due date)
- 30 days before lease end
- 7 days before lease end

### Landlord-action-triggered (Edge Function)
- Payment confirmed → notify tenant
- OR issued → notify tenant
- Utility bill confirmed → notify tenant
- Maintenance request status changed → notify tenant

All push notifications go through Expo Notifications.
Store device push tokens on `user_profile` (add `push_token text` column if not present).

---

## What NOT to Build in MVP

- In-app messaging / chat between landlord and tenant
- GCash / Maya payment gateway integration (manual reference entry only)
- OLX / Lamudi / Facebook Marketplace auto-publish (generate formatted post only)
- Utility bill dispute flow
- Multi-landlord / property manager accounts
- Tenant-facing utility bill dispute
- Barangay Lupon dispute case tracker
- Contractor ratings and review system

These are all designed and deferred. Do not build them unless explicitly instructed.

---

## Folder Structure (Expo Router)

```
app/
  (auth)/
    login.tsx
    register.tsx               -- landlord only
    join.tsx                   -- tenant invite token screen
  (landlord)/
    _layout.tsx                -- role guard: landlord only
    index.tsx                  -- landlord dashboard
    properties/
    units/
    tenants/
    payments/
    maintenance/
    utilities/
    documents/
    settings/
  (tenant)/
    _layout.tsx                -- role guard: tenant only
    index.tsx                  -- tenant home screen
    payments/
    utilities/
    maintenance/
    documents/
    profile/
components/
  landlord/
  tenant/
  shared/
lib/
  supabase.ts                  -- supabase client
  auth.ts                      -- auth helpers
  query/                       -- TanStack Query hooks
supabase/
  functions/                   -- Edge Functions
    parse-utility-bill/        -- LLM PDF parser
    generate-or-pdf/           -- Official Receipt PDF generation
    send-notification/         -- Expo push notification sender
    validate-invite/           -- Token validation
  migrations/
    001_schema.sql             -- full schema (already generated)
```

---

## Edge Function Rules

- Claude API key is NEVER in the mobile app bundle. Always server-side.
- All Edge Functions are Deno/TypeScript.
- Always handle the case where external APIs are unavailable (Anthropic, etc.)
  and return a meaningful error that the app can display gracefully.
- Use Supabase service role key inside Edge Functions only.
  Never expose service role key to the client.

---

## Code Conventions

- TypeScript everywhere — no plain JS files.
- All Supabase queries go through TanStack Query hooks in `lib/query/`.
  No raw Supabase calls inside components.
- All colors and spacing via NativeWind classes. No inline StyleSheet objects
  unless NativeWind cannot handle the case.
- All amounts are stored as `decimal(10,2)` in the DB and displayed in PHP (₱).
  Format: `₱X,XXX.XX` with comma separator.
- All dates are stored as `date` (YYYY-MM-DD) or `timestamptz` (with timezone).
  Display in PH format: `January 15, 2026`.
- Period references use `period_month` (1–12) + `period_year` (YYYY) — never
  a single date field for billing periods.

---

## Supabase Project Setup Checklist

Before running the schema:
- [ ] Create Supabase project
- [ ] Enable Email auth provider
- [ ] Set up Supabase Storage buckets: `documents`, `utility-bills`, `receipts`, `or-pdfs`
- [ ] Set bucket policies (authenticated users only, scoped by folder path)
- [ ] Add ANTHROPIC_API_KEY to Edge Function secrets
- [ ] Add EXPO_ACCESS_TOKEN to Edge Function secrets (for push notifications)
- [ ] Enable pg_cron extension in Supabase dashboard
- [ ] Enable pgcrypto extension (for gen_random_bytes)
- [ ] Configure Branch.io app and add keys to Expo config

---

## Key RPC Functions Reference

| Function | Purpose |
|---|---|
| `approve_application(p_application_id)` | Atomic tenant onboarding — all or nothing |
| `claim_or_number(p_payment_id)` | Get next sequential OR number |
| `void_or_number(p_or_number)` | Mark OR as void on payment failure |
| `record_rent_increase(p_lease_id, p_new_rent, p_effective_date)` | Log increase, check RA 9653 |
| `validate_invite_token(p_token)` | Check if token is valid before showing setup screen |
| `accept_invite_token(p_token, p_user_id)` | Complete tenant account setup |
