# RentCo — Build Progress

> Last updated: 2026-05-07
> Active branch: `master`
> Current work is continuing locally from the pushed `master` baseline.

---

## How to read this file

- ✅ Done and committed
- 🔲 Not started
- Each section lists the files involved and what specifically was built or needs to be built

---

## 1. Brand Guidelines & Design Tokens ✅

**Files touched:**
- `BRAND_GUIDELINES.md` — created. Covers color palette, typography (Inter), spacing (4pt grid), component specs (buttons, badges, inputs, tabs, rows), iconography (Ionicons outline), screen patterns (landlord white header vs tenant branded hero), do's/don'ts
- `constants/theme.ts` — full rewrite: `BrandColors`, `Colors` (semantic aliases), `FontFamily`, `FontSize`, `LineHeight`, `Spacing`, `Radius`, `Shadow`
- `tailwind.config.js` — aligned with theme tokens

**Decisions made:**
- Font: Inter (system-ui fallback)
- Primary color: `#2F4A7D` (Steel Ink Blue), with rust accent `#C34A1A` and hero accent `#FFB14A`
- All screens use inline styles (not NativeWind class strings) except `login.tsx` and `register.tsx` which were built with NativeWind
- Dark mode: deferred to post-MVP, noted in brand guidelines roadmap

---

## 2. Shared Component Library ✅

**Files in `components/shared/`:**

| Component | File | What it does |
|---|---|---|
| `Button` | `Button.tsx` | primary / secondary / danger variants, loading + disabled states, height 52px |
| `Card` | `Card.tsx` | white bg, borderRadius 14, shadow-1, `padded` prop |
| `FormInput` | `FormInput.tsx` | labeled TextInput, focus/error border states |
| `ListRow` | `ListRow.tsx` | label/value detail row, optional chevron, `right` slot prop |
| `FilterTabs` | `FilterTabs.tsx` | generic `<T extends string>` tabs, active = primary bg white text |
| `EmptyState` | `EmptyState.tsx` | Ionicons icon + title + subtitle + optional CTA button |
| `LoadingSpinner` | `LoadingSpinner.tsx` | centered ActivityIndicator, `fullScreen` prop |
| `AlertBox` | `AlertBox.tsx` | error / warning / info / success with matching bg/border/text |
| `SectionHeader` | `SectionHeader.tsx` | title + optional "View all" link |
| `StatusBadge` | `StatusBadge.tsx` | colored pill badge for payment, lease, and maintenance statuses |
| `Avatar` | `Avatar.tsx` | initials-based colored circle avatar |

**Barrel export:** `components/shared/index.ts`

---

## 3. Supabase Backend ✅

### Database migrations

| File | What it contains |
|---|---|
| `supabase/migrations/001_schema.sql` | Full schema: all 20+ tables, RLS enable, RLS helper functions (`auth_user_role`, `auth_landlord_id`, `auth_tenant_id`), all RLS policies for landlord and tenant, all RPC functions, indexes |
| `supabase/migrations/002_landlord_profile_and_push_token.sql` | `push_token` column on `user_profile`, user profile RLS policies (read + update own), `create_landlord_profile()` RPC |
| `supabase/migrations/003_security_hardening.sql` | Fixed mutable `search_path` on all functions (added `SET search_path = ''` + fully-qualified `public.` table names), added landlord role guard to `approve_application`, `claim_or_number`, `void_or_number`, `record_rent_increase`, revoked `anon` EXECUTE on all business RPC functions |
| `supabase/migrations/006_storage_buckets_and_policies.sql` | Creates initial upload buckets (`documents`, `utility-bills`, `receipts`, `or-pdfs`) with authenticated write policies |
| `supabase/migrations/007_fix_lease_tenant_rls_recursion.sql` | Fixes recursive `lease_tenant`/`lease` RLS checks that made Property Detail show "Couldn't Load Property" |
| `supabase/migrations/008_phase0_invites_payments_documents.sql` | Adds lease terms to invites, creates leases on invite acceptance, hardens OR numbering, fixes invite/payment/document RPC privileges |
| `supabase/migrations/009_fix_invite_expires_at_ambiguity.sql` | Fixes `create_landlord_invite` ambiguous `expires_at` reference after SQL 8 |
| `supabase/migrations/010_tenant_unit_access_and_maintenance_categories.sql` | Lets tenants read their leased unit/property and aligns maintenance DB categories with the app |
| `supabase/migrations/011_maintenance_tenant_resolution_response.sql` | Adds tenant response RPC for landlord-marked maintenance fixes: tenant can confirm fixed or send back to in progress |
| `supabase/migrations/012_landlord_maintenance_status_rpc.sql` | Adds a landlord-owned maintenance status RPC so landlord Mark Fixed/Close transitions do not rely on direct client table updates |
| `supabase/migrations/013_tenant_own_document_visibility.sql` | Lets tenants read documents attached to their own tenant record for the tenant document center |
| `supabase/migrations/014_house_rules_and_policies.sql` | Adds property-level house rules with landlord manage RLS and tenant read-only visibility for leased properties |
| `supabase/migrations/015_rent_cycle_utility_receipts_property_unit_documents.sql` | Adds property/unit document coverage, utility receipt document policy, and rent/utility lifecycle support |
| `supabase/migrations/016_notification_history.sql` | Adds durable in-app notification history with per-user read/update/delete RLS |
| `supabase/migrations/017_security_hardening_audit_fixes.sql` | Locks `user_profile` writes behind RPC, makes storage private/signed-url based, validates storage refs, binds invite acceptance to `auth.uid()`, moves rent/utility/unit transitions into RPCs, and adds notification sender rate data |
| `supabase/migrations/024_didit_tenant_identity_verification.sql` | Adds Didit-backed tenant identity verification tracking with tenant/landlord read RLS and minimal metadata storage |
| `supabase/migrations/025_tenant_self_service_invites.sql` | Changes tenant invites so landlords only assign unit/lease terms and tenants provide their own name, phone, and email during registration |
| `supabase/migrations/026_landlord_requested_identity_verification.sql` | Adds landlord-requested Didit KYC RPC so tenants only start verification after a landlord requests it |
| `supabase/migrations/027_account_deletion_requests.sql` | Adds account deletion request intake with own-request RLS and `request_account_deletion()` RPC for App Store / Google Play account deletion initiation |

**Migrations must be run in order in Supabase Dashboard → SQL Editor.**

### RPC functions (all in 001 + 003)

| Function | Purpose |
|---|---|
| `approve_application(p_application_id)` | Atomic tenant onboarding — creates tenant, lease, lease_tenant, advance payments, deposit record, marks unit occupied, marks application converted |
| `claim_or_number(p_payment_id)` | Issues next sequential OR number (format: OR-YYYY-XXXXXX). Must be called BEFORE confirming payment |
| `void_or_number(p_or_number)` | Marks OR as void. Called if payment confirmation fails after OR was claimed |
| `record_rent_increase(p_lease_id, p_new_rent, p_effective_date)` | Logs to rent_increase_history, checks RA 9653 7% cap, updates lease |
| `validate_invite_token(p_token)` | Called by edge function to check if invite token is valid |
| `accept_invite_token(p_token, p_user_id, p_name, p_phone, p_email)` | Marks invite accepted, creates tenant/profile rows from tenant-entered details |
| `request_tenant_identity_verification(p_tenant_id)` | Landlord-owned RPC that creates or reuses a Didit verification request for a tenant |
| `create_landlord_profile(p_name, p_email)` | Creates landlord row + user_profile row after email sign-up |

### Edge functions (in `supabase/functions/`)

| Function | Status | What it does |
|---|---|---|
| `parse-utility-bill` | Deployed, redeploy after latest local change | Downloads a verified Storage object path, sends PDF to Claude Haiku as base64, returns structured JSON (provider, utility_type, period, kWh, rate, amount, confidence). Returns `anthropic_unavailable` gracefully if API is down |
| `generate-or-pdf` | Deployed, redeploy after latest local change | Generates A4 Official Receipt PDF using pdf-lib, uploads to private `or-pdfs` bucket, stores a `storage://` ref, returns a signed URL |
| `send-notification` | Deployed, redeploy after latest local change | Looks up `push_token` from `user_profile`, rate-checks recent sender history, writes notification history, sends via Expo Push API, auto-clears token on `DeviceNotRegistered` error |
| `validate-invite` | Deployed | Wraps `validate_invite_token` RPC using service role key to bypass RLS |
| `create-didit-session` | Built locally, deploy after SQL 24/26 and Didit secrets | Creates or continues a Didit hosted KYC session only when a landlord-requested verification row already exists |
| `sync-didit-session` | Built locally, deploy after SQL 24 and Didit secrets | Lets tenants manually refresh the latest Didit decision/status |
| `didit-webhook` | Built locally, deploy after SQL 24 and Didit webhook secret | Receives signed Didit callbacks and updates verification status without storing raw ID images |

**Edge functions were deployed to Supabase project `nqvowdysiiuyuclermxx` on 2026-05-06. Redeploy after any function code changes.**

### Storage buckets
- `documents` — general file attachments
- `utility-bills` — tenant-uploaded utility bill PDFs
- `receipts` — tenant payment receipt screenshots
- `or-pdfs` — generated Official Receipt PDFs
- Migration `006_storage_buckets_and_policies.sql` creates these buckets. Migration `017_security_hardening_audit_fixes.sql` makes them private and shifts app reads to signed URLs.

### Environment
- `.env` — `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` set
- Edge function secrets to set in dashboard: `ANTHROPIC_API_KEY`, `EXPO_ACCESS_TOKEN`, `DIDIT_API_KEY`, `DIDIT_WORKFLOW_ID`, `DIDIT_WEBHOOK_SECRET`

---

## 4. Stub Screens ✅

All screens from the Screen Inventory in `CLAUDE.md` were created as functional stubs before detail work began. Stubs had correct file structure, auth guards, and real data fetching — just no navigation between them.

---

## 5. Detail Screens + Action Flows ✅

### Step 5a — Structural move + navigation wiring ✅

- Converted flat `properties.tsx`, `payments.tsx`, `maintenance.tsx` into directories with nested `_layout.tsx` (Stack navigators) so detail screens can push on top
- Wired Quick Actions on dashboard to their routes (Add Property, Add Tenant, Record Payment, Upload Utility Bill)
- Wired PropertyCard, PaymentItem, and maintenance rows to navigate to detail screens
- Updated `(landlord)/_layout.tsx` to hide all nested routes from tab bar using `href: null`

### Step 5b — Property detail + Unit detail ✅

**New query hooks in `lib/query/properties.ts`:**
- `useProperty(id)` — fetches property with all units, each unit's active lease, and primary tenant name
- `useUnit(unitId)` — fetches unit with property name, all leases, lease tenants (primary + co-tenants), lease financials

**New screens:**
- `app/(landlord)/properties/[id]/index.tsx` — property info card (address, electric provider, rate/kWh), occupancy stats row (total/occupied/vacant/%), units list sorted alphanumerically with status color, tenant name, and monthly rent per unit
- `app/(landlord)/properties/[id]/units/[unitId].tsx` — status banner with unit type + floor + rent, tenant card with name/phone/email + View link to tenant detail, co-tenants section, active lease card (dates, rent, deposit, RA 9653 flag), Record Payment + Maintenance quick action buttons, Invite Tenant CTA for vacant units

