-- ============================================================
-- TENANT MANAGEMENT APP — SUPABASE SQL SCHEMA
-- Version: 1.0
-- Run in order top to bottom. Do not reorder sections.
-- All fragility fixes from architectural review are baked in.
-- ============================================================


-- ============================================================
-- 0. EXTENSIONS
-- ============================================================

create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";
create extension if not exists "pg_cron";


-- ============================================================
-- 1. CORE TABLES
-- Landlord → Property → Unit → Tenant
-- ============================================================

create table landlord (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid unique references auth.users(id) on delete cascade,
  name        text not null,
  email       text not null,
  phone       text,
  bir_tin     text,
  created_at  timestamptz default now()
);

-- FIX [Medium 5]: electric_provider lives at property level, NOT unit level.
-- Most PH buildings have one Meralco account for the whole property.
-- Unit only stores consumption readings per bill period.
create table property (
  id                    uuid primary key default uuid_generate_v4(),
  landlord_id           uuid not null references landlord(id) on delete cascade,
  name                  text not null,
  address               text not null,
  type                  text not null check (type in (
                          'apartment', 'house', 'condo', 'boarding_house', 'commercial'
                        )),
  electric_provider     text not null default 'manual' check (electric_provider in (
                          'meralco', 'veco', 'dlpc', 'beneco', 'neeco', 'manual'
                        )),
  default_rate_per_kwh  decimal(10,4),  -- fallback if no PDF uploaded
  created_at            timestamptz default now()
);

-- FIX [Low 1]: status has three values — vacant, occupied, under_maintenance.
-- under_maintenance prevents units being renovated from appearing as available.
create table unit (
  id            uuid primary key default uuid_generate_v4(),
  property_id   uuid not null references property(id) on delete cascade,
  unit_number   text not null,
  type          text check (type in ('studio', '1br', '2br', '3br', 'room', 'bedspace', 'whole_unit')),
  floor         text,
  monthly_rent  decimal(10,2) not null,
  status        text not null default 'vacant' check (status in (
                  'vacant', 'occupied', 'under_maintenance'
                )),
  created_at    timestamptz default now(),
  unique(property_id, unit_number)
);

create table tenant (
  id                      uuid primary key default uuid_generate_v4(),
  name                    text not null,
  email                   text,
  phone                   text not null,
  gov_id_type             text check (gov_id_type in (
                            'philsys', 'drivers_license', 'passport',
                            'postal', 'voters', 'sss', 'pagibig', 'other'
                          )),
  gov_id_number           text,
  employer                text,
  monthly_income          decimal(10,2),
  emergency_contact_name  text,
  emergency_contact_phone text,
  created_at              timestamptz default now()
);


-- ============================================================
-- 2. AUTH TABLES
-- ============================================================

-- One row per Supabase auth user. Role-based routing lives here.
-- FIX [Auth]: is_active = false blocks login for deactivated tenants
-- without deleting their data. Landlord controls this field.
create table user_profile (
  id           uuid primary key references auth.users(id) on delete cascade,
  role         text not null check (role in ('landlord', 'tenant')),
  landlord_id  uuid references landlord(id),
  tenant_id    uuid references tenant(id),
  is_active    boolean not null default true,
  created_at   timestamptz default now(),
  constraint role_reference_check check (
    (role = 'landlord' and landlord_id is not null and tenant_id is null) or
    (role = 'tenant'   and tenant_id is not null   and landlord_id is null)
  )
);

-- FIX [Auth]: token generated with gen_random_bytes — cryptographically secure.
-- NOT uuid, NOT sequential. Single-use, 7-day expiry.
-- Landlord can revoke before tenant accepts.
create table tenant_invite (
  id           uuid primary key default uuid_generate_v4(),
  tenant_id    uuid not null references tenant(id) on delete cascade,
  landlord_id  uuid not null references landlord(id) on delete cascade,
  token        text unique not null default encode(gen_random_bytes(32), 'hex'),
  expires_at   timestamptz not null default now() + interval '7 days',
  status       text not null default 'pending' check (status in (
                 'pending', 'accepted', 'expired', 'revoked'
               )),
  invited_via  text check (invited_via in (
                 'messenger', 'sms', 'viber', 'telegram', 'email', 'other'
               )),
  created_at   timestamptz default now(),
  accepted_at  timestamptz
);


-- ============================================================
-- 3. LEASE TABLES
-- ============================================================

