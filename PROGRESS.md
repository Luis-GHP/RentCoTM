# RentCoTM — Build Progress

> Last updated: 2026-05-05
> Active branch: `claude/create-brand-guidelines-4u8zD`
> All work is on this single branch. The branch name reflects when the session started, not the scope of work.

---

## How to read this file

- ✅ Done and committed
- 🔲 Not started
- Each section lists the files involved and what specifically was built or needs to be built

---

## 1. Brand Guidelines & Design Tokens ✅

**Files touched:**
- `BRAND_GUIDELINES.md` — created. Covers color palette, typography (Inter), spacing (4pt grid), component specs (buttons, badges, inputs, tabs, rows), iconography (Ionicons outline), screen patterns (landlord white header vs tenant green hero), do's/don'ts
- `constants/theme.ts` — full rewrite: `BrandColors`, `Colors` (semantic aliases), `FontFamily`, `FontSize`, `LineHeight`, `Spacing`, `Radius`, `Shadow`
- `tailwind.config.js` — aligned with theme tokens

**Decisions made:**
- Font: Inter (system-ui fallback)
- Primary color: `#1B3C34` (deep forest green)
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

**All three migrations must be run in order in Supabase Dashboard → SQL Editor.**

### RPC functions (all in 001 + 003)

| Function | Purpose |
|---|---|
| `approve_application(p_application_id)` | Atomic tenant onboarding — creates tenant, lease, lease_tenant, advance payments, deposit record, marks unit occupied, marks application converted |
| `claim_or_number(p_payment_id)` | Issues next sequential OR number (format: OR-YYYY-XXXXXX). Must be called BEFORE confirming payment |
| `void_or_number(p_or_number)` | Marks OR as void. Called if payment confirmation fails after OR was claimed |
| `record_rent_increase(p_lease_id, p_new_rent, p_effective_date)` | Logs to rent_increase_history, checks RA 9653 7% cap, updates lease |
| `validate_invite_token(p_token)` | Called by edge function to check if invite token is valid |
| `accept_invite_token(p_token, p_user_id)` | Marks invite accepted, creates user_profile row for tenant |
| `create_landlord_profile(p_name, p_email)` | Creates landlord row + user_profile row after email sign-up |

### Edge functions (in `supabase/functions/`)

| Function | Status | What it does |
|---|---|---|
| `parse-utility-bill` | ✅ Written, needs deploying | Downloads PDF from Storage, sends to Claude Haiku as base64, returns structured JSON (provider, utility_type, period, kWh, rate, amount, confidence). Returns `anthropic_unavailable` gracefully if API is down |
| `generate-or-pdf` | ✅ Written, needs deploying | Generates A4 Official Receipt PDF using pdf-lib, uploads to `or-pdfs` bucket, returns public URL |
| `send-notification` | ✅ Written, needs deploying | Looks up `push_token` from `user_profile`, sends via Expo Push API, auto-clears token on `DeviceNotRegistered` error |
| `validate-invite` | ✅ Written, needs deploying | Wraps `validate_invite_token` RPC using service role key to bypass RLS |

**Edge functions are written but need to be deployed via Supabase Dashboard → Edge Functions. They are NOT auto-deployed.**

### Storage buckets (set up manually in dashboard)
- `documents` — general file attachments
- `utility-bills` — tenant-uploaded utility bill PDFs
- `receipts` — tenant payment receipt screenshots
- `or-pdfs` — generated Official Receipt PDFs

### Environment
- `.env` — `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` set
- Edge function secrets to set in dashboard: `ANTHROPIC_API_KEY`, `EXPO_ACCESS_TOKEN`

---

## 4. Stub Screens ✅

All screens from the Screen Inventory in `CLAUDE.md` were created as functional stubs before detail work began. Stubs had correct file structure, auth guards, and real data fetching — just no navigation between them.

---

## 5. Detail Screens + Action Flows (IN PROGRESS)

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

### Step 5d — Maintenance detail 🔲 ← NEXT