### Step 5c — Payment detail + Record Payment ✅

**New query hooks + mutations in `lib/query/payments.ts`:**
- `usePayment(id)` — full payment detail including tenant name, unit, property, confirmed_by
- `useConfirmPayment()` — calls `claim_or_number` RPC then updates payment to paid; voids OR if update fails
- `useMarkPaymentUnpaid()` — calls `void_or_number` RPC then reverts payment to pending
- `useActiveLeases()` — all active leases with tenant name and unit info, for the record payment form
- `useRecordPayment()` — inserts payment, claims OR number for full payments, updates payment with OR

**New screens:**
- `app/(landlord)/payments/[id].tsx` — amount hero (green if paid, amber if pending), OR number display, tenant avatar + unit, payment details (method, reference, date, confirmed date), Confirm Payment & Issue OR button, Mark as Unpaid button with Alert confirmations
- `app/(landlord)/payments/record.tsx` — active lease picker (scrollable list, checkmark on selection), month chip selector (horizontal scroll), year chip selector, amount input pre-filled from monthly rent, method chips (GCash/Maya/Bank/Cash), conditional reference number field for non-cash methods, today's date display

### Step 5d — Maintenance detail ✅

**Built:**
- `useMaintenanceRequest(id)` hook in `lib/query/maintenance.ts`
- `useUpdateMaintenanceStatus()` mutation in `lib/query/maintenance.ts`
- `app/(landlord)/maintenance/[id].tsx` — full detail screen with category icon, priority, location card, description, timeline, and status stepper

---

## 6. Tenants (Landlord Side) 🔲

**Needs building:**

### `lib/query/tenants.ts` additions
- `useAllTenants(filter)` — all tenants with active/inactive filter, search support
- `useCreateInvite()` mutation — creates `tenant_invite` row, returns token

### Screens
- `app/(landlord)/tenants/index.tsx` — searchable list of tenants, Active/Inactive filter tabs, each row shows name, unit number, property name, monthly rent, status badge. Access via Quick Action "Add Tenant" or dashboard nav
- `app/(landlord)/tenants/[id].tsx` — tenant profile (name, phone, email, gov ID), current lease info, tab bar within screen: Payment History | Maintenance | Documents. Each tab shows relevant records with nav to detail screens
- `app/(landlord)/tenants/invite.tsx` — generate invite link flow: landlord enters tenant name + phone, system calls `create_landlord_invite` RPC-style insert, generates link `https://[domain]/join?token=[token]`, shows link in a box with native Share button. Note: do NOT hardcode any messaging app — use the system share sheet

Also needs: `app/(landlord)/tenants/_layout.tsx` (Stack)

---

## 7. Utilities (Landlord Side) 🔲

**Needs building:**

### `lib/query/utilities.ts` (new file)
- `useAllUtilityBills(filter?)` — all bills across all units, filter by status/type
- `useUtilityBill(id)` — single bill detail
- `useConfirmUtilityBill()` mutation — sets `confirmed_by` and `confirmed_at`

### Screens
- `app/(landlord)/utilities/index.tsx` — list of all utility bills grouped by unit, filter by status (unpaid/paid), shows utility type icon, period, amount, status badge
- `app/(landlord)/utilities/[id].tsx` — bill detail: utility type, provider, period, kWh consumed, rate per kWh, amount, Confirm button (if unconfirmed), bill PDF link (if uploaded)
- `app/(landlord)/utilities/upload.tsx` — PDF upload flow: pick PDF from device → upload to Supabase Storage → call `parse-utility-bill` edge function → show parsed fields on review screen → landlord edits if needed → save. Show banner if Anthropic API is down, keep manual entry always accessible

Also needs: `app/(landlord)/utilities/_layout.tsx` (Stack)

---

## 8. Add Property Form 🔲

**Needs building:**
- `useCreateProperty()` mutation in `lib/query/properties.ts`
- `app/(landlord)/properties/add.tsx` — form: property name (required), address (required), property type picker (apartment/house/condo/boarding_house/commercial), electric provider picker (meralco/veco/dlpc/beneco/neeco/manual), default rate per kWh (optional, shown when provider is not manual). On save: navigate to the new property's detail screen

---

## 9. Tenant Detail Screens 🔲

**Needs building:**
- `app/(tenant)/payments/[id].tsx` — view single payment: period, amount, status, OR number, payment date. Upload Receipt button (navigates to receipt upload flow) if status is pending/unpaid/overdue
- `app/(tenant)/utilities/[id].tsx` — view single bill: utility type, provider, period, kWh, rate, amount, status. Upload PDF button (triggers utility bill upload flow for tenant side)
- `app/(tenant)/maintenance/[id].tsx` — view single request: title, description, category, priority, status badge, landlord notes (if any), created/resolved dates. No edit allowed — view only
- `app/(tenant)/maintenance/new.tsx` — submit new maintenance request: title (required), category picker, priority picker, description (required), optional photo upload. On submit: insert into `maintenance_request` with `unit_id` from active lease

Also needs subdirectory `_layout.tsx` files for tenant payments, utilities, maintenance.

---

## 10. Edge Function Wiring 🔲

**Needs connecting (functions are already written):**
- On payment confirm → call `generate-or-pdf` edge function → store PDF URL
- On payment confirm → call `send-notification` to tenant
- On maintenance status change → call `send-notification` to tenant
- On utility bill confirm → call `send-notification` to tenant
- Register device push token on app launch → update `user_profile.push_token`

---

## Bug Fixes Applied

| Bug | Where | Fix |
|---|---|---|
| `b.kwh_used` field doesn't exist | `(tenant)/index.tsx` | Changed to `b.kwh_consumed` |
| `b.total_amount` field doesn't exist | `(tenant)/index.tsx` | Changed to `b.amount` |
| Avatar showed UUID gibberish | `(tenant)/index.tsx` | Added `useTenant()` call, pass real name |
| Priority key `urgent` doesn't match DB enum | `(tenant)/index.tsx` | Changed to `emergency` |
| StatusBadge missing maintenance statuses | `StatusBadge.tsx` | Added open/assigned/in_progress/resolved/closed |
| `expo-secure-store` crash on startup | `lib/supabase.ts` | Replaced with `AsyncStorage` |
| OR not voided if update fails in `useRecordPayment` | `lib/query/payments.ts` | Added `void_or_number` RPC call on updateErr after OR claim |
| `useConfirmPayment` overwrote `payment_date` unconditionally | `lib/query/payments.ts` | Now only sets `payment_date` if it was null; accepts `currentPaymentDate` param; call site updated |
| Moving maintenance to `closed` cleared `resolved_at` | `lib/query/maintenance.ts` | Now only clears `resolved_at` when reverting to open/assigned/in_progress; closed preserves it |
| Deactivated users redirected to login instead of deactivated screen | `(landlord)/_layout.tsx`, `(tenant)/_layout.tsx` | Separated `!is_active` check → `router.replace('/(auth)/deactivated')` |
| `partial` payments invisible in dashboard summary | `lib/query/dashboard.ts` | Added partial bucket: collected += amount_paid, pending += remaining balance |
| Expiring leases alert included already-expired leases | `lib/query/dashboard.ts` | Added `.gte('end_date', today)` lower bound to the leases query |
| `cleaning` and `internet` missing from `MaintenanceRequest.category` type | `lib/types.ts` | Added both to the union type |
| `useRecentTenantPayments` used `.in()` with single value | `lib/query/tenant-home.ts` | Changed to `.eq('status', 'paid')` |
| Property detail could render a blank screen after create/open failure | `(landlord)/properties/[id]/index.tsx` | Added explicit error/not-found empty state with Back to Properties action |
| Add Unit flow was documented but not implemented | `(landlord)/properties/[id]/index.tsx`, `lib/query/properties.ts` | Added Add Unit modal, `useCreateUnit()` mutation, and navigate-to-new-unit behavior |
| Payments and maintenance empty states felt too terse | `(landlord)/payments/index.tsx`, `(landlord)/maintenance/index.tsx` | Updated to the locked "No X Yet" empty-state pattern with helpful hints and payment CTA |
| Utility bill PDF upload failed with Storage RLS error | `supabase/migrations/006_storage_buckets_and_policies.sql`, `lib/query/utilities.ts` | Added storage bucket/policy migration and clearer upload error handling |
| Property Detail showed "Couldn't Load Property" after adding a property | `lib/query/properties.ts`, `supabase/migrations/007_fix_lease_tenant_rls_recursion.sql` | Split tenant-name enrichment out of the base property query and added an RLS recursion fix migration |
| Dashboard logo looked tiny and fake-transparent | `(landlord)/index.tsx`, `(tenant)/index.tsx` | Replaced baked-checkerboard image usage with clean wordmarks and right-aligned notification/profile clusters |
| Dashboard felt too plain/flat | `(landlord)/index.tsx` | Moved logo, greeting, and monthly summary into a branded hero with rounded bottom corners and rounded capsule dividers |
| Dashboard hero did not match the intended layered design | `(landlord)/index.tsx` | Reworked it into a textured brand hero, raised summary panel, flat straight summary dividers, and overlapping portfolio card |
| Main list pages lacked brand presence | `components/shared/MainHeader.tsx`, main landlord/tenant tab screens | Added branded title headers to main pages while keeping detail/form headers white |
| Status-bar area stayed gray above brand headers | `components/shared/MainHeader.tsx`, main dashboard/list pages | Brand headers now extend behind the top safe area with light status-bar icons |
| Dashboard hero break felt too high | `(landlord)/index.tsx` | Increased hero vertical breathing room so the rounded brand break sits lower |
| Light page backgrounds felt empty | `components/shared/PageBackground.tsx`, main landlord/tenant tab screens | Added faint linework background texture behind main page content |
| Property Detail occupancy tile wrapped awkwardly | `(landlord)/properties/[id]/index.tsx` | Removed the fourth stat tile and moved occupancy into a compact progress row |
| Invite Tenant from a vacant unit showed "No Vacant Units Available" | `(landlord)/tenants/invite.tsx`, `lib/query/tenants.ts` | Passes `unitId` from Unit Detail, preselects it, and no longer treats active-invite lookup errors as an empty unit list |
| Template literals in PROGRESS.md Steps B–E used single quotes | `PROGRESS.md` | Fixed to backtick syntax so they work when copy-pasted |
| Expo push registration warned about missing projectId in Expo Go | `lib/notifications.ts`, `components/PushNotificationBootstrap.tsx` | Skips remote push registration in Expo Go and only calls `getExpoPushTokenAsync` when an EAS project id exists |
| Repetitive account/payment/utility defaults | `app/(auth)/join.tsx`, `app/(tenant)/more.tsx`, `app/(landlord)/payments/record.tsx`, `app/(landlord)/utilities/upload.tsx`, `lib/query/utilities.ts` | Tenant join email now defaults into tenant profile, tenant profile falls back to auth email, single-lease payment record auto-selects, and electric utility bills can default provider/rate from property settings |
| Invite creation failed with ambiguous `expires_at` | `supabase/migrations/009_fix_invite_expires_at_ambiguity.sql` | Qualified the `tenant_invite` alias in `create_landlord_invite` and reloaded PostgREST schema |
| Dashboard collected amount wrapped on small screens | `(landlord)/index.tsx` | Dashboard money values now fit to one line and omit `.00` for whole-peso amounts |
| Tenant dashboard stayed on "Loading your unit..." | `lib/query/tenant-home.ts`, `(tenant)/index.tsx`, `supabase/migrations/010_tenant_unit_access_and_maintenance_categories.sql` | Normalized nested unit/property data, added tenant unit/property read policies, and show explicit load errors |
| Maintenance request submit felt stuck | `(tenant)/maintenance/new.tsx`, `lib/query/tenant-home.ts`, `supabase/migrations/010_tenant_unit_access_and_maintenance_categories.sql` | Added an in-app success modal, best-effort photo uploads, clearer submit errors, and DB support for all visible categories |
| Landlord maintenance detail blanked/loaded forever | `lib/query/maintenance.ts`, `(landlord)/maintenance/[id].tsx` | Fixed reporter relationship from nonexistent `tenant_id` to `reported_by` and added a visible retry state |
| Landlord maintenance detail did not show tenant photos | `(landlord)/maintenance/[id].tsx` | Added maintenance photo list with thumbnails and open-file action |
| Maintenance close flow relied on phone-native prompts | `(landlord)/maintenance/[id].tsx`, `(tenant)/maintenance/[id].tsx`, `lib/query/tenant-home.ts`, `supabase/migrations/011_maintenance_tenant_resolution_response.sql` | Reworked flow so landlord marks fixed, tenant confirms or sends back, and landlord can still close as override through cohesive in-app modals |
| Landlord Mark Fixed modal could spin forever | `lib/query/maintenance.ts`, `(landlord)/maintenance/[id].tsx`, `supabase/migrations/012_landlord_maintenance_status_rpc.sql` | Moved landlord status transitions to an ownership-checked RPC, added a client timeout, and closes the modal with a visible error if Supabase rejects or stalls |
| Maintenance photos opened the browser | `(landlord)/maintenance/[id].tsx`, `(tenant)/maintenance/[id].tsx` | Photo taps now open an in-app full-screen image viewer; Open Original remains available as a secondary action |
| Maintenance list/detail lacked operational context | `(landlord)/maintenance/index.tsx`, `(landlord)/maintenance/[id].tsx`, `(tenant)/maintenance/[id].tsx`, `lib/query/maintenance.ts` | Added Closed filter, duration text, tappable related rows, and clearer attachment failure messaging |
| Property and Unit editing was missing | `(landlord)/properties/[id]/index.tsx`, `(landlord)/properties/[id]/units/[unitId].tsx`, `lib/query/properties.ts` | Added edit property/unit modals, unit status controls, current rent status pill, and open-maintenance badges |
| Landlord payment detail lacked receipt/OR actions | `(landlord)/payments/[id].tsx` | Added tenant receipt thumbnails with viewer, Official Receipt PDF open/share actions, and clearer partial-payment balance copy |
| Utility AI parser fell back to manual too often | `supabase/functions/parse-utility-bill/index.ts`, `lib/query/utilities.ts` | Hardened React Native PDF upload to use file ArrayBuffers instead of Blob uploads, added empty-PDF guards, improved the Philippine utility bill prompt, tolerates JSON fences, and calls the function through fetch so non-2xx responses surface their real parser message |
| Dashboard felt empty below Quick Actions | `(landlord)/index.tsx` | Added a functional Needs Attention panel and a quiet branded footer accent |