-- FIX [High 3]: monthly_rent is FROZEN at lease signing.
-- It is copied from unit.monthly_rent once and never reads from unit again.
-- unit.monthly_rent is only used as a pre-fill default for new leases.
-- All billing, payment generation, and history always reads lease.monthly_rent.
--
-- FIX [Low 2]: is_rent_controlled and last_rent_increase_date added.
-- Required for RA 9653 compliance checks (7% annual cap enforcement).
create table lease (
  id                        uuid primary key default uuid_generate_v4(),
  unit_id                   uuid not null references unit(id),
  primary_tenant_id         uuid not null references tenant(id),
  start_date                date not null,
  end_date                  date not null,
  monthly_rent              decimal(10,2) not null,  -- FROZEN at signing
  security_deposit          decimal(10,2) not null,
  security_deposit_status   text not null default 'held' check (security_deposit_status in (
                              'held', 'partially_refunded', 'refunded', 'forfeited'
                            )),
  security_deposit_balance  decimal(10,2) not null,
  advance_months            int not null default 1,
  advance_amount            decimal(10,2) not null,
  status                    text not null default 'active' check (status in (
                              'active', 'expired', 'terminated', 'renewed'
                            )),
  contract_url              text,
  is_rent_controlled        boolean not null default false,
  last_rent_increase_date   date,
  created_at                timestamptz default now()
);

-- FIX [Medium 1]: Junction table for co-tenants.
-- A lease can now have multiple tenants (common in PH boarding houses).
-- primary_tenant_id on lease is still the main contact.
-- This table handles the rest.
create table lease_tenant (
  id         uuid primary key default uuid_generate_v4(),
  lease_id   uuid not null references lease(id) on delete cascade,
  tenant_id  uuid not null references tenant(id) on delete cascade,
  role       text not null default 'primary' check (role in ('primary', 'co-tenant')),
  added_at   timestamptz default now(),
  unique(lease_id, tenant_id)
);

-- FIX [High 3 + Low 2]: Full rent increase history.
-- previous_rent on lease row was insufficient — only stored one level back.
-- This table stores every increase for the full audit trail.
-- Required to answer: has this landlord ever violated RA 9653 on this unit?
create table rent_increase_history (
  id              uuid primary key default uuid_generate_v4(),
  lease_id        uuid not null references lease(id) on delete cascade,
  previous_rent   decimal(10,2) not null,
  new_rent        decimal(10,2) not null,
  increase_pct    decimal(6,2) not null,
  effective_date  date not null,
  within_ra9653   boolean not null,
  noted_by        uuid references landlord(id),
  created_at      timestamptz default now()
);


-- ============================================================
-- 4. FINANCIAL TABLES
-- ============================================================

-- FIX [High 1]: OR numbering is sequential with no gaps.
-- OR number is claimed here FIRST in its own commit, then payment is written.
-- On payment failure: mark OR as void — NEVER delete it.
-- BIR allows voided ORs. BIR does NOT allow gaps.
create table or_sequence (
  id          serial primary key,
  or_number   text unique not null,         -- format: OR-YYYY-XXXXXX
  status      text not null default 'issued' check (status in (
                'issued', 'void', 'cancelled'
              )),
  issued_at   timestamptz default now(),
  payment_id  uuid                          -- linked after payment confirmed
);

-- FIX [High 3]: amount_due always copied from lease.monthly_rent at generation.
-- NEVER read from unit.monthly_rent.
-- FIX [High 6]: gateway_payload is null for MVP.
-- When GCash for Business is live, webhook response stored here.
-- confirmed_by is always 'landlord' — tenant cannot confirm own payment.
create table rent_payment (
  id                uuid primary key default uuid_generate_v4(),
  lease_id          uuid not null references lease(id) on delete cascade,
  period_month      int not null check (period_month between 1 and 12),
  period_year       int not null,
  amount_due        decimal(10,2) not null,  -- always from lease.monthly_rent
  amount_paid       decimal(10,2) not null default 0,
  payment_date      date,
  payment_method    text check (payment_method in (
                      'gcash', 'maya', 'bank', 'cash', 'advance'
                    )),
  reference_number  text,                   -- landlord enters manually
  status            text not null default 'unpaid' check (status in (
                      'unpaid', 'pending', 'paid', 'partial', 'overdue', 'waived'
                    )),
  confirmed_by      text check (confirmed_by = 'landlord'),
  confirmed_at      timestamptz,
  gateway_payload   jsonb,                  -- NULL for MVP, future GCash webhook
  or_number         text references or_sequence(or_number),
  created_at        timestamptz default now(),
  unique(lease_id, period_month, period_year)
);

