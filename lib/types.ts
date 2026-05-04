export type UserRole = 'landlord' | 'tenant';

export type UserProfile = {
  id: string;
  role: UserRole;
  landlord_id: string | null;
  tenant_id: string | null;
  is_active: boolean;
  created_at: string;
};

export type Landlord = {
  id: string;
  user_id: string;
  name: string;
  email: string;
  phone: string | null;
  bir_tin: string | null;
  created_at: string;
};

export type Property = {
  id: string;
  landlord_id: string;
  name: string;
  address: string;
  type: 'apartment' | 'house' | 'condo' | 'boarding_house' | 'commercial';
  electric_provider: 'meralco' | 'veco' | 'dlpc' | 'beneco' | 'neeco' | 'manual';
  default_rate_per_kwh: number | null;
  created_at: string;
};

export type UnitStatus = 'vacant' | 'occupied' | 'under_maintenance';

export type Unit = {
  id: string;
  property_id: string;
  unit_number: string;
  type: 'studio' | '1br' | '2br' | '3br' | 'room' | 'bedspace' | 'whole_unit' | null;
  floor: string | null;
  monthly_rent: number;
  status: UnitStatus;
  created_at: string;
};

export type Tenant = {
  id: string;
  name: string;
  email: string | null;
  phone: string;
  gov_id_type: string | null;
  gov_id_number: string | null;
  employer: string | null;
  monthly_income: number | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  created_at: string;
};

export type LeaseStatus = 'active' | 'expired' | 'terminated' | 'renewed';

export type Lease = {
  id: string;
  unit_id: string;
  primary_tenant_id: string;
  start_date: string;
  end_date: string;
  monthly_rent: number;
  security_deposit: number;
  security_deposit_status: 'held' | 'partially_refunded' | 'refunded' | 'forfeited';
  security_deposit_balance: number;
  advance_months: number;
  advance_amount: number;
  status: LeaseStatus;
  contract_url: string | null;
  is_rent_controlled: boolean;
  last_rent_increase_date: string | null;
  created_at: string;
};

export type PaymentStatus = 'unpaid' | 'pending' | 'paid' | 'partial' | 'overdue' | 'waived';

export type RentPayment = {
  id: string;
  lease_id: string;
  period_month: number;
  period_year: number;
  amount_due: number;
  amount_paid: number;
  payment_date: string | null;
  payment_method: 'gcash' | 'maya' | 'bank' | 'cash' | 'advance' | null;
  reference_number: string | null;
  status: PaymentStatus;
  confirmed_by: string | null;
  confirmed_at: string | null;
  or_number: string | null;
  created_at: string;
};

export type MaintenanceRequest = {
  id: string;
  unit_id: string;
  reported_by: string | null;
  title: string;
  description: string | null;
  category: 'plumbing' | 'electrical' | 'structural' | 'appliance' | 'pest' | 'other';
  priority: 'low' | 'medium' | 'high' | 'emergency';
  status: 'open' | 'assigned' | 'in_progress' | 'resolved' | 'closed';
  resolved_at: string | null;
  created_at: string;
};

export type UtilityBill = {
  id: string;
  unit_id: string;
  period_month: number;
  period_year: number;
  utility_type: 'electric' | 'water' | 'internet' | 'other';
  provider: string;
  reading_start: number | null;
  reading_end: number | null;
  kwh_consumed: number | null;
  rate_per_kwh: number | null;
  amount: number;
  status: 'unpaid' | 'paid';
  bill_pdf_url: string | null;
  parsed_by: 'llm' | 'manual' | null;
  rate_source: 'llm_parsed' | 'manual' | null;
  uploaded_by: 'landlord' | 'tenant';
  confirmed_by: string | null;
  confirmed_at: string | null;
  created_at: string;
};