---

## UI/UX Gaps — Reviewed & Locked In

> These were reviewed screen by screen. Each item has a recommendation. Build when the screen is being worked on — do not skip these during implementation.

---

### Global Patterns (apply to all screens)

- **Error states** must never say "Failed to load X" in red text. Always: icon + "Couldn't load [X] right now" + "Pull down to try again"
- **Empty states** should say "No [X] Yet" with a helpful one-line hint, not terse developer text
- **+ buttons** on list screens must be in the header, consistent position (top right)
- **Back arrows** on all detail and form screens — tab screens never have back arrows
- **Dead buttons** (buttons that exist but go nowhere) must be wired before a screen is considered done

---

### Landlord Dashboard `/(landlord)/index`

| Gap | Recommendation | Priority |
|---|---|---|
| Bell icon has no `onPress` | Route to `/(landlord)/more` for now (notifications not built). Remove chevron feel — make it a stub icon only | Stub |
| Avatar has no `onPress` | `router.push('/(landlord)/more')` | MVP |
| Alert rows not tappable | Overdue → `/(landlord)/payments`, Expiring leases → `/(landlord)/tenants`, Pending confirmations → `/(landlord)/payments` | MVP |
| "Upload Utility Bill" quick action routes wrong | Goes to `/(landlord)/utilities` (list) — should go directly to `/(landlord)/utilities/upload` | MVP |
| No pull-to-refresh | Add `RefreshControl` — refetch all dashboard queries on pull | Post-MVP |
| No error state on Summary/Portfolio cards | If fetch fails, cards silently show nothing. Add inline "Couldn't load" fallback | Post-MVP |

---

### Property Detail `/(landlord)/properties/[id]`

| Gap | Recommendation | Priority |
|---|---|---|
| No Add Unit button | + button in header AND a CTA button in the "No units yet" empty state. Form fields: unit number, type picker, floor (optional), monthly rent. On save → navigate to new unit's detail | MVP |
| No Edit Property | Pencil icon in header → edit form (name, address, type, provider, rate) | MVP |
| Edit rate specifically | Inline pencil next to Default Rate row → single-field modal. Rate changes often, no need for full edit screen just for rate | MVP |
| Property type not shown | Show as subtitle under property name in header: "Sunrise Apts · Boarding House" | MVP |
| No income roll-up | 5th stat tile next to occupancy row: total monthly income from active leases only | MVP |
| Vacant unit has no quick action | Show small "Invite" pill button directly on vacant unit card row alongside the chevron | MVP |
| Maintenance context missing | Show open request count badge on unit card (red dot with number) | MVP |
| Documents | Stub "View documents" row in info card, no screen yet | Stub now |
| Delete/Archive property | 3-dot menu in header — do NOT build yet. Needs soft-delete + cascade consideration | Post-MVP |

**Completed from this section:** Add Unit button/modal, no-units CTA, new unit mutation, navigate-to-new-unit behavior, and property type subtitle are now built.

**Ticked off in this pass:**
- [Built] No Add Unit button
- [Built] Property type shown in Property Detail header
- [Built] Blank Property Detail fallback state
- [Built] Payments empty state copy and CTA
- [Built] Maintenance empty state copy
- [Built] Utility bill Storage RLS migration and upload error handling
- [Built] Property Detail base load no longer depends on lease tenant enrichment
- [Built] Lease tenant RLS recursion fix migration
- [Built] Property Detail occupancy progress row replacing stacked tile

**Unit type display logic:**
- All types (Studio/1BR/2BR/3BR/Room/Whole Unit) follow identical app logic — type is a label only
- Bedspace exception: icon changes to `bed-outline`, unit number placeholder changes to "e.g. Bedspace 1"
- No branching logic in lease, payments, or tenant flow based on unit type

---

### Unit Detail `/(landlord)/properties/[id]/units/[unitId]`

| Gap | Recommendation | Priority |
|---|---|---|
| Maintenance button goes nowhere | Navigate to maintenance list with `unitId` filter param. No new screen needed | MVP |
| Current month rent status invisible | Colored pill inside status banner: "January · Paid ✓" / "Pending" / "Overdue". Taps to that payment's detail | MVP |
| No Rent Increase button | Small "Request Rent Increase" link row at bottom of Active Lease card. Only show when unit is occupied | MVP |
| Co-tenants are plain text | Replace with same row style as primary tenant — avatar + name + View button → `tenants/[id]` | MVP |
| No payment history shortcut | One tappable "View Payment History" row below quick action buttons → payments filtered to this lease | MVP |
| No Edit Unit | Pencil icon in header → form for unit number, type, floor only. Monthly rent is NOT editable here — use Rent Increase | MVP |
| No status change | "Change Status" link in status banner → bottom sheet (Occupied / Vacant / Under Maintenance). Hidden when active lease exists | MVP |
| No utility bills section | Skip — belongs on Tenant Detail, not Unit Detail | Post-MVP |
| Documents | Stub "View documents" row at bottom of lease card | Stub now |

**Completed from this section:** Maintenance button now navigates to the filtered maintenance list for the current unit. Vacant-unit Invite Tenant CTA now passes the selected `unitId` into the invite flow.

---

### Payment Detail `/(landlord)/payments/[id]`

| Gap | Recommendation | Priority |
|---|---|---|
| Receipt not visible | Show receipt thumbnail or "View Receipt" row when tenant has uploaded one (`document` table, `entity_type = 'rent_payment'`, `doc_type = 'receipt'`). Show "Awaiting Receipt" note when nothing uploaded | MVP |
| OR PDF no download/share | Add "Download OR" / "Share OR" button below OR number when `isPaid && or_number`. Calls `generate-or-pdf` edge function | MVP |
| Amount hero label wrong when paid | Change label from "Amount Due" to "Amount Paid" when `isPaid`, show `amount_paid` value. For partial show both: "₱X paid of ₱X due" | MVP |
| Tenant card not tappable | Add `` onPress={() => router.push(`/(landlord)/tenants/${tenantId}`) } `` to tenant card | MVP |
| Overdue has no days context | When status is `overdue`, show "X days overdue" below the status badge in the header. Calculate from `payment_date` or lease due date | MVP |
| No action for partial balance | No button needed — landlord records a new payment from Record Payment screen. Add a note: "To record remaining balance, use Record Payment" as a small hint text below the partial breakdown | MVP |

---

### Maintenance Detail `/(landlord)/maintenance/[id]`

| Gap | Recommendation | Priority |
|---|---|---|
| No photos/attachments | Add "Photos" section between Description and Timeline. Query `document` table: `entity_type = 'maintenance_request'`, `entity_id = request.id`. Horizontal scroll of thumbnails, tap to full screen. Show "No photos attached" when empty | MVP |
| Reported By not tappable | Replace plain ListRow with tappable row + "View" pill → `/(landlord)/tenants/${request.tenant.id}`. Only show if `tenant.id` exists | MVP |
| Unit not tappable | Make Unit row tappable → `` `/(landlord)/properties/${unit.property.id}/units/${unit.id}` `` — `property.id` is already selected in the query | MVP |
| No landlord notes | Add "Notes" card below Description. Show `landlord_notes` if set. Pencil icon → text input modal (multiline, Save). On save update `maintenance_request.landlord_notes`. Show "Visible to tenant" label on the card. **Requires migration: add `landlord_notes text` column to `maintenance_request` table + update `useMaintenanceRequest` query to select it** | MVP |
| No open duration context | Below status badge in header add: "Open for X days" (from `created_at` to today) or "Resolved in X days" (from `created_at` to `resolved_at`). Small gray text, no extra card | MVP |
| No push notification hint | Add small gray helper text below status stepper: "Tenant will be notified when status changes." Only show when unit has an active tenant | MVP |
| Description hidden when null | Always render Description card. When `description` is null show "No description provided" in gray text instead of hiding the card | MVP |

---

### Payments List `/(landlord)/payments`

| Gap | Recommendation | Priority |
|---|---|---|
| No Record Payment button | + button in header navigates to `payments/record` | MVP |
| "Failed to load payments" error | Replace with icon + "Couldn't load payments right now" + "Pull down to try again" | MVP |

---

### Record Payment `/(landlord)/payments/record`