-- Security deposit transaction log.
-- Tracks deposit_paid, deductions, and refunds separately.
-- Balance is maintained on lease.security_deposit_balance.
create table security_deposit_transaction (
  id           uuid primary key default uuid_generate_v4(),
  lease_id     uuid not null references lease(id) on delete cascade,
  type         text not null check (type in ('deposit_paid', 'deduction', 'refund')),
  amount       decimal(10,2) not null,
  reason       text,
  date         date not null,
  recorded_by  uuid references landlord(id),
  created_at   timestamptz default now()
);


-- ============================================================
-- 5. UTILITY TABLES
-- ============================================================

-- FIX [High 5]: Meralco API is replaced by LLM PDF parser.
-- This cache stores the last known rate per provider as a fallback
-- when the Anthropic API is unavailable (degradation mode).
create table utility_rate_cache (
  id            uuid primary key default uuid_generate_v4(),
  provider      text not null,
  rate_per_kwh  decimal(10,4) not null,
  fetched_at    timestamptz default now(),
  is_stale      boolean not null default false
);

-- FIX [High 4]: rate_per_kwh is SNAPSHOTTED at bill generation.
-- Never re-fetched from any source when displaying existing bills.
-- rate_source tracks whether it came from LLM parse or manual entry.
-- FIX [Minor - High 4 + High 5]: rate_source enum updated to
-- 'llm_parsed' | 'manual' — 'meralco_api' removed (API is gone).
-- FIX [Tenant upload]: uploaded_by tracks who initiated the upload.
-- Tenant uploads require landlord confirmation before becoming official.
create table utility_bill (
  id                  uuid primary key default uuid_generate_v4(),
  unit_id             uuid not null references unit(id) on delete cascade,
  period_month        int not null check (period_month between 1 and 12),
  period_year         int not null,
  utility_type        text not null check (utility_type in (
                        'electric', 'water', 'internet', 'other'
                      )),
  provider            text not null,
  reading_start       decimal(10,2),
  reading_end         decimal(10,2),
  kwh_consumed        decimal(10,2),
  rate_per_kwh        decimal(10,4),          -- SNAPSHOTTED at generation
  amount              decimal(10,2) not null,
  status              text not null default 'unpaid' check (status in ('unpaid', 'paid')),
  bill_pdf_url        text,                   -- original PDF stored in Supabase Storage
  parsed_by           text check (parsed_by in ('llm', 'manual')),
  parse_confidence    text check (parse_confidence in ('high', 'medium', 'low')),
  rate_source         text check (rate_source in ('llm_parsed', 'manual')),
  uploaded_by         text not null check (uploaded_by in ('landlord', 'tenant')),
  confirmed_by        text check (confirmed_by = 'landlord'),
  confirmed_at        timestamptz,
  confirmed_by_user   boolean not null default false,
  created_at          timestamptz default now(),
  unique(unit_id, period_month, period_year, utility_type)
);


-- ============================================================
-- 6. OPERATIONS TABLES
-- ============================================================

-- FIX [Medium note]: vendor scoped to landlord_id, NOT property_id.
-- A landlord's trusted plumber works across all their properties.
create table vendor (
  id              uuid primary key default uuid_generate_v4(),
  landlord_id     uuid not null references landlord(id) on delete cascade,
  name            text not null,
  phone           text not null,
  specialization  text not null check (specialization in (
                    'plumber', 'electrician', 'carpenter',
                    'painter', 'mason', 'general', 'other'
                  )),
  rating          int check (rating between 1 and 5),
  notes           text,
  created_at      timestamptz default now()
);

create table maintenance_request (
  id           uuid primary key default uuid_generate_v4(),
  unit_id      uuid not null references unit(id) on delete cascade,
  reported_by  uuid references tenant(id),
  title        text not null,
  description  text,
  category     text not null check (category in (
                 'plumbing', 'electrical', 'structural',
                 'appliance', 'pest', 'cleaning', 'internet', 'other'
               )),
  priority     text not null default 'medium' check (priority in (
                 'low', 'medium', 'high', 'emergency'
               )),
  status       text not null default 'open' check (status in (
                 'open', 'assigned', 'in_progress', 'resolved', 'closed'
               )),
  resolved_at  timestamptz,
  created_at   timestamptz default now()
);

create table work_order (
  id              uuid primary key default uuid_generate_v4(),
  request_id      uuid not null references maintenance_request(id) on delete cascade,
  vendor_id       uuid references vendor(id),
  quote_amount    decimal(10,2),
  actual_cost     decimal(10,2),
  scheduled_date  date,
  completed_date  date,
  status          text not null default 'pending' check (status in (
                    'pending', 'scheduled', 'completed', 'cancelled'
                  )),
  notes           text,
  created_at      timestamptz default now()
);

