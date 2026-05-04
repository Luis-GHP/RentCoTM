# MVP Build Order

Build in this exact sequence. Each phase must be working and tested
before starting the next. Do not skip ahead.

---

## Phase 1 — Foundation (No UI yet)
Everything the app depends on. Get this right before touching screens.

- [ ] Run 001_schema.sql on Supabase
- [ ] Verify all RLS policies work (test as landlord user, test as tenant user)
- [ ] Verify approve_application() RPC with a test application row
- [ ] Verify claim_or_number() and void_or_number() work correctly
- [ ] Verify validate_invite_token() and accept_invite_token() work
- [ ] Set up Supabase Storage buckets (documents, utility-bills, receipts, or-pdfs)
- [ ] Set up Expo project with Expo Router
- [ ] Connect Supabase client (lib/supabase.ts)
- [ ] Set up TanStack Query provider
- [ ] Set up NativeWind

---

## Phase 2 — Auth Screens
Nothing works without login.

- [ ] Landlord login screen
- [ ] Landlord registration screen (email + password + name)
- [ ] Email verification handling
- [ ] Route guard middleware (check role + is_active on every protected route)
- [ ] Landlord dashboard shell (empty, just navigation working)
- [ ] Tenant invite token screen (/join?token=)
- [ ] Tenant account setup screen (set email + password)
- [ ] Tenant dashboard shell (empty, just navigation working)
- [ ] Deactivated account screen ("Contact your landlord")
- [ ] Branch.io deep link setup

---

## Phase 3 — Landlord Core (Properties, Units, Tenants)
The foundational data the whole app runs on.

- [ ] Add property screen
- [ ] Property list screen
- [ ] Add unit screen (per property)
- [ ] Unit list screen (per property)
- [ ] Unit status management (vacant / occupied / under_maintenance)
- [ ] Tenant application form (public-facing, no auth required)
- [ ] Application review screen (landlord approves or rejects)
- [ ] Approve application (calls approve_application() RPC)
- [ ] Tenant profile screen (landlord view — all fields)
- [ ] Invite tenant flow (generate token, share via native share sheet)
- [ ] Resend / revoke invite

---

## Phase 4 — Rent Tracking (Landlord)
Core financial feature.

- [ ] Rent ledger per tenant (list of all months, status, amount)
- [ ] Mark payment as paid (landlord manually enters reference number)
- [ ] Partial payment handling
- [ ] Overdue detection and display
- [ ] Security deposit summary per tenant
- [ ] Record security deposit deduction
- [ ] Record security deposit refund
- [ ] Advance payment months visible in ledger (pre-filled as paid)

---

## Phase 5 — Tenant Home + Payments
First thing tenant sees after login.

- [ ] Tenant home screen (rent status card, due date, last payment status)
- [ ] Tenant rent ledger (own payments only)
- [ ] Upload payment receipt (from gallery or camera)
- [ ] Receipt status display ("Waiting for landlord confirmation" / "Confirmed")
- [ ] Security deposit summary (tenant view)

---

## Phase 6 — Utility Billing
Both sides need to be built together since either can upload.

- [ ] Parse utility bill Edge Function (Claude Haiku, server-side)
- [ ] Utility bill upload screen — landlord side (PDF picker, LLM parse, confirm form)
- [ ] Utility bill upload screen — tenant side (same flow, pending landlord confirmation)
- [ ] API degradation banner (gray out parse button, show manual entry when API down)
- [ ] Utility bill list — landlord view (per unit, all periods)
- [ ] Utility bill list — tenant view (own unit, own bills)
- [ ] Bill detail screen (kWh breakdown, rate, amount — both sides)
- [ ] Landlord confirms tenant-uploaded bill

---

## Phase 7 — Maintenance Requests
Both sides need to work together.

- [ ] Submit maintenance request — tenant side (title, category, priority, description, photos)
- [ ] Maintenance request list — tenant side (own requests, status tracker)
- [ ] Maintenance request list — landlord side (all units, filterable by status/priority)
- [ ] Update maintenance status — landlord side (open → assigned → in progress → resolved)
- [ ] Assign vendor to work order
- [ ] Work order cost tracking

---

## Phase 8 — Documents
After payments and maintenance are working.

- [ ] Upload lease contract — landlord side
- [ ] Tenant document viewer (lease contract, ORs, inspection reports)
- [ ] Move-in inspection form (landlord fills out, tenant can view read-only)
- [ ] Photo attachment viewer (maintenance photos, inspection photos)

---

## Phase 9 — Official Receipts
Requires Phase 4 to be complete.

- [ ] OR PDF generation Edge Function (pdf-lib, BIR-compliant format)
- [ ] Generate OR from confirmed payment — landlord side
- [ ] OR download — landlord side
- [ ] OR download — tenant side
- [ ] OR void flow (if payment fails after OR claimed)

---

## Phase 10 — Notifications
Wire up after all core features are working.

- [ ] Expo push token registration on login
- [ ] Store push token on user_profile
- [ ] Send notification Edge Function (Expo push API)
- [ ] System notifications via pg_cron (rent due reminders, lease expiry)
- [ ] Landlord-action notifications (payment confirmed, maintenance updated, bill issued)
- [ ] Notification inbox screen (both sides)

---

## Phase 11 — Landlord Analytics (Post-MVP)
Deferred. Build after MVP is stable.

- [ ] Portfolio dashboard (occupancy rate, monthly income, overdue totals)
- [ ] Expense tracking and reporting
- [ ] Income vs expense per property
- [ ] RA 9653 compliance alerts
- [ ] Rent increase history view

---

## Deferred Features (Do Not Build in MVP)

- In-app landlord-tenant messaging
- GCash / Maya gateway integration
- OLX / Lamudi listing export
- Utility bill dispute flow
- Barangay Lupon case tracker
- Multi-landlord / property manager accounts
- Tenant application from public listing page
- Contractor vendor ratings