| Gap | Recommendation | Priority |
|---|---|---|
| Payment date not editable | Replace display-only date with tappable date picker. Default today, allow any past date, block future dates | MVP |
| No duplicate payment warning | After lease + period selected, query `rent_payment` for same `lease_id + period_month + period_year`. If exists show `AlertBox` warning — not a hard block | MVP |
| No search on tenant list | Search input above lease list, filters by tenant name or unit number client-side. Only show when more than 5 leases exist | MVP |
| Navigates back instead of to new payment | `useRecordPayment` mutationFn now returns `inserted.id` — use the return value from `mutateAsync` to navigate to `` `/(landlord)/payments/${newId}` `` on success | MVP |
| Partial balance context invisible | When lease + period selected, show info banner if existing partial payment found: "Existing partial: ₱X paid, ₱X remaining." Lightweight query triggered by both selections | MVP |
| Empty lease list has no guidance | Replace "No active leases found" with standard empty state: icon + "No Active Leases" + "Add a property and invite a tenant to get started" + link to properties | MVP |
| No notes/memo field | Optional single-line "Notes" input below date field. Check if `notes` or `remarks` column exists on `rent_payment` before building — post-MVP if column absent | Post-MVP |

---

### Tenants List `/(landlord)/tenants`

**Should have:**
- Header: "Tenants" title + person-add icon top right → `/(landlord)/tenants/invite`
- Search bar below header — filters by tenant name, unit number, or property name (client-side)
- Filter tabs: Active / Inactive
- Each row: avatar (initials), tenant name, unit number + property name, monthly rent, status badge, chevron → `/(landlord)/tenants/[id]`
- Empty state (no tenants): icon + "No Tenants Yet" + "Tap the invite icon to add your first tenant"
- Empty state (no search results): "No tenants match your search"
- Loading state

| Decision | Recommendation |
|---|---|
| Inactive tenant — show unit? | Yes — show last known unit so landlord remembers who they are |
| Monthly rent on row? | Yes — landlords mentally group tenants by rent amount |
| Inactive tenants tappable? | Yes — same profile screen with a clear "Inactive" banner at the top of tenant detail |

---

### Tenant Detail `/(landlord)/tenants/[id]`

**Header:** Back arrow + tenant name + pencil icon → edit profile (name, phone, email)

**Inactive banner:** Full-width amber banner below header when `is_active = false`

**Profile card:**
- Large avatar (56px initials), full name, "Tenant" role label
- Phone, email

**Government ID card (separate card below profile):**
- ID type label + ID number
- Front + back photo thumbnails — tap to full screen view
- If no ID: camera icon + "Add Government ID" CTA
- CTA flow: (1) pick ID type, (2) enter ID number, (3) take photo or pick from gallery for front, (4) optional back photo, (5) save
- ID types: PhilSys (National ID), UMID, SSS, PhilHealth, Passport, Driver's License, Voter's ID
- Photos stored in `document` table: `entity_type = 'tenant'`, `entity_id = tenant.id`, `doc_type = 'gov_id_front'` / `'gov_id_back'`
- `gov_id_type` and `gov_id_number` stored on `tenant` table fields

**Lease card:**
- Unit + property name, start/end dates, monthly rent, security deposit, deposit balance, RA 9653 flag
- "Rent Increase" link at bottom of card → `/(landlord)/tenants/[id]/rent-increase`

**In-screen tab bar (3 tabs):**
- Payment History — all payments for this tenant's active lease, most recent first. Each row: period, amount, status badge, OR number if paid. Tappable → `/(landlord)/payments/[id]`
- Maintenance — all requests from this tenant. Each row: title, category icon, priority dot, status badge, date. Tappable → `/(landlord)/maintenance/[id]`
- Documents — all other docs for this tenant. Each row: doc type, filename, upload date. Tappable → full screen viewer

**Bottom actions:**
- "Deactivate Tenant" — only when `is_active = true`. Destructive alert confirmation. Sets `user_profile.is_active = false`
- "Reactivate Tenant" — only when `is_active = false`

| Decision | Recommendation |
|---|---|
| No active lease | Still show profile + ID card. Lease card shows "No active lease" |
| Past leases | Post-MVP — only active lease shown |
| Front + back ID | Both allowed — two separate document rows |
| Gov ID types | PhilSys, UMID, SSS, PhilHealth, Passport, Driver's License, Voter's ID |
| Deactivate effect | Route guard on `(tenant)/_layout.tsx` checks `is_active` on every load — tenant blocked on next app open |

---

### Invite Tenant `/(landlord)/tenants/invite`

**Header:** Back arrow + "Invite Tenant"

**Form (before generating):**
- Tenant name — text input, required
- Phone number — numeric input, PH format (+63 / 09XX), required
- Unit assignment — picker showing vacant units only (unit number + property name). Required — invite must be tied to a unit

**On Generate:**
- Insert into `tenant_invite` table: token, tenant name, phone, unit ID, 7-day expiry
- Form disappears, link UI takes over
- Shows generated link in a copyable text box: `https://[domain]/join?token=[token]`
- Expiry label: "This link expires in 7 days"
- Native Share button — system share sheet only, no hardcoded apps
- Copy to clipboard button alongside the link
- "Generate New Link" button to reset and start over

| Decision | Recommendation |
|---|---|
| Unit assignment required? | Yes — invite must be tied to a specific unit |
| No vacant units available | Show "No vacant units available" instead of picker + link to Add Unit |
| Invite without unit? | Not allowed |
| Expiry display | Show clearly: "Expires January 22, 2026" |
| Existing active invite for same unit | Warn: "An invite for this unit is already active. Generating a new one will invalidate the old link." — require confirmation before proceeding |

---

### Utilities List `/(landlord)/utilities`

**Header:** "Utilities" + upload icon top right → `/(landlord)/utilities/upload`

**Filter tabs:** All / Pending / Confirmed

**List:** Grouped by unit (unit number + property name as section header), sorted by period descending within each unit

**Each bill row:** Utility type icon (flash=electric, water-drop=water, wifi=internet), period, amount, status badge, chevron → `/(landlord)/utilities/[id]`

**Empty state:** Icon + "No Utility Bills Yet" + "Tap the upload icon to add your first bill"

| Decision | Recommendation |
|---|---|
| Group by unit or by month? | Group by unit — landlord processes one unit's bills at a time |
| Filter by utility type? | Post-MVP — All/Pending/Confirmed is enough for now |
| Who can upload? | Both sides. Landlord upload = can confirm immediately. Tenant upload = needs landlord confirmation |

---

### Utility Bill Detail `/(landlord)/utilities/[id]`

**Header:** Back arrow + "Utility Bill" + unit number subtitle + status badge

**Bill info card:** Utility type icon + label, provider name, billing period, kWh consumed, rate per kWh, total amount

**PDF row:** If `bill_pdf_url` exists — "View Original Bill" tappable row opens PDF. If none — "No PDF uploaded"

**Uploaded by row:** Shows who uploaded (landlord or tenant name)

**Confirm button:** Full-width primary — "Confirm Bill" — only when unconfirmed. Alert confirmation first. Sets `confirmed_by` and `confirmed_at`

**Confirmed state:** Shows confirmed by + confirmed date. Confirm button hidden.

| Decision | Recommendation |
|---|---|
| Edit after confirming? | No — confirmed bills are locked |
| Edit before confirming? | Yes — pencil icon on the bill info card |
| Tenant-uploaded bills | Show "Uploaded by [tenant name]" + "Pending your review" amber banner |

---

### Upload Utility Bill `/(landlord)/utilities/upload`

**Header:** Back arrow + "Upload Utility Bill"

**Step 1 — Pick PDF:**
- Large dashed upload area — "Tap to select PDF"
- Document picker (PDF only)
- On select: show filename + file size + "Parse with AI" button
- "Enter manually instead" link — always visible, skips AI

**Step 2 — Parsing:**
- "Analyzing your bill…" loading spinner
- If Anthropic API down: amber banner "AI parsing unavailable" → skip to manual entry form
- On success: go to Step 3

**Step 3 — Review parsed fields:**
- All parsed fields shown and editable: utility type, provider, period, kWh, rate, amount
- Confidence score label on each field — amber warning if below 80%: "Please review carefully"
- Unit picker — required, assign to a specific unit
- "Save Bill" button

| Decision | Recommendation |
|---|---|
| Confidence score shown? | Yes — "X% confident" label per field. Below 80% = amber warning |
| PDF not a utility bill | Error: "Couldn't parse this document. Please enter details manually." |
| Unit assignment required? | Yes — cannot save without selecting a unit |

---

### Add Property `/(landlord)/properties/add`

**Header:** Back arrow + "Add Property"

**Form fields:**
- Property name — text input, required
- Address — multiline text input, required
- Property type — picker: Apartment / House / Condo / Boarding House / Commercial
- Electric provider — picker: Meralco / VECO / DLPC / BENECO / NEECO / Manual
- Average rate per kWh — numeric input, optional. Hidden when provider is "Manual". Shows approximate rate as placeholder hint (Meralco ≈ ₱11/kWh) — landlord must type their actual rate, not pre-filled

**Save button:** "Add Property" — full width primary. On success → navigate to new property's detail screen

**Validation:** Name + address required. Provider required. Rate required when provider is not Manual.

| Decision | Recommendation |
|---|---|
| Label | "Average Rate per kWh" — more accurate than "default" since Meralco rates fluctuate monthly |
| Pre-fill rate? | No — show as placeholder hint only. Landlord must type their actual rate |
| Units added here? | No — add property first, then add units from property detail screen |
| Provider not in list? | "Manual" option — no provider name locked, landlord enters rate freely |

---

### Properties List `/(landlord)/properties`

| Gap | Recommendation | Priority |
|---|---|---|
| Error message is dev-facing | Replace with icon + "Couldn't load your properties right now" + "Pull down to try again" — Step G covers the fix | MVP |
| Under-maintenance units lumped with vacant | Add a third pill with wrench icon + count for `under_maintenance` units, shown only when count > 0 | MVP |
| No pull-to-refresh | Add `RefreshControl` on `ScrollView` using `refetch()` from `useProperties()` | Post-MVP |

---

### Maintenance List `/(landlord)/maintenance`

| Gap | Recommendation | Priority |
|---|---|---|
| No error state | `error` not destructured from `useMaintenanceRequests` — blank screen on fetch failure. Add icon + "Couldn't load requests right now" | MVP |
| "Closed" status missing from filter | Add "Closed" tab or include `closed` in the Resolved filter | MVP |
| Needs `unitId` filter support | Accept optional `unitId` query param, pre-filter list when present. Used by Unit Detail Maintenance button — Step I covers the fix | MVP |
| No + button | Landlord may want to log a request themselves (vacant unit issue, inspection finding). Add Post-MVP screen `/(landlord)/maintenance/new` | Post-MVP |

---

### Landlord More `/(landlord)/more`

| Gap | Recommendation | Priority |
|---|---|---|
| Notifications row goes nowhere | Remove chevron, make it non-tappable until notifications screen is built | MVP |
| About RentCo row goes nowhere | Same — remove chevron or wire to a simple static screen | MVP |

---

### Rent Increase `/(landlord)/tenants/[id]/rent-increase`

Screen doesn't exist yet. What it needs:

| Element | Notes |
|---|---|
| Header | Back arrow + "Rent Increase" + tenant name + unit number subtitle |
| Current rent (read-only) | Displayed from `lease.monthly_rent` — the frozen copy, never `unit.monthly_rent` |
| New rent input | Currency input, decimal-pad keyboard |
| Live % increase indicator | Computed as user types: `((new - current) / current * 100).toFixed(1)%` — green if ≤7%, amber if >7% |
| Effective date | Date input, defaults to 1st of next month |
| RA 9653 warning | Amber banner when `lease.is_rent_controlled = true` AND increase >7%: "This exceeds the 7% annual cap under RA 9653. You may still proceed but should consult DHSUD." — warn only, never block |
| Reason field | Optional free text, stored for record-keeping |
| Submit | Calls `record_rent_increase(p_lease_id, p_new_rent, p_effective_date)` RPC — never a direct DB update |

| Gap | Recommendation | Priority |
|---|---|---|
| Screen doesn't exist | Build as described above | MVP |
| Must use RPC not direct update | `record_rent_increase()` only — per CLAUDE.md rule | MVP (correctness) |
| RA 9653: warn not block | Amber banner + confirm still enabled — landlord decides | MVP (legal) |
| Current rent source | Read from `lease.monthly_rent` only | MVP (correctness) |

---

### Landlord Documents `/(landlord)/documents`

Screen doesn't exist yet. What it needs:

> **Navigation note:** This screen is not a visible tab. It must be registered as a hidden tab (`href: null`) in `(landlord)/_layout.tsx` so Expo Router can resolve the route. Access entry point: "Documents" row in the More screen (see More gap below).

| Element | Notes |
|---|---|
| Header | "Documents" title — no + button. Uploads happen from source screens |
| Filter tabs | All / Receipts / IDs / Bills / Photos |
| Document rows | File name, entity it belongs to ("Juan dela Cruz · Receipt · May 2026"), upload date, file type icon |
| Tappable rows | Opens PDF viewer or image viewer |
| Grouped by | Month or entity type for scanning |

| Gap | Recommendation | Priority |
|---|---|---|
| Screen doesn't exist | Build with filter tabs, document list rows, file viewer | MVP |
| No standalone upload | By design — link back to source screen ("Go to payment detail to upload receipt") | MVP |
| PH gov ID type labels | Display human-readable labels (PhilSys, UMID, SSS, etc.) not raw `doc_type` DB codes | MVP |
| OR PDFs | Payment ORs generated by edge function should auto-appear here under Receipts | MVP |

---

### Tenant Documents `/(tenant)/documents`

Screen doesn't exist yet. Mirrors landlord documents but scoped to the tenant's own files only.

> **Navigation note:** Not a visible tab. Must be registered as a hidden tab (`href: null`) in `(tenant)/_layout.tsx`. Access entry point: "Documents" row in the tenant More screen.

| Element | Notes |
|---|---|
| Header | "Documents" title — no + button |
| Filter tabs | All / Receipts / Bills / IDs |
| Document rows | Their receipts, utility bill PDFs, gov IDs, lease OR copies |
| Tappable rows | Opens file viewer |

| Gap | Recommendation | Priority |
|---|---|---|
| Screen doesn't exist | Build with filter tabs, document rows scoped to tenant, file viewer | MVP |
| OR PDFs auto-appear | When landlord confirms payment, the generated OR PDF auto-attaches and appears here — tenant doesn't need to do anything | MVP |
| No upload from here | Guide tenant: "To upload a receipt, go to Payments → [month]" | MVP |
| RLS enforced at DB | Tenant must only ever see their own documents — RLS policy on `document` table handles this | MVP (security) |

---

### Tenant Home `/(tenant)/index`

| Gap | Recommendation | Priority |
|---|---|---|
| "Upload Payment Receipt" button does nothing | Navigate to tenant payments list, then tenant selects which payment to upload for | MVP |
| "View all" payments does nothing | Navigate to payments tab | MVP |
| "View all" utilities does nothing | Navigate to utilities tab | MVP |
| "New Request" maintenance does nothing | Navigate to `/(tenant)/maintenance/new` | MVP |
| Individual payment rows not tappable | Navigate to `/(tenant)/payments/[id]` | MVP |
| Individual utility rows not tappable | Navigate to `/(tenant)/utilities/[id]` | MVP |
| Individual maintenance rows not tappable | Navigate to `/(tenant)/maintenance/[id]` | MVP |

---

### Tenant Payments List `/(tenant)/payments`

| Gap | Recommendation | Priority |
|---|---|---|
| Rows not tappable | Navigate to `/(tenant)/payments/[id]` | MVP |
| No filter tabs | Add All / Pending / Confirmed / Overdue tabs same as landlord side | MVP |
| No Upload Receipt shortcut | Upload Receipt button in header — goes to payments list (user selects which payment) | MVP |

---

### Tenant Payment Detail `/(tenant)/payments/[id]`

| Gap | Recommendation | Priority |
|---|---|---|
| Screen doesn't exist yet | Build with: back arrow, period + status badge header, amount hero (green/amber), payment details card, receipt upload/view section, OR number display | MVP |
| Receipt upload missing | Upload button → document picker → save to `document` table (`entity_type='rent_payment'`, `doc_type='receipt'`) | MVP |
| Advance payments labelled "Pending" | Future-period payments show "Advance" badge on both list and detail, not "Pending". **Detection logic: compare `period_year`/`period_month` against current date — NOT based on `payment_method = 'advance'` which is a different concept (how it was paid, not when)** | MVP |
| No Download OR button | "Download OR" calls `generate-or-pdf` edge function, opens PDF viewer | Post-MVP |
| No payment grouping in list | Tenant payment list should group rows: Overdue → This Month → Upcoming (Advance) | Post-MVP |

---

### Tenant Utilities Detail `/(tenant)/utilities/[id]`

| Gap | Recommendation | Priority |
|---|---|---|
| Screen doesn't exist yet | Build with: back arrow, utility type + period header + status badge, amount hero (kWh consumed + rate + total), bill details card, "View Bill PDF" if available | MVP |
| Tenant can't upload bill PDF | Add "Upload Bill PDF" button → saves to `document` table (`entity_type='utility_bill'`, `doc_type='bill'`). No LLM parsing for tenant uploads — just attachment | MVP |
| Rate per kWh must use snapshotted value | Display `bill.rate_per_kwh` (snapshotted at generation time) — never re-fetch from property | MVP (correctness) |
| No due date shown | Show `utility_bill.due_date` if present. **`due_date` does not exist in the current schema — requires migration: add `due_date date` column to `utility_bill` table** | Post-MVP |

---

### Tenant Maintenance List `/(tenant)/maintenance`

| Gap | Recommendation | Priority |
|---|---|---|
| "New Request" button does nothing | Navigate to `/(tenant)/maintenance/new` | MVP |
| Rows not tappable | Navigate to `/(tenant)/maintenance/[id]` | MVP |

---

### Tenant Maintenance Detail `/(tenant)/maintenance/[id]`

| Gap | Recommendation | Priority |
|---|---|---|
| Screen doesn't exist yet | Build with: back arrow, title + status badge header, category/priority hero (same icons as landlord), description card, timeline card, read-only status progress strip (no buttons — tenant can't change status), photo gallery if photos attached | MVP |
| Emergency priority visual cue | Emergency gets a distinct red banner at top of screen | Post-MVP |
| Landlord notes not shown | If landlord added notes during status update, show "Landlord Update" card with note text | Post-MVP |

---

### Tenant Maintenance New `/(tenant)/maintenance/new`

| Gap | Recommendation | Priority |
|---|---|---|
| Screen doesn't exist yet | Build with: back arrow, title input (required), category chip selector (8 categories), priority selector with color cues (Low/Medium/High/Emergency), description textarea (optional), photo upload 1–3 images, Submit button | MVP |
| Unit auto-assigned | Derive `unit_id` from tenant's active lease — never ask tenant to pick a unit | MVP |
| Emergency priority confirmation | When Emergency is selected, show inline warning: "This will alert your landlord immediately" | MVP |

---

### Tenant Utilities List `/(tenant)/utilities`

| Gap | Recommendation | Priority |
|---|---|---|
| Rows not tappable | Navigate to `/(tenant)/utilities/[id]` | MVP |
| No Upload Bill button | Upload icon in header → `/(tenant)/utilities/[id]` (user selects which bill) | MVP |

---

### Tenant More `/(tenant)/more`

| Gap | Recommendation | Priority |
|---|---|---|
| Deposit balance missing | Add "Deposit Balance" row to Lease Summary — `lease.security_deposit_balance` | MVP |
| No landlord contact info | Add "Your Landlord" mini-card showing landlord name + phone — needed for emergencies | MVP |
| No Edit Contact Info | Pencil icon on profile card → allow tenant to update phone + email | Post-MVP |
| Lease end proximity warning | Amber banner when lease ends within 30 days: "Your lease ends on [date]" | Post-MVP |
| No Notifications toggle | Add Notifications row, non-tappable in MVP (no chevron) | Stub |

---

### Landlord More `/(landlord)/more`

| Gap | Recommendation | Priority |
|---|---|---|
| Notifications row is dead | Remove chevron, make row non-tappable (`View` instead of `TouchableOpacity`) | Stub |
| About RentCo row is dead | Same treatment as Notifications — remove chevron | Stub |
| No Edit Profile | Pencil icon on profile card → update name, phone | Post-MVP |

---

### Login `/(auth)/login`

| Gap | Recommendation | Priority |
|---|---|---|
| "RentCo" text should be logo image | Replace `<Text>RentCo</Text>` with `<Image source={require('logo-horizontal.png')}` — consistent with headers | MVP |
| No Forgot Password link | Add "Forgot password?" link below Sign In button → Supabase `resetPasswordForEmail()` | Post-MVP |

---

### Register `/(auth)/register`

| Gap | Recommendation | Priority |
|---|---|---|
| No phone number field | Add optional Phone field — landlord phone shown on More but never collected at signup | Post-MVP |

---

### Join `/(auth)/join` (Tenant Invite)

| Gap | Recommendation | Priority |
|---|---|---|
| Generic welcome message | Tenant name is in the invite record — show "Welcome, [name]!" above the form | MVP |
| No confirm password field | Add Confirm Password field — reduces account setup errors | Post-MVP |

---

### Deactivated `/(auth)/deactivated`

| Gap | Recommendation | Priority |
|---|---|---|
| Uses emoji 🔒 | Replace with `<Ionicons name="lock-closed-outline" size={48} color="#9CA3AF" />` — consistent with rest of app | MVP |

---

---

## Built Feature: House Rules & Policies

> Built locally as a property-level first version. Unit-specific overrides are still deferred.

### What it is
Landlords can write house rules and policies per property (property-wide) or per unit (unit-specific overrides). Tenants can read the rules that apply to their unit. Not a high-priority action item — reference material only.

### Database

New table: `house_rule`

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | |
| `landlord_id` | `uuid` FK → `landlord` | |
| `property_id` | `uuid` FK → `property` | Always required |
| `unit_id` | `uuid` FK → `unit`, nullable | null = property-wide rule |
| `title` | `text` | e.g. "No Smoking", "Garbage Schedule" |
| `body` | `text` | The full rule text |
| `sort_order` | `int` | Controls display order |
| `is_active` | `bool` default true | Soft-delete / unpublish |
| `created_at` | `timestamptz` | |