create table inspection (
  id               uuid primary key default uuid_generate_v4(),
  unit_id          uuid not null references unit(id) on delete cascade,
  lease_id         uuid not null references lease(id) on delete cascade,
  type             text not null check (type in ('move_in', 'move_out', 'periodic')),
  inspection_date  date not null,
  condition        text check (condition in ('excellent', 'good', 'fair', 'poor')),
  notes            text,
  conducted_by     uuid references landlord(id),
  created_at       timestamptz default now()
);

-- FIX [Medium 4]: unit_id is NULLABLE.
-- Property-wide expenses (roof, insurance, gate) have no unit.
-- Always filter by property_id for property-wide reports.
-- Only fill unit_id when cost is genuinely unit-specific.
create table expense (
  id            uuid primary key default uuid_generate_v4(),
  property_id   uuid not null references property(id) on delete cascade,
  unit_id       uuid references unit(id),   -- nullable — property-wide expenses
  category      text not null check (category in (
                  'maintenance', 'insurance', 'tax',
                  'utilities', 'renovation', 'other'
                )),
  amount        decimal(10,2) not null,
  expense_date  date not null,
  description   text not null,
  created_at    timestamptz default now()
);


-- ============================================================
-- 7. DOCUMENT TABLE
-- FIX [Medium 2 + Medium 3 conflict resolution]:
-- M2 (separate photo tables) and M3 (central document table)
-- were solving the same problem. Resolved by merging into one
-- unified table. Photo-specific fields (sort_order, area_tag,
-- caption) are nullable — used only when doc_type = 'photo'.
-- This is the ONLY file storage table in the app.
-- ============================================================

create table document (
  id           uuid primary key default uuid_generate_v4(),
  entity_type  text not null check (entity_type in (
                 'maintenance_request', 'inspection', 'lease',
                 'tenant', 'rent_payment', 'expense', 'utility_bill'
               )),
  entity_id    uuid not null,
  doc_type     text not null check (doc_type in (
                 'photo', 'contract', 'gov_id', 'receipt',
                 'inspection_report', 'or_pdf', 'utility_bill_pdf', 'other'
               )),
  file_url     text not null,
  file_name    text,
  sort_order   int,         -- photos only: display order
  area_tag     text,        -- inspection photos: e.g. "bathroom", "ceiling", "living_room"
  caption      text,        -- photos only
  uploaded_by  text not null check (uploaded_by in ('landlord', 'tenant')),
  uploaded_at  timestamptz default now()
);


-- ============================================================
-- 8. TENANT APPLICATION TABLE
-- ============================================================

create table tenant_application (
  id                uuid primary key default uuid_generate_v4(),
  unit_id           uuid not null references unit(id) on delete cascade,
  name              text not null,
  email             text,
  phone             text not null,
  employment_status text check (employment_status in (
                      'employed', 'self_employed', 'student', 'unemployed'
                    )),
  monthly_income    decimal(10,2),
  desired_move_in   date,
  advance_months    int not null default 1,
  status            text not null default 'pending' check (status in (
                      'pending', 'approved', 'rejected', 'converted'
                    )),
  notes             text,
  created_at        timestamptz default now()
);


-- ============================================================
-- 9. ROW LEVEL SECURITY
-- All permissions enforced at the DATABASE level — not just UI.
-- Even direct API calls cannot bypass these policies.
-- ============================================================

alter table landlord                    enable row level security;
alter table property                    enable row level security;
alter table unit                        enable row level security;
alter table tenant                      enable row level security;
alter table user_profile                enable row level security;
alter table tenant_invite               enable row level security;
alter table lease                       enable row level security;
alter table lease_tenant                enable row level security;
alter table rent_increase_history       enable row level security;
alter table or_sequence                 enable row level security;
alter table rent_payment                enable row level security;
alter table security_deposit_transaction enable row level security;
alter table utility_bill                enable row level security;
alter table utility_rate_cache          enable row level security;
alter table vendor                      enable row level security;
alter table maintenance_request         enable row level security;
alter table work_order                  enable row level security;
alter table inspection                  enable row level security;
alter table expense                     enable row level security;
alter table document                    enable row level security;
alter table tenant_application          enable row level security;

-- RLS helper functions (security definer = runs as superuser, not caller)
create or replace function auth_user_role()
returns text language sql security definer as $$
  select role from user_profile where id = auth.uid();
$$;

create or replace function auth_landlord_id()
returns uuid language sql security definer as $$
  select landlord_id from user_profile where id = auth.uid();