**Needs building:**
- `useMaintenanceRequest(id)` hook in `lib/query/maintenance.ts` — fetch single request with unit, property, description, all fields
- `useUpdateMaintenanceStatus()` mutation — update status in `maintenance_request`
- `app/(landlord)/maintenance/[id].tsx`:
  - Back button + title (request title)
  - Category icon + priority dot + status badge
  - Unit + property info
  - Description card
  - Status update section — landlord can change status between open/assigned/in_progress/resolved/closed
  - Created date + resolved date (if resolved)

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

### Landlord Dashboard

| Gap | Recommendation |
|---|---|
| Bell icon does nothing | Post-MVP — notifications list not built yet. Remove tappable feel or leave as-is |
| Avatar does nothing | Tap navigates to More/Profile tab |
| Alert rows do nothing | Overdue alert → Payments filtered to overdue. Expiring leases → Tenants. Pending confirmations → Payments filtered to pending |

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

---

### Payments List `/(landlord)/payments`

| Gap | Recommendation | Priority |
|---|---|---|
| No Record Payment button | + button in header navigates to `payments/record` | MVP |
| "Failed to load payments" error | Replace with icon + "Couldn't load payments right now" + "Pull down to try again" | MVP |

---

### Maintenance List `/(landlord)/maintenance`

| Gap | Recommendation | Priority |
|---|---|---|
| Needs `unitId` filter support | Accept optional `unitId` query param, pre-filter list when present. Used by Unit Detail Maintenance button | MVP |

---

### Landlord More `/(landlord)/more`

| Gap | Recommendation | Priority |
|---|---|---|
| Notifications row goes nowhere | Remove chevron, make it non-tappable until notifications screen is built | MVP |
| About RentCo row goes nowhere | Same — remove chevron or wire to a simple static screen | MVP |

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

### Tenant Maintenance List `/(tenant)/maintenance`

| Gap | Recommendation | Priority |
|---|---|---|
| "New Request" button does nothing | Navigate to `/(tenant)/maintenance/new` | MVP |
| Rows not tappable | Navigate to `/(tenant)/maintenance/[id]` | MVP |

---

### Tenant Utilities List `/(tenant)/utilities`

| Gap | Recommendation | Priority |
|---|---|---|
| Rows not tappable | Navigate to `/(tenant)/utilities/[id]` | MVP |
| No Upload Bill button | Upload icon in header → `/(tenant)/utilities/[id]` (user selects which bill) | MVP |

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
| Individual payment row `onPress` | `router.push('/(tenant)/payments/${p.id}')` |
| Individual utility bill row | Wrap in `TouchableOpacity`, `router.push('/(tenant)/utilities/${b.id}')` |
| Individual maintenance row | Already has `TouchableOpacity`, add `router.push('/(tenant)/maintenance/${r.id}')` |

---

### Step C — Tenant Payments List `(tenant)/payments/index.tsx`

1. **Make rows tappable** — wrap each payment row in `TouchableOpacity`, `onPress={() => router.push('/(tenant)/payments/${p.id}')}`
2. **Add filter tabs** — same pattern as landlord payments list: All / Pending / Confirmed / Overdue. Filter `payments` array client-side by `status`
3. **Add upload receipt button in header** — small upload icon (`cloud-upload-outline`) top right, `router.push('/(tenant)/payments')` (user selects from list which payment to upload for — actual upload lives on payment detail screen)

---

### Step D — Tenant Maintenance List `(tenant)/maintenance/index.tsx`

1. **Wire "New Request" button** — already exists in header, add `onPress={() => router.push('/(tenant)/maintenance/new')}`
2. **Make rows tappable** — rows already have `TouchableOpacity`, add `onPress={() => router.push('/(tenant)/maintenance/${r.id}')}`

---

### Step E — Tenant Utilities List `(tenant)/utilities/index.tsx`

1. **Make rows tappable** — wrap each bill row in `TouchableOpacity`, `onPress={() => router.push('/(tenant)/utilities/${b.id}')}`
2. **Add upload button in header** — `cloud-upload-outline` icon top right, navigates to `/(tenant)/utilities` (tenant selects which bill — actual upload on bill detail screen)

---

### Step F — Landlord Payments List `(landlord)/payments/index.tsx`

1. **Add + button in header** — same style as Properties list (green circle + icon), `onPress={() => router.push('/(landlord)/payments/record')}`
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