**Tenant query logic:** fetch policies where `property_id` = tenant's property AND `unit_id IS NULL` (property-wide), UNION fetch where `unit_id` = tenant's unit. Display property-wide first, then unit-specific.

### Landlord Side

| Screen | What to add |
|---|---|
| Property Detail `/(landlord)/properties/[id]` | "House Rules & Policies" section at the bottom, shows count badge + "Edit Rules" button → navigates to `/(landlord)/properties/[id]/policies` |
| `/(landlord)/properties/[id]/policies` | New screen: list of policy cards with add/edit/delete/reorder. Each card shows title + body preview. Edit inline or via modal. |
| Unit Detail `/(landlord)/properties/[id]/units/[unitId]` | "Unit-Specific Rules" section — same pattern, smaller. Only shows rules where `unit_id` matches. |

### Tenant Side

| Screen | What to add |
|---|---|
| Tenant More `/(tenant)/more` | "House Rules" card below Lease Summary. Lists applicable rules (property-wide + unit-specific). Read-only. Tapping a rule expands the full body. |
| Tenant Home `/(tenant)/index` | Optional secondary link at the very bottom: "View House Rules →". Not a hero card — just a text link. |

### Priority
MVP — tenants frequently ask "what are the rules here?" and there's currently no in-app answer. Low effort to build, high value for reducing landlord-tenant friction.

---

## Pending Fixes — Ready to Build

> Everything in this section has a known, agreed fix. No further discussion needed before implementing. Execute in the order listed.

---

### Step A — Restructure Tenant Tab Screens into Directories

Currently `(tenant)/payments.tsx`, `(tenant)/utilities.tsx`, `(tenant)/maintenance.tsx` are flat files. They need to become directories so detail screens can live inside them as nested Stack routes.

**What to do:**
1. Create `app/(tenant)/payments/_layout.tsx` — Stack, `headerShown: false`
2. Move content of `payments.tsx` → `payments/index.tsx`, delete `payments.tsx`
3. Create `app/(tenant)/utilities/_layout.tsx` — Stack, `headerShown: false`
4. Move content of `utilities.tsx` → `utilities/index.tsx`, delete `utilities.tsx`
5. Create `app/(tenant)/maintenance/_layout.tsx` — Stack, `headerShown: false`
6. Move content of `maintenance.tsx` → `maintenance/index.tsx`, delete `maintenance.tsx`
7. `(tenant)/_layout.tsx` tab names stay the same (`payments`, `utilities`, `maintenance`) — Expo Router resolves directory automatically

**Create these stub detail screens at the same time:**
- `app/(tenant)/payments/[id].tsx` — back button + "Payment Detail — coming soon"
- `app/(tenant)/utilities/[id].tsx` — back button + "Utility Bill — coming soon"
- `app/(tenant)/maintenance/[id].tsx` — back button + "Maintenance Request — coming soon"
- `app/(tenant)/maintenance/new.tsx` — back button + "New Request — coming soon"

---

### Step B — Wire All Dead Buttons on Tenant Home `(tenant)/index.tsx`

All changes are in `app/(tenant)/index.tsx`. Add `useRouter` if not already imported.

| Element | Fix |
|---|---|
| "Upload Payment Receipt" button | `router.push('/(tenant)/payments')` |
| "View all" on Recent Payments | `router.push('/(tenant)/payments')` |
| "View all" on Utility Bills | `router.push('/(tenant)/utilities')` |
| "New Request" maintenance button | `router.push('/(tenant)/maintenance/new')` |
| Individual payment row `onPress` | `` router.push(`/(tenant)/payments/${p.id}`) `` |
| Individual utility bill row | Wrap in `TouchableOpacity`, `` router.push(`/(tenant)/utilities/${b.id}`) `` |
| Individual maintenance row | Already has `TouchableOpacity`, add `` router.push(`/(tenant)/maintenance/${r.id}`) `` |

---

### Step C — Tenant Payments List `(tenant)/payments/index.tsx`

1. **Make rows tappable** — wrap each payment row in `TouchableOpacity`, `` onPress={() => router.push(`/(tenant)/payments/${p.id}`)} ``
2. **Add filter tabs** — same pattern as landlord payments list: All / Pending / Confirmed / Overdue. Filter `payments` array client-side by `status`
3. **Add upload receipt button in header** — small upload icon (`cloud-upload-outline`) top right, `router.push('/(tenant)/payments')` (user selects from list which payment to upload for — actual upload lives on payment detail screen)

---

### Step D — Tenant Maintenance List `(tenant)/maintenance/index.tsx`

1. **Wire "New Request" button** — already exists in header, add `onPress={() => router.push('/(tenant)/maintenance/new')}`
2. **Make rows tappable** — rows already have `TouchableOpacity`, add `` onPress={() => router.push(`/(tenant)/maintenance/${r.id}`)} ``

---

### Step E — Tenant Utilities List `(tenant)/utilities/index.tsx`

1. **Make rows tappable** — wrap each bill row in `TouchableOpacity`, `` onPress={() => router.push(`/(tenant)/utilities/${b.id}`)} ``
2. **Add upload button in header** — `cloud-upload-outline` icon top right, navigates to `/(tenant)/utilities` (tenant selects which bill — actual upload on bill detail screen)

---

### Step F — Landlord Payments List `(landlord)/payments/index.tsx`

1. **Add + button in header** — same style as Properties list (brand circle + icon), `onPress={() => router.push('/(landlord)/payments/record')}`
2. **Fix error state** — replace `<Text style={{ color: '#DC2626' }}>Failed to load payments</Text>` with: icon (`alert-circle-outline`, color `#9CA3AF`) + "Couldn't load payments right now" + "Pull down to try again" in gray text

---

### Step G — Landlord Properties List `(landlord)/properties/index.tsx`

1. **Fix error state** — replace current error view with: icon (`alert-circle-outline`) + "Couldn't load your properties right now" + "Pull down to try again"

---

### Step H — Landlord More `(landlord)/more.tsx`

1. **Notifications row** — remove `onPress` and the chevron icon, make it non-tappable visually (gray out or remove the right arrow). Do not delete the row.
2. **About RentCo row** — same treatment.

---

### Step I — Landlord Maintenance List `(landlord)/maintenance/index.tsx`

1. **Accept `unitId` query param** — read `useLocalSearchParams()` for optional `unitId`, if present filter the fetched requests to only that unit. This enables Unit Detail's Maintenance button to link here with context.

---

### Step J — Landlord Dashboard `(landlord)/index.tsx`

1. **Avatar** — add `onPress={() => router.push('/(landlord)/more')}` to the Avatar `TouchableOpacity`
2. **Alert rows** — wire each alert row's `onPress`:
   - Overdue payments → `router.push('/(landlord)/payments')` (future: pass filter param)
   - Expiring leases → `router.push('/(landlord)/tenants')`
   - Pending confirmations → `router.push('/(landlord)/payments')`

---

## Feature Buckets and Backlog

> Current decision map as of 2026-05-06. Older screen-by-screen notes below are useful history, but this section is the working backlog.

### Setup Gates

| Item | Current status | User action needed |
|---|---|---|
| Supabase SQL 6-10 | User reported these were run | None right now |
| Supabase SQL 11 | Required for tenant maintenance "Confirm Fixed" / "Still Needs Work" | Run SQL 11 before testing those tenant buttons if not already done |
| Supabase SQL 15-16 | Required for property/unit documents, tenant utility receipt uploads, and notification history | Run SQL 15 and SQL 16 before testing those new pieces |
| Supabase SQL 17 | Required for security hardening: private storage, push-token RPC, storage-ref validation, invite binding, payment/utility/unit RPCs, notification sender rate data | Run SQL 17 before testing uploads, parser, push token registration, rent payment transitions, utility paid/unpaid, or unit status changes |
| Supabase SQL 24-26 | Required for Didit identity verification foundation, tenant self-service invite details, and landlord-requested KYC | User reported these were run |
| Supabase SQL 27 | Required for in-app account deletion request submission from Legal & Support | Run SQL 27 before testing account deletion requests |
| Edge functions | User deployed `validate-invite`, `generate-or-pdf`, `parse-utility-bill`, `send-notification` to project `nqvowdysiiuyuclermxx` | Redeploy `parse-utility-bill`, `generate-or-pdf`, and `send-notification` after SQL 17 |
| Edge secrets | User reported `ANTHROPIC_API_KEY` and Expo token already exist in Supabase | None right now |
| Storage buckets | SQL 6 should create buckets and policies | Test one fresh maintenance photo upload; if it still does not appear, debug Storage/document insert next |

### Bucket 1 - Landlord Dashboard

**Built locally**
- Textured brand dashboard hero, raised monthly summary panel, overlapping portfolio card, quick actions, bottom-nav clearance, and `Needs Attention`.
- Summary amounts now avoid wrapping on small screens.
- Alert rows route to payments or tenants.

**Decision needed before more code**
- The current quiet branded footer accent is not strong enough because it is mostly cosmetic.
- Recommended dashboard addition: replace the accent with a functional `Recent Activity` panel. It can show recent payments, maintenance updates, tenant invites, and utility bills using existing tables, so it should not need SQL.
- Alternative: `Upcoming Rent Cycle` panel. More operational, but narrower and less useful when the account has only one unit.

**Backlog**
- Add `Recent Activity` query and panel under `Needs Attention`.
- Add pull-to-refresh across dashboard queries.
- Add inline error states for summary/portfolio/alerts instead of silently showing defaults.
- Notification buttons now route to the in-app notification inbox.

### Bucket 2 - Maintenance Workflow

**Built locally**
- Tenant new-request flow has an in-app success modal and best-effort photo uploads.
- Landlord detail loads tenant-created requests, shows attached photos, and uses in-app modals.
- Landlord marks a request as fixed by moving it to `resolved`; tenant can confirm fixed or send back; landlord can still close as override.
- Landlord maintenance list now has a dedicated Closed filter, shows open/fixed/closed duration text, and includes cleaning/internet category icons.
- Landlord maintenance detail now has tappable Unit, Property, and Reported By rows plus duration context.
- Tenant maintenance detail now shows duration context, and the new-request success modal clearly warns when attachments fail while the request still saves.
- Landlord status changes now go through `update_maintenance_status` RPC with timeout/error handling, so the Mark Fixed modal cannot spin silently forever.
- Maintenance photo taps now open an in-app full-screen image viewer on landlord and tenant detail screens.

**Backlog**
- Verify fresh tenant photo upload after SQL 6. Old requests may have no document row if the original upload failed.
- Add landlord internal notes. This needs a new migration if we choose to store notes on the request.
- Trigger tenant notifications on status changes after push token registration is built.
- Decide whether landlord-created maintenance requests are MVP or post-MVP.

### Bucket 3 - Tenant Invite, Lease, and Tenant Management

**Built locally**
- Invite creation captures lease terms.
- Accepting invite creates lease, lease tenant row, advance rent payment rows, deposit transaction, and marks the unit occupied.
- Unit Detail can preselect a vacant unit for invite.
- Tenant home reads active lease/unit/property after SQL 10.
- Landlord Tenant Detail is now a tabbed control center: Overview, Payments, Maintenance, and Documents.
- Tenant Overview shows contact info, government ID controls, current lease, unit shortcut, rent increase shortcut, and deactivate/reactivate action.
- Tenant Payments and Maintenance tabs show navigable tenant history rows with empty states.
- Tenant Documents tab now pulls tenant-related documents across tenant profile, leases, rent payments, maintenance requests, and utility bills, with image lightbox support.
- Invite Tenant now only asks the landlord for unit assignment and lease terms. Tenant name, phone, and email are collected from the tenant on the join screen and saved during invite acceptance.