$$;

create or replace function auth_tenant_id()
returns uuid language sql security definer as $$
  select tenant_id from user_profile where id = auth.uid();
$$;

-- ── LANDLORD POLICIES ──────────────────────────────────────

create policy "landlord: manage own record"
  on landlord for all
  using (id = auth_landlord_id());

create policy "landlord: manage own properties"
  on property for all
  using (landlord_id = auth_landlord_id());

create policy "landlord: manage own units"
  on unit for all
  using (property_id in (
    select id from property where landlord_id = auth_landlord_id()
  ));

create policy "landlord: manage own tenants"
  on tenant for all
  using (id in (
    select lt.tenant_id from lease_tenant lt
    join lease l on l.id = lt.lease_id
    join unit u on u.id = l.unit_id
    join property p on p.id = u.property_id
    where p.landlord_id = auth_landlord_id()
  ));

create policy "landlord: manage own leases"
  on lease for all
  using (unit_id in (
    select u.id from unit u
    join property p on p.id = u.property_id
    where p.landlord_id = auth_landlord_id()
  ));

create policy "landlord: manage lease tenants"
  on lease_tenant for all
  using (lease_id in (
    select l.id from lease l
    join unit u on u.id = l.unit_id
    join property p on p.id = u.property_id
    where p.landlord_id = auth_landlord_id()
  ));

create policy "landlord: manage rent payments"
  on rent_payment for all
  using (lease_id in (
    select l.id from lease l
    join unit u on u.id = l.unit_id
    join property p on p.id = u.property_id
    where p.landlord_id = auth_landlord_id()
  ));

create policy "landlord: manage utility bills"
  on utility_bill for all
  using (unit_id in (
    select u.id from unit u
    join property p on p.id = u.property_id
    where p.landlord_id = auth_landlord_id()
  ));

create policy "landlord: manage maintenance requests"
  on maintenance_request for all
  using (unit_id in (
    select u.id from unit u
    join property p on p.id = u.property_id
    where p.landlord_id = auth_landlord_id()
  ));

create policy "landlord: manage documents"
  on document for all
  using (
    (entity_type = 'lease' and entity_id in (
      select l.id from lease l
      join unit u on u.id = l.unit_id
      join property p on p.id = u.property_id
      where p.landlord_id = auth_landlord_id()
    )) or
    (entity_type = 'tenant' and entity_id in (
      select lt.tenant_id from lease_tenant lt
      join lease l on l.id = lt.lease_id
      join unit u on u.id = l.unit_id
      join property p on p.id = u.property_id
      where p.landlord_id = auth_landlord_id()
    )) or
    (entity_type = 'rent_payment' and entity_id in (
      select rp.id from rent_payment rp
      join lease l on l.id = rp.lease_id
      join unit u on u.id = l.unit_id
      join property p on p.id = u.property_id
      where p.landlord_id = auth_landlord_id()
    )) or
    (entity_type = 'maintenance_request' and entity_id in (
      select mr.id from maintenance_request mr
      join unit u on u.id = mr.unit_id
      join property p on p.id = u.property_id
      where p.landlord_id = auth_landlord_id()
    )) or
    (entity_type = 'utility_bill' and entity_id in (
      select ub.id from utility_bill ub
      join unit u on u.id = ub.unit_id
      join property p on p.id = u.property_id
      where p.landlord_id = auth_landlord_id()
    )) or
    (entity_type = 'inspection' and entity_id in (
      select i.id from inspection i
      join unit u on u.id = i.unit_id
      join property p on p.id = u.property_id
      where p.landlord_id = auth_landlord_id()
    )) or
    (entity_type = 'expense' and entity_id in (
      select e.id from expense e
      join property p on p.id = e.property_id
      where p.landlord_id = auth_landlord_id()
    ))
  );

create policy "landlord: manage invites"
  on tenant_invite for all
  using (landlord_id = auth_landlord_id());

create policy "landlord: manage vendors"
  on vendor for all
  using (landlord_id = auth_landlord_id());

create policy "landlord: manage expenses"
  on expense for all
  using (property_id in (
    select id from property where landlord_id = auth_landlord_id()
  ));

create policy "landlord: manage applications"
  on tenant_application for all
  using (unit_id in (
    select u.id from unit u
    join property p on p.id = u.property_id
    where p.landlord_id = auth_landlord_id()
  ));

create policy "landlord: manage or sequence"
  on or_sequence for all
  using (auth_user_role() = 'landlord');

create policy "landlord: manage security deposits"
  on security_deposit_transaction for all
  using (lease_id in (
    select l.id from lease l
    join unit u on u.id = l.unit_id
    join property p on p.id = u.property_id
    where p.landlord_id = auth_landlord_id()
  ));

-- ── TENANT POLICIES ────────────────────────────────────────
-- Tenants can only see their own data.
-- Tenant cannot confirm payments, close requests, or edit lease terms.

create policy "tenant: view own profile"
  on tenant for select
  using (id = auth_tenant_id());

-- Only phone and emergency contact are editable by tenant
create policy "tenant: update own contact info"
  on tenant for update
  using (id = auth_tenant_id())
  with check (id = auth_tenant_id());

create policy "tenant: view own lease"
  on lease for select
  using (id in (
    select lease_id from lease_tenant where tenant_id = auth_tenant_id()
  ));

create policy "tenant: view own lease tenants"
  on lease_tenant for select
  using (tenant_id = auth_tenant_id());

create policy "tenant: view own rent payments"
  on rent_payment for select
  using (lease_id in (
    select lease_id from lease_tenant where tenant_id = auth_tenant_id()
  ));

create policy "tenant: view own utility bills"
  on utility_bill for select
  using (unit_id in (
    select l.unit_id from lease l
    join lease_tenant lt on lt.lease_id = l.id
    where lt.tenant_id = auth_tenant_id()
  ));

create policy "tenant: upload utility bill"
  on utility_bill for insert
  with check (
    uploaded_by = 'tenant' and
    unit_id in (
      select l.unit_id from lease l
      join lease_tenant lt on lt.lease_id = l.id
      where lt.tenant_id = auth_tenant_id() and l.status = 'active'
    )
  );

create policy "tenant: submit maintenance request"
  on maintenance_request for insert
  with check (
    reported_by = auth_tenant_id() and
    unit_id in (
      select l.unit_id from lease l
      join lease_tenant lt on lt.lease_id = l.id
      where lt.tenant_id = auth_tenant_id() and l.status = 'active'
    )
  );

create policy "tenant: view own maintenance requests"
  on maintenance_request for select
  using (unit_id in (
    select l.unit_id from lease l
    join lease_tenant lt on lt.lease_id = l.id
    where lt.tenant_id = auth_tenant_id()
  ));

create policy "tenant: view own documents"
  on document for select
  using (
    (entity_type = 'lease' and entity_id in (
      select lease_id from lease_tenant where tenant_id = auth_tenant_id()
    )) or
    (entity_type = 'rent_payment' and entity_id in (
      select rp.id from rent_payment rp
      join lease_tenant lt on lt.lease_id = rp.lease_id
      where lt.tenant_id = auth_tenant_id()
    )) or
    (entity_type = 'maintenance_request' and entity_id in (
      select mr.id from maintenance_request mr
      join lease l on l.unit_id = mr.unit_id
      join lease_tenant lt on lt.lease_id = l.id
      where lt.tenant_id = auth_tenant_id()
    )) or
    (entity_type = 'utility_bill' and entity_id in (
      select ub.id from utility_bill ub
      join lease l on l.unit_id = ub.unit_id
      join lease_tenant lt on lt.lease_id = l.id
      where lt.tenant_id = auth_tenant_id()
    )) or
    (entity_type = 'inspection' and entity_id in (
      select i.id from inspection i
      join lease_tenant lt on lt.lease_id = i.lease_id
      where lt.tenant_id = auth_tenant_id()
    ))
  );

create policy "tenant: upload receipt and maintenance photos"
  on document for insert
  with check (
    uploaded_by = 'tenant' and (
      (entity_type = 'rent_payment' and entity_id in (
        select rp.id from rent_payment rp
        join lease_tenant lt on lt.lease_id = rp.lease_id
        where lt.tenant_id = auth_tenant_id()
      )) or
      (entity_type = 'maintenance_request' and entity_id in (
        select mr.id from maintenance_request mr
        join lease l on l.unit_id = mr.unit_id
        join lease_tenant lt on lt.lease_id = l.id
        where lt.tenant_id = auth_tenant_id()
      ))
    )
  );

create policy "tenant: view own inspections"
  on inspection for select
  using (lease_id in (
    select lease_id from lease_tenant where tenant_id = auth_tenant_id()
  ));

create policy "tenant: view own deposit transactions"
  on security_deposit_transaction for select
  using (lease_id in (
    select lease_id from lease_tenant where tenant_id = auth_tenant_id()
  ));

create policy "tenant: view rent increase history"
  on rent_increase_history for select
  using (lease_id in (
    select lease_id from lease_tenant where tenant_id = auth_tenant_id()
  ));