**Backlog**
- Invite/join polish: better email-confirmation recovery and clearer deep-link copy.
- Co-tenant management and co-tenant cards.
- Full lease history, not only the current lease summary.

### Bucket 4 - Payments, ORs, and Receipts

**Built locally**
- Landlord can record payment and navigate to created payment.
- Partial payment handling no longer automatically marks every partial as fully paid.
- OR numbering is transaction locked in SQL 8.
- OR PDF generation edge function is deployed and Payment Detail can work with document rows.
- Tenant receipt uploads use document records.
- Landlord Payment Detail now shows tenant receipt thumbnails with an in-app image viewer.
- Landlord Payment Detail now has an Official Receipt card with Open PDF and Share PDF actions.
- Payment amount copy now shows clearer remaining-balance context for partial payments.
- Record Payment now has a searchable active-lease picker, a clear no-active-lease empty state, editable payment date, duplicate-period warning with Open Existing action, and live full/partial/over-rent balance context before saving.
- Payments now have a current-month rent cycle preview and `Post Missing Rent` action that creates pending or overdue rows for active leases without duplicating existing records.
- Payment List and Payment Detail now show overdue context based on the billing period, even if an older row was still stored as pending.

**Backlog**
- Add pull-to-refresh to payment list once the main data workflows settle.

### Bucket 5 - Utilities and AI Parsing

**Built locally**
- Landlord utility upload flow exists.
- `parse-utility-bill` edge function is deployed and auth-hardened.
- Tenant utility detail can upload PDFs.
- Landlord detail reads document rows so tenant-uploaded files can be visible when the upload succeeds.
- Utility bill AI parsing now has a stronger utility-bill extraction prompt, safer PDF encoding for normal bill sizes, JSON cleanup, and clearer error messages.
- Utility upload now uses one cohesive pick -> AI/manual review -> edit -> save flow, then shows an in-app success modal that opens the saved bill.
- Utility review has product-style review/fallback banners and no phone-native confirmation prompt.
- Utility PDF display now prefers `document` rows and only falls back to `utility_bill.bill_pdf_url` when no document row exists, avoiding duplicate "original bill" rows.
- Tenant utility detail now supports payment receipt upload with an in-app image viewer.
- Landlord utility detail now shows tenant utility receipts and can mark confirmed utility bills paid or unpaid using in-app modals.
- Landlord utility list now has Unpaid and Paid filters and shows payment status after bill confirmation.

**Backlog**
- Move fully away from `utility_bill.bill_pdf_url` later; it remains as a compatibility fallback for parser/source PDFs.
- Add utility payment due-date rules if the product needs true overdue utilities later.

### Bucket 6 - Properties and Units

**Built locally**
- Add Property works and routes to detail.
- Add Unit modal works.
- Property detail and Unit detail show real data, active lease/tenant context, occupancy progress, and invite CTA.
- Property detail now has an Edit Property modal for name, address, type, utility provider, and default rate.
- Unit detail now has an Edit Unit modal for unit number, type, floor, and default monthly rent.
- Unit detail now has a status control for vacant/occupied/under maintenance with lease-aware guardrails.
- Unit detail now shows the current-month rent status pill for occupied units.
- Property unit cards now show open maintenance counts.
- Property Detail now has an Income This Month roll-up: expected rent, collected, pending, overdue, and active lease count.
- Unit Detail now has Recent Rent and Recent Utilities panels with tap-through to Payment Detail and Utility Detail.
- Unit quick actions now preselect context for Record Payment and Utility Upload via `leaseId` / `unitId` route params.
- Property Detail and Unit Detail now have central document upload/view cards backed by SQL 15.
- Unit Detail now links directly into the existing Rent Increase flow for occupied units.

**Backlog**
- Co-tenant cards and full lease history remain post-current-pass polish.

### Bucket 7 - Documents, Notifications, and Account

**Built locally**
- Added `expo-notifications` and app boot registration for Expo push tokens into `user_profile.push_token`.
- Added notification tap routing for payloads that include a `route`.
- Added best-effort notification helpers in `lib/notifications.ts`.
- Wired push notifications for:
  - landlord payment record/confirm/mark pending -> tenant
  - tenant receipt upload -> landlord
  - tenant maintenance request -> landlord
  - landlord maintenance status update -> tenant
  - tenant maintenance resolution response -> landlord
  - landlord utility bill post/confirm -> tenant
  - tenant utility PDF upload -> landlord
  - tenant invite acceptance -> landlord
- Added shared document center UI with filters, document rows, image lightbox, in-app PDF/browser opening, and related-record navigation.
- Added Landlord Documents and Tenant Documents screens linked from More.
- Added SQL 13 for tenant visibility into documents attached to their own tenant record.
- Landlord-created utility bill PDFs are indexed into `document` rows so they appear in the document center.
- Added property-level House Rules: SQL 14, landlord create/edit/delete/publish screen, tenant read-only screen, and More links for both roles.
- Added auth/account polish: forgot password, reset password, register confirm password, profile edit modals, and invite welcome property/unit context.
- Added SQL 16 notification history, shared notification inbox UI, landlord/tenant notification screens, More links, dashboard bell routes, and `send-notification` history writes.
- Added SQL 17 security hardening: private storage + signed URL resolution, storage-ref-only new document/bill rows, push-token-only profile RPC, invite user binding, server-side rent/utility/unit transition RPCs, and notification sender rate tracking.
- Added Didit hosted KYC foundation: SQL 24 verification table/RLS, tenant identity screen, landlord tenant-detail verification panel, and `create-didit-session` / `sync-didit-session` / `didit-webhook` edge functions.
- Changed Didit KYC to landlord-requested only: SQL 26 request RPC, landlord Request Verification action, tenant notification deep link, no invite-to-KYC redirect, no general tenant More entry.
- Rebuilt tenant profile/account page: branded account header, avatar-to-profile dashboard entry, contact edit, lease snapshot, documents/house-rules/notifications rows, and conditional KYC row only after landlord request.
- Added Legal & Support for landlord and tenant More: in-app terms/privacy/retention/KYC/third-party/support sections plus SQL 27-backed account deletion request initiation.
- Added `docs/LEGAL_REVIEW_DRAFT.md` as a lawyer-review draft with terms, privacy policy, KYC notice, account deletion web copy, retention placeholders, and app-store checklist.

**Backlog**
- Deactivated screen icon polish.
- Run SQL 27 before testing the Legal & Support account deletion request button.
- Publish a public, non-PDF privacy policy and account deletion URL before App Store / Google Play submission.

### Bucket 8 - Reliability and Tests

**Built locally**
- Added `lib/domain/periods.ts` for current-period, month-label, and future-period rules shared by dashboard/property/tenant screens.
- Added `lib/domain/payments.ts` for dashboard collected/pending/overdue bucket math, including partial-payment remaining balance.
- Added `lib/domain/documents.ts` for document image detection and document center filter matching.
- Added `tests/domain.test.ts` and `npm run test` for period formatting, payment buckets, and document normalization.

**Backlog**
- Add a small Supabase smoke-test checklist for every migration/RPC.
- Centralize maintenance transition helpers in `lib/domain/maintenance.ts`.
- Keep `supabase/.temp/` out of commits unless it contains intentional project metadata.

---

## Smoke Test Checklist

- [ ] Landlord dashboard loads summary, portfolio, quick actions, and no clipped bottom actions.
- [ ] Add Property -> Add Unit -> open Property Detail -> open Unit Detail.
- [ ] Invite Tenant from vacant unit -> accept invite -> tenant lands on assigned unit.
- [ ] Tenant profile uses the signed-in email by default after invite join.
- [ ] Tenant creates maintenance request with photo -> landlord sees photo in lightbox.
- [ ] Landlord marks maintenance fixed -> tenant can confirm fixed or say it still needs work.
- [ ] Record Payment with one active lease auto-selected -> open created payment.
- [ ] Payments -> Post Missing Rent creates current-period rent rows once and does not duplicate them on repeat.
- [ ] Tenant uploads receipt -> landlord sees receipt thumbnail/lightbox.
- [ ] Landlord confirms payment -> OR number and OR PDF actions appear.
- [ ] Upload utility bill -> AI/manual review -> save -> tenant can view/upload PDF.
- [ ] Tenant uploads utility payment receipt -> landlord sees it in Utility Detail and can mark bill paid.
- [ ] Property Detail and Unit Detail can upload a file and it appears in Documents.
- [ ] Notification-triggering actions write rows to Notifications after SQL 16 and `send-notification` redeploy.
- [ ] Documents center filters receipts, bills, maintenance, IDs, and official documents.
- [ ] House Rules publish/edit/delete works for landlord and read-only view works for tenant.
- [ ] Forgot password/reset password deep link reaches the reset screen.
- [ ] Push notification token registers in a development build with `extra.eas.projectId`.

---

## Current Dashboard Recommendation

Replace the dashboard's cosmetic footer accent with `Recent Activity`.

Why: it fills the empty space with something useful, it makes the dashboard feel alive, and it helps landlords answer "what changed since I last opened the app?" without digging through tabs.

Suggested rows:
- Payment recorded or confirmed
- Maintenance request created, marked fixed, reopened, or closed
- Tenant invite created or accepted
- Utility bill uploaded or confirmed

No SQL should be needed for the first version because the app can combine recent rows from existing tables.

---

## Fragility and Overlap Review - Current

| Priority | Finding | Current risk | Recommended fix |
|---|---|---|---|
| P0 | SQL 11 is required by tenant maintenance response UI | Tenant buttons will fail if the RPC is not in Supabase yet | Confirm SQL 11 is run before testing tenant confirmation |
| P0 | SQL 12 is required by landlord maintenance status UI | Landlord Mark Fixed/Close buttons will fail until the new RPC exists in Supabase | Run `supabase/migrations/012_landlord_maintenance_status_rpc.sql` before retesting landlord status changes |
| P1 | Maintenance photo upload is best-effort | Request can save successfully while photo upload fails, so landlord sees no attachment | After fresh photo test, surface attachment upload failures more clearly and log failed document inserts |
| P1 | Dashboard bottom section needs product intent | Cosmetic filler feels disconnected from the actual work landlords do | Replace branded accent with `Recent Activity`, fed by existing payments, maintenance, invites, and utility bills |
| P1 | Sensitive uploads are in public-readable buckets | Fine for early testing, risky for IDs, receipts, leases, and maintenance photos | Later move sensitive files to private buckets and resolve with signed URLs |
| P1 | Status transitions are split between screens and RPCs | Payment and maintenance rules can drift if each screen decides independently | Centralize transition helpers/RPCs for payments and maintenance |
| P2 | Progress file had stale "not started" sections | It caused confusion when deciding what is truly left | Treat this Feature Buckets section as source of truth until older sections are pruned |
| P2 | No automated regression tests yet | Console-only debugging keeps catching DB and routing issues late | Add focused tests/smoke scripts before the next broad feature pass |

---

## Recommended Next Build Order

1. Replace dashboard branded footer accent with `Recent Activity`.
2. Verify maintenance photo upload with a fresh tenant request after SQL 11/SQL 6 are confirmed.
3. Add Payment receipt viewer and OR PDF share/download.
4. Add Utility parsed-review polish and file-source cleanup.
5. Add Edit Property/Edit Unit and unit status controls.
6. Add push-token registration and first notification calls.