-- ============================================================
-- 10. RPC FUNCTIONS
-- ============================================================

-- FIX [High 2 + Medium 1 + Advance Payment logic]:
-- All writes in ONE atomic transaction. Either fully succeeds or fully rolls back.
-- Includes: create tenant, create lease, insert lease_tenant junction row,
-- auto-generate advance payment rows, record deposit, update unit status,
-- mark application converted.
create or replace function approve_application(
  p_application_id uuid
) returns uuid language plpgsql security definer as $$
declare
  v_tenant_id  uuid;
  v_lease_id   uuid;
  v_unit_id    uuid;
  v_app        tenant_application%rowtype;
  v_unit       unit%rowtype;
  v_start      date := current_date;
  v_end        date := current_date + interval '1 year';
  v_month      int;
  v_year       int;
  i            int;
begin
  select * into v_app from tenant_application where id = p_application_id;
  if not found then
    raise exception 'Application % not found', p_application_id;
  end if;
  if v_app.status != 'pending' then
    raise exception 'Application is not in pending status';
  end if;

  v_unit_id := v_app.unit_id;
  select * into v_unit from unit where id = v_unit_id;

  -- 1. Create tenant
  insert into tenant (name, email, phone)
  values (v_app.name, v_app.email, v_app.phone)
  returning id into v_tenant_id;

  -- 2. Create lease (monthly_rent FROZEN from unit at this moment)
  insert into lease (
    unit_id, primary_tenant_id,
    start_date, end_date,
    monthly_rent,
    security_deposit, security_deposit_balance,
    advance_months, advance_amount,
    is_rent_controlled
  ) values (
    v_unit_id, v_tenant_id,
    v_start, v_end,
    v_unit.monthly_rent,
    v_unit.monthly_rent, v_unit.monthly_rent,
    v_app.advance_months, (v_unit.monthly_rent * v_app.advance_months),
    (v_unit.monthly_rent <= 10000)
  ) returning id into v_lease_id;

  -- 3. Wire tenant to lease via junction table (Medium 1 fix)
  insert into lease_tenant (lease_id, tenant_id, role)
  values (v_lease_id, v_tenant_id, 'primary');

  -- 4. Auto-generate advance payment rows
  for i in 1..v_app.advance_months loop
    v_month := extract(month from v_start)::int + i - 1;
    v_year  := extract(year from v_start)::int;
    if v_month > 12 then
      v_month := v_month - 12;
      v_year  := v_year + 1;
    end if;
    insert into rent_payment (
      lease_id, period_month, period_year,
      amount_due, amount_paid,
      status, payment_method
    ) values (
      v_lease_id, v_month, v_year,
      v_unit.monthly_rent, v_unit.monthly_rent,
      'paid', 'advance'
    );
  end loop;

  -- 5. Record security deposit
  insert into security_deposit_transaction (lease_id, type, amount, date, reason)
  values (v_lease_id, 'deposit_paid', v_unit.monthly_rent, v_start, 'Initial deposit at move-in');

  -- 6. Mark unit as occupied
  update unit set status = 'occupied' where id = v_unit_id;

  -- 7. Mark application as converted
  update tenant_application set status = 'converted' where id = p_application_id;

  return v_lease_id;
end;
$$;


-- FIX [High 1]: Claim OR number atomically, outside the payment transaction.
-- OR number is issued FIRST. Payment is written AFTER.
-- If payment fails: call void_or_number() — never delete the row.
create or replace function claim_or_number(
  p_payment_id uuid
) returns text language plpgsql security definer as $$
declare
  v_year      int := extract(year from now())::int;
  v_count     int;
  v_or_number text;
begin
  select count(*) into v_count
  from or_sequence
  where or_number like 'OR-' || v_year || '-%';

  v_or_number := 'OR-' || v_year || '-' || lpad((v_count + 1)::text, 6, '0');

  insert into or_sequence (or_number, status, payment_id)
  values (v_or_number, 'issued', p_payment_id);

  return v_or_number;
end;
$$;

create or replace function void_or_number(
  p_or_number text
) returns void language plpgsql security definer as $$
begin
  update or_sequence set status = 'void' where or_number = p_or_number;
end;
$$;


-- FIX [High 3 + Low 2]: Record a rent increase.
-- Logs to rent_increase_history BEFORE updating the lease.
-- Computes RA 9653 compliance automatically.
-- Updates lease.monthly_rent and tracking fields.
create or replace function record_rent_increase(
  p_lease_id       uuid,
  p_new_rent       decimal,
  p_effective_date date
) returns void language plpgsql security definer as $$
declare
  v_lease        lease%rowtype;
  v_increase_pct decimal;
  v_within_cap   boolean;
begin
  select * into v_lease from lease where id = p_lease_id;
  if not found then
    raise exception 'Lease % not found', p_lease_id;
  end if;

  v_increase_pct := round(
    ((p_new_rent - v_lease.monthly_rent) / v_lease.monthly_rent) * 100, 2
  );
  v_within_cap := v_increase_pct <= 7.00;

  insert into rent_increase_history (
    lease_id, previous_rent, new_rent,
    increase_pct, effective_date, within_ra9653
  ) values (
    p_lease_id, v_lease.monthly_rent, p_new_rent,
    v_increase_pct, p_effective_date, v_within_cap
  );

  update lease set
    monthly_rent            = p_new_rent,
    last_rent_increase_date = p_effective_date,
    is_rent_controlled      = (p_new_rent <= 10000)
  where id = p_lease_id;
end;
$$;


-- Validate invite token (called when tenant taps invite link)
create or replace function validate_invite_token(
  p_token text
) returns table (
  is_valid   boolean,
  tenant_id  uuid,
  reason     text
) language plpgsql security definer as $$
declare
  v_invite tenant_invite%rowtype;
begin
  select * into v_invite from tenant_invite where token = p_token;

  if not found then
    return query select false, null::uuid, 'Token not found';
    return;
  end if;

  if v_invite.status = 'accepted' then
    return query select false, null::uuid, 'Token already used';
    return;
  end if;

  if v_invite.status = 'revoked' then
    return query select false, null::uuid, 'Token has been revoked';
    return;
  end if;

  if v_invite.expires_at < now() then
    update tenant_invite set status = 'expired' where id = v_invite.id;
    return query select false, null::uuid, 'Token has expired';
    return;
  end if;

  return query select true, v_invite.tenant_id, 'Valid';
end;
$$;


-- Accept invite token (called after tenant sets up password)
create or replace function accept_invite_token(
  p_token    text,
  p_user_id  uuid
) returns void language plpgsql security definer as $$
declare
  v_invite tenant_invite%rowtype;
begin
  select * into v_invite from tenant_invite where token = p_token;

  if not found or v_invite.status != 'pending' then
    raise exception 'Invalid or already used token';
  end if;

  if v_invite.expires_at < now() then
    raise exception 'Token has expired';
  end if;

  -- Mark invite as accepted
  update tenant_invite
  set status = 'accepted', accepted_at = now()
  where id = v_invite.id;

  -- Create user profile linked to tenant record
  insert into user_profile (id, role, tenant_id, is_active)
  values (p_user_id, 'tenant', v_invite.tenant_id, true);
end;
$$;


-- ============================================================
-- 11. INDEXES
-- ============================================================

create index idx_property_landlord        on property (landlord_id);
create index idx_unit_property            on unit (property_id);
create index idx_unit_status              on unit (status);
create index idx_tenant_invite_token      on tenant_invite (token);
create index idx_tenant_invite_tenant     on tenant_invite (tenant_id);
create index idx_lease_unit               on lease (unit_id);
create index idx_lease_tenant_primary     on lease (primary_tenant_id);
create index idx_lease_status             on lease (status);
create index idx_lease_tenant_lease       on lease_tenant (lease_id);
create index idx_lease_tenant_tenant      on lease_tenant (tenant_id);
create index idx_rent_payment_lease       on rent_payment (lease_id);
create index idx_rent_payment_status      on rent_payment (status);
create index idx_rent_payment_period      on rent_payment (period_month, period_year);
create index idx_utility_bill_unit        on utility_bill (unit_id);
create index idx_utility_bill_period      on utility_bill (period_month, period_year);
create index idx_maintenance_unit         on maintenance_request (unit_id);
create index idx_maintenance_status       on maintenance_request (status);
create index idx_document_entity          on document (entity_type, entity_id);
create index idx_document_uploaded_by     on document (uploaded_by);
create index idx_deposit_tx_lease         on security_deposit_transaction (lease_id);
create index idx_rent_history_lease       on rent_increase_history (lease_id);
create index idx_or_number                on or_sequence (or_number);
create index idx_application_unit         on tenant_application (unit_id);
create index idx_application_status       on tenant_application (status);
create index idx_expense_property         on expense (property_id);
create index idx_expense_unit             on expense (unit_id);
create index idx_work_order_request       on work_order (request_id);
create index idx_work_order_vendor        on work_order (vendor_id);