---

## Archived Not-Yet-Built Feature Checklist

> Snapshot for review. This is the high-signal backlog after the latest local fixes; older screen-by-screen notes above may include implementation detail or items already ticked off.

### Backend / integrations

- Deploy and wire Supabase Edge Functions: `parse-utility-bill`, `generate-or-pdf`, `send-notification`, `validate-invite`
- Add required Edge Function secrets in Supabase: `ANTHROPIC_API_KEY`, `EXPO_ACCESS_TOKEN`
- Add auth and ownership checks to deployed Edge Functions before using service-role clients
- Wire OR PDF generation to paid payments and attach generated PDFs to `document`
- Register Expo push tokens from the app and call notification workflows from payment, maintenance, and utility updates

### Property and unit workflows

- Edit Property screen or modal: name, address, property type, default utility provider/rate
- Inline edit for default utility rate
- Monthly income roll-up from active leases on Property Detail
- Invite pill directly on vacant unit cards
- Open maintenance count badge on unit cards
- Property/unit documents rows and future document viewer
- Unit Detail rent status pill for current month
- Rent increase CTA/screen from occupied unit detail
- Co-tenant rows styled as tenant cards
- Unit payment-history shortcut filtered to the active lease
- Edit Unit form for unit number/type/floor
- Unit status change bottom sheet for vacant/maintenance states
- Lease creation/assignment during Invite Tenant flow, including dates, rent, deposit, advance months, and unit occupancy update

### Payments

- Receipt thumbnail/viewer on landlord Payment Detail
- Download/share OR PDF button after payment confirmation
- Amount label cleanup for paid and partial payments
- Tappable tenant card from Payment Detail
- Overdue-days context in Payment Detail
- Partial-balance hint and remaining-balance handling
- Record Payment date picker
- Duplicate payment warning
- Searchable tenant/unit or lease picker on Record Payment
- Navigate to newly created payment after recording
- Empty lease guidance in Record Payment

### Maintenance

- Photos/attachments on landlord Maintenance Detail
- Tappable Reported By and Unit rows in Maintenance Detail
- Landlord internal notes field with migration
- Open/resolved duration text
- Notification hint or notification call when status changes
- Closed filter in Maintenance List
- Landlord-created maintenance request screen after MVP scope is confirmed

### Tenant side

- Tenant profile/more polish: deposit balance, landlord contact card, edit contact info, lease-end warning, notifications stub
- Tenant utility upload source-of-truth cleanup so landlord can see and confirm tenant-uploaded files
- Tenant invite/join polish: welcome name, confirm password, and resilient email-confirmation handling

**Recently confirmed built on tenant side:** payment detail with receipt upload, utility detail with PDF upload UI, maintenance detail, new maintenance request with photos, tenant payment/maintenance filters, tappable tenant rows, and future-period Advance badge logic.

### Documents and policies

- Landlord document center
- Tenant document center/file viewer
- Auto-attach OR PDFs, receipts, maintenance photos, utility PDFs, and government IDs to document records with valid `doc_type` values

### Auth and account polish

- Deactivated screen icon polish

### Dashboard and list polish

- Pull-to-refresh on dashboard, property list, and other main lists
- Dashboard summary/portfolio inline error fallbacks
- Wire remaining dashboard alert rows and notification/profile stubs as final navigation pass

---

## Archived Engineering Plan for Unbuilt Buckets

### Phase 0 - Fix blockers before building more UI

1. Fix document `doc_type` mismatches and centralize allowed document types in code.
2. Fix Invite Tenant so it creates or schedules a lease, links the tenant to the unit, and updates unit occupancy through one RPC.
3. Wire `validate-invite` Edge Function or intentionally grant anon execute only to `validate_invite_token`; do not leave Join calling a revoked anon RPC.
4. Decide the single source of truth for uploaded utility PDFs and receipts: either `document` rows or typed columns such as `utility_bill.bill_pdf_url`, then update landlord detail screens to read the same source tenants write.
5. Fix partial payment confirmation so partial payments never become fully `paid` unless the full balance is actually covered.
6. Harden Edge Functions and storage privacy before exposing document/OR/notification workflows.

### Phase 1 - Core money and file workflows

1. Landlord Payment Detail: show tenant-uploaded receipts, correct paid/partial amount labels, add OR PDF generate/download/share, and attach OR PDFs to `document`.
2. Record Payment: date picker, duplicate-period warning, searchable lease picker, remaining-balance handling, navigate to created payment.
3. Utility Bills: make tenant-uploaded files visible to landlord, support confirm/edit from one detail screen, and keep the bill file record consistent.
4. Maintenance: show photos on landlord detail, add tappable reported-by/unit rows, add status notification hook.

### Phase 2 - Property/unit completion

1. Edit Property and default rate.
2. Edit Unit and status-change bottom sheet.
3. Unit current-month rent status pill and payment history shortcut.
4. Rent increase CTA from occupied unit detail.
5. Property income roll-up and open-maintenance count badges.

### Phase 3 - Account, notifications, and docs

1. Forgot password, phone fields, confirm-password fields, invite welcome copy.
2. Push token registration and notification inbox/stubs.
3. Landlord and tenant document centers.
4. House Rules & Policies.

### Phase 4 - Explicitly deferred

Keep these out of MVP unless separately approved: messaging, payment gateway integration, listing export, utility dispute flow, multi-landlord/property-manager accounts, barangay case tracker, contractor ratings, dark mode, analytics dashboards.

---

## Archived Fragility and Overlap Review

| Priority | Finding | Why it matters | Recommended fix |
|---|---|---|---|
| P0 | Invite Tenant duplicates onboarding but does not create a lease or update unit occupancy | A tenant can accept an invite and still have no active lease/unit in tenant home; landlord tenant list also comes from `lease_tenant`, so invited tenants can disappear from the real tenant roster | Replace `create_landlord_invite` with a lease-aware RPC or add a second "Finalize Lease" step before invite is sent. Reuse the `approve_application` lease/payment creation logic instead of keeping a parallel onboarding path |
| P0 | Join screen calls `validate_invite_token` directly, but migration 003 revokes anon execute | Fresh invite links can fail before the tenant signs in | Use the existing `validate-invite` Edge Function for pre-auth validation, or grant anon execute only for the safe validation RPC. Keep `accept_invite_token` authenticated or wrap it in a secure Edge Function |
| P0 | Document `doc_type` values are inconsistent | Tenant utility uploads use `bill`, government IDs use `gov_id_front`/`gov_id_back`, but the schema allows only `utility_bill_pdf`, `gov_id`, etc. Uploads can pass Storage then fail on the DB insert | Add a migration to either allow those values or normalize code to existing values. Then export `DocumentDocType` constants from one module and make `useUploadDocument` accept only those values |
| P0 | Tenant uploads and landlord review screens use different file sources | Tenant utility uploads create `document` rows, but landlord Utility Bill Detail reads only `utility_bill.bill_pdf_url`; tenant receipts create `document` rows, but landlord Payment Detail does not read them yet | Make landlord detail screens use `useDocumentsForEntity`, and decide whether source PDFs live in `document` or typed table columns. Avoid storing the same file in two disconnected places |
| P1 | Partial payment confirmation can incorrectly mark a partial as fully paid | `useConfirmPayment` always sets `status: 'paid'`; Payment Detail allows confirming `partial`. Dashboard then loses the remaining balance because paid rows only count `amount_paid` | For partials, keep `status: 'partial'` and set confirmation/OR metadata for the amount actually paid, or block OR issuance until the remaining balance is recorded. Centralize payment status transitions in an RPC |
| P1 | OR number generation is count-based | Two landlords confirming payments at the same time can race into the same OR number and one fails | Replace `count + 1` with a real yearly sequence/counter row locked with `for update`, or use a Postgres sequence per year with retry handling |
| P1 | Edge Functions use service role without verifying caller ownership | `generate-or-pdf` trusts request-body payment details; `send-notification` accepts arbitrary `user_id`; `parse-utility-bill` can spend API calls for any caller | Require a valid auth JWT, derive user/profile server-side, fetch payment/bill/user rows from Supabase by ID, and check landlord/tenant ownership before side effects |
| P1 | Storage buckets are public-readable, including `documents` | Receipts, government IDs, leases, and maintenance photos can be sensitive | Keep public buckets only for low-risk generated assets if needed. Move `documents` and `receipts` private, store object paths, and use signed URLs through helper functions |
| P2 | Domain rules are duplicated across query files and screens | Period logic, document normalization, file upload, tenant lease lookup, and status labels exist in multiple places, so fixes drift | Add small domain modules: `lib/domain/periods.ts`, `lib/domain/documents.ts`, `lib/domain/payments.ts`, `lib/query/leases.ts`, and reuse them from landlord and tenant screens |
| P2 | No automated tests exist | Money, invites, documents, and RLS have already produced regressions that typecheck/lint cannot catch | Add a minimal test harness before the next money/document pass: pure unit tests for status/period helpers, plus Supabase SQL smoke tests for migrations/RPCs where possible |

---

## Phase 0 Completed Locally

> These are implemented in the local worktree. Supabase migration `008_phase0_invites_payments_documents.sql` was run by the user, and changed Edge Functions were deployed to project `nqvowdysiiuyuclermxx`.

- Invite links now capture lease terms. Accepting the invite creates the lease, lease tenant row, advance payment rows, deposit transaction, and marks the unit occupied.
- Join now validates invite links through the `validate-invite` Edge Function instead of direct anon RPC access.
- Landlord Payment Detail and Utility Bill Detail now read central `document` rows so tenant-uploaded receipts and PDFs are visible.
- Tenant utility bill uploads now use `utility_bill_pdf` consistently.
- Payment confirmation no longer turns a partial payment into fully paid unless `amount_paid >= amount_due`.
- OR numbering now has a transaction lock and landlord ownership checks in migration 008.
- `generate-or-pdf`, `parse-utility-bill`, and `send-notification` now require an authenticated caller and check ownership/scope before using service-role side effects.

## Design Refresh Completed Locally

- Recolored the app from the old forest green brand palette to Steel Ink Blue (`#2F4A7D`, `#1E3158`) with rust CTA accents (`#C34A1A`) and warm hero highlights (`#FFB14A`).
- Updated shared theme tokens, Tailwind tokens, app/splash metadata, RentCo mark/text assets, app icon, favicon, dashboard/list headers, buttons, tabs, banners, cards, and PDF OR header color.
- Kept green only for semantic success states such as paid, confirmed, active, verified, fixed, or completed.
- Extended the landlord main-tab header system into richer dashboard-style headers for Properties, Payments, and More, with page-specific summary panels instead of flat title bars.
- Polished the landlord Payments filter rail into a floating pill container; Properties should move next toward a property-directory layout instead of repeating the home dashboard portfolio snapshot.

## Known Deferred Items (Post-MVP)

Per `CLAUDE.md` — do not build these until explicitly instructed:
- In-app messaging / chat between landlord and tenant
- GCash / Maya payment gateway integration
- OLX / Lamudi / Facebook Marketplace auto-publish
- Utility bill dispute flow
- Multi-landlord / property manager accounts
- Barangay Lupon dispute case tracker
- Contractor ratings and review system
- Dark mode
